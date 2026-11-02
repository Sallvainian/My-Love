---
title: 'DW-389/DW-400: date reminders refresh on foreground and token renewal, and plan at launch without waiting'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'd381836bc41a93c3470a16e2035fe00e4c2f28a0'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** In the native shell the date reminders re-plan on a foreground return from the saved copies only, and nothing refreshes those copies after TOKEN_REFRESHED, so a date changed on another device reaches a resumed phone only at its next cold start (DW-389). The launch plan is chained onto `refreshLocalCopies()`, whose `Promise.all` waits for the slowest refresher, so one stalled refresher holds the launch plan (DW-400).

**Approach:** On a foreground return the triggers still re-plan at once from the saved copies. While online they then also refresh the seven date-reminder copies and re-plan again, throttled to once every 5 minutes. A TOKEN_REFRESHED for the signed-in user runs the same throttled refresh-then-re-plan. At launch the plan runs at once from the saved copies, and runs again once the launch refresh settles. Both steps keep the owner/`authSessionVersion` guard. The owner decided this on 2026-11-02, superseding story 4.6's "no server refresh on foreground" for this purpose.

## Boundaries & Constraints

**Always:** Native only: on the web, and in a shell without the plugin, nothing changes — no listener, no refresh, no read (`hasNativeReminders()`). The seven kinds are exactly `DATE_COPY_KINDS`. Each refresh goes through `refreshLocalCopy(kind)` (failure-isolated). The re-plan after a refresh is for the identity captured before the refresh, so it does nothing if the account changed. `replanDateReminders` stays single-flight and still reads only saved copies. The auth listener stays synchronous and defers its work with `setTimeout(…, 0)`, because a nested auth call inside an auth-js listener can deadlock (see `useRealtimeMessages.ts:713-726`). The throttle state lives inside the `startDateReminderTriggers()` closure, so each start begins unthrottled. `refreshLocalCopies()` still runs on every signed-in start, on the web too.

**Never:** No request timeout on the partner lookup (`settingsSlice.ts:845-848`). Planning first takes that lookup off the launch plan's path, so the timeout stays out of scope. No refresh on the web foreground. No change to `refreshLocalCopies()`, the `online` handler or the refreshers. Do not edit the deferred-work ledger. Do not call `supabase.channel()`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Foreground, online, first | visible, `navigator.onLine` true | re-plan from copies at once, then the seven refreshers run, then re-plan again | refresher failures logged by localCopy, re-plan still runs |
| Foreground, online, within 5 min of last refresh (same owner) | second visible | re-plan from copies only; no refresher runs | — |
| Foreground after 5 min | clock advanced ≥ 5 min | refreshers run again | — |
| Foreground, offline | `navigator.onLine` false | re-plan from copies; no refresher runs; throttle not stamped | — |
| TOKEN_REFRESHED, signed-in user | event for store `userId` | (next task) throttled refresh of seven kinds, then re-plan | — |
| TOKEN_REFRESHED, other user / other event | user id differs, or `SIGNED_IN` etc. | nothing | — |
| Owner changes mid-refresh | account switch before refresh settles | the post-refresh re-plan for the old owner does nothing | guard in `replanDateReminders(owner)` |
| Launch, one refresher stalled | `refreshLocalCopies()` never settles | plan runs at once from the saved copies; runs again when it settles | — |

</intent-contract>

## Code Map

- `src/services/dateRemindersAtLaunch.ts` -- `DATE_COPY_KINDS` (:63), `isCurrent` (:73), `replanDateReminders(owner?)` (:136, single-flight, drops a stale owner), `scheduleDateRemindersAtLaunch(owner)` (:165), `startDateReminderTriggers()` (:176-194, visibilitychange plus the `onLocalCopyWritten` hook). Module JSDoc (:30-61) says the triggers never load from the server; update it.
- `src/App.tsx:438-448` -- launch effect `void refreshLocalCopies().then(() => scheduleDateRemindersAtLaunch(owner))`, and its comment; `:465-468` comment on the triggers effect.
- `src/services/localCopy.ts` -- `refreshLocalCopy(kind)` and `refreshLocalCopies()` (they never reject). Reuse them; do not change them.
- `src/api/errorHandlers.ts:46` -- `isOnline()` (`navigator.onLine`).
- `src/api/supabaseClient.ts` -- `supabase.auth.onAuthStateChange((event, session) => …)` returns `{ data: { subscription } }`; the pattern is at `src/hooks/useRealtimeMessages.ts:716-726`.
- `tests/unit/stores/dateRemindersAtLaunch.test.ts` -- real store, fake-indexeddb, real localCopy. Its supabase mock has `auth: {}`, which needs an `onAuthStateChange` that captures the listener and returns an unsubscribe. `setOnline` and `deferred` come from `./accountDataFixtures`, and Date is faked through `vi.setSystemTime`. The test at :649 ("from the copies and not the server") encodes the superseded rule and must be rewritten.
- `tests/unit/App.localCopyRefresh.test.tsx:244-320` -- the launch-plan cases assert that the plan waits for the refresh (`holdNextRefresh`); they change to the new behaviour.

