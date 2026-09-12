---
title: 'DW-13 / DW-19: Events write error codes'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: '6fdc9d813d6111d6b4ad3985c0836ef34e28a52c'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      An invalid-response write can already have landed, but Settings still offers the same write control and a create retry can duplicate the event.
    evidence: |-
      This behavior predates the bundle: every failure previously left Save enabled. The new `invalid-response` code now identifies it, but choosing a distinct safe affordance was not part of the events-only refresh-versus-retry decision. `createEvent` can throw after insert when the returned row cannot be converted, while Settings routes every code except `not-found` to Save/Delete.
    location: >-
      src/components/Settings/EventsSettings.tsx:872
    severity: medium
  - summary: >-
      The EventsSlice interface comment says `eventsError` is raised only by loads even though writes also park messages there.
    evidence: |-
      The contradiction existed at the baseline: addEvent, editEvent, and removeEvent already set `eventsError` on failure while the state-field comment called it load-only. The current bundle preserves that behavior and documents the result-shape divergence elsewhere in the module header.
    location: >-
      src/stores/slices/eventsSlice.ts:54
    severity: low
  - summary: >-
      A load outcome can be misreported when an event write settles in the narrow window before Settings snapshots the shared error field.
    evidence: |-
      This shared-state race predates this bundle and is already identified in the component tests as DW-26. `loadEvents` resolves without its own outcome, so `recordLoadOutcome` reads `eventsError`, which write actions can independently clear or replace before that read. A successful load can therefore show a failure banner, or a failed load can appear successful.
    location: >-
      src/components/Settings/EventsSettings.tsx:130
    severity: medium
  - summary: >-
      Invalid-response writes keep the write control even though the mutation may already have landed.
    evidence: |-
      The behavior predates this bundle, but the coded result makes the ambiguity explicit. Create and update can throw `invalid-response` only after a successful response is missing or cannot be converted; Settings routes every non-`not-found` code back to Save or Update, so create can duplicate a committed event and update can retry without reconciling the stale list.
    location: >-
      src/components/Settings/EventsSettings.tsx:872
    severity: medium
  - summary: >-
      Transport wrapping drops the original non-PostgREST network error as an Error cause.
    evidence: |-
      The pre-existing `networkFailure` helper creates a new message-only Error. `writeTransportFailure` now wraps only that message, so the original error identity, stack, and transport metadata remain unavailable for diagnostics even though PostgREST wrapping preserves its mapped error as `cause`.
    location: >-
      src/services/eventsService.ts:147
    severity: low
---

<intent-contract>

## Intent

**Problem:** Event writes expose only English error text, so Settings cannot distinguish a stale or no-longer-owned row from an offline or transport failure without prose matching.

**Approach:** Give event write failures an exported machine-readable code, preserve that code through `EventWriteResult`, and make the Settings dialogs offer list refresh for stale/not-owned rows while retaining deliberate write retry controls for offline and transport failures.

## Boundaries & Constraints

**Always:** Preserve the existing human-readable message beside the code; distinguish not-found/not-owned, offline, and transport failures; make the refresh affordance call the existing `loadEvents`; retain current identity guards and unchanged-list-on-failure behavior.

**Never:** Match error prose in the UI; add offline queuing or automatic retries; change Supabase schema or policies; change `PhotoUploadResult` or photos behavior; edit the deferred-work ledger.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful write | Service write succeeds | Result stays `{ success: true }`; dialog closes | No error expected |
| Stale/not-owned write | Update or delete changes zero rows | Failure includes the not-found code and original message; dialog offers refresh | Refresh closes the stale dialog and calls `loadEvents` |
| Offline write | Offline guard rejects before a request | Failure includes the offline code and truthful existing message | Dialog stays open; enabled Save/Delete retries deliberately |
| Transport/server failure | Network, PostgREST, or unexpected service failure | Failure includes the transport code and original or fallback message | Dialog stays open; enabled Save/Delete retries deliberately |
| Invalid local write input | Service validation refuses the input | Failure retains a non-stale code and validation message | Dialog stays open with entered context intact |
| Signed-out store call | A write starts without `userId` | Failure includes an auth-specific code and existing sign-in message | No service call; no prose inference |

</intent-contract>

## Code Map

