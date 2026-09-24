/**
 * E2E: the couple's events on the shared local-copy mechanism
 * (spec-unified-data-storage story 5).
 *
 * After one online session, Home and Settings list the saved events offline,
 * with no load-error card: first from this session's own server answer, then,
 * after a reload that cannot reach the events table, from the `events` local
 * copy alone.
 *
 * Test data: one row seeded for THIS worker's own user (`resolveOwnPair`, keyed
 * on TEST_WORKER_INDEX) and deleted by id at teardown. No partner is linked or
 * unlinked, no password reset, no shared row nulled.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairEvents,
  isoDateDaysFromNow,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

/** Unlike any fixed Home testid; slugifies to `event-countdown-offline-copy-e2e`. */
const LABEL = 'Offline Copy E2E';
const HOME_CARD = 'event-countdown-offline-copy-e2e';

/** Labels in the signed-in account's saved `events` copy, or `null`. */
async function savedEventLabels(page: Page): Promise<string[] | null> {
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
          .get([userId, 'events']);
        get.onsuccess = () => {
          db.close();
          const value = get.result?.value as { label: string }[] | undefined;
          resolve(value ? value.map((event) => event.label) : null);
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

function settingsRow(page: Page) {
  return page.locator('[data-testid^="event-row-"]').filter({ hasText: LABEL });
}

async function expectListedOffline(page: Page) {
  await navigateTo(page, 'home');
  await expect(page.getByTestId(HOME_CARD)).toBeVisible();
  await expect(page.getByTestId('events-load-error')).toHaveCount(0);

  await navigateTo(page, 'settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await expect(settingsRow(page)).toBeVisible();
  await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching events-crud.spec.ts.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('Events from the local copy', () => {
  test('events loaded once online are listed offline on Home and in Settings', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);
    const eventId = await seedEvent(supabaseAdmin, {
      userId,
      label: LABEL,
      eventDate: isoDateDaysFromNow(14),
      icon: 'plane',
    });

    try {
      // GIVEN: Home loads online, which saves the copy. Settings is lazy and
      // dev mode has no service worker, so its module is loaded while online.
      await page.goto('/');
      await expect(page.getByTestId(HOME_CARD)).toBeVisible();
      await expect.poll(() => savedEventLabels(page)).toEqual([LABEL]);
      await navigateTo(page, 'settings');
      await expect(settingsRow(page)).toBeVisible();
      await navigateTo(page, 'mood');
      await expect(page.getByTestId('mood-tracker')).toBeVisible();

      // WHEN offline in the same session, returning to Home through the dock.
      await goOffline(page, true);
      // THEN: listed, with no load-error card or banner.
      await expectListedOffline(page);

      // AND: a reload that cannot reach the events table, then offline, shows
      // the saved copy alone — this session never had a server answer.
      await goOffline(page, false);
      await page.route('**/rest/v1/events*', (route) => route.abort());
      // The reload stays on /settings, whose list comes from the copy.
      await page.reload();
      await expect(page.getByTestId('settings-view')).toBeVisible();
      await expect(settingsRow(page)).toBeVisible();
      await navigateTo(page, 'mood');
      await expect(page.getByTestId('mood-tracker')).toBeVisible();
      await goOffline(page, true);
      await expectListedOffline(page);
      expect(await page.evaluate(() => window.__APP_STORE__?.getState().eventsError ?? null)).toBeNull();
    } finally {
      await page.context().setOffline(false);
      await page.unroute('**/rest/v1/events*');
      const { error } = await supabaseAdmin.from('events').delete().eq('id', eventId);
      expect.soft(error).toBeNull();
    }
  });
});
