---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-validation', 'step-04-report']
lastStep: 'step-04-report'
lastSaved: '2026-03-04'
workflowType: 'testarch-test-review'
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/intercept-network-call.md
  - _bmad/tea/testarch/knowledge/network-first.md
  - _bmad/tea/testarch/knowledge/fixture-architecture.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - tests/support/merged-fixtures.ts
---

# Test Quality Review: Auth + Home + Navigation Domain (Re-Review)

**Quality Score**: 88/100 (A - Good)
**Review Date**: 2026-03-04
**Review Scope**: directory (7 files, 3 domains)
**Reviewer**: TEA Agent (Re-Review)
**Previous Score**: 38/100 (F - Critical Issues)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Good

**Recommendation**: Approve with Comments

### Key Strengths

- All test files correctly import `{ test, expect }` from `tests/support/merged-fixtures.ts`
- `interceptNetworkCall` used correctly for network-first pattern in login, logout, and Google OAuth tests
- Consistent `data-testid` selectors throughout all 7 files (login-screen, submit-button, google-signin-button, bottom-navigation, nav-home, nav-photos, nav-mood, nav-logout, welcome-splash, etc.)
- `getByRole` used for semantic elements (textbox, heading, button)
- BDD Given-When-Then structure present in all test comments
- All tests marked with `[P0]` priority
- 15 previously-skipped stubs now fully implemented (only 2 remain skipped with valid justification)
- `beforeEach` with `addInitScript` used cleanly for localStorage state in error-boundary and routing tests

### Key Weaknesses

- Password field selected via `#password` CSS ID selector instead of `data-testid` or `getByRole` (login.spec.ts, 2 occurrences)
- Hardcoded credentials in login tests (email/password strings inline rather than factory-generated)
- Two intentionally skipped tests in display-name-setup.spec.ts lack infrastructure to ever be runnable

### Summary

The Auth + Home + Navigation test domain has undergone a dramatic quality improvement from the prior review (38/100 to 88/100). All 15 previously-skipped test stubs have been implemented with real assertions. The critical selector issues from the prior review (`.login-screen`, `.google-signin-button`, `.submit-button` CSS classes) have been replaced with `data-testid` attributes and `getByRole` locators. Network interception now uses `interceptNetworkCall` from playwright-utils with the network-first pattern (intercept before navigate). The 2 remaining skipped tests in `display-name-setup.spec.ts` are intentionally skipped with a clear justification comment explaining the infrastructure dependency.

---

## Quality Criteria Assessment

| Criterion                            | Status  | Violations | Notes                                                          |
| ------------------------------------ | ------- | ---------- | -------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | PASS    | 0          | All tests have GWT comments                                   |
| Test IDs                             | WARN    | 0          | No formal test IDs (e.g., 1.3-E2E-001); [P0] tags present     |
| Priority Markers (P0/P1/P2/P3)       | PASS    | 0          | All tests marked [P0]                                          |
| Hard Waits (sleep, waitForTimeout)   | PASS    | 0          | No hard waits found                                            |
| Determinism (no conditionals)        | PASS    | 0          | No conditionals in test flow                                   |
| Isolation (cleanup, no shared state) | PASS    | 0          | No shared state; localStorage managed via addInitScript        |
| Fixture Patterns                     | PASS    | 0          | merged-fixtures.ts used everywhere; interceptNetworkCall active |
| Data Factories                       | WARN    | 2          | Hardcoded credentials in login tests (minor)                   |
| Network-First Pattern                | PASS    | 0          | interceptNetworkCall set up before navigation in all cases     |
| Explicit Assertions                  | PASS    | 0          | All implemented tests have explicit assertions                 |
| Test Length (<=300 lines)             | PASS    | 0          | All files well under 300 lines (max: 120 lines)               |
| Test Duration (<=1.5 min)            | PASS    | 0          | Tests are lightweight; well under time limit                   |
| Flakiness Patterns                   | WARN    | 2          | `#password` ID selector is minor flakiness risk                |

