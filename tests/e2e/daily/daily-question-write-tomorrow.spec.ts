/**
 * E2E: the day's writer is asked to write tomorrow's question (epic
 * daily-question, story 6.8; R3, R4; spine AD-4, AD-13).
 *
 * Two pages on this worker's own pooled pair. Which of the two is the day's
 * writer depends on the date alone, so each test opens `/daily` on both, reads
 * `couple_days.writer` through the admin client and takes the writer's page and
 * the other's from that. The sheet (`daily-write-sheet`) shows only to the
 * writer, after the writer's own pick is confirmed; Send for tomorrow writes a
 * `daily_questions` row; "No thanks" writes the day to the device-state local
 * copy `daily-write-declined` and nothing to the server.
 *
 * Nothing here links, unlinks or resets an account. The pair's days (and the
 * questions written from them) are cleared before each test and again at
 * teardown. Neither test reloads while offline: dev mode has no service worker.
 */
import type { Page } from '@playwright/test';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairDayIds,
  readPairDayWriter,
  readPairWrittenQuestions,
} from '../../support/factories/daily-question';
import { closeContext } from '../../support/fixtures/cleanup';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { goOffline } from '../../support/helpers/offline';
import {
  DAILY_DAY_READ,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
  WRITTEN_QUESTION_SEND,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { trackReads } from '../../support/helpers/request-tracker';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const SUBMIT_WRITTEN_QUESTION_PATH = '/rest/v1/rpc/submit_written_question';

/** `page` opens `/daily` and the day's read settles with 200. */
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

/** The card that shows once the page's own pick is in: the waiting screen or the reveal. */
function pickedCard(page: Page) {
  return page.getByTestId('daily-waiting').or(page.getByTestId('daily-reveal'));
}

/** `page` picks This and waits for the server to confirm. */
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
  await expect(pickedCard(page)).toBeVisible();
}

interface PairSetup {
  pair: Awaited<ReturnType<typeof resolveWorkerPairIds>>;
  dayId: string;
  /** The page of whichever partner is the day's writer. */
  writerPage: Page;
  /** The page of the other partner. */
  otherPage: Page;
}

/**
 * Clears the pair's days, opens `/daily` on both partners' pages and tells
 * which page is the day's writer (the writer depends on the date alone). The
 * partner's context is closed before the days are cleared at teardown.
 */
const writerTest = test.extend<{ setup: PairSetup }>({
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

    await openDaily(page, 'goto');
    await openDaily(partnerPage, 'goto');
    await expect(page.getByTestId('daily-question')).toBeVisible();
    await expect(partnerPage.getByTestId('daily-question')).toBeVisible();

    const [dayId] = await readPairDayIds(supabaseAdmin, pair);
    const writerId = await readPairDayWriter(supabaseAdmin, pair);
    const workerIsWriter = writerId === pair.userId;
    await use({
      pair,
      dayId,
      writerPage: workerIsWriter ? page : partnerPage,
      otherPage: workerIsWriter ? partnerPage : page,
    });
  },
});

