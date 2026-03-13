# 7. Storage Buckets

**Sources:**

- `supabase/migrations/20251203190800_create_photos_table.sql` -- Photos bucket
- `supabase/migrations/20251205000001_add_love_notes_images.sql` -- Love notes images bucket
- `src/services/photoService.ts` -- Photos bucket operations
- `src/services/loveNoteImageService.ts` -- Love notes images operations

## Buckets

### `photos`

Private bucket for user photo uploads.

| Property               | Value                                   |
| ---------------------- | --------------------------------------- |
| **Access**             | Private (requires signed URLs)          |
| **Signed URL expiry**  | 3600 seconds (1 hour)                   |
| **Path pattern**       | `{user_id}/{uuid}.{ext}`                |
| **Allowed MIME types** | `image/jpeg`, `image/png`, `image/webp` |
| **Quota**              | 1GB free tier per project               |
| **Warning threshold**  | 80% usage                               |
| **Critical threshold** | 95% usage (uploads rejected)            |

**RLS Policies:**

- Users can upload only to their own folder (`{user_id}/`)
- Users can read own photos
- Partners can read each other's photos
- Users can delete only their own photos

**Service:** `PhotoService` (`src/services/photoService.ts`)

---

### `love-notes-images`

Private bucket for chat image attachments in love notes.

| Property              | Value                                    |
| --------------------- | ---------------------------------------- |
| **Access**            | Private (requires signed URLs)           |
| **Signed URL expiry** | 3600 seconds (1 hour)                    |
| **Path pattern**      | `{user_id}/{timestamp}-{uuid}.jpg`       |
| **Upload method**     | Edge Function (`upload-love-note-image`) |
| **Max cache size**    | 100 entries (LRU eviction)               |

**Upload flow:**

1. Client compresses image via `imageCompressionService`
2. Client sends compressed blob to Edge Function
3. Edge Function validates MIME (magic bytes), size, rate limit
4. Edge Function uploads to Storage and returns path

**Rate limiting:** Enforced by Edge Function (HTTP 429 on exceeded).

**RLS Policies:**

- Uploads go through Edge Function (service role key), not direct client access
- Read access via signed URLs requires authentication

**Service:** `LoveNoteImageService` (`src/services/loveNoteImageService.ts`)

## Signed URL Caching

The `LoveNoteImageService` implements an LRU cache for signed URLs:

- **Max entries:** 100 (configurable via `IMAGE_STORAGE.MAX_CACHE_SIZE`)
- **Refresh buffer:** URLs are considered stale before actual expiry (`URL_REFRESH_BUFFER_MS`)
- **Deduplication:** Concurrent requests for the same path share a single API call
- **Batch support:** `batchGetSignedUrls()` optimizes parallel fetches with cache hits
