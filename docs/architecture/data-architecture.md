# Data Architecture

## Dual Storage Model

The application uses two complementary storage layers:

| Layer | Technology | Purpose | Data |
|---|---|---|---|
| **Cloud** | Supabase (PostgreSQL) | Source of truth, cross-device sync | Moods, photos, love notes, interactions, scripture sessions |
| **Local (large)** | IndexedDB (`my-love-db`) | Offline storage, background sync queue | Messages, moods, photos, auth tokens |
| **Local (small)** | localStorage (`my-love-storage`) | Fast hydration, Zustand persist | Settings, onboarding state, message history map |

## Supabase Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `moods` | Mood tracking entries | `user_id`, `mood_type`, `mood_types[]`, `note`, `created_at` |
| `photos` | Photo metadata | `user_id`, `storage_path`, `caption`, `tags[]`, `created_at` |
| `love_notes` | Chat messages | `from_user_id`, `to_user_id`, `content`, `image_url`, `created_at` |
| `interactions` | Poke/kiss events | `from_user_id`, `to_user_id`, `type`, `viewed`, `created_at` |
| `partner_requests` | Partner connection requests | `from_user_id`, `to_user_id`, `status` |
| `profiles` | User display names | `id`, `display_name`, `email` |
| `scripture_sessions` | Reading sessions | `user1_id`, `mode`, `current_phase`, `current_step_index`, `status` |
| `scripture_reflections` | Step reflections | `session_id`, `step_index`, `rating`, `notes`, `is_shared` |
| `scripture_bookmarks` | Verse bookmarks | `session_id`, `step_index`, `share_with_partner` |
| `scripture_messages` | In-session messages | `session_id`, `sender_id`, `message` |

All tables enforce Row Level Security (RLS) restricting access to authenticated partner pairs.

## IndexedDB Schema (`my-love-db`)

Managed via `src/services/dbSchema.ts`. Current version: **4**.

| Store | Key | Indexes | Purpose |
|---|---|---|---|
| `messages` | `id` (autoIncrement) | `by-category`, `by-date` | Default + custom love messages |
| `photos` | `id` (autoIncrement) | `by-date` | Local photo blobs (legacy) |
| `moods` | `id` (autoIncrement) | `by-date` (unique) | Mood entries with `synced` flag |
| `sw-auth` | `id` (fixed: `'current'`) | none | Auth token for Service Worker background sync |

### Migration History

```
v0 -> v1: Add messages store
v1 -> v2: Add photos store
v2 -> v3: Add moods store
v3 -> v4: Add sw-auth store for Background Sync
```

The Service Worker (`sw-db.ts`) independently handles these migrations because it must be self-sufficient when the app window is closed.

## localStorage Keys

| Key | Content | Managed By |
|---|---|---|
| `my-love-storage` | Zustand persisted state (JSON) | Zustand persist middleware |
| `lastWelcomeView` | Timestamp of last welcome splash display | `App.tsx` |
| `sb-*` | Supabase auth session tokens | `@supabase/supabase-js` |

### Zustand Persisted State Shape

Controlled by `partialize` in `useAppStore.ts`:

```typescript
partialize: (state) => ({
  settings: state.settings,        // Theme, relationship config
  isOnboarded: state.isOnboarded,  // Onboarding flag
  messageHistory: {                // Message rotation history
    ...state.messageHistory,
    shownMessages: Array.from(state.messageHistory.shownMessages.entries()),
  },
  moods: state.moods,              // Local mood entries
})
```

**NOT persisted** (runtime or loaded from IndexedDB/Supabase):
- `messages` -- loaded from IndexedDB on init
- `currentMessage` -- computed from messages + history
- `customMessages` -- loaded from IndexedDB on demand
- `photos` -- loaded from Supabase on demand
- `notes` -- loaded from Supabase on demand
- `interactions` -- loaded from Supabase on demand
- `isLoading`, `error` -- transient UI state

## Sync Strategy

### Mood Sync (Hybrid 3-Layer)

1. **Immediate sync** (`moodSlice`): On mood creation, if online, sync to Supabase immediately
2. **Periodic sync** (`App.tsx`): Every 5 minutes while app is open, sync any pending moods
3. **Background Sync** (`sw.ts`): Service Worker syncs pending moods when browser regains connectivity, even if app is closed

### Love Notes

- **Write**: Direct Supabase insert, then Broadcast to partner's channel
- **Read**: Fetch from Supabase `love_notes` table with conversation filter
- **Realtime**: `useRealtimeMessages` subscribes to `love-notes:{userId}` Broadcast channel

### Photos

- **Upload**: Compress via Canvas API, upload to Supabase Storage bucket `love-notes-images`
- **Read**: Fetch metadata from `photos` table, get signed URLs for display
- **No offline storage**: Photos require network

### Message History Map Serialization

The `shownMessages` field uses a `Map<string, number>` (date -> message ID). Since JSON cannot serialize Maps, it is converted to an array of entries during `partialize` and deserialized back to a Map in `onRehydrateStorage`.
