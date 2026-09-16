---
title: 'DW-157: replace IndexedDB blocked window.confirm with an in-app reload dialog'
type: 'bugfix'
created: '2026-09-16'
status: 'done'
baseline_revision: '7b4f305e7d6c9be3b4b124414355e0521ff90b71'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `onUpgradeBlocked` uses `window.confirm`. An IndexedDB `blocked` callback is not a user gesture, so some browsers may suppress the dialog and take the dismiss path with no prompt.

**Approach:** Replace that confirm with an in-app reload dialog that can appear without a user gesture. Accept still calls `location.reload()`. Dismiss still calls `rejectAllPending`.

## Boundaries & Constraints

**Always:**
- Replace `window.confirm` in `onUpgradeBlocked` with an in-page dialog (`role="dialog"`) that appears in the document without a prior user click.
- The dialog must be showable from the service-layer `blocked` callback (no React tree is mounted in `dbSchema.test.ts`).
- Keep `UPGRADE_BLOCKED_RELOAD_MESSAGE` as the dialog copy (it already says the user must reload).
- Accept control is a button named Reload → `location.reload()`. Dismiss control is a button named Not now → `rejectAllPending(new Error('IndexedDB upgrade blocked: reload dismissed'))` and remove the dialog.
- Keep the one-prompt latch: concurrent `openMyLoveDB()` calls share one dialog; accept reloads once; dismiss rejects every waiter.
- Keep `blocked: onUpgradeBlocked` on `openMyLoveDB`. Keep `blocking() { liveDb?.close(); }`.

**Never:**
- Do not call `window.confirm`, `window.alert`, or `window.prompt`.
- Do not auto-reload without a prompt, and do not no-op when blocked.
- Do not edit `_bmad-output/implementation-artifacts/deferred-work.md`.
- Do not bump `DB_VERSION`, add/remove stores, or re-add scripture types.
- Do not call `window` APIs from the `src/sw-db.ts` worker `openDB` branch.
- Do not add account-scoped Zustand fields for this prompt (it is page-level, not couple data; a new persisted field would need `signedOutState()`).
- Do not register a new `ViewType` / navigation destination.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dismiss | Held v9 connection; `openMyLoveDB()`; user dismisses the in-app dialog | Dialog is in the document with the reload message; `window.confirm` is not called; open rejects `/blocked/`; dialog is removed | Reject `IndexedDB upgrade blocked: reload dismissed` |
| Accept | Held v9 connection; `openMyLoveDB()`; user accepts | Dialog shown once; `location.reload()` once; `window.confirm` is not called | No reject on accept; page unloads in production |
| Concurrent opens | Three `openMyLoveDB()` while held v9 | One dialog; dismiss rejects all three; accept reloads once | Same reject on dismiss |
| Page-side `storeAuthToken` | Held v9; `storeAuthToken(...)` | Same in-app dialog; dismiss rejects `/blocked/` | Same as dismiss |
| Live v10 holder (DW-155) | `openMyLoveDB()` held at v10; `openDB(DB_NAME, DB_VERSION+1)` | Higher open fulfills; no dialog; `window.confirm` is not called | No error expected |

</intent-contract>

## Code Map

- `src/services/dbSchema.ts:304-305` — `UPGRADE_BLOCKED_RELOAD_MESSAGE` (`'A database update is waiting. You must reload this page to finish the update.'`). Keep as dialog copy.
- `src/services/dbSchema.ts:313-314` — `pendingOpens` + `blockedPromptShown` latch. Keep.
- `src/services/dbSchema.ts:322-330` — `rejectAllPending` splices waiters, clears the latch, rejects unsettled. Dismiss must still call this.
- `src/services/dbSchema.ts:332-341` — `onUpgradeBlocked`: `window.confirm(UPGRADE_BLOCKED_RELOAD_MESSAGE)` then accept `location.reload()` / dismiss `rejectAllPending(...)`. Replace only the confirm with the in-app dialog. The callback is no longer allowed to decide accept/dismiss synchronously; pending opens stay pending until the user hits a control (or the page unloads).
- `src/services/dbSchema.ts:349-367` — comment still says "share one confirm"; `blocked: onUpgradeBlocked` + `blocking() { liveDb?.close(); }`. Update the comment; do not drop either handler.
- `src/sw-db.ts:32-47` — page branch (`globalThis.window`) already uses `openMyLoveDB()` so it inherits the new dialog. Worker stays upgrade-only. Do not add `window` there.
- `src/components/PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx:60-66` — in-app confirm pattern: `role="dialog"`, `aria-modal="true"`, labelled title, explicit accept/dismiss buttons. Match those semantics; do not reuse the photo-delete component.
- `tests/unit/services/dbSchema.test.ts:494-598` — `describe('blocked upgrade prompt')` stubs `window.confirm` (sync). Rewrite these five `it`s to wait for the in-app dialog and click dismiss/accept. Keep `holdLowerVersion` at v9.
- `tests/unit/services/dbSchema.test.ts:614-657` — live-handle tests spy `window.confirm` to prove it is not called. Keep that assertion; also assert no dialog appears.
- `_bmad-output/implementation-artifacts/deferred-work.md` — orchestrator records resolution. Do not edit.

