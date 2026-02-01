# Data Models

> Complete database schema and data model documentation for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Overview

Hybrid data architecture: **Supabase** (cloud PostgreSQL, 11 tables) for authoritative data + **IndexedDB** (browser, 8 stores) for offline-first support. Data flows: Supabase → Service Layer (Zod validate + snake→camel transform) → IndexedDB → Zustand → UI.

## Migration History

| Migration | Date | Purpose |
|-----------|------|---------|
| `20251203000001_create_base_schema.sql` | 2025-12-03 | Core: users, moods, love_notes, interactions, partner_requests with RLS |
| `20251203190800_create_photos_table.sql` | 2025-12-03 | Photos metadata + storage bucket |
| `20251205000001_add_love_notes_images.sql` | 2025-12-05 | `image_url` on love_notes; love-notes-images bucket |
| `20251205000002_add_mime_validation.sql` | 2025-12-05 | File extension validation on upload policy |
| `20251206024345_remote_schema.sql` | 2025-12-06 | Convert ENUMs→TEXT, comprehensive indexes, new RLS |
| `20251206124803_fix_users_rls_policy.sql` | 2025-12-06 | Restrict visibility (self + partner only) |
| `20251206200000_fix_users_update_privilege_escalation.sql` | 2025-12-06 | Prevent partner_id manipulation |
| `20260128000001_scripture_reading.sql` | 2026-01-28 | Scripture: sessions, step_states, reflections, bookmarks, messages |
| `20260130000001_scripture_rpcs.sql` | 2026-01-30 | RPCs: create_session, submit_reflection; seed data fix |

## Supabase Tables

### 1. users

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, ref `auth.users(id)` CASCADE | Auth-linked ID |
| `partner_id` | UUID | FK → `users(id)` SET NULL | Bidirectional partner |
| `email` | TEXT | — | Email |
| `display_name` | TEXT | — | Display name |
| `partner_name` | TEXT | — | Legacy field |
| `device_id` | UUID | DEFAULT gen_random_uuid() | Device ID |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Created |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Updated |

**Indexes**: `idx_users_partner`, `idx_users_display_name_search` (lower), `idx_users_email_search` (lower)
**RLS**: SELECT own + partner; INSERT own; UPDATE own (no partner_id)
**Helper**: `get_partner_id(user_id)` — SECURITY DEFINER

### 2. moods

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, gen_random_uuid() | ID |
| `user_id` | UUID | FK → auth.users, CASCADE, NOT NULL | Owner |
| `mood_type` | TEXT | CHECK enum, NOT NULL | Primary mood |
| `mood_types` | TEXT[] | CHECK values, nullable | Multi-mood |
| `note` | TEXT | CHECK <= 200 | Note |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Created |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Updated |

**Valid moods**: loved, happy, content, excited, thoughtful, grateful, sad, anxious, frustrated, angry, lonely, tired
**Index**: `idx_moods_user_created` (user_id, created_at DESC)
**RLS**: SELECT own + partner's; INSERT/UPDATE/DELETE own only

### 3. love_notes

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | ID |
| `from_user_id` | UUID | FK, CASCADE, NOT NULL | Sender |
| `to_user_id` | UUID | FK, CASCADE, NOT NULL | Recipient |
| `content` | TEXT | CHECK 1-1000, NOT NULL | Message |
| `image_url` | TEXT | nullable | Storage path |
| `created_at` | TIMESTAMPTZ | NOT NULL | Timestamp |

**Constraint**: `different_users` (from ≠ to)
**Indexes**: `idx_love_notes_from_user_created`, `idx_love_notes_to_user_created`
**Storage**: `love-notes-images` bucket, path `{user_id}/{filename}`, extensions: jpg, jpeg, png, webp

### 4. interactions

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | ID |
| `type` | TEXT | CHECK ('poke','kiss'), NOT NULL | Type |
| `from_user_id` | UUID | FK, CASCADE, NOT NULL | Sender |
| `to_user_id` | UUID | FK, CASCADE, NOT NULL | Recipient |
| `viewed` | BOOLEAN | DEFAULT false | Read |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | When |

**Indexes**: `idx_interactions_from_user`, `idx_interactions_to_user_viewed`

### 5. partner_requests

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | ID |
| `from_user_id` | UUID | FK, CASCADE, NOT NULL | Sender |
| `to_user_id` | UUID | FK, CASCADE, NOT NULL | Recipient |
| `status` | TEXT | CHECK ('pending','accepted','declined') | State |
| `created_at` | TIMESTAMPTZ | NOT NULL | Created |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Updated |

**Constraints**: `no_self_requests`, UNIQUE (from, to) WHERE status='pending'
**RPCs**: `accept_partner_request()` (atomic bidirectional link + auto-decline), `decline_partner_request()`

### 6. photos

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | ID |
| `user_id` | UUID | FK, CASCADE, NOT NULL | Owner |
| `storage_path` | TEXT | NOT NULL, UNIQUE | Bucket path |
| `filename` | TEXT | NOT NULL | Original name |
| `caption` | TEXT | CHECK <= 500 | Description |
| `mime_type` | TEXT | CHECK jpeg/png/webp | Format |
| `file_size` | INTEGER | NOT NULL | Bytes |
| `width` / `height` | INTEGER | NOT NULL | Pixels |
| `created_at` | TIMESTAMPTZ | NOT NULL | Upload time |

**Storage**: `photos` bucket, 10MB limit, path `{user_id}/{filename}`

