/**
 * E2E: Home on the style kit
 *
 * Home at 390x844 in both OS themes, read at the rendered surface: the
 * countdown cards share one kit card and one value style, the two birthdays
 * (yours, then your partner's) sit two-up, the dateless wedding reads
 * "Date TBD" in `muted`, the Upcoming row's
 * Add button leads to Settings, and the daily message is Lora italic with no
 * emoji left in Home's own chrome. The kit colours are `--kit-*` variables that
 * switch under `prefers-color-scheme`, so `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import {
  COUPLE_SETTINGS_READ,
  OWN_PROFILE_READ,
  PARTNER_RECORD_READ,
  UPCOMING_EVENTS_READ,
} from '../../support/helpers/reads';
import { homeEventsSettled } from '../../support/helpers/settings-screen';

const KIT_CARD = {
  light: 'rgb(255, 255, 255)', // #ffffff
  dark: 'rgb(20, 25, 37)', // #141925
} as const;

const KIT_MUTED = {
  light: 'rgb(100, 107, 120)', // #646b78
  dark: 'rgb(154, 163, 178)', // #9aa3b2
} as const;

/** Kit accent (your own birthday tile). */
const KIT_ACCENT = {
  light: 'rgb(200, 33, 107)', // #c8216b
  dark: 'rgb(244, 114, 182)', // #f472b6
} as const;

/** Kit partner colour (your partner's birthday tile). */
const KIT_PARTNER = {
  light: 'rgb(124, 58, 237)', // #7c3aed
  dark: 'rgb(167, 139, 250)', // #a78bfa
} as const;

const COUNTDOWN_CARDS = [
  'time-together',
  'birthday-countdown-self',
  'birthday-countdown-partner',
  'event-countdown-wedding',
] as const;

/** Open Home and return once the reads behind its cards have answered — the
 * wedding card's couple settings, both birthdays' profile and partner record,
 * and the events — and the events column shows a loaded state: a stored
 * event's card or the empty placeholder, never the error or a gap. */
async function openHome(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  colorScheme: 'light' | 'dark'
) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  const homeReads = [
    UPCOMING_EVENTS_READ,
    COUPLE_SETTINGS_READ,
    OWN_PROFILE_READ,
    PARTNER_RECORD_READ,
  ].map((url) => interceptNetworkCall({ method: 'GET', url }));
  await page.goto('/');
  for (const { status } of await Promise.all(homeReads)) expect(status).toBe(200);
  await expect(homeEventsSettled(page)).toBeVisible();
  await expect(page.getByTestId('time-together')).toBeVisible();
  await expect(page.getByTestId('message-text')).toBeVisible();
}

