---
epic: epic-simpler-daily-pushes-and-nudge
date: 2026-11-27
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective: Simpler Daily Pushes and Nudge (epic 11)

## Epic summary

- **Epic:** `epic-simpler-daily-pushes-and-nudge` (id 11), folder `_bmad-output/initiative-my-love/tickets/epic-simpler-daily-pushes-and-nudge/`.
- **Tickets** (build order from `tickets.py status`):

| Ref | Title | status | state | Review |
|---|---|---|---|---|
| 11.1 | Two nudges per question, held until the partner's 8 AM | done | done | thorough (4 lenses) |
| 11.2 | Three daily pushes and three switches | done | done | quick |
| 11.3 | The streak's week runs Sunday to Saturday | done | done | quick |

- **Still at `built`:** none. **Unfinished (`pending_tickets`):** none.
- **Ranges** (from each plan's `baseline_revision`; the baselines are in that order in history, checked with `git merge-base --is-ancestor`):

| Ticket | Range | Commits |
|---|---|---|
| 11.1 | `e4326eba..c8e2773f` | `857be1bf` and its merge `c8e2773f` |
| 11.2 | `c8e2773f..aa5c6073` | `b65121e2` and its merge `aa5c6073` |
| 11.3 | `aa5c6073..af9265f6` (to HEAD, inferred; nothing landed after) | `31c0fea0` and its merge `af9265f6` |

  Each range has one non-merge commit and one merge, and `merges_measured` equals `merge_count` (1 of 1) in all three, so the change-volume figures are complete. Whole epic: 87 files, +7455 / −2227.

- **Evidence read:** the epic file; all three story files and plans in full (Intent, Implementation Notes, Plan Change Log, Review Triage Log, Design Notes, Verification, Auto Run Result); `tickets.toml`; `.memlog.md`; the `git_evidence.py` output for each range; the ledger diff across the epic (DW-555 to DW-560); the epic 8 retrospective; the loop run's `ATTENTION` file. Run folders (`<type>-*/`) in the epic folder: none exist. Companions: `push-copy.md` read through the epic's diff only.
- **Session logs:** `.bmad-loop/runs/20261127-035223-8fca/logs/11.{1,2,3}-dev-1.log` exist (10.6 MB in total). They were searched for specific terms only, not read in full, so lessons about how the sessions went come from the plans and are **narrowed**.

## Findings

Dispositions: **fix now** (an action item below), **defer** (goes to the ledger), **accept** (recorded so later retrospectives stop flagging it).

### Aggregate views

| # | Finding | Source | Disposition | What would prevent the next one |
|---|---|---|---|---|
| G1 | **Size.** `20261127000000_daily_nudge_per_question.sql` is 744 lines, the largest migration in the repo (the next is 649). `dailyDaySlice.ts` grew from 858 to 924 lines and is the 6th largest non-test file in `src/`. The migration is a one-off file. The slice is the one to watch: the epic 7 retrospective split `dailyQuestionSlice.ts` for this reason (story 8.1). | `wc -l`; `git show e4326eba:src/stores/slices/dailyDaySlice.ts` | accept (watch the slice) | none |
| G2 | **The same function was written twice in one PR.** 11.1 rewrote `enqueue_daily_reminders` (105 lines) and kept the 8 AM `morning` and `evening_partner` branches as a temporary step. 11.2 then rewrote it again (75 lines) to remove them. `47_daily_pushes.sql` and `48_daily_reminders.sql` were changed in both commits. The owner put the nudge story first because it carried the hosted risk, and the temporary version never reaches production (one PR). | `20261127000000…sql:598-705`; `20261127010000…sql:79+`; epic Notes (story order decision) | accept | Lesson for the PO: when two stories in one PR rewrite the same function and one of them removes branches, check whether doing the removal first avoids building and testing a temporary version. |
| G3 | **Test helpers duplicated.** `seedPairDay` and `storeZone` (`tests/support/helpers/daily-clock.ts:36-91`) repeat the `assign_couple_day`, `daily_picks` and `user_time_zones` SQL of `seedPairDays` (`tests/support/factories/daily-question.ts:91-160`), using a fixed zone instead of the host's. `push-daily-reminders.spec.ts:84-90` and `:150-156` still write the same inserts inline. The Sunday-to-Saturday week is built four times in tests: `dailyQuestionFixture.ts:114-121` and `:127-138`, `StreakRow.test.tsx:14-30`, and `tests/e2e/partner/partner-streak.spec.ts:126-141`. | the files and lines named | defer | AGENTS.md's shared-helpers rule (DW-313): the review lenses did not check new helpers against `tests/support/factories/`. |
| G4 | **Migrations differ on transactions.** The 11.1 and 11.2 migrations have no `begin;`/`commit;` so that `migration-replay.ts` can replay them inside a rolled-back transaction. Every migration from `20261105210000` to `20261126020000` has them, and so does 11.3's, which has no replay spec. | plan 11.1 Implementation Notes; `migration-replay.ts:117-125` | accept (reason given in the plan) | none |
| G5 | **No leftover reads of the removed columns (R4).** Nothing in `src/` or `supabase/functions/` reads or writes `push_preferences.daily_question` or `daily_partner_picked`. `pushNotifications.ts:168-169` keeps both kinds in the map of which screen a tapped push opens, on purpose (story 11.2 Boundaries: a push delivered before the deploy still opens Daily). Checked and clean. | `pushPreferencesService.ts:69-96`; `send-push/index.ts:157`; `handler.ts:164-188` | accept | none |
| G6 | **A ledger title is out of date.** DW-538's title still ends "and its nudge slot". Its own 2026-11-26 triage line says the title drops those words once story 11.1 lands, and 11.1 removed the slots. | `deferred-work.md:4353`, `:4358` | fix now (ledger) | none |
| G7 | **Two Done-when lines are not met yet:** "Shipped to production through `deploy.yml`" and the at-closure hosted checks (the Live Daily Check on production, and the hosted `daily-reminders` runs after the deploy). The work sits on `loop/integration`, unmerged, and the loop is paused at epic closure. | `git log`; loop `ATTENTION` (06:41:48) | open item (action 1) | none: this happens after the retrospective by design (epic Notes; epic 8 retrospective, action 8) |

Other checks on the AGENTS.md rules, all clean: no `@/` alias in `src/`, no direct `supabase.channel()`, no `openDB`, no `realtime.send`, no `eslint-disable`, no date-only `new Date('YYYY-MM-DD')`, and no bare `toHaveBeenCalled()` on a console spy. The new account-scoped field `dailyQueuedPickSent` was added to `signedOutState()` (`authSlice.ts:265`). The new fake-timer tests follow the stubbed-`jest` recipe (`DailyQuestion.afterPick.test.tsx:633-636`, `DailyQuestion.nudge.test.tsx:369-371`).

### Diff-scope review (`bmad-review`: adversarial, edge-case-hunter, verification-gap)

The review made 17 claims over the whole range. This run checked each one against the source before keeping it.

**Kept (checked against the code):**

| # | Finding | Source | Disposition |
|---|---|---|---|
| R1 | **The re-read after a nudge can run under a different account.** In `sendDailyNudge`, the "already sent" (DQ010) branch and the lost-answer branch both call `readDayById(dayId)` without first checking that the same person is still signed in. `readDayById` records whoever is signed in when it starts, so after a switch it reads the old account's day as the new account. For a different account the server refuses that day, so nothing is written: the cost is a failed request, a logged error, and possibly the wrong message on screen. The unit test that covered "the session changed, so no re-read" used to send a network failure. `857be1bf` switched it to a DQ009 refusal, the one branch that does check, and the commit does not say why the test was narrowed. AGENTS.md (Known pitfalls) requires that. | `dailyDaySlice.ts:870`, `:881`, `:638-666`; `tests/unit/stores/dailyQuestionSlice.nudge.test.ts:352-363`; `git show 857be1bf` | defer (low) |
| R2 | **A send that ends as sent after the fact does not tell the partner's open Daily.** When "sent" comes from the DQ010 branch or from the re-read after a lost answer, the function returns before `announceDailyNudge`. So the partner's open Daily, and the sender's other device, get no live message. Criterion 17 (a stale button is refused as already sent) limits the harm. | `dailyDaySlice.ts:859-871`, `:879-883` against `:897` | defer (low) |
| R3 | **The re-read after a lost answer runs immediately (PLAUSIBLE).** If the connection fails while the server is still committing, the re-read can miss the nudge. The sender then sees "Your nudge could not be sent." while the push goes out. Unlike the reviewer's version, this run found no 30-second client timeout in `dailyQuestionApi.ts` or `supabaseClient.ts`, so it holds only for a connection failure during the commit. Rare. | `dailyDaySlice.ts:879-883`; story 11.1 criterion 16 | defer (low) |
| R4 | **The replay helper's check for its own transaction can be fooled.** The pattern `/(\$[A-Za-z_]*\$)[\s\S]*?\1/` misses dollar-quote tags that contain digits (`$fn1$`), so it wrongly rejects a valid migration. A stray `$$` in a comment can also blank a real `commit;`, which the replay would then commit into the shared stack. Test tooling only. | `tests/support/helpers/migration-replay.ts:122` | defer (low) |
| R5 | **An unreadable reply from `send_daily_nudge` is treated as an unknown outcome.** The re-read settles it correctly when it succeeds. When the re-read also fails, the sender sees "couldn't check" for a nudge the server did record. This is the same misclassification family as DW-557. | `dailyQuestionApi.ts:308-313` | defer: add to DW-557 |

**Already in the ledger** (not filed again): a definite server error treated as a lost answer is DW-557. An "already sent" mark kept only in memory is DW-558.

**Accepted: the owner decided this behaviour** (recorded so later retrospectives stop flagging it):

- A nudge held for a partner with no stored zone is never released, though it counts as sent. Story 11.1 criterion 12 and Notes; pinned by pgTAP DAILY-NUDGE-070.
- A held nudge goes out only on a tick inside 08:00-08:30. A missed window sends nothing (spine AD-9; story 11.1 criterion 12).
- How many pushes a second nudge about one question produces depends on timing: one push when both are held, and a nudge sent after 08:00 goes out at once. Story 11.1 criterion 22 and Notes.
- The sender is not told that a nudge is held. Story 11.1 criterion 11: "no line about 8 AM".
- Unreleased held rows are scanned on every tick with no index. Rejected in 11.1's review with a reason: at most two rows per couple per day.
- A past open day and a future day are drawn as the same grey circle. Story 11.3 criterion 3 and Decision.
- Installed builds can't nudge until they take the live update, because the snapshot drops `nudge`. Story 11.1 Notes decision, criterion 18.

**Dropped:** the claim that "a stale session returns 'sent'" (`dailyDaySlice.ts:885-894`). That return follows a successful send and writes nothing, so it is correct.

### Process

| # | Finding | Source | Disposition |
|---|---|---|---|
| P1 | **The worktree's TS2883 errors still slow the loop down.** In 11.1's worktree the `vite-plugin-checker` overlay showed TS2883 errors and blocked clicks. The build had to write a scratch Vite config and a temporary Playwright config to run E2E and the live check. 11.2 reports "the 5 known worktree-only TS2883 errors". The errors come from a type TypeScript cannot name portably when `node_modules` sits outside the worktree, and they clear with an explicit type annotation where they point. | plan 11.1 Verification (last bullet); plan 11.2 Verification | fix now (action 3) |
| P2 | **Another session used the shared stack during the build.** A pgTAP run failed in the untouched `41_daily_question_own_clocks.sql` while another session wrote. Two E2E failures happened while another session used the pool accounts, and both passed when rerun. Another session's seed left 35 picks on pool slot 2. The owner's rule is one shared stack, and reruns settled each case. | plan 11.1 Verification | accept (owner rule) |
| P3 | **A test assertion was narrowed without a stated reason** (R1). AGENTS.md already requires keeping what the old assertion checked or saying why in the commit (lesson L4). Neither 11.1's thorough review nor the build caught it. | `857be1bf`; AGENTS.md, Known pitfalls | lesson (action 4) |

## Behavior verification

These suites ran in the main checkout at `loop/integration` HEAD `af9265f6`, on the one shared local Supabase stack, with every migration through `20261127020000` applied and the loop paused. `supabase functions serve` was started for the `api` project and stopped afterwards.

| What was run | Result |
|---|---|
| `supabase test db` (pgTAP) | PASS: 37 files, 1226 tests |
| `deno test --no-lock supabase/functions/send-push/` | 123 passed |
| `api` project: push-daily-nudge, -nudge-held, -sender, -reminders, -picks, push-preferences-old-build, couple-streak-old-build | 12 passed; row audit clean |
| `integration` project: both migration-replay specs | 4 passed |
| `chromium`: all of `tests/e2e/daily/`, `settings/push-switches-daily`, `partner/partner-streak`, `partner/partner-streak-offline` | 42 passed; row audit clean |
| Live Daily Check, local mode (`playwright.live.config.ts`, no `LIVE_BASE_URL`) | 1 passed |
| `vitest`: `dateReminders` (both files), `dailyDaysCopy`, `dailyNudges`, both old-build schema tests | 6 files, 182 tests passed |

What was seen on screen: the end-of-test screenshots for the streak specs show the row as S M T W T F S. On the real-server Partner card (Friday 2026-11-27), today's Friday slot is ringed, Tuesday and Wednesday are done (check on fire), Thursday is missed (snowflake), and the days after today are the same plain grey as an open day. The stubbed dark card shows the same look. `git diff e4326eba..af9265f6 -- src/services/dateReminders.ts` is empty.

Not exercised: production and the hosted cron (the at-closure Done-when lines, G7); a real iPhone (the epic declares no iPhone check); every unit test outside the files named above, which the builds report passing under `SEED=11`.

## Previous-retro follow-through

Source: `epic-daily-pushes-and-nudge-retrospective.md`, Action items (9).

| # | Item (owner) | Landed? | Evidence |
|---|---|---|---|
| 1 | Close epic 8: iPhone report, a succeeded `daily-reminders-run-history` run, then Sofia closes (owner, PO) | yes, with the Done-when lines changed | `00039452`: closed on the owner's decision; the iPhone line was dropped and the cron line reduced to "both jobs listed and active" |
| 2 | Ledger, in one change: new entries, widen DW-540 and DW-538, update DW-542 (PO) | yes | six entries with `origin: epic 8 retrospective, 2026-11-26` (`deferred-work.md:4399-4438`); DW-538 `progress:` cites F1e (`:4360`); DW-542 `progress:` cites `ea53dabb` (`:4394`); DW-540 is `done 2026-11-26` (`:4372`) |
| 3 | A story for DW-532 with DW-536, and DW-539, before epic 9 (PO, dev loop) | yes | story 11.1 (`857be1bf`): per-question limit keyed on `day_id`, and "unknown is not failed" (criteria 7, 16, 17) |
| 4 | Reconcile R3's wording with AD-9: no stored zone means no scheduled push (PO) | not landed in epic 8's file; outdated | epic 8's R3 is unchanged (`epic-daily-pushes-and-nudge.md:30`). The 8 AM push it describes was removed by 11.2. Epic 11's story 11.2 criteria 1 and 3 say "a stored time zone". |
| 5 | Decide R6 and R7 (owner) | yes | story 11.1 Notes: a nudge to a partner with Nudges off counts as sent (R6); R7 is settled by "shows as sent" and the closing instant |
| 6 | Build rule: fix a defer that repeats an open ledger entry with a named fix (owner) | yes | `acfeae4b` |
| 7 | Build and review rules (a), (b), (c) (owner) | yes | `acfeae4b` |
| 8 | Set check: test Verify against the standing rules; write hosted proof as "at closure" (PO) | yes in this epic's wording; no evidence of a template change | epic 11 Constraints ("a hosted run is never a story step, only an at-closure check"); no commit to a ticket template or set check found |
| 9 | Architect proposal: one clock per rule, with the snapshot carrying the next turn (owner) | partly | 11.1's snapshot gives `closes_at` and the client closes on it with no re-read (plan 11.1 Design Notes). The test guards still use host-clock turns (DW-555). |

## Action items

All items are proposed. Nothing was applied by this run.

| # | Action | Owner | Kind | Source |
|---|---|---|---|---|
| 1 | Ship and close: merge the loop's one PR, let `deploy.yml` deploy it, confirm the Live Daily Check passes on production and the hosted `daily-reminders` runs after the deploy succeed. Then Sofia closes the epic and `bmad-loop resume 20261127-035223-8fca` continues. | owner, PO (`bmad-agent-po`) | delivery | G7; Done when |
| 2 | Ledger, in one change: retitle DW-538 without "and its nudge slot". New low entries for R1 (including the narrowed test), R2, R3, R4 and G3. Add R5 to DW-557. | PO (`bmad-agent-po`) | ledger, spec reconciliation | G3, G6, R1-R5 |
| 3 | Clear the worktree TS2883 errors at the cause: annotate the inferred type the errors name, so a worktree typecheck is clean and the checker overlay stops blocking E2E clicks. | owner decides; dev loop | remediation (tooling) | P1 |
| 4 | Review rule: when a diff rewrites a test's assertion, the review checks it against AGENTS.md's "keep everything the old one checked, or say why" rule. | owner (`bmad-build-auto` customization) | process | P3, R1 |
| 5 | Story ordering: when two stories in one PR rewrite the same function and one removes branches, the slicing checks whether the removal can go first. | PO | process (lesson) | G2 |

## Decision records

No decision passes the test. Each hard-to-reverse decision in the plans is already in the architecture spine `architecture-daily-question.md`, which the stories updated as they built:

- the one-argument `send_daily_nudge` defaulting to the button: AD-17, line 214;
- `calendar_week` with the `upcoming` state beside the unchanged `week`: AD-7, line 109;
- `daily_reminders.slot` kept, always `evening`, and the 08:00 tick assigning no day: AD-9, lines 131-132;
- the held nudge posted by an AFTER UPDATE trigger on `released_at`: AD-10, lines 137-147.

Leaving `begin;`/`commit;` out of two migrations (G4) is easy to reverse for future files, so it is not proposed. Headless run: nothing was written.

## Acceptance verdict

**accepted-with-open-items** (criteria declared, machine verdict, no human decision).

- Met, with evidence:
  - **Nudge rules:** the per-source limit, yesterday's question leaving today's open, the 08:00 hold and release, and the refusal after the partner's day ends. Proven with fixed instants in pgTAP `50_daily_nudges.sql` and `push-daily-nudge-held.spec.ts`.
  - **Three pushes, three switches:** `push-daily-sender`, `-reminders` and `-picks`, and `push-switches-daily`.
  - **Old builds still work:** the old-build schema unit tests, plus `push-preferences-old-build` and `couple-streak-old-build` over the wire.
  - **Days the old build saved:** `dailyDaysCopy.test.ts`.
  - **Both-answered wording:** `payload.ts:65-66`, `:240-242`, and `push-daily-sender`.
  - **Streak row:** E2E and the screenshots.
  - **`dateReminders.ts`:** unchanged, and its tests pass.
- Open: "Shipped to production through `deploy.yml`" and the at-closure hosted checks (G7, action 1). Both come after this retrospective by the epic's own design.
- No unfinished tickets. No blocking finding: every kept finding is low and deferred.

## Open questions

- Should the verdict wait for the shipping line? Two Done-when lines are delivery steps that can only happen after this retrospective. This run counted them as open items, as the epic 8 retrospective did. A reader who wants every Done-when line met before acceptance would record **rejected** until the deploy and the hosted check pass.
- Can R3 actually happen? Only a test with a server that commits after the client's request has already failed would show it.

## Assumptions

- The epic reference `epic-simpler-daily-pushes-and-nudge` matched the `epics` slug (id 11). The folder is the parent of `epic_file` from `find 11.1`.
- `pending_tickets`: `status <folder>` returned no such key. It was worked out from the rows (all three `done`/`done`), so it is empty.
- The verdict **accepted-with-open-items** was rendered without a human decision. The two unmet delivery lines in Done when were counted as open items rather than failed criteria, following the epic 8 retrospective's precedent.
- The 11.3 range ends at HEAD `af9265f6`, inferred; no later commit exists.
- The spine's AD entries were taken as the repository's decision records, since it has no `adr-*.md` file or decisions folder.
- The review's findings were checked against the source before being kept. Its "30 s client abort" detail was not found in the code, so R3 is recorded without it, as PLAUSIBLE.
- Session logs were searched, not read in full. Lessons about how the sessions went come from the plans.
- Every action item and the "no decision record" call are proposals. No ticket, plan, epic file or ledger entry was edited.
