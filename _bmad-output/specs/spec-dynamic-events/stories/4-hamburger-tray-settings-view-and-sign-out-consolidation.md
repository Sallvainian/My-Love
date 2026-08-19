---
title: 'Hamburger tray, Settings view, and sign-out consolidation'
type: 'feature'
created: '2026-08-18'
status: 'in-review'
review_loop_iteration: 0
followup_review_recommended: false
baseline_commit: '55134ed8c62555eb9cc940853cfc350c85028a79'
baseline_revision: '55134ed8c62555eb9cc940853cfc350c85028a79'
context:
  - '{project-root}/_bmad-output/specs/spec-dynamic-events/navigation.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `Settings.tsx` is unreachable dead code — nothing in the repo imports it (grep for `components/Settings` outside the folder returns nothing), and `navigationSlice.ts:18` has no `'settings'` view — so story 5's events CRUD would have nowhere to live. The fixed bottom tab bar that would have to carry a seventh tab is also the thing holding the app's only sign-out, and it hardcodes its 64px height into five other files.

**Approach:** Replace `BottomNavigation` with a sticky app header carrying a hamburger that opens a focus-trapped tray of all seven destinations, register `settings` at the five hand-maintained sites, delete the App-level sign-out so Settings holds the only one, sweep the five bar-derived offsets, and rewrite every nav test against the new surface.

## Boundaries & Constraints

**Always:**
- The tray's Escape handler is identity-stable — latest-ref plus a `useCallback` with an empty dep array, the shape at `NoteRemoveConfirmation.tsx:58-67`. `useFocusTrap.ts:80` lists `onEscape` in its deps and `:48-53` re-focuses `initialFocusRef` on every run, so an unstable handler drags focus back on every render.
- The chrome is **sticky, not fixed**, and lives outside `<main>` — the same slot the bar occupies at `App.tsx:714-722` (inside `<ErrorBoundary>`, outside `ViewErrorBoundary`). A fixed header would need a compensating top pad in every view, re-creating the exact bug class this story exists to sweep.
- All seven destinations keep the existing `nav-<view>` testids, plus a new `nav-settings`. New testids: `nav-menu-toggle` on the hamburger, `nav-tray` on the panel, `settings-sign-out` on the Settings button.
- The hamburger carries `aria-expanded` and `aria-controls` pointing at the panel's id; the active destination carries `aria-current="page"`; each destination is at least 48px tall, since the `h-16` row that supplied that height is gone.
- Every events/nav destination row renders a per-destination badge slot, and the hamburger an aggregate indicator, both rendering nothing when no count is supplied — the idiom at `PokeKissInterface.tsx:410-421` (`data-testid="notification-badge"`, pluralised `aria-label`, `e.stopPropagation()`). `../spec-partner-activity/` fills them later; retrofitting an aggregate indicator onto a finished hamburger is the cost this avoids.
- All five bar-derived offsets are re-derived against the new chrome, not merely deleted. `top-20` at `InteractionHistory.tsx:94` and `PokeKissInterface.tsx:448` is a **top** inset that never cleared the bottom bar — adding top chrome makes those two newly meaningful in the opposite direction, so re-derive rather than shrink.
- `viewport-fit=cover` lands on `index.html:6` in the same commit as the `.safe-top`/`.safe-bottom` classes; without it `env(safe-area-inset-*)` is 0 and both classes are inert.

**Block If:**
- Signing out from Settings is observed **not** to clear account state through `signedOutState()`. Investigation says it does (chain below), but if the implementer measures otherwise, shipping leaks one couple's data to the next on a shared device — HALT rather than guess.
- A nav test rewrite cannot be made to pass without linking/unlinking partners, resetting a password, or nulling a shared row — those belong to other workers (`AGENTS.md:62`).

