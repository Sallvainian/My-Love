/**
 * E2E: Home on the style kit
 *
 * Home at 390x844 in both OS themes, read at the rendered surface: the
 * countdown cards share one kit card and one value style, the birthdays sit
 * two-up, the dateless wedding reads "Date TBD" in `muted`, the Upcoming row's
 * Add button leads to Settings, and the daily message is Lora italic with no
 * emoji left in Home's own chrome. The kit colours are `--kit-*` variables that
 * switch under `prefers-color-scheme`, so `emulateMedia` alone flips them.
 */
import { test, expect } from '../../support/merged-fixtures';
import type { Page } from '@playwright/test';

const KIT_CARD = {
  light: 'rgb(255, 255, 255)', // #ffffff
  dark: 'rgb(20, 25, 37)', // #141925
} as const;

const KIT_MUTED = {
  light: 'rgb(100, 107, 120)', // #646b78
  dark: 'rgb(154, 163, 178)', // #9aa3b2
} as const;

/** Kit accent (both birthday tiles). */
const KIT_ACCENT = {
  light: 'rgb(200, 33, 107)', // #c8216b
  dark: 'rgb(244, 114, 182)', // #f472b6
} as const;

const COUNTDOWN_CARDS = [
  'time-together',
  'birthday-countdown-casey',
  'birthday-countdown-harper',
  'event-countdown-wedding',
] as const;

async function openHome(page: Page, colorScheme: 'light' | 'dark') {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/');
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
    }) => {
      await openHome(page, colorScheme);

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

      // Tile tones: both birthdays use the default `you` (accent) tile. Birthdays are
      // not tied to accounts, so a fixed `partner` tile would be the wrong person on
      // one of the two devices.
      const tileColor = (testId: string) =>
        page
          .getByTestId(testId)
          .evaluate((el) => getComputedStyle(el.firstElementChild as Element).color);
      expect(await tileColor('birthday-countdown-casey')).toBe(KIT_ACCENT[colorScheme]);
      expect(await tileColor('birthday-countdown-harper')).toBe(KIT_ACCENT[colorScheme]);

      // Dateless wedding: "Date TBD" as the value, in the kit muted colour.
      const weddingValue = page.getByTestId('event-countdown-wedding').locator('h3 + div');
      await expect(weddingValue).toHaveText('Date TBD');
      await expect(weddingValue).toHaveCSS('color', KIT_MUTED[colorScheme]);
      await expect(page.getByTestId('event-countdown-wedding')).not.toContainText('XX:XX:XX');

      // Birthdays sit side by side at phone width.
      const caseyBox = await page.getByTestId('birthday-countdown-casey').boundingBox();
      const harperBox = await page.getByTestId('birthday-countdown-harper').boundingBox();
      if (!caseyBox || !harperBox) throw new Error('[home-kit.spec] expected birthday boxes');
      expect(Math.round(caseyBox.y)).toBe(Math.round(harperBox.y));
      expect(Math.round(caseyBox.x)).not.toBe(Math.round(harperBox.x));
    });

    test(`[P1] should render the daily message in Lora italic with no emoji chrome in ${colorScheme}`, async ({
      page,
    }) => {
      await openHome(page, colorScheme);

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
      // anniversary list.
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
  }) => {
    await openHome(page, 'light');

    await expect(page.getByText('Upcoming', { exact: true })).toBeVisible();
    const addButton = page.getByRole('button', { name: 'Add event' });
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveAttribute('data-testid', 'home-add-event');

    await addButton.click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('[P1] should not render the welcome button on Home', async ({ page }) => {
    await openHome(page, 'light');

    await expect(page.getByLabel('View welcome message again')).toHaveCount(0);
  });
});
