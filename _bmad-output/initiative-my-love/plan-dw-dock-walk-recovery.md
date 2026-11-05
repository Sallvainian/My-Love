---
title: 'DW-441: the dock walk back to Home always ends'
type: 'bugfix'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: '68690d774f2882d2fabe9acf70143f3495da16f3'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A dock pick above the first history entry starts a walk (`history.go(-depth)`) that only its `popstate` ends. When none comes — a stored `depth` past the start of the history, or a page frozen mid-walk and restored from the back/forward cache — `walkingDown` stays set, every later dock tap only overwrites `pendingView`, and the dock does nothing until a reload (DW-441).

**Approach:** Clamp the stored `depth` to `history.length - 1`, end the walk on a `pageshow` with `persisted`, and add a safety-net timer that ends a walk whose `popstate` never came and lands the pending view in place. Pin it with an isolated unit test and a Playwright spec that also covers a dock tap right after a reload.

## Boundaries & Constraints

**Always:** Home stays the bottom of the history: every landing leaves the picked view one entry above a Home entry, carrying `{ view, inApp: true, depth: 1 }`. A second tap mid-walk still changes the target without walking again. Every walk end (popstate, timer, pageshow) removes all three of the walk's hooks (popstate listener, pageshow listener, timer).

**Never:** No change to `App.tsx`'s popstate handler, `openSettingsPage`/`showSettingsPage` semantics, or the five view-registration places. No sessionStorage hand-off for the reload case (measured unnecessary, see Design Notes). Leave `navigationSlice.settingsStack.test.ts` unchanged. Do not edit the deferred-work ledger.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal walk | at `/mood` depth 1, tap Notes | walks to the first entry, lands `/notes` depth 1; back → `/` | No error expected |
| Depth past the start | entry's `depth` set to 50, tap Notes then Photos | first tap walks at most `history.length - 1` and lands Notes; second tap lands Photos | No error expected |
| No popstate ever | `history.go` does nothing, tap Notes, tap Photos | `go` called once; after `WALK_TIMEOUT_MS` the current entry becomes Home and `/photos` depth 1 is pushed on it; next tap walks again | `logger.warn` names the landed view |
| bfcache restore mid-walk | walk under way, `pageshow` with `persisted: true` | walk cleared (no pending view, timer cleared); next tap starts a fresh walk | No error expected |
| Tap after reload | reload on `/settings/dates` (depth 2), tap Notes | lands `/notes`; back → Home | No error expected |

</intent-contract>

## Code Map

- `src/stores/slices/navigationSlice.ts` -- `historyDepth()` (:62-65) reads `history.state.depth`; also used by `openSettingsPage` (:212) and `src/components/Settings/stack/SettingsStack.tsx:106`, so clamping there normalises every reader. Module vars `pendingView`/`walkingDown` (:72-73). `setView` walk branch (:160-177) and first-entry branch (:178-192); `pathMap` is local to `setView` (:135-142).
- `src/App.tsx:221-241` -- the popstate handler that runs before the walk's listener (registered earlier) and sets the URL's view with `skipHistory`; read-only.
- `tests/unit/stores/navigationSlice.settingsStack.test.ts` -- existing history-contract tests (style, `vi.mock` of the logger, `vi.waitFor` on pathname); must stay green unchanged.
- `tests/e2e/navigation/dock.spec.ts` -- E2E style to copy: `dismissWelcomeSplash` in `beforeEach`, `navigateTo` from `tests/support/helpers/navigation.ts`, view witnesses (`love-notes-view`, `photo-gallery` or `photo-gallery-empty-state`, `message-text`, `nav-home` `aria-current`). `settings-dates-row` opens `/settings/dates`.
- `tests/e2e/navigation/dock-walk.spec.ts` -- currently a throwaway probe from planning; replace its whole content.

## Tasks & Acceptance

