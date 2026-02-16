# 4. Relationships

## Entity Relationship Summary

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

## Foreign Key Details

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
