# Persistence Strategy

## Overview

Two persistence layers: **localStorage** (via Zustand persist middleware) for lightweight state, and **IndexedDB** (via `idb` library) for structured data.

## localStorage Persistence

### What Is Persisted

The `partialize` function selects four state keys:

| Key              | Type                | Why Persisted                                                       |
| ---------------- | ------------------- | ------------------------------------------------------------------- |
| `settings`       | `Settings \| null`  | Theme, relationship config, notifications must survive page refresh |
| `isOnboarded`    | `boolean`           | Prevents re-showing onboarding after refresh                        |
| `messageHistory` | `MessageHistory`    | Preserves which messages were shown on which dates (Map data)       |
| `moods`          | `MoodEntry[]`       | Enables offline mood display without waiting for IndexedDB load     |

### What Is NOT Persisted

| Key                                | Why Excluded                                              |
| ---------------------------------- | --------------------------------------------------------- |
| `isLoading`, `error`               | Transient UI state, recalculated on each load             |
| `currentView`                      | Determined from URL path on page load                     |
| `messages`                         | Loaded from IndexedDB during initialization               |
| `currentMessage`                   | Recalculated from messages + date on each load            |
| `customMessages`                   | Loaded from IndexedDB via `loadCustomMessages()`          |
| `partnerMoods`                     | Fetched from Supabase on demand                           |
| `syncStatus`                       | Recalculated from IndexedDB on load                       |
| `interactions`, `unviewedCount`    | Fetched from Supabase, ephemeral                          |
| `partner`, `sentRequests`, etc.    | Fetched from Supabase                                     |
| `notes`                            | Fetched from Supabase, no local cache                     |
| `photos`                           | Metadata fetched from Supabase; blobs in Supabase Storage |
| `session`, `activeSession`, etc.   | Cached in IndexedDB, fetched on demand                    |

### Custom Map Serialization

`messageHistory.shownMessages` is `Map<string, number>` (date -> message ID). JSON cannot serialize Maps natively.

**Write (partialize)**: `Array.from(state.messageHistory.shownMessages.entries())` -> stored as `[["2025-11-15", 42], ...]`

**Read (onRehydrateStorage)**: Validates array structure (`[string, unknown][]`), then `new Map(raw)`. Falls back to empty Map on any structural error.

### Corruption Recovery

1. **Pre-hydration**: `validateHydratedState()` in custom `getItem` -- removes key and returns null on critical errors
2. **Hydration error**: `onRehydrateStorage` error callback -- removes key, sets `__isHydrated = false`
3. **Post-hydration**: Second `validateHydratedState()` call after Map deserialization
4. **Init guard**: `initializeApp()` checks `__isHydrated` -- if false, sets error message and clears localStorage

## IndexedDB Persistence

### Schema (`src/services/dbSchema.ts`)

Database name: `my-love-db`, version: 5

| Store                   | Key Path | Auto-Increment | Indexes                                         |
| ----------------------- | -------- | -------------- | ----------------------------------------------- |
| `messages`              | `id`     | Yes            | `by-category` (category), `by-date` (createdAt) |
| `photos`                | `id`     | Yes            | `by-date` (uploadDate)                          |
| `moods`                 | `id`     | Yes            | `by-date` (date, unique)                        |
| `sw-auth`               | `id`     | No             | None                                            |
| `scripture-sessions`    | `id`     | No             | `by-user` (userId)                              |
| `scripture-reflections` | `id`     | No             | `by-session` (sessionId)                        |
| `scripture-bookmarks`   | `id`     | No             | `by-session` (sessionId)                        |
| `scripture-messages`    | `id`     | No             | `by-session` (sessionId)                        |

### Service Layer

All IndexedDB access goes through service classes extending `BaseIndexedDBService<T>`:

| Service                   | Store                | Additional Methods                                                      |
| ------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `MoodService`             | `moods`              | `getMoodForDate`, `getMoodsInRange`, `getUnsyncedMoods`, `markAsSynced` |
| `CustomMessageService`    | `messages`           | `getAll` (with filters), `exportMessages`, `importMessages`             |
| `PhotoStorageService`     | `photos`             | Migration v1->v2 support                                                |
| `ScriptureReadingService` | `scripture-*`        | Cache-first reads, write-through, corruption recovery                   |
| `StorageService`          | `messages`, `photos` | `addMessages` (bulk), `getAllMessages`                                  |

### Migration Strategy (`src/services/migrationService.ts`)

One-time migration from localStorage to IndexedDB for custom messages:
- Reads `localStorage.getItem('custom-messages')`
- Validates each via `CreateMessageInputSchema.parse()`
- Writes to IndexedDB with duplicate detection
- Removes legacy localStorage key

## Quota Monitoring

### localStorage

`src/utils/storageMonitor.ts` estimates usage against 5MB browser minimum:

| Threshold | Level      | Action                                        |
| --------- | ---------- | --------------------------------------------- |
| < 70%     | `safe`     | Normal operation                              |
| 70-85%    | `warning`  | Console warning with optimization suggestions |
| > 85%     | `critical` | Console error with action items               |

### IndexedDB

`PhotoStorageService.estimateQuotaRemaining()` uses `navigator.storage.estimate()`. Falls back to `STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES` (50MB) when API unavailable.

| Threshold | Level         | Action           |
| --------- | ------------- | ---------------- |
| < 80%     | normal        | Normal operation |
| 80-95%    | `approaching` | Console warning  |
| > 95%     | `critical`    | Reject uploads   |

### Supabase Storage

`photoService.ts` sums `file_size` from `photos` table against 1GB free tier limit:

| Threshold | Level         | Action           |
| --------- | ------------- | ---------------- |
| < 80%     | normal        | Normal operation |
| 80-95%    | `approaching` | Console warning  |
| 95-100%   | `critical`    | Reject uploads   |
| > 100%    | `exceeded`    | Error message    |

## Related Documentation

- [Store Configuration](./01-zustand-store-configuration.md)
- [Data Flow](./04-data-flow.md)
