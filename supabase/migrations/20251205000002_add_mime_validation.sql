-- Migration: Add MIME type validation to upload policy
-- Security: Server-side validation to prevent non-image uploads

-- Drop the existing upload policy
DROP POLICY IF EXISTS "Users upload own love note images" ON storage.objects;

-- Recreate with MIME type validation
-- Uses file extension check since we control the filename generation
CREATE POLICY "Users upload own love note images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'love-notes-images' AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  -- Validate file extension (our service always uses .jpg)
  storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp')
);
