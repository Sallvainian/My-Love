# My-Love Test Suite

Production-ready test infrastructure using Playwright with `@seontechnologies/playwright-utils`.

## Quick Start

```bash
# Prerequisites: local Supabase must be running for E2E tests
supabase start

# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/e2e/scripture/scripture-lobby-4.1.spec.ts
```

## Priority Tags

All tests are tagged with priority levels in their name:

- **[P0]** Critical paths — run every commit / PR check
- **[P1]** High priority — run on PR to main
- **[P2]** Medium priority — run nightly
- **[P3]** Low priority — run on-demand

```bash
# Run only P0 tests
npm run test:p0

# Run P0 + P1 tests
npm run test:p1

# Custom grep
npx playwright test --grep "\\[P2\\]"
```

## Directory Structure

```
tests/
├── e2e/                            # End-to-end test files (Playwright)
│   ├── auth/                       # Authentication flows
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   ├── google-oauth.spec.ts
│   │   └── display-name-setup.spec.ts
│   ├── home/                       # Home view
│   │   ├── welcome-splash.spec.ts
│   │   └── error-boundary.spec.ts
│   ├── mood/                       # Mood tracking
│   │   └── mood-tracker.spec.ts
│   ├── navigation/                 # Navigation & routing
│   │   └── routing.spec.ts
│   ├── notes/                      # Love notes messaging
│   │   └── love-notes.spec.ts
│   ├── offline/                    # Offline support
│   │   └── network-status.spec.ts
│   ├── partner/                    # Partner interactions
│   │   └── partner-mood.spec.ts
│   ├── photos/                     # Photo gallery & upload
│   │   ├── photo-gallery.spec.ts
│   │   └── photo-upload.spec.ts
│   ├── scripture/                  # Scripture reading (largest domain)
│   │   ├── scripture-overview.spec.ts
│   │   ├── scripture-session.spec.ts
│   │   ├── scripture-seeding.spec.ts
│   │   ├── scripture-solo-reading.spec.ts
│   │   ├── scripture-stats.spec.ts
│   │   ├── scripture-reflection-2.1.spec.ts
│   │   ├── scripture-reflection-2.2.spec.ts
│   │   ├── scripture-reflection-2.3.spec.ts
│   │   ├── scripture-lobby-4.1.spec.ts
│   │   ├── scripture-lobby-4.1-p2.spec.ts
│   │   ├── scripture-reading-4.2.spec.ts
│   │   ├── scripture-reconnect-4.3.spec.ts
│   │   ├── scripture-accessibility.spec.ts
│   │   └── scripture-rls-security.spec.ts
│   └── example.spec.ts             # Smoke test
├── api/                            # API-level tests (separate Playwright project)
│   ├── scripture-lobby-4.1.spec.ts
│   └── scripture-reflection-api.spec.ts
├── unit/                           # Unit tests (Vitest + happy-dom)
│   ├── data/
│   │   └── scriptureSteps.test.ts
│   ├── hooks/
│   │   ├── useAutoSave.test.ts
│   │   ├── useScriptureBroadcast.test.ts
│   │   ├── useScriptureBroadcast.reconnect.test.ts
│   │   ├── useScripturePresence.test.ts
│   │   └── useScripturePresence.reconnect.test.ts
│   ├── services/
│   │   ├── dbSchema.test.ts
│   │   ├── dbSchema.indexes.test.ts
│   │   ├── scriptureReadingService.cache.test.ts
│   │   ├── scriptureReadingService.crud.test.ts
│   │   ├── scriptureReadingService.service.test.ts
│   │   └── scriptureReadingService.stats.test.ts
│   ├── stores/
│   │   ├── scriptureReadingSlice.test.ts
│   │   ├── scriptureReadingSlice.lobby.test.ts
│   │   ├── scriptureReadingSlice.lockin.test.ts
│   │   ├── scriptureReadingSlice.reconnect.test.ts
│   │   ├── scriptureReadingSlice.stats.test.ts
│   │   └── settingsSlice.initializeApp.test.ts
│   ├── utils/
│   │   ├── dateFormat.test.ts
│   │   └── moodGrouping.test.ts
│   └── validation/
│       └── schemas.test.ts
├── support/                        # Test infrastructure
│   ├── merged-fixtures.ts          # Main entry — import { test, expect } from here
│   ├── auth-setup.ts               # Worker pool auth setup (runs once before all tests)
│   ├── fixtures/
│   │   ├── index.ts                # Custom fixtures (supabaseAdmin, testSession)
│   │   ├── worker-auth.ts          # Worker-isolated auth with partner support
│   │   ├── together-mode.ts        # Together mode lifecycle (seed → link → navigate → cleanup)
│   │   └── scripture-navigation.ts # High-level scripture flow navigation
│   ├── factories/
│   │   └── index.ts                # Data factories (createTestSession, linkTestPartners, cleanup)
│   ├── helpers/
│   │   ├── index.ts                # Generic utilities (waitFor, getTestId, expectToast, retry)
│   │   ├── supabase.ts             # Supabase admin client, token acquisition
│   │   └── scripture-lobby.ts      # Together mode lobby navigation helpers
│   └── helpers.ts                  # Scripture flow helpers (startSoloSession, advanceOneStep)
├── e2e-archive/                    # Archived/superseded specs
├── setup.ts                        # Vitest setup (browser API mocks)
└── README.md
```

## Architecture

### Fixture Composition Pattern

All E2E tests import from `merged-fixtures.ts` which combines 9 fixtures via `mergeTests`:

**playwright-utils fixtures:**

