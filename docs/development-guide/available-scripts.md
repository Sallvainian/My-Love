# Available Scripts

Every npm script defined in `package.json`, organized by category.

## Development

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `./scripts/dev-with-cleanup.sh` | Start Vite dev server with dotenvx decryption and signal-trapped process cleanup. Runs `dotenvx run --overload -- npx vite` in a subprocess, kills child processes on SIGINT/SIGTERM/EXIT. |
| `npm run dev:raw` | `vite` | Start Vite dev server directly without dotenvx or cleanup. Useful when you already have decrypted env vars in your shell. |
| `npm run preview` | `dotenvx run --overload -- npx vite preview` | Preview the production build locally. Requires `npm run build` first. Serves `dist/` at `http://localhost:4173/`. |

## Build

| Script | Command | Description |
|---|---|---|
| `npm run build` | `dotenvx run --overload -- bash -c 'tsc -b && vite build'` | Full production build: decrypt env vars via dotenvx, TypeScript compile (`tsc -b`), then Vite build with code splitting and PWA generation. Output goes to `dist/`. |
| `npm run typecheck` | `tsc --noEmit` | TypeScript type check only (no output files). Use to validate types without building. |

## Code Quality

| Script | Command | Description |
|---|---|---|
| `npm run lint` | `eslint src tests scripts ...` | Run ESLint on `src/`, `tests/`, and `scripts/` directories. Ignores Playwright report directories and build artifacts. |
| `npm run lint:fix` | `eslint ... --fix && prettier --write .` | Auto-fix ESLint issues, then format all files with Prettier. |
| `npm run format` | `prettier --write .` | Format all files with Prettier (writes changes). |
| `npm run format:check` | `prettier --check .` | Check formatting without modifying files. Returns non-zero exit code if any file needs formatting. |

## Testing

| Script | Command | Description |
|---|---|---|
| `npm run test:unit` | `vitest run` | Run all Vitest unit tests (single run, no watch). |
| `npm run test:unit:watch` | `vitest` | Run Vitest in watch mode. Re-runs tests on file changes. |
| `npm run test:unit:ui` | `vitest --ui` | Open Vitest interactive browser UI for exploring and running tests. |
| `npm run test:unit:coverage` | `vitest run --coverage` | Run unit tests with V8 coverage report. Enforces 80% thresholds on lines, functions, branches, and statements. |
| `npm run test:e2e` | `./scripts/test-with-cleanup.sh` | Run all Playwright E2E tests with signal-trapped process cleanup. Ensures Vite dev server and child processes are killed on exit. |
| `npm run test:e2e:raw` | `playwright test` | Run Playwright directly without cleanup wrapper. |
| `npm run test:e2e:ui` | `playwright test --ui` | Open Playwright interactive UI mode for running and debugging tests visually. |
| `npm run test:e2e:debug` | `playwright test --debug` | Run Playwright in step-through debug mode with the Playwright Inspector. |
| `npm run test:p0` | `playwright test --grep '\\[P0\\]'` | Run only Priority 0 (critical path) E2E tests. |
| `npm run test:p1` | `playwright test --grep '\\[P0\\]\\|\\[P1\\]'` | Run Priority 0 and Priority 1 E2E tests. |
| `npm run test:db` | `supabase test db` | Run pgTAP database tests via the Supabase CLI. Requires `supabase start`. |
| `npm run test:smoke` | `node scripts/smoke-tests.cjs` | Run pre-deploy smoke tests against the `dist/` directory. Validates index.html structure, PWA manifest, icons, JS bundles, and service worker. |
| `npm run test:burn-in` | `bash scripts/burn-in.sh` | Run flaky test detection. Executes Playwright tests in a configurable loop (default 10 iterations). Detects intermittent failures. |
| `npm run test:ci-local` | `bash scripts/ci-local.sh` | Mirror the CI pipeline locally: lint, unit tests, E2E tests, burn-in. Useful for pre-push validation. |

### Single Test File Execution

```bash
# Unit test -- single file
npx vitest run tests/unit/services/moodService.test.ts --silent

# E2E test -- single file
npx playwright test tests/e2e/mood/mood-tracker.spec.ts

# E2E test -- by grep pattern
npx playwright test --grep "mood tracker"

# E2E test -- P0 tests only in a specific directory
npx playwright test tests/e2e/scripture --grep "\[P0\]"
```

## Performance and Analysis

| Script | Command | Description |
|---|---|---|
| `npm run perf:build` | `mkdir -p docs/performance && npm run typecheck && vite build 2>&1 \| tee docs/performance/perf-build.log` | TypeScript check + production build with build output captured to a log file. |
| `npm run perf:bundle-report` | `npm run perf:build && node scripts/perf-bundle-report.mjs` | Generate a bundle size analysis report at `docs/performance/bundle-report.md`. Includes raw and gzip sizes for each chunk and CSS file. |

## Supabase

These commands use the Supabase CLI directly (not defined as npm scripts):

| Command | Description |
|---|---|
| `supabase start` | Start local Supabase stack (Postgres 17, Auth, Storage, Realtime, Studio). Requires Docker. |
| `supabase stop` | Stop local Supabase. |
| `supabase stop --no-backup` | Stop local Supabase without creating a database backup (faster, used in CI). |
| `supabase status` | Show local Supabase connection URLs, keys, and service status. |
| `supabase db reset` | Reset local database: drop all data, re-run all migrations, re-seed from `seed.sql`. |
| `supabase migration new <name>` | Create a new empty migration file in `supabase/migrations/` with the current timestamp. |
| `supabase gen types typescript --local > src/types/database.types.ts` | Regenerate TypeScript types from the local database schema. |
| `supabase gen types typescript --project-id xojempkrugifnaveqtqc > src/types/database.types.ts` | Regenerate TypeScript types from the remote Supabase project. Requires `SUPABASE_ACCESS_TOKEN`. |
| `supabase test db` | Run pgTAP database tests in `supabase/tests/database/`. |

## Deployment

| Script | Command | Description |
|---|---|---|
| `npm run predeploy` | `npm run build && npm run test:smoke` | Automatically runs before `deploy`. Builds the app and validates the output with smoke tests. |
| `npm run deploy` | `gh-pages -d dist` | Deploy `dist/` to GitHub Pages via the `gh-pages` package. Runs `predeploy` automatically first. |
| `npm run postdeploy` | `echo 'Deployment complete! ...'` | Prints post-deployment instructions including the health check command. |

### Post-Deploy Health Check

```bash
node scripts/post-deploy-check.cjs https://sallvainian.github.io/My-Love/
```

Informational check (does not block deployment). Verifies HTTP 200 response, viewport meta tag, manifest link, PWA manifest structure, and provides service worker verification guidance.
