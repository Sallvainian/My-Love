# 5. Mood Sync Service

**Sources:**

- `src/api/moodSyncService.ts` -- Supabase sync + broadcast
- `src/services/moodService.ts` -- IndexedDB mood operations (for pending mood retrieval)

## Overview

Handles synchronization of mood entries between IndexedDB (offline) and Supabase (online). Provides real-time partner mood updates via the Supabase Broadcast API.

**Singleton:** `export const moodSyncService = new MoodSyncService()`

## Types

```typescript
type SupabaseMoodRecord = SupabaseMood; // Re-export alias
type MoodEntryInsert = MoodInsert; // Re-export alias

interface SyncResult {
  synced: number; // Successfully synced count
  failed: number; // Failed count
  errors: string[]; // Error messages for failed entries
}
```

## Methods

### `syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord>`

Uploads a single mood entry to Supabase.

**Flow:**

1. Checks `isOnline()` -- throws `SupabaseServiceError` if offline
2. Transforms local `MoodEntry` to `MoodInsert` format (maps `mood` to `mood_type`, `moods` array to `mood_types`)
3. Calls `moodApi.create(moodInsert)` for validated insert
4. On success, fires a background broadcast to partner via `broadcastMoodToPartner()` (fire-and-forget)
5. Returns the validated Supabase record

**Partner broadcast:** Uses `getPartnerId()` to find partner, then broadcasts on the partner's channel. Errors are logged but never thrown.

---

### `syncPendingMoods(): Promise<SyncResult>`

Batch syncs all unsynced moods from IndexedDB to Supabase.

**Flow:**

1. Checks `isOnline()` -- returns early with error message if offline
2. Calls `moodService.getUnsyncedMoods()` to get pending entries
3. For each mood, calls `syncMoodWithRetry()` with exponential backoff
4. On success: calls `moodService.markAsSynced(mood.id, syncedMood.id)`
5. On failure: logs error, continues to next mood (partial failure handling)
6. Returns `SyncResult` summary

**Retry strategy (per mood):**

- 4 total attempts (1 initial + 3 retries)
- Delays: 1s, 2s, 4s (exponential backoff)
- Checks `isOnline()` before each attempt
- Throws after all attempts fail

---

### `subscribeMoodUpdates(callback, onStatusChange?): Promise<() => void>`

```typescript
async subscribeMoodUpdates(
  callback: (mood: SupabaseMoodRecord) => void,
  onStatusChange?: (status: string) => void
): Promise<() => void>
```

Subscribes to real-time partner mood updates via the Supabase Broadcast API.

**Why Broadcast instead of postgres_changes:** RLS policies on the `moods` table use a subquery for partner lookup that Supabase Realtime cannot evaluate. Broadcast API bypasses this limitation.

**Channel:** `mood-updates:{currentUserId}` -- each user subscribes to their OWN channel. The partner broadcasts TO this channel when they log a mood.

**Config:** `broadcast: { self: false }` -- prevents receiving own broadcasts.

**Event:** `new_mood` -- contains `{ id, user_id, mood_type, mood_types, note, created_at }`

**Returns:** Unsubscribe function that removes the channel.

---

### `fetchMoods(userId: string, limit?: number): Promise<SupabaseMoodRecord[]>`

Delegates to `moodApi.fetchByUser(userId, limit)`. Convenience wrapper.

---

### `getLatestPartnerMood(userId: string): Promise<SupabaseMoodRecord | null>`

Fetches the most recent mood for a user (typically the partner).

**Implementation:** Calls `fetchMoods(userId, 1)` and returns the first element or `null`.

**Error handling:** Returns `null` on any failure (graceful degradation for read operations).

## Private Methods

### `broadcastMoodToPartner(mood, partnerId): Promise<void>`

Creates an ephemeral Supabase channel to the partner's `mood-updates:{partnerId}` channel, sends a `new_mood` broadcast event, then immediately unsubscribes and removes the channel.

**Fire-and-forget:** Errors are logged but never thrown to the caller.

### `syncMoodWithRetry(mood: MoodEntry): Promise<SupabaseMoodRecord>`

Wraps `syncMood()` with exponential backoff retry logic (1s, 2s, 4s delays, 3 retries max).
