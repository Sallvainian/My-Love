# Epic Technical Specification: Testing Infrastructure & Quality Assurance

Date: 2025-10-30
Author: Frank
Epic ID: 2
Status: Draft

---

## Overview

Epic 2 establishes comprehensive end-to-end testing infrastructure for the My Love PWA, transforming the testing strategy from manual validation to automated quality assurance. With Epic 1 delivering a stable, production-ready foundation with fixed persistence and pre-configured deployment, Epic 2 ensures that foundation remains stable through rapid feature expansion in Epics 3-5 by implementing Playwright-based E2E testing with 100% coverage of Epic 1 features.

This epic addresses the critical need for regression prevention as the application scales from 2 implemented components to the planned 8+ components across photo galleries, mood tracking, and interactive features. By establishing testing infrastructure now—including PWA-specific helpers for service worker testing, IndexedDB validation, and offline mode scenarios—we enable confident, rapid iteration without fear of breaking existing functionality. The deliverable is a fully automated test suite integrated with GitHub Actions CI that validates every commit before deployment, catching bugs before users encounter them.

## Objectives and Scope

**In Scope:**
- Scaffold Playwright testing framework with TypeScript configuration (Story 2.1)
- Create PWA-specific test helpers: waitForServiceWorker, clearIndexedDB, goOffline, goOnline (Story 2.1)
- Configure multi-browser testing (Chromium, Firefox, WebKit) with parallel execution (Story 2.1)
- Write comprehensive integration tests for all Epic 1 features: message display, favorites, settings, navigation, persistence (Story 2.2)
- Add semantic data-testid attributes to all interactive elements following consistent naming convention (Story 2.3)
- Configure Playwright webServer option to auto-start Vite dev server for tests (Story 2.4)
- Achieve 100% test coverage of Epic 1 critical user paths with passing tests across all browsers (Story 2.5)
- Integrate test suite into GitHub Actions CI with automatic PR blocking on failures (Story 2.6)
- Generate HTML test reports with screenshots on failure for debugging (Story 2.6)
- Document testing guidelines, patterns, and troubleshooting in tests/README.md (Story 2.1, 2.6)

**Out of Scope:**
- Unit testing individual React components (focus is E2E integration testing)
- Performance testing or load testing (defer to future optimization epic)
- Accessibility testing automation (manual WCAG validation sufficient for Epic 2)
- Visual regression testing (screenshots for debugging only, not pixel-perfect comparison)
- Testing features from Epics 3-5 (photo gallery, mood tracking, countdowns) - will add test coverage when implementing those features
- Mocking external services or APIs (no external dependencies exist in client-side PWA)
- Code coverage metrics (E2E coverage by user path, not line coverage)
- Cross-device testing on real devices (emulated mobile viewports sufficient)

## System Architecture Alignment

Epic 2 integrates seamlessly with the existing architecture established in Epic 1 without requiring any architectural changes:

**Component Architecture:** Tests validate the component-based SPA pattern by exercising the full component tree: App.tsx → ErrorBoundary → DailyMessage with all interactions (favorite, share, theme switching). Tests will verify pre-configuration bypass of Onboarding component and settings initialization from hardcoded constants (Story 1.4 dependency).

**State Management:** Test suite validates Zustand persist middleware fixes from Story 1.2 by testing state hydration across browser sessions, verifying partialize strategy correctly persists settings/messageHistory/moods to LocalStorage while keeping messages/photos in-memory only.

**Data Layer:** PWA-specific test helpers ensure IndexedDB operations (via idb 8.0.3) work correctly with Workbox service worker, validating Story 1.3 fixes for offline persistence. Tests will cover IndexedDB transactions for message favorites and verify no service worker interference.

**Build/Deploy Pipeline:** GitHub Actions CI workflow integrates with existing Vite build → gh-pages deployment pipeline (Story 1.6), adding automated quality gates before code merges to main branch.

**Testing Framework Addition:** Playwright (new dependency) operates at browser automation layer, interacting with deployed app via Chrome DevTools Protocol. Does not require changes to application code beyond adding data-testid attributes for stable element selection.

**Constraints:**
- Tests must work with offline-first PWA architecture (service worker registration, cache-first strategies)
- Multi-browser support requires testing IndexedDB/LocalStorage compatibility across Chromium, Firefox, WebKit
- GitHub Actions free tier limits: 2000 minutes/month for private repos (estimated 10 mins per CI run)
- Test execution time target: < 5 minutes locally, < 10 minutes in CI (to maintain developer productivity)

## Detailed Design

### Services and Modules

| Module/Service | Responsibilities | Input | Output | Owner/Story |
|----------------|------------------|-------|--------|-------------|
| **Playwright Test Runner** | Execute E2E tests across browsers | Test files (*.spec.ts) | Test results, screenshots | Story 2.1 |
| **PWA Test Helpers** | Service worker, IndexedDB, offline testing utilities | Browser context | Promise<void> or state info | Story 2.1 |
| **Test Fixtures** | Reusable test setup (authenticated state, clean DB) | Test context | Configured page/context | Story 2.1 |
| **DailyMessage Test Suite** | Validate message display, rotation, animations | Epic 1 features | Pass/fail assertions | Story 2.2 |
| **Favorites Test Suite** | Validate favorite toggle, persistence, UI updates | Favorite functionality | Pass/fail assertions | Story 2.2 |
| **Settings Test Suite** | Validate settings persistence, pre-configuration | Settings features | Pass/fail assertions | Story 2.2 |
| **Navigation Test Suite** | Validate routing (future), theme switching | Navigation features | Pass/fail assertions | Story 2.2 |
| **Persistence Test Suite** | Validate LocalStorage/IndexedDB across sessions | State persistence | Pass/fail assertions | Story 2.2 |
| **Auto-Start Dev Server** | Launch Vite dev server before tests | playwright.config.ts | Running server on dynamic port | Story 2.4 |
| **GitHub Actions Workflow** | CI/CD test execution on PR/push | .github/workflows/playwright.yml | Test results, artifacts | Story 2.6 |
| **HTML Test Reporter** | Generate visual test reports with screenshots | Test run results | HTML report + artifacts | Story 2.6 |

