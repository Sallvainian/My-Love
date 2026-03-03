---
title: 'Epic 4 Hardening — Error Observability + Auth/SQL'
slug: 'epic-4-hardening-chunks-1-4'
created: '2026-03-02'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
adversarialReview: { findings: 13, allFixed: true, reviewer: 'sonnet' }
tech_stack: ['@sentry/react ^10.39.0', '@supabase/supabase-js ^2.97.0', 'zustand ^5.0.11', 'react ^19.2.4', 'vitest ^4.0.17', 'postgresql (pgTAP)']
files_to_modify:
  - 'src/services/scriptureReadingService.ts'
  - 'src/hooks/useScriptureBroadcast.ts'
  - 'src/stores/slices/scriptureReadingSlice.ts'
  - 'supabase/migrations/20260303000100_hardening_chunks_1_4.sql'
  - 'tests/unit/services/scriptureReadingService.sentry.test.ts'
  - 'tests/unit/hooks/useScriptureBroadcast.errorhandling.test.ts'
  - 'tests/unit/stores/scriptureReadingSlice.authguards.test.ts'
code_patterns:
  - 'handleScriptureError switch/case with console-only logging'
  - 'void channel.send() — fire-and-forget, no .catch()'
  - 'void supabase.removeChannel() — no .catch()'
  - '_broadcastFn?.() — unwrapped, can throw'
  - 'supabase.auth.getUser() — error field ignored'
  - 'SECURITY INVOKER on all RPCs except end_session (DEFINER)'
  - 'split_part(topic, :, 2)::uuid — unguarded cast in RLS'
  - 'convertToSolo clears user2_id but not role columns'
test_patterns:
  - 'vitest + happy-dom with vi.hoisted() + vi.mock() for Supabase mocks'
  - 'zustand slices tested via create() with slice factory'
  - 'hooks tested via renderHook() from @testing-library/react'
  - 'pgTAP for SQL migration testing (supabase test db)'
---

# Tech-Spec: Epic 4 Hardening — Error Observability + Auth/SQL

**Created:** 2026-03-02

## Overview

### Problem Statement

Epic 4's Together Mode feature shipped with systemic gaps identified by an external PR review (PR #107, 27+ findings). The scripture error pipeline only logs to console — no Sentry integration exists. All `channel.send()` and `supabase.removeChannel()` calls are fire-and-forget with no `.catch()`. Auth identity (`auth.getUser()`) is called without error checking, allowing null `currentUserId` to cascade silently through broadcast and RPC calls. SQL RPCs using SECURITY DEFINER have not been audited for privilege escalation, and RLS policies cast UUIDs without validation guards.

### Solution

Wire `@sentry/react` into the existing `handleScriptureError` function so all scripture errors flow to Sentry with structured error codes. Add `.catch()` to all channel operations and try/catch around the broadcast function wrapper. Add auth error checks and null guards at all entry points (`loadSession`, `selectRole`, broadcast hook). Audit and harden SQL migrations for SECURITY DEFINER RPCs, UUID casting in RLS, role column cleanup in `convertToSolo`, and step boundary constants.

### Scope

**In Scope (11 items across 2 chunks):**

**Chunk 1 — Error Observability:**
- C2: Wire Sentry into `handleScriptureError` (`scriptureReadingService.ts`)
- C4: Add `.catch()` to `channel.send()` calls (`useScriptureBroadcast.ts`)
- E7: Wrap `_broadcastFn` invocations in try/catch (`useScriptureBroadcast.ts`)
- T3: Test endSession phase ordering (new test file)

**Chunk 4 — Auth + SQL Hardening:**
- E4: Auth error check in `loadSession` (`scriptureReadingSlice.ts`)
- E5: Null user guard in broadcast (`useScriptureBroadcast.ts`)
- I8: Null `currentUserId` guard in `selectRole` (`scriptureReadingSlice.ts`)
- A1: Revert `scripture_end_session` from SECURITY DEFINER to SECURITY INVOKER (migration)
- A2: Step boundary SQL constant — extract `16` to named variable (migration)
- A3: UUID guard on RLS cast — validate before `::uuid` (migration)
- A4: Clear role columns in `convertToSolo` (migration)

