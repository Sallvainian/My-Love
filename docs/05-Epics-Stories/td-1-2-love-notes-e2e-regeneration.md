# Story TD-1.2: Epic 2 (Love Notes) E2E Test Regeneration

**Story Key:** td-1-2-love-notes-e2e-regeneration
**Epic:** TD-1 - Test Quality Remediation
**Status:** ready-for-dev
**Priority:** HIGH
**Type:** Technical Debt / Quality Engineering
**Created:** 2025-12-07
**Sprint:** Current

---

## User Story

**As a** development team,
**I want** Love Notes E2E tests regenerated using TEA workflows with enforced quality gates,
**So that** messaging flows are reliably tested without false positives from anti-patterns.

---

## Context & Background

### Why This Story Exists

Story TD-1.0 established quality standards and archived the existing E2E tests (scored 52/100). Story TD-1.1 regenerated auth E2E tests. This story continues the regeneration phase, targeting Epic 2 (Love Notes) flows:
- **Story 2-1**: Love Notes Chat UI Foundation
- **Story 2-2**: Send Love Note with Optimistic Updates
- **Story 2-3**: Real-Time Message Reception
- **Story 2-4**: Message History & Scroll Performance

The archived love-notes tests contained critical anti-patterns:

**Archived Files with Anti-Patterns:**
| File | Lines | Critical Issues |
|------|-------|-----------------|
| `send-love-note.spec.ts` | 236 | No-op assertion paths (lines 102-106), error swallowing |
| `love-notes-pagination.spec.ts` | 270 | Heavy runtime `test.skip()`, conditional flow, error swallowing |
| `love-notes-images.spec.ts` | 514 | Conditional flow control, error swallowing (`.catch(() => false)`) |

**Specific Anti-Patterns Found:**
```typescript
// send-love-note.spec.ts:102-106 - NO-OP ASSERTION PATH
const sendingWasVisible = await sendingIndicator.isVisible().catch(() => false);
if (sendingWasVisible) {
  await expect(sendingIndicator).toBeHidden({ timeout: 5000 });
}
// If sendingWasVisible is false, NO assertion runs!

// love-notes-pagination.spec.ts:30-32 - ERROR SWALLOWING
if (await notesNav.isVisible({ timeout: 5000 }).catch(() => false)) {
  await notesNav.click();
}

// love-notes-pagination.spec.ts:53 - RUNTIME TEST.SKIP
test.skip(!messagesExist, 'Requires seed data with messages');
```

### Target Test Files to Regenerate

```
tests/e2e/
├── love-notes/
│   ├── love-notes.setup.ts          # Shared love notes fixtures
│   ├── send-message.spec.ts         # Story 2-2: Send with optimistic updates
│   ├── realtime-reception.spec.ts   # Story 2-3: Real-time message reception
│   ├── message-history.spec.ts      # Story 2-4: Pagination & scroll performance
│   └── image-attachments.spec.ts    # Image upload and display
```

---

## Acceptance Criteria

### AC1: Zero Anti-Pattern Instances

**Given** the regenerated love-notes E2E tests
**When** scanned with the test smell detector
**Then** there should be:
- Zero instances of `.catch(() => false)` or error swallowing
- Zero `if/else` conditionals in test bodies
- Zero runtime `test.skip()` decisions
- All test paths have guaranteed assertions

**Verification:**
```bash
grep -rE "\\.catch\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*(false|\\{\\})\\s*\\)" tests/e2e/love-notes/
grep -rE "^\\s*if\\s*\\(" tests/e2e/love-notes/*.spec.ts | grep -v "// @allowed-conditional"
grep -rE "test\\.skip\\s*\\(" tests/e2e/love-notes/*.spec.ts
```

### AC2: Network-First Pattern Compliance

**Given** any test that makes API calls
**When** the test navigates to a page
**Then** route interception MUST be set up BEFORE `page.goto()`:

```typescript
// CORRECT - Intercept before navigate
await page.route('**/love_notes**', async (route) => { /* handler */ });
await page.goto('/notes');

// WRONG - Navigate before intercept
await page.goto('/notes');
await page.route('**/love_notes**', async (route) => { /* handler */ });
```

### AC3: Deterministic Wait Patterns

**Given** the regenerated tests
**When** waiting for async operations
**Then** only deterministic patterns are allowed:
- `await page.waitForResponse(url)`
- `await expect(locator).toBeVisible()`
- `await page.waitForURL(pattern)`
- `await locator.waitFor({ state: 'visible' | 'detached' })`
- **NEVER** `await page.waitForTimeout(ms)` - PROHIBITED

