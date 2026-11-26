---
title: 'The 8 AM and 8 PM pushes are scheduled on each person''s clock'
type: feature
ticket: '5'
created: '2026-11-26'
status: done
baseline_revision: '78f57fa1702de9410726953d0e0589383e854745'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md'
warnings: [oversized]
deferred:
  - summary: >-
      The live daily-reminders cron job (every 5 minutes on real time) can act on api-spec accounts during a host-zone 08:00-08:30 or 20:00-20:30 window, so a tick that lands mid-spec makes push-daily-sender.spec.ts's hand-inserted reminder hit the (user_id, local_date, slot) key or adds daily records to push-partner-activity-trigger.spec.ts's by-token count of six.
    evidence: |-
      push-daily-sender.spec.ts setUpPair links a throwaway pair both ways, registers devices and seedPairDays writes a host-zone user_time_zones row, so enqueue_daily_reminders(now()) treats it as due; addReminder then asserts a null insert error (tests/api/push-daily-sender.spec.ts addReminder). push-partner-activity-trigger.spec.ts reads push_requests by token and expects toHaveLength(6) while the pool pair (linked, a stored zone from get_daily_day) holds devices. 35_push_devices.sql's unscoped net.http_request_queue counts are exposed the same way to a committed cron insert. Needs a tick inside a window during the few seconds a spec holds that state (about 0.1-0.2% of runs). Real low flake, deferred because developers are unlikely to meet it (review 2026-11-26: blind-hunter, edge-case-hunter, verification-gap). Fix: pause the job around the api leg or clear a cron-made row for (user, today, slot) before the spec inserts.
    location: >-
      tests/api/push-daily-sender.spec.ts addReminder; tests/api/push-partner-activity-trigger.spec.ts by-token count; supabase/migrations/20261126000000_daily_reminders_schedule.sql daily-reminders job
    severity: low
  - summary: >-
      For partners on clocks four or more hours apart, the 8 PM evening_partner push can tell the earlier partner to nudge about a date the later partner can no longer pick, because the later partner's date has already moved on.
    evidence: |-
      enqueue_daily_reminders checks picks on the couple day for the recipient's own local date; record_daily_pick refuses a pick whose local date is not the day, and AD-17 refuses a nudge unless the day is the recipient's current date, so "Nudge them before midnight." asks for something neither partner can do. The intent and AD-9 state the evening_partner rule literally (only the recipient has picked, no spent evening nudge), so changing it needs an owner or architect decision. Real low defect, deferred because it needs partners far apart and the fix adds a branch (review 2026-11-26: blind-hunter, intent-alignment).
    location: >-
      supabase/migrations/20261126000000_daily_reminders_schedule.sql enqueue_daily_reminders, evening branch
    severity: low
  - summary: >-
      tests/api/push-daily-reminders.spec.ts fails its own guard on a host in a half-hour zone (for example +05:30), because the pool accounts then sit at 08:10 and 20:10 at the spec's Kathmandu 08:25 and 20:25 instants.
    evidence: |-
      Pool accounts store the host zone (tests/support/factories/daily-question.ts seedPairDays; get_daily_day on sign-in). otherAccountsDueAt counts them as due and the spec stops before the rpc, loudly. No owner, partner or CI host is in a half-hour zone today. Real low defect, deferred because developers are unlikely to meet it and the fix (choosing the instants from the stored zones) adds logic (review 2026-11-26: intent-alignment).
    location: >-
      tests/api/push-daily-reminders.spec.ts otherAccountsDueAt and the two instants
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 3's sender knows `daily_question` and `daily_reminder`, but nothing writes `daily_reminders`, so no 8 AM or 8 PM push is ever sent (R3, R5).

**Approach:** One migration installs `pg_cron`, adds the internal `enqueue_daily_reminders(at)` that inserts each due person's `daily_reminders` row on their own clock (AD-9), schedules two named jobs, and adds the two AFTER INSERT triggers on `daily_reminders` that post to `send-push` through the existing `notify_push` (AD-10).

## Boundaries & Constraints

