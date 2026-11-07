---
title: 'The Partner page lists past questions marked Same or Different'
type: feature
ticket: '7'
created: '2026-11-07'
status: done
baseline_revision: '56d4ea8c190a25dcaedbb17fe948e84b50ae416a'
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
deferred:
  - summary: >-
      After an in-session unlink and relink to a different partner, the Partner page shows the previous pair's past questions under the new partner's name until the new history read lands, or indefinitely if that read fails.
    evidence: |-
      dailyQuestionSlice.dailyHistory is cleared only by signedOutState(); partner_linked does not touch it (usePartnerStreakListener.ts), and PartnerView renders it as soon as `partner` is set. Rare: the app has no unlink action (src/components/Settings/PartnerPage.tsx l.13-14), so the unlink is server-side and the relink must happen in the same session. Fix: reset or key the history on the partner id when it changes; story 9 (saved days record the partner they were read with) is the natural home.
    location: >-
      src/components/PartnerView/PartnerView.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** R7 wants the couple's past questions, each with both picks and Same or Different, on the Partner page; no RPC returns past days and the page shows only the streak.

**Approach:** A migration adds the client RPC `get_daily_history(before date default null)` (spine AD-15, AD-16): an array of AD-16 snapshots of the caller's current pair's done days (both picks exist), newest first, at most 30, all strictly before `before` when given. The client reads the first page into `dailyQuestionSlice.dailyHistory`, and the Partner page shows the three newest in the design's Past questions card, re-read on `daily_pick` and `SUBSCRIBED`.

## Boundaries & Constraints

