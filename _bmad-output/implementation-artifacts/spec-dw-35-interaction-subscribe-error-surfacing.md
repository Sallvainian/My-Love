---
title: 'Surface interaction subscription failures'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
baseline_revision: '6f2589df6d192ede2027be64a59b90787e6d704c'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      Incoming interaction callbacks can still write records from a previous account after the active user changes or teardown begins.
    evidence: |-
      The pre-existing record callback in interactionsSlice calls addIncomingInteraction without checking the captured user or the subscription's active flag. A queued record from the old channel can therefore repopulate shared store state after an account switch. This was not introduced by DW-35's new status callback.
    location: >-
      src/stores/slices/interactionsSlice.ts:223
    severity: high
  - summary: >-
      The subscribeInteractions JSDoc example does not match the method's required arguments.
    evidence: |-
      The example already omitted userId before this change and now also omits the status callback, so copied sample code does not typecheck. It is pre-existing documentation debt outside DW-35's runtime error surface.
    location: >-
      src/api/interactionService.ts:216
    severity: low
---

<intent-contract>

## Intent

**Problem:** A failed incoming-interactions Realtime subscription only writes a log entry, so pokes and kisses silently stop arriving while the interface still appears healthy.

**Approach:** Propagate terminal subscription statuses through the existing service/store boundary to PokeKissInterface and show an accessible, user-facing connection warning.

## Boundaries & Constraints

**Always:** Treat both `CHANNEL_ERROR` and `TIMED_OUT` as failures; preserve normal incoming-record delivery and idempotent cleanup; cover the service propagation and outer UI surface with automated tests.

**Never:** Replace the direct `supabase.channel()` call or redesign Realtime teardown/refcounting; add retry/reconnect behavior; change poke/kiss send behavior; edit the deferred-work ledger.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Healthy subscription | Realtime reports `SUBSCRIBED` and later emits an INSERT | Existing callback receives the record and no warning is shown | No error expected |
| Channel failure | Realtime reports `CHANNEL_ERROR` | PokeKissInterface displays an accessible warning that incoming interactions may not arrive | Failure is propagated without pretending the subscription is healthy |
| Join timeout | Realtime reports `TIMED_OUT` | PokeKissInterface displays the same accessible warning | Failure is propagated without adding a retry |
| Unmount | Component unmounts before or after a status callback | Channel cleanup remains idempotent and no stale UI update occurs | Ignore notifications after cancellation |

</intent-contract>

## Code Map

- `src/api/interactionService.ts` -- `subscribeInteractions` owns the Realtime status callback; expose `SUBSCRIBED`, `CHANNEL_ERROR`, and `TIMED_OUT` so the consumer can distinguish failure from recovery while retaining idempotent teardown.
- `src/stores/slices/interactionsSlice.ts` -- `InteractionsSlice.subscribeToInteractions` is the sole store bridge between the service and UI; forward status changes and keep `isSubscribed` aligned with those statuses.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` -- the only consumer mounts the subscription in an effect; render connection health in state and markup separate from transient `showToast` messages so action timers cannot erase it and benign messages do not inherit alert semantics.
- `tests/unit/api/interactionService.test.ts` -- existing service coverage mocks only PostgREST; extend the Supabase fake with channel status control and assert healthy, failing, recovered, delivery, and teardown behavior.
- `tests/unit/stores/interactionsSubscription.test.ts` -- cover the real slice bridge so each service status reaches the supplied UI callback and updates `isSubscribed` correctly.
- `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` -- add focused component coverage for both failures, recovery, persistence alongside transient toasts, accessibility, and cancellation behavior.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- read-only ledger; the orchestrator records DW-35 resolution.

## Tasks & Acceptance

**Execution:**
- `src/api/interactionService.ts` -- add a status callback for `SUBSCRIBED`, `CHANNEL_ERROR`, and `TIMED_OUT` while retaining status logging, record delivery, and idempotent teardown.
- `src/stores/slices/interactionsSlice.ts` -- forward the status callback through `subscribeToInteractions` and derive `isSubscribed` from status rather than assuming the channel is healthy when setup returns.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` -- use a cancellation-safe status handler to show a persistent, accessible connection warning on either failure and clear it on `SUBSCRIBED`; keep this warning independent from transient action toasts.
- `tests/unit/api/interactionService.test.ts` -- test healthy, failing, recovered, record-delivery, and teardown behavior.
- `tests/unit/stores/interactionsSubscription.test.ts` -- test the real service-to-store callback bridge and `isSubscribed` transitions.
- `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` -- test both failure statuses at the outer UI, recovery, warning persistence while transient toast activity occurs, and no update after unmount.

