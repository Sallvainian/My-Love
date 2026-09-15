# Review A — Realtime channel lifecycle

Adversarial review of the Realtime channel lifecycle half of
`fix/connection-recovery-user-facing`, against baseline `3f0d951b`.

Scope reviewed (the assigned diff):

- `src/hooks/useRealtimeMessages.ts`
- `src/hooks/useLoveNotes.ts`
- `src/components/love-notes/LoveNotes.tsx`
- `src/api/moodSyncService.ts`
- `src/api/realtimeSocket.ts`
- `src/hooks/__tests__/useRealtimeMessages.test.ts`
- `tests/unit/api/realtimeLeaveContract.test.ts`

Deferred-work entries claimed: DW-109, DW-110, DW-112, DW-113 (each read whole in
`_bmad-output/implementation-artifacts/deferred-work.md`).

Checks run (all green, all non-destructive):

- `npx tsc -b --force` — no output, exit 0.
- `npm run lint` — no findings.
- `npx vitest run src/hooks/__tests__/useRealtimeMessages.test.ts tests/unit/api/realtimeLeaveContract.test.ts tests/unit/api/moodSyncSubscription.test.ts src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts`
  — `Test Files 4 passed (4) / Tests 64 passed (64)`.
- An independent SDK probe driving the real `RealtimeClient` from
  `node_modules/@supabase/realtime-js/dist/main/index.js` over a fake WebSocket
  (scratchpad only; no repo file touched). Output quoted under A-4.

Installed SDK versions, read from `node_modules`:
`@supabase/realtime-js` `"version": "2.116.0"`, `@supabase/phoenix` `"version": "0.4.5"`.

---

## Summary

The core of the change is sound. The CLOSED handling cannot reopen a deliberately
released channel on any of the three release paths; the retry-ceiling release
introduces no double-release and no leak; the status key correctly suppresses a
previous account's `disconnected`; and every SDK line number cited in the
rewritten comments is accurate against the installed 2.116.0/0.4.5 (verified line
by line, table at the end).

Eight findings follow. One is a test that does not prove what it says it proves
(A-4). One is a verification gap: the new user-facing UI has no test at all (A-8).
Three are comment claims that are stale or wrong in the very files DW-112 exists
to correct (A-1, A-2, A-3). The rest are low-severity correctness edges.

| id | title | severity | confidence | introduced? |
|---|---|---|---|---|
| A-1 | `realtimeSocket.ts` header claims sign-out disconnects the socket; it does not | low | high | introduced |
| A-2 | `moodSyncService.ts:635` still carries the "~100ms" claim DW-112 refuted | low | high | pre-existing, in-scope, unrepaired |
| A-3 | `useRealtimeMessages.test.ts:28` carries the same refuted "~100ms" claim | low | high | pre-existing, in-scope, unrepaired |
| A-4 | `realtimeLeaveContract.test.ts`'s "resolves rather than rejects" case is vacuous | medium | high (measured) | introduced |
| A-5 | The unmount case does not isolate the `subscriptionActive` guard it documents | low | high | introduced |
| A-6 | Giving up is not terminal: an in-flight retry re-opens after `disconnected` | low | medium-high | introduced |
| A-7 | `setReport` writes a fresh object every time; latent render loop for an inline `onNewMessage` caller | low | high | introduced |
| A-8 | The new `LoveNotes` notice has no test, and the only suite that renders `LoveNotes` mocks away `realtimeStatus` | medium | high | introduced |
| A-9 | `data-testid="realtime-connection-status"` now names two different components | low | high | introduced |
| A-10 | Guard comment says "Both release paths"; the change made it three | low | high | introduced |

---

## A-1 — `realtimeSocket.ts`'s surviving justification for the gate rests on a claim that is false for this app

**Severity** low. **Confidence** high.
**DW** DW-112. **File** `src/api/realtimeSocket.ts`, module docblock.
**Introduced by this change** — this is text the change wrote.

### What I found

`src/api/realtimeSocket.ts:33-36`:

```
 * The gate is kept anyway, for two reasons. It still describes something real —
 * a socket the browser or an explicit `disconnect()` has genuinely put into
 * CLOSING, which sign-out does — and in that state an open really would fail to
 * join.
```

and `src/api/realtimeSocket.ts:72-75`:

```
 * Returns immediately in the overwhelmingly common case. On the installed SDK
 * the socket is `disconnecting` only while the transport is genuinely in
 * WebSocket.CLOSING -- an explicit `disconnect()` such as sign-out, or a socket
 * the browser is tearing down -- never merely because a channel was released.
```

Sign-out does not call `disconnect()`. The installed supabase-js handles the
event at `node_modules/@supabase/supabase-js/dist/index.cjs:874-877`:

```
		} else if (event === "SIGNED_OUT") {
			this.realtime.setAuth();
			if (source == "STORAGE") this.auth.signOut();
			this.changedAccessToken = void 0;
		}
```

