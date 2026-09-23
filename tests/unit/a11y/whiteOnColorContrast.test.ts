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
 * restating it: every `text-white` pairing in `src/` with a `bg-<colour>-<shade>`
 * or a style-kit token (`bg-fill`, `bg-partner`) is measured against the real
 * palettes, so a NEW one below the floor fails
 * without anyone having to remember this rule. That is the difference between
 * this and a test that asserts two class strings -- which would pass while the
 * next component shipped the same defect.
 *
 * Every palette -- Tailwind's, the project's and the kit's in `src/index.css`
 * -- is read at run time rather than hard-coded, so an upgrade or a brand
 * change re-checks every pairing instead of leaving this green against stale
 * constants.
 *
 * Measured for the entry's own two colours, and matching the figures it
 * recorded: `red-500` is #fb2c36 at 3.82:1, `red-600` is #e7000b at 4.76:1.
 *
 * Scope, deliberately narrow:
 *  - Only the unprefixed `bg-` utility, with a palette shade or a kit token.
 *    `hover:`, `focus:` and `dark:` variants describe other states against
 *    other grounds and would need their own model; AA is defined on the resting
 *    state, which is what this measures. (A kit token needs no `dark:` variant:
 *    its own value switches with the theme, and both values are measured.)
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
 *
 * Style-kit tokens are measured in both themes and judged in the one where
 * white reads worse. A translucent (rgba) value is composited over the kit's
 * own page and card grounds for that theme and judged over the worse of the
 * two, so no kit pairing goes unmeasured. See readKitPalette().
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

/**
 * Tailwind's own swatches, stated in oklch.
 *
 * Resolved through Node (DW-178) rather than joined onto `repoRoot`: a loop
 * worktree has no `node_modules` of its own, and a hand-built path failed there
 * with ENOENT where resolution walks up to the repo's. Tailwind's package
 * `exports` lists `./theme.css`, so this is a supported entry, not a deep path.
 */
function readBuiltInPalette(): Map<string, Rgb> {
  const themeCss = createRequire(import.meta.url).resolve('tailwindcss/theme.css');
  const css = readFileSync(themeCss, 'utf8');
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
 * The palette THIS project adds on top of Tailwind's.
 *
 * `src/index.css:4` is `@config '../tailwind.config.js'`, and that file extends
 * `theme.colors` with its own `rose` scale, in hex. A guard that read only
 * Tailwind's built-ins would silently skip any project scale — and silently is
 * the word, because an unknown swatch is indistinguishable from a class that is
 * not a colour at all. The love-notes send button was once `bg-coral-500`, the
 * worst pairing in the tree, and it was invisible here until this function
 * existed.
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

type Theme = 'light' | 'dark';

const THEMES: Theme[] = ['light', 'dark'];

/**
 * The kit grounds a translucent token is composited over: the page, and the
 * card that sits on it. Read per theme from the same file as the token.
 */
const COMPOSITE_GROUNDS = ['page', 'card'];

/** One kit value as written, parsed; `alpha` is 1 for an opaque colour. */
interface KitValue {
  value: string;
  rgb: Rgb;
  alpha: number;
}

type KitColour = Record<Theme, KitValue>;

/** The text between the first `{` at or after `from` and the brace closing it. */
function blockAfter(css: string, from: number): string {
  const open = css.indexOf('{', from);
  let depth = 0;
  for (let index = open; index < css.length; index++) {
    if (css[index] === '{') depth++;
    else if (css[index] === '}' && --depth === 0) return css.slice(open + 1, index);
  }
  throw new Error(`src/index.css: no closing brace for the block at offset ${from}`);
}

function kitDeclarations(css: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const match of css.matchAll(/--kit-([a-z0-9-]+):\s*([^;]+);/g)) {
    declarations.set(match[1], match[2].trim());
  }
  return declarations;
}

