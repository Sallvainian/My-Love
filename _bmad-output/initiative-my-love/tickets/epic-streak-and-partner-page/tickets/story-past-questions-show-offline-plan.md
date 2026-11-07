---
title: 'Past questions show offline'
type: feature
ticket: '9'
created: '2026-11-07'
status: done
baseline_revision: 'dc347d7cebabc38c85597ae2839294628e10d45f'
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

**Problem:** Past questions (the Partner card, See all at `/partner/history`) have no saved copy, so offline after a reload they vanish while the streak count stays (R7). The `daily-days` copy also keeps only 31 days, and after a relink or `reset_bot_daily_days` it can show an old pairing's day (DW-492).

**Approach:** History pages merge into the one `daily-days` map (spine AD-13) through the same merge rule as `mergeDailyDay`. The cap and prune go. Each saved entry records the partner it was read with, and reads show only the current partner's entries. A server answer for a date drops that date's other `day_id`s. A failed first history read with nothing shown fills the list from the copy.

## Boundaries & Constraints

**Always:**
- `src/services/dailyDaysCopy.ts`: delete `MAX_SAVED_DAILY_DAYS` and `prune`. A stored entry is `DailyDaySnapshot & { partner_id: string | null }`; parsing accepts a missing `partner_id` (an entry saved before this story), reads it as `null`, and every value handed back to callers is stripped of `partner_id` (parse with `DailyDaySnapshotSchema`). The merge core, used by both `mergeDailyDay(userId, answer, partnerId, isCurrent)` and a new `mergeDailyDays(userId, snapshots, partnerId, isCurrent): Promise<void>`, works like this for each `ok` snapshot: the existing rank and `keepWriteDone` rule; the entry's `partner_id` is set to the given `partnerId` (the newest tag wins); and every other entry with the same `day` and a different `day_id` is deleted. It makes one read and one write per call, under `DAILY_DAYS_LOCK`, only while `isCurrent()`. `unlinked` still writes `{}`. `mergeDailyDays` with `[]` writes nothing.
- `readSavedDailyDay(userId, day, partnerId)` considers only entries whose `partner_id ?? null` equals `partnerId ?? null`. New `readSavedDailyHistory(userId, partnerId): Promise<DailyDaySnapshot[]>`: the matching entries with `state === 'both'` and both choices non-null, newest `day` first (ties by `day_id`). Both return `[]`/`null` on a failed read.
- Slice (`dailyQuestionSlice.ts`), two closure helpers:
  - `shownPartnerId(userId)` (for reads): when `get().partnerKnown`, `get().partner?.id ?? null`; otherwise `readSavedPartner(userId)` (exported from `partnerSlice.ts`), giving the linked id or `null`.
  - `mergePartnerId(userId)` (for tags): the linked id from the store or the saved copy when one is known; otherwise `lookupPartnerId()`, guarded so that a non-`linked` answer, an `undefined` answer or a throw gives `null`.

  Every `mergeDailyDay` call site (`loadDailyDay`, `refreshDailyDay`, `drainOnce`, `submitDailyPick`, `submitWrittenQuestion`) resolves `mergePartnerId` after its server answer and before the merge, and re-checks `isCurrent()` afterwards. `loadDailyDay` passes `shownPartnerId` to `readSavedDailyDay`.
- `loadDailyHistory` success: the existing set logic is unchanged, except when the shown list came from the copy (a closure flag `historyFromCopy`, cleared by every successful first page): then the page is treated as if nothing was loaded. Afterwards it calls `mergeDailyDays(page, mergePartnerId)` guarded by the session only. `loadMoreDailyHistory` success merges its page the same way.
- `loadDailyHistory` failure: the existing error and log rules, and the copy is never written. When `get().dailyHistory === null`, it sets `dailyHistory` to `readSavedDailyHistory(userId, shownPartnerId)`, sets `dailyHistoryEnd: true` and `historyFromCopy = true`, and re-checks the session after each await.
- Update the slice header, the `dailyDaysCopy.ts` header and the `PartnerView.tsx` header and effect comment: the history now has a copy.

