---
type: epic
title: "Daily Question"
parent: initiative-my-love
covers: ["R1", "R2", "R3", "R4", "R12", "R17", "R18", "R20"]
sources: ["_bmad-output/initiative-my-love/initiative-my-love.md"]
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md"]
after: []
refined: true
risk: high
status: done
---

# Daily Question

## Description

Daily replaces Mood as the dock's second destination. Each day the couple gets one this-or-that question. Each partner picks one option blind: the server withholds the other's choice until the reader's own pick exists, and then both see the reveal. Each day one partner, in turns by date, is asked right after their own pick to write tomorrow's question (This / That) or let the pool pick one. The pool holds at least 500 questions written by the coach, none repeated until all are used, joined by the ones partners write. A turn that is not used is not carried over. A pick made offline keeps the time it was made and is sent on reconnect. Each partner's day runs on their own clock, and an account with no linked partner sees an invitation to link. The mood screens leave the dock here and stay in the code until epic 10 deletes them. Later epics build on these screens: epic 7 adds the streak, epic 8 puts Nudge on the waiting screen and times its pushes on this day, epic 9 adds the reveal's Reply button, and epic 10 deletes the mood code once Daily holds the dock slot.

## Outcome

Both partners answer one question a day and see each other's pick only after their own. Signal: a day's two picks revealed on the live site.

## Requirements

