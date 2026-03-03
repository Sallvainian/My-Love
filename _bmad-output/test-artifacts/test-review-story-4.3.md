---
stepsCompleted:
  - 'step-01-load-context'
  - 'step-02-discover-tests'
  - 'step-03-quality-evaluation'
  - 'step-03f-aggregate-scores'
  - 'step-04-generate-report'
lastStep: 'step-04-generate-report'
lastSaved: '2026-02-28'
workflowType: 'testarch-test-review'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-3-reconnection-and-graceful-degradation.md'
  - '_bmad-output/test-artifacts/atdd-checklist-4.3.md'
  - 'tests/e2e/scripture/scripture-reconnect-4.3.spec.ts'
  - 'tests/unit/stores/scriptureReadingSlice.reconnect.test.ts'
  - 'tests/unit/hooks/useScripturePresence.reconnect.test.ts'
  - 'tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts'
  - 'src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx'
  - 'src/components/scripture-reading/__tests__/LockInButton.test.tsx'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/selective-testing.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - '_bmad/tea/testarch/knowledge/selector-resilience.md'
  - '_bmad/tea/testarch/knowledge/timing-debugging.md'
---

# Test Quality Review: Story 4.3 — Reconnection & Graceful Degradation

**Quality Score**: 65/100 (D - Needs Improvement)
**Review Date**: 2026-02-28
**Review Scope**: directory (6 test files across unit, component, and E2E)
**Reviewer**: TEA Agent

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Needs Improvement

**Recommendation**: Request Changes

### Key Strengths

- No hard waits (`waitForTimeout`) in any test file — E2E uses condition-based `toBeVisible({ timeout })` throughout
- E2E tests use proper `try/finally` cleanup blocks with `cleanupTestSession` + `unlinkTestPartners` factory helpers
- All files have `describe` grouping, BDD-style test names, and priority markers `[P0]`/`[P1]`/`[P2]`

### Key Weaknesses

- Maintainability score 40/100 (F) — pervasive code duplication (dynamic imports, handler extraction, E2E setup blocks) and magic strings/numbers
- Two HIGH-severity determinism violations — `Date.now()` used outside fake-timer scope in two files
- Missing `vi.clearAllMocks()` in `LockInButton.test.tsx` — shared `vi.fn()` mocks can accumulate call counts across tests

### Summary

The Story 4.3 test suite demonstrates solid structural foundations: all 6 files use describe grouping, BDD-style naming, priority markers, and `data-testid` selectors. The E2E tests are particularly well-structured with factory-based seeding, condition-based waits, and thorough cleanup. However, maintainability is the critical weakness — dynamic in-test `await import()` patterns in both hook test files, duplicated handler extraction logic, repeated E2E setup blocks, and scattered magic strings significantly increase maintenance burden. Two HIGH-severity determinism issues (real `Date.now()` outside fake-timer scope) create flakiness risk under CI load. The recommendation is **Request Changes** with priority on fixing the determinism HIGHs and adding `vi.clearAllMocks()` to LockInButton.test.tsx before merge.

---

## Quality Criteria Assessment

| Criterion                            | Status | Violations | Notes                                                                           |
| ------------------------------------ | ------ | ---------- | ------------------------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | PASS   | 0          | All tests follow BDD naming; E2E has Given/When/Then comments                   |
| Test IDs                             | PASS   | 0          | E2E: `4.3-E2E-001`, `4.3-E2E-002`; unit tests use descriptive names             |
| Priority Markers (P0/P1/P2/P3)       | PASS   | 0          | All tests tagged `[P0]`, `[P1]`, or `[P2]`                                      |
| Hard Waits (sleep, waitForTimeout)   | PASS   | 0          | No `waitForTimeout` anywhere; E2E uses locator timeouts                         |
| Determinism (no conditionals)        | WARN   | 4          | 2 HIGH (Date.now outside fake timers), 1 MEDIUM, 1 LOW                          |
| Isolation (cleanup, no shared state) | WARN   | 8          | 5 MEDIUM (shared vi.fn, missing clearAllMocks), 3 LOW                           |
| Fixture Patterns                     | PASS   | 0          | E2E uses `createTestSession` factory; unit uses `createStoreWithReadingSession` |
| Data Factories                       | WARN   | 4          | Magic strings (`session-reconnect-001` x8), magic numbers (`31_000` x6)         |
| Network-First Pattern                | PASS   | 0          | E2E uses `waitForResponse` for RPC; route blocking for disconnect               |
| Explicit Assertions                  | PASS   | 0          | All tests have explicit `expect()` assertions                                   |
| Test Length (<=300 lines)            | PASS   | 0          | Max file: 299 lines (scriptureReadingSlice); all under 300                      |
| Test Duration (<=1.5 min)            | WARN   | 2          | E2E tests: 60-120s each due to real-time disconnection waits                    |
| Flakiness Patterns                   | WARN   | 2          | Date.now() bracketing race; setTimeout-based flushPromises                      |

