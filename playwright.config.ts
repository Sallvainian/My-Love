import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for My-Love PWA E2E testing
 *
 * This configuration supports multi-browser testing (Chromium, Firefox, WebKit)
 * with PWA-specific settings for service workers, IndexedDB, and offline testing.
 *
 * Environment-aware configuration:
 * - Local: 12 workers, 0 retries (fast feedback)
 * - CI: 2 workers, 2 retries (handle transient failures)
 */

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Global test timeout (60 seconds - allows for slow PWA operations)
  timeout: 60000,

  // Fail the build on CI if tests fail
  fullyParallel: true,

  // Forbid test.only in CI
  forbidOnly: !!process.env.CI,

  // Retry configuration (environment-aware for CI reliability)
  // CI: 2 retries for transient failures, Local: 0 for fast feedback
  retries: process.env.CI ? 2 : 0,

  // Worker configuration (environment-aware)
  workers: process.env.CI ? 2 : 12, // Maximum parallelization

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['github'] // GitHub Actions annotations
  ],

  // Global test settings
  use: {
    // Base URL (matches Vite dev server with base path)
    baseURL: 'http://localhost:5173/My-Love/',

    // Run in headless mode for massive speed improvement (30-50% faster)
    headless: true,

    // Trace collection (disabled for speed)
    trace: 'off',

    // Screenshot capture (disabled for speed)
    screenshot: 'off',

    // Video recording (disabled for speed)
    video: 'off',

    // Aggressive timeouts for speed
    navigationTimeout: 30000,

    // Wait for network idle before considering navigation complete
    waitForSelectorTimeout: 10000,
  },

  // Multi-browser project configuration
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chromium-specific optimizations for PWA testing
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox', // Speed boost
            '--disable-setuid-sandbox', // Speed boost
            '--disable-web-security', // Speed boost (test only!)
          ],
        },
      },
      timeout: 30000, // Aggressive timeout
    },

    // Firefox enabled for CI multi-browser testing (Story 2.6 requirement)
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
      timeout: 60000,
    },

    // WebKit temporarily disabled due to missing system dependencies
    // Uncomment when libicudata.so.66, libicui18n.so.66, libicuuc.so.66,
    // libwebp.so.6, and libffi.so.7 are installed on the system
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },
  ],

  // Development server configuration (auto-start enabled)
  // Playwright will automatically start the dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/My-Love/',
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // 3 minutes for slow starts
    retries: 3, // Retry server startup if it fails
  },
});
