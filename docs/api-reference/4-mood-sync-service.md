# 4. Mood Sync Service

**Module:** `src/api/moodSyncService.ts`
**Singleton export:** `moodSyncService` (instance of `MoodSyncService`)

Orchestrates sync between local IndexedDB mood entries and Supabase.

## Types

```typescript
interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}
```

## Methods

### `syncMood(mood)`

```typescript
async syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord>
```

- **Purpose:** Upload a single local `MoodEntry` to Supabase.
- **Transform:** Converts `MoodEntry` fields to snake_case `MoodInsert`. Supports multi-mood via `mood_types` array.
- **Side effect:** After successful sync, broadcasts to partner's realtime channel (fire-and-forget).
- **Throws:** On offline or API failure.

---

### `syncPendingMoods()`

```typescript
async syncPendingMoods(): Promise<SyncResult>
```

- **Purpose:** Batch sync all unsynced moods from IndexedDB.
- **Strategy:** Iterates each unsynced mood with retry logic (exponential backoff: 1s, 2s, 4s; max 3 retries per mood).
- **On success per mood:** Marks as synced in IndexedDB via `moodService.markAsSynced()`.
- **Error handling:** Continues syncing remaining moods on individual failure (partial failure tolerance).

---

### `subscribeMoodUpdates(callback, onStatusChange?)`

```typescript
async subscribeMoodUpdates(
  callback: (mood: SupabaseMoodRecord) => void,
  onStatusChange?: (status: string) => void
): Promise<() => void>
```

- **Purpose:** Subscribe to Broadcast API for partner mood notifications.
- **Pattern:** Current user subscribes to their own channel (`mood-updates:{userId}`). Partner broadcasts to this channel.
- **Why Broadcast, not postgres_changes:** RLS policies with partner subqueries prevent postgres_changes from working.
- **Returns:** Unsubscribe function that removes the channel.

---

### `fetchMoods(userId, limit?)`

```typescript
async fetchMoods(userId: string, limit: number = 50): Promise<SupabaseMoodRecord[]>
```

- **Purpose:** Fetch moods for any user. Delegates to `moodApi.fetchByUser()`.

---

### `getLatestPartnerMood(userId)`

```typescript
async getLatestPartnerMood(userId: string): Promise<SupabaseMoodRecord | null>
```

- **Purpose:** Fetch the single most recent mood for a user.
- **Error handling:** Returns `null` on failure (graceful degradation for reads).

---
