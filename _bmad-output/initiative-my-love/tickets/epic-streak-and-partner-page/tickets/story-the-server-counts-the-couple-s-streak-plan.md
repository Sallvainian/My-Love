---
title: 'The server counts the couple''s streak'
type: feature
ticket: '1'
created: '2026-11-07'
status: done
baseline_revision: '8250e3dec91172e4488de7d7fa743670ab154021'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The couple's streak (held total, current run, today's colour, milestones, Same count, the week strip, the missed-in-a-row count) exists nowhere; story 2's Partner page and later Daily need one server projection so no client works out a day's state.

**Approach:** One migration adds spine AD-7's internal `couple_streak(user_a, user_b, viewer, at)` computing everything from `couple_days`, `daily_picks`, `user_time_zones` and the gate at the instant given, and the client RPC `get_couple_streak()` answering `{status:'ok', streak}` or `{status:'unlinked'}`; pgTAP pins it over fixed 2030 instants, the gate and grant files list it, types are regenerated.

## Boundaries & Constraints

**Always:**
- Nothing is stored: every value is derived at call time, so a late pick corrects the count by itself (R8).
- Day `d` of the pair is **done** when both partners' picks exist. It is **closed** when `(at at time zone z)::date > d` for both partners, where `z` is that partner's `daily_picks.effective_zone` from their own pick of `d`, else their `user_time_zones.effective_zone`, else `'UTC'` (AD-3). **Missed** = closed and not done, for every calendar date from the pair's first `couple_days.day`, dates with no row included. Otherwise **open**.
- The viewer's date ("today") is `at` in the viewer's stored zone (`'UTC'` with no row).
- `held` = `done` = count of done dates; `milestones` = `floor(held / 25)`; `run` = done dates after the newest missed date (all done dates if none); `missed` = missed dates after the newest done date (all missed if none); `today_state` = `orange` when today is done, else `blue` when the newest closed date is missed, else `grey`; `same` = done dates whose two choices, both read through `visible_daily_picks(viewer, at)`, are equal; `week` = 7 objects `{day, state}` oldest first ending today, `state` in `done | missed | open` (dates before the first day are `open`).
- `couple_streak`: plpgsql, stable, security definer, `search_path = ''`, raises 22023 unless `user_a < user_b` and viewer is one of them; revoke EXECUTE from public, anon, authenticated (each named), grant service_role.
- `get_couple_streak()`: security definer, `search_path = ''`, 'Authentication required' for a null `auth.uid()`, `{status:'unlinked'}` when `get_my_partner_id()` is null, else `{status:'ok', streak: couple_streak(least, greatest, uid, now())}`; revoke from public, anon; grant authenticated. Reads only.

**Never:** store a streak or any column; take a pair, viewer or `at` in the client RPC; read `daily_picks.choice` except through `visible_daily_picks`; hand-edit `src/types/database.types.ts`; touch client code (story 2); write `user_time_zones`; reset or drop data outside the pgTAP transaction.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sequence (UTC pair) | 07-01 done same, 07-02 done different, 07-03 no row, 07-04 one pick; at 07-05 12:00Z | held 2, run 0, missed 2, blue, same 1, week `open,open,done,done,missed,missed,open` | — |
| Open day never breaks run | same pair at 07-03 00:30Z | run 2, missed 0, grey | — |
| Blue until both pick | one pick on 07-05, then the second | blue, then orange, held 3, run 1, missed 0 | — |
| An hour apart | A New York, B Chicago (stored), d has A's pick only | at 04:30Z d+1 d is open, grey; at 05:00Z missed, blue | — |
| Late pick (R8) | NY pair; B's pick picked_at 23:50 local, recorded at 00:10 local | before: d missed, held n; after: held n+1, d done | — |
| Relink same partner | days done, then unlinked dates with no row, relinked | gap dates missed, run 0 | — |
| Unlinked caller | no partner | `{status:'unlinked'}` | — |
| No auth / bad args | null `auth.uid()`; viewer outside pair | — | 'Authentication required'; 22023 |
| Gate | B before own pick on a day A picked | today not counted in held, done, same, run; week today `open`; no `this`/`that` in the answer | — |

</intent-contract>

## Code Map

