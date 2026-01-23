---
paths:
  - "src/**/__tests__/**/*.ts"
  - "tests/**/*.ts"
  - "e2e/**/*.ts"
---

# Testing Standards (BMAD TestArch)

## Quality Checklist (Every Test Must Pass)
- [ ] **No Hard Waits** - Use `waitForResponse`, element state checks (not `waitForTimeout`)
- [ ] **No Conditionals** - Tests execute same path every time (no if/else for flow control)
- [ ] **< 300 Lines** - Keep tests focused; split large tests or extract setup to fixtures
- [ ] **< 1.5 Minutes** - Optimize with API setup, parallel operations, shared auth
- [ ] **Self-Cleaning** - Use fixtures with auto-cleanup or explicit `afterEach()` teardown
- [ ] **Explicit Assertions** - Keep `expect()` in test bodies, not hidden in helpers
- [ ] **Unique Data** - Use `faker` for dynamic data; never hardcode IDs or emails
- [ ] **Parallel-Safe** - Tests don't share state; run successfully with `--workers=4`

## Selector Hierarchy (Priority Order)
1. `data-testid` (BEST) - Survives all UI changes
2. ARIA roles (`getByRole`, `getByLabel`) - Enforces accessibility
3. Text content (`getByText`) - User-centric but breaks with copy changes
4. CSS/IDs (LAST RESORT) - Only when no alternative exists

## E2E (Playwright with @seontechnologies/playwright-utils)
- Network-first: Intercept BEFORE navigate with `waitForResponse`
- Use API for data setup (10-50x faster than UI navigation)
- Reuse auth sessions via `storageState.json`
- `filter()` over `nth()` for lists (content-based, not index-based)

## Unit (Vitest)
- happy-dom environment with fake-indexeddb/auto
- Mock Supabase client module, not individual functions
- Store exposed as `window.__APP_STORE__` in non-prod for E2E testing

## Running Tests
```bash
npm run test:unit          # All unit tests
npm run test:e2e           # All E2E tests
npm run test:e2e:debug     # E2E with UI debugger
npx vitest run path/to/test.ts  # Single test file
```
