# Source/test contract comments: regression artifacts

This package preserves 11 existing API/browser cases and four existing fixture,
factory or helper files as exact source snapshots. It adds no behavioral assertions
or ordinary CI test registrations: the bundle changes only three leading comments.

`test-selection.json` identifies each case and priority. `source-manifest.json`
pins the snapshots to canonical files. `run.py` checks both copies against those
hashes, then runs the canonical suites using their original imports and merged
fixtures. The snapshot tree is reference material, not a standalone Playwright
project. It intentionally does not duplicate the application's source or the
entire shared fixture system.

Run from any directory in this checkout (commands below assume the project root):

```sh
python3 _bmad-output/test-artifacts/dw-source-test-contract-comments/run.py --verify
python3 _bmad-output/test-artifacts/dw-source-test-contract-comments/run.py --list
python3 _bmad-output/test-artifacts/dw-source-test-contract-comments/run.py
python3 _bmad-output/test-artifacts/dw-source-test-contract-comments/run.py --priority P0
```

`--priority P1` selects P1 only; omit it to include all 11 cases. The repository's
`npm run test:p1` has different semantics and includes P0. No P3 cases are selected.
The runner uses one worker and zero retries, propagates failures, and refuses to
run if a test or snapshotted fixture has drifted. Refresh the pack through a later
workflow run when intentional source changes require it.

Execution uses the existing Playwright config, so local Supabase must already be
running. The config starts Vite in test mode using local credentials; no production
build or decrypted production secret is needed. The existing global setup provisions
the worker pool. Event cases clean only their own worker pair's events. Coordinate
separate Playwright processes because the shared pool isolates workers within a run.

Raw Playwright reports and browser traces are placed in
`test-results/dw-source-test-contract-comments/`. Durable command outcomes and a
sanitized per-case result summary are in this package's `evidence/` directory.

Coverage boundaries:

- Five API cases join injected HTTP responses, the installed SDK parser, and the
  production mapper. They do not call a live PostgREST server or every selective caller.
- Three event journeys cover icon reload, distinct-date display order after reload,
  and clearing a description through observed PATCH and UI. The clearing case does
  not reload; ordering does not identify a sorting layer or cover same-date ties.
- Three ownership cases use the real auth and interaction slices plus the rendered
  badge, with controlled service callbacks. They do not cover the sign-in form,
  Supabase auth events, or live Realtime.

See `definition-of-done.md`, `api-context.md`, `e2e-context.md`, and the parent
`automation-summary-dw-source-test-contract-comments.md` for acceptance evidence,
existing caller coverage, utility deviations, and measured validation.
