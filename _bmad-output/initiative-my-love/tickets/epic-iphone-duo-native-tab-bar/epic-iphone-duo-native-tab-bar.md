---
type: epic
title: "iPhone Duo Side-Column Dock"
parent: initiative-my-love
covers: []
sources: [_bmad-output/initiative-my-love/research-iphone-duo-pwa-support/research-iphone-duo-pwa-support.md, _bmad-output/initiative-my-love/deferred-work.md, src/components/Navigation/AppNavigation.tsx, AGENTS.md, index.html]
companions: [_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/duo-observed-layouts.md, _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/sim-driver-prototype/]
after: []
risk: high
---

# iPhone Duo Side-Column Dock

## Description

On iPhone Duo, iOS puts its status in a side column in some poses, and the app's own HTML dock floats over content at the bottom (`duo-observed-layouts.md`). Instagram, Facebook, Netflix and others put their tabs in that column. On 2026-10-30 the owner's Duo showed the current shell already drawing web content into the column, its header and cards running under iOS's status capsule, so the app's own dock can move there: story 7 found taps there reach the page in the shell; no native tab bar is needed (`index.html` has set `viewport-fit=cover` since 2026-08-18). When this epic is done, wherever the page has a side column the dock is a capsule of buttons at its bottom, with Settings as a sixth, and everywhere else the header and bottom dock stay as they are.

## Outcome

On the iPhone Duo, the couple reaches the five destinations and Settings from the side column, as in Instagram and Facebook, with nothing covered by the dock. The signal is device descriptions and test-account screenshots of the Duo in each pose matching the column layout in `duo-observed-layouts.md`.

## Requirements

R1 (owner direction 2026-10-30): In every pose where the page has a side column (on the Duo, outer portrait, both outer landscapes, inner landscape and the right pane of two apps side by side), the dock is a vertical capsule of buttons at the column's bottom, and above it the page's header and content run on under iOS's status as today; in every other pose and device it is today's bottom dock, and changing pose switches between the two without a reload or a change of view. Met when simulator and device screenshots show the capsule in each column pose and the bottom dock in inner portrait, and folding, unfolding or rotating keeps the view on screen.

R2 (AppNavigation DESTINATIONS): Each column-dock button opens the same view, URL and history entry as the matching bottom-dock button, and the button of the view on screen is marked active, whatever changed the view. Met when each button opens its view and shows active, and a reload reopens that view with its button marked.

R3 (AppNavigation aria-label): Every column-dock button has an accessible name that VoiceOver reads: Home, Mood, Love Notes, Photos, Partner and Settings. Met when VoiceOver on the device, or Accessibility Inspector on the simulator, reads all six in a column pose.

R4 (AGENTS.md dock clearance; owner decision 2026-10-30): In column poses nothing the app draws sits under the column dock and no bottom-dock-sized empty band remains at the bottom; content may run under iOS's status capsule. Love Notes ends at the column dock's edge and runs down to the bottom of the screen. Met when, in each column pose, every view scrolled to its end shows its last item whole and clear of the column dock, and Love Notes' composer sits at the bottom of the screen beside the column dock.

R5 (AGENTS.md native iOS shell; research rec 4): Wherever no side column reaches the page (other iPhones, desktop browsers, the Duo in inner portrait and in the left pane of two apps side by side, and Safari and the Home Screen web app, which keep the column outside the page on the Duo), the header, its Settings gear and the five-button bottom dock look and work as today, in the website, the Home Screen web app and the shell alike, including a shell that takes the new web code by live update. Met when a non-Duo iPhone simulator and the Duo in inner portrait show today's header and dock, and the dock's E2E specs pass.

R8 (owner decisions 2026-10-30): In column poses Settings is a sixth button in the column dock, marked active while Settings is open, and the header shows no Settings gear; where there is no column the gear stays in the header and the bottom dock keeps its five buttons. Met when, in each column pose, the column's Settings button opens Settings and shows active with no gear in the header, and in inner portrait the gear opens Settings beside a five-button dock.

## Constraints

