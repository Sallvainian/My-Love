---
title: 'DW-411: The Mood screen looks its partner up again when the session renews'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'a933dd2432af9a15572a0e03396e5081e16568dc'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `MoodTracker`'s partner lookup runs on mount and when `store.partner.id` changes. After a boot on a stored session the SDK cannot use, that lookup fails (`status: 'error'`), nothing re-runs it on `TOKEN_REFRESHED`, and the partner card stays unmounted until the Mood screen is re-entered.

**Approach:** In the same effect, listen for `TOKEN_REFRESHED` for the signed-in user and re-run the lookup on the next task. Keep the rule that only a conclusive answer (`linked`/`unlinked`) writes `partnerId`. Prove it with unit tests, and change the renewal E2E to see the card appear and receive the partner's mood live on the open Mood screen, with no navigation.

## Boundaries & Constraints

**Always:**
- An `error` lookup never writes `partnerId`. `unlinked` nulls it and `linked` sets it.
- A result is dropped after unmount, or when a later-started lookup has already written its answer.
- The auth listener stays synchronous and defers the lookup with `setTimeout(…, 0)`. auth-js awaits its listeners, and a nested auth call can deadlock (`useRealtimeMessages.ts:713-716`).
- Only `TOKEN_REFRESHED` whose `session.user.id` equals `useAuth().user.id` triggers a lookup. The effect cleanup unsubscribes the listener.
- E2E: keep every existing rule of the spec (fresh sessions, listeners armed before load, own-row teardown, no page clock).

**Never:**
- Do not change `lookupPartnerId`, `usePartnerMood`, `PartnerMoodDisplay` or the session guard.
- Do not call `supabase.channel()`, and do not add a store field.
- Do not re-run the lookup on other auth events.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Renewal recovers card | mount lookup → error, then `TOKEN_REFRESHED` for this user, lookup → linked | card mounts with the partner id | — |
| Renewal, lookup fails | card shown, `TOKEN_REFRESHED`, lookup → error | card kept | — |
| Renewal, unlinked | card shown, `TOKEN_REFRESHED`, lookup → unlinked | card removed | — |
| Other user / other event | `TOKEN_REFRESHED` for another id, or `SIGNED_IN` for this one | no lookup | — |
| Unmounted | unmount, then `TOKEN_REFRESHED` | listener unsubscribed; no lookup | — |
| Out-of-order answers | mount lookup still pending, renewal lookup → unlinked, then mount lookup → linked | no card (the newer answer stands) | — |

</intent-contract>

## Code Map

