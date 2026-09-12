---
title: 'Attribute event load errors and preserve concurrent writes'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
baseline_revision: '9f9e61b599e26d08ad4d3b818f3d74ed3e76bb19'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: [oversized]
deferred:
  - summary: >-
      User-id-only event load ownership can admit a pre-sign-out response after signing back into the same account.
    evidence: |-
      `loadEvents` validates only `requestedBy` and `latestLoadId`. If account A signs out, signs back in as A, and the old request settles before the new mount effect increments the load id, both guards match and the prior-session response can own the reset list. App's local settled marker is also keyed only by user id. This path predates the bundle; the change preserves rather than introduces those guards.
    location: >-
      src/stores/slices/eventsSlice.ts:210; src/App.tsx:441
    severity: medium
  - summary: >-
      A prior-session event load can still own state after signing back into the same account.
    evidence: |-
      `loadEvents` continues to identify ownership with `requestedBy` and `latestLoadId`. If account A signs out and signs back in as A before the old request settles and before a successor load allocates a new id, both guards still match. The user-id-only guard predates this bundle; the reviewed change preserves it while adding call-owned outcomes and mutation replay.
    location: >-
      src/stores/slices/eventsSlice.ts:210; src/App.tsx:441
    severity: medium
  - summary: >-
      A prior-session event load can still own the reset list after signing back into the same account.
    evidence: |-
      `loadEvents` captures only `userId` and `latestLoadId`. A request started before sign-out can therefore pass both guards after the same user signs in again if the successor Home effect has not allocated a new load id yet. This ownership gap predates the reviewed change, which preserves the existing identity guards while adding per-call results and mutation replay.
    location: >-
      src/stores/slices/eventsSlice.ts:210; src/App.tsx:441
    severity: medium
  - summary: >-
      A manual stale-row refresh can settle after Events Settings unmounts and call its local state setters.
    evidence: |-
      The mount load has a cancellation flag, but `refreshEvents()` awaits `loadEvents()` and then calls `recordLoadOutcome()` without an unmount guard. Navigating away during that request therefore reaches `setLoadFailed` and `setSettledForUserId` after unmount. The path and navigation warning predate this bundle; React discards the update, so the verified consequence is limited to development/test noise.
    location: >-
      src/components/Settings/EventsSettings.tsx:185
    severity: low
---

<intent-contract>

## Intent

**Problem:** `loadEvents` and the event write actions share `eventsError`, so a write failure can be misreported as a load failure. A successful load also replaces the event list with a response captured before a concurrent durable add, edit, or delete and silently rolls that write back on screen.

**Approach:** Return each load invocation's own discriminated outcome and reserve `eventsError` for the active load, so callers never infer one call's result from shared mutable state. Before installing a fetched list, reconcile event changes completed since that load began and keep the existing identity and overlapping-load protections.

## Boundaries & Constraints

**Always:** Preserve last-good events on load failure; keep event ordering by date and creation time; ignore superseded loads and responses for a different signed-in account; reconcile successful add, edit, and delete operations that settle during a load; report save/delete failures through their existing `EventWriteResult` without changing the load outcome.

**Never:** Add persistence, offline queuing, realtime, routing, service/database changes, or changes to the read cap; edit `_bmad-output/implementation-artifacts/deferred-work.md`; weaken account-transition guards or allow an older overlapping load to own store/UI state.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful load | Current-user load resolves without an intervening write | Fetched date-ordered list is installed and that call returns success | Clear only the load error and release the loading flag |
| Load failure | Current-user load rejects while a last-good list exists | Existing list remains and that call returns its own failure | Store and return the load message; release the loading flag |
| Write failure during load | Add/edit/delete fails while a successful load is pending | Successful load is reported as successful; no load notice appears | The write caller receives only its own failure; it does not mutate the load error |
| Write success during load | Add/edit/delete settles after load start but before its older response lands | The loaded server list is reconciled with the completed write and remains sorted | No durable write is visually rolled back or resurrected |
| Superseded or wrong-account load | A newer same-user load starts, or the account changes, before resolution | Stale call returns a non-applying outcome and touches no owned state | Caller ignores the stale outcome; current account/load retains its list, flag, and notice |

</intent-contract>

## Code Map