**Out of Scope:**
- Chunk 2: Reconnection Resilience (MAX_RETRIES, backoff, presence CLOSED handler) — depends on Chunk 1
- Chunk 3: State Correctness (version guard ordering, scoped reset, structured error matching) — depends on Chunk 1
- I12: Supabase version pinning — retro artifact error (no v6 exists; dropped)
- Process improvements: E4-P1, E4-P2, E4-P3
- Technical debt: E4-D1 through E4-D5

## Context for Development

### Codebase Patterns

**Error Handling (Current State — Problem):**
- `handleScriptureError` (`scriptureReadingService.ts:48-72`) uses a switch/case on `ScriptureErrorCode` enum. Each case only calls `console.warn()` or `console.error()`. No Sentry integration.
- Sentry is already initialized in `src/config/sentry.ts` with `@sentry/react ^10.39.0`. Provides `Sentry.captureException()`, `Sentry.captureMessage()`, and `Sentry.setTag()`. `Sentry.init()` ignores `NetworkError`, `Failed to fetch`, `Load failed` — so offline errors won't double-report.
- `ScriptureErrorCode` enum has 7 values: `VERSION_MISMATCH`, `SESSION_NOT_FOUND`, `UNAUTHORIZED`, `SYNC_FAILED`, `OFFLINE`, `CACHE_CORRUPTED`, `VALIDATION_FAILED`.

**Channel Operations (Current State — Problem):**
- `useScriptureBroadcast.ts:174` — `void channel.send({ type: 'broadcast', event, payload })` — no `.catch()`.
- `useScriptureBroadcast.ts:179-183` — `void channel.send(...)` for partner_joined — no `.catch()`.
- `useScriptureBroadcast.ts:197` — `void supabase.removeChannel(channel).then(...)` — `.then()` but no `.catch()`.
- `useScriptureBroadcast.ts:211` — same pattern for CLOSED handler.
- `useScriptureBroadcast.ts:236` — cleanup `void supabase.removeChannel(channelRef.current)` — no `.catch()`.

**Broadcast Function (Current State — Problem):**
- `_broadcastFn` is set via `setBroadcastFn` at `scriptureReadingSlice.ts:982` — it wraps `channel.send()`.
- Called in 8 places across the slice (lines 591, 639, 670, 822, 840, 849, 916, 964) — all as `get()._broadcastFn?.('event', payload)`.
- The function calls `void channel.send()` which returns a Promise — if the channel is in a bad state, this can throw synchronously or reject.

**Auth Pattern (Current State — Problem):**
- `loadSession` (`scriptureReadingSlice.ts:247-248`): `const { data: authData } = await supabase.auth.getUser()` — ignores `error` field. If auth fails, `authData.user?.id` is `undefined` → `currentUserId` set to `null`.
- `selectRole` (`scriptureReadingSlice.ts:561`): Same pattern — no auth error check. `currentUserId` can be `null`, then passed to user1/user2 comparison logic silently producing wrong results.
- `checkForActiveSession` (`scriptureReadingSlice.ts:288-293`): Already has proper null guard — `if (!userId) { set({ isCheckingSession: false }); return; }`. This is the pattern to follow.
- `useScriptureBroadcast.ts:154-158`: `const { data: authData, error: authError } = await supabase.auth.getUser()` — does check `authError` and throws. But `userId = authData.user?.id ?? ''` uses empty string fallback instead of bailing out.

**SQL Patterns (Current State — Problem):**
- **Migration history:** `20260301000200_remove_server_side_broadcasts.sql` is the CURRENT LIVE version of all 6 scripture RPCs (removed `realtime.send()`). Later migration `20260302000100` fixed `current_phase` but regressed `scripture_end_session` to SECURITY DEFINER. All SQL tasks must copy from `20260301000200` as the base.
- `scripture_end_session` in `20260302000100_fix_end_session_current_phase.sql` uses `SECURITY DEFINER` — all other 5 scripture RPCs use `SECURITY INVOKER`. Decision: revert to INVOKER by copying from `20260301000200` and merging in the `current_phase = 'complete'` fix.
- `scripture_lock_in` in `20260301000200` (line ~300) uses hardcoded `IF p_step_index < 16` — should use a declared variable `v_max_step_index`.
- RLS policies on `realtime.messages` use `split_part(topic, ':', 2)::uuid` without validating the string is a valid UUID. 4 policies affected (2 in `20260220000001`, 2 in `20260222000001`).
- `scripture_convert_to_solo` in `20260301000200` (lines 200-262) clears `user2_id`, `user1_ready`, `user2_ready`, `countdown_started_at` but does NOT clear `user1_role` or `user2_role`.

