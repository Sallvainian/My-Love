---
title: "Each partner's day runs on their own clock"
type: 'feature'
ticket: '2'
created: '2026-11-06'
status: done
baseline_revision: '75a9b128ac611bb974e0dcde39f604a8f3247ee7'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: ['oversized']
deferred:
  - summary: >-
      origin/main and this epic each hold a migration at version 20261105010000, so once both reach main the hosted deploy skips one of them.
    evidence: |-
      `git ls-tree --name-only origin/main supabase/migrations/` lists `20261105010000_push_added_dates.sql` (and `20261105020000_remind_me_on_by_default.sql`); this epic's story 6.1 added `20261105010000_daily_question_days_and_picks.sql`. The migration history keys on the version alone, so whichever lands second is recorded as applied without running. Renaming an applied migration is outside this story; the epic PR must renumber the daily one past every main version before merging.
    location: >-
      supabase/migrations/20261105010000_daily_question_days_and_picks.sql
    severity: high
---

<intent-contract>

## Intent

**Problem:** Story 1's RPCs accept any `picked_at` and ignore `reported_at`: a pick is never dated by the instant it was made, nothing stops a back- or forward-dated pick, no user's zone is stored for later epics, and a Daily view left open past midnight sends yesterday's pick (epic R7, R9; spine AD-2, AD-3, AD-6, AD-8, AD-12).

**Approach:** One new migration adds `user_time_zones` and two internal functions taking `at` (AD-8): `record_user_time_zone`, which `get_daily_day` calls, and `record_daily_pick`, which `submit_daily_pick` becomes a thin wrapper over, adding the window and date checks with their own SQLSTATEs. The client refuses a pick whose device date is not the shown day and re-fetches; `formatDateKey` leaves `calendarHelpers.ts` first.

## Boundaries & Constraints

**Always:**
- `user_time_zones (user_id uuid pk → public.users(id) on delete cascade, time_zone text not null, utc_offset_minutes integer not null, effective_zone text not null, reported_at timestamptz not null)`; RLS on in the creating migration, no policies, `revoke all … from anon, authenticated` (service_role keeps its defaults for epics 7/8).
- `record_user_time_zone(viewer, time_zone, utc_offset_minutes, reported_at, at)`: writes nothing when `viewer` or `reported_at` is null; clamps a `reported_at > at + interval '5 minutes'` to `at`; upserts, updating only when the stored `reported_at` is older than the (clamped) new one. Stores `coalesce(time_zone,'')`, `coalesce(utc_offset_minutes,0)` and `effective_zone(time_zone, utc_offset_minutes)` (raw args), as picks do. `get_daily_day` calls it with `auth.uid()` and `now()` right after its auth check, before the unlinked return. Nothing else writes the table.
- `record_daily_pick(viewer, day_id, choice, picked_at, time_zone, utc_offset_minutes, at)` holds story 1's submit body, in this order: `22023` choice / null `picked_at` checks; pair lookup from `public.users.partner_id` of `viewer` (what `get_my_partner_id()` reads for `auth.uid()`) and `for update` lock, else `P0002 'Day not found'`; an existing own pick returns the snapshot unchanged (idempotence before the new checks); `picked_at < created_at - 5 min` or `> at + 5 min` → SQLSTATE `DQ002`; `(picked_at at time zone effective_zone(time_zone, offset))::date <> day` → SQLSTATE `DQ001`; insert; return `daily_day_snapshot(day, viewer, at)`.
- `submit_daily_pick` keeps its signature and grants (`create or replace`), raises `Authentication required` on a null uid, and returns `record_daily_pick(auth.uid(), …, now())`. `get_daily_day` keeps signature and grants.
- Both internal functions: `security invoker`, `set search_path = ''`, `revoke execute … from public, anon, authenticated`, `grant … to service_role`. FN-GRANT-008 stays exactly as it is.
- Types only via `npm run db:types` on a stack reset to this branch. New migration only; never edit an applied one.
- Client: the slice takes `pickedAt = new Date()` once, refuses when `formatDateISO(pickedAt) !== snapshot.day` (no RPC), starts `loadDailyDay()` and throws `AccountDataError('day-changed', DAY_CHANGED_MESSAGE)`; it passes `pickedAt` to the API. The API maps a PostgREST `DQ001` to the same error; the slice re-fetches on it too (session check first). Every other failure keeps story 12's path.
- The view shows `DAY_CHANGED_MESSAGE` above the card (`data-testid="daily-day-changed"`, `role="status"`), not in the card, since a new `day_id` remounts the card; it clears at the next Send and on an account change, lint-clean (no disabling a rule).

