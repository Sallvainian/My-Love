# ATDD Checklist - Epic 1: Foundation & Solo Scripture Reading

**Date:** 2026-01-30
**Author:** Salvain
**Primary Test Level:** E2E + API
**Total Tests Generated:** ~49 (10 API + 27 E2E + 9 pre-existing unit + 3 new unit)

---

## Story Summary

Users can access Scripture Reading from bottom navigation, start a Solo session, read through all 17 scripture steps at their own pace, save and resume progress, and experience smooth optimistic UI. The feature is fully accessible with keyboard navigation, screen reader support, and reduced motion compliance.

**As a** user (and developer for Story 1.1)
**I want** a foundational backend, navigation, solo reading flow, save/resume with optimistic UI, and full accessibility
**So that** I can engage with scripture in a calm, self-paced, accessible experience

---

## Acceptance Criteria

### Story 1.1: Database Schema & Backend Infrastructure
1. Supabase tables exist with correct schemas (scripture_sessions, scripture_step_states, scripture_reflections, scripture_bookmarks, scripture_messages)
2. RLS policies enforce session-based access (only session participants can read/write)
3. RPCs exist: scripture_create_session, scripture_submit_reflection, scripture_lock_in, scripture_advance_phase
4. Unique constraint on scripture_reflections (session_id, step_index, user_id)
5. Centralized dbSchema.ts with DB_VERSION=5 and all store definitions
6. scriptureReadingService.ts provides IndexedDB CRUD with cache-first read, write-through, corruption recovery
7. scriptureReadingSlice.ts provides Zustand state management for session lifecycle
8. Static scripture data: 17 steps with verse text, response text, section themes, verse references

### Story 1.2: Navigation & Overview Page
9. Scripture tab appears in bottom navigation
10. Overview page displays with Lavender Dreams theme
11. "Start" button begins new session with mode selection
12. Solo mode always available; Together mode disabled when no partner
13. Resume prompt for incomplete sessions: "Continue where you left off? (Step X of 17)"

### Story 1.3: Solo Reading Flow
14. New session created with mode='solo', status='in_progress', current_step_index=0
15. Verse screen displays reference, text, "View Response" button, "Next Verse" button, progress indicator
16. Response screen shows response text with "Back to Verse" and "Next Verse" buttons
17. Step advancement increments index with slide-left + fade transition
18. Step 17 transitions to reflection phase
19. Exit button shows confirmation with "Save & Exit"

### Story 1.4: Save, Resume & Optimistic UI
20. Exit mid-session persists step index to server and caches in IndexedDB
21. Resume loads from cache immediately, then fetches fresh from server
22. Step advancement appears instant (optimistic UI) with background server update
23. Offline shows indicator and blocks step advancement
24. IndexedDB corruption triggers transparent recovery (clear + refetch)
25. Server write failure shows retry UI, local state preserved

### Story 1.5: Accessibility Foundations
26. All interactive elements reachable via Tab in logical order
27. Buttons have descriptive aria-labels
28. Progress indicator has aria-label "Currently on verse X of 17"
29. Phase transitions announced via aria-live="polite"
30. Focus management after transitions (verse heading, nav button, etc.)
31. prefers-reduced-motion replaces animations with instant swaps
32. WCAG AA contrast ratios met; touch targets minimum 48x48px with 8px spacing

---

## Failing Tests Created (RED Phase)

### 1. API Tests: RLS Security (`tests/e2e/scripture/scripture-rls-security.spec.ts`)

| # | Test Name | Priority | AC | Status | Failure Reason |
|---|-----------|----------|-----|--------|----------------|
| 1 | P0-001: SELECT scripture_sessions - member access | P0 | 2 | RED | RLS policies not yet created |
| 2 | P0-001: SELECT scripture_sessions - non-member blocked | P0 | 2 | RED | RLS policies not yet created |
| 3 | P0-002: SELECT scripture_reflections - member access | P0 | 2 | RED | Table/RLS not yet created |
| 4 | P0-002: SELECT scripture_reflections - non-member blocked | P0 | 2 | RED | Table/RLS not yet created |
| 5 | P0-003: INSERT scripture_reflections - non-member rejected | P0 | 2 | RED | RLS INSERT policy not yet created |
| 6 | P0-003: INSERT scripture_bookmarks - non-member rejected | P0 | 2 | RED | RLS INSERT policy not yet created |
| 7 | P0-004: user_id = auth.uid() enforced on INSERT | P0 | 2 | RED | CHECK constraint not yet created |
| 8 | P0-005: is_shared visibility - unshared hidden from partner | P0 | 2 | RED | RLS visibility policy not yet created |
| 9 | P0-008: Solo session creation via RPC | P0 | 3,14 | RED | RPC scripture_create_session not yet created |
| 10 | P0-012: Idempotent reflection write (upsert) | P0 | 4 | RED | RPC scripture_submit_reflection not yet created |

