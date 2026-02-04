# ATDD Checklist - Epic 2, Story 2.2: End-of-Session Reflection Summary

**Date:** 2026-02-04
**Author:** Sallvain
**Primary Test Level:** Component (12 tests) + E2E (3 tests) + API (2 tests) + Integration (2 tests)

---

## Story Summary

After completing all 17 scripture reading steps, the user reviews bookmarked verses and provides an overall session reflection before seeing the prayer report. The reflection summary includes standout verse selection, session rating, and optional notes.

**As a** user,
**I want** to review my bookmarked verses and provide an overall session reflection after completing all 17 steps,
**So that** I can process the experience as a whole before seeing the prayer report.

---

## Acceptance Criteria

1. **Transition to Reflection Summary After Step 17** — Screen displays bookmarked verses, no-bookmark fallback, fade-through-white transition, focus management
2. **Reflection Summary Form Interaction** — MoodButton-style verse chips (aria-pressed, 48x48px), session rating (1-5), optional note textarea (200 chars max)
3. **Reflection Summary Submission** — Verse selection + rating required (quiet validation), data saved to server, phase advances to 'report'

---

## Failing Tests Created (RED Phase)

### E2E Tests (3 tests)

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts` (appended)

- **Test:** 2.2-E2E-001 [P0] Reflection summary appears after step 17 with bookmarked verse chips
  - **Status:** RED - `test.skip()` — ReflectionSummary component not implemented
  - **Verifies:** AC #1 — Transition to reflection summary, bookmarked verse chips render

- **Test:** 2.2-E2E-002 [P1] Form interaction: verse selection, rating, note, validation
  - **Status:** RED - `test.skip()` — ReflectionSummary form not implemented
  - **Verifies:** AC #2 — Verse chip multi-select, rating radiogroup, note textarea, validation

- **Test:** 2.2-E2E-003 [P0] Submission saves reflection with stepIndex=17, advances phase to 'report'
  - **Status:** RED - `test.skip()` — Submission flow not implemented
  - **Verifies:** AC #3 — Data persistence via `scripture_submit_reflection` RPC, phase transition

### API Tests (2 tests)

**File:** `tests/api/scripture-reflection-api.spec.ts` (appended)

- **Test:** [P0] Session-level reflection persists with JSON standoutVerses via RPC (stepIndex=17)
  - **Status:** RED - `test.skip()` — No session-level reflection submission logic
  - **Verifies:** AC #3 — `scripture_submit_reflection` RPC with `p_step_index: 17`, JSON notes field

- **Test:** [P1] Session-level reflection (stepIndex 17) coexists with per-step reflections
  - **Status:** RED - `test.skip()` — No session-level reflection record yet
  - **Verifies:** AC #3 — Unique constraint `(session_id, step_index, user_id)` allows stepIndex 17

### Component Tests (12 tests)

**File:** `src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx` (new)

- **Test:** 2.2-CMP-001 — Renders bookmarked verses as selectable chips
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #1 — Verse chip rendering with step index and verse reference

- **Test:** 2.2-CMP-002 — Shows fallback message when no bookmarks exist
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #1 — "You didn't mark any verses — that's okay" fallback

- **Test:** 2.2-CMP-003 — Focus moves to reflection summary heading on mount
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #1 — Focus management, heading with tabindex=-1

- **Test:** 2.2-CMP-004 — Verse chip multi-select with aria-pressed toggling
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #2 — Multi-select toggle, aria-pressed attribute

- **Test:** 2.2-CMP-005 — Session rating with correct ARIA attributes
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #2 — Radiogroup, role=radio, aria-checked, aria-label

- **Test:** 2.2-CMP-006 — Optional note textarea with char counter at 150+
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #2 — Textarea, maxlength=200, char counter at 150+

- **Test:** 2.2-CMP-007 — Verse chips have minimum 48x48px touch target via CSS classes
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #2 — min-w-[48px] min-h-[48px] classes

- **Test:** 2.2-CMP-008 — Continue disabled until verse selected AND rating selected
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #3 — aria-disabled, opacity-50, cursor-not-allowed

- **Test:** 2.2-CMP-009 — Continue enabled with just rating when no bookmarks
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #3 — Waived verse requirement when bookmarks empty

- **Test:** 2.2-CMP-010 — Validation messages on premature Continue tap
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #3 — Quiet validation, muted style (not red)

- **Test:** 2.2-CMP-011 — onSubmit called with correct payload
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #3 — { standoutVerses: number[], rating: number, notes: string }

- **Test:** 2.2-CMP-014 — Arrow keys navigate within session rating radiogroup
  - **Status:** RED - `it.skip()` — ReflectionSummary module doesn't exist
  - **Verifies:** AC #2 — ArrowRight/ArrowLeft navigation with wrap

### Integration Tests (2 tests)

**File:** `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` (appended)

- **Test:** 2.2-CMP-012 — Shows ReflectionSummary when currentPhase: 'reflection'
  - **Status:** RED - `it.skip()` — ReflectionSummary not integrated into SoloReadingFlow
  - **Verifies:** AC #1 — Phase-based rendering of ReflectionSummary

- **Test:** 2.2-CMP-013 — Shows report placeholder when currentPhase: 'report'
  - **Status:** RED - `it.skip()` — Report phase placeholder not implemented
  - **Verifies:** AC #3 — Phase advance to 'report' renders placeholder

---

## Data Factories Created

No new data factories needed. Existing infrastructure supports Story 2.2:

- `createTestSession()` — `tests/support/factories/index.ts`
- `cleanupTestSession()` — `tests/support/factories/index.ts`

---

## Fixtures Created

No new fixtures needed. Existing Playwright fixtures cover all test needs:

- `supabaseAdmin` — `tests/support/fixtures/index.ts` (admin client for DB setup/teardown)
- `testSession` — `tests/support/fixtures/index.ts` (auto-cleanup test session)
- `mergedFixtures` — `tests/support/merged-fixtures.ts` (composed fixture set)

---

## Mock Requirements

No new mocks needed. E2E tests use real Supabase with admin cleanup. Component tests use vi.fn() callbacks.

---

## Required data-testid Attributes

### ReflectionSummary Component

- `scripture-reflection-summary-screen` — Root container div
- `scripture-reflection-summary-heading` — Section heading ("Your Session"), tabindex=-1
- `scripture-standout-verse-{stepIndex}` — Each bookmarked verse chip (e.g., `scripture-standout-verse-0`)
- `scripture-no-bookmarks-message` — Fallback text when no bookmarks
- `scripture-session-rating-group` — Rating radiogroup container
- `scripture-session-rating-{n}` — Rating buttons 1-5 (e.g., `scripture-session-rating-3`)
- `scripture-session-note` — Textarea for optional note
- `scripture-session-note-char-count` — Character counter (visible at 150+)
- `scripture-reflection-summary-continue` — Continue/submit button
- `scripture-reflection-summary-validation` — Validation messages container

### SoloReadingFlow Container

- `scripture-report-placeholder` — Story 2.3 placeholder screen (report phase)

---

## Implementation Checklist

### Test Group: ReflectionSummary Component (CMP-001 through CMP-011, CMP-014)

**File:** `src/components/scripture-reading/reflection/ReflectionSummary.tsx`

**Tasks to make these tests pass:**

- [ ] Create `ReflectionSummary.tsx` presentational component
- [ ] Props: `bookmarkedVerses: BookmarkedVerse[]`, `onSubmit: (data) => void`, `disabled: boolean`
- [ ] Render bookmarked verses as chips with `data-testid="scripture-standout-verse-{stepIndex}"`
- [ ] No-bookmark fallback: "You didn't mark any verses — that's okay"
- [ ] Focus heading on mount via `useRef` + `useEffect` + `requestAnimationFrame`
- [ ] Multi-select chip toggling with `aria-pressed`
- [ ] Session rating radiogroup (role="radiogroup", 5 radio buttons, arrow key nav)
- [ ] Textarea with max 200 chars, char counter at 150+
- [ ] Touch targets: `min-w-[48px] min-h-[48px]` on chips
- [ ] Continue button gating: `aria-disabled` until verse + rating (or just rating if no bookmarks)
- [ ] Quiet validation messages on premature Continue
- [ ] onSubmit payload: `{ standoutVerses: number[], rating: number, notes: string }`
- [ ] Run tests: `bunx vitest run src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx`

### Test Group: SoloReadingFlow Integration (CMP-012, CMP-013)

**File:** `src/components/scripture-reading/containers/SoloReadingFlow.tsx`

**Tasks to make these tests pass:**

- [ ] Replace completion placeholder with `<ReflectionSummary>` when `currentPhase === 'reflection'`
- [ ] Add report phase placeholder when `currentPhase === 'report'`
- [ ] Map `bookmarkedSteps` Set to `BookmarkedVerse[]` array via `SCRIPTURE_STEPS`
- [ ] Wire `onSubmit` to `addReflection()` + `updatePhase('report')`
- [ ] Run tests: `bunx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`

### Test Group: E2E (2.2-E2E-001 through 003)

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts`

