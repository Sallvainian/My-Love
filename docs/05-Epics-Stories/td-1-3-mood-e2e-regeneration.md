# Story TD-1.3: Mood E2E Test Regeneration

Status: ready-for-dev

## Story

As a **development team**,
I want **Mood E2E tests regenerated using TEA workflows with enforced quality gates**,
so that **mood tracking flows are reliably tested without false positives from anti-patterns**.

## Context

**Background:**
- TEA test-review (2025-12-07) identified critical anti-patterns across mood-related spec files
- Archived tests scored 52/100 with heavy conditionals, error swallowing, and no-op assertion paths
- Previous stories TD-1.1 (Auth) and TD-1.2 (Love Notes) established patterns and fixtures

**Scope:** Stories 5-1 through 5-4 (Mood Tracking features)

**Test Scenarios to Cover:**
- Mood emoji selection (single and multi-mood)
- Optional note attachment
- Partner mood visibility
- Mood history timeline loading
- Virtualized scroll behavior

## Acceptance Criteria

### AC 3.1: Zero Anti-Pattern Instances
**Given** all regenerated mood E2E tests
**When** code review is performed
**Then**
- Zero instances of `.catch(() => false)` or error swallowing
- Zero `if/else` conditionals in test bodies
- Zero runtime `test.skip()` decisions
- All assertions are guaranteed to execute

### AC 3.2: Network-First Pattern Compliance
**Given** tests that interact with Supabase API
**When** API calls are mocked
**Then**
- Route interception BEFORE `page.goto()` or navigation triggers
- `waitForResponse()` patterns for deterministic API waits
- No race conditions between navigation and mocking

### AC 3.3: Deterministic Wait Patterns Only
**Given** all mood E2E tests
**When** waiting for UI state changes
**Then**
- Zero `waitForTimeout()` or arbitrary delays
- All waits use `waitForResponse()` or `waitFor({ state })`
- Element visibility assertions with appropriate timeouts

### AC 3.4: Accessibility-First Selectors
**Given** all mood E2E tests
**When** locating elements
**Then**
- Priority: `getByRole` > `getByLabel` > `getByTestId`
- Existing `data-testid` attributes used when semantic selectors insufficient
- Zero brittle CSS/XPath selectors

### AC 3.5: TEA Quality Score >=85/100
**Given** regenerated mood tests
**When** TEA quality gate validation runs
**Then**
- Score >=85/100 on TEA rubric
- All 16 quality gates from `e2e-quality-standards.md` pass

### AC 3.6: Coverage Requirements
**Given** the mood E2E test suite
**When** reviewing test scenarios
**Then**
- Mood selection (single mood) - tested
- Multi-mood selection - tested
- Mood with optional note - tested
- Mood without note (note is optional) - tested
- Submit button state (disabled without selection) - tested
- Success toast display and auto-dismiss - tested
- Offline behavior and retry - tested
- Partner mood visibility - tested
- Mood history timeline loading - tested

## Tasks / Subtasks

### Task 1: Execute TEA test-design workflow (AC: 3.5)
- [ ] 1.1: Run `/bmad:bmm:workflows:testarch-test-design` with epic_num=5
- [ ] 1.2: Output: `docs/05-Epics-Stories/test-design-epic-5-mood.md`
- [ ] 1.3: Review risk assessment and coverage plan

### Task 2: Create mood test fixtures (AC: 3.2, 3.3)
- [ ] 2.1: Create `tests/e2e/mood/mood.setup.ts` with TEA patterns
- [ ] 2.2: Define `navigateToMood()` fixture with network-first pattern
- [ ] 2.3: Define `mockMoodAPI()` fixture for route interception
- [ ] 2.4: Define `moodSelectors` object (accessibility-first hierarchy)
- [ ] 2.5: Integrate with merged fixtures from `tests/support/fixtures/`