### Files to Reference

| File | Purpose | Lines |
| ---- | ------- | ----- |
| `src/services/scriptureReadingService.ts` | `handleScriptureError` (lines 48-72), `ScriptureErrorCode` enum (lines 32-40) | 943 |
| `src/hooks/useScriptureBroadcast.ts` | Channel lifecycle, `channel.send()` (lines 174, 179), `removeChannel` (lines 197, 211, 236) | 251 |
| `src/stores/slices/scriptureReadingSlice.ts` | `loadSession` (line 228), `selectRole` (line 551), `_broadcastFn` calls (8 sites) | ~1000 |
| `src/config/sentry.ts` | Sentry init, `captureException`, `captureMessage` | 55 |
| `supabase/migrations/20260301000200_remove_server_side_broadcasts.sql` | **COPY SOURCE** for all SQL tasks — current live version of all 6 scripture RPCs (INVOKER, no realtime.send) | 580 |
| `supabase/migrations/20260302000100_fix_end_session_current_phase.sql` | `current_phase = 'complete'` fix to merge into Task 10 — but has DEFINER regression, do NOT use as base | 64 |
| `supabase/migrations/20260302000200_add_step_boundary_comment.sql` | Comment to re-add in Task 11 (will be dropped by CREATE OR REPLACE) | 9 |
| `supabase/migrations/20260220000001_scripture_lobby_and_roles.sql` | RLS policy names reference (for DROP POLICY) — do NOT copy function bodies (has realtime.send) | 367 |
| `tests/unit/hooks/useScriptureBroadcast.test.ts` | Existing broadcast hook tests — mock pattern reference | ~200 |
| `tests/unit/stores/scriptureReadingSlice.reconnect.test.ts` | Existing slice tests — mock pattern reference | ~200 |

### Technical Decisions

1. **Sentry integration approach:** Enhance `handleScriptureError` — add `Sentry.captureException()` for error-level codes (`SESSION_NOT_FOUND`, `UNAUTHORIZED`, `CACHE_CORRUPTED`, `VALIDATION_FAILED`) and `Sentry.captureMessage()` with `level: 'warning'` for warning-level codes (`VERSION_MISMATCH`, `SYNC_FAILED`, `OFFLINE`). Add `Sentry.setTag('scripture_error_code', error.code)` for filtering in Sentry dashboard.
2. **Channel error handling:** Add `.catch()` to all `void channel.send(...)` and `void supabase.removeChannel(...)` calls. Errors route through `handleScriptureError` with `ScriptureErrorCode.SYNC_FAILED`. Keep `void` prefix — these remain non-blocking.
3. **Broadcast function wrapping:** Wrap the `_broadcastFn` lambda in `setBroadcastFn` (line 173-175) with try/catch so synchronous throws are caught. The function already returns `void channel.send()` which handles async rejection — the try/catch covers the synchronous throw case.
4. **Auth guards:** Follow `checkForActiveSession` pattern (line 288-293): check error field, bail out if userId is falsy, set error state. Apply to `loadSession` and `selectRole`.
5. **Broadcast null user guard:** Change `authData.user?.id ?? ''` to an early return when userId is falsy. Don't broadcast a partner_joined with an empty user_id.
6. **SQL hardening — single migration:** All 4 SQL items (A1-A4) in one migration file.
7. **A1 decision:** Revert `scripture_end_session` from `SECURITY DEFINER` to `SECURITY INVOKER` for consistency with all other scripture RPCs.
8. **A2 approach:** Add `v_max_step_index CONSTANT INT := 16;` at top of `scripture_lock_in` function and replace the hardcoded `16` with the variable.
9. **A3 approach:** Add UUID format validation before the `::uuid` cast in all 4 RLS policies using a regex check: `split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`. Note: regex is lowercase-only, which is correct because PostgreSQL `gen_random_uuid()` always returns lowercase hex. Document this assumption in the migration comment.
10. **A4 approach:** Add `user1_role = NULL, user2_role = NULL` to the UPDATE in `scripture_convert_to_solo`.

## Implementation Plan

### Tasks

Tasks are ordered by dependency (lowest-level first). Chunk 1 and Chunk 4 can be implemented in parallel.

---

#### Chunk 1: Error Observability

