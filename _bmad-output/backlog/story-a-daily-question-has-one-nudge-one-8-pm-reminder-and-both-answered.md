---
id: 6
type: story
title: "A daily question has one nudge, one 8 PM reminder and the both-answered push"
parent:
covers: []
sources: ["_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md", "_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md", "_bmad-output/initiative-my-love/deferred-work.md"]
after: []
refined: true
hitl: false
risk: high
---

# A daily question has one nudge, one 8 PM reminder and the both-answered push

## Description

Epic 8's daily pushes are cut down to three: the partner's nudge, one 8 PM reminder to whoever has not answered, and both answered. Their switches go down to three as well. A nudge is sent once per daily question, and only from the prompt right after the person answers, so the waiting card loses its Nudge button. "Answer" here means a pick, as Daily's Send my pick makes it.

## Requirements

1. **No 8 AM push**
   **Given** a linked person with a push device and a stored time zone who has not answered today's question
   **When** it is 08:00 to 08:30 on their own clock and the server's schedule runs
   **Then** no push is recorded or sent to them

2. **No push when the partner answers first**
   **Given** neither partner has answered today's question
   **When** one of them answers
   **Then** the other gets no push for that answer
   **And** the only push that answer can lead to is a nudge the person sends from the prompt (criterion 7)

3. **The 8 PM reminder goes only to whoever has not answered**
   **Given** a linked person with a push device and a stored time zone who has not answered that day's question
   **When** it is 20:00 to 20:30 on their own clock and the server's schedule runs
   **Then** they get one push titled "Time's running out!", with the body "Answer your daily question before the day is over!", playing the default notification sound, and a tap opens Daily
   **And** a person who has answered gets no 8 PM push, whether or not their partner has answered

4. **The prompt shows right after an answer while the partner has not answered**
   **Given** the partner has not answered today's question, and the write sheet does not show after this answer
   **When** the person's answer is confirmed
   **Then** "Do you want to nudge your partner?" shows once, with Nudge and Not now
   **And** it does not show when the partner has already answered

5. **When the write sheet shows, the prompt follows it**
   **Given** the write sheet shows after the person's answer and the partner has not answered
   **When** the write sheet closes in any way: by writing tomorrow's question, by "No thanks", by a tap outside it or by Escape
   **Then** the nudge prompt shows, as in criterion 4
   **And** it does not show if the partner answered while the write sheet was open

6. **An answer saved offline offers the prompt when it sends**
   **Given** the person answered while offline and the answer is waiting to send
   **When** it is sent while Daily is open and the partner has not answered
   **Then** the nudge prompt shows, as in criteria 4 and 5
   **And** when Daily is not open at that moment, the prompt is not offered later

7. **The nudge**
   **Given** the prompt is showing
   **When** the person taps Nudge and the server records it
   **Then** the partner gets a push titled "{Partner} nudged you", with the body "{Partner} answered the daily question and wants to know your answer!", playing the default notification sound, and a tap opens Daily
   **And** the prompt closes

8. **Not now, or any other close, ends the chance for that question**
   **Given** the prompt is showing
   **When** the person taps Not now, taps outside the prompt, or presses Escape
   **Then** the prompt closes
   **And** Daily offers no nudge for that question again: not after a reload, not on a return to Daily, and not on the waiting card

9. **The waiting card has no Nudge button**
   **Given** the person has answered and the partner has not
   **When** Daily shows the waiting card
   **Then** it shows no Nudge button, whatever the time

10. **One nudge per sender per daily question**
    **Given** the person has sent a nudge for a daily question
    **When** a second nudge for the same question reaches the server, through a retry or a direct request
    **Then** the server refuses it and records nothing
    **And** the limit does not reset at 20:00, or when the sender's own clock passes midnight while the partner is still on that day

11. **A partner with Nudges off, or with no push device**
    **Given** the partner has turned the Nudges switch off, or has no push device
    **When** the person taps Nudge
    **Then** the person sees the same result as any sent nudge, and nothing tells them the partner's setting or devices
    **And** no push reaches the partner, and the nudge counts as the person's one nudge for that question

12. **A send whose answer is lost is not shown as failed** (DW-539)
    **Given** the prompt is sending a nudge
    **When** the request times out or fails on the network
    **Then** no failure line shows at first, and Daily re-reads the day
    **And** if the re-read has the nudge recorded, the prompt closes as for a sent nudge; if not, it shows "Your nudge could not be sent." and Nudge stays enabled, and a second tap cannot send a second nudge (criterion 10)

13. **Settings shows three daily switches**
    **Given** a signed-in person on Settings > Notifications
    **When** the page shows "Notify me about"
    **Then** the daily switches are Nudges, Evening reminder and Both answered, and New question and Partner picked are gone
    **And** the Notifications row's On, Off and Some value counts the switches that remain

