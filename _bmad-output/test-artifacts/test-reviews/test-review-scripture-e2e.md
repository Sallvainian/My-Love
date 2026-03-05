---
stepsCompleted: ['step-02-discover-tests', 'step-03a-subagent-determinism', 'step-03b-subagent-isolation', 'step-03c-subagent-maintainability', 'step-03e-subagent-performance', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-03-04'
workflowType: 'testarch-test-review'
inputDocuments: ['tests/e2e/scripture/']
---

# Test Quality Review: Scripture E2E Tests (13 files)

**Quality Score**: 80/100 (B - Good)
**Review Date**: 2026-03-04
**Review Scope**: directory (tests/e2e/scripture/)
**Reviewer**: TEA Agent (Test Architect)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

**Special Focus**: playwright-utils v3.14.0 adoption gaps. All 13 test files were written BEFORE the `@seontechnologies/playwright-utils` integration and use raw Playwright APIs instead of the provided fixtures (`interceptNetworkCall`, `recurse`, `log`, `networkErrorMonitor`, `apiRequest`).

---

## Executive Summary

**Overall Assessment**: Good

**Recommendation**: Approve with Comments

### Key Strengths

- Excellent BDD structure (Given/When/Then) consistently applied across all 13 files
- Strong test isolation with try/finally cleanup, supabaseAdmin cleanup calls, and session ID tracking
- Network-first pattern correctly used (waitForResponse before click) in critical paths
- Comprehensive test IDs and priority markers (P0/P1/P2) in all files
- Good use of data-testid selectors throughout (zero CSS class-based selectors)

### Key Weaknesses

- Systematic playwright-utils adoption gap: 0/13 files use `interceptNetworkCall` fixture (all use raw `page.waitForResponse()` or `page.route()`)
- 0/13 files use `recurse` fixture for polling (use `expect.poll()` instead)
- 0/13 files use `log` fixture for debugging output
- `networkErrorMonitor` is configured in merged-fixtures but has no explicit assertions in tests
- 3 files exceed 300-line threshold; 2 helpers are copy-pasted across specs
- `scripture-session.spec.ts` destructures `interceptNetworkCall` in function signatures but DOES NOT use it (dead parameter)

### Summary

The scripture E2E test suite is well-structured with strong BDD patterns, proper isolation, and comprehensive acceptance criteria coverage. However, the entire suite predates the playwright-utils integration and uses raw Playwright APIs exclusively. The most impactful improvement would be adopting `interceptNetworkCall` across all files that use `page.waitForResponse()` or `page.route()` — this affects 11 of 13 files and would improve readability, type safety, and diagnostic output. The maintainability dimension scored lowest (62/100) due to file length violations and duplicated helpers.

---

## Quality Criteria Assessment

| Criterion                            | Status    | Violations | Notes |
| ------------------------------------ | --------- | ---------- | ----- |
| BDD Format (Given-When-Then)         | PASS      | 0          | All tests use clear GIVEN/WHEN/THEN structure with comments |
| Test IDs                             | PASS      | 0          | All files have test IDs (P0-xxx, 4.2-E2E-xxx, etc.) in describe blocks |
| Priority Markers (P0/P1/P2/P3)      | PASS      | 0          | All tests marked with priority in test names |
| Hard Waits (sleep, waitForTimeout)   | WARN      | 1          | scripture-accessibility.spec.ts:173 uses waitForTimeout(300) |
| Determinism (no conditionals)        | WARN      | 4          | Date.now() in mocked responses, non-fixed timestamps |
| Isolation (cleanup, no shared state) | PASS      | 1          | Serial mode in 4.2 spec; otherwise excellent cleanup patterns |
| Fixture Patterns                     | WARN      | 13         | No files use interceptNetworkCall; dead parameter in session spec |
| Data Factories                       | PASS      | 0          | createTestSession/cleanupTestSession used correctly |
| Network-First Pattern                | PASS      | 0          | waitForResponse-before-click pattern correctly applied |
| Explicit Assertions                  | PASS      | 0          | Strong assertion coverage with specific text and attribute checks |
| Test Length (<=300 lines)            | WARN      | 3          | reconnect-4.3 (399), overview (367), reflection-2.2 (350) |
| Test Duration (<=1.5 min)            | WARN      | 4          | Solo full-flow (180s), reconnect tests (120s each) |
| Flakiness Patterns                   | PASS      | 0          | Proper timeouts, no race conditions detected |

**Total Violations**: 0 Critical, 3 High, 11 Medium, 3 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 x 10 = -0
High Violations:         -3 x 5 = -15
Medium Violations:       -11 x 2 = -22
Low Violations:          -3 x 1 = -3

Bonus Points:
  Excellent BDD:         +5
  Comprehensive Fixtures: +0   (playwright-utils not adopted)
  Data Factories:        +5
  Network-First:         +5
  Perfect Isolation:     +0   (serial mode prevents full credit)
  All Test IDs:          +5
                         --------
Total Bonus:             +20

Final Score:             80/100
Grade:                   B
```

---

## Dimension Scores

| Dimension       | Score  | Grade | Weight |
| --------------- | ------ | ----- | ------ |
| Determinism     | 83/100 | B     | 30%    |
| Isolation       | 88/100 | B     | 30%    |
| Maintainability | 62/100 | D     | 25%    |
| Performance     | 85/100 | B     | 15%    |

Coverage is excluded from `test-review` scoring. Use `trace` for coverage analysis.

---

## Critical Issues (Must Fix)

No critical (P0 severity) issues detected. The tests are functional and will not produce false positives or false negatives.

---

## Recommendations (Should Fix)

### 1. Adopt `interceptNetworkCall` Fixture Across All Files

**Severity**: P1 (High)
**Location**: All 11 files that use `page.waitForResponse()` or `page.route()`
**Criterion**: Fixture Patterns
**Knowledge Base**: [intercept-network-call.md](_bmad/tea/testarch/knowledge/playwright-utils/intercept-network-call.md)

**Issue Description**:
Every test file uses raw Playwright `page.waitForResponse()` with inline predicate functions or `page.route()` for network mocking. The `interceptNetworkCall` fixture from playwright-utils provides a cleaner API, better diagnostics, automatic request/response logging, and type-safe configuration.

**Current Code** (repeated in 11 files):

```typescript
// In scripture-lobby-4.1.spec.ts:53 (raw Playwright pattern)
const userASelectRole = page.waitForResponse(isSelectRoleResponse);
await page.getByTestId('lobby-role-reader').click();
await userASelectRole;

// In scripture-overview.spec.ts:147 (raw Playwright route mocking)
await page.route('**/rest/v1/users*', (route) => {
  const url = route.request().url();
  if (url.includes('select=partner_id')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ partner_id: null }) });
  }
  return route.continue();
});
```

**Recommended Improvement**:

```typescript
// Using interceptNetworkCall fixture
const selectRole = interceptNetworkCall({
  method: 'POST',
  url: '**/rest/v1/rpc/scripture_select_role',
});
await page.getByTestId('lobby-role-reader').click();
await selectRole;

