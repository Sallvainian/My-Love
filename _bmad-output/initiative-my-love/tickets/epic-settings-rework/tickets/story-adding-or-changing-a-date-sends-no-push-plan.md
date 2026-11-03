---
title: 'Adding or changing a date sends no push'
type: 'feature'
ticket: '4'
created: '2026-11-03'
status: done
baseline_revision: '651d82808f68abb83ce3e67d5541ba33bc6eb3d8'
route: 'full'
route_source: 'auto'
risk: 'medium'
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

**Problem:** Every event added or changed, wedding date, Together since and birthday write pushes the partner (story 3.5's `notify_date_change` path). The owner decided on 2026-11-02 that no date change pushes (DW-416, R14); with tap-to-edit every field save would push.

**Approach:** First of DW-416's two deploys: a migration drops the five date triggers, `notify_date_change()`, `push_requests.date_change_id` (with its unique key, rebuilding the source check without it) and `date_changes`; send-push loses its `date` kind; the client stops reading and writing the `dates` preference and drops the Dates switch and the `date` tap route; tests, `database.types.ts` and the sim-driver docs follow. `push_preferences.dates` stays (story 18 drops it once both phones run this code).

## Boundaries & Constraints

**Always:** Drop with `drop … if exists`. Delete `push_requests` rows whose `date_change_id` is set before the column goes, or the rebuilt source check fails on them. Regenerate `src/types/database.types.ts` with `npm run db:types` using CLI 2.122.0 (the pinned version), never by hand. Every other push kind, its switch and its pins unchanged. Match surrounding style by hand (no `prettier --write`).

**Never:** Do not drop or stop pinning `push_preferences.dates` (`36_push_preferences.sql` stays as is): installed shells still select and upsert it. No `supabase db reset` on the shared local stack. No change to date reminders or to `date_reminders`. Do not mark DW-416 done.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Date writes | linked user inserts/edits an event, sets/changes wedding date and Together since, sets/changes birthday, sender settings present | no `net.http_request_queue` call, no `push_requests` row for the partner | writes succeed |
| Control | same section then inserts a mood | one queued `{kind: mood}` call / recorded request | — |
| Old post | `{kind: 'date', id: <uuid>}` to send-push | 400 (unknown kind) | — |
| Old tap | push data `{kind: 'date'}` | `viewForPush` returns null | — |
| Old saved copy | `push-preferences` copy carrying `dates` plus the six switches | parses, result has no `dates` key | — |
| Old recorded rows | `push_requests` rows with `date_change_id` | deleted by the migration | — |

</intent-contract>

## Code Map

- Hosted catalog, read 2026-11-03 read-only: exactly the objects of `20261031030000_push_date_changes.sql` — triggers `events_push_after_insert`, `events_push_after_update`, `couple_settings_push_after_insert`, `couple_settings_push_after_update`, `users_push_after_birthday`; `notify_date_change()`; table `date_changes` (index `date_changes_event_id_idx`, no policies); `push_requests.date_change_id` with `push_requests_date_change_id_fkey`, `push_requests_date_change_token_key` and `push_requests_source_check` over seven columns. No hosted-only names. Latest migration `20261102010000`.
- `supabase/migrations/20261031040000_push_partner_requests.sql:60-80` -- current source check and the `push_requests` / `push_sender_settings` comments to rewrite without the date source and `notify_date_change`.
- `supabase/functions/send-push/handler.ts` -- `PushKind` `date`, `PushPreference` `dates`, `PREFERENCE_FOR_KIND`, `POSTED_KINDS`, `DateChangeRow`, `PushDb.getDateChange`, `case 'date'`, `parseBody` message, doc lines 11-13, 35-37, 73, 205. `payload.ts` -- `buildDatePayload`, `PushDateChange`, the eight `EVENT_*`/`WEDDING_*`/`RELATIONSHIP_*`/`BIRTHDAY_*` constants, doc 13-16 and 32. `index.ts` -- `SOURCE_COLUMN.date`, `getDateChange`, `DateChangeRow` import, doc 4-10.
- `supabase/functions/send-push/handler.test.ts` -- `eventAdded` (44), `dateChange` fake option (72, 105), section 709-~820, the loop at 693, row 1015, the preference table 1033/1045. `payload.test.ts:136-160,199`.
- `src/services/pushPreferencesService.ts` -- `dates` in `PushPreferences`, `ALL_PUSH_PREFERENCES_ON`, `PreferencesRow`, `COLUMN`, `toPushPreferences`; header should say the column remains, unread, until story 18.
- `src/stores/slices/notificationsSlice.ts:63-81` -- `PUSH_PREFERENCE_KEYS` and its "seven switches" doc.
- `src/components/Settings/PushSettings.tsx:87-93` -- the Dates row (drop `CalendarHeart` if unused).
- `src/services/pushNotifications.ts:150-159` -- `VIEW_FOR_KIND.date`.
- Unit tests: `src/components/Settings/__tests__/PushSettings.test.tsx:74,188-192`; `tests/unit/services/pushPreferencesService.test.ts:44-52,73-82,113-121`; `tests/unit/stores/pushPreferencesCopy.test.ts:289-295`; `tests/unit/stores/signOutClearsAccountState.test.ts:527-535`; `src/services/__tests__/pushNotifications.test.ts:1019-1060`.
- `supabase/tests/database/35_push_devices.sql` -- header 5-6; `plan(121)`; date section 527-~904 (PUSH-DB-058..094, `t_c`, `tests.date_state`). The partner-request section that follows resets `push_sender_settings` itself; keep `t_pair` only if the new section uses it.
- `tests/api/push-love-note-trigger.spec.ts` -- header 7-9; `SourceColumn` `date_change_id`; the 404 loop at 560; `ChangeFilter`..`awaitDateRequests` (566-623) and `describe('Date change push')` (624-~935). Its `registerDevices`, `prepareCoupleSettings` restore and the birthday restore are the patterns to keep; the mood describe above shows a mood insert and its request poll.
- `scripts/sim-driver/README.md` (sim dates sentence "and their event and birthday writes send the other person date-change pushes") and `scripts/sim-driver/sim:78-79`.
- `_bmad-output/initiative-my-love/deferred-work.md:3614-3620` -- DW-416.
- Types: `npm run db:types` runs `supabase` from PATH; the installed CLI is 3.0.0, so put a scratch shim first on PATH that runs `npx -y supabase@2.122.0 "$@"` (stories 5.1 and 5.3 did the same). Apply with `supabase migration up --local` through the shim.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261103000000_remove_date_change_push.sql` -- header (story 5.4, DW-416, the hosted check above, why `dates` stays); `begin`; drop the five triggers and `notify_date_change()`; delete date-sourced `push_requests` rows; drop `push_requests_source_check`, `push_requests_date_change_token_key`, `date_change_id`; re-add the source check over the six remaining columns; drop `date_changes`; rewrite the `push_requests` and `push_sender_settings` comments; comment `push_preferences.dates` as unread since 5.4; `commit`.
- [ ] `supabase/functions/send-push/{handler,payload,index}.ts` -- remove the date kind and `dates` preference as Code Map.
- [ ] `supabase/functions/send-push/{handler,payload}.test.ts` -- remove date cases and fixtures; add: `{kind: 'date'}` answers 400 and claims nothing.
- [ ] `src/services/pushPreferencesService.ts`, `src/stores/slices/notificationsSlice.ts`, `src/components/Settings/PushSettings.tsx`, `src/services/pushNotifications.ts` -- drop `dates` and the date route.
- [ ] Unit tests in the Code Map -- drop `dates`; the loaded-state case checks `photos` instead; the service test asserts the select list does not name `dates`; the copy test adds the "old copy with `dates` parses without it" case; `viewForPush({kind: 'date'})` is null.
- [ ] `supabase/tests/database/35_push_devices.sql` -- replace 058-094 with a "Date changes removed (story 5.4)" section: `date_changes` and `notify_date_change()` absent, none of the five triggers exist, `push_requests` has no `date_change_id` and its source check names six columns; with sender settings present and the queue emptied, user a's event insert and edit, couple-settings wedding and start-date set and change, and birthday set and change queue no call; then a mood queues exactly one. New ids start at PUSH-DB-058; set `plan()` to the real count; fix the header.
- [ ] `tests/api/push-love-note-trigger.spec.ts` -- replace the date describe with one `[P0]` test: partner devices registered, the same writes as the user (originals restored at teardown as now), then a mood; once the mood's requests are recorded, every `push_requests` row for the partner's tokens has `mood_id` set. `date` moves from the 404 loop to the 400 refusals; header updated.
- [ ] `src/types/database.types.ts` -- `npm run db:types`; only `date_changes` and `date_change_id` lines go.
- [ ] `scripts/sim-driver/README.md`, `scripts/sim-driver/sim` -- drop the date-change-push clause.
- [ ] `_bmad-output/initiative-my-love/deferred-work.md` -- DW-416 stays open; add a `progress:` line: 2026-11-03 story 5.4 removed the triggers, function, `date_changes`, `date_change_id`, send-push's date kind and the client's `dates` use; `push_preferences.dates` and its `36_push_preferences.sql` pins remain for story 18.

**Acceptance Criteria:**
- Given a linked local stack with this migration, when the user adds or changes an event, the wedding date, Together since or their birthday, then no `push_requests` row is created for the partner, while a mood still is.
- Given the migrated schema, when it is inspected, then it has no `date_changes`, no `notify_date_change()`, none of the five triggers and no `push_requests.date_change_id`, and still has `push_preferences.dates`.
- Given Settings' push section in the shell, when it loads and a switch is tapped, then five switches show (no Dates) and each loads and saves as before.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan. Not in the Code Map: `tests/unit/stores/dateRemindersAtLaunch.test.ts` seeded `dates: false` and no longer typechecked; it now uses `photos: false`, which keeps the case's point (a non-reminder switch does not decide).
- `supabase migration up --local` also applied `20261102010000`, which the shared local stack had not had yet.
- The migration's delete of date-sourced `push_requests` rows was exercised against the real file: in one rolled-back transaction on the local DB, `20261031030000` was re-applied (minus `begin`/`commit`) with the seven-column check, a `date_changes` row and a request naming it were inserted (count 1), then `20261103000000` (minus `begin`/`commit`) ran — count 0, the check reads the six columns, `date_changes` and `notify_date_change()` gone. The rollback left the stack as migrated.
- `npm run db:types` through the CLI 2.122.0 shim reproduces the committed file byte for byte; the diff is 53 removed lines.
- Playwright reads the local keys from `supabase status`, which CLI 3.0.0 cannot parse here, so the E2E and API runs also need the shim on PATH. `send-push` was served with `supabase functions serve --no-verify-jwt` for the API run and stopped afterwards.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `PushSettings.test.tsx` header (line 3) and the test name at line 160 still said "six switches" after the Dates row went; the section has five push switches — both now say five.
  - `[low]` `[patch]` `send-push/handler.ts:33` was a 99-column doc line merged without re-wrapping — the "Why only a row id is accepted" paragraph re-wrapped to 78-81 columns, same words (the 102-column line at :81 predates this change).
  - `[low]` `[patch]` The API spec's control comment implied the test proves the date triggers are gone; with send-push refusing `{kind: 'date'}`, a surviving trigger would also leave no `push_requests` row, so only pgTAP PUSH-DB-060 and 064-067 prove absence — the comment and the file's top doc now say the test shows no row for the partner while a mood still records one, and name the pgTAP pins for trigger absence.
  - `[low]` `[patch]` The same comment assumed pg_net completes calls in queue order ("the queue the date writes would have joined has been served"), which nothing guarantees — removed with the rewording above.

## Verification

**Commands:**
- `supabase migration up --local` (shim) -- expected: applies `20261103000000` cleanly.
- `supabase test db` (shim) -- expected: every file passes.
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass.
- `npm run db:types && git diff --stat src/types/database.types.ts` -- expected: only removals for `date_changes` / `date_change_id`.
- `npm run typecheck`, `npm run lint`, `npm run test:unit` -- expected: exit 0 (worktree TS2883 baseline excepted if present before).
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` -- expected: pass with the edge runtime serving `send-push` (`supabase functions serve` through the shim); if it cannot be served here, record that and rely on pgTAP's queue assertions.
- `npx playwright test tests/e2e/settings` -- expected: pass.

**Manual checks (if no CLI):**
- `grep -rn "date_change\|notify_date_change\|buildDatePayload" src supabase/functions tests scripts` -- expected: no match.


## Auto Run Result

Status: built

**Summary.** First of DW-416's two deploys (R14): adding or changing an event, the wedding date, Together since or a birthday no longer pushes the partner. Migration `20261103000000_remove_date_change_push.sql` drops the five date triggers, `notify_date_change()`, the date-sourced `push_requests` rows, `push_requests.date_change_id` with its unique key, and `date_changes`, rebuilding `push_requests_source_check` over the six remaining sources; every drop is `if exists`, after a read-only hosted catalog check on 2026-11-03 found exactly the objects `20261031030000` created and no hosted-only names. send-push loses its `date` kind (a `{kind: 'date'}` post is now a 400). The client stops reading and writing `dates` (service column list, `PUSH_PREFERENCE_KEYS`, the Dates switch, the `date` tap route); an older saved copy carrying `dates` still parses. `push_preferences.dates` stays, commented as unread, for story 18.

**Files changed**
- `supabase/migrations/20261103000000_remove_date_change_push.sql` — new: the removal.
- `supabase/functions/send-push/handler.ts`, `payload.ts`, `index.ts` — date kind, `dates` preference, `DateChangeRow`, `getDateChange`, `buildDatePayload` and the date texts removed.
- `supabase/functions/send-push/handler.test.ts`, `payload.test.ts` — date cases removed; a `{kind: 'date'}` post answers 400 and claims nothing.
- `src/services/pushPreferencesService.ts`, `src/stores/slices/notificationsSlice.ts`, `src/components/Settings/PushSettings.tsx`, `src/services/pushNotifications.ts` — `dates` and the date tap route removed.
- `src/types/database.types.ts` — regenerated (53 lines removed).
- `supabase/tests/database/35_push_devices.sql` — the date section is now "Date changes removed": absence pins plus no queued call for each date write and a mood control; `plan(95)`.
- `tests/api/push-love-note-trigger.spec.ts` — one `[P0]` test: date writes leave the partner no `push_requests` row while a mood still records one; `date` is a 400.
- Unit tests: `PushSettings.test.tsx`, `pushNotifications.test.ts`, `pushPreferencesService.test.ts`, `pushPreferencesCopy.test.ts`, `signOutClearsAccountState.test.ts`, `dateRemindersAtLaunch.test.ts`.
- `scripts/sim-driver/README.md`, `scripts/sim-driver/sim` — date-change-push clause removed.
- `_bmad-output/initiative-my-love/deferred-work.md` — DW-416 stays open with a `progress:` line.

**Review findings.** One quick pass: 4 findings, all low, all patched (two stale "six switches" texts, one unwrapped doc line, an API-spec comment that claimed more than the test proves and assumed pg_net ordering). Nothing deferred, nothing rejected.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 4.

**Verification.** After the patches: `npm run typecheck` 0; `npm run lint` 0; `npm run test:unit` 227 files / 3948 tests passed; `deno test --no-lock supabase/functions/send-push/` 89 passed (no `deno.lock` left); `supabase test db` (CLI 2.122.0 shim) 26 files / 594 tests PASS; `npm run db:types` reproduces the committed file byte for byte; `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 14 passed with `send-push` served locally, row audit clean. `npx playwright test tests/e2e/settings` 59 passed before the patches (the patches touched only comments and one unit-test name). The residue grep finds no `date_change`, `notify_date_change` or `buildDatePayload`. The migration's delete path was run against the real file in a rolled-back transaction on a rebuilt pre-migration state (1 date-sourced row → 0, six-column check). Every I/O-matrix row has a passing covering test or that check.

**Residual risks**
- The five-switch section renders only in the iOS shell; it is covered by `PushSettings.test.tsx`, not by a browser E2E or a simulator run.
- A date push already delivered before the deploy now opens nothing on tap (`viewForPush` returns null) instead of Home.
- R14's "no `push_preferences.dates` column" is not met until story 18, which is owner-gated on both phones running this update.
