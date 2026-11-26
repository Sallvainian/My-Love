---
title: 'Picks push the partner and both answered'
type: feature
ticket: '6'
created: '2026-11-26'
status: done
baseline_revision: '5d40755afea59ba8192be379a517fc576e13f8d8'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md'
warnings: [oversized]
deferred:
  - summary: >-
      tests/api/push-daily-picks.spec.ts fixes today, yesterday and two days ago from the host clock when it seeds the pair, so a run that crosses host-local midnight between the seed and a pick fails spuriously.
    evidence: |-
      The spec computes `today` with isoDateDaysFromNow(0, now) before seedPairDays, then submits today's pick with picked_at = new Date() for dayIds[today]; after midnight record_daily_pick refuses it with DQ001 (pick date is not the day's date), and user_local_date would also move the recipient's date so the on-date partner-picked push is dropped. The same low flake story 8.3 deferred for push-daily-sender.spec.ts. Real low flake, deferred because a run must straddle local midnight within seconds; the fix is a guard (skip within a few minutes of local midnight) shared by both specs.
    location: >-
      tests/api/push-daily-picks.spec.ts seed and submitPick
    severity: low
---

<intent-contract>

## Intent

**Problem:** `send-push` already knows `daily_partner_picked` and `daily_both_answered` (story 8.3), but nothing posts them, so no pick ever pushes the partner (R1, R4).

**Approach:** One migration adds the two AFTER INSERT triggers on `daily_picks` from spine AD-10, `when (not new.is_second)` posting `notify_push('daily_partner_picked')` and `when (new.is_second)` posting `notify_push('daily_both_answered')`; the sender's existing drop rule and late wording do the rest.

## Boundaries & Constraints

**Always:**
- Trigger names `daily_picks_push_partner_picked_after_insert` and `daily_picks_push_both_answered_after_insert`, `after insert … for each row`, each preceded by `drop trigger if exists` (as `20261126000000_daily_reminders_schedule.sql` does).
- Reuse `public.notify_push()` unchanged; its body is `{kind, id}` only, so no choice is posted (R1).
- Update the comments on `public.notify_push()`, `public.push_sender_settings` and `public.daily_picks` to name the new triggers; the migration header records the hosted catalog read and the deploy order (sender shipped a deploy earlier).
- The new api spec uses throwaway accounts only and picks through the client RPC `submit_daily_pick` as each party, so the real write path fires the triggers.
- Keep every check story 8.3's pick-kinds case made; where the seed now posts by itself, wait for the trigger's records and assert the hand post as a replay (`skipped`), as story 8.5 did for reminders.

**Never:**
- No change to `send-push` code or `record_daily_pick`/`submit_daily_pick`; no `is_second` check in the sender (DW-525 stays open; the WHEN pins guard it).
- No trigger on `daily_nudges`, no `send_daily_nudge`, no snapshot `nudge` (8.7); no client code (8.8, 8.9).
- No change to `src/services/dateReminders.ts`; no edit to `src/types/database.types.ts` (triggers do not change the types).
- No edit to existing pgTAP expected values; new assertions go in a new file.
- Never touch a pool pair's `couple_days` or picks in an api spec.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First pick, on date | Alice picks today, Bob has 2 devices | one queued `{kind:'daily_partner_picked', id}`; 2 records for Bob, `{Alice} made their pick`, no `choice`, no sound | `notify_push` swallows |
| Second pick, on date | Bob picks today after Alice | one queued `{kind:'daily_both_answered', id}`; 1 record for Alice, title by `run` | — |
| Retried pick | `submit_daily_pick` again for a stored pick | no insert, nothing queued, records unchanged | — |
| Late first pick | pick for a past date (day `created_at` backdated) | trigger posts; sender drops it: 0 records | — |
| Late second pick | second pick for a past date | 1 record for the first picker, "That day counts." in place of "See {Partner}'s pick." | — |
| Switch off | first picker's `daily_both_answered = false` | 0 records for that pick | — |
| No settings row | `push_sender_settings` empty | pick lands, nothing queued | — |

</intent-contract>

## Code Map

