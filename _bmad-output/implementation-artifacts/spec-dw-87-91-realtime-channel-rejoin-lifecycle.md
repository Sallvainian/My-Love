---
title: 'Realtime channel rejoin lifecycle in useRealtimeMessages (DW-87, DW-91)'
type: 'bugfix'
created: '2026-09-14'
baseline_revision: 'd33065021ff7130d7094424347caef7044dfe7cd'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      A phx_leave answered 'error' leaves the channel stuck in `leaving`, yet
      removeChannel still resolves, so the leave-wait clears and the reopen is
      handed a channel whose subscribe() is gated shut.
    evidence: |-
      @supabase/phoenix assets/js/phoenix/channel.js:247-249 wires the close
      hook to "ok" and "timeout" only, so an 'error' leave never reaches
      `closed` and never runs `socket.remove(this)`. @supabase/realtime-js
      dist/module/RealtimeChannel.js:604-612 still resolves 'error', and
      RealtimeClient.js:254-259 skips `teardown()` unless the status is 'ok'.
      The same hole exists in moodSyncService's closingMoodChannels, which the
      intent told this work to mirror, so fixing it here alone would diverge
      the two. The `.catch()` in releaseNoteChannel guards a rejection the SDK
      never produces, and the test that exercises it uses a shape the real
      client cannot return.
    location: >-
      src/hooks/useRealtimeMessages.ts:79-96
    severity: medium
  - summary: >-
      CLOSED remains an unhandled terminal status, so a close the hook did not
      ask for leaves the topic permanently silent with no retry scheduled.
    evidence: |-
      subscribe() wires `_onClose(() => callback(CLOSED))`
      (@supabase/realtime-js dist/module/RealtimeChannel.js:148), but
      handleStatus retries only CHANNEL_ERROR and TIMED_OUT. Pre-existing: the
      baseline hook ignored CLOSED too. Any fix must distinguish the hook's own
      deliberate leave from a close it did not initiate, since ignoring CLOSED
      is load-bearing for the release path.
    location: >-
      src/hooks/useRealtimeMessages.ts
    severity: medium
  - summary: >-
      This is a third uncoordinated per-topic leave registry, against the
      repo's stated direction to route Realtime work through a shared one.
    evidence: |-
      moodSyncService.ts:149 and ephemeralBroadcast.ts already hold their own;
      interactionService and the scripture hooks still take none. AGENTS.md
      says to route new Realtime work through moodSyncService's refcounted
      registry and never call supabase.channel() directly. Extracting the
      pair into realtimeSocket.ts would cover the whole channel namespace.
      Pre-existing duplication, widened rather than created by this change.
    location: >-
      src/hooks/useRealtimeMessages.ts:69
    severity: low
  - summary: >-
      realtimeSocket.ts's header rationale quotes SDK behaviour that no longer
      matches the installed realtime-js, and this change newly depends on it.
    evidence: |-
      The header quotes `RealtimeClient.js:213-219` disconnecting as soon as
      the last channel is removed. In 2.116.0 removeChannel only tears down on
      'ok' (dist/module/RealtimeClient.js:254-259); the disconnect moved to
      `_remove` -> `_schedulePendingDisconnect`, with
      `_disconnectOnEmptyChannelsAfterMs` defaulting to 2x heartbeatIntervalMs
      (:646-647), and `channel()` cancels it (:340). The ~100ms window the
      helper waits out is likely unreachable on a rejoin now. The gate is
      cheap and harmless; the comment justifying it should be re-verified.
    location: >-
      src/api/realtimeSocket.ts:1-46
    severity: low
  - summary: >-
      Giving up after five retries is entrenched with no exit and no signal to
      the UI, and closingNoteChannels is unobservable from tests.
    evidence: |-
      handleStatus returns after the max-retry check, leaving the errored
      channel in channelRef and in client.channels, and the hook returns {} so
      no consumer can tell the feed is dead; moodSyncService at least keeps
      lastStatus and replays it. closingNoteChannels is unexported, so a
      wedged entry and an empty map look identical from outside the module.
      Pre-existing give-up behaviour: the baseline had the same five-retry
      ceiling and the same empty return value.
    location: >-
      src/hooks/useRealtimeMessages.ts
    severity: low
  - summary: >-
      Both DW ledger entries' `location:` fields point at the wrong code, so a
      future reader reconciling the bundle against the ledger lands in the
      wrong block.
    evidence: |-
      Against baseline d3306502, DW-87's cited src/hooks/useRealtimeMessages.ts:190-196
      is inside the SUBSCRIBED snapshot comment, not the retry; DW-91's
      :215-232 is the backoff block, not the cleanup. The intent prose
      citations (:260, :311, :174) do match the baseline verbatim, and the
      implementation followed the prose. Not fixed here: this run is directed
      not to edit the deferred-work ledger.
    location: >-
      .bmad-loop/runs/20260914-114531-81a7/bundles/realtime-channel-rejoin-lifecycle/intent.md
    severity: low
  - summary: >-
      The `location:` fields this bundle wrote into the DW ledger are
      unreliable: one points into a gitignored run directory that cannot be
      opened later, and the rest land on comment lines or carry no line range
      at all.
    evidence: |-
      DW-114's location is
      `.bmad-loop/runs/20260914-114531-81a7/bundles/realtime-channel-rejoin-lifecycle/intent.md`,
      but `.gitignore` lists `.bmad-loop/runs/`, and AGENTS.md records that a
      deleted run directory is unrecoverable -- so the one entry whose whole
      subject is "location fields point at the wrong code" files a location a
      future reader cannot open. In the same append, DW-111's
      `src/hooks/useRealtimeMessages.ts:69` is a comment line (the registry it
      describes is the `const closingNoteChannels` declaration below it),
      DW-109's `:79-96` starts on a blank docblock line and runs past the end
      of `releaseNoteChannel`, and DW-110 and DW-113 carry no line range while
      DW-87, DW-91, DW-109, DW-111 and DW-112 all do. Not repaired here: this
      run is directed not to modify, re-open or rewrite ledger entries, and
      the orchestrator owns them.
    location: >-
      _bmad-output/implementation-artifacts/deferred-work.md
    severity: low
  - summary: >-
      The ledger's own reason text states that the run must not edit the
      ledger, while the same change rewrites two entry statuses and appends six
      new entries to it.
    evidence: |-
      DW-114's reason reads "Not fixed here: this run is directed not to edit
      the deferred-work ledger", and the DW-105 entry above it reads "this run
      was instructed not to modify, re-open or rewrite existing ledger entries
      -- the orchestrator owns them"; the same diff sets DW-87 and DW-91 to
      `status: done 2026-09-14` with `resolution:` and `resolution-undo:` lines
      and appends DW-109 through DW-114. Both statements are true of different
      edits -- the run does not touch OTHER entries, while its own
      done-markers and new entries are exactly what it is supposed to write --
      but neither says so, so the next reader meets a file that contradicts
      itself. Needs a sentence distinguishing the edits the run owns from the
      ones it does not; the orchestrator owns that text.
    location: >-
      _bmad-output/implementation-artifacts/deferred-work.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** `useRealtimeMessages` both re-joins and tears down its Realtime channel in ways the SDK ignores. The CHANNEL_ERROR retry calls `subscribe()` on the *same* channel object, but the SDK gates the entire join body on the channel already being closed, and an error leaves it `errored` — so every retry is a silent no-op. Separately the cleanup fires `supabase.removeChannel()` without awaiting it, so an effect re-run for the same topic can be handed the still-leaving object whose `subscribe()` is likewise a no-op.