— `setAuth()` only; no `disconnect()`, no `removeAllChannels()`. And no app code
calls either: `grep -rn "realtime.disconnect\|removeAllChannels\|\.disconnect()" src`
(excluding `.test.`) returns only three `IntersectionObserver.disconnect()` calls
in `performanceMonitoring.ts`, `MoodHistoryTimeline.tsx` and `PhotoGridItem.tsx`.

The second quote's closing clause is also in tension with the same file's own
body. `realtimeSocket.ts:16-21` states that removing the last channel schedules a
deferred disconnect 50 seconds out — and `RealtimeClient.js:447-460`'s
`_schedulePendingDisconnect` really does call `this.disconnect()` from that timer,
which is what puts the transport into CLOSING. So "never merely because a channel
was released" is true only of the immediate window, not of the mechanism.

### Why it matters and the underlying cause

DW-112 is entirely a comment-accuracy entry: *"the header rationale quotes SDK
behaviour that no longer matches the installed realtime-js, and this change newly
depends on it."* The rewrite corrected every SDK citation but replaced the old
justification with a new claim about the *app* that was not measured the way the
SDK claims were. The gate is still worth keeping — a browser-torn-down socket and
the 50-second deferred disconnect are both real — but the concrete example given
is the one case that does not happen.

### Trigger

Read the file; check `supabase-js`'s SIGNED_OUT branch and the repo for
`disconnect()` callers.

### Recommended resolution

Replace "which sign-out does" with the reachable producer: the deferred
disconnect that `_schedulePendingDisconnect` fires ~50s after the last channel is
released (which sign-out reaches indirectly, by unmounting the views that hold
channels), plus a browser-initiated close. Soften "never merely because a channel
was released" to "not in the window immediately after a channel is released".

### Test that would demonstrate the fix

None — comment-only. The nearest mechanical guard is a case in
`tests/unit/api/realtimeLeaveContract.test.ts` asserting that
`client.removeChannel(lastChannel)` leaves `client.isDisconnecting()` false
immediately afterwards, which pins the "not in the window immediately after"
half of the claim.

---

## A-2 — `moodSyncService.ts:635` still states the "~100ms" socket teardown that DW-112 refuted

**Severity** low. **Confidence** high.
**DW** DW-112. **File** `src/api/moodSyncService.ts`, `subscribeMoodUpdates`.
**Pre-existing text, inside the change's scope, left unrepaired.**

### What I found

`src/api/moodSyncService.ts:634-636`:

```
      // Closing that channel may have been what removed the LAST channel in the
      // app, which tears the socket down for ~100ms. Subscribing inside that
      // window silently never joins -- see realtimeSocket.
```

This is the exact claim DW-112 was raised about, and the file it points at now
says the opposite. `src/api/realtimeSocket.ts:16-21`:

```
 *   - The disconnect moved to `_remove` -> `_schedulePendingDisconnect`
 *     (`:439-460`), and it is DEFERRED, not immediate:
 *     `_disconnectOnEmptyChannelsAfterMs` defaults to twice the heartbeat
 *     interval (`:646-647` x `CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL: 25000`),
 *     and this app passes no override (`src/api/supabaseClient.ts:83-87`), so
 *     the window is 50 SECONDS.
```

DW-112's resolution claims the fix reached this file: *"`moodSyncService`'s
matching docblock carried the same stale citations and is corrected alongside."*
The `closingMoodChannels` docblock was corrected (diff hunk at `@@ -133,18 +133,28 @@`);
this inline comment, 500 lines further down in the same file and in the same
diff's other hunk region, was not.

### Why it matters

A reader arriving at `waitForSocketReady()`'s only other call site is told the
window is 100 ms and told to "see realtimeSocket", which tells them it is 50
seconds and that a channel release does not produce it at all. That is the
precise failure mode AGENTS.md's "no stale prose can hand an agent wrong context"
rule exists for, and it is the entry this change was closing.

### Trigger

`grep -rn "100ms\|100 ms" src tests` — three live sites remain, two of them inside
this change's scope (this one and A-3), one outside it
(`tests/unit/api/ephemeralBroadcast.test.ts:15` and `:94`, out of scope, flagged
as adjacent, not repaired here).

### Recommended resolution

Rewrite to match `realtimeSocket.ts`: the release may have removed the last
channel, which *schedules* a disconnect 50 s out; `waitForSocketReady()` is read
here because a socket the browser or that timer has genuinely put into CLOSING
cannot be joined.

### Test that would demonstrate the fix

None — comment-only.

---

## A-3 — `useRealtimeMessages.test.ts:28` repeats the same refuted claim

**Severity** low. **Confidence** high.
**DW** DW-112. **File** `src/hooks/__tests__/useRealtimeMessages.test.ts` (in scope).

### What I found

`src/hooks/__tests__/useRealtimeMessages.test.ts:26-31`:

```
  /**
   * The shared socket, as `waitForSocketReady` reads it. Removing the last
   * channel parks the socket in `disconnecting` for ~100ms, and every open
   * inside that window silently never joins.
   */
  isDisconnecting: vi.fn(),
```

Same refuted statement as A-2, in a file the change edited (three hunks) without
touching this block.

### Why it matters

Same as A-2. The mock's docstring is the first thing a writer reads when deciding
what `isDisconnecting` should return in a new case, so a wrong model here
propagates into future tests.

