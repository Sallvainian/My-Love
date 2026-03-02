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

**Source:** Migrations `20260130000001` (original), `20260301000100` (current version)
**Security:** `SECURITY DEFINER`
**Search path:** `''`
**Grant:** `authenticated`

Creates a new scripture reading session or reuses an existing one for together mode.

| Parameter      | Required          | Description              |
| -------------- | ----------------- | ------------------------ |
| `p_mode`       | Yes               | `'solo'` or `'together'` |
| `p_partner_id` | For together mode | Partner's user UUID      |

**Validations:**

- Mode must be `'solo'` or `'together'`
- Together mode requires `p_partner_id`
- Partner cannot be the current user
- Partner must exist in `auth.users`

**Together mode behavior (migration 20):**

- Starts in `lobby` phase (not `reading`)
- Reuses existing in-progress together session for the same user pair (any user order) if still in `lobby` phase, preventing duplicate sessions
- Only reuses sessions in `lobby` phase -- sessions that have progressed past lobby are not reused

**Solo mode behavior:**

- Starts directly in `reading` phase

**Returns:** Full session object as JSONB with all fields.

## 6.8 `scripture_submit_reflection(...)` -> `JSONB`

**Source:** Migration `20260130000001_scripture_rpcs.sql`
**Security:** `SECURITY DEFINER`
**Search path:** `''`
**Grant:** `authenticated`

Idempotent upsert for reflections using `ON CONFLICT (session_id, step_index, user_id)`.

| Parameter      | Type      | Description        |
| -------------- | --------- | ------------------ |
| `p_session_id` | `UUID`    | Session ID         |
| `p_step_index` | `INT`     | Step number        |
| `p_rating`     | `INT`     | 1-5 rating         |
| `p_notes`      | `TEXT`    | Reflection notes   |
| `p_is_shared`  | `BOOLEAN` | Share with partner |

**Validations:**

- `is_scripture_session_member(p_session_id)` must be true
- Rating must be 1-5

**Returns:** Full reflection object as JSONB.

## 6.9 `scripture_seed_test_data(...)` -> `JSONB`

**Source:** Migrations `20260128000001`, `20260130000001`, `20260204000001`
**Security:** `SECURITY DEFINER`
**Search path:** `''`
**Environment guard:** Rejects calls when `app.environment = 'production'`

Test data seeding function with preset configurations.

| Parameter               | Type      | Default | Description                  |
| ----------------------- | --------- | ------- | ---------------------------- |
| `p_session_count`       | `INT`     | `1`     | Number of sessions to create |
| `p_include_reflections` | `BOOLEAN` | `false` | Include test reflections     |
| `p_include_messages`    | `BOOLEAN` | `false` | Include test prayer messages |
| `p_preset`              | `TEXT`    | `NULL`  | Preset configuration         |

### Presets

| Preset              | Phase      | Step | Status        | Notes                               |
| ------------------- | ---------- | ---- | ------------- | ----------------------------------- |
| `NULL` (default)    | `lobby`    | 0    | `pending`     | Fresh session                       |
| `'mid_session'`     | `reading`  | 7    | `in_progress` | Session in progress                 |
| `'completed'`       | `complete` | 16   | `complete`    | Fully completed session             |
| `'with_help_flags'` | `reading`  | 7    | `in_progress` | For testing help features           |
| `'unlinked'`        | `reading`  | 7    | `in_progress` | Solo session with `user2_id = NULL` |

**Returns:** JSONB with `session_ids`, `session_count`, `preset`, `test_user1_id`, `test_user2_id`, and optionally `reflection_ids` and `message_ids`.

## 6.10 `scripture_get_couple_stats(p_partner_id UUID)` -> `JSONB`

**Source:** Migrations `20260217150353` (original), `20260217184551` (CTE optimization)
**Security:** `SECURITY DEFINER`
**Search path:** `''`
**Grant:** `authenticated`

Returns couple reading statistics using CTE-optimized queries.

**Flow:**

1. Get current user via `auth.uid()`
2. Find all session IDs where either user is `user1_id` or `user2_id` (CTE)
3. Aggregate 5 metrics from that set

**Returned metrics:**

| Metric                | Description                                        |
| --------------------- | -------------------------------------------------- |
| `total_sessions`      | All sessions for the pair                          |
| `completed_sessions`  | Sessions with `status = 'complete'`                |
| `total_reflections`   | All reflections across pair sessions               |
| `shared_reflections`  | Reflections with `is_shared = true`                |
| `total_messages`      | All prayer report messages across pair sessions    |

