/**
 * DW-125: the production-only halves of the base-path round trip.
 *
 * `vite.config.ts:11` is `base: mode === 'production' ? '/My-Love/' : '/'`, and
 * nothing in the repo ever observes the first arm. `vitest.config.ts` sets no
 * `base` and defines no `BASE_URL`, `tests/setup.ts` stubs nothing, and
 * `playwright.config.ts:178` boots the dev server with `npx vite --mode test`,
 * which serves `/`. So both production branches were dead code under test.
 *
 * The entry measured the consequence: rewriting the composition to
 * `base + basePath` and the stripping to `return pathname` left the whole unit
 * suite green at 91 files / 1705 passed, while on the deployed site those two
 * edits emit `/My-Love//photos` and then fail to strip it back, so no
 * `currentView` arm matches and the app resets to home on reload.
 *
 * The expectations here are hard-coded literals, never `import.meta.env.BASE_URL`
 * interpolated on both sides -- that is the mistake that made the existing
 * assertions vacuous, because a wrong base shifts input and expectation
 * together. `PRODUCTION_BASE` is bound to `vite.config.ts` at run time rather
 * than trusted as a constant, following
 * `tests/unit/api/supabaseClientAuthFlow.test.ts:31-40`, so a repo rename or a
 * custom-domain switch turns this red instead of shipping green.
 *
 * The env stub is global, so `afterEach` unstubs it AND asserts the unstub,
 * copying the leak guard at that file's `:125`/`:132`. Without the assertion a
 * leaked stub would surface only as an unrelated case failing later.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { stripBasePath, withBasePath } from '../../../src/utils/basePath';

/** The deployed base. Bound to vite.config.ts in `beforeAll`, not assumed. */
const PRODUCTION_BASE = '/My-Love/';

/** Every route the app can be on, from `navigationSlice`'s own pathMap. */
const ROUTES = ['/', '/photos', '/mood', '/partner', '/notes', '/settings'];

describe('base path composition and stripping', () => {
  beforeAll(async () => {
    const viteConfig = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      // Absolute on purpose: `loadConfigFromFile` resolves an explicit path
      // against `process.cwd()` and ignores its `configRoot` parameter.
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../vite.config.ts')
    );
    expect(viteConfig?.config.base).toBe(PRODUCTION_BASE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // Asserted, not assumed: deleting the line above must fail here rather than
    // somewhere unrelated three files later.
    expect(import.meta.env.BASE_URL).toBe('/');
  });

  describe('at the development base, where every other test runs', () => {
    it('leaves a route untouched in both directions', () => {
      expect(withBasePath('/photos')).toBe('/photos');
      expect(stripBasePath('/photos')).toBe('/photos');
    });

    it('leaves home untouched in both directions', () => {
      expect(withBasePath('/')).toBe('/');
      expect(stripBasePath('/')).toBe('/');
    });
  });

  describe('at the deployed base', () => {
    it('writes a route under the base without doubling the separator', () => {
      vi.stubEnv('BASE_URL', PRODUCTION_BASE);

      // The literal is the whole point. `base + basePath` would give
      // `/My-Love//photos`, which is what the entry measured as surviving.
      expect(withBasePath('/photos')).toBe('/My-Love/photos');
      expect(withBasePath('/settings')).toBe('/My-Love/settings');
    });

    it('writes home as the base itself', () => {
      vi.stubEnv('BASE_URL', PRODUCTION_BASE);

      expect(withBasePath('/')).toBe('/My-Love/');
    });

    it('strips the base back off, keeping the leading slash', () => {
      vi.stubEnv('BASE_URL', PRODUCTION_BASE);

      // `base.length` rather than `base.length - 1` would give `photos`, which
      // matches no arm of App's view chain and silently resets to home.
      expect(stripBasePath('/My-Love/photos')).toBe('/photos');
      expect(stripBasePath('/My-Love/')).toBe('/');
    });

    it('leaves a pathname that is not under the base alone', () => {
      vi.stubEnv('BASE_URL', PRODUCTION_BASE);

      // A stray absolute path must not be mangled into something that happens
      // to match a view.
      expect(stripBasePath('/photos')).toBe('/photos');
      expect(stripBasePath('/somewhere-else')).toBe('/somewhere-else');
    });

    it('round-trips every route the app can navigate to', () => {
      vi.stubEnv('BASE_URL', PRODUCTION_BASE);

      // The property that actually matters, and the one neither call site could
      // express while the two halves lived in different files: whatever setView
      // writes to the URL, a reload has to read back as the same route.
      for (const route of ROUTES) {
        const written = withBasePath(route);
        expect(written.startsWith(PRODUCTION_BASE), `${route} must be written under the base`).toBe(
          true
        );
        expect(written).not.toContain('//');
        expect(stripBasePath(written), `${route} must survive the round trip`).toBe(route);
      }
    });
  });
});