**Risk Coverage:** R-001 (RLS policy bypass, Score: 6) - fully covered

### 2. E2E Tests: Solo Reading Flow (`tests/e2e/scripture/scripture-solo-reading.spec.ts`)

| # | Test Name | Priority | AC | Status | Failure Reason |
|---|-----------|----------|-----|--------|----------------|
| 1 | P0-009: Complete full 17-step solo reading flow | P0 | 14-18 | RED | UI components not yet built |
| 2 | Verse screen displays correct elements | P1 | 15 | RED | UI components not yet built |
| 3 | Navigate to response screen and back | P1 | 16 | RED | Response screen not yet built |
| 4 | Advance from response screen via Next Verse | P1 | 16,17 | RED | Navigation logic not yet implemented |
| 5 | P1-001: Optimistic step advance | P1 | 22 | RED | Optimistic UI not yet implemented |
| 6 | P1-012: Progress indicator updates | P1 | 15 | RED | Progress component not yet built |
| 7 | P2-012: Session completion boundary (step 17 → reflection) | P2 | 18 | RED | Completion logic not yet implemented |

### 3. E2E Tests: Navigation & Overview (`tests/e2e/scripture/scripture-overview.spec.ts`)

| # | Test Name | Priority | AC | Status | Failure Reason |
|---|-----------|----------|-----|--------|----------------|
| 1 | Scripture tab in bottom navigation | P1 | 9 | RED | Nav tab not yet added |
| 2 | Navigate to scripture overview | P1 | 9,10 | RED | Route/page not yet created |
| 3 | Display overview with Start button | P1 | 11 | RED | Overview page not yet built |
| 4 | Show mode selection after tapping Start | P1 | 11 | RED | Mode selection not yet built |
| 5 | P1-006: No partner disables Together mode | P1 | 12 | RED | Partner check logic not yet implemented |
| 6 | P1-007: Partner enables both modes | P1 | 12 | RED | Partner integration not yet built |
| 7 | P1-008: Resume prompt with correct step number | P1 | 13 | RED | Resume prompt not yet built |
| 8 | P1-009: Start fresh clears saved state | P1 | 13 | RED | Fresh start logic not yet implemented |

### 4. E2E Tests: Save, Resume & Exit (`tests/e2e/scripture/scripture-session.spec.ts`)

| # | Test Name | Priority | AC | Status | Failure Reason |
|---|-----------|----------|-----|--------|----------------|
| 1 | P0-010: Session save on exit | P0 | 19,20 | RED | Exit flow not yet built |
| 2 | P0-011: Session resume at correct step | P0 | 21 | RED | Resume logic not yet implemented |
| 3 | P2-011: Exit confirmation dialog with save option | P2 | 19 | RED | Dialog component not yet built |
| 4 | Dismiss exit dialog on cancel | P2 | 19 | RED | Dialog component not yet built |
| 5 | P1-005: Server write failure shows retry UI | P1 | 25 | RED | Retry UI not yet implemented |
| 6 | P2-009: Offline indicator when offline | P2 | 23 | RED | Offline detection not yet built |
| 7 | P2-010: Step advancement blocked when offline | P2 | 23 | RED | Offline guard not yet implemented |

### 5. E2E Tests: Accessibility (`tests/e2e/scripture/scripture-accessibility.spec.ts`)

