---
title: 'DW-54/55/56: Own event loads by authentication session'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
baseline_revision: 'edfb4841bcd10a1ee103e5def159d4f3f12970c5'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      Auth token persistence may race between overlapping auth events and the duplicate action-service writes.
    evidence: |-
      sessionService and actionService both write/delete the current service-worker token, and neither associates those operations with a generation. Those writers and their asynchronous IndexedDB opens predate this bundle. Reversing mocked promise completion does not demonstrate reversed real IndexedDB commits; establishing the reported late-clear outcome requires a controlled trace of actual IndexedDB operations plus actionService signOut/signIn overlap. Earlier auth delivery alone does not establish the claimed regression.
    location: >-
      src/api/auth/sessionService.ts:onAuthStateChange; src/api/auth/actionService.ts:signIn,signOut; src/sw-db.ts:storeAuthToken,clearAuthToken
    severity: medium (unverified)
  - summary: >-
      A replacement same-user session without an observed sign-out is not distinguished from a same-session update.
    evidence: |-
      setAuthUser receives user identity rather than a server session identifier, and same-user notifications deliberately preserve ownership. The previous implementation also accepted these loads. The bundle explicitly repairs requests crossing sign-out and same-account sign-in; replacement sessions without that transition are a separate pre-existing boundary.
    location: >-
      src/stores/slices/authSlice.ts:setAuthUser; src/api/auth/sessionService.ts:onAuthStateChange
    severity: medium
  - summary: >-
      A delayed initial getSession result can overwrite a newer auth-listener identity.
    evidence: |-
      App's checkAuth applies its awaited result whenever the component is mounted, without checking whether an auth notification arrived in the meantime. A stale null or different-user snapshot can overwrite the listener's newer state. Both this initialization branch and its missing notification guard are unchanged from the baseline.
    location: >-
      src/App.tsx:checkAuth
    severity: medium
---

<intent-contract>

## Intent

**Problem:** An event request started before sign-out can settle after the same account signs back in, before a successor request starts. User identity and load sequence still match, allowing prior-session data or errors into the reset store and Home/Settings completion state.

**Approach:** Give authentication lifetimes a runtime ownership version invalidated synchronously at the authentication transition. Require matching ownership when event loads settle and when Home or Settings records their outcomes; re-arm their load effects on a new session.

## Boundaries & Constraints

**Always:** Invalidate ownership on sign-out and account changes, including same-account reauthentication. Preserve ownership across same-session token refresh/user updates. Keep per-call success/failure/stale outcomes, latest-load precedence, cross-account guards, last-good lists, and ordered add/edit/delete mutation replay. Notify the app of auth changes without waiting for service-worker token storage.

**Never:** Edit the deferred-work ledger, generated database types, archived tests, or the database/service read contract. Add persistence, routing, realtime, or general session hardening of unrelated loaders or event writes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Same-account reauthentication | A load is pending; sign out and sign back in as A; no successor load starts yet | Old call returns stale; reset list/loading/error and UI settlement remain untouched | Both old success and failure are ignored |
| Successor load | New-session load starts before old request settles | New request owns the list, spinner, and notice | Old request cannot release the new spinner or overwrite its error |
| Refresh within a session | Same user gets a token refresh or metadata update | Session ownership stays stable; no extra event load is triggered | Current request can still settle normally |
| Auth token persistence pending | SIGNED_OUT or SIGNED_IN arrives while token storage is delayed | App receives the auth transition immediately and in arrival order | Storage rejection is logged without suppressing auth delivery |
| Concurrent mutation | Add/edit/delete completes during a current-session load | Existing ordered replay and date ordering remain intact | Write failures stay separate from load errors |

</intent-contract>

## Code Map

