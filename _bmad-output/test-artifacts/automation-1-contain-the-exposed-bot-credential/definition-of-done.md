# Story 1 (F1) — Test Automation Definition of Done

**Automation workflow: done.** Eight new tests, all green on first run and under mutation: 6 Playwright (4 `api`, 2 `integration`, all P1) and 2 Vitest (P2) added to the story's own script test. One helper, no new fixtures, no production code changed. Verified at commit `7b186265` on branch `bmad-loop/20260912-154607-c8bd/1`.

Summary with the reasoning and every measurement: [`../automation-summary-1-contain-the-exposed-bot-credential.md`](../automation-summary-1-contain-the-exposed-bot-credential.md). Raw run and mutation logs: [`evidence/`](evidence/).

## What was built

| ID | Priority | Level | File | Proves |
|---|---|---|---|---|
| F1-INT-001 | P1 | integration | `tests/integration/claude-bot-config-forward-migration.spec.ts` | `20260912000000_remove_claude_bot_password_row.sql`, replayed byte for byte against a pre-seeded `test_password` row inside a rolled-back transaction, deletes exactly that row (`INSERT 0 1 / 1 / DELETE 1 / 0`) and leaves `partner_email,test_email`; the live table is unchanged afterwards |
| F1-INT-002 | P1 | integration | same | applied twice in one transaction: `DELETE 1` then `DELETE 0`, no error under `ON_ERROR_STOP` — the header's "a second run deletes nothing" is measured |
| F1-API-001 | P1 | api | `tests/api/claude-bot-config-exposure.spec.ts` | anon key `GET /rest/v1/claude_bot_config?select=key` → `200 []` |
| F1-API-002 | P1 | api | same | authenticated worker `GET` → `200 []` |
| F1-API-003 | P1 | api | same | authenticated `POST` → `403`, code `42501`, RLS message; service-role read afterwards shows exactly the two identifier keys and no probe row |
| F1-API-004 | P1 | api | same | service role reads exactly `partner_email`, `test_email` and no `test_password` (positive control for the three empty results) |
| unit | P2 | vitest | `tests/unit/scripts/provision-claude-bot.test.ts` | `CLAUDE_BOT_EMAIL` override found case-insensitively on both sides of the comparison and signed in verbatim |
| unit | P2 | vitest | same | sign-in `200` without `access_token` → exit 1, half-done warning, no `/logout` call |

Helper: `tests/support/helpers/migration-replay.ts` — `replayMigrationInRollback()` and `assertLocalDatabaseReachable()`; the pattern DW-85 said the repo lacked.

## Verification (all run in this worktree, 2026-09-12)

| Result | Command |
|---|---|
| **6 passed** (6.2 s) | `npx playwright test tests/integration/claude-bot-config-forward-migration.spec.ts tests/api/claude-bot-config-exposure.spec.ts --project=integration --project=api` |
| **30 passed** (12.4 s), longest test 483 ms | same with `--repeat-each=5 --retries=0` |
| **11 passed** in the script's test file | `npx vitest run tests/unit/scripts/provision-claude-bot.test.ts` |
| **106 files / 1923 tests passed** | `npx vitest run` |
| **0 errors**, 3 pre-existing warnings in `EventCountdown.tsx` | `npm run lint` |
| **empty output, exit 0** | `npx tsc -b --force` |

## Falsifiability (each mutation applied, run, reverted; `git status` shows no stray change)

| Mutation | Went red |
|---|---|
| A. DELETE statement replaced by a comment in the migration | F1-INT-001, F1-INT-002 |
| B. `SUPABASE_DB_CONTAINER` renamed to a container that does not exist | both INT tests, with `PsqlError: Cannot reach …` — the could-not-measure state, not a pass |
| C. `CREATE POLICY … FOR SELECT TO anon, authenticated USING (true)` on the live table | F1-API-001, F1-API-002 (API-003/004 unaffected, as designed); policy dropped, count back to 0 |
| D1 (first attempt). `.toLowerCase()` removed from the override side | **nothing** — the test was weak; strengthened with mixed case on both sides |
| D1a. override-side `.toLowerCase()` removed (after strengthening) | the override test |
| D1b. listing-side `.toLowerCase()` removed | the override test |
| D2. `access_token` guard removed from `signIn()` | the no-access_token test |

## Core Quality Checklist (`test-quality.md`)

- [x] **No Hard Waits** — none; no `waitForTimeout`, no timers
- [x] **No Conditionals** — no `if`/`try` steering a test path; the only `throw`s are precondition guards for missing env
- [x] **≤ 1000 Lines** — 97, 128, 128 (helper), 316
- [x] **< 1.5 Minutes** — longest test 746 ms (first run), 483 ms across the burn-in
- [x] **Self-Cleaning** — the replay is inside `BEGIN … ROLLBACK`, so nothing is ever committed; the refused POST commits nothing, verified by a service-role read; the seeded row's key is the one production holds, so the rollback is what keeps pgTAP 22 and other workers blind to it
- [x] **Explicit Assertions** — every `expect` is in a test body; the helper asserts nothing
- [~] **Unique Data** — the probe key uses `randomUUID()`; the table keys, the placeholder value and the override email are deliberate domain literals named at the point of use, per `data-factories.md`; faker would make the pinned key set unassertable
- [x] **Parallel-Safe** — ran under 5 workers, 30/30; the rolled-back transaction and read-only API probes share no state
- [x] **No Committed Focus** — no `.only`, `fit`, `fdescribe`
- [x] **Skips Documented** — no skips
- [x] **Assertions Can Fail** — shown by seven mutations above, including one that exposed a weak test
- [x] **One Concern** — read, write and positive control are separate tests; INT-001's post-rollback read is the outcome check of the same subject
- [x] **Grouped and Shallow** — one `describe` per file
- [x] **Behavioral Names, One Dialect** — `[P1] F1-XXX-NNN <behaviour>` matching `tests/api/*.spec.ts`; `expect` only

## Not done here, and why

- **Hosted-surface acceptance criteria** (old password → 400; sessions 0) stay operational evidence in the story file. The pre-rotation value must never be stored where a test can read it, and CI has no hosted credentials by design.
- **DW-85's settling check** is still the post-deploy hosted count. These tests prove the migration against the state production is in; they do not touch the hosted project.
- **No E2E**: nothing in `src/` reads `claude_bot_config` or the bot login.
