/**
 * E2E: the waiting screen's Nudge button nudges the partner (epic
 * daily-pushes-and-nudge, story 8.8; R2, architecture AD-13, AD-16, AD-17).
 *
 * Two pages on this worker's own pooled pair. The partner opens /daily first
 * (the read writes the partner's zone, so their date is the worker's), then the
 * worker opens it and picks: the waiting card shows an enabled Nudge button.
 *
 *   - Offline, a tap makes no `send_daily_nudge` request, shows the offline
 *     sentence, and no `daily_nudges` row exists.
 *   - Online, a tap makes exactly one request that answers 200, leaves one row
 *     for the pair's day, and disables the button, also after a reload.
 *
 * The slot is read from the row, never guessed from the host clock: the server
 * chose it on the worker's own stored zone. A run that crosses 20:00 or local
 * midnight between the nudge and the reload is the low host-clock flake stories
 * 8.3, 8.6 and 8.7 deferred (DW-535). Nothing here links, unlinks or resets an
 * account; the pair's days (and their nudges) are cleared before the test and
 * again at teardown.
 */
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairDayIds,
  readPairDayWriter,
} from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { closeContext } from '../../support/fixtures/cleanup';
import { goOffline } from '../../support/helpers/offline';
import {
  DAILY_DAY_READ,
  DAILY_NUDGE_SEND,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { trackReads } from '../../support/helpers/request-tracker';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const SEND_DAILY_NUDGE_PATH = '/rest/v1/rpc/send_daily_nudge';
const OFFLINE_SENTENCE = 'You are offline. Your nudge needs a connection to send.';

test.describe('Daily question: nudge the partner', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P0] a nudge is sent once online, refused offline, and stays spent after a reload', async ({
    page,
    browser,
    baseURL,
    supabaseAdmin,
    authOptions,
    partnerUserIdentifier,
    partnerAuthToken,
    interceptNetworkCall,
    cleanup,
  }) => {
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));

    const nudgeRows = async (dayId: string) => {
      const { data, error } = await supabaseAdmin
        .from('daily_nudges')
        .select('id, slot, from_user, to_user')
        .eq('day_id', dayId);
      expect(error, 'the pair day\'s nudges').toBeNull();
      return data ?? [];
    };

    await log.step("The partner opens /daily first, which writes the partner's zone");
    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    // Closed before the clear above runs: the partner's page can still be reading.
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();
    const partnerRead = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/daily');
    expect((await partnerRead).status).toBe(200);

    await log.step('The worker opens /daily and picks: the waiting card has an enabled Nudge');
    const sends = trackReads(page, SEND_DAILY_NUDGE_PATH, 'POST');
    const ownRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.goto('/daily');
    expect((await ownRead).status).toBe(200);
    const dayIds = await readPairDayIds(supabaseAdmin, pair);
    expect(dayIds, 'the pair has exactly one day').toHaveLength(1);
    const [dayId] = dayIds;

    await page.getByTestId('daily-option-this').click();
    const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
    await page.getByTestId('daily-send-pick').click();
    expect((await ownPick).status).toBe(200);
    await expect(page.getByTestId('daily-waiting')).toBeVisible();

    // The day's writer is asked to write tomorrow's question after the pick; its
    // sheet covers the card until it is closed (Escape hides it for this mount).
    if ((await readPairDayWriter(supabaseAdmin, pair)) === pair.userId) {
      await expect(page.getByTestId('daily-write-sheet')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('daily-write-sheet')).toHaveCount(0);
    }
    await expect(page.getByTestId('daily-nudge')).toBeEnabled();

    await log.step('Offline, a tap shows the offline sentence and sends nothing');
    await goOffline(page, true);
    await page.getByTestId('daily-nudge').click();
    await expect(page.getByTestId('daily-nudge-error')).toHaveText(OFFLINE_SENTENCE);
    expect(sends.started(), 'no send_daily_nudge request was made offline').toBe(0);
    expect(await nudgeRows(dayId), 'no nudge row exists').toEqual([]);

    await log.step('Online, one tap sends one request: 200, one row, a disabled button');
    await goOffline(page, false);
    const nudgeSend = interceptNetworkCall({ method: 'POST', url: DAILY_NUDGE_SEND });
    await page.getByTestId('daily-nudge').click();
    expect((await nudgeSend).status).toBe(200);
    await expect(page.getByTestId('daily-nudge')).toBeDisabled();
    await expect(page.getByTestId('daily-nudge-error')).toHaveCount(0);
    expect(sends.started(), 'exactly one send_daily_nudge request').toBe(1);
    const rows = await nudgeRows(dayId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      from_user: pair.userId,
      to_user: pair.partnerId,
      slot: expect.stringMatching(/^(after_pick|evening)$/),
    });

    await log.step('After a reload the button is still disabled');
    const reread = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.reload();
    const rereadAnswer = await reread;
    expect(rereadAnswer.status).toBe(200);
    // The server's own answer says spent, not only the saved copy.
    expect(rereadAnswer.responseJson).toMatchObject({
      status: 'ok',
      snapshot: { nudge: { slot: rows[0].slot, spent: true } },
    });
    await expect(page.getByTestId('daily-waiting')).toBeVisible();
    await expect(page.getByTestId('daily-nudge')).toBeDisabled();
    expect(await nudgeRows(dayId), 'the reload sent no second nudge').toHaveLength(1);
  });
});
