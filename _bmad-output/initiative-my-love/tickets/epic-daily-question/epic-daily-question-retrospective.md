---
epic: epic-daily-question
date: 2026-11-06
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective: Daily Question (epic 6)

## Epic summary

**Epic:** `epic-daily-question`, folder `_bmad-output/initiative-my-love/tickets/epic-daily-question/`. It was built by loop run `20261105-224246-5db5` and merged to main in #473 (6.1–6.6, 6.12), #479 (6.7), #480 (6.8), #481 (6.9), #482 (6.10) and #483 (6.11, merged 2026-11-07 03:16 UTC as `d841cf3d`).

**Tickets** (build order from `tickets.py status`): all 12 are `status: done`, `state: done`. `pending_tickets` is empty, and no ticket is still at `built`.

| Ref | Title | Risk | Plan baseline | Range used |
|---|---|---|---|---|
| 6.1 | The server assigns today's question and releases a pick's choice only to a partner who has picked | high | `d64c72ed` | `d64c72ed..d2eca0bd` |
| 6.12 | Both partners pick today's question and see the reveal | high | `d2eca0bd` | `d2eca0bd..75a9b128` |
| 6.2 | Each partner's day runs on their own clock | high | `75a9b128` | `75a9b128..986d1215` |
| 6.3 | Tomorrow's question is written in turns on the server | medium | `986d1215` | `986d1215..1c606036` |
| 6.4 | The coach's pool holds at least 500 questions | low | `1c606036` | `1c606036..bb3de4d4` |
| 6.5 | Daily shows its saved day offline and invites an unlinked account to link | medium | `bb3de4d4` | `bb3de4d4..9106fa37` |
| 6.6 | The partner's pick shows without a reload | high | `9106fa37` | `9106fa37..452ecdb9`, cut (below) |
| 6.7 | A pick made offline is sent when the connection returns | high | `452ecdb9` | `452ecdb9..d6d7c534` |
| 6.8 | The day's writer is asked to write tomorrow's question | medium | `d6d7c534` | `d6d7c534..9f1e3d65` |
| 6.9 | Daily takes Mood's slot in the dock | medium | `9f1e3d65` | `9f1e3d65..9d8f8e57` |
| 6.10 | Refactor sweep | low | `9d8f8e57` | `9d8f8e57..f435e637` |
| 6.11 | After every deploy, a test checks Daily on the real website | medium | `f435e637` | `f435e637..ca7268dc` (inferred: HEAD of `loop/integration`), plus `66e69812` on main |

**Range notes:**
- The 6.6 range holds three `Merge main into loop/integration` merges (`f75c437e`, `ce235377`, `452ecdb9`) and the main commits they brought in, such as the TEA hook (`fcd0fd27`) and the DW-466 test splits. Those are not epic work. The aggregate views use the story's own commit (`aae2d9d8`, `e7cd5acb`) plus `5ee672cb`.
- `986d1215` (DW-463, renumbering the epic's first migration past main's) sits between the 6.2 and 6.3 baselines and is counted with the epic.
- The epic-wide diff is `d64c72ed..HEAD`, limited to the 116 paths the 14 epic commits touched: 112 files, +15,354 / −740. For the code review it was narrowed further to app code and migrations: 36 files, +3,864 / −165 (`epic-app.diff`, scratch, not kept). That excludes tests, `database.types.ts` and the 520-row seed migration.
- `loop/integration` (`ca7268dc`) is 18 commits behind `origin/main`. Story 6.11's last change, `66e69812` "give the Claude Partner bot its own password", exists only on main.

**Evidence inventory:**
- Read in full: the epic file, `.memlog.md` and `tickets.toml` (head and entries 1–5, plus the risk lines for 3 and 11).
- Read for all 12 plans: frontmatter, Implementation Notes, Plan Change Log, Review Triage Log, Design Notes, Verification and Auto Run Result. The `<intent-contract>` blocks were read only where a finding needed them.
- Story files: none. Every ticket's requirements are in its `tickets.toml` entry and plan.
- Run folders: none (no `<type>-*/` folders in the epic folder).
- Companion: `architecture-daily-question.md`, opened only for AD-11 to AD-13.
- Previous retrospective: `epic-settings-rework-retrospective.md`, read.
- `git_evidence.py` was run once per range. It found 2 commits per range, except 56 for 6.6 (because of the main merges) and 3 for 6.2.
- Ledger: DW-441 to DW-452 and DW-461 to DW-489 were read.
- CI: deploy runs `42328852168` and `42333277734`, and PR #483's checks.
- Session logs: not read. Loop session transcripts are not in the tree. The plans' triage logs and Auto Run Results are the only process record used, so the process lessons rest on those alone.