| # | Test Name | Priority | AC | Status | Failure Reason |
|---|-----------|----------|-----|--------|----------------|
| 1 | P2-001: Tab reaches all interactive elements | P2 | 26 | RED | UI components not yet built |
| 2 | Buttons activate with Enter and Space | P2 | 26 | RED | UI components not yet built |
| 3 | No keyboard traps | P2 | 26 | RED | UI components not yet built |
| 4 | P2-002: Descriptive aria-labels on buttons | P2 | 27 | RED | aria-labels not yet added |
| 5 | P2-002: aria-label on progress indicator | P2 | 28 | RED | Progress component not yet built |
| 6 | P2-003: aria-live region for verse transitions | P2 | 29 | RED | Live region not yet implemented |
| 7 | P2-004: Announcements only on semantic state changes | P2 | 29 | RED | Announcement logic not yet built |
| 8 | P2-005: Focus verse heading after step navigation | P2 | 30 | RED | Focus management not yet implemented |
| 9 | P2-006: Focus nav button after response transition | P2 | 30 | RED | Focus management not yet implemented |
| 10 | P2-008: Buttons have 48x48px touch targets | P2 | 32 | RED | Button sizing not yet implemented |
| 11 | P2-008: 8px spacing between touch targets | P2 | 32 | RED | Button spacing not yet implemented |
| 12 | P2-014: WCAG AA automated audit via axe-core | P2 | 32 | RED | UI components not yet built |

### 6. Unit Tests: useMotionConfig Hook (`tests/unit/hooks/useMotionConfig.test.ts`)

| # | Test Name | Priority | AC | Status | Failure Reason |
|---|-----------|----------|-----|--------|----------------|
| 1 | P2-007: Full durations when reduced motion NOT preferred | P2 | 31 | RED | Hook not yet implemented |
| 2 | P2-007: Zero durations when reduced motion IS preferred | P2 | 31 | RED | Hook not yet implemented |
| 3 | Export getMotionConfig for non-hook usage | P2 | 31 | RED | Module not yet created |

### 7. Pre-Existing Unit Tests (GREEN - Story 1.1)

These tests were already passing before this ATDD cycle:

| File | Tests | Status |
|------|-------|--------|
| `tests/unit/services/scriptureReadingService.test.ts` | 11 tests (IndexedDB CRUD, corruption recovery) | GREEN |
| `tests/unit/stores/scriptureReadingSlice.test.ts` | 13 tests (Zustand state transitions) | GREEN |
| `tests/unit/data/scriptureSteps.test.ts` | 7 tests (17 steps, sections, refs) | GREEN |

---

## Data Factories Created

### Existing: `tests/support/factories/index.ts`

| Factory | Description | Used By |
|---------|-------------|---------|
| `createTestSession(supabaseAdmin, options?)` | Seeds test data via `scripture_seed_test_data` RPC. Options: `preset` ('default', 'mid_session'), `includeReflections`. Returns `SeedResult` with `session_ids`, `test_user1_id`, `test_user2_id` | RLS security tests, session tests |
| `cleanupTestSession(supabaseAdmin, sessionIds)` | Deletes in FK order: messages → reflections → bookmarks → step_states → sessions | All API tests |

### Factory Types

```typescript
export type SeedPreset = 'default' | 'mid_session';
export interface SeedResult {
  session_ids: string[];
  test_user1_id: string;
  test_user2_id: string | null;
}
```

### RLS Test Helper (Inline)

```typescript
// Located in scripture-rls-security.spec.ts
async function createUserClient(supabaseAdmin, userId: string)
// Creates Supabase client authenticated as specific user via signInWithPassword
// Uses test-password-123 (known from seed data)
```

**No new factories needed.** Existing infrastructure covers all test scenarios.

---

## Fixtures Created

### Existing: `tests/support/fixtures/index.ts`

| Fixture | Scope | Description |
|---------|-------|-------------|
| `supabaseAdmin` | test | Supabase client with service role key for admin operations (seeding, cleanup, RLS bypass) |
| `testSession` | test | Pre-seeded session via `createTestSession()` with automatic cleanup in `afterEach` |

### Existing: `tests/support/merged-fixtures.ts`

```typescript
export const test = mergeTests(
  apiRequestFixture,    // Playwright API request context
  recurseFixture,       // Retry/recurse helper
  logFixture,           // Test logging
  networkMonitorFixture, // Network request monitoring
  customFixtures,       // supabaseAdmin + testSession
);
export { expect } from '@playwright/test';
```

### Existing: `tests/support/helpers/index.ts`

| Helper | Description |
|--------|-------------|
| `waitFor(condition, options?)` | Poll-based waiting with configurable timeout/interval |
| `generateTestEmail()` | Generates unique test email addresses |
| `formatTestDate(date)` | Formats dates for test assertions |