**Key Module Interactions:**
- Playwright Test Runner → PWA Test Helpers → Browser APIs (Service Worker, IndexedDB)
- Test Suites → Test Fixtures → PWA Helpers → Application Under Test
- Auto-Start Dev Server → Vite → Playwright (wait for server readiness)
- GitHub Actions → Playwright CLI → Test Runner → Reporters (HTML, GitHub Actions)

### Data Models and Contracts

**No new application data models** - Epic 2 adds test infrastructure only, not production code changes (except data-testid attributes).

**Test Configuration Types:**

```typescript
// playwright.config.ts
interface PlaywrightConfig {
  testDir: string;              // './tests/e2e'
  timeout: number;              // 30000ms per test
  retries: number;              // 2 retries on CI, 0 locally
  workers: number;              // Parallel test execution (4 locally, 2 CI)
  reporter: Reporter[];         // ['html', 'github'] reporters
  use: {
    baseURL: string;            // 'http://localhost:5173/My-Love/'
    trace: 'on-first-retry';    // Trace collection strategy
    screenshot: 'only-on-failure';
    video: 'retain-on-failure';
  };
  projects: BrowserProject[];   // Chromium, Firefox, WebKit configs
  webServer: {
    command: 'npm run dev';
    url: 'http://localhost:5173/My-Love/';
    timeout: 120000;            // 2 min server start timeout
    reuseExistingServer: boolean; // !process.env.CI
  };
}
```

**PWA Test Helper Types:**

```typescript
// tests/support/helpers/pwaHelpers.ts
export interface PWATestHelpers {
  waitForServiceWorker(page: Page, timeout?: number): Promise<void>;
  clearIndexedDB(page: Page, dbName: string): Promise<void>;
  goOffline(page: Page): Promise<void>;
  goOnline(page: Page): Promise<void>;
  getLocalStorageItem(page: Page, key: string): Promise<string | null>;
  setLocalStorageItem(page: Page, key: string, value: string): Promise<void>;
  clearLocalStorage(page: Page): Promise<void>;
  getIndexedDBStore(page: Page, dbName: string, storeName: string): Promise<any[]>;
}
```

**Test Fixture Types:**

```typescript
// tests/support/fixtures/baseFixture.ts
export interface TestFixtures {
  cleanApp: Page;               // Fresh app state (cleared storage)
  appWithMessages: Page;        // App with default 100 messages loaded
  appWithFavorites: Page;       // App with 5 pre-favorited messages
  appWithCustomTheme: Page;     // App with Ocean Dreams theme set
}
```

**Data-testid Naming Convention (Story 2.3):**

```typescript
// Naming pattern: [component]-[element]-[action?]
// Examples:
'message-card'                  // Main message display
'message-favorite-button'       // Favorite toggle button
'message-share-button'          // Share button
'message-text'                  // Message content text
'message-category-badge'        // Category badge
'settings-partner-name-input'   // Partner name input field
'settings-start-date-input'     // Relationship start date input
'settings-theme-select'         // Theme dropdown
'navigation-home-link'          // Home navigation link
'navigation-favorites-link'     // Favorites navigation link
'navigation-settings-link'      // Settings navigation link
```

### APIs and Interfaces

**No external APIs** - Testing framework interacts with browser APIs only.

**Browser APIs Under Test:**

**1. Service Worker API**
```typescript
// Validated by PWA helpers in tests
navigator.serviceWorker.register('/sw.js')
navigator.serviceWorker.ready
navigator.serviceWorker.controller
// Test coverage: SW registration, cache population, offline mode
```

**2. IndexedDB API**
```typescript
// Validated by persistence tests
indexedDB.open('my-love-db', 1)
transaction.objectStore('messages').add(message)
transaction.objectStore('photos').get(id)
// Test coverage: CRUD operations, offline transactions, quota handling
```

**3. LocalStorage API**
```typescript
// Validated by state persistence tests
localStorage.setItem('my-love-storage', JSON.stringify(state))
localStorage.getItem('my-love-storage')
// Test coverage: Zustand persist hydration, quota exceeded scenarios
```

**4. Web Share API**
```typescript
// Validated by message sharing tests
navigator.share({ title, text, url })
navigator.clipboard.writeText(text) // Fallback
// Test coverage: Share functionality, clipboard fallback
```

**Playwright Test API Usage:**

```typescript
// Test structure
import { test, expect } from '@playwright/test';
import { waitForServiceWorker, clearIndexedDB } from '../support/helpers/pwaHelpers';

test.describe('Message Display', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDB(page, 'my-love-db');
    await page.goto('/');
    await waitForServiceWorker(page);
  });

  test('should display today\'s message', async ({ page }) => {
    const messageCard = page.getByTestId('message-card');
    await expect(messageCard).toBeVisible();
    const messageText = page.getByTestId('message-text');
    await expect(messageText).not.toBeEmpty();
  });
});
```

**GitHub Actions Workflow API:**

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Workflows and Sequencing

**Story Execution Sequence:** 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 (sequential, each builds on previous)

**Critical Workflow 1: Test Suite Execution (Local Development)**

```
Developer runs: npm run test:e2e
    ↓
[Story 2.4] Playwright config checks webServer.reuseExistingServer
    ↓
If dev server not running:
  Execute: npm run dev
  Wait for: http://localhost:5173/My-Love/ to respond (120s timeout)
  ↓
Playwright launches 3 browser instances (Chromium, Firefox, WebKit)
    ↓
For each browser:
  [Story 2.1] Load test fixtures and PWA helpers
  [Story 2.2] Execute test suites in parallel (workers=4):
    - DailyMessage tests (10 test cases)
    - Favorites tests (8 test cases)
    - Settings tests (6 test cases)
    - Navigation tests (5 test cases)
    - Persistence tests (8 test cases)
  ↓
  [Story 2.3] Tests locate elements via data-testid selectors
  ↓
  [Story 2.1] PWA helpers validate:
    - Service worker registered
    - IndexedDB operations complete
    - Offline mode works
    ↓
  Collect results: pass/fail, screenshots (on failure), traces (on retry)
    ↓
[Story 2.6] Generate HTML report: playwright-report/index.html
    ↓
Exit with code 0 (success) or 1 (failure)
```

