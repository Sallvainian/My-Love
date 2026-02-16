# 2. Table Details

## 2.1 `users`

User profiles. Each row is linked 1:1 with a Supabase Auth user.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | -- | PK, FK to `auth.users(id)` ON DELETE CASCADE |
| `partner_name` | TEXT | Yes | -- | -- |
| `device_id` | UUID | Yes | `gen_random_uuid()` | -- |
| `email` | TEXT | Yes | -- | -- |
| `display_name` | TEXT | Yes | -- | -- |
| `partner_id` | UUID | Yes | -- | FK to `users(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | Yes | `now()` | -- |
| `updated_at` | TIMESTAMPTZ | Yes | `now()` | -- |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_users_partner` | `partner_id` | btree |
| `idx_users_display_name_search` | `lower(display_name)` | btree |
| `idx_users_email_search` | `lower(email)` | btree |

---

## 2.2 `moods`

Mood tracking entries. Supports both a single primary mood and an array of multiple moods.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `user_id` | UUID | No | -- | FK to `users(id)` ON DELETE CASCADE |
| `mood_type` | TEXT | No | -- | CHECK: must be one of 12 mood values |
| `mood_types` | TEXT[] | Yes | NULL | CHECK: all elements must be valid mood values |
| `note` | TEXT | Yes | -- | CHECK: `char_length(note) <= 500` |
| `created_at` | TIMESTAMPTZ | Yes | `now()` | -- |
| `updated_at` | TIMESTAMPTZ | Yes | `now()` | -- |

**Valid mood values:** `loved`, `happy`, `content`, `excited`, `thoughtful`, `grateful`, `sad`, `anxious`, `frustrated`, `angry`, `lonely`, `tired`

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_moods_user_created` | `(user_id, created_at DESC)` | btree |

---

## 2.3 `love_notes`

Messages sent between partners. Supports optional image attachments stored in the `love-notes-images` bucket.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `from_user_id` | UUID | No | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `to_user_id` | UUID | No | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `content` | TEXT | No | -- | CHECK: `char_length(content) BETWEEN 1 AND 1000` |
| `image_url` | TEXT | Yes | -- | Storage path in `love-notes-images` bucket |
| `created_at` | TIMESTAMPTZ | No | `now()` | -- |

**Constraints:**

| Name | Rule |
|---|---|
| `different_users` | `from_user_id <> to_user_id` |
| `love_notes_content_check` | `char_length(content) >= 1 AND char_length(content) <= 1000` |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_love_notes_from_user_created` | `(from_user_id, created_at DESC)` | btree |
| `idx_love_notes_to_user_created` | `(to_user_id, created_at DESC)` | btree |

---

## 2.4 `interactions`

Quick interactions (poke, kiss) between partners with read tracking.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `type` | TEXT | No | -- | CHECK: `type IN ('poke', 'kiss')` |
| `from_user_id` | UUID | No | -- | FK to `users(id)` ON DELETE CASCADE |
| `to_user_id` | UUID | No | -- | FK to `users(id)` ON DELETE CASCADE |
| `viewed` | BOOLEAN | Yes | `false` | -- |
| `created_at` | TIMESTAMPTZ | Yes | `now()` | -- |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_interactions_from_user` | `from_user_id` | btree |
| `idx_interactions_to_user_viewed` | `(to_user_id, viewed)` | btree |

---

## 2.5 `partner_requests`

Partnership invitation workflow. Only one pending request is allowed per user pair.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `from_user_id` | UUID | No | -- | FK to `users(id)` ON DELETE CASCADE |
| `to_user_id` | UUID | No | -- | FK to `users(id)` ON DELETE CASCADE |
| `status` | TEXT | No | `'pending'` | CHECK: `status IN ('pending', 'accepted', 'declined')` |
| `created_at` | TIMESTAMPTZ | No | `now()` | -- |
| `updated_at` | TIMESTAMPTZ | No | `now()` | -- |

**Constraints:**

| Name | Rule |
|---|---|
| `no_self_requests` | `from_user_id <> to_user_id` |
| `partner_requests_status_check` | `status IN ('pending', 'accepted', 'declined')` |

**Indexes:**

| Index | Columns | Type | Notes |
|---|---|---|---|
| `idx_partner_requests_to_user_pending` | `(to_user_id, status)` | btree | -- |
| `idx_partner_requests_unique` | `(from_user_id, to_user_id)` | btree, unique | WHERE `status = 'pending'` (partial) |

---

## 2.6 `photos`

Photo metadata. Actual image files are stored in the `photos` Supabase Storage bucket.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `user_id` | UUID | No | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `storage_path` | TEXT | No | -- | UNIQUE |
| `filename` | TEXT | No | -- | -- |
| `caption` | TEXT | Yes | -- | CHECK: `char_length(caption) <= 500` |
| `mime_type` | TEXT | No | `'image/jpeg'` | CHECK: `mime_type IN ('image/jpeg', 'image/png', 'image/webp')` |
| `file_size` | INTEGER | No | -- | -- |
| `width` | INTEGER | No | -- | -- |
| `height` | INTEGER | No | -- | -- |
| `created_at` | TIMESTAMPTZ | No | `now()` | -- |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_photos_user_created` | `(user_id, created_at DESC)` | btree |
| `idx_photos_storage_path` | `storage_path` | btree |