**No new fixtures needed.** Existing infrastructure supports all test scenarios.

---

## Mock Requirements

### E2E Network Mocks (Playwright Route Interception)

| Mock | Used In | Purpose |
|------|---------|---------|
| `**/rest/v1/rpc/scripture_advance_phase` → 500 | P1-005 (scripture-session.spec.ts) | Simulate server write failure on step advancement |
| `**/rest/v1/scripture_sessions*` PATCH → 500 | P1-005 (scripture-session.spec.ts) | Simulate server write failure on session update |
| `page.context().setOffline(true)` | P2-009, P2-010 (scripture-session.spec.ts) | Simulate offline state |

### Unit Test Mocks (Vitest)

| Mock | Used In | Purpose |
|------|---------|---------|
| `window.matchMedia` | P2-007 (useMotionConfig.test.ts) | Mock `prefers-reduced-motion` media query |
| `fake-indexeddb` | Existing unit tests | Mock IndexedDB for service tests |

**Pattern Applied:** Network-first route interception (from `timing-debugging.md` knowledge base) — routes are set up before triggering the action that causes the network call.

---

## Required data-testid Attributes

All `data-testid` attributes referenced by generated tests, organized by component area:

### Navigation (1)
| data-testid | Component | Tests |
|-------------|-----------|-------|
| `nav-scripture` | BottomNavigation | overview:1,2 |

### Overview & Mode Selection (7)
| data-testid | Component | Tests |
|-------------|-----------|-------|
| `scripture-overview` | ScriptureOverviewPage | overview:2,3; session:1,2 |
| `scripture-start-button` | ScriptureOverviewPage | overview:3,4,5,6,7,8; solo:all; session:all; accessibility:all |
| `scripture-mode-select` | ModeSelectionModal | overview:4,8 |
| `scripture-mode-solo` | ModeSelectionModal | overview:4,5,6,8; solo:all; session:all; accessibility:all |
| `scripture-mode-together` | ModeSelectionModal | overview:4,5,6 |
| `scripture-together-disabled-message` | ModeSelectionModal | overview:5 |
| `scripture-partner-link` | ModeSelectionModal | overview:5 |

### Resume Prompt (4)
| data-testid | Component | Tests |
|-------------|-----------|-------|
| `scripture-resume-prompt` | ResumePrompt | overview:7; session:2 |
| `scripture-resume-step` | ResumePrompt | overview:7 |
| `scripture-resume-continue` | ResumePrompt | overview:7; session:2 |
| `scripture-start-fresh` | ResumePrompt | overview:8 |

### Reading Flow (6)
| data-testid | Component | Tests |
|-------------|-----------|-------|
| `scripture-reading-container` | ScriptureReadingScreen | accessibility:12 |
| `scripture-verse-reference` | VerseDisplay | solo:1,2; accessibility:8 |
| `scripture-verse-text` | VerseDisplay | solo:1,2,3,4; session:4 |
| `scripture-response-text` | ResponseDisplay | solo:3,4; accessibility:2 |
| `scripture-progress-indicator` | ProgressIndicator | solo:1,2,5,6,7; session:1,2,5,7; accessibility:5 |
| `scripture-completion-screen` | CompletionScreen | solo:1,7 |

### Action Buttons (4)
| data-testid | Component | Tests |
|-------------|-----------|-------|
| `scripture-next-verse-button` | ReadingControls | solo:all; session:5,7; accessibility:1,2,3,6,7,8,10,11 |
| `scripture-view-response-button` | ReadingControls | solo:2,3,4; accessibility:1,2,4,7,9 |
| `scripture-back-to-verse-button` | ReadingControls | solo:3; accessibility:2,9 |
| `scripture-exit-button` | ReadingControls | session:1,2,3,4; accessibility:1,4,10 |

### Exit Dialog (3)
| data-testid | Component | Tests |
|-------------|-----------|-------|
| `scripture-exit-dialog` | ExitConfirmationDialog | session:1,3,4 |
| `scripture-save-exit-button` | ExitConfirmationDialog | session:1,2,3 |
| `scripture-cancel-exit-button` | ExitConfirmationDialog | session:3,4 |

### Status Indicators (3)
| data-testid | Component | Tests |
|-------------|-----------|-------|
| `scripture-retry-indicator` | RetryIndicator | session:5 |
| `scripture-offline-indicator` | OfflineIndicator | session:6 |
| `scripture-live-region` | LiveAnnouncer | accessibility:6,7 |

