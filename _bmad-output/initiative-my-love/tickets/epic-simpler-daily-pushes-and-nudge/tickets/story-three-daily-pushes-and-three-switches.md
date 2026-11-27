---
id: 2
type: story
title: "Three daily pushes and three switches"
parent: epic-simpler-daily-pushes-and-nudge
covers: ["R2", "R3", "R4"]
sources: ["_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md", "_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md", "_bmad-output/initiative-my-love/deferred-work.md"]
after: [1]
refined: true
hitl: false
risk: medium
---

# Three daily pushes and three switches

## Description

Epic 8's daily pushes come down to three: the partner's nudge (story 1), one 8 PM reminder to whoever has not answered, and both answered, and their switches come down to three as well. The both-answered push gets one wording, whatever the day or the streak. The app and `send-push` stop reading and writing the two removed switches' columns, which stay in the database for epic 10 to drop. This story delivers the epic's R2, R3 and the column part of R4, after story 1, which changes the same schedule function and `send-push`. "Answer" here means a pick, as Daily's Send my pick makes it.

## Requirements

1. **No 8 AM new-question push** (R2)
   **Given** a linked person with a push device and a stored time zone who has not answered today's question
   **When** it is 08:00 to 08:30 on their own clock and the server's schedule runs
   **Then** no new-question push is recorded or sent to them
   **And** the nudges held for them (story 1) are the only pushes the schedule sends in that window

2. **No push when the partner answers first** (R2)
   **Given** neither partner has answered today's question
   **When** one of them answers
   **Then** the other gets no push for that answer
   **And** the only push that answer can lead to is a nudge the person sends from the prompt or the waiting card's button (story 1)

3. **The 8 PM reminder goes only to whoever has not answered** (R2)
   **Given** a linked person with a push device and a stored time zone who has not answered that day's question
   **When** it is 20:00 to 20:30 on their own clock and the server's schedule runs
   **Then** they get one push titled "Time's running out!", with the body "Answer your daily question before the day is over!", playing the default notification sound, and a tap opens Daily
   **And** a person who has answered gets no 8 PM push, whether or not their partner has answered

4. **Settings shows three daily switches** (R3)
   **Given** a signed-in person on Settings > Notifications
   **When** the page shows "Notify me about"
   **Then** the daily switches are Nudges, Evening reminder and Both answered, and New question and Partner picked are gone
   **And** the Notifications row's On, Off and Some value counts the switches that remain

5. **A switch off stops only its own push** (R3)
   **Given** a person has turned off one of Nudges, Evening reminder or Both answered
   **When** a push of that kind would go to them
   **Then** none is sent to them
   **And** their other two daily pushes still arrive, and their partner's pushes of that kind still arrive

6. **The removed switches' columns are no longer read or written** (R4)
   **Given** a signed-in person on Settings > Notifications
   **When** the page loads their switches, and when they turn any switch on or off
   **Then** no request from the app names the New question or Partner picked column
   **And** `send-push` names neither column when it reads a recipient's switch

7. **Installed builds keep their Settings** (R4)
   **Given** an installed build from before this epic that has not taken the live update
   **When** it opens Settings > Notifications and turns a switch on or off against the server this story builds, on the shared local stack
   **Then** it loads and saves its switches as before, New question and Partner picked included
   **And** both columns still exist, with their stored values kept

8. **Stored reminders of the removed kinds are gone** (R2)
   **Given** stored 8 AM (`morning`) and 8 PM `evening_partner` reminders from before this story
   **When** the story's migration has run
   **Then** none of them remains, and the evening reminder to whoever has not answered is the only kind a new reminder can have
   **And** the stored reminders of that remaining kind are kept

