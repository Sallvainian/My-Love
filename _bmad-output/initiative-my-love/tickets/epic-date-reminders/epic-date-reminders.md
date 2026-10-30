---
type: epic
title: "Date Reminders"
parent: initiative-my-love
covers: []
sources: [AGENTS.md, supabase/migrations/20260922000000_local_data_tables.sql, supabase/migrations/20260818000002_create_events_table.sql, supabase/migrations/20260923020000_couple_settings.sql, supabase/migrations/20260924000000_birthdays_wedding_date.sql, src/utils/countdownService.ts, src/components/RelationshipTimers/BirthdayCountdown.tsx]
companions: []
after: []
risk: medium
---

# Date Reminders

## Description

The app shows countdowns to events, anniversaries, the relationship start, the wedding date and both partners' birthdays, but it reminds nobody. When this epic is done, the native iOS shell schedules local reminders on the phone: one the day before every date, one a month before and one a week before for dates the person marks for the countdown, and one on the day itself for anniversaries and birthdays. All of them fire at a fixed morning time, need no network, and can be switched off in Settings. The owner asked for this on 2026-10-29, together with the pushes in the sibling epic, epic-push-notifications.

## Outcome

Before each date, the person gets a 9:00 reminder on their iPhone, with no network needed. The signal is each reminder kind firing on the device with its clock moved ahead.

## Requirements

R1 (owner request 2026-10-29): Every date (each event, the person's own anniversaries, the relationship start, the wedding date and both partners' birthdays) gets one reminder the day before, reading "Tomorrow:" and the date's name; yearly dates remind every year, an event once. Met when, with the device clock set before each kind of date, its day-before reminder fires.

R2 (owner request 2026-10-29): A date marked for the countdown also gets a reminder one month and one week before; a reminder whose moment has already passed is never shown. Met when a marked date fires all three and a date marked five days ahead fires no month or week reminder.

R3 (owner request 2026-10-29): Anniversaries (the wedding date and the relationship start among them) and both birthdays also get a reminder on the day itself. Met when each fires on its day.

R4 (owner request 2026-10-29): The person can mark or unmark each date for the countdown; the mark is theirs alone, the same on each of their devices, kept across a reinstall, and every date starts unmarked. Met when marking on one device adds the month and week reminders there and on another device at its next open, and the partner's reminders do not change.

R5 (owner request; decision 2026-10-29): Every reminder fires at 9:00 in the device's local time. Met when each R1–R3 reminder fires at 9:00.

R6 (owner request 2026-10-29): A Settings switch in the shell turns all date reminders on or off for the person, on until changed; off cancels every scheduled reminder and on schedules them again. Met when off leaves none scheduled and on restores them.

R7 (owner request 2026-10-29): Reminders fire with no network, from the dates the app last loaded. Met when a reminder fires in airplane mode.

R8 (owner decision 2026-10-29): Anniversary reminders go only to the anniversary's creator. Met when the partner's device schedules none for it.

R9 (owner decision 2026-10-29; AGENTS.md sign-out): Sign-out cancels every date reminder on the device. Met when none is scheduled after sign-out.

R10 (owner request 2026-10-29): Nothing notifies for the daily message. Met when no scheduled reminder names it.

R11 (owner decision 2026-10-29): Tapping a reminder opens Home. Met from a cold start and from the background.

R12 (AGENTS.md native iOS shell): The website, the Home Screen web app and a shell installed before this epic keep working unchanged, including after that older shell takes the new web code by live update. Met when an older shell updated to the new bundle, the website and the web app run with no error.

## Constraints

