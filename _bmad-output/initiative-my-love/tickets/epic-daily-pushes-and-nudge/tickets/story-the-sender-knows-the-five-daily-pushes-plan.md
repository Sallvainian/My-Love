---
title: 'The sender knows the five daily pushes'
type: feature
ticket: '3'
created: '2026-11-25'
status: done
baseline_revision: '76c8f4a21dfbcdb037199b802a77f5228b9ce3be'
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
      send-push does not check a pick's is_second against the posted kind, so a mis-posted daily_partner_picked or daily_both_answered sends the wrong copy and, because both kinds share the (daily_pick_id, token) dedupe key, blocks the correct post.
    evidence: |-
      getDailyPick (supabase/functions/send-push/index.ts) selects id, day_id, user_id; service_role may read is_second. Reachable only if a story 6 trigger's WHEN is wrong or a call with the shared secret is forged; reminders already get a posted/stored kind guard. Real low defect, deferred because users are unlikely to meet it (review 2026-11-25: blind-hunter, edge-case-hunter).
    location: >-
      supabase/functions/send-push/handler.ts resolveSource, daily_partner_picked / daily_both_answered
    severity: low
  - summary: >-
      A daily reminder's sender is users.partner_id while its day and streak come from the reminder's couple_days pair, so a re-pairing between enqueue and send would name the new partner on the old pair's day.
    evidence: |-
      resolveSource takes getPartnerId(reminder.user_id) and never compares it with the day's other seat; picks use otherInPair(day, ...). The ticket says the reminder's sender is the recipient's partner; the gap is a partner change within the seconds between the story 5 enqueue and pg_net's post. Real low defect, deferred because users are unlikely to meet it (review 2026-11-25: blind-hunter, edge-case-hunter, intent-alignment).
    location: >-
      supabase/functions/send-push/handler.ts resolveSource, daily_question / daily_reminder
    severity: low
  - summary: >-
      tests/api/push-daily-sender.spec.ts fixes "today" and "two days ago" from the host clock when it seeds the pair, while send-push reads the recipient's date from its own now(), so a run that crosses host-local midnight between seeding and a post fails spuriously.
    evidence: |-
      setUpPair takes today = isoDateDaysFromNow(0, new Date()) and seedPairDays writes a user_time_zones row in the host's zone; the pick-kinds case takes twoDaysAgo the same way. user_local_date(recipient, now()) then answers the next day after midnight, so the on-day partner-picked push is dropped as late and the "3-day streak", "Day 4" and "See ...'s pick." assertions miss. Real low flake, deferred because a run must straddle local midnight within seconds (follow-up review 2026-11-25: blind-hunter, edge-case-hunter); the fix is a guard (skip within a few minutes of local midnight) or re-deriving the date from user_local_date before each post.
    location: >-
      tests/api/push-daily-sender.spec.ts setUpPair and the pick-kinds case (twoDaysAgo)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `send-push` knows only the old kinds, and its `POSTED_KINDS` refuses anything else, so the epic's triggers (stories 5 to 7) cannot ship until a deploy has taught the sender the five daily kinds and given it tables, dedupe columns and switches to work on (spine AD-10).

**Approach:** One migration adds `daily_nudges`, `daily_reminders`, three `push_requests` source columns, five `push_preferences` switches and the internal `user_local_date(user_id, at)`, with nothing writing the new tables. `send-push` learns the five kinds: it reads the row, the day, the question and `couple_streak`, builds `push-copy.md`'s text, applies the drop rule and late wording through `user_local_date`, and sets `aps.sound` for the nudge and reminders.

## Boundaries & Constraints

**Always:**
- Copy exactly as `push-copy.md`; question worded `${this} or ${that}?` (as `DailyQuestion.tsx:244`); `{Partner}` falls back to `Your partner`.
- Every daily push keeps `aps.badge`, `thread-id: partner-activity` and top-level `kind`; only `daily_nudge` and `daily_reminder` carry `aps.sound: 'default'`.
- The recipient's current date comes only from `user_local_date` called with the sender's `now()` as `at`; no zone arithmetic in Deno.
- `send-push` never selects `daily_picks.choice` (R1; `service_role` has no SELECT on it anyway).
- New tables: RLS on with no policies, `revoke all … from anon, authenticated`, `service_role` keeps defaults; `day_id not null references couple_days on delete cascade`. `user_local_date`: `revoke execute … from public, anon, authenticated`, grant `service_role`.
- Each new `push_requests` column `on delete cascade`, `unique (col, token)`, and the source check rebuilt over all eleven sources.
- Types regenerated with `npm run db:types`, never edited by hand.

