# Test Quality Review: Chromium E2E Failure Subset (Scripture)

**Quality Score**: 75/100 (C - Needs Improvement)
**Review Date**: 2026-02-08
**Review Scope**: suite (failed tests from full Chromium run)
**Reviewer**: Sallvain / TEA Agent

---

Note: This review audits existing tests and current failures; it does not generate new tests.

## Executive Summary

**Overall Assessment**: Needs Improvement

**Recommendation**: Request Changes

### Key Strengths

✅ Full Chromium suite executed end-to-end (`69 passed, 29 skipped, 3 failed`) with reproducible failures.
✅ No `network-error-monitor` regression signature found (`Network errors detected`, `Failed requests`, `auth/v1/user 504`) in run logs or failure artifacts.
✅ Core scripture helpers and tests already use deterministic patterns (`waitForResponse`, no hard waits).

### Key Weaknesses

❌ Isolation leak: shared in-progress session state across parallel tests leads to resume-step mismatch (`Step 1` vs expected `Step 7`).
❌ Partner report tests assert UI before partner-complete backend preconditions are fully guaranteed.
❌ Ambiguous text assertions on mixed-content containers (`Psalm 147:3`) create brittle pass/fail behavior.

### Summary

The current failures are not network-monitor regressions. They are state isolation and assertion precision problems in scripture E2E flows, plus missing readiness gating for partner-report scenarios. The suite health improved versus the prior run, but the remaining three failures are blocking for reliable green Chromium runs. Fixes should prioritize worker/session isolation and deterministic backend-readiness gates before UI assertions.

---

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
| --- | --- | --- | --- |
| BDD Format (Given-When-Then) | ⚠️ WARN | 0 | Behavioral naming is good, but assertions mix multiple branches in single tests |
| Test IDs | ✅ PASS | 0 | Stable `data-testid` usage across failing specs |
| Priority Markers (P0/P1/P2/P3) | ⚠️ WARN | 1 | Mixed use (`P1-008` in id text vs explicit `[P1]` markers) |
| Hard Waits (sleep, waitForTimeout) | ✅ PASS | 0 | No hard waits detected |
| Determinism (no conditionals) | ⚠️ WARN | 2 | Ambiguous text assertions and fixed-state assumptions |
| Isolation (cleanup, no shared state) | ❌ FAIL | 3 | Shared user/session interference across parallel tests |
| Fixture Patterns | ⚠️ WARN | 1 | Helper fallback can resolve to unrelated in-progress session |
| Data Factories | ⚠️ WARN | 2 | Partner-complete fixtures are partial/inconsistent in failing tests |
| Network-First Pattern | ✅ PASS | 0 | `waitForResponse` used; no network-monitor regression evidence |
| Explicit Assertions | ⚠️ WARN | 2 | Container-level text checks hide branch intent |
| Test Length (≤300 lines) | ✅ PASS | 0 | Both reviewed files are 278 lines |
| Test Duration (≤1.5 min) | ❌ FAIL | 2 | Two failures exhausted 60s test timeout |
| Flakiness Patterns | ❌ FAIL | 3 | Race between backend readiness and UI branch assertions |

**Total Violations**: 0 Critical, 3 High, 9 Medium, 1 Low

---

## Quality Score Breakdown

```text
Weighted Dimension Model (Step 3F):
- Determinism:      84 × 0.25 = 21.00
- Isolation:        68 × 0.25 = 17.00
- Maintainability:  74 × 0.20 = 14.80
- Coverage:         62 × 0.15 =  9.30
- Performance:      86 × 0.15 = 12.90
                              -------
Final Score:                     75/100
Grade:                           C
```

---
## Critical Issues (Must Fix)

### 1. Cross-Test Session Contamination in Resume Flow

**Severity**: P0 (Critical)
**Location**: `tests/e2e/scripture/scripture-overview.spec.ts:216`, `tests/support/helpers.ts:137`
**Criterion**: Isolation
**Knowledge Base**: [test-quality.md](../../../testarch/knowledge/test-quality.md), [auth-session.md](../../../testarch/knowledge/auth-session.md)

**Issue Description**:
The resume-step test writes and reads shared in-progress session state for the same authenticated account while Chromium runs tests in parallel workers. Helper fallback can pick a different in-progress session, resulting in nondeterministic resume prompt values (`Step 1` instead of `Step 7`).

