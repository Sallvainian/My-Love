---
epic: epic-streak-and-partner-page
date: 2026-11-07
verdict: rejected
criteria: declared
headless: true
---

# Retrospective: Streak and Partner Page (epic 7)

The machine verdict is **rejected** for one reason only: the epic has not shipped. Two Done when lines are unmet: "Shipped to production through `deploy.yml`" and "After every deploy, the live check sees the production Claude bot pair's streak...". PR #493 is open and `main` is still at `8250e3de`. Every functional criterion, R1 to R8, is met in the evidence, and no finding blocks shipping. Once the epic is deployed and the Live Daily Check passes, a human override to **accepted-with-open-items** is what the evidence supports (see Acceptance verdict).

## Epic summary

- **Epic:** `_bmad-output/initiative-my-love/tickets/epic-streak-and-partner-page/` (epic id 7). It was built unattended by bmad-loop run `20261107-005314-0f5a`, in one lane, every story waiting on the one before.
- **Tickets:** all 11 are `status: done`, `state: done`. `pending_tickets` is empty, and no ticket is still at `built`.

| Ref | Title | Plan baseline | Range (provenance) | Review |
|---|---|---|---|---|
| 7.1 | The server counts the couple's streak | `8250e3de` | `8250e3de..d919197d` (`3af1aa0c`) | thorough, 2 passes |
| 7.2 | The Partner page shows the couple's streak in place of the partner's moods | `d919197d` | `d919197d..270d0d46` (`ee058ffa`) | thorough |
| 7.3 | The streak shows offline from its saved copy | `270d0d46` | `270d0d46..28b1bd66` (`0325fa16`) | quick |
| 7.4 | Daily shows the streak, the week and a missed day | `28b1bd66` | `28b1bd66..bd148702` (`9c83c48b`) | quick, 2 passes |
| 7.5 | The streak's +1 plays once for each new day | `bd148702` | `bd148702..50540eb6` (`72b45716`) | quick |
| 7.6 | Every 25 days the milestone screen shows its badge | `50540eb6` | `50540eb6..56d4ea8c` (`14f617f3`) | quick |
| 7.7 | The Partner page lists past questions marked Same or Different | `56d4ea8c` | `56d4ea8c..fafcb8fa` (`79b3b192`) | quick |
| 7.8 | See all opens every past question with the running count | `fafcb8fa` | `fafcb8fa..dc347d7c` (`1b56e3e6`) | quick |
| 7.9 | Past questions show offline | `dc347d7c` | `dc347d7c..bb000995` (`159bfc9d`) | quick |
| 7.10 | Refactor sweep | `bb000995` | `bb000995..64489fb0` (`e9fcfc80`) | quick |
| 7.11 | After every deploy, the live check also reads the streak | `64489fb0` | `64489fb0..860a4bd1` (`3d65e41a`), inferred to `HEAD` | quick |

- **What ships is PR #493's head, not `loop/integration`.** The PR head is `b0f026c1` on `chore/loop-20261107-005314-0f5a`, and it carries the 11 story commits re-published one-to-one. It adds one commit that is not on `loop/integration`: `6e2472f3`, "fix(partner): See all shows its loading and error states", a Claude-review fix on `dc433f5a`. The diff-scope review read `8250e3de..b0f026c1`, which is what ships.
- **Evidence inventory:**
  - Read in full: the epic file, `tickets.toml` rows (through `tickets.py status` and `find`), all 11 plans, and the epic's `.memlog.md`.
  - The previous retrospective, `epic-daily-question-retrospective.md`.
  - `deferred-work.md` entries DW-480 to DW-512.
  - PR #493's body, its comments, its CodeQL review and its check rollup.
  - The run folder's `ATTENTION` file and its 13 session log names (`.bmad-loop/runs/20261107-005314-0f5a/logs/`).
  - The spine companion's AD-7 and AD-13.
  - `git_evidence.py` over every range and over the whole epic: 22 commits, 11 merges, all 11 measured, 126 files.
- **Missing evidence:**
  - No story files: every ticket was built from its entry, and `find` gives `story_file: null`.
  - No run folders in the epic folder.
  - Session logs exist but were not opened; process lessons come from the plans and the run's `ATTENTION` log only.
  - The production deploy and its Live Daily Check have not happened, so nothing about the live site is checked.

## Findings

Dispositions: **fix now**, **defer** (to the ledger) or **accept**. "Prevention" names the upstream lesson. Diff-review findings name the lens or lenses that raised them; each was re-checked against the source at `b0f026c1` before routing.

### Aggregate views

