---
title: 'Bottom dock navigation replaces the hamburger tray'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_commit: 'd5b0357b808d3e9be7225db7d5a15b77ff703aa1'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app chrome is a grey bar with a hamburger and a plain "My Love" label; Sallvain dislikes its look, and every destination hides behind a tap-to-open tray.

**Approach:** Build option D from the design canvas (artboard `D-Bottom-Dock.dc.html`): a slim top bar with a centred "My Love" wordmark in Dancing Script (pink) and a Settings gear on the right, plus a floating frosted-glass bottom dock holding Home, Mood, Love Notes, Photos, Partner. The active dock item is a pink pill with icon + label; the others are icon-only. The tray, backdrop and focus trap are removed.

## Boundaries & Constraints

**Always:** Top bar stays sticky, in normal flow, 4rem tall plus `.safe-top` — so every existing `4rem`/`5rem` top offset (MoodTracker sticky tabs, SyncToast, PartnerMoodView, PokeKiss, InteractionHistory) stays correct untouched. Bar background is translucent with backdrop blur and no border (light `white/70`, dark `gray-900/70`). Dock is `fixed`, `z-40`, inset 1rem from each side and capped at `max-w-md` (28rem), centred, on wider screens, bottom `calc(1rem + env(safe-area-inset-bottom))`, ~60px tall, rounded-full, translucent + blur. Dock clearance lives in ONE place: a `--dock-clearance: calc(6rem + env(safe-area-inset-bottom))` custom property in `src/index.css`, consumed via Tailwind `(--dock-clearance)` syntax. Every dock item and the gear is a real `<button>` ≥44px with `aria-label`; the active one carries `aria-current="page"`; the gear carries it on Settings. Keep `badgeCounts` prop: a positive count renders a badge on that dock item (`nav-${view}-badge`, same aria-label idiom); `settings` counts are ignored. Testids: `app-header`, `nav-dock` on the dock `<nav aria-label="Primary">`, `nav-home|mood|notes|photos|partner`, `nav-settings` on the gear. Dock visible on every app view, Love Notes included.

**Never:** No react-router. No change to `navigationSlice`/`ViewType`/routing. No hiding the dock on keyboard open or scroll. No edits under `tests/e2e-archive/`. No fixing the dark-mode pink page background (separate issue). No change to z-50+ overlays — they already sit above a z-40 dock.

</frozen-after-approval>

## Code Map

- `src/components/Navigation/NavigationTray.tsx` -- rewrite as `AppNavigation.tsx` (export `AppNavigation`, `AppNavigationProps`); keep lucide icons already used; font class `font-cursive` exists (`tailwind.config.js:75`, loaded `index.css:1`).
- `src/App.tsx:4,736` -- import/render; `<main id="main-content">` gets `pb-(--dock-clearance)`. Update the comments at ~733 that describe the tray.
- `src/index.css` -- add `:root { --dock-clearance: … }`.
- `src/components/love-notes/LoveNotes.tsx:126` -- height becomes `calc(100vh - 4rem - env(safe-area-inset-top) - var(--dock-clearance))`; drop its now-redundant `pb-[env(safe-area-inset-bottom)]`. Composer (`MessageInput.tsx:208`) then clears the dock without edits.
- `src/components/PhotoGallery/PhotoGallery.tsx:309` -- upload FAB bottom → `bottom-(--dock-clearance)`.
- `src/components/WelcomeButton/WelcomeButton.tsx:13` -- same bottom change.
- `tests/support/helpers/navigation.ts` -- `navigateTo(view)` clicks `nav-${view}` directly (settings → `nav-settings`); delete `openNavTray`, `closeNavTrayWithEscape`; fix re-export `tests/support/helpers/index.ts:16`. Its 56 call sites need no edits.
- Readiness checks on `nav-menu-toggle` → `nav-dock`: `tests/e2e/home/routing.spec.ts:27-49`, `home/error-boundary.spec.ts:28-50`, `auth/logout.spec.ts:86`, `navigation/routing.spec.ts:29-72` (also its 3 `openNavTray` calls; aria-current asserts at :33,:77,:96 keep working).
- `tests/e2e/navigation/tray.spec.ts` -- replace with `dock.spec.ts`.
- `src/components/Navigation/__tests__/NavigationTray.test.tsx`, `NavigationTray.focus.test.tsx` -- replace with `AppNavigation.test.tsx`; the focus test is deleted (no trap exists).
- `tests/unit/App.callbackNotice.test.tsx:68`, `tests/unit/App.eventsSession.test.tsx:63` -- `vi.mock` path → new module.
- `AGENTS.md` "Where things are" -- `DESTINATIONS` now lives in `Navigation/AppNavigation.tsx`; note Settings is the gear, not a dock item.

## Tasks & Acceptance

