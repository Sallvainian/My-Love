# 9. Service Layer

All services use IndexedDB for local persistence. Services extending `BaseIndexedDBService` share a common database (`my-love-db`, currently version 5).

## 9.1 BaseIndexedDBService

**Module:** `src/services/BaseIndexedDBService.ts`

Abstract generic base class providing CRUD operations for IndexedDB stores.

```typescript
abstract class BaseIndexedDBService<
  T extends { id?: number | string },
  DBTypes extends DBSchema,
  StoreName extends StoreNames<DBTypes>
>
```

**Error Handling Strategy:**
- Read operations (`get`, `getAll`, `getPage`): Return `null` or empty array on error (graceful degradation).
- Write operations (`add`, `update`, `delete`, `clear`): Throw errors (data integrity).

### Inherited Methods

| Method | Signature | Description |
|---|---|---|
| `init()` | `async init(): Promise<void>` | Initialization guard preventing concurrent DB setup |
| `add(item)` | `protected async add(item: Omit<T, 'id'>): Promise<T>` | Insert with auto-increment ID. Protected to enforce validation via `create()`. |
| `get(id)` | `async get(id: number \| string): Promise<T \| null>` | Fetch by ID. Returns `null` on error. |
| `getAll()` | `async getAll(): Promise<T[]>` | Fetch all items. Returns `[]` on error. |
| `update(id, updates)` | `async update(id: number \| string, updates: Partial<T>): Promise<void>` | Merge updates into existing record. Throws if not found. |
| `delete(id)` | `async delete(id: number \| string): Promise<void>` | Remove by ID. Throws on error. |
| `clear()` | `async clear(): Promise<void>` | Remove all items from store. Throws on error. |
| `getPage(offset, limit)` | `async getPage(offset: number, limit: number): Promise<T[]>` | Cursor-based pagination. O(offset + limit). Returns `[]` on error. |

### Abstract Methods (implemented by subclasses)

| Method | Description |
|---|---|
| `getStoreName()` | Returns the object store name |
| `_doInit()` | Service-specific DB initialization |

---

## 9.2 Database Schema

**Module:** `src/services/dbSchema.ts`

### Constants

| Constant | Value |
|---|---|
| `DB_NAME` | `'my-love-db'` |
| `DB_VERSION` | `5` |

### Object Stores

| Store Name | Key | Auto-increment | Indexes |
|---|---|---|---|
| `messages` | `id` (number) | Yes | `by-category` (string), `by-date` (Date) |
| `photos` | `id` (number) | Yes | `by-date` (Date) |
| `moods` | `id` (number) | Yes | `by-date` (string, unique) |
| `sw-auth` | `id` ('current') | No | None |
| `scripture-sessions` | `id` (string) | No | `by-user` (string) |
| `scripture-reflections` | `id` (string) | No | `by-session` (string) |
| `scripture-bookmarks` | `id` (string) | No | `by-session` (string) |
| `scripture-messages` | `id` (string) | No | `by-session` (string) |

### `upgradeDb(db, oldVersion, newVersion)`

Centralized migration function handling v1 through v5 schema upgrades. Called by all services during `openDB`.

---

## 9.3 StorageService

**Module:** `src/services/storage.ts`
**Singleton export:** `storageService`

Legacy service providing direct IndexedDB operations for photos and messages. Predates `BaseIndexedDBService` extraction.

### Photo Operations

| Method | Signature | Description |
|---|---|---|
| `addPhoto` | `(photo: Omit<Photo, 'id'>): Promise<number>` | Insert photo, return auto-generated ID |
| `getPhoto` | `(id: number): Promise<Photo \| undefined>` | Fetch by ID |
| `getAllPhotos` | `(): Promise<Photo[]>` | Fetch all photos |
| `deletePhoto` | `(id: number): Promise<void>` | Remove by ID |
| `updatePhoto` | `(id: number, updates: Partial<Photo>): Promise<void>` | Merge updates |

### Message Operations

| Method | Signature | Description |
|---|---|---|
| `addMessage` | `(message: Omit<Message, 'id'>): Promise<number>` | Insert message |
| `getMessage` | `(id: number): Promise<Message \| undefined>` | Fetch by ID |
| `getAllMessages` | `(): Promise<Message[]>` | Fetch all messages |
| `getMessagesByCategory` | `(category: string): Promise<Message[]>` | Filter by category index |
| `updateMessage` | `(id: number, updates: Partial<Message>): Promise<void>` | Merge updates |
| `deleteMessage` | `(id: number): Promise<void>` | Remove by ID |
| `toggleFavorite` | `(messageId: number): Promise<void>` | Toggle `isFavorite` boolean |
| `addMessages` | `(messages: Omit<Message, 'id'>[]): Promise<void>` | Bulk insert via transaction |