- `supabase/migrations/20261126000000_daily_reminders_schedule.sql:167-201` -- the trigger, `drop trigger if exists` and comment template to copy; its `notify_push` and `push_sender_settings` comments are the current text to extend with `daily_picks`.
- `supabase/migrations/20261031020000_push_moods_photos_interactions.sql:83` -- `notify_push()` (security definer, posts `{kind: tg_argv[0], id: new.id}` via `net.http_post`, returns early with no settings row); reuse, do not redefine.
- `supabase/migrations/20261105030000_daily_question_days_and_picks.sql:127-148` -- `daily_picks` (`is_second boolean not null`, unique `(day_id, user_id)`) and its table comment to extend.
- `supabase/migrations/20261105210000_daily_question_own_clocks.sql:138` -- `record_daily_pick`: a stored pick returns before any insert (retry posts nothing); `picked_at` must be `>= couple_days.created_at - 5 min`, `<= now() + 5 min`, and on the day's date in the zone sent; `submit_daily_pick(day_id, choice, picked_at, time_zone, utc_offset_minutes)` is its client RPC.
- `supabase/functions/send-push/handler.ts:415-445` -- `resolveSource` pick branch: recipient is the other seat of the day, `onDate` from `user_local_date`, late `daily_partner_picked` → `buildPayload: null` (200, all zero), late both-answered wording. Header lines 18-22 say nothing posts the daily kinds yet: update that sentence only (reminders post since 8.5, picks since 8.6, the nudge in 8.7).
- `supabase/migrations/20261107010000_couple_streak.sql` -- `run` = done dates after the newest missed date; a date with a row and no picks, once closed, is missed.
- `supabase/tests/database/48_daily_reminders.sql` -- template: inline `tests.create_test_user`, `t_users`, `pg_temp.u`, `pg_temp.link`, `pg_temp.day`, `push_sender_settings` reset, `pg_get_triggerdef` regex pins (DAILY-REM-007 to 009), queue bodies read from `net.http_request_queue` joined on `body->>'id'`.
- `tests/api/push-daily-sender.spec.ts` -- story 8.3's spec. `setUpPair` seeds with `seedPairDays` (one psql transaction: days 4, 3, 2 both, yesterday absent, today Alice only, host-zone `user_time_zones`), which now posts every seeded pick. Its pick-kinds case posts by hand and must change; its reminder/nudge case reads by reminder and nudge ids only and stays.
- `tests/support/helpers/push-requests.ts` -- `createParty`, `registerDevice`, `link`, `awaitRequests`, `requestsFor`, `postToSender`, `dailyPayload`, `Party` (has `client`, `userId`, `name`); add the new spec to the module comment's list.
- `tests/support/factories/daily-question.ts` -- `seedPairDays(admin, pair, [{daysAgo, picks: 'none'}…])` creates days with `created_at` at the date's host-zone noon (today: `now()`) and the host-zone rows, with no picks; `readPairQuestionsByDay`.
- `tests/support/helpers/events.ts` -- `isoDateDaysFromNow(n, now)` (host-local date).
- Hosted catalog: story 8.5's read-only read on 2026-11-26 found no trigger on `daily_picks`; nothing hosted-only to drop.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261126010000_daily_pick_pushes.sql` -- the two triggers and the three comments, in `begin … commit` -- the pick pushes (AD-10).
- [x] `supabase/tests/database/49_daily_pick_pushes.sql` -- `daily_picks` carries exactly the two `notify_push` triggers, AFTER INSERT FOR EACH ROW, enabled (`tgtype` 5); each `pg_get_triggerdef` pins its WHEN and kind; a first pick queues one `daily_partner_picked` body and a second one `daily_both_answered` body, each with exactly the keys `kind` and `id` (no `choice`), to the sender URL with the secret; a repeat `record_daily_pick` for a stored pick queues nothing more; with no settings row a pick queues nothing -- SQL proof of the WHEN clauses.
- [x] `tests/api/push-daily-picks.spec.ts` -- new spec per Design Notes -- the Playwright api check.
- [x] `tests/api/push-daily-sender.spec.ts` -- pick-kinds case: wait for the seed's records (today's first pick: Bob's 2 devices, partner-picked copy, no `choice`; then hand post `skipped: 2`); late first pick: hand post `zeros`, no records; late second pick (two days ago): wait for 1 record before Bob's today pick, run-0 late copy (`You both answered` / `That day counts.`), hand post `skipped: 1`; Bob's today pick (psql insert): wait for 1 record, `1 day in a row` / `You both answered. See {Bob}'s pick.`, hand post `skipped: 1`. Header comment: picks post through their triggers (8.6); only the nudge is still posted by hand -- keeps story 8.3's checks true.
- [x] `tests/support/helpers/push-requests.ts` -- module comment names the new spec -- accuracy.
- [x] `supabase/functions/send-push/handler.ts` -- header sentence only -- accuracy.

**Acceptance Criteria:**
- Given the migration applied, when `supabase test db` runs, then every file passes, `49_daily_pick_pushes.sql` included.
- Given the edge runtime serving `send-push`, when the four daily/partner push api specs and the new one run, then all pass and the row audit reports no leftover rows.
- Given the change, when `npm run db:types` runs on the migrated stack, then `src/types/database.types.ts` has no diff.

## Implementation Notes

- Files: `supabase/migrations/20261126010000_daily_pick_pushes.sql`, `supabase/tests/database/49_daily_pick_pushes.sql` (14 assertions), `tests/api/push-daily-picks.spec.ts`, `tests/api/push-daily-sender.spec.ts`, `tests/support/helpers/push-requests.ts` (comment), `supabase/functions/send-push/handler.ts` (header comment). `src/types/database.types.ts` unchanged.
- Story 8.3's pick-kinds case narrows one check: its late second pick (two days ago) was hand-posted after Bob's today pick and asserted `1 day in a row` / `You both answered. That day counts.`; the seed now posts it itself while today holds Alice's pick only, so it is awaited before Bob's today pick and asserts the run-0 late copy (`You both answered` / `That day counts.`). The run-1 late copy is now asserted through the real trigger in `push-daily-picks.spec.ts` step 1. Every other check stays, each hand post now a replay (`skipped`).
- The migration is applied to the shared local stack with `supabase migration up` (no reset).
- Verified 2026-11-26 (parent session, after the subagent): `supabase test db` 36 files / 1107 tests PASS; the five push api specs 18 passed with `supabase functions serve` (stopped afterwards), row audit clean; `npm run db:types` no diff; `npm run typecheck`, `npm run lint` clean; `deno test --no-lock supabase/functions/send-push/` 123 passed.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` (quick) The api spec's "the retry posted nothing" check cannot fail, since the sender would skip a replayed `{kind, id}`; only pgTAP DAILY-PICK-010 proves no call is queued — real: the assertion shows "no further record", not "no post". Fixed: the comment now says the check shows the retry recorded nothing more and that DAILY-PICK-010 in `49_daily_pick_pushes.sql` pins the queue side; the assertion is unchanged.
  - `[low]` `[patch]` (quick) The all-zero answer and a post-assert-200 helper were copied into a third spec file, against AGENTS.md "Shared test helpers" (DW-313) — real: three `zeros` declarations and two `post` copies. Fixed: `tests/support/helpers/push-requests.ts` exports `zeros` and `postKindToSender`; `push-daily-picks.spec.ts` and `push-daily-sender.spec.ts` import both and `push-partner-activity-trigger.spec.ts` imports `zeros`, each local copy deleted, every assertion unchanged. The two `pickOf` helpers stay: they differ (single-row `.single()` versus all rows for the retry check).

