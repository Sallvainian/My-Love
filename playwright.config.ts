import { defineConfig, devices } from '@playwright/test';
import { config } from '@dotenvx/dotenvx';
import { execSync } from 'child_process';

// Load environment variables from encrypted .env file
config();

// Also load test-specific env vars (unencrypted, gitignored)
config({ path: '.env.test', override: true });

/**
 * Default port for E2E tests.
 * This port is used by BOTH the webServer command and BASE_URL to ensure consistency.
 * Override with PORT or VITE_PORT environment variable if needed.
 */
const DEFAULT_E2E_PORT = '5173';

/**
 * Auto-detect port where My-Love app is running.
 * Checks common ports in order of preference (4000 first for dev, then 5173).
 * Simply checks if port responds - first responding port wins.
 *
 * NOTE: This function runs at module load time. For E2E tests with webServer,
 * the webServer command starts AFTER this runs. To ensure consistency:
 * 1. If PORT/VITE_PORT is set, we use that (explicit config)
 * 2. If reusing existing server, we detect which port it's on
 * 3. Otherwise, we use DEFAULT_E2E_PORT which webServer will also use
 */
export function detectAppPort(): string {
  // If explicitly set, use that (highest priority - explicit always wins)
  if (process.env.PORT || process.env.VITE_PORT) {
    const port = process.env.PORT || process.env.VITE_PORT || DEFAULT_E2E_PORT;
    console.log(`🔧 Using explicit port from env: ${port}`);
    return port;
  }

  // In CI, always use default port (webServer will start fresh)
  // This avoids race conditions where detection runs before server starts
  if (process.env.CI) {
    console.log(`🏗️ CI environment: using default port ${DEFAULT_E2E_PORT}`);
    return DEFAULT_E2E_PORT;
  }

  // Priority order for port detection (only for local dev with reuse):
  // - 4000: Custom dev server port (npm run dev often uses this)
  // - 5173: Vite default dev server port
  // - 3000: Common alternative (Next.js, Create React App default)
  // - 5174/5175: Vite auto-increments when 5173 is busy
  const portsToCheck = ['4000', DEFAULT_E2E_PORT, '3000', '5174', '5175'];

  for (const port of portsToCheck) {
    try {
      // Simple check: does the port respond?
      execSync(
        `node -e "const http = require('http'); const req = http.get('http://localhost:${port}/', {timeout: 2000}, () => process.exit(0)); req.on('error', () => process.exit(1)); req.on('timeout', () => process.exit(1));"`,
        { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log(`🔍 Found existing dev server on port ${port}`);
      return port;
    } catch {
      // Port not responding, continue to next
      continue;
    }
  }

  // No server running - use default. webServer will start on this port too.
  console.log(`📡 No dev server found, webServer will start on ${DEFAULT_E2E_PORT}`);
  return DEFAULT_E2E_PORT;
}

// Skip port detection during unit tests (VITEST env is set)
const PORT = process.env.VITEST ? '5173' : detectAppPort();
const BASE_URL = `http://localhost:${PORT}/`;

/**
 * Playwright configuration for My-Love PWA E2E testing
 *
 * Streamlined for fast CI execution with minimal test suite (10 tests).
 * Port is configurable via PORT or VITE_PORT environment variable.
 *
 * Uses globalSetup for one-time authentication - login happens once,
 * then storageState is reused across all tests for faster execution.
 */

export default defineConfig({
  testDir: './tests/e2e',

  // Global setup: login once before all tests
  globalSetup: './tests/e2e/global-setup.ts',

  // Timeout: longer in CI (slower environment)
  timeout: process.env.CI ? 30000 : 15000,

  // Parallel execution
  fullyParallel: true,

  // No .only in CI
  forbidOnly: !!process.env.CI,

  // Retry once in CI for flaky network issues
  retries: process.env.CI ? 1 : 0,

  // 1 worker to avoid storageState race conditions
  workers: 1,

  // Simple HTML reporter
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report' }], ['github']]
    : [['html', { outputFolder: 'playwright-report' }]],

  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'off',
    // Screenshot on failure for debugging CI issues
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: 'off',
    // Longer timeouts for CI (slower environment)
    navigationTimeout: process.env.CI ? 20000 : 10000,
    actionTimeout: process.env.CI ? 10000 : 5000,
    // Use saved authentication state from global setup
    storageState: 'tests/e2e/.auth/storageState.json',
  },

  // Two projects: authenticated tests first, then auth tests (which clear state)
  // Order matters! Auth tests must run LAST since they test login/logout flows
  // and can pollute session state for other tests
  projects: [
    {
      // All authenticated tests run first with saved auth state
      name: 'logged-in',
      testIgnore: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/storageState.json',
        launchOptions: {
          args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'],
        },
      },
    },
    {
      // Auth tests run last - they start logged out and test login/logout
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] }, // No auth
        launchOptions: {
          args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'],
        },
      },
    },
  ],

  // Dev server (using dotenvx to decrypt env vars)
  // Port configurable via PORT or VITE_PORT env var
  // In CI, env vars are passed directly; locally, decrypt from .env.test
  webServer: {
    command: process.env.CI
      ? `npm run dev -- --port ${PORT}`
      : `dotenvx run -f .env.test -- npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000, // 1 minute should be enough
  },
});
