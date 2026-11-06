---
title: "Tomorrow's question is written in turns on the server"
type: 'feature'
ticket: '3'
created: '2026-11-06'
status: done
baseline_revision: '986d12152bee9c17fb30e5018903276257dc47f8'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Nothing lets the day's writer turn their turn into tomorrow's question, and `assign_couple_day` draws only coach rows, so a written question is never asked and a couple's own questions never join their pool (epic R3, R4, R5; spine AD-4, AD-15, AD-16).

**Approach:** One new migration adds the internal `record_written_question(viewer, day_id, this_text, that_text, at)` (AD-8) and the client RPC `submit_written_question(day_id, this_text, that_text)` as a thin wrapper at `now()`, and replaces `assign_couple_day` so it takes the pair's earliest pending written question before the pool and draws from the coach rows plus the couple's already-asked written rows. A new pgTAP file proves the turns, the next-day question, the pool fallback and every refusal; the gate file, FN-GRANT-008 and the generated types follow.

## Boundaries & Constraints

**Always:**
- `record_written_question` checks, in this order (each later check runs only when the earlier pass):
  1. viewer's `public.users.partner_id` null, or `day_id` not of the pair `(least, greatest)` → `P0002 'Day not found'`. Take `pg_advisory_xact_lock(hashtextextended('couple_days:' || user_a || ':' || user_b, 0))` (the exact key `assign_couple_day` uses) before selecting the day.
  2. viewer's own `daily_picks` row for the day missing → `DQ005`.
  3. viewer ≠ `couple_days.writer` → `DQ004`.
  4. a `daily_questions` row with `source_day_id = day_id` exists → return `daily_day_snapshot(day_id, viewer, at)`, the row unchanged (a retry, whatever its texts or `at`).
  5. `(at at time zone <own pick's stored effective_zone>)::date <> day` → `DQ006` (turn ended with its date; the pick's zone is the caller's clock, and AD-3 keeps `user_time_zones` for its listed readers).
  6. Each text trimmed of leading/trailing `\s` (`regexp_replace(coalesce(t,''), '^\s+|\s+$', '', 'g')`); either outside 1–40 `char_length`, or `lower(this) = lower(that)` → `DQ003`, each case with its own message.
  7. Target = first date after `day` with no `couple_days` row for the pair; insert (trimmed texts, pair, target, source) `on conflict on constraint daily_questions_source_day_id_key do nothing`; return the snapshot.
- `submit_written_question`: `security definer`, `set search_path = ''`, `Authentication required` on a null uid, returns `record_written_question(auth.uid(), …, now())`; `revoke … from public, anon`, `grant … to authenticated`.
- `record_written_question`: `security invoker`, `set search_path = ''`, `revoke execute … from public, anon, authenticated`, `grant … to service_role`.
- `assign_couple_day` (`create or replace`, same signature, definer, grants unchanged): after the existing-row return and the writer, take the pair's pending written row (`user_a/user_b` = pair, `target_day <= day`, no `couple_days` row has it as `question_id`) ordered by `target_day`, source day's `day`, `id`; else the random draw over coach rows plus the pair's written rows already asked on some day, excluding the current cycle's `question_id`s, rolling to `cycle + 1` over the same set. A pending row with `target_day > day` is never drawn. Writer rule, idempotence and P0002 unchanged.
- Add `daily_questions_written_has_target check (user_a is null or target_day is not null)`.
- Header comment states the rules, SQLSTATEs (DQ003–DQ006) and pgTAP files, in the style of `20261105210000`.
- Types only via `npm run db:types` on a stack reset to this branch.

