# 8. Row Level Security Policies

RLS is enabled on all tables. Policies target `authenticated` or `public` role as noted.

## users

| Policy                                   | Operation              | Rule                                                                        |
| ---------------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| Users can view self and partner profiles | SELECT (authenticated) | `id = auth.uid() OR id = get_my_partner_id() OR partner_id = auth.uid()`    |
| Users can insert own profile             | INSERT (public)        | `auth.uid() = id`                                                           |
| users_update_self_safe                   | UPDATE (authenticated) | `auth.uid() = id` AND `partner_id IS NOT DISTINCT FROM get_my_partner_id()` |

The `get_my_partner_id()` SECURITY DEFINER function breaks RLS recursion (can't reference `users` table in its own RLS policy).

The UPDATE policy prevents partner_id manipulation -- users can update display_name, email, etc. but `partner_id` must stay unchanged. Partner linking only through `accept_partner_request()` RPC.

## moods

| Policy                               | Operation | Rule                                                        |
| ------------------------------------ | --------- | ----------------------------------------------------------- |
| Users can view own and partner moods | SELECT    | Complex UNION query checking both directions of partnership |
| Users can insert own moods           | INSERT    | `auth.uid() = user_id`                                      |
| Users can update own moods           | UPDATE    | `auth.uid() = user_id`                                      |
| Users can delete own moods           | DELETE    | `auth.uid() = user_id`                                      |

## love_notes

| Policy                              | Operation | Rule                                                   |
| ----------------------------------- | --------- | ------------------------------------------------------ |
| Users can view their own messages   | SELECT    | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can insert their own messages | INSERT    | `auth.uid() = from_user_id`                            |

## interactions

| Policy                                   | Operation | Rule                                                   |
| ---------------------------------------- | --------- | ------------------------------------------------------ |
| Users can view interactions to/from them | SELECT    | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can insert interactions            | INSERT    | `auth.uid() = from_user_id`                            |
| Users can update received interactions   | UPDATE    | `auth.uid() = to_user_id`                              |

## partner_requests

| Policy                             | Operation | Rule                                                   |
| ---------------------------------- | --------- | ------------------------------------------------------ |
| Users can view their requests      | SELECT    | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can create partner requests  | INSERT    | `auth.uid() = from_user_id`                            |
| Users can update received requests | UPDATE    | `auth.uid() = to_user_id`                              |

## photos

| Policy                           | Operation | Rule                                               |
| -------------------------------- | --------- | -------------------------------------------------- |
| Users can view own photos        | SELECT    | `auth.uid() = user_id`                             |
| Partners can view partner photos | SELECT    | `EXISTS (users WHERE partner_id = photos.user_id)` |
| Users can insert own photos      | INSERT    | `auth.uid() = user_id`                             |
| Users can delete own photos      | DELETE    | `auth.uid() = user_id`                             |

## scripture_sessions

| Policy                    | Operation | Rule                                             |
| ------------------------- | --------- | ------------------------------------------------ |
| scripture_sessions_select | SELECT    | `user1_id = auth.uid() OR user2_id = auth.uid()` |
| scripture_sessions_insert | INSERT    | `user1_id = auth.uid()`                          |
| scripture_sessions_update | UPDATE    | `user1_id = auth.uid() OR user2_id = auth.uid()` |

## scripture_step_states

All operations use `is_scripture_session_member(session_id)` helper.

## scripture_reflections

| Policy | Operation | Rule                                                     |
| ------ | --------- | -------------------------------------------------------- |
| SELECT | SELECT    | Own reflections OR (shared AND session member)           |
| INSERT | INSERT    | `user_id = auth.uid() AND is_session_member(session_id)` |
| UPDATE | UPDATE    | `user_id = auth.uid()`                                   |

## scripture_bookmarks

| Policy | Operation | Rule                                                     |
| ------ | --------- | -------------------------------------------------------- |
| SELECT | SELECT    | Own bookmarks OR (share_with_partner AND session member) |
| INSERT | INSERT    | `user_id = auth.uid() AND is_session_member(session_id)` |
| UPDATE | UPDATE    | `user_id = auth.uid()`                                   |
| DELETE | DELETE    | `user_id = auth.uid()`                                   |

## scripture_messages

| Policy | Operation | Rule                                                       |
| ------ | --------- | ---------------------------------------------------------- |
| SELECT | SELECT    | `is_scripture_session_member(session_id)`                  |
| INSERT | INSERT    | `sender_id = auth.uid() AND is_session_member(session_id)` |

## realtime.messages (Private Broadcast Channels)

| Policy                                            | Operation | Topic Pattern          |
| ------------------------------------------------- | --------- | ---------------------- |
| scripture_session_members_can_receive_broadcasts  | SELECT    | `scripture-session:%`  |
| scripture_session_members_can_send_broadcasts     | INSERT    | `scripture-session:%`  |
| scripture_presence_members_can_receive_broadcasts | SELECT    | `scripture-presence:%` |
| scripture_presence_members_can_send_broadcasts    | INSERT    | `scripture-presence:%` |

All check `split_part(topic, ':', 2)::uuid` against `scripture_sessions` membership.
