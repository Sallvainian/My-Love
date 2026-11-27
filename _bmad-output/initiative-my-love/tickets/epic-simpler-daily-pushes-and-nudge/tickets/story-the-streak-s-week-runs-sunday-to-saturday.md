---
id: 3
type: story
title: "The streak's week runs Sunday to Saturday"
parent: epic-simpler-daily-pushes-and-nudge
covers: ["R5"]
sources: ["_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md", "_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md", "_bmad-output/initiative-my-love/tickets/epic-streak-and-partner-page/epic-streak-and-partner-page.md"]
after: [2]
refined: true
hitl: false
risk: medium
---

# The streak's week runs Sunday to Saturday

## Description

The streak's row of seven dots, at the top of Daily and on the Partner page's streak card, shows the last seven days ending with today. It changes to the calendar week: Sunday to Saturday, always in that order, with today ringed in its own weekday slot and the days after today not reached yet. Every day that is not done yet is the same plain grey circle, and the ring alone marks today. The server works out the week, as it works out every day's state now (spine AD-7), in a new field beside `week`, so installed builds keep their last-seven-days row until they take the live update. This story delivers the epic's R5, after story 2, as all three stories change migrations and the regenerated database types.

## Requirements

1. **The row is the calendar week** (R5)
   **Given** a linked person whose streak has loaded
   **When** Daily or the Partner page shows the streak's row
   **Then** its seven slots are Sunday to Saturday of the week holding the person's current date, in that order, each labelled with its weekday letter (S M T W T F S)
   **And** no slot reads "Today"

2. **Today is ringed in its own slot** (R5)
   **Given** today is any day of the week, Sunday and Saturday included
   **When** the row shows
   **Then** today's dot sits in its weekday's slot with the ring the app draws around today now (`src/components/shared/StreakWeek.tsx:81`)
   **And** no other slot has the ring

3. **A day not done yet is a plain grey circle** (R5)
   **Given** a day of the week that is neither done nor missed: today before both partners answer, a day after today, or a day before the couple's first day
   **When** the row shows
   **Then** its dot is a filled grey circle the size of a done or missed dot, with no dashes
   **And** every such dot is the same grey, today's included, so only the ring sets today apart

4. **Done and missed days keep their look** (R5)
   **Given** a day of the week that is done or missed
   **When** the row shows
   **Then** a done day is the check on fire and a missed day the snowflake on cold, as now
   **And** a day after today is never done or missed

5. **The server gives the calendar week** (R5)
   **Given** the streak's answer (`get_couple_streak`, through `couple_streak`)
   **When** it is read at any instant
   **Then** it carries, beside `week`, the seven days Sunday to Saturday of the week holding the viewer's current date, each with its state worked out by the server, the days after the viewer's date marked not reached
   **And** `week` is unchanged: the last seven days, oldest first, ending on the viewer's date

6. **Installed builds keep their row** (R5)
   **Given** an installed build from before this story that has not taken the live update
   **When** it reads the streak from the server this story builds, on the shared local stack
   **Then** its schema accepts the answer
   **And** its row shows the last seven days, as before

7. **A streak saved before the update** (R5)
   **Given** a streak saved on the device before this story, which has no calendar week
   **When** Daily or the Partner page shows it, offline or before the first successful read
   **Then** the row shows the saved last seven days, oldest first, with today last
   **And** the first successful read replaces it with the calendar week

8. **The written rules match** (R5)
   **Given** the story is built
   **When** spine AD-7 is read
   **Then** it describes the calendar week beside `week`, and which screens read each

## Boundaries

- Must not change: `week`, its days, order and states. Installed builds read it, and so do the missed-day banner (`coldBannerWords`, `src/components/DailyQuestion/DailyQuestion.tsx:189-191`) and the +1 screen.
- Must not change: the held count, the run, the colours, the chip, the cold banner's words and the milestones.
- Must not change: the +1 screen's row (`src/components/DailyQuestion/StreakUp.tsx:54`, `:157`); the owner named Daily's row and the Partner card's.
- Must not change: no client works out a day's state (spine AD-7); the client draws what the server gives.
- Out: dropping `week`, which the banner and the +1 screen still read.

## References

- epic — _bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md, Requirements (R5) and Notes
- built by — _bmad-output/initiative-my-love/tickets/epic-streak-and-partner-page/epic-streak-and-partner-page.md, R3 and R6 (the week strip on Daily and the Partner page)
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, AD-3, AD-7, AD-10
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, the week strip on Today's question and the Partner page, changed by this story's Decisions

## Notes

- Decision: 2026-11-27 (owner) the row shows the calendar week, Sunday to Saturday, always in that order, with today highlighted in its own weekday slot, the way Duolingo's week row does; days later in the week than today show as not yet reached. It applies to the row at the top of Daily and the one on the Partner page's streak card.
- Decision: 2026-11-27 (owner) placed in epic 11 as its own story, after story 2.
- Decision: 2026-11-27 (owner) the server sends the calendar week in a new field beside `week`. Installed builds accept exactly seven days in the states done, missed or open (`src/api/validation/dailyQuestionSchemas.ts:64-84`), so a new state in `week` would fail their streak read.
- Decision: 2026-11-27 (owner) every slot shows its weekday letter, and "Today" goes.
- Decision: 2026-11-27 (owner) a day not done yet is a plain grey circle like the other days, not today's dashed shape. Today keeps the ring the app draws now, and the days after today are the same grey as today's circle: the ring alone marks today.
- Decision: 2026-11-27 (owner) a streak saved before the update shows its saved last seven days until the first successful read.
- Code (2026-11-27): the dot for an open day draws as a short vertical stack of dashes, not a ring: its `<span>` (`StreakWeek.tsx:47`) is inline, so its `h-[26px] w-[26px]` do not apply (seen in a Playwright screenshot of `daily-streak`). Criterion 3 replaces it.
- Code (2026-11-27): `week` is drawn by `StreakWeek` on Daily (`DailyQuestion.tsx:738`) and the Partner card (`src/components/PartnerView/StreakCard.tsx:90`). The saved copy is parsed with `CoupleStreakSchema` (`src/services/dailyStreakCopy.ts:38-39`), which drops a copy that fails it, so criterion 7 needs a saved copy without the new field to parse. `couple_streak` is in `supabase/migrations/20261107010000_couple_streak.sql`, pinned by `supabase/tests/database/45_couple_streak.sql`; `get_couple_streak` is in the AD-5 gate file and FN-GRANT-008, and `src/types/database.types.ts` is regenerated with `npm run db:types` (spine AD-15).
- From the spine (AD-3, AD-7): the viewer's current date, and so the week, is on the viewer's stored zone, UTC with no row.
- From AGENTS.md (Known pitfalls), test time: the server's week is proven with fixed instants passed to `couple_streak`; the screens with faked time in unit tests, or an E2E page clock from `clockAnchor()`.
- Risk medium: it changes the function every streak read uses. pgTAP pins the new field and an unchanged `week`, and the old build's schema is tested against the new answer.
