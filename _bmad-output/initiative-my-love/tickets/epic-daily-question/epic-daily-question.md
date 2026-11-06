---
type: epic
title: "Daily Question"
parent: initiative-my-love
covers: ["R1", "R2", "R3", "R4", "R12", "R17", "R18", "R20"]
sources: []
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md"]
after: []
refined: false
risk: high
---

# Daily Question

## Description

Daily replaces Mood as the dock's second destination. Each day the couple gets one this-or-that question; each partner picks one option blind, the server withholding the other's choice until their own pick exists, and then both see the reveal. After the reveal each is asked to write tomorrow's question (This / That) or let the pool pick one: about 500 questions written by the coach, none repeated until all are used, joined by the ones partners write. A pick made offline keeps the time it was made and sends on reconnect; each partner's day runs on their own clock; an account with no linked partner sees an invitation to link. The mood screens leave the dock here and stay in the code until epic 10 deletes them; epic 7 adds the streak to these screens, epic 8 puts Nudge on the waiting screen and times its pushes on this day, epic 9 adds the reveal's Reply button, and epic 10 deletes the mood code once Daily holds the dock slot.

## Outcome

Both partners answer one question a day and see each other's pick only after their own. Signal: a day's two picks revealed on the live site.

## Done when

- On the live site both partners see the same question, pick, and see the reveal, and a request made as the second partner before their pick gets no trace of the first pick's choice.
- An automated test shows a pick made offline at 11:50 PM and sent at 12:10 AM counted for the earlier date, and partners an hour apart each picking at 11:30 PM local landing on the same date.
- The pool holds about 500 questions; a written question is asked of both the next day, and a declined prompt yields a pool question.
- The dock reads Home, Daily, Love Notes, Photos, Partner, and an unlinked account's Daily shows the invitation to link.
- Shipped to production through `deploy.yml`.

## Boundaries

- Out: the streak, run, colours, +1 animation and milestones (epic 7); pushes and Nudge (epic 8); Reply in Love Notes (epic 9); deleting mood code and data (epic 10).
- Must not change: Home's bundled daily message.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- C1 — parent, section Constraints
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, screens Today's question, Waiting on Jessie, Both answered: the reveal, Write tomorrow's question?, After a missed day

## Notes

- The architecture spine (companion) settles how a day is dated across the partners' clocks and how questions and picks are stored; refine against it.
