# 6. Supabase RPC Functions

All database functions are in the `public` schema. Most use `SET search_path = ''` for security. Scripture functions use optimistic concurrency (version checks) and row-level locking (`FOR UPDATE`).

## Core App Functions

### `accept_partner_request(p_request_id UUID) -> void`
**Security:** DEFINER | **Introduced:** Migration 001 (base schema)

Atomically accepts a partner request: validates recipient is caller, checks neither user already has a partner, sets `partner_id` on both users, marks request as accepted, declines all other pending requests involving either user.

### `decline_partner_request(p_request_id UUID) -> void`
**Security:** DEFINER | **Introduced:** Migration 005 (remote_schema)

Validates caller is recipient, updates request status to `'declined'`.

### `sync_user_profile() -> trigger`
**Security:** DEFINER | **Introduced:** Migration 005 (remote_schema)

Trigger function on `auth.users` AFTER INSERT/UPDATE. Upserts `public.users` with email and display_name from auth metadata.

### `get_my_partner_id() -> UUID`
**Security:** DEFINER | **Introduced:** Migration 010 (fix RLS recursion)

Returns `partner_id` from `users` table for `auth.uid()`. Bypasses RLS to break circular policy evaluation.

### `is_scripture_session_member(p_session_id UUID) -> boolean`
**Security:** DEFINER | **Introduced:** Migration 008 (scripture_reading)

Returns true if `auth.uid()` is user1 or user2 of the session. Used by RLS policies on all scripture tables.

## Scripture Session Functions

### `scripture_create_session(p_mode TEXT, p_partner_id UUID?) -> JSONB`
**Security:** DEFINER | **Introduced:** Migration 009, updated in 016/021

Creates a new scripture session. Solo starts in `reading` phase, together starts in `lobby`. Together mode reuses existing in-progress lobby sessions for the same user pair. Returns full session JSONB object.

### `scripture_submit_reflection(p_session_id, p_step_index, p_rating, p_notes, p_is_shared) -> JSONB`
**Security:** DEFINER | **Introduced:** Migration 009

Upserts a reflection (INSERT ... ON CONFLICT DO UPDATE). Validates session membership and rating range (1-5). Returns reflection JSONB.

### `scripture_select_role(p_session_id UUID, p_role TEXT) -> JSONB`
**Security:** INVOKER | **Introduced:** Migration 015, phase guard added in 017

Sets caller's role (reader/responder) on the session. Phase guard: only allowed in lobby. Bumps version. Returns session snapshot JSONB (client broadcasts to partner).

### `scripture_toggle_ready(p_session_id UUID, p_is_ready BOOLEAN) -> JSONB`
**Security:** INVOKER | **Introduced:** Migration 015, phase guard added in 017

Toggles caller's ready flag. Phase guard: only allowed in lobby. If both ready: sets `countdown_started_at = now()`, transitions to countdown phase. Returns snapshot.

### `scripture_convert_to_solo(p_session_id UUID) -> JSONB`
**Security:** INVOKER | **Introduced:** Migration 015, phase guard added in 017

Converts together session to solo. Phase guard: lobby only. Clears partner state, resets ready flags, moves to reading phase. Returns snapshot.

### `scripture_lock_in(p_session_id, p_step_index, p_expected_version) -> JSONB`
**Security:** INVOKER | **Introduced:** Migration 018, updated 021/024

Locks in user for current step. Uses optimistic concurrency (`version != p_expected_version` raises `409: version mismatch`). Phase guard: reading or countdown. Idempotent UPSERT on `scripture_step_states`. If both locked: advances step (or transitions to reflection on step 16 -- keeps status `in_progress`). Returns snapshot with `both_locked` boolean and optional `lock_status`.

### `scripture_undo_lock_in(p_session_id, p_step_index) -> JSONB`
**Security:** INVOKER | **Introduced:** Migration 018, updated 021

Clears caller's lock timestamp on step state. Phase guard: reading or countdown. Returns snapshot with `lock_status`.

### `scripture_end_session(p_session_id UUID) -> JSONB`
**Security:** INVOKER | **Introduced:** Migration 019, updated 021

Ends a together-mode session early. Status guard: only `in_progress`. Sets `status = 'ended_early'`, `completed_at = now()`. Returns snapshot.

### `scripture_get_couple_stats() -> JSONB`
**Security:** DEFINER | **Introduced:** Migration 013, optimized 014, precision fix 024

Returns couple-aggregate stats using CTE-based query: `totalSessions`, `totalSteps`, `lastCompleted`, `avgRating` (rounded to 1 decimal), `bookmarkCount`. Queries across both partners' sessions.

### `scripture_seed_test_data(p_session_count, p_include_reflections, p_include_messages, p_preset, p_bookmark_steps) -> JSONB`
**Security:** DEFINER | **Introduced:** Migration 008, updated multiple times

Test data seeding function with environment guard (rejects in production). Presets: `default`, `mid_session`, `completed`, `with_help_flags`, `unlinked`, `at_reflection`.
