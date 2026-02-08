# Data Architecture

## Supabase Tables (PostgreSQL with Row Level Security)

All tables enforce RLS policies that restrict access to the two partner users only.

| Table | Purpose | Key Columns | Relationships |
|---|---|---|---|
| `users` | User profiles | `id`, `email`, `display_name`, `partner_id`, `partner_name`, `device_id` | Self-referential (`partner_id` -> `users.id`) |
| `partner_requests` | Partner pairing workflow | `id`, `from_user_id`, `to_user_id`, `status` | FK to `users` (both directions) |
| `moods` | Daily mood entries | `id`, `user_id`, `mood_type`, `mood_types[]`, `note`, `created_at` | FK to `users` |
| `interactions` | Partner interactions | `id`, `from_user_id`, `to_user_id`, `type`, `viewed` | FK to `users` (both directions) |
| `love_notes` | Real-time chat messages | `id`, `from_user_id`, `to_user_id`, `content`, `image_url` | - |
| `photos` | Photo metadata | `id`, `user_id`, `filename`, `storage_path`, `caption`, `width`, `height`, `file_size`, `mime_type` | - |
| `scripture_sessions` | Reading session state | `id`, `mode`, `user1_id`, `user2_id`, `current_phase`, `current_step_index`, `status`, `version`, `snapshot_json` | - |
| `scripture_reflections` | Per-step reflection data | `id`, `session_id`, `step_index`, `user_id`, `rating` (1-5), `notes`, `is_shared` | FK to `scripture_sessions` |
| `scripture_bookmarks` | Step bookmarks | `id`, `session_id`, `step_index`, `user_id`, `share_with_partner` | FK to `scripture_sessions` |
| `scripture_messages` | Daily prayer report messages | `id`, `session_id`, `sender_id`, `message` | FK to `scripture_sessions` |
| `scripture_step_states` | Step advancement tracking | `id`, `session_id`, `step_index`, `user1_locked_at`, `user2_locked_at`, `advanced_at` | FK to `scripture_sessions` |

**Supabase RPC Functions:**
- `scripture_create_session(p_mode, p_partner_id?)` - Create a new scripture reading session
- `accept_partner_request(p_request_id)` - Accept a partner pairing request
- `decline_partner_request(p_request_id)` - Decline a partner pairing request
- `is_scripture_session_member(p_session_id)` - Check session membership for RLS
- `scripture_seed_test_data(...)` - Test data seeding (development only)

**Supabase Enums:**
- `scripture_session_mode`: `solo`, `together`
- `scripture_session_phase`: `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete`
- `scripture_session_status`: `pending`, `in_progress`, `complete`, `abandoned`

## IndexedDB Schema (Local Storage)

Database: `my-love-db`, current version: **5**

| Store | Key Type | Value Type | Indexes | Purpose |
|---|---|---|---|---|
| `messages` | auto-increment `number` | `Message` | `by-category` (string), `by-date` (Date) | Custom and default love messages |
| `photos` | auto-increment `number` | `Photo` (includes Blob) | `by-date` (Date) | Photo binary data + metadata |
| `moods` | auto-increment `number` | `MoodEntry` | `by-date` (string, unique) | Mood entries with sync status |
| `sw-auth` | `'current'` literal | `StoredAuthToken` | None | Auth token for Service Worker Background Sync |
| `scripture-sessions` | UUID `string` | `ScriptureSession` | `by-user` (string) | Offline scripture session cache |
| `scripture-reflections` | UUID `string` | `ScriptureReflection` | `by-session` (string) | Offline reflection cache |
| `scripture-bookmarks` | UUID `string` | `ScriptureBookmark` | `by-session` (string) | Offline bookmark cache |
| `scripture-messages` | UUID `string` | `ScriptureMessage` | `by-session` (string) | Offline message cache |

**Migration History:**
- v1: `messages` store
- v2: `photos` store (enhanced schema with compression metadata, replaces v1 photos)
- v3: `moods` store with unique `by-date` index
- v4: `sw-auth` store for Service Worker Background Sync
- v5: Scripture reading stores (`sessions`, `reflections`, `bookmarks`, `messages`)

All migrations are handled in `dbSchema.ts` via a centralized `upgradeDb()` function.

## localStorage (Zustand Hydration)

Key: `my-love-storage`

Only small, critical state is persisted to localStorage via Zustand's `persist` middleware:

- `settings` - Theme, notifications, relationship configuration
- `isOnboarded` - First-run flag
- `messageHistory` - Date-to-message-ID mapping (Map serialized as Array)
- `moods` - Mood entries (duplicated here for fast hydration, synced from IndexedDB)

**Not persisted to localStorage** (loaded from IndexedDB on init):
- `messages` - Full message list
- `customMessages` - User-created messages
- `photos` - Photo data (too large)

---