**Approach:** Remove and recreate the channel on retry instead of re-subscribing the same object, and route every open through a per-topic "mid-leave" registry that awaits the previous leave, in the shape of `moodSyncService`'s `closingMoodChannels`.

## Boundaries & Constraints

**Always:**
- Keep the existing partner-snapshot contract exactly: the *first* join consumes the pre-join snapshot (no refresh on its `SUBSCRIBED`), and every *re-join* — retry included — re-takes it on `SUBSCRIBED`. A retry must NOT re-resolve the partner before its join.
- Keep `supabase.realtime.setAuth()` immediately before every `subscribe()`, on both the first join and the retry, and keep handing `handleStatus` to `subscribe()`.
- Wait out both a leave in flight for the topic *and* `waitForSocketReady()` before calling `supabase.channel(topic)`.
- Keep the existing `cancelled` / `subscriptionActive` guards; after an unmount or supersede, no channel for the topic may be left joined or registered.
- Keep the retry budget, backoff maths, and give-up behaviour unchanged.
- Preserve the existing explanatory comment blocks; extend them where the mechanism changes.

**Never:**
- Do not re-subscribe an existing `RealtimeChannel` object anywhere in this hook.
- Do not change `moodSyncService`, `ephemeralBroadcast`, `realtimeSocket`, `interactionService`, or the frozen scripture hooks; do not extract a shared registry helper.
- Do not add react-router, the `@/` alias inside `src/`, or a formatter pass.
- Do not weaken or delete an existing assertion to make it pass — where a test's mechanism genuinely changed, restate the same invariant against the new mechanism.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First join | Mount, no leave in flight | Partner resolved, `setAuth()`, then a channel is created and joined; that `SUBSCRIBED` does not re-resolve the partner | No error expected |
| Retry after a real CHANNEL_ERROR | Channel state is `errored` | The errored channel is removed, its leave awaited, `setAuth()` runs, and a **new** channel object joins the topic | Leave rejection is caught and logged; the retry still proceeds |
| Remount while the leave is in flight | Cleanup ran, leave unsettled | The new run awaits the recorded leave (then `waitForSocketReady()`) before `supabase.channel(topic)`, so it gets a fresh object | No error expected |
| Unmount mid-setup | `cancelled` set before the channel is created | No channel is created and nothing is subscribed | No error expected |
| Max retries exhausted | 5 retries already spent | No further removal, no further channel, no further join | Logged; hook stays quiet |
| Retry `setAuth()` rejects | Token install fails | No join is attempted; the channel stays closed | Caught and logged, never an unhandled rejection |

</intent-contract>

## Code Map

