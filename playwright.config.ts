import { defineConfig, devices } from '@playwright/test';
import { config } from '@dotenvx/dotenvx';

// Load environment variables from encrypted .env file
config();

// Also load test-specific env vars (unencrypted, gitignored)
config({ path: '.env.test', override: true });

/**
 * Playwright configuration for My-Love PWA E2E testing
 *
 * Streamlined for fast CI execution with minimal test suite (10 tests).
 */

export default defineConfig({
  testDir: './tests/e2e',

  // Timeout: longer in CI (slower environment)
  timeout: process.env.CI ? 30000 : 15000,

  // Parallel execution
  fullyParallel: true,

  // No .only in CI
  forbidOnly: !!process.env.CI,

  // Retry once in CI for flaky network issues
  retries: process.env.CI ? 1 : 0,

  // 2 workers (enough for 10 tests)
  workers: 2,

  // Simple HTML reporter
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report' }], ['github']]
    : [['html', { outputFolder: 'playwright-report' }]],

  use: {
    baseURL: 'http://localhost:5173/',
    headless: true,
    trace: 'off',
    // Screenshot on failure for debugging CI issues
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: 'off',
    // Longer timeouts for CI (slower environment)
    navigationTimeout: process.env.CI ? 20000 : 10000,
    actionTimeout: process.env.CI ? 10000 : 5000,
  },

  // Chromium only
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
  ],

  // Dev server (using dotenvx to decrypt env vars)
  webServer: {
    command: 'dotenvx run -- npm run dev',
    url: 'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000, // 1 minute should be enough
  },
});
