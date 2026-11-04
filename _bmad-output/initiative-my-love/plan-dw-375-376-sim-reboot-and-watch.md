---
title: 'sim reboot and sim watch: the two driver steps a reminder firing check lacks'
type: 'feature'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '3f036bd3f8ebf3f54a1844ebb6aedbf3254e93a2'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

> **History, not a template.** This file moves a device clock (the Mac's or the iPhone's), which AGENTS.md now forbids (`5013b869`): an iOS simulator reads the Mac's clock and has none of its own. Test time-based behaviour with fake time in unit tests for the reminder planning, `sim pending` for what the shell has scheduled and when, and a notification scheduled a minute or two ahead with `sim watch` for delivery (DW-443).

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A local reminder firing check on the simulator needs two steps the sim driver (`scripts/sim-driver/sim`) lacks. DW-375: the simulator ignores a Mac clock jump until it is rebooted, and story 4.8 rebooted it by hand after every jump. DW-376: `sim banner FILE --front` sends a push before it watches, so it cannot watch for a local notification that fires on its own (a 9:00 reminder) while the shell is in front.

**Approach:** Add `sim reboot`, which shuts the simulator down and boots it again, returning once it has finished booting. Add `sim watch [--front] [--for SECONDS] [--host]`, which puts Settings in front (or, with `--front`, the app itself), sends nothing, and waits up to SECONDS (default 120, at most 3600) for the app's banner. It prints when the watch started and when the banner appeared, so a check can show the watch spanned the firing time. A banner exits 0; no banner prints `no banner` and exits 1, the same as `sim banner`.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 80 lines across the driver script, the Notify runner step and the ledger, all following patterns already in `sim` (argument checks before `require_booted`, `stage` for simctl calls, `notify` for a runner step).

- Files: `scripts/sim-driver/sim` (help, `cmd_watch`, `cmd_reboot`, dispatch, header), `scripts/sim-driver/RunnerUITests/Notify.swift` (`watch SECONDS [front]` step reusing `banner` with a timeout and time-stamped lines, `clock()`), and the ledger (DW-375 done; DW-376 left open, its reason now naming `sim reboot` and `sim watch --front` and why `sim banner --front` does not fit: it pushes FILE and watches 20 s).
- `watch` runs in the foreground, unlike `banner`: nothing has to happen after the watch starts, so there is no "watching" poll. Its stamped lines use the simulator's clock, not the Mac's, since that is the clock a reminder fires by.
- Surprise: `${(%):-%D{...}}` ends at the format's own `}`, which left a stray brace in `reboot`'s message; it now uses `print -P`.
- Live runs (iPhone Duo, iOS 27.1, 2026-11-02): `sim reboot` exit 0 in about 6 s, device booted. A 40 s interval request on the host, then `watch --host --for 120`: watching from 01:19:00, banner at 01:19:25 with the probe title, exit 0. `watch --host --for 15` with nothing due: `no banner`, exit 1. `watch --front --host` across a second 40 s request: `no banner`, exit 1, and `pending --host` was then `[]`, so it fired; the host app sets no `UNUserNotificationCenterDelegate`, and iOS shows no banner for an app in front without one. A positive `--front` result needs the shell, whose local-notifications plugin presents in the foreground; that run is DW-376's check itself.
- Correction after review: the stamps are the Mac's time, not a separate simulator clock. A simulator process reads the host clock; what lags after a jump is the notification scheduler, until `sim reboot`. The comment and help text now say so.

## Review Triage Log

Quick review, pass 1: 1 medium, 4 low, 0 false, 0 maybe-false.
- medium, patch: `clock()`'s comment, the `watch` help and the plan note called the stamp the simulator's own clock; a simulator process reads the Mac's clock, and what lags after a jump is the scheduler. Comment, help and plan note corrected.
- low, patch: `DateFormatter` had no POSIX locale, so a 12-hour setting could rewrite `HH`; `en_US_POSIX` set.
- low, patch: DW-375's resolution sat in its `status:` line; split into a bare `status:` and a `resolution:` line, as the ledger header asks.
- low, defer (DW-385): AGENTS.md's sim-driver paragraph does not name `sim reboot` or `sim watch`; an agent-context edit, so deferred.
- low, patch: the edit dropped one space from the `center` line of Notify.swift's header; restored.
- low, patch: a watch started just before the due time can miss the banner (runner start plus the 20 s wait for an earlier banner to clear); the `watch` help and DW-376's recipe now give the lead time.

## Verification

**Commands:**
- `zsh -n scripts/sim-driver/sim` -- expected: no output, exit 0
- `scripts/sim-driver/sim help | grep -E '^  (reboot|watch)'` -- expected: both commands listed
- `scripts/sim-driver/sim reboot now; scripts/sim-driver/sim watch --for 0; scripts/sim-driver/sim watch --for 3601; scripts/sim-driver/sim watch --tap` -- expected: each exits 2 with a usage message, before any simulator lookup
- `zsh scripts/sim-driver/test-pending.zsh && zsh scripts/sim-driver/test-center-exit.zsh` -- expected: both pass unchanged
- Live, on the booted iPhone Duo simulator: `sim reboot` -- expected: exit 0, and `xcrun simctl list devices booted` lists the device
- Live: with host permission granted, `sim schedule` a file holding one 40 s interval request, then `sim watch --host --for 120` -- expected: a `watching from` line, then `banner at` with the request's title, exit 0
- Live: `sim watch --host --for 15` with nothing scheduled -- expected: `no banner`, exit 1
