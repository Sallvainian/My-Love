# Test Design: Epic 1 - Authentication E2E Tests

> **Epic:** TD-1.1 - Auth E2E Regeneration
> **Story:** TD-1.1 - Regenerate authentication E2E tests
> **Author:** TEA (Test Engineering Architect)
> **Generated:** 2025-12-07
> **Quality Target:** 90+ (replacing archived tests scoring 52/100)

---

## 1. Scope & Objectives

### 1.1 Test Scope

This test design covers all authentication-related E2E scenarios for the My-Love PWA:

| Component | In Scope | Out of Scope |
|-----------|----------|--------------|
| Email/Password Login | Yes | Password complexity validation (unit) |
| Google OAuth Login | Yes | OAuth provider behavior |
| Session Persistence | Yes | Token refresh internals (integration) |
| Logout Flow | Yes | Backend session cleanup (API) |
| Form Validation | Yes | Validation regex (unit) |
| Error States | Yes | Rate limiting (NFR) |

### 1.2 Objectives

1. **Replace archived tests** - Current auth.spec.ts scored 52/100 due to anti-patterns
2. **Ensure deterministic behavior** - Zero conditional flow, no error swallowing
3. **P0 coverage for security-critical paths** - Login, logout, session handling
4. **Establish auth fixture pattern** - Reusable authenticated state for other tests

---

## 2. Risk Assessment

### 2.1 Risk Scoring (Probability x Impact)

| Risk ID | Category | Description | Probability | Impact | Score | Priority |
|---------|----------|-------------|-------------|--------|-------|----------|
| AUTH-R1 | SEC | Invalid credentials accepted | 2 | 3 | 6 | P0 |
| AUTH-R2 | SEC | Session not invalidated on logout | 2 | 3 | 6 | P0 |
| AUTH-R3 | BUS | Valid user cannot login | 2 | 3 | 6 | P0 |
| AUTH-R4 | DATA | Session persists after browser close | 2 | 2 | 4 | P1 |
| AUTH-R5 | TECH | OAuth redirect fails | 2 | 2 | 4 | P1 |
| AUTH-R6 | BUS | Form validation blocks valid input | 1 | 2 | 2 | P2 |
| AUTH-R7 | TECH | Loading states not shown | 1 | 1 | 1 | P3 |

### 2.2 Risk Scoring Legend

- **Probability:** 1=Low (unlikely), 2=Medium (possible), 3=High (likely)
- **Impact:** 1=Low (cosmetic), 2=Medium (degraded experience), 3=High (security/data loss)
- **Score:** Probability x Impact (1-9)

### 2.3 Gate Criteria

| Score | Action Required |
|-------|-----------------|
| 9 | BLOCKER - Cannot ship without mitigation |
| 6-8 | HIGH - Requires test coverage + mitigation plan |
| 4-5 | MEDIUM - Should have test coverage |
| 1-3 | LOW - Test if time permits |

---

## 3. Test Scenarios

### 3.1 P0 - Critical (Must Pass Before Deploy)

These scenarios cover security-critical and revenue-impacting flows.

#### P0-AUTH-001: Valid Email/Password Login

```yaml
test_id: P0-AUTH-001
title: User can login with valid email and password
preconditions:
  - User exists in Supabase Auth
  - User has verified email
  - No active session exists
steps:
  1: Navigate to root URL (/)
  2: Wait for login form to be visible (getByLabel('Email'))
  3: Fill email input with valid credentials
  4: Fill password input with valid credentials
  5: Setup waitForResponse for auth API call
  6: Click Sign In button
  7: Wait for auth response (status < 300)
  8: Assert navigation heading is hidden
  9: Assert main navigation is visible
assertions:
  - Auth API responds with 2xx status
  - Login heading disappears
  - Main app navigation appears
  - URL changes from /login or / to authenticated route
risk_coverage: AUTH-R3
priority: P0
```

#### P0-AUTH-002: Invalid Credentials Rejection

```yaml
test_id: P0-AUTH-002
title: Login fails with clear error for invalid credentials
preconditions:
  - No user exists with test email OR password is wrong
steps:
  1: Navigate to root URL
  2: Wait for login form
  3: Fill email with invalid@example.com
  4: Fill password with wrongpassword
  5: Click Sign In button
  6: Wait for error state (alert role or error text)
assertions:
  - Error message is visible (getByRole('alert') OR getByText(/invalid|error/i))
  - User remains on login page
  - Email input still visible (not navigated away)
risk_coverage: AUTH-R1
priority: P0
anti_patterns_to_avoid:
  - Do NOT use .catch(() => false) on isVisible checks
  - Do NOT use conditional flow to handle "maybe error, maybe not"
```

#### P0-AUTH-003: Logout Clears Session

