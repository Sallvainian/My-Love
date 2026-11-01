---
type: epic
title: "Push Notifications"
parent: initiative-my-love
covers: []
sources: [AGENTS.md, supabase/migrations/20260922000000_local_data_tables.sql, supabase/migrations/20260818000002_create_events_table.sql, supabase/migrations/20260923020000_couple_settings.sql, supabase/migrations/20260924000000_birthdays_wedding_date.sql, supabase/migrations/20251206024345_remote_schema.sql, src/stores/slices/navigationSlice.ts, ios/App/App/AppDelegate.swift, .github/workflows/deploy.yml]
companions: []
after: []
risk: high
---

# Push Notifications

## Description

Today a partner sees the other's mood, love note, photo, poke or kiss only while the app is open, through Realtime. The native iOS shell has no push entitlement, no push code in `AppDelegate.swift` and no notification plugin. When this epic is done, the shell receives a push on the partner's phone for each of those actions, for date changes the partner can see, and for partner requests. Settings has a switch for each type. Love notes stack as their own lock-screen group, and the app icon badge counts unread love notes. The owner asked for this on 2026-10-29. The date reminders from the same request are the sibling epic, epic-date-reminders.

## Outcome

Each partner's iPhone shows a push within seconds when the other acts, and turning a type off in Settings stops it. The signal is each push type arriving on a test account's device and stopping when its switch is off.

## Requirements

R1 (owner request 2026-10-29): When someone logs a mood, sends a love note, adds a photo, sends a poke or a kiss, or adds or changes an event, the wedding date, the relationship start or their own birthday, a push reaches every iOS shell signed in to their partner's account and none reaches the sender's own devices; a love note queued offline pushes when it reaches the server. Met when each action on one test account shows its push on the partner's device and nothing on the sender's.

R2 (owner request 2026-10-29): Sending a partner request pushes to the person asked, and accepting one pushes to the person who sent it. Met when both steps show their push on the other person's device.

R3 (owner request 2026-10-29): Settings in the shell has an on/off switch per push type (moods, love notes, photos, pokes and kisses, dates, partner requests), each on until changed and kept on the account; a type switched off sends that person no push on any of their devices. Met when turning each switch off stops its push and turning it on restores it.

R4 (owner request 2026-10-29): Love-note pushes stack as their own group on the lock screen, apart from every other push. Met when a lock screen holding both kinds shows two stacks.

R5 (owner request 2026-10-29; owner decision 2026-10-30): The app icon badge shows how many partner love notes arrived since the person last opened Love Notes on any of their devices, the count every push carries, and opening Love Notes clears it; opening Love Notes on the website or the Home Screen web app counts too, so reading notes there lowers the next push's count. Met when two notes show 2, opening Love Notes clears it, the next note shows 1, and after opening Love Notes on the website the next note shows 1 again.

R6 (owner decision 2026-10-29): Tapping a push opens its view: Love Notes for a note, Partner for a mood, a poke, a kiss or a partner request, Photos for a photo, Home for a date. Met when each type's tap lands on its view from a cold start and from the background.

R7 (owner decision 2026-10-29): A love-note push shows the sender's name and the note's text (a picture-only note says a picture was sent), a mood push names the mood, every other push names the sender and the action, and no push carries an image. Met when each type's text reads so on the device.

R8 (owner decision 2026-10-29): While the app is open in the foreground an arriving push shows no banner, and the badge still updates. Met when a note arriving with the app open shows no banner and the badge count rises.

R9 (owner decision 2026-10-29): The shell asks for notification permission once, on the first signed-in launch of a shell built from this epic; if the person declines, Settings says notifications are off in iOS Settings. Met when a fresh install asks once and a declined permission shows that message.

R10 (owner decision 2026-10-29; AGENTS.md sign-out): Sign-out stops the outgoing account's pushes to that device and clears its badge, and the next account signed in there receives only its own. Met when, after sign-out and sign-in as another account, the first account's partner acting shows nothing on that device.