**Critical Workflow 2: CI Test Execution (GitHub Actions)**

```
Git push to main or PR opened
    ↓
[Story 2.6] GitHub Actions workflow triggered (.github/workflows/playwright.yml)
    ↓
Checkout code (actions/checkout@v4)
    ↓
Setup Node.js 18 (actions/setup-node@v4)
    ↓
Install dependencies: npm ci
    ↓
Install Playwright browsers with system dependencies:
  npx playwright install --with-deps
    ↓
[Story 2.4] Playwright auto-starts Vite dev server (webServer config)
  Wait for server ready (120s timeout)
    ↓
Execute tests with CI-specific config:
  - retries: 2 (vs 0 locally)
  - workers: 2 (vs 4 locally, constrained by CI resources)
  - trace: 'on-first-retry'
  - video: 'retain-on-failure'
    ↓
[Story 2.5] All tests must pass in all browsers:
  - Chromium tests (37 test cases)
  - Firefox tests (37 test cases)
  - WebKit tests (37 test cases)
    ↓
If ANY test fails:
  [Story 2.6] Upload artifacts to GitHub (HTML report, screenshots, videos, traces)
  Set workflow status: FAILURE (blocks PR merge)
    ↓
If ALL tests pass:
  Set workflow status: SUCCESS
  Show green checkmark on PR
    ↓
Developer reviews results on GitHub Actions tab
```

**Critical Workflow 3: Adding data-testid to Components (Story 2.3)**

```
Developer opens component file (e.g., DailyMessage.tsx)
    ↓
Identify all interactive elements:
  - Buttons (favorite, share, theme switcher)
  - Input fields (settings form)
  - Navigation links
  - Message display areas
    ↓
Add data-testid attribute following naming convention:
  <button data-testid="message-favorite-button" onClick={...}>
  <div data-testid="message-text">{message.text}</div>
  <input data-testid="settings-partner-name-input" value={...} />
    ↓
Update tests to use new data-testid selectors:
  page.getByTestId('message-favorite-button')
    ↓
Run tests locally: npm run test:e2e
    ↓
Verify tests pass with new selectors
    ↓
Commit changes: Add data-testid attributes to DailyMessage component
    ↓
Push to PR → CI validates → Merge
```

**Critical Workflow 4: Test Failure Debugging (Story 2.5)**

```
Test fails in CI (e.g., "Favorites persistence test")
    ↓
Developer views GitHub Actions run log
    ↓
Click "playwright-report" artifact download
    ↓
Extract and open playwright-report/index.html locally
    ↓
Navigate to failed test in HTML report
    ↓
View:
  - Screenshot at moment of failure
  - Video recording of full test run
  - Trace file (timeline of actions, network requests, console logs)
    ↓
Playwright trace viewer opened (npx playwright show-trace trace.zip)
    ↓
Step through test execution:
  - Inspect DOM state at each step
  - View network requests
  - Check console errors
  - Analyze timing issues
    ↓
Identify root cause (e.g., timing issue, selector changed, regression)
    ↓
Fix code or test locally
    ↓
Rerun tests: npm run test:e2e
    ↓
Push fix to PR → CI retries → Tests pass
```

## Non-Functional Requirements

### Performance

**Test Execution Performance Targets:**

- **Local Test Execution:** < 5 minutes for full suite across 3 browsers (Chromium, Firefox, WebKit)
  - Parallel execution with 4 workers reduces wall time
  - Target: 37 tests × 3 browsers = 111 total test executions in < 5 minutes
  - Individual test timeout: 30 seconds max

- **CI Test Execution:** < 10 minutes for full suite in GitHub Actions
  - Constrained to 2 workers due to CI resource limits
  - Includes: npm ci (dependency install), playwright install --with-deps (browser install), test execution
  - Target breakdown: 3 min setup + 7 min test execution

- **Dev Server Startup:** < 30 seconds for Vite dev server to become ready
  - Playwright webServer waits up to 120 seconds timeout
  - Fast HMR ensures quick iteration during test development

- **Test Development Iteration Speed:** < 10 seconds for single test re-execution
  - Playwright watch mode (npx playwright test --ui) enables rapid iteration
  - Target: modify test → save → see result in < 10s

**Test Infrastructure Impact on App Performance:**

- **Zero production impact:** data-testid attributes (Story 2.3) add ~200 bytes to HTML (negligible)
- **No runtime overhead:** Playwright operates external to application (browser automation)
- **No bundle size increase:** Test files not included in production build
- **CI build time:** +10 minutes per PR (acceptable for quality gates)

**Performance Monitoring:**

- Playwright built-in reporters track test execution time per suite
- GitHub Actions shows workflow duration (must stay under 10 min to prevent developer friction)
- Slow test detection: individual tests > 15s flagged for optimization in Story 2.5

### Security

**Test Infrastructure Security Considerations:**

**Playwright Browser Context Isolation:**
- Each test runs in isolated browser context (clean cookies, storage, cache)
- Prevents cross-test data leakage
- No shared state between test executions

**GitHub Actions CI Security:**
- Tests run in ephemeral containers (destroyed after each workflow run)
- No persistent storage of sensitive data
- GitHub Actions secrets used for deployment (not exposed to test logs)

**Test Data Security:**
- No real user data in tests (all test data is synthetic/hardcoded)
- Pre-configured relationship data (Story 1.4) safely committed to repo (non-sensitive: partner name, date)
- No API keys or secrets required (client-side PWA with no backend)

**data-testid Attributes Security:**
- Attributes are HTML data attributes (standard, no security risk)
- Not used for application logic (testing only)
- Do not expose sensitive information (e.g., "message-favorite-button" not "message-12345")

**Dependency Security:**
- Playwright maintained by Microsoft (trusted source)
- Regular updates via Dependabot (GitHub security scanning)
- No test dependencies with known CVEs at Epic 2 start

**CI Workflow Security Best Practices:**
- Workflow permissions set to minimal required (contents: read, pull-requests: write)
- No external secrets or credentials needed for testing
- Artifacts (test reports) uploaded to GitHub (not public CDN)

### Reliability/Availability

**Test Reliability Targets:**

