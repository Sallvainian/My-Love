---
title: 'Remove the scripture IndexedDB object stores'
type: 'chore'
created: '2026-09-16'
status: done
review_loop_iteration: 0
followup_pass: true
followup_review_recommended: false
baseline_revision: db3eb2e86d6861b57d4907937702785aa8b4038b
context: []
warnings:
  - oversized
deferred:
  - summary: >-
      Successful openMyLoveDB connections never register idb blocking/versionchange,
      so the next version bump can hang on these long-lived holders the same way v9
      hangs on the service worker.
    evidence: |-
      Pre-existing: storage, mood, and customMessage also omitted blocking before
      this story. The new helper only adds blocked. A v11 bump would need
      blocking() { db.close() } (or equivalent) on the live handles.
    location: >-
      src/services/dbSchema.ts:314-353
    severity: low
  - summary: >-
      STORE_NAMES core-names test still omits MESSAGE_FAVORITES, the fifth survivor.
    evidence: |-
      Pre-existing: the core it listed MESSAGES/PHOTOS/MOODS/SW_AUTH before this
      story. Deleting the scripture STORE_NAMES it did not add the favorites name.
    location: >-
      tests/unit/services/dbSchema.test.ts:566-571
    severity: low
  - summary: >-
      window.confirm from the IndexedDB blocked listener is not a user gesture;
      some browsers may suppress the dialog and take the dismiss path.
    evidence: |-
      Unverified browser behavior. Would settle it: load a v9 profile in Safari
      iOS PWA with a held connection and see whether confirm appears. If it does
      not, init rejects with no prompt (medium if true).
    location: >-
      src/services/dbSchema.ts:322-334
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Devices still carry four scripture IndexedDB stores (`scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages`) after the app and database objects are gone. `DB_VERSION` is 9. A service worker still on v9 (`src/sw-db.ts:27`) can block a v10 upgrade.

**Approach:** Strip scripture types, schema members, `STORE_NAMES`, and v5 create-branches from `dbSchema.ts`. Bump `DB_VERSION` 9 → 10 with an existence-gated `deleteObjectStore` pass through idb `unwrap()`. Attach a `blocked` handler on every app-side `openDB` of `my-love-db` that shows a reload prompt. Correct the paired exact-set tests in the same change.

## Boundaries & Constraints

**Always:**
- Survivors are five: `messages`, `message-favorites`, `photos`, `moods`, `sw-auth`. Not four.
- `deleteObjectStore` for the four scripture names goes through `unwrap()` (already imported at `dbSchema.ts:2`). The typed wrapper cannot name a store absent from `MyLoveDBSchema`. Same pattern as the v7 `by-date` drop at `:362`.
- Gate the drop on store existence, not `oldVersion < N`. The 244-250 existence-check paragraph stays; amend it, never delete it. Same for version-history comments at `:111` and `:195-207`.
- `blocked` on every app-side open (`storage.ts`, `moodService.ts`, `customMessageService.ts`). A shared helper from `dbSchema.ts` is the way to not miss one: the v7-to-v8 test already proves moodService can win the versionchange race. Show a user-visible `confirm` whose message says they must reload to finish the update. Accept → `location.reload()`. Dismiss → reject the open so existing init-error paths fire; do not wait forever and do not swallow.
- Assertion trap in `dbSchema.test.ts`: `:73` store count 9→5; delete the `it` at 78-128 (that deletes both `:127` `toBe(9)` and the v4 `:106` `toBe(4)` inside it — do not keep or resurrect that `it` just to preserve line 106); keep `describe('upgrade from v4 to v5')` and the `it` at 130; any *remaining* `toBe(4)` stays 4; `:344` 9→5 and strip `getAll('scripture-*')` at 335-340, keep the v7-to-v8 `it`; `:488` `DB_VERSION` 9→10. A blind replace of `toBe(9)` is the bug.
- `storageSchema.test.ts` `ALL_STORES`: remove entries 30-33 only. Keep `message-favorites` at line 26.
- Re-grep; inventory line numbers are 2026-09-15 against main.

