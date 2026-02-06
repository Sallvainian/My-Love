# Integrate Playwright Utils with TEA

## Overview

This guide covers integrating `@seontechnologies/playwright-utils` with TEA to access production-ready fixtures, utilities, and patterns.

## What is Playwright Utils?

A production-ready utility library providing:

- Typed API request helper
- Authentication session management
- Network recording and replay (HAR)
- Network request interception
- Async polling (recurse)
- Structured logging
- File validation (CSV, PDF, XLSX, ZIP)
- Burn-in testing utilities
- Network error monitoring

**Repository:** https://github.com/seontechnologies/playwright-utils

**npm Package:** `@seontechnologies/playwright-utils`

## When to Use This

**Use when:**
- You want production-ready fixtures rather than DIY solutions
- Your team benefits from standardized patterns
- You need utilities like API testing, auth handling, network mocking
- You want TEA to generate tests using these utilities
- You're building reusable test infrastructure

**Don't use if:**
- You're learning testing (keep it simple first)
- You have your own fixture library
- You don't need the utilities

## Prerequisites

- BMad Method installed
- TEA agent available
- Test framework setup complete (Playwright)
- Node.js v18 or later

**Note:** Playwright Utils is for Playwright only (not Cypress).

## Installation

### Step 1: Install Package

```bash
npm install -D @seontechnologies/playwright-utils
```

### Step 2: Enable in TEA Config

Edit `_bmad/tea/config.yaml`:

```yaml
tea_use_playwright_utils: true
```

**Note:** If enabled during BMad installation, it's already set.

### Step 3: Verify Installation

```bash
# Check package installed
npm list @seontechnologies/playwright-utils

# Check TEA config
grep tea_use_playwright_utils _bmad/tea/config.yaml
```

Should display:
```
@seontechnologies/playwright-utils@2.x.x
tea_use_playwright_utils: true
```

## What Changes When Enabled

### `framework` Workflow

**Vanilla Playwright:**
```javascript
import { test, expect } from '@playwright/test';

test('api test', async ({ request }) => {
  const response = await request.get('/api/users');
  const users = await response.json();
  expect(response.status()).toBe(200);
});
```

**With Playwright Utils (Combined Fixtures):**
```javascript
import { test } from '@seontechnologies/playwright-utils/fixtures';
import { expect } from '@playwright/test';

test('api test', async ({ apiRequest, authToken, log }) => {
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/users',
    headers: { Authorization: `Bearer ${authToken}` },
  });

  log.info('Fetched users', body);
  expect(status).toBe(200);
});
```

**With Playwright Utils (Selective Merge):**
```javascript
import { mergeTests } from '@playwright/test';
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as logFixture } from '@seontechnologies/playwright-utils/log/fixtures';

export const test = mergeTests(apiRequestFixture, logFixture);
export { expect } from '@playwright/test';

test('api test', async ({ apiRequest, log }) => {
  log.info('Fetching users');
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/users',
  });
  expect(status).toBe(200);
});
```

### `atdd` and `automate` Workflows

**Without Playwright Utils:**
```javascript
test('should fetch profile', async ({ page, request }) => {
  const response = await request.get('/api/profile');
  const profile = await response.json();
  // Manual parsing and validation
});
```

**With Playwright Utils:**
```javascript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';

test('should fetch profile', async ({ apiRequest }) => {
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/profile',
  }).validateSchema(ProfileSchema);

  expect(status).toBe(200);
  // body is type-safe
});
```

### `test-review` Workflow

**Without Playwright Utils:** Reviews against generic Playwright patterns

**With Playwright Utils:** Reviews against playwright-utils best practices including:
- Fixture composition patterns
- Utility usage (apiRequest, authSession, etc.)
- Network-first patterns
- Structured logging

### `ci` Workflow

**Without Playwright Utils:**
- Parallel sharding
- Burn-in loops (basic shell scripts)
- CI triggers (PR, push, schedule)
- Artifact collection

**With Playwright Utils:** Enhanced with smart testing:
- Burn-in utility (git diff-based, volume control)
- Selective testing (skip config/docs/types changes)
- Test prioritization by file changes

## Available Utilities

### api-request

