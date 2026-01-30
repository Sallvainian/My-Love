# Story 1.1: Database Schema & Backend Infrastructure

Status: review

## Story

As a developer,
I want the Supabase tables, RLS policies, RPCs, centralized dbSchema.ts, and scripture reading service created,
So that all frontend features have a reliable backend foundation.

## Acceptance Criteria

1. **Supabase Tables & Policies Exist**
   - `scripture_sessions` (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, snapshot_json, started_at, completed_at) — **DONE (Sprint 0)**
   - `scripture_step_states` (id, session_id, step_index, user1_locked_at, user2_locked_at, advanced_at) — **DONE (Sprint 0)**
   - `scripture_reflections` (id, session_id, step_index, user_id, rating, notes, is_shared, created_at) — **DONE (Sprint 0)**
   - `scripture_bookmarks` (id, session_id, step_index, user_id, share_with_partner, created_at) — **DONE (Sprint 0)**
   - `scripture_messages` (id, session_id, sender_id, message, created_at) — **DONE (Sprint 0)**
   - RLS policies enforce session-based access (only session participants can read/write) — **DONE (Sprint 0)**
   - RPCs exist: `scripture_create_session`, `scripture_submit_reflection`, `scripture_lock_in`, `scripture_advance_phase` — **DONE (Sprint 0)**
   - Unique constraint on scripture_reflections (session_id, step_index, user_id) for idempotent writes — **DONE (Sprint 0)**

2. **Centralized IndexedDB Schema Exists**
   - `src/services/dbSchema.ts` centralizes DB_NAME, DB_VERSION (5), and all store definitions — **DONE (Sprint 0)**
   - Existing services (moodService, customMessageService, photoStorageService) import from dbSchema.ts — **VERIFY & FIX if needed**
   - New IndexedDB stores: scripture-sessions, scripture-reflections, scripture-bookmarks, scripture-messages — **DONE (Sprint 0)**
   - Scripture stores use cache-only pattern (no 'synced' index) — **DONE (Sprint 0)**

3. **Scripture Reading Service Created**
   - `src/services/scriptureReadingService.ts` extends BaseIndexedDBService
   - Provides IndexedDB CRUD for scripture data (read-heavy, write-through to server)
   - Read pattern: check IndexedDB first → return cached → fetch fresh from server → update cache
   - Write pattern: POST to server → on success update IndexedDB → on failure show retry UI
   - Corruption recovery: on IndexedDB error, clear cache and refetch from server

4. **Scripture Reading Slice Created**
   - `src/stores/slices/scriptureReadingSlice.ts` exports types: SessionPhase, SessionMode, ScriptureSession, ScriptureReadingState
   - Provides actions for session lifecycle (create, load, exit)
   - Follows existing Zustand slice composition pattern
   - Composed into useAppStore via `src/stores/useAppStore.ts`
   - AppState interface in `src/stores/types.ts` updated with ScriptureSlice

5. **Static Scripture Data Added**
   - All 17 steps with verse text, response text, section themes, and verse references available as static TypeScript module
   - Location: `src/data/scriptureSteps.ts`

6. **Database Types Synced**
   - `src/types/database.types.ts` includes scripture table types (run `supabase gen types typescript`)

## Tasks / Subtasks

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

### Phase 1B: RLS/RPC Implementation (ATDD RED→GREEN)

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

## Dev Notes

### ATDD RED→GREEN: 10 API Tests to Make Pass

**Test file:** `tests/e2e/scripture/scripture-rls-security.spec.ts` (10 tests, all RED)

| Test ID | Test Name | Task | What Makes It GREEN |
|---------|-----------|------|---------------------|
| P0-001a | SELECT scripture_sessions - member access | 7 | RLS policy + test auth flow working |
| P0-001b | SELECT scripture_sessions - non-member blocked | 7 | RLS policy blocking non-member |
| P0-002a | SELECT scripture_reflections - member access | 8 | RLS policy + seed with reflections |
| P0-002b | SELECT scripture_reflections - non-member blocked | 8 | RLS policy blocking non-member |
| P0-003a | INSERT scripture_reflections - non-member rejected | 9 | RLS INSERT policy rejecting |
| P0-003b | INSERT scripture_bookmarks - non-member rejected | 9 | RLS INSERT policy rejecting |
| P0-004 | user_id = auth.uid() enforced on INSERT | 10 | WITH CHECK on user_id |
| P0-005 | is_shared visibility - unshared hidden | 11 | SELECT policy filtering is_shared |
| P0-008 | Solo session creation via RPC | 12 | `scripture_create_session` RPC exists |
| P0-012 | Idempotent reflection write (upsert) | 13 | `scripture_submit_reflection` RPC with UPSERT |

