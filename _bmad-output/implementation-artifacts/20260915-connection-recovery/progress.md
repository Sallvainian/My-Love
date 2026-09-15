# Progress

Baseline `3f0d951b`. Commits on `fix/connection-recovery-user-facing`, in order.

| Commit | Scope |
| --- | --- |
| `2d1cd8a0` | `fix(realtime)`: CLOSED handling, retry-ceiling release, feed status through to LoveNotes |
| `1f067667` | `docs(realtime)`: SDK citations corrected; the DW-109 refutation pinned as a test |
| `e6a81cc0` | `fix(auth)`: `code-expired` outcome, sign-in dead end, reset-link assertion |
| `09b837e1` | `fix(partner)`: seed-name rule at the third reader; contrast, with a generalised guard |
| `c0c0defa` | `test(unit)`: production base path, with the two halves extracted and put together |
| `a5e9f8e5` | `test(e2e)`: live mood delivery through the browser |
| `cb650fe1` | `chore(deferred-work)`: 21 entries closed, ledger's own records repaired, 3 raised |

## What was measured rather than assumed

**DW-109 is refuted.** The entry describes a `phx_leave` answered `'error'` leaving the channel
stuck in `leaving` while `removeChannel` resolves anyway. Driving a real `RealtimeClient` over a
fake transport showed the opposite: a leave the server *never answers at all* still resolves `'ok'`,
still moves the channel to `closed`, still leaves the client registry, and the next
`channel(topic)` returns a new object. The cause is one line of ordering —
`@supabase/phoenix assets/js/phoenix/channel.js:242` sets `state = leaving` before `:251` tests
`canPush()`, and `canPush()` requires `isJoined()` (`:188`, `:326`) — so the check is always false
and `leavePush.trigger("ok", {})` fires locally and synchronously. Nothing waits for the server, so
the server's answer cannot wedge anything.

Two sub-claims of DW-109 were true and were acted on: `unsubscribe()` has no rejection path
(`RealtimeChannel.js:604-612`), so both registries' `.catch()` guards something unreachable and both
comments said otherwise; and the existing case at `useRealtimeMessages.test.ts:306` drove a shape
the real client cannot produce.

**The same exercise made DW-110's warning concrete.** Every deliberate leave reports CLOSED too, so
a naive CLOSED-means-failure handler would reopen the topic on every unmount. That is why the fix
carries two guards rather than one.

**DW-135, DW-136 and DW-137 were already satisfied** by session 1's `dfca89a9`. Rather than take
that from reading, each guard was deleted in turn and the suite re-run: the version half of
`stillCurrent()` takes three cases down, the inner recheck takes one, the `.catch()` takes one. The
one surviving sub-claim — that the test double rethrew where production swallows — was real and is
fixed, and the mutant still dies afterwards, so the case was green for the right reason.

**DW-121's premise is gone.** Session 1's `5dd934b0` replaced the line the entry wanted a lint rule
for; `grep -rn "\.moods && .*\.moods\.length" src/` now returns nothing.

**DW-132 is unreachable at the installed SDK** and was guarded anyway, because our own `AuthResult`
permits the shape and the SDK is pinned only by a caret range.

**DW-125's root cause was structural.** The composition and the stripping are inverse operations
that lived in different files, so the round trip — the only property that matters — could not be
expressed by either call site. Extracting them is what made it assertable.

## Deliberate non-actions

- No CLOSED rejoin was added to `moodSyncService`. DW-110's `location:` names the hook alone, and
  the service has no retry loop to route a status into; building one is a different change. Raised
  as DW-138 rather than done quietly.
- No axe scan was added for the two contrast fixes. `AnniversarySettings` carries no test ids, and
  the one existing axe spec scopes itself away from that component deliberately. A palette-grounded
  invariant covering every `text-white` + `bg-*` pairing was written instead.
- `closingNoteChannels` stays unexported. The reported feed status is what makes the wedged state
  observable, which is what DW-113 was asking for.
- The leave registries are kept although both are now provably defensive, because removing them is
  scope beyond these entries and DW-111 already recorded three registries as accepted.
