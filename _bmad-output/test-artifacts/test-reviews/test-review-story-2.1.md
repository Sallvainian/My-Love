# Test Quality Review: Story 2.1 - Per-Step Reflection System

**Quality Score**: 71/100 (C - Acceptable quality with notable improvement areas)
**Review Date**: 2026-02-04
**Review Scope**: suite (2 test files: API + E2E)
**Reviewer**: TEA Workflow (automated)

---

Note: This review audits existing tests; it does not generate tests.

## Executive Summary

**Overall Assessment**: Acceptable

**Recommendation**: Request Changes

### Key Strengths

- E2E tests demonstrate excellent determinism with hardcoded test data, stable selectors, and network-first patterns (zero determinism violations)
- Test isolation in API tests is strong: each test creates its own session, user client, and cleans up via try/finally
- Performance profile is excellent: no hard waits, no waitForTimeout calls, reasonable test lengths, and efficient network-first patterns
- Explicit assertions throughout both files with proper use of toEqual, toContain, toBeVisible, and toBeTruthy
- Network-first pattern correctly applied in E2E tests: waitForResponse set up before triggering click actions

### Key Weaknesses

- API test helpers use Math.random() and Date.now() for test data generation, creating non-deterministic tests that may produce flaky failures
- Significant code duplication: session setup block copy-pasted 3x in API tests, navigation sequence copy-pasted 6x in E2E tests
- Hardcoded test password 'test-password-123' creates a silent coordination risk with test factories
- IndexedDB cache verification completely missing despite being explicitly required by acceptance criteria AC1 and AC3
- P1-priority bookmark debounce unit test (2.1-UNIT-001) not implemented

### Summary

The Story 2.1 test suite achieves acceptable quality with strong isolation and performance characteristics. The E2E tests are well-crafted with deterministic data, proper network-first patterns, and stable selectors. However, the API tests suffer from non-deterministic test data generation (Math.random, Date.now) that could produce intermittent failures, and both files have significant maintainability concerns from copy-pasted setup blocks. Coverage gaps exist for AC-specified IndexedDB caching behavior and a planned P1 debounce unit test. These issues require changes before merge to prevent flakiness risks and ensure acceptance criteria are fully verified.

---

## Quality Dimension Scores

| Dimension | Score | Grade | Weight | Weighted |
|---|---|---|---|---|
| Determinism | 50/100 | F | 25% | 12.50 |
| Isolation | 95/100 | A | 25% | 23.75 |
| Maintainability | 50/100 | F | 20% | 10.00 |
| Coverage | 72/100 | C | 15% | 10.80 |
| Performance | 94/100 | A | 15% | 14.10 |
| **Overall** | **71/100** | **C** | **100%** | **71.15** |

---

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
|---|---|---|---|
| Hard Waits (sleep, waitForTimeout) | PASS | 0 | No hard waits in either file |
| Determinism (no random/time) | FAIL | 3 | Math.random() and Date.now() in API test helpers |
| Isolation (cleanup, no shared state) | WARN | 1 | E2E tests 003-006 lack cleanup for UI-created records |
| Fixture Patterns | WARN | 1 | API tests use try/finally instead of Playwright fixtures |
| Data Factories | WARN | 1 | Hardcoded password, non-deterministic helpers |
| Network-First Pattern | PASS | 0 | Correctly applied in all E2E network interactions |
| Explicit Assertions | PASS | 0 | Strong assertions throughout both files |
| Test Length (<=300 lines) | WARN | 1 | E2E file at 361 lines exceeds 300-line threshold |
| Test Duration (<=1.5 min) | PASS | 0 | No complexity concerns for duration |
| Flakiness Patterns | FAIL | 3 | Math.random() in API tests creates flakiness risk |
| Maintainability | FAIL | 7 | Duplicate code blocks, magic values, hardcoded password |
| Coverage | WARN | 8 | Missing IndexedDB verification, planned tests not implemented |
| Performance | PASS | 3 | Minor: parallel mode not configured, but no impact on correctness |

