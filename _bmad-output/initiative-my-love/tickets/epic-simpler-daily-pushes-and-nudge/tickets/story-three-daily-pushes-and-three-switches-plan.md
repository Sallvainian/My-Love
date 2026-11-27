---
title: 'Three daily pushes and three switches'
type: feature
ticket: '2'
created: '2026-11-27'
status: done
baseline_revision: 'c8e2773f42baf79ea52f5b042b2840b33bddcd42'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-three-daily-pushes-and-three-switches.md'
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md'
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md'
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
  - '{project-root}/_bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md'
warnings: [oversized]
deferred:
  - summary: >-
      The story 11.2 migration fails the deploy if an old daily-reminders cron run inserts a morning row between its DELETE and the narrowed kind check, or deadlocks with that run.
    evidence: |-
      20261127010000_three_daily_pushes.sql deletes morning and evening_partner rows, then adds daily_reminders_kind_check (kind = 'evening_self'); nothing stops the old enqueue_daily_reminders (still live until the file commits) from committing a morning row in between, which the ALTER's validation then rejects with 23514, and a cron run holding daily_picks while waiting on daily_reminders can deadlock with the file's DROP TRIGGER on daily_picks. Real, low: needs a deploy inside a hosted user's 08:00-08:30 tick, during the milliseconds the migration runs; the failure rolls the file back and stops deploy.yml before the functions and site, so a rerun succeeds. A single LOCK TABLE does not settle it, because the cron run touches daily_picks before and after daily_reminders (review 2026-11-27: quick).
    location: >-
      supabase/migrations/20261127010000_three_daily_pushes.sql (the DELETE, ALTER TABLE and DROP TRIGGER steps)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Epic 8 sends five daily pushes with five switches: an 8 AM new-question push (`daily_question`, `morning` reminder), a partner-picked push (`daily_partner_picked`), the nudge, two 8 PM variants (`evening_self`, `evening_partner`) and a both-answered push whose wording follows the streak and a late flag. The owner cut them to three (story file, criteria 1-10): the nudge, one 8 PM reminder to whoever has not answered ("Time's running out!" / "Answer your daily question before the day is over!"), and both answered with one wording ("You both answered today's question" / "Click to see what your partner answered!"), with three switches: Nudges, Evening reminder, Both answered.

**Approach:** One migration removes the morning and partner-picked triggers, deletes stored `morning` and `evening_partner` reminders, narrows the kind check to `evening_self`, and makes `enqueue_daily_reminders` act only at 20:00-20:30 for a person who has not picked. `send-push` drops the two kinds, their columns and the streak/late reads, and gets the two new wordings. The app stops naming the two columns. The removed columns stay in the database. `push-copy.md`, the spine and the Settings UX spine are rewritten to match.

## Boundaries & Constraints

**Always:**
- Every story criterion 1-10 holds, and so does every story Boundary. Unchanged: when both-answered is sent and its switch; the badge and the `partner-activity` thread on every remaining push; story 11.1's nudge, its prompt, the waiting card's button, the hold and the closing instant; date reminders; love-note, photo, date and partner-request pushes. A tap on a `daily_question` or `daily_partner_picked` push delivered before the deploy still opens Daily, so both keys stay in `VIEW_FOR_KIND`.
- `push_preferences.daily_question` and `daily_partner_picked` stay, with their stored values and defaults. Only their comments change.
- Server functions read no clock but `at` (AD-8). Tests use fixed instants, faked time or `clockAnchor()`. Never move a device or Mac clock.
- Use the one shared local stack, and apply with `supabase migration up`, never `db reset`. The new migration file sorts after `20261127000000`. The hosted catalog was read on 2026-11-26 (epic Notes): there are no hosted-only names, so a plain `drop … if exists` works.
- pgTAP files that pin exact sets (trigger lists, plan counts, `columns_are`) are edited in the same change. Run `npm run db:types`. No diff is expected, because no column or signature changes. If one appears, commit the regenerated file.

