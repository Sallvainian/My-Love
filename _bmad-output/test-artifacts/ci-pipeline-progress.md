---
stepsCompleted: ['step-01-preflight', 'step-02-generate-pipeline']
lastStep: 'step-02-generate-pipeline'
lastSaved: '2026-03-01'
---

# CI Pipeline Progress

## Step 1: Preflight

| Check                 | Result                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| Git repo              | github.com/Sallvainian/My-Love                                          |
| Test stack type       | frontend (React PWA + Supabase BaaS)                                    |
| Test frameworks       | Vitest (unit, 793 tests) + Playwright (E2E, sharded)                    |
| Tests pass locally    | Unit: yes (793/793)                                                     |
| CI platform           | github-actions                                                          |
| Node version          | v24.13.0 (.nvmrc)                                                       |
| Package manager       | npm (package-lock.json)                                                 |
| Existing CI state     | .github/workflows/test.yml — BROKEN (0 successful runs in 158 attempts) |
| Existing infra        | .github/actions/setup-supabase/action.yml (composite action)            |
| Secrets required      | DOPPLER_TOKEN_DEV                                                       |
| Supabase setup action | Pins CLI v2.72.7, starts local, resets DB, exports creds                |

### Key project configs

- Playwright: chromium-only, 2 shards in CI, auth setup project, webServer starts Vite in test mode
- Vitest: happy-dom env, 80% coverage thresholds, JUnit reporter
- dotenvx: manages all env vars (VITE_SUPABASE_URL, etc.)

## Step 2: Generate Pipeline

**Output**: `.github/workflows/test.yml` (replaced broken version)
**Execution mode**: sequential
**Contract testing**: skipped (frontend PWA, no Pact setup)

### Pipeline stages

| Job           | Depends on          | Trigger scope    | Purpose                                |
| ------------- | ------------------- | ---------------- | -------------------------------------- |
| lint          | —                   | all              | ESLint + TypeScript + Prettier         |
| unit-tests    | —                   | all              | Vitest with 80% coverage thresholds    |
| db-tests      | —                   | all              | pgTAP via Supabase CLI (NEW)           |
| e2e-p0        | lint                | all              | P0-tagged Playwright tests (fast gate) |
| e2e-tests     | e2e-p0              | all              | Full Playwright, 2 shards              |
| burn-in       | e2e-tests           | PRs to main only | Changed specs run 5x for flakiness     |
| merge-reports | e2e-tests           | always           | Combine shard HTML reports             |
| test-summary  | lint, unit, db, e2e | always           | Branch protection gate                 |

### Key changes from old (broken) pipeline

- Removed workflow-level `env` block using `${{ runner.os }}` (invalid at workflow scope — likely root cause of 158 consecutive failures)
- Downgraded action versions from @v6/@v7 to @v4 (stable, well-tested)
- Added `pull_request` without branch filter (triggers on ALL PRs, not just main/develop)
- Added `db-tests` job for pgTAP tests
- Added db-tests to summary gate
- Removed unused `CACHE_KEY_PREFIX` variable
- Schedule changed from daily to weekly (Sundays 2 AM UTC)
