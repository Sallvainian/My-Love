---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-09-12'
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad-output/implementation-artifacts/spec-dw-81-auth-bootstrap-notification-order.md
  - src/App.tsx
  - src/api/auth/sessionService.ts
  - tests/unit/App.eventsSession.test.tsx
  - tests/support/merged-fixtures.ts
  - tests/support/fixtures/auth.ts
  - playwright.config.ts
  - vitest.config.ts
  - package.json
  - _bmad-output/test-artifacts/dw-auth-bootstrap-notification-order/knowledge-loaded.json
---

# Test automation — DW-81 auth bootstrap notification order

## Preflight

BMad-integrated Create mode; frontend stack, React/TypeScript/Vite with Supabase service tier. Playwright API/E2E and Vitest frameworks exist. Baseline ae77186cb053d48ddcb47cef460972b3c71dcfd6; implementation 126f5a002f913e2b6d2b6dfc4e49aa2116afa78b; HEAD 59305f61534ce50f6a3e09ae3f2dc910da2115f8. The initial uncommitted change is deferred-work bookkeeping, preserved byte-for-byte. No story-specific ATDD/test-design artifact exists. Story completion status is context, not verification evidence.

The configured test_artifacts directory is `_bmad-output/test-artifacts`. This story package preserves prior summaries. Tests are integrated into existing `tests/api` and `tests/e2e` projects and delivered as exact source snapshots here with fixtures and a Definition of Done.

Playwright Utils is enabled and installed: merged fixtures, apiRequest, interceptNetworkCall, recurse and report logging bind this run. Full UI/API profile and core knowledge are loaded by parent and delegated preflight workers; their paths are recorded in knowledge-loaded.json. Pact MCP tool-list check: unreachable, no SmartBear tools. Contract tests are irrelevant (no independently deployed service pair/Pact layout); installed SDK and checked-in source are the evidence fallback. Browser MCP is available; browser exploration used a local test server. No broker calls or production service mutations are needed.

Existing App units cover all acceptance matrix rows (13 bootstrap cases, 20 total). New tests focus on real-browser SDK-to-service-to-App delivery and observable UI/store behavior; supporting API identity checks do not claim to prove client ordering.

## Coverage plan

| ID | Priority / level | Observable contract |
| --- | --- | --- |
| DW-81-API-001 | P1 API | Authenticated user and partner tokens resolve to their distinct expected worker identities and valid metadata through GET /auth/v1/user. Supporting provider evidence only. |
| DW-81-E2E-001 | P0 browser integration | Notification B survives a stale null bootstrap; Home and event request ownership remain current. |
| DW-81-E2E-002 | P0 browser integration | Notification B survives stale A; App's session-dependent sync does not restart and no extra event load occurs. |
| DW-81-E2E-003 | P0 browser integration | First-only null notification beats stale A; Login renders with no authenticated initialization. |
| DW-81-E2E-004 | P1 browser integration | Same-user USER_UPDATED retains current email/metadata and session ownership over stale bootstrap. |
| DW-81-E2E-005 | P1 browser integration | SDK rejection becomes null through real sessionService; listener B and Home survive. |
| DW-81-E2E-006/007 | P1 browser integration | Unsuperseded authenticated and null bootstrap controls leave Loading for the correct surface. |

P0 covers account/session replacement on shared devices; P1 covers continuity and controls that prove the harness accepts legitimate snapshots. Existing units remain authoritative for effect cleanup/remount permutations. The browser suite adds the real service and DOM boundary, rather than copying every unit case. No API endpoint changed, so one bounded read-only identity contract adds supporting provider evidence without broadening into auth hardening.

The deterministic seam is at SDK getSession/onAuthStateChange. It invokes the actual service callback with no fixture ownership filtering; App and composed auth/events guards remain intact. Unrelated initialization and mood sync are controlled/counted. Confidence 9/10 based on source signatures and existing harness patterns. The suite does not claim real GoTrue notification scheduling or full OAuth navigation. Browser source analysis confirms Loading, app-container, login-screen and event card surfaces; live exploration and passing tests corroborated the selectors.

Execution requested/resolved: subagent; capability probe enabled, native subagent launches verified, separate agent-team runtime unavailable. API and E2E generation run in parallel with the required worker JSON contract. No measured parallel speedup is claimed.

## Generated automation

Both worker JSON contracts validated successfully. Eight tests are integrated: one API and seven browser integration, three P0 and five P1. The browser package adds a session/event factory, SDK control harness and reusable fixture; the existing merged-fixtures entry point now composes it. Exact worker drafts and generation statistics are retained in the story package. No source fixture is replaced with a second merged entry point.

Local browser exploration confirmed the real unauthenticated Login surface; `evidence/login-snapshot.yaml` records the snapshot and the named CLI session was closed. Dedicated local verification retains base environment discovery, uses port 5187 and skips shared-pool global setup. All generated files were subsequently executed and validated as recorded below.