---

## 2.7 `scripture_sessions`

A scripture reading session. Tracks the current phase, step, and session status. Supports solo and together (paired) modes.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `mode` | `scripture_session_mode` | No | -- | ENUM: `solo`, `together` |
| `user1_id` | UUID | No | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `user2_id` | UUID | Yes | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `current_phase` | `scripture_session_phase` | No | `'lobby'` | ENUM |
| `current_step_index` | INT | No | `0` | -- |
| `status` | `scripture_session_status` | No | `'pending'` | ENUM |
| `version` | INT | No | `1` | Optimistic concurrency control |
| `snapshot_json` | JSONB | Yes | -- | Arbitrary session state snapshot |
| `started_at` | TIMESTAMPTZ | No | `now()` | -- |
| `completed_at` | TIMESTAMPTZ | Yes | -- | -- |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_scripture_sessions_user1` | `(user1_id, started_at DESC)` | btree |
| `idx_scripture_sessions_user2` | `(user2_id, started_at DESC)` | btree |

---

## 2.8 `scripture_step_states`

Tracks lock and advance timestamps for each step in a session. Used for two-player synchronization in "together" mode.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `session_id` | UUID | No | -- | FK to `scripture_sessions(id)` ON DELETE CASCADE |
| `step_index` | INT | No | -- | -- |
| `user1_locked_at` | TIMESTAMPTZ | Yes | -- | -- |
| `user2_locked_at` | TIMESTAMPTZ | Yes | -- | -- |
| `advanced_at` | TIMESTAMPTZ | Yes | -- | -- |

**Constraints:**

| Name | Rule |
|---|---|
| unique | `(session_id, step_index)` |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_scripture_step_states_session` | `session_id` | btree |

---

## 2.9 `scripture_reflections`

User reflections on individual reading steps. Includes a 1-5 rating and optional notes. Sharing is opt-in.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `session_id` | UUID | No | -- | FK to `scripture_sessions(id)` ON DELETE CASCADE |
| `step_index` | INT | No | -- | -- |
| `user_id` | UUID | No | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `rating` | INT | Yes | -- | CHECK: `rating >= 1 AND rating <= 5` |
| `notes` | TEXT | Yes | -- | -- |
| `is_shared` | BOOLEAN | No | `false` | -- |
| `created_at` | TIMESTAMPTZ | No | `now()` | -- |

**Constraints:**

| Name | Rule |
|---|---|
| unique | `(session_id, step_index, user_id)` |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_scripture_reflections_session` | `session_id` | btree |

---

## 2.10 `scripture_bookmarks`

Bookmarked reading steps. Partner sharing is opt-in per bookmark.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `session_id` | UUID | No | -- | FK to `scripture_sessions(id)` ON DELETE CASCADE |
| `step_index` | INT | No | -- | -- |
| `user_id` | UUID | No | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `share_with_partner` | BOOLEAN | No | `false` | -- |
| `created_at` | TIMESTAMPTZ | No | `now()` | -- |

**Constraints:**

| Name | Rule |
|---|---|
| unique | `(session_id, step_index, user_id)` |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_scripture_bookmarks_session` | `session_id` | btree |

---

## 2.11 `scripture_messages`

Messages in the Daily Prayer Report section of a scripture session.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `session_id` | UUID | No | -- | FK to `scripture_sessions(id)` ON DELETE CASCADE |
| `sender_id` | UUID | No | -- | FK to `auth.users(id)` ON DELETE CASCADE |
| `message` | TEXT | No | -- | -- |
| `created_at` | TIMESTAMPTZ | No | `now()` | -- |

**Indexes:**

| Index | Columns | Type |
|---|---|---|
| `idx_scripture_messages_session` | `(session_id, created_at)` | btree |

---
