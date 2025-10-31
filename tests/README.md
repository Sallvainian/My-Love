# My-Love Testing Documentation

Comprehensive guide for writing, running, and debugging end-to-end tests for the My-Love Progressive Web Application.

## Table of Contents

- [Testing Infrastructure Setup](#testing-infrastructure-setup)
- [PWA Test Helpers API](#pwa-test-helpers-api)
- [data-testid Naming Convention](#data-testid-naming-convention)
- [Test Organization Patterns](#test-organization-patterns)
- [Debugging Guide](#debugging-guide)
- [CI Integration](#ci-integration)
- [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)

---

## Testing Infrastructure Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- My-Love project cloned and dependencies installed

### Installation

1. **Install project dependencies** (includes Playwright):
   ```bash
   npm install
   ```

2. **Install Playwright browser binaries**:
   ```bash
   npx playwright install
   ```

   This downloads Chromium, Firefox, and WebKit browser binaries (~1.5 GB total).

3. **Verify installation**:
   ```bash
   npm run test:e2e -- --version
   ```

   Expected output: `Version 1.56.1` (or later)

### Test Execution Commands

**Run all tests (headless mode, all browsers):**
```bash
npm run test:e2e
```

**Run tests in UI mode (interactive test development):**
```bash
npm run test:e2e:ui
```
- Visual test explorer with DOM snapshots
- Click to run individual tests
- Watch mode with live test updates
- Time travel debugging through test steps

**Run tests in debug mode (Playwright Inspector):**
```bash
npm run test:e2e:debug
```
- Pauses at first test
- Step through test actions
- Inspect page state at each step
- Console REPL for live queries

**Run specific test file:**
```bash
npm run test:e2e tests/e2e/setup-validation.spec.ts
```

**Run tests in headed mode (see browser window):**
```bash
npx playwright test --headed
```

**Run tests in specific browser:**
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

---

## PWA Test Helpers API

PWA-specific utilities for testing service workers, IndexedDB, LocalStorage, and offline functionality.

**Import:**
```typescript
import {
  waitForServiceWorker,
  clearIndexedDB,
  goOffline,
  goOnline,
  getLocalStorageItem,
  setLocalStorageItem,
  clearLocalStorage,
  getIndexedDBStore,
} from '../support/helpers/pwaHelpers';
```

### `waitForServiceWorker(page, timeout?)`

Waits for the service worker to be registered and active.

**Parameters:**
- `page: Page` - Playwright Page instance
- `timeout?: number` - Maximum wait time in ms (default: 30000)

**Returns:** `Promise<void>`

**Throws:** Error if service worker not registered within timeout

**Example:**
```typescript
import { test, expect } from '@playwright/test';
import { waitForServiceWorker } from '../support/helpers/pwaHelpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
});

test('should have active service worker', async ({ page }) => {
  // Service worker is already registered from beforeEach
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  expect(swState).toBe('activated');
});
```

---

### `clearIndexedDB(page, dbName)`

Deletes an IndexedDB database to ensure clean test state.

**Parameters:**
- `page: Page` - Playwright Page instance
- `dbName: string` - Name of the database to delete

**Returns:** `Promise<void>`

**Example:**
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearIndexedDB(page, 'my-love-db');
});

test('should start with empty database', async ({ page }) => {
  const messages = await getIndexedDBStore(page, 'my-love-db', 'messages');
  expect(messages).toHaveLength(0);
});
```

---

### `goOffline(page)` / `goOnline(page)`

Simulate offline and online network conditions.

**Parameters:**
- `page: Page` - Playwright Page instance

**Returns:** `Promise<void>`

**Example:**
```typescript
test('should work offline after initial load', async ({ page }) => {
  // Load page and wait for service worker to cache assets
  await page.goto('/');
  await waitForServiceWorker(page);

  // Go offline
  await goOffline(page);

  // Navigate to another page - should work from cache
  await page.click('text=Settings');
  await expect(page.locator('h1')).toContainText('Settings');

  // Restore online state
  await goOnline(page);
});
```

---

### `getLocalStorageItem(page, key)` / `setLocalStorageItem(page, key, value)`

Read and write LocalStorage values for testing Zustand persistence.

**Parameters:**
- `page: Page` - Playwright Page instance
- `key: string` - LocalStorage key
- `value: string` - Value to store (setLocalStorageItem only)

**Returns:**
- `getLocalStorageItem`: `Promise<string | null>`
- `setLocalStorageItem`: `Promise<void>`

**Example:**
```typescript
test('should persist partner name to LocalStorage', async ({ page }) => {
  await page.goto('/');

  // Set partner name in UI
  await page.fill('[data-testid="settings-partner-name-input"]', 'Alex');
  await page.click('[data-testid="settings-save-button"]');

  // Verify persisted to LocalStorage
  const stored = await getLocalStorageItem(page, 'my-love-storage');
  expect(stored).toContain('Alex');
});

test('should restore state from LocalStorage', async ({ page }) => {
  // Pre-populate LocalStorage
  await page.goto('/');
  await setLocalStorageItem(page, 'my-love-storage', JSON.stringify({
    state: { partnerName: 'Jordan' },
    version: 0
  }));

  // Reload page
  await page.reload();

  // Verify state restored
  const nameDisplay = await page.textContent('[data-testid="partner-name-display"]');
  expect(nameDisplay).toBe('Jordan');
});
```

---

### `clearLocalStorage(page)`

Clears all LocalStorage data for clean test state.

**Parameters:**
- `page: Page` - Playwright Page instance

**Returns:** `Promise<void>`

**Example:**
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearLocalStorage(page);
});
```

---

### `getIndexedDBStore(page, dbName, storeName)`

Retrieves all records from an IndexedDB object store.

**Parameters:**
- `page: Page` - Playwright Page instance
- `dbName: string` - Database name
- `storeName: string` - Object store name

**Returns:** `Promise<any[]>` - Array of all records, or empty array if DB/store doesn't exist

**Example:**
```typescript
test('should save photo to IndexedDB', async ({ page }) => {
  await page.goto('/');

  // Upload photo via UI
  await page.setInputFiles('[data-testid="photo-upload-input"]', 'path/to/test-photo.jpg');
  await page.click('[data-testid="photo-save-button"]');

  // Verify saved to IndexedDB
  const photos = await getIndexedDBStore(page, 'my-love-db', 'photos');
  expect(photos).toHaveLength(1);
  expect(photos[0]).toHaveProperty('id');
  expect(photos[0]).toHaveProperty('data');
});
```

---

## data-testid Naming Convention

Use semantic, stable `data-testid` attributes for reliable test selectors that resist refactoring.

### Pattern: `[component]-[element]-[action?]`

**Components:** `message`, `photo`, `settings`, `gallery`, `mood`, `admin`

**Elements:** `button`, `input`, `display`, `card`, `modal`, `list`, `item`

**Actions (optional):** `submit`, `cancel`, `delete`, `edit`, `favorite`, `upload`

### Examples

**Buttons:**
```html
<button data-testid="message-favorite-button">Favorite</button>
<button data-testid="photo-delete-button">Delete</button>
<button data-testid="settings-save-button">Save</button>
```

**Inputs:**
```html
<input data-testid="settings-partner-name-input" />
<input data-testid="admin-message-text-input" />
<input data-testid="photo-upload-input" type="file" />
```

**Display Elements:**
```html
<div data-testid="message-text-display">Daily message content</div>
<span data-testid="partner-name-display">Partner Name</span>
<div data-testid="gallery-photo-count">10 photos</div>
```

**List Items:**
```html
<div data-testid="message-card">...</div>
<div data-testid="photo-item">...</div>
<div data-testid="mood-entry">...</div>
```

### Rationale

- **Resist refactoring:** CSS classes change, data-testid remains stable
- **Semantic naming:** Clear purpose from the name alone
- **Grep-able:** Easy to search codebase for test IDs
- **No coupling to styling:** Decoupled from Tailwind classes

---

## Test Organization Patterns

### Test Suite Structure

**Use `describe` blocks to group related tests:**
```typescript
import { test, expect } from '@playwright/test';
import { waitForServiceWorker, clearIndexedDB, clearLocalStorage } from '../support/helpers/pwaHelpers';

test.describe('Message Favoriting', () => {
  test.beforeEach(async ({ page }) => {
    // Clean state before each test
    await page.goto('/');
    await waitForServiceWorker(page);
    await clearIndexedDB(page, 'my-love-db');
    await clearLocalStorage(page);
  });

  test('should favorite a message', async ({ page }) => {
    await page.click('[data-testid="message-favorite-button"]');
    await expect(page.locator('[data-testid="message-favorite-button"]')).toHaveClass(/favorited/);
  });

  test('should unfavorite a message', async ({ page }) => {
    // Favorite first
    await page.click('[data-testid="message-favorite-button"]');

    // Then unfavorite
    await page.click('[data-testid="message-favorite-button"]');
    await expect(page.locator('[data-testid="message-favorite-button"]')).not.toHaveClass(/favorited/);
  });
});
```

### Test Isolation Principles

**Each test should be independent and idempotent:**

1. **Clean state in beforeEach:**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await clearIndexedDB(page, 'my-love-db');
     await clearLocalStorage(page);
     await page.goto('/');
   });
   ```

2. **No shared state between tests:**
   - Don't rely on test execution order
   - Don't share variables between tests
   - Each test should set up its own data

3. **Use page.goto() in beforeEach:**
   - Ensures fresh page load for each test
   - Resets JavaScript state
   - Clears in-memory caches

### Example Test Structure

```typescript
test.describe('Photo Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await clearIndexedDB(page, 'my-love-db');
  });

  test('should upload a photo', async ({ page }) => {
    // Arrange: Navigate to gallery
    await page.click('[data-testid="nav-gallery-link"]');

    // Act: Upload photo
    await page.setInputFiles('[data-testid="photo-upload-input"]', 'tests/fixtures/test-photo.jpg');
    await page.click('[data-testid="photo-upload-submit"]');

    // Assert: Photo appears in gallery
    await expect(page.locator('[data-testid="photo-item"]')).toHaveCount(1);
  });

  test('should delete a photo', async ({ page }) => {
    // Arrange: Upload photo first
    await page.click('[data-testid="nav-gallery-link"]');
    await page.setInputFiles('[data-testid="photo-upload-input"]', 'tests/fixtures/test-photo.jpg');
    await page.click('[data-testid="photo-upload-submit"]');
    await expect(page.locator('[data-testid="photo-item"]')).toHaveCount(1);

    // Act: Delete photo
    await page.click('[data-testid="photo-delete-button"]');
    await page.click('[data-testid="confirm-delete-button"]');

    // Assert: Photo removed from gallery
    await expect(page.locator('[data-testid="photo-item"]')).toHaveCount(0);
  });
});
```

---

## Debugging Guide

### Playwright UI Mode (Recommended)

**Start UI mode:**
```bash
npm run test:e2e:ui
```

**Features:**
- Visual test explorer
- Click to run individual tests
- Watch mode with live updates
- DOM snapshots at each step
- Time travel debugging (rewind test steps)
- Network activity inspector
- Console logs

**Workflow:**
1. Open UI mode: `npm run test:e2e:ui`
2. Click on a test to run it
3. Click on test steps to see DOM state
4. Use "Pick Locator" to find selectors
5. Edit test code and watch auto-rerun

---

### Trace Viewer

**Generate trace on failure:**

Traces are automatically captured on first retry (configured in `playwright.config.ts`).

**View trace:**
```bash
npx playwright show-trace test-results/trace.zip
```

**Features:**
- Visual timeline of test execution
- Screenshot at each step
- Network requests
- Console logs
- DOM snapshots
- Actionability checks

---

### Playwright Inspector

**Start debug mode:**
```bash
npm run test:e2e:debug
```

**Features:**
- Pauses at first test
- Step through test actions with "Step Over" button
- Inspect page state at any point
- Console REPL for live queries
- Copy selectors from page

**Console REPL commands:**
```javascript
// In Playwright Inspector console:
playwright.$('button')              // Find element
playwright.$$('button')             // Find all elements
playwright.$eval('button', el => el.textContent)  // Evaluate JS
```

---

### Headed Mode

**Run tests with visible browser:**
```bash
npx playwright test --headed
```

**Use cases:**
- Visual debugging
- Seeing UI interactions
- Verifying animations
- Checking responsive layouts

---

### Slow Motion

**Slow down test execution to see actions:**

**Via .env.test:**
```bash
SLOW_MO=500 npm run test:e2e
```

**Via command line:**
```bash
npx playwright test --headed --slow-mo=500
```

Adds 500ms delay between each action.

---

### Console Logs

**Add debug logs in tests:**
```typescript
test('should do something', async ({ page }) => {
  console.log('Starting test...');
  await page.goto('/');

  const text = await page.textContent('h1');
  console.log('Page title:', text);

  // Use page.evaluate to log from browser context
  await page.evaluate(() => {
    console.log('Browser console log');
  });
});
```

**View console logs:**
```bash
npx playwright test --headed
# Console logs appear in terminal
```

---

## CI Integration

GitHub Actions workflow automatically runs Playwright tests on every push and pull request.

### Workflow Configuration

**File:** `.github/workflows/playwright.yml` (created in Story 2.6)

**Triggers:**
- Push to `main` branch
- Pull requests

**Environment:**
- Ubuntu latest
- Node.js 18.x
- 2 workers (resource-constrained)
- 2 retries (handle transient failures)

### Artifact Uploads

**On test failure, CI uploads:**
- HTML test report
- Screenshots (only-on-failure)
- Videos (retain-on-failure)
- Traces (on-first-retry)

**Accessing artifacts:**
1. Go to GitHub Actions tab
2. Click on failed workflow run
3. Scroll to "Artifacts" section
4. Download `playwright-report.zip`

### Viewing Test Results

**HTML Report:**
1. Download `playwright-report.zip` artifact
2. Extract locally
3. Open `index.html` in browser

**GitHub Actions UI:**
- Test results appear as annotations on the PR
- Failed tests show as red X with error message
- Click on annotation to see full error

---

## Common Pitfalls and Solutions

### Timing Issues

**Problem:** Test fails intermittently with "element not found" or "timeout"

**Solution:** Use explicit waits, not arbitrary sleeps

❌ **Bad:**
```typescript
await page.click('button');
await page.waitForTimeout(2000);  // Arbitrary wait
expect(page.locator('.result')).toBeVisible();
```

✅ **Good:**
```typescript
await page.click('button');
await expect(page.locator('.result')).toBeVisible();  // Waits until visible
```

**Auto-waiting in Playwright:**
- `page.click()` waits for element to be actionable
- `page.fill()` waits for input to be editable
- `expect().toBeVisible()` waits until assertion passes

---

### Selector Strategies

**Problem:** Selector breaks when CSS classes change

**Solution:** Prefer `data-testid` over CSS classes

❌ **Bad:**
```typescript
await page.click('.btn.btn-primary.rounded-lg');  // Brittle, coupled to styling
```

✅ **Good:**
```typescript
await page.click('[data-testid="submit-button"]');  // Stable, semantic
```

**Selector priority:**
1. `data-testid` (best)
2. Semantic HTML (`button[type="submit"]`)
3. Text content (`text=Submit`)
4. CSS classes (last resort)

---

### Service Worker Registration

**Problem:** Service worker not ready when test starts

**Solution:** Always use `waitForServiceWorker` helper

❌ **Bad:**
```typescript
test('should work offline', async ({ page }) => {
  await page.goto('/');
  await goOffline(page);  // Service worker may not be ready!
  // Test may fail
});
```

✅ **Good:**
```typescript
test('should work offline', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);  // Ensure SW ready
  await goOffline(page);
  // Test works reliably
});
```

---

### IndexedDB Quota

**Problem:** Tests fail with QuotaExceededError after many runs

**Solution:** Clear IndexedDB before each test

✅ **Good:**
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearIndexedDB(page, 'my-love-db');  // Clean state
});
```

