---
title: 'The native shell shows a live update and lets the owner apply it now'
type: 'feature'
ticket: '1'
created: '2026-11-04'
status: 'built'
baseline_revision: '11d56905b57a58c2dec244dd7c8611bbc99eecb3'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-my-love/ux-live-update-prompt/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-my-love/ux-live-update-prompt/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The shell's update toast sits at the top over the header, can be closed, and its Refresh restarts without asking; an ignored or closed prompt leaves no way to apply the update before the next background.

**Approach:** Move both toasts to the bottom (above the dock, or the Love Notes composer), make the ready toast a 6 s tap target that opens a No/Yes confirm, and add a native-only header bell whose dot and Notifications drop-down hold an "Update now" entry until the update is applied. Strings, colours and sizes are the UX spines' (DESIGN.md, EXPERIENCE.md); ticket R1–R11 are the acceptance.

## Boundaries & Constraints

**Always:** bell, dot, drop-down and toasts exist only under `Capacitor.isNativePlatform()`; `notifyAppReady()` stays first; the `next()` queue and background swap stay the fallback; the drop-down is an overlay — no view, URL, history entry or `ViewType`/`pathMap`/`DESTINATIONS` change; toast placement uses `--dock-top`/`--dock-left`/`--dock-right` or the composer's live edge, never a hard-coded offset; Reduce Motion turns the toast and drop-down motion into fades.

**Never:** change the website/PWA update path in `main.tsx`, the dock, the gear or column spacer, or Settings → Notifications; add a count badge or a dismiss to the entry; use "bundle", "build" or a version in any string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh download | newer, not downloaded | download toast → ready toast 6 s, dot, entry | — |
| Earlier download | `list()` has it | ready toast only, dot, entry | — |
| Ready toast tapped / entry tapped | ready | toast hides / drop-down closes; dialog opens | — |
| Yes | dialog open | both buttons disabled, `reload()` | reload throws → dialog closes, dot + entry stay |
| No / scrim | dialog open | dialog closes, same view; no ready toast again this launch | — |
| Download fails / bad `latest.json` / offline | — | download toast leaves; no ready toast, dot or entry | status `idle` |
| Same build | `latest.version === __BUILD_ID__` | nothing shows; drop-down "No notifications" | — |
| Drop-down open | bell, outside tap, view change, `visibilitychange` hidden | closes; outside tap presses nothing | — |

</frozen-after-approval>

## Code Map