### Task 3: Regenerate mood selection tests (AC: 3.1, 3.4, 3.6)
- [ ] 3.1: Create `tests/e2e/mood/mood-selection.spec.ts`
- [ ] 3.2: Test single mood selection
- [ ] 3.3: Test multi-mood selection
- [ ] 3.4: Test mood deselection toggle
- [ ] 3.5: Test visual feedback (selected state)

### Task 4: Regenerate mood submission tests (AC: 3.1, 3.4, 3.6)
- [ ] 4.1: Create `tests/e2e/mood/mood-submission.spec.ts`
- [ ] 4.2: Test submit button disabled state (no selection)
- [ ] 4.3: Test submit button enabled state (with selection)
- [ ] 4.4: Test success toast display and auto-dismiss (3s)
- [ ] 4.5: Test mood with optional note
- [ ] 4.6: Test mood without note
- [ ] 4.7: Test note character counter (200 max)

### Task 5: Regenerate offline behavior tests (AC: 3.1, 3.6)
- [ ] 5.1: Create `tests/e2e/mood/mood-offline.spec.ts`
- [ ] 5.2: Test offline indicator display
- [ ] 5.3: Test mood save while offline (local save)
- [ ] 5.4: Test retry sync button
- [ ] 5.5: Test background sync registration

### Task 6: Regenerate partner mood tests (AC: 3.1, 3.4, 3.6)
- [ ] 6.1: Create `tests/e2e/mood/partner-mood.spec.ts`
- [ ] 6.2: Test partner mood display visibility
- [ ] 6.3: Test partner mood loading state
- [ ] 6.4: Test partner mood emoji and timestamp

### Task 7: Regenerate mood history tests (AC: 3.1, 3.3, 3.6)
- [ ] 7.1: Create `tests/e2e/mood/mood-history.spec.ts`
- [ ] 7.2: Test timeline tab navigation
- [ ] 7.3: Test history calendar tab navigation
- [ ] 7.4: Test empty state display
- [ ] 7.5: Test virtualized scroll (DOM node count)
- [ ] 7.6: Test date header sticky behavior

### Task 8: TEA quality gate validation (AC: 3.1, 3.5)
- [ ] 8.1: Run test smell detector on all mood specs
- [ ] 8.2: Verify >=85 score
- [ ] 8.3: Run anti-pattern grep checks
- [ ] 8.4: Verify 3 consecutive suite passes

## Dev Notes

### Component Implementation Analysis

**MoodTracker Component** (`src/components/MoodTracker/MoodTracker.tsx`):
- 12 mood types: 6 positive (loved, happy, content, excited, thoughtful, grateful) + 6 challenging (sad, anxious, frustrated, angry, lonely, tired)
- Multi-mood selection support (array of MoodType)
- Optional note with 200-char limit
- Tab navigation: tracker | timeline | history
- Partner mood display (conditional on partnerId)
- Offline sync with retry button

**Key data-testid Attributes:**
```typescript
// Container
'mood-tracker'

// Tabs
'mood-tab-tracker'
'mood-tab-timeline'
'mood-tab-history'

// Mood buttons (pattern: mood-button-{mood})
'mood-button-happy'
'mood-button-loved'
'mood-button-content'
'mood-button-excited'
'mood-button-thoughtful'
'mood-button-grateful'
'mood-button-sad'
'mood-button-anxious'
'mood-button-frustrated'
'mood-button-angry'
'mood-button-lonely'
'mood-button-tired'

// Form elements
'mood-note-input'
'mood-submit-button'
'mood-char-counter'
'mood-add-note-toggle'

// Feedback
'mood-success-toast'
'mood-error-message'
'mood-offline-error'
'mood-retry-button'

// Timeline/History
'mood-history-section'
'mood-history-timeline'
'empty-mood-history-state'
'loading-spinner'
```

**API Endpoints (Supabase):**
- `moods` table for CRUD operations
- Real-time subscription for partner mood
- Background sync via `registerBackgroundSync('sync-pending-moods')`

### Anti-Patterns to Avoid (from archived tests)

