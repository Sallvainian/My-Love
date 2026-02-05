# Test Quality Review: scripture-solo-reading.spec.ts

**Quality Score**: 54/100 (F - Critical Issues)
**Review Date**: 2026-02-04
**Review Scope**: Single file
**Reviewer**: TEA Agent (Murat)

---

Note: This review audits existing tests; it does not generate tests.

## Executive Summary

**Overall Assessment**: Critical Issues

**Recommendation**: Request Changes

### Key Strengths

- BDD structure with Given/When/Then comments throughout all tests
- Consistent use of `data-testid` selectors (resilient selector hierarchy)
- File is well under 300-line limit (213 lines)
- Test IDs documented in header comment (P0-009, P1-001, P1-010, P1-011, P1-012, P2-012)
- Well-structured describe blocks organized by priority

### Key Weaknesses

- Zero data seeding despite `testSession` fixture being available
- No network interception or response synchronization
- Race conditions in rapid-click loops (17-step and 16-step)
- No test isolation or cleanup between tests
- No error/negative scenario coverage

### Summary

All 7 tests fail with `TimeoutError: locator.click: Timeout 15000ms exceeded` because they navigate to `/scripture` and immediately attempt to click UI elements that require seeded scripture data to render. The `testSession` fixture exists in `tests/support/fixtures/index.ts` with automatic cleanup but is never used. Tests also lack any network synchronization — clicks fire without waiting for API responses, creating race conditions even if data were present. The test structure (BDD comments, data-testid selectors, describe blocks) is good, but the tests are non-functional without data seeding and synchronization fixes.

---

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
| --- | --- | --- | --- |
| BDD Format (Given-When-Then) | PASS | 0 | All tests use GWT comments |
| Test IDs | PASS | 0 | IDs in header: P0-009, P1-001, P1-010, P1-011, P1-012, P2-012 |
| Priority Markers (P0/P1/P2/P3) | PASS | 0 | Priorities in describe block names |
| Hard Waits (sleep, waitForTimeout) | PASS | 0 | No hard waits found |
| Determinism (no conditionals) | WARN | 2 | `if (step < 17)` in loops; race conditions from missing sync |
| Isolation (cleanup, no shared state) | FAIL | 4 | No cleanup, no fixture isolation, shared auth state |
| Fixture Patterns | FAIL | 2 | testSession fixture unused; no custom fixtures leveraged |
| Data Factories | FAIL | 2 | No data seeding; magic number 17 hardcoded |
| Network-First Pattern | FAIL | 4 | Zero page.route() or waitForResponse() calls |
| Explicit Assertions | PASS | 0 | All assertions visible in test bodies (26 total) |
| Test Length (<=300 lines) | PASS | 0 | 213 lines |
| Test Duration (<=1.5 min) | WARN | 2 | 17-step loop + 16-click loop likely exceed target |
| Flakiness Patterns | FAIL | 9 | Race conditions throughout; timing-dependent assertions |

**Total Violations**: 12 Critical, 9 High, 4 Medium, 0 Low

---

## Quality Score Breakdown

```
Starting Score:          100

Dimension Scores (weighted):
  Determinism (25%):      20/100 × 0.25 = 5.0
  Isolation (25%):        55/100 × 0.25 = 13.75
  Maintainability (20%):  75/100 × 0.20 = 15.0
  Coverage (15%):         65/100 × 0.15 = 9.75
  Performance (15%):      70/100 × 0.15 = 10.5
                          --------
Final Score:              54/100
Grade:                    F (Critical Issues)
```

---

## Critical Issues (Must Fix)

### 1. Missing Data Seeding (All Tests)

