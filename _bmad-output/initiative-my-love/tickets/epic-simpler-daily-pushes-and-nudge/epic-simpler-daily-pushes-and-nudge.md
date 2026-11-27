---
type: epic
title: "Simpler Daily Pushes and Nudge"
parent: initiative-my-love
covers: ["R7", "R11", "R13", "R14", "R19"]
sources: ["_bmad-output/initiative-my-love/initiative-my-love.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md", "_bmad-output/initiative-my-love/deferred-work.md"]
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md", "_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md"]
after: []
refined: true
risk: high
---

# Simpler Daily Pushes and Nudge

## Description

Epic 8's five daily pushes and two nudge slots are cut down, as the owner decided on 2026-11-26. A person who answers first can nudge their partner once per daily question from the prompt right after their answer and once from the waiting card's Nudge button, and the daily pushes are that nudge, one 8 PM reminder to whoever has not answered, and both answered, each with its own switch. Every nudge sent before 8 AM on the partner's clock is held until then, and the prompt and the button close by themselves when the question stops taking nudges. Installed shells keep working until they take the live update, so the two removed switches' columns stay in the database for epic 10 to drop (DW-548). The epic changes epic 8's migrations, `send-push` and Daily's screens, so epics 9 and 10 wait on it. The both-answered push gets one wording, and the streak's row of seven dots shows the calendar week, Sunday to Saturday (owner, 2026-11-27). It delivers R13, R14 and R19's new-switch part on the reworded lines, and the week row's part of R7 and R11; epic 8 built the first version, and epic 10 owns R19's removal part.

## Outcome

Each partner gets one clear call back to the day's question instead of a run of pushes. Signal: the pgTAP, api and E2E specs for the three pushes and the per-question nudge limit, and the post-deploy Live Daily Check passing.

## Requirements

R1 (parent R13; spine AD-17, AD-9): A person who answers a daily question while their partner has not can nudge them about it from two places, each once per question: the prompt right after their answer (also after the write sheet, and when an offline answer sends while Daily is open) and the waiting card's Nudge button. Not now or closing the prompt ends only the prompt's chance. Every nudge sent before 08:00 on the partner's clock is recorded at once and pushed at 08:00-08:30 there unless the partner has answered by then; when both of a sender's nudges about one question are held, the partner gets one push and both count as used. The question stops taking nudges at the end of its day on the partner's clock: the prompt and the button close by themselves then, and the server refuses a later one. Met when a second nudge from the same place about the same question is refused, using one leaves the other open, a nudge about yesterday's question leaves today's open, and a nudge sent before the partner's 08:00 arrives at 08:00.

R2 (parent R14; spine AD-9, AD-10): The daily pushes are the nudge, one 8 PM reminder to a recipient who has not answered, and both answered, each timed on the recipient's own clock; there is no 8 AM new-question push and no push when the partner answers first. Met when each of the three arrives as worded and none of the removed pushes is sent.

R3 (parent R19, its daily part): Settings shows three daily switches, Nudges, Evening reminder and Both answered, and New question and Partner picked are gone. Met when turning a remaining switch off stops that kind for that person and no other.

R4 (spine AD-10, AD-13, AD-16; DW-548): Installed builds keep working until they take the live update: a build from before this epic still reads the day snapshot, which gives it no nudge, and loads and saves its Settings switches, the new build still shows days the old one saved, and neither the app nor send-push reads or writes the New question and Partner picked columns, which stay in the database for epic 10 to drop. Met when an old build's Daily and Settings load against the new server and no request names either column.

R5 (parent R7, R11; spine AD-7, AD-10): The streak's row of seven dots, at the top of Daily and on the Partner page's streak card, shows the calendar week, Sunday to Saturday, with today ringed in its own slot and the days after it not reached; every day not done yet is the same plain grey circle. Installed builds keep their last-seven-days row until they take the live update. Met when the row shows Sunday to Saturday with today ringed, for a today on a Sunday, a Saturday and midweek, and an old build's streak still loads.

## Constraints