**Always:**
- Eligible person: `users.partner_id` set and the partner's `partner_id` pointing back, at least one `push_devices` row, and a `user_time_zones` row; local time is `at at time zone effective_zone` (the same expression as `user_local_date`).
- Morning: local time in `[08:00, 08:30)`, recipient has not picked. Evening: `[20:00, 20:30)`, not both picked; `evening_self` if the recipient has not picked, else `evening_partner`, skipped when a `daily_nudges` row exists with `from_user` = recipient, `sender_local_date` = local date, `slot = 'evening'`.
- Both slots call `assign_couple_day(least, greatest, local_date)` before deciding, so every row has a `day_id`; skip the assign when the (user, local_date, slot) row already exists.
- Each person in their own `begin … exception when others then raise warning … end` block; insert `on conflict (user_id, local_date, slot) do nothing`; return the count inserted.
- `enqueue_daily_reminders`: `security definer`, `set search_path = ''`, takes only `at` and reads no other clock (AD-8); `revoke execute … from public, anon, authenticated`, `grant … to service_role`.
- `create extension if not exists pg_cron with schema pg_catalog`; jobs scheduled with `cron.schedule(name, …)`, which replaces a job of the same name, so re-running leaves one row per name.
- Triggers: `daily_reminders` AFTER INSERT `when (new.kind = 'morning')` → `notify_push('daily_question')`, `when (new.kind <> 'morning')` → `notify_push('daily_reminder')`. Update the `notify_push`, `push_sender_settings` and `daily_reminders` comments.
- Header records the hosted catalog read (2026-11-26, below). Types regenerated with `npm run db:types`.

**Never:**
- No change to `src/services/dateReminders.ts` or `reminderIdsToCancel` (C4), and no client code.
- No trigger on `daily_picks` (8.6) or `daily_nudges` (8.7); no `send_daily_nudge`, no snapshot `nudge` (8.7).
- Do not add `daily_reminders` to `AUDITED_TABLES`: the local job runs on real time.
- The api spec never calls `enqueue_daily_reminders` at an instant where any account but its own throwaway pair is in a window; it never touches pool pairs' rows.
- No edit to existing pgTAP expected values unless this migration forces it; new assertions go in a new file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Two clocks | A in `America/New_York`, B in `Asia/Tokyo`, `at` = A's 08:10 | A gets `morning`, B none; at B's 08:10 B gets `morning` for B's date | — |
| Window edges | 07:59:59, 08:30:00, 19:59:59, 20:30:00 | none; 08:00:00 and 08:29:59 (another date) insert; same for 20:00 / 20:29:59 | — |
| Picked | recipient picked, morning | none | — |
| One picked, evening | A picked, B not | A `evening_partner`, B `evening_self` | — |
| Both picked, evening | both picked | none | — |
| Evening nudge spent | A picked, A's `evening` nudge row for the date | A none, B `evening_self` | — |
| Not eligible | no device / no zone / unlinked | none | — |
| Repeat | same `at` again | 0 rows added, no new queued post | — |
| One fails | a raise for one user's insert | warning; the other user's row stays | swallowed per user |
| Insert | a `morning` row; an evening row | one queued post `{kind: 'daily_question', id}`; one `{kind: 'daily_reminder', id}` | `notify_push` swallows |

</intent-contract>

## Code Map

