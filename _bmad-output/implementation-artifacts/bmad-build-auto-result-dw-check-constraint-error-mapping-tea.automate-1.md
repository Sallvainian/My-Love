---
status: done
---

# TEA Test Automation — dw-check-constraint-error-mapping

Workflow `bmad-testarch-automate` ran to completion in Create mode, all five steps.

**Summary artifact:** `_bmad-output/test-artifacts/automation-summary-dw-check-constraint-error-mapping.md`

## Files created (4, no existing file modified)

| File | Lines | Tests |
|------|-------|-------|
| `tests/support/check-constraint-envelopes.ts` | 178 | — (shared measured-envelope factory) |
| `tests/unit/api/checkConstraintMapping.test.ts` | 319 | 22 (Vitest, service boundary) |
| `tests/api/check-constraint-error-mapping.spec.ts` | 231 | 5 (Playwright `api`, live stack) |
| `tests/e2e/settings/events-check-constraint.spec.ts` | 183 | 1 (Playwright `chromium`) |

28 tests total. Playwright priority tags: P0 = 1, P1 = 5.

## Validation (all measured in this worktree)

- `npx vitest run tests/unit/api/checkConstraintMapping.test.ts` — 22 passed
- `npm run test:unit` — 92 files / 1380 tests passed (baseline 91 / 1358; delta is exactly this run's addition)
- `npx playwright test --project=api --project=chromium <both new specs>` — 6 passed
- `npx playwright test --project=api --project=chromium tests/api tests/e2e/settings` — 26 passed across 7 files (regression incl. `events-crud.spec.ts`)
- `npm run typecheck` — 6 errors, **all pre-existing**; verified by removing the new files and re-running (6 before, 6 after), all `TS2883` at `tests/support/merged-fixtures.ts(53,14)`. Delta: zero.
- `npm run lint` — 0 errors (2 pre-existing warnings in an untouched file)
- **Falsifiability proven by mutation**: deleting the `'23514'` line turns each suite red (9 failed in Vitest, 3 of 5 in the API spec, 1 of 1 in E2E). Source restored and confirmed byte-identical to `ba2bdd9`.

## Notable finding

The `23514` envelope differs by role, and it was measured rather than assumed: an authenticated caller — which is what the app always is — receives HTTP **400** with `details: null`, while a `service_role` caller receives the full `Failing row contains (…)`. `isPostgrestError` keys on the *presence* of `details`, so present-and-null still passes the guard; an envelope omitting the key would route every adopter into a network tail with the whole unit suite still green. That is what the P0 API test pins.

Also measured: seven of the schema's fourteen `public` CHECK constraints sit on tables whose writers never call `handleSupabaseError`, so the mapping cannot reach them — the story spec's own open deferred item, quantified.

## Not done, deliberately (with reasons in the summary, §8)

- `tests/README.md` not updated — its directory tree is already stale in several measured ways; repairing it is a documentation-only change that `AGENTS.md` says gets its own commit.
- No `test:api` npm script added — a project-configuration change beyond "generate tests and fixtures".
- No Pact/contract artifacts — no consumer-provider boundary; `pactjs-utils-mandate.md`'s relevance gate.

Nothing was committed or pushed. `sprint-status.yaml` was not read or written.
