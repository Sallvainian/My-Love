---
title: 'DW-49: Reconcile uncertain event saves'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: 'a48e4f56e0aed00d5af719fb83b023db2e039f38'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** An event create or update can reach the server but return an unreadable response. Settings currently offers Add/Update again for `invalid-response`, allowing a duplicate create or an unreconciled update.

**Approach:** Explain that the event may already have been saved, replace the failed form's write control with Refresh events, and use the existing refresh flow to reconcile the list before the user chooses another write.

## Boundaries & Constraints

**Always:** Route by the `invalid-response` code. Prevent resubmission from that failed form, including implicit/direct form submissions and field edits. Refresh closes the failed form and calls the existing events load flow; its failure uses the existing list notice and read-only Retry action. Preserve the entered fields until dismissal/refresh, accessible failure focus, existing stale-row recovery, load lifetime/session guards, and deliberate offline/transport write retries.

**Never:** Edit the deferred-work ledger; the orchestrator owns resolution. Add automatic writes, offline queuing, an idempotency schema change, a global prohibition on new forms, or a separate refresh implementation. Change service/store error codes, unrelated delete behavior, generated files, or archived E2E tests. Treat an absent row in a bounded refresh as proof that the write failed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Uncertain create | Add returns invalid-response after a potentially committed insert | Form explains uncertain save; Refresh events replaces Add; fields remain | No second write from this form, even after editing or submitting directly |
| Uncertain update | Update returns invalid-response after a potentially committed update | Same explanation and refresh-only recovery | No repeat update from the failed form |
| Successful reconciliation | User activates Refresh events after either uncertain save | Failed form closes; one load renders returned authoritative rows; surviving Add header receives focus | No automatic write, including when response contains no matching row |
| Failed reconciliation | Refresh fails with an empty or previously populated list | Form stays closed; existing load-error notice and Retry appear; prior rows survive | Retry loads again and can recover without another write |
| Ordinary retry | Add/update returns offline or transport | Existing returned message and enabled Add/Update remain; fields survive | A deliberate retry calls the correct write once more and can succeed |
| Existing stale row | Write returns not-found | Existing Refresh events behavior remains | Same load outcome and focus bookkeeping |

</intent-contract>

## Code Map

- `src/components/Settings/EventsSettings.tsx:361` — `handleFormRefresh` closes the form and calls `refreshEvents`; `recordLoadOutcome`, list notice, and `handleRetry` already handle load success/failure, component lifetime, and authentication ownership. Reuse unchanged.
- `src/components/Settings/EventsSettings.tsx:730` — `EventForm` owns fields, `saveFailure`, submit/refresh refs, and failure focus. `handleSubmit` currently clears failure before validating, without a guard against an uncertain result. The error paragraph and not-found-only action branch are near lines 1117–1141.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — subscribable store double, `makeEvent`, rendered Add/Edit helpers, write-failure code routing, load reconciliation, read Retry, and authentication regressions. Extend active component cases for the matrix, controlling pending load responses where useful.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` — real focus trap with mocked motion; existing failure and stale refresh focus tests provide patterns for uncertain create/update recovery.
- `src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx`, `EventsSettings.errorIsolation.test.tsx`, `EventsSettings.pagination.test.tsx` — regression coverage for the reused flow, load/write outcome isolation, and bounded history behavior.
- `src/services/eventsService.ts:552,637` (read-only) — create/update throw invalid-response after unusable successful write responses; some raw messages claim definite failure/success, so the UI must provide honest uncertainty wording for this code.
- `src/stores/slices/eventsSlice.ts:290,322` (read-only) — failed writes return their code and leave the list unchanged; `loadEvents` returns success/failure/stale and reconciles authoritative data.
- `package.json`, `vitest.config.ts`, `tests/setup.ts` (read-only) — active Vitest component tests, happy-dom, and required DOMPurify shim.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/Settings/__tests__/EventsSettings.test.tsx` — add rendered create/update uncertain-save, submission suppression, refresh success/failure/retry, and ordinary offline/transport retry regressions covering the matrix; demonstrate uncertain-save failures against the baseline.
- [x] `src/components/Settings/EventsSettings.tsx` — display the uncertain-save explanation, route invalid-response to the existing refresh action, and guard submission before it can clear the failed state or call a write.
- [x] `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` — verify failure focuses Refresh events and refresh returns focus to the surviving header for create/update.

