/**
 * E2E: Log out of all devices (epic-settings-rework story 5.5, R13).
 *
 * Offline, the row refuses before any dialog or request; online, it asks in the
 * Confirmation dialog, and Cancel logs out nothing. Logging out for real is
 * `logout.spec.ts`; the dialog's focus, Escape, the double press and the partial
 * notice are pinned by `src/components/Settings/__tests__/Settings.kit.test.tsx`.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import { goOffline } from '../../support/helpers/offline';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

test.beforeEach(async ({ page }) => {
  await dismissWelcomeSplash(page);
});

const SUPABASE_PATHS = ['/rest/v1', '/storage/v1', '/auth/v1', '/functions/v1'];

test.describe('Log out of all devices', () => {
  test('[P1] refuses offline with no dialog, and otherwise asks before logging out', async ({
    page,
  }) => {
    // Every logout request from here on, and, while offline, every Supabase API
    // request; none may go out in this test.
    const logoutRequests: string[] = [];
    const offlineRequests: string[] = [];
    let watchingOffline = false;
    // playwright-utils deviation: records every request so the test can assert there were none; interceptNetworkCall waits for one match and cannot prove an absence.
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.endsWith('/auth/v1/logout')) {
        logoutRequests.push(`${request.method()} ${request.url()}`);
      }
      if (watchingOffline && SUPABASE_PATHS.some((path) => pathname.startsWith(path))) {
        offlineRequests.push(`${request.method()} ${pathname}`);
      }
    });

    await page.goto('/');
    await navigateTo(page, 'settings');
    const everywhere = page.getByTestId('settings-sign-out-everywhere');
    await expect(everywhere).toHaveText('Log out of all devices');
    const dialog = page.getByTestId('settings-sign-out-everywhere-confirmation');
    // Settings' Error box; the app's offline banner sits outside the view.
    const errorBox = page.getByTestId('settings-view').getByRole('alert');

    try {
      // Offline: refused before any dialog or request.
      await goOffline(page, true);
      watchingOffline = true;
      await everywhere.click();
      await expect(errorBox).toHaveText(
        'You are offline. Logging out of all devices needs a connection to go through.'
      );
      await expect(dialog).toHaveCount(0);
      await expect(everywhere).toBeEnabled();
      watchingOffline = false;
      expect(offlineRequests).toEqual([]);
    } finally {
      watchingOffline = false;
      await goOffline(page, false);
    }

    // Online: the dialog asks, and Cancel logs out nothing.
    await everywhere.click();
    await expect(dialog).toBeVisible();
    await expect(errorBox).toHaveCount(0);
    await expect(dialog.getByRole('heading')).toHaveText(
      "Log out on every device? You'll need to sign in again on each one."
    );
    await expect(dialog.getByRole('button', { name: 'Log out everywhere' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    // A started log-out disables the row and relabels it before any request.
    await expect(everywhere).toBeEnabled();
    await expect(everywhere).toHaveText('Log out of all devices');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(page.getByTestId('login-screen')).toHaveCount(0);
    expect(logoutRequests).toEqual([]);
  });
});
