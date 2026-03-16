# 7. Storage Buckets

## `photos` Bucket

| Property        | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Name            | `photos`                                                 |
| Public          | No (private, requires signed URLs)                       |
| File size limit | 10 MB                                                    |
| Created in      | Migration 002 (`20251203190800_create_photos_table.sql`) |
| Path format     | `{user_id}/{uuid}.{ext}`                                 |

### RLS Policies on `storage.objects`

| Policy                                   | Operation | Rule                                                              |
| ---------------------------------------- | --------- | ----------------------------------------------------------------- |
| Users can upload own photos              | INSERT    | `bucket_id = 'photos' AND auth.uid()::text = foldername(name)[1]` |
| Users can read own photos                | SELECT    | Same as above                                                     |
| Partners can read partner photos         | SELECT    | `EXISTS (users WHERE partner_id::text = foldername(name)[1])`     |
| Users can delete own photos from storage | DELETE    | Same as upload rule                                               |

### Client Access

- Signed URLs via `photoService.getSignedUrl()` with 1-hour expiry
- Upload via `photoService.uploadPhoto()` with quota checks

## `love-notes-images` Bucket

| Property        | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Name            | `love-notes-images`                                        |
| Public          | No (private, requires signed URLs)                         |
| File size limit | 5 MB (enforced by Edge Function)                           |
| Created in      | Migration 003 (`20251205000001_add_love_notes_images.sql`) |
| Path format     | `{user_id}/{timestamp}-{uuid}.jpg`                         |

### RLS Policies on `storage.objects`

| Policy                                 | Operation | Rule                                                                                                                      |
| -------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Users upload own love note images      | INSERT    | `bucket_id = 'love-notes-images' AND auth.uid()::text = foldername(name)[1] AND extension IN ('jpg','jpeg','png','webp')` |
| Users read own love note images        | SELECT    | `bucket_id = 'love-notes-images' AND auth.uid()::text = foldername(name)[1]`                                              |
| Partners read partner love note images | SELECT    | `EXISTS (users WHERE partner_id::text = foldername(name)[1])`                                                             |
| Users delete own love note images      | DELETE    | Same as read own rule                                                                                                     |

MIME validation added in Migration 004 (`20251205000002_add_mime_validation.sql`).

### Client Access

- Upload via `upload-love-note-image` Edge Function (server-side validation)
- Signed URLs via `loveNoteImageService.getSignedImageUrl()` with caching and request deduplication
- Batch URLs via `batchGetSignedUrls()`

## Edge Function: `upload-love-note-image`

**Source:** `supabase/functions/upload-love-note-image/index.ts`

Server-side validation for love note image uploads:

| Feature            | Details                                             |
| ------------------ | --------------------------------------------------- |
| Max file size      | 5 MB                                                |
| Allowed MIME types | JPEG, PNG, WebP, GIF                                |
| MIME detection     | Magic bytes (not Content-Type header)               |
| Rate limiting      | 10 uploads/minute/user (in-memory)                  |
| Auth               | JWT from Authorization header                       |
| Upload format      | `application/octet-stream` or `multipart/form-data` |

### Response

```json
{
  "success": true,
  "storagePath": "{user_id}/{timestamp}-{uuid}.jpg",
  "size": 123456,
  "mimeType": "image/jpeg",
  "rateLimitRemaining": 8
}
```

### Error Codes

- `401` -- Unauthorized
- `405` -- Method not allowed
- `413` -- File too large
- `415` -- Invalid MIME type
- `429` -- Rate limit exceeded (Retry-After: 60)
- `500` -- Upload failed / internal error
