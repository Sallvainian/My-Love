---
title: 'Guard Events Settings refresh completions after unmount'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '652b5513596047fb3551aa1d60a8aedf6da82621'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** DW-57 identifies manual Events Settings refreshes that complete after navigation unmounts the component and still call local state setters. Retry cleanup and focus requests share this lifetime gap despite the existing authentication-session checks.

**Approach:** Require a live component as well as the current authentication session before manual refresh, retry cleanup, or retry focus completions update local state. Verify pending stale-row refreshes and retries across unmount, while preserving mounted recovery.

## Boundaries & Constraints

**Always:** Preserve user-id and authentication-session-version ownership checks, the initial load effect's cancellation, stale-result handling, retry duplicate suppression, and mounted focus recovery. Exercise the rendered Settings controls to start requests. Keep the deferred-work ledger unchanged; the orchestrator records DW-57 resolution.

**Never:** Change event service/store ownership or cancel their shared loads on component unmount. Expand into async event-write lifetime handling, navigation changes, schema work, or unrelated deferred entries. Add production instrumentation solely for tests. Edit generated files or archived E2E tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stale-row refresh | Edit or delete returns not-found; Refresh events starts a pending load; Settings unmounts | Completion performs no component-local state update or focus scheduling | Success and failure are both ignored locally after unmount |
| Retry after navigation | Failed load exposes Retry; user retries then Settings unmounts before settlement | No local settlement, retry-cleanup setter, or focus request after unmount | Success, failure, and stale outcomes are inert locally |
| Mounted recovery | Pending refresh or retry settles while Settings remains mounted | Successful refresh removes load notice and renders current list/empty state; retry success focuses Add | Failed retry remains usable and returns focus to Retry; stale result does not claim a new outcome |
| Authentication transition | Old manual refresh/retry settles in a later session | Existing session guards reject old outcome, cleanup, and focus ownership | Later session retains its own pending retry |
| StrictMode | Effects replay setup/cleanup during mount before manual refresh/retry | Current mounted requests still settle and recover normally | Initial effect cancellation continues to ignore its superseded invocation |

</intent-contract>

## Code Map

- `src/components/Settings/EventsSettings.tsx:82` — `ownsCurrentSession` synchronously checks the store's user and session version; retain this independent protection.
- `src/components/Settings/EventsSettings.tsx:150` — local settlement/retry state, refs, `recordLoadOutcome`, and initial load effect; only initial load currently has a cancellation flag.
- `src/components/Settings/EventsSettings.tsx:211` — shared `refreshEvents` used by stale edit/delete and `handleRetry`; retry `.finally` clears local state and the later continuation requests focus. Focus effect consumes that request after rendering.
- `src/components/Settings/EventsSettings.tsx:271` — stale-row callbacks close their dialogs before invoking refresh; child cleanup already restores focus to the header.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — subscribable store double, rendered stale-row/retry interactions, mounted success/failure checks, and real auth-transition regressions near the final describe block.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` — real focus trap with motion mocked; covers stale edit/delete refresh focus and dialog cleanup.
- `src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx` — new focused regression suite for controlled pending loads and post-unmount callback observation.
- `src/stores/slices/eventsSlice.ts:208` (read-only) — load returns success/failure/stale and catches service failures; store loads outlive this view intentionally.
- `vitest.config.ts`, `tests/setup.ts` (read-only) — happy-dom, automatic test discovery, negative-offset timezone, and required DOMPurify shim.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx` — add deterministic deferred-load tests through rendered edit/delete Refresh and Retry controls for the matrix; prove regression tests fail before the fix. Observe setter calls in the test harness if needed because React silently discards unmounted updates; retain real React state behavior and stable setter identities.
- [x] `src/components/Settings/EventsSettings.tsx` — add component-lifetime checks at the shared manual-load settlement and retry cleanup/focus continuations, with lifecycle setup that survives StrictMode replay; preserve all existing session and mount-load guards.
- [x] `src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx` — verify successful mounted refresh/retry and repeated failed-retry recovery under StrictMode, retaining existing behavioral, focus, and session suites as regression coverage.

**Acceptance Criteria:**
- Given Settings has started a manual refresh through its rendered controls, when navigation unmounts it before the response settles, then response completion invokes no component state setters and schedules no focus update.
- Given Settings remains mounted in the owning session, when the same actions complete, then its visible recovery/error state, retry availability, and focus behavior remain correct, including after StrictMode effect replay.
- Given a manual action belongs to an earlier authentication session, when its result arrives, then the current session's displayed state, active retry, and focus remain owned by the current session.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 0, false 4, maybe-false 1
- findings:
  - `[maybe-false]` `[reject]` Passive cleanup may leave an interval after DOM removal in which a completion sees the lifetime flag as true — the reviewer reproduced this using a generic component removed by local React state, not Events Settings or application navigation. App reads `currentView` through Zustand and `setView` updates that external store. A parent-side React/happy-dom reproduction using the same `useSyncExternalStore` navigation pattern, even resolving the pending promise during layout cleanup, produced `layout cleanup → passive cleanup → completion: connected=false, live=false` with no dispatch. An Events Settings reproduction through an existing application unmount trigger would settle the remaining claim. If reachable, the claimed consequence is the same discarded setter call as DW-57, graded low; unverified low findings are rejected by the workflow rather than deferred or expanded into more lifetime machinery.
  - `[false]` `[reject]` StrictMode final unmount needs a separate combined case — no incorrect cleanup behavior was demonstrated. Each setup assigns true and returns the same unconditional false assignment; replay does not replace that cleanup with another implementation. The passing StrictMode cases exercise re-arming and cancelled-load ownership, while nine passing unmount cases exercise final cleanup through the actual callbacks.
  - `[false]` `[reject]` An old completion could affect a remounted Settings instance without a dedicated remount test — all lifetime, retry-lock, and focus refs are component-instance refs and each promise retains its originating component closure. A replacement instance cannot reactivate the old instance's false lifetime ref or share its state setters. The existing session overlap suite also passes for the distinct same-instance session transition.
  - `[false]` `[reject]` A real-store integration test is needed to establish that shared loads still complete — the production diff introduces no store cancellation or service change and still awaits the existing `loadEvents` action. The lifetime check runs only when that action has returned. Store/service tests passed in the full suite, and the new harness intentionally lets shared store completion proceed after unmount.
  - `[false]` `[reject]` Expected verification outcomes and unchecked tasks are missing final evidence — those were the required intermediate specification state during review. Finalization below records observed results and completed tasks; the proposed fix edits only this build's specification and is rejected as a review finding under the workflow rule.

