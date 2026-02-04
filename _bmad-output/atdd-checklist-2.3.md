# ATDD Checklist - Epic 2, Story 2.3: Daily Prayer Report — Send & View

**Date:** 2026-02-04
**Author:** Sallvain
**Primary Test Level:** Component + E2E

---

## Story Summary

Users can send a message to their partner and view the Daily Prayer Report showing reflections after completing a scripture reading session. Unlinked users skip the message step and see a simple completion screen.

**As a** user
**I want** to send a message to my partner and view the Daily Prayer Report showing our reflections
**So that** we can connect emotionally through shared vulnerability and encouragement

---

## Acceptance Criteria

1. **Message Composition Screen (Linked Users)** — Textarea with 300-char limit, Send/Skip buttons, keyboard handling
2. **Unlinked User — Skip Message Composition** — Skip compose step, mark session complete, show completion screen
3. **Daily Prayer Report Display (After Send/Skip)** — Step-by-step ratings, bookmarks, partner message in Dancing Script font, waiting state
4. **Asynchronous Report Viewing (Solo, Linked User)** — Partner can view report asynchronously after sender completes
5. **Together Mode Report Display** — Side-by-side ratings, both messages revealed, bookmark sharing respects opt-in

---

## Failing Tests Created (RED Phase)

### E2E Tests (4 tests)

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts` (1121 lines)

- **Test:** `2.3-E2E-001 [P0]: Linked user completes message compose and sees Daily Prayer Report`
  - **Status:** RED — `test.skip()`, Story 2.3 components not implemented
  - **Verifies:** AC #1, #3 — Full flow: reflection summary → message compose → send → report display

- **Test:** `2.3-E2E-002 [P0]: Unlinked user skips message compose and sees completion screen`
  - **Status:** RED — `test.skip()`, Story 2.3 components not implemented
  - **Verifies:** AC #2 — Unlinked user flow: reflection summary → skip compose → completion screen

- **Test:** `2.3-E2E-003 [P1]: Partner message in Dancing Script font`
  - **Status:** RED — `test.skip()`, Story 2.3 components not implemented
  - **Verifies:** AC #3 — Partner message card visible with `font-cursive` class

- **Test:** `2.3-E2E-003 [P1]: Waiting state when partner has not completed`
  - **Status:** RED — `test.skip()`, Story 2.3 components not implemented
  - **Verifies:** AC #3 — Waiting text visible when partner session incomplete

### API Tests (2 tests)

**File:** `tests/api/scripture-reflection-api.spec.ts` (703 lines)

- **Test:** `2.3-API-001: Message write persists to scripture_messages table`
  - **Status:** RED — `test.skip()`, `scripture_messages` table / RLS not implemented
  - **Verifies:** AC #1 — Message insert with RLS, sender_id matches authenticated user

- **Test:** `2.3-API-002: Session completion sets status='complete' and completed_at`
  - **Status:** RED — `test.skip()`, completion logic not implemented
  - **Verifies:** AC #2, #3 — Session status update and timestamp after send/skip

### Component Tests — MessageCompose (9 tests)

**File:** `src/components/scripture-reading/__tests__/MessageCompose.test.tsx` (160 lines)

- **Test:** `renders partner name in heading`
  - **Status:** RED — import fails, `MessageCompose.tsx` does not exist
  - **Verifies:** AC #1 — Heading shows "Write something for [Partner Name]"

- **Test:** `textarea accepts input up to 300 chars`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — 300-char maxLength on textarea

- **Test:** `character counter visible at 250+ chars`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — Counter appears at threshold

- **Test:** `character counter hidden below 250 chars`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — Counter hidden when below threshold

- **Test:** `Send button calls onSend with message text`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — Send callback with message content

- **Test:** `Skip button calls onSkip`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — Skip callback fires

- **Test:** `Send and Skip disabled when disabled prop is true`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — Double-submission prevention

- **Test:** `textarea has correct aria-label`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — Accessibility: "Message to partner" label

- **Test:** `focus moves to textarea on mount`
  - **Status:** RED — import fails
  - **Verifies:** AC #1 — Auto-focus for keyboard accessibility

### Component Tests — DailyPrayerReport (8 tests)

**File:** `src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx` (173 lines)

- **Test:** `renders user step-by-step ratings for all 17 steps`
  - **Status:** RED — import fails, `DailyPrayerReport.tsx` does not exist
  - **Verifies:** AC #3 — All 17 rating steps displayed

- **Test:** `renders bookmarked verses with amber indicator`
  - **Status:** RED — import fails
  - **Verifies:** AC #3 — Bookmark indicators on bookmarked steps

- **Test:** `renders standout verse selections`
  - **Status:** RED — import fails
  - **Verifies:** AC #3 — Standout verses section displays selections

- **Test:** `reveals partner message in Dancing Script font`
  - **Status:** RED — import fails
  - **Verifies:** AC #3 — Partner message card with `font-cursive` class

- **Test:** `shows waiting text when partner incomplete`
  - **Status:** RED — import fails
  - **Verifies:** AC #3 — "Waiting for [Partner Name]'s reflections"

- **Test:** `does not render message section when no partner message and partner complete`
  - **Status:** RED — import fails
  - **Verifies:** AC #3 — No message section when partner has no message

- **Test:** `Return to Overview button calls onReturn`
  - **Status:** RED — import fails
  - **Verifies:** AC #3 — Return callback fires

- **Test:** `report heading has tabIndex -1 for programmatic focus`
  - **Status:** RED — import fails
  - **Verifies:** AC #3 — Accessibility: programmatic focus on heading

### Integration Tests — SoloReadingFlow (7 tests)

**File:** `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` (1272 lines)

- **Test:** `shows MessageCompose when phase is report and partner exists (2.3-INT-002)`
  - **Status:** RED — `it.skip()`, integration not wired
  - **Verifies:** AC #1 — Linked user sees MessageCompose in report phase

- **Test:** `shows unlinked completion screen when phase is report and no partner (2.3-INT-001)`
  - **Status:** RED — `it.skip()`, integration not wired
  - **Verifies:** AC #2 — Unlinked user sees completion screen

- **Test:** `sending message calls addMessage service (2.3-INT-003)`
  - **Status:** RED — `it.skip()`, service not wired
  - **Verifies:** AC #1 — Service layer integration for message send

- **Test:** `skipping message still marks session complete (2.3-INT-004)`
  - **Status:** RED — `it.skip()`, skip flow not wired
  - **Verifies:** AC #1, #2 — Session completion on skip

- **Test:** `DailyPrayerReport appears after send/skip (2.3-INT-005)`
  - **Status:** RED — `it.skip()`, phase transition not wired
  - **Verifies:** AC #3 — Report screen appears after compose phase

- **Test:** `session marked complete after report phase entry for unlinked user (2.3-INT-006)`
  - **Status:** RED — `it.skip()`, unlinked flow not wired
  - **Verifies:** AC #2 — Auto-complete for unlinked users

- **Test:** `Return to Overview calls exitSession (2.3-INT-007)`
  - **Status:** RED — `it.skip()`, return flow not wired
  - **Verifies:** AC #3 — Exit session on return

---

## Data Factories Created

No new data factories required for RED phase. Existing `createTestSession` RPC handles session seeding.

**Fixture Gaps Identified (for GREEN phase):**
- Unlinked user seed preset (`p_preset='unlinked'`) — needed for E2E-002
- Pre-seeded partner message (`p_include_messages=true`) — needed for E2E-003

---

## Fixtures Created

No new fixture files created. Tests use existing infrastructure:
- **E2E/API:** `tests/support/merged-fixtures.ts` (Playwright fixtures with `supabaseAdmin`, `testSession`)
- **Component:** Vitest + `@testing-library/react` with manual mocks (Zustand store, services)

---

## Mock Requirements

### Scripture Reading Service (Vitest mocks)

**Method:** `addMessage(sessionId, senderId, message)` — Persist message to `scripture_messages`
- Mocked in SoloReadingFlow integration tests
- Real implementation needed for GREEN phase

### Supabase RPC (E2E/API)

**Endpoint:** `scripture_messages` table insert via Supabase client
- Tests use `supabaseAdmin` to verify data persistence
- RLS policy required: sender can insert for their own sessions

---

## Required data-testid Attributes

### MessageCompose Component

- `scripture-message-compose-screen` — Container for entire compose screen
- `scripture-message-compose-heading` — "Write something for [Partner Name]" heading
- `scripture-message-textarea` — Message input textarea
- `scripture-message-char-count` — Character counter (visible at 250+ chars)
- `scripture-message-send-btn` — Send button
- `scripture-message-skip-btn` — Skip button

### DailyPrayerReport Component

- `scripture-report-screen` — Container for entire report screen
- `scripture-report-heading` — Report heading (with `tabIndex={-1}`)
- `scripture-report-rating-step-{N}` — Individual step rating (N = 0..16)
- `scripture-report-bookmark-indicator-{N}` — Bookmark indicator for step N
- `scripture-report-standout-verses` — Standout verses section
- `scripture-report-partner-message` — Partner message card (Dancing Script font)
- `scripture-report-partner-waiting` — "Waiting for [Partner Name]'s reflections"
- `scripture-report-user-ratings` — User ratings section
- `scripture-report-return-btn` — "Return to Overview" button

### UnlinkedCompletionScreen (inline in SoloReadingFlow)

- `scripture-unlinked-complete-screen` — Container for completion screen
- `scripture-unlinked-complete-heading` — "Session complete" heading
- `scripture-unlinked-return-btn` — "Return to Overview" button

---

## Implementation Checklist

### Test: MessageCompose Component Tests (9 tests)

**File:** `src/components/scripture-reading/__tests__/MessageCompose.test.tsx`

**Tasks to make these tests pass:**

- [ ] Create `src/components/scripture-reading/reflection/MessageCompose.tsx`
- [ ] Implement props: `partnerName`, `onSend`, `onSkip`, `disabled`
- [ ] Textarea with `maxLength={300}`, auto-grow, `aria-label="Message to partner"`
- [ ] Character counter visible at 250+ chars
- [ ] Send button calls `onSend(message)`, Skip button calls `onSkip()`
- [ ] `disabled` prop gates both buttons
- [ ] Auto-focus textarea on mount
- [ ] Add all `data-testid` attributes from list above
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/MessageCompose.test.tsx`