**Never:**
- No trigger on `daily_picks`, `daily_nudges` or `daily_reminders`, no `pg_cron`, no `enqueue_daily_reminders` (stories 5, 6), no `send_daily_nudge` RPC or snapshot `nudge` (story 7).
- No Settings switch UI, `viewForPush` or client code (story 4); no change to `src/services/dateReminders.ts`.
- No edit to existing pgTAP assertions' expected values unless a new column forces it; new assertions go in a new file.
- Do not add `daily_nudges` or `daily_reminders` to `AUDITED_TABLES` (stories 5 and 7 decide).
- Never touch the worker's pool pair's `couple_days` in the api spec (it shifts their streak); use throwaway accounts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partner picked | `{kind:'daily_partner_picked', id: pick}`, day = recipient's date | To the other of the day's pair: title `{Picker} made their pick`, body `Pick yours to see what they chose.`, no sound, no choice | — |
| Partner picked, not recipient's date | day ≠ `user_local_date(recipient, now)` | 200, all counts 0, nothing claimed | — |
| Both answered | second pick, on date; `run` n | To the first picker: `n days in a row` / `1 day in a row` + `You both answered. See {Picker}'s pick.`; run 0: `You both answered` + `See {Picker}'s pick.` | — |
| Both answered, late | day ≠ recipient's date | same titles, `See {Picker}'s pick.` replaced by `That day counts.` | — |
| Nudge | `daily_nudges` row | To `to_user`: `{From} nudged you`, `Your {held}-day streak needs your pick today.` (held 0: `Your streak needs your pick today.`), sound `default` | — |
| Morning | `daily_question` + reminder kind `morning` | To `user_id`: title `{question}`, body `Today's question is here. Day {held+1} is waiting.`, no sound | — |
| Evening self / partner | `daily_reminder` + kind `evening_self` / `evening_partner` | `You haven't done your daily yet` + `{question} It takes two taps.` / `{Partner} hasn't done their daily` + `Nudge them before midnight.`; sound `default`; sender is the recipient's partner | — |
| Mismatched reminder kind | `daily_question` on an evening row, or `daily_reminder` on a morning row | 200, all 0, nothing claimed | — |
| Reminder, recipient unlinked | `users.partner_id` null | 200, all 0 | — |
| Switch off | that kind's column false | 200, all 0, no devices listed; other kinds and the partner unaffected | — |
| Row gone | unknown id | 404 | — |
| Failed read (day, local date, streak) | db throws | 500, nothing claimed | logged |

</intent-contract>

## Code Map

