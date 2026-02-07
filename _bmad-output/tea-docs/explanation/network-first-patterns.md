# Network-First Patterns Explained

## Overview

Network-first patterns solve test flakiness by waiting for actual network events rather than arbitrary timeouts. The core principle: "UI changes because APIs respond. Wait for the API response, not an arbitrary timeout."

**Traditional approach (problematic):**
```typescript
await page.click('button');
await page.waitForTimeout(3000);
await expect(page.locator('.success')).toBeVisible();
```

**Network-first approach (deterministic):**
```typescript
const responsePromise = page.waitForResponse((resp) =>
  resp.url().includes('/api/submit') && resp.ok()
);
await page.click('button');
await responsePromise;
await expect(page.locator('.success')).toBeVisible();
```

## The Problem

### Hard Waits Create Flakiness

Fixed timeouts fail inconsistently:
- Fast networks waste time unnecessarily
- Slow networks timeout prematurely
- CI environments typically run slower than local machines
- Under load, APIs take longer, causing random failures

Result: "Works on my machine" syndrome with flaky CI pipelines.

### The Timeout Escalation Trap

Developers increase timeouts when tests fail:
```
2s timeout -> fails -> 5s timeout -> fails -> 10s timeout
```
This creates slow tests that still fail intermittently. A suite taking 5 minutes can stretch to 30 minutes.

### Race Conditions

Navigation and API requests create timing races:
```typescript
await page.goto('/dashboard');
await expect(page.locator('.data-table')).toBeVisible();
```

The test checks for UI before the API responds, failing intermittently.

## The Solution: Intercept-Before-Navigate

### Wait for Response Before Asserting

Set up the wait listener BEFORE triggering navigation or actions:

```typescript
const dashboardPromise = page.waitForResponse((resp) =>
  resp.url().includes('/api/dashboard') && resp.ok()
);
await page.goto('/dashboard');
const response = await dashboardPromise;
const data = await response.json();
await expect(page.locator('.data-table')).toBeVisible();
await expect(page.locator('.data-table tr')).toHaveCount(data.items.length);
```

Benefits:
- Wait established BEFORE navigation (no race condition)
- Waits for actual API response (deterministic)
- No fixed timeout (adapts to network speed)
- Validates API response (catches backend errors)

### With Playwright Utils (Cleaner Syntax)

```typescript
import { test } from '@seontechnologies/playwright-utils/fixtures';
import { expect } from '@playwright/test';

test('should load dashboard data', async ({ page, interceptNetworkCall }) => {
  const dashboardCall = interceptNetworkCall({
    method: 'GET',
    url: '**/api/dashboard',
  });

  await page.goto('/dashboard');

  const { status, responseJson: data } = await dashboardCall;

  expect(status).toBe(200);
  expect(data.items).toBeDefined();

  await expect(page.locator('.data-table')).toBeVisible();
  await expect(page.locator('.data-table tr')).toHaveCount(data.items.length);
});
```

Playwright Utils benefits:
- Automatic JSON parsing (no manual `await response.json()`)
- Returns structured `{ status, responseJson, requestJson }`
- Cleaner API without response status checking
- Same intercept-before-navigate pattern

### Intercept-Before-Navigate Pattern

The core pattern: **Intercept -> Action -> Await**

```typescript
const promise = page.waitForResponse(matcher);
await page.click('button');
await promise;
```

Order matters:
1. `waitForResponse()` starts listening immediately
2. Then trigger the action making the request
3. Then wait for the promise to resolve
4. No race condition possible

## How It Works in TEA

### TEA Generates Network-First Tests

**Vanilla Playwright generation:**

```typescript
test('should create user', async ({ page }) => {
  const createUserPromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/users') &&
      resp.request().method() === 'POST' &&
      resp.ok(),
  );

  await page.fill('#name', 'Test User');
  await page.click('button[type="submit"]');

  const response = await createUserPromise;
  const user = await response.json();

  expect(user.id).toBeDefined();
  await expect(page.locator('.success')).toContainText(user.name);
});
```

**With Playwright Utils (if `tea_use_playwright_utils: true`):**