### Recommended resolution

Restate as: `waitForSocketReady()` reads this; on the installed SDK it is true
only while the transport is in `WebSocket.CLOSING`, and the tests drive it
directly rather than modelling a timing window.

### Test that would demonstrate the fix

None — comment-only.

---

## A-4 — `realtimeLeaveContract.test.ts`'s "resolves rather than rejects" case never reaches the path it claims to pin

**Severity** medium. **Confidence** high — measured, not inferred.
**DW** DW-109. **File** `tests/unit/api/realtimeLeaveContract.test.ts:204-218`.
**Introduced by this change** (the whole file is new).

### What I found

`tests/unit/api/realtimeLeaveContract.test.ts:204-218`:

```
  it('resolves rather than rejects, whatever the leave is answered', async () => {
    const client = newClient();
    const { channel } = await joinedChannel(client);

    const leave = client.removeChannel(channel);
    const leaveFrame = frames().find((frame) => frame.event === 'phx_leave');
    expect(leaveFrame, 'the leave must have reached the wire').toBeDefined();
    answer(leaveFrame as Frame, 'error');

    // `RealtimeChannel.js:604-612` resolves 'ok' | 'timed out' | 'error' and has
    // no rejection path at all. Both registries wrap their leave in a
    // `.catch()`; this is the case that says those catches are belt, not
    // mechanism, so nobody removes the real guard believing the catch covers it.
    await expect(leave).resolves.toBe('ok');
  });
```

The `answer(leaveFrame, 'error')` is a no-op. By the time it runs, the promise has
already resolved `'ok'` and the push's reply binding has been cancelled.

Measured against the installed SDK (scratchpad probe, real `RealtimeClient`, fake
WebSocket, microtask drain of 20 ticks before the reply is delivered):

```
1. statuses after join: [ 'SUBSCRIBED' ]
2. leave settled BEFORE any server reply: resolved:ok
3. channel.state before reply: closed
4. channel still registered: false
5. statuses before reply: [ 'SUBSCRIBED', 'CLOSED' ]
6. after delivering an "error" reply, settlement is still: resolved:ok
7. statuses after reply: [ 'SUBSCRIBED', 'CLOSED' ]
```

The mechanism is in `node_modules/@supabase/phoenix/assets/js/phoenix/push.js:112-117`:

```
    this.channel.on(this.refEvent, payload => {
      this.cancelRefEvent()
      this.cancelTimeout()
      this.receivedResp = payload
      this.matchReceive(payload)
    })
```

`channel.js:251`'s `if(!this.canPush()){ leavePush.trigger("ok", {}) }` fires that
handler locally, and its first act is `this.cancelRefEvent()` — which unbinds the
reply event. The server's later `phx_reply` with `status: "error"` therefore
matches nothing, and
`node_modules/@supabase/realtime-js/dist/module/RealtimeChannel.js:610`'s
`.receive('error', () => resolve('error'))` is never reached.

### Why it matters and the underlying cause

The case is behaviourally identical to `:150-160`
(`'completes a leave the server never answers, rather than waiting on it'`) with
one extra statement that does nothing. It cannot discriminate the property its
comment claims: an SDK that *rejected* on an `'error'` leave would still leave
this case green, because the `'error'` branch is dead in this scenario. The file's
header promises the opposite — `:25-27`: *"These cases exist so that an SDK bump
which reintroduces the wait turns this file red"* — and that promise is honoured
by `:150-160`, not by this case.

This matters because `releaseNoteChannel`'s docblock
(`src/hooks/useRealtimeMessages.ts:95-100`) and `moodSyncService.ts:792-796` both
now describe their `.catch()` as a belt "and an SDK bump is free to introduce
one", pointing at this file as the thing that would catch such a bump. It would
not.

### Trigger / reproduction

The probe above; or simply observe that `removeChannel` resolves synchronously
relative to the test's next statement.

### Recommended resolution

Either (a) drop the case and fold its comment into `:150-160`, stating plainly
that the SDK never consults the server's answer so the `'error'` resolve is
unreachable from the app; or (b) keep a case that actually pins "no rejection
path" by reaching the `'error'` branch — which requires a channel that is
`joined` *and* a connected socket at the moment `leave()` runs so that
`canPush()` is true. On the installed SDK that is impossible via `leave()`
(`channel.js:242` moves the state first), so (a) is the honest option, plus a
one-line static assertion that `unsubscribe`'s promise has no `reject` parameter
is not available either. Recommend (a).

### Test that would demonstrate the fix

Rename and re-scope to
`'the SDK never consults the server answer to a leave'`, asserting both that the
promise is already settled before any reply is delivered **and** that delivering
an `'error'` reply afterwards changes neither the settlement nor `channel.state`
— i.e. assert the no-op, rather than presenting it as the exercise.

---

## A-5 — The unmount case does not isolate the `subscriptionActive` guard its comment credits

**Severity** low. **Confidence** high.
**DW** DW-110. **Files** `src/hooks/useRealtimeMessages.ts:308-309`,
`src/hooks/__tests__/useRealtimeMessages.test.ts` (`'does not reopen the topic
when the close is this hook\'s own teardown'`).
**Introduced by this change.**

