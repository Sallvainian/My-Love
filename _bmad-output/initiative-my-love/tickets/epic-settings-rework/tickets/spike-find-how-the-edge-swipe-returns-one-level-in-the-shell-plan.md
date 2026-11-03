---
title: 'Find how the edge swipe returns one level in the shell'
type: 'chore'
ticket: '2'
created: '2026-11-02'
status: 'built'
baseline_revision: '1e4220c8875a27e42b7bd7381f1659c6b723af68'
route: 'oneshot'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/scripts/sim-driver/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** R2 needs the iOS shell's left-edge swipe to go back exactly one level through the Settings stack. Two ways to get it are open: WKWebView's own back-forward gesture (`allowsBackForwardNavigationGestures`, a Swift change that means a reinstall on both phones) or a web gesture on the page stack. Nothing yet says which one works against story 1's `pushState` entries, or whether story 15 can check the result on the simulator.

**Approach:** Add a `sim swipe back` command to the simulator driver: an XCUITest edge pan from the web view's left edge. Then try the native gesture in a trial shell on the simulator, using a Swift line and a Settings change that are both reverted afterwards. Push Settings subpages and switch between views, swipe, and record per entry whether it returns exactly one level, what the first entry does, and whether the dock and horizontal content still work. Then write a dated Decision, native or web, into the epic's Notes, with what was tried and seen and whether `sim swipe` exists.

**Decision (owner, 2026-11-02):** simulator first. Put a trial build on the Duo (build number 2, AGENTS.md procedure, never an uninstall) only if the simulator results are unclear.

</frozen-after-approval>

## Implementation Notes

Oneshot: the committed change is about 40 lines (the runner's swipe case, the `sim` dispatch, its help line, the README sentence) plus the epic's Decision. Most of the spike is the trial, and its code is never committed.

- Native hook: Capacitor 8.6.0's `CAPBridgeViewController` has no config option for the gesture (no `allowsBackForwardNavigationGestures` anywhere in `node_modules/@capacitor/ios`). The trial sets `webView?.allowsBackForwardNavigationGestures = true` in `MainViewController.capacitorDidLoad` (`ios/App/App/NativeAuth.swift:63`).
- The shell can't reach a Settings subpage yet: story 1's only one, Photos, is `available: canTellMobileData` (`src/components/Settings/Settings.tsx:539`), and iOS reports no connection type. The trial build makes Photos available, so `openSettingsPage` pushes run in the shell. View changes go through `setView`'s `pushState` with `inApp: true`, the same kind of entry.
- Runner: `scripts/sim-driver/RunnerUITests/Drive.swift` — add `case ("swipe", 2)` with `back`, a `press(forDuration:thenDragTo:)` from x≈1 to about 60% of the web view's width at mid-height, in web-view coordinates like `tap`. `scripts/sim-driver/sim` dispatch sits beside `scroll` (around line 1189), and the help line goes under Page.
- Simulator trial (unfolded portrait, bottom dock): the first pan settings (1 pt in, 0.05 s, default speed) never registered. Only a fast pan registered: 2 pt in, 0.01 s press, 1500 pt/s, to 60% width. Even that worked only about one pan in four, and on Settings' top page 24 in a row failed. Every pan that registered went back exactly one level (Photos to Settings, Settings to Mood, Partner to settings/photos, Mood to Home), and 10 on the first entry did nothing. Simulator results were unclear, so the trial went to the Duo (owner's earlier decision).
- Duo trial: the trial web code was built outside `dist/` with an unreachable update URL, copied into `ios/App/App/public/` and built with `CURRENT_PROJECT_VERSION=2`, then installed over the app with `devicectl` (no uninstall). Owner: every swipe went back one level, nothing odd, bottom dock and folded column form both fine. Restore: the trial edits reverted, main's web code (built in a throwaway main worktree) copied into `public/`, built with build number 1 and installed. No native file differs between main and `loop/integration`.
- So the synthesized pan is the flaky part, not the gesture. `sim swipe back` keeps the fast pan and repeats it until the page changes (up to 8 tries), comparing buttons plus the first three digit-free texts (Home's countdown ticks). Checked on the simulator: Photos to Settings on try 1.
- Decision written to the epic's Notes. The untried live-update back-list risk is DW-424, for story 15.
- `dist/` was never written. `ios/App/App/public/` now holds main's production build, which is what `ios:sync` from main gives. After review the simulator shell was rebuilt from the clean tree, so no trial shell is left.
- After review the signature uses texts only, with no buttons, and a page that never changes fails the step (exit 1). Checked: on the clean shell, which has no gesture, `sim swipe back` exits 1 with that message. Not re-run: the success path of the texts-only signature on a gesture-enabled shell. It narrows the version that went Photos to Settings, and the dumps show each page's first texts differ.

## Plan Change Log

## Review Triage Log

Quick review, 1 pass: 0 high, 6 medium, 2 low, 1 false.

- medium, defer (DW-425): Home's message card (`DailyMessage.tsx`, `drag="x"`) was never swiped from the edge. The Decision now says so.
- medium, defer (DW-425): the column side wasn't recorded on the Duo, so column-left is unverified. The Decision now says "which side was not recorded".
- medium, patch + defer (DW-425): the first-entry result rested on 1-in-4 synthesized pans. The Decision now treats it as weak evidence plus the code reason.
- medium, patch: a failure line read as success and exited 0. It now fails the step (exit 1), and the README and help say so.
- medium, patch: button labels changing without navigation would count as a swipe. The signature now uses digit-free texts only.
- low, patch: two identical consecutive entries can make one reported swipe go two levels. The README and the code comment now say so.
- low, patch: the Verification said the Notes "end with" the Decision, but it sits before the Source conflict line. The wording now says "hold".
- medium, patch: the trial shell was left on the simulator. It was rebuilt from the clean tree.
- false: the R16 Reduce Motion wording comes from commit 93225c2b, the owner's docs commit on `loop/integration` after the baseline, not this change.

## Verification

**Commands:**
- `scripts/sim-driver/sim swipe back` on a pushed entry -- expected: prints a `swiped back` line, and `sim dump` shows the page one level up
- `git diff --stat` after the trial -- expected: no change under `ios/` or `src/`

**Manual checks (if no CLI):**
- The epic's Notes hold a dated `Decision: 2026-11-02` naming native or web, what was tried and seen, and whether `sim swipe` exists
