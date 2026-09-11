---
title: 'DW-38 CHECK error path consistency'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
baseline_revision: '71637e6ed77b350e96478636b512112288015d43'
review_loop_iteration: 1
followup_review_recommended: false
context: ['{project-root}/AGENTS.md']
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** CHECK failures in photo uploads, scripture reflection submissions, partner requests and love-note sends bypass the existing friendly SQLSTATE mapping. Their callers either expose database text or lose useful failure information.

**Approach:** Reuse the existing `23514` message at these write boundaries and carry it to the existing caller error surface, preserving error classes, retry behavior and result contracts.

## Boundaries & Constraints

**Always:** Only change presentation for `23514`. Preserve scripture error codes and original details, partner duplicate-request handling and non-CHECK errors, photo null-on-failure and store result shapes, love-note resolved failure promises and retryable optimistic entries. Preserve storage cleanup and stable idempotency keys. Use relative production imports.

**Never:** Broaden SQLSTATE policy, change SQL or generated files, change read paths or unrelated write features, edit the deferred-work ledger, or replace existing retry/cleanup behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Photo CHECK | Metadata upsert returns 23514 | Service returns null; upload store returns success:false and sets friendly error | Existing rollback lookup/removal preserved; no raw constraint message in store/result |
| Reflection CHECK | Reflection RPC returns 23514 | Existing ScriptureServiceError and its existing code/details retained; message uses friendly mapping | No cache success write |
| Partner CHECK | Send/accept/decline request write returns 23514 | Rejection exposes friendly message and preserves original error type and diagnostic fields | CHECK takes priority over incidental duplicate/unique words in raw message |
| Note CHECK | Send or retry upsert returns 23514 | Promise resolves; optimistic message is marked failed and notesError receives friendly message | Keep retry id/key/blob and cleanup behavior |
| Other failure | Non-23514 write error | Existing error messages, error types, fallbacks and results unchanged | No newly adopted SQLSTATE mappings |
| Retry success | Previously failed photo/note retried | Existing stable key and success behavior preserved | No duplicate row or destroyed referenced storage |

</intent-contract>

## Code Map

- `src/api/errorHandlers.ts` -- `handleSupabaseError` already maps 23514 to `Some values are not allowed - check length and format limits`; use this mapping without adding policy. `isPostgrestError` handles unknown errors.
- `src/services/photoService.ts:384` -- upload upsert; failure checks committed row before rollback, then throws into its own catch returning null. An optional per-invocation friendly-error callback can deliver CHECK text while preserving the return contract and avoiding shared mutable error state.
- `src/stores/slices/photosSlice.ts:94` -- invokes upload and substitutes generic error for null. Consume optional CHECK message here so the result and existing error banner receive it. Preserve generic null fallback.
- `src/services/scriptureReadingService.ts:330` -- submitReflection wraps RPC failure in ScriptureServiceError; replace only the interpolated message for CHECK. Preserve original error in details and wrapper code.
- `src/api/partnerService.ts:206` -- sendPartnerRequest insert has duplicate/unique substring special case; map CHECK before that. acceptPartnerRequest and declinePartnerRequest also write request status via RPC and rethrow. Preserve error object prototype/type and diagnostic fields when replacing its message.
- `src/stores/slices/notesSlice.ts:149` -- insertNoteOnce shares send/retry idempotency logic. Failure branches at send/retry mark optimistic message failed and return; add CHECK notesError there without introducing rejection or changing other failures.
- `tests/unit/services/photoService.idempotency.test.ts`, `tests/unit/stores/notesSlice.idempotency.test.ts` -- existing retry and cleanup regression harnesses.
- `tests/unit/services/scriptureReadingService.crud.test.ts` -- service failure wrapper tests.
- `tests/unit/api/` -- add partner service tests as needed. Add store-level photo caller coverage using real service and mocked Supabase if feasible.
- `src/components/scripture-reading/hooks/useReportPhase.ts:141` -- summary catch currently discards the reflection error message; surface the mapped text only for wrapped 23514, retaining the generic sentence otherwise. Other components are caller evidence; PartnerMoodView CHECK presentation is also in scope as described below.
- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` -- add reflection UI regression showing friendly CHECK text and retained generic failure behavior.

- `src/components/PartnerMoodView/PartnerMoodView.tsx:296` -- all three request catches use instanceof Error, while actual Supabase non-throwing responses deserialize plain objects. Recognize mapped CHECK failures here without changing other error fallback behavior or service error types. Add rendered caller regressions.
- `src/stores/slices/notesSlice.ts` -- new CHECK banner needs recovery lifecycle and account ownership: clear only the mapped CHECK presentation on recovery, preserving unrelated errors; prevent old-account CHECK responses from setting notesError after account change. Test deferred responses for both send and retry. Reuse the central message definition without duplicating its text in production.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/photoService.ts`, `src/stores/slices/photosSlice.ts` -- route mapped CHECK failure through a per-call optional callback into existing store error/result; retain null service result.
- [x] `src/services/scriptureReadingService.ts` -- reuse mapped CHECK text inside existing reflection error wrapper.
- [x] `src/api/partnerService.ts` -- apply CHECK text to request write failures, preserving prototype/type and diagnostics and other policies.
- [x] `src/stores/slices/notesSlice.ts` -- expose CHECK in notesError on send and retry while retaining failed-message behavior.
- [x] `src/components/scripture-reading/hooks/useReportPhase.ts` and its caller tests -- carry the mapped reflection CHECK text into summarySubmitError; keep other errors unchanged.
- [x] `tests/unit/` -- exercise every matrix row through affected callers; use real mapping and mock backend errors, including non-CHECK controls and existing retry regressions.

