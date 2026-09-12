# Events wire-contract fidelity automation

TEA pack for DW-70/72: five existing API cases, one new P2 browser case, and one pure data factory. The API file is a byte-for-byte snapshot of the active suite; its schema and anonymous regression controls are preserved. The browser case checks two same-label records with different owners through Settings reload. It supplements the API acceptance evidence.

| Priority | Cases | Purpose |
| --- | --- | --- |
| P0 | DE.5-API-007 | Anonymous denial despite stale rows and a same-label partner witness; matching creator positive control. |
| P1 | DE.5-API-004..006, DE.5-API-008 | Strict response shape, defaults/date, ordering, constraints, outsider isolation and cleanup. |
| P2 | DW.WIRE-E2E-001 | Separate UUIDs, owner controls and null/calendar mapping survive Settings reload. |

From the project root, with local Supabase running:

```sh
supabase start
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py
```

The runner checks the manifest, temporarily stages the three TypeScript files at their matching `tests/` paths, runs the existing API and Chromium projects with two workers, then removes its unchanged copies. Existing paths are never overwritten. A concurrently modified staged file is preserved and reported. The API snapshot must still match the active source hash; regenerate the snapshot and manifest after a source change.

These artifacts are outside ordinary CI discovery. The API cases already run from their original active file; the new browser case runs only when this pack is staged. Do not keep both API copies in the normal test suite. No package scripts or Playwright configuration changes are required.

The existing Playwright configuration loads local Supabase credentials and starts Vite in test mode. An already-running server must belong to this worktree and point to local Supabase. The runner sets `TZ=America/New_York`. No production build is needed.

Pass a command after `run.py` for static validation or focused execution:

```sh
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py npm run typecheck
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py npm run lint
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py npx playwright test tests/api/events-wire-contract-fidelity.spec.ts --project=api --workers=2 --grep 'DE.5-API-007|DE.5-API-004' --repeat-each=5
```

For priority selection, pass the two packaged spec paths, their projects, and `--grep '\[P0\]'` or `--grep '\[P0\]|\[P1\]'`. An unfiltered custom Playwright command can also discover the original active suite, so keep the explicit file selection.

Three mutation probes intentionally exit with a test failure at a specific regression control:

```sh
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py --mutation loose-schema
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py --mutation missing-owner
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py --mutation fixed-label
```

Only the staged API copy is transformed; the active source and packaged snapshot remain unchanged. A nonzero exit alone is insufficient evidence: inspect the report to confirm the expected assertion failed rather than setup.

Fixture ownership is inherited from `tests/support/merged-fixtures.ts`. The API anonymous case uses direct checked event helpers and retains stale witnesses until its assertions finish. The E2E case uses `coupleEvents` for a single clock anchor and checked pair cleanup. Its factory accepts an explicit attempt UUID; identical labels are seeded in separate one-row calls because the shared batch seeder requires unique labels per batch. The shared seeder writes null/calendar explicitly, so database defaults remain the API test's responsibility.

See [coverage-plan.md](coverage-plan.md), [definition-of-done.md](definition-of-done.md), [automation summary](../automation-summary-dw-events-wire-contract-fidelity.md), and `evidence/` for the measured results. Browser screenshots/traces remain in the configured ignored `test-results/` directory; the evidence JSON retains their run-time attachment references.
