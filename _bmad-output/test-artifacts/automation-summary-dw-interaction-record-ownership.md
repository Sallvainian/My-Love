---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-09-12'
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad-output/implementation-artifacts/spec-dw-75-interaction-record-ownership.md
  - package.json
  - playwright.config.ts
  - vitest.config.ts
  - tests/support/merged-fixtures.ts
  - tests/unit/stores/interactionsSubscription.test.ts
  - tests/api/interaction-realtime.spec.ts
  - tests/e2e/partner/interaction-subscription-warning.spec.ts
  - _bmad-output/test-artifacts/automation-summary-dw-interaction-subscribe-error-surfacing.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/library-integration-mandate.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/data-factories.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-quality.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/overview.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/api-request.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/auth-session.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/intercept-network-call.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/recurse.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/log.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/file-utils.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/burn-in.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-error-monitor.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/fixtures-composition.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/fixture-architecture.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-first.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pact-mcp.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/playwright-cli.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/confidence-gate.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/evidence-integrity.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md
---

# Test automation — DW-75 interaction record ownership

## Preflight

BMad-integrated Create mode; frontend stack (React/TypeScript/Vite, Supabase service tier). Playwright API/E2E and Vitest frameworks exist. Baseline `13633c37d88d4fb63d36ad54d84d5bba5e3e6120`; implementation `62186a91`, current HEAD `9bc09049`. Initial working-tree change is orchestrator-owned deferred-work bookkeeping and is preserved. No DW-75-specific test design or ATDD artifact exists.

TEA artifacts resolve to `_bmad-output/test-artifacts`; this run uses a story-specific summary and artifact package to preserve previous runs. Runnable tests will use existing `tests/` projects, with exact generated source snapshots also delivered in the package.

Playwright Utils flag and installed dependency bind this run: single merged fixture entry point, `apiRequest` for HTTP, `interceptNetworkCall` for HTTP interception, `recurse` for polling, `log.step` for logging. Realtime callbacks need an explicitly documented control seam because HTTP interception cannot retain a retired JavaScript callback. Pact broker: unreachable (SmartBear MCP tools not available in one tool-list check). No contract artifacts or provider states are relevant: the repo has no independently deployed service pair/Pact package; provider evidence comes from checked-in Supabase schema and service source.

Core knowledge and full UI/API Utils profile loaded through parent and delegated knowledge preflight; paths are recorded in `dw-interaction-record-ownership/knowledge-loaded.json`. Browser CLI and MCP are available. Node 24.19.0; dependencies installed with `npm ci --ignore-scripts`. Local Supabase is already running. No secrets are written by this workflow.

All seven acceptance matrix rows have existing unit coverage. New coverage must exercise distinct API/service or rendered UI boundaries and must fail if the ownership guard is removed. Sprint board, ledger, production implementation, generated database types and archived tests are outside this automation edit scope.

## Coverage plan

| ID | Priority / level | New observable contract |
| --- | --- | --- |
| DW-75-API-001 | P1 API | Authenticated partner INSERT and receiver GET return the exact server record used by callback fixtures; cleanup only the generated ID. Supporting provider evidence, not proof of the client guard. |
| DW-75-E2E-001 | P0 browser integration | Real clearAuth then same-account setAuthUser rejects the retained active old callback; empty list/count/badge remain empty, fresh subscription delivers. |
| DW-75-E2E-002 | P0 browser integration | Switching A to B rejects old callbacks both before and after B delivery; exact B state and badge survive. |
| DW-75-E2E-003 | P1 browser integration | Same-user refresh retains lifetime and current records; new/duplicate/viewed records preserve correct visible unread counts. |

P0 reflects private couple data leaking across authentication lifetimes on a shared device. P1 continuity protects usable interaction notifications. Existing unit tests remain the smallest complete coverage for teardown reentrancy and all matrix permutations; no duplicated teardown browser test is needed. The API test adds provider contract evidence absent from the existing join-only API spec. No unrelated send/channel/auth redesign or RLS suite is added.

Confidence: 9/10 for API contract (checked-in database types, interaction service, existing worker fixtures); 9/10 for browser store/badge contract (production component test ids and real authSlice behavior). Unknown: live Postgres-to-Realtime delivery is outside the controlled callback seam and is not claimed. The harness intentionally replaces only subscribeInteractions, retaining the actual callback supplied by the production slice. It never replaces the guarded slice method or addIncomingInteraction. This prevents the SDK from hiding the regression by discarding stale socket frames first.

Execution mode: requested subagent (user), capability probe enabled; runtime subagent launch is verified, agent-team orchestration is not separately exposed; resolved subagent. API and E2E workers generate JSON outputs in parallel; parent aggregates fixtures and performs all verification.

## Generated automation

Both worker JSON outputs succeeded and were validated, then copied to `dw-interaction-record-ownership/workers/`. Four tests: 1 API and 3 browser integration (P0 2, P1 2). New infrastructure: one record factory, one callback-control fixture/browser harness, and a receiving-partner token fixture using the existing auth provider. The single merged-fixtures entry point was extended. API/E2E generation ran concurrently; no sequential baseline or speed gain was measured.

Confidence: 9/10 for fixture implementation. Rationale: class prototype lookup, callback signature, component effect, auth actions, and fixture APIs were read from source. Callback dispatch always invokes the captured production callback without fake ownership filtering; snapshot returns observed production store state, serializing only Date values. Unknowns: full-app auth-event wiring and live Realtime record transport are intentionally outside this controlled browser boundary.

