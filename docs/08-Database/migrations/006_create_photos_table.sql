-- ============================================
-- Migration 006: Create Photos Storage Infrastructure
-- Created: 2025-11-25
-- Story: 6.0 - Photo Storage Schema & Buckets Setup
-- Purpose: Create photos metadata table, RLS policies, and storage bucket
-- ============================================

BEGIN;

-- ============================================
-- 1. Create photos metadata table (AC 6.0.2, 6.0.10)
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  caption TEXT CHECK (char_length(caption) <= 500),
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT valid_mime_type CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
);

-- Add table comment for documentation
COMMENT ON TABLE photos IS 'Photo metadata for Photo Gallery feature (Epic 6)';
COMMENT ON COLUMN photos.storage_path IS 'Path in Supabase Storage: {user_id}/{uuid}.{ext}';
COMMENT ON COLUMN photos.caption IS 'Optional caption, max 500 characters';
COMMENT ON COLUMN photos.mime_type IS 'Allowed: image/jpeg, image/png, image/webp';

-- ============================================
-- 2. Create performance indexes (AC 6.0.10)
-- ============================================
-- Primary query: gallery sorted by date (newest first)
CREATE INDEX IF NOT EXISTS idx_photos_user_created
  ON photos (user_id, created_at DESC);

-- Unique lookup by storage path
CREATE INDEX IF NOT EXISTS idx_photos_storage_path
  ON photos (storage_path);

-- ============================================
-- 3. Enable RLS on photos table (AC 6.0.3-6)
-- ============================================
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own photos (AC 6.0.3)
CREATE POLICY "Users can view own photos"
  ON photos FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Partners can view each other's photos via profiles.partner_id (AC 6.0.4)
CREATE POLICY "Partners can view partner photos"
  ON photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.partner_id = photos.user_id
    )
  );

-- Policy: Users can insert their own photos (AC 6.0.5)
CREATE POLICY "Users can insert own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own photos (AC 6.0.6)
CREATE POLICY "Users can delete own photos"
  ON photos FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. Create Supabase Storage bucket (AC 6.0.1)
-- NOTE: Bucket creation via SQL may not work in all Supabase environments
-- If this fails, create bucket manually via Supabase Dashboard:
--   Storage > New Bucket > Name: "photos" > Public: OFF
-- ============================================

-- Insert bucket (will fail silently if already exists due to DO block)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('photos', 'photos', false, 10485760)  -- 10MB limit
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================
-- 5. Storage RLS policies (AC 6.0.7, 6.0.8, 6.0.9)
-- ============================================

-- Policy: Users can upload to their own folder (AC 6.0.7)
-- Storage path format: {user_id}/{filename}
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can read their own photos (AC 6.0.8)
CREATE POLICY "Users can read own photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Partners can read each other's photos (AC 6.0.9)
CREATE POLICY "Partners can read partner photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.partner_id::text = (storage.foldername(name))[1]
    )
  );

-- Policy: Users can delete their own photos from storage
CREATE POLICY "Users can delete own photos from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;

-- ============================================
-- Verification Queries (Run after migration)
-- ============================================
-- 1. Verify photos table created with correct schema:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'photos' ORDER BY ordinal_position;

-- 2. Verify CHECK constraints:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'photos'::regclass;

-- 3. Verify indexes created:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'photos';

-- 4. Verify RLS enabled and policies created:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE tablename = 'photos';

-- 5. Verify storage bucket exists:
-- SELECT id, name, public FROM storage.buckets WHERE id = 'photos';

-- 6. Verify storage policies:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'objects' AND schemaname = 'storage';

-- 7. Test index usage with EXPLAIN ANALYZE:
-- EXPLAIN ANALYZE SELECT * FROM photos
-- WHERE user_id = 'some-uuid' ORDER BY created_at DESC LIMIT 20;
