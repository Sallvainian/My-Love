# Tasks / Subtasks

- [x] Task 1: Verify existing Sprint 0 infrastructure (AC: #1, #2)
  - [x] 1.1 Confirm Supabase migration applied with all 5 tables, RLS, RPCs
  - [x] 1.2 Confirm dbSchema.ts has all scripture stores at DB_VERSION=5
  - [x] 1.3 Verify existing services import from dbSchema.ts (tech debt fix)
  - [x] 1.4 If any service hardcodes DB_VERSION, update to import from dbSchema.ts
- [x] Task 2: Create scriptureReadingService.ts (AC: #3)
  - [x] 2.1 Create `src/services/scriptureReadingService.ts` extending BaseIndexedDBService
  - [x] 2.2 Implement session CRUD (create, get, getAll, update)
  - [x] 2.3 Implement reflection CRUD (add, getBySession)
  - [x] 2.4 Implement bookmark CRUD (add, toggle, getBySession)
  - [x] 2.5 Implement message CRUD (add, getBySession)
  - [x] 2.6 Implement cache-first read pattern with server refresh
  - [x] 2.7 Implement write-through pattern (server first → update cache)
  - [x] 2.8 Implement corruption recovery (clear cache → refetch)
  - [x] 2.9 Add Zod validation schemas for Supabase responses
  - [x] 2.10 Add ScriptureErrorCode enum and handleScriptureError()
- [x] Task 3: Create scriptureReadingSlice.ts (AC: #4)
  - [x] 3.1 Create `src/stores/slices/scriptureReadingSlice.ts` with types
  - [x] 3.2 Define types: SessionPhase, SessionMode, ScriptureSession, ScriptureReadingState
  - [x] 3.3 Implement state: session, isLoading, isPendingLockIn, isPendingReflection, isSyncing, error
  - [x] 3.4 Implement actions: createSession, loadSession, exitSession, updatePhase
  - [x] 3.5 Update `src/stores/types.ts` — add ScriptureSlice to AppState interface
  - [x] 3.6 Update `src/stores/useAppStore.ts` — compose scriptureReadingSlice
- [x] Task 4: Create static scripture data (AC: #5)
  - [x] 4.1 Create `src/data/scriptureSteps.ts` with all 17 steps
  - [x] 4.2 Each step: verseReference, verseText, responseText, sectionTheme, stepIndex
  - [x] 4.3 Export as typed array with MAX_STEPS = 17 constant
- [x] Task 5: Sync database types (AC: #6)
  - [x] 5.1 Run `supabase gen types typescript` to regenerate database.types.ts
  - [x] 5.2 Verify scripture table types are present in output
- [x] Task 6: Write unit tests
  - [x] 6.1 Test scriptureReadingService (CRUD, cache pattern, error recovery)
  - [x] 6.2 Test scriptureReadingSlice (state transitions, actions)
  - [x] 6.3 Test dbSchema.ts integration (upgradeDb, store creation)

## Phase 1B: RLS/RPC Implementation (ATDD RED→GREEN)

> **Goal:** Make the 10 RED API tests in `tests/e2e/scripture/scripture-rls-security.spec.ts` pass.
> **Context:** RLS policies already exist in Sprint 0 migration. These tasks verify they work correctly with the test infrastructure and add the 2 missing functional RPCs.

- [x] Task 7: Verify RLS SELECT on scripture_sessions works with test infrastructure (AC: #1)
  - [x] 7.1 Confirm `scripture_sessions_select` RLS policy allows member SELECT — tests: P0-001 (2 tests)
  - [x] 7.2 Verify `createTestSession` factory seeds sessions with correct `user1_id`/`user2_id` so RLS membership checks pass
  - [x] 7.3 Verify `createUserClient` helper authenticates correctly against seeded test users
  - [x] 7.4 If tests fail: debug RLS policy vs test auth flow mismatch — the policy `user1_id = auth.uid() OR user2_id = auth.uid()` must match seed data
- [x] Task 8: Verify RLS SELECT on scripture_reflections works with test infrastructure (AC: #1)
  - [x] 8.1 Confirm `scripture_reflections_select` RLS policy allows own + shared reflections — tests: P0-002 (2 tests)
  - [x] 8.2 Confirm seed `includeReflections: true` creates reflections with correct `user_id` matching the session member
  - [x] 8.3 Confirm non-member user gets empty result (RLS blocks access)
- [x] Task 9: Verify RLS INSERT on scripture_reflections and scripture_bookmarks (AC: #1)
  - [x] 9.1 Confirm `scripture_reflections_insert` policy rejects non-member INSERT — tests: P0-003 (2 tests)
  - [x] 9.2 Confirm `scripture_bookmarks_insert` policy rejects non-member INSERT
  - [x] 9.3 Verify error response is truthy (not null) when RLS blocks INSERT
- [x] Task 10: Verify user_id = auth.uid() enforced on INSERT (AC: #1)
  - [x] 10.1 Confirm `scripture_reflections_insert` WITH CHECK includes `user_id = auth.uid()` — test: P0-004 (1 test)
  - [x] 10.2 Verify INSERT with mismatched `user_id` (impersonation attempt) returns error
  - [x] 10.3 If test fails: the existing policy has `user_id = auth.uid() AND is_scripture_session_member(session_id)` — both conditions must fail the impersonation case
- [x] Task 11: Verify is_shared visibility policy hides unshared reflections from partner (AC: #1)
  - [x] 11.1 Confirm `scripture_reflections_select` policy: own reflections always visible, partner sees only `is_shared=true` — test: P0-005 (1 test)
  - [x] 11.2 Verify seeded together-session has `test_user2_id` (not null) so partner visibility can be tested
  - [x] 11.3 If seed creates solo session (user2_id=null), adjust test factory or seed preset to ensure together-mode session for this test
- [x] Task 12: Create `scripture_create_session` RPC (AC: #1, #3)
  - [x] 12.1 Create new Supabase migration with `scripture_create_session(p_mode TEXT, p_partner_id UUID DEFAULT NULL)` RPC — test: P0-008 (1 test)
  - [x] 12.2 RPC inserts into `scripture_sessions` with: `user1_id = auth.uid()`, `mode = p_mode`, `status = 'in_progress'`, `current_phase = 'reading'`, `current_step_index = 0`
  - [x] 12.3 If `p_mode = 'together'`, set `user2_id = p_partner_id` (validate partner exists)
  - [x] 12.4 RPC returns JSONB with full session object (id, mode, status, current_step_index, current_phase, version, started_at)
  - [x] 12.5 Grant EXECUTE to `authenticated` role
  - [x] 12.6 Regenerate `database.types.ts` via `supabase gen types typescript --local`
- [x] Task 13: Create `scripture_submit_reflection` RPC with UPSERT (AC: #1, #4)
  - [x] 13.1 Create RPC `scripture_submit_reflection(p_session_id UUID, p_step_index INT, p_rating INT, p_notes TEXT, p_is_shared BOOLEAN)` — test: P0-012 (1 test)
  - [x] 13.2 RPC uses `INSERT ... ON CONFLICT (session_id, step_index, user_id) DO UPDATE` for idempotent writes
  - [x] 13.3 RPC enforces `user_id = auth.uid()` (caller cannot submit for another user)
  - [x] 13.4 RPC validates session membership via `is_scripture_session_member(p_session_id)`
  - [x] 13.5 RPC returns JSONB with reflection object (id, session_id, step_index, user_id, rating, notes, is_shared)
  - [x] 13.6 Grant EXECUTE to `authenticated` role
  - [x] 13.7 Second call with same (session_id, step_index) updates existing row — verify only 1 row exists after 2 calls

## Review Follow-ups (AI)

> **Reviewer:** Claude Opus 4.5 | **Date:** 2026-01-31 | **Verdict:** Changes Requested (4H, 3M, 2L)

- [x] [AI-Review][HIGH] H1: Resolve duplicate `ScriptureSession` type definitions — Slice now imports `ScriptureSession`, `ScriptureSessionPhase`, `ScriptureSessionMode` from `dbSchema.ts` (single source of truth). Re-exports as `SessionPhase`, `SessionMode` for consumer convenience. Removed duplicate interface from slice.
- [x] [AI-Review][HIGH] H2: Service test coverage is misleading — Added 20 service-level tests covering: `getSession` (cache-first + background refresh + onRefresh callback + error handling), `getUserSessions` (cache-first + server fallback), `updateSession` (write-through + cache update + server failure), `addBookmark`/`toggleBookmark`/`getBookmarksBySession`, `addMessage`/`getMessagesBySession`, `recoverSessionCache`/`recoverAllCaches`. Total: 37 service tests (17 existing + 20 new).
- [x] [AI-Review][HIGH] H3: `updateSession` now implements write-through pattern — server first via `supabase.from('scripture_sessions').update().eq()`, then updates IndexedDB cache on success. On server failure, cache is not modified and error is thrown.
- [x] [AI-Review][HIGH] H4: AC #1 labels updated — RPCs now split: `scripture_create_session`, `scripture_submit_reflection` marked as "DONE (Phase 1B, Tasks 12-13)"; `scripture_lock_in`, `scripture_advance_phase` marked as "STUB only (Sprint 0, not yet functional)".
- [x] [AI-Review][MEDIUM] M1: Removed `synced: boolean` from all 4 scripture IndexedDB types in `dbSchema.ts`. Removed `synced: true` from all `toLocal*` transform functions in `scriptureReadingService.ts`. Cache-only pattern has no use for sync tracking.
- [x] [AI-Review][MEDIUM] M2: Removed redundant `supabase.auth.getUser()` calls from `createSession` and `fetchAndCacheSession`. Now uses `validated.user1_id` (from RPC/query response) instead — single source of truth, no extra network round-trip.
- [x] [AI-Review][MEDIUM] M3: `getSession` now accepts `onRefresh` callback parameter. Background refresh invokes callback with refreshed session data, which Zustand slice passes as `(refreshed) => set({ session: refreshed })` to propagate fresh state.
- [x] [AI-Review][LOW] L1: Slice catch blocks now use `isScriptureError()` type guard to check if caught error is already a `ScriptureError`. If so, uses it directly preserving original error code. Only wraps in `SYNC_FAILED` for non-ScriptureError exceptions.
- [x] [AI-Review][LOW] L2: Removed redundant `as const` from `SCRIPTURE_STEPS` array. The `readonly ScriptureStep[]` type annotation already provides immutability.
