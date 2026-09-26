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
 * screen. A screen is swept only once the read that carries its data has
 * answered and a loaded state is on screen: never a skeleton, a spinner or an
 * error state.
 */
import { test, expect } from '../../support/merged-fixtures';
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { TypedSupabaseClient } from '../../support/factories';
import { resolveOwnPair } from '../../support/helpers/events';
import { navigateTo, type NavDestination } from '../../support/helpers/navigation';
import {
  LOVE_NOTES_READ,
  PHOTOS_LIST_READ,
  UPCOMING_EVENTS_READ,
  partnerLatestMoodRead,
  partnerMoodListRead,
} from '../../support/helpers/reads';
import { homeEventsSettled, openSettingsFromHome } from '../../support/helpers/settings-screen';

type Scheme = 'light' | 'dark';

const PAGE_GROUND: Record<Scheme, string> = {
  light: 'rgb(253, 244, 247)', // #fdf4f7
  dark: 'rgb(11, 14, 20)', // #0b0e14
};

/** The read that carries a screen's data, and the step that sends it. */
interface ScreenRead {
  /** The read's glob; a function when it names this worker's partner. */
  url: string | ((partnerId: string) => string);
  /** Armed before the step that sends it: the cold start (`goto`), or the
   * dock click (`dock`) for a read the screen's mount always sends after the
   * click. App's start-up refresh may send a read of the same rows too, and
   * that one may be the one that answers. */
  armBefore: 'goto' | 'dock';
}

interface Screen {
  view: NavDestination;
  /** Absent for Settings, whose read shares Home's URL and is ordered by
   * `openSettingsFromHome`. */
  read?: ScreenRead;
  /** Resolves once the view shows a loaded state, never a loading or error one. */
  ready: (page: Page) => Promise<void>;
}

const SIGNED_IN_SCREENS: Screen[] = [
  {
    view: 'home',
    read: { url: UPCOMING_EVENTS_READ, armBefore: 'goto' },
    ready: async (page) => {
      await expect(page.getByTestId('time-together')).toBeVisible();
      await expect(page.getByTestId('message-text')).toBeVisible();
      await expect(homeEventsSettled(page)).toBeVisible();
    },
  },
  {
    view: 'mood',
    read: { url: partnerLatestMoodRead, armBefore: 'dock' },
    ready: async (page) => {
      await expect(page.getByTestId('mood-tracker')).toBeVisible();
      await expect(page.getByTestId('mood-button-happy')).toBeVisible();
      await expect(
        page.getByTestId('partner-mood-display').or(page.getByTestId('no-mood-logged-state'))
      ).toBeVisible();
    },
  },
  {
    view: 'notes',
    read: { url: LOVE_NOTES_READ, armBefore: 'goto' },
    ready: async (page) => {
      await expect(page.getByTestId('notes-partner-row')).toBeVisible();
      await expect(page.getByLabel(/love note message input/i)).toBeVisible();
      await expect(
        page.getByTestId('virtualized-list').or(page.getByText('No messages to show'))
      ).toBeVisible();
    },
  },
  {
    view: 'photos',
    read: { url: PHOTOS_LIST_READ, armBefore: 'goto' },
    ready: async (page) => {
      // Past the skeleton, which also carries `photo-gallery`: the grid or the
      // empty state. The error state is not a screen this sweep accepts.
      await expect(
        page.getByTestId('photo-gallery-grid').or(page.getByTestId('photo-gallery-empty-state'))
      ).toBeVisible();
    },
  },
  {
    view: 'partner',
    read: { url: partnerMoodListRead, armBefore: 'dock' },
    ready: async (page) => {
      await expect(page.getByTestId('partner-mood-view')).toBeVisible();
      // A mood card (both the latest and the older ones carry the testid) or,
      // with no moods, the empty state.
      await expect(
        page
          .getByTestId('partner-mood-card')
          .or(page.getByTestId('partner-mood-empty-state'))
          .first()
      ).toBeVisible();
    },
  },
  {
    view: 'settings',
    ready: async (page) => {
      await expect(page.getByTestId('settings-view')).toBeVisible();
      await expect(
        page.getByTestId('events-settings-list').or(page.getByTestId('events-settings-empty'))
      ).toBeVisible();
      await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
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

/**
 * The checks every screen shares in both themes: the attached screenshot, the
 * page ground, the scrollbar track and the absence of Dancing Script.
 */
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
}

/** Dark only: no visible in-viewport element paints an opaque light surface. */
async function assertNoLightSurfaces(page: Page, name: string): Promise<void> {
  const surfaces = await findLightSurfaces(page);
  expect(
    surfaces,
    `${name}: light surfaces in dark:\n` +
      surfaces.map((s) => `${s.element} -> ${s.background} (L=${s.luminance})`).join('\n')
  ).toEqual([]);
}

/**
 * Opens a signed-in screen at phone size in the given OS theme and waits for
 * it: the screen's own read is armed before the step that sends it and
 * awaited before the readiness check.
 */
async function openSignedInScreen(
  page: Page,
  screen: Screen,
  colorScheme: Scheme,
  interceptNetworkCall: InterceptNetworkCallFn,
  supabaseAdmin: TypedSupabaseClient
): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });

  if (!screen.read) {
    await openSettingsFromHome(page, interceptNetworkCall);
    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await screen.ready(page);
    return;
  }

  const { url, armBefore } = screen.read;
  const readUrl =
    typeof url === 'string' ? url : url((await resolveOwnPair(supabaseAdmin)).partnerId);
  const arm = () => interceptNetworkCall({ method: 'GET', url: readUrl });

  const coldRead = armBefore === 'goto' ? arm() : null;
  await page.goto('/');
  await expect(page.getByTestId('nav-dock')).toBeVisible();

  const mountRead = armBefore === 'dock' ? arm() : null;
  if (screen.view !== 'home') await navigateTo(page, screen.view);
  const read = coldRead ?? mountRead;
  if (!read) throw new Error(`[theme-sweep] ${screen.view} has no armed read`);
  expect((await read).status, `${screen.view} data read`).toBe(200);
  await screen.ready(page);
}

/** Opens the signed-out sign-in screen at phone size in the given OS theme. */
async function openSignIn(page: Page, colorScheme: Scheme): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/');
  await expect(page.getByTestId('login-screen')).toBeVisible();
}

test.describe('Theme sweep, signed in', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  for (const screen of SIGNED_IN_SCREENS) {
    test(`[P1] ${screen.view} stays on the kit in light`, async ({
      page,
      interceptNetworkCall,
      supabaseAdmin,
    }) => {
      await openSignedInScreen(page, screen, 'light', interceptNetworkCall, supabaseAdmin);
      await sweep(page, screen.view, 'light');
    });

    test(`[P1] ${screen.view} stays on the kit in dark`, async ({
      page,
      interceptNetworkCall,
      supabaseAdmin,
    }) => {
      await openSignedInScreen(page, screen, 'dark', interceptNetworkCall, supabaseAdmin);
      await sweep(page, screen.view, 'dark');
      await assertNoLightSurfaces(page, screen.view);
    });
  }
});

test.describe('Theme sweep, signed out', () => {
  test.use({ authSessionEnabled: false });

  test('[P1] Sign in stays on the kit in light', async ({ page }) => {
    await openSignIn(page, 'light');
    await sweep(page, 'sign-in', 'light');
  });

  test('[P1] Sign in stays on the kit in dark', async ({ page }) => {
    await openSignIn(page, 'dark');
    await sweep(page, 'sign-in', 'dark');
    await assertNoLightSurfaces(page, 'sign-in');
  });
});
