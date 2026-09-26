/**
 * E2E: mood history from the server, partner moods from the local copy
 * (spec-unified-data-storage story 6).
 *
 * 1. Own moods: the `moods` IndexedDB store is filled from the server on start,
 *    so a device with an empty store (a fresh device) shows earlier moods in the
 *    calendar without a month change.
 * 2. Partner moods: once loaded online they are saved as the `partner-moods`
 *    local copy, and the Partner screen lists them offline after a reload —
 *    no "No moods yet" and no "will load when you reconnect" notice.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with the moods REST endpoint aborted, so
 * the session never gets a server answer, and the device then goes offline.
 *
 * Test data: one row per test, seeded for THIS worker's own pair
 * (`resolveOwnPair`, keyed on TEST_WORKER_INDEX) and deleted by id at teardown.
 * No partner is linked or unlinked, no password reset, no shared row nulled.
 */
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { clockAnchor, resolveOwnPair } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import { ownMoodHistoryRead, partnerMoodListRead } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const MOODS_REST = '**/rest/v1/moods*';

/** Local `YYYY-MM-DD`, the key the calendar and the `moods` store use. */
function localISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * An earlier moment inside the anchor's month, so the calendar shows it without
 * a month change: the day before at noon, or just after midnight on the 1st.
 * The caller installs `anchor` as the page clock, so the page's "this month" is
 * the anchor's. Browser and runner share the machine's timezone (no
 * `timezoneId` is set).
 */
function earlierThisMonth(now: Date): Date {
  if (now.getDate() > 1) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 1, 0);
}

/** Every row in the page's `moods` store for the signed-in user. */
async function ownMoodRows(page: Page): Promise<{ date: string; synced: boolean; supabaseId?: string }[]> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return [];
    return new Promise((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve([]);
      open.onsuccess = () => {
        const db = open.result;
        const all = db.transaction('moods').objectStore('moods').getAll();
        all.onsuccess = () => {
          db.close();
          resolve(
            (all.result as { userId: string; date: string; synced: boolean; supabaseId?: string }[])
              .filter((row) => row.userId === userId)
              .map(({ date, synced, supabaseId }) => ({ date, synced, supabaseId }))
          );
        };
        all.onerror = () => {
          db.close();
          resolve([]);
        };
      };
    });
  });
}

/** Empty the page's `moods` store, as on a device that never held these rows. */
async function clearMoodsStore(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('my-love-db');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('moods', 'readwrite');
          tx.objectStore('moods').clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
}

