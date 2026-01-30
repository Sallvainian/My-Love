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

## Priority Tags

All tests are tagged with priority levels in their name:

- **[P0]** Critical paths — run every commit / PR check
- **[P1]** High priority — run on PR to main
- **[P2]** Medium priority — run nightly
- **[P3]** Low priority — run on-demand

```bash
# Run only P0 tests
npx playwright test --grep "\\[P0\\]"

# Run P0 + P1 tests
npx playwright test --grep "\\[P0\\]|\\[P1\\]"
```

## Directory Structure

```
tests/
├── e2e/                          # End-to-end test files
│   ├── auth/                     # Authentication flows
│   │   ├── login.spec.ts         # Login flow (P0)
│   │   ├── logout.spec.ts        # Logout flow (P0)
│   │   ├── google-oauth.spec.ts  # Google OAuth (P0)
│   │   └── display-name-setup.spec.ts # Display name setup (P0)
│   ├── navigation/               # Navigation & routing
│   │   ├── bottom-nav.spec.ts    # Bottom navigation tabs (P0)
│   │   └── routing.spec.ts       # URL routing & deep links (P0)
│   ├── home/                     # Home view
│   │   ├── home-view.spec.ts     # Home widgets (P0)
│   │   ├── welcome-splash.spec.ts # Welcome splash (P0)
│   │   └── error-boundary.spec.ts # Error boundary (P0)
│   ├── photos/                   # Photo gallery & upload
│   │   ├── photo-gallery.spec.ts # Gallery display (P0)
│   │   └── photo-upload.spec.ts  # Upload flow (P0)
│   ├── mood/                     # Mood tracking
│   │   └── mood-tracker.spec.ts  # Mood logging & history (P0)
│   ├── partner/                  # Partner interactions
│   │   └── partner-mood.spec.ts  # Partner mood & poke/kiss (P0)
│   ├── notes/                    # Love notes messaging
│   │   └── love-notes.spec.ts    # Send & view messages (P0)
│   ├── scripture/                # Scripture reading
│   │   ├── scripture-overview.spec.ts    # Overview page (P0)
│   │   ├── scripture-session.spec.ts     # Session flow (P0)
│   │   ├── scripture-reflection.spec.ts  # Reflections (P0)
│   │   └── scripture-seeding.spec.ts     # Test data seeding (P0)
│   ├── offline/                  # Offline support
│   │   ├── network-status.spec.ts # Network indicator (P0)
│   │   └── data-sync.spec.ts     # Data sync on reconnect (P0)
│   └── example.spec.ts           # Example/smoke tests
├── unit/                         # Unit tests (Vitest)
│   ├── services/
│   │   ├── dbSchema.test.ts      # IndexedDB schema (P0)
│   │   └── dbSchema.indexes.test.ts # Index integrity (P0)
│   ├── utils/
│   │   ├── dateFormat.test.ts    # Date formatting (P0)
│   │   └── moodGrouping.test.ts  # Mood grouping (P0)
│   └── validation/
│       └── schemas.test.ts       # Zod schemas (P0)
├── support/                      # Test infrastructure
│   ├── merged-fixtures.ts        # Main entry — import { test, expect } from here
│   ├── fixtures/index.ts         # Custom fixtures (supabaseAdmin, testSession)
│   ├── factories/index.ts        # Data factories (createTestSession, cleanupTestSession)
│   └── helpers/index.ts          # Utility functions (waitFor, generateTestEmail)
├── setup.ts                      # Vitest setup (for unit tests)
└── README.md                     # This file
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
