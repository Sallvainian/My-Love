/**
 * The streak's +1 screen (`daily-streak-up`, StreakUp.tsx) in a spec.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * Daily raises the screen full screen above the dock for whoever sees the held
 * total go up (second picker at once, first picker when Daily is next on
 * screen), and the write sheet waits behind it. A spec whose step follows a
 * day being finished on a page it keeps using dismisses it first.
 */
import type { Page } from '@playwright/test';
import { expect } from '../merged-fixtures';

/**
 * Wait for the +1 screen on `page` and close it with its button. Expects the
 * screen: where the held total does not go up there is nothing to dismiss, and
 * the wait fails rather than passing silently.
 */
export async function dismissStreakUp(page: Page): Promise<void> {
  const overlay = page.getByTestId('daily-streak-up');
  await expect(overlay).toBeVisible();
  await page.getByTestId('daily-streak-up-continue').click();
  await expect(overlay).toHaveCount(0);
}