- `src/stores/slices/eventsSlice.ts` -- root cause and primary fix: `loadEvents`, `latestLoadId`, list sorting, write results, identity guards, shared `eventsError` writes, and the ordered completed-mutation registry needed by active loads.
- `src/components/Settings/EventsSettings.tsx` -- user-visible DW-26 surface: `recordLoadOutcome`, mount load, and manual refresh currently read `eventsError` after a void promise settles.
- `src/App.tsx` -- Home's load effect independently infers failure from `eventsError`; it must consume the same per-call load outcome to keep the home slot truthful.
- `tests/unit/stores/eventsSlice.test.ts` -- focused store behavior; cover mutation completion order, transient add-then-delete, add deduplication, stale-response carry-forward, error-channel isolation, load/load supersession, and account guards.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- Settings notice behavior; make success/failure outcomes disagree with `eventsError` in tests so reading shared state cannot pass.
- `tests/e2e/settings/events-crud.spec.ts` -- outer DW-29 surface with the real slice and service: preserve a Home-populated editable row through Settings' stale mount response.
- `tests/e2e/home/events.spec.ts` -- outer Home boundary for the changed `App.tsx` outcome-to-slot wiring.
- `src/components/RelationshipTimers/EventCountdown.tsx` -- Home slot contract and a stale comment that still describes the old void-result/error inference.
- `src/stores/slices/authSlice.ts` -- read-only unless a new account-scoped field is introduced; `signedOutState()` already resets `events`, `eventsIsLoading`, and load-only `eventsError`.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- read-only by explicit invocation; the orchestrator owns resolution.

## Tasks & Acceptance

**Execution:**
- `src/stores/slices/eventsSlice.ts` -- add a call-specific load result; isolate load error state from writes; give each successful write an ordered completion token and mutation (`upsert` or delete tombstone) that active same-account loads replay in order; prune records after no active load can need them; and make add's direct state update an idempotent upsert by id. Preserve supersession, identity guards, and sort order without adding persisted store state.
- `src/components/Settings/EventsSettings.tsx` and `src/App.tsx` -- derive settled/failed UI state from the returned load result and ignore non-applying stale outcomes instead of reading shared store error state.
- `tests/unit/stores/eventsSlice.test.ts` -- pin successful/failed/stale load results and ordered write replay, including a fetched list that omits a completed add, a load that installs an already-committed add before its promise resumes, add-then-delete during one load, edit reordering, delete non-resurrection, and account/load supersession.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- reproduce DW-26 by leaving a write failure in `eventsError` while the pending load returns success, and add the inverse disagreement so only the returned call outcome can select the notice.
- `tests/e2e/settings/events-crud.spec.ts` -- hold a Settings GET response captured before a successful edit, release it after the PATCH/store/UI settle, and assert the stale response cannot revert the rendered row.
- `tests/e2e/home/events.spec.ts` -- fail Home's initial events request and assert the App boundary renders `events-load-error`, never `events-empty-placeholder`.
- `src/components/RelationshipTimers/EventCountdown.tsx` -- update the slot comment to describe the call-specific load outcome.

**Acceptance Criteria:**
- Given Settings renders an existing editable event while its mount load is pending, when an edit succeeds before an older load response lands, then the saved row remains edited and correctly ordered after the load settles.
- Given a save fails while Settings' successful mount load is pending, when that load settles, then Settings renders the loaded list without the “We couldn't load your events” notice and the save surface retains its own failure.
- Given an add or delete succeeds while a current-user load is pending, when the load response lands, then the added event is present exactly once or the deleted event stays absent.
- Given overlapping loads or an account transition, when a stale request settles, then it cannot change the current list, loading flag, settled marker, or load-failure notice.
- Given a current load fails while last-good events exist, when its own outcome reaches Home or Settings, then the existing events remain visible and the load failure is attributed only to that call.

## Spec Change Log

