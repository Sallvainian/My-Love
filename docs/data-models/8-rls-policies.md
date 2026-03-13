# 8. Row Level Security Policies

RLS is enabled on all tables. All policies target the `authenticated` role.

## Anti-Recursion Pattern

Partner lookup in RLS policies would cause infinite recursion if done via a subquery on the `users` table (which itself has RLS). The solution uses a `SECURITY DEFINER` function:

```sql
CREATE OR REPLACE FUNCTION get_partner_id(user_id UUID)
RETURNS UUID AS $$
  SELECT partner_id FROM users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

This function bypasses RLS, preventing the recursion. All partner-related policies reference `get_partner_id(auth.uid())` instead of subquerying `users` directly.

## users

| Policy                              | Operation | Rule                                        |
| ----------------------------------- | --------- | ------------------------------------------- |
| Users can view own profile          | SELECT    | `auth.uid() = id`                           |
| Users can update own profile        | UPDATE    | `auth.uid() = id`                           |
| Users can insert own profile        | INSERT    | `auth.uid() = id`                           |
| Partners can view each other        | SELECT    | `id = get_partner_id(auth.uid())`           |
| Allow authenticated users to search | SELECT    | `true` (all authenticated users can search) |

**Security fix (migration 20260206):** The update policy prevents privilege escalation by restricting which columns can be updated. Users cannot modify their own `id` or set arbitrary `partner_id` values.

## moods

| Policy                               | Operation | Rule                                   |
| ------------------------------------ | --------- | -------------------------------------- |
| Users can view own moods             | SELECT    | `auth.uid() = user_id`                 |
| Users can insert own moods           | INSERT    | `auth.uid() = user_id`                 |
| Users can update own moods           | UPDATE    | `auth.uid() = user_id`                 |
| Users can delete own moods           | DELETE    | `auth.uid() = user_id`                 |
| Partners can view each other's moods | SELECT    | `user_id = get_partner_id(auth.uid())` |

**Note:** Partner mood viewing via postgres_changes does not work due to the subquery in the partner policy. The app uses Broadcast API instead for real-time partner mood updates.

## love_notes

| Policy                          | Operation | Rule                                                   |
| ------------------------------- | --------- | ------------------------------------------------------ |
| Users can view own notes        | SELECT    | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can send notes to partner | INSERT    | `auth.uid() = from_user_id`                            |

## interactions

| Policy                            | Operation | Rule                                                     |
| --------------------------------- | --------- | -------------------------------------------------------- |
| Users can view own interactions   | SELECT    | `auth.uid() = from_user_id OR auth.uid() = to_user_id`   |
| Users can send interactions       | INSERT    | `auth.uid() = from_user_id`                              |
| Users can update own interactions | UPDATE    | `auth.uid() = to_user_id` (recipient can mark as viewed) |

## partner_requests

| Policy                      | Operation | Rule                                                   |
| --------------------------- | --------- | ------------------------------------------------------ |
| Users can view own requests | SELECT    | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can send requests     | INSERT    | `auth.uid() = from_user_id`                            |

**Note:** Accept/decline operations go through RPC functions that handle the status update atomically.

## photos

| Policy                                | Operation | Rule                                   |
| ------------------------------------- | --------- | -------------------------------------- |
| Users can view own photos             | SELECT    | `auth.uid() = user_id`                 |
| Partners can view each other's photos | SELECT    | `user_id = get_partner_id(auth.uid())` |
| Users can insert own photos           | INSERT    | `auth.uid() = user_id`                 |
| Users can update own photos           | UPDATE    | `auth.uid() = user_id`                 |
| Users can delete own photos           | DELETE    | `auth.uid() = user_id`                 |

## scripture_sessions

| Policy                     | Operation | Rule                              |
| -------------------------- | --------- | --------------------------------- |
| Session members can view   | SELECT    | `is_scripture_session_member(id)` |
| Authenticated can create   | INSERT    | `auth.uid() = user1_id`           |
| Session members can update | UPDATE    | `is_scripture_session_member(id)` |

## scripture_step_states

| Policy                     | Operation | Rule                                      |
| -------------------------- | --------- | ----------------------------------------- |
| Session members can view   | SELECT    | `is_scripture_session_member(session_id)` |
| Session members can insert | INSERT    | `is_scripture_session_member(session_id)` |
| Session members can update | UPDATE    | `is_scripture_session_member(session_id)` |

## scripture_reflections

| Policy                   | Operation | Rule                                      |
| ------------------------ | --------- | ----------------------------------------- |
| Session members can view | SELECT    | `is_scripture_session_member(session_id)` |
| Users can insert own     | INSERT    | `auth.uid() = user_id`                    |

## scripture_bookmarks

| Policy                   | Operation | Rule                                      |
| ------------------------ | --------- | ----------------------------------------- |
| Session members can view | SELECT    | `is_scripture_session_member(session_id)` |
| Users can insert own     | INSERT    | `auth.uid() = user_id`                    |
| Users can update own     | UPDATE    | `auth.uid() = user_id`                    |
| Users can delete own     | DELETE    | `auth.uid() = user_id`                    |

## scripture_messages

| Policy                     | Operation | Rule                                      |
| -------------------------- | --------- | ----------------------------------------- |
| Session members can view   | SELECT    | `is_scripture_session_member(session_id)` |
| Session members can insert | INSERT    | `is_scripture_session_member(session_id)` |

## Helper Functions Used by Policies

### `is_scripture_session_member(p_session_id UUID) RETURNS BOOLEAN`

Checks if `auth.uid()` is `user1_id` or `user2_id` of the session. Used by all scripture table policies.

### `get_partner_id(user_id UUID) RETURNS UUID`

Returns `partner_id` for a user. `SECURITY DEFINER` to bypass RLS. Used by `users`, `moods`, `photos`, `interactions` policies.
