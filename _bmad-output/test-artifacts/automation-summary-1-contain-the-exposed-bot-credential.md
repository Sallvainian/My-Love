---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-identify-targets',
    'step-03-generate-tests',
    'step-03c-aggregate',
    'step-04-validate-and-summarize',
  ]
lastStep: 'step-04-validate-and-summarize'
nextStep: ''
lastSaved: '2026-09-12'
runScope: 'story-level'
runKey: '1-contain-the-exposed-bot-credential'
executionMode: 'BMad-Integrated'
detectedStack: 'frontend'
resolvedExecutionMode: 'sequential'
inputDocuments:
  - '_bmad-output/specs/spec-security-remediation/stories/1-contain-the-exposed-bot-credential.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - 'scripts/provision-claude-bot.mjs'
  - 'supabase/migrations/20260316031209_create_claude_bot_config.sql'
  - 'supabase/migrations/20260912000000_remove_claude_bot_password_row.sql'
  - 'supabase/migrations/20260725170000_grant_api_roles_on_public.sql'
  - 'supabase/tests/database/22_claude_bot_config_no_secret.sql'
  - 'tests/unit/scripts/provision-claude-bot.test.ts'
  - 'tests/unit/supabase/no-committed-bot-secret.test.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/fixtures/index.ts'
  - 'tests/support/fixtures/auth.ts'
  - 'tests/support/helpers/supabase.ts'
  - 'tests/support/helpers/rls-security.ts'
  - 'tests/api/auth-bootstrap-identity.spec.ts'
  - 'tests/api/events-wire-contract.spec.ts'
  - 'tests/api/check-error-write-boundaries.spec.ts'
  - 'tests/integration/example-rpc.spec.ts'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'supabase/config.toml'
  - '.github/workflows/test.yml'
  - '.github/actions/setup-supabase/action.yml'
  - '.github/actions/setup-playwright-e2e/action.yml'
  - 'package.json'
  - 'AGENTS.md'
  - '_bmad/tea/config.yaml'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/library-integration-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/confidence-gate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/evidence-integrity.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md'
---

# Test Automation Summary: 1-contain-the-exposed-bot-credential

**Date:** 2026-09-12
**Author:** Sallvain
**Mode:** BMad-Integrated (story spec available; no test-design or ATDD artifact exists for this story)
**Scope under test:** branch `bmad-loop/20260912-154607-c8bd/1` at `7b186265` — the two story commits (`683576b8` fix, `7b186265` docs), 8 files, +829/−2 against `main`. The literal working tree held only one uncommitted change, `deferred-work.md` (+16 lines, DW-85 and DW-86); the story's implementation is in the commits, so that is what was covered.

---

## Executive Summary

Eight tests were added, all green on first run, all shown to fail under a targeted mutation, and all P1 or P2. **No production code was changed** — `git status` shows only `tests/` and `_bmad-output/`.

| | Before | After | Δ |
|---|---|---|---|
| Playwright `integration` specs | 1 | **2** | +1 file, +2 tests |
| Playwright `api` specs | 14 | **15** | +1 file, +4 tests |
| `provision-claude-bot.test.ts` cases | 9 | **11** | +2 |
| Full Vitest suite | 106 files / 1921 tests | **106 files / 1923 tests** | +2 |
| Helpers | — | `tests/support/helpers/migration-replay.ts` | +1 |

**The result that matters most.** DW-85 recorded that the forward DELETE migration "is only ever verified on a fresh replay, where the row it deletes never exists" and that "the repo has no pattern for replaying one migration against pre-seeded state". That pattern now exists and is exercised: `replayMigrationInRollback()` seeds the pre-fix row, pipes the committed migration file byte for byte through `psql` inside the database container, reads the result, and rolls back. Measured line sequence:

```
BEGIN / INSERT 0 1 / 1 / DELETE 1 / 0 / partner_email,test_email / ROLLBACK
```

Neutralising the DELETE in the migration turns both integration tests red; renaming the container turns them red with an explicit *could not measure* error instead of a pass.

**One weak test was caught and fixed.** The first version of the `CLAUDE_BOT_EMAIL` case-insensitivity test stayed green when the override-side `.toLowerCase()` was removed, because the override was already lowercase. It now uses different casing on both sides and fails under either mutation.

