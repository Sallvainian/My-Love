# 5. Mood Sync Service

**Sources:**
- `src/api/moodSyncService.ts` (Supabase sync with broadcast)
- `src/services/syncService.ts` (batch sync orchestration)

## Overview

The mood sync layer implements the **offline-first** sync pattern: mood entries are created in IndexedDB first (via `moodService`), then synced to Supabase. There are two sync services with different responsibilities.

## MoodSyncService (src/api/moodSyncService.ts)

Handles individual mood sync, partner broadcasts, realtime subscriptions, and remote queries.

### Types

```typescript
interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}
```

### Methods

#### `syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord>`

Uploads a single mood to Supabase with partner notification.

**Flow:**
1. Check `isOnline()` -- throw if offline
2. Transform local `MoodEntry` to `MoodInsert` format (snake_case, ISO timestamps)
3. Call `moodApi.create()` for validated insert
4. Fire-and-forget: broadcast to partner via `broadcastMoodToPartner()`
5. Return the validated Supabase record

**Mood transformation:** Maps `mood.moods` array (or fallback to `[mood.mood]`) into `mood_types` for multi-mood support.

#### `syncPendingMoods(): Promise<SyncResult>`

Batch syncs all unsynced moods from IndexedDB.

**Flow:**
1. Check `isOnline()` -- return early with error if offline
2. Call `moodService.getUnsyncedMoods()` from IndexedDB
3. For each mood, call `syncMoodWithRetry()` (exponential backoff)
4. On success: call `moodService.markAsSynced(localId, supabaseId)`
5. On failure: log error and continue (partial failure handling)
6. Return detailed `SyncResult`

**Retry logic (private `syncMoodWithRetry()`):**
- Max 3 retries (4 total attempts)
- Delays: 1000ms, 2000ms, 4000ms
- Checks `isOnline()` before each attempt
- Throws after all attempts fail

#### `subscribeMoodUpdates(callback, onStatusChange?): Promise<() => void>`

Subscribes to partner mood updates via **Broadcast API** (not `postgres_changes`).

**Why Broadcast instead of postgres_changes:** RLS policies on the moods table use complex subqueries for partner lookup that Supabase Realtime cannot evaluate.

**Channel:** `mood-updates:{currentUserId}` with `broadcast: { self: false }`

**Event:** `new_mood` -- partner broadcasts to this channel when they log a mood.

**Returns:** Unsubscribe function that removes the channel.

#### `fetchMoods(userId: string, limit?: number): Promise<SupabaseMoodRecord[]>`

Delegates to `moodApi.fetchByUser()` for validated remote queries.

#### `getLatestPartnerMood(userId: string): Promise<SupabaseMoodRecord | null>`

Fetches the single most recent mood for a user. Returns `null` on error (graceful degradation).

### Private: broadcastMoodToPartner()

Creates an ephemeral Broadcast channel (`mood-updates:{partnerId}`), sends the mood data, then immediately removes the channel. Fire-and-forget -- errors are logged but not thrown.

## SyncService (src/services/syncService.ts)

Simpler batch sync using parallel `Promise.all` with partial failure handling.

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

#### `syncPendingMoods(): Promise<SyncSummary>`

Syncs all unsynced moods using `Promise.all()` for parallel execution. Each mood is synced independently -- failures do not block other moods.

#### `hasPendingSync(): Promise<boolean>`

Returns `true` if there are any unsynced moods in IndexedDB.

#### `getPendingCount(): Promise<number>`

Returns the count of unsynced moods.

## Hybrid Sync Strategy

The app uses three complementary sync triggers:
1. **Immediate sync** -- on mood creation (in-app)
2. **Periodic sync** -- while app is open (in-app)
3. **Background Sync** -- when app is closed (service worker, see Doc 11)