**Current Code**:

```typescript
// ❌ Bad (current implementation)
const response = await page.request.get(
  `${authContext.apiUrl}/rest/v1/scripture_sessions?select=id,status,mode,current_step_index&status=eq.in_progress&mode=eq.solo&order=started_at.desc&limit=1`,
  { headers: { apikey: authContext.anonKey, Authorization: `Bearer ${authContext.accessToken}` } }
);
```

**Recommended Fix**:

```typescript
// ✅ Good (recommended approach)
// 1) Capture session id deterministically from scripture_create_session response.
// 2) Use that exact id for later state checks and resume assertions.
const created = await response.json() as { id: string };
const sessionId = created.id;

const { data: session } = await supabaseAdmin
  .from('scripture_sessions')
  .select('id,current_step_index,status')
  .eq('id', sessionId)
  .single();

expect(session.current_step_index).toBe(6); // Step 7 UI
```

**Why This Matters**:
Without strict session identity, parallel runs stay flaky even when app behavior is correct.

---

### 2. Partner Report Assertions Run Before Partner-Complete Preconditions

**Severity**: P0 (Critical)
**Location**: `tests/e2e/scripture/scripture-reflection-2.3.spec.ts:220`, `tests/e2e/scripture/scripture-reflection-2.3.spec.ts:270`
**Criterion**: Coverage / Flakiness
**Knowledge Base**: [timing-debugging.md](../../../testarch/knowledge/timing-debugging.md), [test-healing-patterns.md](../../../testarch/knowledge/test-healing-patterns.md)

**Issue Description**:
The failing tests insert partial partner data and immediately assert partner-visible report UI. In the failing run, the page is in the documented waiting branch (`Waiting for Test User 2's reflections`) so partner message/side-by-side assertions time out.

**Current Code**:

```typescript
// ❌ Bad (current implementation)
await supabaseAdmin.from('scripture_reflections').insert({ /* partner row(s) */ });
await supabaseAdmin.from('scripture_messages').insert({ /* partner message */ });
await expect(page.getByTestId('scripture-report-partner-message')).toBeVisible();
```

**Recommended Fix**:

```typescript
// ✅ Good (recommended approach)
await seedPartnerCompleteState(supabaseAdmin, sessionId, testSession.test_user2_id!);

await expect.poll(async () => {
  const { data } = await supabaseAdmin
    .from('scripture_reflections')
    .select('step_index')
    .eq('session_id', sessionId)
    .eq('user_id', testSession.test_user2_id!);
  return data?.length ?? 0;
}).toBeGreaterThan(0);

await expect(page.getByTestId('scripture-report-partner-message')).toBeVisible();
```

**Why This Matters**:
This is a classic readiness race. Deterministic precondition polling removes 60s timeout failures.

---

### 3. Ambiguous Rating Assertions on Mixed-Content Container

**Severity**: P1 (High)
**Location**: `tests/e2e/scripture/scripture-reflection-2.3.spec.ts:271`
**Criterion**: Determinism / Explicit Assertions
**Knowledge Base**: [selector-resilience.md](../../../testarch/knowledge/selector-resilience.md)

