---
title: 'Refactor sweep'
type: 'chore'
ticket: '4'
created: '2026-10-31'
status: done
baseline_revision: 'b24912fbb27425a7ff3ac513473644905a213a5e'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      AGENTS.md's sim-driver line says concurrent Duo stories may each run in their own worktree on their own simulator clone, but the driver's `ax` commands may reach only the device Device Hub's window shows, so a concurrent run could pose, rotate or read the wrong clone.
    evidence: |-
      Story 9's residual risks say a non-Duo phone is reachable by ax only while Device Hub's window shows it, and sim never selects --device's window (DW-334); pose, rotate, state, background and screenshot all go through ax. The "each on its own xcrun simctl clone" wording predates this change (story 9); story 4 split the work dir per checkout, which removes the shared-files clash only. Unverified: whether Device Hub can show two device windows at once and ax then drives each by --device. Settle it by booting a clone beside the Duo, opening both in Device Hub, and running `sim --device <clone> rotate` while the Duo's window is in front; if the clone does not rotate, AGENTS.md's line must say one Duo story at a time until DW-334 is fixed. The fix edits AGENTS.md, so it is deferred.
    location: >-
      AGENTS.md, Maintained by hand (the sim-driver line); scripts/sim-driver/sim (cmd_rotate and the ax calls)
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Stories 7, 9, 2 and 8 left deferred findings in their plans and the ledger: the sim driver's shared work dir (DW-329, duplicated as DW-330), `sim signin` typing onto leftover field text (DW-332), story 8's clause inside AGENTS.md's managed block (DW-333), the small one-sided inset outside iOS (DW-331), plus plan residual risks (`stack_secret` reads `supabase status` in the caller's directory; the driver cannot switch Device Hub's window to a non-Duo phone; story 9's frozen intent contract names the two fictional fixture emails).

**Approach:** Cleanup only, no product behaviour change: fix DW-329/330 by keying the driver's default work dir on the checkout it runs from (two stories in two worktrees on two clones never share a stage, runner, log or `serve.pid`; an explicit `SIM_DRIVER_WORK` is still used as is); make `signIn` clear each field before typing and have `drive` print the log's tail when it finds no assertion line, so a first-try failure is diagnosable; run `supabase status` from the repo; replace AGENTS.md line 27's Settings clause with a pointer to the hand-maintained dock paragraph (DW-333) and update the sim-driver line for the per-checkout work dir. DW-331 changes the column rule on unmeasured devices, so it stays open in the ledger; the Device Hub window switch and the frozen-contract emails are recorded as new ledger entries. No native code changed in stories 7, 9, 2 or 8 (`git diff --stat fc3d0ed6 HEAD -- ios capacitor.config.ts` is empty), so no App-scheme Xcode build is owed; the driver's runner project is built.

</intent-contract>

## Implementation Notes

Oneshot: about 60 changed lines across `scripts/sim-driver/sim`, `scripts/sim-driver/RunnerUITests/Drive.swift`, `AGENTS.md` and the ledger, all tooling or prose.

Run 2026-10-31 on the iPhone Duo simulator (iOS 27.1, `A0A486ED…`), local stack; every device command through `scripts/sim-driver/sim`.

