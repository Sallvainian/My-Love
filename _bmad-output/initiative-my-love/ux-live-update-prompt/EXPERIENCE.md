---
name: My Love — Live update prompt
status: final
updated: 2026-11-04
sources:
  - ../../backlog/story-native-shell-live-update-prompt.md
---

# My Love — Live update prompt: Experience Spine

> Paired with `DESIGN.md`. Composition reference: [key screens](mockups/key-live-update.html). **This spine wins on any conflict with a mock.** It changes two things in the ticket. The notifications **page** becomes a **drop-down list** under the header's bell: it is not a view, has no URL and adds no history entry (owner, 2026-11-04). The toasts move from the top centre, where `b9063841` put them, to the bottom: above the dock, or above the composer on Love Notes.

## Foundation

The native iOS shell only (Capacitor, `Capacitor.isNativePlatform()`), on every iPhone it runs on and in every iPhone Duo pose. The website and the Home Screen web app get none of this (ticket R10). The UI system is My Love's kit (`src/index.css`, `kitClasses.ts`), and this spine adds only the behaviour of four new pieces: the update toast, the confirm dialog, the header bell, and the bell's drop-down list. The flow reads the existing `nativeUpdates` status (`idle`, `downloading` with a percent, `ready`).

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Update toast | Shown by the update check, on any view, Settings included | Says an update is downloading, then that it is ready |
| Notifications drop-down | The bell at the header's top-left | Lists what is waiting. Today the only kind of entry is "Update now" |
| Update confirm dialog | A tap on the ready toast or on the "Update now" entry | Asks before restarting |

The drop-down is a general notifications list, and the live update is its first kind of entry. It is an overlay over the current view, not a view. Nothing is registered in `ViewType`, `pathMap`, the `App.tsx` URL ternaries, the render chain or `DESTINATIONS`. Settings has no app header, so the bell isn't shown there, while the toast still is.

The bell and its list are named "Notifications", as Settings → Notifications (push preferences) is, with the same bell icon. The owner accepts the shared name because the two are reached from different places: the header and Settings.

## Voice and Tone

| String | Where |
|---|---|
| `Downloading update…` | Download toast |
| `Update ready — tap to restart` | Ready toast |
| `Notifications` | Bell's name; the drop-down's list label (shown uppercase) |
| `Update now` | Entry title |
| `A new version of My Love is ready.` | Entry line |
| `No notifications` | Drop-down with nothing waiting |
| `Update now?` | Dialog title |
| `You may lose what you're doing.` | Dialog body |
| `No` / `Yes` | Dialog buttons |

The ticket's one-line dialog string ("Update now? You may lose what you're doing") is split into a title and a body. No string names a build id, a version number or "bundle".

## Component Patterns

| Component | Behavioural rules |
|---|---|
| Update toast, downloading | Shows when the check starts a download (`downloading`), and only then: a build an earlier launch already downloaded skips it. The percent updates as the plugin reports it, and the bar slides until the first report arrives. It can't be closed or tapped. It leaves when the download ends, whether it worked or failed. On Love Notes it sits above the composer, not over it (see Responsive & Platform). |
| Update toast, ready | Shows when the status becomes `ready`, on this launch or on a later launch that finds the build already downloaded. It replaces the download toast in place. It stays until the person acts on it (owner, 2026-11-06: one that hid after 6 seconds was easily missed): a tap on its line hides it and opens the confirm dialog, and its × (a 44px target) hides it. It shows again on each launch while the update is still ready. |
| Bell button | Native shell only, at the header's top-left in every pose. A tap opens the drop-down, and a tap while it is open closes it. It sits wherever the header is, so it isn't on Settings. |
| Bell dot | Shows while an update is ready. Opening the drop-down does not clear it; only applying the update (Yes, or the background swap) does. After No it stays. |
| Notifications drop-down | Opens under the bell. A tap anywhere outside it closes it, and that tap does nothing else: it doesn't press the control underneath. Changing view, or the app going to the background, also closes it. Entries come newest first. Today there is at most one. |
| Notification entry ("Update now") | Present for as long as the dot shows. A tap closes the drop-down and opens the confirm dialog. It has no swipe and no dismiss: it leaves only when the update is applied. |
| Update confirm dialog | Modal, like the app's other confirms. **Yes** is a solid red pill and **No** a neutral one (card2 with a line-strong outline), so the two never read alike (owner, 2026-11-06). **No**, or a tap on the scrim, closes it: the app stays on its build and its screen, and the entry and dot stay. **Yes** disables both buttons and restarts on the new build (`applyUpdate`). If the restart fails, the dialog closes and the update stays waiting, with the entry and dot, for the background swap. |

## State Patterns

| State | Toast | Bell dot | Drop-down |
|---|---|---|---|
| No update (published build is the running one) | None | None | `No notifications` |
| Downloading | Download toast with progress | None | `No notifications` |
| Download fails, or `latest.json` unreadable or incomplete | Download toast leaves (if it showed); no ready toast | None | `No notifications`. The next check (a return to the front, the 10-minute check or the next launch) tries again |
| Ready, this launch | Ready toast until tapped or closed | Shown | `Update now` entry |
| Ready, downloaded on an earlier launch | Ready toast until tapped or closed (no download toast) | Shown | `Update now` entry |
| Ready, after No | None until the next launch | Shown | `Update now` entry |
| Applied (Yes, or background and reopen) | None | None | `No notifications` |
| Offline at launch | The check fails quietly, as in the fail row | None | `No notifications` |
| Website / Home Screen web app | None | No bell | No drop-down |

