# 5. Mood Sync Service

**Source:** `src/api/moodSyncService.ts`

## Purpose

Handles synchronization of mood entries between IndexedDB and Supabase. Provides real-time partner mood updates via Broadcast API.

## Class: `MoodSyncService`

Singleton exported as `moodSyncService`.

### `syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord>`
Transforms local `MoodEntry` to `MoodInsert` format (maps `moods[]` to `mood_types[]`, `mood` to `mood_type`). Uses `moodApi.create()` for validated insert. Fire-and-forget broadcasts to partner channel after success.

### `syncPendingMoods(): Promise<SyncResult>`
Batch syncs all unsynced moods from IndexedDB. Returns `{ synced, failed, errors[] }`. Uses `syncMoodWithRetry()` for each mood. Continues on individual failures.

### `subscribeMoodUpdates(callback, onStatusChange?): Promise<() => void>`
Subscribes to Broadcast channel `mood-updates:{currentUserId}`. Partner sends to this channel when logging moods. Returns unsubscribe function. Uses `{ broadcast: { self: false } }` to avoid receiving own messages.

### `fetchMoods(userId, limit?): Promise<SupabaseMoodRecord[]>`
Delegates to `moodApi.fetchByUser()`.

### `getLatestPartnerMood(userId): Promise<SupabaseMoodRecord | null>`
Fetches single most recent mood. Returns `null` on error (graceful degradation).

## Private Methods

### `syncMoodWithRetry(mood): Promise<SupabaseMoodRecord>`
Retries sync with exponential backoff: 1s, 2s, 4s (max 3 retries, 4 total attempts).

### `broadcastMoodToPartner(mood, partnerId): Promise<void>`
Creates ephemeral channel `mood-updates:{partnerId}`, sends broadcast event `new_mood`, then removes channel. Fire-and-forget (errors logged but not thrown).

## Types

```typescript
interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}
```

## Broadcast Payload

```json
{
  "type": "broadcast",
  "event": "new_mood",
  "payload": {
    "id": "uuid",
    "user_id": "uuid",
    "mood_type": "happy",
    "mood_types": ["happy", "grateful"],
    "note": "Great day!",
    "created_at": "2026-01-15T10:30:00Z"
  }
}
```
