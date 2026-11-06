---
type: epic
title: "Streak and Partner Page"
parent: initiative-my-love
covers: ["R5", "R6", "R7", "R8", "R9", "R11", "R17"]
sources: []
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md"]
after: []
refined: false
risk: medium
---

# Streak and Partner Page

## Description

The couple shares one streak that rises by one for each day both partners picked and holds on a missed day, beside a current run that resets on a miss. Daily and the Partner page show it grey until today is done, fire orange once done and blue after a miss until both pick again; a Duolingo-style +1 plays at once for the second picker and on the next open for the first. Every 25 days of the held total unlocks a flaming-heart badge and the approved milestone screen with its flickering flames and beating heart. The Partner page holds the streak and the past questions, each day marked Same or Different with a running count, in place of the partner's mood card, the recent-moods list and the Poke/Kiss/Fart tiles. When an offline pick lands after its day's midnight, the streak is corrected for that date (R17's streak part; epic 6 delivers the pick itself). It builds on the picks and the per-partner day from epic 6; epic 8's push copy quotes its count, epic 9 adds Reply to the reveal card after this epic's +1, and epic 10 deletes the mood and interaction code once this Partner page no longer reads it.

## Outcome

The couple watches one shared streak grow and sees how often they pick the same. Signal: the held total and current run on the live Partner page.

## Done when

- An automated test over faked days shows the held total, the current run and the grey, orange and blue states following R5 to R7 across done and missed days.
- The +1 animation plays at once for the second picker and on the next open for the first.
- Reaching 25 days of the held total shows the milestone screen with the animated flaming heart; later badges stay grey until reached.
- The Partner page shows the streak and past questions with Same or Different and the running count, and no mood card, recent moods or Poke/Kiss/Fart tiles.
- Shipped to production through `deploy.yml`.

## Boundaries

- Out: deleting mood and interaction code and data (epic 10); pushes (epic 8).
- Out: the flaming heart anywhere but milestones; the counter, the +1 animation and the dock keep the plain flame.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, screens Streak goes up by one, 25-day milestone, Partner page, Past questions, After a missed day

## Notes

- Waits on epic 6 because: it counts the picks and the per-partner day epic 6 stores.
- The architecture spine (companion) settles how a day is closed and how the streak is counted; refine against it.
