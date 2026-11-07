---
title: 'The streak shows offline from its saved copy'
type: feature
ticket: '3'
created: '2026-11-07'
status: done
baseline_revision: '270d0d4643abaeb25d1380a8eed472149af6908f'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `loadCoupleStreak` (story 2) is online-only with no saved copy, so the Partner page shows no streak offline or after a reload whose read fails.

**Approach:** Add the AD-13 `localCopy` kind `daily-streak`, holding the last `ok` streak. `loadCoupleStreak` shows the saved streak first, then the server answer: `ok` replaces the copy, `unlinked` deletes it, a failure leaves it. Register it as the kind's refresher and stub that read where fake-token sign-ins run.

## Boundaries & Constraints

**Always:**
- New `src/services/dailyStreakCopy.ts`: `DAILY_STREAK_COPY_KIND = 'daily-streak'`; `readSavedStreak(userId)` answers the saved `CoupleStreak` parsed with `CoupleStreakSchema`, or `null` when absent, unreadable or malformed; `saveStreakAnswer(userId, answer)` writes `answer.streak` for `ok` and deletes the kind for `unlinked`; throws on a storage failure.
- New `deleteLocalCopy(userId, kind)` in `localCopy.ts`: deletes one account's one kind, nothing else; throws; does not call the write listeners. Header API list gains it, and the "saved as such" rule notes that `daily-streak` records "unlinked" by deleting its copy.
- `loadCoupleStreak` order: capture identity and `++streakSeq`, set loading, read the copy; if still current and `coupleStreak === null`, show `{ status: 'ok', streak: saved }`; then fetch. Success: if current, set the answer and clear the error, then `saveStreakAnswer` under the captured `userId` (a save failure is logged, state kept). Failure: unchanged from story 2 (keeps what is shown, sets the error, offline refusal not logged). Nothing is written to state or copy once the session or sequence moved on.
- `registerLocalCopy(DAILY_STREAK_COPY_KIND, () => get().loadCoupleStreak())` in the slice factory.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx`: a no-op for the kind while the harness runs, restored to `loadCoupleStreak` on dispose, as `DAILY_DAYS_COPY_KIND` is. `tests/e2e/auth/login.spec.ts`: route `**/rest/v1/rpc/get_couple_streak` to `{ status: 'unlinked' }`, as `get_daily_day` is.
- With nothing saved and no connection the Partner page keeps showing `partner-streak-error` with "You are offline. The streak needs a connection to load." (already the API's refusal text).
- Doc comments that say the streak is online-only or has no copy (slice header, `PartnerView.tsx` effect comment) are corrected.

**Never:** compute a day's state or streak on the client; add an IndexedDB store or touch `dbSchema.ts`; add `daily-celebrated` (story 5) or show the streak on Daily (story 4); change `signedOutState()` (no new field); edit `database.types.ts`; use `@/` inside `src/`; run `prettier --write`; link/unlink pool pairs in E2E.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ok answer | server `ok` | state and copy hold the new streak | save failure logged, state kept |
| unlinked | copy saved, server `unlinked` | state `unlinked`, copy deleted | — |
| failed read | copy saved, fetch rejects | copy unchanged; shown streak stays | error set |
| offline start | copy saved, `coupleStreak` null, offline | saved streak shown, no request | offline error set, not logged |
| offline, nothing saved | no copy, offline | `coupleStreak` null | "…needs a connection to load." |
| already shown | `coupleStreak` set, copy older | copy not shown over it | — |
| stale | sign-out or newer read during copy read or fetch | nothing written to state or copy | — |
| sign-out | copy saved for A and B, A signs out | A's `daily-streak` gone, B's kept | — |

</intent-contract>

## Code Map

- `src/services/localCopy.ts` -- add `deleteLocalCopy` next to `deleteAccountCopies` (`db.delete(STORE_NAMES.LOCAL_COPIES, [userId, kind])` via `getDb()`); header lines 10-25, 36-40.
- `src/services/dailyDaysCopy.ts`, `src/services/dailyWriteDeclined.ts` -- templates for a kind module (header, imports from `../api/validation/dailyQuestionSchemas`).
- `src/api/validation/dailyQuestionSchemas.ts:64-82` -- `CoupleStreakSchema`, `CoupleStreak`, `CoupleStreakAnswer`.
- `src/stores/slices/dailyQuestionSlice.ts` -- header paragraph l.48-56; `registerLocalCopy` at l.200; `streakSeq` l.230; `loadCoupleStreak` l.348-373.
- `src/stores/slices/partnerSlice.ts:158-247` -- reference for copy-first-then-server with "only when nothing is shown".
- `src/components/PartnerView/PartnerView.tsx:55-61` -- effect comment only; rendering already shows the card whenever `coupleStreak` is `ok`.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx:12-13, 225-265` -- no-op/restore pattern.
- `tests/e2e/auth/login.spec.ts:124-135` -- `get_daily_day` POST stub to copy.
- `tests/unit/stores/coupleStreakSlice.test.ts` -- extend; it uses real fake-indexeddb, so `beforeEach` must clear `local-copies` after `setAuthUser` (as `pushPreferencesCopy.test.ts:71-92` does) or one test's copy leaks into the next.
- `tests/unit/stores/pushPreferencesCopy.test.ts:20-31, 94-104, 376-386` -- the sign-out-deletes-the-kind test and `accountDeletesSettled` afterEach to mirror.
- `tests/unit/services/localCopy.test.ts` -- add `deleteLocalCopy` cases.
- `tests/e2e/daily/daily-question-offline-and-invite.spec.ts:40-50, 94-134` -- reload-offline template (dev mode has no service worker: reload online with the read aborted, then `goOffline`).
- `tests/support/helpers/{local-copy,offline,navigation,reads,recurse}.ts`, `tests/support/factories/daily-question.ts` (`clearPairDays`), `tests/support/factories/events.ts` (`resolveWorkerPairIds`) -- E2E helpers; `COUPLE_STREAK_READ` in `reads.ts:119`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/localCopy.ts` -- `deleteLocalCopy` + header -- unlinked removes the kind.
- [ ] `src/services/dailyStreakCopy.ts` -- the kind module per Always.
- [ ] `src/stores/slices/dailyQuestionSlice.ts` -- refresher registration, copy-first `loadCoupleStreak`, header.
- [ ] `src/components/PartnerView/PartnerView.tsx` -- correct the effect comment.
- [ ] `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts` -- stub the new refresher read.
- [ ] `tests/unit/services/dailyStreakCopy.test.ts` (new), `tests/unit/services/localCopy.test.ts`, `tests/unit/stores/coupleStreakSlice.test.ts` -- every I/O row, plus `refreshLocalCopy('daily-streak')` running the read.
- [ ] `tests/e2e/partner/partner-streak-offline.spec.ts` (new; `trace`/`video` off; worker pair with `clearPairDays` before and at teardown) -- (1) Partner loaded online saves `daily-streak` (witness `savedLocalCopy`); abort `get_couple_streak`, reload, assert the abort was hit, `goOffline`, card still shows the same `partner-streak-held`; (2) online card shown, then reads aborted, Home → Partner via the dock: card stays with the same held, no `partner-streak-error`; (3) reads aborted from the first load (nothing saved), offline, Home → Partner: `partner-streak-error` says "You are offline. The streak needs a connection to load." and no card.

**Acceptance Criteria:**
- Given a linked worker account that loaded Partner online, when the page reloads with no server answer and the device goes offline, then the streak card shows the same held total.
- Given the Partner page showing the streak, when the next `get_couple_streak` fails, then the card stays.
- Given nothing saved and no connection, when Partner opens, then it says the streak needs a connection.
- Given saved streak copies for two accounts, when one signs out, then only that account's `daily-streak` is deleted.

## Implementation Notes

- 2026-11-07: a read superseded during its copy read now returns before it fetches, so the two existing overlap tests in `coupleStreakSlice.test.ts` wait for the first fetch before starting the second read.
- 2026-11-07: E2E scenario 3 first opens Partner online with the streak reads aborted. Dev mode has no service worker, so this is how the lazy Partner chunk and the `partner` copy get loaded before the device goes offline. Nothing is saved under `daily-streak`.
- 2026-11-07: with the refresher registered, every signed-in start and every `online` event sends one `get_couple_streak` request, unlinked accounts included (they get back `unlinked`).
- 2026-11-07 (review patch): `abortReads(page, url)` moved into `tests/support/helpers/abort-reads.ts`. The new spec and `daily-question-offline-and-invite.spec.ts` now share it, and each spec's local copy is gone.

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` (quick) The `PartnerView.tsx` header (l.12-13) still describes the streak as read only on partner presence and the listener. It leaves out the saved-copy fallback and the refresher's reads on start and on `online`. Fixed: the header sentence now covers both (comment only).
  - `[low]` `[patch]` (quick) `abortStreakReads` in the new spec copied `abortDailyReads` from `daily-question-offline-and-invite.spec.ts`, which breaks AGENTS.md's shared-test-helpers rule (DW-313). Fixed: one `abortReads(page, url)` now lives in `tests/support/helpers/abort-reads.ts`, both specs import it, and both local copies are deleted.
  - `[low]` `[reject]` (quick) The plan's Execution checkboxes and Implementation Notes were left empty. Rejected because the fix edits this build's plan. The Implementation Notes and the Auto Run Result record the work.

