---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-03-04'
status: complete
mode: reinitialize # Correcting frontend→fullstack misclassification
detected_stack: fullstack
---

# Step 1: Preflight Checks (Reinitialization)

## Stack Detection

- **Detected stack**: `fullstack`
- Frontend: React 19, Vite 7, TypeScript 5.9, Tailwind CSS v4, Zustand 5
- Backend: Supabase with 21 SQL migrations, RPC functions, RLS policies, pgTAP tests

### Backend Evidence

- 21 migrations in `supabase/migrations/` including:
  - `scripture_rpcs.sql` — RPC functions
  - `scripture_lobby_phase_guards.sql` — server-side business logic
  - `scripture_lock_in.sql`, `scripture_end_session.sql` — session management RPCs
  - `fix_users_rls_recursion.sql` — RLS policy fixes
  - `enable_pgtap.sql` — backend test framework
- `npm run test:db` — pgTAP test suite via `supabase test db`
- `tests/api/` — API-level Playwright tests hitting Supabase RPCs directly

## Prerequisites

| Check | Result |
|-------|--------|
| `package.json` exists | PASS |
| Backend manifests | PASS — Supabase project with migrations + RPCs |
| Existing E2E framework | EXISTS — reinitializing (override) |

## Existing Framework Inventory

- `@playwright/test@^1.58.2`
- `@seontechnologies/playwright-utils@^3.14.0` (enhanced fixtures)
- `@axe-core/playwright@^4.11.1` (accessibility)
- `vitest@^4.0.17` + `happy-dom@^20.7.0` (unit tests)
- `@testing-library/react@^16.3.2` (component testing)
- `@vitest/coverage-v8@^4.0.18` (coverage)
- pgTAP via `supabase test db` (backend)

## Reinitialization Reasons

1. `detected_stack` was `frontend` — should be `fullstack`
2. Missing `tests/integration/` directory — downstream workflows expect it for fullstack
3. E2E subagent templates use bare `@playwright/test` imports — should use `merged-fixtures.ts`
4. Knowledge fragment loading incomplete — `network-first.md` and backend patterns not loaded
5. Traceability matrix has no integration tier coverage

# Step 2: Framework Selection

## Decision: Playwright + pgTAP (confirmed for fullstack)

### Browser Testing: Playwright

Already installed as `@playwright/test@^1.58.2`. Correct choice:

- Complex repo with 80+ test files and multi-project config
- Heavy API + UI integration (Supabase backend)
- Worker-based parallel auth (10 workers)
- Enhanced with `@seontechnologies/playwright-utils` and `@axe-core/playwright`

### Backend Testing: pgTAP

Already configured via `supabase test db`. Tests RPC functions, RLS policies, and schema constraints at the database level.

### Integration Testing: NEW — Playwright API project

`tests/integration/` directory needed for Supabase RPC logic tests that:
- Don't need a browser (no UI)
- Go beyond unit tests (hit real Supabase local instance)
- Test RPC business logic, data flow, and cross-table operations
- Fill the gap between pgTAP (SQL-level) and E2E (browser-level)

No framework change needed — Playwright's API testing project handles this.

# Step 3: Scaffold Framework (Reinitialization)

## Execution Mode
- Resolved: `sequential` (targeted reinitialization, not greenfield)

## 1. Directory Structure

| Directory | Status | Action |
|-----------|--------|--------|
| `tests/e2e/` | PASS | No change |
| `tests/unit/` | PASS | No change |
| `tests/api/` | PASS | No change |
| `tests/support/fixtures/` | PASS | No change |
| `tests/support/helpers/` | PASS | No change |
| `tests/support/factories/` | PASS | No change |
| `tests/integration/` | **CREATED** | New directory for RPC integration tests |

## 2. Framework Config — UPDATED

Added `integration` project to `playwright.config.ts`:
```typescript
{
  name: 'integration',
  testDir: './tests/integration',
},
```
No browser needed — uses `supabaseAdmin` and `apiRequest` fixtures only.

## 3. Environment Setup — PASS (no changes needed)

- `.env.test` with local Supabase values
- `supabase status` auto-loading in `playwright.config.ts`
- Node 24 via `.nvmrc`