**Acceptance Criteria:**
- Given each affected caller receives a representative constraint failure, when its existing error presentation value is consumed, then the value contains the existing friendly text and no raw constraint/table sentence.
- Given existing retryable writes, when CHECK failure and subsequent retry occur, then stable identity, cleanup safety, promise behavior and result shapes remain intact.
- Given non-CHECK failures, when these same callers handle them, then existing fallback and duplicate-request behavior remain unchanged.

## Spec Change Log

- Review pass 1: added partner caller handling because actual SDK plain error objects bypass instanceof Error; added CHECK banner recovery and account-ownership requirements because new notesError state survives successful retry or account change. Avoid lost partner presentation, stale error banners and cross-account error writes. KEEP: CHECK-only policy, original partner object/type/diagnostics, plain ScriptureError wrapper/code/details, photo null callback contract and rollback behavior, note resolved failures and stable keys/blobs/cleanup, all existing passing tests and reflection summary handling. Re-derive production and tests from these requirements; do not modify the intent contract.

- Implementation investigation found useReportPhase discarded all reflection failure text. Added this caller and UI coverage to execution scope to satisfy the existing presentation acceptance criterion. Keep all non-CHECK fallback wording and service error shape. The contract names ScriptureServiceError, but the actual existing wrapper is a plain ScriptureError object; preserve that actual shape/code/details, without introducing a class.

## Review Triage Log

