---
title: 'DW-378/DW-391: Realtime recovers after the token renews or a re-arm fails'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '11fc54a44f95e59776974cfbce403caf9705f492'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: 'After a stale-session boot the Mood screen never mounts the partner card, so a later renewal cannot bring it back until the screen is re-entered; the usePartnerMood realtime-lost error is therefore unreachable from that boot.'
    evidence: 'MoodTracker looks its partner up through lookupPartnerId on mount and again only when store.partner.id changes; on a boot whose stored session the SDK cannot use that lookup fails and nothing re-runs it on TOKEN_REFRESHED. Observed in tests/e2e/partner/realtime-recovery-after-renewal.spec.ts on the local stack: no card and no error card after TOKEN_REFRESHED; Home then Mood mounts it.'
    location: 'src/components/MoodTracker/MoodTracker.tsx (loadPartnerId effect)'
    severity: low
---

<intent-contract>

## Intent

**Problem:** When the app boots on a stored session the SDK cannot use (expired token, refresh blocked), Realtime joins with the publishable key and recovers only once `TOKEN_REFRESHED` arrives. Two consumers do not recover: pokes/kisses keep a null partner snapshot (no second `SUBSCRIBED` fires on the public interactions channel), so every live poke is rejected as "from no partner"; and `usePartnerMood` never clears "Real-time connection lost. Refresh to reconnect." on a later `SUBSCRIBED`. Separately, `useRealtimeMessages` `rearm()` leaves the love-notes feed stuck `reconnecting` with no channel when its `openChannel` rejects.

**Approach:** Re-resolve the interactions partner snapshot when this account's token renews (conclusive answers only, same rule as the `SUBSCRIBED` re-resolve); clear the realtime-lost error in `usePartnerMood` on a later `SUBSCRIBED`; in `rearm()`'s catch restore `gaveUp = true` and report `disconnected`. Prove all three with unit tests and one local-stack E2E that blocks the token endpoint, lets the token renew, and sees a partner mood, note and poke arrive live.

## Boundaries & Constraints

**Always:**
- An inconclusive (`status: 'error'`) partner lookup never overwrites `interactionPartnerId`; a conclusive `unlinked` nulls it.
- Every write after an await re-checks `active`, `userId` and `authSessionVersion`, as the existing `SUBSCRIBED` re-resolve does.
- The auth listener stays synchronous and defers its work with `setTimeout(…, 0)` (auth-js awaits listeners; a nested auth call can deadlock — see `useRealtimeMessages.ts:703-716`).
- Only `TOKEN_REFRESHED` whose `session.user.id` equals the subscribed user triggers the re-resolve; teardown removes the auth listener.
- E2E: import `{ test, expect }` from `tests/support/merged-fixtures.ts`; never link/unlink partners or null shared rows; delete only rows the spec created; attach listeners/counters before the page loads; no page clock.

**Never:**
- Do not call `supabase.channel()` in new code, change `moodSyncService`, the session guard, or the love-notes re-arm triggers.
- Do not clear `usePartnerMood`'s load error ("Unable to load partner mood…") or the subscribe-throw error on `SUBSCRIBED` — only the realtime-lost message.
- Do not reuse the worker's shared storageState session for the renewing contexts: a refresh rotates its refresh token and can revoke the session family other specs in the worker use.
- Do not add a history catch-up read on renewal (out of scope).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Renewal recovers pokes | snapshot null (lookups failed), then `TOKEN_REFRESHED` for this user, lookup → linked | snapshot = partner; next partner poke is added | — |
| Renewal, lookup fails | snapshot = partner, `TOKEN_REFRESHED`, lookup → error | snapshot unchanged | debug log only |
| Renewal, unlinked | `TOKEN_REFRESHED`, lookup → unlinked | snapshot null | — |
| Other user / torn down | `TOKEN_REFRESHED` for another id, or after unsubscribe / sign-out | no lookup, no write | — |
| Mood recovers | `CHANNEL_ERROR` then `SUBSCRIBED` | error null, status connected | — |
| Mood load failed | load error set, then `SUBSCRIBED` | load error kept | — |
| Re-arm open rejects | gave up, `online`, `setAuth` rejects | status `disconnected`, no channel; next `online` opens one channel, status `reconnecting` | error logged |

</intent-contract>

## Code Map

