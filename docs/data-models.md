# Data Models

> Database schema and data architecture for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

---

## Overview

Hybrid data architecture combining **Supabase** (cloud PostgreSQL) for authoritative data with **IndexedDB** (browser) for offline-first support.

| Layer | Technology | Count | Purpose |
|-------|-----------|-------|---------|
| Cloud | Supabase (PostgreSQL) | 11 tables | Authoritative storage, RLS on all tables |
| Local | IndexedDB | 8 stores | Offline cache, background sync |
| Schema | SQL migrations | 10 files | Progressive schema evolution |

**Data flow:**

```
READ:  Supabase --> Service (Zod validate + snake_case-->camelCase) --> IndexedDB (cache) --> Zustand --> UI
WRITE: UI --> Zustand action --> Service --> Supabase RPC/query
         --> success: update IndexedDB + store
         --> failure: queue for Background Sync retry
```

---

## Supabase Tables

### 1. users

Core user profile table, linked 1:1 with Supabase Auth.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK, FK --> `auth.users(id)` ON DELETE CASCADE | -- | Auth-linked identity |
| `partner_name` | TEXT | -- | NULL | Legacy partner name |
| `device_id` | UUID | -- | `gen_random_uuid()` | Device identifier |
| `email` | TEXT | -- | NULL | User email |
| `display_name` | TEXT | -- | NULL | Display name |
| `partner_id` | UUID | FK --> `users(id)` ON DELETE SET NULL | NULL | Bidirectional partner link |
| `created_at` | TIMESTAMPTZ | -- | `now()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | -- | `now()` | Updated timestamp |

**Indexes:**

| Index | Columns | Notes |
|-------|---------|-------|
| `idx_users_partner` | `partner_id` | Partner lookup |
| `idx_users_display_name_search` | `lower(display_name)` | Case-insensitive search |
| `idx_users_email_search` | `lower(email)` | Case-insensitive search |

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view self and partner profiles | SELECT | `id = auth.uid()` OR partner relationship |
| Users can insert own profile | INSERT | `auth.uid() = id` |
| users_update_self_safe | UPDATE | `auth.uid() = id` AND `partner_id` must remain unchanged |

The UPDATE policy prevents privilege escalation by making `partner_id` immutable through direct UPDATE. Partner relationships can only be established via `accept_partner_request()` (SECURITY DEFINER).

**Functions:**

| Function | Type | Purpose |
|----------|------|---------|
| `get_partner_id(user_id)` | SQL, SECURITY DEFINER, STABLE | Returns partner_id for a given user (avoids RLS recursion) |
| `sync_user_profile()` | Trigger (plpgsql, SECURITY DEFINER) | Fires on `auth.users` INSERT/UPDATE; upserts into `public.users` |

---

### 2. moods

Mood tracking with single and multi-mood support.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Mood entry ID |
| `user_id` | UUID | FK --> `users(id)` ON DELETE CASCADE, NOT NULL | -- | Owner |
| `mood_type` | TEXT | CHECK (valid mood values), NOT NULL | -- | Primary mood |
| `mood_types` | TEXT[] | CHECK (array values subset of valid moods) | NULL | Multi-mood selection |
| `note` | TEXT | CHECK `char_length <= 200` | NULL | Optional note |
| `created_at` | TIMESTAMPTZ | -- | `now()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | -- | `now()` | Updated timestamp |

**Valid mood values:** loved, happy, content, excited, thoughtful, grateful, sad, anxious, frustrated, angry, lonely, tired

**Indexes:**

| Index | Columns |
|-------|---------|
| `idx_moods_user_created` | `(user_id, created_at DESC)` |

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view own and partner moods | SELECT | `auth.uid() = user_id` OR partner relationship via users table |
| Users can insert own moods | INSERT | `auth.uid() = user_id` |
| Users can update own moods | UPDATE | `auth.uid() = user_id` |
| Users can delete own moods | DELETE | `auth.uid() = user_id` |

---

### 3. love_notes

