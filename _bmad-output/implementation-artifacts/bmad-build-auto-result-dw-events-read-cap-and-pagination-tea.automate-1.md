---
status: done
---

# TEA Test Automation — dw-events-read-cap-and-pagination

Workflow: `bmad-testarch-automate`, Create mode, all five steps completed.
Summary artifact: `_bmad-output/test-artifacts/automation-summary-dw-events-read-cap-and-pagination.md`

## Generated

- `tests/api/events-read-window.spec.ts` — 7 cases (P0 ×2, P1 ×4, P2 ×1) driving the
  bounded two-window read against local PostgREST under a real user JWT.
- `tests/e2e/home/events-read-window.spec.ts` — 2 cases (P0 ×1, P1 ×1): the shipped
  `limit = 50` default protecting Home, and the capped tail refilling at local midnight.
- `tests/support/factories/events.ts` — pure seeding/factory module (new).
- `tests/support/fixtures/index.ts` — two fixtures added, `coupleEvents` (seed with
  clear-before and clear-after) and `supabaseAsUser` (RLS-scoped client).
  `merged-fixtures.ts` was not modified.

## Verified in this session

- New specs: 9 passed. Burn-in `--repeat-each=3`: 27 passed, zero flakes.
- `npm run test:unit`: 92 files, 1397 tests, all passing.
- `npm run test:p0`: 74 collected, 72 passed, 0 failed, 2 pre-existing skips.
- `npm run typecheck`: 6 `TS2883` worktree-baseline errors, zero non-`TS2883` — no delta.
- `npm run lint`: 0 errors, 3 pre-existing warnings.
- Mutation-tested: four mutants applied and reverted. Recorded in §6 of the summary,
  including one (deleting `onRetire={handleEventRetired}`) that the refill E2E does NOT
  catch — the file header and the summary state that limit rather than overclaiming.

  **Correction, 2026-08-19 (later review pass):** that last clause no longer holds.
  The refill E2E was reworked to cross midnight from five minutes BEHIND it, which
  removes the token refresh that had been re-rendering App on its own, and the
  `onRetire` mutant now fails the test. See the correction block in §6 of the summary
  and the file header of `tests/e2e/home/events-read-window.spec.ts`.

## Not done, deliberately

`tests/README.md` and `package.json` were not updated; three deferred items from the
story's own frontmatter were left untested. Reasons with measurements in §9 and §10 of
the summary. No production source file was changed.