- Spine AD-3, AD-7, AD-9, AD-10, AD-13, AD-15, AD-16 and AD-17 bind this epic's functions, tables, pushes and saved day copy; the stories update those rules to this epic as they build.
- Every changed client RPC stays in the AD-5 gate pgTAP file and FN-GRANT-008, and `src/types/database.types.ts` is regenerated with `npm run db:types`, never edited by hand (spine AD-15; AGENTS.md, Policy).
- Stop reading, ship, then drop (spine AD-10): this epic drops no column an installed build reads, so `push_preferences.daily_question` and `daily_partner_picked` stay, and new code never selects either, or a column epic 10 drops. No client reads `daily_nudges` (spine AD-15), so story 1 may drop or change its slot columns.
- No test moves a device or Mac clock: 8 AM, 8 PM, midnight and the hold are proven with fixed instants passed to the server's functions (spine AD-8; AGENTS.md, Known pitfalls).
- Every check runs on the one shared local Supabase stack, never a second one; a hosted run is never a story step, only an at-closure check in Done when (epic 8 retrospective, action item 8).
- A nudge is sent only online: it refuses through `requireOnline` and the prompt shows `offlineMessage`; the prompt keeps clear of all four `env(safe-area-inset-*)` (AGENTS.md, Known pitfalls).
- The phone schedules nothing for this epic: `src/services/dateReminders.ts` and `reminderIdsToCancel` do not change (C4; spine AD-9).

## Done when

- A second nudge from the same place about the same daily question is refused while the other place's is still taken, a nudge about yesterday's question leaves today's open, a nudge sent before the partner's 08:00 arrives at their 08:00-08:30, and none is taken after the question's day ends on the partner's clock, all proven with fixed instants.
- Only the nudge, the 8 PM reminder to whoever has not answered and both answered are sent, and Settings > Notifications shows those three daily switches.
- A build from before this epic still loads Daily and Settings against the new server, and the new build still shows days the old one saved.
- The both-answered push reads "You both answered today's question" over "Click to see what your partner answered!" whatever the day or the streak.
- The streak's row on Daily and the Partner page shows Sunday to Saturday with today ringed, and an installed build's streak still loads.
- `dateReminders.ts` is unchanged and its tests pass.
- Shipped to production through `deploy.yml`. No native code changes, so no reinstall.
- At closure: after the deploy, the Live Daily Check passes on production, and the hosted `daily-reminders` job's runs after the deploy succeed.

## Boundaries

- Out: dropping `push_preferences.daily_question` and `daily_partner_picked` (epic 10, DW-548).
- Out: removing the mood, poke and kiss pushes and switches (epic 10).
- Out: re-sending a push whose window was missed (spine AD-9).
- Must not change: when the both-answered push is sent, and its switch (story 2 changes only its wording); the love-note, photo, date and partner-request pushes and their switches; date reminders.
- Touch point: epic 8's `daily_nudges` and `daily_reminders` tables, `send_daily_nudge`, `enqueue_daily_reminders`, the `daily-reminders` cron job and the `send-push` daily kinds, changed here; owner: epic-daily-pushes-and-nudge (done; its stories stay as built).

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements (R13, R14, R19)
- C2, C4 — parent, section Constraints
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, sections Invariants & Rules (AD-3, AD-8, AD-9, AD-10, AD-13, AD-15, AD-16, AD-17), Consistency Conventions
- copy — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, boards `Notification.dc.html` (The nudges) and `Waiting.dc.html` (Waiting on Jessie)
- design — _bmad-output/initiative-my-love/ux-settings-page/DESIGN.md, section Components
- design — _bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md, sections Top page rows and Subpages
- design — _bmad-output/initiative-my-love/ux-settings-page/mockups/key-settings-v2.html, frame 9 (Notifications)
- retrospective — _bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/epic-daily-pushes-and-nudge-retrospective.md, Findings (F1, F4, F5), Action items (3, 8)
- ledger — _bmad-output/initiative-my-love/deferred-work.md, DW-548

## Notes