**Tasks to make these tests pass:**

- [ ] All component implementation above must be complete
- [ ] Phase transition from step 17 reflection to reflection summary
- [ ] Supabase RPC `scripture_submit_reflection` accepts `stepIndex: 17`
- [ ] Run tests: `bunx playwright test tests/e2e/scripture/scripture-reflection.spec.ts`

### Test Group: API (2 tests)

**File:** `tests/api/scripture-reflection-api.spec.ts`

**Tasks to make these tests pass:**

- [ ] `scripture_submit_reflection` RPC handles `step_index: 17` with JSON notes
- [ ] Unique constraint allows per-step (0-16) and session-level (17) to coexist
- [ ] Run tests: `bunx playwright test tests/api/scripture-reflection-api.spec.ts`

---

## Running Tests

```bash
# Run all component tests for ReflectionSummary
bunx vitest run src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx --silent

# Run SoloReadingFlow integration tests
bunx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx --silent

# Run E2E tests
bunx playwright test tests/e2e/scripture/scripture-reflection.spec.ts

# Run API tests
bunx playwright test tests/api/scripture-reflection-api.spec.ts --project=api

# Run all Story 2.2 tests
bunx vitest run src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx --silent && bunx playwright test tests/e2e/scripture/scripture-reflection.spec.ts tests/api/scripture-reflection-api.spec.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 19 tests written and skipped (TDD RED phase)
- Existing fixtures and factories sufficient (no new infrastructure needed)
- data-testid requirements listed
- Implementation checklist created

**Verification:**

- All tests use `test.skip()` / `it.skip()` — will be skipped, not failed
- Tests assert expected behavior (no placeholder assertions)
- Tests will fail when skip is removed until implementation complete

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with component tests** (CMP-001 through CMP-014) — create `ReflectionSummary.tsx`
2. **Then integration tests** (CMP-012, CMP-013) — wire into `SoloReadingFlow`
3. **Then API tests** — verify RPC with stepIndex 17
4. **Finally E2E tests** — full flow validation
5. Remove `it.skip()` / `test.skip()` one group at a time
6. Implement minimal code to pass each group

---

### REFACTOR Phase (After All Tests Pass)

- Extract shared patterns between `PerStepReflection` and `ReflectionSummary` if warranted
- Verify accessibility checklist items
- Run full test suite to confirm no regressions

---

## Knowledge Base References Applied

- **component-tdd.md** — Component test strategies, TDD red-green cycle for React components
- **data-factories.md** — Factory patterns for test data (existing factories sufficient)
- **test-quality.md** — Test design principles (Given-When-Then, determinism, isolation)
- **selector-resilience.md** — data-testid selector strategy for stable tests
- **overview.md** — TEA framework overview and test level selection

See `testarch-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Status:** Pending — Step 5 will run tests to verify skip behavior

**Expected Results:**

- Component tests: 12 skipped (ReflectionSummary module doesn't exist)
- Integration tests: 2 skipped (ReflectionSummary not integrated)
- E2E tests: 3 skipped (full flow not implemented)
- API tests: 2 skipped (session-level reflection not implemented)
- Total: 19 skipped, 0 passing, 0 failing

---

## Notes

- Session-level reflection uses `stepIndex: MAX_STEPS` (17) sentinel to distinguish from per-step (0-16) reflections
- Standout verses stored as JSON in `notes` field: `{"standoutVerses": [0, 5, 12], "userNote": "..."}`
- Phase transition chain: `reading` → `reflection` (this story) → `report` (Story 2.3) → `complete` (Story 2.3)
- `status: 'complete'` is NOT set in this story — stays `'in_progress'` until Story 2.3
- Quiet validation pattern: muted purple text, no red, no aggressive indicators
- All animations respect `prefers-reduced-motion` via existing `crossfade` from `useMotionConfig`

---

**Generated by BMad TEA Agent** - 2026-02-04
