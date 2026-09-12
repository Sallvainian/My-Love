# DW-39 automation artifacts

Generated **5 API client tests and 1 E2E test**, with **3 P1 and 3 P2** cases, plus a shared malformed-error factory.

See the [automation summary](../automation-summary-dw-empty-database-error-fallback.md), [Definition of Done](definition-of-done.md), and [validation results](validation/results.json).

## Files

The runnable files are in the existing test tree:

- `tests/api/empty-database-error-fallback.spec.ts`
- `tests/e2e/errors/empty-database-error-fallback.spec.ts`
- `tests/support/factories/database-error-envelope.ts`

`sources/` contains exact delivery snapshots. [source-manifest.json](source-manifest.json) maps each snapshot to its canonical path and SHA-256. Run the canonical files; snapshot imports intentionally retain their original paths. Worker JSON records generation inputs; final snapshots include the aggregation change that waits for the new form error before inspecting store state.

## Run from the project root

The SDK tests use controlled in-memory responses. The artifact config reuses the repository runner settings, selects only these five tests, and disables backend setup and the Vite server. Chromium is still required by the existing merged network-monitor fixture. No real credentials or Supabase service are needed.

```sh
npx playwright test --config _bmad-output/test-artifacts/dw-empty-database-error-fallback/playwright.sdk.config.ts
```

The E2E test uses normal worker-pool authentication and reads; only its failed event INSERT is intercepted. Start Docker before running:

```sh
supabase start
npx playwright test --project=chromium tests/e2e/errors/empty-database-error-fallback.spec.ts --workers=1
```

Both files also belong to the normal Playwright projects and priority filters. `npm run test:p1` selects P0 and P1, including three of these new cases; select the API file to include its three P2 compatibility checks.

```sh
npx playwright test --project=api --project=chromium empty-database-error-fallback --list
npx vitest run tests/unit/api/errorHandlers.test.ts tests/unit/api/moodApi.test.ts tests/unit/services/eventsService.test.ts tests/unit/stores/eventsSlice.test.ts
npm run typecheck
npm run lint
```

## Measured limits

All five SDK tests and 184 affected unit tests passed. The SDK tests ran with two workers and no retries. Against the previous handler, both P1 fallback tests failed and the three P2 compatibility controls passed; the current handler was restored byte-for-byte afterward.

The authenticated browser case is generated and discovered but **not executed**: `supabase start` failed because the Docker socket is unavailable. Synthetic SDK success does not establish live PostgREST behavior. The artifact config executes successfully but is outside the canonical TypeScript project includes; the canonical tests and factory passed typecheck and lint.

`validation/` contains command logs, exit codes, results, and source checks. `knowledge-loaded.json` records the 31 knowledge fragments read across the parent and workers. No CLI exploration session was opened. Playwright owns and closes its browser contexts; its normal runtime traces remain in the ignored `test-results/` directory.
