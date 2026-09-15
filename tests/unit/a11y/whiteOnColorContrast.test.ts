/**
 * DW-134: white text on a colour that does not clear WCAG AA.
 *
 * The entry named two destructive buttons still pairing `text-white` with
 * `bg-red-500`. Fixing two class strings is a one-line job per file; keeping
 * them fixed is not, because nothing measures this. There is no axe coverage
 * for either surface -- `@axe-core/playwright` runs in exactly one spec
 * (`tests/e2e/settings/events-accessibility.spec.ts`), scoped to the events
 * subtree, and its own header records that a wider scan was avoided precisely
 * because it would land red on AnniversarySettings.
 *
 * So the guard is here instead, and it generalises the entry rather than
 * restating it: every `text-white` + `bg-<colour>-<shade>` pairing in `src/` is
 * measured against the real palette, so a NEW button below the floor fails
 * without anyone having to remember this rule. That is the difference between
 * this and a test that asserts two class strings -- which would pass while the
 * next component shipped the same defect.
 *
 * The palette is read from `node_modules/tailwindcss/theme.css` rather than
 * hard-coded, so a Tailwind upgrade that moves a swatch re-checks every pairing
 * instead of leaving this green against stale constants. Tailwind v4 states
 * them in oklch, hence the conversion below.
 *
 * Measured for the entry's own two colours, and matching the figures it
 * recorded: `red-500` is #fb2c36 at 3.82:1, `red-600` is #e7000b at 4.76:1.
 *
 * Scope, deliberately narrow:
 *  - Only the unprefixed `bg-` utility. `hover:`, `focus:` and `dark:` variants
 *    describe other states against other grounds and would need their own
 *    model; AA is defined on the resting state, which is what this measures.
 *  - Only `text-white`, the pairing the entry is about and by far the most
 *    common way this goes wrong here.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** WCAG 2 AA for normal-size text. */
const AA_NORMAL_TEXT = 4.5;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Pairings that were already below the floor when this guard was written.
 *
 * Listed, not silently skipped: each carries its measured ratio so the debt is
 * legible, and anything NOT on this list fails. Adding an entry here is a
 * deliberate act a reviewer can see, which is the property an allowlist has to
 * have to be worth anything.
 */
const KNOWN_BELOW_FLOOR = new Map<string, string>([
  [
    'src/components/InteractionHistory/InteractionHistory.tsx:purple-500',
    'purple-500 at 4.12:1 — pre-existing, raised as its own ledger entry',
  ],
  [
    'src/components/PartnerMoodView/PartnerMoodView.tsx:green-500',
    'green-500 at 2.22:1 — pre-existing and the worst in the tree, raised as its own ledger entry',
  ],
]);

/**
 * The scripture feature is frozen pending removal (AGENTS.md), so its two
 * `purple-500` pairings are excluded wholesale rather than allowlisted: a fix
 * there is forbidden, and listing them would invite one.
 */
const FROZEN = 'src/components/scripture-reading/';

interface Oklch {
  l: number;
  c: number;
  h: number;
}

function readPalette(): Map<string, Oklch> {
  const css = readFileSync(resolve(repoRoot, 'node_modules/tailwindcss/theme.css'), 'utf8');
  const palette = new Map<string, Oklch>();
  const pattern = /--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g;
  for (const match of css.matchAll(pattern)) {
    palette.set(`${match[1]}-${match[2]}`, {
      l: Number(match[3]) / 100,
      c: Number(match[4]),
      h: Number(match[5]),
    });
  }
  return palette;
}

