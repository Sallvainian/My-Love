---
id: 1
type: story
title: "Two nudges per question, held until the partner's 8 AM"
parent: epic-simpler-daily-pushes-and-nudge
covers: ["R1", "R4"]
sources: ["_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md", "_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md", "_bmad-output/initiative-my-love/deferred-work.md"]
after: ["8.11"]
refined: true
hitl: false
risk: high
---

# Two nudges per question, held until the partner's 8 AM

## Description

A person who answers a daily question before their partner can nudge them about it from two places, each once per question: the prompt right after their answer, and the waiting card's Nudge button. Every nudge sent before 08:00 on the partner's clock is recorded at once and pushed at 08:00 there. The prompt and the button close by themselves when the question stops taking nudges. This story delivers the epic's R1 and the snapshot part of R4; story 2 then removes the other pushes and switches. "Answer" here means a pick, as Daily's Send my pick makes it.

## Requirements

1. **The prompt shows right after an answer while the partner has not answered** (R1)
   **Given** the partner has not answered today's question, that day has not ended on the partner's clock, and the write sheet does not show after this answer
   **When** the person's answer is confirmed
   **Then** "Do you want to nudge your partner?" shows once, with Nudge and Not now
   **And** it does not show when the partner has already answered, or when that day has ended on the partner's clock

2. **When the write sheet shows, the prompt follows it** (R1)
   **Given** the write sheet shows after the person's answer and the partner has not answered
   **When** the write sheet closes in any way: by writing tomorrow's question, by "No thanks", by a tap outside it or by Escape
   **Then** the nudge prompt shows, as in criterion 1
   **And** it does not show if the partner answered while the write sheet was open

3. **An answer saved offline offers the prompt when it sends** (R1)
   **Given** the person answered while offline and the answer is waiting to send
   **When** it is sent while Daily is open and the partner has not answered
   **Then** the nudge prompt shows, as in criteria 1 and 2
   **And** when Daily is not open at that moment, the prompt is not offered later

4. **The nudge** (R1)
   **Given** the prompt or the waiting card's button offers a nudge, it is 08:00 or later on the partner's clock on the question's day, and the partner's Nudges switch is on and they have a push device (criterion 10)
   **When** the person taps Nudge and the server records it
   **Then** the partner gets a push titled "{Partner} nudged you", with the body "{Partner} answered the daily question and wants to know your answer!", playing the default notification sound, and a tap opens Daily
   **And** the prompt closes, or the button shows as sent

5. **Not now, or any other close, ends only the prompt's chance** (R1)
   **Given** the prompt is showing and no send is in progress (criterion 16)
   **When** the person taps Not now, taps outside the prompt, or presses Escape
   **Then** the prompt closes, and Daily does not show it for that question again: not after a reload and not on a return to Daily
   **And** the waiting card's button still offers its own nudge about that question

6. **The waiting card keeps its own Nudge button** (R1)
   **Given** the person has answered and the partner has not
   **When** Daily shows the waiting card
   **Then** it shows a Nudge button, enabled while the button's own nudge about that question is unsent and the question still takes nudges
   **And** once the button's nudge is sent, the button shows as sent, greyed; grey always means sent
   **And** otherwise the button is hidden: an unsent button after the question's closing instant, or on an old saved day before the server answers (criteria 13, 14 and 19)

7. **One nudge per source per daily question** (R1)
   **Given** the person has sent a nudge about a daily question from the prompt or from the waiting card's button
   **When** a second nudge from the same source about the same question reaches the server, through a retry or a direct request
   **Then** the server refuses it and records nothing
   **And** a nudge from the other source about that question is still taken: using one never spends the other
   **And** the limit belongs to the question, not to a date: it does not reset at 20:00, or when the sender's clock passes midnight while the partner is still on that question