// For mocking (using interceptNetworkCall with fulfill)
const partnerLookup = interceptNetworkCall({
  method: 'GET',
  url: '**/rest/v1/users*',
  fulfill: { status: 200, body: { partner_id: null } },
});
```

**Benefits**:
- Automatic request/response logging in Playwright report
- Type-safe configuration object instead of inline predicates
- Better error messages on timeout (shows URL pattern, not generic timeout)
- Consistent API across all test files

**Affected Files** (11 of 13):
- `scripture-lobby-4.1.spec.ts` — lines 52, 73, 95-102, 116-120
- `scripture-lobby-4.1-p2.spec.ts` — lines 35, 41, 52-56, 62-66, 125-129, 178
- `scripture-overview.spec.ts` — lines 147-160, 187-217, 356-358
- `scripture-session.spec.ts` — lines 194-202 (route), 204-206 (dead `interceptNetworkCall` parameter)
- `scripture-solo-reading.spec.ts` — lines 26-32, 143-148
- `scripture-reflection-2.2.spec.ts` — lines 244-248, 322-326
- `scripture-reflection-2.3.spec.ts` — lines 74-78, 149-162
- `scripture-reconnect-4.3.spec.ts` — lines 126-136
- `scripture-accessibility.spec.ts` — lines 147-149 (already uses it correctly in P2-003!)
- `scripture-reading-4.2.spec.ts` — uses helpers (lockInAndWait) that wrap waitForResponse internally
- `scripture-stats.spec.ts` — no network interception needed

**Priority**: P1 — This is the single highest-impact improvement. One file (accessibility) already demonstrates correct usage. Recommend batch migration.

---

### 2. Remove Dead `interceptNetworkCall` Parameter from `scripture-session.spec.ts`

**Severity**: P1 (High)
**Location**: `tests/e2e/scripture/scripture-session.spec.ts` — lines 54, 113, 146, 167, 217
**Criterion**: Fixture Patterns

**Issue Description**:
Five test functions destructure `interceptNetworkCall` from the fixture object but never use it. These are dead parameters that mislead readers into thinking the fixture is being used.

**Current Code**:

```typescript
// scripture-session.spec.ts:54 — interceptNetworkCall destructured but unused
test('should persist step index ...', async ({ page, interceptNetworkCall }) => {
  // ... only uses page, never calls interceptNetworkCall
});
```

**Recommended Improvement**:

```typescript
// Either remove the dead parameter:
test('should persist step index ...', async ({ page }) => { ... });

