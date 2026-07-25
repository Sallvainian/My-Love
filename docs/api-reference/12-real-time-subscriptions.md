# 12. Real-Time Subscriptions

**Sources:**

- `src/api/moodSyncService.ts` -- Broadcast API for mood updates
- `src/api/interactionService.ts` -- `postgres_changes` for interactions
- `src/stores/slices/notesSlice.ts` -- Broadcast API for love notes
- `src/hooks/useScriptureBroadcast.ts` -- Private broadcast channel for scripture sessions
- `src/hooks/useScripturePresence.ts` -- Ephemeral presence channel for scripture sessions
- `src/hooks/useRealtimeMessages.ts` -- Love notes subscriber hook

> **Architecture change since the 2026-03 scan.** The general-purpose `src/services/realtimeService.ts` and the `src/api/realtimeChannel.ts` private-channel helper were **deleted**. There is no longer a central subscription manager. Each feature owns its own channel lifecycle, and `supabase.realtime.setAuth()` is now called inline by the hook that needs it.

## Patterns Used

### 1. Broadcast API (client-to-client)

Used for **mood updates** because RLS policies on the `moods` table prevent `postgres_changes` from working (the partner-lookup subquery cannot be evaluated by Realtime).

- Channel: `mood-updates:{userId}` -- each user subscribes to **their own** channel
- Partner broadcasts to that channel after logging a mood
- Config: `{ broadcast: { self: false } }` so a client never receives its own message
- Ephemeral send path: sender creates a channel, subscribes, sends, then `removeChannel()` in a `finally`

Also used for **love notes**: `notesSlice.sendNote()` broadcasts `new_message` on `love-notes:{partnerId}` after a successful insert. The channel must be subscribed before `send()` to avoid the REST-fallback deprecation warning; failure is non-fatal (the row is already persisted).

### 2. postgres_changes (database-triggered)

Used for **interactions**, where the RLS filter is simple.

- Channel: `incoming-interactions`
- Event: `INSERT` on the `interactions` table
- Filter: `to_user_id=eq.{userId}`

### 3. Private Broadcast Channels (scripture Together Mode)

Two **separate** channels per session. Never combine them.

| Channel                          | Purpose                        | Events                                                                        |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `scripture-session:{sessionId}`  | Durable session state          | `partner_joined`, `state_updated`, `session_converted`, `lock_in_status_changed` |
| `scripture-presence:{sessionId}` | Ephemeral position / heartbeat | `presence_update`                                                              |

## useScriptureBroadcast (`src/hooks/useScriptureBroadcast.ts`)

`useScriptureBroadcast(sessionId: string | null): void`

The **only** place in the codebase that imports `supabase` for Broadcast. Do not import supabase for broadcast in components or other hooks.

**Event → slice action routing:**

| Broadcast event          | Slice action                       |
| ------------------------ | ---------------------------------- |
| `partner_joined`         | `onPartnerJoined()`                |
| `state_updated`          | `onBroadcastReceived(payload)`     |
| `session_converted`      | `applySessionConverted()`          |
| `lock_in_status_changed` | `onPartnerLockInChanged(locked)`   |

**Lifecycle details:**

- Calls `channel.setAuth()` before subscribing -- the handshake needs a fresh token, not just a cached user ID
- Wires `setBroadcastFn` into the scripture slice so slice actions can call `channel.send()` (the module-level `broadcastFnRef`); cleared to `null` on cleanup
- On subscribe, announces itself by broadcasting `partner_joined`
- Duplicate-subscribe guard: checks `channelRef.current?.state === 'subscribed'` to survive React StrictMode double-mount
- Auto-retry on `CHANNEL_ERROR` / `CLOSED` by incrementing a `retryCount` state variable (max `MAX_BROADCAST_RETRIES = 5`), which re-runs the effect; after re-subscribe, `loadSession` resyncs state from the DB
- Cleanup: `supabase.removeChannel(channel)` on `sessionId` change or unmount

### Client-side broadcast rule

All Realtime broadcasts are sent **from the client** via `channel.send()` after a successful RPC call. Server-side `PERFORM realtime.send()` was removed in migration `20260301000200_remove_server_side_broadcasts.sql` because it does not work in local Docker Supabase. RPCs mutate DB state; the calling client broadcasts the resulting snapshot.

Because channels are configured `self: false`, the broadcasting client must also apply the state change locally -- see `lockIn()` in the scripture slice, which updates its own session before broadcasting `state_updated`.

## useScripturePresence (`src/hooks/useScripturePresence.ts`)

Returns `{ view, stepIndex, ts, isPartnerConnected }`.

- Purely **local** React state -- never stored in Zustand or IndexedDB
- Heartbeat broadcast every 10s on `scripture-presence:{sessionId}`
- Presence older than a 20s stale TTL is silently dropped
- Same `setAuth()` + retry + StrictMode guard pattern as the broadcast hook

## RLS on `realtime.messages`

Private channels require RLS policies on the `realtime.messages` table:

- `scripture-session:%` topics -- SELECT/INSERT for session members
- `scripture-presence:%` topics -- SELECT/INSERT for session members
- Policies resolve membership by parsing the topic: `split_part(topic, ':', 2)::uuid` checked against `scripture_sessions` via `is_scripture_session_member()`
