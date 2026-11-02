---
title: 'The planner schedules every date''s day-before and on-the-day reminders at launch'
type: 'feature'
ticket: '1'
created: '2026-11-01'
status: done
baseline_revision: 'b7d7ac0903d9695af018ba77392da9710647964f'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      On a first sign-in the launch plan can find notification permission not yet granted, and nothing re-plans once the person taps Allow until the next launch.
    evidence: |-
      dateReminders.ts schedules only when checkPermissions().display is 'granted' and never prompts; story 3.1's alert is often still up when refreshLocalCopies() resolves on the first signed-in start. Story 4.6 owns the re-plan triggers (foreground, sign-in, date change). Whether its foreground trigger fires when the system permission alert closes is unverified; story 4.6 should check a re-plan after the first-sign-in permission answer.
    location: >-
      src/App.tsx:418-424, src/services/dateReminders.ts scheduleDateReminders
    severity: low
  - summary: >-
      The `sim help` text and the AGENTS.md sim-driver sentence say `sim dates kinds|many` replace only the seeded events, but they first clear both people's anniversaries, the pair's couple_settings row and both birthdays, as `clear` does.
    evidence: |-
      scripts/sim-driver/sim:71-72 reads "kinds and many first remove the seeded events"; AGENTS.md's sim-driver paragraph reads "replacing the seeded events"; scripts/sim-driver/dates.ts runs clearDates before kinds and many, as its own header states. The fix edits AGENTS.md, an agent-context file.
    location: >-
      scripts/sim-driver/sim:67-75, AGENTS.md (sim-driver paragraph)
    severity: low
  - summary: >-
      `sim pending` can report "nothing has been scheduled since ... installed" (and []) while requests are pending, because the simulator writes PendingNotifications.plist some time after `schedule` returns.
    evidence: |-
      Found during this pass's simulator verification, not by a review lens. After the first sign-in and a network-off relaunch, `sim pending` 15 s after launch said the plist did not exist; the next launch's console showed LocalNotifications.getPending returning 11 pending requests. Later launches rewrote the plist within 25 s. A check that reads the list right after the first schedule on a fresh install can see a false empty list. Story 7's reader (scripts/sim-driver) could wait for the plist's mtime to pass the launch, as the previous pass did by hand.
    location: >-
      scripts/sim-driver/sim cmd_pending
    severity: low
---

<intent-contract>

## Intent

**Problem:** The app shows countdowns to every date but reminds nobody; the native shell has no way to schedule a local notification.

**Approach:** Add `@capacitor/local-notifications` to the shell, a pure planner that turns the loaded dates into day-before and on-the-day 9:00 reminders (soonest 64), and a launch step that, once the date copies have loaded, cancels the shell's pending reminders and schedules the planner's list.

## Boundaries & Constraints

**Always:**
- Planner inputs: each event (label, date); the person's own anniversaries (label, `YYYY-MM-DD`); the relationship start (ISO instant); the wedding date (`YYYY-MM-DD`); the person's own birthday and the partner's, each with the name Home's card gets (`ownProfile.displayName`, `null` = "You"; `partner.displayName`).
- Day-before reminder for every date; on-the-day reminder for anniversaries, the relationship start, the wedding date and birthdays; never for events. All at 9:00 local time. A reminder whose moment is at or before `now` is dropped. Sort by moment, cut at 64.
- Texts: `Tomorrow: {name}` / `Today: {name}`. Event/anniversary name is its label. Birthday name: `{name} turns {age}` or `You turn {age}` (age at that occurrence). Relationship start: `Our anniversary`. Wedding: `Wedding day` while the wedding date is today or ahead, `Wedding anniversary` for each later year.
- Next occurrences come from `getNextAnniversaryDate` (anniversaries, relationship start, a passed wedding date) and `getNextBirthday`. Every `YYYY-MM-DD` goes through `parseEventDate`; an unparseable date is skipped. The relationship start recurs on its calendar date in the device's time zone. An occurrence on or before the relationship start's own date is skipped.
- Native calls only behind `Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')`. The web and an older shell do nothing: no plugin call, no error, no IndexedDB read.
- The launch step never prompts for permission (story 3.1 owns the prompt). It cancels every pending local notification. It schedules only when `checkPermissions().display === 'granted'`, because the plugin's `schedule` prompts when permission is undetermined.
- Capture `{ userId, authSessionVersion }` before the first await and re-check both before each plugin call (AGENTS.md, Known pitfalls).
- Match the surrounding style by hand. Never run Prettier.

