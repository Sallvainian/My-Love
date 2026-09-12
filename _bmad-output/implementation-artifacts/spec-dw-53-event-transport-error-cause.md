---
title: 'DW-53 Preserve event transport error causes'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
baseline_revision: '1b5b0f56e5c670ed701973d6505566bf45f81f2c'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Non-PostgREST event write failures retain only the original error's message. Its identity, stack, and transport metadata are lost even though `EventWriteError` already accepts `ErrorOptions` (DW-53).

**Approach:** Preserve the original caught transport value as the event write error's direct `cause`, retaining the existing code and exact presentation message. Verify the behavior through the public create, update, and delete service methods.

## Boundaries & Constraints

**Always:** Preserve the original cause by identity, including non-Error thrown values; retain the `transport` code and existing context-specific messages; keep existing PostgREST mapping and its mapped-error cause intact.

**Never:** Change read errors, UI or store behavior, codes, visible messages, retry behavior, persistence, schema, generated files, or the orchestrator-owned deferred-work ledger. Do not broaden this diagnostic fix into shared error-handler refactoring.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Error transport failure | Create, update, or delete catches a non-PostgREST `TypeError` with diagnostic metadata | Public promise rejects with `EventWriteError`; `cause` is the exact original error | Code remains `transport`; exact existing operation-specific network message is retained |
| Non-Error transport failure | Write catches an object or primitive without a PostgREST shape | Original thrown value is available as direct `cause` | Code remains `transport`; message retains `Unknown network error` fallback |
| PostgREST failure | Write receives a structured database error | Existing mapped Supabase error remains the cause | Existing mapped message and transport code are unchanged |
| Other outcomes | Successful writes, local guards, zero-row writes, and reads | Existing results and errors remain unchanged | Existing regression suites continue to pass |

</intent-contract>

## Code Map

- `src/services/eventsService.ts:116` — exported `EventWriteError` already forwards optional `ErrorOptions` to `Error`; no constructor change is needed.
- `src/services/eventsService.ts:141` — `networkFailure` generates the current message and is also used by reads; preserve its behavior.
- `src/services/eventsService.ts:147` — `writeTransportFailure` currently passes only `networkFailure(...).message`; this is the shared cause-loss boundary for all three write catch tails.
- `src/services/eventsService.ts:152` — `writePostgrestFailure` already preserves the mapped Supabase error as cause; read-only constraint.
- `tests/unit/services/eventsService.test.ts` — in-memory Supabase query fake, `eventWriteFailure`, and existing create/update/delete network cases provide public service assertions. Its typed `backend.nextError` currently supports Error or PostgREST error objects; use a narrowly scoped rejected-call spy or minimal fake extension for non-Error thrown values.
- `tests/unit/api/checkConstraintMapping.test.ts` — existing integration of the real error mapper and event service verifies mapped PostgREST cause metadata.
- `tests/unit/stores/eventsSlice.test.ts` — existing store regression coverage verifies write outcome behavior above the service.
- `package.json`, `vitest.config.ts` — unit tests run in happy-dom with test Supabase configuration; no live backend or decrypted secrets are needed for the planned verification.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/eventsService.ts` — preserve the original caught transport value as the direct cause at the shared write wrapper; update its nearby comment if needed.
- [x] `tests/unit/services/eventsService.test.ts` — strengthen all three public write transport tests with identity assertions and unchanged code/message checks; cover non-Error fallback values without exposing private helpers.
- [x] `tests/unit/services/eventsService.test.ts`, `tests/unit/api/checkConstraintMapping.test.ts`, `tests/unit/stores/eventsSlice.test.ts` — execute focused regressions, then run repository typecheck and lint; record actual results and any independently verified baseline failures.

**Acceptance Criteria:**
- Given a non-PostgREST transport failure from any event write, when a caller catches the rejected public service promise, then its direct cause is the original thrown value by identity and its code and visible message match the previous behavior.
- Given an Error carrying a stack and transport metadata, when a caller inspects the rejected write's cause, then those diagnostics remain available through the same original Error object.
- Given the completed patch, when existing PostgREST, read, guard, and store regressions run, then their previously supported outcomes remain intact.

## Spec Change Log

## Review Triage Log

### 2026-09-11 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 3, false 2, maybe-false 0
- findings:
  - `[low]` `[patch]` Blind hunter: the new throwing fake query path bypassed the supplied rejection callback because `run()` executed before `Promise.resolve` — changed the fake to `Promise.resolve().then(run).then(onFulfilled, onRejected)`, preserving promise rejection semantics for injected failures.
  - `[low]` `[patch]` Blind hunter: reading the expected stack after the service call could hide in-place diagnostic loss — captured each original stack before invoking the write and compared the cause against that snapshot.
  - `[low]` `[patch]` Blind hunter: Error identity cases used response error envelopes while rejected promises covered only non-Error values — added a rejected metadata-bearing TypeError case for each public write, checking identity, captured stack, metadata, code, and exact message.
  - `[false]` `[reject]` Blind hunter: update/delete lack separate mapped-cause assertions — the absence of duplicate assertions does not leave the changed path unverified: both unchanged catch tails call the same unchanged `writePostgrestFailure` as create, whose mapped-cause metadata regression ran and passed. The changed non-PostgREST helper is never called on that branch; existing update/delete PostgREST code/message cases also passed.
  - `[false]` `[reject]` Intent auditor: a broader reading could require identity preservation before the service receives a failure — the supplied bundle explicitly identifies `writeTransportFailure` dropping its input at the service boundary. It selects preservation of that caught value; changing or validating the complete upstream transport stack is not required to resolve the named loss. Public create/update/delete tests observe the required caller surface.
- The edge-case and verification-gap reviewers reported no findings. The intent auditor confirmed alignment at both the named wrapper and public service surfaces. All four review layers completed; the fourth launched when a concurrency slot became available.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/services/eventsService.test.ts tests/unit/api/checkConstraintMapping.test.ts tests/unit/stores/eventsSlice.test.ts` — expected: all focused tests pass, including identity and exact message assertions.
- `npm run typecheck` — expected: all configured projects pass; investigate and identify any baseline environment diagnostics without expanding runtime scope.
- `npm run lint` — expected: no lint errors.
- `git diff --check` — expected: no whitespace errors.