**Always:**
- RPC: `security definer`, `stable`, `set search_path = ''`, `language plpgsql`. Null `auth.uid()` → `raise exception 'Authentication required'`. `get_my_partner_id()` null → `'[]'::jsonb` (unlinked reads nothing; the page already knows unlinked from the partner read). Else rows of `couple_days` with `user_a = least(uid, partner)`, `user_b = greatest(...)`, both partners' `daily_picks` rows existing (existence only, never `choice`), `day < before` when `before` is not null, `order by day desc limit 30`; answer `coalesce(jsonb_agg(public.daily_day_snapshot(id, uid, pg_catalog.now()) order by day desc), '[]'::jsonb)`. Choices come only through the snapshot (AD-5). Takes no pair, viewer or `at`. `revoke execute … from public, anon; grant … to authenticated`. Header in the style of `20261107010000_couple_streak.sql`, including a `Hosted catalog` line: check read-only that hosted has no `get_daily_history` (Supabase MCP `execute_sql`: `select oid::regprocedure from pg_proc where proname = 'get_daily_history'`); if one exists, `drop function if exists` it first.
- `npm run db:types` regenerates `src/types/database.types.ts` (never hand-edited; stack on the CLI pinned in `.mise.toml`).
- Gate file `40_daily_question_gate.sql`: `get_daily_history(date)` joins the client-RPC lists of DAILY-014/015 ("seven"); new numbered checks after DAILY-119: null `auth.uid()` refused; B before own pick gets `[]` and no `"this"`/`"that"` anywhere; after B's pick B gets one entry with `state` both and `same` false; header line for story 7.7; `plan()` updated. `18_function_execute_grants.sql`: add to FN-GRANT-008's list (alphabetical), FN-GRANT-023 for it, `plan()` updated.
- Client: `fetchDailyHistory(before?: string): Promise<DailyDaySnapshot[]>` in `dailyQuestionApi.ts`, shaped as `fetchCoupleStreak` (`refuseOffline('Past questions', 'load')`, `requestTimeout()`, zod `z.array(DailyDaySnapshotSchema)` in `dailyQuestionSchemas.ts`, unparseable → `AccountDataError('invalid-response')`, `toAccountDataError`); sends `{ before }` only when given.
- Slice: `dailyHistory: DailyDaySnapshot[] | null`, `dailyHistoryLoading`, `dailyHistoryError`, `loadDailyHistory()` (first page, replaces the field) shaped as `loadCoupleStreak` minus the copy: captured `{ userId, authSessionVersion }` plus its own sequence counter re-checked after the await, never throws, a failure keeps the field and sets the error, an `offline` refusal is not logged. All three fields in `signedOutState()` (`authSlice.ts`) in the same commit. Slice header documents it.
- Card `src/components/PartnerView/PastQuestionsCard.tsx` from the board (see Code Map): label "Past questions" (12px semibold uppercase `tracking-[.08em] text-muted`), then a `bg-card border border-line rounded-[20px] shadow-card px-3.5` card of the first three days with `state === 'both'` and both choices; each row `{this} or {that}?` (14px semibold, flex-1, wraps), `{my option text} · {partner's option text}` (12px semibold `text-muted`), and the mark: Same as lucide `Check` 13px + "Same" in `text-good`, else "Different" in `text-muted`; rows divided by `border-line`. Test ids: section `partner-past-questions`, row `partner-past-question` with `data-same="true|false"`, `partner-past-question-text`, `partner-past-question-picks`, `partner-past-question-mark`. Kit tokens only (`styleKitSweep.test.ts`).
- `PartnerView.tsx`: loads the history in the same effect and on the same keys as the streak (`partnerId`, `isOnline`); shows the card under `StreakCard` when a partner is present and the history holds at least one row; header comment updated.
- `usePartnerStreakListener.ts`: `daily_pick` and `SUBSCRIBED` also call `loadDailyHistory()`; `partner_linked` unchanged (a new partner id re-runs the page's load effect); no `new_mood`/`dates_changed` handler; header updated.

**Never:** a See all link or `/partner/history` (story 8); a local copy, `registerLocalCopy` or offline rows (story 9); paging beyond the first page in the slice (story 8); select `daily_picks.choice` outside the gate; a client-computed Same/Different (use `same`); touch `couple_streak`, `daily_day_snapshot` or another RPC; edit `database.types.ts` by hand; `@/` in `src/`; `prettier --write`; link, unlink or reset pool pairs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| first page | 35 done days | 30 newest, newest first | — |
| next page | `before` = 30th's day | the other 5; the `before` day itself absent | — |
| half day | only one partner picked a date (today or past) | absent | — |
| reader before own pick | partner picked today, reader not | `[]` (no today), no choice anywhere | — |
| other pairing | outsider pair's done days; or reader relinked to someone else | none of the other pair's days | — |
| unlinked | no partner | `[]` | — |
| signed out | null `auth.uid()` | — | 'Authentication required' |
| Same/Different | picks this/this; this/that | `same` true; false | — |
| card | 4 days in the slice | 3 rows, newest first | — |
| card empty | `[]` or `null` | no Past questions section | — |
| failed read | history shown, fetch throws | rows stay, error set | logged unless offline |
| stale read | session changes during fetch | field untouched | — |
| sign-out | history loaded | `dailyHistory` null, loading false, error null | — |

</intent-contract>

## Code Map

- `supabase/migrations/20261107010000_couple_streak.sql` -- template for header, `get_couple_streak` shape and grants; new file `supabase/migrations/20261107020000_daily_history.sql`.
- `supabase/migrations/20261107000000_daily_question_write_target_day.sql` -- current `daily_day_snapshot(day_id, viewer, at)`: returns null outside the pair; reused unchanged.
- `supabase/tests/database/40_daily_question_gate.sql` -- header l.1-50, `plan(119)` l.57, DAILY-014/015 l.194-211, null-auth block ~l.290-310, "Everything B can call before B's own pick" ~l.413, after-B's-pick block ~l.619-635 (DAILY-119 is the last number).
- `supabase/tests/database/18_function_execute_grants.sql` -- `plan(31)` l.29, FN-GRANT-008 list l.114, FN-GRANT-022 l.218-223.
- `supabase/tests/database/45_couple_streak.sql` -- template for a new `46_daily_history.sql` (inline helpers `create_test_user`, `authenticate_as`, `mk_pair`, `put`, three coach questions); `visible_daily_picks` ignores `at`, so fixed 2030 dates work with the client RPC at `now()`.
- `src/api/dailyQuestionApi.ts` -- `fetchCoupleStreak` l.~150 is the template; module header lists each RPC.
- `src/api/validation/dailyQuestionSchemas.ts` -- `DailyDaySnapshotSchema`.
- `src/stores/slices/dailyQuestionSlice.ts` -- header l.55-70, interface l.132-151, `streakSeq` l.264, `loadCoupleStreak` l.387-427.
- `src/stores/slices/authSlice.ts` l.~262 -- `signedOutState()` streak fields; add the history's beside them.
- `src/components/PartnerView/PartnerView.tsx`, `StreakCard.tsx` (tone/test-id style), `src/hooks/usePartnerStreakListener.ts`.
- Design board, read-only: `/private/tmp/claude-501/-Users-sallvain-Projects-My-Love--bmad-loop-runs-20261107-005314-0f5a-worktrees-7-2/13ccab3a-868b-4611-98eb-3caa2f14ceac/scratchpad/artifact-files/405608b9-ae3b-49c9-b66c-dfd4b1cafcae/project/Partner.dc.html` l.29-34 (`.pr`, `.pk`, `.same`, `.diff`) and l.76-86 (the card); `#15803d` is `text-good`, `#646b78` `text-muted`, `#f1e6ec` → `border-line`.
- Unit homes: `src/api/__tests__/dailyQuestionApi.test.ts`; `tests/unit/stores/dailyQuestionSlice.test.ts` (or a new `dailyQuestionSlice.history.test.ts` beside it) with `tests/unit/stores/dailyQuestionFixture.ts` (`revealSnapshot`, `dailySnapshot`); the sign-out clearing test (find with `grep -rln "coupleStreakError" tests src`); `src/components/PartnerView/__tests__/PartnerView.test.tsx` (`makeState` gains the three fields and `loadDailyHistory`) and `PartnerView.listener.test.tsx`.
- E2E: `tests/e2e/partner/partner-streak.spec.ts` (two contexts, picks, writer decline, `dismissStreakUp`, `fulfillOn` for the second context; its `openStubbedPartner` stubs every page read, so stub `get_daily_history` there with `[]` too); `seedPairDays`/`clearPairDays` in `tests/support/factories/daily-question.ts` (seeded picks are all `this`, so seeded days are Same); `tests/support/helpers/reads.ts` gains `DAILY_HISTORY_READ = '**/rest/v1/rpc/get_daily_history'`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261107020000_daily_history.sql` -- the RPC, header, grants, hosted check.
- [ ] `supabase/tests/database/46_daily_history.sql` (new) -- structure (definer, empty search_path, stable, `before` defaults null), grants (authenticated yes, anon and PUBLIC no), every SQL matrix row; each answer's element keys equal `daily_day_snapshot`'s.
- [ ] `supabase/tests/database/40_daily_question_gate.sql`, `18_function_execute_grants.sql` -- as Always.
- [ ] `src/types/database.types.ts` -- `npm run db:types` only.
- [ ] `src/api/validation/dailyQuestionSchemas.ts`, `src/api/dailyQuestionApi.ts` -- schema and `fetchDailyHistory`; header.
- [ ] `src/stores/slices/dailyQuestionSlice.ts`, `src/stores/slices/authSlice.ts` -- fields, action, sign-out.
- [ ] `src/components/PartnerView/PastQuestionsCard.tsx` (new), `PartnerView.tsx`, `src/hooks/usePartnerStreakListener.ts`.
- [ ] Unit tests -- API (ok, `before` sent only when given, unparseable, offline sends nothing, error); slice and card matrix rows; listener: `SUBSCRIBED` and `daily_pick` call `loadDailyHistory`, `partner_linked`, `new_mood`, `dates_changed` do not; sign-out clears the three fields.
- [ ] `tests/support/factories/daily-question.ts` -- `readPairQuestionsByDay(supabaseAdmin, pair)`: the pair's days newest first as `{ day, this, that }`.
- [ ] `tests/e2e/partner/partner-past-questions.spec.ts` (new), `tests/support/helpers/reads.ts`, `partner-streak.spec.ts` stub -- see AC.

**Acceptance Criteria:**
- Given 4 seeded done days (`daysAgo` 1-4) and the worker's own pick today on Daily, when the worker opens Partner, then Past questions shows 3 rows: the questions of days 1, 2, 3 in that order, each `{this} · {this}` and Same, and not today's.
- Given that page left open, when the partner picks the other option on Daily, then without a reload the first row becomes today's question with `{worker's} · {partner's}` and Different, and the card still shows 3 rows.
- Given the local stack, when `supabase test db` runs, then 18, 40 and 46 pass with every other file.

## Implementation Notes

- Hosted catalog checked read-only (Supabase MCP): no `get_daily_history`, so nothing is dropped first.
- `npm run db:types` adds one line, `get_daily_history: { Args: { before?: string }; Returns: Json }`; a re-run leaves the file unchanged.
- pgTAP: new `46_daily_history.sql` (33 checks, HISTORY-001..033); gate DAILY-120..122, `plan(122)`; grants FN-GRANT-023, `plan(32)`.
- Unit: new `tests/unit/stores/dailyHistorySlice.test.ts` and `src/components/PartnerView/__tests__/PastQuestionsCard.test.tsx`; cases added in `dailyQuestionApi.test.ts`, `PartnerView.test.tsx`, `PartnerView.listener.test.tsx`, `signOutClearsAccountState.test.ts`. Also `src/hooks/__tests__/usePartnerStreakListener.test.ts`, not in the Code Map: its mock state lacked `loadDailyHistory` and two cases failed until it was added with the new expectations.
- E2E: new `tests/e2e/partner/partner-past-questions.spec.ts`; `readPairQuestionsByDay` in the daily-question factory; `DAILY_HISTORY_READ` in `reads.ts`; `openStubbedPartner` in `partner-streak.spec.ts` stubs the history with `[]`.

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `46_daily_history.sql` HISTORY-023 checks `tests.big_a`, captured (l.162) before the `other` pair's days were put (l.266), so it passes whatever the pair boundary does — verified by line order. Fixed: HISTORY-023 reads `pg_temp.hist(pg_temp.pa('big'))` afresh; 46 passes, 33 checks.
  - `[low]` `[defer]` A user unlinked and relinked to someone else in one session sees the old pair's past questions under the new partner's name until the new read lands (indefinitely if it fails): `dailyHistory` is cleared only by sign-out — verified in `PartnerView.tsx` and `usePartnerStreakListener.ts`. Rare: the app has no unlink action (`Settings/PartnerPage.tsx` l.13-14), so an unlink is server-side and a relink in the same session is needed; the fix adds a reset keyed on the partner id, more than a direct correction. Deferred (rare but real); story 9's per-partner saved days is the natural home.
  - `[low]` `[patch]` `partner-past-questions.spec.ts`: the comment above `await reread` claims it proves the `daily_pick` re-read, but a `SUBSCRIBED` re-read can match the same wait; the row assertions after it retry, so the test stays correct — verified. Fixed: comment reworded, no code change.

## Design Notes

- Unlinked answers `[]`, not `{status}`: spine AD-16 says the RPC returns an array, and the Partner page learns unlinked from the partner read. Story 9's copy merge must treat `[]` as "nothing new", never as "drop saved days".
- `loadDailyHistory` replaces the field with the first page. Story 8, adding later pages, must keep loaded older pages when a re-read lands (merge by `day_id`).
- No See all link yet: without story 8's page it would be a dead control; story 8 adds it in the card's label row (the board's right-aligned link).

## Verification

**Commands:**
- `supabase migration up --local` (or `supabase db reset --local` if the stack holds another branch's migrations, after checking no loop run needs it) -- expected: applies 20261107020000.
- `supabase test db` -- expected: all files pass.
- `npm run db:types && git diff --exit-code src/types/database.types.ts` (after committing it) -- expected: no diff.
- `npm run typecheck` -- expected: exit 0 (or only the worktree TS2883 baseline).
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/partner tests/e2e/daily` -- expected: pass on the local stack.
- `npx playwright test tests/e2e/partner/partner-past-questions.spec.ts --repeat-each=3` -- expected: all pass.

## Auto Run Result

Status: built

**Summary:** Story 7.7: the Partner page lists the couple's past questions. A migration adds the client RPC `get_daily_history(before date default null)`: the caller's current pair's done days (both picks exist) as AD-16 snapshots, newest first, at most 30, strictly before `before` when given; `[]` when unlinked; choices only through `daily_day_snapshot` and the gate. The client reads the first page into `dailyQuestionSlice.dailyHistory` (session check, sequence counter, cleared by `signedOutState()`), and the Partner page shows the three newest in the design's Past questions card: `{this} or {that}?`, `{my pick} · {partner's pick}`, and Same with a green check or Different. `daily_pick` and `SUBSCRIBED` re-read it, so a newly finished day appears without a reload; `partner_linked`, `new_mood` and `dates_changed` are unchanged. See all (story 8) and offline rows (story 9) are not built here.

**Files changed:**
- `supabase/migrations/20261107020000_daily_history.sql` (new): the RPC, grants, hosted check noted.
- `supabase/tests/database/46_daily_history.sql` (new): 33 checks: structure, grants, paging, half days, pair boundary, relink, unlinked, Same/Different.
- `supabase/tests/database/40_daily_question_gate.sql`: seven client RPCs; DAILY-120..122 (null auth, `[]` before B's pick, one Different day after).
- `supabase/tests/database/18_function_execute_grants.sql`: FN-GRANT-008 list, FN-GRANT-023.
- `src/types/database.types.ts`: regenerated (`get_daily_history` line).
- `src/api/validation/dailyQuestionSchemas.ts`, `src/api/dailyQuestionApi.ts`: `DailyHistorySchema`, `fetchDailyHistory(before?)`.
- `src/stores/slices/dailyQuestionSlice.ts`, `src/stores/slices/authSlice.ts`: history fields, `loadDailyHistory`, sign-out reset.
- `src/components/PartnerView/PastQuestionsCard.tsx` (new), `PartnerView.tsx`: the card and its load.
- `src/hooks/usePartnerStreakListener.ts`: `daily_pick` and `SUBSCRIBED` re-read the history.
- Unit: `dailyHistorySlice.test.ts` (new), `PastQuestionsCard.test.tsx` (new), `dailyQuestionApi.test.ts`, `PartnerView.test.tsx`, `PartnerView.listener.test.tsx`, `usePartnerStreakListener.test.ts`, `signOutClearsAccountState.test.ts`.
- E2E: `tests/e2e/partner/partner-past-questions.spec.ts` (new), `partner-streak.spec.ts` (history stub), `tests/support/factories/daily-question.ts` (`readPairQuestionsByDay`), `tests/support/helpers/reads.ts` (`DAILY_HISTORY_READ`).

**Review (quick, pinned; lens: quick):** 3 findings, all low. Patched 2 (HISTORY-023 now reads a fresh answer; E2E comment reworded). Deferred 1 (stale history across an in-session relink to a different partner; rare, no in-app unlink). Rejected: none.

**Follow-up review recommended: false.** First pass; patched counts by verdict: high 0, medium 0, low 2.

**Verification (after the patches):**
- `supabase test db` (CLI 2.122.0): 33 files, 967 tests, PASS; migration 20261107020000 applied locally.
- `npm run db:types`: file unchanged on re-run.
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.
- `npm run test:unit` (vitest run): 258 files, 4816 tests, 0 failures.
- `npx playwright test tests/e2e/partner tests/e2e/daily`: 38 passed, row audit clean.
- `npx playwright test tests/e2e/partner/partner-past-questions.spec.ts --repeat-each=3`: 3 passed.
- Matrix audit: every row covered by a test that ran and passed (SQL rows in 46/40, card and slice rows in the unit files, sign-out in `signOutClearsAccountState.test.ts`).

**Residual risks:**
- The card's look in dark mode and in the iPhone Duo side column was not compared visually against the board; UNVERIFIED.
- `loadDailyHistory` replaces the field with the first page; story 8 must merge rather than replace once it loads more pages.
- The deferred relink case above.
