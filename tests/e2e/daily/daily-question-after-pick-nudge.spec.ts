/**
 * E2E: right after the first picker's pick the app offers a nudge (epic
 * daily-pushes-and-nudge, story 8.9; R2, architecture AD-13, AD-17).
 *
 * Two pages on this worker's own pooled pair, both open on /daily (the
 * partner's read writes the partner's zone, so their date is the worker's).
 * Whoever is not the day's writer picks first; the day's writer is asked to
 * write tomorrow's question instead and is never also asked to nudge.
 *
 *   - Nudge: one `send_daily_nudge` request answers 200, the sheet closes and
 *     the waiting card's button is disabled, also after a reload (which offers
 *     nothing). The writer who picks second sees no nudge sheet.
 *   - Not now: the sheet closes, no `send_daily_nudge` request is made and the
 *     waiting card's button stays enabled.
 *   - Writer first: the write sheet shows, the nudge sheet never does, also
 *     after the write sheet is closed.
 *
 * The slot is the server's, chosen on the sender's stored zone: a run that
 * crosses 20:00 or local midnight between the nudge and the reload is the low
 * host-clock flake stories 8.3, 8.6, 8.7 and 8.8 deferred for their own specs
 * (DW-535 is story 8.8's entry for `daily-question-nudge.spec.ts`); this spec's
 * entry is in story 8.9's plan `deferred` list. Nothing
 * here links, unlinks or resets an account; the pair's days (and their
 * nudges) are cleared before each test and again at teardown.
 */