**Never:**
- No react-router (`AGENTS.md:45`); routing stays `navigationSlice.currentView` plus the two `App.tsx` ternaries.
- No edits under `tests/e2e-archive/` — `bottom-nav.spec.ts` there is skipped stubs and `AGENTS.md:13` forbids repairing it.
- No skip link for `id="main-content"`, and no fix for the second undefined class at `LoveNotes.tsx:90` `safe-area-top`. Both are adjacent and neither regresses; record, do not fix.
- No redesign of Settings' contents, and no events CRUD — that is story 5. This story only makes Settings reachable and gives its sign-out button a testid.
- Do not touch `PhotoViewer.tsx:595` `calc(100vh-8rem)` or `PhotoCarousel.tsx:177` `calc(100vh-12rem)` — modal image sizing, unrelated to the bar.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open tray | Tray closed, hamburger activated | Panel renders, `aria-expanded="true"`, focus moves inside | No error expected |
| Select destination | Tray open, a destination activated | View changes, tray closes, focus returns to the hamburger | No error expected |
| Escape | Tray open, Escape pressed | Tray closes, focus returns to the hamburger | No error expected |
| Outside click | Tray open, backdrop clicked | Tray closes, focus returns to the hamburger | No error expected |
| Tab wrap | Tray open, Tab from the last focusable | Focus wraps to the first; focus never leaves the panel | No error expected |
| Active marking | Tray open on `/photos` | Only the Photos destination has `aria-current="page"` | No error expected |
| Settings deep link | `GET /settings`, then reload | Settings renders both times; never resets to Home | Unknown route still falls back to Home |
| Back from Settings | On `/settings`, browser Back | Previous view renders; tray not involved | No error expected |
| Sign out | Settings sign-out activated | `POST /auth/v1/logout`, login screen, account state cleared | Server failure is logged, not shown: local sign-out is unconditional, so the user still lands on the login screen signed out |
| Empty badges | No counts supplied to the tray | No badge and no aggregate indicator render | No error expected |

</intent-contract>

## Code Map

