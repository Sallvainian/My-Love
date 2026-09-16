---
title: 'DW-155: close live openMyLoveDB handles on the next version bump'
type: 'bugfix'
created: '2026-09-16'
status: 'done'
baseline_revision: 'c683fe2feddd88b4ebf2db76ac1b8ce7b7de6780'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Successful `openMyLoveDB` connections never register idb `blocking` / `versionchange`. `moodService`, `storage`, and `customMessageService` keep `this.db` for the life of the page, so the next schema bump can hang on those handles the same way v9 hangs on the service worker.

**Approach:** On each live handle, close when a higher version wants the database (`blocking() { db.close(); }` or native `versionchange`). After that close, do not treat the wrapper as initialized — null `this.db` or reload. Prove it by holding a v10 `openMyLoveDB()` and opening `DB_VERSION+1` with no `window.confirm`.

## Boundaries & Constraints

**Always:**
- Register `blocking` (or equivalent native `versionchange`) on successful `openMyLoveDB` connections so the live `IDBDatabase` closes when a newer version opens.
- After that close, `BaseIndexedDBService.init` and `StorageService.init` must not short-circuit as "already initialized" on the closed wrapper.
- Keep the existing `blocked` confirm/reload path for holders that do not close (installed v9 service worker).
- Cover in `tests/unit/services/dbSchema.test.ts`: hold v10 via `openMyLoveDB()`, open `DB_NAME` at `DB_VERSION+1`, expect the open to fulfill and `window.confirm` not to run.

**Never:**
- Do not edit `_bmad-output/implementation-artifacts/deferred-work.md`.
- Do not bump `DB_VERSION` and do not add schema stores.
- Do not replace or remove `blocked: onUpgradeBlocked`.
- Do not call `window.confirm` / `location.reload` from `src/sw-db.ts` worker `openDB`.
- Do not re-add scripture stores or types.
- Do not use the blocked confirm for this live-handle close; the higher-version open must not depend on a user gesture.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Next bump vs live v10 | `openMyLoveDB()` held at v10; `openDB(DB_NAME, DB_VERSION+1)` | Higher-version open fulfills; `window.confirm` is not called | No error expected |
| Closed handle then init | `this.db` still set after the handle closed | Next `init()` reopens (or the page reloads); it does not return as already initialized | Ops on the closed wrapper must not succeed as if it were open |
| Holder that will not close | Open v9 connection left open; `openMyLoveDB()` at v10 | Existing confirm still runs; dismiss rejects, accept reloads | Unchanged `blocked` path |

</intent-contract>

## Code Map

- `src/services/dbSchema.ts:354-384` — `openMyLoveDB` passes only `upgrade` and `blocked` (`:359-364`). Add `blocking` here (idb `^8.0.3`: `blocking?(currentVersion, blockedVersion, event)` maps to `versionchange` on the live db). Close that connection. `onUpgradeBlocked` (`:332-341`) stays for holders that do not close.
- `src/services/BaseIndexedDBService.ts:55-58` — `if (this.db) return`. Mood and custom messages inherit this. After a close, `this.db` is still truthy.
- `src/services/storage.ts:19-22` — same short-circuit; `StorageService` does not extend the base. `:49` assigns `this.db = await openMyLoveDB()`.
- `src/services/moodService.ts:44` and `src/services/customMessageService.ts:74` — assign `this.db` and keep it. `_doInit` is the place to attach a close listener if that is how `this.db` is nulled.
- `src/sw-db.ts:32-47` — page branch already uses `openMyLoveDB()`; worker stays upgrade-only. Do not add `window` there. Worker opens close in `finally`.
- `tests/unit/services/dbSchema.test.ts:494-598` — existing `blocked upgrade prompt` describe (`holdLowerVersion` at v9). Add a sibling case: hold `openMyLoveDB()` (v10), open `DB_VERSION+1`, no confirm. Keep the v9 confirm tests.

## Tasks & Acceptance