- `src/services/eventsService.ts` -- `EventWriteError` is currently private and message-only; offline and zero-row guards originate here, while write catch tails distinguish PostgREST and network failures.
- `src/stores/slices/eventsSlice.ts` -- `EventWriteResult` and all three write catch paths currently return message-only failures; preserve typed service codes, classify pre-service auth and untyped failures, and add the required module-header note that this result deliberately diverges from `PhotoUploadResult`.
- `src/components/Settings/EventsSettings.tsx` -- `EventForm` and `EventDeleteConfirmation` retain only strings; pass the existing `loadEvents` action into both and select refresh versus retry from the returned code.
- `tests/unit/services/eventsService.test.ts` -- existing offline, zero-row, PostgREST, network, validation, and invalid-response cases anchor service classification.
- `tests/unit/stores/eventsSlice.test.ts` -- existing add/edit/remove failures anchor message propagation, list preservation, and account identity guards.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- existing failed save/delete tests anchor modal retention, focus recovery, and retry controls; extend them with code-driven refresh behavior.
- `src/stores/slices/photosSlice.ts` -- read-only evidence: `PhotoUploadResult` must remain `{ success: true } | { success: false; error: string }`.

## Tasks & Acceptance

**Execution:**
- `src/services/eventsService.ts` -- export a coded `EventWriteError` and assign codes at offline, validation, zero-row, invalid-response, network, and PostgREST boundaries so write callers never infer from text.
- `src/stores/slices/eventsSlice.ts` -- widen failure results with a code, preserve `EventWriteError.code`, provide auth and transport fallbacks, and document deliberate divergence from photos.
- `src/components/Settings/EventsSettings.tsx` -- store structured failures in both dialogs and render refresh only for not-found failures, leaving Save/Delete as the explicit retry controls otherwise.
- `tests/unit/services/eventsService.test.ts`, `tests/unit/stores/eventsSlice.test.ts`, `src/components/Settings/__tests__/EventsSettings.test.tsx` -- cover the matrix and prove affordance selection depends on codes rather than prose.

**Acceptance Criteria:**
- Given two returned failures with identical prose but different codes, when Settings renders them, then only the not-found-coded failure offers refresh-the-list.
- Given a not-found-coded save or delete failure, when the user activates Refresh events, then its modal closes and `loadEvents` is called once.
- Given an offline or transport-coded failure, when the write settles, then the dialog and entered context remain present and its Save/Delete control is enabled for deliberate retry.
- Given any failed write, when the store resolves it, then the event list is unchanged and the returned human-readable message remains available.
- Given the completed change, when the photos result type and events module header are inspected, then `PhotoUploadResult` is unchanged and the deliberate shape difference is documented.

## Spec Change Log

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 1, medium 2, low 3)
- defer: 2: (medium 1, low 1)
- dismissed:
  - The new `-2` spec duplicates an existing artifact — build-auto's collision route requires a suffixed spec when the derived path already has a non-draft spec, and the proposed fix edits the implementing spec itself.
  - The suffixed spec omits constraints from the older artifact — the proposed fix edits the implementing spec; repository instructions supplied the known typecheck exception, which verification confirmed exactly.
  - The documented focused command omits the focus file and full unit suite — the proposed fix edits the implementing spec; both suites were run, and their real failures were patched separately.
  - The code union exceeds an exact three-way taxonomy — the source intent says “at minimum,” so validation, invalid-response, and auth codes are allowed extensions.
  - Retry is not a separately labelled control — the enabled Save, Update, and Delete controls perform the requested deliberate retry, and the intent does not require a new label.
  - No single test crosses the real service, store, and UI — focused tests verify each typed seam and the app TypeScript project passes; no unverified consequence was found.
  - The strongest identical-prose test injects not-found into Add — it is a control-flow proof only; separate edit and delete tests exercise the real stale-row paths and invoke refresh.
  - Retry tests do not activate a second write — existing success and double-submit tests prove invocation, while failure tests prove the same control is re-enabled with context intact.
  - Auth and invalid-response are not exhaustively enumerated in UI tests — the covered non-not-found branch handles the shared rendering path; the distinct invalid-response safety question is deferred separately.
  - `PhotoUploadResult` has no new automated shape assertion — the photos module is absent from the diff and source/type inspection confirms its shape is unchanged.
  - The implementation-spec artifact is outside the runtime surfaces — it is required workflow state and does not alter the product or deferred-work ledger.
  - Manual refresh has no persistent spinner — closing the stale dialog is immediate feedback and the completed load now updates the existing load-failure notice; repeated activation during exit is separately guarded.
