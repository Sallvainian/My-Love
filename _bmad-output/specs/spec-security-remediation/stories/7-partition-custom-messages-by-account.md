---
title: 'Partition custom messages by account'
type: 'bugfix'
created: '2026-09-12'
status: done
baseline_revision: f876e640454b367f6b9095b9adf1efbcea04d0f1
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      storageService.getMessage / updateMessage / deleteMessage / toggleFavorite still
      reach any row in the messages store by id with no ownership check.
    evidence: |-
      Verified at src/services/storage.ts:157 (getMessage returns any row) and :256-260
      (toggleFavorite reads through it then writes isFavorite with no owner check).
      Pre-existing: none of these four were introduced or altered by this story, and the
      intent's Always list names only getAllMessages and getMessagesByCategory. Not
      reachable from the UI today because the ids a component can offer now come from the
      scoped `messages` array, but the service surface remains unscoped for any future caller.
    location: >-
      src/services/storage.ts:157,227-276
    severity: medium
  - summary: >-
      messagesSlice.toggleFavorite set()s after an await with no identity capture or recheck.
    evidence: |-
      Verified at src/stores/slices/messagesSlice.ts:130-148: `await storageService.toggleFavorite(messageId)`
      is followed by an unguarded set() writing both `messages` and `messageHistory.favoriteIds`.
      Pre-existing and outside the seven actions the intent enumerates; AGENTS.md records the
      guard as copy-pasted at 19 sites with uneven coverage. A switch landing mid-flight appends
      the outgoing account's message id to the incoming account's favoriteIds.
    location: >-
      src/stores/slices/messagesSlice.ts:130-148
    severity: medium
  - summary: >-
      settingsSlice.initializeApp reads get().userId live at two points separated by an await,
      with no identity capture or recheck around its set({ messages }).
    evidence: |-
      Verified at src/stores/slices/settingsSlice.ts:126,141 with set() at :143,:147 and
      get().updateCurrentMessage() at :151. Caused by this story (the argument is new), but
      initializeApp is guarded by a module-level isInitialized flag and an App-level ref, so it
      runs once per page load and no reachable interleaving was demonstrated. It is now the only
      messages writer without the guard idiom this story introduced elsewhere.
    location: >-
      src/stores/slices/settingsSlice.ts:126,141
    severity: low
  - summary: >-
      The intent's I/O matrix states outcomes at three surfaces (service, store, UI) but the
      tests occupy two; the "AdminPanel shows none" half of row 1 is unasserted.
    evidence: |-
      No AdminPanel component test exists anywhere under tests/, and no E2E spec covers admin or
      custom messages. The store chain that would carry it (customMessagesLoaded: false re-firing
      AdminPanel.tsx:26-30) is verified to exist by reading, not by test. Story :73 sanctions this
      ("AdminPanel needs no change if the slice signature stays"), so it is a gap against the
      verbatim matrix rather than a deviation from the plan.
    location: >-
      src/components/AdminPanel/AdminPanel.tsx:26-30
    severity: low
  - summary: >-
      DeleteConfirmDialog calls deleteCustomMessage without await or catch, so a rejected
      delete closes the dialog as if it succeeded and surfaces as an unhandled rejection.
    evidence: |-
      Verified at src/components/AdminPanel/DeleteConfirmDialog.tsx:21-24
      (`deleteCustomMessage(message.id); onConfirm();`) against
      src/stores/slices/messagesSlice.ts:497-500, which re-throws. The missing await is
      pre-existing — messagesSlice re-threw before this story and
      BaseIndexedDBService.delete already threw on a DB error — but deleteForUser adds two
      new throw cases (signed out via requireOwner, and a row owned by someone else).
      Neither new case is reachable from the dialog today: the ids it offers come from the
      owner-scoped `customMessages` list and AdminPanel renders only behind a session.
      Settle by driving deleteCustomMessage through a rejection in a component test.
    location: >-
      src/components/AdminPanel/DeleteConfirmDialog.tsx:21-24
    severity: low
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

## Review Triage Log

