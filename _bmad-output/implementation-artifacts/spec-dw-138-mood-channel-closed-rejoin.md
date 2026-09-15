---
title: 'DW-138: bounded reopen for an unsolicited mood-channel CLOSED'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: 'ab794f0c9c5115c8e9c3c7cd81b9a182d5f0e812'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `subscribeMoodUpdates` records `lastStatus` and fans `CLOSED` out; nothing reopens the topic. A server `phx_close` therefore silences partner moods for the rest of the page, while `PartnerMoodView` only maps `CLOSED` to `disconnected` and `usePartnerMood` ignores it.

**Approach:** Give the refcounted mood registry a bounded reopen for a close it did not ask for, matching the recovery `useRealtimeMessages.handleStatus` already applies to love-notes. Distinguish last-subscriber teardown from that close, reuse `closingMoodChannels` and `waitForSocketReady`, and cap retries.

## Boundaries & Constraints

**Always:** Treat a `CLOSED` as unsolicited only while this callback's entry is still the live `moodChannels` row and still has subscribers (the last-subscriber path deletes that row before `removeChannel`). Reuse `closingMoodChannels` and `waitForSocketReady` on the replacement join. Cap retries at the love-notes `RETRY_CONFIG` (5, 1s base, 30s max) and reset the count on `SUBSCRIBED`. A re-join sets `snapshotFresh` false so its `SUBSCRIBED` re-takes identity. Cancel a pending reopen when the last subscriber detaches. Keep existing status fan-out and the late-`CLOSED`-must-not-pin-the-replacement contract.

**Never:** Do not copy scripture hooks. Do not edit `_bmad-output/implementation-artifacts/deferred-work.md`. Do not re-subscribe the same `RealtimeChannel` object. Do not reopen on `CLOSED` from last-subscriber teardown or from a channel the registry already replaced. Do not add `CHANNEL_ERROR`/`TIMED_OUT` retry here — the SDK rejoins an `errored` channel itself; it does not rejoin `CLOSED`. Do not extract a shared registry from the notes hook. Do not change `PartnerMoodView` or `usePartnerMood` status mapping.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unsolicited `phx_close` | Live subscribers; server closes the topic | After backoff, a **new** channel object joins (`phx_join` after the close); subscribers stay attached | No error expected |
| Deliberate last-subscriber leave | `unsubscribe()` then the leave's `CLOSED` | No rejoin scheduled | No error expected |
| Late `CLOSED` from a replaced channel | Dead channel reports `CLOSED` after a replacement is live | No extra join; replacement `lastStatus` stays `SUBSCRIBED` | No error expected |
| Last subscriber leaves during backoff | Unsolicited `CLOSED`, then last `unsubscribe()` before the timer fires | Pending reopen cancelled; no replacement join | No error expected |
| Retry ceiling | Five unsolicited `CLOSED`s already spent | No further join; `lastStatus` stays `CLOSED`; subscribers can still detach | Logged; no unhandled rejection |

</intent-contract>

## Code Map