- `src/components/MoodTracker/MoodTracker.tsx:103-123`: the `loadPartnerId` effect, keyed on `storePartnerId`. Add `userId` (`user?.id ?? null`, `user` comes from `useAuth()` at `:51`) to the deps. Register `supabase.auth.onAuthStateChange` inside it, import `supabase` from `../../api/supabaseClient` beside `lookupPartnerId`, and add a started/applied sequence counter for the ordering guard. Extend the effect's comment with the renewal reason. Copy the listener pattern from `src/services/dateRemindersAtLaunch.ts:280-292`.
- `src/components/MoodTracker/__tests__/MoodTracker.partnerLink.test.tsx`: its `supabaseClient` mock has `auth: {}`. Add an `onAuthStateChange` stub that captures the listener and an unsubscribe spy. Add one test per matrix row next to the two existing tests.
- The `supabaseClient` mocks in `MoodTracker.draftPreservation.test.tsx:92-95`, `MoodTracker.syncBadge.test.tsx:46-49`, `MoodTracker.todayLabel.test.tsx:77-80` and `moodArrayGuards.test.tsx:87-100` (all in `src/components/MoodTracker/__tests__/`) all carry `auth: {}`. Add a no-op `onAuthStateChange` returning `{ data: { subscription: { unsubscribe } } }`, or the render throws. No shared stub exists in `tests/support`.
- `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts`: header comment `:23-28`, Mood leg `:389-402`. Arm `moodJoined` with the other renewal waits, before the `unroute` loop. Before the renewal, assert `partner-mood-display` and `partner-mood-error` both have count 0 on `mood.page`. After `renewals`, assert `partner-mood-display` is visible with no navigation, await `moodJoined`, and assert `partner-mood-error` has count 0. Remove the `navigateTo` home/mood hop, and its import if nothing else uses it. Keep the final `partner-mood-note` assertion.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/MoodTracker/MoodTracker.tsx`: re-run the lookup on this user's `TOKEN_REFRESHED`, conclusive answers only, applied in start order. Without it the card never mounts after a stale boot.
- [ ] `src/components/MoodTracker/__tests__/MoodTracker.partnerLink.test.tsx`: cover every matrix row.
- [ ] The other four MoodTracker test files: add the `onAuthStateChange` no-op to their mocks so they still render.
- [ ] `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts`: the card appears in place after the renewal, and its comments describe the new behaviour.

**Acceptance Criteria:**
- Given A boots on `/mood` on an expired stored session with the refresh endpoint blocked, when the endpoint is unblocked and the token renews, then the partner card appears on that same screen with no error card and no navigation.
- Given that card has appeared, when the partner logs a mood with a note, then A's card shows the note live.

## Implementation Notes

- Implemented by a Sonnet subagent. Verified in the main session: `npx vitest run src/components/MoodTracker` (8 files, 74 tests), `npm run test:unit` (224 files, 3872 tests), `npm run typecheck`, `npm run lint`, and the E2E on the local stack (1 passed, 1.7 min) all green. The subagent's revert check: with the renewal listener's callback returning early, the E2E fails at the card-visible assertion.
- E2E deviation: right after the renewal the partner has logged no mood yet, so `PartnerMoodDisplay` renders its empty state (`no-mood-logged-state`), not `partner-mood-display`. The card check is therefore `partner-mood-display` or `no-mood-logged-state`, the same `.or()` pattern as `theme-sweep.spec.ts:87`. The later `partner-mood-note` assertion still proves the live mood.
- The listener also returns early when the effect has already been torn down (`!mounted`). That is redundant with the unsubscribe, but harmless.
- The main session wrapped the new over-100-column lines (four test mocks, one listener guard) by hand to match the Prettier style. No formatter was run on any file.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` partnerLink test "unsubscribes on unmount…" never fires `TOKEN_REFRESHED`, so deleting the listener's `!mounted` guard or the cleanup's `clearTimeout` keeps the suite green. Confirmed. Fixed: two tests replace it. One emits a renewal and unmounts before the deferred lookup runs. The other calls a saved listener after unmount. Both assert one lookup. The implementer deleted each guard in turn and the matching test failed.
  - `[low]` `[patch]` The E2E pre-renewal check is a snapshot that leaves out `loading-state`, while its comment claims the lookup has failed. Confirmed: nothing waits for MoodTracker's own lookup, and other lookups' errors are not specific to it. Fixed: `loading-state` is asserted absent too, and the comment now says only what is checked.
  - `[low]` `[reject]` `moodJoined`, now armed before the unroute with a 240 s timeout, could match a mood-channel join that is not the card's (`usePartnerLinkListener`). Real as a gap in what the assertion can tell apart, but unlikely to occur. In this run's trace the mood context logged no mood-channel join before the renewal, and one join after it, which delivered the mood to `usePartnerMood`. The link listener subscribes only when a partner load settles with no partner and no error, which this linked pool account does not answer. If it did, the result would be a flake that the final `partner-mood-note` assertion catches, not a false pass. A card-specific join signal would add new logging surface.

## Design Notes

