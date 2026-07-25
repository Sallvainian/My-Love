# 9. Photo Services

**Sources:**

- `src/services/photoService.ts` -- Supabase Storage operations (cloud, `photos` bucket)
- `src/services/imageCompressionService.ts` -- Canvas API compression
- `src/services/loveNoteImageService.ts` -- Love note image uploads via Edge Function

> **Removed since the 2026-03 scan.** `src/services/photoStorageService.ts` (IndexedDB photo store, 334 lines) was deleted. Photos are now Supabase-first. Local IndexedDB photo CRUD, where still needed, goes through `storageService` -- see [doc 8](./8-indexeddb-services.md). The `photos` object store still exists in the IndexedDB schema (v2).

## PhotoService (Supabase Storage)

Singleton: `photoService`. Manages cloud photo storage in the `photos` bucket.

**Constants:** `BUCKET_NAME = 'photos'`, `SIGNED_URL_EXPIRY = 3600` (1 hour), `STORAGE_QUOTA = 1 GiB` (free tier), `WARNING_THRESHOLD = 0.8`, `CRITICAL_THRESHOLD = 0.95`.

### `getSignedUrl(storagePath, expiresIn?): Promise<string | null>`

Generates a signed URL for private photo access. Default expiry: 1 hour.

### `getSignedUrls(storagePaths[], expiresIn?): Promise<Map<string, string>>`

Parallel signed URL generation for multiple photos.

### `checkStorageQuota(): Promise<StorageQuota>`

Calculates storage usage from the `photos` size column. Returns warning levels: none (< 80%), approaching (80--95%), critical (95--100%), exceeded (100%+).

### `getPhotos(limit = 50, offset = 0): Promise<PhotoWithUrls[]>`

Fetches photos with RLS filtering (own + partner), generates signed URLs, and marks ownership via the `isOwn` flag.

### `uploadPhoto(input, onProgress?): Promise<SupabasePhoto | null>`

Uploads to Supabase Storage, then creates the metadata record in the `photos` table. Checks quota before upload and rolls back the storage object if the DB insert fails. Path format: `{user_id}/{uuid}.{ext}`.

The `onProgress` callback receives 0--100 and drives the `uploadProgress` field in [photosSlice](../state-management/photos-slice.md).

### `deletePhoto(photoId): Promise<boolean>`

Verifies ownership, then deletes from storage and the database. Continues with the DB delete even if the storage delete fails (avoids orphaned rows).

### `getPhoto(photoId): Promise<PhotoWithUrls | null>`

Single photo with signed URL.

### `updatePhoto(photoId, updates): Promise<boolean>`

**Only `caption` is writable** -- every other field is filtered out of the update payload. Returns `false` (with a warning) if no allowed field was supplied. The query is additionally scoped by `.eq('user_id', currentUser.id)` so ownership is enforced client-side as well as by RLS.

> Note: `photosSlice.updatePhoto()` accepts `Partial<SupabasePhoto>` and optimistically merges whatever it is given into local state, but the service will silently persist only the caption. Tag edits will appear to work until reload.

## ImageCompressionService

Singleton: `imageCompressionService`. Client-side image compression using the Canvas API.

### `compressImage(file: File, options?): Promise<CompressionResult>`

Resizes to a max of 2048 x 2048 (aspect ratio preserved, dimensions floored to whole pixels), converts to JPEG at 80% quality. Strips EXIF as a side effect of the canvas redraw. Benchmarked with `performance.now()`; target is < 3s for a 10 MB input. Returns `fallbackUsed: true` with the original file if compression fails.

Defaults come from `IMAGE_COMPRESSION` in `src/config/images.ts`.

### `validateImageFile(file: File): { valid, error?, warning? }`

Validates MIME type (JPEG / PNG / WebP), enforces a 25 MB max file size, and warns above 10 MB (may approach the 3s compression budget). Limits come from `IMAGE_VALIDATION`.

### `estimateCompressedSize(file: File): number`

Returns a conservative estimate of the post-compression size.

## LoveNoteImageService

Module-level functions (not a class) for love note image uploads via the `upload-love-note-image` Edge Function. Configuration comes from `IMAGE_STORAGE` in `src/config/images.ts`: bucket `love-notes-images`, 3600s signed URL expiry, 5-minute refresh buffer, `MAX_CACHE_SIZE = 100`.

### Exported functions

| Function                                          | Description                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `uploadLoveNoteImage(file, _userId)`              | Client-side validation + compression, then POST to the Edge Function                      |
| `uploadCompressedBlob(blob, _userId)`             | Uploads a pre-compressed blob -- used by the retry path so images are not re-compressed   |
| `getSignedImageUrl(storagePath, forceRefresh?)`   | Cached signed URL generation with LRU eviction and in-flight request deduplication         |
| `deleteLoveNoteImage(storagePath)`                | Deletes an image from the `love-notes-images` bucket                                       |

Two module-level maps back the caching layer: `signedUrlCache` (`Map<string, CachedUrl>` with `url` / `expiresAt` / `lastAccessed`) and `pendingRequests` (`Map<string, Promise<SignedUrlResult>>`) for deduplication. `cleanCache()` drops expired entries and enforces `MAX_CACHE_SIZE` via LRU on `lastAccessed`. A URL is considered valid while `Date.now() < expiresAt - URL_REFRESH_BUFFER`.

> **Removed since the 2026-03 scan:** `batchGetSignedUrls()`, `needsUrlRefresh()`, and `clearSignedUrlCache()` were deleted in the dead-code sweep. The LRU max is 100 entries (previously documented as 200).

## Related

- Upload flow and retry semantics: [Notes Slice](../state-management/notes-slice.md)
- Bucket configuration and RLS: [Storage Buckets](../data-models/7-storage-buckets.md)