- iOS keeps 64 scheduled reminders per app. On every app launch and every return to the foreground, on sign-in, and whenever a date is added, changed or deleted, the app cancels all date reminders and schedules only the soonest 64; reminders past the 64th are scheduled on a later open, once they move into the soonest 64. No background task or other mechanism is added (owner decision 2026-10-29).
- Anniversary and birthday reminders come from the same next-occurrence logic as Home's countdowns (`getNextAnniversaryDate`, `getNextBirthday`), and `YYYY-MM-DD` strings are parsed with `parseEventDate`, so those reminders never disagree with their cards (AGENTS.md, Conventions). Home has no yearly logic for the other two: the relationship start counts up (`TimeTogether.tsx`) and is a date and time, and the wedding card retires once the date passes (`EventCountdown.tsx`). So the relationship start recurs on its calendar date in the device's time zone, and the wedding date reminds as a one-off before the wedding and yearly after it.
- A re-plan runs only from loaded local copies or a successful read, never from a copy not yet loaded or a failed read, so it never cancels reminders it cannot replace (AGENTS.md, Known pitfalls: only a successful read overwrites a snapshot).
- Events come from the loaded events window, the soonest 50 upcoming (`eventsService.ts`); an event past it is planned once earlier ones pass and the window moves.
- Countdown marks are per-account offline data: a new `localCopy` kind, removed by `deleteAccountData()`, with their store state in `signedOutState()`, in the same commit (AGENTS.md, Known pitfalls).
- A new public table enables RLS in its creating migration with policies `TO authenticated`, and the pgTAP `policies_are` files are edited in the same change (AGENTS.md, Known pitfalls).
- Web code calls the local-notification plugin only after `Capacitor.isPluginAvailable`, because older shells lack it (AGENTS.md, native iOS shell).
- Reminders use the same lock-screen group as epic-push-notifications' non-love-note pushes; that group's name is the one contract between the two epics.
- The repo is public: evidence comes from the fictional fixture accounts (AGENTS.md, Policy).

## Done when

1. On the owner's iPhone, with the device clock moved ahead, a day-before reminder fires at 9:00 for each kind of date, in airplane mode too; marked dates add the month and week reminders; anniversaries and birthdays also fire on the day; nothing names the daily message; and tapping a reminder opens Home (R1, R2, R3, R5, R7, R10, R11).
2. Marking and unmarking changes that person's reminders on each of their devices and not the partner's, and the switch turned off leaves no reminder scheduled (R4, R6, R8).
3. With more than 64 reminders due, the soonest 64 are scheduled and later ones appear after a later open; after sign-out none is scheduled (Constraints, R9).
4. An older shell updated by live update, the website and the Home Screen web app still work (R12).
5. The web part ships through `deploy.yml`, the new shell is installed on the owner's iPhone, and CI is green on main.

## Boundaries