---

## Step 1 — Preflight & Context

**Stack detection:** `frontend`. `package.json` has `react ^19.2.8`, `playwright.config.ts` and `vitest.config.ts` exist; no `maestro/` or `.maestro/` directory, and none of `pyproject.toml`, `pom.xml`, `build.gradle`, `go.mod`, `Gemfile`, `Cargo.toml`. Supabase is a hosted/local dependency reached over HTTP and Postgres, not a backend project in this repo.

**Framework verification:** passed — `playwright.config.ts` declares `chromium`, `api` and `integration` projects; `vitest.config.ts` includes `tests/**/*.test.ts`. Local stack was running (`supabase status` reports `API_URL http://127.0.0.1:54321`, container `supabase_db_My-Love`).

**Execution mode:** `tea_execution_mode: auto` with `tea_capability_probe: true` would resolve to `subagent`. It is overridden to **`sequential`** by the project rule in `CLAUDE.md`: in a bmad-loop worktree the work must be done in-session because a background subagent cannot be polled and a session waiting on one burns its whole timeout. Both worker steps ran inline; their outputs are in `automation-1-contain-the-exposed-bot-credential/evidence/{api,e2e}-worker-output.json`.

**Mandate gates:**

- **Playwright Utils** — `tea_use_playwright_utils: true` and `@seontechnologies/playwright-utils` is installed (`tests/support/merged-fixtures.ts` composes its fixtures). The two Playwright specs are in scope and follow the mandate: `test` from `../support/merged-fixtures`, every HTTP call through `apiRequest`, report output through `log.step`, no `request.*`, no `waitForTimeout`, no `console.log`. The integration spec reaches Postgres through `docker exec … psql` (no utility covers a database shell; noted, not a deviation) and confirms the live table through the existing `supabaseAdmin` SDK fixture, as `tests/integration/example-rpc.spec.ts` does. The Vitest additions are outside the mandate's scope (not the Playwright runner).
- **Pact.js Utils** — relevance gate closed: `grep -c pact package.json` = 0, no `pact/` or `tests/contract/` tree, single repo. No Pact artifacts generated. `pact_mcp_reachable: false` — no SmartBear MCP tools are in this session's tool list (the probe is a tool-list check, never a broker call); moot because the gate closed first.

**Browser exploration:** skipped. `grep -rn claude_bot_config src/` matches only the generated `src/types/database.types.ts:37`; the story spec confirms "no source file reads `claude_bot_config` or the bot login". There is no page for `playwright-cli` to find.

**Knowledge fragments loaded:** `playwright-utils-mandate`, `library-integration-mandate`, `test-levels-framework`, `test-priorities-matrix`, `test-quality`, `confidence-gate`, `evidence-integrity`, `data-factories`, `selective-testing`.

---

## Step 2 — Automation Targets

### What the story already covers, and the gaps

The story shipped nine child-process unit cases, a SQL scan and pgTAP file 22. Its own review triage names the residue: the `CLAUDE_BOT_EMAIL` override and the no-`access_token` branch "remain untested", and DW-85 defers the DELETE-against-a-real-row check. The spec's Boundaries also say the table's two identifier rows must stay and that RLS-with-no-policies is the only thing standing between anon/authenticated and that table — pgTAP proves this with `set local role`, which is not the request an HTTP caller makes.

| Gap | Evidence | Level chosen | Why that level |
|---|---|---|---|
| DELETE migration never run against the row it deletes | `deferred-work.md` DW-85; `22_claude_bot_config_no_secret.sql:8-10` "the DELETE finds nothing to remove" | **Integration** (Playwright `integration` project) | `test-levels-framework.md`: "Database operations and transactions → Integration". Needs the real Postgres and the real file; pgTAP cannot read `supabase/migrations/` from inside `supabase test db` |
| Deny-all posture measured over the wire | `20260725170000_grant_api_roles_on_public.sql:35` grants ALL to anon/authenticated; `:29` relies on RLS being the gate | **API** (Playwright `api` project) | "API endpoint contracts → Integration"; the pgTAP twin proves the SQL role, this proves the HTTP surface, per `evidence-integrity.md` "probes issue the client's request" |
| `CLAUDE_BOT_EMAIL` override, `access_token` missing | story triage: "remain untested and are noted as residual" | **Unit** (extend the existing child-process file) | "Error handling in isolated components → Unit"; the existing stub already models the four endpoints |

