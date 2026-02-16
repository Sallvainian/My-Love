# 12. Real-time Subscriptions

**Module:** `src/services/realtimeService.ts`
**Singleton export:** `realtimeService` (instance of `RealtimeService`)

## Architecture

The application uses two real-time patterns:

| Pattern | Used For | Module |
|---|---|---|
| **Broadcast API** (client-to-client) | Mood updates between partners | `moodSyncService` |
| **postgres_changes** (server-to-client) | Incoming interactions (poke/kiss) | `interactionService`, `realtimeService` |

**Why two patterns?** RLS policies on the `moods` table use partner subqueries that Supabase Realtime cannot evaluate for `postgres_changes`. The Broadcast API bypasses this by having the sender explicitly broadcast to the partner's channel.

## RealtimeService Methods

### `subscribeMoodChanges(userId, onMoodChange, onError?)`

```typescript
subscribeMoodChanges(
  userId: string,
  onMoodChange: MoodChangeCallback,
  onError?: ErrorCallback
): string
```

- **Purpose:** Watch for INSERT/UPDATE/DELETE on `moods` table filtered by `user_id`.
- **Uses:** `postgres_changes` with `event: '*'`.
- **Returns:** Channel ID string for unsubscribing.
- **Deduplication:** Warns if already subscribed to same channel.

---

### `unsubscribe(channelId)`

```typescript
async unsubscribe(channelId: string): Promise<void>
```

- **Purpose:** Remove a specific realtime channel.

---

### `unsubscribeAll()`

```typescript
async unsubscribeAll(): Promise<void>
```

- **Purpose:** Cleanup all active channels (component unmount / logout).

---

### `setErrorHandler(callback)`

```typescript
setErrorHandler(callback: ErrorCallback): void
```

- **Purpose:** Set a global error handler for all subscriptions (used when no per-subscription handler is provided).

---

### `getActiveSubscriptions()`

```typescript
getActiveSubscriptions(): number
```

- **Purpose:** Return count of active channels (for monitoring/debugging).

---

## Mood Broadcast Flow

1. User logs mood via `moodSyncService.syncMood()`.
2. Mood is inserted into Supabase via `moodApi.create()`.
3. `moodSyncService` looks up partner ID via `getPartnerId()`.
4. Creates ephemeral channel `mood-updates:{partnerId}`.
5. Broadcasts `{ type: 'broadcast', event: 'new_mood', payload: {...} }`.
6. Removes the ephemeral channel.

**Receiving side:**
1. Partner calls `moodSyncService.subscribeMoodUpdates()`.
2. This subscribes to `mood-updates:{ownUserId}` with `broadcast.self: false`.
3. Callback fires when partner's broadcast arrives.

## Interaction Realtime Flow

1. User calls `interactionService.sendPoke()` or `sendKiss()`.
2. Row is inserted into `interactions` table.
3. Partner's `subscribeInteractions()` picks up the INSERT via `postgres_changes` filtered by `to_user_id`.
4. Callback fires with the new interaction record.