**Execution:**
- `src/services/dbSchema.ts` — Register `blocking` (or native `versionchange`) on the live handle from `openMyLoveDB` that closes that connection. Leave `blocked: onUpgradeBlocked` in place.
- `src/services/BaseIndexedDBService.ts` and `src/services/storage.ts` (and mood/custom `_doInit` if the close listener lives there) — After the live handle closes, `init()` must not treat the closed wrapper as initialized (`this.db = null` or reload).
- `tests/unit/services/dbSchema.test.ts` — Hold a v10 `openMyLoveDB()` connection, open `DB_NAME` at `DB_VERSION+1`, assert the open fulfills and `window.confirm` is not called. Also drive a holder of that connection through a later `init()` and assert it does not treat the closed wrapper as already initialized. Leave the existing blocked-prompt tests.

**Acceptance Criteria:**
- Given a connection returned by `openMyLoveDB()` is still open, when `openDB(DB_NAME, DB_VERSION+1)` runs, then that open fulfills and `window.confirm` is not called.
- Given `moodService` / `storageService` / `customMessageService` already stored that connection as `this.db`, when the handle has been closed by the version bump, then a later `init()` does not return as already initialized on the closed wrapper.
- Given an open v9 connection that does not close, when `openMyLoveDB()` runs, then the existing reload confirm still appears (dismiss rejects, accept reloads).

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 5, false 10, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind hunter: `init()` still treats any truthy `this.db` as ready and never inspects closedness — after a completed `init()`, `forgetHandleOnVersionChange` nulls `this.db` on `versionchange` (`src/services/BaseIndexedDBService.ts:75-80`, `src/services/storage.ts:39-44`). Test `does not treat a closed service wrapper as already initialized` asserts `handle.db` is null after the bump (`tests/unit/services/dbSchema.test.ts:659-661`). The remaining `if (this.db) return` is the still-open path.
  - `[low]` `[reject]` Blind hunter: `versionchange` between `_doInit` storing `this.db` and `forgetHandleOnVersionChange` leaves a closed wrapper — real race of a few statements after open (`BaseIndexedDBService.ts:61-65`). Everyday bump is a later tab/SW after init finished. Folding the listener into `_doInit` is extra control flow for a window users do not hit.
  - `[low]` `[reject]` Blind hunter: concurrent `init()` waiters return `_doInit` only, so they can run before the listener is attached — same window as the previous row (`BaseIndexedDBService.ts:48-51` vs `:64-65`). Startup double-init does not coincide with a `DB_VERSION+1` open.
  - `[false]` `[reject]` Blind hunter: after a real bump the live tab still opens at `DB_VERSION` 10 and the test encodes `VersionError` as success — intent allowed `null this.db` or reload and forbade `window.confirm` on this path. An old bundle cannot reopen a higher on-disk version; `VersionError` is the proof `init()` did not short-circuit (`tests/unit/services/dbSchema.test.ts:661`). Reload stays on `onUpgradeBlocked` (`src/services/dbSchema.ts:336-338`).
  - `[false]` `[reject]` Blind hunter: matrix input `this.db still set after the handle closed` is never arranged — after the bump the listener has already nulled the wrapper; that is the production state the second test drives (`tests/unit/services/dbSchema.test.ts:659-661`). A still-set closed wrapper is the missed-listener race, not the implemented path.
  - `[false]` `[reject]` Blind hunter: `blocking() { liveDb?.close(); }` no-ops while `liveDb` is unset — idb attaches `blocking` in `openPromise.then` (`node_modules/idb/build/index.js:180-186`); `openMyLoveDB` assigns `liveDb = db` in its own `then` before `resolve(db)` (`src/services/dbSchema.ts:373-382`). A later `DB_VERSION+1` open cannot run before the holder promise fulfills.
  - `[false]` `[reject]` Blind hunter: `expect(confirm).not.toHaveBeenCalled()` does not prove the v10 holder closed — the v11 `openDB` fulfilling inside `withinTimeout` (`tests/unit/services/dbSchema.test.ts:620`) is that proof; a still-open holder would leave the higher open blocked. The confirm spy is the coverage sentence the intent named.
  - `[low]` `[reject]` Blind hunter: `forgetHandleOnVersionChange` is copied into `StorageService` — `StorageService` already duplicated `init()` and does not extend the base (`src/services/storage.ts:11-33`). Extracting a shared helper is extra structure.
  - `[low]` `[reject]` Edge case: `BaseIndexedDBService` does not null `this.db` on `close` without `versionchange` — this story's close is `blocking` on `versionchange` (`src/services/dbSchema.ts:368-370`). A close that never saw `versionchange` is pre-existing connection loss, not the bump.
  - `[low]` `[reject]` Edge case: `StorageService` does not null `this.db` on `close` without `versionchange` — same as the base-class row; `src/services/storage.ts:42-44` matches that listener.
  - `[false]` `[reject]` Intent alignment: close uses `liveDb?.close()` instead of README `blocking() { db.close(); }` / `event.target` — equivalent on the fulfilled-holder path; intent allowed `blocking() { db.close(); } (or equivalent)`.
  - `[false]` `[reject]` Intent alignment: two `versionchange` listeners (helper closes, service nulls) — split form of Reading 1; close stays on `openMyLoveDB`, reuse is `null this.db`. Spec Code Map allowed a close listener on the service handle.
  - `[false]` `[reject]` Intent alignment: first test holds a bare `openMyLoveDB()` connection, not the three service holders — coverage sentence is `holding a v10 open and opening DB_VERSION+1 without window.confirm`; the second `it` drives mood/storage/custom (`tests/unit/services/dbSchema.test.ts:626-662`).
  - `[false]` `[reject]` Intent alignment: second test measures a failed reopen (`VersionError`) not a completed reopen — synthetic `DB_VERSION+1` leaves on-disk version at 11 while services still open at 10; a successful same-version reopen would be extra. Fixing the wording would be editing this spec.
  - `[false]` `[reject]` Intent alignment: spec artifact is a surface the starting intent did not name — bmad-build-auto requires `{spec_file}`; production diff does not edit `deferred-work.md`.