Typed HTTP client with schema validation.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/api-request.html

**Why Use This?**

| Feature | Vanilla Playwright | api-request Utility |
|---------|-------------------|-------------------|
| JSON parsing | Manual `await response.json()` | Automatic JSON parsing |
| Status & body | `response.status()` + separate parsing | Returns `{ status, body }` structure |
| Retry logic | No built-in retry | Automatic retry for 5xx errors |
| Schema validation | No built-in validation | Single-line `.validateSchema()` |
| Syntax | Verbose status checking | Clean destructuring |

**Usage:**
```javascript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

test('should create user', async ({ apiRequest }) => {
  const { status, body } = await apiRequest({
    method: 'POST',
    path: '/api/users',
    body: { name: 'Test User', email: 'test@example.com' },
  }).validateSchema(UserSchema);

  expect(status).toBe(201);
  expect(body.id).toBeDefined();
  expect(body.email).toBe('test@example.com');
});
```

**Benefits:**
- Returns `{ status, body }` structure
- Schema validation with `.validateSchema()` chained method
- Automatic retry for 5xx errors
- Type-safe response body

### auth-session

Authentication session management with token persistence.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/auth-session.html

**Why Use This?**

| Feature | Vanilla Playwright Auth | auth-session |
|---------|------------------------|-------------|
| Performance | Re-authenticate every test run (slow) | Authenticate once, persist to disk |
| Multi-user | Single user per setup | Multi-user support (roles, accounts) |
| Token expiry | No token expiration handling | Automatic token renewal |
| Management | Manual session management | Provider pattern (flexible auth) |

**Usage:**
```javascript
import { test } from '@seontechnologies/playwright-utils/auth-session/fixtures';
import { expect } from '@playwright/test';

test('should access protected route', async ({ page, authToken }) => {
  // authToken automatically fetched and persisted
  // No manual login needed - handled by fixture

  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');
  // Token is reused across tests (persisted to disk)
});
```

**Configuration required** (see auth-session docs for provider setup):

global-setup.ts
```javascript
import { authStorageInit, setAuthProvider, authGlobalInit } from '@seontechnologies/playwright-utils/auth-session';

async function globalSetup() {
  authStorageInit();
  setAuthProvider(myCustomProvider); // Define your auth mechanism
  await authGlobalInit(); // Fetch token once
}
```

**Benefits:**
- Token fetched once, reused across all tests
- Persisted to disk (faster subsequent runs)
- Multi-user support via `authOptions.userIdentifier`
- Automatic token renewal if expired

### network-recorder

Record and replay network traffic (HAR) for offline testing.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/network-recorder.html

**Why Use This?**

| Feature | Vanilla Playwright HAR | network-recorder |
|---------|----------------------|------------------|
| Setup | Manual `routeFromHAR()` configuration | Automatic HAR management with `PW_NET_MODE` |
| Test files | Separate record/playback test files | Same test, switch env var |
| Mocking | No CRUD detection | Stateful mocking (POST/PUT/DELETE work) |
| File paths | Manual HAR file paths | Auto-organized by test name |

**Usage:**
```javascript
import { test } from '@seontechnologies/playwright-utils/network-recorder/fixtures';

// Record mode: Set environment variable
process.env.PW_NET_MODE = 'record';

test('should work with recorded traffic', async ({ page, context, networkRecorder }) => {
  // Setup recorder (records or replays based on PW_NET_MODE)
  await networkRecorder.setup(context);

  // Your normal test code
  await page.goto('/dashboard');
  await page.click('#add-item');

  // First run (record): Saves traffic to HAR file
  // Subsequent runs (playback): Uses HAR file, no backend needed
});
```

**Switch modes:**
```bash
# Record traffic
PW_NET_MODE=record npx playwright test

# Playback traffic (offline)
PW_NET_MODE=playback npx playwright test
```

**Benefits:**
- Offline testing (no backend needed)
- Deterministic responses (same every time)
- Faster execution (no network latency)
- Stateful mocking (CRUD operations work)

### intercept-network-call

Spy or stub network requests with automatic JSON parsing.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/intercept-network-call.html

**Why Use This?**

