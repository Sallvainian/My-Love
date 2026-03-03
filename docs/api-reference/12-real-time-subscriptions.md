# 12. Real-time Subscriptions

**Sources:**

- `src/services/realtimeService.ts` (channel management)
- `src/hooks/useScriptureBroadcast.ts` (scripture session broadcast channel)
- `src/hooks/useScripturePresence.ts` (ephemeral partner position tracking)
- `src/hooks/useRealtimeMessages.ts` (love notes real-time delivery)
- `src/hooks/usePartnerMood.ts` (partner mood updates)
- `src/api/moodSyncService.ts` (mood broadcast to partner)
- `src/api/interactionService.ts` (interaction subscription)

## Architecture

The application uses three real-time patterns, chosen based on RLS compatibility:

| Pattern                                 | Used For                                  | Module                                                            |
| --------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| **Broadcast API** (client-to-client)    | Mood updates, love notes, scripture state | `moodSyncService`, `useRealtimeMessages`, `useScriptureBroadcast` |
| **Broadcast API** (ephemeral presence)  | Partner reading position                  | `useScripturePresence`                                            |
| **postgres_changes** (server-to-client) | Incoming interactions (poke/kiss)         | `interactionService`, `realtimeService`                           |

**Why Broadcast for moods and scripture?** RLS policies on the `moods` table use partner subqueries that Supabase Realtime cannot evaluate for `postgres_changes`. Scripture channels use private Broadcast with `realtime.messages` RLS for authorization.

**Why postgres_changes for interactions?** The RLS policies on the interactions table are simple enough (`to_user_id = auth.uid()`) for Supabase Realtime to evaluate.

## RealtimeService (src/services/realtimeService.ts)

**Singleton export:** `realtimeService`

General-purpose channel management with Map-based tracking.

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

Removes a specific realtime channel from Supabase and the internal tracking Map.

---

### `unsubscribeAll()`

```typescript
async unsubscribeAll(): Promise<void>
```

Cleanup all active channels (component unmount / logout).

---

### `setErrorHandler(callback)`

```typescript
setErrorHandler(callback: ErrorCallback): void
```

Sets a global error handler for all subscriptions (used when no per-subscription handler is provided).

---

### `getActiveSubscriptions()`

```typescript
getActiveSubscriptions(): number
```

Returns count of active channels (for monitoring/debugging).

---

## Scripture Session Broadcast (useScriptureBroadcast.ts)

**Hook:** `useScriptureBroadcast(sessionId: string | null): void`

Manages subscription to the private broadcast channel `scripture-session:{sessionId}`. This is the **only** place in the codebase that creates a broadcast channel for scripture sessions.

### Channel Configuration

```typescript
supabase.channel(`scripture-session:${sessionId}`, {
  config: {
    broadcast: { self: false }, // Don't receive own broadcasts
    private: true, // Requires realtime.messages RLS authorization
  },
});
```

### Event Handlers

| Event                    | Payload Type                                 | Zustand Action                   | Description                             |
| ------------------------ | -------------------------------------------- | -------------------------------- | --------------------------------------- |
| `partner_joined`         | `{ user_id: string }`                        | `onPartnerJoined()`              | Partner connected/reconnected           |
| `state_updated`          | `StateUpdatePayload`                         | `onBroadcastReceived(payload)`   | Session state change from partner's RPC |
| `session_converted`      | `{ mode: 'solo', sessionId }`                | `applySessionConverted()`        | Partner converted session to solo mode  |
| `lock_in_status_changed` | `{ step_index, user1_locked, user2_locked }` | `onPartnerLockInChanged(locked)` | Partner locked/unlocked a step          |

### Lifecycle

1. **Auth setup:** Calls `supabase.realtime.setAuth()` then `supabase.auth.getUser()` to get user ID
2. **Subscribe:** On `SUBSCRIBED` status:
   - If reconnecting after error, resync state via `loadSession(sessionId)`
   - Wire `setBroadcastFn()` so Zustand slice actions can call `channel.send()` after RPC success
   - Broadcast `partner_joined` event with own user ID