**Total: 28 unique data-testid attributes**

---

## Implementation Checklist

### Phase 1: Backend (Story 1.1) — Make RLS Tests Pass

> Pre-req: Story 1.1 unit tests are already GREEN

- [x] **1.1.1** Create Supabase migration with RLS SELECT policy on `scripture_sessions` (member-only access)
  - Tests: P0-001 (2 tests) — GREEN ✅
- [x] **1.1.2** Create RLS SELECT policy on `scripture_reflections` (member-only access)
  - Tests: P0-002 (2 tests) — GREEN ✅ (seed bug fixed)
- [x] **1.1.3** Create RLS INSERT policies on `scripture_reflections` and `scripture_bookmarks` (member-only)
  - Tests: P0-003 (2 tests) — GREEN ✅
- [x] **1.1.4** Add CHECK constraint or RLS policy enforcing `user_id = auth.uid()` on INSERT
  - Tests: P0-004 (1 test) — GREEN ✅
- [x] **1.1.5** Create RLS policy for `is_shared` visibility (hide unshared reflections from partner)
  - Tests: P0-005 (1 test) — GREEN ✅
- [x] **1.1.6** Create `scripture_create_session` RPC returning session with mode, status, step_index, phase
  - Tests: P0-008 (1 test) — GREEN ✅
- [x] **1.1.7** Create `scripture_submit_reflection` RPC with UPSERT on (session_id, step_index, user_id)
  - Tests: P0-012 (1 test) — GREEN ✅

### Phase 2: Navigation & Overview (Story 1.2) — Make Overview Tests Pass

- [ ] **1.2.1** Add Scripture tab to bottom navigation with `data-testid="nav-scripture"`
  - Tests: overview:1,2
- [ ] **1.2.2** Create `/scripture` route and ScriptureOverviewPage component with `data-testid="scripture-overview"`
  - Tests: overview:2,3
- [ ] **1.2.3** Add Start button with `data-testid="scripture-start-button"` that opens mode selection
  - Tests: overview:3,4
- [ ] **1.2.4** Build ModeSelectionModal with Solo/Together options and partner-check logic
  - Tests: overview:4,5,6 (P1-006, P1-007)
- [ ] **1.2.5** Build ResumePrompt component with step display, Continue, and Start Fresh buttons
  - Tests: overview:7,8 (P1-008, P1-009)

### Phase 3: Solo Reading Flow (Story 1.3) — Make Solo Reading Tests Pass

- [ ] **1.3.1** Build ScriptureReadingScreen container with `data-testid="scripture-reading-container"`
  - Tests: solo:1, accessibility:12
- [ ] **1.3.2** Build VerseDisplay component (`scripture-verse-reference`, `scripture-verse-text`)
  - Tests: solo:1,2,3
- [ ] **1.3.3** Build ResponseDisplay component (`scripture-response-text`)
  - Tests: solo:3,4
- [ ] **1.3.4** Build ReadingControls with Next Verse, View Response, Back to Verse buttons
  - Tests: solo:1-4
- [ ] **1.3.5** Build ProgressIndicator showing "Verse X of 17" with `data-testid="scripture-progress-indicator"`
  - Tests: solo:1,2,5,6
- [ ] **1.3.6** Implement step advancement logic (increment index, update display)
  - Tests: solo:1,4,5,6 (P0-009, P1-001, P1-012)
- [ ] **1.3.7** Build CompletionScreen for post-step-17 transition
  - Tests: solo:1,7 (P2-012)

### Phase 4: Save, Resume & Optimistic UI (Story 1.4) — Make Session Tests Pass

- [ ] **1.4.1** Build ExitConfirmationDialog with Save & Exit / Cancel buttons
  - Tests: session:1,3,4 (P0-010, P2-011)
- [ ] **1.4.2** Implement save-on-exit flow (persist step to server + IndexedDB, return to overview)
  - Tests: session:1,2 (P0-010, P0-011)
- [ ] **1.4.3** Implement session resume from overview (load saved step, continue reading)
  - Tests: session:2 (P0-011)
- [ ] **1.4.4** Implement optimistic step advancement (instant UI update, background server sync)
  - Tests: solo:5 (P1-001)