### What I found

`src/hooks/useRealtimeMessages.ts:305-309`:

```
      // Both release paths are already covered by the time they call
      // `releaseNoteChannel`: the cleanup lowers `subscriptionActive` first,
      // and the retry nulls `channelRef` first.
      if (!subscriptionActive) return;
      if (source && source !== channelRef.current) return;
```

The cleanup does both, in this order (`src/hooks/useRealtimeMessages.ts:589-607`):

```
    return () => {
      cancelled = true;
      subscriptionActive = false;
      ...
      if (channelRef.current) {
        logger.debug('[useRealtimeMessages] Unsubscribing from channel');
        ...
        releaseNoteChannel(topic, channelRef.current);
        channelRef.current = null;
      }
```

So after an unmount `channelRef.current` is `null`, and the *second* guard
(`source !== channelRef.current`, with `source` always supplied by the wrapper at
`:576-578`) already returns for the late CLOSED. Deleting `:308` leaves the test
green.

The same holds for the superseded-effect-run case: a later run assigns
`channelRef.current = channel` synchronously at `:564`, with no `await` between
`:550`'s `if (cancelled) return;` and the assignment, so a stale run's channel is
never the current one.

### Why it matters

DW-110's entry warns: *"Any fix must distinguish the hook's own deliberate leave
from a close it did not initiate, since ignoring CLOSED is load-bearing for the
release path."* The resolution answers with *"two guards separate them using state
that already existed"*. Only one of the two is actually load-bearing. That is not
a bug — the redundancy is cheap and defensive — but the test named after the
unmount path is not evidence for the guard it is documented to demonstrate, so a
future simplification that removes `:308` would pass CI while the comment still
says it is the mechanism.

### Trigger

Delete `src/hooks/useRealtimeMessages.ts:308` and re-run
`src/hooks/__tests__/useRealtimeMessages.test.ts`. (Not executed here — the
assignment forbids modifying implementation files. The claim is derived from the
two quoted blocks, which is mechanical.)

### Recommended resolution

Keep both guards; correct the comment to say that `channelRef` nulling covers all
three release paths and `subscriptionActive` is the belt for a status that could
arrive while `channelRef` still points at a live channel the run no longer owns.
Then add the case that does isolate `:308`.

### Test that would demonstrate the fix

A case where `subscriptionActive` is false *and* `channelRef.current` is the
reporting channel. The only way to build it today is to call the cleanup's
`subscriptionActive = false` without the `channelRef` null — which the code does
not expose — so the honest move is to state the redundancy in the comment rather
than manufacture a case. If the guard is kept as documented, it needs a
regression case; if it is documented as redundant, `:308` needs no case at all.

---

## A-6 — Giving up is not terminal: a retry already in flight re-opens the topic after `disconnected` is reported

**Severity** low. **Confidence** medium-high (static trace, quoted below; the
interleaving is the one the file's own comment at `:515-525` says is real).
**DW** DW-113. **File** `src/hooks/useRealtimeMessages.ts`, `handleStatus`
max-retry branch and `openChannel`.
**Introduced by this change** (the give-up release and the status report are new).

### What I found

The give-up branch, `src/hooks/useRealtimeMessages.ts:369-389`:

```
        if (retryCountRef.current >= RETRY_CONFIG.maxRetries) {
          ...
          const abandoned = channelRef.current;
          channelRef.current = null;
          if (abandoned) {
            releaseNoteChannel(topic, abandoned);
          }

          // And say so. This is the only terminal state the hook has; until it
          // was reported, the feed just stopped and no consumer could tell.
          setReport({ key: currentUserId, status: 'disconnected' });
          return;
        }
```

and the retry's own release, `src/hooks/useRealtimeMessages.ts:503-536`:

```
      await supabase.realtime.setAuth();
      if (cancelled) return;
      ...
      if (releaseCurrent) {
        const failed = channelRef.current;
        ...
        if (failed?.state === 'joined') {
          ...
          return;
        }

        channelRef.current = null;
        if (failed) {
          releaseNoteChannel(topic, failed);
        }
      }
```

Interleaving: the fifth retry timer fires and `openChannel` parks on
`await supabase.realtime.setAuth()`. `channelRef.current` is still the old
channel. The old channel reports `CHANNEL_ERROR` or `CLOSED` from inside that
window — which the file itself says happens, `:515-519`:

> *"The SDK runs its own rejoin loop on an errored channel and schedules the first
> attempt 1000ms out (@supabase/phoenix assets/js/phoenix/socket.js:137
> `[1000, 2000, 5000][tries - 1]`), which is exactly when this hook's first
> backoff elapses"*

(verified: `socket.js:137` is `return [1000, 2000, 5000][tries - 1] || 10000`).

Both guards pass (`subscriptionActive` true, `source === channelRef.current`),
`retryCountRef.current` is already 5, so the give-up branch runs: it releases the
channel, nulls `channelRef`, reports `disconnected`, returns. `openChannel` then
resumes, finds `failed === null`, releases nothing, waits the give-up's leave out,
and goes on to create and `subscribe()` a **fresh channel** at `:555-578`.

### Why it matters

- `NoteFeedStatus`'s own docstring (`:42-43`) says *"`disconnected` is terminal
  within a mount: it means the retry ceiling was reached and this hook will not
  try again on its own"*, and `LoveNotes.tsx:57-60` renders it as *"Not receiving
  new notes"* on the strength of *"`disconnected` is terminal -- the subscription
  gave up after five failed re-joins and nothing re-arms it"*. In this
  interleaving a channel is live while the banner says the feed is dead. If the
  channel joins, `SUBSCRIBED` corrects the report to `connected`; if it never
  joins, the next failure gives up again and releases it.
- No leak and no double-release: the give-up nulls `channelRef` before releasing,
  and `openChannel`'s `if (failed)` guard therefore skips its own release. I
  traced every ordering of the three `releaseNoteChannel` call sites (`:383`,
  `:535`, `:605`) and found no path that releases the same channel twice or
  strands one — the registry entry is always removed by
  `leaving.finally` at `:118-123`.

### Recommended resolution

Either make the give-up actually terminal — a `gaveUp` flag that `openChannel`
checks after each `await`, alongside the existing `cancelled` checks — or soften
the "terminal" wording in `NoteFeedStatus`, `LoveNotes.tsx` and DW-113's
resolution to "the hook schedules no further retry of its own". The flag is the
smaller change and matches what the UI already promises.

### Test that would demonstrate the fix

Drive five retries; on the sixth retry's `setAuth()` (held open by a deferred
promise, as the existing suite already does for `getPartnerId` at
`useRealtimeMessages.test.ts:162-167`) fire a `CHANNEL_ERROR` from the old
channel, then resolve `setAuth`. Assert `supabase.channel` is **not** called a
seventh time and the reported status stays `disconnected`.

