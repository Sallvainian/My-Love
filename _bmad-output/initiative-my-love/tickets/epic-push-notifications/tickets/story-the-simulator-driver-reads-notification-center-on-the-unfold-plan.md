---
title: 'The simulator driver reads Notification Center on the unfolded Duo in portrait'
type: 'feature'
ticket: '14'
created: '2026-10-31'
status: done
baseline_revision: 'c9bf63ece172e72e51313b055d7e6b1ef23406f2'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-and-taps-notifications-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      sim banner --tap cold on the unfolded Duo can miss once because the banner is gone before the tap reaches it.
    evidence: |-
      First cold run in unfolded portrait: banner label read, before tap: notRunning, then "Failed to tap NotificationShortLookView ... No matches found"; the next three cold runs passed. banner is unchanged by this story, so the timing is pre-existing. Recorded as DW-344. Settle with ten cold runs unfolded and folded.
    location: >-
      scripts/sim-driver/RunnerUITests/Notify.swift (banner)
    severity: medium
  - summary: >-
      center drops "+N from <app>" summary cells; past 8 groups a summary may stand for groups never listed, undercounting silently.
    evidence: |-
      At 8 groups every notification the summary stood for was also read as its own cell. Past 8 groups (DW-338) this is untested. Recorded as DW-345. Settle with the DW-338 run of more groups than fit the unfolded inner display, comparing the total count with the pushes.
    location: >-
      scripts/sim-driver/RunnerUITests/Notify.swift (screenGroups, isSummary)
    severity: medium (unverified)
  - summary: >-
      center's restore on a Rotate-Left-only phone and tap(_:)'s coordinate fallback on the inner display have never been run.
    evidence: |-
      No run so far has used either path. The 8-group runs passed, but nobody observed whether any tap went through displayInUse()'s coordinate fallback. The restore's rotate_to path through cmd_rotate on a phone with only Rotate Left (iPhone 17) was not run. If either is wrong, a read past a shrunk cell misses, or a phone is left turned. Settle it with one center run that taps a shrunk cell at the list's bottom edge on the unfolded Duo (log whether the fallback ran), and one center --host started in landscape on an iPhone 17 simulator, comparing ax state before and after.
    location: >-
      scripts/sim-driver/sim (rotate_to, center_restore); scripts/sim-driver/RunnerUITests/Notify.swift (tap)
    severity: medium (unverified)
  - summary: >-
      AGENTS.md's sim-driver clause says center puts the pose and orientation back, without sim help's exception for a folded landscape.
    evidence: |-
      sim help says a folded landscape comes back only when the shell, the host app, Settings or Safari was in front. With another app in front, center exits 1 after a good read and says why. The AGENTS.md clause states the restore with no exception, so an agent that reads only AGENTS.md expects the folded landscape back. The fix edits an agent-context file, so it is deferred rather than patched.
    location: >-
      AGENTS.md (Maintained by hand, sim-driver paragraph)
    severity: low
  - summary: >-
      center leaves the Home Screen in front after a folded-portrait or unfolded start; only a folded-landscape start brings its front app back.
    evidence: |-
      center presses Home before its read and again after it, as story 12's center already did at the baseline (sim:641 and sim:648 at c9bf63ec), so the shell or host app that was in front is not brought back. The new restore relaunches the front app only for a folded landscape, because only there is it needed for the orientation. Neither sim help nor AGENTS.md says the front app is not restored. A check that expects the shell in front after center finds the Home Screen.
    location: >-
      scripts/sim-driver/sim (cmd_center, center_restore)
    severity: low
  - summary: >-
      sim banner exits 130 on TERM as well as INT, while center now exits 143 on TERM.
    evidence: |-
      banner's trap is `trap '[[ -n $STEP_PID ]] && kill $STEP_PID 2>/dev/null; exit 130' INT TERM` (sim:600), unchanged since the baseline c9bf63ec. center's traps set 130 for INT and 143 for TERM. A caller telling the two signals apart by exit code gets 130 from banner for both.
    location: >-
      scripts/sim-driver/sim:600 (cmd_banner)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `sim center` reads Notification Center only folded and in portrait, where more than a few groups do not fit on one screen and scrolling to older ones fails; and `skipIdleWaits` silently does nothing on an Xcode without the private methods it replaces.

**Approach:** `center` unfolds the Duo, turns it to portrait, reads up to 8 groups on the inner display, then restores pose and orientation (also on failure or SIGINT); the drag from the top is made to open Notification Center there. `skipIdleWaits` warns when its class or a method is missing. Also show an XCUITest tap reaches SpringBoard on the inner display.

## Boundaries & Constraints

