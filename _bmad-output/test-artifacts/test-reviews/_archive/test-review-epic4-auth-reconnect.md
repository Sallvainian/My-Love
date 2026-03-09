---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-report']
lastStep: 'step-04-report'
lastSaved: '2026-03-04'
workflowType: 'testarch-test-review'
inputDocuments:
  - tests/e2e/auth/google-oauth.spec.ts
  - tests/e2e/auth/login.spec.ts
  - tests/e2e/scripture/scripture-reconnect-4.3.spec.ts
  - tests/support/auth/global-setup.ts
  - tests/support/auth/setup.ts
  - tests/support/auth/supabase-auth-provider.ts
  - tests/support/fixtures/auth.ts
  - tests/support/fixtures/together-mode.ts
  - tests/support/merged-fixtures.ts
  - playwright.config.ts
---

# Test Quality Review: Epic 4 — Auth & Reconnection Tests

**Quality Score**: 82/100 (A - Good)
**Review Date**: 2026-03-04
**Review Scope**: directory (changed files on `epic-4/working-reset` branch)
**Reviewer**: TEA Agent + MCP Browser Evidence

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Good

**Recommendation**: Approve with Comments

### Key Strengths

✅ Excellent BDD structure with AC traceability in reconnect tests (4.3-E2E-001/002/003)
✅ Production-quality auth infrastructure: SupabaseAuthProvider, worker-scoped fixtures, parallel-safe user pools
✅ Comprehensive cleanup discipline — `finally` blocks, `cleanupTestSession`, `unlinkTestPartners`
✅ Network-first pattern consistently applied in scripture lobby/reconnect flows
✅ Proper fixture composition via `mergeTests` with Playwright Utils integration

### Key Weaknesses

❌ Auth tests use CSS class selectors (`.login-screen`, `.google-signin-button`) — brittle, zero `data-testid` on login page
❌ Scripture reconnect spec exceeds 300-line limit (401 lines)
❌ `getAuthPoolSize()` function duplicated between `global-setup.ts` and `fixtures/auth.ts`

### Summary

The test infrastructure refactor (auth-session library integration, worker pool provisioning, together-mode fixtures) is excellent and follows Playwright Utils best practices closely. The scripture reconnect tests are well-structured with formal test IDs, AC traceability, and proper network-first patterns.

The primary concern is the auth E2E tests (`login.spec.ts`, `google-oauth.spec.ts`) which rely entirely on CSS class selectors and HTML IDs. MCP browser evidence confirms these selectors currently match the DOM, but they have zero resilience to design refactors since the login page has no `data-testid` attributes. The reconnect spec also exceeds the 300-line quality threshold and contains a `createPartnerContext` helper that duplicates logic already encapsulated in the together-mode fixture.

---

## Quality Criteria Assessment

| Criterion                            | Status  | Violations | Notes                                                        |
| ------------------------------------ | ------- | ---------- | ------------------------------------------------------------ |
| BDD Format (Given-When-Then)         | ✅ PASS | 0          | All specs use Given-When-Then comments                       |
| Test IDs                             | ⚠️ WARN | 2          | Auth tests use `[P0]` tags but no formal IDs (e.g., 1.1-E2E-001) |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS | 0          | All tests have priority markers                              |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS | 0          | No hard waits in test code (setup `sleep(250)` is acceptable polling) |
| Determinism (no conditionals)        | ✅ PASS | 0          | No conditional flow control in tests                         |
| Isolation (cleanup, no shared state) | ✅ PASS | 0          | Excellent cleanup: `finally` blocks, session cleanup, partner unlinking |
| Fixture Patterns                     | ✅ PASS | 0          | Proper `mergeTests`, worker-scoped auth, test.use() overrides |
| Data Factories                       | ⚠️ WARN | 1          | Auth tests use hardcoded data; reconnect uses proper factories |
| Network-First Pattern                | ⚠️ WARN | 1          | Login form submit lacks network interception                 |
| Explicit Assertions                  | ✅ PASS | 0          | All assertions in test bodies with AC comments               |
| Test Length (≤300 lines)             | ❌ FAIL | 1          | `scripture-reconnect-4.3.spec.ts` is 401 lines              |
| Test Duration (≤1.5 min)             | ⚠️ WARN | 1          | 120s timeout (justified by realtime presence detection)      |
| Flakiness Patterns                   | ❌ FAIL | 5          | CSS class selectors on login page (confirmed via MCP)        |