### Deliberate exclusions

| Excluded | Why |
|---|---|
| **E2E** | No UI surface. A browser journey would observe nothing about this change. |
| **Old-password login → 400, sessions → 0** (acceptance criteria 1–2) | Hosted-only, and the pre-rotation value must never be stored where a test can read it. Remains operational evidence in the story's *Operational Evidence* table. |
| **A pgTAP replay of the migration** | `supabase test db` mounts only `supabase/tests/database`; `\i ../../migrations/…` has no file to read. The Playwright helper pipes the file from the host instead. |
| **Static "migration sorts last" check** | Ordering is by the 14-digit timestamp the CLI enforces; a test would restate the filename. |
| **Contract tests** | Gate closed (above). |

### Priority assignment

`test-priorities-matrix.md` decision tree. This is a security finding, but the credential is already rotated and dead; what the table now leaks on a regression is two email addresses, and what the migration fixes is a dead string on the hosted database. Neither is revenue-critical. Both are "previously broken functionality (regression prevention)" and "integration points between systems" → **P1** ceiling for the six Playwright tests. The two unit additions close branches the review called residual rather than risks → **P2**. No P0 declared, for the same reason the previous run gave: a P0 that is not on a critical path hollows out the 100 % P0 gate.

**Priority tags** are in the Playwright test names (`[P1] F1-INT-001 …`), the convention `tests/api/*.spec.ts` already uses. The Vitest file is one of the 37 unit files without tags, and `test-quality.md` Example 8 requires one dialect per file, so the two unit cases are untagged and mapped here instead.

### Confidence gate (before generation)

**Confidence: 9.** *Rationale:* every endpoint response was measured with `curl` against the running local stack before a line was written (anon GET → `200 []`, anon POST → `401 42501`, service GET → two keys); the psql replay was run by hand and printed the exact sequence the test now asserts; the fixture composition was read from `merged-fixtures.ts` and copied from `auth-bootstrap-identity.spec.ts`. *Unknowns going in:* the status PostgREST returns for an **authenticated** RLS-refused insert (documented mapping says 403 where anon gets 401); pinned at 403 and confirmed by the first run.

---

## Step 3 — Tests Generated

### Files

| File | Status | Lines | Tests |
|---|---|---|---|
| `tests/support/helpers/migration-replay.ts` | **new** (helper) | 128 | — |
| `tests/integration/claude-bot-config-forward-migration.spec.ts` | **new** | 97 | 2 |
| `tests/api/claude-bot-config-exposure.spec.ts` | **new** | 128 | 4 |
| `tests/unit/scripts/provision-claude-bot.test.ts` | **updated** (+42/−1) | 316 | 11 (was 9) |

### Coverage plan → what was built

| Test ID | Priority | Requirement | Built | Where |
|---|---|---|---|---|
| F1-INT-001 | P1 | Pre-seeded `test_password` row: count 1 → `DELETE 1` → 0; `partner_email,test_email` remain; live table unchanged after rollback | ✓ | integration spec |
| F1-INT-002 | P1 | Second application in the same transaction: `DELETE 0`, no error | ✓ | integration spec |
| F1-API-001 | P1 | anon key GET → `200 []` | ✓ | api spec |
| F1-API-002 | P1 | authenticated GET → `200 []` | ✓ | api spec |
| F1-API-003 | P1 | authenticated POST → `403` / `42501` / RLS message; no row committed (service-role read) | ✓ | api spec |
| F1-API-004 | P1 | service role reads exactly the two identifier keys, no `test_password` (positive control) | ✓ | api spec |
| UNIT-override | P2 | `CLAUDE_BOT_EMAIL` matched case-insensitively on both sides; sign-in carries it verbatim; default email absent from output | ✓ | unit file |
| UNIT-no-token | P2 | sign-in `200` without `access_token` → exit 1, half-done warning, methods `GET, PUT, POST` (no logout) | ✓ | unit file |