- [x] **Task 1: Wire Sentry into `handleScriptureError`** (C2)
  - File: `src/services/scriptureReadingService.ts`
  - Action: Add `import * as Sentry from '@sentry/react';` at top of file. Modify `handleScriptureError` (lines 48-72) to add Sentry calls after each `console.*` call:
    - For warning-level codes (`VERSION_MISMATCH`, `SYNC_FAILED`, `OFFLINE`): Add `Sentry.withScope((scope) => { scope.setTag('scripture_error_code', error.code); scope.setLevel('warning'); Sentry.captureMessage(error.message); });`
    - For error-level codes (`SESSION_NOT_FOUND`, `UNAUTHORIZED`, `CACHE_CORRUPTED`, `VALIDATION_FAILED`): Add `Sentry.withScope((scope) => { scope.setTag('scripture_error_code', error.code); Sentry.captureException(new Error(error.message), { extra: { details: error.details } }); });`
  - Notes: Keep existing `console.*` calls — Sentry supplements, doesn't replace local logging. Use `Sentry.withScope` to isolate tags per call.

- [x] **Task 2: Harden `setBroadcastFn` lambda and `partner_joined` send** (C4 + E7)
  - File: `src/hooks/useScriptureBroadcast.ts`
  - Action: Combined fix — wrap the `setBroadcastFn` lambda (line 173-175) in try/catch AND add `.catch()` to the Promise. Also add `.catch()` to the partner_joined send:
    - **Line 174** (setBroadcastFn lambda — combined C4+E7):
      ```typescript
      setBroadcastFn?.((event, payload) => {
        try {
          void channel.send({ type: 'broadcast', event, payload }).catch((err: unknown) => {
            handleScriptureError({ code: ScriptureErrorCode.SYNC_FAILED, message: 'Broadcast send failed', details: err });
          });
        } catch (err: unknown) {
          handleScriptureError({ code: ScriptureErrorCode.SYNC_FAILED, message: 'Broadcast send threw synchronously', details: err });
        }
      });
      ```
    - **Lines 179-183** (partner_joined): Add `.catch()` — `void channel.send({ ... }).catch((err: unknown) => { handleScriptureError({ code: ScriptureErrorCode.SYNC_FAILED, message: 'Broadcast send failed', details: err }); });`
  - Notes: This is a single edit to line 174 that addresses both C4 (`.catch()`) and E7 (try/catch) at the definition site. All 8 `_broadcastFn` call sites in the slice are now protected without any slice changes. Keep `void` prefix — sends remain non-blocking.

- [x] **Task 3: Add `.catch()` to all `removeChannel()` calls** (C4 continued)
  - File: `src/hooks/useScriptureBroadcast.ts`
  - Action: Add `.catch()` to all three `supabase.removeChannel()` call sites:
    - **Line 197** (CHANNEL_ERROR handler): Chain `.catch()` after the existing `.then()`: `.then(() => { ... }).catch((err: unknown) => { handleScriptureError({ code: ScriptureErrorCode.SYNC_FAILED, message: 'Channel cleanup failed', details: err }); isRetryingRef.current = false; });`
    - **Line 211** (CLOSED handler): Same `.catch()` pattern.
    - **Line 236** (cleanup return): Change `void supabase.removeChannel(channelRef.current);` to `void supabase.removeChannel(channelRef.current).catch((err: unknown) => { handleScriptureError({ code: ScriptureErrorCode.SYNC_FAILED, message: 'Channel cleanup failed', details: err }); });`
  - Notes: The `.catch()` on CHANNEL_ERROR and CLOSED handlers must also reset `isRetryingRef.current = false` to prevent getting stuck in a retry-locked state.

- [x] **Task 5: Add endSession phase ordering test** (T3)
  - File: `tests/unit/stores/scriptureReadingSlice.endSession.test.ts` (new file)
  - Action: Create test file following existing mock patterns from `scriptureReadingSlice.reconnect.test.ts`. Tests:
    - `onBroadcastReceived with triggeredBy='end_session' resets session state` — verify `set({ ...initialScriptureState })` is called
    - `onBroadcastReceived with currentPhase='complete' resets session state` — same verification
    - `endSession() calls scripture_end_session RPC before clearing state` — verify RPC call precedes state reset
    - `endSession() broadcasts state_updated with correct payload before clearing state` — verify `_broadcastFn` called with 'state_updated' payload containing `triggered_by: 'end_session'` AND `currentPhase: 'complete'` before `set({ ...initialScriptureState })` is called (regression guard — this behavior already exists, test prevents future breakage)
  - Notes: Use same `vi.hoisted()` + `vi.mock()` pattern. The ordering tests verify the broadcast happens before state reset (lines 962-967 in the slice). AC-7 is a regression guard: the pre-existing behavior is correct but untested.