### 2026-09-11 — Review pass 1
- verdicts: 14 findings — high 0, medium 7, low 1, false 6, maybe-false 0
- findings:
  - `[medium]` `[bad_spec]` Verification: successful note retry leaves CHECK banner — retry success updates notes/timestamps but not notesError; amend recovery lifecycle and regression assertions.
  - `[false]` `[reject]` Alignment: photo test stops at store — intended existing caller result/error surface is tested with real service; PhotoUpload consumes that result directly, so no demonstrated divergence.
  - `[false]` `[reject]` Alignment: note test stops at store — LoveNotes renders the hook's notesError directly; store-level assertions exercise the presentation value. The separately reported recovery defect is retained.
  - `[medium]` `[bad_spec]` Alignment: plain partner error loses text at UI — SDK PostgrestBuilder parses error JSON and returns it unchanged unless throwOnError is enabled; PartnerMoodView only accepts Error instances. Add CHECK-only caller handling and rendered regressions.
  - `[false]` `[reject]` Alignment: scripture service/UI tested separately — useReportPhase directly calls the real service in production; the two tests pin both sides of that boundary and no intermediary exists.
  - `[false]` `[reject]` Edge: throwing photo callback skips rollback — the sole production callback only assigns a local string and cannot throw; no reachable callback failure was demonstrated.
  - `[medium]` `[bad_spec]` Edge: successful note retry leaves CHECK banner — same recovery defect; amend recovery lifecycle.
  - `[medium]` `[bad_spec]` Edge: account switch receives stale CHECK banner — new notesError write follows awaits with no captured-user check. Add ownership protection for these newly introduced writes and race tests.
  - `[medium]` `[bad_spec]` Blind: successful note retry leaves CHECK banner — same recovery defect; amend recovery lifecycle.
  - `[medium]` `[bad_spec]` Blind: old-account CHECK error repopulates state — same demonstrated ownership defect; amend guard and race coverage.
  - `[false]` `[reject]` Blind: throwing photo callback skips cleanup — the only actual callback cannot throw; speculative public misuse does not establish an application defect.
  - `[medium]` `[bad_spec]` Blind: plain partner errors receive generic UI text — SDK response parsing confirms the production shape; amend caller handling and UI coverage.
  - `[false]` `[reject]` Blind: scripture mock cannot catch an intermediary stripping details — no such intermediary exists; useReportPhase calls scriptureReadingService.addReflection directly.
  - `[low]` `[reject]` Blind: spec completion claim overstates caller coverage — spec editing findings are rejected by workflow; the concrete partner caller gap is retained separately and will be repaired.

### 2026-09-11 — Review pass 2
- verdicts: 12 findings — high 0, medium 2, low 4, false 6, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind: overlapping note success can clear another note's CHECK banner — the banner is global and any successful send clears mapped presentation; the failed note retains its own error marker and Retry control. The rare overlap of a backend CHECK rejection and another successful send has negligible impact and operation-specific banner ownership would add state/branches beyond a direct correction.
  - `[medium]` `[patch]` Blind: successful old-account responses lack regression coverage — added parameterized delayed-success send/retry cases that preserve the new account's CHECK error, notes identity and timestamp identity.
  - `[low]` `[reject]` Blind: lookup-time retry identity guard lacks its own test — guard exists immediately after getPartnerId; no current bad outcome demonstrated. Additional async harness work for this secondary timing case is not warranted after write-response race coverage.
  - `[low]` `[reject]` Blind: concurrent photo invocations lack isolation test — checkError is a function-local variable captured by a per-invocation callback; no shared error state exists. Adding overlapping-upload harness branches would test a hypothetical regression rather than a demonstrated defect.
  - `[false]` `[reject]` Blind: reflection recovery may leave CHECK text — useReportPhase clears summarySubmitError at the start of every submission before any await; existing success/double-submit tests cover phase advance. No CHECK-specific recovery branch exists.
  - `[false]` `[reject]` Blind: repeated partner mapping needs extraction — all six branches call the same central mapper and no divergent behavior exists; extraction would not remove SQLSTATE checks or fallback distinctions.
  - `[low]` `[patch]` Blind: photo callback undocumented — added parameter documentation describing metadata CHECK-only text, timing before rollback and preserved null result.
  - `[medium]` `[patch]` Verification: success guard removal escapes account-switch tests — same coverage root cause as Blind; new delayed-success tests cover both success guards and preserve all new-account fields.
  - `[false]` `[reject]` Alignment: photo coverage stops at store — carried: actual photo caller consumes tested result/error values directly; no demonstrated presentation mismatch.
  - `[false]` `[reject]` Alignment: note coverage stops at store — carried: LoveNotes renders the hook's notesError directly; no missing transformation at that boundary.
  - `[false]` `[reject]` Alignment: scripture uses separate service/UI tests — carried: direct service call has no intermediary and both sides are exercised.
  - `[false]` `[reject]` Alignment: partner rendered test bypasses production store — production partner actions await the service and rethrow errors unchanged; tests cover the relevant service-to-component error value, and no mismatch was demonstrated.
- Edge-case layer returned no findings.

## Design Notes

