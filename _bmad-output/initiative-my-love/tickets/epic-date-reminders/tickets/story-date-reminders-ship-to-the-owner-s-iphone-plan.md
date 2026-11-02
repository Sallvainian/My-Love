---
title: "Date reminders ship to the owner's iPhone"
type: 'chore'
ticket: '5'
created: '2026-11-01'
status: 'done'
baseline_revision: '871463b0fc9fbdfc6315016a7a10485053f5d9d6'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [reviewer-subagent]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stories 7, 1, 6, 2, 3, 8 and the sweep (4) proved date reminders on the simulator against the local stack only. Nothing has fired on the owner's iPhone or planned from production data, and the shell on the phone (build 2, from `1b08965e`) predates the epic and lacks the local-notification plugin.

**Approach:** The web part has shipped: deploy run `41395344231` on `871463b0` succeeded (migrations `20261101010000` and `20261101020000` are on hosted), and `updates/latest.json` names `871463b0`. A person first checks the phone's current shell as the older shell, then installs a shell built from `main` over it and runs the story's checks on the phone with the production fixture couple, moving the device clock ahead in airplane mode. A simulator running a production build stands in for the partner's device and the owner's second device.

</frozen-after-approval>

## Result

Run by the owner with the coordinator on 2026-11-02 (05:58–07:20 UTC), against production after deploy run `41395344231` on `871463b0`.

**Older shell (R12):** the phone's shell from `1b08965e` (build 2), updated by live update to `871463b0`, ran every view with no error; Settings showed the Pushes box and no Reminders box.

**Install:** a shell built from `871463b0` (`fnox exec -- npm run ios:sync`, `xcodebuild` Debug, `CURRENT_PROJECT_VERSION=3`) installed over it with `xcrun devicectl device install app`; never uninstalled. The owner signed out of their own account and signed in as Claude Bot. Dates were set from the website: Claude Bot's event "Reminder check trip" on 2026-12-07 (marked on the phone), anniversary "Reminder check anniversary" 2023-12-07, relationship start 2021-12-07 18:00 local, wedding 2026-12-07, both birthdays 1996-12-07.

**Done when, on the owner's iPhone, airplane mode with Wi-Fi off, clock moved ahead:**
- "In a month: Reminder check trip" at 09:00 on Nov 7, "In a week: Reminder check trip" at 09:00 on Nov 30.
- Six "Tomorrow:" reminders at 09:00 on Dec 6 (the trip, the anniversary, Our anniversary, Wedding day and both birthdays), with the app terminated; a tap opened Home (cold start).
- Five "Today:" reminders at 09:00 on Dec 7 (the anniversary, Our anniversary, Wedding day, both birthdays), with the app backgrounded on Photos; a tap opened Home (background).
- None named the daily message. A birthday reads "{display name} turns 30", as Home's card does when a display name is set ("You turn" only without one).
- Date reminders switched off online, then the clock moved to Nov 7 08:59: nothing at 09:00. Switched back on (hosted `date_reminders` true), signed out, clock to Nov 7 08:59: nothing at 09:00.

**Simulator (iPhone Duo, production build, `sim pending`):** signed in as Claude Bot, it listed the trip's "In a month" and "In a week" reminders the phone's mark added (R4, second device); after sign-out its list was empty; signed in as Claude Partner, it listed 9 reminders with no "Reminder check anniversary" and no month or week reminder (R8, R4 partner).

**Website:** signed in as Claude Partner, every view loaded with 0 console errors, and Settings shows no Push and reminders section. **Home Screen web app:** not checked, by the owner's decision (2026-11-02): they do not use it.

**CI:** Tests, CodeQL, Lighthouse and Deploy succeeded on `f07ce016`.

