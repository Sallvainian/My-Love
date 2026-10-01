/**
 * E2E: Partner on the style kit
 *
 * The Partner view at 390x844 in both OS themes, read at the rendered surface:
 * no horizontal overflow (the old header row with its text Refresh button and
 * 56px FAB did not fit a phone), the kit page ground, the partner's name as a
 * Playfair title, the three action tiles on the kit card without any prior
 * click, the current mood plus recent rows, no emoji in the view's own chrome,
 * and the history bottom sheet on the kit card. Plus one dark pass over the
 * no-partner connect UI.
 *
 * The partner identity, their moods and the poke/kiss history are stubbed so
 * the content is stable: a ~40-character display name (the long-name row of
 * the story's matrix), three partner mood rows, and one poke sent and one kiss
 * received.
 */
import { randomUUID } from 'node:crypto';
import { resolveOwnPair } from '../../support/helpers/events';
import { INTERACTIONS_READ } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { interceptNetworkCall as fulfillOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { Page } from '@playwright/test';

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

/** User-authored text that may legitimately carry emoji. */
const USER_NOTES = '[data-testid="partner-mood-entry-note"]';

function partnerMoodRows() {
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  return [
    { mood_type: 'loved', mood_types: ['loved', 'sad'], note: 'Thinking of you 💕', hoursAgo: 1 },
    { mood_type: 'happy', mood_types: ['happy'], note: null, hoursAgo: 26 },
    { mood_type: 'tired', mood_types: null, note: 'Long day', hoursAgo: 50 },
  ].map(({ hoursAgo, ...row }) => ({
    id: randomUUID(),
    user_id: PARTNER_ID,
    ...row,
    created_at: at(hoursAgo),
    updated_at: at(hoursAgo),
  }));
}

/** One poke this account sent and one kiss it received, both unviewed. */
function interactionRows(ownUserId: string) {
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  return [
    { from_user_id: ownUserId, to_user_id: PARTNER_ID, type: 'poke', hoursAgo: 2 },
    { from_user_id: PARTNER_ID, to_user_id: ownUserId, type: 'kiss', hoursAgo: 30 },
  ].map(({ hoursAgo, ...row }) => ({
    id: randomUUID(),
    ...row,
    viewed: false,
    created_at: at(hoursAgo),
  }));
}

/**
 * Compared with clientWidth, never a literal 390: a classic (non-overlay)
 * scrollbar narrows clientWidth, and scrollWidth follows it.
 */
async function expectNoHorizontalOverflow(page: Page) {
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

/** The Partner view's own text with user notes removed. */
async function chromeText(page: Page): Promise<string> {
  return page.getByTestId('partner-mood-view').evaluate((root, notes) => {
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(notes).forEach((el) => el.remove());
    return clone.textContent ?? '';
  }, USER_NOTES);
}

/**
 * Open the connected Partner view with the partner's link, profile, requests,
 * moods and the poke/kiss history stubbed, at phone width in `colorScheme`;
 * returns the visible view and the stubbed history rows.
 */
async function openConnectedPartner(page: Page, colorScheme: Scheme, ownUserId: string) {
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
  const moods = fulfillOn({
    page,
    method: 'GET',
    url: '**/rest/v1/moods**',
    fulfillResponse: { status: 200, body: partnerMoodRows() },
    timeout: 15000,
  });
  // The history is read at the signed-in start and again when the sheet opens;
  // the stub stays installed and answers both.
  const interactions = interactionRows(ownUserId);
  const history = fulfillOn({
    page,
    method: 'GET',
    url: INTERACTIONS_READ,
    fulfillResponse: { status: 200, body: interactions },
    timeout: 15000,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/partner');
  await Promise.all([partnerLink, partnerProfile, requests, moods, history]);

  const view = page.getByTestId('partner-mood-view');
  await expect(view).toBeVisible();
  return { view, interactions };
}

test.describe('Partner on the style kit', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  for (const colorScheme of ['light', 'dark'] as const satisfies readonly Scheme[]) {
    test(`[P1] should title the view with the partner's name in Playfair Display on the kit page in ${colorScheme}`, async ({
      page,
      supabaseAdmin,
    }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      const { view } = await openConnectedPartner(page, colorScheme, userId);

      // Title: the partner's name alone, in Playfair Display.
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toHaveText(PARTNER_NAME);
      await expect(title).not.toContainText("'s Moods");
      expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
        /^"?Playfair Display"?/
      );

      // Page ground.
      await expect(view).toHaveCSS('background-color', KIT_PAGE[colorScheme]);
    });

    test(`[P1] should show the current mood and two recent moods in ${colorScheme}`, async ({
      page,
      supabaseAdmin,
    }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      await openConnectedPartner(page, colorScheme, userId);

      // Three stubbed moods: the current card plus two Recent moods rows.
      await expect(page.getByTestId('partner-mood-card')).toHaveCount(3);
      await expect(
        page.getByTestId('partner-mood-list').getByTestId('partner-mood-card')
      ).toHaveCount(2);
    });

    test(`[P1] should keep the refresh button a 44px target beside the long name in ${colorScheme}`, async ({
      page,
      supabaseAdmin,
    }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      await openConnectedPartner(page, colorScheme, userId);

      // The long name wraps inside the row; the refresh button keeps its 44px.
      const refresh = page.getByTestId('partner-mood-refresh-button');
      await expect(refresh).toBeVisible();
      const refreshBox = await refresh.boundingBox();
      expect(refreshBox).not.toBeNull();
      expect(Math.round(refreshBox!.width)).toBe(44);
      expect(Math.round(refreshBox!.height)).toBe(44);
    });

    test(`[P1] should show the three action tiles on the kit card without a click in ${colorScheme}`, async ({
      page,
      supabaseAdmin,
    }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      await openConnectedPartner(page, colorScheme, userId);

      for (const id of ['poke-button', 'kiss-button', 'fart-button']) {
        const tile = page.getByTestId(id);
        await expect(tile).toBeVisible();
        await expect(tile).toHaveCSS('background-color', KIT_CARD[colorScheme]);
      }
    });

    test(`[P1] should not scroll sideways or carry emoji in its own chrome in ${colorScheme}`, async ({
      page,
      supabaseAdmin,
    }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      await openConnectedPartner(page, colorScheme, userId);
      // The stubbed moods are drawn, so their notes are what `chromeText` strips.
      await expect(page.getByTestId('partner-mood-card')).toHaveCount(3);

      await expectNoHorizontalOverflow(page);
      expect(await chromeText(page)).not.toMatch(/\p{Extended_Pictographic}/u);
    });

    test(`[P1] should show the Fart toast on the kit card with no emoji in ${colorScheme}`, async ({
      page,
      supabaseAdmin,
    }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      await openConnectedPartner(page, colorScheme, userId);

      // Fart is local-only (no network): its toast is a kit card with no emoji.
      await page.getByTestId('fart-button').click();
      const toast = page.getByTestId('toast-notification');
      await expect(toast).toHaveText('Fart sent!');
      await expect(toast).toHaveCSS('background-color', KIT_CARD[colorScheme]);
      expect(await toast.textContent()).not.toMatch(/\p{Extended_Pictographic}/u);
      // The full-screen overlay closes itself.
      await expect(page.getByTestId('fart-animation')).toHaveCount(0);
    });

    test(`[P1] should open the History sheet on the kit card inside the viewport in ${colorScheme}`, async ({
      page,
      supabaseAdmin,
    }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      const { interactions } = await openConnectedPartner(page, colorScheme, userId);

      // History opens as a kit sheet that lies inside the viewport. The sheet is
      // fixed, so it never adds to scrollWidth -- its own box is what is checked.
      await page.getByTestId('history-button').click();
      const sheet = page.getByTestId('interaction-history-modal');
      await expect(sheet).toBeVisible();
      // Both stubbed rows are drawn before the sheet's text is read for emoji.
      for (const { id } of interactions) {
        await expect(sheet.getByTestId(`interaction-${id}`)).toBeVisible();
      }
      await expect(sheet).toHaveCSS('background-color', KIT_CARD[colorScheme]);
      const viewportWidth = page.viewportSize()!.width;
      await recurseUntil(
        async () => {
          const box = await sheet.boundingBox();
          return box !== null && box.x >= 0 && box.x + box.width <= viewportWidth;
        },
        (v) => {
          expect(v).toBe(true);
        }
      );
      expect(await sheet.textContent()).not.toMatch(/\p{Extended_Pictographic}/u);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('[P1] should render the connect UI on the kit in dark', async ({ page }) => {
    // Fake only this browser's read of its own link; never unlink worker-pool users.
    // Each stub is awaited after the load that hits it, bounded by a timeout.
    // Standalone, because the `interceptNetworkCall` fixture drops `timeout`.
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

    const view = page.getByTestId('partner-mood-view');
    await expect(view).toBeVisible();
    await expect(page.getByLabel("Your partner's email")).toBeVisible();
    await expect(view).toHaveCSS('background-color', KIT_PAGE.dark);
    await expect(page.getByTestId('partner-search-card')).toHaveCSS(
      'background-color',
      KIT_CARD.dark
    );
    await expectNoHorizontalOverflow(page);
    expect(await chromeText(page)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