### AC4: Accessibility-First Selectors

**Given** any element interaction
**When** selecting elements
**Then** follow the selector priority hierarchy:
1. `getByRole()` - HIGHEST priority
2. `getByLabel()`
3. `getByTestId()` - Only for elements without semantic role
4. `getByText()` - For static text content
5. `locator()` with CSS - LAST resort

**Example:**
```typescript
// PREFERRED
await page.getByRole('textbox', { name: /message/i }).fill('Hello');
await page.getByRole('button', { name: /send/i }).click();

// AVOID
await page.locator('.message-input').fill('Hello');
await page.locator('#send-btn').click();
```

### AC5: TEA Quality Score >=85

**Given** the completed love-notes E2E tests
**When** evaluated using TEA quality rubric
**Then** the score must be >=85/100

**Quality Rubric (from TEA knowledge base):**
| Category | Weight | Criteria |
|----------|--------|----------|
| Selector Resilience | 25% | Accessibility-first, no brittle CSS |
| Wait Patterns | 20% | Deterministic only, no arbitrary delays |
| Assertion Quality | 20% | Every path has guaranteed assertions |
| Anti-Pattern Free | 20% | Zero instances of documented anti-patterns |
| Network Handling | 15% | Network-first pattern, proper intercept |

### AC6: Coverage Requirements

**Given** the regenerated love-notes tests
**When** evaluating test coverage
**Then** the following flows MUST be covered:

**Send Message (Story 2-2):**
- [ ] Send text message with optimistic update
- [ ] Message input validation (empty, max length)
- [ ] Character counter behavior (900+, 950+, 1000+)
- [ ] Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- [ ] Send button enable/disable states

**Real-Time Reception (Story 2-3):**
- [ ] Receive message in real-time (via Supabase Broadcast)
- [ ] Message deduplication
- [ ] Error state display

**Message History (Story 2-4):**
- [ ] Scroll position maintenance during data load
- [ ] Virtualized list rendering (DOM node count check)
- [ ] Empty state display
- [ ] Loading indicator behavior

**Image Attachments:**
- [ ] Image attachment button visibility
- [ ] Image preview on selection
- [ ] Send image with text
- [ ] Send image without text
- [ ] File type validation (JPEG, PNG, WebP only)

---

## Technical Implementation

### Task 1: Execute TEA Test Design Workflow

**Workflow:** `.bmad/bmm/workflows/testarch/test-design/workflow.yaml`

Before writing any test code, execute the testarch test-design workflow to:
1. Assess risks for love-notes flows
2. Create prioritized test coverage plan
3. Define P0/P1 scenarios for messaging

**Command:**
```bash
/bmad:bmm:workflows:testarch-test-design
```

**Parameters:**
- `epic_num`: 2
- `design_level`: full
- `mode`: epic-level

**Output:** `docs/05-Epics-Stories/test-design-epic-2-love-notes.md`

### Task 2: Create Love Notes Test Fixtures

**File:** `tests/e2e/love-notes/love-notes.setup.ts`

Create shared fixtures for love-notes tests:
- Mock Supabase love_notes endpoints
- Test message factory
- Real-time subscription helpers
- Network intercept patterns for love_notes API

**TEA Knowledge Reference:**
- `.bmad/bmm/testarch/knowledge/network-first.md` - Route interception patterns
- `.bmad/bmm/testarch/knowledge/intercept-network-call.md` - Network spy/stub patterns
- `.bmad/bmm/testarch/knowledge/data-factories.md` - Test data creation

### Task 3: Regenerate Send Message Tests

**File:** `tests/e2e/love-notes/send-message.spec.ts`

Cover all send message flows per AC6.

**Anti-Pattern Prevention Checklist (Apply to EVERY test):**
- [ ] No `.catch(() => false)` - let errors propagate
- [ ] No `if/else` conditional logic - deterministic paths only
- [ ] No runtime `test.skip()` - skip at describe level only
- [ ] All test paths have guaranteed `expect()` assertions
- [ ] Use `waitForResponse()` not `waitForTimeout()`
- [ ] Network-first: intercept before navigate

**TEA Knowledge Reference:**
- `.bmad/bmm/testarch/knowledge/selector-resilience.md` - Selector patterns
- `.bmad/bmm/testarch/knowledge/timing-debugging.md` - Wait patterns