- `src/api/interactionService.ts:319-372` -- `subscribeInteractions(userId, callback, onStatusChange, onDeliveryArmed?)`. Add optional 5th `onTokenRenewed?: () => void`; register `supabase.auth.onAuthStateChange` only when it is passed; unsubscribe it in the returned teardown (same `removed` guard). Update the JSDoc params.
- `src/stores/slices/interactionsSlice.ts:438-520` -- `subscribeToInteractions`. Extract the `SUBSCRIBED` re-resolve (`:478-500`) into one closure and call it from both `SUBSCRIBED` and the new `onTokenRenewed`; keep its comments' reasoning.
- `src/hooks/usePartnerMood.ts:89-96` -- status callback; on `SUBSCRIBED` clear the error only when it is the realtime-lost string (use a shared const for the message, functional `setError`).
- `src/hooks/useRealtimeMessages.ts:685-701` -- `rearm()` catch: unless `cancelled`, a give-up already happened, or `channelRef.current` is set, restore `gaveUp = true` and `setReport({ key: currentUserId, status: 'disconnected' })`.
- `tests/unit/api/interactionService.test.ts:97-115` -- supabase mock lacks `auth`; add an `onAuthStateChange` stub capturing the listener + unsubscribe spy. Existing cases at `:149-228`.
- `tests/unit/stores/interactionsSubscription.test.ts` -- mocks `InteractionService.subscribeInteractions`; capture the 5th arg alongside `reportStatus`; reuse `resolvePartnerId`, `lookupHandled`.
- `src/hooks/__tests__/usePartnerMood.test.ts` -- existing hook tests to extend.
- `src/hooks/__tests__/useRealtimeMessages.retry.test.ts:270-375` -- `driveToGiveUp()`, `mocks.setAuth`, `mocks.authListener`; add the rejected-open case next to the re-arm cases.
- E2E references: partner context from stored state `tests/e2e/partner/partner-mood-realtime.spec.ts:165-175`; mood send UI `:243-277`; note send UI `tests/e2e/notes/love-notes-realtime.spec.ts:225-274`, receive `love-note-message`; poke via `supabaseAdmin.from('interactions').insert(createInteractionInsert(...))` (`tests/e2e/offline/interactions-offline-copy.spec.ts:43-52`, factory `tests/support/factories/interaction-record-ownership.ts`), cleanup `deleteRowById` (`tests/support/helpers/teardown.ts:20`); ids `resolveOwnPair` (`tests/support/helpers/events.ts:70`); read patterns `tests/support/helpers/reads.ts`; `navigateTo` `tests/support/helpers/navigation.ts:25`; stored-session key `sb-127-auth-token` (`tests/support/auth/supabase-auth-provider.ts:143-152`); worker credentials from `tests/support/auth/worker-pool.ts`. Mood card on `/mood`: `PartnerMoodDisplay` (`partner-mood-error`, `partner-mood-display`). Pokes render only on `/partner` (`PokeKissInterface` inside `PartnerMoodView.tsx:733`).

## Tasks & Acceptance

**Execution:**
- [x] `src/api/interactionService.ts` -- add `onTokenRenewed` with the deferred, user-scoped `TOKEN_REFRESHED` listener and teardown -- the public channel never re-fires `SUBSCRIBED` after `setAuth`.
- [x] `src/stores/slices/interactionsSlice.ts` -- share the conclusive-only re-resolve between `SUBSCRIBED` and `onTokenRenewed` -- recovers the snapshot after renewal.
- [x] `src/hooks/usePartnerMood.ts` -- clear the realtime-lost error on `SUBSCRIBED` -- card stops showing the error once delivery is back.
- [x] `src/hooks/useRealtimeMessages.ts` -- restore `gaveUp` and report `disconnected` in `rearm()`'s catch -- a later signal can re-arm.
- [x] `tests/unit/api/interactionService.test.ts`, `tests/unit/stores/interactionsSubscription.test.ts`, `src/hooks/__tests__/usePartnerMood.test.ts`, `src/hooks/__tests__/useRealtimeMessages.retry.test.ts` -- cover every I/O matrix row.
- [x] `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts` -- new `[P1] DW-378-E2E-001` spec per Design Notes.