R11 (AGENTS.md native iOS shell; owner decision 2026-10-30): The website, the Home Screen web app and a shell installed before this epic keep working with nothing visible changed (the website and the web app write R5's marker in the background), including after that older shell takes the new web code by live update, and none shows the push switches. Met when an older shell updated to the new bundle, the website and the web app run with no error and no switches.

## Constraints

- The APNs signing key lives in fnox and as a Supabase secret, never in `.env` or source (AGENTS.md, Policy).
- Push is a native change: the shell needs a reinstall, and web code calls a notification plugin only after `Capacitor.isPluginAvailable` (AGENTS.md, native iOS shell).
- The badge count and the lock-screen group come in the push the server sends, because iOS applies them on delivery while the app is not running (R4, R5).
- A retried write sends one push: retryable inserts reuse one client key with `ignoreDuplicates` (AGENTS.md, Known pitfalls), and an ignored duplicate sends no second push.
- A new public table enables RLS in its creating migration with policies `TO authenticated`, and the pgTAP `policies_are` files are edited in the same change (AGENTS.md, Known pitfalls).
- `deleteAccountData()` runs after `supabase.auth.signOut()` has ended the session, so it cannot remove a server row. Sign-out removes the device's registration before the session ends. The device unregisters from APNs natively on every sign-out and on a boot with no session, and the sender deletes the registrations APNs reports as gone. The switches' store state is in `signedOutState()` (AGENTS.md, Known pitfalls).
- A failed or slow push never fails or delays the write that triggered it.
- Each registration records its APNs environment: an Xcode development install gets sandbox tokens, which a production APNs send rejects, so the sender sends to the environment the registration names.
- Delivery is checked on the simulator and on devices; CI cannot reach APNs, so automated tests stop at the push a send would deliver.
- The repo is public: no device tokens, real names or account data in commits or `_bmad-output/`; evidence comes from the fictional fixture accounts (AGENTS.md, Policy).
- Every Edge Function in `supabase/functions` ships from `deploy.yml`, in a step after migrations and before the site deploy, never by hand (owner decision 2026-10-29).

## Done when

1. On two devices signed in to a linked pair of test accounts, each R1 and R2 action shows its push on the other device with the R7 text, and turning its switch off stops it (R1, R2, R3, R7).
2. Love notes stack apart from other pushes, the badge counts unread notes and clears when Love Notes opens, and tapping each push type opens its view (R4, R5, R6).
3. After sign-out a device receives none of that account's pushes and shows no badge (R10).
4. An older shell updated by live update, the website and the Home Screen web app still work and show no push switches (R11).
5. The migrations and every Edge Function ship through `deploy.yml`, the new shell is installed on the owner's iPhone, and CI is green on main.

## Boundaries

- Web push for the website or the Home Screen web app.
- Date reminders and their Settings switch belong to epic-date-reminders.
- No push for anniversaries (private to their creator), for deleting anything, for the daily message, or for the fart animation, which never reaches the server.
- Images in pushes, which need a Notification Service Extension.
- Quiet hours and per-device switches.
- The dock's badges (DW-327).
- Touch point: Settings — epic-date-reminders adds its reminders switch there too; owner: epic-push-notifications for the six push switches.
- Touch point: `ios/App/App/AppDelegate.swift` and the shell's native code — owner: epic-push-notifications; epic-date-reminders adds its local-notification plugin there, and epic-iphone-duo-native-tab-bar does not change it (its story 2.7 found no native code is needed).
- Touch point: `.github/workflows/deploy.yml` — its functions-deploy step; owner: epic-push-notifications.
- Must not change: in-app live delivery through Realtime and the arriving-note haptic.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md (no Requirements yet, so this epic cites the owner's request and the code directly)
- code — supabase/migrations/20260922000000_local_data_tables.sql, anniversaries policies (owner-only)
- code — supabase/migrations/20251206024345_remote_schema.sql, `interactions_type_check` (poke and kiss only)
- code — src/stores/slices/navigationSlice.ts, `ViewType` (R6 views)
- project-context — AGENTS.md, Policy; Known pitfalls; Maintained by hand (native iOS shell, sign-out)

## Notes

- Decision: 2026-10-29 the owner's single notifications epic is split into this epic and epic-date-reminders; owner approved.
- Decision: 2026-10-29 no push for anniversaries: they are private to their creator, and making them couple-shared is out of this epic.
- Decision: 2026-10-29 the dates that push are the ones the partner can read: events, the wedding date, the relationship start and the sender's own birthday, on add or change; deletions push nothing.
- Decision: 2026-10-29 a love-note push shows the note's text, and iOS's Show Previews setting governs the lock screen; a mood push names the mood; no images.
- Decision: 2026-10-29 permission is asked on the first signed-in launch of the new shell; if declined, Settings points to iOS Settings.
- Decision: 2026-10-29 six switches (moods, love notes, photos, pokes and kisses, dates, partner requests), all on until changed, kept on the account; the receiver's switch decides.
- Decision: 2026-10-29 pushes go to every iOS shell signed in to the receiver's account; the website and the Home Screen web app get none.
- Decision: 2026-10-29 with the app in the foreground no banner shows; two lock-screen stacks, love notes and everything else.
- Decision: 2026-10-29 no workflow deployed Edge Functions; `deploy.yml` gets a functions-deploy step after migrations and before the site deploy, covering every function in `supabase/functions`, never by hand.
- Parked: the Love Notes dock badge (DW-327) could use the R5 count; out of this epic.
- Unknown: whether a database trigger reaches the sender Edge Function on both the local stack and the hosted project. Story 1 answers it for the local stack and story 13 for the hosted project; if it does not, stories 4, 5 and 6 are re-sliced.
- Decision: 2026-10-29 tracer bullet is story 1: a love note pushes to the partner's simulator through the trigger, the sender and APNs. Sign-out (story 2) follows at once, so no shell that can receive pushes leaks them across accounts.
- Decision: 2026-10-29 stories 1, 2, 4, 5, 6, 7, 8 and 9 run in one ordered sequence, because each extends the sender or the web-side push module. Story 3 waits on story 1, so its first run deploys the sender. Story 11 runs after the refactor sweep, as in epic-iphone-duo-native-tab-bar, so the cleaned-up code is what ships.
- Decision: 2026-10-29 the set check's suggestion to move story 4 to after story 1 is declined: story 2 also changes the sender, which story 4 extends.
- Decision: 2026-10-29 a love note that arrives while Love Notes is on screen counts as read, so the badge stays clear (fills a gap in R5).
- Decision: 2026-10-29 sign-out removes the registration before the session ends, unregisters from APNs natively, and lets the sender delete gone registrations. Story 2 proves on a device that a sign-in after an offline sign-out re-registers, and that a sign-in by another account stops the previous account's pushes, because Apple discourages `unregisterForRemoteNotifications`.
- Decision: 2026-10-30 the waits on epic-iphone-duo-native-tab-bar repointed after its replan dropped stories 2.1 and 2.3. Story 3.1 waits on story 2.7 instead of 2.1: it builds on 2.7's live-update simulator setup, adding a web build and fixture pair on the local stack, and 2.7 answers whether the side column needs native code before 3.1 starts; if it does, 3.1 also waits on story 2.2, which then changes the Xcode project too. Story 3.9 loses `"2.3"`: the dock marks the view on screen from `currentView`, so a push tap that navigates through `navigationSlice` marks it with nothing extra.
- Decision: 2026-10-30 story 3.9 gets no wait on story 2.2, though both may change `App.tsx`: the owner builds one epic at a time, so 2.2 is done before 3.9 starts.
- Decision: 2026-10-30 story 2.7 found the side column needs no native code, so story 3.1 does not wait on 2.2 and epic 4 does not get epic 2 back in its `after`.
- Decision: 2026-10-30 replanned so a bmad-loop run builds stories 12, 1, 2 and 4–10 with no person: another session drove the iPhone Duo simulator (iOS 27.1) through an XCUITest runner, tapping SpringBoard's permission alert, reading a `simctl push` banner, a Notification Center group and the badge, and opening the app by a banner tap from a cold start and the background. What is required is unchanged; only how it is checked. New story 12 adds those steps to story 2.9's driver; the simulator stories check the payload the sender builds, delivered with `xcrun simctl push`, and no longer need a person. Stories 3 and 11 stay hitl.
- Decision: 2026-10-30 real APNs delivery, the hosted half of the trigger Unknown and story 2's device proofs move to new hitl story 13, right after story 3 and before story 4, so the risk still surfaces before the other push types build on the sender; supersedes the 2026-10-29 decision that story 2 proves them itself. The owner creates the APNs key there, so story 1 needs no person. Story 4's `unknown` is cleared once story 13's plan records the hosted trigger working.
- Decision: 2026-10-31 story 4's `unknown` is cleared: story 1 recorded the trigger reaching the sender on the local stack, and story 13's plan records it on the hosted project (a note sent from the website as Claude Partner arrived on the owner's iPhone through APNs). Stories 4, 5 and 6 keep their slicing.
- Decision: 2026-10-30 simulator checks are trusted for the shell only (owner constraint, from story 2.7's simulator-against-Duo differences); no unattended story checks Safari or the Home Screen web app on a simulator, and story 11 stays the device backstop.
- Decision: 2026-10-30 the loop's simulator checks run against the local stack with local fixture accounts, never production (owner decision).
- Decision: 2026-10-30 build order is 12, 1, 2, 3, 13, 4–9, 10, 11. Story 12 comes before the tracer (story 1) because it is check tooling the tracer's unattended check runs through; story 1 stays the tracer. Supersedes the 2026-10-30 line above where it says story 3.1 adds a web build and fixture pair on the local stack: story 2.9 owns both.
- Decision: 2026-10-30 a run's shape follows from the loop merging into `loop/integration`, never main: a loop run builds 12, 1 and 2; they reach main through the loop's PR, which the owner merges; a person runs 3 and 13 against production; a second run builds 4–10; a person runs 11.
- Decision: 2026-10-30 story 12 waits on story 2.4 as well as 2.9, because the Duo sweep may change the driver it extends.
- Decision: 2026-10-30 with no APNs key, the sender records the request it would have sent and the driver delivers that payload with `xcrun simctl push`, so the simulator checks cover the trigger path, not only the payload builder.
- Decision: 2026-10-30 story 1 is kept whole as the tracer, though the replan's additions (the recorded request, the insert-never-fails check, the per-registration APNs environment, the sender's tests in CI) make it long against the loop's 2M-token story budget; a split into a thin tracer and a hardening story was proposed and declined by the owner.
- Decision: 2026-10-30 story 1 owns the sender's `[functions]` section in `supabase/config.toml` (none exists today), because it is the first story to run the sender locally; story 3 adds `upload-love-note-image`'s section with `verify_jwt = true`, as the hosted project reports it. Story 3's check compares the Management API's function list (version and `verify_jwt`) before and after the first run, since `supabase functions list` prints no settings.
- Decision: 2026-10-30 story 7's Settings section is named "Push and reminders", so it is not confused with the notifications page in _bmad-output/backlog/story-native-shell-live-update-prompt.md.
- Decision: 2026-10-30 `bmad-ux` declined for the Settings "Push and reminders" section (owner decision); stories 7, 4.2 and 4.3 follow these layout rules instead:
  - Place: a section headed "Push and reminders", shown only in the shell, between Photos and About in `Settings.tsx`. Every row is a general switch row (icon tile, label, one-line helper, `role="switch"`) that story 7 extracts from `MobileDataPhotosRow` (`Settings.tsx`), which is hard-wired to the mobile-data setting; `MobileDataPhotosRow` then renders through it unchanged.
  - Pushes group, first, in this order: Love notes, Moods, Photos, Pokes and kisses, Dates, Partner requests. Love notes leads because it has its own lock-screen group and the badge.
  - Reminders group, second: story 4.3's "Date reminders" switch, then story 4.2's marks list, one row per date under the name its Home card uses, each with a "Remind me a month and a week before" switch.
  - Declined permission: one notice at the top of the section, above both groups: "Notifications are off for My Love. Turn them on in iOS Settings." The switches stay usable, because they are kept on the account and apply to its other devices.
  - Wording: labels are sentence case and name the thing, with no "Notify me"; helpers say when it arrives, with "your partner" and never a name (for example, "When your partner sends a note.").
- Decision: 2026-10-30 R5 and R11 re-derived (owner decision): opening Love Notes on the website or the Home Screen web app writes the last-opened marker in the background, and R11's "unchanged" means nothing visible changes. Story 8 writes the marker from every surface.
- Decision: 2026-10-30 layout rule "Place" corrected (owner approved): `MobileDataPhotosRow` reads and writes one fixed setting, so story 7 first extracts a general switch row from it, which stories 7, 4.2 and 4.3 build on, and `Settings.mobileDataPhotos.test.tsx` passes unchanged.
- Decision: 2026-10-31 new story 14 after story 12 (owner request). Story 12's `sim center` reads Notification Center's groups reliably only when they all fit on one screen: scrolling to older groups did not work, and the owner checked the 8-group case (threads A–H) by hand. On the iPhone Duo simulator, unfolded and in portrait, all 8 fit on one screen (owner's observation). So story 14 has `center` unfold the Duo and turn it to portrait before it reads, put the pose and orientation back afterwards, and read 8 groups with no person; it also shows XCUITest taps reach SpringBoard on the inner display, which story 2.7 found AXe taps do not. What is required is unchanged; only how the check is made. Story 12 is in progress in a bmad-loop run, so its entry and plan stay as they are, and its description does not name the handoff to story 14.
- Decision: 2026-10-31 story 14 amended (coordinator, from story 12's uncommitted dev work): story 12's `sim center` now refuses to run unless `ax state` reads `pose: closed` and `orientation: portrait`, because unfolded or rotated its drag from the top misses and Notification Center never opens, and `sim help` says "Needs the device folded and in portrait." So story 14 also removes or replaces that guard, makes the drag open Notification Center on the inner display in portrait (the owner did so by hand, so it can be done), and updates `sim help`'s center line.
- Decision: 2026-10-31 story 14 amended (owner, through the coordinator, from story 12's uncommitted `Notify.swift`): `skipIdleWaits()` replaces the private `XCUIApplicationProcess` methods `shouldSkipPreEventQuiescence` and `shouldSkipPostEventQuiescence` to avoid XCUITest's 60 s quiescence waits, and does nothing when the class or either method is missing, so on a future Xcode `center` would run for minutes or hang with no explanation. Story 14 makes that loud: the driver warns that idle waits cannot be skipped on this Xcode and runs will be slow, and its check shows the warning with a name that does not exist and none with the real names.
- Unknown: whether XCUITest can open Notification Center and tap SpringBoard on the Duo's inner display (story 12's drag did not open it there; story 2.7 found AXe taps do not reach that display; story 2.9 proved XCUITest taps there only inside the web view). Story 14 answers it while it builds; if XCUITest cannot, it stops and is re-sliced.
- Decision: 2026-10-31 the Unknown above is not story 14's `unknown` field, which would hold it out of an unattended run until a person settled it; building the story is the check.
- Decision: 2026-10-31 build order is 12, 14, 1, 2, 3, 13, 4–9, 10, 11 (owner asked for story 14 after story 12): story 1 waits on 14 instead of 12, because both may change `scripts/sim-driver/sim` and only one Duo story runs at a time; story 10 also waits on 14. The first loop run builds 12, 14, 1 and 2. The set check suggested 12, 1, 14, 2 instead, so that story 1, the tracer, is not held behind a tooling story that may stop for a re-slice, and because story 1's check does not use `center`; kept the owner's order, open to the owner. Supersedes the 2026-10-30 lines that list the build order (12, 1, 2, 3, 13, 4–9, 10, 11), the stories a loop run builds (12, 1, 2 and 4–10), and the run shape (a loop run builds 12, 1 and 2), where they list them.