- `supabase/migrations/20261125000000_daily_push_sender.sql` -- `daily_reminders` (slot generated, unique `(user_id, local_date, slot)`, `day_id` cascade), `daily_nudges (from_user, sender_local_date, slot)`, `user_local_date` (zone expression to copy); its header and comment style to follow.
- `supabase/migrations/20261031020000_push_moods_photos_interactions.sql:83` -- `notify_push()` posts `{kind: tg_argv[0], id: new.id}` via `net.http_post`; reuse, do not redefine. `20261105010000_push_added_dates.sql` -- trigger + comment template.
- `supabase/migrations/20261105030000_daily_question_days_and_picks.sql` -- `couple_days` (`user_a < user_b`), `daily_picks (day_id, user_id, is_second)`; `assign_couple_day(user_a, user_b, day) returns couple_days` (latest body in `20261106000000`).
- `supabase/migrations/20261105210000_daily_question_own_clocks.sql` -- `user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at)`.
- `supabase/tests/database/47_daily_pushes.sql` -- template for inline helpers (`tests.create_test_user`, `t_users`, `pg_temp.u`), coach-question seeding, `delete from public.couple_days`. `35_push_devices.sql:660` -- reading `net.http_request_queue` bodies. `18_function_execute_grants.sql` FN-GRANT-008 stays unchanged (internal function).
- `tests/api/push-daily-sender.spec.ts` -- story 3's spec inserts `daily_reminders` rows and posts them by hand; with the triggers the insert posts itself, so its reminder steps must wait for the trigger's records (then a hand post is a replay: `skipped`). Its `createParty`, `registerDevice`, `link`, `dailyPayload` are the patterns for the new spec.
- `tests/api/push-partner-activity-trigger.spec.ts:424` -- spec-local `awaitRequests` (poll `requestsFor` to a count); move it to `tests/support/helpers/push-requests.ts` and import it in both specs.
- `tests/support/helpers/migration-replay.ts` `runPsql` -- psql as postgres (picks and the guard query need it; `service_role` cannot insert `daily_picks`). `tests/support/factories/daily-question.ts` `readPairQuestionsByDay`.
- Hosted catalog read 2026-11-26 (read-only): `pg_cron` 1.6.4 available, not installed, preloaded, `cron.database_name = postgres`; no `cron` schema; no `enqueue_daily_reminders`; no trigger on `daily_reminders`, `daily_nudges` or `daily_picks`; story 3's objects present; one `push_sender_settings` row. Local stack: same `pg_cron` 1.6.4, preloaded.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261126000000_daily_reminders_schedule.sql` -- extension, `enqueue_daily_reminders`, grants, jobs `daily-reminders` (`*/5 * * * *`, `select public.enqueue_daily_reminders(now())`) and `daily-reminders-run-history` (daily, `delete from cron.job_run_details where end_time < now() - interval '7 days'`), the two triggers, comments -- the scheduler.
- [x] `src/types/database.types.ts` -- `supabase migration up` then `npm run db:types` -- generated.
- [x] `supabase/tests/database/48_daily_reminders.sql` -- every matrix row with fixed instants, scoped to its own users (the function sees every account); the triggers (exactly two on the table, queued bodies); grants (no EXECUTE for public/anon/authenticated, service_role has it); `pg_cron` installed; each job name has one `cron.job` row with its schedule and command, still one after re-running both `cron.schedule` calls -- SQL proof of R3/R5.
- [x] `tests/support/helpers/push-requests.ts`, `tests/api/push-partner-activity-trigger.spec.ts` -- export `awaitRequests`, drop the local copy -- one helper.
- [x] `tests/api/push-daily-sender.spec.ts` -- reminder inserts wait for the trigger's records (`awaitRequests`) instead of a first hand post; replays and kind-mismatch posts stay; header notes the trigger -- keeps story 3's checks true.
- [x] `tests/api/push-daily-reminders.spec.ts` -- throwaway linked pair in `Asia/Kathmandu` (+05:45, no DST; whole-hour host zones never sit in a window at its :05), Alice one device, Bob two; date D = Kathmandu's yesterday; psql guard: no other account with a device and zone is in a window at either instant; rpc `enqueue_daily_reminders` at D 08:05 → 2, both `morning` records (title D's question, body `Today's question is here. Day 1 is waiting.` as the pair has no streak, no sound), repeat → 0 and records unchanged; Alice's pick for D via psql; at D 20:05 → Alice `evening_partner`, Bob `evening_self` records with `sound: 'default'` -- the Playwright api check.

**Acceptance Criteria:**
- Given the migration applied, when `supabase test db` runs, then every file passes, `48_daily_reminders.sql` included.
- Given the edge runtime serving `send-push`, when the api specs run, then the new spec sees the morning and evening requests and story 3's and the partner-activity specs still pass.
- Given the local stack after 5 minutes, when `cron.job_run_details` is read, then `daily-reminders` has a `succeeded` run.
- Given the change, when `git diff <baseline> -- src/services/dateReminders.ts` runs, then it is empty, and the date reminder unit tests pass.

## Implementation Notes