- Waits on epic 8 because: it changes epic 8's nudge and reminder tables, functions, cron job, `send-push` kinds and switches.
- Decision: 2026-11-26 (owner) backlog story 6 ("A daily question has one nudge, one 8 PM reminder and the both-answered push") becomes this epic, placed between epics 8 and 9 in build order, with epics 9 and 10 waiting on it: the loop never dispatches a backlog story.
- Decision: 2026-11-26 (owner) two stories in one lane. Story 1 is the nudge: the per-question limit, the hold, the prompt, the waiting card's button, the closing instant, the lost-answer rule, snapshot compatibility and the live check. Story 2 is the rest: the removed pushes and switches, the two column reads and `push-copy.md`. Both change `enqueue_daily_reminders` and `send-push`, so story 2 waits on story 1, which goes first because it carries the hosted risk.
- Decision: 2026-11-26 (owner) the hosted live check is an at-closure step in Done when, not a story step (epic 8 retrospective, action item 8).
- Decision: 2026-11-26 (owner) the epic builds unattended through bmad-loop, with no `plan_checkpoint`, `done_checkpoint` or `hitl` entry (owner's standing rule for loop runs). Both stories ship in one loop run and one PR, so the interim between them never reaches production.
- Decision: 2026-11-26 (owner, change of decision A) the waiting card keeps its Nudge button beside the prompt, each with its own nudge per daily question keyed on the question, never the sender's date; using one never spends the other, and Not now closes only the prompt. The server records which of the two a nudge used. This replaces the same day's decision to remove the button.
- Decision: 2026-11-26 (owner, change of decision B) the day's answer gives, with each place's spent state, the instant the question stops taking nudges, the end of that day on the partner's clock as a UTC timestamp; the prompt and the button disable themselves then with no re-read, and the server still refuses a late nudge. Refined the same day: an unsent control is hidden rather than disabled (next line).
- Decision: 2026-11-26 (owner) a nudge control that cannot be used and was never sent is hidden, not greyed; grey always means sent. This refines change of decision B: at the closing instant an unsent control is hidden.
- Decision: 2026-11-26 (owner) every nudge sent before 08:00 on the partner's clock is held until then, whether the day has not started there or it is between 00:00 and 08:00.
- Decision: 2026-11-26 (owner) the server leaves `nudge` out of the day's answer, so builds from before this epic cannot nudge until they take the live update; a held nudge keeps its live signal, and the partner's Daily still shows their own day (PO's pick, owner approved).
- Hosted catalog check, 2026-11-26 (read-only; object names and row counts only, as the owner asked; AGENTS.md, Known pitfalls): on the hosted project, `daily_nudges`, `daily_reminders` and `push_preferences` carry the same columns, constraints, indexes, triggers and policies as the local stack built from the migrations, and the functions (`daily_nudge_slot`, `record_daily_nudge`, `send_daily_nudge`, `enqueue_daily_reminders`, `notify_push`, `notify_love_note_push`, `user_local_date`) and cron jobs (`daily-reminders`, `daily-reminders-run-history`) match by name, so no hosted-only object needs a `drop … if exists`. The triggers story 2 removes are `daily_reminders_push_morning_after_insert` and `daily_picks_push_partner_picked_after_insert`. Rows: `daily_nudges` 1 (`after_pick`), with no sender holding two rows of one slot, or both slots, for one question; `daily_reminders` 2 `morning` and 2 `evening_self`.
- Decision: 2026-11-26 (owner) no iPhone check in this epic: its Done when gets none (initiative Notes).
- Decision: 2026-11-27 (owner) the both-answered push always reads "You both answered today's question" over "Click to see what your partner answered!", with no late-pick case and no "That day counts.". The owner put it in story 2 if small and similar enough; the PO judged it so (story 2 Notes).
- Decision: 2026-11-27 (owner) the streak's week row becomes the calendar week, Sunday to Saturday, as story 3, after story 2. The server sends it in a new field beside `week`, every slot shows its weekday letter, a day not done yet is a plain grey circle, today keeps its ring and the days after it are the same grey (story 3 Notes).
- Decision: 2026-11-26 declined by the PO: an epic PRD and a new architecture pass. The owner's decisions in the two story files, the initiative and the spine settle how it works. The owner decided that the builds update the spine's rules themselves.
