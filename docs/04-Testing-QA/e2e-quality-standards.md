# E2E Test Quality Standards

> Mandatory quality gates and anti-pattern prevention for Playwright E2E tests

**Author:** TEA (Test Engineering Architect)
**Created:** 2025-12-07
**Quality Score Target:** 90+ (current: 52/100)

---

## Executive Summary

This document establishes mandatory quality standards for all E2E tests in the My-Love PWA project. Following a comprehensive TEA test-review (December 2025), critical anti-patterns were identified in 12/14 E2E spec files, producing a quality score of **52/100** - providing false confidence that features work when they may not.

**Key Issues Identified:**
- Conditional flow control masking test failures
- Error swallowing hiding real issues
- Runtime `test.skip()` creating non-deterministic test behavior
- No-op assertion paths allowing tests to pass without validating anything

These standards are MANDATORY for all new E2E tests and must be enforced via code review and pre-commit hooks (see TD-1.6).

---

## Quality Gates Checklist

Every E2E test MUST pass ALL of the following quality gates before merge:

### Determinism Gates (Mandatory)

- [ ] **1. No Hard Waits:** Zero `waitForTimeout()`, `page.waitForTimeout()`, or arbitrary delays
- [ ] **2. No Conditional Flow:** No `if/else` controlling test execution paths
- [ ] **3. No Error Swallowing:** No `.catch(() => false)` or `.catch(() => null)` patterns
- [ ] **4. No Runtime Skips:** No `test.skip()` inside test bodies (only at describe level with static conditions)
- [ ] **5. Deterministic Waits:** All waits use `waitForResponse()`, `waitFor({ state })`, or element assertions

### Assertion Gates (Mandatory)

- [ ] **6. Guaranteed Assertions:** Every test path has at least one `expect()` that WILL execute
- [ ] **7. No Soft Assertions:** Avoid `expect.soft()` unless explicitly testing multiple independent conditions
- [ ] **8. Explicit Assertions:** All assertions visible in test body, not hidden in helpers
- [ ] **9. Meaningful Assertions:** Assertions validate behavior, not just presence (e.g., `toHaveText()` over `toBeVisible()`)
- [ ] **10. API Response Validation:** When testing API flows, validate response status AND body

### Selector Gates (Mandatory)

- [ ] **11. Accessibility-First:** Use `getByRole()`, `getByLabel()`, `getByTestId()` over CSS selectors
- [ ] **12. No Brittle Selectors:** Avoid `.nth()` indexes, CSS classes, complex XPath
- [ ] **13. Filter Over Index:** Use `filter({ hasText })` for list selection, not `nth(n)`

### Structure Gates (Mandatory)

- [ ] **14. Test Isolation:** Each test is independent, no shared state between tests
- [ ] **15. Network-First Pattern:** Intercept routes BEFORE navigation
- [ ] **16. Cleanup:** Tests clean up any data they create (via fixtures or afterEach)

---

## Anti-Pattern Reference

### Anti-Pattern 1: Conditional Flow Control (CRITICAL)

**Problem:** Tests use `if/else` to branch execution, meaning different code paths run on different executions. This creates non-deterministic tests that may pass without validating the intended behavior.

**File Evidence:** `tests/e2e/auth.spec.ts:187-196`

```typescript
// ❌ BAD: Test behavior varies based on runtime condition
test('login form validates required fields', async ({ page }) => {
  await page.goto('/');
  const submitButton = page.getByRole('button', { name: /sign in|login/i });

  // ANTI-PATTERN: Test might click OR might not
  const isDisabled = await submitButton.isDisabled().catch(() => false);

  if (!isDisabled) {
    await submitButton.click();
    await expect(emailInput).toBeVisible();  // Only runs sometimes
  } else {
    expect(isDisabled).toBe(true);  // Different assertion path
  }
});
```

```typescript
// ✅ GOOD: Deterministic test with single path
test('login form validates required fields', async ({ page }) => {
  await page.goto('/');
  const submitButton = page.getByRole('button', { name: /sign in|login/i });

  // Test the expected behavior directly
  await expect(submitButton).toBeDisabled();

  // OR if button should be enabled and show validation on click:
  // await submitButton.click();
  // await expect(page.getByText(/email is required/i)).toBeVisible();
});
```

---

### Anti-Pattern 2: Error Swallowing (CRITICAL)

**Problem:** Using `.catch(() => false)` or `.catch(() => null)` silently swallows errors, allowing tests to pass when they should fail. This creates false confidence.

