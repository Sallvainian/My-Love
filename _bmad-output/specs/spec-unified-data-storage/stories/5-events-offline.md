---
title: 'Events offline'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '21a72147be3200bda57536f02dba5b4e3fc3d9be'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Events live only in memory. Offline, `getEventsPage` throws before any request (`eventsService.ts:331`). Home then shows "Unable to load events" and Settings "We couldn't load your events", even when the device loaded them minutes earlier (CAP-1).

**Approach:** Events join the shared local-copy mechanism as kind `events`. `loadEvents` shows the account's saved copy at once, then replaces state and copy with the server's first page when online. Every successful load and every confirmed add, edit or delete saves the shown list as the copy. The kind registers a refresher, so start and reconnect refresh it (CAP-2).

## Boundaries & Constraints

**Always:** Follow the `localCopy.ts` header rules. Fill the copy only from server answers and confirmed writes. A failed read keeps state and copy. Capture and re-check `{ userId, authSessionVersion }` before every state write and every copy write, and write the copy under the captured `userId`. Keep the slice's load sequencing and mutation replay: an older load must not overwrite a newer one, and a write confirmed during a load must survive it. Save dates as `YYYY-MM-DD` strings and read them back with `parseEventDate`. Keep `createdAtRaw`. A saved copy that fails its shape check is ignored.

