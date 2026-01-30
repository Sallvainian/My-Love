# Project Structure & Boundaries

## Complete Project Directory Structure

**New Files & Directories for Scripture Reading:**

```
src/
├── components/
│   └── scripture-reading/              # NEW DIRECTORY
│       ├── session/
│       │   ├── Countdown.tsx
│       │   ├── LockInButton.tsx
│       │   └── SessionProgress.tsx
│       ├── reading/
│       │   ├── RoleIndicator.tsx
│       │   ├── BookmarkFlag.tsx
│       │   └── PartnerPosition.tsx
│       ├── reflection/
│       │   ├── ReflectionSummary.tsx
│       │   └── DailyPrayerReport.tsx
│       ├── containers/
│       │   ├── ScriptureReadingView.tsx
│       │   ├── LobbyContainer.tsx
│       │   ├── ReadingContainer.tsx
│       │   └── ReflectionContainer.tsx
│       └── index.ts
│
├── stores/
│   └── slices/
│       └── scriptureReadingSlice.ts    # NEW FILE (types co-located)
│
├── services/
│   ├── dbSchema.ts                     # NEW FILE (centralized IndexedDB version)
│   └── scriptureReadingService.ts      # NEW FILE (IndexedDB CRUD)
│
├── hooks/
│   ├── useMotionConfig.ts              # NEW FILE (global reduced-motion)
│   ├── useScriptureBroadcast.ts        # NEW FILE (real-time channel)
│   └── index.ts                        # MODIFIED (export new hooks)
│
└── types/
    ├── database.types.ts               # MODIFIED (add scripture table types)
    └── models.ts                       # MODIFIED (add scripture app models)

supabase/
└── migrations/
    └── 20260125_scripture_reading.sql  # NEW FILE (tables + RPCs + RLS)

tests/
├── unit/
│   ├── components/
│   │   └── scripture-reading/
│   │       ├── session/
│   │       │   ├── Countdown.test.tsx
│   │       │   ├── LockInButton.test.tsx
│   │       │   └── SessionProgress.test.tsx
│   │       ├── reading/
│   │       │   ├── RoleIndicator.test.tsx
│   │       │   ├── BookmarkFlag.test.tsx
│   │       │   └── PartnerPosition.test.tsx
│   │       └── reflection/
│   │           ├── ReflectionSummary.test.tsx
│   │           └── DailyPrayerReport.test.tsx
│   ├── services/
│   │   ├── dbConfig.test.ts
│   │   └── scriptureReadingService.test.ts
│   ├── stores/
│   │   └── scriptureReadingSlice.test.ts
│   └── hooks/
│       ├── useMotionConfig.test.ts
│       └── useScriptureBroadcast.test.ts
│
└── integration/
    └── scripture-reading/
        ├── solo-mode.test.ts
        ├── together-mode.test.ts
        └── network-handling.test.ts
```

## Existing Files Modified

| File | Change |
|------|--------|
| `src/stores/useAppStore.ts` | Import and compose `scriptureReadingSlice` |
| `src/stores/slices/navigationSlice.ts` | Add 'scripture' to ViewType |
| `src/App.tsx` | Add scripture reading route/view |
| `src/components/Navigation/BottomNavigation.tsx` | Add scripture tab |
| `src/services/syncService.ts` | No changes needed for scripture (cache-only pattern) |
| `src/services/moodService.ts` | Import shared `dbSchema.ts` (tech debt fix) |
| `src/services/customMessageService.ts` | Import shared `dbSchema.ts` (tech debt fix) |
| `src/services/photoStorageService.ts` | Import shared `dbSchema.ts` (tech debt fix) |
| `src/sw-db.ts` | **⚠️ Manual sync:** Update DB_VERSION to 5, add scripture stores if Background Sync needed |
| `src/types/database.types.ts` | Add scripture table type definitions |
| `src/types/models.ts` | Add scripture app model interfaces |
| `src/hooks/index.ts` | Export `useMotionConfig`, `useScriptureBroadcast` |

## Architectural Boundaries