## Design Notes

- Why delete on `unlinked` instead of saving `{status:'unlinked'}`: the ticket says the answer removes it, and a missing copy already reads as "nothing to show", so the page falls back to the server answer in memory.
- The saved streak is shown only over `null`, never over an answer already in memory, as `partnerSlice` does; an answer in memory is at least as new as the copy.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (or only the worktree TS2883 baseline in `tests/support/merged-fixtures.ts`).
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/partner tests/e2e/auth/login.spec.ts tests/e2e/offline tests/e2e/daily tests/e2e/navigation` -- expected: pass (stack up via `supabase start`, CLI per `.mise.toml`).

## Auto Run Result

Status: built

**Summary:** The couple's streak now has a saved copy, the `daily-streak` kind from AD-13.

`loadCoupleStreak` reads in two stages:
1. **The saved copy.** It shows the saved streak at once, but only when nothing is in memory yet.
2. **The server.** An `ok` answer replaces the copy. An `unlinked` answer deletes it. A failed read leaves both the copy and the screen as they were.

Sessions and reads are guarded:
- Nothing is written to state or the copy once the session or the read sequence has moved on.
- The kind is registered as a local-copy refresher. Its read is stubbed in the auth-bootstrap harness and in `login.spec.ts`.
- Sign-out deletes the kind through `deleteAccountCopies`.

What the Partner page shows:
- The saved streak, offline and after a failed read.
- With nothing saved and no connection: "You are offline. The streak needs a connection to load."

**Files changed:**
- `src/services/localCopy.ts`: new `deleteLocalCopy(userId, kind)`. The header is updated, including the note on how "unlinked" is recorded for this kind.
- `src/services/dailyStreakCopy.ts` (new): `DAILY_STREAK_COPY_KIND`, `readSavedStreak` (zod-parsed) and `saveStreakAnswer`.
- `src/stores/slices/dailyQuestionSlice.ts`: refresher registration, the copy-first `loadCoupleStreak`, and the header.
- `src/components/PartnerView/PartnerView.tsx`: the header and effect comments are corrected (comments only).
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx` and `tests/e2e/auth/login.spec.ts`: stub the new refresher read.
- `tests/support/helpers/abort-reads.ts` (new): the shared `abortReads(page, url)`. `tests/e2e/daily/daily-question-offline-and-invite.spec.ts` now uses it.
- `tests/e2e/partner/partner-streak-offline.spec.ts` (new) covers three cases:
  - after a reload offline, the card still comes from the copy;
  - a failed read keeps the card;
  - with nothing saved, offline, Partner shows the needs-a-connection sentence.
