---
title: 'DW-27: Recover failed Settings event loads without a page reload'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
baseline_revision: '5ddbdf4053d950c0eeca568b95c582588bd8ca3b'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** When the Settings events request fails, the mounted screen has no recovery trigger. Its error notice and missing data remain until the user reloads the page, even after connectivity returns.

**Approach:** Re-run the same guarded events load when the shared online state changes, matching Home's reconnect behavior, and place an explicit retry control in the Settings load-error notice. A successful automatic or manual retry must replace the failed state with the current event list or the truthful empty state without leaving Settings.

## Boundaries & Constraints

**Always:** Keep `loadEvents()` as the single read path; preserve its settled-result, stale-load, account-identity, last-good-list, and loading-state semantics. Render the retry control in the existing error notice for both an empty failed load and a failed refresh above a surviving list. Make retry state accessible, prevent duplicate activation while a load is active, and cover both reconnect and manual recovery at the rendered Settings surface.

**Never:** Do not add polling, a new realtime subscription, page reload/navigation, persistence, or changes to the events service/slice contract. Do not alter `_bmad-output/implementation-artifacts/deferred-work.md` or `tests/support/merged-fixtures.ts`; DW-30 owns the fixture repair.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reconnect recovery | Settings remains mounted after a failed load; `syncStatus.isOnline` changes | `loadEvents()` runs again; success removes the notice and shows returned events or the truthful empty state | A repeated failure keeps one retryable notice; stale/account-switched outcomes do not change this screen's settled state |
| Manual recovery | The load-error notice is visible with or without a last-good list | Activating Retry clears the stored load error and invokes one refresh; the control cannot launch another load while loading | Success removes the notice while preserving the normal list/empty rules; failure restores the retryable notice |
| Failed refresh with cached rows | Existing events remain when a retry fails | The rows stay visible and the notice remains above them | Never blank the last-good list |

</intent-contract>

## Code Map