Text and image messages between partners.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Note ID |
| `from_user_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE, NOT NULL | -- | Sender |
| `to_user_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE, NOT NULL | -- | Recipient |
| `content` | TEXT | CHECK `char_length >= 1 AND char_length <= 1000`, NOT NULL | -- | Message body |
| `image_url` | TEXT | -- | NULL | Storage path in love-notes-images bucket |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Sent timestamp |

**Constraints:**

| Constraint | Type | Rule |
|------------|------|------|
| `different_users` | CHECK | `from_user_id <> to_user_id` |
| `love_notes_content_check` | CHECK | Content between 1-1000 characters |

**Indexes:**

| Index | Columns |
|-------|---------|
| `idx_love_notes_from_user_created` | `(from_user_id, created_at DESC)` |
| `idx_love_notes_to_user_created` | `(to_user_id, created_at DESC)` |

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view their own messages | SELECT | `auth.uid() = from_user_id` OR `auth.uid() = to_user_id` |
| Users can insert their own messages | INSERT | `auth.uid() = from_user_id` |

---

### 4. interactions

Lightweight partner interactions (pokes, kisses) with read tracking.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Interaction ID |
| `type` | TEXT | CHECK `('poke', 'kiss')`, NOT NULL | -- | Interaction type |
| `from_user_id` | UUID | FK --> `users(id)` ON DELETE CASCADE, NOT NULL | -- | Sender |
| `to_user_id` | UUID | FK --> `users(id)` ON DELETE CASCADE, NOT NULL | -- | Recipient |
| `viewed` | BOOLEAN | -- | `false` | Read receipt |
| `created_at` | TIMESTAMPTZ | -- | `now()` | Sent timestamp |

**Indexes:**

| Index | Columns |
|-------|---------|
| `idx_interactions_from_user` | `(from_user_id)` |
| `idx_interactions_to_user_viewed` | `(to_user_id, viewed)` |

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view interactions to/from them | SELECT | `auth.uid() = from_user_id` OR `auth.uid() = to_user_id` |
| Users can insert interactions | INSERT | `auth.uid() = from_user_id` |
| Users can update received interactions | UPDATE | `auth.uid() = to_user_id` |

---

### 5. partner_requests

Partner linking workflow with pending, accepted, and declined states.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Request ID |
| `from_user_id` | UUID | FK --> `users(id)` ON DELETE CASCADE, NOT NULL | -- | Requester |
| `to_user_id` | UUID | FK --> `users(id)` ON DELETE CASCADE, NOT NULL | -- | Recipient |
| `status` | TEXT | CHECK `('pending', 'accepted', 'declined')`, NOT NULL | `'pending'` | Request state |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Updated timestamp |

**Constraints:**

| Constraint | Type | Rule |
|------------|------|------|
| `no_self_requests` | CHECK | `from_user_id <> to_user_id` |
| `idx_partner_requests_unique` | UNIQUE (partial) | `(from_user_id, to_user_id) WHERE status = 'pending'` |

**Indexes:**

| Index | Columns |
|-------|---------|
| `idx_partner_requests_to_user_pending` | `(to_user_id, status)` |
| `idx_partner_requests_unique` | `(from_user_id, to_user_id)` WHERE `status = 'pending'` |

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view their requests | SELECT | `auth.uid() = from_user_id` OR `auth.uid() = to_user_id` |
| Users can create partner requests | INSERT | `auth.uid() = from_user_id` |
| Users can update received requests | UPDATE | `auth.uid() = to_user_id` |

---

### 6. photos

