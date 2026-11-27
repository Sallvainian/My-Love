/**
 * E2E: the waiting screen's Nudge button nudges the partner (epic
 * daily-pushes-and-nudge, story 8.8, and epic-simpler-daily-pushes-and-nudge, story 11.1;
 * R1, architecture AD-13, AD-16, AD-17).
 *
 * Two pages on this worker's own pooled pair. The partner opens /daily first (the
 * read writes the partner's zone, so their date is the worker's), then the worker
 * opens it and picks: the sheet that follows is closed with "Not now" (which ends
 * only the prompt's chance), and the waiting card shows an enabled Nudge button.
 *
 *   - Offline, a tap makes no `send_daily_nudge` request, shows the offline
 *     sentence, and no `daily_nudges` row exists.
 *   - Online, a tap makes exactly one request that answers 200, leaves one row for
 *     the pair's day from the button, and shows the button as sent (greyed), also
 *     after a reload, where the server's own answer says so.
 *
 * Whether the server held the nudge (the partner's clock before 08:00) is read
 * from the row, never guessed from the host clock. A run that would cross local
 * midnight between the nudge and the reload waits past the turn first
 * (`waitClearOfDailyTurns`, which extends the timeout by the wait; DW-535).
 * Nothing here links, unlinks or resets an account; the pair's days (and their
 * nudges) are cleared before the test and again at teardown.
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
import { waitClearOfDailyTurns } from '../../support/helpers/events';
import { closeContext } from '../../support/fixtures/cleanup';
import { closeAfterPickSheet } from '../../support/helpers/after-pick-sheet';
import { goOffline } from '../../support/helpers/offline';
import { observeReadAfterNavigation } from '../../support/helpers/read-after-navigation';
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

  test('[P0] the button\'s nudge is sent once online, refused offline, and stays shown as sent after a reload, though the prompt was closed with Not now', async ({
    page,
    browser,
    baseURL,
    supabaseAdmin,
    authOptions,
    partnerUserIdentifier,
    partnerAuthToken,
    interceptNetworkCall,
    cleanup,
  }, testInfo) => {
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    await waitClearOfDailyTurns(testInfo);
    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));

    const nudgeRows = async (dayId: string) => {
      const { data, error } = await supabaseAdmin
        .from('daily_nudges')
        .select('id, source, held, from_user, to_user')
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

    // The first picker is asked something right after the pick: the day's writer
    // to write tomorrow's question, then everyone whether to nudge. The sheets
    // cover the card until they are closed; Not now ends only the prompt's chance.
    await closeAfterPickSheet(page, (await readPairDayWriter(supabaseAdmin, pair)) === pair.userId);
    await expect(page.getByTestId('daily-nudge')).toBeEnabled();

    await log.step('Offline, a tap shows the offline sentence and sends nothing');
    await goOffline(page, true);
    await page.getByTestId('daily-nudge').click();
    await expect(page.getByTestId('daily-nudge-error')).toHaveText(OFFLINE_SENTENCE);
    expect(sends.started(), 'no send_daily_nudge request was made offline').toBe(0);
    expect(await nudgeRows(dayId), 'no nudge row exists').toEqual([]);

    await log.step('Online, one tap sends one request: 200, one row from the button, the button shown as sent');
    await goOffline(page, false);
    const nudgeSend = interceptNetworkCall({ method: 'POST', url: DAILY_NUDGE_SEND });
    await page.getByTestId('daily-nudge').click();
    expect((await nudgeSend).status).toBe(200);
    await expect(page.getByTestId('daily-nudge')).toBeDisabled();
    await expect(page.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true');
    await expect(page.getByTestId('daily-nudge-error')).toHaveCount(0);
    expect(sends.started(), 'exactly one send_daily_nudge request').toBe(1);
    const rows = await nudgeRows(dayId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      from_user: pair.userId,
      to_user: pair.partnerId,
      source: 'button',
      held: expect.any(Boolean),
    });

    await log.step('After a reload the button still shows as sent');
    // The reconnect above re-reads the day (the `online` refresh and the channel's
    // re-join), and one of those reads can start after this point, only for the
    // reload to cut it off: observe the reloaded page's own read.
    const reread = observeReadAfterNavigation(page, { method: 'POST', url: DAILY_DAY_READ });
    await page.reload();
    const rereadAnswer = await reread;
    expect(rereadAnswer.status).toBe(200);
    // The server's own answer says spent, not only the saved copy.
    expect(rereadAnswer.responseJson).toMatchObject({
      status: 'ok',
      snapshot: { nudges: { prompt_sent: false, button_sent: true } },
    });
    expect(rereadAnswer.responseJson).not.toHaveProperty('snapshot.nudge');
    await expect(page.getByTestId('daily-waiting')).toBeVisible();
    await expect(page.getByTestId('daily-nudge')).toBeDisabled();
    await expect(page.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true');
    await expect(page.getByTestId('daily-nudge-sheet')).toHaveCount(0);
    expect(await nudgeRows(dayId), 'the reload sent no second nudge').toHaveLength(1);
  });
});
