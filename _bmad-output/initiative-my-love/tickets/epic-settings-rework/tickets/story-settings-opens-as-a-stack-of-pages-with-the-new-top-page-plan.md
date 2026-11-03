---
title: 'Settings opens as a stack of pages with the new top page'
type: 'feature'
ticket: '1'
created: '2026-11-02'
status: done
baseline_revision: '50374071ebe1863c5934be782481e27193d2d887'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md'
  - '{project-root}/_bmad-output/initiative-my-love/ux-settings-page/DESIGN.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The Settings page stack's column-dock form has no end-to-end check (ledger DW-419).
    evidence: |-
      The column form is chosen from env(safe-area-inset-*), which desktop Playwright cannot set; settings-stack.spec.ts runs the bottom dock only and SettingsStack.test.tsx mocks useSideColumn. Pre-existing limitation shared by every column-form feature.
    location: >-
      tests/e2e/settings/settings-stack.spec.ts
    severity: low
  - summary: >-
      No test pins that sign-out keeps the device's photo-download choice (ledger DW-420).
    evidence: |-
      grep finds my-love-photos-over-mobile-data only in photoDownloadPreference.test.ts and this story's tests; none signs out first. Behaviour unchanged by this story.
    location: >-
      src/stores/slices/authSlice.ts (deleteAccountData)
    severity: low
  - summary: >-
      Nothing ties a subpage row's visibility to its page's `available`, and the AGENTS.md subpage rule does not say to gate the row.
    evidence: |-
      The Photos row checks canTellMobileData() by hand (Settings.tsx, Preferences group) while its page is gated by `available: canTellMobileData` in SUBPAGES. A later subpage with `available` whose row is not gated shows a row that pushes /settings/<page>, then the stack's redirect replaces that entry with /settings, leaving two top-page entries and one extra Back. The fix is a sentence in the AGENTS.md "Settings subpage" rule (gate the row on the same check), or deriving row visibility from the spec.
    location: >-
      AGENTS.md (Where things are, Settings subpage rule); src/components/Settings/Settings.tsx (SUBPAGES)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Settings is one long page under the app header; the epic needs a page stack (own bar, one history entry per page, reload, back, slide, focus) that every later story adds pages to. This story builds that stack, the new top page's groups, and the first subpage, Photos (covers R1, R2, R12, R16, R17, R18 for what it builds).

**Approach:** Keep `settings` the one `ViewType`; hold the open subpage as `settingsPath` in `navigationSlice`, mirrored in the URL under `/settings/` with one `pushState` per push. A generic stack component renders Settings' own bar and the resolved page; the top page gets the IA's groups with the rows whose pages exist (Photos, Replay welcome message, the two log-out rows, version line), and the not-yet-replaced old sections stay below them.

## Boundaries & Constraints

**Always:** Kit tokens through kit utilities, no `dark:` variant, no new palette (DESIGN.md). Navigation state stays in `navigationSlice`; no router. Settings content and bar pad by `--dock-left`/`--dock-right` and reserve `--dock-clearance` (inherited from `<main>`); no hard-coded offset. Each push is exactly one history entry; back arrow and browser back each return one level. On a push focus moves to the new page's h1; on back to the row that opened the page. Match surrounding style by hand; never run `prettier --write`. Update every existing unit/E2E spec this breaks in the same change.

**Never:** No Profile, Partner, Dates or Notifications row or page (later stories); no new view in the five registration places; no change to log-out strings ("Sign out" → "Log out" is R13, another story) or log-out behavior; no change to what the old Account/Countdowns/Push sections do; no change to which writes need a connection; no `motion/react` exports beyond `m` and `AnimatePresence` in Settings files (unit tests mock only those).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push | Top page, device reports connection type, tap Photos | URL `/settings/photos`, one new entry, page slides in from right, focus on h1 "Photos" | — |
| Back arrow / browser back | On Photos (entry pushed in-app) | `history.back()`; top page, focus on Photos row, row value updated | — |
| Reload | Reload at `/settings/photos` | Photos page again | — |
| First entry | Fresh load at `/settings/photos` (`history.state` has no `inApp`) | Back arrow `replaceState`s `/settings`, shows top page; app not left; top page then shows no back arrow | — |
| Unknown / unavailable page | `/settings/xyz`, or `/settings/photos` where `canTellMobileData()` is false | Top page, URL replaced with `/settings` | — |
| Top page back arrow | Bottom dock, opened in-app (gear, Home Add) | Arrow shown, returns to previous view | Fresh load or column dock: no arrow |
| Choice | Tap `Any connection` while offline | Check moves, `setPhotosOverMobileData(true)` saves, top row reads `Any connection`; no request | — |
| Reduce Motion | `prefers-reduced-motion: reduce` | Fade instead of slide | — |
| Leave and return | On Photos, tap a dock view, then browser back | Photos page again | — |

