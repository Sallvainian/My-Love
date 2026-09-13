---
title: 'Partition custom messages by account'
type: 'bugfix'
created: '2026-09-12'
status: ready-for-dev
baseline_revision: 34c01f545967222dfb6d873822278c168325cb97
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The `messages` store in `my-love-db` carries no owner (`src/types/index.ts:21-31` `Message` has no `userId`). `customMessageService.getAll` (`src/services/customMessageService.ts:134`) reads `db.getAll('messages')`, the inherited `get/getAll/update/delete/clear/getPage` from `BaseIndexedDBService.ts:122-246` are public on the same store, and `storageService.getAllMessages` (`src/services/storage.ts:174`) feeds every row into the daily rotation. On a shared browser, account B lists, edits, deletes, exports and rotates through A's custom messages, B's import de-duplicates against A's texts, and `signedOutState()` (`authSlice.ts:61-140`) resets none of `messages`, `customMessages`, `customMessagesLoaded` (CAP-8 / F8).

**Approach:** Stamp every new custom row with the authenticated `userId`, index it, and make ownership a required argument at the service boundary so nothing returns, changes or counts a row the caller does not own. Daily seeded rows (`isCustom: false`, no owner) stay shared. Custom rows without an owner are legacy: stored, hidden from everyone, never claimed. Slice actions capture identity at entry and drop stale continuations; sign-out resets the account-scoped state.

## Boundaries & Constraints

**Always:**
- Add `userId?: string` to `Message`; set it in `customMessageService.create` and in every import path from the caller-supplied signed-in id, never from the export file (`CustomMessagesExport` gains no owner field; ignore one if present).
- Every public method on `customMessageService` takes `userId` and matches it against the row before returning, mutating, counting or exporting — including duplicate detection in `importMessages` (`:255`) and `migrationService.ts:75,105`. Shape after `moodService.getAllForUser` (`src/services/moodService.ts:255`). Because TypeScript cannot narrow the inherited public methods, override them on this service to throw; nothing may reach the base implementations for this store.
- `storageService.getAllMessages` / `getMessagesByCategory` return shared daily rows plus only the caller's custom rows; ownerless custom rows are excluded for every caller, signed-out included.
- Schema change only in `src/services/dbSchema.ts`: bump `DB_VERSION` from 7 to 8 once, declare `'by-user': string` on the `messages` indexes, create the index in the fresh-store branch (`:237-243`) and, for an existing store, through `tx.objectStore('messages')` gated on `indexNames.contains` — the v7 pattern at `:285-307`. Every opener already calls `upgradeDb`; keep it that way.
- In `messagesSlice.ts`, capture `{ userId, authSessionVersion }` at entry of `loadMessages`, `loadCustomMessages`, `createCustomMessage`, `updateCustomMessage`, `deleteCustomMessage`, `exportCustomMessages`, `importCustomMessages`; recheck before every post-await `set()`, catch and reload included (the `photosSlice`/`eventsSlice` idiom). Pass the captured id to the service.
- `signedOutState()` resets `customMessages: []`, `customMessagesLoaded: false`, and leaves no other account's custom rows in `messages` for the next session (reset it, or strip custom rows; the account-switch test decides which is sufficient).

**Never:**
- Infer a legacy row's owner from the signed-in account, timestamps, device or the localStorage migration; delete, migrate, claim or surface such rows; add a recovery screen.
- Partition or stamp the bundled daily messages (`settingsSlice.ts:123-138` seeding); change rotation semantics beyond ownership filtering.
- Add a private upgrade callback in any service; gate any branch on `oldVersion < N`; open the database under a second name.
- Edit `src/types/database.types.ts` (unrelated; IndexedDB only).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| B lists after A created | A owns 3 rows; B signed in | `getAllForUser(B)` → `[]`; AdminPanel shows none | — |
| B gets by id | A's id | `null` | No throw (read) |
| B updates / deletes / clears | A's id or clear-all | No row changes | Write throws |
| B exports | A owns rows | Export contains 0 messages | — |
| B imports A's text | duplicate check | Imported for B; A's copy untouched | — |
| Rotation for B | A's active custom rows | Rotation pool = daily rows + B's own | — |
| Switch back to A | after B's session | A's 3 rows listed again | — |
| Signed out | `userId` null | Custom operations refuse; daily rows still load | Throw on write, `[]` on read |
| Legacy ownerless custom row | no `userId` | Hidden from A, B and signed-out; still on disk | — |
| Import resolves after switch | A's import pending, then B | Rows stamped A; no `set()` under B | — |
| Fresh database | v0 | `messages` has `by-user`, `by-category`, `by-date` | — |
| Upgrade from v7 | existing store with rows | `by-user` added; rows and other stores intact; no hang when another service opened first | — |

