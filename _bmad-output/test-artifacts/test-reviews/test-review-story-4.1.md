---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-02-20'
---

# Test Quality Review: scripture-lobby-4.1.spec.ts

**Quality Score**: 59/100 (F - Critical Issues)
**Review Date**: 2026-02-20
**Review Scope**: single
**Reviewer**: TEA Agent (Sallvain)

---

> Note: This review audits existing tests; it does not generate tests.
> **Context**: This file is a RED PHASE test — the feature is not yet implemented. However, the structural quality issues identified here are real and must be fixed before the feature lands.

---

## Executive Summary

**Overall Assessment**: Critical Issues

**Recommendation**: Block

### Key Strengths

✅ Network-first pattern applied consistently — `waitForResponse` set up before all click actions
✅ Factory functions with proper `try/finally` cleanup (`createTestSession` + `cleanupTestSession`)
✅ Test IDs and priority markers present and accurate (`4.1-E2E-001 (P0)`, `4.1-E2E-002 (P1)`)
✅ Excellent performance profile — no hard waits anywhere, appropriate timeouts for multi-user realtime flow
✅ BDD Given/When/Then inline comments throughout both tests

### Key Weaknesses

❌ **[CRITICAL]** Partner browser context authenticates as the SAME user as User A — multi-user ACs 3/4/5 are not actually tested
❌ **[CRITICAL]** Countdown digit `'3'` assertion is a guaranteed race condition — runs after an indeterminate delay
❌ **[HIGH]** 4× `.catch(() => null)` silences all RPC network failures — test continues undetected on server errors
❌ **[HIGH]** Dead function `authenticateSecondaryContext` defined but never called, with misleading JSDoc
❌ **[NOTE]** RED PHASE comment in header is misleading — file contains NO `test.skip()` calls; tests will RUN and FAIL, not skip

### Summary

