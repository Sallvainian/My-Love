---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-validation', 'step-04-report']
lastStep: 'step-04-report'
lastSaved: '2026-03-04'
workflowType: 'testarch-test-review'
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/overview.md
  - _bmad/tea/testarch/knowledge/intercept-network-call.md
  - _bmad/tea/testarch/knowledge/fixtures-composition.md
  - _bmad/tea/testarch/knowledge/network-error-monitor.md
  - _bmad/tea/testarch/knowledge/auth-session.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - tests/support/merged-fixtures.ts
  - tests/support/fixtures/auth.ts
---

# Test Quality Review: Auth + Home + Navigation Domain

**Quality Score**: 38/100 (F - Critical Issues)
**Review Date**: 2026-03-04
**Review Scope**: directory (7 files, 3 domains)
**Reviewer**: TEA Agent

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Critical Issues

**Recommendation**: Request Changes

### Key Strengths

- All test files correctly import from `tests/support/merged-fixtures.ts` (playwright-utils integration point exists)
- BDD Given-When-Then structure is present in test comments
- Priority markers (P0) are applied to all tests
- Auth tests correctly use `test.use({ authSessionEnabled: false })` to disable auth for login screen tests

### Key Weaknesses

- 15 of 17 tests are `test.skip()` stubs with zero implementation
- Only 2 tests have actual assertions; both use brittle CSS selectors (`.login-screen`, `.google-signin-button`, `.login-error`, `.submit-button`)
- No playwright-utils fixtures are used (`interceptNetworkCall`, `apiRequest`, `log`, `networkErrorMonitor` all unused)
- Selectors violate selector resilience hierarchy: CSS classes instead of data-testid or ARIA roles
- Raw Playwright API (`page.fill('#email', ...)`, `page.locator('.submit-button').click()`) used instead of playwright-utils patterns

### Summary

The Auth + Home + Navigation test domain is in an early skeletal state. Only `login.spec.ts` and `google-oauth.spec.ts` have implemented tests (3 active tests total, but one test.skip in login). The 5 remaining files (`logout.spec.ts`, `display-name-setup.spec.ts`, `error-boundary.spec.ts`, `welcome-splash.spec.ts`, `routing.spec.ts`) are entirely `test.skip()` stubs with no assertions. The implemented tests use brittle CSS class selectors and raw Playwright APIs instead of the project's playwright-utils fixtures (interceptNetworkCall, apiRequest, log, networkErrorMonitor). These tests were clearly written before playwright-utils v3.14.0 integration and need to be updated to use the merged-fixtures utilities.

---

## Quality Criteria Assessment

| Criterion                            | Status  | Violations | Notes                                              |
| ------------------------------------ | ------- | ---------- | -------------------------------------------------- |
| BDD Format (Given-When-Then)         | PASS    | 0          | All tests have GWT comments                        |
| Test IDs                             | WARN    | 0          | No formal test IDs (e.g., 1.3-E2E-001)            |
| Priority Markers (P0/P1/P2/P3)       | PASS    | 0          | All tests marked [P0]                              |
| Hard Waits (sleep, waitForTimeout)   | PASS    | 0          | No hard waits found                                |
| Determinism (no conditionals)        | PASS    | 0          | No conditionals in test flow                       |
| Isolation (cleanup, no shared state) | PASS    | 0          | No shared state detected                           |
| Fixture Patterns                     | FAIL    | 7          | No playwright-utils fixtures used in any test file |
| Data Factories                       | FAIL    | 1          | Hardcoded credentials in login test                |
| Network-First Pattern                | FAIL    | 2          | No network interception before navigation          |
| Explicit Assertions                  | WARN    | 15         | 15 skipped tests have zero assertions              |
| Test Length (<=300 lines)            | PASS    | 0          | All files well under 300 lines                     |
| Test Duration (<=1.5 min)            | PASS    | 0          | Minimal test content                               |
| Flakiness Patterns                   | WARN    | 2          | CSS selectors are flakiness risk                   |

