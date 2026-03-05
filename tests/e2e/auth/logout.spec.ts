/**
 * P0 E2E: Authentication - Logout Flow
 *
 * Critical path: Users must be able to log out securely.
 * Covers sign-out and session cleanup.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Logout Flow', () => {
  // These tests need authenticated sessions (default behavior)

  test('[P0] should sign out and show login screen', async ({ page, interceptNetworkCall }) => {
    // Intercept the sign-out API call
    const signOutCall = interceptNetworkCall({
      url: '**/auth/v1/logout**',
      method: 'POST',
      fulfillResponse: {
        status: 204,
        body: {},
      },
    });

    // GIVEN: User is authenticated (via auth fixture)
    await page.goto('/');

    // WHEN: User clicks sign out in the navigation
    await page.getByTestId('nav-logout').click();

    await signOutCall;

    // THEN: Login screen is displayed
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 5000 });
  });

  test('[P0] should clear session data on logout', async ({ page, interceptNetworkCall }) => {
    const signOutCall = interceptNetworkCall({
      url: '**/auth/v1/logout**',
      method: 'POST',
      fulfillResponse: {
        status: 204,
        body: {},
      },
    });

    // GIVEN: User is authenticated with active session
    await page.goto('/');

    // WHEN: User logs out
    await page.getByTestId('nav-logout').click();
    await signOutCall;

    // THEN: Session tokens are cleared, reloading shows login screen
    await page.reload();
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 5000 });
  });
});
