---
title: 'Refactor sweep'
type: refactor
ticket: '10'
created: '2026-11-07'
status: done
baseline_revision: 'bb000995e9ef35b3576fa7c158c49459008a52df'
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

**Problem:** Stories 1 to 9 deferred twelve findings (DW-500 to DW-511, all `open`, low). Three of them (DW-504, DW-510, DW-511: after an in-session partner change the Partner page shows the old pair's streak and past questions under the new partner's name, for good if the new read fails) were deferred because the fix needed a partner key, and story 9 has since built per-partner tagging (`shownPartnerId`, `mergePartnerId` in `dailyQuestionSlice.ts`, `partner_id` tags in `dailyDaysCopy.ts`). One more (DW-508: "Your partner" capitalised mid-sentence when the partner has no name) is a direct correction that also hits four other sentences.

**Approach:** Picked at the start: DW-504, DW-510, DW-511 and DW-508. When the shown partner changes from one id to another in a session, the slice clears the in-memory streak and history and makes in-flight reads for the old pair write nothing; the `daily-streak` copy records the partner it was read with, as `daily-days` does, and shows only for the current partner. Mid-sentence uses of the partner name get a lower-case fallback. The other eight entries stay `open` in the ledger, unchanged: their missing code still does not exist (DW-509 needs a localCopy read that tells absent from failed; DW-505 retry logic; DW-500, DW-501, DW-502 new branches or controls; DW-503 is epic 10's; DW-506 is server dating the epic bars the client from; DW-507 needs the refresher and re-join suppressed).

## Boundaries & Constraints

**Always:** Follow story 9's pattern: an entry saved before the tag (no `partner_id`) reads as partner `null`. The reset fires only when a non-null partner id differs from the last non-null one seen in this session (first link and a reload of the same partner never clear anything); an identity change (`userId`/`authSessionVersion`) forgets the last id. Every async write keeps its `{ userId, authSessionVersion }` check. `deferred-work.md`: set `status: done 2026-11-07` with a `resolution:` line (DW-490's style) on the four fixed entries only. Keep every existing assertion; update tests only where the stored copy's shape changed.

**Never:** No new UI, control, wording beyond the lower-case fallback, or server change. Do not touch Daily's `dailyDay` (story 9 closed DW-492). Do not edit the other eight ledger entries, `database.types.ts`, or any ticket file. No `prettier --write`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Relink in session | partner A shown with A's streak and history; partner becomes C | streak, its error, history, its error and end flag cleared; loading flags false; C's reads fill them | old in-flight streak/history/more reads write nothing, to the field or the copy |
| C's reads fail | as above, then both reads fail | no A-pair streak or rows shown; streak error card; history fill from copy finds nothing for C | errors set as today |
| First link / same partner | null → A, or A → A after a reload or refresh | nothing cleared | — |
| Saved streak, other partner | copy tagged A, current partner C | `readSavedStreak` gives null; offline shows "needs a connection" | — |
| Saved streak, untagged | copy with no `partner_id`, partner known | reads as partner `null`: hidden for a known partner, shown when none is known | — |
| Nameless partner | `display_name` empty | sentence starts keep "Your partner"; mid-sentence reads "your partner" | — |

</intent-contract>

## Code Map

