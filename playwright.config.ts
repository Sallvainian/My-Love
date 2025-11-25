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
  // CI: 4 workers provides good balance of speed and stability
  workers: process.env.CI ? 4 : 12,

  // Reporter configuration (CI uses blob for sharding, local uses html)
  reporter: process.env.CI
    ? [['blob'], ['github']]
    : [['html', { outputFolder: 'playwright-report' }]],

  // Global test settings
  use: {
    // Base URL (Vite dev server without base path - production uses /My-Love/)
    baseURL: 'http://localhost:5173/',

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

    // Firefox - disabled temporarily to reduce CI time
    // Enable with FULL_BROWSER_TESTING=true for comprehensive testing
    ...(process.env.FULL_BROWSER_TESTING
      ? [
          {
            name: 'firefox',
            use: {
              ...devices['Desktop Firefox'],
            },
            timeout: 60000,
          },
        ]
      : []),

    // WebKit - disabled temporarily to reduce CI time
    // Enable with FULL_BROWSER_TESTING=true for comprehensive testing
    ...(process.env.FULL_BROWSER_TESTING
      ? [
          {
            name: 'webkit',
            use: {
              ...devices['Desktop Safari'],
            },
            timeout: 60000,
          },
        ]
      : []),
  ],

  // Development server configuration (auto-start enabled)
  // Playwright will automatically start the dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // 3 minutes for slow starts
    retries: 3, // Retry server startup if it fails
  },
});
