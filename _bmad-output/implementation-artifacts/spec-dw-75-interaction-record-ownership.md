---
title: 'Reject interaction records from retired subscriptions'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '13633c37d88d4fb63d36ad54d84d5bba5e3e6120'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      The interactions slice header incorrectly describes its cross-slice dependencies as self-contained.
    evidence: |-
      The baseline already read authSlice.userId for sends, history, and subscriptions while its header said "None (self-contained)". The record callback now also reads authSessionVersion. This pre-existing documentation mismatch can mislead a developer composing an isolated slice fixture about the auth state it requires; production behavior is unaffected.
    location: >-
      src/stores/slices/interactionsSlice.ts:10
    severity: low
---

<intent-contract>

## Intent

**Problem:** DW-75 identifies an unguarded incoming-record callback that can repopulate the shared interactions store after subscription teardown or an authentication change. Checking only the user ID would still admit records from a session that ended before the same account signed in again.

**Approach:** Forward incoming records only while their subscription remains active and belongs to the current user and authentication lifetime. Extend the store subscription tests to prove stale records are ignored and current records still arrive once.

## Boundaries & Constraints

**Always:** Reuse the existing `authSessionVersion` ownership value and subscription activity flag. Reject stale callbacks before forwarding to `addIncomingInteraction`. Preserve current-session delivery, record conversion, duplicate suppression, and unviewed counts. Exercise teardown, account switches, and sign-out followed by same-account sign-in.

**Never:** Change the channel mechanism, send behavior, authentication lifecycle implementation, or unrelated loaders. Edit the deferred-work ledger; the orchestrator owns resolution. Add persistent state or redesign subscription teardown and status handling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Current subscription | Active subscription, matching user and auth lifetime; new record | Converted interaction enters the store and unviewed count follows existing rules | No error expected |
| Duplicate record | Current subscription receives the same record twice | One interaction and one count increment | Ignore duplicate |
| Teardown | Record arrives during service cleanup or after unsubscribe returns | Store interactions and count stay unchanged | Silently ignore retired callback |
| Account switch | Account A subscription delivers after switching to B without its cleanup running | No A record enters B's store; B subscription still delivers | Silently ignore old owner |
| Signed out | Old subscription delivers with no authenticated user | Empty account state stays empty | Silently ignore old owner |
| Same-account return | A signs out then signs in again while an old callback remains callable | Old callback is ignored; new A subscription delivers | Silently ignore old lifetime |
| Same-user refresh | Auth updates the same user without sign-out | Existing subscription continues to deliver | No error expected |

</intent-contract>

## Code Map