**Total Violations**: 0 Critical, 0 High, 2 Medium, 2 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 x 10 = -0
High Violations:         -0 x 5 = -0
Medium Violations:       -2 x 2 = -4
Low Violations:          -2 x 1 = -2

Bonus Points:
  Excellent BDD:         +5
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +5
  Perfect Isolation:     +5
  All Test IDs:          +0
                         --------
Total Bonus:             +15
                         (capped at adjusted subtotal)

Subtotal:                94
Deductions applied:      -6

Final Score:             88/100
Grade:                   A (Good)
```

---

## Critical Issues (Must Fix)

No critical issues detected.

---

## Recommendations (Should Fix)

### 1. Replace `#password` ID Selector with data-testid or getByRole

**Severity**: P2 (Medium)
**Location**: `tests/e2e/auth/login.spec.ts:45`, `tests/e2e/auth/login.spec.ts:98`
**Criterion**: Selector Resilience
**Knowledge Base**: [selector-resilience.md](../../../tea/testarch/knowledge/selector-resilience.md)

**Issue Description**:
The password field is selected using `page.locator('#password')` which is a CSS ID selector. Per the selector resilience hierarchy, `data-testid` and `getByRole` are preferred over HTML IDs. All other selectors in the test suite correctly use `data-testid` or `getByRole`, making this inconsistency stand out.

**Current Code**:

```typescript
// line 45, 98
await page.locator('#password').fill(invalidCredentials.password);
await page.locator('#password').fill('valid-password-123');
```

**Recommended Improvement**:

```typescript
// Option A: data-testid (preferred for consistency)
await page.getByTestId('password-input').fill(invalidCredentials.password);

// Option B: getByRole with accessible name (if label is present)
await page.getByRole('textbox', { name: 'Password' }).fill(invalidCredentials.password);
```

**Benefits**:
Consistent selector strategy across the entire test suite. Resilient to HTML ID changes.

**Priority**:
P2 — Not a blocking issue. The `#password` ID is unlikely to change frequently, but consistency with the rest of the suite matters for maintainability.

---

### 2. Use Data Factory for Test Credentials

**Severity**: P3 (Low)
**Location**: `tests/e2e/auth/login.spec.ts:43-44`, `tests/e2e/auth/login.spec.ts:97-98`
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../../tea/testarch/knowledge/data-factories.md)

