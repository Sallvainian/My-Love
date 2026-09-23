/**
 * E2E: Theme sweep over every screen
 *
 * Every screen at 390x844 in both OS themes: a full-page screenshot attached
 * to the report (14 in all, for a human to eyeball) and the page ground read
 * from <body>. In dark, two checks that need no eyeballing: no visible element
 * inside the viewport paints an opaque light surface (a leftover white card, a
 * pale-pink panel or the pre-kit glass), and no element's computed font is
 * Dancing Script.
 *
 * "Light surface" is measured: a background at alpha >= .5 with relative
 * luminance > .4. Every kit dark surface is below .02, the kit `fill` pink
 * (#db2777) is about .2, and black scrims are 0, so all pass; white, the kit's
 * light `page`/`card2` values and pale pinks fail. Colours are resolved through
 * a canvas, so oklch/oklab/color-mix computed values are read as the sRGB the
 * screen shows. Media elements are skipped, as are elements hidden by opacity
 * or visibility, and indicator dots no larger than 12x12px: the kit `good`
 * status dot (#4ade80, L about .55) is an 8px "Connected" light, not a
 * surface. A size floor rather than a colour allowlist, so a full-size panel
 * in a light kit colour (`bg-ink`, `bg-good`) still fails.
 *
 * Photos may be the empty state on the test account; either state is a valid
 * screen.
 */
import { test, expect } from '../../support/merged-fixtures';
import type { Page } from '@playwright/test';
import { navigateTo, type NavDestination } from '../../support/helpers/navigation';

type Scheme = 'light' | 'dark';

const SCHEMES = ['light', 'dark'] as const satisfies readonly Scheme[];

const PAGE_GROUND: Record<Scheme, string> = {
  light: 'rgb(253, 244, 247)', // #fdf4f7
  dark: 'rgb(11, 14, 20)', // #0b0e14
};

interface Screen {
  view: NavDestination;
  /** Resolves once the view has rendered past its first loading frame. */
  ready: (page: Page) => Promise<void>;
}

const SIGNED_IN_SCREENS: Screen[] = [
  {
    view: 'home',
    ready: async (page) => {
      await expect(page.getByTestId('time-together')).toBeVisible();
      await expect(page.getByTestId('message-text')).toBeVisible();
    },
  },
  {
    view: 'mood',
    ready: async (page) => {
      await expect(page.getByTestId('mood-tracker')).toBeVisible();
      await expect(page.getByTestId('mood-button-happy')).toBeVisible();
    },
  },
  {
    view: 'notes',
    ready: async (page) => {
      await expect(page.getByTestId('notes-partner-row')).toBeVisible();
      await expect(page.getByLabel(/love note message input/i)).toBeVisible();
    },
  },
  {
    view: 'photos',
    ready: async (page) => {
      // Past the skeleton: the grid, the empty state or the error state.
      await expect(
        page
          .getByTestId('photo-gallery-grid')
          .or(page.getByTestId('photo-gallery-empty-state'))
          .or(page.getByTestId('photo-gallery-error-state'))
      ).toBeVisible();
    },
  },
  {
    view: 'partner',
    ready: async (page) => {
      await expect(page.getByTestId('partner-mood-view')).toBeVisible();
    },
  },
  {
    view: 'settings',
    ready: async (page) => {
      await expect(page.getByTestId('settings-view')).toBeVisible();
      await expect(page.getByTestId('events-settings-loading')).toHaveCount(0);
    },
  },
];

interface LightSurface {
  element: string;
  background: string;
  luminance: number;
}

/** Every in-viewport visible element whose background is an opaque light colour. */
function findLightSurfaces(page: Page): Promise<LightSurface[]> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas unavailable');

    const toRgba = (colour: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };

    const luminance = (r: number, g: number, b: number) => {
      const [lr, lg, lb] = [r, g, b].map((channel) => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };

    const describe = (el: Element) => {
      const testId = el.getAttribute('data-testid');
      const className = typeof el.className === 'string' ? el.className.trim() : '';
      return (
        el.tagName.toLowerCase() +
        (testId ? `[data-testid="${testId}"]` : '') +
        (className ? ` class="${className}"` : '')
      );
    };

    const skipped = new Set(['IMG', 'VIDEO', 'CANVAS', 'PICTURE']);
    const MAX_DOT = 12;
    const found: { element: string; background: string; luminance: number }[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (skipped.has(el.tagName)) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.width <= MAX_DOT && rect.height <= MAX_DOT) continue;

      const background = getComputedStyle(el).backgroundColor;
      const [r, g, b, a] = toRgba(background);
      if (a < 0.5) continue;
      const lum = luminance(r, g, b);
      if (lum > 0.4) {
        found.push({ element: describe(el), background, luminance: Number(lum.toFixed(3)) });
      }
    }
    return found;
  });
}

/** Every element, visible or not, whose computed font names Dancing Script. */
function findDancingScript(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('*'))
      .filter((el) => getComputedStyle(el).fontFamily.includes('Dancing Script'))
      .map((el) => `${el.tagName.toLowerCase()} font-family: ${getComputedStyle(el).fontFamily}`)
  );
}

async function sweep(page: Page, name: string, colorScheme: Scheme): Promise<void> {
  await test.info().attach(`${name}-${colorScheme}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(ground, `${name} body ground in ${colorScheme}`).toBe(PAGE_GROUND[colorScheme]);

  // The scrollbar is the one global surface outside any component: its track
  // must be the theme's page ground, not the pre-kit #fdf2f8 pink. Chromium
  // serialises it as "<thumb> <track>", e.g.
  // "color(srgb 0.858824 0.152941 0.466667 / 0.4) rgb(11, 14, 20)".
  const scrollbar = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollbarColor
  );
  expect(
    scrollbar.endsWith(` ${PAGE_GROUND[colorScheme]}`),
    `${name} scrollbar-color in ${colorScheme}: ${scrollbar}`
  ).toBe(true);

  const cursive = await findDancingScript(page);
  expect(cursive, `${name}: Dancing Script in use:\n${cursive.join('\n')}`).toEqual([]);

  if (colorScheme === 'dark') {
    const surfaces = await findLightSurfaces(page);
    expect(
      surfaces,
      `${name}: light surfaces in dark:\n` +
        surfaces.map((s) => `${s.element} -> ${s.background} (L=${s.luminance})`).join('\n')
    ).toEqual([]);
  }
}

test.describe('Theme sweep, signed in', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  for (const screen of SIGNED_IN_SCREENS) {
    for (const colorScheme of SCHEMES) {
      test(`[P1] ${screen.view} stays on the kit in ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ colorScheme });
        await page.goto('/');
        await expect(page.getByTestId('nav-dock')).toBeVisible();

        if (screen.view !== 'home') await navigateTo(page, screen.view);
        await screen.ready(page);

        await sweep(page, screen.view, colorScheme);
      });
    }
  }
});

test.describe('Theme sweep, signed out', () => {
  test.use({ authSessionEnabled: false });

  for (const colorScheme of SCHEMES) {
    test(`[P1] Sign in stays on the kit in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await expect(page.getByTestId('login-screen')).toBeVisible();

      await sweep(page, 'sign-in', colorScheme);
    });
  }
});
