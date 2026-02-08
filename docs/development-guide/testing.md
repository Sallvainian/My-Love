# Testing

## Unit Tests (Vitest)

Unit tests use the [happy-dom](https://github.com/nicedayfor/happy-dom) environment and are located in `tests/unit/` and `src/**/*.test.{ts,tsx}`.

```bash
npm run test:unit              # Single run
npm run test:unit:watch        # Watch mode
npm run test:unit:coverage     # With V8 coverage report
```

**Coverage thresholds** (all at 80%): lines, functions, branches, statements.

**TDD enforcement**: The `tdd-guard-vitest` plugin is configured as a Vitest reporter to enforce test-first development practices.

**Path aliases**: Tests can use `@/` to reference `src/` (configured in `vitest.config.ts`).

## E2E Tests (Playwright)

E2E tests run against the actual application with a real Supabase backend. Tests are in `tests/e2e/`.

```bash
npm run test:e2e               # Full run with cleanup
npm run test:e2e:ui            # Interactive UI mode
npm run test:e2e:debug         # Step-through debugging
```

**Configuration highlights** (from `playwright.config.ts`):
- Default browser: Chromium
- Timeouts: 60s test, 15s assertion, 15s action, 30s navigation
- Traces, screenshots, and video captured on failure
- Dev server auto-started via `dotenvx run -- npx vite`
- Reports: HTML (`playwright-report/`), JUnit (`test-results/junit.xml`), and list

**Merged fixtures**: Tests use composed fixtures from `tests/support/merged-fixtures.ts` for authentication and page setup.

## ATDD (Acceptance Test-Driven Development)

For Epic 2 and beyond, acceptance tests are written before implementation. Each story's acceptance criteria maps to specific E2E test cases.

---