**Fixes made in this story (owner's instruction, pushed to `main`):**
- `bbe3cd8b`, `f07ce016`: an offline cold start with an expired token sat about 25 s on the loading screen, because App waited on auth-js's refresh retries (up to 30 s). The app now opens from the stored session at once offline (after 1.5 s otherwise) and clears the loading screen as soon as a session is in hand; a sign-in redirect still waits. A review of `bbe3cd8b` found it did not clear the screen; `f07ce016` fixed that.
- `20282aa2`: Sign out ends only this device's session (owner decision 2026-11-02); `d47ea7c5` adds a "Sign out of all devices" row in Settings, refused offline. These two were pushed without review, by the owner's decision.

**Not re-run on the device:** the soonest-64 cut (the ticket's verify omits it; stories 4.1 and 4.8 proved it on the simulator).

**Cleanup (owner approved):** deleted the test event, anniversary, countdown mark and couple settings row, nulled both birthdays, and deleted three `push_devices` rows from this session (two stale Claude Bot rows, DW-384; the simulator's Claude Partner row). Read back: the fixture couple matches the state before the run. The owner signed back in to their own account; the simulator is signed out.

**Found:** DW-383 (a clock far ahead, online, loops token refreshes into a 429 and a sign-out), DW-384 (stale `push_devices` rows after a sign-out that bypasses the app).

## Implementation Notes

Oneshot: no code changes. The work is a person-run device session; this plan is its script and its record. Each production write (setting the fixture dates, the cleanup) needs the owner's approval in the session, as in story 3.11.

**Production before the run (read-only, 2026-11-01):** Claude Bot and Claude Partner have no events, anniversaries, countdown marks, birthdays or `couple_settings` row; Claude Bot's `push_preferences.date_reminders` is true, Claude Partner has no row. Cleanup returns them to exactly this.

**Session rules:**
- The owner's own account is signed out online before any fixture sign-in and signed back in at the end; the shell is never uninstalled.
- The clock moves only in airplane mode (Wi-Fi off too), and Set Automatically goes back on before the network does, so no production token refresh runs on a wrong clock.
- Evidence is words and counts only: no screenshots of real accounts, no tokens.

**Dates (T = the run day, D = T + 35):** set on the phone as Claude Bot in Settings → Countdowns unless noted: event "Reminder check trip" on D, marked for the countdown; anniversary "Reminder check anniversary" on D's month and day three years back; relationship start on D's month and day five years back; wedding date D; Claude Bot's birthday D's month and day in 1996; Claude Partner's birthday the same, set as Claude Partner on the website.

**Run order:**
1. Older shell (R12): open the phone's current shell signed in as the owner, background it once so the updater applies `871463b0`, reopen; every view loads, Settings shows no marks list and no date reminders switch.
2. Install: `fnox exec -- npm run ios:sync`, `xcodebuild` Debug with `CURRENT_PROJECT_VERSION=3`, `xcrun devicectl device install app` over the existing shell.
3. Owner signs out online, signs in as Claude Bot; set the dates above; mark the event.
4. Simulator (an iPhone 17, not the sim-driver's Duo): a production build installed by hand, notification permission allowed. Signed in as Claude Bot, `scripts/sim-driver/sim pending` lists the event's "In a month" and "In a week" beside the day-before reminders (R4, second device). Signed in as Claude Partner, it lists no "Reminder check anniversary" and no month or week reminder (R8, R4 partner).
5. Firing, airplane mode, Claude Bot: clock to D−1 month 08:58 → "In a month: Reminder check trip" at 09:00; D−7 08:58 → "In a week: Reminder check trip"; app terminated, D−1 08:58 → six "Tomorrow:" reminders (the trip, the anniversary, Our anniversary, Wedding day, Claude Partner turns N, You turn N), none naming the daily message, and a tap opens Home (cold start); app backgrounded on Photos, D 08:58 → "Today:" for the anniversary, Our anniversary, Wedding day and both birthdays, and a tap opens Home (background).
6. Switch (R6): real time, online, turn Date reminders off; airplane, D−1 08:58 → nothing at 09:00. Real time, online, turn it back on.
7. Sign-out (R9): real time, online, sign out; airplane, D−1 08:58 → nothing at 09:00. Real time, online.
8. Website and Home Screen web app (R12): headed Playwright on the website as Claude Partner, Settings shows no marks list or switch, no console errors; the owner opens their own Home Screen web app, it loads with no error.
9. Cleanup (owner approved): delete the fixture couple's test events, anniversaries, marks and `couple_settings` row, null both birthdays, sign the simulator out; the owner signs back in to their own account on the phone.

**Not re-run on the device:** the soonest-64 cut (the ticket's verify omits it; stories 4.1 and 4.8 proved it on the simulator).

**Surprises:**
- The first clock move ran online (Wi-Fi stayed on under airplane mode) and signed the phone out: DW-383. Later moves were checked offline first (no token refresh in hosted `auth.sessions`).
- iOS does not fire a calendar reminder after the clock jumps past it and back (the picker defaulted to Dec 30 on the way to Dec 6); the requests stay pending and silent until the app re-plans.
- A simulator sign-out of Claude Bot used the SDK's global scope and signed the phone out too (hosted log 06:51:54 UTC `logout?scope=global`, the phone's `/user` 403 at 06:53:07). That led to `20282aa2`.
- Expected texts in the run order said "You turn 30"; the planner and Home's card use the display name when one is set.

## Verification

**Commands:**
- `gh run list --branch main -L 6` -- expected: Tests, CodeQL, Lighthouse and Deploy succeeded on the main commit the shell is built from.
- `git status --short` -- expected: only this plan changed; `dist/` holds the `main` build.

**Manual checks:**
- Every step of the run order passes as written, recorded under a `## Result` section with times in UTC.
- Hosted, read-only after cleanup: the fixture couple matches the "Production before the run" state.
- The owner's iPhone is signed in to the owner's account, with Set Automatically on.
