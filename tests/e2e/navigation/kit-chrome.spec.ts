/**
 * E2E: Style kit ground and chrome wordmark
 *
 * The page ground and the top-bar wordmark read at the rendered surface, in
 * both OS themes. The ground comes from the stylesheet alone: no script writes
 * a colour or gradient inline on <html> or <body> any more, so the dock being
 * on screen is readiness enough. The kit colours are `--kit-*` variables that
 * switch under `prefers-color-scheme`, so `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';

const PAGE_GROUND = {
  light: 'rgb(253, 244, 247)', // #fdf4f7
  dark: 'rgb(11, 14, 20)', // #0b0e14
} as const;

/** Kit accent. */
const KIT_ACCENT = {
  light: 'rgb(200, 33, 107)', // #c8216b
  dark: 'rgb(244, 114, 182)', // #f472b6
} as const;

/**
 * Kit wordmark type, as computed: `font-lora text-[19px] font-semibold italic`
 * on the "My Love" span in src/components/Navigation/AppNavigation.tsx.
 */
const WORDMARK_TYPE = { style: 'italic', weight: '600', size: '19px' } as const;

test.describe('Style kit chrome', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`[P1] should paint the kit ground and the Lora wordmark in ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await expect(page.getByTestId('nav-dock')).toBeVisible();

      // `@theme inline` compiles `text-accent` to `var(--kit-accent)` directly.
      await expect(page.getByTestId('nav-home')).toHaveCSS('color', KIT_ACCENT[colorScheme]);

      const ground = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return { color: style.backgroundColor, image: style.backgroundImage };
      });
      expect(ground).toEqual({ color: PAGE_GROUND[colorScheme], image: 'none' });

      const wordmark = page.getByTestId('app-wordmark');
      await expect(wordmark).toBeVisible();
      const wordmarkText = wordmark.getByText('My Love', { exact: true });
      await expect(wordmarkText).toBeVisible();

      const type = await wordmarkText.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          family: style.fontFamily,
          style: style.fontStyle,
          weight: style.fontWeight,
          size: style.fontSize,
        };
      });
      expect(type.family).toMatch(/^"?Lora"?/);
      expect(type.style).toBe(WORDMARK_TYPE.style);
      expect(type.weight).toBe(WORDMARK_TYPE.weight);
      expect(type.size).toBe(WORDMARK_TYPE.size);

      // An italic 600 face must actually load: `fonts.check()` is also true when
      // no Lora face exists at all, and `fonts.load()` settles for the nearest
      // weight or an upright face, so the returned faces are checked too.
      const loraFaces = await page.evaluate(
        async (font) =>
          (await document.fonts.load(font)).map((face) => ({
            style: face.style,
            weight: face.weight,
          })),
        `${WORDMARK_TYPE.style} ${WORDMARK_TYPE.weight} ${WORDMARK_TYPE.size} Lora`
      );
      expect(loraFaces).toContainEqual({
        style: WORDMARK_TYPE.style,
        weight: WORDMARK_TYPE.weight,
      });
    });
  }
});
