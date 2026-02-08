# Real-time Features

All real-time functionality uses Supabase Realtime (WebSocket-based Postgres Changes).

| Feature | Channel Pattern | Table | Events | Callback |
|---|---|---|---|---|
| Partner Mood | `moods:{userId}` | `moods` | INSERT, UPDATE, DELETE | Updates partner mood display |
| Love Notes | Custom channel | `love_notes` | INSERT | Appends new messages to chat |
| Interactions | Subscription in hook | `interactions` | INSERT | Shows poke/kiss/fart notification |

**RealtimeService** (`services/realtimeService.ts`) manages channel lifecycle:
- Tracks active channels in a `Map<string, RealtimeChannel>`
- Prevents duplicate subscriptions
- Provides `unsubscribeAll()` for cleanup
- Error handling with local and global callbacks
- Rate limited to 10 events per second via Supabase client config

---
