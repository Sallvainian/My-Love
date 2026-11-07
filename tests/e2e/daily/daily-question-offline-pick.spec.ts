/**
 * E2E: a pick made offline is sent when the connection returns (epic
 * daily-question, story 6.7; R17, architecture AD-12, AD-6).
 *
 * 1. Two pages on this worker's own pooled pair, both open on /daily with their
 *    partner channel joined and every `get_daily_day` read settled. The partner
 *    sends That. The worker's page goes offline and sends This: no
 *    `submit_daily_pick` request is made, the page shows the own pick, "Waiting
 *    for a connection to send your pick.", "has picked" and no reveal, and the
 *    `pick-queue` holds one row for the day. Back online, one
 *    `submit_daily_pick` answers 200 carrying the row's `picked_at`, the worker
 *    sees the reveal ("Different picks"), the queue empties, and the partner's
 *    open page shows the reveal without a reload.
 * 2. The worker alone queues a pick offline; the admin client then moves the
 *    day's `created_at` 10 minutes ahead, so the queued `picked_at` falls before
 *    the five-minute window. Back online the server refuses with `DQ002`, the
 *    page shows the failure with the options and Send my pick again, and the row
 *    is `failed`. There is no page clock and no faked response.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline; neither test reloads. Listeners and request trackers are attached
 * before the navigation they observe. Nothing here links, unlinks or resets an
 * account; the pair's days are cleared before each test and again at teardown.
 */
import type { Page } from '@playwright/test';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairDayIds,
  readPairQuestionTexts,
  setPairDaysCreatedAt,
} from '../../support/factories/daily-question';
import { closeContext } from '../../support/fixtures/cleanup';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { readStore, signedInUserId } from '../../support/helpers/indexed-db';
import { goOffline } from '../../support/helpers/offline';
import {
  DAILY_DAY_BY_ID_READ,
  DAILY_DAY_READ,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { MOOD_SUBSCRIBED_LOG, type ReadTracker, trackReads } from '../../support/helpers/request-tracker';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const GET_DAILY_DAY_PATH = '/rest/v1/rpc/get_daily_day';
const SUBMIT_DAILY_PICK_PATH = '/rest/v1/rpc/submit_daily_pick';

interface QueuedPickRow {
  user_id: string;
  day_id: string;
  choice: 'this' | 'that';
  picked_at: string;
  time_zone: string;
  utc_offset_minutes: number;
  failed: boolean;
  failure: string | null;
}

/** The signed-in account's `pick-queue` rows; a failed read counts as an empty queue. */
async function queuedPicks(page: Page): Promise<QueuedPickRow[]> {
  const userId = await signedInUserId(page);
  if (!userId) return [];
  const rows = await readStore<QueuedPickRow[]>(page, 'pick-queue', {
    op: 'getAll',
    index: 'by-user',
    key: userId,
  }).catch(() => null);
  return rows ?? [];
}

/**
 * Armed before the page loads: the log is printed once, mid-boot. Resolves with
 * the number of `get_daily_day` reads the page had started when the join was
 * logged; the join starts one more read of its own, after that count.
 */
function channelJoined(page: Page, reads: ReadTracker): Promise<number> {
  return page
    .waitForEvent('console', {
      predicate: (message) => MOOD_SUBSCRIBED_LOG.test(message.text()),
      timeout: 30_000,
    })
    .then(() => reads.started());
}

/** Every `get_daily_day` read this page started has settled, the join's own included. */
async function readsSettled(reads: ReadTracker, startedAtJoin: number): Promise<void> {
  await recurseUntil(
    async () => ({ started: reads.started(), inFlight: reads.inFlight() }),
    ({ started, inFlight }) => {
      expect(started, "the join's own read started").toBeGreaterThan(startedAtJoin);
      expect(inFlight, 'no get_daily_day read is in flight').toBe(0);
    },
    { timeout: 15_000 }
  );
}

test.describe('Daily question: an offline pick is sent when the connection returns', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P0] queues offline beside a partner pick, then sends and reveals on reconnect', async ({
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

    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    // Closed before the clear above runs: the partner's page can still be sending.
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();

    await log.step('Both partners open /daily with their channel joined');
    const ownReads = trackReads(page, GET_DAILY_DAY_PATH, 'POST');
    const partnerReads = trackReads(partnerPage, GET_DAILY_DAY_PATH, 'POST');
    const ownSends = trackReads(page, SUBMIT_DAILY_PICK_PATH, 'POST');
    const ownJoined = channelJoined(page, ownReads);
    const partnerJoined = channelJoined(partnerPage, partnerReads);

    const ownRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.goto('/daily');
    expect((await ownRead).status).toBe(200);
    const partnerRead = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/daily');
    expect((await partnerRead).status).toBe(200);
    const [ownStartedAtJoin, partnerStartedAtJoin] = await Promise.all([ownJoined, partnerJoined]);

    const [assigned] = await readPairQuestionTexts(supabaseAdmin, pair);
    await expect(page.getByTestId('daily-question')).toHaveText(assigned);
    await expect(partnerPage.getByTestId('daily-question')).toHaveText(assigned);
    const thisText = await page.getByTestId('daily-option-this').innerText();
    await readsSettled(ownReads, ownStartedAtJoin);
    await readsSettled(partnerReads, partnerStartedAtJoin);
    const dayIds = await readPairDayIds(supabaseAdmin, pair);
    expect(dayIds, "the pair has exactly one day").toHaveLength(1);
    const [dayId] = dayIds;

    await log.step('The partner sends That; the worker sees "has picked"');
    const ownReReadOne = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_BY_ID_READ });
    await partnerPage.getByTestId('daily-option-that').click();
    const partnerPick = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_PICK_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.getByTestId('daily-send-pick').click();
    expect((await partnerPick).status).toBe(200);
    expect((await ownReReadOne).status).toBe(200);
    await expect(page.getByTestId('daily-partner-status')).toContainText('has picked');

    await log.step('The worker goes offline and sends This: queued, nothing sent');
    await goOffline(page, true);
    await page.getByTestId('daily-option-this').click();
    await page.getByTestId('daily-send-pick').click();

    await expect(page.getByTestId('daily-pick-queued')).toHaveText(
      'Waiting for a connection to send your pick.'
    );
    await expect(page.getByTestId('daily-my-pick')).toHaveText(thisText);
    await expect(page.getByTestId('daily-partner-status')).toContainText('has picked');
    await expect(page.getByTestId('daily-option-this')).toHaveCount(0);
    await expect(page.getByTestId('daily-send-pick')).toHaveCount(0);
    await expect(page.getByTestId('daily-reveal')).toHaveCount(0);
    expect(ownSends.started(), 'no submit_daily_pick request was made offline').toBe(0);
    const [row] = await recurseUntil(
      () => queuedPicks(page),
      (rows) => {
        expect(rows.map((queued) => queued.day_id)).toEqual([dayId]);
      }
    );
    expect(row).toMatchObject({ choice: 'this', failed: false, failure: null });

    await log.step('The worker goes online: one send, the reveal, an empty queue');
    const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
    const partnerReReadTwo = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_BY_ID_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await goOffline(page, false);

    const sent = await ownPick;
    expect(sent.status).toBe(200);
    expect(sent.requestJson).toMatchObject({
      day_id: dayId,
      choice: 'this',
      picked_at: row.picked_at,
      time_zone: row.time_zone,
      utc_offset_minutes: row.utc_offset_minutes,
    });
    await expect(page.getByTestId('daily-reveal')).toBeVisible();
    await expect(page.getByTestId('daily-reveal-mine')).toHaveText(thisText);
    await expect(page.getByTestId('daily-reveal-mark')).toHaveText('Different picks');
    await expect(page.getByTestId('daily-pick-queued')).toHaveCount(0);
    await recurseUntil(
      () => queuedPicks(page),
      (rows) => {
        expect(rows).toEqual([]);
      }
    );
    expect(ownSends.started(), 'the queued pick was sent exactly once').toBe(1);

    await log.step("The partner's open page shows the reveal with no reload");
    expect((await partnerReReadTwo).status).toBe(200);
    await expect(partnerPage.getByTestId('daily-reveal')).toBeVisible();
    await expect(partnerPage.getByTestId('daily-reveal-mark')).toHaveText('Different picks');
  });
});

