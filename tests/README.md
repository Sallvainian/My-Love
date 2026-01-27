# My-Love Test Suite

Production-ready test infrastructure using Playwright with `@seontechnologies/playwright-utils`.

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/e2e/example.spec.ts
```

## Directory Structure

```
tests/
├── e2e/                      # End-to-end test files
│   └── example.spec.ts       # Example tests (delete after adding real tests)
├── support/                  # Test infrastructure
│   ├── merged-fixtures.ts    # ⭐ Main entry point - import { test, expect } from here
│   ├── fixtures/             # Custom project fixtures
│   │   └── index.ts
│   └── helpers/              # Pure utility functions
│       └── index.ts
├── setup.ts                  # Vitest setup (for unit tests)
└── README.md                 # This file
```

## Architecture

### Fixture Composition Pattern

All tests import from `merged-fixtures.ts` which combines:

1. **playwright-utils fixtures** (production-ready utilities):
   - `apiRequest` - Typed HTTP client with schema validation
   - `authToken`/`authOptions` - Token persistence and multi-user auth
   - `recurse` - Polling for async operations
   - `log` - Playwright report-integrated logging
   - `networkErrorMonitor` - Automatic HTTP 4xx/5xx detection

2. **Custom project fixtures** (`fixtures/index.ts`):
   - Add your project-specific fixtures here
   - Follow the pattern: pure function → fixture wrapper

### Example Test

```typescript
import { test, expect } from '../support/merged-fixtures';

test('user can login', async ({ page, log, apiRequest }) => {
  await log.step('Navigate to login');
  await page.goto('/login');

  await log.step('Fill credentials');
  await page.fill('[data-testid="email"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-button"]');

  await log.step('Verify dashboard');
  await expect(page).toHaveURL('/dashboard');
});
```

## Configuration

### Environment Variables

Copy `.env.example` and configure test credentials:

```bash
# E2E Testing Configuration
BASE_URL=http://localhost:5173
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-key
```

### Playwright Config

See `playwright.config.ts` for full configuration:

- **Timeouts**: action 15s, navigation 30s, test 60s
- **Artifacts**: Screenshots, videos, traces on failure only
- **Browser**: Chromium by default (cross-browser available)
- **Dev Server**: Auto-starts via `npm run dev:raw`

## Best Practices

### Selector Strategy

Use `data-testid` attributes:

```tsx
// Component
<button data-testid="submit-button">Submit</button>

// Test
await page.click('[data-testid="submit-button"]');
```

### Test Isolation

Each test should:
1. Create its own data (via API, not UI)
2. Clean up after itself
3. Not depend on other tests

### Logging

Use `log.step()` for clear test reports:

```typescript
test('user flow', async ({ page, log }) => {
  await log.step('Setup: Create user');
  await log.step('Action: Navigate to dashboard');
  await log.step('Assert: Dashboard visible');
});
```

### Network Monitoring

Detect silent API errors:

```typescript
test('page load', async ({ page, networkErrorMonitor }) => {
  await networkErrorMonitor.start(page);
  await page.goto('/dashboard');

  const errors = networkErrorMonitor.getErrors();
  expect(errors).toHaveLength(0);
});
```

## CI Integration

Tests run in GitHub Actions with:
- Single worker (`workers: 1` in CI)
- Retries enabled (`retries: 2` in CI)
- JUnit report for CI integration
- HTML report for debugging

### Running in CI

```yaml
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    CI: true
    BASE_URL: http://localhost:5173
```

## Debugging

### Trace Viewer

Failed tests generate trace files:

```bash
npx playwright show-trace test-results/*/trace.zip
```

### UI Mode

Interactive test debugging:

```bash
npm run test:e2e:ui
```

### Headed Mode

Watch tests run in browser:

```bash
npx playwright test --headed
```

## Knowledge Base References

- `_bmad/bmm/testarch/knowledge/overview.md` - Playwright utils overview
- `_bmad/bmm/testarch/knowledge/fixtures-composition.md` - mergeTests patterns
- `_bmad/bmm/testarch/knowledge/data-factories.md` - Test data factories
- `_bmad/bmm/testarch/knowledge/network-first.md` - Network testing patterns

## Related Commands

```bash
# Unit tests (Vitest)
npm run test:unit
npm run test:unit:watch
npm run test:unit:coverage

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
```
