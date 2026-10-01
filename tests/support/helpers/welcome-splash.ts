/**
 * Keep the welcome splash from covering the app.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * App shows the splash when `lastWelcomeView` is missing or at least an hour
 * old (`WELCOME_DISPLAY_INTERVAL` in `src/App.tsx`). The auth provider writes
 * the key into storage state when a worker signs in, but that stamp can be
 * more than an hour old by the time a later test runs, so each test that must
 * not see the splash stamps it again, before every navigation.
 */
import type { Page } from '@playwright/test';

/** The localStorage key App reads to decide whether the splash is due. */
export const WELCOME_SPLASH_KEY = 'lastWelcomeView';

/**
 * Mark the splash as just seen, before the app boots, for every navigation in
 * the test. `at` is the stamp in epoch milliseconds; pass the installed
 * `page.clock` time when the page runs on a pinned clock, so "an hour ago"
 * is measured against the same clock. Left out, the stamp is taken in the
 * page at each navigation.
 */
export async function dismissWelcomeSplash(page: Page, at?: number): Promise<void> {
  await page.addInitScript(
    ({ key, stamp }) => {
      localStorage.setItem(key, String(stamp ?? Date.now()));
    },
    { key: WELCOME_SPLASH_KEY, stamp: at ?? null }
  );
}