**Total Violations**: 2 Critical, 3 High, 2 Medium, 2 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -2 x 10 = -20
High Violations:         -3 x 5 = -15
Medium Violations:       -2 x 2 = -4
Low Violations:          -2 x 1 = -2

Bonus Points:
  Excellent BDD:         +5
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +0
  Perfect Isolation:     +0
  All Test IDs:          +0
                         --------
Total Bonus:             +5

Subtotal:                100 - 41 + 5 = 64

Penalty: 15/17 tests are stubs  -26 (proportional: 88% non-functional)

Final Score:             38/100
Grade:                   F
```

---

## Critical Issues (Must Fix)

### 1. No Playwright-Utils Fixtures Used in Any Test

**Severity**: P0 (Critical)
**Location**: All 7 test files
**Criterion**: Fixture Patterns
**Knowledge Base**: [fixtures-composition.md](../../../_bmad/tea/testarch/knowledge/fixtures-composition.md), [overview.md](../../../_bmad/tea/testarch/knowledge/overview.md)

**Issue Description**:
The project has a fully configured `tests/support/merged-fixtures.ts` that exports `test` with `apiRequest`, `recurse`, `log`, `interceptNetworkCall`, and `networkErrorMonitor` fixtures. All 7 test files import from merged-fixtures but never destructure or use any of these fixtures. Tests use raw Playwright APIs (`page.goto`, `page.fill`, `page.locator`) without leveraging the utilities that prevent race conditions and provide structured logging.

**Current Code**:

```typescript
// login.spec.ts:7 - imports merged-fixtures but never uses utilities
import { test, expect } from '../../support/merged-fixtures';

test('[P0] should show error message for invalid credentials', async ({ page }) => {
  await page.goto('/');
  await page.fill('#email', 'invalid@example.com');
  await page.fill('#password', 'wrongpassword');
  await page.locator('.submit-button').click();
  await expect(page.locator('.login-error')).toBeVisible();
});
```

**Recommended Fix**:

```typescript
import { test, expect } from '../../support/merged-fixtures';

test('[P0] should show error message for invalid credentials', async ({ page, interceptNetworkCall, log }) => {
  await log.step('Navigate to login');

  // Intercept auth API BEFORE navigation (network-first pattern)
  const authCall = interceptNetworkCall({
    url: '**/auth/v1/token**',
    method: 'POST',
    fulfillResponse: {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
    },
  });

  await page.goto('/');
  await expect(page.getByTestId('login-screen')).toBeVisible();

  await log.step('Submit invalid credentials');
  await page.getByTestId('email-input').fill('invalid@example.com');
  await page.getByTestId('password-input').fill('wrongpassword');
  await page.getByTestId('submit-button').click();

  await authCall; // Deterministic wait for API response

  await expect(page.getByTestId('login-error')).toBeVisible();
});
```

**Why This Matters**:
Without `interceptNetworkCall`, tests rely on real Supabase API responses, making them slow and non-deterministic. Without `log`, test reports lack structured step logging for debugging failures. The `networkErrorMonitor` fixture (auto-enabled via merged-fixtures) provides free backend error detection but its value is diminished when tests are skipped.

**Related Violations**:
Same issue in all 7 files: `login.spec.ts`, `logout.spec.ts`, `google-oauth.spec.ts`, `display-name-setup.spec.ts`, `error-boundary.spec.ts`, `welcome-splash.spec.ts`, `routing.spec.ts`

---

### 2. Brittle CSS Class Selectors Instead of data-testid or ARIA Roles

**Severity**: P0 (Critical)
**Location**: `tests/e2e/auth/login.spec.ts:21,27,32,35`, `tests/e2e/auth/google-oauth.spec.ts:21`
**Criterion**: Fixture Patterns / Selector Resilience
**Knowledge Base**: [selector-resilience.md](../../../_bmad/tea/testarch/knowledge/selector-resilience.md)

**Issue Description**:
The implemented tests use CSS class selectors (`.login-screen`, `.google-signin-button`, `.login-error`, `.submit-button`) and ID selectors (`#email`, `#password`). These are at the bottom of the selector resilience hierarchy and will break when CSS classes or element IDs change. The test comments even acknowledge this: "LoginScreen uses CSS classes, not data-testid".

