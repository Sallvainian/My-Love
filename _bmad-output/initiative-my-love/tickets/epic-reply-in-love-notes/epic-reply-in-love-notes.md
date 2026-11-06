---
type: epic
title: "Reply in Love Notes"
parent: initiative-my-love
covers: ["R10"]
sources: []
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md"]
after: []
refined: false
risk: medium
---

# Reply in Love Notes

## Description

The reveal's one action is Reply in Love Notes, spanning its card's full width. It opens Love Notes with the reply attached to that day's question, as replying to a message in iPhone Messages, and both partners see the sent note with the question attached; tapping the attachment opens that day's reveal. It adds the button to the reveal card epic 6 builds, after epic 7 adds its +1 animation there and after epic 8's migrations; epic 10 follows its migrations in turn.

## Outcome

Partners talk about the day's answers where they already talk. Signal: a reply on the live site shown with its question in both partners' Love Notes.

## Done when

- A reply sent from the reveal shows in both partners' Love Notes attached to its question.
- A reply written offline keeps its attached question when the queued note sends.
- Shipped to production through `deploy.yml`.

## Boundaries

- Out: any other reveal action, a send-a-heart button among them.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, screens Both answered: the reveal, Love Notes replying, Love Notes reply sent

## Notes

- Waits on epic 6 because: the reply points at its stored question and sits on its reveal card.
- Waits on epic 7 because: both change the reveal card.
- Waits on epic 8 because: both add migrations, regenerate the database types and change epic 6's screens.
- The architecture spine (companion) settles how a reply points at its day's question; refine against it.
