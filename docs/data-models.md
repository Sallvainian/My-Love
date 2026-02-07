# Data Models Reference

Complete schema reference for the My Love application. Covers the Supabase (PostgreSQL) remote database, the IndexedDB local database, TypeScript type definitions, and Zod validation schemas.

---

## Table of Contents

1. [Database Schema Overview](#1-database-schema-overview)
2. [Table Details](#2-table-details)
3. [Row Level Security Policies](#3-row-level-security-policies)
4. [Relationships](#4-relationships)
5. [Database Functions and RPCs](#5-database-functions-and-rpcs)
6. [IndexedDB Schema](#6-indexeddb-schema)
7. [TypeScript Type Definitions](#7-typescript-type-definitions)
8. [Validation Schemas](#8-validation-schemas)
9. [Migration History](#9-migration-history)

---

## 1. Database Schema Overview

The Supabase database uses PostgreSQL with Row Level Security (RLS) enabled on all tables. The schema covers two primary feature areas: the core couples app (users, moods, love notes, interactions, photos, partner requests) and the scripture reading feature (sessions, step states, reflections, bookmarks, messages).

### Supabase Tables

| Table | Description | RLS |
|---|---|---|
| `users` | User profiles linked to `auth.users`, partner relationships | Enabled |
| `moods` | Mood tracking entries with optional notes | Enabled |
| `love_notes` | Messages between partners with optional image attachments | Enabled |
| `interactions` | Quick interactions (poke, kiss) between partners | Enabled |
| `partner_requests` | Partnership invitation workflow | Enabled |
| `photos` | Photo gallery metadata (files stored in Supabase Storage) | Enabled |
| `scripture_sessions` | Scripture reading session state and progress | Enabled |
| `scripture_step_states` | Per-step lock/advance timestamps for sessions | Enabled |
| `scripture_reflections` | User reflections with ratings per reading step | Enabled |
| `scripture_bookmarks` | Bookmarked reading steps | Enabled |
| `scripture_messages` | Prayer report messages within a session | Enabled |

### Custom Enum Types

| Enum | Values |
|---|---|
| `scripture_session_mode` | `solo`, `together` |
| `scripture_session_phase` | `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete` |
| `scripture_session_status` | `pending`, `in_progress`, `complete`, `abandoned` |

> **Note:** The original `mood_type`, `interaction_type`, and `partner_request_status` enums were dropped in migration `20251206024345` and replaced with TEXT columns plus CHECK constraints.

### Storage Buckets

| Bucket | Public | Size Limit | Purpose |
|---|---|---|---|
| `photos` | No | 10 MB | Photo gallery images |
| `love-notes-images` | No | Default | Love note image attachments |

---

## 2. Table Details

### 2.1 `users`

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

### 2.2 `moods`

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

### 2.3 `love_notes`

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

### 2.4 `interactions`

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

### 2.5 `partner_requests`

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

### 2.6 `photos`

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

### 2.7 `scripture_sessions`

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

### 2.8 `scripture_step_states`

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

### 2.9 `scripture_reflections`

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

### 2.10 `scripture_bookmarks`

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

### 2.11 `scripture_messages`

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

## 3. Row Level Security Policies

All tables have RLS enabled. Policies are listed below grouped by table with the final state after all migrations (including drops and replacements).

### 3.1 `users`

| Policy | Operation | Rule |
|---|---|---|
| Users can view self and partner profiles | SELECT | Own row, or partner's row (via `partner_id` lookup), or row where `partner_id = auth.uid()` |
| users_update_self_safe | UPDATE | Own row only, AND `partner_id` must not change from its current value |
| Users can insert own profile | INSERT | `auth.uid() = id` |

> **Security note:** The update policy prevents privilege escalation by blocking direct `partner_id` modifications. Partner linking is only possible through the `accept_partner_request()` SECURITY DEFINER function.

### 3.2 `moods`

| Policy | Operation | Rule |
|---|---|---|
| Users can view own and partner moods | SELECT | `auth.uid() = user_id` OR user is a partner of the mood owner |
| Users can insert own moods | INSERT | `auth.uid() = user_id` |
| Users can update own moods | UPDATE | `auth.uid() = user_id` |
| Users can delete own moods | DELETE | `auth.uid() = user_id` |

### 3.3 `love_notes`

| Policy | Operation | Rule |
|---|---|---|
| Users can view their own messages | SELECT | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can insert their own messages | INSERT | `auth.uid() = from_user_id` |

### 3.4 `interactions`

| Policy | Operation | Rule |
|---|---|---|
| Users can view interactions to/from them | SELECT | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can insert interactions | INSERT | `auth.uid() = from_user_id` |
| Users can update received interactions | UPDATE | `auth.uid() = to_user_id` (mark as viewed) |

### 3.5 `partner_requests`

| Policy | Operation | Rule |
|---|---|---|
| Users can view their requests | SELECT | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can create partner requests | INSERT | `auth.uid() = from_user_id` |
| Users can update received requests | UPDATE | `auth.uid() = to_user_id` |

### 3.6 `photos`

| Policy | Operation | Rule |
|---|---|---|
| Users can view own photos | SELECT | `auth.uid() = user_id` |
| Partners can view partner photos | SELECT | Partner relationship exists via `users.partner_id` |
| Users can insert own photos | INSERT | `auth.uid() = user_id` |
| Users can delete own photos | DELETE | `auth.uid() = user_id` |

### 3.7 `photos` Storage Bucket (`storage.objects`)

| Policy | Operation | Rule |
|---|---|---|
| Users can upload own photos | INSERT | `bucket_id = 'photos'` AND first folder segment = `auth.uid()` |
| Users can read own photos | SELECT | `bucket_id = 'photos'` AND first folder segment = `auth.uid()` |
| Partners can read partner photos | SELECT | `bucket_id = 'photos'` AND first folder segment = partner's ID |
| Users can delete own photos from storage | DELETE | `bucket_id = 'photos'` AND first folder segment = `auth.uid()` |

### 3.8 `love-notes-images` Storage Bucket (`storage.objects`)

| Policy | Operation | Rule |
|---|---|---|
| Users upload own love note images | INSERT | `bucket_id = 'love-notes-images'` AND folder = `auth.uid()` AND extension IN (`jpg`, `jpeg`, `png`, `webp`) |
| Users read own love note images | SELECT | `bucket_id = 'love-notes-images'` AND folder = `auth.uid()` |
| Partners read partner love note images | SELECT | `bucket_id = 'love-notes-images'` AND folder = partner's ID |
| Users delete own love note images | DELETE | `bucket_id = 'love-notes-images'` AND folder = `auth.uid()` |

### 3.9 `scripture_sessions`

| Policy | Operation | Rule |
|---|---|---|
| scripture_sessions_select | SELECT | `user1_id = auth.uid() OR user2_id = auth.uid()` |
| scripture_sessions_insert | INSERT | `user1_id = auth.uid()` |
| scripture_sessions_update | UPDATE | `user1_id = auth.uid() OR user2_id = auth.uid()` |

### 3.10 `scripture_step_states`

| Policy | Operation | Rule |
|---|---|---|
| scripture_step_states_select | SELECT | `is_scripture_session_member(session_id)` |
| scripture_step_states_insert | INSERT | `is_scripture_session_member(session_id)` |
| scripture_step_states_update | UPDATE | `is_scripture_session_member(session_id)` |

### 3.11 `scripture_reflections`

| Policy | Operation | Rule |
|---|---|---|
| scripture_reflections_select | SELECT | Own reflections, or shared reflections in own sessions |
| scripture_reflections_insert | INSERT | `user_id = auth.uid()` AND session member |
| scripture_reflections_update | UPDATE | `user_id = auth.uid()` |

### 3.12 `scripture_bookmarks`

| Policy | Operation | Rule |
|---|---|---|
| scripture_bookmarks_select | SELECT | Own bookmarks, or shared bookmarks in own sessions |
| scripture_bookmarks_insert | INSERT | `user_id = auth.uid()` AND session member |
| scripture_bookmarks_update | UPDATE | `user_id = auth.uid()` |
| scripture_bookmarks_delete | DELETE | `user_id = auth.uid()` |

### 3.13 `scripture_messages`

| Policy | Operation | Rule |
|---|---|---|
| scripture_messages_select | SELECT | `is_scripture_session_member(session_id)` |
| scripture_messages_insert | INSERT | `sender_id = auth.uid()` AND session member |

---

## 4. Relationships

### Entity Relationship Summary

```
auth.users (1) ---- (1) users
users (1) ---- (0..1) users          [partner_id self-reference]
users (1) ---- (N) moods
users (1) ---- (N) love_notes        [as from_user_id]
users (1) ---- (N) love_notes        [as to_user_id]
users (1) ---- (N) interactions      [as from_user_id]
users (1) ---- (N) interactions      [as to_user_id]
users (1) ---- (N) partner_requests  [as from_user_id]
users (1) ---- (N) partner_requests  [as to_user_id]
users (1) ---- (N) photos

users (1) ---- (N) scripture_sessions  [as user1_id]
users (1) ---- (N) scripture_sessions  [as user2_id]

scripture_sessions (1) ---- (N) scripture_step_states
scripture_sessions (1) ---- (N) scripture_reflections
scripture_sessions (1) ---- (N) scripture_bookmarks
scripture_sessions (1) ---- (N) scripture_messages
```

### Foreign Key Details

| Source Table | Column | Target Table | Target Column | On Delete |
|---|---|---|---|---|
| `users` | `id` | `auth.users` | `id` | CASCADE |
| `users` | `partner_id` | `users` | `id` | SET NULL |
| `moods` | `user_id` | `users` | `id` | CASCADE |
| `love_notes` | `from_user_id` | `auth.users` | `id` | CASCADE |
| `love_notes` | `to_user_id` | `auth.users` | `id` | CASCADE |
| `interactions` | `from_user_id` | `users` | `id` | CASCADE |
| `interactions` | `to_user_id` | `users` | `id` | CASCADE |
| `partner_requests` | `from_user_id` | `users` | `id` | CASCADE |
| `partner_requests` | `to_user_id` | `users` | `id` | CASCADE |
| `photos` | `user_id` | `auth.users` | `id` | CASCADE |
| `scripture_sessions` | `user1_id` | `auth.users` | `id` | CASCADE |
| `scripture_sessions` | `user2_id` | `auth.users` | `id` | CASCADE |
| `scripture_step_states` | `session_id` | `scripture_sessions` | `id` | CASCADE |
| `scripture_reflections` | `session_id` | `scripture_sessions` | `id` | CASCADE |
| `scripture_reflections` | `user_id` | `auth.users` | `id` | CASCADE |
| `scripture_bookmarks` | `session_id` | `scripture_sessions` | `id` | CASCADE |
| `scripture_bookmarks` | `user_id` | `auth.users` | `id` | CASCADE |
| `scripture_messages` | `session_id` | `scripture_sessions` | `id` | CASCADE |
| `scripture_messages` | `sender_id` | `auth.users` | `id` | CASCADE |

---

## 5. Database Functions and RPCs

### 5.1 `get_partner_id(user_id UUID)` -> `UUID`

**Security:** DEFINER, STABLE

Retrieves the `partner_id` for a given user. Used internally by RLS policies to avoid recursive policy evaluation when checking partner relationships.

> **Note:** Dropped in migration `20251206024345` and replaced by inline subqueries in RLS policies.

---

### 5.2 `accept_partner_request(p_request_id UUID)` -> `void`

**Security:** DEFINER

Accepts a pending partner request. Performs the following atomically:

1. Validates the request exists and is pending.
2. Verifies `auth.uid()` is the recipient (`to_user_id`).
3. Checks neither user already has a partner.
4. Sets `partner_id` on both users (bidirectional link).
5. Marks the request as `accepted`.
6. Declines all other pending requests involving either user.

---

### 5.3 `decline_partner_request(p_request_id UUID)` -> `void`

**Security:** DEFINER

Declines a pending partner request. Validates the request is pending and `auth.uid()` is the recipient before updating status to `declined`.

---

### 5.4 `sync_user_profile()` -> `trigger`

**Security:** DEFINER

Trigger function fired `AFTER INSERT OR UPDATE ON auth.users`. Automatically creates or updates a corresponding row in `public.users` with the email and display name from the auth metadata.

---

### 5.5 `is_scripture_session_member(p_session_id UUID)` -> `BOOLEAN`

**Security:** DEFINER, STABLE

Returns `true` if `auth.uid()` matches either `user1_id` or `user2_id` of the given session. Used by RLS policies on all scripture child tables.

---

### 5.6 `scripture_create_session(p_mode TEXT, p_partner_id UUID DEFAULT NULL)` -> `JSONB`

**Security:** DEFINER
**Granted to:** `authenticated`

Creates a new scripture reading session. Returns the full session object as JSONB.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `p_mode` | TEXT | Yes | `'solo'` or `'together'` |
| `p_partner_id` | UUID | Together mode only | Partner's user ID |

New sessions start in `reading` phase with `in_progress` status.

---

### 5.7 `scripture_submit_reflection(p_session_id, p_step_index, p_rating, p_notes, p_is_shared)` -> `JSONB`

**Security:** DEFINER
**Granted to:** `authenticated`

Upserts a reflection for the authenticated user at the given session and step. Uses `ON CONFLICT (session_id, step_index, user_id) DO UPDATE` for idempotent writes. Validates session membership and rating range (1-5). Returns the reflection object as JSONB.

---

### 5.8 `scripture_seed_test_data(...)` -> `JSONB`

**Security:** DEFINER
**Granted to:** `authenticated`

Test data seeding function with an environment guard that rejects calls in production. Creates scripture sessions, step states, reflections, and messages for development and testing.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `p_session_count` | INT | 1 | Number of sessions to create |
| `p_include_reflections` | BOOLEAN | false | Seed reflection records |
| `p_include_messages` | BOOLEAN | false | Seed prayer messages |
| `p_preset` | TEXT | NULL | `'mid_session'`, `'completed'`, `'with_help_flags'` |

---

## 6. IndexedDB Schema

The client uses IndexedDB (via the `idb` library) for offline-first data storage. The database is named `my-love-db` and is currently at version 5.

### Database Configuration

```typescript
const DB_NAME = 'my-love-db';
const DB_VERSION = 5;
```

### Object Stores

#### 6.1 `messages`

Stores custom love messages for the daily message rotation.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | Yes |

| Index | Key Path | Unique |
|---|---|---|
| `by-category` | `category` | No |
| `by-date` | `createdAt` | No |

**Value type:** `Message`

```typescript
interface Message {
  id: number;
  text: string;
  category: 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';
  isCustom: boolean;
  active?: boolean;
  createdAt: Date;
  isFavorite?: boolean;
  updatedAt?: Date;
  tags?: string[];
}
```

#### 6.2 `photos`

Stores compressed photo blobs and metadata locally.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | Yes |

| Index | Key Path | Unique |
|---|---|---|
| `by-date` | `uploadDate` | No |

**Value type:** `Photo`

```typescript
interface Photo {
  id: number;
  imageBlob: Blob;
  caption?: string;
  tags: string[];
  uploadDate: Date;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
}
```

#### 6.3 `moods`

Stores mood entries locally for offline-first tracking with Supabase sync.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | Yes |

| Index | Key Path | Unique |
|---|---|---|
| `by-date` | `date` | Yes |

**Value type:** `MoodEntry`

```typescript
interface MoodEntry {
  id?: number;
  userId: string;
  mood: MoodType;
  moods?: MoodType[];
  note?: string;
  date: string;        // YYYY-MM-DD
  timestamp: Date;
  synced: boolean;
  supabaseId?: string;
}
```

#### 6.4 `sw-auth`

Stores the current auth token for Service Worker access (Background Sync).

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

**Value type:** `StoredAuthToken`

```typescript
interface StoredAuthToken {
  id: 'current';       // Always 'current' (single record)
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

#### 6.5 `scripture-sessions`

Caches scripture sessions for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-user` | `userId` | No |

**Value type:** `ScriptureSession`

```typescript
interface ScriptureSession {
  id: string;
  mode: 'solo' | 'together';
  userId: string;
  partnerId?: string;
  currentPhase: ScriptureSessionPhase;
  currentStepIndex: number;
  status: ScriptureSessionStatus;
  version: number;
  snapshotJson?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
}
```

#### 6.6 `scripture-reflections`

Caches scripture reflections for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-session` | `sessionId` | No |

**Value type:** `ScriptureReflection`

```typescript
interface ScriptureReflection {
  id: string;
  sessionId: string;
  stepIndex: number;
  userId: string;
  rating?: number;    // 1-5
  notes?: string;
  isShared: boolean;
  createdAt: Date;
}
```

#### 6.7 `scripture-bookmarks`

Caches scripture bookmarks for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-session` | `sessionId` | No |

**Value type:** `ScriptureBookmark`

```typescript
interface ScriptureBookmark {
  id: string;
  sessionId: string;
  stepIndex: number;
  userId: string;
  shareWithPartner: boolean;
  createdAt: Date;
}
```

#### 6.8 `scripture-messages`

Caches scripture prayer messages for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-session` | `sessionId` | No |

**Value type:** `ScriptureMessage`

```typescript
interface ScriptureMessage {
  id: string;
  sessionId: string;
  senderId: string;
  message: string;
  createdAt: Date;
}
```

### Version History

| Version | Changes |
|---|---|
| v1 | `messages` store with `by-category` and `by-date` indexes |
| v2 | `photos` store (recreated from v1 with `imageBlob` replacing `blob`) |
| v3 | `moods` store with unique `by-date` index |
| v4 | `sw-auth` store for Background Sync service worker tokens |
| v5 | Four `scripture-*` stores for offline scripture reading support |

---

## 7. TypeScript Type Definitions

### 7.1 Generated Supabase Types (`database.types.ts`)

Auto-generated by `supabase gen types typescript`. Provides `Row`, `Insert`, and `Update` types for each table. Key utility types:

```typescript
// Get the row type for a table
type Tables<TableName> = Database['public']['Tables'][TableName]['Row'];

// Get the insert type
type TablesInsert<TableName> = Database['public']['Tables'][TableName]['Insert'];

// Get the update type
type TablesUpdate<TableName> = Database['public']['Tables'][TableName]['Update'];

// Get an enum type
type Enums<EnumName> = Database['public']['Enums'][EnumName];
```

### 7.2 Application Types (`types/index.ts`)

Domain-level types used throughout the application.

| Type | Description |
|---|---|
| `ThemeName` | `'sunset' \| 'ocean' \| 'lavender' \| 'rose'` |
| `MessageCategory` | `'reason' \| 'memory' \| 'affirmation' \| 'future' \| 'custom'` |
| `MoodType` | 12 mood values (loved, happy, content, etc.) |
| `Message` | Local message with id, text, category, tags |
| `Photo` | Local photo with blob, dimensions, compression metadata |
| `MoodEntry` | Mood with sync state (`synced`, `supabaseId`) |
| `Settings` | Full app settings (theme, relationship, notifications) |
| `MessageHistory` | Message rotation state with date-to-ID mapping |
| `CustomMessage` | User-created message with active/inactive toggle |
| `AppState` | Top-level state container |

### 7.3 Supabase Model Types (`types/models.ts`)

Re-exports and defines types for Supabase table records.

| Type | Description |
|---|---|
| `LoveNote` | Love note with client-side fields (`sending`, `error`, `tempId`, `imageBlob`) |
| `LoveNotesState` | Zustand store shape for love notes |
| `SendMessageInput` | Input for sending a love note |
| `MessageValidationResult` | Validation result with optional error message |

Scripture types re-exported from `dbSchema.ts`:

| Type | Description |
|---|---|
| `ScriptureSession` | IndexedDB-shaped session |
| `ScriptureReflection` | IndexedDB-shaped reflection |
| `ScriptureBookmark` | IndexedDB-shaped bookmark |
| `ScriptureMessage` | IndexedDB-shaped message |

---

## 8. Validation Schemas

The application uses Zod for runtime validation at two boundaries: IndexedDB writes (local) and Supabase API responses (remote).

### 8.1 Local Validation Schemas (`validation/schemas.ts`)

| Schema | Validates | Key Rules |
|---|---|---|
| `MessageSchema` | Message records | text: 1..MAX_LENGTH chars, valid category |
| `CreateMessageInputSchema` | New message input | text trimmed, 1..MAX_LENGTH chars |
| `UpdateMessageInputSchema` | Message update | id required, all other fields optional |
| `PhotoSchema` | Photo records | Blob instance, valid MIME, positive dimensions |
| `PhotoUploadInputSchema` | Upload input | File instance, caption max 500 chars |
| `MoodEntrySchema` | Mood entries | Valid ISO date (YYYY-MM-DD), valid mood type, note max 200 chars |
| `SettingsSchema` | App settings | Valid theme, HH:MM time format, partner name required |
| `CustomMessagesExportSchema` | Import/export | Version `'1.0'`, message array with required fields |
| `SupabaseSessionSchema` | Scripture session rows | UUID ids, valid enums, int step index >= 0 |
| `SupabaseReflectionSchema` | Scripture reflection rows | Rating 1-5, UUID refs |
| `SupabaseBookmarkSchema` | Scripture bookmark rows | UUID refs, boolean share flag |
| `SupabaseMessageSchema` | Scripture message rows | UUID refs, non-empty message |

### 8.2 Supabase API Validation Schemas (`api/validation/supabaseSchemas.ts`)

| Schema | Table | Variants |
|---|---|---|
| `SupabaseUserSchema` | `users` | Row, Insert, Update |
| `SupabaseMoodSchema` | `moods` | Row, Insert, Update |
| `SupabaseInteractionSchema` | `interactions` | Row, Insert, Update |
| `SupabasePhotoSchema` | `photos` | Row only (placeholder) |
| `SupabaseMessageSchema` | future messages table | Row only (placeholder) |

**Array schemas** for batch validation: `MoodArraySchema`, `InteractionArraySchema`, `UserArraySchema`.

**Common sub-schemas:**

| Schema | Description |
|---|---|
| `UUIDSchema` | `z.string().uuid()` |
| `TimestampSchema` | Accepts various ISO 8601/PostgreSQL timestamp formats |
| `MoodTypeSchema` | Enum of 12 valid mood values |
| `InteractionTypeSchema` | `'poke' \| 'kiss'` |

---

## 9. Migration History

Migrations are stored in `supabase/migrations/` and applied in filename-sorted order.

| Migration | Date | Description |
|---|---|---|
| `20251203000001_create_base_schema.sql` | 2025-12-03 | Core tables: `users`, `moods`, `love_notes`, `interactions`, `partner_requests`. Enum types. `accept_partner_request` RPC. `get_partner_id` helper. Initial RLS policies. |
| `20251203190800_create_photos_table.sql` | 2025-12-03 | `photos` metadata table. `photos` storage bucket (10 MB limit, private). Photo RLS policies for table and storage. |
| `20251205000001_add_love_notes_images.sql` | 2025-12-05 | Added `image_url` column to `love_notes`. `love-notes-images` storage bucket. Storage RLS for image uploads and partner reads. |
| `20251205000002_add_mime_validation.sql` | 2025-12-05 | Replaced love note image upload policy to add file extension validation (`jpg`, `jpeg`, `png`, `webp`). |
| `20251206024345_remote_schema.sql` | 2025-12-06 | Large schema sync from remote. Dropped enum types, replaced with TEXT + CHECK constraints. Added `sync_user_profile` trigger. Added `decline_partner_request` RPC. Rewrote `accept_partner_request` with partner-exists guard. Replaced all RLS policies. Added new indexes (`idx_interactions_from_user`, `idx_interactions_to_user_viewed`, `idx_love_notes_from_user_created`, `idx_love_notes_to_user_created`, `idx_partner_requests_to_user_pending`, `idx_partner_requests_unique`, `idx_users_display_name_search`, `idx_users_email_search`, `idx_users_partner`). Added `different_users` check on `love_notes`, `no_self_requests` check on `partner_requests`. Changed `moods.note` limit from 200 to 500. Changed `moods.user_id` FK target from `auth.users` to `users`. Set `device_id` default to `gen_random_uuid()`. |
| `20251206124803_fix_users_rls_policy.sql` | 2025-12-06 | Replaced overly permissive "Authenticated users can read all users" policy with scoped "Users can view self and partner profiles". |
| `20251206200000_fix_users_update_privilege_escalation.sql` | 2025-12-06 | P0 security fix. Replaced `users_update_self` with `users_update_self_safe` to prevent `partner_id` manipulation for profile snooping. |
| `20260128000001_scripture_reading.sql` | 2026-01-28 | Scripture reading feature tables: `scripture_sessions`, `scripture_step_states`, `scripture_reflections`, `scripture_bookmarks`, `scripture_messages`. Three new enum types. `is_scripture_session_member` helper. Full RLS policies. `scripture_seed_test_data` RPC. |
| `20260130000001_scripture_rpcs.sql` | 2026-01-30 | Fixed `scripture_seed_test_data` variable reuse bug (`v_session_id` overwrite). Added `scripture_create_session` and `scripture_submit_reflection` RPCs. |