## Findings

Each finding has a source and two dispositions: **instance** (fix now, defer, or accept) and **upstream** (the lesson). Findings the three review lenses reported but that did not hold up against the code are listed at the end of the Diff-scope review.

### Aggregate views

**A1. Duplication and pattern divergence: refusal messages were solved two ways in one file.**
- `submitWrittenQuestion` maps each server refusal code to a fixed sentence (`WRITE_REFUSAL_MESSAGES`, `src/api/dailyQuestionApi.ts:73-77`, story 6.8).
- A refused pick instead shows `handleSupabaseError`'s prefixed text, such as "[DailyQuestionApi.submitDailyPick] Database error: …" (`src/api/errorHandlers.ts:62-84`, through `toAccountDataError` at `dailyQuestionApi.ts:207`).
- Stories 6.2 and 6.7 rejected that text six times (6.2 triage, the blind and edge rows; 6.7 pass 1 and pass 2, four rows), because the fix "needs a per-code message map". Story 6.8 then built exactly such a map for the sibling call. The 6.10 sweep filed the instance as DW-482 and did not point at the existing map.
- Instance: defer, as DW-482 (open). The wording is the owner's to choose (6.10 Residual risks).
- Upstream: a refactor sweep should check each rejection of the form "needs new surface" against surface the epic later built.

**A2. Duplication: one weakness copied into a second local-copy kind.**
- The 6.5 review rejected the case where `mergeDailyDay` treats a failed IndexedDB read as an empty copy and rewrites it (6.5 triage, first row). It was filed only at 6.10, as DW-487.
- In between, 6.8 wrote `addDeclinedWriteDay` (`src/services/dailyWriteDeclined.ts:41-53`). Its read also answers `[]` on failure (`:27-31`) and then writes. Earlier "No thanks" days are lost, so the write prompt comes back for those days.
- Instance: defer, by adding it to DW-487.
- Upstream: a weakness that review rejects as rare goes into the ledger when it is rejected, not at the sweep. The next story's builder reads the ledger, never an earlier plan's triage log.

**A3. Size growth: no god-class.**
- `dailyQuestionSlice.ts` is 542 lines; `notesSlice.ts` is 1,955 for comparison. `DailyQuestion.tsx` is 351 and `dailyQuestionApi.ts` is 250.
- Test files were split to stay under the TEA hook's 1,000-line limit (6.8 Implementation Notes; `dailyQuestionSlice*.test.ts` are 860, 520, 358 and 334 lines).
- `moodSyncService.ts` grew by 138 and shrank by 79 lines, to 1,124. It now carries the partner-event registry.
- Disposition: accept.

**A4. Architecture delta: Daily's live signal rides the mood channel.**
- `daily_pick` is bound on the `mood-updates:<uid>` topic inside `moodSyncService` (6.6; AD-11 [ADOPTED]).
- Epic 10's file already says the registry and the partner-linked signal must survive the mood deletion (`epic-remove-moods-and-interactions.md:17,34`).
- Disposition: accept. Decision record D3 is proposed so the topic name stops surprising readers.

**A5. Spec-to-implementation reconciliation.**
- Every R1–R9 and every Done when line has evidence (see the Acceptance verdict).
- **Divergence S1:** the epic's Notes (Decision 2026-11-05, the live-site check) say "The partner bot signs in with `PUSH_FIXTURE_PASSWORD`". As built on main, it signs in with its own `CLAUDE_BOT_PARTNER_PASSWORD` (`tests/live/daily-question-live.spec.ts:40` and `deploy.yml:421` on `origin/main`; `66e69812`, made at the owner's request per the #483 body). The 6.11 plan's Implementation Notes and Auto Run Result still name `PUSH_FIXTURE_PASSWORD`.
  - Instance: a spec reconciliation (action item 4).
