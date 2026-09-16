---
title: 'Leftover scripture test-infrastructure surgery'
type: 'chore'
created: '2026-09-15'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      tests/support/helpers/rls-security.ts header still describes scripture RLS tests
    evidence: |-
      Pre-existing docstring. This story kept the file for live importers and did not reword it. Already stale after 820be2d2 removed the dedicated scripture RLS spec.
    location: >-
      tests/support/helpers/rls-security.ts:4
    severity: low
baseline_revision: '5b9a18b74f3e89281417cecef32cca974f396b69'
---

<intent-contract>

## Intent

**Problem:** Dedicated scripture E2E/API suites are already gone (`820be2d2`), but leftover fixtures, helpers, and shared test files still import them. `merged-fixtures.ts` still composes two deleted-soon fixtures that 59 live non-scripture specs import; `tray.spec.ts` still loops `'scripture'` against a missing testid and passes vacuously.

**Approach:** Delete the leftover scripture test helpers/fixtures, repair the shared files that import them in the same commit, rewrite `tests/integration/example-rpc.spec.ts` against `events`, and reword live non-api comments that still cite the deleted files.

## Boundaries & Constraints

**Always:**
- Edit `tests/support/merged-fixtures.ts` lines 21, 23, 66, 68, 82, 84 in the **same commit** that deletes `tests/support/fixtures/scripture-navigation.ts` and `tests/support/fixtures/together-mode.ts`.
- Keep `tests/support/helpers/index.ts` (directory barrel). Keep `tests/support/helpers/rls-security.ts`. Keep `TypedSupabaseClient` in `tests/support/factories/index.ts`. Keep `supabaseAdmin` in `tests/support/fixtures/index.ts`.
- Rewrite `tests/integration/example-rpc.spec.ts` against `events` (seed via admin client, assert rows, clean up). Do not leave `tests/integration/` empty — `claude-bot-config-forward-migration.spec.ts` stays.
- Reword comments in live non-api specs that cite `together-mode.ts` / `scripture-cache.ts`; do not delete those specs.

