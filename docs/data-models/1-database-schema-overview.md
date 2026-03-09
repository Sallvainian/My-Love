# 1. Database Schema Overview

The Supabase database uses PostgreSQL with Row Level Security (RLS) enabled on all tables. The schema covers two primary feature areas: the core couples app (users, moods, love notes, interactions, photos, partner requests) and the scripture reading feature (sessions, step states, reflections, bookmarks, messages).

## Supabase Tables

| Table                   | Description                                                 | RLS     |
| ----------------------- | ----------------------------------------------------------- | ------- |
| `users`                 | User profiles linked to `auth.users`, partner relationships | Enabled |
| `moods`                 | Mood tracking entries with optional notes                   | Enabled |
| `love_notes`            | Messages between partners with optional image attachments   | Enabled |
| `interactions`          | Quick interactions (poke, kiss) between partners            | Enabled |
| `partner_requests`      | Partnership invitation workflow                             | Enabled |
| `photos`                | Photo gallery metadata (files stored in Supabase Storage)   | Enabled |
| `scripture_sessions`    | Scripture reading session state and progress                | Enabled |
| `scripture_step_states` | Per-step lock/advance timestamps for sessions               | Enabled |
| `scripture_reflections` | User reflections with ratings per reading step              | Enabled |
| `scripture_bookmarks`   | Bookmarked reading steps                                    | Enabled |
| `scripture_messages`    | Prayer report messages within a session                     | Enabled |

## Custom Enum Types

| Enum                       | Values                                                              | Added In             |
| -------------------------- | ------------------------------------------------------------------- | -------------------- |
| `scripture_session_mode`   | `solo`, `together`                                                  | Migration 8 (01-28)  |
| `scripture_session_phase`  | `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete` | Migration 8 (01-28)  |
| `scripture_session_status` | `pending`, `in_progress`, `complete`, `abandoned`, `ended_early`    | Migration 8 + 19     |
| `scripture_session_role`   | `reader`, `responder`                                               | Migration 15 (02-20) |

> **Note:** The `ended_early` value was added to `scripture_session_status` in migration 19 (`20260228000001`) via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

> **Note:** The original `mood_type`, `interaction_type`, and `partner_request_status` enums were dropped in migration 5 (`20251206024345`) and replaced with TEXT columns plus CHECK constraints.

## Storage Buckets

| Bucket              | Public | Size Limit | Purpose                     |
| ------------------- | ------ | ---------- | --------------------------- |
| `photos`            | No     | 10 MB      | Photo gallery images        |
| `love-notes-images` | No     | Default    | Love note image attachments |

## RPC Functions (Summary)

| Function                      | Security | Purpose                           |
| ----------------------------- | -------- | --------------------------------- |
| `accept_partner_request`      | DEFINER  | Atomic partner linking            |
| `decline_partner_request`     | DEFINER  | Decline with validation           |
| `get_my_partner_id`           | DEFINER  | RLS recursion breaker             |
| `is_scripture_session_member` | DEFINER  | RLS membership helper             |
| `sync_user_profile`           | DEFINER  | auth.users trigger                |
| `scripture_create_session`    | DEFINER  | Session creation with lobby reuse |
| `scripture_submit_reflection` | DEFINER  | Idempotent reflection upsert      |
| `scripture_seed_test_data`    | DEFINER  | Test data seeding with presets    |
| `scripture_get_couple_stats`  | DEFINER  | Couple statistics (CTE-optimized) |
| `scripture_select_role`       | INVOKER  | Lobby role selection              |
| `scripture_toggle_ready`      | INVOKER  | Lobby ready state with countdown  |
| `scripture_convert_to_solo`   | INVOKER  | Convert together to solo          |
| `scripture_lock_in`           | INVOKER  | Synchronized reading step lock    |
| `scripture_undo_lock_in`      | INVOKER  | Undo step lock                    |
| `scripture_end_session`       | INVOKER  | Graceful early termination        |

## Key Schema Patterns

- **Optimistic concurrency control:** `scripture_sessions.version` field is checked by `scripture_lock_in` and bumped by all mutation RPCs.
- **`FOR UPDATE` row locking:** All scripture RPCs use `SELECT ... FOR UPDATE` to prevent race conditions.
- **Phase guards:** RPCs validate `current_phase` before allowing mutations.
- **SECURITY INVOKER with `SET search_path = ''`:** Scripture RPCs run as the calling user (RLS applies) with a locked search path.
- **SECURITY DEFINER helpers:** Break RLS recursion or bypass RLS for specific internal lookups.
- **Client-side broadcasts:** After migration 21, all Realtime broadcasts are sent from the client via `channel.send()`, not from server-side `realtime.send()`.

---
