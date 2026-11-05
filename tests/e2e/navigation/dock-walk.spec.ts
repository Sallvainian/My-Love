/**
 * E2E: the dock walk back to Home always ends (DW-441)
 *
 * A dock pick above the first history entry walks back with `history.go(-depth)`
 * and lands on the `popstate` that causes. A stored `depth` past the start of
 * the history used to leave the walk waiting for a `popstate` that never came,
 * and the dock did nothing until a reload. Landing leaves the picked view one
 * entry above Home, so back from it is Home.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { navigateTo } from '../../support/helpers/navigation';

/** What shows that a dock view rendered; Photos renders one of two roots. */
const WITNESS: Record<'home' | 'notes' | 'photos', (page: Page) => Locator> = {
  home: (page) => page.getByTestId('message-text'),
  notes: (page) => page.getByTestId('love-notes-view'),
  photos: (page) =>
    page.getByTestId('photo-gallery').or(page.getByTestId('photo-gallery-empty-state')),
};

test.describe('Dock walk', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P1] should land every dock tap when the entry claims a depth past the history', async ({
    page,
  }) => {
    // The app opens in a window of its own: the test page keeps its initial
    // about:blank entry under the app, and a walk clamped to the history's
    // length would land on it. An installed app's first entry is the app.
    await page.goto('/');
    const [app] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('/')),
    ]);
    await dismissWelcomeSplash(app);
    await app.reload();
    expect(await app.evaluate(() => history.length)).toBe(1);
    await navigateTo(app, 'mood');
    await expect(app).toHaveURL(/\/mood$/);

    // GIVEN: The entry claims 50 entries below it, far more than the history holds
    await app.evaluate(() => history.replaceState({ ...history.state, depth: 50 }, ''));

    // WHEN: Notes is tapped, then Photos
    await navigateTo(app, 'notes');
    await expect(app).toHaveURL(/\/notes$/);
    await expect(WITNESS.notes(app)).toBeVisible();

    await navigateTo(app, 'photos');
    await expect(app).toHaveURL(/\/photos$/);
    await expect(WITNESS.photos(app)).toBeVisible();

    // THEN: Back is Home, the bottom of the history
    await app.goBack();
    await expect(app).toHaveURL((url) => url.pathname === '/');
    await expect(WITNESS.home(app)).toBeVisible();
    await expect(app.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');
  });

  test('[P1] should land a dock tap made right after a reload on a Settings subpage', async ({
    page,
  }) => {
    await page.goto('/');
    await navigateTo(page, 'settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await page.getByTestId('settings-dates-row').click();
    await expect(page).toHaveURL(/\/settings\/dates$/);

    // WHEN: The page is reloaded there and Notes is tapped at once
    await page.reload();
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await navigateTo(page, 'notes');

    // THEN: Love Notes shows, and back is Home
    await expect(page).toHaveURL(/\/notes$/);
    await expect(WITNESS.notes(page)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(WITNESS.home(page)).toBeVisible();
  });
});
