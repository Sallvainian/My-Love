---
title: "The server assigns today's question and releases a pick's choice only to a partner who has picked"
type: 'feature'
ticket: '1'
created: '2026-11-05'
status: done
baseline_revision: 'd64c72ede3a4d93e8e8f87908d0ca3b2694ee4f3'
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
      E2E workers will share one coach pool, which clearPairDays cannot clear and NO ACTION keeps from being deleted while any day uses a row.
    evidence: |-
      Coach rows have a null pair (daily_questions_coach_or_written), so a question one worker inserts is drawn by every worker's pair. clearPairDays deletes only the worker pair's couple_days rows. couple_days.question_id is NO ACTION, so deleting a test coach row raises 23503 while another worker's day still asks it. The row audit cannot see coach rows, which have no user column. Story 12's ticket says "Tests insert their own questions", so its specs meet this under parallel workers and burn-in: flaky question text or a failing teardown. The intent hands test-pool seeding to story 12, so this story ships no seeding helper.
    location: >-
      tests/support/factories/daily-question.ts; supabase/migrations/20261105010000_daily_question_days_and_picks.sql:102
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Daily has no server: no tables for questions, days or picks, no assignment, and no gate that keeps a partner's choice hidden until the reader has picked (epic R1, R2, R5; spine AD-1, AD-2, AD-4 to AD-6, AD-15, AD-16). Story 12 builds the client on what this story ships.

**Approach:** One migration adds the three tables (RLS on, no policies, no API-role privileges), four internal functions and the two client RPCs with their final signatures; one pgTAP file proves the gate and the draw; FN-GRANT-008 and the generated types follow; one E2E factory helper clears a worker pair's days.

## Boundaries & Constraints

**Always:**
- Ordered pair `user_a < user_b` (AD-1). Ids `gen_random_uuid()`. `choice text check (choice in ('this','that'))`.
- `daily_questions`: `this_text`, `that_text` (each trimmed, 1–40 chars, differ ignoring case — table checks), `user_a`/`user_b` null for coach rows, `target_day date`, `source_day_id uuid unique` → `couple_days(id) on delete cascade`; coach rows have pair, `target_day` and `source_day_id` null, written rows have pair and `source_day_id` set.
- `couple_days`: pair, `day date`, `question_id` → `daily_questions(id)` (default NO ACTION), `cycle int not null`, `writer uuid not null` (one of the pair), `created_at`, `unique (user_a, user_b, day)`.
- `daily_picks`: `day_id` → `couple_days on delete cascade`, `user_id`, `choice`, `picked_at`, `time_zone`, `utc_offset_minutes`, `effective_zone`, `is_second boolean not null`, `created_at`, `unique (day_id, user_id)`.
- Users FKs reference `public.users(id) on delete cascade`, as `couple_settings` does; index every FK column a PK/unique index does not lead with.
- `revoke all` on all three tables from `anon, authenticated`; on `daily_picks` also from `service_role`, then `grant select (<every column but choice>)` to `service_role`.
- Internal functions: `revoke execute … from public, anon, authenticated`, `grant … to service_role`. Client RPCs: `security definer`, `set search_path = ''`, `revoke … from public, anon`, `grant … to authenticated`; pair from `auth.uid()` and `public.get_my_partner_id()`; null uid raises `Authentication required`.
- `visible_daily_picks` is the only SQL that reads `daily_picks.choice`; the snapshot's `state` may test a pick's existence without reading `choice`.
- New migration only; never edit an applied one. Types only via `npm run db:types`.

**Never:** user_time_zones, date or `picked_at` window checks (story 2); written questions or `submit_written_question` (story 3); pool seed (story 4); `nudge` field (epic 8); `reset_bot_daily_days` (story 11); any client code in `src/`; any policy, publication entry or `realtime.send`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Both fetch | linked A, B call `get_daily_day('UTC',0,now())` | same `day_id` and question; `{status:'ok',snapshot}` | — |
| Unlinked | caller with no partner | `{status:'unlinked'}`, no row created | — |
| Second before pick | A picked; B fetches | `state 'partner'`, `my_choice`/`partner_choice`/`same` null, no `"this"`/`"that"` value anywhere | — |
| Reveal | B submits | `state 'both'`, both choices, `same` true/false; B's row `is_second` true | — |
| Repeat submit | A submits other choice again | stored pick and `my_picked_at` unchanged, one row | — |
| Foreign day | outsider submits on A/B's day | nothing written | `Day not found`, `P0002` |
| Bad choice | `choice` not this/that, or null `picked_at` | nothing written | `22023`, message names no stored choice |
| Direct read | A or B selects any daily table | denied | `42501` |
| Pool used up | every coach question used in cycle n | next day opens cycle n+1 | empty pool raises `P0002` |

