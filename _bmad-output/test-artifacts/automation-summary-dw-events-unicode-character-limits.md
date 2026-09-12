---
story: dw-events-unicode-character-limits
workflow: bmad-testarch-automate
mode: create
status: done
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: step-04-validate-and-summarize
lastSaved: '2026-09-12'
inputDocuments:
  - AGENTS.md
  - _bmad/tea/config.yaml
  - _bmad-output/implementation-artifacts/spec-dw-83-events-unicode-character-limits.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - playwright.config.ts
  - vitest.config.ts
  - package.json
  - src/components/Settings/EventsSettings.tsx
  - src/components/Settings/__tests__/EventsSettings.test.tsx
  - tests/api/events-wire-contract.spec.ts
  - tests/e2e/settings/events-persistence.spec.ts
  - tests/support/merged-fixtures.ts
  - tests/support/fixtures/index.ts
  - tests/support/factories/events.ts
  - tests/support/helpers/events.ts
---

# DW-83 Unicode events automation

## Preflight

BMad-Integrated; detected stack `frontend` (React/TypeScript/Vite with Supabase as the live API/database tier). Playwright, Vitest, playwright-utils, worker-pool authentication and scoped events fixtures are installed. Node 24.19.0 and healthy local Supabase containers are available. No framework scaffolding is needed.

Scope is implementation commit `4296a25e`, present at HEAD `1de19176`; the initial uncommitted diff is solely the orchestrator's DW-83 ledger resolution. The ledger and sprint board are preserved. The spec status is context, not verification evidence. No dedicated Unicode ATDD or test-design output was found.

Existing component tests cover all 16 Add/Edit × label/description × emoji/decomposed × exact/over-limit cases. They assert exact trimmed values, no native maxlength, successful state/UI updates and rejection without writes. API/E2E additions will target real transport, installed constraints, native controls and persistence.

Configuration: `tea_use_playwright_utils=true`, `tea_use_pactjs_utils=true`, `tea_pact_mcp=mcp`, `tea_browser_automation=auto`, `tea_execution_mode=auto`, `tea_capability_probe=true`, risk threshold P1. Playwright-utils mandate applies; reuse the existing merged fixture entry point. Pact relevance gate is closed: this is one browser client with Supabase, no independently deployed service-to-service contract change or Pact dependency. Tool-list probe: `pact_mcp_reachable=false`; provider-source fallback is the local migrations/installed constraints, with no inferred broker data.

Knowledge loaded across the parent and context workers: library-integration-mandate, playwright-utils-mandate; test-levels-framework, test-priorities-matrix, data-factories, selective-testing, ci-burn-in, test-quality; overview, api-request, network-recorder, auth-session, intercept-network-call, recurse, log, file-utils, burn-in, network-error-monitor, fixtures-composition, fixture-architecture, network-first, pact-mcp and playwright-cli. Both context workers returned applicable rules before generation.

Generated code, fixtures, runnable configuration, evidence and Definition of Done live in `automation-dw-events-unicode-character-limits/` and this report under TEA's configured `_bmad-output/test-artifacts/`. Existing historical automation reports are retained.

## Coverage plan

| IDs | Priority | Level | Behavior and distinct evidence |
| --- | --- | --- | --- |
| DW83-API-001–008 | P1 | API | POST/PATCH × label/description × supplementary emoji/decomposed combining text: exact 100/500 accepted, 101/501 refused with field CHECK code 23514, absent POST or unchanged PATCH verified by authenticated read. Tests hit installed constraints, bypassing form validation. |
| DW83-E2E-001–002 | P1 | Browser | Padded exact-limit emoji Add→decomposed Edit and reverse: native values preserved, outgoing body exact, response→store→UI synchronization, reload and edit-prefill preserve code points. |
| DW83-E2E-003–006 | P1 | Browser | Add/Edit × label/description reject one excess code point, retain dialog/field error and original persisted state, then correct and successfully save. Add uses emoji and Edit uses decomposed text. |
| DW83-E2E-007 | P2 | Browser | Mixed ASCII/emoji/combining/ZWJ text at exact limits survives native input, save and reload; exact-string readback guards against normalization or input truncation. |