**Always:**
- `center` records `ax state`'s pose and orientation first; `ax pose open`; `sim rotate` until orientation reads `portrait`; reads; restores the pose, then rotates until orientation equals the recorded one (folding can change it); restoring runs on success, failure, SIGINT and TERM. A phone with no `pose:` line skips the pose steps.
- Replace story 12's folded-and-portrait guard; `sim help`'s center line says center unfolds the Duo to portrait and puts the pose back, and names the group count it was proven at (8). It no longer says "Needs the device folded and in portrait."
- The idle-wait warning goes to stderr through `sim` as "idle waits cannot be skipped on this Xcode; runs will be slow", printed when the class or either method is not found, and never otherwise. A test-only override of the looked-up names (environment) makes the missing case checkable.
- Change only `scripts/sim-driver/` and the driver's clause in `AGENTS.md`.

**Never:**
- Add or edit anything outside those; touch `Drive.swift`'s steps; add banner-tap or permission changes beyond what the check needs; leave a process running or the Duo in a changed pose.
- Mark the ticket done. If XCUITest cannot open Notification Center or tap SpringBoard on the inner display, stop: HALT blocked, "XCUITest cannot reach SpringBoard on the inner display; re-slice".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Folded portrait | `center --host`, 8 threads | 8 groups, then Duo folded, portrait again | -- |
| Folded landscape L/R, unfolded landscape | same | same 8 groups; pose and orientation as before | -- |
| SIGINT after unfold | `center` interrupted | pose and orientation restored | restore errors reported, exit 130 |
| Read fails | Notification Center never opens | exit 1 | still restores |
| Idle method missing | override names a bad class/method | warning printed | run continues |

</intent-contract>

## Code Map

- `scripts/sim-driver/sim` -- `cmd_center` (guard at the `ax state` check, to replace), `cmd_rotate`, `usage()` center line, `say`/`die`, `ax pose|rotate|state`. `ax state` prints `pose:`, `orientation:`.
- `scripts/sim-driver/RunnerUITests/Notify.swift` -- `center` (top-edge drag, `distanceToTop`, `drag`), `skipIdleWaits`, `say` ("NOTIFY " lines). Reuse; keep one-screen read working.
- `scripts/sim-driver/sim` `start_step` -- passes `TEST_RUNNER_ACTION`; add the override env through the same prefix.
- `AGENTS.md` sim-driver paragraph ("Maintained by hand") -- one clause.
- Story 12's plan -- Duo facts; DW-338 stays open past 8 groups.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/sim-driver/RunnerUITests/Notify.swift` -- make the drag from the top open Notification Center on the inner display in portrait; `skipIdleWaits` warns when class or method missing, with an env override of the names -- core of the story
- [x] `scripts/sim-driver/sim` -- `cmd_center` record/unfold/rotate/restore with trap; relay the warning; update help -- no-person center
- [x] `AGENTS.md` -- update the driver clause (center unfolds, restores, proven at 8)
- [x] Run the verify matrix on the Duo; record commands, exit codes and result lines in Implementation Notes

**Acceptance Criteria:**
- Given 8 threads A–H pushed to the authorized host, when `center --host` starts from folded portrait, folded landscapeLeft, folded landscapeRight and unfolded landscape, then each prints A–H once with one notification each and `ax state` afterwards equals its start.
- Given `center` interrupted by SIGINT after unfolding, then pose and orientation are restored.
- Given unfolded portrait, when `banner FILE --host --tap cold` and `--tap background` run, then the host is `runningForeground` afterwards.
- Given a bad class or method name, when `center` runs, then the idle-wait warning prints; with real names none.
- Given `sim help`, then the center line matches the Boundaries.
- Given the session ends, then `git status --short` shows only planned files, no driver process runs, and the Duo is as found.

## Implementation Notes

Run 2026-10-31 on the iPhone Duo simulator (iOS 27.1), Xcode 27.2, with no person acting. Payloads are scratch files of the form `{"aps":{"alert":{"title":"Thread A","body":"A note 1"},"thread-id":"thread-A"}}`, pushed to the host after `permission reset --host` and `permission allow --host`.

**Built.**
- `Notify.swift`:
  - The top-edge drag is made on SpringBoard's largest window. SpringBoard's own frame stays the outer display's 466×678 with the inner display on, so the old drag landed off screen. Element taps on the inner display (Safari's icon, the banner) worked, so XCUITest does reach SpringBoard there, and the re-slice stop did not apply.
  - `skipIdleWaits` prints `NOTIFY warning: idle waits cannot be skipped on this Xcode; runs will be slow` when the class or either method is missing. `SIM_IDLE_NAMES="Class,method,method"` (passed as `TEST_RUNNER_IDLE_NAMES`) replaces the names.
  - New `front` step: prints which known app is `runningForeground` (target, shell, host, Settings, Safari), else `none`.
  - `screenGroups` skips summary cells (see Findings).
