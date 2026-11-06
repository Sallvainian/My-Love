---
title: "The coach's pool holds at least 500 questions"
type: 'feature'
ticket: '4'
created: '2026-11-06'
status: done
baseline_revision: '1c6060369bf147a71ce190ee87123d777ea64692'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `daily_questions` has no coach rows on any stack, so `get_daily_day` raises `P0002` everywhere a test does not insert its own pool, and production would have nothing to ask (epic R5; spine Consistency Conventions: coach questions seeded by migration with fixed uuids).

**Approach:** One data-only migration upserts at least 500 coach-written this-or-that questions with fixed uuids; one pgTAP file pins the count, the option rules, plain text, no duplicates, and a draw over exactly the seeded pool that uses every question once before opening cycle 2.

## Boundaries & Constraints

**Always:**
- New migration `supabase/migrations/20261106000500_daily_question_coach_pool.sql` (later than every migration on `main` and the loop branches; data only).
- Rows are coach rows: insert `id, this_text, that_text` only (pair, `target_day`, `source_day_id` null). `on conflict (id) do update set this_text = excluded.this_text, that_text = excluded.that_text`, so a later edit migration re-runs the same form.
- Ids `da11e000-0000-4000-8000-000000000001` … counting up in the last group, written as decimal digits zero-padded to 12 (valid hex, v4 shape); never reuse `00000000-0000-4000-8000-00000000d00N` (E2E's `TEST_COACH_QUESTIONS`).
- 510–530 questions. Each option trimmed, 1–40 characters, printable ASCII only (no emoji, icons, curly quotes or accents), not ending in `?`; the two differ ignoring case. No question repeats as an unordered pair ignoring case. Each reads naturally as `"{This} or {That}?"` (e.g. `Beach vacation` / `Mountain cabin`), Title-free sentence case like the existing test rows.
- Content: warm, playful, PG questions for a couple — food, travel, home, dates, habits, seasons, entertainment, hypotheticals, small preferences. Nothing sexual, political, religious, or about money trouble, health, exes or breakups; no brand names or real people.
- pgTAP file follows `41_daily_question_own_clocks.sql:1-80`: header comment, `begin; … select * from finish(); rollback;`, inline helpers (00_helpers rolls back first).

**Never:** change any function, table, grant, policy or earlier migration; touch `src/` or `src/types/database.types.ts` (no schema change, so `db:types` must stay byte-identical); edit `tests/support/factories/daily-question.ts` or the E2E spec; edit `40_`, `41_`, `42_` pgTAP files (they already delete coach rows in their transaction).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh stack | `supabase db reset` | ≥ 500 rows with the `da11e000-` prefix, all `user_a is null` | migration fails on any check violation |
| Local stack with E2E rows | 3 `TEST_COACH_QUESTIONS` rows also present (the test inserts one non-seed coach row to stand in) | count and rule tests count only the seed prefix; the draw deletes non-seed coach rows in its transaction | — |
| Full cycle | pair draws N = seeded count consecutive dates | N distinct questions, all cycle 1, every seeded id used | — |
| Pool used up | day N + 1 | cycle 2, a seeded question | — |

</intent-contract>

## Code Map

- `supabase/migrations/20261105030000_daily_question_days_and_picks.sql:67-86` -- `daily_questions` columns and checks (`this_text !~ '^\s|\s$'`, 1–40, `lower` differ, `daily_questions_coach_or_written`). Read-only.
- `supabase/migrations/20261106000000_daily_question_written_questions.sql:243-350` -- current `assign_couple_day(user_a, user_b, day)`: coach rows plus the pair's asked written rows, excluding the current cycle's; none left → cycle + 1. Read-only; header comment style to copy.
- `supabase/tests/database/41_daily_question_own_clocks.sql:1-80` -- header, `tests.create_test_user`, linked-pair setup in `t_ids`, `delete from public.couple_days` before touching coach rows (NO ACTION FK).
- `supabase/tests/database/40_daily_question_gate.sql:757-786` -- DO-block loop of `assign_couple_day` over dates and the `count(distinct question_id) || '/' || max(cycle)` assertion shape.
- `tests/support/factories/daily-question.ts:42-79` -- E2E's three fixed-id coach rows; specs assert against the pair's assigned row, never a text, so a 500-row pool keeps them valid. Read-only.
- `supabase/tests/database/18_function_execute_grants.sql` -- unchanged: no new function.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261106000500_daily_question_coach_pool.sql` -- header comment (story 6.4, R5, the id scheme, the upsert-to-edit rule, the content rules, the pgTAP file), then one `insert … values` with one row per line and the upsert clause -- seeds the pool.
- [ ] `supabase/tests/database/43_daily_question_pool.sql` -- first insert one non-seed coach row (stand-in for E2E's rows); POOL tests: seeded count ≥ 500 and all `user_a is null`; zero seeded rows breaking trim / 1–40 / differ-ignoring-case; zero with a non-printable-ASCII character or a trailing `?`; distinct unordered lower-case pairs equal the row count; then, after `delete from public.couple_days` and deleting coach rows outside the seed prefix, `get_daily_day('UTC', 0, now())` called as authenticated A answers `status` `ok` and the day's `question_id` is a seeded id; then, after deleting the pair's days again, one linked pair's `assign_couple_day` over N consecutive dates (N = seeded count, DO-block loop) gives N distinct ids, `max(cycle) = 1`, no seeded id unused, and date N + 1 is cycle 2 with a seeded question -- proves R5.

**Acceptance Criteria:**
- Given a stack reset to this branch, when `supabase test db` runs, then every file passes, including `43_daily_question_pool.sql`.
- Given the same stack, when `npm run db:types` runs, then `git diff --exit-code src/types/database.types.ts` is clean.
- Given the seed applied, when a linked pair calls `get_daily_day` with no test rows inserted, then it answers `status: 'ok'` with a seeded question (no `P0002`).

## Implementation Notes

- Files: `supabase/migrations/20261106000500_daily_question_coach_pool.sql` (520 coach rows, ids `…000000000001`–`…000000000520`, wrapped in `begin`/`commit` as 43 of the 68 migrations are), `supabase/tests/database/43_daily_question_pool.sql` (POOL-001–011; POOL-006 pins the id scheme, an addition).
- The subagent checked the rules with a script before writing the SQL and ran the pgTAP files on a scratch copy of the database. The parent then replaced 17 rows a rule check cannot catch: near-repeats (`Cats`/`Dogs` beside `Cat`/`Dog`, `Slow dancing` beside `Slow dance`, `Pirates`/`Astronauts` beside `Be a pirate`/`Be an astronaut`, …), mismatched pairs (`Beach reads`/`Trail mix`, `Window view`/`Door view`, `Spare room`/`Guest room`), and `Cold feet`, which reads as a commitment joke in a couples app. Ids 42, 121, 131, 185, 188, 215, 326, 391, 393, 402, 406, 407, 423, 435, 453, 473, 485.
- Verified by the parent on the run's stack (this run has one worktree): `supabase db reset` applied every migration; `supabase test db` 30 files, 825 tests pass; `npm run db:types` left `src/types/database.types.ts` unchanged; 520 coach rows after the reset.

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 4, false 0, maybe-false 0 (plus 1 rejected low)
- findings:
  - `[low]` `[patch]` Near-repeats a rule check cannot catch (ids 436, 439, 432, 265, 422, 469, 350, 276, 111, 320, 326 against 152, 403, 389, 252, 273, 426, 298, 139, 94, 305, 289) — confirmed by reading both rows of each pair; the implementer replaced the 11 later rows with distinct questions. The pizza pair (29/506) was kept: the choices differ.
  - `[low]` `[patch]` Pairs that do not read as a choice (211 `Home movie`, 508 `Meat lovers`/`Veggie lovers`, 133 `Big bed`/`Cozy bed`, 159 `Basket laundry`) — replaced with `Movie at home`, `Pepperoni`/`Margherita`, `Firm mattress`/`Soft mattress`, `Fold laundry right away`/`Live out of the basket`.
  - `[low]` `[patch]` Trademarks against the no-brand-names rule (490 Frisbee, 516 Popsicle, 259 Hula hoop) — replaced with `Flying disc`, `Ice pop`, `Hopscotch`.
  - `[low]` `[patch]` Spelling and hyphenation (66 `Pad thai`, 118/484 `Camp fire`, 375 `Stand up comedy`, 171 `Fixer upper`/`Move in ready`, 86 `Home brew coffee`) — corrected to `Pad Thai`, `Campfire`, `Stand-up comedy`, `Fixer-upper`/`Move-in ready`, `Home-brewed coffee`.
  - `[low]` `[reject]` E2E's `TEST_COACH_QUESTIONS` `Coffee`/`Tea` and `Sunrise`/`Sunset` duplicate seed ids 4 and 328 on a local stack, and the factory comment's reason for the rows is now redundant — the duplicates exist only in local test data and a cycle of 520+ days, which no spec spans (each clears its pair's days first and compares against the assigned `couple_days` row); the comment's claim is still true. The root fix, dropping the now-redundant fixture rows and the spec's `ensureTestCoachQuestions` call, is more than a direct correction.

## Design Notes

- Ids carry decimal counters in the last group (`…-000000000123`), so the owner reading the PR can refer to a question by number and a later edit migration names the same id.
- Generating the SQL from a scratch list with a small script is fine; commit only the SQL. Check the rules (length, ASCII, duplicates) before writing it, so the migration never fails on a check constraint.

## Verification

**Commands:**
- `supabase db reset` (CLI 2.122.0 from `.mise.toml`) -- expected: every migration applies.
- `supabase test db` -- expected: all files pass.
- `npm run db:types && git diff --exit-code src/types/database.types.ts` -- expected: no diff.
- `psql "$(supabase status -o env | sed -n 's/^DB_URL=\"\(.*\)\"$/\1/p')" -c "select count(*) from public.daily_questions where user_a is null"` -- expected: ≥ 500.

## Auto Run Result

Status: built

- **Change:** the coach's pool is seeded with 520 this-or-that questions by a data-only migration with fixed ids, and a pgTAP file pins the size, the option rules, plain ASCII text, no repeated pair, `get_daily_day` answering `ok` from the seed alone, and a full cycle over the seed drawing every question once before cycle 2.
- **Files:**
  - `supabase/migrations/20261106000500_daily_question_coach_pool.sql` -- 520 coach rows, ids `da11e000-0000-4000-8000-000000000001`–`…520`, upsert on `id` as the edit form.
  - `supabase/tests/database/43_daily_question_pool.sql` -- POOL-001 to POOL-011.
- **Review (quick lens):** 4 low entries patched (24 rows reworded: near-repeats, unnatural pairs, trademarks, spelling); 0 deferred; 1 low rejected (E2E fixture rows duplicating two seed questions on a local stack only; reason in the triage log).
- **Follow-up review recommended:** false -- patched counts: high 0, medium 0, low 4; all wording changes to data, re-verified.
- **Verification:** `supabase db reset` applied every migration; `supabase test db` 30 files, 825 tests, PASS (43_ included); `npm run db:types` left `src/types/database.types.ts` unchanged; 520 coach rows after the reset.
- **Residual risks:** the wording is the owner's to skim in the epic PR (planned, outside the story). `tests/support/factories/daily-question.ts`'s three fixed coach rows are now redundant; removing them and the spec's `ensureTestCoachQuestions` call is a candidate for the refactor sweep (story 10). Production receives the 520 rows on the next `deploy.yml` run.
