# Fixture Architecture Explained

## Overview

Fixture architecture in TEA represents a pattern for building reusable, testable, and composable test utilities. The core principle emphasizes: "build pure functions first, wrap in framework fixtures second."

**The Pattern:**
1. Write utility as pure function (unit-testable)
2. Wrap in framework fixture (Playwright, Cypress)
3. Compose fixtures with mergeTests (combine capabilities)
4. Package for reuse across projects

### Fixture Architecture Flow

The documentation describes a four-step progression:
- **Step 1: Pure Function** (`helpers/api-request.ts`) - Framework agnostic, unit testable
- **Step 2: Fixture Wrapper** (`fixtures/api-request.ts`) - Injects framework dependencies
- **Step 3: Composition** (`fixtures/index.ts`) - Uses mergeTests
- **Step 4: Use in Tests** (`tests/**.spec.ts`)

## The Problem

### Framework-First Approach (Anti-Pattern)

Building fixtures directly within the framework context creates several issues:

- Cannot unit test (requires Playwright context)
- Tied to framework (not reusable in other tools)
- Hard to compose with other fixtures
- Difficult to mock for testing the utility itself

### Copy-Paste Utilities

Repeating code across test files violates the DRY principle and creates:

- Code duplication across multiple test files
- Inconsistent error handling patterns
- Maintenance burden (updating requires changing multiple tests)
- No shared behavior enforcement

## The Solution: Three-Step Pattern

### Step 1: Pure Function

Create framework-agnostic utility functions with dependency injection:

```typescript
export async function apiRequest({
  request,
  method,
  url,
  data,
  headers = {},
}: ApiRequestParams): Promise<ApiResponse> {
  const response = await request.fetch(url, {
    method,
    data,
    headers,
  });

  if (!response.ok()) {
    throw new Error(`API request failed: ${response.status()}`);
  }

  return {
    status: response.status(),
    body: await response.json(),
  };
}
```

**Benefits:**
- Unit testable (mock dependencies)
- Framework-agnostic (works with any HTTP client)
- Easy to reason about (pure function)
- Portable (usable in Node scripts, CLI tools)

### Step 2: Fixture Wrapper

Wrap pure functions in framework-specific fixtures:

```typescript
import { test as base } from '@playwright/test';
import { apiRequest as apiRequestFn } from '../helpers/api-request';

export const test = base.extend<{ apiRequest: typeof apiRequestFn }>({
  apiRequest: async ({ request }, use) => {
    await use((params) => apiRequestFn({ request, ...params }));
  },
});

export { expect } from '@playwright/test';
```

**Benefits:**
- Fixture provides framework context (request)
- Pure function handles logic
- Clean separation of concerns
- Framework can be swapped (Cypress, etc.) by changing wrapper only

### Step 3: Composition with mergeTests

Combine multiple fixtures into a single test object:

```typescript
import { mergeTests } from '@playwright/test';
import { test as apiRequestTest } from './api-request';
import { test as authSessionTest } from './auth-session';
import { test as logTest } from './log';

export const test = mergeTests(apiRequestTest, authSessionTest, logTest);

export { expect } from '@playwright/test';
```

**Usage in tests:**

```typescript
import { test, expect } from '../support/fixtures';

test('should update profile', async ({ apiRequest, authToken, log }) => {
  log.info('Starting profile update test');

  const { status, body } = await apiRequest({
    method: 'PATCH',
    url: '/api/profile',
    data: { name: 'New Name' },
    headers: { Authorization: `Bearer ${authToken}` },
  });

  expect(status).toBe(200);
  expect(body.name).toBe('New Name');
  log.info('Profile updated successfully');
});
```

**Benefits:**
- Use multiple fixtures in one test
- No manual composition needed
- Type-safe (TypeScript knows all fixture types)
- Clean imports

## How It Works in TEA

### TEA Generates This Pattern

When running `framework` with `tea_use_playwright_utils: true`, TEA scaffolds:

```
tests/
├── support/
│   ├── helpers/           # Pure functions
│   │   ├── api-request.ts
│   │   └── auth-session.ts
│   └── fixtures/          # Framework wrappers
│       ├── api-request.ts
│       ├── auth-session.ts
│       └── index.ts       # Composition
└── e2e/
    └── example.spec.ts    # Uses composed fixtures
```

### TEA Reviews Against This Pattern