**Never:** a local copy, the pick queue, Realtime, the write prompt, dock or `/mood` work (stories 3–9); reading `user_time_zones` anywhere; a new client RPC or FN-GRANT-008 change; editing `20261105010000_…sql` or another applied migration; an automatic midnight re-fetch; changing `DailyMessage/` or `messagesSlice`; a second `YYYY-MM-DD` formatter.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Late pick | day 2030-06-20 (NY); picked 23:50 NY, `at` 00:10 next day | stored on that day; snapshot `day` 2030-06-20 | — |
| An hour apart | A NY, B Chicago, each 23:30 local on day d | both rows on d's `day_id`; B `is_second` | — |
| Picked after midnight | B picks 00:10 NY on the 21st for the 20th | nothing written | `DQ001` |
| Ahead | `picked_at = at + 6 min` (also via client RPC, `now()+6 min`) | nothing written | `DQ002` |
| Before the day | `picked_at = created_at - 6 min` | nothing written | `DQ002` |
| Edge of window | `at + 4 min`, date matches | stored | — |
| Repeat out of window | own pick exists, new `picked_at` far off | stored pick returned | — |
| Zone write | first fetch / older / newer / `reported_at` > now()+5 min | inserted / unchanged / updated / stored as now() | — |
| Pick and zone | a pick with another zone | `user_time_zones` unchanged | — |
| Device date ≠ day | shown day 2026-11-05, device 2026-11-06 00:01 | no RPC, re-fetch, notice | `day-changed` |
| Server `DQ001` | RPC answers DQ001 | re-fetch, notice | `day-changed` |

</intent-contract>

## Code Map

- `supabase/migrations/20261105010000_daily_question_days_and_picks.sql:454-594` -- story 1's `get_daily_day` / `submit_daily_pick` bodies to move and wrap; `:173-216` `effective_zone`; `:320-449` gate and snapshot signatures (`daily_day_snapshot(day_id, viewer, at)`). Read-only. Header comment style to copy.
- `supabase/migrations/20260205000001_fix_users_rls_recursion.sql:13-21` -- `get_my_partner_id()` = `select partner_id from public.users where id = auth.uid()`.
- `supabase/tests/database/40_daily_question_gate.sql` -- `plan(100)`; DAILY-012/013 list the four internal functions (extend to six, update counts and labels); `:558-580` day-2 picks call `submit_daily_pick` with `now()` on tomorrow's date, which the date check refuses: move them to `record_daily_pick` as postgres with instants on day 2 in their zones (A: `Nowhere/Land`, 330; B: null zone and offset) so DAILY-069..073 keep asserting the same values. DAILY-063's repeat stays valid (idempotence first).
- `supabase/tests/database/38_countdown_marks.sql:1-50`, `40_…:26-79` -- header, inline helpers (`create_test_user` writes `public.users`, `authenticate_as`), pair setup, own three coach rows.
- `src/utils/calendarHelpers.ts:101-117` `formatDateKey` == `src/utils/dateUtils.ts:150` `formatDateISO`; sole importer `src/components/MoodHistory/MoodHistoryCalendar.tsx:8,352`.
- `src/api/dailyQuestionApi.ts:78-110` submit; `src/api/errorHandlers.ts:119` `isPostgrestError`; `src/services/accountDataError.ts:16-21` `AccountDataErrorCode`.
- `src/stores/slices/dailyQuestionSlice.ts:105-121` submit; `src/components/DailyQuestion/DailyQuestion.tsx:46-70` `DayCard.send`, `:149-200` parent.
- `tests/unit/stores/dailyQuestionFixture.ts` -- fixture `day: '2026-11-05'`; slice/component tests asserting `toHaveBeenCalledWith(DAY_ID, 'this')` must fake `Date` only (`vi.useFakeTimers({ toFake: ['Date'] })`, AGENTS user-event note) at a local-time instant on that day, e.g. `new Date(2026, 10, 5, 12)`, and expect the `Date` third argument.
- Hosted catalog checked read-only 2026-11-06: no `user_time_zones`, `record_daily_pick`, `record_user_time_zone`, `get_daily_day` or `submit_daily_pick` there.