test.describe('Home on the style kit', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`[P1] should render the countdown cards on one kit card and value style in ${colorScheme}`, async ({
      page,
      interceptNetworkCall,
    }) => {
      await openHome(page, interceptNetworkCall, colorScheme);

      for (const testId of COUNTDOWN_CARDS) {
        const card = page.getByTestId(testId);
        await expect(card).toBeVisible();

        const cardStyle = await card.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            background: style.backgroundColor,
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
          };
        });
        expect(cardStyle.background, testId).toBe(KIT_CARD[colorScheme]);
        expect(cardStyle.borderWidths, testId).not.toContain('2px');

        // The value is the element right after the <h3> label.
        const valueStyle = await card.locator('h3 + div').evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            size: style.fontSize,
            weight: style.fontWeight,
            numeric: style.fontVariantNumeric,
          };
        });
        expect(valueStyle, testId).toEqual({ size: '22px', weight: '700', numeric: 'tabular-nums' });
      }

      // The daily message sits on the same kit card.
      await expect(page.getByTestId('message-card')).toHaveCSS(
        'background-color',
        KIT_CARD[colorScheme]
      );

      // Tile tones: birthdays belong to accounts now, so your own card takes the
      // `you` (accent) tile and your partner's the `partner` tile on each device.
      const tileColor = (testId: string) =>
        page
          .getByTestId(testId)
          .evaluate((el) => getComputedStyle(el.firstElementChild as Element).color);
      expect(await tileColor('birthday-countdown-self')).toBe(KIT_ACCENT[colorScheme]);
      expect(await tileColor('birthday-countdown-partner')).toBe(KIT_PARTNER[colorScheme]);

      // Dateless wedding: "Date TBD" as the value, in the kit muted colour.
      const weddingValue = page.getByTestId('event-countdown-wedding').locator('h3 + div');
      await expect(weddingValue).toHaveText('Date TBD');
      await expect(weddingValue).toHaveCSS('color', KIT_MUTED[colorScheme]);
      await expect(page.getByTestId('event-countdown-wedding')).not.toContainText('XX:XX:XX');

      // Birthdays sit side by side at phone width.
      const selfBox = await page.getByTestId('birthday-countdown-self').boundingBox();
      const partnerBox = await page.getByTestId('birthday-countdown-partner').boundingBox();
      if (!selfBox || !partnerBox) throw new Error('[home-kit.spec] expected birthday boxes');
      expect(Math.round(selfBox.y)).toBe(Math.round(partnerBox.y));
      expect(Math.round(selfBox.x)).not.toBe(Math.round(partnerBox.x));
    });

    test(`[P1] should render the daily message in Lora italic with no emoji chrome in ${colorScheme}`, async ({
      page,
      interceptNetworkCall,
    }) => {
      await openHome(page, interceptNetworkCall, colorScheme);

      const type = await page.getByTestId('message-text').evaluate((el) => {
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
      expect(type.weight).toBe('500');
      expect(type.size).toBe('21px');

      // An italic 500 face must actually load: a computed family names Lora
      // even when no Lora face exists, so the loaded faces are checked too.
      const loraFaces = await page.evaluate(async () =>
        (await document.fonts.load('italic 500 21px Lora')).map((face) => ({
          style: face.style,
          weight: face.weight,
        }))
      );
      expect(loraFaces).toContainEqual({ style: 'italic', weight: '500' });

      // Bundled or user-authored text may carry emoji; Home's own chrome may
      // not. User-authored: the message text, stored events' labels and
      // descriptions (every event card but the static wedding), and the
      // anniversary list. Both birthday cards come from server reads that
      // `openHome` awaited; they are on screen before the one-shot read below
      // takes its copy.
      await expect(page.getByTestId('birthday-countdown-self')).toBeVisible();
      await expect(page.getByTestId('birthday-countdown-partner')).toBeVisible();
      const chromeText = await page.evaluate(() => {
        const main = document.getElementById('main-content');
        if (!main) return null;
        const clone = main.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll(
            [
              '[data-testid="message-text"]',
              '[data-testid^="event-countdown-"]:not([data-testid="event-countdown-wedding"]) h3',
              '[data-testid^="event-countdown-"]:not([data-testid="event-countdown-wedding"]) p',
              '[data-testid="countdown-timer"]',
            ].join(', ')
          )
          .forEach((el) => el.remove());
        return clone.textContent ?? '';
      });
      expect(chromeText).not.toBeNull();
      expect(chromeText).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  }

  test('[P1] should show Upcoming with an Add event button that opens Settings', async ({
    page,
    interceptNetworkCall,
  }) => {
    await openHome(page, interceptNetworkCall, 'light');

    await expect(page.getByText('Upcoming', { exact: true })).toBeVisible();
    const addButton = page.getByRole('button', { name: 'Add event' });
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveAttribute('data-testid', 'home-add-event');

    await addButton.click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('[P1] should not render the welcome button on Home', async ({
    page,
    interceptNetworkCall,
  }) => {
    await openHome(page, interceptNetworkCall, 'light');

    await expect(page.getByLabel('View welcome message again')).toHaveCount(0);
  });
});