**File Evidence:** `tests/e2e/auth.spec.ts:30-31`, `tests/e2e/mood.spec.ts:25-29`

```typescript
// ❌ BAD: Error swallowed, test continues even on failure
async function handlePostLoginOnboarding(page) {
  await expect.poll(async () => {
    if (await welcomeHeading.isVisible().catch(() => false)) {  // SWALLOWED
      state = 'welcome';
      return true;
    }
    if (await displayNameInput.isVisible().catch(() => false)) { // SWALLOWED
      state = 'onboarding';
      return true;
    }
    return false;
  }).toBe(true);
}
```

```typescript
// ✅ GOOD: Let errors propagate, use proper waiting
async function handlePostLoginOnboarding(page) {
  // Wait for one of the expected states
  const welcomeHeading = page.getByRole('heading', { name: /welcome/i });
  const displayNameInput = page.getByLabel(/display name/i);
  const nav = page.getByTestId('bottom-navigation');

  // Use Playwright's auto-waiting with proper locators
  await expect(
    welcomeHeading.or(displayNameInput).or(nav)
  ).toBeVisible({ timeout: 8000 });

  // Now handle based on what's actually visible
  if (await welcomeHeading.isVisible()) {
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(welcomeHeading).toBeHidden();
  }
}
```

---

### Anti-Pattern 3: Runtime test.skip() (HIGH)

**Problem:** Using `test.skip()` with runtime conditions creates tests that may or may not run, making test coverage unreliable and CI results inconsistent.

**File Evidence:** `tests/e2e/offline.spec.ts:130-131`, `tests/e2e/quick-mood-logging.spec.ts:22`

```typescript
// ❌ BAD: Test skipped based on runtime evaluation
test('service worker is registered for PWA', async ({ page }) => {
  const hasServiceWorker = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.length > 0;
  });

  // ANTI-PATTERN: Skip decision made at runtime
  if (!hasServiceWorker) {
    test.skip(true, 'Service worker not registered');
  }

  expect(hasServiceWorker).toBe(true);  // Never reaches this
});
```

```typescript
// ✅ GOOD: Skip at describe level with static condition
// Use test.describe.configure or annotations
test.describe('Service Worker Tests', () => {
  // Skip entire suite in dev mode where SW isn't registered
  test.skip(
    () => process.env.NODE_ENV === 'development',
    'Service worker only available in production builds'
  );

  test('service worker is registered for PWA', async ({ page }) => {
    const registrations = await page.evaluate(async () => {
      return navigator.serviceWorker.getRegistrations();
    });

    expect(registrations.length).toBeGreaterThan(0);
  });
});
```

---

### Anti-Pattern 4: No-Op Assertion Paths (CRITICAL)

**Problem:** Tests that have code paths where NO assertion executes, allowing the test to pass without validating anything.

**File Evidence:** `tests/e2e/send-love-note.spec.ts:102-106`

```typescript
// ❌ BAD: Assertion only runs if condition is true
test('user can send a love note with optimistic update', async ({ page }) => {
  // ... send message ...

  // ANTI-PATTERN: Assertion only runs if indicator was visible
  const sendingIndicator = page.getByText(/sending/i);
  const sendingWasVisible = await sendingIndicator.isVisible().catch(() => false);
  if (sendingWasVisible) {
    await expect(sendingIndicator).toBeHidden({ timeout: 5000 });
  }
  // If sendingWasVisible is false, NO assertion runs!
});
```

```typescript
// ✅ GOOD: Guaranteed assertion regardless of indicator visibility
test('user can send a love note with optimistic update', async ({ page }) => {
  // Setup response interception BEFORE action
  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('love_notes') && resp.ok()
  );

  await messageInput.fill(testMessage);
  await sendButton.click();

  // GUARANTEED assertion: API response received
  const response = await responsePromise;
  expect(response.status()).toBeLessThan(300);

  // GUARANTEED assertion: input clears after send
  await expect(messageInput).toHaveValue('');

  // GUARANTEED assertion: message appears in list
  await expect(page.getByText(testMessage)).toBeVisible();
});
```

---

### Anti-Pattern 5: Cascading Catch Chains (HIGH)

**Problem:** Multiple `.catch()` calls chained together that all swallow errors, making it impossible to know which operation failed.

**File Evidence:** `tests/e2e/photos.spec.ts:47-53`

