# How to Run Automate with TEA - Complete Guide

## Overview

The `automate` workflow generates comprehensive tests for features that already exist and function properly. Unlike ATDD workflows, these tests pass immediately since the feature is implemented.

## When to Use This Workflow

**Ideal scenarios:**
- Feature is already implemented and working
- Need to add test coverage to existing code
- Tests should pass on first run
- Expanding current test suites
- Adding tests to legacy systems

**Not suitable for:**
- Features that don't yet exist (use ATDD instead)
- When you need failing tests to guide development

## Prerequisites

- BMad Method installed
- TEA agent available
- Test framework setup completed
- Working, implemented feature

*Note: Examples use Playwright; Cypress syntax differs.*

## Step-by-Step Process

### 1. Load TEA Agent

Start fresh chat and load the agent:
```
tea
```

### 2. Run Automate Workflow

```
automate
```

### 3. Provide Context

TEA accepts two modes:

**BMad-Integrated Mode** (recommended):
Provide story files, test design documents, PRDs, and tech specs. Reference existing test files to avoid duplication.

**Standalone Mode**:
Describe the application, specific features, and scenarios to cover without BMad artifacts.

### 4. Specify Test Levels

Choose test types:
- **E2E tests** - Full browser workflows
- **API tests** - Backend endpoint testing
- **Component tests** - UI component isolation
- **Mix** - Recommended combination

Example approach:
- P0 scenarios: API + E2E tests
- P1 scenarios: API tests only
- P2 scenarios: API happy path
- P3: Skip or defer

### 5. Review Generated Tests

#### API Tests Example (Vanilla Playwright):

```typescript
import { test, expect } from '@playwright/test';

test.describe('Profile API', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'password123' },
    });
    const { token } = await response.json();
    authToken = token;
  });

  test('should fetch user profile', async ({ request }) => {
    const response = await request.get('/api/profile', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const profile = await response.json();
    expect(profile).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
    });
  });

  test('should validate email format', async ({ request }) => {
    const response = await request.patch('/api/profile', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { email: 'invalid-email' },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('Invalid email');
  });

  test('should require authentication', async ({ request }) => {
    const response = await request.get('/api/profile');
    expect(response.status()).toBe(401);
  });
});
```

#### API Tests with Playwright Utils:

```typescript
import { test as base, expect } from '@playwright/test';
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { createAuthFixtures } from '@seontechnologies/playwright-utils/auth-session';
import { mergeTests } from '@playwright/test';
import { z } from 'zod';

const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const authFixtureTest = base.extend(createAuthFixtures());
export const testWithAuth = mergeTests(apiRequestFixture, authFixtureTest);

testWithAuth.describe('Profile API', () => {
  testWithAuth('should fetch user profile', async ({ apiRequest, authToken }) => {
    const { status, body } = await apiRequest({
      method: 'GET',
      path: '/api/profile',
      headers: { Authorization: `Bearer ${authToken}` },
    }).validateSchema(ProfileSchema);

    expect(status).toBe(200);
    expect(body.name).toBeDefined();
  });

  testWithAuth('should update profile successfully', async ({ apiRequest, authToken }) => {
    const { status, body } = await apiRequest({
      method: 'PATCH',
      path: '/api/profile',
      body: { name: 'Updated Name', bio: 'Test bio' },
      headers: { Authorization: `Bearer ${authToken}` },
    }).validateSchema(ProfileSchema);

    expect(status).toBe(200);
    expect(body.name).toBe('Updated Name');
  });
});
```

**Key Playwright Utils advantages:**
- Persistent auth token fixtures
- Cleaner API response handling
- Schema validation with Zod
- Automatic 5xx error retries
- Reduced boilerplate

#### E2E Tests Example:

```typescript
import { test, expect } from '@playwright/test';

test('should edit profile', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Edit profile
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await page.getByLabel('Name').fill('New Name');
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify success
  await expect(page.getByText('Profile updated')).toBeVisible();
});
```

#### Fixture Architecture (Vanilla):

```typescript
import { test as base, Page } from '@playwright/test';

type ProfileFixtures = {
  authenticatedPage: Page;
  testProfile: {
    name: string;
    email: string;
    bio: string;
  };
};

export const test = base.extend<ProfileFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/dashboard/);

    await use(page);
  },

  testProfile: async ({ request }, use) => {
    const profile = {
      name: 'Test User',
      email: 'test@example.com',
      bio: 'Test bio',
    };

    await use(profile);
  },
});
```

#### Fixture Architecture (With Playwright Utils):

```typescript
import { test as base } from '@playwright/test';
import { createAuthFixtures } from '@seontechnologies/playwright-utils/auth-session';
import { mergeTests } from '@playwright/test';
import { faker } from '@faker-js/faker';

type ProfileFixtures = {
  testProfile: {
    name: string;
    email: string;
    bio: string;
  };
};

const authTest = base.extend(createAuthFixtures());
const profileTest = base.extend<ProfileFixtures>({
  testProfile: async ({}, use) => {
    const profile = {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      bio: faker.person.bio(),
    };

    await use(profile);
  },
});

export const test = mergeTests(authTest, profileTest);
export { expect } from '@playwright/test';
```

**Fixture benefits:**
- Persisted authentication tokens
- Dynamic test data generation
- Reusable patterns across files
- Parallel-safe execution

### 6. Review Additional Artifacts

#### Updated README Structure:

```markdown
# Test Suite

## Running Tests

### All Tests
npm test

### Specific Levels
npm run test:api       # API tests only
npm run test:e2e       # E2E tests only
npm run test:smoke     # Smoke tests (@smoke tag)

### Single File
npx playwright test tests/api/profile.spec.ts

## Test Structure
tests/
├── api/               # API tests (fast, reliable)
├── e2e/               # E2E tests (full workflows)
├── fixtures/          # Shared test utilities
└── README.md
```

#### Quality Standards Included:

- All tests pass on first run
- No hard waits (waitForTimeout)
- No conditionals for flow control
- Explicit assertions
- Self-cleaning test data
- Parallel-safe execution
- Under 1.5 minutes per test
- Test files under 300 lines

### 7. Run the Tests

**Playwright execution:**
```bash
npx playwright test
```

**Cypress execution:**
```bash
npx cypress run
```

Expected output indicates all tests pass immediately since features exist.

### 8. Review Test Coverage

```bash
# View detailed test report
npx playwright show-report

# Check coverage metrics
npm run test:coverage
```

Verify coverage against:
- Acceptance criteria from stories
- Test design priorities
- Edge cases and error scenarios

## What You Get

### Comprehensive Test Suite Includes:
- API tests for fast, reliable backend testing
- E2E tests covering critical user workflows
- Component tests (framework-dependent)
- Reusable fixture utilities

### Component Testing by Framework:

| Framework | Tool | Location |
|-----------|------|----------|
| Cypress | Cypress Component Testing | `tests/component/` |
| Playwright | Vitest + React Testing Library | `tests/component/` or `src/**/*.test.tsx` |

*Component tests use separate tooling from E2E tests.*

### Quality Features:
- Network-first patterns (wait for actual responses)
- Deterministic, non-flaky tests
- Self-cleaning test data
- Concurrent execution safe

### Documentation Artifacts:
- Updated README with execution instructions
- Test structure explanations
- Definition of Done quality standards

## Best Practices & Tips

### Start with Test Design First

Run test design before automation:
```
test-design   # Risk assessment and priorities
automate      # Generate tests following priorities
```

This focuses TEA on valuable P0/P1 scenarios.

### Prioritize Test Levels Strategically

Optimal approach:
- **P0 scenarios:** API + E2E tests
- **P1 scenarios:** API tests only
- **P2 scenarios:** API happy path
- **P3 scenarios:** Skip or defer

**Rationale:** API tests execute 10x faster and resist browser flakiness; reserve E2E for critical journeys.

### Avoid Duplicate Coverage

Inform TEA of existing tests:

```
We already have tests in:
- tests/e2e/profile-view.spec.ts (viewing profile)
- tests/api/auth.spec.ts (authentication)

Don't duplicate that coverage
```

TEA analyzes existing tests and generates only new scenarios.

### MCP Enhancements (Optional)

When configured (`tea_use_mcp_enhancements: true`), TEA automatically uses MCPs for:
- **Healing mode:** Fix broken selectors, update assertions, trace analysis
- **Recording mode:** Verify selectors against live browser, capture network requests

No additional prompts needed--MCPs activate automatically. See Enable MCP Enhancements guide for setup.

### Generate Tests Incrementally

Build test coverage progressively:

**Iteration 1:** Generate P0 tests only (critical path)
```
automate
```

**Iteration 2:** Add P1 tests while avoiding P0 duplication
```
automate
Tell TEA to avoid P0 coverage
```

**Iteration 3:** Generate P2 tests if time permits
```
automate
```

Benefits:
- Fast feedback cycles
- Validate before proceeding
- Focused generation scope

## Troubleshooting Common Issues

### Tests Pass But Coverage Is Incomplete

**Problem:** Tests pass but don't cover all scenarios.

**Root cause:** TEA lacked complete context.

**Solution:** Provide comprehensive details:
```
Generate tests for:
- All acceptance criteria in story-profile.md
- Error scenarios (validation, authorization)
- Edge cases (empty fields, long inputs)
```

### Too Many Tests Generated

**Problem:** 50 tests generated for simple feature.

**Root cause:** Priorities and scope unspecified.

**Solution:** Be specific:
```
Generate ONLY:
- P0 and P1 scenarios
- API tests for all scenarios
- E2E tests only for critical workflows
- Skip P2/P3 for now
```

### Tests Duplicate Existing Coverage

**Problem:** New tests cover scenarios already tested.

**Root cause:** Didn't specify existing test locations.

**Solution:** Reference existing tests:
```
We already have these tests:
- tests/api/profile.spec.ts (GET /api/profile)
- tests/e2e/profile-view.spec.ts (viewing profile)

Generate tests for scenarios NOT covered by those files
```

### MCP Enhancements for Better Selectors

MCP-configured TEA verifies selectors against live browsers. Without MCPs, TEA generates accessible selectors (`getByRole`, `getByLabel`) as defaults.

Setup requires: BMad installer MCPs response + MCP server IDE configuration (see Enable MCP Enhancements).

## Related Documentation

- [How to Run Test Design](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-test-design/) - Plan before generating
- [How to Run ATDD](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-atdd/) - Failing tests before implementation
- [How to Run Test Review](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-test-review/) - Audit generated quality

## Conceptual Understanding

- [Testing as Engineering](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/testing-as-engineering/) - Why TEA generates quality tests (foundational)
- [Risk-Based Testing](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/risk-based-testing/) - Prioritize P0 over P3
- [Test Quality Standards](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/test-quality-standards/) - What defines good tests
- [Fixture Architecture](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/fixture-architecture/) - Reusable test patterns

## Reference

- [Command: automate](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/reference/commands/#automate) - Full command reference
- [TEA Configuration](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/reference/configuration/) - MCP and Playwright Utils options