### The helper: `migration-replay.ts`

- **Instrument before reading** (`evidence-integrity.md` Example 3): `assertLocalDatabaseReachable()` runs `SELECT 1` first and throws `PsqlError: Cannot reach supabase_db_My-Love …` if Docker or the container is missing. Mutation B shows this is the failure mode, not a vacuous pass.
- **Byte-for-byte replay**: the migration file is read from `supabase/migrations/` and inserted into the script unchanged, so the test exercises the committed statement, not a copy of it. Mutation A confirms.
- **Rollback, always**: `BEGIN … ROLLBACK` wraps the whole script. The seeded key is the real `test_password` key — it has to be, that is what the migration deletes — and the rollback is what keeps pgTAP 22's "no `test_password` row" and every other worker blind to it. Nothing is ever committed.
- **Container name** follows the existing precedent at `playwright.config.ts:55` (`docker inspect supabase_auth_My-Love`), both derived from `project_id = "My-Love"` in `supabase/config.toml:5`. CI runs the `integration` project on `ubuntu-latest` with the same Docker-hosted stack (`.github/actions/setup-supabase`), so the mechanism is available there; the environment asymmetry is that CI excludes five containers via `-x`, none of which is `db`.
- **No values in the report**: the seeded value is `placeholder-not-a-secret`, only `key` columns and counts are selected, and `-At` output is asserted as an exact line list.

### Fixture needs

None new. `apiRequest`, `authToken` (auth-session, worker pool) and `supabaseAdmin` already exist in `merged-fixtures.ts`; the API spec reads `SUPABASE_SERVICE_ROLE_KEY` from the environment for its positive control exactly as `check-error-write-boundaries.spec.ts:34` does.

---

## Step 4 — Validation

### Commands run, in this worktree, at `7b186265`

| Result | Command |
|---|---|
| **6 passed**, 6.2 s | `npx playwright test tests/integration/claude-bot-config-forward-migration.spec.ts tests/api/claude-bot-config-exposure.spec.ts --project=integration --project=api` |
| **30 passed**, 12.4 s, per-test 276–483 ms | same with `--repeat-each=5 --retries=0` (5 workers) |
| **11 passed** | `npx vitest run tests/unit/scripts/provision-claude-bot.test.ts` |
| **106 files / 1923 tests passed** | `npx vitest run` |
| **exit 0**, 0 errors, 3 pre-existing warnings in `src/components/RelationshipTimers/EventCountdown.tsx` | `npm run lint` |
| **exit 0**, empty output (0 bytes) — none of the worktree-only TS2883 errors appeared this time | `npx tsc -b --force` |

Measured during the first run (values the tests now pin): authenticated GET → `200 []`; authenticated POST → `403`, `42501`, `new row violates row-level security policy for table "claude_bot_config"`.

### Falsifiability evidence

Each mutation was applied, run, and reverted with `git checkout --`; `git status` afterwards shows only the intended new and edited test files. Logs in `automation-1-contain-the-exposed-bot-credential/evidence/mut-*.log`.

| Mutation | Expected | Observed |
|---|---|---|
| **A.** DELETE line in `20260912000000_remove_claude_bot_password_row.sql` replaced by a comment | both INT tests red | **2 failed** — line sequence mismatch (`Expected − 3 / Received + 2`) |
| **B.** `SUPABASE_DB_CONTAINER` → `supabase_db_does-not-exist` | both INT tests red with the *could-not-measure* error | **2 failed** — `PsqlError: Cannot reach supabase_db_does-not-exist through docker exec … No such container` |
| **C.** `CREATE POLICY f1_mutation_probe … FOR SELECT TO anon, authenticated USING (true)` on the live local table | API-001 and API-002 red; API-003/004 unaffected | **2 failed, 2 passed** — exactly those; `DROP POLICY` afterwards, `pg_policies` count back to **0** |
| **D1 (first attempt).** override-side `.toLowerCase()` removed in `findUser` | the override test red | **11 passed — weak test.** Override and comparison were both already lowercase. Test rewritten: override `Rotation-Bot@test.example.com`, listing `rotation-bot@TEST.example.com` |
| **D1a.** same mutation after the rewrite | the override test red | **1 failed** — that test |
| **D1b.** listing-side `.toLowerCase()` removed | the override test red | **1 failed** — that test |
| **D2.** `access_token` guard deleted from `signIn()` | the no-token test red | **1 failed** — that test |

