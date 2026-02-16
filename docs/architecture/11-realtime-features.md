# Realtime Features

## Overview

The app uses Supabase Realtime for live updates between partners. Two realtime patterns are employed:

1. **Broadcast API** -- Used for love notes and partner mood updates (preferred pattern)
2. **postgres_changes** -- Used for mood realtime updates (legacy pattern)

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
  useRealtimeMessages(partnerId);  // Realtime subscription
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
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table,
      filter,
    }, callback);
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