14. **The live check nudges from the prompt**
    **Given** the bot pair, with bot A answering first, run by the live check in its local mode
    **When** A answers (and, on A's writing day, answers the write sheet "No thanks")
    **Then** A sees the nudge prompt, taps Nudge, and the project's nudge request is sent once and answered 200
    **And** after a reload, A's day answer has the nudge spent, and A sees neither the prompt nor a Nudge button

15. **The written rules match**
    **Given** the story is built
    **When** `push-copy.md` and the architecture spine (AD-4, AD-9, AD-10, AD-13, AD-16, AD-17 and the Consistency Conventions' push kinds) are read
    **Then** they describe the three remaining pushes and their switches, the one evening reminder, and one nudge per sender per daily question from the after-answer prompt
    **And** none of them names the 8 AM push, the partner-picked push, the `evening_partner` reminder, or a nudge slot (`after_pick`, `evening`)

## Boundaries

- Must not change: the both-answered push, its copy (including "That day counts." for a late pick) and its switch.
- Must not change: every remaining push keeps the badge and the `partner-activity` lock-screen group.
- Must not change: the nudge's other refusals. The sender must have answered, the partner must not have, and the day must be the partner's current date. A refused send shows "Your nudge could not be sent.", and a nudge offline refuses with the offline message.
- Must not change: the prompt closes for good when the partner answers while it is open.
- Must not change: date reminders and how the phone schedules them; the love-note, photo, date and partner-request pushes and their switches.
- Out: removing the mood, poke and kiss pushes and switches (epic 10).

## References

- epic — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge.md, Requirements (R2 to R6) and Notes
- parent — _bmad-output/initiative-my-love/initiative-my-love.md, Requirements (R13, R14, R19)
- copy — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, boards `Notification.dc.html` (The nudges) and `Waiting.dc.html` (Waiting on Jessie)
- design — _bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md, sections Top page rows and Subpages
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, AD-4, AD-9, AD-10, AD-13, AD-16, AD-17, Consistency Conventions
- retrospective — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md, Findings (F1, F5: R6 and R7), Action items (3), Acceptance verdict
- ledger — _bmad-output/initiative-my-love/deferred-work.md, DW-532, DW-536, DW-539, DW-548

## Notes

- Decision: 2026-11-26 (owner) the 8 AM `daily_question` push and its New question switch are removed. The automatic `daily_partner_picked` push and its Partner picked switch are removed, and the person's nudge replaces it. The 8 PM `evening_partner` reminder is removed.
- Decision: 2026-11-26 (owner) each new wording is split into a title and a body. The 8 PM reminder is titled "Time's running out!", with the body "Answer your daily question before the day is over!". The nudge keeps the title "{Partner} nudged you", with the body "{Partner} answered the daily question and wants to know your answer!".
- Decision: 2026-11-26 (owner) a nudge is sent only from the prompt after an answer, while the partner has not answered. The waiting card's Nudge button is removed. Not now, a tap outside the prompt or Escape ends the chance for that question.
- Decision: 2026-11-26 (owner) when the write sheet shows after an answer, the prompt shows after it closes, however it closes. This replaces epic 8's 2026-11-25 rule that the prompt never shows on an open where the write sheet showed.
- Decision: 2026-11-26 (owner) an answer saved offline offers the prompt when it sends while Daily is open.
- Decision: 2026-11-26 (owner) one nudge per sender per daily question (each person's own local day) replaces the `after_pick` and `evening` slots. This supersedes the decisions recorded on DW-532 and DW-536. The build closes both entries in the ledger.
- Decision: 2026-11-26 (owner) a nudge to a partner with Nudges off, or with no push device, counts as sent, and the sender is not told (retrospective R6). Removing the button settles R7.
- Decision: 2026-11-26 (owner) DW-539's rule, "unknown is not failed", is built here for the prompt (criterion 12). The build closes DW-539.
- Decision: 2026-11-26 (owner) the build updates `push-copy.md` and the spine's rules itself, as the owner's list for this story asks.
- Decision: 2026-11-26 (owner) the `push_preferences` columns for New question and Partner picked stay in the database. Installed app builds read them by name until they take the live update, so dropping them now would fail those builds' Settings reads. Only the switches and the server's sends go. The later drop is DW-548.
- Decision: 2026-11-26 (owner) this is a backlog story, built before epic 9 starts (epic 9's Notes record it). Epic 9 waits on epic 8's migrations and types, and this story changes both.
- Decision: 2026-11-26 (owner) the initiative's R13, R14 and R19 are reworded to this story (`d7963f01`).
- Covers, without a ledger entry (owner, 2026-11-26): the retrospective's F1c (the single 20:00 re-read), R3 (the sender's other device keeps a stale Nudge button) and the waiting card's copy of the nudge-send handler. All three go with the button and the slots.
- Code (kept by the owner): date reminders are `src/services/dateReminders.ts` and `reminderIdsToCancel`.
- Risk high: it changes the hosted nudge limit, the 8 PM schedule and the post-deploy live check. Check beyond the criteria: after the deploy, the Live Daily Check passes on production, and `daily-reminders` runs on hosted still succeed.
