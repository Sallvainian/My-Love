/**
 * E2E: the website's Settings has no push switches (story 3.7, R11)
 *
 * "Push and reminders" is rendered only in the native iOS shell, where
 * `Capacitor.isNativePlatform()` is true and both push plugins exist. A browser
 * is neither, so its Settings shows the Photos section and goes straight on to
 * About: no section, no heading, no switch, and no read of `push_preferences`.
 * The "Reminders" group of marked dates (story 4.2) and its "Date reminders"
 * switch (story 4.3) are absent too, and `countdown_marks` is never requested.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';

test.describe('Settings push switches on the web', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P1] should show no push section in a browser', async ({ page, interceptNetworkCall }) => {
    // Attached before the page loads, so a read made at mount cannot slip past.
    const preferenceRequests: string[] = [];
    const markRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/push_preferences')) {
        preferenceRequests.push(`${request.method()} ${request.url()}`);
      }
      if (request.url().includes('/rest/v1/countdown_marks')) {
        markRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await openSettingsFromHome(page, interceptNetworkCall);
    const view = page.getByTestId('settings-view');

    // The neighbouring sections are on screen, so the absence below is not an unloaded page.
    await expect(view.getByRole('heading', { name: 'Photos', exact: true })).toBeVisible();
    await expect(view.getByRole('heading', { name: 'About', exact: true })).toBeVisible();

    await expect(page.getByTestId('settings-push')).toHaveCount(0);
    await expect(view.getByRole('heading', { name: 'Push and reminders' })).toHaveCount(0);
    await expect(view.getByRole('switch', { name: 'Love notes' })).toHaveCount(0);
    await expect(page.getByTestId('settings-push-permission-off')).toHaveCount(0);
    await expect(page.getByTestId('settings-reminder-marks')).toHaveCount(0);
    await expect(view.getByRole('heading', { name: 'Reminders', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('settings-reminders-switch')).toHaveCount(0);

    // The one switch a browser has is the photos one.
    await expect(view.getByRole('switch')).toHaveCount(1);
    expect(preferenceRequests).toEqual([]);
    expect(markRequests).toEqual([]);
  });
});
