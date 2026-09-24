/**
 * E2E: Love Notes on the style kit
 *
 * Love Notes at 390x844 in both OS themes, read at the rendered surface: the
 * partner row replaces the old in-view header (no back arrow), the page ground
 * and composer controls resolve to the kit colours (no light surface left in
 * dark mode), a sent note's bubble shares the Send button's `fill` pink, and
 * the page does not scroll. The kit colours are `--kit-*` variables that switch
 * under `prefers-color-scheme`, so `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';
import type { Locator, Page } from '@playwright/test';

type Scheme = 'light' | 'dark';

const KIT_PAGE = {
  light: 'rgb(253, 244, 247)', // #fdf4f7
  dark: 'rgb(11, 14, 20)', // #0b0e14
} as const;

const KIT_CARD = {
  light: 'rgb(255, 255, 255)', // #ffffff
  dark: 'rgb(20, 25, 37)', // #141925
} as const;

const KIT_CARD2 = {
  light: 'rgb(246, 238, 242)', // #f6eef2
  dark: 'rgb(28, 34, 48)', // #1c2230
} as const;

const KIT_INK = {
  light: 'rgb(31, 36, 48)', // #1f2430
  dark: 'rgb(243, 244, 246)', // #f3f4f6
} as const;

/** `fill` is the same pink in both themes. */
const KIT_FILL = 'rgb(219, 39, 119)'; // #db2777

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

async function openNotes(page: Page, colorScheme: Scheme) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/notes');
  await expect(page.getByTestId('notes-partner-row')).toBeVisible();
  await expect(page.getByLabel(/love note message input/i)).toBeVisible();
}

const background = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe('Love Notes on the style kit', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`[P1] should draw the partner row and kit surfaces without scrolling in ${colorScheme}`, async ({
      page,
    }) => {
      await openNotes(page, colorScheme);

      // The partner row replaces the header bar: no back arrow, and the view
      // title survives only as a visually hidden h1.
      const row = page.getByTestId('notes-partner-row');
      await expect(row).toBeVisible();
      await expect(page.getByRole('button', { name: /go back home/i })).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1, name: /love notes/i })).toBeAttached();

      // Page ground: the view container (the partner row's parent) is `page`.
      const ground = await row.evaluate(
        (el) => getComputedStyle(el.parentElement as Element).backgroundColor
      );
      expect(ground).toBe(KIT_PAGE[colorScheme]);

      // Composer: transparent over the ground, its controls on kit surfaces.
      const input = page.getByLabel(/love note message input/i);
      const composer = await input.evaluate(
        (el) => getComputedStyle(el.parentElement?.parentElement as Element).backgroundColor
      );
      expect(composer).toBe(TRANSPARENT);
      expect(await background(input)).toBe(KIT_CARD[colorScheme]);
      await expect(input).toHaveCSS('color', KIT_INK[colorScheme]);
      expect(await background(page.getByLabel(/attach image/i))).toBe(KIT_CARD2[colorScheme]);
      expect(await background(page.getByLabel(/send message/i))).toBe(KIT_FILL);

      // The composer ends above the dock and the page itself does not scroll.
      const sendBox = await page.getByLabel(/send message/i).boundingBox();
      const dockBox = await page.getByTestId('nav-dock').boundingBox();
      if (!sendBox || !dockBox) throw new Error('[notes-kit.spec] expected composer and dock boxes');
      expect(sendBox.y + sendBox.height).toBeLessThanOrEqual(dockBox.y);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(sideways).toBeLessThanOrEqual(0);

      // iOS zooms the page in when a field under 16px is focused and leaves it
      // zoomed, which lets the whole page be dragged about; and the page must
      // not rubber-band when dragged past its edge.
      await expect(input).toHaveCSS('font-size', '16px');
      await expect(page.locator('html')).toHaveCSS('overscroll-behavior', 'none');
      await expect(page.locator('body')).toHaveCSS('overscroll-behavior', 'none');
    });

    test(`[P1] should fill a sent note's bubble with the Send button's pink in ${colorScheme}`, async ({
      page,
      interceptNetworkCall,
    }) => {
      const notesCall = interceptNetworkCall({ url: '**/rest/v1/love_notes**' });
      await openNotes(page, colorScheme);
      await notesCall;

      const uniqueMessage = `Kit note ${colorScheme} ${Date.now()}`;
      await page.getByLabel(/love note message input/i).fill(uniqueMessage);

      const sendCall = interceptNetworkCall({ method: 'POST', url: '**/rest/v1/love_notes**' });
      await page.getByLabel(/send message/i).click();

      const message = page.getByTestId('love-note-message').filter({ hasText: uniqueMessage });
      await expect(message).toBeVisible();
      const { status } = await sendCall;
      expect(status).toBeLessThan(400);

      // The bubble is the element that directly wraps the text block.
      const bubble = message.getByText(uniqueMessage).locator('xpath=../..');
      const bubbleFill = await background(bubble);
      const sendFill = await background(page.getByLabel(/send message/i));
      expect(bubbleFill).toBe(KIT_FILL);
      expect(sendFill).toBe(bubbleFill);
      await expect(bubble).toHaveCSS('color', 'rgb(255, 255, 255)');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