**Never:** no new local-copy kind, IndexedDB store, migration or RPC; no change to the AD-16 snapshot or the server; no showing saved history first while online; no edit to `signedOutState()` (no new field; the kind is already deleted by `deleteAccountCopies`); never link, unlink or reset a worker-pool account in E2E.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No cap | 40 distinct days merged | all 40 kept | -- |
| Date drop | copy has `d-old` for 2026-11-05; ok answer `d-new` for 2026-11-05 | only `d-new` remains for that date; other dates untouched | -- |
| Partner filter, Daily | today saved with partner B; current partner C | `readSavedDailyDay` gives null; offline Daily shows no B day | -- |
| Legacy entry | entry without `partner_id`, partner known C | hidden; shown only while partner is unknown/unlinked (null) | -- |
| History merged | first page of 3 `both` days, partner C in store | copy holds all 3 tagged C | write failure logged, never thrown |
| Offline history | `dailyHistory` null, read refused offline, copy has 35 C days + 2 B days + 1 `me` day | `dailyHistory` = 35 C rows newest first, `dailyHistoryEnd` true, error set | offline refusal not logged |
| Failed read keeps copy | read fails | copy unchanged (no write) | -- |
| Back online after copy fill | copy-filled list, full server page of 30 | list = the 30 server rows, `dailyHistoryEnd` false | -- |
| Tag unknown | no store/saved partner, `lookupPartnerId` linked C | entries tagged C | lookup error/undefined → tag null |

</intent-contract>

## Code Map