**Issue Description**:
Login credentials are hardcoded inline (`'nonexistent@example.com'`, `'wrong-password'`, `'test@example.com'`, `'valid-password-123'`). While this is acceptable for auth tests that mock the API response (the credentials don't need to be real), using a simple factory or constant object would make the test intent clearer and reduce magic strings.

**Current Code**:

```typescript
// line 43-44
const invalidCredentials = { email: 'nonexistent@example.com', password: 'wrong-password' };
await page.getByRole('textbox', { name: 'Email' }).fill(invalidCredentials.email);
```

**Recommended Improvement**:

```typescript
// Already partially done — the invalidCredentials object is a good step.
// For full consistency, extract to a shared constant or tiny factory:
const TEST_CREDENTIALS = {
  valid: { email: 'test@example.com', password: 'valid-password-123' },
  invalid: { email: 'nonexistent@example.com', password: 'wrong-password' },
};
```

**Benefits**:
Centralized credential management, self-documenting test intent.

**Priority**:
P3 — Low priority. The current inline approach is already readable and the API is mocked, so the actual values don't matter for test execution.

---

## Best Practices Found

### 1. Network-First Pattern with interceptNetworkCall

**Location**: `tests/e2e/auth/login.spec.ts:29-36`, `tests/e2e/auth/logout.spec.ts:14-21`
**Pattern**: Intercept before navigate
**Knowledge Base**: [intercept-network-call.md](../../../tea/testarch/knowledge/intercept-network-call.md)

**Why This Is Good**:
All network-dependent tests correctly set up `interceptNetworkCall` **before** navigation, then await the call after the triggering action. This eliminates race conditions entirely.

**Code Example**:

```typescript
// login.spec.ts:29-48 — Textbook network-first pattern
const authCall = interceptNetworkCall({
  url: '**/auth/v1/token**',
  method: 'POST',
  fulfillResponse: {
    status: 400,
    body: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
  },
});

await page.goto('/');
await page.getByTestId('submit-button').click();
await authCall; // Deterministic wait
```

**Use as Reference**: This is the canonical pattern for network interception in this project. All future E2E tests that touch Supabase auth endpoints should follow this exact pattern.

---

### 2. Proper Auth State Control with authSessionEnabled

**Location**: `tests/e2e/auth/login.spec.ts:12`, `tests/e2e/auth/google-oauth.spec.ts:12`
**Pattern**: Fixture option override
**Knowledge Base**: [fixture-architecture.md](../../../tea/testarch/knowledge/fixture-architecture.md)

**Why This Is Good**:
Auth tests that need to see the login screen correctly use `test.use({ authSessionEnabled: false })` to disable the shared auth fixture. This is clean and explicit — no workarounds or manual cookie clearing.

**Code Example**:

```typescript
test.describe('Login Flow', () => {
  test.use({ authSessionEnabled: false });
  // Tests now see the unauthenticated state
});
```

**Use as Reference**: Any test that needs to verify unauthenticated UI should use this pattern.

---

### 3. localStorage State Management via addInitScript

**Location**: `tests/e2e/home/error-boundary.spec.ts:11-15`, `tests/e2e/navigation/routing.spec.ts:11-15`
**Pattern**: Deterministic test state
**Knowledge Base**: [test-quality.md](../../../tea/testarch/knowledge/test-quality.md)

**Why This Is Good**:
Tests that need to control the welcome splash state use `page.addInitScript()` to set/remove `lastWelcomeView` in localStorage **before** the page loads. This is deterministic and avoids race conditions vs. setting localStorage after navigation.

**Code Example**:

```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});
```

**Use as Reference**: Use `addInitScript` whenever you need to pre-set localStorage/sessionStorage before the app initializes.

---

### 4. Intentional test.skip() with Documentation

**Location**: `tests/e2e/auth/display-name-setup.spec.ts:1-12`
**Pattern**: Justified skip
**Knowledge Base**: [test-quality.md](../../../tea/testarch/knowledge/test-quality.md)

**Why This Is Good**:
The 2 skipped tests in `display-name-setup.spec.ts` have a detailed multi-line comment explaining exactly why they're skipped (Supabase client manages auth state internally, network interception can't mock this flow, requires a dedicated test user without display_name). This is the right approach — the tests document what needs to be validated, and the skip is justified by a real infrastructure limitation.

---

### 5. OAuth Redirect Interception

**Location**: `tests/e2e/auth/google-oauth.spec.ts:33-38`
**Pattern**: Route interception for OAuth
**Knowledge Base**: [network-first.md](../../../tea/testarch/knowledge/network-first.md)

**Why This Is Good**:
The OAuth redirect test correctly uses `page.route()` to intercept the Supabase `/auth/v1/authorize` endpoint and redirect back to the app, preventing a 404 from the test trying to reach Google's OAuth servers. This is a pragmatic solution that validates the OAuth initiation without requiring real OAuth infrastructure.

---

## Test File Analysis

### File Metadata

| File | Lines | Framework | Tests | Implemented | Skipped |
|------|-------|-----------|-------|-------------|---------|
| `tests/e2e/auth/login.spec.ts` | 120 | Playwright | 4 | 4 | 0 |
| `tests/e2e/auth/logout.spec.ts` | 56 | Playwright | 2 | 2 | 0 |
| `tests/e2e/auth/google-oauth.spec.ts` | 49 | Playwright | 2 | 2 | 0 |
| `tests/e2e/auth/display-name-setup.spec.ts` | 32 | Playwright | 2 | 0 | 2 (justified) |
| `tests/e2e/home/error-boundary.spec.ts` | 48 | Playwright | 2 | 2 | 0 |
| `tests/e2e/home/welcome-splash.spec.ts` | 41 | Playwright | 2 | 2 | 0 |
| `tests/e2e/navigation/routing.spec.ts` | 57 | Playwright | 3 | 3 | 0 |
| **Total** | **403** | | **17** | **15** | **2** |