- **Divergence S2:** R2's "updates without a reload" is checked only locally (`daily-question-live-pick.spec.ts`), never on the live site (DW-488, open, medium).
  - Instance: defer (already filed).

### Diff-scope review (`bmad-review`: adversarial, edge-case-hunter and verification-gap lenses, run as three parallel reviewers over `epic-app.diff`)

Each finding below was re-checked against the source before it was kept.

**R1. An open Daily keeps the invitation to link after the partner accepts (6.5 × 6.6).**
- `useDailyPickListener` registers only `daily_pick` and `onStatus` (`src/hooks/useDailyPickListener.ts:41-49`).
- `partner_linked` reaches only `usePartnerLinkListener`, which reloads the partner and pending requests (`usePartnerLinkListener.ts:80-100`).
- The account whose request was just accepted, with Daily open, keeps seeing "Link with your partner" until it leaves Daily and comes back. The only other way out is the new partner's first pick, through `showIfOnScreen`'s empty-screen rule (`dailyQuestionSlice.ts:205`), and no test covers that path from an `unlinked` screen.
- Reported by the adversarial and verification-gap lenses.
- Instance: defer, as a new ledger entry.
- Upstream: when a story adds a subscriber to a shared registry, check every event in the registry against the new screen.

**R2. The write sheet opens after a failed or offline read (6.5 × 6.8).**
- `DailyQuestion.tsx:267-269` sets `readFor` after any `loadDailyDay()`, which never throws. So the sheet's wait, meant to keep a saved day whose turn was written on another device from opening it (comment at `:262-266`), passes offline too.
- Offline, Send is refused before any request, and No thanks still works.
- Reported by the adversarial and edge-case lenses.
- Instance: defer.

**R3. The saved copy can show an old pairing's day for today (6.5 × 6.11, and relinks).**
- `readSavedDailyDay` picks today's entry by date and rank across all `day_id`s (`src/services/dailyDaysCopy.ts:70-82`), and `mergeDailyDay` never drops another `day_id` with the same `day` (`:103-133`).
- After `reset_bot_daily_days` or a relink this device never saw as `unlinked`, an old `both` entry is shown first. Online, the server's answer replaces it, because `mergeAnswer` merges only within one `day_id` (`dailyQuestionSlice.ts:163-176`), so it flashes. Offline, it stays.
- Reported by the adversarial and edge-case lenses.
- Instance: defer.

**R4. A queued pick confirmed during a session change is never announced (6.7 × 6.6).**
- At `dailyQuestionSlice.ts:289-293`, `if (!isCurrent()) return 'stale'` runs before `announceDailyPick`, although the comment says the pick is committed "whatever the session did".
- A same-account re-login during the send skips the broadcast, so the partner sees the pick only on their next open.
- Reported by the adversarial lens.
- Instance: defer.

**R5. "{partner} gets it tomorrow" can be false when partners are on different clocks (6.3 × R9).**
- A written question targets the first date after the source day with no `couple_days` row (6.3 Auto Run Result). A partner whose clock is already past midnight has created that row, so the question lands two days later.
- The sheet always says tomorrow (`WriteQuestionSheet.tsx:123`).
- Reported by the adversarial lens. It is narrowed here to partners in different time zones: a same-zone writer is refused once their own date ends (DQ006).
- Instance: defer.

