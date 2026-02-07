# Getting Started with Test Architect - Complete Content

## Overview
Test Architect (TEA) Lite enables beginners to quickly generate tests for existing features using the `automate` workflow within Claude Code or similar AI assistants.

## What You'll Build
By completing this 30-minute tutorial, you will have:
- A functional Playwright test framework
- Your initial risk-based test plan
- Passing tests for a demo application feature

**Prerequisites:**
- Node.js v20 or later
- 30 minutes of focused time
- TodoMVC demo app (https://todomvc.com/examples/react/dist/)

**Quick Path:** Load TEA -> scaffold framework -> create test plan -> generate tests -> run with `npx playwright test`

## TEA Approaches Explained
Three distinct ways exist to implement TEA:

1. **TEA Lite** - Beginner approach using only the `automate` workflow for testing existing features
2. **TEA Solo** - Standalone TEA usage without full BMad Method integration
3. **TEA Integrated** - Complete BMad Method with all TEA workflows across project phases

This tutorial focuses on TEA Lite, the fastest method to observe TEA functionality.

## Step 0: Setup (2 minutes)

Test TodoMVC, a standard demonstration application across testing documentation.

**Demo App URL:** https://todomvc.com/examples/react/dist/

No installation required. Open the link and:
1. Add several todos (type and press Enter)
2. Mark some as complete (click checkbox)
3. Try "All", "Active", "Completed" filters

You've explored the features that will be tested.

## Step 1: Install BMad and Scaffold Framework (10 minutes)

### Install BMad Method

Execute the BMad installation command (see installation guide for current syntax).

When prompted, make these selections:
- **Select modules:** "BMM: BMad Method" (Space, then Enter)
- **Project name:** Keep default or enter your project name
- **Experience level:** Select "beginner" for this tutorial
- **Planning artifacts folder:** Keep default
- **Implementation artifacts folder:** Keep default
- **Project knowledge folder:** Keep default
- **Enable TEA Playwright Model Context Protocol (MCP) enhancements?** Select "No" (explore later)
- **Using playwright-utils?** Select "No" (explore later)

BMad installation completes, creating a `_bmad/` folder in your project.

### Load TEA Agent

Begin a new chat with your AI assistant (Claude, etc.) and type:

```
tea
```

The TEA menu displays available workflows.

### Scaffold Test Framework

In your chat, execute:

```
framework
```

TEA prompts for responses:

**Q: What's your tech stack?**
A: "We're testing a React web application (TodoMVC)"

**Q: Which test framework?**
A: "Playwright"

**Q: Testing scope?**
A: "End-to-end (E2E) testing for a web application"

**Q: Continuous integration/continuous deployment (CI/CD) platform?**
A: "GitHub Actions" (or your preference)

TEA generates:
- `tests/` directory with Playwright configuration
- `playwright.config.ts` with base setup
- Sample test structure
- `.env.example` for environment variables
- `.nvmrc` for Node version management

**Verify the setup:**

```bash
npm install
npx playwright install
```

A production-ready test framework now exists.

## Step 2: Your First Test Design (5 minutes)

Test design represents where TEA demonstrates its strongest capabilities through risk-based planning before test creation.

### Run Test Design

In your TEA chat, execute:

```
test-design
```

TEA asks clarifying questions:

**Q: System-level or epic-level?**
A: "Epic-level - I want to test TodoMVC's basic functionality"

**Q: What feature are you testing?**
A: "TodoMVC's core operations - creating, completing, and deleting todos"

**Q: Any specific risks or concerns?**
A: "We want to ensure the filter buttons (All, Active, Completed) work correctly"

TEA analyzes and creates `test-design-epic-1.md` containing:

1. **Risk Assessment**
   - Probability x Impact scoring
   - Risk categories (TECH, SEC, PERF, DATA, BUS, OPS)
   - High-risk areas identification

2. **Test Priorities**
   - P0: Critical path (creating and displaying todos)
   - P1: High value (completing todos, filters)
   - P2: Medium value (deleting todos)
   - P3: Low value (edge cases)

3. **Coverage Strategy**
   - E2E tests for user workflows
   - Scenarios requiring testing
   - Recommended test structure

Review the test design file to observe TEA's systematic approach to determining what requires testing and why.

## Step 3: Generate Tests for Existing Features (5 minutes)

This phase demonstrates TEA's core capability -- generating tests from your test design.

### Run Automate

In your TEA chat, execute:

```
automate
```

TEA prompts:

**Q: What are you testing?**
A: "TodoMVC React app at https://todomvc.com/examples/react/dist/ - focus on the test design we just created"

**Q: Reference existing docs?**
A: "Yes, use test-design-epic-1.md"

**Q: Any specific test scenarios?**
A: "Cover the P0 and P1 scenarios from the test design"

TEA generates `tests/e2e/todomvc.spec.ts` with sample tests:

```typescript
import { test, expect } from '@playwright/test';

test.describe('TodoMVC - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://todomvc.com/examples/react/dist/');
  });

  test('should create a new todo', async ({ page }) => {
    // TodoMVC uses a simple input without placeholder or test IDs
    const todoInput = page.locator('.new-todo');
    await todoInput.fill('Buy groceries');
    await todoInput.press('Enter');

    // Verify todo appears in list
    await expect(page.locator('.todo-list li')).toContainText('Buy groceries');
  });

  test('should mark todo as complete', async ({ page }) => {
    // Create a todo
    const todoInput = page.locator('.new-todo');
    await todoInput.fill('Complete tutorial');
    await todoInput.press('Enter');

    // Mark as complete using the toggle checkbox
    await page.locator('.todo-list li .toggle').click();

    // Verify completed state
    await expect(page.locator('.todo-list li')).toHaveClass(/completed/);
  });

  test('should filter todos by status', async ({ page }) => {
    // Create multiple todos
    const todoInput = page.locator('.new-todo');
    await todoInput.fill('Buy groceries');
    await todoInput.press('Enter');
    await todoInput.fill('Write tests');
    await todoInput.press('Enter');

    // Complete the first todo ("Buy groceries")
    await page.locator('.todo-list li .toggle').first().click();

    // Test Active filter (shows only incomplete todos)
    await page.locator('.filters a[href="#/active"]').click();
    await expect(page.locator('.todo-list li')).toHaveCount(1);
    await expect(page.locator('.todo-list li')).toContainText('Write tests');

    // Test Completed filter (shows only completed todos)
    await page.locator('.filters a[href="#/completed"]').click();
    await expect(page.locator('.todo-list li')).toHaveCount(1);
    await expect(page.locator('.todo-list li')).toContainText('Buy groceries');
  });
});
```

TEA also generates:
- **`tests/README.md`** - Test execution instructions and project conventions
- **Definition of Done summary** - Criteria for test quality

### With Playwright Utils (Optional Enhancement)

If your config includes `tea_use_playwright_utils: true`, TEA generates production-ready utility tests:

**Vanilla Playwright approach:**

```typescript
test('should mark todo as complete', async ({ page, request }) => {
  // Manual API call
  const response = await request.post('/api/todos', {
    data: { title: 'Complete tutorial' },
  });
  const todo = await response.json();

  await page.goto('/');
  await page.locator(`.todo-list li:has-text("${todo.title}") .toggle`).click();
  await expect(page.locator('.todo-list li')).toHaveClass(/completed/);
});
```

**With Playwright Utils:**

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';

test('should mark todo as complete', async ({ page, apiRequest }) => {
  // Typed API call with cleaner syntax
  const { status, body: todo } = await apiRequest({
    method: 'POST',
    path: '/api/todos',
    body: { title: 'Complete tutorial' },
  });

  expect(status).toBe(201);
  await page.goto('/');
  await page.locator(`.todo-list li:has-text("${todo.title}") .toggle`).click();
  await expect(page.locator('.todo-list li')).toHaveClass(/completed/);
});
```

**Playwright Utils benefits:**
- Type-safe API responses (`{ status, body }`)
- Automatic retry for 5xx errors
- Built-in schema validation
- Cleaner, more maintainable code

See the Integrate Playwright Utils guide to enable this feature.

## Step 4: Run and Validate (5 minutes)

Execute your generated tests against the live application.

### Run the Tests

```bash
npx playwright test
```

Expected output:

```
Running 3 tests using 1 worker
  3 passed (7s)
```

All tests pass against the existing TodoMVC application.

### View Test Report

```bash
npx playwright show-report
```

Opens an interactive HTML report displaying:
- Test execution timeline
- Screenshots (if failures occurred)
- Trace viewer for detailed debugging

### What Just Happened?

Using TEA Lite, you:

1. Scaffolded a production-ready test framework (`framework`)
2. Created a risk-based test plan (`test-design`)
3. Generated comprehensive tests (`automate`)
4. Executed tests against an existing application

This occurred within 30 minutes.

## What You Learned

### Quick Reference

| Command | Purpose |
|---------|---------|
| `tea` | Load the TEA agent |
| `framework` | Scaffold test infrastructure |
| `test-design` | Risk-based test planning |
| `automate` | Generate tests for existing features |

### TEA Principles

- **Risk-based testing** - Test depth scales with business impact (P0 vs P3)
- **Test design first** - Plan before generating tests
- **Network-first patterns** - Tests wait for actual responses (no hard waits)
- **Production-ready from day one** - Not educational examples

**Key Takeaway:** TEA Lite (using only `automate`) suits beginners learning TEA fundamentals, testing existing applications, expanding test coverage rapidly, and teams seeking quick results.

## Understanding ATDD vs Automate

This tutorial employed the `automate` workflow to generate tests for **existing features** (tests pass immediately).

**Use `automate` when:**
- Feature already exists
- You need test coverage addition
- Tests should pass on first execution

**Use `atdd` (Acceptance Test-Driven Development) when:**
- Feature doesn't exist yet (Test-Driven Development workflow)
- You want failing tests BEFORE implementation
- Following red -> green -> refactor cycle

See the How to Run ATDD guide for the test-driven development approach.

## Next Steps

### Level Up Your TEA Skills

**How-To Guides** (task-oriented):
- How to Run Test Design - Deep dive into risk assessment
- How to Run ATDD - Generate failing tests first (TDD)
- How to Set Up CI Pipeline - Automate test execution
- How to Review Test Quality - Audit test quality

**Explanation** (understanding-oriented):
- TEA Overview - Complete TEA capabilities
- Testing as Engineering - Why TEA exists (problem + solution)
- Risk-Based Testing - How risk scoring works

**Reference** (quick lookup):
- TEA Command Reference - All 9 TEA workflows
- TEA Configuration - Config options
- Glossary - TEA terminology

### Try TEA Solo

Ready for standalone usage without full BMad Method? Use TEA Solo:
- Run any TEA workflow independently
- Bring your own requirements
- Use on non-BMad projects

See TEA Overview for engagement models.

### Go Full TEA Integrated

Want the complete quality operating model? Try TEA Integrated with BMad Method:
- Phase 2: Planning with non-functional requirements (NFR) assessment
- Phase 3: Architecture testability review
- Phase 4: Per-epic test design -> `atdd` -> `automate`
- Release Gate: Coverage traceability and gate decisions

See BMad Method Documentation for the full workflow.

## Common Questions

### Why can't my tests find elements?

TodoMVC lacks consistent test IDs or accessible roles. The tutorial's selectors use CSS classes matching TodoMVC's actual structure:

```typescript
// TodoMVC uses these CSS classes:
page.locator('.new-todo'); // Input field
page.locator('.todo-list li'); // Todo items
page.locator('.toggle'); // Checkbox

// For your own app, prefer accessible selectors:
page.getByRole('textbox');
page.getByRole('listitem');
page.getByRole('checkbox');
```

In production, use accessible selectors (`getByRole`, `getByLabel`, `getByText`) for better resilience. TodoMVC serves as a learning vehicle, not a selector best practice example.

### How do I fix network timeouts?

Increase timeout in `playwright.config.ts`:

```typescript
use: {
  timeout: 30000, // 30 seconds
}
```

## Getting Help

- **Documentation:** https://docs.bmad-method.org
- **GitHub Issues:** https://github.com/bmad-code-org/bmad-method/issues
- **Discord:** Join the BMAD community
