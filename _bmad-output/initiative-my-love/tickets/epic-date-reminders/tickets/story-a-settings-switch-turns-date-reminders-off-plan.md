---
title: 'A Settings switch turns date reminders off'
type: 'feature'
ticket: '3'
created: '2026-11-01'
status: done
baseline_revision: '980671cb0fe4639ddbdf88a9c03d224e1e00597a'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Every date reminder is always scheduled; a person cannot turn date reminders off (R6).

**Approach:** Add a `date_reminders` column (default on) to story 3.7's `push_preferences` row. Keep that row offline as a new local-copy kind `push-preferences`. The planner schedules nothing while the switch is off. A "Date reminders" switch heads the Reminders card in the shell's Settings. Writing the copy re-plans: off cancels every reminder, and on schedules them again.

## Boundaries & Constraints

**Always:**
- **Column.** Add `push_preferences.date_reminders boolean not null default true` in a new migration. A missing row still reads as all on. Policies and grants are unchanged. The `send-push` sender reads one named column per kind, so it is unaffected.
- **Service.** `PushPreferences` gains `dateReminders` (column `date_reminders`), and `ALL_PUSH_PREFERENCES_ON` sets it `true`. A write still sends only `user_id` and one column.
- **Copy.** New kind `PUSH_PREFERENCES_COPY_KIND = 'push-preferences'`, holding the whole `PushPreferences` row.
  - Written only after a successful `loadPushPreferences` fetch, or a confirmed `setPushPreference` write (the row read back), and only while the identity is current.
  - A failed read never writes or clears the copy.
  - Export `readSavedPushPreferences(userId)`: an object whose seven keys are all booleans, otherwise `null`.
  - `deleteAccountData()` already removes it, through `deleteAccountCopies`.
- **Refresher.** Register the kind as `() => hasNativeReminders() ? get().loadPushPreferences() : Promise.resolve()`. The web and older shells then make no new `push_preferences` read. `PushSettings` keeps calling `loadPushPreferences` when the section opens.
  - Stub the refresher in `auth-bootstrap-notification-order.tsx` (a no-op, restored in dispose).
  - Add `push_preferences` to the stubbed tables in `login.spec.ts`.
