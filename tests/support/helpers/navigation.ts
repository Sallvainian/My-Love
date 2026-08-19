/**
 * Navigation Tray Helpers
 *
 * Every destination now lives inside a tray that has to be opened first, so the
 * hand-written `getByTestId('nav-x').click()` idiom the retired bottom bar
 * allowed no longer works anywhere. All 15 call sites were being touched by the
 * navigation change regardless; routing them through here means the next
 * navigation change costs one file rather than fifteen.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** The seven tray destinations, matching ViewType in navigationSlice.ts. */
export type NavDestination =
  | 'home'
  | 'mood'
  | 'notes'
  | 'partner'
  | 'photos'
  | 'scripture'
  | 'settings';

/**
 * Open the navigation tray, or leave it open if it already is.
 *
 * The hamburger doubles as the app-loaded readiness proxy the retired bar's
 * container testid used to serve: it is the one navigation element that is
 * permanently on screen now that the destinations live behind a disclosure.
 */
export async function openNavTray(page: Page): Promise<void> {
  const toggle = page.getByTestId('nav-menu-toggle');
  await expect(toggle).toBeVisible();

  if ((await toggle.getAttribute('aria-expanded')) === 'true') {
    await expect(page.getByTestId('nav-tray')).toBeVisible();
    return;
  }

  await toggle.click();
  await expect(page.getByTestId('nav-tray')).toBeVisible();
}

/**
 * Navigate to a destination through the tray and wait for it to close again.
 *
 * Waiting on the backdrop too, not just the panel: it covers the whole viewport
 * while the exit animation runs, so a test that clicks straight afterwards would
 * otherwise be racing a scrim over its target.
 */
export async function navigateTo(page: Page, view: NavDestination): Promise<void> {
  await openNavTray(page);
  await page.getByTestId(`nav-${view}`).click();
  await expect(page.getByTestId('nav-tray')).toBeHidden();
  await expect(page.getByTestId('nav-tray-backdrop')).toBeHidden();
}

/**
 * Close the tray with Escape and wait for it to go.
 */
export async function closeNavTrayWithEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('nav-tray')).toBeHidden();
}
