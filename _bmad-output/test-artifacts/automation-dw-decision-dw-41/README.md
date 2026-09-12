# DW-41 test automation

Six P1 tests expand Settings event history coverage. They run directly from this artifact package against local Supabase and reuse `tests/support/merged-fixtures.ts`. Production source and regular test discovery are unchanged.

## Run

From the repository root, with dependencies and Chromium installed:

```sh
supabase start
npx playwright test --config _bmad-output/test-artifacts/automation-dw-decision-dw-41/playwright.config.ts
npx tsc -p _bmad-output/test-artifacts/automation-dw-decision-dw-41/tsconfig.json
npx eslint _bmad-output/test-artifacts/automation-dw-decision-dw-41/api _bmad-output/test-artifacts/automation-dw-decision-dw-41/e2e _bmad-output/test-artifacts/automation-dw-decision-dw-41/fixtures
```

Use `--project=api` or `--project=chromium` for one layer; `--grep '\[P1\]'` selects priority P1. Repeat the verified stress run with `--workers=4 --repeat-each=5`. Retries are disabled. Do not run another worker-pool test invocation concurrently against the same local accounts.

The wrapper imports the existing Playwright configuration for local key resolution, provisions the existing worker pool, and starts Vite in test mode. A separately started dev server must also have the correct local Supabase environment. No production credentials or deployment are needed.

## Contents

| File | Purpose |
| --- | --- |
| `api/events-history-keyset.spec.ts` | Three production-service API cases: both deletion directions and raw timestamp/ID boundaries |
| `e2e/events-history-recovery.spec.ts` | Three browser cases: failed-window retry, edit replay, delete replay |
| `fixtures/events-page-reader.ts` | Vite SSR loader injecting the real authenticated SDK client, with cleanup and injection assertion |
| `fixtures/events-paging-control.ts` | Independent continuation gates over real fetched responses, with cleanup |
| `fixtures/history-data.ts` | Unique-label history factory with explicit page-size/label overrides |
| `playwright.config.ts`, `tsconfig.json` | Artifact discovery, reports, and test/fixture typechecking |
| `definition-of-done.md` | Validation results and completion checklist |
| `evidence/` | Worker drafts, generated count summary, test reports, and verification logs |

Example factory use: `await coupleEvents.seed(buildHistory({ past: 51, upcoming: 51 }))`. `coupleEvents` owns cleanup for this worker's pair. The service reader closes in `finally`; the paging controller disposes in `afterEach`. Only the intended failing-window test opts out of HTTP error monitoring.

Generated test and fixture TypeScript is checked in place. The wrapper config is excluded from this artifact typecheck because importing the root Playwright config exposes three existing diagnostics in that file (a removed `crypto.JsonWebKey` type and two readonly `stdio` overload errors). The project's normal typecheck also excludes that root config and passes. The wrapper was validated by actual Playwright runs; no config diagnostics were fixed by this workflow.

[Workflow summary](../automation-summary-dw-decision-dw-41.md) contains acceptance mapping, deviations, and scope limits. These artifact tests are not selected by ordinary `npm run test:e2e`; use the command above. A later activation into normal discovery would be separate work.