import type { Page } from '@playwright/test';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test as base, expect } from '../../support/merged-fixtures';
import { clearPairDays, readPairDayWriter } from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { closeContext } from '../../support/fixtures/cleanup';
import {
  DAILY_DAY_READ,
  DAILY_NUDGE_SEND,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { trackReads } from '../../support/helpers/request-tracker';
import { dismissStreakUp } from '../../support/helpers/streak-up';

const SEND_DAILY_NUDGE_PATH = '/rest/v1/rpc/send_daily_nudge';

type SendTracker = ReturnType<typeof trackReads>;

interface PairSetup {
  /** The page of whichever partner is the day's writer. */
  writerPage: Page;
  /** The page of the other partner, who is not asked to write. */
  otherPage: Page;
  /** `send_daily_nudge` requests started by the writer's page since it first loaded. */
  writerSends: SendTracker;
  /** `send_daily_nudge` requests started by the other partner's page since it first loaded. */
  otherSends: SendTracker;
}

/** `page` opens /daily and the day's read settles with 200. */
async function openDaily(page: Page, method: 'goto' | 'reload'): Promise<void> {
  const read = observeOn({
    page,
    method: 'POST',
    url: DAILY_DAY_READ,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  if (method === 'goto') await page.goto('/daily');
  else await page.reload();
  expect((await read).status).toBe(200);
}

/** `page` picks This and waits for the server to confirm; the waiting card shows. */
async function pickThis(page: Page): Promise<void> {
  await page.getByTestId('daily-option-this').click();
  const sent = observeOn({
    page,
    method: 'POST',
    url: DAILY_PICK_SEND,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  await page.getByTestId('daily-send-pick').click();
  expect((await sent).status).toBe(200);
}

const test = base.extend<{ setup: PairSetup }>({
  setup: async (
    {
      page,
      browser,
      baseURL,
      supabaseAdmin,
      authOptions,
      partnerUserIdentifier,
      partnerAuthToken,
      cleanup,
    },
    use
  ) => {
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

    // Counters first, then the loads they observe.
    const ownSends = trackReads(page, SEND_DAILY_NUDGE_PATH, 'POST');
    const partnerSends = trackReads(partnerPage, SEND_DAILY_NUDGE_PATH, 'POST');

    // The partner opens first: their read writes their zone.
    await openDaily(partnerPage, 'goto');
    await openDaily(page, 'goto');
    await expect(page.getByTestId('daily-question')).toBeVisible();
    await expect(partnerPage.getByTestId('daily-question')).toBeVisible();

    // The day exists now, so its writer is known.
    const workerIsWriter = (await readPairDayWriter(supabaseAdmin, pair)) === pair.userId;
    await use({
      writerPage: workerIsWriter ? page : partnerPage,
      otherPage: workerIsWriter ? partnerPage : page,
      writerSends: workerIsWriter ? ownSends : partnerSends,
      otherSends: workerIsWriter ? partnerSends : ownSends,
    });
  },
});

test.describe('Daily question: the nudge offered right after a pick', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P1] the first picker nudges from the sheet once, and a reload offers nothing', async ({
    setup: { writerPage, otherPage, writerSends, otherSends },
  }) => {
    await log.step('The picker who is not the writer picks first: the nudge sheet shows');
    await pickThis(otherPage);
    const sheet = otherPage.getByTestId('daily-nudge-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Do you want to nudge your partner?');
    await expect(otherPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await expect(otherPage.getByTestId('daily-waiting')).toBeVisible();

    await log.step('Nudge sends one request: 200, the sheet closes, the waiting button greys');
    const nudgeSend = observeOn({
      page: otherPage,
      method: 'POST',
      url: DAILY_NUDGE_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await otherPage.getByTestId('daily-nudge-sheet-send').click();
    expect((await nudgeSend).status).toBe(200);
    await expect(sheet).toHaveCount(0);
    await expect(otherPage.getByTestId('daily-nudge')).toBeDisabled();
    expect(otherSends.started(), 'exactly one send_daily_nudge request').toBe(1);

    await log.step('After a reload there is no sheet, and the button is still disabled');
    await openDaily(otherPage, 'reload');
    await expect(otherPage.getByTestId('daily-waiting')).toBeVisible();
    await expect(otherPage.getByTestId('daily-nudge')).toBeDisabled();
    await expect(sheet).toHaveCount(0);

    await log.step('The writer picks second: no nudge sheet on their page');
    await pickThis(writerPage);
    // The second pick finished the day: the +1 screen shows first, and the
    // write sheet waits behind it.
    await dismissStreakUp(writerPage);
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
    await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);
    await writerPage.keyboard.press('Escape');
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);
    expect(otherSends.started(), 'the first picker still sent exactly one nudge').toBe(1);
    expect(writerSends.started(), "the writer's page sent no nudge").toBe(0);
  });

  test('[P1] Not now sends nothing and leaves the waiting button enabled', async ({
    setup: { otherPage, otherSends },
  }) => {
    await pickThis(otherPage);
    const sheet = otherPage.getByTestId('daily-nudge-sheet');
    await expect(sheet).toBeVisible();

    await otherPage.getByTestId('daily-nudge-sheet-dismiss').click();

    await expect(sheet).toHaveCount(0);
    await expect(otherPage.getByTestId('daily-waiting')).toBeVisible();
    await expect(otherPage.getByTestId('daily-nudge')).toBeEnabled();
    expect(otherSends.started(), 'no send_daily_nudge request was made').toBe(0);
  });

  test("[P1] the writer's pick shows the write sheet and never the nudge sheet, nor does the second picker's", async ({
    setup: { writerPage, otherPage, writerSends, otherSends },
  }) => {
    await pickThis(writerPage);
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
    await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);

    await writerPage.keyboard.press('Escape');

    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await expect(writerPage.getByTestId('daily-waiting')).toBeVisible();
    await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);

    await log.step('The other partner picks second: the reveal, and no nudge sheet or request');
    await pickThis(otherPage);
    // The second pick finished the day: the +1 screen shows first.
    await dismissStreakUp(otherPage);
    await expect(otherPage.getByTestId('daily-reveal')).toBeVisible();
    await expect(otherPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);
    expect(otherSends.started(), 'the second picker sent no nudge').toBe(0);
    expect(writerSends.started(), 'the writer sent no nudge').toBe(0);
  });
});
