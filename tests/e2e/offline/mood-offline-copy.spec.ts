/**
 * E2E: partner moods from the local copy (spec-unified-data-storage story 6).
 *
 * Once loaded online, partner moods are saved as the `partner-moods` local
 * copy, and the Partner screen lists them offline after a reload -- no "No
 * moods yet" and no "will load when you reconnect" notice.
 *
 * The own-mood-history half (earlier server moods in the calendar on a device
 * with an empty store) went with the mood screen's route in story 6.9; epic 10
 * deletes the code.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with the moods REST endpoint aborted, so
 * the session never gets a server answer, and the device then goes offline.
 *
 * Test data: one row per test, seeded for THIS worker's own pair
 * (`resolveOwnPair`, keyed on TEST_PARALLEL_INDEX) and deleted by id at teardown.
 * No partner is linked or unlinked, no password reset, no shared row nulled.
 */
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { goOffline } from '../../support/helpers/offline';
import { resolveOwnPair } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import { partnerMoodListRead } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { deleteRowById } from '../../support/helpers/teardown';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const MOODS_REST = '**/rest/v1/moods*';

/** Notes in the signed-in account's saved `partner-moods` copy, or `null`. */
async function savedPartnerNotes(page: Page): Promise<string[] | null> {
  const moods = await savedLocalCopy<{ note?: string }[]>(page, 'partner-moods');
  return moods ? moods.map((mood) => mood.note ?? '') : null;
}

test.beforeEach(async ({ page }) => {
  await dismissWelcomeSplash(page);
});

test.describe('Partner moods offline', () => {
  test('[P1] partner moods loaded online are listed offline after a reload', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
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
    cleanup.defer('delete the seeded mood', () => deleteRowById(supabaseAdmin, 'moods', moodId));
    const seededCard = page.getByTestId('partner-mood-card').filter({ hasText: note });

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
  });
});