**Never:**
- Never drop or rename a `push_preferences` column (epic 10, DW-548). Never drop `user_local_date`, `couple_streak` or the `daily_reminders.slot` column or unique key.
- Never change story 11.1's nudge tables, functions or triggers (`daily_nudges`, `record_daily_nudge`, `send_daily_nudge`, `release_held_daily_nudges`, the snapshot). The release call at the top of `enqueue_daily_reminders` is copied unchanged.
- Never touch the streak's week row, `couple_streak` or `daily_day_snapshot` (story 11.3). Never change `src/services/dateReminders.ts` or `reminderIdsToCancel`.
- Never add an `eslint-disable` that a direct fix can replace. Never edit `src/types/database.types.ts` by hand.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 08:00-08:30 tick | linked, device, zone, not picked | no `daily_reminders` row, no `couple_days` row assigned for their date, only held nudges released | none |
| First pick | `daily_picks` insert, `is_second` false | no `net.http_request_queue` call | none |
| Second pick | `is_second` true, on date or late, any run | one `daily_both_answered` call; payload title "You both answered today's question", body "Click to see what your partner answered!", no `sound`, `partner-activity`, badge | none |
| 20:00-20:30, not picked | partner picked or not | one `evening_self` row → `daily_reminder` push, "Time's running out!" / "Answer your daily question before the day is over!", `sound: default` | none |
| 20:00-20:30, picked | partner picked or not | no row | none |
| Old stored rows | `morning`, `evening_partner`, `evening_self` before migration | only `evening_self` remains | — |
| New removed-kind row | insert `kind = 'morning'` / `'evening_partner'` | refused by `daily_reminders_kind_check` (23514) | — |
| Removed kind posted | `{kind: 'daily_question'|'daily_partner_picked', id}` to send-push | 400, nothing claimed | — |
| Switch off | recipient's `daily_nudge`/`daily_reminder`/`daily_both_answered` false | that kind 200 zeros; other two still send; partner's switch independent | — |
| Old build | selects all 12 columns; upserts `daily_question` or `daily_partner_picked` alone | succeeds; values kept | — |
| Old saved copy | `push-preferences` copy with `dailyQuestion`/`dailyPartnerPicked` keys | parses; the two keys are dropped | — |

</intent-contract>

## Code Map

Server:
- `supabase/migrations/20261127000000_daily_nudge_per_question.sql:598-715`: the current `enqueue_daily_reminders`. Copy its release block (`:621-628`) unchanged. Copy its header style too (What changes / Grants / Hosted catalog / pgTAP; no `begin`/`commit`, re-runnable steps).
- `supabase/migrations/20261126000000_daily_reminders_schedule.sql:166-178`: triggers `daily_reminders_push_morning_after_insert` (drop it) and `daily_reminders_push_evening_after_insert` (`when (new.kind <> 'morning')`). The comments on `daily_reminders` and the function are at `:180-189`.
- `supabase/migrations/20261126010000_daily_pick_pushes.sql:31-50`: drop trigger `daily_picks_push_partner_picked_after_insert`. Keep `daily_picks_push_both_answered_after_insert`, and rewrite the `daily_picks` table comment.
- `supabase/migrations/20261125000000_daily_push_sender.sql:88-104`: `daily_reminders` (generated `slot`, `daily_reminders_kind_check`, unique `(user_id, local_date, slot)`, `day_id … on delete cascade`). `:155-170`: the `push_requests` table and column comments that name the removed kinds. `:184-189`: the `push_preferences.daily_*` column comments.
- `supabase/functions/send-push/handler.ts`: `PushKind`/`PushPreference`/`PREFERENCE_FOR_KIND`/`POSTED_KINDS` (`:163-224`), the 400 message (`:399`), `resolveSource` pick case (`:427-461`) and reminder case (`:477-519`), `PushDb.getUserLocalDate`/`getCoupleStreak`/`CoupleStreak`, the header docs (`:18-23`, `:51-77`, `:102-103`). `index.ts`: `SOURCE_COLUMN` (`:32-46`), `getUserLocalDate`/`getCoupleStreak` (`:169-188`), header (`:1-16`). `payload.ts`: constants (`:61-68`), builders (`:232-274`), header (`:35-42`).
- Deno tests: `handler.test.ts` (fixtures `:83-118`; `fakeDb` options `localDate`, `streakLookups`, `failOn`; kind tables `:1047-1100`, `:1713-1780`; morning, partner-picked and late tests `:1327-1600`), `payload.test.ts`.