**R6. Opening Daily reads the day up to four times.**
- Observed in the behavior check: one sign-in, then `/mood` → `/daily`, made 4 `get_daily_day` calls.
- 6.6's Design Notes accept two reads per open. 6.12 rejected a request-token guard twice ("overlapping loads").
- Each call takes the pair's advisory lock and writes `user_time_zones`.
- Reported by the adversarial lens (#10).
- Instance: accept as recorded, and file it in the ledger so the cost is visible.

**R7. Stale comments at story boundaries (fix now).**
- `src/api/dailyQuestionApi.ts:14` says "`DQ002` … stays a transport error". Since 6.7, `PICK_REFUSAL_CODES` (`:63`) treats it as a refusal that marks the row failed.
- `tests/unit/api/partnerEvents.test.ts:4` says the channel carries three events. `PARTNER_EVENTS` has four, because `dates_changed` came in from main (`broadcastSchemas.ts:42-47`).
- Reported by the adversarial and verification-gap lenses.

**R8. The day-changed notice can stay above a day that needs no pick.**
- It is cleared only by the next Send (`DailyQuestion.tsx:238-240`). When the re-read day is already picked, no Send is rendered.
- Reported by the adversarial lens (#8).
- Instance: defer, low.

**Checked and carried (already filed or rejected with a recorded reason; not re-routed):**
- Technical refusal text: DW-482.
- Refused past-day rows that are never shown or removed: DW-483.
- An online send that fails in transit is not queued: DW-484.
- The other tab's lock: DW-485.
- A `daily_pick` lost during a re-join: DW-486.
- A failed copy read during a merge: DW-487.
- The live check's reload: DW-488.
- The shim stack: DW-489.
- The device clock against the server clock around midnight: rejected in 6.2 under AD-2, which trusts the phone's clock.
- Backoff with no cap: rejected in 6.7 pass 2, the same as notes.
- No test of the reset cascade through a written question: rejected twice in 6.11. Postgres checks NO ACTION at the end of the statement, and the reset is one statement.
- **Not kept:**
  - "`tests/live/**` changes never run before a deploy": `deploy.yml:37` has `workflow_dispatch`.
  - "`/mood` reachable through `navigateMood`": `navigateMood` and `setView('mood')` have no caller outside tests (grep).
  - The edge lens's `submitWrittenQuestion` day mismatch, its midnight sheet re-render and its account-switch `readFor` race: real paths, but each needs two events inside the same second, so they were folded into R2 and not routed separately.

### Process

**P1. Review depth followed risk, and a medium story with secrets missed most of its problems on the quick pass.**
- All five high-risk stories (6.1, 6.12, 6.2, 6.6 and 6.7) got four-lens reviews; 6.1 and 6.12 also got follow-up passes. Previous retrospectives' item 9 is now met in practice.
- 6.11 is medium risk and adds a CI job that handles passwords. Its first pass found 2 highs: failure artifacts would have published the bot passwords from a public repo, and the new pgTAP file failed after 12:05 UTC. The thorough follow-up then found 10 mediums, including screenshots and videos that were never captured (6.11 triage, 2026-11-06 and 2026-11-07).
- 6.3 (medium, server rules for writing) got the quick lens and 0 findings.
- Upstream: a story that adds a workflow job or handles a secret gets the thorough review whatever its risk.

**P2. A build reached the shared local stack during a live loop run, twice.**
- 6.11's builder, and then its follow-up pass, ran the live spec through the mise shims. Both created and linked the two bots on the shared stack (6.11 Implementation Notes "Surprise"; Auto Run Result "Incident during verification"). The rows were deleted.
- The cause is DW-489 (open, medium). The spec's localhost guard cannot tell one local stack from another.
- Upstream: fix DW-489 before the next story that runs a local spec on an isolated stack. The isolated-stack rule exists, but no tool enforces it.

**P3. Plan facts the triage refuses to correct stay wrong.**
- 6.1 says "82 tests" where the file plans 100. 6.10 says "seven calls" where the diff has 8. 6.11 says "19 assertions" where there are 24, and its task list contradicts its triage.
- Each was rejected because "the fix edits this build's plan".
- Upstream: allow one append-only "Corrections" line, so a reader of the plan is not misled.

**P4. A migration version collision was caught mid-epic.**
- DW-463 (high) was found by 6.2's plan: the epic's `20261105010000` collided with main's `20261105010000_push_added_dates.sql`. It was fixed at `986d1215` before either reached main.
- Recorded as a win: the plan's `deferred` field carried it to the ledger.

## Behavior verification

**Exercised on the live site, 2026-11-07 UTC.** The production Claude bot account (`claude-bot@test.example.com`) was signed in through a headed Chromium script at 390×844 on https://my-love.sallvain.workers.dev/:
- The dock reads Home, Daily, Love Notes, Photos, Partner.
- Loading `/mood` lands on `/daily`.
- Daily shows "Open shelves or Closed cabinets?" with both options, "Claude Partner hasn't picked yet" and Send my pick.
- All 4 `get_daily_day` answers were `status: ok, state: none`, with `partner_choice` and `same` null and exactly the AD-16 keys (`day, same, state, write, day_id, question, my_choice, my_picked_at, partner_choice`).
- No pick was made, to leave the bot pair's day to the post-deploy check.

**The post-deploy check on production.** Deploy run `42333277734` (`d841cf3d`) passed every job: migrations, Edge Functions, build, deploy, health check and Live Daily Check. The `live-daily-check` job passed "[P0] the bot pair sees one question, a hidden pick, and the reveal on the second pick" (1 passed, 7.4 s, 03:21:37 UTC).

**Not exercised here:**
- The no-reload update on the live site (DW-488).
- Offline pick and reconnect, write tomorrow's question, and the invitation to link. These are covered only by the local Playwright specs the plans report as passing (6.5, 6.7, 6.8 Verification). They were not re-run in this retrospective.

## Previous-retro follow-through

The previous retrospective is `epic-settings-rework-retrospective.md` (2026-11-04). Its 17 action items:

| # | Item (owner) | Landed | Evidence |
|---|---|---|---|
| 1 | Ledger rows DW-441 to DW-452 (PO) | yes | all 12 present, each `status: done 2026-11-04` |
| 2 | Partner's iPhone reinstall (owner schedules, agent installs) | yes | marked done 2026-11-04 in that file; `4c070e77` |
| 3 | Live-update prompt story to `hitl: false` and the simulator (PO) | yes | `a9bf92d7`; DW-442 done |
| 4 | Verify lines name their runner; no "a person runs" (PO) | yes in practice | every verify line in this epic's `tickets.toml` names its runner (pgTAP, `supabase test db`, Playwright on a local stack), and no entry has `hitl`. No PO rule or customization file was found, so the rule is not enforced. |
| 5 | Keep the R16/R18 measurement as an E2E spec (dev loop) | yes | `7df13a1f`; `tests/e2e/settings/settings-touch-floor.spec.ts` |
| 6 | A ticket is done only with evidence in its plan (PO) | yes in practice | all 12 plans hold Verification with results; no rule text found |
| 7 | Hold-and-screenshot swipe (dev loop) | yes | `9e229c3e`; `scripts/sim-driver/sim:108,1251` |
| 8 | Gesture spikes verify mid-gesture (PO) | no evidence found | this epic has no gesture work, and no rule text was found |
| 9 | One reinstall step per phone in a native ship story (PO) | no evidence found | this epic has no native change |
| 10 | Column-form sweep of every view (dev loop) | yes | `0f4be032`; DW-448 done |
| 11 | `sim doctor` preflight (dev loop) | in part | `b2c1c3a5` adds the Supabase CLI pin check (`test-supabase-pin.zsh`). No `sim doctor` command exists (`grep doctor scripts/sim-driver/sim` finds only `ax doctor`). |
| 12 | Walk-back hang fix (dev loop) | yes | `cf42146b`; DW-441 done |
| 13 | Remove `sudo /bin/date` and `sim reboot` (dev loop) | yes | `b2c1c3a5`; no match in `scripts/sim-driver/README.md` |
| 14 | Bare `errorSpy` assertion (dev loop) | yes | `44f5d1b3`; `moodSlice.historyBackfill.test.ts` now uses `toHaveBeenCalledWith` |
| 15 | `sim pending` after Remind me (simulator) | yes | `0f4be032`; DW-446 done |
| 16 | Reconcile R2 and the reload decision in the epic 5 file (PO) | no evidence found | `abc528d7` (the close) adds 2 lines that mention neither; no later commit to that file does |
| 17 | Carry forward the earlier items 9, 10, 11 and 13 (owner, PO) | in part | **9** (thorough review for high risk): met, see P1. **10** (merge PR-branch fixes back into `loop/integration`): `f75c437e`, `ce235377` and `452ecdb9` merged main in mid-run, but `66e69812` is again on main only. **11** (a defect from a check story gets its own story): no evidence found. **13** (commit shape): met, because 6.7's AGENTS.md edit went in its own docs commit (6.7 plan; the 6.10 sweep did the same). |

## Action items

Every item is proposed; nothing was applied. Under AGENTS.md a deferred finding belongs in `deferred-work.md`, so item 1 files the defer rows.

| # | Action | Owner | Kind | Source |
|---|---|---|---|---|
| 1 | Ledger, in one change: file R1 (invitation not updated on `partner_linked`), R2 (write sheet after a failed read), R3 (old pairing's day for today in the copy), R4 (announce skipped on a stale session), R5 ("tomorrow" wording across time zones), R6 (four reads per open) and R8 (sticky day-changed notice). Add A2's `addDeclinedWriteDay` case to DW-487. | PO (`bmad-agent-po`) | ledger | R1–R6, R8, A2 |
| 2 | Fix the two stale comments: `src/api/dailyQuestionApi.ts:14` (DQ002 is a refusal) and `tests/unit/api/partnerEvents.test.ts:4` (four events). | dev loop | remediation, comments only | R7 |
| 3 | DW-482: decide the wording for refused picks (DQ001, DQ002, P0002, 22023), then map them by code as `WRITE_REFUSAL_MESSAGES` does. | owner (wording), then dev loop | remediation | A1, DW-482 |
| 4 | Reconcile the epic's Notes (the 2026-11-05 live-check decision) and the 6.11 plan's record with the as-built partner bot password, `CLAUDE_BOT_PARTNER_PASSWORD` (`66e69812`). | PO | spec reconciliation | A5 S1 |
| 5 | Fix DW-489 (the mise shims send a local run to the shared stack) before the next story that runs a local spec on an isolated stack. | dev loop | remediation | P2, DW-489 |
| 6 | Loop policy: a story that adds a workflow job or handles a secret gets the thorough review whatever its `risk`. | owner (loop policy) | process | P1 |
| 7 | A finding that review rejects as rare but real is filed in the ledger at triage, not at the refactor sweep. | owner (loop policy / `bmad-build-auto` customization) | process | A2 |
| 8 | The refactor sweep checks each "needs new surface" rejection against surface the epic later built. | PO (sweep ticket template) | process | A1 |
| 9 | Allow an append-only Corrections line in a built plan for facts the triage would otherwise leave wrong. | owner (loop policy) | process | P3 |
| 10 | When a story adds a subscriber to the partner-event registry, the ticket checks the new screen against every event in it (for epic 7's Partner page and epic 8's nudge). | PO | process | R1 |
| 11 | Carry forward: epic 5 item 11 (`sim doctor`), item 16 (epic 5's R2 and reload wording), and the earlier item 11 (a check story's defect gets its own story). | dev loop, PO | process | follow-through |

## Decision records

Each decision below passes the test (hard to reverse, surprising without context, a real trade-off), and no `adr-*.md` or decisions folder exists in the repository (`git ls-files` finds none). This run is headless, so each is **proposed, not written**. AGENTS.md's Policy also forbids generating repository documentation and says durable agent-facing prose goes in AGENTS.md, so where a record would live is an open question (below).

| # | Decision | Plan | Commit | Approved / written |
|---|---|---|---|---|
| D1 | A couple's days are deleted all at once in one statement: `couple_days.question_id` is NO ACTION and `daily_questions.source_day_id` cascades. Deleting a single source day raises 23503. | 6.1 Design Notes | `e636f4d6` | proposed, not written |
| D2 | Daily's refusals use a custom SQLSTATE class `DQ` (DQ001 to DQ006), which the client maps by code. A repeat of a stored pick or question returns the stored row before any check runs, so queued retries never get a refusal. | 6.2 and 6.3 Design Notes | `ab3fc261`, `ebdf8dd8` | proposed, not written |
| D3 | Daily's live signal (`daily_pick { day_id }`) rides the existing `mood-updates:<uid>` topic through one partner-event registry in `moodSyncService`, and carries nothing but a request to re-read. | 6.6 Design Notes; AD-11 | `e7cd5acb` | proposed, not written |
| D4 | The post-deploy live check resets the bot pair through a client RPC that only the two linked bot accounts can call, and never holds the Supabase secret key. | 6.11 Design Notes; epic Notes 2026-11-05 | `e6cfa732` | proposed, not written |

## Acceptance verdict

**accepted-with-open-items** (criteria declared, machine verdict, no human decision).

Evidence for each Done when line:
1. **Live Playwright on the production bot pair: met.** Deploy run `42333277734`'s Live Daily Check passed. Both see one question, pick and see the reveal. Before B's pick, B's `get_daily_day` and `get_daily_day_by_id` answers and B's own page carry no choice. Only the two bot accounts sign in (`tests/live/daily-question-live.spec.ts:37-40`).
2. **Offline at 11:50 PM, sent at 12:10 AM, counted for the earlier date; partners an hour apart: met.** `41_daily_question_own_clocks.sql:157` (late pick) and `:201-223` (CLOCK-014 to 016); `dailyQuestionSlice.pickQueue.retry.test.ts:112`.
3. **Pool of at least 500, a written question asked of both, an unused turn draws from the pool, alternating partners: met.** 520 rows; `43_daily_question_pool.sql:72`; `42_daily_question_written_questions.sql:227-238` (WRITE-007) and the 6.3 Auto Run Result.
4. **Dock, `/mood` opens Daily, unlinked invitation: met.**
   - `dock.spec.ts:25` (`DOCK_LABELS`).
   - `AppNavigation.test.tsx` (column form, `nav-daily`).
   - `routing.spec.ts:34-49`.
   - `daily-question-offline-and-invite.spec.ts:55`.
   - The live-site observation above.
5. **Shipped through `deploy.yml`: met.** Every story is on main and deployed, the last at `d841cf3d` (run `42333277734`, success).

The Outcome signal, "a day's two picks revealed on the live site", was met by the same run.

Open items: DW-482 to DW-489, and the new findings R1–R6 and R8 once action item 1 files them. None blocks a requirement as written: R1 delays the screen until a remount, and R2's no-reload update works and is only unchecked on the live site (DW-488).

## Open questions

- **Where would decision records live?** AGENTS.md forbids generating repository documentation and keeps durable prose in AGENTS.md. Should D1 to D4 become ADR files (for example beside the migrations), lines in AGENTS.md, or nothing?
- **R1:** should Daily re-read on `partner_linked`, or is a remount acceptable until epic 7 rebuilds the Partner page?
- **R5:** for partners in different time zones, should the sheet name the target date, or should a written question always target the source day + 1, even when a partner ahead has already been given a pool question for that day?
- **`loop/integration` is 18 commits behind `origin/main`**, including `66e69812`. AGENTS.md has the local `loop/integration` deleted before each run, so this matters only if the loop is resumed rather than restarted.

## Assumptions

- **Epic reference:** `-H epic-daily-question` matched `epics` slug `epic-daily-question` (id 6) in `tickets.py status`. The folder is `_bmad-output/initiative-my-love/tickets/epic-daily-question/`.
- **`pending_tickets`:** empty. All 12 rows are `done`/`done`, and none is at `built`.
- **Machine verdict:** `accepted-with-open-items`, rendered with no human decision.
- **Range cuts:**
  - The 6.6 range was cut to the story's own commits, leaving out the main merges.
  - The 6.11 range end was inferred as `loop/integration` HEAD `ca7268dc`, with `66e69812` on main counted as 6.11's.
  - The review diff was narrowed to app code and migrations, leaving out tests, generated types and the seed.
- **Phase 3 (team discussion):** not run (headless).
- **Session logs:** not read. Process lessons rest on the plans' triage logs and Auto Run Results.
- **Reviewer findings:** treated as unverified until re-read in the source. Three were dropped (see the Diff-scope review).
- **Action items 1 to 11 and decision records D1 to D4:** each proposed only. Nothing was written to the ledger, the epic file, a plan or a ticket.
- **Behavior check:** made with the production Claude bot account, a test account (AGENTS.md; the memory reference). No pick was made.