**Acceptance Criteria:**
- Given an Add or Update returns invalid-response, when the user reads and interacts with the failed Settings form, then uncertainty is explicit, Refresh events is the primary action, and no resubmission can issue another write from that form.
- Given the user refreshes an uncertain save, when the load succeeds or fails, then the rendered events list or existing retry notice reflects that invocation, and recovery never automatically replays the write.
- Given an offline or transport save failure, when the user deliberately retries Add/Update, then the original fields and retry behavior remain available and the intended action can succeed.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 7 findings — high 0, medium 1, low 2, false 4, maybe-false 0
- findings:
  - `[medium]` `[patch]` Uncertainty was guarded only after React rendered the failure — the reviewer reproduced a second direct submission after the invalid-response promise continuation but before commit. The implementation agent added create/update regressions, both failed with two writes before the patch, and both pass with an immediately latched form-local uncertainty ref.
  - `[low]` `[patch]` The new focus mock incorrectly kept the empty-state opener mounted during refresh — the real slice synchronously sets `eventsIsLoading`, which removes the empty slot. The mock now models loading and settlement; the test verifies opener removal and surviving-header focus during the pending read and after completion.
  - `[false]` `[reject]` Missing dismissal/reopening coverage might hide a global write lock — both uncertainty state and its immediate guard are owned by each `EventForm` instance, and closing unmounts that instance. Opening a fresh form initializes its state/ref to clear values; no shared store or parent lock was introduced. No broken fresh-form behavior was identified.
  - `[low]` `[patch]` The new helper typed editEvent as addEvent — the parameterized helper erased the distinct update target argument, weakening future typed mock implementations in that test. It now branches on mode and uses each action's actual `AppState` signature.
  - `[false]` `[reject]` The specification lacks completed tasks and observed verification — this was an intermediate workflow artifact during review; finalization records both below. Its proposed fix edits only this build's spec and is rejected as a review finding under the workflow rule.
  - `[false]` `[reject]` The intent auditor described a possible workflow-wide write restriction — the supplied decision expressly says to prevent resubmission "from that failed form" and to reuse the existing refresh flow. That concrete scope selects the implemented form-lifetime behavior over expanding the shorthand decision label into a global lock. Dismissal and fresh-form availability are preserved behavior, not an omitted requirement.
  - `[false]` `[reject]` The intent auditor distinguished mocked Settings recovery from a committed database write followed by response conversion — the new behavior lives at the Settings form surface, which the rendered component tests exercise through typed write/load outcomes. No service/store/server behavior was changed or database-level deduplication claimed; existing service and store regression suites also ran successfully.

The verification-gap and edge-case reviewers returned no findings. The blind review returned five findings; its arithmetic line is not a finding. The intent auditor's two descriptive scope/surface observations are recorded separately above. Three reviewers ran together; the fourth started when the platform's concurrent-agent limit released a slot. All reports were collected before triage.

## Verification

**Commands:**
- `npx vitest run src/components/Settings/__tests__/EventsSettings.test.tsx src/components/Settings/__tests__/EventsSettings.focus.test.tsx` — expected: new uncertain-save tests fail before the fix and pass afterward.
- `npm run test:unit` — expected: complete unit/component suite passes, including shared refresh, session, lifetime, pagination, service, and store regressions.
- `npm run typecheck` — expected: all three referenced projects pass.
- `npm run lint` — expected: no lint errors; report existing warnings.
- `git diff --check` — expected: no whitespace errors; confirm no ledger diff.

## Auto Run Result

Status: done

### Summary

DW-49 is implemented. Invalid-response create/update failures now explain that the event may already be saved and offer Refresh events in place of Add/Update. A synchronous form-local guard prevents resubmission before React renders the failure and remains latched after field edits. Refresh uses the existing list loading, failure notice, read Retry, and focus recovery. Offline/transport writes retain deliberate retry.

### Files changed

- `src/components/Settings/EventsSettings.tsx` — uncertainty copy, refresh routing, and immediate submission guard.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — create/update recovery, submission timing, failed refresh/read retry, and preserved offline/transport retry coverage.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` — uncertainty action focus and header restoration with realistic refresh loading.
- `_bmad-output/implementation-artifacts/spec-dw-49-uncertain-event-save-reconciliation.md` — implementation contract, review triage, and verification evidence.

### Review outcome

Patches applied: 3 entries (high 0, medium 1, low 2). Deferred: 0. Rejected: 4, individually explained in the Review Triage Log: no global state leak on reopening, intermediate spec evidence finalized here, no intent requirement for a global write lock, and no database deduplication claim requiring new server behavior.

Follow-up review recommended: false. The sole medium entry has deterministic failing-before/passing-after create and update regressions; the other patches correct the test loading model and mock types. No high or second medium entry was patched.

### Verification performed

- Implementation red baseline: the two focused suites reported 17 failures and 102 passes against unchanged production code; failures included missing recovery UI and duplicate direct submissions.
- Review repair red baseline: both new pre-render submission cases failed with two write invocations before the synchronous ref patch.
- Parent final focused run: `npx vitest run src/components/Settings/__tests__/EventsSettings.test.tsx src/components/Settings/__tests__/EventsSettings.focus.test.tsx` — 121 tests pass in two files.
- Parent final full run: `npm run test:unit` — 104 files and 1,850 tests pass, including all Settings refresh, lifetime, authentication, pagination, service, and store cases.
- Parent final `npm run typecheck` — passes all referenced TypeScript projects.
- Parent final `npm run lint` — zero errors; three pre-existing Fast Refresh warnings in `EventCountdown.tsx` at lines 68, 91, and 132.
- `git diff --check` and staged whitespace checks pass. The deferred-work ledger has no diff against the captured baseline.

### Matrix test audit

Every matrix row has active passing coverage in the final full run:

- Uncertain create/update: parameterized cases verify code-based wording, retained fields, refresh-only controls, direct/keyboard submissions after edits, and the interval before React commit.
- Successful reconciliation: both modes load once and render authoritative rows or a bounded-history empty result without replaying the write; focus tests cover Refresh and surviving-header focus.
- Failed reconciliation: create begins empty and update begins populated; both keep the form closed, show the existing notice, retain prior rows when present, and recover through a read-only list Retry.
- Ordinary retry: all four mode/code combinations actually retry with the entered values and render the successful result.
- Existing stale row: existing not-found edit/delete refresh, double activation, failure notice, focus, lifetime, and authentication tests pass unchanged.

### Residual risks

Verification uses rendered components with controlled store results and the existing unit service/store suites; no new browser/server end-to-end run was performed. Protection ends with the failed form, as requested. Fresh forms and deliberate transport retries retain their existing behavior. A missing event in a bounded refresh is not treated as proof of write failure.
