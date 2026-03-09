---
title: 'E2E Test Suite Maintainability & Performance Refactor'
slug: 'e2e-test-maintainability-refactor'
created: '2026-03-09'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Playwright', 'TypeScript', 'Supabase', 'PostgreSQL']
files_to_modify:
  - supabase/migrations/20260309000001_at_reflection_preset.sql (new)
  - tests/support/factories/index.ts
  - tests/support/helpers/rls-security.ts (new)
  - tests/support/helpers/scripture-overview.ts (new)
  - tests/e2e/scripture/scripture-rls-security.spec.ts
  - tests/e2e/scripture/scripture-overview.spec.ts
  - tests/e2e/scripture/scripture-reflection-2.2.spec.ts
  - tests/e2e/scripture/scripture-reflection-2.2-errors.spec.ts (new)
  - tests/e2e/scripture/scripture-reflection-2.3.spec.ts
  - tests/e2e/example.spec.ts (delete)
  - src/types/database.types.ts (regenerated)
code_patterns:
  - 'mergeTests fixture composition'
  - 'API-first seeding via RPC'
  - 'FK-ordered cleanup'
  - 'network-first intercept pattern'
  - 'CREATE OR REPLACE FUNCTION migration pattern'
test_patterns:
  - 'data-testid selectors'
  - 'GIVEN/WHEN/THEN comments'
  - 'interceptNetworkCall before action'
  - 'session isolation 3-step pattern'
---

# Tech-Spec: E2E Test Suite Maintainability & Performance Refactor

**Created:** 2026-03-09

## Overview

### Problem Statement

Three E2E test files exceed the 300-line maintainability threshold (scripture-reflection-2.2 at 395, scripture-rls-security at 369, scripture-overview at 365). Two reflection test files repeat an expensive 17-step UI traversal (~60s each) as test setup when a seeding preset could replace it. example.spec.ts contains anti-patterns (networkidle, commented-out code) that serve as a poor template.

### Solution

Split oversized files by extracting inline helpers and companion test groups into separate files. Add an `at_reflection` seeding preset to the `scripture_seed_test_data` RPC via a Supabase migration, then refactor reflection tests to use API-seeded setup instead of UI traversal. Delete example.spec.ts.

### Scope

**In Scope:**
- Split 3 oversized test files below 300 lines each
- Extract shared helpers: `createUserClient`, session isolation pattern, `saveSoloSessionAtStep`
- New Supabase migration: `at_reflection` preset in `scripture_seed_test_data` RPC
- Update factory types (`SeedPreset`)
- Refactor reflection tests (2.2 + 2.3) to use API-seeded preset
- Delete example.spec.ts

**Out of Scope:**
- Test ID standardization across domains
- CI artifact capture optimization (trace/screenshot/video settings)
- New test coverage or new test files beyond splits

## Context for Development

### Codebase Patterns

- All 27 E2E test files import `{ test, expect }` from `../../support/merged-fixtures`
- Helpers live in `tests/support/helpers.ts` (scripture-specific) and `tests/support/helpers/index.ts` (generic)
- Domain-specific helpers go in `tests/support/helpers/<domain>.ts` (e.g., `scripture-cache.ts`, `scripture-lobby.ts`, `scripture-together.ts`)
- Factories live in `tests/support/factories/index.ts` with `SeedPreset` type union
- Seeding uses `scripture_seed_test_data` RPC which accepts a `p_preset TEXT` parameter
- Existing presets: `mid_session` (step 7, reading), `completed` (step 16, complete), `with_help_flags` (step 7, reading), `unlinked` (step 7, solo, no partner)
- The `completed` preset creates a fully finished session (`status='complete'`, `current_phase='complete'`) — NOT suitable for reflection tests which need `status='in_progress'` at reflection phase
- Session phase enum values: `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete`
- `MAX_STEPS = 17` (defined in `src/data/scriptureSteps.ts`)
- **CRITICAL**: App detects active sessions via `checkForActiveSession()` which filters to `.filter((s) => s.status === 'in_progress' && s.mode === 'solo')`. The `at_reflection` preset MUST force `mode = 'solo'` explicitly — the default RPC logic sets `mode = 'together'` when two test users exist
- The RPC is defined in `supabase/migrations/20260204000001_unlinked_preset.sql` (latest version via `CREATE OR REPLACE FUNCTION`)
- Each new preset requires a new migration file that replaces the function with the added `WHEN` clause
- Session isolation in overview tests uses a 3-step pattern: (1) abandon competing sessions, (2) set `started_at` to `2099-01-01` to prioritize, (3) clear client cache

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `tests/e2e/scripture/scripture-reflection-2.2.spec.ts` | 395 lines — split error tests (lines 350-394) to companion file |
| `tests/e2e/scripture/scripture-reflection-2.3.spec.ts` | 291 lines — refactor to use API-seeded preset |
| `tests/e2e/scripture/scripture-rls-security.spec.ts` | 369 lines — extract `createUserClient` helper |
| `tests/e2e/scripture/scripture-overview.spec.ts` | 365 lines — extract `saveSoloSessionAtStep` + session isolation pattern |
| `tests/e2e/example.spec.ts` | 72 lines — delete |
| `tests/support/factories/index.ts` | Add `at_reflection` to `SeedPreset` type + `bookmarkSteps` option |
| `tests/support/helpers.ts` | `completeAllStepsToReflectionSummary` (lines 551-598), `submitReflectionSummary` (lines 609-649) — keep as-is |
| `tests/support/helpers/scripture-cache.ts` | `clearClientScriptureCache` — used by session isolation |
| `supabase/migrations/20260204000001_unlinked_preset.sql` | Current RPC definition — copy as base for new migration |
| `src/stores/slices/scriptureReadingSlice.ts` | `checkForActiveSession` (line 323) — confirms seeded sessions are auto-detected |

