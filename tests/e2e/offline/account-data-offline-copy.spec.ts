/**
 * E2E: anniversaries and message favorites on the shared local-copy mechanism.
 *
 * - An anniversary loaded in one online session is shown again when the server
 *   cannot be reached. The persisted blob no longer carries anniversaries, so
 *   what comes back can only be the account's saved local copy.
 * - A favorite added on the server while this device is offline appears after
 *   the connection returns, without a reload (refresh on reconnect).
 *
 * Every server row touched here belongs to this worker's own account.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

async function signedInUserId(page: Page): Promise<string> {
  await expect
    .poll(() => page.evaluate(() => window.__APP_STORE__?.getState().userId ?? null))
    .not.toBeNull();
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

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

test.describe('Account data from the local copy', () => {
  test('an anniversary from one online session is shown when the server cannot be reached', async ({
    page,
    supabaseAdmin,
  }, testInfo) => {
    await page.goto('/');
    const userId = await signedInUserId(page);
    const label = `Offline anniversary ${testInfo.workerIndex}-${Date.now()}`;
    const clear = async () => {
      const { error } = await supabaseAdmin.from('anniversaries').delete().eq('user_id', userId);
      expect(error).toBeNull();
    };
    await clear();
    const { error: insertError } = await supabaseAdmin
      .from('anniversaries')
      .insert({ user_id: userId, event_date: '2024-02-14', label });
    expect(insertError).toBeNull();

    try {
      // GIVEN: one online session loads the anniversary, which saves the copy.
      await page.goto('/settings');
      await expect(page.getByText(label)).toBeVisible();
      await expect.poll(() => savedAnniversaryLabels(page)).toEqual([label]);

      // WHEN: the app opens again with the server unreachable, then offline.
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
      await clear();
    }
  });

  test('a favorite added on the server while offline appears after reconnect', async ({
    page,
    supabaseAdmin,
  }) => {
    const favoritesRead = () =>
      page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/message_favorites') &&
          response.request().method() === 'GET'
      );
    await page.goto('/');
    const userId = await signedInUserId(page);
    // This worker account's own rows only: a custom message could win today's
    // rotation, and a leftover favorite would open on "Remove from favorites".
    const clear = async () => {
      for (const table of ['message_favorites', 'custom_messages'] as const) {
        const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
        expect(error).toBeNull();
      }
    };
    await clear();

    try {
      // GIVEN: today's bundled message, not a favorite, after a settled refresh.
      const settled = favoritesRead();
      await page.reload();
      await settled;
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
      await refreshed;
      await expect(favorite).toHaveAccessibleName('Remove from favorites');
    } finally {
      await page.context().setOffline(false);
      await clear();
    }
  });
});