Photo gallery metadata with storage bucket integration.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Photo ID |
| `user_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE, NOT NULL | -- | Owner |
| `storage_path` | TEXT | NOT NULL, UNIQUE | -- | Bucket path `{user_id}/{filename}` |
| `filename` | TEXT | NOT NULL | -- | Original filename |
| `caption` | TEXT | CHECK `char_length <= 500` | NULL | Optional caption |
| `mime_type` | TEXT | CHECK `('image/jpeg', 'image/png', 'image/webp')`, NOT NULL | `'image/jpeg'` | Image format |
| `file_size` | INTEGER | NOT NULL | -- | Size in bytes |
| `width` | INTEGER | NOT NULL | -- | Width in pixels |
| `height` | INTEGER | NOT NULL | -- | Height in pixels |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Upload timestamp |

**Indexes:**

| Index | Columns |
|-------|---------|
| `idx_photos_user_created` | `(user_id, created_at DESC)` |
| `idx_photos_storage_path` | `(storage_path)` |

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view own photos | SELECT | `auth.uid() = user_id` |
| Partners can view partner photos | SELECT | Partner relationship via users table |
| Users can insert own photos | INSERT | `auth.uid() = user_id` |
| Users can delete own photos | DELETE | `auth.uid() = user_id` |

---

### 7. scripture_sessions

Reading session state machine for solo and together modes.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Session ID |
| `mode` | `scripture_session_mode` | NOT NULL | -- | `'solo'` or `'together'` |
| `user1_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE, NOT NULL | -- | Session creator |
| `user2_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE | NULL | Partner (together mode) |
| `current_phase` | `scripture_session_phase` | NOT NULL | `'lobby'` | Current session phase |
| `current_step_index` | INT | NOT NULL | `0` | Current step (0-16) |
| `status` | `scripture_session_status` | NOT NULL | `'pending'` | Session state |
| `version` | INT | NOT NULL | `1` | Optimistic concurrency lock |
| `snapshot_json` | JSONB | -- | NULL | Session state snapshot |
| `started_at` | TIMESTAMPTZ | NOT NULL | `now()` | Session start |
| `completed_at` | TIMESTAMPTZ | -- | NULL | Session end |

**Enums:**

| Enum Type | Values |
|-----------|--------|
| `scripture_session_mode` | `solo`, `together` |
| `scripture_session_phase` | `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete` |
| `scripture_session_status` | `pending`, `in_progress`, `complete`, `abandoned` |

**Indexes:**

| Index | Columns |
|-------|---------|
| `idx_scripture_sessions_user1` | `(user1_id, started_at DESC)` |
| `idx_scripture_sessions_user2` | `(user2_id, started_at DESC)` |

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| scripture_sessions_select | SELECT | `user1_id = auth.uid()` OR `user2_id = auth.uid()` |
| scripture_sessions_insert | INSERT | `user1_id = auth.uid()` |
| scripture_sessions_update | UPDATE | `user1_id = auth.uid()` OR `user2_id = auth.uid()` |

**Helper function:** `is_scripture_session_member(session_id)` -- SQL, SECURITY DEFINER, STABLE. Used by child table RLS policies.

---

### 8. scripture_step_states

Per-step lock tracking for together-mode synchronization.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | State ID |
| `session_id` | UUID | FK --> `scripture_sessions(id)` ON DELETE CASCADE, NOT NULL | -- | Parent session |
| `step_index` | INT | NOT NULL | -- | Step number |
| `user1_locked_at` | TIMESTAMPTZ | -- | NULL | User 1 lock time |
| `user2_locked_at` | TIMESTAMPTZ | -- | NULL | User 2 lock time |
| `advanced_at` | TIMESTAMPTZ | -- | NULL | Step advance time |

**Unique constraint:** `(session_id, step_index)`

**Index:** `idx_scripture_step_states_session` on `(session_id)`

**RLS:** SELECT/INSERT/UPDATE via `is_scripture_session_member(session_id)`

---

### 9. scripture_reflections

Per-user, per-step reflection entries with sharing controls.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Reflection ID |
| `session_id` | UUID | FK --> `scripture_sessions(id)` ON DELETE CASCADE, NOT NULL | -- | Parent session |
| `step_index` | INT | NOT NULL | -- | Step number |
| `user_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE, NOT NULL | -- | Author |
| `rating` | INT | CHECK `>= 1 AND <= 5` | NULL | 1-5 rating |
| `notes` | TEXT | -- | NULL | Reflection notes |
| `is_shared` | BOOLEAN | NOT NULL | `false` | Share with partner |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Created timestamp |

**Unique constraint:** `(session_id, step_index, user_id)` -- enables idempotent upserts