---

## A-7 — `setReport` writes a fresh object on every reported status; latent render loop for a caller passing an inline `onNewMessage`

**Severity** low (not reachable from either current call site).
**Confidence** high. **DW** DW-113. **File** `src/hooks/useRealtimeMessages.ts`.
**Introduced by this change** — the hook had no state before it.

### What I found

Three unconditional writes, each a new object literal:
`:314` `setReport({ key: currentUserId, status: 'connected' });`,
`:388` `setReport({ key: currentUserId, status: 'disconnected' });`,
`:399` `setReport({ key: currentUserId, status: 'reconnecting' });`.

The effect's dependency array is `:612` `}, [enabled, userId, handleNewMessage]);`
and `handleNewMessage` is `useCallback(..., [addNote, onNewMessage])` (`:219`),
where `onNewMessage` comes straight from the caller's options object.

Because `Object.is` never holds for a fresh literal, every reported status
re-renders the consumer even when the status is unchanged. For a caller that
passes an inline arrow as `onNewMessage`, that render produces a new
`handleNewMessage`, which tears the effect down and re-runs it, which opens a new
channel, which reports `SUBSCRIBED`, which calls `setReport` again — an unbounded
loop. Before this change the effect re-ran on such a caller's every render too,
but nothing in the hook caused a render, so it settled.

Not reachable today: the only two call sites are
`src/hooks/useLoveNotes.ts:151` `const { status: realtimeStatus } = useRealtimeMessages({ enabled: autoFetch });`
(no `onNewMessage`) and, through it, `LoveNotes.tsx:47` and
`MessageInput.tsx:50` `const { sendNote } = useLoveNotes(false);`.

### Recommended resolution

Make the write idempotent:

```ts
setReport((prev) =>
  prev?.key === currentUserId && prev.status === next ? prev : { key: currentUserId, status: next }
);
```

That removes the no-op renders and closes the loop for any future caller,
independently of how `onNewMessage` is passed.

### Test that would demonstrate the fix

Render `useRealtimeMessages({ onNewMessage: () => {} })` with a fresh arrow each
render inside a counting wrapper; assert `supabase.channel` is called once and
the render count stabilises. Today that case would not terminate.

---

## A-8 — The new `LoveNotes` notice has no test, and the only suite that renders `LoveNotes` mocks `realtimeStatus` away

**Severity** medium (verification gap, not a defect).
**Confidence** high. **DW** DW-113.
**Files** `src/components/love-notes/LoveNotes.tsx:62-67` and `:145-154`;
`src/components/love-notes/__tests__/OwnDisplayName.test.tsx:30-39`.
**Introduced by this change.**

### What I found

`grep -rln "<LoveNotes" src/components/love-notes/__tests__/ tests/` returns
exactly one file: `src/components/love-notes/__tests__/OwnDisplayName.test.tsx`.
Its mock, `OwnDisplayName.test.tsx:30-39`:

```
vi.mock('../../../hooks/useLoveNotes', () => ({
  useLoveNotes: () => ({
    notes: [],
    isLoading: false,
    error: null,
    hasMore: false,
    fetchOlderNotes: vi.fn(),
    clearError: vi.fn(),
    retryFailedMessage: vi.fn(),
  }),
}));
```

