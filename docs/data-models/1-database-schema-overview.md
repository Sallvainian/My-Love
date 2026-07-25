# 1. Database Schema Overview

The Supabase database uses PostgreSQL with Row Level Security (RLS) enabled on all tables. The schema covers two primary feature areas: the core couples app and the scripture reading feature.

## Tables (12 total)

### Core App Tables

| Table              | Purpose                            | FK References                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------- |
| `users`            | User profiles, partner linking     | `auth.users(id)`, self-ref `partner_id`           |
| `moods`            | Mood tracking entries              | `users(id)` via `user_id`                         |
| `love_notes`       | Chat messages between partners     | `auth.users(id)` via `from_user_id`, `to_user_id` |
| `interactions`     | Poke/kiss interactions             | `users(id)` via `from_user_id`, `to_user_id`      |
| `partner_requests` | Partner connection requests        | `users(id)` via `from_user_id`, `to_user_id`      |
| `photos`           | Photo metadata (storage in bucket) | `auth.users(id)` via `user_id`                    |

### Infrastructure Tables

| Table                | Purpose                                | FK References |
| -------------------- | -------------------------------------- | ------------- |
| `claude_bot_config`  | CI bot test credentials (key/value)    | none          |

`claude_bot_config` (added 2026-03-16) stores the login for the automated review bot used in CI. RLS is **enabled with no policies at all**, which means `anon` and `authenticated` have no access whatsoever -- only `service_role` can read it. It is deliberately excluded from the app's client-side type usage.

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

## RPC Functions (14 callable + 1 internal helper)

| Function                          | Purpose                                            |
| --------------------------------- | -------------------------------------------------- |
| `accept_partner_request`          | Links two users, marks request accepted             |
| `decline_partner_request`         | Marks request declined                              |
| `get_my_partner_id`               | SECURITY DEFINER helper, breaks RLS recursion       |
| `is_scripture_session_member`     | Membership predicate used by RLS policies           |
| `scripture_create_session`        | Creates solo/together session (together → lobby)    |
| `scripture_select_role`           | Lobby: pick reader/responder                        |
| `scripture_toggle_ready`          | Lobby: toggle ready, starts countdown when both     |
| `scripture_convert_to_solo`       | Lobby: detach partner, continue solo                |
| `scripture_lock_in`               | Reading: lock step, advance when both locked        |
| `scripture_undo_lock_in`          | Reading: release a lock                             |
| `scripture_end_session`           | Ends session early (`ended_early` status)           |
| `scripture_submit_reflection`     | Upsert a per-step reflection                        |
| `scripture_get_couple_stats`      | CTE-based couple aggregate for the stats panel      |
| `scripture_seed_test_data`        | Test-only seeding (presets incl. `unlinked`, `at_reflection`) |

`graphql` also appears in the generated types; it belongs to the `pg_graphql` extension, not this app.

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