pgTAP (`supabase/tests/database/`):
- `47_daily_pushes.sql` plan(76): DAILY-PUSH-022..029 (morning and evening_partner inserts, the slot mapping), `:344`. DAILY-PUSH-051/052 `has_column` stay, because criterion 7 needs the columns.
- `48_daily_reminders.sql` plan(53): trigger list `:131`, triggers `:135-140`, morning cases `:183-258`, picked/evening_partner/nudge-skip cases `:283-335`, `:353-355`, `:392`, `:406-412`.
- `49_daily_pick_pushes.sql` plan(14): trigger list `:74`, DAILY-PICK-002/004/006, the comment check `:163`.
- `36_push_preferences.sql:111`: the default-values listing. It stays, because the columns stay.

Client:
- `src/services/pushPreferencesService.ts`: `PushPreferences`, `ALL_PUSH_PREFERENCES_ON`, `PreferencesRow`, `COLUMN` (feeds `COLUMNS` for select and upsert read-back), `toPushPreferences`, header `:7-10`.
- `src/stores/slices/notificationsSlice.ts:58-100`: `PUSH_PREFERENCE_KEYS`, `DEFAULT_ON_WHEN_MISSING`, `parseSavedPushPreferences`. It keeps only the listed keys, so an old copy's extra keys drop out. Fix the doc ("twelve").
- `src/components/Settings/notificationsStatus.ts:13-26,70-89`: `PUSH_SWITCH_KEYS` and its docs ("eleven").
- `src/components/Settings/NotificationsPage.tsx:1-16,62-101`: `ROWS` and the now-unused icons (`MessageCircleQuestionMark`, `CircleCheck`).
- `src/services/pushNotifications.ts:153-171`: `VIEW_FOR_KIND`. Keep both removed kinds and reword the comment.
- Tests: `tests/unit/services/pushPreferencesService.test.ts:84-174`, `tests/unit/stores/pushPreferencesCopy.test.ts:313-350`, `src/components/Settings/__tests__/NotificationsPage.test.tsx:78-79,670-701`, `tests/unit/stores/signOutClearsAccountState.test.ts:615-616`, `src/services/__tests__/pushNotifications.delivered.test.ts`. Find any other full `PushPreferences` literal through `npm run typecheck`.
- API: `tests/api/push-daily-sender.spec.ts` (`:110-250` morning, partner-picked and late cases), `push-daily-picks.spec.ts` (`:100-160`), `push-daily-reminders.spec.ts` (`:100-110`). Helpers: `tests/support/helpers/push-requests.ts` (`setUpPair`, `awaitRequests`, `postKindToSender`, `dailyPayload`), `daily-clock.ts`, `migration-replay.ts` (precedent `tests/integration/daily-nudge-per-question-migration.spec.ts`, Playwright project `integration`).
- E2E: the Notifications page renders only where `hasNativePush()` (`Settings.tsx:213`). A browser never reaches it (`tests/e2e/settings/push-switches-web.spec.ts`). The harness pattern is `tests/support/harnesses/auth-token-persistence.{html,ts}`, opened as `baseURL + '/tests/support/harnesses/<name>.html'` (`tests/e2e/auth/token-persistence-overlap.spec.ts:310`).