// Or actually use it:
test('should persist step index ...', async ({ page, interceptNetworkCall }) => {
  const stepSaved = interceptNetworkCall({
    method: 'PATCH',
    url: '**/rest/v1/scripture_sessions*',
  });
  // ...
});
```

---

### 3. Replace `expect.poll()` with `recurse` Fixture

**Severity**: P2 (Medium)
**Location**: `scripture-overview.spec.ts:331-344`, `scripture-reflection-2.3.spec.ts:51-55,92-96,106-117,128-139`
**Criterion**: Fixture Patterns
**Knowledge Base**: [recurse.md](_bmad/tea/testarch/knowledge/playwright-utils/recurse.md)

**Issue Description**:
Several tests use `expect.poll()` for asynchronous assertions (DB state verification, focus checks). The `recurse` fixture provides a more readable API with built-in retry logging.

**Current Code**:

```typescript
// scripture-overview.spec.ts:331
await expect.poll(async () => {
  const { data } = await supabaseAdmin.from('scripture_sessions').select('status').eq('id', sessionId).single();
  return data?.status ?? null;
}, { timeout: 15_000 }).toBe('abandoned');
```

**Recommended Improvement**:

```typescript
// Using recurse fixture
await recurse(async () => {
  const { data } = await supabaseAdmin.from('scripture_sessions').select('status').eq('id', sessionId).single();
  expect(data?.status).toBe('abandoned');
}, { timeout: 15_000 });
```

**Priority**: P2 — `expect.poll()` works correctly; `recurse` adds diagnostic logging but is not a functional improvement.

---

### 4. Extract Duplicate Helpers to Support Directory

**Severity**: P2 (Medium)
**Location**: Multiple files
**Criterion**: Maintainability

**Issue Description**:
Three helpers are duplicated or defined inline when they should be shared:

1. **`clearClientScriptureCache`** — identical 28-line function in both `scripture-overview.spec.ts:38` and `scripture-session.spec.ts:17`
2. **`createPartnerContext`** — inline in `scripture-reconnect-4.3.spec.ts:39` (21 lines), could be reused
3. **`createUserClient`** — inline in `scripture-rls-security.spec.ts:21` (33 lines), could serve other security tests

**Recommended Fix**:
- Extract `clearClientScriptureCache` to `tests/support/helpers/scripture-cache.ts`
- Move `createPartnerContext` to `tests/support/helpers/scripture-together.ts`
- Move `createUserClient` to `tests/support/helpers/rls-client.ts`

---

### 5. Add `log` Fixture for Debugging Output

**Severity**: P3 (Low)
**Location**: All 13 files
**Criterion**: Fixture Patterns
**Knowledge Base**: [log.md](_bmad/tea/testarch/knowledge/playwright-utils/log.md)

**Issue Description**:
No test files use the `log` fixture for structured debugging output. Currently, one file uses `console.warn` (scripture-solo-reading.spec.ts:45). The `log` fixture integrates with Playwright's HTML report.

**Current Code**:

```typescript
// scripture-solo-reading.spec.ts:45
console.warn('[scripture-solo-reading] Step transition relied on UI-ready signal; ...');
```

**Recommended Improvement**:

```typescript
// Using log fixture
log.warn('[scripture-solo-reading] Step transition relied on UI-ready signal; ...');
```

**Priority**: P3 — Nice-to-have improvement. `console.warn` works but `log` provides better integration with the test report.

---

## Best Practices Found

### 1. Excellent Network-First Pattern

**Location**: `scripture-lobby-4.1.spec.ts:95-102`
**Pattern**: intercept-before-click
**Knowledge Base**: [intercept-network-call.md](_bmad/tea/testarch/knowledge/playwright-utils/intercept-network-call.md)

**Why This Is Good**:
The waitForResponse promise is created BEFORE the click that triggers the request. This prevents race conditions where the response arrives before the wait is registered.

**Code Example**:

```typescript
// Network-first: watch for ready state RPC before clicking
const userAReadyBroadcast = page
  .waitForResponse(isToggleReadyResponse, { timeout: READY_BROADCAST_TIMEOUT_MS })
  .catch((e: Error) => {
    throw new Error(`scripture_toggle_ready RPC (User A) did not fire: ${e.message}`);
  });