**Never:** client code (api, slice, view, sheet, `daily-write-declined` — story 8); editing an applied migration; a `user_time_zones` read; updating or deleting a `daily_questions` row; a second advisory-lock key; any change to `record_daily_pick`, `get_daily_day`, `daily_day_snapshot` (its `write { mine, done }` already reads `writer` and `source_day_id`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Write | writer picked d, `at` on d, `'  Beach '`,`'Mountains'` | row `Beach`/`Mountains`, target d+1; snapshot `write {mine:true, done:true}` | — |
| Next day | assign d+1 | its question is the written row, same for A and B snapshots | — |
| Unused turn | d+1's writer writes nothing; assign d+2 | coach question; d+2's writer is d's | — |
| Ahead partner | d+1 row exists when d's writer writes | target d+2 | — |
| Two pending on one target | d (target d+2) and d+1 (target d+2) | d+2 takes d's, d+3 takes d+1's | — |
| Earlier date | assign a date before a pending row's target | not the pending row | — |
| Retry | same day, other texts, or `at` past the date | stored snapshot, row unchanged | — |
| Blank / null / 41 chars / same ignoring case | `'   '`, null, 41×`x`, `'Tea'`,`'tEA '` | nothing written | `DQ003` |
| 40 chars, tab-padded | 40×`x`, `E'\tSea'` | accepted, trimmed | — |
| Not the writer | partner who picked | nothing written | `DQ004` |
| Before own pick | writer not yet picked | nothing written | `DQ005` |
| Past date | `at` next day in the pick's zone (e.g. Tokyo pick, `at` 16:00Z same UTC date) | nothing written | `DQ006` |
| Outsider / unlinked | other couple's member, no partner | nothing written | `P0002` |
| Client RPC | today via `get_daily_day`, writer picks, submits | `write.done` true; non-writer `DQ004`; no uid → `Authentication required` | — |

</intent-contract>

## Code Map

- `supabase/migrations/20261105030000_daily_question_days_and_picks.sql:67-118` -- `daily_questions` (checks, `coach_or_written`, `source_day_id` unique + FK cascade, `couple_days.question_id` NO ACTION); `:221-315` `assign_couple_day` body to replace; `:358-449` snapshot (`write`). Read-only.
- `supabase/migrations/20261105210000_daily_question_own_clocks.sql` -- header style, internal-plus-wrapper pattern (`record_daily_pick` / `submit_daily_pick`). Read-only.
- `supabase/tests/database/41_daily_question_own_clocks.sql:1-80` -- file header, inline helpers, pair setup, coach-row reset; copy for the new file. Days built with `assign_couple_day` as postgres; set `couple_days.created_at` by update before `record_daily_pick(viewer, day, choice, picked_at, zone, offset, at)` so the DQ002 window passes.
- `supabase/tests/database/40_daily_question_gate.sql` -- `plan(100)`; header `:9-27`; DAILY-012/013 `:146-168` (six internal functions → seven); DAILY-014/015 `:170-180` (two client RPCs → three); "Everything B can call before B's own pick" `:361-372` (add `submit_written_question` as B → `DQ005`, and no question written). DAILY-080/086-092 insert written rows directly; they stay valid (checked: pending rows are o/d's or cascaded before a/b draws).
- `supabase/tests/database/18_function_execute_grants.sql:114` FN-GRANT-008 string (add `submit_written_question`, alphabetical); `:185-195` FN-GRANT-017/018 pattern → FN-GRANT-019; `plan(27)` → 28.
- `tests/support/factories/daily-question.ts` `clearPairDays` deletes a pair's days in one statement (DAILY-091 shape), so written rows cascade; no change.
- Hosted catalog read-only 2026-11-06: no `submit_written_question` or `record_written_question` there.
- Latest migration on `origin/main` is `20261105020000`; this branch's latest is `20261105210000`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261106000000_daily_question_written_questions.sql` -- constraint, `record_written_question`, `submit_written_question`, `assign_couple_day` replaced.
- [ ] `supabase/tests/database/42_daily_question_written_questions.sql` -- every matrix row with 2030 instants on pair a/b (and a third pair for pool membership: after its written row is asked, the next cycle's draws include it), plus: consecutive dates 2030-03-01..04 name alternating writers; o/d's draws over two cycles never take a/b's or the third pair's written rows; grants and `prosecdef` of both functions; the client-RPC row on o/d after its draw checks.
- [ ] `supabase/tests/database/40_daily_question_gate.sql` -- seven internal functions, three client RPCs, B's `submit_written_question` before pick, plan count, header line for story 6.3.
- [ ] `supabase/tests/database/18_function_execute_grants.sql` -- FN-GRANT-008 and FN-GRANT-019.
- [ ] `src/types/database.types.ts` -- `supabase db reset` then `npm run db:types`.

**Acceptance Criteria:**
- Given a fresh local stack on this branch, when `supabase test db` runs, then every file passes, including the alternating-writer, next-day, pool-fallback and each refusal case of `42_…sql`.
- Given the stack reset to this branch, when `npm run db:types` runs, then `git diff --exit-code src/types/database.types.ts` is clean.
- Given a linked pair on a local stack, when `tests/e2e/daily/` runs, then story 12's pick-and-reveal spec still passes.

## Implementation Notes

- Migration `20261106000000_daily_question_written_questions.sql` as planned. A null `at` fails the date check (`is distinct from`) with DQ006. Each of the three DQ003 cases has its own message (first option, second option, the two equal).
- `42_daily_question_written_questions.sql` holds 63 assertions (WRITE-001..063). It treats a "pool" day as a coach row or a written row that an earlier date already asked (`pg_temp.from_pool`), because a written row asked in an earlier cycle is legitimately redrawn.
- Gate file: DAILY-101/102 (B's `submit_written_question` before their pick → DQ005, nothing written from that day), `plan(102)`. The parent scoped DAILY-102 to the day: it had counted every written row on the stack, the same fragility as story 6.2's CLOCK-036.
- `18_…sql`: FN-GRANT-008 now lists `submit_written_question`; FN-GRANT-019 added; `plan(28)`.
- The subagent ran on an isolated stack copy. The parent re-ran every Verification command on the shared stack, which this run's single worktree owns, and that stack is left reset to this branch.

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none. The quick lens found no unmet acceptance criterion, broken rule or bug. Its two UNVERIFIED items, the types diff and the E2E spec, were run by the parent before review and passed (see Auto Run Result). It also noted that the matrix's "Unused turn" row reads "coach question" while the pool also holds the pair's already-asked written rows; WRITE-020 asserts `from_pool`, which follows the plan's pool rule (Implementation Notes). It filed this as a wording note, not a finding, so it is not counted.

## Design Notes

- Return value: the source day's AD-16 snapshot, so story 8 merges it like any other and `write.done` ends the prompt; a retry returns the same snapshot with the stored row untouched.
- Check order puts the own pick first, so every call before one's pick (the AD-5 gate case) is refused with one code, and puts the retry before the date and text checks, as picks do (AD-6).
- "Pending" is derived (no `couple_days` row asks it), never stored, so facts stay insert-only.

## Verification

**Commands:**
- `supabase db reset` (CLI 2.122.0 from `.mise.toml`) -- expected: every migration applies.
- `supabase test db` -- expected: all files pass.
- `npm run db:types && git diff --exit-code src/types/database.types.ts` -- expected: no diff after the committed regeneration.
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`.
- `npm run lint` -- expected: exit 0.
- `npx playwright test tests/e2e/daily/ --project=chromium` -- expected: passes.

## Auto Run Result

Status: built

**Summary:** The day's writer can now turn their turn into tomorrow's question on the server. The new internal `record_written_question(viewer, day_id, this_text, that_text, at)` takes the pair's advisory lock (the same key `assign_couple_day` uses) and refuses in this order:
- `P0002` outside the pair;
- `DQ005` before the caller's own pick;
- `DQ004` unless the caller is the day's writer;
- a retry returns the stored question's snapshot unchanged;
- `DQ006` once `at` is another date in the zone of the caller's pick;
- `DQ003` for a trimmed option outside 1 to 40 characters, or two options equal ignoring case.

It targets the first later date with no `couple_days` row and returns the source day's snapshot with `write.done` true. The client RPC `submit_written_question(day_id, this_text, that_text)` wraps it at `now()`. `assign_couple_day` now asks the pair's earliest pending written question (`target_day <= day`, asked by no day) before the pool, and the pool is the coach rows plus the pair's own written rows already asked. The snapshot's `write { mine, done }` already read the writer and the source day, and is now proven against real writes.

**Files changed:**
- `supabase/migrations/20261106000000_daily_question_written_questions.sql`: the `daily_questions_written_has_target` check, `record_written_question`, `submit_written_question`, and `assign_couple_day` replaced (same signature and grants).
- `supabase/tests/database/42_daily_question_written_questions.sql`: 63 assertions covering:
  - alternating writers over 2030-03-01..04;
  - the next day asking the written question for both partners;
  - an unused turn drawing from the pool;
  - a partner who is ahead, two pending rows on one target, and an earlier date never taking a pending row;
  - a written row joining the next cycle's pool, and no pair drawing another pair's row;
  - each refusal (blank, null, 41 characters, same ignoring case, not the writer, before the own pick, past date in the pick's zone, outsider, unlinked);
  - retries, grants, and the client RPC path.
- `supabase/tests/database/40_daily_question_gate.sql`: seven internal functions, three client RPCs, B's `submit_written_question` before their pick refused with DQ005 and nothing written (DAILY-101/102), `plan(102)`.
- `supabase/tests/database/18_function_execute_grants.sql`: FN-GRANT-008 lists `submit_written_question`; FN-GRANT-019; `plan(28)`.
- `src/types/database.types.ts`: regenerated with `npm run db:types` (the two new functions).

**Review findings:** 0 findings (quick lens). No patches, nothing deferred, nothing rejected.

**Follow-up review recommended: false.** First pass; no patched entries (high 0, medium 0, low 0).

**Verification (on the shared local stack, reset to this branch):**
- `supabase db reset` (CLI 2.122.0) applied every migration.
- `supabase test db` passed: 29 files, 814 tests. The implementing subagent also ran the suite 11 times on an isolated stack copy, because the pool draws are random.
- `npm run db:types` exited 0, and its output matches the committed file. The only diff from the baseline is the 14 lines for the two new functions, byte-identical to the subagent's regeneration.
- `npm run typecheck` and `npm run lint` exited 0.
- `npx playwright test tests/e2e/daily/ --project=chromium` passed (1 test), and the row audit found no leftover rows.

**Residual risks:**
- No client code calls `submit_written_question` yet; story 8 maps DQ003 to DQ006 to messages.
- The current-date check trusts the zone stored on the caller's pick. A writer who changes zone after picking is judged by the zone they picked in.
- Before the epic merges, the earlier collision at `20261105010000` has to stay resolved. DW-463 renumbered it to `20261105030000`, and this migration's `20261106000000` is past every version on `origin/main` (latest `20261105020000`).

