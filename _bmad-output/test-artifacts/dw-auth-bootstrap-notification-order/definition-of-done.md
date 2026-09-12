# Definition of Done — DW-81 automation

Workflow outcome: **done**. All required generation, fixture integration, validation and documentation are complete.

| Requirement | Completed evidence |
| --- | --- |
| Implemented scope and acceptance mapping | Spec DW-81 and implementation `126f5a00`; existing App/service/store tests inspected. |
| Prioritized tests | 8 tests: 1 API + 7 browser integration; P0 3, P1 5. All discovered and executed. |
| Fixtures and factories | Existing worker auth provider; new overrideable synthetic session/event factories, SDK-control fixture and HTML/TSX harness. |
| Runnable integration and artifact copies | Existing API/Chromium projects, single merged-fixtures entry point, seven exact retained source snapshots and hash manifest. |
| Local test execution | Initial 8/8 pass; five later fresh invocations pass 40/40, two workers, zero retries/skips/flaky cases. |
| Existing regressions | 59/59 focused App, auth service and sign-out state unit tests. |
| Static checks | Typecheck passed; lint zero errors with three existing EventCountdown Fast Refresh warnings. |
| Regression sensitivity | Guard removal failed all 3 P0 cases; authenticated-only notification marking failed the first-null P0. Expected failures recorded separately. |
| Restoration and integrity | Original App and unit hashes match; original ledger bytes preserved; seven snapshots match the files exercised. |
| Test quality and cleanup | Deterministic deferred delivery, explicit store/UI outcomes, no hard waits or skipped tests, fixture teardown restores instrumentation and releases held requests. |
| Orchestrator state | No sprint-status file exists in this worktree; none was created, written or reverted. |
| Documentation and evidence | README, automation summary, checklist, worker JSON, generation/knowledge/source manifests and sanitized verification evidence delivered. |

`evidence/initial.json`, `repeat-summary.json`, `unit.json`, `typecheck.json`, `lint.json`, `mutation-check.json` and `integrity.json` record the measurements. Each mutation has a separate failing-test result file. No generated test required healing or a weakened assertion.

The API verifies existing local Auth identity responses. Browser cases exercise real App/sessionService/auth/events behavior using supplied SDK interleavings and controlled unrelated initialization/sync. Real GoTrue scheduling, OAuth navigation, StrictMode replay, production deployment, clean CI and the full repository suite remain outside the measured scope. Existing units cover effect cleanup/remount behavior.

The required orchestrator marker is written after this final documentation pass at `_bmad-output/implementation-artifacts/bmad-build-auto-result-dw-auth-bootstrap-notification-order-tea.automate-1.md`.