## 6.11 `scripture_select_role(p_session_id UUID, p_role TEXT)` -> `JSONB`

**Source:** Migrations `20260220000001` (original), `20260221211137` (phase guard), `20260301000200` (removed broadcast)
**Security:** `SECURITY INVOKER`
**Search path:** `''`
**Grant:** `authenticated`

Sets the calling user's role in the together-mode lobby.

| Parameter      | Type   | Description                            |
| -------------- | ------ | -------------------------------------- |
| `p_session_id` | `UUID` | Session ID                             |
| `p_role`       | `TEXT` | `'reader'` or `'responder'`            |

**Flow:**

1. Authenticate via `auth.uid()`
2. Validate role is `'reader'` or `'responder'`
3. `SELECT ... FOR UPDATE` on session (member check)
4. **Phase guard:** Raise exception if `current_phase != 'lobby'`
5. Update the correct user's role column (`user1_role` or `user2_role`) based on whether caller is `user1_id`
6. Bump `version`
7. Return JSONB snapshot with `sessionId`, `currentPhase`, `version`, `user1Role`, `user2Role`, `user1Ready`, `user2Ready`, `countdownStartedAt`

**Note:** After migration 21, the client broadcasts `state_updated` via `channel.send()` after this RPC succeeds.

## 6.12 `scripture_toggle_ready(p_session_id UUID, p_is_ready BOOLEAN)` -> `JSONB`

**Source:** Migrations `20260220000001` (original), `20260221211137` (phase guard), `20260301000200` (removed broadcast)
**Security:** `SECURITY INVOKER`
**Search path:** `''`
**Grant:** `authenticated`

Toggles the calling user's ready state in the lobby. If both users become ready, starts the countdown.

| Parameter      | Type      | Description              |
| -------------- | --------- | ------------------------ |
| `p_session_id` | `UUID`    | Session ID               |
| `p_is_ready`   | `BOOLEAN` | New ready state          |

**Flow:**

1. Authenticate via `auth.uid()`
2. `SELECT ... FOR UPDATE` on session (member check)
3. **Phase guard:** Raise exception if `current_phase != 'lobby'`
4. Update the correct user's ready flag (`user1_ready` or `user2_ready`)
5. Bump `version`
6. Check if both users are ready (`user1_ready AND user2_ready AND user2_id IS NOT NULL`)
7. If both ready and `countdown_started_at IS NULL`: set `countdown_started_at = now()`, transition to `countdown` phase, bump version again
8. Return JSONB snapshot

## 6.13 `scripture_convert_to_solo(p_session_id UUID)` -> `JSONB`

**Source:** Migrations `20260220000001` (original), `20260221211137` (phase guard), `20260301000200` (removed broadcast)
**Security:** `SECURITY INVOKER`
**Search path:** `''`
**Grant:** `authenticated`

Converts a together-mode session to solo mode. Called when one partner taps "Continue solo" in the lobby.

**Flow:**

1. Authenticate via `auth.uid()`
2. `SELECT ... FOR UPDATE` on session (member check)
3. **Phase guard:** Raise exception if `current_phase != 'lobby'`
4. Update session: `mode = 'solo'`, `user2_id = NULL`, reset ready states, clear `countdown_started_at`, set `current_phase = 'reading'`, bump version
5. Return JSONB snapshot with `sessionId`, `mode`, `currentPhase`, `version`

**Note:** The client broadcasts `session_converted` to the partner before the channel is closed.

## 6.14 `scripture_lock_in(p_session_id UUID, p_step_index INT, p_expected_version INT)` -> `JSONB`

**Source:** Migrations `20260222000001` (original), `20260301000200` (removed broadcast)
**Security:** `SECURITY INVOKER`
**Search path:** `''`
**Grant:** `authenticated`

Locks in a user for the current reading step. When both users lock, automatically advances to the next step.

| Parameter            | Type   | Description                         |
| -------------------- | ------ | ----------------------------------- |
| `p_session_id`       | `UUID` | Session ID                          |
| `p_step_index`       | `INT`  | Current step index                  |
| `p_expected_version` | `INT`  | Optimistic concurrency check value  |

**Flow:**

