---
title: 'DW-318: sign-out deletes the outgoing account''s synced mood rows'
type: 'bugfix'
ticket: ''
created: '2026-10-29'
status: 'done'
baseline_revision: '953581503ed1fcbaac14e91aea70c6a25db72d56'
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
  - summary: >-
      A mood row the service worker's background sync marks synced after sign-out stays on the device until that account's next sign-out there.
    evidence: |-
      sw-db.ts markMoodSynced has no session check, and discardAccountState clears the my-love-account-owner marker on sign-out, so when another account signs in next, nothing deletes the row. Reads stay scoped by userId, so the row is never shown to that account. The intent accepted "the row is left for the next deletion"; recording it so a sweep sees it.
    location: >-
      src/sw-db.ts:97 (markMoodSynced); src/stores/slices/authSlice.ts (deleteAccountData)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `deleteAccountData()` (`src/stores/slices/authSlice.ts:47-67`) deletes the outgoing account's local copies and cached images only, so that account's `moods` rows with `synced: true` stay in the device's IndexedDB after sign-out, unlike every other per-account copy (DW-318). AGENTS.md lets only a queue of unsent writes survive sign-out.

**Approach:** Add a `moodService` method that deletes one user's `synced: true` rows and keeps every `synced: false` row, and call it fire-and-forget from `deleteAccountData`, which already serves explicit sign-out, a direct account switch, the no-session boot and the fresh-sign-in leftover path (both driven by the `my-love-account-owner` marker). A main-thread sync or history backfill that finishes after its account is no longer signed in runs the same delete again. Rows the service worker's background sync marks synced after sign-out wait for the next deletion.

## Boundaries & Constraints

**Always:** Never delete a `synced: false` row, whoever owns it. Never touch another account's rows. Do the delete in one readwrite transaction over the `by-user-date` index range for that user, the same `IDBKeyRange.bound([userId, ''], [userId, '￿'])` that `getMergeSnapshot` uses. The new method is a write, so it throws on failure. Callers catch the error and log it, as `deleteAccountData` already does for copies and images. The follow-up delete runs only when `get().userId !== userId`, so a same-account re-login (where only `authSessionVersion` moved) keeps its rows.

**Never:** Do not edit `_bmad-output/initiative-my-love/deferred-work.md` or AGENTS.md. Do not change `sw.ts`/`sw-db.ts`. The service worker has no session state and its sign-out race is accepted (the row waits for the next deletion). Do not make sign-out await IndexedDB. Do not clear the whole `moods` store. Do not add a new IndexedDB store or schema change. Do not add a sweep of other accounts' legacy rows.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sign-out | A has a synced row and an unsynced row; OTHER has a synced row | A's synced row deleted; A's unsynced and OTHER's synced rows remain | No error expected |
| No-session boot | marker = A, `userId` null, `clearAuth()` | same as sign-out | No error expected |
| Fresh sign-in of A (marker = A) | A's synced row | nothing deleted | No error expected |
| Sync settles after A signed out | batch resolves while `userId` is B or null | `deleteSyncedForUser('A')` requested | rejection logged, not thrown |
| Sync settles after A re-signed-in as A | `authSessionVersion` changed, `userId` still A | no delete | n/a |
| Backfill merge settles after A signed out, `changed: true` | `userId` is B | `deleteSyncedForUser('A')` requested | rejection logged, not thrown |
| Delete fails | IndexedDB throws | sign-out completes; error logged by caller | caught at call site |

</intent-contract>

## Code Map

- `src/services/moodService.ts` -- add `deleteSyncedForUser(userId): Promise<number>` after `getAllForUser`. Model the transaction on `mergeServerMoods` (`getTypedDB().transaction('moods','readwrite')`, `void tx.done.catch(() => {})`, the `by-user-date` range). Walk a cursor and `cursor.delete()` where `value.synced` is truthy. Return the count. Throw `'User not authenticated'` on an empty id, as `saveForDate` does.
- `src/stores/slices/authSlice.ts:47-67` -- `deleteAccountData`: add a third fire-and-forget call with its own `console.error('[AuthSlice] Failed to delete the outgoing account\'s synced moods:', …)`. Rewrite its JSDoc to say synced moods go, unsynced rows stay, a late main-thread sync is re-deleted by moodSlice, and a service-worker sync waits for the next deletion. Update the matching comment in `discardAccountState` ("Unsynced `moods` rows stay for their owner").
- `src/stores/slices/moodSlice.ts` -- `syncPendingMoods` `!stillCurrent()` branch (~line 416) and `loadMoodHistoryFromServer` after `mergeServerMoods` (~line 595, the `if (!changed || !stillCurrent()) return;` line, when `changed`): request the delete via one module-local helper that returns early when `get().userId === userId` and catches and logs the rejection.
- `tests/unit/stores/signOutClearsAccountState.test.ts` -- `seedDevice` (~line 665) adds a `synced: true` mood for the outgoing account (another date) and one for `OTHER-ACCOUNT`. `expectOnlyOutgoingDataDeleted` waits for the outgoing synced row to be gone and asserts the other two rows survive. The "fresh boot of the recorded owner's own session deletes nothing" test asserts the synced row survives. These helpers already cover clearAuth, account switch, no-session boot and leftover sign-in.
- `tests/unit/services/moodService.test.ts` -- unit-test the new method against fake-indexeddb.
- `tests/unit/stores/moodSlice.sync.test.ts`, `tests/unit/stores/moodSlice.historyBackfill.test.ts` -- add `deleteSyncedForUser: vi.fn()` to the `moodService` mock (resolved by default). Add cases inside the existing "when the session ends before the batch settles" describe, and extend "does not reload into state when the account changed during the merge".

