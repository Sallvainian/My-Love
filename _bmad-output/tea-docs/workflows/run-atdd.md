# How to Run ATDD with TEA - Complete Page Content

## Overview

The ATDD workflow generates failing acceptance tests before feature implementation, following the Test-Driven Development (TDD) red phase approach where tests guide development.

## When to Use This

**Use ATDD when:**
- Implementing a NEW feature that doesn't exist yet
- Following TDD workflow (red -> green -> refactor)
- Tests should guide your implementation
- Practicing acceptance test-driven development

**Don't use this if:**
- Feature already exists (use `automate` instead)
- You want tests that pass immediately

## Prerequisites

- BMad Method installed
- TEA agent available
- Test framework setup complete
- Story or feature defined with acceptance criteria
- Note: Guide uses Playwright examples; Cypress syntax differs

## Steps

### 1. Load TEA Agent

```
tea
```

### 2. Run the ATDD Workflow

```
atdd
```

### 3. Provide Context

TEA requests:

**Story/Feature Details** - Description of what users can do

**Acceptance Criteria** - Given/When/Then format scenarios

**Reference Documents** (optional) - Story files, PRD, test design outputs

### 4. Specify Test Levels

Choose from:
- E2E tests (browser-based, full user journey)
- API tests (backend only, faster)
- Component tests (UI components in isolation)
- Mix of levels

### Component Testing by Framework

| Framework | Tool |
|-----------|------|
| Cypress | Cypress Component Testing (*.cy.tsx) |
| Playwright | Vitest + React Testing Library (*.test.tsx) |

### 5. Review Generated Tests

#### API Tests (`tests/api/profile.spec.ts`) - Vanilla Playwright

```typescript
import { test, expect } from '@playwright/test';

test.describe('Profile API', () => {
  test('should fetch user profile', async ({ request }) => {
    const response = await request.get('/api/profile');
    expect(response.status()).toBe(200);
    const profile = await response.json();
    expect(profile).toHaveProperty('name');
    expect(profile).toHaveProperty('email');
    expect(profile).toHaveProperty('avatarUrl');
  });

  test('should update user profile', async ({ request }) => {
    const response = await request.patch('/api/profile', {
      data: {
        name: 'Updated Name',
        email: 'updated@example.com',
      },
    });
    expect(response.status()).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe('Updated Name');
    expect(updated.email).toBe('updated@example.com');
  });

  test('should validate email format', async ({ request }) => {
    const response = await request.patch('/api/profile', {
      data: {
        email: 'invalid-email',
      },
    });
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('Invalid email format');
  });
});
```

#### API Tests with Playwright Utils

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';
import { z } from 'zod';

const ProfileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url(),
});

test.describe('Profile API', () => {
  test('should fetch user profile', async ({ apiRequest }) => {
    const { status, body } = await apiRequest({
      method: 'GET',
      path: '/api/profile',
    }).validateSchema(ProfileSchema);

    expect(status).toBe(200);
    expect(body.name).toBeDefined();
    expect(body.email).toContain('@');
  });

  test('should update user profile', async ({ apiRequest }) => {
    const { status, body } = await apiRequest({
      method: 'PATCH',
      path: '/api/profile',
      body: {
        name: 'Updated Name',
        email: 'updated@example.com',
      },
    }).validateSchema(ProfileSchema);

    expect(status).toBe(200);
    expect(body.name).toBe('Updated Name');
    expect(body.email).toBe('updated@example.com');
  });

  test('should validate email format', async ({ apiRequest }) => {
    const { status, body } = await apiRequest({
      method: 'PATCH',
      path: '/api/profile',
      body: { email: 'invalid-email' },
    });

    expect(status).toBe(400);
    expect(body.message).toContain('Invalid email format');
  });
});
```

**Key Benefits of Playwright Utils:**
- Returns `{ status, body }` (cleaner than separate calls)
- Automatic schema validation with Zod
- Type-safe response bodies
- Automatic retry for 5xx errors
- Less boilerplate

#### E2E Tests (`tests/e2e/profile.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test('should edit and save profile', async ({ page }) => {
  // Login first
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Navigate to profile
  await page.goto('/profile');

  // Edit profile
  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await page.getByLabel('Name').fill('Updated Name');
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify success
  await expect(page.getByText('Profile updated')).toBeVisible();
});
```

#### Implementation Checklist

```
## Implementation Checklist