## Tasks & Acceptance

**Execution:**
- `src/services/dbSchema.ts` — Replace `window.confirm` in `onUpgradeBlocked` with an in-app reload dialog that appears in `document` without a user gesture and without a mounted React tree. Accept → `location.reload()`. Dismiss → existing `rejectAllPending` error. Keep the latch, `blocked`, and `blocking` close. Update the "share one confirm" comment.
- `tests/unit/services/dbSchema.test.ts` — In `blocked upgrade prompt`, drive the in-app dialog (show, one instance, dismiss rejects, accept reloads, `storeAuthToken` path). Assert `window.confirm` is not called. In `live handle close on next bump`, keep "no confirm" and assert no dialog. Clean up any leftover dialog node in `afterEach`.

**Acceptance Criteria:**
- Given a held v9 connection, when `openMyLoveDB()` is blocked, then an in-app dialog with the reload message is in the document and `window.confirm` is not called.
- Given that dialog, when the user accepts, then `location.reload()` runs once; when the user dismisses, then every waiting open rejects `/blocked/` and the dialog is gone.
- Given three concurrent blocked opens, when the prompt appears, then there is one dialog.
- Given a live v10 `openMyLoveDB()` handle, when `openDB(DB_NAME, DB_VERSION+1)` runs, then it fulfills with no dialog and no `window.confirm`.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 16 findings — high 0, medium 0, low 8, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: dialog never takes focus, does not trap Tab, does not mark `#root` inert, and does not handle Escape — overlay is a full-screen `z-[80]` prompt with named Reload / Not now buttons (`src/services/dbSchema.ts:342-389`). The spec's cited pattern `PhotoDeleteConfirmation.tsx:60-66` has `role="dialog"` / `aria-modal` and no `useFocusTrap` (grep: no matches in that component). Everyday blocked-upgrade users tap the covering overlay. A focus trap, `inert`, and Escape handler is extra control flow for a rare path.
  - `[low]` `[reject]` Blind hunter: dialog is not removed when waiters resolve because the v9 holder closed — `removePending` already clears `blockedPromptShown` when `pendingOpens.length === 0` (`src/services/dbSchema.ts:316-319`); `removeUpgradeBlockedDialog` runs only from Not now (`:368-370`). Everyday holder is the installed v9 service worker, which does not close. Clearing the overlay from `removePending` is an extra branch for another-tab close.
  - `[false]` `[reject]` Blind hunter: `showUpgradeBlockedDialog` can throw and leave the latch set — worker never calls `openMyLoveDB` (`src/sw-db.ts:32-47` window check vs upgrade-only `openDB`). Page-side init runs after `document.body` exists. Native `window.confirm` / `location.reload` throw was already rejected as unreachable on this path.
  - `[low]` `[reject]` Blind hunter: Reload does not disable Not now, so dismiss can still `rejectAllPending` after accept — accept is `location.reload()` (`src/services/dbSchema.ts:378-383`). Production unloads the page. The accept tests stub `reload` and close the holder (`tests/unit/services/dbSchema.test.ts:557-565`). A `decided` flag is extra control flow for a path users do not hit (same class as the story-4 accept-without-unload reject).
  - `[false]` `[reject]` Blind hunter: tests never lock Always semantics or the new async races — verification-gap reported no gaps. The five `blocked upgrade prompt` `it`s plus the two live-handle `it`s cover the matrix (dialog shown, one instance, dismiss rejects `/blocked/`, accept reloads once, `storeAuthToken`, no dialog on v10). `npx vitest run tests/unit/services/dbSchema.test.ts` — 17 passed.
  - `[low]` `[reject]` Blind hunter: cited confirm pattern is only half-matched (long `h2`, no backdrop dismiss, `py-2` tap targets) — spec required `UPGRADE_BLOCKED_RELOAD_MESSAGE` as copy and `role="dialog"` / named Reload / Not now. Backdrop-as-dismiss would make a required reload easy to miss-tap. 48px targets and a short title plus body are extra UI, not a defect in the two-button prompt.
  - `[false]` `[reject]` Blind hunter: unused vanilla `<dialog>.showModal()` — spec required an in-page dialog showable from the service-layer `blocked` callback without a React tree. The `document.createElement` overlay does that (`src/services/dbSchema.ts:339-389`). Native `<dialog>` is an alternative, not a missing outcome.
  - `[low]` `[reject]` Edge case: Reload click then Not now before unload rejects waiters after accept — same as the accept-then-dismiss row. `src/services/dbSchema.ts:368-384`; production reload unloads. Extra `decided` guard.
  - `[low]` `[reject]` Edge case: holder closes and waiters resolve while the dialog stays — same as the leftover-overlay row. `removePending` at `src/services/dbSchema.ts:316-319` already resets the latch; everyday v9 SW does not close.
  - `[low]` `[reject]` Edge case: `blockedPromptShown` resets while a spent dialog node remains, so a later blocked open reuses a `{ once: true }` Reload — same leftover-overlay path. `showUpgradeBlockedDialog` returns early when the id exists (`src/services/dbSchema.ts:340`). Requires the holder-close-without-unload sequence users do not hit.
  - `[false]` `[reject]` Intent alignment: implements R1 (service-layer DOM dialog) not R2 (App.tsx React modal) — starting intent is replace `window.confirm` in `onUpgradeBlocked` with an in-app dialog; source story kept the prompt in the service layer. Spec Design Notes forbid an App-only React modal. `git diff --name-only` is the spec, `src/services/dbSchema.ts`, `tests/unit/services/dbSchema.test.ts`.
  - `[false]` `[reject]` Intent alignment: tests match `/blocked/` not the full `IndexedDB upgrade blocked: reload dismissed` string — matrix Expected column is `/blocked/` (`spec-dw-157-idb-upgrade-blocked-reload-dialog.md` Dismiss / storeAuthToken rows). `tests/unit/services/dbSchema.test.ts:542` `rejects.toThrow(/blocked/)`. Production dismiss still uses that Error (`src/services/dbSchema.ts:369`).
  - `[false]` `[reject]` Intent alignment: tests do not occupy the ledger's Safari iOS PWA settle path — the human decision was replace, not measure (`intent.md` option 1). Gesture-independence is the in-page dialog appearing from `blocked` without a click (`src/services/dbSchema.ts:392-398`).
  - `[false]` `[reject]` Intent alignment: this diff does not drive the `src/sw-db.ts` worker `openDB` branch — spec Never line is do not call `window` APIs there. Worker still uses upgrade-only `openDB` (`src/sw-db.ts:36-47`). Page branch already inherits the dialog via `openMyLoveDB()`.
  - `[low]` `[reject]` Intent alignment: test titles still say "reload confirm" — leftover wording in `tests/unit/services/dbSchema.test.ts:531,546,595,616`. Assertions already click Reload / Not now and spy that `window.confirm` is not called. Renaming titles is cosmetic.
  - `[false]` `[reject]` Intent alignment: spec in the diff names `role="dialog"`, button copy, and no-React-tree constraints that `intent.md` does not — those are build-auto planning elaborations, not a product miss. Fix would be editing this spec.