**Total Violations**: 0 Critical, 6 High, 7 Medium, 9 Low (22 total)

---

## Critical Issues (Must Fix)

### 1. Non-Deterministic Test Data: Math.random() in generateRating()

**Severity**: P0 (Critical)
**Location**: `tests/api/scripture-reflection-api.spec.ts:56`
**Criterion**: Determinism
**Violation ID**: DET-003

**Issue Description**:
generateRating() uses Math.random() to produce a random rating value 1-5 for test input. If the system under test has rating-value-specific bugs (e.g., a boundary error at rating 1 or 5), this test would pass or fail non-deterministically depending on which rating is generated. This is the most concerning determinism violation because it directly affects the assertion path.

**Current Code**:

```typescript
// Bad (current implementation)
function generateRating(): number {
  return Math.floor(Math.random() * 5) + 1;
}
```

**Recommended Fix**:

```typescript
// Good (recommended approach)
const TEST_RATING = 4;

// Or for boundary coverage, use parameterized tests:
[1, 2, 3, 4, 5].forEach((rating) => {
  test(`reflection with rating ${rating}`, async () => {
    // test body using explicit rating value
  });
});
```

**Why This Matters**:
Non-deterministic test inputs mean failures cannot be reliably reproduced. A test that passes 80% of the time because it randomly avoids the buggy rating value will mask real defects and erode CI confidence.

**Related Violations**: DET-001 (line 49), DET-002 (line 50) - same pattern in generateReflectionNote()

---

### 2. Non-Deterministic Test Data: Date.now() and Math.random() in generateReflectionNote()

**Severity**: P0 (Critical)
**Location**: `tests/api/scripture-reflection-api.spec.ts:49-50`
**Criterion**: Determinism
**Violation IDs**: DET-001, DET-002

**Issue Description**:
generateReflectionNote() uses both Date.now() and Math.random() to create note strings. While these are used for uniqueness rather than time-sensitive logic, the test data differs between every run, making failure reproduction difficult and snapshot-based debugging impossible.

**Current Code**:

```typescript
// Bad (current implementation)
function generateReflectionNote(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `Test reflection note ${timestamp}-${random}`;
}
```

**Recommended Fix**:

```typescript
// Good (recommended approach) - deterministic with uniqueness via test ID
function generateReflectionNote(testId: string, index: number = 0): string {
  return `Test reflection note ${testId}-${index}`;
}

// Or follow the E2E test pattern (simplest):
const TEST_NOTE = 'This step gave me a new perspective on the passage.';
```

**Why This Matters**:
The E2E test file already demonstrates the correct pattern with hardcoded test data. Following that established pattern would achieve both determinism and clarity.

---

### 3. Duplicate Session Setup Block (3x Copy-Paste)

**Severity**: P1 (High)
**Location**: `tests/api/scripture-reflection-api.spec.ts:69`
**Criterion**: Maintainability
**Violation ID**: MNT-001

**Issue Description**:
An identical 4-line session creation and user client setup block is copy-pasted across all 3 API tests at lines 69-74, 153-158, and 231-236. This means any change to session setup requires updating 3 locations, increasing the risk of inconsistency.

**Current Code**:

```typescript
// Bad - repeated in every test (lines 69, 153, 231)
const seedResult = await createTestSession(supabaseAdmin, { preset: 'mid_session' });
const sessionId = seedResult.session_ids[0];
const userId = seedResult.test_user1_id;
const userClient = await createUserClient(supabaseAdmin, userId);
```

**Recommended Fix**:

```typescript
// Good - extract to beforeEach or Playwright fixture
let seedResult: TestSessionResult;
let sessionId: string;
let userId: string;
let userClient: SupabaseClient;

test.beforeEach(async () => {
  seedResult = await createTestSession(supabaseAdmin, { preset: 'mid_session' });
  sessionId = seedResult.session_ids[0];
  userId = seedResult.test_user1_id;
  userClient = await createUserClient(supabaseAdmin, userId);
});

test.afterEach(async () => {
  await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
});
```

