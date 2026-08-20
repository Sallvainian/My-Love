---
title: 'DW-13 / DW-19: Events write error codes'
type: 'feature'
created: '2026-08-20'
status: 'blocked'
baseline_revision: '5910a5ded94e3910bd646094f29871719671b9eb'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Event writes return only English error text, so Settings cannot distinguish a stale/not-owned row from an offline or transport failure without string matching.

**Approach:** Give event write failures an exported machine-readable code, preserve it through `EventWriteResult`, and make the Settings dialogs offer a list refresh for stale/not-owned rows while keeping retry-the-write controls for offline and transport failures.

## Boundaries & Constraints

**Always:** Keep the existing user-facing error message alongside the code; classify not-found/not-owned, offline, and transport failures distinctly; make the refresh affordance invoke `loadEvents`; retain the existing identity guards and unchanged-list-on-failure behavior.

**Never:** Match error-message prose in the UI; add offline queuing or automatic write retries; change Supabase schema/policies; change `PhotoUploadResult` or photos behavior; edit the deferred-work ledger; change `tests/support/merged-fixtures.ts` in this bundle, because the approved DW-30 bundle owns that annotation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful write | Service write succeeds | Result remains `{ success: true }`; dialog closes | No error expected |
| Stale/not-owned write | Service changes zero rows | Failure includes the not-found code and original message; dialog offers refresh | Refresh closes the stale dialog and calls `loadEvents` |
| Offline write | Offline guard rejects before a request | Failure includes the offline code and truthful existing message | Dialog stays open and the enabled Save/Delete control retries deliberately |
| Transport/server failure | Network, PostgREST, or unexpected service failure | Failure includes the transport code and original/fallback message | Dialog stays open and the enabled Save/Delete control retries deliberately |
| Signed-out store call | A write starts without `userId` | Failure includes an auth-specific code and existing sign-in message | No service call; no prose inference |

</intent-contract>

## Code Map

- `src/services/eventsService.ts` -- export `EventWriteError` and its code type; offline and zero-row guards already originate here, while catch tails distinguish PostgREST and mid-flight failures.
- `src/stores/slices/eventsSlice.ts` -- `EventWriteResult` is defined here and all three actions convert thrown errors into caller results; preserve typed service codes and classify ordinary errors as transport. Add the required module-header note that this shape deliberately diverges from `PhotoUploadResult`.
- `src/components/Settings/EventsSettings.tsx` -- `EventForm` and `EventDeleteConfirmation` currently retain only message strings; branch rendered affordances on the returned code and route refresh through the parent’s existing `loadEvents` action.
- `tests/unit/services/eventsService.test.ts` -- existing offline, zero-row, PostgREST, and network cases anchor service classification.
- `tests/unit/stores/eventsSlice.test.ts` -- existing add/edit/remove failure cases anchor message propagation, list preservation, and identity behavior.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- existing rejected save/delete tests anchor modal retention, focus recovery, and retry controls; extend them with code-driven refresh assertions.
- `src/stores/slices/photosSlice.ts` -- read-only evidence: `PhotoUploadResult` remains `{ success: true } | { success: false; error: string }` by explicit intent.

## Tasks & Acceptance

**Execution:**
- `src/services/eventsService.ts` -- export a coded `EventWriteError`; assign precise codes at offline, validation, zero-row, invalid-response, network, and PostgREST boundaries so callers never infer from text.
- `src/stores/slices/eventsSlice.ts` -- widen failure results with a code, preserve `EventWriteError.code`, supply auth/transport fallbacks, and document deliberate divergence from photos.
- `src/components/Settings/EventsSettings.tsx` -- store structured failures in both dialogs; render and execute refresh only for not-found failures, leaving Save/Delete as explicit retry controls otherwise.
- `tests/unit/services/eventsService.test.ts`, `tests/unit/stores/eventsSlice.test.ts`, `src/components/Settings/__tests__/EventsSettings.test.tsx` -- cover every matrix row and prove affordance selection reads codes rather than prose.

**Acceptance Criteria:**
- Given two failures with identical prose but different codes, when Settings renders them, then only the not-found-coded failure offers refresh-the-list.
- Given a not-found-coded save or delete failure, when the user activates Refresh events, then its modal closes and `loadEvents` is called once.
- Given an offline or transport-coded failure, when the write settles, then the dialog and entered context remain present and its Save/Delete control is enabled for a deliberate retry.
- Given any failed write, when the store resolves it, then the event list is unchanged and the returned human-readable message remains available.
- Given the completed change, when photos types are inspected, then `PhotoUploadResult` is unchanged and the events module records why the shapes differ.

## Spec Change Log

## Review Triage Log

## Design Notes

Use one code union shared from the service, with additional store-only codes where the failure originates before service dispatch. The UI action decision is intentionally small: `not-found` means refresh the authoritative list; all retryable write failures retain the existing primary write control. Messages remain presentation content, never control flow.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/services/eventsService.test.ts tests/unit/stores/eventsSlice.test.ts src/components/Settings/__tests__/EventsSettings.test.tsx` -- expected: targeted behavior tests pass.
- `npm run typecheck` -- expected: the clean target checkout passes; in the nested bmad-loop worktree, exactly the six known worktree-only `TS2883` diagnostics at `tests/support/merged-fixtures.ts:53` are accepted, with zero additional TypeScript errors.
- `npm run lint` -- expected: source and test lint passes.

## Auto Run Result

Status: blocked
Blocking condition: implementation verification failed — `npm run typecheck` exits 2 on pre-existing TS2883 inferred-type portability errors at `tests/support/merged-fixtures.ts:53`. The bundle does not modify that file, and repairing it would expand scope beyond events write error codes. Targeted tests passed 115/115; app and test TypeScript checks pass with composite emit disabled; lint completed with zero errors and three pre-existing Fast Refresh warnings; `git diff --check` passed.