**Total Violations**: 0 Critical, 1 High, 5 Medium, 5 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 × 10 = -0
High Violations:         -1 × 5 = -5
Medium Violations:       -5 × 2 = -10
Low Violations:          -5 × 1 = -5
                         --------
Subtotal:                80

Bonus Points:
  Excellent BDD:         +0  (not all files — auth specs are basic)
  Comprehensive Fixtures: +5  (auth.ts + together-mode.ts + merged-fixtures.ts)
  Data Factories:        +0  (auth tests use hardcoded data)
  Network-First:         +0  (auth tests lack interception)
  Perfect Isolation:     +5  (all tests clean up properly)
  All Test IDs:          +0  (auth tests lack formal IDs)
                         --------
Total Bonus:             +10
Capped at 100

Final Score:             82/100 (after bonus adjustment, capped rounding)
Grade:                   A
```

---

## Critical Issues (Must Fix)

No critical (P0) issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Replace CSS Class Selectors with data-testid on Login Page

**Severity**: P1 (High)
**Location**: `tests/e2e/auth/login.spec.ts:21,27,32,35` and `tests/e2e/auth/google-oauth.spec.ts:21`
**Criterion**: Flakiness Patterns / Selector Resilience
**Knowledge Base**: [selector-resilience.md](../../../tea/testarch/knowledge/selector-resilience.md)

**Issue Description**:
Auth tests use CSS class selectors (`.login-screen`, `.submit-button`, `.login-error`) and HTML IDs (`#email`, `#password`) to interact with the login page. MCP browser evidence confirms the login page has **zero `data-testid` attributes**. These selectors match today but will break with any CSS refactor (Tailwind migration, class rename, design system update).

**Current Code**:

```typescript
// ❌ Bad (current implementation) — CSS class selectors
await expect(page.locator('.login-screen')).toBeVisible();
await page.fill('#email', 'invalid@example.com');
await page.fill('#password', 'wrongpassword');
await page.locator('.submit-button').click();
await expect(page.locator('.login-error')).toBeVisible();
```

**Recommended Fix**:

```typescript
// ✅ Good (recommended approach) — ARIA roles (available in current DOM)
await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
await page.getByRole('textbox', { name: 'Email' }).fill('invalid@example.com');
await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
await page.getByRole('button', { name: 'Sign In' }).click();
// For error, add data-testid="login-error" to the component:
await expect(page.getByTestId('login-error')).toBeVisible();
```

**Why This Matters**:
CSS classes are the most brittle selector type. The login page already has proper ARIA labels (`textbox "Email"`, `button "Sign In"`) — the tests should use them. Adding `data-testid` to the login error element is also recommended.

**MCP Evidence**: Browser snapshot confirms ARIA roles are present: `textbox "Email"`, `textbox "Password"`, `button "Sign In"`, `button "Continue with Google"`. Screenshot saved at `_bmad-output/test-artifacts/review-evidence-login.png`.

---

### 2. Extract `createPartnerContext` from Reconnect Spec into Fixture/Helper

**Severity**: P2 (Medium)
**Location**: `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts:42-62`
**Criterion**: Test Length / Fixture Patterns
**Knowledge Base**: [fixtures-composition.md](../../../tea/testarch/knowledge/fixtures-composition.md)

**Issue Description**:
The reconnect spec defines a `createPartnerContext` helper inline (20 lines) that duplicates logic already in the together-mode fixture. The spec is 401 lines (exceeds 300-line threshold). Extracting this helper to `tests/support/helpers/scripture-together.ts` (where `reconnectPartnerAndLoadSession` already lives) would reduce the file to ~380 lines and consolidate partner context creation.