**Never:**
- Do not delete the v4-to-v5 describe, the v7-to-v8 `it`, or the existence-check rationale at 244-250.
- Do not call `window` from `src/sw-db.ts` (no `window` in a worker). Do not skip the version bump and leave orphan stores.
- Do not re-edit `authSlice.ts` `signedOutState()` or `EXPECTED_RESET`. Story 2 already dropped those keys (`authSlice.ts:118-128` is events; `EXPECTED_RESET` ends at `eventsHistoryError`; key-parity is now `:648-651`; denylist `it` at `:654` stays).
- Do not touch `tests/api/`, `tests/e2e-archive/`, or `src/types/database.types.ts`.
- Do not reuse the August `toBe(8)→4` / `toBe(7)→8` instructions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh install | No `my-love-db` | Exactly five stores: `messages`, `message-favorites`, `photos`, `moods`, `sw-auth`. No `scripture-*` | No error expected |
| v9 profile | DB at version 9 with the four scripture stores plus the five survivors, with rows in the survivors | After open at `DB_VERSION` (10): exactly those five stores; survivor rows intact; scripture stores gone | No error expected |
| Blocked, accept | An open v9 connection that does not close while the app opens at v10; user accepts the confirm | Reload prompt is shown; `location.reload()` runs | Do not fail silently |
| Blocked, dismiss | Same held v9 connection; user dismisses the confirm | `openDB` promise rejects; callers take existing init-error paths | Do not wait forever; do not swallow |

</intent-contract>

## Code Map

Re-verified 2026-09-16 on `db3eb2e86d6861b57d4907937702785aa8b4038b`. Inventory line numbers still match `dbSchema.ts` / the three test files.

**`src/services/dbSchema.ts`**
- `:2` `unwrap` already imported — use it for the drop
- `:23-95` delete the scripture type block (`ScriptureSession*` / `ScriptureReflection` / `ScriptureBookmark` / `ScriptureMessage`). Zero remaining production importers after story 2 deleted `useAutoSave.ts`
- `:111` amend (keep v5 history; record v10 drop)
- `:161-188` delete the four `MyLoveDBSchema` members
- `:195-207` amend v6/v7/v8/v9 comments; add v10. Do not delete. `:208` `DB_VERSION = 9` → `10`
- `:219-222` delete the four `STORE_NAMES` scripture constants
- `:227` JSDoc still says `v1-v9` — amend
- `:244-250` existence-check rationale — **amend, never delete**. Surviving stores still depend on it. Historical v5-missing-scripture example may be reworded; the "EXISTS, not oldVersion" rule stays
- `:384-411` delete the four v5 create-branches. **Add** an existence-gated drop of the four names via `unwrap(db).deleteObjectStore(...)` (typed `db.deleteObjectStore` cannot name them once they leave the schema). `:331` `db.deleteObjectStore('photos')` stays typed — `photos` remains in the schema
- v7 moods `else if (tx)` path (`:352-376`) must stay idempotent; the v10 bump re-fires every branch

**`blocked` handler (required product decision 2026-08-19)**
- App-side `openDB` copies: `src/services/storage.ts:50`, `src/services/moodService.ts:45`, `src/services/customMessageService.ts:75`. All three currently pass only `upgrade`. Attach `blocked` on all three, preferably by exporting one helper from `dbSchema.ts` that already threads `upgradeDb` + `blocked`
- `src/sw-db.ts:27` is the independent v9 holder. Do not put `window.confirm` / `location.reload` here. New SW code cannot fix an already-installed v9 worker; the app-side prompt is what unblocks
- idb `^8.0.3`: `blocked?(currentVersion, blockedVersion, event)`
- Prompt surface: `window.confirm` from the service layer (no React at `openDB`). Message must tell the user to reload. Accept → `location.reload()`. Dismiss → reject the `openDB` promise. Do not auto-reload without a prompt, and do not no-op.

