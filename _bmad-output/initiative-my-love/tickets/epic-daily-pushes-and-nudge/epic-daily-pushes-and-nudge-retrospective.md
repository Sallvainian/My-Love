---
epic: epic-daily-pushes-and-nudge
date: 2026-11-26
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospective: Daily Pushes and Nudge

All 11 tickets are `done`, and both loop runs shipped. PR #512 (8.1 to 8.4) deployed at `78f57fa1` (deploy run 45758104216). PR #513 (8.5 to 8.11) deployed at `1d1228bf` (deploy run 45787955502), and its Live Daily Check passed on production. The machine verdict is **accepted-with-open-items**. When drafted, two `Done when` lines waited on events after this retro (the owner's iPhone report and the first run of `daily-reminders-run-history`); the owner later dropped both requirements. Two owner-decided ledger fixes (DW-532 with DW-536, and DW-539) are still unbuilt. The owner confirmed the verdict on 2026-11-26 and reconciled two `Done when` lines (see Acceptance verdict).

## Epic summary

- **Epic:** `epic-daily-pushes-and-nudge` (id 8), folder `_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/`, resolved from the slug through `tickets.py find 8.1`.
- **Tickets:** 11, all `status: done`, `state: done`. `pending_tickets` is empty, and no ticket is still at `built`.

| Ref | Title | Risk | Review | Range (baseline → next baseline) | Loop commit | Main commit |
|---|---|---|---|---|---|---|
| 8.1 | Slice split into day, streak, history | medium | quick | `1a7acdc6..7a040302` | `320ab349` | `bf6a8a2d` + `51611a2f` |
| 8.2 | A failed read never overwrites a saved copy | medium | quick | `7a040302..76c8f4a2` | `42e62117` | `0901295e` |
| 8.3 | The sender knows the five daily pushes | high | thorough (+ follow-up) | `76c8f4a2..2c38fe0f` | `bf6302d4` | `d9c86223` |
| 8.4 | Switches and tap routing | medium | quick | `2c38fe0f..84e304ed` (cut, see below) | run-1 archive | `78a05196` |
| 8.5 | 8 AM / 8 PM on each person's clock | high | thorough | `78f57fa1..5d40755a` | `323111b2` | `2c40efd2` |
| 8.6 | Picks push the partner and both answered | medium | quick | `5d40755a..5c9ddeb9` | `e4708f60` | `0dbb72fa` |
| 8.7 | The server takes a nudge | high | thorough | `5c9ddeb9..e5e6e44b` | `aa579a1d` | `2bf27691` |
| 8.8 | Waiting screen's Nudge button | high | thorough | `e5e6e44b..a43190e5` | `fc623a32` | `54d788c9` |
| 8.9 | Nudge offer after a pick | medium | quick | `a43190e5..ef95e457` | `0f585561` | `399766c6` + `95aad6d1` |
| 8.10 | Refactor sweep | low | quick | `ef95e457..4d79a194` | `f681dd2f` | `342229f9` |
| 8.11 | Live check sends a nudge | medium | quick (oneshot) | `4d79a194..50a41305` (inferred, cut before `da0b0ae5`) | `979833c0` | `726e3d72` + `ea53dabb` |

