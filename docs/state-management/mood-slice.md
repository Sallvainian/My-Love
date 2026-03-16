# Mood Slice

**File:** `src/stores/slices/moodSlice.ts`
**Interface:** `MoodSlice`

## Purpose

Manages mood tracking with 12 mood types (6 positive, 6 challenging), partner mood viewing, and offline-first sync with Supabase. Supports multi-select moods, notes, and a sync queue for offline entries.

## State

| Field          | Type          | Default   | Persisted          | Description                                    |
| -------------- | ------------- | --------- | ------------------ | ---------------------------------------------- |
| `moods`        | `MoodEntry[]` | `[]`      | Yes (localStorage) | Local mood entries                             |
| `partnerMoods` | `MoodEntry[]` | `[]`      | No                 | Partner's mood entries (fetched from Supabase) |
| `syncStatus`   | `SyncStatus`  | See below | No                 | Sync state for offline-first pattern           |

## SyncStatus Shape

```typescript
interface SyncStatus {
  pendingMoods: MoodEntry[]; // Moods created offline, awaiting sync
  isOnline: boolean; // Network status
  lastSyncAt: string | null; // ISO timestamp of last successful sync
  isSyncing: boolean; // Whether a sync operation is in progress
}
```

## Mood Types

12 mood types organized in two categories:

- **Positive:** `loved`, `happy`, `content`, `excited`, `thoughtful`, `grateful`
- **Challenging:** `sad`, `anxious`, `frustrated`, `angry`, `lonely`, `tired`

## Actions

| Action                  | Signature                                                                    | Description                                        |
| ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| `addMoodEntry`          | `(moods: MoodEntry['mood'][], note?: string) => Promise<void>`               | Creates a mood entry (multi-select), triggers sync |
| `getMoodForDate`        | `(date: string) => MoodEntry \| undefined`                                   | Returns mood for a specific date                   |
| `updateMoodEntry`       | `(date: string, moods: MoodEntry['mood'][], note?: string) => Promise<void>` | Updates existing mood entry                        |
| `loadMoods`             | `() => Promise<void>`                                                        | Loads all moods from IndexedDB                     |
| `updateSyncStatus`      | `() => Promise<void>`                                                        | Refreshes pending/online status                    |
| `syncPendingMoods`      | `() => Promise<{ synced: number; failed: number }>`                          | Syncs all pending moods to Supabase                |
| `fetchPartnerMoods`     | `(limit?: number) => Promise<void>`                                          | Fetches partner moods from Supabase                |
| `getPartnerMoodForDate` | `(date: string) => MoodEntry \| undefined`                                   | Returns partner's mood for a specific date         |

## Offline-First Pattern

1. `addMoodEntry()` creates entry via `moodService.create()` in IndexedDB (validates with `MoodEntrySchema`)
2. Optimistic UI update -- adds to state immediately
3. If online, immediately calls `syncPendingMoods()` (fire-and-forget)
4. If offline, registers background sync via service worker
5. `syncPendingMoods()` calls `moodSyncService.syncPendingMoods()`, then reloads moods and refreshes partner moods
6. Failed syncs are retried on next sync cycle (App.tsx has 5-minute periodic sync)

## Validation

Mood entries are validated with Zod schemas before storage and sync. Timestamps use ISO 8601 format.

## Cross-Slice Dependencies

- **Reads:** `AuthSlice` (via `get().userId` in `addMoodEntry`, `updateMoodEntry` for user identity)
