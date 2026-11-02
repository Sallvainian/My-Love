---
title: 'Dates marked for the countdown remind a month and a week before'
type: 'feature'
ticket: '2'
created: '2026-11-01'
status: done
baseline_revision: '8b24113f7dfdcdd58548f9095656886b5a81c516'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      `src/types/database.types.ts` gets each new table's block inserted in the committed file's style, because `supabase gen types typescript --local` on CLI 2.122.0 no longer reproduces the committed file, so the AGENTS.md "regenerate, never hand-edit" rule cannot be followed as written.
    evidence: |-
      Quick review finding. On CLI 2.122.0 the command prints unformatted output, 621 lines against the committed 977, with `ComputedFields: never` in all 22 tables. A whole-file regeneration would rewrite every table's lines. Story 3.8 (b430cde6) and this story both inserted only their own table's block, which matches the generator's Row/Insert/Update shape. Settling it is a decision for the owner: either commit one full regeneration on the current CLI and run Prettier on that generated file, or amend the AGENTS.md rule. The rule edit touches an agent-context file.
    location: >-
      src/types/database.types.ts, AGENTS.md (Policy, database.types.ts)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Every date gets only a day-before (and for yearly dates an on-the-day) reminder. A person cannot ask for an earlier heads-up on the dates that matter to them.

**Approach:** Each person marks dates in a new "Reminders" group of the shell's Settings "Push and reminders" section. Marks are kept server-side in a new RLS table, `countdown_marks`, and read offline as the new local-copy kind `countdown-marks`. The planner adds `In a month: …` and `In a week: …` reminders at 9:00 for marked dates. Writing the marks copy re-plans through story 6's copy-write trigger.

## Boundaries & Constraints