```typescript
// ❌ BAD: Multiple catches swallowing different failures
test('user can access photo section', async ({ page }) => {
  const photoContent = page.getByTestId('photo-gallery')
    .or(page.getByTestId('photos-container'))
    .or(page.locator('[data-testid*="photo"]'));

  // ANTI-PATTERN: Error swallowed, hasPhotoContent could be false for many reasons
  const hasPhotoContent = await photoContent.first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  // Test passes even if gallery is broken!
  expect(hasPhotoContent || (await nav.isVisible())).toBe(true);
});
```

```typescript
// ✅ GOOD: Explicit waiting with clear assertions
test('user can access photo section', async ({ page }) => {
  // Navigate to photos
  await page.getByTestId('nav-photos').click();

  // Wait for either gallery or empty state - one MUST appear
  const gallery = page.getByTestId('photo-gallery');
  const emptyState = page.getByText(/no photos|upload your first/i);

  await expect(gallery.or(emptyState)).toBeVisible({ timeout: 5000 });

  // Verify we're on the photos page
  await expect(page).toHaveURL(/\/photos/);
});
```

---

## Best Practices

### Selector Priority Hierarchy

Use selectors in this priority order (accessibility-first):

| Priority | Selector Type | Example | When to Use |
|----------|--------------|---------|-------------|
| 1 | `getByRole()` | `getByRole('button', { name: /submit/i })` | Interactive elements (buttons, links, inputs) |
| 2 | `getByLabel()` | `getByLabel(/email/i)` | Form inputs with labels |
| 3 | `getByTestId()` | `getByTestId('mood-tracker')` | Complex components, containers |
| 4 | `getByText()` | `getByText(/welcome/i)` | Static text content |
| 5 | `locator()` | `locator('[data-testid="item"]')` | Only when above don't work |

**Never Use:**
- CSS class selectors: `.btn-primary`, `.card-header`
- Index-based selection: `.nth(5)` without filtering
- Complex XPath: `//div[@class="..."]/parent::*/child::button`

### Wait Pattern Requirements

**Deterministic waits ONLY:**

```typescript
// ✅ GOOD: Wait for specific network response
const response = page.waitForResponse('**/api/moods');
await submitButton.click();
await response;

// ✅ GOOD: Wait for element state
await page.getByTestId('loading').waitFor({ state: 'detached' });

// ✅ GOOD: Wait for URL change
await expect(page).toHaveURL(/\/dashboard/);

// ✅ GOOD: Wait for element content
await expect(page.getByTestId('count')).toHaveText('5');
```

**Never Use:**

```typescript
// ❌ BAD: Arbitrary timeout
await page.waitForTimeout(3000);

// ❌ BAD: Sleep/setTimeout
await new Promise(r => setTimeout(r, 2000));

// ❌ BAD: networkidle in SPAs (unreliable)
await page.waitForLoadState('networkidle');
```

---

## Test Smell Detection

### Grep Patterns for CI/Pre-commit

Use these patterns to detect anti-patterns in your test files:

```bash
# Anti-Pattern 1: Error swallowing
grep -rn "\.catch.*false\|\.catch.*null\|\.catch.*=>" tests/e2e/*.spec.ts

# Anti-Pattern 2: Conditional flow control
grep -rn "if.*isVisible\|if.*isEnabled\|if.*isDisabled" tests/e2e/*.spec.ts

# Anti-Pattern 3: Runtime test.skip()
grep -rn "test\.skip(true\|test\.skip(!" tests/e2e/*.spec.ts

# Anti-Pattern 4: Hard waits
grep -rn "waitForTimeout\|setTimeout\|\.sleep" tests/e2e/*.spec.ts

# Anti-Pattern 5: CSS class selectors
grep -rn "locator('\.\|\.locator('\." tests/e2e/*.spec.ts

# Anti-Pattern 6: Index-based selection (risky)
grep -rn "\.nth([2-9]\|\.nth(1[0-9]" tests/e2e/*.spec.ts
```

### Detection Script

This script can be run manually to scan all E2E tests for anti-patterns:

