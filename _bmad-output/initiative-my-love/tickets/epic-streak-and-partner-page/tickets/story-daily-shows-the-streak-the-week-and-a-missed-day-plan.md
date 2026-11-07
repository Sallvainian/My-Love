---
title: 'Daily shows the streak, the week and a missed day'
type: feature
ticket: '4'
created: '2026-11-07'
status: done
baseline_revision: '28b1bd66423e9bda4b3185e6410ede2e5314cfa8'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The offline-pick E2E cannot tell the drain's own streak re-read from the refresher's or the Realtime re-join's.
    evidence: |-
      On reconnect App.tsx:562-566 runs drainQueuedPicks() and refreshLocalCopies() together, and the daily-streak refresher (dailyQuestionSlice.ts registerLocalCopy) sends get_couple_streak without waiting for the pick; useDailyPickListener's SUBSCRIBED on re-join reads it again. So `rereadStreak` in the test may be the refresher's read, and the final orange-at-2 assertion would still pass if the `void get().loadCoupleStreak()` in drainOnce were removed. The drain's call is proven only by the unit test "a pick queued offline and drained later re-reads the streak only after the drain" (tests/unit/stores/dailyQuestionSlice.pickQueue.test.ts). Isolating it in E2E needs the refresher and the Realtime re-join suppressed, more than a direct correction; the surface outcome (the chip updates after reconnect without a reload) is shown.
    location: >-
      tests/e2e/daily/daily-streak.spec.ts (the "after a pick queued offline" test)
    severity: low
  - summary: >-
      The waiting sentence reads "when Your partner answers too." with a capital Y mid-sentence when the partner's name is missing.
    evidence: |-
      DailyQuestion.tsx:316 falls back to 'Your partner' when `state.partner?.displayName` is empty (users.display_name is nullable, and the partner copy can be unfilled or its read failed), and line 393 puts that value mid-sentence. The fallback predates this change and already reads "Waiting on Your partner" in DayCard. Rare (a linked partner normally has a name and the copy fills on sign-in) and the fix needs a separate lowercase value for mid-sentence use, so it is filed rather than patched.
    location: >-
      src/components/DailyQuestion/DailyQuestion.tsx:393
    severity: low
---

<intent-contract>

## Intent

**Problem:** Daily shows no streak: the couple cannot see the chip, the week, the waiting sentence or a missed day there, and a late pick's correction shows only on the Partner page.

**Approach:** Daily reads the slice's existing `coupleStreak` (stories 7.2/7.3) and renders, from the design's Today's question, Waiting, Both answered and After a missed day screens, a header (title, date, streak chip), the week strip, the waiting sentence and the cold banner. The slice re-reads the streak after every confirmed own pick (direct or drained); Daily's listener re-reads it on SUBSCRIBED, `partner_linked` and `daily_pick`. A new E2E factory seeds a pair's past days.

## Boundaries & Constraints

**Always:**
- Everything shown comes from `get_couple_streak` as stored in `coupleStreak`; nothing is computed on the client but text choice (`missed === 1` → "Yesterday was", else "The last {missed} days were").
- Header (when `dailyDay` is `ok`): "Today's question" (a `<p>`, not a heading; the question stays the card's `h1`), the snapshot's `day` as "Thursday, November 5" (parsed with `parseEventDate`, `en-US`, weekday/month long, day numeric), and, when `coupleStreak` is `ok`, the chip `daily-streak-chip` (`data-state` = `today_state`): held with `Flame` for grey/orange, `Snowflake` for blue, then "{run} in a row" (`daily-streak-run`) under it. Chip tones: grey `bg-ash-tint text-ash-ink`, orange `bg-fire-tint text-fire-ink`, blue `bg-cold-tint text-cold-ink`.
- Week strip `daily-streak-week` in a `CARD`, days `daily-streak-day` with `data-state`, same dots and labels as the Partner card: extract `WeekDot`/`weekdayLetter`/the strip from `StreakCard.tsx` into one shared component used by both, Partner test ids unchanged.
- While `today_state === 'blue'`: banner `daily-streak-cold`, "Your streak went cold" and "{Yesterday was | The last {missed} days were} missed, so it's frozen at {held}. You keep the {held}. Both answer today to light it back up."
- Snapshot `state === 'me'`: `daily-streak-waiting` "Your half is in. The streak lights up when {partner} answers too." above the card (existing `daily-waiting` stays).
- `DailyQuestion` mount effect also calls `loadCoupleStreak()` (re-reads per session, as `loadDailyDay`).
- Slice: after a confirmed pick in `submitDailyPick` and after each confirmed row in `drainOnce` (once the session is still current), `void get().loadCoupleStreak()`. A queued (offline) pick and a refused row do not read it.
- `useDailyPickListener`: `daily_pick` → `refreshDailyDay(day_id)` and `loadCoupleStreak()`; `partner_linked` → `loadDailyDay()` and `loadCoupleStreak()`; `SUBSCRIBED` → both; no `new_mood`/`dates_changed` handler; header comment updated.
- New E2E factory `seedPairDays(supabaseAdmin, pair, days)` in `tests/support/factories/daily-question.ts`: each entry `{ daysAgo: number; picks: 'both' | 'user' | 'partner' | 'none' }`, dated from the Node host's local date (the browser's zone); rows through `assign_couple_day` with `created_at` moved to that date, picks inserted as `postgres` via docker `psql` (service_role cannot write `daily_picks`), each pick in the host zone at local noon (now for `daysAgo: 0`); `user_time_zones` filled for both only where absent; one transaction; throws on any error. Header says stories 6, 7 and 8 use it; `clearPairDays` removes what it seeds.
- E2E on the worker pair with `clearPairDays` before and deferred at teardown; linking only through `seedRequest`/`acceptFromPartnerTab` with throwaways.