**Execution:**
- [ ] `src/stores/slices/navigationSlice.ts` -- clamp `historyDepth()` to `history.length - 1`; hoist `pathMap` to a module const and extract the first-entry branch into a helper `stackOnFirstEntry(view)`; replace `walkingDown` with a module `stopWalk: (() => void) | null` set while a walk runs; the walk adds the `once` popstate listener, a `pageshow` listener that calls `stopWalk` when `event.persisted`, and a `setTimeout(WALK_TIMEOUT_MS)` (exported const, 1000) that stops the walk, then calls `stackOnFirstEntry(target)` and `logger.warn`s; update the header and module comments -- the fix.
- [ ] `tests/unit/stores/navigationSlice.dockWalk.test.ts` (new) -- `vi.resetModules()` plus a dynamic import of `useAppStore` in `beforeEach`, history reset to `/`; cover the four store-level matrix rows (normal walk with a second tap mid-walk, depth 50, `history.go` stubbed to a no-op with fake `setTimeout`/`clearTimeout` only, persisted `pageshow` built as an `Event` with `persisted` defined); restore every spy and the real timers in `afterEach` -- regression lock.
- [ ] `tests/e2e/navigation/dock-walk.spec.ts` -- replace the probe with two `[P1]` tests: depth 50 via `replaceState` at `/mood` then Notes then Photos, each landing with its witness, back → Home; and `/settings/dates` → reload → Notes lands, back → Home -- browser-level lock.

**Acceptance Criteria:**
- Given the app at `/mood` whose entry claims depth 50, when the person taps Notes then Photos in the dock, then Photos shows with the URL `/photos`, and browser back shows Home.
- Given the app reloaded on `/settings/dates`, when the person taps Notes, then Love Notes shows at `/notes`, and browser back shows Home.
- Given the existing unit and E2E navigation suites, when they run after the change, then they pass unchanged.

## Implementation Notes

- Files: `src/stores/slices/navigationSlice.ts`, new `tests/unit/stores/navigationSlice.dockWalk.test.ts` (6 tests), `tests/e2e/navigation/dock-walk.spec.ts` (2 tests, probe replaced).
- The timer warns with `console.warn`, the stores' existing convention (allowed by `no-console`); the implementer had added a `warn` to `src/utils/logger.ts`, reverted to keep the shared logger untouched.
- `stackOnFirstEntry` also rewrites an entry at `/` that still carries a `depth`, so a timer landing on `/` drops the stale depth.
- Playwright's test page keeps its initial `about:blank` entry under the app, so the clamp walks onto it; the depth-50 spec opens the app in a popup whose history starts at length 1, as an installed app's does. The same overshoot applies to a browser tab opened from another site with a corrupt depth: the clamp is an upper bound, not the app's first entry.
- Red check (implementer): with the old source, the depth-50 spec fails and the reload spec passes, as the planning probe found.

## Plan Change Log

## Review Triage Log

### 2026-11-04 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 5, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `historyDepth`'s clamp comment claims a clamped walk always ends on a `popstate`, but `history.length` also counts entries below the app and forward entries, so the walk can overshoot out of the app or still be out of range — comment rewritten to call the cap an upper bound that the timer backs up and that can leave the app; the clamp itself stays because the intent mandates it and it needs a corrupt `depth`, which no normal sequence produces.
  - `[low]` `[patch]` The timer landing through `stackOnFirstEntry` leaves real entries below the new Home, so Home is not the bottom there — reached only when no `popstate` came, where walking further is impossible; the function's comment now says the timer path treats the current entry as the bottom and entries below can stay.
  - `[low]` `[patch]` Unit test "does not land anything when the walk ended before the timer" never advanced the fake clock, so it passed even if the timer were never cleared — it now asserts no pending timer, advances `WALK_TIMEOUT_MS` with fake timers on and asserts no warning; red-checked: with `clearTimeout(timer)` removed it fails.
  - `[low]` `[patch]` Three unit tests end mid-walk and `vi.resetModules()` leaves the old module's `popstate`/`pageshow` listeners on the shared window, so under CI's shuffle the next test's first `popstate` runs a stale `setView` — `afterEach` now dispatches a persisted `pageshow` first, ending any walk.
  - `[low]` `[patch]` The timer's warn call ran to 115 columns, past the 100 the surrounding code wraps at — wrapped across lines.

## Design Notes