- [ ] **1.4.5** Build RetryIndicator for server write failures
  - Tests: session:5 (P1-005)
- [ ] **1.4.6** Build OfflineIndicator and offline step-advance guard
  - Tests: session:6,7 (P2-009, P2-010)

### Phase 5: Accessibility (Story 1.5) — Make Accessibility Tests Pass

- [ ] **1.5.1** Ensure logical tab order on all interactive elements
  - Tests: accessibility:1,2,3 (P2-001)
- [ ] **1.5.2** Add descriptive `aria-label` attributes to all buttons
  - Tests: accessibility:4 (P2-002)
- [ ] **1.5.3** Add `aria-label="Currently on verse X of 17"` to progress indicator
  - Tests: accessibility:5 (P2-002)
- [ ] **1.5.4** Add `aria-live="polite"` region with `data-testid="scripture-live-region"` for verse announcements
  - Tests: accessibility:6,7 (P2-003, P2-004)
- [ ] **1.5.5** Implement focus management: verse heading on step change, nav button on response transition
  - Tests: accessibility:8,9 (P2-005, P2-006)
- [ ] **1.5.6** Create `useMotionConfig` hook respecting `prefers-reduced-motion`
  - Tests: useMotionConfig:1,2,3 (P2-007)
- [ ] **1.5.7** Ensure 48x48px minimum touch targets with 8px spacing
  - Tests: accessibility:10,11 (P2-008)
- [ ] **1.5.8** Pass axe-core WCAG AA audit on reading screen
  - Tests: accessibility:12 (P2-014)
  - Dev dependency: `@axe-core/playwright`

---

## Running Tests

```bash
# Run all failing E2E tests for this epic
npx playwright test tests/e2e/scripture/

# Run specific test file
npx playwright test tests/e2e/scripture/scripture-solo-reading.spec.ts
npx playwright test tests/e2e/scripture/scripture-rls-security.spec.ts
npx playwright test tests/e2e/scripture/scripture-overview.spec.ts
npx playwright test tests/e2e/scripture/scripture-session.spec.ts
npx playwright test tests/e2e/scripture/scripture-accessibility.spec.ts

# Run tests in headed mode (see browser)
npx playwright test tests/e2e/scripture/ --headed

# Debug specific test
npx playwright test tests/e2e/scripture/scripture-solo-reading.spec.ts --debug

# Run unit tests (new + existing)
npx vitest run tests/unit/hooks/useMotionConfig.test.ts
npx vitest run tests/unit/

# Run ALL tests (E2E + unit)
npx playwright test tests/e2e/scripture/ && npx vitest run tests/unit/
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Deliverables:**
- [x] 10 API tests generated (RLS security)
- [x] 27 E2E tests generated (solo reading, overview, session, accessibility)
- [x] 3 unit tests generated (useMotionConfig hook)
- [x] 31 pre-existing unit tests verified GREEN
- [x] Factories documented (createTestSession, cleanupTestSession)
- [x] Fixtures documented (supabaseAdmin, testSession, merged-fixtures)
- [x] Mock requirements documented (route interception, offline simulation, matchMedia)
- [x] 28 data-testid attributes catalogued with component mapping
- [x] 26 implementation tasks organized in 5 phases

### GREEN Phase (DEV Team - Next Steps)

**Recommended execution order:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

1. Pick one failing test from implementation checklist (start with Phase 1)
2. Read the test to understand expected behavior
3. Implement minimal code to make that specific test pass
4. Run the test to verify it now passes (green)
5. Check off the task in implementation checklist
6. Move to next test and repeat

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all tests pass (green phase complete)
2. Review code for quality
3. Extract duplications
4. Optimize performance
5. Ensure tests still pass after each refactor

---

## Knowledge Base References Applied

- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation
- **component-tdd.md** - Component test strategies using red-green-refactor
- **test-quality.md** - Test design principles (Given-When-Then, determinism, isolation)
- **selector-resilience.md** - Selector hierarchy (data-testid > ARIA > text > CSS)
- **timing-debugging.md** - Race condition prevention and deterministic waiting
- **test-healing-patterns.md** - Common failure patterns and healing strategies
- **overview.md** - Playwright utils for ATDD patterns
- **fixtures-composition.md** - mergeTests composition patterns

---

**Generated by BMad TEA Agent** - 2026-01-30