await page.getByTestId('lobby-ready-button').click();
await userAReadyBroadcast;
```

**Use as Reference**: Apply this pattern when migrating to `interceptNetworkCall`.

---

### 2. Comprehensive Cleanup with Session ID Tracking

**Location**: `scripture-reconnect-4.3.spec.ts:74,88`
**Pattern**: Set-based session tracking + try/finally cleanup

**Why This Is Good**:
Tests track all created session IDs in a Set, including dynamically created ones, and clean them all up in the finally block — even if the test fails.

**Code Example**:

```typescript
const sessionIdsToClean = new Set<string>();
sessionIdsToClean.add(primarySessionId);
// ... dynamically add more IDs
try {
  // ... test logic
} finally {
  await partner.context.close().catch(() => {});
  await cleanupTestSession(supabaseAdmin, [...sessionIdsToClean]);
}
```

---

### 3. Correct `interceptNetworkCall` Usage (Single File)

**Location**: `scripture-accessibility.spec.ts:147-153`
**Pattern**: interceptNetworkCall with method + URL

**Why This Is Good**:
This is the ONLY file in the suite that correctly uses the `interceptNetworkCall` fixture. It demonstrates the target pattern for migration.

**Code Example**:

```typescript
const stepAdvance = interceptNetworkCall({
  method: 'PATCH',
  url: '**/rest/v1/scripture_sessions*',
});
await page.getByTestId('scripture-next-verse-button').click();
await stepAdvance;
```

**Use as Reference**: This is the pattern that all other files should adopt.

---

## Test File Analysis

### File Metadata

| File | Lines | Describe Blocks | Test Cases | Priority | Key Fixtures Used |
| ---- | ----- | --------------- | ---------- | -------- | ----------------- |
| scripture-accessibility.spec.ts | 279 | 7 | 9 | P2 | interceptNetworkCall (correctly!) |
| scripture-lobby-4.1.spec.ts | 221 | 2 | 2 | P0, P1 | togetherMode |
| scripture-lobby-4.1-p2.spec.ts | 205 | 3 | 3 | P2 | togetherMode |
| scripture-overview.spec.ts | 367 | 6 | 6 | P1 | supabaseAdmin |
| scripture-reading-4.2.spec.ts | 279 | 5 | 5 | P0, P1 | togetherMode, supabaseAdmin |
| scripture-reconnect-4.3.spec.ts | 399 | 3 | 3 | P0, P1 | supabaseAdmin, browser |
| scripture-reflection-2.2.spec.ts | 350 | 4 | 4 | P0, P1, P2 | supabaseAdmin |
| scripture-reflection-2.3.spec.ts | 306 | 5 | 5 | P0, P1, P2 | supabaseAdmin, testSession |
| scripture-rls-security.spec.ts | 369 | 7 | 8 | P0 | supabaseAdmin, testSession |
| scripture-seeding.spec.ts | 44 | 1 | 3 | P0 | testSession |
| scripture-session.spec.ts | 248 | 5 | 6 | P0, P1, P2 | interceptNetworkCall (DEAD) |
| scripture-solo-reading.spec.ts | 270 | 5 | 6 | P0, P1, P2 | - |
| scripture-stats.spec.ts | 64 | 1 | 1 | P0 | scriptureNav |

**Test Framework**: Playwright
**Language**: TypeScript
**Total Tests**: 61

### Priority Distribution

- P0 (Critical): 19 tests
- P1 (High): 18 tests
- P2 (Medium): 24 tests

---

## Context and Integration

### Related Artifacts

- **Story Files**: Epic 1 (1.1-1.5), Epic 2 (2.2, 2.3), Epic 3 (3.1), Epic 4 (4.1, 4.2, 4.3)
- **Test Design**: `_bmad-output/test-artifacts/test-design-epic-3.md`, `test-design-epic-4.md`
- **ATDD Checklists**: `atdd-checklist-4.1.md`, `atdd-checklist-4.2.md`, `atdd-checklist-4.3.md`

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../tea/testarch/knowledge/test-quality.md)** - Definition of Done for tests
- **[data-factories.md](../../../tea/testarch/knowledge/data-factories.md)** - Factory functions with overrides
- **[test-levels-framework.md](../../../tea/testarch/knowledge/test-levels-framework.md)** - E2E vs API appropriateness
- **[selective-testing.md](../../../tea/testarch/knowledge/selective-testing.md)** - Duplicate coverage detection
- **[test-healing-patterns.md](../../../tea/testarch/knowledge/test-healing-patterns.md)** - Self-healing patterns
- **[selector-resilience.md](../../../tea/testarch/knowledge/selector-resilience.md)** - Selector best practices
- **[timing-debugging.md](../../../tea/testarch/knowledge/timing-debugging.md)** - Timing and debugging patterns
- **[intercept-network-call.md](../../../tea/testarch/knowledge/playwright-utils/intercept-network-call.md)** - interceptNetworkCall fixture
- **[recurse.md](../../../tea/testarch/knowledge/playwright-utils/recurse.md)** - Polling fixture
- **[log.md](../../../tea/testarch/knowledge/playwright-utils/log.md)** - Logging fixture
- **[api-request.md](../../../tea/testarch/knowledge/playwright-utils/api-request.md)** - API request fixture
- **[network-error-monitor.md](../../../tea/testarch/knowledge/playwright-utils/network-error-monitor.md)** - Network error monitoring
- **[fixtures-composition.md](../../../tea/testarch/knowledge/playwright-utils/fixtures-composition.md)** - Fixture composition
- **[auth-session.md](../../../tea/testarch/knowledge/playwright-utils/auth-session.md)** - Auth session management

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Remove dead `interceptNetworkCall` parameters from `scripture-session.spec.ts`** — 5 test functions have unused fixture parameters
   - Priority: P1
   - Estimated Effort: 5 minutes

2. **Extract `clearClientScriptureCache` to shared helper** — eliminates 28-line copy-paste
   - Priority: P2
   - Estimated Effort: 15 minutes

### Follow-up Actions (Future PRs)

1. **Migrate all `page.waitForResponse()` calls to `interceptNetworkCall`** — 11 files, ~40 call sites
   - Priority: P1
   - Target: Next sprint
   - Reference: Use `scripture-accessibility.spec.ts:147-153` as the model

2. **Migrate `page.route()` mocking to `interceptNetworkCall` fulfill pattern** — 3 files (overview, session, reflection-2.3)
   - Priority: P1
   - Target: Next sprint

3. **Split long test files** (reconnect-4.3 at 399 lines, overview at 367 lines)
   - Priority: P2
   - Target: Backlog

4. **Replace `expect.poll()` with `recurse` fixture** — 4 call sites across 2 files
   - Priority: P2
   - Target: Backlog

5. **Add `log` fixture usage for structured debugging** — replace console.warn in solo-reading spec
   - Priority: P3
   - Target: Backlog

### Re-Review Needed?

No re-review needed for current merge. Recommend re-review after `interceptNetworkCall` migration PR.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:
Test quality is good with 80/100 score. The test suite demonstrates strong BDD patterns, proper isolation, comprehensive priority coverage, and correct network-first patterns. No tests are broken or produce false results. The primary gap is the systematic non-adoption of playwright-utils fixtures — particularly `interceptNetworkCall` which would improve readability and diagnostics across 11 files. This gap does not block functionality but should be addressed in a follow-up PR. The one file that already uses `interceptNetworkCall` correctly (`scripture-accessibility.spec.ts`) provides a clear migration reference.

---

## Appendix

### Violation Summary by Location

| File | Severity | Criterion | Issue | Fix |
| ---- | -------- | --------- | ----- | --- |
| scripture-session.spec.ts:54 | P1 | Fixture Patterns | Dead interceptNetworkCall parameter | Remove unused destructuring |
| scripture-overview.spec.ts:38 | P2 | Maintainability | Duplicate clearClientScriptureCache | Extract to shared helper |
| scripture-session.spec.ts:17 | P2 | Maintainability | Duplicate clearClientScriptureCache | Extract to shared helper |
| scripture-reconnect-4.3.spec.ts | P2 | Maintainability | 399 lines (exceeds 300) | Split per test case |
| scripture-overview.spec.ts | P2 | Maintainability | 367 lines (exceeds 300) | Extract helpers |
| scripture-reflection-2.2.spec.ts | P2 | Maintainability | 350 lines (exceeds 300) | Monitor or split |
| scripture-reading-4.2.spec.ts:29 | P2 | Performance | Serial mode | Document justification |
| scripture-accessibility.spec.ts:173 | P2 | Determinism | waitForTimeout(300) | Replace with assertion |
| scripture-overview.spec.ts:157 | P3 | Determinism | new Date() in mock | Use fixed timestamp |
| scripture-rls-security.spec.ts:88 | P3 | Determinism | Date.now() in email | Use counter |

### playwright-utils Adoption Matrix

| Fixture | Files Using | Files That Should Use | Gap |
| ------- | ----------- | --------------------- | --- |
| interceptNetworkCall | 1 (accessibility) | 11 | 10 files |
| recurse | 0 | 2 (overview, reflection-2.3) | 2 files |
| log | 0 | 1+ (solo-reading) | 1+ files |
| networkErrorMonitor | Auto (merged-fixtures) | Auto | N/A (auto-applied) |
| apiRequest | 0 | 0 (tests use supabaseAdmin) | N/A |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v4.0
**Review ID**: test-review-scripture-e2e-20260304
**Timestamp**: 2026-03-04
**Version**: 1.0
