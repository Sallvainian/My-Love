---
title: 'Sprint 0 CI Pipeline'
slug: 'sprint-0-ci-pipeline'
created: '2026-01-28'
status: 'completed'
stepsCompleted: [1, 2, 3]
part: '2 of 3'
parent_spec: 'Sprint 0 Test Infrastructure'
depends_on: 'tech-spec-01-backend-infrastructure'
tech_stack:
  - GitHub Actions
  - Supabase CLI
  - Docker
  - Playwright 1.57.0
files_to_modify:
  - .github/workflows/test.yml (MODIFY)
code_patterns:
  - GitHub Actions job dependencies
  - Supabase Local lifecycle
  - dotenvx for encrypted env vars
---

# Tech-Spec: Sprint 0 CI Pipeline (Part 2 of 3)

**Created:** 2026-01-28
**Depends On:** Part 1 (Backend Infrastructure) - migration file must exist
**Blocks:** Part 3 (Test Factories) - needs CI environment for testing

## Overview

### Problem Statement

- **R-002 (Score 6)**: No Supabase Local in CI — E2E tests have no database to run against

### Solution

Add Supabase Local lifecycle to GitHub Actions CI pipeline:

1. Add new `supabase-setup` job that starts Supabase Local
2. Configure e2e-tests job to depend on and use Supabase Local
3. Add proper teardown to clean up containers

### Scope

**In Scope:**
- Supabase Local CI lifecycle (start → reset → test → stop)
- Job dependencies and output passing
- Environment variable configuration for tests
- Cleanup on success or failure

**Out of Scope:**
- Supabase migration file (Part 1)
- Test factories and fixtures (Part 3)
- P0 test implementation

## Context for Development

### Codebase Patterns

**Current CI Structure:**
- `.github/workflows/test.yml` contains lint job and e2e-tests job
- Uses `dotenvx` for encrypted environment variables
- Playwright is configured but needs database backend

**Supabase Local in CI:**
- Requires Docker (available on ubuntu-latest)
- Uses `supabase/setup-cli@v1` action
- Outputs API URL and anon key for test configuration
- Must be stopped after tests complete

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `.github/workflows/test.yml` | CI pipeline to modify |
| `supabase/config.toml` | Supabase Local config |
| `supabase/migrations/` | Migrations to apply |

### Technical Decisions

**TD-4: CI Supabase Lifecycle**
- Order: start → reset → test → stop
- Add as new job that runs before e2e-tests
- Pass credentials via job outputs

## Implementation Plan

### Tasks

#### Track 3: CI Pipeline (DevOps)

- [x] **Task 3.1: Add Supabase Local job to test.yml**
  - File: `.github/workflows/test.yml`
  - Action: Add new job `supabase-setup` that runs before `e2e-tests`
  - Details:
    ```yaml
    supabase-setup:
      name: Supabase Local Setup
      runs-on: ubuntu-latest
      timeout-minutes: 10
      outputs:
        supabase_url: ${{ steps.supabase.outputs.url }}
        supabase_anon_key: ${{ steps.supabase.outputs.anon_key }}
      steps:
        - name: Checkout code
          uses: actions/checkout@v4

        - name: Setup Supabase CLI
          uses: supabase/setup-cli@v1
          with:
            version: latest

        - name: Start Supabase Local
          id: supabase
          run: |
            supabase start
            echo "url=$(supabase status --output json | jq -r '.API_URL')" >> $GITHUB_OUTPUT
            echo "anon_key=$(supabase status --output json | jq -r '.ANON_KEY')" >> $GITHUB_OUTPUT

        - name: Run migrations
          run: supabase db reset
    ```

- [x] **Task 3.2: Update e2e-tests job to use Supabase Local**
  - File: `.github/workflows/test.yml`
  - Action: Modify `e2e-tests` job to depend on `supabase-setup` and use its outputs
  - Details:
    - Add `needs: [lint, supabase-setup]`
    - Add environment variables:
      ```yaml
      env:
        SUPABASE_URL: ${{ needs.supabase-setup.outputs.supabase_url }}
        SUPABASE_ANON_KEY: ${{ needs.supabase-setup.outputs.supabase_anon_key }}
      ```
    - Ensure Supabase services are available for the test run

- [x] **Task 3.3: Add Supabase teardown step**
  - File: `.github/workflows/test.yml`
  - Action: Add cleanup step in e2e-tests job
  - Details:
    ```yaml
    - name: Stop Supabase Local
      if: always()
      run: supabase stop
    ```

### Acceptance Criteria

#### AC-4: CI Pipeline Runs With Supabase Local
- [x] **AC-4.1**: Given a PR to main branch, when the test workflow runs, then Supabase Local starts successfully within 60 seconds
- [x] **AC-4.2**: Given Supabase Local is running, when `supabase db reset` executes, then all migrations apply without error
- [x] **AC-4.3**: Given migrations have run, when Playwright tests execute, then they can connect to the local Supabase instance
- [x] **AC-4.4**: Given the test job completes (pass or fail), when cleanup runs, then `supabase stop` executes and containers are removed

## Dependencies

**Depends On:**
- Part 1 must be complete (migration file exists at `supabase/migrations/20260128000001_scripture_reading.sql`)

**Sequential Dependencies within this spec:**
1. Task 3.1 (supabase-setup job) → Task 3.2 (e2e integration) → Task 3.3 (teardown)

**External Dependencies:**
- GitHub Actions ubuntu-latest runner with Docker
- `supabase/setup-cli@v1` action
- `DOTENV_PRIVATE_KEY` GitHub secret

## Testing Strategy

**Validation:**
1. Push a branch to trigger CI workflow
2. Verify Supabase Local starts successfully in logs
3. Verify migrations apply without error
4. Verify e2e-tests job receives Supabase credentials
5. Verify cleanup runs even if tests fail

**Expected CI Log Outputs:**
- "Supabase Local started successfully"
- "Applying migrations..."
- "supabase stop" in cleanup step

## Notes

**Risk Mitigations:**
- **R-002 (CI Supabase)**: Solved by Tasks 3.1-3.3

**Known Limitations:**
- Supabase Local adds ~60s to CI pipeline startup
- Docker layer caching not fully utilized on first run

**Performance Considerations:**
- Consider caching Supabase Docker images in future optimization
- Current timeout of 10 minutes should be sufficient

## Review Notes

- Adversarial review completed: 2026-01-28
- Findings: 15 total, 6 real issues identified
- Resolution approach: Walk-through (all 6 fixed)
- Fixes applied:
  - F1: Pinned Supabase CLI to v2.72.7
  - F2: Added timeout and health check on supabase start
  - F3: Reordered steps (npm ci before Supabase setup)
  - F5: Added SERVICE_ROLE_KEY export
  - F9: Changed jq -r to jq -re for null safety
  - F13: Added Supabase connectivity verification
