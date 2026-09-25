# My-Love Test Suite

Production-ready **fullstack** test infrastructure using Playwright with `@seontechnologies/playwright-utils`.

**Stack**: React 19 + Vite 8 + Supabase (39 migrations, RPCs, RLS policies, pgTAP)

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
npx playwright test tests/e2e/navigation/tray.spec.ts
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
│   ├── account-data/
│   ├── auth/                       # Authentication flows
│   ├── errors/
│   ├── home/                       # Home view, events dashboard
│   ├── mood/
│   ├── navigation/                 # Tray + routing
│   ├── notes/                      # Love notes
│   ├── offline/
│   ├── partner/                    # Partner mood + interactions
│   ├── photos/
│   └── settings/                   # Events CRUD and related
├── api/                            # API-level tests (separate Playwright project)
│   ├── events-wire-contract.spec.ts
│   ├── couple-broadcast-authorization.spec.ts
│   └── …                          # 16 live specs
├── integration/                    # Integration tests — no browser
│   ├── example-rpc.spec.ts         # Admin-client events seed/cleanup
│   └── claude-bot-config-forward-migration.spec.ts
├── unit/                           # Unit tests (Vitest + happy-dom)
│   ├── api/
│   ├── helpers/
│   ├── hooks/
│   ├── services/
│   ├── stores/
│   ├── utils/
│   └── validation/
├── support/                        # Test infrastructure
│   ├── merged-fixtures.ts          # Main entry — import { test, expect } from here
│   ├── fixtures/
│   │   ├── index.ts                # Custom fixtures (supabaseAdmin, supabaseAsUser, coupleEvents)
│   │   ├── auth.ts                 # Worker-isolated auth with partner identity
│   │   └── events-refresh-control.ts
│   ├── factories/
│   │   ├── index.ts                # TypedSupabaseClient export
│   │   └── events.ts               # resolveWorkerPairIds, seedEvents, clearPairEvents
│   └── helpers/
│       ├── navigation.ts           # Tray destinations (six views)
│       ├── events.ts               # Single-row event helpers
│       ├── rls-security.ts
│       └── supabase.ts             # Supabase admin client, token acquisition
├── e2e-archive/                    # Archived/superseded specs (frozen)
├── setup.ts                        # Vitest setup (browser API mocks)
└── README.md
```

## Architecture

### Fixture Composition Pattern

All E2E, API, and integration tests import from `merged-fixtures.ts` which combines playwright-utils fixtures with custom project fixtures via `mergeTests`:

**playwright-utils fixtures:**

- `apiRequest` — Typed HTTP client with schema validation
- `recurse` — Polling for async operations
- `log` — Playwright report-integrated logging
- `interceptNetworkCall` — Network spy/stub for UI tests
- `networkErrorMonitor` — Automatic HTTP 4xx/5xx detection (with Supabase noise exclusions)

**Custom project fixtures:**

- `supabaseAdmin` — Admin client with service role key for test data manipulation
- `supabaseAsUser` — User-scoped client so RLS applies
- `coupleEvents` — Events seeding for this worker's couple, cleared before and after
- `authOptions` / `partnerUserIdentifier` — Worker-isolated storage state (primary + partner)

### Worker-Isolated Auth

Tests run in parallel with worker-scoped auth isolation:

- Auth setup creates a pool of test user pairs (primary + partner) sized to CPU count
- Each Playwright worker gets its own authenticated storage state
- Partners are pre-linked for two-context specs
- Pool size is configurable via `PLAYWRIGHT_AUTH_POOL_SIZE` env var

### Data Factories

Test data is seeded through the admin client, not UI interactions:

```typescript
import {
  resolveWorkerPairIds,
  seedEvents,
  clearPairEvents,
} from './support/factories/events';

const pair = await resolveWorkerPairIds(supabaseAdmin);
const seeded = await seedEvents(
  supabaseAdmin,
  pair,
  [{ dayOffset: 0, label: 'Meetup' }],
  new Date()
);

await clearPairEvents(supabaseAdmin, pair);
```

Specs that only need the fixture can use `coupleEvents.seed` / `coupleEvents.clear` instead.

### Example Test

```typescript
import { test, expect } from '../support/merged-fixtures';

test.use({ authSessionEnabled: false });

test('[P0] should display login screen when not authenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-screen')).toBeVisible();
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
- **Projects**: `setup` (auth) → `chromium` (E2E) + `api` (API tests) + `integration` (RPC tests)

## Best Practices

### Selector Strategy

Use `data-testid` attributes for stability:

```tsx
// Component
<button data-testid="submit-button">Submit</button>;

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

Use the `interceptNetworkCall` fixture (from `@seontechnologies/playwright-utils`) to wait
for API responses before asserting UI state. Set up the intercept **before** the action:

```typescript
// Spy on real traffic — intercept BEFORE the action
const call = interceptNetworkCall({ url: '**/rest/v1/rpc/my_endpoint' });
await page.getByTestId('submit-button').click();
const { responseJson, status } = await call;

expect(status).toBe(200);
await expect(page.getByTestId('success-message')).toBeVisible();
```

For mocking/stubbing responses:

```typescript
const call = interceptNetworkCall({
  url: '**/rest/v1/rpc/my_endpoint',
  fulfillResponse: { status: 500, body: { error: 'Server Error' } },
});
await page.goto('/dashboard');
await call;
await expect(page.getByText('Something went wrong')).toBeVisible();
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

- Two workers (`workers: 2` in CI)
- Retries enabled (`retries: 2` in CI)
- JUnit report for CI integration
- HTML report for debugging
- Secrets injected as GitHub Secrets in CI; `fnox exec -- <cmd>` locally

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

# Integration tests (Playwright — no browser, requires local Supabase)
npm run test:integration           # RPC business logic tests

# Database tests (pgTAP)
npm run test:db

# Other
npm run test:smoke             # Post-build verification
npm run test:burn-in           # Flakiness detection
npm run test:ci-local          # Simulate CI locally
```

## Test Levels

| Level       | Directory            | Framework               | What it tests                                       |
| ----------- | -------------------- | ----------------------- | --------------------------------------------------- |
| Unit        | `tests/unit/`        | Vitest + happy-dom      | Pure functions, hooks, stores, services             |
| Integration | `tests/integration/` | Playwright (no browser) | Supabase RPCs, cross-table operations, RLS policies |
| API         | `tests/api/`         | Playwright (no browser) | REST endpoint contracts via Supabase PostgREST      |
| E2E         | `tests/e2e/`         | Playwright (Chromium)   | Full user journeys with browser                     |
| Database    | `supabase/tests/`    | pgTAP                   | SQL-level schema constraints, function correctness  |

## Knowledge Base References

- `_bmad/tea/testarch/knowledge/overview.md` — Playwright utils overview
- `_bmad/tea/testarch/knowledge/fixtures-composition.md` — mergeTests patterns
- `_bmad/tea/testarch/knowledge/data-factories.md` — Test data factories
- `_bmad/tea/testarch/knowledge/network-first.md` — Network testing patterns
- `_bmad/tea/testarch/knowledge/auth-session.md` — Auth session management
- `_bmad/tea/testarch/knowledge/network-error-monitor.md` — HTTP error detection
- `_bmad/tea/testarch/knowledge/test-levels-framework.md` — Unit/integration/E2E selection guide
- `_bmad/tea/testarch/knowledge/api-testing-patterns.md` — Pure API testing without browser