- **Store.** The state stays `pushPreferences`, which `signedOutState()` already resets. Its load and failure behaviour is unchanged.
- **Re-plan.** `planOnce` also reads `readSavedPushPreferences`. A `null` copy skips the whole re-plan, so pending reminders stay (story 6's rule). The kind joins `DATE_COPY_KINDS`, so any write of the copy re-plans.
- **Planner.** `ReminderDates` gains `remindersOn: boolean`, and `planDateReminders` returns `[]` when it is `false`. An empty plan cancels what is pending and schedules nothing, which is `scheduleDateReminders`' existing path.
- **UI.**
  - Placement: the first row of `CountdownMarks`' "Reminders" card, before the marks rows and their empty line, following the epic-push-notifications layout rule ("story 4.3's 'Date reminders' switch, then story 4.2's marks list").
  - Built from: a `SwitchRow` with id `settings-reminders-switch`, label `Date reminders`, helper `At 9:00 before each date.`, and a bell icon.
  - State: `checked` is `pushPreferences?.dateReminders ?? true`. The row is disabled while `pushPreferences` is `null` or a save is in flight.
  - A toggle reuses the card's offline refusal and error line, and calls `setPushPreference('dateReminders', next)`.
  - The marks rows stay usable while the switch is off.
  - It shows only where the card shows: in a shell with the local-notifications plugin.
- **Shared rules.** Capture and re-check the identity around every await. Failures are only logged. Match the surrounding style by hand; never run Prettier.

**Never:**
- No change to the six push switches, their order, wording or sender behaviour.
- No change to the planner's output while the switch is on.
- No native code.
- No switch or `push_preferences` read on the website, the Home Screen web app or an older shell.
- No hand edit of `src/types/database.types.ts`.
- No real names or emails in fixtures.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh account | no `push_preferences` row | switch on; copy all `true`; reminders planned | none |
| Switch off online | toggle | upsert `date_reminders=false` → state → copy → re-plan → pending empty | none |
| Switch on again | toggle | copy `true` → re-plan → reminders scheduled | none |
| Launch offline, switch off | copy `dateReminders:false` | nothing scheduled, pending cancelled | none |
| Copy missing or malformed | | re-plan skipped, pending kept | none |
| Refresher read fails | | copy unchanged | logged |
| Toggle offline | | refused with `offlineMessage('Reminders')`, nothing sent | shown |
| Save fails | | state and copy unchanged, error shown | shown, logged |
| Web or older shell | no plugin | no switch, no `push_preferences` request | none |

</intent-contract>

## Code Map

- `supabase/migrations/20261101020000_date_reminders_switch.sql` (new). Header like `20261031050000_push_preferences.sql`: `alter table ... add column date_reminders boolean not null default true`, plus a column comment. Every object is new, so there is nothing hosted-only to drop.
- `supabase/tests/database/36_push_preferences.sql`:
  - PUSH-PREF-009 pins the boolean columns' list, and `date_reminders:true:true` is appended.
  - PUSH-PREF-013 adds the column to its select and values.
  - Add one test: the owner upserts `date_reminders` false and the other switches stay true. Bump `plan(26)`.
- `src/types/database.types.ts`. Regenerate with `npm run db:types` after `supabase db reset`, on the CLI pinned in `.github/actions/setup-supabase/action.yml` (AGENTS.md). If the output differs beyond the new column, record that and keep only this column's lines.
- `src/services/pushPreferencesService.ts`. Change the interface, `ALL_PUSH_PREFERENCES_ON`, `PreferencesRow`, `COLUMN`, `toPushPreferences` and the header.
- `src/stores/slices/settingsSlice.ts`:
  - The kind, its parser and its reader go beside `COUNTDOWN_MARKS_COPY_KIND` (`:326`).
  - The refresher registration goes at `:392-395`.
  - Add a `savePushPreferencesCopy` helper like `saveCountdownMarksCopy` (`:398`).
  - `loadPushPreferences` (`:963`) and `setPushPreference` (`:986`) write the copy after `set`, inside the serialized block, behind `isCurrent()`.
  - Update the header's "Push switches" paragraph (`:50`), which now says "no local copy".
- `src/services/dateReminders.ts`. Add `remindersOn` to `ReminderDates`, the early `[]` in `planDateReminders` (`:229`), and the header. `reminderDateEntries` ignores it.
- `src/services/dateRemindersAtLaunch.ts`. In `planOnce`'s `Promise.all`, add the copy to the null check, and set `remindersOn: prefs.dateReminders`. Add the kind to `DATE_COPY_KINDS`, and update the header.
- `src/components/Settings/CountdownMarks.tsx`. Add the switch row (see the UI rule) and update the header. Widen `reminderDateEntries`' parameter to `Omit<ReminderDates, 'marks' | 'remindersOn'>`, so its callers are unchanged.
- Every other builder of a full `ReminderDates` (`planOnce`, the planner tests) adds the field; find them with `grep -rn 'marks: new Set' src tests`.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx:229-242`. Add a no-op and its restore, as is done for `COUNTDOWN_MARKS_COPY_KIND`.
- `tests/e2e/auth/login.spec.ts:110-118`. Add `'push_preferences'`.
- `tests/e2e/settings/push-switches-web.spec.ts`. Add `settings-reminders-switch` toHaveCount(0). It already asserts that no `push_preferences` request is made. Keep every assertion.
- Tests to extend:
  - `src/services/__tests__/dateReminders.test.ts`: off gives `[]` even with marked and far dates, and on is unchanged.
  - `tests/unit/stores/dateRemindersAtLaunch.test.ts`: add the copy to `DATE_KINDS`/`defaultCopies` (all on). A missing copy means no plugin call. An off copy means pending is cancelled and there is no `schedule`. A copy write re-plans.
  - A new `tests/unit/stores/pushPreferencesCopy.test.ts`: the load writes the copy, a failed load keeps it, the setter writes the read-back row, the web refresher does nothing, and `deleteAccountData` removes it.
  - `src/components/Settings/__tests__/CountdownMarks.test.tsx`: the switch is first and on by default, a toggle calls the setter, the offline refusal, and nothing off native.
  - `PushSettings.test.tsx` and `signOutClearsAccountState.test.ts`: keep them green.
  - Import shared helpers (`tests/unit/stores/accountDataFixtures.ts`) rather than copying them.
- The simulator driver: `scripts/sim-driver/sim` (`sim help`), with `sim provision`, `sim dates kinds`, `sim build`, `sim signin`, `sim pending`, `sim tap`/`ax`, `sim uninstall` and `--device`. The second simulator is the clone `iPhone Duo 4.2 clone` (FF934168-CA50-4B57-AA76-853C890CDE10), kept by story 2 for this story.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261101020000_date_reminders_switch.sql`, `supabase/tests/database/36_push_preferences.sql`, `src/types/database.types.ts`: the column, its pgTAP pins and the regenerated types. Covers R6's account-kept setting.
- [x] `src/services/pushPreferencesService.ts`: the `dateReminders` key. This is the server side.
- [x] `src/stores/slices/settingsSlice.ts`: the kind, its reader, the refresher and the copy writes. This is the offline copy.
- [x] `src/services/dateReminders.ts`, `src/services/dateRemindersAtLaunch.ts`: the planner's off state and the re-plan's copy and trigger. Covers R6 off and on.
- [x] `src/components/Settings/CountdownMarks.tsx`: the switch row. This is the UI.
- [x] Unit tests in the files listed in the Code Map: Verify's unit coverage and the matrix rows.
- [x] `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts`, `tests/e2e/settings/push-switches-web.spec.ts`: the refresher stubs (an epic constraint) and the website check.

**Acceptance Criteria:**

Simulator setup, on the local stack with no person:
1. `supabase db reset`.
2. `sim provision`, then `sim dates kinds`.
3. Delete Casey's `push_preferences` row on the local DB (psql, local stack only).
4. Build this tree's shell with `sim build`, then `sim signin`.

`sim pending` lags a schedule, so read it after its plist's mtime has passed the action.
- Given that setup, when Settings is opened, then the Reminders card's first row is "Date reminders", switched on, and `sim pending` lists the day-before reminders.
- Given the switch on, when it is turned off, then `sim pending` lists nothing and Casey's row has `date_reminders = false`.
- Given the switch off, when it is turned on again, then `sim pending` lists the same reminders as before.
- Given the switch turned off online (list empty) and then Kong stopped (`docker stop supabase_kong_My-Love`), when the shell is terminated and relaunched and 30 s pass, then `sim pending` still lists nothing; run `docker start supabase_kong_My-Love` afterwards.
- Given the switch off, when `sim uninstall`, `sim build` and `sim signin` run, then the row shows off and `sim pending` lists nothing.
- Given the clone signed in as Casey with reminders listed, when the switch is turned off on the first simulator and the clone is terminated and relaunched, then the clone's `sim pending` lists nothing.
- Given the checks are done, when cleaning up, then turn the switch back on, run `sim dates clear` and `sim provision`, shut down the clone without deleting it, and leave `dist/` as a production build.

## Implementation Notes

- Implemented by the step-03 subagent from this plan; recorded from its report and checked against the diff in verification.
- `src/types/database.types.ts`: `npm run db:types` on CLI 2.122.0 (the pinned version) changed only the three `date_reminders` lines, so the regeneration rule held this time.
- pgTAP: the new upsert test (PUSH-PREF-027) sits right after PUSH-PREF-013, while every switch is still on, so "the other switches stay on" holds; `plan(27)`.
- UI: the marks rows now always draw a divider, since the Date reminders row precedes them.
- `PushSettings.test.tsx`: "lists the six switches" now expects `settings-reminders-switch` after the six, because `CountdownMarks` renders inside the section; its six-row assertions are kept. `renderLoaded` also waits for the account-data queue to drain (`serializeAccountDataWrite(async () => {})`), because the load now writes the copy inside the queue and a click raced it.
- Simulator (iPhone Duo, local stack, no person; Casey's `push_preferences` row deleted first): no row showed the switch on with 11 reminders pending; off emptied `sim pending` and stored `date_reminders = f`; on restored the same 11; off online, Kong stopped, terminate and relaunch, 30 s: still empty; `sim uninstall`, `sim build`, `sim signin`: row off, nothing pending; the clone (FF934168) signed in as Casey went from 11 to `[]` after a terminate and relaunch once the first simulator turned the switch off. Cleanup: switch back on, `sim dates clear`, `sim provision`, clone shut down and kept.
- Casey's local `push_preferences` row now exists with every switch on; `sim provision` does not remove it, and a missing row reads the same.
- One stray simulator tap opened the relationship-start picker; it was closed unsaved and `couple_settings` was unchanged.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` Offline, or after a failed read, Settings shows "Date reminders" on, though disabled, while the saved copy says off, because nothing seeds `pushPreferences` from the copy. Confirmed: `loadPushPreferences` returns early offline and the row renders `?? true`. Rejected for three reasons. It matches how story 3.7's six push rows already behave offline (default on, disabled, beside the offline line). Planning is unaffected, since the re-plan reads the copy. The fix would add copy seeding to the store, which the intent-contract's "load and failure behaviour is unchanged" rule excludes, and that is more than a direct correction.
  - `[low]` `[reject]` A failed refresher read at launch now sets `pushPreferencesLoadFailed`. If Settings is then opened offline, "Couldn't load your push settings." shows instead of the offline line. Confirmed by reading `PushSettings.tsx`'s gating. Rejected: it needs a failed read at launch followed by opening Settings offline, which is rare. The rows are disabled either way and the text is accurate. Fixing it would add a refresher-only branch to `loadPushPreferences`, against the unchanged-behaviour rule.
  - `[low]` `[patch]` In `CountdownMarks.test.tsx`, "renders nothing off the native platform" asserted that `fetchPushPreferences` was not called. The component never calls it, so the check could not fail. Confirmed by reading the component. Fixed: the assertion line was deleted and the other two were kept; the file passes 27/27.

## Design Notes

**Why the whole row:** the ticket says the copy holds the switch's row. Keeping all seven values keeps the copy a faithful server answer, and a push-switch toggle also re-plans, which is harmless.

**Why the planner owns "off":** an empty plan takes `scheduleDateReminders`' existing cancel-then-nothing path. So off and on are both just a re-plan, and every re-plan rule (single-flight, identity, loaded-copies-only) applies to the switch for free.

**The offline AC:** a toggle is refused with Kong down, so the switch is turned off online first; the relaunch then re-plans from the saved off copy alone. Story 2 already showed an offline launch re-plans from the copies when reminders are on, so an empty list here is the off copy at work.

## Verification

**Commands:**
- `supabase db reset && supabase test db`. Expected: all pgTAP files pass.
- `npm run db:types && git diff --stat src/types/database.types.ts`. Expected: only the new column's lines change.
- `npx vitest run src/services/__tests__/dateReminders.test.ts tests/unit/stores/dateRemindersAtLaunch.test.ts tests/unit/stores/pushPreferencesCopy.test.ts src/components/Settings/__tests__/CountdownMarks.test.tsx src/components/Settings/__tests__/PushSettings.test.tsx tests/unit/stores/signOutClearsAccountState.test.ts`. Expected: all pass.
- `npm run test:unit` and `SEED=1 npm run test:unit:coverage`. Expected: green.
- `npm run lint` and `npm run typecheck`. Expected: clean.
- `npx playwright test tests/e2e/settings/push-switches-web.spec.ts tests/e2e/auth/login.spec.ts` (with `supabase start`). Expected: pass.
- `fnox exec -- npm run build`. Expected: exit 0, and `dist/` is a production build.
- The simulator ACs above.

## Auto Run Result

Status: built

**Summary:** A "Date reminders" switch now heads the Reminders card of the shell's Settings "Push and reminders" section. It has a bell icon and the helper "At 9:00 before each date.", and it starts on.
- **Storage:** the switch is the new `push_preferences.date_reminders` column (`not null default true`; a missing row reads as on). It is written one column at a time, server first, like the push switches.
- **Offline copy:** the whole row is kept as the new local-copy kind `push-preferences`. A successful read or a confirmed write fills it, and a failed read never touches it. `deleteAccountCopies` removes it at sign-out, and `pushPreferences` was already in `signedOutState()`.
- **Re-plan:** it now needs that copy too, and skips while it is missing. While the switch is off the planner returns `[]`, so the re-plan cancels everything pending. A write of the copy re-plans, so off empties the list and on restores it.
- **Where it shows:** the kind's refresher reads the server only in a shell with the local-notifications plugin. The website, the Home Screen web app and older shells show no switch and make no new request.

**Files changed:**
- `supabase/migrations/20261101020000_date_reminders_switch.sql` -- the column.
- `supabase/tests/database/36_push_preferences.sql` -- pins the column and adds a one-column upsert test (27 tests).
- `src/types/database.types.ts` -- regenerated with `npm run db:types`; three lines.
- `src/services/pushPreferencesService.ts` -- the `dateReminders` key.
- `src/stores/slices/settingsSlice.ts` -- the `push-preferences` kind, its strict reader, the refresher (shell only) and the copy writes after a load or a save.
- `src/services/dateReminders.ts` -- `ReminderDates.remindersOn`; off plans nothing.
- `src/services/dateRemindersAtLaunch.ts` -- the copy in the re-plan and in its write trigger.
- `src/components/Settings/CountdownMarks.tsx` -- the switch row.
- Tests: `src/services/__tests__/dateReminders.test.ts`, `tests/unit/stores/dateRemindersAtLaunch.test.ts`, `src/components/Settings/__tests__/CountdownMarks.test.tsx`, `src/components/Settings/__tests__/PushSettings.test.tsx`, `tests/unit/services/pushPreferencesService.test.ts`, `tests/unit/stores/signOutClearsAccountState.test.ts`; new `tests/unit/stores/pushPreferencesCopy.test.ts`.
- Test plumbing:
  - `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts` -- the refresher stubs.
  - `tests/e2e/settings/push-switches-web.spec.ts` -- the web has no switch.

**Review (quick lens, 3 findings, all low):**
- **Patched: 1.** The vacuous test assertion was deleted.
- **Deferred: 0.**
- **Rejected: 2.**
  - Offline, the switch shows its disabled default on even when the copy says off. This matches the push rows. Planning is unaffected. The fix would change the store's load behaviour, which the contract excludes.
  - A failed launch read, followed by opening Settings offline, shows "Couldn't load" instead of the offline line. This is rare, and the fix would add a branch against the unchanged-behaviour rule.

**Follow-up review recommended:** false. One low was patched, with no high and no medium. Patched counts by verdict: high 0, medium 0, low 1.

**Verification (patched tree):**
- **Static checks:** `npm run lint` and `npm run typecheck` are clean.
- **Unit tests:** `npm run test:unit` passes 221 files and 3662 tests. `SEED=1 npm run test:unit:coverage` exits 0.
- **Database:** `supabase test db` passes 25 files and 603 tests.
- **Types:** `npm run db:types` shows only the three `date_reminders` lines in the diff.
- **E2E:** `npx playwright test tests/e2e/settings/push-switches-web.spec.ts tests/e2e/auth/login.spec.ts` passes 5. These ran before the test-only patch, which neither file touches.
- **Build:** `fnox exec -- npm run build` exits 0, so `dist/` is a production build.
- **Simulator** (step-03, no person; details in Implementation Notes):
  - A fresh row shows the switch on.
  - Turning it off empties `sim pending`, and turning it on restores the same 11 reminders.
  - An offline relaunch with the switch off schedules nothing.
  - After a reinstall the switch still shows off and nothing is scheduled.
  - The clone signed in to the same account drops to `[]` at its next open.

**Residual risks:**
- Offline, the switch's row shows the disabled default "on" even when it is off (rejected finding above).
- A re-plan cancels only the ids `getPending` reports. Story 6's deferred race (an add still in flight) therefore applies to turning the switch off right after a schedule; on the simulator, off emptied the list every time.
- A device whose `push-preferences` copy has never loaded skips every re-plan until it does, so the first launch with this bundle while offline keeps the previous pending list.
- That reminders actually stop firing with the switch off is for stories 8 and 5 to check.