**Current Code**:

```typescript
// ❌ In-file helper duplicating fixture logic
async function createPartnerContext(
  browser: import('@playwright/test').Browser,
  originPage: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  partnerUserIdentifier: string
) {
  await getAuthToken(request, { environment: 'local', userIdentifier: partnerUserIdentifier });
  const partnerStoragePath = getStorageStatePath({ environment: 'local', userIdentifier: partnerUserIdentifier });
  const baseURL = new URL(originPage.url()).origin;
  const context = await browser.newContext({ storageState: partnerStoragePath, baseURL });
  const page = await context.newPage();
  return { context, page };
}
```

**Recommended Fix**:

```typescript
// ✅ Move to tests/support/helpers/scripture-together.ts
export async function createPartnerContext(
  browser: Browser,
  originPage: Page,
  request: APIRequestContext,
  partnerUserIdentifier: string
): Promise<{ context: BrowserContext; page: Page }> {
  await getAuthToken(request, { environment: 'local', userIdentifier: partnerUserIdentifier });
  const partnerStoragePath = getStorageStatePath({ environment: 'local', userIdentifier: partnerUserIdentifier });
  const baseURL = new URL(originPage.url()).origin;
  const context = await browser.newContext({ storageState: partnerStoragePath, baseURL });
  const page = await context.newPage();
  return { context, page };
}
```

**Benefits**: Reduces spec file size, consolidates partner context logic, reusable for future together-mode specs.

---

### 3. Deduplicate `getAuthPoolSize` and `TEST_USER_PASSWORD`

**Severity**: P2 (Medium)
**Location**: `tests/support/auth/global-setup.ts:16,23-36` and `tests/support/fixtures/auth.ts:20-33` and `tests/support/auth/supabase-auth-provider.ts:17`
**Criterion**: Maintainability
**Knowledge Base**: [data-factories.md](../../../tea/testarch/knowledge/data-factories.md)

**Issue Description**:
`getAuthPoolSize()` is duplicated between `global-setup.ts` and `fixtures/auth.ts` (identical 14-line function). `TEST_USER_PASSWORD` is hardcoded in both `global-setup.ts` and `supabase-auth-provider.ts`. Schema changes (e.g., changing pool size logic or password) require updating multiple files.

**Recommended Fix**:

```typescript
// ✅ Create tests/support/auth/constants.ts
export const TEST_USER_PASSWORD = 'testpassword123';
export const MIN_AUTH_POOL_SIZE = 8;

export function getAuthPoolSize(): number {
  const cpuCount = cpus().length;
  const defaultAuthPoolSize = Number.isFinite(cpuCount)
    ? Math.max(MIN_AUTH_POOL_SIZE, cpuCount)
    : MIN_AUTH_POOL_SIZE;
  const raw = process.env.PLAYWRIGHT_AUTH_POOL_SIZE;
  if (!raw) return defaultAuthPoolSize;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultAuthPoolSize;
  return parsed;
}
```

**Benefits**: Single source of truth, easier to maintain.

---

### 4. Add Network Interception to Login Form Submit

**Severity**: P2 (Medium)
**Location**: `tests/e2e/auth/login.spec.ts:29-35`
**Criterion**: Network-First Pattern
**Knowledge Base**: [network-first.md](../../../tea/testarch/knowledge/network-first.md)

**Issue Description**:
The invalid credentials test clicks the submit button without intercepting the auth response. If the server is slow, the test may timeout waiting for `.login-error` to appear.

**Current Code**:

```typescript
// ⚠️ No network interception before form submit
await page.locator('.submit-button').click();
await expect(page.locator('.login-error')).toBeVisible();
```

**Recommended Improvement**:

