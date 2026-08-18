# Navigation redesign — bottom tabs to a hamburger tray

Companion to `SPEC.md`, covering CAP-5, CAP-8 and CAP-9. Sallvain added this knowingly — *"Might be out of scope but I want it included anyway"* — so it is specified here rather than in its own folder. It has **no data dependency on the events table** and can ship before or after the events work; the only coupling runs one way, from CAP-5 needing a reachable Settings.

## What exists today

`src/components/Navigation/BottomNavigation.tsx` is 119 lines. Its whole interface is four props (`:4-9`):

```tsx
interface BottomNavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSignOut: () => void;
  signOutDisabled?: boolean;
}
```

It renders one `<nav>` (`:18-21`) holding seven `<button>` elements — six destinations plus Logout:

```tsx
      className="safe-area-bottom fixed right-0 bottom-0 left-0 z-40 border-t border-gray-200 bg-white"
      data-testid="bottom-navigation"
```

with the row itself at `:22`, `<div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-4">`. The `h-16` is 64px, and that number is hardcoded in four other places (below).

Each button carries a `data-testid` and an `aria-label`: `nav-home`/`Home` (`:29-30`), `nav-mood`/`Mood` (`:42-43`), `nav-notes`/`Love Notes` (`:55-56`), `nav-partner`/`Partner` (`:70-71`), `nav-photos`/`Photos` (`:83-84`), `nav-scripture`/`Scripture` (`:96-97`), `nav-logout`/`Logout` (`:110-111`).

Icons come from lucide-react (`:1`): `Heart` home, `Smile` mood, `MessageCircle` notes, `Users` partner, `Camera` photos, `BookOpen` scripture, `LogOut` logout. Active state is `text-pink-500` (`text-purple-500` for scripture) against `text-gray-500 hover:text-gray-600`, with `fill-current` on the active icon — on five of the six; `:86` `<Camera className="mb-1 h-6 w-6" />` omits it, so Photos never fills.

It is rendered exactly once, `src/App.tsx:585-593`, deliberately outside the error boundary:

```tsx
        {/* Bottom navigation - always visible, outside error boundary */}
        <BottomNavigation
          currentView={currentView}
          onViewChange={setView}
          onSignOut={() => {
            void handleSignOut();
          }}
          signOutDisabled={isSigningOut}
        />
```

## Three things that are already broken

Fix or deliberately preserve each; do not copy them forward.

1. **`safe-area-bottom` is not a class.** `:19` applies it, and a repo-wide grep finds that usage and no definition — it is not a Tailwind utility, so it emits no CSS. `src/index.css:133-139` defines `.safe-top` and `.safe-bottom`, which nothing uses.

2. **…and switching to `.safe-bottom` alone would not fix it either.** `index.html:6` is `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`. Without `viewport-fit=cover`, `env(safe-area-inset-*)` resolves to 0 in every browser, so both classes are inert wherever applied. A real fix is two edits, and Sallvain resolved the open question to make both here: add `viewport-fit=cover` to the meta, and use the real `.safe-top`/`.safe-bottom` classes on the new chrome.

3. **No `aria-current`.** `grep -c "aria-current"` over the file returns 0; the active destination is conveyed by colour alone. Sallvain resolved this: the tray adds `aria-current` to its active destination. Also, only the Scripture button carries the 48px touch-target classes — `grep -c "min-h-\[48px\]"` returns 1 — the other six rely on the `h-16` row height, which disappears with the bar.

## Five layout values that hardcode the bar

Each must be swept when the bar goes, or it leaves a visible artefact:

| Site | Value | What breaks if missed |
|---|---|---|
| `src/App.tsx:515` | `min-h-screen pb-16` | A dead 64px strip at the bottom of every view |
| `src/components/love-notes/LoveNotes.tsx:88` | `h-[calc(100vh-4rem)]` | Chat viewport 64px short; the only `calc` of its kind in `src/` |
| `src/components/PhotoGallery/PhotoGallery.tsx:306` | FAB at `bottom-20` | Upload button floats with an unexplained 80px gap |
| `src/components/InteractionHistory/InteractionHistory.tsx:94` | `fixed inset-x-4 top-20 bottom-20` | Overlay inset against a bar that no longer exists |
| `src/components/PokeKissInterface/PokeKissInterface.tsx:448` | toast at `top-20` | Toast positioned for clearance it no longer needs |

## Where the hamburger goes

There is no top bar to hang it on. `src/App.tsx:524` is `<main id="main-content">`, sitting directly under `NetworkStatusIndicator` and `SyncToast` with no header above it. Six `<header>` elements do exist in `src/`, across five files, but all are scoped inside feature views (`LoveNotes.tsx` and four scripture containers) — none is app chrome. So the hamburger needs a new fixed affordance or a new app-level header, and that is new design rather than a relocation.