**Always:**
- **Mark keys.** An event is `event:<events.id>` and an anniversary is `anniversary:<anniversaries.id>` (the copy's `serverId`). The fixed keys are `relationship-start`, `wedding`, `own-birthday` and `partner-birthday`. A key that matches no current date is ignored. An anniversary with no `serverId` gets no row and no key.
- **Table.** `public.countdown_marks(user_id, date_key, created_at)`, primary key `(user_id, date_key)`, with `date_key` checked against the key forms above.
  - RLS is enabled in the creating migration.
  - Three owner policies (select, insert, delete), each `TO authenticated` and keyed on `user_id = (select auth.uid())`. There is no update.
  - Grants: `select, insert, delete` to `authenticated`; nothing to `anon`.
  - A partner can neither read nor write another person's marks.
- **Writes.** A mark is an insert with `upsert(..., { onConflict: 'user_id,date_key', ignoreDuplicates: true })`; an unmark is a delete. Both are online-only: `requireOnline` in the service, `isOnline()`/`offlineMessage` in the component. A write goes to the server first, then to the store and the copy.
- **Store.** `countdownMarks: string[] | null`, where `null` means not loaded. `signedOutState()` resets it to `null` in the same commit. The local copy is filled only from a successful read or a confirmed write. A failed read keeps both state and copy.
- **Refresher.** The `countdown-marks` refresher does nothing unless `hasNativeReminders()`, so the web and older shells never read the table. The refresher stubs still go into the harness and `login.spec.ts`, as the epic's constraint requires.
- **Re-plan.** It reads the marks copy beside the five date copies. A `null` marks copy skips the whole re-plan (story 6's rule). Add `countdown-marks` to `DATE_COPY_KINDS`, so marking or unmarking re-plans.
- **Planner.** For every marked date's next occurrence D, add a reminder at 9:00 local on D minus one calendar month and one on D minus 7 days.
  - The month-before date has the same day of the month, clamped to the last day of a shorter month. For example, 31 March gives 28 or 29 February.
  - Each passes through the existing past-moment drop, then the sort and the 64 cut.
  - Texts: `In a month: {name}` and `In a week: {name}`, where `{name}` is the name the date's day-before reminder uses.
  - For a yearly date, D is the occurrence the day-before reminder uses.
- **Marks list.** It renders only when `hasNativeReminders()`, inside the existing section, as a second `CARD` after Pushes, with the group title "Reminders".
  - Each set date gets one `SwitchRow`. The helper reads `Remind me a month and a week before.`
  - Row test id: `settings-reminder-mark-<key>`. Off by default. Disabled while the marks are not loaded or that row is saving.
  - Order: events in list order, then anniversaries, `Our anniversary`, `Wedding`, `Your birthday`, `{partner}'s birthday`.
  - When there are no dates, one muted line: `Dates you add show up here.`
- Identity capture and re-check around every await (AGENTS.md).
- Failures are only logged (Vitest teardown rule).
- Match the surrounding style by hand; never run Prettier.

**Never:**
- No reminders switch (story 3) and no change to the push switches.
- No change to Home's cards, to day-before or on-the-day texts and timing, or to the planner's output for unmarked dates.
- No native code.
- No marks UI or marks read outside the shell.
- No cleanup of a mark whose date was deleted.
- No real names or emails in fixtures.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Marked event 40 days ahead | `event:<id>` marked | `In a month` (D−1 month) and `In a week` (D−7) at 9:00, plus `Tomorrow` | none |
| Marked date 5 days ahead | e.g. `relationship-start` | only `Tomorrow`/`Today`; month and week dropped as past | none |
| Marked date 10 days ahead | | `In a week` only | none |
| Unmarked date | | unchanged from story 1 | none |
| Mark for a deleted event | key matches nothing | ignored | none |
| Month clamp | D = 31 March | month reminder 28/29 Feb 9:00 | none |
| Marks copy missing/unreadable | | re-plan skipped, pending kept | none |
| Mark tapped online | | server insert → state → copy → re-plan | none |
| Mark tapped offline | | refused with `offlineMessage`, nothing sent | shown |
| Server write fails | | state and copy unchanged, error shown | shown, logged |
| Load fails | | state and copy kept | logged |
| Sign-out | | `countdownMarks` null; copy deleted by `deleteAccountCopies` | none |
| Web / older shell | no plugin | no list, no `countdown_marks` request | none |

</intent-contract>

## Code Map

- `supabase/migrations/20261101010000_countdown_marks.sql` (new). Copy the header, grant and RLS shape of `20261031050000_push_preferences.sql`. Every object is new, so no hosted-only names need dropping.
- `supabase/tests/database/38_countdown_marks.sql` (new). Copy the pattern of `36_push_preferences.sql`, declaring its helpers inline. Pin:
  - RLS on;
  - `policies_are` with the three policies, all `{authenticated}`;
  - the grants;
  - the owner's insert, select and delete;
  - a cross-account read that sees nothing, and a cross-account insert or delete that is refused;
  - a bad `date_key` refused by the check;
  - the cascade from `auth.users`.
- `src/types/database.types.ts` -- regenerate with the AGENTS.md command after `supabase db reset`. Never hand-edit it.
- `src/services/countdownMarksService.ts` (new). Modelled on `pushPreferencesService.ts`, using `requireOnline`, `requestTimeout` and `toAccountDataError`:
  - `fetchCountdownMarks(userId): Promise<string[]>`;
  - `setCountdownMark(userId, key, marked): Promise<void>`.
- `src/stores/slices/settingsSlice.ts`:
  - Add `COUNTDOWN_MARKS_COPY_KIND = 'countdown-marks'`, plus `parseSavedCountdownMarks` (an array of strings, otherwise `null`) and an exported `readSavedCountdownMarks(userId)`, following `readSavedAnniversaries` at `:278`.
  - Add state `countdownMarks: string[] | null`.
  - `loadCountdownMarks()` is the kind's refresher, registered beside the others at `:345`. It shows the saved copy while the state is `null`, then fetches; on success it sets state and writes the copy. The `pushPreferences` load at `:905` shows the identity and serialize pattern.
  - `setCountdownMark(key, marked)`: server first, then state and copy, inside `serializeAccountDataWrite`.
  - Update the header comment.
- `src/stores/slices/authSlice.ts:139` `signedOutState()` -- add `countdownMarks: null`. `tests/unit/stores/signOutClearsAccountState.test.ts` checks the sign-out reset.
- `src/services/dateReminders.ts`:
  - Add `id: string` to `ReminderDates.events[]`, `serverId?: string` to `anniversaries[]`, and `marks: ReadonlySet<string>`.
  - Add the exported `MARK_KEYS` constants and `reminderDateEntries(dates): { key: string; name: string }[]`, which lists the set dates in the order the marks list uses. The marks list names each row from it.
  - Planner: `addDay` grows a `marked` flag that adds the month and week reminders, using the same occurrence day.
  - Update the header.
  - Row names come from the Home cards: `BirthdayCountdown.tsx:88` (`Your birthday` / `{name}'s birthday`) and `BirthdayWeddingCards.tsx:70` (`Wedding`).
- `src/services/dateRemindersAtLaunch.ts` -- in `planOnce`, read `readSavedCountdownMarks` in the `Promise.all` and skip the re-plan when it is `null`. Pass the event ids, the anniversary `serverId`s and `marks`. Add the kind to `DATE_COPY_KINDS` and update the header.
- `src/components/Settings/CountdownMarks.tsx` (new) -- the Reminders card, rendered from `PushSettings.tsx`'s section after the Pushes card. It builds `ReminderDates` from the store:
  - `events` (eventsSlice `:163`);
  - `settings.relationship.anniversaries`;
  - `coupleSettings` when it is `linked`;
  - `ownProfile`;
  - `partner`.

  It names each row from `reminderDateEntries`. It reuses `SwitchRow`, the `kitClasses` names and `PushSettings`' toggle, saving and error pattern. It calls `loadCountdownMarks` when it opens. Keep `PushSettings.tsx` changes to the one render line, and mention the group in its header.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx:205-240` -- register a no-op for `COUNTDOWN_MARKS_COPY_KIND`, and restore it in dispose.
- `tests/e2e/auth/login.spec.ts:110` -- add `countdown_marks` to the stubbed tables.
- `tests/e2e/settings/push-switches-web.spec.ts` -- add assertions that `settings-reminder-marks` is absent and that no `/rest/v1/countdown_marks` request is made. Keep every existing assertion.
- Unit-test patterns:
  - `src/services/__tests__/dateReminders.test.ts`;
  - `tests/unit/stores/dateRemindersAtLaunch.test.ts`, whose `seedOneOfEachKind` writes the copies and must now write a marks copy too;
  - `src/components/Settings/__tests__/PushSettings.test.tsx`, for the native mocks;
  - `tests/unit/stores/accountDataFixtures.ts`.
- The simulator driver: `scripts/sim-driver/sim --device UDID|NAME`, `sim dates kinds` and `sim pending`. A second simulator is made with `xcrun simctl clone`. AGENTS.md's sim-driver paragraph lists the rules for a clone.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261101010000_countdown_marks.sql`, `supabase/tests/database/38_countdown_marks.sql`, `src/types/database.types.ts` -- add the table, its pgTAP file and the regenerated types. -- R4's account-kept mark.
- [x] `src/services/countdownMarksService.ts` -- fetch and set. -- the server side.
- [x] `src/stores/slices/settingsSlice.ts`, `src/stores/slices/authSlice.ts` -- add the kind, its reader, the state, the refresher, the setter and the sign-out reset. -- the offline copy.
- [x] `src/services/dateReminders.ts`, `src/services/dateRemindersAtLaunch.ts` -- add the keys, the entries, the month and week reminders, and the marks in the re-plan. -- R2.
- [x] `src/components/Settings/CountdownMarks.tsx`, `src/components/Settings/PushSettings.tsx` -- add the Reminders card. -- R4's UI.
- [x] Tests:
  - `src/services/__tests__/dateReminders.test.ts`: the matrix rows on the planner, the clamp, the 64 cut with marks, and the order and names of `reminderDateEntries`.
  - `tests/unit/stores/dateRemindersAtLaunch.test.ts`: a marks copy in the plan, a missing marks copy meaning no plugin call, and a marks copy write re-planning.
  - A new `tests/unit/stores/countdownMarks.test.ts`: the refresher (saved copy, then server; failed read kept; the web does nothing), the setter (offline refused, server failure keeps state, success writes the copy), sign-out resetting the state, and `deleteAccountData` removing the copy.
  - A new `src/components/Settings/__tests__/CountdownMarks.test.tsx`: rows unmarked at first, toggling, the offline message, nothing rendered off native.

  -- Verify's unit coverage.
- [x] `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts`, `tests/e2e/settings/push-switches-web.spec.ts` -- the stubs, and the web spec. -- epic constraint, website check.

**Acceptance Criteria:**

The simulator checks run on the local stack after `supabase db reset` (the new migration), `sim provision`, `sim dates kinds`, `sim build` and `sim signin`. For the month and week checks, first insert one Casey event 40 days ahead on the local database (psql, local stack only, made-up label). `sim pending` lags a schedule, so read it after its plist's mtime has passed the action.
- Given that setup, when Settings is opened, then the Reminders group lists every set date, the partner's birthday among them, each switch unmarked.
- Given that setup, when the 40-day event's switch is turned on, then `sim pending` lists `In a month: …` and `In a week: …` for it, at `hour 9, minute 0`, beside its `Tomorrow:` entry.
- Given that setup, when `Our anniversary` (5 days ahead) is marked, then `sim pending` lists no `In a month`/`In a week` entry for it.
- Given a marked date, when `sim uninstall`, `sim build` and `sim signin` run, then the row still shows marked and its month and week reminders are listed.
- Given a marked date and Kong stopped (`docker stop supabase_kong_My-Love`), when the shell is relaunched, then its month and week reminders are still listed. Afterwards run `docker start supabase_kong_My-Love`.
- Given a second simulator (`xcrun simctl clone`) with the shell built and signed in as Casey, when a date is marked on the first and the second is relaunched, then the second's `sim pending` lists that date's month and week reminders.
- Given Jessie signed in on a simulator, when Casey marks a date, then Jessie's `sim pending` list is unchanged after a relaunch.
- Given the checks are done, when cleaning up, then unmark everything, delete the clone, run `sim dates clear` and `sim provision`, and leave `dist/` as a production build.

## Implementation Notes

- Implemented by the step-03 subagent from this plan. It ran `npm ci` in the worktree (gitignored), because the main checkout's `node_modules` lacked the Capacitor plugin packages and the typecheck failed on them.
- `src/types/database.types.ts`: `supabase gen types typescript --local` on CLI 2.122.0 prints unformatted output, with `ComputedFields: never` in every table, unlike the committed file. Story 3.8 (b430cde6) added its table block the same way. The `countdown_marks` block added here is the generator's own `Row`/`Insert`/`Update` shape for the new table, in the committed file's style.
- Added in verification: `reminderDateEntries(dates, now)` leaves out events dated before today. The store's `events` list can hold past pages (`loadMoreEvents`), and a row for a past event could never remind. The component test's event dates are relative to today, so they never go stale.
- An own-birthday row is always `Your birthday`. The partner's row falls back to `Your partner's birthday` with no name, which `PartnerInfo.displayName: string` makes unreachable today.
- Simulator checks (in verification, not by the subagent): the subagent's `supabase db reset` on CLI 2.122 applied storage migrations newer than the running storage-api v1.67.15 container (`drop-bucketid-objname-index`, executed 2026-11-01 23:50 UTC), so `sim provision`'s photo upload failed with 42P10. A `supabase stop` and `supabase start` (data kept) brought up storage-api v1.84.19, and provision then ran clean.
- The second simulator is the existing clone `iPhone Duo 4.2 clone` (FF934168-CA50-4B57-AA76-853C890CDE10). It is shut down, not deleted, because the ticket says story 3 reuses it. That departs from this plan's cleanup AC, which said to delete the clone.
- Files:
  - Database: `supabase/migrations/20261101010000_countdown_marks.sql`, `supabase/tests/database/38_countdown_marks.sql` (both new), `src/types/database.types.ts`.
  - Source: `src/services/countdownMarksService.ts` (new), `src/stores/slices/settingsSlice.ts`, `src/stores/slices/authSlice.ts`, `src/services/dateReminders.ts`, `src/services/dateRemindersAtLaunch.ts`, `src/components/Settings/CountdownMarks.tsx` (new), `src/components/Settings/PushSettings.tsx`.
  - Tests: `src/services/__tests__/dateReminders.test.ts`, `tests/unit/stores/dateRemindersAtLaunch.test.ts`, `tests/unit/stores/countdownMarks.test.ts` (new), `src/components/Settings/__tests__/CountdownMarks.test.tsx` (new), `tests/unit/stores/signOutClearsAccountState.test.ts`.
  - Test plumbing: `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts`, `tests/e2e/settings/push-switches-web.spec.ts`.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 7 findings — high 0, medium 1, low 5, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` `<CountdownMarks />` sat between the Pushes card and the push messages (offline, load error, save error), so a push failure showed under the Reminders card. Confirmed by reading `PushSettings.tsx`. Fixed: the card now renders after the three messages.
  - `[medium]` `[patch]` `PushSettings.test.tsx` mounts the real marks load. With `supabase.from` a bare `vi.fn()`, every native test logged a countdown-marks failure, so `expect(console.error).toHaveBeenCalled()` (line 341) passed vacuously, and a late log could trip the Vitest teardown error. Confirmed by reading the file's mocks. Fixed: added a `countdownMarksService` mock that resolves.
  - `[low]` `[defer]` `database.types.ts` block inserted by hand rather than regenerated. The cause predates this change: CLI 2.122 output no longer matches the committed file, and story 3.8 did the same. The inserted block matches the generator. Deferred (frontmatter), since the fix is a whole-file regeneration or an AGENTS.md amendment, both the owner's call.
  - `[low]` `[reject]` The cleanup AC said to delete the clone, but it was shut down. The fix contradicts the ticket ("it owns the second simulator … which story 3 reuses") and is an edit of this plan. The clone stays, and Implementation Notes record the departure.
  - `[false]` `[reject]` The simulator ACs were said to have no recorded result and to be unverified. False: all seven ran and passed in step-03 verification on the iPhone Duo simulator and its clone. The results are recorded under Auto Run Result, which Finalize writes after review.
  - `[low]` `[patch]` `CountdownMarks.test.tsx` copied `setOnline` from `tests/unit/stores/accountDataFixtures.ts` (AGENTS.md: import shared helpers). Fixed: the local copy is deleted and the helper imported.
  - `[low]` `[patch]` `reminderDateEntries` still listed an event dated today, which can never remind: events have no on-the-day reminder, and their day-before, week and month moments have passed. Fixed: it now skips events dated today or earlier, and the test expects today's event left out and tomorrow's kept.

## Design Notes

**Why the copy:** marks ride a local copy, not the store, for the same reason as story 6. A re-plan must tell "not loaded" apart from "no marks", and `[]` saved from a successful read is a loaded "no marks".

**Row names:** each row uses its Home card's label: the event's or the anniversary's label, `Wedding`, `Your birthday` and `{partner}'s birthday`. The relationship start is the exception. Its Home card is the count-up "Together for", which does not name a date, so its row uses the reminder name `Our anniversary` (epic decision 2026-10-30).

**Month-before date:** on D minus one month, with the day clamped:

```ts
const m = new Date(d.getFullYear(), d.getMonth() - 1, 1, REMINDER_HOUR, 0);
const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
m.setDate(Math.min(d.getDate(), last));
```

## Verification

**Commands:**
- `supabase db reset && supabase test db` -- expected: all pgTAP files pass, `38_countdown_marks.sql` included.
- `npx vitest run src/services/__tests__/dateReminders.test.ts tests/unit/stores/dateRemindersAtLaunch.test.ts tests/unit/stores/countdownMarks.test.ts src/components/Settings/__tests__/CountdownMarks.test.tsx tests/unit/stores/signOutClearsAccountState.test.ts` -- expected: all pass.
- `npm run test:unit` and `SEED=1 npm run test:unit:coverage` -- expected: green.
- `npm run lint` and `npm run typecheck` -- expected: clean.
- `npx playwright test tests/e2e/settings/push-switches-web.spec.ts tests/e2e/auth/login.spec.ts` (with `supabase start`) -- expected: pass.
- `fnox exec -- npm run build` -- expected: exit 0, and `dist/` is a production build.
- The simulator ACs above.

## Auto Run Result

Status: built

**Summary:** Each person can now mark dates in a "Reminders" group, the second card of the shell's Settings "Push and reminders" section, with one switch per set date, the partner's birthday among them, all off by default. A marked date also gets `In a month: …` (D minus one calendar month, clamped to the last day of a shorter month) and `In a week: …` (D minus 7 days), at 9:00, beside its day-before reminder. Any reminder already past is dropped, and the soonest-64 cut still applies.
- **Storage:** marks live in the new table `public.countdown_marks`. RLS is on, with three owner-only policies, each `TO authenticated`. A check constraint limits `date_key` to `event:<uuid>`, `anniversary:<uuid>` and the four fixed keys.
- **Offline:** marks are read offline from the new local-copy kind `countdown-marks`, which `deleteAccountCopies` removes at sign-out. `signedOutState()` resets `countdownMarks` to `null`.
- **Re-plan:** it now needs the marks copy too, and skips when it is missing. A marks-copy write re-plans.
- **Web and older shells:** they show no list and never read the table.

**Files changed:**
- `supabase/migrations/20261101010000_countdown_marks.sql` -- the table, RLS, grants and policies.
- `supabase/tests/database/38_countdown_marks.sql` -- pgTAP for the policies, grants, key check, cross-account refusals and cascade.
- `src/types/database.types.ts` -- the `countdown_marks` block.
- `src/services/countdownMarksService.ts` -- fetch and set (an insert that ignores duplicates, or a delete); online-only, throws.
- `src/stores/slices/settingsSlice.ts` -- the copy kind and its reader, the state, the refresher (shell only) and the setter.
- `src/stores/slices/authSlice.ts` -- the sign-out reset.
- `src/services/dateReminders.ts` -- `MARK_KEYS`, `reminderDateEntries`, and the month and week reminders.
- `src/services/dateRemindersAtLaunch.ts` -- the marks copy in the re-plan and its trigger.
- `src/components/Settings/CountdownMarks.tsx` -- the Reminders card.
- `src/components/Settings/PushSettings.tsx` -- renders it at the end of the section.
- Tests:
  - `src/services/__tests__/dateReminders.test.ts`, `tests/unit/stores/dateRemindersAtLaunch.test.ts` and `tests/unit/stores/signOutClearsAccountState.test.ts` -- updated.
  - `tests/unit/stores/countdownMarks.test.ts` and `src/components/Settings/__tests__/CountdownMarks.test.tsx` -- new.
  - `src/components/Settings/__tests__/PushSettings.test.tsx` -- the marks service mock.
- Test plumbing:
  - `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts` -- the refresher stubs.
  - `tests/e2e/settings/push-switches-web.spec.ts` -- no marks list and no `countdown_marks` request on the web.

**Review (quick lens, 7 findings: 1 medium, 5 low, 1 false):**
- **Patched: 4.**
  - The PushSettings marks mock (medium).
  - The card's placement after the push messages (low).
  - The shared `setOnline` import (low).
  - Today's events left out of the list (low).
- **Deferred: 1.** The `database.types.ts` regeneration drift on CLI 2.122 (low; owner's call).
- **Rejected: 2.**
  - Delete the clone (low). It contradicts the ticket, because story 3 reuses the second simulator, and the fix would be a plan edit.
  - The simulator ACs unverified (false). All seven ran and passed; see below.

**Follow-up review recommended:** false. One medium and three low entries were patched, so no high and fewer than two mediums. The medium was a test mock, proven by the green suite. Patched counts by verdict: high 0, medium 1, low 3.

**Verification (patched tree):**
- **Static and unit checks:**
  - `npm run lint`: clean.
  - `npm run typecheck`: clean.
  - `npm run test:unit`: 220 files, 3614 tests pass.
  - `SEED=1 npm run test:unit:coverage`: exit 0.
- **Database:** `supabase test db` passes, 25 files including `38_countdown_marks.sql`.
- **E2E:** `npx playwright test tests/e2e/settings/push-switches-web.spec.ts tests/e2e/auth/login.spec.ts`: 5 passed.
- **Build:** `fnox exec -- npm run build`: exit 0, so `dist/` is a production build.
- **Simulator** (iPhone Duo A0A486ED, local stack, no person; `sim provision`, `sim dates kinds`, plus a Casey event "Far trip" 40 days ahead inserted on the local DB; shell built from this tree, `sim signin`), checked before the review patches, which change neither the planner nor these rows:
  - **unmarked at first:** Reminders listed Lake weekend, Far trip, First dance, Our anniversary, Wedding, Your birthday and Jessie's birthday, every switch at value 0.
  - **marking a far date:** tapping Far trip gave a `countdown_marks` row. `sim pending` went from 12 to 14 entries with no relaunch: `In a month: Far trip` on 2026-11-12 at 9:00 and `In a week: Far trip` on 2026-12-05 at 9:00, beside `Tomorrow: Far trip` on 2026-12-11. Every entry had thread `partner-activity`.
  - **five days ahead:** marking `Our anniversary` rewrote the plist after the tap, and no month or week entry was added for it (still 14).
  - **reinstall:** `sim uninstall`, `sim build` and `sim signin` gave a new UserNotifications folder, rewritten after sign-in, with Far trip's month and week entries. Settings showed Far trip and Our anniversary marked.
  - **network off:** with `supabase_kong_My-Love` stopped, a terminate and launch rewrote the plist 26 s after launch, and the month and week entries were still listed. Kong was restarted.
  - **unmark:** unmarking Far trip took the list back to 12.
  - **second simulator:** the clone FF934168 ("iPhone Duo 4.2 clone"), built and signed in as Casey, listed no Far trip month or week entries. After Far trip was marked on the first simulator, a terminate and relaunch of the clone listed `In a month` and `In a week` for Far trip.
  - **partner unchanged:** the clone was signed out and signed in as Jessie. Her 10 entries had no month or week reminder, and no entry for Casey's anniversary. Casey then unmarked Far trip and marked Wedding on the first simulator. A relaunch rewrote Jessie's plist, and her list was byte-identical.
  - **cleanup:** all marks unmarked (`countdown_marks` count 0); `sim dates clear` and `sim provision` ran clean (Far trip gone); the clone was shut down and kept for story 3.
- **Environment repair during verification:** the subagent's `supabase db reset` on CLI 2.122 had applied storage migrations newer than the running storage-api v1.67.15 container, so provision's photo upload failed (42P10). `supabase stop` and `supabase start` (data kept) brought up storage-api v1.84.19.

**Residual risks:**
- A device whose marks copy has never loaded skips every re-plan until it does, by story 6's rule. The first launch after this bundle arrives offline keeps the previous pending list.
- A mark is keyed `partner-birthday`, not by the partner's id, so after a re-link it carries over to the new partner's birthday.
- Reminders firing at 9:00 are story 8's to check.
- The deferred `database.types.ts` drift.