- `src/hooks/useRealtimeMessages.ts` -- the only file to change in `src/`. Channel is created eagerly at `:173-182` and must move; the no-op re-subscribe is `:260`; the un-awaited teardown is `:311`; status handling and backoff are `:184-271`; the pre-join snapshot IIFE is `:273-296`. Effect deps `[enabled, userId, handleNewMessage]` (`:318`).
- `src/api/moodSyncService.ts` -- **the pattern to copy, read-only.** Registry declared `:149` with the rationale comment `:132-148`; the wait-out on open `:616-631` (`await closing`, re-check the map, then `await waitForSocketReady()`); the write on teardown `:784-794` (`removeChannel(...).catch(...)`, `set(topic, leaving)`, `void leaving.finally(...)` deleting only its own entry). Note `:601-607`: both awaits sit *ahead* of channel bookkeeping on purpose.
- `src/api/realtimeSocket.ts` -- `waitForSocketReady()` (`:74`). Cheap guard (returns at once unless the socket is mid-disconnect) that keeps a reopen from landing in the window where `connect()` is a no-op. `supabaseClient.ts:79-83` passes no `disconnectOnEmptyChannelsAfterMs`, so `RealtimeClient.js:646-647` defers the disconnect by `2 * heartbeatIntervalMs` and `RealtimeClient.js:340` cancels it when a channel reopens -- the field initializer at `:165` is `0` but the constructor overwrites it. Same precedent as `moodSyncService:628` and `ephemeralBroadcast:122`.
- `src/api/ephemeralBroadcast.ts:122` -- second in-repo precedent for `await waitForSocketReady()` before opening.
- `src/hooks/__tests__/useRealtimeMessages.test.ts` (819 lines) -- existing coverage. Its `supabase` mock (`:24-55`) has `removeChannel: vi.fn()` returning `undefined` and a `realtime` object with only `setAuth`; both need widening. `mocks.order` must still read `['setAuth','subscribe','setAuth','subscribe']` (`:648`). The test at `:136` asserts the *old* eager-creation mechanism and must be restated.
- `src/hooks/useLoveNotes.ts:141` -- sole call site, `useRealtimeMessages({ enabled: autoFetch })`; no `onNewMessage`, so re-runs come from mount/unmount and `userId` changes.

**SDK evidence (read-only, `node_modules/@supabase/realtime-js` 2.116.0):**
- `dist/module/RealtimeChannel.js:134` — `if (this.channelAdapter.isClosed()) {` wraps the whole join body; otherwise `subscribe()` just `return this`.
- `dist/module/phoenix/channelAdapter.js:72-74` — `isClosed() { return this.state === CHANNEL_STATES.closed; }`.
- `dist/module/RealtimeChannel.js:169` — the join-push error path sets `this.state = CHANNEL_STATES.errored`; `@supabase/phoenix/assets/js/phoenix/channel.js:75` does the same for a socket-level error.
- `dist/module/RealtimeChannel.js:100-101` — the client registry entry is dropped from `_onClose`, *after* the leave; `RealtimeClient.js:335-346` — `channel(topic)` returns the existing (dying) object until then.

## Tasks & Acceptance

**Execution:**

- `src/hooks/useRealtimeMessages.ts` -- Add a module-scoped `const closingNoteChannels = new Map<string, Promise<unknown>>()` with a comment recording why (cleanup and setup are different closures, and separate mounts share a topic, so a ref cannot carry it), plus two module-scoped helpers: one that records a leave (`removeChannel(...).catch(log)`, `set(topic, leaving)`, `void leaving.finally(...)` deleting only its own entry) and one that awaits any recorded leave then `waitForSocketReady()`. Mirror `moodSyncService:784-794` and `:616-631`. -- A per-topic registry is the only thing that makes reopening a topic work; the SDK hands back the dying object until `_onClose` lands.

- `src/hooks/useRealtimeMessages.ts` -- Replace the eager channel creation with a single in-effect `openChannel()` that: awaits the closing-wait helper, re-checks `cancelled`, awaits `setAuth()`, re-checks `cancelled`, then creates the channel (`supabase.channel(topic, { config: { private: true } })` + the `broadcast`/`new_message` binding), assigns `channelRef.current`, and calls `channel.subscribe(handleStatus)`. Keep the pre-join partner lookup on the *first* open only, still setting `snapshotFresh = partnerId !== null`. Keep the `.catch()` around the whole async path. -- Creating the channel only after the awaits closes the window where a superseded run owns a registered, never-joined channel; it is the same ordering `moodSyncService:601-607` documents.

- `src/hooks/useRealtimeMessages.ts` -- Rewrite the retry body at `:246-269`: after the backoff, if still active, record a leave for the current `channelRef.current` through the registry helper, clear `channelRef.current`, set `snapshotFresh = false`, then run `openChannel()` in its retry form — no pre-join partner lookup — and keep the existing `.catch()` logging. -- The old `channelRef.current.subscribe(handleStatus)` cannot rejoin an `errored` channel at all; only a fresh object can. Skipping the pre-join lookup keeps the documented "every re-join re-takes the snapshot on SUBSCRIBED" contract intact.

- `src/hooks/useRealtimeMessages.ts` -- Change the cleanup at `:298-317` to release the channel through the registry helper instead of the bare `supabase.removeChannel(...)`. -- Recording the leave is what lets the next run for this topic wait it out.

- `src/hooks/__tests__/useRealtimeMessages.test.ts` -- Widen the `supabase` mock: `removeChannel` must return a settled promise, and `realtime` must expose `isDisconnecting`. Restate the test at `:136` against the new mechanism (unmount during the partner lookup now means *no channel is ever created*, so assert `supabase.channel` was not called and nothing was subscribed). Leave every other existing assertion — the backoff, the give-up count, the snapshot contract, and the `mocks.order` sequence — passing unchanged. -- The hook now awaits the leave and consults the socket, so the mock must model both; the one mechanism-bound test is restated, not weakened.