test.describe(
  'Daily question: a queued pick the server refuses',
  // The server's DQ002 refusal is the point of the test; without this the
  // network monitor fails it on that very response.
  { annotation: [{ type: 'skipNetworkMonitoring' }] },
  () => {
    test.describe.configure({ timeout: 120_000 });

    test('[P1] a pick sent before the day existed is refused with DQ002 and gives the options back', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
      cleanup,
    }) => {
      const pair = await resolveWorkerPairIds(supabaseAdmin);
      await clearPairDays(supabaseAdmin, pair);
      cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));

      await log.step('The worker opens /daily, goes offline and sends a pick: queued');
      const ownSends = trackReads(page, SUBMIT_DAILY_PICK_PATH, 'POST');
      const ownRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
      await page.goto('/daily');
      expect((await ownRead).status).toBe(200);
      await expect(page.getByTestId('daily-question')).toBeVisible();
      await goOffline(page, true);
      await page.getByTestId('daily-option-that').click();
      await page.getByTestId('daily-send-pick').click();
      await expect(page.getByTestId('daily-pick-queued')).toBeVisible();
      await recurseUntil(
        () => queuedPicks(page),
        (rows) => {
          expect(rows).toHaveLength(1);
        }
      );

      await log.step("The day's created_at moves 10 minutes ahead of the queued pick");
      await setPairDaysCreatedAt(supabaseAdmin, pair, new Date(Date.now() + 10 * 60_000));

      await log.step('The worker goes online: DQ002, the failure shows, the options are back');
      const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
      await goOffline(page, false);

      const refused = await ownPick;
      expect(refused.status).toBe(400);
      expect(refused.responseJson).toMatchObject({ code: 'DQ002' });
      await expect(page.getByTestId('daily-pick-failed')).toBeVisible();
      await expect(page.getByTestId('daily-pick-failed')).toContainText('Your pick could not be sent.');
      await expect(page.getByTestId('daily-pick-queued')).toHaveCount(0);
      await expect(page.getByTestId('daily-option-this')).toBeVisible();
      await expect(page.getByTestId('daily-option-that')).toBeVisible();
      await expect(page.getByTestId('daily-send-pick')).toBeVisible();
      await recurseUntil(
        () => queuedPicks(page),
        (rows) => {
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({ failed: true });
          expect(rows[0].failure).toEqual(expect.any(String));
          expect(rows[0].failure).not.toBe('');
        }
      );
      const [failedRow] = await queuedPicks(page);
      await expect(page.getByTestId('daily-pick-failed')).toContainText(failedRow.failure ?? '');
      expect(ownSends.started(), 'the refused pick was sent exactly once').toBe(1);
    });
  }
);