### 2026-09-13 — Review pass
- verdicts: 31 findings — high 5, medium 12, low 14, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` blind-hunter: `messageHistory.shownMessages` survives sign-out, so today's entry points at a stripped custom row and Home goes blank for the rest of the day — Verified: `messagesSlice.ts:172` treats a cached id as authoritative and only recomputes `if (!messageId)`; `:208` `messages.find(...)` then yields `undefined`; `grep messageHistory src/stores/slices/authSlice.ts` returned nothing. Fixed: `discardAccountState` now prunes entries whose id is no longer in the pool; covered by "drops the rotation-history entries that point at stripped rows".
  - `[high]` `[patch]` blind-hunter: after an in-place account switch the incoming account's own custom rows never rejoin the rotation pool — Verified: `initializeApp` returns early on the module-level `isInitialized` flag (`settingsSlice.ts:81`) and `loadMessages()` is called only from the four custom-message mutators (`messagesSlice.ts:425,467,494,599`). Fixed: new `reloadRotationPool` wired into all three `setAuthUser` exits, gated on the id changing and skipped on cold boot; 7 covering tests.
  - `[low]` `[reject]` blind-hunter: the new `by-user` index has no production reader — Real (no `getAllFromIndex('messages','by-user')` anywhere), but the intent's Always list explicitly requires declaring and creating it; routing reads through it adds complexity and dropping it would edit this build's spec.
  - `[low]` `[reject]` blind-hunter: `createUnownedIfAbsent` makes migration an O(N×M) full-store scan — Real, but it is one-time, off the critical path, and migration-only; the fix (a text index, or threading a single snapshot) is more than a direct correction.
  - `[medium]` `[reject]` blind-hunter: migration stores rows nobody can see and then removes the LocalStorage key — Rows remain on disk (asserted by the new migration test), so nothing is destroyed; the intent's Never list forbids claiming, migrating or surfacing them, and Design Notes routes their return to Sallvain. Recorded under residual risks.
  - `[low]` `[patch]` blind-hunter: the class header claims every public method takes a caller id, which `createUnownedIfAbsent` does not — Verified at `customMessageService.ts:30` against `:246`. Fixed: claim corrected and the method listed as unowned/migration-only.
  - `[low]` `[patch]` blind-hunter: the JSDoc describing `getAllMessages` sits on `visibleTo` — Verified at `storage.ts:174-192`. Fixed: split between the two functions.
  - `[medium]` `[defer]` blind-hunter: `storageService.getMessage` is unscoped and `toggleFavorite` writes through it with no owner check — Verified at `storage.ts:157,256-260`. Pre-existing; not introduced by this diff and not named by the intent. Deferred.
  - `[medium]` `[defer]` blind-hunter: `messagesSlice.toggleFavorite` `set()`s after an await with no identity guard — Verified at `messagesSlice.ts:130-148`. Pre-existing and outside the seven actions the intent enumerates. Deferred.
  - `[low]` `[defer]` blind-hunter: `initializeApp` writes `messages` after two awaits with no identity capture — Verified at `settingsSlice.ts:126,141,143,147`. Caused by this change, but it runs once per page load behind `isInitialized` and no reachable interleaving was demonstrated. Deferred.
  - `[low]` `[patch]` blind-hunter: the `getActiveCustomMessages` test comment calls it "the pool the daily rotation draws from" — Verified false: the real pool is built at `messagesSlice.ts:161` and the method has no production caller. Fixed: comment corrected. The dead-code half is rejected — the intent names the API.
  - `[medium]` `[patch]` blind-hunter: `migrationService` was rewritten with no unit test — Same defect as the verification-gap finding below; fixed by `tests/unit/services/migrationService.ownership.test.ts` (7 cases).
  - `[low]` `[patch]` blind-hunter: `dbSchema.ts:220` still reads "migrations for v1-v5" at v8 — Verified. Fixed: range updated to v1–v8. The empty Spec Change Log half is rejected: its fix would edit this build's spec.
  - `[medium]` `[patch]` edge-case-hunter: stale `messageHistory` leaves the next account's Home with no daily message — Same defect as row 1; shares its fix and its test.
  - `[high]` `[patch]` edge-case-hunter: nothing reloads the incoming account's custom rows on an in-place switch — Same defect as row 2; shares its fix and its tests.
  - `[medium]` `[defer]` edge-case-hunter: `getMessage`/`updateMessage`/`deleteMessage`/`toggleFavorite` still reach any row by id — Same pre-existing defect as row 8; deferred with it.
  - `[medium]` `[defer]` edge-case-hunter: `toggleFavorite` `set()`s after an await with no capture — Same pre-existing defect as row 9; deferred with it.
  - `[high]` `[reject]` edge-case-hunter: every pre-existing custom row lacks `userId`, so existing users' custom messages vanish from AdminPanel and rotation — Verified real. Every proposed fix (backfill on upgrade, a one-time claim) is named in the intent's Never list, and Design Notes assigns the decision to Sallvain. Rejected here and recorded as the headline residual risk.
  - `[low]` `[reject]` edge-case-hunter: the dead `addMessage` action would write an unowned custom row — The intent's Code Map directs leaving the dead action alone and noting it; it is `@deprecated` with the reason and has no caller.
  - `[medium]` `[patch]` verification-gap: no test executes the real `migrateCustomMessagesFromLocalStorage`; an owner-stamping revert of `migrationService.ts:110` leaves the whole suite green — Pre-verified by the layer's evidence rules. Fixed with the new 7-case migration test.
  - `[medium]` `[patch]` verification-gap: `initializeApp`'s test pins no owner argument; hardcoding `null` at `settingsSlice.ts:126,141` leaves both cases green — Pre-verified; confirmed independently that `TestState` declares no `userId`. Fixed: test store now declares one and both branches assert `getAllMessages` was called with it.
  - `[medium]` `[patch]` verification-gap (other): a stripped custom row leaves the next account's Home blank for the calendar day — Same defect as row 1; shares its fix.
  - `[high]` `[patch]` verification-gap (other): after an in-place switch B's own custom rows never enter the rotation pool — Same defect as row 2; shares its fix.
  - `[low]` `[reject]` verification-gap (other): the `messages` `by-user` index has no reader — Same as row 3; the intent mandates the index.
  - `[low]` `[defer]` intent-alignment: the matrix states outcomes at three surfaces but the tests occupy two — no AdminPanel component test exists. Story `:73` sanctions it; deferred as a gap against the verbatim matrix.
  - `[high]` `[patch]` intent-alignment: R5a vs R5b — the pool property holds at the read boundary but not in live state after a switch — Same defect as row 2; this is the reading that settles it, and it shares that fix.
  - `[medium]` `[reject]` intent-alignment: migrated rows are invisible at the product surface though the test surface calls it intended — Same as row 5; intent-mandated, recorded as a residual risk.
  - `[low]` `[reject]` intent-alignment: the `messages` reset is split between `signedOutState()` and `discardAccountState` rather than living wholly in the former — The intent's own parenthetical delegates reset-vs-strip, and `signedOutState()` takes no arguments so it cannot read the current array; the split is forced. Behavior is covered by `signOutClearsAccountState.test.ts`.
  - `[low]` `[reject]` intent-alignment: `storageService.exportData` gained a `userId` it has no caller for — Forced by the `getAllMessages` signature change; it would not compile otherwise.
  - `[low]` `[reject]` intent-alignment: ownership is enforced by an in-memory filter rather than an index query — Matches the intent's own "required argument at the service boundary" wording; R6a is the weaker reading.
  - `[low]` `[reject]` intent-alignment: "prove each guard red-then-green by reverting it alone" leaves no artifact in the diff — Not a code defect; the implementation reported 32 mutations in the first round and 19 in the patch round with per-mutant results, and the fix would be a spec/process artifact.


### 2026-09-13 — Review pass (follow-up)
- verdicts: 28 findings — high 0, medium 6, low 17, false 4, maybe-false 1
- findings:
  - `[medium]` `[patch]` blind-hunter: `discardAccountState` prunes `shownMessages` by the complement of the current pool, so an empty pool wipes the whole persisted map — Verified: `authSlice.ts:270` reads `get().messages ?? []`, which is not persisted (`useAppStore.ts:175-201` omits it), and `App.tsx:245` calls `clearAuth()` on a no-session boot before anything seeds it; `survivingIds` is then empty and every entry fails the filter. The existing case at `signOutClearsAccountState.test.ts:378` seeds a populated pool first, so it never reaches this state. Fixed: the filter now keys on the ids actually stripped (`!strippedIds.has(id)`); new case "keeps the whole rotation history when the pool has not loaded yet", proved red against the old predicate.
  - `[low]` `[reject]` blind-hunter: `importCustomMessages` returns its result after a mid-flight switch, so `AdminPanel.tsx:62` alerts "Import complete" to the wrong account — Real at the cited lines, but it needs a switch inside a file import, nothing is disclosed (the rows are A's and B's store is deliberately untouched), and the smallest fix adds a session-changed signal and a branch in the component.
  - `[low]` `[defer]` blind-hunter: `DeleteConfirmDialog` calls the now-throwing delete with no `await` or `.catch()` — Verified at `DeleteConfirmDialog.tsx:21-24`. Pre-existing: `messagesSlice.ts:499` re-threw before this story and `BaseIndexedDBService.delete:210-213` already threw on a DB error. Neither new throw case is reachable from the dialog. Deferred.
  - `[low]` `[reject]` blind-hunter: `messageHistory.favoriteIds` keeps the outgoing account's row ids while its sibling `shownMessages` is pruned — Real inconsistency, but no reachable consequence: IndexedDB autoIncrement never reuses a key, so a stale id can never collide with a row in the next account's pool, and `DailyMessage.tsx:59` only tests ids drawn from that pool. The fix is new pruning logic, not a direct correction.
  - `[false]` `[reject]` blind-hunter: the seed gate `storedMessages.length === 0` now answers a device-global question from a per-account list — The bad outcome needs daily rows absent while the caller owns custom rows. Unconstructible: `addMessages` writes in one transaction so seeding is all-or-nothing, `clearAllData` has no caller, custom rows can only be created after a seeded boot, and legacy unowned rows are invisible to the count.
  - `[low]` `[patch]` blind-hunter: `reloadRotationPool`'s fire-and-forget chain has no `.catch()` — Verified at `authSlice.ts:205-210`: `loadMessages` catches internally but `updateCurrentMessage()` runs inside the `then` callback, on the auth path, with no caller to surface a throw. Fixed: `.catch()` added that logs.
  - `[low]` `[reject]` blind-hunter: `getForUser` and `getActiveCustomMessages` have no production caller — Confirmed by grep (only the service's own definitions). Both are intent-mandated API: the matrix row "B gets by id → `null`" and AC-3.5.2. Same ground as the `by-user` index.
  - `[false]` `[reject]` blind-hunter: the class header is wrong about `add()` and overstates the override guarantee — `add()` is inherited (`BaseIndexedDBService.ts:101`, `protected`), and the header says "Inherits", not "inherits publicly". "Nothing may reach the base implementation" is literally true: the override at `customMessageService.ts:148` throws before the base body runs. Neither half disproves itself into a defect.
  - `[medium]` `[defer]` blind-hunter: `storageService.getMessage` / `updateMessage` / `deleteMessage` / `toggleFavorite` stay unscoped — carried from the 2026-09-13 pass (same location and claim; code unchanged). Already deferred; not deferred again.
  - `[low]` `[reject]` blind-hunter: the `tx`-less path through the v8 upgrade branch skips the index silently and is untested — Real, but `dbSchema.ts:258` mirrors the v7 moods precedent at `:315` that the intent named as the pattern to follow, and all five openers were re-confirmed to thread `tx`. The fix adds a branch to intent-mandated shape.
  - `[low]` `[reject]` blind-hunter: `exportData`'s new `userId` has no test, so hardcoding `null` stays green — Real, but the method has no caller anywhere in `src`, `tests` or `scripts`, so nobody meets the defect; the verification-gap layer independently dropped this path as unobservable.
  - `[low]` `[patch]` blind-hunter: `freshService()` drops the cached handle without closing it, leaking one connection per case — Verified at `customMessageService.ownership.test.ts:37-43` against the closers its neighbours register. Named harm: a blocked versionchange hang the first time a case reuses a factory. Fixed: `cached?.close?.()` before the null.
  - `[medium]` `[patch]` edge-case-hunter: `clearAuth` during a signed-out page load wipes the whole 30-day `shownMessages` map — Same defect as row 1; shares its fix and its test.
  - `[low]` `[defer]` edge-case-hunter: `initializeApp` can land A's rows in B's pool because it captures no identity — carried from the 2026-09-13 pass (same location and claim; code unchanged). Already deferred; not deferred again.
  - `[false]` `[reject]` edge-case-hunter: `exportCustomMessages` signed out downloads a silently empty backup — The matrix specifies exactly this ("Signed out … `[]` on read"), and AdminPanel renders only behind a session, so the state is not reachable. Browsers suffix rather than overwrite, so the stated consequence does not follow either.
  - `[maybe-false]` `[reject]` edge-case-hunter: a rejected `tx.store.add` skips `await tx.done`, leaving an unhandled rejection — Could not settle from the code: `idb` creates the `done` promise when `.done` is accessed, and on the reject path it never is, so no listener is attached and no rejection may exist. If true it is only console noise on a quota/constraint error. Would be settled by checking whether `idb` caches the done promise at transaction creation, or by a test forcing a rejecting `add`.
  - `[medium]` `[reject]` edge-case-hunter: legacy rows are left unreadable, undeletable and the LocalStorage key is removed — carried from the 2026-09-13 pass (same location and claim; code unchanged). The added "undeletable" half rejects on the same ground: reaching those rows is on the intent's Never list.
  - `[low]` `[reject]` edge-case-hunter: migration dedupe narrowed from every custom row to unowned rows only — Real change in behaviour, but the duplicate it can produce is unowned and therefore invisible to every account and absent from every rotation pool, so the harm is disk space; the proposed fix reintroduces the cross-account read `migrationService.ts:84-90` documents rejecting.
  - `[low]` `[reject]` edge-case-hunter: `createUnownedIfAbsent` is public, takes no owner and reads the whole store, contradicting the Always list — Accurate, but its fix is to edit this build's spec.
  - `[low]` `[defer]` verification-gap: no test asserts `initializeApp` withholds a pool read when the account changed mid-flight — carried from the 2026-09-13 pass (same location and claim; code unchanged). The newly filed reachability mechanism was checked and does not reach the unguarded window: `storage.ts:18-22` short-circuits once `this.db` is set, so the blocking v8 `openDB` completes at `settingsSlice.ts:120`, before `get().userId` is read at `:126`. Already deferred; not deferred again.
  - `[medium]` `[patch]` verification-gap (other): a no-session boot empties the entire persisted `shownMessages` map — Same defect as row 1; shares its fix and its test. Its probe (`shownMessages.size === 0` after `clearAuth`) independently confirmed the reachability.
  - `[low]` `[defer]` verification-gap (other): `DeleteConfirmDialog` swallows the new throw contract into an unhandled rejection — Same defect as row 3; deferred with it.
  - `[low]` `[reject]` verification-gap (other): the `by-user` index the v8 bump pays for is never read — carried from the 2026-09-13 pass (same location and claim; code unchanged). The intent's Always list requires declaring and creating it.
  - `[low]` `[defer]` intent-alignment: three matrix rows are stated at the product surface; no AdminPanel component test or E2E spec exists — carried from the 2026-09-13 pass (same location and claim; code unchanged). Already deferred; not deferred again.
  - `[false]` `[reject]` intent-alignment: the "switch back to A" test is three `getAllForUser` calls with no account switch — True of that test, but the matrix row is covered at the store surface: `loaderIdentityGuards.test.ts:666-677` drives a real `setAuthUser` switch and asserts `messages` equals the incoming account's pool. The service-surface case correctly asserts the filter-not-deletion property instead.
  - `[medium]` `[defer]` intent-alignment: `storage.ts` is half-scoped — two reads demand an owner, four by-id methods do not — carried from the 2026-09-13 pass (same location and claim as the blind-hunter row; code unchanged). Already deferred; not deferred again.
  - `[low]` `[reject]` intent-alignment: `createUnownedIfAbsent` inverts the Always list's "every public method" to preserve the Never list — Same as the edge-case row above; its fix is to edit this build's spec.
  - `[low]` `[reject]` intent-alignment: pruning `messageHistory.shownMessages` reaches state the intent never enumerated — Accurate as scope commentary, but the prune is the previous pass's sanctioned fix for a blank Home, and removing it would edit this build's spec and reintroduce that defect. The one real defect inside it is row 1, patched.

## Auto Run Result

Status: done
Blocking condition: none

### Summary

Follow-up review pass over the same diff (`f876e640..HEAD` plus working tree). No re-implementation: four review layers filed 28 findings, three entries were patched, one new entry deferred, and six prior-pass entries carried forward unchanged. The patches fix a regression the previous pass introduced, close an unhandled-rejection path on the auth flow, and stop a connection leak in the new ownership test.

### Files changed

- `src/stores/slices/authSlice.ts` — history prune now keys on the ids actually stripped rather than the complement of the loaded pool; `reloadRotationPool` gained a `.catch()`.
- `tests/unit/stores/signOutClearsAccountState.test.ts` — new case "keeps the whole rotation history when the pool has not loaded yet".
- `tests/unit/services/customMessageService.ownership.test.ts` — `freshService()` closes the cached connection before dropping it.
- `_bmad-output/specs/spec-security-remediation/stories/7-partition-custom-messages-by-account.md` — this triage log entry, one new deferred item, result.

### Review findings breakdown

28 findings across four layers — high 0, medium 6, low 17, false 4, maybe-false 1. Grouped into 3 patched entries (medium 1, low 2), 1 newly deferred entry, 6 carried entries, 18 rejected findings.

**Patched:** `discardAccountState` wiping the entire persisted 30-day `shownMessages` map on any signed-out page load (medium — found independently by all three code layers); `reloadRotationPool`'s missing `.catch()` (low); the test-helper connection leak (low).

**Deferred (new):** `DeleteConfirmDialog` calling `deleteCustomMessage` with no `await` or `.catch()`.

**Carried unchanged from the 2026-09-13 pass** (same location, same claim, code unchanged — not re-patched or re-deferred): the four unscoped by-id methods in `storage.ts`; `initializeApp`'s missing identity capture; the untested AdminPanel surface; the unreadable legacy rows; the unread `by-user` index.

**Rejected, with reasons:** recorded per row in the triage log above. The four `false` verdicts are the seed-gate claim (precondition unconstructible), the class-header claim (both halves accurate as written), the signed-out export (matrix-specified behaviour, state unreachable), and the switch-back coverage claim (covered at the store surface).

### Follow-up review recommendation

`false`. This was a follow-up pass and it patched no `high`, so the work has converged. Patched counts by verdict: high 0, medium 1, low 2.

### Verification performed

- `npm run lint` — 0 errors, 3 warnings (all pre-existing in `EventCountdown.tsx`, untouched).
- `npm run typecheck` — clean (`tsc -b --force`, all three projects).
- `npm run test:unit` — 1621 passed, 86 files, 0 failures, 0 skipped (up from 1620; the new case is the difference).
- `fnox exec -- npm run build` — clean.
- Red-then-green on the patch: restoring the old predicate turned exactly the new case red (1 failed, 26 passed) and nothing else; the file was restored and the suite re-run green.

### Residual risks

- The prior pass's residual risks stand unchanged: existing custom rows and migrated LocalStorage rows remain invisible to every account by design, and `messageHistory` is device-wide rather than account-scoped.
- `initializeApp` remains the only `messages` writer without the capture-and-recheck idiom this story introduced elsewhere. Two layers raised it again this pass. The reachability mechanism they proposed does not hold, but the guard's absence is real and is carried as a deferred item rather than closed.
- The review diff deliberately excluded `{spec_file}` (routed to the edge-case layer as `claims_file` instead) and `_bmad-output/implementation-artifacts/deferred-work.md`, which this invocation placed out of scope. No code file was excluded.