### 2026-08-20 — Review pass 1
- Trigger: review proved endpoint-only start/current snapshots cannot encode operation chronology, resurrect an add followed by a delete, and can duplicate an add when the load observes the commit before the write promise resumes.
- Amended: the implementation task and Design Notes now require ordered completed-write tokens with upsert/delete replay and idempotent add state; test tasks now require discriminating store cases plus the Settings and Home outer boundaries.
- Known-bad state avoided: inferring writes from list endpoints, tests whose fetched add already makes carry-forward pass vacuously, a DW-26 mock that clears the shared error before the assertion, and changed App wiring with no Home-path check.
- KEEP: retain per-call `success`/`failure`/`stale` load outcomes, load-only `eventsError`, direct `EventWriteResult` failures, `latestLoadId`, account guards, last-good lists, date/creation ordering, and the untouched deferred-work ledger.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 5: (high 0, medium 4, low 1)
- patch: 1: (high 0, medium 0, low 1)
- defer: 1: (high 0, medium 1, low 0)
- dismissed:
  - Missing concurrent add/delete failure UI cases — writes no longer feed the load marker, all three store failures verify that isolation, and the distinct form/delete result surfaces already have failure tests, so the claimed false-load-notice path is covered without duplicating every action in the component race.
  - Missing successful-write-then-failed-load case — the failed-load branch never writes `events`, and the existing last-good-list failure test would fail if it did, so the claimed rollback has no uncovered code path.
  - Generic connection copy discards `EventLoadResult.error` — the intent requires correct attribution, not raw service-message display, and the generic notices predate this change.
  - `eventsError` and `clearEventsError` become dead — the load-only field remains a valid store diagnostic/compatibility surface and retaining it has no verified user consequence.
  - `.then()` can leave the slot unsettled on rejection — `loadEvents` catches service and reconciliation failures, synchronous Zustand access does not reject, and the prior `.finally()` chain would also have propagated a contract violation.
  - Focus tests only adapt signatures — they make no claim to cover the deferred races; their mocks must match the changed action contract to keep focus coverage valid.
- addressed_findings:
  - `[medium]` `[bad_spec]` Replace endpoint-delta inference with ordered completed-write replay and idempotent add semantics, covering duplicate add, add-then-delete resurrection, and account resets mistaken for deletes.
  - `[medium]` `[bad_spec]` Require a real Settings stale-response/successful-edit test at the intent's outer UI surface.
  - `[medium]` `[bad_spec]` Require Home-path verification for App's new load-outcome wiring.
  - `[low]` `[bad_spec]` Require DW-26 component mocks whose returned outcome deliberately disagrees with shared `eventsError`.
  - `[medium]` `[bad_spec]` Require a stale fetched list that omits the completed add so carry-forward cannot pass vacuously.

### 2026-08-20 — Review pass 2
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 1, medium 5, low 1)
- defer: 1: (high 0, medium 1, low 0)
- dismissed:
  - A never-settling request can retain later mutation records — the review verified only low-volume closure retention while a user manually keeps writing; a newer load clears the active registry and page teardown releases it, with no concrete user-visible failure established.
  - The new stale-response E2E emits an unmounted-component React warning — the same warning reproduces in the unchanged CRUD E2E, so the new test did not cause it and the review identified no source location to repair within this intent.
  - App lacks a result-versus-shared-error disagreement test — real App loads cannot produce that disagreement after writes stop mutating `eventsError`, while the Home E2E verifies the user-visible failure and recovery paths.
  - App lacks a stale-outcome component test — every reachable App supersession also changes an effect dependency, whose cleanup marks that invocation cancelled before its result callback; the separate same-session epoch window is deferred below.
  - Mutation pruning lacks a direct test — the claimed later replay is refuted by `mutationSequenceAtStart`, which excludes all records completed before the authoritative load began even if pruning regressed; the registry is intentionally private.
  - Ordered replay lacks concurrent multiple-upsert coverage — the only in-app write caller serializes one modal write, and operations on different event ids end in the same sorted list regardless of replay order.
  - Two independent stores are not tested together — production has one Zustand store, so module-scoped leakage would have no application consumer consequence; the closure placement is directly visible in the reviewed implementation.
  - The prior triage log does not name its lower patch/defer candidates — the first pass's `bad_spec` cascade made lower routes moot by workflow rule, and a finding whose fix is only this spec must be dismissed.
  - Verification listed expected rather than observed outcomes while status was in review — finalization is the workflow stage that records observed outcomes, so the claim was premature and would edit only this spec.
  - Initial Zustand `set()` could throw before `loadEvents` enters `try` — the application has no throwing store subscriber or middleware path; the reviewer supplied no reachable caller that makes the synchronous primitive throw.
  - A late edit response could reinsert an event after a successful delete — the only in-app caller is a modal UI that prevents a delete from starting while its edit is pending; separate browser tabs have isolated stores and already lacked cross-tab synchronization before this change.
  - Failed writes do not receive internal replay tokens — they return their own call-scoped `EventWriteResult` and never enter load reconciliation, so the literal-token reading has no observable divergence from the intent.
  - Home changes broaden the original Settings narrative — the intent also requires each load to report its own outcome, and Home is the only other `loadEvents` caller; the audit found no behavioral divergence or negative consequence.