- `src/api/auth/sessionService.ts:onAuthStateChange` -- currently awaits token writes/deletes before invoking App; deliver auth first so the store transition is immediate.
- `src/stores/slices/authSlice.ts:AuthSlice, discardAccountState, setAuthUser, clearAuth` -- authoritative synchronous transitions; update runtime ownership atomically with identity/reset. A version must advance, never reset to a reused constant. The public null-user setter must use the sign-out reset path.
- `src/stores/useAppStore.ts:partialize` -- explicit allowlist already excludes auth state; read-only persistence evidence.
- `src/stores/slices/eventsSlice.ts:loadEvents` -- capture ownership before await and validate both outcomes alongside userId/latestLoadId; preserve private replay registries and write semantics.
- `src/App.tsx:eventsSettledForUserId, auth listener, events load effect` -- Home survives sign-out; replace user-only settlement with session-aware ownership and use synchronous live-store checks in callbacks.
- `src/components/Settings/EventsSettings.tsx:recordLoadOutcome, refreshEvents, handleRetry` -- protect mount, reconnect, manual stale-row refresh, and retry settlement/focus with captured ownership; render settlement only for the current session.
- `tests/unit/stores/loaderIdentityGuards.test.ts`, `signOutClearsAccountState.test.ts` -- composed-store auth and loader regressions; use real auth actions for reauthentication, not a synthetic version change alone.
- `tests/unit/stores/eventsSlice.test.ts` -- existing per-call/load supersession/mutation replay coverage; initialize the new auth field in its isolated store.
- `src/api/auth/__tests__/authServices.test.ts` -- mockable raw auth callback and token side effects for delivery-order tests.
- `src/components/Settings/__tests__/EventsSettings*.test.tsx` -- subscribable store doubles and rendered load/retry/focus assertions.
- `tests/unit/App.eventsSession.test.tsx` -- new rendered App regression boundary; retain real Home event slot rendering while stubbing unrelated services/components as needed.

## Tasks & Acceptance

**Execution:**
- [x] `src/api/auth/sessionService.ts`, `src/stores/slices/authSlice.ts` -- establish synchronous, nonpersisted session ownership at all supported auth transitions, keeping same-session updates stable.
- [x] `src/stores/slices/eventsSlice.ts` -- reject prior-session success/failure before applying any load-owned state.
- [x] `src/App.tsx`, `src/components/Settings/EventsSettings.tsx` -- capture/check session ownership, key effects and settled UI by it, and protect retry focus from previous-session completion.
- [x] `src/api/auth/__tests__/authServices.test.ts`, `tests/unit/stores/signOutClearsAccountState.test.ts`, `tests/unit/stores/loaderIdentityGuards.test.ts`, `tests/unit/stores/eventsSlice.test.ts` -- cover the matrix with deferred promises and real auth actions; retain replay and cross-account checks.
- [x] `tests/unit/App.eventsSession.test.tsx`, `src/components/Settings/__tests__/EventsSettings*.test.tsx` -- prove rendered Home/Settings ignore old success/failure, re-arm for same-account reauthentication, recover from a current result, and avoid token-refresh reloads. Exercise completion after the store auth change before React effect cleanup, plus Settings manual refresh/retry ownership.

**Acceptance Criteria:**
- Given Home or Settings has a pending event request, when A signs out and signs back in as A before that request settles, then its old response cannot display events, an empty-state claim, or a load-error notice for the new session.
- Given the new session has not started its next load, when the previous session's success or failure arrives, then the event store remains reset and the caller receives stale.
- Given a valid new-session load, when it finishes, then Home/Settings shows its events, truthful empty state, or own failure normally.
- Given an active session and concurrent event mutations or a token refresh, when its load completes, then replay, ordering, error attribution, and current ownership remain correct without an auth-refresh reload.

## Spec Change Log

## Review Triage Log