- `supabase/functions/send-push/handler.ts` -- `PushKind`, `PushPreference`, `PREFERENCE_FOR_KIND`, `POSTED_KINDS`, `parseBody` (error message lists kinds), `PushDb`, `resolveSource` (switch per kind), `handleSendPush` (nobody-to-tell return, switch check, then names/devices/badge, then `withKind(withBadge(...))`). `deps.now` is the clock for `at`.
- `supabase/functions/send-push/payload.ts` -- `ApnsPayload` (add `aps.sound?`), `PARTNER_ACTIVITY_THREAD_ID`, `FALLBACK_SENDER_NAME`, `partnerActivityPayload`; header comment lists stories' kinds.
- `supabase/functions/send-push/index.ts` -- `SOURCE_COLUMN` map and the real `PushDb` (supabase-js with secret key). `couple_days` has two relationships with `daily_questions` (`question_id` and `daily_questions.source_day_id`), so read the question in a second select rather than embedding.
- `supabase/functions/send-push/handler.test.ts`, `payload.test.ts` -- `fakeDb(options)` harness to extend; run with `deno test --no-lock supabase/functions/send-push/`.
- `supabase/migrations/20261105010000_push_added_dates.sql` -- template for adding `push_requests` sources, the source check and `push_preferences` columns with comments.
- `supabase/migrations/20261107010000_couple_streak.sql` -- `couple_streak(user_a, user_b, viewer, at) returns jsonb` (`held`, `run`), raises `22023` unless `user_a < user_b` and viewer in pair; viewer date pattern `coalesce((select effective_zone from user_time_zones …), 'UTC')` + `(at at time zone zone)::date` -- copy for `user_local_date`.
- `supabase/migrations/20261105030000_daily_question_days_and_picks.sql` -- `couple_days (id, user_a, user_b, day, question_id, …)`, `daily_picks (id, day_id, user_id, is_second, …)`; `assign_couple_day(user_a, user_b, day)` (service_role EXECUTE) for test days.
- `supabase/tests/database/35_push_devices.sql` -- PUSH-DB-062 counts the eight old names by regex; new names do not match it, so it stays.
- `supabase/tests/database/45_couple_streak.sql` -- pattern for structure/grant assertions and fixed-instant calls; `tests.create_test_user`, `tests.authenticate_as`.
- `tests/api/push-partner-activity-trigger.spec.ts` -- `createParty`, `registerDevice`, linking via `partner_requests` + `accept_partner_request`, `awaitRequests`; `tests/support/helpers/push-requests.ts` -- `SourceColumn`, `requestsFor`, `postToSender`, `partnerPayload`, `clientFor`, `newToken`.
- Hosted catalog read 2026-11-25 (read-only): no `daily_nudges`, `daily_reminders`, `user_local_date`; `push_requests` holds only the eight migration sources and constraints; `push_preferences` only its migration columns.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261125000000_daily_push_sender.sql` -- create `daily_nudges (id, from_user, to_user, day_id, sender_local_date, slot check in ('after_pick','evening'), created_at, unique (from_user, sender_local_date, slot))` and `daily_reminders (id, user_id, kind check in ('morning','evening_self','evening_partner'), slot generated stored, local_date, day_id, created_at, unique (user_id, local_date, slot))` per AD-9/AD-17, RLS and revokes; add `push_requests.daily_pick_id/daily_nudge_id/daily_reminder_id` with unique keys and the 11-source check; add the five `push_preferences` booleans; create `user_local_date`; comments on every new object -- the schema the sender and stories 4 to 7 build on.
- [x] `src/types/database.types.ts` -- regenerate with `npm run db:types` after `supabase migration up` -- generated file.
- [x] `supabase/functions/send-push/payload.ts` -- `aps.sound?`, `DAILY_SOUND = 'default'`, copy constants and five builders (`buildDailyQuestionPayload`, `buildDailyPartnerPickedPayload`, `buildDailyNudgePayload`, `buildDailyReminderPayload(variant…)`, `buildDailyBothAnsweredPayload(run, name, late)`), `questionText(this, that)`; header comment -- pure copy from `push-copy.md`.
- [x] `supabase/functions/send-push/handler.ts` -- five kinds in the unions, `PREFERENCE_FOR_KIND` (column named after the kind) and `POSTED_KINDS`; `PushDb` gains `getDailyPick`, `getDailyNudge`, `getDailyReminder`, `getCoupleDay` (with `this_text`, `that_text`), `getUserLocalDate(userId, atIso)`, `getCoupleStreak(userA, userB, viewer, atIso)`; `resolveSource` cases per the matrix; header comment -- the sender's contract.
- [x] `supabase/functions/send-push/index.ts` -- `SOURCE_COLUMN` for the five kinds and the real reads (`rpc('user_local_date')`, `rpc('couple_streak')`, column-listed selects); header comment -- wiring.
- [x] `supabase/functions/send-push/payload.test.ts`, `handler.test.ts` -- each kind's payload, recipient, sender name, sound or none, drop rule, late wording, run/held variants, reminder kind mismatch, unlinked reminder, switch off per kind (lookup names the kind's column), no choice in any payload, failed read 500 -- matrix coverage.
- [x] `supabase/tests/database/47_daily_pushes.sql` -- tables, columns, slot generated column, unique keys, RLS on with no policies, no privilege for anon/authenticated, service_role insert works, cascade (`couple_days` delete removes nudge, reminder and their `push_requests`; pick delete removes its `push_requests`), the 11-source check, five preference columns default true, `user_local_date` (stored zone's date at a fixed instant across midnight, UTC with no row, no EXECUTE for anon/authenticated, service_role has it) -- R-coverage in SQL.
- [x] `tests/support/helpers/push-requests.ts` -- add the three columns to `SourceColumn` -- the spec reads them.
- [x] `tests/api/push-daily-sender.spec.ts` -- throwaway linked pair with devices and display names; admin `assign_couple_day` for today's UTC date (no `user_time_zones` row, so UTC), admin inserts a `morning` reminder, an `evening_partner` reminder and a nudge row, `postToSender` each, read recorded payloads (title, body, sound, badge, thread, kind, recipient's tokens only); replay skipped; then turn one person's `daily_nudge` switch off (admin upsert into `push_preferences`) and show a new nudge to them records none while a reminder to them and a nudge to the partner still record -- the Playwright api check.

**Acceptance Criteria:**
- Given the migration applied, when `supabase test db` runs, then every file passes, `47_daily_pushes.sql` included.
- Given the five kinds, when `deno test --no-lock supabase/functions/send-push/` runs, then each matrix row is asserted and every existing test still passes.
- Given a local stack with the edge runtime, when the api spec posts a reminder and a nudge, then `push_requests` holds the copy and sound from `push-copy.md` for the recipient's devices only, and an off switch records nothing for that kind and person while their other kinds and the partner still record.
- Given the regenerated types, when `npm run typecheck` and `npm run lint` run, then both pass.

## Implementation Notes

- Files: `supabase/migrations/20261125000000_daily_push_sender.sql`, `src/types/database.types.ts` (regenerated, 148 lines added, reproduced by a second `npm run db:types`), `supabase/functions/send-push/{payload,handler,index}.ts` and their two Deno test files, `supabase/tests/database/47_daily_pushes.sql` (70 assertions), `tests/api/push-daily-sender.spec.ts`, `tests/support/helpers/push-requests.ts`.
- One existing assertion changed because a new column forces it: `36_push_preferences.sql` PUSH-PREF-009 lists every boolean switch column, so its expected string gains the five daily columns. PUSH-DB-062 in `35_push_devices.sql` counts only the eight old names and stays.
- `daily_nudges` gets indexes on `to_user` and `day_id`, `daily_reminders` on `day_id`, for the cascades; the unique keys lead with `from_user` / `user_id`.
- `user_local_date` returns null for a null argument; `getUserLocalDate` in `index.ts` throws on a non-string answer, so the sender answers 500 rather than comparing against null.
- The api spec runs on throwaway linked accounts (no `user_time_zones` row, so UTC); the pool pair's `couple_days` is untouched and the row audit reports no leftovers.
- Verified 2026-11-25: Deno 123 passed; `supabase test db` 34 files / 1037 tests pass; the three push api specs 15 passed with `supabase functions serve` running (stopped afterwards); `npm run typecheck` and `npm run lint` clean; `src/services/dateReminders.ts` has no diff.

- Review patches (2026-11-25): the api spec seeds days with `seedPairDays` (held 3, run 0, then 4/1 after the second pick) and gains a `[P0]` pick-kinds case through the real wiring; `getCoupleStreak` throws unless `held` and `run` are numbers; `daily_reminders.slot` is `not null`; comments on the three `push_requests` columns and three indexes; the `push_requests` comment reworded. Found while reading the diff (not a lens): the migration's comments gave the reminder writer to story 6, while `tickets.toml` gives pg_cron, `enqueue_daily_reminders` and the reminder triggers to story 5, the pick triggers to story 6 and the nudge to story 7; corrected. The migration was re-applied on the shared stack by dropping only its own objects and its `schema_migrations` row, then `supabase migration up` (no reset).

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 30 findings — high 0, medium 4, low 14, false 12, maybe-false 0
- findings:
  - `[low]` `[defer]` (blind-hunter) The sender never checks `is_second`, so a mis-posted pick kind sends wrong copy and blocks the right post — real only on a wrong story 6 WHEN or a forged secret-bearing call; deferred (rare but real), see `deferred`.
  - `[low]` `[defer]` (blind-hunter) A reminder's sender is `users.partner_id`, not the day's pair — real only if a partner changes between enqueue and pg_net's post (seconds); deferred (rare but real).
  - `[false]` `[reject]` (blind-hunter) A nudge's `from_user`/`to_user` are never checked against the pair; a non-seat `to_user` gives 500 — nothing writes `daily_nudges` yet and AD-17's `send_daily_nudge` (story 7) derives both from the pair, so the state is unreachable; a loud 500 there is correct behaviour.
  - `[low]` `[patch]` (blind-hunter) `getCoupleStreak` coerces a missing or non-numeric answer to 0/NaN — `couple_streak` always returns both keys today, but a renamed key would send wrong copy silently; fixed: it throws unless `held` and `run` are numbers.
  - `[false]` `[reject]` (blind-hunter) Reminders and nudges have no staleness rule — every post comes from an AFTER INSERT trigger through pg_net, which does not retry (AD-9: "A failed post is not retried"), and AD-10 gives the sender only the partner-picked drop and the late wording; no delayed post is reachable.
  - `[medium]` `[patch]` (blind-hunter) The api spec never runs the two pick kinds live — same root as the verification-gap pick-kind finding; fixed by the new `[P0]` pick-kinds case.
  - `[false]` `[reject]` (blind-hunter) Failures of the first row read of each daily kind are untested — the whole handler body sits in one `try` that answers 500 before any claim, and the existing `failOn: 'getNote'` test pins that path; the outcome claimed missing does happen.
  - `[false]` `[reject]` (blind-hunter) pgTAP misses user cascades, direct nudge/reminder deletes and FK targets — DAILY-PUSH-037/040/041 insert requests with pick, nudge and reminder ids (a wrong FK target would refuse them), DAILY-PUSH-045 deletes a pick and DAILY-PUSH-049 shows the nudge/reminder → request cascade, and the api spec's throwaway-account deletes would fail on a non-cascading user FK.
  - `[low]` `[patch]` (blind-hunter) `daily_reminders.slot` is not `not null`, so generated types read `string | null` for stories 5–7 — fixed: `not null`, types regenerated (`slot: string`).
  - `[low]` `[patch]` (blind-hunter) The `push_requests` table comment ties `daily_nudge_id` to the reminder kinds — fixed: reworded per column.
  - `[low]` `[patch]` (blind-hunter) The api spec's "only Alice has picked" comment claims a pick it never made — fixed: the comment now says the variant comes from the stored kind.
  - `[false]` `[reject]` (blind-hunter) Copy constants are partly inline and `buildDailyReminderPayload`'s `detail ?? ''` lets a null question through — the only caller passes the question string for `evening_self`, so the null case is unreachable, and no caller or later story is named that the mixed constants would break.
  - `[false]` `[reject]` (edge-case-hunter) Nudge from/to outside the day's pair — same refutation as the blind-hunter nudge finding: unreachable until story 7, whose RPC derives both from the pair.
  - `[low]` `[defer]` (edge-case-hunter) Reminder partner differs from the day's other seat — grouped with the blind-hunter reminder-partner finding; deferred.
  - `[low]` `[defer]` (edge-case-hunter) Pick kind posted against the wrong `is_second` — grouped with the blind-hunter `is_second` finding; deferred.
  - `[false]` `[reject]` (edge-case-hunter) A nudge or reminder posted after the recipient's date moved on — same refutation as the staleness finding: pg_net posts once at insert and never retries.
  - `[false]` `[reject]` (edge-case-hunter) A pick for a day ahead of the recipient's date is dropped or worded late — AD-10 drops a partner-picked push "whose day is not the recipient's current date" and words both-answered "That day counts." on the same test, ahead included; the code implements that rule as written.
  - `[low]` `[patch]` (edge-case-hunter) `getCoupleStreak` accepts a bad shape — grouped with the blind-hunter streak finding; fixed by the same throw.
  - `[low]` `[defer]` (edge-case-hunter) One pick posted as both kinds collides on `(daily_pick_id, token)` — same root as the `is_second` finding; deferred with it.
  - `[low]` `[patch]` (edge-case-hunter) The plan asked for comments on every new object; the three `push_requests` columns and three indexes had none — fixed: `comment on` each.
  - `[medium]` `[patch]` (verification-gap) Partner-picked and both-answered are never run through the real `PushDb` (`SOURCE_COLUMN`, `getDailyPick`, the `user_local_date` rpc, the date compare) — fixed: `[P0]` case seeds picks with `seedPairDays`/psql and asserts the recorded copy for the other partner only, the past-day drop (zeros, no rows) and `You both answered. That day counts.`.
  - `[medium]` `[patch]` (verification-gap) Streak numbers were only asserted at the zero fallback — fixed: seeded days give held 3 (`Your 3-day streak…`, `Day 4 is waiting.`) and run 1 after the second pick (`1 day in a row`).
  - `[medium]` `[patch]` (intent-alignment) The drop rule and late wording were proven only against a fake `user_local_date` — grouped with the verification-gap pick-kind finding; fixed by the same case.
  - `[medium]` `[patch]` (intent-alignment) Numbered streak copy existed only in Deno — grouped with the verification-gap streak finding; fixed by the seeded days.
  - `[false]` `[reject]` (intent-alignment) Over the wire only one other kind of the switched-off person is shown still recording — the Verify line's "the other kinds and the partner" is met by another kind plus the partner, and `handler.test.ts` shows each daily kind's switch off leaves the other four on.
  - `[false]` `[reject]` (intent-alignment) R4's arrives-once and retried-pick behaviour is unmet — the intent assigns the firing to stories 5 to 7 ("No trigger yet").
  - `[low]` `[defer]` (intent-alignment) Picks use the day's pair while reminders use `users.partner_id` — grouped with the reminder-partner finding; deferred.
  - `[false]` `[reject]` (intent-alignment) The switch is checked after the daily reads, so a failed read answers 500 with the switch off — the plan's Design Notes place the reads in `resolveSource` before the switch, and a 500 claims nothing; no wrong push results.
  - `[false]` `[reject]` (intent-alignment) It was not checked that the types came from `npm run db:types` — re-running `npm run db:types` reproduced the committed file byte for byte (148 lines added, no diff).
  - `[false]` `[reject]` (intent-alignment) Admin-inserted rows are in states the later writers might not produce — the sender reads none of that state (AD-10: the posted and stored kinds decide), so the outcome is the same.

### 2026-11-25 — Review pass (follow-up)
- verdicts: 30 findings — high 0, medium 0, low 14, false 16, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind-hunter) The DW-525 and DW-526 ledger headings stop mid-sentence — true, but this run's invocation forbids modifying, re-opening or rewriting existing deferred-work ledger entries (the orchestrator owns them and wrote those headings); each entry's full summary stands in this plan's `deferred` list.
  - `[low]` `[patch]` (blind-hunter) The migration header says one pick is posted as exactly one kind "so (daily_pick_id, token) never collides", a rule nothing enforces (DW-525) — fixed: the header now says story 6's triggers are to post one kind, send-push does not check `is_second`, and the key stays clear only while their WHEN clauses hold (DW-525). A `--` comment, so the applied schema is unchanged.
  - `[low]` `[patch]` (blind-hunter) The plan's Tasks line and Implementation Notes still say the api spec uses `assign_couple_day` with no `user_time_zones` row (UTC), while the shipped spec seeds with `seedPairDays` in the host's zone — fixed by one dated line under `## Corrections`; earlier text left as written.
  - `[false]` `[reject]` (blind-hunter) No line records that the suites were rerun after the review patches — the first pass's Auto Run Result (committed at 22cbd605) recorded the post-patch runs (Deno 123, `supabase test db` 1037, api specs 16); this pass reruns every Verification command and records them below.
  - `[low]` `[patch]` (blind-hunter) `user_local_date`'s pgTAP rows give `time_zone` and `effective_zone` the same value, so a function reading `time_zone` would pass — fixed: user a's row reports `Europe/London` with `effective_zone` `America/New_York`, so DAILY-PUSH-065, 067 and 068 fail for a `time_zone` reader.
  - `[low]` `[patch]` (blind-hunter) Nothing pins `not null` on `daily_reminders.slot` (the first review's patch), `local_date`, `daily_nudges.slot` or `sender_local_date` — fixed: DAILY-PUSH-071 to 074 `col_not_null`, plan 70 → 74.
  - `[false]` `[reject]` (blind-hunter) `evening_partner` skips the day read, so a missing day does not 404 for it — `daily_reminders.day_id` is `not null … on delete cascade`, so a reminder whose day is gone is itself gone and `getDailyReminder` answers 404 first; the `evening_partner` copy needs neither day nor streak, so the skip changes no outcome.
  - `[false]` `[reject]` (blind-hunter) The Deno fake's `getCoupleDay` ignores the id, so a wrong `day_id` would pass — the api spec runs every daily kind through the real `index.ts` reads, where a wrong id finds no `couple_days` row and answers 404 instead of the asserted records.
  - `[false]` `[reject]` (blind-hunter) A failed `getPartnerId` in the reminder path is untested — the handler body is one `try` that answers 500 before any claim, the path the existing failed-read tests pin; the outcome claimed missing does happen (as the first pass's first-row-read finding).
  - `[low]` `[defer]` (blind-hunter) The api spec can fail when a run crosses host-local midnight between seeding and a post — real: `today`/`twoDaysAgo` come from the host clock while the sender reads `user_local_date(…, now())`; the fix is a new guard, so deferred as rare but real (see `deferred`). This was the first pass's named unverified risk, now confirmed.
  - `[low]` `[patch]` (blind-hunter) The api spec's header lists only the reminder and nudge kinds and the first case's assertions — fixed: the header names the pick kinds and the past-day drop and "That day counts." wording.
  - `[false]` `[reject]` (blind-hunter) `user_local_date` is `security definer` without a reason — it follows the repo's internal-function pattern (`couple_streak` in 20261107010000 is `security definer`, `search_path = ''`, service_role only), and with EXECUTE revoked from public, anon and authenticated no caller gains a read.
  - `[false]` `[reject]` (blind-hunter) `daily_nudges` lacks `check (from_user <> to_user)` — nothing writes the table until story 7's `send_daily_nudge` derives both from the pair, and a self-nudge row would hit the sender's self-addressed return and send nothing; no bad outcome is reachable.
  - `[false]` `[reject]` (blind-hunter) `DAILY_SOUND` is asserted inside the loop and tied to `REMINDER_SOUND` only by comment — the repeat assertion is harmless, and both constants are pinned to `'default'` independently (`payload.test.ts:333`, `dateReminders.schedule.test.ts:241`), so neither can drift unseen.
  - `[low]` `[defer]` (edge-case-hunter) The api spec's dates cross local midnight — grouped with the blind-hunter midnight finding; deferred with it.
  - `[low]` `[patch]` (edge-case-hunter) The Tasks line says the api spec seeds UTC days with no `user_time_zones` row — grouped with the blind-hunter plan-record finding; fixed by the same `## Corrections` line.
  - `[false]` `[reject]` (edge-case-hunter) The new tables' columns and constraints carry no comments — both table comments describe every column (slot, sender's local date, local_date, day_id), the convention of `couple_days`, `daily_picks` and `user_time_zones`, none of which comments its columns; nothing is undocumented in the catalog.
  - `[low]` `[patch]` (verification-gap) PUSH-DB-062's label says "the source check names eight sources" while it now names eleven — fixed: the label says "the eight older sources"; the expected value and pattern are unchanged.
  - `[low]` `[reject]` (verification-gap) DW-525/DW-526 headings truncated — grouped with the blind-hunter ledger finding; rejected on the same invocation rule.
  - `[low]` `[patch]` (verification-gap) The api spec's header names only reminder and nudge kinds — grouped with the blind-hunter header finding; fixed by the same edit.
  - `[low]` `[defer]` (intent-alignment) The sender never checks a pick's `is_second` against the posted kind — carried: same location and claim as the first pass's row, and the code still reads as it describes; already in `deferred` (DW-525), not deferred again.
  - `[low]` `[defer]` (intent-alignment) A reminder's sender is `users.partner_id`, not the day's other seat — carried: same location and claim as the first pass's row, and the code still reads as it describes; already in `deferred` (DW-526), not deferred again.
  - `[false]` `[reject]` (intent-alignment) An unlinked recipient gets no morning or `evening_self` reminder though their copy names nobody — the plan's matrix ("Reminder, recipient unlinked → 200, all 0") and the intent's "takes a reminder's sender to be the recipient's partner" both make a partnerless reminder no push; an unlinked person has no couple day to be reminded of.
  - `[false]` `[reject]` (intent-alignment) pgTAP does not compare `user_local_date`'s full ACL with `{owner, service_role}` — the Verify line asks for "no EXECUTE for anon or authenticated", which DAILY-PUSH-060 to 063 pin, with PUBLIC and service_role besides.
  - `[false]` `[reject]` (intent-alignment) A late both-answered push titles today's `run`, not the run at the pick's day — `push-copy.md` takes `{run}` "from the recipient's streak" and words the late row "as above, by `run`"; the sender reads `couple_streak` at its own clock, as written.
  - `[false]` `[reject]` (intent-alignment) Over the wire only one other kind of the switched-off person is shown still recording — carried: same claim as the first pass's row, and the spec still reads as described (another kind plus the partner over the wire; every kind in `handler.test.ts`).
  - `[false]` `[reject]` (intent-alignment) No test covers the self-addressed return for a malformed new-kind row — the return is unchanged old code with its existing tests, and no writer of a malformed new-kind row exists before stories 5 to 7.
  - `[false]` `[reject]` (intent-alignment) The cascade from `couple_days` through `daily_picks` to `push_requests` is not checked — `daily_picks.day_id`'s cascade is pre-existing, and DAILY-PUSH-045 shows a pick's delete removes its requests; both links are pinned.
  - `[false]` `[reject]` (intent-alignment) That the types came from `npm run db:types` is UNVERIFIED — carried: same claim as the first pass's row; this pass reran `npm run db:types` and the committed file again shows no diff.
  - `[false]` `[reject]` (intent-alignment) The api spec's drop rule runs on the host's zone, never the UTC-with-no-row path through the sender — the sender's code path is identical for any zone (it compares `couple_days.day` with whatever `user_local_date` answers), and DAILY-PUSH-064 pins the no-row UTC answer.

## Design Notes

- Recipients: a pick goes to the other member of its `couple_days` pair (not `users.partner_id`), sender the picker; a nudge from `from_user` to `to_user`; a reminder to `user_id`, sender `getPartnerId(user_id)`, and no partner means nothing to tell. The self-addressed return stays for every kind; the new kinds never self-address unless a row is malformed.
- Streak: `couple_streak(day.user_a, day.user_b, recipient, now)`; read only for nudge (`held`), morning (`held`) and both answered (`run`).
- Daily reads happen inside `resolveSource`, before the switch check; a dropped partner-picked push returns `buildPayload: null` and claims nothing. Keep `buildPayload` synchronous.
- Posted kind decides the copy (AD-10, "never infers"); the reminder's stored `kind` picks the variant, and a posted/stored mismatch is no push, like `partner_accept`'s status guard.

```ts
// both answered
const title = run === 0 ? 'You both answered' : run === 1 ? '1 day in a row' : `${run} days in a row`;
const tail = late ? 'That day counts.' : `See ${name}'s pick.`;
const body = run === 0 ? tail : `You both answered. ${tail}`;
```

## Verification

**Commands:**
- `supabase migration up && npm run db:types && git diff --stat src/types/database.types.ts` -- expected: only the new tables, columns and function appear.
- `deno test --no-lock supabase/functions/send-push/` -- expected: all pass.
- `supabase test db` -- expected: all files pass.
- `fnox exec -- npx playwright test --project=api tests/api/push-daily-sender.spec.ts tests/api/push-partner-activity-trigger.spec.ts tests/api/push-love-note-trigger.spec.ts` -- expected: all pass (edge runtime serving `send-push`).
- `npm run typecheck && npm run lint` -- expected: pass.
- `git diff --exit-code -- src/services/dateReminders.ts` -- expected: no diff.

## Auto Run Result

- **Summary:** `send-push` knows the five daily kinds a deploy ahead of their triggers. Migration `20261125000000_daily_push_sender.sql` adds `daily_nudges`, `daily_reminders` (RLS on, no policies, no anon/authenticated privilege, `day_id` cascading with `couple_days`), three `push_requests` sources with unique keys and an eleven-source check, five `push_preferences` switches (default true) and the internal `user_local_date(user_id, at)` (service_role EXECUTE only). The sender builds `push-copy.md`'s text from the question and `couple_streak`, drops a partner-picked push for a day that is not the recipient's current date, words a late both-answered push "That day counts.", takes a reminder's sender to be the recipient's partner, sets `aps.sound: 'default'` on the nudge and both 8 PM reminders only, and sends nothing when that kind's switch is off. No trigger, cron job or client code. This follow-up pass changed only comments and tests.
- **Files changed (whole story):**
  - `supabase/migrations/20261125000000_daily_push_sender.sql`: the tables, sources, switches and `user_local_date`. This pass reworded one header comment, with no schema change.
  - `src/types/database.types.ts`: regenerated with `npm run db:types`.
  - `supabase/functions/send-push/payload.ts`: the five builders, `questionText` and `aps.sound`.
  - `supabase/functions/send-push/handler.ts`: the kinds, the switches, the `PushDb` reads and the `resolveSource` cases.
  - `supabase/functions/send-push/index.ts`: the source columns and the real reads (column-listed, never `choice`).
  - `supabase/functions/send-push/handler.test.ts`, `payload.test.ts`: each kind's payload, recipient, sound, drop rule, late wording, switch and failures.
  - `supabase/tests/database/47_daily_pushes.sql`: 74 assertions. This pass added four `col_not_null` checks and gave `user_local_date`'s fixture a `time_zone` that differs from its `effective_zone`.
  - `supabase/tests/database/36_push_preferences.sql`: PUSH-PREF-009 lists the five new switch columns.
  - `supabase/tests/database/35_push_devices.sql`: PUSH-DB-062's label now says "the eight older sources". This pass changed only the label.
  - `tests/api/push-daily-sender.spec.ts`: reminders, nudges, the pick kinds and an off switch over the wire, on throwaway accounts. This pass rewrote the header so it describes both cases.
  - `tests/support/helpers/push-requests.ts`: `SourceColumn` gains the three columns.
- **Review findings (follow-up pass):** 30 findings: high 0, medium 0, low 14, false 16.
  - **Patched:** 6 low entries (9 rows), each a direct correction:
    - the migration header no longer says the pick key "never collides";
    - the plan record's UTC wording, fixed by a dated `## Corrections` line;
    - the `user_local_date` fixture now tells `time_zone` from `effective_zone`;
    - DAILY-PUSH-071 to 074 pin the `not null` columns;
    - the api spec header covers both cases;
    - the PUSH-DB-062 label.
  - **Deferred:** 1 new entry, the api spec's local-midnight flake (in `deferred`). Two rows were carried as already deferred (DW-525, DW-526).
  - **Rejected (low):** 2 rows. The truncated DW-525 and DW-526 ledger headings: this run's invocation forbids rewriting ledger entries.
  - **Rejected (false):** 16 rows, each refuted in the triage log:
    - the reruns were already recorded;
    - `evening_partner` skips the day read;
    - the fake ignores the day id;
    - `getPartnerId` failure;
    - `security definer`;
    - the self-nudge check;
    - `DAILY_SOUND`;
    - column comments;
    - the unlinked reminder;
    - the full ACL;
    - the late `run`;
    - the off-switch scope (carried);
    - the self-addressed return;
    - the pick cascade;
    - `db:types` (carried);
    - the host-zone drop path.
- **Follow-up review recommendation:** `false`. This follow-up pass patched no high (high 0, medium 0, low 6 entries), so the work has converged.
- **Verification (2026-11-25, this pass):**
  - `deno test --no-lock supabase/functions/send-push/`: 123 passed, 0 failed.
  - `supabase test db`: 34 files, 1041 tests, PASS.
  - `npm run db:types`: exit 0, no diff in `src/types/database.types.ts`.
  - `npm run typecheck` and `npm run lint`: clean.
  - `fnox exec -- npx playwright test --project=api` on `push-daily-sender`, `push-partner-activity-trigger` and `push-love-note-trigger`: 16 passed, run with `supabase functions serve` (stopped afterwards). The row audit reported no leftover rows.
  - `src/services/dateReminders.ts`: no diff from the baseline.
- **Residual risks:**
  - The three deferred low defects: DW-525, DW-526, and the api spec's local-midnight flake, filed in `deferred` for the loop to ledger.
  - The hosted migration and the sender's deploy go through `deploy.yml`, not this run.

## Corrections

- 2026-11-25: the Tasks line for `tests/api/push-daily-sender.spec.ts` and the Implementation Notes bullet on the api spec say it uses `assign_couple_day` for today's UTC date with no `user_time_zones` row ("so UTC"). After the first review, the spec seeds the pair with `seedPairDays`, which writes the picks and a `user_time_zones` row in the host's zone, so `user_local_date` answers the host's date.