---

#### Chunk 4: Auth + SQL Hardening

- [x] **Task 6: Add auth error check in `loadSession`** (E4)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action: Move the auth check BEFORE the `getSession()` network call. Currently auth happens at line 247, AFTER `getSession()` at line 234. The auth check must come first so we don't make a network call with no authenticated user. Replace lines 234-248:
    ```typescript
    // Auth check FIRST — before any network call
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user?.id) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.UNAUTHORIZED,
        message: 'Failed to verify user identity',
        details: authError,
      };
      handleScriptureError(scriptureError);
      set({ scriptureError, scriptureLoading: false });
      return;
    }
    const currentUserId = authData.user.id;

    // Now safe to fetch session
    const { data: session, error } = await supabase.from('scripture_sessions').select('*')...
    ```
  - Notes: This differs from `checkForActiveSession` (line 288-293), which does auth inline because it uses `auth.getUser()` in the query filter. `loadSession` receives `sessionId` as a param and uses it to query — auth must be a separate pre-check. The key behavioral change is: auth failure now returns early BEFORE hitting the network for the session query.

- [x] **Task 7: Add null `currentUserId` guard in `selectRole`** (I8)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action: At line 561, change:
    ```typescript
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id ?? null;
    ```
    to:
    ```typescript
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user?.id) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.UNAUTHORIZED,
        message: 'Failed to verify user identity for role selection',
        details: authError,
      };
      handleScriptureError(scriptureError);
      set({ myRole: null, scriptureLoading: false, scriptureError });
      return;
    }
    const currentUserId = authData.user.id;
    ```
  - Notes: Resets `myRole` back to `null` since the optimistic update at line 557 set it. This prevents the UI from showing a role that was never confirmed server-side.

- [x] **Task 8: Add null user guard in broadcast hook** (E5)
  - File: `src/hooks/useScriptureBroadcast.ts`
  - Action: At line 158, change:
    ```typescript
    const userId = authData.user?.id ?? '';
    ```
    to:
    ```typescript
    const userId = authData.user?.id;
    if (!userId) {
      handleScriptureError({
        code: ScriptureErrorCode.UNAUTHORIZED,
        message: 'No user ID available for broadcast channel',
      });
      return;
    }
    ```
  - Notes: The early return prevents subscribing to the channel and broadcasting `partner_joined` with an empty user_id. The auth error was already checked and thrown on line 155-157 — this is the belt for the suspenders. **Important:** Do NOT set `channelRef.current = null` in this early return — the channel object may already be created by the Supabase client at this point. Leave `channelRef.current` as-is so the cleanup function in the useEffect return can properly call `removeChannel()` on it. Setting it to null would orphan the channel.

- [x] **Task 9: Auth guard unit tests** (covers E4, I8, E5)
  - File: `tests/unit/stores/scriptureReadingSlice.authguards.test.ts` (new file)
  - Action: Create test file with tests:
    - `loadSession sets UNAUTHORIZED error when auth.getUser() returns error`
    - `loadSession sets UNAUTHORIZED error when user.id is undefined`
    - `selectRole resets myRole and sets UNAUTHORIZED error when auth fails`
    - `selectRole resets myRole when user.id is undefined`
  - Notes: Mock `supabase.auth.getUser` to return `{ data: { user: null }, error: new Error('auth failed') }` and verify error state.

