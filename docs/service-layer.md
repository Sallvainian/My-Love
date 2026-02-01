# Service Layer

> Services, utilities, and data layer documentation for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Overview

14 services organized by responsibility. Core pattern: **BaseIndexedDBService** abstract class provides generic CRUD; domain services extend it. All services are singletons exported at module level. Zod validation at service boundaries. Three-layer sync strategy for offline-first operation.

## Service Architecture

```
BaseIndexedDBService<T> (abstract)
├── CustomMessageService (messages store)
├── MoodService (moods store)
├── PhotoStorageService (photos store)
└── ScriptureReadingService (scripture-sessions store)

Standalone Services
├── PhotoService (Supabase Storage)
├── SyncService (offline → online sync)
├── RealtimeService (Supabase Realtime)
├── ImageCompressionService (Canvas API)
├── LoveNoteImageService (Edge Function upload)
├── PerformanceMonitor (timing metrics)
└── MigrationService (LocalStorage → IndexedDB)
```

## BaseIndexedDBService

**File**: `src/services/baseIndexedDBService.ts`
**Generic**: `<T, Schema extends DBSchema, StoreName extends StoreNames<Schema>>`

| Method | Returns | Notes |
|--------|---------|-------|
| `init()` | `Promise<void>` | Opens DB, stores reference |
| `add(item)` | `Promise<T>` | Create record |
| `get(id)` | `Promise<T \| null>` | By primary key |
| `getAll()` | `Promise<T[]>` | All records |
| `getPage(offset?, limit?)` | `Promise<T[]>` | Cursor-based pagination |
| `update(id, updates)` | `Promise<void>` | Partial update |
| `delete(id)` | `Promise<void>` | Delete by key |
| `clear()` | `Promise<void>` | Clear entire store |
| `count()` | `Promise<number>` | Record count |

**Error Strategy**: Reads return null/empty on failure; writes throw.

## Domain Services

### CustomMessageService

**File**: `src/services/customMessageService.ts` | **Store**: messages | **Extends**: BaseIndexedDBService

| Method | Parameters | Returns |
|--------|-----------|---------|
| `create()` | `input: CreateMessageInput` | `CustomMessage` |
| `updateMessage()` | `input: UpdateMessageInput` | `CustomMessage` |
| `getAllForRotation()` | — | `Message[]` (active only) |
| `exportMessages()` | — | `CustomMessagesExport` (JSON, version=1.0) |
| `importMessages()` | `exportData` | `{ imported, skipped }` (dedup by text) |

**Validation**: `CreateMessageInputSchema` (1-500 chars), `UpdateMessageInputSchema`

### MoodService

**File**: `src/services/moodService.ts` | **Store**: moods | **Extends**: BaseIndexedDBService

| Method | Parameters | Returns |
|--------|-----------|---------|
| `create()` | `userId, moods[], note?` | `MoodEntry` |
| `updateMood()` | `id, moods[], note?` | `MoodEntry` |
| `getMoodForDate()` | `date: Date` | `MoodEntry \| null` |
| `getMoodsInRange()` | `start, end` | `MoodEntry[]` |
| `getUnsyncedMoods()` | — | `MoodEntry[]` |
| `markAsSynced()` | `id, supabaseId` | `void` |

**Unique Index**: by-date (one mood per day). **Validation**: Zod schema on create/update.

### PhotoStorageService

**File**: `src/services/photoStorageService.ts` | **Store**: photos | **Extends**: BaseIndexedDBService

| Method | Parameters | Returns |
|--------|-----------|---------|
| `getPage()` | `offset?, limit?` | `Photo[]` (newest first, cursor-based) |
| `getStorageSize()` | — | `number` (bytes) |
| `estimateQuotaRemaining()` | — | `{ used, quota, remaining, percentUsed }` |

**Quota**: Storage API with 50MB Safari fallback. Warning 80%, error 95%.
**Migration**: v1→v2 blob→imageBlob rename with data preservation.

### ScriptureReadingService

**File**: `src/services/scriptureReadingService.ts` | **Store**: scripture-sessions | **Extends**: BaseIndexedDBService

**Pattern**: Cache-first read, write-through write.
- **READ**: IndexedDB → return → background refresh from Supabase → update cache
- **WRITE**: Supabase RPC → success → update IndexedDB → failure → throw

**Sessions**:

