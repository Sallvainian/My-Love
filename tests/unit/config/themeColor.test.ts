/**
 * The browser chrome and the installed PWA's status bar match the kit page
 * background, `--kit-page` in `src/index.css`, in both colour schemes.
 *
 * Every expected value is read from `src/index.css`, so a change to the page
 * colour that forgets `index.html` or the manifest fails here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** `--kit-page` as `src/index.css` declares it: light first, then the dark override. */
function kitPage(): { light: string; dark: string } {
  const css = readFileSync('src/index.css', 'utf8');
  const values = [...css.matchAll(/--kit-page:\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => m[1]);
  expect(values).toHaveLength(2);
  return { light: values[0], dark: values[1] };
}

describe('theme colour', () => {
  it('index.html scopes one theme-color meta to each colour scheme', () => {
    const doc = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
    const metas = [...doc.querySelectorAll('meta[name="theme-color"]')].map((meta) => ({
      media: meta.getAttribute('media'),
      content: meta.getAttribute('content'),
    }));
    const { light, dark } = kitPage();

    expect(metas).toEqual([
      { media: '(prefers-color-scheme: light)', content: light },
      { media: '(prefers-color-scheme: dark)', content: dark },
    ]);
  });

  it('the manifest theme and background colours are the light page colour', () => {
    const source = readFileSync('vite.config.ts', 'utf8');
    const { light } = kitPage();

    expect(source.match(/theme_color:\s*'([^']+)'/)?.[1]).toBe(light);
    expect(source.match(/background_color:\s*'([^']+)'/)?.[1]).toBe(light);
  });
});
