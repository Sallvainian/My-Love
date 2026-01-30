# Service Layer

> Services, hooks, and data layer documentation for My-Love project.
> Last updated: 2026-01-30 | Scan level: Deep (Rescan)

## Overview

15 service files providing business logic, IndexedDB CRUD, Supabase integration, image processing, and performance monitoring. 13 hooks for React state management. 2 data files with static content.

## Services

### scriptureReadingService.ts (NEW)

Scripture reading session management with offline-first IndexedDB caching and Supabase sync.

Key methods: `createSession`, `getSession`, `getUserSessions`, `updateSession`, `addReflection`, `getReflectionsBySession`, `addBookmark`, `toggleBookmark`, `getBookmarksBySession`, `addMessage`, `getMessagesBySession`, `recoverAllCaches`.

Pattern: Cache-first reads with background refresh. Server-first writes. Zod validation on all responses.

Error codes: `VERSION_MISMATCH`, `SESSION_NOT_FOUND`, `UNAUTHORIZED`, `SYNC_FAILED`, `OFFLINE`, `CACHE_CORRUPTED`, `VALIDATION_FAILED`.

### BaseIndexedDBService.ts

Generic CRUD base class for IndexedDB stores. Methods: `init`, `add`, `get`, `getAll`, `update`, `delete`, `clear`, `getPage` (cursor-based). Read ops return `null`/`[]`. Write ops throw. Lazy initialization guard.

### dbSchema.ts

Centralized IndexedDB schema (v5). Stores: `messages`, `photos`, `moods`, `sw-auth`, `scripture-sessions`/`reflections`/`bookmarks`/`messages`. Migration function handles v1-v5 upgrades.

### customMessageService.ts

Extends `BaseIndexedDBService`. CRUD for custom love messages with Zod validation, filtering (category, active, search), export/import with duplicate detection.

### moodService.ts

Extends `BaseIndexedDBService`. Mood entry CRUD with sync tracking. Index: `by-date`. Methods: `create`, `updateMood`, `getMoodForDate`, `getMoodsInRange`, `getUnsyncedMoods`, `markAsSynced`.

### photoStorageService.ts

Extends `BaseIndexedDBService`. Photo CRUD with compression metadata, cursor-based pagination, storage quota estimation via StorageManager API.

### imageCompressionService.ts

Client-side image compression using Canvas API. Max 2048px, 80% JPEG quality. Validates MIME (JPEG/PNG/WebP), rejects >25MB. Fallback to original on compression failure.

### loveNoteImageService.ts

Image upload via Edge Function + signed URL management. LRU cache (max 100 URLs) with expiry buffer. Request deduplication. Batch URL generation.

### photoService.ts

Supabase Storage operations. Upload with progress simulation, signed URLs (1hr), storage quota (1GB free, 80%/95% warnings), delete with rollback.

### syncService.ts

Offline-first background sync for mood entries. Partial failure handling. Methods: `syncPendingMoods`, `hasPendingSync`, `getPendingCount`.

### realtimeService.ts

Supabase Realtime subscriptions for mood updates. Channel management, error handling, subscription tracking.

### authService.ts (in services/)

Supabase authentication. Methods: `signIn`, `signOut`, `getSession`, `getUser`, `getCurrentUserId`, `getCurrentUserIdOfflineSafe`.

### performanceMonitor.ts

Operation timing metrics. `measureAsync` wraps operations. Tracks count, avg, min, max, total.

### migrationService.ts

One-time LocalStorage to IndexedDB migration for custom messages with duplicate detection.

### storage.ts

Legacy `StorageService` (pre-refactor). `localStorageHelper`: generic get/set/remove/clear.

## Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useAuth` | Current authenticated user | `user`, `isLoading`, `error` |
| `useLoveNotes` | Love notes chat state + CRUD | `notes`, `sendNote`, `fetchNotes`, `retryFailedMessage`, `hasMore` |
| `useRealtimeMessages` | Real-time love note subscriptions | (side effects only) |
| `usePhotos` | Photos state + CRUD actions | `photos`, `uploadPhoto`, `loadPhotos`, `deletePhoto` |
| `useMoodHistory` | Paginated mood history | `moods`, `loadMore`, `hasMore`, `isLoading` |
| `usePartnerMood` | Partner mood with real-time updates | `partnerMood`, `connectionStatus` |
| `useNetworkStatus` | Online/offline detection | `isOnline`, `isConnecting` |
| `useImageCompression` | React wrapper for compression | `compress`, `result`, `status`, `error` |
| `useVibration` | Haptic feedback | `vibrate`, `isSupported` |

## Data Files

### scriptureSteps.ts (NEW)

17 scripture steps across 6 sections (NKJV): Healing & Restoration (3), Forgiveness & Reconciliation (3), Confession & Repentance (3), God's Faithfulness & Peace (3), Power of Words (3), Christlike Character (2). Each step: `sectionTheme`, `verseReference`, `verseText`, `responseText`.

### defaultMessages.ts

365 pre-written messages across 5 categories (73 each): `reason`, `memory`, `affirmation`, `future`, `custom`. Used for daily message rotation.

## Architectural Patterns

1. **Cache-first with background refresh** (scriptureReadingService)
2. **Singleton pattern** (all services)
3. **Generic base class** (BaseIndexedDBService)
4. **Zod validation** at service boundaries
5. **Error resilience**: read operations degrade gracefully, write operations fail explicitly
6. **Request deduplication** (loveNoteImageService)
7. **LRU cache eviction** (signed URLs)
8. **Exponential backoff** (realtime subscriptions)
9. **Lazy initialization** (BaseIndexedDBService)

## New Since Jan 27

- **scriptureReadingService.ts**: Full CRUD for scripture sessions with IndexedDB caching
- **scriptureSteps.ts**: 17 static scripture steps data
- **dbSchema.ts**: v4 to v5 upgrade adding 4 scripture IndexedDB stores