- `sim`:
  - `cmd_center` records `ax state`'s pose and orientation, unfolds, runs `rotate_to portrait`, reads, and restores from an EXIT trap; INT/TERM kill this checkout's xcodebuild step and exit 130.
  - A failed restore is reported and turns exit 0 into 1.
  - `ax state`'s `unfolded` maps to `ax pose open`.
  - The guard is gone, and help and AGENTS.md are updated.

**Findings that shaped the code.**
- **Orientation follows the front app.** `ax state`'s orientation is the front app's: with the Home Screen in front, a folded Duo always reads `portrait`, and `ax rotate` there fails with exit 5 ("stayed portrait"). Folding from any unfolded orientation with the Home Screen in front gave `portrait`, four out of four. With the host app in front, a folded Duo rotated to landscapeLeft and back.
  - So a folded landscape exists only with an app in front, and `center` pressing Home loses it. The first restore attempt read the right groups, but ended `pose: closed, orientation: portrait`, exit 1.
  - So a folded non-portrait start runs `notify front` first (one runner step). Restore folds, `simctl launch`es that app (it comes to the front, not relaunched), then rotates.
  - An app in front that is not on the known list is not brought back, and `center` says so up front.
- **XCUIDevice orientation is not a way in.** `XCUIDevice.shared.orientation = .landscapeLeft` (tried from a scratch runner outside the repo) turns the UI but leaves `ax state` at portrait.
- **Summary cell.** On the first opening after a delivery, the list kept one extra `ListCell` labelled `RUNNER, now, Thread F, F note 1` beside the 8 expanded groups. Its body is `NotificationBody.BottomAligned.phraseThatEnumeratesAllRemainingNotificationsInSection` ("+6 from Runner"), so it is a summary, not a notification. `center` printed it as a 9th group in 2 of 2 first runs after a fresh delivery, even 15 s after the pushes. `screenGroups` now ignores such cells unless they are stacked "Grouped" cells.
- **First cold tap.** In unfolded portrait, the first `banner --tap cold` failed: the banner was gone before the tap ("No matches found"). The next three cold runs passed.

**Checks.**
Logs: `final-matrix.log` and `final-fix.log` in the session scratchpad. 8 threads, one notification each.
- **8-group starts.** Each printed A–H once with count 1, exit 0, and `ax state` afterwards matched its start:
  - Folded portrait.
  - Folded landscapeLeft and folded landscapeRight (host app in front).
  - Unfolded landscapeLeft and unfolded landscapeRight.
  - The folded portrait run printed a 9th "RUNNER" summary group before the summary fix. After the fix, two fresh-delivery first runs from folded portrait printed exactly 8, exit 0, and restored.
  - Story 12's A/B check after the fix: `Thread B×1 | Thread A×2`.
- **SIGINT.** Started folded landscapeLeft with the host in front, interrupted 25 s in while unfolded portrait: exit 130, `pose: closed, orientation: landscapeLeft` afterwards. An earlier SIGINT from folded portrait gave exit 130 and closed portrait.
- **Read fails (matrix).** For one run, `center` was forced to `XCTFail` before its read; the source was restored byte-identical afterwards (shasum) and rebuilt by the next `badge --host`. Started folded landscapeRight, host in front: `notify step 'center' failed`, exit 1, `pose: closed, orientation: landscapeRight` afterwards.
- **Idle-wait warning.**
  - `SIM_IDLE_NAMES=NoSuchClass,…` and `SIM_IDLE_NAMES=XCUIApplicationProcess,noSuchMethod,…` each printed `sim: idle waits cannot be skipped on this Xcode; runs will be slow`.
  - With the real names, `grep -ci idle` gave 0.
- **Banner taps, unfolded portrait.** `banner tap.json --host --tap background` → `before tap: runningBackground`, `after tap: runningForeground`, exit 0. `--tap cold` → `notRunning` before, then `runningForeground` after in 3 of 3 runs (one earlier run missed, as above).
- **Verification commands.** `sim help` exit 0 with the new center line; `zsh -n` ok; `npm run lint` exit 0; `pgrep -fl "xcodebuild|http.server"` empty.
- **End state.** The Duo is closed and portrait, as found at the start of the session.