**Current Code**:

```typescript
// login.spec.ts:21 - CSS class selector (brittle)
await expect(page.locator('.login-screen')).toBeVisible();

// login.spec.ts:30-32 - ID selectors (brittle)
await page.fill('#email', 'invalid@example.com');
await page.fill('#password', 'wrongpassword');
await page.locator('.submit-button').click();

// google-oauth.spec.ts:21 - CSS class selector (brittle)
await expect(page.locator('.google-signin-button')).toBeVisible();
```

**Recommended Fix**:

```typescript
// Step 1: Add data-testid attributes to LoginScreen component
// Step 2: Update tests to use resilient selectors

// login.spec.ts - data-testid (best) or ARIA role (good)
await expect(page.getByTestId('login-screen')).toBeVisible();

await page.getByRole('textbox', { name: 'Email' }).fill('invalid@example.com');
await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
await page.getByRole('button', { name: /sign in/i }).click();

// google-oauth.spec.ts
await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
```

**Why This Matters**:
CSS class selectors break when styling changes (e.g., Tailwind refactoring). ID selectors break when accessibility improvements rename elements. Both create test maintenance burden and false negatives. The project uses Tailwind CSS v4 where class names change frequently.

---

## Recommendations (Should Fix)

### 1. Implement Skipped Tests Using Playwright-Utils Patterns

**Severity**: P1 (High)
**Location**: All 7 files (15 skipped tests)
**Criterion**: Explicit Assertions
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
15 of 17 tests are `test.skip()` stubs. These provide zero test coverage. The TODO comments reference "Sprint 1 implementation" and "requires authenticated session setup" -- but the auth fixture (`tests/support/fixtures/auth.ts`) already exists and provides `authToken`, `authOptions`, and authenticated `context`/`page`. These tests can now be implemented.

**Current Code**:

```typescript
// logout.spec.ts - entire file is stubs
test('[P0] should sign out and show login screen', async ({ page }) => {
  // TODO: Requires authenticated session setup (Sprint 1 implementation)
  test.skip();
});
```

**Recommended Improvement**:

```typescript
test('[P0] should sign out and show login screen', async ({ page, log }) => {
  await log.step('Verify authenticated state');
  // Auth fixture already provides authenticated page context
  await page.goto('/');
  await expect(page.getByTestId('home-view')).toBeVisible();

  await log.step('Click sign out');
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: /sign out/i }).click();

  await log.step('Verify login screen');
  await expect(page.getByTestId('login-screen')).toBeVisible();
});
```

**Benefits**:
Implementing these tests provides actual P0 coverage for critical auth, navigation, and error handling flows. The auth fixture infrastructure already exists.

**Priority**:
P1 - These are P0 test cases with zero coverage. Auth fixture is ready.

---

### 2. Hardcoded Test Credentials in Login Test

**Severity**: P2 (Medium)
**Location**: `tests/e2e/auth/login.spec.ts:30-31`
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)

**Issue Description**:
The invalid credentials test uses hardcoded email and password strings. While this is for a negative test case (invalid credentials), the pattern should use factory functions or constants for maintainability and test intent clarity.

**Current Code**:

```typescript
await page.fill('#email', 'invalid@example.com');
await page.fill('#password', 'wrongpassword');
```

**Recommended Improvement**:

```typescript
// Use a clearly-named constant or factory for test intent
const invalidCredentials = { email: 'nonexistent@example.com', password: 'wrong-password' };
await page.getByTestId('email-input').fill(invalidCredentials.email);
await page.getByTestId('password-input').fill(invalidCredentials.password);
```

**Benefits**:
Makes test intent explicit. When credentials format requirements change, update one place.

**Priority**:
P2 - Low impact but follows data factory best practices.

---

### 3. Add Network-First Pattern for Login API Calls