### Evidence hygiene

The evidence directory was scanned: no JWT-shaped string (`eyJ…`) appears in any log; the only "password" strings present are the two literal placeholders the tests declare as non-secrets. The Playwright report, traces and videos are under `test-results/`, which is gitignored.

---

## Definition of Done

Recorded in full, with the `test-quality.md` Core Quality Checklist ticked item by item, at [`automation-1-contain-the-exposed-bot-credential/definition-of-done.md`](automation-1-contain-the-exposed-bot-credential/definition-of-done.md). Two items carry a stated deviation: **Unique Data** (domain literals named at the point of use instead of faker, because the key set is the assertion) and **priority tags** in the Vitest file (one dialect per file).

---

## Operator decisions

These change what ships or how the ledger reads, and are not this workflow's to make.

1. **DW-85's status.** These tests supply the replay pattern DW-85 said was missing and prove the DELETE against the state production is in. They do not touch the hosted project, so the entry's own settling check — the post-deploy hosted count — still stands. Whether that narrows DW-85 or closes it is a ledger decision; `deferred-work.md` was not edited (its only change is the previous session's uncommitted DW-85/DW-86 append).
2. **The pinned `200 []` for anon.** F1-API-001 pins the *measured* posture: anon holds a SELECT grant and RLS returns nothing. If the grant is ever revoked for this table (as `20260818000002:113` did for `events`, giving `401 42501`), that is a tightening and the assertion should be updated on purpose, not read as a regression.
3. **CI reliance on `docker exec`.** The integration spec is the first test to shell into the database container. It works wherever local Supabase runs, and CI's `backend-tests (integration)` job starts that stack, but it is a new class of dependency for a spec; if that is unwanted, the alternative is a `pg` client dependency, which the repo does not have today.

## Observations (not acted on)

- `workflow.yaml:32` still names the fixed `default_output_file: "{test_artifacts}/automation-summary.md"`; that path is occupied by an earlier run, so this run wrote a run-scoped filename, as the previous runs did.
- `tests/support/helpers/index.ts` re-exports only `./navigation`; `migration-replay.ts` is imported by path, matching how `supabase.ts` and `rls-security.ts` are consumed.
- The story's Operational Evidence table (`1-contain-the-exposed-bot-credential.md:145`) still shows the hosted `test_password` row as "present" pending deploy; nothing here changes that.

---

## Next steps

```bash
npx playwright test tests/integration/claude-bot-config-forward-migration.spec.ts --project=integration
npx playwright test tests/api/claude-bot-config-exposure.spec.ts --project=api
npx vitest run tests/unit/scripts/provision-claude-bot.test.ts
```

**Recommended follow-on workflow:** `/bmad-testarch-trace` — the story's acceptance criteria now have automated coverage on the local surfaces and recorded evidence on the hosted ones, which is exactly the split a traceability matrix should show.

## Playwright Utils deviations

**None.** Both Playwright specs import `test`/`expect` from `../support/merged-fixtures`, make every HTTP call through `apiRequest`, log through `log.step`, and contain no `request.*`, `page.route`, `waitForTimeout` or `console.log`. The database shell in the integration helper is outside any utility's coverage and is recorded above as a mechanism note.

## Pact.js Utils deviations

**None** — no Pact artifacts were generated; the relevance gate did not open.

## Confidence

**9 / 10.**

*Rationale:* every asserted value was first observed against the running local stack (curl and psql, quoted above) and then reproduced by the test; every new assertion was shown to fail under a mutation that names its subject; and the one assertion that did not fail was rewritten until it did.

*Unknowns:*
- CI has not run these specs yet. The `docker exec` path is argued from `setup-supabase/action.yml` (same CLI, same `project_id`, `db` not excluded), not observed on a runner.
- `403` for an authenticated RLS refusal was measured on the local PostgREST image; the hosted platform's version could differ, but no test here targets the hosted project.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-automate` (Create mode, sequential execution)
**Version:** 5.0 (Step-File Architecture)