- **G1. God-slice growth.**
  - **What:** `src/stores/slices/dailyQuestionSlice.ts` grew from 542 to 953 lines over the epic (`git cat-file -p` at `8250e3de` and `b0f026c1`), the epic's largest source churn (+453/−42). It now owns four domains:
    - the day: `loadDailyDay`, `refreshDailyDay`, `submitDailyPick`, `drainQueuedPicks`, `submitWrittenQuestion`, `declineWrittenQuestion`;
    - the streak: `loadCoupleStreak`, `claimStreakCelebration`;
    - the history: `loadDailyHistory`, `loadMoreDailyHistory`;
    - the partner-change reset: `clearPairData` and its sequence and generation counters.

    It also carries a 119-line header comment. The tests were split by domain because of the 1000-line test-file limit (`coupleStreakSlice.test.ts` in 7.2, `dailyHistorySlice.test.ts` in 7.7, `dailyQuestionSlice.partner.test.ts` in 7.9, and `.celebration` in 7.5), but the source stayed one file.
  - **Why it matters:** epics 8 and 9 read or extend this slice next.
  - **Disposition:** defer, as a refactor story that splits the streak and the history into their own slices before epic 8 builds.
  - **Prevention:** when a story splits a test file by domain because of size, its plan also weighs splitting the source.
- **G2. One root under three merges (duplication map).**
  - **What:** `readLocalCopy` answers `null` both for "absent" and for "read failed" (`src/services/localCopy.ts:96-105`), so every read-modify-write built on it rewrites from empty after a failed read. The callers:
    - `mergeDailyDay` and `addDeclinedWriteDay` (DW-487);
    - `claimCelebration` (DW-509, story 7.5);
    - `mergeDailyDays`, new in story 7.9 (`src/services/dailyDaysCopy.ts:204-222`).

    Story 7.9 also removed the 31-day cap, so one failed read during a history merge now rewrites the whole `daily-days` copy with that one page. Every saved older day is gone until each page is scrolled online again.
  - **Handoff that failed:** story 7.5's deferral named story 6 as "the natural place" for the distinguishing read. Story 7.6's plan never mentions it. Story 7.10 then found the code still missing and left DW-509 open.
  - **Disposition:** defer, as one story: a throwing or status-returning `readLocalCopy` variant, used by every merge. That closes DW-487 and DW-509 and covers `mergeDailyDays`. In the same change, DW-487 is updated to name `mergeDailyDays` and the cap removal.
  - **Prevention:** a deferral that names a later story as its home is copied into that story's ticket at planning, not left in the plan's frontmatter.
- **G3. Architecture delta: a third navigation mechanism, not documented.**
  - **What:** `/partner/history` is a Partner page held in `navigationSlice.partnerPath`, with `isPartnerRoute`, `partnerPathFromRoute`, `openPartnerPage`, `showPartnerPage` and `replaceWithPartnerTop`, both `App.tsx` ternaries, and `AppNavigation`'s `hasOwnBar` (story 7.8). This is neither a view nor a Settings subpage.
  - **The gap:** `AGENTS.md` still names only those two ("five hand-maintained places"; the Settings `SUBPAGES` table; `AGENTS.md:26`). This epic made no change to `AGENTS.md` (`git diff --stat 8250e3de b0f026c1 -- AGENTS.md` is empty), and `grep -c 'partnerPath\|/partner/history' AGENTS.md` returns 0.
  - **Disposition:** the design is accepted. Documenting it is fix now (action 6).
  - **Prevention:** a story that adds a route or a navigation pattern updates the `AGENTS.md` navigation paragraph in the same change.
- **G4. Pattern divergence: the data-model paragraph is stale.**
  - **What:** `AGENTS.md`'s "Maintained by hand" data-model paragraph still describes Daily's saved days as written "only ... through `mergeDailyDay`". It names neither the `daily-streak` kind, nor the device-state `daily-celebrated` kind, nor the `partner_id` tag and same-date drop on `daily-days`. It doesn't say that history pages merge into that copy through `mergeDailyDays`, or that the copy now has no cap. `AGENTS.md` tells agents to check this paragraph before writing data-layer code, and epics 8 and 10 will.
  - **Disposition:** fix now, as a documentation-only commit (action 6).
- **G5. Spec to spine: AD-7 and AD-13 lag the as-built.**
  - **AD-7, in the spine** (`architecture-daily-question.md:100-112`):
    - blue is "the newest closed day was missed";
    - `run` "counts back from the newest day that is done or closed";
    - the result carries no `week` or `missed`.
  - **AD-7, as built** (`supabase/migrations/20261107010000_couple_streak.sql`; 7.1 Implementation Notes):
    - blue is `missed > 0`, because the spine's rule gave blue with `missed` 0 for partners an hour apart;
    - `run` is the done dates after the newest missed date;
    - `week` and `missed` are returned.
  - **AD-13:** it says nothing of the partner tags or the same-date drop.
  - **Status:** the epic declined to edit the spine (Notes, Decision 2026-11-07), and 7.1's follow-up review rejected the drift for that reason.
  - **Disposition:** accept the as-built, and reconcile the spine (action 7) before epic 8 is refined, since epic 8 reads `couple_streak`.