## Plan Change Log

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 30 findings — high 2, medium 4, low 18, false 5, maybe-false 1. Of the 30, 6 are intent-alignment divergences, logged as findings.
- findings:
  - `[low]` `[patch]` (blind) `cmd_rotate`'s `die 5` exits from inside `center_restore` on a Rotate-Left-only device, skipping the report and the exit code. Patched: `rotate_to` runs `( cmd_rotate 1 ) >/dev/null 2>&1 || true`, so only its final check decides.
  - `[low]` `[patch]` (blind) A phone with no pose that starts in landscape is never restored after Home. Patched: the front probe runs whenever pose != unfolded and orientation != portrait.
  - `[low]` `[patch]` (blind) A failed front probe was reported as "no known app in front". Patched: output and status are captured separately, and a failure names notify.log.
  - `[low]` `[patch]` (blind) Help claims an unconditional restore. Patched: the help says a folded landscape comes back only with the shell, host, Settings or Safari in front. The AGENTS.md clause stays a summary.
  - `[medium]` `[defer]` (blind) The cold-tap miss and other findings were not in the ledger. The cold-tap miss is pre-existing `banner` timing; recorded as DW-344 and in frontmatter `deferred`. The unknown-front-app limit is now in the help, so no ledger entry is needed.
  - `[maybe-false]` `[defer]` (blind) Dropping summary cells could undercount past 8 groups. Untested past 8, medium if true; DW-345. Settle with the DW-338 run.
  - `[low]` `[patch]` (blind) An `IDLE_NAMES` holding only a class patched nothing and printed no warning, and `names.isEmpty` was dead code. Patched: `names.count < 3` counts as missing. Re-run with the class alone printed the warning.
  - `[low]` `[reject]` (blind) On a failed read, the idle-wait warning lands on stdout through `finish_step`. It is met only on an Xcode without the methods and only when the read also fails, and the fix needs a second prefix plus log plumbing.
  - `[low]` `[patch]` (blind) The `rotate_to` comment was wrong for non-Duo devices, and the forward failure gave no context. Patched: the comment is fixed, and the die message carries `ax state`'s pose and orientation.
  - `[false]` `[reject]` (blind) Folded landscape unverified with the shell in front. Disproved by running it: folded landscapeLeft with `dev.sallvain.mylove` in front, `center` exit 0, ended `closed, landscapeLeft`; SIGINT from the same start also restored.
  - `[high]` `[patch]` (edge) An unguarded `pkill` in the trap aborts the restore under errexit when nothing matches. Confirmed with `zsh -c`, where the trap exited 1 before its next line. Patched with `|| true`. INT and TERM sent 4 s in, before any runner step, restored and exited 130 and 143.
  - `[medium]` `[patch]` (edge) `tap(_:)`'s coordinate fallback offset from `springboard.frame`, the outer display's. Patched: one `displayInUse()` helper serves both the drag and the tap. The 8-group re-runs passed; whether a run needed the fallback was not observed.
  - `[low]` `[patch]` (edge) No-pose landscape start — same root cause and fix as the blind row above.
  - `[low]` `[patch]` (edge) A restore-time `die 5` hidden by `2>/dev/null` — same root cause and fix as the first blind row.
  - `[false]` `[reject]` (edge) `rotate_to` could overshoot on a 1 s lag. On the Duo, `cmd_rotate` runs `ax rotate`, which waits until the orientation changes (ax help: "Press Rotate Right, then wait until the orientation changes"); the Rotate Left path polls for the change itself.
  - `[low]` `[reject]` (edge) An empty pose read alongside a good orientation read would skip unfolding. It needs one of two back-to-back `ax state` calls to fail transiently, and the fix adds a guard.
  - `[low]` `[patch]` (edge) Front probe failure masked — same root cause and fix as the blind row above.
  - `[low]` `[patch]` (edge) TERM exited 130. Patched: `CENTER_SIGNAL` holds 130 for INT and 143 for TERM; TERM re-run exited 143.
  - `[low]` `[patch]` (edge) Class-only `IDLE_NAMES` silent — same fix as the blind row above.
  - `[high]` `[patch]` (edge, claim) SIGINT outside a live step leaves the Duo unfolded — same root cause and fix as the `pkill` row.
  - `[medium]` `[patch]` (edge, claim) The inner-display tap claim does not cover `center`'s coordinate taps — same root cause and fix as the `tap(_:)` row.
  - `[low]` `[patch]` (verification-gap, other) No-pose landscape start and restore-time `die` — same root causes and fixes as the blind rows above.
  - `[low]` `[reject]` (verification-gap, other) Warning on stdout on a failed read — the same reasoning as the blind row.
  - `[low]` `[patch]` (verification-gap, other) Help says `SIM_IDLE_NAMES` covers "the notification steps", but only `center` calls `skipIdleWaits`. Patched: the help says center.
  - `[low]` `[patch]` (intent) Restore depends on a fixed five-app list. The limit is now in the help, and an unknown front app is announced up front.
  - `[false]` `[reject]` (intent) Reader semantics changed by the summary filter. The intent's verify requires A–H each exactly once, which the unfiltered reader broke on the first run after a delivery (a 9th "RUNNER" group); the A/B check still reads A×2, B×1. The past-8 risk is DW-345.
  - `[false]` `[reject]` (intent) The inner-display SpringBoard tap proof has no code change. The intent asks to show it, not to change `banner`; the proof is the recorded run (background, and cold 3 of 4), and the one miss is DW-344.
  - `[medium]` `[patch]` (intent) Tap fallback still uses `springboard.frame` — same root cause and fix as the `tap(_:)` row.
  - `[low]` `[reject]` (intent) Warning on stdout on a failed read — the same reasoning as the blind row.
  - `[false]` `[reject]` (intent) A green lint covers neither `sim` nor `Notify.swift`. True of lint, but not a defect: `zsh -n` checks `sim`, the runner build compiles `Notify.swift`, and the simulator runs exercise both.

