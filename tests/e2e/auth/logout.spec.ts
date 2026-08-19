/**
 * P0 E2E: Authentication - Logout Flow
 *
 * Critical path: Users must be able to log out securely.
 * Covers sign-out and session cleanup.
 *
 * The nav-level logout is gone; Settings holds the only sign-out. Both controls
 * always called the same `signOut` (api/authService.ts:10 re-exports the very
 * function App.tsx used to import), so the logout interceptions below still fire
 * on exactly the request they always did.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

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

    // WHEN: User opens the tray, enters Settings and signs out there
    await navigateTo(page, 'settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await page.getByTestId('settings-sign-out').click();

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

    // WHEN: User logs out from Settings
    await navigateTo(page, 'settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await page.getByTestId('settings-sign-out').click();
    await signOutCall;

    // THEN: Session tokens are cleared, reloading shows login screen
    await page.reload();
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 5000 });
  });

  test('[P0] should clear account state through signedOutState on logout', async ({
    page,
    interceptNetworkCall,
  }) => {
    const signOutCall = interceptNetworkCall({
      url: '**/auth/v1/logout**',
      method: 'POST',
      fulfillResponse: {
        status: 204,
        body: {},
      },
    });

    // GIVEN: User is authenticated, with account-scoped data in the store.
    // A freshly provisioned worker account loads nothing, so seeding is what
    // makes this test capable of failing: without it every collection is
    // already empty and the assertion below passes even when the reset is
    // removed entirely. These are the shapes the loaders themselves produce.
    await page.goto('/');
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();

    await page.evaluate(() => {
      window.__APP_STORE__?.setState({
        notes: [
          {
            id: 'seed-note',
            from_user_id: 'seed-sender',
            to_user_id: 'seed-recipient',
            content: 'seeded love note',
            created_at: new Date().toISOString(),
          },
        ],
        events: [
          {
            id: 'seed-event',
            userId: 'seed-sender',
            label: 'Seeded anniversary',
            date: new Date(),
            createdAt: new Date(),
            description: null,
            icon: 'calendar',
          },
        ],
      });
    });

    // The seed has to have landed, or the assertion is vacuous again.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = window.__APP_STORE__?.getState();
          return state ? state.notes.length + state.events.length : 0;
        })
      )
      .toBeGreaterThan(0);

    // WHEN: User signs out from Settings — the app's only sign-out since the
    // nav-level one was retired
    await navigateTo(page, 'settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await page.getByTestId('settings-sign-out').click();
    await signOutCall;
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 5000 });

    // THEN: The store itself is emptied, not merely the session. The store
    // survives sign-out, so a partial reset would leak one couple's notes,
    // photos and countdown dates to the next account on a shared device.
    // Consolidating sign-out into Settings must not change that, and only a
    // reading of the live store proves it did not.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = window.__APP_STORE__?.getState();
          if (!state) return null;
          return {
            userId: state.userId,
            isAuthenticated: state.isAuthenticated,
            notes: state.notes.length,
            photos: state.photos.length,
            moods: state.moods.length,
            events: state.events.length,
            partner: state.partner,
          };
        })
      )
      .toEqual({
        userId: null,
        isAuthenticated: false,
        notes: 0,
        photos: 0,
        moods: 0,
        events: 0,
        partner: null,
      });
  });
});
