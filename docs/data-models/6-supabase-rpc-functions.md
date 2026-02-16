# 6. Supabase RPC Functions

All database functions are created in the `public` schema.

## 6.1 `get_partner_id(user_id UUID)` -> `UUID`

**Security:** `SECURITY DEFINER`, `STABLE`
**Status:** Deprecated (dropped in migration `20251206024345`, replaced by `get_my_partner_id()`)

Originally used by RLS policies to look up a user's partner. Replaced because it required passing `user_id` as a parameter, which was less secure than the current `auth.uid()`-based approach.

## 6.2 `get_my_partner_id()` -> `UUID`

**Source:** Migration `20260205000001_fix_users_rls_recursion.sql`
**Security:** `SECURITY DEFINER`, `STABLE`
**Search path:** `public`

```sql
SELECT partner_id FROM public.users WHERE id = auth.uid();
```

Reads the current user's `partner_id` while bypassing RLS. Created to break infinite RLS recursion on the `users` table (PostgreSQL error 42P17), where the SELECT policy referenced `public.users` in its USING clause, triggering the same policy recursively.

**Called by:** `users` table SELECT and UPDATE RLS policies.

## 6.3 `accept_partner_request(p_request_id UUID)` -> `void`

**Source:** Migration `20251206024345_remote_schema.sql`
**Security:** `SECURITY DEFINER`
**Search path:** `public`, `pg_catalog`
**Called by:** `partnerService.acceptPartnerRequest()`

**Flow:**
1. Look up the pending request by `p_request_id`
2. Validate: request exists and `status = 'pending'`
3. Validate: `auth.uid()` is the `to_user_id` (only recipient can accept)
4. Validate: neither user already has a `partner_id` (partner-exists guard)
5. Update request `status` to `'accepted'`
6. Set `partner_id` on both users (bidirectional linking)

**Errors:**
- `'Partner request not found or already processed'`
- `'Only the recipient can accept a partner request'`
- `'One or both users already have a partner'`

## 6.4 `decline_partner_request(p_request_id UUID)` -> `void`

**Source:** Migration `20251206024345_remote_schema.sql`
**Security:** `SECURITY DEFINER`
**Search path:** `public`, `pg_catalog`
**Called by:** `partnerService.declinePartnerRequest()`

**Flow:**
1. Look up the pending request by `p_request_id`
2. Validate: request exists and `status = 'pending'`
3. Validate: `auth.uid()` is the `to_user_id`
4. Update request `status` to `'declined'`

## 6.5 `sync_user_profile()` -> `trigger`

**Source:** Migration `20251206024345_remote_schema.sql`
**Security:** `SECURITY DEFINER`
**Trigger:** `AFTER INSERT OR UPDATE ON auth.users`

Syncs `email` and `display_name` from `auth.users` to `public.users`. On INSERT, creates the `public.users` record. On UPDATE, updates the synced fields. Extracts `display_name` from `raw_user_meta_data->>'display_name'` or `raw_user_meta_data->>'full_name'`.

## 6.6 `is_scripture_session_member(p_session_id UUID)` -> `BOOLEAN`

**Source:** Migration `20260128000001_scripture_reading.sql`
**Security:** `SECURITY DEFINER`
**Search path:** `public`

Returns `true` if `auth.uid()` matches either `user1_id` or `user2_id` of the given session. Used by RLS policies on `scripture_step_states`, `scripture_reflections`, `scripture_bookmarks`, and `scripture_messages`.

## 6.7 `scripture_create_session(p_mode TEXT, p_partner_id UUID DEFAULT NULL)` -> `JSONB`

**Source:** Migration `20260130000001_scripture_rpcs.sql`
**Security:** `SECURITY DEFINER`
**Grant:** `authenticated`

Creates a new scripture reading session.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `p_mode` | Yes | `'solo'` or `'together'` |
| `p_partner_id` | For together mode | Partner's user UUID |

**Validations:**
- Mode must be `'solo'` or `'together'`
- Together mode requires `p_partner_id`
- Partner must exist in `auth.users`

**Returns:** Full session object as JSONB with all fields.

**Initial state:** `current_phase: 'reading'`, `current_step_index: 0`, `status: 'in_progress'`, `version: 1`.

## 6.8 `scripture_submit_reflection(...)` -> `JSONB`

**Source:** Migration `20260130000001_scripture_rpcs.sql`
**Security:** `SECURITY DEFINER`
**Grant:** `authenticated`

Idempotent upsert for reflections using `ON CONFLICT (session_id, step_index, user_id)`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_session_id` | `UUID` | Session ID |
| `p_step_index` | `INT` | Step number |
| `p_rating` | `INT` | 1-5 rating |
| `p_notes` | `TEXT` | Reflection notes |
| `p_is_shared` | `BOOLEAN` | Share with partner |

**Validations:**
- `is_scripture_session_member(p_session_id)` must be true
- Rating must be 1-5

**Returns:** Full reflection object as JSONB.

## 6.9 `scripture_seed_test_data(...)` -> `JSONB`

**Source:** Migrations `20260128000001`, `20260130000001`, `20260204000001`
**Security:** `SECURITY DEFINER`
**Environment guard:** Rejects calls when `app.environment = 'production'`

Test data seeding function with preset configurations.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_session_count` | `INT` | `1` | Number of sessions to create |
| `p_include_reflections` | `BOOLEAN` | `false` | Include test reflections |
| `p_include_messages` | `BOOLEAN` | `false` | Include test prayer messages |
| `p_preset` | `TEXT` | `NULL` | Preset configuration |

### Presets

| Preset | Phase | Step | Status | Notes |
|--------|-------|------|--------|-------|
| `NULL` (default) | `lobby` | 0 | `pending` | Fresh session |
| `'mid_session'` | `reading` | 7 | `in_progress` | Session in progress |
| `'completed'` | `complete` | 16 | `complete` | Fully completed session |
| `'with_help_flags'` | `reading` | 7 | `in_progress` | For testing help features |
| `'unlinked'` | `reading` | 7 | `in_progress` | Solo session with `user2_id = NULL` |

**Returns:** JSONB with `session_ids`, `session_count`, `preset`, `test_user1_id`, `test_user2_id`, and optionally `reflection_ids` and `message_ids`.
