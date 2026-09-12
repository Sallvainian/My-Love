import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  OWN_PHOTO_CAPTION,
  OWN_PHOTO_ID,
  PARTNER_PHOTO_CAPTION,
} from '../../support/factories/own-photo-badge';
import { isPhotoHarnessReady, measurePhotoItem } from '../../support/helpers/own-photo-badge';

// Browser component coverage: the production component and stylesheet, without gallery/auth I/O.
test.use({ authSessionEnabled: false });

for (const theme of ['light', 'dark'] as const) {
  test.describe(`DW-59 own-photo badge (${theme})`, () => {
    test.beforeEach(async ({ page, recurse, baseURL }) => {
      if (!baseURL) throw new Error('The E2E project must provide its Vite baseURL');
      // The project auth fixture creates its own context, so apply media/viewport on the page.
      await page.setViewportSize({ width: 960, height: 720 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
      // Static font traffic is a legitimate non-API route; use stable system fallback fonts.
      await page.route('https://fonts.googleapis.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/css', body: '' })
      );
      await page.goto(new URL('/tests/support/harnesses/own-photo-badge-contrast.html', baseURL).href);
      await expect(page.getByTestId('photo-grid-item')).toHaveCount(2);
      await recurse(() => page.evaluate(isPhotoHarnessReady), (ready) => ready, {
        timeout: 10000,
        interval: 100,
        log: 'Wait for both white PNGs, fonts, and image opacity transitions',
      });
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches))
        .toBe(theme === 'dark');
    });

    test(`[P1] DW59-E2E-001-${theme} loaded white photo has opaque white-on-pink contrast >=4.5`,
      async ({ page }, testInfo) => {
        await log.step('Measure the rendered own-photo badge over decoded white image pixels');
        const own = page.getByRole('button', { name: OWN_PHOTO_CAPTION, exact: true });
        const measurement = await own.evaluate(measurePhotoItem);
        await testInfo.attach(`contrast-${theme}`, {
          body: JSON.stringify(measurement, null, 2), contentType: 'application/json',
        });

        expect(measurement.image.complete).toBe(true);
        expect(measurement.image.naturalSize).toEqual([240, 240]);
        expect(measurement.image.pixel).toEqual([255, 255, 255, 255]);
        expect(measurement.image.opacity).toBe(1);
        expect(measurement.foreground).toEqual([255, 255, 255, 255]);
        expect(measurement.contrast).toBeGreaterThanOrEqual(4.5);
        expect(measurement.background).toEqual(measurement.palettePink);
        expect(measurement.background[3]).toBe(255);
        for (const opacity of measurement.ancestorOpacities) expect(opacity).toBe(1);
        await expect(own.getByTestId('photo-grid-item-owner-badge')).toHaveText('You');
        await testInfo.attach(`loaded-white-${theme}`, {
          body: await own.screenshot(), contentType: 'image/png',
        });
      }
    );

    test(`[P2] DW59-E2E-002-${theme} preserves badge, partner, image, caption, and selection behavior`,
      async ({ page, recurse }, testInfo) => {
        const own = page.getByRole('button', { name: OWN_PHOTO_CAPTION, exact: true });
        const partner = page.getByRole('button', { name: PARTNER_PHOTO_CAPTION, exact: true });
        const ownMeasurement = await own.evaluate(measurePhotoItem);
        const partnerMeasurement = await partner.evaluate(measurePhotoItem);
        await testInfo.attach(`preservation-${theme}`, {
          body: JSON.stringify({ own: ownMeasurement, partner: partnerMeasurement }, null, 2),
          contentType: 'application/json',
        });
        await log.step('Verify stable geometry, User glyph, and partner styling');
        await expect(own.getByTestId('photo-grid-item-owner-badge')).toHaveText('You');
        await expect(partner.getByTestId('photo-grid-item-owner-badge')).toHaveText('Partner');
        expect(partnerMeasurement.foreground).toEqual([255, 255, 255, 255]);
        expect(partnerMeasurement.background[3] / 255).toBeCloseTo(0.9, 2);
        for (let channel = 0; channel < 3; channel += 1) {
          expect(Math.abs(partnerMeasurement.background[channel] - partnerMeasurement.paletteBlue[channel]))
            .toBeLessThanOrEqual(1);
        }
        for (const [locator, measured, caption] of [
          [own, ownMeasurement, OWN_PHOTO_CAPTION],
          [partner, partnerMeasurement, PARTNER_PHOTO_CAPTION],
        ] as const) {
          await expect(locator).toHaveAttribute('tabindex', '0');
          expect(measured.image.complete).toBe(true);
          expect(measured.image.naturalSize).toEqual([240, 240]);
          expect(measured.image.renderedSize).toEqual([240, 240]);
          expect(measured.image.loading).toBe('lazy');
          expect(measured.image.objectFit).toBe('cover');
          expect(measured.image.opacity).toBe(1);
          expect(measured.image.alt).toBe(caption);
          expect(measured.image.isPngDataUrl).toBe(true);
          expect(measured.geometry.itemSize).toEqual([240, 240]);
          expect(measured.geometry.height).toBe(24);
          expect(measured.geometry.offsets).toEqual({ top: 8, right: 8 });
          expect(measured.geometry.padding).toEqual([4, 8, 4, 8]);
          expect(measured.geometry.gap).toBe(4);
          expect(measured.geometry.iconSize).toEqual([12, 12]);
          expect(measured.geometry.fontSize).toBe(12);
          expect(measured.geometry.lineHeight).toBe(16);
          expect(measured.geometry.fontWeight).toBe('500');
          expect(measured.geometry.radius).toBeGreaterThanOrEqual(12);
          expect(measured.geometry.display).toBe('flex');
          expect(measured.geometry.alignItems).toBe('center');
          // Width depends on platform font metrics; assert the unchanged sizing relationship.
          expect(measured.geometry.width).toBeCloseTo(measured.geometry.labelWidth + 12 + 4 + 16, 2);
          expect(measured.icon).toEqual({
            viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2',
            path: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
            circle: ['12', '7', '4'],
          });
          for (const opacity of measured.ancestorOpacities) expect(opacity).toBe(1);
        }

        await log.step('Reveal the caption, then select the own photo once per input action');
        const caption = own.getByTestId('photo-grid-item-caption-overlay');
        await expect(caption).toHaveText(OWN_PHOTO_CAPTION);
        await expect(caption).toHaveCSS('opacity', '0');
        await expect(caption).toHaveCSS('padding', '12px');
        expect(await caption.evaluate((element) => getComputedStyle(element).backgroundImage))
          .toContain('gradient');
        await own.hover();
        await expect(caption).toHaveCSS('opacity', '1');
        await recurse(() => page.evaluate(isPhotoHarnessReady), (ready) => ready, {
          timeout: 5000, interval: 100, log: 'Wait for hover transitions',
        });
        const calls = page.getByRole('status', { name: 'Selected photo IDs' });
        await expect(calls).toHaveText('[]');
        await own.click();
        await expect(calls).toHaveText(JSON.stringify([OWN_PHOTO_ID]));
        await own.focus();
        await own.press('Enter');
        await expect(calls).toHaveText(JSON.stringify([OWN_PHOTO_ID, OWN_PHOTO_ID]));
        await own.press('Space');
        await expect(calls).toHaveText(JSON.stringify([OWN_PHOTO_ID, OWN_PHOTO_ID, OWN_PHOTO_ID]));
        await page.mouse.move(0, 0);
        await expect(caption).toHaveCSS('opacity', '0');
      }
    );
  });
}