**Never:**
- Do not touch `src/`, `supabase/`, `tests/api/`, or anything under `tests/e2e-archive/`.
- Do not delete `tests/e2e/scripture/` (directory already absent).
- Do not delete `tests/support/helpers/rls-security.ts` or `tests/support/helpers/index.ts`.
- Do not delete `tests/integration/example-rpc.spec.ts`.
- Do not link/unlink partners or null shared account rows.
- Do not edit `tests/e2e/settings/events-accessibility.spec.ts` (story 2), unit IndexedDB/store files (stories 2/4), or `playwright.config.ts` (story 5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seed | Integration spec seeds one `events` row through `supabaseAdmin` for this worker's user | Row exists with that label and `user_id` | Insert error fails the test |
| Cleanup | Same spec deletes the seeded row(s) through the admin client | Select by id returns no row | Cleanup runs in `finally` so a failed assertion still cleans up |

</intent-contract>

## Code Map

Re-verified at `5b9a18b7` (branch has not moved the cited lines). Inventory line numbers still match.

**Choke point — same commit as the two fixture deletes:**
- `tests/support/merged-fixtures.ts:21,23,66,68,82,84` — `scriptureNavFixture` / `togetherModeFixture` import, `mergeTests` type tuple, and call. 59 files import this barrel (`rg -l "from ['\"].*merged-fixtures" tests --glob '*.ts' | wc -l` → 59); remaining importers are non-scripture.

**Pure deletes (still on disk):**
- `tests/support/fixtures/scripture-navigation.ts`
- `tests/support/fixtures/together-mode.ts` — 100% scripture. Live E2E cites it only in comments.
- `tests/support/helpers/scripture-cache.ts`, `scripture-lobby.ts`, `scripture-overview.ts`, `scripture-together.ts`
- `tests/support/helpers.ts` — **679 lines, 13 scripture exports** (`ScriptureSessionSnapshot` … `skipMessageAndCompleteSession`). **Not** `tests/support/helpers/index.ts`.
- `tests/support/helpers/reflection.ts` — zero importers (`rg -l helpers/reflection tests` empty).

**Keep (name collisions / live importers):**
- `tests/support/helpers/index.ts` — domain-neutral barrel (`generateTestEmail`, `getTestId`, `expectToast`, re-exports `./navigation`). Must stay.
- `tests/support/helpers/rls-security.ts` — live importers in `tests/api/` (events-wire-contract, couple-broadcast-authorization, interaction-authorization, profile-name-email-ownership), `tests/e2e/auth/implicit-fragment-rejection.spec.ts`, `tests/unit/helpers/rls-security.test.ts`. 2026-08-19 orphan-delete is superseded.
- `tests/support/factories/index.ts:16` `export type TypedSupabaseClient` — imported by live api/e2e/helpers (`events.ts`, `rls-security.ts`, `supabase.ts`, several api specs).
- `tests/support/fixtures/index.ts:47,73` `supabaseAdmin` — keep type member and fixture. `supabaseAsUser` and `coupleEvents` stay.

**Surgery:**
- `tests/support/factories/index.ts` — delete `SeedResult`, `SeedPreset`, `CreateTestSessionOptions`, `createTestSession`, `cleanupTestSession`, `resolveAppUserIdByEmail`, and `linkTestPartners`/`unlinkTestPartners` (after this story's deletes they have zero remaining live importers; only this file and the files being deleted/rewritten call them). File remains the `TypedSupabaseClient` export that `tests/support/factories/events.ts:37` imports.
- `tests/support/fixtures/index.ts:12-13,49,69,89-102` — drop `createTestSession`/`cleanupTestSession`/`linkTestPartners`/`SeedResult` imports, `testSession` type member, doc comment, and fixture. Do not touch `supabaseAdmin` (73), `supabaseAsUser`, or `coupleEvents`.
- `tests/support/helpers/navigation.ts:13,20` — drop `\| 'scripture'` from `NavDestination`; comment at 13 says "seven tray destinations".
- `tests/e2e/navigation/tray.spec.ts:82` — `'scripture'` in `['home', 'mood', 'notes', 'partner', 'scripture', 'settings']` with `.not.toHaveAttribute('aria-current', 'page')`. Silent false-green: `getByTestId('nav-scripture')` matches nothing and the negation still passes.

**Rewrite:**
- `tests/integration/example-rpc.spec.ts` — currently `createTestSession` / `scripture_sessions` / `scripture_step_states`. Reuse `resolveWorkerPairIds`, `seedEvents`, `clearPairEvents` from `tests/support/factories/events.ts` (168, 218) plus `{ test, expect }` from `../support/merged-fixtures` and `supabaseAdmin`. Sibling `tests/integration/claude-bot-config-forward-migration.spec.ts` stays. Playwright project `integration` (`playwright.config.ts:165-167`) is what runs this file; chromium (`:147-148`) does not.

**Comment-only (do not delete the files):**
- `tests/e2e/notes/love-notes-realtime.spec.ts:28` cites `together-mode.ts:134`; `:203` cites `together-mode.ts:165` (`partnerContext.close().catch(() => {})` is the idiom — keep the code, drop the citation).
- `tests/e2e/partner/partner-mood-realtime.spec.ts:193` — same close-idiom citation.
- `tests/support/helpers/persisted-blob.ts:17` — `matching './scripture-cache.ts'`.
- `tests/support/fixtures/auth.ts:92` — `partner user identifier for together-mode tests`. The fixture itself stays; partner identity is still used by live two-context specs.

**Docs:**
- `tests/README.md:23` example path `tests/e2e/scripture/scripture-lobby-4.1.spec.ts`; `:72-86` entire `scripture/` tree; `:89-90` scripture API specs; `:95-119` scripture unit files; `:127-128` together-mode / scripture-navigation; `:134` scripture-lobby; `:135` helpers.ts; `:158-161` `testSession`/`scriptureNav`/`togetherMode`; `:169` together-mode partners sentence; `:176-186` `createTestSession` sample; `:193-204` solo-scripture example test. Rewrite those stale scripture listings against the surviving tree (`find tests/e2e -name '*.spec.ts'` is 37 files, no `scripture/` dir; `ls tests/api` is 16 non-scripture specs). Do not invent a complete file-by-file dump.

**Out of this story (listed so they are not "found" and edited):**
- `tests/e2e-archive/` — frozen; `scripture-reflection-original.spec.ts` still imports `../../support/helpers` (the flat file). Leave the archive import broken-looking; do not repair it.
- `tests/api/` — 16 live specs. Comment citations of deleted scripture files stay.
- `src/components/Navigation/__tests__/NavigationTray.test.tsx` — story 2.
- `tests/unit/services/dbSchema*.test.ts`, `signOutClearsAccountState.test.ts` — story 4.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — story 2.
- `tests/support/check-constraint-envelopes.ts:73` — `scripture_reflections` still exists until story 3; leave the comment.

## Tasks & Acceptance

**Execution:**
- `tests/support/merged-fixtures.ts` -- Remove `scriptureNavFixture` and `togetherModeFixture` from the import, the `mergeTests` type tuple, and the `mergeTests(` call -- choke point; 59 remaining importers are non-scripture.
- `tests/support/fixtures/scripture-navigation.ts` and `tests/support/fixtures/together-mode.ts` -- Delete both files in the same commit as the merged-fixtures edit -- otherwise the Playwright suite fails at import.
- `tests/support/helpers.ts`, `tests/support/helpers/scripture-cache.ts`, `scripture-lobby.ts`, `scripture-overview.ts`, `scripture-together.ts`, `reflection.ts` -- Delete -- leftover scripture-only helpers. Do not delete `helpers/index.ts` or `helpers/rls-security.ts`.
- `tests/support/factories/index.ts` -- Keep `TypedSupabaseClient`. Delete `SeedResult` / presets / `createTestSession` / `cleanupTestSession` / `linkTestPartners` / `unlinkTestPartners` and the email-id cache that only served the seeder -- zero remaining live importers after the deletes above.
- `tests/support/fixtures/index.ts` -- Delete `testSession` (type, fixture, scripture factory imports). Keep `supabaseAdmin`, `supabaseAsUser`, `coupleEvents`.
- `tests/support/helpers/navigation.ts` -- Drop `'scripture'` from `NavDestination`; reword the "seven" comment to six.
- `tests/e2e/navigation/tray.spec.ts` -- Remove `'scripture'` from the inactive-destination loop at line 82 -- vacuous `.not.toHaveAttribute` against a missing testid.
- `tests/integration/example-rpc.spec.ts` -- Rewrite against `events` using `resolveWorkerPairIds` + `seedEvents` + `clearPairEvents` from `tests/support/factories/events.ts`, still via `supabaseAdmin` from merged-fixtures. Keep two tests: seed asserts the row; cleanup asserts the row is gone. Do not call `scripture_seed_test_data` or touch partner linkage.
- `tests/e2e/notes/love-notes-realtime.spec.ts`, `tests/e2e/partner/partner-mood-realtime.spec.ts`, `tests/support/helpers/persisted-blob.ts`, `tests/support/fixtures/auth.ts` -- Reword comments that cite `together-mode.ts` / `scripture-cache.ts` / "together-mode tests". Keep the specs and the close-`.catch(() => {})` idiom.
- `tests/README.md` -- Rewrite stale scripture tree, fixture list, factory sample, and example test so they describe surviving tests, not `tests/e2e/scripture/`.

**Acceptance Criteria:**
- Given the two scripture fixtures are deleted, when any remaining Playwright spec imports `tests/support/merged-fixtures.ts`, then the module loads (no `scripture-navigation` or `together-mode` import).
- Given `tray.spec.ts`'s inactive-destination loop, when that test runs, then every `nav-${view}` testid in the loop exists in the app (no `'scripture'` entry).
- Given `tests/integration/example-rpc.spec.ts`, when it runs under `--project=integration`, then it inserts and deletes `events` rows through the admin client and never calls `scripture_seed_test_data` or reads `scripture_sessions`.
- Given `tests/support/helpers.ts` is gone, when live specs import `tests/support/helpers/navigation.ts` or `tests/support/helpers/index.ts`, then those modules still resolve.
- Given a grep for leftover helper/fixture filenames under `tests/` excluding `tests/e2e-archive/` and `tests/api/`, when the surgery is done, then `scripture-navigation.ts`, `together-mode.ts`, `scripture-cache.ts`, `scripture-lobby.ts`, `scripture-overview.ts`, `scripture-together.ts`, `helpers/reflection.ts`, and the flat `tests/support/helpers.ts` are absent, while `helpers/index.ts` and `helpers/rls-security.ts` remain.
- Given `npm run typecheck`, `npm run lint`, and `npx playwright test --project=chromium`, when they run after the surgery, then all three exit 0.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 6, false 9, maybe-false 0
- findings:
  - `[low]` `[patch]` README login example omitted `test.use({ authSessionEnabled: false })` — added that line so the snippet matches `tests/e2e/auth/login.spec.ts:12`
  - `[low]` `[reject]` README later sections still say RPCs / `workerAuth` — those sentences pre-existed the Data Factories rewrite; everyday readers are unlikely to hit them, and rewriting every RPC mention is more than a one-line correction
  - `[false]` `[reject]` support tree omitted `tests/support/auth/` — `auth-setup.ts` was never on disk; the spec said not to invent a complete dump
  - `[false]` `[reject]` README listed only three fixtures while merged-fixtures composes more — spec said not to dump every barrel member
  - `[false]` `[reject]` story's "59 remaining importers are non-scripture" includes 4 `tests/e2e-archive/` files — live non-archive count is 55; the code barrel is fine; fixing the count would edit the spec
  - `[false]` `[reject]` I/O matrix only covers seed/cleanup — a spec-completeness ask; reject because the fix is to edit this spec
  - `[false]` `[reject]` ACs omit comment/README checks — same, fix would edit this spec
  - `[false]` `[reject]` `clearPairEvents` pair-wide delete could wipe in-flight events if projects share a worker — one test per worker; `TEST_WORKER_INDEX` maps to a unique pair; another worker's rows are not in the `user_id` filter
  - `[low]` `[patch]` `navigation.ts` said six destinations matching `ViewType` — dropped the ViewType clause; `ViewType` still includes scripture until story 2
  - `[low]` `[defer]` `rls-security.ts:4` still says scripture RLS — pre-existing header; this story kept the file as-is for live importers
  - `[low]` `[patch]` `factories/events.ts` still cited deleted `resolveAppUserIdByEmail` in `./index.ts` — reworded the comment so it no longer points at a removed helper
  - `[low]` `[reject]` `src/components/scripture-reading/constants.ts` cites deleted `scripture-lobby.ts` — intent forbids touching `src/`; story 2 deletes that directory
  - `[false]` `[reject]` README factory sample uses `factories/events` rather than `helpers/events` — the sample documents `seedEvents` as the rewrite specified
  - `[false]` `[reject]` tray loop no longer checks live `nav-scripture` — intent required removing `'scripture'` from the loop; the destination itself is story 2
  - `[false]` `[reject]` `tests/e2e-archive/scripture-reflection-original.spec.ts` still imports `merged-fixtures` and `testSession` — intent forbids editing `tests/e2e-archive/`; the broken import is specified

## Design Notes

**helpers.ts vs helpers/index.ts.** Node/TS resolve `from '../helpers'` to the *file* `helpers.ts` while it exists, and to `helpers/index.ts` once the file is gone. The only remaining bare-`helpers` importer is `tests/e2e-archive/scripture-reflection-original.spec.ts` — do not repair it. Live specs import subpaths (`helpers/navigation`, `helpers/events`, …).

**tray.spec.ts false-green.** Line 82's assertion is `.not.toHaveAttribute`. Playwright's empty locator still satisfies a negation, so leaving `'scripture'` in the array is a silent pass, not a red test.

**example-rpc rewrite.** There is no events seed RPC. `seedEvents` in `tests/support/factories/events.ts` already inserts through the admin client in one statement and `clearPairEvents` deletes by this worker's pair ids — copy that shape, do not invent a new factory. Scope labels with a unique suffix so parallel workers cannot collide. `clearPairEvents` in `finally` is the cleanup analogue of `cleanupTestSession`.

**linkTestPartners.** Inventory: delete only if zero remaining importers. After deleting `together-mode.ts` and `testSession`, the only callers are gone. Delete both link and unlink. Specs must not link/unlink partners (AGENTS.md).

**Commit.** Put the merged-fixtures edit, the two fixture deletes, and the rest of this surgery in one commit so the 59 barrel importers never see a half-state. `tests/README.md` is part of that surgery, not a separate docs-only commit.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (`tsc -b --force` across the three projects)
- `npm run lint` -- expected: exit 0
- `npx playwright test --project=chromium` -- expected: all e2e specs pass (requires local Supabase; `npm run dev:local` / `vite --mode test` is what Playwright's webServer starts)
- `npx playwright test --project=integration tests/integration/example-rpc.spec.ts` -- expected: rewritten seed/cleanup tests pass (chromium does not run `tests/integration/`)

## Auto Run Result

Status: done

**Summary:** Leftover scripture test fixtures and helpers are gone. Shared files that imported them were repaired in the same change. `tests/integration/example-rpc.spec.ts` now seeds and clears `events` through the admin client. Live non-api comments no longer cite `together-mode.ts` / `scripture-cache.ts`. `tests/README.md` no longer lists `tests/e2e/scripture/`.

**Files:**
- `tests/support/merged-fixtures.ts` — dropped `scriptureNavFixture` and `togetherModeFixture` from import, type tuple, and `mergeTests(`
- `tests/support/fixtures/scripture-navigation.ts`, `together-mode.ts` — deleted
- `tests/support/helpers.ts`, `helpers/scripture-*.ts`, `helpers/reflection.ts` — deleted; `helpers/index.ts` and `helpers/rls-security.ts` kept
- `tests/support/factories/index.ts` — `TypedSupabaseClient` only
- `tests/support/fixtures/index.ts` — dropped `testSession`; kept `supabaseAdmin`
- `tests/support/helpers/navigation.ts` — six destinations, no `'scripture'`
- `tests/e2e/navigation/tray.spec.ts` — `'scripture'` removed from the inactive-destination loop
- `tests/integration/example-rpc.spec.ts` — rewritten against `events`
- comment rewords in `love-notes-realtime.spec.ts`, `partner-mood-realtime.spec.ts`, `persisted-blob.ts`, `auth.ts`
- `tests/README.md` — scripture tree, fixture list, factory sample, and example test rewritten
- `tests/support/factories/events.ts` — comment no longer cites deleted `resolveAppUserIdByEmail`

**Review:** 3 low patches applied (README login `test.use`, navigation comment, events factory comment). 1 low deferred (`rls-security.ts` header). Rejected: README RPC/`workerAuth` leftovers; incomplete README dump; spec-only matrix/AC/count findings; `clearPairEvents` cross-worker wipe (worker-pool isolates pairs); `src/` comment (intent forbids `src/`); tray coverage on a destination story 2 removes; archive `testSession` import (intent forbids archive edits).

**Follow-up review:** false (3 patched, all low).

**Verification:**
- `npm run typecheck` — exit 0
- `npm run lint` — exit 0
- `npx playwright test --project=chromium` — 116 passed
- `npx playwright test --project=integration tests/integration/example-rpc.spec.ts` — INT-001 and INT-002 passed

**Residual:** `tests/e2e-archive/` still imports deleted helpers/`testSession` (specified). Scripture remains in `src/` until story 2. `rls-security.ts` header deferred.
