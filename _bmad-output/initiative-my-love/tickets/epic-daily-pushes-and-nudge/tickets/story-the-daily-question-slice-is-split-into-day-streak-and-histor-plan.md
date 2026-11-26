---
title: 'The daily question slice is split into day, streak and history'
type: refactor
ticket: '1'
created: '2026-11-25'
status: done
baseline_revision: '1a7acdc6c3d20d82af7cf290c4adba6839d7c0dc'
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

**Problem:** `src/stores/slices/dailyQuestionSlice.ts` (1014 lines) holds three domains — the day, the streak and the past questions — so stories 8.2, 8.8 and 8.9 would keep growing one file (epic 7 retrospective, item 8 / G1; epic R7).

**Approach:** Move the code verbatim into `dailyDaySlice.ts`, `dailyStreakSlice.ts` and `dailyHistorySlice.ts`, with the two partner-id helpers in one shared module, and the pair-change subscriber kept once, in the day slice, calling a reset that each of the other two slices owns. Behaviour, field and action names are unchanged.

## Boundaries & Constraints

**Always:** Every field, action, `localCopy` kind registration, session check (`{ userId, authSessionVersion }` captured before the first await), sequence counter (`streakSeq`, `historySeq`), `pairGeneration`, `historyFromCopy`, log message and `signedOutState()` field keeps its current behaviour. Each slice keeps the part of the header comment that describes it. `registerLocalCopy` order stays days then streak (compose day, then streak, then history, where `createDailyQuestionSlice` is composed today). The one `api.subscribe` (retry cancel + pair change) stays in the day slice; the pair-change reset still clears streak and history state, bumps their counters, and re-reads a streak that was shown or loading.

**Never:** No assertion in any test changes; only import paths may. No change to views or hooks beyond import paths and comments naming the file. No edit to the architecture spine (already names the three files at `1e5f8ea1`). No behaviour fix to DW-487/DW-509 (story 8.2), no nudge field or action (8.8, 8.9). No edits to `_bmad-output` ledger entries or past plans that name the old file — they are history.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Relink in session | `partner.id` A → B, streak shown, history loaded | streak and the seven history fields cleared, both counters and `pairGeneration` bumped, streak re-read for B | in-flight old-pair reads write nothing |
| First link / same partner | `partner.id` null → A, or A → A | nothing cleared | — |
| Identity change | `userId`/`authSessionVersion` changes | last partner id forgotten; pending drain retry cancelled | — |

</intent-contract>

## Code Map

