# 12. Real-Time Subscriptions

**Sources:**
- `src/services/realtimeService.ts` -- General-purpose postgres_changes subscriptions
- `src/api/moodSyncService.ts` -- Broadcast API for mood updates
- `src/api/interactionService.ts` -- postgres_changes for interactions
- `src/api/realtimeChannel.ts` -- Private channel auth helper

## Patterns Used

### 1. Broadcast API (client-to-client)
Used for **mood updates** because RLS policies on moods table prevent `postgres_changes` from working (complex subquery for partner lookup cannot be evaluated by Realtime).

- Channel: `mood-updates:{userId}` -- each user subscribes to their own channel
- Partner broadcasts to this channel after logging a mood
- Config: `{ broadcast: { self: false } }` to avoid receiving own messages
- Ephemeral channels: sender creates, sends, then removes

### 2. postgres_changes (database-triggered)
Used for **interactions** where RLS filter is simple (`to_user_id=eq.{userId}`).

- Channel: `incoming-interactions`
- Events: `INSERT` on `interactions` table
- Filter: `to_user_id=eq.{userId}`

### 3. Private Broadcast Channels (scripture sessions)
Used for **scripture reading** together-mode synchronization.

- Channel: `scripture-session:{sessionId}` -- private, requires RLS on `realtime.messages`
- Events: `state_updated`, `lock_in_status_changed`, `session_converted`
- Channel: `scripture-presence:{sessionId}` -- presence tracking

## RealtimeService Class

General-purpose subscription manager. Singleton: `realtimeService`.

### `subscribeMoodChanges(userId, onMoodChange, onError?): string`
Creates `postgres_changes` subscription for `*` events on moods table filtered by `user_id`. Returns channel ID.

### `unsubscribe(channelId): Promise<void>`
Removes a specific channel.

### `unsubscribeAll(): Promise<void>`
Removes all active channels.

### `setErrorHandler(callback): void`
Sets global error handler for all subscriptions.

### `getActiveSubscriptions(): number`
Returns count of active channels.

## Private Channel Helper (`realtimeChannel.ts`)

### `subscribePrivateChannel({ onReady, onError }): void`
Authenticates Realtime connection (`supabase.realtime.setAuth()`), gets user, then calls `onReady(userId)`. Used by scripture broadcast/presence hooks.

## RLS on realtime.messages

Private channels require RLS policies on `realtime.messages` table:
- `scripture-session:%` topics: SELECT/INSERT for session members
- `scripture-presence:%` topics: SELECT/INSERT for session members
- Policy checks `split_part(topic, ':', 2)::uuid` against `scripture_sessions` membership
