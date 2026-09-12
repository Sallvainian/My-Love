---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
  - step-03a-subagent-api
  - step-03b-subagent-e2e
  - step-03c-aggregate
  - step-04-validate-and-summarize
lastStep: step-04-validate-and-summarize
lastSaved: '2026-09-12'
workflowStatus: completed
runKey: dw-events-validation-guard-fidelity
workflowType: testarch-automate
mode: create
contextMode: BMad-Integrated
detectedStack: frontend
executionMode: subagent
totalTests: 8
priorityCoverage: { P0: 0, P1: 4, P2: 4, P3: 0 }
apiTests: 7
e2eTests: 1
validationStatus: passed
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad-output/implementation-artifacts/spec-dw-60-63-66-67-68-events-validation-guard-fidelity.md
  - _bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - _bmad-output/test-artifacts/atdd-checklist-5-manage-events-in-settings.md
  - playwright.config.ts
  - vitest.config.ts
  - package.json
  - tests/support/merged-fixtures.ts
  - tests/support/eventsValidationContract.ts
  - tests/unit/components/eventsValidationMirrors.test.ts
  - supabase/tests/database/21_events_validation_contract.sql
  - _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/knowledge-loaded.json
---

# Events validation guard fidelity — TEA automation

## Preflight

Sallvain requested Create mode, BMad-integrated automation for the current bundle. Implementation is commit `f5148984`, documented by `f0905877`; baseline is `bded9137`. The only initial uncommitted file is the orchestrator-managed deferred-work ledger. Its initial bytes and every tracked file are recorded in `dw-events-validation-guard-fidelity/input-state.json`; sprint status is never written or reverted.

The manifest detects a React frontend with Playwright API/Chromium projects and Vitest; Supabase supplies the real HTTP/database tier. Both frameworks and dependencies exist. Node 24.19.0, npm 11.17.0, Playwright 1.63.0 and Chromium are installed, and local Supabase is already running. No framework setup, dependency installation, migration, or production edit is needed.

The user-requested artifact directory is `_bmad-output/test-artifacts`. Generated tests and fixtures live in a dedicated bundle here with an executable verification entry point. Existing summaries and historic specs are preserved.

Playwright-utils is enabled and installed, so its mandate binds generation: merged fixtures, apiRequest, interceptNetworkCall, recurse and existing auth-session wiring. Full UI+API knowledge loading is divided between the two context workers; root loaded the mandate, Pact MCP, browser CLI and confidence gate. No Pact artifacts: no independently deployable service pair or installed Pact package exists.

Pact broker: unreachable (SmartBear MCP tools not available). Provider states derived from provider source (events migration, generated database types, and the service); no broker calls made. `pact_mcp_reachable: false` is reused for this run.

## Coverage plan and confidence

Selective expansion preserves the test pyramid. The existing 42-case Vitest extraction suite owns complete literals, malformed/unsupported source shapes, and contract comparison. The shipped pgTAP EV-DB-037 owns the complete effective CHECK catalog after all migrations. The component suite owns separate unpadded/padded exact 100/500 acceptance and 101/501 rejection. Existing DE.5-API-006 already proves POST label 100/101; existing browser tests prove ordinary CRUD and ring persistence.

| IDs | Level | Priority | New observable contract |
|---|---|---|---|
| EVG-API-001 | API | P1 | POST description 500 succeeds, 501 returns 400/23514 and creates no row |
| EVG-API-002-label / description | API | P1 | PATCH accepts exact 100/500, rejects +1, and GET proves rejected update preserved the saved row |
| EVG-API-003-ring / plane / calendar | API | P2 | Every complete shared-contract icon survives authenticated POST and GET |
| EVG-API-004 | API | P2 | Unknown full icon party-hat is refused on PATCH with 400/23514; saved row is unchanged |
| EVG-E2E-001 | E2E | P1 | Padded exact label+description submit through real UI, trim on wire, reach store/UI, persist after reload and prefill editing |

P1 is justified by the bundle's medium-severity silent validation drift and user save failures. Icon matrix cases are P2 compatibility edges under unchanged production choices. No P0: authentication and data-isolation implementations are unchanged. Delivered total: seven API tests plus one E2E; P1=4, P2=4. No new component/unit duplicates, Pact artifacts, CI jobs, or mutation framework.

Confidence: 9/10.
Rationale: the bundle intent matrix, shared pgTAP JSON, generated database types, live table constraints, existing events-wire-contract API tests, merged auth/coupleEvents fixtures, and existing events-persistence/events-refresh-unmount selectors directly establish the request shapes and observation points.
Unknowns:
- Resolved during validation: all eight tests executed successfully against local Supabase, including the authenticated browser flow and exact response assertions.
- Unicode parity is not established: DW-83 records the existing UTF-16/PostgreSQL counting difference. Boundary fixtures remain ASCII.
- Artifacts are outside normal CI discovery until explicitly activated; a staging runner will execute them without permanent changes to tests/.

