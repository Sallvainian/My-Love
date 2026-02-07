# Service Layer

> Business logic and data services for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

---

## 1. Overview

14 services organized in `src/services/`, with 12 custom hooks in `src/hooks/` bridging services to React components. The architecture follows three patterns:

- **BaseIndexedDBService** -- Abstract generic class providing CRUD operations for IndexedDB stores. Domain services extend it and add validation, filtering, and domain logic.
- **Standalone services** -- Classes or modules that interact with Supabase Storage, Supabase Realtime, Canvas API, or Edge Functions without needing IndexedDB inheritance.
- **Three-layer data architecture** -- IndexedDB (offline-first local storage) -> Sync Services (periodic and background) -> Supabase (cloud source of truth).

All services are exported as singletons. Zod validation is applied at service boundaries. Read operations degrade gracefully (return null or empty arrays); write operations throw on failure.

---

## 2. Service Catalog

| Service | Type | File | Dependencies | Purpose |
|---------|------|------|--------------|---------|
| BaseIndexedDBService | Abstract class | `BaseIndexedDBService.ts` | idb | Generic CRUD for IndexedDB stores |
| dbSchema | Schema module | `dbSchema.ts` | idb | Centralized DB schema, migration, constants |
| StorageService | Legacy class | `storage.ts` | idb, dbSchema | Direct IDB access for photos and messages |
| CustomMessageService | Extends Base | `customMessageService.ts` | BaseIndexedDBService, dbSchema, Zod | Custom message CRUD with validation |
| MoodService | Extends Base | `moodService.ts` | BaseIndexedDBService, dbSchema, Zod | Mood entry CRUD with date indexing |
| PhotoStorageService | Extends Base | `photoStorageService.ts` | BaseIndexedDBService, dbSchema, Zod, PerformanceMonitor | Local photo storage with quota tracking |
| ScriptureReadingService | Extends Base | `scriptureReadingService.ts` | BaseIndexedDBService, dbSchema, Supabase, Zod | Cache-first scripture sessions, reflections, bookmarks, messages |
| PhotoService | Standalone class | `photoService.ts` | Supabase Storage, Supabase DB | Cloud photo upload, signed URLs, quota |
| ImageCompressionService | Standalone class | `imageCompressionService.ts` | Canvas API, config/images | Client-side image compression |
| LoveNoteImageService | Standalone module | `loveNoteImageService.ts` | ImageCompressionService, Supabase Storage, Edge Function | Love note image upload with LRU URL cache |
| RealtimeService | Standalone class | `realtimeService.ts` | Supabase Realtime | Postgres Changes subscriptions for mood updates |
| SyncService | Standalone class | `syncService.ts` | MoodService, moodApi | Offline-to-cloud mood sync with partial failure handling |
| MigrationService | Standalone module | `migrationService.ts` | CustomMessageService, Zod | One-time LocalStorage-to-IndexedDB migration |
| PerformanceMonitor | Standalone class | `performanceMonitor.ts` | Web Performance API | Operation timing and metrics reporting |

---

## 3. BaseIndexedDBService (Generic CRUD)

**File:** `src/services/BaseIndexedDBService.ts`

### Type Parameters

```
BaseIndexedDBService<T, DBTypes, StoreName>
  T          -- Entity type with optional id field (e.g., Message, Photo, MoodEntry)
  DBTypes    -- Database schema type extending DBSchema
  StoreName  -- Literal store name for type-safe store access
```

### Abstract Methods (services must implement)

| Method | Returns | Purpose |
|--------|---------|---------|
| `getStoreName()` | `StoreName` | Returns the object store name for this service |
| `_doInit()` | `Promise<void>` | DB-specific initialization and schema upgrade logic |

### Shared Methods (inherited by all services)

| Method | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `init()` | `()` | `Promise<void>` | Initialization guard preventing concurrent DB setup |
| `add(item)` | `(Omit<T, 'id'>)` | `Promise<T>` | Protected; services expose `create()` with validation |
| `get(id)` | `(number \| string)` | `Promise<T \| null>` | Returns null on failure |
| `getAll()` | `()` | `Promise<T[]>` | Returns empty array on failure |
| `update(id, updates)` | `(number \| string, Partial<T>)` | `Promise<void>` | Throws on failure |
| `delete(id)` | `(number \| string)` | `Promise<void>` | Throws on failure |
| `clear()` | `()` | `Promise<void>` | Clears entire store; throws on failure |
| `getPage(offset, limit)` | `(number, number)` | `Promise<T[]>` | Cursor-based pagination; returns empty on failure |

