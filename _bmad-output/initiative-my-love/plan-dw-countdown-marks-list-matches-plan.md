---
title: 'Countdown marks list matches the reminder plan (DW-395, DW-396)'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '88c43c5eb9415b4e209f7fbaf2feccde0b31cc2e'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Settings countdown-marks card lists dates the planner never schedules: `reminderDateEntries` keeps an event dated tomorrow after 9:00 today (its only reminder, "Tomorrow" at 9:00 today, is past) and a relationship start dated today or later (`planDateReminders` skips it via `next > startDay`). `planOnce` and `CountdownMarks` also each build the planner's `ReminderDates` input by hand. Separately, the "Date reminders" helper says "At 9:00 before each date." though birthdays and anniversaries also remind on the day.

**Approach:** One shared input builder in `dateReminders.ts` used by both callers, and one eligibility rule: a date is listed only when planning it as marked yields at least one reminder at `now`, computed by the same per-date code `planDateReminders` runs. Reword the helper to the owner's text.

## Boundaries & Constraints

**Always:** `dateReminders.ts` keeps not importing the store (structural types only). `planDateReminders` output stays identical for every input (existing planner tests pass unchanged). List order, keys and names stay as today. An anniversary with no `serverId` is still planned unmarked but never listed. Helper text is exactly `At 9:00 the day before, and on the day for birthdays and anniversaries.`

**Never:** Edit `_bmad-output/initiative-my-love/deferred-work.md`. Change reminder texts, times, the 64 cap or the native schedule/cancel code. Change `planOnce`'s copy-missing / switch-off rules. Fake `setTimeout` in the component test.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Event tomorrow, before 9:00 | now 1 Nov 08:00, event 2 Nov | listed | No error expected |
| Event tomorrow, after 9:00 (DW-395 example 1) | now 1 Nov 10:00, event 2 Nov | not listed | No error expected |
| Relationship start today or later (example 2) | start today 07:00, or 5 days ahead | not listed | No error expected |
| Relationship start a year+ ago | start 6 Nov 2020, now 1 Nov 2026 | listed | No error expected |
| Recurring date today after 9:00 | birthday on today, now 10:00 | not listed (nothing ahead until the next re-plan day) | No error expected |
| Unreadable date | `garbage` | not listed, not planned | skipped silently |

</intent-contract>

## Code Map

- `src/services/dateReminders.ts:102-117` -- `ReminderDates`; add exported `ReminderDateSources` + builder `reminderDatesFrom(sources)` returning `Omit<ReminderDates,'marks'|'remindersOn'>` (coupleSettings `linked` → start/wedding else null; ownProfile/partner `{displayName,birthday}|null` → `ReminderBirthday|null`).
- `src/services/dateReminders.ts:163-190` -- `addDay`/`addBirthday`; reuse.
- `src/services/dateReminders.ts:202-238` -- `reminderDateEntries`; rewrite on top of a shared internal per-date walk (key `string|null`, list name, and a `plan(marked, planned)` callback or equivalent) that `planDateReminders` also iterates, so the two cannot diverge. Update its doc comment.
- `src/services/dateReminders.ts:245-294` -- `planDateReminders`; iterate the same walk; keep sort + slice.
- `src/services/dateRemindersAtLaunch.ts:144-157` -- replace the hand-built object with `{ ...reminderDatesFrom({...}), marks, remindersOn }`; partner passes `partner.status === 'linked' ? partner.partner : null`.
- `src/components/Settings/CountdownMarks.tsx:40,75-87` -- helper text; entries via `reminderDateEntries(reminderDatesFrom({...}), new Date())`; update header comment (line 23-25) if wording changes.
- `src/services/__tests__/dateReminders.test.ts:641-732` -- `reminderDateEntries` tests (`NOW` 1 Nov 10:00, `EARLY` 08:00, TZ New York). The test at :683 keeps a tomorrow event at `NOW` (after 9:00) — it encodes the bug; change it.
- `src/components/Settings/__tests__/CountdownMarks.test.tsx:61-64,78-120,363` -- seeds use the real clock; fixed anniversaries (6 Nov, 20/24/26 Dec) would be hidden on their day after 9:00 under the new rule, so pin `Date` only.
- `tests/unit/stores/dateRemindersAtLaunch.test.ts` -- must stay green unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/dateReminders.ts` -- add `ReminderDateSources`/`reminderDatesFrom`; factor the per-date walk; `reminderDateEntries` lists a keyed date iff planning it marked at `now` yields ≥1 reminder -- one rule, one input shape.
- [x] `src/services/dateRemindersAtLaunch.ts` -- build via `reminderDatesFrom` -- one builder.
- [x] `src/components/Settings/CountdownMarks.tsx` -- build via `reminderDatesFrom`; `REMINDERS_HELPER` to the owner's text -- DW-395/DW-396.
- [x] `src/services/__tests__/dateReminders.test.ts` -- fix the :683 test (tomorrow event listed at `EARLY`, not at `NOW`); add tests for the matrix rows (relationship start today at `EARLY` and 5 days ahead not listed, recurring date today after 9:00 not listed); add `reminderDatesFrom` tests (linked/unlinked couple settings, null profile/partner); add a property-style check that every listed key, marked alone, plans ≥1 reminder and every keyed date not listed plans none.
- [x] `src/components/Settings/__tests__/CountdownMarks.test.tsx` -- `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime` to a fixed local instant where every seeded date lists (restore in `afterEach`); update :363 to the new helper; add a test that an event dated tomorrow is not shown after 9:00.

**Acceptance Criteria:**
- Given the Settings card at 10:00 with an event dated tomorrow, when it renders, then that event has no row while the other dated rows show.
- Given the card, when it renders, then the Date reminders switch's description reads "At 9:00 the day before, and on the day for birthdays and anniversaries."
- Given any dates and `now`, when `planDateReminders` runs, then its output equals today's output (existing planner tests unchanged and green).

## Implementation Notes

- Implemented by the full-route subagent. A private `reminderDateItems` walk (key, list name, per-date `plan(planned, marked, now)`) now feeds both `planDateReminders` and `reminderDateEntries`; `reminderDatesFrom` is the one input builder, used by `planOnce` and `CountdownMarks`.
- The component test pins only `Date` (20 Oct 2026 08:00) so the fixed seeded anniversaries never fall on their own day after 9:00; the new "tomorrow event after 9:00" test waits on the `event:e2` row because `renderLoaded` waits on the first key, which that test removes.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` `CountdownMarks.tsx` `entries` memo reads `new Date()` only when its store dependencies change, so a card left open across 9:00 keeps a row (event dated tomorrow, or a recurring date on its day) whose mark now plans nothing — real (deps carry no clock), but it needs the card open across 9:00, the stored mark is harmless, and the row goes on the next render with new data or on reopening; the fix is a ticking clock (timer state plus cleanup), more than a direct correction, so rejected under the low-finding rule.

