---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-08-20'
workflowStatus: 'complete'
workflowType: 'testarch-automate'
runScope: 'story-level'
runKey: 'dw-events-settings-load-retry'
executionMode: 'BMad-Integrated'
detectedStack: 'frontend'
pact_mcp_reachable: false
pactArtifacts: 'none — relevance gate closed'
testArtifacts: '_bmad-output/test-artifacts'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/implementation-artifacts/spec-dw-27-events-settings-load-retry.md'
  - '_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md'
  - '_bmad-output/test-artifacts/test-design-epic-5.md'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/README.md'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/e2e/settings/events-crud.spec.ts'
  - 'tests/e2e/settings/events-check-constraint.spec.ts'
  - 'tests/api/events-read-window.spec.ts'
  - 'src/components/Settings/EventsSettings.tsx'
  - 'src/components/Settings/__tests__/EventsSettings.test.tsx'
  - 'src/components/Settings/__tests__/EventsSettings.focus.test.tsx'
  - '.agents/skills/bmad-testarch-automate/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/overview.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/api-request.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/auth-session.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/intercept-network-call.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/recurse.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/log.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/file-utils.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/burn-in.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/network-error-monitor.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/fixtures-composition.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/fixture-architecture.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/network-first.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/playwright-cli.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/pact-mcp.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/error-handling.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/timing-debugging.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/confidence-gate.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/evidence-integrity.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/selector-resilience.md'
---

# Test Automation Expansion — `dw-events-settings-load-retry`

> The workflow template names `{test_artifacts}/automation-summary.md`, but that path already
> contains a completed earlier run. This run follows the directory's established story-key naming
> convention and writes `automation-summary-dw-events-settings-load-retry.md`.

## Step 1 — Preflight & Context

### Stack and framework

`test_stack_type: auto` resolves to **frontend**. No mobile indicators are present;
`package.json`, `vite.config.ts`, and `playwright.config.ts` are frontend indicators, and no
listed backend-language manifest is present. Supabase remains a live API boundary in the test
architecture without changing the manifest-based stack result.

Framework verification **passes**. Playwright declares `chromium`, `api`, and `integration`
projects; Vitest covers `src/**` and `tests/**`; and the required dependencies are installed.
There is no framework HALT condition.

### Execution mode and change scope

Mode is **BMad-Integrated**. The controlling contract is
`_bmad-output/implementation-artifacts/spec-dw-27-events-settings-load-retry.md`, supported by the
original Story 5 specification and its epic-level test design.

The implementation under automation is commit `ba63e5d` over its recorded baseline `5ddbdf4`:
connectivity-triggered Settings reloads, an accessible guarded Retry action, focus restoration,
and component-level regressions. The only uncommitted input at preflight is
`_bmad-output/implementation-artifacts/deferred-work.md`; it is orchestrator-owned bookkeeping,
not a test target and not an editable workflow output.

### TEA flags and knowledge profile

- `tea_use_playwright_utils: true`: both mandate gates hold because the library is installed and
  generated API/E2E specs run on Playwright. Specs must use the project merged fixtures and the
  utility implementation for every covered capability.
- Browser tests exist, so the **full UI+API** profile was loaded, including fixture-composition
  and network-first principles.
- `tea_use_pactjs_utils: true`: the relevance gate is closed. The repository has no Pact package,
  Pact directory, broker marker, or consumer/provider service split, so no Pact artifacts will be
  generated.
- `tea_pact_mcp: mcp`: the required one-time tool-list probe found no SmartBear MCP tools;
  `pact_mcp_reachable: false`. No broker call or retry was made. No provider-state fallback is
  required because contract testing is out of scope.
- `tea_browser_automation: auto`: `playwright-cli.md` was loaded. Selector/API evidence will first
  come from current source and passing neighbouring tests; browser exploration is optional if a
  remaining confidence gap warrants it.

### Context confirmed