- `apiRequest` — Typed HTTP client with schema validation
- `recurse` — Polling for async operations
- `log` — Playwright report-integrated logging
- `interceptNetworkCall` — Network spy/stub for UI tests
- `networkErrorMonitor` — Automatic HTTP 4xx/5xx detection (with Supabase noise exclusions)

**Custom project fixtures:**

- `supabaseAdmin` — Admin client with service role key for test data manipulation
- `testSession` — Pre-seeded scripture sessions with auto-cleanup
- `workerAuth` — Worker-isolated storage state paths (primary + partner)
- `scriptureNav` — High-level scripture flow methods (ensureOverview, startSoloSession, advanceOneStep)
- `togetherMode` — Full together-mode lifecycle: seed → link partners → navigate both users → cleanup

### Worker-Isolated Auth

Tests run in parallel with worker-scoped auth isolation:

- Auth setup creates a pool of test user pairs (primary + partner) sized to CPU count
- Each Playwright worker gets its own authenticated storage state
- Partners are pre-linked for together-mode tests
- Pool size is configurable via `PLAYWRIGHT_AUTH_POOL_SIZE` env var

### Data Factories

Test data is created via Supabase RPCs, not UI interactions:

```typescript
// Create test sessions with specific presets
const result = await createTestSession(supabase, {
  sessionCount: 2,
  preset: 'mid_session',
  includeReflections: true,
});

// Cleanup respects FK constraints (messages → reflections → bookmarks → step_states → sessions)
await cleanupTestSession(supabase, result.session_ids);
```

### Example Test

```typescript
import { test, expect } from '../support/merged-fixtures';

test('[P0] user can start solo scripture session', async ({ page, log }) => {
  await log.step('Navigate to scripture overview');
  await page.goto('/scripture?fresh=true');
  await expect(page.getByTestId('scripture-start-button')).toBeVisible();

  await log.step('Start solo session');
  await page.getByTestId('scripture-start-button').click();
  await page.getByTestId('scripture-mode-solo').click();

  await log.step('Verify reading flow');
  await expect(page.getByTestId('solo-reading-flow')).toBeVisible();
});
```

## Configuration

### Environment Variables

E2E tests auto-load local Supabase connection details from `supabase status`. No manual env setup needed for local development.

For CI or custom environments, set:

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<anon-key>
BASE_URL=http://localhost:5173
```

### Playwright Config

See `playwright.config.ts` for full configuration:

- **Timeouts**: action 15s, navigation 30s, test 60s
- **Artifacts**: trace, screenshot, and video always captured
- **Browser**: Chromium (Firefox/WebKit available but commented out)
- **Reporter**: HTML + JUnit + list
- **Dev Server**: Auto-starts via `npx vite --mode test`
- **Projects**: `setup` (auth) → `chromium` (E2E) + `api` (API tests)

## Best Practices

### Selector Strategy

Use `data-testid` attributes for stability:

```tsx
// Component
<button data-testid="submit-button">Submit</button>

// Test — prefer getByTestId over CSS selectors
await page.getByTestId('submit-button').click();
```

### Test Isolation

Each test should:

1. Create its own data via factories/RPCs (not UI)
2. Clean up after itself (fixtures handle this automatically)
3. Not depend on other tests' state
4. Use worker-isolated auth (via `workerAuth` fixture)

### Network-First Patterns

Wait for API responses before asserting UI state:

```typescript
const responsePromise = page.waitForResponse(
  (resp) => resp.url().includes('/rest/v1/rpc/my_endpoint') && resp.status() === 200
);
await page.getByTestId('submit-button').click();
await responsePromise;
await expect(page.getByTestId('success-message')).toBeVisible();
```

### Logging

Use `log.step()` for clear test reports:

```typescript
test('user flow', async ({ page, log }) => {
  await log.step('Setup: Create test data');
  await log.step('Action: Navigate to dashboard');
  await log.step('Assert: Dashboard visible');
});
```

## CI Integration

Tests run in GitHub Actions with:

- Single worker (`workers: 1` in CI)
- Retries enabled (`retries: 2` in CI)
- JUnit report for CI integration
- HTML report for debugging
- Secrets injected via dotenvx

## Debugging

### Trace Viewer

All tests generate trace files (always-on):

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

## All Test Commands

```bash
# E2E tests (Playwright — requires local Supabase)
npm run test:e2e               # All E2E tests (with cleanup wrapper)
npm run test:e2e:raw           # Playwright directly
npm run test:e2e:ui            # UI mode
npm run test:e2e:debug         # Debug mode
npm run test:p0                # Priority 0 only
npm run test:p1                # Priority 0 + 1

# Unit tests (Vitest + happy-dom)
npm run test:unit              # Run all
npm run test:unit:watch        # Watch mode
npm run test:unit:ui           # Vitest UI
npm run test:unit:coverage     # With coverage (80% threshold)

# Database tests (pgTAP)
npm run test:db

# Other
npm run test:smoke             # Post-build verification
npm run test:burn-in           # Flakiness detection
npm run test:ci-local          # Simulate CI locally
```

## Knowledge Base References

- `_bmad/tea/testarch/knowledge/overview.md` — Playwright utils overview
- `_bmad/tea/testarch/knowledge/fixtures-composition.md` — mergeTests patterns
- `_bmad/tea/testarch/knowledge/data-factories.md` — Test data factories
- `_bmad/tea/testarch/knowledge/network-first.md` — Network testing patterns
- `_bmad/tea/testarch/knowledge/auth-session.md` — Auth session management
- `_bmad/tea/testarch/knowledge/network-error-monitor.md` — HTTP error detection