- Unit tests: `tests/unit/services/dailyStreakCopy.test.ts` (new) and `tests/unit/services/localCopy.test.ts` (`deleteLocalCopy`). `tests/unit/stores/coupleStreakSlice.test.ts` covers every I/O row, the refresher and sign-out.

**Review (quick, pinned; lens: quick):** 3 findings: low 2, rejected 1.
- **Patched (2, both low):** the stale `PartnerView` header, and the duplicated abort helper, now shared.
- **Deferred:** none.
- **Rejected (1):** the unticked plan checklist, because its fix would edit this plan.

**Follow-up review recommended: false.** This was a first pass, and every patched entry was low. Patched counts by verdict: high 0, medium 0, low 2.

**Verification (after the patches):**
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:unit`: 252 files, 4681 tests, all pass.
- `npx playwright test tests/e2e/partner tests/e2e/auth/login.spec.ts tests/e2e/offline tests/e2e/daily tests/e2e/navigation`: 101 passed, on the local stack with Supabase CLI 2.122.0.
- Matrix audit: every I/O row has a unit test that ran and passed. The offline and failed-read rows are also covered end to end.

**Residual risks:**
- A sign-out can land between the last `isCurrent()` check and the IndexedDB `put` in `saveStreakAnswer`. That could recreate the outgoing account's `daily-streak` copy right after `deleteAccountCopies`. `mergeDailyDay` and `partnerSlice` have the same window. UNVERIFIED as reachable.
- One more `get_couple_streak` request now runs on every signed-in start and every `online` event.
- The rest of the Playwright suite (the edge-runtime specs, `token-persistence-overlap`) was not run. This change touches none of it.