**Never:** compute held/run/state/missed on the client; add a localCopy kind, IndexedDB store or `signedOutState()` field (none needed); add the +1 animation (story 5), the milestone screen or the flaming heart; the mock-up's question number or option icons; edit `database.types.ts`; add a migration; use `@/` in `src/`; run `prettier --write`; link, unlink or reset pool pairs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| grey | streak ok, today_state grey | grey chip, Flame, run line, strip, no banner | — |
| orange | today_state orange | orange chip, Flame, no banner | — |
| blue, one miss | today_state blue, missed 1, held 12 | blue chip, Snowflake, banner "Yesterday was missed, so it's frozen at 12. You keep the 12. …" | — |
| blue, several | missed 3 | banner "The last 3 days were missed, …" | — |
| no streak | `coupleStreak` null or unlinked | header without chip, no strip, no banner | streak error not shown on Daily |
| waiting | snapshot state `me` | waiting sentence with partner name | — |
| own pick confirmed | `submitDailyPick` online succeeds | `loadCoupleStreak` called once | pick failure: not called |
| queued then drained | offline pick, later drain confirms | not called on queue; called after the confirmed row | refusal: not called |
| events | SUBSCRIBED / partner_linked / daily_pick / new_mood / dates_changed | day re-read as before plus streak / same / same / nothing / nothing | — |

</intent-contract>

## Code Map

