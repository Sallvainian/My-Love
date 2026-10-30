---
type: epic
title: "iPhone Duo Native Tab Bar"
parent: initiative-my-love
covers: []
sources: [_bmad-output/initiative-my-love/research-iphone-duo-pwa-support/research-iphone-duo-pwa-support.md, _bmad-output/initiative-my-love/deferred-work.md, src/components/Navigation/AppNavigation.tsx, AGENTS.md]
companions: [_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/duo-observed-layouts.md]
after: []
risk: high
---

# iPhone Duo Native Tab Bar

## Description

On iPhone Duo, iOS moves system bars into a side column, which in the native shell today holds only the time and status, while the app's own HTML dock floats over content at the bottom (`duo-observed-layouts.md`). Instagram, Facebook, Netflix and others put their tabs in that column. Only a system tab bar can get there, because iOS keeps web content out of the column (DW-326, research Q2). When this epic is done, the native iOS shell on every iPhone shows the five dock destinations as Apple's own tab bar, which on the Duo iOS places in the column in the poses where it puts system bars, while the website and the Home Screen web app keep their HTML dock.

## Outcome

On the iPhone Duo, the couple reaches the five destinations from iOS's side column, as in Instagram, Facebook and Netflix, with no dock covering content. The signal is screenshots of the Duo in each pose matching the column layout recorded in `duo-observed-layouts.md`.

## Requirements

R1 (DW-326; research Q4): On iPhone Duo the native shell shows Home, Mood, Love Notes, Photos and Partner as iOS's own tab bar, placed where iOS places system tab bars in each pose: the side column on the outer display and in inner landscape, a bottom bar in inner portrait, and its own outer edge in Split View when iOS runs the app there (the shell declares no multiple-scene support, so that is unconfirmed). Met when simulator or device screenshots of each of those poses show the five tabs there and no HTML dock.