- The first story finds, on the Xcode 27.1 iPhone Duo simulator and on the owner's Duo, how the web code learns the side column's position and width in each pose (safe-area insets or measurement) before the dock is built; the 2026-10-29 and 2026-10-30 observations disagree on where content stops (owner decision 2026-10-30).
- The dock's form follows what the page learns about the column, never a device or model check, so any device that gives the page a column gets the column dock (research rec 1).
- The column dock is the existing `AppNavigation` dock in a second form, not a second navigation, and its buttons go through the same navigation (`navigationSlice.currentView` and its URL handling), so history and reload behave alike (AGENTS.md, Conventions).
- The dock variables in `src/index.css` (`--dock-clearance`, `--dock-top`, and any side clearance the column form adds) stay the one source for the space the dock takes, in both forms, because the dock is fixed and layout cannot see it (AGENTS.md, dock clearance).
- Poses, the column and insets are checked on the iPhone Duo simulator (iOS 27.1) and the owner's Duo; Playwright cannot emulate the column, safe-area insets, standalone mode or posture (research Q5).
- Screenshots committed as evidence come only from fictional fixture accounts, story 7's production test couple or the local stack's; the owner's device screenshots carry real names, so they are described in words and never committed, because the repo is public (AGENTS.md, Policy; owner decision 2026-10-30).

## Done when

1. On the owner's Duo, folded and in unfolded landscape the dock is a capsule at the bottom of the side column with its six buttons and no gear in the header; in unfolded portrait it is today's bottom dock with the gear; folding and unfolding switch between them without a reload, and nothing sits under the column dock (R1, R4, R8).
2. Each column button opens its view with the same URL and history as the bottom dock and shows active, and VoiceOver reads each button's name (R2, R3).
3. A non-Duo iPhone, a desktop browser and the Duo in inner portrait show today's header and bottom dock, and the dock's E2E specs pass (R5).
4. The web part ships through `deploy.yml`, reaches the owner's Duo shell by live update (or a reinstall if native code changed), and CI is green on main.

## Boundaries