- **Range notes:**
  - Run 1 (8.1 to 8.4, `20261125-221946-edbc`) and run 2 (8.5 to 8.11, `20261126-000434-4563`) used different `loop/integration` branches. `2c38fe0f` is not an ancestor of `78f57fa1`. 8.4's range therefore ends at `refs/loop-archive/20261125-221946-edbc` (`84e304ed`), not at 8.5's baseline, which would have pulled in all of PR #512's publication commits.
  - 8.3's range also holds two unrelated tooling commits (`22869d96`, `83a0e658`, TEA 4.6.1), excluded from the analysis.
  - Three commits are on `main` only and in no loop commit: `51611a2f` (8.1 store-api declaration, PR #512), `95aad6d1` (8.9, PR #513 review) and `ea53dabb` (8.11, PR #513 review). The local `loop/integration` branch therefore does not match main.
- **Diff:** `git diff 1a7acdc6 1d1228bf` without tooling (`_bmad`, `.claude`, `.agents`, `_bmad-output`, `.tea`, `skills-lock.json`, `AGENTS.md`): 100 files, +8408/−605. Saved for this run at the scratchpad path `epic-8.diff`.
- **Evidence read:**
  - The epic file.
  - `push-copy.md` (companion) and `.memlog.md`.
  - `tickets.toml` through `tickets.py`, and all 11 plans (frontmatter, Implementation Notes, Review Triage Log, Verification, Auto Run Result, Corrections).
  - Ledger entries DW-518 to DW-542.
  - The previous retrospective's Action items.
  - PR #512 and #513 comments, and the commit bodies of `95aad6d1`, `ea53dabb` and `0143409b`.
  - The Deploy and Live Daily Check job logs.
  - The hosted catalog, read-only: `cron.job`, `cron.job_run_details`, `supabase_migrations.schema_migrations`, and counts in `daily_nudges`, `daily_reminders` and `push_requests`.
- **Evidence missing:**
  - **Story files:** none exist, because no entry was pulled.
  - **Run folders:** none in the epic folder.
  - **Session logs:** not read; `.bmad-loop/archive/` was not opened. Process lessons below rest on plans, the ledger and commits only.
  - **PR #513's earlier review rounds:** the sticky comment now holds only the last round, run 45785932400, "no blocking issues". The two earlier Minor findings are sourced from the commit bodies that fixed them.
- **Also queried, with no effect:** one hosted query first went to the wrong project. It was read-only (`cron.job`, a missing table) and returned nothing.

## Findings

Each finding gives its source and its disposition. Findings from subagents (the `bmad-review` lenses, a clock-seam map and an aggregate-views pass) were re-checked against the code at `1d1228bf` before routing. Those that did not hold up, or that I could not verify, are listed at the end as dropped.

### F1. Clock seams (going-in concern 1)

One rule, "the day turns at midnight and the nudge slot at 20:00", is computed on four clocks:

| Clock | Where | Zone |
|---|---|---|
| Stored zone, last device to read wins | `enqueue_daily_reminders` (`20261126000000_daily_reminders_schedule.sql:84-95`); `daily_nudge_slot`, `record_daily_nudge`, the snapshot's `nudge` (`20261126020000_daily_nudge.sql:67-90, 150-155, 300-316`); `user_local_date` (`20261125000000_daily_push_sender.sql:196-213`) | `user_time_zones`, written only by `get_daily_day` when `reported_at` is newer (`20261105210000_daily_question_own_clocks.sql:116-121`) |
| Request zone | `get_daily_day` dates the day with the zone it was sent (`…own_clocks.sql:282-286`) | this device |
| Device clock | `useDailyDayRereads` 20:00:05 (`src/hooks/useDailyDayRereads.ts:25-40`); `showWriteSheet` and the pick check (`DailyQuestion.tsx:503`, `dailyDaySlice.ts:502-503`) | this device |
| Host clock | `waitClearOfDailyTurns` (`tests/support/helpers/events.ts:233-258`), now also in the live check (`ea53dabb`) | test runner |

| Seam | Condition | Ledger | State |
|---|---|---|---|
| Sender's date vs the day nudged about | partners in different zones, sender past midnight | DW-532, DW-536 | open; owner decided 2026-11-26 to key on `day_id` |
| Recipient's 8 PM vs partner's date | partners four or more hours apart | DW-529 | won't fix (owner, 2026-11-26) |
| Stored zone read twice in `record_daily_nudge` | a zone write between two statements | DW-533 | open |
| Device 20:00 vs stored-zone 20:00 | a second device of one account in another zone | DW-540 | open |
| Timed-out nudge shown as failed | timeout after commit | DW-539 | open; owner decided 2026-11-26 (unknown is not failed) |
| Live check on UTC bots vs host-clock guard | UTC midnight between A's open and pick | DW-542 | open in the ledger, but `ea53dabb` covers it on the UTC deploy runner (see F1d) |
| **F1a. Request zone vs stored zone inside one `get_daily_day`** | a second device's newer `reported_at` keeps this device's zone out of the table; the day comes from this device, the nudge slot and DQ009 from the other | none (same root as DW-540) | **new**, verified `…own_clocks.sql:121, 282-286` |
| **F1b. send-push judges "the recipient's current date" at send time, not pick time** | a first pick in the seconds before the recipient's midnight, posted after it, is dropped; a second is worded "That day counts." | none | **new**, verified `supabase/functions/send-push/handler.ts:436-454, 657-658` |
| **F1c. One 20:00:05 re-read with no retry** | the device runs more than 5 s ahead of the server, or the read fails: the evening slot shows only after a return or reload (review lens, adversarial 4) | none (near DW-540) | **new**, verified `useDailyDayRereads.ts:25-40` |
| **F1d. DW-542 is stale** | `ea53dabb` runs `waitClearOfDailyTurns` before the reset, and the deploy runner is on UTC, so a deploy run is guarded against both UTC turns. The rest only matters for a local live run on a non-UTC host. | DW-542 says the fix is still needed | ledger hygiene |
| **F1e. No re-read at the partner's midnight** | a page left open across the partner's midnight keeps an enabled button that DQ009 refuses (review lens, edge-case 4) | DW-538 names only the sender's midnight | widen DW-538 |

- **Disposition:** defer. F1a, F1c and F1e widen or join open entries. F1b is new. F1d updates DW-542.
- **Upstream lesson:** AD-17 defines the slot on the server's stored-zone clock. The client (`EVENING_HOUR = 20` on the device clock) and the tests (the host clock) re-derive the same turn on their own clocks. Six of the epic's 18 ledger entries and three of the four new seams come from that re-derivation. See action item 9.

### F2. One host-clock flake deferred five times before one fix (going-in concern 2)

- **What happened:** DW-527 (8.3), DW-531 (8.6), DW-534 (8.7), DW-535 (8.8) and DW-541 (8.9) are one defect: a spec takes "today" from the host clock before seeding, so a run that crosses local midnight or 20:00 fails.
- **The repeats knew it was the same defect:**
  - From DW-531 on, each entry names the earlier ones.
  - Each names the shared fix: "the fix is a guard … shared by both specs" (DW-531); "the same low flake stories 8.3 and 8.6 deferred … the shared fix is a guard" (DW-534); "the same … stories 8.3, 8.6, 8.7 and 8.8 deferred" (DW-541).
  - Stories 8.6 to 8.9 each wrote a new spec with the same seeding while the entry was open.
  - Story 8.10 fixed all five at once with `waitClearOfDailyTurns` (`342229f9`).
- **Is it a process lesson? Yes.**
  - The epic 7 rule "file a residual risk at build" (action 10, adopted in `f1f54e8c`) worked: every occurrence was filed, and that is what let 8.10 find them.
  - But filing is not fixing. A defer whose own text says it repeats an open entry, and names a shared fix one helper long, cost four extra entries and four extra review rows.
  - Nothing stopped the next spec from copying the pattern.
- **Disposition:** accept this instance (fixed). Lesson: action item 6.

### F3. What the loop's reviews missed and PR #513's review caught (going-in concern 3)

- **8.9's `no-restricted-properties` suppression** (fixed on main in `95aad6d1`):
  - 8.9's Implementation Notes record both suppressions it added: `no-restricted-properties` on `useAppStore.getState()`, with `usePhotoImage.ts` as precedent, and `react-refresh/only-export-components`.
  - The quick review applied AGENTS.md's "fix before suppressing" to the second (finding 4, patched by moving the helper to `nudgeFailureMessage.ts`) and never raised the first.
  - So the review knew the rule and applied it to one of the two lines it covered.
- **8.11's 20:00 UTC race** (fixed on main in `ea53dabb`):
  - 8.11's Implementation Notes name the exposure: "the nudge's only new exposure is a 20:00 UTC crossing in the seconds between the 200 and the disabled check".
  - The review's medium patch then added a reload between the 200 and the check, which widens that window.
  - The review filed only the midnight case (DW-542). The 20:00 case, named in the plan, was never filed, against epic 7 action 10.
- **Common factors:**
  - Both stories ran `review: quick` (pinned), one lens.
  - Both misses are in lines the plan itself wrote down.
  - Both fixes landed on the publication branch only, so `loop/integration` and the `refs/loop-archive` refs lack them.
- **Disposition:** accept these instances (fixed on main). Lesson: action item 7.

### F4. Verify lines that could not run as written (going-in concern 4)

- **8.11, a fresh local stack:**
  - The ticket's Verify asks for two passes on a fresh local stack.
  - The owner's one-shared-stack rule forbids that.
  - The review rejected the finding on that rule and ran both passes on the shared stack (8.11 plan, Review Triage Log).
  - The ticket was written during the 2026-11-25 refinement, after the rule existed, and the set check passed it.
- **8.5, hosted pg_cron:**
  - The residual risk said pg_cron on hosted was "proven only on the local stack".
  - The epic's `Done when` gave the hosted proof to closure, so the gap was by design.
  - Checked for this retro, hosted `My-Love` at 2026-11-26 09:16 UTC:
    - Both jobs are listed and active (`daily-reminders` `*/5 * * * *`, `daily-reminders-run-history` `17 3 * * *`).
    - `daily-reminders` has 3 runs, all `succeeded`.
    - `daily-reminders-run-history` has not run yet; its first run is 03:17 UTC 2026-11-27.
    - The four migrations `20261125000000` to `20261126020000` are applied.
- **Disposition:**
  - 8.11: accept (the shared-stack runs are recorded).
  - 8.5: open item until the run-history job runs.
  - Lesson: action item 8.

### F5. Review-lens findings (`bmad-review`: adversarial, edge-case, verification-gap) over the whole diff

| # | Finding | Verified | Disposition |
|---|---|---|---|
| R1 | Escape or a scrim tap closes `NudgeSheet` while a send is in flight, so a failed send's error line is never shown. "Not now" is disabled while sending; the scrim and Escape are not (`NudgeSheet.tsx:56-57, 78-80` vs `:117`). | yes | defer, new low entry |
| R2 | Of the five daily keys in `PUSH_SWITCH_KEYS`, only `dailyNudge` has a one-off summary test (`NotificationsPage.test.tsx:680`). Dropping any of the other four keys reads "On" with that switch off, and no test fails. | yes | defer, new low entry (test) |
| R3 | The `daily_nudge` broadcast goes to the partner, whose snapshot has no `nudge.slot` to change. The sender's own other device is never told, keeps an enabled button, and a tap fails with DQ010. | yes (`dailyDaySlice.ts:663`) | defer, new low entry |
| R4 | The 8.5 reminders spec's guard counts a `dailyrem-*` pair left by a killed run (`push-daily-reminders.spec.ts:106`). | plausible, not reproduced | defer, new low entry |
| R5 | send-push reads `couple_streak` before the switch check (`handler.ts:448, 462, 505`), so a switched-off kind can still 500 on a failed streak read. | yes (order) | defer, new low entry |
| R6 | A nudge to a partner who has Nudges off, or has no device, spends the slot and shows as sent. | yes (no check in `record_daily_nudge`) | open question for the owner |
| R7 | A greyed Nudge button says nothing about why: sent, not yet 8 PM, or the day over. | yes | open question for the owner |
| — | Sender's midnight opens fresh slots (= DW-532, DW-536); evening_partner across far-apart clocks (= DW-529); no midnight re-read (F1e); single 20:00 re-read (F1c) | — | already routed |
| — | DQ010 and DQ008 show the same sentence | — | accept: owner-approved 2026-11-25 (epic Notes), and DW-539's decision covers the timeout case |
| — | A 30-minute window with no catch-up loses a slot during an outage | — | accept: epic Boundaries ("a missed window sends nothing", AD-9) |
| — | `evening_partner` still sends after a 19:59 after-pick nudge | — | accept: R5 skips only a spent *evening* nudge, as written |
| — | A western recipient never gets "partner picked" for the partner's next date | — | accept: R4 as written ("unless it is for a day that is not the recipient's current date") |
| — | `waitClearOfDailyTurns` leaves a disabled timeout (0) alone | — | accept: deliberate (8.10 Implementation Notes) |

### F6. Aggregate views

- **Size growth:** measured at `1a7acdc6` and `1d1228bf` with `git show | wc -l`.
  - **The split works:** 8.1's split took `dailyQuestionSlice.ts` (1014 lines) to `dailyDaySlice.ts` 687, `dailyStreakSlice.ts` 203 and `dailyHistorySlice.ts` 238. Even after 8.8 and 8.9 added the nudge, no slice is past 700.
  - **`DailyQuestion.tsx`** grew 611 → 760 lines. It holds seven components, with `DailyQuestion` itself at 338 lines and `DayCard` at 155. That is a candidate, not yet a god-class. **Disposition:** accept, and watch in epic 9, which changes the reveal card.
  - **`supabase/functions/send-push/handler.test.ts`** grew 1197 → 1738 lines and `handler.ts` 537 → 744, with one `resolveSource` switch over 13 kinds. Epic 10 removes three of those kinds. **Disposition:** accept.
- **Duplication map:**
  - **The couple-day id lookup is written by hand in three api specs.** Sorted `user_a`/`user_b` queries on `couple_days` appear in `push-daily-nudge.spec.ts:72-79`, `push-daily-sender.spec.ts:92-98` and `push-daily-picks.spec.ts:75-82`, although `tests/support/factories/daily-question.ts` exports `readPairDayIds` and `orderedPair`.
    - The two `setUpPair` recipes and the `type Cleanup` redeclarations (`:47`, `:63`) are the same pattern.
    - The 8.5 and 8.6 reviews moved `createParty`, `link`, `registerDevice` and `zeros` into `push-requests.ts` but left these.
    - Against AGENTS.md's "Shared test helpers" rule. **Disposition:** defer, new low entry.
  - **The nudge-send handler is written twice.** The same `sending`/`error` state and try/catch is in `WaitingCard` (`DailyQuestion.tsx:218-235`) and `NudgeSheet` (`NudgeSheet.tsx:43-70`). **Disposition:** defer, with R1, since a shared hook is where R1's guard would go.
  - **A refusal is logged twice:** at `dailyQuestionApi.ts:300` (`logSupabaseError`), then again at `nudgeFailureMessage.ts:16` (`console.error`). **Disposition:** defer, new low entry.
  - **The 20:00 rule is defined three times:** `daily_nudge_slot` (server), `EVENING_HOUR` (client) and `[0, 20]` in `events.ts` (tests). This is the root of F1; see action item 9.
- **Pattern divergence:** checked against AGENTS.md.
  - **Clean:**
    - no direct `supabase.channel()`; `announceDailyNudge` uses `sendEphemeralBroadcast`;
    - no `@/` in `src/`;
    - no `eslint-disable` left at `1d1228bf`;
    - `sendDailyNudge` captures and re-checks the session (`dailyDaySlice.ts:629-658`);
    - every new slice field is in `signedOutState()`;
    - `dateReminders.ts` is unchanged (`git diff 1a7acdc6 1d1228bf` empty);
    - every new client RPC is in FN-GRANT-008 and FN-GRANT-024, and the types were regenerated (8.3, 8.5 and 8.7 plans).
  - **One record gap:** 8.6 narrowed one 8.3 assertion: the late second pick now asserts the run-0 copy, and the run-1 copy moved to `push-daily-picks.spec.ts` step 1 (8.6 Implementation Notes). AGENTS.md asks for the reason in the commit, and neither `e4708f60` nor `0dbb72fa` gives it. Coverage moved; it was not lost. **Disposition:** accept, recorded here.
- **Spec-to-implementation reconciliation:**
  - **S1. R3 leaves out a spine rule.**
    - R3 says "each linked partner with a registered device who has not picked gets the new-question push".
    - The cron job also requires a stored zone (`daily_reminders_schedule.sql:84`).
    - Spine AD-9 says so ("A user with no row gets no scheduled push").
    - So someone who has never opened Daily gets no 8 AM or 8 PM push.
    - **Disposition:** accepted deviation (it follows the spine); reconcile R3's wording (action item 4).
  - **S2.** R1 to R8 are met in the evidence. Each plan's Verification lists the passing tests, and the Live Daily Check passed on production after the deploy (run 45787955502).
  - **S3.** `Done when` is graded line by line in the Acceptance verdict.

### Dropped (source did not hold up, or not verified)

- **Adversarial 6:** a cron-made day moves a pending written question's target. Not traced; UNVERIFIED.
- **Adversarial 8:** a one-way `partner_id` link lets an ex-partner be nudged. Whether a one-way link is reachable was not checked; UNVERIFIED.
- **Clock-map pair 8:** device clock skew lets a device win the zone write. `reported_at` is clamped to `now() + 5 min` (`…own_clocks.sql:104-106`); no harm traced beyond F1c.

## Behavior verification

- **Exercised on production:**
  - The post-deploy **Live Daily Check** for `1d1228bf` (run 45787955502, job "Live Daily Check", success) ran `[P0] the bot pair sees one question, a hidden pick, a nudge, the reveal on the second pick, and the day on Partner`: 1 passed.
  - That covers, on the deployed bundle and the hosted database: a pick, the after-pick sheet, `send_daily_nudge` returning 200, the slot spent after a reload, the second pick's reveal, and the Partner page.
  - Hosted `daily_nudges` holds 1 row afterwards.
- **Observed on hosted (read-only):**
  - `daily-reminders` ran at 09:05, 09:10 and 09:15 UTC, all succeeded.
  - `daily_reminders` has 0 rows, and no daily-kind `push_requests` exist since the 04:54 deploy.
  - Expected: no linked user with a device had reached 08:00 or 20:00 local in that span, and the bots register no device.
- **Not exercised by this retro:**
  - Delivery to a device, and any of the five kinds arriving on the owner's iPhone. That is the epic's closure check, by design.
  - The 8 AM and 8 PM windows firing for a real person.
  - The local E2E, api, pgTAP and Deno suites were not re-run. Their results are each build's (plans' Verification), plus CI's `Tests` on `1d1228bf` (run 45787955548, success).