### Technical Decisions

- **CRITICAL**: The `at_reflection` preset MUST force `mode = 'solo'` in the session INSERT (same pattern as the `unlinked` preset), regardless of whether `v_test_user2_id` exists. Without this, `checkForActiveSession` won't find the session.
- The `at_reflection` preset seeds: `current_step_index=16` (0-indexed last step), `current_phase='reflection'`, `status='in_progress'`, all 17 step_states (indices 0-16), and optionally bookmarks at configurable step indices. The last step_state (index 16) should have `advanced_at = NULL` to match the real app behavior (step 16 transitions to reflection, not to step 17).
- The RPC gets a new optional parameter `p_bookmark_steps INT[] DEFAULT NULL` — when non-null with `at_reflection` preset, inserts `scripture_bookmarks` rows for each listed step index
- **CRITICAL**: After creating the migration, run `supabase gen types typescript --local > src/types/database.types.ts` to regenerate types. The new `p_bookmark_steps` parameter won't compile in the factory until the typed client knows about it.
- Reflection tests will: (1) seed via `createTestSession(supabase, { preset: 'at_reflection', bookmarkSteps: [0, 5, 12] })`, (2) isolate the session, (3) clear client cache, (4) navigate to `/scripture`, (5) app auto-detects and renders reflection summary screen
- **IMPORTANT**: `submitReflectionSummary` helper clicks `scripture-standout-verse-0`, so any test calling it after API seeding MUST include `0` in its `bookmarkSteps` array
- **IMPORTANT**: Test 2.3-E2E-003 uses `testSession.test_user2_id` for partner data. The API-seeded session must use the same user pair as `testSession`. Solution: use the `testSession` fixture's `supabaseAdmin` to seed, and pass `testSession.test_user1_id` context so the seeded session is owned by the same worker user.
- `createUserClient` extracted to `tests/support/helpers/rls-security.ts` — used by all 11 call sites in RLS tests
- `saveSoloSessionAtStep` + session isolation pattern extracted to `tests/support/helpers/scripture-overview.ts`
- `tests/support/fixtures/scripture-navigation.ts` also imports `completeAllStepsToReflectionSummary` — this fixture is NOT modified (it wraps the helper for UI-traversal scenarios that may still need it)
- example.spec.ts is deleted outright

## Implementation Plan

### Tasks

- [ ] Task 1: Create `at_reflection` preset migration
  - File: `supabase/migrations/20260309000001_at_reflection_preset.sql` (new)
  - Action: Copy the full `CREATE OR REPLACE FUNCTION scripture_seed_test_data(...)` from `20260204000001_unlinked_preset.sql`. Add a new parameter `p_bookmark_steps INT[] DEFAULT NULL`. Add a new `WHEN 'at_reflection'` clause that sets `v_current_step := 16`, `v_current_phase := 'reflection'`, `v_status := 'in_progress'`, `v_completed_at := NULL`. **CRITICAL**: In the session INSERT, force `mode = 'solo'` for `at_reflection` (same as `unlinked` preset) — add `p_preset = 'at_reflection'` to the CASE expression on line 97: `CASE WHEN p_preset IN ('unlinked', 'at_reflection') THEN 'solo'::scripture_session_mode`. Also set `user2_id = NULL` for `at_reflection` (same CASE as `unlinked`). In the step_states loop, set `advanced_at = NULL` for the last step (index 16) to match real app behavior (step 16 transitions to reflection, not to step 17): `CASE WHEN j = 16 AND p_preset = 'at_reflection' THEN NULL ELSE now() - ... END`. After the step_states loop, add a conditional block: `IF p_preset = 'at_reflection' AND p_bookmark_steps IS NOT NULL THEN` loop over `unnest(p_bookmark_steps)` and insert into `scripture_bookmarks` with `session_id = v_session_id`, `step_index = <loop var>`, `user_id = v_test_user1_id`, `share_with_partner = false`. Update the function comment to list all presets.
  - Notes: Run `supabase db reset` after creating to verify the migration applies cleanly.