/** Notes in the signed-in account's saved `partner-moods` copy, or `null`. */
async function savedPartnerNotes(page: Page): Promise<string[] | null> {
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
          .get([userId, 'partner-moods']);
        get.onsuccess = () => {
          db.close();
          const value = get.result?.value as { note?: string }[] | undefined;
          resolve(value ? value.map((mood) => mood.note ?? '') : null);
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

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching events-offline-copy.spec.ts.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('Mood history and partner moods offline', () => {
  test('a device with an empty moods store shows earlier server moods in the calendar', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const anchor = clockAnchor();
    const loggedAt = earlierThisMonth(anchor);
    const dateKey = localISO(loggedAt);
    const note = `backfill-e2e-${randomUUID()}`;

    const { data: seeded, error: seedError } = await supabaseAdmin
      .from('moods')
      .insert({
        user_id: userId,
        mood_type: 'grateful',
        mood_types: ['grateful'],
        note,
        created_at: loggedAt.toISOString(),
      })
      .select('id')
      .single();
    expect(seedError).toBeNull();
    const moodId = seeded!.id;

    try {
      // GIVEN: signed in, then the moods store is emptied — a fresh device.
      // The clock survives the reload below, so both loads share one month.
      await page.clock.install({ time: anchor });
      const startBackfill = interceptNetworkCall({ method: 'GET', url: ownMoodHistoryRead(userId) });
      await page.goto('/');
      const started = await startBackfill;
      expect(started.status).toBe(200);
      expect(started.responseJson).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: moodId })])
      );
      await recurseUntil(
        () => page.evaluate(() => window.__APP_STORE__?.getState().userId ?? null),
        (v) => {
          expect(v).toBe(userId);
        }
      );
      // This load's own start backfill must land first, or it could merge after
      // the clear below.
      await recurseUntil(
        async () => (await ownMoodRows(page)).some((row) => row.date === dateKey),
        (v) => {
          expect(v).toBe(true);
        }
      );
      await clearMoodsStore(page);
      expect(await ownMoodRows(page)).toEqual([]);

      // WHEN: the app starts again.
      const reloadBackfill = interceptNetworkCall({ method: 'GET', url: ownMoodHistoryRead(userId) });
      await page.reload();
      const reloaded = await reloadBackfill;
      expect(reloaded.status).toBe(200);
      expect(reloaded.responseJson).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: moodId })])
      );
      await navigateTo(page, 'mood');
      await page.getByTestId('mood-tab-history').click();
      await expect(page.getByTestId('mood-calendar')).toBeVisible();
      // The anchor's month, which the installed clock makes "this month".
      const monthOnScreen =
        `${anchor.toLocaleString('en-US', { month: 'long' })} ${anchor.getFullYear()}`;
      await expect(page.getByTestId('calendar-month-header')).toHaveText(monthOnScreen);

      // THEN: the server mood fills the store and shows on the calendar, in the
      // month on screen, without navigating.
      await expect(page.getByTestId(`calendar-day-${dateKey}`)).toHaveAttribute('data-has-mood', 'true');
      await expect(page.getByTestId('calendar-month-header')).toHaveText(monthOnScreen);
      await recurseUntil(
        async () => (await ownMoodRows(page)).find((row) => row.date === dateKey)?.synced ?? null,
        (v) => {
          expect(v).toBe(true);
        }
      );
    } finally {
      const { error } = await supabaseAdmin.from('moods').delete().eq('id', moodId);
      expect.soft(error).toBeNull();
    }
  });

  test('partner moods loaded online are listed offline after a reload', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { partnerId } = await resolveOwnPair(supabaseAdmin);
    const note = `partner-copy-e2e-${randomUUID()}`;

    const { data: seeded, error: seedError } = await supabaseAdmin
      .from('moods')
      .insert({
        user_id: partnerId,
        mood_type: 'loved',
        mood_types: ['loved'],
        note,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    expect(seedError).toBeNull();
    const moodId = seeded!.id;
    const seededCard = page.getByTestId('partner-mood-card').filter({ hasText: note });

    try {
      // GIVEN: the Partner screen loaded online, which saves the copy.
      const partnerRead = interceptNetworkCall({ method: 'GET', url: partnerMoodListRead(partnerId) });
      await page.goto('/partner');
      const partnerMoods = await partnerRead;
      expect(partnerMoods.status).toBe(200);
      expect(partnerMoods.responseJson).toEqual(
        expect.arrayContaining([expect.objectContaining({ note })])
      );
      await expect(seededCard).toBeVisible();
      await recurseUntil(
        async () => (await savedPartnerNotes(page))?.includes(note) ?? false,
        (v) => {
          expect(v).toBe(true);
        }
      );

      // WHEN: the app reloads without a server answer and the device goes
      // offline, then the Partner screen is opened again with nothing in memory.
      // playwright-utils deviation: the route must be installed before the next navigation and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route(MOODS_REST, (route) => route.abort());
      await page.reload();
      await expect(page.getByTestId('partner-mood-view')).toBeVisible();
      await goOffline(page, true);
      await navigateTo(page, 'home');
      await page.evaluate(() => window.__APP_STORE__!.setState({ partnerMoods: [] }));
      await navigateTo(page, 'partner');

      // THEN: the saved moods are listed, with no empty state and no notice.
      await expect(seededCard).toBeVisible();
      await expect(page.getByTestId('partner-mood-empty-state')).toHaveCount(0);
      await expect(page.getByTestId('partner-mood-offline-notice')).toHaveCount(0);
    } finally {
      await page.context().setOffline(false);
      await page.unroute(MOODS_REST);
      const { error } = await supabaseAdmin.from('moods').delete().eq('id', moodId);
      expect.soft(error).toBeNull();
    }
  });
});