- `src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts` -- New file. Mock `../../api/supabaseClient` with a stub backed by a **real** `RealtimeClient` from `@supabase/realtime-js`, constructed with an injected fake WebSocket class as `transport` (`RealtimeClient.js:649` takes `options.transport`). Stub only `realtime.setAuth`; delegate `channel`, `removeChannel` and `realtime.isDisconnecting` to the real client. Drive a genuine CHANNEL_ERROR by firing the fake socket's `onerror`, which reaches `Socket.onConnError` → `triggerChanError` → `channel.js:75` `state = errored` and the hook's `handleStatus`. -- The bug is the SDK's own `isClosed()` gate; only the real channel state machine can prove the retry now rejoins.

**Acceptance Criteria:**

- Given the hook is mounted against the real `RealtimeChannel` state machine and a genuine CHANNEL_ERROR has put the channel in `errored`, when the backoff elapses, then the topic is served by a **different** `RealtimeChannel` instance than the one that errored, and that instance is joining or joined — and the same test fails against the pre-fix hook.
- Given the effect cleanup has run and the leave for the topic has not settled, when a new effect run for the same topic starts, then it does not call `supabase.channel(topic)` until that recorded leave has settled and `waitForSocketReady()` has returned.
- Given a leave for the topic rejects, when the next run waits it out, then the rejection is logged and the new run still opens its channel.
- Given the hook is unmounted while the setup is parked before the channel is created, when the parked await resolves, then no channel is created and nothing is subscribed.
- Given a retry succeeds, when its `SUBSCRIBED` fires, then the partner snapshot is re-resolved exactly once on that callback — and not before the join.
- Given `npm run test:unit`, when the suite runs, then every pre-existing `useRealtimeMessages` test still passes with its original intent intact.

## Design Notes

The registry lives at module scope, not in a ref: the cleanup closure of run *N* and the setup closure of run *N+1* never share a ref cell, and two mounts of the Love Notes view resolve to the same `love-notes:<uid>` topic. `moodSyncService` gets the same effect from being a singleton.

Shape to mirror (from `moodSyncService.ts:784-794`):

```ts
const leaving = supabase.removeChannel(channel).catch((err) => {
  logger.debug('[useRealtimeMessages] Love-notes channel leave failed:', err);
});
closingNoteChannels.set(topic, leaving);
void leaving.finally(() => {
  // Only clear our own entry — a later teardown may already have replaced it.
  if (closingNoteChannels.get(topic) === leaving) closingNoteChannels.delete(topic);
});
```

The `.catch()` is load-bearing: a leave can resolve `error`, and that rejection must never propagate into an unrelated open.

## Verification

**Commands:**
- `npx vitest run src/hooks/__tests__/useRealtimeMessages.test.ts src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts` -- expected: all pass.
- `git stash push -u -m "dw8791-prefix-check"` on the `src/` change only, then re-run the new rejoin spec -- expected: it FAILS, proving it drives the real gate rather than a mocked status string. Restore with `git stash apply <sha>` and drop the entry. (A temporary WIP commit and `git revert`/reset of just `src/hooks/useRealtimeMessages.ts` is an acceptable substitute; the stash stack is shared across worktrees.)
- `npm run test:unit` -- expected: exit 0, no new failures.
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: no errors other than the known worktree-only `TS2883` at `tests/support/merged-fixtures.ts(53,14)`, whose count is not stable; treat any non-`TS2883` error as a failure.

## Spec Change Log

No bad_spec loopback occurred; this section is empty.

## Review Triage Log