- [ ] Task 2: Run the migration and regenerate types
  - Action: Run `supabase db reset` to apply the new migration. Then run `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts` to regenerate the TypeScript types so the new `p_bookmark_steps` parameter is available to the typed Supabase client. Verify by calling the RPC with `preset: 'at_reflection'` via `supabase` CLI or test.
  - Notes: This must succeed before any test refactoring. The type regeneration is REQUIRED — without it, Task 3 will fail at compile time.

- [ ] Task 3: Update factory types
  - File: `tests/support/factories/index.ts`
  - Action: Add `'at_reflection'` to the `SeedPreset` type union. Add `bookmarkSteps?: number[]` to `CreateTestSessionOptions`. Pass `p_bookmark_steps: options?.bookmarkSteps ?? null` in the `supabase.rpc()` call.

- [ ] Task 4: Extract `createUserClient` to helper
  - File: `tests/support/helpers/rls-security.ts` (new)
  - Action: Create file. Move the `createUserClient` function (lines 21-53 of `scripture-rls-security.spec.ts`) into it. Export it. Import `@supabase/supabase-js` `createClient` at the top level instead of dynamic `import()`.
  - Notes: Use static import since this is a helper module, not a test file.

- [ ] Task 5: Refactor scripture-rls-security.spec.ts
  - File: `tests/e2e/scripture/scripture-rls-security.spec.ts`
  - Action: Remove the inline `createUserClient` function. Add `import { createUserClient } from '../../support/helpers/rls-security'` at the top. All 11 call sites remain unchanged — just the import source changes. Target: ~335 lines (369 - 34 inline helper lines).

- [ ] Task 5b: Extract outsider-user pattern from RLS tests
  - File: `tests/support/helpers/rls-security.ts`
  - Action: Add a second export `createOutsiderClient(supabaseAdmin): Promise<{ client, userId, cleanup }>` that encapsulates the repeated pattern: (1) create a new user via `supabaseAdmin.auth.admin.createUser(...)`, (2) sign in via `createUserClient`, (3) return the client, userId, and a `cleanup` function that calls `supabaseAdmin.auth.admin.deleteUser(userId)`. This pattern is repeated in 6 tests across P0-001, P0-002, P0-003 (x2 tests), P0-005.
  - File: `tests/e2e/scripture/scripture-rls-security.spec.ts`
  - Action: Replace the 6 inline outsider-creation blocks with calls to `createOutsiderClient`. Each block is ~8 lines (createUser + cleanup), saving ~48 lines. Combined with Task 5 (-34 lines), total reduction: ~82 lines → target ~287 lines.

- [ ] Task 6: Extract overview helpers
  - File: `tests/support/helpers/scripture-overview.ts` (new)
  - Action: Create file with two exports:
    1. `saveSoloSessionAtStep(page: Page, step: number): Promise<string>` — move lines 29-42 from `scripture-overview.spec.ts`
    2. `isolateSessionForResume(params: { supabaseAdmin, sessionId, page }): Promise<void>` — extract the repeated 3-step pattern from P1-008 and P1-009: (a) query `user1_id` from session, (b) abandon competing `in_progress` solo sessions for that user, (c) set `started_at` to `2099-01-01`, (d) call `clearClientScriptureCache(page)`. Import `startSoloSession`, `advanceOneStep` from `../helpers` and `clearClientScriptureCache` from `./scripture-cache`.

- [ ] Task 7: Refactor scripture-overview.spec.ts
  - File: `tests/e2e/scripture/scripture-overview.spec.ts`
  - Action: Remove inline `saveSoloSessionAtStep`. Replace the duplicated session isolation blocks in P1-008 (lines 221-248) and P1-009 (lines 282-309) with a single call to `isolateSessionForResume({ supabaseAdmin, sessionId, page })`. Import both from `../../support/helpers/scripture-overview`. Target: ~290 lines (365 - 14 helper - ~60 duplicated isolation).