- `src/api/moodSyncService.ts` -- **the only `src/` file to change.** `.subscribe((status) => ...)` at `:692-723` writes `lastStatus` and fans status out; it has no reopen. Last-subscriber teardown at `:777-809` deletes the map row then records `removeChannel` in `closingMoodChannels` (`:159`) — that ordering is the unsolicited-vs-teardown discriminator. Replacement opens already wait on `closingMoodChannels` then `waitForSocketReady()` (`:623-642`). Identity: first `SUBSCRIBED` uses `snapshotFresh`; every re-join must not.
- `src/hooks/useRealtimeMessages.ts` -- **pattern, read-only.** `RETRY_CONFIG` `:53-57`. `handleStatus` `:327-493`: ignore statuses after teardown / from a replaced channel, then on `CLOSED` log at info and share the CHANNEL_ERROR backoff; retry replaces the channel after leave + `waitForSocketReady`. Do not transcribe the hook — a refcounted singleton must keep its subscriber set across the replacement.
- `src/api/realtimeSocket.ts` -- `waitForSocketReady()` (`:74`). Already imported.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:210` and `src/hooks/usePartnerMood.ts:89-96` -- **read-only consumers.** CLOSED → `disconnected` (Partner tab) or ignored (Mood tab). After a successful rejoin they see `SUBSCRIBED` through existing fan-out.
- `tests/unit/api/realtimeLeaveContract.test.ts` -- SDK pin today: `serverCloses` `:106-110`; deliberate CLOSED `:176-186`; unsolicited CLOSED `:189-202` (`channel.state === 'closed'`, gone from `client.getChannels()`, SDK schedules no rejoin). **Add** a `moodSyncService` describe that reuses `FakeWebSocket` + `serverCloses` + `answer` (same as `src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts` wiring: real `RealtimeClient`, stub only `setAuth` / session / partner lookup). Keep the existing SDK cases unchanged.
- `tests/unit/api/moodSyncSubscription.test.ts` -- mock `subscribe` gates on `state === 'closed'` (`:106-118`); `removeChannel` leaves the topic claimed (`:129-146`). Existing `"a dead channel's late CLOSED does not pin its replacement to disconnected"` (`:529-569`) must stay green. Add a helper that mirrors SDK `phx_close` (state `closed`, drop from `openChannels`, emit `CLOSED`) so a mocked reopen is not handed the dying object.

## Tasks & Acceptance

**Execution:**
- `src/api/moodSyncService.ts` -- On an unsolicited `CLOSED`, schedule a bounded replacement join: record the closed channel in `closingMoodChannels`, await it, `waitForSocketReady()`, `setAuth()`, then `supabase.channel(topic)` for a **new** object, moving the existing subscriber set onto it. Cap and cancel as in Boundaries.
- `tests/unit/api/realtimeLeaveContract.test.ts` -- Drive `subscribeMoodUpdates` against the real client. `serverCloses` while a subscriber is attached → a later `phx_join` from a different channel. Last-subscriber `unsubscribe()` → no such join. Use fake timers for the 1s backoff.
- `tests/unit/api/moodSyncSubscription.test.ts` -- Cover live-entry reopen, teardown-does-not-reopen, late-CLOSED-from-replaced (existing), backoff cancel on last detach, and the retry ceiling. Do not weaken the late-CLOSED assertion.

**Acceptance Criteria:**
- Given a live `subscribeMoodUpdates` consumer and the installed SDK, when the server delivers `phx_close` on `mood-updates:<uid>`, then after the first backoff a different `RealtimeChannel` has put a `phx_join` on the wire and that consumer remains attached.
- Given the last consumer has unsubscribed, when that leave reports `CLOSED`, then no rejoin is scheduled.
- Given `npx vitest run tests/unit/api/realtimeLeaveContract.test.ts tests/unit/api/moodSyncSubscription.test.ts`, when the suite runs, then every pre-existing case in those files still passes with its original intent intact.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 17 findings — high 0, medium 9, low 8, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` Replacement `SUBSCRIBED` never asserted identity re-take — added `re-takes the partner snapshot on the replacement's first SUBSCRIBED` (unlink then `emitMood` dropped).
  - `[low]` `[reject]` PartnerMoodView / usePartnerMood reconnect path untested — intent's proof surface is the registry `phx_close` case; consumers recover through existing `SUBSCRIBED` fan-out and were not in scope to change.
  - `[low]` `[reject]` Give-up leaves a dead row that pins a late overlapping subscriber — last detach already deletes the row so a remount recovers; changing give-up to release would invert the ceiling test the matrix required.
  - `[medium]` `[patch]` Shared subscriber Set fanned `CLOSED` from the released channel — `onStatus` now fans only while `moodChannels.get(topic) === entry`.
  - `[medium]` `[patch]` `setAuth`/wait reject after release left live subscribers deaf — `reopenMoodChannel`'s catch now `armMoodReopen`s the live row toward the same ceiling.
  - `[low]` `[reject]` `closingMoodChannels` / `waitForSocketReady` on the reopen path not isolated in the mock — production still calls both; the installed SDK leave is synchronous, so a contended-socket test is extra machinery.
  - `[low]` `[reject]` Two concurrent consumers not covered on reopen — the shared Set already delivers to every attached subscriber; a two-callback case is extra coverage.
  - `[medium]` `[patch]` `closedRetryCount` reset on `SUBSCRIBED` untested — added `restores the CLOSED retry budget when the replacement reports SUBSCRIBED`.
  - `[low]` `[reject]` SDK `phx_close` case uses `toBeGreaterThan(1)` and skips `onMood` / `setAuth` — the trailing `phx_join` with a new `joinRef` is the proof the intent named; the mock file already asserts attachment and `setAuth` order.
  - `[low]` `[reject]` `realtimeLeaveContract` `afterEach` does not unsubscribe through `moodSyncService` — both new cases `unsubscribe()` on the happy path; a service reset would add test-only surface.
  - `[low]` `[reject]` No negative case that `CHANNEL_ERROR`/`TIMED_OUT` do not reopen — the intent is an unsolicited `CLOSED` reopen; the SDK already rejoins `errored`.
  - `[low]` `[reject]` Last-subscriber cancel untested after the timer has fired — backoff cancel is the matrix row; post-await `isLiveMoodEntry` checks already drop an in-flight reopen.
  - `[medium]` `[patch]` `setAuth` rejects after the live row is swapped and released — same catch reschedule as the blind-hunter setAuth finding (`armMoodReopen` on the live replacement).
  - `[medium]` `[patch]` Successful CLOSED recovery does not restore the retry budget (verification-gap) — covered by the replacement-`SUBSCRIBED` budget test.
  - `[medium]` `[patch]` Late `CLOSED` from the retry-replaced channel not asserted against an extra join — added `a released channel's late CLOSED does not notify live consumers or open another join`.
  - `[medium]` `[patch]` Replacement join does not assert identity re-take on its first `SUBSCRIBED` (verification-gap) — same identity test as the first finding.
  - `[medium]` `[patch]` Shared Set fans a released channel's `CLOSED` to live consumers (verification-gap other) — same live-row fan-out guard.

