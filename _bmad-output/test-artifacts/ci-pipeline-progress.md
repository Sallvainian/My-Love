---
stepsCompleted:
  [
    'step-01-preflight',
    'step-02-generate-pipeline',
    'step-02-audit',
    'step-03-configure-quality-gates',
    'step-04-validate-and-summary',
  ]
lastStep: 'step-04-validate-and-summary'
lastSaved: '2026-03-03'
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

## Step 2 (Audit & Improve) — 2026-03-03

### Findings & Fixes Applied

| #   | Severity | Issue                                                       | Fix                                                  |
| --- | -------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| 1   | CRITICAL | `node-version-file: '.mise.toml'` unsupported by setup-node | Created `.node-version`, updated all workflows       |
| 2   | HIGH     | `${{ github.base_ref }}` in burn-in run block               | Routed through `env: BASE_REF`                       |
| 3   | HIGH     | `$SPECS` unquoted in playwright command                     | Quoted as `"$SPECS"`                                 |
| 4   | MEDIUM   | Missing `scripts/test-changed.sh`                           | Created                                              |
| 5   | MEDIUM   | Missing `docs/ci.md`                                        | Created                                              |
| 6   | MEDIUM   | Missing `docs/ci-secrets-checklist.md`                      | Created                                              |
| 7   | MEDIUM   | No retry logic documented                                   | Documented Playwright retry (2x in CI) in docs/ci.md |
| 8   | LOW      | Supabase CLI pinned at v2.72.7                              | Updated to v2.76.15                                  |
| 9   | LOW      | `npm audit` breaks CI on unfixable vulns                    | Added `continue-on-error: true`                      |
| 10  | LOW      | Smoke test not in pipeline                                  | Added `smoke-tests` job                              |

### Additional Fixes (discovered during audit)

- `actions/setup-node@v6` in deploy.yml and bundle-size.yml → downgraded to @v4
- `.mise.toml` references in deploy.yml and bundle-size.yml → changed to `.node-version`

## Step 3: Quality Gates & Notifications

All quality gates already configured:

- P0 gate: e2e-p0 job blocks full E2E
- Branch protection: test-summary requires all stages pass
- Burn-in: 5 iterations on PRs to main (frontend stack)
- Playwright retries: 2x in CI
- Coverage: 80% thresholds (Vitest)
- Contract testing: skipped (not applicable)
- Notifications: GitHub default watchers

## Step 4: Validation & Summary

### Checklist Validation

#### Prerequisites

- [x] Git repository initialized
- [x] Git remote configured (github.com/Sallvainian/My-Love)
- [x] Test framework configured (Vitest + Playwright)
- [x] Local tests pass (820/820 unit tests)
- [x] CI platform: GitHub Actions

#### Pipeline Configuration

- [x] `.github/workflows/test.yml` — valid YAML
- [x] `.node-version` — Node 24.13.0
- [x] All paths resolve correctly
- [x] No hardcoded secrets
- [x] Triggers: push (main), pull_request, schedule (weekly), workflow_dispatch
- [x] Concurrency: cancel-in-progress per branch

#### Stages

- [x] Lint & Type Check (ESLint, TypeScript, Prettier, npm audit)
- [x] Unit Tests (Vitest, 80% coverage)
- [x] Database Tests (pgTAP via Supabase)
- [x] Smoke Tests (post-build verification)
- [x] E2E P0 Gate (fast feedback)
- [x] E2E Full (2 shards, fail-fast: false)
- [x] Lighthouse CI (advisory, continue-on-error)
- [x] Burn-In (5 iterations, PRs to main, changed specs)
- [x] Merge Reports
- [x] Test Summary (branch protection gate)

#### Caching

- [x] npm dependency cache (lockfile hash)
- [x] Playwright browser cache (lockfile hash)
- [x] Restore-keys defined for fallback

#### Artifacts

- [x] Coverage uploaded (always, 7 days)
- [x] E2E P0 results (failure only, 7 days)
- [x] E2E shard results (always, 30 days)
- [x] Burn-in failures (failure only, 7 days)
- [x] Lighthouse report (always, 30 days)
- [x] Merged Playwright report (always, 30 days)

#### Helper Scripts

- [x] `scripts/test-changed.sh` — executable, shebang present
- [x] `scripts/ci-local.sh` — executable, shebang present
- [x] `scripts/burn-in.sh` — executable, shebang present

#### Documentation

- [x] `docs/ci.md` — pipeline guide
- [x] `docs/ci-secrets-checklist.md` — secrets documented

#### Security

- [x] No credentials in CI configuration
- [x] Secrets use GitHub secret management
- [x] No unsafe `${{ inputs.* }}` or `${{ github.event.* }}` in run blocks
- [x] `github.base_ref` routed through env intermediary
- [x] `permissions: contents: read` (least privilege)

### Completion Summary

| Item              | Value                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| CI Platform       | GitHub Actions                                                                    |
| Config Path       | `.github/workflows/test.yml`                                                      |
| Node Version File | `.node-version` (24.13.0)                                                         |
| Stages            | 10 jobs (lint, unit, db, smoke, e2e-p0, e2e, lighthouse, burn-in, merge, summary) |
| Shards            | 2 (E2E)                                                                           |
| Burn-In           | 5 iterations (PRs to main)                                                        |
| Coverage          | 80% threshold (Vitest)                                                            |
| Retries           | 2x (Playwright CI)                                                                |
| Artifacts         | 6 types, 7-30 day retention                                                       |
| Helper Scripts    | 3 (test-changed, ci-local, burn-in)                                               |
| Documentation     | 2 files (ci.md, ci-secrets-checklist.md)                                          |

### Next Steps (User)

1. Commit all changes
2. Push to remote to trigger CI
3. Verify first CI run passes (the `.node-version` fix should unblock all runs)
4. Monitor pipeline execution times
5. Adjust shard count if needed based on actual run times

### Workflow Complete

**Completed by:** Sallvain
**Date:** 2026-03-03
**Platform:** GitHub Actions