## Previous-retro follow-through

Source: `epic-streak-and-partner-page-retrospective.md`, Action items (14).

| # | Item (owner) | Landed? | Evidence |
|---|---|---|---|
| 1 | Ship epic 7 and confirm the Live Daily Check (orchestrating session, PO) | yes | PR #493 merged 2026-11-08 (`2fe68210`); deploy run 42438297377 success; closure `1ff92ff8` |
| 2 | Decide whether Daily shows today's untagged saved day (owner) | yes | `26514052`, `69074150` (on PR #493); the rule is in AGENTS.md's data-model paragraph |
| 3 | File D1 to D12 and P1's residuals; update DW-487, link DW-509 (PO) | yes | ledger entries whose `origin:` cites "epic 7 retrospective (D1 and D2)" through "(P1, story 7.5's residual risk)" (`deferred-work.md:4367-4431`); DW-487 and DW-509 closed by 8.2 |
| 4 | Fix D3: PartnerView reads on going online, not offline (dev loop) | yes, by commit subject | `eb4541d2` "no offline error under valid See all rows", `72c48662`; whether a test was added was not checked |
| 5 | Correct the `dailyDaysCopy.ts` comments and DW-492 (dev loop) | yes | `974638af` |
| 6 | AGENTS.md: Partner pages and the streak copies (owner) | yes | `e5961956`, `f3b94dd7` |
| 7 | Reconcile spine AD-7 and AD-13 (owner, architect) | yes | `1f77833b` |
| 8 | Story: split `dailyQuestionSlice.ts` (PO) | yes | story 8.1, `bf6a8a2d` |
| 9 | Story: `readLocalCopy` absent vs failed (PO, dev loop) | yes | story 8.2, `0901295e` |
| 10 | File a residual risk as a DW entry at build (owner) | yes, with one miss | `f1f54e8c` (`_bmad/custom/bmad-build-auto.toml`). 18 entries (DW-525 to DW-542) were filed through the plans' `deferred` lists. Miss: 8.11's 20:00 exposure (F3). |
| 11 | Thorough review for a workflow or secret change (owner) | declined | `f1f54e8c` body: "Action 11 stays declined" |
| 12 | Cite a design board by artifact URL (PO) | yes | `f1f54e8c`; the plans cite `claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh` and `Waiting.dc.html`; no scratchpad path in any plan (grep empty) |
| 13 | The build ticks its Execution boxes (owner) | yes | 0 unchecked boxes in the 11 plans; 6 to 10 ticked in each plan with a Tasks list (8.11 is a oneshot with none) |
| 14 | Dismiss code-scanning alert 175 (dev loop) | yes | alert 175 `dismissed`, "false positive", with the reason |