### Utility Operations

| Method | Signature | Description |
|---|---|---|
| `clearAllData` | `(): Promise<void>` | Clear photos and messages stores |
| `exportData` | `(): Promise<{ photos: Photo[]; messages: Message[] }>` | Export all data for backup |

### `localStorageHelper`

Utility object for typed localStorage access with JSON serialization:

| Method | Signature |
|---|---|
| `get<T>` | `(key: string, defaultValue: T): T` |
| `set<T>` | `(key: string, value: T): void` |
| `remove` | `(key: string): void` |
| `clear` | `(): void` |

---

## 9.4 PhotoService (Supabase Storage)

**Module:** `src/services/photoService.ts`
**Singleton export:** `photoService`

Manages photos in Supabase Storage (bucket: `photos`). RLS-enforced user-scoped storage paths (`{user_id}/{filename}`).

### Types

```typescript
interface SupabasePhoto {
  id: string; user_id: string; storage_path: string; filename: string;
  caption: string | null; mime_type: string; file_size: number;
  width: number; height: number; created_at: string;
}

interface PhotoWithUrls extends SupabasePhoto {
  signedUrl: string | null;
  isOwn: boolean;
}

interface StorageQuota {
  used: number; quota: number; percent: number;
  warning: 'none' | 'approaching' | 'critical' | 'exceeded';
}
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `getSignedUrl` | `(storagePath: string, expiresIn?: number): Promise<string \| null>` | Generate 1-hour signed URL for private photo |
| `getSignedUrls` | `(storagePaths: string[], expiresIn?: number): Promise<Map<string, string>>` | Parallel signed URL generation for multiple photos |
| `checkStorageQuota` | `(): Promise<StorageQuota>` | Calculate storage usage from DB. Warning at 80%, critical at 95% |
| `getPhotos` | `(limit?: number, offset?: number): Promise<PhotoWithUrls[]>` | Fetch user + partner photos with signed URLs. Sorted newest first |
| `uploadPhoto` | `(input: PhotoUploadInput, onProgress?: (percent: number) => void): Promise<SupabasePhoto \| null>` | Upload to Storage + create metadata record. Rollback on DB failure. Quota checks. |
| `deletePhoto` | `(photoId: string): Promise<boolean>` | Delete from Storage + DB. Verifies ownership. |
| `getPhoto` | `(photoId: string): Promise<PhotoWithUrls \| null>` | Fetch single photo with signed URL |
| `updatePhoto` | `(photoId: string, updates: Partial<SupabasePhoto>): Promise<boolean>` | Update caption only (other fields immutable) |

---

## 9.5 PhotoStorageService (IndexedDB)

**Module:** `src/services/photoStorageService.ts`
**Singleton export:** `photoStorageService`
**Extends:** `BaseIndexedDBService<Photo, MyLoveDBSchema, 'photos'>`

Local IndexedDB storage for photos with Zod validation and performance monitoring.

### Methods (beyond inherited)

| Method | Signature | Description |
|---|---|---|
| `create` | `(photo: Omit<Photo, 'id'>): Promise<Photo>` | Zod-validated insert with performance measurement |
| `getAll` | `(): Promise<Photo[]>` | Overrides base: uses `by-date` index, returns newest first |
| `getPage` | `(offset?: number, limit?: number): Promise<Photo[]>` | Overrides base: descending cursor on `by-date` index |
| `update` | `(id: number, updates: Partial<Photo>): Promise<void>` | Overrides base: adds Zod partial validation |
| `getStorageSize` | `(): Promise<number>` | Sum of `compressedSize` across all photos |
| `estimateQuotaRemaining` | `(): Promise<{ used, quota, remaining, percentUsed }>` | Uses `navigator.storage.estimate()` |

---

## 9.6 CustomMessageService

**Module:** `src/services/customMessageService.ts`
**Singleton export:** `customMessageService`
**Extends:** `BaseIndexedDBService<Message, MyLoveDBSchema, 'messages'>`

### Methods (beyond inherited)

| Method | Signature | Description |
|---|---|---|
| `create` | `(input: CreateMessageInput): Promise<Message>` | Zod-validated insert. Sets `isCustom: true`, `isFavorite: false`. |
| `updateMessage` | `(input: UpdateMessageInput): Promise<void>` | Zod-validated update. Auto-sets `updatedAt`. |
| `getAll` | `(filter?: MessageFilter): Promise<Message[]>` | Overrides base: supports filtering by category, `isCustom`, `active`, `searchTerm`, `tags`. |
| `getActiveCustomMessages` | `(): Promise<Message[]>` | Shortcut: `getAll({ isCustom: true, active: true })` |
| `exportMessages` | `(): Promise<CustomMessagesExport>` | Export all custom messages as JSON with version and metadata |
| `importMessages` | `(exportData: CustomMessagesExport): Promise<{ imported, skipped }>` | Import with Zod validation and duplicate detection (case-insensitive text match) |

---

## 9.7 MoodService (IndexedDB)

**Module:** `src/services/moodService.ts`
**Singleton export:** `moodService`
**Extends:** `BaseIndexedDBService<MoodEntry, MyLoveDBSchema, 'moods'>`

### Methods (beyond inherited)

| Method | Signature | Description |
|---|---|---|
| `create` | `(userId: string, moods: MoodEntry['mood'][], note?: string): Promise<MoodEntry>` | Creates mood entry with Zod validation. Sets `synced: false`. First mood in array is primary. |
| `updateMood` | `(id: number, moods: MoodEntry['mood'][], note?: string): Promise<MoodEntry>` | Update mood and note. Resets `synced: false`. Zod-validated. |
| `getMoodForDate` | `(date: Date): Promise<MoodEntry \| null>` | Lookup via `by-date` unique index. One mood per day constraint. |
| `getMoodsInRange` | `(start: Date, end: Date): Promise<MoodEntry[]>` | Range query via `IDBKeyRange.bound` on `by-date` index. |
| `getUnsyncedMoods` | `(): Promise<MoodEntry[]>` | Filter `getAll()` where `synced === false`. |
| `markAsSynced` | `(id: number, supabaseId: string): Promise<void>` | Set `synced: true` and `supabaseId`. |

---

## 9.8 ScriptureReadingService

**Module:** `src/services/scriptureReadingService.ts`
**Singleton export:** `scriptureReadingService`
**Extends:** `BaseIndexedDBService<ScriptureSession, MyLoveDBSchema, 'scripture-sessions'>`

Implements a **cache-first read, write-through** pattern for scripture reading sessions with four sub-entities: sessions, reflections, bookmarks, and messages.

### Error Handling

```typescript
enum ScriptureErrorCode {
  VERSION_MISMATCH, SESSION_NOT_FOUND, UNAUTHORIZED,
  SYNC_FAILED, OFFLINE, CACHE_CORRUPTED, VALIDATION_FAILED
}
```

### Session Methods

| Method | Signature | Description |
|---|---|---|
| `createSession` | `(mode, partnerId?): Promise<ScriptureSession>` | RPC `scripture_create_session`. Caches locally. |
| `getSession` | `(sessionId, onRefresh?): Promise<ScriptureSession \| null>` | Cache-first. Background refresh with optional callback. |
| `getUserSessions` | `(userId): Promise<ScriptureSession[]>` | Cache-first by `by-user` index. |
| `updateSession` | `(sessionId, updates): Promise<void>` | Write-through: server first, then cache. |

### Reflection Methods

| Method | Signature | Description |
|---|---|---|
| `addReflection` | `(sessionId, stepIndex, rating, notes, isShared): Promise<ScriptureReflection>` | RPC `scripture_submit_reflection`. Caches locally. |
| `getReflectionsBySession` | `(sessionId): Promise<ScriptureReflection[]>` | Cache-first with background refresh. |

### Bookmark Methods

| Method | Signature | Description |
|---|---|---|
| `addBookmark` | `(sessionId, stepIndex, userId, shareWithPartner): Promise<ScriptureBookmark>` | Insert to `scripture_bookmarks`. Caches locally. |
| `toggleBookmark` | `(sessionId, stepIndex, userId, shareWithPartner): Promise<{ added, bookmark }>` | Delete if exists, create if not. |
| `getBookmarksBySession` | `(sessionId): Promise<ScriptureBookmark[]>` | Cache-first with background refresh. |

### Message Methods

| Method | Signature | Description |
|---|---|---|
| `addMessage` | `(sessionId, senderId, message): Promise<ScriptureMessage>` | Insert to `scripture_messages`. Caches locally. |
| `getMessagesBySession` | `(sessionId): Promise<ScriptureMessage[]>` | Cache-first with background refresh. |

### Cache Recovery

| Method | Description |
|---|---|
| `recoverSessionCache()` | Clear all session cache |
| `recoverReflectionCache(sessionId?)` | Clear reflection cache (optionally scoped to session) |
| `recoverBookmarkCache(sessionId?)` | Clear bookmark cache (optionally scoped to session) |
| `recoverMessageCache(sessionId?)` | Clear message cache (optionally scoped to session) |
| `recoverAllCaches()` | Clear all scripture caches |

---

## 9.9 LoveNoteImageService

**Module:** `src/services/loveNoteImageService.ts`

Functions (not a class) for love note image uploads and signed URL management.

### Functions

| Function | Signature | Description |
|---|---|---|
| `uploadLoveNoteImage` | `(file: File, _userId: string): Promise<UploadResult>` | Client-side validation + compression, then upload via Edge Function. Returns `{ storagePath, compressedSize }`. |
| `uploadCompressedBlob` | `(blob: Blob, _userId: string): Promise<UploadResult>` | Upload pre-compressed blob (retry flows). |
| `getSignedImageUrl` | `(storagePath: string, forceRefresh?: boolean): Promise<SignedUrlResult>` | Get signed URL with LRU cache and request deduplication. |
| `needsUrlRefresh` | `(storagePath: string): boolean` | Check if cached URL needs refresh. |
| `clearSignedUrlCache` | `(): void` | Clear the in-memory signed URL cache. |
| `batchGetSignedUrls` | `(storagePaths: string[]): Promise<Map<string, SignedUrlResult \| null>>` | Batch fetch with cache optimization and parallel requests. |
| `deleteLoveNoteImage` | `(storagePath: string): Promise<void>` | Remove image from storage bucket. |

**Caching strategy:**
- In-memory `Map<string, CachedUrl>` with LRU eviction
- Configurable max cache size and refresh buffer
- Request deduplication via `pendingRequests` map

---

## 9.10 ImageCompressionService

**Module:** `src/services/imageCompressionService.ts`
**Singleton export:** `imageCompressionService`

Client-side image compression using Canvas API. No external dependencies.

### Methods

| Method | Signature | Description |
|---|---|---|
| `compressImage` | `(file: File, options?: Partial<CompressionOptions>): Promise<CompressionResult>` | Resize to max 2048px, convert to JPEG at 80% quality. Strips EXIF. Fallback returns original on Canvas failure. |
| `validateImageFile` | `(file: File): { valid, error?, warning? }` | Check MIME type (JPEG/PNG/WebP) and size (max 25MB). Warning for files > threshold. |
| `estimateCompressedSize` | `(file: File): number` | Returns `file.size * 0.1` (10% estimate). |

**Defaults:**
- Max dimensions: 2048 x 2048
- JPEG quality: 0.8
- Typical compression: ~90% reduction (3-5MB to 300-500KB)
- Performance target: < 3 seconds for 10MB input

---

## 9.11 SyncService

**Module:** `src/services/syncService.ts`
**Singleton export:** `syncService` (instance of `SyncService`)

### Types

```typescript
interface MoodSyncResult {
  localId: number;
  success: boolean;
  supabaseId?: string;
  error?: string;
}

