/**
 * P0 E2E: Authentication - Login Flow
 *
 * Critical path: Users must be able to log in to access the app.
 * Covers email/password login, error handling, and session persistence.
 */
import type { Page, Route } from '@playwright/test';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { recurseUntil } from '../../support/helpers/recurse';
import { test, expect } from '../../support/merged-fixtures';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';

// `.env.test` points the dev server at http://127.0.0.1:54321, and the SDK
// derives its storage key as `sb-${hostname.split('.')[0]}-auth-token`.
const STORAGE_KEY = 'sb-127-auth-token';

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
          },
        },
      },
    });

    // The reads below are defensive stubs: each may fire zero times or many,
    // so none is awaited. Every GET is answered; anything else falls through.
    const serve = (body: unknown) => (route: Route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
        : route.fallback();

    // The user endpoint (called after auth state change).
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/auth/v1/user**', serve({ id: 'test-user-id', email: 'test@example.com' }));

    // The events fetch Home fires once auth settles — against the real API the
    // fake access token above earns it a 401, which the network-error monitor
    // turns into a test failure.
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/events**', serve([]));

    // Same reason, for the profile read App fires to decide whether this
    // account still needs the display-name setup screen. A chosen name keeps
    // that modal shut, which is what "redirected to the app" means here.
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/users?select=display_name**', serve([{ display_name: 'Test User' }]));

    // Same reason, for the partner lookups: loadPartner's own-row read and the
    // couple-settings refresher's lookupPartnerId both select partner_id. No
    // row reads as unlinked.
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/users?select=partner_id**', serve([]));

    // Same reason, for the mirror refresh App runs after sign-in: the
    // anniversary and message mirrors, the mood history, the poke/kiss
    // history, the love-notes thread and the photo list are read from the
    // server.
    for (const table of [
      'anniversaries',
      'custom_messages',
      'message_favorites',
      'moods',
      'interactions',
      'love_notes_visible',
      'photos',
    ]) {
      // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route(`**/rest/v1/${table}?**`, serve([]));
    }

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

  test('[P0] should persist session across page reloads', async ({ page, supabaseAdmin }) => {
    // GIVEN: This worker's own pool account, signed in through the real form
    // against local Supabase, with the welcome splash already dismissed.
    const pair = getWorkerPairEmails();
    if (!pair) throw new Error('This test requires its worker-owned account pair');
    const { userId } = await resolveWorkerPairIds(supabaseAdmin);
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });

    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill(pair.user1Email);
    await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
    await page.getByTestId('submit-button').click();

    // THEN: The app is open and the SDK has persisted this account's session.
    await expect(page.getByTestId('app-container')).toBeVisible();
    await expect(page.getByTestId('login-screen')).toHaveCount(0);
    await recurseUntil(() => storedSessionUserId(page), (v) => { expect(v).toBe(userId); });

    // WHEN: The page is reloaded
    await page.reload();

    // THEN: The same session is restored without signing in again.
    await expect(page.getByTestId('app-container')).toBeVisible();
    await expect(page.getByTestId('login-screen')).toHaveCount(0);
    await recurseUntil(() => storedSessionUserId(page), (v) => { expect(v).toBe(userId); });
  });
});

/** The user id of the session the SDK has persisted, or null when there is none. */
async function storedSessionUserId(page: Page): Promise<string | null> {
  return await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { user?: { id?: string } }).user?.id ?? null;
    } catch {
      return null;
    }
  }, STORAGE_KEY);
}