## Interaction Primitives

- Tap only. No swipe on the toast, the entry or the drop-down, and no long-press.
- One overlay at a time. Opening the dialog first hides the toast or closes the drop-down, whichever opened it.
- The drop-down has no scrim. A touch outside it closes it.
- Motion: the toast springs up from below (the shipped spring, mirrored for the bottom edge) and fades out. The drop-down fades in over 150 ms with a 4px drop from the bell. With Reduce Motion on, both only fade.

## Touch Floor

- Every target is at least 44pt: the bell, each entry, the ready toast (one 44px-high line), No and Yes (48px pills).
- The bell's dot sits inside the bell's 44px hit area, so a tap on the dot is a tap on the bell.
- Reduce Motion: the toast and the drop-down only fade (see Interaction Primitives).

## Key Flows

### Flow 1: The download shows, the ready update shows, and Yes applies it now (Casey, iPhone Duo folded, column dock, morning coffee)

1. Casey opens My Love. The deploy from last night is newer than the build Casey is running.
2. **The download shows:** "Downloading update…" rises above the home-indicator band, clear of the capsule. The bar fills and the percent counts up.
3. **The ready update shows:** the toast turns into "Update ready — tap to restart", and a dot appears on the bell at the header's top-left.
4. **Tapping asks first:** Casey taps the toast. It goes, and the dialog asks "Update now?", with "You may lose what you're doing." under it.
5. Casey isn't in the middle of anything and taps **Yes**.
6. **Climax — Yes applies it now:** the app restarts on the new build at once. Casey is back in the app with no toast and no dot, and the drop-down says "No notifications".

Failure: the restart fails. The dialog closes, the dot and the entry stay, and the background swap applies the update later (Flow 2, step 7).

### Flow 2: No leaves it waiting, and the background swap still applies it (Jessie, regular iPhone, bottom dock, writing a love note)

1. Jessie opens the app halfway through a love note. The update downloaded on the previous launch, so no download toast shows.
2. **The ready update shows:** "Update ready — tap to restart" sits just above the typing box, clear of it, until Jessie taps it or its ×. Jessie closes it and keeps typing. The dot stays on the bell.
3. **The notifications drop-down:** later, Jessie taps the bell. The drop-down opens under it with one entry: "Update now", "A new version of My Love is ready."
4. **Tapping asks first:** Jessie taps the entry. The drop-down closes and the dialog opens.
5. **No leaves it waiting:** Jessie taps **No**. The dialog closes, the half-written note is still there, and the dot stays.
6. Jessie sends the note and switches to Messages.
7. **Climax — the background swap still applies it:** when Jessie comes back, the app is on the new build. No toast, no dot, and the drop-down is empty.

### Flow 3: A failed check is quiet, and with no update nothing shows (Casey, on the subway, no signal)

1. Casey opens the app with no connection. The update check fails.
2. **A failed check is quiet:** no toast stays and no dot appears, and the app runs the build it has. The drop-down says "No notifications".
3. Casey opens the app again that evening on Wi-Fi. The check runs again, and the published build is the one Casey already runs.
4. **Climax — no update, nothing shows:** the header looks as it did, with a bell and no dot, and no toast appears.

## Responsive & Platform

| Surface / pose | Bell | Right slot | Toast |
|---|---|---|---|
| Shell, bottom dock (non-Duo iPhones, Duo inner portrait) | Top-left | Settings gear | `{spacing.toast-gap}` above the bottom dock |
| Shell, Duo column right (folded portrait, landscapes, right pane) | Top-left | Gear-sized spacer (story 2.8) | Just above the home-indicator band, clear of the right column |
| Shell, Duo column left (left pane) | Top-left, inside the 84pt left inset | Gear-sized spacer | Just above the home-indicator band, clear of the left column |
| **The website is unchanged**: website and Home Screen web app | None. The top-left is the empty 44px space it is today | Gear | None |

The drop-down follows the bell: its left edge sits at the header's left inset plus `--dock-left`.

**Love Notes, every pose.** The composer sits at the bottom of the view, right where the toast would go, so on Love Notes both toasts sit `{spacing.toast-gap}` above the composer's top edge. They move with it as it grows by a line of text or a picture preview, so they never cover the typing box. The offset follows the composer's live top edge, never a fixed number. On every other view they stay `{spacing.toast-gap}` above `--dock-top`.

## Out of scope and follow-ups

- **Other kinds of entries.** The drop-down is built as a general list, but only "Update now" exists. What other kinds would show, whether they carry a time or an unread mark, and whether opening the list clears their dot are for whoever adds the second kind. The update's rule (the dot clears only when the update is applied) is specific to it.
- **Ticket edits.** R9 and R10 and the "registers as a new view" Note describe a page. They need rewording to the drop-down (`bmad-agent-po`).
- Safari and the Home Screen web app's own update are bug 2 (`bug-website-reloads-mid-use-on-update.md`).