## Design Notes

"Can produce a reminder" uses marked = true: the month and week reminders fall before the day-before one, so marked is the superset. A recurring date on its own day after 9:00 is hidden until midnight — the same single rule; the next re-plan plans next year's occurrence.

## Verification

**Commands:**
- `npx vitest run src/services/__tests__/dateReminders.test.ts src/components/Settings/__tests__/CountdownMarks.test.tsx tests/unit/stores/dateRemindersAtLaunch.test.ts` -- expected: all pass
- `npm run typecheck` -- expected: exit 0 (worktree TS2883 baseline errors aside, none in touched files)
- `npx eslint src/services/dateReminders.ts src/services/dateRemindersAtLaunch.ts src/components/Settings/CountdownMarks.tsx src/services/__tests__/dateReminders.test.ts src/components/Settings/__tests__/CountdownMarks.test.tsx` -- expected: no errors

## Auto Run Result

Status: built

**Summary:** The Settings countdown-marks card now lists a date only when planning it (as marked) at `now` produces at least one reminder, computed by the same per-date walk `planDateReminders` runs (DW-395), so an event dated tomorrow after 9:00 and a relationship start dated today or later are no longer offered. `planOnce` and the card build the planner's input through one `reminderDatesFrom` builder. The "Date reminders" helper reads "At 9:00 the day before, and on the day for birthdays and anniversaries." (DW-396).

**Files changed:**
- `src/services/dateReminders.ts` — `ReminderDateSources` + `reminderDatesFrom`; shared `reminderDateItems` walk; `reminderDateEntries` eligibility from that walk; `planDateReminders` iterates it (output unchanged).
- `src/services/dateRemindersAtLaunch.ts` — `planOnce` builds `ReminderDates` via `reminderDatesFrom`.
- `src/components/Settings/CountdownMarks.tsx` — entries via `reminderDatesFrom`; new helper text; header comment.
- `src/services/__tests__/dateReminders.test.ts` — fixed the tomorrow-event test (listed at 08:00, not at 10:00); relationship-start, same-day-recurring, list-vs-plan property and `reminderDatesFrom` tests.
- `src/components/Settings/__tests__/CountdownMarks.test.tsx` — `Date`-only fake clock; new helper assertion; tomorrow-event-after-9:00 row test.

**Review findings:** 1 finding (quick lens). Patches applied: 0. Deferred: 0. Rejected: 1 low — the list can go stale if the card stays open across 9:00; rare, harmless stored mark, fix needs a ticking clock (see Review Triage Log).

**Follow-up review recommendation:** false — no entries patched (high 0, medium 0, low 0).

**Verification:** `npx vitest run` on the three planned test files — 3 files, 238 tests passed. `npm run typecheck` — exit 0, 0 `error TS` lines. `npx eslint` on the five touched files — exit 0. `grep -rn "before each date" src tests` — no remaining uses of the old text. Matrix audit: every I/O row covered by a passing test.

**Residual risks:** A recurring date on its own day after 9:00 is now hidden until midnight (same single rule, recorded in Design Notes); the stale-while-open case above.