**API Boundaries:**

| Boundary | Location | Protocol |
|----------|----------|----------|
| **Supabase Tables** | `supabase/migrations/` | SQL DDL |
| **Supabase RPCs** | `supabase/migrations/` | SQL functions |
| **Supabase Broadcast** | `src/hooks/useScriptureBroadcast.ts` | WebSocket |
| **IndexedDB** | `src/services/scriptureReadingService.ts` | idb wrapper |

**Component Boundaries:**

| Layer | Responsibility | Communication |
|-------|---------------|---------------|
| **Containers** | Connect to slice, pass props | Zustand selectors |
| **Presentational** | Pure render, receive props | Props + callbacks |
| **Slice** | State management | Actions + selectors |
| **Service** | Data persistence | Async methods |
| **Hooks** | Side effects (broadcast, motion) | React hooks |

**Data Boundaries:**

| Data Type | Source of Truth | Cache Pattern |
|-----------|-----------------|---------------|
| Session state | Supabase (server) | Broadcast → Slice → IndexedDB cache |
| Lock-in state | Supabase (server) | RPC → Broadcast |
| Reflections | Supabase (server) | Write-through; IndexedDB cache for reads |
| Bookmarks | Supabase (server) | Write-through; IndexedDB cache for reads |
| Presence | Ephemeral broadcast | No persistence |

## Requirements to Structure Mapping

**Feature Mapping:**

| FR Category | Primary Files |
|-------------|---------------|
| **Session Management (FR1-7)** | `scriptureReadingSlice.ts`, `scriptureReadingService.ts`, `ScriptureReadingView.tsx` |
| **Solo Mode Flow (FR8-13)** | `ReadingContainer.tsx`, `scriptureReadingService.ts`, `dbSchema.ts` |
| **Together Mode Flow (FR14-29)** | `useScriptureBroadcast.ts`, `LobbyContainer.tsx`, `LockInButton.tsx`, `Countdown.tsx` |
| **Reflection System (FR30-33)** | `ReflectionSummary.tsx`, `BookmarkFlag.tsx`, `ReflectionContainer.tsx` |
| **Daily Prayer Report (FR34-41)** | `DailyPrayerReport.tsx`, `ReflectionContainer.tsx` |
| **Stats & Progress (FR42-46)** | `scriptureReadingService.ts`, `scriptureReadingSlice.ts` |
| **Accessibility (FR50-54)** | `useMotionConfig.ts`, all presentational components |

**Cross-Cutting Concerns:**

| Concern | Files |
|---------|-------|
| **Real-time sync** | `useScriptureBroadcast.ts`, `scriptureReadingSlice.ts` |
| **Caching layer** | `dbSchema.ts`, `scriptureReadingService.ts` |
| **Reduced motion** | `useMotionConfig.ts` (global, used by all animated components) |
| **RLS policies** | `20260125_scripture_reading.sql` |

## Integration Points

**Internal Communication:**

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│                           │                                 │
│                           ▼                                 │
│              ┌─────────────────────────┐                   │
│              │  ScriptureReadingView   │                   │
│              │     (container)         │                   │
│              └───────────┬─────────────┘                   │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐       │
│  │   Lobby    │  │  Reading   │  │   Reflection   │       │
│  │ Container  │  │ Container  │  │   Container    │       │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘       │
│        │               │                 │                 │
│        └───────────────┼─────────────────┘                 │
│                        ▼                                    │
│           ┌─────────────────────────┐                      │
│           │  scriptureReadingSlice  │◄──── useScripture    │
│           │      (Zustand)          │      Broadcast       │
│           └───────────┬─────────────┘                      │
│                       │                                     │
│         ┌─────────────┼─────────────┐                      │
│         ▼             ▼             ▼                      │
│  ┌────────────┐ ┌──────────┐ ┌──────────────┐             │
│  │ scripture  │ │ Supabase │ │  SyncService │             │
│  │ Reading    │ │   RPC    │ │  (modified)  │             │
│  │ Service    │ │          │ │              │             │
│  └────────────┘ └──────────┘ └──────────────┘             │
│        │                                                    │
│        ▼                                                    │
│  ┌────────────┐                                            │
│  │  IndexedDB │◄──── dbSchema.ts (shared version)         │
│  └────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

