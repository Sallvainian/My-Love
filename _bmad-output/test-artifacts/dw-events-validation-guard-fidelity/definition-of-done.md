# Definition of Done — dw-events-validation-guard-fidelity

Delivery scope is the requested TEA automation bundle under `_bmad-output/test-artifacts`. The generated tests remain outside normal CI discovery; `run.py` stages them temporarily for validation. This summary records generation separately from measured validation.

## Coverage delivered

| ID | Priority | Level | Observable behavior |
|---|---|---|---|
| EVG-API-001 | P1 | API | Description POST accepts 500 and rejects 501 with 400/23514; GET proves only the accepted row exists. |
| EVG-API-002-label | P1 | API | PATCH accepts label 100 and rejects 101; GET proves the accepted row is unchanged by rejection. |
| EVG-API-002-description | P1 | API | PATCH accepts description 500 and rejects 501; GET proves the accepted row is unchanged by rejection. |
| EVG-API-003-ring | P2 | API | The complete `ring` literal survives authenticated POST and GET. |
| EVG-API-003-plane | P2 | API | The complete `plane` literal survives authenticated POST and GET. |
| EVG-API-003-calendar | P2 | API | The complete `calendar` literal survives authenticated POST and GET. |
| EVG-API-004 | P2 | API | PATCH rejects the complete unknown `party-hat` icon with 400/23514 and preserves the saved row. |
| EVG-E2E-001 | P1 | E2E | Padded exact label/description limits trim on the POST, reach Zustand and rendered text, survive reload, and prefill editing exactly. |

Total: **8 cases — 7 API and 1 E2E; 4 P1 and 4 P2**. There are no P0/P3 additions. Production behavior is unchanged; P1 targets silent drift and failed saves, while P2 covers icon compatibility edges.

## Generation checklist

- [x] Generated both specs and one shared `events-validation.ts` factory under the artifact directory.
- [x] Reused the single existing merged-fixture entry point, authenticated page, `authToken`, and `coupleEvents`; no replacement auth wrappers or credentials were introduced.
- [x] Reused worker-pair setup and automatic cleanup keyed by `TEST_WORKER_INDEX`; no partner linkage or password changes are part of these tests.
- [x] Used `apiRequest` with response schemas for HTTP tests, `interceptNetworkCall` before browser requests, `recurse` for store settlement, and `log.step` for milestones.
- [x] Ordered successful browser mutation checks as HTTP response → Zustand → UI, then reloaded before asserting persistence and edit prefills.
- [x] Kept network monitoring enabled for the normal browser journey; no intentional browser error response requires an exclusion.
- [x] Used stable existing test IDs and source-verified store observation points. CLI exploration reached login only; the successful authenticated browser run subsequently verified all generated Settings selectors.
- [x] Supplied a runner that refuses existing destinations and preserves concurrently modified staged files.
- [x] Recorded zero generated Playwright Utils deviations.

## Validation evidence

| Required evidence | Measured result |
|---|---|
| Generated API/E2E execution against local Supabase | **8/8 passed**, 7 API + 1 Chromium; 12.1 seconds; no retries, failures, skips, or flaky classifications. [Results](evidence/playwright-initial.json), [command](evidence/playwright-initial-command.json). |
| TypeScript check with generated files staged | `npm run typecheck`: exit 0. [Log](evidence/typecheck.log). |
| Lint with generated files staged | `npm run lint`: exit 0; only 3 existing EventCountdown react-refresh warnings. [Log](evidence/lint.log). |
| Existing Vitest mirror/component guard verification | **141/141 passed**, 6 files, exit 0. Includes 42 mirror/extraction tests and 69 main component cases. [Results](evidence/unit-result.json). |
| Existing pgTAP effective-schema guard and complete migration parity | **236/236 assertions passed**, 22 files; 34/34 repository migration versions applied. [Database results](evidence/database-result.json), [migration parity](evidence/database-migration-result.json). |
| Staging cleanup and final diff/whitespace checks | No staged copies remain; no EVG event rows remain; diff/whitespace checks clean. Every initially tracked file except the intentionally appended summary index retains its initial hash. [Hygiene](evidence/hygiene.json). |

- [x] All planned tests are discovered and executed; no disabled test substitutes for coverage.
- [x] API positive controls and rejected-write GET snapshots passed against the real database.
- [x] Browser response → store → UI → reload/prefill assertions passed without mocked API responses.
- [x] Production code, historical specs, generated files, existing ledger changes, and sprint status are preserved.
- [x] Browser exploration session and owned Vite process were closed; staging cleanup completed.
- [x] Automation summary, runnable test artifacts, shared factory, and this Definition of Done are delivered.

No healing was required. Multiple assertions establish each logical contract: status plus payload plus persisted state prevent false positives. No literal one-assertion rule was applied. No new product source edits or mutation runs were made; the existing spec contains earlier controlled-mutation evidence, which is not counted as execution in this session. Local success does not establish cross-browser, CI, or concurrent-worker parity; no separate test-review or trace workflow was invoked.

## Applicable exclusions and limits

- **New component/unit tests: N/A.** The active suite already owns independent padded/unpadded 100/500 submissions, 101/501 rejection, extraction failures, and retained-constant branch discrimination. The generated browser case adds one real persistence journey. Existing DE.5-API-006 already covers POST label 100/101.
- **Pact contracts: N/A.** The provider contract is the local `public.events` schema and PostgREST behavior; no consumer/provider contract change was identified by the relevance gate.
- **New CI configuration, burn-in scripts, or framework wiring: N/A.** Existing Playwright projects and merged fixtures can run the staged artifacts. The local staging utility is delivery support; it does not add a CI job. No offline/HAR scenario is in scope.
- **Literal boundary values: deliberate test data.** The E2E keeps historical limits `100` and `500` independent of the mutable shared declaration/catalog contract. The API matrix follows that shared contract. Faker supplies fresh UUID-based ASCII identities; exact lengths and the unsupported literal `party-hat` are controlled inputs rather than unconstrained random data.
- **Unicode parity: excluded under DW-83.** Existing UI checks count UTF-16 code units while PostgreSQL `char_length` counts Unicode characters. ASCII fixtures characterize the preserved production limits and do not prove emoji or other Unicode equivalence.
- **Complete drift detection still requires two existing runners.** Vitest compares the form declarations to the shared tagged contract; pgTAP compares the complete installed PostgreSQL CHECK catalog after all migrations. Generated API/E2E cases supplement these guards and do not replace either runner. Unsupported equivalent catalog syntax can intentionally fail for inspection.
- **Automatic activation: excluded by the requested artifact location.** These tests do not enter ordinary CI discovery until the three documented files are activated. Production code, generated database types, historical specs, the deferred-work ledger, and orchestrator-owned sprint status are unchanged by this workflow.