- `supabase/migrations/20261105030000_daily_question_days_and_picks.sql` -- tables `couple_days`, `daily_picks`; `visible_daily_picks`, `get_daily_day` shape to copy (header style, revoke/grant lines). Read-only.
- `supabase/migrations/20261105210000_daily_question_own_clocks.sql` -- `user_time_zones`, `record_user_time_zone`, `record_daily_pick` (DQ001/DQ002 window: picked_at ≥ day `created_at` − 5 min, ≤ `at` + 5 min). Read-only.
- `supabase/migrations/20261106010000_daily_question_day_by_id.sql` -- smallest client-RPC template (header, `least/greatest` pair, grants).
- `supabase/migrations/20261107000000_daily_question_write_target_day.sql` -- current `daily_day_snapshot`; its `same` is `my_choice = partner_choice` through the gate. Do not change it.
- `supabase/tests/database/40_daily_question_gate.sql` -- AD-5 gate file: header story list, `plan(112)`, DAILY-012/013 internal lists (seven), DAILY-014/015 client lists (five), unauthenticated block (~l.280), unlinked block, "Everything B can call before B's own pick" (~l.389), assertions after B's pick (~l.568). Highest id DAILY-112.
- `supabase/tests/database/18_function_execute_grants.sql` -- FN-GRANT-008 exact alphabetical list (l.114), per-RPC ok() through FN-GRANT-021, `plan(30)`.
- `supabase/tests/database/41_daily_question_own_clocks.sql` -- fixture template: inline helpers, 2030 dates, `assign_couple_day` then `update couple_days set created_at`, picks via `record_daily_pick` with fixed `at`, zones via `record_user_time_zone`.
- `scripts/gen-db-types.mjs` / `npm run db:types` -- regenerates `src/types/database.types.ts` (expect one `get_couple_streak: { Args: Record<PropertyKey, never>; Returns: Json }` line).

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261107010000_couple_streak.sql` -- create `couple_streak` and `get_couple_streak` per Always, with a header in the house style (what changes, rules, grants, hosted catalog note, pgTAP files) -- the projection.
- [ ] `supabase/tests/database/45_couple_streak.sql` -- new pgTAP file covering every I/O matrix row with fixed 2030 instants through `couple_streak`, plus the relink and unlinked cases through `get_couple_streak` at `now()` (direct postgres inserts of `couple_days`/`daily_picks` relative to the UTC date of `now()` are fine there), structure (security definer, `search_path`, grants), exact streak keys, and 22023 -- R1, R2, R3, R5, R8 proof.
- [ ] `supabase/tests/database/40_daily_question_gate.sql` -- add `couple_streak(uuid, uuid, uuid, timestamptz)` to the internal lists (eight) and `get_couple_streak()` to the client lists (six); null-auth refusal; unlinked status; B calls it before own pick and asserts held/done/same/run 0, today_state grey, week's last entry `open`, no `this`/`that` anywhere; after B's pick held 1, orange; update header and `plan()` -- AD-5.
- [ ] `supabase/tests/database/18_function_execute_grants.sql` -- add `get_couple_streak` to FN-GRANT-008's list and an FN-GRANT-022 ok(); bump `plan()` -- FN-GRANT-008.
- [ ] `src/types/database.types.ts` -- regenerate with `npm run db:types` only -- AD-15.

**Acceptance Criteria:**
- Given the local stack with every migration applied, when `supabase test db` runs, then every file passes, including 18, 40 and 45.
- Given the regenerated types, when `npm run db:types` runs again, then `git diff --exit-code src/types/database.types.ts` shows no change.
- Given an authenticated linked caller, when they call `get_couple_streak()`, then the answer's `streak` carries exactly `held, run, today_state, milestones, same, done, missed, week`.

## Implementation Notes

- 2026-11-07: `today_state` is blue when `missed > 0` (a missed date after the newest done date), refining the Always rule "the newest closed date is missed". The two agree whenever the newest done date is closed; they differ when a date done by both is not yet closed on one partner's clock (New York past midnight, Chicago not) and is newer than a closed missed date, where the old rule went grey with `missed` 0 and the cold banner would have read 0 days missed after both picked again, against R3 "blue until both partners pick again".
- 2026-11-07: correction to the line above: under the old rule that state came out `blue` with `missed` 0, not grey; the new rule makes it grey.

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 27 findings — high 0, medium 4, low 11, false 7, maybe-false 0 (5 grouped rows share a medium or low root)
- findings:
  - `[medium]` `[patch]` (blind) today_state blue with missed 0 when a date done by both is newer than a closed missed date but not yet closed on the later partner's clock — reachable for any couple an hour apart in the hour after the earlier midnight; R3 says blue only until both pick again. Fixed: blue is `missed > 0`; new `cold` pair case pins grey.
  - `[low]` `[patch]` (blind) STREAK-008 `aclexplode(proacl)` yields no rows for a NULL default ACL — fixed with `coalesce(p.proacl, acldefault('f', p.proowner))`.
  - `[medium]` `[patch]` (blind) no test separates the viewer's stored-zone date from the UTC date — grouped with verification-gap #2; added the 21:00 New York case (orange, week ends 09-01).
  - `[medium]` `[patch]` (blind) pick zone over stored zone never tested — grouped with verification-gap #3; added the Los Angeles stored-zone case after STREAK-025.
  - `[low]` `[patch]` (blind) nothing checks `same` against the snapshot's marks — added an assertion summing `daily_day_snapshot ->> 'same'` for the seq pair.
  - `[low]` `[patch]` (blind) closed test duplicated in `states`; zone fallback re-joined — closed now computed once in a `closure` CTE; the `za`/`zb` joins are kept, since mapping viewer/partner zones back to a/b would add a branch.
  - `[low]` `[reject]` (blind) `put` fixture stores `utc_offset_minutes` 0 for New York/Chicago — `couple_streak` reads only `effective_zone`, so no result changes; the fix adds a parameter to every fixture call.
  - `[low]` `[patch]` (blind) unlink fixtures clear only A's `partner_id` — both sides now cleared and restored.
  - `[low]` `[patch]` (blind) R8 before/after read at 12:00 next day — now read at 00:05 and 00:15 New York, values unchanged.
  - `[false]` `[reject]` (blind) plan tasks unchecked and notes empty — the fix is editing this build's plan, which triage rejects; this result records the work instead.
  - `[false]` `[reject]` (edge) picks newer than `at` count as done — no caller passes a past instant: `get_couple_streak` passes `now()`, and send-push will too (AD-7); filtering on `created_at` would also break every fixed-2030 test, since rows are created at real time.
  - `[false]` `[reject]` (edge) viewer's own date can show missed when their pick zone is ahead of their stored zone — that date is closed on both clocks (AD-3), so the partner can no longer pick it, and missed is the true state; the new Los Angeles case shows it on purpose.
  - `[low]` `[patch]` (edge) STREAK-008 NULL ACL — same root as blind #2; same fix.
  - `[false]` `[reject]` (edge) stored zones and picks are read as they are now, not as of `at` — same refutation as edge #1: no caller asks about a past instant, and AD-3 keeps one current stored zone with no history.
  - `[medium]` `[patch]` (verification-gap) no case has a missed date followed by a closed done date — added seq at 07-06 12:00Z expecting `3/1/0/grey/2`.
  - `[medium]` `[patch]` (verification-gap) the viewer's date never differs between stored zone and UTC — the 21:00 New York orange case (grouped with blind #3).
  - `[medium]` `[patch]` (verification-gap) pick zone never shown to win over stored zone — the Los Angeles stored-zone case, viewer A `0/0/1/blue/0` (grouped with blind #4).
  - `[low]` `[patch]` (intent) `same` computed in `couple_streak`, not summed from snapshots — grouped with blind #5; the equality assertion pins the two together.
  - `[low]` `[patch]` (intent) the relink test doesn't model a real unlink — grouped with blind #8; both sides are now unlinked. Days passing while unlinked leave no rows, which is exactly what the case seeds.
  - `[low]` `[patch]` (intent) gate zeros follow from the done rule; `missed` not asserted — DAILY-116 now includes `missed` (`0/0/0/0/0`).
  - `[false]` `[reject]` (intent) the late pick goes through `record_daily_pick`, not `submit_daily_pick` — the client RPC is a thin wrapper at `now()`, which pgTAP cannot move; AD-8 has pgTAP call the internal functions at fixed instants.
  - `[low]` `[patch]` (intent) partners an hour apart: only one arrangement covered, no DST case — the pick-zone part is fixed by the Los Angeles case (grouped with blind #4). The DST part is not worth a fix: closure compares local dates, so there is no DST arithmetic to test.
  - `[false]` `[reject]` (intent) unlinked and relink cases run at `now()` — the client RPC can only run at `now()`, and the plan's task allows it.
  - `[low]` `[patch]` (intent) types gained two entries where the Code Map said one — added a dated line to `## Corrections`.
  - `[low]` `[patch]` (intent) partners in different zones never shown getting different values — grouped with blind #3: the Los Angeles case asserts that A's week ends 08-10 and B's ends 08-11.
  - `[false]` `[reject]` (intent) additions beyond the intent (22023, FN-GRANT-022, structure checks) — the auditor itself found that none conflicts with the intent.
  - `[low]` `[reject]` (intent) milestones checked only at 24 and 25 — `floor(held / 25)` is one expression, and the boundary pins it; more points would add no coverage.