**Never:** Do not persist events to Zustand; `partialize` and `STALE_PERSISTED_KEYS` stay as they are. No Realtime. No offline writes; the existing refusal ("Events need a connection to save.") stays. No `DB_VERSION` change: the `local-copies` store exists. Do not save pagination cursors.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline, copy saved | Events loaded online earlier, now offline | Home and Settings list the saved events. No load-error card or banner. `eventsError` null | N/A |
| Offline, no copy | Fresh device, offline | Today's behaviour: the load fails and each screen shows its current offline/error UI | Load returns `failure` |
| Online | Copy saved | Copy shows first, then the server page replaces it and is saved | Server error: copy stays shown, error only when nothing is shown (today's rule) |
| Server says none | Online, zero rows | Empty list shown and `[]` saved | N/A |
| Confirmed write | Add, edit or delete succeeds | State updates as today; the copy is saved from the new list | Copy save failure logged, write result unchanged |
| Account switch | A's load or copy read resolves after B signs in | Neither shown nor saved for B | Dropped |
| Sign-out | A out, B in | A's `events` copy deleted with the rest (`deleteAccountCopies`) | Existing |
| Load more offline | Copy shown, no cursors | "Load more" is not offered, or fails with today's history-error notice | Existing |

</frozen-after-approval>

## Code Map

- `src/services/localCopy.ts` -- `readLocalCopy` / `writeLocalCopy` / `registerLocalCopy`; the header lists the consumer rules. Do not change it.
- `src/stores/slices/settingsSlice.ts:150-175, 295-321, 665-725` -- the pattern to copy for kind `couple-settings`: a module-level `…FreshFor` marker, a `parseSaved…` guard, a `save…Copy` helper, and a registered refresher.
- `src/stores/slices/eventsSlice.ts` -- `loadPage(append)` (load ids, `activeLoads`, `replayCompletedMutations`). `addEvent` / `editEvent` / `removeEvent` each `set` after the identity check. The header says "NOT mirrored to IndexedDB" and must be rewritten.
- `src/services/eventsService.ts:70-80` -- `CoupleEvent` (`date`, `createdAt` are `Date`). `parseEventDate` :200, `formatDateISO`. `getEventsPage` throws offline :331; leave it.
- `src/App.tsx:492-515` (Home) and `src/components/Settings/EventsSettings.tsx:141-156, 430-469` -- both call `loadEvents` on mount and on every online change. Their error UI shows only when the list is empty, so they need no change unless a test shows otherwise.
- `src/stores/slices/authSlice.ts:110, 174-179` -- the events keys are already in `signedOutState()`. `deleteAccountData` already deletes every copy kind.
- Tests to update: `tests/unit/stores/eventsSlice.test.ts:290-300` (a failed offline load keeps the list); `tests/unit/api/offlineMessageHonesty.test.ts:55,61` (pins "no mirror" wording); `tests/unit/App.eventsSession.test.tsx:585-603`; `src/components/Settings/__tests__/EventsSettings*.test.tsx`; `tests/e2e/settings/events-load-recovery.spec.ts:111`. Each of these may be offline with no copy (still a failure), or may need `readLocalCopy` mocked.
- E2E model: `tests/e2e/offline/couple-settings-offline.spec.ts` (`resolveOwnPair`, `trace: 'off'`, reading the copy from IndexedDB). Event helpers are in `tests/support/helpers/events`.

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/slices/eventsSlice.ts` -- Add `EVENTS_COPY_KIND = 'events'`, a saved shape of plain strings, a parse guard and a save helper. In `loadPage(false)`, apply the copy first. It is skipped once this session has a server answer or confirmed write, and it never replaces non-empty state. Offline with a copy, return `success` without an error. Save the copy after each owned successful load and each confirmed write. Register `loadEvents` as the kind's refresher. Rewrite the header's persistence section.
- [x] `tests/unit/stores/eventsSlice*.test.ts` -- Cover every matrix row: offline with a copy, offline without one, copy then server, a zero-row save, a write saving the copy, a stale account for both the copy read and the copy write, a malformed copy ignored, and a confirmed write during a load not lost.
- [x] Existing unit and E2E tests named in the Code Map -- Adjust them only where the new behaviour legitimately changes what they assert, and update the honesty-test wording.
- [x] `tests/e2e/offline/events-offline-copy.spec.ts` -- Seed an event for the worker's own user, load Home online, go offline and return to Home through the dock: the event is listed and no load-error card shows. Settings lists it offline as well. Remove the seeded row at teardown.

**Acceptance Criteria:**
- Given events loaded once online, when the device goes offline and Home or Settings is opened, then the saved events are listed and no load-error message is shown.
- Given a partner adds an event while this device is offline, when the connection returns, then the new event appears without a reload.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind | Start/reconnect refresher runs a second `loadEvents` beside Home's or Settings' own; the superseded load is `stale` and ignored by the screen, so correctness hangs on unenforced effect order, and each start/reconnect doubles the request | medium | `App.tsx:408-411` and the `online` handler start the refresher; Home (`App.tsx:497`) and `recordLoadOutcome` drop `stale`; today's order happens to favour the screen; the e2e count went 2→3 loads | patch |
| 2 | verif-gap, blind | Comments now false: `EventsSettings.tsx:9-14`, `App.tsx:478-481, 508-513`, `authSlice.ts:169-172`, and test comments in `persistedEvents.test.ts:4`, `EventsSettings.test.tsx:382`, `events-crud.spec.ts:222` | low | Each still says Supabase-only / not persisted / reload-based / offline re-fire always fails; direct correction | patch |
| 3 | blind | `events-load-recovery.spec.ts` lost the comment explaining the Mood detour but kept the step | low | Diff deletes the comment, keeps `navigateTo(page, 'mood')`; direct correction | patch |
| 4 | blind | Honesty test cites `eventsService.ts:34` by line | low | Breaks on the next header edit; cite by section | patch |
| 5 | verif-gap | `events-refresh-unmount.spec.ts` exact count of three loads unconfirmed | false | Ran and passed in the 70-test E2E run; the count reverts with #1 anyway | reject |
| 6 | edge, blind | A copy read that never settles (blocked upgrade) holds the server page and leaves loading on | low | Needs `openMyLoveDB` stuck behind the upgrade dialog, which blocks every copy consumer the same way (`settingsSlice` awaits the copy read first too); fix adds a race | reject |
| 7 | edge | A write confirmed while the copy read is in flight marks the session fresh; a later failed server page leaves state and copy as that write alone, and an offline load then succeeds without error | low | Needs the add/edit/delete to confirm within the milliseconds of the copy read and the server page to fail; fix adds a second freshness marker | reject |
| 8 | edge (claim) | The copy may hold rows that are not a complete server list | low | Same root as #7; otherwise the shown list is server rows plus confirmed writes, as the frozen Approach states | reject |
| 9 | blind | Unlinking partners leaves the ex-partner's events in the copy | false | There is no unlink path (SPEC Non-goals: "there is no unlink path, and this spec adds none") | reject |
| 10 | blind | E2E does not pin the online-failure-with-copy view; its IDB helper lacks try/catch | low | Slice behaviour covered by "keeps the copy shown and saved when the server read fails"; the screens' banner rule is unchanged; the store exists since v12 | reject |
| 11 | blind | Unit gaps: unknown icon, missing `description`, offline list-on-screen with null copy, offline history button | low | `isEventIcon` and the `description` check reject both shapes by construction; list-on-screen without freshness implies a non-null copy; load more offline covered by the added test | reject |
| 12 | blind | "Load more" pages grow the copy and reappear offline | false | Recorded decision in Design Notes: the copy is what the screen last showed; the next online refresh narrows it | reject |
| 13 | blind | Nothing tells the user the list is a saved copy | false | CAP-8: `NetworkStatusIndicator` shows "Showing saved data, which may be out of date." whenever offline | reject |

## Design Notes

The copy stores what the screen showed, including rows added by "load more", so reopening offline matches what the user last saw. The next online refresh narrows it back to the first page. Cursors are left out because they are only useful against a live server, and `loadEvents` resets them on every online refresh anyway.

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit src` -- all pass
- `npx playwright test tests/e2e/offline tests/e2e/home tests/e2e/settings` (with `supabase start`) -- all pass
