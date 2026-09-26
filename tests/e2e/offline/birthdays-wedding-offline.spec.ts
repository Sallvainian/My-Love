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
import {
  clockAnchorAvoidingLeapDay,
  isoBirthdayDaysFromNow,
  isoDateDaysFromNow,
  resolveOwnPair,
} from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import {
  COUPLE_SETTINGS_READ,
  OWN_PROFILE_READ,
  PARTNER_RECORD_READ,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

function orderedPair(a: string, b: string) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
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
    interceptNetworkCall,
  }) => {
    const ids = await resolveOwnPair(supabaseAdmin);
    // The day counts below are measured from the page clock, pinned to the
    // anchor the dates are built from; the reload keeps it.
    const anchor = clockAnchorAvoidingLeapDay([5, 10, 40]);
    const own = isoBirthdayDaysFromNow(5, 31, anchor);
    const partner = isoBirthdayDaysFromNow(10, 30, anchor);
    const wedding = isoDateDaysFromNow(40, anchor);
    await setValues(supabaseAdmin, ids, { own, partner, wedding });

    try {
      // GIVEN: one online session loads all three, which saves the copies.
      await page.clock.install({ time: anchor });
      const profileRead = interceptNetworkCall({ method: 'GET', url: OWN_PROFILE_READ });
      const partnerRead = interceptNetworkCall({ method: 'GET', url: PARTNER_RECORD_READ });
      const coupleRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
      await page.goto('/');
      const [profile, partnerRecord, couple] = await Promise.all([
        profileRead,
        partnerRead,
        coupleRead,
      ]);
      expect(profile.status).toBe(200);
      // `maybeSingle` reads come back as a one-row array; `single` as the row.
      expect(profile.responseJson).toEqual([expect.objectContaining({ birthday: own })]);
      expect(partnerRecord.status).toBe(200);
      expect(partnerRecord.responseJson).toMatchObject({ id: ids.partnerId, birthday: partner });
      expect(couple.status).toBe(200);
      expect(couple.responseJson).toEqual([expect.objectContaining({ wedding_date: wedding })]);
      await recurseUntil(
        () => savedCopy(page, 'profile'),
        (v) => {
          expect(v).toMatchObject({ birthday: own });
        }
      );
      await recurseUntil(
        () => savedCopy(page, 'partner'),
        (v) => {
          expect(v).toMatchObject({ status: 'linked', partner: { birthday: partner } });
        }
      );
      await recurseUntil(
        () => savedCopy(page, 'couple-settings'),
        (v) => {
          expect(v).toMatchObject({ status: 'linked', weddingDate: wedding });
        }
      );

      // WHEN: the app opens again with the server unreachable, then offline.
      // playwright-utils deviation: the route must be installed before the next navigation and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
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
    interceptNetworkCall,
  }) => {
    const ids = await resolveOwnPair(supabaseAdmin);
    const own = isoBirthdayDaysFromNow(20, 29, clockAnchorAvoidingLeapDay([20]));
    await setValues(supabaseAdmin, ids, { own, partner: null, wedding: null });

    try {
      const profileRead = interceptNetworkCall({ method: 'GET', url: OWN_PROFILE_READ });
      await page.goto('/');
      const profile = await profileRead;
      expect(profile.status).toBe(200);
      expect(profile.responseJson).toEqual([expect.objectContaining({ birthday: own })]);
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
      await recurseUntil(
        () => savedCopy(page, 'profile'),
        (v) => {
          expect(v).toMatchObject({ birthday: own });
        }
      );
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
