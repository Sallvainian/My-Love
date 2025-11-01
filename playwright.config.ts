import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for My-Love PWA E2E testing
 *
 * This configuration supports multi-browser testing (Chromium, Firefox, WebKit)
 * with PWA-specific settings for service workers, IndexedDB, and offline testing.
 *
 * Environment-aware configuration:
 * - Local: 4 workers, 0 retries (fast feedback)
 * - CI: 2 workers, 2 retries (handle transient failures)
 */

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Global test timeout (60 seconds - PWA operations can be slow)
  timeout: 60000,

  // Fail the build on CI if tests fail
  fullyParallel: true,

  // Forbid test.only in CI
  forbidOnly: !!process.env.CI,

  // Retry configuration (2 retries for robustness against timing issues)
  retries: 2,

  // Worker configuration (environment-aware)
  workers: process.env.CI ? 2 : 4,

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

    // Trace collection (debugging on retry)
    trace: 'on-first-retry',

    // Screenshot capture (only on failure)
    screenshot: 'only-on-failure',

    // Video recording (retain on failure)
    video: 'retain-on-failure',

    // Increased navigation timeout for slower machines/networks
    navigationTimeout: 60000,

    // Wait for network idle before considering navigation complete
    waitForSelectorTimeout: 15000,
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
            '--disable-blink-features=AutomationControlled', // Reduce automation detection overhead
            '--disable-dev-shm-usage', // Reduce memory overhead
            '--disable-gpu', // Disable GPU hardware acceleration (not needed for tests)
          ],
        },
      },
      // Chromium's multi-process architecture makes IndexedDB operations 2-3x slower
      // Increase timeout to accommodate this without failing tests unnecessarily
      timeout: 45000, // 45 seconds (vs global 30s)
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
      // Firefox IndexedDB operations can also be slow, especially with service workers
      timeout: 60000, // 60 seconds
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