- `src/components/Settings/EventsSettings.tsx:108-253` -- owns the Settings load effect, local settled/failure attribution, shared error notice, and existing `refreshEvents()` reuse point. Add the online dependency and retry affordance here without bypassing `recordLoadOutcome`.
- `src/App.tsx:441-458` -- golden reconnect precedent: Home intentionally keys its events load effect on `isOnline` so returning online retries in place.
- `src/stores/slices/eventsSlice.ts:195-265,755-766` -- `loadEvents()` clears `eventsError`, preserves the last-good list, and rejects stale/account-switched results; `clearEventsError()` is the existing action for an explicit retry control. Treat the slice contract as read-only for this bundle.
- `src/components/Settings/__tests__/EventsSettings.test.tsx:125-441` -- subscribable store double and rendered list-state coverage. Extend its default state with connectivity/error-clear behavior and add surface tests for reconnect and Retry recovery.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` -- existing dialog focus regression suite; unchanged but included in focused verification because the edited component owns those dialogs.
- `tests/support/merged-fixtures.ts:53` -- read-only known nested-worktree typecheck baseline: exactly six TS2883 diagnostics may occur here; DW-30 owns the fix.

## Tasks & Acceptance

**Execution:**
- `src/components/Settings/EventsSettings.tsx` -- subscribe the existing load effect to `syncStatus.isOnline`, add a guarded Retry action to the shared error notice, and use `clearEventsError()` before the explicit refresh so recovery happens without reloading or leaving Settings.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- update the store double and test automatic reconnect, successful manual retry, repeat failure, last-good-list preservation, and duplicate-click protection through rendered controls and state.

**Acceptance Criteria:**
- Given Settings is still mounted after its events load failed, when shared connectivity changes from offline to online and the next load succeeds, then the error notice disappears and the current events or truthful empty state renders without navigation or a page reload.
- Given either form of the Settings load-error notice is visible, when the user activates Retry, then exactly one new load begins, duplicate activation is unavailable while it is pending, and its own settled result determines whether the notice clears or remains retryable.
- Given a last-good event list is visible, when an automatic or manual retry fails, then the list remains visible and exactly one retryable load notice stays above it.
- Given the signed-in account changes or an older request settles after a newer request, when its result arrives, then it does not overwrite the current account's rendered load outcome.

## Spec Change Log

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 0
- dismissed:
  - Empty retries do not render the notice's `Retrying…` branch — the empty error slot intentionally swaps to its accessible live loading status; the same branch remains reachable above a last-good list, so no recovery state is missing.
  - Connectivity can trigger an automatic load during a manual retry — each trigger still starts one load, and `eventsSlice` intentionally gives the newer load authority; the intent explicitly requests both triggers.
  - The render-captured loading guard permits duplicate browser activation — Zustand publishes `eventsIsLoading` synchronously and browser click events are discrete, so no user path to a second call was substantiated; the review patch nevertheless added an in-flight ref as defense in depth.
  - `clearEventsError()` is redundant and the design note calls it UI cleanup — the call is harmless, fulfills the intent's explicit reuse signal, and the returned result still exclusively owns rendered failure attribution.
  - The reconnect test patches `syncStatus` instead of firing a browser event — `syncStatus.isOnline` is this component's real input contract, while the unchanged App listener and store action own browser-event propagation.
  - The reconnect mock omits its pending loading state — pending rendering is trigger-independent and is exercised by the manual-retry tests through the same `loadEvents()` state.
  - The original manual-success mock omitted loading — the realistic pending transition was added as part of the kept focus regression, so no verification gap remains.
  - Automatic success lacks a separate empty-result test — successful empty rendering is determined by the same settled-result path already exercised by manual success.
  - Automatic reconnect lacks a separate repeated-failure test — repeated failure uses the same `recordLoadOutcome()` path exercised by initial and manual failures.
  - Automatic failure with cached rows lacks a separate test — last-good-list precedence depends on shared slot state, not on whether connectivity or the button triggered the load, and the focused suite exercises that state.
  - Manual success above a cached list lacks a separate test — both notice placements share the same Retry element and handler, while successful list rendering is covered by reconnect recovery.
  - Empty Retry followed by another failure lacked coverage — that exact cycle was added as part of the kept focus regression, so the claimed gap no longer remains.
  - The duplicate-click test waits for the disabled state — the native disabled control is the user-facing barrier; an independent in-flight ref now also guards same-render re-entry.
  - No new account-switch-during-retry test was added — `refreshEvents()` captures the user id, `recordLoadOutcome()` checks current store identity, and the patch's focus request repeats that check before acting.
  - No new older-request-after-retry test was added — the existing focused test named `ignores an older stale mount outcome after a stale-row refresh fails` ran and covers stale rendered attribution.
  - The `eventsSlice.ts:755-766` code-map reference exceeds the file length — factually false; the file is longer than 766 lines and the referenced `clearEventsError()` implementation exists there.
  - Code-map ranges do not include every post-change line — the anchors identify implementation regions for the spec consumer, and workflow rules require dismissing findings whose only fix edits the active spec.
  - The online-to-offline dependency transition is broader than reconnect-only behavior — this exactly matches the Home precedent named by the verbatim intent, including Home's documented fast-failure offline transition.
  - A retry can wait forever because `loadEvents({ timeoutMs: RETRY_TIMEOUT_MS })` has no timeout — the quoted call and constant do not exist; the actual code calls parameterless `loadEvents()`.
  - Recovery is not tested through the complete browser-event/service stack — the rendered Settings component is the outer surface changed here, and direct shared-state input isolates the unchanged App/store propagation boundary without weakening the observable recovery assertions.
  - A reconnect-only interpretation conflicts with loads on the offline transition — the intent selects Home parity and explicitly cites Home's `isOnline` dependency, so the two-direction dependency is the supported reading rather than an unresolved intent gap.
- addressed_findings:
  - `[medium]` `[patch]` Empty-state Retry removed the focused control and left focus on `body` after settlement; manual retries now use an account-checked completion focus request, restore failure focus to Retry and success focus to the stable Add control, and focused tests cover successful and repeated-failure outcomes with real pending transitions.

## Design Notes

The Settings component deliberately records each `EventLoadResult` locally instead of inferring ownership from mutable `eventsError`. Keep that attribution boundary: connectivity only re-triggers the effect, while manual Retry reuses `refreshEvents()` and `recordLoadOutcome`. The explicit clear action is UI cleanup, not a substitute for the returned result.

## Verification

**Commands:**
- `npm run test:unit -- src/components/Settings/__tests__/EventsSettings.test.tsx src/components/Settings/__tests__/EventsSettings.focus.test.tsx` -- expected: all focused rendered-behavior and focus tests pass.
- `npm run lint` -- expected: zero lint errors.
- `npm run typecheck` -- expected: the clean target checkout passes. In this nested worktree, exactly the six known TS2883 diagnostics at unchanged `tests/support/merged-fixtures.ts:53` are the only permitted diagnostics; require zero additional TypeScript diagnostics and do not edit that fixture because DW-30 owns its repair.
- `fnox exec -- npm run build` -- expected: the secret-injected production build succeeds.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

### Summary

Settings now retries its events load when shared connectivity changes and exposes a manual Retry control in both load-error notice placements. Manual retries clear the stored load error, block duplicate activation, preserve stale/account attribution and last-good rows, and restore keyboard focus to Retry after failure or the stable Add control after success.

### Files changed

- `src/components/Settings/EventsSettings.tsx` -- added connectivity-triggered reloads, manual retry UI/state, duplicate protection, and account-safe focus restoration.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- added rendered recovery, failure, loading, duplicate-activation, last-good-list, empty-state, and focus coverage.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` -- extended the store double with connectivity and load-error clearing state required by the component.
- `_bmad-output/implementation-artifacts/spec-dw-27-events-settings-load-retry.md` -- captured the intent contract, implementation map, verification contract, review triage, and final result.

