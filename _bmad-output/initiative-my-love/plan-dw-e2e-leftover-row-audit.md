---
title: 'DW-314: audit that a full e2e run leaves no pool-account rows behind'
type: 'feature'
ticket: ''
created: '2026-10-29'
status: 'built'
baseline_revision: 'eb2118133cac461c24f9c5392558c06956cc4ece'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** R3's success clause — "a full e2e run leaves behind no rows it created" — has only been checked for three love_notes prefixes (DW-314). Nothing counts what the worker-pool accounts own across the seeded tables, so a spec whose cleanup misses a row leaks silently.

**Approach:** Playwright `globalSetup` records, after provisioning, the number of rows each worker-pool account owns in each seeded table; a new `globalTeardown` recounts, prints every per-table/per-slot difference, and throws (failing the run) when any count grew. Then run one full local e2e run and fix each leak it finds through the leaking spec's `cleanup.defer`.

## Boundaries & Constraints

**Always:**
- Tables audited: `love_notes`, `moods`, `events`, `anniversaries`, `photos`, `interactions`, `custom_messages`, `message_favorites`, `partner_requests`, `love_note_removals`, `couple_settings`.
- An account owns a row when any of the table's owner columns equals its `public.users.id`: `from_user_id`/`to_user_id` (love_notes, interactions, partner_requests), `user_a`/`user_b` (couple_settings), `user_id` (the rest). A row between partners counts under both accounts.
- Accounts: slots `0..getAuthPoolSize()-1`, each with worker (`getWorkerEmail`) and partner (`getWorkerPartnerEmail`) roles. Read-only, service-role client, `count: 'exact', head: true` queries.
- Baseline is taken at the end of `globalSetup`, after provisioning and linking, and handed to teardown via an environment variable (both run in the runner process).
- Report lines name table, slot, role and before→after. Shrinks are reported but do not fail.
- Leak fixes go through `cleanup.defer` in the leaking spec (or its seeding helper), matching surrounding style. Leaks that cannot be fixed in scope go into this plan's frontmatter `deferred` list — never into `deferred-work.md` (the orchestrator owns that ledger here).

**Never:**
- Write, delete or reset any row from setup or teardown — the audit only counts; other workers' rows are never touched.
- Touch `tests/e2e-archive/`, `src/types/database.types.ts`, the deferred-work ledger, or the env/shell idioms at the top of `playwright.config.ts`.
- Make the audit opt-in or silence a failure with an env flag.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean run | after == before for every key | logs one "no leftover rows" line | none |
| Leak | `moods` slot 3 worker 5→6 | logs `moods slot 3 worker: 5 → 6 (+1)`; teardown throws listing every grown key | run fails |
| Shrink only | `events` slot 1 partner 2→0 | logs the line with `(-2)` | does not throw |
| No baseline | env var absent/unparseable (setup failed early) | logs that the audit was skipped | does not throw |
| Count query fails | PostgREST error | throws naming table and email | run fails |

</intent-contract>

## Code Map

