---
title: 'DW-79: Trace real token persistence overlap'
type: 'chore'
created: '2026-09-12'
status: 'done'
baseline_revision: 'cd1a693d8e1a9f4ffc6b295d2dbd2d26cea8a758'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Both auth notifications and action-service completions persist the service-worker token. Mocked promise completion cannot establish whether their real IndexedDB transactions let stale work replace or delete a newer token.

**Approach:** Build and execute a controlled browser characterization harness using the actual auth services and sw-db implementation. Record dispatch, native transaction creation and commit order, and final token ownership; report exactly which schedules demonstrate stale persistence before selecting any coordination change.

## Boundaries & Constraints

**Always:** Run real browser IndexedDB and installed idb, actionService signIn/signOut, and sessionService notifications. Preserve each action's originating notification completion before its controlled SDK response resolves. Use deterministic native transaction contention, trace operation provenance, and verify final storage through actual getAuthToken. Export only synthetic owner/version labels and ordering metadata. Isolate browser storage, restore instrumentation, drain pending operations, and distinguish controlled callback schedules from live SDK/server or multi-tab evidence.

**Never:** Edit the deferred-work ledger, production persistence behavior, generated files, archived tests, schemas, shared worker accounts, or secrets. Mock sw-db or claim that delayed promise completion proves reversed commits. Choose or implement a persistence-coordination fix within this evidence bundle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sequential control | Real sign-in and sign-out actions with their notifications | Duplicate writes/deletes have native commit evidence; sign-in owns current, sign-out leaves null | Any unexpected abort or service error fails the test |
| Overlapping local actions | Sign-out and sign-in plus originating callbacks queue behind a native sw-auth blocker | Trace all listener and action writes through drain; newer sign-in's final action write restores its token | Fail on missing phases or unsettled actions |
| Stale clear | Pending sign-out listener delete precedes an independent newer sign-in notification put behind native contention | Characterize whether duplicate action delete commits after the newer put and leaves null; preserve full native order evidence | No reversed native opens or fabricated commits |
| Stale overwrite | Pending sign-in A callback put precedes independent newer B notification put behind native contention | Characterize whether duplicate action put restores A after B, using actual final stored token | Distinguish independent notification from another local action |
| Same-owner token refresh | Pending sign-in token v1 overlaps newer TOKEN_REFRESHED v2 notification for same user | Opaque version labels identify which token remains even when userId is unchanged | Never serialize access or refresh token contents |

</intent-contract>

## Code Map

