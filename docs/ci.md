# CI/CD Pipeline Guide

## Overview

The test pipeline runs on **GitHub Actions** via `.github/workflows/test.yml`. It validates code quality, runs unit/E2E/database tests, checks performance, and detects flaky tests before merge.

## Pipeline Stages

```
push/PR → lint ──────────┬──→ e2e-p0 → e2e-tests (2 shards) → burn-in (PRs to main)
                         ├──→ smoke-tests                          ↓
                         └──→ lighthouse                     merge-reports
         unit-tests ─────┤
         db-tests ───────┘──────────────────────────→ test-summary (gate)
```

| Stage | Job | Timeout | Trigger | Purpose |
|-------|-----|---------|---------|---------|
| 1 | `lint` | 5 min | All | ESLint, TypeScript, Prettier, npm audit |
| 2 | `unit-tests` | 10 min | All | Vitest with 80% coverage thresholds |
| 3a | `db-tests` | 10 min | All | pgTAP via local Supabase |
| 3b | `smoke-tests` | 5 min | All | Post-build verification |
| 4a | `e2e-p0` | 15 min | All | P0-tagged Playwright tests (fast gate) |
| 4b | `e2e-tests` | 30 min | All | Full Playwright, 2 shards |
| 4c | `lighthouse` | 10 min | All | Performance regression (advisory) |
| 5 | `burn-in` | 30 min | PRs to main | Changed specs run 5x for flakiness |
| 6 | `merge-reports` | — | Always | Combine shard HTML reports |
| 7 | `test-summary` | — | Always | Branch protection gate |

## Node Version

Node version is pinned in `.node-version` (currently 24.13.0). This file is read by both `actions/setup-node` in CI and `mise` locally.

## Caching

- **npm dependencies**: Cached by `package-lock.json` hash
- **Playwright browsers**: Cached by `package-lock.json` hash (chromium only)

## Artifacts

| Artifact | Condition | Retention |
|----------|-----------|-----------|
| `unit-test-coverage` | Always | 7 days |
| `e2e-p0-results` | On failure | 7 days |
| `e2e-results-shard-{n}` | Always | 30 days |
| `burn-in-failures` | On failure | 7 days |
| `lighthouse-report` | Always | 30 days |
| `merged-playwright-report` | Always | 30 days |

## Local CI Mirror

Run the full pipeline locally:

```bash
./scripts/ci-local.sh              # Full pipeline
./scripts/ci-local.sh --skip-lint  # Skip lint stage
./scripts/ci-local.sh --skip-unit  # Skip unit tests
```

## Selective Testing

Run only tests affected by your changes:

```bash
./scripts/test-changed.sh          # vs main
./scripts/test-changed.sh develop  # vs develop
```

## Burn-In Testing

Detect flaky tests by running them repeatedly:

```bash
./scripts/burn-in.sh              # All E2E tests, 10 iterations
./scripts/burn-in.sh 5            # 5 iterations
./scripts/burn-in.sh 10 auth      # Auth tests, 10 iterations
```

In CI, burn-in runs automatically on PRs to main with 5 iterations on changed test files only.

## Retry Strategy

- **Test-level**: Playwright retries failed tests 2x in CI (`retries: process.env.CI ? 2 : 0`)
- **Job-level**: No automatic job retry. Re-run failed jobs manually from the Actions tab.

## Troubleshooting

### Tests fail in CI but pass locally

Use `./scripts/ci-local.sh` to mirror the CI environment. Common differences:
- CI runs with `CI=true` (Playwright: `forbidOnly`, single worker)
- CI uses local Supabase started fresh with `db reset`
- CI installs only chromium (`--with-deps chromium`)

### Caching not working

Check the cache key in the Actions tab. Cache keys use `${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}`. If `package-lock.json` changed, the cache is invalidated.

### Burn-in too slow

Reduce iterations in `.github/workflows/test.yml` (currently 5) or limit to specific test files.
