---
title: 'Poke and kiss history offline'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: 'e0ea80551d93958e15168b36f069ebd7feba54df'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The poke/kiss history lives in memory only and is read from the server only when the history sheet opens, so offline after a reload the sheet shows "No interactions yet" and the unviewed badge reads 0 (CAP-1). Nothing loads it on start or reconnect (CAP-2).

**Approach:** Interactions join the local-copy mechanism as kind `interactions`: shown from the copy first, replaced and saved after each successful server read, and refreshed by a registered refresher on start and reconnect. Every confirmed change to the list (incoming Realtime row, own confirmed send, confirmed mark-as-viewed) rewrites the copy. Sending still needs a connection.

## Boundaries & Constraints

**Always:** Follow the `localCopy.ts` header rules. Capture `{ userId, authSessionVersion }` before the first await and re-check both before every state write and copy write; write under the captured `userId`. The copy stores plain data (`createdAt` as an ISO string) and is parsed back with a shape guard; a copy that fails the guard is ignored whole. A failed server read changes nothing; an empty server answer saves `[]`. The badge count is recomputed from the list (received and unviewed only) whenever the list is set from the copy or the server.

**Never:** No change to the send path's offline refusal, `markAsViewed`'s server-first order (never flip `viewed` locally without server success), or the Realtime channel (no migration to the `moodSyncService` registry, no new channel). No `DB_VERSION` change, no Zustand persist change. No new offline notice (CAP-8 is story 11).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline with copy | History loaded online earlier; reload offline; open sheet | Sheet lists the saved rows; badge shows saved unviewed count | N/A |
| Offline no copy | Fresh device offline | Today's behaviour ("No interactions yet", badge 0) | N/A |
| Online start | Copy saved | Copy shown first, then server list replaces it and is saved | Read failure keeps copy and state |
| Reconnect | Partner poked while offline | After `online`, the row and badge appear without a reload | N/A |
| Incoming Realtime row | Valid row arrives | Added to state as today, then the copy is rewritten | Copy write failure logged |
| Own send confirmed | Online poke | Row in state and in the copy | N/A |
| Mark viewed | Server confirms | State and copy show `viewed: true` | Offline: nothing changes, as today |
| Account switch | A's read or copy read resolves after B signs in | Nothing shown or written after the switch | Dropped |
| Malformed copy | Saved value fails the guard | Ignored; server read proceeds | Logged |
| Sign-out | A out | `interactions` copy deleted with the other kinds (existing `deleteAccountCopies`) | Existing |

</frozen-after-approval>

## Code Map

