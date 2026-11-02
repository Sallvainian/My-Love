---
title: 'DW-409: settle the PartnerMoodView "enables refresh when online" assertion'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '80abd0fec379bc0ad15e7c514815c621ac9866f3'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx:166` ("enables refresh when online") awaits `findByTestId('partner-mood-refresh-button')`, which resolves on the button's presence, then asserts `toBeEnabled()`. The button renders `disabled`/`aria-busy` while the mount refresh is in flight (`PartnerMoodView.tsx:654-657`), so the test passes only when that refresh has committed by the time `findBy*` returns — it failed once under the full suite (DW-409).

**Approach:** Assert the settled state through `waitFor`: wait until the refresh button is enabled and no longer `aria-busy`, so the check holds however late the mount refresh's `setIsRefreshing(false)` commits. Keep the presence check (`getByTestId` throws when absent) and the enabled check the old assertion made; no component change.

</intent-contract>

## Implementation Notes

Oneshot: a one-test assertion change in one file, well under 100 lines.

What keeps the button busy at mount (confirmed by reading the code):

- `makeState()` gives a linked `partner`, so the mount effect at `PartnerMoodView.tsx:135-145` calls `loadPartnerMoods()`, which `setIsRefreshing(true)` synchronously and then awaits the mocked `fetchPartnerMoods` (`vi.fn(async () => {})`); `setIsRefreshing(false)` runs in its `finally` only after that promise settles.
- `render()` wraps a synchronous `act`, so the mount commit shows `isRefreshing = true` and the `await` continuation runs after `act` returns.
- `findByTestId` resolves on its first synchronous check (the button exists). RTL's `asyncWrapper` (`@testing-library/react/dist/index.js:84-104`) sets the act environment to false and then drains with a single `setTimeout(0)`. The `finally` block's `setIsRefreshing(false)` lands in that window as a non-act update, so React schedules its commit through the Scheduler's own macrotask, which races the `setTimeout(0)`. Under load the timer can fire first and the assertion sees `aria-busy="true" disabled`.

Implementation (2026-11-02):

- Touched only `src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` ("enables refresh when online"): `findByTestId(...)` + `toBeEnabled()` became `waitFor(() => { getByTestId(...); toBeEnabled(); toHaveAttribute('aria-busy', 'false') })`. `getByTestId` keeps the presence check, `toBeEnabled` the enabled check; `aria-busy="false"` adds the settled-refresh check the failure showed missing. The old assertion made no visibility check, so none was dropped. `waitFor` was already imported.
- Probe (throwaway file, deleted after): with `fetchPartnerMoods` resolving after `setTimeout(20)`, the old assertion failed with `aria-busy="true"` — the DW-409 shape — and the new one passed.
- Results: file green once and 20/20 repeated; `SEED=409 npm run test:unit:coverage` 224 files / 3866 tests passed, exit 0; eslint on the file clean; `npm run typecheck` exit 0.

## Verification

**Commands:**
- `npx vitest run src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` -- expected: all tests pass
- `for i in $(seq 1 20); do npx vitest run src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx --reporter=dot || break; done` -- expected: 20 green runs
- `SEED=409 npm run test:unit:coverage` -- expected: shuffled full suite passes (coverage thresholds included)
- `npx eslint src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` -- expected: no errors
- `npm run typecheck` -- expected: exit 0

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none (quick lens confirmed presence + enabled checks kept, `aria-busy="false"` tracks `isRefreshing` at `PartnerMoodView.tsx:657`, scope one test)

## Auto Run Result

Status: built

- **Summary:** "enables refresh when online" now waits for the settled state — `waitFor` until the refresh button is present, enabled and `aria-busy="false"` — instead of asserting `toBeEnabled()` on whatever `findByTestId` returned at first presence, which could be the button still busy from the mount refresh (DW-409).
- **Files changed:**
  - `src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` — the one assertion rewritten through `waitFor`, with a comment on why.
  - `_bmad-output/initiative-my-love/plan-dw-partner-mood-refresh-test-flake.md` — this plan.
- **Cause confirmed:** the linked `partner` in `makeState()` runs `loadPartnerMoods()` on mount, which raises `isRefreshing` before awaiting the mocked fetch; its `setIsRefreshing(false)` commits through React's scheduler, racing the single `setTimeout(0)` RTL's `asyncWrapper` drains after `findBy*` resolves. A throwaway probe with a 20 ms fetch reproduced the old assertion failing on `aria-busy="true"` and the new one passing.
- **Review findings:** patches 0, deferred 0, rejected 0.
- **Follow-up review recommended:** false (no patched entries).
- **Verification:** file green, then 20/20 repeated runs; `SEED=409 npm run test:unit:coverage` 224 files / 3866 tests passed, exit 0; eslint on the file clean; `npm run typecheck` exit 0.
- **Residual risks:** none known; the change is test-only.