</intent-contract>

## Code Map

- `src/stores/slices/navigationSlice.ts` -- `setView` (pushState `{ view }`, replaceState on same path). Add `settingsPath`, push/show actions, path helpers; mark in-app entries.
- `src/App.tsx:197-238` -- initial route + popstate ternaries (match `/settings` only); also render chain at 950 (`<Settings onShowWelcome>`), Home Add button 872 (`setView('settings')`, unchanged).
- `src/components/Navigation/AppNavigation.tsx:116-160` -- app header with gear/spacer; must not render on Settings. Doc comment 1-39.
- `src/components/Settings/Settings.tsx` -- whole page today: old Account card (718-779, keep), Countdowns (782-791, keep), Photos section 794-801 + `MobileDataPhotosRow` 455-475 (remove), `PushSettings` 804 (keep), About 807-843 (replace by ABOUT group + version line), sign-out card 846-888 and dialog/logic (keep, move into last card), error box 707-715 (keep, under bar).
- `src/components/Settings/SwitchRow.tsx` -- `ROW_BUTTON` reusable for rows; doc comment names the removed photos row.
- `src/components/shared/kitClasses.ts` -- `CARD`, `DIVIDER`, `SECTION_LABEL`, `GROUP_TILE`, `FAILURE_BOX`; reuse, don't fork.
- `src/services/photoDownloadPreference.ts` -- `canTellMobileData`, `get/set/subscribePhotosOverMobileData` (device key, survives sign-out); use via `useSyncExternalStore`, don't change.
- `src/hooks/useSideColumn.ts` -- column vs bottom dock; the top page's back arrow depends on it.
- `src/utils/basePath.ts` -- `withBasePath`/`stripBasePath`; every URL goes through them.
- `src/index.css` -- `@theme` (add keyframes/animations here), dock vars, `.safe-top`.
- Tests that break: `src/components/Settings/__tests__/Settings.kit.test.tsx` (h2 list, About/version), `Settings.mobileDataPhotos.test.tsx` (switch gone), `src/components/Navigation/__tests__/AppNavigation.test.tsx` (gear in Settings, lines ~57-60, 246-280, 361-378), `tests/e2e/navigation/dock.spec.ts:6,180` (gear `aria-current` after reload), `tests/e2e/offline/account-data-offline-copy.spec.ts:114` (clicks gear while already on Settings; a no-op replace today — drop the call). Unit-test motion mocks in Settings tests expose only `m.div` and `AnimatePresence`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/stores/slices/navigationSlice.ts` -- add `settingsPath: string` ('' = top), `openSettingsPage(path)` (pushState `{ view: 'settings', settingsPath, inApp: true }` at `withBasePath(settingsRoute(path))`), `showSettingsPage(path)` (state only), exported `settingsRoute(path)` and `settingsPathFromRoute(routePath)` (strip `/settings`, slashes; non-settings route → ''). `setView` pushes with `inApp: true`, keeps the current entry's `inApp` on its replace branch, and resets `settingsPath` to '' when not skipping history -- the first-entry rule needs to know which entries the app created.
- [ ] `src/App.tsx` -- both ternaries treat `/settings` and `/settings/...` as `settings`, then `showSettingsPage(settingsPathFromRoute(routePath))` -- reload and browser back restore the subpage.
- [ ] `src/components/Navigation/AppNavigation.tsx` -- render no header while `currentView === 'settings'` (drop the gear's now-dead active styling); update doc comment -- Settings' own bar replaces it.
- [ ] `src/index.css` -- in `@theme`: `--animate-settings-push` (translateX 100%→0), `--animate-settings-pop` (from about -30%), `--animate-settings-fade` (opacity), each ~250-300ms, with their `@keyframes`.
- [ ] `src/components/Settings/stack/SettingsBar.tsx` (new) -- sticky `top-0` bar, `safe-top`, z below the dock (z-30). Large: in-flow height 52px + safe-top holding an absolutely positioned 3-column panel (64px 1fr 64px) so collapsing never shifts layout; transparent/page ground until the large h1's bottom passes under the bar (window scroll listener + rect compare, strict `<`), then glass `bg-glass backdrop-blur-lg` + hairline `border-line` with the small centered title (aria-hidden). Small: always collapsed look, 64px, the centered title is the page's h1. Back button: 44px round, 24px `ChevronLeft` in ink, `aria-label="Back"`, accent focus ring; shown only when `onBack` given. Optional `trailing` slot. Expose `data-testid="settings-bar"`, `data-collapsed`.
- [ ] `src/components/Settings/stack/SettingsStack.tsx` (new) -- reads `settingsPath`; resolves via a `resolvePage(path)` prop ({ title, titleStyle, available?, render }); unresolved/unavailable → layout effect replaces URL with `/settings` (keeping `inApp`) and shows ''. Renders bar + page in a `key={path}` container inside an `overflow-x-clip` wrapper with `data-testid="settings-view"`; content `mx-auto w-full max-w-200 px-4` with large h1 `px-1` aligned to group labels, `font-serif text-[30px] leading-[1.1] font-semibold`, `id="settings-title" tabIndex={-1}`. Direction from previous path depth: push → `animate-settings-push`, back → `animate-settings-pop`, both `motion-reduce:animate-settings-fade`; none on first mount. Push: save scrollY per path, scroll top, focus h1. Back: restore saved scroll, focus `[data-settings-target="<old path>"]`. Back handler: `history.state?.inApp` → `history.back()`; else replaceState parent route + show parent. Top page gets `onBack` only when `useSideColumn()` is null and the entry is `inApp`; subpages always.
- [ ] `src/components/Settings/stack/SettingsRows.tsx` (new) -- `SettingsGroup` (h2 `SECTION_LABEL` + `CARD`, `DIVIDER` between rows, renders nothing when every row is falsy; no label when `label` omitted) and `SettingsRow` (one `ROW_BUTTON`-based button, min 48px: optional `GROUP_TILE` icon, label truncating, muted one-line value, 18px muted `ChevronRight`; `aria-label` "Label, Value" when a value exists; `target` → `openSettingsPage(target)` + `data-settings-target`).
- [ ] `src/components/Settings/PhotosPage.tsx` (new) -- one card, two native radio rows `Wi-Fi only` (false) / `Any connection` (true), group labelled by the page h1, accent `Check` on the current one, saved on change via `setPhotosOverMobileData`, read via `useSyncExternalStore`; export `photoDownloadLabel(allowed)`.
- [ ] `src/components/Settings/Settings.tsx` -- `Settings` renders `SettingsStack` with a `resolveSettingsPage` table: '' → top page ("Settings", large), `photos` → `PhotosPage` ("Photos", large, `available: canTellMobileData`). Top page body: Error box, `Preferences` group (Photos row, value from `photoDownloadLabel`, `Image` icon, shown when `canTellMobileData()`), `About` group (Replay welcome message, `RotateCcw`, when `onShowWelcome`), unlabeled last card (existing sign-out rows, testids and strings unchanged), version line (`settings-version`, centered muted 13px, 4px under the card, same text), then the old Account, Countdowns and `PushSettings` sections. Remove the old Photos and About sections and `MobileDataPhotosRow`.
- [ ] `src/components/Settings/SwitchRow.tsx` -- doc comment only: it no longer serves the photos row.
- [ ] `AGENTS.md` -- under Where things are, a rule for adding a Settings subpage: not a view; add its path to `resolveSettingsPage` (title, title style, `available`), its row on the parent page via `SettingsRow target`, never call `pushState` for it directly; the stack gives bar, history entry, reload, back, slide and focus; Settings has no app header. Note `/settings/...` in the URL-ternary sentence.
- [ ] Tests -- new `src/components/Settings/__tests__/SettingsStack.test.tsx` and `PhotosPage.test.tsx` covering the I/O matrix (mock `useSideColumn` for the column form; mock rects for collapse); replace `Settings.mobileDataPhotos.test.tsx`; navigationSlice tests in `tests/unit/stores/navigationSlice.settingsStack.test.ts`; fix the breaking specs listed in the Code Map; new `tests/e2e/settings/settings-stack.spec.ts` (bottom dock; `addInitScript` defining `navigator.connection` `{ type: 'wifi' }`): push, offline choice, reload, back arrow, browser back, first-entry replace, fallback without connection type.

**Acceptance Criteria:**
- Given a signed-in user on Home in the bottom-dock form, when they tap the gear, then Settings shows its own bar (no app header) with a back arrow above the large title "Settings", groups About and the unlabeled log-out card with the version line under it, and the old Account, Countdowns (and native Push) sections below.
- Given a device that reports its connection type, when the user taps the Photos row, then the Photos page slides in with `Wi-Fi only` and `Any connection` and one check; choosing one offline saves it, and back shows the new value on the row.
- Given the Photos page, when the page reloads, then it stays on Photos, and the back arrow and browser back each return exactly one level.
- Given the column-dock form, when Settings opens, then the top page has no back arrow and the Photos page has one, and the bar and cards end at the column's edge.
- Given a keyboard or screen-reader user, when they push and go back, then focus lands on the new page's single h1 and then on the Photos row, whose name reads "Photos, Wi-Fi only".

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; files as in Tasks, plus `src/components/Settings/__tests__/settingsStackKit.ts` (shared popstate stand-in) after review.
- A break the Code Map missed: `tests/e2e/settings/push-switches-web.spec.ts` asserted the old Photos heading and one switch; desktop Chrome reports no connection type, so it now expects no switch and uses the Account heading as its witness.
- Subpages live in a module-level `SUBPAGES` map in `Settings.tsx`; `resolveSettingsPage` adds the top page for `''`. `photoDownloadLabel` moved to `services/photoDownloadPreference.ts` in review to drop a lint suppression.
- Local E2E ran through a scratch `supabase` shim: the installed CLI 3.0.0 rejects this repo's `[inbucket]` config in `supabase status`, though the stack is up. Nothing in the repo was changed for it.
- The dev server logs "Can't perform a React state update on a component that hasn't mounted yet" when Settings mounts; it also appears at the baseline revision (the `useState(() => authService.getUser()...)` initializer predates this story).

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 37 findings — high 0, medium 4, low 19, false 14, maybe-false 0
- findings:
  - `low` `reject` Every push and back remounts the top page, so the old Account/Countdowns sections re-run their loads and lose unsaved input — the extra read is invisible and losing typed input needs a half-filled old-section field before opening Photos; keeping parent pages mounted is a redesign against the one-page-in-DOM design.
  - `false` `reject` Scroll restore runs before async sections fill and gets clamped — the only subpage's row is in the first group, so the saved offset is at most that row's offset, which the synchronously rendered groups above the async sections always cover.
  - `low` `reject` Direction comes from path depth, so a history move from a pushed top page to a deeper entry animates as a push — needs a capsule tap on a subpage then browser back; the page shown is deeper, so a push slide and h1 focus are reasonable; tracking history position would add state.
  - `low` `patch` The "last card" comment does not say the old sections follow the version line — comment rewritten in `Settings.tsx`.
  - `false` `reject` The Photos page lost its explanatory helper — EXPERIENCE.md's Photos page is two rows only and its Do/Don't table bans a Wi-Fi sentence; hiding the row where the type is unreported is R12.
  - `false` `reject` `SettingsBar`'s `trailing` prop is unreachable — no bad outcome today; the first page with a trailing action adds the spec field in the same change.
  - `low` `patch` `photoDownloadLabel` needed an eslint-disable only because it lived in a component module — moved to `services/photoDownloadPreference.ts`, disable removed.
  - `low` `patch` App's popstate stand-in was copied into two test files — extracted to `__tests__/settingsStackKit.ts` (App's own wiring is exercised by the reload and back/forward E2E tests).
  - `low` `patch` The `scrollY` stub was removed on the test's last line and would leak on a failure — cleanup moved to `afterEach`.
  - `low` `patch` `tests/support/helpers/navigation.ts` said the gear is always on screen — doc now says Settings has no gear while open.
  - `low` `patch` E2E comment "the history is where it started" contradicted `before + 1` — reworded to "did not grow".
  - `low` `patch` Comment above `resolveSettingsPage` named the wrong registry — now points to `SUBPAGES`; the AGENTS.md sentence names `openSettingsPage` correctly and was left as is.
  - `medium` `patch` Reduce Motion and the slide were tested only by class name (grouped with the verification-gap animation finding) — new E2E test reads computed `animationName` for push and under `reducedMotion: 'reduce'`, and polls `transform` to `none`.
  - `false` `reject` In the bottom form nothing marks the current location — EXPERIENCE.md has Settings' bar replace the app header and the bottom dock holds five destinations; the page's single h1 names the location.
  - `false` `reject` `history.state.settingsPath` is written but never read — nothing reads it and every entry carrying it holds the path its URL names, so no reader can see an inconsistent value.
  - `low` `patch` The bar collapsed at the 52px spacer while its panel is 64px, so the large title slid over the back chevron first — `barRef` moved to the 64px panel; unit test mocks updated.
  - `low` `reject` A redirected in-app entry keeps `inApp`, so the top-page arrow goes back to another top page — needs an in-app entry at an unknown or newly unavailable path, which no row creates; the fix changes the first-entry semantics.
  - `low` `reject` A confirmation dialog left open survives a forward-then-back and reappears during the pop animation — needs browser forward while a modal is open; moving dialogs out of the stack is a structural change.
  - `low` `reject` `available` is read only at render, with no subscription to connection changes — whether a type is reported does not change within a session in a browser that reports one; the next render applies any change.
  - `false` `reject` `openSettingsPage` with the shown path would push a duplicate entry — rows only target child pages and unmount after the first tap; no caller passes the shown path.
  - `false` `reject` `SettingsRow` with neither `target` nor `onClick` would be a dead button — every call site passes exactly one.
  - `low` `reject` A non-canonical `/settings//photos` stays in the address bar — the app never creates such URLs, and the page still resolves.
  - `low` `patch` `canTellMobileData` doc said "and Settings says so" — now says Settings hides the Photos row and page.
  - `medium` `patch` The bar's sticky position and collapse were never checked in a real layout (verification gap) — new E2E test scrolls the top page and checks `data-collapsed` and the bar's y.
  - `medium` `patch` The push and Reduce Motion animations were checked only as class strings (verification gap) — covered by the computed-style E2E test above.
  - `low` `defer` Verify asks for both dock forms; the column form is proven only by unit tests — desktop Playwright cannot set `env()` insets; pre-existing limitation, recorded as DW-419.
  - `low` `reject` The slide is enter-only: the previous page is gone at once, so the new page slides over the page ground, and Reduce Motion fades in only (EXPERIENCE.md: "slides in over the previous one", "fade in and out") — with the 280ms strong ease-out the page is mostly in within about 100ms, so the missing outgoing layer is not perceptible as a defect in everyday use; keeping or cloning the outgoing page reverses the plan's one-page-in-DOM design (duplicate test ids, overlapping sticky bars). Noted under residual risks.
  - `medium` `patch` Collapse never scrolled in E2E; the small title exists only as a unit-test stand-in (grouped with the sticky/collapse gap) — scroll test added; no small-title page ships in this story, so its unit coverage is what applies.
  - `false` `reject` Top-page group order reads About, Account, Countdowns and the version line is not last — the ticket keeps old sections below the rows until their stories move them.
  - `low` `defer` "Kept across sign-out" for the Photos choice has no test — behaviour unchanged by this story; recorded as DW-420.
  - `false` `reject` Photos choices are radios, not the floor's native-button list rows — the floor's button rule is for rows that open pages; a native radio pair announces the selected option, which a button with a check glyph would not.
  - `low` `patch` The 64px panel overlaps the 52px large-title row by 12px (grouped with the collapse-threshold finding) — threshold now at the panel's bottom, so the glass appears as the title reaches it.
  - `false` `reject` R17 Error box and offline writes not exercised — descriptive: the Error box sits under the title as specified and the only new write needs no connection by design.
  - `false` `reject` The top-page arrow shows for any app-created entry (Home's Add, a Duo switching forms) — in both cases it does what browser back does, return to the view Settings was opened from, which is the rule's stated behaviour.
  - `false` `reject` First-entry rule uses "no `inApp` mark" rather than "session's first entry" — for an entry not first but without app state (arrived from another site), replacing instead of leaving the app is exactly the rule's purpose.
  - `false` `reject` R2's edge swipe is untouched — the epic assigns it to the spike and story 15; the ticket does not include it.
  - `false` `reject` Changes outside Settings (header, three specs) — follow from "Settings' own bar replaces the app header" and the epic's rule that each story fixes the specs it breaks.

### 2026-11-02 — Review pass
- verdicts: 35 findings — high 0, medium 2, low 17, false 15, maybe-false 1
- findings:
  - `medium` `patch` Settings draws no app header, so the offline banner (in flow above `<main>`, no `safe-top` of its own) sits under the status bar in the shell, and the Settings bar adds a second inset below it (grouped with the edge-case banner finding) — `App.tsx` no longer renders the banner on Settings; `SettingsStack` renders it right under `SettingsBar`, as it sits under the app header elsewhere. New unit test (offline: the bar's next sibling is the banner) and E2E check (one banner, directly after the bar).
  - `low` `reject` DW-421 and DW-422 repeat DW-419 and DW-420 in the ledger (grouped with the edge-case and verification-gap ledger findings) — real: the engine's bookkeeping commit `87291dc144262b1a94a4cc5917198978bb882fbe` re-added this plan's `deferred` items that the build had already written by hand. The fix edits existing ledger entries, which this run's invocation forbids (the orchestrator owns them); left for the orchestrator, named under residual risks. This pass's new deferral is in frontmatter only, not hand-written to the ledger.
  - `maybe-false` `reject` After Settings remounts (leave by the dock, browser back to Photos), the back arrow's pop scrolls the top page to 0, overwriting a position the browser restored — if true only low: the browser's own restore on that popstate runs against the still-mounted, short Photos page, so it would clamp near 0 anyway; settling it needs the popstate/scroll-restoration order measured in Chrome and WebKit.
  - `false` `reject` carried `openSettingsPage` with the shown path would push a duplicate entry — rows only target child pages and unmount after the first tap; no caller passes the shown path.
  - `false` `reject` carried `SettingsBar`'s `trailing` prop is unreachable — no bad outcome today; the first page with a trailing action adds the spec field in the same change.
  - `low` `patch` `SettingsGroup` wraps rows in `<Fragment key={index}>`, discarding the keys `Children.toArray` gave them, so a conditional row coming or going remounts the rows after it — no group toggles a row at runtime today, but later stories' Profile/Partner groups will; key now `row.key` when the row is an element, else the index.
  - `low` `defer` The row's visibility and its page's `available` are gated separately, and the AGENTS.md subpage rule does not say to gate the row — an ungated row on a later `available` page pushes an entry the redirect then replaces, leaving an extra top-page entry; the fix edits AGENTS.md, so deferred (frontmatter `deferred`).
  - `low` `reject` carried A non-canonical `/settings//photos` stays in the address bar — the app never creates such URLs, and the page still resolves.
  - `low` `patch` App.tsx's chrome comment still says the sticky top bar sits above `<main>` on every view; AGENTS.md's "the bottom form keeps the gear" — comment now says Settings draws no app header and its own bar, inside `<main>`, takes the inset. The AGENTS.md half is not a contradiction: that paragraph is about the header's contents per dock form, and the Where-things-are line already says Settings has no app header.
  - `low` `patch` No E2E taps the top page's back arrow (unit test only spies on `history.back`) — new E2E test: gear from Home, Back, URL `/`, app header visible, Settings gone, history length unchanged.
  - `false` `reject` carried Top-page group order puts Sign out and the version line above the old Account, Countdowns and push sections — the ticket keeps old sections below the rows until their stories move them.
  - `false` `reject` carried `SettingsRow` with neither `target` nor `onClick` (or both) — every call site passes exactly one.
  - `false` `reject` `ROW_BUTTON` is imported from `SwitchRow.tsx` and the photos-preference `useSyncExternalStore` read is written twice — no bad outcome: the import resolves, the plan said to reuse `ROW_BUTTON` rather than fork it, and both reads call the same service getter and subscriber, so they cannot diverge.
  - `medium` `patch` Offline banner under the status bar on Settings (edge-case, AppNavigation) — same entry as the first row; fixed there.
  - `low` `reject` carried A confirmation dialog left open survives a forward-then-back and reappears — needs browser forward while a modal is open; moving dialogs out of the stack is a structural change.
  - `low` `reject` carried Direction comes from path depth, so a history move to a deeper entry animates as a push — the page shown is deeper, so a push slide and h1 focus are reasonable; tracking history position would add state.
  - `low` `reject` A top page whose previous entry is a Settings subpage (column capsule tapped on Photos, then the Duo switches to the bottom form) gets a back arrow that returns to Photos — needs a capsule tap from a subpage followed by a dock-form change; it does what browser back does, and telling the cases apart needs a new field in `history.state`.
  - `false` `reject` carried `openSettingsPage` same-path push (edge-case) — same as the carried row above.
  - `low` `reject` Ledger duplicates DW-421/DW-422 (edge-case) — same entry as the ledger row above.
  - `low` `patch` The pop's computed animation and end transform were never checked on the top page, where the fixed dialogs live (verification gap) — the slide E2E test now asserts `animationName === 'settings-pop'` and polls `transform` to `none` after Back.
  - `low` `patch` `scripts/sim-driver/RunnerUITests/Drive.swift` comment says Sign out "sits at the end of Settings" — now "below the fold on Settings' top page"; the swipe loop is unchanged.
  - `low` `patch` The sub-path-base slice test is titled "reads it back" but only asserts the write — added `settingsPathFromRoute(stripBasePath(pathname)) === 'photos'`.
  - `low` `reject` Ledger duplicates DW-421/DW-422 (verification gap) — same entry as the ledger row above.
  - `low` `defer` carried The column-dock form has no end-to-end check (intent alignment) — DW-419; desktop Playwright cannot set `env()` insets.
  - `low` `defer` carried "Survives sign-out" for the Photos choice has no test (intent alignment) — DW-420.
  - `false` `reject` "Hidden on iPhone" is stood in for by an unreported `navigator.connection` rather than checked on iOS — WebKit does not implement `navigator.connection`, so the stand-in is the condition iOS itself presents.
  - `low` `reject` R16's Met-when is a VoiceOver pass, which no test exercises — a VoiceOver pass needs a person on a device; unit and E2E tests cover the single h1, focus on push and back, the row name "Photos, Wi-Fi only" and the "Back" label. Named under residual risks.
  - `false` `reject` carried R17 Error box and offline writes not exercised — the Error box sits under the title as specified and the only new write needs no connection by design.
  - `false` `reject` R18 has no visual test in light and dark — the first pass inspected light and dark screenshots of the top page, the collapsed bar and Photos at 390x844 against DESIGN.md; this pass adds no visual surface beyond moving the existing banner under the bar.
  - `false` `reject` The App.tsx route ternaries changed although the epic says none of the five view-registration places changes — the epic's sentence is about adding views; the set of views is unchanged, and "a list page reloading to itself" needs the ternaries to accept `/settings/...`.
  - `false` `reject` carried The top-page arrow shows for any app-created entry, not only the gear — it does what browser back does, return to the view Settings was opened from.
  - `false` `reject` Every `setView` push now writes `inApp` into `history.state` app-wide — no reader other than the stack's first-entry rule, which needs exactly that mark; nothing else reads or compares `history.state`.
  - `false` `reject` carried The header is removed on Settings and three specs changed to match — follows from "Settings' own bar replaces the app header" and the epic's rule that each story fixes the specs it breaks.
  - `false` `reject` carried R2's edge swipe is untouched — the epic assigns it to the spike and story 15.
  - `false` `reject` Whether the Verify walk ran on dev:local is unrecorded — `settings-stack.spec.ts` runs that walk (push, offline save, reload, back arrow, browser back) against `vite --mode test`, which is `npm run dev:local`, and it passed this pass.

## Design Notes

Enter-only CSS animations, not `AnimatePresence` exits: two pages never share the DOM, so duplicate test ids, overlapping sticky bars and stale exit props cannot happen, and reduce-motion is one `motion-reduce:` variant. The bar's large state keeps a fixed in-flow height and overlays its panel, because a sticky bar that changed height on collapse would shift the title and oscillate at the threshold. `inApp` on `history.state` (preserved across reload) is what tells "back leaves the app" from "back returns one level"; a fresh load has `state === null`.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (worktree TS2883 baseline errors excepted if present before the change)
- `npm run lint` -- expected: exit 0
- `npm run test:unit` -- expected: all green
- `npx playwright test tests/e2e/settings/settings-stack.spec.ts tests/e2e/settings/settings-kit.spec.ts tests/e2e/navigation tests/e2e/offline/account-data-offline-copy.spec.ts tests/e2e/auth/logout.spec.ts` -- expected: pass (needs `supabase start`)

**Manual checks (if no CLI):**
- On `npm run dev:local` with headed playwright-cli: light and dark, Photos push/back/reload, Reduce Motion fade; column form by setting `data-dock="column-right"` cannot emulate `env()`, so the column form is proven by unit tests.

## Auto Run Result

Status: built

**Summary.** Follow-up review pass on the built Settings page stack. Settings stays one view with the open subpage as `settingsPath` in `navigationSlice`, mirrored under `/settings/` with one `pushState` per push and `inApp` on every entry the app creates; `SettingsStack` renders Settings' own bar (large title collapsing on scroll, small title for single-item pages), the slide (fade under Reduce Motion), the focus moves and the first-entry back rule; the top page has Preferences (Photos), About (Replay welcome message), the log-out card with the version line, then the old sections; the Photos page saves `Wi-Fi only` / `Any connection` on the device. This pass fixed one medium defect — the offline banner sat under the iOS status bar on Settings once the app header was gone; it now renders under Settings' own bar — and six low ones.

**Files changed (this pass)**
- `src/App.tsx` — banner not rendered on Settings; chrome comment says Settings draws its own bar.
- `src/components/Settings/stack/SettingsStack.tsx` — renders the offline banner right under `SettingsBar`.
- `src/components/Settings/stack/SettingsRows.tsx` — group rows keep their `Children.toArray` keys.
- `scripts/sim-driver/RunnerUITests/Drive.swift` — comment on where Sign out sits.
- `src/components/Settings/__tests__/SettingsStack.test.tsx` — offline banner under the bar.
- `tests/e2e/settings/settings-stack.spec.ts` — one banner under the bar offline; pop animation and end transform on the top page; the top page's back arrow returns to Home.
- `tests/unit/stores/navigationSlice.settingsStack.test.ts` — sub-path base read back.

Story files overall (first pass): `navigationSlice.ts`, `App.tsx`, `AppNavigation.tsx`, `index.css`, `stack/SettingsStack.tsx`, `stack/SettingsBar.tsx`, `stack/SettingsRows.tsx`, `PhotosPage.tsx`, `Settings.tsx`, `SwitchRow.tsx`, `photoDownloadPreference.ts`, `AGENTS.md`, the ledger (DW-419, DW-420) and their tests.

**Review findings.** 35 findings from four lenses: 7 entries patched (1 medium from 2 findings, 6 low), 1 deferred (row gating rule; frontmatter `deferred`), the rest rejected — 15 false and 1 maybe-false on their refutations, and these lows: ledger duplicates DW-421/DW-422 (fix edits orchestrator-owned ledger entries, forbidden by this run), and as carried or newly judged unlikely with structural fixes: non-canonical `/settings//photos`, dialog surviving forward-then-back, depth-based direction, top-page arrow returning to a subpage after a capsule tap and dock-form switch, and the VoiceOver pass (needs a person). Each reason is in the Review Triage Log; two carried defers (DW-419, DW-420) were not re-deferred.

**Follow-up review recommended: false.** This is a follow-up pass and it patched no high (patched counts: high 0, medium 1, low 6).

**Verification.** `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run test:unit` 227 files / 3939 tests passed; `npx playwright test tests/e2e/settings/settings-stack.spec.ts tests/e2e/settings/settings-kit.spec.ts tests/e2e/navigation tests/e2e/offline/account-data-offline-copy.spec.ts tests/e2e/auth/logout.spec.ts` plus the banner-reading specs `tests/e2e/offline/needs-a-connection.spec.ts`, `couple-settings-offline.spec.ts`, `events-offline-copy.spec.ts`, `tests/e2e/settings/events-load-recovery.spec.ts`, `events-write-failures.spec.ts` — 78 passed, 0 failed. The local run used a scratch `supabase` shim (`--workdir` with `[inbucket]` renamed `[local_smtp]`), because the installed CLI 3.0.0 rejects this repo's config in `supabase status`; nothing in the repo changed for it.

**Residual risks**
- The ledger carries DW-421/DW-422 as duplicates of DW-419/DW-420 (engine bookkeeping `87291dc144262b1a94a4cc5917198978bb882fbe`); the orchestrator should merge them.
- The banner's position under the status bar is proven by DOM order only; desktop Playwright has no top inset, so the shell's look is unchecked on a device.
- The column-dock form is proven by unit tests only (DW-419); R16's VoiceOver pass and R18's light/dark look need a person on a device.
- The slide is enter-only; returning from Photos remounts the old Account and Countdowns sections, re-running their reads, until later stories move them.
