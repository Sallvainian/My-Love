/**
 * E2E: the Partner page shows the streak offline from its saved copy (epic
 * streak-and-partner-page, story 7.3; AD-13).
 *
 * 1. A worker pair's Partner page loaded online saves the `daily-streak` copy.
 *    After a reload that gets no streak answer, and then offline, the card
 *    still shows the same held total.
 * 2. With the card up, a later failed streak read (Home, then Partner again)
 *    leaves the card as it was, with no error in its place.
 * 3. With nothing saved and no connection, Partner says the streak needs a
 *    connection and shows no card.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with the `get_couple_streak` endpoint
 * aborted, so the session never gets a server answer, and the device then goes
 * offline. A test visits Partner online before going offline so its lazy chunk
 * is loaded.
 *
 * Accounts: this worker's pooled pair, whose days are cleared before each test
 * and again at teardown. Nothing links, unlinks or resets a pool account.
 */
import { test, expect } from '../../support/merged-fixtures';
import { clearPairDays } from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { abortReads } from '../../support/helpers/abort-reads';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { navigateTo } from '../../support/helpers/navigation';
import { goOffline } from '../../support/helpers/offline';
import { COUPLE_STREAK_READ, SECOND_CONTEXT_READ_TIMEOUT } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const OFFLINE_STREAK_MESSAGE = 'You are offline. The streak needs a connection to load.';

test.describe('Partner: the streak offline from its saved copy', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page, supabaseAdmin, cleanup }) => {
    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await dismissWelcomeSplash(page);
  });

  test('[P1] the streak loaded online is shown offline after a reload', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: Partner loads online and the streak is saved in the copy.
    const read = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/partner');
    expect((await read).status).toBe(200);
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    const held = await page.getByTestId('partner-streak-held').innerText();
    await recurseUntil(
      async () => (await savedLocalCopy<{ held: number }>(page, 'daily-streak'))?.held ?? null,
      (saved) => {
        expect(saved).toBe(Number(held));
      }
    );

    // WHEN: the page reloads without a streak answer and the device goes offline.
    const aborted = await abortReads(page, COUPLE_STREAK_READ);
    await page.reload();
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    // The read really hit the aborted route, so the card came from the copy.
    await recurseUntil(
      async () => aborted.count(),
      (count) => {
        expect(count).toBeGreaterThan(0);
      }
    );
    await goOffline(page, true);

    // THEN: the card still shows the same held total.
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    await expect(page.getByTestId('partner-streak-held')).toHaveText(held);
    await expect(page.getByTestId('partner-streak-error')).toHaveCount(0);
  });

  test('[P1] a failed streak read leaves the card on screen', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: the card is up from an online read.
    const read = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/partner');
    expect((await read).status).toBe(200);
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    const held = await page.getByTestId('partner-streak-held').innerText();

    // WHEN: the streak reads fail, and Partner is opened again from Home.
    const aborted = await abortReads(page, COUPLE_STREAK_READ);
    await navigateTo(page, 'home');
    await expect(page.getByTestId('partner-view')).toHaveCount(0);
    await navigateTo(page, 'partner');
    await recurseUntil(
      async () => aborted.count(),
      (count) => {
        expect(count).toBeGreaterThan(0);
      }
    );

    // THEN: the card stays with the same held total, and no error replaces it.
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    await expect(page.getByTestId('partner-streak-held')).toHaveText(held);
    await expect(page.getByTestId('partner-streak-error')).toHaveCount(0);
  });

  test('[P1] with nothing saved and no connection, Partner says the streak needs one', async ({
    page,
  }) => {
    // GIVEN: a fresh context whose streak reads are all aborted, so nothing is saved.
    const aborted = await abortReads(page, COUPLE_STREAK_READ);
    await page.goto('/partner');
    await expect(page.getByTestId('partner-streak-error')).toBeVisible({
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    expect(aborted.count()).toBeGreaterThan(0);
    await expect(page.getByTestId('partner-streak-card')).toHaveCount(0);
    expect(await savedLocalCopy(page, 'daily-streak')).toBeNull();
    // The partner itself is saved, so Partner opens offline.
    await recurseUntil(
      async () => await savedLocalCopy(page, 'partner'),
      (saved) => {
        expect(saved).not.toBeNull();
      }
    );

    // WHEN: the device goes offline and Partner is opened again from Home.
    await navigateTo(page, 'home');
    await expect(page.getByTestId('partner-view')).toHaveCount(0);
    await goOffline(page, true);
    await navigateTo(page, 'partner');

    // THEN: the error is the needs-a-connection sentence, with no card.
    await expect(page.getByTestId('partner-streak-error')).toHaveText(OFFLINE_STREAK_MESSAGE);
    await expect(page.getByTestId('partner-streak-card')).toHaveCount(0);
  });
});