### Task 4: Regenerate Real-Time Reception Tests

**File:** `tests/e2e/love-notes/realtime-reception.spec.ts`

Cover real-time message reception per AC6. This requires simulating:
- WebSocket/Broadcast channel messages
- Multiple browser contexts (sender/receiver)

**TEA Knowledge Reference:**
- `.bmad/bmm/testarch/knowledge/fixtures-composition.md` - Multi-context fixtures

### Task 5: Regenerate Message History Tests

**File:** `tests/e2e/love-notes/message-history.spec.ts`

Cover scroll performance and pagination per AC6.

**Critical:** The archived `love-notes-pagination.spec.ts` had heavy anti-patterns:
```typescript
// AVOID THIS - Runtime skip with shared state
let messagesExist = false;
test.skip(!messagesExist, 'Requires seed data');
```

**Instead use:**
```typescript
// CORRECT - Static skip at describe level OR fixture-based data seeding
test.describe('Message History', () => {
  // Seed data in beforeAll, don't conditionally skip
  test.beforeAll(async ({ request }) => {
    await seedTestMessages(request);
  });

  test('scrolling loads older messages', async ({ page }) => {
    // Test always runs with known data state
  });
});
```

### Task 6: Regenerate Image Attachments Tests

**File:** `tests/e2e/love-notes/image-attachments.spec.ts`

Cover image upload flows per AC6.

**Critical:** The archived `love-notes-images.spec.ts` had:
```typescript
// ANTI-PATTERN: Error swallowing + conditional
const notesNavVisible = await notesNav.isVisible().catch(() => false);
if (notesNavVisible) { ... }
```

**Instead use:**
```typescript
// CORRECT: Explicit wait, no error swallowing
await expect(notesNav).toBeVisible({ timeout: 5000 });
await notesNav.click();
```

### Task 7: TEA Quality Gate Validation

Before marking complete, validate against all TEA quality gates:

**Quality Gates Checklist (16 mandatory items):**
1. [ ] No `.catch(() => false)` or error swallowing
2. [ ] No `if/else` conditional logic in test bodies
3. [ ] No runtime `test.skip()` decisions
4. [ ] All test paths have guaranteed assertions
5. [ ] All waits use deterministic patterns
6. [ ] No `waitForTimeout()` or arbitrary delays
7. [ ] Accessibility-first selector usage
8. [ ] Network-first pattern (intercept before navigate)
9. [ ] No hardcoded credentials in tests
10. [ ] Test data cleanup in `afterEach`/`afterAll`
11. [ ] Descriptive test names following convention
12. [ ] No flaky element interactions
13. [ ] Proper error state testing
14. [ ] No console.log debugging left in
15. [ ] Tests are independent (no order dependency)
16. [ ] Trace/screenshot on failure configured

---

## Quality Gates (For This Story)

### Pre-Completion Validation

Run the test smell detector before marking done:

```bash
# Run anti-pattern detection
bash -c 'grep -rE "\\.catch\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*(false|\\{\\})\\s*\\)" tests/e2e/love-notes/ && echo "FAIL: Error swallowing detected" || echo "PASS: No error swallowing"'

bash -c 'grep -rE "^\\s*if\\s*\\(" tests/e2e/love-notes/*.spec.ts && echo "FAIL: Conditional logic detected" || echo "PASS: No conditionals"'

bash -c 'grep -rE "waitForTimeout" tests/e2e/love-notes/ && echo "FAIL: Arbitrary waits detected" || echo "PASS: No arbitrary waits"'
```

### Quality Score Calculation

| Criterion | Points | Validation |
|-----------|--------|------------|
| Anti-pattern free | 20 | Zero grep matches |
| Selector quality | 25 | Manual review |
| Wait patterns | 20 | No waitForTimeout |
| Network handling | 15 | Network-first verified |
| Assertion coverage | 20 | All paths have expects |
| **Total Required** | **>=85** | |

---

## Dependencies

### Blocks

- **TD-1.3**: Mood E2E regeneration (pattern established here)
- **TD-1.6**: CI quality gates (requires all E2E stories complete)

### Blocked By

- **TD-1.0**: Quality standards and archive (COMPLETED)
- **TD-1.0.5**: Subscription Observability Infrastructure (DRAFTED - required for R-001 mitigation)
- **TD-1.1**: Auth E2E regeneration (COMPLETED - pattern reference)

