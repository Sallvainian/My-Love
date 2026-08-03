-- Allow a user to overwrite their own photo object
--
-- photoService.uploadPhoto derives a stable storage path from the caller's
-- idempotency key and uploads with `upsert: true`, so that a retry after a
-- partial success targets the object its own earlier attempt wrote instead of
-- creating a second one. Overwriting an existing object is an UPDATE on
-- storage.objects, and the photos bucket granted only INSERT, SELECT and
-- DELETE (20251203190800_create_photos_table.sql:97-129).
--
-- The result was that the retry path the idempotency work exists to cover was
-- the one path guaranteed to fail: the first attempt writes the object, the
-- retry re-uploads to the same key, RLS rejects the overwrite, and uploadPhoto
-- throws before it reaches the deduplicating upsert on public.photos.
--
-- This is not a widening of what a user can do -- "Users can upload own photos"
-- plus "Users can delete own photos from storage" already let them replace any
-- object in their own folder. It only lets them do it in one statement.

BEGIN;

-- Mirrors the INSERT policy's predicate exactly: the first path segment is the
-- owner's user id, so this can only ever match the caller's own folder. USING
-- gates which existing rows the UPDATE can see; WITH CHECK gates the row it is
-- allowed to leave behind. Postgres would reuse USING as the WITH CHECK if the
-- latter were omitted, so spelling both out changes nothing here -- it is
-- written explicitly because this policy is the only barrier stopping one
-- partner renaming the other's object into their own folder, and an implicit
-- rule is a poor place to leave that.
CREATE POLICY "Users can update own photos in storage"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;
