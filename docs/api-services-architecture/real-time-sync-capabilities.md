# Real-time Sync Capabilities

## Real-time Architecture

```
Supabase Realtime (WebSocket)
  ↓
Listens to postgres_changes events
  ↓
Filters by schema, table, user_id
  ↓
Broadcasts INSERT/UPDATE/DELETE events
  ↓
Client subscriptions receive events
  ↓
Callbacks update local state
```

## Partner Mood Updates (Real-time)

```
User A logs mood (INSERT into moods table)
  ↓
Postgres trigger detects change
  ↓
Realtime broadcasts INSERT event
  ↓
User B's subscription receives event
  ↓
moodSyncService.subscribeMoodUpdates() callback fires
  ↓
UI updates: new mood visible, notification shown
```

## Interaction Updates (Real-time)

```
User A sends poke/kiss (INSERT into interactions)
  ↓
Realtime broadcasts INSERT event
  ↓
User B receives via interactionService.subscribeInteractions()
  ↓
Callback triggers: animation, notification, badge update
```

## Subscription Management

```typescript
// Subscribe
const unsubscribe = await interactionService.subscribeInteractions((interaction) => {
  // Update UI with new interaction
  showNotification(`Received ${interaction.type}`);
});

// When component unmounts or user signs out
unsubscribe();
```

---