- **G6. Spec reconciliation: not shipped.** The Done when lines "After every deploy, the live check sees ..." and "Shipped to production through `deploy.yml`" are not met. PR #493 is open (`gh pr view 493`: state OPEN, mergeable, all 24 checks green), and `origin/main` is `8250e3de`. Story 7.11's own residual risk says its second check, the deploy's Live Daily Check on main, cannot run before the merge. This is the only criterion behind the verdict. **Disposition:** fix now (action 1).
- **G7. Spec reconciliation: R4's "once for each new day".**
  - **What:** as built, the +1 plays once per increase of the stored held total. It always rolls from `held − 1` and shows "+1", even when the total rose by several days since the device last celebrated. A device's first claim only seeds and plays nothing.
  - **Source:** `src/services/dailyCelebrated.ts:55-79`, `src/components/DailyQuestion/StreakUp.tsx`, and story 7.5's Design Notes ("Rolling from `held - 1` keeps the design's "+1" literal"). The claim's `previous` field is returned and never read (`DailyQuestion.tsx` drops it).
  - **Raised by:** edge-case and adversarial.
  - **Disposition:** accept, as a recorded deviation, so later retros stop re-flagging it. Dropping the unused `previous` field is optional cleanup.
- **G8. Spec reconciliation: day entries saved before the update are hidden.**
  - **What:** story 7.9 tags every `daily-days` entry with its partner, and entries saved before this PR read as partner `null`. With a known partner they are hidden (`src/services/dailyDaysCopy.ts:89-110`; pinned in `tests/unit/services/dailyDaysCopy.test.ts:314` and `tests/unit/stores/dailyQuestionSlice.partner.test.ts:101`).
  - **Effect:** on the first offline open of Daily after the live update, today's saved question and pick are gone until one online read saves them again. Claude review run `42376118918` on `b0f026c1` suggests showing an untagged entry for today. The PR body calls it a product decision waiting on the owner.
  - **Disposition:** open question for the owner (action 2). It is in no ledger entry.

### Diff-scope review (`bmad-review` on `8250e3de..b0f026c1`, code only)

Lenses run: adversarial, edge-case-hunter and verification-gap, as independent subagents. Each was weighted toward the boundaries between stories. The lens findings below are those that held when re-checked; dropped and accepted ones are listed at the end.

**No in-app unlink exists.** `src/api/partnerService.ts` has no unlink call, and no migration defines one. So every "relink to a different partner" path below is reachable only through a server-side change of `users.partner_id`. That lowers their severity; it does not remove them.

- **D1. The celebration copy is not scoped to the pair** (all three lenses).
  - **What:** `claimCelebration` stores one `{ held, milestones }` per account per device, with no partner (`src/services/dailyCelebrated.ts:55-79`). Story 7.10's `clearPairData` (`src/stores/slices/dailyQuestionSlice.ts:397-417`) resets the streak and the history, and tags `daily-streak`, but leaves `daily-celebrated` alone.
  - **Effect:** after a relink, the new pair's held total starts at 0 against the old stored value, so no +1 and no milestone screen show until it passes the old pair's total.
  - **Why it slipped:** story 7.10 made the streak and history pair-scoped, but not the celebration copy story 7.5 built. No test covers a relink there.
  - **Disposition:** defer (low; server-side relink only). Fix: tag the copy with the partner and re-seed on a mismatch, or delete the kind in `clearPairData`.
- **D2. `clearPairData` leaves Daily's day** (adversarial, edge-case).
  - **What:** the reset clears the streak and history but not `dailyDay`, and Daily's read effect does not re-run on a partner change (`dailyQuestionSlice.ts:397-417` and its own comment). Only a `partner_linked` broadcast reloads the day.
  - **Effect:** Daily keeps the old pair's question and picks under the new partner's name until a remount or a re-join.
  - **Disposition:** defer with D1, as one ledger entry: "a server-side relink leaves the celebration and the day".
