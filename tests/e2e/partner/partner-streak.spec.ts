/**
 * E2E: the Partner page shows the couple's streak (epic streak-and-partner-page,
 * story 7.2).
 *
 * The tracer runs on this worker's own pooled pair, unstubbed: both partners
 * pick today's question on Daily, and each Partner page then shows the server's
 * count, one day answered together and one in a row, in orange, with none of
 * the old mood view (the mood card, the recent moods, the Poke/Kiss/Fart
 * tiles). The pair's days are cleared before the test and again at teardown (a
 * day left behind fixes the picks the next run starts from); nothing here
 * links, unlinks or resets an account.
 *
 * Two kit tests are ported from the old Partner view's spec and stub the
 * partner, its profile and the streak read in this browser only, so the content
 * is stable: a ~40-character display name in Playfair Display on the kit page
 * colour, and the Connect UI in dark.
 */
import { randomUUID } from 'node:crypto';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as fulfillOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { clearPairDays, readPairDayWriter } from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { closeContext } from '../../support/fixtures/cleanup';
import { findLightSurfaces } from '../../support/helpers/light-surfaces';
import { navigateTo } from '../../support/helpers/navigation';
import {
  COUPLE_STREAK_READ,
  DAILY_DAY_READ,
  DAILY_HISTORY_READ,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { dismissStreakUp } from '../../support/helpers/streak-up';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

type Scheme = 'light' | 'dark';

const KIT_PAGE = {
  light: 'rgb(253, 244, 247)', // #fdf4f7
  dark: 'rgb(11, 14, 20)', // #0b0e14
} as const;

const KIT_CARD = {
  light: 'rgb(255, 255, 255)', // #ffffff
  dark: 'rgb(20, 25, 37)', // #141925
} as const;

const PARTNER_ID = randomUUID();
const PARTNER_NAME = 'Harper Evangeline Montgomery-Whitfield';

/** The Partner page's own text must not carry any of the old mood view. */
async function expectNoMoodView(page: Page): Promise<void> {
  await expect(page.getByTestId('partner-mood-card')).toHaveCount(0);
  await expect(page.getByTestId('partner-mood-list')).toHaveCount(0);
  await expect(page.getByTestId('poke-kiss-interface')).toHaveCount(0);
}

/**
 * Compared with clientWidth, never a literal 390: a classic (non-overlay)
 * scrollbar narrows clientWidth, and scrollWidth follows it.
 */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await recurseUntil(
    () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
    (v) => {
      expect(v).toBe(0);
    }
  );
}

/** The Partner view's own text. */
function chromeText(page: Page): Promise<string> {
  return page.getByTestId('partner-view').evaluate((root) => root.textContent ?? '');
}

/** Seven consecutive local dates ending today, `YYYY-MM-DD`, oldest first. */
function lastSevenDates(): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  });
}

/**
 * Open the connected Partner page at phone width in `colorScheme`, with the
 * partner, its profile, the requests and the streak (in `todayState`) faked in
 * this browser only.
 */
