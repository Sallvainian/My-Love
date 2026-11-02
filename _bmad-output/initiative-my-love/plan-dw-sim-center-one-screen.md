---
title: 'sim center reads one screen only, reports summary cells, logs the tap fallback'
type: 'chore'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'c270f65d0461919125c1da66360d8ffe5671b5a6'
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
      A failed center's restore skips its "could not restore" report: when die's exit (nested below cmd_center) runs center's EXIT trap, zsh 5.9 ends the trap as soon as a function it calls directly returns.
    evidence: >-
      Reproduced in plain zsh 5.9: with `f() { trap restore EXIT; die; }` and `die() { exit 1; }`, `restore() { inner || print report; print after; exit 7; }` runs inner's whole body, then stops (exit 1, no "report", no "after"); with `exit 1` called in f directly it prints both and exits 7. In sim, center_restore's only direct function call is `rotate_to` (sim:824), so a failed read still turns the device back, but a restore failure on that path is never reported and CENTER_DONE is never set. In test-center-exit.zsh ax, xcrun and sleep are stub functions, so a failed read's restore stops at its first stubbed call; a phone read-fails case starting in landscape ended in portrait for that reason and was left out. Fix: call rotate_to in a subshell, `( rotate_to $CENTER_ORIENT )`, and make the stubbed restore checkable.
    location: scripts/sim-driver/sim (center_restore, die); scripts/sim-driver/test-center-exit.zsh
    severity: low
  - summary: >-
      center's one-screen check (no stacked cell left, and neither a drag nor a swipe down the list moves a cell) has not been run on a simulator.
    evidence: >-
      The drag-then-swipe sequence is the one every passing 8-group run ended on, and those runs printed no extra stacked-cell group, so neither check should fire at 8 groups; a run with 8 groups (exit 0) and one with more than fit (exit 1 with the message) would prove it. Needs the Duo simulator, like DW-403.
    location: scripts/sim-driver/RunnerUITests/Notify.swift (center)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `sim center`'s multi-screen scroll-and-merge path in `scripts/sim-driver/RunnerUITests/Notify.swift` has never run and can merge, split or cut short groups (DW-338); it drops "+N from <app>" summary cells silently, so an undercount past one screen would be quiet (DW-345); and `tap(_:)`'s display-coordinate fallback logs nothing while `test-center-exit.zsh` never stubs a Rotate-Left-only phone, so neither path can be shown to work (DW-348, code half). The owner decided on 2026-11-02 that `center` reads one screen only.