- **D3. Going offline shows a failure under valid rows on See all** (adversarial).
  - **What:** `PartnerView`'s read effect lists `isOnline` in its dependencies (`src/components/PartnerView/PartnerView.tsx:81-87`), so the drop to offline also runs `loadDailyHistory` and `loadCoupleStreak`. Both refuse at once and set the slice's errors. Since `6e2472f3`, `PastQuestionsPage` renders `dailyHistoryError` under the rows whenever rows exist (`PastQuestionsPage.tsx:212-218`).
  - **Effect:** every time the device drops offline with See all open, an error box appears under current rows, beside the offline banner. The cause is a read the effect made itself.
  - **Why it slipped:** a cross-commit interaction. 7.2 added `isOnline` to re-read on reconnect, and `6e2472f3` made the history error visible. Neither saw the other.
  - **Disposition:** fix now (action 4): read only on the change to online, plus the first mount.
- **D4. A failed "load more" online is never retried** (adversarial, edge-case).
  - **What:** the sentinel's observer re-arms only on `rowCount`, `dailyHistoryEnd` or `isOnline` (`src/components/PartnerView/PastQuestionsPage.tsx:76-89`), and the page has no Retry. After a timeout or a 5xx, paging stops with an error box.
  - **Ledger:** not there (DW-502 covers the streak card only).
  - **Disposition:** defer (action 3).
- **D5. See all has no empty state** (adversarial, edge-case).
  - **What:** with `dailyHistory` `[]`, nothing loading and no error, `/partner/history` (reached by reload or a direct URL) shows only the title and "Same pick on 0 of your 0 days". There is no "no past questions yet" branch (`PastQuestionsPage.tsx:141-218`).
  - **Disposition:** defer (low).
- **D6. "Yesterday was missed" can name the wrong day** (adversarial, edge-case).
  - **What:** the cold banner chooses its words from `missed === 1` alone (`src/components/DailyQuestion/DailyQuestion.tsx:138-140`). `missed` counts closed dates, and a date closes only after both partners' midnights (AD-3).
  - **Effect:** for a viewer east of the partner, yesterday is still open for some hours after the viewer's midnight, so the one missed date is the day before. The wording follows the epic's Notes ("The last {n} days were missed" after more than one miss) and is wrong for couples in different time zones, the case AD-3 exists for.
  - **Disposition:** defer. Name the date from `week`, or reword without dates. The wording is the owner's.
- **D7. A failed partner lookup re-tags saved days `null`** (adversarial).
  - **What:** `mergePartnerId` answers `null` for "unlinked", "lookup threw" and "lookup answered error" (`dailyQuestionSlice.ts:351-362`), and the merge always writes the new tag (`dailyDaysCopy.ts:150-170`). This is the null-for-two-states pattern that `AGENTS.md`'s Known pitfalls warn about.
  - **Reachability:** only when the store has no partner and no saved linked partner (a first sign-in on a device), and only until the next good merge.
  - **Disposition:** defer (low). Fix: keep a non-null stored tag when the lookup failed, or return a status.
- **D8. A copy comment contradicts its code** (adversarial, edge-case).
  - **What:** `src/services/dailyDaysCopy.ts:9-14` says "an old pairing's day stays saved but hidden", but the same-date drop in `mergeSnapshots` deletes the old pair's entry for every date the new pair also answers, whatever its tag. DW-492's resolution carries the same claim.
  - **Disposition:** fix now (action 5), comment and ledger wording only.
- **D9. Tag tests cover one merge path of five** (verification-gap).
  - **What:** with a known partner, only `loadDailyDay`'s tagging is tested (`tests/unit/stores/dailyQuestionSlice.partner.test.ts:133,143`). The other four merge paths are asserted only with no partner known, where `partner_id: null` is right: `drainOnce`, `refreshDailyDay`, `submitDailyPick` and `submitWrittenQuestion` (`dailyQuestionSlice.pickQueue.test.ts:290,320`, `.writeQuestion.test.ts:100,202`, `dailyQuestionSlice.test.ts:291,479`).
  - **Effect:** a call site that passed `null` would hide today's saved day offline after a pick, and no test would fail.
  - **Disposition:** defer (test gap).
- **D10. Daily's component fixtures use a state the app never reaches** (verification-gap).
  - **What:** `setPartner` sets `partner` without `partnerKnown` (`src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx:62-66`), and the saved-day tests write untagged entries (`:306`, `:317`; `WriteQuestionSheet.test.tsx:81,278`). They pass only because `shownPartnerId` answers `null`. `partnerSlice.loadPartner` always sets both fields together.
  - **Disposition:** defer (test gap), with D9.
- **D11. Streak reads fan out** (adversarial).
  - **What:** `get_couple_streak` is called from Daily's mount effect, from `SUBSCRIBED` and `daily_pick` in both listeners, after each confirmed pick or drained row, by the `online` refresher, and by `PartnerView`'s `isOnline` effect. Each call runs a `generate_series` over the pair's whole history.
  - **Disposition:** defer (low, perf), filed beside DW-495 (the same over-read for `get_daily_day`).
