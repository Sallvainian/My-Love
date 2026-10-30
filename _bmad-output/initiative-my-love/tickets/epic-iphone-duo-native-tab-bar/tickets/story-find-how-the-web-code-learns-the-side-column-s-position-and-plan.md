---
title: 'Find how the web code learns the side column''s position and width in each pose'
type: 'chore'
ticket: '7'
created: '2026-10-30'
status: done
baseline_revision: 'fc3d0ed6b7360c48e53a4201ac4058bb95291ceb'
route: 'oneshot'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/duo-observed-layouts.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The column dock (stories 2 and 8) cannot be built until we know how the page learns where the Duo's side column is and how wide it is in each pose; the 2026-10-29 and 2026-10-30 observations disagree on whether content stops at the column, and no first-party source gives the column's width or the Duo's `env(safe-area-inset-*)` values.

**Approach:** A spike that ships no behaviour. On the iPhone Duo simulator (iOS 27.1 runtime) and on the owner's Duo, in the shell, Safari and the Home Screen web app, a person puts each surface through outer portrait, outer landscape, inner portrait, inner landscape and Split View (if iOS offers it) while values are read through Safari's Web Inspector with the probe below; the results go into this plan's Findings, which name the detection method stories 2 and 8 use, or say none works. The plan also records the setup stories 2, 8, 5 and epic-push-notifications 3.1 reuse: the production test couple and a simulator shell that never swaps itself back to production's web code.

</frozen-after-approval>

## Setup

- **Shell build that stays local:** `fnox exec -- env GITHUB_SHA=sim-local VITE_LIVE_UPDATE_URL=http://localhost:8787/updates/latest.json npm run ios:sync`, then `GITHUB_SHA=sim-local UPDATE_BASE_URL=http://localhost:8787 scripts/package-live-update.sh`, then `npx wrangler dev --port 8787` to serve `dist/` (latest.json's `version` is `sim-local`, equal to the shell's `__BUILD_ID__`, so `startNativeUpdates()` returns before downloading). Run from `ios/App` in Xcode on the iPhone Duo simulator. Uninstall any earlier shell from the simulator first (`xcrun simctl uninstall <udid> dev.sallvain.mylove`): a reinstall keeps the app's data container, and with it the updater's `serverBasePath` pointing at a production bundle an earlier build downloaded, so the new build's own web code never loads.
- **Test build on the owner's Duo, without losing their data:** never uninstall there (it deletes the sign-in and any unsent moods and notes). Build the web code outside `dist/` with an unreachable update URL, `fnox exec -- env GITHUB_SHA=<name> VITE_LIVE_UPDATE_URL=https://127.0.0.1:9/updates/latest.json npx vite build --outDir <scratch>/web --emptyOutDir` (a failed update check leaves the app on the build it has), copy it into `ios/App/App/public/` keeping `cordova.js` and `cordova_plugins.js`, and build with a raised build number, `xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination 'id=<device>' -allowProvisioningUpdates CURRENT_PROJECT_VERSION=2 build`, then `xcrun devicectl device install app`. The changed `CFBundleVersion` makes the updater reset to the built-in bundle and delete downloaded ones (`CapacitorUpdaterPlugin.swift:297`, `:1149`–`1165`); app data is untouched. To restore: `fnox exec -- npm run ios:sync` from main, build without the override (build number 1, the same reset again), install, then open, background and reopen the app twice — the first launch downloads the production bundle, the next background swaps it in. Confirm by copying `Library/Preferences/dev.sallvain.mylove.plist` off the device (`xcrun devicectl device copy from --domain-type appDataContainer --domain-identifier dev.sallvain.mylove`): `serverBasePath` names the downloaded bundle and its `<id>_info` carries the live `latest.json` version with `status: success`.
- **Safari and the Home Screen web app on a device:** serve the same scratch build on the Mac's Wi-Fi address (`python3 -I -m http.server <port> --bind <mac-ip> --directory <scratch>/web`), never from `dist/`, and add the page to the Home Screen from Safari.
- **Test couple (production):** Claude Bot signs in with `CLAUDE_BOT_PASSWORD` from fnox; Claude Partner is the linked partner. Display names are fictional; production holds moods and notes for both and no photos.
- **Reading values:** the Mac's Safari Develop menu attaches Web Inspector to the simulator's shell, Safari tab and Home Screen web app, and to the device's when Web Inspector is on in its Safari settings and the shell is a Debug build (Capacitor makes the web view inspectable only under `#if DEBUG`). Capacitor's default `contentInsetAdjustmentBehavior` is `.never` (`CAPInstanceDescriptor.m:45`), so the shell's insets follow the web view's safe area.
- **Probe (console, not committed):**

