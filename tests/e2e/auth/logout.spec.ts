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
import type { Page, Route } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

/**
 * How many rows one account has in the three stores sign-out must empty for
 * it, and whether the seeded anniversary and custom message are among them.
 */
async function ownedRowCounts(page: Page, owner: string, seed: { label: string; custom: string }) {
  return page.evaluate(async ({ userId, label, custom }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('my-love-db');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = (store: string) =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    try {
      const copies = (await all('local-copies')).filter((row) => row.userId === userId);
      const messages = (await all('messages')).filter((row) => row.userId === userId);
      return {
        copies: copies.length,
        custom: messages.length,
        favorites: (await all('message-favorites')).filter((row) => row.userId === userId).length,
        seeded:
          JSON.stringify(copies).includes(label) && messages.some((row) => row.text === custom),
      };
    } finally {
      db.close();
    }
  }, { userId: owner, ...seed });
}

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

    // WHEN: User taps the gear, enters Settings and signs out there
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
    await expect(page.getByTestId('nav-dock')).toBeVisible();

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

  test("[P1] deletes the outgoing account's saved anniversaries, custom messages and favorites from the device", async ({
    page,
    interceptNetworkCall,
  }) => {
    const signOutCall = interceptNetworkCall({
      url: '**/auth/v1/logout**',
      method: 'POST',
      fulfillResponse: { status: 204, body: {} },
    });
    const LABEL = 'DEVICE-ANNIVERSARY-LABEL';
    const CUSTOM = 'DEVICE-CUSTOM-MESSAGE-TEXT';
    const seed = { label: LABEL, custom: CUSTOM };

    // GIVEN: the account's saved data on the device, written by the app's own
    // refreshes. The server reads are answered with the seed on every call, so
    // no later refresh can replace or delete it before sign-out — the zero
    // counts below can only come from sign-out's delete.
    const at = new Date().toISOString();
    const serve = (rows: unknown[]) => (route: Route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
        : route.fallback();
    await page.route('**/rest/v1/anniversaries?*', serve([
      { id: 'srv-device', user_id: 'seed', event_date: '2024-02-14', label: LABEL, description: null,
        client_key: 'seed', created_at: at, updated_at: at },
    ]));
    await page.route('**/rest/v1/custom_messages?*', serve([
      { id: 'srv-device-custom', user_id: 'seed', text: CUSTOM, category: 'custom', active: true,
        is_favorite: true, tags: [], client_key: 'seed', created_at: at, updated_at: at },
    ]));
    await page.route('**/rest/v1/message_favorites?*', serve([]));
    await page.goto('/');
    await expect(page.getByTestId('nav-dock')).toBeVisible();
    const userId = await page.evaluate(() => window.__APP_STORE__!.getState().userId!);

    await expect
      .poll(async () => {
        const counts = await ownedRowCounts(page, userId, seed);
        return counts.seeded && counts.favorites > 0;
      })
      .toBe(true);

    // WHEN: the user signs out.
    await navigateTo(page, 'settings');
    await page.getByTestId('settings-sign-out').click();
    await signOutCall;
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 5000 });

    // THEN: none of it is readable from IndexedDB or localStorage any more.
    await expect
      .poll(() => ownedRowCounts(page, userId, seed))
      .toEqual({ copies: 0, custom: 0, favorites: 0, seeded: false });
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(storage).not.toContain(LABEL);
    expect(storage).not.toContain(CUSTOM);
  });
});
