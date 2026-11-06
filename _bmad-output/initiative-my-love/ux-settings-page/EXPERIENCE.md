---
name: My Love — Settings
status: final
updated: 2026-11-02
---

# My Love — Settings: Experience Spine

> Paired with `DESIGN.md`, which owns the look; its tokens are cited by path in braces, such as `{colors.accent}`. The source of every decision here is `.memlog.md`. No ticket covers this rework. Composition references: [key screens v2](mockups/key-settings-v2.html) (current) and [key screens v1](mockups/key-settings-v1.html) (collapsed bar, Dates list, event page, permission-off and one-field edit frames). **This spine wins on any conflict with a mock.** Known conflicts are named where they occur. Items the memlog left open were settled in the owner's open-item triage (keep today's behavior, or the usual iOS behavior); a rule below marked "as today" was settled that way in the triage.

## Foundation

- **Form factor.** Mobile only, on three surfaces that share one web build. (1) The iOS app (the Capacitor shell) on a regular iPhone, bottom dock. (2) The iOS app on the iPhone Duo, folded and unfolded, where the dock becomes a capsule in the side column. (3) The website in a phone browser, which has no iOS-only features.
- **People.** Two: the owner (Casey in the flows) on the iPhone Duo, and the partner (Jessie) on a regular iPhone.
- **UI system.** None beyond the app's own style kit (`src/index.css`, `src/components/shared/kitClasses.ts`, `SwitchRow`). `DESIGN.md` is the visual reference.
- **Scope.** Anything may move off the Settings page, and dates get their own pages. The bottom dock is full at five buttons, so the rework adds no dock destination.
- **Stakes.** A personal app for two people. Not regulated.

## Information Architecture

Settings is a stack of pages. Every row on a list page opens its own page, which slides in over the previous one. Settings' own bar replaces the app header on every page in the stack.

```
Settings (top page, large title)
├─ ACCOUNT
│  └─ Profile ›                 → Profile
│       ├─ Name ›               → one-field page "Name"
│       └─ Birthday ›           → one-field page "Birthday"
├─ PARTNER
│  ├─ Partner ›                 → Partner (linked / not linked / unknown)
│  └─ Dates ›                   → Dates list  [+ → Kind chooser → New event / New anniversary form]
│       ├─ TOGETHER: Together since ›, Wedding ›          → that date's page
│       ├─ BIRTHDAYS: You ›, <partner> ›                  → your birthday page / <partner>'s birthday (read-only)
│       ├─ EVENTS: upcoming events, soonest first          → event page (editable, whoever made it)
│       ├─ ANNIVERSARIES: one row per anniversary         → anniversary page
│       └─ PAST: past events, newest first, [Load more]   → event page (editable as above, no Remind me)
├─ PREFERENCES
│  ├─ Notifications ›           → Notifications   (iOS app only)
│  └─ Photos ›                  → Photos          (only where the connection type is readable)
├─ ABOUT
│  └─ Replay welcome message ›  → replays the welcome splash
└─ (no label)
   ├─ Log out
   └─ Log out of all devices    → Confirmation dialog
   Version line
```

→ Composition: top page [v2 frames 1–2](mockups/key-settings-v2.html), Dates list [v1 frame 3](mockups/key-settings-v1.html).

### Top page rows

| Row | Right-hand value | Shown when |
|---|---|---|
| Profile | Your display name. | Always. |
| Partner | The partner's name; `Not linked` only for a confirmed unlinked answer (see State Patterns). | Always. |
| Dates | Nothing. Label and chevron only. | Always. |
| Notifications | `On` when every push switch and Date reminders are on. `Off` when iOS notification permission is off, or when all of them are off. `Some` otherwise. | iOS app with the push plugins (`hasNativePush()`). Hidden on the website and in a shell installed before the plugins existed. |
| Photos | `Wi-Fi only` or `Any connection`, this device's photo-download choice. | Only on a device that reports its connection type (`canTellMobileData()`). Hidden on iPhone, in both Safari and the iOS app (UNVERIFIED on device; see Out of scope and follow-ups). |
| Replay welcome message | Nothing. | When the replay is available, as today (`onShowWelcome`). |
| Log out | Nothing, no chevron. | Always. |
| Log out of all devices | Nothing, no chevron. | Always. |