| Feature | Vanilla Playwright | interceptNetworkCall |
|---------|-------------------|---------------------|
| Setup | Route setup + response waiting (separate steps) | Single declarative call |
| Parsing | Manual `await response.json()` | Automatic JSON parsing (`responseJson`) |
| Filtering | Complex filter predicates | Simple glob patterns (`**/api/**`) |
| Syntax | Verbose syntax | Concise, readable API |

**Usage:**
```javascript
import { test } from '@seontechnologies/playwright-utils/fixtures';

test('should handle API errors', async ({ page, interceptNetworkCall }) => {
  // Stub API to return error (set up BEFORE navigation)
  const profileCall = interceptNetworkCall({
    method: 'GET',
    url: '**/api/profile',
    fulfillResponse: {
      status: 500,
      body: { error: 'Server error' },
    },
  });

  await page.goto('/profile');

  // Wait for the intercepted response
  const { status, responseJson } = await profileCall;

  expect(status).toBe(500);
  expect(responseJson.error).toBe('Server error');
  await expect(page.getByText('Server error occurred')).toBeVisible();
});
```

**Benefits:**
- Automatic JSON parsing (`responseJson` ready to use)
- Spy mode (observe real traffic) or stub mode (mock responses)
- Glob pattern URL matching
- Returns promise with `{ status, responseJson, requestJson }`

### recurse

Async polling for eventual consistency (Cypress-style).

**Official Docs:** https://seontechnologies.github.io/playwright-utils/recurse.html

**Why Use This?**

| Feature | Manual Polling | recurse Utility |
|---------|--------------|-----------------|
| Implementation | `while` loops with `waitForTimeout` | Smart polling with exponential backoff |
| Configuration | Hard-coded retry logic | Configurable timeout/interval |
| Logging | No logging visibility | Optional logging with custom messages |
| Readability | Verbose, error-prone | Clean, readable API |

**Usage:**
```javascript
import { test } from '@seontechnologies/playwright-utils/fixtures';

test('should wait for async job completion', async ({ apiRequest, recurse }) => {
  // Start async job
  const { body: job } = await apiRequest({
    method: 'POST',
    path: '/api/jobs'
  });

  // Poll until complete (smart waiting)
  const completed = await recurse(
    () => apiRequest({ method: 'GET', path: `/api/jobs/${job.id}` }),
    (result) => result.body.status === 'completed',
    {
      timeout: 30000,
      interval: 2000,
      log: 'Waiting for job to complete'
    }
  );

  expect(completed.body.status).toBe('completed');
});
```

**Benefits:**
- Smart polling with configurable interval
- Handles async jobs, background tasks
- Optional logging for debugging
- Better than hard waits or manual polling loops

### log

Structured logging that integrates with Playwright reports.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/log.html

**Why Use This?**

| Feature | Console.log / print | log Utility |
|---------|-------------------|------------|
| Reports | Not in test reports | Integrated with Playwright reports |
| Visualization | No step visualization | `.step()` shows in Playwright UI |
| Formatting | Manual object formatting | Logs objects seamlessly |
| Output | No structured output | JSON artifacts for debugging |

**Usage:**
```javascript
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '@playwright/test';

test('should login', async ({ page }) => {
  await log.info('Starting login test');

  await page.goto('/login');
  await log.step('Navigated to login page'); // Shows in Playwright UI

  await page.getByLabel('Email').fill('test@example.com');
  await log.debug('Filled email field');

  await log.success('Login completed');
  // Logs appear in test output and Playwright reports
});
```

**Benefits:**
- Direct import (no fixture needed for basic usage)
- Structured logs in test reports
- `.step()` shows in Playwright UI
- Logs objects seamlessly (no special handling needed)
- Trace test execution

### file-utils

Read and validate CSV, PDF, XLSX, ZIP files.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/file-utils.html

**Why Use This?**

| Feature | Vanilla Playwright | file-utils |
|---------|-------------------|-----------|
| Code lines | ~80 lines per CSV flow | ~10 lines end-to-end |
| Download handling | Manual download event handling | `handleDownload()` encapsulates all |
| Parsing | External parsing libraries | Auto-parsing (CSV, XLSX, PDF, ZIP) |
| Validation | No validation helpers | Built-in validation (headers, row count) |

