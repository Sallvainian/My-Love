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

  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,

  /* Single worker to avoid storageState race conditions */
  workers: 1,

  /* Reporter configuration */
  reporter: process.env.CI ? 'github' : 'html',

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

    // Main test project - depends on setup
    {
      name: 'chromium',
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
  },
});