- Files: `supabase/migrations/20261126000000_daily_reminders_schedule.sql`, `src/types/database.types.ts` (one line, `enqueue_daily_reminders`; a second `npm run db:types` reproduces it), `supabase/tests/database/48_daily_reminders.sql` (46 assertions), `tests/api/push-daily-reminders.spec.ts`, `tests/api/push-daily-sender.spec.ts`, `tests/api/push-partner-activity-trigger.spec.ts`, `tests/support/helpers/push-requests.ts`.
- Deviation from the Tasks line for `push-daily-reminders.spec.ts`: the instants are Kathmandu 08:25 and 20:25, not 08:05/20:05. Kathmandu 08:05 is 02:20 UTC, which a whole-hour zone (UTC+6, UTC-6) reads as 08:20 or 20:20, inside a window; at :25 (02:40 / 14:40 UTC) every whole-hour zone reads :40. Only a half-hour-zone account could still be due, and the spec's psql guard fails loudly then.
- The job names are `daily-reminders` (`*/5 * * * *`) and `daily-reminders-run-history` (`17 3 * * *`). The triggers are `daily_reminders_push_morning_after_insert` and `daily_reminders_push_evening_after_insert`.
- Story 3's spec: its reminder inserts now post through the trigger, so each one waits for the records (`awaitRequests`), and the hand posts of the same `{kind, id}` are asserted as replays (`skipped`). Every assertion it had on payloads, tokens and the kind mismatch stays.
- The migration is applied to the shared local stack with `supabase migration up` (no reset). A `daily-reminders` run shows `succeeded` in `cron.job_run_details`.
- Verified 2026-11-26: `supabase test db` 35 files / 1087 tests PASS; api specs 17 passed with `supabase functions serve` (stopped afterwards), row audit clean; `npm run typecheck` and `npm run lint` clean; `src/services/dateReminders.ts` no diff and `npx vitest run dateReminders` 215 passed.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 25 findings — high 0, medium 0, low 15, false 10, maybe-false 0
- findings:
  - `[low]` `[defer]` (blind-hunter) The live cron job can insert the push-daily-sender spec pair's reminder first in a host window, so `addReminder` hits the unique key — real: the pair is linked both ways with devices and a host-zone row; needs a tick in a seconds-wide gap; deferred (rare but real), see `deferred`.
  - `[low]` `[defer]` (blind-hunter) The cron job can add daily records to the partner-activity spec's by-token count of six — same root as the row above (live job vs spec accounts); deferred with it.
  - `[low]` `[defer]` (blind-hunter) evening_partner can urge a nudge about a date the partner can no longer pick on far-apart clocks — real: `record_daily_pick` and AD-17 both refuse that date; the intent states the rule literally, so the change needs an owner decision; deferred (rare but real).
  - `[false]` `[reject]` (blind-hunter) Calling `assign_couple_day` from the job shifts streaks and written-question targets — the intent requires both slots to assign the day; a user is only eligible with a `user_time_zones` row, which only `get_daily_day` writes, so the pair already has days; a date with no row already counts as missed (story 3's seeded "yesterday with no row (missed)"), and AD-4 picks the first date with no row by design, so a written question is asked on the next free date, not lost.
  - `[low]` `[patch]` (blind-hunter) `createParty`, `registerDevice`, `link` and `dailyPayload` were copied between the two daily specs (AGENTS.md, DW-313) — fixed: moved to `tests/support/helpers/push-requests.ts`, both specs import them, assertions unchanged.
  - `[false]` `[reject]` (blind-hunter) The spec guard is a hand copy of the function's rules and will drift — no wrong outcome today; a drifted guard fails loudly before the rpc, and an over-cautious count stops the spec rather than passing a wrong one.
  - `[false]` `[reject]` (blind-hunter) The window check runs inside a subtransaction per person every run, with repeated warnings for a bad zone — `effective_zone` only ever stores a name from `pg_timezone_names` or a POSIX offset, so `at time zone` cannot raise, and a subtransaction per linked account every 5 minutes on a two-person product names no harm.
  - `[low]` `[patch]` (blind-hunter) DAILY-REM-011 passes an inactive job or one on another database — fixed: it also pins `active = true` and `database = current_database()`.
  - `[low]` `[patch]` (blind-hunter) The run-history job never prunes a run with a null `end_time` — fixed: `coalesce(end_time, start_time) < now() - interval '7 days'` in the migration and the 48 file. Its deleting every job's history is what the intent and AD-9 ask for, not a defect.
  - `[false]` `[reject]` (blind-hunter) A missed window loses the push silently — AD-9 accepts it ("A missed window sends nothing"), and the epic's Boundaries put re-sending a missed push out of scope.
  - `[false]` `[reject]` (blind-hunter) Nothing pins `cron` schema access for anon and authenticated — local read: neither role has USAGE on schema `cron`, and `supabase/config.toml` exposes only `public` and `graphql_public` to the API, so `cron.schedule` is unreachable from a client.
  - `[low]` `[patch]` (blind-hunter) The `push-requests.ts` module comment names only the two trigger specs — fixed: it names all four push specs.
  - `[low]` `[patch]` (blind-hunter) The new spec's serial mode wraps one test, and `v_partner_picked` is read on the morning path — fixed: the configure line is deleted and the partner's pick is read only in the evening branch.
  - `[low]` `[defer]` (edge-case-hunter) The live cron fires mid-spec in a host window — grouped with the first row; deferred with it.
  - `[low]` `[patch]` (edge-case-hunter) A null `end_time` run is never pruned — grouped with the blind-hunter run-history row; fixed by the same `coalesce`.
  - `[low]` `[patch]` (edge-case-hunter) The plan says the api spec runs at Kathmandu 08:05 and 20:05, while the code uses 08:25 and 20:25 — the plan's record is wrong (at :05 a whole-hour zone such as UTC+6 reads 08:20); fixed by one dated line under `## Corrections`.
  - `[low]` `[defer]` (verification-gap) `push-daily-sender.spec.ts` races the live cron job — grouped with the first row; deferred with it.
  - `[low]` `[patch]` (verification-gap) The POSIX-offset `effective_zone` path is never exercised — fixed: DAILY-REM-051/052 store `Mars/Olympus` with `effective_zone('Mars/Olympus', 345)` = `<+0545>-05:45` and show a morning row at +05:45's 08:10 and none where -05:45 would read 08:10.
  - `[false]` `[reject]` (intent-alignment) The cron path is never run end to end — the ticket's Verify asks for the `cron.job` rows, which DAILY-REM-010 to 012 pin, and this run read `succeeded` `daily-reminders` runs in `cron.job_run_details` on the local stack.
  - `[low]` `[patch]` (intent-alignment) The two-clock pair was checked only at 8 AM, while Verify asks for their own 8 AM and 8 PM — fixed: DAILY-REM-047 to 050 give New York and Tokyo each their evening row at their own 20:10 and nothing to the other. The cross-date semantics it raises are the deferred evening_partner entry.
  - `[low]` `[defer]` (intent-alignment) The api spec's guard fails on a half-hour-zone host, and isolation rests on a check before the call — real for a +05:30 host (loud failure); the guard-to-rpc gap needs a half-hour-zone account to register a device within milliseconds; deferred (rare but real), see `deferred`.
  - `[false]` `[reject]` (intent-alignment) Only a failing insert is tested for one person's error — the exception block wraps the window check, `assign_couple_day`, the pick reads and the insert (migration, one `begin … exception` per person), so any raise inside takes the same path DAILY-REM-041 to 043 exercise.
  - `[false]` `[reject]` (intent-alignment) `assign_couple_day` is skipped once a row exists (D2, not D1) — the intent's purpose ("so every row has a day") holds for every inserted row (DAILY-REM-018), and a skipped pass inserts nothing.
  - `[false]` `[reject]` (intent-alignment) The hosted read, `db:types` and the date reminder tests are claims outside the diff — this run read the hosted catalog (2026-11-26, read-only), reran `npm run db:types` with one added line and no further diff, and ran `npx vitest run dateReminders` (215 passed).
  - `[false]` `[reject]` (intent-alignment) Scope beyond the intent: the 8.3 spec's meaning, comments, the shared helper — each follows from the new triggers (an insert now posts itself, so a hand post is a replay) and keeps every payload, token and mismatch assertion; the comments describe the new writer.

## Design Notes

- The function sees all accounts, so pgTAP asserts per test user (rows and queue bodies by its own ids), never the return count; the api spec's guard makes the return count its own.
- One error per person: pgTAP adds a test-only BEFORE INSERT trigger on `daily_reminders` raising for one user, inside its transaction.
- `continue` inside the per-user exception block is valid plpgsql and leaves the block normally.

```sql
v_local := enqueue_daily_reminders.at at time zone r.effective_zone;
v_slot := case when v_local::time >= '08:00' and v_local::time < '08:30' then 'morning'
               when v_local::time >= '20:00' and v_local::time < '20:30' then 'evening' end;
```

## Verification

**Commands:**
- `supabase migration up && npm run db:types && git diff --stat src/types/database.types.ts` -- expected: only `enqueue_daily_reminders` added.
- `supabase test db` -- expected: all files pass.
- `supabase functions serve` (background, stopped afterwards) then `fnox exec -- npx playwright test --project=api tests/api/push-daily-reminders.spec.ts tests/api/push-daily-sender.spec.ts tests/api/push-partner-activity-trigger.spec.ts tests/api/push-love-note-trigger.spec.ts` -- expected: all pass.
- `psql … -c "select j.jobname, d.status from cron.job_run_details d join cron.job j using (jobid) order by d.start_time desc limit 4"` -- expected: `daily-reminders` `succeeded`.
- `npm run typecheck && npm run lint` -- expected: pass.
- `git diff --exit-code <baseline_revision> -- src/services/dateReminders.ts && npx vitest run dateReminders` -- expected: no diff, every date reminder test file passes.

## Auto Run Result

- **Summary:** The 8 AM and 8 PM pushes are scheduled on each person's clock. Migration `20261126000000_daily_reminders_schedule.sql` installs `pg_cron` and adds the internal `enqueue_daily_reminders(at)` (service_role only). For each person linked both ways, with a push device and a stored zone, it inserts a `daily_reminders` row when their clock reads 08:00 to 08:30 and they have not picked (`morning`), or 20:00 to 20:30 unless both have picked. The evening row is `evening_self` when they have not picked, else `evening_partner`, which is skipped once their evening nudge is spent. It assigns the couple day first and handles each person in their own exception block, once per (user, date, slot). Two named jobs run it every 5 minutes and prune `cron.job_run_details` older than 7 days. Two AFTER INSERT triggers post `daily_question` or `daily_reminder` to `send-push` through `notify_push`. No client code, and `dateReminders.ts` is unchanged.
- **Files changed:**
  - `supabase/migrations/20261126000000_daily_reminders_schedule.sql`: the extension, the function, the triggers, the two jobs and the comments.
  - `src/types/database.types.ts`: regenerated, adding the `enqueue_daily_reminders` line.
  - `supabase/tests/database/48_daily_reminders.sql`: 52 assertions covering every matrix row, both clocks morning and evening, a POSIX-offset zone, the triggers, the grants and the jobs.
  - `tests/api/push-daily-reminders.spec.ts`: a throwaway Kathmandu pair, with the morning, repeat and evening requests recorded over the wire.
  - `tests/api/push-daily-sender.spec.ts`: reminder inserts wait for the trigger's records, and the hand posts are asserted as replays.
  - `tests/api/push-partner-activity-trigger.spec.ts`: imports the shared `awaitRequests`.
  - `tests/support/helpers/push-requests.ts`: shared `awaitRequests`, `createParty`, `registerDevice`, `link` and `dailyPayload`.
- **Review findings:** 25 findings: high 0, medium 0, low 15, false 10.
  - **Patched:** 8 low entries (10 rows):
    - the shared spec helpers;
    - the module comment;
    - DAILY-REM-011 also pins `active` and `database`;
    - the run-history `coalesce`;
    - serial mode and the morning partner read removed;
    - the plan's :05 record, by a `## Corrections` line;
    - the POSIX-offset zone test;
    - the two-clock evening test.
  - **Deferred:** 3 entries (5 rows), each in `deferred`:
    - the live cron job against the api specs' accounts;
    - evening_partner across far-apart clocks;
    - the guard on a half-hour-zone host.
  - **Rejected (false):** 10 rows, each refuted in the triage log:
    - the day-creation knock-on;
    - guard drift;
    - subtransaction cost;
    - the missed window;
    - cron schema access;
    - the cron path not run end to end;
    - only a failing insert tested;
    - D1/D2;
    - claims outside the diff;
    - scope.
- **Follow-up review recommendation:** `false`. This first pass patched 0 high and 0 medium entries.
- **Verification (2026-11-26, after the patches):**
  - `supabase migration up`: applied. The migration was re-applied on the shared stack by dropping only its own objects and its `schema_migrations` row, with no reset.
  - `npm run db:types`: one line added, and a rerun shows no further diff.
  - `supabase test db`: 35 files, 1093 tests, PASS.
  - The four push api specs: 17 passed with `supabase functions serve` running (stopped afterwards). The row audit reported no leftover rows.
  - `cron.job`: one row per name, both active, with the new command. `cron.job_run_details` shows `daily-reminders` `succeeded`.
  - `npm run typecheck` and `npm run lint`: clean.
  - `src/services/dateReminders.ts`: no diff from the baseline, and `npx vitest run dateReminders` passed 215 tests.
- **Residual risks:**
  - On hosted, `create extension pg_cron` and `cron.schedule` run as the migration role through `deploy.yml`. This is proven only on the local stack, which has the same pg_cron 1.6.4, preloaded, with the same `cron.database_name`. That the hosted jobs are listed and have succeeded is the epic's closure check.
  - The three deferred low defects, filed in `deferred` for the loop to ledger.

## Corrections

- 2026-11-26: the Tasks line for `tests/api/push-daily-reminders.spec.ts` gives the instants as D 08:05 and D 20:05 in Kathmandu, and says whole-hour host zones never sit in a window at its :05. That is wrong: Kathmandu 08:05 is 02:20 UTC, which UTC+6 reads as 08:20. The spec uses 08:25 and 20:25 (02:40 and 14:40 UTC), which every whole-hour zone reads as :40, outside both windows.
