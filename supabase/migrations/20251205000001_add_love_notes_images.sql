-- Migration: Add image support to love_notes
-- Feature: Love Notes Image Attachments

-- Add image_url column to love_notes table
ALTER TABLE love_notes
ADD COLUMN image_url TEXT NULL;

-- Comment for clarity
COMMENT ON COLUMN love_notes.image_url IS 'Storage path in love-notes-images bucket, null for text-only messages';

-- Create storage bucket for love note images
INSERT INTO storage.buckets (id, name, public)
VALUES ('love-notes-images', 'love-notes-images', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload to their own folder
CREATE POLICY "Users upload own love note images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'love-notes-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can read their own images
CREATE POLICY "Users read own love note images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'love-notes-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Partners can read each other's images
CREATE POLICY "Partners read partner love note images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'love-notes-images' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.partner_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Users can delete their own images
CREATE POLICY "Users delete own love note images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'love-notes-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