```typescript
import { test } from '@seontechnologies/playwright-utils/fixtures';
import { expect } from '@playwright/test';

test('should create user', async ({ page, interceptNetworkCall }) => {
  const createUserCall = interceptNetworkCall({
    method: 'POST',
    url: '**/api/users',
  });

  await page.getByLabel('Name').fill('Test User');
  await page.getByRole('button', { name: 'Submit' }).click();

  const { status, responseJson: user } = await createUserCall;

  expect(status).toBe(201);
  expect(user.id).toBeDefined();
  await expect(page.locator('.success')).toContainText(user.name);
});
```

### TEA Reviews for Hard Waits

The `test-review` command detects and flags hard waits:

```
## Critical Issue: Hard Wait Detected
**File:** tests/e2e/submit.spec.ts:45
**Issue:** Using `page.waitForTimeout(3000)`
**Severity:** Critical (causes flakiness)
```

Recommended fix: Replace with network interception patterns.

### Pattern Variations

#### Basic Response Wait

**Vanilla Playwright:**
```typescript
const promise = page.waitForResponse(resp => resp.ok());
await page.click('button');
await promise;
```

**With Playwright Utils:**
```typescript
test('basic wait', async ({ page, interceptNetworkCall }) => {
  const responseCall = interceptNetworkCall({ url: '**' });
  await page.click('button');
  const { status } = await responseCall;
  expect(status).toBe(200);
});
```

#### Specific URL Match

**Vanilla Playwright:**
```typescript
const promise = page.waitForResponse((resp) =>
  resp.url().includes('/api/users/123')
);
await page.goto('/user/123');
await promise;
```

**With Playwright Utils:**
```typescript
test('specific URL', async ({ page, interceptNetworkCall }) => {
  const userCall = interceptNetworkCall({ url: '**/api/users/123' });
  await page.goto('/user/123');
  const { status, responseJson } = await userCall;
  expect(status).toBe(200);
});
```

#### Method + Status Match

**Vanilla Playwright:**
```typescript
const promise = page.waitForResponse(
  (resp) => resp.url().includes('/api/users') &&
    resp.request().method() === 'POST' &&
    resp.status() === 201,
);
await page.click('button[type="submit"]');
await promise;
```

**With Playwright Utils:**
```typescript
test('method and status', async ({ page, interceptNetworkCall }) => {
  const createCall = interceptNetworkCall({
    method: 'POST',
    url: '**/api/users',
  });
  await page.click('button[type="submit"]');
  const { status, responseJson } = await createCall;
  expect(status).toBe(201);
});
```

#### Multiple Responses

**Vanilla Playwright:**
```typescript
const [usersResp, postsResp] = await Promise.all([
  page.waitForResponse((resp) => resp.url().includes('/api/users')),
  page.waitForResponse((resp) => resp.url().includes('/api/posts')),
  page.goto('/dashboard'),
]);

const users = await usersResp.json();
const posts = await postsResp.json();
```

**With Playwright Utils:**
```typescript
test('multiple responses', async ({ page, interceptNetworkCall }) => {
  const usersCall = interceptNetworkCall({ url: '**/api/users' });
  const postsCall = interceptNetworkCall({ url: '**/api/posts' });

  await page.goto('/dashboard');

  const [{ responseJson: users }, { responseJson: posts }] =
    await Promise.all([usersCall, postsCall]);

  expect(users).toBeInstanceOf(Array);
  expect(posts).toBeInstanceOf(Array);
});
```

#### Validate Response Data

**Vanilla Playwright:**
```typescript
const promise = page.waitForResponse((resp) =>
  resp.url().includes('/api/checkout') && resp.ok()
);

await page.click('button:has-text("Complete Order")');

const response = await promise;
const order = await response.json();

expect(order.status).toBe('confirmed');
expect(order.total).toBeGreaterThan(0);

await expect(page.locator('.order-confirmation')).toContainText(order.id);
```

**With Playwright Utils:**
```typescript
test('validate response data', async ({ page, interceptNetworkCall }) => {
  const checkoutCall = interceptNetworkCall({
    method: 'POST',
    url: '**/api/checkout',
  });

  await page.click('button:has-text("Complete Order")');

  const { status, responseJson: order } = await checkoutCall;

  expect(status).toBe(200);
  expect(order.status).toBe('confirmed');
  expect(order.total).toBeGreaterThan(0);

  await expect(page.locator('.order-confirmation')).toContainText(order.id);
});
```