Docs:
- `_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md` (27 lines).
- `architecture-daily-question.md`: AD-4 `:78`, AD-9 `:125-140`, AD-10 trigger table and send-push rules `:145-157`, AD-17 `:219-222`, Consistency Conventions push kinds `:229` and View rows, Structural Seed sequence `:276`, Capability map R14 row.
- `ux-settings-page/EXPERIENCE.md:89` (Notifications subpage row) and `:109` (Confirmed strings).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261127010000_three_daily_pushes.sql` -- new migration, house-style header, no `begin`/`commit`, re-runnable. (1) `delete from public.daily_reminders where kind in ('morning','evening_partner')`. The `push_requests` rows cascade. (2) Drop and re-add `daily_reminders_kind_check` as `check (kind = 'evening_self')`. Keep `slot`, the unique key and the index. (3) Drop trigger `daily_reminders_push_morning_after_insert`. Recreate `daily_reminders_push_evening_after_insert` with no WHEN, posting `notify_push('daily_reminder')`. Drop trigger `daily_picks_push_partner_picked_after_insert`. (4) `create or replace enqueue_daily_reminders(at)`: keep the release block, then per person act only when local time is 20:00-20:30. Skip when their `(user, local date, 'evening')` row exists. Call `assign_couple_day`, and skip when they have picked; otherwise insert `evening_self`. Remove `v_partner_picked`, the morning branch and the nudge skip. Restate the grants. (5) Rewrite the comments on `daily_reminders`, `daily_picks`, `enqueue_daily_reminders`, `notify_push()`, `push_requests` and its `daily_pick_id`/`daily_reminder_id` columns, and `push_preferences.daily_question`/`daily_partner_picked` (no longer read or written by the app or `send-push`; kept for installed builds; epic 10 drops them, DW-548) and `daily_reminder` -- criteria 1, 2, 3, 8, 10.
- [x] `supabase/tests/database/47_daily_pushes.sql`, `48_daily_reminders.sql`, `49_daily_pick_pushes.sql` (plus any file `grep -ln "morning\|evening_partner\|partner_picked_after\|push_morning" supabase/tests/database` finds) -- re-pin the trigger lists (48: the evening trigger alone, no WHEN; 49: both-answered alone) and fix the plan counts. Pin that a new `morning` or `evening_partner` row is refused (23514) and that `evening_self` is allowed. With fixed instants: an 08:10 tick inserts no reminder and assigns no `couple_days` row for that pair and date. A held nudge is still released at that tick (DAILY-REM with a story-11.1 held row). At 20:10 a person who has not picked gets `evening_self` whether or not the partner picked, and one who has picked gets nothing whether or not the partner picked. A first pick queues no call, and a second pick queues one `daily_both_answered`. Pin that the comments name no removed kind as current -- criteria 1, 2, 3, 8.
- [x] `tests/integration/three-daily-pushes-migration.spec.ts` -- with `migration-replay.ts`, inside a rolled-back transaction: drop the narrowed check (or seed before it), seed one `morning`, one `evening_partner` and one `evening_self` row, replay the new file, and assert only the `evening_self` row remains, kept unchanged. Follow the precedent spec -- criterion 8.
- [x] `supabase/functions/send-push/{handler.ts,index.ts,payload.ts}` -- remove `daily_question` and `daily_partner_picked` from `PushKind`, `PushPreference`, `PREFERENCE_FOR_KIND`, `POSTED_KINDS`, `SOURCE_COLUMN` and the 400 message. Remove `buildDailyQuestionPayload`, `buildDailyPartnerPickedPayload`, `DAILY_QUESTION_BODY_PREFIX`, `DAILY_PARTNER_PICKED_BODY`, `DAILY_REMINDER_*` partner/self strings, `DAILY_LATE_TAIL`, and `questionText` if nothing else uses it. `buildDailyReminderPayload()` returns title `Time's running out!`, body `Answer your daily question before the day is over!`, sound `default`. `buildDailyBothAnsweredPayload()` returns title `You both answered today's question`, body `Click to see what your partner answered!`, no sound. Pick case: `daily_both_answered` needs `is_second` true, else no push. The recipient is `otherInPair`, with no date or streak read. Reminder case: the stored kind must be `evening_self`, else no push. Keep the partner lookup ("nobody to tell"). Drop the `getCoupleDay` read for reminders (`day_id` cascades). Remove `getUserLocalDate`, `getCoupleStreak`, `CoupleStreak` and `resolveSource`'s `atIso` from `PushDb` and `index.ts`. Rewrite the header docs -- criteria 3, 5, 6, 10.
- [x] `supabase/functions/send-push/handler.test.ts`, `payload.test.ts` -- remove the morning, partner-picked, late and streak fixtures and tests. Add: the reminder's exact payload (title, body, sound, thread, badge, `kind: daily_reminder`). A stored `morning`/`evening_partner` row posted as `daily_reminder` claims nothing. A posted `daily_question`/`daily_partner_picked` answers 400 and claims nothing. Both answered reads the same for runs 0, 1 and 5 and on a day not the recipient's date: no `sound`, and nothing names a count, the partner's name or "That day counts.". For each of the three switches off, that kind answers zeros while the other two still send to that recipient, and the partner's own switch is read independently. Across every posted kind, `isPushEnabled` is never called with `daily_question` or `daily_partner_picked` -- criteria 3, 5, 6, 10.
- [x] `src/services/pushPreferencesService.ts`, `src/stores/slices/notificationsSlice.ts`, `src/components/Settings/notificationsStatus.ts`, `src/components/Settings/NotificationsPage.tsx`, `src/services/pushNotifications.ts` -- remove `dailyQuestion` and `dailyPartnerPicked` everywhere (type, defaults, row, `COLUMN`, mapping, copy keys, `DEFAULT_ON_WHEN_MISSING`, `PUSH_SWITCH_KEYS`, `ROWS` and unused icons). Update the counts in the docs (nine push switches). Keep the `VIEW_FOR_KIND` entries, with a comment that they serve pushes delivered before the deploy -- criteria 4, 6.
- [x] Unit tests -- `pushPreferencesService.test.ts` (the select string and every upsert body name neither column; ten columns mapped), `pushPreferencesCopy.test.ts` (a copy saved by the old build, with the two keys, parses to the new shape; a copy without them still reads as on), `NotificationsPage.test.tsx` (the daily switches are exactly Nudges, Evening reminder, Both answered, in that order; no New question or Partner picked), the `notificationsSummary` test (On/Some/Off over the remaining switches, with and without Date reminders), `signOutClearsAccountState.test.ts` literal, `pushNotifications.delivered.test.ts` (`daily_question` and `daily_partner_picked` taps still open Daily). Fix any other literal typecheck flags -- criteria 4, 6.
- [x] `tests/support/harnesses/notifications-page.{html,tsx}` + `tests/e2e/settings/push-switches-daily.spec.ts` -- a harness page that mounts the real `NotificationsPage` (store, `supabase` client and CSS, as the auth harness does) for the pool account whose session the fixture already holds. The spec attaches a request listener before navigation. It asserts the "Notify me about" daily switches are exactly Nudges, Evening reminder and Both answered, with New question and Partner picked absent. It turns each of the three off and on again (restoring), and asserts every `/rest/v1/push_preferences` request's URL and body contain neither `daily_question` (as a whole word, not `daily_questions`) nor `daily_partner_picked`. Wait on the response, then the store, then the UI (AGENTS.md). Import fixtures from `merged-fixtures.ts`. Keep `push-switches-web.spec.ts` as it is, `New question` absence included -- criteria 4, 6.
- [x] `tests/api/push-preferences-old-build.spec.ts` (new) -- as a signed-in pool user's client on the shared local stack: select all twelve columns by name; upsert `{user_id, daily_question: false}` alone, then `{user_id, daily_partner_picked: false}` alone, each with the twelve-column select read back, and assert success with values kept. Restore both to true in `finally`. Assert both columns still exist (the select succeeds) -- criterion 7.
- [x] `tests/api/push-daily-sender.spec.ts`, `push-daily-picks.spec.ts`, `push-daily-reminders.spec.ts` -- remove the morning, partner-picked and late-wording cases. A first pick reaches `send-push` with no request. A second pick (on date and late) records the one wording. An 08:0x `enqueue_daily_reminders` records no reminder request. 20:0x records the new reminder payload only for whoever has not picked. Keep the existing `otherAccountsDueAt`-style guards -- criteria 1-3, 10.
- [x] `push-copy.md`, `architecture-daily-question.md` (AD-4, AD-9, AD-10, AD-17, Consistency Conventions push kinds and View rows, Structural Seed sequence, Capability map R14), `ux-settings-page/EXPERIENCE.md:89,109` -- describe the three pushes (nudge, `evening_self` reminder with the new copy, both answered with the one wording), their switches Nudges / Evening reminder / Both answered, and the two columns kept unread until epic 10. None may name as current the 8 AM push, the partner-picked push, `evening_partner`, the both-answered streak titles or "That day counts.". Leave story 11.1's nudge rules as written -- criterion 9.

**Acceptance Criteria:**
- Given story criteria 1-10, when the Verification commands run on the shared local stack, then each criterion is proven by at least one listed test (pgTAP, integration, Deno, unit, E2E or api), and all pass.
- Given a linked couple with push devices and zones on the shared local stack, when one answers, an 08:00 tick and a 20:00 tick run on the other's clock, and the other answers, then the only pushes `send-push` records are the 8 PM reminder to the one who had not answered and one both-answered push to the first, worded as criteria 3 and 10 say.
- Given `dateReminders.ts`, when its tests run, then it is unchanged and they pass.

## Implementation Notes

- `push-copy.md`'s nudge row now carries the body story 11.1 shipped ("{Partner} answered the daily question and wants to know your answer!"); it still showed the streak body, and 11.1's plan left `push-copy.md` to this story.
- The spine edits also touch AD-3, AD-5 and AD-7, where they named `send-push` as a reader of `user_local_date` or `couple_streak`; it reads neither now.
- The harness (`tests/support/harnesses/notifications-page.tsx`) skips only `Settings.tsx`'s `hasNativePush()` gate: the page, store, `supabase` client and CSS are the production ones, signed in with the session the fixture put in the origin (`setAuthUser`).
- `handler.test.ts`'s fake database keeps `getUserLocalDate`/`getCoupleStreak` as spies so a test can show nothing calls them.
- The shared stack runs no edge-runtime container; the `api` specs ran against `supabase functions serve` started from this worktree and stopped after.

## Plan Change Log

## Review Triage Log

### 2026-11-27 — Review pass
- verdicts: 6 findings — high 0, medium 0, low 5, false 1, maybe-false 0
- findings:
  - `low` `defer` the migration's DELETE then ALTER ADD CONSTRAINT can fail with 23514 if an old cron run commits a morning row in between — real but needs a deploy inside a hosted 08:00-08:30 tick during the migration's milliseconds; the suggested LOCK TABLE leaves a deadlock with the cron run, which reads daily_picks before and after daily_reminders, so the fix is more than a direct correction; filed in `deferred` (quick).
  - `false` `reject` the 08:25 `otherAccountsDueAt` guard was removed from push-daily-reminders.spec.ts — the guard protected the morning count, and the new enqueue_daily_reminders inserts no reminder for any account outside 20:00-20:30 (pinned by DAILY-REM-013, -016, -028), so no other account can change `morning.data`; the helper's 08:00 window still serves push-daily-nudge-held.spec.ts's release instant (quick).
  - `low` `patch` push-daily-reminders.spec.ts ran its 08:00 tick only before the first answer, not in the acceptance criterion's order — Alice's pick is now seeded at 07:25 Kathmandu and a second tick at 08:29 asserts 0 rows for either partner; existing assertions kept (quick).
  - `low` `patch` AD-10's first bullet said every trigger has a WHEN clause, contradicting its table and the migration — reworded: the daily_reminders trigger has none (quick).
  - `low` `patch` push-daily-sender.spec.ts header said the host-zone row is for the sender's date reads, which send-push no longer makes — reworded to what the row still dates (the seeded days and couple_streak) (quick).
  - `low` `patch` pgTAP id `DAILY-REM-015a` broke the file's numbering — renamed `DAILY-REM-063` (quick).

## Design Notes

**The 20:00 loop after the change:**
```sql
if not (v_local::time >= '20:00' and v_local::time < '20:30') then continue; end if;
v_date := v_local::date;
if exists (select 1 from public.daily_reminders x where x.user_id = r.user_id and x.local_date = v_date and x.slot = 'evening') then continue; end if;
v_day := public.assign_couple_day(least(..), greatest(..), v_date);
if exists (select 1 from public.daily_picks k where k.day_id = v_day.id and k.user_id = r.user_id) then continue; end if;
insert … values (r.user_id, 'evening_self', v_date, v_day.id) on conflict (user_id, local_date, slot) do nothing;
```
At 08:00 the loop never reaches `assign_couple_day`, so the 08:00 tick assigns no day (story Notes, DW-498 narrowed). The held-nudge release is the only work at 08:00.

**Why `slot` stays:** it is generated and only the server reads it. Dropping it would change the unique key the insert's `on conflict` names, with no observable gain. It now always reads `evening`.

**Deploy order:** `deploy.yml` applies migrations before it deploys functions. In the minutes between, the old `send-push` still words a reminder and a both-answered push the old way. No trigger posts a removed kind once the migration has run, and a stored `morning` row is gone, so its post finds no row. The new sender answers 400 to a removed kind's stray post. Every one of these outcomes sends nothing wrong, so none is filed.

**Consolidation:** with one reminder variant and one both-answered wording, the payload builders take no arguments, and the handler's date and streak reads go entirely. No caller remains, so remove them rather than leave dead `PushDb` methods.

## Verification

**Commands:**
- `supabase migration up` then `supabase test db` -- expected: all pgTAP files pass.
- `npm run db:types && git diff --stat src/types/database.types.ts` -- expected: no diff, or a committed regenerated file.
- `deno test --no-lock supabase/functions/send-push/` and `deno test --no-lock supabase/functions/upload-love-note-image/` -- expected: pass, no `deno.lock` written.
- `npm run typecheck && npm run lint` -- expected: clean, apart from the known worktree-only TS2883 baseline.
- `SEED=11 npm run test:unit:coverage` -- expected: pass, including the `dateReminders` tests.
- `npx playwright test --project=api tests/api/push-preferences-old-build.spec.ts tests/api/push-daily-sender.spec.ts tests/api/push-daily-picks.spec.ts tests/api/push-daily-reminders.spec.ts tests/api/push-daily-nudge.spec.ts tests/api/push-daily-nudge-held.spec.ts` -- expected: pass.
- `npx playwright test --project=integration tests/integration/three-daily-pushes-migration.spec.ts tests/integration/daily-nudge-per-question-migration.spec.ts` -- expected: pass.
- `npx playwright test --project=chromium tests/e2e/settings/push-switches-daily.spec.ts tests/e2e/settings/push-switches-web.spec.ts` -- expected: pass.

## Auto Run Result

Status: built

**Summary:** Daily now sends three pushes with three switches. Removed: the 8 AM new-question push, the partner-picked push and the `evening_partner` reminder, with their triggers and stored reminder rows. `daily_reminders` now accepts only `evening_self`, and `enqueue_daily_reminders` acts only at 20:00-20:30, for a person who has not picked. The 08:00 tick now only releases held nudges and assigns no couple day. `send-push` drops the two kinds and their switch columns and reads no date, streak or question. The 8 PM reminder reads "Time's running out!" / "Answer your daily question before the day is over!". Both answered always reads "You both answered today's question" / "Click to see what your partner answered!". Settings > Notifications shows Nudges, Evening reminder and Both answered, and the app never names `daily_question` or `daily_partner_picked`. Both columns stay in the database for installed builds (epic 10 drops them, DW-548), and taps on the removed kinds still open Daily.

**Files changed:**
- `supabase/migrations/20261127010000_three_daily_pushes.sql`: deletes the removed reminder kinds, narrows the kind check, drops the morning and partner-picked triggers, gives the evening trigger no WHEN, adds a 20:00-only `enqueue_daily_reminders`, and rewrites the comments.
- `supabase/tests/database/{47,48,49}_*.sql`: re-pinned triggers and the kind check; fixed-instant 08:10 and 20:10 cases; the held-nudge release at 08:10; pick pushes.
- `supabase/functions/send-push/{handler,index,payload}.ts` and their tests: three daily kinds, the two new wordings, no date, streak or question reads, a 400 for a removed kind, and per-switch isolation.
- `src/services/pushPreferencesService.ts`, `src/stores/slices/notificationsSlice.ts`, `src/components/Settings/{NotificationsPage.tsx,notificationsStatus.ts}`, `src/services/pushNotifications.ts`: the two switches and columns are gone; `VIEW_FOR_KIND` keeps both kinds.
- Unit tests: `pushPreferencesService`, `pushPreferencesCopy` (an old copy with the two keys), `NotificationsPage`, `signOutClearsAccountState`, `pushNotifications.delivered`.
- `tests/support/harnesses/notifications-page.{html,tsx}` and `tests/e2e/settings/push-switches-daily.spec.ts`: the real Notifications page in a browser, with three daily switches and no request naming either column.
- `tests/api/push-preferences-old-build.spec.ts` (new) and `tests/api/push-daily-{sender,picks,reminders}.spec.ts`: old-build select and upsert; the three pushes over the wire.
- `tests/integration/three-daily-pushes-migration.spec.ts` (new): replays the migration over stored `morning`, `evening_partner` and `evening_self` rows.
- `push-copy.md`, `architecture-daily-question.md` (AD-3, 4, 5, 7, 9, 10, 17, conventions, sequence, R14), `ux-settings-page/EXPERIENCE.md`: the three pushes and switches.

**Review findings:** 6 findings. 4 low patched (the reminders spec's step order, AD-10's WHEN bullet, the sender spec's header, a pgTAP id). 1 low deferred (the migration racing a cron run, in `deferred`). 1 false rejected (the removed 08:25 guard: nothing is inserted at 08:xx for any account).

**Follow-up review recommendation:** false. Patched entries by verdict: high 0, medium 0, low 4.

**Verification:**
- `supabase migration up`: applied. `supabase test db`: PASS, 37 files, 1216 tests, before and after the patches.
- `npm run db:types`: no diff to `src/types/database.types.ts`.
- `deno test --no-lock supabase/functions/send-push/`: 123 passed. `upload-love-note-image`: 5 passed. No `deno.lock` written.
- `npm run lint`: clean. `npm run typecheck`: only the 5 known worktree-only TS2883 errors.
- `SEED=11 npm run test:unit:coverage`: 279 files, 5485 tests passed, before and after the patches. The `dateReminders` tests are included and the file is unchanged.
- Playwright `api` (old-build, sender, picks, reminders, nudge, nudge-held): 11 passed. `integration` (this migration's replay and 11.1's): 4 passed. `chromium` (`push-switches-daily`, `push-switches-web`): 2 passed. The row audit found no leftover rows on any run.
- The shared stack runs no edge-runtime container, so the `api` runs used `supabase functions serve` from this worktree, stopped after each run.

**Residual risks:**
- The deferred migration-versus-cron race above (low).
- Deploy order: between the migration and the function deploy, the old `send-push` still words the 8 PM reminder and both-answered the old way for a few minutes. Nothing wrong is sent, and nothing posts a removed kind (Design Notes).