- A native `UITabBar` or any other native navigation (owner direction 2026-10-30).
- A sixth button in the bottom dock: there is no room on a phone (AGENTS.md); the gear stays in the header where there is no column (R8).
- Any change to the five destinations themselves.
- Fold APIs (research rec 6) and fold-aware layouts of the views themselves (two-pane content, partially folded poses).
- The shell's default app icon and splash screen, the other half of DW-326.
- Haptics (DW-325).
- Unseen-count badges on the dock, parked until the dock gets real counts (DW-327).

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md (no Requirements yet, so this epic cites its sources directly)
- research — _bmad-output/initiative-my-love/research-iphone-duo-pwa-support/research-iphone-duo-pwa-support.md, sections Q2, Q4, Q5 and Recommendations
- deferred-work — _bmad-output/initiative-my-love/deferred-work.md, DW-325, DW-326 and DW-327
- code — src/components/Navigation/AppNavigation.tsx (`DESTINATIONS`, the header gear, the dock); index.html (`viewport-fit=cover`)
- project-context — AGENTS.md, Maintained by hand (native iOS shell; dock clearance)
- companion — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/duo-observed-layouts.md
- companion — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/sim-driver-prototype/ (the simulator runner story 9 ports)
- plan — _bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-find-how-the-web-code-learns-the-side-column-s-position-and-plan.md (story 7's Setup and Findings, which stories 9, 2 and 8 build on)

## Notes

- Source conflict: R3 — R3 asked each tab to carry the badge the dock shows, but the dock's only caller (src/App.tsx, `<AppNavigation>`) passes no `badgeCounts`, so the dock has never shown a badge.
- Decision: 2026-10-29 R3 narrowed to VoiceOver reading each tab's name; settles the R3 source conflict.
- Parked: dock badges, until the dock gets real counts (DW-327 in the deferred-work ledger).
- Decision: 2026-10-29 story 5 (ship to the Duo) runs after the refactor sweep, so the cleaned-up code is what gets deployed and checked on the device; a deliberate exception to the sweep closing the epic.
- Decision: 2026-10-30 replanned on the owner's new evidence: on the owner's Duo the current shell draws web content into the side column (header and cards under iOS's status capsule), so DW-326's premise that iOS keeps web content out of the column no longer holds. The native `UITabBar` approach is dropped; the app's own HTML dock becomes a vertical bar in the column, buttons grouped at the bottom, with Settings as a sixth button. What is required changed: R1–R5 and R8 rewritten with ids kept; R6, R7, R9 and R10 retired, since they asked things of a native bar that an HTML dock inside the one web view already does (it mounts only where `AppNavigation` does and every overlay covers it). The 2026-10-29 tab-bar decisions (every iPhone, gear in the header, tab selection on Settings, SF Symbols, Back/Forward, overlay hiding, the story 6 split, the tracer) are superseded and kept in `.memlog.md`.
- Decision: 2026-10-30 the bottom dock stays at five and the header gear stays wherever there is no column; in column poses the header shows no gear, so each screen has one Settings control.
- Decision: 2026-10-30 content may run under iOS's status capsule; it must only stay clear of the column dock (R4).
- Decision: 2026-10-30 epic retitled "iPhone Duo Side-Column Dock"; the folder slug `epic-iphone-duo-native-tab-bar` stays, because renaming it breaks the paths in its memlog, companions and commit history.
- Decision: 2026-10-30 the Boundary "no `viewport-fit=cover`" is removed: `index.html` has set it since da0c1d32 (2026-08-18), for the website, the Home Screen web app and the shell alike.
- Dropped: 2026-10-30 story 1 (a system tab bar around the shared web view): the native tab bar was dropped after the owner's evidence; its build on `feature/native-tab-bar` is abandoned unmerged, and its simulator proof never ran.
- Dropped: 2026-10-30 story 6 (the tab bar hides under every overlay): an HTML dock is covered by every overlay already, so R10 is retired.
- Dropped: 2026-10-30 story 3 (the selected tab follows the view): the dock marks the active view from `currentView`, so selection sync has nothing to sync; its Settings behaviour moves to story 8.
- Decision: 2026-10-30 re-sliced: story 7 (the spike) first, then story 2 revised in place as the column dock, story 8 for Settings in the column, then the sweep (4) and the ship (5). Story 7 goes first by the owner's split: the least certain part is how the page learns the column, and nothing else can be built until that is known; it runs on the owner's Duo as well as the simulator. The slicing rules would open with a tracer instead; here story 2 is the tracer, the thinnest path through every layer (detection, dock, clearance, navigation), built right after the spike.
- Decision: 2026-10-30 risk high is checked by people, not criteria alone: story 7 is hitl and the owner reads its result before story 2's unknown is cleared, and stories 2, 8 and 5 each end in a person's simulator or device check.
- Decision: 2026-10-30 the dropped stories 1, 6 and 3 keep their text and `after`; only their `covers` were cleared, because they cited R6, R7, R9 and R10, which are retired.
- Decision: 2026-10-30 the column dock is a capsule of buttons at the column's bottom, not a full-height bar; above it the header and content run on under iOS's status, so only the capsule needs clearance (R1, R4).
- Decision: 2026-10-30 in the column the active button shows its icon on a highlight without its label, as the other apps' column tabs do (`duo-observed-layouts.md`); the label stays the accessible name. Replaces the assumption.
- Decision: 2026-10-30 `bmad-ux` declined: the column dock uses the bottom dock's glass, button size and active highlight, Settings sits last in the group, and the capsule's width follows the column width story 7 measures.
- Decision: 2026-10-30 story 2 is kept whole rather than splitting clearance and Love Notes into their own story: a column dock that covers content is not shippable on its own.
- Decision: 2026-10-30 in the native shell the header's top-left holds a notifications button (_bmad-output/backlog/story-native-shell-live-update-prompt.md, criterion 9); story 8 keeps it at the top-left in column poses, with a matching space on the right where the gear was so the wordmark stays centred. Neither story waits on the other.
- Decision: 2026-10-30 story 2's unknown is settled by story 7 (plan Findings, detection method): the page has a column when exactly one of `env(safe-area-inset-left/right)` is non-zero, read in JavaScript and re-read on `visualViewport` resize, `screen.orientation` change and a ResizeObserver; no native code is needed, so the Constraint on a native plugin does not apply, story 3.1 does not wait on 2.2, and epic 4 does not get epic 2 back in its `after`. Only the shell draws under the column; Safari and the Home Screen web app keep the bottom dock. Story 7 marked done (merged in #417).
- Decision: 2026-10-30 replanned so a bmad-loop run builds stories 9, 2, 8 and 4 with no person: another session drove the iPhone Duo simulator (iOS 27.1) with no one clicking, folding and rotating with `ax` and tapping and reading the page as text through an XCUITest runner. What is required is unchanged; only how it is checked. New story 9 turns that runner (the `sim-driver-prototype/` companion, copied from a scratch folder with relative paths and the simulator as an argument) into a repo tool; stories 2 and 8 run their simulator checks through it and are no longer hitl. Story 5 stays hitl.
- Decision: 2026-10-30 simulator checks are trusted for the shell only (owner constraint): story 7 found the simulator's Home Screen web app and Safari differ from the Duo, while the shell matched exactly. Expected Safari and web-app behaviour comes from story 7's Duo rows, no unattended story checks them on a simulator, and the ship stories (2.5, 3.11, 4.5) stay hitl as the backstop for differences nobody has measured.
- Decision: 2026-10-30 the loop's simulator checks run against the local stack with local fixture accounts, never production's test couple, so a run needs no production credentials and writes nothing to production (owner decision).
- Decision: 2026-10-30 R3's Accessibility Inspector check is met on the simulator by the driver reading each button's accessibility label from the same accessibility tree; VoiceOver on the device stays with story 5.
- Decision: 2026-10-30 supersedes the risk-high decision above for stories 2 and 8: they end in the driver's simulator check, not a person's; story 5's device check is the person's.
- Decision: 2026-10-30 story 9 owns the DW-328 check (both side insets on a non-Duo iPhone simulator in portrait and each landscape), so story 2 builds on a measured rule; story 2 still confirms the bottom dock there.
- Decision: 2026-10-30 build order is 7, 9, 2, 8, 4, 5. Story 9 comes before the tracer (story 2) because it is check tooling, not a product layer: story 2 cannot run its simulator checks without it. Story 2 stays the tracer.
- Decision: 2026-10-30 story 9 carries the non-Duo simulator risk in its description, not as an `unknown`, because an `unknown` holds the loop before the story starts; any non-Duo iPhone simulator that renders the shell answers DW-328, and if none does the build blocks and the story is re-sliced.
- Decision: 2026-10-30 the side-by-side right pane, where story 7 found the shell gets the column, is checked by story 2's unit tests (the pane swap only a ResizeObserver reports) and on the device by story 5, since no driver step enters split view yet.
- Decision: 2026-10-30 story 8 also covers R4, because six buttons make the capsule taller than story 2's clearance was checked against; story 2 is retitled "capsule", after the Decision that the dock is a capsule, not a full-height bar.
- Decision: 2026-10-30 a loop run that reaches story 9 or any story checked through its driver needs, for the whole run, ax and xcodegen installed with every `ax doctor` line ok, the Mac unlocked, Device Hub open, not minimised and on the current Space or assigned to All Desktops (it need not be in front; tested 2026-10-30), and the local stack running; story 9 writes this into AGENTS.md, and the run handover names it.
- Decision: 2026-10-30 `ax` (the pose and rotate tool, a compiled binary in `~/.local/bin`) is a Mac prerequisite that story 9 records in AGENTS.md, checked with `ax doctor`; no source exists to commit (owner decision).
- Decision: 2026-10-30 R1 and R5 re-derived with story 7's settled poses in place of their conditionals, the native-plugin Constraint retired, the screenshots Constraint widened to the local stack's fixture accounts, and the simulator Constraint corrected to the iOS 27.1 runtime; ids kept, no story's `covers` changes.