3. **Error handling:** On `CHANNEL_ERROR` or `CLOSED`:
   - Set `hasErroredRef` flag
   - Remove channel and increment `retryCount` state to trigger re-subscribe via useEffect
   - Guard against retry storms with `isRetryingRef`
4. **Cleanup:** On unmount or sessionId change, clear `broadcastFn` and remove channel

### Client-Side Broadcast Pattern

After migration 21, all state broadcasts are sent from the client. The flow is:

1. Zustand action calls RPC (e.g., `scripture_lock_in`)
2. RPC returns JSONB snapshot
3. Zustand action calls `broadcastFn('state_updated', snapshot)` (or `'lock_in_status_changed'`)
4. `broadcastFn` calls `channel.send({ type: 'broadcast', event, payload })`
5. Partner's `useScriptureBroadcast` receives the event and dispatches to Zustand

### Reconnect Logic (Story 4.3)

On `CHANNEL_ERROR` or `CLOSED` status:

1. Set `hasErroredRef = true` to track that an error occurred
2. Guard: skip if `sessionIdFromStore` is null (session ended) or `isRetryingRef` is true (already retrying)
3. Set `isRetryingRef = true` to prevent retry storms
4. Call `supabase.removeChannel(channel)` to clean up the dead channel
5. Set `channelRef.current = null` so the useEffect guard passes on next run
6. Set `isRetryingRef = false`
7. Increment `retryCount` state, which triggers the useEffect to re-run and create a fresh channel
8. On successful `SUBSCRIBED` after error: check `hasErroredRef`, if true call `loadSession(sessionId)` to resync state, then reset `hasErroredRef`

The `removeChannel().catch()` path also resets refs and increments retry count to ensure the channel does not stay permanently broken even if cleanup fails.

### Lock-In User Detection

For `lock_in_status_changed`, the hook determines which lock field represents the partner:

```typescript
const isUser1 = currentUserId === sessionUserId; // user1_id
const partnerLocked = isUser1 ? msg.payload.user2_locked : msg.payload.user1_locked;
onPartnerLockInChanged(partnerLocked);
```

Uses refs (`identityRef`) to read the latest identity values without stale closures.

---

## Scripture Presence (useScripturePresence.ts)

**Hook:** `useScripturePresence(sessionId, stepIndex, view): PartnerPresenceInfo`

Manages an ephemeral broadcast channel `scripture-presence:{sessionId}` for partner position tracking during reading. Data is NOT stored in Zustand or IndexedDB -- purely local state.

### Return Type

```typescript
interface PartnerPresenceInfo {
  view: 'verse' | 'response' | null; // Which content panel partner is viewing
  stepIndex: number | null; // Which reading step partner is on
  ts: number | null; // Timestamp of last presence update
  isPartnerConnected: boolean; // Whether partner is active (not stale)
}
```

### Broadcast Behavior

| Trigger            | When                                                   |
| ------------------ | ------------------------------------------------------ |
| Channel subscribed | Immediately on `SUBSCRIBED` status                     |
| View change        | When user switches between verse and response          |
| Step change        | When step index changes (also resets partner presence) |
| Heartbeat          | Every 10 seconds via `setInterval`                     |

### Payload Format

```typescript
interface PresencePayload {
  user_id: string;
  step_index: number;
  view: 'verse' | 'response';
  ts: number; // Date.now()
}
```

### Stale Detection

- **TTL:** 20 seconds (`STALE_TTL_MS`)
- **Drop stale messages:** Incoming `presence_update` is dropped if `Date.now() - payload.ts > 20000`
- **Disconnect detection:** A `setTimeout` fires after 20 seconds of no updates, setting `isPartnerConnected: false` and `view: null`
- **Reset on each valid update:** The stale timer is cleared and restarted on every valid presence update

### Cleanup

On unmount: clears stale timer, heartbeat interval, and removes the channel.

---