**Approach:** Remove the 30-screen loop and `merge`; after expanding stacked cells and reading the one screen, exit non-zero with a clear message when a stacked group is still unexpanded or when a drag (then a fast swipe, the list's existing end test) moves any cell. Report each summary cell as a `warning:` line instead of dropping it. Make `tap(_:)` emit a `note:` line when it falls back, route `note:` lines to stderr in `cmd_center` like `warning:`, add a Rotate-Left-only, no-fold phone stub with cases to `test-center-exit.zsh`, and update `sim help`'s center entry. AGENTS.md and the simulator runs (DW-403) stay out.

</intent-contract>

## Implementation Notes

Oneshot: about 100 changed lines in three files under `scripts/sim-driver/` (`RunnerUITests/Notify.swift`, `sim`, `test-center-exit.zsh`), investigated in full while planning; no app code.

Decisions:
- "More than fits" = a stacked ("Grouped") cell still present after the expansion taps (it would be read as one notification — DW-338's unreachable-stack fault), or the list's cell frames change after one slow drag up, or after the fast swipe the old loop used at the list's end (the shrunk pile at the end opens only to a swipe). This is the same drag/swipe sequence every passing 8-group run ended on, and story 3.14 found no stacked cell left after expansion (it would have printed as an extra group), so neither check should fire on the proven one-screen case. A live run is still needed to prove it; that stays with the owner/DW-403.
- The summary report is a stderr `warning:` line naming the summary's text; the JSON stays `{"groups":[{text,count}]}`, so the 8-group A–H check is unchanged.
- The fallback line is `note:`-prefixed so it reaches stderr and never mixes into the one JSON line on stdout.

Implementation:
- `Notify.swift`: 30-screen loop and `merge` removed; `center` expands stacked cells, fails if any remain, reads once, warns per summary cell, then fails if a slow drag or a swipe moves any cell; `screenGroups` returns `(groups, summaries)`, using the summary phrase's label (else the cell's); `tap(_:)` says a `note:` line with the cell's label and centre before a coordinate tap.
- `sim`: `cmd_center` routes `note:` lines to stderr beside `warning:`; the help's center entry and `cmd_center`'s comment state the one-screen limit, exit 1, the summary warning and the tap note.
- `test-center-exit.zsh`: START_POSE `none` stubs an iPhone 17 (no pose line, controls Home + Rotate Left, `ax pose`/`ax rotate` fail); `turn` handles both directions; the signal fires on the Home press only (as the header always said), so a phone's Rotate Left presses do not take it; every case records the orientation the read ran in and must read in portrait; three phone cases (landscapeLeft, landscapeRight, SIGINT). A Rotate-Right-only mutant of `cmd_rotate` fails all three.
- Surprise: a phone read-fails case from landscape ended in portrait. The cause is zsh, not the stub's logic: an EXIT trap reached through `die`'s nested `exit` ends once a function it calls returns (reproduced in plain zsh). Left out with a comment and deferred (frontmatter), since fixing `center_restore` is outside this bundle.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 4, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` On a failed read, `cmd_center`'s `finish_step Notify center $code` printed the runner's `warning:`/`note:` lines raw on stdout, contradicting the new help ("reported on stderr") — patched: that call now writes to stderr (`>&2`), so stdout only ever carries the JSON line; the test's read-fails case checks it.
  - `[low]` `[patch]` The tap note and the summary text embedded element labels unflattened; `say` prefixes only the first line with `NOTIFY `, so the rest (the tap's coordinates) was dropped, as `banner` already guards against at Notify.swift:144 — patched: both replace `\n` with ` | ` as `banner` does.
  - `[low]` `[patch]` The rewritten `center` comment dropped that the end-of-list swipe can close Notification Center, though the swipe is still the final check — patched: the comment says so, and that the read then fails.
  - `[low]` `[patch]` No test case exercised the new `note:` routing — patched: the `notify center` stub emits a `note:` and a `warning:` line (and the failed read logs a `NOTIFY note:` line); every case that reads checks neither reaches stdout and the note reaches stderr. Mutants without the `note:*` branch or without the failure-path `>&2` fail the check.
  - `[false]` `[reject]` The deferred-work ledger is not updated (DW-338/345/348 left open, new deferrals only in frontmatter) — the invocation says "Do NOT edit the deferred-work ledger; the orchestrator records resolution", and this plan's frontmatter `deferred` list is the channel for the two new items.

## Verification

**Commands:**
- `zsh scripts/sim-driver/test-center-exit.zsh` -- expected: every case `ok`, including the new phone cases, exit 0
- `zsh -n scripts/sim-driver/sim && zsh -n scripts/sim-driver/test-center-exit.zsh` -- expected: no syntax errors
- `xcodegen` + `xcodebuild build-for-testing -destination 'generic/platform=iOS Simulator'` on a scratch copy of `project.yml`, `Runner`, `RunnerUITests` -- expected: `** TEST BUILD SUCCEEDED **`

**Manual checks (if no CLI):**
- `sim help` shows the one-screen limit, the non-zero exit, and the summary warning in the center entry.

## Auto Run Result

Status: built

**Summary:** `sim center` now reads one screen only. The 30-screen scroll-and-merge loop and `merge` are gone; after expanding stacked cells it fails (exit 1, "Notification Center holds more <app> notifications than fit on one screen, and center reads one screen only …") when a stacked group is left unexpanded or a slow drag or the end-of-list swipe moves any cell. Each "+N from <app>" summary cell is reported as a stderr warning instead of being dropped. `tap(_:)` notes each display-coordinate fallback on stderr with the cell's label and centre. `test-center-exit.zsh` gains a Rotate-Left-only, no-fold phone stub (iPhone 17) with three cases, a read-in-portrait check and note-routing checks. `sim help`'s center entry is updated. AGENTS.md and the simulator runs (DW-403) are untouched.

**Files changed:**
- `scripts/sim-driver/RunnerUITests/Notify.swift` — one-screen read with fail-on-more, summary warnings, fallback-tap note, `merge` removed.
- `scripts/sim-driver/sim` — `note:` lines routed to stderr; a failed read's lines go to stderr; help and comment state the one-screen limit.
- `scripts/sim-driver/test-center-exit.zsh` — phone stub (START_POSE `none`), two-way `turn`, signal on the Home press only, portrait-read and stderr-routing checks, three phone cases.
- `_bmad-output/initiative-my-love/plan-dw-sim-center-one-screen.md` — this plan.

**Review:** quick lens, 5 findings: 4 low patched (failure-path stdout routing, unflattened labels, dropped swipe caveat in the comment, untested note routing), 1 false rejected (ledger edit forbidden by the invocation). Patched counts by verdict: high 0, medium 0, low 4. Deferred (frontmatter): the zsh EXIT-trap early end on die paths (low), and the one-screen check's missing simulator run (low).

**Follow-up review recommended:** false — no high and fewer than two medium patches.

**Verification:**
- `zsh scripts/sim-driver/test-center-exit.zsh` — 11/11 ok, exit 0. Mutants fail as they should: a Rotate-Right-only `cmd_rotate` fails all three phone cases; dropping the `note:*` branch fails the five reading cases; dropping the failure-path `>&2` fails read-fails.
- `zsh -n` on `sim` and the test — clean.
- `xcodegen` + `xcodebuild build-for-testing -destination 'generic/platform=iOS Simulator'` on a scratch copy of the runner — `** TEST BUILD SUCCEEDED **`; the only Notify.swift warning is the existing `where` clause at line 69.
- `sim help` — the center entry shows the one-screen limit, exit 1, the summary warning and the tap note.

**Residual risks:** nothing here ran on a simulator. The one-screen check reuses the drag-then-swipe end test every passing 8-group run ended on, and those runs left no stacked cell (it would have printed as an extra group), so 8 groups should still exit 0; a run at 8 groups and one past them would prove it. On a die path, zsh ends center's EXIT trap once `rotate_to` returns, so a failed restore after a failed read goes unreported (deferred).

