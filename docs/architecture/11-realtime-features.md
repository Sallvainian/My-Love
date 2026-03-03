# Realtime Features

## Overview

The app uses Supabase Realtime for live updates between partners. Three realtime patterns are employed:

1. **Broadcast API** -- Used for love notes, partner mood updates, and scripture session events (preferred pattern)
2. **Presence API** -- Used for scripture together-mode position tracking (heartbeat + stale detection)
3. **postgres_changes** -- Used for poke/kiss interaction notifications (INSERT events)

## Love Notes Realtime (`src/hooks/useRealtimeMessages.ts`)

The `useRealtimeMessages` hook establishes a Supabase Broadcast channel for live love note delivery:

```typescript
const channel = supabase.channel(`love-notes:${partnerId}`, {
  config: { broadcast: { self: true } },
});

channel
  .on('broadcast', { event: 'new_note' }, (payload) => {
    // Handle incoming love note
  })
  .subscribe();
```

### Features

- **Exponential backoff retry**: On connection failure, retries with delays of 1s, 2s, 4s, 8s, 16s (max 30s), up to 5 retries
- **Vibration feedback**: Calls `navigator.vibrate()` when a new message arrives (via `useVibration` hook)
- **Connection state tracking**: Tracks `connected`, `disconnected`, and `connecting` states
- **Cleanup**: Unsubscribes and removes channel on component unmount

### Integration

The `useLoveNotes` hook (`src/hooks/useLoveNotes.ts`) composes `useRealtimeMessages` with the NotesSlice store:

```typescript
export function useLoveNotes() {
  const store = useAppStore();
  useRealtimeMessages(partnerId); // Realtime subscription
  // ... auto-fetch on mount, cleanup on unmount
}
```

## Partner Mood Realtime (`src/hooks/usePartnerMood.ts`)

The `usePartnerMood` hook uses Supabase Broadcast to receive partner mood updates in real time:

```typescript
const channel = supabase.channel(`partner-mood:${partnerId}`);
channel.on('broadcast', { event: 'mood_update' }, (payload) => {
  // Update partner mood in state
});
```

### Connection Status

The hook tracks connection status and exposes it for UI display:

- `connected` -- Channel is active and receiving
- `disconnected` -- Channel is closed or failed
- `connecting` -- Channel is establishing connection

## Mood Realtime Service (`src/services/realtimeService.ts`)

The `RealtimeService` class manages realtime subscriptions for mood updates using the legacy `postgres_changes` pattern:

```typescript
class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribe(table: string, filter: string, callback: Function) {
    const channel = supabase.channel(`${table}:${filter}`);
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table,
        filter,
      },
      callback
    );
    channel.subscribe();
    this.channels.set(channelKey, channel);
  }

  unsubscribe(channelKey: string) {
    const channel = this.channels.get(channelKey);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelKey);
    }
  }
}
```

The `channels` Map tracks active subscriptions for cleanup.

## Interaction Realtime (`src/api/interactionService.ts`)

Poke/kiss interactions use realtime subscriptions to notify the partner immediately:

```typescript
subscribeToInteractions(callback) {
  const channel = supabase.channel('interactions');
  channel.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'interactions',
  }, callback);
  channel.subscribe();
}
```

## Scripture Realtime (Epic 4)

### Broadcast (`src/hooks/useScriptureBroadcast.ts`)

Manages broadcast channel `scripture-session:{sessionId}` for together-mode scripture reading sessions. Events:

| Event                    | Purpose                                      |
|--------------------------|----------------------------------------------|
| `partner_joined`         | Partner joined the session                   |
| `state_updated`          | Session state changed (step, phase)          |
| `session_converted`      | Solo session converted to together-mode      |
| `lock_in_status_changed` | Partner locked/unlocked their reading step   |

### Presence (`src/hooks/useScripturePresence.ts`)

Presence channel `scripture-presence:{sessionId}` tracks partner online status:

- **Heartbeat**: Every 10 seconds
- **Stale TTL**: 20 seconds (partner marked as offline if no heartbeat received)
- **Tracked state**: `{ userId, currentStep, phase, lastSeen }`

## Reconnect Logic (Epic 4 Hardening)

All realtime channels implement reconnect logic for `CHANNEL_ERROR` and `CLOSED` states:

```typescript
// Pattern used in useScriptureBroadcast and useScripturePresence
channel.on('system', {}, (payload) => {
  if (payload.status === 'CHANNEL_ERROR' || payload.status === 'CLOSED') {
    supabase.removeChannel(channel);  // Clean up dead channel
    setRetryCount((c) => c + 1);       // Trigger useEffect re-run for re-subscribe
  }
});
```

On re-subscribe success, `loadSession()` is called to resync state from Supabase, ensuring the UI reflects the latest data after a reconnection gap.

**Reconnect strategies by feature:**

| Hook                     | Max Retries | Backoff          | On Reconnect        |
|--------------------------|-------------|------------------|---------------------|
| `useScriptureBroadcast`  | Unlimited   | useEffect re-run | `loadSession()`     |
| `useScripturePresence`   | Unlimited   | useEffect re-run | Presence re-track   |
| `useRealtimeMessages`    | 5           | 1s-30s exponential | Channel re-subscribe |

## Channel Summary

| Channel Pattern | Feature | Protocol | Direction |
|----------------|---------|----------|-----------|
| `love-notes:{partnerId}` | Love Notes | Broadcast | Bidirectional |
| `partner-mood:{partnerId}` | Partner Mood | Broadcast | Bidirectional |
| `scripture-session:{sessionId}` | Scripture Together-Mode | Broadcast | Bidirectional |
| `scripture-presence:{sessionId}` | Scripture Presence | Presence | Bidirectional |
| `incoming-interactions` | Poke/Kiss | postgres_changes (INSERT) | Receive only |

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
- [State Management - Slice Details](../state-management/02-slice-details.md)