## Action items

All items are proposed. Nothing was applied by this run.

| # | Action | Owner | Kind | Source |
|---|---|---|---|---|
| 1 | Close the epic: the owner reports each of the five kinds arriving on the iPhone, 8 AM and 8 PM on their own clock, and an off switch stopping one. After 03:17 UTC 2026-11-27, confirm `daily-reminders-run-history` has a succeeded run. Then Sofia closes the epic. | owner, PO | delivery | Done when; F4 |
| 2 | Ledger, in one change. New low entries: F1b, R1 (with the duplicated send handler), R2, R3, R4, R5, the day-id lookup duplication, and the double log. Widen DW-540 with F1a and F1c, and DW-538 with F1e. Update DW-542: covered on the deploy runner by `ea53dabb`, residual only for a local run on a non-UTC host. | PO (`bmad-agent-po`) | ledger | F1, F5, F6 |
| 3 | A story for the owner-decided fixes: DW-532 with DW-536 (key the nudge limit on `(from_user, day_id, slot)`, update AD-17) and DW-539 (unknown is not failed). Sequence it before epic 9, which waits on this epic's migrations and types. | PO, then dev loop | remediation (story-shaped) | F1; ledger decisions 2026-11-26 |
| 4 | Reconcile R3's wording with AD-9: a person with no stored zone (never opened Daily) gets no scheduled push. | PO | spec reconciliation | S1 |
| 5 | Decide R6 (a nudge to a partner with Nudges off, or no device, spends the slot and shows as sent) and R7 (what a greyed Nudge button tells the sender). | owner | product decision | F5 |
| 6 | Build rule: a defer whose text repeats an open ledger entry with a named shared fix is fixed in that build rather than filed again. A new test written while such an entry is open must not repeat the pattern. | owner (`bmad-build-auto` customization) | process | F2 |
| 7 | Build and review rules: (a) an exposure written in Implementation Notes is a residual risk and is filed like one; (b) a review patch that changes timing re-checks the exposures the plan states; (c) the review lists every `eslint-disable` the diff adds and checks each against "fix before suppressing". | owner (`bmad-build-auto` customization) | process | F3 |
| 8 | Set check: test each ticket's Verify against the standing rules (one shared local stack, no device clock), and write hosted-only proof as "at closure" rather than as a story step. | PO (set check, ticket template) | process | F4 |
| 9 | Proposed for the architect: one clock per rule. For example, the snapshot could carry the instant its nudge slot or day next turns, so the client's re-read and the test guards follow the server's answer instead of re-deriving 20:00 and midnight on the device or host clock. The owner decides whether to take it up. | owner (`bmad-agent-architect`) | spec reconciliation (proposal) | F1 |

