# 9. Photo Services

**Sources:**
- `src/services/photoService.ts` (Supabase Storage operations)
- `src/services/imageCompressionService.ts` (client-side compression)
- `src/services/loveNoteImageService.ts` (Edge Function upload + signed URL cache)
- `supabase/functions/upload-love-note-image/index.ts` (server-side validation)

## Overview

Photo handling is split across four modules by responsibility:

| Module | Responsibility | Storage Target |
|--------|---------------|----------------|
| `photoService` | Gallery photo CRUD via Supabase Storage | `photos` bucket |
| `imageCompressionService` | Client-side Canvas API compression | In-memory (returns Blob) |
| `loveNoteImageService` | Love note image upload via Edge Function | `love-note-images` bucket |
| Edge Function | Server-side MIME validation and rate limiting | `love-note-images` bucket |

## PhotoService (src/services/photoService.ts)

**Singleton:** `photoService`

Manages the photo gallery stored in the `photos` Supabase Storage bucket. All operations are RLS-protected.

### Types

```typescript
interface SupabasePhoto {
  id: string;
  user_id: string;
  storage_path: string;  // "{user_id}/{uuid}.{ext}"
  filename: string;
  caption: string | null;
  mime_type: string;      // DB constraint: 'image/jpeg' | 'image/png' | 'image/webp'
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
  quota: number;        // 1GB free tier
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

Generates a signed URL for private photo access. Default expiry: 3600 seconds (1 hour).

#### `getSignedUrls(storagePaths, expiresIn?): Promise<Map<string, string>>`

Batch generates signed URLs using `Promise.allSettled` for parallel execution. Returns a Map of path to URL, skipping failed entries.

#### `checkStorageQuota(): Promise<StorageQuota>`

Calculates storage usage by summing `file_size` from the `photos` table for the current user.

| Threshold | Warning Level |
|-----------|--------------|
| < 80% | `'none'` |
| >= 80% | `'approaching'` |
| >= 95% | `'critical'` |
| >= 100% | `'exceeded'` |

Returns a safe default (`used: 0`, `warning: 'none'`) on any error.

#### `getPhotos(limit?, offset?): Promise<PhotoWithUrls[]>`

Fetches photos (own + partner's via RLS) sorted newest first, with signed URLs. Uses `.range()` for server-side pagination.

#### `uploadPhoto(input, onProgress?): Promise<SupabasePhoto | null>`

**Flow:**
1. Check storage quota -- reject if `'exceeded'` or `'critical'`
2. Generate storage path: `{userId}/{uuid}.{ext}`
3. Upload to Supabase Storage
4. Create metadata record in `photos` table
5. If DB insert fails, rollback by deleting the uploaded file
6. Re-check quota and warn if approaching limit

Progress callback receives synthetic progress values (25%, 75%, 100%) since Supabase Storage does not support native upload progress.

#### `deletePhoto(photoId): Promise<boolean>`

Deletes storage file first, then metadata record. Continues metadata deletion even if storage delete fails (file may already be missing). Verifies ownership client-side in addition to RLS.

#### `getPhoto(photoId): Promise<PhotoWithUrls | null>`

Fetches a single photo with signed URL.

#### `updatePhoto(photoId, updates): Promise<boolean>`

Only `caption` is mutable. All other fields in `updates` are silently ignored. Ownership enforced via `.eq('user_id', currentUserId)`.

## ImageCompressionService (src/services/imageCompressionService.ts)

**Singleton:** `imageCompressionService`

Client-side image compression using the Canvas API. No external dependencies.

### Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Max width | 2048px | `IMAGE_COMPRESSION.MAX_WIDTH` |
| Max height | 2048px | `IMAGE_COMPRESSION.MAX_HEIGHT` |
| JPEG quality | 80% | `IMAGE_COMPRESSION.QUALITY` |
| Performance target | < 3 seconds for 10MB input | |

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

**Flow:**
1. Load image via `URL.createObjectURL()` + `Image` element
2. Calculate new dimensions maintaining aspect ratio (cap at max width/height)
3. Draw onto a `<canvas>` element (strips EXIF metadata automatically)
4. Export as JPEG blob via `canvas.toBlob()`
5. Log compression stats: original size, compressed size, reduction %, duration

**Fallback:** On any error, returns the original file as-is with `fallbackUsed: true`, so uploads can proceed even if Canvas API fails.

#### `validateImageFile(file): { valid: boolean; error?: string; warning?: string }`

| Check | Result |
|-------|--------|
| MIME not in `[image/jpeg, image/png, image/webp]` | `{ valid: false, error: '...' }` |
| Size > 25MB | `{ valid: false, error: '...' }` |
| Size > large file threshold | `{ valid: true, warning: '...' }` |
| Otherwise | `{ valid: true }` |

#### `estimateCompressedSize(file): number`

Returns `file.size * 0.1` (conservative 90% reduction estimate).

## LoveNoteImageService (src/services/loveNoteImageService.ts)

Handles image uploads for love notes chat messages using an Edge Function for server-side validation.

### Signed URL Cache

In-memory cache with LRU eviction and request deduplication.

```typescript
interface CachedUrl {
  url: string;
  expiresAt: number;
  lastAccessed: number;  // LRU tracking
}
```

- **Cache validity:** URL is valid if `Date.now() < expiresAt - URL_REFRESH_BUFFER`
- **Max cache size:** `IMAGE_STORAGE.MAX_CACHE_SIZE` entries (LRU eviction when exceeded)
- **Request deduplication:** `pendingRequests` Map prevents duplicate API calls when multiple components request the same path concurrently

### Functions

#### `uploadLoveNoteImage(file, _userId): Promise<UploadResult>`

```typescript
interface UploadResult {
  storagePath: string;
  compressedSize: number;
}
```

**Flow:**
1. Client-side validation via `imageCompressionService.validateImageFile()`
2. Client-side compression via `imageCompressionService.compressImage()`
3. Get JWT from current session
4. POST compressed blob to Edge Function URL with `Authorization` header
5. Parse response and handle error codes (429 rate limit, 413 too large, 415 invalid type)

#### `uploadCompressedBlob(blob, _userId): Promise<UploadResult>`

Same as `uploadLoveNoteImage` but skips validation and compression. Used for retry flows to avoid re-compression.

#### `getSignedImageUrl(storagePath, forceRefresh?): Promise<SignedUrlResult>`

```typescript
interface SignedUrlResult {
  url: string;
  expiresAt: number;
}
```

Checks cache first (unless `forceRefresh`), then checks in-flight requests for deduplication, then fetches from Supabase Storage. Caches the result with LRU tracking.

#### `needsUrlRefresh(storagePath): boolean`

Returns `true` if the cached URL for the path is missing or about to expire.

#### `clearSignedUrlCache(): void`

Clears the entire cache. Called on logout.

#### `batchGetSignedUrls(storagePaths): Promise<Map<string, SignedUrlResult | null>>`

Batch fetches signed URLs. Resolves from cache first, then fetches remaining paths in parallel. Runs cache cleanup after batch to handle edge cases where parallel fetches exceed max size.

#### `deleteLoveNoteImage(storagePath): Promise<void>`

Deletes an image from the `love-note-images` bucket.

## Edge Function: upload-love-note-image

**Source:** `supabase/functions/upload-love-note-image/index.ts`
**Runtime:** Deno (Supabase Edge Functions)

Server-side image validation and upload. Runs on every love note image upload.

### Validation Pipeline

1. **Authentication:** Extract JWT from `Authorization` header, verify via Supabase Auth
2. **Rate limiting:** In-memory Map keyed by user ID, max 10 uploads per 60 seconds per user
3. **Size check:** Max 5MB request body
4. **MIME detection:** Read first 12 bytes for magic byte signatures

### Magic Byte MIME Detection

| Format | Magic Bytes |
|--------|-------------|
| JPEG | `0xFF 0xD8 0xFF` |
| PNG | `0x89 0x50 0x4E 0x47` |
| GIF | `0x47 0x49 0x46 0x38` |
| WebP | Bytes 8-11: `0x57 0x45 0x42 0x50` |

### Upload Path

Storage path format: `{userId}/{timestamp}-{uuid}.{ext}`

The function uploads to the `love-note-images` bucket using the Supabase service role key (bypasses Storage RLS for the upload, since the function has already validated the user).

### Response

```typescript
// Success (200)
{ success: true, storagePath: string, size: number, mimeType: string, rateLimitRemaining: number }

// Error (400/401/413/415/429/500)
{ success: false, error: string, message: string }
```