## Tasks & Acceptance

**Execution:**
- [ ] `tests/unit/stores/dateRemindersAtLaunch.test.ts` -- FIRST, before any src change: add a case that registers a stalled refresher with `registerLocalCopy` (a `deferred`), starts `refreshLocalCopies()`, runs the launch step as App does today (`refreshLocalCopies().then(() => scheduleDateRemindersAtLaunch(owner()))`), and asserts that nothing is scheduled while the refresher is held. Run it and record in Implementation Notes that it confirms the wait. Then rewrite it to the new API (below) so that it asserts one schedule before the refresher settles and a second one after. -- DW-400 asked for this proof first.
- [ ] `src/services/dateRemindersAtLaunch.ts` -- `scheduleDateRemindersAtLaunch(owner, refreshed?: Promise<unknown>)`: when native and current, re-plan for `owner` at once; if `refreshed` is given, await it, then re-plan for `owner` again. In `startDateReminderTriggers()`, add a closure `refreshDateCopies()`. It does nothing when signed out, offline, or within `DATE_COPY_REFRESH_INTERVAL_MS` (5 min, exported) of the last refresh for the same `{userId, authSessionVersion}`. Otherwise it stamps the time, runs `refreshLocalCopy` for every kind in `DATE_COPY_KINDS` together, and then calls `replanDateReminders(capturedOwner)`. Visible → `replanDateReminders()`, then `refreshDateCopies()`. Subscribe `supabase.auth.onAuthStateChange`: on `TOKEN_REFRESHED` with `session.user.id === store userId`, `setTimeout(() => void refreshDateCopies(), 0)`. Unsubscribe in the returned stop. Update the JSDoc. -- the fix.
- [ ] `src/App.tsx` -- launch effect: `const refreshed = refreshLocalCopies(); void scheduleDateRemindersAtLaunch(owner, refreshed);`, and update both comments. -- DW-400 wiring.
- [ ] `tests/unit/stores/dateRemindersAtLaunch.test.ts` -- add cases for every row of the matrix: the throttle (second visible within 5 min runs no refresher; after `vi.setSystemTime(+5 min)` it runs again; a different owner is not throttled), offline (re-plans, no refresher, and a later online return does refresh), TOKEN_REFRESHED (refreshes and re-plans; other user and other events do nothing; nothing after stop), the owner switch mid-refresh, and the stalled-refresher launch. Detect refreshers by registering spy refreshers for the seven kinds with `registerLocalCopy` (unregister in afterEach), not through network mocks. Rewrite the :649 case as the offline/throttled form. The off-native case also asserts that no auth subscription is made. -- coverage the intent requires.
- [ ] `src/services/dateRemindersAtLaunch.ts` + `tests/unit/stores/dateRemindersAtLaunch.test.ts` -- foreground token guard (review pass 1): in the visibility handler, still re-plan at once, but call `refreshDateCopies()` only when the stored access token does not need renewal. It needs renewal when `readStoredSession()` (`src/api/authStorage.ts`) returns a session whose `expires_at` (seconds, device-relative) satisfies `expires_at * 1000 - Date.now() < 90_000`, the auth-js `EXPIRY_MARGIN_MS`; name the constant and cite auth-js. No stored session, or no `expires_at`, does not need renewal. When it needs renewal, nothing is stamped, because auth-js renews the token on its own foreground handler and the TOKEN_REFRESHED that follows does the refresh. The TOKEN_REFRESHED path keeps no such check. Tests: a foreground return with a stored token that has expired, or expires within 90 s, re-plans from the copies and runs no refresher, and a TOKEN_REFRESHED right after it does refresh. With a fresh stored token, or none, the foreground refreshes as before. Seed the stored session under `AUTH_STORAGE_KEY` in localStorage and clear it in afterEach. -- a foreground refresh made while the token is unrenewable fails every read; stamping it would throttle out the renewal that can succeed.
- [ ] `tests/unit/App.localCopyRefresh.test.tsx` -- the launch cases: with the refresh held, `scheduleDateRemindersAtLaunch` is called at once with the start's identity and the pending refresh promise. Account switch: each start passes its own identity. Online event and signed-out: unchanged. -- keeps App wiring covered.