## Design Notes

New spec `tests/api/push-daily-picks.spec.ts` (`[P0]`, one test, throwaway pair `dailypick`: Alice one device, Bob two; `link`; `seedPairDays` with `daysAgo` 2, 1 and 0, all `picks: 'none'`). Each pick is `party.client.rpc('submit_daily_pick', {day_id, choice, picked_at, time_zone: host zone, utc_offset_minutes: -pickedAt.getTimezoneOffset()})`; a past date's `picked_at` is `new Date(\`${iso}T12:00:00\`)` (host-local noon, matching the seeded `created_at`). The order fixes `run` (D2 stays missed until step 4):

1. Yesterday (D1): Alice picks (late first) then Bob (late second). Bob's pick → 1 record for Alice: `1 day in a row` / `You both answered. That day counts.`. Then Alice's D1 pick: `requestsFor` is `[]` and a hand post answers `zeros` (the sender's drop, deterministic whatever the timing).
2. Today: Alice picks → 2 records for Bob, `{Alice} made their pick` / `Pick yours to see what they chose.`, no `choice` in the payload string, no sound. Alice retries the same pick → the RPC succeeds and no new `daily_picks` row exists.
3. Today: Bob picks → 1 record for Alice: `2 days in a row` / `You both answered. See {Bob}'s pick.`. Alice's today pick still has exactly the 2 rows read in step 2 (the retry posted nothing).
4. Alice turns `daily_both_answered` off (admin upsert into `push_preferences`); D2: Alice then Bob pick late. A hand post of Bob's D2 pick answers `zeros`, and `requestsFor` is `[]` for both D2 picks. Last, so the switch is never turned back on while a post may be pending.

Absence is never awaited by a sleep: each "none" is the sender's own answer to a hand post of the same `{kind, id}` plus an empty `requestsFor`.

## Verification

**Commands:**
- `supabase migration up && npm run db:types && git diff --exit-code src/types/database.types.ts` -- expected: applied, no diff.
- `supabase test db` -- expected: all files pass.
- `supabase functions serve` (background, stopped afterwards) then `fnox exec -- npx playwright test --project=api tests/api/push-daily-picks.spec.ts tests/api/push-daily-sender.spec.ts tests/api/push-daily-reminders.spec.ts tests/api/push-partner-activity-trigger.spec.ts tests/api/push-love-note-trigger.spec.ts` -- expected: all pass, row audit clean.
- `npm run typecheck && npm run lint` -- expected: pass.
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass (comment-only change).

## Auto Run Result

- **Summary:** Two AFTER INSERT triggers on `daily_picks` from spine AD-10 now post a pick to `send-push` through the existing `notify_push`. `daily_picks_push_partner_picked_after_insert` (`when (not new.is_second)`) posts `daily_partner_picked`. `daily_picks_push_both_answered_after_insert` (`when (new.is_second)`) posts `daily_both_answered`. The body is `{kind, id}` only, so no choice is posted (R1). Story 8.3's sender does the rest: it drops a late first pick, words a late second pick "That day counts.", and honours each switch (R4). A retried pick inserts no row, so it posts nothing. No client code changed, and neither did `send-push` code, the generated types or `dateReminders.ts`.
- **Files changed:**
  - `supabase/migrations/20261126010000_daily_pick_pushes.sql`: the two triggers, plus the comments on `daily_picks`, `notify_push()` and `push_sender_settings`.
  - `supabase/tests/database/49_daily_pick_pushes.sql`: 14 assertions covering:
    - the exact trigger set, with each WHEN and kind;
    - the queued bodies, holding only `kind` and `id`, sent to the sender URL with the secret;
    - a retry, which queues nothing;
    - no settings row, which queues nothing.
  - `tests/api/push-daily-picks.spec.ts`: a new api spec on a throwaway pair through `submit_daily_pick`. It covers a late first and a late second pick, a first pick with no choice and no sound, a retry, a second pick with the run, and a switched-off kind.
  - `tests/api/push-daily-sender.spec.ts`: the pick-kinds case waits for the seed's own records and asserts hand posts as replays. The late second pick now checks the run-0 copy, because the seed posts it while today holds one pick (see Implementation Notes).
  - `tests/support/helpers/push-requests.ts`: the shared `zeros` and `postKindToSender`, and the module comment.
  - `tests/api/push-partner-activity-trigger.spec.ts`: imports the shared `zeros`.
  - `supabase/functions/send-push/handler.ts`: one header sentence only.
- **Review findings:** 2 findings: high 0, medium 0, low 2, false 0.
  - **Patched:** 2 low:
    - the retry comment, reworded;
    - the shared `zeros` and post helper.
  - **Deferred:** none from review. One residual risk is filed in `deferred` (below).
  - **Rejected:** none.
- **Follow-up review recommendation:** `false`. This first pass patched 0 high and 0 medium entries.
- **Verification (2026-11-26, after the patches):**
  - `supabase migration up`: applied to the shared stack, with no reset.
  - `npm run db:types`: no diff.
  - `supabase test db`: 36 files, 1107 tests, PASS.
  - The five push api specs: 18 passed with `supabase functions serve` running (stopped afterwards). The row audit reported no leftover rows.
  - `npm run typecheck` and `npm run lint`: clean.
  - `deno test --no-lock supabase/functions/send-push/`: 123 passed.
- **Residual risks:**
  - On hosted, the triggers depend on the sender deployed by the first loop run's PR, which already accepts both kinds (`POSTED_KINDS`, story 8.3). `deploy.yml` applies the migration before it redeploys the functions, so the order holds.
  - DW-525 stays open: the sender does not check `is_second` against the posted kind. DAILY-PICK-001 to 003 now pin the WHEN clauses that make the gap unreachable.
  - The new spec's run crossing host-local midnight is filed in `deferred`.
