---
title: 'The dock becomes a capsule in the side column without covering content'
type: 'feature'
ticket: '2'
created: '2026-10-30'
status: done
baseline_revision: '6aa8e4dff50946b07d3abafc121a1dfd7b2a9d5c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-simulator-driver-is-a-repo-tool-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      A browser that reports one small side inset (likely Android Chrome in landscape with a one-sided display cutout, under viewport-fit=cover) would get the column form, with 44 px buttons spilling out of a capsule only that inset wide.
    evidence: |-
      sideColumnFromInsets switches to the column form for any single non-zero side inset, and the capsule is exactly w-[env(safe-area-inset-left|right)] while each button is w-11 (44 px); index.html sets viewport-fit=cover. Unverified: no Android device or emulator was measured. Settle it by reading env(safe-area-inset-left/right) in Android Chrome in landscape on a punch-hole phone; if one side is non-zero and small, add a minimum column width (for example a button's 44 px) to the rule, which the ticket's "exactly one non-zero" wording does not settle.
    location: >-
      src/hooks/useSideColumn.ts (sideColumnFromInsets); src/components/Navigation/AppNavigation.tsx (column capsule width)
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** In the shell on the iPhone Duo, poses with a side column (folded portrait, both folded landscapes, unfolded landscape, the right pane side by side) still float the five-button bottom dock over content, while the column itself sits unused beside it.

**Approach:** Detect the column with story 7's rule (exactly one of `env(safe-area-inset-left/right)` non-zero, read in JS and re-read on `visualViewport` resize, `screen.orientation` change and a ResizeObserver), and render `AppNavigation`'s dock as a vertical capsule at that column's bottom; the dock variables in `src/index.css` switch with the form so content clears the capsule with no bottom band. Seed the sim driver's fixture pair so every view scrolls, and check every pose through `scripts/sim-driver/sim`.

## Boundaries & Constraints

**Always:**
- Form follows the side insets only: never `screen.*`, the user agent, `display-mode` or a device check. Both insets non-zero (non-Duo iPhone landscape, DW-328: 0/62/20/62) or both zero → bottom dock.
- One `<nav aria-label="Primary" data-testid="nav-dock">` in both forms, same `nav-${view}` buttons, same `onViewChange`, labels as `aria-label`, `aria-current="page"` on the active one; the header (gear included) is unchanged — Settings in the column is story 8.
- Column capsule: buttons top-to-bottom in `DESTINATIONS` order, icons only (h-11 w-11, the bottom dock's icon size), active on `bg-tint text-accent`, the bottom dock's glass/ring/shadow, bottom edge at the bottom dock's `calc(1rem + env(safe-area-inset-bottom))`, flush with the column's screen edge and as wide as that side's `env()` inset (never a literal 84).
- `src/index.css` stays the one source of the dock's space: bottom form keeps today's `--dock-clearance`/`--dock-top` values; column form sets `--dock-clearance` and `--dock-top` to `env(safe-area-inset-bottom)` and a per-side clearance (`--dock-left`/`--dock-right`, `0px` otherwise) equal to that side's inset, which `<main>` applies as side padding.
- Fixture seeding stays in `scripts/sim-driver/provision.ts`, local stack only, idempotent, touching only the two fixture accounts' rows and storage objects.

**Never:**
- Native code, `ios/App` or `capacitor.config.ts` changes; react-router; a second navigation component.
- A Settings button in the column or removing the header gear (story 8).
- Committing screenshots or device readings with real names; touching E2E pool accounts or production.
- Leaving a sim/test build in the repo's `dist/` or `ios/App/App/public/`, or an update server running.

## I/O & Edge-Case Matrix

| Scenario | Insets L/R (signal) | Expected | Error Handling |
|----------|--------------|---------------------------|----------------|
| Right column | 0/84 | Capsule on the right, `data-dock="column-right"` on `<html>` | — |
| Left column | 84/0 | Capsule on the left, `column-left` | — |
| No column | 0/0 | Bottom dock, attribute absent | — |
| Both sides | 62/62 | Bottom dock | — |
| Side flip | 0/84 → 84/0 on `screen.orientation` change only | Capsule moves to the left | — |
| Pane swap | 0/0 → 0/84 on ResizeObserver only | Bottom → right capsule, same view | — |
| Unfold | 0/84 → 0/0 on `visualViewport` resize | Capsule → bottom dock, same view | — |
| API missing | no `visualViewport`/`screen.orientation`/`ResizeObserver` | Remaining signals still re-read; no throw | Guard each |

</intent-contract>

## Code Map

- `src/components/Navigation/AppNavigation.tsx` -- `DESTINATIONS`, `GLASS`, header (leave as is), bottom `<nav>` (bottom form unchanged); update the file-header comment for the second form.
- `src/index.css:170-180` -- `--dock-clearance`, `--dock-top` in `@layer utilities :root`; add `--dock-left/--dock-right` and the `:root[data-dock=…]` overrides there.
- `src/App.tsx:739-757` -- `<main>` classes (`pb-(--dock-clearance)` / Love Notes `pb-(--dock-top)`); add side padding from `--dock-left/right`; update the chrome comment.
- `src/hooks/` -- new `useSideColumn.ts` (no barrel export needed); `tests/setup.ts:90` mocks `ResizeObserver` with no callbacks, so hook tests stub their own controllable one plus `getComputedStyle`, `visualViewport`, `screen.orientation`.
- `src/components/Navigation/__tests__/AppNavigation.test.tsx` -- existing contract tests; mock the hook module to drive forms.
- `tests/e2e/navigation/dock.spec.ts` -- bottom-dock specs; only a Settings reload test exists today (`:148`).
- `src/components/love-notes/MessageInput.tsx:217` -- composer (`pb-3`); with `--dock-top: env(safe-area-inset-bottom)` its controls end 46 pt above the screen bottom on the Duo.
- `scripts/sim-driver/provision.ts` -- extend `main()` after linking; reuse `admin` and `profileId`. Tables: `events` (`user_id`, `label` ≤100, `event_date` ≥ today, `icon` ring|plane|calendar; home shows ≤ 6), `moods` (`mood_type` one of the 12, unique `(user_id, created_at)`), `love_notes` (`from_user_id`≠`to_user_id`, `content` 1–1000), `photos` (`storage_path` unique `${userId}/${uuid}.png` in private bucket `photos`, `filename`, `file_size`, `width`, `height`, `mime_type` image/png).
- `scripts/sim-driver/sim` -- `provision`, `build`, `signin`, `pose`, `rotate`, `state`, `tap`, `scroll`, `dump` (labels + frames), `screenshot`; story 9 plan's Residual risks: select the non-Duo phone in Device Hub's window yourself.
- `AGENTS.md:100` -- the dock-clearance paragraph.

## Tasks & Acceptance

**Execution:**
- [x] `src/hooks/useSideColumn.ts` -- export `sideColumnFromInsets(left, right): 'left' | 'right' | null` and `useSideColumn()`: a hidden fixed probe padded with `env(safe-area-inset-left/right)`, read on mount (layout effect), on each of the three signals and again on the next animation frame after a signal; clean up listeners, observer and probe.
- [x] `src/hooks/__tests__/useSideColumn.test.ts` -- every I/O matrix row, each signal alone triggering the re-read, cleanup on unmount.
- [x] `src/components/Navigation/AppNavigation.tsx` -- column form per Always; publish the form as `data-dock` on `document.documentElement` (layout effect, removed for the bottom form and on unmount); the nav carries `data-form="column|bottom"`.
- [x] `src/index.css`, `src/App.tsx` -- dock variables per form; `<main>` side padding.
- [x] `src/components/Navigation/__tests__/AppNavigation.test.tsx` -- both forms: five labelled buttons, icon-only column with active highlight and no label text, `data-dock` set/cleared, form switch on a re-render keeps `currentView`, a fresh mount in column form with each `currentView` marks that button (the reload case).
- [x] `tests/e2e/navigation/dock.spec.ts` -- for each dock destination: tap, reload, the view renders and its button has `aria-current="page"`.
- [x] `scripts/sim-driver/provision.ts` -- wipe and reseed both accounts' rows: 6 upcoming events, ≥ 40 moods for the signed-in account and ≥ 30 for the partner (distinct `created_at`), ≥ 40 love notes both ways, ≥ 24 photos with a small PNG uploaded to each path.
- [x] `AGENTS.md` -- rewrite the dock-clearance paragraph for both forms (`data-dock`, `--dock-left/right`, Love Notes in the column form).
- [x] Simulator run through `scripts/sim-driver/sim` (provision, build, signin) -- every check in the ACs; record commands, exit codes and readings in Implementation Notes; screenshots go to the session scratchpad, never the repo.

**Acceptance Criteria:**
- Given the Duo simulator and a signed-in fixture account, when it is put in folded portrait, folded landscape-secondary, folded landscape-primary and unfolded landscape, then `sim dump` shows five buttons labelled Home, Mood, Love Notes, Photos, Partner whose frames lie inside the column (x ≥ page width − right inset, or x + width ≤ left inset), the capsule anchored at the column's bottom (its bottom edge 1rem above the bottom inset), and in unfolded portrait the five buttons sit in a horizontal row at the bottom; a screenshot of each pose is saved.
- Given an iPhone 17 simulator, when in portrait and both landscapes, then the five buttons sit in a horizontal row at the bottom.
- Given the Mood view with a mood tile tapped but not saved, when the Duo is folded, unfolded or rotated between a column pose and unfolded portrait (and between the two folded landscapes), then the form switches and `dump` still shows Mood's button active and the tapped tile still selected, so the page did not reload.
- Given each column pose, when each button is tapped, then its view opens and that button alone shows the active highlight (read from the screenshot, since WebKit does not expose `aria-current` to XCUITest; the unit tests pin `aria-current`).
- Given each column pose, when each of the five views is scrolled to its end, then its last item's frame is whole, does not intersect the capsule's frame, and sits less than the bottom form's clearance (96 pt + the bottom inset) above the page bottom; on Love Notes the send button's right edge is left of the capsule (right column) and its bottom is within 46 pt of the page bottom.
- Given the bottom form, when `npm run test:e2e -- tests/e2e/navigation` runs, then every spec passes.

## Implementation Notes

Run 2026-10-30 on the iPhone Duo simulator (iOS 27.1, `A0A486ED…`) and the iPhone 17 simulator (iOS 27.2, `73CC7947…`), local stack, every device command through `scripts/sim-driver/sim`, no person acting. Screenshots of each pose, each tapped view and each scrolled end are in the session scratchpad, not the repo. The active button was read from the screenshot (see the change log): the column's tint samples `srgba(252,231,243)` against the glass's `srgba(255,253,253)`, sampled 6 pt inside each button's left edge at its mid-height; in the bottom form the active button is also the wide one in `dump` (93 pt against 45).

**Setup.** `sim provision` → exit 0, `seeded 6 events, 70 moods, 80 love notes, 24 photos`; run again → exit 0, same line, and the local database then held exactly 6 / 70 / 80 / 24 rows and 24 `photos` objects for the pair (the second run wiped the first's). `sim build` → exit 0 (`installed sim-tree-1793408713 …`, the build with the final hook); `sim signin` → exit 0.

**AC 1, 4, 5 — forms, taps, scrolled ends** (capsule frame from `dump`; gap = page bottom − last item's bottom, limit < 130 = 96 + 34):

| Pose | Page | Form / capsule | Taps (view witness, highlighted) | Last item gap: Home / Mood / Love Notes / Photos / Partner |
|---|---|---|---|---|
| Folded portrait | 466×678 | right, x382 y376 84×252 | all five PASS, highlight on the tapped one alone | 51 / 57 / 46 / 90 / 71 |
| Folded landscape-secondary | 678×466 | right, x594 y164 84×252 | all five PASS | 50 / 57 / 46 / 91 / 71 |
| Folded landscape-primary | 678×466 | left, x0 y164 84×252 | all five PASS | 50 / 57 / 46 / 91 / 71 |
| Unfolded landscape | 951×669 | right, x867 y367 84×252 | all five PASS | 50 / 57 / 46 / 91 / 71 |
| Unfolded portrait | 669×951 | bottom row at y849, Home…Partner left to right | — | — |

Every last item was whole and did not intersect the capsule. Love Notes' last item is the composer row: send button right edges 366 (≤ 382), 578 (≤ 594), 851 (≤ 867) in the right-column poses, x618 against the left capsule's right edge 84 in landscape-primary, its bottom 46 pt above the page bottom in all four. In every column pose the five buttons lie inside the column (x ≥ page width − 84, or x + 44 ≤ 84) in DESTINATIONS order. **AC 1's "in its lower half" holds in folded portrait and unfolded landscape only**: in both folded landscapes the page is 466 pt tall, so its lower half starts at 233, and Home (y172) and Mood (y220) start above it — see the change log.

**AC 2 — iPhone 17.** `sim --device … build` and `signin` → exit 0; portrait 402×874, five buttons in one row at y772; after `rotate` (landscapeLeft) and `rotate 2` (landscapeRight) 874×402, one row at y314. Then `uninstall` and `xcrun simctl shutdown`; Device Hub's window was switched to the iPhone 17 for the rotations and back to the Duo afterwards (System Events selecting the sidebar row, as story 9's residual risk asks).

**AC 3 — form switches keep the page.** On Mood with Happy tapped (not saved): folded landscape-primary (left) → rotate → folded portrait (right) → folded landscape-secondary (right) → **side flip** to landscape-primary (left) → portrait → secondary → **flip** (left) → portrait → secondary → `pose open` → unfolded portraitUpsideDown (bottom) → unfolded landscapeLeft (right) → unfolded portrait (bottom) → unfolded landscapeRight (right) → portraitUpsideDown (bottom) → `pose closed` → folded landscapeRight (right) → `pose open` (bottom) → `pose closed` (right) → flip (left) → `pose open` → unfolded portrait (bottom). After every step the form matched the pose, Mood alone was highlighted (wide in the bottom form) and `dump` showed `Happy mood` with value 1 and the text `Selected: Happy`.

**Commands.** `npx vitest run src/hooks/__tests__/useSideColumn.test.ts src/components/Navigation` → 58 passed. `npm run test:unit` → exit 0, 203 files, 3204 tests. `npm run typecheck` → exit 0 (no TS2883). `npm run lint` → exit 0. `npm run test:e2e -- tests/e2e/navigation` → exit 0, 32 passed (the 5 new reload specs included); its one `Can't perform a React state update on a component that hasn't mounted yet` console line also appears with AppNavigation reverted to the baseline (3 times there), so it predates this change. `git status --short` → only the planned files; `ls dist ios/App/App/public` → neither exists; `pgrep -fl "http.server|wrangler"` → nothing (exit 1). The Duo holds the working tree's shell (no readout), signed in as the first fixture account.

## Plan Change Log

- `useSideColumn`'s probe holds one child per side (`width: env(safe-area-inset-left|right)`), and the ResizeObserver watches both as well as the probe. With the probe alone, the side flip from folded landscape-secondary to -primary left the capsule on the right in 2 of 3 flips on the simulator (the third, on a readout build, landed): `dump` showed `data-dock` still `column-right` with the capsule shrunk to 44 pt at x656 (its `env()` width already 0), so the `screen.orientation` change and the next frame had both read the old insets and nothing fired afterwards. A readout build showed the insets landing (`0/84/34/0 -> 0/0/34/84 w/ orientation.change`). The children change size on the flip, so the observer reports it after layout; with them, 4 of 4 flips moved the capsule left (three in the AC 3 run, one before the landscape-primary checks). Reading still uses the probe's padding.
- `provision.ts` gives the signed-in account no mood today (its newest is two hours before local midnight); the partner's newest is today. A mood saved today seeds the Mood form, and App's 5-minute sync reseeds it (`MoodTracker.tsx`'s render-time seed): in the first AC 3 run, with Loved saved today, a tapped Happy tile was reset to Loved between two checks, while a second run over the same switches kept it — the reseed, not a reload, as far as `dump` can tell — which made the check unreadable.
- "≥ 40 love notes both ways" is seeded as 40 each way (80); photos as 12 per account, so each sees 24.
- The active button is read from screenshots, not `dump`: WebKit does not report `aria-current` to XCUITest (with `isSelected` added to `dump` as a trial, no button was selected; that trial was reverted). `aria-pressed` does show, as a switch with value 1, which is how AC 3 reads the mood tile.
- Not changed, raised for review: AC 1's "frames … in its lower half" cannot hold in the folded landscapes with the Always sizing (five h-11 buttons, `gap-1`, `py-2` → a 252 pt capsule, bottom edge at 1rem + 34): the lower half of a 466 pt page is 233 pt, 34 of it the home-indicator band, and five 44 pt buttons alone need 220. The capsule's bottom 3 buttons are in the lower half; Home and Mood are not.

- Orchestrator, after implementation: AC 1's "in its lower half" was the planner's over-specification of the ticket's "inside the column at its bottom"; a 252 pt five-button capsule cannot fit the lower half of a 466 pt page, so the AC now reads "anchored at the column's bottom", which the run's readings meet (capsule bottom at 1rem + 34 in every pose). AC 4's "read as selected in `dump`" became the screenshot highlight, because WebKit does not expose `aria-current` to XCUITest (see the entry above).

## Review Triage Log

### 2026-10-30 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 3, false 1, maybe-false 1
- findings:
  - `[maybe-false]` `[defer]` A small one-sided inset (Android Chrome landscape with a cutout) gives a capsule narrower than its 44 px buttons — the rule and width are as described, but whether any browser reports one small side inset was not measured; would settle by reading the insets in Android Chrome in landscape on a punch-hole phone. If true, medium; deferred to frontmatter `deferred` (unverified), since the fix changes the ticket's stated "exactly one non-zero" rule.
  - `[low]` `[patch]` The unmount test's `cancelAnimationFrame` check passed even without the cleanup's cancel, and its after-unmount `result.current` check could not fail — patched: the spy is cleared before `unmount()` and asserted with the pending frame id; the after-unmount check now asserts `getComputedStyle` is not called on signals fired after unmount (each fails when its cleanup line is deleted).
  - `[low]` `[patch]` The no-`requestAnimationFrame` branch never ran — patched: a test with both frame functions undefined shows a signal still re-reads and unmount does not throw.
  - `[low]` `[reject]` The plan is oversized against AGENTS.md's "keep loop story specs short" — the fix splits or edits this build's plan, which triage never does; the ticket's epic also decided to keep story 2 whole.
  - `[false]` `[reject]` The side-by-side right pane is never checked on the simulator, and a short pane would overlap the capsule with the header — the epic's 2026-10-30 Decision puts that pose on story 2's unit tests (the pane-swap ResizeObserver test exists) and story 5's device check, since no driver step enters split view; the pane is 669 pt tall (story 7: 469×669), far above the ~366 pt the overlap would need.

## Design Notes

Clearance is horizontal, not a bottom band: a capsule ~250 pt tall would leave a band that tall under the last item if cleared from the bottom, and R4 forbids a bottom band. So in column poses `<main>` stops at the column's edge, the capsule fills the column's width at its bottom, and the header (sticky, outside `<main>`) still runs full width under iOS's status capsule — the part of the column the owner allowed content into. Love Notes, also inside `<main>`, therefore "ends at the column dock's edge"; `--dock-top: env(safe-area-inset-bottom)` takes it down to the home-indicator band, where the composer's controls stay out of the swipe area.

Why re-read on the next frame too: a `screen.orientation` change can fire before layout applies the new `env()` values, and on the side flip nothing else fires afterwards.

```css
:root[data-dock='column-right'] {
  --dock-clearance: env(safe-area-inset-bottom);
  --dock-top: env(safe-area-inset-bottom);
  --dock-right: env(safe-area-inset-right);
}
```

## Verification

**Commands:**
- `npx vitest run src/hooks/__tests__/useSideColumn.test.ts src/components/Navigation` -- expected: pass
- `npm run test:unit` -- expected: pass
- `npm run typecheck` and `npm run lint` -- expected: clean (worktree TS2883 baseline excepted)
- `npm run test:e2e -- tests/e2e/navigation` with `supabase start` -- expected: pass
- `git status --short`; `ls dist ios/App/App/public 2>/dev/null`; `pgrep -fl "http.server|wrangler"` -- expected: only planned files; no test build in the repo; no server

## Auto Run Result

Status: built

**Summary:** On the iPhone Duo shell, wherever exactly one side safe-area inset is non-zero, `AppNavigation`'s dock is now an icon-only vertical capsule at that column's bottom, as wide as the column's `env()` inset; elsewhere it is today's bottom dock. `useSideColumn` reads the insets from a hidden probe and re-reads on `visualViewport` resize, `screen.orientation` change and a ResizeObserver (on the probe and one child per side, which catches the side flip once layout applies it), plus the next frame. The form is published as `data-dock` on `<html>`, and `src/index.css` moves the dock's space with it: in column poses `<main>` pads the column's side and keeps only the home-indicator band at the bottom, so nothing sits under the capsule and no bottom band remains. `sim provision` now seeds the fixture pair so every view scrolls. Every simulator check ran through the driver with no person.

**Files changed:**
- `src/hooks/useSideColumn.ts` — the column rule and its re-read signals (new).
- `src/hooks/__tests__/useSideColumn.test.ts` — every I/O matrix row, each signal alone, the missing-API and no-frame cases, cleanup (new).
- `src/components/Navigation/AppNavigation.tsx` — the column form of the one `<nav>`, `data-form`, `data-dock` on `<html>`.
- `src/components/Navigation/__tests__/AppNavigation.test.tsx` — both forms, form switch keeping the view, the column-form reload case.
- `src/index.css` — `--dock-left`/`--dock-right` and the column-form overrides of `--dock-clearance`/`--dock-top`.
- `src/App.tsx` — `<main>` side padding from the dock variables.
- `tests/e2e/navigation/dock.spec.ts` — tap-then-reload keeps each dock destination and its current button.
- `scripts/sim-driver/provision.ts` — wipes and reseeds the fixture pair: 6 events, 70 moods, 80 love notes, 24 photos with PNGs.
- `AGENTS.md` — the dock paragraph rewritten for both forms.

**Review findings:** 5 from the quick lens. Patched 2 (low): the unmount test's frame and listener checks, and the no-`requestAnimationFrame` branch. Deferred 1 (maybe-false, medium if true): a small one-sided inset on Android. Rejected 2: plan oversized (fix edits this plan), right side-by-side pane unchecked on the simulator (false; the epic assigns it to unit tests and story 5).

**Follow-up review recommended:** false — this first pass patched no high and no medium (2 low).

**Verification:** `npx vitest run` on the hook and navigation suites 59 passed; `npm run test:unit` exit 0, 3205 tests; `npm run typecheck` and `npm run lint` exit 0; `npm run test:e2e -- tests/e2e/navigation` 32 passed (run before the test-only patches, which touch no E2E or app code); no `dist/` or `ios/App/App/public/` in the repo; no update server running. Simulator readings for every AC are in Implementation Notes: the capsule inside the column in all four Duo column poses, bottom row in unfolded portrait and on the iPhone 17 in portrait and both landscapes, every tap opening its view with only its button highlighted, every view's scrolled end clear of the capsule 46–91 pt above the page bottom, and an unsaved Mood selection surviving every fold, unfold, rotation and side flip.

**Residual risks:**
- The side-flip timing fix (side children observed) is proven on the simulator only; story 5 checks it on the owner's Duo.
- WebKit does not expose `aria-current` to XCUITest, so the simulator read the active button from screenshot colour; the unit and E2E tests pin `aria-current`.
- The capsule is 252 pt tall; story 8's sixth button makes it ~300 pt, which still clears the header in the 466 pt folded landscapes, but story 8 must re-check R4.
- The right side-by-side pane is covered by the pane-swap unit test only until story 5.
- A small one-sided inset outside iOS (deferred above) is unmeasured.
- Device Hub's window was switched to the iPhone 17 and back with System Events for the rotations; the Duo holds the working tree's shell, signed in as the first fixture account.