```yaml
test_id: P0-AUTH-003
title: User can logout and session is cleared
preconditions:
  - User is logged in (use auth fixture storageState)
steps:
  1: Navigate to authenticated page with storageState
  2: Assert main navigation is visible (confirms logged in)
  3: Click logout button (getByTestId('nav-logout'))
  4: Wait for login form to appear
assertions:
  - Login heading appears (Welcome Back or Sign In)
  - Main navigation disappears
  - Subsequent navigation to protected route redirects to login
risk_coverage: AUTH-R2
priority: P0
```

### 3.2 P1 - High (Should Pass Before Deploy)

#### P1-AUTH-004: Session Persists After Page Reload

```yaml
test_id: P1-AUTH-004
title: Authenticated session survives page refresh
preconditions:
  - User logged in via storageState
steps:
  1: Navigate to authenticated page
  2: Assert logged-in state (navigation visible)
  3: Reload page (page.reload())
  4: Wait for page load
  5: Assert still logged in (navigation visible)
assertions:
  - Navigation still visible after reload
  - No redirect to login page
  - Session token still valid (no auth errors in console)
risk_coverage: AUTH-R4
priority: P1
```

#### P1-AUTH-005: OAuth Button Present and Clickable

```yaml
test_id: P1-AUTH-005
title: Google OAuth login button is functional
preconditions:
  - User on login page
  - OAuth is configured in Supabase
steps:
  1: Navigate to root URL
  2: Wait for login form
  3: Assert Google OAuth button exists
  4: Assert button is enabled (not disabled)
  5: Click button and intercept OAuth redirect
assertions:
  - OAuth button visible (getByRole('button', { name: /google|continue with google/i }))
  - Button is enabled
  - Click initiates navigation (URL changes or popup opens)
risk_coverage: AUTH-R5
priority: P1
note: "Full OAuth flow cannot be tested without mocking; verify button functionality only"
```

#### P1-AUTH-006: Unauthenticated User Redirected to Login

```yaml
test_id: P1-AUTH-006
title: Protected routes redirect to login when not authenticated
preconditions:
  - No session exists (empty storageState)
steps:
  1: Navigate directly to protected route (/dashboard or /notes)
  2: Wait for redirect
  3: Assert on login page
assertions:
  - URL is / or /login
  - Login form visible
  - No authenticated content visible
risk_coverage: AUTH-R2
priority: P1
```

### 3.3 P2 - Medium (Nice to Have)

#### P2-AUTH-007: Empty Form Shows Validation

```yaml
test_id: P2-AUTH-007
title: Submitting empty form shows validation errors
preconditions:
  - On login page
steps:
  1: Navigate to login page
  2: Do NOT fill any fields
  3: Click Sign In button (if enabled) OR assert button is disabled
assertions:
  - EITHER button is disabled for empty form
  - OR validation error appears on click
  - User remains on login page
risk_coverage: AUTH-R6
priority: P2
implementation_note: |
  This test previously had conditional flow. New implementation must pick ONE path:
  - If app disables button for empty form -> assert isDisabled
  - If app shows validation on submit -> click and assert error
  DO NOT test both paths in same test
```

#### P2-AUTH-008: Invalid Email Format Validation

```yaml
test_id: P2-AUTH-008
title: Invalid email format shows inline validation
preconditions:
  - On login page
steps:
  1: Fill email with "notanemail"
  2: Fill password with any value
  3: Click Sign In OR blur email field
assertions:
  - Validation error visible for email field
  - Submission blocked or server error shown
risk_coverage: AUTH-R6
priority: P2
```

### 3.4 P3 - Low (If Time Permits)

#### P3-AUTH-009: Loading State During Login

```yaml
test_id: P3-AUTH-009
title: Login button shows loading state during auth
preconditions:
  - On login page
steps:
  1: Fill valid credentials
  2: Intercept auth API to add delay
  3: Click Sign In
  4: Assert loading indicator visible
assertions:
  - Button disabled or shows spinner during auth
  - Loading indicator disappears after auth completes
risk_coverage: AUTH-R7
priority: P3
```

---

## 4. Anti-Patterns to Avoid

### 4.1 Identified Anti-Patterns from Archived Tests

The following anti-patterns were found in `tests/e2e-archive-2025-12/auth.spec.ts` and MUST NOT be repeated:

| Line | Anti-Pattern | Problem | Remediation |
|------|--------------|---------|-------------|
| 30-31 | `.catch(() => false)` | Swallows errors, test passes when it should fail | Use `.or()` locators or proper timeout assertions |
| 53-54 | `.catch(() => false)` on isVisible | Same as above | Let assertions fail naturally |
| 91-92 | `.catch(() => null)` on waitForResponse | Hides API failures | Remove catch, let timeout fail test |
| 154 | `.catch(() => null)` | Same as above | Remove catch |
| 187-196 | Conditional flow `if (!isDisabled)` | Test behavior varies between runs | Pick ONE expected behavior and assert it |

