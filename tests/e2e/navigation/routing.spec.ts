/**
 * P0 E2E: Navigation - URL Routing
 *
 * Critical path: Direct URL navigation and browser back/forward must work.
 * Covers deep linking and popstate handling.
 *
 * The readiness proxy is `nav-dock`: the bottom dock is on screen on every
 * view, the role the retired bar's container testid played.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { navigateTo } from '../../support/helpers/navigation';
import type { Page } from '@playwright/test';

/**
 * Home is the current view and rendered. Neither witness waits on a server
 * answer: the dock's `aria-current` follows `currentView`, and the daily
 * message comes from the bundled rows on the device. (The TimeTogether card
 * shows only once the couple-settings read reports a linked couple.)
 */
async function expectHome(page: Page) {
  await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('message-text')).toBeVisible();
}

test.describe('URL Routing', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P0] should load correct view from direct URL', async ({ page }) => {
    // GIVEN: User is authenticated (via auth fixture)

    // WHEN: User navigates directly to /mood, which Daily took over (story 6.9)
    await page.goto('/mood');

    // THEN: Daily is loaded (app chrome is visible) and the mood screen is not
    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await expect(page.getByTestId('daily-question-view')).toBeVisible();
    await expect(page.getByTestId('mood-tracker')).toHaveCount(0);

    // AND: The dock marks Daily as the current destination
    await expect(page.getByTestId('nav-daily')).toHaveAttribute('aria-current', 'page');

    // AND: The URL is rewritten to /daily
    await expect(page).toHaveURL(/\/daily$/);
  });

  test('[P1] should open Daily on back to a /mood entry left from before Daily', async ({ page }) => {
    // GIVEN: Home, with an older app-made /mood entry and a Photos entry above it,
    // as a history kept from before Daily took Mood's slot (story 6.9).
    // pushState fires no popstate, so the app stays on Home while they are made.
    await page.goto('/');
    await expectHome(page);
    await page.evaluate(() => {
      history.pushState({ view: 'mood', inApp: true, depth: 1 }, '', '/mood');
      history.pushState({ view: 'photos', inApp: true, depth: 2 }, '', '/photos');
    });

    // WHEN: The browser goes back onto the /mood entry
    await page.goBack();

    // THEN: Daily shows, not the mood screen, and the bar reads /daily
    await expect(page.getByTestId('daily-question-view')).toBeVisible();
    await expect(page.getByTestId('mood-tracker')).toHaveCount(0);
    await expect(page.getByTestId('nav-daily')).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/\/daily$/);
    // AND: the entry keeps its state, so its depth still counts toward Home
    expect(await page.evaluate(() => history.state)).toEqual({
      view: 'mood',
      inApp: true,
      depth: 1,
    });
  });

  test('[P0] should go back to Home, not the previous view, with the browser back button', async ({ page }) => {
    // GIVEN: User navigated from home to photos to daily
    await page.goto('/');
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // Navigate to photos
    await navigateTo(page, 'photos');
    await page.waitForURL('**/photos');

    // Navigate to daily
    await navigateTo(page, 'daily');
    await page.waitForURL('**/daily');

    // WHEN: User clicks browser back button
    await page.goBack();

    // THEN: Home, the bottom of the history, not Photos: a dock view sits on Home alone
    await page.waitForURL((url) => url.pathname === '/');
    await expectHome(page);
  });

  test('[P0] should fallback to home view for unknown routes', async ({ page }) => {
    // GIVEN: User navigates to an unknown route
    // WHEN: Page loads with unknown route
    await page.goto('/nonexistent-page');

    // THEN: Home view is displayed (app falls back to home)
    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await expectHome(page);
  });

  test('[P0] should show home and no scripture view on a direct /scripture load', async ({
    page,
  }) => {
    await page.goto('/scripture');

    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await expectHome(page);
    await expect(page.getByTestId('nav-scripture')).toHaveCount(0);
  });

  // A dock pick turns the fresh /scripture entry into Home, so back lands on `/`.
  test('[P0] should show home and no scripture view on back from a view picked at /scripture', async ({
    page,
  }) => {
    await page.goto('/scripture');
    await expectHome(page);

    await navigateTo(page, 'daily');
    await page.waitForURL('**/daily');

    await page.goBack();

    await expectHome(page);
    await expect(page.getByTestId('nav-scripture')).toHaveCount(0);
  });
});