- **Flaky Test Rate:** < 1% (99%+ consistent pass rate across 10 consecutive runs)
  - Story 2.5 requires tests pass consistently before marking complete
  - Retries configured: 0 locally, 2 in CI (to handle transient CI environment issues)
  - Root cause flakiness: timing issues (use explicit waits, not sleep/timeout guesses)

- **Test Coverage Stability:** 100% of Epic 1 features must remain covered
  - As Epic 1 features evolve (bug fixes), tests must be updated to maintain coverage
  - Regression detection: any test failure indicates potential regression or test update needed

- **CI Availability:** Dependent on GitHub Actions uptime (99.9%+ SLA)
  - Fallback: local test execution always available (npm run test:e2e)
  - CI failures due to GitHub Actions outage do not block local development

**Test Infrastructure Failure Scenarios:**

| Failure | Impact | Mitigation | Story |
|---------|--------|------------|-------|
| Playwright browser install fails | CI tests cannot run | Cache browsers in CI, retry logic | 2.6 |
| Dev server fails to start | Tests timeout waiting for server | Increase webServer timeout to 120s, check port conflicts | 2.4 |
| Service worker registration fails | PWA tests fail | waitForServiceWorker helper with timeout, fallback to skip SW-dependent tests | 2.1 |
| IndexedDB quota exceeded | Persistence tests fail | clearIndexedDB before each test in fixtures | 2.1, 2.2 |
| Test selector breaks (component refactor) | Tests fail to find elements | data-testid attributes (Story 2.3) resist refactoring, update tests if intentional UI change | 2.3 |
| GitHub Actions runner out of disk space | CI fails mid-workflow | Clean up artifacts, reduce video retention (retain-on-failure only) | 2.6 |
| Network timeout in CI | Tests fail intermittently | Increase Playwright timeout config, retry: 2 in CI | 2.6 |

**Reliability Patterns Implemented:**

- **Explicit Waits:** Use Playwright auto-waiting (expect(element).toBeVisible()) instead of arbitrary sleep() calls
- **Idempotent Test Setup:** Each test starts with clean state (clearIndexedDB, clearLocalStorage)
- **Test Isolation:** No dependencies between tests (can run in any order, parallel execution safe)
- **Deterministic Test Data:** Hardcoded message content, dates, and state (no randomness causing flakiness)

### Observability

**Test Execution Observability:**

**Local Development:**
- **Console Output:** Real-time test progress (test name, pass/fail status)
- **HTML Report:** playwright-report/index.html generated after each run
  - Visual test results with timeline
  - Screenshots of failed tests
  - Video recordings (if enabled)
  - Trace files for detailed debugging
- **Playwright UI Mode:** npx playwright test --ui (interactive test explorer)
  - Run/debug individual tests
  - Time-travel debugging with trace viewer
  - Step-by-step execution with DOM inspection

**CI (GitHub Actions):**
- **Workflow Logs:** Real-time console output in GitHub Actions UI
  - Test execution progress
  - Error messages and stack traces
  - Playwright installation logs
- **Artifacts:** Uploaded on workflow completion (always, even on success)
  - HTML test report (playwright-report/)
  - Screenshots (screenshots/)
  - Videos (videos/, only on failure)
  - Traces (traces/, only on retry)
- **Status Badge:** README.md includes workflow status badge (green/red)
- **PR Comments:** GitHub Actions bot comments on PRs with test results summary (optional enhancement Story 2.6)

**Test Metrics Tracked:**

| Metric | Location | Purpose | Story |
|--------|----------|---------|-------|
| Test pass/fail count | Playwright reporter | Overall test health | 2.1 |
| Execution time per suite | HTML report | Identify slow tests | 2.5 |
| Execution time per browser | HTML report | Browser-specific performance issues | 2.5 |
| Flaky test rate | Manual analysis (10 runs) | Reliability validation | 2.5 |
| CI workflow duration | GitHub Actions logs | Ensure < 10 min target | 2.6 |
| Test coverage by feature | Manual tracking (checklist) | Ensure 100% Epic 1 coverage | 2.5 |

**Debugging Tools:**

- **Playwright Trace Viewer:** npx playwright show-trace trace.zip
  - Timeline of all actions (clicks, navigations, assertions)
  - Network requests and responses
  - Console logs
  - DOM snapshots at each step
  - Source code with execution highlights

- **Playwright Inspector:** npx playwright test --debug
  - Pause execution at breakpoints
  - Step through test line-by-line
  - Inspect page state interactively
  - Execute arbitrary Playwright commands in REPL

- **Browser DevTools:** Tests run in headed mode (--headed flag)
  - Inspect DOM, console, network, storage during test execution
  - Useful for understanding failures in local development

## Dependencies and Integrations

### New Dependencies Added (Epic 2)

| Package | Version | Type | Purpose | Story |
|---------|---------|------|---------|-------|
| **@playwright/test** | ^1.48.0 | devDependency | E2E testing framework with browser automation | 2.1 |
| **@types/node** | Already present (^24.6.0) | devDependency | TypeScript types for Node.js (required by Playwright config) | 2.1 |

**No production dependencies added** - Epic 2 is testing infrastructure only.

### Existing Dependencies (Unchanged)

**Production Dependencies** (from Epic 1, no changes):
- react (^19.1.1), react-dom (^19.1.1)
- zustand (^5.0.8), idb (^8.0.3), workbox-window (^7.3.0)
- framer-motion (^12.23.24), lucide-react (^0.548.0)

**Development Dependencies** (from Epic 1, validated compatibility):
- TypeScript (5.9.3) - compatible with Playwright TypeScript test files
- Vite (^7.1.7) - auto-started by Playwright webServer config
- ESLint (^9.36.0) - no linting changes needed for test files
- Tailwind CSS (^3.4.18) - no interaction with test framework

### Integration Points

**Playwright ↔ Vite Dev Server:**
- Playwright `webServer` config auto-starts `npm run dev`
- Waits for `http://localhost:5173/My-Love/` readiness (120s timeout)
- Option `reuseExistingServer: !process.env.CI` allows manual dev server
- Integration validates in Story 2.4

