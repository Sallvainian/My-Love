/**
 * P0 E2E: Authentication - Login Flow
 *
 * Critical path: Users must be able to log in to access the app.
 * Covers email/password login and error handling.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Login Flow', () => {
  // Auth tests must run WITHOUT the shared authenticated storage state
  // so they can see the login screen (unauthenticated).
  test.use({ storageState: { cookies: [], origins: [] } });

  test('[P0] should display login screen when not authenticated', async ({ page }) => {
    // GIVEN: User is not authenticated
    await page.goto('/');

    // WHEN: Page loads

    // THEN: Login screen is visible (LoginScreen uses CSS classes, not data-testid)
    await expect(page.locator('.login-screen')).toBeVisible();
  });

  test('[P0] should show error message for invalid credentials', async ({ page }) => {
    // GIVEN: User is on login screen
    await page.goto('/');
    await expect(page.locator('.login-screen')).toBeVisible();

    // WHEN: User submits invalid credentials
    await page.fill('#email', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.locator('.submit-button').click();

    // THEN: Error message is displayed
    await expect(page.locator('.login-error')).toBeVisible();
  });

  test('[P0] should redirect to home after successful login', async ({ page }) => {
    // GIVEN: User is on login screen with valid credentials
    // WHEN: User submits valid credentials
    // THEN: User is redirected to the home view
    // TODO: Requires test user credentials (Sprint 1 implementation)
    test.skip();
  });

  test('[P0] should persist session across page reloads', async ({ page }) => {
    // GIVEN: User is authenticated
    // WHEN: Page is reloaded
    // THEN: User remains authenticated and sees the app
    // TODO: Requires test user credentials (Sprint 1 implementation)
    test.skip();
  });
});
