---
id: 1
type: story
title: "The native shell shows a live update and lets the owner apply it now"
parent:
covers: []
after: []
refined: true
hitl: false
risk: high
---

# The native shell shows a live update and lets the owner apply it now

## Description

In the native iOS shell a newer web build is announced at the bottom of the screen and applied only after a confirm: a toast while it downloads, a toast when it is ready, and a dialog whose Yes restarts on it at once. A ready update also waits as an entry in a Notifications drop-down under a new bell at the header's top-left, and the bell carries a dot until the update is applied, so an ignored or declined toast still leaves a way to apply it. This replaces the shell's current update toast, which sits at the top over the header, can be closed, and restarts from its Refresh button without asking; the silent swap when the app is next backgrounded stays as the fallback. The flow is checked on the iPhone Duo simulator with `scripts/sim-driver/sim`: `sim build --update-port`, `sim serve-update`, `sim background` and `sim launch` publish, download and apply a live update there.

## Requirements

1. **The download shows**
   **Given** the shell launches and the published build is newer than the running one and not yet downloaded
   **When** the download starts
   **Then** a toast reads "Downloading update…" with a bar that fills as the download runs, and the percent once it is known
   **And** the toast has no close button and does nothing when tapped
   **And** it goes away when the download ends, whether it succeeded or failed

2. **The ready update shows**
   **Given** a newer build has finished downloading, on this launch or an earlier one
   **When** it is ready to apply
   **Then** a toast reads "Update ready — tap to restart", in the download toast's place, and hides by itself after 6 seconds
   **And** it has no close button
   **And** the Notifications drop-down holds an "Update now" entry reading "A new version of My Love is ready."
   **And** the header's bell shows a dot
   **And** a build an earlier launch already downloaded shows no download toast
   **And** every later launch on which it is still not applied shows the ready toast again

3. **Tapping asks first**
   **Given** an update is ready
   **When** the ready toast or the "Update now" entry is tapped
   **Then** the toast hides or the drop-down closes, whichever was tapped
   **And** a dialog asks "Update now?" with "You may lose what you're doing." under it, and the buttons No and Yes

4. **Yes applies it now**
   **Given** the confirm dialog is open
   **When** Yes is tapped
   **Then** both buttons are disabled and the app restarts on the new build at once
   **And** afterwards no update toast, entry or dot shows
   **And** if the restart fails, the dialog closes and the entry and dot stay, for the background swap to apply it

5. **No leaves it waiting**
   **Given** the confirm dialog is open
   **When** No, or the dimmed area around the dialog, is tapped
   **Then** the dialog closes and the app stays on its build and its screen
   **And** the "Update now" entry and the dot stay, and the ready toast does not come back before the next launch

6. **The background swap still applies it**
   **Given** an update is ready and not applied
   **When** the app is backgrounded and reopened
   **Then** it runs the new build
   **And** no update toast, entry or dot shows

7. **A failed check is quiet**
   **Given** the download fails, or the published update file is unreadable or incomplete, or the shell is offline
   **When** the launch's update check ends
   **Then** no ready toast, entry or dot appears and the app stays on its build
   **And** the next launch checks again

8. **No update, nothing shows**
   **Given** the published build is the one running
   **When** the shell launches
   **Then** no update toast, entry or dot appears

9. **The Notifications drop-down**
   **Given** the native shell, on any view that shows the header
   **When** the bell at the header's top-left is tapped
   **Then** a drop-down labelled "Notifications" opens under the bell, listing the "Update now" entry if an update is ready, and otherwise reading "No notifications"
   **And** opening it does not clear the dot
   **And** a tap on the bell or anywhere outside the drop-down closes it, and a tap outside presses nothing underneath
   **And** changing view, or the app going to the background, closes it
   **And** opening and closing it changes neither the address nor what back does
   **And** the bell sits at the header's top-left, the size of the Settings gear, in every pose
   **And** Settings, which has no app header, shows no bell

