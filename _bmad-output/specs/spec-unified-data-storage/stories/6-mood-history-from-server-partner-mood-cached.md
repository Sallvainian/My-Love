---
title: 'Mood history from the server, partner mood cached'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: 'b76d059c627d8a7e3d20fb819abdde8513e2b9aa'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Own moods are read only from the IndexedDB `moods` store, and nothing fills that store from the server, so a new device's calendar is empty (CAP-6). Partner moods are in memory only: offline after a reload, the Partner screen shows "No moods yet" (CAP-1).

**Approach:** A refresher pulls the account's full mood history from the server into the `moods` store, never touching queued rows, and runs on start and reconnect (CAP-2). Partner moods join the local-copy mechanism as kind `partner-moods`: shown from the copy first, replaced and saved after each successful server read.

## Boundaries & Constraints

**Always:** Follow the `localCopy.ts` header rules. Capture and re-check `{ userId, authSessionVersion }` before every store write, IndexedDB write and copy write. Do the merge in one readwrite transaction that re-reads each date's row inside it, so a row with `synced: false` is never changed and a concurrent `markAsSynced` fingerprint check stays valid. Map server rows the way `fetchPartnerMoods` does (local-timezone `date`, `timestamp` from `created_at`, `synced: true`, `supabaseId`). A failed server read changes nothing. A saved partner copy that fails its shape check is ignored.

**Never:** No change to the mood queue, `syncPendingMoods`, `markAsSynced`, the service worker or Background Sync. No `DB_VERSION` change. No new Realtime channel. Moods stay out of Zustand persist. Never delete local mood rows in the backfill. Never invent a `timestamp`: skip server rows with a null `created_at`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh device | Server has past moods, `moods` store empty | After sign-in the calendar shows them without changing month | N/A |
| Queued edit | Local row `synced: false` for a date the server also has | Local row untouched and still sends | N/A |
| Synced row, server newer | Server row for that date has a later or equal `created_at` | Local row updated in place (same `id`) | N/A |
| Synced row, local newer | Local `timestamp` later than every server row that date | Local row kept | N/A |
| Several server rows per date | Two devices logged the same day | Newest `created_at` wins | N/A |
| Backfill read fails | Offline or server error | Store, state and calendar unchanged | Logged |
| Partner, offline with copy | Partner moods loaded online earlier; reload offline | Partner screen lists them; no "No moods yet" and no "will load when you reconnect" notice | N/A |
| Partner, offline no copy | Fresh device offline | Today's behaviour (offline notice, empty state) | N/A |
| Partner, online | Copy saved | Copy first, then the server list replaces it and is saved; zero rows saves `[]` | Read failure keeps copy and state |
| Account switch | A's read resolves after B signs in | Nothing shown or written after the switch | Dropped |
| Sign-out | A out | `partner-moods` copy deleted with the other kinds; A's `moods` rows stay as today | Existing |

</frozen-after-approval>

## Code Map