**Results (2026-09-11):**
- Before the runtime fix, the focused command failed the 21 strengthened/new transport-cause cases; the other 107 tests passed.
- After the fix, the focused command passed all 128 tests across the three files. This includes original Error identity, stack and transport metadata, exact messages/codes, and object/string/number/boolean/null/undefined rejections through each public write method.
- `npm run typecheck` passed with no diagnostics.
- `npm run lint` passed with no errors and three `react-refresh/only-export-components` warnings in `src/components/RelationshipTimers/EventCountdown.tsx` at lines 68, 91, and 132. That file and `eslint.config.js` are unchanged from `baseline_revision`.
- `git diff --check` passed. No verification failures remain.

## Auto Run Result

Status: done

The shared event write transport wrapper now retains the original caught value as the direct cause of `EventWriteError`. Codes and visible messages remain unchanged. Callers retain Error identity, stack, and transport metadata, and non-Error rejection values also survive unchanged.

Files changed:
- `src/services/eventsService.ts` — passes the original transport value through the constructor's existing ErrorOptions support.
- `tests/unit/services/eventsService.test.ts` — verifies Error identity and diagnostics through response errors and rejected promises for create/update/delete, plus six non-Error rejection values per operation; corrects the fake's promise rejection forwarding.
- `_bmad-output/implementation-artifacts/spec-dw-53-event-transport-error-cause.md` — records the plan, acceptance criteria, review decisions, and final verification.

Review outcome: three low-severity test improvements applied; zero items deferred. The two rejected observations concern redundant PostgREST branch coverage (the unchanged shared mapper is already exercised) and a broader upstream transport interpretation (the bundle names the service wrapper's loss). Their evidence is recorded individually in the triage log.

Follow-up review recommendation: false. Patched entries: high 0, medium 0, low 3. No unresolved risk requiring another review pass was identified.

Final verification, independently repeated after review patches:
- Focused service, mapping, and store command: 131 tests passed across three files, with zero skipped tests (74 service, 22 mapping, 35 store).
- `npm run typecheck`: passed with no diagnostics.
- `npm run lint`: passed with zero errors and the same three pre-existing EventCountdown Fast Refresh warnings. Vitest also emitted an advisory about the existing Vite config's future native loader compatibility.
- `git diff --check` and `git diff --cached --check`: passed.
- Matrix audit: Error identity and diagnostics, non-Error fallback values, mapped PostgREST errors, and existing success/read/guard/store outcomes all have executed passing tests; JUnit confirmed no skipped cases.
- The deferred-work ledger and generated files are unchanged.

Residual risks: no new unresolved risks identified within the bundle. Verification exercises the public service using the repository's Supabase fake; it makes no claim about error transformations inside upstream transport libraries.