R1 (parent R1; design, Today's question): Each day the couple gets one this-or-that question with two options. Each partner chooses one option for themselves and sends it with Send my pick, and a sent pick never changes. Met when both partners see the same question that day and each saved pick belongs to its picker alone.

R2 (parent R2; design, Waiting on Jessie, Both answered: the reveal): A partner's choice stays hidden from the other until the other's own pick exists. Then both choices show together in the reveal, marked Same picks or Different picks. That the partner has picked is shown, and it updates without a reload. The waiting screen shows the reader's own pick and the time it was made. Met when nothing the app shows or receives carries the partner's choice before the reader's own pick exists, for every client RPC.

R3 (parent R3; parent Notes, Decision 2026-11-06; Notes, Decision 2026-11-06): Each day one partner, alternating by date, is asked "Write tomorrow's question?" once their own pick reaches the server. The prompt shows again on each later open of that day until they write a question, answer "No thanks, pick one for us" on that device, or the date ends. A written question is asked of both partners the next day. A declined or unused turn gives the next day a pool question, and the next date's turn goes to the other partner either way. Met when a written question is asked of both the next day, a declined or unused turn yields a pool question, and consecutive dates prompt alternate partners.

R4 (parent R3; design, Write tomorrow's question?): The write form has a This field and a That field and previews the question as "{This} or {That}?", as it will be saved: each option trimmed, its case kept. Each option is trimmed and must be 1 to 40 characters, and the two must differ ignoring case; the server refuses any other. Sending is refused offline before any request. Met when each invalid form is refused by the server and a valid one becomes the next day's question.

R5 (parent R4): The pool, written by the coach, holds at least 500 this-or-that questions. No question repeats for the couple until every pool question has been used, and questions a couple writes join only that couple's pool. Every question shows as "{This} or {That}?" in plain text, without icons. Met by the pool count and by consecutive days drawing distinct questions until the pool is used up.

R6 (parent R12): The dock reads Home, Daily, Love Notes, Photos, Partner in both dock forms. `/daily` opens Daily, and `/mood` and a mood push tap open Daily too. The mood screens leave the dock, and their code stays until epic 10. Met when the dock shows those five in both forms and no route reaches a mood screen.

R7 (parent R17): A pick made offline is kept on the device with the time it was made and sent as soon as a connection returns. It counts for the date it was made, even when it reaches the server after that date's midnight, and the reveal shows only once the server has it. A device with no saved question for today says it needs a connection, and a pick the server refuses shows its failure. Met when a pick made offline at 11:50 PM and sent at 12:10 AM counts for the earlier date.

R8 (parent R18): An account with no linked partner sees an invitation to link on Daily and no question; its button opens the Partner page, where linking lives. A failed read never shows the invitation. Met when an unlinked answer, and only that answer, shows the invitation.

R9 (parent R20): Each partner's day runs on their own phone's clock. Met when partners an hour apart each pick at 11:30 PM local and both picks land on the same date.

## Constraints

- The server enforces the hidden choice. Hiding it in the UI alone does not meet R2 (parent C1; spine AD-5, AD-15).
- The Realtime registry becomes one partner-event registry, and `partner_linked` and `new_mood` keep working through it (parent C3; spine AD-11).
- Spine AD-1 to AD-6, AD-11 to AD-13, AD-15 and AD-16 bind this epic's tables, functions, queue and local copies. The snapshot carries `my_picked_at` and no question number, and "No thanks" is kept in the device-only `daily-write-declined` kind (spine memlog, 2026-11-05).
- Every new table enables RLS in its creating migration. Each new policy goes in its `policies_are` file, and `src/types/database.types.ts` is regenerated with `npm run db:types`, never edited by hand (AGENTS.md, Policy and Known pitfalls).
- An async store action that sets state after an await captures and re-checks `{ userId, authSessionVersion }`. A new account-scoped field goes into `signedOutState()` in the same commit (AGENTS.md, Known pitfalls).
- A write that needs a connection refuses through `requireOnline` or `isOnline()` plus `offlineMessage` (AGENTS.md, Known pitfalls).
- New offline data rules (AGENTS.md, Known pitfalls):
  - Data is stored as a `localCopy` kind, or as the `pick-queue` store added in `dbSchema.ts` and opened through `openMyLoveDB()`.
  - Each new `registerLocalCopy` read is stubbed in `auth-bootstrap-notification-order.tsx` and `login.spec.ts`.
- A `YYYY-MM-DD` string is parsed with `parseEventDate` (AGENTS.md, Conventions that differ from defaults).
- Daily is registered in all five places a view needs. It reserves `--dock-clearance` and pads by `--dock-left` / `--dock-right` (AGENTS.md, Where things are; Maintained by hand, dock paragraph).

## Done when

- On the live site, Playwright signs in the production Claude bot pair and checks three things:
  - both partners see the same question, pick, and see the reveal;
  - a request made as the second partner before their pick gets no trace of the first pick's choice;
  - neither the owner's account nor the partner's is used.
- An automated test shows a pick made offline at 11:50 PM and sent at 12:10 AM counted for the earlier date. It also shows partners an hour apart, each picking at 11:30 PM local, landing on the same date.
- The pool holds at least 500 questions. A written question is asked of both partners the next day, a declined or unused turn yields a pool question, and an automated test shows consecutive dates prompting alternate partners.
- The dock reads Home, Daily, Love Notes, Photos, Partner, `/mood` opens Daily, and an unlinked account's Daily shows the invitation to link.
- Shipped to production through `deploy.yml`.

## Boundaries

- Out, for epic 7: the streak, run, colours, +1 animation and milestones. Daily's streak chip and week strip, the waiting screen's streak sentence and the missed-day banner go with them.
- Out, for epic 8: pushes, the nudge prompt and the Nudge button.
- Out, for epic 9: Reply in Love Notes.
- Out, for epic 10: deleting mood code and data.
- Out, not taken up: the mock-up's question number ("#143"), icons on options, and a label saying who wrote a question.
- Touch point: the Partner page's partner search and linking (`PartnerMoodView/`), which the invitation opens. Owner: epic-streak-and-partner-page, whose rebuild keeps linking.
- Must not change: Home's bundled daily message (`DailyMessage/`, `messagesSlice`).

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- C1, C3 — parent, section Constraints
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, sections Invariants & Rules (AD-1 to AD-6, AD-11 to AD-13, AD-15, AD-16), Consistency Conventions
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas. Screens: Today's question; Waiting on Jessie; Both answered: the reveal, without its write card; Write tomorrow's question?; and from After a missed day only the plain question layout

## Notes

- Decision: 2026-11-05 tracer bullet is stories 1 and 12 together, both partners pick today's question and see the reveal, online only: story 1 is the server half (migration, gate, RPCs, types, the E2E reset helper) and story 12 the client half (api, slice, view) with the two-partner Playwright check. Split from one story by the owner to keep each loop story inside its token budget (AGENTS.md). Story 2 (each partner's own clock) comes second as the least certain part: date and zone errors fail silently.
- Decision: 2026-11-05 sequencing: stories touching the migrations, the gate pgTAP file, the generated types or dailyQuestionSlice wait on each other in one lane (1, 12, 2, 3, 5, 6, 7, 8); the pool (4) runs beside them after 1; the dock slot (9) waits on 12 and 6; the refactor sweep (10) is kept; the live check (11) closes.
- Decision: 2026-11-05 the snapshot's `nudge` field (spine AD-16) is added by epic 8 with `daily_nudges`; epic 6's snapshot carries every other field.
- Decision: 2026-11-05 story 9 deletes the E2E tests whose subject is the mood screen or sending a mood; story 6 first ports the realtime-recovery spec to a live `daily_pick`. Partner-page mood tests stay until epic 7.
- Decision: 2026-11-05 the owner runs this epic through bmad-loop with no person in any story: no `plan_checkpoint` or `done_checkpoint`, no `hitl` entry; each story is done when its checks pass. The pool is skimmed in the epic PR, and the live check runs in `deploy.yml` after every deploy.

- Decision: 2026-11-05 the live-site check never uses the Supabase secret key. Before each run each bot signs in and calls `reset_bot_daily_days()`, a security definer client RPC added to spine AD-15, which deletes only its own couple's `couple_days` rows and refuses unless the caller's email is one of the two in `claude_bot_config`, so the check can rerun any number of times a day. The partner bot signs in with its own `CLAUDE_BOT_PARTNER_PASSWORD`, which `provision-push-fixtures.mjs` sets on it (see the 2026-11-06 password decision below); on a local stack the spec signs both bots up and links them when they are missing. The story lists the GitHub secrets the job needs and the owner sets them after the epic merges. Declined: a service-key reset; choosing a time zone whose date is unused (two or three runs a day at most); throwaway accounts per run.

- Decision: 2026-11-06 re-sliced in place after the owner made writing tomorrow's question one partner's turn a day, offered right after their own pick rather than after the reveal (parent R3; spine AD-4): Description and Done when follow.
- Decision: 2026-11-06 the owner set the after-pick order: the write prompt first, then the nudge prompt (epic 8). The write prompt shows again on each later open of that day until it is answered or the day ends, and "No thanks" counts as answered (spine memlog question, no architecture impact).
- Decision: 2026-11-05 refined with the owner taking the PO's picks:
  - "No thanks" is kept on the device per account and day, so another device may ask once more (spine AD-13).
  - The waiting screen shows the own pick's time (spine AD-16).
  - The mock-up's question number and option icons are dropped, and a question shows as "{This} or {That}?" as typed.
  - Each written option is trimmed, 1 to 40 characters, and the two differ ignoring case; the server checks this.
  - The reveal shows Same or Different picks.
  - The write prompt opens only once the server has the writer's pick.
  - The invitation to link opens the Partner page.
  - The pool is at least 500 questions, written by an agent into the seed migration and skimmed by the owner in its PR.
  - The live-site check runs through Playwright on the production Claude bot pair.
- Decision: 2026-11-05 the mock-up's "Write tomorrow's question?" card on the reveal is superseded by the 2026-11-06 decision. The sheet opens after the writer's own pick, and the reveal has no write card.
- Decision: 2026-11-06 the partner bot has its own password, `CLAUDE_BOT_PARTNER_PASSWORD` (owner, `66e69812`, PR #483): `PUSH_FIXTURE_PASSWORD` is shared with the push fixtures, so as a GitHub secret it would have opened those accounts too. Replaces `PUSH_FIXTURE_PASSWORD` in the 2026-11-05 live-check decision, ticket 11's entry and its plan.
- Decision: 2026-11-06 R4's preview shows the question as it will be saved, each option trimmed with its case kept, not as typed (owner, at closure); the app already does this (`WriteQuestionSheet.tsx:169`). Supersedes "as typed" in the 2026-11-05 refinement decision and in entry 8.
- Decision: 2026-11-06 the epic is closed and its Done when accepted as met (owner). Every Done when line, R1 to R9 and every constraint has evidence on main `d841cf3d`; deploy run `42333277734` passed every job, its Live Daily Check included, and that run met the Outcome signal. Nothing was dropped. Accepted as open: DW-482 to DW-496 in the ledger. DW-490 to DW-496 are the retrospective's findings R1 to R6 and R8, and DW-487 now carries its A2 case. Also open: R2's update without a reload is checked only locally (DW-488). Record: `epic-daily-question-retrospective.md`.
