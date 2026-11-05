---
type: epic
title: "Daily Pushes and Nudge"
parent: initiative-my-love
covers: ["R2", "R13", "R14", "R19"]
sources: []
companions: []
after: []
refined: false
risk: high
---

# Daily Pushes and Nudge

## Description

Five pushes bring each partner back: the new question at 8 AM, the partner picked, the partner nudged you, an 8 PM reminder when nobody has answered, and both answered, each timed on the recipient's own clock with the copy on the mock-up's notifications screen. The waiting screen's Nudge button sends the partner a push, and each new kind gets its own Settings switch. Today a push fires only when a row is saved, so the 8 AM and 8 PM pushes need a scheduler the app does not have; if the phone schedules them, the date reminders' cancel-all must be narrowed in the same change (C4). No push carries a pick before the recipient has picked (R2's push part). The pushes quote epic 7's streak count and are timed on epic 6's per-partner day; epic 9 follows this epic's migrations, and epic 10 deletes the mood, poke and kiss pushes and switches beside the new ones (R19's removal part).

## Outcome

Each partner is called back to the day's question at the right moment on their own clock. Signal: each push kind arriving on the owner's iPhone.

## Done when

- Each of the five push kinds arrives on the owner's iPhone in the iOS shell, 8 AM and 8 PM on the recipient's own clock.
- Nudge on the waiting screen sends the partner a push.
- The partner-picked push never shows the pick.
- Turning a new kind's Settings switch off stops that push.
- Date reminders still fire after a re-plan while the daily pushes are scheduled.
- Shipped to production through `deploy.yml`, and to the iOS shell if native code changes.

## Boundaries

- Out: removing the mood, poke and kiss pushes and switches (epic 10).
- Must not change: date reminders and the existing love-note, photo and partner-request pushes.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- C2, C4 — parent, section Constraints
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, screens The nudges, Waiting on Jessie

## Notes

- Waits on epic 6 because: the pushes are timed on its per-partner day and react to its picks.
- Waits on epic 7 because: the push copy quotes the streak count.
- Waits on the architecture pass for how the 8 AM and 8 PM pushes are scheduled; refined after it.