- `tests/support/auth/global-setup.ts` -- builds the service-role `admin` client and provisions/links pool pairs; `getAppUserIdByEmail(admin, email)` resolves `public.users.id` (reuse; export it or move it into the audit module's reach). Snapshot after `linkUserPair` loop, before the final log.
- `tests/support/auth/worker-pool.ts` -- `getAuthPoolSize`, `getWorkerEmail`, `getWorkerPartnerEmail`. Read-only.
- `playwright.config.ts:97` -- `globalSetup`; add `globalTeardown` next to it. Do not touch anything above `defineConfig`.
- `tests/support/factories` -- exports `TypedSupabaseClient` type.
- `tests/support/fixtures/cleanup.ts` -- `cleanup.defer(label, fn)` contract for leak fixes.
- `tests/e2e/**`, `tests/api/**`, `tests/integration/**` -- where leaks are fixed, only if the audit finds them.

## Tasks & Acceptance

**Execution:**
- [x] `tests/support/helpers/row-audit.ts` -- new: `AUDITED_TABLES` (table → owner columns), `countPoolRows(admin, poolSize)` returning counts keyed `table|slot|role`, pure `diffRowCounts(before, after)` returning changed entries with a `grew` flag, `formatRowDiff`, and the env-var name/serialisation -- one home for the audit logic.
- [x] `tests/support/auth/global-setup.ts` -- after linking, call `countPoolRows` and store the JSON baseline in the env var -- baseline after provisioning.
- [x] `tests/support/global-teardown.ts` -- new default export: read baseline (skip with a log if absent), build admin client from `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, recount, log diff, throw when any key grew.
- [x] `playwright.config.ts` -- add `globalTeardown: './tests/support/global-teardown.ts'`.
- [x] `tests/unit/helpers/row-audit.test.ts` -- unit-test `diffRowCounts`/`formatRowDiff` over the matrix rows (clean, grow, shrink, mixed, key present on one side only).
- [x] Run one full local run (`npx playwright test`, all projects), fix each leak the audit reports via `cleanup.defer`, rerun the affected specs to confirm the count is stable; record any out-of-scope leak in frontmatter `deferred`.

**Acceptance Criteria:**
- Given local Supabase is up, when `npx playwright test` finishes, then the output contains the row-audit report and the run exits non-zero if and only if some pool account owns more rows in an audited table than at setup.
- Given a spec that inserts a pool-account row with no cleanup, when it runs alone, then teardown names that table, slot and role with a positive delta and the run fails.
- Given the full local run after the leak fixes, when teardown runs, then no audited count grew.

## Implementation Notes

- `getAppUserIdByEmail` moved from `global-setup.ts` into `tests/support/helpers/row-audit.ts` (exported; global setup imports it), so the audit module does not import global setup and its auth-session dependency.
- Baseline env var: `E2E_ROW_AUDIT_BASELINE` (JSON map `table|slot|role` → count). `parseRowCounts` rejects anything that is not a map of non-negative integers, and teardown then logs the skip.
- First full local run (all projects; `tests/e2e/auth/token-persistence-overlap.spec.ts` left out because it reads `node_modules/*/package.json` relative to the repo root and cannot load in a loop worktree, which has no `node_modules`; it writes no rows): no count grew, but `couple_settings` shrank on three slots — the pool pair's row is deleted by `couple-start-date.spec.ts` and `couple-settings-offline.spec.ts` and recreated by `birthdays-wedding.spec.ts` (`resetPair`) and `birthdays-wedding-offline.spec.ts` (`setValues`), whose teardowns only null columns. Running the two birthday specs alone grew `couple_settings` on slots 1 and 2 (+1 per role) and the audit failed the run — an order-dependent leak.
- Fix: `deferCoupleRowRemovalIfNew` in `tests/support/helpers/teardown.ts`, called before the first write in all five pool-pair tests of those two specs; it defers deleting the pair's row only when the row did not exist, and is deferred before the reset so it runs after it. Rerun with `--workers=10 --repeat-each=5` put a test on every slot; slots 4 and 8, which had no row, still had none, and the audit reported no leftover rows.
- Edge Functions are stopped locally, so `tests/api/upload-love-note-image-limits.spec.ts` fails with 503; it writes only Storage objects, not audited rows.
- Verify pass (parent session): the matrix rows "No baseline" and "Count query fails" had no test running teardown or `countPoolRows` itself, so `tests/unit/helpers/row-audit.test.ts` gained a fake service-role client and tests for `countPoolRows` (all keys counted; error names table and email) and `globalTeardown` (skip, clean, grow throws, shrink passes) — 19 tests pass. Independent full run (same 78 files): 326 passed, 6 failed (all 503 from the stopped Edge Function); the audit reported only `couple_settings slot 3` worker/partner 1 → 0, and no count grew.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `tests/e2e/settings/birthdays-wedding.spec.ts` header still said teardown resets "only" the dates, contradicting the new `couple_settings` deletion — fixed: the clause now reads "resets this pair's own `birthday` columns and `wedding_date`, and deletes the pair's `couple_settings` row when the test created it", matching the offline spec's header.
  - `[low]` `[reject]` `deferCoupleRowRemovalIfNew` treats a `null` count with no error as "row exists" and registers no delete — a `count: 'exact', head: true` request with no error always carries PostgREST's Content-Range count, so the state is not reached in practice; the fix would add a guard branch, and the global teardown audit would still catch the resulting leak.

## Design Notes

Env var, not a module variable or file: Playwright documents env vars set in `globalSetup` as the way to pass data on, and `test-results/` is cleared by the run. A head count per (table, account) needs no pagination; at a pool of 10 that is 220 queries per snapshot — run each table's queries concurrently. Edge Functions may be stopped locally (Kong 503); `api` specs failing for that reason are not leaks unless the audit counts grew.

## Verification

**Commands:**
- `npx vitest run tests/unit/helpers/row-audit.test.ts` -- expected: pass
- `npm run typecheck` -- expected: no new errors versus baseline (loop worktrees carry a known TS2883 baseline)
- `npm run lint` -- expected: pass
- `npx playwright test` -- expected: row-audit report printed; no grown count after fixes

## Auto Run Result

Status: built

**Summary:** Playwright `globalSetup` now records, after provisioning, how many rows each worker-pool account (slot × worker/partner) owns in the 11 seeded tables; a new `globalTeardown` recounts, logs every per-table/per-slot difference, and fails the run when any count grew. The first full local run plus a targeted rerun found one order-dependent leak: the two birthday/wedding specs upsert the pool pair's `couple_settings` row and only cleared columns at teardown. They now defer deleting that row when the test created it.

**Files changed:**
- `tests/support/helpers/row-audit.ts` — new: audited tables and owner columns, `countPoolRows`, `diffRowCounts`, `formatRowDiff`, baseline (de)serialisation; now home of `getAppUserIdByEmail`.
- `tests/support/global-teardown.ts` — new: recount, report, throw on growth; skips with a log when there is no baseline.
- `tests/support/auth/global-setup.ts` — stores the baseline in `E2E_ROW_AUDIT_BASELINE`; imports the moved `getAppUserIdByEmail`.
- `playwright.config.ts` — `globalTeardown` wired in.
- `tests/support/helpers/teardown.ts` — new `deferCoupleRowRemovalIfNew`.
- `tests/e2e/settings/birthdays-wedding.spec.ts`, `tests/e2e/offline/birthdays-wedding-offline.spec.ts` — call it before the first write in all five pool-pair tests; headers updated.
- `tests/unit/helpers/row-audit.test.ts` — new: 19 tests covering every I/O matrix row, including teardown and count-failure paths.

**Review:** quick lens, 2 findings — 1 low patched (stale spec header), 0 deferred, 1 low rejected (`null` count with no error is not reached in practice, and the fix would add a guard; reason in the triage log).

**Follow-up review recommended:** false — patched by verdict: high 0, medium 0, low 1.

**Verification:**
- `npx vitest run tests/unit/helpers/row-audit.test.ts` — 19 passed.
- `npm run lint` — clean. `npm run typecheck` — no errors.
- Full local Playwright run over 78 spec files (all projects; `tests/e2e/auth/token-persistence-overlap.spec.ts` excluded because it cannot load in a loop worktree without `node_modules`, and it writes no rows): 326 passed, 6 failed, all 503s from the locally stopped Edge Function (`tests/api/upload-love-note-image-limits.spec.ts`). The audit reported only `couple_settings slot 3` worker/partner 1 → 0, and no count grew.
- Leak reproduction before the fix: the two birthday specs run alone grew `couple_settings` on slots 1 and 2, and the audit failed the run (acceptance criterion 2).

**Residual risks:**
- The audit compares net counts, so a leak that another spec happens to offset in the same run (e.g. `couple-start-date.spec.ts` deleting the pair's row unconditionally) passes on that ordering.
- CI now runs the audit on every Playwright leg; any future spec that leaks a pool-account row fails the run in teardown rather than silently.