The deferred-work ledger and `tests/support/merged-fixtures.ts` were not edited.

### Review findings breakdown

- Patches applied: 1 medium -- restored meaningful keyboard focus after empty-state retries and added realistic pending/success/failure focus coverage; the patch also added an independent in-flight duplicate guard.
- Items deferred: 0.
- Dismissed findings:
  - Empty Retry does not show the notice's `Retrying…` branch -- the accessible live loading slot replaces it, while the branch remains visible above last-good rows.
  - Automatic and manual triggers can overlap -- each trigger owns one load and the slice intentionally makes the newer load authoritative.
  - The original loading guard was not atomic -- no duplicate browser path was substantiated because store publication is synchronous and click events are discrete; an in-flight ref now adds defense in depth.
  - `clearEventsError()` is redundant -- it is harmless explicit cleanup requested by the intent, while returned results still own rendered attribution.
  - Reconnect is simulated through shared state -- that is the component's real input boundary; unchanged browser/store propagation remains outside the edited surface.
  - The reconnect mock lacks pending state -- trigger-independent pending behavior is covered through manual retry.
  - The original manual-success mock lacked pending state -- the review regression now includes it.
  - Automatic empty success lacks a separate test -- the same settled empty path is covered by manual success.
  - Automatic repeat failure lacks a separate test -- it uses the same recorded-result path covered by initial and manual failures.
  - Automatic cached-row failure lacks a separate test -- shared list precedence is covered by the manual failure test.
  - Manual cached-list success lacks a separate test -- the common Retry handler and successful list path are each covered.
  - Empty repeat failure lacked coverage -- the review regression now covers it.
  - The duplicate-click test waits for disabled state -- native disabled behavior is the user barrier and the new ref also guards same-render re-entry.
  - Account-switch retry coverage is not newly duplicated -- existing identity guards remain in the shared result path and focus restoration repeats the current-account check.
  - Older-request coverage is absent -- factually false; the existing stale mount outcome test ran and passed.
  - The events-slice code-map range exceeds the file -- factually false; the referenced implementation exists at that range.
  - Code-map ranges do not cover every new line -- the anchors identify the relevant regions, and the suggested fix would edit the active spec.
  - Offline transitions also re-fire -- this is the documented Home behavior the intent explicitly requests Settings to match.
  - A fictional timeout call can hang -- the named call and constant do not exist in the implementation.
  - The full browser-to-service stack is not repeated in this suite -- the rendered Settings surface and its changed shared-state dependency are directly exercised.
  - Reconnect-only intent conflicts with two-direction dependency behavior -- Home parity is the supported reading stated by the intent, so there is no ambiguity.

### Follow-up review recommendation

`false` -- patched findings: high 0, medium 1, low 0; score `3 × 1 + 1 × 0 = 3`, below the threshold of 5.

### Verification performed

- Focused Vitest command: 66 tests passed across the behavior and focus suites.
- `npm run lint`: passed with zero errors; three unchanged Fast Refresh warnings remain in `src/components/RelationshipTimers/EventCountdown.tsx`.
- `npm run typecheck`: the clean target checkout passes per the operator decision; this nested worktree emitted exactly the six permitted TS2883 diagnostics at unchanged `tests/support/merged-fixtures.ts:53` and no additional diagnostics.
- `fnox exec -- npm run build`: passed and produced the secret-injected production/PWA build.
- `git diff --check`: passed.

### Residual risks

No residual implementation risk was identified within DW-27. The six worktree-only TS2883 diagnostics remain owned by DW-30 and do not come from this bundle.