**Never:**
- No re-plan on foreground, date change or sign-in beyond the signed-in start; no sign-out cancel, `threadIdentifier` or tap handling (all story 6). No countdown marks or month/week reminders (story 2), no Settings switch (story 3).
- No reminder for the daily message. No change to Home's cards or what they show.
- No new `registerLocalCopy` kind, IndexedDB store or store field.
- No `schedule.at` trigger. It becomes a relative interval trigger, not a 9:00 calendar one.
- No real names or emails in fixtures or seeds.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Event in 3 days | label "Trip" | one `Tomorrow: Trip` at 9:00 two days ahead; no on-the-day | none |
| Event tomorrow, now 10:00 | | dropped | none |
| Event today | | nothing | none |
| Anniversary in 5 days | | `Tomorrow: X` and `Today: X`, 9:00 | none |
| Anniversary passed this year | | next year's pair | none |
| Own birthday, displayName null | 1996, in 5 days | `Tomorrow: You turn 30`, `Today: You turn 30` | none |
| Partner birthday | name "Jessie" | `Tomorrow: Jessie turns N` | none |
| Wedding ahead / today before 9:00 / passed | | `Wedding day` pair / `Today: Wedding day` / `Wedding anniversary` pair next year | none |
| Relationship start | instant years ago | `Our anniversary` pair on its local calendar date | none |
| 70 reminders due | 50 events + 10 anniversaries | soonest 64 | none |
| Unparseable date string | `'garbage'` | that date skipped | no throw |
| Web / older shell | no native plugin | nothing called | none |
| Permission not granted | `display !== 'granted'` | pending cancelled, nothing scheduled, no prompt | none |
| Account switched mid-run | identity changes after an await | no further plugin call | none |
| Plugin call rejects | | logged, not thrown | caught |

</intent-contract>

## Code Map

- `src/components/RelationshipTimers/BirthdayCountdown.tsx:35-84` -- private `BirthdayInfo`, `toBirthdayInfo`, `getNextBirthday` and `getUpcomingAge`. Move all four, unchanged, to `src/utils/countdownService.ts`, export them and import them back here. The card's behaviour does not change. A non-component export from a `.tsx` trips `react-refresh/only-export-components`.
- `src/utils/countdownService.ts:48` -- `getNextAnniversaryDate(dateString)` reads `new Date()` itself. Add an optional `now: Date = new Date()` parameter so existing callers are unchanged and the planner and its tests can pass a clock.
- `src/services/eventsService.ts:202` -- `parseEventDate`. `src/utils/dateUtils.ts` -- `formatDateISO` (local `YYYY-MM-DD`).
- `src/stores/slices/eventsSlice.ts:57-130` -- `EVENTS_COPY_KIND` and the private `parseSavedEvents`. Export a `readSavedEvents(userId): Promise<CoupleEvent[] | null>`, built on `readLocalCopy` and `parseSavedEvents`. The events refresher skips Home and Settings (`:283-287`), because Home loads them itself (`App.tsx:530-555`). So the launch step plans from the saved events copy, which is "the dates the app last loaded", and never calls `loadEvents`: a second load would leave Home's load `stale`, and Home would never settle.
- Store fields (`useAppStore.getState()`):
  - `settings.relationship.anniversaries`: `{ date, label }[]`, the creator's own rows only.
  - `coupleSettings`: when `status === 'linked'` it carries `relationshipStart` (an ISO instant or null) and `weddingDate`.
  - `ownProfile`: `{ displayName, birthday }`.
  - `partner`: `{ displayName, birthday }`, or null.
  - `BirthdayWeddingCards.tsx:48-61` shows how Home names each birthday.
- `src/services/localCopy.ts:131` -- `refreshLocalCopies()` resolves once every refresher has applied its copy and settled its read. `App.tsx:412-415` calls it on `[authUserId, authSessionVersion]`. Chain the launch step onto that call, and do not call it a second time.
- `src/services/pushNotifications.ts:183-189` -- the gate pattern `hasNativePush()`. Its header says the module must not import the store; follow the same rule for `dateReminders.ts`. `src/services/storage.ts` is the precedent for a service that imports `useAppStore`.
- Plugin `@capacitor/local-notifications` 8.3.1 (iOS source read):
  - `schedule` needs a string `title` and `body`.
  - `schedule.on {year,month,day,hour,minute}` becomes `UNCalendarNotificationTrigger(dateMatching:, repeats: true)`. With the year set it matches once, and no calendar or time zone is set, so `scripts/sim-driver/pending.py` accepts it.
  - `cancel` rejects an empty array.
  - Identifiers are `String(id)`; `id` is an int.