Loaded context includes the completed DW contract and acceptance matrix, prior risk/coverage
design, current production diff, Playwright/Vitest configuration, merged fixture entrypoint,
neighbouring API/E2E specs, the changed component tests, and all required TEA fragments. Target
identification can now distinguish the already-covered component behavior from uncovered live API
and browser seams.

## Step 2 — Automation Targets & Coverage Plan

### Confidence gate

```text
Confidence: 9
Rationale: The complete production diff from 5ddbdf4 to ba63e5d was inspected alongside the DW-27
  acceptance matrix, the existing component regressions, the production events read chain, the
  current merged fixtures, and neighbouring active API/E2E specs. Selectors come from
  EventsSettings.tsx and the live route snapshot; HTTP paths and filters come from
  eventsService.getEvents() plus the active events-read-window API suite.
Unknowns:
  - The lightweight browser exploration reached the real unauthenticated /settings route but could
    not inspect authenticated Settings without importing a test storage state. Authenticated
    selectors are nevertheless current source-owned testids already exercised by passing active
    Settings E2E tests.
  - The generated artifacts remain parked under test_artifacts, so validation must copy the entire
    fixture/spec set to its documented target paths, run it, and remove only those temporary copies.
```

Confidence is above the threshold of 7, so generation may proceed. Neither unknown requires a
guessed selector, endpoint, schema, or account identity.

### Browser exploration

`tea_browser_automation: auto` resolved to Playwright CLI. A named `tea-automate` session opened
the running local app at `/settings`, captured the route, and closed cleanly. The unauthenticated
route rendered the expected sign-in surface (Email, Password, Sign In, Continue with Google,
Contact Admin). Authenticated Settings evidence therefore comes from the current component source
and active `tests/e2e/settings/events-crud.spec.ts`, not invented visual text.

### Acceptance criteria and duplicate-coverage guard

| Acceptance behavior | Existing evidence | Remaining seam selected for automation |
|---|---|---|
| Reconnect retries while Settings stays mounted | Component test patches `syncStatus.isOnline` and verifies a second mocked `loadEvents()` | Real browser offline/online events through App → Zustand → production service → live PostgREST → rendered Settings |
| Manual Retry clears the error and starts one load | Component tests cover clear-before-load, success, repeated failure, and the native disabled state | Real failed Settings HTTP load followed by one gated live retry; assert disabled state, exact two-request production read, recovery, and stable focus |
| Last-good rows survive a failed refresh | Component test keeps a mocked row above one retryable notice | E2E reconnect begins with a real seeded row and proves it never disappears during failure/recovery |
| Success may produce a current list or truthful empty state | Component tests cover both branches with a mocked store | API tests prove repeated authenticated reads return a changed live snapshot in both directions (empty → row and row → empty) |
| Stale or switched-account outcomes cannot overwrite current state | Existing slice and component regressions exercise load ids, account guards, and stale rendered attribution | No duplicate API/E2E case; unchanged concurrency machinery is outside this diff |

The new E2E cases overlap component cases only at the user-visible assertion. Their subject is the
cross-layer wiring that mocks cannot prove: App's `online`/`offline` listeners, store dependency
publication, the service's online guard, the real two-request read, and the rendered result. The
API cases do not repeat the existing range-semantics suite; they pin that repeating the same
authenticated snapshot read observes live state changes rather than a stale response.

### Targets, levels, and priorities

| ID | Level | Priority | Scenario | Why this level / priority |
|---|---|---:|---|---|
| DWER-API-001 | API | P2 | Two identical authenticated Settings window reads change from empty to the newly seeded event | Supporting wire premise for successful retry; secondary to the rendered journey and no data-integrity risk |
| DWER-API-002 | API | P2 | Two identical authenticated Settings window reads change from a seeded event to truthful empty after checked removal | Pins the other successful recovery output without re-testing UI branching |
| DWER-E2E-001 | E2E | P1 | A mounted Settings view with a real last-good row fails on browser offline, preserves the row and one notice, then auto-recovers on browser online | Primary cross-layer regression for the reconnect behavior added by this diff |
| DWER-E2E-002 | E2E | P1 | A real failed Settings HTTP load exposes Retry; one click disables it, starts exactly one two-request read, succeeds, removes the notice, preserves the row, and focuses Add | Primary manual recovery and duplicate-activation journey added by this diff |