- Pushes and their six switches belong to epic-push-notifications.
- No notification for the daily message.
- A reminder time the person chooses, reminder offsets other than the four kinds, and a per-device switch.
- The partner's anniversaries, which are private to their creator.
- Touch point: Settings — epic-push-notifications adds its six push switches there too; owner: epic-date-reminders for the reminders switch and the countdown marks.
- Must not change: Home's countdown cards and their dates.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md (no Requirements yet, so this epic cites the owner's request and the code directly)
- code — src/utils/countdownService.ts, `getNextAnniversaryDate`; src/components/RelationshipTimers/BirthdayCountdown.tsx, `getNextBirthday`
- code — supabase/migrations/20260922000000_local_data_tables.sql, anniversaries policies (owner-only)
- project-context — AGENTS.md, Conventions; Known pitfalls; Maintained by hand (native iOS shell, sign-out)
- companion — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/sim-driver-prototype/ (the simulator runner story 2.9 ports; `Runner/App.swift`'s pending-notification probe is the evidence story 7 builds on)
- sibling — _bmad-output/initiative-my-love/tickets/epic-push-notifications/epic-push-notifications.md; _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/epic-iphone-duo-native-tab-bar.md (story 2.9)

## Notes

- Decision: 2026-10-29 split from the owner's notifications request as its own epic beside epic-push-notifications; owner approved.
- Decision: 2026-10-29 anniversary reminders go only to their creator, because anniversaries are private to the creator.
- Decision: 2026-10-29 countdown marks are each person's own, kept on the account; every date starts unmarked.
- Decision: 2026-10-29 the fixed morning time is 9:00 local time.
- Decision: 2026-10-29 the 64-reminder re-plan in Constraints is the whole scheduling rule; sign-out cancels every reminder.
- Decision: 2026-10-29 owner added a Settings switch for all date reminders.
- Decision: 2026-10-29 the wedding date and the relationship start count as anniversaries and remind on the day; tapping a reminder opens Home.
- Decision: 2026-10-29 the reminders switch is kept on the account like the push switches, and the switch and the countdown marks show only in the shell, since nothing else uses them.
- Decision: 2026-10-29 this epic is sliced after epic-push-notifications.
- Waits on epic-push-notifications because: iOS has one notification permission for pushes and local reminders, and story 3.1 owns its prompt. The marks list and the reminders switch join story 3.7's Settings section, and the switch is stored in its table. Reminders use the lock-screen group name story 3.8 sets for non-love-note pushes. A reminder tap reuses story 3.9's navigation. The push sweep (3.10) and device install (3.11) share the Settings section, the native code and the owner's iPhone. Story 7 waits on story 3.12, because both change story 2.9's driver and its host app, and on the push sweep (3.10), which may change the driver too.
- Decision: 2026-10-30 the relationship start recurs yearly on its calendar date in the device's time zone, as "Our anniversary". The wedding date is a one-off "Wedding day" before the wedding and a yearly "Wedding anniversary" after it.
- Decision: 2026-10-30 story 4.1 waits on the push and tab bar sweeps (3.10, 2.4), and story 4.5 waits on their ship stories (3.11, 2.5), so this epic builds after epics 2 and 3; the waits on 2.4 and 2.5 were lifted later the same day (below).
- Decision: 2026-10-30 the owner split story 1 by layer. Story 1 is the planner: dates in, day-before and on-the-day reminders out, sorted and cut at 64, and scheduled through the plugin at launch. Story 6 holds the re-plan triggers (foreground, sign-in, date change, loaded data only), the sign-out cancel, the lock-screen group and tap-to-Home.
- Decision: 2026-10-30 story 6 follows story 1 because together they are the old story 1 the owner split, and story 2 extends the scheduling module story 6 finishes. Story 2's cross-device marks are the least certain part, and the order still puts them third, since they plan from story 6's re-plan triggers.
- Decision: 2026-10-30 tracer bullet is story 1. Build order is 1, 6, 2, 3, then the refactor sweep (4), then the ship story (5), which runs after the sweep as in the sibling epics. No shell with the plugin is installed before story 5, so the sign-out cancel arriving in story 6 leaves no gap on a device.
- Decision: 2026-10-30 stories 4.1 and 4.5 no longer wait on stories 2.4 and 2.5: after its replan the Duo epic is a web change shipped by live update, so its sweep and ship share neither the Xcode project nor a shell install with this epic. If its story 2.7 finds the side column needs native code, 4.1 waits on 2.4 and 4.5 on 2.5 again, with epic 2 back in this epic's `after` in the initiative breakdown. 4.1 still starts after story 2.7, through 3.1, so that answer is known in time. Supersedes the 2026-10-30 collision decision for epic 2; the waits on 3.10 and 3.11 stand.
- Decision: 2026-10-30 story 2.7 found the side column needs no native code, so 4.1 and 4.5 do not wait on 2.4 and 2.5; epic 2 returns to this epic's `after` in the initiative breakdown only for story 2.9's simulator driver, which story 7 extends.
- Decision: 2026-10-30 replanned so a bmad-loop run builds stories 7, 1, 6, 2, 3 and 4 with no person. What is required is unchanged; only how it is checked. Another session found the simulator's pending local notifications readable from the Mac in `PendingNotifications.plist` (an NSKeyedArchiver archive in the simulator's UserNotifications folder, mapped to bundle ids by `Library.plist`); new story 7 adds a reader for it to story 2.9's driver, proven against requests it schedules itself because the format is private and can change between iOS releases. The unattended stories check the scheduled list through it.
- Decision: 2026-10-30 a reminder firing at 9:00, in airplane mode, and a reminder tap opening Home move to new hitl story 8, before the sweep: the simulator's clock follows the Mac's, so no session can move it unattended. Story 5 stays hitl as the device backstop (owner decision, with the constraint that simulator checks are trusted for the shell only).
- Decision: 2026-10-30 the loop's simulator checks run against the local stack with local fixture accounts, never production (owner decision).
- Decision: 2026-10-30 build order is 7, 1, 6, 2, 3, 8, 4, 5. Story 7 comes before the tracer (story 1) because it is check tooling the tracer's unattended check reads through; story 1 stays the tracer.
- Decision: 2026-10-30 story 7 waits on story 2.4 and story 3.10 as well as 3.12, because the Duo and push sweeps may change the driver it extends; it costs nothing on the longest chain, since story 1 already waits on 3.10.
- Decision: 2026-10-30 the dependence on story 7's reader is not an `unknown` on stories 1, 6, 2 and 3, because an `unknown` holds the loop before a story starts; if story 7 cannot read a calendar trigger, its build blocks and those stories' scheduled-list checks move to story 8 in a re-slice.
- Decision: 2026-10-30 the older-shell live-update check in stories 1 and 6 uses story 2.9's driver, which builds a shell from an earlier commit and serves the working tree's bundle as its live update.
