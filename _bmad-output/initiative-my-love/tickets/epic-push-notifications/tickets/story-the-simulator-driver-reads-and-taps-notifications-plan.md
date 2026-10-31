---
title: 'The simulator driver reads and taps notifications'
type: 'feature'
ticket: '12'
created: '2026-10-31'
status: done
baseline_revision: 'f30db0d03bd31c68cc248cf46bcffb9b3deaccc3'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/sim-driver-prototype/', '{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-simulator-driver-is-a-repo-tool-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      sim center's multi-screen read (scroll and merge) is unproven and can cut groups short, merge two threads with identical text, collapse duplicates, or count an unreachable stack as one notification.
    evidence: |-
      By reading Notify.swift: the read-and-scroll loop stops at 30 screens and exits 0; cross-screen merge matches any shared text; an unreachable stacked cell is reported with count 1; merge's return value is unused. The scrolling code changed after its only 8-group run. The owner moved the multi-group case to story 3.14 (2026-10-31), which reads up to 8 groups on one unfolded screen, so these stay open past 8 groups. Recorded as DW-338. Settle with a run of more groups than fit on the unfolded inner display, including one group taller than a drag step.
    location: >-
      scripts/sim-driver/RunnerUITests/Notify.swift (center, merge, screenGroups)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Stories 3.1, 3.2 and 3.4–3.9 must check pushes on the iPhone Duo simulator with no person, and story 4.1 must answer the permission alert, but story 2.9's driver (`scripts/sim-driver/sim`) has no notification steps; they exist only as the scratch prototype's `Notify.swift`, `notify.sh` and host-app probe.

**Approach:** Port them into the driver as `sim` subcommands backed by a new XCUITest class, each targeting the shell by default or the driver's own host app with `--host`, and prove every step on the host app, which gains only the permission request and a status line, so no My Love push code is needed.

## Boundaries & Constraints

**Always:**
- New subcommands, listed by `sim help` under a "Notifications" heading, each taking `--host` (target `dev.sallvain.simdriver.runner`, icon "Runner") else the shell (`dev.sallvain.mylove`, icon "My Love"):
  - `permission allow|deny` -- with `--host`, launch the host app asking for permission; for the shell, bring it to the front (it asks on its own once story 3.1 lands). Wait for SpringBoard's alert and tap Allow or Don't Allow (match the apostrophe either way). With `--host`, then print the host app's status line (`authorized` / `denied`).
  - `permission reset` -- uninstall the app, which removes its section from the device's `data/Library/BulletinBoard/VersionedSectionInfo.plist` (measured at planning), then reinstall it: the host from the runner's build products, the shell from the last `sim build`'s `App.app`.
  - `push FILE` -- `xcrun simctl push <udid> <bundle> FILE` after checking FILE is JSON with an `aps` object.
  - `banner FILE [--tap cold|background]` -- put Settings (`com.apple.Preferences`) in front, start the watch, wait until no earlier banner remains, signal "watching", then `sim` sends the push and prints the banner's label (`NotificationShortLookView`). `--tap cold` terminates the app first; `--tap background` launches it first; both tap the banner and print the app's `XCUIApplication.state` before and after.
  - `center` -- return to Home (`ax control Home`) before each drag from the top, read the app's Notification Center groups, scroll to reach older ones until none is new, return to Home, print one JSON line listing each group's text and notification count in screen order.
  - `badge` -- print the app icon's value (`3 new items`), or `none`.
- Elements are queried by identifier across all types (`descendants(matching: .any)`), never by a single element type.
- The watch's lines reach `sim` as they are printed (flush stdout), since banners last seconds.
- Steps run through the existing runner build (`ensure_runner`) and `drive`'s log and failure reporting.

**Never:**
- Change `ios/App`, `src/` or anything the shipped app builds from; add push code to the shell.
- Port the prototype's `schedule` probe (story 4.7 adds its requests) or its `aps-environment` entitlement and remote registration, unless `simctl push` shows no banner without them (then record why in Implementation Notes).
- Change `Drive.swift`'s existing steps or the `sim` commands story 2.9 shipped.
- Write account data, emails or screenshots into `_bmad-output/`; leave a process running.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No alert | `permission allow --host` when already decided | -- | Exit 1 "no permission alert" within ~20 s |
| Bad payload | `push missing.json`, or JSON without `aps` | -- | Exit 2 before driving |
| No banner | `banner FILE --host` with permission denied | -- | Exit 1 "no banner" after ~20 s |
| Empty centre | `center --host` with nothing delivered | `{"groups":[]}`, exit 0 | -- |
| No badge | `badge --host` with no badge | `badge: none`, exit 0 | -- |
| Shell never built | `permission reset` with no `App.app` in the work dir | -- | Exit 1 "run sim build first", nothing uninstalled |
| Tap misses | `--tap ...` and the app is not `runningForeground` after | -- | Exit 1 naming the state |

</intent-contract>

## Code Map

- `_bmad-output/.../sim-driver-prototype/RunnerUITests/Notify.swift` -- source to port: `springboard` app, Allow tap, banner poll and `NotificationShortLookView` tap, `springboard.icons["Runner"].value`, the top-edge drag (`press(forDuration:thenDragTo:)`), the second tap that opens an expanded group. `notify.sh` -- `-only-testing:RunnerUITests/Notify/testStep`. `Runner/App.swift` -- the `request` probe (`requestAuthorization([.alert,.badge,.sound])`).
- `scripts/sim-driver/RunnerUITests/Drive.swift` -- pattern for `ACTION` parsing, `say` ("DRIVE " prefix); leave its steps as they are.
- `scripts/sim-driver/Runner/App.swift` -- host app; add a delegate for the `PROBE=request` launch environment and a status `Text` refreshed from `getNotificationSettings` on becoming active.
- `scripts/sim-driver/sim` -- `drive()` runs one step synchronously; `banner` needs the test started in the background, its log polled for the watching line, then the push, then the wait. `ensure_runner` rebuilds when `Runner`/`RunnerUITests` change. `$RUNNER/dd/Build/Products/Debug-iphonesimulator/Runner.app` and `$WORK/derived/app/Build/Products/Debug-iphonesimulator/App.app` are the reinstall sources. `usage()` and the `case $cmd` dispatcher take the new commands.
- `ios/App/App/Info.plist` -- `CFBundleDisplayName` "My Love" (read only).
- `AGENTS.md` "Maintained by hand", sim-driver paragraph -- add one clause naming the notification steps and `--host`.
- Story 2.9's plan -- Duo facts: `XCUIDevice.press(.home)` leaves the shell in front (use `ax control Home`); one Drive step takes 6–12 s.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/sim-driver/RunnerUITests/Notify.swift` -- new `Notify/testStep` reading `ACTION` (`<step> <bundle> <icon name> [args]`), steps: permission, banner watch (+tap), center, badge -- the notification half of the runner.
- [x] `scripts/sim-driver/Runner/App.swift` -- permission request probe and status line -- the host the steps are proven on.
- [x] `scripts/sim-driver/sim` -- `permission`, `push`, `banner`, `center`, `badge`, usage text -- one tool later stories call.
- [x] `AGENTS.md` -- one clause in the sim-driver paragraph.
- [x] Run the matrix rows and the ACs with the tool on the booted iPhone Duo simulator; record each command, exit code and the lines that show the result in Implementation Notes (the tool has no unit-test harness).

**Acceptance Criteria:**
- Given `permission reset --host`, when `permission allow --host` runs, then it taps the alert and prints `authorized`; after another reset, `permission deny --host` taps Don't Allow and prints `denied`.
- Given the host authorized, when `banner FILE --host` delivers a payload with a known title and body, then the printed banner label contains both.
- Given two pushes on thread A and one on thread B (titles naming their thread), when `center --host` runs, then it prints two groups: A's with two notifications, B's with one.
- Given a push with `"badge": 3`, when `badge --host` runs, then it prints `3 new items`.
- Given the host app terminated, when `banner FILE --host --tap cold` runs, then it prints state not running before and running foreground after; given the host running, `--tap background` prints a background state before and running foreground after.
- Given the shell installed, when `badge` runs without `--host`, then it reads the "My Love" icon (`badge: none`).
- Given the session ends, then `git status --short` shows only the planned files, no driver process is running, and the Duo still holds the shell.

## Implementation Notes

Run 2026-10-31 on the iPhone Duo simulator (iOS 27.1, `A0A486ED…`), Xcode 27.2, with no person acting except the owner's one hand check noted below. Every command is `scripts/sim-driver/sim …`; payloads are scratch files of the form `{"aps":{"alert":{"title":"Thread A","body":"A note 1"},"thread-id":"thread-A"}}`.

**Built.** `RunnerUITests/Notify.swift` (new `Notify/testStep`: ACTION fields go tab-separated because "My Love" holds a space; lines start `NOTIFY ` and are flushed), `Runner/App.swift` (asks permission when launched with `PROBE=request`; a `status` text shows `getNotificationSettings`), `sim` (`start_step`/`finish_step` shared by Drive and Notify, `drive` unchanged in behaviour; new `permission`, `push`, `banner`, `center`, `badge`), and one clause in AGENTS.md. No remote registration or `aps-environment` entitlement: `simctl push` delivers without them. The `schedule` probe was not ported (story 4.7).

**Findings that shaped the code.**
- `XCUIApplication.state` is refreshed from the run loop, so the polls turn it (`until`) rather than `usleep`.
- With Notification Center open SpringBoard can stop reporting idle, and XCUITest then waits 60 s around every action (one run took 376 s, the next never finished); `center` answers yes to `XCUIApplicationProcess`'s private `shouldSkipPre/PostEventQuiescence` and pauses itself after each action.
- Notification Center stacks an app's notifications into one "Grouped" cell; a tap expands the stack, then each thread's group. `center` expands every stacked cell it can reach and reads each cell's `NotificationTitle` and `TextContent.Primary`.
- A banner's label is `RUNNER, now, <title>, <body>`; a refused push (permission denied) fails `simctl push` with UNErrorDomain 2003, and `banner` lets the watch end in "no banner".
- The Duo's Home Screen has two icons named "My Love"; `badge` reports whichever carries a value.
- `center` is proven only with the Duo folded and in portrait. With the device unfolded, or rotated (the hand check left it unfolded and upside down), the opening drag misses, and before the guard each try took 86 s and failed. `center` now refuses with an `ax state` reading unless the pose is closed (or there is no pose) and the orientation is `portrait`.
- The first drag right after `background` sometimes misses; `sim` retries up to three times and the second try opened every time.

**Checks (final3.log, final4.log, final5.log in the session scratchpad).**
- `help` exit 0, `zsh -n` ok, `npm run lint` exit 0.
- AC permission: `permission reset --host` exit 0; `permission allow --host` → `tapped Allow`, `status: authorized`, exit 0; again → exit 1 `no permission alert` (matrix: no alert); reset, `permission deny --host` → `tapped Don't Allow`, `status: denied`, exit 0.
- Matrix, denied: `banner one.json --host` → simctl 2003, `watching`, exit 1 `no banner`.
- Matrix: `push` of a missing file, a file with no `aps`, and non-JSON → each exit 2 before driving. `SIM_DRIVER_WORK=<empty dir> permission reset` → exit 1 `no shell build … run sim build first`, nothing uninstalled.
- AC banner: `banner one.json --host` → `banner: RUNNER, now, Probe title one, Probe body one`, exit 0.
- AC taps: `--tap cold` → `before tap: notRunning`, `after tap: runningForeground`, exit 0; `--tap background` → `before tap: runningBackground`, `after tap: runningForeground`, exit 0. Matrix, tap misses: with the tap pointed off the banner for one run (source restored byte-identical after) → `after tap: runningBackground`, exit 1 `tap missed: the app is runningBackground`; the restored runner then read a banner, exit 0.
- AC badge: push with `"badge": 3`, then `badge --host` → `badge: 3 new items`; `badge` (shell) → `badge: none`; after a reset `badge --host` → `badge: none` (matrix: no badge).
- AC grouping, one screen: twice from a reset host (`permission reset --host`, `permission allow --host`), `center --host` → `{"groups":[]}` (matrix: empty centre), then pushes A1, A2 and B1, then `center --host` → `{"groups":[{"count":1,"text":"Thread B, B note 1"},{"count":2,"text":"Thread A, A note 2"}]}`, exit 0 both rounds. In the run before, payloads with no thread id formed their own group of 2 beside A and B.
- AC grouping, more than one screen: the owner's manual check. With threads A–H delivered (B with 1 notification, the others with 2), the owner confirmed by hand on 2026-10-31 that Notification Center shows all 8 groups, each once, with those counts. The 13:13 run of `center --host` printed the same 8 groups, but `center`'s scrolling code changed afterwards and was not re-proven, so `center` is proven only for groups that fit on one screen.
- Guard: `pose open` then `center --host` → exit 1 `center needs the device folded and in portrait … pose: unfolded, orientation: portrait`. Device Hub would not rotate the folded Duo (`ax rotate` exit 5), so the orientation half of the guard was checked by feeding sample `ax state` texts through its predicate: closed+portrait runs, and portraitUpsideDown, landscapeLeft and partial are refused.
- End state: `git status --short` shows only the planned files; `pgrep -fl "xcodebuild|http.server"` finds nothing; the shell is still installed; the Duo is folded, in portrait. No temporary debug lines remain (`grep -rn DBG scripts/sim-driver` empty).

## Plan Change Log

- 2026-10-31, owner decision: the grouping criterion's clause "and given more threads than fit on one screen, `center --host` lists each thread's group exactly once" is struck. This plan added it; the ticket's verify asks only for two pushes on one thread as one group and a third on another as a second. The multi-group case moved to story 3.14 (merged to main as PR #427), which makes `center` unfold the Duo to portrait and proves 8 groups there; the owner checked the 8-group case by hand. Review judges 3.12 against the one-screen criterion. KEEP: the one-screen A/B check and the empty-centre check as recorded in Implementation Notes.

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 31 findings — high 0, medium 11, low 16, false 3, maybe-false 1
- findings:
  - `[medium]` `[patch]` (blind) `banner` can match the previous run's `NOTIFY watching` line before the background child truncates `notify.log`, and push before the watch starts — patched: `start_step` empties the log in the parent (`: >$log`) before starting the step; `banner --tap cold/background` re-run, exit 0.
  - `[medium]` `[defer]` (blind) `center`'s read loop stops at 30 screens and exits 0 with partial groups — multi-screen center, moved to story 3.14 by the owner; DW-338.
  - `[medium]` `[defer]` (blind) Groups on different screens merge on any shared text, so threads with identical wording merge and duplicates collapse — on one screen the merge never runs a second time; multi-screen only; DW-338.
  - `[medium]` `[defer]` (blind) Multi-screen `center` is unproven but not in `deferred` or the ledger — now recorded: frontmatter `deferred` and DW-338.
  - `[low]` `[defer]` (blind) `merge`'s return value is unused, though the plan said to scroll until none is new — part of the multi-screen code story 3.14 reworks; DW-338.
  - `[low]` `[patch]` (blind) `permission reset` on the shell drops its sign-in and the help does not say so — patched: help says it loses its sign-in and to run `sim signin` again.
  - `[low]` `[patch]` (blind) "no permission alert" gives no hint at the usual cause — patched: the message says an app that already answered is not asked again, and names `sim permission reset`; re-run prints it, exit 1.
  - `[false]` `[reject]` (blind) `badge` never brings up the Home Screen, so icons may not be exposed — refuted: `badge --host` read `3 new items` with the host app in front (final6.log, after `--tap background`).
  - `[low]` `[patch]` (blind) `--tap background` calls `launch()`, which ends a running instance — patched: `activate()`, which keeps a running app and launches one otherwise; re-run printed `before tap: runningBackgroundSuspended`, `after tap: runningForeground`.
  - `[low]` `[reject]` (blind) The host bundle id is written in three places — a rename is unlikely and the fix adds a parameter to ACTION.
  - `[low]` `[patch]` (blind) `project.yml`'s header still says Runner only hosts the tests and names only Drive.swift — patched: it names the permission request and Notify.swift.
  - `[low]` `[reject]` (blind) `skipIdleWaits` fails silently on an Xcode without the private methods — story 3.14 (merged ticket, PR #427) adds exactly this warning; patching here would collide with it.
  - `[low]` `[patch]` (blind) Help does not say what a group's text is — patched: "its newest notification's title and body"; the duplicate-collapse half is multi-screen only (DW-338).
  - `[low]` `[reject]` (blind) `banner`'s trap stays set after the function and exits 130 on TERM — `sim` runs one command and exits, so the trap never outlives the wait; the exit code on TERM is cosmetic.
  - `[low]` `[patch]` (blind) The host status reads "unknown" both before the first reply and for an unknown status — patched: initial value `pending`.
  - `[medium]` `[patch]` (edge) Stale `NOTIFY watching` in `notify.log` lets the push go early — same root cause and fix as the first row.
  - `[low]` `[patch]` (edge) On a first `banner` run grep prints "No such file" while the log does not exist — patched by the same change: the parent creates the empty log before polling.
  - `[medium]` `[defer]` (edge) Read loop ends at 30 screens without failing — multi-screen; DW-338.
  - `[maybe-false]` `[defer]` (edge) A stacked cell never reachable is reported as count 1 — would need a list whose stack sits under another card on every screen; medium if true (unverified); DW-338.
  - `[medium]` `[defer]` (edge) Two threads with the same title and body merge across screens — multi-screen; DW-338.
  - `[low]` `[patch]` (edge) A cell with no title and no body reads as empty text — patched: falls back to the cell's label; the one-screen A/B check re-run, same groups.
  - `[medium]` `[patch]` (verification-gap) The `drive()` refactor onto `start_step`/`finish_step` was never re-run through a Drive step — patched by running: `sim dump` exit 0 (web view JSON) and `sim tap 200 5` exit 0 (`tapped 200,5 webView=0,0 678x466`).
  - `[medium]` `[reject]` (verification-gap) Multi-screen `center` is unproven against the "more threads than fit on one screen" criterion — that clause was struck by owner decision 2026-10-31 and moved to story 3.14; the code's open faults are DW-338.
  - `[medium]` `[patch]` (verification-gap, other) `banner` can push before its watch starts — same root cause and fix as the first row.
  - `[low]` `[reject]` (intent) Groups are told apart by text, and no thread id appears in `center`'s output — Notification Center exposes no thread id; groups formed by thread id are told apart by their text, as Design Notes say.
  - `[medium]` `[reject]` (intent) Scrolling to older groups is only partly met — moved to story 3.14 by owner decision 2026-10-31; faults recorded as DW-338.
  - `[low]` `[reject]` (intent) `center` refuses unfolded or rotated devices — story 3.14 replaces this guard by unfolding to portrait; until then the guard turns an 86 s silent failure into an immediate, explained one.
  - `[low]` `[patch]` (intent) The state before a tap is printed but not asserted — patched: cold requires `notRunning` and background a background state before the tap, else exit 1.
  - `[false]` `[reject]` (intent) Only a banner tap exists, no Notification Center cell tap — the ticket's step ties the tap to a banner ("an app in front shows no banner"), and its verify says "by tapping a banner".
  - `[low]` `[reject]` (intent) The shell path is unproven beyond `badge` — the ticket says the steps are shown on the host app because the shell has no push code yet (story 3.1 adds it).
  - `[false]` `[reject]` (intent) Only the `request` probe was ported — the `schedule` probe's requests belong to story 4.7, which extends the driver after this story.

## Design Notes

`banner` order matters: the watch must be running before the push because a banner lasts seconds, and an XCUITest launch takes 6–12 s, so `sim` starts the test, polls its log for the watching line, then pushes. The app must not be in front (an app in front shows no banner, and a test run leaves its target in front), hence Settings first.

Groups are told apart by their text: Notification Center exposes no thread id, so a check gives each thread's payloads a title naming the thread and reads which notifications share a group.

## Verification

**Commands:**
- `scripts/sim-driver/sim help` -- expected: lists the new commands, exit 0
- `zsh -n scripts/sim-driver/sim` -- expected: no output, exit 0
- `npm run lint` -- expected: exit 0
- `git status --short`; `pgrep -fl "xcodebuild|http.server"` -- expected: only planned files; nothing the driver started

## Auto Run Result

Status: built

**Summary:** Story 2.9's simulator driver gains notification steps, ported from the prototype's `Notify.swift`, `notify.sh` and the host app's `request` probe. `sim permission allow|deny|reset`, `push`, `banner [--tap cold|background]`, `center` and `badge` target the shell, or the driver's own host app with `--host`. They were proven on the host app with no person acting, on the iPhone Duo simulator: the alert was granted, and declined after a reset; a banner's title and body were read; two pushes on thread A read as one group and one on thread B as a second; the badge read `3 new items`; and tapping a banner opened the app from a cold start and from the background, both states checked through `XCUIApplication.state`. `center` is proven only for groups that fit on one screen, with the Duo folded in portrait. The owner checked the 8-group case by hand, and that case is now story 3.14's.

**Files changed:**
- `scripts/sim-driver/RunnerUITests/Notify.swift` — new `Notify/testStep`: permission, banner watch and tap, Notification Center groups, badge.
- `scripts/sim-driver/Runner/App.swift` — host app asks for permission when launched with `PROBE=request` and shows its status.
- `scripts/sim-driver/sim` — the new subcommands; `drive()` now shares `start_step`/`finish_step` with Notify; `center`'s folded-and-portrait guard.
- `scripts/sim-driver/project.yml` — header comment names the host's permission request and Notify.swift.
- `AGENTS.md` — one clause in the sim-driver paragraph naming the notification steps and `--host`.
- `_bmad-output/initiative-my-love/deferred-work.md` — DW-338 (multi-screen `center`).

**Review findings:** 31 from four lenses (blind, edge-case, verification-gap, intent-alignment). Patched 11 entries: medium 2 (the stale `watching` line in `banner`'s log, found by three lenses; the Drive refactor never re-run, closed by running `dump` and `tap`) and low 9 (help text for a shell reset and for group text, the no-alert hint, `activate()` for `--tap background`, `project.yml` comment, `pending` host status, label fallback for an empty cell, the first-run grep noise, before-tap state assertions). Deferred 1 entry (medium, 7 findings: multi-screen `center`, DW-338). Rejected 11:
- 3 false: badge read with an app in front; banner-only tap matches the ticket; the `schedule` probe is story 4.7's.
- 3 moved to story 3.14 by owner decision: the multi-screen criterion, scrolling to older groups, and the folded-and-portrait guard.
- 1 that collides with story 3.14: the `skipIdleWaits` warning.
- 4 low, not worth the change: bundle id in three places, the banner trap, text-only group identity (Notification Center exposes no thread id), and the shell path (it has no push code yet).

The owner's 2026-10-31 decision struck the multi-screen clause from the grouping criterion (Plan Change Log).

**Follow-up review recommended:** false. Two medium entries were patched, and both were re-run and passed: `banner --tap cold/background` after the log fix, and `dump`/`tap` for the Drive refactor. The one part not reproduced is the original stale-log race itself; the fix removes it by construction.

**Verification:** `sim help` exit 0, listing the new commands. `zsh -n` ok. `npm run lint` exit 0. The final run after the patches (final6.log in the session scratchpad) passed:
- `permission reset --host`, then `permission allow --host` → `authorized`; a second allow → exit 1 with the reset hint.
- One-screen `center --host` → A count 2, B count 1.
- `banner --tap cold` → `notRunning` before, `runningForeground` after; `--tap background` → `runningBackgroundSuspended` before, `runningForeground` after.
- `badge --host` → `3 new items`.
- `dump` and `tap` (Drive) → exit 0.

Earlier runs, recorded in Implementation Notes, cover `deny`, banner text, the empty centre, the bad payloads, the shell never built and the forced tap miss. No driver process remains. The Duo is folded, in portrait, with the shell installed.

**Residual risks:**
- `center` reads one screen reliably, and only folded in portrait; past one screen see DW-338, and story 3.14 changes the pose handling.
- The shell path of `permission`, `banner` and `center` was not run, because the shell asks for no permission and receives no pushes until story 3.1; only `badge` ran against the shell.
- The first drag after `sim background` often misses; `center` retries up to three times, and costs about 25 s more when it does.
- `center` swaps private XCUITest methods (`skipIdleWaits`); a future Xcode without them brings back 60 s waits. Story 3.14 adds the warning.