async function openStubbedPartner(
  page: Page,
  colorScheme: Scheme,
  todayState: 'grey' | 'orange' | 'blue'
): Promise<void> {
  // Only this browser's reads are faked; no worker-pool row is touched.
  // Each stub is awaited after the load that hits it, bounded by a timeout.
  // Standalone, because the `interceptNetworkCall` fixture drops `timeout`.
  const partnerLink = fulfillOn({
    page,
    method: 'GET',
    url: '**/rest/v1/users?select=partner_id*',
    fulfillResponse: {
      status: 200,
      body: { partner_id: PARTNER_ID, updated_at: '2026-01-01T00:00:00Z' },
    },
    timeout: 15000,
  });
  const partnerProfile = fulfillOn({
    page,
    method: 'GET',
    url: '**/rest/v1/users?select=id*',
    fulfillResponse: {
      status: 200,
      body: { id: PARTNER_ID, email: 'partner@example.test', display_name: PARTNER_NAME },
    },
    timeout: 15000,
  });
  const requests = fulfillOn({
    page,
    method: 'POST',
    url: '**/rest/v1/rpc/get_my_pending_partner_requests',
    fulfillResponse: { status: 200, body: [] },
    timeout: 15000,
  });
  // Done today when orange; a missed day before an open today when blue; so
  // the dark pass sees the check, snowflake and dashed-ring dots.
  const week = lastSevenDates().map((day, index) => ({
    day,
    state:
      index === 4
        ? 'done'
        : index === 5 && todayState === 'blue'
          ? 'missed'
          : index === 6 && todayState === 'orange'
            ? 'done'
            : 'open',
  }));
  const streak = fulfillOn({
    page,
    method: 'POST',
    url: COUPLE_STREAK_READ,
    fulfillResponse: {
      status: 200,
      body: {
        status: 'ok',
        streak: {
          held: 12,
          run: 5,
          today_state: todayState,
          milestones: 0,
          same: 6,
          done: 12,
          missed: 0,
          week,
        },
      },
    },
    timeout: 15000,
  });

  // The past questions are read with the streak; none here.
  const history = fulfillOn({
    page,
    method: 'POST',
    url: DAILY_HISTORY_READ,
    fulfillResponse: { status: 200, body: [] },
    timeout: 15000,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/partner');
  await Promise.all([partnerLink, partnerProfile, requests, streak, history]);
}

test.describe('Partner page streak', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P0] both partners pick on Daily, and each Partner page shows one day answered together', async ({
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
    test.setTimeout(120_000);
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));

    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();
    await dismissWelcomeSplash(partnerPage);

    await log.step('Both partners open Daily');
    const ownRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.goto('/daily');
    expect((await ownRead).status).toBe(200);
    const partnerRead = fulfillOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/daily');
    expect((await partnerRead).status).toBe(200);

    // The day's writer is asked to write tomorrow's question right after their
    // pick, and the sheet would cover the dock: they say "No thanks".
    const writerPage =
      (await readPairDayWriter(supabaseAdmin, pair)) === pair.userId ? page : partnerPage;

    await log.step('Each picks, and each pick is sent');
    await page.getByTestId('daily-option-this').click();
    const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
    await page.getByTestId('daily-send-pick').click();
    expect((await ownPick).status).toBe(200);
    await expect(page.getByTestId('daily-waiting')).toBeVisible();
    if (writerPage === page) await page.getByTestId('daily-write-decline').click();

    await partnerPage.getByTestId('daily-option-that').click();
    const partnerPick = fulfillOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_PICK_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.getByTestId('daily-send-pick').click();
    expect((await partnerPick).status).toBe(200);
    await expect(partnerPage.getByTestId('daily-reveal')).toBeVisible();
    // The day is finished: the +1 screen shows on both pages (the partner's at once,
    // the worker's when the pick arrives) and covers the dock; the sheet waits behind it.
    await dismissStreakUp(partnerPage);
    if (writerPage === partnerPage) await partnerPage.getByTestId('daily-write-decline').click();
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await dismissStreakUp(page);

    await log.step('Each opens Partner and sees the streak');
    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await navigateTo(page, 'partner');
    expect((await ownStreak).status).toBe(200);
    const partnerStreak = fulfillOn({
      page: partnerPage,
      method: 'POST',
      url: COUPLE_STREAK_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await navigateTo(partnerPage, 'partner');
    expect((await partnerStreak).status).toBe(200);

    for (const view of [page, partnerPage]) {
      const card = view.getByTestId('partner-streak-card');
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('data-state', 'orange');
      await expect(view.getByTestId('partner-streak-held')).toHaveText('1');
      await expect(card).toContainText('day answered together');
      await expect(card).not.toContainText('days answered together');
      await expect(view.getByTestId('partner-streak-run')).toHaveText('1');
      await expect(card).toContainText('in a row');

      const days = view.getByTestId('partner-streak-week').getByTestId('partner-streak-day');
      await expect(days).toHaveCount(7);
      await expect(days.last()).toHaveAttribute('data-state', 'done');
      await expect(days.last()).toContainText('Today');
      await expect(view.getByTestId('partner-streak-next')).toHaveText(
        'Next milestone: 25 days · 24 to go'
      );

      await expect(view.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoMoodView(view);
    }
  });

  for (const colorScheme of ['light', 'dark'] as const satisfies readonly Scheme[]) {
    test(`[P1] should title the page with the partner's name in Playfair Display on the kit page in ${colorScheme}`, async ({
      page,
    }) => {
      await openStubbedPartner(page, colorScheme, 'orange');

      const view = page.getByTestId('partner-view');
      await expect(view).toBeVisible();

      // Title: the partner's name alone, in Playfair Display.
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toHaveText(PARTNER_NAME);
      expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
        /^"?Playfair Display"?/
      );

      // Page ground, and the card stub as served.
      await expect(view).toHaveCSS('background-color', KIT_PAGE[colorScheme]);
      await expect(page.getByTestId('partner-streak-held')).toHaveText('12');
      await expect(page.getByTestId('partner-streak-card')).toContainText('days answered together');

      await expectNoHorizontalOverflow(page);
      await expectNoMoodView(page);
      expect(await chromeText(page)).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  }

  for (const todayState of ['orange', 'blue'] as const) {
    test(`[P1] should paint no opaque light surface inside the ${todayState} streak card in dark`, async ({
      page,
    }) => {
      await openStubbedPartner(page, 'dark', todayState);

      await expect(page.getByTestId('partner-streak-card')).toHaveAttribute(
        'data-state',
        todayState
      );
      const surfaces = await findLightSurfaces(page, 'partner-streak-card');
      expect(
        surfaces,
        `light surfaces in the ${todayState} card in dark:\n` +
          surfaces.map((s) => `${s.element} -> ${s.background} (L=${s.luminance})`).join('\n')
      ).toEqual([]);
    });
  }

  test('[P1] should render the connect UI on the kit in dark', async ({ page }) => {
    // Fake only this browser's read of its own link; never unlink worker-pool users.
    const partnerLink = fulfillOn({
      page,
      method: 'GET',
      url: '**/rest/v1/users?select=partner_id*',
      fulfillResponse: {
        status: 200,
        body: { partner_id: null, updated_at: '2026-01-01T00:00:00Z' },
      },
      timeout: 15000,
    });
    const requests = fulfillOn({
      page,
      method: 'POST',
      url: '**/rest/v1/rpc/get_my_pending_partner_requests',
      fulfillResponse: { status: 200, body: [] },
      timeout: 15000,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/partner');
    await Promise.all([partnerLink, requests]);

    const view = page.getByTestId('partner-view');
    await expect(view).toBeVisible();
    await expect(page.getByLabel("Your partner's email")).toBeVisible();
    await expect(view).toHaveCSS('background-color', KIT_PAGE.dark);
    await expect(page.getByTestId('partner-search-card')).toHaveCSS(
      'background-color',
      KIT_CARD.dark
    );
    await expect(page.getByTestId('partner-streak-card')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    expect(await chromeText(page)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
