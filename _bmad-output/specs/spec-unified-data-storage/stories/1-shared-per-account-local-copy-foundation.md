---
title: 'Shared per-account local-copy foundation'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '234752e3d3dbfcb07599ba0341eec4145ab9fa58'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Each data kind stores (or fails to store) its own copy, so most screens go blank offline and every model is another rule to get wrong. There is no shared per-account local copy, nothing refreshes on reconnect except moods, and the offline banner promises "changes will sync", which is false for most writes.

**Approach:** Build one IndexedDB-backed local-copy module with a small documented API: render the account's saved copy at once, then refresh it from the server; refresh on signed-in start, on `online`, and on demand (for Realtime handlers). Sign-out deletes the outgoing account's copies only. Prove it with the partner profile, which today shows "Connect with Your Partner" whenever the read fails.

## Boundaries & Constraints

**Always:** One `local-copies` store, keyed `[userId, kind]`, added only in `dbSchema.ts` (bump `DB_VERSION` to 12, gate on store existence). Copies are filled only from server responses, Realtime events or the user's own writes. Every post-await store write re-checks `{ userId, authSessionVersion }`. A failed server read leaves the copy and the screen as they were. The module header documents the API, since stories 2–10 plug into it.

**Never:** No migration of any data kind except the partner profile (partner-profile work leaves story 4, which keeps events). No deletion of `moods` rows or any queued write on sign-out. No Zustand persist change (`version` stays 0). No service-worker dependency. No `supabase.channel()`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline open, copy exists | A's partner copy saved, device offline | Partner view shows the saved partner at once, no fetch | N/A |
| Online open | Copy exists | Copy renders, then server result replaces it and is saved | N/A |
| Read fails | Server error, copy or no copy | Keeps what is shown; with no copy shows a load-error message, never the Connect UI | Logged, copy untouched |
| Truly unlinked | Server says no `partner_id` | Connect UI; "unlinked" is saved as the copy | N/A |
| Account switch mid-load | A's fetch resolves after B signs in | Result neither shown nor saved under B | Dropped |
| Sign-out | A signs out, B signs in | A's `local-copies` rows deleted; A's unsynced moods kept; B sees nothing of A's | Delete failure logged, sign-out proceeds |
| Reconnect | `online` event while signed in | Every registered copy refreshes without reload | Per-kind failure isolated |

</frozen-after-approval>

## Code Map

- `src/services/dbSchema.ts` -- schema (`MyLoveDBSchema` :41, `DB_VERSION` :110, `STORE_NAMES` :115, `upgradeDb` :133); add the store here only.
- `src/services/BaseIndexedDBService.ts` -- read-null/write-throw convention to follow; `openMyLoveDB` handles blocked/blocking.
- `src/stores/slices/authSlice.ts` -- `signedOutState()` :59, `discardAccountState()` :203-306 (hook copy deletion here with the outgoing `userId`).
- `src/App.tsx` -- signed-in start effect :396-401 and `handleOnline` :406-415: call the refresh-all entry point from both.
- `src/api/partnerService.ts` -- `getPartner()` :50 returns `null` for every failure; `hasPartner()` :364 is its only other caller.
- `src/api/supabaseClient.ts` -- `PartnerLookup` :295: the `linked | unlinked | error` shape to mirror.
- `src/stores/slices/partnerSlice.ts` -- `loadPartner` :53 (sets `partner:null` on error :79); has a `requestedBy` guard to upgrade to the full identity check.
- `src/components/PartnerMoodView/PartnerMoodView.tsx` -- loads partner only when online :108-114; Connect UI gate :379; loading :529; partner :537.
- `src/components/shared/NetworkStatusIndicator.tsx` -- global, rendered once at `App.tsx:697`; offline copy says changes will sync.
- `tests/unit/stores/signOutClearsAccountState.test.ts` -- :664 pins `signedOutState()` keys to `EXPECTED_RESET`.
- `tests/unit/services/dbSchema*.test.ts`, `storageSchema.test.ts` -- may pin the store list/version.
- `tests/e2e/offline/network-status.spec.ts` -- asserts the MoodTracker row's "Online"/"Offline" text; leave that row alone.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/dbSchema.ts` -- add `local-copies` (keyPath `['userId','kind']`, index `by-user`), v12, version note -- the one per-account store.
- [x] `src/services/localCopy.ts` -- new: `readLocalCopy`, `writeLocalCopy`, `deleteAccountCopies(userId)`, `registerLocalCopy(kind, refresh)`, `refreshLocalCopies()`, `refreshLocalCopy(kind)`; header documents the API and the fill-sources rule -- shared mechanism.
- [x] `src/api/partnerService.ts` -- `getPartner()` returns `linked | unlinked | error`; update `hasPartner()` -- a failed read is no longer "no partner".
- [x] `src/stores/slices/partnerSlice.ts` -- `loadPartner`: apply copy, then fetch when online, save and apply on success, keep on error; add `partnerLoadError` (in `signedOutState()`); register the partner refresher -- proving consumer.
- [x] `src/components/PartnerMoodView/PartnerMoodView.tsx` -- call `loadPartner` online or offline (pending requests stay online-only); show Connect UI only when known unlinked; show a load-error message otherwise.
- [x] `src/stores/slices/authSlice.ts`, `src/App.tsx` -- delete outgoing account's copies on sign-out; call `refreshLocalCopies()` on signed-in start and `online`.
- [x] `src/components/shared/NetworkStatusIndicator.tsx` -- offline text: "You're offline. Showing saved data, which may be out of date." -- CAP-8.
- [x] `tests/unit/...` -- localCopy (isolation, delete keeps other accounts and `moods`, refresh-all, per-kind failure), partnerSlice (matrix rows), schema/sign-out test updates.
- [x] `tests/e2e/offline/` -- linked user opens partner view online, goes offline, returns via dock: partner shown, global indicator shows the new text.