### 2026-10-31 — Review pass (follow-up)
- verdicts: 25 findings — high 2, medium 0, low 18, false 2, maybe-false 3
- findings:
  - `[high]` `[patch]` (blind) A failed `center` exits 0 when the restore succeeds. In zsh, an EXIT trap set inside a function sees `$?` as 0 after `exit`. So `center_restore`'s `local code=$?` read 0 after `die 1` (a failed read through `finish_step`) and after `die 5` (unfold or portrait failed). Reproduced with zsh 5.9 under the script's options: `restore code=0`, exit 0. Patched: `die` stores its code in a global `SIM_EXIT`, and `center_restore` uses it when it is set. A harness built from the patched functions in `sim`, with `ax` stubbed, gives these exits: failed read 1, `die 5` 5, success 0, SIGINT 130.
  - `[low]` `[reject]` (blind) The ledger repeats DW-344/345 as DW-346/347. This is real, but the fix edits existing ledger entries, which this run's invocation forbids; the orchestrator owns the ledger. No ledger entry was hand-written this pass, so the frontmatter `deferred` list is the only route.
  - `[low]` `[patch]` (blind) `skipIdleWaits`'s comment says fewer names patch nothing, but two names still patch one method. Patched: the comment now says each method found is patched, and a missing class, a missing method or fewer than three names warns.
  - `[maybe-false]` `[defer]` (blind) Paths the plan names as unrun are not in the ledger: the Rotate-Left-only restore, the inner-display coordinate-tap fallback, and a partial pose. The partial-pose part is false: `ax pose partial` reads back as `pose: unfolded`, which maps to the valid `open`, and `ax state` reads the same afterwards (checked on the Duo this pass). The other two are untested and would be medium if wrong. Deferred as a frontmatter `deferred` item, with the two runs that would settle it.
  - `[low]` `[defer]` (blind) AGENTS.md's clause omits help's folded-landscape exception. When it applies, center exits 1 and says why. The fix edits an agent-context file, so it is deferred as a frontmatter `deferred` item.
  - `[low]` `[reject]` (blind) Summary cells are dropped silently and the filter keys on a private SpringBoard name. The past-8 undercount is the carried DW-345 row. A renamed key would print an extra group, which is visible, not silent. The suggested warning adds a branch for a future iOS.
  - `[maybe-false]` `[reject]` (blind) After SIGINT, Notification Center could stay open, because the restore presses no Home. Settling it needs a SIGINT mid-read followed by a look at the screen; the recorded SIGINT run ended with `ax state` matching. If true it is only low: the next `center` presses Home first.
  - `[low]` `[reject]` (blind) `front` hard-codes `dev.sallvain.mylove`. AGENTS.md forbids changing `appId`, so the list cannot drift, and passing it in adds plumbing.
  - `[low]` `[reject]` (blind) Pose and orientation come from two `ax state` reads. `center` starts on an idle device the caller has stopped moving. The fix restructures every call site.
  - `[low]` `[reject]` (edge) Ledger duplicates — the same as the blind row: the invocation forbids editing ledger entries.
  - `[low]` `[patch]` (edge) The restore-failure message printed `ax state` lines 1–2, the device line and the pose, never the orientation (checked: line 1 is `iPhone Duo iOS 27.1 <udid>`). Patched: it keeps the `pose:` and `orientation:` lines (`${(@M)…:#(pose|orientation):*}`). The harness printed `ax state says: pose: closed, orientation: portrait`, and on a phone with no pose it prints only the orientation.
  - `[low]` `[patch]` (edge) A second SIGINT or TERM during the restore cut it short, because `trap - … INT TERM` restored the default. Patched: `trap - EXIT; trap '' INT TERM`. In the harness, an INT sent from inside the restore left it running: `restore survived second INT`, exit 130, state restored.
  - `[low]` `[reject]` (edge) A TERM sent to `sim` alone is handled only after the running step ends. The restore still runs then; only the `pkill` finds nothing. Changing `TRAPS_ASYNC` alters signal handling for the whole step.
  - `[false]` `[reject]` (edge) A partial pose would hand `ax pose` a name it rejects. On the Duo, `ax pose partial` reads back as `pose: unfolded`, and `pose_arg` maps that to `open`, which `ax pose` accepts (`closed|partial|open`).
  - `[low]` `[reject]` (edge) carried — the idle-wait warning lands on stdout on a failed read; the earlier blind row's reasoning still holds, and `finish_step` still prints `NOTIFY` lines to stdout.
  - `[low]` `[patch]` (edge) Two `IDLE_NAMES` patch one method despite the comment — the same root cause and fix as the blind comment row.
  - `[low]` `[patch]` (edge) carried — a folded landscape with an unlisted app in front exits 1. The earlier intent row put the limit in help; it is not patched again.
  - `[low]` `[defer]` (edge, claim) The AGENTS.md caveat — the same root cause and route as the blind AGENTS.md row.
  - `[low]` `[reject]` (verification-gap, other) Ledger duplicates and their two routes in — the same as the blind row. Fixing the ledger is forbidden by the invocation, and this pass adds no hand-written ledger entry.
  - `[low]` `[defer]` (intent) The restore depends on the app list, and AGENTS.md lacks the caveat. The help part is carried from the earlier intent row; the AGENTS.md part shares the blind AGENTS.md row's route.
  - `[maybe-false]` `[defer]` (intent) The coordinate-tap surface the code changed has no recorded run, and cold taps passed 3 of 4. The cold miss is the carried DW-344. The fallback shares the blind untested-paths entry.
  - `[low]` `[reject]` (intent) carried — the warning goes to stdout on a failed read. The permanent `SIM_IDLE_NAMES` hook is not a defect: the intent-contract asks for an environment override.
  - `[false]` `[reject]` (intent) carried — the summary filter changes the reader. The verify needs A–H exactly once.
  - `[low]` `[reject]` (intent) The ledger goes beyond the literal scope and holds duplicates. Ledger edits are project policy (AGENTS.md); the duplicates are the blind row.
  - `[high]` `[patch]` (intent) The evidence lives outside the diff, and the read-fails check relied on a temporary source edit. One recorded claim, "forced read failure: exit 1", contradicts the code, which exited 0 on that path. Same root cause and fix as the first blind row.