### Backend
- [ ] Create `GET /api/profile` endpoint
- [ ] Create `PATCH /api/profile` endpoint
- [ ] Add email validation middleware
- [ ] Add profile picture upload handling
- [ ] Write API unit tests

### Frontend
- [ ] Create ProfilePage component
- [ ] Implement profile form with validation
- [ ] Add file upload for avatar
- [ ] Handle API errors gracefully
- [ ] Add loading states

### Tests
- [x] API tests generated (failing)
- [x] E2E tests generated (failing)
- [ ] Run tests after implementation (should pass)
```

### 6. Verify Tests Fail

This is the TDD red phase - all tests must fail before implementation.

**For Playwright:**
```bash
npx playwright test
```

**For Cypress:**
```bash
npx cypress run
```

Expected output shows failures:
```
Running 6 tests using 1 worker

  x tests/api/profile.spec.ts:3:3 > should fetch user profile
    Error: expect(received).toBe(expected)
    Expected: 200
    Received: 404

  x tests/e2e/profile.spec.ts:10:3 > should display current profile information
    Error: page.goto: net::ERR_ABORTED
```

**All tests should fail** - confirming:
- Feature doesn't exist yet
- Tests will guide implementation
- Clear success criteria established

### 7. Implement the Feature

Follow this sequence:
1. Start with API tests (backend first)
2. Make API tests pass
3. Move to E2E tests (frontend)
4. Make E2E tests pass
5. Refactor with confidence (tests protect you)

### 8. Verify Tests Pass

After implementation, run your test suite.

**For Playwright:**
```bash
npx playwright test
```

**For Cypress:**
```bash
npx cypress run
```

Expected output:
```
Running 6 tests using 1 worker

  ✓ tests/api/profile.spec.ts:3:3 > should fetch user profile (850ms)
  ✓ tests/api/profile.spec.ts:15:3 > should update user profile (1.2s)
  ✓ tests/api/profile.spec.ts:30:3 > should validate email format (650ms)
  ✓ tests/e2e/profile.spec.ts:10:3 > should display current profile (2.1s)
  ✓ tests/e2e/profile.spec.ts:18:3 > should edit and save profile (3.2s)
  ✓ tests/e2e/profile.spec.ts:35:3 > should show validation error (1.8s)

  6 passed (9.8s)
```

Completion of the TDD cycle: red -> green -> refactor

## What You Get

### Failing Tests
- API tests for backend endpoints
- E2E tests for user workflows
- Component tests (if requested)
- All tests fail initially (red phase)

### Implementation Guidance
- Clear checklist of what to build
- Acceptance criteria translated to assertions
- Edge cases and error scenarios identified

### TDD Workflow Support
- Tests guide implementation
- Confidence to refactor
- Living documentation of features

## Tips

### Start with Test Design

Run `test-design` before `atdd` for better results:

```
test-design   # Risk assessment and priorities
atdd          # Generate tests based on design
```

### MCP Enhancements (Optional)

If MCP servers configured (`tea_use_mcp_enhancements: true`), TEA can use them during ATDD. Note: For typical ATDD (no UI yet), TEA infers selectors from best practices.

See Enable MCP Enhancements for setup.

### Focus on P0/P1 Scenarios

Don't generate tests for everything at once:

```
Generate tests for:
- P0: Critical path (happy path)
- P1: High value (validation, errors)

Skip P2/P3 for now - add later with automate
```

### API Tests First, E2E Later

Recommended order:
1. Generate API tests with `atdd`
2. Implement backend (make API tests pass)
3. Generate E2E tests with `atdd` (or `automate`)
4. Implement frontend (make E2E tests pass)

"Outside-in" approach is faster and more reliable.

### Keep Tests Deterministic

TEA generates deterministic tests by default:
- No hard waits (`waitForTimeout`)
- Network-first patterns (wait for responses)
- Explicit assertions (no conditionals)

Don't modify these patterns - they prevent flakiness!

## Related Guides

- [How to Run Test Design](../run-test-design/) - Plan before generating
- How to Run Automate - Tests for existing features
- [How to Set Up Test Framework](../setup-test-framework/) - Initial setup

## Understanding the Concepts

- Testing as Engineering - Why TEA generates quality tests (foundational)
- Risk-Based Testing - Why P0 vs P3 matters
- Test Quality Standards - What makes tests good
- Network-First Patterns - Avoiding flakiness

## Reference

- Command: atdd - Full command reference
- TEA Configuration - MCP and Playwright Utils options