## Advanced Patterns

### HAR Recording for Offline Testing

**Vanilla Playwright (Manual HAR Handling):**

Record mode:
```typescript
test('offline testing - RECORD', async ({ page, context }) => {
  await context.routeFromHAR('./hars/dashboard.har', {
    url: '**/api/**',
    update: true,
  });

  await page.goto('/dashboard');
});
```

Playback mode:
```typescript
test('offline testing - PLAYBACK', async ({ page, context }) => {
  await context.routeFromHAR('./hars/dashboard.har', {
    url: '**/api/**',
    update: false,
  });

  await page.goto('/dashboard');
});
```

**With Playwright Utils (Automatic HAR Management):**

```typescript
import { test } from '@seontechnologies/playwright-utils/network-recorder/fixtures';

// Set environment variable: PW_NET_MODE=record

test('should work offline', async ({ page, context, networkRecorder }) => {
  await networkRecorder.setup(context);

  await page.goto('/dashboard');
  await page.click('#add-item');
});
```

Switch to playback:
```bash
PW_NET_MODE=playback npx playwright test
```

Playwright Utils benefits:
- Automatic HAR file management (naming, paths)
- CRUD operation detection (stateful mocking)
- Environment variable control
- Works for complex interactions
- No manual route configuration

### Network Request Interception

**Vanilla Playwright:**
```typescript
test('should handle API error', async ({ page }) => {
  await page.route('**/api/users', (route) => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    });
  });

  await page.goto('/users');

  const response = await page.waitForResponse('**/api/users');
  const error = await response.json();

  expect(error.error).toContain('Internal server');
  await expect(page.locator('.error-message')).toContainText('Server error');
});
```

**With Playwright Utils:**
```typescript
import { test } from '@seontechnologies/playwright-utils/fixtures';

test('should handle API error', async ({ page, interceptNetworkCall }) => {
  const usersCall = interceptNetworkCall({
    method: 'GET',
    url: '**/api/users',
    fulfillResponse: {
      status: 500,
      body: { error: 'Internal server error' },
    },
  });

  await page.goto('/users');

  const { status, responseJson } = await usersCall;

  expect(status).toBe(500);
  expect(responseJson.error).toContain('Internal server');
  await expect(page.locator('.error-message')).toContainText('Server error');
});
```

Playwright Utils benefits:
- Automatic JSON parsing
- Returns promise with `{ status, responseJson, requestJson }`
- Glob pattern matching (simpler than regex)
- Single declarative call (setup + wait in one)

## Comparison: Traditional vs Network-First

### Loading Dashboard Data

**Traditional (Flaky):**
```typescript
test('dashboard loads data', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForTimeout(2000);
  await expect(page.locator('table tr')).toHaveCount(5);
});
```

Failure modes:
- API takes 2.5s -> test fails
- API returns 3 items not 5 -> hard to debug
- CI slower than local -> fails only in CI

**Network-First (Deterministic):**
```typescript
test('dashboard loads data', async ({ page }) => {
  const apiPromise = page.waitForResponse((resp) =>
    resp.url().includes('/api/dashboard') && resp.ok()
  );

  await page.goto('/dashboard');

  const response = await apiPromise;
  const { items } = await response.json();

  expect(items).toHaveLength(5);
  await expect(page.locator('table tr')).toHaveCount(items.length);
});
```

Benefits:
- Waits exactly as long as needed
- Validates API response
- Validates UI matches API
- Works in any environment

**With Playwright Utils:**
```typescript
import { test } from '@seontechnologies/playwright-utils/fixtures';

test('dashboard loads data', async ({ page, interceptNetworkCall }) => {
  const dashboardCall = interceptNetworkCall({
    method: 'GET',
    url: '**/api/dashboard',
  });

  await page.goto('/dashboard');

  const { status, responseJson: { items } } = await dashboardCall;

  expect(status).toBe(200);
  expect(items).toHaveLength(5);

  await expect(page.locator('table tr')).toHaveCount(items.length);
});
```