- `src/api/auth/actionService.ts:7,80` — read-only real signIn/signOut await SDK result then independently store/delete.
- `src/api/auth/sessionService.ts:81` — read-only listener forwards identity synchronously, then awaits store/delete in finally.
- `src/sw-db.ts:27,136,158,179` — read-only each operation opens DB, executes an idb convenience transaction, closes connection; getAuthToken reads current.
- `src/services/dbSchema.ts` — reuse DB_NAME, DB_VERSION, STORE_NAMES, upgradeDb and StoredAuthToken; no schema change.
- `node_modules/idb/build/index.js` — convenience writes await transaction completion; native complete events are commit evidence.
- `node_modules/@supabase/auth-js/src/GoTrueClient.ts:1239,4067,5170` — signIn/signOut await their notifications before returning; independent notifications may overlap. Inspect installed code when describing limitations.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx` — existing real service / controlled SDK pattern, synthetic session factory and restoration examples. New harness needs no App UI.
- `tests/support/merged-fixtures.ts`, `tests/support/fixtures/auth.ts` — specs import merged test/expect; authSessionEnabled:false prevents shared token/account use.
- `playwright.config.ts` — chromium discovers tests/e2e; default global setup mutates worker pool. New isolated verification config should import its environment bootstrap but disable globalSetup, use dedicated Vite port, and select only this harness spec.

## Tasks & Acceptance

**Execution:**
- [x] `tests/support/harnesses/auth-token-persistence.ts`, `tests/support/harnesses/auth-token-persistence.html` — implement browser bridge, native contention and sanitized trace instrumentation with controlled SDK notifications/action responses; restore methods and drain in cleanup.
- [x] `tests/e2e/auth/token-persistence-overlap.spec.ts` — exercise every matrix row via merged fixtures, assert actual native ordering and final owner/version, and attach sanitized JSON traces. These are characterization expectations, not a production fix.
- [x] `_bmad-output/test-artifacts/dw-79-token-persistence/playwright.verify.config.ts` — provide reproducible isolated Chromium command without worker provisioning; existing local Supabase is running.
- [x] `_bmad-output/test-artifacts/dw-79-token-persistence/trace-report.md`, `evidence/*.json` — retain redacted executed traces, commands, runtime versions, observed outcomes, and inference limits. State whether evidence supports a later coordination change without selecting one.

**Acceptance Criteria:**
- Given actual services and native browser storage, when controlled overlapping actions and notifications settle, then exported evidence identifies each persistence dispatch, transaction creation, native commit, and final current-token owner/version.
- Given a newer committed token, when older work resumes, then the browser characterization identifies any stale deletion or overwrite from native commits and final storage, including the ordinary local-action control.
- Given an executed trace, when it is attached or retained, then it contains no token contents and the report distinguishes measured persistence behavior from untested SDK/server scheduling.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 5, false 9, maybe-false 0
- Verification-gap reviewer: no findings. Edge-case hunter: no findings. All four layers ran; the fourth launch waited for an available concurrency slot before triage began.
- findings:
  - `[false]` `[reject]` Intent auditor: installed SDK scheduling is not exercised — this is an accurate evidence limit, not a deviation from the requested controlled browser harness. The intent requires actual sw-db and actionService overlap, which execute; it does not require live SDK/server or multi-tab delivery. The report states the controlled boundary explicitly.
  - `[false]` `[reject]` Intent auditor: overlapping local actions end at B — the intent asks whether stale work can delete or overwrite newer storage, rather than requiring an incorrect final owner in every schedule. The local-action trace records the temporary late deletion and final restoration; the report makes both observable outcomes explicit.
  - `[false]` `[reject]` Intent auditor: persistent stale results use independent notifications — actual native commits and final reads establish the conditional persistence result under that supplied schedule. The report labels the independent notifications and does not present them as a second local sign-in action or a reproduced live SDK schedule.
  - `[false]` `[reject]` Intent auditor: native transactions commit in creation order — the bundle seeks actual ordering evidence before a coordination decision, not proof of inverted IndexedDB scheduling. The trace establishes later duplicate action dispatch as the mechanism and explicitly rejects the inversion claim.
  - `[false]` `[reject]` Blind hunter: attachment precedes its schema assertions and unchecked fields could publish tokens — the order is true, but no token-bearing export path exists in this implementation. Trace origins are fixed literals; sessionLabel/tokenLabel construct only owner/version labels; checkpoints/finalToken reuse that mapper; errors contain fixed codes. The native token fields and stack never enter the returned object. The assertions detect future structural drift rather than perform redaction, and the retained attachments contain no token contents.
  - `[low]` `[reject]` Blind hunter: thrown harness failures lose partial custom traces — true for a missing phase or exceptional final read; Playwright still reports the failing call and the deterministic scenario. No such failure occurred in the required runs. Returning partial results across exceptions would add failure-state branches for an uncommon developer diagnostic case, beyond a direct correction.
  - `[low]` `[reject]` Blind hunter: cleanup drains lack their own deadline — true; a permanently stalled native operation is bounded only by Playwright's timeout/context teardown. The specified native blocker is released in finally and all executed operations drained. Additional timeout races, incomplete-drain state and forced cleanup branches are not justified for this uncommon failure mode.
  - `[low]` `[reject]` Blind hunter: generic error codes omit operation identifiers — true for request/transaction-error codes; native abort events already carry provenance and every successful operation is traced. No ambiguous failure occurred. Expanding the error format and export/test handling for uncommon diagnostics is more than a direct correction.
  - `[false]` `[reject]` Blind hunter: broader transaction scopes could misattribute another store's request — all actual sw-db token helpers use one sw-auth store and one convenience get/put/delete. No caller creates the hypothetical multi-store transaction; final actual getAuthToken and token-value checks also independently establish the measured record. The existing instrumentation fails unexpected scopes rather than replacing native storage.
  - `[low]` `[reject]` Blind hunter: partial reruns can mix retained evidence generations — true because passing scenarios write separately. The delivered set was produced by complete five-test passes at one unchanged baseline, and the parent rerun produced byte-identical traces matching report ordinals. Atomic publication and run-manifest machinery would add complexity for a future partial rerun; no mixed delivered evidence needs repair.
  - `[false]` `[reject]` Blind hunter: automatic network monitoring defeats token redaction — the installed merged monitor can attach HTTP-error URLs, but no token is placed in a request URL or payload by this harness. Synthetic sessions exist only behind substituted SDK methods; the page loads local module assets and rejects external requests. All executed runs recorded zero external requests/page errors. Public development asset URLs in an unrelated failed-load diagnostic are not token contents; the report's no-URL claim concerns the custom JSON.
  - `[false]` `[reject]` Blind hunter: exact V8 stack matching is fragile — this harness explicitly targets the recorded Chromium/Vite runtime and unchanged actionService path. The match identifies the real continuation and fails loudly if attribution is unavailable; it cannot silently assign a wrong native commit. A future move/transform is not a demonstrated failure in this supported runtime, and the dependency is documented.
  - `[false]` `[reject]` Blind hunter: pending sign-in followed by independent sign-out is missing — this is an additional characterization schedule, not a missing requirement or observed bad outcome in the delivered harness. Both real actions overlap in the local control, and native stale deletion, overwrite and same-owner refresh rollback already answer whether older work can replace/delete a newer token. The bundle does not claim exhaustive auth scheduling coverage.
  - `[low]` `[patch]` Blind hunter: the isolated config is outside static-check coverage — confirmed from tsconfig include patterns and eslint's config-file ignores. Added an explicit report distinction between source/test static checks and successful loading/execution of the isolated config; no config behavior changed.
- Grouped routes: one low documentation patch; four low diagnostic/tooling suggestions rejected as disproportionate; nine unsupported defect claims rejected with evidence. No deferrals, intent gaps or spec loopbacks.

## Design Notes

Keep a native readwrite transaction active with repeated reads, queue production transactions, then release it. Do not delay or reorder open successes. A listener transaction can commit before the SDK returns, allowing the duplicate action transaction to be created after a newer notification's already-created transaction. This is a dispatch-order hypothesis to verify, not a claim of inverted IndexedDB scheduling.

## Verification

**Commands:**
- `npx playwright test --config _bmad-output/test-artifacts/dw-79-token-persistence/playwright.verify.config.ts` — all five matrix scenarios pass with attached native traces.
- `npm run typecheck` — all referenced TypeScript projects pass.
- `npm run lint` — zero errors; existing warnings may remain.
- `npx vitest run src/api/auth/__tests__/authServices.test.ts` — existing auth contracts pass.
- `git diff --check` — no whitespace errors; ledger and production auth/sw-db sources match baseline.


## Auto Run Result

Status: done

### Summary

Implemented DW-79 as a browser characterization harness and executed evidence bundle. Real actionService, sessionService, sw-db, idb and native IndexedDB expose each persistence dispatch, open, transaction creation, request, native completion and final stored owner/version without exporting token contents. Native contention reproduces stale deletion, cross-owner overwrite and same-owner refresh rollback through later duplicate action writes. Ordinary overlapping local sign-out/sign-in restores B after its temporary stale deletion. No persistence-coordination change was selected or implemented.

### Files changed

- `tests/support/harnesses/auth-token-persistence.ts` — real-service browser bridge, native contention/observers, opaque labels and cleanup.
- `tests/support/harnesses/auth-token-persistence.html` — isolated browser entry point.
- `tests/e2e/auth/token-persistence-overlap.spec.ts` — five native-order and final-storage characterizations with merged fixtures and sanitized attachments.
- `_bmad-output/test-artifacts/dw-79-token-persistence/playwright.verify.config.ts` — dedicated Chromium/Vite runner without shared account provisioning.
- `_bmad-output/test-artifacts/dw-79-token-persistence/evidence/*.json` — five executed redacted traces and runtime/cleanup results.
- [Trace report](../test-artifacts/dw-79-token-persistence/trace-report.md) — measured outcomes, reproduction commands, native sequence references and limits.
- This spec — frozen intent, completed tasks, review triage and completion evidence.

### Review outcome

Four layers completed. The edge-case and verification reviewers returned no findings. One low documentation patch clarifies that the isolated config is executed but excluded from repository static checks. No findings were deferred. The nine false findings and four low suggestions were rejected individually in Review Triage Log:

- Four intent observations describe documented boundaries, not deviations: controlled SDK inputs, the local control's final restoration, independent newer notifications, and FIFO native commits.
- Export values already originate exclusively from fixed metadata or a token-to-label mapper; no token-containing attachment path was demonstrated.
- Partial failure traces, separate cleanup deadlines and richer failure provenance would add uncommon diagnostic complexity; all required executions drain successfully with no errors.
- No real token helper creates the hypothetical broader-store transaction.
- Delivered evidence comes from complete passes and matches the report; atomic publication machinery addresses a future partial rerun.
- The merged network monitor has no token-bearing URL to export from this harness.
- Stack matching is an explicit Chromium/Vite attribution dependency that fails loudly if unsupported.
- The reciprocal logout schedule is additional coverage beyond the already demonstrated newer-token deletion/overwrite outcomes.

Follow-up review recommended: false. Patched entry counts: high 0, medium 0, low 1. No unverified defect in the delivered characterization warrants another review pass.

### Verification and matrix audit

- The implementer and parent ran `npx playwright test --config _bmad-output/test-artifacts/dw-79-token-persistence/playwright.verify.config.ts`; all five scenarios passed. The final parent run passed 5/5 in 3.6 seconds. Retained JSON remained byte-identical across the complete parent runs, including the report's native event ordinals.
- Sequential control verifies sign-in owner A/v1 and final null with both listener/action writes and deletes.
- Overlapping local actions verifies listener delete, B listener put, stale action delete, then B action put; final B/v1.
- Stale clear verifies B's native put commits before the stale action delete; final null.
- Stale overwrite verifies B's native put commits before A's stale action put; final A/v1.
- Same-owner refresh verifies A/v2 commits before stale A/v1; final A/v1.
- Every matrix row has an executed passing test. All traces have complete dispatch/create/commit/read chains, zero recorded errors, zero external requests/page errors and successful drain/restoration/database deletion.
- `npm run typecheck`: passed all referenced projects.
- `npm run lint`: zero errors; three existing EventCountdown Fast Refresh warnings remain. The isolated config is loaded and executed by Playwright, outside these static-check scopes.
- `npx vitest run src/api/auth/__tests__/authServices.test.ts`: 17/17 passed after review.
- `git diff --check` and staged equivalent: passed. Production src, generated files, schema and deferred-work ledger match the canonical baseline.

### Residual limits

The result establishes actual persistence behavior conditional on controlled notification schedules. Live SDK/server scheduling, initialization/locking, automatic refresh and multi-tab delivery were not reproduced. No other browser or crash durability was tested. The harness targets the recorded Chromium/Vite development stack and one active action per method. Exceptional harness failures may have only Playwright diagnostics; permanently stalled native work relies on its outer timeout. Retained snapshots are refreshed per passing scenario, so a future partial rerun should not be treated as one complete new evidence set. The underlying production persistence behavior remains unchanged for a later coordination decision. Nothing was pushed or deployed.