### 2026-09-14 — Review pass
- verdicts: 28 findings — high 1, medium 12, low 12, false 3, maybe-false 0
- findings:
  - `[medium]` `[defer]` A leave answered 'error' leaves the channel stuck in `leaving` while removeChannel still resolves, so the reopen gets a channel whose subscribe() is gated shut — verified: phoenix `channel.js:247-249` wires onClose to "ok"/"timeout" only; `RealtimeChannel.js:604-612` resolves 'error'; `RealtimeClient.js:254-259` tears down only on 'ok'. Deferred: the identical hole exists in moodSyncService, the module the intent told this work to mirror.
  - `[low]` `[defer]` `releaseNoteChannel`'s `.catch()` guards a rejection the SDK never produces, and the test exercising it uses a shape the real client cannot return — verified: `unsubscribe()` only ever resolves ('ok'|'timed out'|'error'). Same root cause as the row above; deferred with it.
  - `[medium]` `[patch]` The retry released the failed channel before `setAuth`, so a rejected token install left no channel to report anything and the feed died until remount — fixed: the release moved inside `openChannel`, after `setAuth()` resolves and after the `cancelled` re-check; the token-rejection test now asserts the channel is NOT released and that a later CHANNEL_ERROR still recovers.
  - `[false]` `[reject]` A released channel stays wired to `handleStatus` and can hijack its replacement — refuted: phoenix `socket.js:576-581` `triggerChanError` skips channels that are `errored`, `leaving` or `closed`, so a released channel cannot be driven to CHANNEL_ERROR; its only remaining callback path is `_onClose` → `CLOSED`, which `handleStatus` ignores.
  - `[false]` `[reject]` The unbounded `await closing` can wedge a topic forever — refuted: `RealtimeChannel.unsubscribe()` always resolves and `releaseNoteChannel` additionally `.catch()`es, so the stored promise always settles; there is no non-settling path.
  - `[low]` `[defer]` A third uncoordinated per-topic registry, against AGENTS.md's "route new Realtime work through moodSyncService's registry" — real but pre-existing duplication (moodSyncService and ephemeralBroadcast already diverge); extraction is far more than a direct correction.
  - `[low]` `[reject]` Missing moodSyncService's open-entry map, so two concurrent mounts could both open the topic — rejected: not reachable, `MessageInput.tsx:50` passes `useLoveNotes(false)` so only one live mount exists, and the fix adds a whole second map rather than a direct correction.
  - `[low]` `[patch]` SDK line citations are accurate only for `dist/module`, and `phoenix/channel.js:75` omits the `assets/js/` segment — fixed: every citation now carries its package and build, with a note that line numbers are the `dist/module` build; the rejoin spec's copies were corrected too.
  - `[low]` `[defer]` `realtimeSocket.ts`'s header quotes SDK behaviour that no longer matches 2.116.0, and this change newly leans on it — real, but the file is untouched by this change.
  - `[medium]` `[patch]` The real-SDK spec never asserts the symptom it names: `FakeSocket.sent` was declared, populated and never read — fixed: it now asserts one `phx_join` before the error, then a `phx_leave`, then a `phx_join` whose `join_ref` appears in no earlier frame.
  - `[low]` `[patch]` `FakeSocket` declares `sent` but omits the `send` that fills it, so the fake type-checks nothing about its most load-bearing method — fixed: `send` declared on the interface.
  - `[low]` `[patch]` The leave-in-flight test asserted negatives after 30ms/40ms wall-clock sleeps while `waitForSocketReady` polls every 10ms — fixed: converted to local fake timers with advances keyed to the helper's own 1000ms bound.
  - `[medium]` `[defer]` CLOSED is still an unhandled terminal status, leaving a topic permanently silent after a close the hook did not request — real, but pre-existing: the baseline ignored CLOSED too, and a fix must first distinguish the hook's own leave.
  - `[low]` `[defer]` Giving up is entrenched with no exit and no UI signal, and `closingNoteChannels` is unobservable — pre-existing give-up behaviour and return shape.
  - `[medium]` `[defer]` (edge-case) A leave answered 'error' yields a zombie `leaving` channel handed back forever — same defect as the first row; shares its route.
  - `[medium]` `[patch]` The socket can enter `disconnecting` during the partner lookup or `setAuth`, after the socket check had already passed — fixed by the reorder below.
  - `[medium]` `[patch]` (edge-case) The retry releases first and a rejected `setAuth` then leaves nothing to report — same defect as the release-before-setAuth row; fixed with it.
  - `[medium]` `[patch]` `openChannel`'s doc comment claimed moodSyncService's ordering while doing the reverse — verified against `moodSyncService:598-630`. Fixed: order is now partner lookup → setAuth → release → leave-wait → waitForSocketReady → create+subscribe with no await between, and the comment describes the real order.
  - `[medium]` `[patch]` `waitForNoteChannelSlot` read the closing map once and never re-read it after awaiting — fixed: it is now `waitForNoteChannelLeaves`, looping and re-reading after each await the way `moodSyncService:621` does.
  - `[medium]` `[defer]` (edge-case) `openChannel` subscribes whatever `supabase.channel(topic)` returns without checking it is closed — same root cause as the leave-'error' row; shares its route.
  - `[medium]` `[patch]` The retry path's use of the leave registry was unpinned: replacing it with a bare un-awaited `removeChannel` left all tests green — fixed: a new test holds the retry's own leave open across the backoff and asserts the reopen waits for it.
  - `[high]` `[patch]` A `SUBSCRIBED` arriving inside the backoff did not cancel the pending retry, so a channel the SDK's own rejoin had recovered was torn down and replaced, nulling the partner snapshot and dropping every note in that window — verified in code (the SUBSCRIBED branch reset only `retryCountRef`) and reachable because phoenix's rejoinTimer re-fires the joinPush's surviving `recHooks`. Fixed: the branch now clears `retryTimeoutRef`, with a test covering recovery inside the window.
  - `[low]` `[reject]` The `closingNoteChannels` identity guard is unpinned by tests — rejected: it needs two concurrent leaves for one topic, which the single live mount cannot produce.
  - `[low]` `[reject]` The `cancelled` check after the leave-wait is unpinned by tests — rejected: the later check still prevents channel creation, so the only cost is a wasted round-trip after unmount.
  - `[low]` `[defer]` (intent-alignment) The registry is local rather than shared, leaving five other open/close sites uncovered — same finding as the third-registry row; shares its route.
  - `[false]` `[reject]` The change relocated the first join's creation beyond the two cited sites and inverted a pre-existing assertion — refuted: no invariant was lost. The replacement test asserts no channel is created, nothing subscribed and nothing removed, which is strictly stronger than the original's "created but not subscribed", and the relocation is what closes the un-owned-channel window.
  - `[medium]` `[patch]` (intent-alignment) The rejoin spec's discriminating power sat at the hook's call pattern rather than the SDK gate — same finding as the `sent`-never-asserted row; fixed with it.
  - `[low]` `[defer]` Both DW ledger `location:` fields are stale against the baseline — real, but this run is directed not to edit the deferred-work ledger.


