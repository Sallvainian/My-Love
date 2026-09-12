---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03a-subagent-api', 'step-03b-subagent-e2e', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-09-11'
workflowType: testarch-automate
workflowStatus: completed
runKey: dw-event-load-session-ownership
detectedStack: frontend
executionMode: subagent
coverageTarget: selective
totalTests: 6
priorityCoverage: { P0: 0, P1: 5, P2: 1, P3: 0 }
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad-output/implementation-artifacts/spec-dw-54-55-56-event-load-session-ownership.md
  - playwright.config.ts
  - vitest.config.ts
  - package.json
  - tests/support/merged-fixtures.ts
  - tests/support/helpers/events.ts
  - tests/support/fixtures/auth.ts
  - tests/support/auth/supabase-auth-provider.ts
---

# Event-load session ownership: automation

## Preflight

Create mode, BMad-integrated. The source change is committed in `d3ae7549`, with implementation/review evidence in `5902bb2a`. The initial working-tree diff contains only orchestrator-owned deferred-work bookkeeping, which this workflow preserves. Sprint status is neither edited nor used as verification evidence.

React/TypeScript frontend with Supabase SQL/PostgREST; no mobile or separate backend framework indicators. Existing Playwright API, Chromium E2E, and integration projects plus Vitest provide the framework. Artifacts are scoped under `_bmad-output/test-artifacts/dw-event-load-session-ownership/`; this run-specific summary preserves earlier workflows' `automation-summary.md`.

Node 24 and Playwright CLI are available. Docker and the local Supabase API at `http://127.0.0.1:54321` are running. The Vite test server uses the repository Playwright configuration's local credential setup; no production secrets are written.

TEA flags: playwright-utils enabled and installed; Pact utilities enabled but contract relevance gate closed (no interacting independently deployed service pair or Pact suite in this change). Pact broker: unreachable (SmartBear MCP tools not available). Endpoint evidence comes from repository source, migrations, and existing tests; no broker-derived provider states are claimed.

Knowledge loading: root loaded the Playwright mandate first, Pact MCP fallback, and CLI guidance. Dedicated context workers load the six required testing fragments, quality/confidence/evidence guidance, and the full UI+API utility profile. Coverage analysis reads the changed source and existing store, auth-adapter, Home and Settings tests.

The existing tests cover the narrow promise scheduling permutations. New automation targets the browser/auth/network integration boundary and supporting authenticated API behavior.

## Coverage plan

| Target | Level | Priority | Added evidence |
| --- | --- | --- | --- |
| New authentication session reads the same account's event after a real logout/login | API | P1 | Live authentication plus authenticated PostgREST read; does not claim to verify client ownership |
| Prior Home load succeeds/fails after same-account reauthentication before any successor load | E2E, two cases | P1 | Real auth notifications and browser network response cannot repopulate/reset/settle the current store; current Home load subsequently renders normally |
| Prior Settings load succeeds/fails after same-account reauthentication before any successor load | E2E, two cases | P1 | Same integration boundary for Settings; current session can render its own list/empty/error state |
| Token refresh preserves session ownership and current event load | E2E | P2 | Real SDK refresh neither starts another event load nor invalidates the existing one |

Selective scope avoids duplicating RLS, pagination, mutation replay, retry focus and precise React cleanup scheduling already covered below the browser level. Existing focused unit/component tests will be rerun. The supported sign-out/sign-in transition is the target; deferred no-sign-out session replacement, initial-session races, and token-storage commit ordering remain outside this fix.

Both test generation workers use the existing merged fixtures, `apiRequest`, `interceptNetworkCall`, `recurse`, worker-account pool, and source-backed locators. Test control may observe real load outcomes and call the real auth service while a non-event view is active, so the old response can settle before a successor request; this is explicitly distinguished from a UI-only journey. Data cleanup is limited to generated event IDs; no partner relationships or passwords change.

Execution capability probe: subagent launch and messaging succeeded; no separate agent-team launch API is exposed. User requested subagents as needed; selected mode is `subagent`, with API and E2E generation in parallel. Backend/mobile workers are inapplicable. No speculative parallel speedup is claimed.

## Generated pack