- `src/services/localCopy.ts` -- `readLocalCopy`/`writeLocalCopy`/`registerLocalCopy`. Do not change it.
- `src/stores/slices/eventsSlice.ts:57-132, 261-288, 337-430` -- pattern to mirror: kind constant, saved shape of plain strings, parse guard, `…FreshFor` marker, `save…Copy`, registered refresher, copy-first load.
- `src/stores/slices/moodSlice.ts` -- `loadMoods` :138-145 (IndexedDB only). `fetchPartnerMoods` :355-408: returns early offline :360, server partner lookup `getPartnerId()` :365, row mapping :378-393 (reuse it for the backfill). `syncPendingMoods` calls `fetchPartnerMoods(30)` :291-298.
- `src/services/moodService.ts` -- add the merge method here. `getAllForUser` :296-308, `saveForDate` :123-137, `markAsSynced` fingerprint :340-372 (do not change). Store: `keyPath: 'id'`, unique index `by-user-date` on `[userId, date]` (`dbSchema.ts:243-247`).
- `src/api/moodApi.ts:432-450` -- `getMoodHistory(userId, offset, limit)`, ordered `created_at`/`id` desc; throws offline. `max_rows` is 1000 (`supabase/config.toml:18`).
- `src/components/MoodHistory/MoodHistoryCalendar.tsx:70-125` -- reads IndexedDB per month and reloads only on month/user change; it must also reload when the store's `moods` change. It has no unit test.
- `src/components/PartnerMoodView/PartnerMoodView.tsx` -- fetch effect runs only when online :129-139; offline notice :625-637; empty state :651-666; the Realtime handler refetches :167-188.
- `src/App.tsx:407-428` -- `refreshLocalCopies()` on signed-in start and on `online` (runs beside an unawaited `syncPendingMoods`).
- `src/stores/slices/authSlice.ts:62-72, 110-122` -- `deleteAccountCopies` covers a new kind; `partnerMoods: []` already in `signedOutState()`.
- Tests: `tests/unit/stores/moodSlice.test.ts:196-241, 576-660`, `tests/unit/stores/loaderIdentityGuards.test.ts:482, 509-532`, `tests/unit/services/moodService.test.ts`, `src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx:147-154` (offline notice text).
- E2E model: `tests/e2e/offline/events-offline-copy.spec.ts` (IndexedDB read in `page.evaluate`, `setOffline`, `resolveOwnPair`). Seed and delete moods with `supabaseAdmin.from('moods')` as `tests/e2e/partner/partner-mood-realtime.spec.ts:215-232` does.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/moodService.ts` -- Add `mergeServerMoods(userId, entries)`: one readwrite transaction; per date, insert if absent, update a `synced: true` row when the server entry is not older, skip `synced: false`. Returns whether anything changed.
- [x] `src/stores/slices/moodSlice.ts` -- Add `loadMoodHistoryFromServer`: page `getMoodHistory` 500 at a time until a short page, keep the newest row per date, merge, then `loadMoods()` if changed; register it as refresher kind `mood-history`. Give `fetchPartnerMoods` kind `partner-moods`: copy first when state is empty and the session has no server answer yet, offline returns after the copy, save the copy after each owned successful read.
- [x] `src/components/MoodHistory/MoodHistoryCalendar.tsx` -- Reload the shown month when the store's `moods` change.
- [x] `src/components/PartnerMoodView/PartnerMoodView.tsx` -- Call `fetchPartnerMoods` on mount offline too; show the offline notice only when no moods are listed.
- [x] Unit tests -- Cover every matrix row, both stale-session paths, and a malformed partner copy; adjust the existing tests named in the Code Map only where behaviour legitimately changed.
- [x] `tests/e2e/offline/mood-offline-copy.spec.ts` -- (1) Seed a past mood for the worker's user, clear the `moods` store, reload: the calendar shows it. (2) Seed a partner mood, open Partner online, reload offline: it is listed. Delete seeded rows at teardown.

**Acceptance Criteria:**
- Given moods logged on another device, when the user signs in on a fresh device, then the calendar shows them.
- Given a mood logged offline, when the connection returns, then it syncs exactly once as today and the backfill neither overwrites nor duplicates it.

## Implementation Notes

- `partner-moods` has no registered refresher: the Partner screen fetches on mount and on every online flip, the Realtime handler refetches, and `syncPendingMoods` refetches after each sync, so a start/reconnect refresher would only add a server read from every other screen.
- `fetchPartnerMoods` also orders overlapping calls (`partnerMoodsSeq`): only the latest call for the captured session writes state or the copy, so an older answer cannot overwrite a newer copy.
- The shared row mapper skips a null `created_at` on both paths, so the partner list no longer shows such a row stamped "now".
- `MoodHistoryCalendar` drops stale month reads and keeps the grid on screen (no skeleton) when it re-reads the same month after a store change.
- Review patch: `loadMoodHistoryFromServer` takes `moodService.getMergeSnapshot(userId)` before the first server request and `mergeServerMoods` applies an entry only to a date unchanged since that snapshot, so an edit that syncs while the pages load is never overwritten; an insert is skipped when the entry's `supabaseId` is already stored under another date (timezone change).

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind | Backfill can write pre-edit server values over an edit that synced while the pages were being read | medium | Edits keep `timestamp`/`created_at` (`moodService.ts:131`), so after `markAsSynced` the merge sees a synced row with equal time and different content and `put`s the stale page; `App.tsx` runs `syncPendingMoods` and `refreshLocalCopies` together on `online` | patch |
| 2 | edge | A server row mapped to another local date (timezone change) is inserted beside the existing synced row with the same `supabaseId` | medium | `toMoodEntry` maps `date` in the device's timezone; the merge looks up only `[userId, date]`, so the calendar shows one mood on two days | patch |
| 3 | edge | Partner offline notice flashes before the saved copy fills the list | low | Notice renders on `!isOnline && partnerMoods.length === 0` while `loadPartnerMoods` awaits the copy read; every offline open; one-condition fix | patch |
| 4 | verif-gap, blind | Calendar `loadSeqRef` stale-read guard untested | low | No test has two `getMoodsInRange` reads in flight; removing the guard fails nothing | patch |
| 5 | verif-gap | `partnerMoodsFreshFor` gate on the copy untested | low | No case gets a server answer then an offline call; removing `!isFresh()` fails nothing | patch |
| 6 | blind | `mergeServerMoods` untested for another user's row on the same date and a `moods`-only difference | low | Other-user test runs on an empty store; cheap test additions | patch |
| 7 | edge | E2E backfill test can flake: the first load's start backfill may merge after `clearMoodsStore` | low | `goto('/')` starts the refresher; the spec clears and asserts `[]` without waiting for it | patch |
| 8 | blind, edge | Unlink leaves the ex-partner's moods in state and copy | false | No unlink path exists (SPEC Non-goals); `getPartnerId()` null kept state before this change too | reject |
| 9 | blind, edge | Copy does not record which partner it belongs to; relink shows the previous partner's moods | false | Relinking to someone else needs an unlink, which does not exist (SPEC Non-goals) | reject |
| 10 | blind | Full history re-downloaded every start/reconnect; no watermark | false | Recorded design decision (Design Notes): ~365 rows a year, one request | reject |
| 11 | edge | Overlapping start and reconnect backfills both page and merge | low | Harm is duplicate reads only; merge is idempotent; fix adds an in-flight guard | reject |
| 12 | blind | Moods deleted on the server are never removed locally | false | No caller of `moodApi.delete`; recorded in Design Notes | reject |
| 13 | edge | Offset paging skips a row when one is deleted between pages | false | Same: no server deletion path | reject |
| 14 | blind | Recency uses `created_at`, not `updated_at` | low | Needs two devices logging the same day and a later edit of the older row; fix adds a second comparison field the local row does not carry | reject |
| 15 | blind, edge | A failed same-month re-read blanks the calendar | low | `getMoodsInRange` returns `[]` on failure (`moodService.ts:251-253`), a transient IndexedDB failure; telling it apart needs a new failure signal | reject |
| 16 | blind | E2E does not reach the store-change re-read path | low | The unit test `MoodHistoryCalendar.storeReload.test.tsx` pins it and fails without the change | reject |
| 17 | blind | Offline with no copy shows both the notice and "No moods yet" | false | Frozen matrix row "Partner, offline no copy": today's behaviour (offline notice, empty state) | reject |
| 18 | blind | `mood-history` refresher registered in the slice creator and never unregistered | false | Same pattern as `eventsSlice.ts:283` and `settingsSlice.ts:295-297`; one app store, re-registering replaces | reject |

## Design Notes

The backfill writes into the existing `moods` store rather than a `local-copies` entry because that store is the mood queue and the calendar's source; the local-copy registry is used only for its start/reconnect trigger. The pull reads the whole history each time because the server has no deletion path for moods (no caller of `moodApi.delete`) and a year is about 365 rows, one request. Local rows the server lacks are kept: they are queued or were synced from this device.

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit src` -- all pass
- `npx playwright test tests/e2e/offline tests/e2e/mood tests/e2e/partner` (with `supabase start`) -- all pass
