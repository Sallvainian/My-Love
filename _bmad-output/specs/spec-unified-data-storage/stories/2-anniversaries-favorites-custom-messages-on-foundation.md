---
title: 'Move anniversaries, favorites and custom messages onto the foundation'
type: 'refactor'
created: '2026-09-23'
status: 'done'
baseline_commit: '581d7c9adaec7e4232a0fe923606b7367aa9e138'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Anniversaries, custom messages and message favorites refresh only on signed-in start, never on reconnect (CAP-2). Anniversaries live in the device-global persisted blob and swap through `anniversaryVault.ts`, a localStorage stash that exists only because they once lived on the device alone. Sign-out leaves the outgoing account's custom-message and favorite rows in IndexedDB (CAP-7).

**Approach:** Anniversaries move into `local-copies` (kind `anniversaries`) and out of the persisted blob; the vault is deleted. All three kinds register refreshers with `localCopy.ts`, so start, reconnect and on-demand refreshes reach them. Sign-out deletes the outgoing account's saved data for all three.

## Boundaries & Constraints

**Always:** Keep `settings.relationship.anniversaries` as the in-memory location (readers unchanged); `partialize` writes it as `[]` and `getItem` blanks it in an old blob (persist `version` stays 0). Writes stay server-first; a confirmed write also updates the copy. Every post-await write re-checks `{ userId, authSessionVersion }`; a saved copy never overwrites a newer server result or write in the same session. The messages refresher needs the bundled rows seeded: it no-ops until then, and the seeded effect in `App.tsx` triggers it.

**Never:** No change to bundled message rows or rotation. No offline writes (still `requireOnline`). No Zustand persist version bump. No service-worker dependency.

**Decision (owner, 2026-09-23):** Custom messages and favorites keep their own IndexedDB stores in this story. They get only refresh-on-reconnect and sign-out deletion. Moving their storage into `local-copies` is out of scope: the owner adds it as a separate story in this spec's `stories.yaml`, so it gets no deferred-work entry.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline start | A's anniversaries copy saved | Home countdowns and Settings list show A's anniversaries | N/A |
| Reconnect | A added an anniversary / custom message / favorite on another device while this one was offline | Appears after `online` without reload | Per-kind failure logged, copy kept |
| Read fails | Server error | Shown data and copy unchanged | Logged |
| Server says none | Empty result | `[]` shown and saved | N/A |
| Sign-out | A signs out, B signs in | A's copies, custom `messages` rows and `message-favorites` rows deleted; B sees none of A's; A's unsynced `moods` kept | Delete failure logged, sign-out proceeds |
| No-session boot | Expired token, `userId` never set | No crash; A's data is not shown to the next account | N/A |
| Old device | Blob still holds anniversaries; vault keys in localStorage | Blob anniversaries blanked on load; both vault keys removed | N/A |

</frozen-after-approval>

## Code Map

- `src/services/localCopy.ts` -- API to use: `readLocalCopy`, `writeLocalCopy`, `registerLocalCopy`, `deleteAccountCopies`.
- `src/stores/slices/partnerSlice.ts` :74-175 -- reference consumer: register at slice creation, copy first, then fetch, seq token + `isCurrent()`.
- `src/stores/slices/settingsSlice.ts` -- anniversary writes :308/:333/:363 (update copy after server success), `loadAnniversariesFromServer` :391 (add copy read/write), `mirrorAnniversaries` :89 (keeps local ids by `serverId`; reuse).
- `src/stores/slices/messagesSlice.ts` :124-152 -- `loadMessageDataFromServer`; register as refresher.
- `src/services/customMessageService.ts`, `src/services/storage.ts` -- owner-scoped mirror writes; add per-owner delete of custom rows and favorite rows. Never touch rows with no `userId` (bundled, legacy).
- `src/stores/slices/authSlice.ts` -- vault use :14-19, :217-234, :312-319, :355-379; `deleteAccountCopies` :242. The owner marker is today's only way a no-session boot knows the outgoing account.
- `src/services/anniversaryVault.ts` + `src/services/__tests__/anniversaryVault.test.ts` -- delete.
- `src/stores/useAppStore.ts` -- `partialize` :198, `getItem` strip :163.
- `src/App.tsx` :392-402 -- seeded loader effect; keep only the messages trigger (anniversaries via `refreshLocalCopies`).
- Tests pinning today's behaviour: `tests/unit/stores/{accountDataSlices,signOutClearsAccountState,loaderIdentityGuards,interactionsSubscription,persistedSettingsThemeKeys,persistedBlobContract}.test.ts`, `tests/support/helpers/persisted-blob.ts:62`, `tests/e2e/account-data/*.spec.ts`, `tests/e2e/auth/logout.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/slices/settingsSlice.ts` -- anniversaries copy: register refresher, read copy then fetch, save on success and after each confirmed write.
- [x] `src/stores/slices/messagesSlice.ts` -- register the messages refresher (no-op until seeded).
- [x] `src/services/customMessageService.ts`, `src/services/storage.ts` -- delete one owner's custom rows and favorites.
- [x] `src/stores/slices/authSlice.ts` -- remove the vault; sign-out resets anniversaries to `[]` and deletes the outgoing account's copies, custom rows and favorites; no-session boot handled.
- [x] `src/stores/useAppStore.ts` -- persist anniversaries as `[]`; blank them in old blobs; remove the two vault localStorage keys.
- [x] `src/App.tsx` -- seeded effect triggers only the messages refresh.
- [x] Delete `src/services/anniversaryVault.ts` and its test.
- [x] `tests/unit/...` -- matrix rows; update the listed tests.
- [x] `tests/e2e/offline/` -- anniversary visible offline after one online session; favorite toggled server-side appears after reconnect.

