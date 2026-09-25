---
title: 'Remove clock, timing and async nondeterminism'
type: 'chore'
created: '2026-09-25'
status: 'done'
baseline_revision: 'ba713da4183a68d74f6fb3b24f820084376ea001'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Fixed `await Promise.resolve()` hop counts remain in realtimeLeaveContract and moodSyncSubscription (fireReopen / replacement-SUBSCRIBED).
    evidence: |-
      Same fragility as the interactionsSubscription advisory fixed here; no catalog row names them. Found during implementation.
    location: >-
      tests/unit/api/realtimeLeaveContract.test.ts:200; tests/unit/api/moodSyncSubscription.test.ts:947
    severity: low
  - summary: >-
      dateUtils getDaysSince and formatMessageTimestamp share the elapsed-ms / 24 h DST flaw fixed in moodGrouping (G6).
    evidence: |-
      Both floor (todayMidnight - dayMidnight) / 86400000; the day after spring-forward that is 23 h, so yesterday's items read as today. No row's test exposes them; fixing needs new coverage (SPEC non-goal).
    location: >-
      src/utils/dateUtils.ts:61
    severity: medium
  - summary: >-
      e2e waitForLoadState('networkidle') gates on pages with an open Realtime socket.
    evidence: |-
      Advisory timing item; it is a readiness gate owned by story 3 (M1/readiness).
    location: >-
      tests/e2e/notes/love-notes-realtime.spec.ts:152; tests/e2e/partner/partner-mood-realtime.spec.ts:152
    severity: low
  - summary: >-
      dbSchema.test.ts fails about 1 run in 4 under --sequence.shuffle, also before this story.
    evidence: |-
      An earlier case leaves happy-dom window.location invalid, so importing src/api/supabaseClient.ts throws Invalid URL. Test isolation, owned by story 4 (H4).
    location: >-
      tests/unit/services/dbSchema.test.ts
    severity: medium
  - summary: >-
      useRealtimeMessages keeps one real setImmediate as its unhandled-rejection checkpoint.
    evidence: |-
      It is the only signal Node gives before reporting an unhandled rejection; not a catalog row. Pre-existing.
    location: >-
      src/hooks/__tests__/useRealtimeMessages.test.ts:1181
    severity: low
  - summary: >-
      interceptNetworkCall routes in partner-kit / partner-mood are still registered asynchronously and may race page.goto.
    evidence: |-
      Pre-existing: playwright-utils registers the route inside an async test.step. This story made a miss fail loudly (awaited with a 15 s timeout) instead of silently; guaranteeing registration before goto needs an awaited page.route (M9, story 6) or a library hook.
    location: >-
      tests/e2e/partner/partner-kit.spec.ts:91; tests/e2e/partner/partner-mood.spec.ts:55
    severity: low
  - summary: >-
      Review: dateUtils formatMessageTimestamp / getDaysSince DST mislabel (same as the earlier dateUtils item).
    evidence: |-
      Blind Hunter re-raised it; pre-existing app bug not exposed by any row test.
    location: >-
      src/utils/dateUtils.ts:204
    severity: medium
  - summary: >-
      Review: the remaining real setImmediate in useRealtimeMessages contradicts the literal AC 'no setImmediate waits remain'.
    evidence: |-
      Edge Case Hunter claim finding; pre-existing test design, not a catalog row.
    location: >-
      src/hooks/__tests__/useRealtimeMessages.test.ts:1181
    severity: low
  - summary: >-
      Same-class timing sites with no catalog row may still be scored by a re-review (hop-count drains, fixed act loops, live-clock start dates, lastWelcomeView stamps).
    evidence: |-
      UNVERIFIED. Intent auditor listed realtimeLeaveContract, photoImageCache, EventsSettings hop counts; PhotoGridItem.recovery and usePhotoImage act loops; couple-start-date.spec.ts:89 and couple-settings-offline.spec.ts:110,161 start dates; lastWelcomeView = Date.now() in 33 e2e files. The e2e advisories mark the last two 'not fired'. Settle by running bmad-testarch-test-review on each folder.
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Tests order steps with real sleeps and zero-delay flushes, leave promises unawaited, and build expiry/day/month fixtures from the live clock, so results depend on machine speed, midnight, month end and DST (every H1, H2 and M6 row in the five `findings-*.md` files, the normalization-removed H1/H2 rows, and the timing items in `corrections.md`).