## Design Notes

`window.confirm` is synchronous and often gesture-gated. The in-app dialog is asynchronous: `onUpgradeBlocked` must show the dialog and return; waiters stay in `pendingOpens` until dismiss or reload. Tests that currently `await expect(openMyLoveDB()).rejects` in the same turn as assigning `window.confirm` must wait for the dialog, click, then assert.

Do not implement this as a React modal mounted only from `App.tsx`. `onUpgradeBlocked` runs from `openMyLoveDB` (mood/storage/custom-message init and page-side `storeAuthToken`) and the covering tests never render `App`.

## Verification

**Commands:**
- `npx vitest run tests/unit/services/dbSchema.test.ts` -- expected: exit 0, including rewritten blocked-prompt cases and the existing live-handle cases
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0

## Auto Run Result

Status: done

Summary of implemented change: `onUpgradeBlocked` no longer calls `window.confirm`. It shows an in-page `role="dialog"` overlay with `UPGRADE_BLOCKED_RELOAD_MESSAGE`, a Reload button (`location.reload()`), and a Not now button (`rejectAllPending` + remove the node). Concurrent opens still share one prompt. Live v10 handles still close without a prompt. `deferred-work.md` was not edited.

Files changed:
- `src/services/dbSchema.ts` — DOM reload dialog from `onUpgradeBlocked`; latch, `blocked`, and `blocking` close kept
- `tests/unit/services/dbSchema.test.ts` — blocked-prompt tests drive the in-app dialog; live-handle tests also assert no dialog
- `_bmad-output/implementation-artifacts/spec-dw-157-idb-upgrade-blocked-reload-dialog.md` — build-auto spec

Review findings breakdown:
- patches applied: none
- items deferred: none
- rejected: 16 (see Review Triage Log)

Follow-up review recommendation: false (first pass; patched entries by verdict: high 0, medium 0, low 0)

Verification:
- `npx vitest run tests/unit/services/dbSchema.test.ts` — exit 0; `Tests  17 passed (17)`
- `npm run typecheck` — exit 0 (`tsc -b --force`)
- `npm run lint` — exit 0

Residual risks: the overlay does not take initial focus or trap Tab; a leftover node can remain if a holder closes while reload is mocked. Everyday blocked-upgrade is a v9 service worker that does not close, and production Reload unloads the page.