---

### Test: DailyPrayerReport Component Tests (8 tests)

**File:** `src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx`

**Tasks to make these tests pass:**

- [ ] Create `src/components/scripture-reading/reflection/DailyPrayerReport.tsx`
- [ ] Implement props: `userRatings`, `userBookmarks`, `userStandoutVerses`, `partnerMessage`, `partnerName`, `isPartnerComplete`, `onReturn`
- [ ] Render 17 step ratings with bookmark indicators
- [ ] Standout verses section
- [ ] Partner message card with `font-cursive` class (Dancing Script)
- [ ] "Waiting for [Partner Name]'s reflections" when partner incomplete
- [ ] "Return to Overview" button calls `onReturn()`
- [ ] `tabIndex={-1}` on heading for programmatic focus
- [ ] Add all `data-testid` attributes from list above
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx`

---

### Test: SoloReadingFlow Integration Tests (7 tests)

**File:** `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`

**Tasks to make these tests pass:**

- [ ] Wire MessageCompose into SoloReadingFlow report phase (when partner exists)
- [ ] Wire UnlinkedCompletionScreen into SoloReadingFlow report phase (when no partner)
- [ ] Implement `addMessage` service method and wire to Send button
- [ ] Implement skip flow that marks session complete
- [ ] Transition from compose → DailyPrayerReport after send/skip
- [ ] Auto-complete session for unlinked users on report phase entry
- [ ] Wire "Return to Overview" to `exitSession`
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`