8. **A nudge about yesterday's question leaves today's open** (R1)
   **Given** the person nudged their partner about yesterday's question from the prompt and from the button
   **When** they answer today's question and the partner has not
   **Then** the prompt and the waiting card's button each offer a nudge about today's question
   **And** a nudge sent from either is recorded, and pushed as in criterion 4 or held as in criterion 11

9. **A sent nudge stays sent** (R1)
   **Given** the person has sent a nudge about a question from one source
   **When** a read of that day that started before the send answers after it, or Daily shows the day from its saved copy
   **Then** Daily still has that source's nudge sent: no prompt for that question if the prompt's was sent, and the button shown as sent if the button's was

10. **A partner with Nudges off, or with no push device** (R1)
    **Given** the partner has turned the Nudges switch off, or has no push device, at the moment the push would go out
    **When** the person taps Nudge on the prompt or the button
    **Then** the person sees the same result as for any sent nudge, and nothing tells them the partner's setting or devices
    **And** no push reaches the partner, and the nudge counts as that source's one nudge for that question

11. **A nudge sent before 08:00 on the partner's clock is held** (R1)
    **Given** the person has answered a question the partner has not, and on the partner's clock it is earlier than 08:00 on that question's day: the day has not started there, or it is between 00:00 and 08:00
    **When** the person taps Nudge on the prompt or the waiting card's button
    **Then** the server records the nudge at once, and it counts as that source's one nudge for that question
    **And** the person sees the same result as for any sent nudge, with no line about 8 AM and no other difference
    **And** no push goes out yet

12. **A held nudge goes out at the partner's 8 AM** (R1)
    **Given** a held nudge about a question
    **When** it is 08:00 to 08:30 on the partner's clock on that question's day and the server's schedule runs
    **Then** it sends its push once, with the copy and sound of criterion 4, when at that moment the partner has not answered that question, their Nudges switch is on and they have a push device, except as criterion 22 says for two nudges about one question
    **And** no push goes out when the partner has answered by then or has no stored time zone, and a window the schedule missed sends nothing later; in each case the nudge still counts as sent

13. **A nudge about a day that has ended on the partner's clock is refused** (R1)
    **Given** the person has answered a question whose day has already ended on the partner's clock
    **When** a nudge about it reaches the server from either source
    **Then** the server refuses it and records nothing
    **And** the prompt does not show for that answer (criterion 1), and the waiting card's button is hidden unless its nudge was sent (criterion 14)

14. **The prompt and the button close when the question stops taking nudges** (R1)
    **Given** the day's answer gives, with each source's spent state, the instant that question stops taking nudges: the end of that day on the partner's clock, as a UTC timestamp
    **When** that instant passes while the prompt or the waiting card's button offers a nudge
    **Then** at that instant, with no re-read of the day, the prompt's Nudge and the waiting card's button are hidden if their nudge was never sent, and a button whose nudge was sent stays shown as sent, greyed
    **And** a nudge that reaches the server after that instant is still refused (criterion 13)

15. **A held nudge leaves the partner's Daily on their own day** (R1)
    **Given** a held nudge has been recorded, and its live signal reaches the partner's device while their day has not started or it is before 08:00 there
    **When** the partner's Daily handles the signal
    **Then** Daily still shows the partner's own current day, with its question and its state

16. **A send whose answer is lost is not shown as failed** (R1; DW-539)
    **Given** the prompt or the waiting card's button is sending a nudge
    **When** the request times out or fails on the network
    **Then** no failure line shows at first, and Daily re-reads the day
    **And** until the re-read ends, the control that sent stays disabled (on the prompt, both Nudge and Not now), and a tap outside the prompt or Escape do nothing
    **And** if the re-read has that source's nudge recorded, the send ends as a sent nudge: the prompt closes, or the button shows as sent. If it has none, "Your nudge could not be sent." shows with Nudge enabled. If the re-read fails too, "We couldn't check if your nudge went through. Try again?" shows with Nudge enabled