```js
const probe = () => { const p = document.createElement('div'); p.style.cssText = 'position:fixed;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.append(p); const s = getComputedStyle(p); const r = { inset: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft], inner: [innerWidth, innerHeight], screen: [screen.width, screen.height], vv: [visualViewport.width, visualViewport.height], orient: screen.orientation?.type, standalone: matchMedia('(display-mode: standalone)').matches }; p.remove(); return r; };
['resize', 'orientationchange'].forEach((e) => addEventListener(e, () => console.log(e, probe())));
visualViewport.addEventListener('resize', () => console.log('vv-resize', probe()));
addEventListener('pointerdown', (e) => console.log('tap', e.clientX, e.clientY), true);
```

- **Readout (what the Findings were read with):** the ticket allows "a temporary on-screen readout" in place of Web Inspector, and one was used because a person drove every pose and could not watch a console. Paste this before `</head>` in a build's `index.html` (build output only, never `index.html` in the repo). It shows the insets, the safe box, the last inset change and whether a listened event fired in the same 300 ms poll (`w/ <event>`, else `NO EVT`), the ResizeObserver's last callback, page and screen size, orientation, `standalone`, the latest event and the last tap; it keeps only the latest of each, so a "no event" claim needs that event's recorded time to predate the change.

```html
<script>
(() => {
  const css = 'position:fixed;inset:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);pointer-events:none;z-index:2147483646;box-sizing:border-box';
  let last = 'load', tap = '-', ro = '-', change = '-', prevInsets = '', eventSincePoll = false;
  const now = () => new Date().toTimeString().slice(0, 8);
  const start = () => {
    const safe = document.createElement('div');
    safe.style.cssText = css;
    const edge = document.createElement('div');
    edge.style.cssText = 'width:100%;height:100%;outline:2px dashed lime;outline-offset:-2px';
    safe.append(edge);
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:6px;top:40%;margin:0;padding:6px 8px;background:rgba(0,0,0,.8);color:#0f0;font:10px/1.3 ui-monospace,monospace;pointer-events:none;z-index:2147483647;white-space:pre';
    document.documentElement.append(safe, box);
    const render = () => {
      const s = getComputedStyle(safe);
      const vv = window.visualViewport;
      const insets = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => parseFloat(v)).join('/');
      if (prevInsets && insets !== prevInsets) change = prevInsets + ' -> ' + insets + ' @' + now() + (eventSincePoll ? ' w/ ' + last : ' NO EVT');
      prevInsets = insets;
      eventSincePoll = false;
      const r = edge.getBoundingClientRect();
      box.textContent = [
        'inset T/R/B/L ' + insets,
        'safe box x' + Math.round(r.left) + '-' + Math.round(r.right) + ' y' + Math.round(r.top) + '-' + Math.round(r.bottom),
        'inset change ' + change,
        'resizeObserver ' + ro,
        'inner ' + innerWidth + 'x' + innerHeight + '  screen ' + screen.width + 'x' + screen.height,
        'vv ' + (vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) : '-') + '  dpr ' + devicePixelRatio,
        'orient ' + (screen.orientation ? screen.orientation.type : '-') + '  standalone ' + matchMedia('(display-mode: standalone)').matches,
        'last event ' + last,
        'last tap ' + tap,
      ].join('\n');
    };
    const on = (name) => () => { last = name + ' @' + now(); eventSincePoll = true; };
    new ResizeObserver(() => { ro = 'fired @' + now(); }).observe(edge);
    setInterval(render, 300);
    addEventListener('resize', on('resize'));
    addEventListener('orientationchange', on('orientationchange'));
    if (window.visualViewport) visualViewport.addEventListener('resize', on('vv-resize'));
    if (screen.orientation) screen.orientation.addEventListener('change', on('orientation.change'));
    addEventListener('pointerdown', (e) => { tap = Math.round(e.clientX) + ',' + Math.round(e.clientY) + ' @' + now(); }, true);
    render();
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
</script>
```

