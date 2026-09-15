/**
 * The two halves of the deployed base path, kept together.
 *
 * The app is served from `/` in development and from `/My-Love/` on GitHub
 * Pages (`vite.config.ts:11`), so every route has to be written with the base
 * on and read with the base off. Those are inverse operations, and they used to
 * live in different files -- the composition inline in
 * `navigationSlice.setView`, the stripping inline in `App.getRoutePath` -- with
 * nothing asserting either, because every test and the whole E2E suite run at
 * `BASE_URL === '/'` and take the other arm of both branches.
 *
 * That is not a theoretical gap. DW-125 measured it: rewriting the composition
 * to `base + basePath` and the stripping to `return pathname` left the entire
 * unit suite green, while on the deployed site the first emits `/My-Love//photos`
 * and the second then fails to strip, so no `currentView` arm matches and the
 * app resets to home on every reload.
 *
 * Splitting them out is what makes the round trip assertable at the production
 * base, which is the property that actually matters and which neither call site
 * could express alone.
 *
 * `BASE_URL` is read per call rather than captured at module load, so a test can
 * stub it. Vite inlines it at build time either way.
 */

/**
 * The configured base, or `'/'` when it is unset.
 *
 * No normalisation happens here, and none is needed: Vite guarantees the value
 * ends in `/`, which is exactly the property both helpers below rely on. Said
 * out loud because they would be wrong without it, not because this enforces it.
 */
function currentBase(): string {
  return import.meta.env.BASE_URL || '/';
}

/**
 * Turn an in-app route like `/photos` into the path the browser should show.
 *
 * The slice is what avoids the doubled separator: the base ends in `/` and the
 * route begins with one, so they overlap by exactly one character.
 */
export function withBasePath(routePath: string): string {
  const base = currentBase();
  return base === '/' ? routePath : base.slice(0, -1) + routePath;
}

/**
 * Turn a browser pathname back into an in-app route.
 *
 * `base.length - 1` rather than `base.length`: the leading slash is part of the
 * route, and dropping it would leave `photos`, which matches no arm of the view
 * chain in `App`.
 */
export function stripBasePath(pathname: string): string {
  const base = currentBase();
  if (base !== '/' && pathname.startsWith(base)) {
    return pathname.slice(base.length - 1);
  }
  return pathname;
}