### 2026-09-15 — Review pass
- verdicts: 26 findings — high 0, medium 4, low 15, false 7, maybe-false 0
- findings:
  - `[low]` `[reject]` Give-up leaves a live `moodChannels` row so an overlapping second consumer is stuck — carried: last detach already deletes the row so a remount recovers; changing give-up to release would invert the ceiling test the matrix required.
  - `[false]` `[reject]` Late-`CLOSED` matrix `lastStatus` stays `SUBSCRIBED` is not what the new test checks — replacement `lastStatus` lives on a different `MoodChannelEntry`; the dead callback writes `entry.lastStatus` on the released row only (`src/api/moodSyncService.ts:690`) and fans only while `moodChannels.get(topic) === entry` (`:717-719`).
  - `[false]` `[reject]` `reopenMoodChannel` swap-then-rebind races last-subscriber `unsubscribe` — after each await, `isLiveMoodEntry` bails; `releaseMoodChannel` catches a second `removeChannel`; a last detach deletes the row so the in-flight reopen cannot bind.
  - `[false]` `[reject]` Ceiling test withholds `SUBSCRIBED` so five successful joins would not hit give-up — the matrix is five `CLOSED`s already spent; production resets `closedRetryCount` on `SUBSCRIBED` (`:692-694`); emitting `SUBSCRIBED` would invert that row.
  - `[low]` `[reject]` Installed-SDK path does not show the consumer remains attached — carried: the trailing `phx_join` with a new `joinRef` is the proof the intent named; the mock file already asserts attachment and `setAuth` order.
  - `[medium]` `[patch]` `setAuth`/wait reject after release has no test that would re-arm a join — added `re-arms a join when reopen setAuth rejects after the row is swapped`.
  - `[low]` `[reject]` Successful recovery never asserts `onStatus('SUBSCRIBED')` — same live-row fan-out already proven for unsolicited `CLOSED`; Partner-tab mapping was not in scope.
  - `[false]` `[reject]` `armMoodReopen` has no already-scheduled guard — a single `phx_close` delivers one `CLOSED`; a second `CLOSED` on the still-closed object before `moodChannels.set` is not shown.
  - `[low]` `[reject]` Two live consumers after `phx_close` are not covered — carried: the shared Set already delivers to every attached subscriber; a two-callback case is extra coverage.
  - `[low]` `[reject]` DW-138 ledger close does not record what landed — orchestrator owns ledger status and resolution; this session must not rewrite the entry.
  - `[low]` `[reject]` `onStatus` throw while fanning unsolicited `CLOSED` skips reopen — `PartnerMoodView` and `usePartnerMood` only `setState`; try/finally is a new guard for a throw those callbacks do not make.
  - `[false]` `[reject]` Socket starts disconnecting during reopen `setAuth` so `subscribe` no-ops — `src/api/realtimeSocket.ts:78-81` "never merely because a channel was released"; `waitForSocketReady` already ran on this path.
  - `[false]` `[reject]` `removeChannel` reject then reopen binds the dying channel — `src/api/moodSyncService.ts:591-594` `unsubscribe()` has no rejection path (RealtimeChannel.js:604-612).
  - `[medium]` `[patch]` `setAuth` rejection after the live row is swapped has no test that would re-arm a join — same test as the blind-hunter setAuth finding.
  - `[low]` `[reject]` Diff edits `deferred-work.md` against the intent Never clause — orchestrator owns the ledger; this session must not rewrite the DW-138 entry.
  - `[low]` `[reject]` SDK `phx_close` case does not assert `onMood` / attachment after replacement — carried: trailing `phx_join` with a new `joinRef` is the proof the intent named; the mock file already asserts attachment.
  - `[low]` `[reject]` SDK leave case never asserts the leave's `CLOSED` as input — mock file already `unsubscribe()` then `emitStatus(channel, 'CLOSED')`.
  - `[false]` `[reject]` Reopen-path late `CLOSED` does not replay replacement `lastStatus` — same per-entry write as the blind-hunter lastStatus finding; the dead callback cannot overwrite the replacement row.
  - `[medium]` `[patch]` Status fan-out narrowed to the live row — carried: `onStatus` now fans only while `moodChannels.get(topic) === entry`.
  - `[low]` `[reject]` SDK describe has no in-backoff cancel; post-await cancel untested — carried: backoff cancel is the matrix row; post-await `isLiveMoodEntry` checks already drop an in-flight reopen; the mock covers the timer-cancel row.
  - `[low]` `[reject]` Ceiling test does not assert `removeChannel` on detach or no unhandled rejection — the test invokes both unsubscribes; detach does not consult `closedRetryCount`.
  - `[low]` `[reject]` SDK tests omit identity re-take and retry-budget restore — mock file already has those two cases.
  - `[low]` `[reject]` `closingMoodChannels` / `waitForSocketReady` on reopen not isolated in the mock — carried: production still calls both; the installed SDK leave is synchronous, so a contended-socket test is extra machinery.
  - `[medium]` `[patch]` Catch re-arm after row swap is untested — same test as the blind-hunter setAuth finding.
  - `[low]` `[reject]` No negative case that `CHANNEL_ERROR`/`TIMED_OUT` do not reopen — carried: the intent is an unsolicited `CLOSED` reopen; the SDK already rejoins `errored`.
  - `[low]` `[reject]` No view/hook case that `CLOSED` then replacement `SUBSCRIBED` moves the Partner-tab indicator — carried: consumers recover through existing `SUBSCRIBED` fan-out and were not in scope to change.