- `src/services/nativeUpdates.ts` -- status store (`idle|downloading|ready`), `startNativeUpdates`, `applyUpdate` (swallows reload failure, returns void). Keep the check logic as is.
- `src/components/shared/UpdateToast.tsx` -- current top toast with X and Refresh; mounted outside `App` in `src/main.tsx:56` (shows on sign-in too). Reuse the downloading body and progress bar; z-100 stays.
- `src/components/Settings/ConfirmDialog.tsx` -- `KitDialog` (focus trap, Escape and scrim tap → `onCancel`, scale-in panel; render inside `AnimatePresence`). Busy pattern to copy: `src/components/love-notes/NoteRemoveConfirmation.tsx` (scrim/Escape ignored, both buttons `disabled`).
- `src/components/shared/kitClasses.ts` -- `SECONDARY_BUTTON`, `DESTRUCTIVE_BUTTON`, `DIALOG_TITLE`; `DIALOG_BACKDROP` is z-50 (do not add a second z to it).
- `src/components/Navigation/AppNavigation.tsx:138-178` -- header (`sticky z-40 bg-glass backdrop-blur-lg`, `px-3`, `h-16`, hidden on Settings); `:143` empty left `<span className="min-h-11 min-w-11">` is the bell's slot; gear classes at `:166` to match. The header is not padded by `--dock-left`.
- `src/components/love-notes/MessageInput.tsx:216` -- composer outer div (`data-testid="message-composer"`), no ref today; nothing measures it.
- `src/index.css:222-249` -- `--dock-top`, `--dock-left`, `--dock-right` per `data-dock` form.
- Tests: `src/components/shared/__tests__/UpdateToast.test.tsx` (hoisted store mock, motion mock), `tests/unit/services/nativeUpdates.test.ts` (updater + fetch mocks), `src/components/Navigation/__tests__/AppNavigation.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/nativeUpdates.ts` -- `applyUpdate()` resolves `false` when not ready or the reload fails; add a tiny confirm-open store (`openUpdateConfirm`, `closeUpdateConfirm`, `getUpdateConfirmOpen`, `subscribeUpdateConfirm`); update the header comment -- one place both the toast and the bell drive.
- [x] `src/components/shared/UpdateToast.tsx` -- bottom placement (`bottom: calc(var(--composer-clearance, var(--dock-top)) + 12px)`, sides `--dock-left/right + 1rem`, max-w-sm); no X; ready toast is one 44px button "Update ready — tap to restart", hides after 6 s or on tap (tap opens the confirm), and stays hidden for the rest of the launch; spring up from below, fade only under `useReducedMotion()` -- R1, R2, R3, R5, R11.
- [x] `src/components/shared/UpdateConfirmDialog.tsx` (new) + `src/main.tsx` -- `KitDialog` with title "Update now?", muted body, No (`SECONDARY_BUTTON`, initial focus) and Yes (`DESTRUCTIVE_BUTTON`); Yes sets busy, disables both, awaits `applyUpdate()`, closes on `false`; scrim/Escape ignored while busy; mount beside `UpdateToast` -- R3, R4, R5.
- [x] `src/components/Navigation/NotificationsBell.tsx` (new) + `AppNavigation.tsx` -- native-only bell (gear's classes, lucide `Bell`, `aria-label="Notifications"`, `aria-expanded`, ink while open), dot while status is `ready`; drop-down portalled to `body` (the header's backdrop-filter traps fixed children): transparent full-screen catcher (z-[105]) plus the card (z-[110]) at `top: calc(env(safe-area-inset-top) + 4rem + 4px)`, `left: 12px`, width `min(320px, 100vw - --dock-left - --dock-right - 32px)`, scrolls past `--dock-top + 12px`; "NOTIFICATIONS" label, the "Update now" entry or "No notifications"; closes on bell, catcher, entry tap, `currentView` change, `visibilitychange` hidden; 150 ms fade with 4px drop. `AppNavigation` renders it in place of the left span only when native -- R9, R10.
- [x] `src/hooks/useComposerClearance.ts` (new) + `MessageInput.tsx` -- ref on the composer's outer div; ResizeObserver plus window/`visualViewport` resize publish `--composer-clearance` (`innerHeight − rect.top`, px) on `<html>`, removed on unmount -- R11 on Love Notes.
- [x] Tests -- rewrite `UpdateToast.test.tsx` (bottom classes, no close button, 6 s hide with fake timers per AGENTS.md's user-event rule, once per launch, tap opens confirm); add `UpdateConfirmDialog.test.tsx` (Yes disables and applies, failed reload closes, No/scrim close), `NotificationsBell.test.tsx` (dot, entry/empty, outside tap presses nothing, view change and hidden close, no URL change), `useComposerClearance` test; extend `nativeUpdates.test.ts` (`applyUpdate` returns, confirm store) and `AppNavigation.test.tsx` (web keeps the empty span, no bell; native shows it; Settings shows none).
- [x] `AGENTS.md` -- the shell paragraph's UpdateToast sentence describes Refresh; reword to the bottom toasts, confirm and bell. Own `docs(...)` commit.

**Acceptance Criteria:**
- Given the shell installed by `sim build --update-port 8791` and `sim serve-update --port 8791`, when it launches, then the download toast, then the ready toast and dot show above the dock; tapping the toast and Yes restarts with no toast, dot or entry.
- Given a second `sim serve-update` from a rebuilt tree, when the app is launched, the bell's entry opened, No tapped, then `sim background` and `sim launch`, then it runs the newer build with no toast, dot or entry.
- Given the website in Playwright, when Home loads, then the header's left slot is the empty span and no bell or update toast exists.

## Implementation Notes

- Busy focus: Yes moves focus to a `tabIndex={-1}` wrapper inside the panel before both buttons disable, as `NoteRemoveConfirmation` does, so focus never drops to `<body>` outside the trap.
- One overlay at a time: `UpdateToast` subscribes to the confirm store and hides the ready toast for the launch whenever the dialog opens, so a dialog opened from the bell's entry never sits under a still-showing z-100 toast.
- View-change close in `NotificationsBell` adjusts state during render (previous-view comparison) rather than in an effect, which `react-hooks/set-state-in-effect` forbids.
- Drop-down geometry is inline `style` (top, width, max-height) so the nested `min()`/`calc()` subtraction never depends on Tailwind's arbitrary-value parsing; the toast's arbitrary classes were checked in a built CSS bundle.
- Verified: unit suites (302 targeted, full `SEED=1 test:unit:coverage` 4167 passed), `typecheck` and `lint` exit 0; Playwright on the website (Home and Love Notes: empty left span, no bell or toast, `--composer-clearance` follows the composer and a toast-classed box ends 12px above the composer and the dock); simulator: both acceptance runs, column-left, column-right and inner-portrait bottom dock (bell top-left, toast clear of the dock and column), outside tap presses nothing, Settings has no bell. The ready toast on Love Notes in the shell was not captured: `sim tap` takes about 11 s, longer than the toast's 6 s, and the shell relaunches on Home.

## Plan Change Log

## Review Triage Log

Pass 1 (quick lens): high 0, medium 1, low 1, false 1, maybe-false 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | Confirm dialog (KitDialog, z-50 in `#root`) opens hidden under FullScreenImageViewer (z-50, portalled to body), NoteRemoveConfirmation (z-70) or PhotoViewer's delete dialog (z-60) when the z-100 ready toast is tapped over them | medium | patch | Confirmed at `FullScreenImageViewer.tsx:76-84` and `NoteRemoveConfirmation.tsx:179`; DESIGN.md puts the dialog at the front. Fix: a stacking-context wrapper above z-100 in `UpdateConfirmDialog`, no new KitDialog prop |
| 2 | Drop-down left edge omits `--dock-left`, against both spines | false | reject | Both spines also say the list is anchored to and follows the bell, and EXPERIENCE.md's pose table puts the bell inside the 84pt left inset; the header is not padded by `--dock-left` (`App.tsx` renders `AppNavigation` outside `<main>`), so adding it would move the list 84pt off the bell. The code follows the spines' governing rule (Design Notes) |
| 3 | The plan's simulator check of the toast above the Love Notes composer did not run, and the gap is not in the ledger | maybe-false | defer | Placement was measured in the browser only; shell launch lands on Home and `sim tap` outlasts the 6 s toast. Settled by a throttled-download simulator run; logged as DW-460 (medium, unverified) |
| 4 | "presses nothing underneath" assertion in `NotificationsBell.test.tsx` cannot fail | low | patch | The click is dispatched on the catcher and happy-dom does no hit-testing, so `underneath` can never be called; the test's class and close assertions do still guard the catcher. Fix: drop the vacuous assertion and name the test for what it proves |

## Design Notes

- Drop-down left edge: DESIGN.md says "header's 12px inset plus `--dock-left`", but the header is not offset by `--dock-left` (EXPERIENCE.md puts the bell "inside the 84pt left inset" in column-left). Both spines say the list is anchored to and follows the bell, so it lines up with the bell at `left: 12px` in every pose.
- "Launch" = a JS start; the toast's hidden-for-this-launch flag is component state in `UpdateToast`, which mounts once in `main.tsx`. A successful restart or background swap reloads the web view, so the new build starts `idle`.

## Verification

**Commands:**
- `npx vitest run src/components/shared src/components/Navigation src/hooks tests/unit/services/nativeUpdates.test.ts` -- expected: all pass
- `npm run typecheck && npm run lint` -- expected: exit 0
- `SEED=1 npm run test:unit:coverage` -- expected: pass, shuffled

**Manual checks:**
- Playwright (`playwright-cli open --headed`, `npm run dev:local`): R10 on Home and Love Notes.
- Simulator (`scripts/sim-driver/sim`, README first): the two acceptance runs above, plus folded (column-right), left pane (column-left) and inner portrait (bottom dock) — bell top-left, toast clear of dock/column, toast above the composer on Love Notes as it grows, drop-down open/close rules, Settings has no bell.