- `src/stores/slices/dailyQuestionSlice.ts` -- source; deleted once the three files compile and the unit suite passes. Lines 1-56 header (day), 58-75 (streak), 76-85 (pair change), 87-109 (history), 111-119 (celebration → streak).
- `src/stores/slices/dailyDaySlice.ts` (new) -- `DailyDaySlice`: `dailyDay`, `dailyDayLoading`, `dailyDayError`, `dailyQueuedPicks`, `dailyWriteDeclined`; `loadDailyDay`, `refreshDailyDay`, `submitDailyPick`, `drainQueuedPicks`, `submitWrittenQuestion`, `declineWrittenQuestion`. Keeps `QueuedDailyPick` export, `DrainPassOutcome`, retry delays, `mergeAnswer`, `showQueuedPicks`, `showIfOnScreen`, drain/retry closures, `drainOnce`, the `api.subscribe`, `lastPartnerId`/`seenIdentity`, `registerLocalCopy(DAILY_DAYS_COPY_KIND, …)`. Calls `get().loadCoupleStreak()` (an action, not a field) as today.
- `src/stores/slices/dailyStreakSlice.ts` (new) -- `DailyStreakSlice`: `coupleStreak`, `coupleStreakLoading`, `coupleStreakError`; `loadCoupleStreak`, `claimStreakCelebration`, `claimStreakMilestone`, plus the new reset action. Owns `streakSeq` and `registerLocalCopy(DAILY_STREAK_COPY_KIND, …)`.
- `src/stores/slices/dailyHistorySlice.ts` (new) -- `DailyHistorySlice`: `dailyHistory` and its six flags; `loadDailyHistory`, `loadMoreDailyHistory`, plus the new reset action. Owns `historySeq`, `historyFromCopy`, `pairGeneration`.
- `src/stores/dailyPartnerIds.ts` (new, outside `slices/` so that folder holds only slices) -- `shownPartnerId(get, userId)` and `mergePartnerId(get, userId)`, bodies verbatim, `get: () => AppState`; imports `readSavedPartner` from `./slices/partnerSlice` and `lookupPartnerId` from `../api/supabaseClient`.
- `src/stores/types.ts` -- replace `DailyQuestionSlice` import and `extends` entry with the three interfaces.
- `src/stores/useAppStore.ts:8,153` -- import and compose the three creators in that order.
- `src/stores/slices/authSlice.ts:251` -- comment `dailyQuestionSlice —` → name the three slices; fields unchanged.
- `src/components/DailyQuestion/DailyQuestion.tsx:4,75` -- comment and `QueuedDailyPick` import → `dailyDaySlice`.
- `src/services/pickQueue.ts:29`, `src/services/syncLock.ts:35` -- comments → `dailyDaySlice.drainQueuedPicks`.
- `AGENTS.md:25` -- "15 slices" → "17 slices"; `AGENTS.md:100` `dailyQuestionSlice.drainQueuedPicks` → `dailyDaySlice.drainQueuedPicks`.
- Tests (`tests/unit/stores/dailyQuestionSlice*.test.ts`, `coupleStreakSlice.test.ts`, `dailyHistorySlice.test.ts`, `signOutClearsAccountState.test.ts`) drive `useAppStore` and import nothing from the slice file; keep their names and contents.

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/dailyPartnerIds.ts` -- create with the two helpers -- shared by all three slices.
- [x] `src/stores/slices/dailyStreakSlice.ts` -- create from the streak and celebration code and header parts; add `resetCoupleStreakForNewPair()` (see Design Notes) -- streak domain.
- [x] `src/stores/slices/dailyHistorySlice.ts` -- create from the history code and header part; add `resetDailyHistoryForNewPair()` -- history domain.
- [x] `src/stores/slices/dailyDaySlice.ts` -- create from the remaining code and header parts; the subscriber calls the two resets where it called `clearPairData()` -- day domain and the one pair-change subscriber.
- [x] `src/stores/types.ts`, `src/stores/useAppStore.ts` -- compose the three slices; then delete `dailyQuestionSlice.ts` -- the old file has no remaining importer.
- [x] `src/stores/slices/authSlice.ts`, `src/components/DailyQuestion/DailyQuestion.tsx`, `src/services/pickQueue.ts`, `src/services/syncLock.ts`, `AGENTS.md` -- import path and comments naming the file; slice count 17.

**Acceptance Criteria:**
- Given the split, when `npm run typecheck` and `npm run test:unit` run, then both pass with no test assertion changed.
- Given the split, when the Daily and Partner E2E specs run against the local stack, then they pass unchanged.
- Given `dailyDaySlice.ts`, when searched for `coupleStreak`, `coupleStreakLoading`, `coupleStreakError` or any `dailyHistory*` field, then none is named; given `dailyStreakSlice.ts` and `dailyHistorySlice.ts`, when searched for `dailyDay`, `dailyDayLoading`, `dailyDayError`, `dailyQueuedPicks` or `dailyWriteDeclined`, then none is named.
- Given the repo, when searched for `dailyQuestionSlice` outside `_bmad-output/` and test file names/comments that cite test files, then nothing names the deleted source file.

## Implementation Notes

- 2026-11-25: implemented by a Sonnet subagent from this plan; verified in the parent session. Files: new `src/stores/dailyPartnerIds.ts`, `src/stores/slices/dailyDaySlice.ts` (git sees it as a rename of `dailyQuestionSlice.ts`, 54% similar), `dailyStreakSlice.ts`, `dailyHistorySlice.ts`; edited `types.ts`, `useAppStore.ts`, `authSlice.ts` (comment), `DailyQuestion.tsx` (import, comment), `pickQueue.ts` and `syncLock.ts` (comments), `AGENTS.md` (17 slices, `dailyDaySlice.drainQueuedPicks`).
- New store actions `resetCoupleStreakForNewPair` and `resetDailyHistoryForNewPair`, called only by the day slice's subscriber, history first.
- Every test file is unchanged: tests drive `useAppStore`, and none imported the old file. The test file names `dailyQuestionSlice.*.test.ts` are kept.
- Verification: `npm run typecheck` exit 0; `npm run test:unit` 4995 tests, 0 failures; ESLint clean on the touched source; `npx playwright test tests/e2e/daily tests/e2e/partner` 49 passed; both acceptance greps empty; `grep -rn dailyQuestionSlice src AGENTS.md CLAUDE.md scripts supabase` empty.
- Carried as worded: the day slice's header still says `signedOutState()` clears "all three fields" while the slice has five. That wording was already in the original file.
- 2026-11-25 (review): the Quick lens found that the new headers carried two wrong counts from the original: the day slice said `signedOutState()` clears "all three fields" (it has five), and the history slice said "all five" (it has seven). Both were corrected in place, so the caveat above no longer applies and nothing needs the ledger.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 1, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` The new slice headers give wrong sign-out field counts: `dailyDaySlice.ts:22` says three (the slice has five) and `dailyHistorySlice.ts:26` says five (it has seven), and the first was recorded only in the plan, not the ledger. — Patched by the implementing subagent: "all five fields" and "all seven fields". A direct comment correction in files this change created, so it leaves nothing for the ledger.
  - `[false]` `[reject]` The pair-change reset is now two `set()` calls, so subscribers briefly see history cleared while the old streak is still shown. — Every store subscriber in `src/` reads only `userId`/`authSessionVersion`: `dailyDaySlice.ts:271`, `notesSlice.ts:742`, `useDialogSession.ts:8` and `LoveNoteMessage.tsx:172`. The re-entrant pass through the day subscriber does nothing, because `lastPartnerId` is updated before the resets run. The streak fields are not persisted, and the pair-change tests in `coupleStreakSlice.test.ts` and `dailyHistorySlice.test.ts` pass unchanged, so no observable behaviour changes.

