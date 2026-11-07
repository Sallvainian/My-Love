import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
// Importing the main config runs its top-level block, which points
// VITE_SUPABASE_* at the local stack and defines the dev server; this config
// reuses that server for a local run and nothing else from it. Its globalSetup
// provisions the worker pool with the Supabase secret key, which the deploy
// job's live check must never hold, so this is a separate config, not a project.
import baseConfig from './playwright.config';

/**
 * Playwright configuration for the post-deploy check of the live site
 * (`tests/live/`, run by the `live-daily-check` job in `deploy.yml`).
 *
 * With `LIVE_BASE_URL` set it drives that site and starts no server. Without
 * it, it drives the local dev server (baseConfig.webServer) against the local
 * Supabase stack.
 */
const liveBaseUrl = process.env.LIVE_BASE_URL;

/** The base config's single dev server (it defines one, never a list). */
type WebServer = Exclude<PlaywrightTestConfig['webServer'], unknown[] | undefined>;

export default defineConfig({
  testDir: './tests/live',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 180 * 1000,
  expect: { timeout: 15 * 1000 },

  use: {
    ...devices['Desktop Chrome'],
    baseURL: liveBaseUrl || 'http://localhost:5173',
    timezoneId: 'UTC',
    // Off: this run types the bot passwords and a trace records them, with the
    // token requests. The deploy job uploads screenshots and videos only. The
    // spec opens its own two contexts, which this video setting never reaches,
    // so the spec records their video itself.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },

  reporter: [['list'], ['html', { outputFolder: 'playwright-report-live', open: 'never' }]],

  outputDir: 'test-results',

  // Local mode: the base config's dev server, but never an already-running one.
  // The base config reuses one outside CI, and that server may point at another
  // project (production, say) while the spec's localhost guard checks only the
  // VITE_SUPABASE_URL of this process; a fresh server always gets that env.
  ...(liveBaseUrl
    ? {}
    : { webServer: { ...(baseConfig.webServer as WebServer), reuseExistingServer: false } }),
});