## Tasks & Acceptance

**Execution:**
- [ ] `src/utils/calendarHelpers.ts`, `src/components/MoodHistory/MoodHistoryCalendar.tsx` -- delete `formatDateKey`; the calendar uses `formatDateISO` from `dateUtils` (first, as its own refactor commit).
- [ ] `supabase/migrations/20261105210000_daily_question_own_clocks.sql` -- table, two internal functions, both RPCs replaced; header states the rules, the two SQLSTATEs and the pgTAP files.
- [ ] `supabase/tests/database/41_daily_question_own_clocks.sql` -- every matrix server row with fixed instants (dates in 2030, `couple_days.created_at` set by update), plus: table exists, RLS on, `policies_are` empty, no anon/authenticated privilege; internal functions denied to anon/authenticated and granted to service_role; client-RPC `DQ002` for `now() + 6 min` and `DQ001` for a day fetched in `Pacific/Kiritimati` and picked in `Pacific/Pago_Pago` (25 h apart, always another date).
- [ ] `supabase/tests/database/40_daily_question_gate.sql` -- DAILY-012/013 to six functions; day-2 picks through `record_daily_pick`; header mentions it.
- [ ] `src/types/database.types.ts` -- `supabase db reset` then `npm run db:types`.
- [ ] `src/services/accountDataError.ts` -- add `'day-changed'`.
- [ ] `src/api/dailyQuestionApi.ts` -- export `DAY_CHANGED_MESSAGE` ("The date has changed since this question was shown. Check today's question and pick again."); map `DQ001`.
- [ ] `src/stores/slices/dailyQuestionSlice.ts`, `src/components/DailyQuestion/DailyQuestion.tsx` -- device-date refusal, re-fetch, notice.
- [ ] `src/api/__tests__/dailyQuestionApi.test.ts`, `tests/unit/stores/dailyQuestionSlice.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` -- `DQ001` mapping (and `DQ002` staying a transport error); refusal before any RPC with a re-fetch; `DQ001` re-fetch; session change discards the re-fetch; notice shown over a new day's question and cleared on the next Send; existing tests moved onto a faked same-day `Date`.

**Acceptance Criteria:**
- Given a fresh local stack on this branch, when `supabase test db` runs, then every file passes, including the late-pick, hour-apart and `DQ002` cases of `41_…sql`.
- Given the stack reset to this branch, when `npm run db:types` runs, then `git diff --exit-code src/types/database.types.ts` is clean.
- Given a linked pair on a local stack, when `tests/e2e/daily/` runs, then story 12's pick-and-reveal spec still passes.
- Given the repo, when `grep -rn formatDateKey src tests` runs, then nothing is found.

## Implementation Notes