**Planned total: 4 tests — P0: 0, P1: 2, P2: 2, P3: 0.** There is no P0:
failure leaves an explicit reload/navigation workaround and neither writes nor exposes data.

### Fixture plan

Generate one composed fixture module at the eventual target
`tests/support/fixtures/events-settings-load-retry.ts`. It extends the existing merged fixture,
delegates all seeding/cleanup to `coupleEvents`, obtains the current worker user's JWT with the
existing read-only token helper, and exposes the exact upcoming/past REST paths plus a
browser-connectivity controller whose teardown always restores online state. It does not link or
unlink partners, reset passwords, clear shared rows, or edit `tests/support/merged-fixtures.ts`.

Labels are purposeful assertion vocabulary and dates are derived from the fixture's one anchor
clock. The generated API specs issue their own `apiRequest` calls and keep every assertion in the
test body. No response schema exists for the narrow PostgREST `EventRow[]` response, so assertions
will cover status, array shape, ids/labels, and checked state transitions; this schema omission is
explicit rather than silent.

### Playwright Utils and Pact decisions

- API calls use `apiRequest`; browser failure/observation uses `interceptNetworkCall` registered
  before navigation or Retry. Async request-count stabilization uses `recurse`, not sleeps or
  `expect.poll`.
- Specs import the composed `test`/`expect`, ultimately rooted in
  `tests/support/merged-fixtures.ts`. No direct Playwright `test` import, raw request method,
  `page.route`, `page.waitForResponse`, `page.waitForTimeout`, or `console.log` is planned.
- The deliberate 503 E2E case receives the narrow `skipNetworkMonitoring` annotation; monitoring
  remains enabled for the reconnect test.
- Pact remains out of scope. No Provider Endpoint Map is required because no contract tests will be
  generated.

## Step 3 — Generated Tests & Fixture Aggregation

### Parallel generation result

The workflow capability probe resolved `tea_execution_mode: auto` to **SUBAGENT**:
agent-team support was unavailable and independent subagents were available. The API and E2E
workers ran in parallel and both returned canonical JSON with `success: true`; both payloads
parsed successfully before aggregation. No measured sequential baseline exists, so no numeric
speed-up is claimed.

| Worker | Files | Tests | Priority |
|---|---:|---:|---:|
| API | 1 | 2 | P2 × 2 |
| E2E | 1 | 2 | P1 × 2 |
| **Total** | **2** | **4** | **P1 × 2; P2 × 2** |

### Generated artifacts

The generated sources are parked under
`_bmad-output/test-artifacts/automation-dw-events-settings-load-retry/`:

- `api-events-settings-load-retry.spec.ts` → `tests/api/events-settings-load-retry.spec.ts`
- `e2e-events-settings-load-retry.spec.ts` →
  `tests/e2e/settings/events-settings-load-retry.spec.ts`
- `events-settings-load-retry-fixtures.ts` →
  `tests/support/fixtures/events-settings-load-retry.ts`
- `generation-summary.json` → machine-readable aggregation metadata

The shared fixture composes the existing merged fixture without editing it. It delegates seed and
lifecycle cleanup to `coupleEvents`, uses the existing worker-scoped `authToken`, derives both API
windows from the fixture's one date anchor, verifies explicit clears, and exposes exact,
non-overlapping upcoming/past route patterns. Browser connectivity is restored in teardown, and
every held Retry gate is force-released before its exact routes are removed.

### Fixture categories

- **Authentication:** existing per-worker `authToken`; no form login, password reset, or new auth
  provider.
