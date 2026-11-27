---
title: "The streak's week runs Sunday to Saturday"
type: feature
ticket: '3'
created: '2026-11-27'
status: done
baseline_revision: 'aa5c607384e47dbd8fbd1dc95a2e3fad88ddd3a6'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-the-streak-s-week-runs-sunday-to-saturday.md'
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The streak's row of seven dots on Daily and the Partner page's streak card shows the last seven days ending today, labels today "Today", and draws a not-done day as a broken dashed shape. The owner wants the calendar week, Sunday to Saturday, with today ringed in its own slot and every not-done day a plain grey circle.

**Approach:** `couple_streak` adds `calendar_week` beside the unchanged `week`: Sunday to Saturday of the viewer's date, each `{day, state}` with state `done | missed | open | upcoming` (`upcoming` for every day after the viewer's date). The client schema takes it as optional; Daily and the Partner card draw `calendar_week` when present, else the saved `week`, with weekday letters, the ring on the viewer's date and grey circles. The +1 screen keeps drawing `week` exactly as now.

## Boundaries & Constraints

**Always:** The server works out every state (AD-7); the client only maps state to a look. Today is `week`'s last `day` (the server's viewer date), never the device clock. The viewer's date and week are on the viewer's stored zone, UTC with no row (AD-3). A day after the viewer's date is `upcoming` whatever rows exist. Tests use fixed instants (pgTAP) or faked time / `clockAnchor()`; no device clock moves. Import E2E fixtures from `merged-fixtures.ts`.

**Never:** Change `week` (days, order, states), `held`, `run`, `today_state`, `milestones`, `same`, `done`, `missed`, the chip, colours, cold banner words (`coldBannerWords`) or the +1 screen's row (`StreakUp.tsx:54,157`, `StreakWeek` with `fillDay` and no `today`). Drop `week`. Change `get_couple_streak`, its grants, FN-GRANT-008 or the AD-5 gate file. Hand-edit `src/types/database.types.ts`. Touch `dateReminders.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Midweek | viewer date Fri 2030-07-05 (`seq`) | `calendar_week` 06-30..07-06; 07-06 `upcoming`; others as `states` | — |
| Saturday | viewer date Sat (`apart` A at 2030-08-11 06:00Z, NY/LA) | 08-04..08-10, today last slot, no `upcoming` | — |
| Sunday | viewer date Sun (`apart` B at same instant, Chicago) | 08-11..08-17, today first slot, six `upcoming` | — |
| No days yet | pair with no `couple_days` | seven entries, `open` to today, `upcoming` after | — |
| Partner ahead | partner's zone already on tomorrow with a pick | tomorrow is `upcoming` in `calendar_week` | — |
| Old build | pre-story schema parses new answer | parses; `calendar_week` stripped; `week` unchanged | — |
| Saved before update | `daily-streak` copy with no `calendar_week` | parses; row shows `week` oldest first, today last ringed | first `ok` read replaces it |

</intent-contract>

## Code Map