- **D12. A second claim in one mount can replace the overlay** (adversarial, edge-case). **PLAUSIBLE.**
  - **What:** the claim effect claims each `ok` streak shown. If the saved copy is above the stored celebration and the server answer is higher again, both claims play, and the second `setCelebration` resets `stage` to `'up'`, even mid-milestone (`DailyQuestion.tsx:431-446`).
  - **Not checked:** the race was not reproduced. The effect also waits for the mount's own day read.
  - **Disposition:** defer as plausible.

**Accepted or dropped from the lenses:**
- The milestone period 25 and the page size 30 live in both the client and the server (`StreakCard.tsx`, `milestoneBadges.ts`, `dailyQuestionApi.ts:189`): accepted. Story 7.2's plan specified the client's next-milestone line, and both are single expressions.
- The uncapped `daily-days` growth: accepted. The owner decided to keep every saved day (epic Notes, 2026-11-07).
- A stale store partner tagging a new pair's day: accepted. It is story 7.9's recorded residual risk and is self-healing on the next online read.
- The deleted interaction E2E coverage: already DW-503.
- The `DailyQuestion.tsx` header's "a streak that failed to load shows none of these": dropped, not verified.

### Process and other findings

- **P1. Plan residual risks never reach the ledger.**
  - **What:** `AGENTS.md` requires a deferred finding in `deferred-work.md` in the same change. Review findings did reach it as DW-500 to DW-512 (previous-retro item 7 landed). Three items that sit only in plans or the PR body are in no ledger entry:
    - 7.3's sign-out race between the last `isCurrent()` and the IndexedDB put in `saveStreakAnswer` (`dailyQuestionSlice.ts:668-674`; UNVERIFIED as reachable, and shared with `mergeDailyDay` and `partnerSlice`);
    - 7.5's offline short-lived mount, which can drop a +1 (UNVERIFIED);
    - the untagged-entries review suggestion (G8).
  - **Disposition:** defer: file the two residuals (action 3). Prevention: a residual risk that names a defect is filed as a DW entry at build time (action 10).
- **P2. Previous-retro item 6 did not land.**
  - **What:** `.bmad-loop/policy.toml:99` is still only `thorough_review = "high-risk"`. Story 7.11 changed `.github/workflows/deploy.yml` (a comment) and a live spec that reads the bot passwords, under a quick review.
  - **Disposition:** carry forward (action 11).
- **P3. Tracked plans cite ephemeral paths.**
  - **What:** the plans for 7.6, 7.7 and 7.8 point at design boards under `/private/tmp/claude-501/...worktrees-7-*/.../scratchpad/...`, which no longer exist. The durable source is the artifact URL in the epic's References.
  - **Disposition:** accept for these built plans. Prevention: a plan cites the artifact URL and the board's file name (action 12).
- **P4. The triage rejects the same plan-bookkeeping finding again and again.**
  - **What:** "the plan's Execution checkboxes were left empty" was raised and rejected in the triage of 7.1 (as `[false]`), 7.2 and 7.3. Story 7.10 ticked its boxes and was not flagged.
  - **Disposition:** accept. Prevention: the build ticks its Execution boxes, or the lens stops checking them (action 13).
- **P5. A CodeQL alert is a false positive.**
  - **What:** code-scanning alert 175, "useless assignment" at `tests/support/helpers/light-surfaces.ts:29`, raised on PR #493. The `rgba(0, 0, 0, 0)` assignment before `fillStyle = colour` is deliberate: an invalid colour leaves `fillStyle` unchanged, so the reset makes it read as transparent. The code moved there from `theme-sweep.spec.ts` in story 7.2.
  - **Disposition:** fix now (action 14): dismiss the alert with that reason, or add a one-line comment.
- **P6. What worked**, as the evidence shows it:
  - 7.1's two thorough passes caught a real cross-clock defect, blue with `missed` 0, before any client read it, and pinned it in 49 pgTAP checks.
  - The relink E2E (7.9) and the mark mutation (7.11) were each shown to fail with their guard removed.
  - Each new spec ran with `--repeat-each=3`.
  - CI on `b0f026c1` is green, burn-in included.
  - The refactor sweep (7.10) took up the four findings whose missing code a later story had built (DW-504, DW-508, DW-510, DW-511), as epic 6's action item 8 asked.

## Behavior verification