---

### Test: E2E Tests (4 tests)

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts`

**Tasks to make these tests pass:**

- [ ] All component implementation tasks above (MessageCompose, DailyPrayerReport, SoloReadingFlow wiring)
- [ ] Create `scripture_messages` Supabase table with RLS policies
- [ ] Implement session completion logic (`status='complete'`, `completed_at` timestamp)
- [ ] Add seed preset for unlinked users (E2E-002)
- [ ] Add seed preset for pre-seeded partner messages (E2E-003)
- [ ] Run test: `npx playwright test --grep "2.3-E2E"`

---

### Test: API Tests (2 tests)

**File:** `tests/api/scripture-reflection-api.spec.ts`

**Tasks to make these tests pass:**

- [ ] Create `scripture_messages` Supabase table
- [ ] Add RLS policies: sender can insert for their own sessions
- [ ] Implement session completion update logic
- [ ] Run test: `npx playwright test --project=api --grep "2.3-API"`

---

## Running Tests

```bash
# Run all failing tests for this story (component + integration)
npx vitest run --reporter=dot --grep "2.3"

# Run specific component test files
npx vitest run src/components/scripture-reading/__tests__/MessageCompose.test.tsx --reporter=dot
npx vitest run src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx --reporter=dot

# Run integration tests
npx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx --reporter=dot