```bash
#!/bin/bash
# Save as: .husky/test-smell-detector.sh
# Run from project root: ./.husky/test-smell-detector.sh

set -e

echo "🔍 Scanning for E2E test anti-patterns..."

# Check if any spec files exist
SPEC_FILES=$(find tests/e2e -name "*.spec.ts" 2>/dev/null | grep -v "archive" || true)

if [ -z "$SPEC_FILES" ]; then
    echo "ℹ️  No E2E spec files found in tests/e2e/ (tests may be archived)"
    echo "✅ No E2E anti-patterns detected (no files to scan)"
    exit 0
fi

ERRORS=0

# Check for error swallowing
if grep -rn "\.catch.*false\|\.catch.*null" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found error swallowing patterns (.catch(() => false/null))"
    ERRORS=$((ERRORS + 1))
fi

# Check for conditional flow control
if grep -rn "if.*\.isVisible()\|if.*\.isEnabled()" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found conditional flow control (if isVisible/isEnabled)"
    ERRORS=$((ERRORS + 1))
fi

# Check for hard waits
if grep -rn "waitForTimeout\|page\.waitForTimeout" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found hard waits (waitForTimeout)"
    ERRORS=$((ERRORS + 1))
fi

# Check for runtime test.skip
if grep -rn "test\.skip(true\|test\.skip(!" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found runtime test.skip() calls"
    ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "⛔ Found $ERRORS anti-pattern categories. See docs/04-Testing-QA/e2e-quality-standards.md"
    exit 1
fi

echo "✅ No E2E anti-patterns detected"
exit 0
```

---

## Pre-commit Hook

Add this to `.husky/pre-commit` to prevent anti-pattern regression:

```bash
#!/bin/bash
# .husky/pre-commit - E2E Quality Gate

# Only run if E2E test files are staged
STAGED_E2E=$(git diff --cached --name-only | grep -E "tests/e2e/.*\.spec\.ts$" || true)

if [ -n "$STAGED_E2E" ]; then
    echo "🔍 Checking staged E2E tests for anti-patterns..."

    ERRORS=0

    for file in $STAGED_E2E; do
        # Skip archived files
        if [[ "$file" == *"archive"* ]]; then
            continue
        fi

        # Check for error swallowing
        if grep -q "\.catch.*false\|\.catch.*null" "$file" 2>/dev/null; then
            echo "❌ $file: Error swallowing detected (.catch(() => false/null))"
            ERRORS=$((ERRORS + 1))
        fi

        # Check for conditional flow in test bodies
        if grep -q "if.*\.isVisible()\|if.*\.isEnabled()" "$file" 2>/dev/null; then
            echo "⚠️  $file: Conditional flow detected (if isVisible/isEnabled) - review for anti-pattern"
        fi

        # Check for hard waits
        if grep -q "waitForTimeout" "$file" 2>/dev/null; then
            echo "❌ $file: Hard wait detected (waitForTimeout)"
            ERRORS=$((ERRORS + 1))
        fi

        # Check for runtime test.skip
        if grep -q "test\.skip(true\|test\.skip(!" "$file" 2>/dev/null; then
            echo "❌ $file: Runtime test.skip detected"
            ERRORS=$((ERRORS + 1))
        fi
    done

    if [ $ERRORS -gt 0 ]; then
        echo ""
        echo "⛔ $ERRORS E2E quality violations found."
        echo "📖 See: docs/04-Testing-QA/e2e-quality-standards.md"
        exit 1
    fi

    echo "✅ E2E quality gates passed"
fi
```

### Enabling the Hook

**Step 1: Install husky (if not present)**

```bash
npm install --save-dev husky
npx husky init
```

**Step 2: Create the detection script**

```bash
# Create the test smell detector script
cat > .husky/test-smell-detector.sh << 'DETECTOR_EOF'
#!/bin/bash
# E2E Test Anti-Pattern Detector

set -e

echo "🔍 Scanning for E2E test anti-patterns..."

SPEC_FILES=$(find tests/e2e -name "*.spec.ts" 2>/dev/null | grep -v "archive" || true)

if [ -z "$SPEC_FILES" ]; then
    echo "ℹ️  No E2E spec files found in tests/e2e/"
    exit 0
fi

ERRORS=0

if grep -rn "\.catch.*false\|\.catch.*null" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found error swallowing patterns"
    ERRORS=$((ERRORS + 1))
fi

if grep -rn "if.*\.isVisible()\|if.*\.isEnabled()" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found conditional flow control"
    ERRORS=$((ERRORS + 1))
fi

if grep -rn "waitForTimeout" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found hard waits"
    ERRORS=$((ERRORS + 1))
fi

if grep -rn "test\.skip(true\|test\.skip(!" tests/e2e/*.spec.ts 2>/dev/null; then
    echo "❌ Found runtime test.skip()"
    ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
    echo "⛔ Found $ERRORS anti-pattern categories"
    exit 1
fi

echo "✅ No E2E anti-patterns detected"
DETECTOR_EOF

chmod +x .husky/test-smell-detector.sh
```