- **Ran on the local stack** (Supabase CLI 2.122.0, every migration applied, `20261107010000` and `20261107020000` included). The checkout was at `loop/integration` `860a4bd1`, which lacks only `6e2472f3`. Command:

  ```
  npx playwright test tests/e2e/partner/partner-streak.spec.ts tests/e2e/partner/partner-streak-offline.spec.ts tests/e2e/daily/daily-streak.spec.ts tests/e2e/daily/daily-streak-up.spec.ts tests/e2e/daily/daily-streak-milestone.spec.ts tests/e2e/partner/partner-past-questions.spec.ts tests/e2e/partner/partner-history.spec.ts tests/e2e/partner/partner-past-questions-offline.spec.ts tests/e2e/partner/partner-connect.spec.ts --project=chromium
  ```

  Result: **32 passed**, row audit clean ("no leftover rows: every pool-account count matches setup").
- **What those specs exercise:**
  - both partners pick and each Partner page shows 1 day answered together, 1 in a row, in orange;
  - the grey, orange and blue states over seeded days, on Daily and on Partner;
  - a pick queued offline that, once sent, updates the chip;
  - the +1 for the second picker at once, and for the first on return and while Daily is open, with no replay after a reload;
  - the 25th day's milestone screen, with 50, 75 and 100 grey;
  - Past questions with Same or Different, updated live;
  - See all with 35 days, paging, back and reload, in both dock forms;
  - the streak and past questions offline after a reload;
  - after a relink, no old pair's days;
  - partner search, requests and linking.

  The `Failed to fetch` console lines in the log are reads the specs abort on purpose.
- **CI on PR head `b0f026c1`:** all 24 checks passed, including Database Tests, E2E shards 1 to 4, Burn-In shards 1 to 3 and Backend Tests (api) (`gh pr view 493 --json statusCheckRollup`). Burn-in repeats a PR's changed specs.
- **Not exercised:**
  - The production site and the post-deploy Live Daily Check: the epic has not deployed.
  - The iOS shell, and the iPhone Duo side-column layout of the new screens. Plans 7.5, 7.6 and 7.7 record that the screens' look was not compared with the board: UNVERIFIED.
  - D3 was found by reading the code and was not reproduced in a browser.

## Previous-retro follow-through

Source: `epic-daily-question-retrospective.md`, Action items.

| # | Item (owner) | Landed? | Evidence |
|---|---|---|---|
| 1 | Ledger: file R1–R6 and R8; add A2's `addDeclinedWriteDay` case to DW-487 (PO) | Yes | DW-490 to DW-496, origin "epic 6 retrospective"; DW-487's reason names `addDeclinedWriteDay` (`deferred-work.md`); `39d05d59` |
| 2 | Fix two stale comments: `dailyQuestionApi.ts:14` and `partnerEvents.test.ts:4` (dev loop) | Yes | `src/api/dailyQuestionApi.ts:8-20` now describes DQ002 as a refusal (`4583f571`); `tests/unit/api/partnerEvents.test.ts:4` says four events (`6e19d37c`) |
| 3 | DW-482: wording for refused picks, mapped by code (owner, then dev loop) | Yes | DW-482 `status: done`; `4583f571` "fix(daily): show a plain sentence for each refused pick (DW-482)"; `PICK_REFUSAL_MESSAGES` |
| 4 | Reconcile epic 6's Notes and the 6.11 plan with `CLAUDE_BOT_PARTNER_PASSWORD` (PO) | Yes | `epic-daily-question.md:94,109`; the 6.11 plan's line 118 records the 2026-11-06 correction; `39d05d59` |
| 5 | Fix DW-489 (mise shims send a local run to the shared stack) (dev loop) | Yes | DW-489 `status: done 2026-11-06` |
| 6 | Loop policy: a story that adds a workflow job or handles a secret gets the thorough review (owner) | **No** | `.bmad-loop/policy.toml:99` is still `thorough_review = "high-risk"` only; 7.11 changed `deploy.yml` under a quick review (P2) |
| 7 | A finding rejected as rare but real is filed at triage, not at the sweep (owner) | Yes | DW-500 to DW-511 carry origin `spec-deferred <hash>`, filed per story from the plans' `deferred:` frontmatter, before the sweep (7.10) |
| 8 | The sweep checks each "needs new surface" rejection against surface the epic later built (PO) | Yes | The epic's Notes (Decision 2026-11-07, refactor sweep); the 7.10 plan's Intent and Implementation Notes |
| 9 | Allow an append-only Corrections line in a built plan (owner) | Yes | `## Corrections` in the 7.1 and 7.11 plans |
| 10 | A story adding a partner-event subscriber checks every event (PO) | Yes | The epic's Constraints, bullet 3; 7.2, 7.4 and 7.7 name every `PARTNER_EVENTS` event and test each (e.g. `PartnerView.listener.test.tsx`) |
| 11 | Carry forward epic 5 item 11 (`sim doctor`), item 16 (R2 and reload wording), and "a check story's defect gets its own story" (dev loop, PO) | Yes | `sim doctor`: the epic's Notes (DW-449 closed 2026-11-04); item 16: `a6e3ef00` "docs(settings): reconcile R2 and the reload decision with the code"; check-story rule: the epic's Notes and the 7.11 plan's Intent |