/**
 * The style kit's colour tokens (`bg-fill`, `bg-partner`, ...), per theme.
 *
 * DW-173/175: the matcher above only knew `<colour>-<shade>`, so `text-white`
 * on a kit token was never measured in either theme, and a dark-mode white on
 * `#a78bfa` badge (2.7:1) once passed. `src/index.css` maps each `--color-X`
 * utility to `var(--kit-X)` in `@theme inline`, sets the light values in
 * `:root` and redefines them under `prefers-color-scheme: dark`. All three are
 * read here, so a token added, renamed or recoloured is measured without this
 * file changing.
 *
 * A token the dark block does not redefine keeps its light value, which is
 * what the cascade does. One the light block does not define is a parse that
 * went wrong, and throws rather than dropping the token from the scan.
 */
function readKitPalette(): Map<string, KitColour> {
  const css = readFileSync(resolve(repoRoot, 'src/index.css'), 'utf8');

  const themeAt = css.indexOf('@theme inline');
  const darkAt = css.indexOf('@media (prefers-color-scheme: dark)');
  if (themeAt < 0 || darkAt < 0) {
    throw new Error('src/index.css: `@theme inline` or the dark-scheme block has moved');
  }
  const darkBlock = blockAfter(css, darkAt);
  const dark = kitDeclarations(darkBlock);
  const light = kitDeclarations(css.replace(darkBlock, ''));

  const kit = new Map<string, KitColour>();
  for (const match of blockAfter(css, themeAt).matchAll(
    /--color-([a-z0-9]+):\s*var\(--kit-([a-z0-9-]+)\)/g
  )) {
    const [, token, name] = match;
    const lightValue = light.get(name);
    if (!lightValue) throw new Error(`src/index.css: --kit-${name} has no light value`);
    const values = { light: lightValue, dark: dark.get(name) ?? lightValue };
    kit.set(token, {
      light: { value: values.light, ...parseKitColour(name, values.light) },
      dark: { value: values.dark, ...parseKitColour(name, values.dark) },
    });
  }
  return kit;
}

/**
 * A kit value as sRGB plus alpha: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`,
 * `rgb()` or `rgba()`, comma- or space-separated. Anything else throws. A
 * format this cannot read must not quietly drop a token from the scan: a
 * recolour to `oklch()` would otherwise exempt it without anyone noticing.
 */
function parseKitColour(name: string, value: string): { rgb: Rgb; alpha: number } {
  const hex = value.match(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    const channels = (digits.match(/../g) ?? []).map((pair) => parseInt(pair, 16) / 255);
    return { rgb: channels.slice(0, 3) as Rgb, alpha: channels[3] ?? 1 };
  }

  const fn = value.match(/^rgba?\(\s*([^)]*)\)$/);
  if (fn) {
    const parts = fn[1].split(/\s*[,/]\s*|\s+/).filter(Boolean);
    const numeric = /^\d+(\.\d+)?%?$/;
    if ((parts.length === 3 || parts.length === 4) && parts.every((part) => numeric.test(part))) {
      const read = (part: string, scale: number) =>
        part.endsWith('%') ? parseFloat(part) / 100 : parseFloat(part) / scale;
      return {
        rgb: parts.slice(0, 3).map((part) => read(part, 255)) as Rgb,
        alpha: parts[3] === undefined ? 1 : read(parts[3], 1),
      };
    }
  }

  throw new Error(`src/index.css: cannot read --kit-${name}: ${value}`);
}

/** `top` at `alpha` over an opaque `ground`, the way a browser blends them. */
function composite(top: Rgb, alpha: number, ground: Rgb): Rgb {
  return top.map((channel, index) => alpha * channel + (1 - alpha) * ground[index]) as Rgb;
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
  /**
   * For a kit token, the theme `ratio` was measured in: the worse of the two,
   * or `both` when they are the same colour. A palette shade has one value.
   */
  theme?: Theme | 'both';
  /** For a translucent kit token, the kit ground it was composited over. */
  over?: string;
}

type Ground = Pick<Pairing, 'ratio' | 'theme' | 'over'>;

/**
 * White on one kit token in one theme. An opaque value is measured as is. A
 * translucent one is composited over each of COMPOSITE_GROUNDS in the same
 * theme and judged over the ground where it reads worst, so nothing is skipped.
 */