- `src/services/dailyDaysCopy.ts`: all of it (73 lines of logic). `parseSavedDays` l.57, `readSavedDailyDay` l.71, `prune` l.85, `mergeDailyDay` l.103.
- `src/stores/slices/dailyQuestionSlice.ts`: the header l.1-96 ("There is no local copy." at about l.85). The merge call sites are at about l.403 (`drainOnce`), l.588-590 (`loadDailyDay`), l.624 (`refreshDailyDay`), l.684 (`submitDailyPick`) and l.733 (`submitWrittenQuestion`). `loadDailyHistory` is at about l.418 and `loadMoreDailyHistory` at about l.469. The existing session-guard and `historySeq` patterns are to be kept.
- `src/stores/slices/partnerSlice.ts`: `readSavedPartner(userId)` l.73 (exported), and the store fields `partner` and `partnerKnown`.
- `src/api/supabaseClient.ts`: `lookupPartnerId()` l.365, which never throws, answers `error` offline without a request, and is mocked as `vi.fn()` (it answers `undefined`) in many unit tests, so guard it.
- `src/components/PartnerView/PartnerView.tsx`: the header l.1-23 and the comment at l.70-76. It re-reads the history on `isOnline` and partner id; no logic change.
- Unit: `tests/unit/services/dailyDaysCopy.test.ts` (replace the 31-day prune test at l.145; add matrix rows), `tests/unit/stores/dailyHistorySlice.test.ts` (it mocks `lookupPartnerId`; add the history copy rows), and `tests/unit/stores/dailyQuestionSlice.test.ts` (Daily partner filter). Existing tests that compare the stored map may need `partner_id: null` added; keep each assertion's other checks.
- E2E patterns: `tests/e2e/partner/partner-streak-offline.spec.ts` (reload with `abortReads`, then `goOffline`; `test.use({ trace: 'off', video: 'off' })`; `savedLocalCopy(page, 'daily-days')`), `tests/e2e/partner/partner-history.spec.ts` (seeding 35 days, scrolling See all), `tests/e2e/daily/daily-question-partner-linked.spec.ts` (throwaways, `authSessionEnabled: false`), `createThrowaway`/`signIn` in `tests/support/helpers/throwaway-account.ts`, `seedPairDays(supabaseAdmin, { userId, partnerId }, days)` and `clearPairDays`/`readPairQuestionTexts` in `tests/support/factories/daily-question.ts`, and `DAILY_HISTORY_READ`/`DAILY_DAY_READ`/`COUPLE_STREAK_READ` in `tests/support/helpers/reads.ts`. To link or relink throwaways, update `users.partner_id` for both through `supabaseAdmin` (as `tests/support/auth/global-setup.ts:109` does). Throwaways only, never pool accounts.

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/dailyDaysCopy.ts`: the cap removal, the partner tag, the date drop, `mergeDailyDays`, the filtered readers and `readSavedDailyHistory`, plus the header.
- [ ] `src/stores/slices/dailyQuestionSlice.ts`: the two helpers, every merge call site, `loadDailyDay`'s saved read, the history merge and copy fill, and the header. Update the `PartnerView.tsx` comments.
- [ ] Unit tests: every matrix row, in `dailyDaysCopy.test.ts`, `dailyHistorySlice.test.ts` and `dailyQuestionSlice.test.ts`.
- [ ] `tests/e2e/partner/partner-past-questions-offline.spec.ts` (new): the ACs below.

**Acceptance Criteria:**
- Given the worker pair with 3 seeded done days whose Partner page loaded them online, when the page reloads with `get_daily_history` and `get_couple_streak` aborted and the device goes offline, then the Past questions card still shows the 3 rows with their questions, and See all shows "Same pick on 3 of your 3 days" with the 3 rows.
- Given 35 seeded done days fully paged on See all online, when `/partner/history` reloads with the history read aborted and the device goes offline, then all 35 rows show under "Same pick on 35 of your 35 days".
- Given throwaways A and B linked with seeded done days, which A loaded on Daily and Partner, when an admin relinks A to throwaway C and B to throwaway D, A loads Partner and Daily once online, then reloads with the reads aborted and goes offline, then neither Daily nor Past questions shows any of A–B's question texts, and the `daily-days` copy still holds the A–B entries, so the partner filter hides them rather than nothing having been saved.

## Implementation Notes

- A copy fill with no matching saved day leaves `dailyHistory` as `null` rather than `[]`, which keeps story 8's "a failed first read shows nothing" test. The UI renders the same either way, because `PartnerView` passes `dailyHistory ?? []` and the card hides with no rows.
- Daily partner-filter unit tests are in a new `tests/unit/stores/dailyQuestionSlice.partner.test.ts`, kept apart to stop `dailyQuestionSlice.test.ts` going past 1000 lines. Existing assertions on the stored map gained `partner_id: null`; nothing else they checked changed.
- The relink E2E ignores question texts that A's new pairing also drew (the question pool can repeat) and asserts that at least 3 old texts are hidden. The Daily lazy chunk does not survive a reload, so Daily is visited online after the reload and before going offline. When the partner filter was disabled by hand, the relink test failed, so it really tests the filter.
- Files: `src/services/dailyDaysCopy.ts`, `src/stores/slices/dailyQuestionSlice.ts`, `src/components/PartnerView/PartnerView.tsx` (comments only); unit tests `dailyDaysCopy.test.ts`, `dailyHistorySlice.test.ts`, `dailyQuestionSlice.partner.test.ts` (new) and the `partner_id: null` updates in `dailyQuestionSlice{,.pickQueue,.writeQuestion}.test.ts`; E2E `tests/e2e/partner/partner-past-questions-offline.spec.ts` (new).

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 6 findings — high 0, medium 0, low 6, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `deferred-work.md` DW-492 was still `open`, so a loop sweep would triage it again although this change fixes both of its causes. Fixed: added a `resolution:` line in DW-490's style and set `status: done 2026-11-07`.
  - `[low]` `[patch]` `dailyQuestionSlice.ts`: the partner tag was resolved before merges that never use it (an `unlinked` daily answer, an empty history page), so an unlinked account sent a wasted `lookupPartnerId` request on every Daily read. Fixed: `loadDailyDay` resolves the tag only for an `ok` answer, and the history loaders only for a non-empty page. A unit test checks that an unlinked answer makes no lookup. A known-unlinked store still falls through to the lookup for an `ok` answer; that is kept on purpose, because it tags the day right after a link this device has not seen yet.
  - `[low]` `[patch]` Relink E2E: the date drop holds the Daily half, not the partner filter. Fixed: a comment there says so and points to `dailyQuestionSlice.partner.test.ts`, which pins the Daily filter (matrix row "Partner filter, Daily").
  - `[low]` `[patch]` `dailyDaysCopy.test.ts`: the no-cap test seeded impossible dates (`2026-10-32` and later) and merged only one snapshot. Fixed: 40 valid dates go through `mergeDailyDays`, plus one more through `mergeDailyDay`, and all 41 are kept.
  - `[low]` `[patch]` `dailyQuestionSlice.partner.test.ts`: a test title claimed "says nothing is shown", which it never checked. Fixed: the title now names what it asserts.
  - `[low]` `[patch]` `dailyDaysCopy.ts`: the `forPartner` comment wrongly said "`undefined` counts as `null`". Fixed: the parenthetical is removed.

## Design Notes

- "Through `mergeDailyDay`" is read as the same merge rule, map and lock. A page goes through one shared core, `mergeDailyDays`, in one read and one write, instead of 30 lock cycles.
- The tag comes from the client because the AD-16 snapshot names no partner, and the spine binds its shape. The store's partner or the saved partner copy is preferred, so a merge sends no request. `lookupPartnerId` is used only when neither is known (a first sign-in on a device, where the partner read races the day read). A tag that is stale after a relink can only hide a day, and the next online read re-tags it.
- A copy-filled list is replaced by the next server page rather than merged, so stale saved rows never stay below live ones.

## Verification

**Commands:**
- `npm run typecheck`: expected exit 0 (or only the worktree TS2883 baseline).
- `npm run lint`: expected exit 0.
- `npm run test:unit`: expected all pass.
- `npx playwright test tests/e2e/partner tests/e2e/daily`: expected to pass on the local stack.
- `npx playwright test tests/e2e/partner/partner-past-questions-offline.spec.ts --repeat-each=3`: expected all pass.

## Auto Run Result

Status: built

**Summary:** Story 7.9. Past questions now show offline.
- `get_daily_history` pages merge into the one `daily-days` map (spine AD-13) through the same merge core as `mergeDailyDay`. A failed first history read with nothing shown fills the Partner card and See all from it, and the next online page replaces that fill.
- The 31-day cap and its prune are gone.
- Every saved day records the partner it was read with. The tag comes from the store or the saved partner copy, and from `lookupPartnerId` only when neither knows one. Both readers show only the current partner's days.
- A server answer for a date drops that date's other `day_id`s. Together with the partner filter, this closes DW-492, both after a relink and after `reset_bot_daily_days`.

**Files changed:**
- `src/services/dailyDaysCopy.ts`: partner tag, date drop, no cap, `mergeDailyDays` and `readSavedDailyHistory`; `readSavedDailyDay` filters by partner.
- `src/stores/slices/dailyQuestionSlice.ts`: the `shownPartnerId` and `mergePartnerId` helpers, tagged merges at all five call sites, and the history page merge and copy fill.
- `src/components/PartnerView/PartnerView.tsx`: comments only.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-492 marked done.
- Unit tests: `dailyDaysCopy.test.ts`, `dailyHistorySlice.test.ts`, `dailyQuestionSlice.partner.test.ts` (new), and the `partner_id: null` updates in `dailyQuestionSlice{,.pickQueue,.writeQuestion}.test.ts`.
- E2E: `tests/e2e/partner/partner-past-questions-offline.spec.ts` (new, 3 tests; the relink test uses throwaway accounts only).

**Review (quick, pinned; lens: quick):** 6 findings, all low. Patched 6, deferred 0, rejected 0.

**Follow-up review recommended: false.** First pass; patched counts by verdict: high 0, medium 0, low 6.

**Verification (after the patches):**
- `npm run typecheck` exit 0; `npm run lint` exit 0.
- `npm run test:unit`: 261 files, 4918 tests passed.
- `npx playwright test tests/e2e/partner tests/e2e/daily`: 46 passed, row audit clean.
- `npx playwright test tests/e2e/partner/partner-past-questions-offline.spec.ts --repeat-each=3`: 9 passed.
- Matrix audit: every row is covered by a test that ran and passed: copy rows in `dailyDaysCopy.test.ts`, history rows in `dailyHistorySlice.test.ts`, Daily and tag rows in `dailyQuestionSlice.partner.test.ts`.

**Residual risks:**
- After a relink this device has not yet seen, a day read in that window can be tagged with the old partner. That only hides the day offline, and the next online read re-tags it.
- A read already in flight while a relink completes could tag an old-pair day with the new partner. The window is very narrow, and the next answer for that date drops the day.
- Entries saved before this change carry no tag, so they are hidden once a partner is known. Today's day offline returns after the next online read.
