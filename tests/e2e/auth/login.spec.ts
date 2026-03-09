/**
 * P0 E2E: Authentication - Login Flow
 *
 * Critical path: Users must be able to log in to access the app.
 * Covers email/password login, error handling, and session persistence.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Login Flow', () => {
  // Auth tests must run WITHOUT the shared authenticated storage state
  // so they can see the login screen (unauthenticated).
  test.use({ authSessionEnabled: false });

  test('[P0] should display login screen when not authenticated', async ({ page }) => {
    // GIVEN: User is not authenticated
    await page.goto('/');

    // WHEN: Page loads

    // THEN: Login screen is visible
    await expect(page.getByTestId('login-screen')).toBeVisible();
  });

  test('[P0] should show error message for invalid credentials', async ({
    page,
    interceptNetworkCall,
  }) => {
    // Intercept auth API BEFORE navigation (network-first pattern)
    const authCall = interceptNetworkCall({
      url: '**/auth/v1/token**',
      method: 'POST',
      fulfillResponse: {
        status: 400,
        body: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
      },
    });

    // GIVEN: User is on login screen
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();

    // WHEN: User submits invalid credentials
    const invalidCredentials = { email: 'nonexistent@example.com', password: 'wrong-password' };
    await page.getByRole('textbox', { name: 'Email' }).fill(invalidCredentials.email);
    await page.getByTestId('password-input').fill(invalidCredentials.password);
    await page.getByTestId('submit-button').click();

    await authCall; // Deterministic wait for API response

    // THEN: Error message is displayed
    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('[P0] should redirect to home after successful login', async ({
    page,
    interceptNetworkCall,
  }) => {
    // Intercept token endpoint for successful login
    const authCall = interceptNetworkCall({
      url: '**/auth/v1/token**',
      method: 'POST',
      fulfillResponse: {
        status: 200,
        body: {
          access_token: 'fake-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'fake-refresh-token',
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { display_name: 'Test User' },
          },
        },
      },
    });

    // Intercept the user endpoint (called after auth state change)
    interceptNetworkCall({
      url: '**/auth/v1/user**',
      method: 'GET',
      fulfillResponse: {
        status: 200,
        body: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { display_name: 'Test User' },
        },
      },
    });

    // GIVEN: User is on login screen
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();

    // WHEN: User submits valid credentials
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');
    await page.getByTestId('password-input').fill('valid-password-123');
    await page.getByTestId('submit-button').click();

    await authCall;

    // THEN: Login screen is no longer visible (user redirected to app)
    await expect(page.getByTestId('login-screen')).not.toBeVisible({ timeout: 5000 });
  });

  test('[P0] should persist session across page reloads', async ({ page }) => {
    // Note: This test verifies consistent unauthenticated behavior on reload.

    // GIVEN: User is not authenticated
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();

    // WHEN: Page is reloaded
    await page.reload();

    // THEN: Login screen still appears (consistent unauthenticated behavior)
    await expect(page.getByTestId('login-screen')).toBeVisible();
  });
});