R2 (DW-326; AppNavigation DESTINATIONS): Tapping a tab opens the same view, URL and history entry the matching dock button opens, and the selected tab always names the view on screen, whatever changed it. Met when each of the five tabs opens its view, a reload after a tab tap reopens that view, and every path the shell has to a view (launch or reload, Settings, the error screen's Home button) leaves its tab selected.

R3 (AppNavigation aria-label; owner decision 2026-10-29): VoiceOver reads each tab's name. Met when VoiceOver on the device, or Accessibility Inspector on the simulator, reads Home, Mood, Love Notes, Photos and Partner.

R4 (DW-326; AGENTS.md dock clearance): While the native tab bar shows, the HTML dock does not, nothing the app draws sits under the tab bar, and no dock-sized empty band is left at the bottom; screen-pinned views such as Love Notes end at the tab bar or the screen edge. Met when every view scrolled to its end shows its last item whole in each R1 pose.

R5 (AGENTS.md native iOS shell; research rec 4): The website, the Home Screen web app, and a shell installed before this work keep the HTML dock and work unchanged, including after that older shell takes the new web code by live update. Met when an older shell build, updated to the new bundle on the simulator, shows a working dock.

R6 (DW-326 one shared WKWebView): Every tab shows the one running app: one sign-in, one set of live connections, and switching tabs keeps or drops view state exactly as switching with the dock does today. Met when a partner's mood arrives live whichever tab is selected, and switching tabs neither reloads the app nor signs out.

R7 (owner decision 2026-10-29): On every iPhone other than the Duo, the native shell shows the same five tabs as iOS's own tab bar where iOS places it, in place of the HTML dock. Met when a non-Duo iPhone simulator shows the system tab bar and no HTML dock.

R8 (owner decision 2026-10-29): While Settings is open, the tab of the last destination shown stays selected, and tapping it leaves Settings for that view. Met when Settings opened from each destination returns to it by that destination's tab.

R9 (owner decision 2026-10-29): The native tab bar shows exactly where the HTML dock would and nowhere else: not on the sign-in screen, display-name setup, the loading screens, the welcome splash or the admin panel. Met when those screens show no tab bar in the shell and the signed-in views show it.

R10 (owner decision 2026-10-29): While a dialog, a sheet or the photo viewer is open, the native tab bar is hidden, and it returns when the overlay closes, so no view switch happens under an open overlay, as with today's covered dock. Met when opening and closing the photo upload dialog, the interaction history sheet and the photo viewer hides and restores the bar.

## Constraints

- Only a system tab bar reaches the side column: iOS keeps web content out of it and fills it with the page background (research Q2; DW-326), so no HTML imitation of the column.
- Keep iOS's own bar placement in every pose; never override it (research Q4, HIG [3] "don't override the default bar placement").
- The first story proves, on the Xcode 27.1 iPhone Duo simulator, that a system tab bar around the one shared web view lands in the column, before the rest is built; DW-326 says this is not yet proven.
- Web code detects the capability, never the device: it relies on the native tab bar only when the installed shell offers it (`Capacitor.isPluginAvailable`), because web changes reach older shells by live update while native changes need a reinstall (AGENTS.md, native iOS shell; research rec 1).
- The native tab bar's visibility follows the dock's mount: it shows when `AppNavigation` mounts and hides when it unmounts, so a screen added later stays in step; no separate signed-out check (owner decision 2026-10-29; the screens without the dock are early returns in `App.tsx` before the main return that renders it).
- A tab tap goes through the same navigation as a dock tap (`navigationSlice.currentView` and its URL handling), so history and reload behave alike (AGENTS.md, Conventions).
- Column placement, insets and poses are checked on the Xcode 27.1 iPhone Duo simulator or the device; Playwright cannot emulate the column, safe-area insets, standalone mode or posture (research Q5).
- Screenshots committed as evidence come from a test account with the fictional fixture data, never the owner's account, because the repo is public (AGENTS.md, Policy).

## Done when

1. On the owner's iPhone Duo, a shell built from this epic shows the five destinations in the side column when folded and in unfolded landscape, and at the bottom in unfolded portrait, with no HTML dock, and a non-Duo iPhone shows the system tab bar in place of the dock; the sign-in screen and an open dialog show no tab bar (R1, R4, R7, R9, R10).
2. Every destination opens from its tab, the selected tab follows the view through reload, Settings and the error screen's Home button, and VoiceOver reads each tab's name (R2, R3, R8).
3. An older shell updated by live update, the website and the Home Screen web app still show a working HTML dock (R5).
4. The web part ships through `deploy.yml`, the new shell is installed on the owner's Duo, and CI is green on main.

## Boundaries

- The website and the Home Screen web app keep the bottom HTML dock (research rec 4), with no `viewport-fit=cover` and no fold APIs (research rec 6).
- The Settings gear stays in the web header; a system toolbar button for it in the column is out (owner decision 2026-10-29).
- The shell's default app icon and splash screen, the other half of DW-326.
- Haptics (DW-325).
- Unseen-count badges on the tabs, parked until the dock gets real counts (DW-327).
- Back/Forward tab sync in the shell: nothing there triggers Back/Forward today. If swipe-back (`allowsBackForwardNavigationGestures`) is ever enabled in the shell, it returns as a requirement.
- Any change to the five destinations; the dock is full at five (AGENTS.md).
- Fold-aware layouts of the views themselves (two-pane content, partially folded poses).

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md (no Requirements yet, so this epic cites its sources directly)
- research — _bmad-output/initiative-my-love/research-iphone-duo-pwa-support/research-iphone-duo-pwa-support.md, sections Q2, Q4, Q5 and Recommendations
- deferred-work — _bmad-output/initiative-my-love/deferred-work.md, DW-325, DW-326 and DW-327
- code — src/components/Navigation/AppNavigation.tsx, `DESTINATIONS` and the badge rendering
- project-context — AGENTS.md, Maintained by hand (native iOS shell; dock clearance)
- companion — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/duo-observed-layouts.md

## Notes

- Decision: 2026-10-29 the shell uses the native tab bar on every iPhone, not only the Duo: one code path, no device detection (R7).
- Decision: 2026-10-29 the Settings gear stays in the web header for this epic.
- Decision: 2026-10-29 while Settings is open the last destination's tab stays selected, and tapping it leaves Settings (R8).
- Decision: 2026-10-29 each tab uses the dock's label (Home, Mood, Love Notes, Photos, Partner) and the SF Symbol nearest its dock icon, Home filled when selected as in the dock; iOS shows icons only in the column.
- Decision: 2026-10-29 when the app opens straight onto Settings, with no destination shown before it, Home's tab shows selected.
- Source conflict: R3 — R3 asked each tab to carry the badge the dock shows, but the dock's only caller (src/App.tsx, `<AppNavigation>`) passes no `badgeCounts`, so the dock has never shown a badge.
- Decision: 2026-10-29 R3 narrowed to VoiceOver reading each tab's name; settles the R3 source conflict.
- Parked: tab badges, until the dock gets real counts (DW-327 in the deferred-work ledger).
- Decision: 2026-10-29 "an opened link" dropped from R2: the shell registers no URL scheme and has no universal links, so nothing outside the app opens it at a given view.
- Decision: 2026-10-29 story 5 (ship to the Duo) runs after the refactor sweep, so the cleaned-up code is what gets deployed and checked on the device; a deliberate exception to the sweep closing the epic.
- Decision: 2026-10-29 Back/Forward dropped from R2 for the shell: nothing in `src` calls `history.back/go/forward` and Capacitor's iOS code never enables swipe-back.
- Unknown: whether a system tab bar around the one shared web view lands in the side column; story 1 answers it, and if it does not, stories 2–5 are re-sliced (DW-326).
- Decision: 2026-10-29 that unknown gates story 2 only: stories 3–5 already wait on story 2 through `after`, so one field is cleared when story 1's result is read.
- Decision: 2026-10-29 tracer bullet is story 1, the simulator proof that a system tab bar around the one shared web view lands in the side column; the dock hand-off (story 2) follows as the least certain part, then selection sync (story 3), which shares its web wiring.
