---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04a-api-unit-tests', 'step-04b-e2e-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-02-17'
---

# ATDD Checklist - Epic 3, Story 1: Couple-Aggregate Stats Dashboard

**Date:** 2026-02-17
**Author:** Sallvain
**Primary Test Level:** E2E + Unit + Database (pgTAP)

---

## Story Summary

Story 3.1 adds a couple-aggregate stats dashboard to the Scripture Reading overview page. The dashboard displays five aggregate metrics (total sessions, total steps, last completed date, average rating, bookmark count) sourced from a SECURITY DEFINER RPC, with skeleton loading, zero-state handling, and Lavender Dreams glass morphism styling.

**As a** user
**I want** to see my Scripture Reading journey stats on the overview page
**So that** I can see our progress without gamification pressure

---

## Acceptance Criteria

1. Stats section displays 5 couple-aggregate metrics: totalSessions, totalSteps, lastCompleted, avgRating, bookmarkCount
2. Zero-state shows dashes + "Begin your first reading" when no completed sessions
3. Skeleton loading while fetching; cached stats shown immediately via Zustand persist (stale-while-revalidate)
4. Metrics reflect both partners' data via SECURITY DEFINER RPC with auth.uid() validation
5. Lavender Dreams glass morphism styling, single-column mobile, no gamification language

---

## Test Strategy

### AC → Test Level Mapping

| AC | Test ID | Level | Priority | Why This Level | Red Phase Failure |
|---|---|---|---|---|---|
| #4 | 3.1-DB-001 | pgTAP | P0 | Security isolation must be DB-verified | RPC doesn't exist |
| #1 | 3.1-DB-002 | pgTAP | P0 | Aggregate correctness requires known seed data | RPC doesn't exist |
| #1 | 3.1-E2E-001 | E2E | P0 | Full journey: seeded data → stats visible | Component + RPC don't exist |
| #1 | 3.1-UNIT-001 | Unit | P1 | Component renders 5 stat cards | Component doesn't exist |
| #3 | 3.1-UNIT-002 | Unit | P1 | Skeleton loading state | Component doesn't exist |
| #3 | 3.1-UNIT-003 | Unit | P1 | Stale-while-revalidate | Component doesn't exist |
| #2 | 3.1-UNIT-004 | Unit | P1 | Zero-state: dashes + message | Component doesn't exist |
| #1 | 3.1-UNIT-005 | Unit | P1 | Service calls RPC correctly | Service method doesn't exist |
| #1 | 3.1-UNIT-006 | Unit | P1 | Service error handling | Service method doesn't exist |
| #3 | 3.1-UNIT-007 | Unit | P1 | Slice state flow | Slice fields don't exist |
| #2 | 3.1-E2E-002 | E2E | P1 | E2E zero-state journey | Component + RPC don't exist |
| #5 | 3.1-UNIT-008 | Unit | P2 | No gamification language | Component doesn't exist |
| #1 | 3.1-UNIT-009 | Unit | P2 | Relative date formatting | Component doesn't exist |
| #1 | 3.1-UNIT-010 | Unit | P2 | Decimal rating formatting | Component doesn't exist |
| #5 | 3.1-UNIT-011 | Unit | P2 | Glass morphism classes | Component doesn't exist |
| #5 | 3.1-UNIT-012 | Unit | P2 | Accessibility aria-labels | Component doesn't exist |
| #2 | 3.1-DB-003 | pgTAP | P2 | RPC zero-state return | RPC doesn't exist |
| — | 3.1-PERF-001 | pgTAP | P3 | RPC performance baseline | RPC doesn't exist |
| — | 3.1-UNIT-013 | Unit | P3 | Zod schema validation | Schema doesn't exist |

### Red Phase Confirmation

All 19 tests will fail because none of the implementation exists yet:
- `scripture_get_couple_stats` RPC — not created
- `StatsSection.tsx` component — not created
- `getCoupleStats()` service method — not created
- `coupleStats` / `isStatsLoading` slice state — not added
- `data-testid="scripture-stats-*"` attributes — not in DOM

---

## TDD Red Phase — Test Generation Results

### Summary Statistics

| Metric | Value |
|---|---|
| TDD Phase | RED (all tests skip/fail) |
| Total Test Assertions | 52 |
| Unit Tests (Vitest) | 39 (all `it.skip()`) |
| E2E Tests (Playwright) | 2 (all `test.skip()`) |
| pgTAP Assertions | 11 |
| Placeholder Assertions | 0 (verified) |
| Test Files Created | 5 |
| Execution Mode | Parallel (unit+pgTAP || E2E) |
| Existing Suite Regression | 0 (597 passed, 39 skipped, 0 failed) |
| TypeScript Errors | 0 (`tsc --noEmit` clean) |

### Generated Test Files