- `src/services/localCopy.ts` -- API and consumer rules. Do not change it.
- `src/stores/slices/eventsSlice.ts:56-130, 261-288, 372-419` -- pattern to mirror: kind constant, saved shape, parse guard, `…FreshFor` marker, `save…Copy`, `registerLocalCopy`, copy-first load (fire server request, read copy, apply copy only if not yet fresh and list empty).
- `src/stores/slices/interactionsSlice.ts` -- `toLocalInteraction` :71-80; `sendPoke`/`sendKiss` :90-149; `markInteractionViewed` :151-169; `loadInteractionHistory` :187-224 (guard checks `userId` only — add `authSessionVersion`; swallows errors); `addIncomingInteraction` :323-361 (sync; validates, dedupes, prepends). Header :29-32 says ephemeral — update it.
- `src/api/interactionService.ts:374-412` -- `getInteractionHistory` throws offline and on error; header :8-16 says Supabase-only — update it.
- `src/components/InteractionHistory/InteractionHistory.tsx:41-58` -- loads on sheet open; keep, it now shows the copy first.
- `src/App.tsx:408-427` -- `refreshLocalCopies()` on signed-in start and `online`; no change.
- `src/stores/slices/authSlice.ts:62-70, 162-167` -- deletion covers every kind; the four fields are already in `signedOutState()`. No change.
- `AGENTS.md` -- the "Check which data model" pitfall lists partner interactions as Supabase-only; update it in a separate docs commit.
- Tests: `tests/unit/stores/interactionsSubscription.test.ts`, `tests/unit/stores/loaderIdentityGuards.test.ts`, `tests/unit/stores/signOutClearsAccountState.test.ts:326`, `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx`.
- E2E model: `tests/e2e/offline/events-offline-copy.spec.ts` (`goOffline`, IndexedDB `local-copies` read, `resolveOwnPair` in `tests/support/helpers/events.ts:70`). Seed with `supabaseAdmin.from('interactions').insert({ type, from_user_id, to_user_id, viewed: false })`; delete by id at teardown.

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/slices/interactionsSlice.ts` -- Add kind `interactions`, saved shape and parse guard, fresh marker, `saveInteractionsCopy`; make `loadInteractionHistory(100)` copy-first and register it as the refresher; rewrite the copy after `addIncomingInteraction`, a confirmed send and a confirmed mark-viewed; add the `authSessionVersion` check; update the header.
- [x] `src/api/interactionService.ts` -- Header comment only.
- [x] Unit tests -- Cover every matrix row, both stale-session paths (server read and copy read) and a malformed copy; adjust existing tests only where behaviour legitimately changed.
- [x] `tests/e2e/offline/interactions-offline-copy.spec.ts` -- (1) Seed a partner poke, load online, reload offline, open the history sheet: it is listed and the badge shows. (2) Offline, seed a poke, go online: it appears without a reload. Delete seeded rows at teardown.
- [x] `AGENTS.md` -- Data-model pitfall: interactions now keep a local copy (docs-only commit).

**Acceptance Criteria:**
- Given pokes loaded in an earlier online session, when the app is reloaded offline, then the history sheet lists them.
- Given the device is offline, when a poke is tapped, then it is refused as today and neither state nor copy changes.

## Implementation Notes

- `createInteractionsSlice` now returns from a closure (as `eventsSlice` does) holding the `interactionsFreshFor` marker; `ownsSession` checks `{ userId, authSessionVersion }` in load, send and mark-viewed (mark-viewed had no identity check before).
- `InteractionHistory.tsx`: the spinner shows only while the list is empty, so the saved copy stays on screen during the refresh (outside the task list; needed for "copy first").
- E2E test 1 reloads online with `/rest/v1/interactions` aborted, then goes offline (dev mode has no service worker). Test 2 waits for the reconnect's server read; Realtime may also deliver the row.
- Commits: `6b4af58b` (code), `c63b9ded` (AGENTS.md, docs-only), `9b4428d8` (review patches 4, 6, 7, 8: mark-viewed recounts the badge; `InteractionHistory.test.tsx` pins the spinner; E2E test 2 asserts the reconnect response carries the poke; E2E test 1 confirms the aborted read).

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind, edge | A Realtime row or send landing before the copy read applies saves `[row]` over the saved history and marks the session fresh | low | Needs a row or send in the milliseconds between signed-in start and the IndexedDB copy read, then a failed server read, then an offline reload before any later refresh; fix adds a copy-applied flag or a merge | reject |
| 2 | edge | Overlapping loads (start refresher and sheet open) resolving out of order let the older server list win | low | Two reads seconds apart differ only if a row lands between them, and Realtime or the next refresh restores it; fix adds a sequence guard | reject |
| 3 | edge | A Realtime row added after the query ran but before its response lands is dropped by the replace | low | Existed before this change (`loadInteractionHistory` always replaced state); millisecond window; next refresh restores it | reject |
| 4 | blind, edge | `markInteractionViewed` decrements the badge instead of recounting | low | A refresh setting the row viewed while the badge animation plays leaves the badge one short; direct correction to `countUnviewed` | patch |
| 5 | blind, edge | Spinner condition checks the 7-day list, so saved rows older than 7 days still show the spinner | false | That list is empty in the 7-day view either way; the spinner during load is the pre-change behaviour and the empty state follows | reject |
| 6 | verif-gap | Spinner-only-when-empty behaviour has no test that renders the real component | low | Pre-verified: PokeKissInterface's test stubs `InteractionHistory`; both E2E tests assert after the load settles | patch |
| 7 | blind | E2E test 2 can pass through Realtime even if the reconnect refresher is broken | medium | `setOffline` may not cut the open socket; `await refreshRead` proves only that a GET went out | patch |
| 8 | blind | E2E test 1 never confirms the aborted route was hit | low | A start read that slipped past the route would load from the server and pass; one wait closes it | patch |
| 9 | blind | Saved copy grows past 100 between server loads | low | Grows by one row per incoming poke until the next start or reconnect load trims it to 100 | reject |
| 10 | blind | Offline the badge now shows but can't be cleared and gives no message | low | Frozen matrix: offline mark-viewed changes nothing, as today; the "needs a connection" message is story 11 (CAP-4) | reject |
| 11 | blind | Component passes 100 instead of `HISTORY_LIMIT` | low | Both are 100; no divergence exists | reject |
| 12 | blind | `Promise.resolve(historyRequest).catch` wrapper is redundant | false | Same idiom as `eventsSlice.ts:379`; it also covers mocks that return a non-promise | reject |
| 13 | blind | The AGENTS.md edit sits inside the generated `bmad:context` block and a context refresh may rewrite it | low | Line 72 is between `<!-- bmad:context -->` (:1) and `<!-- /bmad:context -->` (:74); fix edits agent-context files | defer |

## Design Notes

The refresher reuses `loadInteractionHistory(100)`, so start and reconnect now load the history before the sheet is opened; the badge shows the real unviewed count at start instead of 0 until the sheet opens. The copy is rewritten from the whole current list (at most the 100 loaded plus incoming rows), so later writes carry newer state and the copy never drifts from what is shown.

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit src` -- all pass
- `npx playwright test tests/e2e/offline tests/e2e/partner` (with `supabase start`) -- all pass