**Issue Description**:
`toContainText('3')` passes on verse text (`Psalm 147:3`) instead of rating-specific UI. This hides real branch/state issues and creates false positives.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
await expect(page.getByTestId('scripture-report-rating-step-0')).toContainText('3');
await expect(page.getByTestId('scripture-report-rating-step-0')).toContainText('5');
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
await expect(page.getByTestId('scripture-report-rating-step-0-user')).toHaveText('3');
await expect(page.getByTestId('scripture-report-rating-step-0-partner')).toHaveText('5');
```

**Why This Matters**:
Precision assertions are required for stable branch-level E2E confidence.

---

## Recommendations (Should Fix)

### 1. Introduce Worker-Isolated Scripture Users

**Severity**: P1 (High)
**Location**: `tests/support/auth-setup.ts`, `tests/support/helpers.ts`
**Criterion**: Isolation
**Knowledge Base**: [auth-session.md](../../../testarch/knowledge/auth-session.md)

Use worker-specific accounts or serialized execution for stateful scripture specs to prevent shared-session collisions.

### 2. Split 2.3 Report Assertions by Branch

**Severity**: P2 (Medium)
**Location**: `tests/e2e/scripture/scripture-reflection-2.3.spec.ts`
**Criterion**: Coverage
**Knowledge Base**: [test-healing-patterns.md](../../../testarch/knowledge/test-healing-patterns.md)

Create explicit tests for waiting branch vs partner-complete branch with strict setup gates.

### 3. Promote Retry/Timeout Constants to Config

**Severity**: P3 (Low)
**Location**: `tests/support/helpers.ts:24`
**Criterion**: Maintainability
**Knowledge Base**: [timing-debugging.md](../../../testarch/knowledge/timing-debugging.md)

Move helper retry constants to configurable env/test settings for easier CI tuning.

---
## Best Practices Found

### 1. Network Monitor Guardrails Configured Correctly

**Location**: `tests/support/merged-fixtures.ts:27`
**Pattern**: Network Error Monitoring with targeted exclusions
**Knowledge Base**: [network-error-monitor.md](../../../testarch/knowledge/network-error-monitor.md)

The fixture composition includes `createNetworkErrorMonitorFixture` with explicit exclusions and `maxTestsPerError`, which prevents domino failures while keeping genuine backend regressions visible.

### 2. Deterministic API Wait Pattern in Helpers

**Location**: `tests/support/helpers.ts:372`, `tests/support/helpers.ts:423`
**Pattern**: `waitForResponse` synchronization
**Knowledge Base**: [timing-debugging.md](../../../testarch/knowledge/timing-debugging.md)

The core scripture flow avoids hard waits and consistently gates progression on network confirmation.

### 3. Selector Contract Usage

**Location**: `tests/e2e/scripture/scripture-overview.spec.ts:220`, `tests/e2e/scripture/scripture-reflection-2.3.spec.ts:217`
**Pattern**: `data-testid` first
**Knowledge Base**: [selector-resilience.md](../../../testarch/knowledge/selector-resilience.md)

Primary selectors are stable and intentional; remaining instability is mostly assertion granularity, not selector strategy.

---

## Test File Analysis

### File Metadata

- **Reviewed Files**:
  - `tests/e2e/scripture/scripture-overview.spec.ts` (278 lines, 9.76 KB)
  - `tests/e2e/scripture/scripture-reflection-2.3.spec.ts` (278 lines, 10.00 KB)
- **Test Framework**: Playwright
- **Language**: TypeScript

### Test Structure

- **Describe Blocks**: 13 total
- **Test Cases (it/test)**: 13 total
- **Average Test Length**: 42.8 lines/test
- **Fixtures Used**: `merged-fixtures`, shared scripture helpers
- **Data Factories Used**: direct admin inserts; no dedicated partner-complete factory in failing scenarios

### Test Coverage Scope

- **Test IDs**: `P1-006`, `P1-007`, `P1-008`, `P1-009`, `2.3-E2E-001`, `2.3-E2E-002`, `2.3-E2E-003`, `2.3-E2E-005`
- **Priority Distribution**:
  - P0 (Critical): 2
  - P1 (High): 5
  - P2 (Medium): 1
  - P3 (Low): 0
  - Unknown/Unmarked: 5

### Assertions Analysis

- **Total Assertions**: 66
- **Assertions per Test**: 5.1 average
- **Assertion Types**: visibility, text content, DB persistence checks (`expect.poll`), response gating

---

## Context and Integration

### Related Artifacts

- **Story 1.2 AC**: `/Users/sallvain/Projects/My-Love/_bmad-output/implementation-artifacts/1-2-navigation-and-overview-page/acceptance-criteria.md`
- **Story 2.3 Spec**: `/Users/sallvain/Projects/My-Love/_bmad-output/implementation-artifacts/2-3-daily-prayer-report-send-and-view.md`
- **Test Design Epic 2**: `/Users/sallvain/Projects/My-Love/_bmad-output/test-design-epic-2.md`
- **Framework Config**: `/Users/sallvain/Projects/My-Love/playwright.config.ts`

### Acceptance Criteria Validation

| Acceptance Criterion | Test ID | Status | Notes |
| --- | --- | --- | --- |
| Story 1.2 AC#6 Resume prompt shows correct step | P1-008 | ❌ Failing | Shows `Step 1` instead of expected `Step 7` |
| Story 2.3 AC#3 Daily report shows partner message when available | 2.3-E2E-003 | ❌ Failing | Stuck on waiting branch; partner message not visible |
| Story 2.3 AC#5 Together mode side-by-side partner data | 2.3-E2E-005 | ❌ Failing | Rating container text mismatch due branch/assertion precision |
| Story 2.3 AC#2 Unlinked flow skips compose | 2.3-E2E-002 | ✅ Covered | Passing in current run |

**Coverage in this review scope**: 1/4 criteria passing (25%) for currently failing subset.

---

## Knowledge Base References

This review consulted:

- [test-quality.md](../../../testarch/knowledge/test-quality.md)
- [test-healing-patterns.md](../../../testarch/knowledge/test-healing-patterns.md)
- [selector-resilience.md](../../../testarch/knowledge/selector-resilience.md)
- [timing-debugging.md](../../../testarch/knowledge/timing-debugging.md)
- [network-error-monitor.md](../../../testarch/knowledge/network-error-monitor.md)
- [auth-session.md](../../../testarch/knowledge/auth-session.md)
- [fixtures-composition.md](../../../testarch/knowledge/fixtures-composition.md)

See `/Users/sallvain/Projects/My-Love/_bmad/tea/testarch/tea-index.csv` for full index.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Fix session isolation for resume flow**
   - Priority: P0
   - Owner: E2E / QA
   - Estimated Effort: 2-4 hours

2. **Add partner-complete readiness gates in 2.3 tests**
   - Priority: P0
   - Owner: E2E / QA
   - Estimated Effort: 2-4 hours

3. **Replace ambiguous rating assertions with slot-level selectors**
   - Priority: P1
   - Owner: Frontend + E2E
   - Estimated Effort: 1-2 hours

### Follow-up Actions (Future PRs)

1. **Add dedicated partner-complete data factory fixture**
   - Priority: P2
   - Target: Next sprint

2. **Adopt worker-specific auth/session identities for stateful scripture flows**
   - Priority: P2
   - Target: Next sprint

### Re-Review Needed?

⚠️ Re-review after the three failing tests are fixed and Chromium suite is rerun.

---

## Decision

**Recommendation**: Request Changes

**Rationale**:
The failures are reproducible and not caused by network-monitor regressions. They come from test-state isolation and precondition readiness gaps in stateful scripture scenarios. Because these affect deterministic suite reliability, they should be addressed before considering the suite stable.

---

## Appendix

### Violation Summary by Location

| Line | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- |
| `tests/support/helpers.ts:137` | P0 | Isolation | Unscoped fallback session lookup | Bind assertions to created session id |
| `tests/e2e/scripture/scripture-overview.spec.ts:225` | P0 | Determinism | Fixed step assertion on shared state | Verify backend step for owned session before UI assertion |
| `tests/e2e/scripture/scripture-reflection-2.3.spec.ts:222` | P0 | Coverage/Timing | Partner message asserted before readiness | Add poll-based readiness gate |
| `tests/e2e/scripture/scripture-reflection-2.3.spec.ts:271` | P1 | Explicit Assertions | Rating assertion on mixed-content container | Add slot-level rating test ids |

### Quality Trends

| Review Date | Scope | Score | Grade | Critical Issues | Trend |
| --- | --- | --- | --- | --- | --- |
| 2026-02-07 | Full Chromium suite (prior) | ~66 | D | 7 failing tests | baseline |
| 2026-02-08 | Full Chromium suite (current) | 75 | C | 3 failing tests | ⬆️ Improved |

### Related Reviews

| File | Score | Grade | Critical | Status |
| --- | --- | --- | --- | --- |
| `test-review-story-2.1.md` | 78 | C | 3 | Review complete |
| `test-review-story-2.3.md` | 75 | C | 9 | Review complete |
| `test-review.md` (this file) | 75 | C | 3 | Request Changes |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0 (step-file architecture)
**Review ID**: test-review-scripture-failures-20260208
**Timestamp**: 2026-02-08T02:45:41Z
**Subprocess Execution**: PARALLEL (5 quality dimensions)
**Version**: 1.0