**Total Violations**: 0 Critical, 2 High, 19 Medium, 12 Low

---

## Quality Score Breakdown

```
Weighted Dimension Scoring:

Dimension         Score  Weight  Weighted
Determinism:      73     x 0.30  = 21.9
Isolation:        69     x 0.30  = 20.7
Maintainability:  40     x 0.25  = 10.0
Performance:      85     x 0.15  = 12.75
                                  ------
Overall Score:                    65/100
Grade:                            D (Needs Improvement)

Dimension Breakdown:
  Determinism (73/C):      2 HIGH + 1 MEDIUM + 1 LOW = 27 penalty
  Isolation (69/D):        5 MEDIUM + 3 LOW = 31 penalty
  Maintainability (40/F):  10 MEDIUM + 5 LOW = 60 penalty
  Performance (85/B):      3 MEDIUM + 3 LOW = 21 penalty
```

---

## Critical Issues (Must Fix)

### Issue 1: `Date.now()` at describe scope before fake timers (HIGH — Determinism)

**File**: `src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx:24`

`defaultProps.disconnectedAt` is initialized with `Date.now()` at describe-block scope, before `vi.useFakeTimers()` is installed in `beforeEach`. The value is captured once using the real wall clock and shared across all tests.

**Fix**: Move `disconnectedAt` initialization inside `beforeEach` after fake timers are active:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  defaultProps = {
    partnerName: 'Jordan',
    disconnectedAt: Date.now(), // Now uses fake timer
    onKeepWaiting: vi.fn(),
    onEndSession: vi.fn(),
  };
});
```

**Ref**: `test-quality.md` — "Tests must not depend on real wall-clock time"

### Issue 2: Real `Date.now()` bracketing pattern (HIGH — Determinism)

**File**: `tests/unit/stores/scriptureReadingSlice.reconnect.test.ts:120`

Real `Date.now()` brackets the `setPartnerDisconnected(true)` call without fake timers. Under CI contention, the bracketing window can collapse to 0ms, causing flaky assertions.

**Fix**: Install fake timers and assert against a fixed timestamp:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-28T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

test('[P0] setPartnerDisconnected stores timestamp', () => {
  const store = await createStoreWithReadingSession();
  store.getState().setPartnerDisconnected(true);
  expect(store.getState().partnerDisconnectedAt).toBe(Date.now());
});
```

**Ref**: `test-healing-patterns.md` — "Use vi.setSystemTime() for deterministic time assertions"

### Issue 3: Missing `vi.clearAllMocks()` in LockInButton.test.tsx (MEDIUM — Isolation)

**File**: `src/components/scripture-reading/__tests__/LockInButton.test.tsx:21`

Shared `vi.fn()` mocks (`onLockIn`, `onUndoLockIn`) in `defaultProps` are never reset between tests. Call counts can accumulate if test execution order changes.

**Fix**: Add mock reset:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Ref**: `test-quality.md` — "Each test must be self-cleaning"

---

## Recommendations (Should Fix)

### R1: Replace dynamic in-test imports with static imports (MEDIUM — Maintainability)

**Files**: `useScripturePresence.reconnect.test.ts`, `useScriptureBroadcast.reconnect.test.ts`

Both hook test files use `const { useX } = await import('...')` inside every test body. Vitest hoists `vi.mock()` before imports, so static imports work correctly with mocks.

```typescript
// Before (repeated in every test):
const { useScriptureBroadcast } = await import('../../../src/hooks/useScriptureBroadcast');

// After (once at file scope):
import { useScriptureBroadcast } from '../../../src/hooks/useScriptureBroadcast';
```

### R2: Extract duplicated handler extraction helpers (MEDIUM — Maintainability)

**File**: `useScriptureBroadcast.reconnect.test.ts:95` (3 occurrences)
**File**: `useScripturePresence.reconnect.test.ts:114` (2 occurrences)

```typescript
// Add to describe scope:
function getSubscribeCallback() {
  const cb = mockChannel.subscribe.mock.calls[0]?.[0];
  expect(cb).toBeDefined();
  return cb!;
}
```

### R3: Extract duplicated E2E session setup (MEDIUM — Maintainability)

**File**: `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts:63,183`

