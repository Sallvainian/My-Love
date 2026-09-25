---
title: 'Move custom messages and favorites onto the foundation'
type: 'refactor'
created: '2026-09-24'
status: 'done'
baseline_commit: '5cb3c3ae164c0d29e209a9f263299a994c96e096'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Custom messages and favorites are the last data kept outside the shared local-copy mechanism: custom rows sit in the `messages` store beside the bundled rows, favorites in `message-favorites` (One-mechanism constraint). Rows left by accounts that signed out before #341 are never swept.

**Approach:** The `message-data` kind's copy holds the account's custom rows and bundled-favorite ids; the slice renders from it, refreshes into it, and confirmed writes update it. IndexedDB v15 moves the signed-in account's rows into that copy with their local ids unchanged, then deletes every custom row, the `by-user` index and the `message-favorites` store.

## Boundaries & Constraints

**Always:** Custom-message ids stay the numbers they have today, so rotation history, favorites and the rotation pool (bundled by ascending id, then active custom by ascending id) are unchanged. A new custom row gets an id above every bundled id and every id this copy has handed out, never one a deleted row used. The v15 upgrade migrates only the account in `sw-auth` `'current'`, because `upgradeDb` also runs in the service worker, where localStorage is unavailable. Writes stay server-first behind `requireOnline`; post-await writes re-check `{ userId, authSessionVersion }`. Sign-out removes the kind through `deleteAccountCopies`.

**Never:** No change to bundled rows, their ids, the seeding or rotation logic. No Supabase migration. No offline writes. No Zustand persist version bump. No `oldVersion < N` branches.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Upgrade, signed in | v14 DB; `sw-auth` holds A; A has custom rows and favorites | A's copy holds A's rows with the same ids and favorites; today's message and history unchanged; no custom row or `message-favorites` store left | N/A |
| Upgrade, stale accounts | B's rows left from before #341 | Deleted with the stores, not copied | N/A |
| Upgrade, nobody signed in | No `sw-auth` token | Nothing copied; custom rows and favorites deleted; sign-in refills from the server | N/A |
| Offline start | A's copy saved | Custom messages and favorites shown | N/A |
| Refresh | Server added, edited, deleted rows | A matched row keeps its id by `serverId`; a new one gets the next id; the copy is saved | Read failure logs, copy unchanged |
| Sign-out | A signs out, B signs in | B sees none of A's custom rows or favorites | Delete failure logged |

</frozen-after-approval>

## Code Map