**Index:** `idx_scripture_reflections_session` on `(session_id)`

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| scripture_reflections_select | SELECT | Own reflections OR `is_shared = true` for session members |
| scripture_reflections_insert | INSERT | `user_id = auth.uid()` AND session member |
| scripture_reflections_update | UPDATE | `user_id = auth.uid()` |

---

### 10. scripture_bookmarks

Per-user, per-step bookmarks with partner sharing.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Bookmark ID |
| `session_id` | UUID | FK --> `scripture_sessions(id)` ON DELETE CASCADE, NOT NULL | -- | Parent session |
| `step_index` | INT | NOT NULL | -- | Step number |
| `user_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE, NOT NULL | -- | Owner |
| `share_with_partner` | BOOLEAN | NOT NULL | `false` | Partner visibility |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Created timestamp |

**Unique constraint:** `(session_id, step_index, user_id)`

**Index:** `idx_scripture_bookmarks_session` on `(session_id)`

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| scripture_bookmarks_select | SELECT | Own bookmarks OR `share_with_partner = true` for session members |
| scripture_bookmarks_insert | INSERT | `user_id = auth.uid()` AND session member |
| scripture_bookmarks_update | UPDATE | `user_id = auth.uid()` |
| scripture_bookmarks_delete | DELETE | `user_id = auth.uid()` |

---

### 11. scripture_messages

Session chat messages for Daily Prayer Report.

| Column | Type | Constraints | Default | Purpose |
|--------|------|-------------|---------|---------|
| `id` | UUID | PK | `gen_random_uuid()` | Message ID |
| `session_id` | UUID | FK --> `scripture_sessions(id)` ON DELETE CASCADE, NOT NULL | -- | Parent session |
| `sender_id` | UUID | FK --> `auth.users(id)` ON DELETE CASCADE, NOT NULL | -- | Message author |
| `message` | TEXT | NOT NULL | -- | Message content |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Sent timestamp |

**Index:** `idx_scripture_messages_session` on `(session_id, created_at)`

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| scripture_messages_select | SELECT | `is_scripture_session_member(session_id)` |
| scripture_messages_insert | INSERT | `sender_id = auth.uid()` AND session member |

---

## RPC Functions

### scripture_create_session

Creates a new scripture reading session.

```sql
scripture_create_session(
  p_mode       TEXT,          -- 'solo' or 'together'
  p_partner_id UUID DEFAULT NULL
) RETURNS JSONB
```

- **Language:** plpgsql, SECURITY DEFINER
- **Validations:** Mode must be `solo` or `together`; partner required for together mode; partner must exist in `auth.users`
- **Behavior:** Creates session with `status = 'in_progress'`, `current_phase = 'reading'`, `current_step_index = 0`
- **Returns:** Full session object as JSONB

### scripture_submit_reflection

Upserts a reflection for a session step (idempotent via ON CONFLICT).

```sql
scripture_submit_reflection(
  p_session_id UUID,
  p_step_index INT,
  p_rating     INT,         -- 1-5
  p_notes      TEXT,
  p_is_shared  BOOLEAN
) RETURNS JSONB
```

- **Language:** plpgsql, SECURITY DEFINER
- **Validations:** Session membership required; rating must be 1-5
- **Behavior:** INSERT ... ON CONFLICT `(session_id, step_index, user_id)` DO UPDATE
- **Returns:** Full reflection object as JSONB

### accept_partner_request

Atomically accepts a partner request with bidirectional linking.

```sql
accept_partner_request(p_request_id UUID) RETURNS VOID
```

- **Language:** plpgsql, SECURITY DEFINER
- **Validations:** Request must be pending; caller must be recipient; neither user can already have a partner
- **Behavior:** Sets `partner_id` on both users, marks request `accepted`, auto-declines all other pending requests involving either user
- **Transaction:** Single atomic operation

### decline_partner_request

Declines a pending partner request.

```sql
decline_partner_request(p_request_id UUID) RETURNS VOID
```

- **Language:** plpgsql, SECURITY DEFINER
- **Validations:** Request must be pending; caller must be recipient
- **Behavior:** Sets status to `declined`

### sync_user_profile

Trigger function that creates or updates a `public.users` row when an `auth.users` row is inserted or updated.

```sql
sync_user_profile() RETURNS TRIGGER
```

- **Language:** plpgsql, SECURITY DEFINER
- **Trigger:** `AFTER INSERT OR UPDATE ON auth.users`
- **Behavior:** Upserts into `public.users` using `NEW.id`, `NEW.email`, and display_name from `raw_user_meta_data`

### is_scripture_session_member

Helper function used by scripture child table RLS policies.

```sql
is_scripture_session_member(p_session_id UUID) RETURNS BOOLEAN
```

- **Language:** SQL, SECURITY DEFINER, STABLE
- **Behavior:** Returns true if `auth.uid()` matches `user1_id` or `user2_id` on the session

### scripture_seed_test_data

Development-only seeding function with environment guard.

```sql
scripture_seed_test_data(
  p_session_count       INT DEFAULT 1,
  p_include_reflections BOOLEAN DEFAULT false,
  p_include_messages    BOOLEAN DEFAULT false,
  p_preset              TEXT DEFAULT NULL
) RETURNS JSONB
```

- **Language:** plpgsql, SECURITY DEFINER
- **Guard:** Raises exception if `app.environment = 'production'`
- **Presets:** `NULL` (lobby, pending), `mid_session` (step 7, reading, in_progress), `completed` (step 16, complete), `with_help_flags` (step 7, reading, in_progress)
- **Returns:** `session_ids`, `test_user1_id`, `test_user2_id`, optional `reflection_ids` and `message_ids`

---

## Storage Buckets

### photos

| Property | Value |
|----------|-------|
| Bucket ID | `photos` |
| Public | No |
| File size limit | 10 MB (10,485,760 bytes) |
| Path format | `{user_id}/{filename}` |
| Signed URLs | Yes (for authenticated access) |

**Storage RLS policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can upload own photos | INSERT | `bucket_id = 'photos'` AND folder matches `auth.uid()` |
| Users can read own photos | SELECT | `bucket_id = 'photos'` AND folder matches `auth.uid()` |
| Partners can read partner photos | SELECT | `bucket_id = 'photos'` AND folder matches partner_id |
| Users can delete own photos from storage | DELETE | `bucket_id = 'photos'` AND folder matches `auth.uid()` |

### love-notes-images

| Property | Value |
|----------|-------|
| Bucket ID | `love-notes-images` |
| Public | No |
| Path format | `{user_id}/{filename}` |
| Allowed extensions | jpg, jpeg, png, webp (enforced via upload policy) |

**Storage RLS policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users upload own love note images | INSERT | Folder matches `auth.uid()` AND valid file extension |
| Users read own love note images | SELECT | Folder matches `auth.uid()` |
| Partners read partner love note images | SELECT | Folder matches partner_id |
| Users delete own love note images | DELETE | Folder matches `auth.uid()` |

---

## IndexedDB Schema

**Database:** `my-love-db` | **Version:** 5 | **Library:** idb

**Source:** `src/services/dbSchema.ts`

### Store Summary

| Store | Added in | Key Type | Key Path | Indexes | Purpose |
|-------|----------|----------|----------|---------|---------|
| `messages` | v1 | number | auto-increment | `by-category` (category), `by-date` (createdAt) | Custom daily messages |
| `photos` | v2 | number | auto-increment | `by-date` (uploadDate) | Local photo cache |
| `moods` | v3 | number | auto-increment | `by-date` (date, UNIQUE) | Mood tracking + sync |
| `sw-auth` | v4 | literal | `'current'` | -- | Service Worker auth token |
| `scripture-sessions` | v5 | string | UUID | `by-user` (userId) | Session offline cache |
| `scripture-reflections` | v5 | string | UUID | `by-session` (sessionId) | Reflection offline cache |
| `scripture-bookmarks` | v5 | string | UUID | `by-session` (sessionId) | Bookmark offline cache |
| `scripture-messages` | v5 | string | UUID | `by-session` (sessionId) | Message offline cache |

### messages Store

| Property | Type | Notes |
|----------|------|-------|
| `id` | number | Auto-increment PK |
| `text` | string | Message content |
| `category` | string | Indexed: reason, memory, affirmation, future, custom |
| `isCustom` | boolean | User-created vs preset |
| `active` | boolean | In rotation pool |
| `createdAt` | Date | Indexed for sorting |
| `isFavorite` | boolean | Favorite flag |
| `tags` | string[] | Search tags |

### photos Store

| Property | Type | Notes |
|----------|------|-------|
| `id` | number | Auto-increment PK |
| `imageBlob` | Blob | Compressed image data |
| `uploadDate` | Date | Indexed for gallery sorting |
| Additional metadata | various | Compression and dimension fields |

### moods Store

| Property | Type | Notes |
|----------|------|-------|
| `id` | number | Auto-increment PK |
| `userId` | string | User identifier |
| `mood` | string | Primary mood (backward compat) |
| `moods` | string[] | Multi-mood array |
| `note` | string | Optional note |
| `date` | string | UNIQUE index, ISO YYYY-MM-DD format |
| `synced` | boolean | Supabase sync status |
| `supabaseId` | string | Remote UUID after sync |

### sw-auth Store

Singleton store with fixed key `'current'`.

| Property | Type | Notes |
|----------|------|-------|
| `id` | `'current'` | Fixed key |
| `accessToken` | string | JWT access token |
| `refreshToken` | string | Refresh token |
| `expiresAt` | number | Token expiry (epoch ms) |
| `userId` | string | Authenticated user ID |

Purpose: Persists auth credentials for Background Sync service worker access.

### Scripture Stores (v5)

Four stores for offline scripture reading support. All use UUID string keys from Supabase. Fields mirror Supabase columns in camelCase.

**scripture-sessions:**

| Property | Type | Notes |
|----------|------|-------|
| `id` | string | UUID from Supabase |
| `mode` | `'solo' \| 'together'` | Session mode |
| `userId` | string | Current user (indexed: `by-user`) |
| `partnerId` | string? | Partner ID (together mode) |
| `currentPhase` | string | Phase enum value |
| `currentStepIndex` | number | Step position |
| `status` | string | Status enum value |
| `version` | number | Optimistic lock |
| `snapshotJson` | object? | State snapshot |
| `startedAt` | Date | Session start |
| `completedAt` | Date? | Session end |

**scripture-reflections:**

| Property | Type | Notes |
|----------|------|-------|
| `id` | string | UUID |
| `sessionId` | string | Indexed: `by-session` |
| `stepIndex` | number | Step number |
| `userId` | string | Author |
| `rating` | number? | 1-5 rating |
| `notes` | string? | Reflection text |
| `isShared` | boolean | Partner visibility |
| `createdAt` | Date | Created timestamp |

**scripture-bookmarks:**

| Property | Type | Notes |
|----------|------|-------|
| `id` | string | UUID |
| `sessionId` | string | Indexed: `by-session` |
| `stepIndex` | number | Step number |
| `userId` | string | Owner |
| `shareWithPartner` | boolean | Partner visibility |
| `createdAt` | Date | Created timestamp |

**scripture-messages:**

| Property | Type | Notes |
|----------|------|-------|
| `id` | string | UUID |
| `sessionId` | string | Indexed: `by-session` |
| `senderId` | string | Author |
| `message` | string | Message content |
| `createdAt` | Date | Sent timestamp |

---

## Version Migrations (IndexedDB)

| Upgrade | Change |
|---------|--------|
| v1 | Create `messages` store with `by-category` and `by-date` indexes |
| v1 --> v2 | Delete and recreate `photos` store (`blob` --> `imageBlob` rename) |
| v2 --> v3 | Add `moods` store with UNIQUE `by-date` index |
| v3 --> v4 | Add `sw-auth` store for Service Worker credentials |
| v4 --> v5 | Add 4 scripture stores: sessions, reflections, bookmarks, messages |

Upgrade function in `src/services/dbSchema.ts` is idempotent and safe to call multiple times.

---

## Migration History (SQL)

| # | Migration File | Date | Purpose |
|---|---------------|------|---------|
| 1 | `20251203000001_create_base_schema.sql` | 2025-12-03 | Core tables: users, moods, love_notes, interactions, partner_requests with RLS |
| 2 | `20251203190800_create_photos_table.sql` | 2025-12-03 | Photos metadata table, indexes, RLS, and photos storage bucket |
| 3 | `20251205000001_add_love_notes_images.sql` | 2025-12-05 | Add `image_url` column to love_notes; create love-notes-images bucket |
| 4 | `20251205000002_add_mime_validation.sql` | 2025-12-05 | Add file extension validation to love-notes-images upload policy |
| 5 | `20251206024345_remote_schema.sql` | 2025-12-06 | Convert ENUMs to TEXT with CHECK constraints; comprehensive indexes; new RLS policies; add `sync_user_profile()`, `decline_partner_request()`; refactor `accept_partner_request()` |
| 6 | `20251206124803_fix_users_rls_policy.sql` | 2025-12-06 | Restrict user visibility from "all authenticated" to self + partner only |
| 7 | `20251206200000_fix_users_update_privilege_escalation.sql` | 2025-12-06 | Prevent partner_id manipulation by making it immutable via UPDATE policy |
| 8 | `20260128000001_scripture_reading.sql` | 2026-01-28 | Scripture tables: sessions, step_states, reflections, bookmarks, messages with RLS and seed RPC |
| 9 | `20260130000001_scripture_rpcs.sql` | 2026-01-30 | Fix seed RPC variable reuse bug; add `scripture_create_session` and `scripture_submit_reflection` RPCs |

---

## Entity Relationship Diagram

```
                        auth.users
                            |
                    (id references)
                            |
                            v
    +-------------------[ users ]-------------------+
    |                   PK: id                      |
    |           partner_id --+--> users.id          |
    |               (self-referential)              |
    +-----------------------------------------------+
        |          |          |          |         |
        v          v          v          v         v
     moods    love_notes  interactions  photos  partner_requests
     (user_id) (from/to)   (from/to)  (user_id)  (from/to)
                  |
                  | (love-notes-images bucket)
                  |
     +------------------------------------------+
     |                                          |
     |       [ scripture_sessions ]             |
     |           PK: id                         |
     |           user1_id --+--> auth.users     |
     |           user2_id --+--> auth.users     |
     |                                          |
     +----+--------+--------+--------+---------+
          |        |        |        |
          v        v        v        v
    step_states  reflections  bookmarks  messages
    (session_id) (session_id) (session_id) (session_id)
     UNIQUE:      UNIQUE:      UNIQUE:
     (sess,step)  (sess,step,  (sess,step,
                   user)        user)