## Tasks & Acceptance

**Execution:**
- [x] `src/services/moodService.ts` -- add `deleteSyncedForUser` -- the one place that knows which mood rows are queued
- [x] `src/stores/slices/authSlice.ts` -- call it from `deleteAccountData`, update JSDoc and the `discardAccountState` comment -- covers all four sign-out paths
- [x] `src/stores/slices/moodSlice.ts` -- re-request the delete when a sync or a changed backfill settles after its account is no longer signed in -- the late-sync race
- [x] `tests/unit/services/moodService.test.ts` -- deletes only that user's synced rows, keeps their unsynced rows and other accounts' rows, returns the count, returns 0 when none
- [x] `tests/unit/stores/signOutClearsAccountState.test.ts` -- extend the seed and assertion helpers and the own-session test as in the Code Map
- [x] `tests/unit/stores/moodSlice.sync.test.ts` -- delete requested with 'USER-A' when B is signed in at settle; not requested for the same-account re-login or for an uninterrupted session; a rejected delete does not make `syncPendingMoods` reject
- [x] `tests/unit/stores/moodSlice.historyBackfill.test.ts` -- delete requested for USER on the account-changed-during-merge case; not requested when the merge changed nothing, or when the session is uninterrupted

**Acceptance Criteria:**
- Given a device holding the outgoing account's synced and unsynced moods and another account's synced mood, when the account signs out (or the device boots with no session and the marker names it), then only the outgoing account's synced rows are gone from IndexedDB
- Given a mood sync that finishes after its account signed out, when it settles, then that account's rows it marked synced are deleted, and an account that signed back in as itself keeps its rows

## Implementation Notes

- Outside the Code Map: the seven `tests/unit/stores/loaderIdentityGuards.*.test.ts` files mock `moodService` with only `getAllForUser`/`getUnsyncedMoods`, so `deleteAccountData`'s new synchronous call threw `deleteSyncedForUser is not a function` on every sign-out there (106 failures). Each mock gained `deleteSyncedForUser: async () => 0`, matching how they already stub `deleteAccountCopies`.
- `signOutClearsAccountState.test.ts` also spies `moodService.deleteSyncedForUser` in the leftover-sign-in and own-session tests, because the delete awaits `init()` before opening its transaction, so an immediate read could pass whether or not a delete was requested.
- The moodSlice helper also returns early on a null captured `userId` (a batch started signed out has no account to delete).
- Red checks: with the `authSlice` call removed, 4 sign-out tests fail; with the moodSlice helper disabled, 3 sync/backfill tests fail.