### Error Strategy

| Operation Type | On Failure | Rationale |
|----------------|------------|-----------|
| Reads (get, getAll, getPage) | Return `null` or `[]` | Graceful degradation; app continues with empty state |
| Writes (add, update, delete, clear) | Throw | Data integrity; mutations must succeed or fail explicitly |

---

## 4. Database Schema Service (dbSchema.ts)

**File:** `src/services/dbSchema.ts`

### Constants

```typescript
DB_NAME    = 'my-love-db'
DB_VERSION = 5

STORE_NAMES = {
  MESSAGES:              'messages',
  PHOTOS:                'photos',
  MOODS:                 'moods',
  SW_AUTH:               'sw-auth',
  SCRIPTURE_SESSIONS:    'scripture-sessions',
  SCRIPTURE_REFLECTIONS: 'scripture-reflections',
  SCRIPTURE_BOOKMARKS:   'scripture-bookmarks',
  SCRIPTURE_MESSAGES:    'scripture-messages',
}
```

### 8 Object Stores

| Store | Key | keyPath | autoIncrement | Indexes |
|-------|-----|---------|---------------|---------|
| messages | number | `id` | Yes | `by-category` (category), `by-date` (createdAt) |
| photos | number | `id` | Yes | `by-date` (uploadDate) |
| moods | number | `id` | Yes | `by-date` (date, **unique**) |
| sw-auth | `'current'` | `id` | No | None |
| scripture-sessions | string (UUID) | `id` | No | `by-user` (userId) |
| scripture-reflections | string (UUID) | `id` | No | `by-session` (sessionId) |
| scripture-bookmarks | string (UUID) | `id` | No | `by-session` (sessionId) |
| scripture-messages | string (UUID) | `id` | No | `by-session` (sessionId) |

### upgradeDb() Migration Function

Centralized migration handler called by all services. Processes upgrades incrementally:

| Transition | Changes |
|------------|---------|
| v0 -> v1 | Create `messages` store with `by-category` and `by-date` indexes |
| v1 -> v2 | Delete old `photos` store, create enhanced `photos` store with `by-date` index |
| v2 -> v3 | Create `moods` store with unique `by-date` index |
| v3 -> v4 | Create `sw-auth` store for Background Sync token storage |
| v4 -> v5 | Create four scripture stores (sessions, reflections, bookmarks, messages) with indexes |

---

## 5. Storage Service (storage.ts)

**File:** `src/services/storage.ts`

Legacy direct IndexedDB access service predating the BaseIndexedDBService pattern. Exported as a singleton (`storageService`).

### Photo CRUD

| Method | Returns | Notes |
|--------|---------|-------|
| `addPhoto(photo)` | `Promise<number>` | Returns auto-generated ID |
| `getPhoto(id)` | `Promise<Photo \| undefined>` | Returns undefined on failure |
| `getAllPhotos()` | `Promise<Photo[]>` | Empty array on failure |
| `updatePhoto(id, updates)` | `Promise<void>` | Merge update |
| `deletePhoto(id)` | `Promise<void>` | |

### Message CRUD

| Method | Returns | Notes |
|--------|---------|-------|
| `addMessage(message)` | `Promise<number>` | |
| `getMessage(id)` | `Promise<Message \| undefined>` | |
| `getAllMessages()` | `Promise<Message[]>` | |
| `getMessagesByCategory(category)` | `Promise<Message[]>` | Uses `by-category` index |
| `updateMessage(id, updates)` | `Promise<void>` | |
| `deleteMessage(id)` | `Promise<void>` | |
| `toggleFavorite(messageId)` | `Promise<void>` | Flips `isFavorite` boolean |
| `addMessages(messages)` | `Promise<void>` | Bulk insert via transaction |

### Utility Methods

| Method | Returns | Notes |
|--------|---------|-------|
| `clearAllData()` | `Promise<void>` | Clears photos and messages stores |
| `exportData()` | `Promise<{ photos, messages }>` | Backup export |