**Usage:**
```javascript
import { handleDownload, readCSV } from '@seontechnologies/playwright-utils/file-utils';
import { expect } from '@playwright/test';
import path from 'node:path';

const DOWNLOAD_DIR = path.join(__dirname, '../downloads');

test('should export valid CSV', async ({ page }) => {
  // Handle download and get file path
  const downloadPath = await handleDownload({
    page,
    downloadDir: DOWNLOAD_DIR,
    trigger: () => page.click('button:has-text("Export")'),
  });

  // Read and parse CSV
  const csvResult = await readCSV({ filePath: downloadPath });
  const { data, headers } = csvResult.content;

  // Validate structure
  expect(headers).toEqual(['Name', 'Email', 'Status']);
  expect(data.length).toBeGreaterThan(0);
  expect(data[0]).toMatchObject({
    Name: expect.any(String),
    Email: expect.any(String),
    Status: expect.any(String),
  });
});
```

**Benefits:**
- Handles downloads automatically
- Auto-parses CSV, XLSX, PDF, ZIP
- Type-safe access to parsed data
- Returns structured `{ headers, data }`

### burn-in

Smart test selection with git diff analysis for CI optimization.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/burn-in.html

**Why Use This?**

| Feature | Playwright `--only-changed` | burn-in Utility |
|---------|---------------------------|-----------------|
| Config changes | Config changes trigger all tests | Smart filtering (skip configs, types, docs) |
| Flexibility | All or nothing | Volume control (run percentage) |
| Customization | No customization | Custom dependency analysis |
| Performance | Slow CI on minor changes | Fast CI with intelligent selection |

**Usage:**

scripts/burn-in-changed.ts
```javascript
import { runBurnIn } from '@seontechnologies/playwright-utils/burn-in';

async function main() {
  await runBurnIn({
    configPath: 'playwright.burn-in.config.ts',
    baseBranch: 'main',
  });
}

main().catch(console.error);
```

**Config:**

playwright.burn-in.config.ts
```javascript
import type { BurnInConfig } from '@seontechnologies/playwright-utils/burn-in';

const config: BurnInConfig = {
  skipBurnInPatterns: ['**/config/**', '**/*.md', '**/*types*'],
  burnInTestPercentage: 0.3,
  burnIn: {
    repeatEach: 3,
    retries: 1,
  },
};

export default config;
```

**Package script:**
```json
{
  "scripts": {
    "test:burn-in": "tsx scripts/burn-in-changed.ts"
  }
}
```

**Benefits:**
- Ensure flake-free tests upfront
- Smart filtering (skip config, types, docs changes)
- Volume control (run percentage of affected tests)
- Git diff-based test selection
- Faster CI feedback

### network-error-monitor

Automatically detect HTTP 4xx/5xx errors during tests.

**Official Docs:** https://seontechnologies.github.io/playwright-utils/network-error-monitor.html

**Why Use This?**

| Feature | Vanilla Playwright | network-error-monitor |
|---------|-------------------|----------------------|
| Error detection | UI passes, backend 500 ignored | Auto-fails on any 4xx/5xx |
| Setup | Manual error checking | Zero boilerplate (auto-enabled) |
| Silent failures | Silent failures slip through | Acts like Sentry for tests |
| Cascading failures | No domino effect prevention | Limits cascading failures |

**Usage:**
```javascript
import { test } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';

// That's it! Network monitoring is automatically enabled
test('should not have API errors', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('button');

  // Test fails automatically if any HTTP 4xx/5xx errors occur
  // Error message shows: "Network errors detected: 2 request(s) failed"
  //   GET 500 https://api.example.com/users
  //   POST 503 https://api.example.com/metrics
});
```

**Opt-out for validation tests:**
```javascript
// When testing error scenarios, opt-out with annotation
test(
  'should show error message on 404',
  { annotation: [{ type: 'skipNetworkMonitoring' }] }, // Array format
  async ({ page }) => {
    await page.goto('/invalid-page'); // Will 404
    await expect(page.getByText('Page not found')).toBeVisible();
    // Test won't fail on 404 because of annotation
  },
);

// Or opt-out entire describe block
test.describe('error handling', { annotation: [{ type: 'skipNetworkMonitoring' }] }, () => {
  test('handles 404', async ({ page }) => {
    // Monitoring disabled for all tests in block
  });
});
```

