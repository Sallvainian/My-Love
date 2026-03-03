# 8. Row Level Security Policies

RLS is enabled on all tables. All policies target the `authenticated` role.

## 8.1 `users`

| Policy                                   | Operation | Rule                                                                                                            |
| ---------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| Users can view self and partner profiles | SELECT    | `id = auth.uid() OR id = get_my_partner_id() OR partner_id = auth.uid()`                                        |
| Users can insert own profile             | INSERT    | `id = auth.uid()`                                                                                               |
| users_update_self_safe                   | UPDATE    | USING: `auth.uid() = id`; WITH CHECK: `auth.uid() = id AND partner_id IS NOT DISTINCT FROM get_my_partner_id()` |

**Security note:** The UPDATE policy prevents `partner_id` manipulation. Users cannot set `partner_id` to arbitrary values -- it must remain unchanged from its current value. This was a P0 security fix (migration `20251206200000`).

**Recursion fix:** The SELECT and UPDATE policies call `get_my_partner_id()` (SECURITY DEFINER) instead of querying `public.users` directly, which would cause infinite RLS recursion (PostgreSQL error 42P17).

## 8.2 `moods`

| Policy                          | Operation | Rule                            |
| ------------------------------- | --------- | ------------------------------- |
| Users can read own moods        | SELECT    | `user_id = auth.uid()`          |
| Partners can read partner moods | SELECT    | `user_id = get_my_partner_id()` |
| Users can insert own moods      | INSERT    | `user_id = auth.uid()`          |
| Users can update own moods      | UPDATE    | `user_id = auth.uid()`          |
| Users can delete own moods      | DELETE    | `user_id = auth.uid()`          |

## 8.3 `love_notes`

| Policy                              | Operation | Rule                                                   |
| ----------------------------------- | --------- | ------------------------------------------------------ |
| Sender and recipient can read notes | SELECT    | `from_user_id = auth.uid() OR to_user_id = auth.uid()` |
| Users can send notes                | INSERT    | `from_user_id = auth.uid()`                            |

**Note:** No UPDATE or DELETE policies. Love notes are immutable once sent.

## 8.4 `interactions`

| Policy                             | Operation | Rule                                                   |
| ---------------------------------- | --------- | ------------------------------------------------------ |
| Participants can view interactions | SELECT    | `from_user_id = auth.uid() OR to_user_id = auth.uid()` |
| Users can send interactions        | INSERT    | `from_user_id = auth.uid()`                            |
| Recipients can update interactions | UPDATE    | `to_user_id = auth.uid()`                              |

The UPDATE policy allows only the recipient to mark interactions as viewed.

## 8.5 `partner_requests`

| Policy                         | Operation | Rule                                                   |
| ------------------------------ | --------- | ------------------------------------------------------ |
| Participants can view requests | SELECT    | `from_user_id = auth.uid() OR to_user_id = auth.uid()` |
| Users can send requests        | INSERT    | `from_user_id = auth.uid()`                            |
| Recipients can update requests | UPDATE    | `to_user_id = auth.uid()`                              |

**Note:** Accept/decline operations use SECURITY DEFINER RPCs (`accept_partner_request`, `decline_partner_request`) which bypass RLS to perform the atomic partner linking.

## 8.6 `photos`

| Policy                                | Operation | Rule                            |
| ------------------------------------- | --------- | ------------------------------- |
| Users can view own photos             | SELECT    | `user_id = auth.uid()`          |
| Partners can view each other's photos | SELECT    | `user_id = get_my_partner_id()` |
| Users can upload own photos           | INSERT    | `user_id = auth.uid()`          |
| Users can delete own photos           | DELETE    | `user_id = auth.uid()`          |

## 8.7 `photos` Storage Bucket (`storage.objects`)

| Policy                           | Operation | Rule                                                                                 |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| Users can upload to own folder   | INSERT    | `bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]`          |
| Users can view own photos        | SELECT    | `bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]`          |
| Partners can view partner photos | SELECT    | `bucket_id = 'photos' AND get_my_partner_id()::text = (storage.foldername(name))[1]` |
| Users can delete own photos      | DELETE    | `bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]`          |

Path-based folder isolation: the first segment of the storage path must match the user's UUID.

## 8.8 `love-notes-images` Storage Bucket (`storage.objects`)

| Policy                                | Operation | Rule                                                                                                                                              |
| ------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users can upload images to own folder | INSERT    | `bucket_id = 'love-notes-images' AND auth.uid()::text = (storage.foldername(name))[1] AND storage.extension(name) IN ('jpg','jpeg','png','webp')` |
| Users can view own images             | SELECT    | `bucket_id = 'love-notes-images' AND auth.uid()::text = (storage.foldername(name))[1]`                                                            |
| Partners can view partner images      | SELECT    | `bucket_id = 'love-notes-images' AND get_my_partner_id()::text = (storage.foldername(name))[1]`                                                   |

**Note:** The INSERT policy includes file extension validation. The Edge Function uploads using the service role key (bypassing these policies), but these protect any direct client access.

## 8.9 `scripture_sessions`

| Policy                     | Operation | Rule                                             |
| -------------------------- | --------- | ------------------------------------------------ |
| Session members can view   | SELECT    | `user1_id = auth.uid() OR user2_id = auth.uid()` |
| Users can create sessions  | INSERT    | `user1_id = auth.uid()`                          |
| Session members can update | UPDATE    | `user1_id = auth.uid() OR user2_id = auth.uid()` |