## Verification

**Commands:**
- `npx vitest run tests/unit/api/realtimeLeaveContract.test.ts tests/unit/api/moodSyncSubscription.test.ts` -- expected: all pass, including the new phx_close rejoin case and the deliberate-unsubscribe non-rejoin case.
- `npm run test:unit` -- expected: exit 0, no new failures.
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: no errors other than the known worktree-only `TS2883` at `tests/support/merged-fixtures.ts`.

## Auto Run Result

Status: done

Summary: `moodSyncService` already reopened an unsolicited `CLOSED` on a new channel, with last-subscriber teardown skipped, late-`CLOSED` ignored on a replaced row, backoff cancel, retry ceiling, `SUBSCRIBED` budget reset, and identity re-take. This follow-up pass added a mock test that a rejected reopen `setAuth` after the row swap still re-arms a later join.

Files changed:
- `src/api/moodSyncService.ts` — bounded replacement join for an unsolicited `CLOSED`
- `tests/unit/api/moodSyncSubscription.test.ts` — mock reopen cases, including `re-arms a join when reopen setAuth rejects after the row is swapped`
- `tests/unit/api/realtimeLeaveContract.test.ts` — installed-SDK `phx_close` rejoin and last-subscriber non-rejoin

Review findings (this follow-up pass): 26 findings — high 0, medium 4, low 15, false 7, maybe-false 0. Patches applied this pass: 1 entry at medium (`setAuth` reject re-arm test; three rows, one fix). Items deferred: none. Rejected: give-up dead row (carried), SDK attachment/`onMood` (carried), two-consumer reopen (carried), ledger rewrite (orchestrator-owned), `onStatus` throw guard, SDK leave-`CLOSED` input, ceiling detach assertions, SDK identity/budget extra, in-backoff/post-await cancel (carried), `waitForSocketReady` isolation (carried), `CHANNEL_ERROR`/`TIMED_OUT` negative (carried), view/hook reconnect (carried), `SUBSCRIBED` fan-out extra. False: replacement `lastStatus` overwrite, swap-then-rebind last-subscriber bind, ceiling-with-`SUBSCRIBED`, already-scheduled guard, socket disconnect during `setAuth`, `removeChannel` reject reuse.

Follow-up review recommendation: false. This pass patched 0 high and 1 medium entry (plus 1 carried medium from the prior live-row fan-out patch, not counted). Follow-up pass rule: `true` only if a high was patched.

Verification:
- `npx vitest run tests/unit/api/realtimeLeaveContract.test.ts tests/unit/api/moodSyncSubscription.test.ts` — exit 0, 2 files, 39 tests passed
- `npm run test:unit` — exit 0, 103 files, 1947 tests passed
- `npm run lint` — exit 0
- `npm run typecheck` — exit 0; no `TS2883` reported

Residual risks: give-up still leaves the dead row while subscribers remain, which the prior pass accepted so the ceiling test stays meaningful. Partner-tab `CLOSED` → `disconnected` still recovers only through existing `SUBSCRIBED` fan-out, which this pass did not re-exercise at the view.
