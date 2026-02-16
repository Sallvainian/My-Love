# 3. Row Level Security Policies

All tables have RLS enabled. Policies are listed below grouped by table with the final state after all migrations (including drops and replacements).

## 3.1 `users`

| Policy | Operation | Rule |
|---|---|---|
| Users can view self and partner profiles | SELECT | Own row, or partner's row (via `partner_id` lookup), or row where `partner_id = auth.uid()` |
| users_update_self_safe | UPDATE | Own row only, AND `partner_id` must not change from its current value |
| Users can insert own profile | INSERT | `auth.uid() = id` |

> **Security note:** The update policy prevents privilege escalation by blocking direct `partner_id` modifications. Partner linking is only possible through the `accept_partner_request()` SECURITY DEFINER function.

## 3.2 `moods`

| Policy | Operation | Rule |
|---|---|---|
| Users can view own and partner moods | SELECT | `auth.uid() = user_id` OR user is a partner of the mood owner |
| Users can insert own moods | INSERT | `auth.uid() = user_id` |
| Users can update own moods | UPDATE | `auth.uid() = user_id` |
| Users can delete own moods | DELETE | `auth.uid() = user_id` |

## 3.3 `love_notes`

| Policy | Operation | Rule |
|---|---|---|
| Users can view their own messages | SELECT | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can insert their own messages | INSERT | `auth.uid() = from_user_id` |

## 3.4 `interactions`

| Policy | Operation | Rule |
|---|---|---|
| Users can view interactions to/from them | SELECT | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can insert interactions | INSERT | `auth.uid() = from_user_id` |
| Users can update received interactions | UPDATE | `auth.uid() = to_user_id` (mark as viewed) |

## 3.5 `partner_requests`

| Policy | Operation | Rule |
|---|---|---|
| Users can view their requests | SELECT | `auth.uid() = from_user_id OR auth.uid() = to_user_id` |
| Users can create partner requests | INSERT | `auth.uid() = from_user_id` |
| Users can update received requests | UPDATE | `auth.uid() = to_user_id` |

## 3.6 `photos`

| Policy | Operation | Rule |
|---|---|---|
| Users can view own photos | SELECT | `auth.uid() = user_id` |
| Partners can view partner photos | SELECT | Partner relationship exists via `users.partner_id` |
| Users can insert own photos | INSERT | `auth.uid() = user_id` |
| Users can delete own photos | DELETE | `auth.uid() = user_id` |

## 3.7 `photos` Storage Bucket (`storage.objects`)

| Policy | Operation | Rule |
|---|---|---|
| Users can upload own photos | INSERT | `bucket_id = 'photos'` AND first folder segment = `auth.uid()` |
| Users can read own photos | SELECT | `bucket_id = 'photos'` AND first folder segment = `auth.uid()` |
| Partners can read partner photos | SELECT | `bucket_id = 'photos'` AND first folder segment = partner's ID |
| Users can delete own photos from storage | DELETE | `bucket_id = 'photos'` AND first folder segment = `auth.uid()` |

## 3.8 `love-notes-images` Storage Bucket (`storage.objects`)

| Policy | Operation | Rule |
|---|---|---|
| Users upload own love note images | INSERT | `bucket_id = 'love-notes-images'` AND folder = `auth.uid()` AND extension IN (`jpg`, `jpeg`, `png`, `webp`) |
| Users read own love note images | SELECT | `bucket_id = 'love-notes-images'` AND folder = `auth.uid()` |
| Partners read partner love note images | SELECT | `bucket_id = 'love-notes-images'` AND folder = partner's ID |
| Users delete own love note images | DELETE | `bucket_id = 'love-notes-images'` AND folder = `auth.uid()` |

## 3.9 `scripture_sessions`

| Policy | Operation | Rule |
|---|---|---|
| scripture_sessions_select | SELECT | `user1_id = auth.uid() OR user2_id = auth.uid()` |
| scripture_sessions_insert | INSERT | `user1_id = auth.uid()` |
| scripture_sessions_update | UPDATE | `user1_id = auth.uid() OR user2_id = auth.uid()` |

## 3.10 `scripture_step_states`

| Policy | Operation | Rule |
|---|---|---|
| scripture_step_states_select | SELECT | `is_scripture_session_member(session_id)` |
| scripture_step_states_insert | INSERT | `is_scripture_session_member(session_id)` |
| scripture_step_states_update | UPDATE | `is_scripture_session_member(session_id)` |

## 3.11 `scripture_reflections`

| Policy | Operation | Rule |
|---|---|---|
| scripture_reflections_select | SELECT | Own reflections, or shared reflections in own sessions |
| scripture_reflections_insert | INSERT | `user_id = auth.uid()` AND session member |
| scripture_reflections_update | UPDATE | `user_id = auth.uid()` |

## 3.12 `scripture_bookmarks`

| Policy | Operation | Rule |
|---|---|---|
| scripture_bookmarks_select | SELECT | Own bookmarks, or shared bookmarks in own sessions |
| scripture_bookmarks_insert | INSERT | `user_id = auth.uid()` AND session member |
| scripture_bookmarks_update | UPDATE | `user_id = auth.uid()` |
| scripture_bookmarks_delete | DELETE | `user_id = auth.uid()` |

## 3.13 `scripture_messages`

| Policy | Operation | Rule |
|---|---|---|
| scripture_messages_select | SELECT | `is_scripture_session_member(session_id)` |
| scripture_messages_insert | INSERT | `sender_id = auth.uid()` AND session member |

---