## Verification and Definition of Done

Workflow status: **done**. Tests, fixtures, source snapshots, execution evidence and the [Definition of Done](dw-auth-bootstrap-notification-order/definition-of-done.md) are complete. The [checklist](dw-auth-bootstrap-notification-order/checklist-validation.md) distinguishes completed requirements from scope exclusions.

| Check | Measured result |
| --- | --- |
| Generated API/browser tests | 8 discovered, selected and passed; 1 API, 7 browser; P0 3/P1 5; zero skips or flaky results. Initial runner duration 7.85 seconds. |
| Fresh-invocation repeat check | Five separate invocations, 8/8 each, two workers and zero retries: 40/40 executions. Runner durations 5.20–5.32 seconds. |
| Existing auth/App/store units | 59/59 across three files: 20 App cases, 17 auth service cases, 22 sign-out state cases. |
| Typecheck | `npm run typecheck` passed all configured TypeScript projects. |
| Lint | `npm run lint` passed with zero errors and three existing Fast Refresh warnings in unchanged EventCountdown.tsx. |
| Remove notification guard | All three selected P0 cases failed: stale null lost Home, stale other-user lost the cached current event, stale signed-in bootstrap replaced Login. |
| Ignore null notifications | First-only sign-out P0 failed because Login was replaced after stale authenticated bootstrap. |
| Source restoration | App.tsx restored to its original SHA-256 after each probe; final original App/unit/ledger hashes match. |
| Artifact integrity | All seven delivered source snapshots match active and exercised files. Worker drafts match their six generated files; merged-fixtures is the seventh integration file. |
| Mechanical quality | No focused/skipped tests, hard waits, unexplained utility bypasses or extra fixture entry points. Browser cleanup releases held work and restores SDK/service/store instrumentation. |

Both mutation probes are intentional failing runs, recorded separately from correctness results. Their failures occur at the specified UI assertions; they are not reported as product failures or passing executions. No generated test needed a correction, weakened assertion, healing loop or skip. The SDK-rejection case deliberately observes the real AuthService error report and its null fallback; this expected console error does not indicate a failed test.

Use the exact local command in the [README](dw-auth-bootstrap-notification-order/README.md). The `evidence/` directory contains commands, exit codes, selected test results, unit counts, repeat results, mutation replacements, restoration hashes and the initial browser snapshot. Raw traces and resolved runner reports remain in ignored `test-results/dw-auth-bootstrap-notification-order/`; retained evidence excludes resolved configuration and credential-bearing payloads.

### Playwright Utils deviations

- `tests/e2e/auth/bootstrap-notification-order.spec.ts:11`: `authSessionEnabled: false` gives the controlled SDK scenarios isolated synthetic sessions; real cached auth would introduce unrelated notifications. This is not a replacement login helper.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx:145`: HTTP interception/HAR cannot hold a local SDK session promise or invoke its callback. The fixture delivers exact supplied results to real sessionService/App, with no bootstrap ownership filtering. Unrelated initialization and mood sync are controlled and counted; real auth actions, event ownership and UI remain intact.

The API reuses the configured auth provider, uses `apiRequest` and a local minimum Zod schema. No production `/auth/v1/user` response schema exists; identity, audience and metadata fields are validated, with exact UUID/email comparisons against independently resolved worker records. No claim is made about the entire upstream payload. Browser polling uses `recurse`; report logging uses `log.step`. There is no missing required utility wiring. HAR, webhook and new diff-selection CI wiring are irrelevant to this bounded SDK interleaving task. Pact artifacts are irrelevant and were not generated.

### Delivered files and coverage limits

The active files are two specs, one session/event factory module, one browser fixture, the HTML/TSX harness and the extended existing merged-fixtures module. Their exact copies live under `dw-auth-bootstrap-notification-order/tests/`; `source-manifest.json` records their hashes. Existing projects discover the active sources, so no staging step or package-script change is required.

The same-user browser case resolves the old SDK snapshot and synchronously supplies USER_UPDATED before the queued service/App continuation runs; the new email and real display-name prompt remain current without advancing session ownership. The stale-null/different-user cases also complete the retained real event-slice request and assert its card renders. The unsuperseded controls prove the harness still allows ordinary authenticated and null bootstraps.

These are local API and controlled browser integration measurements. They do not establish real GoTrue notification scheduling, complete OAuth/login navigation, StrictMode replay, production deployment, fresh-CI provisioning or the full repository suite. Existing units retain cleanup/remount permutations. The test-only changes required no production build. The sprint board is absent from this worktree and was not created, written or reverted; original deferred-work bookkeeping was preserved.

Next optional workflow: `bmad-testarch-test-review` for independent test-quality assessment, then `bmad-testarch-trace` if formal traceability is needed. Neither workflow was invoked by this automation run.