function measureKitTheme(kit: Map<string, KitColour>, token: KitColour, theme: Theme): Ground {
  const { rgb, alpha } = token[theme];
  if (alpha === 1) return { ratio: contrastAgainstWhite(rgb), theme };

  const measured = COMPOSITE_GROUNDS.map((name) => {
    const ground = kit.get(name)?.[theme];
    if (!ground || ground.alpha !== 1) {
      throw new Error(`src/index.css: --kit-${name} must be an opaque ${theme} ground`);
    }
    return { ratio: contrastAgainstWhite(composite(rgb, alpha, ground.rgb)), theme, over: name };
  });
  return measured.reduce((worst, next) => (next.ratio < worst.ratio ? next : worst));
}

/**
 * White against one swatch: a palette shade, or a kit token judged in the
 * theme where it reads worse. `undefined` means the name is not a colour this
 * guard knows (`bg-white`, `bg-black/50`, `bg-transparent`).
 */
function measureGround(
  swatch: string,
  palette: Map<string, Rgb>,
  kit: Map<string, KitColour>
): Ground | undefined {
  const shade = palette.get(swatch);
  if (shade) return { ratio: contrastAgainstWhite(shade) };

  const token = kit.get(swatch);
  if (!token) return undefined;
  const [light, dark] = THEMES.map((theme) => measureKitTheme(kit, token, theme));
  if (light.ratio === dark.ratio && light.over === dark.over) return { ...light, theme: 'both' };
  return light.ratio <= dark.ratio ? light : dark;
}

/**
 * Gradient stops below the floor, keyed by swatch rather than by file.
 *
 * Empty after DW-143 promoted the resting CTA from `pink-500`/`rose-500`
 * (3.58:1 / 3.67:1) to `pink-600`/`rose-600`. Kept as a Map so the honesty
 * loop below still has a place to record a new failing idiom.
 */
const KNOWN_GRADIENT_BELOW_FLOOR = new Map<string, number>();

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

/**
 * Every white-on-colour pairing on one source line.
 *
 * Split out of the file walk so the idiom canary below can run against a fixed
 * line: the `className={…}` conditional it guards has been styled out of every
 * component, and a canary that needs a live example in `src/` would have to go
 * with it.
 */
function pairingsOnLine(
  text: string,
  palette: Map<string, Rgb>,
  kit: Map<string, KitColour>,
  file: string,
  line: number
): Pairing[] {
  const found: Pairing[] = [];
  const judge = (swatch: string, kind: Pairing['kind']) => {
    const ground = measureGround(swatch, palette, kit);
    if (ground) found.push({ file, line, swatch, kind, ...ground });
  };
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
    //
    // The second alternative is a bare kit token (`bg-fill`, `bg-card2`);
    // measureGround() looks it up in the `@theme` mapping and ignores any name
    // that is not there, such as `bg-white` or `bg-transparent`.
    for (const bg of classes.matchAll(/(?<![\w:-])bg-([a-z]+-\d{2,3}|[a-z][a-z0-9]*)(?![\w-])/g)) {
      judge(bg[1], 'solid');
    }

    // A gradient carries its colours in `from-`/`via-`/`to-`, so the `bg-`
    // matcher above sees nothing at all in `bg-gradient-to-r from-pink-500
    // to-rose-500`. Each stop is judged as its own ground.
    if (!classes.includes('bg-gradient')) continue;
    for (const stop of classes.matchAll(
      /(?<![\w:-])(?:from|via|to)-([a-z]+-\d{2,3}|[a-z][a-z0-9]*)(?![\w-])/g
    )) {
      judge(stop[1], 'gradient');
    }
  }
  return found;
}

