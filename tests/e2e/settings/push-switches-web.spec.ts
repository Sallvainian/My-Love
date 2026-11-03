/**
 * E2E: the website's Settings has no Notifications page (stories 3.7 and 6, R11)
 *
 * The Notifications row and its page are rendered only in the native iOS
 * shell, where `Capacitor.isNativePlatform()` is true and both push plugins
 * exist. A browser is neither, so its Settings has no Notifications row, no
 * old "Push and reminders" section, no switch, and no read of
 * `push_preferences`; opening `/settings/notifications` directly lands on the
 * top page. The per-date reminder list (story 4.2) and its card are absent
 * too, and `countdown_marks` is never requested.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';

test.describe('Settings notifications on the web', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P1] should show no Notifications row or page in a browser', async ({ page, interceptNetworkCall }) => {
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
    await expect(view.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
    await expect(view.getByRole('heading', { name: 'About', exact: true })).toBeVisible();

    // No Notifications row (by test id and by name), so the page has no way in.
    await expect(page.getByTestId('settings-notifications-row')).toHaveCount(0);
    await expect(view.getByRole('button', { name: /^Notifications/ })).toHaveCount(0);
    await expect(page.getByTestId('settings-push')).toHaveCount(0);
    await expect(view.getByRole('heading', { name: 'Push and reminders' })).toHaveCount(0);
    await expect(view.getByRole('switch', { name: 'Love notes' })).toHaveCount(0);
    await expect(page.getByTestId('settings-push-permission-off')).toHaveCount(0);
    await expect(page.getByTestId('settings-reminder-marks')).toHaveCount(0);
    await expect(view.getByRole('heading', { name: 'Reminders', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('settings-reminders-switch')).toHaveCount(0);

    // A browser has no switch at all: the photos choice is a Photos page of
    // radios, behind a row that only a device reporting its connection type shows.
    await expect(view.getByRole('switch')).toHaveCount(0);
    expect(preferenceRequests).toEqual([]);
    expect(markRequests).toEqual([]);

    // WHEN: the page's path is opened directly
    await page.goto('/settings/notifications');

    // THEN: the top page at /settings, with none of the page's content, and still no read
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId('settings-notifications')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Notify me about' })).toHaveCount(0);
    await expect(page.getByRole('switch')).toHaveCount(0);
    expect(preferenceRequests).toEqual([]);
    expect(markRequests).toEqual([]);
  });
});
