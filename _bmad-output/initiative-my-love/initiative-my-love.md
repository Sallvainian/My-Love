---
type: initiative
title: "My-Love"
sources: ["_bmad-output/initiative-my-love/brainstorm-mood-partner-reasons-to-open/brainstorm-mood-partner-reasons-to-open.md"]
companions: []
after: []
status: in-progress
risk: low
---

# My-Love

## Description

My-Love is a progressive web app for couples: daily messages, photos, love-notes chat and dates, deployed at https://my-love.sallvain.workers.dev/. This initiative holds every epic of the product. Its Requirements come from the 2026-11-05 brainstorm, which found the Mood and Partner pages are read-only mirrors that leave nothing waiting for either partner: it replaces mood tracking and Poke/Kiss/Fart with a daily this-or-that question both answer blind, a shared streak, and a Partner page built around both. The rest of the product predates the ticket tree and has no requirements source.

## Outcome

Each partner has a reason to open the app every day, an open loop from the other: today's question, the partner's hidden pick and the shared streak. Signal: the shared streak, which counts the days both partners picked.

## Requirements

- R1 (Decided: The daily question): each day the couple gets one this-or-that question with two options and each partner picks one option for themselves; met when both partners see the same question that day and each saved pick belongs to its picker alone.
- R2 (Decided: The daily question): a partner's pick stays hidden from the other until the other has picked, then both picks show together (the reveal); met when nothing the app shows or receives carries the partner's pick before your own exists.
- R3 (Decided: The daily question; Mock-up assumptions; owner 2026-11-05): each day each partner is asked "Write tomorrow's question?"; yes lets them type its two options (This / That) and it becomes the couple's next question, "No thanks, pick one for us" gives a random pool question; if both write one, the first sent is asked and the other joins the pool; met when a written question is asked of both the next day and a declined prompt yields a pool question.
- R4 (Decided: The daily question; Mock-up assumptions): the pool, written by the coach, holds about 500 this-or-that questions; no question repeats for the couple until every pool question has been used; questions partners write join the pool; met by the pool count and by consecutive days drawing distinct questions until the pool is used up.
- R5 (Decided: Streak; Mock-up assumptions): the couple shares one streak that goes up by one for each day both partners picked; a day without both picks is missed and holds the count, never resetting or raising it; met by the count over a sequence of done and missed days.
- R6 (Decided: Streak): a second counter shows the current run, days in a row with no miss; it resets to zero on a miss and shows beside the held total.
- R7 (Decided: Streak; design, After a missed day): the streak shows grey until today's question is done, fire orange once done, and blue after a missed day, staying blue through missed days in a row until both partners pick again.
- R8 (Decided: Streak; Mock-up assumptions): after each finished day a short Duolingo-style animation shows the streak going up by one, at once for whoever picks second and on the next open for whoever picked first.
- R9 (Decided: Streak; owner 2026-11-05): milestones every 25 days of the held total (R5), not the current run; each has a flaming-heart badge, greyed while locked and full colour once reached; reaching one shows the approved milestone screen with an emoji-style heart wrapped in flames whose flames flicker and heart beats; the flaming heart appears only on milestones, while the streak counter, the +1 animation and the dock keep the plain flame.
- R10 (Decided: Reveal and reply; design, Love Notes reply sent): the reveal's one action is Reply in Love Notes, spanning its card's full width; it opens Love Notes with the reply visibly attached to that day's question, as replying to a message in iPhone Messages, and both partners see the sent note with the question attached.
- R11 (Decided: Partner page): the Partner page holds the streak and the past questions in place of the partner's mood card and recent-moods list; each past day is marked Same or Different with a running count ("Same pick on 9 of your 13 days").
- R12 (Mock-up assumptions; Consequences): the Mood dock tab becomes Daily and the dock keeps five destinations.
- R13 (Mock-up assumptions): the waiting screen has a Nudge button that sends the partner a push.
- R14 (Mock-up assumptions; owner 2026-11-05): pushes arrive for a new question at 8 AM, the partner picked, the partner nudged you, an 8 PM reminder when nobody has answered, and both answered, each timed on the recipient's own clock, with the copy on the mock-up's notifications screen.
- R15 (Decided: The daily question; Consequences): the whole mood system is gone (the check-in with its 12 moods, note, Timeline and Calendar; the partner mood card and recent-moods list; mood realtime and mood notifications) and every stored mood is deleted, on the server and in each device's offline copies; met when no mood UI, mood row or device mood copy remains.
- R16 (Decided: Partner page; Consequences): Poke, Kiss and Fart are gone with their interaction history, on the server and on devices.
- R17 (owner 2026-11-05): a pick made offline is kept on the device with the time it was made and sent the moment a connection returns; it counts for the date it was made even when it reaches the server after that day's midnight, and the streak is corrected when it lands; the reveal shows only once the server has it; met when a pick made offline at 11:50 PM and sent at 12:10 AM counts for the earlier date.
- R18 (owner 2026-11-05): an account with no linked partner sees an invitation to link on the Daily page and no question.
- R19 (owner 2026-11-05): each new push kind has its own Settings switch, and the mood, poke and kiss switches are gone.
- R20 (owner 2026-11-05): each partner's day runs on their own phone's local clock; the couple's day for a date counts when each partner picked during that date on their own clock, so it closes only when the later partner's midnight passes; met when partners an hour apart each pick at 11:30 PM local and the day counts.

