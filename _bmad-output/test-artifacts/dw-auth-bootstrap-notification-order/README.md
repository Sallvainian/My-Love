# Auth bootstrap notification order test pack

This pack covers DW-81: an authentication notification that arrives while App's initial session lookup is pending must retain ownership when that older lookup settles. The suite contains one P1 API test and seven browser tests: three P0 account/session replacement cases and four P1 continuity or bootstrap controls. Execution counts and results belong in the workflow summary and Definition of Done; this README does not establish a passing result.

## Runnable sources and retained copies

The runnable specs remain in the repository's normal Playwright projects:

- `tests/api/auth-bootstrap-identity.spec.ts`
- `tests/e2e/auth/bootstrap-notification-order.spec.ts`

This package's `tests/` directory retains exact copies of the generated specs and their supporting fixture sources, preserving the same relative paths as the active suite. These are source snapshots for inspection and reproduction. Run the active files above; no staging or activation script is needed. The package's validation evidence records which source versions were exercised.

## Local verification

Run from the project root with local Supabase already running and its existing worker-account pool available:

```sh
npx playwright test --config=_bmad-output/test-artifacts/dw-auth-bootstrap-notification-order/playwright.verify.config.ts tests/api/auth-bootstrap-identity.spec.ts tests/e2e/auth/bootstrap-notification-order.spec.ts
```

The package's verification config imports the normal local Supabase environment bootstrap and starts its own Vite test server at `http://127.0.0.1:5187`. Port 5187 must be free; the server uses `--strictPort` and does not reuse another worktree's server. Local verification disables `globalSetup` because the normal setup resets passwords and partner links in the shared worker pool. It therefore requires previously provisioned pool accounts. The tests use the existing worker mapping based on `TEST_WORKER_INDEX`; they do not provision or relink those accounts.

To select the critical cases, append `--grep '\[P0\]'`. To check repeated execution, append `--repeat-each=5 --retries=0`. These are verification commands, not claims that those runs have completed.

Raw runner logs, reports and browser artifacts stay in ignored `test-results/dw-auth-bootstrap-notification-order/`. This package's `evidence/` directory contains selected sanitized evidence; do not copy resolved Playwright configuration or credential-bearing auth/network payloads into tracked artifacts. The local Supabase setup supplies test credentials in memory; no decrypted secrets belong in `.env` or source files.

On a clean CI environment, the base configuration retains its ordinary account setup:

```sh
npx playwright test tests/api/auth-bootstrap-identity.spec.ts tests/e2e/auth/bootstrap-notification-order.spec.ts
npm run typecheck
npm run lint
```

Use that base-config command where the runner owns its Supabase instance and account pool. The dedicated local verification command above preserves the existing shared pool during this workflow.

## What the tests observe

The API test checks that the primary and partner worker tokens resolve to their distinct expected identities through the actual local `/auth/v1/user` endpoint. It supplies provider identity evidence; it does not establish client notification ordering.

The browser cases are controlled integration tests. They exercise the real App, `sessionService`, composed auth/event state and rendered login/Home surfaces. The harness controls the SDK's initial `getSession` settlement and notification delivery so a newer notification can be compared with a stale bootstrap deterministically. Unrelated initialization and background synchronization are controlled, and event responses use targeted fixtures. The observations cover stale null, stale other-user, initial null notification, same-user metadata refresh, rejection fallback, and unsuperseded authenticated/null controls.

This evidence is scoped to App's handling of those supplied interleavings. Real GoTrue scheduling and a complete OAuth navigation are outside these tests. Existing App unit tests retain the more detailed React effect cleanup and remount permutations.

The generated tests reuse the repository's merged fixtures and configured Playwright utilities. Fixture teardown owns browser instrumentation and held requests. Any required utility deviations are recorded beside the relevant code and in the workflow summary.

See the package's `definition-of-done.md` and `../automation-summary-dw-auth-bootstrap-notification-order.md` for completed validation, exact counts, limitations and the final outcome.
