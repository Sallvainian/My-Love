# 1. Database Schema Overview

The Supabase database uses PostgreSQL with Row Level Security (RLS) enabled on all tables. The schema covers two primary feature areas: the core couples app (users, moods, love notes, interactions, photos, partner requests) and the scripture reading feature (sessions, step states, reflections, bookmarks, messages).

## Tables Summary

| Table                   | PK Type                  | RLS | Purpose                        |
| ----------------------- | ------------------------ | --- | ------------------------------ |
| `users`                 | UUID (from `auth.users`) | Yes | User profiles, partner linking |
| `moods`                 | UUID (auto)              | Yes | Mood tracking entries          |
| `love_notes`            | UUID (auto)              | Yes | Chat messages between partners |
| `interactions`          | UUID (auto)              | Yes | Poke/kiss interactions         |
| `partner_requests`      | UUID (auto)              | Yes | Partner connection requests    |
| `photos`                | UUID (auto)              | Yes | Photo metadata (storage refs)  |
| `scripture_sessions`    | UUID (auto)              | Yes | Reading session state          |
| `scripture_step_states` | UUID (auto)              | Yes | Per-step lock-in tracking      |
| `scripture_reflections` | UUID (auto)              | Yes | Post-reading reflections       |
| `scripture_bookmarks`   | UUID (auto)              | Yes | Step bookmarks                 |
| `scripture_messages`    | UUID (auto)              | Yes | Daily prayer report messages   |

## Custom Enum Types

| Enum                       | Values                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `mood_type`                | `loved`, `happy`, `content`, `excited`, `thoughtful`, `grateful`, `sad`, `anxious`, `frustrated`, `angry`, `lonely`, `tired` |
| `scripture_session_mode`   | `solo`, `together`                                                                                                           |
| `scripture_session_phase`  | `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete`                                                          |
| `scripture_session_status` | `pending`, `in_progress`, `complete`, `abandoned`                                                                            |
| `scripture_session_role`   | `reader`, `responder`                                                                                                        |

## Entity Relationships

```
auth.users (Supabase Auth)
  |
  +--< users (1:1, id = auth.users.id)
  |     |
  |     +--< users.partner_id (self-referencing FK)
  |
  +--< moods (1:many, user_id)
  |
  +--< love_notes (1:many, from_user_id / to_user_id)
  |
  +--< interactions (1:many, from_user_id / to_user_id)
  |
  +--< partner_requests (1:many, from_user_id / to_user_id)
  |
  +--< photos (1:many, user_id)
  |
  +--< scripture_sessions (1:many, user1_id / user2_id)
        |
        +--< scripture_step_states (1:many, session_id)
        +--< scripture_reflections (1:many, session_id)
        +--< scripture_bookmarks (1:many, session_id)
        +--< scripture_messages (1:many, session_id)
```

## Storage Buckets

| Bucket              | Access                | Purpose                |
| ------------------- | --------------------- | ---------------------- |
| `photos`            | Private (signed URLs) | User photo uploads     |
| `love-notes-images` | Private (signed URLs) | Chat image attachments |

## RPC Functions (13 total)

- **Partner management:** `accept_partner_request`, `decline_partner_request`, `get_my_partner_id`
- **Scripture sessions:** `scripture_create_session`, `scripture_lock_in`, `scripture_submit_reflection`, `scripture_get_couple_stats`, `scripture_end_session`, `scripture_convert_to_solo`
- **Helpers:** `is_scripture_session_member`, `get_partner_id` (SECURITY DEFINER)
- **Testing:** `scripture_seed_test_data`

## IndexedDB (Client-Side)

Database name: `my-love-db`, version: `5`

8 object stores providing offline support and caching. See Section 3 for details.