The test file has excellent structural intent but is blocked by one critical flaw that undermines its entire purpose: both browser contexts in the 2-user lobby test use the same worker storage state, meaning the app never actually sees two distinct authenticated users. Every assertion about partner behavior (AC#3 partner joined, AC#4 partner sees ready state, AC#5 countdown on both pages) is tested against a single identity, making the test meaningless as a multi-user integration test.

Secondary critical issues include a guaranteed race condition on countdown digit assertions and four `.catch(() => null)` calls that silently swallow server-side failures. These issues exist regardless of the RED/GREEN phase state and must be resolved before the tests provide reliable signal.

---

## Quality Criteria Assessment

| Criterion                            | Status      | Violations | Notes |
|--------------------------------------|-------------|-----------|-------|
| BDD Format (Given-When-Then)         | ✅ PASS     | 0         | Well-structured inline comments |
| Test IDs                             | ✅ PASS     | 0         | 4.1-E2E-001, 4.1-E2E-002 present |
| Priority Markers (P0/P1)             | ✅ PASS     | 0         | [P0] and [P1] in test names |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS     | 0         | None present |
| Determinism (no conditionals)        | ❌ FAIL     | 9         | Race condition, broad URL match, silent failures |
| Isolation (cleanup, no shared state) | ⚠️ WARN     | 6         | Same-user auth, partner_id not cleaned up |
| Fixture Patterns (merged-fixtures)   | ✅ PASS     | 0         | Correct import from merged-fixtures |
| Data Factories                       | ✅ PASS     | 0         | createTestSession + cleanup pattern correct |
| Network-First Pattern                | ⚠️ WARN     | 1         | Broad /realtime URL match on ready broadcasts |
| Explicit Assertions                  | ✅ PASS     | 0         | All assertions in test body |
| Test Length (≤300 lines file)        | ⚠️ WARN     | 1         | 307 lines (7 over limit) |
| Individual Test Length (≤100 lines)  | ❌ FAIL     | 1         | E2E-001 body is ~147 lines |
| Test Duration (≤1.5 min)             | ✅ PASS     | 0         | 60s/30s budgets appropriate |
| Flakiness Patterns                   | ❌ FAIL     | 2         | Countdown digit race, broad realtime URL match |

**Total Violations**: 9 Critical/High, 14 Medium, 11 Low

---

## Quality Score Breakdown

```
Starting Score:          100

Dimension Scores (weighted):
  Determinism (×0.25):   43/100  →  10.75 pts  [F — 3 HIGH, 5 MEDIUM, 1 LOW]
  Isolation (×0.25):     73/100  →  18.25 pts  [C — 2 HIGH, 2 MEDIUM, 2 LOW]
  Maintainability (×0.2):51/100  →  10.20 pts  [F — 3 HIGH, 3 MEDIUM, 2 LOW]
  Coverage (×0.15):      40/100  →   6.00 pts  [D — 1 HIGH, 4 MEDIUM, 3 LOW]
  Performance (×0.15):   94/100  →  14.10 pts  [A — 0 HIGH, 0 MEDIUM, 3 LOW]
                                    --------
Weighted Total:                      59.30

Final Score:             59/100
Grade:                   F (Critical Issues)
```

---

## Critical Issues (Must Fix)

### 1. Partner Context Uses Same User Auth — Multi-User ACs 3/4/5 Untested

**Severity**: P0 (Critical)
**Location**: `scripture-lobby-4.1.spec.ts:134`
**Criterion**: Isolation, Determinism, Coverage
**Dimensions**: Determinism (HIGH), Isolation (HIGH), Coverage (HIGH), Maintainability (MEDIUM)

**Issue Description**:
The partner browser context on line 134 is created with `storageState: workerStorageStatePath` — the SAME storage state as the primary user (`page`). Both browser contexts are authenticated as identical users. The in-code comment explicitly acknowledges this:

```
// We reuse the same storageStatePath as a placeholder — the real implementation
// will need a separate partner context from the auth pool.
```

This means the lobby test never exercises two distinct Supabase `auth.uid()` values. Since the app uses `partner_id` linkage and RLS policies to determine partner presence, AC#3 ("partner has joined"), AC#4 ("partner sees ready state"), and AC#5 ("countdown on BOTH pages") are all exercised against a self-paired user — which is not the production use case and may not reflect real RLS behavior.

**Current Code**:

```typescript
// ❌ Same auth as User A
const partnerContext = await browser.newContext({
  storageState: workerStorageStatePath,  // <-- identical to primary user
  baseURL: 'http://localhost:5173',
});
```

**Recommended Fix**:

```typescript
// ✅ Expose partnerStorageStatePath fixture in worker-auth.ts
// (auth-setup.ts already creates testworker{n}-partner@test.example.com)
const partnerContext = await browser.newContext({
  storageState: partnerStorageStatePath,  // separate partner auth from fixture
  baseURL: page.context().browser()?.contexts()[0].pages()[0].url() ?? 'http://localhost:5173',
});
```

**Why This Matters**:
The `auth-setup.ts` worker pair system already creates a user + partner pair for each Playwright worker. The partner's storage state file (e.g., `tests/.auth/worker-0-partner.json`) needs to be exposed as a `partnerStorageStatePath` fixture analogous to `workerStorageStatePath`. Without this fix, the entire premise of the P0 E2E test is invalid.

**Related Violations**: Also blocks meaningful evaluation of AC#3, AC#4, and AC#5 at E2E level.

---

### 2. Countdown Digit '3' Assertion Is a Guaranteed Race Condition

**Severity**: P0 (Critical)
**Location**: `scripture-lobby-4.1.spec.ts:218-219`
**Criterion**: Determinism
**Dimension**: Determinism (HIGH ×2)

**Issue Description**:
Both `page` and `partnerPage` assert `countdown-digit` has text `'3'`. The countdown begins immediately when both users click Ready. By the time the test reaches line 218 — after verifying `countdown-container` visible, then line 218 for `page`, then line 219 for `partnerPage` — the countdown may have already advanced to `'2'` or `'1'`. This assertion is inherently racy and will fail on slower CI runners.

**Current Code**:

```typescript
// ❌ Race condition: countdown may be at 2 or 1 by now
await expect(page.getByTestId('countdown-digit')).toHaveText('3');
await expect(partnerPage.getByTestId('countdown-digit')).toHaveText('3');
```

**Recommended Fix**:

```typescript
// ✅ Assert countdown started (container visible) and completed (verse visible)
await expect(page.getByTestId('countdown-container')).toBeVisible({ timeout: 10_000 });
await expect(partnerPage.getByTestId('countdown-container')).toBeVisible({ timeout: 10_000 });
// No mid-countdown digit snapshot — verse appearing proves countdown completed
await expect(page.getByTestId('scripture-verse-text')).toBeVisible({ timeout: 15_000 });
await expect(partnerPage.getByTestId('scripture-verse-text')).toBeVisible({ timeout: 15_000 });
```

If digit verification is required by the AC, use `toHaveText(/^[123]$/)` to match any valid countdown value.

**Why This Matters**:
A test that asserts '3' will pass during development but fail randomly in CI depending on JavaScript event loop timing and network latency. Two sequential assertions (page then partnerPage) compound the race because time elapses between them.

---

### 3. `.catch(() => null)` Silences All RPC Network Failures (4 Instances)

**Severity**: P1 (High)
**Location**: Lines 35, 170, 193, 278
**Criterion**: Determinism
**Dimension**: Determinism (MEDIUM), Coverage (MEDIUM), Maintainability (MEDIUM)

**Issue Description**:
Four `waitForResponse` calls use `.catch(() => null)`. If the RPC never fires (network error, server error, wrong URL), the test continues execution silently — the response is `null` but the test doesn't fail until a UI assertion times out later with a misleading error. This masks the real failure cause.

**Current Code**:

```typescript
// ❌ Silent failure — if RPC never fires, test continues with null
const sessionResponse = page.waitForResponse(
  (resp) => resp.url().includes('/rest/v1/rpc/scripture_create_session') && ...,
  { timeout: 15_000 }
).catch(() => null);
```

**Recommended Fix**:

```typescript
// ✅ Surface failures immediately with actionable messages
const sessionResponse = page.waitForResponse(
  (resp) => resp.url().includes('/rest/v1/rpc/scripture_create_session') && ...,
  { timeout: 15_000 }
).catch((e) => { throw new Error(`scripture_create_session RPC did not fire: ${e.message}`); });
```

For the ready-broadcast waiters (which await realtime events that may not have a clean HTTP response), use a null-safe check after awaiting:

```typescript
const userAReadyBroadcast = await page.waitForResponse(...).catch(() => null);
if (!userAReadyBroadcast) {
  throw new Error('Ready-state broadcast RPC did not receive a 2xx response');
}
```

**Why This Matters**:
Silent failures produce confusing test output. The developer sees a timeout on `lobby-partner-ready` instead of "ready RPC returned 403 because RLS policy rejected the update."

---

### 4. `authenticateSecondaryContext` — Dead Code with Misleading JSDoc

**Severity**: P1 (High)
**Location**: Lines 63-73
**Criterion**: Maintainability, Determinism
**Dimension**: Maintainability (HIGH), Determinism (MEDIUM), Isolation (MEDIUM)

**Issue Description**:
`authenticateSecondaryContext` is defined with a 6-line JSDoc claiming it "Injects worker auth storage state into a secondary browser context so the partner user is fully authenticated." The implementation opens a page, navigates to `localhost:5173/`, and closes it — it does not inject any authentication state whatsoever. The function is never called anywhere. This creates 18 lines of misleading dead code that implies the partner auth problem was solved when it was not.

**Current Code**:

```typescript
// ❌ Dead code — defined but never called; implementation is a no-op
async function authenticateSecondaryContext(
  secondaryContext: BrowserContext,
  storageStatePath: string
): Promise<void> {
  const tempPage = await secondaryContext.newPage();
  await tempPage.goto('http://localhost:5173/');
  await tempPage.close();
}
```

**Recommended Fix**: Delete the entire function. Partner context auth should be handled via `storageState` at `browser.newContext()` creation time (which is already the correct pattern on line 134 — just using the wrong path).

**Why This Matters**:
Future developers reading this file will assume partner auth was intentionally implemented via this function. The misleading JSDoc actively harms understanding of the test's isolation model.

---

### 5. RED PHASE Comment Is Misleading — Tests Will RUN, Not Skip

**Severity**: P1 (High)
**Location**: Lines 1-16 (file header comment)
**Criterion**: Determinism (indirect)

**Issue Description**:
The ATDD checklist (`atdd-checklist-4.1.md`) states E2E tests should be "skipped via `test.skip(true, '[RED PHASE]...')`" and the test file header says "RED PHASE: All tests are skipped." However, the test file contains NO `test.skip()` annotations. When Playwright runs this file, both tests will EXECUTE and FAIL (because the feature is not implemented), not skip.

**Current Code** (what's expected):
```typescript
// ❌ Missing from actual file
test.skip(true, '[RED PHASE] LobbyContainer not yet implemented');
```

**Recommended Fix**:
```typescript
// ✅ Add test.skip to each test.describe block, or at file level:
test.beforeEach(async ({}, testInfo) => {
  test.skip(true, '[RED PHASE] Together Mode lobby feature not yet implemented (Story 4.1)');
});
```

**Why This Matters**:
If CI runs these tests, they will fail and block the pipeline even though the failures are expected. Proper `test.skip` ensures they're collected (for coverage reporting) but not executed.

---

## Recommendations (Should Fix)

### 1. Expose `partnerStorageStatePath` Fixture

**Severity**: P1 (High)
**Criterion**: Isolation, Coverage
**Location**: `tests/support/auth-setup.ts`, `tests/support/merged-fixtures.ts`

The `auth-setup.ts` worker pair system creates `testworker{n}@test.example.com` + `testworker{n}-partner@test.example.com`. The partner's storage state is stored alongside the primary user's. Expose it as a `partnerStorageStatePath` fixture in `merged-fixtures.ts` so all tests in the suite can access it. This one change unblocks the entire multi-user testing model.

---

### 2. Add `unlinkTestPartners` Cleanup to `finally` Block

**Severity**: P1 (High)
**Criterion**: Isolation
**Location**: `scripture-lobby-4.1.spec.ts:225-230` (E2E-001 finally block)

`linkTestPartners` writes `partner_id` to the `users` table but is never reversed. Worker users are reused across tests; the partner link persists into subsequent tests within the same worker, potentially affecting those tests' behavior.

```typescript
// ✅ In finally block, after cleanupTestSession:
finally {
  await partnerContext.close();
  await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
  await unlinkTestPartners(supabaseAdmin, seed.test_user1_id);  // add this
}
```

---

### 3. Narrow `waitForResponse` URL Pattern on Ready Broadcasts

**Severity**: P2 (Medium)
**Criterion**: Determinism
**Location**: Lines 170-179, 193-202

The broad `resp.url().includes('/realtime')` matches Supabase realtime heartbeats and presence pings. Remove the `/realtime` fallback and match only the specific RPC endpoint:

```typescript
// ✅ Narrowed to specific endpoint only
const userAReadyBroadcast = page.waitForResponse(
  (resp) => resp.url().includes('/rest/v1/rpc/scripture_set_lobby_ready') &&
    resp.status() >= 200 && resp.status() < 300,
  { timeout: 10_000 }
).catch((e) => { throw new Error(`Ready state RPC failed: ${e.message}`); });
```

---

### 4. Extract Duplicate `waitForResponse` Predicate

**Severity**: P2 (Medium)
**Criterion**: Maintainability
**Location**: Lines 170-179 (duplicated at 193-202)

Extract the identical predicate to a named constant at the top of the test or in the helper section:

```typescript
// ✅ Named predicate at top of describe block
const isLobbyReadyResponse = (resp: Response) =>
  resp.url().includes('/rest/v1/rpc/scripture_set_lobby_ready') &&
  resp.status() >= 200 && resp.status() < 300;

const userAReadyBroadcast = page.waitForResponse(isLobbyReadyResponse, { timeout: 10_000 });
// ...
const partnerReadyBroadcast = partnerPage.waitForResponse(isLobbyReadyResponse, { timeout: 10_000 });
```

---

### 5. Assert `seed.test_user2_id` Is Defined (Fail Fast)

**Severity**: P2 (Medium)
**Criterion**: Determinism
**Location**: `scripture-lobby-4.1.spec.ts:98`

Replace the conditional `if (seed.test_user2_id)` with an assertion that fails immediately:

```typescript
// ✅ Fail fast rather than timeout 20s later
expect(seed.test_user2_id, 'createTestSession must return a partner user ID for lobby test').toBeTruthy();
await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
```

---

### 6. Use `Promise.all` for Parallel Assertions on Both Pages

**Severity**: P3 (Low)
**Criterion**: Performance
**Location**: Lines 210-227

Countdown and verse assertions on `page` and `partnerPage` are independent realtime events. Run them concurrently:

```typescript
// ✅ Concurrent assertions — saves up to 25s in worst case
await Promise.all([
  expect(page.getByTestId('countdown-container')).toBeVisible({ timeout: 10_000 }),
  expect(partnerPage.getByTestId('countdown-container')).toBeVisible({ timeout: 10_000 }),
]);
await Promise.all([
  expect(page.getByTestId('scripture-verse-text')).toBeVisible({ timeout: 15_000 }),
  expect(partnerPage.getByTestId('scripture-verse-text')).toBeVisible({ timeout: 15_000 }),
]);
```

---

### 7. Replace Magic Timeout Values with Named Constants

**Severity**: P3 (Low)
**Criterion**: Maintainability
**Location**: Scattered across file

```typescript
// ✅ At top of file, after imports:
const SESSION_CREATE_TIMEOUT_MS = 15_000;
const REALTIME_SYNC_TIMEOUT_MS = 20_000;
const READY_BROADCAST_TIMEOUT_MS = 10_000;
const CONVERSION_TIMEOUT_MS = 12_000;
const VERSE_LOAD_TIMEOUT_MS = 15_000;
```

---

## Best Practices Found

### 1. Network-First Pattern Applied Correctly

**Location**: `scripture-lobby-4.1.spec.ts:34-42`, `278-290`
**Pattern**: Intercept-before-navigate

The `waitForResponse` listener for `scripture_create_session` is set up BEFORE the click sequence begins (line 34), then awaited after the click (line 51). This is the correct network-first pattern that prevents race conditions.

```typescript
// ✅ Excellent: intercept set up BEFORE action
const sessionResponse = page.waitForResponse(
  (resp) => resp.url().includes('/rest/v1/rpc/scripture_create_session') && ...,
  { timeout: 15_000 }
).catch(() => null);  // (the .catch is a separate issue)

await page.getByTestId('scripture-start-button').click();
await sessionResponse;  // deterministic wait
```

---

### 2. Factory Functions with `try/finally` Cleanup

**Location**: Both tests (lines 94-103, 244-248)
**Pattern**: API-first setup + self-cleaning

Both tests use `createTestSession` to set up state via Supabase admin API, track IDs in `sessionIdsToClean`, and clean up in a `finally` block. This is the correct pattern for parallel-safe, self-cleaning E2E tests.

```typescript
// ✅ Excellent cleanup pattern
const sessionIdsToClean = [...seed.session_ids];
try {
  // test body
} finally {
  await partnerContext.close();
  await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
}
```

---

### 3. Precise Acceptance Criteria Mapping in Comments

**Location**: Lines 1-16 and throughout test body
**Pattern**: Traceability comments

Every assertion is tagged with the AC it validates (`// AC#1`, `// AC#3`, etc.), creating clear traceability from test code to acceptance criteria. This makes the test auditable and maintainable.

---

## Test File Analysis

### File Metadata

- **File Path**: `tests/e2e/scripture/scripture-lobby-4.1.spec.ts`
- **File Size**: 307 lines (⚠️ 7 over 300-line limit)
- **Test Framework**: Playwright
- **Language**: TypeScript

### Test Structure

- **Describe Blocks**: 2 (`[4.1-E2E-001]`, `[4.1-E2E-002]`)
- **Test Cases**: 2 (1 P0, 1 P1)
- **Average Test Length**: ~147 lines (E2E-001), ~60 lines (E2E-002)
- **Fixtures Used**: `page`, `browser`, `supabaseAdmin`, `workerStorageStatePath`
- **Helper Functions**: `navigateToTogetherRoleSelection` (used ✓), `authenticateSecondaryContext` (dead ✗)
- **Data Factories**: `createTestSession`, `linkTestPartners`, `cleanupTestSession`
- **Network Interception**: 4× raw `page.waitForResponse()` (not using `interceptNetworkCall` fixture)

### Test Coverage Scope

- **Test IDs**: `4.1-E2E-001`, `4.1-E2E-002`
- **Priority Distribution**:
  - P0 (Critical): 1 test
  - P1 (High): 1 test
  - P2 (Medium): 0 tests
  - P3 (Low): 0 tests

### Assertions Analysis

- **Total Assertions**: ~20 `expect()` calls across both tests
- **Assertions per Test**: ~12 (E2E-001), ~8 (E2E-002)
- **Assertion Types**: `toBeVisible`, `toContainText`, `toHaveText`, `not.toBeVisible`

---

## Context and Integration

### Related Artifacts

- **ATDD Checklist**: [atdd-checklist-4.1.md](../atdd-checklist-4.1.md)
- **Acceptance Criteria Mapped**: 6/6 ACs referenced (but AC#3/4/5 multi-user paths not genuinely tested)

### Acceptance Criteria Validation

| Acceptance Criterion | Test ID | Status | Notes |
|---------------------|---------|--------|-------|
| AC#1 Role selection (Reader/Responder) | 4.1-E2E-001, 4.1-E2E-002 | ✅ Covered | Both role cards asserted visible and clickable |
| AC#2 Lobby waiting state + Continue solo | 4.1-E2E-001, 4.1-E2E-002 | ✅ Covered | Waiting text, continue-solo button asserted |
| AC#3 Partner presence (has joined) | 4.1-E2E-001 | ⚠️ Placeholder | Same-user auth makes assertion unreliable |
| AC#4 Ready toggle + partner sees state | 4.1-E2E-001 | ⚠️ Placeholder | Same-user auth; .catch(() => null) on RPC |
| AC#5 Countdown 3→2→1 + verse | 4.1-E2E-001 | ⚠️ Partial | Only '3' asserted (racy); 2 and 1 missing |
| AC#6 Continue solo → session converts | 4.1-E2E-002 | ✅ Covered | Verse visible, lobby hidden asserted |

**Coverage**: 2 fully covered, 3 partially covered (same-user auth blocker), 1 partially covered (digit race)

---

## Knowledge Base References

- **[test-quality.md](../../../testarch/knowledge/test-quality.md)** — Deterministic waits, self-cleaning tests, <300 lines
- **[timing-debugging.md](../../../testarch/knowledge/timing-debugging.md)** — Network-first interception, race condition prevention
- **[test-healing-patterns.md](../../../testarch/knowledge/test-healing-patterns.md)** — Silent failure masking patterns
- **[selector-resilience.md](../../../testarch/knowledge/selector-resilience.md)** — data-testid selector usage ✅
- **[data-factories.md](../../../testarch/knowledge/data-factories.md)** — Factory pattern with try/finally cleanup ✅
- **[auth-session.md](../../../testarch/knowledge/auth-session.md)** — Multi-user auth via separate browser contexts
- **[fixtures-composition.md](../../../testarch/knowledge/fixtures-composition.md)** — mergeTests pattern, fixture extension

---

## Next Steps

### Immediate Actions (Before Feature Implementation)

1. **Add `test.skip()` annotations** — Tests must be explicitly skipped in RED phase
   - Priority: P0
   - Owner: Dev team
   - Effort: 5 minutes
   - Add to each test body: `test.skip(true, '[RED PHASE] LobbyContainer not implemented')`

2. **Expose `partnerStorageStatePath` fixture** — Unblocks entire multi-user test
   - Priority: P0
   - Owner: Dev team (auth-setup.ts owner)
   - Effort: 1-2 hours
   - Add partner JSON path to `worker-auth.ts` fixture, export from merged-fixtures

3. **Remove `authenticateSecondaryContext` dead code** — 1 line delete
   - Priority: P1
   - Owner: Dev team
   - Effort: 2 minutes

4. **Fix countdown digit assertions** — Replace lines 218-219
   - Priority: P1
   - Owner: Dev team
   - Effort: 15 minutes

5. **Replace `.catch(() => null)` with error-throwing handlers** — 4 locations
   - Priority: P1
   - Owner: Dev team
   - Effort: 30 minutes

### Follow-up Actions (Before GREEN Phase — When Feature Lands)

1. **Add `unlinkTestPartners` to finally block** — Prevents state leak
   - Priority: P2
   - Target: When E2E-001 is unblocked and running

2. **Extract duplicate `waitForResponse` predicate to named constant** — DRY
   - Priority: P2
   - Target: Before merge to main

3. **Track session created in `navigateToTogetherRoleSelection` for cleanup**
   - Priority: P2
   - Target: Before merge to main

4. **Add at least one error-path test** (e.g., `scripture_convert_to_solo` RPC failure)
   - Priority: P2
   - Target: Follow-up story or current story refactor phase

5. **Use `Promise.all` for parallel dual-page assertions** — Performance improvement
   - Priority: P3
   - Target: When tests go GREEN

### Re-Review Needed?

⚠️ **Re-review after P0 fixes** — Fix items 1-5 in "Immediate Actions", then re-run review before feature implementation begins. The multi-user auth blocker (item 2) is the most critical; without it, the P0 test provides no signal.

---

## Decision

**Recommendation**: Block

**Rationale**:
The test file cannot be approved in its current form for two reasons. First, the P0 test's core premise — testing two distinct users interacting in a lobby — is not achieved because both browser contexts authenticate as the same user. This is acknowledged in the code as a placeholder but represents a fundamental gap in test validity. Second, the four `.catch(() => null)` calls create silent failure modes that will make future debugging significantly harder. The file needs 30-60 minutes of targeted fixes before it can provide reliable signal during feature development.

**For Block**:
> Test quality is insufficient with 59/100 score. The multi-user lobby integration test (P0) uses the same authenticated user in both browser contexts, making AC#3/AC#4/AC#5 assertions meaningless. Additional critical issues include a guaranteed race condition on countdown digit assertions and silent network failure suppression on all 4 RPC wait calls. Fix `partnerStorageStatePath` fixture, remove `.catch(() => null)`, and add `test.skip()` annotations before beginning feature implementation.

---

## Appendix

### Violation Summary by Location

| Line | Dimension | Severity | Criterion | Issue | Fix |
|------|-----------|----------|-----------|-------|-----|
| 35 | Determinism | MEDIUM | Network | `.catch(() => null)` silences session RPC failure | Throw on null |
| 63-73 | Maintainability | HIGH | Dead code | `authenticateSecondaryContext` defined, never called | Delete |
| 80-232 | Maintainability | HIGH | Length | E2E-001 body 147 lines (threshold: 100) | Split or extract helpers |
| 98 | Determinism | LOW | Setup | Conditional `linkTestPartners` hides setup failure | Assert not null first |
| 134 | Determinism | HIGH | Auth | Partner context uses same auth as User A | Use `partnerStorageStatePath` |
| 134 | Isolation | HIGH | Auth | Same auth = no real partner isolation | Use `partnerStorageStatePath` |
| 134 | Coverage | HIGH | Multi-user | ACs 3/4/5 not genuinely exercised | Use `partnerStorageStatePath` |
| 136 | Maintainability | MEDIUM | Magic val | `'http://localhost:5173'` hardcoded | Use Playwright config baseURL |
| 170-179 | Determinism | MEDIUM | Network | Broad `/realtime` URL matches heartbeats | Narrow to specific RPC |
| 170-202 | Maintainability | HIGH | DRY | Identical `waitForResponse` predicate duplicated | Extract to named function |
| 193-202 | Determinism | MEDIUM | Network | Same as line 170; registered AFTER prior await | See fix above |
| 218 | Determinism | HIGH | Race | `toHaveText('3')` racy (countdown may advance) | Remove or use regex |
| 219 | Determinism | HIGH | Race | Same race, compounded by sequential execution | Remove or use regex |
| 278 | Determinism | MEDIUM | Network | `.catch(() => null)` on conversion RPC | Throw on null |
| 307 | Maintainability | LOW | Length | 307 lines (limit: 300) | Move helpers to support/ |

### Quality Trends

| Review Date | Score | Grade | Critical Issues | Trend |
|-------------|-------|-------|-----------------|-------|
| 2026-02-20 | 59/100 | F | 9 HIGH | — (first review) |

### Related Reviews

| File | Score | Grade | Critical | Status |
|------|-------|-------|----------|--------|
| scripture-lobby-4.1.spec.ts | 59/100 | F | 9 | ⛔ Blocked |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0 (Step-File Architecture)
**Review ID**: test-review-scripture-lobby-4.1-20260220
**Timestamp**: 2026-02-20 12:00:00
**Version**: 1.0
**Dimensions Evaluated**: Determinism (25%), Isolation (25%), Maintainability (20%), Coverage (15%), Performance (15%)
**Execution Mode**: Parallel (5 subprocesses, ~60% faster than sequential)

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `_bmad/tea/testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations

This review is guidance, not rigid rules. Context matters — the RED PHASE status of this test is fully considered; the issues flagged are structural and need to be fixed regardless of implementation status.
