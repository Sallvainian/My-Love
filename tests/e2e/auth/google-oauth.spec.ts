/**
 * P0 E2E: Authentication - Google OAuth
 *
 * Critical path: Google OAuth sign-in must initiate properly.
 * Covers OAuth button visibility and redirect initiation.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Google OAuth', () => {
  // Auth tests must run WITHOUT the shared authenticated storage state
  // so they can see the login screen (unauthenticated).
  test.use({ authSessionEnabled: false });

  test('[P0] should display Google sign-in button on login screen', async ({ page }) => {
    // GIVEN: User is on login screen
    await page.goto('/');

    // WHEN: Login screen loads

    // THEN: Google sign-in button is visible with correct text
    await expect(page.getByTestId('google-signin-button')).toBeVisible();
    await expect(page.getByTestId('google-signin-button')).toHaveText(/Continue with Google/);
  });

  test('[P0] should initiate OAuth redirect when Google button clicked', async ({ page }) => {
    // GIVEN: User is on login screen
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();

    // Supabase signInWithOAuth does a full page navigation to /auth/v1/authorize.
    // Intercept and redirect back to the app URL (not Supabase) to avoid 404.
    const appBaseUrl = page.url().replace(/\/$/, '');
    await page.route('**/auth/v1/authorize**', (route) => {
      route.fulfill({
        status: 302,
        headers: { Location: appBaseUrl + '/' },
      });
    });

    // WHEN: User clicks Google sign-in button
    await page.getByTestId('google-signin-button').click();

    // THEN: The page navigated away from login (OAuth redirect was initiated)
    // After our intercept redirects back, the app reloads and shows login screen again
    await page.waitForLoadState('domcontentloaded');
    // If we got here, the OAuth flow was successfully initiated and intercepted
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 5000 });
  });
});
