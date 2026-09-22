/**
 * E2E: Style kit ground and chrome wordmark
 *
 * The page ground and the top-bar wordmark read at the rendered surface, in
 * both OS themes. The ground is checked only after `applyTheme()` has run
 * (it sets `--color-primary` on <html>): it used to paint the theme gradient
 * inline on <body>, over any CSS ground, so asserting before it runs would pass
 * even with that write restored. The kit colours are `--kit-*` variables that
 * switch under `prefers-color-scheme`, so `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';

const PAGE_GROUND = {
  light: 'rgb(253, 244, 247)', // #fdf4f7
  dark: 'rgb(11, 14, 20)', // #0b0e14
} as const;

/** Kit accent; the sunset theme's inline `--color-accent` is #FFD700. */
const KIT_ACCENT = {
  light: 'rgb(200, 33, 107)', // #c8216b
  dark: 'rgb(244, 114, 182)', // #f472b6
} as const;

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

      // Settings hydrated and applyTheme() ran.
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.style.getPropertyValue('--color-primary').trim()
          )
        )
        .not.toBe('');

      // `@theme inline` keeps `text-accent` on `--kit-accent`, out of reach of
      // applyTheme()'s inline `--color-accent`.
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
      expect(type.style).toBe('italic');
      expect(type.weight).toBe('600');
      expect(type.size).toBe('19px');

      // An italic 600 face must actually load: `fonts.check()` is also true when
      // no Lora face exists at all, and `fonts.load()` settles for the nearest
      // weight or an upright face, so the returned faces are checked too.
      const loraFaces = await page.evaluate(async () =>
        (await document.fonts.load('italic 600 19px Lora')).map((face) => ({
          style: face.style,
          weight: face.weight,
        }))
      );
      expect(loraFaces).toContainEqual({ style: 'italic', weight: '600' });
    });
  }
});