### localStorageHelper

Module-level utility for settings and small data:

| Method | Signature |
|--------|-----------|
| `get<T>(key, defaultValue)` | Returns parsed JSON or default |
| `set<T>(key, value)` | JSON.stringify and store |
| `remove(key)` | Remove single key |
| `clear()` | Clear all localStorage |

---

## 6. Custom Message Service

**File:** `src/services/customMessageService.ts` | **Store:** messages | **Extends:** BaseIndexedDBService

### Methods

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `create()` | `CreateMessageInput` | `Promise<Message>` | Zod validation (1-500 chars); sets `isCustom: true` |
| `getAll()` | `MessageFilter?` | `Promise<Message[]>` | Filter by category, isCustom, active, searchTerm, tags |
| `updateMessage()` | `UpdateMessageInput` | `Promise<void>` | Zod validation; auto-sets `updatedAt` |
| `getActiveCustomMessages()` | -- | `Promise<Message[]>` | Shorthand for `getAll({ isCustom: true, active: true })` |
| `exportMessages()` | -- | `Promise<CustomMessagesExport>` | JSON export with `version: '1.0'` |
| `importMessages()` | `CustomMessagesExport` | `Promise<{ imported, skipped }>` | Zod-validated; deduplicates by case-insensitive text |

Inherited from base: `get(id)`, `delete(id)`, `clear()`, `getPage(offset, limit)`.

### Validation Schemas

- **CreateMessageInputSchema** -- text (1-500 chars), category, optional active and tags
- **UpdateMessageInputSchema** -- id required, all other fields optional
- **CustomMessagesExportSchema** -- validates import data structure

---

## 7. Mood Service

**File:** `src/services/moodService.ts` | **Store:** moods | **Extends:** BaseIndexedDBService

### Methods

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `create()` | `userId, moods[], note?` | `Promise<MoodEntry>` | Zod validation; sets `synced: false`; first mood is primary |
| `updateMood()` | `id, moods[], note?` | `Promise<MoodEntry>` | Zod validation; resets `synced: false` on update |
| `getMoodForDate()` | `date: Date` | `Promise<MoodEntry \| null>` | Uses unique `by-date` index (one mood per day) |
| `getMoodsInRange()` | `start: Date, end: Date` | `Promise<MoodEntry[]>` | IDBKeyRange bound query on `by-date` index |
| `getUnsyncedMoods()` | -- | `Promise<MoodEntry[]>` | Filters `getAll()` where `synced === false` |
| `markAsSynced()` | `id: number, supabaseId: string` | `Promise<void>` | Sets `synced: true` and stores Supabase record ID |

### Sync Lifecycle Fields

Each MoodEntry carries `synced: boolean` and `supabaseId?: string` to track its sync state between IndexedDB and Supabase.

---

## 8. Photo Service (Supabase Storage)

**File:** `src/services/photoService.ts` | **Bucket:** `photos` (private)