**Why This Matters**:
DRY principle violation. If the session setup API changes, all 3 copies must be updated identically. The beforeEach/afterEach pattern also eliminates the try/finally blocks (MNT-004).

**Related Violations**: MNT-004 (line 82) - duplicate try/finally cleanup pattern

---

### 4. Duplicate Navigation Setup (6x Copy-Paste)

**Severity**: P1 (High)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:24`
**Criterion**: Maintainability
**Violation ID**: MNT-002

**Issue Description**:
An identical 3-line navigation sequence (goto /scripture, click start button, click solo mode) is copy-pasted across all 6 E2E tests at lines 24-26, 120-122, 203-206, 254-256, 297-299, and 330-332.

**Current Code**:

```typescript
// Bad - repeated 6 times
await page.goto('/scripture');
await page.getByTestId('scripture-start-button').click();
await page.getByTestId('scripture-mode-solo').click();
```

**Recommended Fix**:

```typescript
// Good - extract to beforeEach
test.describe('Scripture Reflection - Story 2.1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scripture');
    await page.getByTestId('scripture-start-button').click();
    await page.getByTestId('scripture-mode-solo').click();
  });

  test('2.1-E2E-001 ...', async ({ page }) => {
    // test starts already in solo mode
  });
});
```

**Why This Matters**:
6 copies means 6 places to update if the navigation flow changes. Extracting to beforeEach also reduces the E2E file length, helping it stay under the 300-line threshold.

---

### 5. Hardcoded Test Password

**Severity**: P1 (High)
**Location**: `tests/api/scripture-reflection-api.spec.ts:37`
**Criterion**: Maintainability
**Violation ID**: MNT-003

**Issue Description**:
The test password 'test-password-123' is hardcoded in the createUserClient helper. This is a coordination point with test factories -- if the factory-created user password changes, this hardcoded value silently breaks authentication in all API tests without any clear error pointing to the root cause.

**Current Code**:

```typescript
// Bad - hardcoded password
const { data } = await supabaseAdmin.auth.signInWithPassword({
  email: userEmail,
  password: 'test-password-123',
});
```

**Recommended Fix**:

```typescript
// Good - shared constant
import { TEST_USER_PASSWORD } from '../support/test-constants';

const { data } = await supabaseAdmin.auth.signInWithPassword({
  email: userEmail,
  password: TEST_USER_PASSWORD,
});
```

**Why This Matters**:
Magic strings that must match values in other files are a maintainability time bomb. A shared constant ensures a single source of truth.

---

## Recommendations (Should Fix)

### 1. Missing IndexedDB Cache Verification for Reflections

**Severity**: P1 (High)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:98`
**Criterion**: Coverage
**Violation ID**: COV-001

**Issue Description**:
AC3 explicitly requires "IndexedDB cache is updated on success" after reflection submission. Tests verify server persistence (DB rows) but no test verifies IndexedDB client-side cache update.

**Recommended Improvement**:

```typescript
// Add after reflection submission verification
const cachedReflection = await page.evaluate(async () => {
  const db = await openDB('scripture-cache');
  return db.get('reflections', sessionId);
});
expect(cachedReflection).toBeTruthy();
expect(cachedReflection.rating).toBe(4);
```

**Priority**: P1 - AC-specified behavior with zero coverage

---

### 2. Missing IndexedDB Cache Verification for Bookmarks

**Severity**: P1 (High)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:158`
**Criterion**: Coverage
**Violation ID**: COV-002

**Issue Description**:
AC1 explicitly requires bookmark "cache in IndexedDB" alongside write-through to server. Tests verify DB persistence but no test checks IndexedDB bookmark cache.

**Recommended Improvement**:

```typescript
// Add after bookmark toggle verification
const cachedBookmark = await page.evaluate(async () => {
  const db = await openDB('scripture-cache');
  return db.get('bookmarks', stepId);
});
expect(cachedBookmark).toBeTruthy();
```

**Priority**: P1 - AC-specified behavior with zero coverage

---

### 3. Missing Textarea Constraint Tests

**Severity**: P2 (Medium)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:75`
**Criterion**: Coverage
**Violation ID**: COV-003

