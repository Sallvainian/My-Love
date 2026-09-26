/**
 * P0 E2E: Authentication - Google OAuth
 *
 * Critical path: Google OAuth sign-in must initiate properly.
 * Covers OAuth button visibility and redirect initiation.
 */
import { interceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call';
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
    // An array, not a `let`: a variable assigned only inside this callback stays
    // narrowed to its initial type at the use site, so `authorizeUrl!` would be
    // `never` there and the compiler could not check the assertions below.
    const authorizeUrls: string[] = [];
    // playwright-utils deviation: the stub must be in place before the click starts the authorize navigation; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/auth/v1/authorize**', (route) => {
      authorizeUrls.push(route.request().url());
      return route.fulfill({
        status: 302,
        headers: { Location: appBaseUrl + '/' },
      });
    });

    // WHEN: User clicks Google sign-in button. Arm the wait first: under PKCE
    // the SDK awaits `crypto.subtle.digest` before assigning
    // `window.location.href`, so the navigation no longer starts synchronously
    // with the click and the assertions below would otherwise race an empty
    // `authorizeUrls`. The standalone form, because the fixture drops `timeout`.
    const authorizeRequested = interceptNetworkCall({
      page,
      method: 'GET',
      url: '**/auth/v1/authorize*',
      timeout: 15_000,
    });
    await page.getByTestId('google-signin-button').click();
    await authorizeRequested;

    // THEN: The page navigated away from login (OAuth redirect was initiated)
    // After our intercept redirects back, the app reloads and shows login screen again
    await page.waitForLoadState('domcontentloaded');
    // If we got here, the OAuth flow was successfully initiated and intercepted
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 5000 });

    // CAP-13: the real browser starts a PKCE flow, so the provider hands back a
    // code this browser can redeem rather than tokens anyone could replay.
    expect(authorizeUrls).toHaveLength(1);
    const authorizeParams = new URL(authorizeUrls[0]).searchParams;
    expect(authorizeParams.get('code_challenge_method')).toBe('s256');
    expect(authorizeParams.get('code_challenge')).toBeTruthy();
    // The project's redirect allow-list entry must keep matching exactly: the
    // SDK appends a flow id only under experimental.appendPkceFlowIdToRedirects.
    expect(authorizeParams.get('redirect_to')).toBe(appBaseUrl + '/');
    expect(authorizeParams.get('access_type')).toBe('offline');
    expect(authorizeParams.get('prompt')).toBe('consent');
  });
});