**Acceptance Criteria:**
- Given a linked user whose partner copy is saved, when the server read fails, then the partner view never shows "Connect with Your Partner".
- Given any screen offline, when the global indicator shows, then its text says the data may be out of date.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind, edge | Overlapping `loadPartner` calls: older server answer lands last and overwrites newer (screen + copy) | medium | No sequence token; `isCurrent()` checks identity only; four triggers (mount, start, online, accept) can overlap | patch |
| 2 | edge | Newer load's copy read replaces a newer in-memory partner with an older saved one | medium | Copy applied unconditionally at `partnerSlice.ts` step 1; same root cause as #1 (unordered loads) | patch (grouped with #1) |
| 3 | edge | `deleteAccountCopies` leaves `tx.done` rejection unhandled if a delete rejects | low | `Promise.all(deletes)` rejects first, `tx.done` never awaited; one-line reorder | patch |
| 4 | verif-gap, blind | `getPartner` three-way classification untested at the service | medium | Pre-verified: only real caller test collapses unlinked/error to null | patch |
| 5 | verif-gap, blind | App start/`online` wiring of `refreshLocalCopies` untested | medium | Pre-verified: no App test fires `online` or references localCopy | patch |
| 6 | verif-gap, blind | `partner-load-retry` button never exercised | low | Pre-verified: no test references the test id; direct test addition | patch |
| 7 | edge | Spinner replaces Connect/error UI on every refresh | low | Only for the IDB read (ms) before the copy clears it; old code raised it on every load too; fix needs a new flag | reject |
| 8 | blind, edge | Malformed/future-shape copy shown as unlinked | low | Only this loader writes the kind, with a fixed shape; unreachable today; fix adds guards | reject |
| 9 | blind | Missing partner row returns `error` forever instead of Connect | low | Needs `partner_id` pointing at an unreadable row (inconsistent data); retry offered; intent forbids failed-read-as-unlinked | reject |
| 10 | blind, edge | Slice uses `navigator.onLine`, view uses `syncStatus.isOnline` | low | `updateSyncStatus` reads `navigator.onLine` and runs before the refresh in the same handler; divergence window negligible | reject |
| 11 | blind | E2E does not cover a cold offline start | low | Reload offline is impossible under dev-mode E2E (no SW); store path covered by unit tests | reject |
| 12 | blind | `useLayoutEffect` no-flash not tested | low | Paint timing not unit-testable in happy-dom; fix is test harness complexity | reject |
| 13 | blind | v12 index-repair branch never run | low | Branch unreachable (no build created the store without the index); harmless, matches file pattern | reject |
| 14 | blind | Offline banner claims "saved data" on screens with no copy yet | low | Interim until stories 2–9 migrate each screen; old text was also false; per-screen text adds complexity | reject |
| 15 | blind | `loadPendingRequests`/`searchUsers` re-check only `userId`, not `authSessionVersion` | medium | Pre-existing guards, only re-indented here | defer |
| 16 | blind | Partner email persisted in IDB; fire-and-forget delete | low | Keyed by owner, never readable by another account; delete failure logged | reject |
| 17 | blind | Refresher registered as slice side effect; fetches on every start | false | Refresh on start/reconnect is the specified behaviour (CAP-2) | reject |

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit` -- all pass
- `npx playwright test tests/e2e/offline` (with `supabase start`) -- all pass
