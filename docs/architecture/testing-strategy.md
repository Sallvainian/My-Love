# Testing Strategy

## Unit and Integration Tests (Vitest)

- **Runner:** Vitest with happy-dom environment
- **Coverage threshold:** 80%
- **Coverage tool:** @vitest/coverage-v8
- **Test libraries:** @testing-library/react, @testing-library/user-event, @testing-library/jest-dom
- **IndexedDB mocking:** fake-indexeddb
- **TDD enforcement:** tdd-guard-vitest

**Test categories:**
- Component tests (rendering, user interaction)
- Hook tests (state management, side effects)
- Service tests (IndexedDB operations, business logic)
- Store slice tests (Zustand state transitions)
- API layer tests (Supabase query validation)
- Utility function tests (pure logic)

## End-to-End Tests (Playwright)

- **Browser:** Chromium
- **Backend:** Real Supabase instance (test environment)
- **Utilities:** @seontechnologies/playwright-utils
- **Scripts:** `test-with-cleanup.sh` wraps test execution with environment cleanup

## ATDD (Acceptance-Test-Driven Development)

Applied for Epic 2 (scripture reading feature):
1. Acceptance criteria defined per story
2. Tests written before implementation
3. Test review workflow with rubric scoring (determinism, isolation, maintainability, coverage, performance)

## Test Execution Commands

```bash
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode
npm run test:unit:coverage     # With coverage report
npm run test:e2e               # Run E2E tests (with cleanup)
npm run test:e2e:ui            # Playwright UI mode
npm run test:e2e:debug         # Debug mode
npm run test:smoke             # Build output validation
npm run test:burn-in           # Reliability burn-in test
npm run test:ci-local          # Full CI pipeline locally
```

---