- `supabase/migrations/20261107010000_couple_streak.sql:78-232` -- `couple_streak` body to copy whole into a new `create or replace`. The no-day branch (`:121-136`) and the main `jsonb_build_object` (`:191-226`) each build `week`; `states` CTE covers `v_first..v_last` (`v_last` = greatest of both dates and last day). Comment at `:234-241`, grants `:243-244`. House style: `supabase/migrations/20261127010000_three_daily_pushes.sql` header (What changes / Grants / Hosted catalog / pgTAP).
- `supabase/tests/database/45_couple_streak.sql` -- `plan(49)`; helpers `pg_temp.streak`, `pg_temp.week` (`:112`); exact key lists STREAK-014 (`:206-210`) and STREAK-044 (`:286-290`) must gain `calendar_week`; scenarios `seq` (UTC, 07-01..07-05), `apart` (`:310-340`), `empty`, `relink`. Weekdays: 2030-06-30 Sun, 07-05 Fri, 07-06 Sat, 08-10 Sat, 08-11 Sun, 03-03 Sun, 03-07 Thu.
- `src/api/validation/dailyQuestionSchemas.ts:79-101` -- `CoupleStreakWeekDaySchema`, `CoupleStreakSchema` (plain `z.object`, strips unknown keys).
- `src/components/shared/StreakWeek.tsx` -- `WeekDot` (open dot `:47` is an inline `<span>`, so its size never applies), ring wrapper `:81`, label `:96`. Used by `StreakUp.tsx:157` (keep as is), `DailyQuestion.tsx:758`, `StreakCard.tsx:90`.
- `src/services/dailyStreakCopy.ts:38-39` -- `readSavedStreak` parses with `CoupleStreakSchema`; `saveStreakAnswer` spreads `answer.streak`, so `calendar_week` is saved once the schema has it.
- `src/components/DailyQuestion/DailyQuestion.tsx:189-210` -- `coldBannerWords` reads `week`; do not touch.
- Frozen old-build precedent: `tests/support/helpers/old-build-day-schema.ts`, `tests/unit/api/dailyQuestionSchemas.oldBuild.test.ts`, `tests/api/push-preferences-old-build.spec.ts` (`supabaseAsUser`, `resolveWorkerPairIds`).
- Unit fixtures: `tests/unit/stores/dailyQuestionFixture.ts:100-119` (`streakWeek`, `coupleStreak`); tests `PartnerView.test.tsx:525-555` (expects `Today`), `DailyQuestion.streak.test.tsx`, `tests/unit/services/dailyStreakCopy.test.ts`, `src/api/__tests__/dailyQuestionApi.test.ts:170-205`, StreakUp tests.
- E2E: `tests/e2e/daily/daily-streak.spec.ts:57-64` `expectWeek` (last-seven order, `Today`; called `:115,189,230,261` with seeds by `daysAgo` from the host's local date); `tests/e2e/partner/partner-streak.spec.ts:85-95,136-170` (stubbed `week`, no `calendar_week`) and `:284-287` (real server, `Today`); `partner-streak.spec.ts` second block `~:284`; `tests/e2e/partner/partner-streak-offline.spec.ts`.
- Spine: `architecture-daily-question.md:104-115` (AD-7).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261127020000_streak_calendar_week.sql` -- house-style header; `create or replace function public.couple_streak` with the body unchanged except: `v_sunday := v_today - extract(dow from v_today)::int`; both return paths add `calendar_week`, seven `{day, state}` for `v_sunday + 0..6`, state `'upcoming'` when `day > v_today`, else the `states` row's state, else `'open'` (no-day branch: `open`/`upcoming`). `week` byte-identical. Rewrite the function comment to name `calendar_week`; restate revoke/grant. `begin;`/`commit;` as the source file does. Hosted catalog: one function replaced in place, nothing dropped -- criteria 4, 5.
- [x] `supabase/tests/database/45_couple_streak.sql` -- add `pg_temp.cal(j)` (states) and day checks; add `calendar_week` to STREAK-014/044 key lists; new STREAK-050+: `seq` at 07-05 Fri (days 06-30..07-06, last `upcoming`, others equal to `week`'s states for the same dates), `seq` at 07-06 12:00Z Sat (no `upcoming`, today last), `apart` A Saturday / B Sunday at 2030-08-11 06:00Z (viewer zone decides the week), `empty` (`open` to today, then `upcoming`), each entry exactly `{day, state}`, a partner-ahead pick on the viewer's tomorrow stays `upcoming`, and `relink` via `get_couple_streak` carries `calendar_week`. Existing `week` assertions stay unchanged. Fix `plan(n)` -- criteria 4, 5.
- [x] `src/api/validation/dailyQuestionSchemas.ts` -- `CoupleStreakCalendarDaySchema` (`day` iso date, state `done|missed|open|upcoming`); `calendar_week: z.array(...).length(7).optional()` on `CoupleStreakSchema`, documented as missing from a copy saved before story 11.3 -- criteria 5, 7.
- [x] `src/components/shared/StreakWeek.tsx` -- optional `today?: string` prop. With it: every slot labels its weekday letter (never "Today"); only the entry whose `day === today` gets the existing ring classes (wrapper may be `flex` so the ring hugs the dot), plus `data-today="true"` on that slot; a state other than `done`/`missed` is a filled `flex h-[26px] w-[26px] rounded-full` grey circle (one grey for all, e.g. `bg-ash-ink/30`, checked visible on card, fire-, cold- and ash-tint in light and dark). Without `today` the output is exactly today's (StreakUp). Export `StreakRow({ streak, testIdPrefix, labelClass })` rendering `StreakWeek` with `week={streak.calendar_week ?? streak.week}` and `today={streak.week[streak.week.length - 1].day}`. Update the header doc -- criteria 1-4, 7.
- [x] `src/components/DailyQuestion/DailyQuestion.tsx:758`, `src/components/PartnerView/StreakCard.tsx:90` -- use `StreakRow`; fix their docs ("last seven dates") -- criteria 1, 7.
- [x] `tests/support/helpers/old-build-streak-schema.ts` (frozen copy of baseline `CoupleStreakSchema`/`CoupleStreakAnswerSchema`, "do not edit" note as the day precedent) + `tests/unit/api/coupleStreakSchema.oldBuild.test.ts` (an answer with `calendar_week` parses, strips it, keeps `week`; a new state in `week` would fail, which is why it is a new field) -- criterion 6.
- [x] `tests/api/couple-streak-old-build.spec.ts` -- as this worker's pool user (`supabaseAsUser`) on the shared stack, `rpc('get_couple_streak')`: parses under the frozen old schema; `week` is seven consecutive days ending on the viewer's date, oldest first; `calendar_week` is Sunday..Saturday holding that date, later days `upcoming`. Seed nothing that another worker owns -- criteria 5, 6.
- [x] Unit tests -- fixtures: `calendarWeek(...)` helper in `dailyQuestionFixture.ts` (2030-03-03 Sun .. 03-09 Sat), `coupleStreak` default gains a `calendar_week` matching `week`'s today 03-07 Thu. Render tests on `PartnerView` and `DailyQuestion` (or `StreakCard`): labels exactly `S M T W T F S`, no "Today"; ring/`data-today` on one slot for today Sunday (index 0), Saturday (6) and Thursday (4); `open`/`upcoming` dots share one class and have no dashed border; done/missed keep check/snowflake. A streak without `calendar_week` (saved copy) shows `week` in order, today last ringed. `dailyStreakCopy.test.ts`: a copy without `calendar_week` reads back; a saved `ok` answer keeps `calendar_week`. Store/slice test that a successful read replaces a saved copy lacking it. StreakUp tests unchanged and passing. Update `PartnerView.test.tsx:525-555` -- criteria 1-4, 7.
- [x] `tests/e2e/daily/daily-streak.spec.ts`, `tests/e2e/partner/partner-streak.spec.ts` -- `expectWeek` takes the `daysAgo` states and maps them onto the calendar week of the host's local date (slot `i` = Sunday + i; after today `upcoming`; no seed `open`); assert labels are weekday letters, no "Today", exactly one `data-today` slot at today's weekday index. Partner real-server block: replace `Today` with the `data-today` check. Stubbed block: add a `calendar_week` built from the live date and fix the "dashed-ring" comment -- criteria 1-3.
- [x] `_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md` AD-7 -- describe `calendar_week` beside `week` (Sunday to Saturday of the viewer's date, `upcoming` after it), that Daily's row and the Partner card read `calendar_week` (falling back to a saved copy's `week`), and that the +1 screen and cold banner read `week` -- criterion 8.

**Acceptance Criteria:**
- Given story criteria 1-8, when the Verification commands run on the shared local stack, then each is proven by at least one listed test and all pass.
- Given `npm run db:types`, when it runs against the stack with the new migration, then `src/types/database.types.ts` shows no diff (the signature is unchanged).

## Implementation Notes

- `StreakWeek` takes `today`; without it (the +1 screen) the markup is unchanged. `StreakRow` (in `StreakWeek.tsx`) is what Daily and the Partner card render. Today's slot carries `data-today="true"` for tests.
- The grey circle is `bg-ash-ink/30`. Playwright end-of-test screenshots of the stubbed Partner card (orange in light, blue in dark) show it on fire-tint and cold-tint, the same size as a done dot, with the ring on today alone.
- pgTAP adds STREAK-050..059 and an `ahead` pair (the partner already on the viewer's tomorrow with both picks): that date is `upcoming`. `plan(59)`.
- `coupleStreakSlice.test.ts` folds the saved-before-the-field case into the existing replace test, which keeps the file under TEA's 1000-line limit.
- `npm run db:types` gives no diff: `couple_streak` keeps its signature and `get_couple_streak` is untouched.

## Plan Change Log

## Review Triage Log

### 2026-11-27 — Review pass
- verdicts: 6 findings — high 0, medium 0, low 6, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `partner-streak.spec.ts`'s stubbed `calendar_week` came from the live week, so on Sunday or Monday the done and missed dots the dark pass checks fell outside the row — fixed: the stub uses fixed dates (`week` ending Wednesday 2030-03-06, `calendar_week` 03-03..03-09), so done, missed and grey dots show on every day; the client never reads the device clock for the row.
  - `[low]` `[reject]` `daily-streak.spec.ts`'s `expectWeek` checks seeded past days only when they fall in this week (on a Sunday only today's slot is checked) — real but not fixable without faking the server's `now()`, which the real-server E2E cannot do; slot placement for every weekday is proven every run by pgTAP STREAK-050..058 and the `StreakRow`, `PartnerView` and `DailyQuestion` unit tests.
  - `[low]` `[patch]` `coupleStreak()`'s default `calendar_week` ignored a `week` override, so a test overriding only `week` got a contradictory row — fixed: the default is derived from the resolved `week` (state by date, `upcoming` after its last day, else `open`); an explicit override still wins.
  - `[low]` `[patch]` The DailyQuestion test named "saved before the calendar week" fed a live fetch, not a saved copy — fixed: renamed to say what it does, and the slice test 'offline with a saved streak' now saves a copy without `calendar_week` and asserts the store shows it, so copy → store → screen is covered.
  - `[low]` `[reject]` The grey circle's visibility check was recorded on only two surfaces — the fix is to edit this build's plan; the check was then completed and is reported under Auto Run Result (Daily's white card in light, fire-tint in light, cold-tint in dark seen in screenshots; the ash-tint card worked out by blend).
  - `[low]` `[patch]` `StreakRow.test.tsx` had `streakOn(2 + 2)`, lines over the 100-column width and an escaped quote — fixed: `streakOn(4)`, lines wrapped by hand, a double-quoted string.

## Design Notes

`calendar_week` in SQL, inside the main select (the no-day branch uses `case when d > v_today then 'upcoming' else 'open' end`):
```sql
'calendar_week', (
  select jsonb_agg(jsonb_build_object('day', w.dt,
           'state', case when w.dt > v_today then 'upcoming' else coalesce(s.state, 'open') end) order by w.dt)
  from (select v_sunday + g.i as dt from generate_series(0, 6) as g(i)) w
  left join states s on s.dt = w.dt
)
```
Why a new state rather than reusing `open`: criterion 5 asks the server to mark days not reached, and it lets the client draw without knowing dates. Why today comes from `week`'s last day: it is the server's viewer date, so the client never reads the device clock, and a stale saved copy rings the same day both fields were computed for. `StreakRow` keeps the two callers from repeating the fallback.

## Verification

**Commands:**
- `supabase migration up` then `supabase test db` -- expected: all pgTAP files pass.
- `npm run db:types && git diff --stat src/types/database.types.ts` -- expected: no diff.
- `npm run typecheck && npm run lint` -- expected: clean apart from the known worktree-only TS2883 baseline.
- `SEED=11 npm run test:unit:coverage` -- expected: pass.
- `npx playwright test --project=api tests/api/couple-streak-old-build.spec.ts` -- expected: pass.
- `npx playwright test --project=chromium tests/e2e/daily/daily-streak.spec.ts tests/e2e/partner/partner-streak.spec.ts tests/e2e/partner/partner-streak-offline.spec.ts` -- expected: pass.

**Manual checks (if no CLI):**
- Playwright screenshot of Daily and the Partner card in light and dark: grey circles visible and equal size to done dots, ring around today only.

## Auto Run Result

Status: built

**Summary:** The streak's row on Daily and the Partner page's streak card now shows the calendar week, Sunday to Saturday. Every slot shows its weekday letter, today is ringed in its own slot, and every day not done or missed is one plain grey circle, today's included. `couple_streak` answers a new `calendar_week` beside the unchanged `week`, with state `upcoming` for days after the viewer's date. Installed builds strip the new field and keep their last-seven-days row. A copy saved before the update shows its `week` until the first successful read. The +1 screen's row and the cold banner are unchanged.

**Files changed:**
- `supabase/migrations/20261127020000_streak_calendar_week.sql`: replaces `couple_streak` in place, adding `calendar_week`; `week`, grants and `get_couple_streak` unchanged.
- `supabase/tests/database/45_couple_streak.sql`: STREAK-050..059 (Friday, Saturday and Sunday viewers, zone-dependent weeks, no-day pair, partner ahead, via `get_couple_streak`); key lists gain `calendar_week`.
- `src/api/validation/dailyQuestionSchemas.ts`: optional `calendar_week` with the `upcoming` state.
- `src/components/shared/StreakWeek.tsx`: `today` prop (calendar look) and `StreakRow`; no `today` keeps the +1 screen's markup.
- `src/components/DailyQuestion/DailyQuestion.tsx`, `src/components/PartnerView/StreakCard.tsx`: render `StreakRow`.
- `tests/support/helpers/old-build-streak-schema.ts`, `tests/unit/api/coupleStreakSchema.oldBuild.test.ts`, `tests/api/couple-streak-old-build.spec.ts`: the pre-story schema against the new answer, in unit and over the wire.
- `src/components/shared/__tests__/StreakRow.test.tsx` and the PartnerView, DailyQuestion, `dailyQuestionApi`, `dailyStreakCopy` and `coupleStreakSlice` tests and fixture: the row, the ring for Sunday, Thursday and Saturday, grey circles, the saved-copy fallback.
- `tests/e2e/daily/daily-streak.spec.ts`, `tests/e2e/partner/partner-streak.spec.ts`: calendar slots, weekday letters, one ringed slot, no "Today".
- `architecture-daily-question.md` AD-7: `calendar_week` beside `week` and which screens read each.

**Review findings:** 6 findings, all low. 4 patched (fixed-date stub, fixture derivation, test rename and saved-copy slice assertion, StreakRow test style). 0 deferred. 2 rejected: the real-server E2E's weekday-dependent coverage (it would need the server's clock faked; pgTAP and unit tests prove every weekday), and the recorded visibility evidence (fixing it would mean editing the plan; the check is reported below).

**Follow-up review recommendation:** false. Patched entries by verdict: high 0, medium 0, low 4.

**Verification:**
- `supabase migration up` and `supabase test db`: PASS, 37 files, 1226 tests, before and after the patches.
- `npm run db:types`: no diff to `src/types/database.types.ts`.
- `npm run typecheck` and `npm run lint`: clean.
- `SEED=11 npm run test:unit:coverage`: 281 files, 5505 tests passed, before and after the patches.
- Playwright `api` `couple-streak-old-build.spec.ts`: 1 passed. `chromium` daily-streak, partner-streak and partner-streak-offline: 13 passed, before and after the patches. The row audit found no leftover rows.
- Manual: Playwright end-of-test screenshots show the grey circles on Daily's white card (light), the Partner card's fire-tint (light) and cold-tint (dark). Each is the size of a done dot, only today is ringed, and the days after today are the same grey. The grey card (ash-tint, light and dark) was not screenshotted. Worked out by blend, `bg-ash-ink/30` there is about as distinct as on the white card (light about #c1c4cb on #eceef2; dark about #424957 on #1c2230).

**Residual risks:** None that names a defect. The real-server E2E checks done and missed slots only for days in the current week, so on a Sunday it checks today's slot alone; pgTAP and the unit tests cover every weekday.
