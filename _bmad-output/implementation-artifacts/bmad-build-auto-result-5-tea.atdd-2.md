---
status: done
---

# TEA ATDD — story 5 (`5-manage-events-in-settings`)

Create-mode run completed; all five workflow steps recorded, `workflowStatus: completed`.

## Artifacts (all under TEA's configured `test_artifacts`)

- `_bmad-output/test-artifacts/atdd-checklist-5-manage-events-in-settings.md` — the checklist (635 lines)
- `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/` — 6 red-phase scaffolds, 1,631 lines, 15 tests, all skipped

| Scaffold | Target path on activation | Tests |
|---|---|---|
| `e2e-events-accessibility.spec.ts` | `tests/e2e/settings/events-accessibility.spec.ts` | 3 [P1] |
| `e2e-events-write-failures.spec.ts` | `tests/e2e/settings/events-write-failures.spec.ts` | 2 [P2], 1 [P3] |
| `e2e-events-load-recovery.spec.ts` | `tests/e2e/settings/events-load-recovery.spec.ts` | 1 [P2] |
| `api-events-write-wire-shape.spec.ts` | `tests/api/events-write-wire-shape.spec.ts` | 3 [P1] |
| `comp-EventsSettings.errorIsolation.test.tsx` | `src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx` | 2 [P2] |
| `unit-events-validation-mirrors.test.ts` | `tests/unit/components/eventsValidationMirrors.test.ts` | 3 [P1] |

Covers the 8 scenarios `test-design-epic-5.md:337-373` planned and did not write. Two of those
(DE.5-UNIT-002, DE.5-COMP-001) are a CI leg and a repair, not scenarios, so they are checklist items
rather than files.

## Outcome

Every scaffold was activated, run, and removed again — so the checklist carries measurements, not
predictions. **15 tests: 10 pass, 5 fail, across 3 defects.**

- **NEW DEFECT — WCAG AA colour contrast, `serious`.** `events-settings-add` and
  `events-form-submit` are white on `bg-pink-500` at 3.58:1 against a 4.5:1 requirement. Both are
  inside story 5's own component, which refutes the test design's contingency at `:526-531` that any
  a11y failure would be pre-existing and outside the diff. Not fixed — outside this run's scope, and
  `bg-pink-500` is a house button style whose blast radius needs checking first.
- **DW-26 confirmed red** — the false "we couldn't load your events" notice, reproduced.
- **DW-27 confirmed red at two levels** — reconnect never re-fires the failed Settings load.
- The 10 passes are not filler: 3 prove PostgREST answers an RLS-filtered write with `200` + `[]`
  (so the service's `data.length === 0` branch is reachable, previously an assumption); 3 witness
  the real service messages reaching real dialogs for the first time; 3 are a drift guard separately
  proven to discriminate against mutated sources.

Two defects in generated code were caught and fixed before delivery: `log.step` on the destructured
fixture (wrong shape in this package version) and `test.use({ video })` inside a `describe`, which
made Playwright collect 0 tests.

## Production code

Untouched. `git status --porcelain` lists only the two new `_bmad-output/` paths plus the
`deferred-work.md` edit that was already present when this session started. Typecheck shows only the
six pre-existing `TS2883` errors; `npx vitest run src/components/Settings/__tests__` is 45/45; the
local stack has zero leftover `events` rows.
