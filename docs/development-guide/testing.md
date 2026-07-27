# Testing

## Overview

The project uses multiple testing layers:

| Layer             | Framework         | Location                                | Environment                            |
| ----------------- | ----------------- | --------------------------------------- | -------------------------------------- |
| Unit tests        | Vitest 4.1.10     | `tests/unit/`, `src/**/*.test.{ts,tsx}` | happy-dom                              |
| E2E tests         | Playwright 1.62.0 | `tests/e2e/`                            | Real Chromium browser + local Supabase |
| API tests         | Playwright 1.62.0 | `tests/api/`                            | Supabase API endpoints                 |
| Integration tests | Playwright 1.62.0 | `tests/integration/`                    | Playwright integration project         |
| Database tests    | pgTAP             | `supabase/tests/database/`              | Local Supabase Postgres 17             |

Additional test types: smoke tests (pre-deploy validation), burn-in (flaky detection), and failure analysis (AI-friendly Markdown summaries).

## Unit Tests (Vitest)

### Running

```bash
npm run test:unit              # Single run
npm run test:unit:watch        # Watch mode (re-runs on file changes)
npm run test:unit:ui           # Interactive browser UI
npm run test:unit:coverage     # With V8 coverage report
```

Single file:

```bash
npx vitest run tests/unit/services/moodService.test.ts --silent
```

### Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://xojempkrugifnaveqtqc.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY': JSON.stringify(
      'test-anon-key-for-unit-tests'
    ),
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/vitest-junit.xml' },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      thresholds: { lines: 25, functions: 25, branches: 25, statements: 25 },
    },
  },
});
```

Key details:

- **Path alias**: `@/` maps to `src/` for imports like `import { moodService } from '@/services/moodService'`
- **Coverage thresholds**: 25% minimum on lines, functions, branches, and statements.
- **JUnit output**: `test-results/vitest-junit.xml` for CI integration.
- **Supabase env vars**: Hardcoded test values so unit tests can import modules that reference `import.meta.env.VITE_SUPABASE_URL`.

### Test Setup (`tests/setup.ts`)

Runs before each unit test:

1. **`@testing-library/jest-dom`** -- Adds DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)
2. **`fake-indexeddb/auto`** -- Provides an in-memory IndexedDB implementation for unit tests
3. **`window.matchMedia` mock** -- Returns `{ matches: false }` for responsive component tests
4. **`IntersectionObserver` mock** -- No-op for virtualized list components
5. **`ResizeObserver` mock** -- No-op for responsive layout components

## E2E Tests (Playwright)

### Running

```bash
npm run test:e2e               # Full run with cleanup wrapper
npm run test:e2e:raw           # Playwright directly
npm run test:e2e:ui            # Interactive UI mode
npm run test:e2e:debug         # Step-through debugging with Playwright Inspector
npm run test:p0                # Priority 0 (critical) tests only
npm run test:p1                # Priority 0 + Priority 1 tests
```

Single file:

```bash
npx playwright test tests/e2e/scripture/scripture-reflection-2.2.spec.ts
```

By pattern:

```bash
npx playwright test --grep "mood tracker"
```

### Configuration (`playwright.config.ts`)

| Setting            | Value                      |
| ------------------ | -------------------------- |
| Test directory     | `./tests`                  |
| Fully parallel     | Yes                        |
| Retries            | 0 locally, 2 in CI         |
| Workers            | Unlimited locally, 2 in CI |
| Test timeout       | 60 seconds                 |
| Assertion timeout  | 15 seconds                 |
| Action timeout     | 15 seconds                 |
| Navigation timeout | 30 seconds                 |
| Traces             | Always captured            |
| Screenshots        | Always captured            |
| Video              | Always captured            |

### Projects

| Project       | Test Directory        | Purpose                                    |
| ------------- | --------------------- | ------------------------------------------ |
| `chromium`    | `./tests/e2e`         | E2E tests in Desktop Chrome                |
| `api`         | `./tests/api`         | API-level tests against Supabase endpoints |
| `integration` | `./tests/integration` | Integration tests                          |

### Web Server

Playwright auto-starts a Vite dev server before tests:

```typescript
webServer: {
  command: 'npx vite --mode test',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

`--mode test` makes Vite load `.env.test` (plain-text local Supabase values), overriding encrypted production credentials.

### ES256 JWT Re-signing

The Playwright config includes JWT re-signing logic for Supabase CLI v2.71.1+ which defaults GoTrue to ES256 signing. The config extracts the ES256 private key from the GoTrue Docker container and re-signs the service role and anon tokens, ensuring test authentication works with the local Supabase instance.

### Reporters

- **HTML report**: `playwright-report/` (visual test results with traces and screenshots)
- **JUnit**: `test-results/junit.xml` (CI integration)
- **List**: Console output during test runs

## Test Infrastructure

### Merged Fixtures (`tests/support/merged-fixtures.ts`)

All E2E test files import `{ test, expect }` from this file, not from `@playwright/test` directly. It composes multiple fixture sources using Playwright's `mergeTests`:

| Fixture Source                                              | Provides                                      |
| ----------------------------------------------------------- | --------------------------------------------- |
| `@seontechnologies/playwright-utils/api-request`            | Typed HTTP client with schema validation      |
| `@seontechnologies/playwright-utils/recurse`                | Polling helper for async operations           |
| `@seontechnologies/playwright-utils/log`                    | Playwright report-integrated logging          |
| `@seontechnologies/playwright-utils/intercept-network-call` | Network request interception                  |
| `@seontechnologies/playwright-utils/network-error-monitor`  | Automatic HTTP 4xx/5xx detection              |
| Custom fixtures (`./fixtures`)                              | `supabaseAdmin`, `testSession`                |
| Scripture navigation fixtures                               | Scripture-specific page navigation helpers    |
| Worker auth fixtures                                        | Worker-isolated auth for parallel test safety |

### Shared Helpers (`tests/support/helpers.ts`)

Reusable functions for E2E tests that only receive `page: Page` (no fixture access):

- `ensureScriptureOverview(page)` -- navigate to /scripture, handle stale sessions
- `startSoloSession(page)` -- full solo session startup with auth readiness check
- `advanceOneStep(page)` -- click Next Verse with hybrid sync
- `completeAllStepsToReflectionSummary(page)` -- run through all 17 verses
- `submitReflectionSummary(page)` -- fill + submit reflection form
- `skipMessageAndCompleteSession(page)` -- skip message compose, complete session
- `waitForScriptureRpc(page, rpcName)` -- wait for a successful RPC response
- `waitForScriptureStore(page, label, predicate)` -- poll Zustand store via `expect.poll()`

### Hybrid Sync Pattern (3-layer wait)

After any mutation that changes server + client state, use all three layers:

1. **NETWORK**: `waitForScriptureRpc` / `interceptNetworkCall` -- confirms server processed the request
2. **STORE**: `waitForScriptureStore` -- confirms Zustand ingested the response
3. **UI**: `expect(locator).toBeVisible()` -- confirms React re-rendered

## Database Tests (pgTAP)

```bash
npm run test:db    # Runs supabase test db
```

pgTAP tests are SQL files in `supabase/tests/database/` that validate database constraints, RLS policies, triggers, and functions. Requires `supabase start`.

## Smoke Tests

```bash
npm run test:smoke   # Runs node scripts/smoke-tests.cjs
```

Pre-deploy validation against the `dist/` directory (requires `npm run build` first):

1. `dist/` directory exists
2. `index.html` exists with DOCTYPE, viewport meta, manifest link, root element, and script tags
3. `manifest.webmanifest` exists, is valid JSON, has required fields (name, short_name, icons, display), and has theme_color
4. Critical assets exist: `icons/icon-192.png`, `icons/icon-512.png`
5. JavaScript bundles exist in `dist/assets/` with code splitting (vendor chunks)
6. Service worker (`sw.js`) exists with content and precache manifest

Exit code 0 means all checks passed; exit code 1 blocks deployment.

## Burn-In (Flaky Detection)

```bash
npm run test:burn-in   # Default: 10 iterations
```

The burn-in script (`scripts/burn-in.sh`) runs Playwright tests in a loop to detect intermittent failures. Usage:

```bash
./scripts/burn-in.sh              # Run all E2E tests 10x
./scripts/burn-in.sh 5            # Run all E2E tests 5x
./scripts/burn-in.sh 10 auth      # Run auth tests 10x
```

Failure artifacts are saved to `burn-in-failures/iteration-N/` for each failed iteration.

In CI (`test.yml`), burn-in runs only on PRs to `main` with 5 iterations. It detects changed test files via `git diff` and only re-runs those specs.

## Failure Analysis

```bash
npm run test:failures    # Run tests and generate AI-friendly failure summary
npm run test:failures > failures-ai.md   # Save to file
```

The `pw-failures.mjs` script parses Playwright JSON output, groups failures by root cause pattern, extracts TEA test IDs and priority tags, and creates a dated artifacts folder in `_bmad-output/pw-test-results/` with per-test subfolders containing traces, error context, and screenshots.

## CI Test Pipeline

The `test.yml` workflow runs 9 jobs. Every app stage is gated on `needs.changes.outputs.app == 'true'`, so documentation-only PRs skip the whole suite.

### Stage 0: Change Detection (5-minute timeout)

- Job `changes`; decides whether the change can affect the app at all
- Deliberately keyed on "can this change affect the app", **not** on "did test files change" -- gating on test-file edits would leave every source and dependency PR untested

### Stage 1: Lint and Type Check (5-minute timeout)

- ESLint on `src/`, `tests/`, `scripts/`
- TypeScript type check (`tsc -b --force`)

### Stage 2: Unit Tests (10-minute timeout)

- Vitest with coverage
- Coverage report uploaded as artifact (7-day retention)

### Stage 3: Database Tests (10-minute timeout)

- Sets up local Supabase via composite action
- Runs pgTAP tests via `npx supabase test db`

### Stage 4: Backend Tests (15-minute timeout)

A single `backend-tests` job with a `matrix: project: [integration, api]` and `fail-fast: false`. Each leg sets up local Supabase and runs `npx playwright test --project=${{ matrix.project }}`. Both projects run without a browser context. `supabase stop --no-backup` runs in an `always()` step.

> This replaces the separate "Integration Tests" and "API Tests" stages described in the 2026-03 scan.

### Stage 5: E2E Sharded (30-minute timeout)

- Runs the full E2E suite across **4 shards**, chromium only: `npx playwright test --project=chromium --shard=${{ matrix.shard }}/4`
- 2 Playwright workers per shard
- `fail-fast: false` -- all shards run even if one fails
- Results uploaded per shard as `e2e-results-shard-*` with 30-day retention

> **The E2E P0 gate job was removed.** It previously ran `--grep "[P0]"` ahead of this stage with `e2e-tests` gated on it via `needs`; the shards now start as soon as change detection passes.
>
> **Shards went 2 → 4.** Playwright splits by test count, but the suite is duration-skewed: at 2 shards both got 55 tests yet ran 5.4 min vs 9.6 min. Per-shard provisioning has a fixed ~2.5 min floor, so 4 is the better trade.

### Stage 6: Burn-In (30-minute timeout)

- Runs on PRs to `main` (and on the weekly Sunday schedule)
- Detects changed test files via `git diff` and runs 5 iterations on changed specs only
- **No longer `needs` the E2E shards** -- it re-runs specs from scratch and consumed nothing the shards produced, so waiting on them only added the slowest shard to the critical path

### Stage 7: Merge Reports

- Runs after E2E regardless of success/failure (skipped only if E2E was cancelled or skipped)
- Downloads all `e2e-results-shard-*` artifacts
- Merges HTML reports via `npx playwright merge-reports`
- Uploads merged report with 30-day retention

### Stage 8: Test Summary

The `test-summary` job runs with `if: always()`, evaluates results from all stages, and serves as the branch-protection target. It requires lint, unit tests, DB tests, backend tests, and E2E tests to succeed. Burn-in is allowed to be skipped (non-PR events) but not failed.

### Concurrency

```yaml
concurrency:
  group: tests-${{ github.ref }}
  cancel-in-progress: true
```

New pushes to the same branch cancel in-progress test runs.

### Triggers

- Push to `main`
- Pull requests
- Weekly schedule: Sundays at 2 AM UTC (`cron: '0 2 * * 0'`, full burn-in)
- Manual dispatch

## Priority Tags

E2E tests use priority tags in their test names for selective execution:

| Tag    | Meaning                               | When Run                       |
| ------ | ------------------------------------- | ------------------------------ |
| `[P0]` | Critical path -- must never break     | `npm run test:p0`, full E2E    |
| `[P1]` | High priority -- core features        | `npm run test:p1`, full E2E    |
| `[P2]` | Medium priority -- secondary features | Full E2E only                  |
| `[P3]` | Low priority -- edge cases            | Full E2E only                  |

Since the CI P0 gate job was removed, the tags are now used for **local** selective runs and for reasoning about risk -- CI always runs the whole suite across its 4 shards.

Example test title:

```typescript
test('[P0] user can start a solo scripture reading session', async ({ page }) => {
  // ...
});
```

Run selectively:

```bash
npm run test:p0    # P0 only
npm run test:p1    # P0 + P1
```

## ATDD (Acceptance Test-Driven Development)

For Epic 2 and beyond, acceptance tests are written before implementation. Each story's acceptance criteria from the epic breakdown maps to specific E2E test cases. The workflow is:

1. Read acceptance criteria from the relevant tech spec in `_bmad-output/.archive/implementation-artifacts/` (the sharded `planning-artifacts/epics/` directory was retired once all four Scripture Reading epics shipped, and the completed tech specs were archived on 2026-07-25)
2. Write failing E2E tests that encode each criterion
3. Implement the feature until tests pass
4. Review coverage against all acceptance criteria