**Severity**: P2 (Medium)
**Location**: `tests/e2e/auth/login.spec.ts:24-36`
**Criterion**: Network-First Pattern
**Knowledge Base**: [intercept-network-call.md](../../../_bmad/tea/testarch/knowledge/intercept-network-call.md)

**Issue Description**:
The invalid credentials test clicks submit and expects an error message, but does not intercept the Supabase auth API call. Without interception, the test relies on the real backend being available and returning the expected error format. This makes the test environment-dependent and slower.

**Current Code**:

```typescript
await page.locator('.submit-button').click();
await expect(page.locator('.login-error')).toBeVisible();
```

**Recommended Improvement**:

```typescript
// Intercept BEFORE the action (network-first pattern)
const authCall = interceptNetworkCall({
  url: '**/auth/v1/token**',
  method: 'POST',
  fulfillResponse: {
    status: 400,
    body: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
  },
});

await page.getByRole('button', { name: /sign in/i }).click();
await authCall; // Deterministic wait
await expect(page.getByTestId('login-error')).toBeVisible();
```

**Benefits**:
- Deterministic: test does not depend on Supabase being available
- Fast: no real network roundtrip
- Isolated: test controls exact error response format

**Priority**:
P2 - Important for test reliability when implementing the tests.

---

## Best Practices Found

### 1. Correct Merged-Fixtures Import Pattern

**Location**: All 7 files (line 7)
**Pattern**: Fixture Composition
**Knowledge Base**: [fixtures-composition.md](../../../_bmad/tea/testarch/knowledge/fixtures-composition.md)

**Why This Is Good**:
All test files correctly import `{ test, expect }` from `../../support/merged-fixtures`, which is the recommended pattern for playwright-utils integration. This means all utilities (apiRequest, interceptNetworkCall, log, networkErrorMonitor) are available without any import changes when tests are implemented.

**Code Example**:

```typescript
// All 7 files use this correct pattern
import { test, expect } from '../../support/merged-fixtures';
```

**Use as Reference**:
This pattern should be maintained in all new test files. Never import directly from `@playwright/test` in E2E test files.

---

### 2. Auth Session Opt-Out for Login Screen Tests

**Location**: `tests/e2e/auth/login.spec.ts:12`, `tests/e2e/auth/google-oauth.spec.ts:12`
**Pattern**: Auth Session Management
**Knowledge Base**: [auth-session.md](../../../_bmad/tea/testarch/knowledge/auth-session.md)

**Why This Is Good**:
Tests that need to see the unauthenticated login screen correctly use `test.use({ authSessionEnabled: false })` to disable the auth fixture. This is the proper way to opt out of the worker-scoped authentication without affecting other tests.

**Code Example**:

```typescript
test.describe('Login Flow', () => {
  test.use({ authSessionEnabled: false });
  // Tests see login screen instead of authenticated app
});
```

**Use as Reference**:
Any test that needs to verify unauthenticated behavior should use this opt-out pattern.

---

### 3. BDD Structure in Test Comments

**Location**: All 7 files
**Pattern**: Test Organization
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Why This Is Good**:
All tests use consistent Given-When-Then comments to document test intent. This makes tests self-documenting and easier to maintain.

**Code Example**:

```typescript
test('[P0] should display login screen when not authenticated', async ({ page }) => {
  // GIVEN: User is not authenticated
  await page.goto('/');
  // WHEN: Page loads
  // THEN: Login screen is visible
  await expect(page.locator('.login-screen')).toBeVisible();
});
```

**Use as Reference**:
Maintain GWT structure in all test implementations.

---

## Test File Analysis

### File Metadata