- addressed_findings:
  - `[high]` `[patch]` Removed the slice's runtime dependency on the `EventWriteError` constructor by structurally validating the closed code union, restoring fully mocked identity-guard tests.
  - `[medium]` `[patch]` Retained the mapped Supabase error as the cause of transport-coded `EventWriteError`, preserving SQLSTATE, details, hint, identity, and network metadata.
  - `[medium]` `[patch]` Routed manual refresh completion through load-outcome bookkeeping and surviving-header focus fallbacks for both dialogs, with success, failure, reconciliation, and focus tests.
  - `[low]` `[patch]` Added direct tests for unreadable create responses, update/delete network tails, and less-common store code propagation.
  - `[low]` `[patch]` Restyled delete-dialog Refresh events as a blue non-destructive action.
  - `[low]` `[patch]` Guarded both refresh handlers against repeated activation while their dialogs exit.

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 3: (high 0, medium 2, low 1)
- dismissed:
  - Manual refresh lacks an unmount cancellation guard — after unmount React discards the component-local state setters, and the existing user-id guard prevents an account-switched completion from updating the mounted account; no user-visible consequence remains at the named site.
  - Manual refresh has no persistent loading announcement — the intent requires the stale dialog to close and call `loadEvents`, which provides immediate feedback; it does not require a second loading surface while a last-good list remains visible.
  - Refresh closes before its request succeeds and loses the attempted edit — closing the stale dialog is an explicit intent requirement, and a row that no longer exists or is no longer owned cannot accept the attempted edit.
  - A transport-coded create retry can duplicate an ambiguously committed insert — the intent explicitly requires the create dialog's write control to remain available for transport failures, so removing it would contradict the supplied contract; the ambiguity remains a residual risk.
  - Permanent PostgREST failures are classified as transport — the intent's transport/server row explicitly includes PostgREST failures and requires the deliberate retry affordance for that category.
  - The EventsSlice interface comment describes `eventsError` as load-only — the documentation comment is attached to `eventsIsLoading`, not `eventsError`, so the claimed contradiction is not present at that location.
  - The identical-prose proof injects `not-found` into Add — the form's code-routing branch is shared, while separate edit and delete tests exercise production-capable stale-row paths and activate Refresh.
  - Retry tests do not activate a second write — the re-enabled control uses the same already-exercised form/delete handler, and the tests verify that the control and entered context survive; no separate broken retry path exists.
  - Parked generated API/E2E artifacts are outside Playwright's active test directories — the intent does not require permanent E2E installation, and the artifacts explicitly document their target-path copy, measured execution, and removal workflow.
  - Parked generated specs cannot import dependencies in place — their headers and summary state that imports are relative to activation targets, and validation byte-copied all three artifacts to those targets before execution.
  - The API cases do not separately prove partner read visibility — those cases are scoped to the zero-row write contract; partner-read behavior is a separate existing contract, while stale write recovery is exercised at the application surface.
  - The spec's focused command omits two changed suites — the proposed fix edits the implementing spec and must be dismissed by the review rules; both omitted suites were nevertheless executed successfully in this pass.
  - The broad concurrency/navigation/supersession verification claim — the shared-error concurrency consequence is deferred below, navigation leaves no mounted consumer to corrupt, and same-user load supersession is directly covered in `eventsSlice.test.ts`.
  - Stale failures could retain Save/Delete beside Refresh — the supplied contract specifically retains deliberate write retry for offline and transport failures, so replacing the stale write control with Refresh is a defensible and implemented binary routing.
  - Validation and auth failures use the non-stale retry branch — validation retains the user's entered context and auth makes no service call; no harmful consequence was substantiated, while invalid-response ambiguity is deferred separately.
  - No active test crosses service, store, and UI in one permanent suite — unit/component tests verify every typed seam and the parked E2E was executed at its target path; no product consequence was identified from its storage location.
  - Raw API tests observe the zero-row precursor rather than application codes — they are supplemental evidence for the RLS premise, while service, store, and Settings tests separately verify code creation, propagation, and routing.
- addressed_findings:
  - `[low]` `[patch]` Made the structural event-write code registry exhaustive with `satisfies Record<EventWriteErrorCode, true>`, so a future code cannot silently fall back to `transport` when the registry is not updated.
  - `[low]` `[patch]` Added form and delete tests proving unexpected rejected action promises show their messages, retain enabled write retry, and never offer stale-row Refresh.
  - `[low]` `[patch]` Exercised each refresh guard with two synchronous activations and proved `loadEvents` is called once while the dialog exits.

## Design Notes