### 4.2 Pattern Corrections

**BEFORE (Bad):**
```typescript
// Line 187-196 of archived auth.spec.ts
const isDisabled = await submitButton.isDisabled().catch(() => false);
if (!isDisabled) {
  await submitButton.click();
  await expect(emailInput).toBeVisible();
} else {
  expect(isDisabled).toBe(true);
}
```

**AFTER (Good):**
```typescript
// Option A: App disables button for empty form
await expect(submitButton).toBeDisabled();

// Option B: App shows validation on click
await submitButton.click();
await expect(page.getByText(/email is required/i)).toBeVisible();
```

### 4.3 Required Patterns

All new auth tests MUST follow these patterns:

| Pattern | Example |
|---------|---------|
| Network-first intercept | `const resp = page.waitForResponse('**/auth/**'); await btn.click(); await resp;` |
| Deterministic waits | `await expect(nav).toBeVisible({ timeout: 10000 })` |
| No error swallowing | No `.catch(() => false/null)` patterns |
| Single assertion path | No `if/else` controlling which assertions run |
| Accessibility selectors | `getByRole()`, `getByLabel()` over `locator()` |

---

## 5. Test Data Requirements

### 5.1 Test Users

| User Type | Email | Password | Purpose |
|-----------|-------|----------|---------|
| Valid User | `${VITE_TEST_USER_EMAIL}` | `${VITE_TEST_USER_PASSWORD}` | Happy path login |
| Invalid Email | `invalid@example.com` | any | Error handling |
| Invalid Password | valid email | `wrongpassword` | Error handling |

### 5.2 Environment Variables

```bash
VITE_TEST_USER_EMAIL=test@example.com
VITE_TEST_USER_PASSWORD=testpassword123
```

### 5.3 Auth Fixture (storageState)

For tests requiring authenticated state, use pre-generated `storageState.json`:

```typescript
// playwright.config.ts - already configured
projects: [
  {
    name: 'logged-in',
    use: { storageState: 'tests/e2e/.auth/storageState.json' },
  },
  {
    name: 'auth',
    testMatch: /auth\.spec\.ts/,
    use: { storageState: { cookies: [], origins: [] } }, // Empty state
  },
]
```

---

## 6. Coverage Traceability Matrix

| Acceptance Criteria | Test ID | Priority | Status |
|---------------------|---------|----------|--------|
| User can login with email/password | P0-AUTH-001 | P0 | Planned |
| Invalid login shows error | P0-AUTH-002 | P0 | Planned |
| User can logout | P0-AUTH-003 | P0 | Planned |
| Session survives refresh | P1-AUTH-004 | P1 | Planned |
| OAuth button functional | P1-AUTH-005 | P1 | Planned |
| Protected routes require auth | P1-AUTH-006 | P1 | Planned |
| Empty form validation | P2-AUTH-007 | P2 | Planned |
| Invalid email validation | P2-AUTH-008 | P2 | Planned |
| Loading state shown | P3-AUTH-009 | P3 | Deferred |

---

## 7. Implementation Notes

### 7.1 File Structure

```
tests/e2e/
├── auth.spec.ts           # All auth tests (regenerated)
├── global-setup.ts        # Pre-login for storageState
└── .auth/
    └── storageState.json  # Authenticated session state
```

### 7.2 Implementation Order

1. **P0 tests first** - Critical security paths
2. **Auth fixture** - Ensure storageState works for other tests
3. **P1 tests** - Core functionality
4. **P2 tests** - If time permits

### 7.3 Quality Gates Before Merge

- [ ] All P0 tests pass
- [ ] All P1 tests pass
- [ ] No `.catch(() => false/null)` patterns
- [ ] No conditional flow control in test bodies
- [ ] No `waitForTimeout()` calls
- [ ] All assertions guaranteed to execute
- [ ] Pre-commit hook passes

---

## 8. Appendix

### A. Reference Documents

- [E2E Quality Standards](../04-Testing-QA/e2e-quality-standards.md)
- [Architecture - Auth Section](../02-Architecture/architecture.md#authentication-flow)
- [TEA Auth Session Knowledge](../../.bmad/bmm/testarch/knowledge/auth-session.md)
- [Risk Governance](../../.bmad/bmm/testarch/knowledge/risk-governance.md)

### B. Archived Tests Location

Original tests preserved at: `tests/e2e-archive-2025-12/auth.spec.ts`

### C. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-07 | TEA | Initial test design document |

---

*This document is part of Epic TD-1: Test Quality Remediation. See [tech-spec-epic-td-1.md](./tech-spec-epic-td-1.md) for full context.*
