---
status: done
---

# TEA Test Automation — `dw-persisted-events-key-strip`

Workflow `bmad-testarch-automate` ran end to end in Create mode, sequential execution.

**Artifact:** `_bmad-output/test-artifacts/automation-summary-dw-persisted-events-key-strip.md`
(567 lines; the step template's `automation-summary.md` filename was already taken by an earlier
story, so this follows the per-story convention the directory already uses).

## Delivered

| File | Lines | Contents |
|---|---|---|
| `tests/e2e/home/persisted-events-strip.spec.ts` | 218 | 4 E2E scenarios — 1 P0, 3 P1 |
| `tests/unit/stores/persistedBlobContract.test.ts` | 238 | 5 cases closing 3 unpinned Acceptance Criteria / Boundaries |
| `tests/support/helpers/persisted-blob.ts` | 278 | Seeding helper + data factories for the persisted blob |

No existing file was modified; `src/` is untouched (`git diff --stat src/` empty).

## Verification

- E2E: **4 passed**; burn-in `--repeat-each=3`: **12 passed**, 0 flaky.
- Unit: **93 files / 1413 tests passed** (baseline 92 / 1408 — exactly this run's +1 file / +5 tests).
- `npm run lint`: **0 errors, 3 warnings** — byte-identical to the recorded baseline.
- `npm run typecheck`: **6 errors, all `TS2883` in `merged-fixtures.ts`** — identical to this
  worktree's baseline; **0 non-baseline errors**.

Every new test was proved falsifiable by mutating `src/stores/useAppStore.ts`, running, and
reverting (4 mutations, each red in exactly the expected tests; source restored and re-run green).
Reverting the story's own change to `STALE_PERSISTED_KEYS = ['moods']` turned all four E2E tests
red with `date.getFullYear is not a function` in the ErrorBoundary — reproducing as a real browser
crash the `TypeError` the spec had predicted only by argument.

## Scope decisions

- **API tests: 0, deliberately.** The change is entirely inside a `localStorage` adapter and
  touches no request, RPC, migration or policy. The one adjacent non-invented target (an
  `events_select` outsider negative) was declined on evidence: it exercises an unmodified policy
  and has no parallel-safe identity in the worker pool, which provisions pairs only.
- **Unit tests included beyond the literal "API/E2E" ask**, because three spec Acceptance
  Criteria / Boundaries were asserted by nothing and are not observable from a browser. Clearly
  labelled in the summary so they can be dropped.

## Findings surfaced, not acted on

1. The story's test docblock at `persistedEvents.test.ts:105-108` describes the unit environment
   accurately but not the running app — probed both ways; both halves are now pinned by tests.
2. A partial `messageHistory` in the persisted blob crashes the app via
   `DailyMessage.tsx:59` (`favoriteIds` undefined). Unreachable from a blob the app itself wrote;
   same robustness class as the entries this story closed.
3. AC #5's "`version: 0` is pinned by the E2E auth fixtures" was not true — nothing pinned it.
   `DW14-UNIT-003` now does.

Recommended next workflow: `trace` (the existing traceability matrix predates DW-14/DW-20).
