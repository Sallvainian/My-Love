# Real-Time Features

## Overview

All real-time functionality uses the **Supabase Broadcast API** (WebSocket-based), not `postgres_changes`. This decision was made after discovering that `postgres_changes` does not reliably deliver cross-user updates. Broadcast provides consistent, user-specific messaging channels.

## Architecture

```
Sender                          Supabase                        Receiver
  |                                |                               |
  |-- insert to love_notes ------->|                               |
  |-- subscribe to partner channel |                               |
  |-- send broadcast event ------->|                               |
  |                                |-- deliver to channel -------->|
  |                                |                               |-- addNote()
  |                                |                               |-- vibration feedback
  |-- unsubscribe + cleanup        |                               |
```

## Love Notes Realtime (`useRealtimeMessages`)

### Channel Pattern

Each user has a dedicated Broadcast channel named `love-notes:{userId}`:

```typescript
const channel = supabase
  .channel(`love-notes:${userId}`)
  .on('broadcast', { event: 'new_message' }, (payload) => {
    handleNewMessage(payload);
  })
  .subscribe();
```

### Sending Flow (in `notesSlice.sendNote`)

After a successful Supabase insert, the sender broadcasts to the partner's channel:

```typescript
const channel = supabase.channel(`love-notes:${partnerId}`);

await new Promise<void>((resolve, reject) => {
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: { message: data },
      });
      resolve();
      await supabase.removeChannel(channel);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      await supabase.removeChannel(channel);
      reject(new Error(`Channel subscription failed: ${status}`));
    }
  });
});
```

Broadcast failure is non-fatal -- the message is already saved in Supabase, so the partner will see it on next fetch.

### Receiving Flow (`src/hooks/useRealtimeMessages.ts`)

The `useRealtimeMessages` hook manages the subscription lifecycle:

```typescript
export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
  const { onNewMessage, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const addNote = useAppStore((state) => state.addNote);

  const handleNewMessage = useCallback((payload) => {
    const { message } = payload.payload;
    addNote(message);           // Add to store with deduplication
    navigator.vibrate?.([30]);   // Haptic feedback
    onNewMessage?.(message);     // Optional callback
  }, [addNote, onNewMessage]);

  // Setup and cleanup in useEffect...
}
```

### Retry Configuration

Subscription failures use exponential backoff:

```typescript
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,    // 1 second
  maxDelay: 30000,    // 30 seconds cap
};

// Delay = min(baseDelay * 2^retryCount, maxDelay)
// Retry 0: 1s, Retry 1: 2s, Retry 2: 4s, Retry 3: 8s, Retry 4: 16s
```

On `CHANNEL_ERROR` or `TIMED_OUT`, the hook retries with backoff until `maxRetries` is reached.

### Deduplication

The `addNote` action in `notesSlice` prevents duplicate messages:

```typescript
addNote: (note) => {
  set((state) => {
    const exists = state.notes.some((n) => n.id === note.id);
    if (exists) return state; // No change
    return { notes: [...state.notes, note] };
  });
},
```

This handles the case where a message arrives via both Broadcast and the initial fetch.

## Mood Realtime (`usePartnerMood`)

Partner mood updates are delivered via Broadcast from the mood sync service:

```typescript
// In moodSyncService.ts - after mood upload
const channel = supabase.channel(`mood-updates:${partnerId}`);
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.send({
      type: 'broadcast',
      event: 'mood_updated',
      payload: { mood: uploadedMood },
    });
    await supabase.removeChannel(channel);
  }
});
```

The `usePartnerMood` hook subscribes to the current user's mood-updates channel and refreshes partner mood data on receipt.

## Interaction Realtime (`interactionsSlice`)

Poke and kiss interactions use a subscription-based model:

```typescript
subscribeToInteractions: async () => {
  const userId = await getCurrentUserId();
  const channel = supabase
    .channel(`interactions:${userId}`)
    .on('broadcast', { event: 'new_interaction' }, (payload) => {
      get().addIncomingInteraction(payload.payload);
    })
    .subscribe();
};
```

Incoming interactions are deduplicated by ID before being added to the store.

## Channel Cleanup

All realtime subscriptions include cleanup logic:

```typescript
// In useRealtimeMessages
return () => {
  subscriptionActive = false;
  if (retryTimeoutRef.current) {
    clearTimeout(retryTimeoutRef.current);
  }
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }
  retryCountRef.current = 0;
};
```

Ephemeral send channels (used in `sendNote`) are cleaned up immediately after the broadcast completes or fails.

## Summary of Channels

| Channel Pattern | Direction | Event | Purpose |
|---|---|---|---|
| `love-notes:{userId}` | Receiver listens | `new_message` | Love note delivery |
| `mood-updates:{userId}` | Receiver listens | `mood_updated` | Partner mood sync |
| `interactions:{userId}` | Receiver listens | `new_interaction` | Poke/kiss delivery |

All channels are user-specific to ensure messages reach only the intended recipient.