Use one service-owned code union, with store-only codes where failures originate before service dispatch. The UI decision is intentionally narrow: `not-found` refreshes the authoritative list; other write failures retain the existing primary write control. Messages remain presentation content, never control flow.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/services/eventsService.test.ts tests/unit/stores/eventsSlice.test.ts src/components/Settings/__tests__/EventsSettings.test.tsx` -- expected: focused behavior tests pass.
- `npm run typecheck` -- expected: no new TypeScript diagnostics.
- `npm run lint` -- expected: source and test lint pass.

## Auto Run Result

### Summary

Event write failures now carry stable codes from the Supabase service through `EventWriteResult`, and Settings chooses Refresh for stale/not-owned rows without matching error prose while retaining deliberate Save/Update/Delete retry for the requested non-stale failures. This fresh review also hardened the code registry and added missing regression coverage for defensive promise rejections and repeated Refresh activation.

### Files changed

- `src/services/eventsService.ts` — exports coded event-write errors and classifies offline, validation, stale, invalid-response, PostgREST, and network failures while preserving readable messages.
- `src/stores/slices/eventsSlice.ts` — propagates service codes, originates auth/transport fallbacks, preserves identity/list guards, and now enforces an exhaustive structural code registry.
- `src/components/Settings/EventsSettings.tsx` — keeps structured failures in both dialogs and routes stale failures to `loadEvents`-backed Refresh while retaining deliberate retry controls otherwise.
- `tests/unit/services/eventsService.test.ts` — verifies service code/message classification across create, update, and delete boundaries.
- `tests/unit/stores/eventsSlice.test.ts` — verifies code propagation, auth fallbacks, unchanged lists, and account/load identity guards.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — verifies code-driven affordances, refresh reconciliation, defensive rejected promises, and one-shot Refresh activation.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` — verifies focus recovery after successful writes and stale-row refreshes.
- `tests/unit/api/checkConstraintMapping.test.ts` — verifies mapped PostgREST metadata remains inspectable through the event transport wrapper.
- `_bmad-output/test-artifacts/automation-dw-events-write-error-codes/` and `_bmad-output/test-artifacts/automation-summary-dw-events-write-error-codes.md` — contain the generated, target-path-validated API/E2E automation and its measured execution summary.
- `_bmad-output/implementation-artifacts/bmad-build-auto-result-dw-events-write-error-codes-tea.automate-1.md` — records the completed automation handoff.
- `_bmad-output/implementation-artifacts/spec-dw-13-19-events-write-error-codes-2.md` — records intent, review triage, deferred observations, verification, and this result; the orchestrator-owned deferred-work ledger was not opened or changed by this run.

### Review findings

- Patches applied: 3 low-severity entries — exhaustive code-registry enforcement, rejected-action recovery tests for both dialogs, and repeated-Refresh guard tests for both dialogs.
- Items deferred: 3 entries — two medium-severity pre-existing ambiguous-state risks (shared load/write error timing and invalid-response retries) and one low-severity diagnostic gap (the original non-PostgREST network error is not retained as `cause`).
- Dismissed: unmounted refresh completion has no surviving state consumer; persistent refresh loading feedback is outside the supplied surface; closing a stale dialog is explicitly required; transport retry and PostgREST grouping are explicit contract choices; the alleged `eventsError` comment is attached to `eventsIsLoading`; the Add prose test is backed by real edit/delete stale tests; retry uses the same tested handler; parked automation is intentionally target-relative and was executed after activation; partner-read visibility is outside the API cases' write premise; spec-only command edits are prohibited in review; load supersession already has direct tests; stale control replacement is a defensible contract reading; validation/auth showed no harmful retry consequence; seam tests plus executed E2E substantiate the integrated behavior; and raw API tests are supplemental to application-level code tests.

### Follow-up review recommendation

`false` — patched entries: high 0, medium 0, low 3; score `3 × 0 + 1 × 3 = 3`, below the threshold of 5.

### Verification performed

- Focused service/store/component verification: 3 files, 124 tests passed.
- Supplemental changed-suite verification: 2 files, 35 tests passed.
- `npx tsc -p tsconfig.app.json --noEmit`: passed with no diagnostics.
- `npm run typecheck`: reported only the six documented nested-worktree `TS2883` diagnostics at `tests/support/merged-fixtures.ts:53`; no story or review-patch file produced a diagnostic.
- `npm run lint`: passed with 0 errors and 3 pre-existing Fast Refresh warnings in `EventCountdown.tsx`.
- Frontmatter YAML: parsed successfully with one `deferred` list containing all five preserved and newly appended items.

### Residual risks

- The deferred pre-existing load/write outcome race, invalid-response retry ambiguity, and missing original network `cause` remain outside this story's resolved scope.
- Transport retry after an ambiguous mid-flight create can duplicate an event, but retaining that retry is an explicit requirement of the supplied intent.
- The repository-wide composite typecheck remains nonzero only because of the documented nested-worktree `TS2883` fixture diagnostics; the application TypeScript project is clean.