</intent-contract>

## Code Map

- `src/services/customMessageService.ts` `:65` `create`, `:103` `updateMessage`, `:134` `getAll`, `:195` `getActiveCustomMessages`, `:203` `exportMessages`, `:240` `importMessages` — every one gains an owner argument and filter. Header comment `:27` lists the inherited methods to override.
- `src/services/BaseIndexedDBService.ts:101-246` — unchanged; other services rely on it.
- `src/services/storage.ts:143-260` — `addMessage`, `getAllMessages`, `getMessagesByCategory`, `updateMessage`, `deleteMessage`, `toggleFavorite`, `addMessages`. Only the reads need scoping; `messagesSlice.addMessage` (`:88`, writes `isCustom: true` without owner) has no component caller — leave the dead action alone and note it.
- `src/services/migrationService.ts:75,105` — runs from `src/App.tsx:312` once a session exists. Migrated localStorage rows are legacy: store them without an owner or skip them; do not stamp the current user.
- `src/services/dbSchema.ts:113-120` schema, `:190` `DB_VERSION`, `:237-243` fresh `messages` store, `:285-307` the existing-store index precedent.
- `src/stores/slices/messagesSlice.ts:79` `loadMessages`, `:335-536` custom actions; `src/stores/slices/photosSlice.ts` (story 4) for the guard shape.
- `src/stores/slices/authSlice.ts:61-140` `signedOutState()`; `src/stores/useAppStore.ts:193-199` confirms `customMessages` is not persisted.
- Tests to extend: `tests/unit/services/dbSchema.test.ts` (`:49` fresh, `:77` upgrade, `:216` version constant), `dbSchema.indexes.test.ts`, `storageSchema.test.ts:126` (existing-profile repair), `swDbScoping.test.ts:76-146` (owner scoping and v7 index migration precedents). New: `tests/unit/services/customMessageService.ownership.test.ts` and `messagesSlice` cases in `tests/unit/stores/loaderIdentityGuards.test.ts` using its `deferred()`/`switchToUserC` helpers.

## Tasks & Acceptance

**Execution:**
- Types and schema: `Message.userId`, `by-user` index, `DB_VERSION = 8`, upgrade branch; update the three schema tests.
- Service: owner-scoped methods, overridden base methods, import/export/duplicate scoping, `storageService` read scoping, migration handling.
- Store: identity capture/recheck in the seven actions; `signedOutState()` additions; AdminPanel needs no change if the slice signature stays.
- Tests for every matrix row against real fake-indexeddb, service calls directly, plus the paused-promise account switch. Prove each guard red-then-green by reverting it alone.

**Acceptance Criteria:**
- Given A's rows in one database, when B calls any custom-message service method or slice action, then B sees, changes, exports or counts none of them, and A sees them all again after switching back.
- Given an ownerless custom row, when any account or the signed-out state loads, then it is absent from results and still present on disk.
- Given A's import pending across a switch to B, when it settles, then rows carry A's id and B's store is unchanged.
- Given a v7 database with rows and a fresh database, when opened by any service, then `by-user` exists, rows survive, and no other store changes.
- Given daily rotation, when custom rows exist for another account, then the pool holds daily rows plus the caller's own only.
- Given `npm run lint`, `npm run typecheck`, `npm run test:unit` and `fnox exec -- npm run build`, then all pass.

## Spec Change Log

## Design Notes

- Owner as an explicit argument (not read from the store inside the service) keeps services store-free and makes the paused-promise case testable: the slice passes the id it captured, so a late continuation cannot pick up B's id.
- The legacy-row assumption is settled in `SPEC.md`; if product wants those rows back, that is a new decision for Sallvain, not this story.

## Verification

```
npm run lint && npm run typecheck && npm run test:unit
fnox exec -- npm run build
```