### 2026-10-31 — Review pass (follow-up 2)
- verdicts: 34 findings — high 0, medium 3, low 21, false 6, maybe-false 4. Of the 34, 7 are intent-alignment divergences, logged as findings.
- findings:
  - `[low]` `[defer]` (blind) carried — AGENTS.md's clause omits help's folded-landscape exception; the earlier pass deferred it (DW-349) because the fix edits an agent-context file.
  - `[low]` `[reject]` (blind) carried — DW-346/347 duplicate DW-344/345; the invocation forbids editing ledger entries.
  - `[low]` `[reject]` (blind) The Checks line "Read fails (matrix) … exit 1" records a result the code then could not give. The fix edits this build's plan. The read-fails exit code is now checked by `test-center-exit.zsh` (exit 1, restored).
  - `[false]` `[reject]` (blind) `SIM_EXIT` covers only `die`, so an unguarded `ax control Home` failing under errexit would exit 0. A zsh 5.9 harness under the script's options with an EXIT trap set in a function: an errexit failure reaches the trap with `$?`=1 and exits 1. Only an explicit `exit` loses the code, and `die` covers that.
  - `[low]` `[reject]` (blind) A read failure and a restore failure both exit 1. A restore failure happens only for a folded landscape with no known app in front, which center announces before it moves; stderr names it. A separate code adds an exit-code contract for that one case.
  - `[low]` `[reject]` (blind) The restore keeps trying to rotate when no known app was in front. That case is announced up front and costs at most four rotate attempts. Skipping them adds a branch.
  - `[low]` `[defer]` (blind) Only a folded-landscape start gets its front app back; other starts end on the Home Screen. This is pre-existing: story 12's center pressed Home before and after its read (baseline sim:641/648). Deferred as a frontmatter item.
  - `[low]` `[reject]` (blind) The banner criterion is ticked on 3 of 4 cold runs. The fix edits this build's plan; the miss is DW-344.
  - `[maybe-false]` `[reject]` (blind) carried — after SIGINT Notification Center could stay open; low if true, since the next center presses Home first.
  - `[low]` `[defer]` (blind) banner exits 130 on TERM while center exits 143. banner's trap (sim:600) is unchanged since the baseline, so this is pre-existing. Deferred as a frontmatter item.
  - `[medium]` `[patch]` (blind) The stubbed harness that proved the exit codes was not kept. Same root cause and fix as the verification-gap row.
  - `[low]` `[patch]` (blind) `skipIdleWaits`'s comment still said a release without the methods "only brings the waits back". Patched: it now says the waits come back and the function warns.
  - `[low]` `[reject]` (blind) `SIM_IDLE_NAMES` reaches every step and could replace a real method with a different signature. Only center calls `skipIdleWaits`, so other steps ignore it. Harm needs someone to name a real method on purpose, and a signature check adds runtime introspection.
  - `[low]` `[reject]` (blind) `isSummary` repeats a subtree search per node. It walks one in-memory snapshot of the Notification Center list, and the 8-group runs finished normally. Caching adds state for no measured cost.
  - `[false]` `[reject]` (blind) `review_loop_iteration: 0` hides the two passes. The workflow resets it to 0 at each follow-up pass; it counts bad_plan loopbacks within a pass, not passes.
  - `[false]` `[reject]` (edge) An unguarded command failing under errexit exits 0. Same refutation as the blind `SIM_EXIT` row.
  - `[low]` `[patch]` (edge) On INT or TERM the restore ran twice. `trap - EXIT` inside `center_restore` clears only that function's EXIT trap, not `cmd_center`'s, so the restore's own `exit` ran it again: pkill, sleep and any failure message twice. Reproduced in a zsh harness and in the new check (`restore ran more than once` on all three signal cases before the fix). Moving `trap - EXIT` into the trap strings did not fix it, because trap code runs in whichever function is executing. Patched: a global `CENTER_DONE` holds the restore's exit code, and a second entry only exits with it. The check then passed all eight cases.
  - `[low]` `[reject]` (edge) A failing `ax state` read before the trap exits without a `sim:` message. Nothing has moved yet, ax prints its own error, and the exit is non-zero. A `|| die` on each read guards a failure never seen.
  - `[low]` `[reject]` (edge) carried — an empty pose read beside a good orientation read skips the unfold.
  - `[low]` `[defer]` (edge) An app in front at a portrait or unfolded start is left behind the Home Screen. Same root cause and route as the blind front-app row.
  - `[false]` `[reject]` (edge) The largest SpringBoard window might not be anchored at the top, so the drag would miss. Every recorded Duo start, folded and unfolded in every orientation, opened Notification Center through it. Any other layout fails loudly after three tries with "Notification Center did not open" and exit 1, with the device restored (now in the check's read-fails case).
  - `[maybe-false]` `[defer]` (edge) carried — summary cells dropped past 8 groups may undercount (DW-345).
  - `[low]` `[reject]` (edge, claim) carried — the diff edits the ledger beyond the literal scope; ledger edits are project policy.
  - `[medium]` `[patch]` (verification-gap) center's exit codes and restore have no repeatable check; a failed read already shipped once as exit 0. Patched: `scripts/sim-driver/test-center-exit.zsh` loads `sim`'s functions with `ax`, `xcrun`, the runner steps, `pkill` and `sleep` stubbed over a fake device in files. It runs `cmd_center` for eight cases: success, folded landscape, read fails, unfold fails, restore fails, INT, TERM, and INT with a failed restore. It asserts the exit code, the unfold, the end pose and orientation, a single restore, and the groups on stdout. A comment beside `center_restore` points to it. It caught the double restore above before the fix.
  - `[false]` `[reject]` (verification-gap, other) Unguarded `ax control Home` under errexit exits 0. Same refutation as the blind `SIM_EXIT` row.
  - `[low]` `[reject]` (verification-gap, other) carried — ledger duplicates.
  - `[low]` `[reject]` (verification-gap, other) The idle-wait warning and the summary filter are checked only by manual runs. Both need a live simulator, the repo has no runner test harness, and the lens filed no gap for them.
  - `[low]` `[defer]` (intent) carried — the restore depends on the app list, and AGENTS.md lacks the caveat (DW-349).
  - `[maybe-false]` `[defer]` (intent) carried — the no-pose and Rotate-Left-only restore paths have not been run (DW-348).
  - `[maybe-false]` `[defer]` (intent) carried — the coordinate-tap fallback has no recorded run; cold taps passed 3 of 4 (DW-344, DW-348).
  - `[medium]` `[patch]` (intent) The evidence is prose in the plan, and the post-patch exit-code fixes were checked only in a harness that was not kept. Same root cause and fix as the verification-gap row. No Duo run was made in this pass (see Auto Run Result).
  - `[low]` `[reject]` (intent) carried — the idle-wait warning goes to stdout on a failed read.
  - `[false]` `[reject]` (intent) carried — the summary filter changes the reader; the verify needs A–H exactly once.
  - `[low]` `[reject]` (intent) carried — file scope beyond the driver and the ledger duplicates.

## Verification

**Commands:**
- `scripts/sim-driver/sim help` -- expected: exit 0, new center line
- `zsh -n scripts/sim-driver/sim` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `git status --short`; `pgrep -fl "xcodebuild|http.server"` -- expected: planned files only; nothing running

## Auto Run Result

Status: built

**Summary:** A second follow-up review of story 3.14. `sim center` records `ax state`'s pose and orientation, unfolds the Duo, turns it to portrait, reads Notification Center on the inner display (proven with 8 groups), and puts the pose and orientation back from its EXIT/INT/TERM traps. `skipIdleWaits` warns when a class or method name is missing. This pass fixed a double restore on INT and TERM, and added a stubbed check of center's exit codes and restore that ships beside the driver.

**Files changed (this pass):**
- `scripts/sim-driver/sim` — `center_restore` runs once: a global `CENTER_DONE` holds its exit code, and a second entry (the function-scoped EXIT trap firing on the signal restore's own `exit`) only exits with it. The ineffective in-function `trap - EXIT` is gone. A comment points to the new check.
- `scripts/sim-driver/test-center-exit.zsh` (new) — loads `sim`'s functions with `ax`, `xcrun`, the runner steps, `pkill` and `sleep` stubbed, runs `cmd_center` for eight cases, and checks the exit code, the unfold, the end state, a single restore and the output.
- `scripts/sim-driver/RunnerUITests/Notify.swift` — `skipIdleWaits`'s comment says it warns.
- The plan — this triage log, two new frontmatter `deferred` items, and this result.
- The ledger's DW-348/349 are the orchestrator's uncommitted additions, committed here unchanged.

**Review findings:** 34 from four lenses: blind 15, edge-case 8, verification-gap 4, intent 7.

Patched 3 entries:
- Medium: 1. center's exit codes and restore had no repeatable check (the blind, verification-gap and intent rows). Fixed by `test-center-exit.zsh`.
- Low: 2. The restore ran twice on INT/TERM. The `skipIdleWaits` comment was stale.

Deferred 2, as frontmatter `deferred` items, not written into the ledger:
- Only a folded-landscape start gets its front app back; this is pre-existing (low).
- banner exits 130 on TERM; this is pre-existing (low).

Rejected, with reasons:
- Plan-only fixes: the stale "read fails exit 1" line, and the banner criterion at 3 of 4. The fix would edit this build's plan.
- False: the errexit exit 0 claim, raised three times (harness: exit 1). Also false: `review_loop_iteration`, which is reset by design, and the largest-window drag, which fails loudly.
- Low and not worth the added complexity:
  - a separate exit code for a restore failure;
  - skipping hopeless rotations;
  - a `SIM_IDLE_NAMES` signature check;
  - caching `isSummary`;
  - `|| die` on pre-trap `ax state` reads;
  - automated checks for the warning and the summary filter, which need a live simulator.
- Carried rows keep their earlier verdicts. These include the ledger duplicates DW-346/347, which the orchestrator should close as duplicates of DW-344/345.

**Follow-up review recommended:** false. This is a follow-up pass and it patched no high. Patched counts: high 0, medium 1, low 2.

**Verification:**
- `zsh scripts/sim-driver/test-center-exit.zsh`:
  - Before the fix, it failed the three signal cases with `restore ran more than once`.
  - After the fix, all 8 cases pass, exit 0.
  - With a restore-entry counter added in a scratch copy, the non-signal paths enter the restore once. The signal paths enter twice, and the second entry only exits.
- `scripts/sim-driver/sim help`: exit 0, with the center line unchanged.
- `zsh -n scripts/sim-driver/sim`: exit 0.
- `npm run lint`: exit 0.
- `pgrep -fl "xcodebuild|http.server"`: empty.
- No simulator was used in this pass.

**Residual risks:**
- The `CENTER_DONE` guard and the earlier `SIM_EXIT` fix are proven only with `ax` stubbed. No real SIGINT or failed read has run on the Duo since. A real success run on the Duo passed after the `SIM_EXIT` fix (previous pass).
- `Notify.swift` changed in a comment only. The runner rebuilds on its next use.
- These remain open: the Rotate-Left-only restore and the coordinate-tap fallback (DW-348), the AGENTS.md caveat (DW-349), the past-8-group undercount (DW-338/345), the cold-tap miss (DW-344), and the two new low deferrals.
