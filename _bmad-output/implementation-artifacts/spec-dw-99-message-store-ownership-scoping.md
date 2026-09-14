---
title: 'DW-99: scope storageService message-by-id reads and writes to one account'
type: 'bugfix'
created: '2026-09-14'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      storageService.updateMessage merges `updates` unfiltered, so a caller who may see a row
      can reassign its owner or convert a shared daily row into a private one.
    evidence: |-
      src/services/storage.ts:275 writes `{ ...message, ...updates, id: message.id }`. The id is
      now pinned to the checked row, but `userId` and `isCustom` still pass straight through, so
      `updateMessage(myRowId, { userId: other }, me)` donates a row and
      `updateMessage(dailyId, { isCustom: true, userId: me }, me)` takes a shared bundled row out
      of the partner's rotation pool. Pre-existing: the unfiltered spread predates this change.
      The repo's stronger door already solves it with an explicit field allowlist at
      src/services/customMessageService.ts:335-342. No production caller passes arbitrary
      `updates` today — src/stores/slices/messagesSlice.ts:138 is the only production call of any
      of the four methods, and it calls toggleFavorite.
    location: >-
      src/services/storage.ts:275
    severity: medium
  - summary: >-
      Shared daily rows stay arbitrarily updatable and deletable by every caller, signed out
      included, because the by-id guard enforces visibility rather than ownership.
    evidence: |-
      src/services/storage.ts isVisibleTo returns true unconditionally for `!isCustom` rows, so
      `deleteMessage(dailyId, null)` and `updateMessage(dailyId, { text }, B)` both succeed. The
      rule had to be visibility for toggleFavorite — Home favorites the daily message through it
      (src/components/DailyMessage/DailyMessage.tsx:157) — but updateMessage and deleteMessage
      have no production caller and were widened on that same rationale. The repo holds both
      rules at once: tests/unit/services/customMessageService.ownership.test.ts:326 asserts the
      same daily row is NOT editable through customMessageService. A deleted daily row does not
      heal: src/stores/slices/settingsSlice.ts:129 re-seeds only when the whole visible set is
      empty. Settle by deciding whether the two callerless writers should take
      customMessageService's stricter isOwnedBy rule (src/services/customMessageService.ts:110).
    location: >-
      src/services/storage.ts:261,291
    severity: medium
  - summary: >-
      One row-level isFavorite flag is shared by every account on a device, so each partner sees
      and can clear the other's favorited daily messages.
    evidence: |-
      src/types/index.ts:21 gives Message a single `isFavorite` boolean and the bundled daily rows
      are shared by both accounts, so toggleFavorite on a daily row writes a flag the partner
      reads. Pre-existing and schema-level — the fix is per-account favorite storage, well past
      this change's service boundary.
    location: >-
      src/types/index.ts:21
    severity: medium
baseline_revision: '37f5d15e25389ba037138c64ba1aefd5c39c20b1'
---

<intent-contract>

## Intent

**Problem:** Four `storageService` methods reach any row in the shared `messages` IndexedDB store by id with no owner check — `getMessage` (`src/services/storage.ts:157`), `updateMessage` (`:230`), `deleteMessage` (`:247`) and `toggleFavorite` (`:259`) — while their siblings `getAllMessages` (`:197`) and `getMessagesByCategory` (`:209`) already take a required nullable `userId` and filter through `visibleTo` (`:182`).

**Approach:** Give each of the four the same required `userId: string | null` parameter and route every row it touches through the existing `visibleTo` rule, so a row the caller may not see behaves exactly as a row that does not exist. Update the one production call site and the tests that call these methods.

## Boundaries & Constraints

**Always:**
- All four methods take a required (not optional) `userId: string | null`, placed last, matching `getMessagesByCategory(category, userId)`'s existing ordering.
- Visibility is the existing `visibleTo` rule and nothing stricter: shared daily rows (`isCustom` falsy) are reachable by every caller including signed-out; a custom row is reachable only by the account in `message.userId`; a custom row with no `userId` is legacy and reachable by nobody.
- A row that is not visible is treated exactly as not found — `getMessage` returns `undefined`; `updateMessage`, `deleteMessage` and `toggleFavorite` take the existing `console.warn` + no-op branch. Existence is never disclosed and the row is never altered.
- `deleteMessage` reads the row before deleting, since it currently deletes blind and has no other way to check ownership.
- Real IndexedDB errors keep today's behavior: reads degrade (`getMessage` returns `undefined`), writes re-throw.
- `src/stores/slices/messagesSlice.ts` `toggleFavorite` captures `userId` from `get()` at entry and passes that captured id to the service.