- addressed_findings:
  - `[medium]` `[patch]` Made the Settings stale-response E2E capture both bounded GET snapshots and wait on `aria-busy=false`, removing its one-response and animation-frame false-pass windows.
  - `[medium]` `[patch]` Added the exact DW-26 component interaction: a failed form save remains visible while a pending successful mount load settles without a false load notice, while retaining a deliberate result/shared-state disagreement test.
  - `[low]` `[patch]` Added a Settings overlap test proving an older stale mount outcome cannot erase a newer refresh-failure banner.
  - `[high]` `[patch]` Added an active account-B load test proving a completed account-A mutation cannot enter B's replay set.
  - `[medium]` `[patch]` Added a superseded same-user load test proving a mutation completed after the newer load starts survives the older stale result and is replayed once.
  - `[medium]` `[patch]` Added the direct edit-upsert boundary where a load omits the row before the successful edit promise resumes.
  - `[medium]` `[patch]` Extended Home's failure E2E through a later successful two-page load, proving the error slot clears to the empty placeholder.

### 2026-08-20 — Review pass 3
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 3, low 1)
- defer: 1: (high 0, medium 1, low 0)
- dismissed:
  - Same-account late write responses can update a reauthenticated session — a successful write is durable data for that same account, the prior implementation already applied it under the same user-id guard, and the reviewer established no incorrect row or cross-account disclosure.
  - Private mutation registries survive `signedOutState()` — records are scoped by `requestedBy`, cannot replay into a different account, and are pruned when their owning load settles; the distinct same-account load-epoch gap is deferred above.
  - Never-settling-load mutation retention (both review variants) — retention grows only with successful manual writes while that one request remains pending, and a successor load clears the registry; no concrete user-visible failure was established.
  - `eventsError` and `clearEventsError` have no production reader — the intent explicitly retains a load-owned error channel, it remains useful diagnostic/compatibility state, and no current caller receives an incorrect outcome from it.
  - Home lacks a direct overlapping-load component test — the effect cleanup cancels every dependency-driven supersession before its callback, store tests cover load ownership, and Home's active E2E covers visible failure and recovery.
  - Parked generated tests do not run in normal CI — they are explicitly target-path artifacts, were activated temporarily and passed live, while active store, component, and E2E tests retain the implementation regression coverage.
  - Parked generated imports do not resolve at their storage paths — every source declares its target path and the three files were copied together, type-loaded, executed, and byte-compared during validation.
  - `page.unroute(EVENTS_ENDPOINT)` can remove unrelated route handlers — every mutation interceptor in the generated consumers is awaited before the held load is released, so no live handler is removed prematurely in a reviewed test path.
  - The active stale-response E2E could receive extra GETs — confirmed as four StrictMode snapshots and addressed in the shared capture-cardinality patch rather than retained as a separate root cause.
  - Active outer-boundary add/delete/error-attribution coverage is missing — those five generated API/E2E scenarios passed against the real stack, and active unit/component tests plus the active stale-edit E2E cover the same production branches continuously.
  - The reviewed diff edits `deferred-work.md` despite the intent boundary — `git show HEAD` confirms the implementation commit excludes that file; its current unstaged bookkeeping is orchestrator-owned and was neither edited nor rewritten by this run.
  - Spec status and expected verification disagree with completed ledger rows — `in-review` was the required transient workflow state, and finalization below records observed results before returning the spec to `done`.
  - The account-transition acceptance wording conflicts with the deferred same-account epoch case — the proposed repair edits only this spec, so workflow rules require dismissal; the runtime issue remains explicitly deferred.
- addressed_findings:
  - `[medium]` `[patch]` Moved `aria-busy` from the entire Settings events section to the load/list region, keeping write dialogs and their `role="alert"` failures outside the busy subtree, and pinned that boundary in component and E2E tests.
  - `[medium]` `[patch]` Made the active and parked stale-response tests synchronously reserve and await all four GET snapshots produced by the two StrictMode mount loads, and added an explicit under-capture timeout to the parked fixture.
  - `[medium]` `[patch]` Changed DWEA-API-002 to mirror `eventsService.deleteEvent().select()` with a one-row array through `apiRequest`, so it can no longer pass against a different singular response contract.
  - `[low]` `[patch]` Replaced the generated automation artifact's unmeasured 40–70% performance claim with `not measured` and corrected its deviation count and narrative.