- `ios/App/CapApp-SPM/Package.swift` -- generated. `npx cap update ios` adds the plugin, as f858f475 did for haptics.
- `src/services/__tests__/pushNotifications.test.ts:3-51` -- the mock pattern: `vi.hoisted`, then `vi.mock('@capacitor/core')` and the plugin module, then `vi.resetModules()`. Vitest runs with `TZ=America/New_York`.
- `scripts/sim-driver/provision.ts` -- the fixture pair: Casey (the driver's first account) and Jessie (its partner). It reuses `localConfig()` and `check()`, and seeds 6 Casey events. `wipePair` does not touch anniversaries, `couple_settings`, or `users.birthday`.
- Schema:
  - `anniversaries(user_id, event_date, label, client_key)`
  - `couple_settings(user_a < user_b, relationship_start timestamptz, wedding_date)`. `couplePair()` is in `coupleSettingsService.ts:43`.
  - `users.birthday date`
- `scripts/sim-driver/sim` -- add the `dates` command next to `provision` (`:471-477`): same key handling, help text under Accounts. `build [--from REV] [--update-port N]`, `serve-update`, `signin [partner]`, `signout`, `launch`, `pending`.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `package-lock.json`, `ios/App/CapApp-SPM/Package.swift` -- run `npm install @capacitor/local-notifications@^8.3.1`, then `npx cap update ios`. Commit only the plugin's lines. -- the shell gains the plugin.
- [ ] `src/utils/countdownService.ts`, `src/components/RelationshipTimers/BirthdayCountdown.tsx` -- move and export the birthday helpers. Give `getNextAnniversaryDate` an optional `now`. -- planner reuse, card unchanged.
- [ ] `src/services/dateReminders.ts` (new):
  - `REMINDER_HOUR = 9` and `MAX_SCHEDULED_REMINDERS = 64`.
  - A `ReminderDates` input type.
  - A pure `planDateReminders(dates, now): PlannedReminder[]`, where each reminder is `{ text, fireAt, on }`.
  - `hasNativeReminders()`.
  - `scheduleDateReminders(reminders, isCurrent)`. It reads `getPending`, then `cancel` (only when non-empty), then `checkPermissions`. When the result is granted it calls `schedule`, numbering the reminders `id = 1..N` in planner order, each `{ title: text, body: '', schedule: { on } }`. It calls `isCurrent()` before each plugin call, and logs failures without throwing.
  - Store-free.
  -- the planner stories 2, 3 and 6 extend.
- [ ] `src/services/dateRemindersAtLaunch.ts` (new) -- `scheduleDateRemindersAtLaunch()`. It returns at once unless `hasNativeReminders()`. Otherwise it captures the identity, then awaits `readSavedEvents` (null counts as `[]`). It re-checks the identity, then builds `ReminderDates` from the store and the events, plans with `new Date()`, and calls `scheduleDateReminders` with an identity `isCurrent`. -- the launch trigger story 6 extends.
- [ ] `src/stores/slices/eventsSlice.ts` -- export `readSavedEvents`. -- events from the loaded window.
- [ ] `src/App.tsx:412-415` -- `void refreshLocalCopies().then(() => scheduleDateRemindersAtLaunch())`, with a comment explaining why. -- the launch trigger.
- [ ] `src/services/__tests__/dateReminders.test.ts` (new) -- one case per matrix row and per Verify item: each kind, both birthday texts, the passed-moment drops, yearly recurrence, the wedding before, on and after its date, the on-the-day reminders, the 9:00 `on` components, the soonest-64 cut, and a leap-day anniversary matching `getNextAnniversaryDate`. Also the scheduler: no native platform, plugin unavailable, permission not granted, an empty pending list (no `cancel`), `isCurrent` false, and a rejecting call. -- Verify's unit coverage.
- [ ] `tests/unit/stores/dateRemindersAtLaunch.test.ts` (new) -- a real store, an events copy written with `writeLocalCopy`, and mocked `@capacitor/core` and plugin. Check the scheduled payload for one date of each kind, an account switch during the copy read (no schedule), and the web (no plugin call). Reuse `tests/unit/stores/accountDataFixtures.ts` and the helpers in `birthdaysWedding.test.ts`. -- wiring coverage.
- [ ] `scripts/sim-driver/dates.ts` (new) and the `sim dates kinds|many|clear` command. All three apply to the fixture pair only, on the local stack only.
  - `kinds`: Casey gets one event in 3 days, one anniversary in 4, a relationship start years ago dated 5 days ahead, a wedding date 6 days ahead, and a birthday in 7 days. Jessie gets a birthday in 8 days. The labels are made up.
  - `many`: exactly 50 Casey events, 2..51 days ahead, and 10 Casey anniversaries, 2..11 days ahead. No other date is set, and Jessie has no events.
  - `clear`: deletes both people's events and anniversaries and the pair's `couple_settings` row, nulls both birthdays, then prints "run `sim provision` to restore the seeded events".
  - Update `sim help`, and add one sentence to AGENTS.md's sim-driver paragraph. -- the story seeds and removes its own dates.

**Acceptance Criteria:**
- Given `sim dates kinds`, a `sim build` of the working tree and `sim signin`: when the Kong container is stopped (`docker stop supabase_kong_My-Love`), the shell is terminated and then launched, and about 10 s pass, then `sim pending` lists:
  - a `Tomorrow: …` reminder for the event, the anniversary, `Our anniversary`, `Wedding day`, `You turn N` (or `Casey turns N`, as Home's card reads) and `Jessie turns N`;
  - `Today: …` reminders for the anniversary and both birthdays;
  - each with a calendar trigger `{year,month,day,hour:9,minute:0}`;
  - nothing naming the daily message.

  Then `docker start supabase_kong_My-Love`.
- Given `sim dates many` and an online relaunch, then `sim pending` lists exactly 64 reminders, and they are the soonest 64 of the 70.
- Given `sim dates kinds`, `sim signout` and then `sim signin partner`, when the shell is relaunched, then `sim pending` lists no reminder with Casey's anniversary label.
- Given `sim build --from b7d7ac0903d9695af018ba77392da9710647964f --update-port 8791` and `sim serve-update --port 8791`: when the shell has been signed in and has taken the update (background, relaunch, terminate, relaunch, as story 3.1 did), then Home renders with no error, and `sim pending` exits 0 with `[]`. Afterwards run `sim serve-update --stop`, `sim build`, `sim dates clear` and `sim provision`.

## Implementation Notes

- `npx cap update ios` needs a `dist/index.html`, so a throwaway one was made for the run and then removed. Only the plugin's two lines changed in `Package.swift`.
- `provision.ts` now exports `FIXTURE_PAIR`, `localConfig`, `profileId` and `check` for `dates.ts`, and runs `main()` only under `import.meta.main`. Node is pinned by `mise.lock` to 24.19.0, which has `import.meta.main`.
- `tsconfig.node.json` lists its files explicitly, so `scripts/sim-driver/dates.ts` was added there. Without it, `dates.ts` would not be typechecked, since `scripts/**` is outside lint.
- The "on or before the start's own date" skip applies to the relationship start only, as the plan places it.
- A launch's plan can find permission not yet granted: on the first sign-in the alert is answered while the step runs. In that case it schedules nothing, and the next launch schedules.
- Files:
  - `package.json`, `package-lock.json`, `ios/App/CapApp-SPM/Package.swift`
  - `src/utils/countdownService.ts`, `src/components/RelationshipTimers/BirthdayCountdown.tsx`
  - `src/services/dateReminders.ts` (new), `src/services/dateRemindersAtLaunch.ts` (new)
  - `src/stores/slices/eventsSlice.ts`, `src/App.tsx`
  - `src/services/__tests__/dateReminders.test.ts` (new), `tests/unit/stores/dateRemindersAtLaunch.test.ts` (new), `tests/unit/App.localCopyRefresh.test.tsx`
  - `scripts/sim-driver/dates.ts` (new), `scripts/sim-driver/provision.ts`, `scripts/sim-driver/sim`
  - `tsconfig.node.json`, `AGENTS.md`

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 29 findings — high 0, medium 7, low 12, false 10, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) The launch step reads the identity only when `refreshLocalCopies()` resolves, so a refresh that settles after an account switch plans for the next identity before its copies load. Confirmed: `scheduleDateRemindersAtLaunch` read `useAppStore.getState()` at call time. Fixed: the App effect captures `{ userId, authSessionVersion }` and passes it as `owner`, and the step returns when the store no longer matches.
  - `[low]` `[patch]` (blind) Two runs for one identity can interleave and leave ids above the newer N pending. Reachable only through the row above, where the stale chain adopts the new identity. Fixed by the same `owner` capture, which leaves one run per signed-in start. Story 6's extra re-plan triggers own any serialization.
  - `[low]` `[reject]` (blind) Planning waits on every refresher, including unrelated ones. Each refresher awaits only its own read. The date kinds await theirs too (applying the copy, then the read), so a stalled network holds both alike. Narrowing the wait is more than a direct correction.
  - `[medium]` `[reject]` (blind) Pending reminders survive sign-out. Real, but out of scope by the intent: the epic's 2026-10-30 split gives the sign-out cancel to story 6. No shell with the plugin is installed before story 5, so no device has the gap.
  - `[low]` `[patch]` (blind) The help text reads as if `sim provision` undoes `sim dates`. It does not: `wipePair` leaves anniversaries, `couple_settings` and birthdays. Fixed: the `sim` help, the `dates.ts` header and its clear message, and the AGENTS.md sentence now say to run `sim dates clear` and then `sim provision`.
  - `[low]` `[reject]` (blind) `dates.ts` fires `notify_date_change` pushes. True for event inserts and birthday updates (`20261031030000_push_date_changes.sql`). But `provision.ts`'s 6 seeded events already fire the same trigger, and `sim pending` reads only pending local requests, which pushes never are. Avoiding it means switching the sender off around the seed, which is more than a direct correction.
  - `[false]` `[reject]` (blind) The launch test hits the Vitest fire-and-forget teardown trap. `reloadRotationPool` returns at once with an empty `messages` pool (`authSlice.ts:265`), and these tests never seed one. `deleteAccountData`'s deletes log only on failure. The delete transaction from `beforeEach`'s `clearAuth` is created before `clearCopies`' transaction on the same store, so IndexedDB runs it before the test writes its copy.
  - `[low]` `[patch]` (blind) No case covers a same-account re-login. Fixed: added a case that bumps only `authSessionVersion` during the copy read and expects no plugin call, plus a stale-`owner` case.
  - `[low]` `[patch]` (blind) The unlinked-account test could not tell "couple dates ignored" from "step bailed out". Fixed: it seeds an own birthday and an anniversary, and asserts exactly those, with no `Our anniversary` or `Wedding` entry.
  - `[medium]` `[patch]` (blind) The App wiring is untested. Same gap as the verification-gap row. Fixed there.
  - `[false]` `[reject]` (blind) The planner now pulls in the Supabase client. `BirthdayCountdown.tsx` already imported `parseEventDate` from `eventsService.ts`, and both modules sit in the bundle that loads the client at start. AGENTS.md names `eventsService.ts`'s `parseEventDate` as the parser to use. The tests pass with the client loaded. No harm named or found.
  - `[false]` `[reject]` (blind) 29 February birthdays and anniversaries disagree. That is by design: each reminder matches its own card. `BirthdayCountdown.tsx`'s header documents the 1 March rollover, and `getNextAnniversaryDate` clamps to 28 February.
  - `[medium]` `[patch]` (edge) The account switch during `refreshLocalCopies` plans the new account from partial state. Same root cause as the first row. Fixed by the `owner` capture.
  - `[low]` `[patch]` (edge) Interleaved runs leave stale ids. Same as the second row.
  - `[medium]` `[reject]` (edge) No sign-out cancel. Same as the sign-out row: out of scope, story 6.
  - `[low]` `[reject]` (edge) At a Home launch the step plans from the previous session's events copy, because Home's own load may land later. Real: a fresh read is picked up only on the next launch. Out of scope by the intent: the epic gives story 6 the re-plan triggers (foreground, sign-in, date change, after loaded data). The plan's Design Notes record the choice.
  - `[false]` `[reject]` (edge) A 29 February birthday fires on 1 March while anniversaries clamp. Same refutation as the 29 February row above.
  - `[low]` `[reject]` (edge) If `cancel` succeeds and then `schedule` rejects, nothing is left pending. The plugin rejects only on a missing id, title, body or a bad trigger (`LocalNotificationsPlugin.swift:174-210`), and every payload here carries all of them. A retry or per-request scheduling is more than a direct correction.
  - `[false]` `[reject]` (edge) A fired year-specific `repeats: true` request may stay pending and take a slot. Every launch cancels every pending request before scheduling, and nothing is added between launches, so a fired request left pending cannot displace one.
  - `[false]` `[reject]` (edge) `import.meta.main` is undefined on Node 24.0 and 24.1. `mise.lock` pins Node 24.19.0, and `sim provision` ran under it and re-provisioned the pairs in this pass.
  - `[low]` `[reject]` (edge, claim) The online relaunch after `sim dates many` can plan from the pre-seed events copy. Seen: this pass relaunched twice before reading 64. Same root cause and out-of-scope route as the Home-launch row.
  - `[false]` `[reject]` (edge, claim) AC1's `Today:` list read as exclusive. The AC lists what must be present, and the intent counts the wedding date and the relationship start as anniversaries, which get on-the-day reminders.
  - `[medium]` `[patch]` (verification-gap) The launch step's place after `refreshLocalCopies()` in `App.tsx` is untested. Fixed: `tests/unit/App.localCopyRefresh.test.tsx` mocks `dateRemindersAtLaunch` with a spy. It checks no call before a held refresh resolves, one call with the start's identity after, a second call on the account switch, and none while signed out.
  - `[low]` `[reject]` (intent) The simulator checks are not recorded in the diff, and the Implementation Notes were empty. The fix edits this build's plan. The Auto Run Result records the implementing session's runs and this session's re-run of AC1 and AC2.
  - `[medium]` `[patch]` (intent) The App wiring is untested. Same as the verification-gap row. Fixed there.
  - `[low]` `[reject]` (intent) Events source: the saved copy versus this launch's fresh load. Same as the Home-launch row: out of scope, story 6.
  - `[false]` `[reject]` (intent) The cancel clears every local notification, not only date reminders. The shell schedules no other local notification, and every one the epic plans (stories 2 and 3) is a date reminder.
  - `[false]` `[reject]` (intent) The partner check reads F1 (Casey's anniversary label) and not F2. The intent says "nothing for the first account's anniversary", and R8 limits anniversaries to their creator. The relationship start and the wedding are couple-wide.
  - `[false]` `[reject]` (intent) Changes outside the stated surfaces (`provision.ts` exports, `tsconfig.node.json`, AGENTS.md). Each serves the story: `dates.ts` reuses provision's helpers, the tsconfig entry typechecks `dates.ts`, and the plan asked for the AGENTS.md sentence. No harm.

### 2026-11-01 — Review pass (follow-up)
- verdicts: 26 findings — high 0, medium 3, low 13, false 10, maybe-false 0
- findings:
  - `[medium]` `[reject]` (blind) A `null` from `readSavedEvents` (no copy, a failed IndexedDB read, a malformed copy) counts as `[]`, and null profile or couple state plans nothing for those dates, so the launch cancels reminders it cannot replace. Real, but out of scope by the intent: story 4.6's ticket says "Every re-plan, story 1's launch trigger included, runs only from loaded copies or a successful read", and the epic's 2026-10-30 split gives "loaded data only" to story 6. No shell with the plugin is installed before story 5.
  - `[low]` `[patch]` (blind) The `dateReminders.ts` header calls each trigger "a one-off ... not a repeating one", but the plugin always builds `UNCalendarNotificationTrigger(dateMatching:, repeats: true)` (`LocalNotificationsPlugin.swift:555`). Fixed: the header now says the plugin makes it repeating and the pinned year makes it match once.
  - `[low]` `[reject]` (blind) `schedule` resolves before `center.add`'s completion runs (`LocalNotificationsPlugin.swift:211-226`), so an `add` failure is never logged. Confirmed in the plugin source. With these payloads `add` fails only if permission is revoked in the moment between `checkPermissions` and `add`, and then no reminder could show anyway. Catching it needs a post-schedule `getPending` check, which is more than a direct correction.
  - `[false]` `[reject]` (blind) Real rejected findings are missing from the deferred-work ledger. AGENTS.md's ledger rule covers deferred findings, and rejected ones are not deferred. This pass's deferrals are in the plan's `deferred` list, which the orchestrator carries to the ledger.
  - `[low]` `[defer]` (blind) On a first sign-in nothing re-plans once permission is granted. Reproduced on the simulator: the alert is answered after the first launch's plan has checked permission. Out of scope by the intent (story 4.6 owns the re-plan triggers); deferred so story 4.6 checks a re-plan after the permission answer.
  - `[false]` `[reject]` (blind) Future-dated anniversaries get a "Today" reminder before the date, and a future birthday year reads "You turn 0". The planner uses `getNextAnniversaryDate` and `getNextBirthday` exactly as Home's cards do, which the epic requires ("so those reminders never disagree with their cards"). The cards count down to the same occurrence and show the same age.
  - `[low]` `[patch]` (blind) No test pins a 29 February birthday's 1 March reminder. Fixed: `dateReminders.test.ts` adds a case that checks `getNextBirthday` and the planner agree on 1 March 2027.
  - `[low]` `[defer]` (blind) `sim help` and AGENTS.md say `kinds` and `many` replace only the seeded events, though they clear every date first. Confirmed at `sim:71-72` and AGENTS.md. The fix edits AGENTS.md, an agent-context file, so it is deferred.
  - `[low]` `[patch]` (blind) The signed-out App test dispatches `online`, which proves nothing, and nothing pins the online handler not planning. Fixed: added a signed-in case. It dispatches `online` and checks that `refreshLocalCopies` runs again but `scheduleDateRemindersAtLaunch` does not.
  - `[low]` `[patch]` (blind) `scheduledTitles()` throws a TypeError when `schedule` never ran. Fixed: the helper asserts `toHaveBeenCalledTimes(1)` first.
  - `[low]` `[patch]` (blind) `getNextAnniversaryDate` keeps a `const today = now` alias. Fixed: the alias is removed and the body uses `now`.
  - `[low]` `[defer]` (edge) First sign-in: the permission prompt is unanswered when the plan runs, so nothing is scheduled until the next launch. Same root cause as the blind first-sign-in row; shares its defer.
  - `[low]` `[reject]` (edge) Positional ids 1..N are reused on every re-plan, so a newly delivered reminder replaces an unread delivered one with the same identifier in Notification Center. Real per iOS identifier semantics, but negligible: the person sees the newer reminder in place of an older, already-shown one. A stable id scheme changes the contract stories 2, 3 and 6 extend, which is more than a direct correction.
  - `[low]` `[patch]` (edge) The header comment misstates the trigger as non-repeating. Same as the blind header row; fixed there.
  - `[medium]` `[reject]` (edge) On Home or Settings the events refresher returns at once, so on a first sign-in, or after sign-out deleted the copy, the step has no events copy, plans none and cancels the pending ones. Same root cause and out-of-scope route as the blind `readSavedEvents` row (story 4.6's loaded-data-only rule).
  - `[medium]` `[patch]` (verification-gap) No App test holds a refresh across an account switch, so nothing checks that `owner` is captured before the await. Fixed: `App.localCopyRefresh.test.tsx` holds the first refresh, switches account in place and settles the refresh. It then checks that the second call carries the first start's identity. A mutation that reads the identity inside `.then` fails the test.
  - `[false]` `[reject]` (verification-gap, other) The launch test's native-mocked `clearAuth` runs `stopPushesForSignOut`, whose logs could land after the file ends. Eight shuffled runs (`--sequence.shuffle`, seeds 1–8) and four plain runs all exit 0 with no stderr. Every rejection is caught inside `stopDevicePushes` within microtasks, and each test's `afterEach` awaits an IndexedDB clear after it, so no log can outlive the file.
  - `[low]` `[reject]` (intent) Events come from the saved copy, not this launch's fresh load (A2 vs A1). carried: the 2026-11-01 first pass rejected this as out of scope, owned by story 6, and the code still reads the saved copy. The added point is false: the copy can hold more than 50 rows after `loadMoreEvents`. Those rows are loaded events, and the soonest-64 cut still keeps the soonest.
  - `[false]` `[reject]` (intent) The own birthday reads "Casey turns 30" rather than "You turn 30" when a display name is set. The intent's rule is "each birthday as its Home card names it". Home's own card is passed `ownProfile.displayName` (`BirthdayWeddingCards.tsx:49`), and the simulator's Home shows "Casey turns 30". So the reminder matches the card, as the epic requires ("never disagree with their cards").
  - `[low]` `[defer]` (intent) Permission timing, D1 vs D2. Same as the blind first-sign-in row; shares its defer.
  - `[false]` `[reject]` (intent) The relationship start skips occurrences on or before its own date, a rule the intent does not state. No bad outcome: the start date itself is not an anniversary, and "Our anniversary" on it would be wrong. A start years ago is unaffected (simulator: `Our anniversary` pair listed).
  - `[false]` `[reject]` (intent) The old shell is checked only by mocking `isPluginAvailable`. This pass ran AC4 on the simulator. A shell built from b7d7ac09 loaded the served bundle `sim-tree-1793525080` (CapgoUpdater "Current bundle loaded successfully"), which proves the swap. Its console had no error lines and no LocalNotifications call, Home rendered, and `sim pending` exited 0 with `[]`.
  - `[false]` `[reject]` (intent) No test signs in as the partner. AC3 ran on the simulator in this pass: signed in as Jessie, 9 reminders and none naming Casey's anniversary `First dance`.
  - `[false]` `[reject]` (intent) No test asserts nothing names the daily message. The planner has no daily-message input, and AC1's and AC2's pending lists in this pass hold only date reminders.
  - `[false]` `[reject]` (intent) No code or test path covers network off. AC1 in this pass stopped Kong. The console shows transport failures, and the schedule call still listed 11 reminders, with the plist rewritten during that launch.
  - `[false]` `[reject]` (intent) Simulator evidence is absent from the diff. It lives in this plan by design (830021b8 and this pass's Auto Run Result), and this pass re-ran all four ACs.

## Design Notes

One-off dated `on` triggers rather than yearly repeating ones, for three reasons:
- a birthday's text names an age, and the wedding's text changes after it passes;
- the soonest-64 cut needs concrete moments;
- re-planning on every launch keeps next year's occurrence coming.

The reader prints these as `repeats: true` with a `year` component, which matches only once. A floating trigger (no time zone) is what keeps 9:00 local when the device changes time zone (R5).

The launch step plans from the saved events copy rather than the store's `events`, because the store list is filled by Home's own load on Home and is untouched on Settings until that view loads. The other kinds have refreshers that `refreshLocalCopies()` awaits.

"Network off" on the simulator stops the local Kong container, the shell's only route to the stack. The simulator shares the Mac's network, so airplane mode is story 8's hand check.

## Verification

**Commands:**
- `npx vitest run src/services/__tests__/dateReminders.test.ts tests/unit/stores/dateRemindersAtLaunch.test.ts src/components/RelationshipTimers` -- expected: all pass.
- `npm run test:unit` -- expected: green.
- `npm run lint` and `npm run typecheck` -- expected: clean, apart from any TS2883 errors already on this worktree's baseline.
- `fnox exec -- npm run build` -- expected: exit 0, with `dist/` left as a production build.
- The four simulator ACs above, through `scripts/sim-driver/sim`, against `supabase start`.


## Auto Run Result

Status: built

**Summary:** The shell schedules date reminders. `@capacitor/local-notifications` 8.3.1 is added. A pure planner (`planDateReminders`) gives every date a day-before reminder, and anniversaries, the relationship start, the wedding date and birthdays an on-the-day one too. All fire at 9:00 local; passed moments are dropped, and the list is sorted and cut at 64. On each signed-in start, once `refreshLocalCopies()` settles, the shell cancels every pending local notification and schedules the plan, if permission is already granted. It never prompts, and it does nothing on the web or in a shell without the plugin. `sim dates kinds|many|clear` seeds and removes the fixture pair's dates. This follow-up pass reviewed the whole change since b7d7ac09 with four lenses and patched comments and tests. It changed no runtime behaviour.

**Files changed (whole story):**
- `package.json`, `package-lock.json`, `ios/App/CapApp-SPM/Package.swift`: the plugin.
- `src/utils/countdownService.ts`: the birthday helpers, moved from `BirthdayCountdown.tsx` unchanged, and an optional `now` on `getNextAnniversaryDate`. This pass dropped a leftover `today` alias.
- `src/components/RelationshipTimers/BirthdayCountdown.tsx`: imports the moved helpers; the card is unchanged.
- `src/services/dateReminders.ts` (new): the planner, the native gate and `scheduleDateReminders`. This pass corrected the trigger description in its header.
- `src/services/dateRemindersAtLaunch.ts` (new): the launch step, guarded by the start's `owner` identity.
- `src/stores/slices/eventsSlice.ts`: `readSavedEvents`.
- `src/App.tsx`: chains the launch step onto the signed-in start's refresh, with the identity captured.
- Tests:
  - `src/services/__tests__/dateReminders.test.ts`: covers the planner and the scheduler. This pass added a 29 February birthday case.
  - `tests/unit/stores/dateRemindersAtLaunch.test.ts`: covers the launch step against a real store and copy. This pass made its helper assert that `schedule` ran.
  - `tests/unit/App.localCopyRefresh.test.tsx`: covers the wiring. This pass added the held-refresh account switch and the signed-in `online` cases.
- `scripts/sim-driver/dates.ts` (new), `scripts/sim-driver/sim`, `scripts/sim-driver/provision.ts`: `sim dates`.
- `tsconfig.node.json`, `AGENTS.md`: typecheck `dates.ts`; one sentence on `sim dates`.

**Review (follow-up pass):** 4 lenses, 26 findings: 3 medium, 13 low, 10 false.
- **Patched:** 6 entries.
  - The `owner`-capture App test (medium).
  - The trigger comment (low; blind and edge rows).
  - The leap-day birthday test (low).
  - The signed-in `online` test (low).
  - The `scheduledTitles` guard (low).
  - The `today` alias (low).
- **Deferred:** 3 low entries in the plan's `deferred` list.
  - The first sign-in re-plans nothing once the person taps Allow (story 4.6's triggers).
  - The `sim dates` wording in `sim help` and AGENTS.md.
  - `sim pending` lagging the real pending list on a fresh install. Found during verification, not by a lens.
- **Rejected:**
  - Out of scope by the intent (story 4.6's loaded-data-only rule covers the launch trigger):
    - a null or failed events read cancels event reminders (medium, 2 rows).
  - Low, not worth the fix:
    - an unseen `center.add` failure: only a permission revoke mid-call reaches it;
    - positional ids replacing an unread delivered reminder: negligible, and it would change a contract stories 2, 3 and 6 extend;
    - the saved events copy versus a fresh load (carried from the first pass).
  - False:
    - the deferred-work ledger;
    - future-dated anniversaries and birthdays, which match the cards;
    - the push-teardown log race (12 runs clean);
    - the own birthday text, which matches Home's card;
    - the relationship-start skip rule;
    - the old shell, partner, daily-message, network-off and simulator-evidence rows, each settled by this pass's simulator runs.

**Follow-up review recommended:** false. This was a follow-up pass and it patched no high entry. Patched entries by verdict: high 0, medium 1, low 5.

**Verification (this pass, on the patched tree):**
- Unit and static checks:
  - targeted vitest, 10 files: 205 pass;
  - `npm run test:unit`: 217 files, 3480 tests pass;
  - `npm run typecheck`: 0 errors;
  - `npm run lint`: clean;
  - `fnox exec -- npm run build`: exit 0, so `dist/` is a production build.
- A mutation that reads the identity inside `.then` in `App.tsx` fails the new App test. `App.tsx` was restored byte-for-byte.
- Simulator: iPhone Duo A0A486ED, local stack, no person. Shell built from the patched tree.
  - **AC1:** `sim dates kinds`, `sim build`, `sim signin`, then a terminate, `docker stop supabase_kong_My-Love` and a launch with the console captured. Transport errors were logged, and the launch ran getPending, cancel, checkPermissions (`granted`) and schedule. The plist was rewritten during the launch, and `sim pending` listed 11 reminders, each a `{year:2026,month:11,day:N,hour:9,minute:0}` calendar trigger:
    - `Tomorrow: Lake weekend`
    - `Tomorrow:`/`Today: First dance`
    - `Tomorrow:`/`Today: Our anniversary`
    - `Tomorrow:`/`Today: Wedding day`
    - `Tomorrow:`/`Today: Casey turns 30`
    - `Tomorrow:`/`Today: Jessie turns 34`

    Nothing named the daily message. Kong was restarted.
  - **The first pass's UNVERIFIED empty read, explained:** right after sign-in, a network-off read again said the plist did not exist. But the next launch's `getPending` returned 11 already-pending requests, so the reminders had been scheduled and only the on-disk plist lagged (deferred, sim driver).
  - **AC2:** `sim dates many` and two online relaunches gave exactly 64: 54 `Tomorrow:` and 10 `Today:`. Events 1–44 and all 20 anniversary reminders were kept, Events 45–50 were cut, and all were at 9:00.
  - **AC3:** after `sim dates kinds`, `sim signout`, `sim signin partner` and a relaunch: 9 reminders, none naming `First dance`.
  - **AC4:** `sim build --from b7d7ac0903d9695af018ba77392da9710647964f --update-port 8791` and `sim serve-update --port 8791`, then sign-in, background, relaunch, terminate and relaunch. CapgoUpdater loaded bundle `sim-tree-1793525080`, which is this tree, so the swap is proven. The console had no error lines and no LocalNotifications call, Home rendered (screenshot), and `sim pending` gave `[]` with exit 0.
  - Cleanup: `sim serve-update --stop`, `sim build`, `sim dates clear`, `sim provision`. Kong is up.

**Residual risks:**
- Whether a fired year-pinned request (the plugin sets `repeats: true`) leaves iOS's pending list is unverified; story 8 fires them.
- Until story 4.6:
  - a launch can plan from a missing or stale events copy and cancel what it cannot replace;
  - a first sign-in schedules nothing until the next launch;
  - pending reminders survive sign-out.
- Seeding with `sim dates` fires date-change pushes to the partner.