function findWhiteOnColourPairings(): Pairing[] {
  const palette = readPalette();
  const kit = readKitPalette();
  const files = componentFiles(resolve(repoRoot, 'src'));
  const found: Pairing[] = [];

  for (const absolute of files) {
    const file = relative(repoRoot, absolute).split('\\').join('/');

    const lines = readFileSync(absolute, 'utf8').split('\n');
    lines.forEach((text, index) => {
      found.push(...pairingsOnLine(text, palette, kit, file, index + 1));
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
    const palette = readProjectPalette();

    // `tailwind.config.js` extends Tailwind's defaults with its own scale. A
    // guard blind to it reports clean while measuring only the utility colours.
    // Read from the config itself (#e11d48), not the built-in rose-600.
    expect(palette.get('rose-600'), 'the project palette must be loaded').toBeDefined();
    expect(contrastAgainstWhite(palette.get('rose-600') as Rgb)).toBeCloseTo(4.7, 1);
    // And the merged palette the scan uses carries the project's value, so the
    // project map cannot be dropped from readPalette() or lose the merge.
    expect(readPalette().get('rose-600')).toEqual(palette.get('rose-600'));
  });

  it('reads the style kit tokens from src/index.css, in both themes', () => {
    const kit = readKitPalette();

    // Solid and translucent tokens alike, so a parse that lost the `@theme`
    // mapping or either theme block shows here.
    expect([...kit.keys()]).toEqual(
      expect.arrayContaining(['fill', 'partner', 'good', 'danger', 'tint', 'glass'])
    );
    expect(kit.get('partner')?.light.value).toBe('#7c3aed');
    expect(kit.get('partner')?.dark.value).toBe('#a78bfa');
    // The same fill in both themes, at the 4.60:1 index.css records.
    expect(kit.get('fill')?.light.value).toBe(kit.get('fill')?.dark.value);
    expect(contrastAgainstWhite(kit.get('fill')?.light.rgb as Rgb)).toBeCloseTo(4.6, 1);
    // tint is a solid hex in light and rgba in dark, and both are read.
    expect(kit.get('tint')?.light.alpha).toBe(1);
    expect(kit.get('tint')?.dark.alpha).toBeCloseTo(0.14, 2);
  });

  it('reads every colour format the kit may use, and throws on any other', () => {
    const white: Rgb = [1, 1, 1];
    expect(parseKitColour('x', '#fff')).toEqual({ rgb: white, alpha: 1 });
    expect(parseKitColour('x', '#ffffff')).toEqual({ rgb: white, alpha: 1 });
    expect(parseKitColour('x', '#ffffff00')).toEqual({ rgb: white, alpha: 0 });
    expect(parseKitColour('x', 'rgb(255, 255, 255)')).toEqual({ rgb: white, alpha: 1 });
    expect(parseKitColour('x', 'rgba(255, 255, 255, 0.5)')).toEqual({ rgb: white, alpha: 0.5 });
    expect(parseKitColour('x', 'rgb(255 255 255 / 50%)')).toEqual({ rgb: white, alpha: 0.5 });
    // A recolour to a format this cannot read must fail, not exempt the token.
    expect(() => parseKitColour('x', 'oklch(0.7 0.1 300)')).toThrow('--kit-x');
    expect(() => parseKitColour('x', 'var(--kit-y)')).toThrow('--kit-x');
  });

  it('composites a translucent kit token over the kit grounds it sits on', () => {
    // glass is rgba in both themes. In light it is 80% white, so over the white
    // card white text all but vanishes; over the pink-white page it is barely
    // better. The ground where white reads worse is the one reported.
    const kit = readKitPalette();
    const found = pairingsOnLine("'bg-glass text-white'", readPalette(), kit, 'fixture.tsx', 1);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ swatch: 'glass', theme: 'light', over: 'card' });
    expect(found[0].ratio).toBeCloseTo(1, 2);

    // Dark glass is 78% of #11151e, over grounds darker still: it clears AA, and
    // is measured over a kit ground rather than skipped.
    const dark = measureKitTheme(kit, kit.get('glass') as KitColour, 'dark');
    expect(COMPOSITE_GROUNDS).toContain(dark.over);
    expect(dark.ratio).toBeGreaterThan(AA_NORMAL_TEXT);
  });

  it('measures white on a kit token in the theme where it reads worse', () => {
    // DW-173/175: a dark-mode white-on-#a78bfa badge (2.72:1) once passed this
    // guard, because `bg-partner` is not `<colour>-<shade>`. Light #7c3aed
    // clears AA at 5.70:1, so only the worse-theme rule catches it.
    const found = pairingsOnLine(
      "'rounded-full bg-partner text-white'",
      readPalette(),
      readKitPalette(),
      'fixture.tsx',
      1
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ swatch: 'partner', kind: 'solid', theme: 'dark' });
    expect(found[0].ratio).toBeCloseTo(2.72, 1);
    expect(found[0].ratio).toBeLessThan(AA_NORMAL_TEXT);
  });

  it('fails white on a tint, which is solid in light and translucent in dark', () => {
    // tint is #fce7f3 in light (white on it 1.18:1) and rgba in dark. The first
    // version of the kit matcher sent a token translucent in either theme to an
    // "unmeasured" list, so this pairing passed on the theme where it is worst.
    const found = pairingsOnLine(
      "'bg-tint text-white'",
      readPalette(),
      readKitPalette(),
      'fixture.tsx',
      1
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ swatch: 'tint', kind: 'solid', theme: 'light' });
    expect(found[0].ratio).toBeCloseTo(1.18, 1);
    expect(found[0].ratio).toBeLessThan(AA_NORMAL_TEXT);
  });

  it('finds pairings to check at all, in both class idioms', () => {
    // Without this, a regex that quietly stopped matching would leave the real
    // assertion below passing over an empty list forever. The bound sits just
    // under the current count rather than at a token value: the first version
    // of this file matched only `className="…"`, found 36 pairings, and sailed
    // past a `> 10` canary while blind to 16 more.
    //
    // Re-set to just under the count as each kit story styles pairings out:
    // 41 before the Photos restyle, 26 after it; 17 before the Sign in and
    // remaining-surfaces restyle, 10 after it. 9 before kit tokens were
    // matched (DW-173/175), 29 after: 20 of them are `bg-fill`.
    const pairings = findWhiteOnColourPairings();
    expect(pairings.length).toBeGreaterThan(27);
    // The kit matcher on its own, so it cannot go blind behind palette hits.
    expect(pairings.filter((pairing) => pairing.theme).length).toBeGreaterThan(18);

    // And both idioms must be seen. A pairing inside `className={…}` is the
    // specific blindness that shipped here once already. The last one in `src/`
    // (PhotoGridItem's owner badge) moved onto kit tokens, so the idiom is
    // checked against the line it used to be.
    const conditional = pairingsOnLine(
      "photo.isOwn ? 'bg-pink-600 text-white' : 'bg-blue-600 text-white'",
      readPalette(),
      readKitPalette(),
      'fixture.tsx',
      1
    );
    expect(conditional.map((pairing) => pairing.swatch)).toEqual(['pink-600', 'blue-600']);
  });

  it('measures gradients, not only solid backgrounds', () => {
    const gradients = findWhiteOnColourPairings().filter((pairing) => pairing.kind === 'gradient');

    // The most-used button style in the app is a gradient, and it was entirely
    // outside this guard until the stops were matched. A regex that stopped
    // seeing them would leave the gradient allowlist below trivially satisfied.
    // 16 stops before the Photos restyle removed its upload FAB, 14 after;
    // 8 after the Sign in and remaining-surfaces restyle.
    expect(gradients.length).toBeGreaterThan(6);
    expect(gradients.some((pairing) => pairing.swatch === 'pink-600')).toBe(true);
  });

  it('has no pairing below the floor except the ones already recorded', () => {
    const offenders = findWhiteOnColourPairings()
      .filter((pairing) => pairing.ratio < AA_NORMAL_TEXT)
      .filter((pairing) =>
        pairing.kind === 'gradient'
          ? !KNOWN_GRADIENT_BELOW_FLOOR.has(pairing.swatch)
          : !KNOWN_BELOW_FLOOR.has(`${pairing.file}:${pairing.swatch}`)
      )
      .map((pairing) => {
        const where = [pairing.theme, pairing.over && `over ${pairing.over}`].filter(Boolean);
        return (
          `${pairing.file}:${pairing.line} bg-${pairing.swatch} ${pairing.ratio.toFixed(2)}:1` +
          (where.length > 0 ? ` (${where.join(', ')})` : '')
        );
      });

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