/** oklch -> linear sRGB -> gamma-encoded sRGB, per the CSS Color 4 matrices. */
function toSrgb({ l: L, c: C, h: H }: Oklch): [number, number, number] {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((value) => {
    const clamped = Math.min(1, Math.max(0, value));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastAgainstWhite(colour: Oklch): number {
  const luminance = relativeLuminance(toSrgb(colour));
  return 1.05 / (luminance + 0.05);
}

interface Pairing {
  file: string;
  line: number;
  swatch: string;
  ratio: number;
}

/**
 * Every `.tsx` under `src/`, `__tests__` aside.
 *
 * Walked by hand rather than with a glob library on purpose: the only one
 * available here is `fast-glob`, which this repo does not declare and merely
 * inherits transitively, so importing it would make this file break on an
 * unrelated dependency bump.
 */
function componentFiles(directory: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      componentFiles(absolute, collected);
    } else if (entry.name.endsWith('.tsx')) {
      collected.push(absolute);
    }
  }
  return collected;
}

function findWhiteOnColourPairings(): Pairing[] {
  const palette = readPalette();
  const files = componentFiles(resolve(repoRoot, 'src'));
  const found: Pairing[] = [];

  for (const absolute of files) {
    const file = relative(repoRoot, absolute).split('\\').join('/');
    if (file.startsWith(FROZEN)) continue;

    const lines = readFileSync(absolute, 'utf8').split('\n');
    lines.forEach((text, index) => {
      for (const classAttr of text.matchAll(/className=["`]([^"`]*)["`]/g)) {
        const classes = classAttr[1];
        if (!classes.includes('text-white')) continue;
        // Unprefixed only: the negative lookbehind rejects `hover:bg-`,
        // `dark:bg-` and `group-hover:bg-`.
        for (const bg of classes.matchAll(/(?<![\w:-])bg-([a-z]+-\d{3})\b/g)) {
          const swatch = bg[1];
          const colour = palette.get(swatch);
          if (!colour) continue;
          found.push({ file, line: index + 1, swatch, ratio: contrastAgainstWhite(colour) });
        }
      }
    });
  }
  return found;
}

describe('white text on a coloured background clears WCAG AA', () => {
  it('reads the real Tailwind palette, not hard-coded hex values', () => {
    const palette = readPalette();

    // The two swatches DW-134 turns on, asserted to the figures the entry
    // recorded. If a Tailwind upgrade moves either, this is where it surfaces.
    expect(palette.get('red-500')).toBeDefined();
    expect(palette.get('red-600')).toBeDefined();
    expect(contrastAgainstWhite(palette.get('red-500') as Oklch)).toBeCloseTo(3.82, 1);
    expect(contrastAgainstWhite(palette.get('red-600') as Oklch)).toBeCloseTo(4.76, 1);
  });

  it('finds pairings to check at all', () => {
    // Without this, a regex that quietly stopped matching would leave the real
    // assertion below passing over an empty list forever.
    expect(findWhiteOnColourPairings().length).toBeGreaterThan(10);
  });

  it('has no pairing below the floor except the ones already recorded', () => {
    const offenders = findWhiteOnColourPairings()
      .filter((pairing) => pairing.ratio < AA_NORMAL_TEXT)
      .filter((pairing) => !KNOWN_BELOW_FLOOR.has(`${pairing.file}:${pairing.swatch}`))
      .map((pairing) => `${pairing.file}:${pairing.line} bg-${pairing.swatch} ${pairing.ratio.toFixed(2)}:1`);

    expect(offenders).toEqual([]);
  });

  it('keeps the allowlist honest by failing when an entry is fixed', () => {
    // An allowlist nobody prunes becomes a list of things that were fixed years
    // ago. Every recorded pairing must still be present and still be failing;
    // fix one and this turns red, which is the prompt to delete its entry.
    const present = new Set(
      findWhiteOnColourPairings()
        .filter((pairing) => pairing.ratio < AA_NORMAL_TEXT)
        .map((pairing) => `${pairing.file}:${pairing.swatch}`)
    );

    for (const key of KNOWN_BELOW_FLOOR.keys()) {
      expect(present, `${key} is allowlisted but no longer failing — remove it`).toContain(key);
    }
  });
});