Photo upload catches its own error and returns null, so simply mapping the internal throw cannot reach its caller. A per-call optional callback carrying only CHECK presentation text allows the existing store to use it without changing the service result type or introducing a shared last-error field. For partner errors replace only message while retaining the original error type and fields; do not throw SupabaseServiceError in place of PostgrestError.

## Verification

**Commands:**
- `npm run test:unit` -- all unit tests pass, including added caller regressions and existing retry tests.
- `npm run typecheck` -- exit 0, or document a reproduced unchanged baseline failure before assessing change-specific errors.
- `npm run lint` -- exit 0; report existing warnings.
- `git diff --check` -- no whitespace errors.

## Auto Run Result

Status: done

Implemented DW-38: all four named CHECK-carrying write paths reuse the existing friendly 23514 message. Photo service retains null results while the upload store receives per-call CHECK text; scripture preserves its plain error wrapper and original diagnostics; partner methods preserve original error objects and the UI accepts plain CHECK errors; notes retain retryable failures and clear the global CHECK banner on successful recovery. Delayed note responses are guarded against account changes. SQLSTATE policy and deferred-work ledger remain unchanged.

### Files changed

- `src/api/errorHandlers.ts` — central message constant shared with the existing map and note recovery.
- `src/api/partnerService.ts` — CHECK-only message replacement for send/accept/decline errors.
- `src/components/PartnerMoodView/PartnerMoodView.tsx` — mapped plain-object CHECK presentation.
- `src/services/photoService.ts` — documented per-call CHECK message callback, same null result and rollback.
- `src/stores/slices/photosSlice.ts` — friendly CHECK value in existing error/result surface.
- `src/services/scriptureReadingService.ts` — mapped reflection text with original wrapper/code/details.
- `src/components/scripture-reading/hooks/useReportPhase.ts` — CHECK text in existing summary error display.
- `src/stores/slices/notesSlice.ts` — send/retry CHECK banners, recovery and account guards.
- `tests/unit/api/partnerService.check.test.tsx` — real service/rendered caller coverage and error-shape controls.
- `tests/unit/services/photoService.idempotency.test.ts` — real service/store errors, retry identity and cleanup coverage.
- `tests/unit/services/scriptureReadingService.crud.test.ts` — reflection wrapper, diagnostics, no-cache and non-CHECK controls.
- `tests/unit/stores/notesSlice.idempotency.test.ts` — failure/recovery, blob/key/cleanup and failed/successful account-switch races.
- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` — rendered reflection CHECK/non-CHECK messages.
- This specification — planning, review triage and verification record.

### Review outcome

Two review passes with four layers each. First pass repaired three grouped issues: partner caller presentation, note banner recovery, and account ownership. Second pass applied two grouped patches: successful-response account-switch coverage (medium) and callback documentation (low). No deferred entries. Every rejected finding and its evidence is recorded individually in the two Review Triage Log entries above; none is omitted. Patched entry counts in final pass: high 0, medium 1, low 1. Follow-up review recommended: false; no remaining unverified material risk identified.

### Verification

- Final `npm run test:unit`: 98 files, 1493 tests passed, exit 0.
- Final `npm run typecheck`: exit 0.
- Final `npm run lint`: exit 0; three pre-existing react-refresh warnings in EventCountdown.tsx at 68, 91 and 132.
- `git diff --check`: exit 0.
- Matrix audit: photo CHECK/null/store/rollback/retry rows covered by photo idempotency tests; reflection wrapper/no-cache and rendered failure covered by service and SoloReadingFlow tests; partner send/accept/decline CHECK shapes, duplicate handling and non-CHECK controls covered by partnerService.check tests; notes send/retry promises, blobs/keys/cleanup, recovery and account races covered by notes idempotency tests. All covering files ran and passed.
- No SQL, generated files, archived E2E files or deferred-work ledger changes.

### Residual limits

The note error banner remains global: an overlapping successful send may dismiss another note's CHECK explanation, while that note retains its failed marker and retry control. Review classified this rare presentation-only case as low and rejected operation-specific tracking complexity. Existing unrelated account-transition gaps outside the modified response paths are not claimed fixed. Validation used mocked backend unit/component tests, not a running Supabase/E2E environment.