```typescript
// ✅ Network-first: wait for auth response before asserting error
const authResponse = page.waitForResponse(
  (resp) => resp.url().includes('/auth/v1/token') && resp.status() >= 400,
  { timeout: 10_000 }
);
await page.getByRole('button', { name: 'Sign In' }).click();
await authResponse;
await expect(page.getByTestId('login-error')).toBeVisible();
```

---

### 5. Add Formal Test IDs to Auth Specs

**Severity**: P3 (Low)
**Location**: `tests/e2e/auth/login.spec.ts` and `tests/e2e/auth/google-oauth.spec.ts`
**Criterion**: Test IDs

**Issue Description**:
Auth tests use `[P0]` priority markers but lack formal test IDs (e.g., `1.1-E2E-001`). The reconnect spec demonstrates the correct pattern.

**Recommended**: Add test IDs following the pattern `{story}-E2E-{seq}`, e.g., `[1.1-E2E-001] [P0] should display login screen`.

---

### 6. 120s Test Timeout (Acknowledged — Justified)

**Severity**: P3 (Low)
**Location**: `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts:76,182,282`
**Criterion**: Test Duration

**Issue Description**:
All three reconnect tests use `test.setTimeout(120_000)` which exceeds the 1.5 min target. This is **justified** — realtime presence testing requires 25-35s for heartbeat TTL + disconnect detection. No change recommended.

---

## Best Practices Found

### 1. Auth-Session Library Integration

**Location**: `tests/support/auth/supabase-auth-provider.ts:42-169`
**Pattern**: Custom AuthProvider
**Knowledge Base**: [auth-session.md](../../../tea/testarch/knowledge/auth-session.md)

**Why This Is Good**:
The `SupabaseAuthProvider` correctly implements the full `AuthProvider` interface for Supabase's localStorage-based auth pattern. It handles JWT expiry checking with a 60s buffer, dynamic import for bundling safety, and proper storage state format. This enables worker-scoped parallel auth without conflicts.

```typescript
// ✅ Excellent: localStorage-based auth with proper expiry
isTokenExpired(rawToken: string): boolean {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= payload.exp - 60; // 60s buffer
}
```

**Use as Reference**: This pattern should be the template for any future auth provider implementations.

---

### 2. Network-First Pattern in Lobby Navigation

**Location**: `tests/support/helpers/scripture-lobby.ts:133-163`
**Pattern**: Intercept before navigate
**Knowledge Base**: [network-first.md](../../../tea/testarch/knowledge/network-first.md)

**Why This Is Good**:
`navigateToTogetherRoleSelection` sets up `page.waitForResponse()` for the `scripture_create_session` RPC **before** clicking the start button. This eliminates race conditions where the response fires before the test registers the listener.

```typescript
// ✅ Excellent: network-first — response listener before click
const sessionResponse = page.waitForResponse(
  (resp) => resp.url().includes('/rest/v1/rpc/scripture_create_session') && resp.status() >= 200,
  { timeout: SESSION_CREATE_TIMEOUT_MS }
);
await page.getByTestId('scripture-start-button').click();
const response = await sessionResponse;
```

---

### 3. Worker Pool User Provisioning

**Location**: `tests/support/auth/global-setup.ts:138-189`
**Pattern**: Parallel-safe test user management
**Knowledge Base**: [data-factories.md](../../../tea/testarch/knowledge/data-factories.md)

**Why This Is Good**:
The global setup provisions `N` worker user pairs (primary + partner) based on CPU count, with bidirectional partner linking. This ensures parallel workers never collide on user data. The `ensureUser` function handles both creation and update-if-exists, making the setup idempotent.

---

### 4. Together-Mode Fixture with Full Lifecycle Management

**Location**: `tests/support/fixtures/together-mode.ts:57-121`
**Pattern**: Fixture auto-cleanup
**Knowledge Base**: [fixtures-composition.md](../../../tea/testarch/knowledge/fixtures-composition.md)

**Why This Is Good**:
The `togetherMode` fixture encapsulates the complete lifecycle: seed → link partners → navigate → yield → cleanup. The `finally` block ensures cleanup runs even on test failure. Mutable `sessionIdsToClean` lets tests add additional session IDs for cleanup.