## Decision records

Candidates read: the 11 plans' `<intent-contract>` blocks, Design Notes and Implementation Notes. The repository has no `adr-*.md` or decisions folder.

- Skipped because spine AD rules already record them:
  - the nudge limit key (AD-17);
  - the five-minute pg_cron schedule with 30-minute windows and no catch-up (AD-9);
  - `{kind, id}`-only posts with send-push never reading a choice (AD-5, AD-10);
  - the sender shipping one deploy ahead of the triggers (AD-10, epic Notes).
- Skipped because they are reversible and documented in code:
  - 8.2's three-state `readLocalCopyStatus`;
  - 8.1's single pair-change subscriber in the day slice;
  - 8.10's guard that waits rather than skips;
  - 8.11's branch on `snapshot.write.mine`.

No decision passes the test, so none is proposed and no file was written.

## Acceptance verdict

**Machine verdict: accepted-with-open-items** (criteria declared). **Human decision (owner, 2026-11-26): accepted-with-open-items, and the epic is closed.**

The owner reconciled two `Done when` lines before closing:

- **Dropped:** the line that each kind arrives on the owner's iPhone. The owner's reason: the push kinds are covered by the api and E2E specs, and device delivery was proven in story 3.13 ("Pushes arrive through APNs on a device and from the hosted project", `done`).
- **Dropped:** the requirement that both cron jobs' last runs succeeded. The owner's reason: `daily-reminders` has succeeded runs, and `daily-reminders-run-history` is listed and active.