The artifact-local `playwright.verify.config.ts` imports the real config (retaining local Supabase environment derivation), resolves test paths against the project, starts a dedicated Vite test server on port 5185, and disables only the shared-account-resetting global setup. Read-only preflight confirmed 20 existing worker/partner rows, all linked. This local verification config requires that existing pool; ordinary clean CI continues to use its normal setup.

## Verification and Definition of Done

Workflow status: **done**. All required generation, fixture integration, validation, documentation and source snapshots are complete. The [Definition of Done](dw-interaction-record-ownership/definition-of-done.md) and [checklist](dw-interaction-record-ownership/checklist-validation.md) retain the detailed completion checks.

| Check | Completed evidence |
| --- | --- |
| New tests | PASS: 4/4, 3.9 seconds in the first fully green run; 2 P0 and 2 P1. |
| Fresh-process repeats | PASS: five separate invocations, 4/4 each, two workers, zero retries; 20/20 executions, 3.75–3.97 seconds per invocation. No skipped/flaky cases. |
| Existing focused unit regressions | PASS: 69 tests / 4 files, 1.01 seconds. Includes all seven story matrix rows, service/status behavior and component checks. |
| Existing neighboring Realtime tests | PASS: API channel join and browser warning/recovery, 2/2 in 4.4 seconds after the shared fixture changes. |
| Typecheck | PASS: `npm run typecheck`, repeated after the API correction. |
| Lint | PASS: zero errors, three pre-existing Fast Refresh warnings in EventCountdown.tsx. Corrected API file also linted separately. |
| Remove all record checks | Expected failure: both P0 cases fail on leaked records and unread count in signed-out/new-account state. |
| Remove only lifetime comparison | Expected failure: same-account-return P0 fails after the account returns; old callback has cleanupCalls=0. |
| Restoration/integrity | PASS: original implementation and unit-file SHA-256 restored/matched, ledger and sprint-board bytes unchanged; all eight delivered source snapshots match active files. |

The initial execution could not measure behavior because the matching Chromium headless shell was absent. After installation, three browser cases passed and the API exposed the utility media-type parser limit. The final API requests ordinary JSON arrays, validates the successful record schema, checks exact receiving-partner read equality, and deletes only its generated UUID. Both initial failure reports are preserved; no assertion was skipped or weakened to accept an empty response.

Mutation evidence records purposeful failing tests separately from final correctness evidence. The full record guard was disabled for two P0 probes; only the auth-lifetime comparison was disabled for the narrower probe. Each failed with an extra interaction and unread count of 1 where empty state/count 0 was required. Source restoration used exact original bytes and was checked after the probes. Five subsequent clean runs passed. This demonstrates callback-ownership sensitivity without claiming live socket delivery.

### Playwright Utils deviations

- `tests/e2e/partner/interaction-record-ownership.spec.ts:12`: browser integration uses real authSlice actions with local identities and the existing `authSessionEnabled: false` option to keep retired callbacks callable. This is not an alternate login helper.
- `tests/support/harnesses/interaction-record-ownership.tsx:57`: HTTP interception/HAR replay cannot hold a JavaScript subscription callback across owner changes; the controlled service seam calls the production callback without filtering. The slice guard and production UI remain intact.

The API uses the existing auth provider for both worker identities, `apiRequest` for INSERT/GET/DELETE, and runtime Zod validation. No production interactions response schema exists, so the test-local schema constrains successful non-null values and the server timestamp. A standard JSON response is used because the installed utility cannot parse `application/vnd.pgrst.object+json` (its parser returns null); the API test makes no singular-media-type claim. No Pact artifacts are relevant. No required utility wiring is missing. HAR/Webhook tools are irrelevant to the retained-callback seam. The five cold invocations implement the existing CI repeat strategy locally; diff-selection/burn-in scripts and CI were not changed.

### Files delivered

- API spec: `tests/api/interaction-record-ownership.spec.ts`.
- Browser spec: `tests/e2e/partner/interaction-record-ownership.spec.ts`.
- New record factory and ownership fixture: `tests/support/{factories,fixtures}/interaction-record-ownership.ts`.
- Browser harness: `tests/support/harnesses/interaction-record-ownership.{html,tsx}`.
- Existing fixtures extended: `tests/support/fixtures/auth.ts` and `tests/support/merged-fixtures.ts`.
- Artifact package: `dw-interaction-record-ownership/`, containing matching source snapshots, local verification config, README, Definition of Done, checklist, knowledge/generation manifests, worker drafts and execution evidence.

### Remaining scope limits

These are local API and browser integration measurements. They do not verify production deployment, Supabase auth-event wiring through App.tsx, full sign-in navigation, or actual Postgres-to-Realtime delivery. The API validates supporting server-record evidence; all ownership claims come from actual guarded store callbacks and rendered badge assertions. Existing units remain the teardown/activity-flag coverage. The normal CI workflow was not run or modified.

The record factory uses the Node UUID generator instead of Faker because these records require identities rather than generated prose. Browser Given/When/Then stages use visible report steps. Existing scripts/config discover the runnable tests; the package README records the focused local command. The story's done status was treated only as context, never verification evidence.

Next recommended workflow: `bmad-testarch-test-review` for independent test-quality review, then `bmad-testarch-trace` if formal traceability is required. Neither was invoked by this automation workflow.