No `realtimeStatus`. `useLoveNotes.ts:32` declares it required —
`  realtimeStatus: NoteFeedStatus;` — so the component is rendered, in the only
test that renders it, with a value its own type forbids. `undefined` falls through
both ternaries at `LoveNotes.tsx:62-67`, so `realtimeNotice` is `null` and the
`<span>` never renders. `grep -rn "realtime-connection-status" tests/` returns
nothing, so there is no E2E coverage either.

### Why it matters

DW-113's resolution asserts *"it now reports a status, `useLoveNotes` passes it
through, and `LoveNotes` renders it when the feed is reconnecting or has given
up"*. The first two halves are covered — `useRealtimeMessages.test.ts`'s
`'reports the feed as connected, then reconnecting, then disconnected'` pins the
hook. The third half, the only part the user ever sees, is asserted nowhere. A
regression that deleted the `<span>`, inverted the ternary, or dropped
`realtimeStatus` from `useLoveNotes`'s return object would be caught by nothing
except `tsc` (and not even that, for the ternary).

`vi.mock` factories are untyped, which is why `npx tsc -b --force` passes.

### Recommended resolution

Add `realtimeStatus: 'connected'` to the `OwnDisplayName.test.tsx` mock so the
component is exercised in a state its type permits, and add a small
`LoveNotes.realtimeStatus.test.tsx` that mounts with each of the five
`NoteFeedStatus` values.

### Test that would demonstrate the fix

For `'connected' | 'connecting' | 'idle'`: `queryByTestId('realtime-connection-status')`
is null. For `'reconnecting'`: the node exists, reads `Reconnecting…`, and carries
`role="status"` / `aria-live="polite"`. For `'disconnected'`: it reads
`Not receiving new notes` and carries `text-red-600`.

---

## A-9 — `data-testid="realtime-connection-status"` now identifies two different components

**Severity** low. **Confidence** high. **DW** DW-113.
**Files** `src/components/love-notes/LoveNotes.tsx:146`,
`src/components/PartnerMoodView/PartnerMoodView.tsx:548`.
**Introduced by this change.**

### What I found

`src/components/love-notes/LoveNotes.tsx:146`:

```
              data-testid="realtime-connection-status"
```

`src/components/PartnerMoodView/PartnerMoodView.tsx:548`:

```
                      data-testid="realtime-connection-status"
```

Two different feeds (love-notes vs. partner mood), two different vocabularies —
`PartnerMoodView` maps `connected | reconnecting | <else>` to
`Real-time updates active | Reconnecting... | Disconnected` in a `title`
(`:549-555`), while `LoveNotes` renders visible text for `reconnecting` and
`disconnected` only.

### Why it matters

The two live under different `currentView` values so they are not on screen
together today, and nothing currently selects on the id
(`grep -rn "realtime-connection-status" tests/` is empty). But the next spec
written against this id will read as feed-agnostic and silently bind to whichever
view happens to be mounted, and a future layout that shows both makes
`getByTestId` throw on strict mode. The cost of distinguishing them now is one
word.

### Recommended resolution

`realtime-connection-status-notes` and `realtime-connection-status-mood`, or scope
selectors by an ancestor testid. Renaming `PartnerMoodView`'s is out of this
change's scope, so renaming the new one is the smaller move.

### Test that would demonstrate the fix

The `LoveNotes` test from A-8, written with `getByTestId` in a render that also
mounts `PartnerMoodView` — it throws today and passes once the ids differ.

---

## A-10 — The guard comment says "Both release paths"; the change made it three

**Severity** low (documentation). **Confidence** high. **DW** DW-110, DW-113.
**File** `src/hooks/useRealtimeMessages.ts:305-307`.
**Introduced by this change.**

`src/hooks/useRealtimeMessages.ts:305-307`:

```
      // Both release paths are already covered by the time they call
      // `releaseNoteChannel`: the cleanup lowers `subscriptionActive` first,
      // and the retry nulls `channelRef` first.
```

There are three `releaseNoteChannel` call sites after this change: the give-up
branch at `:383`, the retry at `:535`, and the cleanup at `:605`. The give-up path
*is* covered — `:381` `channelRef.current = null;` precedes `:383` — but it is the
one the same change introduced, and the comment that exists to enumerate the safe
paths does not mention it. A future edit that reorders `:381`/`:383` would be
checked against a comment that does not cover that path.

**Recommended resolution**: "All three release paths … the cleanup lowers
`subscriptionActive` first, and the retry and the give-up both null `channelRef`
first."

**Test**: none — comment-only. The behavioural guard is already covered by
`'does not reopen the topic for a CLOSED from a channel the retry replaced'`.

**Nit, same file family**: `src/hooks/__tests__/useRealtimeMessages.test.ts:1439`
is a stray blank line before the file's closing `});` at `:1440`, added by this
change. No formatter runs in this repo (AGENTS.md), so it will persist.

---

## What I checked and did NOT find a problem with

### 1. CLOSED handling cannot reopen a deliberately released channel

Every `releaseNoteChannel` call site nulls `channelRef.current` (or lowers
`subscriptionActive`) *before* releasing, and `source` is always supplied:

- Cleanup `:589-607` — `subscriptionActive = false` at `:591`, `channelRef.current = null`
  at `:606`. Both guards hold.
- Retry `:533-536` — `channelRef.current = null;` at `:533`, release at `:535`.
- Give-up `:381-384` — `channelRef.current = null;` at `:381`, release at `:383`.

`source` is never `undefined` in practice: the only invocation is the wrapper at
`:576-578`, `channel.subscribe((subscribeStatus, subscribeError) => handleStatus(subscribeStatus, subscribeError, channel))`.

**Sign-out**: verified that supabase-js does not tear channels down on
`SIGNED_OUT` (quoted in A-1), so there is no CLOSED burst racing the cleanup. And
`src/App.tsx:592` `if (!session) {` returns `<LoginScreen …>` before the view
chain, so signing out unmounts `LoveNotes` outright.

**Account switch**: the effect keys on `userId` (`:612`), and `currentUserId` /
`topic` are captured per run at `:252-253`, so run N's handlers can only ever
report against run N's channel, which is no longer `channelRef.current`.

**Same topic reopened**: `supabase.channel(topic)` returns an existing channel if
one is registered (`RealtimeClient.js:335-346`, read and quoted below), but the
leave synchronously deregisters — my probe's line 4,
`channel still registered: false`, before any server reply — so the reopen always
builds a fresh object and `source` identity is genuinely per channel.

The one structural caveat is pre-existing and correctly documented: two *enabled*
mounts would resolve to the same topic and therefore the same channel object, and
both would pass the `source` check. `useRealtimeMessages.ts:474-475` notes that
one mount owns it — verified, `MessageInput.tsx:50` is
`const { sendNote } = useLoveNotes(false);`.

### 2. Retry-ceiling release: no double-release, no use-after-release, no leak

Traced in A-6. The `closingNoteChannels` entry is always removed by
`:118-123`'s `leaving.finally`, and `waitForNoteChannelLeaves` (`:144-153`)
terminates because a settled leave deletes its own entry before the continuation
runs. The broadcast handler at `:559-562` re-checks `subscriptionActive`, so a
released channel that still delivers cannot reach the store.

### 3. `report` / `feedKey` derivation

`:619-624`:

```
  const feedKey = enabled && userId ? userId : '';
  const status: NoteFeedStatus = !feedKey
    ? 'idle'
    : report?.key === feedKey
      ? report.status
      : 'connecting';
```

- **Account switch** A→B: `report.key === 'A' !== 'B'` → `connecting`. Correct.
- **Sign-out**: `userId` null → `feedKey === ''` → `idle`, and the component
  unmounts anyway (`App.tsx:592`). Correct.
- **`enabled` toggling**: `false` → `idle`; back to `true` with the same `userId`
  would show the pre-toggle report against a freshly opening channel. Not
  reachable — `enabled` is `autoFetch`, a per-call-site constant
  (`LoveNotes.tsx:47` and `MessageInput.tsx:50`). The docstring at `:180-184`
  claims more than the key delivers (it is an *account* tag, not a
  *subscription-generation* tag), but no current path exercises the gap. Worth a
  sentence in the comment; not filed as a finding.
- **Render loop**: filed as A-7. With the two current call sites there is no
  loop — `addNote` is a stable Zustand selector result and `onNewMessage` is
  `undefined`, so `handleNewMessage` is stable and `setReport` cannot feed back
  into the effect.

### 4. `moodSyncService`'s invariants

The diff touches only comments in that file (two hunks, both `/** … */` or `//`
text; no statement changed). `tests/unit/api/moodSyncSubscription.test.ts` passes,
including `"a dead channel's late CLOSED does not pin its replacement to
disconnected"` at `:529-569`. That case's mechanism — the status callback closing
over `newEntry` rather than looking the topic up (`moodSyncService.ts:646-660`) —
is untouched.

DW-138 correctly records that the mood path still has no rejoin for an unsolicited
CLOSED. The probe's line 5/7 (`[ 'SUBSCRIBED', 'CLOSED' ]`, channel deregistered)
independently confirms DW-138's premise.

### 5. Every SDK line number cited in the rewritten comments

All read from `node_modules` this session, `dist/module` build, realtime-js
2.116.0 / phoenix 0.4.5.

