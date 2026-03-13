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

| Action             | Signature                                 | Description                                            |
| ------------------ | ----------------------------------------- | ------------------------------------------------------ |
| `addMood`          | `(mood: MoodType, note?: string) => void` | Creates a mood entry locally                           |
| `deleteMood`       | `(id: string) => void`                    | Removes a mood entry                                   |
| `syncMoods`        | `() => Promise<void>`                     | Syncs pending moods to Supabase                        |
| `loadPartnerMoods` | `() => Promise<void>`                     | Fetches partner moods from Supabase                    |
| `setOnlineStatus`  | `(isOnline: boolean) => void`             | Updates network status, triggers sync when back online |
| `getMoodsByDate`   | `(date: string) => MoodEntry[]`           | Returns moods for a specific date                      |

## Offline-First Pattern

1. `addMood()` creates entry locally and adds to `pendingMoods`
2. If online, immediately calls `syncMoods()`
3. If offline, moods stay in `pendingMoods` until reconnect
4. `setOnlineStatus(true)` triggers automatic sync of pending moods
5. Failed syncs keep entries in `pendingMoods` for retry

## Validation

Mood entries are validated with Zod schemas before storage and sync. Timestamps use ISO 8601 format.

## Cross-Slice Dependencies

None. Operates independently.
