# Testing Architecture

## Test Layers

| Layer | Framework | Environment | Location |
|-------|-----------|-------------|----------|
| Unit Tests | Vitest + happy-dom | In-process DOM | `tests/unit/` |
| E2E Tests | Playwright | Real browser | `tests/e2e/` |
| API Tests | Playwright | HTTP | `tests/api/` |
| Database Tests | pgTAP | PostgreSQL | `supabase/tests/database/` |
| Smoke Tests | Node.js script | Build output | `scripts/smoke-tests.cjs` |

## Unit Tests

### Configuration

- **Runner**: Vitest 4.0.17 (`vitest.config.ts`)
- **DOM**: happy-dom 20.5.0 (lightweight DOM implementation)
- **Setup**: `tests/setup.ts` (global test setup)
- **Coverage**: V8 coverage with 80% threshold
- **Path alias**: `@/` maps to `src/`
- **IndexedDB mock**: `fake-indexeddb` 6.2.5

### Key Commands

```bash
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode
npm run test:unit:ui           # Browser-based Vitest UI
npm run test:unit:coverage     # With coverage report
npx vitest run tests/unit/services/moodService.test.ts --silent  # Single file
```

### Test Patterns

Unit tests follow React Testing Library patterns with Zustand store mocking:

```typescript
// Component test
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('renders mood button', () => {
  render(<MoodButton mood="happy" onSelect={vi.fn()} />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

Service tests use `fake-indexeddb` for IndexedDB:

```typescript
import 'fake-indexeddb/auto';
import { moodService } from '@/services/moodService';

test('creates mood entry', async () => {
  const mood = await moodService.create(userId, ['happy'], 'note');
  expect(mood.synced).toBe(false);
});
```

## E2E Tests

### Configuration

- **Runner**: Playwright 1.58.2 (`playwright.config.ts`)
- **Fixtures**: Merged from `@seontechnologies/playwright-utils` and custom fixtures
- **Auth Setup**: Worker-isolated test users via Supabase Admin API
- **Imports**: Always from `tests/support/merged-fixtures.ts`

### Key Commands

```bash
npm run test:e2e               # All E2E tests (with cleanup)
npm run test:e2e:raw           # Playwright directly
npm run test:e2e:ui            # Playwright UI mode
npm run test:e2e:debug         # Debug mode
npm run test:p0                # Priority 0 tests only
npm run test:p1                # Priority 0 + 1 tests
npx playwright test tests/e2e/mood/mood-tracker.spec.ts  # Single file
```

### Auth Setup (`tests/support/auth-setup.ts`)

Creates worker-isolated test users before tests run:

- Each parallel Playwright worker gets its own user pair (user + partner)
- Users are created via Supabase Admin API
- Auth state is stored in `tests/.auth/worker-{n}.json`
- This prevents cross-contamination between parallel test workers

### Fixture Pattern

```typescript
// tests/support/merged-fixtures.ts
import { test as base, expect } from '@seontechnologies/playwright-utils';
// ... merge custom fixtures

// In test files:
import { test, expect } from '../support/merged-fixtures';

test('user can log mood', async ({ page, authenticatedPage }) => {
  // ...
});
```

### Priority Tags

Tests use priority tags for selective execution:

| Tag | Description |
|-----|-------------|
| `[P0]` | Critical path, must pass before deploy |
| `[P1]` | Important features, run in CI |
| `[P2]` | Nice-to-have, run in full suite |

## Database Tests

pgTAP tests run via the Supabase CLI:

```bash
npm run test:db
# Expands to: supabase test db
```

Test files are in `supabase/tests/database/` and validate:
- RLS policies
- Database functions
- Migration correctness
- Trigger behavior

## Smoke Tests

Post-build verification (`scripts/smoke-tests.cjs`):

```bash
npm run test:smoke
```

Validates the build output exists and contains expected files.

## Related Documentation

- [Technology Stack](./02-technology-stack.md)
- [Deployment](./15-deployment.md)