Note `id="main-content"` has no matching skip link anywhere; a new header is the natural moment to add one, but nothing regresses if it does not.

## Accessibility contract

The repo already has what a tray needs, and a documented way to get it wrong.

Use `src/hooks/useFocusTrap.ts` — `useFocusTrap(containerRef, enabled, options)` at `:21-25`, documented at `:14-15` as *"Traps keyboard focus within a container element (WCAG 2.4.3)."* / *"Optionally handles Escape key for dismissal."* Options are `onEscape` (`:8`) and `initialFocusRef` (`:10`); `:28` `const restoreRef = useRef<HTMLElement | null>(null);` is the focus-restore-on-close half. Five call sites already use it: `MoodDetailModal.tsx:99`, `ReadingContainer.tsx:81`, `PhotoViewer.tsx:124`, `NoteRemoveConfirmation.tsx:73`, and `scripture-reading/hooks/useReadingDialogs.ts:47`.

**The Escape handler must be identity-stable.** `NoteRemoveConfirmation.tsx:48-53` records why:

> `// useFocusTrap lists onEscape in its effect deps and re-focuses initialFocusRef`
> `// on every run, so any change of identity re-arms the trap and drags focus back`
> `// to Cancel -- which a `isRemoving ? undefined : onClose` ternary did on every`
> `// write, and an inline arrow from the parent did on every parent render.`

The working shape is `:58-61` a latest-ref, `:63-67` a `useCallback` with an empty dep array, then `:73-76` the `useFocusTrap` call. `:54-57` explains why a latest-ref beats a dependency: it *"must hold even when a caller passes an inline arrow, which is the normal React thing to do."*

Dialog markup convention is `role="dialog"` with `aria-modal="true"` (`NoteRemoveConfirmation.tsx:174-175`, `PhotoViewer.tsx:489-490`). A hamburger additionally needs the disclosure half on the trigger — `aria-expanded` and `aria-controls` pointing at the tray — which no existing component models, because all five current `useFocusTrap` call sites are dialogs opened from a button that then disappears behind them.

House standard is a dedicated focus test per dialog: `MoodDetailModal.focus.test.tsx` and `PhotoViewer.focus.test.tsx`. The tray should ship with the equivalent. Recent history backs this — commits `9c23cb1f`, `105f1711` and PR #266 (`fix/dialog-focus-restore`) all hardened exactly this area.

Animation: roughly ten components pair framer-motion `AnimatePresence` with a `fixed inset-0` backdrop; `AnniversarySettings.tsx:285-286` is a representative overlay (`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4` with `onClick={onClose}`). There is no existing drawer, sidebar or slide-in panel anywhere to copy, so the tray's motion is new work.

## Registering the `settings` view

Five hand-maintained sites, per `AGENTS.md:25` — *"Only `pathMap` is typechecked, so missing the rest still compiles, renders nothing, and resets to home on reload."*

1. `ViewType` — `src/stores/slices/navigationSlice.ts:18`, currently `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'`
2. `pathMap` — `navigationSlice.ts:44`, `const pathMap: Record<ViewType, string>` (the one typechecked site)
3. Initial-route ternary — `src/App.tsx:152-163`, chain ending `: 'home'`
4. Popstate ternary — `src/App.tsx:169-180`, the same chain repeated
5. The tray itself, replacing `BottomNavigation.tsx`

Plus the `currentView ===` render chain, `App.tsx:568-579`, inside the `ViewErrorBoundary` at `:566` and `Suspense` at `:567`.

## Sign-out consolidation (CAP-9)

Sallvain: *"The one in settings should survive, that's where you would usually find a sign out button, remove the other one."*

The surviving control is `Settings.tsx:32-48`, which calls `authService.signOut()` at `:37`. The one being deleted is `BottomNavigation.tsx:106-115` (`onClick={onSignOut}` at `:107`, `aria-label="Logout"` at `:111`), wired to `App.tsx:12` `import { signOut } from './api/auth/actionService';` and `:130` `await signOut();`.

These are **two different code paths**, not two buttons on one path. Before deleting the App-level wiring, confirm `authService.signOut()` does everything `actionService.signOut()` does — `AGENTS.md:54` warns that account state is cleared only through `signedOutState()`, and `Settings.tsx:41-42` comments `// Session will be cleared by auth state listener in App.tsx` / `// User will automatically be redirected to LoginScreen`. If the surviving path does not reach the same reset, CAP-6 and CAP-9 both fail quietly on a shared device.

## Test impact

15 `nav-*` references across 5 live specs — **11 `.click()` calls and 4 `toBeVisible()` assertions**:

| Spec | Lines |
|---|---|
| `tests/e2e/home/routing.spec.ts` | `:25`, `:37` nav-photos click; `:41` nav-home click; `:45` nav-home visible |
| `tests/e2e/home/error-boundary.spec.ts` | `:26`, `:38` nav-photos click; `:42` nav-home click; `:46` nav-home visible |
| `tests/e2e/navigation/routing.spec.ts` | `:33` nav-photos click; `:37` nav-mood click; `:55` nav-home visible |
| `tests/e2e/scripture/scripture-overview.spec.ts` | `:34` nav-scripture visible; `:42` nav-scripture click |
| `tests/e2e/auth/logout.spec.ts` | `:27`, `:49` nav-logout click |

**Plus a live unit test that nothing above counts.** `src/components/Navigation/__tests__/BottomNavigation.test.tsx` is 179 lines with 19 `nav-` references. It tests the component being deleted, so unlike the E2E specs it does not need adapting — it needs replacing wholesale with the tray's own test. It is also the fastest signal: it fails on `npm run test:unit` the moment the component changes, without a browser.

Three distinct kinds of change to the E2E specs, in rising order of cost:

1. **Clicks** need an open-the-tray step inserted before them.
2. **The four `toBeVisible()` assertions change meaning.** A tab that is always on screen becomes a destination hidden inside a closed tray. `tests/e2e/home/routing.spec.ts:22-28` and `error-boundary.spec.ts:45-46` both assert the nav stays visible *through a lazy-load* — a semantic a closed tray does not satisfy at all, so these need rethinking rather than rewriting.
3. **The two `nav-logout` clicks need a whole new flow** — open tray, enter Settings, sign out there — because CAP-9 deletes the control they target.

Separately, the `bottom-navigation` testid is used **14 times, across three of those five specs** (`home/error-boundary.spec.ts` 5, `home/routing.spec.ts` 5, `navigation/routing.spec.ts` 4), mostly as an "app is loaded" readiness proxy rather than as a navigation assertion. That idiom has no direct equivalent once the destinations live inside a closed tray; a stable testid on the hamburger itself is the natural replacement.

Two further notes:

- **No shared navigation helper exists.** A grep of `tests/support/` for `navigateTo` or `getByTestId('nav` finds only scripture-specific helpers (`scripture-lobby.ts:246` `navigateToTogetherRoleSelection` and its two consumers), none of which touch the tabs. All 15 sites are hand-written. Since the change has to touch all of them anyway, introducing one shared helper is worth proposing — a future nav change would then touch one file.
- **`tests/e2e/scripture/scripture-overview.spec.ts` carries no priority tag.** `grep -c "\[P0\]"` and `grep -c "\[P1\]"` both return 0, and `package.json:28-29` define `test:p0` as `--grep '\[P0\]'` and `test:p1` as `--grep '\[P0\]|\[P1\]'`. So that spec runs in neither script, and a break there surfaces only on a full-suite run.

`tests/e2e-archive/bottom-nav.spec.ts` costs nothing — it is entirely `test.skip()` stubs with no selectors, and `AGENTS.md:13` forbids repairing anything in that directory regardless.

## The tray must carry a badge slot

A separate spec, `../spec-partner-activity/`, adds an unseen-count badge per destination (new love notes, new photos, new events). That feature and this one collide in a way worth designing for now rather than retrofitting: **a badge on a destination inside a closed tray is invisible**, which defeats the badge's entire purpose.

So the tray needs two things the old bar did not:

1. **An aggregate indicator on the hamburger button itself** — a dot or a count, visible while the tray is closed, meaning "something in here is new".
2. **A per-destination count slot inside the open tray**, in the same idiom as the existing badge at `PokeKissInterface.tsx:410-424` (`data-testid="notification-badge"`, an `aria-label` of the form `"N unviewed interaction(s)"`, and an `onClick` that calls `e.stopPropagation()` before acting).

Neither needs the other spec to exist first — the markup slot can ship empty and stay unused until the counts arrive. But retrofitting an aggregate indicator onto a finished hamburger is more disruptive than allowing for one now, so allow for it now.

Announcements follow the established convention: `aria-live="polite"`, as at `MoodHistoryCalendar.tsx:255` and asserted by `MessageCompose.test.tsx:226-231` and `DisconnectionOverlay.test.tsx:66`.

## Scale

Roughly 4 source files and 7 test files — 5 E2E specs, the `BottomNavigation` unit test, and whatever new test the tray brings. The component swap is small; the cost is concentrated in the five hardcoded offsets and in the test rewrites, particularly the logout spec and the four visibility assertions that need new semantics rather than new selectors.
