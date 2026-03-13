# 9. Photo Services

**Sources:**

- `src/services/photoService.ts` -- Supabase Storage operations
- `src/services/photoStorageService.ts` -- IndexedDB photo storage
- `src/services/loveNoteImageService.ts` -- Edge Function upload + signed URL cache
- `src/services/imageCompressionService.ts` -- Canvas API compression

## PhotoService (Supabase Storage)

**Singleton:** `export const photoService = new PhotoService()`

**Storage bucket:** `photos` (private)

**Signed URL expiry:** 3600 seconds (1 hour)

**Quota thresholds:** 1GB total, 80% warning, 95% critical

### Types

```typescript
interface SupabasePhoto {
  id: string;
  user_id: string;
  storage_path: string; // e.g., "{user_id}/photo.jpg"
  filename: string;
  caption: string | null;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  created_at: string;
}

interface PhotoWithUrls extends SupabasePhoto {
  signedUrl: string | null;
  isOwn: boolean;
}

interface StorageQuota {
  used: number;
  quota: number;
  percent: number;
  warning: 'none' | 'approaching' | 'critical' | 'exceeded';
}

interface PhotoUploadInput {
  file: Blob;
  filename: string;
  caption?: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}
```

### Methods

#### `getSignedUrl(storagePath, expiresIn?): Promise<string | null>`

Generates a signed URL for a private photo. Default expiry: 1 hour.

#### `getSignedUrls(storagePaths, expiresIn?): Promise<Map<string, string>>`

Parallel signed URL generation for multiple paths. Returns a Map of path to URL.

#### `checkStorageQuota(): Promise<StorageQuota>`

Calculates storage usage by summing `file_size` from the `photos` metadata table for the current user. Returns warning level based on thresholds.

#### `getPhotos(limit?, offset?): Promise<PhotoWithUrls[]>`

Fetches photos with signed URLs. RLS filters to own + partner photos. Sorted by `created_at` descending. Defaults: `limit = 50`, `offset = 0`.

#### `uploadPhoto(input, onProgress?): Promise<SupabasePhoto | null>`

Uploads a photo to Supabase Storage and creates a metadata record.

**Flow:**

1. Checks storage quota -- rejects if critical/exceeded
2. Generates unique storage path: `{userId}/{uuid}.{ext}`
3. Uploads blob to Storage bucket
4. Creates metadata record in `photos` table
5. On DB insert failure: **rolls back** by deleting the uploaded file
6. Checks quota post-upload and warns if approaching

**Progress callback:** Simulated progress (25% after upload starts, 75% after upload completes, 100% after DB insert).

#### `deletePhoto(photoId): Promise<boolean>`

Deletes both the storage file and database metadata. Verifies ownership before deletion. Continues with metadata deletion even if storage delete fails.

#### `getPhoto(photoId): Promise<PhotoWithUrls | null>`

Fetches a single photo with its signed URL.

#### `updatePhoto(photoId, updates): Promise<boolean>`

Only allows updating `caption` field. All other fields are immutable. Enforces ownership via `.eq('user_id', currentUserId)`.

---

## PhotoStorageService (IndexedDB)

**Singleton:** `export const photoStorageService = new PhotoStorageService()`

**Extends:** `BaseIndexedDBService<Photo, MyLoveDBSchema, 'photos'>`

Handles local IndexedDB photo storage with compression metadata. See Section 8 for inherited methods.

### Overridden Methods

#### `create(photo): Promise<Photo>`

Validates with `PhotoSchema.parse()`. Records performance metrics via `performanceMonitor`.

#### `getAll(): Promise<Photo[]>`

Overrides base: uses `by-date` index, returns newest first (reversed).

#### `getPage(offset?, limit?): Promise<Photo[]>`

Overrides base: uses `by-date` index with `'prev'` cursor direction for descending order. Default `limit = 20` (from `PAGINATION.DEFAULT_PAGE_SIZE`).

#### `update(id, updates): Promise<void>`

Validates partial updates with `PhotoSchema.partial().parse()`.

### Additional Methods

#### `getStorageSize(): Promise<number>`

Sums `compressedSize` across all photos. Returns total bytes.

#### `estimateQuotaRemaining(): Promise<{ used, quota, remaining, percentUsed }>`