**Playwright ↔ Application Code:**
- Tests interact via browser automation (Chrome DevTools Protocol)
- No direct code imports from application
- Application adds `data-testid` attributes for stable element selection (Story 2.3)
- Tests exercise full application stack: React components → Zustand store → IndexedDB/LocalStorage

**Playwright ↔ Browser APIs:**
- Service Worker API: waitForServiceWorker helper validates registration
- IndexedDB API: tests validate CRUD operations, offline persistence
- LocalStorage API: tests validate Zustand persist hydration
- Web Share API: tests validate share functionality or clipboard fallback

**Playwright ↔ GitHub Actions:**
- `.github/workflows/playwright.yml` defines CI workflow
- Workflow steps: checkout → setup Node → install deps → install Playwright browsers → run tests
- Artifacts uploaded: HTML report, screenshots, videos, traces
- Workflow status (pass/fail) blocks PR merge if configured

**Playwright ↔ Test Helpers/Fixtures:**
- Custom PWA helpers (`tests/support/helpers/pwaHelpers.ts`) provide reusable test utilities
- Test fixtures (`tests/support/fixtures/*.ts`) provide pre-configured test scenarios
- Page Object Model (optional pattern): encapsulate page interactions for maintainability

### Browser Compatibility Testing

**Playwright Project Configuration (3 Browsers):**

```typescript
// playwright.config.ts projects
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
]
```

**Browser Engine Coverage:**
- **Chromium**: Chrome, Edge, Opera (Blink engine)
- **Firefox**: Firefox (Gecko engine)
- **WebKit**: Safari, iOS Safari (WebKit engine)

**Mobile Viewport Testing (Emulation):**
```typescript
// Optional: Add mobile device emulation in Story 2.1
{
  name: 'Mobile Chrome',
  use: { ...devices['Pixel 5'] },
},
{
  name: 'Mobile Safari',
  use: { ...devices['iPhone 12'] },
}
```

### Version Constraints

**Playwright Requirements:**
- Node.js: >= 18.0 (matches application requirement)
- npm: >= 9.0.0
- OS: Linux (CI), macOS/Windows (local development supported)

**Browser Versions:**
- Playwright bundles specific browser versions (updated with @playwright/test package)
- Current versions (as of v1.48.0):
  - Chromium 130.x
  - Firefox 131.x
  - WebKit 18.x (Safari 18 equivalent)

**GitHub Actions Environment:**
- Runner: ubuntu-latest (Ubuntu 22.04)
- Node.js: 18.x (configured via actions/setup-node@v4)
- Disk space: ~14 GB available (Playwright browsers ~1.5 GB total)
- Memory: 7 GB available (sufficient for 2 parallel workers)
- CPU: 2-core (limits parallel execution to 2 workers)

### No External Services

Epic 2 maintains the no-backend architecture:
- No external APIs or services required for testing
- No test data hosted externally (all synthetic data in test files)
- No cloud-based test execution services (e.g., BrowserStack, Sauce Labs)
- GitHub Actions provides CI infrastructure (included with GitHub repo)

## Acceptance Criteria (Authoritative)

These acceptance criteria are extracted from [epics.md](./epics.md) Epic 2 and serve as the authoritative source for story completion validation.

### Story 2.1: Testing Framework Setup

**AC-2.1.1** Install @playwright/test and configure playwright.config.ts
**AC-2.1.2** Set up test directory structure: tests/e2e/, tests/support/fixtures/, tests/support/helpers/
**AC-2.1.3** Create PWA testing helpers: waitForServiceWorker, clearIndexedDB, goOffline, goOnline
**AC-2.1.4** Configure multi-browser support (Chromium, Firefox, WebKit)
**AC-2.1.5** Set up test scripts in package.json (test:e2e, test:e2e:ui, test:e2e:debug)
**AC-2.1.6** Create .env.test.example with test environment variables
**AC-2.1.7** Add tests/README.md with testing guidelines and patterns

### Story 2.2: Component Integration Tests

**AC-2.2.1** Test suite for message display and rotation logic
**AC-2.2.2** Test suite for favorites functionality (add, remove, persist)
**AC-2.2.3** Test suite for settings page (edit name/date, persist changes)
**AC-2.2.4** Test suite for relationship duration calculation accuracy
**AC-2.2.5** Test suite for navigation between Home, Favorites, Settings
**AC-2.2.6** All tests pass consistently (no flakiness)
**AC-2.2.7** Tests validate both UI state and data persistence (LocalStorage, IndexedDB)

### Story 2.3: Add data-testid Attributes to Components

**AC-2.3.1** Add data-testid to all buttons (favorites, navigation, settings actions)
**AC-2.3.2** Add data-testid to message display areas
**AC-2.3.3** Add data-testid to input fields (settings form)
**AC-2.3.4** Add data-testid to navigation elements
**AC-2.3.5** Follow naming convention: [component]-[element]-[action] (e.g., "message-favorite-button")
**AC-2.3.6** Update existing tests to use data-testid selectors (no CSS class dependencies)
**AC-2.3.7** Document data-testid strategy in tests/README.md

### Story 2.4: Configure Auto-Start Preview Server for Tests

**AC-2.4.1** Configure playwright.config.ts webServer option to auto-start Vite dev server
**AC-2.4.2** Server starts on available port (dynamic port detection)
**AC-2.4.3** Tests wait for server readiness before execution
**AC-2.4.4** Server shuts down gracefully after tests complete
**AC-2.4.5** Works in both local development and CI environments
**AC-2.4.6** Add timeout handling for slow server starts
**AC-2.4.7** Test command runs end-to-end without manual intervention

### Story 2.5: Run & Validate Tests Pass

**AC-2.5.1** All Epic 1 features have corresponding E2E tests
**AC-2.5.2** Test coverage report shows 100% of critical user paths covered
**AC-2.5.3** All tests pass in all configured browsers (Chromium, Firefox, WebKit)
**AC-2.5.4** Tests run in under 5 minutes total
**AC-2.5.5** No flaky tests (consistent pass rate across 10 runs)
**AC-2.5.6** Generate HTML test report with screenshots on failure
**AC-2.5.7** Document any known limitations or edge cases not covered

### Story 2.6: Add CI Integration (GitHub Actions)