### Methods

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getSignedUrl()` | `storagePath, expiresIn?` | `Promise<string \| null>` | Default expiry: 1 hour (3600s) |
| `getSignedUrls()` | `storagePaths[]` | `Promise<Map<path, url>>` | Parallel generation via `Promise.allSettled` |
| `checkStorageQuota()` | -- | `Promise<StorageQuota>` | Calculates from photos table; returns warning level |
| `getPhotos()` | `limit?, offset?` | `Promise<PhotoWithUrls[]>` | Newest first; generates signed URLs; RLS-filtered |
| `uploadPhoto()` | `input, onProgress?` | `Promise<SupabasePhoto \| null>` | Check quota -> upload to Storage -> create metadata -> rollback on failure |
| `deletePhoto()` | `photoId` | `Promise<boolean>` | Verifies ownership; deletes from Storage then DB |
| `getPhoto()` | `photoId` | `Promise<PhotoWithUrls \| null>` | Single photo with signed URL |
| `updatePhoto()` | `photoId, updates` | `Promise<boolean>` | Only caption is mutable |

### Storage Quota

| Threshold | Value | Warning Level |
|-----------|-------|---------------|
| Free tier | 1 GB | -- |
| Approaching | 80% | `'approaching'` |
| Critical | 95% | `'critical'` |
| Exceeded | 100% | `'exceeded'` (upload rejected) |

---

## 9. Photo Storage Service (Local IndexedDB)

**File:** `src/services/photoStorageService.ts` | **Store:** photos | **Extends:** BaseIndexedDBService

Local offline photo cache. Overrides base methods for date-sorted retrieval.

### Methods

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `create()` | `Omit<Photo, 'id'>` | `Promise<Photo>` | Zod validation; records performance metrics |
| `getAll()` | -- | `Promise<Photo[]>` | Overrides base; uses `by-date` index, newest first |
| `getPage()` | `offset?, limit?` | `Promise<Photo[]>` | Overrides base; descending cursor on `by-date` index |
| `update()` | `id, updates` | `Promise<void>` | Overrides base; adds Zod partial validation |
| `getStorageSize()` | -- | `Promise<number>` | Sum of `compressedSize` across all photos (bytes) |
| `estimateQuotaRemaining()` | -- | `Promise<{ used, quota, remaining, percentUsed }>` | Storage API with 50MB Safari fallback |

### Quota Thresholds

- Warning at 80%, error at 95% (matching config `STORAGE_QUOTAS`)
- Default quota fallback: 50MB (`STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES`)

### v1 -> v2 Migration

Handles the historical `blob` -> `imageBlob` field rename with data preservation. Requires transaction access, so migration logic lives here rather than in the centralized `upgradeDb()`.

---

## 10. Scripture Reading Service

**File:** `src/services/scriptureReadingService.ts` (largest service, ~26KB)
**Store:** scripture-sessions | **Extends:** BaseIndexedDBService
**Additional stores accessed directly:** scripture-reflections, scripture-bookmarks, scripture-messages

### Error Enum

```typescript
enum ScriptureErrorCode {
  VERSION_MISMATCH   // Stale session version
  SESSION_NOT_FOUND  // Session does not exist
  UNAUTHORIZED       // Access denied
  SYNC_FAILED        // Server write failed
  OFFLINE            // Device has no connectivity
  CACHE_CORRUPTED    // IndexedDB data unreadable
  VALIDATION_FAILED  // Zod schema rejection
}
```

### Cache Pattern

| Operation | Strategy |
|-----------|----------|
| **READ** | IndexedDB cache -> return cached -> fire-and-forget background refresh from Supabase -> update cache |
| **WRITE** | Supabase RPC/REST -> on success -> update IndexedDB cache -> on failure -> throw ScriptureError |
| **CORRUPTION** | Clear affected cache store -> refetch from server |

### Session CRUD

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `createSession()` | `mode, partnerId?` | `Promise<ScriptureSession>` | Via `scripture_create_session` RPC |
| `getSession()` | `sessionId, onRefresh?` | `Promise<ScriptureSession \| null>` | Cache-first; optional refresh callback for Zustand sync |
| `getUserSessions()` | `userId` | `Promise<ScriptureSession[]>` | Uses `by-user` index; background refresh |
| `updateSession()` | `sessionId, updates` | `Promise<void>` | Write-through; camelCase -> snake_case conversion |

### Reflection CRUD

| Method | Parameters | Returns |
|--------|-----------|---------|
| `addReflection()` | `sessionId, stepIndex, rating, notes, isShared` | `Promise<ScriptureReflection>` |
| `getReflectionsBySession()` | `sessionId` | `Promise<ScriptureReflection[]>` |

### Bookmark CRUD

| Method | Parameters | Returns |
|--------|-----------|---------|
| `addBookmark()` | `sessionId, stepIndex, userId, shareWithPartner` | `Promise<ScriptureBookmark>` |
| `toggleBookmark()` | `sessionId, stepIndex, userId, shareWithPartner` | `Promise<{ added, bookmark }>` |
| `getBookmarksBySession()` | `sessionId` | `Promise<ScriptureBookmark[]>` |

### Message CRUD

| Method | Parameters | Returns |
|--------|-----------|---------|
| `addMessage()` | `sessionId, senderId, message` | `Promise<ScriptureMessage>` |
| `getMessagesBySession()` | `sessionId` | `Promise<ScriptureMessage[]>` |

### Transform Functions (Supabase -> IndexedDB)

- `toLocalSession(row, userId)` -- Maps snake_case Supabase row to camelCase ScriptureSession
- `toLocalReflection(row)` -- Maps SupabaseReflection to ScriptureReflection
- `toLocalBookmark(row)` -- Maps SupabaseBookmark to ScriptureBookmark
- `toLocalMessage(row)` -- Maps SupabaseMessage to ScriptureMessage

### Cache Recovery

| Method | Scope |
|--------|-------|
| `recoverSessionCache()` | Clears all session cache |
| `recoverReflectionCache(sessionId?)` | Clears reflections for one session or all |
| `recoverBookmarkCache(sessionId?)` | Clears bookmarks for one session or all |
| `recoverMessageCache(sessionId?)` | Clears messages for one session or all |
| `recoverAllCaches()` | Calls all four recovery methods |

---

## 11. Image Compression Service

**File:** `src/services/imageCompressionService.ts`

Client-side image compression using the Canvas API. No external dependencies.

### Methods

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `compressImage()` | `file: File, options?` | `Promise<CompressionResult>` | Max 2048px, JPEG 80% quality; ~90% size reduction |
| `validateImageFile()` | `file: File` | `{ valid, error?, warning? }` | 25MB max, types: jpeg/png/webp; 10MB warning |
| `estimateCompressedSize()` | `file: File` | `number` | Conservative estimate: 10% of original size |

### Compression Defaults

| Setting | Value |
|---------|-------|
| Max width | 2048px |
| Max height | 2048px |
| JPEG quality | 0.8 (80%) |
| Typical reduction | ~90% (3-5MB -> 300-500KB) |
| Performance target | Less than 3s for 10MB input |

### Behavior

- Maintains aspect ratio during resize
- Strips EXIF metadata automatically via Canvas redraw
- Falls back to original file on compression failure (sets `fallbackUsed: true`)

---

## 12. Love Note Image Service

**File:** `src/services/loveNoteImageService.ts`

Handles image uploads for love notes chat messages via Edge Function with server-side validation.

### Exported Functions

| Function | Parameters | Returns | Notes |
|----------|-----------|---------|-------|
| `uploadLoveNoteImage()` | `file, userId` | `Promise<UploadResult>` | Client compress -> Edge Function validate -> Storage upload |
| `uploadCompressedBlob()` | `blob, userId` | `Promise<UploadResult>` | Skips re-compression for retry flows |
| `getSignedImageUrl()` | `storagePath, forceRefresh?` | `Promise<SignedUrlResult>` | LRU-cached with request deduplication |
| `batchGetSignedUrls()` | `storagePaths[]` | `Promise<Map<path, result>>` | Parallel fetch with cache optimization |
| `deleteLoveNoteImage()` | `storagePath` | `Promise<void>` | |
| `needsUrlRefresh()` | `storagePath` | `boolean` | Check if cached URL is expired or about to expire |
| `clearSignedUrlCache()` | -- | `void` | Call on logout for cleanup |

### Upload Flow

1. Client-side validation (`imageCompressionService.validateImageFile`)
2. Client-side compression (`imageCompressionService.compressImage`)
3. Auth token retrieval from Supabase session
4. Upload to Edge Function via `POST` with `application/octet-stream` body
5. Edge Function validates MIME (magic bytes), enforces rate limit, uploads to Storage
6. Returns `{ storagePath, compressedSize }`

### URL Cache

| Setting | Value |
|---------|-------|
| Max cache size | 100 entries (LRU eviction) |
| URL expiry | 3600s (1 hour) |
| Refresh buffer | 5 minutes before expiry |
| Deduplication | Pending request map prevents duplicate API calls |

### Storage Path Format

```
love-note-images/{userId}/{timestamp}-{uuid}.jpg
```

---

## 13. Realtime Service

**File:** `src/services/realtimeService.ts`

Manages Supabase Realtime subscriptions for live data updates.

### Methods

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `subscribeMoodChanges()` | `userId, onMoodChange, onError?` | `string` (channelId) | Channel: `moods:{userId}`, events: INSERT/UPDATE/DELETE |
| `unsubscribe()` | `channelId` | `Promise<void>` | Remove specific channel |
| `unsubscribeAll()` | -- | `Promise<void>` | Remove all channels |
| `setErrorHandler()` | `callback` | `void` | Global error handler for all subscriptions |
| `getActiveSubscriptions()` | -- | `number` | Count of active channels |

### Subscription Details

- **Channel pattern:** `moods:{userId}`
- **Event type:** `postgres_changes` (all events: INSERT, UPDATE, DELETE)
- **Table filter:** `user_id=eq.{userId}`
- **Deduplication:** Prevents duplicate subscriptions via internal Map

---

## 14. Sync Service

**File:** `src/services/syncService.ts`

Synchronizes offline mood entries from IndexedDB to Supabase.

### Methods

| Method | Returns | Notes |
|--------|---------|-------|
| `syncPendingMoods()` | `Promise<SyncSummary>` | Syncs all unsynced moods with partial failure handling |
| `hasPendingSync()` | `Promise<boolean>` | Quick check for unsynced entries |
| `getPendingCount()` | `Promise<number>` | Count of unsynced moods |

### Internal Methods

| Method | Purpose |
|--------|---------|
| `transformMoodForSupabase(mood)` | Converts IndexedDB MoodEntry to Supabase MoodInsert (camelCase -> snake_case) |
| `syncSingleMood(mood)` | Upload one mood -> mark as synced -> return result |

### SyncSummary

```typescript
interface SyncSummary {
  total: number;       // Total moods attempted
  successful: number;  // Successfully synced
  failed: number;      // Failed to sync
  results: MoodSyncResult[];  // Per-mood detail with localId, success, supabaseId, error
}
```

### Sync Flow

1. Get unsynced moods from IndexedDB via `moodService.getUnsyncedMoods()`
2. Transform each to Supabase format
3. Upload each via `moodApi.create()`
4. Mark successfully synced moods via `moodService.markAsSynced()`
5. Continue on individual failures (partial failure handling)
6. Return detailed SyncSummary

---

## 15. Migration Service

**File:** `src/services/migrationService.ts`

One-time migration from LocalStorage to IndexedDB for custom messages.

### Function

```typescript
migrateCustomMessagesFromLocalStorage(): Promise<MigrationResult>
```

### Migration Flow

1. Check for `my-love-custom-messages` key in LocalStorage
2. Parse JSON data and validate as array
3. Get existing IDB messages for deduplication (case-insensitive text comparison)
4. Validate each message with `CreateMessageInputSchema` (Zod)
5. Create in IndexedDB via `customMessageService.create()`
6. Remove LocalStorage data after successful migration

### MigrationResult

```typescript
interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}
```

### DB Version History

| Version | Changes |
|---------|---------|
| v1 -> v2 | Photos schema: `blob` -> enhanced metadata with `imageBlob`, compression fields |
| v2 -> v3 | Moods store introduced with `by-date` unique index |
| v3 -> v4 | `sw-auth` store for Background Sync service worker token storage |
| v4 -> v5 | Four scripture stores (sessions, reflections, bookmarks, messages) |

---

## 16. Performance Monitor

**File:** `src/services/performanceMonitor.ts`

Lightweight timing and metrics service using the Web Performance API.

### Methods

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `measureAsync()` | `name, operation` | `Promise<T>` | Wraps async operation with `performance.now()` timing |
| `recordMetric()` | `name, duration` | `void` | Record a custom numeric metric |
| `getMetrics()` | `name` | `PerformanceMetric \| undefined` | Get metrics for specific operation |
| `getAllMetrics()` | -- | `Map<string, PerformanceMetric>` | All recorded metrics |
| `clear()` | -- | `void` | Reset all metrics |
| `getReport()` | -- | `string` | Human-readable report sorted by total duration |

### PerformanceMetric Fields

```typescript
interface PerformanceMetric {
  name: string;
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  lastRecorded: number;
}
```

### Tracked Operations

- `photo-create`, `photo-getAll`, `photo-getPage` -- PhotoStorageService operations
- `photo-size-kb` -- Compressed photo size recording
- Additional operations can be wrapped with `measureAsync()` by any service

---

## 17. Custom Hooks (12 hooks bridging services to components)

**Directory:** `src/hooks/`

| Hook | Returns | Dependencies | Purpose |
|------|---------|--------------|---------|
| `useAuth` | `{ user, isLoading, error }` | Supabase Auth | Current authenticated user with auth state change listener |
| `usePhotos` | `{ photos, isUploading, uploadProgress, error, storageWarning, uploadPhoto, loadPhotos, deletePhoto, clearError, clearStorageWarning }` | useAppStore (Zustand) | Photo CRUD with upload progress and quota warnings |
| `useLoveNotes` | `{ notes, isLoading, error, hasMore, fetchNotes, fetchOlderNotes, clearError, sendNote, retryFailedMessage, removeFailedMessage }` | useAppStore, useRealtimeMessages | Love notes chat with pagination and real-time subscription |
| `useMoodHistory` | `{ moods, isLoading, hasMore, loadMore, error }` | moodApi | Paginated mood history (page size: 50) with infinite scroll |
| `useAutoSave` | `void` | ScriptureSession | Auto-saves session on `visibilitychange` (hidden) and `beforeunload` |
| `useNetworkStatus` | `{ isOnline, isConnecting }` | Browser Events | Network detection with 1500ms connecting debounce |
| `useRealtimeMessages` | `{}` | Supabase Broadcast, useAppStore | Real-time love note reception via Broadcast API with exponential backoff retry (max 5 retries, 1s-30s delay) |
| `useVibration` | `{ vibrate, isSupported }` | Vibration API | Haptic feedback with feature detection and graceful degradation |
| `useImageCompression` | `{ compress, result, isCompressing, error, status, reset }` | ImageCompressionService | React state wrapper: idle -> compressing -> complete/error |
| `useMotionConfig` | `{ shouldReduceMotion, crossfade, slide, spring, fadeIn, modeReveal }` | Framer Motion `useReducedMotion` | Centralized animation presets that respect reduced motion preferences |
| `usePartnerMood` | `{ partnerMood, isLoading, connectionStatus, error }` | moodSyncService, Supabase Broadcast | Partner mood with real-time updates and connection status tracking |

### Barrel Export (`src/hooks/index.ts`)

The barrel file re-exports a subset of hooks for convenient imports:

- `useNetworkStatus`
- `useAutoSave`
- `useLoveNotes`
- `useVibration`
- `useMotionConfig`

Other hooks (`useAuth`, `usePhotos`, `useMoodHistory`, `useRealtimeMessages`, `useImageCompression`, `usePartnerMood`) are imported directly from their files.

---

## 18. Dependency Graph

```
Stores (IndexedDB)                  Services                    External
====================               ==================          =================

