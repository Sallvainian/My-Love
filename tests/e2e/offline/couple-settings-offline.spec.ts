/**
 * E2E: the couple's shared start date (`public.couple_settings`) on the shared
 * local-copy mechanism (spec-unified-data-storage story 3).
 *
 * - After one online session the start date is shown on Home and in Settings
 *   when the server cannot be reached, from the `couple-settings` local copy.
 * - Offline, an edit is refused with the "needs a connection" message, and
 *   neither the copy, the store nor the server row changes.
 *
 * The couple row touched here is this worker's own pair's (the pair is linked
 * once by global setup); nothing links, unlinks or touches another pair.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import { COUPLE_SETTINGS_READ } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import type { TypedSupabaseClient } from '../../support/factories';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const DAY_MS = 24 * 60 * 60 * 1000;

function orderedPair(a: string, b: string) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

async function setPairStart(
  supabaseAdmin: TypedSupabaseClient,
  pair: { user_a: string; user_b: string },
  relationshipStart: string | null
) {
  const { error } = await supabaseAdmin
    .from('couple_settings')
    .upsert(
      { ...pair, relationship_start: relationshipStart, updated_at: new Date().toISOString() },
      { onConflict: 'user_a,user_b' }
    );
  expect(error).toBeNull();
}

async function clearPair(
  supabaseAdmin: TypedSupabaseClient,
  pair: { user_a: string; user_b: string }
) {
  const { error } = await supabaseAdmin
    .from('couple_settings')
    .delete()
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b);
  if (error) throw error;
}

/** The signed-in account's saved `couple-settings` copy, or `null`. */
async function savedCoupleCopy(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return null;
    return new Promise<unknown>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        const get = db
          .transaction('local-copies')
          .objectStore('local-copies')
          .get([userId, 'couple-settings']);
        get.onsuccess = () => {
          db.close();
          resolve(get.result?.value ?? null);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
  });
}

async function storeStart(page: Page): Promise<string | null | undefined> {
  return page.evaluate(() => {
    const couple = window.__APP_STORE__?.getState().coupleSettings;
    return couple?.status === 'linked' ? couple.relationshipStart : undefined;
  });
}

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

/** The instant as the browser's local `YYYY-MM-DD`, which the date input shows. */
async function localDateOf(page: Page, iso: string): Promise<string> {
  return page.evaluate((value) => {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, iso);
}

test.describe('Couple start date from the local copy', () => {
  test('[P1] the start date from one online session is shown when the server cannot be reached', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const pair = orderedPair(userId, partnerId);
    // Ten days and an hour ago: Home reads "10 days" whatever the clock says.
    const start = new Date(Date.now() - 10 * DAY_MS - 60 * 60 * 1000);
    start.setSeconds(0, 0);
    const startIso = start.toISOString();
    cleanup.defer("delete the pair's couple settings", () => clearPair(supabaseAdmin, pair));
    await setPairStart(supabaseAdmin, pair, startIso);

    // GIVEN: one online session loads the date, which saves the copy.
    const coupleRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
    await page.goto('/');
    expect((await coupleRead).status).toBe(200);
    await recurseUntil(() => storeStart(page), (v) => { expect(v).toBe(startIso); });
    await recurseUntil(
      () => savedCoupleCopy(page),
      (v) => {
        expect(v).toEqual({
          status: 'linked',
          partnerId,
          relationshipStart: startIso,
          weddingDate: null,
        });
      }
    );
    await expect(page.getByTestId('time-together')).toContainText('10 days');

    // WHEN: the app opens again with the table unreachable, then offline.
    // Settings is lazy and dev mode has no service worker, so its module is
    // loaded while still online.
    // playwright-utils deviation: the route must be installed before the next navigation and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/couple_settings**', (route) => route.abort());
    await page.reload();
    await expect(page.getByTestId('app-container')).toBeVisible();
    await navigateTo(page, 'settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await goOffline(page, true);

    // THEN: Settings shows the saved date, and Home counts from it.
    await expect(page.getByTestId('settings-together-since-date')).toHaveValue(
      await localDateOf(page, startIso)
    );

    await navigateTo(page, 'home');
    const card = page.getByTestId('time-together');
    await expect(card).toContainText('10 days');
    await expect(card).toContainText(/\d{2}h \d{2}m \d{2}s/);
    await expect(card).not.toContainText('Set your start date in Settings');

    // The device-global blob never holds it: it came from the copy.
    const blob = await page.evaluate(() => localStorage.getItem('my-love-storage') ?? '');
    expect(blob).not.toContain(startIso);
  });

  test('[P1] an offline edit is refused with a needs-a-connection message and changes nothing', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const pair = orderedPair(userId, partnerId);
    const start = new Date(Date.now() - 40 * DAY_MS);
    start.setSeconds(0, 0);
    const startIso = start.toISOString();
    cleanup.defer("delete the pair's couple settings", () => clearPair(supabaseAdmin, pair));
    await setPairStart(supabaseAdmin, pair, startIso);

    const coupleRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
    await page.goto('/settings');
    expect((await coupleRead).status).toBe(200);
    await recurseUntil(() => storeStart(page), (v) => { expect(v).toBe(startIso); });
    const dateInput = page.getByTestId('settings-together-since-date');
    await expect(dateInput).toHaveValue(await localDateOf(page, startIso));

    await goOffline(page, true);
    await dateInput.fill('2020-02-02');
    await page.getByTestId('settings-together-since-save').click();

    await expect(page.getByTestId('settings-together-since-error')).toContainText(
      /need a connection/i
    );
    // Store, copy and server all still hold the saved date.
    expect(await storeStart(page)).toBe(startIso);
    await recurseUntil(
      () => savedCoupleCopy(page),
      (v) => {
        expect(v).toEqual({
          status: 'linked',
          partnerId,
          relationshipStart: startIso,
          weddingDate: null,
        });
      }
    );
    const { data, error } = await supabaseAdmin
      .from('couple_settings')
      .select('relationship_start')
      .eq('user_a', pair.user_a)
      .eq('user_b', pair.user_b)
      .single();
    expect(error).toBeNull();
    expect(new Date(data!.relationship_start!).toISOString()).toBe(startIso);
  });
});