## Design Notes

The reset moves with the state it clears. `clearPairData()` splits into two store actions, documented as called only by the day slice's pair-change subscriber:

```ts
// dailyStreakSlice
resetCoupleStreakForNewPair: () => {
  const streakWanted = get().coupleStreak !== null || get().coupleStreakLoading;
  streakSeq += 1;
  set({ coupleStreak: null, coupleStreakLoading: false, coupleStreakError: null });
  if (streakWanted && get().userId) void get().loadCoupleStreak();
},
// dailyHistorySlice: historySeq += 1; pairGeneration += 1; historyFromCopy = false; set(the seven fields as today)
// dailyDaySlice subscriber: if (changed) { get().resetDailyHistoryForNewPair(); get().resetCoupleStreakForNewPair(); }
```

History resets first so the streak re-read starts last, as today. Two `set()` calls replace one; the nested-set path in the subscriber is unchanged (it already set inside the listener, and `lastPartnerId` is updated before the call, so the re-entrant pass is a no-op). Store actions are used rather than a module-level registry because tests and the app each build their own store, and a closure per store is what keeps the counters per store.

`shownPartnerId`/`mergePartnerId` take `get` as their first argument so they stay plain functions with no store of their own.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0, or only errors that `baseline_revision` also shows (loop worktrees can carry a TS2883 baseline); none may name the new files.
- `npm run test:unit` -- expected: all pass.
- `npm run lint` -- expected: no new errors.
- `npx playwright test tests/e2e/daily tests/e2e/partner` (local Supabase running) -- expected: all pass.
- `grep -nE '\b(coupleStreak(Loading|Error)?|dailyHistory[A-Za-z]*)\b' src/stores/slices/dailyDaySlice.ts` and `grep -nE '\b(dailyDay(Loading|Error)?|dailyQueuedPicks|dailyWriteDeclined)\b' src/stores/slices/dailyStreakSlice.ts src/stores/slices/dailyHistorySlice.ts` -- expected: no output.

## Auto Run Result

Status: built

**Summary:** `dailyQuestionSlice.ts` is split into `dailyDaySlice.ts`, `dailyStreakSlice.ts` and `dailyHistorySlice.ts`, and the two partner-id helpers now live in `src/stores/dailyPartnerIds.ts`. Fields, actions, local-copy registrations, session checks, counters and log lines are moved unchanged. The one pair-change subscriber stays in the day slice and calls the two new resets, `resetDailyHistoryForNewPair` and `resetCoupleStreakForNewPair`, each owned by the slice whose state it clears.

**Files changed:**
- `src/stores/slices/dailyDaySlice.ts`: the day, the pick queue and its drain, the write prompt, and the pair-change subscriber (git sees it as a rename of `dailyQuestionSlice.ts`).
- `src/stores/slices/dailyStreakSlice.ts`: the streak, the celebration and milestone claims, and `resetCoupleStreakForNewPair`.
- `src/stores/slices/dailyHistorySlice.ts`: the past questions with their paging, and `resetDailyHistoryForNewPair`.
- `src/stores/dailyPartnerIds.ts`: `shownPartnerId` and `mergePartnerId`, which all three slices share.
- `src/stores/types.ts` and `src/stores/useAppStore.ts`: compose the three slices in the order day, streak, history.
- `src/stores/slices/authSlice.ts`, `src/services/pickQueue.ts` and `src/services/syncLock.ts`: comments now name the new slices.
- `src/components/DailyQuestion/DailyQuestion.tsx`: import path and a comment.
- `AGENTS.md`: the slice count is now 17, and it names `dailyDaySlice.drainQueuedPicks`.

**Review findings:** one patch applied (low: two header field counts corrected). Nothing was deferred. One finding was rejected as false: two `set()` calls are visible to no subscriber, as the triage log above shows.

**Follow-up review recommended:** false. This pass patched 0 high, 0 medium and 1 low.

**Verification:** the patched tree was checked twice, before and after the review patch.
- `npm run typecheck` exit 0.
- `npm run test:unit` 261 files, 4995 tests passed, with no test file changed.
- ESLint clean on `src/stores`, `src/components/DailyQuestion`, `pickQueue.ts` and `syncLock.ts`.
- `npx playwright test tests/e2e/daily tests/e2e/partner` 49 passed.
- Both domain greps return nothing.
- `dailyQuestionSlice` appears nowhere in `src` or `AGENTS.md`.
- The I/O matrix rows are covered by tests that ran and passed: `the partner changes in the session` in `coupleStreakSlice.test.ts` and `dailyHistorySlice.test.ts`, and `is cancelled by a session change` in `dailyQuestionSlice.pickQueue.retry.test.ts`.

**Residual risks:** none known. One observation, not a defect: open entries in `deferred-work.md` still give `src/stores/slices/dailyQuestionSlice.ts` as their location. Those are history and were left as written, as the plan says. A later sweep should look for those lines in the three new slice files.