**Issue Description**:
AC2 requires note textarea "max 200 characters, auto-grow to ~4 lines, resize-none". Tests fill the textarea but never verify character limit enforcement, auto-grow behavior, or resize CSS.

**Recommended Improvement**:

```typescript
// Test max character enforcement
const longNote = 'a'.repeat(201);
await page.getByTestId('scripture-reflection-note').fill(longNote);
const value = await page.getByTestId('scripture-reflection-note').inputValue();
expect(value.length).toBeLessThanOrEqual(200);

// Test resize-none
const resizeStyle = await page.getByTestId('scripture-reflection-note').evaluate(
  (el) => getComputedStyle(el).resize
);
expect(resizeStyle).toBe('none');
```

**Priority**: P2 - AC-specified constraint, planned as 2.1-COMP-001

---

### 4. Missing Bookmark Debounce Unit Test

**Severity**: P2 (Medium)
**Location**: `tests/` (missing file)
**Criterion**: Coverage
**Violation ID**: COV-004

**Issue Description**:
Test design planned 2.1-UNIT-001 (P1) for bookmark toggle debounce: rapid toggles should coalesce to a single server write. This mitigates risk R2-005 (score: 4). No unit test exists.

**Recommended Improvement**:

```typescript
// tests/unit/bookmark-debounce.spec.ts
test('rapid bookmark toggles coalesce to single server write', async () => {
  const mockRpc = vi.fn();
  // Toggle 5 times rapidly
  for (let i = 0; i < 5; i++) {
    toggleBookmark(sessionId, stepIndex);
  }
  // Wait for debounce window (300ms)
  await vi.advanceTimersByTimeAsync(300);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
```

**Priority**: P2 - Mitigates R2-005 risk, planned as P1 in test design

---

### 5. E2E Tests Missing Cleanup for UI-Created Sessions

**Severity**: P2 (Medium)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:199`
**Criterion**: Isolation
**Violation ID**: ISO-001

**Issue Description**:
E2E tests 003-006 create database records (scripture sessions, reflections, bookmarks) through UI flows but have no cleanup mechanism. Orphaned sessions accumulate across test runs and can pollute parallel or subsequent executions.

**Recommended Improvement**:

```typescript
// Use testSession fixture for automatic cleanup
test('2.1-E2E-003', async ({ page, testSession }) => {
  // testSession provides pre-seeded session with auto-cleanup
});

// Or add explicit afterEach cleanup
test.afterEach(async () => {
  await supabaseAdmin.from('sessions').delete().eq('created_by', testUserId);
});
```

**Priority**: P2 - Prevents test pollution in CI environments

---

### 6. Duplicate try/finally Cleanup Pattern

**Severity**: P2 (Medium)
**Location**: `tests/api/scripture-reflection-api.spec.ts:82`
**Criterion**: Maintainability
**Violation ID**: MNT-004

**Issue Description**:
Every API test wraps its body in an identical try/finally block calling cleanupTestSession. This boilerplate would be eliminated by using a Playwright fixture with auto-cleanup.

**Recommended Improvement**:

```typescript
// Good - Playwright fixture with auto-cleanup
const test = base.extend<{ testSession: TestSessionResult }>({
  testSession: async ({ supabaseAdmin }, use) => {
    const session = await createTestSession(supabaseAdmin, { preset: 'mid_session' });
    await use(session);
    await cleanupTestSession(supabaseAdmin, session.session_ids);
  },
});
```

**Priority**: P2 - Resolves MNT-001 and MNT-004 together

---

### 7. Magic Numbers: Touch Target Size and Error Color

**Severity**: P2 (Medium)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:137`
**Criterion**: Maintainability
**Violation ID**: MNT-005

