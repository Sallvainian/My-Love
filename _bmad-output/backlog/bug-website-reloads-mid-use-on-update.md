---
id: 2
type: bug
title: "The website reloads without warning when a new build arrives, losing a half-typed love note"
parent:
covers: []
after: []
refined: false
hitl: false
risk: medium
severity: P2
---

# The website reloads without warning when a new build arrives, losing a half-typed love note

## Description

On the website and the Home Screen web app, when a newer build has been deployed since the last visit, the page reloads by itself once the new service worker installs, with no notice. Anything in progress is lost, such as a love note half-typed in the composer. The user should not lose work they are in the middle of when an update arrives.

## Reproduction

Not yet run: it needs a deploy between two visits.

1. Open the website (or the Home Screen web app) and sign in; close it.
2. Deploy a new build.
3. Open it again and, straight away, start typing a love note.
4. Actual: once the new service worker finishes installing, the page reloads and the typed text is gone. Expected: the text stays until the user chooses to update.

## Cause Hypothesis

`src/main.tsx:21` handles a waiting service worker in `onNeedRefresh` by calling `updateSW(true)`, which reloads the page, and `src/sw.ts:52` calls `skipWaiting()` so the new worker takes over at once. The composer keeps no draft that survives a reload. The window is the seconds after launch while the new worker downloads and installs; the browser can also check for a new worker later in a session, for example on a background-sync event.

## Acceptance Criteria

1. **An update does not discard work in progress**
   **Given** a newer build is deployed while a love note is half-typed
   **When** the new service worker installs
   **Then** the typed text is still there, and the update applies only when the user chooses or the page is next opened
2. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** a test that fails on the defect and passes on the fix covers the reproduction, and one covers each related case the fix touched
3. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the expected behavior already holds, or the report was mistaken, with the evidence recorded in Notes — this supersedes 1 and 2

## References

- parent — none
- story — _bmad-output/backlog/story-native-shell-live-update-prompt.md (the native shell's visible update flow)

## Notes

- Decision: 2026-10-30 recorded as its own ticket, out of the native shell's live-update story.
- Assumption: severity P2: work is lost, but retyping is the workaround.
- Open question: should the website get the same toast and confirm as the native shell (story 1 in this folder)? Answered in this bug's work.