---

### Flaky Tests

**Problem:** Test passes locally but fails in CI intermittently

**Root causes:**
1. Race conditions (use explicit waits)
2. Network timing (use `waitForResponse`)
3. Service worker caching (clear caches in beforeEach)
4. Shared state between tests (ensure test isolation)

**Investigation steps:**
1. Run test 10 times locally: `npx playwright test --repeat-each=10`
2. Check CI artifacts (screenshots, videos, traces)
3. Increase timeout if PWA operation legitimately slow
4. Add retry logic only as last resort

**Example: Wait for network response**
```typescript
test('should save data', async ({ page }) => {
  // Wait for API call to complete
  const responsePromise = page.waitForResponse(response =>
    response.url().includes('/api/save') && response.status() === 200
  );

  await page.click('[data-testid="save-button"]');
  await responsePromise;  // Ensure request completed

  // Now safe to assert result
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

---

## Known Limitations

### Service Worker Testing in Development Mode

Service workers only register in production builds or when served over HTTPS. The Vite dev server runs in development mode without service worker registration by default.

**Workaround options:**
1. **Test against production build** (recommended for CI):
   ```bash
   npm run build
   npm run preview  # Serves production build on localhost
   # Update baseURL in playwright.config.ts to preview server URL
   npm run test:e2e
   ```

2. **Use vite-plugin-pwa dev mode** (if configured):
   - Set `devOptions.enabled: true` in vite.config.ts
   - Service worker will register in dev mode

**Affected tests:**
- "should register service worker"
- "should simulate offline mode" (requires service worker for offline cache)
- "should access IndexedDB store" (when testing service worker cache)

**Note:** Story 2.4 will configure auto-start preview server for testing against production builds.

---

### WebKit Browser Support

WebKit tests require additional system libraries that may not be installed by default on all Linux distributions:
- `libicudata.so.66`
- `libicui18n.so.66`
- `libicuuc.so.66`
- `libwebp.so.6`
- `libffi.so.7`

**Status:** WebKit project temporarily disabled in `playwright.config.ts` until dependencies are installed.

**To enable WebKit:**
1. Install missing dependencies (distribution-specific)
2. Uncomment WebKit project in `playwright.config.ts`
3. Run tests: `npm run test:e2e --project=webkit`

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [PWA Testing Guide](https://web.dev/testing-pwa/)
- [Project Architecture](../docs/architecture.md)
- [Tech Spec Epic 2](../docs/tech-spec-epic-2.md)

---

**Last Updated:** 2025-10-30
**Testing Framework Version:** Playwright 1.56.1
**Maintained By:** My-Love Development Team
