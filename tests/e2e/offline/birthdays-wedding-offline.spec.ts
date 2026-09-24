/**
 * E2E: birthdays and the wedding date on the shared local-copy mechanism
 * (spec-unified-data-storage story 4).
 *
 * - After one online session, Home's two birthday cards and the wedding card
 *   show their saved values when the server cannot be reached, from the
 *   `profile`, `partner` and `couple-settings` local copies.
 * - Offline, a birthday edit is refused with the "needs a connection" message,
 *   and neither the store, the copy nor the server row changes.
 *
 * Only this worker's own pair is touched (linked once by global setup);
 * teardown resets only this pair's own `birthday` columns and `wedding_date`.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import type { TypedSupabaseClient } from '../../support/factories';
import { resolveOwnPair } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

function orderedPair(a: string, b: string) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

/** A local `YYYY-MM-DD` `days` from today, `yearsBack` years ago; never 29 Feb. */
function localDateIn(days: number, yearsBack = 0): string {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  if (d.getMonth() === 1 && d.getDate() === 29) d = new Date(d.getFullYear(), 2, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear() - yearsBack}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function setValues(
  supabaseAdmin: TypedSupabaseClient,
  ids: { userId: string; partnerId: string },
  values: { own: string | null; partner: string | null; wedding: string | null }
): Promise<void> {
  const own = await supabaseAdmin.from('users').update({ birthday: values.own }).eq('id', ids.userId);
  expect(own.error).toBeNull();
  const partner = await supabaseAdmin
    .from('users')
    .update({ birthday: values.partner })
    .eq('id', ids.partnerId);
  expect(partner.error).toBeNull();
  const couple = await supabaseAdmin
    .from('couple_settings')
    .upsert(
      { ...orderedPair(ids.userId, ids.partnerId), wedding_date: values.wedding },
      { onConflict: 'user_a,user_b' }
    );
  expect(couple.error).toBeNull();
}

async function resetValues(
  supabaseAdmin: TypedSupabaseClient,
  ids: { userId: string; partnerId: string }
): Promise<void> {
  const users = await supabaseAdmin
    .from('users')
    .update({ birthday: null })
    .in('id', [ids.userId, ids.partnerId]);
  expect.soft(users.error).toBeNull();
  const pair = orderedPair(ids.userId, ids.partnerId);
  const couple = await supabaseAdmin
    .from('couple_settings')
    .update({ wedding_date: null })
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b);
  expect.soft(couple.error).toBeNull();
}

/** The signed-in account's saved copy of `kind`, or `null`. */
async function savedCopy(page: Page, kind: string): Promise<unknown> {
  return page.evaluate(async (copyKind) => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return null;
    return new Promise<unknown>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        const get = db.transaction('local-copies').objectStore('local-copies').get([userId, copyKind]);
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
  }, kind);
}

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

test.describe('Birthdays and wedding date from the local copy', () => {
  test('the cards from one online session show when the server cannot be reached', async ({
    page,
    supabaseAdmin,
  }) => {
    const ids = await resolveOwnPair(supabaseAdmin);
    const own = localDateIn(5, 31);
    const partner = localDateIn(10, 30);
    const wedding = localDateIn(40);
    await setValues(supabaseAdmin, ids, { own, partner, wedding });

    try {
      // GIVEN: one online session loads all three, which saves the copies.
      await page.goto('/');
      await expect.poll(() => savedCopy(page, 'profile')).toMatchObject({ birthday: own });
      await expect
        .poll(() => savedCopy(page, 'partner'))
        .toMatchObject({ status: 'linked', partner: { birthday: partner } });
      await expect
        .poll(() => savedCopy(page, 'couple-settings'))
        .toMatchObject({ status: 'linked', weddingDate: wedding });

      // WHEN: the app opens again with the server unreachable, then offline.
      await page.route('**/rest/v1/**', (route) => route.abort());
      await page.reload();
      await expect(page.getByTestId('app-container')).toBeVisible();
      await goOffline(page, true);

      // THEN: all three cards count from the saved values: whole days left,
      // one fewer than the calendar days while the clock carries today's rest.
      await expect(page.getByTestId('birthday-countdown-self').locator('h3')).toHaveText(
        /turns? 31$/
      );
      await expect(page.getByTestId('birthday-countdown-self').locator('h3 + div')).toHaveText(
        '4 days'
      );
      await expect(page.getByTestId('birthday-countdown-partner').locator('h3')).toContainText(
        'turns 30'
      );
      await expect(page.getByTestId('birthday-countdown-partner').locator('h3 + div')).toHaveText(
        '9 days'
      );
      await expect(page.getByTestId('event-countdown-wedding').locator('h3 + div')).toHaveText(
        '39 days'
      );
    } finally {
      await page.context().setOffline(false);
      await page.unroute('**/rest/v1/**');
      await resetValues(supabaseAdmin, ids);
    }
  });

  test('an offline birthday edit is refused with a needs-a-connection message and changes nothing', async ({
    page,
    supabaseAdmin,
  }) => {
    const ids = await resolveOwnPair(supabaseAdmin);
    const own = localDateIn(20, 29);
    await setValues(supabaseAdmin, ids, { own, partner: null, wedding: null });

    try {
      await page.goto('/');
      await navigateTo(page, 'settings');
      const dateInput = page.getByTestId('settings-birthday-date');
      await expect(dateInput).toHaveValue(own);

      await goOffline(page, true);
      await dateInput.fill('1990-02-02');
      await page.getByTestId('settings-birthday-save').click();

      await expect(page.getByTestId('settings-birthday-error')).toContainText(/need a connection/i);
      // Store, copy and server all still hold the saved birthday.
      expect(
        await page.evaluate(() => window.__APP_STORE__?.getState().ownProfile?.birthday)
      ).toBe(own);
      expect(await savedCopy(page, 'profile')).toMatchObject({ birthday: own });
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('birthday')
        .eq('id', ids.userId)
        .single();
      expect(error).toBeNull();
      expect(data!.birthday).toBe(own);
    } finally {
      await page.context().setOffline(false);
      await resetValues(supabaseAdmin, ids);
    }
  });
});