Both workers completed successfully and their JSON outputs, finalized after validation, are preserved in the bundle's `workers/` directory. Aggregation wrote one API spec (one P1 test), one E2E spec (four P1 and one P2 tests), a shared pure row factory, and an application-specific deferred two-window controller. Existing merged/auth/navigation fixtures are reused without modification.

The API scenario verifies same subject, a distinct server session identifier, and changed live event data. Browser cases assert actual response completion, real store action outcomes, exact reset state before the successor load, and current-session rendering. A separate real-token-refresh case asserts no extra load and normal completion.

Validation is complete. `source-manifest.json` records source and orchestrator-file hashes and the final preservation check confirmed every recorded file unchanged. `stage-tests.mjs` provides reversible collection under the existing Playwright/TypeScript configuration.

## Validation

| Check | Current-run result |
| --- | --- |
| Playwright collection | Six tests in two files |
| Generated API + Chromium tests | Six passed; no retries; 41.6 seconds |
| Existing focused auth/store/Home/Settings regressions | 211 passed across eight files |
| Typecheck with generated files staged | Passed |
| Full lint with generated files staged | Passed; three existing Fast Refresh warnings in EventCountdown |
| Mutation check | Both Home success/failure cases rejected removal of the two ownership comparisons; source restored byte-for-byte |
| Browser repeat run | 25 passed: five repetitions of each browser case, two workers, no retries; 1.7 minutes |

Validation corrected generated fixture assumptions rather than production behavior: the logging fixture is callable while the library singleton exposes `step`; polling predicates need a boolean return in the installed types; Settings mounts twice under development StrictMode; and Supabase retries 503 reads, so the isolated failure response uses nonretryable 400. The final tests explicitly track both Settings invocations and verify that the latest current-session response alone supplies the row. Initial failures and final checks are recorded under `evidence/`.

The mutation retained both the user-ID and latest-load guards, removing only the session-version comparisons. Both Home cases failed at the stale-outcome assertion. A captured browser result showed one invocation returning `success` and restoring the previous event despite the new auth version. This proves the new coverage reaches the ownership gap without relying on a successor request to discard the old response.

## Playwright Utils deviations

Paths below are relative to the bundle's `tests/` directory:

- `api/event-load-session-ownership.spec.ts:104`: explicit second authentication is the scenario under test; initial setup uses the auth provider and the request still uses `apiRequest`.
- `e2e/events/event-load-session-ownership.spec.ts:107`: the second login uses the real form to exercise the auth transition; initial setup uses the existing auth fixture.
- `support/helpers/event-load-session-ownership.ts:126`: captured requests' `response()`/`finished()` verify actual completion because custom-handler interception resolves at capture with a synthetic status.
- `support/helpers/event-load-session-ownership.ts:212`: `unroute` disposes the controller's exact owned pattern because the installed interception utility provides no disposer.

Both specs use merged fixtures (2/2), all interception uses `interceptNetworkCall`, all direct test HTTP uses `apiRequest`, and async state waits use `recurse`. No auth wiring is missing. The existing auth provider and monitoring fixture are reused; only the two intentional error tests opt out of network error monitoring. No published response schema exists for these endpoints, so generated database typing and assertions cover the fields under test. HAR, webhook and download utilities are inapplicable. The existing burn-in machinery remains unchanged; explicit repetition validates this artifact pack's selected cases.

## Definition of Done and limits

See [Definition of Done](dw-event-load-session-ownership/definition-of-done.md) and [execution instructions](dw-event-load-session-ownership/README.md). Tests are delivered as an artifact pack and require staging or activation for normal CI collection. A secret-injected production build is not needed for these test-only changes; browser verification used the local Supabase configuration.

The API case proves live auth/read integration. Browser event responses are controlled HTTP fixtures, while auth, service/store actions and UI rendering are real. Lower-level tests retain responsibility for React cleanup timing, retry focus, replay and delayed token-persistence delivery. DW-79/DW-80/DW-81 remain separate deferred concerns. No scenario-count coverage percentage or production release approval is claimed.

Recommended next workflow: `bmad-testarch-trace` when incorporating this pack into release coverage. No additional workflow was invoked automatically.

Final cleanup: the four staged test/helper copies were removed after byte comparison. The named CLI browser and task-started Vite server were closed. A read-only local database check found zero rows bearing the generated API fixture label prefixes. Existing source and the initial ledger diff are preserved; the sprint board was not written.