## Love Notes Realtime (useRealtimeMessages.ts)

**Hook:** `useRealtimeMessages(options?): {}`

Subscribes to real-time love note delivery via Broadcast API.

### Configuration

```typescript
interface UseRealtimeMessagesOptions {
  onNewMessage?: (message: LoveNote) => void;
  enabled?: boolean; // Default: true
}
```

### Channel Setup

- **Channel name:** `love-notes:{currentUserId}`
- **Event:** `new_message`
- **Broadcast config:** Default (no `self: false` since sender uses partner's channel)

### Message Handling

1. Receive `new_message` broadcast payload
2. Call `addNote(message)` Zustand action (with built-in deduplication)
3. Trigger vibration feedback: `navigator.vibrate([30])` (AC-2.3.3)
4. Call optional `onNewMessage` callback

### Retry Logic

On `CHANNEL_ERROR` or `TIMED_OUT`:

| Config       | Value                      |
| ------------ | -------------------------- |
| `maxRetries` | 5                          |
| `baseDelay`  | 1000ms                     |
| `maxDelay`   | 30000ms                    |
| `backoff`    | Exponential (2^retryCount) |

Schedule: 1s, 2s, 4s, 8s, 16s (capped at 30s).

---

## Partner Mood Updates (usePartnerMood.ts)

**Hook:** `usePartnerMood(partnerId: string): UsePartnerMoodResult`

Loads initial partner mood and subscribes to real-time updates.

### Return Type

```typescript
interface UsePartnerMoodResult {
  partnerMood: SupabaseMoodRecord | null;
  isLoading: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  error: string | null;
}
```

### Flow

1. **Initial load:** `moodSyncService.getLatestPartnerMood(partnerId)` -- fetches most recent mood from Supabase
2. **Subscribe:** `moodSyncService.subscribeMoodUpdates()` -- listens on `mood-updates:{ownUserId}` Broadcast channel
3. **Filter:** Only updates from `partnerId` are applied (in case multiple subscriptions exist)
4. **Connection status:** Updated via `onStatusChange` callback (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`)

---

## Mood Broadcast Flow (moodSyncService)

1. User logs mood via `moodSyncService.syncMood()`
2. Mood is inserted into Supabase via `moodApi.create()`
3. `moodSyncService` looks up partner ID via `getPartnerId()`
4. Creates ephemeral channel `mood-updates:{partnerId}`
5. Broadcasts `{ type: 'broadcast', event: 'new_mood', payload: {...} }`
6. Removes the ephemeral channel immediately

**Receiving side:**

1. Partner calls `moodSyncService.subscribeMoodUpdates()`
2. This subscribes to `mood-updates:{ownUserId}` with `broadcast.self: false`
3. Callback fires when partner's broadcast arrives

---

## Interaction Realtime Flow (interactionService)

1. User calls `interactionService.sendPoke()` or `sendKiss()`
2. Row is inserted into `interactions` table
3. Partner's `subscribeInteractions()` picks up the INSERT via `postgres_changes` filtered by `to_user_id`
4. Callback fires with the new interaction record

---

## Channel Summary

| Channel Name                     | Type             | Private | Purpose                             | Managed By              |
| -------------------------------- | ---------------- | ------- | ----------------------------------- | ----------------------- |
| `scripture-session:{sessionId}`  | Broadcast        | Yes     | Session state sync between partners | `useScriptureBroadcast` |
| `scripture-presence:{sessionId}` | Broadcast        | Yes     | Ephemeral partner position tracking | `useScripturePresence`  |
| `love-notes:{userId}`            | Broadcast        | No      | Love note delivery to recipient     | `useRealtimeMessages`   |
| `mood-updates:{userId}`          | Broadcast        | No      | Partner mood notifications          | `moodSyncService`       |
| `incoming-interactions`          | postgres_changes | No      | Poke/kiss interaction notifications | `interactionService`    |
| `moods-{userId}`                 | postgres_changes | No      | Own mood changes (general)          | `realtimeService`       |
