/**
 * E2E: Mood on the style kit
 *
 * The Mood view at 390x844 in both OS themes, read at the rendered surface:
 * the Playfair title, the kit page / segmented-track / tile colours, no
 * horizontal overflow, the selected tile in `tint` + `accent`, the Timeline and
 * Calendar containers on the kit `card` in dark, and no emoji in any tab's own
 * chrome. The kit colours are `--kit-*` variables that switch under
 * `prefers-color-scheme`, so `emulateMedia` alone flips them.
 */
import { recurseUntil } from '../../support/helpers/recurse';
import { test, expect } from '../../support/merged-fixtures';
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

const KIT_CARD2 = {
  light: 'rgb(246, 238, 242)', // #f6eef2
  dark: 'rgb(28, 34, 48)', // #1c2230
} as const;

const KIT_TINT = {
  light: 'rgb(252, 231, 243)', // #fce7f3
  dark: 'rgba(244, 114, 182, 0.14)',
} as const;

const KIT_ACCENT = {
  light: 'rgb(200, 33, 107)', // #c8216b
  dark: 'rgb(244, 114, 182)', // #f472b6
} as const;

/** User-authored text that may legitimately carry emoji. */
const USER_NOTES = [
  '[data-testid="partner-mood-note"]',
  '[data-testid="mood-note"]',
  '[data-testid="modal-note"]',
].join(', ');

async function openMood(page: Page, colorScheme: Scheme) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/mood');
  await expect(page.getByTestId('mood-tracker')).toBeVisible();
  await expect(page.getByTestId('mood-button-happy')).toBeVisible();
}

/** The Mood view's own text with user notes removed. */
async function chromeText(page: Page): Promise<string> {
  return page.getByTestId('mood-tracker').evaluate((root, notes) => {
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(notes).forEach((el) => el.remove());
    return clone.textContent ?? '';
  }, USER_NOTES);
}

/**
 * Rows in this device's IndexedDB `moods` store, or null until the app has
 * created the database — opening it first would create an empty one ahead of
 * the app's own upgrade.
 */
async function savedMoodCount(page: Page): Promise<number | null> {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(({ name }) => name === 'my-love-db')) return null;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('my-love-db');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const request = db.transaction('moods').objectStore('moods').count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
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

test.describe('Mood on the style kit', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`[P1] should render the Mood title, track and tiles on the kit in ${colorScheme}`, async ({
      page,
    }) => {
      await openMood(page, colorScheme);

      // Title: Playfair Display 600 30px, and the face actually loads.
      const title = page.getByRole('heading', { level: 1, name: 'How are you feeling?' });
      await expect(title).toBeVisible();
      const titleStyle = await title.evaluate((el) => {
        const style = getComputedStyle(el);
        return { family: style.fontFamily, weight: style.fontWeight, size: style.fontSize };
      });
      expect(titleStyle.family).toMatch(/^"?Playfair Display"?/);
      expect(titleStyle.weight).toBe('600');
      expect(titleStyle.size).toBe('30px');
      const playfairFaces = await page.evaluate(async () =>
        (await document.fonts.load('600 30px "Playfair Display"')).map((face) => face.family)
      );
      expect(playfairFaces.length).toBeGreaterThan(0);

      // Page ground, segmented track, unselected tile.
      await expect(page.getByTestId('mood-tracker')).toHaveCSS(
        'background-color',
        KIT_PAGE[colorScheme]
      );
      await expect(page.getByTestId('mood-tabs')).toHaveCSS(
        'background-color',
        KIT_CARD2[colorScheme]
      );
      await expect(page.getByTestId('mood-tab-tracker')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('mood-tab-timeline')).toHaveAttribute('aria-pressed', 'false');

      // All twelve moods stay selectable.
      await expect(page.locator('[data-testid^="mood-button-"]')).toHaveCount(12);

      // An unselected tile sits on the kit card. Each test starts on an empty
      // mood store, so no tile is pre-selected; the first unpressed one serves.
      const unselected = page.locator('[data-testid^="mood-button-"][aria-pressed="false"]').first();
      await expect(unselected).toHaveCSS('background-color', KIT_CARD[colorScheme]);

      await expectNoHorizontalOverflow(page);
    });

    test(`[P1] should show the Timeline and Calendar on the kit card in ${colorScheme}`, async ({
      page,
    }) => {
      await openMood(page, colorScheme);

      await page.getByTestId('mood-tab-timeline').click();
      await expect(page.getByTestId('mood-history-section')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Mood Timeline' })).toBeVisible();
      await expect(page.getByTestId('mood-timeline-card')).toHaveCSS(
        'background-color',
        KIT_CARD[colorScheme]
      );
      await expectNoHorizontalOverflow(page);
      await expect(page.getByTestId('loading-spinner')).toHaveCount(0);
      expect(await chromeText(page)).not.toMatch(/\p{Extended_Pictographic}/u);

      await page.getByTestId('mood-tab-history').click();
      await expect(page.getByTestId('mood-calendar')).toBeVisible();
      await expect(page.getByTestId('mood-calendar')).toHaveCSS(
        'background-color',
        KIT_CARD[colorScheme]
      );
      await expect(page.getByTestId('mood-tab-history')).toHaveAttribute('aria-pressed', 'true');
      await expectNoHorizontalOverflow(page);
      await expect(page.getByTestId('calendar-loading')).toHaveCount(0);
      expect(await chromeText(page)).not.toMatch(/\p{Extended_Pictographic}/u);
    });

    test(`[P1] should select Happy as a tint/accent tile in ${colorScheme}`, async ({
      page,
    }) => {
      await openMood(page, colorScheme);

      // Nothing may pre-select Happy or re-seed the form under the click.
      // MoodTracker re-seeds only from a saved entry for today, whenever a
      // loadMoods reload (mount, or after App's mount sync) swaps `moods`.
      // Saved entries live only in this device's IndexedDB, which is empty in
      // every fresh test context: nothing copies the account's server rows into
      // it, and this test never submits. Assert that precondition at its source
      // rather than branching on the tile, so a late reload has nothing to seed
      // from.
      await recurseUntil(() => savedMoodCount(page), (v) => { expect(v).toBe(0); });
      const happy = page.getByTestId('mood-button-happy');
      await expect(happy).toHaveAttribute('aria-pressed', 'false');

      await happy.click();

      await expect(happy).toHaveAttribute('aria-pressed', 'true');
      await expect(happy).toHaveCSS('background-color', KIT_TINT[colorScheme]);
      await expect(happy).toHaveCSS('color', KIT_ACCENT[colorScheme]);
      const selectedSummary = page.getByTestId('mood-selected-summary');
      await expect(selectedSummary).toBeVisible();
      await expect(selectedSummary).toHaveText(/Selected:.*Happy/);

      expect(await chromeText(page)).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  }
});
