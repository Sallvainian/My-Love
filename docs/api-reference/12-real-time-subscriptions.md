# 12. Real-Time Subscriptions

**Sources:**

- `src/services/realtimeService.ts` -- Generic postgres_changes subscription manager
- `src/api/moodSyncService.ts` -- Broadcast API for mood updates (see also Section 5)
- `src/api/interactionService.ts` -- postgres_changes for interactions (see also Section 6)

## Overview

The app uses two Supabase Realtime mechanisms:

1. **postgres_changes** -- Server-to-client: subscribes to INSERT/UPDATE/DELETE events on specific tables. Used for interactions and generic mood watching.
2. **Broadcast API** -- Client-to-client: ephemeral pub/sub messaging. Used for partner mood updates (because RLS policies prevent postgres_changes from working on the moods table).

## RealtimeService (postgres_changes)

**Singleton:** `export const realtimeService = new RealtimeService()`

Manages named Realtime channels with lifecycle tracking via an internal `Map<string, RealtimeChannel>`.

### Methods

#### `subscribeMoodChanges(userId, onMoodChange, onError?): string`

Subscribes to mood changes for a specific user.

**Channel:** `moods:{userId}`

**Filter:** `postgres_changes` on `public.moods` table, `event: '*'` (INSERT/UPDATE/DELETE), `filter: user_id=eq.{userId}`

**Returns:** Channel ID string for later unsubscription.

**Duplicate prevention:** Warns and returns existing channel ID if already subscribed.

**Status handling:**

- `SUBSCRIBED` -- logs success
- `CHANNEL_ERROR` -- calls error callback
- `TIMED_OUT` -- calls error callback

---

#### `unsubscribe(channelId: string): Promise<void>`

Removes a specific channel by ID. Calls `supabase.removeChannel()` and deletes from internal Map.

---

#### `unsubscribeAll(): Promise<void>`

Removes all active channels. Used for cleanup on component unmount or app shutdown.

---

#### `setErrorHandler(callback: (error: Error) => void): void`

Sets a global error handler for all subscriptions. Individual subscription error callbacks take priority over the global handler.

---

#### `getActiveSubscriptions(): number`

Returns the count of active channels.

## Mood Broadcast (Broadcast API)

Implemented in `MoodSyncService` (see Section 5).

**Why Broadcast instead of postgres_changes:** The RLS policy on the `moods` table requires a subquery to look up the user's partner. Supabase Realtime cannot evaluate complex subqueries in RLS policies, so postgres_changes silently drops events. The Broadcast API bypasses RLS entirely since it's client-to-client messaging.

### Channel Pattern

- **Channel name:** `mood-updates:{userId}` -- each user subscribes to their OWN channel
- **Sender:** Partner broadcasts TO this channel when they log a mood
- **Event:** `new_mood`
- **Config:** `broadcast: { self: false }` -- prevents receiving own broadcasts

### Broadcast Payload

```typescript
{
  id: string;         // Supabase mood ID
  user_id: string;    // Partner's user ID
  mood_type: string;  // Primary mood
  mood_types: string[]; // All selected moods
  note: string | null;
  created_at: string; // ISO timestamp
}
```

### Ephemeral Channel Pattern (Sending)

When a user logs a mood, `broadcastMoodToPartner()`:

1. Creates a temporary channel to `mood-updates:{partnerId}`
2. Waits for `SUBSCRIBED` status
3. Sends the `new_mood` broadcast event
4. Immediately unsubscribes and removes the channel
5. Errors are logged but never thrown (fire-and-forget)

## Interaction Realtime (postgres_changes)

Implemented in `InteractionService` (see Section 6).

**Channel:** `incoming-interactions`

**Filter:** `postgres_changes` on `public.interactions` table, `event: 'INSERT'`, `filter: to_user_id=eq.{currentUserId}`

Only listens for new interactions sent TO the current user (not outgoing).

## Scripture Session Realtime

Scripture reading sessions use private Broadcast channels for together-mode state synchronization.

**Channel pattern:** `scripture-session:{sessionId}`

**Events:** `state_updated`, `lock_in_status_changed` -- used to synchronize step progression and lock-in status between partners reading together.