| citation | where cited | verified |
|---|---|---|
| `RealtimeClient.js:254-260` `removeChannel` | `realtimeSocket.ts:15`, `moodSyncService.ts:138` | ✅ `254: async removeChannel(channel) {` … `260: }` |
| `RealtimeClient.js:439-460` `_remove` → `_schedulePendingDisconnect` | `realtimeSocket.ts:17` | ✅ `439: _remove(channel) {`, `447: _schedulePendingDisconnect() {` |
| `RealtimeClient.js:646-647` `_disconnectOnEmptyChannelsAfterMs` | `realtimeSocket.ts:19` | ✅ `646:` / `647: … ?? 2 * (… ?? CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL)` |
| `HEARTBEAT_INTERVAL: 25000` | `realtimeSocket.ts:19` | ✅ `RealtimeClient.js:9: HEARTBEAT_INTERVAL: 25000,` — so 50 s, as claimed |
| `src/api/supabaseClient.ts:83-87` passes no override | `realtimeSocket.ts:20` | ✅ `83: realtime: {` … `87: },` — `params.eventsPerSecond` only |
| `RealtimeClient.js:340` `_cancelPendingDisconnect()` in `channel()` | `realtimeSocket.ts:23` | ✅ `340: this._cancelPendingDisconnect();` |
| `grep -c "_setConnectionState" RealtimeClient.js` is 0 | `realtimeSocket.ts:25` | ✅ re-ran: `0` |
| `isDisconnecting()` reads `connectionState() == 'closing'` | `realtimeSocket.ts:26-27` | ✅ `RealtimeClient.js:323-324` → `phoenix/socketAdapter.js:94-95`; `lib/constants.js:41-47` `closing: 'closing'` |
| `RealtimeChannel.js:100-101` `_onClose` hook | `useRealtimeMessages.ts:65`, `moodSyncService.ts:139` | ✅ hook spans `100-102`; `101: this.socket._remove(this);` |
| `RealtimeChannel.js:134` `if (this.channelAdapter.isClosed())` | `useRealtimeMessages.ts:77`, `:417`, `moodSyncService.ts:140` | ✅ exact |
| `RealtimeChannel.js:169` errored | `useRealtimeMessages.ts:420` | ✅ `169: this.state = CHANNEL_STATES.errored;` |
| `RealtimeChannel.js:604-612` `unsubscribe` resolves, never rejects | `useRealtimeMessages.ts:98`, `moodSyncService.ts:794` | ✅ exact; `608-610` resolve `'ok' \| 'timed out' \| 'error'`, no `reject` |
| `RealtimeClient.js:335-346` `channel()` returns the existing object | `useRealtimeMessages.ts:74` | ✅ exact |
| phoenix `channel.js:242` `state = leaving` | `useRealtimeMessages.ts:106`, `moodSyncService.ts:144`, contract test `:11` | ✅ `242: this.state = CHANNEL_STATES.leaving` |
| phoenix `channel.js:250-251` local `trigger("ok")` | `useRealtimeMessages.ts:106`, contract test `:12-13` | ✅ `250: leavePush.send()`, `251: if(!this.canPush()){ leavePush.trigger("ok", {}) }` |
| phoenix `channel.js:188` `canPush()` | contract test `:15` | ✅ `188: canPush(){ return this.socket.isConnected() && this.isJoined() }` |
| phoenix `channel.js:326` `isJoined()` | contract test `:16` | ✅ `326: isJoined(){ return this.state === CHANNEL_STATES.joined }` |
| phoenix `channel.js:76` `rejoinTimer.scheduleTimeout()` | `useRealtimeMessages.ts:317` | ✅ `76: if(this.socket.isConnected()){ this.rejoinTimer.scheduleTimeout() }` |
| phoenix `socket.js:137` `[1000, 2000, 5000][tries - 1]` | `useRealtimeMessages.ts:518` | ✅ exact (`|| 10000` tail not quoted, harmless) |
| `RealtimeChannel.js:148` `_onClose(() => callback(CLOSED))` | DW-110's reason | ✅ exact |

One imprecision, not filed separately: `useRealtimeMessages.ts:106-107` says the
phoenix close hook *"is what calls `socket.remove(this)`, so the client already
holds no channel under this topic"*. Phoenix's own `channel.js:70`
`this.socket.remove(this)` clears the *phoenix* socket's list; what frees the
topic for `supabase.channel()` is realtime-js's `RealtimeChannel.js:101`
`this.socket._remove(this)` → `RealtimeClient.js:440`'s filter of `this.channels`.
Both fire from the same close event, so the conclusion is right and the named
symbol is the wrong one of two.

---

## What I could not rule out

- **Real-network timing.** Everything above is static reading plus a fake-socket
  probe and the unit suites. I did not run Playwright (forbidden by the
  assignment: it touches shared local Supabase state), so the CLOSED→backoff→rejoin
  path was never exercised against a real Realtime server. A-6's interleaving in
  particular depends on real SDK rejoin timing that only an integration run can
  confirm the frequency of.
- **A-5's mutation.** I did not delete `useRealtimeMessages.ts:308` and re-run the
  suite, because the assignment forbids modifying implementation files. The claim
  is a mechanical read of two quoted blocks, but it is analysis, not a measured
  red.
- **`_disconnectOnEmptyChannelsAfterMs` at runtime.** I verified the default is
  computed at `RealtimeClient.js:646-647` inside `_initializeOptions` and that the
  app passes no override; I did not observe the resolved value on a live client.
  The class-field initializer at `RealtimeClient.js:165` is `0`, so the 50 s figure
  depends on `_initializeOptions` running — which the constructor does, but I read
  that from the method's placement rather than from a call trace.
- **`tests/unit/api/ephemeralBroadcast.test.ts:15` and `:94`** carry the same
  refuted "~100ms" claim as A-2/A-3 but sit outside the assigned change scope. Not
  investigated further; flagged so the next sweep can decide whether they belong
  with DW-112.