**Issue Description**:
Numeric constant 48 for minimum touch target size and CSS color string 'rgb(239, 68, 68)' for error red are hardcoded without named constants.

**Recommended Improvement**:

```typescript
// Good - named constants at top of file or in shared module
const MIN_TOUCH_TARGET_PX = 48;
const ERROR_RED_CSS = 'rgb(239, 68, 68)';

expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
```

**Priority**: P2 - Improves readability and maintainability

---

### 8. Enable Parallel Mode for Test Suites

**Severity**: P3 (Low)
**Location**: `tests/api/scripture-reflection-api.spec.ts:59`, `tests/e2e/scripture/scripture-reflection.spec.ts:16`
**Criterion**: Performance
**Violation IDs**: PRF-001, PRF-002

**Issue Description**:
Both test describe blocks lack parallel mode configuration. All tests are independent with their own session/cleanup and could run concurrently.

**Recommended Improvement**:

```typescript
test.describe('Scripture Reflection API', () => {
  test.describe.configure({ mode: 'parallel' });
  // tests...
});
```

**Priority**: P3 - Optimization, no correctness impact

---

### 9. Magic Step Index Values

**Severity**: P3 (Low)
**Location**: `tests/api/scripture-reflection-api.spec.ts:76`
**Criterion**: Maintainability
**Violation ID**: MNT-006

**Issue Description**:
Step index values 2, 4, 6 used in API tests are arbitrary test data without named constants explaining their selection.

**Recommended Improvement**:

```typescript
const ARBITRARY_STEP_INDEX = 2; // Any valid step index for testing
```

**Priority**: P3 - Minor clarity improvement

---

### 10. Repeated Type Assertions

**Severity**: P3 (Low)
**Location**: `tests/api/scripture-reflection-api.spec.ts:98`
**Criterion**: Maintainability
**Violation ID**: MNT-007

**Issue Description**:
The type assertion `as Record<string, unknown>` is repeated at lines 98, 117, and 207 to handle untyped RPC return values.

**Recommended Improvement**:

```typescript
// Good - typed assertion helper
interface ReflectionResult {
  rating: number;
  note: string;
  step_index: number;
  session_id: string;
}

function assertReflectionResult(data: unknown): ReflectionResult {
  const result = data as Record<string, unknown>;
  // validate required fields
  return result as ReflectionResult;
}
```

**Priority**: P3 - Minor type safety improvement

---

### 11. Missing Character Counter Test

**Severity**: P3 (Low)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:75`
**Criterion**: Coverage
**Violation ID**: COV-005

**Issue Description**:
AC2 specifies "character counter appears at 200+ characters (muted style)". No test verifies character counter visibility or styling.

**Priority**: P3 - Planned as 2.1-COMP-001 (P2)

---

### 12. Missing Step 17 Boundary Test

**Severity**: P3 (Low)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:96`
**Criterion**: Coverage
**Violation ID**: COV-006

**Issue Description**:
AC3 says session advances "to the next step (or to end-of-session if step 17)". Only step 1-to-2 transition is verified. No test covers the step 17 boundary.

**Priority**: P3 - Boundary case, may be covered by Story 2.2 tests

---

### 13. Missing Keyboard Navigation Test

**Severity**: P3 (Low)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts`
**Criterion**: Coverage
**Violation ID**: COV-007

**Issue Description**:
Test design planned 2.1-E2E-007 (P3) for full keyboard navigation through 1-5 rating scale. Not implemented.

**Priority**: P3 - Accessibility enhancement

---

### 14. Missing Performance Benchmark Test

**Severity**: P3 (Low)
**Location**: `tests/api/scripture-reflection-api.spec.ts`
**Criterion**: Coverage
**Violation ID**: COV-008

**Issue Description**:
Test design planned 2.1-PERF-001 (P3) for reflection summary query completing in <500ms with 17 steps. Not implemented.

**Priority**: P3 - Performance regression detection

---

### 15. Repeated E2E Navigation Overhead

**Severity**: P3 (Low)
**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:24`
**Criterion**: Performance
**Violation ID**: PRF-003

