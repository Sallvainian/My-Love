---
title: 'sim dates clear also removes countdown marks and turns date reminders back on'
type: 'chore'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'b0111a0756e32ff11988ae31e2221ff2c8495f08'
route: 'oneshot'
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

**Problem:** DW-397: `clearDates` in `scripts/sim-driver/dates.ts` deletes events, anniversaries, the pair's couple settings and both birthdays, but leaves Casey's and Jessie's `countdown_marks` rows and a switched-off `push_preferences.date_reminders`, so leftovers from a story 4.2 or 4.3 check change what later `sim dates kinds|many` seeds plan.

**Approach:** In `clearDates`, also delete both people's `countdown_marks` rows and set `push_preferences.date_reminders = true` on both people's existing rows (a missing row already means on, so no row is created). Update the header comment, the `clear` console line and the `sim dates` paragraph of `sim help` in `scripts/sim-driver/sim` to say so. The AGENTS.md sentence about `sim dates` belongs to DW-385 and is not edited here.

</intent-contract>

## Implementation Notes

Oneshot: two files, under 20 changed lines, all in the local-only sim driver. `kinds` and `many` call `clearDates` first, so both inherit the fix. The reset is an `update` (`.in('user_id', both)`), not an upsert, because the migration (`20261101020000_date_reminders_switch.sql`) defines a missing row as on and the other six push switches on an existing row must stay as they are.

Files touched: `scripts/sim-driver/dates.ts` (header comment, two new writes at the end of `clearDates`, the `clear` console line) and `scripts/sim-driver/sim` (the `dates` paragraph of `sim help`, reflowed to the column width). Surprise: the local stack already held two leftover Casey `countdown_marks` rows from an earlier check, exactly the DW-397 state; `sim dates clear` removed them. Afterwards `sim provision` was run to put back the seeded events.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The reflowed `sim help` `dates` paragraph split `sim provision` and `sim dates clear` across lines (`scripts/sim-driver/sim:77-81`), so the commands no longer read as commands — confirmed in the printed help; reflowed the last lines so each command name stays on one line, re-ran `zsh -n` and `sim help`.

## Verification

**Commands:**
- `node scripts/sim-driver/dates.ts clear` with `SIM_SUPABASE_URL=http://127.0.0.1:54321` and the local `SIM_SUPABASE_SECRET_KEY`, after inserting a countdown mark and setting `date_reminders = false` for Casey via psql -- expected: exits 0; afterwards `countdown_marks` has no rows for Casey or Jessie and both existing `push_preferences` rows have `date_reminders = true`, other switches unchanged.
- `zsh -n scripts/sim-driver/sim` -- expected: no syntax error; `scripts/sim-driver/sim help` prints the updated `dates` paragraph.

## Auto Run Result

Status: built

**Summary:** DW-397. `sim dates clear` (and `kinds`/`many`, which clear first) now also deletes Casey's and Jessie's `countdown_marks` rows and sets `push_preferences.date_reminders = true` on their existing rows, so a story 4.2 or 4.3 check no longer leaves marks or a switched-off date-reminders switch behind. `sim help` says so. AGENTS.md left alone (DW-385).

**Files changed:**
- `scripts/sim-driver/dates.ts` -- `clearDates` deletes both people's countdown marks and turns their date reminders back on (update, never creates a row); header comment and `clear` output updated.
- `scripts/sim-driver/sim` -- the `dates` paragraph of `sim help` describes the two new resets.

**Review findings:** 1 finding (quick lens). Patched 1 (low: help reflow split command names). Deferred 0. Rejected 0.

**Follow-up review recommended:** false -- one `low` patched, no `high` or `medium`.

**Verification:**
- Local stack: set Casey's `date_reminders` and `moods` to false, added a Jessie `wedding` mark beside Casey's two leftover event marks, ran `scripts/sim-driver/sim dates clear` -- exit 0; afterwards 0 `countdown_marks` rows for either person, Casey's `date_reminders` true and `moods` still false (other switches untouched), Jessie still has no `push_preferences` row (none created). Then restored `moods` and ran `sim provision` to put back the seeded events.
- `npx tsc -p tsconfig.node.json --noEmit` (includes `dates.ts`) -- exit 0.
- `zsh -n scripts/sim-driver/sim` -- ok; `sim help` prints the updated paragraph.

**Residual risks:** The shell's saved `countdown-marks` and `push-preferences` local copies keep the old values until their refreshers run after the clear; the existing anniversary and couple-settings deletes behave the same, so this is not new.