## Action items

Every item is proposed; nothing was applied. A follow-up to PR #493 goes on its branch (`AGENTS.md`, Policy).

| # | Action | Owner | Kind | Source |
|---|---|---|---|---|
| 1 | Ship the epic: after Sofia's closure commit lands on PR #493, merge it, let `deploy.yml` deploy, then confirm the Live Daily Check passes with 7.11's Partner-page assertions on main. Record the run id. | orchestrating session (merges), PO (closure) | delivery | G6 |
| 2 | Decide whether Daily shows today's untagged saved day after the update (Claude review run `42376118918`), before the merge in item 1. | owner | product decision | G8 |
| 3 | Ledger, in one change: file D1+D2 (a server-side relink leaves the celebration and the day), D4, D5, D6, D7, D9+D10, D11, D12 (plausible), and P1's two residuals (7.3 sign-out race, 7.5 offline short mount). Update DW-487 to name `mergeDailyDays` and the cap removal, and link DW-509 as the same root. | PO (`bmad-agent-po`) | ledger | D1–D12, G2, P1 |
| 4 | Fix D3 on PR #493's branch: `PartnerView`'s read effect reads on the change to online and on mount, not on going offline. Add a test that going offline with rows shown sets no history error. | dev loop | remediation | D3 |
| 5 | Correct `src/services/dailyDaysCopy.ts:9-14` and DW-492's resolution: an old pairing's entry is dropped on every date the new pair also answers. | dev loop | remediation, comments only | D8 |
| 6 | Update `AGENTS.md`, as a documentation-only commit: the navigation paragraph gets Partner pages (`partnerPath`, `isPartnerRoute` in both `App.tsx` ternaries, `hasOwnBar`, back and reload rules); the data-model and sign-out paragraphs get `daily-streak`, `daily-celebrated`, the partner tag and same-date drop on `daily-days`, history pages through `mergeDailyDays`, and no cap. | owner, or an agent the owner names | docs | G3, G4 |
| 7 | Reconcile spine AD-7 (blue is `missed > 0`; the `run` rule; `week` and `missed`) and AD-13 (partner tags, same-date drop) through `bmad-architecture`, before epic 8 is refined. | owner (`bmad-architecture`) | spec reconciliation | G5 |
| 8 | Add a story before epic 8 that splits `dailyQuestionSlice.ts` into a day slice, a streak slice and a history slice, keeping each session check. | PO | remediation (story-shaped) | G1 |
| 9 | Add a story: a `readLocalCopy` variant that tells "absent" from "failed", used by `mergeDailyDay`, `mergeDailyDays`, `addDeclinedWriteDay` and `claimCelebration`; closes DW-487 and DW-509. | PO, then dev loop | remediation (story-shaped) | G2 |
| 10 | A residual risk that names a defect, reachable or UNVERIFIED, is filed as a DW entry when the build writes it, not only in the plan. | owner (`bmad-build-auto` customization / loop policy) | process | P1 |
| 11 | Carry forward epic 6 item 6: a story that changes a workflow or reads a secret gets the thorough review whatever its `risk`. | owner (loop policy) | process | P2 |
| 12 | Plans cite a design board by the artifact URL and the board's file name, never a scratchpad path. | PO (ticket and plan template) | process | P3 |
| 13 | The build ticks its plan's Execution boxes (as 7.10 did), so the review stops raising and rejecting "checkboxes empty". | owner (`bmad-build-auto` customization) | process | P4 |
| 14 | Dismiss code-scanning alert 175 as a false positive with the reason in P5, or add a one-line comment at `light-surfaces.ts:28`. | dev loop | remediation | P5 |

## Decision records

Headless: proposed only, nothing written. No `adr-*.md` or decisions folder exists in the repository (`git ls-files | grep -iE '(^|/)adr-|decisions/'` is empty).

- **Proposed: "Partner pages are a `partnerPath` on the Partner view, not a view or a Settings subpage."**
  - **Source:** plan `story-see-all-opens-every-past-question-with-the-running-count-plan.md` (Intent, Design Notes, Implementation Notes), commit `1b56e3e6` (published as `dc433f5a`).
  - **Why it passes the test:** URLs and history entries depend on it, it is surprising beside the two documented mechanisms, and it was a trade-off against a new `ViewType` or a second stack. The plan's reason: the design's page has no app header, as Settings has none; the dock must keep Partner lit; and the epic barred a new view.
  - **Placement conflict:** `AGENTS.md` (Policy) says durable agent-facing prose goes in `AGENTS.md` and forbids generated documentation trees. So the recommendation is to record it there through action 6, not as `docs/decisions/adr-*.md`. The owner decides.
  - **Approved:** not asked (headless). **Written:** no.