- [x] **Task 10: SQL migration — A1: Revert `scripture_end_session` to SECURITY INVOKER + preserve `current_phase` fix**
  - File: `supabase/migrations/20260303000100_hardening_chunks_1_4.sql` (new file)
  - Action: `CREATE OR REPLACE FUNCTION public.scripture_end_session(...)` — copy from `20260301000200_remove_server_side_broadcasts.sql` (lines 515-577), which is the current INVOKER version with `v_user_id` pattern. Then **merge in** the `current_phase = 'complete'` fix from `20260302000100`: add `current_phase = 'complete',` to the UPDATE SET clause.
  - **CRITICAL — Do NOT copy from `20260302000100`** — that migration regressed to SECURITY DEFINER and removed the `v_user_id` variable. The correct base is `20260301000200`.
  - Merge checklist:
    1. Base: `20260301000200` lines 515-577 (SECURITY INVOKER, has `v_user_id`, has `auth.uid()` in WHERE)
    2. Add from `20260302000100`: `current_phase = 'complete',` in UPDATE SET clause (line 37 of that file)
    3. Verify UPDATE SET includes: `status = 'ended_early', current_phase = 'complete', completed_at = now(), version = version + 1, snapshot_json = ...`
    4. Verify function comment is preserved from `20260302000100` (line 62-63)
  - Notes: Without the merge, the `current_phase = 'complete'` bug fix would be silently regressed — `current_phase` would remain at its previous value (e.g., 'reading') when a session ends early.

- [x] **Task 11: SQL migration — A2: Step boundary constant in `scripture_lock_in`**
  - File: `supabase/migrations/20260303000100_hardening_chunks_1_4.sql` (same file)
  - Action: `CREATE OR REPLACE FUNCTION public.scripture_lock_in(...)` — copy function from `20260301000200_remove_server_side_broadcasts.sql` (lines 268-423) and add `v_max_step_index CONSTANT INT := 16;` to DECLARE block. Replace `IF p_step_index < 16` with `IF p_step_index < v_max_step_index`. Re-add the function comment from `20260302000200_add_step_boundary_comment.sql` (which will be dropped by `CREATE OR REPLACE FUNCTION`).
  - **CRITICAL — Do NOT copy from `20260222000001`** — that migration contains server-side `realtime.send()` calls which were removed in `20260301000200`. Copying from the old source would silently reintroduce double-broadcasts.
  - Notes: The constant is `16` (0-indexed MAX_STEPS - 1). MAX_STEPS = 17 in frontend (`src/components/scripture-reading/constants.ts`). The `CREATE OR REPLACE` will drop the existing COMMENT ON FUNCTION from `20260302000200`, so it must be re-added in this migration with updated text referencing `v_max_step_index`.

- [x] **Task 12: SQL migration — A3: UUID guard on RLS policies**
  - File: `supabase/migrations/20260303000100_hardening_chunks_1_4.sql` (same file)
  - Action: Drop and recreate all 4 RLS policies on `realtime.messages` with UUID format validation. For each policy, add a regex guard before the `::uuid` cast:
    ```sql
    topic like 'scripture-session:%'
    and split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(topic, ':', 2)::uuid in (...)
    ```
    Apply to all 4 policies:
    - `scripture_session_members_can_receive_broadcasts` (SELECT)
    - `scripture_session_members_can_send_broadcasts` (INSERT)
    - `scripture_presence_members_can_receive_broadcasts` (SELECT)
    - `scripture_presence_members_can_send_broadcasts` (INSERT)
  - Notes: Use `DROP POLICY IF EXISTS` + `CREATE POLICY` to replace each policy. The regex check prevents the `::uuid` cast from throwing on malformed topic strings.

- [x] **Task 13: SQL migration — A4: Clear role columns in `convertToSolo`**
  - File: `supabase/migrations/20260303000100_hardening_chunks_1_4.sql` (same file)
  - Action: `CREATE OR REPLACE FUNCTION public.scripture_convert_to_solo(...)` — copy function from `20260301000200_remove_server_side_broadcasts.sql` (lines 200-262) and add `user1_role = NULL, user2_role = NULL` to the UPDATE SET clause (after `user2_ready = false`).
  - **CRITICAL — Do NOT copy from `20260220000001`** — that migration contains server-side `realtime.send()` calls which were removed in `20260301000200`. Copying from the old source would silently reintroduce double-broadcasts.
  - Notes: When converting to solo mode, the roles are meaningless (solo has no reader/responder distinction). Nulling them prevents stale role data from confusing any future resume logic.

### Acceptance Criteria

#### Chunk 1 — Error Observability

