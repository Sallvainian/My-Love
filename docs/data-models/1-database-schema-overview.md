# 1. Database Schema Overview

The Supabase database uses PostgreSQL with Row Level Security (RLS) enabled on all tables. The schema covers two primary feature areas: the core couples app and the scripture reading feature.

## Tables (10 total)

### Core App Tables

| Table              | Purpose                            | FK References                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------- |
| `users`            | User profiles, partner linking     | `auth.users(id)`, self-ref `partner_id`           |
| `moods`            | Mood tracking entries              | `users(id)` via `user_id`                         |
| `love_notes`       | Chat messages between partners     | `auth.users(id)` via `from_user_id`, `to_user_id` |
| `interactions`     | Poke/kiss interactions             | `users(id)` via `from_user_id`, `to_user_id`      |
| `partner_requests` | Partner connection requests        | `users(id)` via `from_user_id`, `to_user_id`      |
| `photos`           | Photo metadata (storage in bucket) | `auth.users(id)` via `user_id`                    |

### Scripture Reading Tables

| Table                   | Purpose                          | FK References                               |
| ----------------------- | -------------------------------- | ------------------------------------------- |
| `scripture_sessions`    | Reading sessions (solo/together) | `auth.users(id)` via `user1_id`, `user2_id` |
| `scripture_step_states` | Per-step lock-in tracking        | `scripture_sessions(id)`                    |
| `scripture_reflections` | User reflections per step        | `scripture_sessions(id)`, `auth.users(id)`  |
| `scripture_bookmarks`   | Verse bookmarks                  | `scripture_sessions(id)`, `auth.users(id)`  |
| `scripture_messages`    | Daily Prayer Report messages     | `scripture_sessions(id)`, `auth.users(id)`  |

## Enums (4 types)

| Enum                       | Values                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| `scripture_session_mode`   | `solo`, `together`                                                  |
| `scripture_session_phase`  | `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete` |
| `scripture_session_status` | `pending`, `in_progress`, `complete`, `abandoned`, `ended_early`    |
| `scripture_session_role`   | `reader`, `responder`                                               |

**Note:** `mood_type`, `interaction_type`, and `partner_request_status` were originally enums but were converted to TEXT with CHECK constraints in migration `20251206024345`.

## Storage Buckets (2)

| Bucket              | Public | Size Limit | Purpose                          |
| ------------------- | ------ | ---------- | -------------------------------- |
| `photos`            | No     | 10MB       | Photo gallery images             |
| `love-notes-images` | No     | -          | Love note chat image attachments |

## RPC Functions (13)

See [RPC Functions](./6-supabase-rpc-functions.md) for full documentation.

## Edge Functions (1)

| Function                 | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `upload-love-note-image` | Server-side image validation, MIME detection, rate limiting |

## Triggers (1)

| Trigger                | Table        | Function              | Events                 |
| ---------------------- | ------------ | --------------------- | ---------------------- |
| `on_auth_user_created` | `auth.users` | `sync_user_profile()` | AFTER INSERT OR UPDATE |

The trigger auto-syncs `auth.users` to `public.users` table on signup/profile update.