Decisions on this retro's items since it was drafted:

- **R1 and R2 are fixed.** PR #514 merged as `1feed397`: the nudge sheet ignores Escape and an outside tap during a send, and each daily switch has its own summary cases.
- **R6 is decided** by the follow-up story "simplify the daily pushes and nudges": a nudge to a partner with Nudges off still counts as sent, and the sender is not told the partner's setting.
- **R7 is moot:** that story removes the waiting card's Nudge button.
- **The owner decisions on DW-532 and DW-536 are superseded by the same story:** one nudge per sender per daily question, replacing the `after_pick` and `evening` slots.

Criteria as reconciled:

| Criterion | Evidence | Met |
|---|---|---|
| R1 to R8 | each plan's Verification; CI `Tests` on `1d1228bf`; production Live Daily Check | yes |
| ~~Each kind arrives on the owner's iPhone~~ | dropped by the owner, 2026-11-26 (api and E2E specs; story 3.13) | — |
| A nudge pushes the partner, and a third nudge on one day is refused | `50_daily_nudges.sql`, `push-daily-nudge.spec.ts`, Live Daily Check. Partners on different clocks can get a third via DW-532 (owner-decided fix not built). | yes for one clock; open item DW-532 |
| The partner-picked push never shows the pick | send-push's column-listed reads (8.3), `49_daily_pick_pushes.sql` bodies `{kind, id}` only | yes |
| A switch off stops its push | `handler.test.ts`, `push-daily-picks.spec.ts`, `push-daily-sender.spec.ts` | yes in tests |
| `dateReminders.ts` unchanged and its tests pass | `git diff 1a7acdc6 1d1228bf -- src/services/dateReminders.ts` empty; 8.5 `vitest run dateReminders` 215 passed | yes |
| Shipped through `deploy.yml`; both cron jobs listed and their last runs succeeded | deploy runs 45758104216 and 45787955502 success; both jobs listed and active; `daily-reminders` 3/3 succeeded; `daily-reminders-run-history` 0 runs | yes as reconciled: both jobs listed and active; "last runs succeeded" dropped by the owner |
| No unfinished tickets | `pending_tickets` empty | yes |

Why not plain **accepted**:

- Two `Done when` lines cannot be shown until events after this retro: the owner's report and the first run-history run.
- Named deferred findings remain: action items 2 and 3, including the owner-decided DW-532.

Why not **rejected**:

- Every ticket is done, and the epic is shipped and live-checked.
- The two pending lines are closure steps the epic itself places after the stories.
- No blocking finding stands.

## Open questions

- Does the owner accept the verdict, or override it, for example to hold "accepted" until the iPhone report?
- R6 and R7 (action 5) are product choices the evidence cannot settle.
- Should the DW-532 story (action 3) land before epic 9 starts? Epic 9's `after` names this epic's migrations and types, and DW-532's fix is a migration that changes the snapshot.