**Severity**: P0 (Critical)
**Location**: `scripture-solo-reading.spec.ts:15-213` (all 7 tests)
**Criterion**: Data Factories / Determinism
**Knowledge Base**: [data-factories.md](../../_bmad/bmm/testarch/knowledge/data-factories.md), [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Issue Description**:
Every test navigates to `/scripture` and immediately clicks `scripture-start-button`, but no scripture data is seeded in the database. The `testSession` fixture (which creates test sessions via Supabase RPC and auto-cleans up) exists in `tests/support/fixtures/index.ts` but is never used. Without data, the UI never renders the start button, causing all clicks to timeout.

**Current Code**:

```typescript
// Bad (current implementation) - line 15
test('should complete full solo reading flow from step 1 to 17', async ({
  page, // Only uses page - no data seeding
}) => {
  await page.goto('/scripture');
  await page.getByTestId('scripture-start-button').click(); // Timeout! Element never renders
```

**Recommended Fix**:

```typescript
// Good (recommended approach)
test('should complete full solo reading flow from step 1 to 17', async ({
  page,
  testSession, // Add testSession fixture - seeds data + auto-cleanup
}) => {
  // testSession already seeded scripture data via createTestSession()
  await page.goto('/scripture');
  await page.getByTestId('scripture-start-button').click(); // Now renders!
```

**Why This Matters**:
This is the root cause of ALL 7 test failures. Without seeded data, tests are non-functional. The fixture already exists and handles cleanup automatically — it just needs to be requested in the test signature.

---

### 2. Missing Network Synchronization (All Tests)

**Severity**: P0 (Critical)
**Location**: `scripture-solo-reading.spec.ts:19-213` (all navigation + click sequences)
**Criterion**: Network-First Pattern / Determinism
**Knowledge Base**: [timing-debugging.md](../../_bmad/bmm/testarch/knowledge/timing-debugging.md), [test-healing-patterns.md](../../_bmad/bmm/testarch/knowledge/test-healing-patterns.md)

**Issue Description**:
Tests perform `page.goto('/scripture')` followed by immediate clicks without waiting for API responses. No `page.waitForResponse()`, no `page.route()` interception, and no network idle checks. This creates race conditions where clicks fire before the page has loaded data from the server.

**Current Code**:

```typescript
// Bad (current implementation) - line 19-21
await page.goto('/scripture');
await page.getByTestId('scripture-start-button').click(); // Race: page may not have loaded
await page.getByTestId('scripture-mode-solo').click();     // Race: mode selector may not exist
```

**Recommended Fix**:

```typescript
// Good (recommended approach)
const scriptureDataPromise = page.waitForResponse(
  resp => resp.url().includes('/scripture') && resp.ok()
);
await page.goto('/scripture');
await scriptureDataPromise; // Deterministic wait for API data

await page.getByTestId('scripture-start-button').click();
await page.getByTestId('scripture-mode-solo').click();
```

**Why This Matters**:
Even after fixing data seeding, race conditions will cause intermittent failures in CI (slower environments). Network-first pattern guarantees deterministic behavior.

---

### 3. Race Conditions in Step-Advance Loops

**Severity**: P0 (Critical)
**Location**: `scripture-solo-reading.spec.ts:24-42` (17-step loop), `scripture-solo-reading.spec.ts:197-199` (16-click loop)
**Criterion**: Determinism / Flakiness
**Knowledge Base**: [timing-debugging.md](../../_bmad/bmm/testarch/knowledge/timing-debugging.md)

**Issue Description**:
Two loops click the "Next Verse" button repeatedly without waiting for the server to process each step advancement. The 17-step loop has assertions but no network sync between iterations. The 16-click loop has zero synchronization — it fires 16 rapid clicks hoping the UI keeps up.

**Current Code**:

```typescript
// Bad - line 197-199 (16 rapid clicks with zero sync)
for (let i = 0; i < 16; i++) {
  await page.getByTestId('scripture-next-verse-button').click();
  // No wait for API response or UI state update
}
```

**Recommended Fix**:

```typescript
// Good (recommended approach)
for (let i = 0; i < 16; i++) {
  await page.getByTestId('scripture-next-verse-button').click();
  // Wait for progress indicator to update (proves UI + server synced)
  await expect(
    page.getByTestId('scripture-progress-indicator')
  ).toHaveText(`Verse ${i + 2} of 17`);
}
```

**Why This Matters**:
Rapid unsynchronized clicks will cause flaky failures even locally. Each click triggers a server call; without waiting for it, the UI can get into an inconsistent state.

---

### 4. No Test Isolation or Cleanup

**Severity**: P1 (High)
**Location**: `scripture-solo-reading.spec.ts` (all tests)
**Criterion**: Isolation
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Issue Description**:
Tests have no `beforeEach`/`afterEach` hooks and don't use the `testSession` fixture (which handles auto-cleanup). If one test creates session state, it persists for subsequent tests. This violates parallel-safe isolation and creates order-dependent failures.

**Current Code**:

```typescript
// Bad - no isolation
test.describe('Solo Reading Flow', () => {
  // No beforeEach to seed fresh data
  // No afterEach to cleanup
  test('test 1', async ({ page }) => { /* ... */ });
  test('test 2', async ({ page }) => { /* may see test 1's state */ });
});
```

**Recommended Fix**:

```typescript
// Good - fixture-based isolation with auto-cleanup
test.describe('Solo Reading Flow', () => {
  // testSession fixture seeds fresh data per test and cleans up automatically
  test('test 1', async ({ page, testSession }) => { /* fresh state */ });
  test('test 2', async ({ page, testSession }) => { /* fresh state */ });
});
```

**Why This Matters**:
Without isolation, tests cannot run in parallel (`fullyParallel: true` in config) and will produce non-deterministic failures when test order changes.

---

## Recommendations (Should Fix)

### 1. Extract Shared Navigation Setup

**Severity**: P2 (Medium)
**Location**: `scripture-solo-reading.spec.ts:19-21, 57-59, 87-89, 117-119, 141-143, 165-167, 193-195`
**Criterion**: Maintainability (DRY)

**Issue Description**:
All 7 tests repeat identical 3-line setup: `goto('/scripture')` → click start → click solo. This should be extracted.

**Recommended Improvement**:

```typescript
// Better: Use beforeEach or a navigation helper
test.describe('Solo Reading Flow', () => {
  test.beforeEach(async ({ page, testSession }) => {
    const dataPromise = page.waitForResponse(resp => resp.url().includes('/scripture') && resp.ok());
    await page.goto('/scripture');
    await dataPromise;
    await page.getByTestId('scripture-start-button').click();
    await page.getByTestId('scripture-mode-solo').click();
  });

  test('should display verse screen with correct elements', async ({ page }) => {
    // Already at verse 1 — just assert
    await expect(page.getByTestId('scripture-verse-reference')).toBeVisible();
  });
});
```

### 2. Replace Magic Number 17

**Severity**: P3 (Low)
**Location**: Multiple lines
**Criterion**: Maintainability

**Recommended Improvement**:

```typescript
const TOTAL_VERSES = 17; // Derive from testSession data if possible
```

---

## Best Practices Found

### 1. Consistent data-testid Selectors

**Location**: All tests
**Pattern**: Selector Resilience Hierarchy
**Knowledge Base**: [selector-resilience.md](../../_bmad/bmm/testarch/knowledge/selector-resilience.md)

**Why This Is Good**:
Every interaction uses `getByTestId()` — the most resilient selector strategy. No CSS classes, no nth() indexes, no complex XPath. These selectors survive UI refactoring.

### 2. BDD Structure with GWT Comments

**Location**: All tests
**Pattern**: Test Readability

**Why This Is Good**:
Every test has `// GIVEN:`, `// WHEN:`, `// THEN:`, `// AND:` comments that clearly document intent. This makes tests self-documenting and easy to review.

### 3. No Hard Waits

**Location**: All tests
**Pattern**: Test Quality DoD

**Why This Is Good**:
Zero instances of `waitForTimeout()`, `sleep()`, or `setTimeout()`. The tests avoid the most common flakiness anti-pattern. They just need the *right* waits (network-first) instead of *no* waits.

---

## Test File Analysis

### File Metadata

- **File Path**: `tests/e2e/scripture/scripture-solo-reading.spec.ts`
- **File Size**: 213 lines, ~7 KB
- **Test Framework**: Playwright (via merged-fixtures)
- **Language**: TypeScript

### Test Structure

- **Describe Blocks**: 5 nested
- **Test Cases (it/test)**: 7
- **Average Test Length**: ~28 lines per test
- **Fixtures Used**: 1 (`page` only)
- **Data Factories Used**: 0
- **Fixtures Available but Unused**: testSession, supabaseAdmin, apiRequest, log, networkErrorMonitor, recurse

### Test Coverage Scope

- **Test IDs**: P0-009, P1-001, P1-010, P1-011, P1-012, P2-012
- **Priority Distribution**:
  - P0 (Critical): 1 test
  - P1 (High): 4 tests
  - P2 (Medium): 1 test
  - P3 (Low): 0 tests
  - Unknown: 1 test (verse/response navigation)

### Assertions Analysis

- **Total Assertions**: 26
- **Assertions per Test**: 3.7 (avg)
- **Assertion Types**: `toBeVisible` (17), `toHaveText` (9)

---

## Context and Integration

### Related Artifacts

- **Test Design**: [test-design-epic-1.md](../docs/.archive/epic-1/test-design-epic-1.md) (restored from git history)
  - Risk Assessment: R-001 (RLS bypass), R-002 (IndexedDB corruption) — Score 6+ HIGH
  - P0-009 mapped: Full 17-step solo reading flow
  - P1-001 mapped: Optimistic step advance
  - P1-012 mapped: Progress indicator updates
  - P2-012 mapped: Session completion boundary

- **ATDD Checklist**: [atdd-checklist-epic-1.md](../docs/.archive/epic-1/atdd-checklist-epic-1.md) (restored from git history)

### Acceptance Criteria Validation

| Test ID | Test Name | Maps To | Status | Notes |
| --- | --- | --- | --- | --- |
| P0-009 | Full solo reading flow (17 steps) | AC: Complete scripture session | FAIL | Timeout — no data seeding |
| P1-001 | Optimistic step advance | AC: Immediate UI feedback | FAIL | Timeout — no sync |
| P1-010 | Verse screen elements | AC: Display verse + controls | FAIL | Timeout — no data |
| P1-011 | Response screen navigation | AC: View response + back | FAIL | Timeout — no data |
| P1-012 | Progress indicator updates | AC: Track reading progress | FAIL | Timeout — no data |
| P2-012 | Session completion boundary | AC: Transition to reflection | FAIL | Timeout — no data |

**Coverage**: 6/6 test IDs covered, but 0/6 passing (0% functional)

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)** - Definition of Done (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[test-healing-patterns.md](../../_bmad/bmm/testarch/knowledge/test-healing-patterns.md)** - Race condition diagnosis, timeout failure patterns
- **[selector-resilience.md](../../_bmad/bmm/testarch/knowledge/selector-resilience.md)** - data-testid hierarchy validation
- **[timing-debugging.md](../../_bmad/bmm/testarch/knowledge/timing-debugging.md)** - Network-first pattern, deterministic waits
- **[overview.md](../../_bmad/bmm/testarch/knowledge/overview.md)** - Playwright Utils fixture composition

See [testarch-index.csv](../../_bmad/bmm/testarch/testarch-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Add `testSession` fixture to all 7 tests** - Seed scripture data + auto-cleanup
   - Priority: P0
   - Estimated Effort: 30 minutes

2. **Add network synchronization after navigation** - `waitForResponse` after `page.goto()`
   - Priority: P0
   - Estimated Effort: 1 hour

3. **Add synchronization in step-advance loops** - Wait for progress indicator update between clicks
   - Priority: P0
   - Estimated Effort: 30 minutes

4. **Extract shared navigation to beforeEach** - DRY the 3-line setup
   - Priority: P2
   - Estimated Effort: 30 minutes

### Follow-up Actions (Future PRs)

1. **Add error scenario tests** - Network failure, empty data, server rejection
   - Priority: P1
   - Target: Next sprint

2. **Add offline/degraded tests** - Service worker, IndexedDB fallback
   - Priority: P2
   - Target: Backlog

### Re-Review Needed?

Re-review after critical fixes — request changes, then re-review. Estimated fix effort: ~2-3 hours.

---

## Decision

**Recommendation**: Request Changes

**Rationale**:

Test quality has critical structural issues with 54/100 score. All 7 tests fail with identical `TimeoutError: locator.click: Timeout 15000ms exceeded` due to missing data seeding — the `testSession` fixture exists but is never used. Additionally, zero network synchronization creates race conditions that would cause flakiness even after data is seeded. The test structure (BDD comments, data-testid selectors, priority markers, describe organization) is excellent and provides a solid foundation. The fixes are well-scoped (add fixture + add waits) and should bring the score above 80.

> Test quality needs improvement with 54/100 score. 4 critical issues must be fixed before merge: data seeding, network sync, loop synchronization, and test isolation. The test structure is excellent — fixes are surgical, not architectural.

---

## Review Metadata

**Generated By**: BMad TEA Agent (Murat)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-scripture-solo-reading-20260204
**Timestamp**: 2026-02-04
**Version**: 1.0