**The bar and its render site**
- `src/components/Navigation/BottomNavigation.tsx` — 119 lines, deleted. `:4-9` the four props; `:19` `safe-area-bottom fixed right-0 bottom-0 left-0 z-40 …` + `data-testid="bottom-navigation"`; `:22` the `h-16` row; testids at `:29,42,55,70,83,96,110`. Read for the label/icon set only: `Heart` Home, `Smile` Mood, `MessageCircle` Notes, `Users` Partner, `Camera` Photos, `BookOpen` Scripture.
- `src/App.tsx:714-722` — the single render site (**not** `:585-593`; `navigation.md`'s App line numbers predate story 3). `:619` `min-h-screen pb-16`; `:628` `<main id="main-content">` with no header above it; `:694-711` the `currentView ===` render chain inside `ViewErrorBoundary` (`:695`) and `Suspense` (`:696`).

**The five registration sites** (`AGENTS.md:25` — only `pathMap` is typechecked)
- `src/stores/slices/navigationSlice.ts:18` `ViewType`; `:44` `const pathMap: Record<ViewType, string>` — the one typechecked site. Verified: the only other `ViewType` consumer is `BottomNavigation.tsx:2,5,6`, which is being deleted, and `Record<ViewType` appears nowhere else.
- `src/App.tsx:176-187` initial-route ternary; `:193-204` the popstate ternary repeating it. Neither is typechecked.
- `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx:73` `viewName: string` — takes a plain string, so `'settings'` needs no type change there.

**Sign-out — `navigation.md` is wrong here, and it de-risks the story**
- `src/api/authService.ts:10` `import { … signOut … } from './auth/actionService';` and `:23` re-exports it on the `authService` object. `src/App.tsx:18` imports **that same function**. They are one code path, not two — `navigation.md`'s "two different code paths" claim does not hold against the current tree.
- The reset is app-level and caller-independent: `src/App.tsx:248` `onAuthStateChange((newSession) => {` → `:267` `clearStoreAuth();` → `src/stores/slices/authSlice.ts:202-204` `clearAuth: () => { discardAccountState(…) }` → `signedOutState()`. Verify empirically, then delete App's wiring.
- Deleting it strands three things that must go with it or lint fails: `App.tsx:18` the import, `:94` `isSigningOut`, `:146-160` `handleSignOut`.
- `src/components/Settings/Settings.tsx:32-48` `handleLogout` — the survivor. It is strictly better than App's: `:45` surfaces `'Failed to sign out. Please try again.'` where `App.tsx:156` only `console.error`s. `:102` is the button and carries **no** `data-testid`.

**Settings is entirely dead code today**
- `src/components/Settings/Settings.tsx` — 172 lines, no testid anywhere, styled from `Settings.css` (`:7-12` `.settings-container { min-height: 100vh }`, `:219` `@media (prefers-color-scheme: dark)`). Renders three sections: Account, Anniversary, About.
- `src/components/Settings/AnniversarySettings.tsx` — imported **only** by `Settings.tsx:17`. Mounting Settings makes anniversary editing reachable for the first time; that is a consequence to expect, not new work.

**The five offsets — all verified at these lines**
- `src/App.tsx:619` `min-h-screen pb-16` — delete the pad.
- `src/components/love-notes/LoveNotes.tsx:88` `h-[calc(100vh-4rem)]` — the only `calc` of its kind in a view; re-derive against the header.
- `src/components/PhotoGallery/PhotoGallery.tsx:306` `fixed right-4 bottom-20 z-10` FAB.
- `src/components/InteractionHistory/InteractionHistory.tsx:94` `fixed inset-x-4 top-20 bottom-20 z-50 … md:top-1/2 …` — mobile arm only; the `md:` arm is centred and unaffected.
- `src/components/PokeKissInterface/PokeKissInterface.tsx:448` `fixed top-20 left-1/2 z-50` toast.

**Safe area**
- `index.html:6` `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` — no `viewport-fit=cover`.
- `src/index.css:133-139` `.safe-top`/`.safe-bottom` inside `@layer utilities` (93-140), currently referenced by nothing.
- Undefined classes in use: `BottomNavigation.tsx:19` `safe-area-bottom` (dies with the bar) and `LoveNotes.tsx:90` `safe-area-top` (out of scope).

**Accessibility reuse**
- `src/hooks/useFocusTrap.ts:21-25` `useFocusTrap(containerRef, enabled, options)`; `:26-27` options `onEscape`/`initialFocusRef`; `:80` the deps that force identity-stability; `:95-104` focus restore keyed on `enabled` alone, so closing the tray returns focus without the caller doing anything.
- `src/components/love-notes/NoteRemoveConfirmation.tsx:58-61` latest-ref, `:63-67` empty-dep `useCallback`, `:73-76` the trap call, `:170-177` the dialog markup (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, backdrop `onClick`).
- `aria-expanded` precedent `PokeKissInterface.tsx:404`; `aria-current` precedent `ReadingPhaseView.tsx:125` `aria-current="step"`; `aria-live="polite"` precedent `MoodHistoryCalendar.tsx:255`. Verified: `aria-controls` appears nowhere in `src/` — this is its first use.
- No drawer, sidebar or slide-in exists anywhere (grep for `drawer|sidebar|translate-x-full|slide-in` over `src/` returns nothing); the tray's motion is new. House motion idiom is `import { AnimatePresence, m as motion } from 'framer-motion'` under `main.tsx:41` `<LazyMotion features={domAnimation}>`, which already wraps `<App />`. `AnniversarySettings.tsx:281-292` is the representative overlay.
- `lucide-react@^1.31.0` exports `Menu`, `Settings`, `X`, `LogOut`, `ChevronRight` — verified by resolving the package.

**Tests to change**
- `src/components/Navigation/__tests__/BottomNavigation.test.tsx` — 179 lines, 12 `it()` cases in 6 `describe`s (Scripture rendering/navigation/active-state, all tabs, touch target, logout). `@testing-library/react` + `fireEvent`, no mocks. Tests the deleted component: replace wholesale.
- Focus-test convention: `src/components/MoodHistory/__tests__/MoodDetailModal.focus.test.tsx` — 84 lines, `:21-26` framer-motion mock, `:38-45` a `Harness` with a sibling trigger button, three cases (focus moves in, focus returns to trigger, Escape closes). `PhotoViewer.focus.test.tsx` is the second.
- E2E, verified line by line: `tests/e2e/navigation/routing.spec.ts:24,30,45,54` (`bottom-navigation` readiness), `:33,37` clicks, `:55` `nav-home` visible. `tests/e2e/home/routing.spec.ts:22,28,34,38,44` readiness, `:25,37,41` clicks, `:45` `nav-home` visible. `tests/e2e/home/error-boundary.spec.ts:23,29,35,39,45` readiness, `:26,38,42` clicks, `:46` visible. `tests/e2e/scripture/scripture-overview.spec.ts:34` `nav-scripture` visible, `:42` click. `tests/e2e/auth/logout.spec.ts:27,49` `nav-logout` click.
- **Not in `navigation.md`:** `tests/e2e/home/routing.spec.ts:9-47` and `tests/e2e/home/error-boundary.spec.ts:9-48` hold **byte-identical test bodies** — `diff` reports only the `describe` name differs — even though `routing.spec.ts:5` claims error-boundary "now tests actual error recovery". Four of the fifteen `nav-*` references are pure duplication.
- `tests/e2e/scripture/scripture-overview.spec.ts` carries 0 `[P0]` and 0 `[P1]` (`grep -c` both return 0), so it runs in neither `test:p0` nor `test:p1` — a break there surfaces only on a full run.
- `tests/e2e/auth/logout.spec.ts:14-21,36-43` intercept `**/auth/v1/logout**` POST. That interception survives the consolidation, because the surviving path calls the same `supabase.auth.signOut()` (`actionService.ts:73`).
- No shared nav helper exists: `tests/support/` matches only scripture's `navigateToTogetherRoleSelection` (`helpers/scripture-lobby.ts:246`), which navigates by `page.goto('/scripture?fresh=true')` at `:264` and touches no nav testid — so it is unaffected.
- E2E imports `{ test, expect }` from `tests/support/merged-fixtures.ts` (`AGENTS.md:26`); the `chromium` project is `testDir: './tests/e2e'` (`playwright.config.ts:139-140`).
- `tests/e2e/home/welcome-splash.spec.ts:39` asserts `app-container`, the only other consumer of that testid — leave it working.

**Environment baseline (measured this session)**
- `npm run typecheck` currently emits exactly 6 pre-existing `TS2883` errors, all at `tests/support/merged-fixtures.ts(53,14)`. Anything beyond those six is this story's.
- `git rev-parse HEAD` = `55134ed8c62555eb9cc940853cfc350c85028a79`, tree clean.

## Tasks & Acceptance

**Execution:**
- `src/components/Navigation/NavigationTray.tsx` (new) — the sticky header, hamburger and tray panel: seven destinations with their `nav-<view>` testids plus `nav-settings`, `aria-current="page"` on the active one, `aria-expanded`/`aria-controls` on `nav-menu-toggle`, `role="dialog"`/`aria-modal="true"` on `nav-tray`, close on select/Escape/backdrop, `useFocusTrap` with the identity-stable Escape handler, `.safe-top`/`.safe-bottom`, and the empty-by-default badge slots. No logout control — the single component CAP-8 and CAP-9 both land in.
- `src/components/Navigation/BottomNavigation.tsx` — delete. Its seven buttons, the `bottom-navigation` testid and the undefined `safe-area-bottom` class all go with it.
- `src/stores/slices/navigationSlice.ts` — add `'settings'` to `ViewType` (`:18`) and `'/settings'` to `pathMap` (`:44`) — the typechecked half of the registration.
- `src/App.tsx` — render `NavigationTray` in the bar's slot (`:714-722`); add `settings` to both route ternaries (`:176-187`, `:193-204`) and to the render chain (`:694-711`) as a lazily-loaded view alongside the others; drop `pb-16` (`:619`); delete the sign-out wiring (`:18`, `:94`, `:146-160`) — the four untypechecked registration sites plus CAP-9's deletion half.
- `src/components/Settings/Settings.tsx` — add `data-testid="settings-sign-out"` to the button at `:102`, and a testid on the container for E2E to assert Settings rendered. Nothing else — the surviving sign-out already surfaces its own error.
- `index.html` — add `viewport-fit=cover` to the viewport meta at `:6`, without which `.safe-top`/`.safe-bottom` emit padding of 0.
- `src/components/love-notes/LoveNotes.tsx`, `src/components/PhotoGallery/PhotoGallery.tsx`, `src/components/InteractionHistory/InteractionHistory.tsx`, `src/components/PokeKissInterface/PokeKissInterface.tsx` — re-derive the four remaining bar-derived offsets (`:88`, `:306`, `:94`, `:448`) against the new chrome, so no element sits under the header or floats against space the bar used to fill.
- `src/components/Navigation/__tests__/NavigationTray.test.tsx` (new) — the behavioural half of the I/O matrix: seven destinations render, selecting one calls back and closes, `aria-current` marks only the active one, `aria-expanded` tracks state, badges render only when counts are supplied, and no logout control exists. Replaces the deleted `BottomNavigation.test.tsx`, which must be removed in the same commit.
- `src/components/Navigation/__tests__/NavigationTray.focus.test.tsx` (new) — the focus half, following `MoodDetailModal.focus.test.tsx`: focus moves in on open, returns to the hamburger on close, Escape closes, Tab wraps inside the panel. The house standard is a dedicated focus test per dialog.
- `tests/support/helpers/navigation.ts` (new) — `openNavTray(page)` and `navigateTo(page, view)`, exported through `tests/support/helpers/index.ts`. All 15 call sites are hand-written today; since every one is being touched anyway, a future nav change should cost one file.
- `tests/e2e/home/routing.spec.ts`, `tests/e2e/home/error-boundary.spec.ts`, `tests/e2e/navigation/routing.spec.ts`, `tests/e2e/scripture/scripture-overview.spec.ts` — route the 11 clicks through the helper, and re-point the 14 `bottom-navigation` readiness proxies and the 4 `toBeVisible()` assertions at `nav-menu-toggle`, which is the element that is now permanently visible. The "nav stays visible through a lazy load" semantic is preserved by the hamburger, not by a closed tray.
- `tests/e2e/auth/logout.spec.ts` — replace both `nav-logout` clicks (`:27`, `:49`) with open-tray → `nav-settings` → `settings-sign-out`. Keep the `**/auth/v1/logout**` interceptions; they still fire.
- `tests/e2e/navigation/tray.spec.ts` (new) — CAP-8's close-on-Escape, close-on-outside-click and close-on-select against the real app, plus CAP-5's `/settings` deep link surviving a reload. The reload case is the one the untypechecked ternaries can only be caught by.

**Acceptance Criteria:**
- Given any of the seven views, when it renders, then no element is positioned against the retired 64px bar and no view shows a dead strip or an unexplained gap at either edge.
- Given a repo-wide grep outside `tests/e2e-archive/`, when run for `BottomNavigation`, `bottom-navigation`, `nav-logout` and `safe-area-bottom`, then every one returns nothing.
- Given `npm run test:unit`, when it runs, then all suites pass, `BottomNavigation.test.tsx` is gone, and the two new tray suites are present.
- Given `npm run typecheck` and `npm run lint`, when both run, then lint is clean and typecheck emits only the six pre-existing `TS2883` errors at `tests/support/merged-fixtures.ts(53,14)`.
- Given `supabase start` and the local stack, when `npx playwright test tests/e2e/ --project=chromium` runs, then every rewritten spec passes, including the two logout flows and the untagged `scripture-overview.spec.ts`.
- Given `git diff --name-only` outside `_bmad-output/`, when inspected, then it lists only the files named above.

## Spec Change Log

- 2026-08-18 operator resolution of the matrix-ambiguity escalation: the Sign-out row's Error Handling cell now records the deliberate behaviour — local sign-out is unconditional, a server failure is logged, not shown. See Auto Run Result.

**Two files beyond the Execution list were touched, both forced by the change itself.**

- `tests/e2e/home/events.spec.ts:336-337` clicked `nav-photos` then `nav-home` directly. Story 3 added that spec after this story's Code Map was written, so it is absent from the list of "Tests to change" — but its two clicks are among the call sites the tray breaks, and leaving them would have failed the suite. Routed through `navigateTo` like the other eleven.
- `tests/support/helpers/index.ts` gained a single `export * from './navigation'` so the new helper reaches the specs that import from the barrel.

**Two tests were added during the matrix audit, beyond the suites the Execution list names.**

- `NavigationTray.focus.test.tsx` — "returns focus to the hamburger when the backdrop is clicked". The matrix's Outside-click row expects both a close *and* a focus return; the implementation covered the close in the behaviour suite and the focus return for the close-button, Escape and select paths only.
- `tests/e2e/auth/logout.spec.ts` — "[P0] should clear account state through signedOutState on logout". The matrix's Sign-out row expects "account state cleared", which nothing asserted once the implementer's temporary probe spec was deleted.

  The first version of this test was **vacuous** and is worth recording as a trap: a freshly provisioned worker account loads no notes, photos, moods or events, so every collection is already empty at sign-out and the assertion passed with `discardAccountState` removed entirely. It now seeds `notes` and `events` through `window.__APP_STORE__.setState` first, and was red-checked — with `clearAuth` reduced to a bare identity `set()` the test fails, and with the real implementation it passes.

## Review Triage Log

## Design Notes

**Operator note (process, not product):** implement directly in this session — do not hand the implementation to a subagent. Both prior attempts at this story were harvested as failed when the session's turn ended while a background subagent was still running; the orchestrator treats the turn's end as the session's end.

**Why sticky rather than fixed, and why `h-16`.** A `fixed` header is invisible to layout, so every view would need a compensating top pad — which is precisely the five-site sweep this story exists to finish, re-created at the opposite edge. A `sticky top-0 z-40` header sits in normal flow, so `App.tsx:619`'s `pb-16` is simply deleted rather than swapped for a `pt-*`, and it still stays on screen while scrolled, which the aggregate badge requires and a static header could not give. Sizing the header's content row at `h-16` retires the bar's 64px one-for-one, which is also what keeps `LoveNotes.tsx:88`'s viewport calc meaningful rather than arbitrary.

**Why `top-20` is not simply deleted.** `navigation.md` reads both `top-20` sites as bar clearance, but `InteractionHistory.tsx:94` and `PokeKissInterface.tsx:448` position from the **top** of the viewport; the 64px bar was at the bottom and never constrained them. Only the `bottom-20` halves cleared it. Adding chrome at the top is what first makes those values load-bearing, so they are re-derived against the header rather than shrunk.

**Why deleting App's sign-out is safe.** `authService.signOut` and the `signOut` App imports are the same function (`api/authService.ts:10,23`), and the store reset hangs off the app-level auth listener (`App.tsx:248` → `:267` → `authSlice.ts:202-204`), not off either caller. So the surviving path cannot reach a different reset — the risk `navigation.md` raises does not exist in the current tree. Confirm it empirically anyway; the Block If is there because a wrong answer leaks the previous couple's data.

**Escape handler shape, verbatim from the in-repo fix:**

```tsx
const onCloseRef = useRef(onClose);
useEffect(() => {
  onCloseRef.current = onClose;
}, [onClose]);

const handleEscape = useCallback(() => {
  onCloseRef.current();
}, []);

useFocusTrap(panelRef, isOpen, { onEscape: handleEscape, initialFocusRef: firstItemRef });
```

## Verification

**Commands:**
- `npm run typecheck` — expected: only the six pre-existing `TS2883` errors at `tests/support/merged-fixtures.ts(53,14)`, reproduced before and after the change.
- `npm run lint` — expected: clean over `src tests scripts`; watch for newly-unused `isSigningOut`/`handleSignOut`/`signOut` in `App.tsx` if any of the three is missed.
- `npm run test:unit` — expected: all suites pass; `BottomNavigation.test.tsx` gone, `NavigationTray.test.tsx` and `NavigationTray.focus.test.tsx` present.
- `supabase start` then `npx playwright test tests/e2e/ --project=chromium` — expected: all pass. Run the whole directory, not `test:p0`/`test:p1`, because `scripture-overview.spec.ts` is untagged and neither script would reach it.
- `grep -rn "BottomNavigation\|bottom-navigation\|nav-logout\|safe-area-bottom" src/ tests/ --include=*.ts --include=*.tsx` — expected: no hits outside `tests/e2e-archive/`.
- `git diff --name-only` — expected: only the files in Execution, plus nothing under `supabase/` or `src/types/`.

**Manual checks (if no CLI):**
- On a narrow viewport, open each of the seven views and confirm no dead strip at either edge, the chat pane in Notes still fills the viewport exactly, the Photos FAB sits at a normal inset, and the Poke/Kiss toast and interaction-history overlay clear the header.
- With the tray open, Tab all the way round and confirm focus never leaves the panel; press Escape and confirm focus lands back on the hamburger.

## Auto Run Result

Status: in-review
Blocking condition: none — matrix ambiguity resolved by operator, 2026-08-18

**Resolution:** the Sign-out row's Error Handling cell was corrected to describe the app's actual, deliberate behaviour: local sign-out is unconditional; a server failure is logged, not surfaced. Keeping the user signed in when the server call fails would violate this story's own Block If (shared-device state clearing). Surfacing the failure on the login screen the user lands on was judged possible future work outside this story. The original contradiction record is preserved below.

The implementation is **complete and green** — every acceptance criterion and every verification command passes. The block is a single I/O-matrix cell that the running app contradicts, which a dev session may not resolve by rewriting the expectation.

### The blocking contradiction

The Sign-out row's Error Handling cell reads:

> Failure leaves the user signed in and shows Settings' own error

The app does not do this, and cannot be made to without reversing the story's own Block If. Measured both reachable failure modes against the running app:

- **Server rejection** (`**/auth/v1/logout**` fulfilled `500`): the login screen appears; Settings unmounts.
- **Network failure** (`route.abort('failed')`): console shows `[AuthService] Sign-out failed: Failed to fetch` then `[Settings] Logout failed: AuthRetryableFetchError: Failed to fetch`, and a probe counting the three surfaces returned `alert=0 login=1 settings=0`.

The mechanism: `actionService.ts:71-91` does throw on error, and `Settings.tsx:44-48` does catch it and `setError('Failed to sign out. Please try again.')`. But `supabase.auth.signOut()` clears the **local** session before that throw propagates, so `onAuthStateChange` fires `SIGNED_OUT` (`App.tsx:248` → `:267`), App swaps in `LoginScreen`, and Settings unmounts before the error it just set can paint. The error state is written to a component that no longer exists.

This is **pre-existing and unchanged by this story** — the retired bar called the same `signOut`, so the same thing happened from `nav-logout`. The Code Map's claim that Settings' copy "is strictly better: `:45` surfaces `'Failed to sign out. Please try again.'` where `App.tsx:156` only `console.error`s" is true of the *code path* but not of anything a user can see.

### Why it was not fixed in-session

Satisfying the cell literally means keeping the user signed in locally when the server call fails. That directly contradicts this story's own Block If — "shipping leaks one couple's data to the next on a shared device" — and the whole `signedOutState()` discipline it guards. Deliberately preserving a session that the user asked to end, on a shared-device couples app, is a worse outcome than the current behaviour. The choice between "match the matrix" and "keep local sign-out unconditional" is a product decision, not an implementation detail.

A test asserting the cell was written, observed to fail for the reason above, and removed rather than left red or weakened — per the rule against editing an expectation to match the code.

**Resolved (operator):** the cell now describes actual behaviour. The original question: whether the cell should be corrected to describe actual behaviour (sign-out always succeeds locally; a server failure is logged, not shown), or whether the failure genuinely must be surfaced — in which case the place to surface it is the login screen the user lands on, not Settings, and that is new work.

### Verification results

All run at `55134ed8` + this change, in this worktree:

- `npm run typecheck` — **6 errors, all `TS2883` at `tests/support/merged-fixtures.ts(53,14)`**, exactly the pre-existing baseline the spec records. Zero new.
- `npm run lint` — **0 errors**, 2 warnings, both `react-refresh/only-export-components` at `src/components/RelationshipTimers/EventCountdown.tsx:68,91`, a file this change does not touch.
- `npm run test:unit` — **84 files, 1238 tests, all passing.** `BottomNavigation.test.tsx` gone; `NavigationTray.test.tsx` (16) and `NavigationTray.focus.test.tsx` (7) present and running.
- `npx playwright test tests/e2e/ --project=chromium` — **122 passed, 2 skipped, 0 failed.** The 2 skips are pre-existing in `scripture-reflection-2.3.spec.ts`, untouched here.
- `grep -rn "BottomNavigation\|bottom-navigation\|nav-logout\|safe-area-bottom" src/ tests/` — **no hits** (exit 1).
- `git diff --name-only` outside `_bmad-output/` — the Execution list plus the two files explained in the Spec Change Log. Nothing under `supabase/` or `src/types/`.

### Matrix audit

Nine of ten rows are covered by tests that ran and passed; the tenth is covered for its Expected-Behavior column and blocked on its Error-Handling column.

| Row | Covering tests (all ran, all passed) |
|---|---|
| Open tray | unit `tracks aria-expanded as the tray opens and closes`; focus `moves focus into the panel when the tray opens`; E2E `should open on the hamburger and close on the panel control` |
| Select destination | unit `reports the view and closes the tray when a destination is selected`; focus `returns focus to the hamburger after a destination is selected`; E2E `should close when a destination is selected` |
| Escape | focus `closes on Escape and hands focus back to the hamburger`; E2E `[P0] should close on Escape` |
| Outside click | unit `closes the tray when the backdrop is clicked`; focus `returns focus to the hamburger when the backdrop is clicked` *(added)*; E2E `[P0] should close on an outside click` |
| Tab wrap | focus `wraps Tab from the last focusable back to the first, never leaving the panel`; `wraps Shift+Tab from the first focusable back to the last` |
| Active marking | unit `gives aria-current="page" to the active destination alone`; E2E `should mark only the active destination with aria-current` |
| Settings deep link | E2E `should reach Settings from the tray and survive a reload`; fallback by E2E `[P0] should fallback to home view for unknown routes` |
| Back from Settings | E2E `should go back to the previous view from Settings` |
| Sign out | E2E `should sign out and show login screen`, `should clear session data on logout`, `should clear account state through signedOutState on logout` *(added, red-checked)*. **Error-Handling cell blocked — see above.** |
| Empty badges | unit `renders no badge and no aggregate indicator when no counts are supplied`; `renders no badge for a zero count` |

### Block If resolved: sign-out does clear account state

The story's first Block If required measuring, not assuming, that Settings' sign-out clears account state through `signedOutState()`. It does. The standing test seeds `notes` and `events` into the live store, signs out from Settings, and polls `window.__APP_STORE__.getState()` until `userId`, `isAuthenticated`, `notes`, `photos`, `moods`, `events` and `partner` are all cleared. Red-checked: replacing `clearAuth`'s `discardAccountState(...)` with a bare identity `set(...)` makes it fail. **Not a blocker.**

### Observations, not fixed

- **A flaky pre-existing E2E test.** `tests/e2e/scripture/scripture-accessibility.spec.ts:207` failed once in three full-suite runs and passed 3/3 in isolation — 5 passes to 1 failure on identical code. It awaits focus that the app sets inside a `requestAnimationFrame`, which loses the race under a fully parallel run. Unrelated to the tray: the trap is armed only while `isOpen` is true, and the tray is never opened in that spec.
- **The two byte-identical specs remain byte-identical.** `tests/e2e/home/routing.spec.ts` and `tests/e2e/home/error-boundary.spec.ts` were rewritten in parallel and still differ only in their `describe` name. Recorded in both files' headers; deduplicating them is out of scope.
- **`LoveNotes.tsx:90` `safe-area-top` is still undefined**, as the spec's Never list requires.

### Process note

The workflow mandates a subagent for implementation; the Design Notes' operator note says to implement directly, because two prior attempts were harvested when the turn ended while a background subagent ran. Both were honoured: the subagent was launched, and the turn was held open with blocking waits until it returned, so the run never yielded control. Verification, the matrix audit and the two added tests were done in-session against the diff.