- `src/services/dbSchema.ts` -- `upgradeDb` is synchronous: raw request callbacks, as in the v9 branch at :272-294. It adds v15 at `DB_VERSION` :193. Rework the v8 index (:250-267) and v9 favorites (:272-298) branches, which are gated on existence and would recreate what v15 removes. Remove `message-favorites` from the schema interface and `STORE_NAMES` (:197-205). The drop pattern is at :389-395.
- `src/services/customMessageService.ts` -- the IDB mirror (`replaceMirrorForUser` :484, `deleteMirrorForUser` :451, `create` :202, `updateMessage` :296, `deleteForUser` :399, `getAllForUser` :579, `exportMessages`, `importMessages`) moves onto the copy. It must no longer open `my-love-db` (today :81), which leaves six openers; update the opener list in `dbSchema.ts:490` and in AGENTS.md. Dead exports: `getForUser` and `getActiveCustomMessages`.
- `src/services/storage.ts` -- `toggleFavorite` :244 still writes the server first and then updates the copy. `replaceBundledFavoritesForUser` :291 (text hash via `bundledMessageKey`) and `deleteFavoritesForUser` :326 go.
- `src/stores/slices/messagesSlice.ts` -- `loadMessages` :123-144 reads bundled rows from `messages` and custom rows from the copy. The refresher (:93-101) and `loadMessageDataFromServer` (:146-176) follow `settingsSlice.ts` anniversaries (:212-240 fresh guard, :331-340 save, :620-658 read-copy-then-fetch). Write actions: :501, :550, :589, :216. The dead `addMessage` is at :195.
- `src/services/messageFavorites.ts` -- `projectMessageFavorites` (reuse).
- `src/stores/slices/authSlice.ts` :64-77 -- drop the `deleteMirrorForUser` and `deleteFavoritesForUser` calls. `deleteAccountCopies` covers the kind. `signedOutState` and the history pruning (:274-366) stay.
- `src/components/AdminPanel/*`, `MessageList.tsx`, `DailyMessage.tsx` -- key on the local numeric `id`. Behaviour must not change.
- Tests pinning today's stores: `tests/unit/services/{dbSchema,dbSchema.indexes,storageSchema,customMessageService.ownership,accountDataApis,accountDataCreateRetry,bundledMessageKeys}.test.ts`, `tests/unit/stores/{signOutClearsAccountState,accountDataSlices,loaderIdentityGuards,updateCurrentMessageStaleCache,settingsSlice.initializeApp}.test.ts`, `tests/unit/components/AdminPanel.accountData.test.tsx`, `tests/unit/App.localCopyRefresh.test.tsx`, `tests/unit/helpers/fakeAccountDataApis.ts`, `tests/e2e/auth/logout.spec.ts:35-39`, `tests/e2e/account-data/account-data.spec.ts` (:40, :99, :118, :123), `tests/e2e/offline/account-data-offline-copy.spec.ts`.
- `tests/e2e/auth/login.spec.ts:114-115` already stubs both tables. The harness needs no stub unless the refresher reads the server before seeding.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/dbSchema.ts` -- v15 migrate-then-drop; rework the v8 and v9 branches.
- [x] `src/services/customMessageService.ts`, `src/services/storage.ts` -- server calls plus pure copy transforms; no IDB mirror.
- [x] `src/stores/slices/messagesSlice.ts` -- render from the copy, refresh into it, save after confirmed writes, allocate ids.
- [x] `src/stores/slices/authSlice.ts` -- remove the per-store sign-out deletes.
- [x] Unit tests -- matrix rows; v15 from v14, and from v8 with legacy `isFavorite` rows; identical rotation before and after migration; the listed tests updated.
- [x] E2E -- the listed specs read the copy; favorite and custom message still shown offline.
- [x] `AGENTS.md` -- opener count and list (separate docs commit).

**Acceptance Criteria:**
- Given the migrated DB, when `messages` is read, then only bundled rows remain and `message-favorites` does not exist.
- Given the change, when grepping `src/`, then nothing references `message-favorites` or the `messages` `by-user` index outside `dbSchema.ts` migration code.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | verif-gap, blind | Import per-row key test lost its assertion (only `toHaveLength(1)`) | medium | Pre-verified: removed ownership test at HEAD~2 :540; new case creates one row, and the fake assigns `serverId` whatever the key | patch |
| 2 | verif-gap | `readCopyForWrite` fallback (rebuild from shown rows) is untested | medium | Pre-verified: every no-copy case starts with nothing custom or favorited on screen, so an empty-copy fallback passes too | patch |
| 3 | blind, edge | Failed copy read rebuilds from screen, which can drop rows or reuse an id | low | Needs an IndexedDB read failure (`readLocalCopy` :80-88); telling failure from absence needs a new status API | reject |
| 4 | edge | `writeThroughCopy` with no bundled rows gives id 1, colliding with a bundled row | low | Needs no copy and an unseeded or failed `messages` read during a write; not shown reachable, and the fix adds a guard | reject |
| 5 | edge | A non-integer or low `nextCustomId` hands out bad ids | false | Only this code writes it, from integer ids (`withCreatedRow`, `withServerRows`, v15 `maxId + 1`); `nextId` also floors at `minNewId` | reject |
| 6 | edge, blind | Import dedupes against `[]` when the copy is null, re-creating server rows | low | Same as before the change (the mirror was empty before the first refresh too); needs an import before the first refresh or a read failure | reject |
| 7 | edge | Refresher gate counts custom rows, so a custom-only pool never refreshes | false | `loadMessages` runs only once `messages` is non-empty (`reloadRotationPool` authSlice.ts:233, refresher gate :162, mutators), and `initializeApp` seeds before setting the pool | reject |
| 8 | edge | `settingsSlice.initializeApp` test's `loadMessages` double still calls `getAllMessages(requestedBy)`; :289 and :373 assert the double's args | low | The double no longer mirrors production (`getAllMessages()` plus `readMessageData`), so those assertions check nothing real | patch |
| 9 | edge | Pool order changes if a custom id sits below a bundled id | false | Bundled rows are seeded at the first `initializeApp`, before any custom row can exist; the v15 rotation test pins 60 days identical | reject |
| 10 | blind | Export yields an empty file when the copy read fails | low | Needs an IndexedDB read failure; the fix adds a branch | reject |
| 11 | blind | No test fires two favorite taps together (removed `storageSchema` case) | medium | Serialization moved to `writeThroughCopy`; no slice test checks on-then-off | patch |
| 12 | blind | `copyNotSaved` path untested | low | Needs `writeLocalCopy` to fail after a server success | reject |
| 13 | blind | Admin list patches from the raw input, not the trimmed server row | low | Pre-existing: the unchanged `input.*` spread at messagesSlice.ts:715-724 | reject |
| 14 | blind | `storageService.addMessage` has no `src` caller | low | Tests use it to seed bundled rows (`AdminPanel.accountData`, `accountDataSlices`, `storageSchema`); removing it rewrites them | reject |
| 15 | blind | Signed-in error text is copied three times in the slice | low | Cosmetic; single-sourcing needs a new export | reject |
| 16 | blind | Slice adds a third `isOnline()` copy | low | Identical to the exported `utils/offlineErrorHandler.ts:60`; a direct swap | patch |
| 17 | blind | `MESSAGE_DATA_COPY_KIND` is re-exported twice | low | Cosmetic | reject |
| 18 | blind | AGENTS.md data-model paragraph omits custom messages and favorites | low | Edits an agent-context file | defer |
| 19 | blind | `projectMessageFavorites` now builds the whole pool; the name misleads | low | Cosmetic rename across callers | reject |
| 20 | blind | `parseCustomRow` does not check `category` or `userId` | low | Only this code writes the copy | reject |
| 21 | blind | Sign-out delete is no longer queued behind in-flight writes | false | `isSession` check and `writeLocalCopy`'s `await getDb()` run in one microtask chain before `deleteAccountCopies`' own `getDb()`, so the put's transaction is created first (story 2 row 6) | reject |
| 22 | blind | v15 branch with no `sw-auth` store is untested | low | `sw-auth` is created earlier in the same `upgradeDb` pass, so the branch is unreachable in a real upgrade | reject |

## Design Notes

Copy value: `{ custom: Message[] /* local id + serverId */, bundledFavoriteIds: number[], nextCustomId: number }`. `nextCustomId` survives deletes, so a freed id is never reused. The copy is deleted at sign-out, which already renumbers on the next sign-in and prunes history today. If `sw-auth` is empty while a session exists, the rows refill from the server with new ids, and `updateCurrentMessage` already treats a missing cached id as a miss.

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit src` -- all pass
- `npx playwright test tests/e2e/offline tests/e2e/account-data tests/e2e/auth` (with `supabase start`) -- all pass