Reload case, measured during planning with Playwright 1.64.1 against this app and a bare static page: in Chromium and in WebKit 27.2, `history.go(-n)` after a reload back to entries pushed before it fires `popstate` in the same document; the app landed `/notes` after a reload on `/settings/profile` (depth 2) with no page load. So the "lost pick after a reload" does not reproduce; the spec pins it rather than a fix (the shell's WKWebView after a background kill is UNVERIFIED). Measured stuck case: at `/mood` with depth 50, both later taps stayed on `/mood`.

Timer landing is in place, not another walk: by then `historyDepth()` is still above 0, so `setView(target)` would walk again and loop every second. The last tap already set `currentView`.

```ts
const land = () => { const t = pendingView; stopWalk?.(); if (t) get().setView(t); }; // popstate
// timer: const t = pendingView; stopWalk?.(); if (t) { stackOnFirstEntry(t); logger.warn(...) }
```

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/navigationSlice.dockWalk.test.ts tests/unit/stores/navigationSlice.settingsStack.test.ts` -- expected: all pass
- `npx playwright test tests/e2e/navigation/dock-walk.spec.ts tests/e2e/navigation/dock.spec.ts tests/e2e/navigation/routing.spec.ts tests/e2e/navigation/settings-navigation-rules.spec.ts --project=chromium` -- expected: all pass (local Supabase running, port 5173 free)
- `npm run typecheck` and `npx eslint src/stores/slices/navigationSlice.ts tests/unit/stores/navigationSlice.dockWalk.test.ts tests/e2e/navigation/dock-walk.spec.ts` -- expected: clean
- `npm run test:unit` -- expected: all pass

## Auto Run Result

Status: built

**Summary:** The dock's walk back to Home (DW-441) now always ends. The stored `depth` is clamped to `history.length - 1`. A `pageshow` with `persisted` ends a walk frozen in the back/forward cache, and a 1000 ms timer ends a walk whose `popstate` never came, landing the last pick in place with a `console.warn`. A second tap mid-walk still only changes the target. The lost pick after a reload did not reproduce in Chromium or WebKit 27.2 (measured in planning), so it gets a regression spec, not a code change.

**Files changed:**
- `src/stores/slices/navigationSlice.ts`: clamp in `historyDepth()`, module `pathMap`, `stackOnFirstEntry` helper, and a `stopWalk` that removes the popstate and pageshow listeners and clears the timer, replacing `walkingDown`. Exports `WALK_TIMEOUT_MS`.
- `tests/unit/stores/navigationSlice.dockWalk.test.ts` (new): 6 tests, each on a fresh module (`vi.resetModules()`). They cover a second tap mid-walk, depth 50, no `popstate` (timer), a persisted and a non-persisted `pageshow`, and a walk that ends before the timer.
- `tests/e2e/navigation/dock-walk.spec.ts` (new): depth 50 then two dock taps, and a dock tap right after a reload on `/settings/dates`. Both end with back landing on Home.

**Review findings:** 5 findings from the Quick lens, all low, all patched (4 in code or tests, plus the two comments). None deferred and none rejected. The clamp's possible overshoot out of the app is kept as residual risk, because the intent mandates the clamp.

**Follow-up review recommended:** false. Patched entries: high 0, medium 0, low 5.

**Verification:**
- `npx vitest run` on the dock-walk and settings-stack tests: 38 passed.
- Navigation Playwright specs (`dock-walk`, `dock`, `routing`, `settings-navigation-rules`, chromium): 23 passed.
- `npm run typecheck`: exit 0.
- eslint on the changed files: clean.
- `npm run test:unit`: 224 files, 4124 tests passed.
- Red checks: with the old source the depth-50 spec fails (per the implementer), and without `clearTimeout(timer)` two unit tests fail.

**Residual risks:**
- In a browser tab with entries below the app, a corrupt `depth` clamped to `history.length - 1` can walk out of the app instead of sticking. Getting there needs a corrupt depth that no normal sequence produces.
- A timer landing leaves any real entries below the new Home.
- A `popstate` slower than 1000 ms would arrive after the timer landed.
- The shell's WKWebView after a background kill: UNVERIFIED.