**External Integrations:**

| Integration | Protocol | Files |
|-------------|----------|-------|
| Supabase Auth | Existing | `authService.ts` (no changes) |
| Supabase Database | PostgreSQL | `database.types.ts`, migration |
| Supabase Realtime | Broadcast | `useScriptureBroadcast.ts` |
| IndexedDB | idb wrapper | `dbSchema.ts`, `scriptureReadingService.ts` |

## File Organization Patterns

**New File Naming:**
- Components: `PascalCase.tsx` (e.g., `LockInButton.tsx`)
- Services: `camelCase.ts` (e.g., `scriptureReadingService.ts`)
- Hooks: `useCamelCase.ts` (e.g., `useScriptureBroadcast.ts`)
- Slices: `camelCaseSlice.ts` (e.g., `scriptureReadingSlice.ts`)
- Tests: `{filename}.test.ts(x)` mirroring src structure

**Migration File:**
- Single file: `20260125_scripture_reading.sql`
- Contains: Tables, indexes, RLS policies, RPC functions
- Idempotent: Uses `IF NOT EXISTS` where appropriate

## Tech Debt Fix: Centralized dbConfig

**Problem:** Existing services use different IndexedDB versions causing `VersionError`.

**Solution:** `src/services/dbSchema.ts` (centralized schema)

```typescript
// dbSchema.ts
export const DB_NAME = 'my-love-db';
export const DB_VERSION = 5; // Bumped for Scripture Reading stores

export const STORES = {
  moods: { keyPath: 'id', indexes: ['synced', 'user_id'] },
  customMessages: { keyPath: 'id', indexes: ['synced'] },
  photos: { keyPath: 'id', indexes: ['synced'] },
  // New scripture stores (cache-only, no 'synced' index needed)
  scriptureSessions: { keyPath: 'id', indexes: ['user_id'] },
  scriptureReflections: { keyPath: 'id', indexes: ['session_id'] },
  scriptureBookmarks: { keyPath: 'id', indexes: ['session_id'] },
  scriptureMessages: { keyPath: 'id', indexes: ['session_id'] },
};
// Note: Existing stores retain 'synced' index for backward compatibility
// Scripture stores use cache-only pattern (server is source of truth)

export function upgradeDb(db: IDBPDatabase, oldVersion: number) {
  // Handle all store creation/upgrades in one place
  for (const [name, config] of Object.entries(STORES)) {
    if (!db.objectStoreNames.contains(name)) {
      const store = db.createObjectStore(name, { keyPath: config.keyPath });
      config.indexes.forEach(idx => store.createIndex(idx, idx));
    }
  }
}
```

**⚠️ Service Worker Sync Constraint:**

The `sw-db.ts` file **must be kept in sync manually** with `dbSchema.ts`. Service Workers cannot import from the `idb` library, so constants are duplicated:

```typescript
// sw-db.ts
// SYNC WARNING: These constants must match src/services/dbSchema.ts
const DB_VERSION = 5; // Must match DB_VERSION in src/services/dbSchema.ts
```

**Scripture Reading Implementation Checklist:**
1. ✅ Bump `DB_VERSION` to 5 in `dbSchema.ts`
2. ✅ Add 5 new stores to `MyLoveDBSchema` interface
3. ✅ Add upgrade logic in `scriptureReadingService.ts`
4. ⚠️ Update `sw-db.ts` if Background Sync needs access to scripture data

**Services to Update:**
- `moodService.ts` → import `DB_NAME`, `DB_VERSION`, `upgradeDb`
- `customMessageService.ts` → import shared config
- `photoStorageService.ts` → import shared config
- `scriptureReadingService.ts` → import shared config (new, cache-only pattern)

**Note:** `sw-db.ts` update not required for scripture - Background Sync not used (server is source of truth).