**Tests (CAP-4 / CAP-5)**
- `tests/unit/services/dbSchema.test.ts`:
  - `:49` describe name `v0 → v5` is stale; `:61-65` scripture `contains` — delete; `:68-73` "exactly 9" → 5
  - `:77` keep the describe; `:78-128` delete that `it`. `:106` `toBe(4)` lives inside it and goes with it — do not change 4 to 5 anywhere, and do not keep this `it` to save the checkpoint. The surviving `it` at `:130` does not assert store count.
  - `:130-168` keep (messages `by-user` on an existing store)
  - `:171+` keep `describe('upgrade from v7 to v8')`. `seedV7` (`:209-220`, `:232-235`, `:261-294`) may still create scripture stores as the historical v7 shape so the drop has something to remove. Strip `:335-340` `getAll('scripture-*')`. `:344` → 5. After upgrade, scripture names must not remain (assert gone here or in a dedicated v9→v10 `it`)
  - Add coverage that a version-9 database with all nine stores upgrades to five survivors with survivor rows intact (CAP-5)
  - `:397-435` delete the four scripture index `it`s; keep `:437` core indexes
  - `:464-469` delete scripture `STORE_NAMES` `it`; keep `:471` core names
  - `:488` `toBe(9)` → `toBe(10)` (version, not store count)
  - Add a unit test that an held lower-version connection fires `blocked` and the handler shows the reload prompt
- `tests/unit/services/dbSchema.indexes.test.ts:38-64` delete the two scripture index `it`s; keep messages `by-user` (`:66`) and moods `by-user-date` (`:83`)
- `tests/unit/services/storageSchema.test.ts:30-33` remove the four scripture names only. Line 26 `message-favorites` stays. `:106` `toBe(ALL_STORES.length)` then expects 5
- `tests/unit/stores/signOutClearsAccountState.test.ts` — no edit

**Leave alone:** `src/types/database.types.ts`; `authSlice.ts`; `tests/api/`; `tests/e2e-archive/`; `src/sw-db.ts` upgrade delegation (comment already amended in story 2). AGENTS.md "five modules open my-love-db" is a story-2 deferral, not this story.

## Tasks & Acceptance

**Execution:**
- `src/services/dbSchema.ts` -- strip scripture types / schema members / STORE_NAMES / v5 create-branches; bump `DB_VERSION` to 10; add existence-gated `unwrap` deletes; amend (do not delete) comments at 111, 195-207, 244-250; export a shared open helper or equivalent `blocked` callback -- CAP-5
- `src/services/storage.ts`, `src/services/moodService.ts`, `src/services/customMessageService.ts` -- every app-side `openDB` uses that helper / `blocked` handler -- SW v9 cannot silently block the upgrade
- `tests/unit/services/dbSchema.test.ts` -- apply the assertion trap exactly; add v9→v10 survivor-intact coverage and a `blocked` prompt test -- CAP-4 and CAP-5
- `tests/unit/services/dbSchema.indexes.test.ts` -- delete the two scripture index `it`s only -- CAP-4
- `tests/unit/services/storageSchema.test.ts` -- drop ALL_STORES entries 30-33 only -- CAP-4