## 4. Fixtures & Factories — PASS (no changes needed)

- `merged-fixtures.ts`: 9 fixtures via `mergeTests` — correct for all project types
- Integration tests import from `../support/merged-fixtures` (NOT bare `@playwright/test`)
- `supabaseAdmin`, `apiRequest`, `recurse` fixtures work without browser context
- RPC-based factories with FK-ordered cleanup

## 5. Sample Tests — CREATED

Created `tests/integration/example-rpc.spec.ts` demonstrating:
- Import from `../support/merged-fixtures`
- `supabaseAdmin` fixture for direct RPC calls
- Given/When/Then format
- FK-ordered cleanup in `finally` blocks
- No browser context

## Knowledge Fragments Applied

Fragments loaded for `fullstack` + `playwright-utils: true`:
- `overview.md` — Playwright Utils design principles
- `fixtures-composition.md` — mergeTests patterns
- `auth-session.md` — Token persistence
- `api-request.md` — Typed HTTP client
- `burn-in.md` — CI optimization (previously loaded)
- `network-error-monitor.md` — HTTP error detection
- `data-factories.md` — Factory patterns with overrides
- **`test-levels-framework.md`** — NEW (fullstack): unit/integration/E2E selection
- **`network-first.md`** — NEW (was skipped for frontend-only)
- **`api-testing-patterns.md`** — NEW (fullstack): pure API testing without browser

## Changes Summary

| File | Action |
|------|--------|
| `playwright.config.ts` | Added `integration` project |
| `tests/integration/example-rpc.spec.ts` | Created sample integration test |
| `_bmad-output/test-artifacts/framework-setup-progress.md` | Updated with fullstack classification |

# Step 4: Documentation & Scripts

## 1. tests/README.md — UPDATED

- Header updated to reflect fullstack stack classification
- Added `tests/integration/` to directory tree
- Updated fixture composition note (all test types, not just E2E)
- Updated projects line to include `integration`
- Added `test:integration` to commands section
- Added **Test Levels** table (Unit → Integration → API → E2E → Database)
- Added `test-levels-framework.md` and `api-testing-patterns.md` to knowledge references

## 2. Build & Test Scripts — UPDATED

Added `"test:integration": "playwright test --project=integration"` to package.json.

# Step 5: Validate & Summarize

## Validation Result: 67 PASS / 7 SKIP / 1 INFO / 0 FAIL

All checklist items pass or are intentionally skipped:
- SKIP: page-objects (not needed), .env.example (auto-loads from supabase), .nvmrc (uses .mise.toml), troubleshooting (covered by debugging section), faker in factories (uses RPC seeding)
- INFO: artifacts always-on (deliberate choice)

## Reinitialization Corrections

| What | Before | After |
|------|--------|-------|
| `detected_stack` | `frontend` | `fullstack` |
| `tests/integration/` | Missing | Created with sample test |
| Playwright projects | `chromium` + `api` | `chromium` + `api` + `integration` |
| `test:integration` script | Missing | Added to package.json |
| Knowledge fragments | 7 loaded | 10 loaded |
| README test levels | Not documented | Full table |

## Downstream Impact

With `detected_stack: fullstack`, downstream workflows will now:
1. **automate**: Dispatch backend subagent (previously skipped for frontend)
2. **atdd**: Load backend knowledge fragments (test-levels, api-testing-patterns)
3. **trace**: Map integration tier in traceability matrix (previously gap)
4. **E2E subagents**: Should import from `merged-fixtures.ts` (template fix needed at workflow level, not framework level)

## Completion Summary

- **Framework**: Playwright @playwright/test@^1.58.2 + @seontechnologies/playwright-utils@^3.14.0 + pgTAP
- **Mode**: Reinitialization (correcting frontend→fullstack misclassification)
- **Files modified**: playwright.config.ts, package.json, tests/README.md
- **Files created**: tests/integration/example-rpc.spec.ts
- **Knowledge fragments applied**: overview, fixtures-composition, auth-session, api-request, burn-in, network-error-monitor, data-factories, test-levels-framework, network-first, api-testing-patterns

**Completed by:** Claude (TEA Test Architect)
**Date:** 2026-03-04
**Framework:** Playwright + pgTAP (fullstack)