- `src/stores/slices/dailyQuestionSlice.ts` -- `api.subscribe` (~l.377) is the place for the partner-change reset; `streakSeq`/`historySeq`/`historyFromCopy` module vars (~l.310); `shownPartnerId` (read tag) and `mergePartnerId` (write tag) to reuse; `loadDailyHistory` merges with only `inSession()` after the fetch, `loadMoreDailyHistory` has no sequence counter (guard it with a generation bumped by the reset); `loadCoupleStreak` (~l.583) reads `readSavedStreak` then saves via `saveStreakAnswer`. Update the module header's streak and history paragraphs.
- `src/services/dailyStreakCopy.ts` -- add the partner tag: `saveStreakAnswer(userId, answer, partnerId)` stores the streak plus `partner_id`; `readSavedStreak(userId, partnerId)` returns null on a tag mismatch (zod `object` strips the extra key). Update the header.
- `src/services/dailyDaysCopy.ts` -- read-only reference for the tag pattern (`parseSavedDays`, `forPartner`).
- `src/components/DailyQuestion/DailyQuestion.tsx` -- l.340 fallback; mid-sentence l.303 "Waiting on", l.477 waiting sentence.
- `src/components/DailyQuestion/StreakUp.tsx` l.131, l.187; `Milestone.tsx` l.85 -- mid-sentence uses. `WriteQuestionSheet.tsx` l.158/199 and l.224 in `DailyQuestion.tsx` start sentences: keep.
- `src/components/PartnerView/PartnerView.tsx` -- header comment only, if behaviour it describes changes.
- Tests: `tests/unit/stores/coupleStreakSlice.test.ts`, `tests/unit/stores/dailyHistorySlice.test.ts`, `tests/unit/services/dailyStreakCopy.test.ts`, `src/components/PartnerView/__tests__/PartnerView.test.tsx`, `src/components/DailyQuestion/__tests__/*`; E2E `tests/e2e/partner/partner-past-questions-offline.spec.ts` (throwaway relink pattern to copy: `createThrowaway`, admin `partner_id` updates, `abortReads`, `COUPLE_STREAK_READ`, `DAILY_HISTORY_READ`); `tests/e2e/partner/partner-streak-offline.spec.ts` reads the saved copy's `held` (still works with the extra key).
- `_bmad-output/initiative-my-love/deferred-work.md` -- DW-504, DW-508, DW-510, DW-511.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/dailyStreakCopy.ts` -- tag on save, filter on read -- DW-504's "for good if it fails" half.
- [x] `src/stores/slices/dailyQuestionSlice.ts` -- partner-change reset with a generation that stale reads and merges check; pass tags to the streak copy -- DW-504, DW-510, DW-511.
- [x] `src/components/DailyQuestion/{DailyQuestion,StreakUp,Milestone}.tsx` -- lower-case fallback mid-sentence (a raw-name value or one small helper; no duplication per file) -- DW-508.
- [x] Unit tests for every matrix row (slice relink with in-flight reads, copy tag, untagged copy, fallback wording on each changed sentence).
- [x] `tests/e2e/partner/partner-past-questions-offline.spec.ts` (or a new spec beside it) -- throwaway A linked to B with done days loads Partner online; an admin relinks A to C; a reload with A's streak and history reads aborted (online, so the partner read returns C) shows C's name and neither the A-B streak card nor any A-B question.
- [x] `_bmad-output/initiative-my-love/deferred-work.md` -- close the four entries.

**Acceptance Criteria:**
- Given A's Partner page has shown the A-B streak and past questions, when the partner read answers C and C's reads fail, then the page shows C's name, no A-B held count and no A-B question.
- Given a nameless linked partner, when Daily shows the waiting state, the +1 or the milestone screen, then every mid-sentence mention reads "your partner".
- Given the sweep's changes, when the ledger and the suites are checked, then DW-504, DW-508, DW-510 and DW-511 read `done 2026-11-07` with a resolution, the other eight are unchanged, and the unit, E2E and `supabase test db` suites pass.

## Implementation Notes

- 2026-11-07: picked at the start: DW-504, DW-508, DW-510, DW-511 (story 9's partner tagging is the code their deferrals said was missing). Left `open` and unchanged: DW-500, DW-501, DW-502, DW-503, DW-505, DW-506, DW-507, DW-509 (their missing code still does not exist; DW-509's distinguishing localCopy read was not built by story 6 or later).
- 2026-11-07: the reset is `clearPairData()` in `dailyQuestionSlice.ts`, called from the existing `api.subscribe`; it bumps `streakSeq`, `historySeq` and a new `pairGeneration`, which the history loaders' `inSession()` checks so a page shown just before the change is not merged into `daily-days` under the new partner. The streak save checks `isCurrent()` again after its tag lookup (`mergePartnerId`).
- 2026-11-07: DW-508's fix covers five mid-sentence uses (`DailyQuestion.tsx` "Waiting on", the waiting sentence; `StreakUp.tsx` message and button; `Milestone.tsx` message) through one `partnerNameInline` value computed in `DailyQuestion`; sentence starts keep "Your partner".
- 2026-11-07: E2E relink test added to `tests/e2e/partner/partner-past-questions-offline.spec.ts`; the implementing agent reports it fails with the tag filter removed.
- 2026-11-07 (verify): typecheck and lint exit 0; `vitest run` 261 files, 4946 passed; `supabase test db` 33 files, 967 tests, PASS; chromium E2E over every `tests/e2e` spec but `token-persistence-overlap.spec.ts` (uncollectable in a loop worktree): 302 passed, 1 failed, `daily-question-partner-linked.spec.ts` (a `get_daily_day` still in flight at a 15 s poll on an unlinked throwaway account, a path this change does not touch); it passed 3 of 3 alone and in the implementing agent's full run. Recorded as DW-512. The `api` project was not run (edge runtime is stopped on the shared stack).

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 2 findings — high 0, medium 1, low 1, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` `clearPairData` dropped every `loadCoupleStreak` in flight, but Daily's read effect (`DailyQuestion.tsx` l.404-407, deps `[loadDailyDay, loadCoupleStreak, sessionKey]`) never re-runs on a partner change, so after a reload where the saved partner B gives way to the server's C, Daily's mount read and the start refresher's read (both correct for C) were discarded and Daily showed no chip, strip or banner until a Realtime or `online` re-read — verified against the effect and `useDailyPickListener`. Fixed: `clearPairData` restarts `loadCoupleStreak()` when a streak was shown or a read was in flight (signed in only); four unit tests in `coupleStreakSlice.test.ts` (in-flight change ends on the new partner's answer with no view calling the loader, a shown streak re-reads, nothing shown starts no read, signed out starts no read).
  - `[low]` `[patch]` hand formatting off the surrounding style: re-wrapped comment lines of 138, 116 and 105 characters in `PartnerView.tsx`, `dailyStreakCopy.ts` and the slice header; test literals of 104-116 characters in `coupleStreakSlice.test.ts` and `dailyHistorySlice.test.ts`; no blank line before the new E2E test — verified by line length. Fixed: the added lines re-wrapped and broken by hand (two left at 105 and 111 after the agent's pass were re-wrapped by the orchestrating session), the blank line added; untouched older lines left as they were.

## Design Notes

The reset belongs in the slice, not `PartnerView`: Daily shows the same `coupleStreak`, and an in-flight read must be fenced at the store. Sketch:

```ts
let lastPartnerId: string | null = null; // last non-null partner in this session
api.subscribe((s) => {
  const id = s.partner?.id ?? null;
  if (id && lastPartnerId && id !== lastPartnerId) clearCoupleData(); // bumps seqs + generation
  if (id) lastPartnerId = id;
});
```

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0, or only the loop worktree's known TS2883 errors, the same set as at `baseline_revision`.
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/partner tests/e2e/daily` then the full `npm run test:e2e` -- expected: pass, apart from the edge-runtime specs and the worktree-uncollectable spec named in story 2's notes.
- `supabase test db` -- expected: all pass.

## Auto Run Result

Status: built

**Summary:** Refactor sweep for epic 7. Of the twelve findings stories 1 to 9 deferred (DW-500 to DW-511), four are fixed and closed: DW-504, DW-510 and DW-511 (an in-session partner change showed the old pair's streak and past questions under the new partner's name), whose deferrals named a partner key that story 9's tagging has since provided, and DW-508 ("Your partner" capitalised mid-sentence). The other eight stay `open` and unchanged, their missing code still absent (reasons in Implementation Notes). No review rejection from stories 1 to 9 named code a later story built beyond these. One new entry, DW-512, records an E2E flake seen in this run's verification.

**Files changed:**
- `src/stores/slices/dailyQuestionSlice.ts` -- `clearPairData` on a partner change (from `api.subscribe`), `pairGeneration` fencing history reads and merges, streak re-read after the clear, tagged streak copy reads and saves; header updated.
- `src/services/dailyStreakCopy.ts` -- the `daily-streak` copy records and filters on `partner_id`.
- `src/components/DailyQuestion/DailyQuestion.tsx`, `StreakUp.tsx`, `Milestone.tsx` -- `partnerNameInline` ("your partner") for the five mid-sentence uses.
- `src/components/PartnerView/PartnerView.tsx` -- header comment.
- `tests/unit/stores/coupleStreakSlice.test.ts`, `tests/unit/stores/dailyHistorySlice.test.ts`, `tests/unit/services/dailyStreakCopy.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion{,.celebration}.test.tsx` -- matrix coverage.
- `tests/e2e/partner/partner-past-questions-offline.spec.ts` -- relink E2E: A relinked from B to C, reload with reads aborted shows C's name and no A-B streak or question.
- `_bmad-output/initiative-my-love/deferred-work.md` -- DW-504, DW-508, DW-510, DW-511 done with resolutions; DW-512 appended.

**Review findings:** 2 patched (1 medium, 1 low), 0 deferred, 0 rejected.

**Follow-up review recommended:** false -- first pass patched no high and one medium.

**Verification:** after the patches: `npm run typecheck` exit 0; `npm run lint` exit 0; `vitest run` 261 files, 4950 passed; `supabase test db` 33 files, 967 tests, PASS; chromium E2E over every `tests/e2e` spec except `token-persistence-overlap.spec.ts` (uncollectable in a loop worktree): 303 passed. Before the patches the same run had 302 passed and 1 failed (`daily-question-partner-linked.spec.ts`, filed as DW-512; 3 of 3 alone and the post-patch full run passed). The `api` Playwright project was not run (edge runtime stopped on the shared stack; nothing here touches an Edge Function).

**Residual risks:** a `daily-streak` copy saved before this change carries no partner tag, so until the first online read after the update an offline Partner page or Daily with a known partner shows "needs a connection" instead of the saved streak (the same trade story 9 made for `daily-days`). The partner-change reset is proven at unit level and by the reload E2E; a live in-session relink has no UI path (no unlink action), so no E2E drives it.