The intent asks the E2E to show "the card (and the usePartnerMood realtime-lost error path it hides)" after the renewal. Before the renewal the card cannot mount: the lookup reads `users` with an expired token, so it answers `error`. It mounts only after `TOKEN_REFRESHED`, on a valid token, so its join succeeds and the "Real-time connection lost" card never appears from this boot. The E2E can therefore show only that the card, and the `usePartnerMood` subscription it was hiding, now runs after the renewal: no card before, then the card with no error card and the mood arriving live. The error-then-clear transition stays covered by `usePartnerMood.test.ts`, as before.

Effect sketch:
```ts
let started = 0, applied = 0;
const loadPartnerId = async () => {
  const seq = ++started;
  const lookup = await lookupPartnerId();
  if (!mounted || lookup.status === 'error' || applied > seq) return;
  applied = seq;
  setPartnerId(lookup.status === 'linked' ? lookup.partnerId : null);
};
```

## Verification

**Commands:**
- `npx vitest run src/components/MoodTracker` -- expected: all pass
- `npm run test:unit` -- expected: all pass
- `npm run typecheck && npm run lint` -- expected: exit 0 (on TS2883 only, compare against the worktree baseline)
- `npx playwright test tests/e2e/partner/realtime-recovery-after-renewal.spec.ts --project=chromium` (local stack running) -- expected: pass. Then, with the renewal listener's callback returning early, expected: fail at the card-visible assertion.


## Auto Run Result

Status: built

**Summary:** The Mood screen now looks its partner up again when this user's session renews (`TOKEN_REFRESHED`). A boot on a stored session the SDK cannot use no longer leaves the partner card unmounted until the screen is re-entered. Only a conclusive answer writes the partner, and answers are applied in the order their lookups started. The renewal E2E now sees the card appear on the open Mood screen, with no navigation, and receive the partner's mood live.

**Files changed:**
- `src/components/MoodTracker/MoodTracker.tsx`: a user-scoped, deferred `TOKEN_REFRESHED` listener in the partner-lookup effect re-runs `lookupPartnerId`. It has a start-order guard, and cleanup unsubscribes the listener and clears the timer.
- `src/components/MoodTracker/__tests__/MoodTracker.partnerLink.test.tsx`: one or more tests per I/O matrix row, 7 new.
- `MoodTracker.draftPreservation`, `MoodTracker.syncBadge`, `MoodTracker.todayLabel` and `moodArrayGuards` tests: no-op `onAuthStateChange` in their `supabaseClient` mocks.
- `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts`: before the renewal, no card, loading state or error card. After it, the card appears in place, with no `navigateTo` hop, and receives the mood live.

**Review findings (this pass):** 3 findings, all low.
- 2 patches applied:
  - The unmount unit tests now fire a renewal.
  - The E2E pre-renewal check now includes `loading-state`, and its comment was corrected.
- 0 deferred.
- 1 rejected: the `moodJoined` log match could in principle come from `usePartnerLinkListener`'s join. The run's trace shows no such join, it is unlikely for a linked account, and the final note assertion catches it.

**Follow-up review recommended:** false. First pass, patched high 0, medium 0, low 2.

**Verification:**
- `npx vitest run src/components/MoodTracker`: 8 files, 75 tests passed.
- `npm run test:unit`: 224 files, 3873 tests passed.
- `npm run typecheck` and `npm run lint`: both exited 0.
- The E2E on the local stack: 1 passed in 1.7 min, both before and after the patches.
- Revert checks by the implementer:
  - With the renewal callback returning early, the E2E fails at the card-visible assertion.
  - Deleting `clearTimeout` fails one of the new unmount tests, and deleting the `!mounted` guard fails the other.

**Residual risks:**
- The E2E still depends on auth-js renewal timings (25 s init retries, 60 s cooldown, 30 s ticker).
- The "Real-time connection lost" error card cannot be reached from a stale boot, because the card mounts only on a valid token. Its clearing stays covered by `usePartnerMood.test.ts` only.
- Each renewal while the Mood screen is open costs one extra `users` read, roughly hourly.
