# Realtime Features

## Overview

The app uses Supabase Realtime for live updates between partners. Two realtime patterns are employed:

1. **Broadcast API** -- Used for love notes, partner mood, and scripture sessions (the dominant pattern)
2. **postgres_changes** -- Used only for poke/kiss interactions, where the RLS filter is a simple column equality

Broadcast is preferred because RLS policies on `moods` use a partner-lookup subquery that Supabase Realtime cannot evaluate, so `postgres_changes` silently delivers nothing for those tables.

> **Architecture change (2026-07).** The `RealtimeService` class (`src/services/realtimeService.ts`) and the shared `subscribePrivateChannel()` helper (`src/api/realtimeChannel.ts`) were both **deleted**. There is no central subscription manager and no channel registry. Every feature now owns its own channel lifecycle inside the hook or service that needs it.

## Love Notes Realtime (`src/hooks/useRealtimeMessages.ts`)

Each user subscribes to a channel keyed by **their own** user id and receives messages the partner broadcasts to it.

```typescript
supabase
  .channel(`love-notes:${userId}`)
  .on('broadcast', { event: 'new_message' }, (payload) => {
    // payload.payload.message is a LoveNote row
  })
  .subscribe();
```

The sender side lives in `notesSlice.sendNote()`: after the row is inserted it opens `love-notes:{partnerId}`, waits for `SUBSCRIBED`, sends `new_message`, and removes the channel in a `finally`. Broadcast failure is non-fatal -- the note is already persisted.

### Features

- **Exponential backoff retry**: `RETRY_CONFIG` with `baseDelay * 2^retryCount`, clamped to `maxDelay`, up to `maxRetries`; the counter resets on a successful `SUBSCRIBED`
- **Vibration feedback**: calls `navigator.vibrate([30])` when a new message arrives
- **Connection state tracking**: exposes connected / disconnected / connecting
- **Cleanup**: clears the pending retry timeout, unsubscribes, and removes the channel on unmount

### Integration

`useLoveNotes` (`src/hooks/useLoveNotes.ts`) composes `useRealtimeMessages` with `NotesSlice`, handling auto-fetch on mount and preview-URL cleanup on unmount.

## Partner Mood Realtime (`src/hooks/usePartnerMood.ts`)

The hook delegates to `moodSyncService.subscribeMoodUpdates(callback, onStatusChange)` rather than opening a channel itself.

```typescript
supabase
  .channel(`mood-updates:${currentUserId}`, {
    config: { broadcast: { self: false } },
  })
  .on('broadcast', { event: 'new_mood' }, (payload) => { /* ... */ })
  .subscribe((status) => onStatusChange?.(status));
```

Note the channel is keyed by the **current** user id -- each user listens on their own channel, and the partner broadcasts into it from `moodSyncService.broadcastMoodToPartner()` after a successful sync (fire-and-forget; failures are logged, never thrown).

### Connection Status

`onStatusChange` maps the raw Supabase status into UI state: `SUBSCRIBED` → connected; `CHANNEL_ERROR` / `TIMED_OUT` → disconnected.

## Interaction Realtime (`src/api/interactionService.ts`)

Poke/kiss is the one feature that still uses `postgres_changes`, because `to_user_id=eq.{userId}` is a filter Realtime can evaluate directly.

```typescript
supabase
  .channel('incoming-interactions')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'interactions',
    filter: `to_user_id=eq.${userId}`,
  }, (payload) => callback(payload.new))
  .subscribe();
```

## Scripture Reading Realtime (`src/hooks/useScriptureBroadcast.ts`)

`useScriptureBroadcast` manages the private broadcast channel `scripture-session:{sessionId}` for together-mode sessions. This is the **only** place in the codebase that imports Supabase for scripture broadcast -- the slice is decoupled and receives a `broadcastFn` via `setBroadcastFn()`, stored in a module-level `broadcastFnRef`.

A second, separate channel `scripture-presence:{sessionId}` is owned by `useScripturePresence`. Never combine the two.

### Events

| Event                    | Payload                                                | Slice action                     |
| ------------------------ | ------------------------------------------------------ | -------------------------------- |
| `partner_joined`         | `{ user_id }`                                          | `onPartnerJoined()`              |
| `state_updated`          | `StateUpdatePayload` (phase, version, roles, ready, …) | `onBroadcastReceived(payload)`   |
| `session_converted`      | `{ mode: 'solo', sessionId }`                          | `applySessionConverted()`        |
| `lock_in_status_changed` | `{ step_index, user1_locked, user2_locked }`           | `onPartnerLockInChanged(locked)` |

### Version guard

`onBroadcastReceived` drops any payload whose `version <= session.version` **before** applying anything, so out-of-order or replayed broadcasts cannot roll state backwards.

### Broadcast nuke condition

The slice resets all session state **only** when `payload.triggered_by === 'end_session'`. Session completion uses a direct DB update rather than a broadcast, so a `currentPhase === 'complete'` broadcast does not trigger a reset.

### Client-side broadcast rule

All broadcasts originate from the client after a successful RPC. Server-side `PERFORM realtime.send()` was removed in migration `20260301000200_remove_server_side_broadcasts.sql` because it does not work in local Docker Supabase. Since channels are configured `self: false`, the broadcasting client must also apply the change to its own state -- see `lockIn()`, which updates the local session before broadcasting.

## Channel Summary

| Channel Pattern                  | Feature            | Protocol                  | Keyed by       | Direction     |
| -------------------------------- | ------------------ | ------------------------- | -------------- | ------------- |
| `love-notes:{userId}`            | Love Notes         | Broadcast                 | Recipient      | Bidirectional |
| `mood-updates:{userId}`          | Partner Mood       | Broadcast (`self: false`) | Recipient      | Bidirectional |
| `scripture-session:{sessionId}`  | Scripture state    | Broadcast (private, RLS)  | Session        | Bidirectional |
| `scripture-presence:{sessionId}` | Scripture presence | Broadcast (private, RLS)  | Session        | Bidirectional |
| `incoming-interactions`          | Poke/Kiss          | postgres_changes (INSERT) | `to_user_id`   | Receive only  |

## Supabase Client Configuration

The Supabase client is configured with a realtime rate limit:

```typescript
realtime: {
  params: {
    eventsPerSecond: 10,  // Rate limit for realtime events
  },
},
```

## Related Documentation

- [Architecture Patterns](./03-architecture-patterns.md)
- [API Layer](./08-api-layer.md)
- [Real-Time Subscriptions (API Reference)](../api-reference/12-real-time-subscriptions.md)
- [Scripture Reading Slice](../state-management/scripture-reading-slice.md)