- `src/stores/slices/interactionsSlice.ts:210` -- `subscribeToInteractions` captures the user before service setup; its record callback at 223 lacks ownership checks. The local `active` flag is cleared before calling service cleanup. Keep that ordering and the neighboring status behavior. `addIncomingInteraction` already converts records and deduplicates by ID.
- `src/stores/slices/authSlice.ts:148` -- existing `authSessionVersion` is runtime-only. `clearAuth` and account changes advance it; same-user `setAuthUser` refreshes retain it. Read and reuse; no production auth changes are needed.
- `src/stores/slices/eventsSlice.ts:212` -- existing example captures user and auth lifetime together and checks both before accepting asynchronous results.
- `tests/unit/stores/interactionsSubscription.test.ts` -- existing fake captures service callbacks and tests conversion, statuses, and cleanup. Extend it to retain callbacks for successive subscriptions and exercise real auth actions with a suitably initialized store. Assert observable `interactions` and `unviewedCount`, including a nonempty current-session state that stale callbacks cannot alter.
- `tests/unit/stores/signOutClearsAccountState.test.ts` -- existing composed-store auth/reset coverage provides lifecycle regression checks.
- `src/api/interactionService.ts:241` -- read-only service boundary returns a teardown function; preserve channel topic, filter, callbacks, and send behavior.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- read-only; DW-75 resolution is recorded externally.

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/slices/interactionsSlice.ts` -- capture authentication lifetime alongside the user and reject incoming callbacks if activity, user identity, or lifetime no longer matches, before forwarding the record.
- [x] `tests/unit/stores/interactionsSubscription.test.ts` -- cover every matrix scenario using captured callbacks and actual store state; retain status/recovery coverage and verify repeated cleanup remains safe.

**Acceptance Criteria:**
- Given the store receives service callbacks across teardown and authentication transitions in the matrix, when retired callbacks fire before or after a new subscription delivers, then the store's interaction list and unviewed count contain only accepted current-lifetime records.
- Given a valid subscription survives a same-user auth refresh, when it receives a new record and a duplicate, then the store exposes one converted interaction with one unviewed increment and existing status/recovery behavior still works.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass

- Review execution: three independent reviewers started together; the independent intent auditor started when the first slot became available. All four reports were complete before triage. The verification-gap and edge-case reviewers returned no findings.
- verdicts: 9 findings and surface observations — high 0, medium 0, low 1, false 8, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind hunter: real auth transitions do not isolate removal of the user-ID comparison — the isolation observation is accurate, but no missing production behavior follows. App.tsx routes identities through setAuthUser/clearAuth, whose atomic version advance is covered by the composed-store tests; the direct harness setter initializes its test identity. The required user comparison remains present, and a synthetic independent branch mutation is not a missing acceptance scenario.
  - `[false]` `[reject]` Blind hunter: no deferred subscription-setup record test — the callback captures ownership before the service call and checks it on every invocation, with no post-await initialization or enabling branch. The same guard therefore rejects changed ownership before setup resolves; no setup-dependent defect was established.
  - `[false]` `[reject]` Blind hunter: teardown lacks a same-lifetime replacement subscription — the teardown test already holds identity and lifetime constant while proving the local activity flag rejects records during and after cleanup. The active flag is per invocation, so a new subscription cannot reactivate the retired closure; current delivery is independently covered. The unchanged shared-channel mechanism is expressly preserved by the bundle.
  - `[false]` `[reject]` Blind hunter: refresh coverage starts with an empty list — same-user setAuthUser updates identity fields only and neither resets interactions nor increments ownership; composed-store coverage also checks state preservation on the same path. The new test verifies the requested subscription continuity and duplicate behavior. A refresh clearing records is not a behavior of this change.
  - `[low]` `[defer]` Blind hunter: the slice header says it has no cross-slice dependencies — confirmed in the baseline, which already depended on authSlice.userId. Preserve this pre-existing documentation issue in frontmatter for external triage; no runtime defect or scope expansion is needed.
  - `[false]` `[reject]` Intent auditor: tests call auth actions directly instead of driving Supabase events — the bundle names the store callback and unit-test file as its surface. The diff and tests use that surface, and App.tsx calls these same auth actions; a browser auth-wiring test is not a divergent requirement here.
  - `[false]` `[reject]` Intent auditor: teardown coverage starts at the store unsubscribe rather than unresolved component cancellation — the requested guard uses the subscription's active flag, which is cleared synchronously before service cleanup. Component cancellation is a separate existing lifecycle surface; no divergence from the explicit store-boundary contract was found.
  - `[false]` `[reject]` Intent auditor: replacement delivery uses a captured service callback rather than mounted UI and live Supabase — this establishes the explicitly requested current-subscription store delivery, while existing service and component tests cover their neighboring contracts. The intent expressly retains the channel mechanism.
  - `[false]` `[reject]` Intent auditor: lifetime ownership is added only to record delivery, leaving status and cleanup writes unchanged — the bundle specifically identifies incoming records and cites the status callback as neighboring context. No status or cleanup redesign is claimed or required by this change.

## Design Notes

Authentication ownership must include both identity and lifetime: A → signed out → A has the same user ID but a different `authSessionVersion`. The callback remains callable even if component cleanup has not yet run, so the ownership check belongs at the store boundary and must not rely on React teardown timing.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/stores/interactionsSubscription.test.ts tests/unit/stores/signOutClearsAccountState.test.ts tests/unit/api/interactionService.test.ts src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` -- expected: ownership regression tests and neighboring auth/service/UI behavior pass.
- `npm run typecheck` -- expected: all TypeScript projects pass.
- `npm run lint` -- expected: no lint errors; report any existing warnings.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

Summary: Incoming subscription records are accepted only while activity, user identity, and authentication lifetime still match. Current records retain conversion, duplicate suppression, and existing unviewed-count behavior.

Files changed:
- `src/stores/slices/interactionsSlice.ts` — capture authSessionVersion and guard incoming-record forwarding.
- `tests/unit/stores/interactionsSubscription.test.ts` — use real auth actions and retained callbacks to cover ownership changes, cleanup, valid delivery, refresh, and duplicates.
- This spec — record the plan, completed tasks, verification, review triage, and result.

Review: 0 patches applied (high 0, medium 0, low 0); 1 pre-existing documentation item deferred; 8 findings or descriptive surface observations rejected for the reasons recorded individually above. No intent gap or bad-spec finding remained.

Follow-up review recommendation: false. No patch introduced an unverified risk.

Verification: The implementation agent observed four ownership regressions fail before applying the guard. The final required test command passed all 69 tests across four files (6 subscription, 22 auth/reset, 36 interaction service, 5 component tests). `npm run typecheck` passed. `npm run lint` passed with zero errors and three existing Fast Refresh warnings in EventCountdown.tsx at lines 68, 91, and 132. Vitest also reported the existing Vite config-loader warning about __dirname. Both working and staged whitespace checks passed.

Matrix audit: All seven rows ran and passed. The status/recovery test covers current converted delivery; the refresh test covers duplicate suppression, viewed counts, and same-user continuity; the teardown test covers cleanup reentrancy and late callbacks; dedicated tests cover account switching, signed-out state, and same-account return. Account-switch and same-account-return tests reject old callbacks before and after a new subscription delivers, preserving exact accepted records and count.

Residual limits: Verification uses controlled service callbacks for the requested store-boundary behavior; no live channel or browser authentication-transition claim is made. Existing channel, send, status, and auth lifecycle implementations remain unchanged. The deferred-work ledger was not edited.
