---
story: dw-decision-dw-49
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: step-04-validate-and-summarize
lastSaved: '2026-09-12'
status: done
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad-output/implementation-artifacts/spec-dw-49-uncertain-event-save-reconciliation.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - playwright.config.ts
  - tests/support/merged-fixtures.ts
  - src/components/Settings/EventsSettings.tsx
  - tests/e2e/settings/events-write-failures.spec.ts
  - tests/api/events-write-wire-shape.spec.ts
  - tests/support/fixtures/events-refresh-control.ts
---

# DW-49 test automation

Completed: **8 new tests pass** (6 E2E, 2 API; 4 P1 and 4 P2).
The repeated four-worker run passed all 24 executions. Existing focused
regression suites passed all 255 tests. Typechecks, artifact lint and
whitespace checks passed. No production or orchestrator-owned files were edited.

Deliverables: [tests and fixtures](automation-dw-decision-dw-49/README.md),
[Definition of Done](automation-dw-decision-dw-49/definition-of-done.md),
[execution evidence](automation-dw-decision-dw-49/evidence/results.json).

## Preflight

Create mode, BMad-integrated, frontend stack (React/TypeScript with Supabase).
Framework is installed: Playwright, Vitest, playwright-utils, existing merged
fixtures and auth-session provider. Node 24.19.0 and local Supabase containers
are available. Configured artifact directory: `_bmad-output/test-artifacts`.

The implementation is committed at `7dab8ae8`, documented at `22208f24`,
relative to the spec baseline `a48e4f56`. The sole starting working-tree diff
is orchestrator bookkeeping in `deferred-work.md`; it is preserved. Sprint
status is also orchestrator-owned and is not verification evidence.

Loaded TEA knowledge: library/playwright-utils mandates, test levels and
priorities, data factories, selective testing, CI/burn-in, test quality,
confidence gate, evidence integrity, Playwright Utils UI+API profile,
fixture architecture, network-first, Pact MCP and browser CLI guidance.
Examples were omitted from bulk principle reads; installed utility source
will decide the actual API signatures used for generation.

Pact broker: unreachable (SmartBear MCP tools not available).
`pact_mcp_reachable: false`. Provider behavior is sourced from events service,
generated database types and migration contracts. No independently deployed
service pair or existing Pact suite requires new Pact artifacts here.

The component tests already cover error-code routing, resubmission timing,
field edits, refresh success/failure, focus and ordinary retries. New tests
target real HTTP persistence and browser/service/store integration.

## Confidence before generation

Confidence: 9/10. The DW-49 intent matrix and existing events wire-shape,
write-failure and refresh fixtures establish the endpoints, response shapes,
selectors and worker ownership. Unknowns: actual browser behavior when a
committed response is corrupted, and local run outcomes. Both unknowns were
resolved by the passing executions below.

## Coverage plan

| IDs | Priority | Level | Target and distinct evidence |
| --- | --- | --- | --- |
| DW49-E2E-001/002 | P1 | Browser | Real create/update commits, corrupted date in successful response, retained fields, focus, blocked implicit/direct resubmission after edits, authoritative refresh with no replay |
| DW49-E2E-003/004 | P1 | Browser | Empty/create and populated/update refresh failure, closed form, prior rows preserved, read-only Retry recovery |
| DW49-E2E-005 | P2 | Browser | Committed create outside bounded history remains absent after refresh without being replayed |
| DW49-E2E-006 | P2 | Browser | Ordinary transport failure still allows deliberate write retry and successful persistence |
| DW49-API-001/002 | P2 | API | Actual POST object negotiation and PATCH array representation, followed by repeated authenticated reconciliation reads that preserve one row and its update timestamp |

P1 covers the selected regression and its read recovery. P2 API cases establish
the server preconditions; P2 browser cases cover a bounded-list edge and the
retry carve-out. No revenue, security or global data-integrity contract changed
to warrant new P0 tests. Existing component tests retain combinatorial code,
timing, session and focus coverage; existing RLS/stale-delete tests are reused.

The historical story-5 design's R-001 is relevant; DW-49's newer intent contract
governs this run. Its old deferred gaps are not assumed to remain unresolved.
No new validation, schema, idempotency or global form-lock testing is in scope.

Browser exploration: a task-owned Vite test server loaded `/settings` through
the CLI and displayed the expected unauthenticated sign-in page. The isolated
CLI session was closed. Authenticated selectors are grounded in existing E2E
tests and source; generated tests will verify them in the actual auth fixtures.

Execution mode: user allows subagents; capability probe confirms spawn and
message tools. Resolved `subagent` mode with API/E2E workers; no distinct
agent-team runtime primitive is exposed. Parent owns aggregation and execution.

## Generation and aggregation

