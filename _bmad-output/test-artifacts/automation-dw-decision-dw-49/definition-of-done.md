# DW-49 — Definition of Done

**Workflow outcome: done.** Generated tests and fixtures are runnable from TEA's
configured artifact directory. All selected checks passed on 2026-09-12.

| Requirement | Evidence | Result |
| --- | --- | --- |
| Uncertain create/update explains possible commit, preserves fields, focuses Refresh and prevents edited/direct resubmission | DW49-E2E-001/002; existing component timing tests | Pass |
| Refresh closes the form, loads both windows and reconciles authoritative rows without replay | DW49-E2E-001/002, real committed server row plus store/UI assertions | Pass |
| Failed refresh preserves empty/populated snapshots and exposes read-only Retry | DW49-E2E-003/004, both GETs fail with 400, Retry returns 200/200 | Pass |
| Absence in the bounded list does not imply the write failed | DW49-E2E-005, committed 52nd history row independently read from server | Pass |
| Ordinary transport retry remains available | DW49-E2E-006, rejected request then one deliberate successful POST | Pass |
| Offline retry, stale-row recovery and pre-render submission guards remain covered | Existing focused component/service/store suites | Pass |
| POST object and PATCH array representations can be recovered through repeated reads | DW49-API-001/002, cardinality/identity/saved fields/timestamp assertions | Pass |

- [x] 8 unique cases discovered: 6 E2E and 2 API; P1=4, P2=4.
- [x] First priority runs: 4 P1 passed (11.4s), 4 P2 passed (9.2s).
- [x] Three repeats across four workers: 24 passed (26.7s), zero skips,
  failures, flaky results or retries. Longest case: 5.474s.
- [x] Existing regression suites: 255 tests passed in four files (1.79s).
- [x] Project typecheck, artifact typecheck, artifact lint and whitespace checks passed.
- [x] Test assertions remain in test bodies; setup helpers only act/read/wait.
- [x] No fixed sleeps, focused tests, skipped tests or production store mocks.
- [x] One browser date anchor, worker-owned fixtures and checked teardown.
  Post-run local database check found zero rows with a `DW49` label prefix.
- [x] Real server writes complete before response corruption. Browser response,
  store settlement and UI outcomes are checked separately; write counters detect
  replay even when its payload/timestamp would be identical.
- [x] Existing merged fixtures/auth provider reused; two documented utility
  exceptions preserve vendor JSON and commit-before-corruption behavior.
- [x] No production, generated-type, migration, archived-test, ledger or sprint
  board edits. The pre-existing ledger diff is byte-for-byte preserved.
- [x] Execution instructions and raw results are retained with these artifacts.

Environment: macOS arm64, Node 24.19.0, Playwright 1.63.0 Chromium, Vite test
mode and local Supabase. These results establish this local configuration;
Linux CI and other browsers were not run. Default CI does not collect this
artifact directory, so use the explicit config in [README.md](README.md).
The Vite dev console also emitted a React pre-mount state-update warning;
its source was not investigated. No console-silence guarantee is claimed.
See [runtime observations](evidence/runtime-observations.md).

The tests deliberately corrupt a valid JSON date after the real server commit.
They do not claim to reproduce every damaged response or a network disconnect.
The transport case uses an unmapped terminal database error classified by the
real service as `transport`. Existing tests cover the offline code path.
Fresh-form/global idempotency, load session/lifetime combinations, performance
and cross-browser certification remain outside this change's scope.

No automatic healing was needed after execution. Pre-run validation moved
assertions out of helpers; no product code was changed to obtain green tests.
Optional next workflow: `bmad-testarch-trace` to incorporate these cases into
the broader coverage matrix. No further workflow was invoked.