**Benefits:**
- Auto-enabled (zero setup)
- Catches silent backend failures (500, 503, 504)
- Prevents domino effect (limits cascading failures from one bad endpoint)
- Opt-out with annotations for validation tests
- Structured error reporting (JSON artifacts)

## Fixture Composition

### Option 1: Use Package's Combined Fixtures (Simplest)

```javascript
// Import all utilities at once
import { test } from '@seontechnologies/playwright-utils/fixtures';
import { log } from '@seontechnologies/playwright-utils';
import { expect } from '@playwright/test';

test('api test', async ({ apiRequest, interceptNetworkCall }) => {
  await log.info('Fetching users');

  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/users',
  });

  expect(status).toBe(200);
});
```

### Option 2: Create Custom Merged Fixtures (Selective)

**File 1: support/merged-fixtures.ts**
```javascript
import { test as base, mergeTests } from '@playwright/test';
import { test as apiRequest } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as interceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures';
import { test as networkErrorMonitor } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';
import { log } from '@seontechnologies/playwright-utils';

// Merge only what you need
export const test = mergeTests(base, apiRequest, interceptNetworkCall, networkErrorMonitor);

export const expect = base.expect;
export { log };
```

**File 2: tests/api/users.spec.ts**
```javascript
import { test, expect, log } from '../support/merged-fixtures';

test('api test', async ({ apiRequest, interceptNetworkCall }) => {
  await log.info('Fetching users');

  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/users',
  });

  expect(status).toBe(200);
});
```

**Contrast:**
- Option 1: All utilities available, zero setup
- Option 2: Pick utilities you need, one central file

**See working examples:** https://github.com/seontechnologies/playwright-utils/tree/main/playwright/support

## Troubleshooting

### Import Errors

**Problem:** Cannot find module '@seontechnologies/playwright-utils/api-request'

**Solution:**
```bash
# Verify package installed
npm list @seontechnologies/playwright-utils

# Check package.json has correct version
"@seontechnologies/playwright-utils": "^2.0.0"

# Reinstall if needed
npm install -D @seontechnologies/playwright-utils
```

### TEA Not Using Utilities

**Problem:** TEA generates tests without playwright-utils.

**Causes:**
1. Config not set: `tea_use_playwright_utils: false`
2. Workflow run before config change
3. Package not installed

**Solution:**
```bash
# Check config
grep tea_use_playwright_utils _bmad/tea/config.yaml
# Should show: tea_use_playwright_utils: true

# Start fresh chat (TEA loads config at start)
```

### Type Errors with apiRequest

**Problem:** TypeScript errors on apiRequest response.

**Cause:** No schema validation.

**Solution:**
```javascript
// Add Zod schema for type safety
import { z } from 'zod';

const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const { status, body } = await apiRequest({
  method: 'GET',
  path: '/api/profile',
}).validateSchema(ProfileSchema); // Chained method

expect(status).toBe(200);
// body is typed as { id: string, name: string, email: string }
```

## Related Guides

**Getting Started:**
- TEA Lite Quickstart Tutorial - Learn TEA basics
- How to Set Up Test Framework - Initial framework setup

**Workflow Guides:**
- How to Run ATDD - Generate tests with utilities
- How to Run Automate - Expand coverage with utilities
- How to Run Test Review - Review against PW-Utils patterns

**Other Customization:**
- Enable MCP Enhancements - Live browser verification

## Understanding the Concepts

- Testing as Engineering - Why Playwright Utils matters (part of TEA's three-part solution)
- Fixture Architecture - Pure function -> fixture pattern
- Network-First Patterns - Network utilities explained
- Test Quality Standards - Patterns PW-Utils enforces

## Reference

- TEA Configuration - tea_use_playwright_utils option
- Knowledge Base Index - Playwright Utils fragments
- Glossary - Playwright Utils term
- Official PW-Utils Docs: https://seontechnologies.github.io/playwright-utils/ - Complete API reference
