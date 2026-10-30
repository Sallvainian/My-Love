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

R5 (owner request 2026-10-29): The app icon badge shows how many partner love notes arrived since the person last opened Love Notes on any of their devices, the count every push carries, and opening Love Notes clears it. Met when two notes show 2, opening Love Notes clears it, and the next note shows 1.

R6 (owner decision 2026-10-29): Tapping a push opens its view: Love Notes for a note, Partner for a mood, a poke, a kiss or a partner request, Photos for a photo, Home for a date. Met when each type's tap lands on its view from a cold start and from the background.

R7 (owner decision 2026-10-29): A love-note push shows the sender's name and the note's text (a picture-only note says a picture was sent), a mood push names the mood, every other push names the sender and the action, and no push carries an image. Met when each type's text reads so on the device.

R8 (owner decision 2026-10-29): While the app is open in the foreground an arriving push shows no banner, and the badge still updates. Met when a note arriving with the app open shows no banner and the badge count rises.

R9 (owner decision 2026-10-29): The shell asks for notification permission once, on the first signed-in launch of a shell built from this epic; if the person declines, Settings says notifications are off in iOS Settings. Met when a fresh install asks once and a declined permission shows that message.

R10 (owner decision 2026-10-29; AGENTS.md sign-out): Sign-out stops the outgoing account's pushes to that device and clears its badge, and the next account signed in there receives only its own. Met when, after sign-out and sign-in as another account, the first account's partner acting shows nothing on that device.

R11 (AGENTS.md native iOS shell): The website, the Home Screen web app and a shell installed before this epic keep working unchanged, including after that older shell takes the new web code by live update, and none shows the push switches. Met when an older shell updated to the new bundle, the website and the web app run with no error and no switches.

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
- The dock and native tab bar badges (DW-327).
- Touch point: Settings — epic-date-reminders adds its reminders switch there too; owner: epic-push-notifications for the six push switches.
- Touch point: `ios/App/App/AppDelegate.swift` and the shell's native code — also changed by epic-iphone-duo-native-tab-bar.
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
- Parked: the Love Notes dock and tab bar badge (DW-327) could use the R5 count; out of this epic.
- Unknown: whether a database trigger reaches the sender Edge Function on both the local stack and the hosted project. Story 1 answers it; if it does not, stories 4, 5 and 6 are re-sliced.
- Decision: 2026-10-29 tracer bullet is story 1: a love note pushes to the partner's simulator through the trigger, the sender and APNs. Sign-out (story 2) follows at once, so no shell that can receive pushes leaks them across accounts.
- Decision: 2026-10-29 stories 1, 2, 4, 5, 6, 7, 8 and 9 run in one ordered sequence, because each extends the sender or the web-side push module. Story 3 waits on story 1, so its first run deploys the sender. Story 11 runs after the refactor sweep, as in epic-iphone-duo-native-tab-bar, so the cleaned-up code is what ships.
- Waits on epic-iphone-duo-native-tab-bar because: story 3.1 and story 2.1 both change the Xcode project and `AppDelegate.swift`, and 3.1 reuses 2.1's test pair and local live-update setup; story 3.9 needs story 2.3's view-to-tab sync so a tapped push selects its tab.
- Decision: 2026-10-29 the set check's suggestion to move story 4 to after story 1 is declined: story 2 also changes the sender, which story 4 extends.
- Decision: 2026-10-29 a love note that arrives while Love Notes is on screen counts as read, so the badge stays clear (fills a gap in R5).
- Decision: 2026-10-29 sign-out removes the registration before the session ends, unregisters from APNs natively, and lets the sender delete gone registrations. Story 2 proves on a device that a sign-in after an offline sign-out re-registers, and that a sign-in by another account stops the previous account's pushes, because Apple discourages `unregisterForRemoteNotifications`.