All matrix permutations remain at component level; browser expansion is limited to persistence and native-input evidence. Existing ASCII, required fields, dates, icon selection, error handling, auth/RLS, and guard extraction coverage is reused, not regenerated. No P0: this change affects bounded validation, not authentication or data confidentiality.

Execution capability probe: subagent launch succeeded; no dedicated agent-team runtime primitive is exposed. Requested auto with user permission to use subagents resolves to subagent mode. API/E2E workers generate JSON outputs separately; parent aggregates shared pure fixtures and validates.

CLI probe succeeded against a dedicated local Vite process at http://127.0.0.1:5183; the initial snapshot shows the expected authentication gate. Authenticated form selectors were verified with the existing provider and retained in evidence/form-snapshot.yml before test execution.

## Generated artifacts

Both subagents succeeded. Aggregated 8 API tests and 7 E2E tests (P0: 0, P1: 14, P2: 1, P3: 0) into two specs. One shared module supplies exact Unicode fixtures, browser padding and structural response schemas. Existing merged auth, API/interception/polling and coupleEvents fixtures provide execution and checked worker-scoped cleanup; no second fixture entry point is created. Dedicated Playwright and TypeScript configurations discover and check the artifact files in place.

API generation and E2E generation overlapped; no sequential comparator was measured, so no speedup claim is made. Worker metadata is retained under evidence/worker-manifests.json; aggregate metadata is in evidence/generation-summary.json. The E2E IDs were aligned to the planned DW83 prefix during aggregation.

Validation baseline: 177 component/validation tests, 236 pgTAP assertions, project typecheck and lint passed. Lint emits only three existing EventCountdown warnings. A read-only PostgreSQL query confirms all ten emoji/decomposed/mixed fixture lengths; schema and production files are unchanged.

## Verification

All **15 generated tests passed**, followed by **75/75 passes across five repetitions** with two workers, zero retries, zero skips and zero flaky results. This is 90 successful executions of 15 distinct tests, not 90 distinct scenarios.

| Check | Result | Evidence in automation-dw-events-unicode-character-limits/evidence/ |
| --- | --- | --- |
| Artifact Playwright discovery | 15 tests in 2 files | discovery.log |
| First live run | 15 passed, 18.8 seconds | results-first.json, execution.log |
| Five repetitions | 75 passed, 76.6 seconds | results-repeated.json, repeated-execution.log |
| Existing Settings/component/mirror regression | 177 passed across 7 files | component-regression.log |
| Installed database regression | 236 assertions across 22 files passed | database-regression.log |
| PostgreSQL Unicode fixtures | All 10 lengths match literal expectations | postgres-unicode-counts.log |
| Project typecheck and lint | Exit 0; three existing EventCountdown lint warnings | typecheck-project.log, lint-project.log |
| Generated specs/support typecheck and lint | Exit 0 | typecheck-artifacts.log, lint-artifacts.log |
| Original-bug probe | Expected exit 1; one intended failure | utf16-probe-results.json, utf16-probe.log, utf16-probe-error-context.md |
| Cleanup | 0 events before and after; installed CHECKs unchanged | final-database-state.log |
| Source/ledger preservation | Baseline hashes unchanged; no sprint-board writes | source-baseline.json, verification.json |

The probe's Vite transform substitutes the two former UTF-16 comparisons only in the served form module. The server log confirms both replacements applied. DW83-E2E-001 then receives no POST, times out at its required network observation, and its browser snapshot shows both field-limit errors for otherwise valid 100/500-emoji inputs. This failure catches the original regression. Production source was never modified by the probe.

Initial static validation found two generated typing problems: the direct `recurse` export has a wider predicate type than the merged fixture, and the interceptor's request reference is nullable. The helper now derives its type from the actual merged fixture and checks the request before inspecting its URL. Initial errors are retained in typecheck-artifacts-initial.log. Including the root Playwright config also exposed pre-existing Node typing errors outside the project's normal compiler scope; artifact runner configs now follow that existing exclusion and are validated by discovery and live execution. No runtime test repairs, disabled assertions or automatic healing were needed.