**Step 3: Create the pre-commit hook**

```bash
# Create or replace the pre-commit hook with E2E quality gate
cat > .husky/pre-commit << 'PRECOMMIT_EOF'
#!/bin/bash
# .husky/pre-commit - E2E Quality Gate

STAGED_E2E=$(git diff --cached --name-only | grep -E "tests/e2e/.*\.spec\.ts$" || true)

if [ -n "$STAGED_E2E" ]; then
    echo "🔍 Checking staged E2E tests for anti-patterns..."

    ERRORS=0

    for file in $STAGED_E2E; do
        [[ "$file" == *"archive"* ]] && continue

        if grep -q "\.catch.*false\|\.catch.*null" "$file" 2>/dev/null; then
            echo "❌ $file: Error swallowing detected"
            ERRORS=$((ERRORS + 1))
        fi

        if grep -q "if.*\.isVisible()\|if.*\.isEnabled()" "$file" 2>/dev/null; then
            echo "⚠️  $file: Conditional flow detected - review for anti-pattern"
        fi

        if grep -q "waitForTimeout" "$file" 2>/dev/null; then
            echo "❌ $file: Hard wait detected"
            ERRORS=$((ERRORS + 1))
        fi

        if grep -q "test\.skip(true\|test\.skip(!" "$file" 2>/dev/null; then
            echo "❌ $file: Runtime test.skip detected"
            ERRORS=$((ERRORS + 1))
        fi
    done

    if [ $ERRORS -gt 0 ]; then
        echo "⛔ $ERRORS E2E quality violations found."
        echo "📖 See: docs/04-Testing-QA/e2e-quality-standards.md"
        exit 1
    fi

    echo "✅ E2E quality gates passed"
fi
PRECOMMIT_EOF

chmod +x .husky/pre-commit
```

**Alternative: Append to existing pre-commit**

If you already have a pre-commit hook, append the E2E check:

```bash
cat >> .husky/pre-commit << 'EOF'

# E2E Quality Gate - see docs/04-Testing-QA/e2e-quality-standards.md
.husky/test-smell-detector.sh
EOF
```

---

## Good Patterns from playwright.config.ts

The following patterns from our current configuration should be preserved:

### Project Separation

```typescript
// Good: Separate projects for auth vs authenticated tests
projects: [
  {
    name: 'logged-in',
    testIgnore: /auth\.spec\.ts/,
    use: { storageState: 'tests/e2e/.auth/storageState.json' },
  },
  {
    name: 'auth',
    testMatch: /auth\.spec\.ts/,
    use: { storageState: { cookies: [], origins: [] } },
  },
]
```

### Global Setup for Authentication

```typescript
// Good: One-time login in global setup, reuse across tests
globalSetup: './tests/e2e/global-setup.ts',
use: {
  storageState: 'tests/e2e/.auth/storageState.json',
}
```

### CI-Aware Configuration

```typescript
// Good: Longer timeouts in CI, retries for flaky networks
timeout: process.env.CI ? 30000 : 15000,
retries: process.env.CI ? 1 : 0,
screenshot: process.env.CI ? 'only-on-failure' : 'off',
```

### Port Detection

```typescript
// Good: Auto-detect dev server port
export function detectAppPort(): string {
  const portsToCheck = ['4000', '5173', '3000'];
  for (const port of portsToCheck) {
    // Check if port responds
    if (portResponds(port)) return port;
  }
  return '5173';
}
```

---

## References

### TEA Knowledge Base

- [Selector Resilience](../../.bmad/bmm/testarch/knowledge/selector-resilience.md) - Accessibility-first selector hierarchy
- [Timing & Debugging](../../.bmad/bmm/testarch/knowledge/timing-debugging.md) - Deterministic wait patterns
- [Test Quality](../../.bmad/bmm/testarch/knowledge/test-quality.md) - Definition of Done checklist

### External Resources

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators](https://playwright.dev/docs/locators)
- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-07 | TEA | Initial version - established standards after 52/100 quality audit |

---

*This document is part of Epic TD-1: Test Quality Remediation. See [tech-spec-epic-td-1.md](../05-Epics-Stories/tech-spec-epic-td-1.md) for full context.*
