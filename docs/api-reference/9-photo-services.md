# 9. Photo Services

**Sources:**

- `src/services/photoService.ts` -- Supabase Storage operations (cloud)
- `src/services/photoStorageService.ts` -- IndexedDB operations (local, see [doc 8](./8-indexeddb-services.md))
- `src/services/imageCompressionService.ts` -- Canvas API compression
- `src/services/loveNoteImageService.ts` -- Love note image uploads via Edge Function

## PhotoService (Supabase Storage)

Singleton: `photoService`. Manages cloud photo storage in the `photos` bucket.

### `getSignedUrl(storagePath, expiresIn?): Promise<string | null>`

Generates signed URL for private photo access. Default expiry: 1 hour (3600s).

### `getSignedUrls(storagePaths[], expiresIn?): Promise<Map<string, string>>`

Parallel signed URL generation for multiple photos.

### `checkStorageQuota(): Promise<StorageQuota>`

Calculates storage usage from `photos.file_size` column. Returns warning levels: none (< 80%), approaching (80-95%), critical (95-100%), exceeded (100%+).

### `getPhotos(limit?, offset?): Promise<PhotoWithUrls[]>`

Fetches photos with RLS filtering (own + partner), generates signed URLs, marks ownership.

### `uploadPhoto(input, onProgress?): Promise<SupabasePhoto | null>`

Uploads to Supabase Storage, creates metadata record in `photos` table. Checks quota before upload. Rolls back storage upload if DB insert fails. Path format: `{user_id}/{uuid}.{ext}`.

### `deletePhoto(photoId): Promise<boolean>`

Verifies ownership, deletes from storage then database. Continues DB delete even if storage delete fails.

### `getPhoto(photoId): Promise<PhotoWithUrls | null>`

Single photo with signed URL.

### `updatePhoto(photoId, updates): Promise<boolean>`

Only allows caption updates (other fields immutable).

## ImageCompressionService

Singleton: `imageCompressionService`. Client-side image compression using Canvas API.

### `compressImage(file: File, options?): Promise<CompressionResult>`

Resizes to max 2048px, converts to JPEG at 80% quality. Strips EXIF via canvas redraw. Target: <3s for 10MB input. Falls back to original file on failure.

### `validateImageFile(file: File): { valid, error?, warning? }`

Validates MIME type (JPEG/PNG/WebP), max file size (25MB), warns on large files (>10MB).

### `estimateCompressedSize(file: File): number`

Returns `file.size * 0.1` (conservative 90% reduction estimate).

## LoveNoteImageService

Module-level functions for love note image uploads via Edge Function.

### `uploadLoveNoteImage(file, _userId): Promise<UploadResult>`

Client-side validation + compression, then POST to `upload-love-note-image` Edge Function.

### `uploadCompressedBlob(blob, _userId): Promise<UploadResult>`

Uploads pre-compressed blob (for retry flows).

### `getSignedImageUrl(storagePath, forceRefresh?): Promise<SignedUrlResult>`

Cached signed URL generation with LRU eviction (max 200 entries) and request deduplication.

### `batchGetSignedUrls(storagePaths[]): Promise<Map<string, SignedUrlResult | null>>`

Batch fetch with cache optimization.

### `needsUrlRefresh(storagePath): boolean`

Checks if cached URL is expired or about to expire.

### `clearSignedUrlCache(): void`

Clears all cached URLs (call on logout).

### `deleteLoveNoteImage(storagePath): Promise<void>`

Deletes image from `love-notes-images` bucket.