**Approach:** Replace each sleep/flush with the deterministic signal it stands in for (the SUT's own promise, a deferred, `act`, a positive `vi.waitFor`, a Realtime sentinel), await or return every promise, and pin the clock (`vi.setSystemTime` / Playwright `page.clock.install`) before any fixture that crosses a boundary, adding the exact boundary cases the rows name.

## Boundaries & Constraints

**Always:**
- `corrections.md` overrides a row's suggested fix. Locate sites by content; catalog lines are from 92f1c517 and story 1 moved many.
- Keep or strengthen what each test proves. Where a sleep guarded a negative assertion, the replacement must still let the assertion fail if the behaviour breaks (add a positive control when the negative could pass vacuously).
- Vitest clock pinning: `vi.setSystemTime(NOW)` (fakes only `Date`) or `vi.useFakeTimers({ toFake: [...,'Date'] })`, always undone by `vi.useRealTimers()` in `afterEach`/`finally`. Never fake `setImmediate` in a file that touches IndexedDB (fake-indexeddb schedules on it). A later `useFakeTimers({toFake})` that omits `'Date'` un-pins the clock — include `'Date'`. With RTL `waitFor`, fake only `Date`.
- Playwright clock pinning: `page.clock.install({ time: anchor })` (and `context.clock` for a second context) before the first `goto`, with `anchor` at or BEHIND real time, never ahead (see `tests/e2e/home/events-read-window.spec.ts` header: a clock ahead of the session makes supabase-js refresh the token).
- One commit per group G1–G9 (Code Map), `test(scope): ...`; the app bug in G6 is its own `fix(mood): ...` commit. Every commit ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- E2E imports `{ test, expect }` from `tests/support/merged-fixtures.ts`. A new raw `page.route` carries a same-line or preceding `// playwright-utils deviation: <reason>` comment. Fictional fixture values only. Match surrounding style by hand; never run `prettier --write`. New `eslint-disable` lines carry ` -- reason`.

**Never:**
- Weaken, skip or delete a test to pass a rule; delete one only where another covers it (G4 backgroundSync merge).
- Touch other stories' rows: M1/readiness gates and `waitForLoadState('networkidle')` (story 3), H4 except the `useRealtimeMessages` `userId` restore that `corrections.md` bundles with its sleeps (story 4), `fireEvent`→user-event (story 5), M9/L9 beyond the deviation comment above (story 6), H5 splits (story 9). No `tests/e2e-archive/`, pgTAP, `database.types.ts`, or `node_modules` symlink.
- Add ESLint rules or change Vitest/Playwright config.
- Pin an expected value you have not observed: values marked UNVERIFIED in the Code Map are confirmed by one run first.

</intent-contract>

## Code Map

Anchors are current-tree lines from planning (approximate; find by content).

### G1 — api H1 (`test(api): prove non-delivery with sentinels, not sleeps`)
- `tests/api/couple-broadcast-authorization.spec.ts` — three `setTimeout(resolve, NON_DELIVERY_GRACE_MS)` (~305, ~411, ~454). Listeners collect via `join()` (~101-118, hard-codes `broadcast: { self: false }` ~111). M6 `log.info` rows are already fixed by story 1 (none remain) — nothing to do.
  - ~305: delete the sleep and the `toHaveLength(0)`; the following partner `httpSend` of `real-1` + poll + exact `toEqual([...real-1])` (~309-319) is the sentinel — a forged note arriving first fails `toEqual`. Retitle the step to say it proves non-delivery.
  - ~411: after `private-1` is observed, send a PUBLIC sentinel on `love-notes:<victim>` that reaches the anon `eavesdrop` channel (e.g. `partner.channel(topic, { config: { private: false } }).httpSend(...)` or the anon bulk POST shape at ~432-449 with `private: false`); poll `eavesdrop.received.length >= 1`, assert `toEqual([sentinel])`. UNVERIFIED that a public REST broadcast is delivered locally — confirm by running; if not, use any public-path send that verifiably reaches `eavesdrop` (e.g. a second anon client's websocket send with `ack: true`).
  - ~454: give `join()` a `broadcast` option so the eavesdropper's websocket injection uses `ack: true` (its `send()` then waits for the server); after both injections, partner `sender.httpSend` a private sentinel, poll `listener.received.length >= 2`, assert `toEqual([private-1, sentinel])`. Drop `NON_DELIVERY_GRACE_MS` if unused.

### G2 — e2e H2 (`test(e2e): pin the page clock for calendar-day fixtures`)
- Add `clockAnchor(now = new Date()): Date` to `tests/support/helpers/events.ts` next to `isoDateDaysFromNow` (~178): the latest local 12:00 at or before `now` (12 h from both midnights, 0–24 h behind real time). Docblock cites events-read-window's behind-never-ahead rule. Real `Date` construction from components only.
- Server reads no clock for these (no `now()` CHECKs; birthday "in the past" is client-only, `src/components/Settings/Settings.tsx` ~170), so pinning the page is sufficient.
- `tests/e2e/account-data/account-data.spec.ts` ~171-176 (local mood `formatDateISO(now)` seeded in-page): `page.clock.install({ time: anchor })` before `page.goto('/')` (~166); in-page seeding then reads the pinned clock.
- `tests/e2e/home/events.spec.ts` ~249 (`isoDateDaysFromNow(0)`, asserts "Today!"): `const anchor = clockAnchor()`, seed `isoDateDaysFromNow(0, anchor)`, install before the goto (~255).
- `tests/e2e/home/persisted-events-strip.spec.ts` ~139-150 + `tests/support/helpers/persisted-blob.ts` ~184 (`stalePersistedMood()` dated `new Date()`): install anchor before goto (~154), pass `{ date: formatDateISO(anchor), timestamp: anchor.toISOString() }` (or add an `anchor` param).
- `tests/e2e/offline/mood-offline-copy.spec.ts` ~42-48 (`earlierThisMonth()` from `new Date()`): take `anchor`, install before goto (~168); reload keeps the clock.
- `tests/e2e/offline/birthdays-wedding-offline.spec.ts` ~28-34 (`localDateIn(days)`; asserts '4 days'/'9 days'/'39 days' ~137-148): `localDateIn(days, anchor)`, install before goto (~117). If the fixture can land on Feb 29 for some anchors, derive the dates so the asserted counts hold for every anchor (UNVERIFIED — check the arithmetic).
- `tests/e2e/settings/birthdays-wedding.spec.ts` ~25-38 (dates built in `partnerPage`, '9 days'/'39 days' asserted on `page`): one `anchor`, `page.clock.install` and `partnerContext.clock.install` before each context's first goto; build the dates in Node from `anchor`.

### G3 — e2e M6 (`test(e2e): await network stubs and route fulfils`)
- playwright-utils `interceptNetworkCall` registers its route asynchronously (inside `test.step`, `await page.route`), resolves on the first matching request, never unroutes, and with no `timeout` stays pending forever if never hit.
- `tests/e2e/partner/partner-kit.spec.ts` ~91, 99, 107, 112 (content stubs) and ~190, 198: store each promise, `await Promise.all([...])` after the triggering `goto` (~120, ~206), each with `timeout` (repo pattern: `tests/e2e/partner/partner-mood.spec.ts` ~27-37; `tests/e2e/settings/events-load-recovery.spec.ts` ~178-192).
- `tests/e2e/partner/partner-mood.spec.ts` ~55, 63, 71, 80: same; await after the goto (~88).
- `tests/e2e/auth/login.spec.ts` ~86, 101, 110, 129 (loop over 7 tables): defensive stubs that may be hit zero or many times — replace with `await page.route(...)` using the `serve` pattern in `tests/e2e/auth/logout.spec.ts` ~223-235 (GET → `route.fulfill`, else `route.fallback()`), with a `// playwright-utils deviation:` comment (interceptNetworkCall hangs when never hit).
- Return the fulfil from route handlers: `tests/e2e/auth/google-oauth.spec.ts` ~37-43, `tests/e2e/navigation/dock.spec.ts` ~127-133, `tests/e2e/photos/photo-gallery.spec.ts` ~78-84.

### G4 — src H1/M6 (`test(src): replace hard waits with deterministic signals`)
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx`: `settle()` (~341, real 10 ms) at ~430, ~446, ~473 and inline 10 ms sleeps at ~761, ~817, ~851; 100 ms `setTimeout` mock ~265-267. React 19 async `act` drains all microtasks via `setImmediate`, so `await act(async () => { d.resolve(x); await d.promise; })` reaches every continuation (checked against `LoveNoteMessage.tsx` ~186-230, ~272). Hoist `deferred` (~333) to file scope; add `act` import.
  - ~430/~446: resolve inside `act` as above. ~473: replace with a positive `waitFor` on the preview `img` `src` (as ~254). ~761/~817: resolve inside `act`. ~851: `await act(async () => { reject(err); await p.catch(() => {}); })`, then assert `console.error` was called with `'[LoveNoteMessage] Failed to get signed URL:'` and the state setter was not. ~265: return a deferred's promise, resolve it inside `act` after the spinner check, assert the `img` `src` and that the spinner is gone. Keep `stateSetterCalls.mockClear()` before `unmount()`. Delete `settle`.
- `src/hooks/__tests__/usePartnerMood.test.ts` ~157-164 (100 ms after foreign broadcast): callback is synchronous (`usePartnerMood.ts` ~82-88). `act(() => cb(otherUserMood))`, assert unchanged; then `act(() => cb(partnerMood2))` (partner's `user_id`), assert updated — separate `act`s.
- `src/hooks/__tests__/useRealtimeMessages.test.ts` ~431-459 (two 50 ms sleeps; `userId = null` restored only at end): gate is synchronous (`useRealtimeMessages.ts` ~240). Pattern at ~229-237: `vi.useFakeTimers()` + `await act(async () => { ...; await vi.runOnlyPendingTimersAsync(); })` in try/finally. Assert `supabase.channel`/`setAuth` not called, then positive control: `rerender` with `enabled: true` / `userId` restored → channel called once (UNVERIFIED; if an earlier `mockReturnValue` interferes, do the enable half on real timers with `waitFor`). Add `mockStoreState.userId = USER_ID` to the top-level `beforeEach` (~119-128) and drop the manual restore. Also ~204, ~387: drop `setTimeout(resolve, 0)` inside async `act` (act already drains). Never mix RTL `waitFor` with full fake timers.
- `src/utils/__tests__/backgroundSync.test.ts` ~343-359 (unawaited `registerBackgroundSync`, 50 ms sleep; `await` hangs because `ready` never settles — corrections): `ready = deferred()`; `const run = registerBackgroundSync('stuck-tag')`; `expect(await Promise.race([run, Promise.resolve(PENDING)])).toBe(PENDING)`; `register` not called; `ready.resolve(mockRegistration)`; `await expect(run).resolves.toBeUndefined()`; `register` called with `'stuck-tag'`. Rename to "waits for the service worker to become ready before registering". Copy `deferred` from `src/api/auth/__tests__/authServices.test.ts` ~55-63. This covers the ~174-187 test whose `ready` resolves via a real 100 ms `setTimeout` (~182) — merge/delete that one.
- `src/api/auth/__tests__/authServices.test.ts` ~67 `flushPersistence` (`setTimeout(0)`, used ~182-345): replace each use with awaiting the observable effect (`vi.waitFor` on the positive expectation, or the deferred the test controls); same zero-delay class as the unit rows.

### G5 — src H2 (`test(src): pin the clock for time-bound fixtures`)
Pin with `vi.setSystemTime` (or `useFakeTimers({ toFake: ['Date'] })`, as `src/components/MoodTracker/__tests__/MoodTracker.todayLabel.test.tsx` ~104-112), `afterEach(vi.useRealTimers)`; build fixtures from date components. TZ is `America/New_York` (`vitest.config.ts` ~36-38).
- `MoodHistory/__tests__/MoodHistoryCalendar.storeReload.test.tsx` ~32-45: pin 2026-09-25 12:00; `TODAY='2026-09-25'`; expect '1 mood logged this month', `calendar-day-2026-09-25` `data-has-mood="true"`.
- `MoodTracker/__tests__/MoodHistoryTimeline.test.tsx` ~52-74: pin 2026-09-25 21:00; fixtures 08:30/20:15/12:00 that day; one 'Today' header; add 2026-09-24 22:00 → 'Yesterday'.
- `PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` ~53-57, ~189-194: pin 2026-09-25 12:00; '2026-09-25' 09:15 → `/Today · 9:15 AM/`; add '2026-09-24' → Yesterday, '2026-09-23' → `Wednesday 23 September`.
- `PokeKissInterface/__tests__/PokeKissInterface.test.tsx` ~394-403 (`RATE_LIMIT_MS` 30 min, `PokeKissInterface.tsx` ~37, 1 s interval ~106-113): `toFake: ['Date','setInterval','clearInterval']`, T=2026-09-25 12:00:00, `lastPokeTime=T-60_000` → `poke-cooldown` exactly '29:00'; after `act(() => vi.advanceTimersByTime(1000))` '28:59'; add `T-1_800_000` → enabled, no cooldown; `T-1_799_000` → '0:01', disabled.
- `Settings/__tests__/Settings.birthdayWedding.test.tsx` ~89-103: pin 2026-09-25 12:00 before render; '2026-09-25' → `/in the past/i`, no save; add '2026-09-24' → `save('2026-09-24')` and input `max='2026-09-24'`. Wedding date ~165 → '2027-06-12'.
- `Settings/__tests__/Settings.togetherSince.test.tsx` ~125-143 (`Settings.tsx` ~145: `value > Date.now()`): pin 2026-09-25 12:00:00.000; '2026-09-25'+'12:01' refused; '12:00' accepted → `save('2026-09-25T16:00:00.000Z')`; '2026-09-26' no time refused; '2026-09-25' no time → `save('2026-09-25T04:00:00.000Z')`.
- `utils/__tests__/dateUtils.test.ts` isJustNow ~52-62 (`diffMs < 300000`): pin 2026-03-15 12:00; T-299_000 true, T-300_000 false, T-301_000 false. `formatRelativeDate` 'today' ~69-75: fixed `new Date(2026, 2, 15, 12)` / `(2026, 2, 15, 1)`.
- `utils/__tests__/moodGrouping.test.ts` ~7-104 (`Date.now() - n*86400000`; corrections DST item): pin 2026-09-25 12:00; `(2026,8,25,9)` → 'Today', `(2026,8,24,21)` → 'Yesterday', `(2026,8,22,12)` → exactly 'Sep 22'. DST cases (fail on current code, pass after G6): now 2026-03-09 00:30 — Mar 8 12:00 → 'Yesterday', Mar 7 12:00 → 'Mar 7'; now 2026-11-01 23:30 — Nov 1 00:30 → 'Today', Oct 31 12:00 → 'Yesterday'.

### G6 — app bug exposed by G5 (`fix(mood): label mood days by calendar day across DST`)
- `src/utils/moodGrouping.ts` ~64-66 `getDateLabel`: `Math.floor((now - localMidnight) / 86400000)` mislabels around DST. Replace with a calendar-day difference, e.g. `Math.round((Date.UTC(ny,nm,nd) - Date.UTC(y,m,d)) / 86400000)`. Commit G6 before G5 so every commit is green; show the red run against the unfixed code (see ACs). `dateUtils.ts` `getDaysSince` (~204-211) and `formatMessageTimestamp` (~61-65) share the flaw but no row's test exposes them — record as `deferred`, do not fix.

### G7 — unit H2 (`test(unit): pin the clock for time-bound fixtures`)
Default `NOW = new Date('2026-09-15T16:00:00.000Z')` (noon EDT) via `vi.setSystemTime` in `beforeEach`, `vi.useRealTimers()` in `afterEach`. In files using `vi.waitFor`, use bare `setSystemTime` (waitFor advances fake timers).
- `tests/unit/App.callbackNotice.test.tsx` ~146, `App.eventsSession.test.tsx` ~186 (+ event fixture ~168-177 → `new Date(2026, 8, 22)`, `createdAt: NOW`), `App.localCopyRefresh.test.tsx` ~153 (and add `'Date'` to the `toFake` lists at ~282, ~298): `lastWelcomeView = String(NOW.getTime())`.
- `tests/unit/api/supabaseClientAuthFlow.test.ts` ~67, 76: pin a whole-second NOW in `beforeEach` (~101); GoTrue reads `Date.now()`.
- `tests/unit/services/moodNormalization.test.ts` ~158, 169; `moodService.test.ts` ~128, 146-149, 187, 452, 461-464; `stores/moodSlice.test.ts` ~89-92 (pin in top-level `beforeEach` ~99).
- `tests/unit/services/swMoodSync.test.ts` ~185, ~250 (`src/sw.ts` ~224-225 skips when `expiresAt < now + 300`): pin 2026-01-26T12:00:00Z (`nowSec` 1769428800); add `expiresAt: nowSec+299` → `getPendingMoods` not called; `nowSec+300` → called.
- `tests/unit/stores/coupleSettings.test.ts` ~375 (`messageRotation.ts` ~67 floors elapsed ms): start `'2026-09-10T15:59:00.000Z'`; add exactly 5 days (`16:00:00.000Z`: index 5 cannot go back, 4 can) and `16:00:00.001Z` (4 days: index 4 cannot).
- `tests/unit/stores/notesSlice.offlineQueue.test.ts` ~1086 `atLimit()` (window `now - ts < 60000`, cap 10): pin in that describe only (~1270 fakes `setTimeout` — include `'Date'`); 10×`NOW-59_999` → rate-limit rejection; 10×`NOW-60_000` → sends, `sentMessageTimestamps` = `[NOW.getTime()]`.
- `tests/unit/stores/updateCurrentMessageStaleCache.test.ts` ~46: `NOW = new Date(2026, 8, 22, 12)`, `TODAY = '2026-09-22'`; in the cached-id case add the precondition that the rotation for NOW is not id 3.
- `tests/unit/utils/messageRotation.test.ts` ~187-193: pin `new Date(2026, 8, 22, 12)`; add `(2026,8,22,0,0,0,0)` → false, `(2026,8,21,23,59,59,999)` → true.

### G8 — unit H1 sleeps (`test(unit): await quiescence signals instead of sleeping`)
- `tests/unit/api/ephemeralBroadcast.test.ts` `settle()` ~213-233 and `flush()` ~196-198 (+ step flushes ~353-452): each send's returned promise settles after its own leave (`ephemeralBroadcast.ts` ~141, ~163-182). Give the fake an `autoAckLeaves` flag and one-shot signals (`nextChannelOpened`/`nextSendParked`/`nextLeaveRequested`, created before the trigger); `settle` = release gates, ack leaves, `await Promise.allSettled(sends)`; clear the fake's 40 ms window timer in `afterEach`. No `vi.waitFor` with fake timers here.
- `tests/unit/api/moodSyncSubscription.test.ts` `settleLeaves()` ~278-294, flush ~274 (+ ~501, 535, 682-913): end signal is the subscriber's own promise; `afterEach` acks and awaits recorded `removeChannel` promises; ~501/535 `vi.waitFor(() => expect(setAuth).toHaveBeenCalledTimes(2))`; identity-refresh flushes: mocked lookups push their promises into arrays and the test awaits the last (`moodSyncService.ts` ~523, ~543 await the same promise first).
- `tests/unit/stores/signOutClearsAccountState.test.ts` ~832 (50 ms): deletion is the synchronous fire-and-forget `deleteAccountData` in `setAuthUser` (`authSlice.ts` ~60-67, ~414-416). Wrap `deleteAccountCopies`/`deleteAccountImages` with pass-through `vi.fn`s (partial mocks); assert not called right after `setAuthUser`, keep the IndexedDB read-back; the sibling test (~802) asserts they were called with the owner id.

### G9 — unit zero-delay flushes (`test(unit): replace zero-delay flushes with awaited signals`)
Rows: `services/accountDataCreateRetry` ~161; `stores/eventsSlice.localCopy` ~124; `interactionsSlice.localCopy` ~114; `loaderIdentityGuards` ~239; `notesSlice.idempotency` ~509; `notesSlice.localCopy` ~194; `notesSlice.offlineQueue` ~209; `notesSlice.removal` ~297, ~437; `notesSlice.sessionGuard` ~106; `photosSlice.localCopy` ~107; `settingsSlice.initializeApp` ~67; `helpers/rls-security` ~183. Delete each flush helper; at each call site use (A) `vi.waitFor` on the positive effect the next line asserts or the action's own promise, (B) delete a no-op flush, (C) `vi.waitFor` on a call count/counter at the point the code waits, (D) for "never happens": await the action's promise or the mock's recorded promise, recording `store.subscribe` history if needed. Site notes:
- accountDataCreateRetry: `vi.waitFor(() => expect(fake.plan).toHaveLength(0))` before `abort()`.
- notesSlice.idempotency: `vi.waitFor(() => expect(mockedGetPartnerId).toHaveBeenCalled())`.
- notesSlice.offlineQueue (real IndexedDB): `vi.waitFor` async read-backs; the "queued notes never in the copy" negative (~415) awaits `writeLocalCopy`'s recorded promise via a pass-through mock.
- notesSlice.sessionGuard: first flush → `vi.waitFor` on the call count (as ~309); post-sign-out flushes likely removable (UNVERIFIED — run the file ~20× with `--repeat`/loop). Fix the `afterEach` comment (~137-141): deletes do not go through the account-data queue.
- notesSlice.removal ~437: `vi.waitFor(() => expect(backend.releaseHeldRead).not.toBeNull())`.
- rls-security ~183: `deleteUser` returns a controllable thenable that resolves a `cleanupAwaited` promise when its `then` is called; `await Promise.race([cleanupAwaited, outsider.catch(() => {})])`; then `settled` not called (settled is attached first, so an early rejection fails this).
- `tests/unit/stores/interactionsSubscription.test.ts` `flushMicrotasks` ~61-65 (used ~395, ~440) and ~503-504 (fixed hop counts; ~503 has zero slack — deferred from story 1): mocked `resolvePartnerLookup` pushes its promise to `lookups[]`; `await lookups.at(-1)` (the SUT's `.then` was registered first). Delete `flushMicrotasks`.
- `tests/unit/services/dbSchema.test.ts` ~47-49 and `dbSchema.indexes.test.ts` ~29-31: await `deleteDatabase` using the helper shape in `storageSchema.test.ts` ~69-76.

### Deferred (no commit) — record in frontmatter `deferred`: `realtimeLeaveContract.test.ts` ~200-391 and `moodSyncSubscription.test.ts` ~947, ~1069 fixed `Promise.resolve()` hop counts (no catalog row); `dateUtils.ts` DST flaw (G6); e2e `networkidle` (story 3).

## Tasks & Acceptance

**Execution:**
- `tests/api/couple-broadcast-authorization.spec.ts` -- G1 sentinels -- H1 rows.
- `tests/support/helpers/events.ts`, `tests/support/helpers/persisted-blob.ts`, the six G2 specs -- anchor + `page.clock.install` -- H2 rows incl. normalization rows.
- `tests/e2e/auth/login.spec.ts`, `partner/partner-kit.spec.ts`, `partner/partner-mood.spec.ts`, `auth/google-oauth.spec.ts`, `navigation/dock.spec.ts`, `photos/photo-gallery.spec.ts` -- G3 -- M6 rows and unreturned fulfils.
- G4 src files (`LoveNoteMessage`, `usePartnerMood`, `useRealtimeMessages`, `backgroundSync`, `authServices` tests) -- deterministic signals -- H1/M6 + corrections.
- `src/utils/moodGrouping.ts` -- G6 calendar-day fix, own `fix(mood)` commit -- exposed by G5 DST cases.
- G5 src test files -- pinned clock + boundary cases -- H2 + corrections DST item.
- G7 unit files -- pinned clock + boundary cases -- H2 + corrections `updateCurrentMessageStaleCache`.
- G8 unit files -- quiescence signals -- H1 + corrections 50 ms sleep.
- G9 unit files -- awaited signals -- normalization H1 rows + advisories.
- `_bmad-output/specs/spec-test-review-remediation/stories/2-remove-clock-timing-and-async-nondeterminism.md` frontmatter `deferred` -- the Deferred items.

**Acceptance Criteria:**
- Given the changed test files, when grepping them for `setTimeout(` / `setImmediate` used to wait in a test body or helper (timers inside fakes that model the SUT, and bounded positive polls, excepted), then none remain; and no `interceptNetworkCall(` or `log.*(` call in `tests/e2e`/`tests/api` is unawaited and unstored.
- Given every H2 site, when the test runs, then every asserted date/duration derives from a pinned instant, never the live clock, and each named boundary case (just inside / just outside) exists and passes.
- Given the moodGrouping DST cases, when run against the pre-G6 `getDateLabel`, then they fail; after G6 they pass (record the command and failing assertion in the Auto Run Result).
- Given the replaced sleeps guarding negatives (LoveNoteMessage, usePartnerMood, useRealtimeMessages, backgroundSync, signOutClearsAccountState, rls-security, interactionsSubscription), when the guarded behaviour is broken locally (e.g. remove the `ownsSession()` guard, stop awaiting `ready`/cleanup), then the test fails; restore afterwards (never commit a break). Record one break per file in the Auto Run Result.
- Given the whole story, when lint, typecheck, unit and the changed e2e/api specs run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- verdicts: 32 findings — high 0, medium 3, low 21, false 7, maybe-false 1
- findings:
  - `[low]` `[patch]` Blind: sentinel non-delivery proofs assume in-order delivery across senders — true on the single-node local stack, not guaranteed; header "Sentinel assumption" paragraph added and referenced from all three sites (79c08ab5).
  - `[low]` `[patch]` Blind: clockAnchorAvoidingLeapDay steps back once; adjacent offsets can still hit 29 Feb — now loops, docblock corrected (f81eb147).
  - `[low]` `[patch]` Blind: new date helpers untested — cases added to tests/unit/helpers/events.test.ts (noon boundary, month/year end, adjacent-offset leap step, throw); the adjacent case fails on the old one-step version.
  - `[low]` `[defer]` Blind: partner-kit/partner-mood interceptNetworkCall routes still register asynchronously before goto — pre-existing race; this story made a miss loud (awaited, 15 s timeout); deferred.
  - `[false]` `[reject]` Blind: moodSyncSubscription teardown no longer waits for quiescence — every subscribe promise is awaited inside its test (e.g. :375, :464, :639), and leaves requested after `autoAckLeaves` is set ack synchronously inside the executor, so nothing is left parked.
  - `[low]` `[patch]` Blind: lastLoadSettled / partnerLookups.at(-1) can resolve on a missing call — lastLoadSettled now throws with no recorded run; each at(-1) wait is preceded by a length assertion.
  - `[low]` `[reject]` Blind: setAuth wait in moodSyncSubscription (~544, ~580) relies on vi.waitFor's poll interval — the first synchronous check always fails before B's microtasks run, so at least one macrotask always passes and the negative is evaluated after B parks; a precise signal needs new fake instrumentation, not worth it.
  - `[false]` `[reject]` Blind: backgroundSync race cannot tell a non-waiting implementation — an implementation that does not await `ready` completes synchronously, so its already-settled promise wins the race (array order) and the PENDING assertion fails; the final `register('stuck-tag')` assertion also fails (break check recorded).
  - `[medium]` `[defer]` Blind: dateUtils formatMessageTimestamp/getDaysSince keep the DST flaw — pre-existing app bug no row's test exposes; recorded in `deferred`.
  - `[low]` `[patch]` Blind: getDateLabel docblock example `new Date('2024-11-15')` is Nov 14 in New York — now `new Date(2024, 10, 15)` (dcebf928).
  - `[low]` `[patch]` Blind: PokeKiss cooldown never ticks to expiry — case added from T-1_799_000, advance 1 s, tile enabled and cooldown gone.
  - `[low]` `[patch]` Blind: wedding test pinned the clock after render — pin moved before render.
  - `[low]` `[patch]` Blind: notes duplicate-write negative had no positive control — a fresh note now asserts writeLocalCopy called once synchronously.
  - `[low]` `[patch]` Blind: ephemeralBroadcast settle() left gateSends/autoAckLeaves changed — saved and restored in a finally.
  - `[low]` `[patch]` Blind: duplicated deferred()/deleteDatabase helpers and onblocked resolving early — onblocked now rejects (grouped with the Edge rows; 5/5 runs never hit it); the helper-duplication part is rejected as a pre-existing 26-copy pattern whose fix is a shared-module refactor.
  - `[low]` `[patch]` Edge: adjacent leap-day offsets throw after one step — same fix as the Blind leap-day row.
  - `[low]` `[patch]` Edge: "one step is always enough" docblock claim false — corrected with the loop.
  - `[medium]` `[patch]` Edge: first-SUBSCRIBED "no second round-trip" check passes vacuously for a trailing lookup — now asserts one extra session read and a second delivered mood; fails "expected 2 to be 1" with the regression applied, source restored (38d48d49).
  - `[low]` `[patch]` Edge: dbSchema.test.ts deleteDatabase onblocked resolves before deletion — now rejects.
  - `[low]` `[patch]` Edge: dbSchema.indexes.test.ts deleteDatabase onblocked resolves before deletion — now rejects.
  - `[low]` `[defer]` Edge: AC says no setImmediate waits remain but useRealtimeMessages:1181 keeps one — pre-existing unhandled-rejection checkpoint, not a row; deferred.
  - `[medium]` `[patch]` Verification-gap: weakened first-SUBSCRIBED check in moodSyncSubscription — same entry as the Edge medium; patched there.
  - `[low]` `[patch]` Verification-gap (other): clockAnchorAvoidingLeapDay docblock — same entry as the leap-day rows.
  - `[maybe-false]` `[defer]` Intent: same-class sites with no row (hop counts, act loops, live-clock start dates, lastWelcomeView) left alone — whether a re-review scores them is unknown; settle by running the four folder re-reviews; deferred as medium (unverified).
  - `[low]` `[reject]` Intent: the e2e clock anchor still derives from the live clock's day — asserted relations (day counts, "today") are fixed and cannot flip mid-run; a fixed calendar date would put the page clock arbitrarily far behind server timestamps and collide unique created_at rows across reruns.
  - `[low]` `[reject]` Intent: login.spec now uses raw page.route under one deviation comment — the comment precedes the helper and route block as the spec requires; M9 scoring is story 6's.
  - `[low]` `[patch]` Intent: API sentinels prove "nothing before the sentinel" — same entry as the Blind ordering row; assumption documented.
  - `[false]` `[reject]` Intent: some negatives watch calls rather than outcomes — each keeps an outcome check too (signOut keeps the IndexedDB read-back; usePartnerMood asserts state; rls-security asserts the rejection).
  - `[false]` `[reject]` Intent: work outside a rows-only reading — advisories are in scope per every findings header ("including advisories"); no bad outcome named.
  - `[false]` `[reject]` Intent: the useRealtimeMessages :162 order-dependence item not done — it is the H4 isolation row, owned by story 4; this story's intent is H1/H2/M6 plus timing items.
  - `[false]` `[reject]` Intent: verification not shown and spec untracked — lint, typecheck, unit and Playwright were run by the orchestrator (see Auto Run Result); the spec is committed at finalize.
  - `[false]` `[reject]` Intent: commit grouping mixes unscored fixes into G3/G4 — grouping follows the Code Map's G1–G9; no defect named.

## Design Notes

- Why sentinels prove non-delivery: forbidden and sentinel messages travel to the same listener after the forbidden call has returned (`httpSend` rejects on non-202; websocket `send` with `ack: true` waits for the server), so the sentinel's arrival bounds when a leak would have landed; an exact `toEqual` on the received list then fails on any leak.
- `clockAnchor` shape:
  ```ts
  export function clockAnchor(now: Date = new Date()): Date {
    const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    if (anchor > now) anchor.setDate(anchor.getDate() - 1);
    return anchor;
  }
  ```

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: no errors other than worktree-only TS2883 in `tests/support/merged-fixtures.ts`.
- `npx vitest run <each changed file>` then `npm run test:unit` -- expected: all pass; also run the G8/G9 files with `--sequence.shuffle` once.
- `npx playwright test <each changed e2e/api spec>` (local Supabase running; api spec in the `api` project) -- expected: all pass; run the G1 spec and the G2 specs with `--repeat-each=3`.

## Auto Run Result

- G6 red run: `npx vitest run src/utils/__tests__/moodGrouping.test.ts` with the new DST cases and the pre-G6 `getDateLabel` gave 2 failed and 6 passed. "after the 23-hour spring-forward day" expected 'Yesterday' but got 'Today'. "late on the 25-hour fall-back day" expected 'Today' but got 'Yesterday'. After G6, 8 of 8 pass.
- Break checks. Each break was applied to the source, run, and reverted; none was committed.
  - LoveNoteMessage: removing the post-download `ownsSession()` return fails the account-switch case. Removing the `isMounted` checks in `showSignedUrl` fails 2 unmount cases.
  - usePartnerMood: removing the `user_id === partnerId` filter fails the different-user case.
  - useRealtimeMessages: removing `!enabled` fails "not subscribe when enabled is false". Removing `!userId` fails the not-authenticated case. Removing the `cancelled` checks fails 4 unmount cases.
  - backgroundSync: not awaiting `ready` fails "waits for the service worker to become ready before registering".
  - signOutClearsAccountState: deleting a leftover owner's data even when the owner is the one signing in fails "a fresh boot ... deletes nothing".
  - rls-security: not awaiting cleanup fails "waits for cleanup to finish" (`settled` was called).
  - interactionsSubscription: removing the identity re-check in the reconnect `.then` fails "does not let a reconnect refresh write the snapshot after sign-out".
- Deviations from the Code Map:
  - G1 ~411: the public sentinel comes from a second anon client. `partner.channel(topic)` returns the partner's existing private channel for that topic. A public REST broadcast was confirmed to reach a public subscriber on the local stack.
  - G2 birthdays: the date is not moved off 29 February, because that would change the asserted day count. `clockAnchorAvoidingLeapDay` steps the anchor back a day at a time until no offset lands on 29 February (adjacent offsets can need more than one step); `tests/unit/helpers/events.test.ts` covers it. That keeps every offset exact, and the anchor stays behind real time.
  - G7 updateCurrentMessageStaleCache: the rotation for 2026-09-22 picks id 3, so the cached-id case seeds id 1.
  - G8 ephemeralBroadcast: with an immediate manual ack, a queue that does not wait for the leave still passed the leave test. That test now acks the leave on a later task, through the fake's `ackLeavesOverNetwork` mode.

**Summary:** Every H1, H2 and M6 row in the five findings files (including the 29 normalization-removed rows) and the story-2 timing items in `corrections.md` are fixed. Sleeps and zero-delay flushes are replaced with the signal they stood in for (the SUT's promise, deferreds, async `act`, positive `vi.waitFor`, recorded mock promises, Realtime sentinels); unawaited stubs and route fulfils are awaited/returned; clock-bound fixtures run on a pinned clock (`vi.setSystemTime` in Vitest, `page.clock.install` at a noon anchor behind real time in e2e) with the named just-inside/just-outside boundary cases. One real app bug was exposed and fixed: `getDateLabel` mislabelled mood days around DST.

**Commits (9):** G1 79c08ab5 `test(api)`, G2 f81eb147 `test(e2e)` clock, G3 2e8e65a6 `test(e2e)` stubs, G4 7a282df4 `test(src)` waits, G6 dcebf928 `fix(mood)`, G5 c688673f `test(src)` clock, G7 52391a86 `test(unit)` clock, G8 38d48d49 `test(unit)` quiescence, G9 18f56fd7 `test(unit)` flushes (review patches folded into their groups).

**Files changed:**
- App: `src/utils/moodGrouping.ts` — calendar-day label difference across DST.
- Test support: `tests/support/helpers/events.ts` (`clockAnchor`, `clockAnchorAvoidingLeapDay`, `isoBirthdayDaysFromNow`), `tests/support/helpers/persisted-blob.ts` (anchor param).
- api: `couple-broadcast-authorization.spec.ts` — sentinels replace three 3 s sleeps.
- e2e: account-data, events, persisted-events-strip, mood-offline-copy, birthdays-wedding-offline, settings/birthdays-wedding (pinned page clock); login, partner-kit, partner-mood, google-oauth, dock, photo-gallery (awaited stubs / returned fulfils).
- src tests: LoveNoteMessage, usePartnerMood, useRealtimeMessages, backgroundSync, authServices (waits); MoodHistoryCalendar.storeReload, MoodHistoryTimeline, PartnerMoodView.kit, PokeKissInterface, Settings.birthdayWedding, Settings.togetherSince, dateUtils, moodGrouping (clock).
- unit tests: App.callbackNotice/eventsSession/localCopyRefresh, supabaseClientAuthFlow, moodNormalization, moodService, swMoodSync, coupleSettings, moodSlice, notesSlice.offlineQueue, updateCurrentMessageStaleCache, messageRotation (clock); ephemeralBroadcast, moodSyncSubscription, signOutClearsAccountState (quiescence); accountDataCreateRetry, eventsSlice/interactionsSlice/notesSlice/photosSlice localCopy, loaderIdentityGuards, notesSlice idempotency/removal/sessionGuard, settingsSlice.initializeApp, rls-security, interactionsSubscription, dbSchema, dbSchema.indexes, helpers/events (flushes, advisories, new helper tests).

**Review:** 32 findings (high 0, medium 3, low 21, false 7, maybe-false 1). Patched 9 entries (1 medium, 8 low) covering 18 rows; deferred 4 review items (plus 5 from implementation); rejected 3 lows and 7 false with reasons in the triage log. Follow-up review recommended: false — no high patched, one medium entry patched.

**Verification (orchestrator, after patches):** `npm run lint` exit 0; `npm run typecheck` exit 0, no errors; `npm run test:unit` 155 files / 2796 tests passed; the 17 G8/G9 files passed 3 shuffled runs (487/487), and the patched unit files 2 more shuffled runs; `npx playwright test` on the 13 changed api/e2e specs 45 passed (before and after patches). Implementer: G1 18/18 and G2 57/57 with `--repeat-each=3`.

**Residual risks:** The Realtime sentinels rely on in-order delivery to one subscriber across senders, which holds on single-node local Realtime but is not guaranteed on a clustered deployment. E2E pinned clocks run up to 24 h behind real time, so a test that outlives its cached token's real life could see a 401 (same trade-off as events-read-window). dbSchema.test.ts is still order-dependent under shuffle (deferred to story 4).
