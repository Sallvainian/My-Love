---
type: epic
title: "Daily Pushes and Nudge"
parent: initiative-my-love
covers: ["R2", "R13", "R14", "R19"]
sources: ["_bmad-output/initiative-my-love/initiative-my-love.md", "_bmad-output/initiative-my-love/tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md"]
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md"]
after: []
refined: true
risk: high
---

# Daily Pushes and Nudge

## Description

Five pushes bring each partner back: the new question at 8 AM, the partner picked, the partner nudged you, an 8 PM reminder unless both have picked (telling a recipient who has not picked that they haven't done their daily, and one who has that their partner hasn't), and both answered, each timed on the recipient's own clock with the copy in `push-copy.md`. Right after a pick the app offers a nudge, and the waiting screen's Nudge button sends one, at most two a day per partner, one before 8 PM and one from 8 PM; each new kind gets its own Settings switch. The server schedules the 8 AM and 8 PM pushes, so the date reminders' cancel-all stays as it is (C4). No push carries a choice (R2's push part). The pushes quote epic 7's streak count and are timed on epic 6's per-partner day; epic 9 follows this epic's migrations, and epic 10 deletes the mood, poke and kiss pushes and switches beside the new ones (R19's removal part). Two stories from the epic 7 retrospective come first: `dailyQuestionSlice` is split, and a failed read of a saved copy no longer rewrites it.

## Outcome

Each partner is called back to the day's question at the right moment on their own clock. Signal: each push kind arriving on the owner's iPhone.

## Requirements

R1 (parent R2, its push part; spine AD-5): No push carries either partner's choice, and `send-push` never reads one. That the partner picked is shown. Met when no recorded daily push for a seeded day holds a choice.

R2 (parent R13; design, Waiting on Jessie; spine AD-17): A partner who has picked while the other has not can nudge them. When they picked first, right after their own pick is confirmed the app asks "Do you want to nudge your partner?" once, unless the write prompt showed on that open of Daily. The waiting screen's Nudge button sends the same nudge. Each partner has one nudge before 8 PM and one from 8 PM on their own clock; the button greys out once the current one is spent, and when no nudge can be sent. The nudge push plays the default notification sound. Met when a nudge pushes the partner with that sound, a second in the same slot and a third on one day are refused by the server, and the button greys.

R3 (parent R14; spine AD-9): At 8 AM on their own clock each linked partner with a registered device who has not picked gets the new-question push, quoting today's question. Met when it arrives once per person and date, for two partners on different clocks each at their own 8 AM.

R4 (parent R14; spine AD-10): The first pick pushes the other partner that a pick was made, unless it is for a day that is not the recipient's current date. The second pick pushes the first picker that both answered, also when that pick was made offline and lands after the day has ended; when that day is not the recipient's current date the push says the day counts instead of offering the partner's pick. Met when each arrives once, a retried pick sends none, and a late pick's push carries the late wording.

R5 (parent R14; spine AD-9): At 8 PM on their own clock, unless both have picked, a recipient who has not picked is told they haven't done their daily, and one who has is told their partner hasn't. The second is skipped when that recipient has already used their evening nudge. Both play the default notification sound. Met when each variant goes to the right person with that sound and none when both have picked.

R6 (parent R19, its new-switch part; spine AD-10): Each of the five kinds has its own Settings switch, on by default, and one switch covers both 8 PM variants. Met when a switch turned off stops that kind for that person and no other.

R7 (retrospective, Action items 8): `dailyQuestionSlice` is split into a day, a streak and a history slice, with the same fields, actions and behaviour, and each session check kept. Met when each of the three files holds only its own domain and the existing unit and E2E tests pass with no assertion weakened.

R8 (retrospective, Action items 9; DW-487, DW-509): A failed read of a saved copy never causes a write that replaces it: the Daily days merges, the "No thanks" list and the two celebration claims tell an absent copy from a failed read. Met when a test for each shows a failed read writing nothing.

## Constraints

- Spine AD-2, AD-3, AD-5, AD-7 to AD-11, AD-13 and AD-15 to AD-17 bind this epic's functions, RPCs, tables, pushes, broadcast and saved day copy.
- Every new client RPC goes in the AD-5 gate pgTAP file and FN-GRANT-008 in the same change, and `src/types/database.types.ts` is regenerated with `npm run db:types`, never edited by hand (spine AD-5, AD-15; AGENTS.md, Policy).
- The sender, its switches and its tables ship in one deploy before the triggers (spine AD-10), because `deploy.yml` applies migrations before it deploys `send-push` and the old `POSTED_KINDS` refuses unknown kinds. Stories 1 to 4 ship before story 5 (Notes).
- `daily_nudges.day_id` and `daily_reminders.day_id` cascade with `couple_days`, so `reset_bot_daily_days` keeps working; a `push_requests` row cascades with its nudge or reminder (spine AD-10).
- The new functions and tables follow spine AD-15: RLS on with no policies, no grants to `anon` or `authenticated`; each time-dependent function takes the instant (AD-8).
- A story that adds or changes a subscriber on the partner-event registry names what its screen does on every event in `PARTNER_EVENTS` (`partner_linked`, `daily_pick`, `new_mood`, `dates_changed`, and `daily_nudge` once story 8 adds it) and on `SUBSCRIBED`, and tests each (epic 6 retrospective, item 10).
- The phone schedules nothing for this epic: `src/services/dateReminders.ts` and `reminderIdsToCancel` do not change (spine AD-9; C4).
- A nudge is sent only online: it refuses through `requireOnline`, and the component shows `offlineMessage` (AGENTS.md, Known pitfalls). The after-pick sheet keeps clear of all four `env(safe-area-inset-*)`.
- No test moves a device or Mac clock; 8 AM and 8 PM are proven with fixed instants in pgTAP (AGENTS.md, Known pitfalls).
- New code never selects a column epic 10 drops (spine AD-10).

