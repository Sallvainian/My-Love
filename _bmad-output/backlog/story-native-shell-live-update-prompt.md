---
id: 1
type: story
title: "The native shell shows a live update and lets the owner apply it now"
parent:
covers: []
after: []
refined: false
hitl: true
risk: high
---

# The native shell shows a live update and lets the owner apply it now

## Description

In the native iOS shell a newer web build is announced instead of swapped in silently: a toast while it downloads, a toast when it is ready, and a confirm dialog that applies it at once. A ready update also waits as an entry on a new notifications page, opened from a new button at the header's top-left, so an ignored or declined toast still leaves a way to apply it. The silent swap when the app is next backgrounded stays as the fallback. A person checks the flow on the owner's iPhone after a deploy.

## Requirements

1. **The download shows**
   **Given** the shell launches and the published build is newer than the running one and not yet downloaded
   **When** the download starts
   **Then** a toast reads "Downloading update…"
   **And** it goes away when the download ends, whether it succeeded or failed

2. **The ready update shows**
   **Given** a newer build has finished downloading, on this launch or an earlier one
   **When** it is ready to apply
   **Then** a toast reads "Update ready — tap to restart"
   **And** the notifications page holds an "Update now" entry
   **And** the header's notifications button shows a dot
   **And** a build an earlier launch already downloaded shows no download toast

3. **Tapping asks first**
   **Given** an update is ready
   **When** the ready toast or the "Update now" entry is tapped
   **Then** a dialog asks "Update now? You may lose what you're doing" with No and Yes

4. **Yes applies it now**
   **Given** the confirm dialog is open
   **When** Yes is tapped
   **Then** the app restarts on the new build at once
   **And** afterwards no update toast, entry or dot shows

5. **No leaves it waiting**
   **Given** the confirm dialog is open
   **When** No is tapped
   **Then** the dialog closes and the app stays on its build and its screen
   **And** the "Update now" entry and the dot stay

6. **The background swap still applies it**
   **Given** an update is ready and not applied
   **When** the app is backgrounded and reopened
   **Then** it runs the new build
   **And** no update toast, entry or dot shows

7. **A failed check is quiet**
   **Given** the download fails, or the published update file is unreadable or incomplete
   **When** the launch's update check ends
   **Then** no ready toast, entry or dot appears and the app stays on its build
   **And** the next launch checks again

8. **No update, nothing shows**
   **Given** the published build is the one running
   **When** the shell launches
   **Then** no update toast, entry or dot appears

9. **The notifications page**
   **Given** the native shell
   **When** the header's top-left button is tapped
   **Then** the notifications page opens, listing the "Update now" entry if an update is ready
   **And** with no entries it says there are no notifications
   **And** the button sits at the header's top-left in every pose; where the header has no Settings gear, a matching space on the right keeps the wordmark centred

10. **The website is unchanged**
    **Given** the website or the Home Screen web app
    **When** any page loads
    **Then** the header's top-left is the empty space it is today, and no notifications page exists

## Boundaries

- Must not change: how the website and the Home Screen web app update (bug 2 in this folder owns that).
- Must not change: a bundle that fails to start rolls back to the last good one, and the shell confirms the running bundle started before any update request.
- Must not change: unsent queued love notes and unsynced moods survive a Yes restart and send on their own afterwards.
- Must not change: the dock's five destinations and the header's Settings gear.
- Touch point: the header — the top-left button and its balancing space; owner: epic-iphone-duo-native-tab-bar (story 2.8 removes the gear in column poses).

## References

- project-context — AGENTS.md, section Maintained by hand (the native iOS shell and live updates; the bottom dock)
- project-context — AGENTS.md, section Where things are (registering a new view)
- epic — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/epic-iphone-duo-native-tab-bar.md, Requirements R5 and R8

## Notes

- Decision: 2026-10-30 the "Update now" entry appears as soon as an update is ready, not only after No, so an ignored toast still leaves a way to apply it.
- Decision: 2026-10-30 the header button and the notifications page exist in the native shell only.
- Decision: 2026-10-30 the header button shows a dot while an update waits.
- Decision: 2026-10-30 risk high: live update is the only way to fix web code on installed shells, and a flow that breaks it costs both phones an Xcode reinstall. Check beyond the criteria: on the owner's iPhone, deploy twice in a row; the build carrying this flow applies by Yes, and the next deploy still arrives and applies by the background swap.
- Decision: 2026-10-30 the Safari and Home Screen web app update is out of this ticket; it is recorded as bug 2 in this folder.
- Decision: 2026-10-30 no `bmad-ux` pass; layout: the toasts sit above the dock and reserve `--dock-clearance`; the confirm is a modal dialog like the app's other confirms; the header button matches the gear's size and style, with the dot at its top-right corner.
- Decision: 2026-10-30 kept as one story: the notifications page exists only to hold the update entry.
- Decision: 2026-10-30 no wait on story 2.8: criterion 9 places the button in both header forms, so either can build first; epic 2's Notes carry the matching line.
- The first visible toast arrives one deploy late: a shell still running the old code downloads this build silently.
- The page is a new view: it registers in every hand-maintained place AGENTS.md lists, and is not a dock item.