17. **An "already sent" refusal is a sent nudge** (R1)
    **Given** an earlier nudge from the same source about this question reached the server, and that source still offers Nudge (after criterion 16, or on a stale screen on the person's other device)
    **When** the person taps Nudge and the server refuses it as already sent from that source
    **Then** the send ends as a sent nudge: the prompt closes, or the button shows as sent, and no failure line shows
    **And** the partner gets no second push from that source

18. **Installed builds still read the day** (R4)
    **Given** an installed build from before this epic that has not taken the live update
    **When** it reads a day from the server this story builds, on the shared local stack
    **Then** Daily loads and shows that day
    **And** the answer carries no `nudge` object, so that build shows no nudge prompt and keeps its Nudge button greyed until it takes the live update
    **And** a nudge such a build sends from a screen drawn before the deploy, through its old one-argument request, is taken as the button's nudge about that question

19. **Days saved by the old build still show offline** (R4)
    **Given** a device holding days that the build before this epic saved
    **When** the new build shows Daily offline
    **Then** those days show as they were saved, read by slot as criterion 23 reads the server's rows: a day saved with its `after_pick` slot sent has the prompt's nudge spent, and one saved with its `evening` slot sent shows the waiting card's button as sent
    **And** on a day saved with the button's nudge unsent, the waiting card's button is hidden until the server answers for that day

20. **The live check nudges from the prompt and from the button** (R1)
    **Given** the bot pair, with bot A answering first, run by the live check in its local mode
    **When** A answers (and, on A's writing day, answers the write sheet "No thanks")
    **Then** A sees the nudge prompt, taps Nudge, and the project's nudge request is sent once and answered 200
    **And** after a reload, A sees no prompt and an enabled Nudge button on the waiting card; A taps it, its request is sent once and answered 200, and after another reload the button shows as sent

21. **The written nudge rules match** (R1)
    **Given** the story is built
    **When** the architecture spine's AD-3, AD-9, AD-10, AD-13, AD-15, AD-16 and AD-17 are read
    **Then** they describe one nudge per sender per daily question from each of two sources, the after-answer prompt and the waiting card's button, keyed on the question and recorded with its source; every nudge sent before 08:00 on the partner's clock held and pushed at 08:00 by the `daily-reminders` job, which posts it when the hold ends rather than when it is inserted; the refusal once the day has ended on the partner's clock; and the day's answer giving each source's spent state and the question's closing instant, with no `nudge` object
    **And** none of them gives a nudge slot (`after_pick`, `evening`) or the sender's date as the limit

22. **Two nudges about one question send one push when one is held** (R1)
    **Given** the person sent both nudges about a question, from the prompt and from the waiting card's button, at least one of them is held (criterion 11), and both were sent before the schedule reached the held one
    **When** the server's schedule reaches the held nudge, 08:00 to 08:30 on the partner's clock on that question's day
    **Then** that tick sends at most one nudge push about that question: when both are held, the schedule queues one push, with the copy and sound of criterion 4, on the conditions of criterion 12; when the other was already pushed after the partner's 08:00, the held one is dropped and queues nothing
    **And** both nudges count as used, and neither is offered again for that question

23. **Nudges sent before this epic keep counting** (R1)
    **Given** nudges recorded before this epic's deploy
    **When** the epic's migration has run
    **Then** a nudge recorded in the `after_pick` slot counts as the prompt's nudge about its question, and one in the `evening` slot as the button's
    **And** that source is not offered again for that question, and the other source still is

24. **A nudge needs the partner link both ways** (R1)
    **Given** a person who has answered a daily question, whose `partner_id` names someone whose own `partner_id` is not that person
    **When** they nudge from the prompt or from the waiting card's button
    **Then** the server refuses the nudge and records nothing
    **And** the day's answer offers them no nudge (the offer's one-sided check is `20261126020000_daily_nudge.sql:303`)

## Boundaries

- Must not change: the nudge's other refusals. The sender must have answered, and the partner must not have. A refused send shows "Your nudge could not be sent.", and a nudge offline refuses with the offline message.
- Must not change: the prompt closes for good when the partner answers while it is open.
- Must not change: the both-answered push, its copy and its switch; every remaining push keeps the badge and the `partner-activity` lock-screen group.
- Must not change: date reminders and how the phone schedules them; the love-note, photo, date and partner-request pushes and their switches.
- Out: removing the 8 AM, partner-picked and `evening_partner` pushes, the New question and Partner picked switches, and the reads of their columns (story 2).
- Out: dropping the two columns (epic 10, DW-548).

## References

- epic — _bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/epic-simpler-daily-pushes-and-nudge.md, Requirements (R1, R4), Constraints and Notes
- parent — _bmad-output/initiative-my-love/initiative-my-love.md, Requirements (R13)
- copy — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, boards `Notification.dc.html` (The nudges) and `Waiting.dc.html` (Waiting on Jessie)
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, AD-2, AD-3, AD-5, AD-8, AD-9, AD-10, AD-11, AD-13, AD-15, AD-16, AD-17
- retrospective — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md, Findings (F1, F5: R3, R6 and R7), Action items (3, 8)
- ledger — _bmad-output/initiative-my-love/deferred-work.md, DW-532, DW-533, DW-536, DW-538, DW-539

## Notes

- Decision: 2026-11-26 (owner) backlog story 6 is split into this story and story 2 and moved into epic 11 (epic Notes).
- Decision: 2026-11-26 (owner) each new wording is split into a title and a body. The nudge keeps the title "{Partner} nudged you", with the body "{Partner} answered the daily question and wants to know your answer!" (criterion 4), replacing `push-copy.md`'s streak body; story 2 updates `push-copy.md`.
- Decision: 2026-11-26 (owner, change of decision A) the waiting card keeps its Nudge button beside the after-answer prompt. Each has its own nudge per daily question, one from the prompt and one from the button. The limit is keyed on the question (`day_id`), never the sender's date, and using one never spends the other. Not now closes only the prompt; the button shows as sent, greyed, once its nudge is sent. The server records which of the two a nudge used, and the day's answer says, for each, whether it is spent. This replaces the same day's earlier decision to remove the button and send a nudge only from the prompt.
- Decision: 2026-11-26 (owner) when the write sheet shows after an answer, the prompt shows after it closes, however it closes. This replaces epic 8's 2026-11-25 rule that the prompt never shows on an open where the write sheet showed.
- Decision: 2026-11-26 (owner) an answer saved offline offers the prompt when it sends while Daily is open.
- Decision: 2026-11-26 (owner) one nudge per sender per daily question from each source, keyed on the question, replaces the `after_pick` and `evening` slots. This supersedes the decisions recorded on DW-532 and DW-536.
- Decision: 2026-11-26 (owner) a nudge to a partner with Nudges off, or with no push device, counts as sent, and the sender is not told (retrospective R6).
- Decision: 2026-11-26 (owner) a partner who is ahead answers before the other partner's day has started, and today's server refuses that nudge (DQ009, `supabase/migrations/20261126020000_daily_nudge.sql:150-152`). Every nudge sent before 08:00 on the partner's clock on that question's day, whether the day has not started there or it is between 00:00 and 08:00, is held: it is recorded at once, counts as that source's nudge, and is pushed at 08:00-08:30 on the partner's clock, or not at all if the partner has answered by then. It rides the existing five-minute `daily-reminders` pg_cron job. The old rule "the day must be the partner's current date" becomes: refused once the day has ended on the partner's clock, held before 08:00 there.
- Decision: 2026-11-26 (owner) for a held nudge, the sender sees only the normal sent result. The push has the nudge's copy and sound, and follows the partner's Nudges switch and devices as they are at 8 AM. A missed window sends nothing (spine AD-9). A partner with no stored zone gets no scheduled push (spine AD-3), so a nudge held for them never goes out but still counts. A day that has ended on the partner's clock is refused, and the prompt does not show.
- Decision: 2026-11-26 (owner) when both of a sender's nudges for one daily question are held at 08:00 on the partner's clock, the partner gets one push, not two. Both nudges count as used and neither comes back for that question. A nudge sent after the partner's 08:00 goes out at once as before. When the sender's other nudge has already been pushed after the partner's 08:00, the held nudge is dropped when the job reaches it: no second push, and both nudges count as used (criterion 22).
- Decision: 2026-11-26 (owner, change of decision B) with each source's spent state, the day's answer gives the instant that question stops taking nudges: the end of that day on the partner's clock, as a UTC timestamp. The prompt and the button disable themselves at that instant, with no re-read; the server still refuses a late nudge. Refined the same day: a control that was never sent is hidden rather than disabled (criterion 14, and the hidden-control Decision below).
- Decision: 2026-11-26 (PO's pick, owner approved) a held nudge keeps its live signal, and the partner's Daily still shows their own current day (criterion 15).
- Decision: 2026-11-26 (owner) the server leaves `nudge` out of the day's answer, so builds from before this epic cannot nudge until they take the live update. Their schema makes the whole `nudge` object optional, so leaving it out is safe, while removing or renaming `slot` or `spent`, or giving `slot` a new value, fails their parse and Daily will not load.
- Decision: 2026-11-26 (owner) since old builds get no `nudge` object, the new per-source state and closing instant go in a field those builds do not read.
- Decision: 2026-11-26 (owner) retrospective R7 (what a greyed button tells the sender) is settled by the button showing as sent (change of decision A) and closing at the question's closing instant (change of decision B).
- Decision: 2026-11-26 (PO's pick, owner approved) a build from before this epic keeps its one-argument `send_daily_nudge(day_id)`, and a nudge it sends counts as the button's (criterion 18). On a day the old build saved with the button's nudge unsent, the button is hidden until the server answers (criterion 19).
- Decision: 2026-11-26 (owner) hosted nudges from before this epic are mapped: `after_pick` to the prompt, `evening` to the button (criterion 23). The read-only hosted catalog check on 2026-11-26 found 1 such row and no sender with two rows of one slot, or both slots, for one question (epic Notes).
- Decision: 2026-11-26 (owner) on a stack holding two rows of one slot from one sender for one question (the DW-532 case; none on hosted or the local stack on 2026-11-26), the migration keeps the earliest and drops the rest.
- Decision: 2026-11-26 (owner) saved days from the old build are read by slot, as criterion 23 reads the server's rows: `after_pick` sent means the prompt is spent, `evening` sent means the button is spent; the stays-sent merge (criterion 9) keeps no exception (criterion 19).
- Decision: 2026-11-26 (owner) a nudge control that cannot be used and was never sent is hidden, not greyed: after the question's closing instant (criterion 14), and while an old saved day waits for the server's answer (criterion 19). Grey always means sent. Builds from before this epic need no rule for this (criterion 18).
- Decision: 2026-11-26 (owner) the story is renamed "Two nudges per question, held until the partner's 8 AM".
- Decision: 2026-11-26 (owner) DW-539's rule, "unknown is not failed", is built here for both sends (criterion 16). A failed re-read shows "We couldn't check if your nudge went through. Try again?" with Nudge enabled. The re-read counts as part of the send. An "already sent" refusal ends the send as a sent nudge, never as a failure, counted per source (criterion 17).
- Decision: 2026-11-26 (owner) until story 2 removes it, the 8 PM `evening_partner` reminder is skipped when the recipient has sent a nudge about that day's question, in place of the spent `evening` slot. Both stories ship in one loop run, one PR and one deploy (epic Notes), so this interim never reaches production.
- Decision: 2026-11-26 (owner) the build updates the spine's rules and `push-copy.md` itself. The PO split that work: this story updates the nudge rules (criterion 21), and story 2 updates `push-copy.md` and the push rules.
- Ledger: the 2026-11-26 triage closed DW-532, DW-533, DW-536 and DW-539 as moved to this story, so the build has no ledger entry to close for them. DW-538 keeps the rest of the stale screen across midnight; this story covers its nudge button (criterion 14).
- Covers, without a ledger entry (owner, 2026-11-26): the retrospective's F1c (the single 20:00 re-read) goes with the slots. R3 (the sender's other device keeps a stale Nudge button) is criterion 17: a tap there is refused as already sent and the button shows as sent. The waiting card's copy of the nudge-send handler: criteria 16 and 17 hold both sends to one rule.
- Covers DW-533 (owner, 2026-11-26): the source replaces the slot. It comes from the tap, not the sender's clock, so `daily_nudge_slot`, the second read of the sender's stored zone in `record_daily_nudge` (`20261126020000_daily_nudge.sql:154-155`), goes. At most one read of the sender's zone may remain.
- Test isolation (DW-528, DW-530): the `api` spec that sends a held nudge through `enqueue_daily_reminders(at)` uses an instant at which no other account on the shared stack is due, checked with that spec's `otherAccountsDueAt` guard, since the function acts on every due account.
- Code (owner-cited): `keepNudgeSpent` (`src/services/dailyDaysCopy.ts:75-84`) is the client's per-slot spent rule that criterion 9 replaces with one per question and source. The old builds' snapshot schema is `src/api/validation/dailyQuestionSchemas.ts:46-51`. `parseSavedDays` in `dailyDaysCopy.ts` drops a saved day that fails the schema (criterion 19). `NUDGE_REFUSAL_CODES` (`src/api/dailyQuestionApi.ts:94-100`) counts DQ010 ("Nudge already sent") as a failure today (criterion 17). The nudge's body is built in `supabase/functions/send-push/payload.ts:242-246`. A confirmed nudge broadcasts `daily_nudge` (`src/api/validation/broadcastSchemas.ts:27-33`), and the partner's device re-reads that day (`src/hooks/useDailyPickListener.ts:69-72`).
- From story 2's owner decision (2026-11-26) that `daily_reminders` keeps only the evening kind: a held nudge's 8 AM push is not a `daily_reminders` row.
- From the spine (AD-2, AD-3): for a partner with no stored zone, the clock for the hold and the closing instant is UTC, as their days close on UTC.
- From AGENTS.md (Known pitfalls), test time: the closing instant (criterion 14) is proven with faked time in unit tests, or an E2E page clock from `clockAnchor()` at or behind real time; 08:00, 20:00, midnight and the hold with fixed instants passed to the server's functions.
- Code (review finding, confirmed on main 2026-11-27, owner asked the build to cover it): `record_daily_nudge` checks the partner's date but not that the partner link goes both ways. It reads only the viewer's `users.partner_id` (`20261126020000_daily_nudge.sql:119`) and checks that the day belongs to the viewer and that id (`:129`), never that the partner's own `partner_id` is the viewer. The snapshot's nudge offer has the same one-sided check (`:303`), while `enqueue_daily_reminders` already requires the link both ways (`20261126000000_daily_reminders_schedule.sql:83`). The app cannot make a one-way link today: `accept_partner_request` sets both sides and refuses when either person already has a partner (`20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:170-181`), and no migration unlinks. Service-role writes can, because they link with two separate updates (`linkUserPair` in `tests/support/auth/global-setup.ts:107-117`, `scripts/provision-push-fixtures.mjs`, `scripts/sim-driver/provision.ts`), as can a hand edit on the hosted project. Criterion 24 makes the nudge, and the snapshot's nudge offer, require the link both ways, as `enqueue_daily_reminders` does, proven by a pgTAP case with a one-way link set by service-role updates.
- Risk high: it changes the hosted nudge limit, the `daily-reminders` job and the live check. Check beyond the criteria: a pgTAP case with the sender on UTC+14 and the partner on UTC-10 proves the hold (the day not started, and 00:00-08:00), the 8 AM send, one push for two held nudges, the closing instant and the refusal after the partner's day ends, with fixed instants.