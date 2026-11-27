---
title: "Two nudges per question, held until the partner's 8 AM"
type: feature
ticket: '1'
created: '2026-11-27'
status: done
baseline_revision: 'e4326eba92738b6d1695105a4a1ba751db22ae9a'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/tickets/story-two-nudges-per-question-held-until-the-partner-s-8-am.md'
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md'
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: [oversized]
deferred:
  - summary: >-
      A device clock behind the server's keeps the nudge controls enabled after the server's closing instant, so each tap gets DQ009 and "Your nudge could not be sent." until the device clock catches up.
    evidence: |-
      daily_day_snapshot does not null closes_at after the instant (DAILY-NUDGE-053) and useNudgeClosed compares closes_at with the device clock, so after a DQ009 refusal the re-read leaves the control offerable while Date.now() < closes_at. Real, low: needs clock skew at the end of the partner's day; a fix (closing the source on DQ009, or the server sending its own now) adds a branch the plan does not settle (review 2026-11-27: blind-hunter).
    location: >-
      src/stores/slices/dailyDaySlice.ts (sendDailyNudge refusal path); src/components/DailyQuestion/useNudgeSend.ts (useNudgeClosed)
    severity: low
  - summary: >-
      A definite PostgREST error on a nudge send (an expired-token 401, a PGRST code) is treated as a lost answer, so a failed re-read shows "couldn't check" instead of "could not be sent".
    evidence: |-
      isNudgeOutcomeUnknown counts every 'transport' AccountDataError as unknown, and toAccountDataError maps non-refusal PostgREST errors to 'transport'. Only the failure wording differs, and Nudge is re-enabled either way. Real, low, rare; the fix adds a classification branch (review 2026-11-27: edge-case-hunter).
    location: >-
      src/api/dailyQuestionApi.ts (isNudgeOutcomeUnknown, sendDailyNudge catch)
    severity: low
  - summary: >-
      A DQ010 "already sent" ending whose re-read fails marks the source sent only in memory, so an offline reload from the saved copy offers that control again until the next tap.
    evidence: |-
      sendDailyNudge applies withNudgeSent to the shown day only; the daily-days copy is written only from a successful server answer (AGENTS.md), and the refusal carries no snapshot. The next tap online is refused DQ010 again and ends as sent. Real, low: needs DQ010, a failed re-read and an offline reload (review 2026-11-27: edge-case-hunter).
    location: >-
      src/stores/slices/dailyDaySlice.ts (sendDailyNudge, DQ010 branch)
    severity: low
  - summary: >-
      The nudge prompt unmounts at the closing instant even while its send or the re-read after a lost answer is in progress, cutting short criterion 16's disabled-until-re-read.
    evidence: |-
      showNudgeSheet requires !promptClosed, so the sheet goes at closes_at whatever useNudgeSend's busy state; the outcome of a send in flight at that instant is then never shown on the prompt. Real, low: needs a send in flight at the end of the partner's day; keeping the sheet while busy means lifting the busy state into DailyQuestion (review 2026-11-27: intent-alignment).
    location: >-
      src/components/DailyQuestion/DailyQuestion.tsx (showNudgeSheet)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Epic 8's nudge spends one of two slots (`after_pick` / `evening`) keyed on the sender's local date, is refused (DQ009) whenever the day is not yet the partner's date, shows "failed" when a send's answer is lost, counts DQ010 as a failure, and skips the prompt after the write sheet. The owner replaced that (story file, 24 criteria): two sources per daily question (the after-answer prompt and the waiting card's button), keyed on `day_id`, every nudge before 08:00 on the partner's clock held and pushed by the `daily-reminders` job at 08:00-08:30 there, refused once the day has ended on the partner's clock, and a both-ways partner link required.

**Approach:** One new migration reshapes `daily_nudges` (source, held, released_at), rewrites `record_daily_nudge`, `send_daily_nudge` (one-arg calls still work and count as the button), `daily_day_snapshot` (drops `nudge`, adds `nudges`) and `enqueue_daily_reminders` (releases held nudges); send-push gets the new body and skips an unreleased held row; the client reads per-source state and the closing instant, shows the prompt after the write sheet and after a queued pick sends, and runs both sends through one handler with DW-539's "unknown is not failed" rule.

## Boundaries & Constraints

**Always:**
- Every criterion 1-24 of the story file is met; the story's Boundaries hold (other refusals, offline refusal via `requireOnline`/`offlineMessage`, the prompt closing when the partner answers, both-answered push, date reminders and other pushes untouched; every remaining push keeps badge and `partner-activity` group).
- Server functions read no clock but their `at` argument (AD-8); time-based tests use fixed instants passed to server functions, unit tests use faked time, E2E page clocks come from `clockAnchor()`; never move a device or Mac clock.
- One shared local Supabase stack, never a second; apply the new migration with `supabase migration up` (no `db reset`); CLI version pinned in `.mise.toml`.
- New migration file sorts after `20261126020000`; hosted catalog was read on 2026-11-26 (story Notes): no hosted-only names, so plain `drop … if exists` on names this migration replaces.
- Regenerate `src/types/database.types.ts` with `npm run db:types`, never by hand. Every changed client RPC stays in `40_daily_question_gate.sql` and FN-GRANT-008.
- pgTAP files that pin exact sets (`policies_are`, trigger lists, key lists, function lists, `columns_are`, plan counts) are edited in the same change.
- Async store writes after an `await` re-check `{userId, authSessionVersion}` (and `pairEpoch`) as `sendDailyNudge` does today. Any new account-scoped store field goes into `signedOutState()` in the same commit.
- Daily's saved copy is still written only from a successful server answer.

**Never:**
- Never change `src/services/dateReminders.ts`, `reminderIdsToCancel`, the 8 AM `morning` push, the partner-picked push, the New question / Partner picked switches or `push-copy.md` (story 11.2), nor drop `push_preferences` columns (epic 10, DW-548). The streak week row is story 11.3's.
- Never add a `nudge` key back to the snapshot, never remove/rename `slot` or `spent` semantics in the old builds' schema expectations, and never give the old builds' `slot` a new value.
- Never store a nudge-prompt dismissal on disk: the prompt is raised only by an answer confirmed while Daily is mounted, so a reload or return never re-raises it (criterion 5) without a stored flag.
- Never call `supabase.channel()` directly or `PERFORM realtime.send()` in an RPC; never use `new Date('YYYY-MM-DD')` (use `parseEventDate`).
- Never add an `eslint-disable` that a direct fix can replace.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nudge after partner's 08:00 | viewer picked, partner not, link both ways, `at` ≥ partner 08:00 on day, < day end | row `held=false`, push posted on insert | none |
| Held: day not started / 00:00-08:00 | `at` < `(day + 08:00)` on partner's zone (UTC if none) | row `held=true`, no push; same snapshot result to sender | none |
| Release tick | partner local time 08:00-08:30 on `day`, partner has a zone, not picked, link both ways, no sibling pushed | `released_at=at`, UPDATE trigger posts `daily_nudge` once | per-nudge exception → warning |
| Two held, one question | both sources held | first (created_at, id) released, second never | none |
| One held, other pushed at 08:02 | tick at 08:05 | held one dropped (never released) | none |
| Partner picked / no zone / window missed | at tick | nothing released, nudge still counts as sent | none |
| Same source twice | retry or direct call | DQ010, nothing recorded | client: ends as sent |
| Day ended on partner's clock | `at` ≥ `(day + 1)` on partner's zone | DQ009 'The day has ended on your partner''s clock', nothing recorded | client: refused line |
| One-way link | viewer.partner_id = P, P.partner_id ≠ viewer | P0002, nothing recorded; snapshot `closes_at` null | refused line |
| Old one-arg call | `send_daily_nudge({day_id})` | recorded as `source='button'` | as above |
| Bad source | `source='other'` | 22023 'Unknown nudge source', nothing recorded | refused line |
| Lost answer | timeout / network / unparsable answer | controls stay disabled, re-read: sent → sent; not sent → "Your nudge could not be sent."; read fails → "We couldn't check if your nudge went through. Try again?" | Nudge re-enabled on the two failure lines |
| Old saved day | copy entry with `nudge {slot,spent}`, no `nudges` | `after_pick`+spent → prompt sent; `evening`+spent → button sent; `closes_at` null → unsent button hidden until the server answers | none |

</intent-contract>

## Code Map

Server (current state read at baseline):
- `supabase/migrations/20261125000000_daily_push_sender.sql:57-83` -- `daily_nudges` (from_user, to_user, day_id, sender_local_date, slot, created_at; `daily_nudges_slot_check`; unique `daily_nudges_sender_date_slot_key (from_user, sender_local_date, slot)`; `idx_daily_nudges_to_user`, `idx_daily_nudges_day_id`). RLS on, no policies, no API grants.
- `supabase/migrations/20261126020000_daily_nudge.sql` -- `daily_nudge_slot` (67-100, drop it), `record_daily_nudge(viewer, day_id, at)` (105-189; partner read at 119 one-sided; DQ009 at 150-152; sender-zone reads at 154-155), `send_daily_nudge(day_id)` (194-220), `daily_day_snapshot` (225-419; nudge offer 297-316, one-sided at 302-304; returned `nudge` at 399-402; the `write.target_day` walk 318-378 must be copied unchanged), trigger `daily_nudges_push_after_insert` (424-428), comments on `daily_nudges`, `notify_push()`, `push_sender_settings`.
- `supabase/migrations/20261126000000_daily_reminders_schedule.sql:57-164` -- `enqueue_daily_reminders(at)`; evening_partner skip on the `evening` slot at 127-134; per-person exception block; cron job `daily-reminders` runs `select public.enqueue_daily_reminders(now())` (keep that command).
- `supabase/migrations/20261031020000_push_moods_photos_interactions.sql:83-120` -- `notify_push()` reads only `tg_argv[0]` and `new.id`, so it works unchanged as an AFTER UPDATE trigger (precedent: `20261031040000_push_partner_requests.sql:103-106`).
- `supabase/functions/send-push/index.ts:126-133` (`getDailyNudge` selects `id, from_user, to_user, day_id`), `handler.ts:457-470` (nudge case: day lookup, `getCoupleStreak` for `held` streak, `buildDailyNudgePayload(name, held)`), `payload.ts:242-249` (title `${partnerName(fromName)} nudged you`, streak body; `dailyPayload(..., true)` keeps sound `default` and thread `partner-activity`). Tests: `handler.test.ts` (`DAILY_NUDGE_ID`, `dailyNudge` fixture 88-93, `fakeDb`, `postDaily`, `NUDGE_POST`, nudge tests ~1461/1487 asserting `streakLookups`), `payload.test.ts:252-265`.

pgTAP (all build users inline; queued calls read from `net.http_request_queue`; instants are literals):
- `supabase/tests/database/50_daily_nudges.sql` plan(52) -- slot/record/send/snapshot/trigger pins (006 exact trigger list `daily_nudges_push_after_insert notify_push O 5`, 007 no WHEN). Rewrite for the new model.
- `47_daily_pushes.sql` plan(74) -- DAILY-PUSH-003 `columns_are`, 005/073/074 not-null, 015-021 direct inserts on the slot key, 040/042 `slot='after_pick'`.
- `48_daily_reminders.sql` plan(52) -- DAILY-REM-032/033/034 (evening nudge skip, by slot), DAILY-REM-040 one-way link pattern (`update users set partner_id …`).
- `40_daily_question_gate.sql` plan(129) -- DAILY-038 snapshot keys incl. `nudge`, DAILY-123 nudge keys, DAILY-124-129 `send_daily_nudge` grants/auth/DQ007/`{"slot": null, "spent": false}`.
- `18_function_execute_grants.sql` FN-GRANT-008 (exact list of authenticated-executable functions), `35_push_devices.sql:680-683` (partner_requests UPDATE trigger pin, a model for the new one).

Client:
- `src/api/validation/dailyQuestionSchemas.ts:18-52` -- plain `z.object` (unknown keys stripped, not rejected); `nudge` optional (46-51) with `slot` enum `after_pick|evening`.
- `src/api/dailyQuestionApi.ts` -- `NUDGE_FAILED_MESSAGE` (86), `NUDGE_REFUSAL_CODES` (94-100, DQ010 counted as failure), `announceDailyNudge` (273-277), `sendDailyNudge(dayId)` (284-305; timeout/network → `'transport'` via `toAccountDataError`).
- `src/stores/slices/dailyDaySlice.ts` -- `mergeAnswer` (251-264, uses `keepNudgeSpent`), `showIfOnScreen` (324-336: shows only the shown `day_id`, or fills an empty screen with today's device date — already gives criterion 15), `drainOnce` (434-518; confirmed row → `mergeDailyDay` → `showIfOnScreen` 467-491, no UI signal), `refreshDailyDay` (622-648, swallows errors, returns void), `submitDailyPick` (returns the stored answer or `undefined` when queued), `sendDailyNudge` (797-837).
- `src/services/dailyDaysCopy.ts` -- `keepNudgeSpent` (75-84), `parseSavedDays` (91-101, skips a failing entry), `mergeSnapshots` (176-196) used by `mergeDailyDay` and `mergeDailyDays`.
- `src/components/DailyQuestion/DailyQuestion.tsx` -- `WaitingCard` (246-302; `canNudge` 259; own `nudgePartner` handler 261-271; `daily-nudge`, `daily-nudge-error`), offer state `nudgeOffer` (594), `markWriteShown`/`writeShownIn` (597-598, the epic-8 rule to remove), `closeNudgeOffer` (599), `offerNudge` (603-612), `dropNudgeOffer` (614-617, partner's `daily_pick`), `showNudgeSheet` (619-628), `useDailyPickListener(dropNudgeOffer)` (709), `useDailyDayRereads` (711), sheet render (845-855).
- `src/components/DailyQuestion/NudgeSheet.tsx` (title 97-99; `close` no-op while sending 59-61; `daily-nudge-sheet-send|dismiss|error`), `nudgeFailureMessage.ts` (14-18), `WriteQuestionSheet.tsx` (`onShown` 103-108).
- `src/hooks/useDailyDayRereads.ts` -- 20:00:05 evening re-read timer (29-60, retrospective F1c: goes with the slots); visibility re-read (62-65) stays.
- `src/hooks/useDailyPickListener.ts:69-72` -- `daily_nudge` broadcast → `refreshDailyDay(day_id)` (keep).
- `src/services/pushNotifications.ts:168` -- `daily_nudge` taps open `daily` (keep).

Tests and helpers to reuse:
- `tests/unit/stores/dailyQuestionFixture.ts` (`nudgeSnapshot(slot, spent)` 37-43 → replace/extend with a per-source builder), `tests/unit/stores/navigatorFixtures` (`setOnline`), `tests/unit/stores/dailyQuestionSlice.nudge.test.ts`, `tests/unit/services/dailyDaysCopy.test.ts:77-150`, `src/api/__tests__/dailyQuestionApi.test.ts:396-476`, `src/components/DailyQuestion/__tests__/{NudgeSheet,DailyQuestion.nudge,DailyQuestion.afterPick,WriteQuestionSheet}.test.tsx`, `src/hooks/__tests__/{useDailyDayRereads,useDailyPickListener}.test.ts`.
- `tests/support/helpers/push-requests.ts` (`setUpPair`, `awaitRequests(admin, id, 'daily_nudge_id', n)`, `requestsFor`, `postKindToSender`), `migration-replay.ts` (`runPsql`, replay a migration in a rolled-back transaction; precedent `tests/integration/claude-bot-config-forward-migration.spec.ts`), `push-daily-reminders.spec.ts:55-68` (`otherAccountsDueAt`), `after-pick-sheet.ts` (`closeAfterPickSheet`), `reads.ts:133-134` (`DAILY_NUDGE_SEND`), `row-audit.ts:42-44`, `events.ts` (`clockAnchor`, `waitClearOfDailyTurns`).
- E2E: `tests/e2e/daily/daily-question-nudge.spec.ts` (asserts `slot` regex and `nudge.spent`), `daily-question-after-pick-nudge.spec.ts` (writer never sees the sheet — now reversed). API: `tests/api/push-daily-nudge.spec.ts` (body, `nudge` equality, DQ010), `push-daily-sender.spec.ts:110-190` (`addNudge(from,to,slot)` direct inserts). Live: `tests/live/daily-question-live.spec.ts:338-414` (Not now then button; asserts `snapshot.nudge?.spent`).
- Design: https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, boards `Notification.dc.html` (The nudges) and `Waiting.dc.html` (Waiting on Jessie). The visuals already exist; this story changes only when controls show, grey or hide.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261127000000_daily_nudge_per_question.sql` -- new migration, header in the house style (What changes / Refusal codes / Grants / Hosted catalog / pgTAP): (1) `daily_nudges`: add `source text`, `held boolean not null default false`, `released_at timestamptz`; backfill `source` from `slot` (`after_pick`→`prompt`, `evening`→`button`); delete duplicates per (from_user, day_id, source) keeping the earliest `(created_at, id)`; set `source not null`, add `daily_nudges_source_check (source in ('prompt','button'))` and unique `daily_nudges_sender_day_source_key (from_user, day_id, source)`; drop `daily_nudges_sender_date_slot_key`, `daily_nudges_slot_check`, `slot`, `sender_local_date`; write these steps re-runnable (`if exists` / `if not exists` / guarded updates) so the replay spec can apply the file twice. (2) `drop function if exists public.daily_nudge_slot(uuid, timestamptz)`; drop `record_daily_nudge(uuid,uuid,timestamptz)` and `send_daily_nudge(uuid)` and create `record_daily_nudge(viewer, day_id, source, at)` and `send_daily_nudge(day_id uuid, source text default 'button')` per Design Notes, with grants restated (send: revoke public/anon, grant authenticated; record: revoke public/anon/authenticated each named, grant service_role). (3) `create or replace daily_day_snapshot` with `nudges` replacing `nudge` and `write` walk copied unchanged. (4) `release_held_daily_nudges(at) returns integer` (internal, same grant pattern) and `create or replace enqueue_daily_reminders(at)` calling it in its own exception block, and the evening_partner skip changed to "a `daily_nudges` row from the recipient with `day_id = v_day.id`". (5) Triggers: recreate `daily_nudges_push_after_insert` `when (not new.held)`; add `daily_nudges_push_after_release` `after update of released_at … when (old.released_at is null and new.released_at is not null)` → `notify_push('daily_nudge')`. (6) Rewrite comments on the table, the functions, `notify_push()` (now insert and update triggers) -- criteria 7, 8, 10-13, 18, 22-24.
- [x] `supabase/tests/database/50_daily_nudges.sql`, `47_daily_pushes.sql`, `48_daily_reminders.sql`, `40_daily_question_gate.sql`, `18_function_execute_grants.sql` (and any other file `grep -l "daily_nudge_slot\|sender_local_date\|'after_pick'\|nudge_push_after"` finds) -- re-pin columns, constraints, triggers (now two: insert with WHEN, update with WHEN), function lists, grants and snapshot keys (`nudges` with `prompt_sent`, `button_sent`, `closes_at`); fix plan() counts. In 50 add fixed-instant cases with sender on `Pacific/Kiritimati` (UTC+14) and partner on `Pacific/Honolulu` (UTC-10): per-source limit and DQ010 with nothing recorded, one source never spending the other, yesterday's nudges leaving today's open, held before the day starts and at 00:00-08:00 (no queued call), not held at/after 08:00 (one queued call), release at 08:00-08:30 posting exactly one queued call and a repeat tick posting none, a missed window (08:30+) posting none, partner picked by then → none, partner with no zone → none (held computed on UTC), two held → one queued call, one held + other sent 08:02 → nothing at the 08:05 tick, `closes_at` value and DQ009 at/after it, one-way link (service-role `update users set partner_id`) → P0002 with no row from either source and `closes_at` null, one-arg `send_daily_nudge` recorded as `button`, bad source refused; 48: the evening_partner skip by `day_id` -- criteria 7, 8, 11-14, 18, 22-24.
- [x] `supabase/functions/send-push/{index.ts,handler.ts,payload.ts}` + `handler.test.ts`, `payload.test.ts` -- `getDailyNudge` also selects `held, released_at`; a held row with `released_at` null answers 200 with zeros and sends nothing; drop the nudge's streak lookup; `buildDailyNudgePayload(name)` body `` `${partnerName(fromName)} answered the daily question and wants to know your answer!` `` (title unchanged, sound `default`, thread `partner-activity`, badge unchanged). Update fixtures and assertions -- criteria 4, 10, 12.
- [x] `npm run db:types` -- regenerate `src/types/database.types.ts` after the migration is applied locally.
- [x] `src/api/validation/dailyQuestionSchemas.ts` -- add optional `nudges: { prompt_sent: boolean, button_sent: boolean, closes_at: string (ISO offset datetime) | null }`; keep `nudge` optional with its old enum (saved days from the old build); add a frozen copy of the old build's snapshot schema in a test (not in `src/`) to prove criterion 18 -- criteria 18, 19.
- [x] `src/services/dailyNudges.ts` (new, small) -- `NudgeSource = 'prompt' | 'button'`; `nudgeState(snapshot)` returning `{ promptSent, buttonSent, closesAt }` from `nudges`, else from legacy `nudge` by slot with `closesAt: null`; `keepNudgesSent(entry, other)` for the stays-sent merge (per source OR; `closes_at` from `entry`, or from `other` when `entry` has no `nudges`) -- criteria 9, 19.
- [x] `src/services/dailyDaysCopy.ts`, `src/stores/slices/dailyDaySlice.ts` (`mergeAnswer`) -- replace `keepNudgeSpent` with `keepNudgesSent` -- criterion 9.
- [x] `src/api/dailyQuestionApi.ts` -- `sendDailyNudge(dayId, source)` calls `rpc('send_daily_nudge', { day_id, source })`; keep DQ007/8/9/P0002 (and the new 22023) as `'refused'`; DQ010 becomes distinguishable (export `isNudgeAlreadySent(error)` or an equivalent typed marker); transport/timeout and `invalid-response` stay distinguishable as "unknown" -- criteria 16, 17.
- [x] `src/stores/slices/dailyDaySlice.ts` -- `sendDailyNudge(source): Promise<'sent' | 'failed' | 'unchecked'>` (offline still throws the offline `AccountDataError`): success → merge, copy, show, announce, `'sent'`; DQ010 → mark that source sent on the shown day in memory, await a re-read, `'sent'`; other refusal → re-read (not awaited) and `'failed'`; unknown → await a re-read of that day (a variant of `refreshDailyDay` that reports success and the snapshot), then `'sent'` if it has that source sent, `'failed'` if it read and has not, `'unchecked'` if the read failed. Add a queue-confirmed signal (e.g. `dailyQueuedPickSent: { dayId, seq } | null`, set in `drainOnce` for each confirmed row, reset in `signedOutState()`) -- criteria 3, 16, 17.
- [x] `src/components/DailyQuestion/useNudgeSend.ts` (new hook) + `nudgeFailureMessage.ts` -- one send handler for both controls: `{ send, busy, error }` where `busy` covers the send and its re-read; maps `'failed'` → `NUDGE_FAILED_MESSAGE`, `'unchecked'` → `"We couldn't check if your nudge went through. Try again?"`, offline → `offlineMessage`. `useNudgeClosed(closesAt)` (same file or sibling) returns `closed` and flips at `closes_at` with one `setTimeout`, no re-read -- criteria 14, 16, 17.
- [x] `src/components/DailyQuestion/DailyQuestion.tsx`, `NudgeSheet.tsx` -- offer the prompt when an answer is confirmed (in-view send, or the queue signal changing while mounted; a signal value present at mount is ignored) and `nudgeState` has `closesAt` non-null, now < `closesAt`, prompt unsent and day state `me`; remove `writeShownIn`/`markWriteShown` so the prompt shows once the write sheet closes however it closes (still waits for +1/milestone; still dropped when the partner answers); NudgeSheet keeps Nudge and Not now disabled and scrim/Escape inert while `busy`; Nudge hidden (sheet closes) once closed. WaitingCard: button enabled while button unsent and not closed; shown as sent, greyed, when `buttonSent`; hidden otherwise (closed and unsent, or `closesAt` null and unsent) -- criteria 1, 2, 3, 5, 6, 13, 14, 16, 17, 19.
- [x] `src/hooks/useDailyDayRereads.ts` + its test -- remove the 20:00:05 evening re-read (F1c); keep the visibility re-read.
- [x] Unit/component tests -- update `dailyQuestionFixture.ts` (per-source builder), `dailyQuestionApi.test.ts`, `dailyQuestionSlice.nudge.test.ts`, `dailyDaysCopy.test.ts`, `NudgeSheet.test.tsx`, `DailyQuestion.nudge.test.tsx`, `DailyQuestion.afterPick.test.tsx`, `WriteQuestionSheet.test.tsx`, `useDailyPickListener.test.ts`; add: closing instant with faked time (unsent prompt/button hidden at the instant, sent button stays grey; follow AGENTS.md's user-event fake-timer rule), lost answer three outcomes for both sends, DQ010 as sent for both sends, the write sheet closing by each of its four ways then the prompt, the queue signal while mounted vs before mount, old schema (frozen copy) parsing the new snapshot with no `nudge`, legacy saved days read by slot with the unsent button hidden, a held nudge's `daily_nudge` signal leaving the partner's own day on screen -- criteria 1-3, 5, 6, 9, 14-19.
- [x] `tests/e2e/daily/daily-question-nudge.spec.ts`, `daily-question-after-pick-nudge.spec.ts`, `tests/support/helpers/{after-pick-sheet,row-audit}.ts` -- assert `source` instead of `slot`, `nudges` instead of `nudge`; prompt after the write sheet's No thanks; Not now then the waiting card's button still sends once; button shows as sent after reload -- criteria 1, 2, 5, 6.
- [x] `tests/api/push-daily-nudge.spec.ts`, `push-daily-sender.spec.ts`, new `tests/api/push-daily-nudge-held.spec.ts`, new migration-replay spec -- new body; DQ010 per source; one-arg call recorded as button; a held nudge recorded through `record_daily_nudge` at a fixed instant before the partner's 08:00, then `enqueue_daily_reminders(at)` at the partner's 08:0x reaching send-push once (`awaitRequests(..., 'daily_nudge_id', n)`), guarded by an `otherAccountsDueAt`-style check that no other account on the stack is due at that instant; the replay spec seeds old-shaped rows (both slots, and a DW-532 duplicate) and asserts `prompt`/`button` mapping and earliest-kept dedupe, rolled back -- criteria 4, 12, 18, 23.
- [x] `tests/live/daily-question-live.spec.ts` -- A answers (No thanks on a writing day), sees the prompt, taps Nudge: one `send_daily_nudge` answered 200; reload: no prompt, enabled waiting-card Nudge; tap: one request, 200; reload: button shows as sent -- criterion 20.
- [x] `_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md` -- rewrite AD-3, AD-9, AD-10, AD-13, AD-15, AD-16, AD-17 to the new rules (two sources per sender per question keyed on `day_id`, recorded with source; held before the partner's 08:00 and posted by the `daily-reminders` job when the hold ends via the release UPDATE trigger; DQ009 once the day has ended on the partner's clock; `nudges {prompt_sent, button_sent, closes_at}` and no `nudge`); none of them may give a slot or the sender's date as the limit. Leave the push-copy and removed-push rules to story 11.2 -- criterion 21.

**Acceptance Criteria:**
- Given the story file's criteria 1-24, when the Verification commands run on the shared local stack, then each criterion is proven by at least one listed test (pgTAP, unit, E2E, api or live) and all pass.
- Given an installed build from before this epic, when it reads a day or sends `send_daily_nudge({day_id})` against the new server, then its schema parses the answer (no `nudge`), and the nudge is recorded as the button's.
- Given the migration is applied, when the spine's AD-3, AD-9, AD-10, AD-13, AD-15, AD-16 and AD-17 are read, then none names `after_pick`, `evening` slot or the sender's date as the nudge limit.

## Implementation Notes

- The migration has no `begin`/`commit`, so `migration-replay.ts` can replay it in a rolled-back transaction (the CLI runs a file as one transaction anyway); the helper's own-transaction check now skips `$$` bodies, whose `end;` is plpgsql's.
- The waiting card's greyed button carries `data-sent="true"` (grey only ever means sent), which the unit, E2E and live specs read.
- `closeAfterPickSheet` now also closes the nudge prompt for the day's writer, after the write sheet.
- `push-daily-nudge.spec.ts` sends through the client RPC at the real clock, which a host clock before 08:00 on the partner's day holds, so it reads the row's `held` and asserts that branch; the held and release cases use fixed instants in `push-daily-nudge-held.spec.ts`.
- Shared Kathmandu-instant helpers moved from `push-daily-reminders.spec.ts` to `tests/support/helpers/daily-clock.ts`; the frozen old-build schema is `tests/support/helpers/old-build-day-schema.ts`.
- Left to the ledger: DW-555 (`waitClearOfDailyTurns` and the 20:00 / 08:00 turns).

## Plan Change Log

## Review Triage Log

### 2026-11-27 — Review pass
- verdicts: 26 findings — high 0, medium 1, low 21, false 4, maybe-false 0
- findings:
  - `low` `patch` DQ009 component test mocks a re-read with `closes_at: null`, which the server never returns — test now lets faked time pass the instant before the refusal and re-reads the same closesAt; the clock-skew behaviour it hid is filed in `deferred` (blind-hunter).
  - `low` `patch` useNudgeClosed's MAX_TIMER cap set nowMs to `at` when an early timer fired, closing early for an instant >24.8 days out — fixed by the useNudgeClosed rewrite: the clock is read in useSyncExternalStore and the timer re-arms until the instant (blind-hunter).
  - `low` `patch` useNudgeClosed's nowMs was stale for an already-past closesAt reaching a mounted hook, rendering the control enabled until a 0 ms timer, and its comment claimed otherwise — rewritten on useSyncExternalStore so that render is closed; comment corrected; test added (blind-hunter).
  - `low` `patch` spine line 19 ("nudges … insert-only") and the AD-10 heading contradicted the release UPDATE — reworded both (blind-hunter).
  - `low` `patch` AD-3 still named AD-17 as a reader of `user_local_date` — AD-17 reference dropped, AD-10 kept (blind-hunter).
  - `low` `patch` migration and dailyNudges.ts comments presented after_pick→prompt / evening→button as which control was tapped, though the slot followed the sender's clock — reworded as the owner's decided mapping (criteria 19, 23) (blind-hunter).
  - `low` `reject` a released nudge and the 8 AM `morning` push go out on one tick in no set order — out of scope by intent: story 11.2 removes the 8 AM push and both ship in one PR and deploy, so the interim never reaches production (story Notes) (blind-hunter).
  - `low` `reject` unreleased held nudges are rescanned every tick with no partial index — no named harm: at most two rows per couple per day on a two-person app (blind-hunter).
  - `low` `reject` no tests for the release's exception blocks or for the count excluding releases — coverage only, no defect shown; the blocks copy enqueue_daily_reminders' existing per-person block, and a fault-injection harness is more than a direct correction (blind-hunter).
  - `low` `patch` dailyQueuedPickSent docs said "confirmed and shown" though every confirmed row sets it — reworded to "confirmed (on screen or not)", Daily checks the day (blind-hunter).
  - `low` `patch` useNudgeClosed timer cap closes early (same root as the MAX_TIMER row) — fixed by the same rewrite (edge-case-hunter).
  - `low` `patch` a render after closesAt before a throttled timer fires shows the control enabled (same root as the stale-nowMs row) — fixed by the same rewrite (edge-case-hunter).
  - `false` `reject` a partner zone change between hold and 08:00 leaves the nudge unreleased — the release follows the partner's clock as it is at 8 AM, which the intent states, and a clock that jumps past 08:00 is a missed window, which the intent says sends nothing (edge-case-hunter).
  - `low` `defer` definite PostgREST errors are treated as lost answers, giving "couldn't check" wording — real, rare, only the wording differs; filed in `deferred` (edge-case-hunter).
  - `low` `defer` DQ010 with a failed re-read marks sent only in memory, so an offline reload re-offers the control — real, rare, the copy is written only from server answers; filed in `deferred` (edge-case-hunter).
  - `false` `reject` a held nudge for a partner with no zone row is never released — that is criterion 12 ("no push goes out when the partner … has no stored time zone"; the nudge still counts), pinned by DAILY-NUDGE-070 (edge-case-hunter).
  - `medium` `patch` the test named for a second queued answer drained only one pick, so a two-row drain (earlier day, then the shown day) had no component coverage for criterion 3 — test renamed to what it checks, and a two-row drain test added asserting the prompt shows (verification-gap).
  - `low` `patch` useNudgeClosed stale nowMs for an already-past closesAt on a mounted hook (same root as the stale-nowMs row) — fixed by the same rewrite (verification-gap).
  - `low` `defer` the prompt unmounts at closesAt mid-send, cutting criterion 16's disabled-until-re-read — real, rare; filed in `deferred` (intent-alignment).
  - `low` `patch` long-timer early close (same root as the MAX_TIMER row) — fixed by the same rewrite (intent-alignment).
  - `false` `reject` criteria tested at pgTAP/api/unit surfaces rather than real devices, hosted cron and APNs — the story's verify line names exactly these surfaces (intent-alignment).
  - `low` `reject` write sheet closing by a send or a scrim tap is covered by unit tests only — the unit tests render the real DailyQuestion and WriteQuestionSheet, which the verify line allows; E2E covers No thanks and Escape (intent-alignment).
  - `low` `reject` the switch-off case is tested only for an immediate nudge, not a released held one — a released row takes send-push's same generic switch and device path, and handler tests cover a released held row (intent-alignment).
  - `low` `defer` E2E nudge paths depend on the host clock's 08:00 hold branch — already in the ledger as DW-555, not filed again (intent-alignment).
  - `low` `patch` AD-3 stale AD-17 pointer (same root as the AD-3 row) — fixed with it (intent-alignment).
  - `false` `reject` the nudge push no longer checks its couple day exists — `daily_nudges.day_id` cascades from `couple_days`, so a nudge whose day is gone has no row and getDailyNudge already answers 404 (intent-alignment).

## Design Notes

**Instants (partner zone `z` = `user_time_zones.effective_zone` of the partner, `'UTC'` when no row; read once per call):**
```sql
v_hold_ends := (v_day.day::timestamp + time '08:00') at time zone coalesce(v_zone, 'UTC');
v_closes_at := ((v_day.day + 1)::timestamp)        at time zone coalesce(v_zone, 'UTC');
-- record: DQ009 when at >= v_closes_at; held := at < v_hold_ends
```
No read of the sender's zone remains (DW-533: at most one may).

**`record_daily_nudge(viewer, day_id, source, at)` order:** source not in (prompt, button) → 22023 'Unknown nudge source'; P0002 unless the viewer's `partner_id` = P **and** P's `partner_id` = viewer and the day is theirs (row `FOR UPDATE`, as today); DQ007; DQ008; DQ009 (closed); DQ010 when a row (viewer, day_id, source) exists; insert `on conflict on constraint daily_nudges_sender_day_source_key do nothing`, no row → DQ010; return the snapshot. `send_daily_nudge(day_id, source default 'button')` — one function, so PostgREST's `{day_id}` from old builds resolves to it with `button` (no overload ambiguity).

**Snapshot `nudges`:** `prompt_sent`/`button_sent` = a row from the viewer for this `day_id` and source exists (always, whatever the state). `closes_at` = `v_closes_at` when the viewer has picked, the partner has not and the link is both ways; else null. The server does not null it after the instant; the client compares with its clock. Old builds strip `nudges` and read no `nudge`, so their button stays grey and they show no prompt.

**Release (`release_held_daily_nudges(at)`):** loop held rows with `released_at is null`, joined to `couple_days d` and the partner's `user_time_zones` (inner join: no zone, never), where `at at time zone zone` is on `d.day` and in [08:00, 08:30), ordered `from_user, day_id, created_at, id`; per row in its own exception block: lock `d` `FOR UPDATE`; skip if the partner picked, if the link is not both ways, or if another row from the same sender for that `day_id` was pushed (`not held` or `released_at is not null`); else `update … set released_at = at where id = … and released_at is null`. The ordered loop makes "two held → one push" fall out of the sibling rule. send-push applies the Nudges switch and devices at send time, as for every nudge.

**Client state:** one reader, `nudgeState(snapshot)`, used by the merge and both controls, so legacy `nudge` is read in one place. Offer rule for a source: `closesAt !== null && now < closesAt && !sent`. Grey only means sent; unsent and not offerable is hidden. The prompt is not persisted: it is raised only by a confirmed answer while mounted, so criteria 3 and 5 need no stored flag.

**Consolidation:** the waiting card's copy of the send handler goes; both controls use `useNudgeSend` so criteria 16-17 have one implementation (story Notes asks for one rule).

**Migration proof:** pgTAP runs only after the migration, so the `after_pick`/`evening` → prompt/button mapping (criterion 23) is proven by replaying the migration file in a rolled-back transaction (`migration-replay.ts`), which is why the table steps are re-runnable; pgTAP proves the per-source semantics of rows already in that shape.

## Verification

**Commands:**
- `supabase migration up` then `supabase test db` -- expected: all pgTAP files pass.
- `npm run db:types && git diff --stat src/types/database.types.ts` -- expected: only the nudge tables/functions change.
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass.
- `npm run typecheck && npm run lint` -- expected: clean.
- `npm run test:unit` and `SEED=11 npm run test:unit:coverage` -- expected: pass (shuffled too).
- `npx playwright test --project=api tests/api/push-daily-nudge.spec.ts tests/api/push-daily-nudge-held.spec.ts tests/api/push-daily-sender.spec.ts tests/api/push-daily-reminders.spec.ts` plus the replay spec -- expected: pass.
- `npx playwright test --project=chromium tests/e2e/daily/` -- expected: pass.
- `npx playwright test -c playwright.live.config.ts` (local mode, no `LIVE_BASE_URL`) -- expected: pass.
- `deno test --no-lock supabase/functions/upload-love-note-image/` and `npx vitest run src/services/__tests__ -t dateReminders` (or the dateReminders test file) -- expected: unchanged and passing.

## Auto Run Result

Status: built

**Summary:** The daily nudge moves from two slots keyed on the sender's date to two sources (the after-answer prompt and the waiting card's button), each once per question (`day_id`). A nudge before 08:00 on the partner's clock is recorded held and released by `enqueue_daily_reminders` at 08:00-08:30 there (one push for two held nudges; dropped when the other was already pushed). A nudge is refused once the day has ended on the partner's clock, and the partner link must go both ways. The snapshot drops `nudge` for `nudges {prompt_sent, button_sent, closes_at}`; old builds' one-argument call counts as the button. The client hides unsent controls at `closes_at` with no re-read, shows the prompt after the write sheet and after a queued pick sends while Daily is open, and treats lost answers and DQ010 per DW-539 through one send hook. send-push has the new body and skips an unreleased held row.

**Files changed:**
- `supabase/migrations/20261127000000_daily_nudge_per_question.sql` — table reshape and backfill, new record/send/snapshot/release functions, enqueue change, insert and release triggers.
- `supabase/tests/database/{18,40,47,48,50}_*.sql` — re-pinned grants, keys, columns, triggers; 85 fixed-instant nudge cases (UTC+14 sender, UTC-10 partner).
- `supabase/functions/send-push/{handler,index,payload}.ts` + tests — new nudge body, held-row skip, no streak lookup.
- `src/types/database.types.ts` — regenerated with `npm run db:types`.
- `src/api/dailyQuestionApi.ts`, `src/api/validation/dailyQuestionSchemas.ts` — source argument, `nudges` schema, DQ010 and lost-answer classifiers, unchecked message.
- `src/services/dailyNudges.ts` (new), `src/services/dailyDaysCopy.ts` — one reader of nudge state (legacy slots read by slot), per-source stays-sent merge.
- `src/stores/slices/dailyDaySlice.ts`, `authSlice.ts` — `sendDailyNudge(source)` outcomes, `readDayById`, `dailyQueuedPickSent` (reset at sign-out).
- `src/components/DailyQuestion/{DailyQuestion,NudgeSheet,WriteQuestionSheet}.tsx`, `useNudgeSend.ts` (new), `nudgeFailureMessage.ts` — prompt and button rules, shared send hook, closing-instant hook.
- `src/hooks/useDailyDayRereads.ts` — 20:00:05 re-read removed.
- Unit, component, API, integration (migration replay), E2E and live specs, plus helpers `daily-clock.ts`, `old-build-day-schema.ts`, `after-pick-sheet.ts`, `migration-replay.ts`.
- `architecture-daily-question.md` (AD-3, 9, 10, 13, 15, 16, 17 and line 19), `deferred-work.md` (DW-555).

**Review findings:** 26 findings, 14 rows patched (7 entries after grouping: one medium, six low), 5 deferred (4 filed in `deferred`, 1 already DW-555), 7 rejected with reasons in the Review Triage Log.

**Follow-up review recommendation:** false. Patched entries by verdict: high 0, medium 1, low 6. No high was patched and fewer than two mediums.

**Verification:**
- `supabase migration up`: applied. `supabase test db`: PASS, 37 files, 1204 tests. One later run failed in the untouched `41_daily_question_own_clocks.sql` on a foreign key while another session wrote to the shared stack; the rerun passed.
- `deno test --no-lock supabase/functions/send-push/`: 128 passed. `upload-love-note-image`: 5 passed. No `deno.lock` written.
- `npm run typecheck`: only the worktree-only TS2883 errors in the untouched `tests/unit/stores/dailyQuestionViewMocks.ts`. `npm run lint`: clean.
- `SEED=11 npm run test:unit:coverage`: 279 files, 5476 tests passed after the patches (5474 before them).
- API specs (nudge, held, sender, reminders, picks): 10 passed. Teardown's row audit flagged 35 picks on pool slot 2 that another session's 35-day seed wrote during the run; this run used only slot 0.
- Integration (migration replay plus its precedent): 4 passed.
- E2E: `tests/e2e/daily` plus the three partner specs that close the after-pick sheet passed 38 of 40. The 2 failures happened while another session shared the pool accounts, and both passed (5 tests) when rerun alone. After the patches the two nudge specs passed again (5 tests).
- Live check, local mode: passed before and after the patches.
- E2E and live ran on a dev server started from a scratch Vite config without `vite-plugin-checker`, because the worktree-only TS2883 overlay blocks clicks. A temporary untracked Playwright config pointed the live check's server at it and was deleted after.

**Residual risks:**
- The four `deferred` items above (all low).
- DW-555: E2E nudge paths depend on the host clock's 08:00 hold branch.
- A queued drain that confirms the shown day first and an earlier day after it would not offer the prompt. This is unreachable as far as checked, because picks drain oldest first and a pick can only be for the day then shown.