Edge-case and verification-gap reviewers reported no findings. The intent-alignment auditor found no material mismatch: component unmount and setter/focus observation match the bundle's requested surface, while existing tests retain authentication-session verification. The blind review's arithmetic line is a finding-floor calculation, not a sixth finding.

## Design Notes

Component lifetime and authentication ownership are independent conditions. Keep initial-load cancellation scoped to each effect invocation; a lifetime ref alone must not revive the first StrictMode load. A separate lifetime check must re-arm during setup and invalidate during unmount cleanup. Do not infer unmounted safety merely from absent DOM or absent console warnings: a regression test must detect the forbidden setter/focus-request call while driving the real UI.

## Verification

**Commands:**
- `npx vitest run src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx` — expected: new regression cases fail before the production fix and pass afterward.
- `npx vitest run src/components/Settings/__tests__/EventsSettings.test.tsx src/components/Settings/__tests__/EventsSettings.focus.test.tsx src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx` — expected: manual-load lifetime, mounted UI/focus, and authentication ownership cases pass.
- `npm run typecheck` — expected: all referenced TypeScript projects pass.
- `npm run lint` — expected: no lint errors.
- `npm run test:unit` — expected: complete unit suite passes.


## Auto Run Result

Status: done

### Summary

DW-57 is implemented. Events Settings now checks component lifetime before recording a manual load outcome, releasing retry state, or scheduling retry focus. Lifetime setup re-arms after StrictMode effect replay. Existing authentication ownership and per-invocation mount-load cancellation remain intact.

### Files changed

- `src/components/Settings/EventsSettings.tsx` — adds the lifetime ref and three completion checks.
- `src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx` — adds 14 rendered-component regression cases for unmount and mounted recovery.
- `_bmad-output/implementation-artifacts/spec-dw-57-events-refresh-unmount-guard.md` — records intent, implementation, review triage, and verification.

The orchestrator-owned deferred-work ledger is unchanged.

### Review outcome

Patches applied: 0 (high 0, medium 0, low 0). Items deferred: 0. Rejected findings: 5, with individual evidence in the Review Triage Log:

- Passive-cleanup timing: a generic local-state reproduction did not reproduce under the app's external-store navigation pattern; application reachability remains unverified and the if-true impact is low.
- StrictMode plus final-unmount coverage: no faulty cleanup branch exists; replay recovery and final cleanup are both exercised by passing tests.
- Remount overlap coverage: old and new component instances have distinct refs, state setters, and callback closures.
- Shared-load integration coverage: the unchanged store action completes before the new local guard runs, and the full store/service suite passes.
- Specification evidence: finalization supplies observed results; a spec-only edit is not an implementation review fix.

Follow-up review recommended: false. No entry was patched and no confirmed unresolved regression remains in the requested behavior.

### Verification performed

- Red baseline reported by the implementation agent: the initial 13-case lifetime suite ran against unchanged production code; 7 failed and 6 passed. The failures detected edit/delete success and failure calling a settlement setter after unmount, plus retry success/failure calling settlement, cleanup, and focus-request setters and stale retry calling its cleanup setter.
- `npx vitest run src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx` — implementation agent verified 14/14 pass after the fix, including an additional mounted stale-retry case.
- Focused run of all four Events Settings suites — implementation agent verified 94/94 pass.
- `npm run test:unit` — parent verified 101 files and 1,670 tests pass, including the same 94 Events Settings cases. Existing expected error-path logging remains non-failing.
- `npm run typecheck` — parent verified all referenced TypeScript projects pass.
- `npm run lint` — parent verified zero errors; three pre-existing Fast Refresh warnings remain in `EventCountdown.tsx`.
- `git diff --check` — passed. Comparing the deferred-work ledger against the captured baseline produced no diff.

### Matrix test audit

Every matrix row has passing active coverage in the parent full-suite run:

- Stale-row refresh: six lifetime cases cover edit/delete success, failure, and stale completion after unmount.
- Retry after navigation: three lifetime cases detect post-unmount settlement, cleanup, and focus-request dispatch for success, failure, and stale outcomes.
- Mounted recovery: the lifetime suite covers successful edit/delete refresh, repeated failed retry followed by success, and stale retry lock release without focus theft; existing behavior and focus suites also pass.
- Authentication transition: the existing behavior suite's stale-row edit/delete refresh and old-retry success/failure cases preserve the current session's state, lock, and focus.
- StrictMode: five lifetime cases cover mounted refresh/retry recovery, stale retry, and rejection of the cancelled first mount load.

### Residual risks

No confirmed unresolved defect remains within the bundle. Browser navigation was not run end to end; the new regressions exercise rendered Settings controls and component unmount directly. The generic passive-cleanup timing hypothesis remains unverified for an existing application path, as documented in triage. Shared store loads intentionally continue after Settings unmounts.