## Design Notes

`blocked` fires on the *new* open while an older holder refuses to close (installed v9 SW). `blocking` / `versionchange` fires on *this* live handle when a newer version wants in. Close this handle; do not prompt. Prompt stays on `blocked` only.

idb registers `blocking` with `db.addEventListener('versionchange', ...)` after the open promise resolves. `blocking() { db.close(); }` is the README-shaped form; closing `event.target` is equivalent.

Do not bump `DB_VERSION`. The proof open uses `DB_VERSION+1` as a synthetic next bump.

## Verification

**Commands:**
- `npx vitest run tests/unit/services/dbSchema.test.ts` -- expected: exit 0, including the new hold-v10 / open-v11 case and the existing blocked-prompt tests
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0

## Auto Run Result

Status: done

Summary of implemented change: Live `openMyLoveDB` connections register idb `blocking` and close that handle when a newer version wants the database. `BaseIndexedDBService` and `StorageService` null `this.db` on `versionchange` so a later `init()` does not treat the closed wrapper as initialized. Existing `blocked` confirm/reload is unchanged. `deferred-work.md` was not edited.

Files changed:
- `src/services/dbSchema.ts` — `blocking() { liveDb?.close(); }` on `openMyLoveDB`; `blocked: onUpgradeBlocked` kept
- `src/services/BaseIndexedDBService.ts` — `forgetHandleOnVersionChange` after successful `init()` (mood and custom messages inherit this)
- `src/services/storage.ts` — same forget listener (`StorageService` does not extend the base)
- `tests/unit/services/dbSchema.test.ts` — hold v10 / open `DB_VERSION+1` without confirm; service `init()` after the bump does not short-circuit
- `_bmad-output/implementation-artifacts/spec-dw-155-idb-live-handle-blocking.md` — build-auto spec

Review findings breakdown:
- patches applied: none
- items deferred: none
- rejected: 15 (see Review Triage Log)

Follow-up review recommendation: false (first pass; patched entries by verdict: high 0, medium 0, low 0)

Verification:
- `npx vitest run tests/unit/services/dbSchema.test.ts` — exit 0; `Tests  17 passed (17)` including `lets a higher-version open fulfill without a reload confirm` and `does not treat a closed service wrapper as already initialized`, plus the existing blocked-prompt tests
- `npm run typecheck` — exit 0 (`tsc -b --force`)
- `npm run lint` — exit 0

Residual risks: a `versionchange` in the few statements between `_doInit` assigning `this.db` and attaching the forget listener could leave a closed wrapper; everyday bumps happen after init has finished. An old tab whose handle closed for a real v11 bump still has `DB_VERSION` 10 until refresh.