| File | Lines | KB | Tests | Active | Skipped |
|------|-------|----|-------|--------|---------|
| `tests/e2e/auth/login.spec.ts` | 54 | 1.5 | 4 | 2 | 2 |
| `tests/e2e/auth/logout.spec.ts` | 26 | 0.7 | 2 | 0 | 2 |
| `tests/e2e/auth/google-oauth.spec.ts` | 32 | 0.9 | 2 | 1 | 1 |
| `tests/e2e/auth/display-name-setup.spec.ts` | 24 | 0.6 | 2 | 0 | 2 |
| `tests/e2e/home/error-boundary.spec.ts` | 24 | 0.6 | 2 | 0 | 2 |
| `tests/e2e/home/welcome-splash.spec.ts` | 24 | 0.6 | 2 | 0 | 2 |
| `tests/e2e/navigation/routing.spec.ts` | 31 | 0.8 | 3 | 0 | 3 |
| **TOTAL** | **215** | **5.7** | **17** | **3** | **14** |

- **Test Framework**: Playwright
- **Language**: TypeScript

### Test Structure

- **Describe Blocks**: 7 (one per file)
- **Test Cases (it/test)**: 17
- **Average Test Length**: ~4 lines per active test (excluding skipped stubs)
- **Fixtures Used**: 1 (`page` only; `authSessionEnabled` as option)
- **Data Factories Used**: 0
- **Playwright-Utils Fixtures Used**: 0 (apiRequest, interceptNetworkCall, log, recurse -- none used)

### Test Scope

- **Test IDs**: None (no formal IDs like 1.3-E2E-001)
- **Priority Distribution**:
  - P0 (Critical): 17 tests
  - P1 (High): 0 tests
  - P2 (Medium): 0 tests
  - P3 (Low): 0 tests
  - Unknown: 0 tests

### Assertions Analysis

- **Total Assertions**: 4 (across 3 active tests)
- **Assertions per Test**: 1.3 (avg, active tests only)
- **Assertion Types**: `toBeVisible()` (4 occurrences)

---

## Context and Integration

### Related Artifacts

- **Auth Fixture**: [tests/support/fixtures/auth.ts](../../../tests/support/fixtures/auth.ts) - Worker-scoped auth with SupabaseAuthProvider
- **Merged Fixtures**: [tests/support/merged-fixtures.ts](../../../tests/support/merged-fixtures.ts) - Full playwright-utils integration
- **Test Design**: Not found for this domain
- **Story File**: Not found for this domain

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[overview.md](../../../_bmad/tea/testarch/knowledge/overview.md)** - Playwright-utils installation, design principles, fixture patterns
- **[intercept-network-call.md](../../../_bmad/tea/testarch/knowledge/intercept-network-call.md)** - Network spy/stub, JSON parsing for UI tests
- **[fixtures-composition.md](../../../_bmad/tea/testarch/knowledge/fixtures-composition.md)** - mergeTests composition patterns for combining utilities
- **[network-error-monitor.md](../../../_bmad/tea/testarch/knowledge/network-error-monitor.md)** - HTTP 4xx/5xx detection for UI tests
- **[auth-session.md](../../../_bmad/tea/testarch/knowledge/auth-session.md)** - Token persistence, multi-user, API and browser authentication
- **[data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)** - Factory functions with overrides, API-first setup
- **[selector-resilience.md](../../../_bmad/tea/testarch/knowledge/selector-resilience.md)** - Robust selector strategies and debugging techniques
- **[test-healing-patterns.md](../../../_bmad/tea/testarch/knowledge/test-healing-patterns.md)** - Common failure patterns and automated fixes

For coverage mapping, consult `trace` workflow outputs.