| Method | Parameters | Returns |
|--------|-----------|---------|
| `createSession()` | `mode, partnerId?` | `ScriptureSession` (via RPC) |
| `getSession()` | `sessionId, onRefresh?` | `ScriptureSession \| null` |
| `getUserSessions()` | `userId` | `ScriptureSession[]` |
| `updateSession()` | `sessionId, updates` | `void` |

**Reflections**: `addReflection()` (via RPC: upsert), `getReflectionsBySession()`
**Bookmarks**: `addBookmark()`, `toggleBookmark()` (delete-if-exists/create-if-not), `getBookmarksBySession()`
**Messages**: `addMessage()`, `getMessagesBySession()`

**Recovery**: `recoverSessionCache()`, `recoverReflectionCache()`, `recoverBookmarkCache()`, `recoverMessageCache()`, `recoverAllCaches()` — clear corrupted IndexedDB, refetch from server.

**Error Codes**: VERSION_MISMATCH, SESSION_NOT_FOUND, UNAUTHORIZED, SYNC_FAILED, OFFLINE, CACHE_CORRUPTED, VALIDATION_FAILED

## Supabase Services

### PhotoService

**File**: `src/services/photoService.ts` | **Bucket**: `photos` (private)

| Method | Parameters | Returns |
|--------|-----------|---------|
| `getSignedUrl()` | `storagePath, expiresIn?` | `string \| null` (1hr default) |
| `getSignedUrls()` | `storagePaths[]` | `Map<path, url>` (parallel) |
| `checkStorageQuota()` | — | `StorageQuota` |
| `getPhotos()` | `limit?, offset?` | `PhotoWithUrls[]` |
| `uploadPhoto()` | `input, onProgress?` | `SupabasePhoto \| null` |
| `deletePhoto()` | `photoId` | `boolean` |

**Upload**: Check quota → upload to Storage → create metadata → rollback on failure.
**Quota**: 1GB free tier. Warning 80%, critical 95%.

### SyncService

**File**: `src/services/syncService.ts`

| Method | Returns | Notes |
|--------|---------|-------|
| `syncPendingMoods()` | `SyncSummary` | Partial failure handling |
| `hasPendingSync()` | `boolean` | Quick check |
| `getPendingCount()` | `number` | Unsynced count |

**Flow**: Get unsynced → transform to Supabase format → upload each → mark synced → return summary.
**Partial Failure**: Continues on individual failures. Returns `{ total, successful, failed, results[] }`.

### RealtimeService

**File**: `src/services/realtimeService.ts`

| Method | Parameters | Returns |
|--------|-----------|---------|
| `subscribeMoodChanges()` | `userId, onMoodChange, onError?` | `channelId` |
| `unsubscribe()` | `channelId` | `void` |
| `unsubscribeAll()` | — | `void` |
| `getActiveSubscriptions()` | — | `number` |

**Channel**: `moods:{userId}`. **Events**: postgres_changes (INSERT/UPDATE/DELETE).
**Dedup**: Prevents duplicate subscriptions via Map.

## Image Services

### ImageCompressionService

**File**: `src/services/imageCompressionService.ts`

| Method | Parameters | Returns |
|--------|-----------|---------|
| `compressImage()` | `file, options?` | `CompressionResult` |
| `validateImageFile()` | `file` | `{ valid, error?, warning? }` |
| `estimateCompressedSize()` | `file` | `number` |

**Config**: Max 2048x2048, 80% JPEG quality. ~90% size reduction.
**Validation**: 25MB max, 10MB warning, types: jpeg/png/webp.
**EXIF**: Stripped automatically via Canvas API redraw. Fallback to original on failure.

### LoveNoteImageService

**File**: `src/services/loveNoteImageService.ts`

| Method | Parameters | Returns |
|--------|-----------|---------|
| `uploadLoveNoteImage()` | `file, userId` | `UploadResult` |
| `uploadCompressedBlob()` | `blob, userId` | `UploadResult` (skip re-compress on retry) |
| `getSignedImageUrl()` | `storagePath, forceRefresh?` | `SignedUrlResult` |
| `batchGetSignedUrls()` | `storagePaths[]` | `Map<path, result>` |
| `deleteLoveNoteImage()` | `storagePath` | `void` |

**Cache**: LRU (max 100), 5-min refresh buffer, request deduplication via pending map.
**Upload**: Client compress → Edge Function validate (magic bytes, rate limit) → Storage upload.

## Utility Services

### PerformanceMonitor