**AC-2.6.1** Create .github/workflows/playwright.yml workflow file
**AC-2.6.2** Workflow triggers on push to main and all pull requests
**AC-2.6.3** Workflow runs tests on Ubuntu (latest) with all browsers
**AC-2.6.4** Workflow uploads test artifacts (reports, screenshots) on failure
**AC-2.6.5** Workflow fails if any tests fail (blocking PR merge)
**AC-2.6.6** Add status badge to README.md showing test status
**AC-2.6.7** Test execution time in CI under 10 minutes
**AC-2.6.8** Document CI setup and troubleshooting in tests/README.md

**Total Acceptance Criteria:** 43 atomic, testable criteria across 6 stories

## Traceability Mapping

This table maps acceptance criteria to technical specifications, impacted components, and test approaches.

| AC ID | Spec Section | Component/Module | Test Approach |
|-------|-------------|------------------|---------------|
| **AC-2.1.1** | Dependencies | package.json, playwright.config.ts | Verify Playwright installed, config file exists |
| **AC-2.1.2** | Services | tests/ directory structure | Verify directory structure created |
| **AC-2.1.3** | APIs | tests/support/helpers/pwaHelpers.ts | Unit test each helper function |
| **AC-2.1.4** | Dependencies | playwright.config.ts projects | Verify 3 browser projects configured |
| **AC-2.1.5** | Services | package.json scripts | Run each script, verify execution |
| **AC-2.1.6** | Data Models | .env.test.example | Verify file exists with documented variables |
| **AC-2.1.7** | Observability | tests/README.md | Review documentation completeness |
| **AC-2.2.1** | Services | tests/e2e/message-display.spec.ts | Execute test suite, verify 10+ test cases |
| **AC-2.2.2** | Services | tests/e2e/favorites.spec.ts | Execute test suite, verify 8+ test cases |
| **AC-2.2.3** | Services | tests/e2e/settings.spec.ts | Execute test suite, verify 6+ test cases |
| **AC-2.2.4** | Workflows | tests/e2e/relationship-duration.spec.ts | Execute duration calculation tests |
| **AC-2.2.5** | Services | tests/e2e/navigation.spec.ts | Execute navigation tests |
| **AC-2.2.6** | NFR Reliability | All test suites | Run tests 10 times, verify < 1% flakiness |
| **AC-2.2.7** | Workflows | All persistence tests | Verify LocalStorage/IndexedDB validation |
| **AC-2.3.1** | Data Models | Button components | Code review: verify data-testid on buttons |
| **AC-2.3.2** | Data Models | Message display components | Code review: verify data-testid on message areas |
| **AC-2.3.3** | Data Models | Input field components | Code review: verify data-testid on inputs |
| **AC-2.3.4** | Data Models | Navigation components | Code review: verify data-testid on nav elements |
| **AC-2.3.5** | Data Models | All components | Code review: verify naming convention followed |
| **AC-2.3.6** | Services | All test files | Code review: verify getByTestId() usage |
| **AC-2.3.7** | Observability | tests/README.md | Review data-testid documentation |
| **AC-2.4.1** | APIs | playwright.config.ts webServer | Verify webServer config present |
| **AC-2.4.2** | Workflows | playwright.config.ts webServer.url | Test dynamic port detection |
| **AC-2.4.3** | Workflows | Test execution flow | Manual test: run tests with server down |
| **AC-2.4.4** | Workflows | Server lifecycle | Manual test: verify server stops after tests |
| **AC-2.4.5** | Dependencies | CI and local environments | Test in both environments |
| **AC-2.4.6** | NFR Performance | webServer.timeout | Verify 120s timeout configured |
| **AC-2.4.7** | Workflows | npm run test:e2e | Manual test: single command runs all tests |
| **AC-2.5.1** | Services | Test coverage checklist | Manual review: all Epic 1 features tested |
| **AC-2.5.2** | Observability | Test coverage report | Generate report, verify 100% critical paths |
| **AC-2.5.3** | NFR Reliability | Playwright reporter | Verify all browsers show passing tests |
| **AC-2.5.4** | NFR Performance | Test execution logs | Measure local execution time |
| **AC-2.5.5** | NFR Reliability | Manual analysis | Run tests 10 times, measure pass rate |
| **AC-2.5.6** | Observability | playwright-report/index.html | Verify HTML report generated |
| **AC-2.5.7** | Observability | tests/README.md | Document edge cases not covered |
| **AC-2.6.1** | Dependencies | .github/workflows/playwright.yml | Verify workflow file exists |
| **AC-2.6.2** | APIs | Workflow triggers | Test PR creation triggers workflow |
| **AC-2.6.3** | Dependencies | Workflow jobs.test.runs-on | Verify ubuntu-latest specified |
| **AC-2.6.4** | Observability | Workflow artifacts | Trigger failure, verify artifacts uploaded |
| **AC-2.6.5** | NFR Reliability | Workflow status | Trigger test failure, verify PR blocked |
| **AC-2.6.6** | Observability | README.md | Verify status badge added |
| **AC-2.6.7** | NFR Performance | GitHub Actions logs | Measure CI execution time |
| **AC-2.6.8** | Observability | tests/README.md | Review CI documentation |

**Coverage Summary:**
- **Services/Modules**: 15 ACs
- **Data Models**: 7 ACs
- **APIs/Interfaces**: 4 ACs
- **Workflows**: 6 ACs
- **Dependencies**: 5 ACs
- **NFR Performance**: 3 ACs
- **NFR Reliability**: 4 ACs
- **Observability**: 9 ACs

## Risks, Assumptions, Open Questions

### Risks

**R1: Test Flakiness from PWA Timing Issues (HIGH)**
- **Risk:** Service worker registration and IndexedDB operations are async, causing timing-dependent test failures
- **Impact:** Tests fail intermittently, reducing confidence in CI and wasting developer time debugging
- **Mitigation:** Use explicit Playwright auto-waiting (expect().toBeVisible()), create robust waitForServiceWorker helper with timeout, clear state before each test
- **Owner:** Story 2.1 (helpers), Story 2.5 (flakiness validation)