Both E2E tests duplicate ~20 lines of identical session creation and partner linking. Extract into a shared async helper.

### R4: Name magic strings and numbers (MEDIUM — Maintainability)

| Value                     | File                            | Occurrences | Suggested Constant    |
| ------------------------- | ------------------------------- | ----------- | --------------------- |
| `'session-reconnect-001'` | scriptureReadingSlice.reconnect | 8           | `TEST_SESSION_ID`     |
| `31_000`                  | DisconnectionOverlay            | 6           | `PHASE_B_ELAPSED_MS`  |
| `20_001`                  | useScripturePresence            | 2           | `PAST_STALE_TTL_MS`   |
| `120_000`                 | E2E spec                        | 2           | `E2E_TEST_TIMEOUT_MS` |

### R5: Replace `setTimeout`-based `flushPromises` (MEDIUM — Determinism)

**File**: `useScriptureBroadcast.reconnect.test.ts:73`

```typescript
// Before:
async function flushPromises() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// After:
async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
```

### R6: Remove conflicting `vi.restoreAllMocks()` (LOW — Isolation)

**File**: `useScriptureBroadcast.reconnect.test.ts:83`

`vi.restoreAllMocks()` in `afterEach` conflicts with `vi.clearAllMocks()` in `beforeEach` when all mocks are `vi.fn()` (not spies). Remove the `afterEach` or replace with just `vi.clearAllMocks()`.

### R7: Inject configurable timeouts for E2E (LOW — Performance)

The E2E tests wait 25-35s per disconnection due to hardcoded stale TTL (20s) and Phase B threshold (30s). Exposing these as test-injectable values would reduce E2E suite time from ~120s to ~30s.

---

## Best Practices Found

### BP1: Condition-based E2E waits (E2E spec)

```typescript
await expect(page.getByTestId('disconnection-overlay')).toBeVisible({
  timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
});
```

Uses Playwright's built-in polling with timeout instead of `waitForTimeout`. This is the correct pattern per `timing-debugging.md`.

### BP2: Factory-based test data seeding (E2E spec)

```typescript
const seed = await createTestSession(supabaseAdmin, {
  sessionCount: 1,
  preset: 'mid_session',
});
await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
```

Uses API-first data factories instead of UI-driven setup. Follows `data-factories.md` best practices.

### BP3: Network interception for RPC verification (E2E spec)

```typescript
const endSessionResponse = page.waitForResponse(
  (resp) => resp.url().includes('/rest/v1/rpc/scripture_end_session') && resp.status() >= 200,
  { timeout: END_SESSION_TIMEOUT_MS }
);
await page.getByTestId('disconnection-end-session').click();
await endSessionResponse;
```

Network-first pattern: sets up response listener before triggering the action. Follows `timing-debugging.md` race-condition prevention.

### BP4: Isolated store creation per test (scriptureReadingSlice)

```typescript
async function createStoreWithReadingSession() {
  const store = createTestStore();
  // ... setup
  return store;
}
```

Each test creates its own store instance, preventing state leakage between tests. Follows `test-quality.md` isolation principle.