Both worker JSON outputs succeeded and were validated before materialization:
`/tmp/tea-automate-{api,e2e}-tests-2026-09-12T13-31-53Z.json`.
The API and E2E workers ran concurrently; no sequential speedup was measured.

Generated under `automation-dw-decision-dw-49/`:

- `api/events-save-reconciliation.spec.ts`: 2 P2 cases.
- `e2e/uncertain-event-save.spec.ts`: 4 P1 and 2 P2 cases.
- `fixtures/uncertain-events.ts`: one overridable factory, two related response
  controls sharing completion/error tracking; real commits precede corruption.
- `playwright.config.ts`: artifact discovery with inherited local Supabase
  setup, worker auth, browser options and zero retries.
- `tsconfig.json`: explicitly checks artifact tests omitted by root typecheck.

Total: 8 tests, 2 spec files, 1 fixture module, P0=0/P1=4/P2=4/P3=0.
Reused fixtures: authenticated page/authToken, apiRequest, coupleEvents,
eventsRefreshControl, recurse and network-error-monitor. No second merged
fixture entry point or auth provider is introduced. Shared save control is
project-specific commit/corruption/completion logic, rather than a thin stub
wrapper. Parent summary JSON is preserved in `/tmp/tea-automate-summary-2026-09-12T13-31-53Z.json`.

## Playwright Utils deviations

- `api/events-save-reconciliation.spec.ts:33,47`: raw POST/JSON parse is needed
  because installed apiRequest discards `application/vnd.pgrst.object+json`.
  Preserve production `.single()` negotiation; all PATCH/GET calls use apiRequest.
- `fixtures/uncertain-events.ts:84-86`: route.fetch response JSON is read to preserve
  a real server commit and alter only the delivered date. The utility's handler
  result signals first request arrival and does not return the fetched response.
  Interception itself uses interceptNetworkCall; explicit completion tracking
  waits for the browser response. GET traffic falls through to the shared gate.

No response schema found for `/rest/v1/events`; assertions cover fields under
test using generated row types. Pact.js Utils deviations: not applicable.

## Validation and Definition of Done

| Check | Outcome | Evidence under `automation-dw-decision-dw-49/evidence/` |
| --- | --- | --- |
| Discovery | 8 cases, 2 files | discovery.txt |
| P1 browser recovery | 4 passed, 11.4s | p1.txt, p1-results.json |
| P2 API and browser edges | 4 passed, 9.2s | p2.txt, p2-results.json |
| All cases, 3 repeats, 4 workers | 24 passed, 26.7s; no skips/flakes/retries | repeated-parallel.txt, results.json |
| Focused component/service/store regressions | 255 passed, 4 files, 1.79s | component-service-store.txt |
| Project and artifact typechecks | Exit 0 | project-typecheck.txt, typecheck.txt |
| Artifact lint | Exit 0, no warnings | lint.txt |
| Cleanup and ownership | Zero remaining DW49 rows; original ledger hash unchanged | verification.json |

The longest repeated test took 5.474s. Tests use real local Supabase commits,
authenticated reads, anchored browser clocks, worker-pair cleanup and explicit
HTTP/store/UI assertions. All assertions are visible in test bodies. Pre-run
validation moved assertions out of helpers; no failing run required healing.
Existing intentional component error-injection logs and the installed Vite
native-config warning did not produce test failures.
The Vite dev console also emitted PostCSS and React pre-mount update warnings.
Their causes were not investigated in this automation scope; the suite does
not claim console silence. `evidence/runtime-observations.md` records them.

All applicable workflow checklist items are satisfied; the detailed acceptance
matrix and checklist are in the Definition of Done. No schema/Pact/CI scaffolding
or additional product tests were needed. Auth-session is already wired;
network-recorder/webhooks are irrelevant to real-commit tests. The optional
smart burn-in integration would need a config mapping this artifact directory;
the supplied explicit repeat command verified all eight cases instead.

## Execution and limits

```sh
npx playwright test -c _bmad-output/test-artifacts/automation-dw-decision-dw-49/playwright.config.ts
```

Run with local Supabase active. README documents priority, API-only, repeated
parallel and static-check commands. The root config's Vite test mode needs no
production secrets. Runtime traces are retained in the ignored test-results
directory; durable text/JSON evidence stays under TEA's configured artifacts.

Measured environment: macOS arm64, Node 24.19.0, Playwright 1.63.0 Chromium,
local Supabase. Default CI does not discover artifact-directory specs. No Linux
CI/cross-browser run or new production build was performed. The server contract
and UI are exercised with injected response corruption; these tests do not
claim global idempotency, transport safety for every failure shape, or fresh-form
protection beyond the chosen intent contract.

No additional workflow is required to finish this automation run. Optional
next workflow: `bmad-testarch-trace` for broader coverage accounting.
The customization completion hook resolved to empty and was skipped.