**Run command:** `npx playwright test tests/e2e/scripture/scripture-rls-security.spec.ts`

**Key insight:** RLS policies (Tasks 7-11) already exist in Sprint 0 migration `20260128000001_scripture_reading.sql`. These tasks are primarily about **verifying the test infrastructure works** against the existing policies. Tasks 12-13 create **net-new RPCs** that don't exist yet.

### Migration File for New RPCs

Tasks 12-13 require a **new migration file** (do NOT modify the Sprint 0 migration):
- Path: `supabase/migrations/20260130000001_scripture_rpcs.sql`
- Contains: `scripture_create_session` and `scripture_submit_reflection` RPCs
- After creating: run `supabase db reset` locally, then `supabase gen types typescript --local` to update `database.types.ts`

### Test Infrastructure Notes

The RLS tests use:
- **Factory:** `createTestSession(supabaseAdmin, options)` — seeds via `scripture_seed_test_data` RPC
- **Helper:** `createUserClient(supabaseAdmin, userId)` — creates authenticated Supabase client for specific user
- **Fixture:** `supabaseAdmin` from `tests/support/merged-fixtures.ts` — service-role client
- **Fixture:** `testSession` — auto-seeded session with cleanup

**Known risk:** The `scripture_seed_test_data` RPC uses `SELECT id FROM auth.users ORDER BY created_at LIMIT 1` to find test users. If the local Supabase has no auth users, seeding fails. Ensure `supabase db reset` + test user creation runs before tests.

**Together-mode seed note:** P0-005 (is_shared visibility) requires a together-mode session with both user1 and user2. The seed RPC creates together-mode sessions when 2+ auth users exist. If only 1 user exists, it creates solo sessions and `test_user2_id` will be null — the test guards against this with `if (seedResult.test_user2_id)`.

### What Already Exists (Sprint 0)

Sprint 0 implemented significant backend infrastructure. The following files are **already created and should NOT be recreated**:

| File | Status | Notes |
|------|--------|-------|
| `supabase/migrations/20260128000001_scripture_reading.sql` | DONE | 5 tables, RLS, RPCs, seeding RPC, indexes |
| `src/services/dbSchema.ts` | DONE | DB_VERSION=5, all scripture stores, types, upgradeDb() |
| `src/stores/slices/navigationSlice.ts` | DONE | Already has `'scripture'` in ViewType |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | PARTIAL | Basic overview component exists |
| `src/services/BaseIndexedDBService.ts` | DONE | Generic base class for IndexedDB services |
| `tests/e2e/scripture-*.spec.ts` | PARTIAL | Placeholder E2E tests (mostly skipped) |

### What Needs to Be Created

| File | Action | Priority |
|------|--------|----------|
| `src/services/scriptureReadingService.ts` | CREATE | P0 |
| `src/stores/slices/scriptureReadingSlice.ts` | CREATE | P0 |
| `src/stores/types.ts` | MODIFY (add ScriptureSlice) | P0 |
| `src/stores/useAppStore.ts` | MODIFY (compose slice) | P0 |
| `src/data/scriptureSteps.ts` | CREATE | P0 |
| `src/types/database.types.ts` | REGENERATE (supabase gen types) | P1 |
| `src/types/models.ts` | MODIFY (add scripture models) | P1 |
| `src/validation/schemas.ts` | MODIFY (add scripture schemas) | P1 |
| Existing IndexedDB services | VERIFY imports from dbSchema.ts | P1 |

### Architecture Compliance

**MANDATORY patterns — follow exactly:**

