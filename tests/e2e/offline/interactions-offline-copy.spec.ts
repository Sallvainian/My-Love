/**
 * E2E: the poke/kiss history on the shared local-copy mechanism
 * (spec-unified-data-storage story 7).
 *
 * 1. History loaded online is saved as the `interactions` local copy, so after
 *    a reload that gets no server answer, offline, the history sheet lists it
 *    and the unviewed badge shows.
 * 2. A poke the partner sent while this device was offline appears after the
 *    `online` event, without a reload: the kind's refresher re-reads the server.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with the interactions REST endpoint
 * aborted, so the session never gets a server answer, and the device then goes
 * offline.
 *
 * Test data: one row per test, a poke from THIS worker's partner to its user
 * (`resolveOwnPair`, keyed on TEST_WORKER_INDEX), deleted by id at teardown.
 * No partner is linked or unlinked, no password reset, no shared row nulled.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import type { TypedSupabaseClient } from '../../support/factories';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const INTERACTIONS_REST = '**/rest/v1/interactions*';

/** Ids in the signed-in account's saved `interactions` copy, or `null`. */
async function savedInteractionIds(page: Page): Promise<string[] | null> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return null;
    return new Promise<string[] | null>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        const get = db
          .transaction('local-copies')
          .objectStore('local-copies')
          .get([userId, 'interactions']);
        get.onsuccess = () => {
          db.close();
          const value = get.result?.value as { id: string }[] | undefined;
          resolve(value ? value.map((row) => row.id) : null);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
  });
}

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

/** A poke from this worker's partner to its user, unviewed. Returns its id. */
async function seedPartnerPoke(supabaseAdmin: TypedSupabaseClient): Promise<string> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  const { data, error } = await supabaseAdmin
    .from('interactions')
    .insert({ type: 'poke', from_user_id: partnerId, to_user_id: userId, viewed: false })
    .select('id')
    .single();
  expect(error).toBeNull();
  return data!.id;
}

async function deleteInteraction(supabaseAdmin: TypedSupabaseClient, id: string | null) {
  if (!id) return;
  const { error } = await supabaseAdmin.from('interactions').delete().eq('id', id);
  expect.soft(error).toBeNull();
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching events-offline-copy.spec.ts.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('Poke and kiss history from the local copy', () => {
  test('history loaded online is listed offline after a reload, with the badge', async ({
    page,
    supabaseAdmin,
  }) => {
    const pokeId = await seedPartnerPoke(supabaseAdmin);

    try {
      // GIVEN: the app starts online; the start refresh loads the history and
      // saves the copy before the sheet is ever opened.
      await page.goto('/partner');
      await expect(page.getByTestId('poke-kiss-interface')).toBeVisible();
      await expect
        .poll(async () => (await savedInteractionIds(page))?.includes(pokeId) ?? false)
        .toBe(true);

      // WHEN: the app reloads without a server answer and the device goes offline.
      let abortedReads = 0;
      await page.route(INTERACTIONS_REST, (route) => {
        abortedReads += 1;
        return route.abort();
      });
      await page.reload();
      await expect(page.getByTestId('poke-kiss-interface')).toBeVisible();
      // The start read really hit the aborted route, so nothing after this
      // point can have come from the server.
      await expect.poll(() => abortedReads).toBeGreaterThan(0);
      await goOffline(page, true);

      // THEN: the badge shows the saved unviewed count…
      await expect(page.getByTestId('notification-badge')).toBeVisible();
      // …and the history sheet lists the saved poke, not "No interactions yet".
      await page.getByTestId('history-button').click();
      const sheet = page.getByTestId('interaction-history-modal');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByTestId(`interaction-${pokeId}`)).toBeVisible();
      await expect(sheet.getByText('No interactions yet')).toHaveCount(0);
    } finally {
      await page.context().setOffline(false);
      await page.unroute(INTERACTIONS_REST);
      await deleteInteraction(supabaseAdmin, pokeId);
    }
  });

  test('a poke sent while offline appears after reconnect without a reload', async ({
    page,
    supabaseAdmin,
  }) => {
    let pokeId: string | null = null;

    try {
      // GIVEN: signed in on the partner screen, history loaded, then offline.
      await page.goto('/partner');
      await expect(page.getByTestId('poke-kiss-interface')).toBeVisible();
      await expect.poll(() => savedInteractionIds(page)).not.toBeNull();
      await goOffline(page, true);

      // WHEN: the partner pokes while this device is offline, then it reconnects.
      pokeId = await seedPartnerPoke(supabaseAdmin);
      const id = pokeId;
      const refreshRead = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' && response.url().includes('/rest/v1/interactions')
      );
      await goOffline(page, false);
      // The reconnect itself re-reads the server (the kind's refresher), and
      // that read carries the poke — so the test does not rest on Realtime,
      // whose socket setOffline may leave open.
      const response = await refreshRead;
      expect(response.ok()).toBe(true);
      const rows = (await response.json()) as { id: string }[];
      expect(rows.map((row) => row.id)).toContain(id);

      // THEN: the poke is in state, the copy and the sheet, with the badge showing.
      await expect
        .poll(() =>
          page.evaluate(
            (wanted) => window.__APP_STORE__?.getState().interactions.some((i) => i.id === wanted) ?? false,
            id
          )
        )
        .toBe(true);
      await expect.poll(async () => (await savedInteractionIds(page))?.includes(id) ?? false).toBe(true);
      await expect(page.getByTestId('notification-badge')).toBeVisible();
      await page.getByTestId('history-button').click();
      await expect(
        page.getByTestId('interaction-history-modal').getByTestId(`interaction-${id}`)
      ).toBeVisible();
    } finally {
      await page.context().setOffline(false);
      await deleteInteraction(supabaseAdmin, pokeId);
    }
  });
});