### 2026-09-14 — Review pass (follow-up)
- verdicts: 33 findings — high 0, medium 5, low 25, false 1, maybe-false 2
- findings:
  - `[medium]` `[patch]` `openChannel` can tear down a channel the SDK recovered while its own awaits were in flight — verified: the retry timer callback never nulls `retryTimeoutRef.current` and `openChannel` re-checks nothing but `cancelled`, so the SUBSCRIBED branch's `clearTimeout` covers only the window BEFORE the timer fires; phoenix schedules its first rejoin at 1000ms (`@supabase/phoenix assets/js/phoenix/socket.js:137` `[1000, 2000, 5000][tries - 1]`), exactly when the first backoff elapses. Fixed: the release step returns early when `failed?.state === 'joined'`.
  - `[low]` `[patch]` `waitForNoteChannelLeaves`'s docstring cited `moodSyncService:621` as precedent for re-reading the closing map — verified false: `src/api/moodSyncService.ts:621` is `entry = this.moodChannels.get(topic);`, a re-read of the OPEN map under the `:620` comment "Another subscriber may have opened the replacement while we waited"; `closingMoodChannels` is read once at `:616` and never re-read. Fixed: the docstring now states the loop is a deliberate divergence and says what `:621` actually does.
  - `[low]` `[patch]` `openChannel`'s "Ordering is moodSyncService's, step for step" overstates the parity — verified: the cited line numbers are all correct, but the hook adds a release step moodSyncService has no counterpart for and omits its `:621`/`:629` open-map re-reads. Fixed: reworded to "Ordering follows moodSyncService's" with both differences named.
  - `[low]` `[reject]` The spec's I/O matrix retry row is stale against the shipped order (it puts `setAuth` after the leave) — real, but its only fix is to edit this build's spec, which triage rejects.
  - `[low]` `[reject]` The matrix's setAuth-rejection row says "the channel stays closed" while the implementation deliberately retains it `errored` — real, and `closed` vs `errored` is the distinction the story turns on, but the fix is a spec edit.
  - `[low]` `[reject]` Neither the retry-cancellation nor the retain-on-token-failure behaviour has an acceptance criterion — real; both are covered by tests, and adding an AC is a spec edit.
  - `[low]` `[reject]` The prefix-check verification command's `git stash push -u` carries no pathspec and would sweep the untracked rejoin spec — real; the fix is a spec edit. Worked around operationally: this pass ran the prefix check by writing the baseline hook over `src/hooks/useRealtimeMessages.ts` from git, not by stashing.
  - `[low]` `[defer]` DW-114's `location:` points into `.bmad-loop/runs/`, which `.gitignore` excludes and AGENTS.md records as unrecoverable — verified; deferred because the fix edits the orchestrator-owned ledger.
  - `[low]` `[defer]` The ledger entries this bundle appended repeat the defect DW-114 reports: DW-111's `:69` is a comment line, DW-109's `:79-96` overshoots `releaseNoteChannel`, DW-110 and DW-113 carry no range — verified; same route as the row above.
  - `[low]` `[defer]` The ledger edit contradicts the reason text inside it — verified: DW-114 and DW-105 both say the run must not edit the ledger, while the same diff rewrites DW-87/DW-91 statuses and appends six entries. Deferred: the orchestrator owns that text.
  - `[low]` `[defer]` `carried` An AC and a test pin a leave rejection the SDK cannot produce — carried from this pass's predecessor row ("`releaseNoteChannel`'s `.catch()` guards a rejection the SDK never produces"); the code still reads as that row describes, so it keeps its `[low] [defer]` and is not re-deferred.
  - `[low]` `[reject]` The main spec file never resets the module-scoped `closingNoteChannels` — verified: the name appears nowhere in the file and `beforeEach:101` resets mocks only. Rejected: no current test leaves an unsettled entry (the one held-open leave is settled before its test ends), so the risk is latent, and the fix needs a test-only export or drain helper rather than a direct correction.
  - `[maybe-false]` `[reject]` The rejoin spec is structurally limited to one test — would be settled by adding a second test and seeing whether `harness.sockets` repopulates: the `afterEach` drains pending timers, which may fire the client's own pending disconnect and let a second mount build a fresh FakeWebSocket. If-true grade is `low`, so rejected with the note rather than deferred.
  - `[low]` `[reject]` The rejoin spec's `unmount()` is the last statement, outside `act()` and outside a `finally` — verified. Rejected: it only bites when an earlier assertion has already failed, RTL's auto-cleanup unmounts anyway, and the fix restructures the whole test body.
  - `[low]` `[patch]` The rejoin spec's frame helper mis-typed the wire frame and left its one unique assertion unmade — verified: `topicFrames()` cast a 5-element v2 frame as a 4-tuple with always-string refs, and `harness.getPartnerId` was wired and cleared but never asserted. Fixed: the cast is now `[string | null, string | null, string, string, unknown]` and the spec asserts `getPartnerId` was called exactly once, pinning "a retry must not re-resolve the partner before its join" at the real-SDK surface. The same finding's third claim — that `trailingJoin!` throws instead of failing readably — is refuted: the preceding `toContain('phx_join')` fails first whenever no trailing join exists.
  - `[medium]` `[patch]` (edge-case) A SUBSCRIBED arriving while the retry's `openChannel` is parked on `setAuth` replaces a healthy channel — same defect as the first row; fixed with it.
  - `[low]` `[reject]` (edge-case) A second CHANNEL_ERROR while `openChannel` is still awaiting re-enters the retry and can replace a joining channel — verified reachable (the errored channel's own rejoin can fail again before the release). Rejected: the harm is churn and a faster walk to the give-up ceiling, not a dead feed, and the fix is an in-flight mutex — new state plus a branch, more than a direct correction.
  - `[medium]` `[defer]` `carried` (edge-case) `supabase.channel(topic)` can return an already-registered channel, double-binding `broadcast` and hitting the gated `subscribe()` — carried: the only way the registry clears while the channel stays registered is the leave-answered-'error' hole already logged `[medium] [defer]` (DW-109).
  - `[low]` `[reject]` (edge-case) The pre-join partner snapshot can go stale across the leave and socket waits and is still trusted as fresh — verified that this change widened the window (the baseline had only `setAuth` between lookup and join). Rejected: it needs a partner change inside a ~1s window at mount, and the fix adds a timestamp plus a staleness branch.
  - `[false]` `[reject]` (edge-case) Removing `|| !channelRef.current` from the retry timer body made a retry a no-op when no channel is held — refuted: the baseline needed that guard because the retry re-subscribed `channelRef.current`; the new retry creates a fresh object and `openChannel` null-guards `failed`, so restoring it would suppress a retry exactly when opening is the correct action.
  - `[low]` `[reject]` (edge-case) `setAuth` is no longer adjacent to `subscribe` — verified: three awaits sit between them. Rejected: the only code-level fix (release before `setAuth`) reintroduces the `medium` defect the previous pass fixed, so what remains is a spec edit.
  - `[low]` `[patch]` (edge-case) The parity claim and the `:621` citation mislead anyone reconciling the two registries — same finding as the `waitForNoteChannelLeaves` row; fixed with it.
  - `[low]` `[reject]` (edge-case) The spec no longer describes the retry order the code implements — same as the stale-matrix row; spec edit.
  - `[maybe-false]` `[defer]` `carried` (edge-case) `.subscribe()` can still be called on an existing `RealtimeChannel` — same claim as the double-binding row; carried with it.
  - `[medium]` `[patch]` (verification-gap) The `cancelled` re-check after `waitForSocketReady()` is unpinned — filed pre-verified: the layer deleted it and all 29 tests still passed, and its own probe caught the regression. Fixed: new case `creates nothing when unmounted while parked on the socket check`, confirmed failing (`expected 1 times, got 2 times`) with that re-check removed.
  - `[low]` `[patch]` (verification-gap) The `moodSyncService:621` citation is wrong — same finding as above; fixed with it.
  - `[low]` `[reject]` (intent-alignment) Matrix row 3's SDK property ("it gets a fresh object") is unobservable in the test that covers it, because the mock returns a fresh object by construction — real; what the test pins is the call-ordering invariant instead. Rejected: the real-SDK property is DW-109's territory and the rejoin harness cannot block a leave (phoenix resolves it locally when `canPush()` is false).
  - `[medium]` `[defer]` `carried` (intent-alignment) Matrix row 3's real-SDK failure mode is deferred rather than implemented — carried: this is DW-109.
  - `[low]` `[defer]` `carried` (intent-alignment) Matrix row 2's "leave rejection is caught and logged" is pinned at a surface the client cannot reach — carried with the `.catch()` row.
  - `[low]` `[reject]` (intent-alignment) The `setAuth` adjacency constraint's meaning shifted and `mocks.order` can no longer tell the two readings apart — same as the adjacency row; spec-level.
  - `[low]` `[reject]` (intent-alignment) Matrix row 6 is the mirror image of row 2's stated order — same as the "stays closed" row; spec edit.
  - `[low]` `[defer]` `carried` (intent-alignment) `waitForSocketReady()`'s mechanism is recorded as possibly inert on a rejoin — carried: this is DW-112.
  - `[low]` `[reject]` (intent-alignment) SUBSCRIBED clearing `retryTimeoutRef` is a behaviour no reading of the intent asks for — real, but it is the previous pass's verified `high` fix; removing it reintroduces that defect.

## Auto Run Result

Status: done

### Summary

`useRealtimeMessages` replaces its Realtime channel on retry instead of re-subscribing an object the SDK will not rejoin, and every open waits out any leave still in flight for the topic. The CHANNEL_ERROR retry releases the failed channel through a module-scoped per-topic registry — the shape `moodSyncService`'s `closingMoodChannels` uses — and opens a fresh channel only once that leave has settled and the shared socket is ready. The effect cleanup records its leave in the same registry, so a remount for the same topic can no longer be handed the dying object. Channel creation sits behind the setup awaits, closing the window in which a superseded effect run owned a registered, never-joined channel.

This follow-up pass closed the last hole in the retry's own lifecycle: the retry now abandons itself if the SDK's rejoin loop brings the channel back while the retry is still opening its replacement.

### Files changed

- `src/hooks/useRealtimeMessages.ts` — per-topic leave registry (`closingNoteChannels`, `releaseNoteChannel`, `waitForNoteChannelLeaves`); a single `openChannel` serving the first join and the retry; the retry removes and recreates; cleanup routes through the registry; `SUBSCRIBED` cancels a pending retry; **this pass:** the release step keeps a channel that has recovered to `joined`, and two docstrings no longer claim a `moodSyncService` precedent that module does not set.
- `src/hooks/__tests__/useRealtimeMessages.test.ts` — mock widened for the awaited leave and the socket check; one mechanism-bound test restated; six cases added in the first pass; **this pass:** two more — unmount while parked on the socket check, and recovery after the retry has already started opening.
- `src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts` — drives a genuine CHANNEL_ERROR through a real `RealtimeClient` on a fake WebSocket transport and asserts the replacement channel actually joins, on the wire; **this pass:** the frame helper is typed against the real 5-element v2 frame, and the spec now asserts the retry did not re-resolve the partner.

### Review findings

33 findings across four layers — high 0, medium 5, low 25, false 1, maybe-false 2.

**Patched (4 entries: medium 2, low 2).**
- `[medium]` `openChannel` could tear down a channel the SDK had recovered while its own awaits were in flight. The SUBSCRIBED branch's `clearTimeout` only covers the window before the timer fires; past that, nothing the open read could see the recovery. The release step now returns early when the channel it means to discard reads `joined`.
- `[medium]` The `cancelled` re-check after `waitForSocketReady()` was unpinned — removing it left the whole suite green. A new case unmounts while parked there and asserts nothing is created or subscribed.
- `[low]` Two docstrings cited `moodSyncService:621` as precedent for re-reading the closing map. That line re-reads the OPEN map for an unrelated reason; the loop is a deliberate divergence, and the comments now say so.
- `[low]` The rejoin spec mis-typed the wire frame as a 4-tuple and never asserted `harness.getPartnerId`, leaving "a retry must not re-resolve the partner before its join" unpinned at the one surface where the retry is a real join.

**Deferred (2 new, 6 carried).** New: the DW `location:` fields this bundle wrote are unreliable (one points into a gitignored run directory); the ledger's own reason text says the run must not edit the ledger while the same change rewrites two statuses and appends six entries. Both fixes belong to the orchestrator, which owns that file. Carried unchanged from the first pass: DW-109 (leave answered 'error'), DW-110 (CLOSED unhandled), DW-111 (third registry), DW-112 (stale `realtimeSocket` header), DW-113 (entrenched give-up), DW-114 (stale ledger locations).

**Rejected (16).** Six because their only fix is to edit this build's spec — the stale matrix retry row, the "stays closed" wording, the two missing ACs, the unscoped `git stash` in the Verification block, and the two intent-alignment restatements of those. One refuted outright: removing `|| !channelRef.current` from the retry timer is required by the new mechanism, since `openChannel` null-guards `failed` and restoring the guard would suppress a retry exactly when opening is correct. One maybe-false rejected at an if-true grade of `low` (the rejoin spec's single-test structure). The rest are low-severity with fixes larger than a direct correction: a mutex for the double-retry race, a staleness timestamp for the pre-join snapshot, a test-only export to reset the registry map between tests, and restructuring the rejoin spec's unmount.

