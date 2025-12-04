import { defineConfig, devices } from '@playwright/test';
import { config } from '@dotenvx/dotenvx';

// Load environment variables from encrypted .env file
config();

// Also load test-specific env vars (unencrypted, gitignored)
config({ path: '.env.test', override: true });

// Port configuration - use PORT env var or default to 5173
const PORT = process.env.PORT || process.env.VITE_PORT || '5173';
const BASE_URL = `http://localhost:${PORT}/`;

/**
 * Playwright configuration for My-Love PWA E2E testing
 *
 * Streamlined for fast CI execution with minimal test suite (10 tests).
 * Port is configurable via PORT or VITE_PORT environment variable.
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
    baseURL: BASE_URL,
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
  // Port configurable via PORT or VITE_PORT env var
  webServer: {
    command: `dotenvx run -- npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000, // 1 minute should be enough
  },
});