### Prerequisites

- TEA knowledge base loaded: `.bmad/bmm/testarch/knowledge/`
- Quality standards reviewed: `docs/04-Testing-QA/e2e-quality-standards.md`
- Archived tests available for reference (patterns to AVOID):
  - `tests/e2e-archive-2025-12/send-love-note.spec.ts`
  - `tests/e2e-archive-2025-12/love-notes-pagination.spec.ts`
  - `tests/e2e-archive-2025-12/love-notes-images.spec.ts`
- Auth fixtures available from TD-1.1: `tests/e2e/auth/auth.setup.ts`

---

## Definition of Done

- [ ] TEA test-design workflow executed, output saved
- [ ] Love notes test fixtures created (`love-notes.setup.ts`)
- [ ] Send message tests regenerated (`send-message.spec.ts`)
- [ ] Real-time reception tests regenerated (`realtime-reception.spec.ts`)
- [ ] Message history tests regenerated (`message-history.spec.ts`)
- [ ] Image attachments tests regenerated (`image-attachments.spec.ts`)
- [ ] All AC1-AC6 acceptance criteria met
- [ ] All 16 TEA quality gates passed
- [ ] Quality score >=85/100
- [ ] Test smell detector shows zero violations
- [ ] Tests pass locally: `npm run test:e2e -- tests/e2e/love-notes/`
- [ ] sprint-status.yaml updated to `done`
- [ ] PR created and approved

---

## Execution Method

> **CRITICAL:** This story MUST be executed using the TEA testarch workflow system.

### Step 1: Invoke TEA Test Design Workflow

```bash
# Execute the test-design workflow for love-notes E2E planning
/bmad:bmm:workflows:testarch-test-design
```

**Workflow:** `.bmad/bmm/workflows/testarch/test-design/workflow.yaml`

**Parameters:**
- `epic_num`: 2
- `design_level`: full
- `mode`: epic-level

**Output:** `docs/05-Epics-Stories/test-design-epic-2-love-notes.md`

### Step 2: Execute ATDD Workflow with TEA Persona

```bash
/bmad:bmm:workflows:testarch-atdd
```

Load all required context before implementing:

**Required Context Loading:**
1. Load TEA knowledge base - READ ALL files from `.bmad/bmm/testarch/knowledge/`
   - `overview.md`: Quality principles and playwright-utils integration
   - `network-first.md`: Route interception patterns
   - `intercept-network-call.md`: Network spy/stub with auto JSON parsing
   - `selector-resilience.md`: Selector hierarchy (testid > ARIA > text > CSS)
   - `timing-debugging.md`: Deterministic wait patterns
   - `data-factories.md`: Test data creation patterns
   - `fixtures-composition.md`: Multi-context fixtures for real-time testing
2. Load quality standards: `docs/04-Testing-QA/e2e-quality-standards.md`
3. Load test design output (from Step 1)
4. Reference archived tests (patterns to AVOID):
   - `tests/e2e-archive-2025-12/send-love-note.spec.ts`
   - `tests/e2e-archive-2025-12/love-notes-pagination.spec.ts`
   - `tests/e2e-archive-2025-12/love-notes-images.spec.ts`
5. Reference auth fixtures (patterns to REUSE): `tests/e2e/auth/auth.setup.ts`

**Implementation Tasks:**
1. Create `tests/e2e/love-notes/love-notes.setup.ts` - Shared fixtures
2. Create `tests/e2e/love-notes/send-message.spec.ts` - Story 2-2 coverage
3. Create `tests/e2e/love-notes/realtime-reception.spec.ts` - Story 2-3 coverage
4. Create `tests/e2e/love-notes/message-history.spec.ts` - Story 2-4 coverage
5. Create `tests/e2e/love-notes/image-attachments.spec.ts` - Image flows
6. Run test smell detector - MUST pass all checks
7. Calculate quality score - MUST be >=85

**Anti-Pattern Checklist (Apply to EVERY test):**
- [ ] No `.catch(() => false)` or error swallowing
- [ ] No `if/else` conditional logic in test bodies
- [ ] No runtime `test.skip()` decisions
- [ ] All test paths have guaranteed assertions
- [ ] All waits use deterministic patterns
- [ ] No `waitForTimeout()` or arbitrary delays
- [ ] Accessibility-first selector usage
- [ ] Network-first pattern (intercept before navigate)

### Step 3: Quality Gate Validation

Before marking complete, run validation:

