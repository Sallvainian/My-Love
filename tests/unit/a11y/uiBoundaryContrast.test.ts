/**
 * DW-189: a kit input's boundary clears WCAG 1.4.11's 3:1 for UI components.
 *
 * The subtle `--kit-line` hairline (a 7-9% alpha wash) measured about
 * 1.1-1.2:1 as the ring of a `bg-field` input on a `bg-card` surface, and the
 * field itself is 1.06:1 against the card, so the ring was the input's only
 * boundary and it was all but invisible. Inputs and unselected options ring in
 * `--kit-line-strong` instead; card borders keep `--kit-line`.
 *
 * Every value is read from `src/index.css`, so a change to the field, the card
 * or the token in either theme is re-measured here. The token must be an
 * opaque hex: a translucent ring's contrast depends on what it is drawn over.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fieldClass } from '../../../src/components/shared/kitClasses';

/** WCAG 2 1.4.11, non-text contrast. */
const UI_COMPONENT_MINIMUM = 3;

const css = readFileSync('src/index.css', 'utf8');

/** A `--kit-*` token as `src/index.css` declares it: light first, then the dark override. */
function kitToken(name: string): { light: string; dark: string } {
  const pattern = new RegExp(`--kit-${name}:\\s*([^;]+);`, 'g');
  const values = [...css.matchAll(pattern)].map((match) => match[1].trim());
  expect(values, `--kit-${name} must be declared once per theme`).toHaveLength(2);
  for (const value of values) {
    expect(value, `--kit-${name} must be an opaque #rrggbb`).toMatch(/^#[0-9a-fA-F]{6}$/);
  }
  return { light: values[0], dark: values[1] };
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe('kit input boundaries clear 3:1', () => {
  it('maps --color-line-strong to the kit token, as line is mapped', () => {
    expect(css).toMatch(/--color-line-strong:\s*var\(--kit-line-strong\);/);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`line-strong clears 3:1 against the field and the card in the ${theme} theme`, () => {
      const ring = kitToken('line-strong')[theme];

      expect(contrast(ring, kitToken('field')[theme])).toBeGreaterThanOrEqual(UI_COMPONENT_MINIMUM);
      expect(contrast(ring, kitToken('card')[theme])).toBeGreaterThanOrEqual(UI_COMPONENT_MINIMUM);
    });
  }

  it('rings a resting kit field in line-strong, and an errored one in danger', () => {
    for (const multiline of [false, true]) {
      const resting = fieldClass(false, multiline).split(/\s+/);
      expect(resting).toContain('ring-line-strong');
      expect(resting).not.toContain('ring-line');

      const errored = fieldClass(true, multiline).split(/\s+/);
      expect(errored).toContain('ring-danger');
      expect(errored).not.toContain('ring-line-strong');
    }
  });
});