**Acceptance Criteria:**
- Given no existing database, when it is opened at `DB_VERSION`, then `objectStoreNames` is exactly `messages`, `message-favorites`, `photos`, `moods`, `sw-auth`.
- Given a database at version 9 that still has the four scripture stores and rows in the surviving stores, when it is opened at `DB_VERSION`, then the scripture stores are gone, the five survivors remain, and those survivor rows are intact.
- Given `expect(DB_VERSION).toBe(...)` in `dbSchema.test.ts`, when the file is read, then that assertion is `toBe(10)` and no store-count assertion is `toBe(10)`.
- Given an open lower-version connection that does not close, when the app opens `my-love-db` at v10, then a reload confirm is shown; accept reloads, dismiss rejects the open.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 14 findings — high 0, medium 3, low 8, false 2, maybe-false 1
- findings:
  - `[medium]` `[patch]` Page-side `sw-db` `openDatabase` had no `blocked` handler (`storeAuthToken`/`clearAuthToken` from `sessionService`/`actionService`) — `openDatabase()` now calls `openMyLoveDB()` when `globalThis.window` is defined; worker keeps `openDB`+`upgrade`
  - `[medium]` `[patch]` Each `openMyLoveDB()` had its own `blocked` listener, so three inits could `confirm` three times — shared `onUpgradeBlocked` + `pendingOpens`; one confirm, dismiss rejects every waiter, accept reloads once
  - `[low]` `[reject]` Accepting reload does not close another tab's v9 handle — intent named the service worker; everyday use is one tab plus SW; closing other tabs is more than a direct correction
  - `[low]` `[defer]` Successful opens never register `blocking`/`versionchange`, so a later bump can hang on these holders — pre-existing; old openers also omitted it
  - `[low]` `[reject]` Accept leaves the wrapper unsettled if `location.reload()` does not run — production reload unloads the page; adding reject-after-reload is extra control flow for a path users do not hit
  - `[false]` `[reject]` Dismiss rejects the wrapper while the inner `openDB` still upgrades when the holder closes — next `init()` then connects at v10; not a leak
  - `[low]` `[reject]` Blocked tests assign `window.confirm` without `spyOn` restore — 1890 unit tests passed; the leak did not break later files
  - `[low]` `[reject]` No test for a v9 DB missing only some scripture stores — existence `contains` is a no-op when absent; partial-scripture profiles are not an everyday case
  - `[false]` `[reject]` CAP-5 drop is asserted via `upgradeDb` not `openMyLoveDB` — the helper always passes `upgrade: upgradeDb`; a forgotten upgrade cannot happen in this wrapper
  - `[low]` `[defer]` Core `STORE_NAMES` `it` omits `MESSAGE_FAVORITES` — pre-existing; the favorites constant was already untested before this story
  - `[maybe-false]` `[defer]` `window.confirm` from an IndexedDB `blocked` listener is not a user gesture and some browsers may suppress it — would settle: v9 profile in Safari iOS PWA with a held connection
  - `[low]` `[reject]` v7-to-v8 describe comment still says the only remaining work is messages `by-user`; schema history list jumps v5 to v10 — comments only; v6–v9 were index/favorites work already described next to `DB_VERSION`
  - `[medium]` `[patch]` Stacked reload dialogs from concurrent opens — same root cause and fix as the shared `blocked` listener
  - `[low]` `[reject]` Reloading this tab never closes another same-origin v9 holder — same root cause as the other-tab finding; rejected with it

