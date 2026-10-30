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

R2 (DW-326; AppNavigation DESTINATIONS): Tapping a tab opens the same view, URL and history entry the matching dock button opens, and the selected tab always names the view on screen, including after Back/Forward, reload, an opened link and in-app moves between views. Met when each of the five destinations is checked both ways.

R3 (AppNavigation badgeCounts, aria-label): Each tab carries the unseen-count badge the dock shows for its destination, updating live, and VoiceOver reads the tab's name and count. Met when a new partner item raises the matching tab's badge and VoiceOver announces it.

R4 (DW-326; AGENTS.md dock clearance): While the native tab bar shows, the HTML dock does not, nothing the app draws sits under the tab bar, and no dock-sized empty band is left at the bottom; screen-pinned views such as Love Notes end at the tab bar or the screen edge. Met when every view scrolled to its end shows its last item whole in each R1 pose.

R5 (AGENTS.md native iOS shell; research rec 4): The website, the Home Screen web app, and a shell installed before this work keep the HTML dock and work unchanged, including after that older shell takes the new web code by live update. Met when an older shell build, updated to the new bundle on the simulator, shows a working dock.

R6 (DW-326 one shared WKWebView): Every tab shows the one running app: one sign-in, one set of live connections, and switching tabs keeps or drops view state exactly as switching with the dock does today. Met when a partner's mood arrives live whichever tab is selected, and switching tabs neither reloads the app nor signs out.

R7 (owner decision 2026-10-29): On every iPhone other than the Duo, the native shell shows the same five tabs as iOS's own tab bar where iOS places it, in place of the HTML dock. Met when a non-Duo iPhone simulator shows the system tab bar and no HTML dock.

R8 (owner decision 2026-10-29): While Settings is open, the tab of the last destination shown stays selected, and tapping it leaves Settings for that view. Met when Settings opened from each destination returns to it by that destination's tab.

## Constraints

- Only a system tab bar reaches the side column: iOS keeps web content out of it and fills it with the page background (research Q2; DW-326), so no HTML imitation of the column.
- Keep iOS's own bar placement in every pose; never override it (research Q4, HIG [3] "don't override the default bar placement").
- The first story proves, on the Xcode 27.1 iPhone Duo simulator, that a system tab bar around the one shared web view lands in the column, before the rest is built; DW-326 says this is not yet proven.
- Web code detects the capability, never the device: it relies on the native tab bar only when the installed shell offers it (`Capacitor.isPluginAvailable`), because web changes reach older shells by live update while native changes need a reinstall (AGENTS.md, native iOS shell; research rec 1).
- A tab tap goes through the same navigation as a dock tap (`navigationSlice.currentView` and its URL handling), so history and reload behave alike (AGENTS.md, Conventions).
- Column placement, insets and poses are checked on the Xcode 27.1 iPhone Duo simulator or the device; Playwright cannot emulate the column, safe-area insets, standalone mode or posture (research Q5).
- Screenshots committed as evidence come from a test account with the fictional fixture data, never the owner's account, because the repo is public (AGENTS.md, Policy).

## Done when

1. On the owner's iPhone Duo, a shell built from this epic shows the five destinations in the side column when folded and in unfolded landscape, and at the bottom in unfolded portrait, with no HTML dock, and a non-Duo iPhone shows the system tab bar in place of the dock (R1, R4, R7).
2. Every destination opens from its tab, the selected tab follows the view through Back/Forward, reload and Settings, and each tab's badge matches the dock's count (R2, R3, R8).
3. An older shell updated by live update, the website and the Home Screen web app still show a working HTML dock (R5).
4. The web part ships through `deploy.yml`, the new shell is installed on the owner's Duo, and CI is green on main.

## Boundaries

- The website and the Home Screen web app keep the bottom HTML dock (research rec 4), with no `viewport-fit=cover` and no fold APIs (research rec 6).
- The Settings gear stays in the web header; a system toolbar button for it in the column is out (owner decision 2026-10-29).
- The shell's default app icon and splash screen, the other half of DW-326.
- Haptics (DW-325).
- Any change to the five destinations; the dock is full at five (AGENTS.md).
- Fold-aware layouts of the views themselves (two-pane content, partially folded poses).

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md (no Requirements yet, so this epic cites its sources directly)
- research — _bmad-output/initiative-my-love/research-iphone-duo-pwa-support/research-iphone-duo-pwa-support.md, sections Q2, Q4, Q5 and Recommendations
- deferred-work — _bmad-output/initiative-my-love/deferred-work.md, DW-326
- code — src/components/Navigation/AppNavigation.tsx, `DESTINATIONS` and the badge rendering
- project-context — AGENTS.md, Maintained by hand (native iOS shell; dock clearance)
- companion — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/duo-observed-layouts.md

## Notes

- Decision: 2026-10-29 the shell uses the native tab bar on every iPhone, not only the Duo: one code path, no device detection (R7).
- Decision: 2026-10-29 the Settings gear stays in the web header for this epic.
- Decision: 2026-10-29 while Settings is open the last destination's tab stays selected, and tapping it leaves Settings (R8).
- Decision: 2026-10-29 each tab uses the dock's label (Home, Mood, Love Notes, Photos, Partner) and the SF Symbol nearest its dock icon, Home filled when selected as in the dock; iOS shows icons only in the column.
- Assumption: When the app opens straight onto Settings, with no destination shown before it, Home's tab shows selected.