- [ ] Task 8: Extract error tests from scripture-reflection-2.2.spec.ts
  - File: `tests/e2e/scripture/scripture-reflection-2.2-errors.spec.ts` (new)
  - Action: Create companion file. Move lines 350-394 (the "Session completion 500 shows completion error screen" `test.describe` block with `skipNetworkMonitoring` annotation). Include the same imports: `{ test, expect }` from merged-fixtures and `completeAllStepsToReflectionSummary` from helpers.
  - File: `tests/e2e/scripture/scripture-reflection-2.2.spec.ts`
  - Action: Remove lines 349-395 (blank line + entire error injection block). Target: ~348 lines → refactor in Task 9 brings it under 300.

- [ ] Task 9: Refactor scripture-reflection-2.2.spec.ts to use API seeding
  - File: `tests/e2e/scripture/scripture-reflection-2.2.spec.ts`
  - Action: Replace all 4 calls to `completeAllStepsToReflectionSummary(page, bookmarkSteps)` with the API-seeded pattern:
    ```typescript
    // Seed session at reflection phase with specific bookmarks
    const seedResult = await createTestSession(supabaseAdmin, {
      preset: 'at_reflection',
      bookmarkSteps: [0, 5, 12], // or [] for no-bookmarks test
    });
    const sessionId = seedResult.session_ids[0];
    // Isolate and navigate
    await isolateSessionForResume({ supabaseAdmin, sessionId, page });
    await page.goto('/scripture');
    await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
    ```
    Add imports for `createTestSession`, `cleanupTestSession` from factories, `isolateSessionForResume` from helpers/scripture-overview. **Use explicit `cleanupTestSession` in a `test.afterEach`** — do NOT rely on the `testSession` fixture since the seeded sessions are created outside it. Track `seedResult.session_ids` in a describe-scoped variable and clean up after each test. Remove the `completeAllStepsToReflectionSummary` import. Update fixture destructuring to include `supabaseAdmin` where not already present.
  - Notes: Test 2.2-E2E-003 already has `supabaseAdmin` in fixtures. Tests 2.2-E2E-001 and 2.2-E2E-002 need it added. Test 2.2-E2E-004 (no-bookmarks) uses `bookmarkSteps: []`. **Important**: `submitReflectionSummary` clicks `scripture-standout-verse-0`, so all `bookmarkSteps` arrays that precede a `submitReflectionSummary` call MUST include `0`.

