/**
 * Keep the welcome splash from covering the app.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * App shows the splash when `lastWelcomeView` is missing or at least an hour
 * old (`WELCOME_DISPLAY_INTERVAL` in `src/App.tsx`). The auth provider writes
 * the key into storage state when a worker signs in, but that stamp can be
 * more than an hour old by the time a later test runs, so each test that must
 * not see the splash stamps it again on every navigation, when App reads it.
 */
import type { Page } from '@playwright/test';

/** The localStorage key App reads to decide whether the splash is due. */
export const WELCOME_SPLASH_KEY = 'lastWelcomeView';

/**
 * Keep the splash from showing, for every navigation in the test.
 *
 * The stamp is taken when App reads it, not when the page starts. App reads
 * the key once at boot (`shouldShowWelcome` in `src/App.tsx`) and compares it
 * with `Date.now()`, so the init script replaces `localStorage.getItem` until
 * that first read of the key, answers it with `Date.now()` from the same call,
 * stores that value and puts the real `getItem` back. Elapsed time is then
 * zero on whatever clock the page runs.
 *
 * Why not stamp in the init script itself: Chromium runs new-document scripts
 * in the order they were registered, and `page.clock.install` registers one,
 * so a clock installed after this helper is not in place yet when an init
 * script reads `Date.now()`. Measured on 2026-10-03 with Playwright 1.63: with
 * a clock installed 2 h ahead after the helper, an init-script stamp was real
 * time and App, on the fake clock, read it as 2 h old and showed the splash.
 * At App's read the clock is installed whichever order the test used, so this
 * is the page's clock, not a live-clock fallback.
 *
 * Only that first read is answered: later reads, such as a spec checking that
 * a manual replay left the stored stamp alone, see the stored value. App's own
 * write on dismissing the splash goes through untouched.
 */
export async function dismissWelcomeSplash(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    const realGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (this: Storage, name: string): string | null {
      if (this !== window.localStorage || name !== key) {
        return realGetItem.call(this, name);
      }
      Storage.prototype.getItem = realGetItem;
      // Read now, on the page's clock: fake when the test installed one.
      const stamp = String(Date.now());
      this.setItem(key, stamp);
      return stamp;
    };
  }, WELCOME_SPLASH_KEY);
}