### Test Structure

- **Describe Blocks**: 7 (one per file)
- **Test Cases (it/test)**: 17 total (15 implemented, 2 intentionally skipped)
- **Average Test Length**: ~15 lines per test
- **Fixtures Used**: `interceptNetworkCall`, `authSessionEnabled`, `page` (via merged-fixtures)
- **Data Factories Used**: 0 (hardcoded credentials — acceptable for auth mock tests)

### Priority Distribution

- P0 (Critical): 17 tests (100%)
- P1 (High): 0 tests
- P2 (Medium): 0 tests
- P3 (Low): 0 tests

### Assertions Analysis

- **Total Assertions**: 30 (across 15 implemented tests)
- **Assertions per Test**: 2.0 (avg)
- **Assertion Types**: `toBeVisible`, `not.toBeVisible`, `toHaveText`, `waitForURL`

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../tea/testarch/knowledge/test-quality.md)** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[intercept-network-call.md](../../../tea/testarch/knowledge/intercept-network-call.md)** - interceptNetworkCall utility patterns
- **[network-first.md](../../../tea/testarch/knowledge/network-first.md)** - Route intercept before navigate (race condition prevention)
- **[fixture-architecture.md](../../../tea/testarch/knowledge/fixture-architecture.md)** - Pure function -> Fixture -> mergeTests pattern
- **[data-factories.md](../../../tea/testarch/knowledge/data-factories.md)** - Factory functions with overrides, API-first setup
- **[selector-resilience.md](../../../tea/testarch/knowledge/selector-resilience.md)** - data-testid > ARIA > text > CSS/ID hierarchy
- **[test-healing-patterns.md](../../../tea/testarch/knowledge/test-healing-patterns.md)** - Common failure patterns and fixes

See [tea-index.csv](../../../tea/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

None required. Tests are production-ready.

### Follow-up Actions (Future PRs)

1. **Replace `#password` selector** - Add `data-testid="password-input"` to the password field component and update login.spec.ts
   - Priority: P2
   - Target: Next cleanup PR

2. **Provision display-name test user** - Create a test user without `display_name` in user_metadata to enable the 2 skipped tests
   - Priority: P3
   - Target: Backlog

### Re-Review Needed?

No re-review needed - approve as-is.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:
Test quality has improved dramatically from the prior review (38/100 to 88/100). All critical issues from the prior review have been resolved: brittle CSS selectors replaced with data-testid/getByRole, 15 test.skip() stubs implemented with real assertions, interceptNetworkCall used for network-first pattern, and all imports correctly reference merged-fixtures.ts. The remaining 2 medium-severity issues (#password selector, hardcoded credentials) are minor and do not affect test reliability or correctness. The 2 intentionally skipped tests in display-name-setup.spec.ts are well-documented and justified.

> Test quality is good with 88/100 score. The 2 minor recommendations (password selector, credential factory) can be addressed in follow-up PRs. Tests are production-ready and follow best practices.

---

## Quality Trends

| Review Date | Score    | Grade | Critical Issues | Trend         |
|-------------|----------|-------|-----------------|---------------|
| 2026-03-04  | 38/100   | F     | 2               | (initial)     |
| 2026-03-04  | 88/100   | A     | 0               | +50 Improved  |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0 (Step-File Architecture)
**Review ID**: test-review-auth-home-nav-20260304-rereview
**Timestamp**: 2026-03-04
**Version**: 2.0 (Re-Review)

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters - if a pattern is justified, document it with a comment.