### BP5: Proper fake timer lifecycle (DisconnectionOverlay, useScripturePresence)

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
```

Clean install/restore pattern for fake timers. Both files properly pair the lifecycle.

---

## Test File Analysis

| File                                    | Lines | Tests | Framework  | Determinism  | Isolation | Maintainability | Performance |
| --------------------------------------- | ----- | ----- | ---------- | ------------ | --------- | --------------- | ----------- |
| DisconnectionOverlay.test.tsx           | 234   | 12    | Vitest/RTL | 1 HIGH       | 2 (1M+1L) | 2 (1M+1L)       | Clean       |
| LockInButton.test.tsx                   | 174   | 14    | Vitest/RTL | Clean        | 2 (2M)    | 1 (1L)          | Clean       |
| scriptureReadingSlice.reconnect.test.ts | 299   | 13    | Vitest     | 1 HIGH+1 LOW | Clean     | 3 (2M+1L)       | 1 (1L)      |
| useScripturePresence.reconnect.test.ts  | 207   | 6     | Vitest/RTL | Clean        | 1 (1M)    | 3 (2M+1L)       | 1 (1L)      |
| useScriptureBroadcast.reconnect.test.ts | 170   | 5     | Vitest/RTL | 1 MEDIUM     | 2 (1M+1L) | 4 (3M+1L)       | Clean       |
| scripture-reconnect-4.3.spec.ts         | 272   | 2     | Playwright | Clean        | 1 (1L)    | 3 (2M+1L)       | 4 (3M+1L)   |

**Total**: 1,356 lines, 52 tests across 6 files

---

## Context and Integration

### Story Alignment

Story 4.3 defines 6 Acceptance Criteria:

- AC#1: Reconnecting indicator — covered by DisconnectionOverlay tests + E2E
- AC#2: Timeout options (30s) — covered by DisconnectionOverlay Phase B tests + E2E
- AC#3: Keep waiting — covered by E2E test 4.3-E2E-002
- AC#4: End session — covered by E2E test 4.3-E2E-001 + slice `endSession` tests
- AC#5: Reconnection resync — covered by useScriptureBroadcast `loadSession` test + E2E
- AC#6: Broadcast reconnection — covered by useScriptureBroadcast CHANNEL_ERROR + CLOSED tests

All ACs have test coverage. Coverage depth/adequacy is out of scope for this review — use `trace` for coverage gates.

### ATDD Checklist Alignment

The ATDD checklist (`atdd-checklist-4.3.md`) specifies 27 tests. The 52 tests found exceed this count, including expansion tests added by TEA Automate.

### Code Review Integration

Story 4.3 code review flagged:

- H1: broadcast re-subscribe broken — tested by `useScriptureBroadcast.reconnect.test.ts`
- M1: reconnection toast — not in test scope (toast is M1, not a test issue)
- M2: inline SVG instead of Lucide WifiOff — not a test concern
- M3: missing prefers-reduced-motion — `animate-pulse` class test present in DisconnectionOverlay

---

## Knowledge Base References

| Fragment                   | Applied To  | Key Finding                                                       |
| -------------------------- | ----------- | ----------------------------------------------------------------- |
| `test-quality.md`          | All files   | 2 HIGHs: Date.now() without fake timers violates determinism rule |
| `data-factories.md`        | E2E spec    | PASS: uses `createTestSession` factory pattern correctly          |
| `test-levels-framework.md` | Suite       | PASS: proper unit/component/E2E level separation                  |
| `selector-resilience.md`   | All files   | PASS: all tests use `data-testid` selectors exclusively           |
| `timing-debugging.md`      | E2E spec    | PASS: condition-based waits, network-first RPC verification       |
| `test-healing-patterns.md` | Determinism | Applied: Date.now() bracketing is a known flakiness pattern       |
| `selective-testing.md`     | Suite       | All tests tagged with priority markers for selective runs         |

---

## Next Steps

1. **Fix 2 HIGH determinism issues** — Install fake timers in `DisconnectionOverlay.test.tsx` defaultProps and `scriptureReadingSlice.reconnect.test.ts` (estimated: 30 min)
2. **Add `vi.clearAllMocks()`** to `LockInButton.test.tsx` (estimated: 5 min)
3. **Extract shared helpers** — `getSubscribeCallback()`, `getPresenceHandler()`, E2E setup helper (estimated: 45 min)
4. **Replace dynamic imports** with static imports in hook test files (estimated: 15 min)
5. **Name magic constants** — `TEST_SESSION_ID`, `PHASE_B_ELAPSED_MS`, `PAST_STALE_TTL_MS` (estimated: 20 min)
6. **Re-run `test-review`** after fixes to target score >= 80 (B)
7. **Run `trace`** for coverage gate decision (out of scope for this review)

---

## Decision

**Request Changes** — The test suite has a solid structural foundation (BDD naming, priority markers, factory seeding, condition-based waits) but the 2 HIGH-severity determinism issues and the F-grade maintainability score (driven by pervasive code duplication and magic values) prevent approval. The determinism HIGHs create real flakiness risk under CI load and should be fixed before merge. The maintainability issues are lower risk but significantly increase the cost of future test maintenance.

**Priority order**: Fix HIGHs (1-2) > Add clearAllMocks (3) > Extract helpers (4-5) > Name constants (6)

---

## Appendix

### Dimension Score Details

| Dimension       | Score | Grade | HIGH | MEDIUM | LOW | Weight |
| --------------- | ----- | ----- | ---- | ------ | --- | ------ |
| Determinism     | 73    | C     | 2    | 1      | 1   | 30%    |
| Isolation       | 69    | D     | 0    | 5      | 3   | 30%    |
| Maintainability | 40    | F     | 0    | 10     | 5   | 25%    |
| Performance     | 85    | B     | 0    | 3      | 3   | 15%    |

### Subprocess Execution

- Mode: PARALLEL (4 quality dimensions)
- All 4 subprocesses completed successfully
- Output files: `/tmp/tea-test-review-{dimension}-20260228.json`

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-story-4.3-20260228
**Timestamp**: 2026-02-28
**Version**: 1.0