- **Considered, not proposed as an ADR: `today_state` is blue while `missed > 0`** (7.1, `3af1aa0c`). It passes the test, but its home is the spine AD-7 it amends, so it goes to action 7.
- **Considered, not proposed: partner-tagged copies hide untagged entries** (7.9, `159bfc9d`). It waits on the owner's decision in action 2. It should be recorded only once decided.

## Acceptance verdict

**Machine verdict: rejected. Criteria: declared.**

The criteria not met are two Done when lines:

- "After every deploy, the live check sees the production Claude bot pair's streak and today's question in Past questions on the live Partner page." The check exists (`tests/live/daily-question-live.spec.ts`, story 7.11) and passes in local mode, but no deploy has run it.
- "Shipped to production through `deploy.yml`." PR #493 is open, and `origin/main` is `8250e3de`.

Criteria met in the evidence:

- **R1, R2, R3 and R8:** `supabase/tests/database/45_couple_streak.sql`, with 49 checks over fixed instants: an hour apart, the late pick at 11:50 PM sent at 12:10 AM, missed then done, relink. The gate file is `40_daily_question_gate.sql`. Colours are covered on Daily and Partner over seeded days by `daily-streak.spec.ts`. These ran as Database Tests in CI and in the local run above.
- **R4:** `daily-streak-up.spec.ts` (second picker, first picker on return and while open, Partner first, no replay) and the unit tests for Reduce Motion.
- **R5:** `daily-streak-milestone.spec.ts`: 25 in colour, 50, 75 and 100 grey, no replay.
- **R6:** `partner-streak.spec.ts`, `partner-streak-offline.spec.ts` and `partner-connect.spec.ts`: no mood card, recent moods or tiles, and linking as before.
- **R7:** `partner-past-questions.spec.ts`, `partner-history.spec.ts` and `partner-past-questions-offline.spec.ts`, plus `46_daily_history.sql` and the gate checks DAILY-120 to DAILY-122.
- **Constraints:** both RPCs are in the AD-5 gate file and FN-GRANT-008; the types were regenerated; `registerLocalCopy` is stubbed for `daily-streak`; `signedOutState()` covers the new fields; the page lives in `PartnerView/`.

No finding blocks: D3 is a visible but harmless false error, and the rest are low or rare. `pending_tickets` is empty.

**What a human override should weigh:** once action 1 shows the deploy and the Live Daily Check passing, the evidence supports **accepted-with-open-items**, with the open items being actions 2 to 14. Until then the epic is recorded as **not accepted**. No human decision was made in this run.

## Open questions

- Should Daily show today's saved day when it carries no partner tag (G8, action 2)? The answer changes whether PR #493 needs one more commit before it merges.
- Is the cold banner's wording a date ("Yesterday was missed") or a count ("1 day was missed") (D6)? It is the owner's copy decision.
- Should the D3 fix land on PR #493 before it merges, as a regression the epic introduced, or after it? Shipping does not wait on it under the verdict above.
- The session logs in `.bmad-loop/runs/20261107-005314-0f5a/logs/` were not read. A reader looking for why a plan changed course mid-build would need them.

## Assumptions

- **Epic reference:** `-H epic-streak-and-partner-page` matched the `epics` row with slug `epic-streak-and-partner-page` (id 7). The folder is `_bmad-output/initiative-my-love/tickets/epic-streak-and-partner-page/`, the parent of `epic_file` from `find`.
- **Pending tickets:** `tickets.py status <folder>` returned no `pending_tickets` key, and every row is `status: done`, `state: done`. This was read as an empty list, so the completeness check did not force the verdict.
- **Reviewed diff:** the publication branch's head (`b0f026c1`, what PR #493 merges), not `loop/integration` (`860a4bd1`). The plan ranges were taken from `loop/integration`'s first-parent history.
- **Behavior check revision:** it ran at `860a4bd1`, in the main checkout without switching branches, so `6e2472f3`'s page states were not part of the local run. CI on `b0f026c1` covers them.
- **Verdict:** the machine verdict **rejected** was rendered with no human decision, from the two unmet Done when lines alone.
- **Action items:** all 14 are proposals made without the user; none was applied.
- **Decision record:** the one proposed record was not written (headless).
- **Lens findings:** D1 to D11 were re-checked against the source before routing; D12 is marked PLAUSIBLE.
- **Token budgets:** the advisory budget lines in the run's `ATTENTION` file were noted and are not findings, per the owner's standing preference to judge quality over token counts.