interface SyncSummary {
  total: number;
  successful: number;
  failed: number;
  results: MoodSyncResult[];
}
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `syncPendingMoods` | `(): Promise<SyncSummary>` | Fetch unsynced moods from IndexedDB, upload each via `moodApi.create()`, mark as synced. Partial failure: continues on individual errors. |
| `hasPendingSync` | `(): Promise<boolean>` | Check if any unsynced moods exist. |
| `getPendingCount` | `(): Promise<number>` | Count of unsynced moods. |

---

## 9.12 PerformanceMonitor

**Module:** `src/services/performanceMonitor.ts`
**Singleton export:** `performanceMonitor`

### Methods

| Method | Signature | Description |
|---|---|---|
| `measureAsync` | `<T>(name: string, operation: () => Promise<T>): Promise<T>` | Wrap an async operation with timing. Records metric on success. |
| `recordMetric` | `(name: string, duration: number): void` | Manually record a metric value. Maintains min/max/avg/count/total. |
| `getMetrics` | `(name: string): PerformanceMetric \| undefined` | Get metrics for a specific operation. |
| `getAllMetrics` | `(): Map<string, PerformanceMetric>` | Get all recorded metrics. |
| `clear` | `(): void` | Reset all metrics. |
| `getReport` | `(): string` | Human-readable report sorted by total duration descending. |

---