1. Authenticate via `auth.uid()`
2. `SELECT ... FOR UPDATE` on session (member check)
3. **Phase guard:** Only allow during `reading` or `countdown` phase
4. If session is in `countdown` phase, auto-transition to `reading` (housekeeping, no version bump)
5. **Step guard:** Verify `current_step_index = p_step_index`
6. **Version check:** Raise `'409: version mismatch'` if `version != p_expected_version`
7. Determine if caller is user1
8. **Idempotent UPSERT:** `INSERT INTO scripture_step_states ... ON CONFLICT (session_id, step_index) DO UPDATE SET userN_locked_at = now()`
9. Re-read step state to check if both users are locked
10. **If both locked:**
    - Mark step as advanced (`advanced_at = now()`)
    - If `step_index < 16`: increment `current_step_index`, bump version, update `snapshot_json`
    - If `step_index = 16` (last step): transition to `reflection` phase, set `status = 'complete'`
    - Return snapshot with `both_locked: true`
11. **If partial lock:**
    - Return snapshot with `both_locked: false` and `lock_status` object

**Return payload structure:**

```json
{
  "sessionId": "uuid",
  "currentPhase": "reading",
  "currentStepIndex": 5,
  "version": 12,
  "both_locked": true,
  "triggered_by": "lock_in"
}
```

Or for partial lock:

```json
{
  "sessionId": "uuid",
  "currentPhase": "reading",
  "currentStepIndex": 5,
  "version": 11,
  "both_locked": false,
  "lock_status": {
    "step_index": 5,
    "user1_locked": true,
    "user2_locked": false
  }
}
```

## 6.15 `scripture_undo_lock_in(p_session_id UUID, p_step_index INT)` -> `JSONB`

**Source:** Migrations `20260222000001` (original), `20260301000200` (removed broadcast)
**Security:** `SECURITY INVOKER`
**Search path:** `''`
**Grant:** `authenticated`

Clears a user's lock-in for the given step.

| Parameter       | Type   | Description    |
| --------------- | ------ | -------------- |
| `p_session_id`  | `UUID` | Session ID     |
| `p_step_index`  | `INT`  | Step index     |

**Flow:**

1. Authenticate via `auth.uid()`
2. `SELECT ... FOR UPDATE` on session (member check)
3. **Phase guard:** Only allow during `reading` or `countdown` phase
4. Clear caller's lock timestamp (`user1_locked_at = NULL` or `user2_locked_at = NULL`)
5. Re-read step state for return payload
6. Return snapshot with `lock_status` showing updated lock states

**Note:** No version bump. This only affects the `scripture_step_states` row, not the session.

## 6.16 `scripture_end_session(p_session_id UUID)` -> `JSONB`

**Source:** Migrations `20260228000001` (original), `20260301000200` (removed broadcast)
**Security:** `SECURITY INVOKER`
**Search path:** `''`
**Grant:** `authenticated`

Ends a together-mode session early. Called when a user taps "End Session" after partner disconnects.

| Parameter       | Type   | Description |
| --------------- | ------ | ----------- |
| `p_session_id`  | `UUID` | Session ID  |

**Flow:**

1. Authenticate via `auth.uid()`
2. `SELECT ... FOR UPDATE` on session (member check)
3. **Status guard:** Raise exception if `status != 'in_progress'`
4. Update session: `status = 'ended_early'`, `completed_at = now()`, bump version, update `snapshot_json` with `currentPhase: 'complete'` and `triggeredBy: 'end_session'`
5. Return JSONB snapshot with `sessionId`, `currentPhase: 'complete'`, `currentStepIndex`, `version`, `triggered_by: 'end_session'`

## Security Model Summary

| Pattern | Functions | Notes |
|---------|-----------|-------|
| `SECURITY DEFINER` | `accept_partner_request`, `decline_partner_request`, `get_my_partner_id`, `is_scripture_session_member`, `sync_user_profile`, `scripture_create_session`, `scripture_submit_reflection`, `scripture_seed_test_data`, `scripture_get_couple_stats` | Bypass RLS for atomic operations or internal helpers |
| `SECURITY INVOKER` | `scripture_select_role`, `scripture_toggle_ready`, `scripture_convert_to_solo`, `scripture_lock_in`, `scripture_undo_lock_in`, `scripture_end_session` | RLS applies to calling user; combined with `FOR UPDATE` row locking |
| `SET search_path = ''` | All scripture RPCs | Prevents schema-injection attacks; all table references fully qualified |
| Phase/status guards | All scripture INVOKER RPCs | Prevents out-of-order state transitions |
| Optimistic concurrency | `scripture_lock_in` | `p_expected_version` parameter checked before mutation |