Uses `navigator.storage.estimate()` (Storage API). Falls back to `STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES` (50MB) if API unavailable.

---

## LoveNoteImageService

**Module-level exports** (not a class).

**Edge Function URL:** `{VITE_SUPABASE_URL}/functions/v1/upload-love-note-image`

**Storage bucket:** `love-notes-images` (from `IMAGE_STORAGE.BUCKET_NAME`)

**Signed URL expiry:** 1 hour (from `IMAGE_STORAGE.SIGNED_URL_EXPIRY_SECONDS`)

**Cache:** LRU cache with max 100 entries (from `IMAGE_STORAGE.MAX_CACHE_SIZE`)

### Functions

#### `uploadLoveNoteImage(file, _userId): Promise<UploadResult>`

```typescript
interface UploadResult {
  storagePath: string;
  compressedSize: number;
}
```

1. Client-side validation via `imageCompressionService.validateImageFile()`
2. Client-side compression via `imageCompressionService.compressImage()`
3. Uploads compressed blob to Edge Function with `Authorization: Bearer {jwt}`
4. Edge Function validates MIME (magic bytes), size, rate limit
5. Returns `storagePath` for database record

**Error handling for HTTP status codes:**

- `429` -- "Too many uploads. Please wait a minute and try again."
- `413` -- "Image is too large."
- `415` -- "Invalid image type."

#### `uploadCompressedBlob(blob, _userId): Promise<UploadResult>`

Same as above but skips client-side validation/compression. Used for retry flows to avoid re-compression.

#### `getSignedImageUrl(storagePath, forceRefresh?): Promise<SignedUrlResult>`

```typescript
interface SignedUrlResult {
  url: string;
  expiresAt: number;
}
```

Generates a signed URL with LRU caching and request deduplication.

**Cache behavior:**

- Checks cache first (unless `forceRefresh = true`)
- Validates expiry with buffer (`URL_REFRESH_BUFFER_MS` before actual expiry)
- Deduplicates concurrent requests for the same path via `pendingRequests` Map
- Auto-cleans cache when exceeding `MAX_CACHE_SIZE`

#### `batchGetSignedUrls(storagePaths): Promise<Map<string, SignedUrlResult | null>>`

Parallel batch fetch with cache optimization. Returns cached URLs immediately, fetches only uncached paths.

#### `needsUrlRefresh(storagePath): boolean`

Returns `true` if the cached URL for a path is expired or about to expire.

#### `clearSignedUrlCache(): void`

Clears the entire signed URL cache. Call on logout.

#### `deleteLoveNoteImage(storagePath): Promise<void>`

Deletes an image from the `love-notes-images` storage bucket.

---

## ImageCompressionService

**Singleton:** `export const imageCompressionService = new ImageCompressionService()`

Uses the Canvas API for client-side image compression with no external dependencies.

### Configuration

| Setting       | Value           | Source                                 |
| ------------- | --------------- | -------------------------------------- |
| Max width     | 2048px          | `IMAGE_COMPRESSION.MAX_WIDTH`          |
| Max height    | 2048px          | `IMAGE_COMPRESSION.MAX_HEIGHT`         |
| JPEG quality  | 0.8 (80%)       | `IMAGE_COMPRESSION.QUALITY`            |
| Max file size | 25MB            | `IMAGE_VALIDATION.MAX_FILE_SIZE_BYTES` |
| Allowed types | JPEG, PNG, WebP | `IMAGE_VALIDATION.ALLOWED_MIME_TYPES`  |

### Methods

#### `compressImage(file, options?): Promise<CompressionResult>`

```typescript
interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  fallbackUsed?: boolean;
}
```

Resizes to max dimensions (maintaining aspect ratio), converts to JPEG 80%. Strips EXIF metadata automatically via Canvas redraw. Typical reduction: ~90% (3-5MB to 300-500KB).

**Fallback:** On Canvas API failure, returns original file as blob with `fallbackUsed: true`.

**Performance target:** <3 seconds for 10MB input. Warns if exceeded.

#### `validateImageFile(file): { valid: boolean; error?: string; warning?: string }`

Validates MIME type and file size. Returns warning for large files (>5MB) that may approach compression time limits.

#### `estimateCompressedSize(file): number`

Returns `file.size * 0.1` (conservative 10% estimate).
