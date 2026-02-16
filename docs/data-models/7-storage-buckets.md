# 7. Storage Buckets

**Sources:**
- Migration `20251203190800_create_photos_table.sql` (photos bucket)
- Migration `20251205000001_add_love_notes_images.sql` (love-notes-images bucket)
- Migration `20251205000002_add_mime_validation.sql` (image upload policy)

## `photos` Bucket

| Setting | Value |
|---------|-------|
| Public | No (private) |
| File size limit | 10 MB |
| Purpose | Photo gallery images |
| Path pattern | `{user_id}/{uuid}.{ext}` |

### Storage RLS Policies

**SELECT (download):**
- Users can download files in their own folder (`(bucket_id = 'photos') AND (auth.uid()::text = (storage.foldername(name))[1])`)
- Partners can download each other's photos (via `get_my_partner_id()`)

**INSERT (upload):**
- Users can upload only to their own folder (`auth.uid()::text = (storage.foldername(name))[1]`)

**DELETE:**
- Users can delete only files in their own folder

### Access Pattern

1. Upload: `photoService.uploadPhoto()` stores file at `{userId}/{uuid}.{ext}`
2. View: `photoService.getSignedUrl()` generates 1-hour signed URLs
3. Delete: `photoService.deletePhoto()` removes both storage file and metadata record

## `love-notes-images` Bucket

| Setting | Value |
|---------|-------|
| Public | No (private) |
| File size limit | Default (Supabase default) |
| Purpose | Love note image attachments |
| Path pattern | `{user_id}/{timestamp}-{uuid}.{ext}` |

### Storage RLS Policies

**SELECT (download):**
- Users can view images in their own folder
- Partners can view each other's images (via `get_my_partner_id()`)

**INSERT (upload):**
- Users can upload to their own folder with file extension validation
- Accepted extensions: `.jpg`, `.jpeg`, `.png`, `.webp`
- Policy uses `storage.extension(name)` to validate

**Note:** The Edge Function (`upload-love-note-image`) uploads using the service role key, which bypasses Storage RLS. The RLS policies protect direct client access only.

### Access Pattern

1. Upload: `uploadLoveNoteImage()` -> Edge Function validates and uploads using service role
2. View: `getSignedImageUrl()` generates signed URLs with LRU cache
3. Delete: `deleteLoveNoteImage()` removes from storage

## Security Architecture

Both buckets use **private** mode, meaning all access requires signed URLs or authentication. The path-based folder isolation pattern (`{user_id}/...`) is enforced at the RLS level, so even authenticated users can only access files in their own folder or their partner's folder.

The `get_my_partner_id()` SECURITY DEFINER function is used by Storage RLS policies to determine partner access without causing RLS recursion on the `users` table.