**Run Test Smell Detector:**
```bash
# Execute pre-commit patterns against new tests
grep -rE "\\.catch\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*(false|\\{\\})\\s*\\)" tests/e2e/love-notes/
grep -rE "^\\s*if\\s*\\(" tests/e2e/love-notes/*.spec.ts
grep -rE "waitForTimeout" tests/e2e/love-notes/
```

**Run Tests:**
```bash
npm run test:e2e -- tests/e2e/love-notes/
```

**Manual Quality Score Review:**
- Review selector patterns for accessibility-first compliance
- Verify network-first pattern in all API tests
- Confirm assertion coverage for all paths

### Step 4: Code Review

```bash
/bmad:bmm:workflows:code-review
```

Reviews generated tests against all TEA quality gates.

---

## TEA Knowledge Base References

| Document | Purpose | Key Patterns |
|----------|---------|--------------|
| `overview.md` | Quality principles | TEA methodology, playwright-utils integration |
| `network-first.md` | API interception | Route setup before navigation |
| `intercept-network-call.md` | Network spy/stub | Auto JSON parsing, response validation |
| `selector-resilience.md` | Element selection | Accessibility-first hierarchy |
| `timing-debugging.md` | Wait patterns | Deterministic waits, flake prevention |
| `data-factories.md` | Test data | Factory patterns for messages |
| `fixtures-composition.md` | Multi-context | Real-time testing with multiple browsers |

**Full Path:** `.bmad/bmm/testarch/knowledge/`

---

## Dev Notes

### Relevant Architecture Patterns

- **Messaging Provider:** Supabase Realtime (Broadcast API)
- **E2E Framework:** Playwright
- **Test Runner:** Playwright Test
- **Virtualization:** react-window for message list

### Source Tree Components

```
src/
├── lib/supabase/           # Supabase client
├── app/(app)/notes/        # Love Notes page
├── components/LoveNotes/   # Chat UI components
│   ├── MessageInput.tsx    # Input with send button
│   ├── MessageList.tsx     # Virtualized message list
│   └── ImageAttachment.tsx # Image upload/preview
└── contexts/               # State management

tests/
├── e2e/love-notes/         # NEW: Regenerated love-notes tests
├── e2e/auth/               # Auth tests (reference for patterns)
└── e2e-archive-2025-12/    # Archived tests (reference for anti-patterns)
```

### Testing Standards Summary

[Source: docs/04-Testing-QA/e2e-quality-standards.md]
- 22 checklist items for quality validation
- 5 documented anti-patterns with before/after examples
- Pre-commit hook script for automated detection

---

## Dev Agent Record

### Context Reference

- Story file: `docs/05-Epics-Stories/td-1-2-love-notes-e2e-regeneration.md`
- Tech spec: `docs/05-Epics-Stories/tech-spec-epic-td-1.md`
- Quality standards: `docs/04-Testing-QA/e2e-quality-standards.md`
- TEA knowledge base: `.bmad/bmm/testarch/knowledge/`

### Agent Model Used

TEA (Test Engineering Architect) via `*atdd` workflow

### Debug Log References

_To be populated during implementation_

### Completion Notes List

_To be populated during implementation_

### File List

**Files to Create:**
- `tests/e2e/love-notes/love-notes.setup.ts` - Shared fixtures
- `tests/e2e/love-notes/send-message.spec.ts` - Send message tests
- `tests/e2e/love-notes/realtime-reception.spec.ts` - Real-time tests
- `tests/e2e/love-notes/message-history.spec.ts` - Pagination tests
- `tests/e2e/love-notes/image-attachments.spec.ts` - Image tests
- `docs/05-Epics-Stories/test-design-epic-2-love-notes.md` - TEA test design output

**Files to Reference (Archived - patterns to AVOID):**
- `tests/e2e-archive-2025-12/send-love-note.spec.ts`
- `tests/e2e-archive-2025-12/love-notes-pagination.spec.ts`
- `tests/e2e-archive-2025-12/love-notes-images.spec.ts`

**Files to Reference (Good patterns to REUSE):**
- `tests/e2e/auth/auth.setup.ts` - Auth fixtures
- `tests/e2e/auth/magic-link.spec.ts` - Quality test example
- `.bmad/bmm/testarch/knowledge/*.md` - TEA knowledge base

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-07 | Story created with TEA workflow integration | Claude (create-story workflow) |

---

*Generated by BMAD create-story workflow - 2025-12-07*
