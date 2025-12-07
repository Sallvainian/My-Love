# Testing Guide

> Vitest and Playwright testing patterns for the My-Love project

@docs/03-Development/typescript-patterns.md
@docs/03-Development/react-19-guide.md
@docs/03-Development/troubleshooting.md

*Last Updated: December 2024*

---

## Unit Testing with Vitest

### Test File Location

Tests are colocated with source files:
```
src/
├── utils/
│   ├── format.ts
│   └── format.test.ts
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
```

### Basic Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats ISO date to readable string', () => {
    expect(formatDate('2024-01-15')).toBe('January 15, 2024');
  });

  it('handles invalid date gracefully', () => {
    expect(formatDate('invalid')).toBe('Invalid Date');
  });
});
```

---

## Common Mocks

### Server-Only Mock

```typescript
vi.mock("server-only", () => ({}));
```

### Prisma Mock

```typescript
import { beforeEach } from "vitest";
import prisma from "@/utils/__mocks__/prisma";

vi.mock("@/utils/prisma");

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches users", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: '1', name: 'Test User' }
    ]);

    const users = await getUsersAll();
    expect(users).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledOnce();
  });
});
```

### Next.js Navigation Mock

```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/current-path',
  useSearchParams: () => new URLSearchParams(),
}));
```

### Environment Variable Mock

```typescript
beforeEach(() => {
  vi.stubEnv('API_URL', 'https://test-api.example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

---

## Testing React Components

### Basic Component Test

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('increments count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

---

## E2E Testing with Playwright

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results.json' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Accessibility-First Selectors

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Use accessibility selectors
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for navigation
    await page.waitForURL('**/dashboard');

    // Assert success
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });
});
```

### Selector Priority

| Priority | Selector | Example |
|----------|----------|---------|
| 1 | getByRole | `getByRole('button', { name: 'Submit' })` |
| 2 | getByLabel | `getByLabel('Email')` |
| 3 | getByPlaceholder | `getByPlaceholder('Search...')` |
| 4 | getByText | `getByText('Welcome')` |
| 5 | getByTestId | `getByTestId('submit-btn')` (last resort) |

---

## API Testing

```typescript
test('API returns valid user data', async ({ request }) => {
  const response = await request.get('/api/users/1');

  expect(response.ok()).toBeTruthy();
  expect(response.status()).toBe(200);

  const user = await response.json();
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user.email).toMatch(/@/);
});

test('API rejects unauthorized requests', async ({ request }) => {
  const response = await request.get('/api/admin/users');
  expect(response.status()).toBe(401);
});
```

---

## Test Patterns

### Arrange-Act-Assert

```typescript
it('calculates total with discount', () => {
  // Arrange
  const cart = createCart([
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 },
  ]);
  const discount = 0.1; // 10%

  // Act
  const total = calculateTotal(cart, discount);

  // Assert
  expect(total).toBe(225); // (200 + 50) * 0.9
});
```

### Test Isolation

```typescript
describe('CartService', () => {
  let cart: Cart;

  beforeEach(() => {
    // Fresh cart for each test
    cart = new Cart();
  });

  afterEach(() => {
    // Cleanup
    vi.clearAllMocks();
  });

  it('test 1', () => { /* uses fresh cart */ });
  it('test 2', () => { /* uses fresh cart */ });
});
```

---

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Best Practices Checklist

- [ ] Each test should be independent
- [ ] Use descriptive test names
- [ ] Mock external dependencies
- [ ] Clean up mocks between tests
- [ ] Avoid testing implementation details
- [ ] Use accessibility selectors in E2E tests
- [ ] Run tests in CI with retries
- [ ] Keep tests fast (<100ms for unit, <30s for E2E)

---

*See also: [CLAUDE.md](../../CLAUDE.md) for quick reference*