**Archived mood.spec.ts anti-patterns:**
```typescript
// ANTI-PATTERN 1: Error swallowing + conditional
if (await moodNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
  // This creates non-deterministic test behavior
}

// ANTI-PATTERN 2: Conditional test paths
if (await happyMood.isVisible({ timeout: 2000 }).catch(() => false)) {
  await happyMood.click();
} else {
  // Different code path - test is non-deterministic
}

// ANTI-PATTERN 3: No-op assertion path
const toastVisible = await successToast.isVisible({ timeout: 5000 }).catch(() => false);
if (toastVisible) {
  await expect(successToast).toBeVisible();
}
// If toastVisible is false, NO assertion runs!
```

**Archived quick-mood-logging.spec.ts anti-patterns:**
```typescript
// ANTI-PATTERN: Suite-level skip with env var check
test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not configured');
// Masks configuration issues - tests may never run in CI
```

### Correct Patterns (from TD-1.1 auth.setup.ts)

**Network-first fixture pattern:**
```typescript
loginAs: async ({}, use) => {
  const loginAs = async (page: Page, credentials: TestCredentials) => {
    // Step 1: Set up response listener BEFORE navigation
    const authResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('auth') && resp.status() >= 200
    );

    // Step 2: Navigate
    await page.goto('/');

    // Step 3: Interact
    await emailInput.fill(credentials.email);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Step 4: Wait for response (deterministic)
    await authResponsePromise;
  };
  await use(loginAs);
};
```

**Deterministic conditional handling:**
```typescript
// CORRECT: Use waitFor with timeout, let it fail if not present
const onboardingVisible = await displayNameInput
  .waitFor({ state: 'visible', timeout: 3000 })
  .then(() => true)
  .catch(() => false);

if (onboardingVisible) {
  // Handle onboarding
}
// But better: Make onboarding deterministic via test data setup
```

### Fixture Composition

Use merged fixtures from `tests/support/fixtures/index.ts`:
```typescript
import { test, expect } from '../../support/fixtures';

// Access all fixtures:
// - $: strict selector interface
// - loveNotes: domain selectors (adapt for mood)
// - navigateToLoveNotes: navigation helper (create navigateToMood)
// - cleanApp: state cleanup
// - appWithMessages: pre-seeded state
```

### References

- [Source: .bmad/bmm/testarch/knowledge/] - TEA knowledge base
- [Source: docs/04-Testing-QA/e2e-quality-standards.md] - 16 quality gates
- [Source: tests/e2e/auth/auth.setup.ts] - Reference implementation from TD-1.1
- [Source: tests/e2e/love-notes/love-notes.setup.ts] - Reference from TD-1.2
- [Source: tests/e2e-archive-2025-12/mood.spec.ts] - Patterns to AVOID
- [Source: tests/e2e-archive-2025-12/quick-mood-logging.spec.ts] - Patterns to AVOID

## Dev Agent Record

### Context Reference

- `.bmad/bmm/testarch/knowledge/` - Load ALL files before implementing
- `docs/04-Testing-QA/e2e-quality-standards.md`
- `docs/05-Epics-Stories/tech-spec-epic-td-1.md`
- `docs/05-Epics-Stories/test-design-epic-2-love-notes.md` - Similar pattern for mood

### Agent Model Used

TEA (Test Engineering Architect) via `*atdd` workflow

### Completion Notes List

_To be populated during implementation_

### File List

**Create:**
```
tests/e2e/mood/
├── mood.setup.ts           # Shared fixtures (navigation, mocks, selectors)
├── mood-selection.spec.ts  # Single/multi mood selection
├── mood-submission.spec.ts # Form submission, toast, notes
├── mood-offline.spec.ts    # Offline behavior, retry sync
├── partner-mood.spec.ts    # Partner mood visibility
└── mood-history.spec.ts    # Timeline, calendar, virtualization
```

---

*Story generated by BMAD create-story workflow - 2025-12-10*
*Ultimate context engine analysis completed - comprehensive developer guide created*
