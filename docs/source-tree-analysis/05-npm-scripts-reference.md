# NPM Scripts Reference

All scripts are defined in `package.json`. The package manager is **npm** (lock file: `package-lock.json`).

## Development

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `./scripts/dev-with-cleanup.sh` | Start dev server (runs cleanup script wrapper) |
| `dev:raw` | `vite` | Start Vite dev server directly |
| `preview` | `dotenvx run --overload -- npx vite preview` | Preview production build (decrypts .env) |

## Build

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `dotenvx run --overload -- bash -c 'tsc -b && vite build'` | Production build (decrypt env, type check, bundle) |
| `perf:build` | `mkdir -p docs/performance && npm run typecheck && vite build 2>&1 \| tee docs/performance/perf-build.log` | Build with performance logging |
| `perf:bundle-report` | `npm run perf:build && node scripts/perf-bundle-report.mjs` | Build + generate bundle analysis |

## Code Quality

| Script | Command | Description |
|--------|---------|-------------|
| `typecheck` | `tsc --noEmit` | Type check without emitting files |
| `lint` | `eslint src tests scripts --no-error-on-unmatched-pattern ...` | Run ESLint on all source |
| `lint:fix` | `eslint ... --fix && prettier --write .` | Auto-fix lint + format |
| `format` | `prettier --write .` | Format all files |
| `format:check` | `prettier --check .` | Check formatting (CI) |

## Unit Tests

| Script | Command | Description |
|--------|---------|-------------|
| `test:unit` | `vitest run` | Run all unit tests |
| `test:unit:watch` | `vitest` | Watch mode (re-run on file changes) |
| `test:unit:ui` | `vitest --ui` | Browser-based Vitest UI |
| `test:unit:coverage` | `vitest run --coverage` | Run with V8 coverage (80% threshold) |

**Single file example:**
```bash
npx vitest run tests/unit/services/moodService.test.ts --silent
```

## E2E Tests

| Script | Command | Description |
|--------|---------|-------------|
| `test:e2e` | `./scripts/test-with-cleanup.sh` | All E2E tests (cleanup wrapper) |
| `test:e2e:raw` | `playwright test` | Run Playwright directly |
| `test:e2e:ui` | `playwright test --ui` | Playwright UI mode |
| `test:e2e:debug` | `playwright test --debug` | Playwright debug mode |
| `test:p0` | `playwright test --grep '\\[P0\\]'` | Priority 0 (critical path) only |
| `test:p1` | `playwright test --grep '\\[P0\\]\|\\[P1\\]'` | Priority 0 + 1 |
| `test:burn-in` | `bash scripts/burn-in.sh` | Burn-in test (repeated runs) |

**Single file example:**
```bash
npx playwright test tests/e2e/mood/mood-tracker.spec.ts
```

**Pattern matching:**
```bash
npx playwright test --grep "mood tracker"
```

## Database Tests

| Script | Command | Description |
|--------|---------|-------------|
| `test:db` | `supabase test db` | Run pgTAP database tests |

## Smoke Tests

| Script | Command | Description |
|--------|---------|-------------|
| `test:smoke` | `node scripts/smoke-tests.cjs` | Post-build verification |
| `test:ci-local` | `bash scripts/ci-local.sh` | Run CI checks locally |

## Deployment

| Script | Command | Description |
|--------|---------|-------------|
| `predeploy` | `npm run build && npm run test:smoke` | Build + smoke test (auto-runs before deploy) |
| `deploy` | `gh-pages -d dist` | Deploy dist/ to gh-pages branch |
| `postdeploy` | `echo 'Deployment complete!...'` | Post-deploy instructions |

## Supabase CLI (Manual Commands)

These are not npm scripts but commonly used commands:

| Command | Description |
|---------|-------------|
| `supabase start` | Start local Supabase (required for E2E tests) |
| `supabase stop` | Stop local Supabase |
| `supabase status` | Show connection URLs and keys |
| `supabase db reset` | Reset DB and re-run all migrations |
| `supabase migration new <name>` | Create new migration file |
| `supabase gen types typescript --local > src/types/database.types.ts` | Regenerate TypeScript types |

## Script Dependencies

```
predeploy -> build -> typecheck + vite build
predeploy -> test:smoke
deploy -> gh-pages -d dist
perf:bundle-report -> perf:build -> typecheck + vite build
```

## Related Documentation

- [Technology Stack Summary](./01-technology-stack-summary.md)
- [Architecture - Deployment](../architecture/15-deployment.md)
- [Architecture - Testing Architecture](../architecture/16-testing-architecture.md)