- [ ] Task 10: Refactor scripture-reflection-2.3.spec.ts to use API seeding
  - File: `tests/e2e/scripture/scripture-reflection-2.3.spec.ts`
  - Action: Same pattern as Task 9. Replace all 5 calls to `completeAllStepsToReflectionSummary(page, ...)` with API-seeded setup. Tests 2.3-E2E-001, 002, 005, and 006 use default bookmarks `[0, 5, 12]`. **CRITICAL for 2.3-E2E-003**: This test uses `testSession.test_user2_id` to insert a partner message into the seeded session. The API-seeded session uses the RPC's `v_test_user1_id` (first auth user), which is the same user as the `testSession` fixture's `test_user1_id` (both resolve from the same worker's auth pool). So `testSession.test_user2_id` will be valid for the seeded session's user pair. However, verify this by asserting `seedResult.test_user1_id === testSession.test_user1_id` as a guard. `submitReflectionSummary` calls remain as-is (they test actual reflection interaction). Remove `completeAllStepsToReflectionSummary` import. Use explicit `cleanupTestSession` in `afterEach` (same pattern as Task 9).
  - Notes: Each test still needs to reach the reflection summary screen, select verses, rate, and submit — only the 17-step walk is replaced. **Important**: `submitReflectionSummary` clicks `scripture-standout-verse-0`, so all `bookmarkSteps` arrays MUST include `0`.

- [ ] Task 11: Refactor scripture-reflection-2.2-errors.spec.ts to use API seeding
  - File: `tests/e2e/scripture/scripture-reflection-2.2-errors.spec.ts`
  - Action: Same pattern. Replace `completeAllStepsToReflectionSummary` with API-seeded preset. This test then submits the reflection normally and tests the error path on the PATCH that follows.

- [ ] Task 12: Delete example.spec.ts
  - File: `tests/e2e/example.spec.ts`
  - Action: Delete the file.

- [ ] Task 13: Verify all tests pass
  - Action: Run `npx playwright test tests/e2e/scripture/` to verify all scripture tests pass. Run `npx playwright test` for full suite to confirm no regressions.

- [ ] Task 14: Verify line counts
  - Action: Count lines for all modified spec files. Confirm all are under 300 lines:
    - `scripture-reflection-2.2.spec.ts` — target: <300 (was 395, removed error block + shortened setup)
    - `scripture-reflection-2.2-errors.spec.ts` — target: ~60 lines
    - `scripture-rls-security.spec.ts` — target: ~287 lines (after Task 5 + Task 5b extraction)
    - `scripture-overview.spec.ts` — target: ~290 lines

- [ ] Task 15: Format and commit
  - Action: Run `npm run format` on all changed files. Commit with message: `refactor(e2e): split oversized tests, add at_reflection preset, delete example`

### Acceptance Criteria

- [ ] AC 1: Given the `at_reflection` preset is used in `createTestSession`, when the RPC executes, then a session is created with `current_step_index=16`, `current_phase='reflection'`, `status='in_progress'`, and 17 step_states (indices 0-16).

- [ ] AC 2: Given the `at_reflection` preset is used with `bookmarkSteps: [0, 5, 12]`, when the RPC executes, then `scripture_bookmarks` rows are created for step indices 0, 5, and 12 with `share_with_partner=false`.

- [ ] AC 3: Given a seeded `at_reflection` session exists and is the newest `in_progress` session for the worker user, when the test navigates to `/scripture`, then the reflection summary screen is visible.

- [ ] AC 4: Given `scripture-reflection-2.2.spec.ts` has been refactored, when `npx playwright test scripture-reflection-2.2`, then all 4 tests (2.2-E2E-001 through 004) pass.

- [ ] AC 5: Given `scripture-reflection-2.3.spec.ts` has been refactored, when `npx playwright test scripture-reflection-2.3`, then all 5 tests pass.

- [ ] AC 6: Given `scripture-reflection-2.2-errors.spec.ts` has been extracted, when `npx playwright test scripture-reflection-2.2-errors`, then the error injection test passes.

- [ ] AC 7: Given `createUserClient` has been extracted to `tests/support/helpers/rls-security.ts`, when `npx playwright test scripture-rls-security`, then all 11 security tests pass.

- [ ] AC 8: Given `saveSoloSessionAtStep` and `isolateSessionForResume` have been extracted to `tests/support/helpers/scripture-overview.ts`, when `npx playwright test scripture-overview`, then all 9 tests pass.

- [ ] AC 9: Given `example.spec.ts` has been deleted, when `npx playwright test` runs the full suite, then no test references `example.spec.ts` and the suite passes.

- [ ] AC 10: Given all refactoring is complete, when line counts are checked, then no spec file exceeds 300 lines.

- [ ] AC 11: Given the `at_reflection` preset is used, when the session is created, then it has `mode='solo'` (not `together`), ensuring `checkForActiveSession` can find it.

- [ ] AC 12: Given a reflection test uses API seeding, when the test runs, then setup time per test is under 10 seconds (vs ~60s with UI traversal).

## Additional Context

### Dependencies

- Local Supabase must be running (`supabase start`)
- `supabase db reset` must be run after creating the migration (Task 2)
- Tasks 4-5b (RLS helper extraction) are independent of Tasks 1-3 (migration/factory)
- Task 6 → Task 7 are sequential (Task 7 uses helpers from Task 6)
- Tasks 4-5b and Tasks 6-7 can run in parallel with each other and with Tasks 1-3
- Tasks 8-11 (reflection refactoring) depend on BOTH Tasks 1-3 (preset + types) AND Task 6 (isolateSessionForResume)

### Testing Strategy

- No new unit tests needed — this is purely E2E test infrastructure refactoring
- All existing E2E tests must continue to pass with identical behavior
- Run `npx playwright test` for full suite verification after all changes
- Spot-check that reflection tests complete significantly faster (~5s vs ~60s per test)

### Notes

- **Risk: Session isolation in reflection tests.** The seeded session must be the newest `in_progress` session for the worker user. The `isolateSessionForResume` helper handles this by abandoning competitors and prioritizing via `started_at`. The seeded session is created by the service-role client but owned by the same `v_test_user1_id` that maps to the worker's auth pool user, so the isolation pattern works identically to UI-created sessions.
- **`completeAllStepsToReflectionSummary` is NOT removed from helpers.ts.** It is still used by `tests/support/fixtures/scripture-navigation.ts` (the `scriptureNav.completeAllSteps` fixture). That fixture is not modified in this spec — it provides UI-traversal capability for tests that need it (e.g., solo-reading flow tests). If all spec-file callers are migrated, the function stays in helpers.ts for the fixture's use.
- **`submitReflectionSummary` has an implicit dependency on bookmark index 0.** It clicks `scripture-standout-verse-0` as part of the form submission. Any test using API seeding followed by `submitReflectionSummary` must include `0` in `bookmarkSteps`.