- **Zustand slice composition:** Co-locate types with slice. Use `StateCreator<AppState, AppMiddleware, [], ScriptureSlice>` pattern. Register in `useAppStore.ts`.
  - [Source: architecture.md#Implementation Patterns]

- **Service layer:** Extend `BaseIndexedDBService`. Use `upgradeDb` from `dbSchema.ts`. Follow existing moodService/customMessageService patterns.
  - [Source: architecture.md#Decision 4: Caching Architecture]

- **Container/Presentational pattern:** Smart containers connect to slice, dumb components receive props. Don't fetch data in presentational components.
  - [Source: architecture.md#Decision 5: Component Architecture]

- **Error handling:** Use `ScriptureErrorCode` enum + `handleScriptureError()` centralized handler. No class hierarchies.
  - [Source: architecture.md#Format Patterns]

- **Loading states:** Explicit boolean flags (`isLoading`, `isPendingLockIn`, `isPendingReflection`, `isSyncing`). Never use status enums for simple loading.
  - [Source: architecture.md#Loading State Naming]

- **Naming conventions:**
  - DB columns: `snake_case` (`step_index`, `user_id`, `is_shared`)
  - Broadcast events: `snake_case` (`state_updated`, `presence_update`)
  - RPCs: `scripture_` prefix + action-oriented (`scripture_lock_in`)
  - TS variables/functions: `camelCase`
  - TS components: `PascalCase`
  - Constants: `SCREAMING_CASE` (`MAX_STEPS = 17`)
  - [Source: architecture.md#Naming Patterns]

- **Type organization:**
  - Feature types: co-located with `scriptureReadingSlice.ts`
  - DB types: `src/types/database.types.ts` (auto-generated)
  - App models: `src/types/models.ts`
  - [Source: project-context.md#Type Organization]

- **Validation:** Zod schemas for all Supabase responses at boundary. Follow MoodApi validation pattern.
  - [Source: project-context.md#API Validation]

- **No `any`:** Use `unknown`, generics, `Record<string, unknown>`, or `z.infer<>`. Lint-enforced error.
  - [Source: project-context.md#Type Safety]

- **No React Router:** Navigation via `navigationSlice` (`setView('scripture')`).
  - [Source: project-context.md#Framework-Specific Rules]

- **Pure client SPA:** Never use `"use client"` or `"use server"` directives.
  - [Source: project-context.md#Framework-Specific Rules]

### Cache Pattern (Solo Mode — Server is Source of Truth)

```
READ: IndexedDB cache → return cached → fetch fresh from Supabase → update cache
WRITE: POST to Supabase RPC → on success → update IndexedDB cache → on failure → show retry
CORRUPTION: On IndexedDB error → clear cache → refetch from server
```

Scripture stores do NOT use the 'synced' index pattern. They are read-cache only. The server (Supabase) is always source of truth.
- [Source: architecture.md#Decision 4: Caching Architecture]

### IndexedDB Stores (from dbSchema.ts)

```typescript
'scripture-sessions': { keyPath: 'id', indexes: ['user_id'] }
'scripture-reflections': { keyPath: 'id', indexes: ['session_id'] }
'scripture-bookmarks': { keyPath: 'id', indexes: ['session_id'] }
'scripture-messages': { keyPath: 'id', indexes: ['session_id'] }
```

No 'synced' index — cache-only pattern.

### Zustand Slice Pattern (from existing slices)

```typescript
// In src/stores/slices/scriptureReadingSlice.ts
export type SessionPhase = 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
export type SessionMode = 'solo' | 'together';

export interface ScriptureSession {
  id: string;
  mode: SessionMode;
  currentPhase: SessionPhase;
  currentStepIndex: number;
  version: number;
  // ... match dbSchema.ts types
}

export interface ScriptureReadingState {
  session: ScriptureSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;
  error: ScriptureError | null;
}

// Slice follows StateCreator pattern from src/stores/types.ts
```

### Error Handling Pattern

```typescript
export enum ScriptureErrorCode {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SYNC_FAILED = 'SYNC_FAILED',
  OFFLINE = 'OFFLINE',
}

export interface ScriptureError {
  code: ScriptureErrorCode;
  message: string;
  details?: unknown;
}

export function handleScriptureError(error: ScriptureError): void {
  switch (error.code) {
    case ScriptureErrorCode.VERSION_MISMATCH:
      // Refetch session state, show subtle toast
      break;
    case ScriptureErrorCode.SYNC_FAILED:
      // Queue for retry, show offline indicator
      break;
    // ...
  }
}
```

### Static Scripture Data Structure

```typescript
// src/data/scriptureSteps.ts
export const MAX_STEPS = 17;

export interface ScriptureStep {
  stepIndex: number;        // 0-16
  sectionTheme: string;     // e.g., "Healing & Restoration"
  verseReference: string;   // e.g., "Psalm 147:3"
  verseText: string;        // Full NKJV verse text
  responseText: string;     // Couple-focused response prayer
}

export const SCRIPTURE_STEPS: readonly ScriptureStep[] = [ /* 17 steps */ ];
```

The 6 section themes (from PRD): Healing & Restoration, Forgiveness & Reconciliation, Confession & Repentance, God's Faithfulness & Peace, The Power of Words, Christlike Character.

### Supabase RPC Signatures (Already in Migration)

```sql
scripture_create_session(p_mode TEXT, p_partner_id UUID DEFAULT NULL) → JSONB
scripture_lock_in(p_session_id UUID, p_step_index INT, p_user_id UUID, p_expected_version INT) → JSONB
scripture_advance_phase(p_session_id UUID, p_expected_version INT) → JSONB
scripture_submit_reflection(p_session_id UUID, p_step_index INT, p_rating INT, p_notes TEXT, p_is_shared BOOLEAN) → JSONB
scripture_seed_test_data(p_preset TEXT DEFAULT 'mid_session') → JSONB (test environments only)
```

### RLS Pattern (Session-Based Access)

All scripture_* tables enforce that the authenticated user must be `user1_id` or `user2_id` on the parent scripture_session. Uses `is_scripture_session_member(p_session_id)` helper function.

### sw-db.ts Sync Note

Service worker file `src/sw-db.ts` must be kept in sync manually with dbSchema.ts. **For this story, no sw-db.ts update is needed** — scripture uses cache-only pattern, not Background Sync.
- [Source: architecture.md#Tech Debt Fix]

### Technology Versions (Locked)

| Technology | Version | Notes |
|-----------|---------|-------|
| React | 19.2.3 | Hooks only, no class components |
| TypeScript | 5.9.3 | Strict mode |
| Zustand | 5.0.10 | Latest stable, slice composition |
| Supabase JS | 2.90.1 | Auth, DB, Storage, Realtime Broadcast |
| idb | 8.0.3 | Latest stable |
| Zod | 4.3.5 | Latest stable, validate at boundaries |
| Framer Motion | 12.27.1 | useReducedMotion hook stable |
| Vitest | 4.0.17 | Unit/integration tests |
| fake-indexeddb | 6.2.5 | IndexedDB test mock |

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming) — all new files follow existing conventions
- `src/stores/slices/` for Zustand slices (camelCaseSlice.ts)
- `src/services/` for service layer (camelCaseService.ts)
- `src/data/` for static data modules
- `src/types/` for shared types (database.types.ts, models.ts)
- `src/validation/` for Zod schemas
- `tests/unit/` mirrors src structure

### References

- [Source: _bmad-output/atdd-checklist-epic-1.md#Phase 1: Backend (Story 1.1) — Make RLS Tests Pass]
- [Source: tests/e2e/scripture/scripture-rls-security.spec.ts — 10 RED API tests]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1: Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 4: Caching Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tech Debt Fix: Centralized dbConfig]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements]
- [Source: docs/project-context.md#Scripture Reading Feature Architecture]
- [Source: docs/project-context.md#Critical Implementation Rules]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List
- Task 1: All Sprint 0 infrastructure verified. Migration has 5 tables, RLS policies, seeding RPC. Note: Functional RPCs (create_session, lock_in, advance_phase, submit_reflection) listed as "DONE (Sprint 0)" in AC are not in migration file — these are future work beyond this story. dbSchema.ts confirmed at v5 with all 4 scripture stores. All 3 existing services (mood, customMessage, photoStorage) already import from dbSchema.ts — no hardcoded DB_VERSION found.
- Task 2: Created scriptureReadingService.ts (25.9KB) — extends BaseIndexedDBService with full session/reflection/bookmark/message CRUD, Zod validation schemas for all Supabase responses, cache-first reads, write-through writes, corruption recovery, ScriptureErrorCode enum + handleScriptureError(). Uses existing moodService/customMessageService patterns.
- Task 3: Created scriptureReadingSlice.ts (5.3KB) — Zustand slice with SessionPhase, SessionMode, ScriptureSession types co-located. State: session, isLoading, isInitialized, isPendingLockIn, isPendingReflection, isSyncing, error. Actions: createSession, loadSession, exitSession, updatePhase, clearScriptureError. Composed into useAppStore.ts and AppState via types.ts.
- Task 4: Created scriptureSteps.ts (9.5KB) — 17 scripture steps across 6 themes (Healing & Restoration, Forgiveness & Reconciliation, Confession & Repentance, God's Faithfulness & Peace, The Power of Words, Christlike Character). NKJV verses with couple-focused response prayers. MAX_STEPS=17 constant exported.
- Task 5: Regenerated database.types.ts via `supabase gen types typescript --local`. Now includes all 5 scripture tables, 3 enums (mode, phase, status), and scripture_seed_test_data RPC.
- Task 6: Wrote 31 new unit tests across 3 test files. All 240 tests pass (22 files), zero regressions. Tests cover: IndexedDB CRUD for all 4 scripture stores, cache corruption recovery, error codes, slice state transitions, static data validation.

- Story re-opened (review → ready-for-dev) on 2026-01-30: Added Tasks 7-13 (Phase 1B) from ATDD checklist. 7 new tasks to make 10 RED API tests in scripture-rls-security.spec.ts pass. Tasks 7-11 verify existing RLS policies work with test infrastructure. Tasks 12-13 create net-new RPCs (scripture_create_session, scripture_submit_reflection).
- Tasks 7-11 (RLS verification): RLS policies from Sprint 0 migration work correctly. Found and fixed a critical bug in `scripture_seed_test_data` RPC — the `RETURNING id INTO v_session_id` in reflection/message insert loops was overwriting the session_id variable, causing FK constraint violations when `includeReflections: true`. Fix: introduced separate `v_temp_id` variable for sub-insert RETURNING clauses. With test users created in local Supabase, all 8 RLS tests pass (P0-001 through P0-005). Together-mode seeding works correctly with 2 auth users — partner visibility test (P0-005) confirms unshared reflections hidden from partner.
- Task 12: Created `scripture_create_session` RPC in new migration `20260130000001_scripture_rpcs.sql`. RPC validates mode ('solo'/'together'), validates partner exists for together mode, inserts session with `auth.uid()` as user1, sets initial state (phase='reading', step_index=0, status='in_progress', version=1). Returns full JSONB session object. Granted EXECUTE to authenticated. Test P0-008 passes.
- Task 13: Created `scripture_submit_reflection` RPC in same migration. Uses `INSERT ... ON CONFLICT (session_id, step_index, user_id) DO UPDATE` for idempotent upsert. Enforces session membership via `is_scripture_session_member()` and `user_id = auth.uid()`. Validates rating range 1-5. Returns JSONB reflection object. Test P0-012 confirms: two calls with same (session_id, step_index) produce exactly 1 row with updated values.

### Validation Gates
- TypeScript: `npx tsc --noEmit` — PASS (zero errors)
- Tests: `npx vitest run` — 22 files, 240 tests, all PASS (1 expected failure: useMotionConfig.test.ts — hook not yet created, Phase 5 RED test)
- Regressions: Zero (240 existing tests all pass)
- ATDD API Tests: `npx playwright test tests/e2e/scripture/scripture-rls-security.spec.ts` — 10 tests, all GREEN ✅

### File List

**Created:**
- `src/services/scriptureReadingService.ts` — Scripture reading IndexedDB service (cache-first reads, write-through, corruption recovery)
- `src/stores/slices/scriptureReadingSlice.ts` — Zustand slice for scripture reading session state
- `src/data/scriptureSteps.ts` — Static 17-step scripture data with themes, verses, and response prayers
- `tests/unit/services/scriptureReadingService.test.ts` — Service unit tests (IndexedDB CRUD, cache, errors)
- `tests/unit/stores/scriptureReadingSlice.test.ts` — Slice unit tests (state transitions, actions)
- `tests/unit/data/scriptureSteps.test.ts` — Static data unit tests (structure, themes, uniqueness)

**Modified:**
- `src/stores/types.ts` — Added ScriptureSlice to AppState interface
- `src/stores/useAppStore.ts` — Composed createScriptureReadingSlice into store
- `src/types/database.types.ts` — Regenerated with scripture tables, enums, RPCs (including scripture_create_session, scripture_submit_reflection)

**Created (Phase 1B):**
- `supabase/migrations/20260130000001_scripture_rpcs.sql` — Fix seed RPC variable reuse bug + scripture_create_session + scripture_submit_reflection RPCs
- `tests/e2e/scripture/scripture-rls-security.spec.ts` — 10 E2E RLS/RPC API tests (P0-001 through P0-012)
- `tests/e2e/scripture/scripture-accessibility.spec.ts` — Accessibility E2E test placeholders
- `tests/e2e/scripture/scripture-overview.spec.ts` — Overview page E2E test placeholders
- `tests/e2e/scripture/scripture-session.spec.ts` — Session flow E2E test placeholders
- `tests/e2e/scripture/scripture-solo-reading.spec.ts` — Solo reading E2E test placeholders
- `tests/unit/hooks/useMotionConfig.test.ts` — RED test for useMotionConfig hook (Story 1.5)

**Modified (Code Review Fixes):**
- `src/validation/schemas.ts` — Added scripture Zod validation schemas (moved from inline in service)
- `src/types/models.ts` — Added scripture type re-exports from dbSchema
