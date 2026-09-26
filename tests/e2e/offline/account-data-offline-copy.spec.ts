/**
 * E2E: anniversaries and message favorites on the shared local-copy mechanism.
 *
 * - An anniversary loaded in one online session is shown again when the server
 *   cannot be reached. The persisted blob no longer carries anniversaries, so
 *   what comes back can only be the account's saved local copy.
 * - A favorite added on the server while this device is offline appears after
 *   the connection returns, without a reload (refresh on reconnect).
 * - A favorite and a custom message loaded in one online session are shown
 *   again when the server cannot be reached, from the account's message-data
 *   copy; the shared `messages` store holds no custom row.
 *
 * Every server row touched here belongs to this worker's own account.
 */
import type { Page, Request } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import { ANNIVERSARIES_READ, FAVORITES_READ } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

async function signedInUserId(page: Page): Promise<string> {
  await recurseUntil(
    () => page.evaluate(() => window.__APP_STORE__?.getState().userId ?? null),
    (v) => {
      expect(v).not.toBeNull();
    }
  );
  return (await page.evaluate(() => window.__APP_STORE__!.getState().userId))!;
}

/** Labels in the signed-in account's saved anniversaries copy. */
async function savedAnniversaryLabels(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return [];
    return new Promise<string[]>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve([]);
      open.onsuccess = () => {
        const db = open.result;
        const get = db
          .transaction('local-copies')
          .objectStore('local-copies')
          .get([userId, 'anniversaries']);
        get.onsuccess = () => {
          db.close();
          const value = get.result?.value as Array<{ label: string }> | undefined;
          resolve(value ? value.map((a) => a.label) : []);
        };
        get.onerror = () => {
          db.close();
          resolve([]);
        };
      };
    });
  });
}

/** Custom texts and bundled favorites in the signed-in account's message-data copy. */
async function savedMessageData(page: Page): Promise<{ texts: string[]; bundledFavoriteIds: number[] }> {
  return page.evaluate(async () => {
    const empty = { texts: [] as string[], bundledFavoriteIds: [] as number[] };
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return empty;
    return new Promise<typeof empty>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(empty);
      open.onsuccess = () => {
        const db = open.result;
        const get = db
          .transaction('local-copies')
          .objectStore('local-copies')
          .get([userId, 'message-data']);
        get.onsuccess = () => {
          db.close();
          const value = get.result?.value as
            | { custom: Array<{ text: string }>; bundledFavoriteIds: number[] }
            | undefined;
          resolve(
            value
              ? { texts: value.custom.map((row) => row.text), bundledFavoriteIds: value.bundledFavoriteIds }
              : empty
          );
        };
        get.onerror = () => {
          db.close();
          resolve(empty);
        };
      };
    });
  });
}

/** Custom rows left in the shared `messages` store (bundled rows only since v15). */
async function customRowsInMessagesStore(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('my-love-db');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('messages').objectStore('messages').getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result.filter((row: { isCustom?: boolean }) => row.isCustom).length);
          };
          all.onerror = () => {
            db.close();
            reject(all.error);
          };
        };
      })
  );
}

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

