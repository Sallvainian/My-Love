/**
 * E2E: Settings on the style kit
 *
 * Settings at 390x844 in both OS themes, read at the rendered surface: the
 * Account, Partner and About group headings with no Countdowns section or
 * Events / Anniversaries heading (dates live on the Dates list), the Log out
 * card on the kit card colour, a quiet Log out (no gradient, kit danger text),
 * no horizontal overflow, and the About row that replays the welcome splash and
 * returns to Settings. The kit
 * colours are `--kit-*` variables that switch under `prefers-color-scheme`, so
 * `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash, WELCOME_SPLASH_KEY } from '../../support/helpers/welcome-splash';
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';

const KIT_CARD = {
  light: 'rgb(255, 255, 255)', // #ffffff
  dark: 'rgb(20, 25, 37)', // #141925
} as const;

const KIT_DANGER = {
  light: 'rgb(207, 33, 33)', // #cf2121
  dark: 'rgb(248, 113, 113)', // #f87171
} as const;

async function openSettings(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  colorScheme: 'light' | 'dark'
) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await openSettingsFromHome(page, interceptNetworkCall);
}

test.describe('Settings on the style kit', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`[P1] should show the group labels and no Countdowns section in ${colorScheme}`, async ({
      page,
      interceptNetworkCall,
    }) => {
      await openSettings(page, interceptNetworkCall, colorScheme);
      const view = page.getByTestId('settings-view');

      // Section labels.
      for (const label of ['Account', 'Partner', 'About']) {
        await expect(view.getByRole('heading', { level: 2, name: label, exact: true })).toBeVisible();
      }

      // The old Countdowns section, its inner titles and its card are gone.
      await expect(view.getByRole('heading', { name: 'Countdowns', exact: true })).toHaveCount(0);
      await expect(view.getByRole('heading', { name: 'Events', exact: true })).toHaveCount(0);
      await expect(view.getByRole('heading', { name: 'Anniversaries', exact: true })).toHaveCount(0);
      await expect(view.getByTestId('settings-countdowns-card')).toHaveCount(0);
      await expect(view).not.toContainText(/Countdowns/i);
    });

    test(`[P1] should draw the Log out card on the kit card in ${colorScheme}`, async ({
      page,
      interceptNetworkCall,
    }) => {
      await openSettings(page, interceptNetworkCall, colorScheme);

      // The Log out card on the kit card colour.
      await expect(page.getByTestId('settings-sign-out-card')).toHaveCSS(
        'background-color',
        KIT_CARD[colorScheme]
      );
    });

    test(`[P1] should draw a quiet Log out in ${colorScheme}`, async ({
      page,
      interceptNetworkCall,
    }) => {
      await openSettings(page, interceptNetworkCall, colorScheme);

      // Quiet Log out: no gradient, kit danger text.
      const signOut = page.getByTestId('settings-sign-out');
      await expect(signOut).toHaveCSS('background-image', 'none');
      await expect(signOut).toHaveCSS('color', KIT_DANGER[colorScheme]);
      await expect(signOut).toHaveText('Log out');
    });

    test(`[P1] should not scroll sideways at phone width in ${colorScheme}`, async ({
      page,
      interceptNetworkCall,
    }) => {
      await openSettings(page, interceptNetworkCall, colorScheme);

      // No horizontal page scroll at phone width. The top page reads nothing
      // that changes its size, so it is measured as soon as it is on screen.
      await expect(page.getByTestId('settings-version')).toBeVisible();
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(widths.scroll).toBe(widths.client);
    });
  }

  test('[P1] should replay the welcome message from About and return to Settings', async ({
    page,
    interceptNetworkCall,
  }) => {
    await openSettings(page, interceptNetworkCall, 'light');
    const before = await page.evaluate((key) => localStorage.getItem(key), WELCOME_SPLASH_KEY);

    await page.getByTestId('settings-replay-welcome').click();
    await expect(page.getByTestId('welcome-splash')).toBeVisible();

    await page.getByTestId('welcome-continue-button').click();
    await expect(page.getByTestId('welcome-splash')).toHaveCount(0);
    await expect(page.getByTestId('settings-view')).toBeVisible();

    // A manual replay does not reset the automatic splash timer.
    const after = await page.evaluate((key) => localStorage.getItem(key), WELCOME_SPLASH_KEY);
    expect(after).toBe(before);
  });
});