## 8.10 `scripture_step_states`

| Policy                     | Operation | Rule                                      |
| -------------------------- | --------- | ----------------------------------------- |
| Session members can view   | SELECT    | `is_scripture_session_member(session_id)` |
| Session members can insert | INSERT    | `is_scripture_session_member(session_id)` |
| Session members can update | UPDATE    | `is_scripture_session_member(session_id)` |

Uses the `is_scripture_session_member()` helper to check membership without directly querying `scripture_sessions` in the policy.

## 8.11 `scripture_reflections`

| Policy                                    | Operation | Rule                                                               |
| ----------------------------------------- | --------- | ------------------------------------------------------------------ |
| Users can view own reflections            | SELECT    | `user_id = auth.uid()`                                             |
| Users can view shared partner reflections | SELECT    | `is_shared = true AND is_scripture_session_member(session_id)`     |
| Users can insert own reflections          | INSERT    | `user_id = auth.uid() AND is_scripture_session_member(session_id)` |
| Users can update own reflections          | UPDATE    | `user_id = auth.uid()`                                             |

## 8.12 `scripture_bookmarks`

| Policy                                  | Operation | Rule                                                                    |
| --------------------------------------- | --------- | ----------------------------------------------------------------------- |
| Users can view own bookmarks            | SELECT    | `user_id = auth.uid()`                                                  |
| Users can view shared partner bookmarks | SELECT    | `share_with_partner = true AND is_scripture_session_member(session_id)` |
| Users can insert own bookmarks          | INSERT    | `user_id = auth.uid() AND is_scripture_session_member(session_id)`      |
| Users can update own bookmarks          | UPDATE    | `user_id = auth.uid()`                                                  |
| Users can delete own bookmarks          | DELETE    | `user_id = auth.uid()`                                                  |

## 8.13 `scripture_messages`

| Policy                            | Operation | Rule                                                                 |
| --------------------------------- | --------- | -------------------------------------------------------------------- |
| Session members can view messages | SELECT    | `is_scripture_session_member(session_id)`                            |
| Users can send messages           | INSERT    | `sender_id = auth.uid() AND is_scripture_session_member(session_id)` |

## 8.14 `realtime.messages` (Private Broadcast Channels)

RLS on `realtime.messages` controls who can send/receive on private broadcast channels. Added in migration 15 (`20260220000001`). Recreated with UUID regex guard in migration 24 (`20260303000100`).

### UUID Regex Guard (Hardening)

All 4 policies include a regex validation step **before** the `::uuid` cast:

```sql
split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
```

This prevents SQL injection via crafted topic strings. Without this guard, a malicious topic like `scripture-session:not-a-uuid` would cause a PostgreSQL cast error. The regex uses lowercase hex only because `gen_random_uuid()` always produces lowercase.

### Scripture Session Broadcast Channel (`scripture-session:{uuid}`)

| Policy                                           | Operation | Rule                                                                                                                                                                                                          |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scripture_session_members_can_receive_broadcasts | SELECT    | `topic LIKE 'scripture-session:%' AND split_part(topic, ':', 2) ~ UUID_REGEX AND split_part(topic, ':', 2)::uuid IN (SELECT id FROM scripture_sessions WHERE user1_id = auth.uid() OR user2_id = auth.uid())` |
| scripture_session_members_can_send_broadcasts    | INSERT    | Same as SELECT but with `WITH CHECK` clause                                                                                                                                                                   |

The topic format is `scripture-session:{session_uuid}`. The policy extracts the UUID from the topic using `split_part(topic, ':', 2)`, validates it against the UUID regex, then verifies the user is a member of that session.

### Scripture Presence Channel (`scripture-presence:{uuid}`)

| Policy                                            | Operation | Rule                                                                                                                                                                                                           |
| ------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scripture_presence_members_can_receive_broadcasts | SELECT    | `topic LIKE 'scripture-presence:%' AND split_part(topic, ':', 2) ~ UUID_REGEX AND split_part(topic, ':', 2)::uuid IN (SELECT id FROM scripture_sessions WHERE user1_id = auth.uid() OR user2_id = auth.uid())` |
| scripture_presence_members_can_send_broadcasts    | INSERT    | Same as SELECT but with `WITH CHECK` clause                                                                                                                                                                    |

Added in migration 18 (`20260222000001`) for partner position tracking during reading. Recreated with UUID regex guard in migration 24 (`20260303000100`).

## Key Security Patterns

1. **SECURITY DEFINER helpers** break RLS recursion (`get_my_partner_id()`, `is_scripture_session_member()`)
2. **Partner access** is always mediated through `get_my_partner_id()`, never through direct user table queries in policies
3. **Path-based folder isolation** in Storage policies uses `storage.foldername(name)[1]` to extract the user ID from the path
4. **No UPDATE on love_notes** -- messages are immutable once sent
5. **partner_id immutability** in the users UPDATE policy prevents privilege escalation
6. **Private broadcast channels** require `realtime.messages` RLS to verify session membership before allowing send/receive
7. **Topic-based channel authorization** uses `split_part()` to extract session UUID from topic string and verify membership
8. **UUID regex guard** on all `realtime.messages` policies validates the extracted UUID segment against a lowercase hex regex before the `::uuid` cast, preventing SQL injection and cast errors from malformed topic strings (hardening migration 24)
