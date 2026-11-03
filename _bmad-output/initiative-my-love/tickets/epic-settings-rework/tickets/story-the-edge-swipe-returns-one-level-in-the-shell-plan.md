---
title: 'The edge swipe returns one level in the shell'
type: 'feature'
ticket: '15'
created: '2026-11-03'
status: blocked
baseline_revision: '9f15bce4442222d4071a1fc7d4790d98569a0c5f'
route: 'oneshot'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/scripts/sim-driver/README.md'
warnings: []
deferred:
  - summary: >-
      DW-425 still names story 15 as the one that checks its three cases by hand on the Duo, and it does not hold this story's simulator results; the ledger reserves that entry's text for the orchestrator.
    evidence: |-
      Story 15 ran the three cases on the Duo simulator: the first entry (exit 1), the column on the left edge (one level, after 17 failed synthesized pans), and Home's message card (one level). It cannot run them under a real finger, and the shell with the Swift line is not on the Duo yet. The hand checks are this plan's operator_actions. The deferred-work.md header leaves another entry's reason to the orchestrator.
    location: >-
      _bmad-output/initiative-my-love/deferred-work.md DW-425
    severity: low
operator_actions:
  - "Install a shell built from this branch on the owner's iPhone Duo without uninstalling. Use story 17's reinstall, or a trial build with CURRENT_PROJECT_VERSION=2 and then main put back at build number 1, as in the AGENTS.md procedure."
  - "On the Duo, swipe from the left edge on the first page after a launch (Home) and confirm the page stays put (DW-425 case 1)."
  - "On the Duo with the column on the screen's left edge (folded landscape with the capsule on the left, or the left pane side by side), open Settings > Profile and swipe from the left edge. Confirm it returns to Settings, and that each capsule button still opens its view (DW-425 case 2)."
  - "On the Duo, open Settings, tap Home in the dock, and swipe from the left edge starting over Home's message card. Confirm it returns to Settings in one level and the card does not also turn to the next message (DW-425 case 3)."
  - "On the Duo, open Settings > Profile, tap Refresh when an update toast appears (or wait for a background swap), then swipe from the left edge on the new first page. Confirm it stays put (DW-424)."
blocked_at: "2026-11-03"
blocked_reason: "awaiting operator: Install a shell built from this branch on the owner's iPhone Duo without uninstalling. Use story 17's reinstall, or a trial build with CURRENT_PROJECT_VERSION=2 and then main put back at build number 1, as in the AGENTS.md procedure.; On the Duo, swipe from the left edge on the first page after a launch (Home) and confirm the page stays put (DW-425 case 1).; On the Duo with the column on the screen's left edge (folded landscape with the capsule on the left, or the left pane side by side), open Settings > Profile and swipe from the left edge. Confirm it returns to Settings, and that each capsule button still opens its view (DW-425 case 2).; On the Duo, open Settings, tap Home in the dock, and swipe from the left edge starting over Home's message card. Confirm it returns to Settings in one level and the card does not also turn to the next message (DW-425 case 3).; On the Duo, open Settings > Profile, tap Refresh when an update toast appears (or wait for a background swap), then swipe from the left edge on the new first page. Confirm it stays put (DW-424)."
---

<intent-contract>

## Intent

**Problem:** R2 needs the iOS shell's left-edge swipe to go back exactly one level. Spike 2 chose WKWebView's native back-forward gesture (epic Notes, Decision on the edge swipe), and the shell does not turn it on yet. DW-424 is now confirmed on the Duo simulator. After a live update (Refresh in the update toast), a swipe on the new bundle's first page went back into the previous bundle's last page (Profile) instead of doing nothing. This happens because the updater loads each bundle as a new document with `webView.load`, which keeps the old document's entries in the back list.

