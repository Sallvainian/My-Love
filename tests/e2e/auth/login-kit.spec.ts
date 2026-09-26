/**
 * E2E: Sign in on the style kit (`mockups/SignIn.dc.html`)
 *
 * Signed out at 390x844 in both OS themes, read at the rendered surface: the
 * `login-screen` root on the kit page colour with no gradient (the root, not
 * `body`, which is `bg-page` app-wide and so proves nothing), the form card on
 * the kit card colour, the pink `fill` Sign in button, the Lora wordmark and no
 * horizontal overflow. The kit colours are `--kit-*` variables that switch
 * under `prefers-color-scheme`, so `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';

const KIT_PAGE = {
  light: 'rgb(253, 244, 247)', // #fdf4f7
  dark: 'rgb(11, 14, 20)', // #0b0e14
} as const;

const KIT_CARD = {
  light: 'rgb(255, 255, 255)', // #ffffff
  dark: 'rgb(20, 25, 37)', // #141925
} as const;

const KIT_FIELD = {
  light: 'rgb(251, 247, 249)', // #fbf7f9
  dark: 'rgb(15, 19, 27)', // #0f131b
} as const;

const KIT_CARD2 = {
  light: 'rgb(246, 238, 242)', // #f6eef2
  dark: 'rgb(28, 34, 48)', // #1c2230
} as const;

/** `fill` is the same pink in both themes. */
const KIT_FILL = 'rgb(219, 39, 119)'; // #db2777

test.describe('Sign in on the style kit', () => {
  test.use({ authSessionEnabled: false });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`[P1] should render the Sign in artboard on kit surfaces in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/');

      const root = page.getByTestId('login-screen');
      await expect(root).toBeVisible();
      await expect(root).toHaveCSS('background-color', KIT_PAGE[colorScheme]);
      await expect(root).toHaveCSS('background-image', 'none');

      await expect(page.getByRole('heading', { level: 1, name: 'My Love' })).toBeVisible();
      const wordmark = page.getByTestId('login-wordmark');
      const fontFamily = await wordmark.evaluate((node) => getComputedStyle(node).fontFamily);
      expect(fontFamily).toContain('Lora');
      const tagline = page.getByTestId('login-tagline');
      await expect(tagline).toBeVisible();
      await expect(tagline).toHaveText('Welcome back — sign in to continue');

      const card = page.getByTestId('login-card');
      await expect(card).toHaveCSS('background-color', KIT_CARD[colorScheme]);
      await expect(card).toContainText('Continue with Google');
      await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCSS(
        'background-color',
        KIT_FIELD[colorScheme]
      );
      await expect(page.getByTestId('google-signin-button')).toHaveCSS(
        'background-color',
        KIT_CARD2[colorScheme]
      );

      const submit = page.getByTestId('submit-button');
      await expect(submit).toHaveText('Sign in');
      await expect(submit).toHaveCSS('background-color', KIT_FILL);
      await expect(submit).toHaveCSS('background-image', 'none');

      await expect(page.getByRole('button', { name: 'Contact admin' })).toBeVisible();

      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(widths.scroll).toBe(widths.client);
    });
  }
});