**Acceptance Criteria:**
- Given PokeKissInterface is mounted, when the incoming-interactions channel reports `CHANNEL_ERROR` or `TIMED_OUT`, then the visible interface announces that incoming pokes and kisses may not arrive.
- Given the incoming-interactions channel subscribes normally and emits a matching INSERT, when PokeKissInterface is mounted, then existing interaction delivery continues without an error warning.
- Given PokeKissInterface has unmounted, when a late failure status arrives, then no stale component update occurs and the channel teardown remains safe to call once.

## Spec Change Log

### 2026-08-20 — Review cycle 2 orchestration clarification

This operational clarification does not change product intent or waive review coverage. Review cycle 2 must retain the four independent, full-diff lenses: blind hunter, edge-case hunter, verification-gap, and intent-alignment. With capacity for three child agents, launch three lens reviewers concurrently and have the primary reviewer independently execute the fourth lens against the same full diff. Do not inspect, combine, synthesize, triage, or act on any finding until all three child reports and the primary lens report are complete; only then perform the normal consolidated triage.

### 2026-08-20 — Review pass 1 repair

The review found that directing the implementation to reuse transient `showToast` state allowed pending action timers and later action messages to erase the connection warning, made all benign toasts assertive alerts, and provided no way to clear a stale warning after Supabase automatically re-subscribed. The Code Map and tasks now require a separate persistent connection-warning surface plus `SUBSCRIBED` recovery handling. They also require a real slice-boundary test so callback forwarding cannot be removed while service and mocked-component tests remain green. KEEP: both named failure statuses reach the visible UI; normal record delivery, cancellation safety, and idempotent service teardown remain covered; the direct channel lifecycle design stays unchanged.

## Review Triage Log

### 2026-08-20 — Review pass 1
- intent_gap: 0
- bad_spec: 3: (high 0, medium 3, low 0)
- patch: 0
- defer: 3: (high 1, medium 1, low 1)
- dismissed:
  - `isSubscribed` was already optimistic and is not consumed by any UI or behavior, so its current value alone has no user consequence; the repaired spec nevertheless aligns it with status.
  - Synchronous subscription setup rejection remains console-only, but the verbatim ledger identifies the unreported `CHANNEL_ERROR` and `TIMED_OUT` callback path, not thrown setup failures.
  - Repeated store teardown only repeats an idempotent false-state write and a debug log; the underlying channel removal remains idempotent, so no claimed cleanup failure occurs.
  - A late service status after teardown cannot update the sole consumer because its cancellation guard rejects the callback, so the claimed stale UI consequence does not occur.
  - `CLOSED` is not included because the verbatim intent explicitly names `CHANNEL_ERROR` and `TIMED_OUT` as the missing error path.
  - The Realtime test fake does not assert unchanged topic/filter details, but this change does not edit those details and the claimed routing regression is not caused by the reviewed diff.
  - The test-local status union exactly matches the production contract in the reviewed diff; possible future drift is not a current software-user consequence.
  - Failure tests need not repeat teardown assertions already exercised through the same returned closure on the healthy path, and the sole UI consumer separately guards late callbacks.
- addressed_findings:
  - `[medium]` `[bad_spec]` Reusing transient toast state lets unrelated timers erase the connection warning and applies assertive semantics to benign messages; require a separate persistent alert surface.
  - `[medium]` `[bad_spec]` Automatic Realtime rejoin can emit `SUBSCRIBED` after failure while the warning stays stale; require recovery status propagation and warning clearing.
  - `[medium]` `[bad_spec]` Service and mocked-component tests leave the real store forwarding seam unverified; require a slice-boundary test and aligned `isSubscribed` transitions.

### 2026-08-20 — Review pass 2
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 2, low 2)
- defer: 2: (high 1, medium 0, low 1)
- dismissed:
  - Synchronous setup rejection remains console-only, but the verbatim ledger limits this bundle to `CHANNEL_ERROR` and `TIMED_OUT` emitted by the Realtime status callback.
  - `CLOSED` is excluded because the verbatim intent names only `CHANNEL_ERROR` and `TIMED_OUT`, and normal teardown also emits `CLOSED`.
  - Late service statuses cannot affect the sole consumer after teardown because the store's active guard and the component's cancellation guard both reject them.
  - Overlapping-subscription state is the direct-channel lifecycle pitfall that the verbatim intent explicitly separates from this bundle.
  - Framer Motion does not overwrite Tailwind v4's horizontal centering here: Tailwind emits the individual `translate` property while Motion animates `transform`.
  - The fixed warning's shrink-to-fit layout wraps within the available viewport half and recenters with `translate`, so the claimed narrow-screen clipping was not substantiated.
  - Equal `z-50` interaction animations may temporarily paint above the warning, but the warning remains mounted and visible again after the brief animation; incoming failure is not silently hidden.
  - Advancing a transient toast timer cannot clear `connectionWarning` because it updates a separate React state setter; the coexistence test proves the two surfaces are independent.
  - Repeating service-level post-teardown assertions would not establish a missing user consequence because the changed store and UI callbacks already suppress late statuses.
  - A single composed integration test is not required to substantiate the chain after service, real-slice, and outer-component contract tests each exercise their adjoining boundary.