## Constraints

- C1 (Consequences): the server enforces the hidden pick, withholding the partner's pick row until the reader's own exists (RLS); hiding it in the UI alone does not meet R2.
- C2 (Consequences): the nudge, partner-picked and both-answered build on the existing `send-push` Edge Function and Broadcast realtime, not on a new push service or channel.
- C3 (project-context, Known pitfalls; `src/api/moodSyncService.ts`): `moodSyncService` hosts the refcounted Realtime registry that AGENTS.md routes new Realtime work through, and the `partner_linked` event that `partnerSlice` and `usePartnerLinkListener` use; removing moods keeps both working.

## Done when

- In production both partners pick today's question, and a request made as the partner before their own pick gets no trace of the first pick.
- An automated test over faked days shows the streak, current run, colours, +1 animation and 25-day badges behaving as R5 to R9 say across done and missed days.
- A reply sent from the reveal shows in both partners' Love Notes attached to its question.
- Production has no mood or Poke/Kiss/Fart screen, server row or device copy left, and the dock reads Home, Daily, Love Notes, Photos, Partner.
- Each push kind in R13 and R14 arrives on the owner's iPhone in the iOS shell.

## Boundaries

- Out: guessing the partner's pick; any mood step; a send-a-heart button on the reveal; the streak freeze (one free missed day a month), not taken up; the flaming heart outside milestones; a sixth dock destination.
- Must not change: Home's bundled daily message, which the Daily tab does not replace.
- Tracer path: a question shown on Daily, picked by both partners, revealed, and counted on the Partner page's streak.

## References

- project-context — AGENTS.md, section My Love
- brainstorm — _bmad-output/initiative-my-love/brainstorm-mood-partner-reasons-to-open/brainstorm-mood-partner-reasons-to-open.md, sections Decided, Mock-up assumptions, Consequences for existing code
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas (12 screens)

## Notes

- Assumption: the calls under the source's Mock-up assumptions that the owner has not confirmed are the coach's: R3's two-option form, R4's pool size, no-repeat rule and partner questions joining it, R8's timing and R12.
- Assumption: the pushes in R13 and R14 reach the iOS shell only, as every existing push does (epic-push-notifications); the web app gets none.
- Assumption: a question a partner writes joins only that couple's pool, never another couple's.
- Assumption: the phone's clock is trusted for a pick's time (R17); changing the phone's clock to rescue a streak is not guarded against.
- Open question: the rest of the product (photos, love notes, dates, settings, messages) has no PRD; `bmad-prd` supplies one when the owner decides.
- Decision: 2026-10-28 epic-test-review-remediation reopened with stories 10–12. Its 2026-10-03 re-reviews still report findings, and its Done when now requires the 2026-10-03 rows fixed and no Critical or High on fresh folder re-reviews, instead of zero findings, because the reviewer varies between runs.
- Decision: 2026-10-30 epic 2 retitled "iPhone Duo Side-Column Dock" and its description rewritten: the owner's Duo shows the shell drawing web content into the side column, so the native tab bar was dropped for the app's own HTML dock in the column (see the epic's Notes). Its folder slug stays `epic-iphone-duo-native-tab-bar`.
- Decision: 2026-10-30 after the Duo replan dropped stories 2.1 and 2.3, epic 3 waits on epic 2 only through story 3.1 on story 2.7 (its live-update simulator setup and its answer on whether the side column needs native code), and epic 4 no longer waits on epic 2: the Duo sweep and ship (2.4, 2.5) no longer share the Xcode project or a shell install. If story 2.7 finds native code is needed, 3.1 also waits on 2.2 and epic 4 gets epic 2 back (4.1 on 2.4, 4.5 on 2.5).
- Decision: 2026-10-30 story 2.7 found the side column needs no native code, so neither conditional wait above applies. Epics 3 and 4 now wait on epic 2 for story 2.9's simulator driver, which stories 3.12 and 4.7 extend, so a bmad-loop run can check the shell on the simulator with no person; simulator checks are trusted for the shell only, and each epic's ship story stays with a person (see each epic's Notes).
- Decision: 2026-11-02 no platform-baseline epic opens the breakdown: the product predates the ticket tree, which was migrated from v6 on 2026-10-28, so its scaffold, CI and deployment already exist.
- Decision: 2026-11-02 epic 5, epic-settings-rework, added from the Settings UX run (`ux-settings-page/`), DW-399 and DW-416, as one epic (see its Notes).
- Decision: 2026-11-05 the owner chose to put the daily question work from the brainstorm into this initiative as new epics, not a separate initiative, because it is part of My-Love; bmad-loop also reads one active initiative, and the work rewrites pages existing epics built.
- Decision: 2026-11-05 the owner confirmed a day counts only when both partners pick (R5), kept the Nudge button (R13), set milestones on the held total (R9), wants an offline pick sent on reconnect (R17), and took the PO's picks for two written questions (R3), no linked partner (R18) and push switches (R19).
- Decision: 2026-11-05 the owner ruled out one couple time zone, since the partners are sometimes an hour apart and a streak must not end at 11 PM for one of them: each partner's day runs on their own clock (R20). The owner kept all five pushes (R14) and wants an offline pick to carry the time it was made, so it counts for that date (R17).
