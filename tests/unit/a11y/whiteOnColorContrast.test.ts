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
 * measured against the real palettes, so a NEW one below the floor fails
 * without anyone having to remember this rule. That is the difference between
 * this and a test that asserts two class strings -- which would pass while the
 * next component shipped the same defect.
 *
 * Both palettes are read at run time rather than hard-coded, so an upgrade or a
 * brand change re-checks every pairing instead of leaving this green against
 * stale constants.
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
 *
 * Gradients ARE measured, via their `from-`/`via-`/`to-` stops. They were not
 * at first, which made the property above false for the most-used button style
 * in the app: `bg-gradient-to-r from-pink-500 to-rose-500` has no
 * `bg-<colour>-<shade>` to match, so ten components' primary call-to-action sat
 * outside a guard whose whole point was that a new failure fails on its own. A
 * gradient is judged at its stops, and a stop below the floor fails: the text
 * has to be readable everywhere along the sweep, not on average.
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
 * Listed, not silently skipped: each carries its measured ratio and its ledger
 * entry, so the debt is legible, and anything NOT on this list fails. Adding an
 * entry here is a deliberate act a reviewer can see, which is the property an
 * allowlist has to have to be worth anything.
 *
 * The count matters as much as the key. Without it, a file with two bad
 * pairings stays green after only one is fixed.
 */
const KNOWN_BELOW_FLOOR = new Map<string, { count: number; note: string }>();

/**
 * The scripture feature is frozen pending removal (AGENTS.md), so its
 * `purple-500` pairings are excluded wholesale rather than allowlisted: a fix
 * there is forbidden, and listing them would invite one.
 */
const FROZEN = 'src/components/scripture-reading/';

interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Gamma-encoded sRGB, each channel 0..1. */
type Rgb = [number, number, number];

function hexToSrgb(hex: string): Rgb {
  const value = hex.slice(1);
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as Rgb;
}

/** oklch -> linear sRGB -> gamma-encoded sRGB, per the CSS Color 4 matrices. */
function oklchToSrgb({ l: L, c: C, h: H }: Oklch): Rgb {
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
  }) as Rgb;
}

/** Tailwind's own swatches, stated in oklch. */
function readBuiltInPalette(): Map<string, Rgb> {
  const css = readFileSync(resolve(repoRoot, 'node_modules/tailwindcss/theme.css'), 'utf8');
  const palette = new Map<string, Rgb>();
  const pattern = /--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g;
  for (const match of css.matchAll(pattern)) {
    palette.set(
      `${match[1]}-${match[2]}`,
      oklchToSrgb({ l: Number(match[3]) / 100, c: Number(match[4]), h: Number(match[5]) })
    );
  }
  return palette;
}

/**
 * The palette THIS project adds, which is most of the brand.
 *
 * `src/index.css:4` is `@config '../tailwind.config.js'`, and that file extends
 * `theme.colors` with sunset, coral, ocean and the rest, in hex. A guard that
 * read only Tailwind's built-ins would silently skip every one of them — and
 * silently is the word, because an unknown swatch is indistinguishable from a
 * class that is not a colour at all. The send button in love notes is
 * `bg-coral-500`, the worst pairing in the tree, and it was invisible here
 * until this function existed.
 *
 * Parsed by regex rather than imported: `tailwind.config.js` belongs to
 * `tsconfig.node.json` while this suite builds under `tsconfig.test.json`, so a
 * static import raises TS6307 — the same reason
 * `supabaseClientAuthFlow.test.ts:31-40` reads `vite.config.ts` through a path
 * instead of importing it.
 */
