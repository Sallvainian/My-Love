/**
 * E2E: Settings on the style kit
 *
 * Settings at 390x844 in both OS themes, read at the rendered surface: one
 * "Events" and one "Anniversaries" group heading with none of the old inner
 * titles, the countdown and Sign out cards on the kit card colour, a quiet
 * Sign out (no gradient, kit danger text), no horizontal overflow, and the
 * About row that replays the welcome splash and returns to Settings. The kit
 * colours are `--kit-*` variables that switch under `prefers-color-scheme`, so
 * `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';
import type { Page } from '@playwright/test';
import { navigateTo } from '../../support/helpers/navigation';

const KIT_CARD = {
  light: 'rgb(255, 255, 255)', // #ffffff
  dark: 'rgb(20, 25, 37)', // #141925
} as const;

const KIT_DANGER = {
  light: 'rgb(207, 33, 33)', // #cf2121
  dark: 'rgb(248, 113, 113)', // #f87171
} as const;

async function openSettings(page: Page, colorScheme: 'light' | 'dark') {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/');
  await navigateTo(page, 'settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
}

test.describe('Settings on the style kit', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`[P1] should render grouped kit cards and a quiet Sign out in ${colorScheme}`, async ({
      page,
    }) => {
      await openSettings(page, colorScheme);
      const view = page.getByTestId('settings-view');

      // One heading per countdown group; the old inner titles are gone.
      await expect(view.getByRole('heading', { name: 'Events', exact: true })).toHaveCount(1);
      await expect(
        view.getByRole('heading', { name: 'Anniversaries', exact: true })
      ).toHaveCount(1);
      await expect(view.getByText('Event Countdowns')).toHaveCount(0);
      await expect(view.getByText('Anniversary Countdowns')).toHaveCount(0);

      // Section labels.
      for (const label of ['Account', 'Countdowns', 'About']) {
        await expect(view.getByRole('heading', { level: 2, name: label, exact: true })).toBeVisible();
      }

      // Cards on the kit card colour: Countdowns (the events group's card) and
      // the Sign out card.
      const countdownsCard = page.getByTestId('events-settings').locator('..');
      await expect(countdownsCard).toHaveCSS('background-color', KIT_CARD[colorScheme]);
      const signOut = page.getByTestId('settings-sign-out');
      await expect(signOut.locator('..')).toHaveCSS('background-color', KIT_CARD[colorScheme]);

      // Quiet Sign out: no gradient, kit danger text.
      await expect(signOut).toHaveCSS('background-image', 'none');
      await expect(signOut).toHaveCSS('color', KIT_DANGER[colorScheme]);
      await expect(signOut).toHaveText('Sign out');

      // No horizontal page scroll at phone width, measured once the events
      // list has settled so its final rows are what is measured.
      await expect(page.getByTestId('events-settings-loading')).toHaveCount(0);
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(widths.scroll).toBe(widths.client);
    });
  }

  test('[P1] should replay the welcome message from About and return to Settings', async ({
    page,
  }) => {
    await openSettings(page, 'light');
    const before = await page.evaluate(() => localStorage.getItem('lastWelcomeView'));

    await page.getByTestId('settings-replay-welcome').click();
    await expect(page.getByTestId('welcome-splash')).toBeVisible();

    await page.getByTestId('welcome-continue-button').click();
    await expect(page.getByTestId('welcome-splash')).toHaveCount(0);
    await expect(page.getByTestId('settings-view')).toBeVisible();

    // A manual replay does not reset the automatic splash timer.
    const after = await page.evaluate(() => localStorage.getItem('lastWelcomeView'));
    expect(after).toBe(before);
  });
});