**Acceptance Criteria:**
- Given the native shell, a signed-in user, online, and a date changed on the server, when the app returns to the foreground, then the pending reminders are re-planned from the refreshed copies without a restart.
- Given the native shell and a token renewal for the signed-in user, when TOKEN_REFRESHED fires more than 5 minutes after the last date-copy refresh, then the seven copies refresh and the reminders re-plan.
- Given one launch refresher that never answers, when the app starts signed in, then the reminders are scheduled from the saved copies straight away.
- Given the web build, when the page becomes visible, then no date-copy refresh runs (unchanged behaviour).

## Implementation Notes

- DW-400 proof, run before any src change: a stalled refresher registered with `registerLocalCopy` (a held `deferred`) plus `refreshLocalCopies().then(() => scheduleDateRemindersAtLaunch(owner()))` scheduled nothing after a 50 ms wait, and scheduled once the refresher settled. The test passed against the unchanged code, so it confirms the launch plan waits for the slowest refresher. It was then rewritten to the new API (one schedule before the refresher settles, a second after).

## Plan Change Log

### 2026-11-02 — review pass 1 (bad_plan)
- Trigger: the Quick lens found that `refreshDateCopies()` stamps the throttle before its reads run. On a resume with an expired token whose renewal first fails (network not up, or the SDK cooldown), `createSessionGuardedFetch` fails all seven reads, and the TOKEN_REFRESHED that follows minutes later is throttled out, so the stale copies stay until a foreground return at least 5 minutes later.
- Amended: Tasks gained the foreground token guard, and Design Notes say why.
- Known-bad state avoided: a foreground refresh doomed to fail consuming the 5-minute throttle window that the token renewal needs.
- KEEP: the pass-1 implementation was correct in every other respect and passed the full suite. Start by `git apply /private/tmp/claude-501/-Users-sallvain-Projects-My-Love--bmad-loop-runs-20261102-030225-b02f-worktrees-dw-date-reminders-replan-timing/7a71d837-c96b-44d2-ab23-e976658e8c40/scratchpad/pass1-keep.patch` and then add only the guard and its tests. Keep:
  - `scheduleDateRemindersAtLaunch(owner, refreshed?)` with its swallowed rejection.
  - The closure throttle keyed on `{userId, authSessionVersion}`.
  - The deferred TOKEN_REFRESHED timer that collapses a burst and is cleared on stop.
  - The spy-refresher test plumbing (`realRefreshers`, `spyOnRefreshers`, `restoreRefreshers`, `emitAuth`).
  - The rewritten App launch tests.
  - The multi-line supabase mock formatting.

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 2 findings — high 0, medium 1, low 1, false 0, maybe-false 0
- findings:
  - `[medium]` `[bad_plan]` Throttle stamped before the refresh can succeed, so a failed foreground refresh on an expired token throttles out the TOKEN_REFRESHED refresh. Verified as reachable: the auth-js PostgREST fetch awaits `getSession()`, which returns no session when a renewal inside `EXPIRY_MARGIN_MS` (90 s) fails, and `createSessionGuardedFetch` then fails every read, while `refreshLocalCopy` never rejects. The amendment adds a foreground token guard to Tasks: skip the foreground refresh, without stamping, while the stored token needs renewal.
  - `[low]` `[reject]` No in-flight guard: a refresher stalled for more than 5 minutes lets a later trigger start another round. This needs a stall longer than the 5-minute interval, which is rare in everyday use, and the fix would add a guard (more than a direct correction). A second attempt over a fresh connection is also arguably wanted.