9. **The written push rules match** (R2, R3)
   **Given** the story is built
   **When** `push-copy.md` and the architecture spine (AD-4, AD-9, AD-10, AD-17, the Consistency Conventions' push kinds and View rows, the Structural Seed's sequence diagram and the Capability map's R14 row), and the Settings UX spine's Notifications switch lists are read
   **Then** they describe the three remaining pushes and their switches, the one evening reminder and the both-answered push's one wording
   **And** none of them names the 8 AM push, the partner-picked push, the `evening_partner` reminder, the both-answered push's streak titles or "That day counts." as current

10. **Both answered has one wording** (R2)
    **Given** one partner has answered a daily question
    **When** the other answers it, on that question's day or after the day has ended on either partner's clock
    **Then** the first gets one push titled "You both answered today's question", with the body "Click to see what your partner answered!", playing no sound, and a tap opens Daily
    **And** it reads the same whatever the streak: no both-answered push names a streak count, the partner's name or "That day counts."

## Boundaries

- Must not change: when the both-answered push is sent, and its switch; only its wording changes (criterion 10).
- Must not change: every remaining push keeps the badge and the `partner-activity` lock-screen group.
- Must not change: story 1's nudge, its prompt, the waiting card's button, their limits, the hold and the closing instant.
- Must not change: date reminders and how the phone schedules them; the love-note, photo, date and partner-request pushes and their switches.
- Must not change: a tap on a removed kind's push, delivered before the deploy and tapped after, still opens Daily.
- Out: dropping the New question and Partner picked columns (epic 10, DW-548).
- Out: removing the mood, poke and kiss pushes and switches (epic 10).

## References

- epic — _bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md, Requirements (R2, R3, R4), Constraints and Notes
- parent — _bmad-output/initiative-my-love/initiative-my-love.md, Requirements (R14, R19)
- copy — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md
- design — _bmad-output/initiative-my-love/ux-settings-page/DESIGN.md, section Components
- design — _bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md, sections Top page rows and Subpages
- design — _bmad-output/initiative-my-love/ux-settings-page/mockups/key-settings-v2.html, frame 9 (Notifications)
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, AD-4, AD-9, AD-10, AD-17, Consistency Conventions
- retrospective — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md, Action items (8)
- ledger — _bmad-output/initiative-my-love/deferred-work.md, DW-526, DW-548

## Notes

- Decision: 2026-11-26 (owner) backlog story 6 is split into story 1 and this story and moved into epic 11 (epic Notes).
- Decision: 2026-11-26 (owner) the 8 AM `daily_question` push and its New question switch are removed. The automatic `daily_partner_picked` push and its Partner picked switch are removed, and the person's nudge replaces it. The 8 PM `evening_partner` reminder is removed.
- Decision: 2026-11-26 (owner) each new wording is split into a title and a body. The 8 PM reminder is titled "Time's running out!", with the body "Answer your daily question before the day is over!".
- Decision: 2026-11-26 (owner) criterion 1 and the initiative's R14 say "no 8 AM new-question push", because a held nudge (story 1) arrives at 8 AM.
- Decision: 2026-11-26 (owner) the `push_preferences` columns for New question and Partner picked stay in the database. Installed app builds read them by name until they take the live update, so dropping them now would fail those builds' Settings reads. This deploy stops the app and `send-push` reading and writing them, as spine AD-10's "stop reading, ship, then drop" requires (`architecture-daily-question.md:158`); epic 10 drops them (DW-548).
- Decision: 2026-11-26 (owner) the migration deletes the stored `morning` and `evening_partner` reminders and narrows the allowed kinds to the remaining one (criterion 8). Only the server job writes and reads `daily_reminders`, so no installed build depends on them. The hosted catalog check found 2 `morning` rows and no `evening_partner` row (epic Notes).
- Decision: 2026-11-26 (owner) the build updates `push-copy.md` and the spine's push rules itself (criterion 9); story 1 updates the nudge rules.
- Decision: 2026-11-26 (owner) the initiative's R13, R14 and R19 are reworded to this epic (`d7963f01`, and R13 and R14 again on 2026-11-26).
- Ledger: the 2026-11-26 triage closed DW-526 as moved to this work, so the build has no ledger entry to close for it.
- Covers DW-526 (owner, 2026-11-26): removing the `evening_partner` reminder removes the only reminder that names the sender (`send-push/handler.ts:490`), so a re-pairing between enqueue and send can no longer name the new partner on the old pair's day. Only `evening_self` remains, and it names nobody.
- Decision: 2026-11-26 (PO's pick, owner approved) the 08:00 tick stops assigning the partner's day: no morning push quotes it any more, and a held nudge (story 1) carries the day it was sent about. This narrows DW-498.
- Code (owner-cited): the two columns are read and written through `src/services/pushPreferencesService.ts:82-83`, `:99-100` and `:119-120`. The `COLUMN` map at `:99-100` feeds both the read (`:134`) and the write, which sets the one column at `:158` and reads the row back at `:162`. `send-push` reads one switch column per kind (`supabase/functions/send-push/index.ts:196-200`, `PREFERENCE_FOR_KIND` in `handler.ts:192`). Other sites that carry the two switches: the `push-preferences` local copy (`src/stores/slices/notificationsSlice.ts:58-84`), the On, Off and Some count (`src/components/Settings/notificationsStatus.ts:21-22`), and `VIEW_FOR_KIND` (`src/services/pushNotifications.ts:166-167`), which still has to open Daily for a removed kind's push delivered before the deploy and tapped after.
- Code (owner-cited): the Settings UX spine's Notifications switch lists are `_bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md:89` and `:109`; today they list no daily switch, so criterion 9 adds the three that remain.
- Code (kept by the owner): date reminders are `src/services/dateReminders.ts` and `reminderIdsToCancel`.
- Decision: 2026-11-27 (owner) the both-answered push always reads "You both answered today's question", with the body "Click to see what your partner answered!". The late-pick case and "That day counts." are dropped entirely, and the streak titles go with them. The owner put it in this story if small and similar enough; the PO judged it so, as it changes one payload builder and the `push-copy.md` rows this story already rewrites.
- Code (2026-11-27): the both-answered copy is `buildDailyBothAnsweredPayload` (`supabase/functions/send-push/payload.ts:272-277`) with `DAILY_LATE_TAIL` (`:68`); `send-push` passes it the run and the late flag (`handler.ts:437`, `:448`, `:454`), so the run read and the late flag go for this kind.
- Risk medium: it removes pushes and switches, and the one remaining reminder keeps its schedule; story 1 carries the hosted risk.