## Findings

One row per surface and pose: column side and width, content under it, whether a tap in its lower part reaches the page (with `clientX`), insets top/right/bottom/left, inner against screen width, and the event that fired on a pose change without a reload.

Readings come from a temporary on-screen readout injected into build output only (on the simulator `dist/index.html` and `ios/App/App/public/index.html`, both gitignored; on the Duo a scratch build outside the repo, copied into `ios/App/App/public/` for the shell and served over Wi-Fi for Safari and the web app); the owner's Duo readings are from their screenshots, which stay out of the repo; it polls the probe every 300 ms, draws the safe area as a dashed outline, and reports a ResizeObserver on that outline.

| Surface | Pose | Column | Content under it | Lower-column tap | Insets T/R/B/L | inner vs screen | On pose change |
|---|---|---|---|---|---|---|---|
| Sim shell | Outer portrait | Right, 84 pt (safe box x0–382 of 466) | Yes: page lays out across all 466 pt, status capsule drawn over it | Yes: taps at 430,620 and 440,660 reached the page | 0/84/34/0 | 466×678 = 466×678 | At launch the insets went 0/0/0/0 → 0/84/34/0 with a `visualViewport` resize; ResizeObserver fired |
| Sim shell | Outer landscape-secondary (device landscapeRight) | Right, 84 pt (safe box x0–594 of 678); no status drawn in it | Yes: page lays out across all 678 pt | Yes: owner's click at 636,429 reached the page | 0/84/34/0 | 678×466; `screen` stays 466×678 | From outer portrait: `screen.orientation` change, ResizeObserver; insets unchanged. From inner landscape (fold): `visualViewport` resize, ResizeObserver; insets unchanged |
| Sim shell | Outer landscape-primary (device landscapeLeft) | **Left**, 84 pt (safe box x84–678 of 678) | Yes: page lays out across all 678 pt | Yes: owner's click at 31,442 reached the page | 0/0/34/84 | 678×466; `screen` stays 466×678 | From landscape-secondary: insets 0/84/34/0 → 0/0/34/84 with `screen.orientation` change as the event recorded; **no ResizeObserver callback** (its last one predates the flip: the safe box moved but kept its 594 pt width); page size unchanged. Unfolding from here: insets 0/0/34/84 → 0/84/34/0 with a `visualViewport` resize |
| Sim shell | Inner portrait | None; status in a strip along the top | n/a | n/a | 82/0/34/0 (safe box y82–917) | 669×951; `screen` stays 466×678 | Unfold from outer portrait: insets 0/84/34/0 → 82/0/34/0 with a `visualViewport` resize; ResizeObserver fired |
| Sim shell | Inner landscape (both directions) | Right, 84 pt (safe box x0–867 of 951) in landscape-primary and landscape-secondary alike; status at its top | Yes: page lays out across all 951 pt | Yes: owner's click at 908,648 (landscape-secondary) reached the page | 0/84/34/0 | 951×669; `screen` stays 466×678 | Rotation from inner portrait: insets 82/0/34/0 → 0/84/34/0 with a `visualViewport` resize and `screen.orientation` change; ResizeObserver fired |
| Sim shell | Inner landscape, two apps side by side, shell in the left pane | None: the column sits beside the right pane | n/a | n/a | 0/0/34/0 | 469×669; `screen` stays 466×678 | Entering the split: insets 0/84/34/0 → 0/0/34/0 with a `visualViewport` resize; ResizeObserver |
| Sim shell | Inner landscape, two apps side by side, shell in the right pane | Right, 84 pt (safe box x0–385 of 469); status at its top | Yes: page lays out across all 469 pt | Not tested (no AXe tap reaches the inner display; the Duo row below has the owner's tap) | 0/84/34/0 | 469×669; `screen` stays 466×678 | Swapping panes: insets 0/0/34/0 → 0/84/34/0 with **none of the four listened events** (the last one recorded, the `visualViewport` resize on entering the split at 15:56:46, predates the swap at 15:59:01); only the ResizeObserver fired |
| Sim Safari | Outer portrait | Right, holds Safari's back, reader, new-tab and tabs buttons | No: page is 382 pt wide, column kept outside the viewport | No: column is outside the page | 0/0/0/0 | 382×580 (WebKit's table); `screen` 466×678 | `visualViewport` resize, ResizeObserver |
| Sim Safari | Outer landscape (direction not recorded; the column on the right matches landscape-secondary on every other surface) | Right, holds Safari's controls; address bar floats over the page bottom | No: page is 594 pt wide | No: column is outside the page | 0/0/0/0 | 594×368 (WebKit's table) | `visualViewport` resize, ResizeObserver |
| Sim Safari | Inner portrait | None; Safari's controls in a top bar | n/a | n/a | 2/0/34/0 | 669×871 | Unfold: insets 0/0/0/0 → 2/0/34/0 with a `visualViewport` resize; ResizeObserver |
| Sim Safari | Inner landscape (one direction; which was not recorded) | None: Safari keeps a top bar, no side column | n/a | n/a | 2/0/34/0 | 951×589 | `visualViewport` resize, ResizeObserver; insets unchanged |
| Sim Safari | Inner landscape, two apps side by side, Safari in the right pane | Right, holds Safari's back, reader, new-tab and tabs buttons; address bar at the pane's bottom | No: page is 385 pt wide | No: column is outside the page | 0/0/0/0 | 385×571 | `visualViewport` resize, ResizeObserver |
| Sim Safari | Inner landscape, two apps side by side, Safari in the left pane | **Left**, holds Safari's back, reader, new-tab and tabs buttons; address bar at the pane's bottom | No: page is 385 pt wide | No: column is outside the page | 0/0/0/0 | 385×571 | Swapping panes: no event and no ResizeObserver callback (page size and insets unchanged) |
| Sim web app | Outer portrait | Right, 84 pt (safe box x0–382 of 466) | Yes: page lays out across all 466 pt | Yes: owner's click at 429,579 reached the page | 0/84/34/0 | 466×657: the page starts 21 pt below the screen top; `screen` 466×678 | At launch insets 0/0/0/0 → 0/84/34/0 with a `visualViewport` resize; ResizeObserver |
| Sim web app | Outer landscape-secondary | Right, 84 pt (safe box x0–594 of 678) | Yes | Yes: owner's click at 638,361 reached the page | 0/84/34/0 | 678×445 (21 pt short) | `screen.orientation` change, ResizeObserver; insets unchanged |
| Sim web app | Outer landscape-primary | **Left**, 84 pt (safe box x84–678 of 678) | Yes | Yes: owner's clicks at 35,401 and 41,72 reached the page | 0/0/34/84 | 678×445 (21 pt short) | `screen.orientation` change |
| Sim web app | Inner portrait | None; status in a strip along the top | n/a | n/a | 61/0/34/0 (21 + 61 = the shell's 82) | 669×930 (21 pt short) | Unfold: insets 0/84/34/0 → 61/0/34/0 with `screen.orientation` change; ResizeObserver |
| Sim web app | Inner landscape (both directions) | Right, 84 pt (safe box x0–867 of 951); status at its top | Yes | Yes: owner's click at 917,540 reached the page | 0/84/34/0 | 951×648 (21 pt short) | Rotation: insets 61/0/34/0 → 0/84/34/0 with `screen.orientation` change; ResizeObserver |
| Duo shell | Outer portrait | Right, 84 pt (safe box x0–382 of 466); status at its top | Yes: page lays out across all 466 pt | Yes: tap at 420,603 reached the page | 0/84/34/0 | 466×678 = 466×678 | Fold from inner portrait: insets 82/0/34/0 → 0/84/34/0 with a `visualViewport` resize; ResizeObserver (in a first pass the readout logged the same change with no event) |
| Duo shell | Outer landscape-secondary | Right, 84 pt (safe box x0–594 of 678) | Yes | Yes: tap at 636,400 | 0/84/34/0 | 678×466; `screen` stays 466×678 | From outer portrait: `screen.orientation` change; ResizeObserver |
| Duo shell | Outer landscape-primary | **Left**, 84 pt (safe box x84–678 of 678) | Yes | Yes: tap at 25,384 | 0/0/34/84 | 678×466 | From landscape-secondary: insets 0/84/34/0 → 0/0/34/84 with `screen.orientation` change as the event recorded; no ResizeObserver callback, its last one predating the flip (seen in both passes) |
| Duo shell | Inner portrait (portrait-primary and portrait-secondary) | None at the side; status in an 82 pt strip along the top | Yes: page lays out across all 951 pt, under the top strip | Yes: tap at 432,21 in the top strip reached the page | 82/0/34/0 (safe box y82–917) | 669×951; `screen` stays 466×678 | Unfold or rotation: `visualViewport` resize and `screen.orientation` change; ResizeObserver |
| Duo shell | Inner landscape (both directions) | Right, 84 pt (safe box x0–867 of 951) in both | Yes | Yes: taps at 915,556 (secondary) and 934,576 (primary) | 0/84/34/0 | 951×669 | From inner portrait: insets → 0/84/34/0 with a `visualViewport` resize; ResizeObserver. Between the two landscapes: `screen.orientation` change, insets unchanged |
| Duo shell | Inner landscape, two apps side by side, shell in the left pane | None: the column sits beside the right-hand app | n/a | A tap at 284,658 in the 34 pt bottom band reached the page | 0/0/34/0 | 469×669 | Entering the split: insets 0/84/34/0 → 0/0/34/0 with a `visualViewport` resize; ResizeObserver |
| Duo shell | Inner landscape, two apps side by side, shell in the right pane | Right, 84 pt (safe box x0–385 of 469) | Yes | Yes: tap at 429,560 | 0/84/34/0 | 469×669 | Swapping panes: insets 0/0/34/0 → 0/84/34/0 with **none of the four listened events** (the last one recorded predates the swap: 16:12:07 against 16:12:17, and 16:18:25 against 16:18:50); only the ResizeObserver fired (seen in both passes) |
| Duo Safari | Outer portrait | Right, holds Safari's back, reader, new-tab and tabs buttons | No: page is 382 pt wide | Not tried: the column holds Safari's buttons | 0/0/0/0 | 382×580; `screen` 466×678 | `visualViewport` resize, ResizeObserver |
| Duo Safari | Outer landscape-secondary | Right, Safari's buttons; address bar floats over the page bottom | No: page is 594 pt wide | Not tried | 0/0/0/0 | 594×368 | `visualViewport` resize, ResizeObserver |
| Duo Safari | Outer landscape-primary | **Left**, Safari's buttons | No: page is 594 pt wide | Not tried | 0/0/0/0 | 594×368 | `screen.orientation` change recorded; no ResizeObserver callback (its last one predates the flip) |
| Duo Safari | Inner portrait | None; Safari's controls in a top bar | n/a | n/a | 0/0/34/0 | 669×867 | `visualViewport` resize, ResizeObserver |
| Duo Safari | Inner landscape (both directions) | None: a top bar, as in inner portrait | n/a | n/a | 0/0/34/0 | 951×585 | `visualViewport` resize; between the two landscapes `screen.orientation` change recorded, insets unchanged |
| Duo Safari | Inner landscape, two apps side by side | Beside Safari's pane: its buttons sit in a column at the screen's left edge when Safari is the left pane, and at the right edge under the status when it is the right pane | No: page is 385 pt wide | Not tried | 0/0/0/0 | 385×571 | `visualViewport` resize, ResizeObserver |
| Duo web app | Outer portrait | Right, 84 pt, status at its top | **No**: page is 382 pt wide; the column is outside the page | **No**, from the page width: the column lies outside the 382 pt page, and no tap in it was recorded (the last tap, 234,571, is inside the page) | 0/0/34/0 | 382×678; `screen` 466×678 | `screen.orientation` change; ResizeObserver |
| Duo web app | Outer landscape-secondary | Right, 84 pt | **No**: page is 594 pt wide | **No**; a tap at 534,450 in the bottom band reached the page | 0/0/34/0 | 594×466 | `screen.orientation` change; ResizeObserver |
| Duo web app | Outer landscape-primary | **Left**, 84 pt | **No**: page is 594 pt wide, placed right of the column | **No**; a tap at 42,457 in the bottom band reached the page | 0/0/34/0 | 594×466 | `screen.orientation` change; ResizeObserver |
| Duo web app | Inner portrait | None at the side; status in a strip along the top | **No**: page starts below the strip, 869 pt tall | **No** in the top strip; a tap at 494,854 in the bottom band reached the page | 0/0/34/0 | 669×869 | `screen.orientation` change; ResizeObserver |
| Duo web app | Inner landscape (both directions) | Right, 84 pt | **No**: page is 867 pt wide | **No**: the column is outside the page; taps at 719,649 and 668,655 in the bottom band reached the page | 0/0/34/0 | 867×669 (one reading showed `visualViewport` 867×0 mid-rotation) | `visualViewport` resize; ResizeObserver |
| Duo web app | Inner landscape, two apps side by side, left pane | None: the column sits beside the other app | n/a | A tap at 204,659 in the bottom band reached the page | 0/0/34/0 | 469×669 | `visualViewport` resize; ResizeObserver |
| Duo web app | Inner landscape, two apps side by side, right pane | Right, 84 pt | **No**: page is 385 pt wide | **No**: the column is outside the page; a tap at 111,655 in the bottom band reached the page | 0/0/34/0 | 385×669 | `visualViewport` resize; ResizeObserver |

Across every change above, `env(safe-area-inset-*)` and the page size changed without a reload, almost always alongside a `visualViewport` resize or a `screen.orientation` change (the readout keeps only the latest event, so both may have fired). Three readings break that pattern. Turning the outer display between its two landscapes moves the column from right to left at the same width, so the padded box keeps its size and the ResizeObserver stays silent (its last callback predates the flip); `screen.orientation`'s `change` was the event recorded, and the page size did not change. Swapping the two panes of the side-by-side layout gives the shell the column (or takes it away) at the same page size and orientation, and none of the four listened events fired — the last one recorded predates the swap — so only the ResizeObserver reports it. And once on the Duo, a fold from inner portrait logged its inset change with no event in the same 300 ms poll, while a second pass of the same fold logged a `visualViewport` resize; a ResizeObserver callback came either way. `screen.width/height` never changed: it reports the outer display (466×678) in every pose, so it cannot tell the page which display or pose it is on.

**The Home Screen web app differs between the simulator and the owner's Duo.** On the simulator it drew under the column like the shell (0/84/34/0, page 466 wide); on the Duo it keeps the page out of the column and the top status strip in every pose (insets 0/0/34/0, page 382, 594 or 867 wide, or 869 tall in inner portrait), so a tap in the column never reaches the page there, while the 34 pt bottom band does. The Duo is the reference: the simulator's web-app rows do not predict the device. The shell's values match between the two exactly. Safari's differ on the inner display: the simulator's top bar leaves a 2 pt top inset and a page 4 pt taller (2/0/34/0, 669×871 and 951×589) than the Duo's (0/0/34/0, 669×867 and 951×585).

Simulator rows that are absent, and why: Safari's outer landscape-primary and its second inner landscape direction, and the web app's side-by-side panes, were not measured on the simulator; the owner's Duo covers each of those poses for the same surface, and the Duo is the reference.

**Detection method for stories 2 and 8 (shell values confirmed on the owner's Duo; the web app and Safari get no column to fill):** read the column from `env(safe-area-inset-left)` and `env(safe-area-inset-right)`. The page has a column when **exactly one** of the two is non-zero: that side is the column, 84 pt wide on the Duo, on the right in every pose except outer landscape-primary, where it is on the left. With both zero (inner portrait, the left pane of two apps side by side, Safari, and the Home Screen web app on the Duo in every pose) there is no column inside the page and the bottom dock stays. With both non-zero there is no column either: a notched or Dynamic Island iPhone in landscape is expected to inset both sides for its sensor housing — UNVERIFIED here, because the iPhone 18 Pro simulator (iOS 27.2) rendered the readout build as a blank page; story 2's check on a non-Duo iPhone simulator must cover landscape as well as portrait and confirm the bottom dock stays. Choosing the form needs JavaScript, because CSS cannot branch on an `env()` value: read the two side insets from the computed padding of an element padded with `env(safe-area-inset-*)` and re-read them on `visualViewport` `resize`, `screen.orientation` `change` **and** a ResizeObserver on that element — the side flip fires no ResizeObserver, and the pane swap fires none of the other events. Placing and sizing the dock once the form is chosen can stay in CSS with `env()`, which follows every change on its own. Never use `screen.*`, the user agent or `display-mode` to infer the pose. The page draws under the column only in the shell, where taps anywhere in the column (and in inner portrait's top strip) reach the page, so the column dock is a shell-only layout on the device; Safari puts its own buttons in the column and the Duo's web app leaves it outside the page, so in both the page has no column to fill. The shell and the web app carry a 34 pt bottom inset in every pose on both devices, and taps in that band reach the page; Safari reports a zero bottom inset on the outer display and in its side-by-side pane, and no tap was tried in Safari.

## Implementation Notes

Oneshot route: the spike changes no shipped code; its output is the Setup and Findings in this plan. A person drives the poses, so implementation pauses for their readings.

- Xcode on this Mac is 27.2; the simulator runs the iOS 27.1 iPhone Duo runtime. `ax pose`/`ax rotate` drive the poses; AXe coordinate taps (`--tap-style physical`) reach the page only in the shell in outer portrait, so the owner clicked the other column taps.
- A test build left in `dist/` is a live-site hazard: `npx wrangler deploy` uploads `dist/` without building. Once Safari and the web app were measured, `wrangler dev` was stopped and `dist/` rebuilt with `fnox exec -- npm run build` (checked free of the overlay, `sim-local` and `localhost:8787`). `fnox exec -- npm run ios:sync` from main then rebuilt `ios/App/App/public/` too, so no build folder holds the overlay while the installed simulator shell keeps it; the Duo build injects it into `ios/App/App/public/` only for its own Xcode build, and `ios:sync` from main removes it again before the shell from main is reinstalled.
- Duo, 2026-10-30: the readout shell went on as build 2 over the installed build 1, keeping the owner's sign-in; Safari and the web app read the scratch build over Wi-Fi. Afterwards the Wi-Fi server was stopped, `ios:sync` from main rebuilt both build folders (checked free of the overlay and every test URL), and the shell from main went back on as build 1. The phone then downloaded production bundle `6a1ea196…` (checksum matching the live `latest.json`), swapped it in on the next background, and reported it `success`; it takes live updates again. The readout is removed everywhere: the iPhone Duo and iPhone 18 Pro simulators hold the shell built from main (installed over the readout shell, checked free of it), and no build folder holds it.
- The iPhone 18 Pro simulator on iOS 27.0, and again on iOS 27.2, rendered the readout shell as a blank white page (Safari there showed a blank page too), so no non-Duo iPhone was measured; the detection method marks its both-sides case UNVERIFIED and hands the check to story 2.
- The Duo's portrait lock first hid folded landscape; with it off, the folded display rotates as the simulator's does.
- Out of scope, raised by the owner during the spike: a visible update flow (toasts while downloading and when ready, tap to restart behind an "are you sure" confirm, an "Update now" entry on a notifications page opened from a new top-left header button, with the silent swap on the next background kept as the fallback). To be written up as its own ticket.

## Verification

**Commands:**
- `git diff --stat fc3d0ed6b7360c48e53a4201ac4058bb95291ceb -- . ':(exclude)_bmad-output'` -- expected: empty (no shipped code changed)
- `git diff --name-only fc3d0ed6b7360c48e53a4201ac4058bb95291ceb | grep -iE '\.(png|jpe?g|heic|mov|mp4)$'` -- expected: no output (no device screenshot committed); run both after the commit, or add `git status --short` while the plan is still untracked

**Manual checks (if no CLI):**
- Findings has a row for every pose on the simulator and the owner's Duo, in the shell, Safari and the Home Screen web app, or says why a row cannot exist (Split View absent, Web Inspector unable to attach).
- Findings names the detection method stories 2 and 8 use, or says none works; no real name appears anywhere in the plan.

## Review Triage Log

Quick lens, one pass; every finding checked against the plan, the ticket and the repo.

- Notch insets break "the column is the non-zero one" — `medium`, patched: `Info.plist` allows both landscapes on iPhone and `index.html:6` sets `viewport-fit=cover`, so a non-Duo iPhone can inset both sides. The rule now requires exactly one non-zero side; the both-sides case could not be measured (the iPhone 18 Pro simulator rendered the readout blank) and is deferred as DW-328 for story 2.
- "34 pt bottom inset on every surface" contradicted by Safari's 0/0/0/0 rows — `medium`, patched: the sentence now covers the shell and web app only and says no Safari tap was tried.
- A third event exception (the Duo fold logged with no event once) left out of the summary — `low`, patched: the paragraph names it.
- Readings not taken with Web Inspector, readout not recorded, "only" and "no event" claims stronger than a latest-event log supports — `medium`, patched in part. The ticket allows "a temporary on-screen readout", so the method itself is permitted (noted in Setup). The readout's code is now in Setup. "No event" claims now cite the last recorded event's time predating the change, which a latest-event log does support; "`screen.orientation` change only" became "the event recorded", with the ResizeObserver's silence shown by its earlier timestamp.
- Missing or unlabeled simulator rows — `low`, patched: Safari's landscape rows now state what direction was or was not recorded, the absent simulator rows are listed with the reason (the Duo covers each), and the simulator side-by-side tap says why it was not taken.
- Safari's simulator and Duo values differ in page height too — `low`, patched.
- Readout left in the simulator shell at the story's end — `medium`, patched: the shell built from main was installed over it on both simulators and checked free of it.
- Duo web app outer-portrait tap cell implied a column tap — `low`, patched: it now says the "No" follows from the page width and no column tap was recorded.
- "Pure CSS is the method to prefer" cannot choose the dock's form — `medium`, patched: the method now says JavaScript reads the side insets to choose the form, on all three re-read signals, and CSS places the dock.