test.describe('Account data from the local copy', () => {
  test('an anniversary from one online session is shown when the server cannot be reached', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // Awaited here so the cold start's own anniversaries read, sent before the
    // row exists, cannot be the one the Settings visit below waits on.
    const startRead = interceptNetworkCall({ method: 'GET', url: ANNIVERSARIES_READ });
    await page.goto('/');
    expect((await startRead).status).toBe(200);
    const userId = await signedInUserId(page);
    const label = `Offline anniversary ${testInfo.workerIndex}-${Date.now()}`;
    // Hard before the test, so it never runs on leftover rows; soft in the
    // teardown, so the test's own error stands.
    const clear = async ({ soft }: { soft: boolean }) => {
      const { error } = await supabaseAdmin.from('anniversaries').delete().eq('user_id', userId);
      const message = 'clearing anniversaries for this worker account';
      (soft ? expect.soft(error, message) : expect(error, message)).toBeNull();
    };
    await clear({ soft: false });
    const { error: insertError } = await supabaseAdmin
      .from('anniversaries')
      .insert({ user_id: userId, event_date: '2024-02-14', label });
    expect(insertError).toBeNull();

    try {
      // GIVEN: one online session loads the anniversary, which saves the copy.
      const settingsRead = interceptNetworkCall({ method: 'GET', url: ANNIVERSARIES_READ });
      await page.goto('/settings');
      const loaded = await settingsRead;
      expect(loaded.status).toBe(200);
      expect(loaded.responseJson).toEqual([expect.objectContaining({ label })]);
      await expect(page.getByText(label)).toBeVisible();
      await recurseUntil(
        () => savedAnniversaryLabels(page),
        (v) => {
          expect(v).toEqual([label]);
        }
      );

      // WHEN: the app opens again with the server unreachable, then offline.
      // playwright-utils deviation: the route must be installed before the next navigation and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route('**/rest/v1/anniversaries**', (route) => route.abort());
      await page.reload();
      // Settings is a lazy view: going offline before its module has loaded
      // fails the import and shows the offline error screen instead.
      await expect(page.getByTestId('settings-view')).toBeVisible();
      await goOffline(page, true);

      // THEN: the anniversary is still listed — from the copy, since the
      // device-global blob no longer holds any.
      await navigateTo(page, 'settings');
      await expect(page.getByText(label)).toBeVisible();
      const blob = await page.evaluate(() => localStorage.getItem('my-love-storage') ?? '');
      expect(blob).not.toContain(label);
    } finally {
      await page.context().setOffline(false);
      await page.unroute('**/rest/v1/anniversaries**');
      await clear({ soft: true });
    }
  });

  test('a favorite added on the server while offline appears after reconnect', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const favoritesRead = () => interceptNetworkCall({ method: 'GET', url: FAVORITES_READ });
    await page.goto('/');
    const userId = await signedInUserId(page);
    // This worker account's own rows only: a custom message could win today's
    // rotation, and a leftover favorite would open on "Remove from favorites".
    // Hard before the test, so it never runs on leftover rows; soft in the
    // teardown, so every table is attempted and the test's own error stands.
    const clear = async ({ soft }: { soft: boolean }) => {
      for (const table of ['message_favorites', 'custom_messages'] as const) {
        const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
        const message = `clearing ${table} for this worker account`;
        (soft ? expect.soft(error, message) : expect(error, message)).toBeNull();
      }
    };
    await clear({ soft: false });

    try {
      // GIVEN: today's bundled message, not a favorite, after a settled refresh.
      const settled = favoritesRead();
      await page.reload();
      expect((await settled).status).toBe(200);
      const favorite = page.getByTestId('message-favorite-button');
      await expect(favorite).toHaveAccessibleName('Add to favorites');
      const messageKey = await page.evaluate(async () => {
        const modulePath = '/src/services/messageFavoritesApi.ts';
        const { bundledMessageKey } = await import(modulePath);
        const current = window.__APP_STORE__!.getState().currentMessage;
        if (!current || current.isCustom) throw new Error('Expected a bundled daily message');
        return bundledMessageKey(current.text) as Promise<string>;
      });

      // WHEN: the device is offline while another device favorites it.
      await goOffline(page, true);
      const { error: insertError } = await supabaseAdmin
        .from('message_favorites')
        .insert({ user_id: userId, message_key: messageKey });
      expect(insertError).toBeNull();
      await expect(favorite).toHaveAccessibleName('Add to favorites');

      // THEN: coming back online refreshes it in, with no reload.
      const refreshed = favoritesRead();
      await goOffline(page, false);
      expect((await refreshed).status).toBe(200);
      await expect(favorite).toHaveAccessibleName('Remove from favorites');
    } finally {
      await page.context().setOffline(false);
      await clear({ soft: true });
    }
  });

  test('a favorite and a custom message from one online session are shown when the server cannot be reached', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    const favoritesRead = () => interceptNetworkCall({ method: 'GET', url: FAVORITES_READ });
    await page.goto('/');
    const userId = await signedInUserId(page);
    const custom = `Offline custom ${testInfo.workerIndex}-${Date.now()}`;
    // Hard before the test, so it never runs on leftover rows; soft in the
    // teardown, so every table is attempted and the test's own error stands.
    const clear = async ({ soft }: { soft: boolean }) => {
      for (const table of ['message_favorites', 'custom_messages'] as const) {
        const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
        const message = `clearing ${table} for this worker account`;
        (soft ? expect.soft(error, message) : expect(error, message)).toBeNull();
      }
    };
    await clear({ soft: false });
    const { error: insertError } = await supabaseAdmin
      .from('custom_messages')
      .insert({ user_id: userId, text: custom, category: 'custom' });
    expect(insertError).toBeNull();

    try {
      // GIVEN: one online session loads the custom message and favorites
      // today's bundled message; both are saved in the account's copy.
      const settled = favoritesRead();
      await page.reload();
      expect((await settled).status).toBe(200);
      const favorite = page.getByTestId('message-favorite-button');
      await expect(favorite).toHaveAccessibleName('Add to favorites');
      const todayId = await page.evaluate(() => window.__APP_STORE__!.getState().currentMessage!.id);
      await favorite.click();
      await expect(favorite).toHaveAccessibleName('Remove from favorites');
      await recurseUntil(
        () => savedMessageData(page),
        (v) => {
          expect(v).toEqual({
            texts: [custom],
            bundledFavoriteIds: [todayId],
          });
        }
      );
      expect(await customRowsInMessagesStore(page)).toBe(0);

      // WHEN: the app opens again with the server unreachable, then offline.
      // playwright-utils deviation: the route must be installed before the next navigation and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route('**/rest/v1/custom_messages**', (route) => route.abort());
      // playwright-utils deviation: the route must be installed before the next navigation and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route('**/rest/v1/message_favorites**', (route) => route.abort());
      await page.reload();
      await expect(page.getByTestId('daily-message')).toBeVisible();
      await goOffline(page, true);

      // THEN: the favorite is still shown — from the copy.
      await expect(favorite).toHaveAccessibleName('Remove from favorites');

      // …and so is the custom message, in the editor. The read is still
      // aborted, so it cannot be awaited. Counted from just before the goto:
      // the cold start's message-data refresh asked the server for the custom
      // messages and was refused, so the row can only come from the copy.
      await goOffline(page, false);
      let abortedCustomReads = 0;
      const countAbortedCustomRead = (request: Request) => {
        if (request.method() === 'GET' && request.url().includes('/rest/v1/custom_messages')) {
          abortedCustomReads += 1;
        }
      };
      page.on('requestfailed', countAbortedCustomRead);
      await page.goto('/admin');
      await recurseUntil(async () => abortedCustomReads, (v) => { expect(v).toBeGreaterThan(0); });
      page.off('requestfailed', countAbortedCustomRead);
      await expect(page.getByTestId('admin-message-row').filter({ hasText: custom })).toBeVisible();
      await goOffline(page, true);
      await expect(page.getByTestId('admin-message-row').filter({ hasText: custom })).toBeVisible();
    } finally {
      await page.context().setOffline(false);
      await page.unroute('**/rest/v1/custom_messages**');
      await page.unroute('**/rest/v1/message_favorites**');
      await clear({ soft: true });
    }
  });
});