**File**: `src/services/performanceMonitor.ts`

`measureAsync(name, operation)` — wraps async ops with timing.
`getReport()` — sorted by total duration. Used in PhotoStorageService, etc.

### MigrationService

**File**: `src/services/migrationService.ts`

`migrateCustomMessagesFromLocalStorage()` — one-time LS→IDB migration. Dedup by case-insensitive text. Removes LS data after success.

### Background Sync

**File**: `src/utils/backgroundSync.ts`

| Function | Returns | Notes |
|----------|---------|-------|
| `registerBackgroundSync(tag)` | `void` | Register SW sync event |
| `setupServiceWorkerListener(callback)` | `() => void` | Listen for completion |
| `isBackgroundSyncSupported()` | `boolean` | Feature check |

**Tag**: `sync-pending-moods`. **Protocol**: SW→App `BACKGROUND_SYNC_COMPLETED` message.

## Service Worker

**File**: `src/sw.ts`

**Workbox Strategies**:
- NetworkOnly: JS/CSS (fresh after deploy)
- NetworkFirst: HTML (3s timeout, offline fallback)
- CacheFirst: Images, fonts (30-day expiry), Google Fonts (1-year)

**Background Sync**:
1. Listen for `sync` event with `sync-pending-moods` tag
2. Open IndexedDB directly (no window context)
3. Get auth token from `sw-auth` store
4. Sync to Supabase REST API
5. Mark moods as synced
6. Notify app via `postMessage`

**SW DB** (`src/sw-db.ts`): `getPendingMoods()`, `getAuthToken()`, `markMoodSynced()`

## Configuration Constants

### Performance (`src/config/performance.ts`)

```typescript
PAGINATION: { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 }
STORAGE_QUOTAS: { WARNING: 80%, ERROR: 95%, DEFAULT: 50MB }
VALIDATION_LIMITS: { MESSAGE: 1000, CAPTION: 500, NOTE: 1000, NAME: 50 }
```

### Images (`src/config/images.ts`)

```typescript
IMAGE_COMPRESSION: { MAX_WIDTH: 2048, MAX_HEIGHT: 2048, QUALITY: 0.8 }
IMAGE_VALIDATION: { MAX_FILE_SIZE: 25MB, WARNING: 10MB, TYPES: jpeg/png/webp }
IMAGE_STORAGE: { BUCKET: 'love-notes-images', EXPIRY: 3600s, CACHE: 100 max }
NOTES_CONFIG: { PAGE_SIZE: 50, RATE_LIMIT: 10/min }
```

### App Constants (`src/config/constants.ts`)

```typescript
APP_CONFIG: { partnerName: 'Gracie', startDate: '2025-10-18', isPreConfigured: true }
USER_ID: 'default-user'
```

## Static Data

### Default Messages (`src/data/defaultMessages.ts`)
365 messages across 5 categories (73 each): reason, memory, affirmation, future, custom.

### Scripture Steps (`src/data/scriptureSteps.ts`)
17 steps, 6 themes: Healing & Restoration (0-2), Forgiveness & Reconciliation (3-5), Confession & Repentance (6-8), God's Faithfulness & Peace (9-11), Power of Words (12-14), Christlike Character (15-16). NKJV verses + couple-focused response prayers.

## Three-Layer Sync Architecture

### Layer 1: Immediate (App Online)
Create mood → `moodApi.create()` → mark synced on success.

### Layer 2: Periodic (App Open)
Every 30s → `syncService.syncPendingMoods()` → partial failure handling.

### Layer 3: Background (App Closed)
Service Worker → connectivity restoration → open IndexedDB → Supabase REST → mark synced → notify app.

**Auth**: Token stored in IndexedDB `sw-auth` store, validated with 5-min buffer.

## Error Handling Patterns

**Reads**: Graceful fallback (return null/empty)
**Writes**: Explicit failure (throw)
**Validation**: Zod parse → `createValidationError()` → user-friendly message
**Cache Corruption**: Clear store → refetch from server
**Sync Failures**: Continue on individual failures, return detailed summary

## Dependency Graph

```
SyncService → MoodService → MoodApi
ScriptureReadingService → Supabase RPC
LoveNoteImageService → ImageCompressionService → Edge Function
RealtimeService → Supabase Realtime
PhotoService → Supabase Storage
BackgroundSync → Service Worker ↔ IndexedDB (sw-db.ts)
```