- [x] AC-1: Given a scripture error with code `SESSION_NOT_FOUND`, when `handleScriptureError` is called, then `Sentry.captureException` is called with an Error containing the message and `scripture_error_code` tag set to `SESSION_NOT_FOUND`.
- [x] AC-2: Given a scripture error with code `SYNC_FAILED`, when `handleScriptureError` is called, then `Sentry.captureMessage` is called with `level: 'warning'` and `scripture_error_code` tag set to `SYNC_FAILED`.
- [x] AC-3: Given a scripture error with code `OFFLINE`, when `handleScriptureError` is called, then `Sentry.captureMessage` is called exactly once with `level: 'warning'` and `scripture_error_code` tag set to `OFFLINE`. Test must assert `Sentry.captureMessage` call count is 1 (not just "was called") to verify no duplicate reporting. Note: Sentry.init's `ignoreErrors` filters (`NetworkError`, `Failed to fetch`) operate at the transport layer — `captureMessage` will still be invoked; dedup happens downstream.
- [x] AC-4: Given a channel.send() call that rejects, when the `.catch()` handler fires, then `handleScriptureError` is called with `SYNC_FAILED` code and the rejection error as details.
- [x] AC-5: Given a `supabase.removeChannel()` call that rejects during CHANNEL_ERROR retry, when the `.catch()` handler fires, then `handleScriptureError` is called AND `isRetryingRef.current` is reset to `false`.
- [x] AC-6: Given `_broadcastFn` throws synchronously (channel in bad state), when any slice action calls `get()._broadcastFn?.('event', payload)`, then the error is caught by try/catch and routed to `handleScriptureError`.
- [x] AC-7 (regression guard): Given a together-mode session, when `endSession()` is called, then the `_broadcastFn` call with `state_updated` payload occurs BEFORE `set({ ...initialScriptureState })`, AND the payload contains `triggered_by: 'end_session'` and `currentPhase: 'complete'`.
- [x] AC-8: All existing unit tests pass (no regressions).

#### Chunk 4 — Auth + SQL Hardening

- [x] AC-9: Given `supabase.auth.getUser()` returns an error, when `loadSession` is called, then it sets `scriptureError` with `UNAUTHORIZED` code and returns without setting `currentUserId` or loading the session.
- [x] AC-10: Given `supabase.auth.getUser()` returns `{ user: null }`, when `selectRole` is called, then it resets `myRole` to `null`, sets `scriptureError` with `UNAUTHORIZED`, and returns without calling the RPC.
- [x] AC-11: Given `authData.user?.id` is undefined in the broadcast hook, when the auth check completes, then the hook does NOT call `channel.subscribe()` and does NOT broadcast `partner_joined`.
- [x] AC-12: Given the `scripture_end_session` function, when inspected via `pg_proc`, then `prosecdef` is `false` (SECURITY INVOKER).
- [x] AC-13: Given the `scripture_lock_in` function, when the step boundary is evaluated, then it uses a named constant `v_max_step_index` (value 16) instead of a hardcoded literal.
- [x] AC-14: Given a `realtime.messages` row with topic `scripture-session:not-a-uuid`, when the RLS SELECT policy is evaluated, then the row is excluded (no cast error).
- [x] AC-15: Given a together-mode session with roles assigned, when `scripture_convert_to_solo` is called, then `user1_role` and `user2_role` are both NULL in the resulting row.
- [x] AC-16: All existing unit tests, E2E tests, and pgTAP tests pass (no regressions).

## Additional Context

### Dependencies

- `@sentry/react` — already installed and configured
- Sentry DSN configured via `VITE_SENTRY_DSN` environment variable
- Supabase local instance required for migration testing (`supabase start`)
- No new dependencies required

### Testing Strategy

- **Unit tests (Vitest + happy-dom):**
  - `tests/unit/services/scriptureReadingService.sentry.test.ts` — Sentry integration in `handleScriptureError` (AC-1, AC-2, AC-3)
  - `tests/unit/hooks/useScriptureBroadcast.errorhandling.test.ts` — Channel `.catch()` handlers and broadcast try/catch (AC-4, AC-5, AC-6, AC-11)
  - `tests/unit/stores/scriptureReadingSlice.endSession.test.ts` — endSession ordering (AC-7)
  - `tests/unit/stores/scriptureReadingSlice.authguards.test.ts` — Auth guards (AC-9, AC-10)
- **pgTAP tests:**
  - A1: `SELECT NOT prosecdef FROM pg_proc WHERE proname = 'scripture_end_session'` → true (AC-12)
  - A3: Test RLS with malformed topic strings (AC-14)
  - A4: Call `scripture_convert_to_solo`, verify role columns are NULL (AC-15)