**R2: CI Resource Constraints Causing Timeouts (MEDIUM)**
- **Risk:** GitHub Actions free tier has limited CPU/memory, causing tests to timeout (especially browser installs or parallel execution)
- **Impact:** CI fails not due to test failures but resource exhaustion, blocking PRs incorrectly
- **Mitigation:** Configure retries: 2 in CI, reduce workers to 2 (vs 4 locally), cache Playwright browsers between runs
- **Owner:** Story 2.6

**R3: Browser Compatibility Issues (MEDIUM)**
- **Risk:** Tests pass in Chromium but fail in Firefox/WebKit due to IndexedDB or Service Worker API differences
- **Impact:** Application has cross-browser bugs not caught until production
- **Mitigation:** Test all 3 browsers in parallel from Story 2.1 onward, investigate and fix browser-specific issues immediately
- **Owner:** Story 2.1, 2.5

**R4: data-testid Attribute Maintenance Overhead (LOW)**
- **Risk:** Developers forget to add data-testid to new components, causing test failures when trying to select elements
- **Impact:** Tests break when new features added, requiring reactive test updates
- **Mitigation:** Document data-testid convention in tests/README.md, code review checklist includes data-testid verification
- **Owner:** Story 2.3

**R5: Test Scope Creep (MEDIUM)**
- **Risk:** Story 2.2 attempts to test Epics 3-5 features not yet implemented, wasting time on premature testing
- **Impact:** Epic 2 timeline extends, effort diverted from Epic 1 feature coverage
- **Mitigation:** Strict scope: 100% Epic 1 feature coverage only, explicitly defer photo gallery/mood tracking/countdown tests to their respective epics
- **Owner:** Story 2.2, 2.5

**R6: CI Workflow Configuration Errors (LOW)**
- **Risk:** GitHub Actions workflow syntax errors or missing permissions block test execution
- **Impact:** CI doesn't run, false confidence in code quality
- **Mitigation:** Test workflow locally with `act` tool (GitHub Actions simulator), validate workflow on feature branch before merging
- **Owner:** Story 2.6

### Assumptions

**A1: Epic 1 is Complete and Stable**
- **Assumption:** Epic 1 features (persistence, pre-configuration, error boundaries) are fully implemented and passing before Epic 2 starts
- **Validation:** Story 1.6 marked complete in sprint-status.yaml
- **Impact if wrong:** Tests may fail due to incomplete features, not test issues

**A2: Playwright is Sufficient for PWA Testing**
- **Assumption:** Playwright can test all PWA features (service worker, IndexedDB, offline mode) without additional tools
- **Validation:** Playwright documentation confirms PWA support, including service worker control
- **Impact if wrong:** May need additional tools like Puppeteer or Selenium (low probability)

**A3: Single Command Test Execution is Acceptable**
- **Assumption:** Developers will run `npm run test:e2e` before pushing, no pre-commit hooks required
- **Validation:** Manual testing workflow is current practice
- **Impact if wrong:** May need to add git pre-push hooks in future if developers skip testing

**A4: GitHub Actions Free Tier is Sufficient**
- **Assumption:** 2000 minutes/month free tier covers ~200 CI runs (10 min each) for project development pace
- **Validation:** Current PR frequency ~5 per week = 20 per month (200 mins used)
- **Impact if wrong:** May need paid GitHub Actions or self-hosted runners

**A5: HTML Test Reports are Sufficient for Debugging**
- **Assumption:** Developers can debug test failures using HTML reports with screenshots/videos, no live debugging needed
- **Validation:** Playwright reports are comprehensive (DOM snapshots, traces, videos)
- **Impact if wrong:** May need to run tests locally more often (acceptable fallback)

### Open Questions

**Q1: Should We Test Mobile Viewports in Epic 2?** (Priority: MEDIUM)
- **Question:** AC-2.1.4 configures Chromium, Firefox, WebKit (desktop). Should we add mobile device emulation (Pixel 5, iPhone 12)?
- **Impact:** Adds 2 more browser projects, increases test time from 5 min to 7-8 min locally, 10 min to 15 min in CI
- **Recommendation:** Defer mobile viewport testing to Epic 3 when implementing swipe navigation (requires mobile gestures)
- **Decision needed by:** Story 2.1 planning

**Q2: What Level of Test Documentation is Sufficient?** (Priority: LOW)
- **Question:** AC-2.1.7 and AC-2.6.8 require tests/README.md, but scope unclear (guidelines only? API docs? examples?)
- **Impact:** Insufficient docs → future developers struggle to write tests; excessive docs → maintenance burden
- **Recommendation:** Include: setup instructions, PWA helper API docs, data-testid convention, debugging guide, example test
- **Decision needed by:** Story 2.1 completion

**Q3: Should Tests Use Page Object Model Pattern?** (Priority: MEDIUM)
- **Question:** Tests can directly interact with page elements or abstract interactions into Page Objects (e.g., DailyMessagePage.favoriteMessage())
- **Impact:** Page Objects improve maintainability but add abstraction layer, more files to maintain
- **Recommendation:** Use Page Object Model for DailyMessage (most interactions), skip for simple pages (Settings)
- **Decision needed by:** Story 2.2 planning

**Q4: How to Handle Test Data for Message Rotation?** (Priority: HIGH)
- **Question:** Message rotation is date-based. How do tests ensure deterministic message selection for assertions?
- **Impact:** Tests may fail on different dates if relying on "today's message"
- **Recommendation:** Mock date in test fixtures (e.g., set Date.now to fixed timestamp), or seed known messages in IndexedDB before tests
- **Decision needed by:** Story 2.2 implementation

**Q5: Should CI Run on Every Push or Only PRs?** (Priority: LOW)
- **Question:** AC-2.6.2 says "push to main and all pull requests". Should feature branch pushes also trigger CI?
- **Impact:** More CI runs (higher cost), faster feedback on feature branches
- **Recommendation:** Run on: push to main, all PRs, and pushes to PR branches (default GitHub Actions behavior)
- **Decision needed by:** Story 2.6 implementation

## Test Strategy Summary

### Test Approach Philosophy