- **Data factory:** existing `coupleEvents` pair-scoped seed plus checked clear/read boundaries.
- **Network control:** exact upcoming/past observation, two-window 503 injection, and a counted
  teardown-safe Retry gate through `interceptNetworkCall`.
- **Connectivity:** Chromium offline/online state plus the matching DOM event, always restored.

### Mandate deviation roll-up

**Playwright Utils deviations**

- `events-settings-load-retry-fixtures.ts`: calls `page.unroute` for the two exact generated route
  patterns. `interceptNetworkCall` installs a persistent route but exposes no teardown handle; the
  fixture's narrow removal is required before replacing the deliberate 503 with a live gate and
  during teardown. No generated file calls `page.route`, `page.waitForResponse`,
  `page.waitForTimeout`, a raw application request method, `expect.poll`, or `console.log`.

**Pact.js Utils deviations**

- None. Pact relevance remained closed and no Pact artifacts were generated.

### Aggregated statistics

- Stack: frontend
- Tests: 4 total — 2 API, 2 E2E, 0 backend
- Test files: 2
- Fixture modules: 1
- Priority: P0 0, P1 2, P2 2, P3 0
- Validation status: complete

## Step 4 — Validation, Quality Gate & Definition of Done

### Validation result

| Gate | Result | Evidence |
|---|---|---|
| Generated API/E2E suite | **PASS** | 4/4 on the focused run: Chromium E2E 2/2, API 2/2 (15.7 s total) |
| Generated-suite stability | **PASS** | 12/12 with `--repeat-each=3 --workers=1` (42.6 s); no retry or intermittent failure |
| Changed component regressions | **PASS** | 66/66 across `EventsSettings.test.tsx` and `EventsSettings.focus.test.tsx` |
| TypeScript project build | **PASS** | `npm run typecheck` after a temporary local dependency symlink normalized the nested-worktree module path |
| Focused generated-source lint | **PASS** | 0 errors, 0 warnings while the parked sources were active at their target paths |
| Project lint | **PASS** | 0 errors; 3 existing `react-refresh/only-export-components` warnings in `EventCountdown.tsx` |
| Production build | **PASS** | `fnox exec -- npm run build` |

The first Playwright collection attempt found one generated-code issue before any test ran:
`trace` and `video` are worker-scoped, so Playwright rejects `test.use()` inside a describe block.
The opt-out was moved to file scope, matching the existing offline suite, and every subsequent run
was green. Automatic healing was not configured; this was a direct validation correction, no test
was marked `fixme`, and no application file was changed.

The API/data fixture and browser-control fixture were also separated before execution, so the API
project never requests a `page`. The artifact still uses one composed module, but exposes an
API-only `eventsLoadRetryHarness` and a browser-only `eventsLoadRetryBrowser`.

### Coverage by level and priority

| Level | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| API | 0 | 0 | 2 | 0 | 2 |
| E2E | 0 | 2 | 0 | 0 | 2 |
| **Total** | **0** | **2** | **2** | **0** | **4** |

- **DWER-E2E-001 (P1):** a real last-good row survives the offline reload and the mounted Settings
  view automatically recovers after the browser's online transition.
- **DWER-E2E-002 (P1):** a deliberate two-window 503 exposes Retry; one activation is disabled in
  flight, emits exactly one upcoming and one past read, recovers the row, clears the notice, and
  restores focus to Add Event.
- **DWER-API-001 (P2):** identical authenticated reads observe a checked empty → newly seeded row
  transition.
- **DWER-API-002 (P2):** identical authenticated reads observe a checked seeded row → truthful
  empty transition.

Coverage percentage is N/A: this workflow added risk-selected API/E2E scenarios and did not run an
instrumented source-coverage job. Component tests retain the duplicate-activation, repeated
failure, empty-success, stale-load, and account-switch permutations, so the outer-layer tests do
not re-encode those branches.

### Playwright Utils deviations