### 2026-08-20 — Review pass 4
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 1, medium 2, low 1)
- defer: 2: (high 0, medium 1, low 1)
- dismissed:
  - Partner-link changes can let a pre-link snapshot replace an expanded event list — accepting a partner does not populate or reload the events slice, so there is no newly expanded list for the pending response to replace; the adjacent lack of a partner-triggered reload predates and is not caused by this change.
  - Never-settling-load mutation retention (both review variants) — growth requires an indefinitely hung load plus continuing successful manual writes, while a successor load clears the registry; no concrete software-user consequence was established at the named site.
  - Home lacks a failed-refresh-with-last-good-list E2E — the changed App effect has one result-to-flag path, while the store last-good test and the pure Home slot test directly verify that a failed refresh with existing upcoming rows renders the list.
  - App lacks a result-versus-shared-error disagreement test — the revised production actions cannot create that disagreement, Settings pins the caller contract with a deliberate disagreement, and Home's active E2E verifies the visible failure/recovery path.
  - Parked add/delete/error-attribution scenarios do not run in normal CI — they are explicitly target-path automation artifacts that passed temporary live activation; active store, component, and stale-edit E2E tests continuously cover the same production branches.
  - Parked test imports do not resolve at their storage paths — each artifact declares its activation target, all three files were validated together at those targets, and no claim says the parked copies are directly runnable.
  - The held-load fixture lacks a route-ready promise — the utility invokes `page.route()` as interception setup before returning the observation promise, matching its documented call-before-navigation contract, and all three generated scenarios passed live.
  - Four captured GETs couple the harnesses to StrictMode — Playwright runs the configured Vite development server with StrictMode, and the explicit count is a loud contract for that environment rather than a production-runtime assertion.
  - `page.unroute(EVENTS_ENDPOINT)` removes all matching handlers — each generated mutation interceptor is awaited before release and teardown, and the fixture permits only one held pair, leaving no verified live handler removed in its test paths.
  - A fifth held GET could arrive after `Promise.all(deliveries)` snapshots the array — no reviewed scenario starts another load after the four mount requests are captured, and an unexpected route handler rejection still fails the Playwright test; the claimed silent pass was not substantiated.
  - Duplicate deferred entries in this spec — the proposed repair edits only the spec, so the review workflow requires dismissal; no runtime or test consequence follows from the duplicate prose.
  - The acceptance wording is broader than the deferred same-session epoch guard — the proposed repair edits only this spec, so it is dismissed here while the runtime gap remains deferred in frontmatter.
  - The spec is transiently `in-review` and expected verification is not final evidence — both are required intermediate workflow states and are replaced by observed results during this finalization.
  - The inline loading-field comment leaves `eventsError` undocumented — the module-level error contract directly documents load-only ownership, and “raised” validly describes the boolean loading flag becoming true.
  - Outer-boundary evidence is representative rather than active for every mutation — edit is active at the real Settings boundary, add/delete artifacts passed live, and active unit/component coverage exercises the shared production branches; no runtime divergence was found.
  - The generated API checks extend beyond the runtime intent — they verify unchanged PostgREST dependencies and do not add service or database behavior, so no boundary violation or product consequence exists.
- addressed_findings:
  - `[high]` `[patch]` Added an account-A edit/account-B active-load regression proving the edit call site tags its replay record with the captured account and cannot disclose A's row to B.
  - `[medium]` `[patch]` Hardened the active stale-edit E2E to require successful captured GETs and a second row whose position proves the replayed edit remains correctly ordered before and after the older responses settle.
  - `[medium]` `[patch]` Added an admin-backed post-delete lookup to the parked API contract so an RLS-hidden row cannot masquerade as physical deletion.
  - `[low]` `[patch]` Changed parked API response-key checks from exact equality to required-key containment so an unrelated added database column cannot fail the contract.

## Design Notes

Use an in-memory, non-persisted registry for active loads and successful event mutations. A load captures the latest completed-mutation sequence when it starts. Each successful add/edit records an account-scoped upsert and each successful delete records an account-scoped tombstone before applying its guarded client-state update. When the current load lands, replay later same-account mutations in completion order over the fetched rows, then sort once. Always unregister a settled/stale/failed load and discard mutation records no active load can still need.

