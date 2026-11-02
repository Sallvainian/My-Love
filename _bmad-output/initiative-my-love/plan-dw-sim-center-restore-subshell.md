---
title: 'DW-404: center reports a failed restore when die ends it'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'f152985361e2c6c76432ee1bf7ccfff6c2a649cf'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** When `die`'s exit (nested below `cmd_center`) runs center's EXIT trap, zsh 5.9 unwinds the trap as soon as a function it calls directly returns, so `center_restore` stops after `rotate_to` (`scripts/sim-driver/sim`, center_restore) and never prints "could not restore" or sets `CENTER_DONE`. The test (`scripts/sim-driver/test-center-exit.zsh`) stubs `ax`, `xcrun`, `sleep` and `pkill` as functions, so on that path its restore stops at the first stub and no read-fails case starting in landscape could be checked.

**Approach:** Run `( rotate_to $CENTER_ORIENT )` in a subshell, as DW-404 proposes, and decide `bad` from a fresh `$(state_value orientation)` read afterwards, because on the die path the subshell's exit status is also lost (it comes back 0; reproduced in plain zsh 5.9). In the test, make the stubs executables on `PATH` so the restore runs to its end, and add read-fails cases starting in landscape, one whose turn back fails, asserting the report line and the exit code.

</intent-contract>

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/sim-driver/sim` -- in `center_restore` replace `rotate_to $CENTER_ORIENT 2>/dev/null || bad=1` with the subshell call plus an orientation re-read setting `bad`; comment why (the zsh unwind, and the lost subshell status) -- the report and `CENTER_DONE` are reached on every path.
- [ ] `scripts/sim-driver/test-center-exit.zsh` -- write `ax`, `xcrun`, `sleep`, `pkill` stubs as scripts into a `PATH` dir reading the fake device and faults from exported variables; add a `TURN_BACK_FAILS` fault (`ax rotate`/`Rotate Left` fail once the read happened); assert the "could not restore" line appears exactly once when a restore fault is set and never otherwise; add cases `read-fails-landscape`, `read-fails-turn-back-fails` (both `closed landscapeLeft`, exit 1) and `turn-back-fails` (exit 1); drop the comment explaining the missing case.

**Acceptance Criteria:**
- Given a center whose read fails starting folded in landscape, when the test runs, then it ends folded in landscapeLeft with exit 1 and no report line.
- Given that read failure plus a failed turn back, when the test runs, then stderr carries exactly one "could not restore" line and the exit code is 1.
- Given the old `rotate_to … || bad=1` or the literal `( rotate_to … ) || bad=1`, when the test runs, then `read-fails-turn-back-fails` fails (red check).

## Implementation Notes

Oneshot: two files, about 60 changed lines, all in shell scripts that run without a simulator.

- Reproduced in plain zsh 5.9 before changing anything: on the die path, `( f ) || report` never reports, because the subshell's status comes back 0 whatever `f` returned. The literal fix `( rotate_to … ) || bad=1` would therefore never set `bad`, so `bad` is decided by reading the orientation again in a command substitution, which works on that path. An external command's failure status (`/usr/bin/false || …`) does survive there, so `ax pose … || bad=1` and `xcrun … || bad=1` stay as they are.
- The test's `ax`, `xcrun`, `pkill` and `sleep` are now executables in `$TMP/bin` on `PATH`, reading the fake device from `$DEV` and the faults from exported variables; `notify`, `require_booted` and `ensure_runner` stay functions, since the restore never calls them.
- Red check: with the old line and with the literal subshell line, `read-fails-turn-back-fails` fails ("reported 0 times"); with the old line, `read-fails-fold-fails` fails too.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 3 findings — high 0, medium 1, low 2, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` A `TURN_BACK_FAILS` case skipped the end-state check, so a die-path regression that never folds back would pass — fixed: the pose is checked unless `FOLD_FAILS` is set, and the orientation unless `TURN_BACK_FAILS` is set.
  - `[low]` `[patch]` No case covered a fold failure on the die path (the reviewer left open whether an external command's status survives there; a plain zsh 5.9 check showed it does) — fixed: added `read-fails-fold-fails`, which is red on the old code and green on the fix.
  - `[low]` `[patch]` The phone read-fails case that starts in landscape, named in DW-404, was missing — fixed: added `phone-read-fails` (`none landscapeRight`, exit 1), which turns back through `cmd_rotate`'s Rotate Left loop.

## Verification

**Commands:**
- `zsh scripts/sim-driver/test-center-exit.zsh` -- expected: every line `ok`, exit 0.
- `zsh -n scripts/sim-driver/sim` -- expected: exit 0.

## Auto Run Result

Status: built

**Summary:** `center_restore` now runs `rotate_to` in a subshell and sets `bad` from a fresh orientation read. When die's exit runs center's EXIT trap, the restore reaches its "could not restore" report and `CENTER_DONE`. `test-center-exit.zsh` stubs `ax`, `xcrun`, `pkill` and `sleep` as scripts on `PATH`, so a failed read's restore runs to the end under test, and five cases were added.

**Files changed:**
- `scripts/sim-driver/sim` — `center_restore`: runs `( rotate_to $CENTER_ORIENT )`, then re-reads the orientation to decide `bad`, with a comment explaining the zsh unwind.
- `scripts/sim-driver/test-center-exit.zsh` — the stubs are now `PATH` executables; adds the `TURN_BACK_FAILS` fault; exact report-line and end-state assertions; new cases `turn-back-fails`, `read-fails-landscape`, `read-fails-turn-back-fails`, `read-fails-fold-fails`, `phone-read-fails`.

**Review:** quick lens, 3 findings, all patched (1 medium, 2 low); none deferred or rejected.

**Follow-up review recommended:** false — first pass, patched counts: high 0, medium 1, low 2.

**Verification:** `zsh scripts/sim-driver/test-center-exit.zsh` passed all 16 cases with exit 0, and three runs before review were all ok. `zsh -n scripts/sim-driver/sim` exits 0. Red check: against the old line and the literal `( rotate_to … ) || bad=1`, the new die-path cases fail as described in Implementation Notes.

**Residual risk:** this was not run on a simulator. The fix rests on zsh 5.9 behaviour reproduced in plain scripts and on stubbed commands; the real `ax`, `xcrun` and `sleep` are external commands, which is what the stubs now are.
