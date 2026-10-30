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

- iOS keeps 64 scheduled reminders per app. On every app open, on sign-in, and whenever a date is added, changed or deleted, the app cancels all date reminders and schedules only the soonest 64; reminders past the 64th are scheduled on a later open, once they move into the soonest 64. No background task or other mechanism is added (owner decision 2026-10-29).
- Reminder dates come from the same next-occurrence logic as Home's countdowns (`getNextAnniversaryDate`, `getNextBirthday`), and `YYYY-MM-DD` strings are parsed with `parseEventDate`, so a reminder never disagrees with its card (AGENTS.md, Conventions).
- Countdown marks are per-account offline data: a new `localCopy` kind, removed by `deleteAccountData()` in the same commit (AGENTS.md, Known pitfalls).
- Web code calls the local-notification plugin only after `Capacitor.isPluginAvailable`, because older shells lack it (AGENTS.md, native iOS shell).
- Reminders use the same lock-screen group as epic-push-notifications' non-love-note pushes; that group's name is the one contract between the two epics.
- The repo is public: evidence comes from the fictional fixture accounts (AGENTS.md, Policy).

## Done when

1. On the owner's iPhone, with the device clock moved ahead, a day-before reminder fires at 9:00 for each kind of date, marked dates add the month and week reminders, and anniversaries and birthdays also fire on the day (R1, R2, R3, R5).
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
- Waits on epic-push-notifications because: iOS has one notification permission for pushes and local reminders, and story 3.1 owns its prompt; the reminders switch joins story 3.7's Settings section; and reminders use the lock-screen group name that story 3.8 sets for non-love-note pushes.