- **Manual verification:**
  - `supabase db reset` — confirm migration applies cleanly
  - `npm run test:unit` — all existing + new tests pass
  - `npm run test:db` — pgTAP tests pass
  - `npm run typecheck` — no type errors
  - `npm run lint` — no lint errors

### Notes

- Chunk 1 and Chunk 4 can be implemented in parallel since Chunk 4 has no dependency on Chunk 1.
- The retro identifies Chunks 2+3 as follow-up work after Chunk 1 is complete. A separate quick-spec should be created for those.
- Source: Epic 4 Retrospective (`_bmad-output/implementation-artifacts/epic-4-retro-2026-03-02.md`)
- The `_broadcastFn` is called in 8 places in the slice (lines 591, 639, 670, 822, 840, 849, 916, 964). The E7 fix wraps it at the *definition* site (`useScriptureBroadcast.ts:173`) rather than all 8 call sites — single point of defense.
- Task 2 is the combined C4+E7 implementation for the `setBroadcastFn` lambda (try/catch + `.catch()`) plus the partner_joined `.catch()`.
- **SQL copy source:** All SQL tasks (10, 11, 13) MUST copy from `20260301000200_remove_server_side_broadcasts.sql` — this is the current live version with `realtime.send()` calls removed. Do NOT copy from older migrations (`20260220000001`, `20260222000001`, `20260302000100`) as they contain either server-side broadcasts or SECURITY DEFINER regressions.
- The SQL migration creates/replaces 3 functions and drops/recreates 4 RLS policies. All operations should be in a single migration file. Supabase migrations run inside an implicit transaction — if any statement fails, the entire migration rolls back.
- **Rollback plan:** If the migration causes issues in production, run `supabase db reset` to re-apply all migrations from scratch. For partial rollback, create a new migration that `CREATE OR REPLACE`s the affected functions back to their `20260301000200` versions.

### Adversarial Review

An adversarial review (Sonnet model, fresh context) was run against the v1 spec and found 13 findings. All 13 were validated as Real and have been incorporated into this spec:

| # | Severity | Fix Summary |
|---|----------|-------------|
| F1 | Critical | Task 10: Changed copy source from `20260302000100` to `20260301000200` |
| F2 | Critical | Task 10: Added merge of `current_phase = 'complete'` from `20260302000100` to prevent regression |
| F3 | High | Task 13: Changed copy source from `20260220000001` to `20260301000200` (prevents double-broadcast) |
| F4 | Medium | Corrected `_broadcastFn` call site count from 7 to 8 (added lines 840, 849) |
| F5 | High | Task 6: Moved auth check BEFORE `getSession()` network call |
| F6 | High | Merged Tasks 2+4 into single Task 2 (both modified line 174) |
| F7 | Medium | Task 8: Added note to NOT set `channelRef.current = null` on early return (prevents orphaned channel) |
| F8 | Medium | Technical Decision 9: Documented UUID regex case-sensitivity assumption |
| F9 | High | Task 11: Changed copy source from `20260222000001` to `20260301000200`; re-add comment from `20260302000200` |
| F10 | Medium | AC-7: Labeled as regression guard; added payload assertion (`triggered_by`, `currentPhase`) |
| F11 | Low | AC-3: Required explicit `toHaveBeenCalledTimes(1)` assertion |
| F12 | Low | Fixed selectRole line number reference to 561 |
| F13 | Medium | Added explicit rollback plan (supabase db reset + partial rollback strategy) |

### Implementation Review Notes

- Adversarial code review completed (Sonnet model, fresh context, information asymmetry)
- Findings: 11 total, 10 fixed, 1 skipped (noise — F9 UUID case intentional)
- Resolution approach: auto-fix
- Key fixes applied:
  - F1 (High): removeChannel failure now retries via setRetryCount instead of leaving channel dead
  - F2 (Medium): Warning-level Sentry errors now include error.details via scope.setExtra
  - F3 (Medium): selectRole auth check moved before optimistic update to prevent UI flash
  - F4 (Medium): applySessionConverted session guard restored
  - F5 (Low): CLOSED handler .then() checks session still active before retry
  - F6 (Low): Cleanup removeChannel uses silent catch on unmount
  - F7 (Low): Ordering test clarifying comment added
  - F8 (Low): Edge-case test added for authError + valid userId
  - F11 (Low): convertToSolo SQL now resets current_step_index to 0
- Tests: 815 passed, 0 failures. Typecheck clean.
