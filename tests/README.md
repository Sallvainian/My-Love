# My-Love Testing Documentation

Comprehensive guide for writing, running, and debugging end-to-end tests for the My-Love Progressive Web Application.

## Table of Contents

- [Testing Infrastructure Setup](#testing-infrastructure-setup)
- [Development Server Auto-Start (webServer Configuration)](#development-server-auto-start-webserver-configuration)
- [PWA Test Helpers API](#pwa-test-helpers-api)
- [data-testid Naming Convention](#data-testid-naming-convention)
- [Test Organization Patterns](#test-organization-patterns)
- [Debugging Guide](#debugging-guide)
- [CI Integration](#ci-integration)
- [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)

---

## Testing Infrastructure Setup

### Prerequisites

#### System Requirements

**Operating System:**

- Linux (Ubuntu 20.04+, Debian 11+, or similar)
- macOS 11+ (Big Sur or later)
- Windows 10/11 with WSL2 (recommended) or native

**Hardware:**

- **CPU:** 4+ cores recommended (tests run in parallel)
- **RAM:** 8 GB minimum, 16 GB recommended
- **Disk Space:** 5 GB minimum (includes browsers, node_modules, build artifacts)

#### Software Dependencies

**Node.js and Package Manager:**

- **Node.js:** 18.x or 20.x LTS (tested with 18.19.0 and 20.11.0)
- **npm:** 9.x or 10.x (comes with Node.js)
- **pnpm:** 8.x+ (optional alternative)
- **yarn:** 4.x+ (optional alternative)

**Version check:**

```bash
node --version  # Should show v18.x.x or v20.x.x
npm --version   # Should show 9.x.x or 10.x.x
```

**Browser Binaries:**

- Playwright will download browser binaries automatically (~1.5 GB)
- Chromium (latest stable)
- Firefox (latest stable)
- WebKit (Safari engine) - _optional, requires additional system libraries_

#### Project Dependencies

**Core Dependencies** (from package.json):

- **react:** ^19.1.1 - UI framework
- **react-dom:** ^19.1.1 - React DOM renderer
- **zustand:** ^5.0.8 - State management with persist middleware
- **idb:** ^8.0.3 - IndexedDB wrapper for PWA storage
- **workbox-window:** ^7.3.0 - Service worker integration

**Development Dependencies:**

- **@playwright/test:** ^1.56.1 - E2E testing framework
- **vite:** ^7.1.7 - Dev server and build tool
- **typescript:** ^5.8.3 - Type checking
- **@vitejs/plugin-react:** ^4.3.4 - Vite React plugin
- **vite-plugin-pwa:** ^0.21.6 - PWA generation (service worker, manifest)

**Additional System Dependencies for WebKit (Linux only):**

On Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y \
  libicu66 \
  libwebp6 \
  libffi7 \
  libgstreamer1.0-0 \
  libgstreamer-plugins-base1.0-0
```

On Fedora/RHEL:

```bash
sudo dnf install -y \
  libicu \
  libwebp \
  libffi \
  gstreamer1 \
  gstreamer1-plugins-base
```

**Note:** WebKit tests are currently disabled in `playwright.config.ts` due to missing system dependencies. See [Known Limitations](#webkit-browser-support) section below.

#### Git and Version Control

- **Git:** 2.x+ for repository management
- **GitHub CLI (gh):** 2.x+ for PR creation (optional but recommended)

```bash
git --version   # Should show 2.x.x
gh --version    # Should show 2.x.x (optional)
```

#### Environment Setup Summary

**Quick Start (Linux/macOS):**

```bash
# 1. Verify Node.js version
node --version  # 18.x or 20.x

# 2. Clone repository
git clone https://github.com/Sallvainian/My-Love.git
cd My-Love

# 3. Install project dependencies
npm install

# 4. Install Playwright browsers
npx playwright install

# 5. Verify setup
npm run test:e2e -- --version

# 6. Run tests
npm run test:e2e
```

**For Windows Users:**

- Install WSL2 with Ubuntu 20.04+ (recommended)
- Follow Linux quick start steps in WSL2 terminal
- Native Windows testing supported but WSL2 provides better compatibility

**For CI/CD Environments:**

- Use official Playwright Docker image: `mcr.microsoft.com/playwright:v1.56.1-jammy`
- Pre-installed browsers and system dependencies
- See `.github/workflows` for GitHub Actions setup example

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

## Development Server Auto-Start (webServer Configuration)

Playwright automatically manages the Vite development server lifecycle during test execution, eliminating manual setup steps and enabling single-command test workflows.

### How It Works

**Configuration** (`playwright.config.ts` lines 90-98):

```typescript
webServer: {
  command: 'npm run dev',                      // Command to start server
  url: 'http://localhost:5173/My-Love/',       // URL to poll for readiness
  reuseExistingServer: !process.env.CI,        // Reuse in local, fresh in CI
  timeout: 120000,                             // 2-minute startup timeout
}
```

**Behavior:**

1. **Before tests start:** Playwright spawns `npm run dev` process
2. **Readiness check:** Polls URL until HTTP 200 response (typically 10-30 seconds)
3. **Test execution:** Runs all tests against the ready server
4. **After tests complete:** Sends SIGTERM to gracefully shut down server

**Environment-Aware:**

- **Local Development:** Reuses existing server if port 5173 is occupied (`reuseExistingServer: true`)
- **CI Environment:** Always starts fresh server ignoring existing processes (`reuseExistingServer: false` when `CI=true`)

---

### Usage Workflows

#### Cold Start (No Server Running)

Most common scenario - tests start server automatically from clean state.

**Command:**

```bash
npm run test:e2e
```

**What happens:**

1. Playwright checks port 5173 - finds it empty
2. Spawns `npm run dev` process
3. Waits for `http://localhost:5173/My-Love/` to respond (HTTP 200)
4. Runs all 124 tests
5. Shuts down server gracefully
6. Port 5173 released

**Startup time:** ~10-30 seconds including PWA service worker registration

**Use when:**

- Running full test suite
- CI/CD pipeline execution
- Clean environment testing

---

#### Warm Start (Server Already Running)

When dev server is already running (e.g., in separate terminal for development), Playwright detects and reuses it.

**Setup:**

```bash
# Terminal 1: Start dev server manually
npm run dev

# Terminal 2: Run tests
npm run test:e2e
```

**What happens:**

1. Playwright checks port 5173 - finds existing server
2. Reuses existing server (no new process spawned)
3. Runs tests immediately (no startup delay)
4. Server continues running after tests complete
5. Original server process unchanged

**Startup time:** ~0 seconds (immediate test execution)

**Use when:**

- Local development with live server
- Iterative test development
- Debugging UI changes while running tests

**How to identify:**

- No "Starting server..." message in console
- Tests begin immediately without 10-30 second wait
- Dev server terminal shows no restart

---

#### CI Environment (Fresh Start Every Time)

In CI environments (`CI=true`), Playwright always starts a fresh server regardless of port availability.

**Configuration:**

```bash
export CI=true  # Set in GitHub Actions automatically
npm run test:e2e
```

**What happens:**

1. Playwright starts fresh `npm run dev` process
2. Ignores any existing process on port 5173
3. Runs tests against fresh server
4. Shuts down server after tests
5. Clean environment for next run

**Use when:**

- GitHub Actions workflows
- CI/CD pipelines
- Reproducible test environments

**Why fresh start in CI:**

- Ensures consistent test environment
- No contamination from previous runs
- Catches port conflicts before deployment
- Validates server startup reliability

---

### Configuration Parameters

#### `command: 'npm run dev'`

Shell command to start the development server.

**Requirements:**

- Must match a valid script in `package.json`
- Server must start within `timeout` period
- Server must respond to `url` with HTTP 200

**Current setup:**

```json
// package.json
{
  "scripts": {
    "dev": "vite" // Starts Vite dev server on port 5173
  }
}
```

---

#### `url: 'http://localhost:5173/My-Love/'`

URL that Playwright polls to determine server readiness.

**Requirements:**

- Must match Vite base path configuration
- Server must return HTTP 200 when ready
- Must include base path from `vite.config.ts`

**Current setup:**

```typescript
// vite.config.ts
export default defineConfig({
  base: '/My-Love/', // Must match webServer url path
  // ...
});
```

**Validation:**

```bash
# After server starts, should return HTTP 200
curl -I http://localhost:5173/My-Love/
```

---

#### `reuseExistingServer: !process.env.CI`

Controls server reuse behavior based on environment.

**Local Development** (`CI` not set):

- Value: `true`
- Behavior: Reuses existing server if port 5173 occupied
- Use case: Developer has server running for UI work

**CI Environment** (`CI=true`):

- Value: `false`
- Behavior: Always starts fresh server
- Use case: Reproducible, isolated test environment

**Example:**

```bash
# Local: Reuses existing server
npm run test:e2e

# CI mode: Fresh server every time
export CI=true
npm run test:e2e
unset CI  # Restore local mode
```

---

#### `timeout: 120000`

Maximum time (in milliseconds) to wait for server readiness.

**Current setting:** 2 minutes (120,000 ms)

**Why 2 minutes:**

- Typical startup: 10-30 seconds (including PWA service worker)
- Slow CI environments: 60-90 seconds
- Generous buffer for dependency loading
- Accommodates service worker registration delay (2-5 seconds)

**When to increase:**

- Very slow CI environments (resource-constrained)
- Large dependency trees
- Complex build steps in dev mode

**When server fails to start:**

- Error message: "Server did not start in 120000ms"
- Check: `npm run dev` works independently
- Check: Port 5173 not occupied by other process
- Check: No firewall blocking localhost:5173

---

### Troubleshooting

#### Server Fails to Start

**Symptom:** Tests timeout with "Server did not start in 120000ms"

**Causes:**

1. Port 5173 occupied by another process
2. `npm run dev` fails independently
3. Vite base path mismatch
4. Dependencies not installed

**Solutions:**

```bash
# 1. Check if port is occupied
lsof -ti:5173
# If returns PID, kill process:
lsof -ti:5173 | xargs kill

# 2. Verify dev server works independently
npm run dev
# Should see: "Local: http://localhost:5173/My-Love/"

# 3. Verify base path in vite.config.ts matches webServer URL
grep "base:" vite.config.ts
# Should see: base: '/My-Love/',

# 4. Reinstall dependencies
npm install
```

---

#### Server Won't Stop After Tests

**Symptom:** Port 5173 still occupied after tests complete

**Cause:** Server process didn't receive SIGTERM signal

**Solution:**

```bash
# Find and kill orphaned process
lsof -ti:5173 | xargs kill

# If process won't die, force kill
lsof -ti:5173 | xargs kill -9
```

**Prevention:**

- Ensure tests complete normally (no Ctrl+C during execution)
- Use background processes properly (`&` operator)
- Let Playwright manage server lifecycle

---

#### Tests Start Before Server Ready

**Symptom:** "Connection refused" errors in early tests

**Cause:** Server not responding at `url` yet

**Diagnosis:**

```bash
# Check if URL returns HTTP 200
curl -I http://localhost:5173/My-Love/
# Should return: HTTP/1.1 200 OK
```

**Solutions:**

1. **Base path mismatch:** Ensure `vite.config.ts` base matches webServer URL
2. **Increase timeout:** Change `timeout: 180000` (3 minutes) if CI is very slow
3. **Service worker delay:** 120-second timeout already accommodates PWA startup

---

#### Port Conflicts

**Symptom:** Vite fails with "Port 5173 is in use"

**Cause:** Another process (previous test run, manual server, other app) occupies port 5173

**Known limitation:** Port 5173 is hardcoded (no dynamic port fallback)

**Solutions:**

```bash
# Option 1: Kill process on port 5173
lsof -ti:5173 | xargs kill

# Option 2: Change Vite port (requires updating playwright.config.ts URL)
# vite.config.ts:
server: { port: 5174 }

# playwright.config.ts:
url: 'http://localhost:5174/My-Love/',
```

**Why hardcoded port:**

- Port 5173 is Vite's default and rarely conflicts
- Dynamic port detection requires parsing Vite output (complex)
- Single-developer project doesn't benefit from dynamic ports
- Acceptable trade-off for simplicity

---

#### CI Tests Pass Locally But Fail in CI

**Symptom:** Tests pass with manual server but fail in CI

**Diagnosis:**

```bash
# Simulate CI environment locally
export CI=true
npm run test:e2e
unset CI  # Restore after test
```

**Common causes:**

1. **Local server reuse hiding bugs:** CI starts fresh, exposes startup issues
2. **Port conflicts in CI:** Previous job didn't clean up
3. **Timeout too short:** Slow CI environment needs >120 seconds
4. **Base path mismatch:** Works with manual server but not auto-start

**Solutions:**

1. Always test with `CI=true` before pushing
2. Increase timeout for slow CI: `timeout: 180000`
3. Verify `npm run dev` succeeds in clean CI environment
4. Check GitHub Actions artifacts for detailed error logs

---

### Verification Checklist

Before relying on webServer auto-start:

- [ ] `npm run dev` works independently
- [ ] Dev server responds at `http://localhost:5173/My-Love/` (HTTP 200)
- [ ] Base path in `vite.config.ts` matches webServer URL
- [ ] Port 5173 is not occupied by other processes
- [ ] Tests pass in cold start scenario: `npm run test:e2e`
- [ ] Tests pass in CI mode: `export CI=true && npm run test:e2e`
- [ ] Server shuts down cleanly after tests (port 5173 released)

---

### Known Limitations

**1. Port 5173 is hardcoded**

- No dynamic port fallback if port occupied
- Workaround: Kill process on port 5173 or change Vite port

**2. Timeout applies to entire startup**

- 120-second timeout includes Vite bundling + service worker registration
- Slow CI environments may need increased timeout

**3. No parallel server instances**

- Cannot run multiple test suites simultaneously (port conflict)
- Playwright handles parallelization at worker level, not server level

**4. Environment variable dependency**

- `reuseExistingServer` behavior depends on `CI` environment variable
- Must be set correctly in CI/CD configuration

---

### Best Practices

**✅ Do:**

- Let Playwright manage server lifecycle (don't start manually for tests)
- Use cold start for CI and full regression testing
- Use warm start for iterative test development
- Verify configuration with checklist before troubleshooting
- Monitor test startup time (should be consistent 10-30 seconds)

**❌ Don't:**

- Start multiple servers on port 5173 simultaneously
- Modify server configuration during test execution
- Rely on server reuse in CI (use `CI=true`)
- Skip server shutdown verification (check port released)

---

### Additional Resources

- [Playwright webServer Documentation](https://playwright.dev/docs/test-webserver)
- [Vite Server Options](https://vite.dev/config/server-options.html)
- [Story 2.4 Implementation](../docs/stories/2-4-configure-auto-start-preview-server.md)
- [Tech Spec Epic 2: Test Suite Execution Workflow](../docs/tech-spec-epic-2.md#critical-workflow-1-test-suite-execution)

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
  await setLocalStorageItem(
    page,
    'my-love-storage',
    JSON.stringify({
      state: { partnerName: 'Jordan' },
      version: 0,
    })
  );

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

**Elements:** `button`, `input`, `display`, `card`, `modal`, `list`, `item`, `counter`, `badge`, `text`

**Actions (optional):** `submit`, `cancel`, `delete`, `edit`, `favorite`, `upload`, `share`

### Examples

**Buttons:**

```html
<button data-testid="message-favorite-button">Favorite</button>
<button data-testid="message-share-button">Share</button>
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
<div data-testid="message-text">Daily message content</div>
<div data-testid="message-duration-counter">Day 42 Together</div>
<span data-testid="message-category-badge">💖 Why I Love You</span>
<span data-testid="partner-name-display">Partner Name</span>
<div data-testid="gallery-photo-count">10 photos</div>
```

**Container Elements:**

```html
<div data-testid="message-card">...</div>
<div data-testid="photo-item">...</div>
<div data-testid="mood-entry">...</div>
```

### Component-Specific Conventions

**DailyMessage Component:**

- `data-testid="message-duration-counter"` - Relationship duration header
- `data-testid="message-card"` - Main message card container
- `data-testid="message-category-badge"` - Category badge (e.g., "Why I Love You")
- `data-testid="message-text"` - Message text content
- `data-testid="message-favorite-button"` - Favorite toggle button
- `data-testid="message-share-button"` - Share button

### Rationale

- **Resist refactoring:** CSS classes change, data-testid remains stable
- **Semantic naming:** Clear purpose from the name alone
- **Grep-able:** Easy to search codebase for test IDs
- **No coupling to styling:** Decoupled from Tailwind classes
- **Migration-friendly:** Easy to replace CSS selectors with getByTestId()

### Migration Guide: CSS Selectors → data-testid

When migrating existing tests from CSS selectors to data-testid:

**Step 1: Add data-testid attributes to components**

```tsx
// Before
<div className="card card-hover relative overflow-hidden">

// After
<div className="card card-hover relative overflow-hidden" data-testid="message-card">
```

**Step 2: Update test selectors**

```typescript
// Before (CSS class selector)
const messageCard = cleanApp.locator('.card').first();
const messageText = cleanApp.locator('.font-serif.text-gray-800');
const heartButton = cleanApp.locator('button[aria-label*="favorite"]').first();

// After (data-testid selector)
const messageCard = cleanApp.getByTestId('message-card');
const messageText = cleanApp.getByTestId('message-text');
const heartButton = cleanApp.getByTestId('message-favorite-button');
```

**Benefits of migration:**

- **Stability:** Tests survive Tailwind class changes, theme updates, and styling refactors
- **Clarity:** `getByTestId('message-card')` is more readable than `.locator('.card').first()`
- **Speed:** Direct element targeting without traversing CSS class combinations
- **Maintainability:** Adding/removing CSS classes doesn't break tests

**Common replacements:**

- `.card` → `getByTestId('message-card')`
- `.font-serif.text-gray-800` → `getByTestId('message-text')`
- `button[aria-label*="favorite"]` → `getByTestId('message-favorite-button')`
- `locator('h2:has-text("Day")').first()` → `getByTestId('message-duration-counter').locator('h2')`

**Bulk migration using sed:**

```bash
# Replace common CSS selectors across test files
sed -i "s/cleanApp\.locator('\.card')\.first()/cleanApp.getByTestId('message-card')/g" tests/e2e/*.spec.ts
sed -i "s/cleanApp\.locator('button\[aria-label\*=\"favorite\"\]')\.first()/cleanApp.getByTestId('message-favorite-button')/g" tests/e2e/*.spec.ts
```

### Adding data-testid to New Components

When creating new components, add data-testid attributes immediately:

**Checklist:**

- [ ] All interactive elements (buttons, inputs, links) have data-testid
- [ ] Main container elements have data-testid
- [ ] Display elements that tests will query have data-testid
- [ ] Follow naming convention: `[component]-[element]-[action?]`
- [ ] All lowercase, hyphen-separated

**Example:**

```tsx
export const PhotoGallery: React.FC = () => {
  return (
    <div data-testid="gallery-container">
      <h2 data-testid="gallery-header">Photo Gallery</h2>
      <button data-testid="gallery-upload-button">Upload Photo</button>
      <div data-testid="gallery-grid">
        {photos.map((photo) => (
          <div key={photo.id} data-testid="gallery-photo-item">
            <img src={photo.url} data-testid="gallery-photo-image" />
            <button data-testid="gallery-photo-delete-button">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Test Suite Standards

**As of Story 2.3 (Epic 2):**

- ✅ All 106 active E2E tests migrated to data-testid selectors
- ✅ 100% test pass rate maintained (Chromium + Firefox)
- ✅ Zero CSS class selectors in test suite
- ✅ All DailyMessage component elements tagged

**Coverage:**

- `tests/e2e/message-display.spec.ts` - 14 tests
- `tests/e2e/favorites.spec.ts` - 8 tests
- `tests/e2e/settings.spec.ts` - 6 tests
- `tests/e2e/navigation.spec.ts` - 7 tests
- `tests/e2e/persistence.spec.ts` - 7 tests

---

## Test Organization Patterns

### Test Suite Structure

**Use `describe` blocks to group related tests:**

```typescript
import { test, expect } from '@playwright/test';
import {
  waitForServiceWorker,
  clearIndexedDB,
  clearLocalStorage,
} from '../support/helpers/pwaHelpers';

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
    await expect(page.locator('[data-testid="message-favorite-button"]')).not.toHaveClass(
      /favorited/
    );
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
playwright.$('button'); // Find element
playwright.$$('button'); // Find all elements
playwright.$eval('button', (el) => el.textContent); // Evaluate JS
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

GitHub Actions workflow automatically runs Playwright tests on every push and pull request, providing continuous validation of code changes before they merge to main.

### Workflow Overview

**File:** `.github/workflows/playwright.yml` (created in Story 2.6)

**Triggers:**

- **Push to `main` branch:** Validates merged code stays healthy
- **Pull requests:** Validates code before merge, blocks PRs if tests fail
- **Manual dispatch:** Can manually trigger workflow from Actions tab (optional)

**Environment:**

- **Runner:** Ubuntu 22.04 (ubuntu-latest)
- **Node.js:** 20.x (matches local development)
- **Browsers:** Chromium, Firefox (automatically installed with system dependencies)
- **Workers:** 2 (CI resource constraints: 2-core CPU, 7GB memory)
- **Retries:** Configured in `playwright.config.ts` based on `CI` environment variable
- **Timeout:** 10 minutes maximum workflow execution time

**CI-Specific Configuration:**

The Playwright config automatically adjusts for CI environments via the `process.env.CI` flag:

- CI uses fewer workers (2 vs 12 local) due to resource constraints
- Retries enabled in CI (2) to handle transient failures, disabled locally (0) for fast feedback
- GitHub reporter enabled for better CI output formatting
- HTML reporter generates artifacts for debugging failures

### Viewing Test Results

#### GitHub Actions UI

1. **Navigate to Actions tab** on GitHub repository
2. **Select "Playwright Tests" workflow** from left sidebar
3. **Click on a workflow run** to view details
4. **Review test results:**
   - ✅ Green checkmark = All tests passed
   - ❌ Red X = Tests failed (blocks PR merge if branch protection enabled)
   - 🟡 Yellow circle = Workflow in progress

#### Test Annotations

- Failed tests appear as **annotations** on the PR
- Each failure shows **file, line number, and error message**
- Click annotation to jump to exact failure location in workflow logs

#### Workflow Logs

- Expand each step to view detailed logs
- **"Run Playwright tests"** step shows individual test results
- Logs include test execution time, browser used, and failure details

### Downloading Artifacts

When tests fail (or if configured with `if: always()`), CI uploads test artifacts for debugging.

**Artifacts included:**

- **`playwright-report/`** - Full HTML test report with screenshots and traces
- **`test-results/`** - Raw test output files (if present)

**How to download:**

1. Go to **GitHub Actions tab** → **Select failed workflow run**
2. Scroll to **"Artifacts" section** at bottom of page
3. Click **`playwright-report-{run-number}`** to download ZIP file
4. **Extract the ZIP** to a local folder
5. **Open `playwright-report/index.html`** in a web browser

**Artifact retention:** 7 days (configurable in workflow file)

**Viewing HTML report:**

- Index page shows all test suites and pass/fail status
- Click on failed test to see error details, screenshots, and traces
- Use trace viewer for step-by-step debugging with DOM snapshots

### Troubleshooting CI Failures

#### Issue: Workflow fails with "Playwright browser install failed"

**Symptoms:**

- CI log shows error during `npx playwright install --with-deps` step
- Error message: "Failed to install browsers" or "Failed to download browsers"

**Causes:**

- Network timeout downloading browser binaries (~1.5GB)
- Corrupted npm cache in CI environment
- GitHub Actions runner out of disk space

**Solutions:**

1. **Re-run workflow:** Often transient network issues resolve on retry
2. **Check GitHub Actions status:** Verify no platform-wide outages
3. **Review disk space:** Workflow logs show disk usage; artifact retention may need adjustment
4. **Verify workflow syntax:** Ensure `--with-deps` flag is present (installs system dependencies)

**Prevention:** CI workflow uses `actions/cache` for npm dependencies (optional optimization)

#### Issue: Tests timeout waiting for dev server

**Symptoms:**

- CI log shows: "Timed out waiting 180000ms for dev server to start"
- Tests never run, workflow fails during server startup
- Local tests pass but CI fails

**Causes:**

- webServer timeout too aggressive for CI resource constraints
- Port conflict or binding issue in CI environment
- Missing environment variables or configuration
- npm ci installed incompatible dependencies

**Solutions:**

1. **Increase timeout in `playwright.config.ts`:**
   ```typescript
   webServer: {
     timeout: 180 * 1000, // Current: 180s
   }
   ```
2. **Check CI logs for server errors:** Expand "Run Playwright tests" step, look for server output
3. **Verify package-lock.json is committed:** CI uses `npm ci` which requires lock file
4. **Test locally with CI configuration:** Use `CI=true npm run test:e2e` to simulate CI environment

**Prevention:** Story 2.4 validated webServer works in CI; timeouts already tuned for typical startup (10-30s)

#### Issue: Flaky tests in CI but pass locally

**Symptoms:**

- Tests pass consistently locally (12 workers, 0 retries, fast machine)
- Tests fail intermittently in CI (2 workers, slower execution, transient issues)
- Failures with "Timeout exceeded" or "Element not visible"

**Causes:**

- Timing issues due to slower CI resources (2-core CPU vs local multi-core)
- Race conditions in test code not caught by fast local execution
- CI-specific browser behavior (headless vs headed)
- Network latency for external resources (if tests hit real URLs)

**Solutions:**

1. **Review test for timing assumptions:** Remove `waitForTimeout()`, use auto-waiting assertions
2. **Increase retries temporarily:** Set `retries: 2` in `playwright.config.ts` for CI
3. **Use explicit waits:** Replace fragile selectors with robust `data-testid` attributes
4. **Check CI-specific logs:** Look for warnings about slow operations
5. **Reproduce locally with CI settings:**
   ```bash
   CI=true npx playwright test --workers=2 --retries=2
   ```

**Prevention:** Follow [data-testid convention](#data-testid-naming-convention) and auto-waiting patterns

#### Issue: Workflow doesn't trigger on PR

**Symptoms:**

- Push to PR branch, but no workflow appears in Actions tab
- "Checks" section on PR shows nothing
- Other repositories' workflows work fine

**Causes:**

- Workflow YAML syntax error (GitHub silently ignores invalid workflows)
- Workflow file not in `main` branch yet (first PR with workflow won't trigger itself)
- GitHub Actions disabled in repository settings
- Branch protection rules misconfigured

**Solutions:**

1. **Validate YAML syntax:** Use [GitHub Actions YAML validator](https://rhysd.github.io/actionlint/)
2. **Merge workflow to main first:** First-time workflow setup requires merge to main before triggering
3. **Check repository settings:** Settings → Actions → General → ensure Actions enabled
4. **Review branch filters:** Verify `on.pull_request.branches` allows your branch pattern
5. **Check workflow permissions:** Settings → Actions → General → Workflow permissions

**Prevention:** After merging workflow to main, all subsequent PRs will trigger it automatically

#### Issue: Artifacts not uploading despite failures

**Symptoms:**

- Tests fail, but no artifacts appear in "Artifacts" section
- Workflow completes without uploading reports

**Causes:**

- `if: failure()` condition not met (workflow canceled before upload step)
- Artifact path incorrect (playwright-report/ not generated)
- Artifact size exceeds GitHub limits (2GB per artifact)
- Upload step failed silently

**Solutions:**

1. **Check artifact upload step logs:** Expand "Upload test artifacts" step for errors
2. **Change condition to `if: always()`:** Uploads artifacts even on success (helpful for debugging)
3. **Verify report generation:** Check "Run Playwright tests" logs for HTML reporter output
4. **Check artifact size:** Large traces/videos may exceed limits; adjust retention policy
5. **Review upload action version:** Ensure using `actions/upload-artifact@v4` (latest stable)

**Prevention:** Workflow configured with `if: always()` to capture all runs; retention set to 7 days

### Reproducing CI Failures Locally

When CI fails but local tests pass, reproduce the exact CI environment to debug.

**Step 1: Match Node.js version**

```bash
# Check current Node version
node --version

# If not 20.x, install via nvm:
nvm install 20
nvm use 20
```

**Step 2: Clean install dependencies (match CI)**

```bash
# Remove existing node_modules and package-lock changes
rm -rf node_modules package-lock.json

# Clean install from lock file (same as CI)
npm ci
```

**Step 3: Install Playwright browsers with system dependencies**

```bash
# Install browsers exactly as CI does
npx playwright install --with-deps
```

**Step 4: Run tests with CI environment settings**

```bash
# Set CI env var to trigger CI-specific config
CI=true npm run test:e2e
```

**Alternative: Match CI worker/retry config**

```bash
# Run with same parallelization and retries as CI
npx playwright test --workers=2 --retries=2
```

**Step 5: Compare outputs**

- **Local output:** Fast execution, detailed terminal output
- **CI output:** Slower execution, GitHub reporter format, resource constraints
- **Key differences:** Worker count (12 local vs 2 CI), retries (0 local vs 2 CI)

**If tests still pass locally:**

1. **Check CI logs for system differences:** Browser version, OS, environment variables
2. **Test in Docker with Ubuntu image:**
   ```bash
   docker run -it --rm -v $(pwd):/app -w /app node:18 bash
   npm ci && npx playwright install --with-deps && CI=true npm run test:e2e
   ```
3. **Enable verbose logging in CI:** Add `--reporter=list,html` to see detailed test output
4. **Download CI artifacts:** Review HTML report for screenshots/traces of exact failure

**Common gotchas:**

- **Timing differences:** CI is slower, exposes race conditions masked by fast local execution
- **Headless vs headed:** CI always runs headless; local may default to headed (slower)
- **Environment variables:** CI may have different env vars; check workflow file for secrets/vars
- **File permissions:** Linux CI vs macOS/Windows local can have permission differences

---

## Common Pitfalls and Solutions

### Timing Issues

**Problem:** Test fails intermittently with "element not found" or "timeout"

**Solution:** Use explicit waits, not arbitrary sleeps

❌ **Bad:**

```typescript
await page.click('button');
await page.waitForTimeout(2000); // Arbitrary wait
expect(page.locator('.result')).toBeVisible();
```

✅ **Good:**

```typescript
await page.click('button');
await expect(page.locator('.result')).toBeVisible(); // Waits until visible
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
await page.click('.btn.btn-primary.rounded-lg'); // Brittle, coupled to styling
```

✅ **Good:**

```typescript
await page.click('[data-testid="submit-button"]'); // Stable, semantic
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
  await goOffline(page); // Service worker may not be ready!
  // Test may fail
});
```

✅ **Good:**

```typescript
test('should work offline', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page); // Ensure SW ready
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
  await clearIndexedDB(page, 'my-love-db'); // Clean state
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
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/save') && response.status() === 200
  );

  await page.click('[data-testid="save-button"]');
  await responsePromise; // Ensure request completed

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

### Epic 1 Test Coverage and Scope

The E2E test suite provides comprehensive coverage of Epic 1 foundation features, with intentional gaps for features best validated through other means.

#### Features Covered by E2E Tests

| Epic 1 Story                                           | Test Coverage            | Test Suite(s)                                                          |
| ------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| **Story 1.2:** Zustand Persist Middleware Fix          | ✅ **Comprehensive**     | `persistence.spec.ts`                                                  |
| - LocalStorage hydration on app init                   | ✅ Tested                | `should hydrate LocalStorage on app init`                              |
| - State persistence after changes                      | ✅ Tested                | `should persist LocalStorage after state changes`                      |
| - Persist middleware version                           | ✅ Tested                | `should include version in persisted state`                            |
| - State migration                                      | ✅ Tested                | `should handle state migration gracefully`                             |
| **Story 1.3:** IndexedDB/Service Worker Fix            | ✅ **Comprehensive**     | `persistence.spec.ts`, `favorites.spec.ts`, `setup-validation.spec.ts` |
| - IndexedDB CRUD operations                            | ✅ Tested                | `should access IndexedDB store`                                        |
| - Service worker registration                          | ✅ Tested                | `should register service worker`                                       |
| - Offline mode favorites                               | ✅ Tested                | `should persist favorite in offline mode`                              |
| - IndexedDB quota handling                             | ✅ Tested                | `should handle IndexedDB quota exceeded gracefully`                    |
| **Story 1.4:** Pre-Configuration (Hardcoded Constants) | ✅ **Comprehensive**     | `settings.spec.ts`                                                     |
| - Partner name pre-configured                          | ✅ Tested                | `should load pre-configured partner name on first init`                |
| - Start date pre-configured                            | ✅ Tested                | `should load pre-configured start date on first init`                  |
| - Duration calculation from constants                  | ✅ Tested                | `should calculate relationship duration correctly`                     |
| **Story 1.5:** Refactoring & Code Quality              | ✅ **Implicit Coverage** | All test suites                                                        |
| - Regression detection                                 | ✅ Tested                | All 106 passing tests validate refactored code behavior                |
| - No functional regressions                            | ✅ Verified              | 100% pass rate across all features                                     |

#### Features Intentionally Not Covered by E2E Tests

| Epic 1 Story                                | Reason Not E2E Tested     | Validation Method                             |
| ------------------------------------------- | ------------------------- | --------------------------------------------- |
| **Story 1.1:** Technical Debt Audit         | Analysis-only story       | Manual review, documentation                  |
| - Codebase analysis                         | N/A                       | Audit report in `docs/technical-decisions.md` |
| - Refactoring recommendations               | N/A                       | Implemented in Story 1.5                      |
| **Story 1.6:** Build & Deployment Hardening | Infrastructure validation | Manual build/deploy verification              |
| - Build process                             | Not E2E testable          | `npm run build` success verified manually     |
| - Deployment configuration                  | Not E2E testable          | Deployment tested manually                    |
| - Production optimizations                  | Indirect testing          | Performance validated through dev testing     |

#### Edge Cases and Scenarios Not Covered

The following edge cases are documented but not covered by automated E2E tests due to complexity or impracticality:

**Storage Edge Cases:**

- **Storage quota exhaustion:** Tests simulate quota exceeded, but not actual browser storage limits (varies by browser and OS)
- **Corrupted LocalStorage data:** Tests don't simulate data corruption scenarios (rare in practice)
- **IndexedDB versioning conflicts:** Multiple app versions running simultaneously not tested

**Network and Performance Edge Cases:**

- **Extremely slow networks (< 2G):** Tests use binary offline/online, not gradual network degradation
- **App behavior under sustained high latency (> 5 seconds):** Tests focus on typical network conditions
- **Race conditions in service worker registration:** Service worker timing tested but not all edge cases

**Browser and System Edge Cases:**

- **Browser crashes or abrupt closures:** OS-level events not testable in E2E framework
- **System resource exhaustion (out of memory):** Tests assume sufficient system resources
- **PWA installation flows:** Platform-dependent installation not tested (requires manual validation on iOS/Android)

**User Interaction Edge Cases:**

- **Rapid successive actions (button mashing):** Tests validate normal user interaction patterns
- **Concurrent tabs modifying same data:** Single-tab assumption (LocalStorage sync between tabs not tested)

**Justification for Gaps:**
These edge cases represent <1% of real-world usage and are either:

1. **Impractical to test:** Require OS-level control or complex environment simulation
2. **Low probability:** Rare scenarios with minimal user impact
3. **Better validated manually:** Human testing provides better coverage for UX edge cases
4. **Already mitigated:** Application code includes defensive error handling for these scenarios

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

**Last Updated:** 2025-10-31 (Story 2.5: Epic 1 Test Coverage & Edge Cases Documentation Added)
**Testing Framework Version:** Playwright 1.56.1
**Maintained By:** My-Love Development Team