## Done when

- Each of the five push kinds has arrived on the owner's iPhone in the iOS shell, 8 AM and 8 PM on the recipient's own clock. The owner reports it at closure; it is no story's step.
- A nudge, offered after the pick or sent from the waiting screen, pushes the partner, and a third nudge on one day is refused.
- The partner-picked push never shows the pick.
- Turning a new kind's Settings switch off stops that push.
- Date reminders still fire after a re-plan while the daily pushes are scheduled: `dateReminders.ts` is unchanged and its tests pass.
- Shipped to production through `deploy.yml`, and on the hosted database both cron jobs are listed and their last runs succeeded. No native code changes are needed, so no reinstall.

## Boundaries

- Out: removing the mood, poke and kiss pushes and switches (epic 10).
- Out: a push to the web app, and a banner inside the app for a push that arrives while it is in front; the shell shows none today.
- Out: choosing the two times, quiet hours, or re-sending a missed push (spine AD-9: a missed window sends nothing).
- Out: a sound for the 8 AM, partner-picked and both-answered pushes, and for love notes (backlog story `story-love-notes-play-a-sound.md`).
- Must not change: date reminders and the existing love-note, photo, date and partner-request pushes, which stay silent.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- C2, C4 — parent, section Constraints
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, sections Invariants & Rules (AD-2, AD-3, AD-5, AD-7 to AD-11, AD-13, AD-15 to AD-17), Consistency Conventions
- copy — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, boards `Notification.dc.html` (The nudges) and `Waiting.dc.html` (Waiting on Jessie)
- retrospective — _bmad-output/initiative-my-love/tickets/epic-streak-and-partner-page/epic-streak-and-partner-page-retrospective.md, section Action items (8, 9)

## Notes

- Waits on epic 6 because: the pushes are timed on its per-partner day and react to its picks.
- Waits on epic 7 because: the push copy quotes the streak count.
- The architecture spine (companion) settles how the 8 AM and 8 PM pushes are scheduled and how nudges are capped; refine against it.
- Decision: 2026-11-25 (PO, on the owner's instruction) the epic 7 retrospective items 8 and 9 are the epic's first two stories.
- Decision: 2026-11-25 sequencing: stories 3 to 4 are the sender and its switches, before any trigger (AD-10). Stories 5, 6 and 7 share migrations, types and pgTAP files, one lane. Story 5 goes first of those because pg_cron on hosted and two clocks are the least certain part. Stories 3 and 4 wait on neither 1 nor 2; stories 8 and 9 build on the split slice. Story 10 is the sweep and 11 the live check.
- Decision: 2026-11-25 the epic builds in two loop runs, each with its own PR: stories 1 to 4, then 5 to 11, so the sender is live one deploy before any trigger, as spine AD-10 says (owner, PO's pick).
- Decision: 2026-11-25 a late second pick still pushes both answered: AD-10 already sends it, because a pick is always stamped on its own day. When that day is not the recipient's current date, the push says "That day counts." in place of "See {Partner}'s pick" (owner).
- Decision: 2026-11-25 the copy and switch labels in `push-copy.md` are approved, with one lock-screen group, `partner-activity` (owner).
- Decision: 2026-11-25 the after-pick nudge offer is a bottom sheet built as the write sheet is, with no board (owner, PO's pick). It shows only to the partner who picked first, and never on an open of Daily where the write sheet showed (owner). This replaces epic 6's 2026-11-06 order of the write prompt then the nudge prompt: on the writer's day the waiting screen's button is the way to nudge.
- Decision: 2026-11-25 the nudge and both 8 PM reminders play the default notification sound, the one date reminders use; the other three stay silent like every other push (owner). Love-note sound is out of this epic: backlog story `story-love-notes-play-a-sound.md` (owner).
- Decision: 2026-11-25 the epic builds unattended through bmad-loop, with no `plan_checkpoint`, `done_checkpoint` or `hitl` entry; each push arriving on the owner's iPhone is checked at closure (owner's standing rule for loop runs).
- Decision: 2026-11-25 declined by the PO: an epic PRD. The initiative, the spine and the mock-up answer how the pushes and the nudge work; the remaining choices are copy and layout, put to the owner.
- Decision: 2026-11-25 the spine at `1e5f8ea1` settles what this epic handed to Winston: AD-10 sends `daily_both_answered` on every second pick with "That day counts." when the day is not the recipient's current date, and gives the nudge and both 8 PM reminders the default sound; AD-9 makes `daily_reminders.day_id` not null with both slots assigning the day; AD-15 lists `user_local_date`; AD-13 binds epic 8 and keeps `nudge.spent` from moving back within one slot; the State row and layer diagram name `dailyDaySlice.ts`, `dailyStreakSlice.ts` and `dailyHistorySlice.ts`, and AD-12 names `dailyDaySlice`. AD-10's closed-day Source conflict is closed. Stories 1, 3, 6, 7 and 8 were re-sliced against that wording, ids and order kept, and AD-13 joins the Constraints.
- Decision: 2026-11-25 when `send_daily_nudge` refuses or the request fails, the waiting card broadcasts nothing, shows "Your nudge could not be sent." in its failure box as a refused pick does, and Daily re-reads the day so the button follows the server; offline the button stays enabled and a tap shows `offlineMessage`, and the after-pick sheet shows the same line on a refusal (PO's pick, owner approved). Also approved from the set check: story 3 covers the text and sound part of R2, R3 and R5 and checks an off switch spares other kinds and the partner; story 7 checks the snapshot's `nudge`; story 9 skips the sheet when the slot is null; story 11's writer answers No thanks.