# Run E2E tests for Story 2.3
npx playwright test --grep "2.3-E2E"

# Run E2E in headed mode (see browser)
npx playwright test --grep "2.3-E2E" --headed

# Run API tests for Story 2.3
npx playwright test --project=api --grep "2.3-API"

# Debug specific E2E test
npx playwright test --grep "2.3-E2E-001" --debug
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 30 tests written and failing (skip markers / import failures)
- Test infrastructure reuses existing fixtures and factories
- Mock requirements documented
- data-testid requirements listed
- Implementation checklist created

**Verification:**

- E2E: 4 tests with `test.skip()` — Playwright lists them correctly
- API: 2 tests with `test.skip()` — Playwright lists them correctly
- Component: 17 tests with `it.skip()` — Import failures (expected, component files don't exist)
- Integration: 7 tests with `it.skip()` — Vitest shows them as skipped
- No placeholder assertions (`expect(true).toBe(true)`) in any Story 2.3 test

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with component tests)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Recommended order:**
1. MessageCompose component tests (9 tests) — standalone presentational component
2. DailyPrayerReport component tests (8 tests) — standalone presentational component
3. SoloReadingFlow integration tests (7 tests) — wiring components into flow
4. API tests (2 tests) — database schema + RLS
5. E2E tests (4 tests) — full integration verification

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all 30 tests pass
2. Review code for DRY, accessibility, performance
3. Ensure Dancing Script font is loaded (Google Fonts or local)
4. Verify keyboard handling on mobile
5. Run full test suite to confirm no regressions

---

## Next Steps

1. **Review this checklist** with team
2. **Run failing tests** to confirm RED phase: `npx vitest run --reporter=dot --grep "2.3"` and `npx playwright test --grep "2.3"`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

- **data-factories.md** — Factory patterns with overrides, API seeding via RPC
- **test-quality.md** — Deterministic, isolated, explicit, focused, fast tests; no hard waits; Given-When-Then
- **selector-resilience.md** — data-testid as primary selector strategy
- **test-levels-framework.md** — Test level selection (E2E for critical paths, component for UI logic, API for persistence)

See `testarch-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Component/Integration Tests:**

```
SoloReadingFlow.test.tsx: 94 passed | 7 skipped (101)
MessageCompose.test.tsx: 1 failed (import error — component not created)
DailyPrayerReport.test.tsx: 1 failed (import error — component not created)
```

**E2E Tests (Playwright --list):**

```
[chromium] scripture-reflection.spec.ts:887 › 2.3-E2E-001: Linked user message compose + report
[chromium] scripture-reflection.spec.ts:987 › 2.3-E2E-002: Unlinked user skip + completion
[chromium] scripture-reflection.spec.ts:1039 › 2.3-E2E-003: Partner message Dancing Script
[chromium] scripture-reflection.spec.ts:1084 › 2.3-E2E-003: Waiting state
Total: 4 tests listed (all test.skip)
```

**Summary:**

- Total tests: 30
- Passing: 0 Story 2.3 tests pass (expected)
- Skipped/Failing: 30 (expected)
- Status: RED phase verified

---

## Notes

- E2E-002 requires an unlinked-user seed preset that doesn't exist yet. Test documents the fixture gap with a `// NOTE:` comment. The `scripture_seed_test_data` RPC needs a `p_preset='unlinked'` parameter.
- E2E-003 requires pre-seeded partner messages. Test documents this gap and inserts directly via `supabaseAdmin` as a workaround.
- MessageCompose and DailyPrayerReport test files fail at import resolution (component files don't exist), which is the correct RED phase behavior — they will pass once the components are created.
- The SoloReadingFlow integration tests use existing mock infrastructure (`mockUpdateSession`, `mockExitSession`) and add `mockPartner` + `mockAddMessage` for Story 2.3.
- TypeScript diagnostic warnings exist for `toHaveTextContent` / `toHaveValue` / `toBeDisabled` in new test files — these resolve once `@testing-library/jest-dom` matchers are properly typed (existing tests have the same pattern).

---

**Generated by BMad TEA Agent** — 2026-02-04