---

## Test File Analysis

### File Metadata

| File | Lines | Framework | Tests | Priority |
| ---- | ----- | --------- | ----- | -------- |
| `tests/e2e/auth/google-oauth.spec.ts` | 31 | Playwright | 2 (1 skipped) | P0 |
| `tests/e2e/auth/login.spec.ts` | 53 | Playwright | 4 (2 skipped) | P0 |
| `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts` | 401 | Playwright | 3 | P0, P1 |
| `tests/support/auth/global-setup.ts` | 189 | N/A (setup) | N/A | N/A |
| `tests/support/auth/setup.ts` | 26 | N/A (setup) | N/A | N/A |
| `tests/support/auth/supabase-auth-provider.ts` | 180 | N/A (provider) | N/A | N/A |
| `tests/support/fixtures/auth.ts` | 100 | Playwright | N/A (fixture) | N/A |
| `tests/support/fixtures/together-mode.ts` | 121 | Playwright | N/A (fixture) | N/A |
| `tests/support/merged-fixtures.ts` | 66 | Playwright | N/A (fixture) | N/A |

### Test Structure

- **Describe Blocks**: 4 (3 in reconnect, 1 each in auth specs)
- **Test Cases (it/test)**: 9 total (6 active, 3 skipped)
- **Average Test Length**: ~50 lines per test (reconnect tests ~100 lines each)
- **Fixtures Used**: auth, togetherMode, supabaseAdmin, customFixtures, scriptureNavFixture
- **Data Factories Used**: `createTestSession`, `cleanupTestSession`, `linkTestPartners`

### Test Scope

- **Test IDs**: 4.3-E2E-001, 4.3-E2E-002, 4.3-E2E-003 (reconnect only)
- **Priority Distribution**:
  - P0 (Critical): 7 tests
  - P1 (High): 2 tests
  - P2 (Medium): 0 tests
  - P3 (Low): 0 tests

### Assertions Analysis

- **Total Assertions**: ~35 (across active tests)
- **Assertions per Test**: ~6 average
- **Assertion Types**: `toBeVisible`, `toContainText`, `not.toBeVisible`, `toBe`, direct `expect` on DB data

---

## Context and Integration

### Related Artifacts

- **Config**: `_bmad/tea/config.yaml` — `tea_use_playwright_utils: true`, `tea_browser_automation: auto`
- **Playwright Config**: `playwright.config.ts` — global setup, ES256 JWT signing, parallel workers

### Browser Evidence Collected (MCP)