- `src/components/DailyQuestion/DailyQuestion.tsx` -- add header, strip, banner, waiting sentence, `loadCoupleStreak` in the mount effect (l.236-238); `DayCard` state `me` at l.180-191. Update the file header.
- `src/components/PartnerView/StreakCard.tsx` -- `TONE`, `WeekDot`, `weekdayLetter`, week grid (l.73-103, 140-160) to extract; keep `partner-streak-*` ids.
- New shared streak file in `src/components/shared/` (e.g. `StreakWeek.tsx`) -- the extracted strip, taking the test-id prefix and label class.
- `src/stores/slices/dailyQuestionSlice.ts` -- `drainOnce` confirmed path l.~300-306; `submitDailyPick` final `set` l.~505; header paragraph on the streak (l.48-58).
- `src/hooks/useDailyPickListener.ts` -- handlers and header; template `src/hooks/usePartnerStreakListener.ts`.
- `src/api/dailyQuestionApi.ts` -- `CoupleStreak` type.
- `src/services/eventsService.ts` -- `parseEventDate`.
- Tests: `src/hooks/__tests__/useDailyPickListener.test.ts` (extend: state mock gains `loadCoupleStreak`), `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` (extend), slice tests under `tests/unit/stores/` (find the ones for `submitDailyPick`/`drainQueuedPicks` with `grep -l drainQueuedPicks tests/unit`), `src/components/PartnerView/__tests__` (must stay green).
- `tests/support/helpers/migration-replay.ts` -- `runPsql`/`SUPABASE_DB_CONTAINER`: export and reuse, never copy.
- `tests/support/factories/daily-question.ts` -- `clearPairDays`, `orderedPair`; add `seedPairDays`.
- E2E templates: `tests/e2e/partner/partner-streak.spec.ts` (two contexts, picks, `COUPLE_STREAK_READ`), `tests/e2e/daily/daily-question-offline-pick.spec.ts` (queued pick, reconnect), `tests/e2e/daily/daily-question-partner-linked.spec.ts` (throwaways, accept while Daily open); helpers `tests/support/helpers/{reads,offline,navigation,recurse,abort-reads}.ts`, `tests/support/factories/events.ts` (`resolveWorkerPairIds`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/shared/StreakWeek.tsx` + `StreakCard.tsx` -- extract the week strip; Partner unchanged.
- [ ] `src/components/DailyQuestion/DailyQuestion.tsx` -- header, chip, strip, banner, waiting sentence, streak read on mount.
- [ ] `src/stores/slices/dailyQuestionSlice.ts` -- streak re-read after confirmed picks; header.
- [ ] `src/hooks/useDailyPickListener.ts` -- streak re-read on the three events.
- [ ] `tests/support/helpers/migration-replay.ts`, `tests/support/factories/daily-question.ts` -- export `runPsql`; `seedPairDays`.
- [ ] Unit tests -- every matrix row (component, listener incl. new_mood/dates_changed absent, slice confirmed/queued/drained/refused).
- [ ] `tests/e2e/daily/daily-streak.spec.ts` (new) -- (1) seeded 2 done days: Daily grey chip held 2, "2 in a row", strip; user picks → waiting sentence; partner picks in a second context → user's Daily orange without reload, Partner card orange; (2) seeded done, done, missed: Daily blue with "Yesterday was missed, so it's frozen at 2" and Partner card blue; (3) seeded done, missed, missed: "The last 2 days were missed"; (4) seeded 1 done day and partner's pick today: user offline picks (queued), back online → chip orange held 2.
- [ ] `tests/e2e/daily/daily-question-partner-linked.spec.ts` -- after the accept, A's Daily also shows `daily-streak-chip` (held 0, grey) without leaving /daily.

**Acceptance Criteria:**
- Given seeded days for the worker pair, when Daily and Partner open, then chip, strip, banner and card show the colour `today_state` says.
- Given the user picked and the partner has not, when Daily shows, then it says "Your half is in. The streak lights up when {partner} answers too."
- Given a pick queued offline, when the connection returns and the drain sends it, then the chip shows the server's new held total without a reload.
- Given an unlinked account on Daily, when its request is accepted, then the chip appears without leaving Daily.

## Implementation Notes

- 2026-11-07: `daily-streak.spec.ts` sets `test.use({ trace: 'off', video: 'off' })` at file level (Playwright rejects it inside a describe), so the file restarts a worker, as the offline specs do.
- 2026-11-07: scenario (3) seeds its two missed dates as a user-only and a partner-only day (each still missed), which also exercises those `seedPairDays` modes.
- 2026-11-07: `user_time_zones` rows that `seedPairDays` adds where absent stay after `clearPairDays`; the app writes the same row on every `get_daily_day`. Stated in the factory header.
- 2026-11-07 (review patch): `WriteQuestionSheet.test.tsx` mocks `fetchCoupleStreak`; the spec's Partner page checks the grey card on seeded days; dates come from `isoDateDaysFromNow` and the pair order from the now-exported `orderedPair`.

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 4 findings — high 0, medium 2, low 2, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` `WriteQuestionSheet.test.tsx` renders the real `DailyQuestion` and store with no `fetchCoupleStreak` mock and a `supabase` mock without `rpc`, so the new mount and post-pick streak reads throw and log from fire-and-forget work that can outlive the file (AGENTS.md: EnvironmentTeardownError). Fixed: `fetchCoupleStreak` mocked to `unlinked` and reset in `beforeEach`, as `DailyQuestion.test.tsx` does.
  - `[low]` `[defer]` The offline-pick E2E's `rereadStreak` may be the refresher's or the re-join's read, so it would pass without the drain's own re-read. Verified: `App.tsx:562-566` starts the refresher beside the drain. Deferred (rare but real): the surface outcome is shown and the drain call is unit-tested; isolating it needs the refresher and the Realtime re-join suppressed.
  - `[medium]` `[patch]` No test showed the Partner card grey on seeded days (AC 1, ticket verify); only orange and blue were checked there. Fixed: test 1's partner page opens `/partner` before any pick today and asserts `partner-streak-card` grey with held 2.
  - `[low]` `[patch]` `todayLocal`, `localDate` hand-pad `YYYY-MM-DD` and `todayWriter` re-implements the pair order, against the shared-helpers rule (DW-313). Fixed: dates via `isoDateDaysFromNow` (`tests/support/helpers/events.ts`), `orderedPair` exported from the factory and reused; `todayLocal` deleted.

### 2026-11-07 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `daily-streak.spec.ts`'s `todayWriter` copied `readPairDayWriter`'s `couple_days.writer` query because the shared helper threw on a pair with several days, so stories 6-8, which seed multi-day pairs, would copy it again (DW-313 rule). Fixed: `readPairDayWriter` takes an optional `day` (`YYYY-MM-DD`) that filters to that date's day; the spec imports it with today's date, `todayWriter` is deleted and `orderedPair` is no longer exported.
  - `[low]` `[defer]` The waiting sentence reads "when Your partner answers too." when the partner's name is missing. Verified: `DailyQuestion.tsx:316` falls back to `'Your partner'` and line 393 puts it mid-sentence; the fallback predates the change. Deferred (rare but real): a linked partner normally has a name, and the fix needs a separate lowercase value.
  - `[low]` `[patch]` The E2E checked the waiting sentence's prefix and suffix but not the partner's name, so it would pass with the fallback. Fixed: test 1 reads the pool partner's `display_name` with the service role and asserts the element visible with the whole sentence.
  - `[low]` `[defer]` carried — The offline-pick E2E cannot isolate the drain's own streak re-read from the refresher's or the re-join's; `drainOnce` still calls `loadCoupleStreak` and `App.tsx` still starts the refresher beside the drain. Already in `deferred`; not deferred again.

## Design Notes

- Why psql for picks: `daily_picks` grants service_role SELECT only, and `record_daily_pick` is security invoker, so no API role can write a past pick; `migration-replay.ts` already drives the local DB this way (container `supabase_db_My-Love`, present in CI where `supabase start` runs).
- Seeded dates use the host's local date because the browser runs on the same host with no `timezoneId`, and `get_daily_day` stores the browser's zone, which `couple_streak` reads.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (or only the worktree TS2883 baseline).
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/daily tests/e2e/partner tests/e2e/auth/login.spec.ts` -- expected: pass on the local stack (`supabase start`, CLI per `.mise.toml`).

## Auto Run Result

Status: built

**Summary:** Follow-up review pass on story 7.4 (Daily shows the couple's streak, read from the slice's `coupleStreak`: the header with date and streak chip, the shared week strip, the cold banner, the waiting sentence, the re-reads after confirmed picks and on `SUBSCRIBED`/`partner_linked`/`daily_pick`, and the `seedPairDays` E2E factory). This pass made two test-only patches.

**Files changed in this pass:**
- `tests/support/factories/daily-question.ts`: `readPairDayWriter` takes an optional `day`; `orderedPair` back to module-private.
- `tests/e2e/daily/daily-streak.spec.ts`: drops the copied `todayWriter`, uses `readPairDayWriter` with today's date; asserts the full waiting sentence with the pool partner's name.

**Review (quick, pinned; lens: quick):** 4 findings, all low.
- **Patched (2):** the copied writer lookup; the partial waiting-sentence assertion.
- **Deferred (1 new, low):** "Your partner" capitalised mid-sentence when the partner has no name (frontmatter `deferred`).
- **Carried (1):** the offline E2E cannot isolate the drain's own streak re-read (already deferred on the first pass).
- **Rejected:** none.

**Follow-up review recommended: false.** This is a follow-up pass and it patched no high finding. Patched counts by verdict: high 0, medium 0, low 2.

**Verification (after the patches):**
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:unit`: 252 files, 4702 tests, all pass.
- `npx playwright test tests/e2e/daily tests/e2e/partner tests/e2e/auth/login.spec.ts`: 35 passed on the local stack.
- `npx playwright test tests/e2e/daily/daily-streak.spec.ts --repeat-each=3`: 12 passed. This answers the first pass's open risk that test 1's extra Partner step had been shown stable in only one run.

**Residual risks:**
- `seedPairDays` writes picks through `docker exec supabase_db_My-Love psql`. Not run in CI from this worktree: UNVERIFIED there.
- Seeded dates use the host's local date, so a run that starts within minutes of local midnight could seed one date and read the next.