A group with no visible rows is not shown, just as today's push section renders nothing outside the iOS app. This happens to PREFERENCES on the website on an iPhone, where neither Notifications nor Photos appears.

### Ownership rules

Code facts in the memlog. Events and anniversaries are shared: both partners see, edit and delete every one, and each stays recorded under the person who added it (owner decision 2026-11-05). Together since and Wedding belong to the couple: either partner can edit them, and only a linked pair can read them. Each person sets their own birthday.

### Subpages

Remind me appears only in the iOS app (State Patterns → Reminder unavailable).

| Page | Title style | Contents |
|---|---|---|
| Profile | Large | Profile header (initial avatar, name, email), then Name › (display name) and Birthday › (your birthday, or `Not set`; it must be in the past, as today). [v2 frame 3](mockups/key-settings-v2.html). |
| Partner, linked | Large | Read-only rows: Name, Email, Linked since (the date the two were linked; the row is hidden when the link date is unknown). No actions; no unlink exists and none is added. The partner's birthday lives on the Dates list, not here. [v2 frame 4](mockups/key-settings-v2.html). |
| Partner, not linked | Large | Lead line `You aren't linked with a partner yet.`, then a `Go to Partner` row that opens the Partner view (the dock's Partner destination), where the one connect flow (search, send, accept or decline) stays. [v2 frame 5](mockups/key-settings-v2.html). |
| Partner, unknown | Large | See State Patterns → Partner unknown. |
| Dates list | Large | The `+` button at the bar's trailing edge. Groups in this order: Together (Together since, Wedding), Birthdays (yours, then the partner's), Events (both partners' upcoming events, soonest first), Anniversaries (both partners'), Past (both partners' past events, newest first, with a `Load more` row at the end when there are more, as today's bounded paging does). Past events stay listed here, though Home hides them, because the Dates list is the only place a mistyped year can be fixed. Every row shows the date on the right, as in `Sat 14 Nov` or `3 Feb 2022`, using the app's existing date formatters. An unset Together since or Wedding keeps its place and reads `Not set`. Home keeps the countdowns; the list shows dates, not countdowns. |
| Event page | Small (event name) | The same for an event either partner made: Name ›, Date ›, Note ›, Icon › (each opens a one-field page). Then the Remind me switch with Footnote `A month and a week before.` Then `Delete event` alone in its own card. [v1 frame 4](mockups/key-settings-v1.html). |
| Past event page | Small (event name) | Like the event page above, still editable by either partner, but with no Remind me switch: a reminder for a past date can never fire. |
| Anniversary page | Small (anniversary name) | Name ›, Date ›, Note › (anniversaries have no icon), the Remind me switch, and `Delete anniversary` alone in its own card. |
| Together since page | Small (`Together since`) | Date › (a date and a time, as today; either partner can set it), the Remind me switch. No clear, as today. |
| Wedding page | Small (`Wedding`) | Date › (either partner can set it), the Remind me switch, then the clear row: a centered Danger action row, `Clear` (today's word), alone in its own card, which sets the wedding date back to `Not set` and returns to the Dates list. Shown only while a date is set. |
| Your birthday page | Small (`Your birthday`) | Date › (opens the same one-field page as Profile → Birthday; must be in the past), the Remind me switch. No clear, as today. |
| Partner's birthday page | Small (`<Partner>'s birthday`, for example, `Jessie's birthday`) | A read-only Date row, Footnote `Jessie sets this in their Profile.` (partner's name substituted), then the Remind me switch. [v2 frame 6](mockups/key-settings-v2.html). |
| One-field edit page | Small (the field's name) | Back arrow, Save in the bar, one field. [v1 frame 7](mockups/key-settings-v1.html). |
| New event / New anniversary | Small (`New event` / `New anniversary`) | The Form page: Cancel and Add in the bar, every field at once. Event: Name, Date, Note, Icon. Anniversary: Name, Date, Note. [v2 frame 8](mockups/key-settings-v2.html). |
| Notifications | Large | The Notice when iOS permission is off. Group `Notify me about`: Love notes, Moods, Photos, Pokes and kisses, Dates, Partner requests (six switches). Dates is the push sent when the partner adds an event or an anniversary (owner decision 2026-11-05); a change to any date sends no push. The other date notifications are the upcoming-date reminders. Group `Reminders`: Date reminders, with Footnote `At 9:00 the day before, and on the day for birthdays and anniversaries.` [v2 frame 9](mockups/key-settings-v2.html). |
| Photos | Large | The device's photo-download choice: two rows, `Wi-Fi only` and `Any connection`, with a check on the current one, saved on tap. A device preference, so it needs no connection and survives sign-out, as today. No mock exists. |

**Entry points beyond Settings.** Tapping a date card on Home opens that date's page; Home stays highlighted in the dock, and back returns to Home. Home's Upcoming Add button (`aria-label` "Add event") opens the New event form directly, skipping the Kind chooser. Today it opens Settings.

## Voice and Tone

Microcopy. Brand voice lives in `DESIGN.md` → Brand & Style. Strings below are verbatim; group labels display uppercase through `{typography.group-label}`.

**Confirmed strings**

| Where | String |
|---|---|
| Top-page groups | `Account` · `Partner` · `Preferences` · `About` · (last card has no label) |
| Top-page rows | `Profile` · `Partner` · `Dates` · `Notifications` · `Photos` · `Replay welcome message` · `Log out` · `Log out of all devices` |
| Values | `Not linked` · `On` · `Off` · `Some` · `Wi-Fi only` · `Any connection` · `Not set` |
| Profile | `Name` · `Birthday` |
| Partner, linked | `Name` · `Email` · `Linked since` |
| Partner, not linked | `You aren't linked with a partner yet.` · `Go to Partner` |
| Partner's birthday | Title `Jessie's birthday` · Footnote `Jessie sets this in their Profile.` |
| Notifications | `Notify me about` · `Love notes` · `Moods` · `Photos` · `Pokes and kisses` · `Dates` · `Partner requests` · `Reminders` · `Date reminders` · `At 9:00 the day before, and on the day for birthdays and anniversaries.` |
| Permission notice (today's) | `Notifications are off for My Love. Turn them on in iOS Settings.` |
| Push load errors (today's) | `Couldn't load your push settings.` · `offlineMessage('Push settings', 'load')` |
| Dates list | `Together` · `Together since` · `Wedding` · `Birthdays` · `You` · `Events` · `Anniversaries` · `Past` · `Load more` |
| Date pages | `Your birthday` · `Delete event` · `Delete anniversary` · `Clear` (wedding) · `Remind me` |
| Remind me footnotes | `A month and a week before.` · while Date reminders is off: `Date reminders are off. Turn them on in Notifications.` |
| Form page | `New event` · `New anniversary` · `Cancel` · `Add` · `Name` · `Date` · `Note` · `Icon` |
| Form placeholders (today's) | `e.g., Weekend trip` · `Add a note about this event...` · `e.g., First Date Anniversary` · `Add a note about this anniversary...` |
| Icon options (today's) | `Calendar` · `Ring` · `Plane` |
| One-field page | Title is the field's name · `Save` |
| Version line | `Version <app version> · made for the two of you` (unchanged; the version is `__APP_VERSION__`) |

**"Log out" replaces "Sign out" everywhere in the UI.** That covers both rows, their in-progress labels, the confirmation dialog, the offline refusal and the login screen's partial notice. The strings below are today's strings with that one substitution. "Sign in" stays as it is, because the decision names only "Sign out"; the login button still reads `Sign in`.

| Where | String |
|---|---|
| Rows while running | `Logging out…` · `Logging out of all devices…` |
| Confirmation dialog | `Log out on every device? You'll need to sign in again on each one.` · `Cancel` · `Log out everywhere` |
| Offline refusal | `offlineMessage('Logging out of all devices', 'go through', 'needs')`, which reads "You are offline. Logging out of all devices needs a connection to go through." |
| Failure | `Failed to log out. Please try again.` |
| Login-screen notice | `You're logged out on this device, but your other devices could not be logged out. Sign in again when you're online and try Log out of all devices once more.` |

| Do | Don't |
|---|---|
| `Notify me about` | `Pushes`, `Push and reminders` |
| One Footnote under the card | A helper sentence on every row (`When your partner sends a note.`, `Remind me a month and a week before.`) |
| `Wi-Fi only` / `Any connection` as a value | A sentence about Wi-Fi under the row |
| `Log out`, `Log out of all devices` | `Sign out` anywhere in the UI |
| `Not linked` only for a confirmed unlinked answer | `Not linked` after a failed or offline read |
| Refusals from `offlineMessage(what, action)` | A hand-typed "you need a connection" sentence |
| No "added by" footnote on an event page | `Jessie added this.` |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md` → Components.

| Component | Use | Behavioral rules |
|---|---|---|
| Settings bar | Every Settings page | Replaces the app header. List pages open with the large title (`{typography.large-title}`); once it scrolls under the bar, the bar turns to `{colors.glass}` with the small centered title (`{typography.bar-title}`). It returns to the large title when scrolled back to the top. Single-item pages use the small title only. |
| Bar actions | Settings bar | Back arrow returns one level. Save commits the one field. Add commits the Form page; it is disabled and shown at 50% opacity until the required fields (Name and Date) are filled. Cancel leaves the Form page without creating anything. The `+` button on the Dates list opens the Kind chooser. |
| Group label | List pages | Names the card below it. Not interactive. A group with no visible rows hides its label too. |
| Grouped card | Every page | Holds rows. Never holds an open editor, a Save button or a helper sentence. |
| List row | Every list page | The whole row is one button that pushes its page. On the Dates list, the `Load more` row at the end of Past appends the next page of past events in place instead of pushing a page. The value is the current state, read from the same store the page edits, so it is correct on return without a reload. A row whose page must prefill from a read that has not arrived yet is disabled until it arrives (today's rule for the name editor). |
| Switch row | Notifications, date pages | Saves when tapped; there is no Save button. Server first: the switch is disabled while its save is in flight and shows the new state (`{colors.fill}` track when on) once the save succeeds. On refusal or failure it stays where it was and the page shows the Error box. Before the account's switches have loaded, it shows the default and is disabled (as today). Disabled while Date reminders is off; see State Patterns → Date reminders off. |
| Read-only row | Partner (linked), partner's birthday | Not a button, not focusable as a control, no chevron. Never shown at reduced opacity: the value keeps `{colors.muted}` like any other value. |
| Footnote | Under a card | Explains the card above it in one sentence. Not interactive. |
| Danger action row | Top page last card; bottom of an own date's page | `{colors.danger}` marks only these actions. Log out acts at once (this device only, works offline as today). Log out of all devices checks the connection first. Offline, it refuses with the refusal string and opens no dialog; online, it opens the Confirmation dialog. `Delete event` and `Delete anniversary` open a Confirmation dialog, as today's `Delete this event?` does. The wedding's `Clear` acts at once, as today's Clear button does. While an action runs, both log-out rows are disabled and the running one shows its in-progress label. |
| Profile header | Profile | Shows who is signed in. Not interactive. The name updates when the Name field is saved. |
| Lead line | Partner, not linked | One sentence explaining the page. Not interactive. |
| Notice | Notifications | Shown while iOS reports the permission denied. The permission is re-read when the page opens and each time the app returns to the foreground. |
| Error box | Any page that writes | Shows the offline refusal or the save error for the action just tried, in `{colors.danger}` on `{colors.dtint}`, announced as an alert. It sits under the bar, above the first card (as today's Settings error sits under the title), and clears on the next attempt or when the page is left. |
| One-field edit page | Every field row with a chevron | Opens with the current value in the field and the keyboard or picker ready. Save writes that one field, then returns one level automatically to show the new value in the row. Save is disabled until the value differs from the saved one and is valid. Leaving without saving discards the edit without asking. An offline Save is refused before any request; the page stays and keeps the typed value. |
| Form page | New event, New anniversary | The one exception to tap-to-edit, because nothing exists yet: every field at once. Add is the only write. The event form starts with the Calendar icon selected. After Add, the new date appears where it belongs on the Dates list and on Home, and the app returns to the page that opened the form rather than opening the new date's page. From then on, the date's own page uses tap-to-edit. |
| Kind chooser | Dates list `+` button | The kit dialog. Asks Event or Anniversary, then pushes the matching Form page. Cancel closes it. Not used from Home's Add button. |
| Confirmation dialog | Log out of all devices; deletes | Focus trapped; Cancel has initial focus; Escape or a tap on the scrim cancels. The destructive button runs the action. Nothing happens until it is pressed. |
| Version line | Top page | Static text with the build's version. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Loading, first open | Top page and every value | Rows render at once from local copies. A right-hand value that is not known yet (before its first read, or after a failed read with nothing saved) is left empty, never `Loading...`. |
| Loading | Notifications | Switches show their defaults, disabled, until the saved copy or the server answers (as today). |
| Load failed | Notifications | `Couldn't load your push settings.` under the card. Offline with nothing saved: `offlineMessage('Push settings', 'load')`. |
| Offline refusal | Any write: one-field Save, Form page Add, switches, deletes, Log out of all devices | Refused before any request or local change, with `requireOnline(what, action)` in services or `isOnline()` plus `offlineMessage(what, action)` in components. Never hand-typed. The page stays and keeps what was typed. Which writes need a connection is unchanged by this rework. |
| Save error | Any write | The Error box with the service's message. The field keeps what was typed; the row on the page before it keeps its old value. |
| Permission off | Notifications page; top-page value | The Notice (`{colors.card2}`) above the groups. The switches stay usable, because they belong to the account and outlive the iOS setting (as today). [v1 frame 6](mockups/key-settings-v1.html) shows them at reduced opacity; the spine overrides it. The top-page value reads `Off`. |
| Not linked | Top page, Partner, Dates | Only when the server has confirmed there is no partner (a loaded `{ status: 'unlinked' }` answer). Partner row reads `Not linked`; the Partner page shows the lead line and `Go to Partner`. On the Dates list the partner's birthday row is absent and only your own events appear. The Together group is hidden, because only a linked pair can read or write those dates. |
| Partner unknown | Top page, Partner | A failed partner read is never treated as unlinked and never shows `Not linked`. If a saved partner copy exists, its name is shown. With nothing saved, the Partner row shows no value, and the Partner page shows the Partner view's load-error wording, `Couldn't load your partner`, with its offline or retry line, never the not-linked page. |
| Unset date | Dates list, Profile | Together since and Wedding read `Not set` and keep their place; tapping the row on the Dates list opens the one-field Date page directly. An unset birthday reads `Not set` too. A partner's unset birthday shows `Not set` on its read-only page with the same Footnote. Only the wedding date can be cleared back to `Not set` from its page. |
| Read-only partner item | Partner's birthday | Rows without chevrons, a working Remind me switch, and no Delete. The Remind me switch is the reader's own. |
| Empty Dates group | Dates list | An Events, Anniversaries or Past group with no rows is hidden; the `+` button is how to add one. |
| More past events | Dates list | A `Load more` row ends the Past group while older events remain; it appends the next page in place. A failed page keeps the loaded events and shows the Error box. |
| Date reminders off | Date pages | Remind me is disabled and shown at 60% opacity, with Footnote `Date reminders are off. Turn them on in Notifications.` The per-date setting is kept, so it applies again when Date reminders is turned back on. |
| Reminder unavailable | Date pages | The Remind me switch appears only in the iOS app with the local-notifications plugin (`hasNativeReminders()`). On the website a date's page has no reminder section. |
| Running | Log out rows | Both disabled; the running row shows `Logging out…` or `Logging out of all devices…` with a spinner. |
| Partial log-out | Login screen | The login screen shows the partial notice (Voice and Tone). |

## Interaction Primitives

- **Tap a row to edit.** Every field is a row with its value and a chevron. Tapping opens a one-field page with Save in the bar, as in iOS Settings and TikTok's Account page. There are no always-open editors and no per-field Save buttons on any page.
- **Switches save instantly.** No Save button for a switch anywhere.
- **The one form.** Creating an event or anniversary uses the Form page (Cancel / Add). It is the only page that shows several fields at once.
- **Collapsing title.** List pages start with the large title. Scrolling it away collapses the bar to a small centered title; scrolling back to the top expands it.
- **Push and back.** A page slides in from the right (iOS push). Home is the bottom layer. A dock button (or the header gear) opens its view directly on Home, whatever was open before, so back from any view returns to Home and back on Home does nothing. Inside a view each page goes one layer deeper, and back returns one layer: Settings › Account › Name goes back to Account, then Settings, then Home. Back is the edge swipe from the left (in the iOS app), the browser's back gesture or button (on the website), and the back arrow; each push is one browser history entry, so all three agree.
- **Reduced motion.** With Reduce Motion on, pages fade in and out instead of sliding.
- **Back arrow rule.**
  - Subpages always show the back arrow.
  - The top Settings page shows the back arrow only when the page was opened from the header gear (bottom-dock form). The arrow returns to Home, as browser back does, because Home is the bottom layer.
  - In the Duo column form, Settings is the capsule's sixth button and the header has no gear, so the top page has no back arrow ([v2 frame 2](mockups/key-settings-v2.html)).
- **Banned.** Switches, fields or descriptions on the top page. A two-pane layout. A new dock destination. A second partner connect flow. An unlink action.

## Touch Floor

Neither user relies on a screen reader or a keyboard, so this spec sets no screen-reader or keyboard rules and asks for no VoiceOver or keyboard pass (AGENTS.md, Maintained by hand). Contrast lives in `DESIGN.md` → Colors.

- Every target is at least 44pt: rows `{spacing.row-min}`, round buttons `{spacing.hit-target}`.
- Fields use 16px text (`{typography.field}`) so iOS never zooms the page.
- Reduce Motion replaces the slide with a fade.

## Key Flows

### Flow 1: Casey fixes a wrong event date from Home (Casey, iPhone Duo folded, column dock)

Casey made a "Weekend trip" event for Sat 14 Nov, but the cabin is booked for the 21st.

1. Casey opens My Love. Home shows the Weekend trip countdown card.
2. Casey taps the card. The event page slides in from the right with the small title "Weekend trip": Name, Date `Sat 14 Nov`, Note, Icon, the Remind me switch, and `Delete event`.
3. Casey taps Date. The one-field `Date` page slides in with the date field holding 14 November and Save in the bar.
4. Casey picks 21 November. Save becomes active.
5. Casey taps Save. The page returns to the event page, whose Date row now reads `Sat 21 Nov`.
6. Casey swipes from the left edge (or taps the back arrow). Home slides back.
7. **Climax:** Home's Weekend trip card shows the 21st and its countdown has moved a week. Casey fixed it with a few taps and a picker, and nothing else on the page changed. Jessie gets no push: no date change sends one.

Failure: Casey is offline at step 5. Save is refused before any request with the `offlineMessage` refusal in the Error box; the field still holds 21 November and the row still reads `Sat 14 Nov`. Once online, Casey taps Save again. A server error shows the Error box the same way.

### Flow 2: Jessie turns on a month-ahead reminder for Casey's birthday (Jessie, regular iPhone, iOS app, bottom dock)

1. Jessie taps the gear in the app header. Settings opens with a back arrow above the large title.
2. Under PARTNER, Jessie taps `Dates`. The Dates list opens.
3. Under BIRTHDAYS, Jessie taps `Casey`, whose row reads `4 Apr`.
4. `Casey's birthday` opens: a Date row reading `4 Apr` with no chevron, the Footnote `Casey sets this in their Profile.`, and the Remind me switch, already on: Remind me is on by default for every date (owner decision 2026-11-05).
5. Jessie leaves it on; a tap would switch it off, disabled for the moment its save takes.
6. **Climax:** under the switch the Footnote reads `A month and a week before.` A month before Casey's birthday, at 9:00, Jessie's phone will remind Jessie, and again a week before. Jessie did not need Casey to do anything, and could not change Casey's birthday by accident.

Failure: Jessie is offline and taps Remind me. The switch stays on and the Error box shows the `offlineMessage` refusal. If Jessie's Date reminders switch is off, Remind me is disabled, shown at 60% opacity, with the Footnote `Date reminders are off. Turn them on in Notifications.`, and Jessie turns it on in Notifications first. On the website the date page has no Remind me switch at all, because reminders exist only in the iOS app.

### Flow 3: Casey logs out of all devices after losing a phone (Casey, iPhone Duo unfolded, column dock)

1. Casey taps the gear at the bottom of the capsule in the side column. Settings opens with no back arrow.
2. Casey scrolls down. The large title collapses into the small centered `Settings` bar.
3. In the last card, Casey taps `Log out of all devices`.
4. The device is online, so the Confirmation dialog opens: `Log out on every device? You'll need to sign in again on each one.` Cancel has focus.
5. Casey taps `Log out everywhere`. The row reads `Logging out of all devices…`.
6. **Climax:** the login screen appears. The lost phone's session is over, and it will be signed out the next time it reaches the server. Casey signs back in on the Duo knowing the other phone can no longer open their notes.

Failure: Casey is offline at step 3. The refusal "You are offline. Logging out of all devices needs a connection to go through." appears and no dialog opens. If the server can end this device's session but not every other one, the login screen shows the partial notice.

### Flow 4: Casey adds an anniversary from Dates (Casey, iPhone Duo folded, column dock)

1. On the Dates list Casey taps the `+` button. The Kind chooser asks Event or Anniversary.
2. Casey taps Anniversary. `New anniversary` opens with Cancel, the title and a disabled Add.
3. Casey types the name and picks the date. Add becomes active.
4. **Climax:** Casey taps Add. Back on the Dates list, the new anniversary sits under ANNIVERSARIES with its date on the right. Jessie sees it on their own Dates list too, because anniversaries are shared.

Failure: if Casey is offline at step 4, the Form page stays, with the refusal in the Error box and every field kept.

## Responsive & Platform

| Form | Where | Settings behavior |
|---|---|---|
| Bottom dock | Regular iPhone (iOS app or website); iPhone Duo unless exactly one side inset is 44px or wider | Reached from the header gear. The top page shows the back arrow. |
| Column dock | iPhone Duo: folded portrait, both folded landscapes, unfolded landscape, either pane side by side (`data-dock="column-left|column-right"`) | Settings is the capsule's sixth button, highlighted while Settings is open. The header has no gear and the top page no back arrow. |
| Wide (unfolded Duo) | Column dock with a wide screen | Single column, the same as on a phone, capped at `{spacing.content-max}`. Each row pushes a full page with a back arrow. |
| Website | Any browser, no iOS app | No Notifications row and no Remind me switches. No in-app edge swipe; the browser's back returns one level. The Photos row appears only where the connection type is readable (not on iPhone Safari). |
| iOS app, older shell | Shell installed before the push or local-notifications plugins | Rows and switches that need a missing plugin are hidden, checked with `Capacitor.isNativePlatform()` then `Capacitor.isPluginAvailable()` as everywhere else. |

## Inspiration & Anti-patterns

- **Lifted from TikTok's Settings** ([IMG_0113](imports/tiktok/IMG_0113.jpg), [IMG_0114](imports/tiktok/IMG_0114.jpg), [IMG_0115](imports/tiktok/IMG_0115.jpg), [IMG_0116](imports/tiktok/IMG_0116.jpg)): the structure. A large title that collapses to a small centered one with a back arrow, short plain groups, one-line rows with the current value on the right, log out last with the version under it. Details in `reconcile-tiktok.md`.
- **Lifted from iOS Settings:** tap a row, edit one field on its own page, Save in the bar.
- **Rejected: TikTok's dark look.** My Love keeps its kit colors.
- **Rejected: always-open editors with their own Save buttons**, the old page's pattern that let fields spill past the card edge.
- **Rejected: dates in three places** (Account, Countdowns, a list of reminder switches). Each date now has one page that holds its edit, delete and reminder.

## Out of scope and follow-ups

- **Server-side removal:** DW-416 in `deferred-work.md`.
- **DW-399: split `settingsSlice.ts`.** Held open as an input to this rework. This design gives no slice split; how state is divided for the new pages is the architect's call.
- **Subpage URLs and reload survival: the architect's call.** Whether a Settings subpage or a date page gets its own URL and survives a reload is left to architecture. Today `pathMap` in `navigationSlice.ts` knows only top-level views. The one rule this spine sets is that each push is one browser history entry, so back returns one level.
- **UNVERIFIED: iOS never reports the connection type.** The Photos row's hiding on iPhone rests on Safari and the iOS app having no `navigator.connection` and no native network plugin. That has not been checked on a device.

No open questions remain.