No contract-provider map is required because the Pact relevance gate is closed. HTTP authority is public.events SQL/types plus existing PostgREST tests (POST/PATCH/GET /rest/v1/events).

## Generated artifacts

Two successful worker JSON outputs were aggregated without regenerating their tests. The API file contains seven cases (3 P1, 4 P2); the browser file contains one P1 case. A shared factory module supplies uniquely named ASCII boundaries, overridable event payloads, the strictly parsed shared contract and a full wire-row Zod schema. Existing merged auth, coupleEvents, HTTP, monitoring and polling fixtures remain the single entry point. The final E2E source adds explicit Given/When/Then markers to the worker output.

All files are under `dw-events-validation-guard-fidelity/`. `run.py` stages only absent files into their eventual tests paths, invokes the requested command, and removes only byte-identical owned copies in finally. The default command runs both generated specs with one worker.

Execution mode: explicit subagent request, probe enabled, successful runtime subagent launches. No separate agent-team launcher is exposed. API and browser workers ran concurrently; no speedup percentage was measured.

Browser CLI exploration reached the login screen because old storage was not reusable. The named session and its owned Vite process were closed. Source and active specs support the Settings selectors; actual verification uses the configured auth provider. Local migration history matches all 34 repository migrations, with no missing or extra versions.

## Playwright Utils deviations

None. Auth-session is already wired; HAR recording and webhook helpers are not needed for these live Supabase tests. Targeted repeat execution uses existing Playwright CLI options; no new burn-in or CI wiring is in scope.


## Validation and Definition of Done

**Completed:** eight generated tests passed on the first run (7 API, 1 Chromium; 4 P1, 4 P2), with no retries, failures, skips, or flaky classifications. Run duration was 12.1 seconds. No healing, assertion weakening, production edits, or API mocking was needed.

| Check | Result | Evidence |
|---|---|---|
| Generated tests, one worker, retries disabled | 8/8 passed | [Execution results](dw-events-validation-guard-fidelity/evidence/playwright-initial.json) |
| Typecheck including staged generated files | Exit 0 | [Typecheck log](dw-events-validation-guard-fidelity/evidence/typecheck.log) |
| Lint including staged generated files | Exit 0; 3 pre-existing EventCountdown warnings | [Lint log](dw-events-validation-guard-fidelity/evidence/lint.log) |
| Existing mirror and Settings component suites | 141/141 passed, 6 files | [Unit results](dw-events-validation-guard-fidelity/evidence/unit-result.json) |
| Full local pgTAP suite | 236/236 assertions, 22 files | [Database results](dw-events-validation-guard-fidelity/evidence/database-result.json) |
| Applied migration parity | 34/34, no missing/extra versions | [Migration result](dw-events-validation-guard-fidelity/evidence/database-migration-result.json) |
| Preservation, cleanup, whitespace | Passed; no staged copies or EVG rows remain | [Hygiene](dw-events-validation-guard-fidelity/evidence/hygiene.json) |

The executed browser test verifies padded 100/500-character ASCII input, exact trimmed POST, successful schema-valid response, exact Zustand row, visible text, then server reload and edit prefills. API tests verify description POST boundaries, both PATCH boundaries with unchanged-row evidence after rejection, all admitted icon strings, and rejection of the complete unknown icon `party-hat`.

Deliverables: [README and run commands](dw-events-validation-guard-fidelity/README.md), [API spec](dw-events-validation-guard-fidelity/tests/api/events-validation-fidelity.spec.ts), [E2E spec](dw-events-validation-guard-fidelity/tests/e2e/settings/events-validation-fidelity.spec.ts), [shared factory](dw-events-validation-guard-fidelity/tests/support/factories/events-validation.ts), [full Definition of Done](dw-events-validation-guard-fidelity/definition-of-done.md), [generation metadata](dw-events-validation-guard-fidelity/generation-summary.json). Raw runner traces remain in ignored `test-results/`; durable logs and compact execution results are in the artifact's `evidence/` directory.

Run all generated cases from the repository root:

```sh
python3 _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/run.py
```

The artifact location is intentional: these tests remain outside ordinary CI discovery until activated at the README's paths. Existing fixtures and scripts already support execution, so no test README, package scripts, framework, or CI changes were necessary. Each test verifies one logical contract with enough assertions to distinguish a real pass from a broken precondition.

Residual limits: ASCII tests do not resolve DW-83's pre-existing Unicode counting difference. Complete drift detection still requires both the existing Vitest and pgTAP guards. This session measured local Chromium and one Playwright worker, without claiming full-app, CI, cross-browser, or concurrent-worker verification. Earlier source/SQL mutation measurements are recorded in the implementation spec and were not rerun or counted here.

Next recommended workflow, if desired: `bmad-testarch-trace` to incorporate this evidence into acceptance-criteria traceability. No separate review or trace gate was run as part of this automation request.
