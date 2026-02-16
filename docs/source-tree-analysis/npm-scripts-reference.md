# npm Scripts Reference

## Development

| Script | Command | Purpose |
|---|---|---|
| `dev` | `./scripts/dev-with-cleanup.sh` | Start dev server with stale process cleanup |
| `dev:raw` | `vite` | Start Vite dev server directly |
| `preview` | `dotenvx run --overload -- npx vite preview` | Preview production build locally |

## Build

| Script | Command | Purpose |
|---|---|---|
| `build` | `dotenvx run --overload -- bash -c 'tsc -b && vite build'` | TypeScript build + Vite production bundle |
| `perf:build` | `mkdir -p docs/performance && npm run typecheck && vite build 2>&1 \| tee docs/performance/perf-build.log` | Build with performance logging |
| `perf:bundle-report` | `npm run perf:build && node scripts/perf-bundle-report.mjs` | Build + generate bundle size report |

## Type Checking & Linting

| Script | Command | Purpose |
|---|---|---|
| `typecheck` | `tsc --noEmit` | TypeScript type checking without emit |
| `lint` | `eslint src tests scripts --no-error-on-unmatched-pattern ...` | ESLint with exclusion patterns |
| `lint:fix` | `eslint ... --fix && prettier --write .` | Auto-fix lint errors + format |
| `format` | `prettier --write .` | Format all files with Prettier |
| `format:check` | `prettier --check .` | Check formatting without writing |

## Unit Tests (Vitest)

| Script | Command | Purpose |
|---|---|---|
| `test:unit` | `vitest run` | Run unit tests (single pass) |
| `test:unit:watch` | `vitest` | Run unit tests in watch mode |
| `test:unit:ui` | `vitest --ui` | Run unit tests with browser UI |
| `test:unit:coverage` | `vitest run --coverage` | Run unit tests with coverage report |

## E2E Tests (Playwright)

| Script | Command | Purpose |
|---|---|---|
| `test:e2e` | `./scripts/test-with-cleanup.sh` | Run E2E tests with process cleanup |
| `test:e2e:raw` | `playwright test` | Run Playwright tests directly |
| `test:e2e:ui` | `playwright test --ui` | Run Playwright with interactive UI |
| `test:e2e:debug` | `playwright test --debug` | Run Playwright in debug mode |
| `test:p0` | `playwright test --grep '\\[P0\\]'` | Run P0 (critical) priority tests only |
| `test:p1` | `playwright test --grep '\\[P0\\]\\|\\[P1\\]'` | Run P0 + P1 priority tests |
| `test:burn-in` | `bash scripts/burn-in.sh` | Run tests multiple times to find flaky tests |

## Other Tests

| Script | Command | Purpose |
|---|---|---|
| `test:smoke` | `node scripts/smoke-tests.cjs` | Post-build smoke tests on `dist/` output |
| `test:db` | `supabase test db` | Run Supabase database tests (RLS, functions) |
| `test:ci-local` | `bash scripts/ci-local.sh` | Run full CI pipeline locally |

## Deployment

| Script | Command | Purpose |
|---|---|---|
| `predeploy` | `npm run build && npm run test:smoke` | Build + validate before deploy |
| `deploy` | `gh-pages -d dist` | Publish `dist/` to GitHub Pages |
| `postdeploy` | `echo 'Deployment complete! ...'` | Print post-deploy check reminder |

## Script Details

### `build`

```bash
dotenvx run --overload -- bash -c 'tsc -b && vite build'
```

1. `dotenvx run --overload` -- Load encrypted `.env` files with override precedence
2. `tsc -b` -- Full TypeScript project build (type checking + declaration emit)
3. `vite build` -- Production bundle with:
   - Manual chunk splitting (react, supabase, state, animation, icons)
   - PWA manifest and Service Worker injection
   - Bundle visualizer output at `dist/stats.html`

### `dev`

```bash
./scripts/dev-with-cleanup.sh
```

Wrapper script that:
1. Kills orphaned Vite dev servers from previous runs
2. Starts `vite` dev server
3. Ensures clean shutdown on exit

### `test:e2e`

```bash
./scripts/test-with-cleanup.sh
```

Wrapper script that:
1. Kills orphaned browser instances from previous test runs
2. Runs `playwright test`
3. Cleans up after completion

### `lint`

```bash
eslint src tests scripts \
  --no-error-on-unmatched-pattern \
  --ignore-pattern 'tests/playwright-report/**' \
  --ignore-pattern 'tests/test-results/**' \
  --ignore-pattern 'playwright-report/**' \
  --ignore-pattern 'test-results/**' \
  --ignore-pattern '_bmad-output/**' \
  --ignore-pattern '_bmad/**' \
  --ignore-pattern '.codex/**'
```

Lints `src/`, `tests/`, and `scripts/` while ignoring test output directories and generated files.

### `test:ci-local`

Runs the full CI pipeline locally:

```bash
npm run typecheck    # 1. Type checking
npm run lint         # 2. Linting
npm run test:unit    # 3. Unit tests
npm run build        # 4. Production build
npm run test:smoke   # 5. Smoke tests
npm run test:e2e     # 6. E2E tests
```
