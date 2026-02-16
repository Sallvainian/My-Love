# Testing Strategy

## Test Frameworks

| Layer | Framework | Config |
|---|---|---|
| **Unit / Integration** | Vitest 4.0 | `vitest.config.ts` |
| **E2E** | Playwright 1.58 | `playwright.config.ts` |
| **Smoke** | Node.js script | `scripts/smoke-tests.cjs` |
| **Database** | Supabase CLI | `supabase test db` |
| **Accessibility** | `@axe-core/playwright` | In E2E tests |

## Unit and Integration Tests (Vitest)

### Environment

Tests run in `happy-dom` for DOM simulation with `fake-indexeddb` for IndexedDB mocking.

### Key Libraries

| Library | Purpose |
|---|---|
| `@testing-library/react` | Component rendering and queries |
| `@testing-library/user-event` | User interaction simulation |
| `@testing-library/jest-dom` | DOM assertion matchers |
| `fake-indexeddb` | IndexedDB implementation for tests |
| `@vitest/coverage-v8` | Code coverage reporting |
| `tdd-guard-vitest` | TDD workflow enforcement |

### npm Scripts

```bash
npm run test:unit           # vitest run (single pass)
npm run test:unit:watch     # vitest (watch mode)
npm run test:unit:ui        # vitest --ui (browser UI)
npm run test:unit:coverage  # vitest run --coverage
```

### Test Organization

Tests are co-located with source code using `__tests__/` directories:

```
src/api/auth/__tests__/     # Auth service tests
src/stores/slices/__tests__/ # Store slice tests
src/components/**/__tests__/ # Component tests
```

## E2E Tests (Playwright)

### Setup

```bash
npm run test:e2e           # ./scripts/test-with-cleanup.sh
npm run test:e2e:raw       # playwright test
npm run test:e2e:ui        # playwright test --ui
npm run test:e2e:debug     # playwright test --debug
```

### Priority-Based Test Selection

Tests use priority tags for selective execution:

```bash
npm run test:p0    # playwright test --grep '\[P0\]'
npm run test:p1    # playwright test --grep '\[P0\]|\[P1\]'
```

### Store Access in E2E Tests

The Zustand store is exposed for E2E test manipulation:

```typescript
// In useAppStore.ts
declare global {
  interface Window {
    __APP_STORE__?: typeof useAppStore;
  }
}

if (typeof window !== 'undefined') {
  window.__APP_STORE__ = useAppStore;
}
```

Playwright tests can read/write state directly via `page.evaluate()`.

### Accessibility Testing

`@axe-core/playwright` integrates with Playwright for automated accessibility checks:

```typescript
import { injectAxe, checkA11y } from '@axe-core/playwright';

test('page is accessible', async ({ page }) => {
  await injectAxe(page);
  await checkA11y(page);
});
```

### Burn-In Testing

```bash
npm run test:burn-in    # bash scripts/burn-in.sh
```

Runs test suites multiple times to catch flaky tests.

## Smoke Tests

```bash
npm run test:smoke    # node scripts/smoke-tests.cjs
```

Post-build validation that checks the `dist/` output for expected files, manifest correctness, and basic structure.

## Database Tests

```bash
npm run test:db    # supabase test db
```

Tests RLS policies and database functions using the Supabase CLI's built-in test runner.

## CI/CD Testing

### Local CI Simulation

```bash
npm run test:ci-local    # bash scripts/ci-local.sh
```

Runs the full CI pipeline locally (typecheck, lint, unit tests, build, smoke tests).

### CI Pipeline Order

1. `npm run typecheck` -- TypeScript compilation check
2. `npm run lint` -- ESLint
3. `npm run test:unit` -- Vitest unit tests
4. `npm run build` -- Production build
5. `npm run test:smoke` -- Build output validation
6. `npm run test:e2e` -- Playwright E2E tests (against built output)

## Cleanup Scripts

Both `dev` and `test:e2e` use wrapper scripts that clean up stale processes:

```bash
npm run dev          # ./scripts/dev-with-cleanup.sh
npm run test:e2e     # ./scripts/test-with-cleanup.sh
```

These scripts handle killing orphaned Vite dev servers and browser instances from previous runs.

## Code Quality Tools

| Tool | Purpose | Script |
|---|---|---|
| ESLint 9 | Linting with React hooks and refresh plugins | `npm run lint` |
| Prettier 3.8 | Code formatting with Tailwind CSS plugin | `npm run format` |
| TypeScript 5.9 | Type checking | `npm run typecheck` |
| `vite-plugin-checker` | In-dev type checking overlay | Built into dev server |