| File | Test Count | Test IDs Covered | Level |
|---|---|---|---|
| `src/components/scripture-reading/__tests__/StatsSection.test.tsx` | 24 | 3.1-UNIT-001, 002, 003, 004, 008, 009, 010, 011, 012 | Unit |
| `tests/unit/services/scriptureReadingService.stats.test.ts` | 9 | 3.1-UNIT-005, 006, 013 | Unit |
| `tests/unit/stores/scriptureReadingSlice.stats.test.ts` | 6 | 3.1-UNIT-007 | Unit |
| `tests/e2e/scripture/scripture-stats.spec.ts` | 2 | 3.1-E2E-001, 002 | E2E |
| `supabase/tests/database/09_scripture_couple_stats.sql` | 11 | 3.1-DB-001, 002, 003 | pgTAP |

### TDD Red Phase Compliance

- All 39 Vitest tests use `it.skip()` — verified via grep
- All 2 Playwright tests use `test.skip(true, '...')` — verified via grep
- All 11 pgTAP assertions call `scripture_get_couple_stats()` which does not exist — will fail with "function does not exist"
- Zero `expect(true).toBe(true)` placeholder assertions found
- All tests assert **expected behavior** (the behavior that will be correct after implementation)

### Fixture & Infrastructure Status

- **Existing fixtures reused:** `merged-fixtures.ts` (scriptureNav, supabaseAdmin, workerAuth), `factories/index.ts` (createTestSession, cleanupTestSession)
- **New fixtures needed:** None — existing test infrastructure covers all needs
- **Mock patterns:** Followed existing `vi.mock()` patterns from `scriptureReadingService.service.test.ts` and `scriptureReadingSlice.test.ts`
- **RED phase type workarounds:** `type AnyService = any` and `type AnyState = any` used to access non-existent properties; will be removed in GREEN phase

### Acceptance Criteria Coverage

| AC | Covered By | Status |
|---|---|---|
| #1 (5 metrics) | DB-002, E2E-001, UNIT-001, UNIT-005, UNIT-009, UNIT-010 | Fully covered |
| #2 (Zero-state) | E2E-002, UNIT-004, DB-003 | Fully covered |
| #3 (Loading/SWR) | UNIT-002, UNIT-003, UNIT-007 | Fully covered |
| #4 (Security/RPC) | DB-001 (4 isolation assertions) | Fully covered |
| #5 (Styling/a11y) | UNIT-008, UNIT-011, UNIT-012 | Fully covered |

### Risk Coverage (from Test Design)

| Risk | Score | Test Coverage |
|---|---|---|
| E3-R01: SECURITY DEFINER data isolation | 6 | DB-001 (4 assertions: cross-couple isolation for sessions, bookmarks, ratings) |
| E3-R02: Aggregate accuracy | 4 | DB-002 (5 assertions: each metric verified against known seed data) |
| E3-R03: Zero-state rendering | 3 | E2E-002, UNIT-004, DB-003 |
| E3-R04: Loading state UX | 3 | UNIT-002, UNIT-003, UNIT-007 |
| E3-R05: Gamification language | 2 | UNIT-008 |
| E3-R06: Performance | 2 | PERF-001 (deferred to P3) |

---

## Next Steps (TDD Green Phase)

After implementing the feature:

1. **Database:** Create `scripture_get_couple_stats` SECURITY DEFINER RPC
   - Run `supabase test db` — 11 pgTAP assertions should pass
2. **Service:** Add `getCoupleStats()` to `scriptureReadingService`
   - Add `CoupleStatsSchema` to `supabaseSchemas.ts`
   - Remove `it.skip()` from service tests, run `npx vitest run tests/unit/services/scriptureReadingService.stats.test.ts`
3. **Store:** Add `coupleStats`, `isStatsLoading`, `loadCoupleStats` to `scriptureReadingSlice`
   - Remove `it.skip()` from slice tests, run `npx vitest run tests/unit/stores/scriptureReadingSlice.stats.test.ts`
4. **Component:** Create `StatsSection.tsx` in `src/components/scripture-reading/overview/`
   - Uncomment imports and test bodies in `StatsSection.test.tsx`
   - Remove `_` prefix from test data variables
   - Run `npx vitest run src/components/scripture-reading/__tests__/StatsSection.test.tsx`
5. **E2E:** Remove `test.skip(true, ...)` from `scripture-stats.spec.ts`
   - Run `npx playwright test tests/e2e/scripture/scripture-stats.spec.ts`
6. **Full regression:** `npm run test:unit` + `npm run test:e2e`

### Implementation Order (Bottom-Up)

```
DB Migration (RPC) → Service Method → Zod Schema → Slice State → Component → E2E
```

Each layer's tests can be unskipped as that layer is implemented.

---

## Validation (Step 5)

- [x] Prerequisites satisfied (story doc, test design, existing patterns loaded)
- [x] Test files created correctly (5 files on disk, non-empty)
- [x] Checklist matches all 5 acceptance criteria
- [x] Tests designed to fail before implementation (all skip, no placeholders)
- [x] No CLI sessions to clean up (no browsers launched)
- [x] Artifacts stored in `_bmad-output/test-artifacts/`
- [x] `tsc --noEmit` — zero errors
- [x] Full Vitest suite — 597 passed, 39 skipped, 0 failed
- [x] No regressions introduced

### Completion

**ATDD workflow complete.** All 19 test scenarios (52 assertions) are written as TDD RED phase tests across 5 files. Next recommended workflow: **implementation** (bottom-up: DB migration → service → schema → slice → component → E2E).