### 2026-11-02 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` In the test "refreshes only the seven date kinds", `unregister()` deleted the store's real `love-notes` refresher for every later test in the file. The set of refreshers the real `refreshLocalCopies()` ran then depended on test order, which CI shuffles. Fixed: the `finally` re-registers `realRefreshers.get('love-notes')`.
  - `[low]` `[patch]` The throttle check `now - lastRefresh.at < interval` is also true for a negative gap, so a device clock set backwards throttled every refresh until it caught up. Fixed: the throttle applies only when `0 <= now - lastRefresh.at < interval`, and the test "treats a clock moved back before the last refresh as elapsed" covers it (it fails without the fix).

## Design Notes

The immediate re-plan on a foreground return is kept on purpose. It applies the lesson of DW-400 to the foreground: a refresh that stalls must not hold back a plan that only moves with the clock (a day passing). Each copy the refresh writes already triggers a re-plan through the write hook. The explicit re-plan after the refresh covers a refresh that writes nothing, and single-flight collapses the extra runs. The launch refresh does not stamp the throttle. On a cold start with an expired token, the launch reads can fail before TOKEN_REFRESHED arrives, and that renewal must still refresh the copies. For the same reason, a foreground return whose stored token is inside auth-js's 90 s renewal margin does not refresh or stamp: every read would wait on a renewal that may fail, and the TOKEN_REFRESHED that a successful renewal emits does the refresh instead.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/dateRemindersAtLaunch.test.ts tests/unit/App.localCopyRefresh.test.tsx` -- expected: all pass
- `npm run test:unit` -- expected: all pass
- `npm run typecheck` -- expected: exit 0 (worktree-only TS2883 noise, if present, must be identical to the baseline)
- `npm run lint` -- expected: exit 0

## Auto Run Result

Status: built

**Summary.** The date reminders in the native shell now re-plan at the right moments:
- **Launch (DW-400):** they plan at once from the saved copies, then again once the launch `refreshLocalCopies()` settles. A stalled refresher no longer holds the launch plan.
- **Foreground return, online (DW-389):** they re-plan at once, then refresh the seven date copies through `refreshLocalCopy` and re-plan again. The refresh is skipped while the stored token is inside auth-js's 90 s renewal margin.
- **TOKEN_REFRESHED for the signed-in user (DW-389):** the same refresh-then-re-plan runs, deferred to the next task. Both refresh paths share one throttle, at most once per 5 minutes per `{userId, authSessionVersion}`.
- **Offline:** a foreground return re-plans from the saved copies only.
- **Web:** unchanged.

**Files changed**
- `src/services/dateRemindersAtLaunch.ts`:
  - `scheduleDateRemindersAtLaunch(owner, refreshed?)` plans first and again after the refresh.
  - `refreshDateCopies()` carries the throttle.
  - The foreground token guard, the TOKEN_REFRESHED subscription, `DATE_COPY_REFRESH_INTERVAL_MS` and the updated JSDoc.
- `src/App.tsx`: the launch effect passes the pending refresh instead of chaining onto it; the comments are updated.
- `tests/unit/stores/dateRemindersAtLaunch.test.ts`:
  - Spy refreshers and a captured auth listener.
  - Cases for every row of the matrix, plus the token guard, a backwards clock and the stalled-refresher launch.
  - The old "from the copies and not the server" case is rewritten offline.
- `tests/unit/App.localCopyRefresh.test.tsx`: the launch cases assert an immediate call with the start's identity and its pending refresh.

**Review findings**
- Pass 1: one medium `bad_plan`, so the foreground token guard was added and the code re-derived. One low was rejected: there is no in-flight guard for a refresher stalled longer than 5 minutes, which is rare, the fix would add a guard, and a fresh attempt is arguably wanted.
- Pass 2: two low patches applied (the love-notes refresher restored in a test, and a negative clock gap counted as elapsed).
- Nothing was deferred.

**Follow-up review recommended:** false. This pass patched two `low` entries and no `high` or `medium`.

**Verification**
- DW-400 proof run first: with the old chain and a stalled refresher, nothing was scheduled until the refresher settled.
- `npx vitest run` on the two target files: 122 passed. Shuffled runs with five seeds also passed.
- `npm run test:unit`: 224 files, 3826 tests passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.

**Residual risks**
- Nothing was checked on a simulator or device. The native behaviour is covered by unit tests with a mocked plugin and auth listener.
- The partner lookup in `settingsSlice.ts:845-848` still has no request timeout. The launch and foreground plans no longer wait for it, but its own refresh can still hang.
- The 90 s margin copies auth-js `EXPIRY_MARGIN_MS` by value, so a supabase-js upgrade that changes it will not be noticed.