**Acceptance Criteria:**
- Given no source file imports `anniversaryVault`, when the app builds, then typecheck and lint pass.
- Given A's session ended, when B uses the device, then no A anniversary, custom message or favorite is readable from IndexedDB or localStorage by B's session.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind | Logout E2E seed can be overwritten by start refreshes, so the all-zero assertion can pass vacuously | medium | Seed written to IDB after GET responses only; `replaceMirrorForUser`/`saveAnniversariesCopy` run later and a second message-data run can follow from the seeded effect | patch |
| 2 | verif-gap | Late-landing copy-read test never overlaps; post-read `isFresh` check unverified | medium | Pre-verified: second refresh skips the copy step because the session is already fresh | patch |
| 3 | blind, edge | Rows left by accounts that signed out before this upgrade are never swept | medium | Old builds kept custom rows/favorites on sign-out; new code deletes only the marker's account. Data predates this change; the planned storage-move story removes those stores | defer |
| 4 | blind | AGENTS.md lacks a "delete new account-owned stores in `deleteAccountData`" rule | low | Fix edits an agent-context file | defer |
| 5 | blind, verif-gap | First boot after upgrade, offline, shows no countdowns | low | The new version only arrives online, and its auto-reload (`main.tsx`) runs online, so `refreshLocalCopies` fills the copy on that boot; seeding from the blob adds a branch | reject |
| 6 | blind | `deleteAccountCopies` outside the queue can race `saveAnniversariesCopy` | false | `saveAnniversariesCopy` runs in the same microtask chain as the identity check; on a cold `getDb()` both wait on one promise and the put's transaction is created first | reject |
| 7 | blind | Favorites deleted in two transactions; second failure leaves bundled favorites | low | Needs an IDB failure mid-sign-out; failure is logged; fix restructures two services | reject |
| 8 | blind | No direct unit tests for `deleteMirrorForUser` / `deleteFavoritesForUser` | low | Covered through the sign-out store tests; direct tests add cost for no new behaviour | reject |
| 9 | blind | Message-data refresh can run twice at boot | low | Serialized by the queue; only extra network; fix needs new coordination | reject |
| 10 | blind | Message refresher has no offline guard, logs a failed fetch | low | Same log the start loader always produced offline; adding a guard is new branching | reject |
| 11 | blind | `anniversariesFreshFor` is module-level | low | Keyed by `{userId, authSessionVersion}`; only tests create a second store and they pass | reject |
| 12 | blind | E2E imports `/src/...` through the Vite dev server | low | E2E always runs `vite --mode test` | reject |
| 13 | blind | Test drains don't wait on `deleteAccountCopies` | low | Tests pass repeatedly; helper refactor adds cost | reject |
| 14 | blind, edge | Owner-marker write failure gap undocumented / unswept | low | Needs localStorage to throw on a small write | reject |
| 15 | blind | Mid-test dynamic import in `AdminPanel.accountData.test.tsx` | low | Cosmetic | reject |

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit src` -- all pass
- `npx playwright test tests/e2e/offline tests/e2e/account-data tests/e2e/auth` (with `supabase start`) -- all pass