### 7. scripture_sessions

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | Session ID |
| `mode` | TEXT | CHECK ('solo','together'), NOT NULL | Mode |
| `user1_id` | UUID | FK, CASCADE, NOT NULL | Creator |
| `user2_id` | UUID | FK, CASCADE, nullable | Partner |
| `current_phase` | TEXT | CHECK 6 phases, DEFAULT 'lobby' | Phase |
| `current_step_index` | INT | DEFAULT 0 | Step (0-16) |
| `status` | TEXT | CHECK 4 statuses, DEFAULT 'pending' | State |
| `version` | INT | DEFAULT 1 | Optimistic lock |
| `snapshot_json` | JSONB | nullable | State snapshot |
| `started_at` | TIMESTAMPTZ | NOT NULL | Start |
| `completed_at` | TIMESTAMPTZ | nullable | End |

**Phases**: lobby, countdown, reading, reflection, report, complete
**Statuses**: pending, in_progress, complete, abandoned
**Helper**: `is_scripture_session_member()` — SECURITY DEFINER

### 8. scripture_step_states

Per-step lock tracking for together mode. UNIQUE (session_id, step_index). Columns: user1_locked_at, user2_locked_at, advanced_at.

### 9. scripture_reflections

Per-user-per-step reflections. UNIQUE (session_id, step_index, user_id). Columns: rating (1-5), notes, is_shared.

### 10. scripture_bookmarks

Per-user-per-step bookmarks. UNIQUE (session_id, step_index, user_id). Column: share_with_partner.

### 11. scripture_messages

Session chat messages. Index on (session_id, created_at). Columns: sender_id, message.

## IndexedDB Schema

**Database**: `my-love-db` | **Version**: 5 | **Library**: idb

| Store | Version | Key | Indexes | Purpose |
|-------|---------|-----|---------|---------|
| `messages` | v1 | auto-increment | by-category, by-date | Custom daily messages |
| `photos` | v2 | auto-increment | by-date | Local photo cache |
| `moods` | v3 | auto-increment | by-date (UNIQUE) | Mood tracking + sync |
| `sw-auth` | v4 | 'current' | — | Service Worker auth token |
| `scripture-sessions` | v5 | UUID string | by-user | Session cache |
| `scripture-reflections` | v5 | UUID string | by-session | Reflection cache |
| `scripture-bookmarks` | v5 | UUID string | by-session | Bookmark cache |
| `scripture-messages` | v5 | UUID string | by-session | Message cache |

### messages Store

| Property | Type | Notes |
|----------|------|-------|
| id | number | Auto-increment PK |
| text | string | Message content |
| category | string | Indexed: reason/memory/affirmation/future/custom |
| isCustom | boolean | User-created vs preset |
| active | boolean | In rotation pool |
| createdAt | Date | Indexed for sorting |
| isFavorite | boolean | Favorite flag |
| tags | string[] | Search tags |

### moods Store

| Property | Type | Notes |
|----------|------|-------|
| id | number | Auto-increment PK |
| userId | string | User identifier |
| mood | string | Primary mood (backward compat) |
| moods | string[] | Multi-mood array |
| note | string | Optional note |
| date | string | UNIQUE index, ISO YYYY-MM-DD |
| synced | boolean | Supabase sync status |
| supabaseId | string | Remote UUID after sync |

### sw-auth Store

Singleton store (key: 'current'). Fields: accessToken, refreshToken, expiresAt, userId. Purpose: Background Sync auth persistence.

### Scripture Stores (v5)

Four stores (sessions, reflections, bookmarks, messages) with UUID keys from Supabase. Sessions indexed by-user; others indexed by-session. Fields mirror Supabase columns in camelCase.

## Version Migrations

| Upgrade | Change |
|---------|--------|
| v1→v2 | Delete/recreate photos store (blob→imageBlob rename) |
| v2→v3 | Add moods store with unique by-date index |
| v3→v4 | Add sw-auth store for Service Worker credentials |
| v4→v5 | Add 4 scripture stores (sessions, reflections, bookmarks, messages) |

Upgrade function in `src/services/dbSchema.ts` — idempotent, safe to call multiple times.

## Relationship Diagram

```
auth.users ──references──→ users (PK: id)
                            │ partner_id → users.id (self-referential)
                            │
    ┌───────────────────────┼───────────────────────┐
    ↓                       ↓                       ↓
  moods              love_notes              interactions
  photos             partner_requests
                            │
                            ↓
              scripture_sessions (PK: id)
                    ├── step_states
                    ├── reflections
                    ├── bookmarks
                    └── messages
```

## Data Flow

```
READ:  Supabase → Service (Zod validate + transform) → IndexedDB (cache) → Zustand → UI
WRITE: UI → Zustand action → Service → Supabase RPC/query
         → success: update IndexedDB + store
         → failure: queue for Background Sync retry
```

## Key Design Patterns

1. **Offline-First**: IndexedDB primary read source; Supabase authoritative write
2. **Zod Boundary**: All Supabase responses validated before cache write
3. **Transform Layer**: snake_case (Supabase) ↔ camelCase (local)
4. **Atomic Partners**: `accept_partner_request()` handles bidirectional link + auto-decline in single transaction
5. **Version Concurrency**: `version` field on scripture_sessions for conflict detection
6. **Idempotent Upserts**: UNIQUE constraints on reflections/bookmarks allow safe retries
7. **Path-Based Storage**: `{user_id}/{filename}` isolates files per user with RLS matching

## Seed Data

### scripture_seed_test_data RPC (Dev Only)

**Presets**: default (lobby), mid_session (step 7), completed (step 16), with_help_flags
**Guard**: Rejects if `app.environment = 'production'`
**Returns**: session_ids, test user IDs, optional reflection/message IDs
