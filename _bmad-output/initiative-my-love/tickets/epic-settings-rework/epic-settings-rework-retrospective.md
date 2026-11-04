---
epic: epic-settings-rework
date: 2026-11-04
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospective: Settings Rework (epic 5)

## Epic summary

Epic 5, `epic-settings-rework`, folder `_bmad-output/initiative-my-love/tickets/epic-settings-rework/`. Its 19 tickets in build order all have state `done`. None is still at `built`, and `pending_tickets` is empty. Two loop runs built it: `20261102-215408-6a69` (5.1–5.15, merged to main as PR #448 at `a4a33ceb`) and `20261103-155132-cdc9` (5.16, 5.19 as PR #449; 5.18 as PR #454). Story 5.17 was checked by hand and its fixes landed in PRs #450–#453. The owner closed the epic at `abc528d7`, and the R16 and R18 measurements were recorded after that at `49006f72`.

The owner named six focus areas for this retro: hand checks sent to a person, work marked done without evidence, the 5.15 edge swipe, the partner's reinstall, escapes outside Settings, and tooling.

| Ref | Title | State | Plan baseline | Range (git_evidence) |
|---|---|---|---|---|
| 5.1 | Settings opens as a stack of pages | done | `50374071` | `50374071..1e4220c8`, 3 commits |
| 5.2 | Spike: edge swipe | done | `1e4220c8` | `1e4220c8..e5356642`, 2 commits (docs only) |
| 5.3 | Settings state splits into slices | done | `e5356642` | `e5356642..651d8280`, 4 |
| 5.4 | A date change sends no push | done | `651d8280` | `651d8280..8aa6b693`, 2 |
| 5.5 | Log out replaces Sign out | done | `8aa6b693` | `8aa6b693..41a877b0`, 2 |
| 5.6 | Notifications page | done | `41a877b0` | `41a877b0..666275e2`, 2 |
| 5.7 | Profile one-field pages | done | `666275e2` | `666275e2..e9aab482`, 2 |
| 5.8 | Partner page | done | `e9aab482` | `e9aab482..768153a2`, 2 |
| 5.9 | Dates list | done | `768153a2` | `768153a2..f7f112e7`, 2 |
| 5.10 | Together since, Wedding, birthdays | done | `f7f112e7` | `f7f112e7..2779fbc8`, 2 |
| 5.11 | Event pages | done | `2779fbc8` | `2779fbc8..beab1781`, 2 |
| 5.12 | Anniversary pages | done | `beab1781` | `beab1781..a766d1b0`, 2 |
| 5.13 | New event and anniversary forms | done | `a766d1b0` | `a766d1b0..14bffd7c`, 2 |
| 5.14 | Home's date cards open date pages | done | `14bffd7c` | `14bffd7c..9f15bce4`, 2 |
| 5.15 | Edge swipe in the shell | done | `9f15bce4` | `9f15bce4..a4a33ceb`, 34 (crosses into PR #448's rewritten history; see note) |
| 5.16 | Refactor sweep | done | `a4a33ceb` | `a4a33ceb..94023a0b`, 2 |
| 5.19 | Navigation rules E2E spec | done | `94023a0b` | `94023a0b..173a94dc`, 4 |
| 5.17 | Ships to both phones | done | **none** (14-line plan) | no range: no commits attributed |
| 5.18 | Drop `push_preferences.dates` | done | `173a94dc` | `173a94dc..49006f72`, 40 (inferred to HEAD; includes the 5.17 fix PRs and the close) |

How the ranges were cut:

- The plan baselines from 5.2 to 5.15 are loop-integration merge commits. They are not ancestors of `main` (`git merge-base --is-ancestor <baseline> HEAD` fails), because PR #448 brought the work in as linear per-story commits (`4025ad66`…`c162a94b`). The per-plan ranges were measured on the loop objects, which still exist. The epic-wide aggregate uses the `main` range `50374071..49006f72`: 75 commits, 16 merges, of which 12 were measured, so 4 merges went unmeasured.
- The 5.15 range ends at `a4a33ceb`, so it also takes in all of PR #448. Its own commits are `875523dd` (story), `06838676` (operator confirm), `e1ba2117`, `350f5832`, `456e3a04`, `f4dcc8d5`, `ed8fd142` and `8d5ab789`.
- The 5.18 range is inferred to HEAD. It holds the 5.17 hand-check fix PRs (#450–#453), 5.18's own `934663da`, and the ledger and close commits.
- Two loop ranges carry tooling noise: an install and revert of bmad-issue-tracking hooks (5.1, 5.3).

Evidence inventory:

- **Read:** the epic file; tickets.toml; all 19 plans; the one story file (5.18); git_evidence for every range plus the epic-wide range.
- **Previous retro:** `epic-date-reminders-retrospective.md`.
- **Session records:** `.bmad-loop/runs/20261102-215408-6a69/` and `.bmad-loop/runs/20261103-155132-cdc9/` exist.
- **Run folders:** none in the epic folder.
- **Companions:** EXPERIENCE.md and DESIGN.md, opened only for cited sections.
- **Missing:** story 5.17 has no plan sections at all (no baseline, Verification or review), so its evidence is the 6-line "How each was checked" note and the epic's 2026-11-04 Notes. There is no record of the column-form pass on views outside Settings.

## Findings

Each finding is marked with how far it was checked:

- **CONFIRMED** means the retro reopened the primary source.
- **PLAUSIBLE** means the code path was read but the triggering state was not reproduced.
- **UNVERIFIED** is a sub-agent's report that was not re-checked.

Every finding has a disposition: fix now, defer, or accept.

### Process: the owner's six focus areas

**P1. Hand checks were routed to a person when Playwright or the simulator could run them.** CONFIRMED.
- **Where the routing came from:**
  - The epic's Done when said "A person runs the Key Flows" (`epic-settings-rework.md:79`).
  - Story 17 was `hitl = true`, with the verify line "The owner runs the four Key Flows on the two phones" (`tickets.toml:202-206`).
  - Spike 2 was `hitl = true` (`tickets.toml:30`).
  - Story 15's five `operator_actions` were all Duo steps (plan frontmatter).
- **5.18's stop:** the loop paused on 5.18 at 2026-11-04 02:27:39 with "Do both phones run the update that stops using push_preferences.dates?" (`.bmad-loop/runs/20261103-155132-cdc9/ATTENTION`). The hosted API logs already answered it: the owner's app stopped selecting `dates` at 2026-11-03 20:25 UTC, and the partner's app made 5.8's read at 22:01 UTC (5.18 plan:104).
- **Runnable without a phone:**
  - Flows 2 and 3, and all three DW-425 cases, later ran on the simulator.
  - Flow 4 has a Playwright spec, `new-date-forms.spec.ts:55`.
  - Only Flow 1's real-finger swipe needed the phone.
- **The rule now:** AGENTS.md:107 (`5cd9a14a`, `752801bf`) orders the checks Playwright, then the simulator, then a phone, and forbids `hitl` for checks a machine can run.
- **Compliance since the rule:** only two tree files changed after `752801bf`, the epic close and the story 17 plan. Neither adds new routing.
- **The one open ticket that still breaks the rule:** `_bmad-output/backlog/story-native-shell-live-update-prompt.md` has `hitl: true` and says "A person checks the flow on the owner's iPhone after a deploy" (`:17`, `:100`), though `sim serve-update` and `sim build --update-port` exist.
- **Disposition:** fix now (rework that ticket). Upstream lesson: in the PO's ticket writing, every verify line names who runs it and, for a phone, why neither Playwright nor the simulator can.

**P2. Tickets were marked done before their evidence existed.** CONFIRMED.
- **Story 17's plan:**
  - It was committed at `41e853dd` (story marked done) as 5 lines of frontmatter ending `status: done`. The "How each was checked" list first appeared in `abc528d7`, the commit that closed the epic.
  - That list records Flow 1 as "Passed". The session record shows it first failed on the Duo: "Swiping left from the dates page does not swipe back to home". That failure led to `69dfb58c`, and Flow 1 passed after it. The plan now records the failure and the fix.
  - The PO session that marked 5.17 done said 5.16 and 5.19 "exist only on loop/integration". Git contradicts this: `ed9021c5` and `8a3d4f69` reached main through #449 on 2026-11-03.
- **R16 and R18:** tickets.toml's header says "R16, R17 and R18 … are delivered by each story", but no story's verify line measured 44pt targets, 16px fields or DESIGN.md tokens.
  - Story 1's review rejected the R16 check as "a VoiceOver pass needs a person on a device" (5.1 plan:193). R16 then still carried a VoiceOver clause, which `docs: drop screen-reader and keyboard requirements` (in the 5.2 range) later removed.
  - The close as first written said R16 and R18 were "spot-checked per story, not measured" (`abc528d7`). The measurement that replaced it (`49006f72`, epic:127) covered 25 pages in Playwright and was kept as no test.
- **Disposition:** fix now (keep the measurement as an E2E spec). Upstream lessons:
  - A cross-cutting requirement gets a story whose verify line measures it.
  - A done mark needs the plan's evidence committed first.

**P3. The 5.15 edge swipe needed three fixes after it was confirmed.** CONFIRMED.
- **What the spike tested and missed:** it tested whether back goes one level (`sim swipe back` compares page text after the pan, `RunnerUITests/Drive.swift:75`). It never tested what slides in during the gesture.
- **`e1ba2117`, the rewrite:**
  - It landed 16 seconds after `06838676` ("confirm 5.15").
  - It replaced WebKit's gesture with the shell's own swipe, because WebKit's 50 MB picture store showed dark or white pages three levels deep.
  - The owner found that on the Duo.
  - It rewrote the code that DW-424's live-update check had confirmed (epic:122).
- **`69dfb58c`:**
  - It was a DW-424 live-update case: a live update swapped in on Home turned the swipe off on every page above Home.
  - The owner found it in Flow 1 on the Duo, and an agent then reproduced it on the simulator.
- **DW-424 re-check after the rewrite, 2026-11-04.** The iPhone Duo simulator ran folded with the column dock, a shell built from main `49006f72`, and `sim serve-update`. Both cases passed:
  - **Update applied on Profile:** 8 swipes on the new Home did nothing; Profile → Settings → Home went back one level per swipe; a swipe on Home did nothing.
  - **Update applied on Home (the `69dfb58c` case):** 8 swipes on the new Home did nothing; Profile → Settings → Home went back one level per swipe; a swipe on Home did nothing.
- **`a9906618`:**
  - The Add a date chooser showed in the swipe picture.
  - The owner found it, and a first fix, `f308cf88`, did not solve it.
  - An agent caught it on the simulator only with an ad hoc halfway-hold probe (chooser in the picture 3 times in 4 before the fix, 0 in 4 after). That probe never entered the driver: `sim swipe` still accepts only `back` (`scripts/sim-driver/sim:1196-1198`).
- **Could the simulator have caught the picture bugs?** Yes, given a driver step that holds a swipe halfway and screenshots it. `e1ba2117`'s dark page three levels deep is the same kind of check. The one-in-four pan rate limits repetition, not detection.
- **Disposition:** fix now (add the hold-and-screenshot step to `sim`). Upstream lessons:
  - A gesture spike's verify covers what the user sees during the gesture, not only where it lands.
  - A rewrite after a confirmation re-runs every confirmed check.

**P4. The partner's iPhone never got the reinstall.** CONFIRMED.
- **What was planned:** the reinstall on both phones was planned in three places (epic:79, epic:120, tickets.toml:169 and :202).
- **Where it fell out:** story 15's `operator_actions` name only the owner's Duo, and only the Duo was rebuilt, from main `3895b3c0`.
- **Where it stands:** the close accepted it as open (epic:126). No ticket, ledger entry or step schedules it.
- **Disposition:** fix now (schedule the partner's reinstall). Upstream lesson: a native change in an epic gets one named reinstall step per phone, in the ship story, with the build number procedure.

**P5. The owner found escapes outside Settings during the 5.17 checks.** CONFIRMED for introduced-by.

| Fix | Introduced by | Column-form test |
|---|---|---|
| `f308cf88`, `a9906618`: chooser in the swipe picture | This epic: 5.13 chooser, shown by the `e1ba2117` picture swipe | unit test added |
| `0892d02f`, `e44be712`: date field past its card; bar not under the column | This epic: 5.1 bar and stack. The overflow was already named in the epic's Description | none |
| `a049ab55`, `bded3a94`, `b1676dd8`, `dafed9f9`: Love Notes not opening at the bottom | Before this epic (`db5bfb2b`, 2026-03-19) | unit only |
| `b243a7ce`: photo viewer buttons under the column | Before this epic (`0ffa2caf`, 2026-08-18) | none |

- **What the column form had for coverage:** only the `SettingsStack`, `AppNavigation`, `kitDialogs`, `kitSurfaces`, `UpdateToast` and `useSideColumn` tests read the side insets.
- **DW-419's simulator check** covered the Settings stack alone, and its own text says "The same holds for every column-form feature".
- **Answer to the owner's question:** yes. Every view needs one column-form pass on the simulator, both sides. After that, an epic runs the pass for the views it changes.
- **Disposition:** fix now (a one-time simulator sweep of every view in both column forms).

**P6. Tooling broke mid-epic.** CONFIRMED.
- **Wrong Supabase CLI:** non-interactive shells got Homebrew's Supabase CLI 3.0.0, which rejects the repo's config. Stories 1 and 4 worked around it with a 2.122.0 shim (5.1 plan:239, 5.4 plan:141). It was fixed in `~/.zshenv` (dotfiles `23bfa24`).
- **mise:** that fix then made mise refuse the staged copy ("Config files … are not trusted"). It was fixed with `trusted_config_paths` (dotfiles `b1a6865`).
- **Device Hub:** its gaps are recorded in the README (`64cac1fa`, PR #455).
- **Prerequisite checks:** `sim` checks nothing up front. `sim:24-25` lists the needs, and checks happen per command inside it (`resolve_device`, `require_booted`, `require_window`, `require_stack`).
- **Disposition:** defer (the environment is fixed now). Lesson: add a `sim doctor` preflight that runs before `build`. It checks the Supabase CLI on PATH against the pinned version, mise trust of the staged path, Xcode and Device Hub, and the local stack.

### Process: other findings

- **O1. High-risk stories got quick review.** CONFIRMED.
  - Spike 5.2 and story 5.15 are `risk: 'high'` with a pinned `review: 'quick'`.
  - Story 5.15's plan says high, while tickets.toml:172 says medium.
  - Policy has `thorough_review = "high-risk"` (`.bmad-loop/policy.toml:82`), which reads the ticket's risk, not the plan's.
  - This is the previous retro's item 9, not landed. Defer (loop policy).
- **O2. Code outside any plan.** CONFIRMED. These landed with no plan, no review triage and no change-log entry:
  - `350f5832` (Home as the bottom layer, a navigation rewrite).
  - The 142-line Swift rewrite `e1ba2117`, and `69dfb58c` and `a9906618`.
  - `a7deb9c8` (19 files, closing DW-430, DW-434 and DW-435).
  - PRs #450–#453.

  PR review ran on those PRs, but no story plan holds them. Lesson: a fix found in a hand check gets its own ticket and plan, which is the previous retro's item 11, not landed. Defer (process).
- **O3. Duplicate ledger filings.** CONFIRMED from the ledger. The engine's `spec-deferred` re-filing filed five pairs twice: 421/419, 422/420, 431/430, 436/435 and 439/438. Accept (they are closed as duplicates). Report it to bmad-loop upstream if it recurs.
- **O4. The sweep ran over its token budget.** CONFIRMED. Story 5.16 used 2,446,012 weighted tokens, past the 2M cap (`ATTENTION`, 2026-11-03 16:16:05). Accept.

### Spec-to-implementation reconciliation

- **S1. R2's "back on Home does nothing" is not what the web does, by design.** CONFIRMED.
  - `settings-navigation-rules.spec.ts:64-67` asserts that one more back from Home leaves the app (`about:blank`), as `350f5832` intends.
  - In the shell the swipe on Home does nothing (5.15 plan).
  - Accept, and reconcile R2's wording to "does nothing in the shell; on the web, browser back leaves the site".
- **S2. Home's Add, then a reload of New event, goes back to Home, not Dates.** CONFIRMED (`SettingsStack.tsx:167-175`).
  - The entry is app-created, so `history.back()` runs, which lands on the entry below: Home.
  - The epic's reload decision (epic:105) says a form "reloads to the page above it".
  - Accept (Home was the opener) and reconcile the decision's wording. The brief Dates render before `history.back()` lands is low.
- **S3. Remind me never scheduled a reminder under test.** CONFIRMED.
  - Stories 10 to 12's verify lines ask for scheduling on the simulator, and each plan lists it as a residual risk not run.
  - Flow 2 on the simulator checked the footnote and the setting surviving a relaunch, not `sim pending`.
  - Fix now: one `sim pending` check after Remind me on a date page.
- **S4. Done when bullet 1 was met only in part.** CONFIRMED. The column form was checked for Settings only, and R10's "both dock forms" for Home's cards is unit-only. This folds into P5's sweep.
- **S5. Done when bullet 6 was not met.** CONFIRMED. The partner's iPhone had no reinstall and Flow 2 never ran on it. The owner accepted this as open at epic:126. See P4.
- **S6. Story 3's verify line was inaccurate.** CONFIRMED (5.3 plan). It said "only import paths changed", but the story added `ownProfileLoadFailed` and moved the name read into the store. Accept.
- **S7. The rest checked clean.** R13 has no "Sign out" UI string. R14 has no `date_changes`, `date_change_id` or `push_preferences.dates` in the migrations, pgTAP or `database.types.ts`. R15's `signedOutState` covers every moved field. R17 shows no `Loading...` in Settings pages. Every Constraint checked clean (20 `offlineMessage` calls, no hand-typed refusal, no hard-coded dock offsets, plugin checks in order, `parseEventDate` for `YYYY-MM-DD`). AGENTS.md states 14 slices, which matches `useAppStore.ts:136-151`.

### Aggregate views

- **Architecture delta.** Narrowed: no dependency tool was run.
  - From the changed files, Settings became a page registry (`SUBPAGES`, `Settings.tsx:163-304`) over `stack/`, and `datesSlice`, `profileSlice` and `notificationsSlice` came out of `settingsSlice` (1138 → 236 lines).
  - One cross-slice write remains: `datesSlice` writes the anniversaries mirror into `settingsSlice`'s persisted `settings` (DW-426, open). No cycle was seen.
- **Duplication map.** CONFIRMED by spot checks.
  - Three confirmation-dialog implementations: `ConfirmDialog.tsx`, `SignOutEverywhereConfirmation` (`Settings.tsx:100-160`), and `KindChooser`, which copies the focus trap.
  - Six inline Error box copies, one of them a hand-typed copy of `FAILURE_BOX` (`Settings.tsx:432-440`).
  - `FIELD_CLASS` identical in 5 files.
  - The delete flow repeated in `EventPages.tsx:218-250` and `AnniversaryPages.tsx:127-158`.
  - `NOT_SET` defined twice.
  - The display-name rule in `settingsFields.ts:125` and `DisplayNameSetup.tsx:56`. Both the review and the reconciliation found this.
  - A private `isOnline()` in `datesSlice`, `profileSlice` and `notificationsSlice`. This copies `partnerSlice:96`'s older pattern, while `api/errorHandlers.ts:46` exports one.
  - **User-visible:** the Profile row shows the long birthday (`ProfilePage.tsx:125`), and the Your birthday page shows "4 Apr" (`DatePages.tsx:279`).
  - Defer, as one cleanup story.
- **Test kit duplication.** CONFIRMED.
  - `setOnline` is reimplemented in `NotificationsPage.test.tsx:83` and `Settings.profile.test.tsx:106`, although `tests/unit/stores/accountDataFixtures.ts:33` exports it. That breaks AGENTS.md's shared-helper rule.
  - `renderAt` is identical in 4 files, and `setConnection` and `makeEvent` are each copied twice.
  - Fix now (`setOnline`); defer the rest into the same cleanup story.
- **Size growth.** CONFIRMED.
  - `datesSlice.ts` (686 lines, new) holds three sub-domains, each with its own copy kind and freshness guard.
  - `Settings.tsx` (596, down from 933) holds the registry, the path resolver, the top page and the log-out flow.
  - Neither is a god-class yet. Accept, and watch `datesSlice` when the next date kind lands.
- **Pattern divergence.** CONFIRMED.
  - Each slice keeps its own `isOnline` (see above).
  - The Error box is inlined rather than one component.
  - Form constants and `IconPicker` live in `EventPages.tsx` and are imported by `NewDatePages.tsx`.
  - Defer, with the duplication story.

### Diff-scope review (bmad-review: adversarial, edge-case, verification-gap)

The review ran over `50374071..49006f72` and found 27 findings. The ones the retro checked:

- **V1. The walk back to Home has no way out if its `popstate` never arrives.** PLAUSIBLE.
  - `navigationSlice.ts:160-177` sets `walkingDown`, adds a one-shot `popstate` listener and calls `history.go(-depth)`. Nothing clears `walkingDown` if that event never comes, so every later dock tap would only set `pendingView`.
  - The code path is confirmed. The trigger (a stored `depth` larger than the real history, or a walk across a reload) was not reproduced.
  - Three review findings (1, 17 and 25) report this.
  - Fix now: a fallback that clears the walk, plus a test.
- **V2. No test covers a second dock tap while a walk is under way.** CONFIRMED (review finding 27). Every `setView` test taps once and waits. Fix now, with V1, in `tests/unit/stores/navigationSlice.settingsStack.test.ts`.
- **V3. The simulator driver's manual tells the reader to run `sudo /bin/date`.** CONFIRMED (`scripts/sim-driver/README.md:5`: "run it after each `sudo /bin/date`"). That contradicts AGENTS.md's rule against moving the Mac's clock. Fix now.
- **V4. A failed link-date read fails the whole partner lookup.** CONFIRMED. `partnerService.ts:165-167` returns `{ status: 'error' }` when the `partner_requests` read fails, so a missing Linked since blanks the partner everywhere `getPartner` is read. Defer: either continue with `linkedSince: null`, or record why the strict form is wanted.
- **V5. Reloading the page of an event past the first page sends you to Dates.** PLAUSIBLE. `EventPages.tsx:194-206` loads only the first page on reload, then falls back to Dates when the event is absent. Defer.
- **V6. No E2E axe coverage of the new pages.** CONFIRMED, already in the ledger as DW-432 (open). Defer, no new entry.

The other 21 review findings are UNVERIFIED and are not routed:
- Home flashes during a dock walk (2).
- iOS shell: an unbounded picture memory (6), a 0.47 s tap block after a swipe (7), and left-edge scroll delay (8).
- An older bundled build after the column drop (9).
- The display-name rule duplicated (11, also in the duplication map).
- `dev:local`'s Realtime key (12).
- The Supabase CLI version pinned twice (13).
- History entries with no `depth` (15).
- A silent return on a session change mid-save (16).
- A row tap during a walk (19), and a reload flash (20, 26).
- A field page for a deleted date (21).
- `eventsStale` ignored (22).
- `loadAnniversariesFromServer` with a null `settings` (23).
- A pre-update date push tap (24).

Anyone who wants them later should re-run `bmad-review` on the same range.

## Behavior verification

**What ran:** Playwright on the local stack (Supabase CLI 2.122.0, `chromium` project) on 2026-11-04. The specs were all of `tests/e2e/settings/` (17 specs), `tests/e2e/navigation/settings-navigation-rules.spec.ts`, `tests/e2e/navigation/dock.spec.ts`, `tests/e2e/home/home-date-entry-points.spec.ts` and `tests/e2e/auth/`.

**Result:** 128 passed in 1.8 minutes, with no failure, flake or retry. The row audit reported no leftover rows. The log is at `/private/tmp/claude-501/-Users-sallvain-Projects-My-Love/8099f4e1-7494-4f5a-9888-e97fbeaa9654/scratchpad/e2e.log`.

**What this exercised:**
- The page stack, reload, and back one level, in the bottom dock only.
- Home as the bottom layer.
- The from-Home date entry points.
- Every date page's edit and delete, the Dates list and Load more, and the new-date forms.
- The Partner page, the push switches on the web, log out, and log out of all devices.

**Not exercised by this retro:**
- **The column dock form.** Desktop Playwright cannot set `env(safe-area-inset-*)` (DW-419). The only column-form evidence is the 2026-11-04 simulator check of Settings, recorded in DW-419's resolution.
- **Anything that runs only in the shell:** the back swipe, Remind me scheduling, and the Notifications page switches. For these the evidence is the owner's Duo run and the simulator runs recorded in story 5.17's plan and the epic's 2026-11-04 Notes.
- **The partner's iPhone.** Nothing has ever run on it.

The retro did not rerun the simulator itself. The owner's DW-424 re-check of 2026-11-04 did run on the iPhone Duo simulator: folded, column dock, a shell built from main `49006f72`, and `sim serve-update`. An update applied on Profile and an update applied on Home both left the new Home's swipe doing nothing (8 swipes each). In both cases Profile → Settings → Home went back one level per swipe, and a swipe on Home did nothing (P3).

## Previous-retro follow-through

The previous retrospective is `epic-date-reminders-retrospective.md`, committed at `bdb583aa` on 2026-11-02. It found nothing to follow through, because `epic-push-notifications` has no retrospective. Its 13 action items:

| # | Item (owner) | Landed | Evidence |
|---|---|---|---|
| 1 | Partial "log out of all devices" notice and a retryable-error test (dev loop) | yes | `c958f740`; `actionService.ts:140-142`; `authServices.test.ts` about :339; story 5.5 reworded it (`fe2e6ab0`) |
| 2 | Reminder sound and in-front presentation (owner, then dev loop) | in part | `dc42f9ec` sets `sound`; banner kept by choice (ledger); no device sound check recorded |
| 3 | R4 foreground or `TOKEN_REFRESHED` refresh (owner via PO) | yes | `43a72690`; `dateRemindersAtLaunch.ts:85,273-288` |
| 4 | `rearm()` catch restores `gaveUp` (dev loop) | yes | `b774b017`; `useRealtimeMessages.ts:708-709`; `useRealtimeMessages.retry.test.ts:350` |
| 5 | `clearDates` clears `countdown_marks` and `date_reminders` (dev loop) | yes | `95ddf044`; `scripts/sim-driver/dates.ts:65,70` |
| 6 | Replace the bare `console.error` assert at `PushSettings.test.tsx:357` (dev loop) | yes | `2b5f27e7`. **New escape:** `tests/unit/stores/moodSlice.historyBackfill.test.ts:221` still asserts `expect(errorSpy).toHaveBeenCalled()` (checked) |
| 7 | Reword the Date reminders helper (owner, then dev loop) | yes | `e1ebc189`; moved word for word to `NotificationsPage.tsx:80` by 5.6 |
| 8 | Ledger changes in one change (owner or PO) | yes | DW-374 and DW-380 closed, DW-378 and DW-352 updated, DW-386 to DW-403 added (`757f8bb5`) |
| 9 | Thorough review when a plan's risk is high (owner, loop policy) | no evidence found | `policy.toml:82` reads the ticket's risk; 5.2 and 5.15 high-risk plans got quick review (O1) |
| 10 | Merge PR-branch fixes back into `loop/integration` before a sweep (owner) | no evidence found | nothing in commits, AGENTS.md or memory |
| 11 | A defect found by a check story gets its own story (PO) | no evidence found | O2 shows the same pattern again |
| 12 | Shuffled `SEED=` run for shared-mock changes (dev loop) | no evidence found | only `AGENTS.md:41`, which predates the retro and covers CI replay |
| 13 | Don't refute a commit-shape finding on an impossible promise (owner, loop policy) | no evidence found | no policy text; story commits still mix AGENTS.md with code (`c98d637a`, `ed9021c5`) |

## Action items

Every item is proposed. Nothing was applied. Under AGENTS.md, a deferred finding belongs in `deferred-work.md`, so item 1 is the change that files the defer rows.

| # | Action | Owner | Kind | Source |
|---|---|---|---|---|
| 1 | Ledger, in one change: add entries for V1+V2, V4, V5, S3, the duplication/test-kit cleanup, P5's column-form sweep, P6's `sim doctor` and P3's hold-and-screenshot step. Note on DW-432 that V6 re-found it. | PO (`bmad-agent-po`) | ledger | the defer rows above |
| 2 | Schedule the partner's iPhone reinstall. The owner brings the phone to the Mac, and the agent installs a shell built from main over the top, at build number 1, with no uninstall. Then run Flow 2 on that phone, and the push-settings load-and-save check story 5.18 owed. | owner schedules; agent installs | remediation | P4, S5 |
| 3 | Rework `backlog/story-native-shell-live-update-prompt.md`: set `hitl: false` and move its checks to `sim serve-update` / `sim build --update-port`. Keep a phone step only for what the simulator cannot show, and say why. | PO | spec reconciliation | P1 |
| 4 | PO ticket-writing rule: every verify line names its runner (Playwright, simulator, phone). A phone step states why the other two cannot run it. `hitl: true` only for a step with no machine path. Done when never says "a person runs" for a machine-runnable check. Cross-cutting requirements (Touch Floor, design tokens) get a verify line that measures them, not "delivered by each story". | PO (`bmad-agent-po`, via `bmad-customize` or its own checklist) | process | P1, P2 |
| 5 | Keep the 2026-11-04 R16/R18 measurement as an E2E spec in `tests/e2e/settings/`. It walks the 25 pages and asserts hit areas ≥ 44pt, fields at 16px, and colours drawn only from DESIGN.md tokens. | dev loop | remediation | P2, epic:127 |
| 6 | A ticket is marked done only after its plan holds the evidence (what ran, where, result). A plan with no Verification is not done. | PO | process | P2 |
| 7 | Add a hold-and-screenshot swipe to the simulator driver (`sim swipe back --hold` or similar). It stops halfway and captures the picture sliding in, and is documented in the driver's README. | dev loop | remediation | P3 |
| 8 | Gesture or native-UI spikes: the verify line covers what the user sees during the gesture, not only where it lands. A rewrite after an operator confirmation re-runs every confirmed check before the story is called done. | PO | process | P3 |
| 9 | The ship story of an epic with a native change lists one reinstall step per phone, each named, with its build number. | PO | process | P4 |
| 10 | One simulator sweep of every view in both column forms (left and right). Afterwards, each epic sweeps the views it changes. | dev loop, as a backlog story | remediation | P5, S4 |
| 11 | Add `sim doctor`, run automatically before `sim build`. It checks the Supabase CLI on PATH against the `.mise.toml` pin, mise trust of the staged path, Xcode and Device Hub, and the local stack's health. | dev loop | remediation | P6 |
| 12 | Fix the walk-back hang (V1): clear `walkingDown` on a fallback when no `popstate` arrives, and test a second dock tap mid-walk (V2). | dev loop | remediation | V1, V2 |
| 13 | Remove `sudo /bin/date` from `scripts/sim-driver/README.md:5` and point to the simulator's own clock. | dev loop | remediation | V3 |
| 14 | Replace the bare `expect(errorSpy).toHaveBeenCalled()` at `tests/unit/stores/moodSlice.historyBackfill.test.ts:221` with the logged message. | dev loop | remediation | follow-through #6 |
| 15 | Run `sim pending` after turning on Remind me on a date page, to confirm the month and week reminders are scheduled. | whoever checks next (simulator) | verification | S3 |
| 16 | Reconcile R2's wording (S1) and the reload decision (S2) in the epic file. | PO | spec reconciliation | S1, S2 |
| 17 | Carry the previous retro's items 9, 10, 11 and 13 forward. O1 and O2 show items 9 and 11 recurring. | owner (loop policy), PO | process | follow-through |

## Decision records

Three decisions passed the test (hard to reverse, surprising without context, the result of a real trade-off, with no existing ADR):

- **The shell's back swipe is the app's own `UIScreenEdgePanGestureRecognizer`, not WebKit's gesture.** Plan 5.15, commit `e1ba2117`, epic:122.
- **Home is the bottom of the history:** `setView` walks back to the first entry. Commit `350f5832`, no plan, epic:121.
- **Linked since is the accepted partner request's `updated_at`.** Plan 5.8, epic:110.

The owner was asked on 2026-11-04 and declined all three. The epic Notes, the `NativeAuth.swift:70-76` comment and AGENTS.md already hold their context and reasons, and AGENTS.md bans generated documentation. No ADR file was written.

## Acceptance verdict

**Verdict: accepted-with-open-items.** This is the owner's decision, overriding the machine verdict. Criteria: declared (the epic file's Requirements R1–R18 and Done when).

The open items:

- **The partner's iPhone reinstall** (action item 2).
- **Flow 2 on the partner's iPhone** (action item 2).

**The machine verdict was rejected** on Done when bullet 6. A reinstall on both phones was required once spike 5.2 chose native code (epic:79), and Flow 2 was to run on the partner's iPhone. Neither happened (story 5.17 plan items 1 and 3; epic:126).

**How the other bullets stand on the evidence:**
- **Bullet 1 holds only in part.** The column form was checked for Settings alone (S4, P5).
- **Bullets 2 to 5 are met:**
  - The old Account date fields, the Countdowns section and the reminder list are gone.
  - DW-416 is closed, with R14 clean in the migrations, pgTAP and `database.types.ts`.
  - The slice split is in, with AGENTS.md stating 14 slices and the subpage rule.
  - No UI string reads "Sign out".
- **Supporting evidence:** this retro's Playwright run passed 128 of 128, and R16 and R18 were measured as met on 25 pages (epic:127).
- **No ticket is unfinished:** `pending_tickets` is empty.

**Owner decision:** on 2026-11-04, asked in this retrospective, the owner chose **accepted-with-open-items**, naming the partner's iPhone reinstall and Flow 2 on that phone as the open items. This confirms their close decision at epic:126. Action item 2 schedules both, and every other action item stays proposed.

## Open questions

- **V1:** does the walk-back hang actually happen in the shell? Nobody has reproduced a stored `depth` larger than the real history, or a walk that crosses the updater's reload. Reproducing it would decide whether item 12 is a fix or a hardening.
- **V4:** should a failed Linked since read blank the whole partner lookup? That may be deliberate (only a full read overwrites a snapshot); a product answer settles it.
- **21 review findings were not verified.** Some are iOS-only (6, 7, 8) and would need the simulator to confirm.