See [tea-index.csv](../../../_bmad/tea/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Add data-testid attributes to LoginScreen component** - Replace CSS class selectors
   - Priority: P0
   - Owner: Frontend dev
   - Estimated Effort: 30 min

2. **Update login.spec.ts selectors to data-testid/ARIA** - Remove brittle CSS/ID selectors
   - Priority: P0
   - Owner: Test engineer
   - Estimated Effort: 15 min

### Follow-up Actions (Future PRs)

1. **Implement 15 skipped test stubs** - Auth fixture infrastructure is ready
   - Priority: P1
   - Target: Sprint 1 completion

2. **Add interceptNetworkCall to all auth tests** - Use network-first pattern for Supabase API calls
   - Priority: P1
   - Target: Sprint 1 completion

3. **Add log.step() to all tests** - Enable structured Playwright report logging
   - Priority: P2
   - Target: next_milestone

4. **Add formal test IDs** - Format: `{epic}.{story}-E2E-{seq}`
   - Priority: P3
   - Target: backlog

### Re-Review Needed?

- Re-review after critical fixes - request changes, then re-review once skipped tests are implemented

---

## Decision

**Recommendation**: Request Changes

**Rationale**:
Test quality is insufficient with 38/100 score. The domain has 17 P0 test cases but only 3 are implemented, and those 3 use brittle CSS class selectors that violate the selector resilience hierarchy. No playwright-utils fixtures are used despite the project having a fully configured merged-fixtures.ts. The auth fixture infrastructure (SupabaseAuthProvider, worker-scoped authentication) is ready and should unblock implementation of the 15 skipped tests. Critical fixes needed: (1) add data-testid attributes to LoginScreen component, (2) update existing selectors, (3) implement skipped test stubs using interceptNetworkCall and log fixtures.

**For Request Changes**:

> Test quality needs improvement with 38/100 score. 15 of 17 P0 tests are unimplemented stubs. The 2 active tests use brittle CSS selectors and no playwright-utils fixtures. Auth fixture infrastructure exists and should unblock full implementation. Add data-testid attributes to login components and implement tests using interceptNetworkCall for deterministic network behavior.

---

## Appendix

### Violation Summary by Location

| File | Line | Severity | Criterion | Issue | Fix |
| ---- | ---- | -------- | --------- | ----- | --- |
| login.spec.ts | 21 | P0 | Selector Resilience | `.login-screen` CSS selector | Use `getByTestId('login-screen')` |
| login.spec.ts | 27 | P0 | Selector Resilience | `.login-screen` CSS selector | Use `getByTestId('login-screen')` |
| login.spec.ts | 30 | P1 | Selector Resilience | `#email` ID selector | Use `getByRole('textbox', { name: 'Email' })` |
| login.spec.ts | 31 | P1 | Selector Resilience | `#password` ID selector | Use `getByRole('textbox', { name: 'Password' })` |
| login.spec.ts | 32 | P0 | Selector Resilience | `.submit-button` CSS selector | Use `getByRole('button', { name: /sign in/i })` |
| login.spec.ts | 35 | P1 | Selector Resilience | `.login-error` CSS selector | Use `getByTestId('login-error')` |
| login.spec.ts | 24-36 | P2 | Network-First | No interception before auth API call | Add `interceptNetworkCall` |
| login.spec.ts | 30-31 | P2 | Data Factories | Hardcoded credentials | Use constants or factory |
| google-oauth.spec.ts | 21 | P0 | Selector Resilience | `.google-signin-button` CSS selector | Use `getByRole('button', { name: /google/i })` |
| All files | all | P0 | Fixture Patterns | No playwright-utils fixtures used | Destructure and use `interceptNetworkCall`, `log` |
| 15 tests | all | P1 | Assertions | `test.skip()` with zero coverage | Implement using auth fixture + playwright-utils |

### Related Reviews

| File | Score | Grade | Critical | Status |
| ---- | ----- | ----- | -------- | ------ |
| login.spec.ts | 45/100 | F | 4 | Request Changes |
| logout.spec.ts | 30/100 | F | 1 | Request Changes |
| google-oauth.spec.ts | 42/100 | F | 2 | Request Changes |
| display-name-setup.spec.ts | 30/100 | F | 1 | Request Changes |
| error-boundary.spec.ts | 30/100 | F | 1 | Request Changes |
| welcome-splash.spec.ts | 30/100 | F | 1 | Request Changes |
| routing.spec.ts | 30/100 | F | 1 | Request Changes |

**Suite Average**: 38/100 (F)

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-auth-home-nav-20260304
**Timestamp**: 2026-03-04
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `_bmad/tea/testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters - if a pattern is justified, document it with a comment.