- Refactor first, as its own commit (`1a81d3ba`): `formatDateKey` is deleted and `MoodHistoryCalendar` uses the identical `formatDateISO`; `grep -rn formatDateKey src tests` finds nothing.
- Migration `20261105210000_daily_question_own_clocks.sql` as planned; version chosen past every migration on `origin/main` (latest `20261105020000`).
- `41_daily_question_own_clocks.sql` holds 48 assertions (CLOCK-001..048); the gate file keeps `plan(100)`.
- The view keys the day-changed notice by `userId:authSessionVersion` in state, so an account change hides it without an effect resetting state (lint-clean).
- The implementing subagent ran its checks on an isolated stack copy; the parent re-ran every Verification command on the shared stack (this run has one worktree), then reset it to this branch.

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 26 findings — high 0, medium 2, low 11, false 13, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) a DQ002 refusal shows `[DailyQuestionApi.submitDailyPick] Database error: Pick time outside the allowed window`, coded `transport` — real, but the failure is shown (R7) and it needs a phone clock more than 5 minutes off (phones set the time automatically); a proper fix adds a member to the shared `AccountDataErrorCode` union and a message, which is new surface for a rare case.
  - `[low]` `[patch]` (blind) a server DQ001 is the only submit failure that logs nothing — the DQ001 branch now calls `logSupabaseError(SUBMIT_CONTEXT, error)` first; the API test asserts the log with `toHaveBeenCalledWith`.
  - `[low]` `[reject]` (blind) a re-read that returns the same day keeps refusing and the notice says the date changed — needs the device clock and the server's to disagree across a midnight (seconds with automatic time); AD-2 trusts the phone's clock (Design Notes), and a fix adds a skew branch and new copy.
  - `[low]` `[reject]` (blind) a failed re-read leaves the notice above the old question beside the load error — needs the re-read to fail in the seconds after midnight; the load error and Retry say what happened and Retry shows the new day; the fix adds a branch.
  - `[low]` `[patch]` (blind) an offline Send does not clear the notice, though the plan says it clears at the next Send — `onSendStart()` now runs before the offline check; a component test shows the notice gone and the offline message shown.
  - `[false]` `[reject]` (blind) nothing re-reads at midnight while the view is open — the intent asks the client to refuse at Send and re-fetch (spine AD-12), which it does; a view left open past midnight is exactly the refused case, and choosing the shown day by device date is story 5's.
  - `[medium]` `[patch]` (blind) CLOCK-036 counts every `user_time_zones` row, so it fails on any stack where the app or E2E already called `get_daily_day` — the count is scoped to the file's own users; `supabase test db` passed on a stack holding 2 rows from the E2E run.
  - `[false]` `[reject]` (blind) `user_time_zones` orders reports by the device's `reported_at` with no lower bound — that is the rule the intent and AD-3 state: written when `reported_at` is newer, a report beyond now() + 5 min clamped to now().
  - `[low]` `[reject]` (blind) no Playwright test drives the day-changed path — the ticket's verify is pgTAP and types; the component tests run the real slice with a faked `Date`, and the server half is CLOCK-044..048; an E2E would install a page clock a day behind, a new spec rather than a direct correction.
  - `[low]` `[patch]` (blind) the `submitDailyPick` doc reads as if `day-changed` is thrown with no day shown — reworded into one clause per throw case.
  - `[low]` `[reject]` (blind) the gate file's day-2 picks no longer go through `submit_daily_pick` — the date check refuses a pick made now on tomorrow's date, and `now()` cannot be moved; `submit_daily_pick` is a pass-through to `record_daily_pick` at `now()`, whose client path CLOCK-044..048 cover, and day-1 picks in the gate file still go through it.
  - `[low]` `[reject]` (edge) a device clock behind the server near midnight refuses every Send — same claim as the blind same-day re-read row, rejected for the same reason.
  - `[low]` `[reject]` (edge) after a same-day re-read the old selection stays armed — same root and reason as the row above.
  - `[low]` `[reject]` (edge) DQ002 shows the raw database string — same claim as the blind DQ002 row, rejected for the same reason.
  - `[false]` `[reject]` (edge) a far-past `reported_at` is stored and blocks a lagging device — same refutation as the blind ordering row: the intent's rule.
  - `[medium]` `[patch]` (edge) CLOCK-036 fails on a non-fresh stack — same entry and fix as the blind row.
  - `[false]` `[reject]` (intent) the late pick is proven on `record_daily_pick`, not the client RPC — the verify asks for fixed instants, which only an internal function taking `at` allows (AD-8); `submit_daily_pick` passes its arguments and `now()` through unchanged.
  - `[false]` `[reject]` (intent) partners an hour apart are proven on a pre-created day row, not their fetches — the verify asks that both picks land on one date, which CLOCK-014..016 show; a fetch's date in each zone is story 1's DAILY-083/084, and `get_daily_day` reads `now()`.
  - `[false]` `[reject]` (intent) a repeat of a stored pick bypasses the window and date checks — AD-6: a repeat returns the stored pick and never updates it; story 7's retries depend on it.
  - `[false]` `[reject]` (intent) service_role keeps privileges on `user_time_zones` and EXECUTE on its writer — AD-15 forbids only anon and authenticated, and epics 7 and 8 read the table as service_role; no client path writes it but `get_daily_day`.
  - `[false]` `[reject]` (intent) DQ002 gets no client handling — it shows as the send error, which R7 asks for; the wording is the low row above.
  - `[false]` `[reject]` (intent) the gate file's day-2 assertions moved surface — same as the blind row; nothing those assertions check depends on the wrapper.
  - `[false]` `[reject]` (intent) the device-date refusal has no E2E — the verify does not ask for one; component and slice tests cover it.
  - `[false]` `[reject]` (intent) the types were not checked against `npm run db:types` — the parent ran `npm run db:types` on a stack reset to this branch twice; both outputs were byte-identical to the committed file.
  - `[false]` `[reject]` (intent) a selection made at 23:50 and sent at 00:10 is refused on the client — that is the intent's rule ("the client refuses a pick when the device date is not the shown day"); the late-pick rule serves story 7's queue, whose `picked_at` is the instant the pick was made.
  - `[false]` `[reject]` (intent) the day-changed notice is not named in the intent — a refusal must tell the user why nothing was sent; it adds no behaviour beyond the refusal and re-fetch.