**Execution:**
- [x] `src/index.css` -- add `--dock-clearance` -- single source for dock space
- [x] `src/components/Navigation/AppNavigation.tsx` -- new top bar + dock per Boundaries; delete `NavigationTray.tsx` -- replaces tray
- [x] `src/App.tsx` -- swap import/render, main bottom padding, comments -- wire it in
- [x] `LoveNotes.tsx`, `PhotoGallery.tsx`, `WelcomeButton.tsx` -- consume `--dock-clearance` -- nothing sits under the dock
- [x] `src/components/Navigation/__tests__/AppNavigation.test.tsx` -- cover labels, click → `onViewChange`, aria-current (dock + gear), badge render/zero/negative/settings-ignored, badge click selects its view; delete both old tray tests
- [x] `tests/unit/App.*.test.tsx` -- mock path
- [x] `tests/support/helpers/navigation.ts` + `index.ts` -- direct-click helper
- [x] E2E specs listed in Code Map -- readiness testid + remove tray steps; `tests/e2e/navigation/dock.spec.ts` [P1]: dock and gear visible without any tap, each destination reachable in one tap, aria-current follows
- [x] `AGENTS.md` -- update nav registration line (separate docs commit)

**Acceptance Criteria:**
- Given any app view, when it renders, then the top bar shows only the cursive "My Love" and a gear, and the dock shows five destinations with the current one as a labelled pink pill.
- Given Love Notes on a 390×844 viewport, when the page loads, then the composer is fully visible above the dock and the page does not scroll.
- Given Photos or Home, when scrolled to the bottom, then the last card and the upload FAB / welcome button are not covered by the dock.
- Given dark and light OS themes, when viewed, then bar, dock and wordmark use their themed colours with ≥4.5:1 text contrast.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Iteration 0 (blind-hunter, edge-case-hunter, verification-gap):

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | Dock has no max width; spans the whole window on desktop (`AppNavigation.tsx` nav, `inset-x-4 justify-between`) | low | Real: no `max-w-*`; five 44px items spread across the full viewport while Home content caps at `max-w-4xl`. The frozen "inset 1rem from each side" rules out a cap, and the intent never considered wide screens | intent_gap → resolved by human (2026-09-22): cap at `max-w-md`, centred; frozen text amended; applied as patch without revert |
| 2 | LoveNotes height uses `100vh`; in an iOS Safari tab with toolbars showing, the composer lays out below the dock top | medium | Real: `LoveNotes.tsx:126` still uses `100vh`, which is the large viewport in Safari. Before, the composer fell off-screen; now it sits under the z-40 dock. `100dvh` fixes it | patch |
| 3 | Double bottom safe-area padding: Home (`App.tsx:749`), `PhotoGallery.tsx:264`, `PhotoGridSkeleton.tsx:34`, `MoodTracker.tsx:310`, `PartnerMoodView.tsx:344` | low | Real: `--dock-clearance` on `<main>` already includes `env(safe-area-inset-bottom)`, and each view adds it again. LoveNotes had its copy removed for exactly this reason | patch |
| 4 | Comments still cite deleted tray files/flow: `EventsSettings.errorIsolation.test.tsx:44-45`, `EventsSettings.focus.test.tsx:5,179`, `events-crud.spec.ts:9`, `events-persistence.spec.ts:205` | low | Real: grep confirms all five references; their targets were deleted by this change | patch |
| 5 | WelcomeButton clearance untested; a regression would put the z-50 button over `nav-partner` on Home (verification-gap) | medium | Pre-verified gap: no test renders WelcomeButton, and Partner is never clicked from Home | patch |
| 6 | Photos upload FAB clearance tested only when the account has photos (`photo-upload.spec.ts` `.or()` falls back to the empty-state button) (verification-gap) | medium | Pre-verified gap | patch |
| 7 | Badge count not in the dock button's accessible name (`aria-label={label}` overrides content) | low | Real, but pre-existing: the tray used the same pattern, and no caller passes `badgeCounts` (grep over `src`) | defer |
| 8 | AGENTS.md doesn't state the `--dock-clearance` rule for new fixed-bottom elements or the five-slot dock limit | low | Real gap in agent context | defer |
| 9 | Chat background stops above the dock, leaving a strip | false | `light-notes.png`: the dock floats over the page gradient, as on every other view; nothing is clipped or covered | reject |
| 10 | `DESTINATIONS` not exhaustively typed | low | Pre-existing (the tray's array was identical); only matters when adding a view; exhaustive typing adds structure | reject |
| 11 | Contrast AC has no automated test | low | Covered by the spec's manual checks, where the implementer measured 4.67–7.06:1; automating it needs a new harness | reject |
| 12 | Touch targets dropped from 48px to 44px; no size test; tight at 320px | false / low | The frozen intent requires ≥44px. At 320px the pill still gets ~80px and truncates its label; 320px devices are rare | reject |
| 13 | Settings gear sits outside the `navigation` landmark | low | The gear is in the `banner` landmark, reachable by landmark navigation; a second `<nav>` adds structure for a rare path | reject |
| 14 | Offline banner (in normal flow, `shared/NetworkStatusIndicator.tsx`) pushes the Notes composer under the dock | low | Pre-existing overflow: the same banner pushed the composer off-screen before. Notes is Supabase-only, so it can't send offline anyway; the fix is structural | reject |

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npm run test:unit` -- expected: all pass
- `npx playwright test tests/e2e/navigation tests/e2e/home tests/e2e/auth/logout.spec.ts` (with `supabase start`) -- expected: all pass

**Manual checks:**
- `npm run dev:local`, 390×844, dark + light: screenshot Home, Notes, Photos, Settings.
