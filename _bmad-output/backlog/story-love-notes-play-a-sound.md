---
id: 5
type: story
title: "A love note's push plays a sound"
parent:
covers: []
after: []
refined: false
hitl: false
risk: low
---

# A love note's push plays a sound

## Description

A love note's push arrives silently: the push sender asks iOS for no sound, and its tests pin that no push does. The owner wants the love-note push to play the default notification sound, the one date reminders and, from epic 8, the nudge and the 8 PM reminders use. The other pushes are not part of this story.

Verify: a sender unit test shows a love note's push asking for the default sound and every other existing kind still asking for none. The owner hears it on their iPhone when the story is closed; that is no step of the build.

## References

- epic — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge.md, Notes (Decision 2026-11-25, sound)

## Notes

- Code: supabase/functions/send-push/payload.ts (`buildLoveNotePayload`) and payload.test.ts; src/services/dateReminders.ts (`REMINDER_SOUND`).

- Decision: 2026-11-25 the owner kept love-note sound out of epic 8 and asked for this backlog story.
- Open question: whether the sound also plays when the love note's switch is on but Love Notes is on screen; the shell shows no banner then, so likely nothing changes.