function readProjectPalette(): Map<string, Rgb> {
  const source = readFileSync(resolve(repoRoot, 'tailwind.config.js'), 'utf8');
  const palette = new Map<string, Rgb>();
  let family: string | null = null;
  for (const line of source.split('\n')) {
    const familyMatch = line.match(/^\s{8}([a-z]+):\s*\{\s*$/);
    if (familyMatch) {
      family = familyMatch[1];
      continue;
    }
    const shadeMatch = line.match(/^\s{10}(\d{2,3}):\s*'(#[0-9a-fA-F]{6})'/);
    if (shadeMatch && family) {
      palette.set(`${family}-${shadeMatch[1]}`, hexToSrgb(shadeMatch[2]));
    }
  }
  return palette;
}

function readPalette(): Map<string, Rgb> {
  return new Map([...readBuiltInPalette(), ...readProjectPalette()]);
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastAgainstWhite(colour: Rgb): number {
  return 1.05 / (relativeLuminance(colour) + 0.05);
}

interface Pairing {
  file: string;
  line: number;
  swatch: string;
  ratio: number;
  /** A solid `bg-` utility, or one stop of a gradient. */
  kind: 'solid' | 'gradient';
}

/**
 * The one gradient idiom in the tree, and the ten places it is repeated.
 *
 * Keyed by swatch rather than by file, because this is a single style copied
 * around rather than ten independent decisions — listing eighteen
 * `file:swatch` rows would bury that. Measured: `pink-500` is #f6339a at
 * 3.58:1 and `rose-500` resolves to the project's own override #f43f5e at
 * 3.67:1, so both ends of the sweep fail and every point between them does too.
 *
 * Raised as DW-143. The fix is already written in the tree: several of these
 * carry `hover:from-pink-600 hover:to-rose-600`, and those clear at 4.54:1 and
 * 4.70:1 — so the resting state fails while the hover state passes, which is
 * backwards. Promoting the hover values is a visible change to the app's
 * primary action colour, which is a design decision rather than a class edit.
 */
const KNOWN_GRADIENT_BELOW_FLOOR = new Map<string, number>([
  ['pink-500', 10],
  ['rose-500', 10],
]);

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
      // Every string literal on the line, not just `className="…"`.
      //
      // This codebase writes classes both ways — roughly 1300 `className="`
      // against 130 `className={` — and the second form is where conditional
      // pairings live, e.g. `photo.isOwn ? 'bg-pink-600 text-white' :
      // 'bg-blue-600 text-white'`. An attribute-shaped regex walks past all
      // of them, which is a guard that reports clean over exactly the cases
      // most likely to be wrong. The first version of this file did that.
      //
      // A literal carrying BOTH `text-white` and a `bg-` utility is the unit
      // judged, so a conditional's two arms are judged separately, which is
      // what you want.
      //
      // Two known limitations, both of which under-report rather than
      // over-report. A pairing split across two literals (`${base} text-white`,
      // with the background inside `base`) is not seen. And the scan is
      // line-by-line, so a template literal left open across several lines is
      // only judged where both utilities land on the SAME line -- the usual
      // case, since a wrapped class list tends to keep its colour pair
      // together, but not a guarantee.
      for (const literal of text.matchAll(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g)) {
        const classes = literal[0];
        if (!classes.includes('text-white')) continue;
        // Unprefixed only: the negative lookbehind rejects `hover:bg-`,
        // `dark:bg-`, `disabled:hover:bg-` and `group-hover:bg-`.
        //
        // The trailing boundary allows an opacity modifier (`bg-blue-500/90`)
        // and measures the base colour, which is the most that can be said:
        // what shows through is a photo or a gradient, so the true ratio is not
        // knowable from the class alone, and the opaque value is the optimistic
        // bound. A pairing that fails even at full opacity fails.
        for (const bg of classes.matchAll(/(?<![\w:-])bg-([a-z]+-\d{2,3})(?![\w-])/g)) {
          const swatch = bg[1];
          const colour = palette.get(swatch);
          if (!colour) continue;
          found.push({
            file,
            line: index + 1,
            swatch,
            ratio: contrastAgainstWhite(colour),
            kind: 'solid',
          });
        }

        // A gradient carries its colours in `from-`/`via-`/`to-`, so the `bg-`
        // matcher above sees nothing at all in `bg-gradient-to-r from-pink-500
        // to-rose-500`. Each stop is judged as its own ground.
        if (!classes.includes('bg-gradient')) continue;
        for (const stop of classes.matchAll(
          /(?<![\w:-])(?:from|via|to)-([a-z]+-\d{2,3})(?![\w-])/g
        )) {
          const swatch = stop[1];
          const colour = palette.get(swatch);
          if (!colour) continue;
          found.push({
            file,
            line: index + 1,
            swatch,
            ratio: contrastAgainstWhite(colour),
            kind: 'gradient',
          });
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
    expect(contrastAgainstWhite(palette.get('red-500') as Rgb)).toBeCloseTo(3.82, 1);
    expect(contrastAgainstWhite(palette.get('red-600') as Rgb)).toBeCloseTo(4.76, 1);
  });

  it("reads the project's own palette too, not only Tailwind's", () => {
    const palette = readPalette();

    // Most of the brand lives in `tailwind.config.js`, not in Tailwind's
    // defaults. A guard blind to it reports clean over the whole design system
    // while measuring only the utility colours.
    expect(palette.get('coral-500'), 'the project palette must be loaded').toBeDefined();
    expect(palette.get('sunset-500')).toBeDefined();
    expect(palette.get('ocean-500')).toBeDefined();
    expect(contrastAgainstWhite(palette.get('coral-500') as Rgb)).toBeCloseTo(1.99, 1);
  });

  it('finds pairings to check at all, in both class idioms', () => {
    // Without this, a regex that quietly stopped matching would leave the real
    // assertion below passing over an empty list forever. The bound sits just
    // under the current count rather than at a token value: the first version
    // of this file matched only `className="…"`, found 36 pairings, and sailed
    // past a `> 10` canary while blind to 16 more.
    const pairings = findWhiteOnColourPairings();
    expect(pairings.length).toBeGreaterThan(35);

    // And both idioms must be represented. `PhotoGridItem` writes its pairing
    // inside `className={…}`, which is the specific blindness that shipped here
    // once already.
    expect(pairings.some((pairing) => pairing.file.endsWith('PhotoGridItem.tsx'))).toBe(true);
  });

  it('measures gradients, not only solid backgrounds', () => {
    const gradients = findWhiteOnColourPairings().filter((pairing) => pairing.kind === 'gradient');

    // The most-used button style in the app is a gradient, and it was entirely
    // outside this guard until the stops were matched. A regex that stopped
    // seeing them would leave the gradient allowlist below trivially satisfied.
    expect(gradients.length).toBeGreaterThan(15);
    expect(gradients.some((pairing) => pairing.swatch === 'pink-500')).toBe(true);
  });

  it('has no pairing below the floor except the ones already recorded', () => {
    const offenders = findWhiteOnColourPairings()
      .filter((pairing) => pairing.ratio < AA_NORMAL_TEXT)
      .filter((pairing) =>
        pairing.kind === 'gradient'
          ? !KNOWN_GRADIENT_BELOW_FLOOR.has(pairing.swatch)
          : !KNOWN_BELOW_FLOOR.has(`${pairing.file}:${pairing.swatch}`)
      )
      .map(
        (pairing) =>
          `${pairing.file}:${pairing.line} bg-${pairing.swatch} ${pairing.ratio.toFixed(2)}:1`
      );

    expect(offenders).toEqual([]);
  });

  it('keeps the allowlist honest by failing when an entry is fixed', () => {
    // An allowlist nobody prunes becomes a list of things that were fixed years
    // ago. Every recorded pairing must still be present, still failing, and
    // still failing the same number of times — the count is what stops a file
    // with two bad pairings staying green after only one is fixed.
    const failingByKey = new Map<string, number>();
    for (const pairing of findWhiteOnColourPairings()) {
      if (pairing.kind !== 'solid' || pairing.ratio >= AA_NORMAL_TEXT) continue;
      const key = `${pairing.file}:${pairing.swatch}`;
      failingByKey.set(key, (failingByKey.get(key) ?? 0) + 1);
    }

    for (const [key, expected] of KNOWN_BELOW_FLOOR) {
      expect(
        failingByKey.get(key),
        `${key} is allowlisted for ${expected.count} pairing(s); if that has changed, update or remove the entry`
      ).toBe(expected.count);
    }

    // Same rule for the gradient idiom: fix some of the ten and this fails
    // until the count is corrected or the entry removed.
    const failingStops = new Map<string, number>();
    for (const pairing of findWhiteOnColourPairings()) {
      if (pairing.kind !== 'gradient' || pairing.ratio >= AA_NORMAL_TEXT) continue;
      failingStops.set(pairing.swatch, (failingStops.get(pairing.swatch) ?? 0) + 1);
    }
    for (const [swatch, expected] of KNOWN_GRADIENT_BELOW_FLOOR) {
      expect(
        failingStops.get(swatch),
        `${swatch} is allowlisted as a gradient stop in ${expected} place(s)`
      ).toBe(expected);
    }
  });
});
