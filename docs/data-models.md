# Data Models

> Database schema and data structure documentation for My-Love project.
> Last updated: 2026-01-30 | Scan level: Deep (Rescan)

## Database Overview

PostgreSQL via Supabase with Row Level Security (RLS) on all tables. 11 tables total (6 original + 5 scripture reading). 8 migrations. IndexedDB v5 for offline storage.

## Supabase Tables

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, references auth.users |
| email | text | |
| display_name | text | |
| partner_id | UUID | FK → users.id, nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Users can read/update own record. Partner read via partner_id.

### moods

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| mood_type | text | Legacy single mood |
| mood_types | text[] | Array of selected moods |
| note | text | 200 char max |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Mood enum: `loved`, `happy`, `content`, `excited`, `thoughtful`, `grateful`, `sad`, `anxious`, `frustrated`, `angry`, `lonely`, `tired`

### love_notes

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| from_user_id | UUID | FK → auth.users |
| to_user_id | UUID | FK → auth.users |
| content | text | |
| image_url | text | nullable, storage path |
| created_at | timestamptz | default now() |

### interactions

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| from_user_id | UUID | FK → auth.users |
| to_user_id | UUID | FK → auth.users |
| type | text | 'poke' or 'kiss' |
| viewed | boolean | default false |
| created_at | timestamptz | default now() |

### partner_requests

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| from_user_id | UUID | FK → auth.users |
| to_user_id | UUID | FK → auth.users |
| status | text | pending/accepted/declined |
| created_at | timestamptz | default now() |

### photos

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| storage_path | text | Supabase storage path |
| caption | text | nullable |
| mime_type | text | jpeg/png/webp |
| file_size | integer | bytes |
| width | integer | pixels |
| height | integer | pixels |
| created_at | timestamptz | default now() |

## Scripture Reading Tables (NEW - Sprint 0)

### Enum Types

- `scripture_session_mode`: 'solo' | 'together'
- `scripture_session_phase`: 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete'
- `scripture_session_status`: 'pending' | 'in_progress' | 'complete' | 'abandoned'

### scripture_sessions

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| mode | scripture_session_mode | NOT NULL |
| user1_id | UUID | FK → auth.users, NOT NULL |
| user2_id | UUID | FK → auth.users, nullable |
| current_phase | scripture_session_phase | |
| current_step_index | INT | 0-16 |
| status | scripture_session_status | |
| version | INT | Concurrency control |
| snapshot_json | JSONB | Session state snapshot |
| started_at | timestamptz | default now() |
| completed_at | timestamptz | nullable |

Indexes: `(user1_id, started_at DESC)`, `(user2_id, started_at DESC)`

### scripture_step_states

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK → scripture_sessions, CASCADE |
| step_index | INT | 0-16 |
| user1_locked_at | timestamptz | nullable |
| user2_locked_at | timestamptz | nullable |
| advanced_at | timestamptz | nullable |

UNIQUE constraint: `(session_id, step_index)`

### scripture_reflections

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK → scripture_sessions |
| step_index | INT | |
| user_id | UUID | FK → auth.users |
| rating | INT | CHECK 1-5 |
| notes | TEXT | |
| is_shared | BOOLEAN | default false |
| created_at | timestamptz | default now() |

UNIQUE constraint: `(session_id, step_index, user_id)`

### scripture_bookmarks

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK → scripture_sessions |
| step_index | INT | |
| user_id | UUID | FK → auth.users |
| share_with_partner | BOOLEAN | default false |
| created_at | timestamptz | default now() |

UNIQUE constraint: `(session_id, step_index, user_id)`

### scripture_messages

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK → scripture_sessions |
| sender_id | UUID | FK → auth.users |
| message | TEXT | NOT NULL |
| created_at | timestamptz | default now() |

Index: `(session_id, created_at)`

## RLS Policies

### Scripture Session Access

- **SELECT**: user is `user1_id` OR `user2_id`
- **INSERT**: user creates as `user1`
- **UPDATE**: user is session member

### Scripture Reflections

- **SELECT** own OR shared where session member
- **INSERT/UPDATE** own only

### Scripture Bookmarks

- **SELECT** own OR shared where session member
- **INSERT/UPDATE/DELETE** own only

### Scripture Messages

- **SELECT**: session member
- **INSERT**: sender is current user AND session member

## IndexedDB Schema (v5)

| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| messages | id (autoIncrement) | - | Love messages |
| photos | id (autoIncrement) | by-date | Photo metadata |
| moods | id (autoIncrement) | by-date | Mood entries (offline) |
| sw-auth | key (string) | - | JWT tokens for SW |
| scripture-sessions | id (string) | - | Session cache |
| scripture-reflections | id (string) | by-session | Reflection cache |
| scripture-bookmarks | id (string) | by-session | Bookmark cache |
| scripture-messages | id (string) | by-session | Message cache |

## Migrations

| Migration | Date | Description |
|-----------|------|-------------|
| 20251203000001 | 2025-12-03 | Base schema (users, moods, interactions, partner_requests) |
| 20251203190800 | 2025-12-03 | Photos table |
| 20251205000001 | 2025-12-05 | Love notes images |
| 20251205000002 | 2025-12-05 | MIME type validation |
| 20251206024345 | 2025-12-06 | Remote schema |
| 20251206124803 | 2025-12-06 | Fix users RLS policy |
| 20251206200000 | 2025-12-06 | Fix privilege escalation |
| 20260128000001 | 2026-01-28 | Scripture reading (5 tables, 3 enums, RLS, RPC, test data seeding) |

## Data Flow

```
Components → Hooks → Store (Zustand) → Services → API (Supabase)
                                     ↓
                              IndexedDB (offline cache)
```