### 2026-09-16 — Review pass
- verdicts: 21 findings — high 0, medium 3, low 13, false 5, maybe-false 0
- findings:
  - `[false]` `[reject]` `onUpgradeBlocked` has no try/catch around `window.confirm` / `location.reload` — native `window.confirm` and `location.reload` do not throw; the latch-stuck path is not reachable (`src/services/dbSchema.ts:332-340`)
  - `[low]` `[reject]` Dismiss clears the latch so a later open can prompt again — `rejectAllPending` sets `blockedPromptShown = false` (`src/services/dbSchema.ts:322-324`); `initializeApp` already takes the init-error path on the first dismiss (`src/stores/slices/settingsSlice.ts:196-200`); a `blockedDismissed` flag would add state the intent did not ask for
  - `[low]` `[reject]` carried: Blocked tests assign `window.confirm` without `spyOn` restore — still `window.confirm = confirm` at `tests/unit/services/dbSchema.test.ts:507-508`; `afterEach` only `vi.restoreAllMocks()` at `:53`
  - `[low]` `[reject]` Dismiss tests leave the inner `openDB` queued — `afterEach` closes the holder and `opening.then` closes the upgraded db when `pending.settled` (`src/services/dbSchema.ts:369-371`); not an everyday product defect
  - `[medium]` `[patch]` Worker `openDB`+`upgrade` and page-side `storeAuthToken` blocked were untested after the window branch — added `migrates v8 when the worker open runs without window` in `tests/unit/services/storageSchema.test.ts` and `shows a reload confirm when page-side storeAuthToken is blocked` in `tests/unit/services/dbSchema.test.ts`
  - `[low]` `[reject]` DW-157 has no `severity:` and DW-156 `location` is stale (`:566-571` vs `:610-615`) — ledger policy assigns location/severity repair to the orchestrator (`_bmad-output/implementation-artifacts/deferred-work.md:3-11`); this run must not rewrite those entries
  - `[low]` `[reject]` carried: v7-to-v8 describe still says the only remaining work is messages `by-user` (`tests/unit/services/dbSchema.test.ts:125-127`); leftover v4 "seed above" at `:80` is the same comments-only class
  - `[low]` `[reject]` Blocked behavior is only asserted through `openMyLoveDB()` — the three services are one-line wrappers around that helper (`src/services/storage.ts:49`, `src/services/moodService.ts:44`, `src/services/customMessageService.ts:74`); helper tests are the blocked surface
  - `[low]` `[defer]` carried: Core `STORE_NAMES` `it` omits `MESSAGE_FAVORITES` — still `tests/unit/services/dbSchema.test.ts:610-615`
  - `[false]` `[reject]` Dismiss then later `openMyLoveDB` hangs with no second prompt — `rejectAllPending` clears `blockedPromptShown` and rejects waiters (`src/services/dbSchema.ts:322-340`); a later open shows a new confirm
  - `[low]` `[reject]` carried: Accept leaves the wrapper unsettled if `location.reload()` does not run — still `if (accepted) { location.reload(); return; }` at `src/services/dbSchema.ts:336-338`
  - `[low]` `[defer]` carried: Successful opens never register `blocking`/`versionchange` — still `openDB(..., { upgrade, blocked })` at `src/services/dbSchema.ts:359-364`
  - `[medium]` `[patch]` `'worker'` opener still ran under happy-dom `window` so `src/sw-db.ts:36-45` was untested — added `migrates v8 when the worker open runs without window`; deleting the worker `upgradeDb` call fails that test
  - `[medium]` `[patch]` Page-side `storeAuthToken` could drop the window branch with no test failing — added held-v9 `storeAuthToken` dismiss test next to the blocked describe
  - `[false]` `[reject]` carried: CAP-5 drop is asserted via `upgradeDb` not `openMyLoveDB` — helper always passes `upgrade: upgradeDb` (`src/services/dbSchema.ts:360-362`)
  - `[low]` `[reject]` Blocked tests do not call the three `init()` methods — same root as the helper-is-the-surface finding; storage/mood/custom already call `openMyLoveDB()`
  - `[false]` `[reject]` `sw-db.ts` mentions `window` — the Never line is about not calling `window.confirm` / `location.reload` in a worker; worker branch still uses upgrade-only `openDB` (`src/sw-db.ts:36-47`)
  - `[false]` `[reject]` Concurrent one-confirm is extra relative to the starting matrix — already implemented as the previous pass's shared `pendingOpens` patch; not a remaining defect (`src/services/dbSchema.ts:313-340`)
  - `[low]` `[defer]` carried: `STORE_NAMES` core `it` omits `MESSAGE_FAVORITES` — same as the core-names deferral; still `:610-615`
  - `[low]` `[reject]` carried: leftover v4 "The v4 seed above" comment (`tests/unit/services/dbSchema.test.ts:80`) — comments only; the remaining `it` now seeds itself at `:85`
  - `[low]` `[reject]` dismiss→init-error-path and v9-through-service-`init` are not exercised — production `src/services/storage.ts:51-60` still rethrows; adding three `init()` copies is more than a direct correction given the helper tests