**E2E Integration Testing Focus:**
- Epic 2 establishes end-to-end testing that exercises the full application stack: UI → React components → Zustand store → IndexedDB/LocalStorage
- No unit testing of individual functions or components (defer to future if needed)
- Tests validate user-facing behavior, not implementation details
- Goal: Catch regressions in critical user paths before deployment

**PWA-Specific Testing:**
- Tests must validate offline-first architecture: service worker registration, cache-first strategies, IndexedDB persistence
- Custom PWA helpers abstract browser API interactions (waitForServiceWorker, goOffline, clearIndexedDB)
- Test scenarios include: fresh install, offline mode, state persistence across browser sessions

### Test Coverage Target

**100% Coverage of Epic 1 Features (37 test cases estimated):**

| Feature | Test Suite | Test Count | Story |
|---------|-----------|------------|-------|
| **Message Display** | message-display.spec.ts | 10 | 2.2 |
| - Daily message rotation (correct message for date) | | 2 | |
| - Message card animations (entrance, hearts burst) | | 2 | |
| - Category badge display | | 1 | |
| - Relationship duration counter accuracy | | 2 | |
| - Message text rendering | | 3 | |
| **Favorites** | favorites.spec.ts | 8 | 2.2 |
| - Toggle favorite on/off | | 2 | |
| - Favorite persists across browser refresh | | 2 | |
| - Favorite persists in offline mode | | 1 | |
| - Heart animation plays on favorite | | 1 | |
| - Favorites list displays correctly | | 2 | |
| **Settings** | settings.spec.ts | 6 | 2.2 |
| - Pre-configured relationship data loaded | | 2 | |
| - Edit partner name, verify persistence | | 2 | |
| - Edit start date, verify duration updates | | 2 | |
| **Navigation** | navigation.spec.ts | 5 | 2.2 |
| - Theme switching (all 4 themes) | | 4 | |
| - Navigation between views (future: Home, Favorites, Settings) | | 1 | |
| **Persistence** | persistence.spec.ts | 8 | 2.2 |
| - LocalStorage hydration on app init | | 2 | |
| - IndexedDB operations in offline mode | | 2 | |
| - State persists across 24-hour gap | | 2 | |
| - Handle LocalStorage quota exceeded | | 1 | |
| - Handle IndexedDB quota exceeded | | 1 | |

**Total:** 37 test cases × 3 browsers (Chromium, Firefox, WebKit) = 111 test executions

### Test Execution Strategy

**Local Development:**
- Command: `npm run test:e2e` (runs all tests, all browsers)
- Command: `npm run test:e2e:ui` (Playwright UI mode for interactive debugging)
- Command: `npm run test:e2e:debug` (headless with inspector)
- Parallel execution: 4 workers (4 tests run simultaneously)
- Target execution time: < 5 minutes

**CI (GitHub Actions):**
- Trigger: Push to main, all pull requests
- Parallel execution: 2 workers (constrained by CI resources)
- Retries: 2 (handle transient CI issues)
- Artifacts: HTML report, screenshots (on failure), videos (on failure), traces (on retry)
- Target execution time: < 10 minutes (including setup)
- PR blocking: Workflow fails if any test fails

### Test Development Workflow

**Adding New Test (Story 2.2):**
1. Identify Epic 1 feature to test (e.g., message favorites)
2. Create test file: `tests/e2e/favorites.spec.ts`
3. Import PWA helpers: `import { waitForServiceWorker, clearIndexedDB } from '../support/helpers/pwaHelpers'`
4. Write test using Page Object Model pattern (if applicable)
5. Use data-testid selectors: `page.getByTestId('message-favorite-button')`
6. Run test locally: `npx playwright test favorites.spec.ts --headed`
7. Debug failures using Playwright Inspector or trace viewer
8. Verify test passes in all 3 browsers
9. Run 10 times to check for flakiness: `for i in {1..10}; do npx playwright test favorites.spec.ts; done`
10. Commit test, push to PR, verify CI passes

**Adding data-testid to Component (Story 2.3):**
1. Open component file (e.g., `src/components/DailyMessage.tsx`)
2. Identify interactive elements (buttons, inputs, navigation)
3. Add attribute: `<button data-testid="message-favorite-button" onClick={toggleFavorite}>`
4. Follow naming convention: `[component]-[element]-[action]`
5. Update corresponding test to use `getByTestId()`
6. Run tests to verify selector works
7. Commit changes

### Test Maintenance Strategy

**Regression Testing:**
- All 37 tests must pass before merging any PR (enforced by CI)
- If Epic 1 feature changes (e.g., message rotation algorithm updated), tests must be updated
- Monthly test review: identify slow tests (> 15s), flaky tests (< 99% pass rate), obsolete tests

**Test Refactoring:**
- Extract reusable test logic into Page Objects or helper functions
- Consolidate similar test cases (e.g., test all 4 themes in single parameterized test)
- Update data-testid selectors if component structure changes

**Test Documentation:**
- tests/README.md updated when new patterns emerge
- Inline comments explain complex test logic or workarounds
- GitHub PR descriptions include test coverage summary

### Definition of Done (Testing Perspective)

**Story 2.1 Complete When:**
- @playwright/test installed, playwright.config.ts configured
- 4 PWA helpers implemented and unit tested
- 3 test scripts added to package.json
- tests/README.md documents setup and patterns

**Story 2.2 Complete When:**
- All 37 test cases written across 5 test suites
- All tests pass in Chromium, Firefox, WebKit
- No flaky tests (10 consecutive runs, 100% pass rate)
- Test coverage checklist shows 100% Epic 1 features

**Story 2.3 Complete When:**
- data-testid added to all interactive elements
- Naming convention followed consistently
- All tests updated to use getByTestId()
- CSS class selectors removed from tests

**Story 2.4 Complete When:**
- playwright.config.ts webServer configured
- Dev server auto-starts before tests
- Single command `npm run test:e2e` runs end-to-end

**Story 2.5 Complete When:**
- All 37 tests pass (100% pass rate)
- Test execution time < 5 min locally
- HTML report generated with screenshots
- No known flaky tests

**Story 2.6 Complete When:**
- .github/workflows/playwright.yml created
- CI runs on push to main and all PRs
- Test artifacts uploaded on failure
- Status badge added to README.md
- CI execution time < 10 minutes