When running `test-review`, TEA checks:
- Are utilities pure functions?
- Are fixtures minimal wrappers?
- Is composition used?
- Can utilities be unit tested?

## Package Export Pattern

### Make Fixtures Reusable Across Projects

**Option 1: Build Your Own (Vanilla)**

`package.json` configuration:

```json
{
  "name": "@company/test-utils",
  "exports": {
    "./api-request": "./fixtures/api-request.ts",
    "./auth-session": "./fixtures/auth-session.ts",
    "./log": "./fixtures/log.ts"
  }
}
```

Usage:

```typescript
import { test as apiTest } from '@company/test-utils/api-request';
import { test as authTest } from '@company/test-utils/auth-session';
import { mergeTests } from '@playwright/test';

export const test = mergeTests(apiTest, authTest);
```

**Option 2: Use Playwright Utils (Recommended)**

Installation:

```bash
npm install -D @seontechnologies/playwright-utils
```

Usage:

```typescript
import { test as base } from '@playwright/test';
import { mergeTests } from '@playwright/test';
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { createAuthFixtures } from '@seontechnologies/playwright-utils/auth-session';

const authFixtureTest = base.extend(createAuthFixtures());
export const test = mergeTests(apiRequestFixture, authFixtureTest);
```

**Why Playwright Utils:**
- Already built, tested, and maintained
- Consistent patterns across projects
- 11 utilities available (API, auth, network, logging, files)
- Community support and documentation
- Regular updates and improvements

**When to Build Your Own:**
- Company-specific patterns
- Custom authentication systems
- Unique requirements not covered by utilities

## Comparison: Good vs Bad Patterns

### Anti-Pattern: God Fixture

```typescript
// Bad: Everything in one fixture
export const test = base.extend({
  testUtils: async ({ page, request, context }, use) => {
    await use({
      // 50 different methods crammed into one fixture
      apiRequest: async (...) => { },
      login: async (...) => { },
      createUser: async (...) => { },
      deleteUser: async (...) => { },
      uploadFile: async (...) => { },
      // ... 45 more methods
    });
  }
});
```

**Problems:**
- Cannot test individual utilities
- Cannot compose (all-or-nothing)
- Cannot reuse specific utilities
- Hard to maintain (1000+ line file)

### Good Pattern: Single-Concern Fixtures

```typescript
// Good: One concern per fixture
export const test = base.extend({ apiRequest });

// auth-session.ts
export const test = base.extend({ authSession });

// log.ts
export const test = base.extend({ log });

// Compose as needed
import { mergeTests } from '@playwright/test';
export const test = mergeTests(apiRequestTest, authSessionTest, logTest);
```

**Benefits:**
- Each fixture is unit-testable
- Compose only what you need
- Reuse individual fixtures
- Easy to maintain (small files)

## Technical Implementation

The documentation references the knowledge base for detailed fixture architecture patterns:
- Knowledge Base Index - Architecture & Fixtures
- Complete Knowledge Base Index

## When to Use This Pattern

### Always Use For:

**Reusable utilities:**
- API request helpers
- Authentication handlers
- File operations
- Network mocking

**Test infrastructure:**
- Shared fixtures across teams
- Packaged utilities (playwright-utils)
- Company-wide test standards

### Consider Skipping For:

**One-off test setup:**

```typescript
// Simple one-time setup - inline is fine
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.click('#accept-cookies');
});
```

**Test-specific helpers:**

```typescript
// Used in one test file only - keep local
function createTestUser(name: string) {
  return { name, email: `${name}@test.com` };
}
```

## Related Concepts

**Core TEA Concepts:**
- Test Quality Standards - Quality standards fixtures enforce
- Knowledge Base System - Fixture patterns in knowledge base

**Technical Patterns:**
- Network-First Patterns - Network fixtures explained
- Risk-Based Testing - Fixture complexity matches risk

**Overview:**
- TEA Overview - Fixture architecture in workflows
- Testing as Engineering - Why fixtures matter

## Practical Guides

**Setup Guides:**
- How to Set Up Test Framework - TEA scaffolds fixtures
- Integrate Playwright Utils - Production-ready fixtures

**Workflow Guides:**
- How to Run ATDD - Using fixtures in tests
- How to Run Automate - Fixture composition examples

## Reference

- TEA Command Reference - `framework` command
- Knowledge Base Index - Fixture architecture fragments
- Glossary - Fixture architecture term