## Design Notes

`unwrap(db).deleteObjectStore(name)` is required once the name leaves `MyLoveDBSchema`. `db.deleteObjectStore('photos')` at `:331` is a different case — `photos` stays in the schema.

Keep scripture stores in `seedV7` as the v7 on-disk shape. Stripping the `getAll('scripture-*')` expects is not permission to rewrite v7 into a scripture-free seed; the drop needs a store that exists.

`blocked` vs `blocking`: `blocked` fires on the *new* v10 open while the v9 holder (typically the installed SW) refuses to close. `blocking` on *new* SW code cannot run inside the already-installed v9 worker. Reload is the product decision.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npm run test:ci-local` -- expected: exit 0

## Auto Run Result

Status: done

Follow-up review of a `done` spec. The v10 scripture-store drop, shared `openMyLoveDB()` helper, and app-side `blocked` reload prompt from the first pass are unchanged. This pass added tests for both branches of the previous `sw-db.ts` window split.

Files changed this pass:
- `tests/unit/services/dbSchema.test.ts` — held-v9 `storeAuthToken` now expects the reload confirm and a `/blocked/` reject
- `tests/unit/services/storageSchema.test.ts` — worker open with `window` undefined still migrates a v8 profile to `message-favorites`
- `_bmad-output/specs/spec-remove-scripture-feature/stories/4-remove-the-scripture-indexeddb-object-stores.md` — follow-up triage log and this result
- `_bmad-output/implementation-artifacts/deferred-work.md` — first-pass DW-155/DW-156/DW-157 append left uncommitted; this run did not rewrite those entries

Review findings breakdown:
- Patches applied: 1 medium entry (3 findings: worker upgrade untested, page-side `storeAuthToken` blocked untested, happy-dom always taking the window branch). Tests added as above. Patched counts by verdict: high 0, medium 1, low 0.
- Items deferred: none new. Carried the existing frontmatter trio (live handles omit `blocking`/`versionchange`; core `STORE_NAMES` `it` omits `MESSAGE_FAVORITES`; `window.confirm` from `blocked` may not count as a user gesture). Ledger entries were not re-opened or rewritten.
- Rejected: confirm/reload throw latch (native APIs do not throw); sequential re-prompt after dismiss (latch reset is the designed non-hang path); confirm assignment without `spyOn` restore (carried); dismiss-test inner `openDB` drain (holder close already settles it); DW-157/DW-156 ledger metadata (orchestrator-owned); stale v4/v7 comments (carried); blocked tests not calling the three `init()` methods (helper is the surface); dismiss-then-later hang (latch is cleared); accept without unload (carried); CAP-5 via `upgradeDb` not `openMyLoveDB` (carried); `sw-db.ts` mentioning `window` (worker path still upgrade-only); concurrent one-confirm as extra work (already patched).

Follow-up review recommendation: false. This was a follow-up pass; the patched entry was medium, not high. No named unverified risk from this pass's patches.

Verification performed:
- `npm run typecheck` — exit 0 (`tsc -b --force`)
- `npm run lint` — exit 0
- `npm run test:ci-local` — exit 0. Log: `✅ Lint & Type Check passed`; `Test Files  100 passed (100)`; `Tests  1892 passed (1892)`; `✅ Unit tests passed`; `✅ E2E tests passed`; `✅ Burn-in passed (3/3)`; `✅ Local CI Pipeline Passed`

Residual risks: the three carried deferred items in frontmatter (v11 bump can hang on live `openMyLoveDB` handles; core-names `it` still omits `MESSAGE_FAVORITES`; Safari iOS PWA may suppress `confirm` from an IndexedDB `blocked` listener). Not re-filed.