**Issue Description**:
Identical 3-step navigation sequence (goto /scripture, click start, click solo) repeated across all 6 E2E tests. Extracting to a beforeEach or custom fixture would reduce per-test navigation overhead.

**Priority**: P3 - Would also fix MNT-002

---

## Best Practices Found

### 1. Excellent Network-First Pattern in E2E Tests

**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:84-90`
**Pattern**: Network-First (waitForResponse before action)

**Why This Is Good**:
The E2E tests consistently set up waitForResponse promises before triggering click actions. This eliminates race conditions where the network request could complete before the listener is attached.

**Code Example**:

```typescript
// Excellent pattern - waitForResponse set up BEFORE the click
const responsePromise = page.waitForResponse(
  (response) => response.url().includes('/rest/v1/rpc/upsert_reflection')
);
await page.getByTestId('scripture-reflection-submit').click();
const response = await responsePromise;
expect(response.status()).toBe(200);
```

**Use as Reference**: Apply this pattern to all future E2E tests that verify network interactions.

---

### 2. Deterministic Test Data in E2E Tests

**Location**: `tests/e2e/scripture/scripture-reflection.spec.ts:75-78`
**Pattern**: Hardcoded test data for reproducibility

**Why This Is Good**:
The E2E tests use fixed, hardcoded values (rating 4, literal note strings) rather than random generation. This ensures every test run exercises the same code path, making failures 100% reproducible.

**Code Example**:

```typescript
// Excellent pattern - deterministic test data
await page.getByTestId('scripture-reflection-rating-4').click();
await page.getByTestId('scripture-reflection-note').fill(
  'This step gave me a new perspective on the passage.'
);
```

**Use as Reference**: The API tests should follow this same pattern instead of using Math.random().

---

### 3. Proper Test Isolation with Session Cleanup in API Tests

**Location**: `tests/api/scripture-reflection-api.spec.ts:82-141`
**Pattern**: try/finally cleanup

**Why This Is Good**:
Each API test creates its own session and ensures cleanup in a finally block, preventing test pollution. While a Playwright fixture would be cleaner (see MNT-004), the intent and isolation are correct.

**Code Example**:

```typescript
// Good isolation intent (though fixture pattern is preferred)
const seedResult = await createTestSession(supabaseAdmin, { preset: 'mid_session' });
try {
  // test body
} finally {
  await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
}
```

---

## Test File Analysis

### File 1: API Tests

- **File Path**: `tests/api/scripture-reflection-api.spec.ts`
- **File Size**: 299 lines
- **Test Framework**: Playwright
- **Language**: TypeScript
- **Describe Blocks**: 4
- **Test Cases**: 3
- **Average Test Length**: ~75 lines per test
- **Fixtures Used**: supabaseAdmin (shared)
- **Data Factories Used**: createTestSession, createUserClient, generateReflectionNote, generateRating

### File 2: E2E Tests

- **File Path**: `tests/e2e/scripture/scripture-reflection.spec.ts`
- **File Size**: 361 lines (exceeds 300-line threshold)
- **Test Framework**: Playwright
- **Language**: TypeScript
- **Describe Blocks**: 7
- **Test Cases**: 6
- **Average Test Length**: ~50 lines per test
- **Fixtures Used**: page (Playwright built-in)
- **Data Factories Used**: None (hardcoded data -- good for determinism)

---

## Context and Integration

### Related Artifacts

- **Story**: Story 2.1 - Per-Step Reflection System
- **Test Design**: Per test ID naming convention (2.1-API-xxx, 2.1-E2E-xxx)

### Coverage Gaps vs Acceptance Criteria

| AC Behavior | Test Coverage | Status | Notes |
|---|---|---|---|
| AC1: Bookmark toggle + server write | 2.1-E2E-002, 2.1-API-003 | PARTIAL | Server write verified, IndexedDB cache NOT verified |
| AC2: 1-5 rating scale | 2.1-E2E-001, 2.1-API-001 | PASS | Rating selection and persistence verified |
| AC2: Note textarea (max 200, auto-grow) | 2.1-E2E-001 | PARTIAL | Fill verified, constraints NOT verified |
| AC2: Character counter at 200+ chars | None | MISSING | Planned as 2.1-COMP-001 |
| AC3: Reflection submission + advance | 2.1-E2E-001, 2.1-API-001 | PASS | Server persistence and step advance verified |
| AC3: IndexedDB cache update | None | MISSING | AC-specified, zero coverage |
| AC3: Idempotent upsert | 2.1-API-001 | PASS | Second submission updates, not duplicates |
| AC3: Step 17 end-of-session | None | MISSING | Boundary case, may be Story 2.2 |
| Error handling (optimistic UI) | 2.1-E2E-005, 2.1-E2E-006 | PASS | Network error and error state verified |
| Touch targets (48px minimum) | 2.1-E2E-004 | PASS | Bounding box assertions verified |

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../testarch/knowledge/test-quality.md)** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[fixture-architecture.md](../../../testarch/knowledge/fixture-architecture.md)** - Pure function -> Fixture -> mergeTests pattern
- **[network-first.md](../../../testarch/knowledge/network-first.md)** - Route intercept before navigate (race condition prevention)
- **[data-factories.md](../../../testarch/knowledge/data-factories.md)** - Factory functions with overrides, API-first setup
- **[test-levels-framework.md](../../../testarch/knowledge/test-levels-framework.md)** - E2E vs API vs Component vs Unit appropriateness
- **[tdd-cycles.md](../../../testarch/knowledge/tdd-cycles.md)** - Red-Green-Refactor patterns
- **[selective-testing.md](../../../testarch/knowledge/selective-testing.md)** - Duplicate coverage detection
- **[ci-burn-in.md](../../../testarch/knowledge/ci-burn-in.md)** - Flakiness detection patterns (10-iteration loop)
- **[test-priorities.md](../../../testarch/knowledge/test-priorities.md)** - P0/P1/P2/P3 classification framework
- **[traceability.md](../../../testarch/knowledge/traceability.md)** - Requirements-to-tests mapping

See [testarch-index.csv](../../../testarch/testarch-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Replace Math.random()/Date.now() with deterministic data** - DET-001, DET-002, DET-003
   - Priority: P0
   - Owner: Developer
   - Estimated Effort: 15 minutes

2. **Extract duplicate setup to beforeEach/fixtures** - MNT-001, MNT-002, MNT-004
   - Priority: P1
   - Owner: Developer
   - Estimated Effort: 30 minutes

3. **Replace hardcoded password with shared constant** - MNT-003
   - Priority: P1
   - Owner: Developer
   - Estimated Effort: 10 minutes

### Follow-up Actions (Future PRs)

1. **Add IndexedDB cache verification** - COV-001, COV-002
   - Priority: P1
   - Target: Next sprint

2. **Implement bookmark debounce unit test** - COV-004
   - Priority: P2
   - Target: Next sprint

3. **Add textarea constraint tests** - COV-003, COV-005
   - Priority: P2
   - Target: Next sprint

4. **Add E2E test cleanup mechanisms** - ISO-001
   - Priority: P2
   - Target: Next sprint

5. **Enable parallel test execution** - PRF-001, PRF-002
   - Priority: P3
   - Target: Backlog

### Re-Review Needed?

Re-review after critical fixes - request changes on determinism violations and major maintainability issues, then re-review.

---

## Decision

**Recommendation**: Request Changes

**Rationale**:

Test quality is acceptable at 71/100 but has critical determinism issues that pose flakiness risks in CI. The Math.random() usage in API test helpers (DET-001, DET-002, DET-003) means test failures may not be reproducible, which undermines the entire purpose of automated testing. Additionally, the significant code duplication (session setup 3x, navigation 6x) creates maintenance burden that will compound as the test suite grows.

The E2E tests demonstrate excellent patterns that the API tests should follow. After fixing the 3 determinism violations and extracting the duplicate setup blocks, the score would improve significantly. The coverage gaps (IndexedDB cache, debounce unit test) can be addressed in follow-up PRs since the core happy-path and error scenarios are well-covered.

> Test quality needs improvement with 71/100 score. Critical determinism issues must be fixed before merge. 6 high-severity violations detected that pose flakiness and maintainability risks. Recommend fixing DET-001/002/003 and MNT-001/002/003 before merge.

---

## Appendix

### Violation Summary by Location

#### tests/api/scripture-reflection-api.spec.ts

| Line | ID | Severity | Dimension | Issue | Fix |
|---|---|---|---|---|---|
| 37 | MNT-003 | HIGH | Maintainability | Hardcoded test password | Shared constant |
| 49 | DET-001 | HIGH | Determinism | Date.now() in helper | Deterministic factory |
| 50 | DET-002 | HIGH | Determinism | Math.random() in helper | Deterministic factory |
| 56 | DET-003 | HIGH | Determinism | Math.random() in generateRating | Fixed value or parameterized |
| 59 | PRF-001 | LOW | Performance | No parallel mode config | Add configure({ mode: 'parallel' }) |
| 69 | MNT-001 | HIGH | Maintainability | Duplicate session setup (3x) | beforeEach or fixture |
| 76 | MNT-006 | LOW | Maintainability | Magic step index values | Named constant |
| 82 | MNT-004 | MEDIUM | Maintainability | Duplicate try/finally (3x) | Playwright fixture |
| 98 | MNT-007 | LOW | Maintainability | Repeated type assertions | Typed helper |
| -- | COV-008 | LOW | Coverage | Missing perf benchmark test | Add 2.1-PERF-001 |

#### tests/e2e/scripture/scripture-reflection.spec.ts

| Line | ID | Severity | Dimension | Issue | Fix |
|---|---|---|---|---|---|
| 16 | PRF-002 | LOW | Performance | No parallel mode config | Add configure({ mode: 'parallel' }) |
| 24 | MNT-002 | HIGH | Maintainability | Duplicate navigation (6x) | beforeEach or helper |
| 24 | PRF-003 | LOW | Performance | Repeated navigation overhead | Extract to beforeEach |
| 75 | COV-003 | MEDIUM | Coverage | No textarea constraint tests | Add max-length/resize tests |
| 75 | COV-005 | LOW | Coverage | No character counter test | Add 2.1-COMP-001 |
| 96 | COV-006 | LOW | Coverage | No step 17 boundary test | Add end-of-session test |
| 98 | COV-001 | MEDIUM | Coverage | No IndexedDB cache check (reflection) | page.evaluate() assertion |
| 137 | MNT-005 | MEDIUM | Maintainability | Magic numbers (48px, color) | Named constants |
| 158 | COV-002 | MEDIUM | Coverage | No IndexedDB cache check (bookmark) | page.evaluate() assertion |
| 199 | ISO-001 | MEDIUM | Isolation | E2E tests 003-006 no cleanup | testSession fixture |
| -- | COV-007 | LOW | Coverage | Missing keyboard nav test | Add 2.1-E2E-007 |

#### Missing Files

| ID | Severity | Dimension | Issue | Fix |
|---|---|---|---|---|
| COV-004 | MEDIUM | Coverage | Missing bookmark debounce unit test | Create tests/unit/bookmark-debounce.spec.ts |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v4.0 (parallel execution)
**Review ID**: test-review-story-2.1-20260204
**Timestamp**: 2026-02-04
**Version**: 1.0
**Execution Mode**: Parallel (5 quality dimensions evaluated concurrently)

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `testarch/knowledge/`
2. Consult testarch-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters - if a pattern is justified, document it with a comment.