- **Work dir (DW-329/330).** Default is `~/Library/Caches/my-love-sim-driver/${REPO:t}-<first 8 hex of shasum of REPO>`; this worktree's is `2.4-6b61fc14`. `sim build` ran `npm-ci` there (first use) and installed in 36 s; `sim dump` regenerated and built the runner under it. The old shared folders at the cache root (`stage/`, `runner/`, `derived/`, `logs/`, `serve/`, about 1.6 GB) and a UDID-named folder from another session were left untouched: deleting them is the owner's call.
- **Sign-in retry (DW-332).** Deleting keystrokes after a tap at the field's right end was tried first and failed: the baseline's garbled email (about 50 characters) overflows the 359 pt field, the tap lands mid-text, and the deletes left the fixture email with a second copy of its domain's ending. Switched to relaunching the shell (`app.terminate()`, `app.activate()`) when either field holds text other than its placeholder; an empty field reports its placeholder (the form's email and password placeholders), so a fresh form is never relaunched. Readings: wrong-password step (exit 65, "Invalid email or password") then `sim signin` → `relaunched the shell to empty the login form`, `signed in`, exit 0; the same sequence with `HEAD`'s Drive.swift → "Invalid email or password", exit 1; over the garbled form → relaunched, exit 0; fresh install → signed in first try, no relaunch. The unexplained first-try failure did not recur (four attempts straight after `sim build`). `drive` now prints the log's `error:`/`XCTAssert` lines, or its last 15 lines when there are none (checked on sample logs and on a real `signin` while signed in, which printed the assertion).
- **`stack_secret`.** Runs `supabase status` in `$REPO`: `sim provision` from the session scratchpad exited 0 and seeded; `supabase status -o env` there gives no `SECRET_KEY`, which is what failed before.
- **AGENTS.md.** Line 27 points to the dock paragraph instead of stating where Settings sits (DW-333); the sim-driver line names the per-checkout work dir, `SIM_DRIVER_WORK`, a clone and `serve-update` port per concurrent story, and that a removed worktree's folder can be deleted.
- **Ledger.** DW-329, DW-330 (duplicate), DW-332, DW-333 resolved; DW-331 left open (changing the column rule on unmeasured devices is not cleanup); DW-334 (Device Hub window switching, story 9 and 2 residual risk) and DW-335 (fixture emails in story 9's frozen intent contract, the owner's call) appended. Story 7's out-of-scope update flow is already `_bmad-output/backlog/story-native-shell-live-update-prompt.md`.
- **End state.** The Duo holds the working tree's shell (web code unchanged from `HEAD`), signed in as the first fixture account; no `dist/` or `ios/App/App/public/` in the repo; no update server.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test:unit` -- expected: exit 0 (worktree TS2883 baseline excepted)
- `zsh -n scripts/sim-driver/sim`; `scripts/sim-driver/sim help` -- expected: exit 0
- On the booted Duo simulator: `sim provision`, `sim build`, a `drive signin` with a wrong password (fails, leaving both fields filled), then `sim signin` -- expected: the second sign-in exits 0, so leftover text is cleared; the runner project regenerates and builds under the per-checkout work dir
- `ls dist ios/App/App/public 2>/dev/null`; `pgrep -fl "http.server|wrangler"` -- expected: nothing
- Ledger: DW-329, DW-330, DW-332, DW-333 carry `status: done 2026-10-31` with a resolution; DW-331 stays open; two new entries appended

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 7 findings — high 0, medium 0, low 3, false 3, maybe-false 1
- findings:
  - `[false]` `[reject]` Drive.swift relaunches instead of "clearing each field before typing", so the intent contract no longer matches — the contract asks that each field be cleared before typing, and the relaunch does exactly that (a dump after it shows both fields at their placeholders); it names no method. The only other remedy is rewording this build's intent contract, which triage never does.
  - `[low]` `[patch]` The relaunch also swaps in a live update the shell has queued (`src/services/nativeUpdates.ts:7-8`), silently, in story 9's `--from REV` + `serve-update` setup — verified; it needs a failed sign-in while an update is queued. Patched: the comment and the `say` line now state it (`relaunched the shell to empty the login form (a queued live update swaps in now)`).
  - `[maybe-false]` `[defer]` AGENTS.md's concurrent-clone line conflicts with DW-334 (`ax` may reach only the device Device Hub's window shows) — the wording predates this change; whether Device Hub shows two windows that `ax --device` drives separately is unmeasured; settle by rotating a clone while the Duo's window is in front. Medium if true; the fix edits AGENTS.md, so deferred to frontmatter `deferred`.
  - `[low]` `[patch]` DW-334 says stories 2 and 8 switched Device Hub's window, but only story 2's plan records it — verified (story 8's plan never mentions Device Hub). Patched: DW-334 now says story 2 switched it and story 8 used the iPhone 17 in portrait only.
  - `[false]` `[reject]` The ticket's verify is unmet because story 9's "Realtime not exercised" and story 8's AC 4 wording are neither fixed nor recorded — neither is a deferred finding: story 8's triage rejected AC 4 as pre-existing and harmless (the wordmark group is 0.0 pt off centre), and story 9's line records a check not run, not a defect. Noted under Residual risks below.
  - `[low]` `[patch]` The orphaned root-level cache folders were deferred only in the plan's notes, against AGENTS.md's ledger rule — verified: this change orphaned them and no ledger entry named them. Patched: DW-336 appended with the folders, their size and the safe delete.
  - `[low]` `[reject]` The plan's Verification names `drive signin`, which `sim` cannot run, and records no command to repeat the wrong-password step — true, but the fix edits this build's plan; the exact command is given in the Auto Run Result's Verification below.

## Auto Run Result

Status: built

**Summary:** The sweep closed the deferred findings from stories 7, 9, 2 and 8 that cleanup can fix, and recorded the rest in the ledger. `scripts/sim-driver/sim` now keeps a work dir per checkout, so two stories in two worktrees never share a stage, runner, log or `serve.pid` (DW-329, plus its duplicate DW-330). `sim signin` now relaunches the shell when the login form still holds an earlier attempt's text, so a retry types into an empty form (DW-332). `drive` prints the log's tail when a failed step has no assertion line. `sim provision` now reads the stack's secret from the repo, whatever directory it is called from. AGENTS.md's view-registration line points to the hand-maintained dock paragraph and no longer states where Settings sits itself (DW-333). No native code changed in any of the four stories, so no App-scheme Xcode build is owed; the driver's runner project was built several times.

**Files changed:**
- `scripts/sim-driver/sim` — per-checkout default work dir, `drive` failure output, `stack_secret` runs in the repo, header and usage text.
- `scripts/sim-driver/RunnerUITests/Drive.swift` — `signIn` relaunches over leftover field text (`holdsText`).
- `AGENTS.md` — view-registration line's Settings clause replaced by a pointer (DW-333); sim-driver line names the per-checkout work dir and concurrent-run needs.
- `_bmad-output/initiative-my-love/deferred-work.md` — DW-329, DW-330, DW-332 and DW-333 resolved; DW-334, DW-335 and DW-336 appended.
- This plan.

**Review findings:** 7 from the quick lens.
- Patched 3, all low: the relaunch now says a queued update swaps in; DW-334's attribution corrected; DW-336 records the orphaned cache folders.
- Deferred 1 (maybe-false, medium if true): concurrent clone runs versus Device Hub's single window (frontmatter `deferred`).
- Rejected 3:
  - The intent contract's "clear each field" wording: false, because the relaunch clears them.
  - The verify gap: false, because the two cited items are not deferred findings.
  - The Verification wording: it can only be fixed by editing this plan.

**Follow-up review recommended:** false. This first pass patched high 0, medium 0, low 3.

**Verification:** run on the iPhone Duo simulator (iOS 27.1) with the local stack, after the patches.
- `npm run lint` exit 0. `npm run typecheck` exit 0. `npm run test:unit` exit 0: 203 files, 3210 tests.
- `zsh -n scripts/sim-driver/sim` and `sim help` both ok.
- `sim provision` exit 0, run from the repo and again from the session scratchpad.
- `sim build` exit 0 into `~/Library/Caches/my-love-sim-driver/2.4-6b61fc14`. The runner regenerated and built there.
- Wrong-password step, then `sim signin` → `relaunched the shell to empty the login form (a queued live update swaps in now)`, signed in, exit 0. The step was run as `TEST_RUNNER_ACTION="signin <first fixture email> wrong-password" xcodebuild test-without-building -project <work dir>/runner/src/SimDriver.xcodeproj -scheme RunnerUITests -destination id=<udid> -derivedDataPath <work dir>/runner/dd -only-testing:RunnerUITests/Drive/testDrive`; it exits 65 with "Invalid email or password".
- The same sequence with `HEAD`'s Drive.swift failed with "Invalid email or password".
- A `signin` while signed in printed the assertion line and exited 1.
- No `dist/` or `ios/App/App/public/` in the repo, and no update server running.

**Residual risks:**
- DW-331 (a small one-sided inset outside iOS) stays open: fixing it would change the column rule on devices nobody has measured.
- The first-try `signin` failure story 8 saw was not reproduced, so its cause is still unknown. `drive` now prints the log's tail when it happens.
- Concurrent clone runs may still collide through Device Hub's window (deferred above; DW-334).
- Story 9's partner Realtime in the shell and story 8's AC 4 wording were not checked here: neither is a deferred finding.
- The Duo simulator holds the working tree's shell, whose web code is unchanged from `HEAD`, signed in as the first fixture account.
- The old root-level cache folders are left for the owner (DW-336).