### Form Submission

**Traditional (Flaky):**
```typescript
test('form submission', async ({ page }) => {
  await page.fill('#email', 'test@example.com');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await expect(page.locator('.success')).toBeVisible();
});
```

**Network-First (Deterministic):**
```typescript
test('form submission', async ({ page }) => {
  const submitPromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/submit') &&
      resp.request().method() === 'POST' &&
      resp.ok(),
  );

  await page.fill('#email', 'test@example.com');
  await page.click('button[type="submit"]');

  const response = await submitPromise;
  const result = await response.json();

  expect(result.success).toBe(true);
  await expect(page.locator('.success')).toBeVisible();
});
```

**With Playwright Utils:**
```typescript
import { test } from '@seontechnologies/playwright-utils/fixtures';

test('form submission', async ({ page, interceptNetworkCall }) => {
  const submitCall = interceptNetworkCall({
    method: 'POST',
    url: '**/api/submit',
  });

  await page.getByLabel('Email').fill('test@example.com');
  await page.getByRole('button', { name: 'Submit' }).click();

  const { status, responseJson: result } = await submitCall;

  expect(status).toBe(200);
  expect(result.success).toBe(true);
  await expect(page.locator('.success')).toBeVisible();
});
```

## Common Misconceptions

### "I Already Use waitForSelector"

```typescript
await page.click('button');
await page.waitForSelector('.success', { timeout: 5000 });
```

**Problem:** This waits for DOM rendering, not the API that caused the change.

**Better approach:**
```typescript
await page.waitForResponse(matcher);
await page.waitForSelector('.success');
```

### "My Tests Are Fast, Why Add Complexity?"

Short-term: tests run fast locally

Long-term problems:
- Different environments (CI typically slower)
- Under load (API responses slower)
- Network variability (unpredictable)
- Test suite scaling (100 to 1000 tests)

Network-first patterns prevent these issues before they appear.

### "Too Much Boilerplate"

**Vanilla Playwright (Repetitive):**
```typescript
test('test 1', async ({ page }) => {
  const promise = page.waitForResponse((resp) =>
    resp.url().includes('/api/submit') && resp.ok()
  );
  await page.click('button');
  await promise;
});

test('test 2', async ({ page }) => {
  const promise = page.waitForResponse((resp) =>
    resp.url().includes('/api/load') && resp.ok()
  );
  await page.click('button');
  await promise;
});
```

**With Playwright Utils (Cleaner):**
```typescript
import { test } from '@seontechnologies/playwright-utils/fixtures';

test('test 1', async ({ page, interceptNetworkCall }) => {
  const submitCall = interceptNetworkCall({ url: '**/api/submit' });
  await page.click('button');
  const { status, responseJson } = await submitCall;
  expect(status).toBe(200);
});

test('test 2', async ({ page, interceptNetworkCall }) => {
  const loadCall = interceptNetworkCall({ url: '**/api/load' });
  await page.click('button');
  const { responseJson } = await loadCall;
});
```

Benefits:
- Less boilerplate (fixture handles complexity)
- Automatic JSON parsing
- Glob pattern matching
- Consistent API across tests

## Technical Implementation

For detailed network-first patterns, consult the knowledge base index and Knowledge Base System documentation.

## Related Concepts

**Core TEA Concepts:**
- Test Quality Standards (determinism requires network-first)
- Risk-Based Testing (high-risk features need reliable tests)

**Technical Patterns:**
- Fixture Architecture (network utilities as fixtures)
- Knowledge Base System (network patterns in knowledge base)

**Overview:**
- TEA Overview (network-first in workflows)
- Testing as Engineering (why flakiness matters)

## Practical Guides

**Workflow Guides:**
- How to Run Test Review (review for hard waits)
- How to Run ATDD (generate network-first tests)
- How to Run Automate (expand with network patterns)

**Use-Case Guides:**
- Using TEA with Existing Tests (fix flaky legacy tests)

**Customization:**
- Integrate Playwright Utils (network utilities)

## Reference

- TEA Command Reference (all workflows use network-first)
- Knowledge Base Index (network-first fragment)
- Glossary (network-first pattern term)