messages ─────────────> CustomMessageService
                            │
                            └──> MigrationService ──────────> localStorage

photos ───────────────> PhotoStorageService
                            │
                            └──> PerformanceMonitor ────────> Web Performance API

                        PhotoService ───────────────────────> Supabase Storage
                            │                                 Supabase DB (photos)
                            └──> checkStorageQuota()

moods ────────────────> MoodService
                            │
                            ├──> SyncService ───────────────> moodApi ──> Supabase DB (moods)
                            │
                            └──> RealtimeService ───────────> Supabase Realtime

sw-auth ──────────────> Service Worker (sw.ts) ─────────────> Supabase REST API
                            │
                            └──> sw-db.ts (direct IDB access)

scripture-sessions ──┐
scripture-reflections ┤
scripture-bookmarks ──┼> ScriptureReadingService ───────────> Supabase RPC
scripture-messages ──┘                                        Supabase DB (scripture_*)

(no store) ───────────> ImageCompressionService ────────────> Canvas API

(no store) ───────────> LoveNoteImageService
                            │
                            ├──> ImageCompressionService
                            └──> Edge Function ─────────────> Supabase Storage
                                                              (love-notes-images bucket)

Hooks (React)          Services Used
==================     ==================

useAuth ──────────────> Supabase Auth
usePhotos ────────────> useAppStore (photosSlice)
useLoveNotes ─────────> useAppStore (notesSlice) + useRealtimeMessages
useMoodHistory ───────> moodApi
useAutoSave ──────────> ScriptureSession (passed in)
useNetworkStatus ─────> Browser online/offline events
useRealtimeMessages ──> Supabase Broadcast API
useVibration ─────────> Navigator Vibration API
useImageCompression ──> ImageCompressionService
useMotionConfig ──────> Framer Motion useReducedMotion
usePartnerMood ───────> moodSyncService (Supabase Broadcast)
```