### Follow-up review

`followup_review_recommended: false` — this was a follow-up pass and it patched no `high`. Patched counts by verdict: high 0, medium 2, low 2. The two medium patches are both narrowings of an already-fixed defect rather than new mechanism: one adds a single state read before an existing release, the other adds only a test. The work has converged.

### Verification

- `npx vitest run src/hooks/__tests__/useRealtimeMessages.test.ts src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts` — 31 passed (2 files). Was 29 before this pass; both additions are new cases.
- Prefix check — the baseline hook at `d3306502` written over `src/hooks/useRealtimeMessages.ts` from git, then the rejoin spec re-run: FAILS with `expected [ RealtimeChannel{…} ] to have a length of 2 but got 1`, then restored. Run this way rather than with the spec's `git stash push -u`, which carries no pathspec and would have swept the untracked rejoin spec along with the source change.
- Both new cases were mutation-checked. Removing the `joined` guard fails `keeps a channel that recovers after the retry has already started opening` with `expected "vi.fn()" to not be called at all, but actually been called 1 times`; removing the `cancelled` re-check after `waitForSocketReady()` fails `creates nothing when unmounted while parked on the socket check` with `expected "vi.fn()" to be called 1 times, but got 2 times`.
- `npm run test:unit` — 91 files, 1678 tests, all passed.
- `npm run lint` — 0 errors, 3 warnings, all pre-existing `react-refresh/only-export-components` in unrelated files.
- `npm run typecheck` — clean, no output. The known worktree-only `TS2883` did not appear in this run.

### Residual risks

- DW-109 is the one that still matters: a `phx_leave` answered `'error'` resolves `removeChannel` without deregistering the channel, so the leave-wait clears and the reopen is handed an object whose `subscribe()` is gated shut. The `joined` guard added this pass does not touch it — that channel reads `leaving`, not `joined`. It is deferred because the identical hole sits in `moodSyncService`, the module the intent told this work to mirror, and fixing one alone would diverge them.
- The double-retry race (a second CHANNEL_ERROR landing while `openChannel` is still awaiting) is rejected, not fixed: it burns two retries for one fault and can replace a channel that is still joining. It walks the hook to its five-retry ceiling faster, and that ceiling is itself deferred as DW-113 with no UI signal behind it.
- The leave-wait's blocking behaviour is still only exercised against the hand-rolled mock. In the real-SDK spec the leave resolves locally and at once, because phoenix triggers `'ok'` when `canPush()` is false, which it is for an errored channel. No test drives a retry against a `joined` channel, where the leave is a genuine server round-trip.