```

**Foreign key cascade behavior:**
- `auth.users` deletion cascades to `users`, `moods`, `love_notes`, `interactions`, and all scripture tables
- `users` deletion sets `partner_id` to NULL on the partner row
- `scripture_sessions` deletion cascades to all child tables (step_states, reflections, bookmarks, messages)

---

## Key Design Patterns

1. **Offline-First Architecture** -- IndexedDB serves as the primary read source; Supabase is the authoritative write target
2. **Zod Validation Boundary** -- All Supabase responses pass through Zod schemas before entering the local cache
3. **Snake-to-Camel Transform** -- `snake_case` (PostgreSQL convention) converts to `camelCase` (TypeScript convention) at the service layer
4. **Atomic Partner Linking** -- `accept_partner_request()` handles bidirectional `partner_id` updates and auto-declines in a single transaction
5. **Optimistic Concurrency** -- `version` field on `scripture_sessions` enables conflict detection for concurrent updates
6. **Idempotent Upserts** -- UNIQUE constraints on reflections and bookmarks allow safe retry via `ON CONFLICT DO UPDATE`
7. **Path-Based Storage Isolation** -- `{user_id}/{filename}` structure aligns storage RLS with table RLS
8. **SECURITY DEFINER Functions** -- Bypass RLS for cross-table operations (partner lookup, session membership checks) while maintaining access control