### 2026-09-11 — Review pass
- verdicts: 11 findings — high 0, medium 5, low 0, false 5, maybe-false 1
- findings:
  - `[medium]` `[patch]` Blind hunter: throwing auth delivery skips token cleanup/storage — App calls persisted auth actions and the storage adapter uses an unguarded localStorage.setItem. Guaranteed token side effects in finally while preserving the callback's rejection; added throwing-listener cases for sign-out, sign-in, and token refresh.
  - `[maybe-false]` `[defer]` Blind hunter: early login rendering lets a late clear delete the new token — both action-service and listener writes predate the change. Mock completion order alone cannot establish real IndexedDB commit order; a real storage/action overlap trace is needed. Recorded as medium, unverified.
  - `[medium]` `[defer]` Blind hunter: same-user session replacement without sign-out preserves load ownership — true for the existing user-only auth input and also true before this change; the requested sign-out/sign-in boundary is guarded. Grouped with the edge-case claim as one deferred entry.
  - `[medium]` `[defer]` Blind hunter: delayed initial getSession can replace a newer identity — checkAuth has only an isMounted guard and can apply an older snapshot. This branch is unchanged from the baseline, so the finding is pre-existing.
  - `[false]` `[reject]` Blind hunter: missing rendered A-to-B-to-A test leaves settlement unprotected — each real account switch increments ownership atomically (signOutClearsAccountState), and Home both depends on and compares that version. No intermediate render is needed; queued-result and reauthentication tests cover the changed continuation/settlement behavior without relying solely on the null callback reset.
  - `[false]` `[reject]` Blind hunter: missing captured pre-request refresh-handler test is a verification defect — refreshEvents and handleRetry check live ownership before starting work, and manual-refresh tests exercise their observable new-session settlement. An additional guard-isolation test was proposed without identifying an unprotected production behavior.
  - `[false]` `[reject]` Blind hunter: queued retry focus lacks protection — both the continuation and focus effect call the same live ownership predicate. The pending old-retry test verifies that current-session focus/lock survive. There is no missing guard or demonstrated focus defect; a separate scheduling permutation is optional coverage.
  - `[false]` `[reject]` Blind hunter: old-session cleanup could erase new-load mutation replay — unregisterLoad deletes only its unique load id, and pruning retains mutations needed by the current active load. The passing existing test 'keeps a completed add for the newer same-user load after the older load settles stale' exercises this exact cleanup/replay interaction; auth transitions do not modify those registries.
  - `[false]` `[reject]` Blind hunter: INITIAL_SESSION/USER_UPDATED omission leaves stable ownership unverified — the wrapper delivers all events unconditionally, with no separate ownership branch for these names. Real setAuthUser stability and rendered Home metadata-update tests cover the resulting behavior; INITIAL_SESSION uses the same identity action as the tested initial-session load.
  - `[medium]` `[patch]` Edge-case hunter: throwing App listener bypasses token cleanup — same verified root cause as the blind-hunter callback finding; the shared finally patch preserves side effects and callback failure.
  - `[medium]` `[defer]` Edge-case hunter: a new same-user SIGNED_IN keeps ownership — same pre-existing no-sign-out replacement boundary as the blind-hunter finding; grouped into one deferred entry.
- Verification-gap reviewer: no findings after tracing both production callers and running all 205 focused tests.
- Intent-alignment auditor: no functional divergence from the stated sign-out/same-account-sign-in scenario. Adapter, composed-store, and rendered UI tests cover cooperating boundaries; no complete browser/Supabase authentication journey was run.
- Grouped routes: 1 medium patch, 3 deferred entries (2 medium and 1 medium unverified), 5 rejected findings. No intent gaps or bad-spec loopbacks.

## Verification

**Commands:**
- `npx vitest run tests/unit/App.eventsSession.test.tsx tests/unit/stores/eventsSlice.test.ts tests/unit/stores/loaderIdentityGuards.test.ts tests/unit/stores/signOutClearsAccountState.test.ts src/api/auth/__tests__/authServices.test.ts src/components/Settings/__tests__/EventsSettings.test.tsx src/components/Settings/__tests__/EventsSettings.focus.test.tsx src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx` -- all ownership, auth, replay, and rendered regressions pass.
- `npm run typecheck` and `npm run lint` -- zero errors; report existing warnings.
- `npm run test:unit` -- composed application regression suite passes.
- `fnox exec -- npm run build` -- secret-injected production build succeeds.
- `git diff --check` -- no whitespace errors; confirm deferred-work ledger unchanged.


## Auto Run Result

Status: done

### Summary

Implemented DW-54, DW-55, and DW-56 with a runtime authentication ownership version. Sign-out and identity changes invalidate it synchronously, including when the same account signs back in before a successor event load starts. Event loads, Home/Settings completion state, and Settings retry focus check this ownership; same-session updates preserve it. Existing latest-load precedence, cross-account guards, last-good lists, and ordered mutation replay remain intact. Auth delivery precedes token persistence, and token side effects still run if the application listener throws.

### Files changed