Do not infer operations by comparing the list at two endpoints: `absent → absent` cannot distinguish no write from add-then-delete, and an account reset looks like deletion. Make add's ordinary state update replace the same id before sorting, because the load may observe the committed INSERT before `createEvent()` resumes and otherwise the write callback duplicates the row.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/eventsSlice.test.ts src/components/Settings/__tests__/EventsSettings.test.tsx` -- expected: focused store and Settings regressions pass.
- `npx playwright test tests/e2e/settings/events-crud.spec.ts tests/e2e/home/events.spec.ts --project=chromium` -- expected: Settings stale-response and Home failure boundaries pass with the existing CRUD/Home coverage.
- `npm run typecheck` -- expected: all TypeScript projects pass with the new load result contract.
- `npm run lint` -- expected: source and active tests pass lint.
- `npm run test:unit` -- expected: the complete unit suite passes.

## Auto Run Result

### Summary

The reviewed implementation returns call-owned event-load outcomes, isolates write errors from load attribution, and replays completed add/edit/delete operations over older fetched snapshots. This fresh pass changed tests only: it closed a cross-account edit-replay verification gap, made the active stale-edit browser test prove successful and correctly ordered reconciliation, and strengthened the parked API contracts without over-constraining future response columns.

### Files changed

- `src/stores/slices/eventsSlice.ts` — implements call-owned load outcomes and account-scoped ordered mutation replay over stale responses.
- `src/App.tsx` — records Home load state from the returned invocation outcome and ignores stale results.
- `src/components/Settings/EventsSettings.tsx` — records Settings load state from the returned outcome while preserving separate write failures.
- `src/components/RelationshipTimers/EventCountdown.tsx` — documents the Home slot's invocation-owned outcome contract.
- `tests/unit/stores/eventsSlice.test.ts` — now verifies both add and edit replay records cannot cross from account A into account B's active load.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` and `EventsSettings.focus.test.tsx` — cover truthful load/write attribution and keep mocks aligned with the load-result contract.
- `tests/e2e/settings/events-crud.spec.ts` — requires successful stale snapshots and proves a replayed edit remains correctly ordered beside another event.
- `tests/e2e/home/events.spec.ts` — verifies Home's load-error and recovery boundary.
- `_bmad-output/test-artifacts/automation-dw-events-error-attribution/api-events-load-mutation-contract.spec.ts` — checks required response fields without rejecting extra columns and confirms deletion through the admin-backed lookup.
- `_bmad-output/test-artifacts/automation-dw-events-error-attribution/` and its automation summary — preserve the previously validated target-path API/E2E artifacts and evidence.
- `_bmad-output/implementation-artifacts/spec-dw-26-29-events-error-attribution.md` — records this review pass, observed verification, residual risks, and final status.

### Review findings

- Patches applied: 4 entries — high 1, medium 2, low 1.
- Deferred: 2 pre-existing entries — medium 1 for same-account session-epoch ownership and low 1 for manual-refresh state setters after unmount. They were added only to this spec's frontmatter; the orchestrator-owned deferred-work ledger was not modified.
- Dismissed findings and reasons are recorded individually in `Review pass 4`: the partner-link claim lacked the asserted expanded list; hung-load retention had no established user consequence; Home/App coverage gaps were refuted by the shared wiring and direct slot/store evidence; parked artifacts are intentionally target-path sources that passed live; route setup/teardown and the four-request contract are sound for the configured environment; spec-only findings must be dismissed; the inline error contract is already documented; and the descriptive intent audit found no production divergence beyond the deferred session-epoch case.

### Follow-up review recommendation

`true`. This pass patched 1 high, 2 medium, and 1 low entries. A high patch independently requires follow-up; the weighted non-high score is `3 × 2 + 1 = 7`.

### Verification performed

- `npx vitest run tests/unit/stores/eventsSlice.test.ts src/components/Settings/__tests__/EventsSettings.test.tsx` — passed 84 tests across 2 files.
- `npx playwright test tests/e2e/settings/events-crud.spec.ts tests/e2e/home/events.spec.ts --project=chromium` — passed all 14 Chromium tests, including the successful, two-row ordered stale-edit case.
- `npm run typecheck` — passed all referenced TypeScript projects.
- `npm run lint` — passed with 0 errors and the existing 3 Fast Refresh warnings in `EventCountdown.tsx`.
- `npm run test:unit` — passed 93 files and 1,444 tests; existing React `act(...)` warnings remain non-failing.

### Residual risks

- A pre-sign-out load can still apply after signing back into the same account during the narrow window before a successor load increments the id, because ownership has no authentication-session epoch.
- A manual stale-row refresh can call local Settings state setters after unmount; React discards the update, but development/test warning noise remains.
- The five generated API/E2E scenarios remain parked target-path artifacts rather than normal CI inputs, although they passed their prior temporary activation.