</intent-contract>

## Code Map

- `supabase/migrations/20260923020000_couple_settings.sql` -- ordered-pair table, RLS comment and grant shape to copy.
- `supabase/migrations/20261101000000_love_notes_read_markers.sql` -- RPC and internal-function grant shape (explicit revokes because hosted's default ACL grants each role).
- `supabase/migrations/20260205000001_fix_users_rls_recursion.sql:13` -- `get_my_partner_id()` reads `users.partner_id` for `auth.uid()`.
- `supabase/tests/database/18_function_execute_grants.sql:105` -- FN-GRANT-008 exact list and per-RPC `ok()` checks; `plan(25)`.
- `supabase/tests/database/38_countdown_marks.sql:1-50` -- pgTAP file header and inline helpers (`create_test_user` also inserts `public.users`, `authenticate_as`); helpers are declared inline because `00_helpers.sql` rolls back.
- `scripts/gen-db-types.mjs` -- `npm run db:types`; needs the CLI 2.122.0 from `.mise.toml` and a stack reset to this worktree's migrations.
- `tests/support/factories/events.ts:48,117,217` -- `WorkerPairIds`, `resolveWorkerPairIds`, `clearPairEvents`: the shape the new helper reuses.
- `tests/support/helpers/teardown.ts:46` -- ordered-pair computation for an admin delete.
- Hosted catalog checked read-only 2026-11-05: none of the new table or function names exist there.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261105010000_daily_question_days_and_picks.sql` -- create `daily_questions`, `couple_days` (then the `source_day_id` FK), `daily_picks`, RLS, revokes and grants; internal `effective_zone(time_zone text, utc_offset_minutes int) returns text`, `assign_couple_day(user_a uuid, user_b uuid, day date) returns public.couple_days`, `visible_daily_picks(viewer uuid, at timestamptz)`, `daily_day_snapshot(day_id uuid, viewer uuid, at timestamptz) returns jsonb`; client `get_daily_day(time_zone text, utc_offset_minutes int, reported_at timestamptz) returns jsonb` and `submit_daily_pick(day_id uuid, choice text, picked_at timestamptz, time_zone text, utc_offset_minutes int) returns jsonb`; header comment states rules and the pgTAP file -- AD-1 to AD-6, AD-15, AD-16.
- [ ] `supabase/tests/database/40_daily_question_gate.sql` -- the AD-5 gate file covering every matrix row plus: RLS on and zero policies on the three tables; no anon/authenticated privilege on them; service_role column SELECT on `daily_picks` except `choice` (and no table SELECT); internal functions denied to authenticated; A and B each own their pick; consecutive dates alternate `writer` and `write.mine`; `assign_couple_day` repeat returns the same row; a 3-question test pool (delete `couple_days` then coach `daily_questions` inside the transaction first) yields 3 distinct questions in cycle 1 then cycle 2 with distinct draws; `effective_zone` cases; a service_role delete of a day cascades its picks.
- [ ] `supabase/tests/database/18_function_execute_grants.sql` -- add `get_daily_day` and `submit_daily_pick` to FN-GRANT-008, one `ok()` each, bump `plan`.
- [ ] `src/types/database.types.ts` -- regenerate with `npm run db:types` after `supabase db reset`.
- [ ] `tests/support/factories/daily-question.ts` -- `clearPairDays(supabaseAdmin, pair: WorkerPairIds)`: deletes the ordered pair's `couple_days` rows (picks cascade), throws on error; doc comment says to call it before each test.

**Acceptance Criteria:**
- Given a fresh local stack on this branch, when `supabase test db` runs, then every file passes, including the gate file and FN-GRANT-008.
- Given the stack reset to this branch's migrations, when `npm run db:types` runs, then `git diff --exit-code src/types/database.types.ts` is clean after the committed regeneration.
- Given a linked worker pair with days and picks on the local stack, when `clearPairDays` runs with the service-role client, then the pair has no `couple_days` or `daily_picks` rows and no other pair's rows changed.

## Implementation Notes

- Files: `supabase/migrations/20261105010000_daily_question_days_and_picks.sql`, `supabase/tests/database/40_daily_question_gate.sql` (82 tests), `supabase/tests/database/18_function_execute_grants.sql` (FN-GRANT-008 list, FN-GRANT-017/018, plan 27), `src/types/database.types.ts` (regenerated), `tests/support/factories/daily-question.ts` (`clearPairDays`).
- `submit_daily_pick` matches the day only within the caller's current pair (via `get_my_partner_id()`) in the `for update` select, so an outsider never takes the row lock; a null zone or offset is stored as `''`/`0` (columns are not null) while `effective_zone` gets the raw values.
- Until story 4 seeds the pool, `get_daily_day` raises `P0002` on any stack with no coach questions; the gate file inserts its own three.
- Verified by the parent session: `supabase db reset`, `supabase test db` (27 files, 682 tests pass), `npm run db:types` twice gives byte-identical types, `npm run typecheck` and `npm run lint` exit 0 (no TS2883 in this worktree), and `clearPairDays` run with the service-role client from a scratch script deleted one pair's day and both its picks while another pair's day and pick stayed.

## Plan Change Log

## Review Triage Log

### 2026-11-05 — Review pass
- verdicts: 30 findings — high 0, medium 6, low 16, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) `visible_daily_picks` partner branch scans all of `daily_picks`, twice per snapshot — partner branch now starts from the viewer's own picks (`p.day_id in (select … where mine.user_id = viewer)`); semantics unchanged, gate tests still pass.
  - `[medium]` `[patch]` (blind) the gate's current-pair clause is never exercised — added a relink test: B relinked away sees no A row for the old day, and B's submit there raises P0002.
  - `[medium]` `[patch]` (blind) no test that `get_daily_day` dates by the zone sent — added Kiritimati/840 and Nowhere/Land/-720 assertions on `snapshot.day`.
  - `[low]` `[reject]` (blind) null zone/offset stored as `''`/`0` — the client always sends both from `Intl`, and the stored `effective_zone`, the value later stories apply, is computed from the raw inputs (now pinned by a test); making the columns nullable adds schema surface for a path nobody meets.
  - `[low]` `[patch]` (blind) DAILY-082 cannot fail (earlier cascades already removed every pick) — deleted; plan count updated.
  - `[low]` `[patch]` (blind) the NO ACTION design on `question_id` is unpinned — added: as service_role, deleting a source day alone raises 23503, and deleting both of the pair's days in one statement succeeds and removes the written question.
  - `[low]` `[patch]` (blind) `couple_days` is missing from the E2E leftover-row audit — added `couple_days: ['user_a','user_b']` to `AUDITED_TABLES` (count updated in `tests/unit/helpers/row-audit.test.ts`); `clearPairDays` doc now says clear before each test and defer it again at teardown.
  - `[low]` `[reject]` (blind) a new cycle can repeat yesterday's question — allowed once the pool is used up (R5), met about once per pool-length of days at 1/pool odds, and the fix adds a guard branch to the draw.
  - `[false]` `[reject]` (blind) `assign_couple_day` can return an empty row under REPEATABLE READ — PostgREST runs RPCs at the database default READ COMMITTED, where the post-lock select sees the committed row; no caller raises the isolation level.
  - `[low]` `[patch]` (blind) `effective_zone` is `security definer` for no reason; the lookup is slow and case-sensitive — made security invoker. Cost measured at about 8–17 ms per call on local, acceptable at one call per fetch or pick; the exact-case match is what spine AD-2 prescribes, so both parts were declined.
  - `[low]` `[patch]` (blind) "`choice` is readable by no role" is overstated, and nothing guards "only the gate reads choice" — comment now says no API role. A `prosrc` text-scan test was declined: no function violates the rule today, and the scan would be fragile, since `submit_daily_pick` writes `choice`.
  - `[low]` `[reject]` (blind) the plan contradicts itself (unchecked boxes, TS2883 line, Code Map ref) — the fix would edit this build's plan.
  - `[low]` `[reject]` (edge) service_role can read any choice by calling the gate with viewer = the picker — spine AD-15 keeps service_role EXECUTE on internal functions for send-push. The column revoke guards against a direct read, while "send-push never reads choice" is a code rule. Only server code holding the secret key could do this.
  - `[low]` `[patch]` (edge) full-table scan in the gate — same entry as the first row, same fix.
  - `[low]` `[reject]` (edge) a cycle boundary can repeat the last question — same entry as the blind row; rejected for the same reason.
  - `[low]` `[patch]` (edge) `btrim` strips only spaces, so tab- or newline-padded text passes the table check — both checks now use `x !~ '^\s|\s$'`; tab and newline refusals added to the tests.
  - `[false]` `[reject]` (edge) NO ACTION on `question_id` raises 23503 on a single-day delete or a user cascade — no path deletes one day of a pair (`clearPairDays` and story 11's reset delete all of the pair's days in one statement), and a user cascade removes the days and questions in one statement, so the end-of-statement check passes; the new test pins this.
  - `[low]` `[patch]` (edge) the test's day2 uses `current_date + 1`, which follows the session TimeZone — now `(now() at time zone 'UTC')::date + 1`.
  - `[low]` `[patch]` (edge) comments claim service_role holds no privilege on `daily_questions`/`couple_days` — header and table comments now say that service_role keeps its defaults there (`clearPairDays` relies on them).
  - `[medium]` `[patch]` (verification-gap) `get_daily_day` zone dating untested — same fix as the blind zone-dating row.
  - `[medium]` `[patch]` (verification-gap) stored zone fields and the null-zone path untested — day2 picks now use (`Nowhere/Land`, 330) and (null, null); the rows are asserted as `Nowhere/Land`/330/`<+0530>-05:30` and `''`/0/`UTC`.
  - `[medium]` `[patch]` (verification-gap) no test that another couple's written question stays out of a pair's draw — the o/d pair now keeps a written row through the draw section; a/b's fourth draw opens cycle 2, and none of a/b's draws is a written question.
  - `[low]` `[patch]` (verification-gap) DAILY-082 cannot fail — same fix as the blind row.
  - `[false]` `[reject]` (intent) `submit_daily_pick` is gate-tested only through its errors — a successful submit before the caller's own pick cannot exist, because that submit is the pick.
  - `[medium]` `[patch]` (intent) the gate's per-day and current-pair rules are unexercised — per-day: after A picks day2, B, who picked day1, gets no A row for day2 and a null `partner_choice`; current-pair: same relink test as the blind row.
  - `[false]` `[reject]` (intent) the draw is exercised only through `assign_couple_day` — spine AD-8 has pgTAP call the internal functions with fixed dates, and `get_daily_day` cannot take a date.
  - `[false]` `[reject]` (intent) the E2E helper is uncalled, and spine AD-15 calls the reset RPC "the one path that deletes a pick" — the ticket assigns the helper's use to story 12 and asks for the helper explicitly; it was verified against the local stack (see Implementation Notes).
  - `[false]` `[reject]` (intent) the types check cannot be verified by inspection — the parent session ran `npm run db:types` twice after a reset and got byte-identical output.
  - `[false]` `[reject]` (intent) refusing a null `picked_at` may be story 2's work — the column is `not null`, so without the check the same call fails with 23502; this is input validation, not story 2's window check.
  - `[false]` `[reject]` (intent) error messages are pinned only for the inputs tested — no defect was named; each refusal raises a fixed message that carries no stored choice.

### 2026-11-05 — Review pass (follow-up)
- verdicts: 31 findings — high 0, medium 5, low 15, false 11, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) DAILY-086 counts every pair's days, so a/b repeating a question can pass when o/d's 2031-01-01 day supplies the third distinct question — DAILY-086 and DAILY-087 now filter on a/b's pair.
  - `[low]` `[reject]` (blind) `time_zone` is unbounded text and `utc_offset_minutes` is stored unclamped — only the caller's own pick row is written, once per day, and the client sends `Intl` values. The stored `effective_zone` is clamped. Length and range checks would add guards on input no real client sends, and story 2 owns the zone store.
  - `[low]` `[reject]` (blind) service_role keeps INSERT/UPDATE/TRUNCATE on `couple_days` and `daily_questions`, so "only assign_couple_day creates a day" is a code rule, not a privilege — service_role is trusted server code (AD-15). Story 12's tests insert their own questions through the admin client. Revoking would constrain that for a misuse no shipped code makes.
  - `[low]` `[reject]` (blind) the schema does not tie a pick's user, or a written row's pair, to the day's pair — every write path is a definer RPC that derives the pair from `auth.uid()`. Composite FKs or triggers add schema surface against writes no path makes. Story 3's writer takes the same pair lock.
  - `[low]` `[reject]` (blind) a coach question cannot be deleted once asked, and there is no retire column — NO ACTION is deliberate (Design Notes), and the intent fixes the columns to the spine's, which has no retire flag. Retiring questions is a pool-management need story 4 can raise.
  - `[medium]` `[defer]` (blind) E2E workers share the coach pool, and `clearPairDays` cannot clear test questions or delete them while another worker's day uses one — real: coach rows have no pair, and `question_id` is NO ACTION. The epic gives test-pool seeding to story 12 ("Tests insert their own questions"), so it is out of this ticket's intent. Recorded in `deferred`.
  - `[low]` `[reject]` (blind) `clearPairDays` copies the ordered-pair ternary from `teardown.ts:50` — no exported helper exists to import (searched `tests/support`). Extracting one means refactoring `teardown.ts`, past a direct correction, for a one-line duplicate; Supabase returns uuids in lowercase, so JS order matches.
  - `[low]` `[reject]` (blind) `daily_day_snapshot` checks pair membership, not the current pair, so a left pair's day could show `state 'both'` with null choices — no shipped RPC reaches it: `get_daily_day` assigns only the current pair's day, and `submit_daily_pick` matches the current pair. The later RPCs that pass old day ids own that check.
  - `[low]` `[patch]` (blind) DAILY-008 leaves out MAINTAIN, and DAILY-011 leaves out TRUNCATE (plus REFERENCES, TRIGGER, MAINTAIN) — both privilege lists are now complete; they pass on Postgres 17.
  - `[low]` `[patch]` (blind) nothing tests that relinking the same partner restores the reveal (AD-1) — added DAILY-100: after the links are restored, the gate returns A's day-1 choice to B again.
  - `[low]` `[patch]` (blind) DAILY-066 checks only `time_zone` after the repeat submit — it now asserts `time_zone`, `utc_offset_minutes`, `effective_zone`, `is_second` and `choice` together.
  - `[false]` `[reject]` (blind) a written row may have a null `target_day` — the spine (line 257) has written rows carry "`target_day` while pending", so a null is the state after the question is asked, not a row that can never be drawn.
  - `[low]` `[reject]` (blind) the text check allows newlines or control characters inside a question — the spine asks only for trimmed text of 1 to 40 characters. Pool text is seeded by migration, and user-written text arrives in story 3, whose RPC owns its input rules. A new character-class guard goes past the spec.
  - `[low]` `[reject]` (edge) service_role can read any choice by calling the gate with viewer = the picker — carried: same claim as the first pass's row, and the code still reads as described (AD-15 keeps service_role EXECUTE).
  - `[low]` `[reject]` (edge) a cycle boundary can repeat the previous day's question — carried: same claim and same code as the first pass's row.
  - `[false]` `[reject]` (edge) the offset clamp's lower bound is -840 where real zones stop at -720 — no real device sends an offset below -720 (`Intl` offsets span -720 to +840). Any value there is invalid input, and clamping it to -720 would be just as arbitrary; the clamp only bounds the POSIX spec.
  - `[low]` `[reject]` (edge) unbounded `time_zone` and an unclamped stored offset — same entry as the blind row; rejected for the same reason.
  - `[low]` `[reject]` (edge) a zone name in the wrong case falls back to a fixed offset — carried: the first pass declined it because spine AD-2 prescribes the exact-case match, and the code is unchanged.
  - `[medium]` `[patch]` (edge) DAILY-086 counts other pairs' days — same entry and fix as the blind row.
  - `[medium]` `[patch]` (verification-gap) the snapshot's question text is never compared with the drawn row — added DAILY-097: A's `snapshot.question` equals `{this, that}` of the row behind `couple_days.question_id`; a missing question fails through the `coalesce`.
  - `[medium]` `[patch]` (verification-gap) `write.done` is only ever asserted true — added DAILY-098 (false before any question is written) and DAILY-099 (false on a/b's day while o/d's day holds a written question).
  - `[low]` `[reject]` (verification-gap) the Implementation Notes say 82 tests while the file plans 96 — the fix would edit this build's plan.
  - `[false]` `[reject]` (verification-gap) `clearPairDays` has no caller — carried: the ticket assigns its use to story 12. It was run against the local stack again on this pass (see Auto Run Result).
  - `[false]` `[reject]` (intent) `submit_daily_pick` is gate-tested only through its errors — carried: a successful submit is the caller's own pick.
  - `[false]` `[reject]` (intent) the "count" from the intent is never tested — this story's snapshot has no count field. The streak that AD-5's count refers to lands in a later epic, and DAILY-038 pins the exact key set.
  - `[false]` `[reject]` (intent) the draw excludes the couple's own written questions, while R5/AD-4 add them to the couple's pool — the ticket says "no written questions yet". Story 3 adds the written-question path and its priority to the draw.
  - `[false]` `[reject]` (intent) the diff also revokes service_role's write privileges on `daily_picks` — removing service_role's default table SELECT takes `revoke all`. Picks are written only through the RPC, and DAILY-081 shows the cascade still runs under service_role; no bad outcome.
  - `[false]` `[reject]` (intent) `effective_zone` returns a POSIX text zone, not an interval — a fixed-offset POSIX spec has no DST, so it equals the interval at every instant. DAILY-025/026 pin both signs.
  - `[false]` `[reject]` (intent) the E2E helper is uncalled — carried; same as the verification-gap row.
  - `[false]` `[reject]` (intent) nothing shows `npm run db:types` was run — carried. On this pass it was run again after `supabase db reset`, and `git diff --exit-code` was clean.
  - `[false]` `[reject]` (intent) `get_daily_day` raises P0002 until a pool exists — the intent gives the seed to story 4; this is recorded as a residual risk.

## Design Notes

- `effective_zone` returns text because one function cannot return both a zone name and an interval. Unknown names fall back to a POSIX spec written with the sign Postgres expects, `<+0530>-05:30` for +330, so `at time zone effective_zone(...)` equals `at time zone interval '05:30'` (checked on local Postgres 17.11). A null or empty name with a null offset gives `UTC`; the offset is clamped to ±840. It never raises. pgTAP pins the interval equality for a positive and a negative non-hour offset.
- `source_day_id … on delete cascade`: clearing a couple's days (E2E helper, story 11's reset) must also clear what those days wrote; `question_id` uses NO ACTION so a single delete of all the pair's days passes.
- Day of a fetch: `(now() at time zone effective_zone(time_zone, utc_offset_minutes))::date`. `reported_at` is accepted and unused until story 2. `at` on the gate and snapshot is unused until epics 7/8 and is kept for the spine signatures.
- Writer: `user_a` when `mod(day - date '2000-01-01', 2) = 0`, else `user_b`. Lock key: `pg_advisory_xact_lock(hashtextextended('couple_days:' || user_a || ':' || user_b, 0))`.
- Draw: coach rows only (`user_a is null`) not used in the pair's current cycle (`coalesce(max(cycle),1)`), `order by random() limit 1`; none left → cycle + 1 over all coach rows; still none → raise.
- `submit_daily_pick` locks the day `for update` (serialises `is_second`), returns the stored snapshot when the caller's pick exists, else inserts with `on conflict (day_id, user_id) do nothing`. Plpgsql params share column names: qualify params as `submit_daily_pick.day_id`, columns with table aliases.
- Snapshot keys exactly `day_id, day, question {this, that}, state, my_choice, my_picked_at, partner_choice, same, write {mine, done}`; returns null when the viewer is not in the day's pair; `write.done` is whether a `daily_questions` row has this `source_day_id`.

## Verification

**Commands:**
- `supabase db reset` -- expected: every migration applies.
- `supabase test db` -- expected: all files pass.
- `npm run db:types && git diff --exit-code src/types/database.types.ts` -- expected: no diff after the committed regeneration.
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`.
- `npm run lint` -- expected: exit 0.
- `clearPairDays` run once against the local stack from a scratch script -- expected: the pair's days and picks are gone.

## Auto Run Result

Status: built

**Summary:** This was the follow-up review pass on story 6.1's server half of the Daily tracer: the migration with three tables, four internal functions and the `get_daily_day` / `submit_daily_pick` RPCs, the AD-5 gate pgTAP file, FN-GRANT-008, the regenerated types and `clearPairDays`. It found no defect in the migration, RPCs, types or helper. It tightened the gate file: the draw check could pass on a broken draw, the snapshot's question text and a false `write.done` were never asserted, and three privilege and repeat-submit checks were incomplete.

**Files changed (this pass):**
- `supabase/tests/database/40_daily_question_gate.sql`: `plan(100)`.
  - DAILY-086/087 are filtered to a/b's pair.
  - DAILY-008 now includes MAINTAIN, and DAILY-011 lists every table privilege.
  - DAILY-066 asserts the whole stored row.
  - New tests:
    - DAILY-097: the question text matches the drawn row.
    - DAILY-098/099: `write.done` is false on an unwritten day and with another couple's written question present.
    - DAILY-100: relinking the same partner restores the reveal.

**Files changed (story, first pass, unchanged here):** `supabase/migrations/20261105010000_daily_question_days_and_picks.sql`, `supabase/tests/database/18_function_execute_grants.sql`, `src/types/database.types.ts`, `tests/support/factories/daily-question.ts`, `tests/support/helpers/row-audit.ts`, `tests/unit/helpers/row-audit.test.ts`.

**Review findings:** 31 findings: high 0, medium 5, low 15, false 11.
- **Patched:** 6 entries, all in the gate file: 3 medium and 3 low.
  - medium: DAILY-086 pair filter (blind and edge); snapshot question text; `write.done` false.
  - low: complete privilege lists; same-partner relink; full-row repeat check.
- **Deferred:** 1 medium. The E2E coach pool is shared across workers and cannot be cleared; story 12 owns test seeding.
- **Rejected:** 24. Each one's reason is in the Review Triage Log.
  - low:
    - zone input unbounded (blind and edge)
    - service_role keeps writes on `couple_days`/`daily_questions`
    - no schema tie from pick or written row to the day's pair
    - no retire column
    - duplicated ordered-pair ternary
    - snapshot ignores the current pair (unreachable)
    - interior control characters
    - service_role reading through the gate (carried)
    - cycle-boundary repeat (carried)
    - case-sensitive zone match (carried)
    - plan test count (fix edits the plan)
  - false:
    - nullable `target_day` (spine: set while pending)
    - -840 clamp bound
    - helper uncalled (carried, twice)
    - submit gated through errors (carried)
    - no count field yet
    - written questions out of the draw (story 3)
    - service_role write revoke on `daily_picks`
    - POSIX zone text
    - types run (carried, re-run)
    - empty pool until story 4

**Follow-up review recommended: false.** This is a follow-up pass and it patched no high; patched by verdict: medium 3, low 3.

**Verification (after the patches):**
- `supabase db reset` applied every migration.
- `supabase test db` passed 27 files and 700 tests, the gate file included.
- `npm run db:types` exited 0, and `git diff --exit-code src/types/database.types.ts` was clean.
- `npm run typecheck` exited 0.
- `npm run lint` exited 0.
- `npx vitest run tests/unit/helpers/row-audit.test.ts` passed 19 tests.
- `clearPairDays` was run with the service-role client against the local stack, from a temporary script removed afterwards. It cleared one pair's day and both picks (0/0) and left the other pair's day and two picks (1/2). The scratch rows were then deleted.

**Residual risks:**
- `get_daily_day` raises P0002 until story 4 seeds the pool.
- The shared E2E coach pool is deferred to story 12.
- `effective_zone` costs about 8–17 ms per call.
- The migration has not been applied to hosted; `deploy.yml` applies it when the epic merges.