The authenticated CLI probe first tried an unprovisioned worker-23 identity, then successfully used existing worker-0 without changing account configuration. It opened and inspected the actual form, then closed its named browser session and removed temporary credentials. Vite processes used for exploration and verification were stopped. Existing React pre-mount state-update console noise was observed; no new suppression was added.

## Playwright Utils deviations

- `automation-dw-events-unicode-character-limits/e2e/events-unicode.spec.ts:106`: a scoped `page.on('request')` listener counts **zero** event mutations after client validation and authenticated readback, then requires exactly one corrected save as a positive control. The single-call interceptor cannot express this zero-request boundary without a timeout. The listener is removed in `finally`. All actual response observation still uses `interceptNetworkCall`.

Both specs import the existing merged fixtures (2/2). Application test requests use `apiRequest`; writes disable retries; store waits use `recurse`; logs use the utility logger. Existing `coupleEvents` retains its established Supabase SDK setup/cleanup. Network-error monitoring remains enabled for every browser case, including rejected inputs, which should generate no HTTP error.

Recommended utilities: auth-session is already wired. HAR recording and webhooks are irrelevant to these live database tests. Stability uses explicit `--repeat-each=5` over the complete story selection; this run does not introduce diff-selection `runBurnIn` wiring or CI scripts. No Pact artifacts are generated; provider behavior comes from installed local SQL and real PostgREST, not broker data.

## Definition of Done

- [x] BMad-integrated scope traced to DW-83's decision, spec and implementation commit.
- [x] Existing coverage examined before selecting independent API/browser evidence.
- [x] Every generated case has a stable ID, P1/P2 priority and Given/When/Then flow.
- [x] Both form modes persist exact-limit emoji and decomposed text through native controls, real POST/PATCH, Zustand, rendered rows and reload/edit prefill.
- [x] Both fields reject a one-code-point overflow in Add and Edit, without writes or persisted changes; corrected input saves exactly once.
- [x] Both API write methods enforce 100/500 installed limits for emoji and combining text, with field-specific 23514 errors and unchanged/absent rows after rejection.
- [x] Mixed ASCII/emoji/combining/ZWJ values preserve exact code points at both limits.
- [x] Shared literal data is independent of source constants; PostgreSQL verifies its arithmetic. UUIDs and worker scope supply isolation without modifying boundary strings.
- [x] Existing auth and fixture composition reused; checked automatic cleanup leaves zero event rows.
- [x] Artifact-local runner discovers all 15 tests; generated specs and support compile and lint.
- [x] Live first run and five repetitions pass with no retries, skips or fixme cases.
- [x] Existing component/database regressions, project typecheck and lint pass.
- [x] Original UTF-16 behavior is rejected by a new browser test in an isolated runtime probe.
- [x] Runtime evidence, CLI snapshot, commands, limitations and utility deviation are recorded.
- [x] Production source, database schema, generated types, archived E2E, existing ledger diff and orchestrator board are preserved.

Checklist interpretations: named literal boundary data deliberately replaces random faker text; random text would weaken the Unicode oracle. Each test asserts one coherent boundary/round trip with multiple necessary observations rather than a single assertion. Native rejection/correction journeys add transport and browser evidence beyond component validation. Existing fixture wiring is reused rather than recreated. No package scripts or root tests README edits are needed: this package's README provides the explicit artifact runner commands requested by the user.

## Use and limits

See [the runnable package README](automation-dw-events-unicode-character-limits/README.md) for API-only, priority, repeated-run, static-check and regression-probe commands. Artifacts are executable in place. Default repository test scripts/CI do not discover this directory; they need the explicit artifact `--config` command. Browser evidence is Chromium against local Supabase; it does not claim other browsers or production deployment verification. No percentage coverage metric was computed.

There is no blocking gap in this automation workflow. The next optional workflow is `bmad-testarch-test-review` over the two specs and shared data module, followed by `bmad-testarch-trace` if story-level traceability is needed. Neither was invoked here.