- Verify pass (parent session): the new `moodService` range bound was written with a literal U+FFFF character; replaced with the `'\uffff'` escape used at the two existing `by-user-date` ranges. Matrix audit found the "delete fails" row untested at the sign-out call site, so `signOutClearsAccountState.test.ts` gained "signs out even when deleting the synced moods fails, and logs the failure". `npm run test:unit` (198 files, 3114 tests), `SEED=7 npm run test:unit:coverage`, `npm run typecheck` and `npm run lint` all exit 0.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 3, false 2, maybe-false 0
- findings:
  - `[low]` `[defer]` A service-worker background sync that marks a row synced after sign-out is recorded only in JSDoc, not as a deferred finding — real (the marker is cleared on sign-out, so another account's sign-in never deletes it); the row predates this change and the intent accepted it, so it is recorded in frontmatter `deferred`. The ledger is orchestrator-owned.
  - `[false]` `[reject]` moodSlice's follow-up delete is a second sign-out deletion path, against AGENTS.md "only through deleteAccountData()" — the helper re-runs the same `moodService.deleteSyncedForUser` call that `deleteAccountData` makes, after a race. A new account-owned store still needs registering in `deleteAccountData` alone, so no caller can diverge.
  - `[false]` `[reject]` The AGENTS.md sign-out rule is now stale — it says "The one deliberate exception is a queue of unsent writes (`moods` rows, `note-queue`)", which the code now matches. Before this change the code disagreed with it.
  - `[low]` `[patch]` Acceptance criterion 2 is checked only against a mocked delete — added "deletes a mood that a sync marks synced after its account signed out" to `signOutClearsAccountState.test.ts`: the real store and fake-indexeddb, a held batch running the real `markAsSynced` after `clearAuth`, and the row eventually deleted. It fails with the follow-up disabled.
  - `[low]` `[patch]` The backfill matrix row's rejected-delete case is untested — added "logs a failed follow-up delete without rejecting the backfill" to `moodSlice.historyBackfill.test.ts`.

## Design Notes

The follow-up delete is safe against ordering. IndexedDB serialises readwrite transactions on `moods`, and the follow-up starts only after the batch's last `markAsSynced` has committed, so it sees every row the batch flipped. The `get().userId !== userId` guard does not use `stillCurrent()` because that also fires on a same-account re-login, and deleting the signed-in user's history would empty the mood list until the backfill refills it. If the user signs back in between the request and the transaction, the history is still refilled by the backfill that sign-in starts (sign-in needs a network), so nothing is lost.

## Verification

**Commands:**
- `npx vitest run tests/unit/services/moodService.test.ts tests/unit/stores/signOutClearsAccountState.test.ts tests/unit/stores/moodSlice.sync.test.ts tests/unit/stores/moodSlice.historyBackfill.test.ts` -- expected: all pass
- `npm run test:unit` -- expected: all pass
- `npm run typecheck` -- expected: no errors beyond the TS2883 errors that loop worktrees already report at `baseline_revision`
- `npm run lint` -- expected: no errors

## Auto Run Result

Status: built

**Summary:** Sign-out deletes the outgoing account's `synced: true` mood rows from IndexedDB and keeps every `synced: false` row. The delete runs through `deleteAccountData`, which serves explicit sign-out, a direct account switch, the no-session boot and the fresh-sign-in leftover path (both driven by the marker). A main-thread mood sync or a changed history backfill that settles after its account is no longer signed in requests the delete again. A same-account re-login keeps its rows.

**Files changed:**
- `src/services/moodService.ts` -- new `deleteSyncedForUser(userId)`: one readwrite cursor pass over the user's `by-user-date` range that deletes synced rows and returns the count. It throws on failure.
- `src/stores/slices/authSlice.ts` -- `deleteAccountData` calls it fire-and-forget and logs a failure. JSDoc and the `discardAccountState` comment updated.
- `src/stores/slices/moodSlice.ts` -- `deleteSyncedMoodsIfSignedOut` helper, called from the session-ended branches of `syncPendingMoods` and `loadMoodHistoryFromServer`. Header comment updated.
- `tests/unit/services/moodService.test.ts` -- the new method's scoping, count and empty-id cases.
- `tests/unit/stores/signOutClearsAccountState.test.ts` -- seeded synced moods on every sign-out path, the own-session no-delete case, a failed delete during sign-out, and the real-IndexedDB late-sync case.
- `tests/unit/stores/moodSlice.sync.test.ts`, `tests/unit/stores/moodSlice.historyBackfill.test.ts` -- when the follow-up delete is requested and when it is not, and a rejected delete that is logged.
- `tests/unit/stores/loaderIdentityGuards.*.test.ts` (7 files) -- the `moodService` mock gains `deleteSyncedForUser`, because every sign-out there now calls it.

**Review findings:** 2 patches applied (both low: the integration test for AC 2 and the backfill rejected-delete test). 1 deferred (low: a row a service-worker background sync marks synced after sign-out). 2 rejected as false: the second deletion path, which re-runs the same call after a race, and the stale AGENTS.md claim, which the rule's unsent-writes exception already covers.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 0, low 2.

**Verification:** `npm run test:unit` (198 files, 3117 tests), `SEED=7 npm run test:unit:coverage` (3117 pass), `npm run typecheck` and `npm run lint` all exit 0. Red checks: removing the `authSlice` call fails 4 sign-out tests; disabling the moodSlice helper fails the sync, backfill and real-IndexedDB late-sync tests.

**Residual risks:**
- A service-worker background sync that settles after sign-out leaves its row until that account's next deletion (deferred above).
- If the account signs back in between the follow-up delete request and its transaction, its synced rows go and the backfill that sign-in starts refills them.
- Devices still hold synced rows left by sign-outs before this change, until that account signs out there again.