writerTest.describe('Daily question: write tomorrow', () => {
  writerTest.describe.configure({ timeout: 120_000 });

  writerTest('[P0] only the writer is asked, after their pick, and again after a reload', async ({
    setup: { writerPage, otherPage },
  }) => {
    await log.step('The non-writer picks and never sees the sheet');
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await pickThis(otherPage);
    await expect(otherPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);

    await log.step('The writer picks and the sheet shows right after');
    await pickThis(writerPage);
    const sheet = writerPage.getByTestId('daily-write-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Write tomorrow's question?");
    await expect(otherPage.getByTestId('daily-write-sheet')).toHaveCount(0);

    await log.step("A reload of the writer's page asks again");
    await openDaily(writerPage, 'reload');
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
  });

  writerTest('[P1] a tap on the scrim hides the sheet until the next open', async ({
    setup: { writerPage },
  }) => {
    await pickThis(writerPage);
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();

    await writerPage.getByTestId('daily-write-sheet').click({ position: { x: 5, y: 5 } });
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);

    await openDaily(writerPage, 'reload');
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
  });

  writerTest('[P0] a valid Send writes one question and the sheet never returns', async ({
    supabaseAdmin,
    setup: { pair, dayId, writerPage },
  }) => {
    await pickThis(writerPage);
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();

    await log.step('The writer sends Beach / Mountains');
    await writerPage.getByTestId('daily-write-this').fill(' Beach ');
    await writerPage.getByTestId('daily-write-that').fill('Mountains');
    await expect(writerPage.getByTestId('daily-write-preview')).toHaveText('Beach or Mountains?');
    const sent = observeOn({
      page: writerPage,
      method: 'POST',
      url: WRITTEN_QUESTION_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await writerPage.getByTestId('daily-write-send').click();
    expect((await sent).status).toBe(200);
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);

    const written = await readPairWrittenQuestions(supabaseAdmin, pair);
    expect(written).toEqual([{ this_text: 'Beach', that_text: 'Mountains', source_day_id: dayId }]);

    await log.step('After a reload the sheet does not return');
    await openDaily(writerPage, 'reload');
    await expect(pickedCard(writerPage)).toBeVisible();
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
  });

  writerTest('[P0] No thanks saves the day on the device and sends nothing', async ({
    setup: { dayId, writerPage },
  }) => {
    const writes = trackReads(writerPage, SUBMIT_WRITTEN_QUESTION_PATH, 'POST');

    await pickThis(writerPage);
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();

    await writerPage.getByTestId('daily-write-decline').click();
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    expect(writes.started(), 'No thanks makes no request').toBe(0);
    await recurseUntil(
      () => savedLocalCopy<string[]>(writerPage, 'daily-write-declined'),
      (saved) => {
        expect(saved).toEqual([dayId]);
      }
    );

    await openDaily(writerPage, 'reload');
    await expect(pickedCard(writerPage)).toBeVisible();
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    expect(writes.started(), 'still no request after the reload').toBe(0);
  });

  writerTest('[P1] offline, Send makes no request and says it needs a connection', async ({
    supabaseAdmin,
    setup: { pair, writerPage },
  }) => {
    const writes = trackReads(writerPage, SUBMIT_WRITTEN_QUESTION_PATH, 'POST');

    await pickThis(writerPage);
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
    await writerPage.getByTestId('daily-write-this').fill('Beach');
    await writerPage.getByTestId('daily-write-that').fill('Mountains');

    await goOffline(writerPage, true);
    await writerPage.getByTestId('daily-write-send').click();

    await expect(writerPage.getByTestId('daily-write-error')).toHaveText(
      "You are offline. Tomorrow's question needs a connection to send."
    );
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
    expect(writes.started(), 'an offline Send makes no request').toBe(0);
    expect(await readPairWrittenQuestions(supabaseAdmin, pair)).toEqual([]);
    await goOffline(writerPage, false);
  });
});

writerTest.describe(
  'Daily question: write tomorrow, refused by the server',
  // The server's 400 for two options that match is the point of the test;
  // without this the network monitor fails it on that very response.
  { annotation: [{ type: 'skipNetworkMonitoring' }] },
  () => {
    writerTest.describe.configure({ timeout: 120_000 });

    writerTest('[P0] Tea / tea is refused: the reason shows and nothing is written', async ({
      supabaseAdmin,
      setup: { pair, writerPage },
    }) => {
      await pickThis(writerPage);
      await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();

      await writerPage.getByTestId('daily-write-this').fill('Tea');
      await writerPage.getByTestId('daily-write-that').fill('tea');
      const refused = observeOn({
        page: writerPage,
        method: 'POST',
        url: WRITTEN_QUESTION_SEND,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await writerPage.getByTestId('daily-write-send').click();

      expect((await refused).status).toBe(400);
      await expect(writerPage.getByTestId('daily-write-error')).toContainText(
        'The two options must differ'
      );
      await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
      expect(await readPairWrittenQuestions(supabaseAdmin, pair)).toEqual([]);
    });
  }
);