- `events-settings-load-retry-fixtures.ts:176-177`: `page.unroute` removes only the exact upcoming
  and past route patterns installed through `interceptNetworkCall`. The installed utility exposes
  no teardown handle, and the manual recovery must remove the deliberate 503 before installing its
  live gate. This deviation is commented inline and repeated safely in fixture teardown.

No generated spec contains `page.route`, `page.waitForResponse`, `page.waitForTimeout`, a raw
application request method, `expect.poll`, `console.log`, or a value import of Playwright `test`.
The 503 scenario alone opts out of `network-error-monitor`; the browser-offline file disables trace
and video at file scope because Chromium's offline artifact corruption is already documented by
the repository's existing offline suite.

### Pact.js Utils deviations

- None. The relevance gate found no consumer-provider boundary, so no Pact artifacts were wanted
  or generated.

### Definition of Done

- [x] Current implementation diff and authoritative DW-27 contract analyzed.
- [x] Existing API, E2E, component, and prior test-design coverage checked for duplicates.
- [x] Four distinct tests generated with explicit P1/P2 identifiers and mapped acceptance seams.
- [x] API tests use authenticated `apiRequest` calls and validate both production read windows.
- [x] E2E tests use source-owned test IDs/ARIA selectors, network-first interception, and `recurse`.
- [x] Shared infrastructure composes the merged fixture without editing it or launching a browser
  for API-only tests.
- [x] Data is isolated by `TEST_WORKER_INDEX`, cleaned before/after, and explicit removal is checked.
- [x] Browser connectivity, held gates, and installed routes have failure-safe teardown.
- [x] No hard waits, conditional visibility branches, page objects, brittle CSS/nth selectors, or
  cross-test shared state were introduced.
- [x] Generated tests passed live and passed a three-repeat stability run.
- [x] Changed component tests, TypeScript, focused/project lint, and the production build passed.
- [x] Generated deliverables and this summary are stored under TEA's configured
  `_bmad-output/test-artifacts` directory.
- [x] Temporary active-suite copies, worker payloads, dependency symlink, and Vite/browser sessions
  were cleaned up.
- [x] `sprint-status.yaml` and the orchestrator-owned deferred-work ledger were not written or
  reverted.

README and package-script changes are N/A: the repository already documents and exposes the
Playwright/Vitest workflows, and this request explicitly scopes the new deliverables to parked TEA
artifacts. Faker is also N/A for this domain fixture: existing pair-safe event factories own the
rows, and stable human-readable labels are intentional assertion vocabulary, not user credentials
or shared identities.

### Assumptions and residual risks

- The exact route patterns intentionally pin the current production query serialization:
  `select=*`, one `gte`/`lt` date predicate, two-key ordering, offset 0, and limit 50. A service or
  Supabase-client serialization change will fail loudly and requires the fixture contract to move
  with production.
- The Vite run emitted the repository's existing React warning about an update before mount during
  Settings navigation. It did not affect any assertion and is outside this workflow's test-artifact
  scope.
- TypeScript initially exposed a nested-worktree-only TS2883 path error even with all generated
  files removed, because this worktree's sparse `node_modules` resolves `playwright-utils` from the
  parent repository. A temporary local symlink to that installed scope made the dependency path
  portable and the full typecheck passed; the symlink was removed afterward.
- Validation was selective: the four generated tests, their three-repeat stability run, and the 66
  directly changed component tests ran. The full repository Playwright/Vitest matrix did not.

### Execution and activation

The parked files document their target paths. After activating all three together, run with local
Supabase already started:

```bash
PLAYWRIGHT_AUTH_POOL_SIZE=1 npx playwright test \
  tests/api/events-settings-load-retry.spec.ts \
  tests/e2e/settings/events-settings-load-retry.spec.ts \
  --workers=1
```

### Recommended next workflow

Run `bmad-testarch-test-review` before activating the parked tests permanently, then
`bmad-testarch-trace` if a formal requirement-to-test matrix or quality-gate decision is needed.