10. **The website is unchanged**
    **Given** the website or the Home Screen web app
    **When** any page loads
    **Then** the header's top-left is the empty space it is today, and no bell, drop-down or update toast exists

11. **The toasts never cover the dock or the composer**
    **Given** an update toast shows
    **When** it is on any view, in any pose
    **Then** on Love Notes it sits just above the composer and moves with it as the composer grows by a line of text or a picture preview
    **And** on every other view, Settings included, it sits just above the dock, or above the home-indicator band and clear of the side column in column poses

## Boundaries

- Must not change: how the website and the Home Screen web app update (bug 2 in this folder owns that).
- Must not change: a bundle that fails to start rolls back to the last good one, and the shell confirms the running bundle started before any update request.
- Must not change: unsent queued love notes and unsynced moods survive a Yes restart and send on their own afterwards.
- Must not change: the dock's five destinations, the header's Settings gear in bottom-dock poses and the gear-sized space that replaces it in column poses.
- Must not change: Settings → Notifications (push preferences), which shares the name and the bell icon.
- Touch point: the header — the bell in its empty top-left slot; owner: epic-iphone-duo-native-tab-bar (story 2.8 put the gear-sized space in column poses).

## References

- design — _bmad-output/initiative-my-love/ux-live-update-prompt/DESIGN.md
- design — _bmad-output/initiative-my-love/ux-live-update-prompt/EXPERIENCE.md
- project-context — AGENTS.md, section Maintained by hand (the native iOS shell and live updates; the bottom dock)
- epic — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/epic-iphone-duo-native-tab-bar.md, Requirements R5 and R8, and Notes (the 2026-10-30 decision that the shell header's top-left holds a notifications button, the one change to R5's "as today")

## Notes

- Decision: 2026-10-30 the "Update now" entry appears as soon as an update is ready, not only after No, so an ignored toast still leaves a way to apply it.
- Decision: 2026-10-30 the header bell and its Notifications list exist in the native shell only.
- Decision: 2026-10-30 the header bell shows a dot while an update waits.
- Decision: 2026-10-30 risk high: live update is the only way to fix web code on installed shells, and a flow that breaks it costs both phones an Xcode reinstall. Check beyond the criteria, on the simulator: serve two updates in a row (`sim build --update-port N`, then `sim serve-update --port N` twice, rebuilding the served tree between them); the build carrying this flow shows its toast and applies by Yes, and the next one still arrives and applies by the background swap (`sim background`, `sim launch`). No phone step: nothing here needs a real finger, a real push or a reinstall on the owner's phone (2026-11-04, DW-442; the check was the owner's iPhone until then).
- Decision: 2026-10-30 the Safari and Home Screen web app update is out of this ticket; it is recorded as bug 2 in this folder.
- Decision: 2026-11-04 the owner ran `bmad-ux` (ux-live-update-prompt), superseding the 2026-10-30 "no bmad-ux pass" and its layout line. The notifications page became a drop-down under a bell, over the current view: no view, no URL, no history entry, so nothing is registered in the places AGENTS.md lists for a new view (R9, R10). The toasts moved from the top centre to the bottom, above the dock or the Love Notes composer (R11). The ready toast hides after 6 seconds, the download toast has no close button, a tap on the dimmed area is No, and the dialog's line is split into a title and a body (R1–R5).
- Decision: 2026-10-30 kept as one story: only the update entry is in scope; the list is built general, and other kinds of entries are out of scope (EXPERIENCE.md, Out of scope and follow-ups).
- Decision: 2026-11-04 story 2.8 is done: column poses already show the gear-sized space on the right, so the header change is the bell in the left slot alone. Replaces the 2026-10-30 "no wait on story 2.8" line.
- Assumption: criterion 4's failed restart is proven by a unit test, not a simulator step.
- The first visible toast arrives one deploy late: a shell still running the old code shows the old toast, and the build carrying this flow shows its toast from the next deploy.