**Approach:**
- Turn the gesture on in `MainViewController` (`ios/App/App/NativeAuth.swift`).
- Keep it off whenever the one step back would leave the current bundle. On every main-frame `.other` load of an app URL (the launch load, and the updater's bundle load), record the item that was current then. That item is the last entry of the document being left. After each URL or `canGoBack` change, allow the gesture only when the back item exists and is not that recorded item.
- `.reload` loads (an error-boundary reload, or the web process restarting) record nothing. So a back across a reload still works for the in-app back arrow and for the swipe.
- Check every case on the Duo simulator with `sim swipe back`.
- Close DW-424.
- DW-425 needs a person with a device. Check its three cases on the simulator where the driver can, and leave the device hand checks to the operator.

</intent-contract>

## Implementation Notes

Oneshot route: the change is about 40 lines of Swift in one file, plus the ledger updates. The work is mostly the simulator check.

- Hook: `CAPBridgeViewController` has no gesture config in Capacitor 8.6.0. `WebViewDelegationHandler.decidePolicyFor` posts `.capacitorDecidePolicyForNavigationAction` (object: the `WKNavigationAction`) for every navigation, before any plugin decides. Observe it in `capacitorDidLoad`. The updater's swap is `CapacitorUpdater.applyCurrentBundleToBridge` → `setServerBasePath` → `webView.load(URLRequest(serverURL))`, a `.other` navigation. `keepUrlPathAfterReload` is unset (`capacitor.config.ts`), so the new document starts at `/`.
- Observe `url` and `canGoBack` with KVO. WKWebView updates `url` on `pushState` and `popstate` too, so every Settings push and view change re-evaluates the gesture.
- **Built:** `ios/App/App/NativeAuth.swift` only.
  - `MainViewController.startBackSwipe` observes the policy notification.
  - `noteDocumentLoad` records `previousDocumentEntry`.
  - `updateBackSwipe` sets `allowsBackForwardNavigationGestures`.
- **Surprise:** the first guard watched only `url` and `canGoBack`, and an update still crossed. A temporary `NSLog` showed why: a new document's `url` changes when its load starts, before its entry joins the back list. Nothing re-decided after commit, because `canGoBack` stayed true. Adding `isLoading` fixed it. The log then showed `back=…/settings/profile boundary=…/settings/profile allowed=0` on the new Home. The `NSLog` was removed and the shell rebuilt before the final checks.
- **Why turn the swipe off rather than cancel the navigation:** cancelling every cross-document back would also kill the in-app back arrow (`history.back()`) after any reload. That includes an error-boundary reload, `dbSchema`'s reload, and the web process restarting. A reload is `.reload`, not `.other`, so it records no boundary.
- **Simulator results** (Duo, folded; final build except where noted):
  - Profile → Settings → Home, one swipe each. A swipe on Home did nothing (exit 1).
  - An event opened from Home → its Date page → swipe → event page with Home still lit in the capsule (screenshot) → swipe → Home → nothing. The final build re-ran event → Home.
  - Settings → Profile → Refresh, then on the new Home: 16 pans did nothing. In the new bundle Profile → Settings → Home, and Home did nothing again (debug build, guard logged `allowed=0`).
  - Column on the left (landscapeLeft, capsule at x=22): Profile → Settings in one level, but only after 17 failed pans. The guard logged `allowed=1` throughout, so the failures were the synthesized pan. The capsule's Home and Settings both tapped.
  - Home reached from Settings by the dock, scrolled so the message card covered the pan's start height: the swipe went to Settings, one level (debug build).
  - Synthesized pans registered on tries 1 to 8, and one Profile swipe missed all 8. Every pan that registered went exactly one level.
- **Ledger:** DW-424 is closed with its resolution. DW-425 stays open: its three cases are about a real finger on the Duo, which the operator checks (`operator_actions`).
- Seen before the guard, on the simulator built with the gesture line alone: Settings → Profile, then a swipe went to Settings, then to Home, and a swipe on Home did nothing (exit 1). An event opened from Home went back to Home, and the next swipe did nothing. After Settings → Profile → Refresh (update applied), a swipe on the new Home landed on Profile (DW-424).

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 2, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` While the updater's bundle load runs, the swipe stays on. Before commit it goes back inside the old document. Between commit and finish it crosses into the old bundle (DW-424 again).
    - Verified: `noteDocumentLoad` runs before commit, while `backItem` is still the old document's earlier entry. Commit changes neither `url` nor `canGoBack`.
    - Fixed: `updateBackSwipe` now also requires `!webView.isLoading`, and the comment says so. The patched build passed every Verification check.
  - `[low]` `[defer]` DW-425 still names story 15 for the hand checks and lacks the simulator results. The `deferred-work.md` header leaves another entry's text to the orchestrator. Recorded in `deferred`, with the hand checks in `operator_actions`.
  - `[false]` `[reject]` The plan cites an `operator_actions` key that does not exist. Finalize writes that key; it was absent only at review time. It is now in the frontmatter.
  - `[low]` `[patch]` The comment said "canGoBack covers a push to the same URL", which holds only when `canGoBack` changes. Corrected to "covers the first entry gaining a back item". The reviewer found no reachable same-URL push.

## Verification

**Commands:**
- `scripts/sim-driver/sim build --update-port 8790`, then sign in as Casey on the Duo simulator. Pass when the build succeeds.
- On a Settings subpage (Settings → Profile), run `sim swipe back` three times. Expected: it lands on Settings, then Home, and the third run exits 1.
- On a date page opened from Home (tap an event card), then that event's Date field page, run `sim swipe back`. Expected: the event page, then Home, with Home highlighted. The next run exits 1.
- Open Settings → Profile, then `sim serve-update --port 8790`. Relaunch, open Settings → Profile, and tap Refresh in the update toast. Then run `sim swipe back` on the new Home. Expected: exits 1 and Home stays. Then push Settings → Profile in the new bundle and run `sim swipe back` twice. Expected: Settings, then Home.
- In the column-left pose (`sim pose`, `sim rotate` until `sim dump` shows the nav column at x≈0), on Settings → Profile, run `sim swipe back`. Expected: Settings. A tap on the capsule's Home still opens Home.
- From Settings, tap the dock's Home and `sim scroll down` until the message card covers the web view's mid-height, where the pan starts. Then run `sim swipe back`. Expected: Settings, exactly one level. Whether the card also turns under a real finger is left to the operator.
- Afterwards: `sim serve-update --stop`, then `git diff --stat`. Expected: only `ios/App/App/NativeAuth.swift`, the plan and the ledger changed.

## Auto Run Result

Status: awaiting-operator

**Summary**
- The iOS shell's left-edge swipe now goes back one level. `MainViewController` turns on WKWebView's own back-forward gesture, the choice spike 2 made. Every Settings push and every view change is a `pushState` entry, so the swipe goes back exactly one of them.
- **DW-424, confirmed and fixed.** With the gesture alone, a swipe on the first page after a live update opened the old bundle's last page.
  - How the guard works: the shell records the entry that was current when each new bundle's document started loading. It keeps the gesture off while the back item is that entry or a load is running.
  - Why a reload still works: a reload records nothing, so the in-app back arrow keeps working across one.
- **Needs a reinstall:** this is a native change, so it reaches the phones only through story 17's reinstall.

**Files changed**
- `ios/App/App/NativeAuth.swift`: the gesture and the bundle-boundary guard in `MainViewController`.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-424 is closed with its resolution.

**Review findings.** One quick pass found 4 findings:
- 2 patched: medium, the swipe during the bundle load; low, the KVO comment.
- 1 deferred to the orchestrator: low, DW-425's ledger text.
- 1 rejected as false: `operator_actions` was missing only before finalize.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 1, low 1.

**Verification** (Duo simulator, folded, local stack; `sim build --update-port 8790` with the patched code)
- **Settings subpage:** Profile → Settings → Home, one swipe each. A swipe on Home exits 1.
- **Date page from Home:** event → its Date page → swipe → event page (Home lit in the capsule, screenshot from the earlier build) → swipe → Home.
- **After a live update:** Settings → Profile → Refresh. On the new Home, 2 swipe runs (16 pans) did nothing. In the new bundle, Profile → Settings in one swipe.
- **Earlier builds only:** column on the left (landscapeLeft), Profile → Settings in one level, and the capsule taps. Message card, one level to Settings. These were not re-run after the `isLoading` patch, which only removes the loading window.
- No unit or E2E suite covers Swift. `sim build` compiled the target each time, and no web file changed.
- `sim serve-update` is stopped. The simulator holds the shell built from this change.

**Residual risks**
- **Synthesized pans are unreliable:** between 1 and 18 pans registered a swipe, so the simulator proves where a registered swipe lands, not how a finger feels.
- **Real-finger checks are owed:** DW-425's cases need a person on the Duo (`operator_actions`).
- **Untested path:** a hard `location.href` navigation inside the app would also count as a new document. None exists today.
