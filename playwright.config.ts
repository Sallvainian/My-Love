import { defineConfig, devices } from '@playwright/test';
import { config } from '@dotenvx/dotenvx';

// Load environment variables
config();
config({ path: '.env.test', override: true });

const PORT = process.env.PORT || process.env.VITE_PORT || '5173';
const BASE_URL = `http://localhost:${PORT}/`;

const STORAGE_STATE_PATH = './e2e/.auth/storageState.json';

/**
 * Playwright configuration for My-Love PWA E2E testing
 *
 * Uses project dependencies for setup (recommended approach).
 * @see https://playwright.dev/docs/test-global-setup-teardown#option-1-project-dependencies
 */
export default defineConfig({
  testDir: './e2e',

  /* Timeout configuration */
  timeout: process.env.CI ? 30000 : 15000,

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Prevent runaway CI jobs (1 hour max) */
  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,

  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,

  /* 1 worker in CI for stability, parallel locally for speed */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter configuration - keep HTML reports in CI for debugging */
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report' }], ['github']]
    : 'html',

  /* Shared settings for all projects */
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Configure projects with dependencies */
  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Auth tests - run with empty storage (tests login/logout flows)
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },

    // Main test project - depends on setup, excludes auth tests
    {
      name: 'chromium',
      testIgnore: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATH,
      },
      dependencies: ['setup'],
    },
  ],

  /* Run local dev server before starting tests */
  webServer: {
    command: 'npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