**Acceptance Criteria:**
- Given A boots on an expired stored session with the refresh endpoint blocked and is on `/partner`, when the endpoint is unblocked and the token renews, then a poke the partner sends afterwards appears on A's screen without a reload or a new interactions read.
- Given A is on `/mood` in that state and the card shows "Real-time connection lost. Refresh to reconnect.", when the token renews and the partner logs a mood, then the error card is gone and A's partner-mood card shows that mood.
- Given A is on `/notes` in that state, when the token renews and the partner sends a note, then the note appears in A's thread live.
- Given the love-notes feed gave up and a re-arm's open rejects, when a later `online` or renewal arrives, then the feed opens one channel and reports `reconnecting`.

## Implementation Notes

- Implemented by a Sonnet subagent; verified in the main session: targeted vitest (5 files, 112 tests), `npm run test:unit` (224 files, 3771 tests), `npm run typecheck`, `npm run lint`, and the new E2E on the local stack (1 passed, 1.7 min) all green.
- `interactionService.subscribeInteractions` registers its auth listener only when `onTokenRenewed` is passed, so the existing callers and mocks without `supabase.auth` are unaffected; teardown unsubscribes it and drops a callback already queued.
- E2E deviations, found by running it: (1) a cold stale boot shows "Couldn't load your partner" on `/partner` and never mounts the poke tiles, so that context first saves the partner local copy on a valid session, then expires the stored session and reloads; it asserts `interactionPartnerId` is null before the renewal and the partner after it. (2) Realtime confirms row delivery to the renewed identity about 6 s after `TOKEN_REFRESHED`, so the poke is inserted only after `postgres_changes subscription confirmed` and the history re-read it triggers have settled; the spec then checks no interactions read started after the insert. (3) `MoodTracker` never mounts the partner card after a stale boot (recorded in frontmatter `deferred`), so the Mood context is re-entered after the renewal and the mood is seen arriving live there; the realtime-lost error clearing is covered by `usePartnerMood.test.ts` only.
- The `rearm()` fix is unit-covered only: the E2E has no way to make `setAuth` reject.
- The subagent also edited `deferred-work.md` (closing DW-378/DW-391 and adding an entry); that edit was reverted because the orchestrator owns the ledger, and the new finding moved to frontmatter `deferred`.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 9 findings — high 0, medium 2, low 6, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` usePartnerMood: a load error overwritten by CHANNEL_ERROR is then cleared by SUBSCRIBED, so the card shows "no mood logged" although the read failed — confirmed: the CHANNEL_ERROR branch set the lost-connection message unconditionally. Fixed: CHANNEL_ERROR/TIMED_OUT keep an existing `LOAD_ERROR` (shared const); unit test added for load error → CHANNEL_ERROR → SUBSCRIBED.
  - `[low]` `[reject]` useRealtimeMessages: a signal arriving while a re-arm's open is in flight is lost if that open then rejects — real (retry count is 0 so `signalWhileRetrying` is not set), but it needs a rejecting `setAuth` and a concurrent renewal at once, and the fix adds a flag and a re-arm branch.
  - `[low]` `[patch]` AC4 tested only for `online`, not renewal — confirmed. Fixed: added a rejected re-arm case recovered by `TOKEN_REFRESHED` for this user.
  - `[low]` `[reject]` AC2 not shown end to end: the E2E never sees the realtime-lost card — real, but the scenario cannot be reached from a stale boot (`MoodTracker` never mounts the card; recorded in frontmatter `deferred`). The intent asks only for the error clearing and for a live mood in the E2E, which the re-entered Mood screen shows. The only fix is to edit this build's plan, and the clearing is unit-covered.
  - `[medium]` `[patch]` E2E interactions read counters were attached after the `/partner` reload, against the AGENTS.md counters-before-load rule (0165f921) — confirmed. Fixed: a `trackReads` helper attaches the counters right after `newPage()`, before the first `goto` and the reload.
  - `[low]` `[patch]` E2E receiving contexts leak when a boot fails — confirmed: the close was deferred only after `Promise.all`. Fixed: each boot helper registers its context's close as soon as it creates the context.
  - `[low]` `[patch]` E2E note not proven live — confirmed: there was no love-notes read counter. Fixed: `love_notes_visible` reads are counted from before the load. The spec waits for none in flight before sending and asserts none started between the send and the note appearing.
  - `[low]` `[patch]` the unit test for row 1 of the matrix used a conclusive `unlinked`, not the inconclusive `error` of a stale boot — confirmed against `lookupPartnerId`. Fixed: the pre-subscribe lookup now rejects, and the comment was corrected.
  - `[false]` `[reject]` the deferred finding is recorded only in plan frontmatter, not the ledger — the run forbids ledger edits, and bmad-loop harvests the frontmatter `deferred` list into the ledger (`bmad_loop/devcontract.py:309` `DEFERRED_FIELD`, read in `engine.py:6099`).

### 2026-11-02 — Review pass (follow-up)
- verdicts: 5 findings — high 0, medium 0, low 3, false 2, maybe-false 0
- findings:
  - `[low]` `[reject]` AC2 not shown end to end: the E2E never sees the realtime-lost card and re-mounts the Mood screen, so the `usePartnerMood` SUBSCRIBED branch never runs there — carried: same claim as the first pass's AC2 row, and the spec still re-enters Mood after the renewal (`realtime-recovery-after-renewal.spec.ts:395-402`). The new sub-claim that a re-read could show the mood is false: `usePartnerMood` reads only when `partnerId` changes (`usePartnerMood.ts:50-128`), and the card mounts and joins before the partner logs the mood.
  - `[false]` `[reject]` the revert check has no recorded result, and the poke leg may pass without the new renewal path — disproved by running it: with the slice's `onTokenRenewed` callback returning early, the E2E fails at "the poke screen re-resolves its partner after the renewal" (Expected the partner id, Received null). The mood and `rearm()` legs cannot fail on a revert, as the Implementation Notes already state; the only fix for that part would be to edit this build's plan.
  - `[low]` `[patch]` "keeps the snapshot when the lookup after renewal is inconclusive" passes even when the renewal callback is never wired — confirmed: the test asserted only the snapshot subscribe had already set. Fixed: it now asserts `partnerLookups` has length 2. With the renewal callback disabled, this test and three others in the block fail.
  - `[low]` `[patch]` the `lookupHandled` doc comment says the re-join is the slice's only `.then` on a lookup — confirmed: `reResolvePartner` also runs from the renewal callback (`interactionsSlice.ts:529-532`). Fixed: the comment names both.
  - `[false]` `[reject]` the DW-411 ledger heading is truncated — the truncation is real, but bmad-loop's harvest wrote it into the uncommitted ledger, not this change's code. This run is forbidden to edit ledger entries, and the full sentence is in this plan's frontmatter `deferred.summary`.

## Design Notes

Recovery timing (auth-js 2.118, read from `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js`): expiry is decided by `expires_at` alone, with a 90 s margin; set it to about now − 120 s. With `**/auth/v1/token?grant_type=refresh_token*` aborted, init retries for ~25 s, then `INITIAL_SESSION` fires null and the app logs `INITIAL_SESSION carried no session; using the stored one`. The failure is cached for a 60 s cooldown. After unblocking, `TOKEN_REFRESHED` lands ~85–115 s after load via the 30 s ticker or a heartbeat `setAuth`. Use a 300 s test timeout.

E2E shape: a fresh `signInWithPassword` session for A per receiving context (three contexts: `/mood`, `/partner`, `/notes`), seeded into `sb-127-auth-token` with `expires_at` in the past, before load. Block the refresh route in each context. Wait for the warning, then assert the `/mood` card shows the realtime-lost error. Unroute, then wait for a 200 from the refresh endpoint in each context. The partner context (fixture storage state) then logs a mood (UI on `/mood`) and sends a note (UI on `/notes`); the poke is an admin insert from partner to A. Track interactions reads on the `/partner` context to prove the poke was live. Clean up the mood, note and poke rows by their unique text/id.

Slice re-resolve sketch:
```ts
const reResolvePartner = () => void interactionService.resolvePartnerLookup().then((lookup) => {
  if (!active || !ownsSession(currentUserId, subscribedInSession)) return;
  if (lookup.status === 'error') { logger.debug(...); return; }
  set({ interactionPartnerId: lookup.status === 'linked' ? lookup.partnerId : null });
});
```

## Verification

**Commands:**
- `npx vitest run tests/unit/api/interactionService.test.ts tests/unit/stores/interactionsSubscription.test.ts tests/unit/stores/interactionsCatchUp.test.ts src/hooks/__tests__/usePartnerMood.test.ts src/hooks/__tests__/useRealtimeMessages.retry.test.ts` -- expected: all pass
- `npm run test:unit` -- expected: all pass
- `npm run typecheck && npm run lint` -- expected: clean (compare against the worktree TS2883 baseline on `main` if it appears)
- `npx playwright test tests/e2e/partner/realtime-recovery-after-renewal.spec.ts --project=chromium` (local stack running) -- expected: pass; then run it again with each src fix reverted in turn to confirm it fails


## Auto Run Result

Status: built

**Summary:** Live delivery now recovers after a session renews or a re-arm fails. Pokes and kisses re-resolve the partner snapshot on this account's `TOKEN_REFRESHED` and accept only conclusive answers. The partner-mood card clears "Real-time connection lost" on a later `SUBSCRIBED` but keeps a load failure. When the love-notes `rearm()` open rejects, it restores its give-up state and reports `disconnected`, so the next `online` or renewal re-arms. A local-stack E2E blocks the refresh endpoint, lets the token renew, and sees a partner poke, note and mood arrive live. This follow-up pass tightened one unit test and corrected one test comment.

**Files changed:**
- `src/api/interactionService.ts`: optional `onTokenRenewed` on `subscribeInteractions`; the user-scoped `TOKEN_REFRESHED` listener runs a task later and is removed on teardown.
- `src/stores/slices/interactionsSlice.ts`: one conclusive-only `reResolvePartner`, shared by `SUBSCRIBED` and the renewal.
- `src/hooks/usePartnerMood.ts`: `SUBSCRIBED` clears only the lost-connection message; `CHANNEL_ERROR`/`TIMED_OUT` keep a load error.
- `src/hooks/useRealtimeMessages.ts`: the `rearm()` catch restores `gaveUp` and reports `disconnected`.
- `tests/unit/api/interactionService.test.ts`, `tests/unit/stores/interactionsSubscription.test.ts`, `src/hooks/__tests__/usePartnerMood.test.ts`, `src/hooks/__tests__/useRealtimeMessages.retry.test.ts`: cover every I/O matrix row. This pass made the inconclusive-renewal test assert that a lookup started, and fixed the `lookupHandled` comment.
- `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts`: new `[P1] DW-378-E2E-001`.

**Review findings (this pass):** 5 findings. 2 patches applied, both low: the inconclusive-renewal unit test now asserts a lookup started, and the stale `lookupHandled` comment was fixed. 0 deferred. 3 rejected:
- AC2 not shown end to end: carried from the first pass. The re-read sub-claim is false, because `usePartnerMood` reads only on a `partnerId` change.
- Revert check unrecorded and the poke leg unproven: false. With the slice's renewal callback disabled, the E2E fails at the partner re-resolve.
- Truncated DW-411 ledger heading: false as a defect of this change. bmad-loop's harvest wrote it, the run forbids ledger edits, and the full text is in frontmatter `deferred`.

**Follow-up review recommended:** false. This is a follow-up pass and it patched no `high` (patched: high 0, medium 0, low 2).

**Verification:**
- Targeted vitest (the 5 files in `## Verification`): 114 passed.
- `npm run test:unit`: 224 files, 3773 tests passed.
- `npm run typecheck` and `npm run lint`: both exited 0.
- The new E2E on the local stack (Supabase CLI 2.122.0): 1 passed in 1.7 min.
- Revert checks this pass, slice restored after each:
  - With the slice's `onTokenRenewed` callback returning early, 4 of 5 `when the token renews` unit tests fail. That includes the tightened one.
  - With the same revert, the E2E fails at "the poke screen re-resolves its partner after the renewal" (received null).
- The `usePartnerMood` and `rearm()` reverts were not E2E-checked, because the E2E cannot reach those states (see Implementation Notes).

**Residual risks:**
- The E2E depends on auth-js timings: 25 s init retries, a 60 s cooldown and a 30 s ticker. An auth-js upgrade that changes them can stretch or break it.
- The `usePartnerMood` and `rearm()` fixes have unit coverage only.
- After a stale boot the Mood screen never mounts the partner card until it is re-entered (frontmatter `deferred`, DW-411).
- Each E2E run leaves three server sessions for the pool user. They expire on their own.
