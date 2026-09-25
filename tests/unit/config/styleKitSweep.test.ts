/**
 * The UI refresh's Success signal, kept holding: no component styles itself
 * outside the style kit.
 *
 * Every screen under `src/components/` draws its colours from the kit tokens in
 * `src/index.css` (`bg-card`, `text-ink`, `bg-fill`, ...). A raw hex value, a
 * palette gradient, a `coral-` class or the Dancing Script `font-cursive` is
 * the old styling coming back, and it is invisible in review because it still
 * renders. This scans the source rather than the build, so a hit names the
 * file and line to fix.
 *
 * One directory is excluded: `AdminPanel/`, which the refresh deliberately
 * left unstyled. It is pinned by exact count, not skipped, so a change to it
 * (a new gradient, or one removed) fails here and the pin is updated on
 * purpose.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const componentsDir = join(repoRoot, 'src/components');

const COLOURS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose', 'sunset', 'coral', 'ocean', 'lavender',
].join('|');

const COLOUR_PREFIXES = [
  'bg', 'text', 'border', 'ring', 'from', 'via', 'to', 'fill', 'stroke', 'outline', 'divide',
  'placeholder', 'shadow', 'decoration', 'caret', 'accent',
].join('|');

/**
 * Each pattern of the off-kit styling, named so a failure says which one hit.
 * A line is checked against every rule, so one line can yield several hits.
 */
const OFF_KIT: Array<[string, RegExp]> = [
  ['hex colour', /#[0-9a-fA-F]{3,8}\b/],
  ['coral scale', /coral-/],
  [
    'gradient background',
    /bg-gradient|bg-linear|bg-radial|bg-conic|(linear|radial|conic)-gradient\(/,
  ],
  ['palette shade', new RegExp(`\\b(${COLOUR_PREFIXES})-(${COLOURS})-\\d{2,3}\\b`)],
  ['Dancing Script font', /font-cursive/],
];

/**
 * The AdminPanel hits as of the sweep, per file and per rule, counted by line.
 * The gradients are AdminPanel.tsx:92,103,149, CreateMessageForm.tsx:237 and
 * EditMessageForm.tsx:252; the palette shades are the panel's unrestyled
 * pink/gray/rose utilities. Per rule, so swapping one off-kit idiom for
 * another on the same line still fails.
 */
const ADMIN_PANEL_PIN: Record<string, Record<string, number>> = {
  'src/components/AdminPanel/AdminPanel.tsx': { 'gradient background': 3, 'palette shade': 9 },
  'src/components/AdminPanel/CreateMessageForm.tsx': {
    'gradient background': 1,
    'palette shade': 23,
  },
  'src/components/AdminPanel/DeleteConfirmDialog.tsx': { 'palette shade': 11 },
  'src/components/AdminPanel/EditMessageForm.tsx': { 'gradient background': 1, 'palette shade': 29 },
  'src/components/AdminPanel/MessageList.tsx': { 'palette shade': 15 },
  'src/components/AdminPanel/MessageRow.tsx': { 'palette shade': 9 },
};

interface Hit {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function componentSources(): string[] {
  return (readdirSync(componentsDir, { recursive: true }) as string[])
    .filter((path) => /\.(ts|tsx|css)$/.test(path))
    .filter((path) => !path.split(sep).includes('__tests__'))
    .map((path) => join(componentsDir, path));
}

function scan(files: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const path of files) {
    const file = relative(repoRoot, path).split(sep).join('/');
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((text, index) => {
        for (const [rule, pattern] of OFF_KIT) {
          if (pattern.test(text)) hits.push({ file, line: index + 1, rule, text: text.trim() });
        }
      });
  }
  return hits;
}

function describeHits(hits: Hit[]): string {
  return hits.map((hit) => `${hit.file}:${hit.line} [${hit.rule}] ${hit.text}`).join('\n');
}

const isAdminPanel = (hit: Hit) => hit.file.startsWith('src/components/AdminPanel/');

describe('style kit sweep', () => {
  const files = componentSources();
  const hits = scan(files);

  it('scans the component tree at all', () => {
    // A glob that quietly matched nothing would leave every assertion below
    // passing over an empty list.
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((path) => path.endsWith(`Navigation${sep}AppNavigation.tsx`))).toBe(true);
  });

  it('finds no off-kit colour, gradient or font in src/components outside AdminPanel', () => {
    const offending = hits.filter((hit) => !isAdminPanel(hit));
    expect(offending, `off-kit styling found:\n${describeHits(offending)}`).toEqual([]);
  });

  it('pins the AdminPanel hits to the exact count found at the sweep', () => {
    const counts: Record<string, Record<string, number>> = {};
    for (const hit of hits.filter(isAdminPanel)) {
      const perRule = (counts[hit.file] ??= {});
      perRule[hit.rule] = (perRule[hit.rule] ?? 0) + 1;
    }
    expect(
      counts,
      'AdminPanel off-kit hits changed; if deliberate, update ADMIN_PANEL_PIN. Current hits:\n' +
        describeHits(hits.filter(isAdminPanel))
    ).toEqual(ADMIN_PANEL_PIN);
  });

  it('keeps Dancing Script out of the global stylesheet and the HTML shell', () => {
    const css = readFileSync(join(repoRoot, 'src/index.css'), 'utf8');
    expect(css).not.toMatch(/Dancing/);
    const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');
    expect(html).not.toMatch(/Dancing/);
  });

  it('keeps every hex in src/index.css inside a --kit-* or rose-scale definition', () => {
    // Comments stripped: the kit block's contrast notes quote the approved hex
    // values. Anything else holding a hex (the pre-kit pink scrollbar did) is a
    // colour outside the kit. The one exception is the project's rose scale in
    // the plain `@theme` block, which moved there from tailwind.config.js.
    // Each comment keeps its newlines, so reported line numbers stay true.
    const css = readFileSync(join(repoRoot, 'src/index.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      (comment) => comment.replace(/[^\n]/g, '')
    );
    const stray = css
      .split('\n')
      .map((text, index) => ({ line: index + 1, text: text.trim() }))
      .filter(({ text }) => /#[0-9a-fA-F]{3,8}\b/.test(text) && !/^--(?:kit-[\w-]+|color-rose-\d+):/.test(text));
    expect(stray, 'hex outside a --kit-* or rose-scale definition').toEqual([]);
  });

  it('keeps the theme in src/index.css, without the removed palettes or the cursive family', () => {
    // tailwind.config.js is gone; a returning `@config` would bring a second
    // theme source back.
    expect(existsSync(join(repoRoot, 'tailwind.config.js'))).toBe(false);
    const css = readFileSync(join(repoRoot, 'src/index.css'), 'utf8');
    expect(css).not.toMatch(/@config\b/);
    expect(css).not.toMatch(/sunset|coral|ocean|lavender|cursive/);
  });
});