- addressed_findings:
  - `[medium]` `[patch]` A previous account's late status could update the new account's subscription state and UI callback; guard the status callback with the captured user identity and add regression coverage.
  - `[medium]` `[patch]` The real slice test did not exercise normal incoming-record forwarding; invoke the captured record callback and assert converted store state and `unviewedCount`.
  - `[low]` `[patch]` Normal resolved component cleanup after a failure status was only implicit; explicitly unmount and assert one teardown call for both failure statuses.
  - `[low]` `[patch]` The component logged “Subscribed” before receiving `SUBSCRIBED`; report only that the subscription was created.

### 2026-08-20 — Review pass 3
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 2: (high 1, low 1)
- dismissed:
  - The JSDoc example omits the required arguments — pre-existing documentation debt already recorded in this spec's deferred list.
  - Synchronous subscription setup rejection remains console-only — the intent names terminal Realtime statuses, not setup exceptions.
  - The service does not suppress callbacks after unsubscribe — downstream store and component cancellation guards prevent a user-visible stale update for the sole consumer.
  - A queued record callback can repopulate state after an account change — pre-existing and already recorded in this spec's deferred list.
  - Overlapping subscriptions can race status state — explicitly outside the intent's direct-channel lifecycle boundary.
  - The toast test does not advance timers — the separate React state proves the warning is independent of toast state, and no user consequence was established.
  - The browser test covers only CHANNEL_ERROR — TIMED_OUT is covered at the required service and outer UI surfaces by focused automated tests.
  - No browser-level INSERT delivery test exists — delivery is covered by service and real-slice tests, while the local Realtime publication cannot provide a safe live INSERT probe.
  - The API test bypasses InteractionService — it is supplemental join evidence, not the service propagation acceptance test.
  - The Realtime control fixture is globally merged — no concrete unrelated-test failure or user consequence was substantiated.
  - Failure injection is not keyed to a specific harness user — the fixture controls the dedicated interaction topic and the claim did not establish a wrong-subscription pass.
  - The browser harness sets Zustand userId without an authenticated session — this is test-harness scope and did not invalidate the focused production-boundary tests.
  - The component subscribe-promise catch does not show a warning — setup rejection is outside the terminal-status intent contract.
  - The completion narrative should call out the deferred stale-record limitation — the limitation is already explicitly recorded in the spec's deferred list and residual-risk documentation.
  - The test summary says no tests were skipped despite the live INSERT limitation — no test command or acceptance claim was shown to be falsely passing because of this wording.
  - The deferred-work ledger changed — it is orchestrator-owned bookkeeping, explicitly outside this run's authority, and must remain untouched.
- addressed_findings:
  - none

## Auto Run Result

Summary of implemented change: Realtime interaction subscription statuses are propagated through the service and store to PokeKissInterface, which displays an accessible persistent warning for CHANNEL_ERROR and TIMED_OUT and clears it on SUBSCRIBED while preserving delivery and teardown behavior.

Files changed: interactionService status propagation; interactionsSlice status bridge and account guard; PokeKissInterface warning surface; focused service, slice, component, API, and E2E coverage; supporting Playwright fixture and harness artifacts.

Review findings breakdown: 0 patches applied; 2 pre-existing items deferred and already present in the spec deferred list; no bad-spec or intent-gap findings; all other findings dismissed with reasons in Review pass 3. The orchestrator-owned deferred-work ledger was not edited by this pass.

Follow-up review recommendation: false (patched high: 0, medium: 0, low: 0; score 0).

Verification performed: focused unit tests passed (3 files, 44 tests); `npm run typecheck` passed; `npm run lint` passed with 3 pre-existing Fast Refresh warnings in EventCountdown.tsx; `fnox exec -- npm run build` passed.

Residual risks: the pre-existing queued-record account-switch race and the pre-existing subscribeInteractions JSDoc mismatch remain deferred; live INSERT delivery is not probed by the local Realtime API test because the local publication is empty.

## Design Notes

Use a callback rather than making `subscribeInteractions` wait for `SUBSCRIBED`: Realtime can fail after initially connecting, and the returned teardown must remain available for the whole mounted lifetime. The callback crosses the already-existing service → store → component chain and does not broaden the separate channel-lifecycle work.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/api/interactionService.test.ts tests/unit/stores/interactionsSubscription.test.ts src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` -- expected: focused service, store, and UI tests pass.
- `npm run typecheck` -- expected: all TypeScript projects pass.
- `npm run lint` -- expected: source and test lint passes.
- `fnox exec -- npm run build` -- expected: production build succeeds with decrypted configuration.
