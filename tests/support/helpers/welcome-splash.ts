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
 * a test whose page runs on the REAL clock — one that never installs
 * `page.clock` or `context.clock`. A test that installs one uses
 * {@link dismissWelcomeSplashAt}.
 *
 * The stamp is the page's own `Date.now()`, read by the init script at each
 * navigation, and App compares it with the page's `Date.now()` moments later
 * (`shouldShowWelcome` in `src/App.tsx`). On the real clock both reads are one
 * clock in one realm, so the gap is the boot time, never an hour, whatever the
 * time of day.
 *
 * Not safe beside an installed clock. Chromium evaluates new-document scripts
 * in the order they were registered, and Playwright registers its clock as
 * one, so a clock installed after this call is not in place yet when the stamp
 * is read. Measured on 2026-10-03 with Playwright 1.63 in Chromium: with a
 * clock installed 2 h ahead after this call, the stamp was real time and the
 * page's `Date.now()` was 2 h past it, over the one-hour splash interval.
 */
export async function dismissWelcomeSplash(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    // The page's clock, the one App measures the hour against — not the
    // runner's. Only valid while no fake clock is installed (see above).
    localStorage.setItem(key, String(Date.now()));
  }, WELCOME_SPLASH_KEY);
}

/**
 * Mark the splash as seen at `at` (epoch milliseconds), before the app boots,
 * for every navigation in the test. Required wherever the test installs
 * `page.clock` or `context.clock`: pass the instant the clock was installed
 * at, so "an hour ago" is measured against that clock. Also usable to stamp
 * the anchor a real-clock test's fixtures derive from. A fixed stamp does not
 * depend on whether this call comes before or after a clock is installed.
 */
export async function dismissWelcomeSplashAt(page: Page, at: number): Promise<void> {
  await page.addInitScript(
    ({ key, stamp }) => {
      localStorage.setItem(key, String(stamp));
    },
    { key: WELCOME_SPLASH_KEY, stamp: at }
  );
}
