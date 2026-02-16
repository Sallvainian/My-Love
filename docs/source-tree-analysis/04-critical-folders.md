# Critical Folders

## `src/stores/` -- State Management Core

**Impact**: Changes here affect every component in the app.

```
stores/
  useAppStore.ts     # THE store -- all app state lives here
  types.ts           # AppState type, AppSlice, slice creator type
  slices/            # 10 domain slices
```

**Why critical:**
- `useAppStore.ts` composes all 10 slices and configures persistence. A bug in the persist config can corrupt localStorage for all users.
- `types.ts` defines `AppState` as the intersection of all slices. Adding/removing a slice requires updating this type.
- Each slice in `slices/` owns its domain's state and actions. The initialization flow in `settingsSlice.ts` is the most complex cross-slice coordination point.

**Key files:**
- `useAppStore.ts` (store creation, persist config, custom Map serialization)
- `types.ts` (AppState intersection type, AppStateCreator helper)
- `settingsSlice.ts` (initializeApp -- the critical startup path)
- `moodSlice.ts` (offline sync coordination, largest action surface)

---

## `src/services/` -- Data Access Layer

**Impact**: All IndexedDB and external service interactions flow through here.

```
services/
  BaseIndexedDBService.ts       # Abstract CRUD base class
  dbSchema.ts                   # Shared IndexedDB schema (v5)
  moodService.ts                # Mood CRUD with Zod validation
  customMessageService.ts       # Message CRUD with import/export
  scriptureReadingService.ts    # Online-first with cache
  storage.ts                    # StorageService singleton
  photoService.ts               # Supabase Storage operations
  ...
```

**Why critical:**
- `dbSchema.ts` defines the shared IndexedDB schema. Version changes require careful migration logic in `upgradeDb()`.
- `BaseIndexedDBService.ts` is the abstract foundation for all IndexedDB services. The split error strategy (read=graceful, write=throw) is enforced here.
- `moodService.ts` bridges Zustand state and IndexedDB with Zod validation. Its `getUnsyncedMoods()` and `markAsSynced()` methods are the sync backbone.
- `scriptureReadingService.ts` implements the online-first pattern with cache-first reads and corruption recovery.

---

## `src/api/` -- Supabase API Layer

**Impact**: All cloud communication flows through here.

```
api/
  supabaseClient.ts         # Singleton client (validated env vars)
  moodSyncService.ts        # Mood sync to Supabase
  interactionService.ts     # Poke/kiss + realtime subscriptions
  partnerService.ts         # Partner linking
  auth/
    sessionService.ts       # Offline-safe auth
    actionService.ts        # Sign-in/out
```

**Why critical:**
- `supabaseClient.ts` creates the singleton Supabase client. It validates environment variables at import time -- a missing variable crashes the app immediately.
- `moodSyncService.ts` transforms IndexedDB mood entries to Supabase format. Schema mismatches between local and remote models surface here.
- `auth/sessionService.ts` provides `getCurrentUserIdOfflineSafe()`, used by the offline mood tracking path.

---

## `src/validation/` -- Runtime Validation

**Impact**: Prevents data corruption across all service boundaries.

```
validation/
  schemas.ts           # All Zod schemas
  errorMessages.ts     # Error transformation utilities
  index.ts             # Barrel exports
```

**Why critical:**
- `schemas.ts` defines every data shape used by the app. Schema changes must be coordinated with IndexedDB stores, Supabase tables, and Zustand state types.
- `errorMessages.ts` transforms Zod errors into user-facing messages. The `FIELD_NAME_MAP` must stay synchronized with schema field paths.

---

## `src/hooks/` -- React Integration Layer

**Impact**: Component behavior and side effects.

```
hooks/
  useAuth.ts                # Auth state for app shell
  useRealtimeMessages.ts    # Broadcast channel lifecycle
  useNetworkStatus.ts       # Offline detection
  useLoveNotes.ts           # Love notes composition hook
  useMoodHistory.ts         # Paginated data fetching
```

**Why critical:**
- `useAuth.ts` gates the entire application behind authentication. A bug here locks users out.
- `useRealtimeMessages.ts` manages the realtime channel lifecycle with retry logic. Connection leaks or missed cleanup cause resource exhaustion.
- `useNetworkStatus.ts` drives the offline/online UI and sync decisions across the app.

---

## `src/components/` -- UI Components

**Impact**: User-facing rendering.

**Most critical subdirectories:**

| Directory | Why |
|-----------|-----|
| `love-notes/` | 7 files, most complex feature (chat, images, realtime, virtualization) |
| `scripture-reading/` | 9 files, online-first pattern, session state management |
| `MoodTracker/` | 6 files, offline-first CRUD with partner mood display |
| `Navigation/` | `BottomNavigation.tsx` -- primary navigation mechanism |
| `shared/` | `NetworkStatusIndicator`, `SyncToast` -- global UI overlays |

---

## `src/config/` -- Application Configuration

```
config/
  constants.ts            # APP_CONFIG (partner name, start date)
  performance.ts          # Pagination limits, storage quotas
  images.ts               # Compression settings, file size limits
  relationshipDates.ts    # Birthday/anniversary dates
```

**Why critical:**
- `constants.ts` contains the default partner name and relationship start date.
- `performance.ts` defines `VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH` used by Zod schemas.
- `images.ts` defines compression quality and max dimensions.

---

## Root-Level Critical Files

| File | Why Critical |
|------|-------------|
| `src/App.tsx` | Application shell: auth gate, routing, sync setup, lazy loading |
| `src/main.tsx` | Entry point: StrictMode, LazyMotion, SW registration |
| `src/sw.ts` | Service Worker: cache strategies, background sync |
| `src/sw-db.ts` | SW-specific IndexedDB access (separate execution context) |

## Related Documentation

- [Directory Tree](./02-directory-tree.md)
- [Entry Point Trace](./03-entry-point-trace.md)
- [Architecture Patterns](../architecture/03-architecture-patterns.md)
