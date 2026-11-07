/**
 * Light-surface check shared by the dark-theme specs: a "light surface" is a
 * background at alpha >= .5 with relative luminance > .4 (see
 * `navigation/theme-sweep.spec.ts`). Colours are resolved through a canvas, so
 * oklch/oklab/color-mix computed values are read as the sRGB the screen shows.
 */
import type { Page } from '@playwright/test';

export interface LightSurface {
  element: string;
  background: string;
  luminance: number;
}

/**
 * Every in-viewport visible element whose background is an opaque light colour,
 * under `rootTestId` (the element itself included) or, with none, the whole body.
 */
export function findLightSurfaces(page: Page, rootTestId?: string): Promise<LightSurface[]> {
  return page.evaluate((rootId) => {
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
    const root = rootId ? document.querySelector(`[data-testid="${rootId}"]`) : null;
    if (rootId && !root) throw new Error(`no element with data-testid ${rootId}`);
    const candidates = root
      ? [root, ...Array.from(root.querySelectorAll('*'))]
      : Array.from(document.querySelectorAll('body *'));
    for (const el of candidates) {
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
  }, rootTestId);
}