**Never:**
- Do not apply `customMessageService`'s stricter `isOwnedBy` rule (`src/services/customMessageService.ts:110`, owned custom rows only) to these four. `DailyMessage.tsx:157` favorites the rotation pool's shared daily rows through `toggleFavorite`; owner-only would break that live path.
- Do not add the post-await `{ userId, authSessionVersion }` recheck to `messagesSlice.toggleFavorite` — that is DW-100, a separate open ledger entry.
- Do not change `settingsSlice.initializeApp` (DW-101), `AdminPanel` (DW-102), `addMessage`, `addMessages`, `clearAllData`, `exportData`, or any photo method.
- Do not strip or validate `userId` / `isCustom` inside `updates` — ownership reassignment is a different defect from cross-account reach.
- Do not edit `_bmad-output/implementation-artifacts/deferred-work.md`; the orchestrator records resolution.
- Do not touch `src/services/customMessageService.ts` or migrate/claim/delete legacy ownerless rows.

## I/O & Edge-Case Matrix

Rows seeded in one `messages` store on a shared device: `BUNDLED-DAILY` (`isCustom: false`), `A-PRIVATE-CUSTOM` (`userId: A`), `B-PRIVATE-CUSTOM` (`userId: B`), `LEGACY-OWNERLESS` (`isCustom: true`, no `userId`).

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Own custom row read | `getMessage(aId, A)` | Returns the `A-PRIVATE-CUSTOM` row | No error expected |
| Cross-account read | `getMessage(aId, B)` | Returns `undefined`; no throw, no disclosure | No error expected |
| Shared daily read | `getMessage(dailyId, B)` and `getMessage(dailyId, null)` | Returns the `BUNDLED-DAILY` row for both | No error expected |
| Legacy row read | `getMessage(legacyId, A)` / `(legacyId, null)` | Returns `undefined` for every caller | No error expected |
| Cross-account update | `updateMessage(aId, { text: 'B-OVERWROTE-IT' }, B)` | No write; row on disk still reads `A-PRIVATE-CUSTOM` | `console.warn` not-found branch; resolves, does not throw |
| Own update | `updateMessage(aId, { text: 'A-EDITED' }, A)` | Row on disk reads `A-EDITED` | No error expected |
| Cross-account delete | `deleteMessage(aId, B)` | Row still present in a raw `getAll('messages')` | `console.warn` not-found branch; resolves, does not throw |
| Own delete | `deleteMessage(aId, A)` | Row gone from a raw `getAll('messages')` | No error expected |
| Cross-account favorite | `toggleFavorite(aId, B)` with `A-PRIVATE-CUSTOM.isFavorite === false` | Row's `isFavorite` still `false` on disk | `console.warn` not-found branch; resolves, does not throw |
| Own favorite | `toggleFavorite(aId, A)` | Row's `isFavorite` flips on disk | No error expected |
| Signed-out favorite of a daily row | `toggleFavorite(dailyId, null)` | Row's `isFavorite` flips — the shared rows stay reachable | No error expected |
| IndexedDB read failure | `getMessage` when the store throws | Returns `undefined` | Logged, swallowed (today's behavior) |
| IndexedDB write failure | `updateMessage` / `deleteMessage` / `toggleFavorite` when the store throws | Rejects | Logged, re-thrown (today's behavior) |

</intent-contract>

## Code Map

- `src/services/storage.ts` — the whole change surface. `visibleTo(messages, userId)` at `:182-184` is the existing filter to reuse (it takes an array; a single-row check is `visibleTo([row], userId).length === 1`, or add a sibling single-row helper next to it). `getAllMessages` `:186-207` carries the doc comment explaining why `userId` is *required and nullable*; mirror that reasoning. Targets: `getMessage` `:157-172`, `updateMessage` `:230-245` (calls `this.getMessage(id)` at `:233`), `deleteMessage` `:247-257` (no read at all today), `toggleFavorite` `:259-279` (calls `this.getMessage` `:262` then `this.updateMessage` `:264`). Leave `addMessage` `:143`, `addMessages` `:282`, `clearAllData` `:309`, `exportData` `:330` and every photo method alone.
- `src/services/customMessageService.ts` — read-only reference for the stronger pattern named in the intent: `isVisibleTo` `:99`, `isOwnedBy` `:110`, `requireOwner` `:122`, throwing unscoped overrides `:140-183`. Do not edit.
- `src/stores/slices/messagesSlice.ts:130-148` — the only production caller. `loadMessages` `:87-100` is the in-file idiom for capturing the owner (`const { userId: requestedBy, ... } = get();` then passing `requestedBy` to the service). Capture and pass only; the `stillCurrent()` recheck is DW-100.
- `src/components/DailyMessage/DailyMessage.tsx:157` — `await toggleFavorite(currentMessage.id)`; `currentMessage` comes from the rotation pool built at `messagesSlice.ts:160` (`!m.isCustom || m.active !== false`), which is why shared daily rows must stay writable. Read-only evidence; no edit needed.
- `tests/unit/services/storageSchema.test.ts` — where the new service tests go. `freshStorageService()` `:47-52` resets the module registry for a clean singleton; `deleteDatabase()` `:55`; the `message reads are scoped to one account` describe `:190-291` already has `A`/`B` constants `:198-199` and `seedSharedDevice()` `:201-237` seeding exactly the four rows the matrix needs. `:262-276` shows the raw `openDB` + `db.getAll('messages')` idiom for asserting what is actually on disk. `:187` calls `reopened.getMessage(messageId)` and must gain the new argument.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — `storageService` is mocked at `:127-138` with `toggleFavorite: vi.fn()` `:136`; `loadMessages`'s owner-passing assertion at `:624-634` (`expect(getAllStoredMessages).toHaveBeenCalledWith(A)`) is the pattern to mirror for the slice's new argument. `beforeEach` `:311-346` signs in as `A`.
- No other caller exists: `grep -rn -E "getMessage\b|updateMessage\b|deleteMessage\b|toggleFavorite\b" src tests --include='*.ts' --include='*.tsx'` returns only the sites above plus `customMessageService`'s own unrelated `updateMessage`.

## Tasks & Acceptance

**Execution:**
- `src/services/storage.ts` — add a required trailing `userId: string | null` to `getMessage`, `updateMessage`, `deleteMessage` and `toggleFavorite`; gate each on the `visibleTo` rule; thread the caller's id through the internal `this.getMessage` / `this.updateMessage` hops; give `deleteMessage` a read-then-check. Document on each why the argument is required and nullable, the way `getAllMessages` does. — Closes the unscoped service surface at its boundary.
- `src/stores/slices/messagesSlice.ts` — in `toggleFavorite`, capture `userId` from `get()` at entry and pass it to `storageService.toggleFavorite`. Do not add a post-await recheck. — The one production caller must name an owner; the recheck is DW-100.
- `tests/unit/services/storageSchema.test.ts` — add a describe covering every I/O matrix row against a real store seeded by `seedSharedDevice()`, asserting denied writes left the row unchanged via a raw `openDB` read; update the existing `getMessage` call at `:187`. — The matrix is the contract.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — assert `storageService.toggleFavorite` is called with the captured account id, mirroring the `loadMessages` case at `:625-634`. — Without it the slice could pass `null` and nothing would notice.

**Acceptance Criteria:**
- Given the four methods now require a `userId`, when `npm run typecheck` runs, then it passes and any call site that omits the argument would fail to compile.
- Given a denied read or write, when it resolves, then it is indistinguishable from the same call against an id that is not in the store — same return value, same warn-and-no-op branch, no new error type.
- Given the signed-in user favorites the daily message from Home, when `messagesSlice.toggleFavorite` runs, then the write still lands, proving shared daily rows stay writable.
- Given `customMessageService`, `settingsSlice`, `AdminPanel` and `deferred-work.md`, when the change is complete, then `git diff --name-only` lists none of them.

## Spec Change Log

## Review Triage Log

### 2026-09-14 — Review pass
- verdicts: 25 findings — high 0, medium 9, low 13, false 3, maybe-false 0
- findings:
  - `[medium]` `[defer]` intent-alignment 3a: the diff enforces visibility, not ownership, so shared daily rows stay open to arbitrary mutation and deletion — Verified: `isVisibleTo` returns true unconditionally for `!isCustom` rows. Pre-existing reach (every row was open to every caller before), narrowed but not closed. Deferred with the settle-question recorded.
  - `[false]` `[reject]` intent-alignment 3b: the change spans the service and store surfaces while the intent named "the service boundary and its tests" — The store edit is compile-forced by the required parameter; `messagesSlice.ts:138` is the only production call site. The layer itself files it as a surface count, not a defect.
  - `[low]` `[patch]` intent-alignment 3c: the live composition (signed-in account favoriting a shared daily row) is asserted at no surface — Verified: the daily-row case passed `null`, the slice case used a custom row with the service mocked. Patched: the service case now runs `toggleFavorite(dailyId, A)` then `(dailyId, null)`.
  - `[false]` `[reject]` intent-alignment 3d: `deleteMessage`'s new read adds a re-throw failure mode the intent does not name — The behaviour follows from the owner-check requirement and is the documented choice; no bad outcome. Its missing test was a separate finding and was patched.
  - `[low]` `[patch]` verification-gap: `deleteMessage`'s deliberate raw `get` is pinned by no test — Pre-verified by that layer, which swapped in `this.getMessage` and saw every test stay green. Patched: a new case uses `breakStore(service, { reads: true })` and asserts the delete rejects.
  - `[false]` `[reject]` verification-gap other: three of the four methods have no production caller, so the new tests pin a contract nothing calls — That is the premise of the work, not a defect; DW-99 is surface hardening against a future caller by its own terms. Its two other "other findings" were coverage confirmations, not claims of defect.
  - `[low]` `[reject]` verification-gap other: `messagesSlice.toggleFavorite` runs its optimistic `set()` even when the service refuses the write — The layer traced it and found no reachable trigger: `state.messages` is filled only through `getAllMessages(userId)`, which applies the same rule, so every row in the pool is visible to the current account by construction. The fix adds a return value to three methods — public surface, more than a direct correction.
  - `[low]` `[patch]` blind-hunter 1: the broken-store error contract is split three ways and `deleteMessage`'s comment implies uniformity — Verified with a stubbed connection: on a failed read, update and toggle resolve while delete rejects. The behaviours are each what the spec asked for (preserve today's behaviour; writes re-throw), so only the comment was wrong. Patched: the comment now names the asymmetry; no behaviour changed.
  - `[low]` `[reject]` blind-hunter 2: a refused write is unobservable to every caller — Same entry as the verification-gap row above; rejected on the same evidence.
  - `[medium]` `[defer]` blind-hunter 3: `deleteMessage` and `updateMessage` were widened to visibility on a rationale that only covers `toggleFavorite` — Verified, and both are callerless so nothing forces the weaker rule on them. Grouped with intent-alignment 3a and edge-case 5; deferred together.
  - `[low]` `[patch]` blind-hunter 4: no write-path test touches LEGACY-OWNERLESS — Verified: only its read was covered, and it is the one row resting on `undefined !== null`. Patched: a new case drives update, delete and toggleFavorite against it as a signed-out caller and asserts it survives untouched.
  - `[low]` `[patch]` blind-hunter 5: the new slice test seeds `messages` state it never checks — Verified: deleting the whole `set()` block from the slice left the test green. Patched: it now asserts the post-call `messages` and `messageHistory.favoriteIds`.
  - `[medium]` `[defer]` blind-hunter 6: the ownership-reassignment hole the spec forbids fixing has no ledger entry — Correct, and deferring it here creates that entry. Grouped with edge-case 2.
  - `[low]` `[reject]` blind-hunter 7: `isVisibleTo` is a third copy of a rule the comment calls "one expression" — The comment scopes its claim to this file's batch reads, which is true. `customMessageService.ts:99,110` carries a deliberately different pair (stricter for writes, documented at `:104-109`), so the two are not a drifting duplicate; unifying them is a cross-service refactor past this change.
  - `[low]` `[patch]` blind-hunter 8: the rule's explanation stayed on the wrapper, not the predicate every by-id path consults — Verified. Patched: the ownerless-row reasoning now sits on `isVisibleTo` and `visibleTo` points at it.
  - `[low]` `[patch]` blind-hunter 9: `breakStore` is a partial stub whose doc does not say so — Verified: it exposes five members, so a later case calling `getMessagesByCategory`/`addMessage`/`addMessages` would get a TypeError that reads like the intended rejection. Patched: one sentence naming what it models.
  - `[medium]` `[patch]` edge-case 1: `updates.id` retargets the `put` to a row the guard never checked — Verified with a proof-of-concept against the real store: `updateMessage(dailyId, { id: aId, text: 'B-OVERWROTE-IT' }, B)` overwrote A's private row. The new guard was fully bypassable. Patched: the write is pinned to the checked row (`id: message.id`) plus a regression test running that exact repro.
  - `[medium]` `[defer]` edge-case 2: `updates` can set `isCustom`/`userId` on a visible row and reassign ownership — Verified, and pre-existing (the unfiltered spread predates this change). Deferred with blind-hunter 6.
  - `[low]` `[patch]` edge-case 3: a failed read inside `updateMessage`/`toggleFavorite` is swallowed while `deleteMessage` rejects — Same entry as blind-hunter 1; patched as the comment correction.
  - `[low]` `[reject]` edge-case 4: the slice shows a favorite that was never written — Same entry as blind-hunter 2 and the verification-gap row; rejected on the same evidence.
  - `[medium]` `[defer]` edge-case 5: any caller, signed out included, deletes bundled rows from everyone's pool — Verified, including that a single deletion does not heal: `settingsSlice.ts:129` re-seeds only when the whole visible set is empty. Grouped with blind-hunter 3 and intent-alignment 3a.
  - `[medium]` `[defer]` edge-case 6: one row-level `isFavorite` is shared by both accounts on a device — Verified at `src/types/index.ts:21`. Pre-existing and schema-level; the fix is per-account favorite storage, past this change's boundary.
  - `[low]` `[reject]` edge-case 7: ownership could change between `deleteMessage`'s get and its delete — No code path reassigns an existing row's owner: `customMessageService.updateMessage` writes an explicit field allowlist (`:335-342`), and the one path that could is the deferred `updates` hole, which has no caller. The fix restructures the method into a single transaction — more than a direct correction for an unreachable window.
  - `[medium]` `[patch]` edge-case 8 (claim check): the spec's claim that a hidden row "behaves exactly as a row that does not exist" was false — Correct, via `updates.id`. Same entry as edge-case 1; the claim holds after the patch.
  - `[medium]` `[patch]` background security review: `updates` merged onto the stored row lets a caller name `id`, `userId` or `isCustom` — The `id` half is the edge-case 1 bypass and was patched. The `userId`/`isCustom` half is ownership reassignment: pre-existing, a different defect from cross-account reach, and deferred as the first item above rather than fixed here.

## Design Notes

Two readings of "close the four" were on the table. `customMessageService` closes its unscoped inherited methods by *throwing* (`:141-145`) because a subclass may not add required parameters to an inherited signature. `storageService` owns these four outright, so the parameter can simply be added — which is what `getAllMessages` and `getMessagesByCategory` already did in the same file. Adding the parameter is therefore the local convention and gives the compiler the guard; throwing would need four new scoped methods for no gain.

The visibility rule must be `visibleTo`, not `isOwnedBy`. `isOwnedBy` demands `isCustom === true`, and the live favorite path runs over shared daily rows — `DailyMessage.tsx:157` → `messagesSlice.toggleFavorite` → `storageService.toggleFavorite`, with `currentMessage` drawn from a pool that includes them. Owner-only would silently stop the app favoriting a daily message.

Shape to follow, mirroring `getAllMessages`:

```ts
async getMessage(id: number, userId: string | null): Promise<Message | undefined> {
  // `userId` is REQUIRED and nullable for the same reason getAllMessages's is:
  // the signed-out case is real, but it has to be stated at the call site.
  const message = await this.db!.get('messages', id);
  // A row this caller may not see is a row that is not there.
  return message && this.visibleTo([message], userId).length === 1 ? message : undefined;
}
```

## Verification

**Commands:**
- `npm run typecheck` — expected: exit 0. Note the worktree TS2883 baseline in `_bmad-output`: pre-existing worktree-only errors are not regressions, but no error may name a file this change touched.
- `npx vitest run tests/unit/services/storageSchema.test.ts tests/unit/stores/loaderIdentityGuards.test.ts` — expected: all pass, including every new case.
- `npm run test:unit` — expected: no new failures against the pre-change baseline.
- `npm run lint` — expected: exit 0.
- `git diff --name-only` — expected: exactly `src/services/storage.ts`, `src/stores/slices/messagesSlice.ts`, `tests/unit/services/storageSchema.test.ts`, `tests/unit/stores/loaderIdentityGuards.test.ts` (plus this spec file).

## Auto Run Result

Status: done

**Implemented change.** The four `storageService` methods that reached any row in the shared `messages` IndexedDB store by id — `getMessage`, `updateMessage`, `deleteMessage`, `toggleFavorite` — now each take a required trailing `userId: string | null` and gate on a single-row `isVisibleTo` predicate extracted from the existing batch `visibleTo`, which delegates to it. A row the caller may not see is reported exactly as a row that is not there: same `undefined`, same warn-and-no-op branch, no existence disclosure. `deleteMessage` gained a read-then-check, deliberately through a raw `this.db!.get` so a failed read re-throws rather than becoming a silent no-op delete. The write in `updateMessage` is pinned to the row that was checked, closing a bypass found in review.

**Files changed.**
- `../../src/services/storage.ts` — the four methods scoped; `isVisibleTo` extracted; `updateMessage`'s put pinned to `message.id`.
- `../../src/stores/slices/messagesSlice.ts` — `toggleFavorite` captures `userId` at entry and passes it; no post-await recheck (DW-100).
- `../../tests/unit/services/storageSchema.test.ts` — 16 cases covering every I/O matrix row plus the review patches, each denial confirmed against a raw `openDB` disk read.
- `../../tests/unit/stores/loaderIdentityGuards.test.ts` — asserts the slice names the captured account and that the optimistic store update lands.

**Review findings.** 25 findings across four layers plus a background security review — high 0, medium 9, low 13, false 3, maybe-false 0.
- *Patched (8 entries: 1 medium, 7 low).* The medium was the `updates.id` bypass: `updateMessage` checked the row named by `id` but wrote `{ ...message, ...updates }` into a store keyed on `id`, so `updateMessage(dailyId, { id: aId, ... }, B)` overwrote a row B may not see. Confirmed with a proof-of-concept before patching. The seven lows: an unpinned test for `deleteMessage`'s raw-read contract; no write-path coverage of the legacy ownerless row; the signed-in-favorites-a-daily-row composition asserted nowhere; a slice test seeding state it never read; the ownerless-row reasoning left on the wrapper instead of the predicate; a `deleteMessage` comment implying an error-contract uniformity that does not exist; and an undocumented partial test stub.
- *Deferred (3, all medium).* `updates` can still reassign a row's owner or privatize a shared row; shared daily rows remain arbitrarily updatable and deletable by any caller because the rule is visibility rather than ownership; one row-level `isFavorite` is shared by both accounts on a device.
- *Rejected (6).* Three-of-four methods having no production caller is the premise of the work, not a defect. The change spanning the store surface is compile-forced by the required parameter. `deleteMessage`'s new failure mode follows from the owner-check requirement. The optimistic `set()` on a denied write has no reachable trigger — every row in the pool is visible to the current account by construction — and its fix adds public surface. `isVisibleTo` duplicating `customMessageService`'s predicate is a deliberate difference (stricter for writes there), not drift. The delete-path TOCTOU window cannot open: no code path reassigns an existing row's owner.

**Follow-up review recommended: false.** First pass; one medium entry patched and seven low. The threshold is a patched high or two patched mediums, and neither was met.

**Verification.** `npm run typecheck` exit 0. `npm run test:unit` 91 files / 1722 tests, all passing (1719 before the review patches). `npm run lint` 0 errors, 3 pre-existing `react-refresh` warnings in untouched `EventCountdown.tsx`. `git diff --name-only HEAD` lists exactly the four source and test files plus this spec. Every I/O matrix row maps to a named case that ran and passed. The `updates.id` bypass was reproduced against the real store before the fix and the same repro is now a regression test.

**Residual risks.** The three deferred items above are the honest residue; the second is the one worth a human decision, since a caller could delete bundled daily rows one at a time and `settingsSlice.initializeApp` re-seeds only when the whole visible set is empty. None of the four methods except `toggleFavorite` has a production caller, so none of this is reachable from the UI today — this change is surface hardening, as DW-99 states.