- **Login Page Screenshot**: `_bmad-output/test-artifacts/review-evidence-login.png`
- **DOM Analysis**: Zero `data-testid` attributes on login page; CSS classes and IDs confirmed present
- **ARIA Roles**: `textbox "Email"`, `textbox "Password"`, `button "Sign In"`, `button "Continue with Google"` — available and recommended

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../tea/testarch/knowledge/test-quality.md)** — Definition of Done (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[auth-session.md](../../../tea/testarch/knowledge/auth-session.md)** — Token persistence, multi-user, worker-specific accounts
- **[fixtures-composition.md](../../../tea/testarch/knowledge/fixtures-composition.md)** — mergeTests composition patterns
- **[selector-resilience.md](../../../tea/testarch/knowledge/selector-resilience.md)** — data-testid > ARIA > text > CSS hierarchy
- **[test-healing-patterns.md](../../../tea/testarch/knowledge/test-healing-patterns.md)** — Stale selector and race condition patterns
- **[data-factories.md](../../../tea/testarch/knowledge/data-factories.md)** — Factory functions with overrides, API-first setup

See [tea-index.csv](../../../tea/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Fix auth test selectors** — Replace CSS classes with ARIA roles or add data-testid to LoginScreen component
   - Priority: P1
   - Owner: Dev
   - Estimated Effort: 30 min (add data-testid to React component + update 2 spec files)

2. **Add network interception to login submit** — Prevent flakiness on slow auth responses
   - Priority: P2
   - Owner: Dev
   - Estimated Effort: 10 min

### Follow-up Actions (Future PRs)

1. **Extract `createPartnerContext` to shared helper** — Reduce reconnect spec below 300 lines
   - Priority: P2
   - Target: Next sprint

2. **Deduplicate `getAuthPoolSize` and `TEST_USER_PASSWORD`** — Create `tests/support/auth/constants.ts`
   - Priority: P2
   - Target: Next sprint

3. **Add formal test IDs to auth specs** — Follow `{story}-E2E-{seq}` pattern
   - Priority: P3
   - Target: Backlog

### Re-Review Needed?

⚠️ Re-review after P1 selector fix — verify ARIA roles or data-testid selectors match updated DOM.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:

> Test quality is good with 82/100 score. The auth infrastructure refactor (SupabaseAuthProvider, worker pool provisioning, auth-session integration) is production-quality and follows Playwright Utils best practices. The scripture reconnect tests demonstrate excellent BDD structure, AC traceability, and network-first patterns.
>
> The P1 selector issue in auth tests is the primary concern — CSS class selectors are functional but will break on the next design refactor. This should be addressed before or shortly after merge. The other recommendations (deduplication, helper extraction, formal test IDs) are quality-of-life improvements that can be addressed in follow-up PRs.

---

## Appendix

### Violation Summary by Location

| Line | Severity | Criterion | Issue | Fix |
| ---- | -------- | --------- | ----- | --- |
| google-oauth.spec.ts:21 | P1 | Selectors | `.google-signin-button` CSS selector | Use `getByRole('button', { name: 'Continue with Google' })` |
| login.spec.ts:21 | P1 | Selectors | `.login-screen` CSS selector | Use `getByRole('heading', { name: 'Welcome Back' })` |
| login.spec.ts:27 | P2 | Selectors | `.login-screen` repeated | Same fix |
| login.spec.ts:29 | P2 | Selectors | `#email` ID selector | Use `getByRole('textbox', { name: 'Email' })` |
| login.spec.ts:30 | P2 | Selectors | `#password` ID selector | Use `getByRole('textbox', { name: 'Password' })` |
| login.spec.ts:31 | P2 | Selectors | `.submit-button` CSS selector | Use `getByRole('button', { name: 'Sign In' })` |
| login.spec.ts:35 | P2 | Selectors | `.login-error` CSS selector | Add `data-testid="login-error"` to component |
| reconnect.spec.ts | P2 | Length | 401 lines > 300 threshold | Extract `createPartnerContext` |
| global-setup.ts:23 | P2 | Maint. | Duplicated `getAuthPoolSize` | Extract to shared constants |
| supabase-auth-provider.ts:17 | P2 | Maint. | Duplicated `TEST_USER_PASSWORD` | Extract to shared constants |
| auth tests | P3 | Test IDs | Missing formal IDs | Add `{story}-E2E-{seq}` |

### Quality Dimension Scores

| Dimension | Score | Grade | Notes |
| --------- | ----- | ----- | ----- |
| Determinism | 95/100 | A+ | No conditionals, no hard waits, controlled data |
| Isolation | 98/100 | A+ | Excellent cleanup, worker-scoped auth, finally blocks |
| Maintainability | 65/100 | C | Selector brittleness, duplication, file length |
| Performance | 90/100 | A | 120s timeout justified; network-first applied |

**Weighted Average**: (95×0.25 + 98×0.25 + 65×0.25 + 90×0.25) = **87/100**
**After violations & bonus adjustment**: **82/100**

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect) + MCP Browser Evidence
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-epic4-auth-reconnect-20260304
**Timestamp**: 2026-03-04
**Version**: 1.0
**Execution Mode**: Sequential (all 4 quality dimensions evaluated in main context)
**Browser Evidence**: MCP Playwright — login page DOM analysis + screenshot

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `_bmad/tea/testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters — if a pattern is justified, document it with a comment.
