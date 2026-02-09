import { execSync } from 'child_process';
import { defineConfig, devices } from '@playwright/test';
import { currentsReporter } from '@currents/playwright';

/**
 * Load Supabase local env vars for test fixtures.
 * Parses `supabase status -o env` to set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * and SUPABASE_ANON_KEY. Falls back gracefully if Supabase CLI is unavailable (CI).
 */
if (!process.env.SUPABASE_URL) {
  try {
    const output = execSync('supabase status -o env 2>/dev/null', { encoding: 'utf-8' });
    const vars: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const match = line.match(/^(\w+)="(.+)"$/);
      if (match) vars[match[1]] = match[2];
    }
    process.env.SUPABASE_URL ??= vars.API_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= vars.SERVICE_ROLE_KEY;
    process.env.SUPABASE_ANON_KEY ??= vars.ANON_KEY;

    // Force-set VITE_ variants so the Vite dev server connects to local Supabase.
    // Must use `=` (not `??=`) because direnv's `dotenv` injects encrypted values
    // from .env into process.env, and Vite's loadEnv gives process.env highest priority.
    process.env.VITE_SUPABASE_URL = vars.API_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = vars.ANON_KEY;
  } catch {
    // Supabase CLI unavailable — env vars must be set externally (CI)
  }
}

/**
 * Playwright Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 *
 * Uses @seontechnologies/playwright-utils for enhanced fixtures.
 * See tests/support/merged-fixtures.ts for fixture composition.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Timeouts
  timeout: 60 * 1000, // Test timeout: 60s
  expect: {
    timeout: 15 * 1000, // Assertion timeout: 15s
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 15 * 1000, // Action timeout: 15s
    navigationTimeout: 30 * 1000, // Navigation timeout: 30s
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    currentsReporter(),
  ],

  outputDir: 'test-results',

  projects: [
    // Auth setup — runs once, saves storageState for E2E tests
    {
      name: 'setup',
      testMatch: /auth-setup\.ts/,
      testDir: './tests/support',
    },
    {
      name: 'chromium',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'api',
      testDir: './tests/api',
      dependencies: ['setup'],
    },
    // Uncomment for cross-browser testing
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Run local dev server before tests.
  // --mode test makes Vite load .env.test (plain-text local Supabase values)
  // which overrides the encrypted production credentials in .env.local.
  // In CI, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY directly.
  webServer: {
    command: 'npx vite --mode test',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