### 2026-11-07 — Review pass (follow-up)
- verdicts: 19 findings — high 0, medium 0, low 9, false 9, maybe-false 1 (B1 and intent #1 share one root; B4 and verification-gap #1 share one root)
- findings:
  - `[low]` `[reject]` (blind) spine AD-7 still says blue is "the newest closed day was missed", and the code uses `missed > 0` — real, but the fix would edit the spine. The epic's Notes (Decision 2026-11-07) say the PO does not edit spine AD-7 and the epic's Constraints carry the addition. No consumer recomputes the rule either: story 4 and epic 8 read the served `today_state` and `missed`. The migration header and Implementation Notes record the change.
  - `[false]` `[reject]` (blind) picks newer than `at` count as done; the claim now cites send-push's closure check at `picked_at` — carried: same location and claim as the first pass's edge row, and `20261107010000_couple_streak.sql:150-151` still joins picks without an instant filter.
  - `[maybe-false]` `[reject]` (blind) the closure rule has no reusable home, so epic 8 will write it again — epic 8 is not refined yet, so whether it needs closure for a done day at a past instant is open. Refining epic 8 against AD-7 would settle it. If true it is low: a later internal helper, no wrong answer today.
  - `[low]` `[patch]` (blind) the no-day early return hand-builds its own answer, and nothing checks its keys, `done`, `milestones` or week dates — grouped with verification-gap #1. Added STREAK-044/045/046 on the `empty` pair: exact keys, `0/0`, seven `{day, state}` entries 06-29 to 07-05. plan 43 → 49 with the null-argument rows.
  - `[low]` `[reject]` (blind) the viewer's today uses the stored zone, though AD-3 says a fetch dates itself with the zone it sends — real only while the stored zone is stale (a zone change before any `get_daily_day`). The fix gives the RPC a zone argument, which the intent's `get_couple_streak()` signature excludes. AD-3 also lists closure (AD-7) among the stored zone's readers.
  - `[low]` `[patch]` (blind) the migration header's cold-case sentence reads as if that state were blue — reworded at `20261107010000_couple_streak.sql:32-38`: that state is grey with missed 0, and blue ends once a done date is newer than every missed one. A comment only; the function body and its `comment on` text are unchanged.
  - `[false]` `[reject]` (blind) the gate assertions DAILY-116 to 118 can't fail for any gate regression — what they pin is what the intent asks: nothing returned before B's own pick counts today. A direct read of `choice` could not leak anything there either, because `same` counts only done days. The structural gate proof for `same` is STREAK-022.
  - `[low]` `[patch]` (blind) only the null-viewer check is tested of the four null arguments — added STREAK-047 (null `at`), 048 (null `user_a`) and 049 (null `user_b`), each 22023.
  - `[false]` `[reject]` (blind) `couple_streak` never checks the pair is still linked — no caller can pass a stale pair. `get_couple_streak` passes `get_my_partner_id()`, a current link, and send-push does not call it yet. The intent's relink rule wants the count to ignore the link history.
  - `[false]` `[reject]` (edge) picks with `created_at` after `at` count as done — carried: same as the first pass's edge row; the code at the joins is unchanged.
  - `[low]` `[patch]` (verification-gap) the no-day branch's keys, `done`/`milestones` and week dates are unasserted — pre-verified gap, grouped with blind #4; same fix (STREAK-044 to 046).
  - `[low]` `[reject]` (intent) the diff follows R3 over spine AD-7's literal blue rule — same root as blind #1, same reason: the epic bars editing the spine, and the intent's own `missed` and "blue until both pick" readings are what the code implements.
  - `[false]` `[reject]` (intent) R8's late pick goes through `record_daily_pick`, not `submit_daily_pick` — carried: same claim as the first pass's intent row.
  - `[low]` `[patch]` (intent) the relink is a direct `partner_id` UPDATE with no time passing — carried: same claim as the first pass's intent row (both sides cleared and restored, STREAK-037 to 040). Not patched again.
  - `[false]` `[reject]` (intent) the viewer's own today can show missed — carried: same claim as the first pass's edge row on pick zone versus stored zone (STREAK-028).
  - `[false]` `[reject]` (intent) the count growing is never shown for partners an hour apart — STREAK-034 asserts held 1, run 1 for a New York and Chicago pair with a date done by both, and STREAK-026/027 cover closure after the later midnight.
  - `[low]` `[patch]` (intent) `same` is re-derived and equals the snapshot at one instant only — carried: same claim as the first pass's intent row (STREAK-021). Not patched again.
  - `[false]` `[reject]` (intent) "types unchanged" is unverified by inspection — `npm run db:types` run on this pass leaves `src/types/database.types.ts` unchanged (`git diff --exit-code` exit 0).
  - `[false]` `[reject]` (intent) the chip, banner, week strip and badge screen are not built — the intent is the server half ("story 2 builds the Partner page on it").

## Design Notes

- `held` and `done` are equal by definition today (no freeze); both are returned because the spine names both and the Partner page's "{same} of your {done} days" reads `done`.
- `same` uses `visible_daily_picks` directly rather than calling `daily_day_snapshot` per day: the snapshot's `write.target_day` walk would run once per day. The expression is the snapshot's own (`my_choice = partner_choice`, both through the gate), so AD-7's "sums those same marks" holds.
- Closure by local date comparison, not by constructing a midnight timestamp, is DST-safe.
- Date range: `generate_series(first_day, greatest(today_viewer, today_partner, max(couple_days.day)))` using stored zones for the todays; later dates cannot be closed or done.

## Verification

**Commands:**
- `supabase migration up --local` (or `supabase db reset --local` when the stack holds another branch's migrations) -- expected: applies 20261107010000 cleanly.
- `supabase test db` -- expected: all files pass.
- `npm run db:types && git diff --exit-code src/types/database.types.ts` (after committing the regenerated file) -- expected: no diff.
- `npm run typecheck` -- expected: no errors other than the worktree TS2883 baseline in `tests/support/merged-fixtures.ts`.

## Corrections

- 2026-11-07: the Code Map said `npm run db:types` adds one `get_couple_streak` line; it adds two entries, `couple_streak` (`Args: { at: string; user_a: string; user_b: string; viewer: string }; Returns: Json`) and `get_couple_streak`, because the generator lists internal functions too.

## Auto Run Result

Status: built (follow-up review pass)

**Summary:** This pass reviewed the built story again, after the first pass's patches. The story is the migration `20261107010000_couple_streak.sql`, which adds the internal `couple_streak(user_a, user_b, viewer, at)` and the client RPC `get_couple_streak()`, plus its pgTAP coverage, the gate and grant list entries and the regenerated types. Three low patches were applied: two add test rows and one rewords a comment. Function behaviour is unchanged.

**Files changed (this pass):**
- `supabase/migrations/20261107010000_couple_streak.sql`: header comment on the blue rule reworded. The SQL and the `comment on` text are untouched.
- `supabase/tests/database/45_couple_streak.sql`: STREAK-044 to 046 (the no-day answer's keys, `done`/`milestones`, week entries and dates), STREAK-047 to 049 (null `at`, `user_a`, `user_b` raise 22023), header line, `plan(49)`.

**Review (thorough, follow-up; lenses blind-hunter, edge-case-hunter, verification-gap, intent-alignment):** 19 findings: low 9, false 9, maybe-false 1, no high or medium.
- **Patched (3 entries, all low):**
  - the no-day branch's answer is now asserted (blind #4 with verification-gap #1);
  - the header's cold-case wording;
  - the three untested null arguments.
- **Carried from the first pass:** 6 rows, none patched again.
- **Rejected:**
  - the spine AD-7 wording drift (two rows): the epic bars editing the spine;
  - the stored-zone "today": the fix needs a zone argument, which the intent's signature excludes;
  - the closure helper for epic 8: maybe-false, low if true;
  - the gate-file strength, the unlinked-pair guard, the hour-apart count, unverified types and client surfaces: each false, with its refutation in the triage log.
- **Deferred:** nothing.

**Follow-up review recommended: false.** This is a follow-up pass, and it patched no `high` entry. Patched counts by verdict: high 0, medium 0, low 3.

**Verification:**
- `supabase test db` (CLI 2.122.0 via mise): 32 files, 930 tests, PASS. That is 924 before plus 6 new.
- `npm run db:types` followed by `git diff --exit-code src/types/database.types.ts`: exit 0, no change.
- `npm run typecheck`: exit 0.
- The migration edit is a SQL comment only, so the local stack's applied function did not need re-applying.

**Residual risks:**
- `get_couple_streak` dates the viewer's today by the stored zone. If a device changes zone and opens the Partner page before any `get_daily_day` fetch, the week can end a day off from Daily. Story 2 may want the Partner page to fetch Daily's day first.
- Spine AD-7 still says blue is "newest closed day missed" until a `bmad-architecture` update folds in this epic's Constraints.
- Story 2 has not consumed `week` or `missed` yet.