## Design Notes

- Why internal functions: AD-8 — pgTAP cannot move `now()`, and "submitted at 12:10 AM" needs `at`. Inside a pgTAP transaction `now()` is constant, so the zone clamp is also checked through `get_daily_day` itself.
- Idempotence before the checks: a story-7 retry of a stored pick must get the stored pick back, never a refusal.
- `DQ001`/`DQ002`: custom SQLSTATEs (class `DQ` is unused by Postgres); PostgREST answers 400 with `code` set.
- A device clock far from the server's keeps refusing near midnight; AD-2 trusts the phone's clock, accepted.
- `formatDateKey` and `formatDateISO` are byte-identical; consolidating avoids a second formatter.

## Verification

**Commands:**
- `supabase db reset` (CLI 2.122.0 from `.mise.toml`) -- expected: every migration applies.
- `supabase test db` -- expected: all files pass.
- `npm run db:types && git diff --exit-code src/types/database.types.ts` -- expected: no diff after the committed regeneration.
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`.
- `npm run lint` -- expected: exit 0.
- `npx vitest run src/api/__tests__/dailyQuestionApi.test.ts tests/unit/stores/dailyQuestionSlice.test.ts src/components/DailyQuestion` then `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/daily/ --project=chromium` -- expected: passes.

## Auto Run Result

Status: built

**Summary:** Each partner's pick is now dated by their own clock. `submit_daily_pick` is a thin wrapper over the new internal `record_daily_pick(viewer, …, at)`. That function dates a pick by `picked_at` in the zone sent with it, refuses a date that is not the day's with SQLSTATE `DQ001`, and refuses a `picked_at` outside `created_at − 5 min … at + 5 min` with `DQ002`. A repeat of a stored pick still comes back unchanged. `get_daily_day` records the caller's zone in the new `user_time_zones` table through `record_user_time_zone`: newer reports only, a report more than 5 minutes ahead clamped to now(). On the client, Send refuses a pick whose device date is not the shown day (and a server `DQ001`), re-reads the day, and shows a notice above the card. `formatDateKey` left `calendarHelpers.ts` first, in its own commit.

**Files changed:**
- `src/utils/calendarHelpers.ts`, `src/components/MoodHistory/MoodHistoryCalendar.tsx`: `formatDateKey` deleted; the calendar uses the identical `formatDateISO` (commit `1a81d3ba`).
- `supabase/migrations/20261105210000_daily_question_own_clocks.sql`: `user_time_zones` (RLS on, no policy, nothing for anon or authenticated), the two internal functions, and both client RPCs replaced with the same signatures and grants.
- `supabase/tests/database/41_daily_question_own_clocks.sql`: 48 assertions with fixed 2030 instants (late pick, an hour apart, DQ001, DQ002, the window's edges, idempotent repeats, the zone writes and clamp, grants), plus DQ002 and DQ001 through `submit_daily_pick`.
- `supabase/tests/database/40_daily_question_gate.sql`: six internal functions in DAILY-012/013; the day-2 picks go through `record_daily_pick`.
- `src/types/database.types.ts`: regenerated with `npm run db:types` (the new table and two functions).
- `src/services/accountDataError.ts`: `'day-changed'` code.
- `src/api/dailyQuestionApi.ts`: `DAY_CHANGED_MESSAGE`; a `DQ001` is logged and mapped to `day-changed`.
- `src/stores/slices/dailyQuestionSlice.ts`: the device-date refusal with a re-read, and the re-read on a server `day-changed` under the session check.
- `src/components/DailyQuestion/DailyQuestion.tsx`: the `daily-day-changed` notice above the card, cleared at the next Send (offline too) and on an account change.
- `src/api/__tests__/dailyQuestionApi.test.ts`, `tests/unit/stores/dailyQuestionSlice.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx`: the new cases; existing ones moved onto a faked same-day `Date`.

**Review findings:** 26 findings: high 0, medium 2, low 11, false 13.
- **Patched (4 entries):**
  - CLOCK-036's global count, medium, reported by blind and edge;
  - the unlogged DQ001, low;
  - the notice not cleared by an offline Send, low;
  - the `submitDailyPick` doc comment, low.
- **Deferred:** none from review. The plan's earlier `deferred` item stands: the migration-version collision at `20261105010000` with `origin/main`.
- **Rejected low:**
  - The DQ002 wording (blind, edge): the failure shows, it needs a clock more than 5 minutes off, and the fix adds an error code.
  - A same-day re-read after clock skew (blind, edge ×2): seconds-wide at midnight, and AD-2 trusts the phone clock.
  - A failed re-read at midnight: Retry recovers, and the fix adds a branch.
  - No Playwright spec for the refusal: the verify does not ask for one, the component tests cover it, and a spec is not a direct correction.
  - The gate file's day-2 picks moving to the internal function: `now()` cannot be moved, and CLOCK-044 to 048 cover the client path.
- **Rejected false:**
  - No midnight re-fetch: the intent's rule is refuse-at-Send.
  - Ordering by device `reported_at` (blind, edge): this is the intent's own rule.
  - The internal-function proofs: AD-8.
  - The hour-apart proof on a pre-created row: the verify asks only that both picks land on one date.
  - The idempotent repeat: AD-6.
  - service_role access: AD-15 forbids only anon and authenticated.
  - DQ002 handling: the failure is shown.
  - The day-2 surface.
  - No E2E: not asked by the verify.
  - The types: checked twice with `npm run db:types`.
  - Selecting at 23:50 and sending at 00:10: the intent's rule.
  - The notice: part of the refusal.

**Follow-up review recommended: false.** First pass; patched entries by verdict: high 0, medium 1, low 3.

**Verification (after the patches):**
- `supabase db reset` applied every migration, and `supabase test db` passed 28 files and 748 tests. It passed again on a stack holding `user_time_zones` rows left by the E2E run, which is the case the CLOCK-036 patch fixed.
- `npm run db:types` ran twice on the stack reset to this branch; both outputs were byte-identical to the committed file.
- `npm run typecheck` reported no errors besides the worktree's known TS2883.
- `npm run lint` exited 0.
- `npm run test:unit` passed 230 files and 4259 tests.
- `npx playwright test tests/e2e/daily/ --project=chromium` passed, and the row audit found no leftover rows.
- `grep -rn formatDateKey src tests` found nothing.
- The local stack was reset to this branch afterwards.

**Residual risks:**
- A phone clock off from the server's by more than 5 minutes sees a technical DQ002 message on Send. A clock skewed across midnight keeps being refused until it agrees with the server.
- Nothing reads `user_time_zones` until epics 7 and 8. Its rows trust each device's `reported_at` within the 5-minute clamp, as AD-3 states.
- The late-pick rule is reachable from the client only once story 7's queue sends a stored `picked_at`. Today Send dates the pick at the press.
- Before the epic merges, `20261105010000` must be renumbered past every version on main (`deferred`).