- `src/stores/slices/authSlice.ts` — atomically advance runtime ownership on sign-out/account transitions and route the null-user setter through the full reset.
- `src/stores/slices/eventsSlice.ts` — reject old-session success and failure without changing current state.
- `src/api/auth/sessionService.ts` — notify the app synchronously and preserve token side effects and callback error propagation.
- `src/App.tsx` — associate Home's load effect and settled state with current session ownership.
- `src/components/Settings/EventsSettings.tsx` — protect mount/reconnect/manual-refresh settlement, retry locks, and focus by session ownership.
- `tests/unit/App.eventsSession.test.tsx` — rendered Home tests with real auth transitions and a real-slice event-response case.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — same-account reauthentication races before and after a successor load, plus stable refresh outcomes.
- `tests/unit/stores/signOutClearsAccountState.test.ts` — atomic version transitions, no persistence, and null-user reset coverage.
- `tests/unit/stores/eventsSlice.test.ts` — initialize ownership in the isolated fixture while retaining replay coverage.
- `src/api/auth/__tests__/authServices.test.ts` — immediate delivery, delayed/rejected storage, callback order, and throwing-listener regressions.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — rendered session-boundary, reconnect, manual-refresh, retry-lock, and focus cases with real auth actions.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` and `EventsSettings.errorIsolation.test.tsx` — initialize ownership in existing store doubles.
- This spec — implementation contract, reviewed findings, matrix audit, and completion evidence.

### Review findings breakdown

One medium patch addressed two reviewer findings with the same root cause: a throwing application listener could skip token cleanup/storage after callback delivery moved earlier. The final try/finally preserves both side effects and original callback failure; six regression cases cover successful and failed persistence across sign-out, sign-in, and token refresh.

Three follow-ups were recorded only in this spec's frontmatter: same-user session replacement without an observed sign-out, delayed initial-session application, and an unverified token-persistence ordering concern. No deferred-work ledger edits were made.

Five suggestions were rejected after code/test inspection:

- A separate rendered A-to-B-to-A permutation is not needed to establish version invalidation: real account-switch atomicity and version-qualified Home settlement are already covered.
- A captured old refresh-handler test would isolate a defensive guard; the live ownership check is present and manual-refresh tests cover the observable session boundary.
- A separate queued-focus permutation does not reveal a missing guard: the effect and continuation use the same live ownership predicate, and retry focus/lock survival is tested.
- The existing superseded-load test already verifies that stale cleanup preserves a newer load's completed mutation and ordering; auth transitions do not change those private registries.
- INITIAL_SESSION and USER_UPDATED introduce no separate ownership branch in the wrapper; real auth-action stability and rendered metadata-update tests cover their behavior.

The verification reviewer reported no gaps. The intent auditor found no functional divergence from the specified sign-out/same-account-sign-in scenario. The complete per-finding evidence is recorded in Review Triage Log.

### Follow-up review recommendation

`false` — one medium patch entry, zero high or low patches. No unresolved risk was identified in the implemented event-load ownership fix.

### Verification performed

- Focused Vitest command from Verification: 211 tests passed across 8 files after the review patch.
- `npm run test:unit`: 1,630 tests passed across 99 files after the review patch.
- `npm run typecheck`: passed all referenced projects.
- `npm run lint`: zero errors; the same three Fast Refresh warnings remain in EventCountdown.tsx.
- `fnox exec -- npm run build`: passed with decrypted build configuration; production and service-worker bundles generated.
- `git diff --check` and `git diff --cached --check`: passed.
- Deferred-work ledger content matched its baseline blob exactly throughout verification.
- Frontmatter parsed successfully as YAML with one deferred list containing all three intended entries.

### Matrix test audit

Every matrix row is covered by tests present in the passing focused JUnit report:

| Matrix row | Passing evidence |
|------------|------------------|
| Same-account reauthentication | Composed-store success/failure before any successor call; Home and Settings queued-result tests verify callback delivery before successor effects |
| Successor load | Old success/failure preserve new-session spinner and error; rendered Home/Settings recover from current-session results |
| Refresh within a session | Auth version remains stable; current load can succeed/fail; Home and Settings do not issue another load on same-user updates |
| Auth token persistence pending | Synchronous SIGNED_IN/TOKEN_REFRESHED/SIGNED_OUT delivery, reordered completion, storage rejection, and six throwing-listener paths |
| Concurrent mutation | Existing add/edit/delete replay, add-then-delete, ordering, superseded-load replay retention, cross-account isolation, and write/load error separation |

### Residual risks

The two pre-existing auth-boundary gaps and the unverified persistence-ordering concern are recorded in frontmatter for orchestration. Browser/Supabase authentication was not exercised as one live E2E journey; the adapter, real composed auth/store transitions, and rendered Home/Settings boundaries were verified independently. Nothing was pushed or deployed.
