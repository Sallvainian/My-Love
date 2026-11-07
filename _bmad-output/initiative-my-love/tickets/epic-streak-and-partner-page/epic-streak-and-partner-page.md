---
type: epic
title: "Streak and Partner Page"
parent: initiative-my-love
covers: ["R5", "R6", "R7", "R8", "R9", "R11", "R17"]
sources: ["_bmad-output/initiative-my-love/initiative-my-love.md"]
companions: ["_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md"]
after: []
refined: true
risk: high
---

# Streak and Partner Page

## Description

The couple shares one streak that rises by one for each day both partners picked and holds on a missed day, beside a current run that resets on a miss. Daily and the Partner page show it grey until today is done, fire orange once done and blue after a miss until both pick again; a Duolingo-style +1 plays at once for the second picker and on the next open for the first. Every 25 days of the held total unlocks a flaming-heart badge and the approved milestone screen with its flickering flames and beating heart. The Partner page holds the streak and the past questions, each day marked Same or Different with a running count, in place of the partner's mood card, the recent-moods list and the Poke/Kiss/Fart tiles. When an offline pick lands after its day's midnight, the streak is corrected for that date (R17's streak part; epic 6 delivers the pick itself). It builds on the picks and the per-partner day from epic 6; epic 8's push copy quotes its count, epic 9 adds Reply to the reveal card after this epic's +1, and epic 10 deletes the mood and interaction code once this Partner page no longer reads it.

## Outcome

The couple watches one shared streak grow and sees how often they pick the same. Signal: the held total and current run on the live Partner page.

## Requirements

R1 (parent R5; design, Streak goes up by one): The couple shares one streak, the held total, which goes up by one for each date both partners picked. A date without both picks is missed and holds the count, never resetting or raising it. A date closes once the later partner's local midnight has passed. Met by the count over a sequence of done and missed days, partners an hour apart included.

R2 (parent R6): The current run, days in a row with no miss, shows beside the held total as "{run} in a row". It resets to zero on a miss, and a day still open never breaks it. Met by the run over the same sequence.

R3 (parent R7; design, After a missed day, Today's question, Waiting on Jessie): The streak shows grey until today's question is done, fire orange once done, and blue with a snowflake after a missed day, staying blue through missed days in a row until both partners pick again. Daily shows it as a chip beside the date with the last seven days as a strip. The waiting screen says "Your half is in. The streak lights up when {partner} answers too." While blue, a banner says the streak went cold, how many days were missed, and the count it is frozen at. Met when an automated test over faked days shows each colour, on Daily and on the Partner page.

R4 (parent R8; design, Streak goes up by one): After each finished day the +1 animation plays once per device: at once for whoever picks second, and for whoever picked first whenever Daily is next on screen, including when the partner's pick arrives while Daily is open. Opening the Partner page shows the new count without playing it. Under Reduce Motion it shows the end state without movement. Met when each partner sees it once and a reload never replays it.

R5 (parent R9; design, 25-day milestone): Every 25 days of the held total is a milestone with a flaming-heart badge, grey while locked and full colour once reached, shown four at a time (25 to 100, then 125 to 200). Reaching one shows the milestone screen once per device, after the +1: the flaming heart with flickering flames and a beating heart, "{held} days answered together", "You and {partner} have answered together on {held} days." and the badges. The flaming heart appears nowhere else; the counter, the +1 and the dock keep the plain flame. Met when the 25th done day shows it with 25 in colour and 50, 75 and 100 grey.

R6 (parent R11; design, Partner page): The Partner page shows the partner's name and the streak card ("{held} days answered together", "{run} in a row", the week strip, "Next milestone: {n} days · {k} to go") in place of the partner's mood card, the recent-moods list and the Poke/Kiss/Fart tiles. Partner search and linking stay, and an unlinked account sees only them. The streak shows offline from its saved copy. Met when the page shows the streak and none of the removed parts, and linking works as before.

R7 (parent R11; design, Partner page, Past questions): Past questions lists every day both partners picked, newest first, today included once both have picked, each with its question, both picks and Same or Different. The Partner page shows the three newest, and See all opens a page of all of them under "Same pick on {same} of your {done} days"; back returns to Partner and a reload stays on it. Past questions show offline and never show a day from another pairing. Met when the count and the rows match seeded days and nothing of today shows before the reader's own pick.

R8 (parent R17): A pick that reaches the server after its date's midnight corrects the streak for that date when it lands. Met when a pick made at 11:50 PM and submitted at 12:10 AM raises the held total for the earlier date.

## Constraints

- Spine AD-5, AD-7, AD-8, AD-11, AD-13, AD-15 and AD-16 bind this epic's functions, RPCs, local copies and live updates. `get_couple_streak` answers `ok` with the streak or `unlinked`, as `get_daily_day` does, and its streak also carries `week`, the viewer's last seven dates each done, missed or open, and `missed`, the dates missed in a row since the newest done day, so no client works out a day's state (Notes, Decision 2026-11-07).
- Every new client RPC goes in the AD-5 gate pgTAP file and FN-GRANT-008 in the same change, and `src/types/database.types.ts` is regenerated with `npm run db:types`, never edited by hand (spine AD-5, AD-15; AGENTS.md, Policy).
- A story that adds a subscriber to the partner-event registry names what its screen does on every event in `PARTNER_EVENTS` (`partner_linked`, `daily_pick`, `new_mood`, `dates_changed`) and tests each (epic 6 retrospective, item 10).
- An async store action that sets state after an await captures and re-checks `{ userId, authSessionVersion }`; a new account-scoped field goes into `signedOutState()` in the same commit (AGENTS.md, Known pitfalls).
- New offline data is a `localCopy` kind (`daily-streak`, the device-state kind `daily-celebrated`) or an entry in the `daily-days` map; each new `registerLocalCopy` read is stubbed in `auth-bootstrap-notification-order.tsx` and `login.spec.ts`; sign-out deletes every new kind (spine AD-13; AGENTS.md, Known pitfalls, Maintained by hand).
- The Partner page is built in a new folder, `src/components/PartnerView/`, since epic 10 deletes `PartnerMoodView/` (spine Conventions); what it keeps from that folder moves with it.
- The milestone screen, a full-screen overlay, keeps every control clear of all four `env(safe-area-inset-*)`; pages reserve `--dock-clearance` and pad by `--dock-left` / `--dock-right` (AGENTS.md, Known pitfalls, Maintained by hand, dock paragraph).
- A `YYYY-MM-DD` string is parsed with `parseEventDate` (AGENTS.md, Conventions that differ from defaults).

## Done when

- An automated test over faked days shows the held total, the current run and the grey, orange and blue states following R1 to R3 across done and missed days, and a pick made at 11:50 PM and submitted at 12:10 AM counted for the earlier date (R8).
- The +1 animation plays once for each partner: at once for the second picker and on the next open of Daily for the first.
- Reaching 25 days of the held total shows the milestone screen with the animated flaming heart; later badges stay grey until reached.
- The Partner page shows the streak and past questions with Same or Different and the running count, and no mood card, recent moods or Poke/Kiss/Fart tiles; partner search and linking work as before; the streak and past questions show offline.
- After every deploy, the live check sees the production Claude bot pair's streak and today's question in Past questions on the live Partner page.
- Shipped to production through `deploy.yml`.

## Boundaries

- Out: deleting mood and interaction code and data (epic 10); pushes (epic 8); Reply in Love Notes on the reveal (epic 9).
- Out: the flaming heart anywhere but milestones; the counter, the +1 animation and the dock keep the plain flame.
- Out: the streak freeze (initiative Boundaries); the mock-up's question number and option icons (epic 6 Boundaries).
- Must not change: partner search and linking, which Daily's invitation to link opens on the Partner page (epic 6 R8); the rebuilt page keeps them.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- architecture — _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md, sections Invariants & Rules (AD-5, AD-7, AD-8, AD-11, AD-13, AD-15, AD-16), Consistency Conventions
- design — https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh, the owner-approved mock-up canvas, screens Streak goes up by one, 25-day milestone, Partner page, Past questions, After a missed day, and the streak chip and week strip on Today's question and Waiting on Jessie
- retrospective — _bmad-output/initiative-my-love/tickets/epic-daily-question/epic-daily-question-retrospective.md, section Action items (8, 10, 11)

## Notes

- Waits on epic 6 because: it counts the picks and the per-partner day epic 6 stores.
- Source conflict: design, 25-day milestone — the mock-up says "25 days in a row", but parent R9 counts milestones on the held total, which does not reset on a miss. Settled by the 2026-11-07 refinement decision below.
- Decision: 2026-11-07 refined with the owner. The milestone screen says "days answered together", not "in a row" (parent R9). The +1 plays whenever Daily is on screen and the server's held total exceeds the one this device last celebrated (spine AD-13: the comparison triggers it, never the event itself). Past questions show offline (story 9, which also closes DW-492). The live-site check reads the streak after every deploy (story 11). The PO's picks taken: `get_couple_streak` returns the last seven days' states, an addition to spine AD-7; Past questions hold only days both partners picked, today included once both have; See all is a page of the Partner view at `/partner/history`; badges show four at a time; the cold banner says "The last {n} days were missed" after more than one miss; the epic builds unattended through bmad-loop, with no `plan_checkpoint`, `done_checkpoint` or `hitl` entry.
- Decision: 2026-11-07 tracer bullet is stories 1 and 2 together: story 1 is the server half (`couple_streak`, `get_couple_streak`, the gate file, types) and story 2 the client half (the new Partner page with the streak card). Seen running: both partners pick on Daily and each Partner page shows 1 day answered together, 1 in a row, in orange. The counting across two clocks in story 1 is the least certain part, so it goes first.
- Decision: 2026-11-07 sequencing: one lane, every story waiting on the one before. Stories 2 to 9 all change `dailyQuestionSlice`, and stories 1 and 7 both add migrations, the gate file and the types. Story 4 owns the E2E helper that seeds a pair's past days, which stories 5 to 9 use. The refactor sweep (10) is kept; the live check (11) closes.
- Decision: 2026-11-07 DW-490 is already fixed on main (PR #490): an open Daily re-reads the day on `partner_linked`. Story 4 adds only the streak re-read on that event, and its E2E links through `seedRequest` and `acceptFromPartnerTab` in `tests/support/helpers/partner-requests.ts` (owner).
- Decision: 2026-11-07 the refactor sweep also takes up every review rejection that said a fix needed code the story did not have, where a later story of the epic built that code (epic 6 retrospective item 8).
- Decision: 2026-11-07 a defect a check story finds that predates it gets its own new story, never a fix grown inside the check story (date-reminders retrospective item 11, carried forward by epic 6 retrospective item 11); story 11's description says so.
- Decision: 2026-11-07 epic 6 retrospective item 11's `sim doctor` part needs no story here: DW-449 closed on 2026-11-04 with the owner's decision to check only the Supabase CLI pin before `sim build`, and this epic has no simulator work.
- Decision: 2026-11-07 the set check's findings applied to the draft: the Poke/Kiss/Fart and mood specs that open `/partner` are named in story 2; `PartnerLoadError` moves with the linking code, since Settings' partner page imports it; story 4 waits on 6.7, whose drain it re-reads after; handoffs name story 4's seed helper and story 7's `get_daily_history`; `get_couple_streak` gains `missed` and the `unlinked` answer; both new subscribers re-read on `SUBSCRIBED`; story 9 also drops a date's other saved days, so DW-492 closes after `reset_bot_daily_days` too; the new folder is `PartnerView/`, as `Settings/PartnerPage.tsx` already exports `PartnerPage`.
- Decision: 2026-11-07 declined: amending spine AD-7 for `week` and `missed`. The spine is an adopted companion the PO does not edit; this epic's Constraints carry the addition, and epic 8, which also reads `couple_streak`, cites it from here when it is refined. A `bmad-architecture` update can fold it in later.
- Decision: 2026-11-07 the `daily-days` copy keeps every saved day: its 31-day cap (`MAX_SAVED_DAILY_DAYS`), picked in story 6.5 only to show today offline, goes in story 9, so offline Past questions match their count (owner). Story 9 still drops a day saved with a different partner and an older entry for the same date (DW-492). Declined: exempting only done days from the cap; showing only the newest 31 offline.
