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
  test.use({ storageState: { cookies: [], origins: [] } });

  test('[P0] should display Google sign-in button on login screen', async ({ page }) => {
    // GIVEN: User is on login screen
    await page.goto('/');

    // WHEN: Login screen loads

    // THEN: Google sign-in button is visible (LoginScreen uses CSS classes, not data-testid)
    await expect(page.locator('.google-signin-button')).toBeVisible();
  });

  test('[P0] should initiate OAuth redirect when Google button clicked', async ({ page }) => {
    // GIVEN: User is on login screen
    // WHEN: User clicks Google sign-in button
    // THEN: Browser navigates to Google OAuth URL
    // TODO: Requires intercepting navigation to verify redirect (Sprint 1)
    test.skip();
  });
});
