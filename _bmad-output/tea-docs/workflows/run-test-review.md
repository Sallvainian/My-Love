# How to Run Test Review with TEA - Complete Guide

## Overview
TEA's `test-review` workflow audits test quality using objective scoring and actionable feedback, evaluating tests against established best practices.

## When to Use This Workflow

- Validate test quality objectively
- Establish metrics for release gates
- Prepare for production deployment
- Review team-authored or AI-generated tests
- Onboard team members (demonstrate quality patterns)

## Prerequisites

- BMad Method installed
- TEA agent available
- Existing test suite
- Configured test framework

## Step-by-Step Instructions

### 1. Load TEA Agent
Start a new chat session and initialize:
```
tea
```

### 2. Run the Test Review Workflow
```
test-review
```

### 3. Specify Review Scope

**Option A: Single File**
```
tests/e2e/checkout.spec.ts
```
Best for reviewing specific failing tests or new test feedback.

**Option B: Directory**
```
tests/e2e/
```
Best for comparing quality across multiple files or auditing entire test suites.

**Option C: Entire Suite**
```
tests/
```
Best for comprehensive audits or establishing baseline metrics.

### 4. Review the Quality Report

TEA generates `test-review.md` containing:
- Overall score (0-100)
- Category-specific scores
- Critical issues with line numbers
- Code examples (current vs. fixed)
- Actionable recommendations
- Next steps prioritized by urgency

## Quality Scoring Framework

| Category | Max Points | Purpose |
|----------|-----------|---------|
| **Determinism** | 35 | Consistent results across runs |
| **Isolation** | 25 | Independent test execution |
| **Assertions** | 20 | Meaningful verification |
| **Structure** | 10 | Readability and maintainability |
| **Performance** | 10 | Efficient execution |

### Scoring Interpretation

| Range | Meaning | Required Action |
|-------|---------|-----------------|
| 90-100 | Excellent | Minimal changes; production-ready |
| 80-89 | Good | Minor improvements recommended |
| 70-79 | Acceptable | Address recommendations before release |
| 60-69 | Needs Improvement | Fix critical issues |
| <60 | Critical | Significant refactoring needed |

## Critical Issues Overview

### Hard Waits Detection
Hard-coded timeouts like `page.waitForTimeout(3000)` create flaky tests. Replace with network-first patterns:

```typescript
// Instead of:
await page.waitForTimeout(3000);

// Use:
await page.waitForResponse(
  (resp) => resp.url().includes('/api/endpoint') && resp.ok()
);
```

### Conditional Flow Control
Tests using `if/else` become non-deterministic. Make behavior explicit:

```typescript
// Instead of:
if (await page.locator('.banner').isVisible()) {
  await page.click('.dismiss');
}

// Split into separate tests:
test('show banner for new users', async ({ page }) => {
  // Specific scenario
});
```

## Key Recommendations

### 1. Extract Repeated Setup
Move duplicated login sequences into reusable fixtures. With Playwright Utils:

```typescript
import { test as base } from '@playwright/test';
import { createAuthFixtures } from '@seontechnologies/playwright-utils/auth-session';

export const test = base.extend(createAuthFixtures());

// Use in tests:
test('example', async ({ page, authToken }) => {
  // Already authenticated via persisted token
  await page.goto('/dashboard');
});
```

### 2. Add Network Assertions
Verify API responses alongside UI changes:

```typescript
const responsePromise = page.waitForResponse(
  (resp) => resp.url().includes('/api/profile')
);
await page.click('button[name="save"]');
const response = await responsePromise;
const data = await response.json();
expect(data.success).toBe(true);
```

### 3. Improve Test Names
Use descriptive naming that clarifies intent:

```typescript
// Better than: test('should work')
test('should complete checkout with valid credit card', async ({ page }) => {});
test('should show validation error for expired card', async ({ page }) => {});
```

## Next Steps (Prioritized)

### Immediate
1. Fix all critical issues (hard waits, conditionals)
2. Resolve performance bottlenecks
3. Re-run review to confirm improvements

### Short-term
4. Apply top 3 recommendations
5. Extract common fixtures
6. Add network assertions where missing
7. Improve vague test names

### Long-term
8. Re-run full suite review (target: 85+)
9. Implement performance budgets in CI
10. Document patterns for team alignment

## Best Practices

### Review Frequency
- **Per story:** Optional spot-checks
- **Per epic:** Recommended for consistency
- **Per release:** Required for quality gates
- **Quarterly:** Audit entire suite

### Review as Release Checklist
```markdown
## Release Checklist
- [ ] All tests passing
- [ ] Test review score > 80
- [ ] Critical issues resolved
- [ ] Performance within budget
```

### Track Quality Trends
Monitor scores over time to demonstrate improvement efforts and maintain quality momentum.

### Incremental Review Strategy
For large suites, divide reviews by category: E2E tests (Week 1) -> API tests (Week 2) -> Component tests (Week 3) -> Apply fixes (Week 4).

## Common Issues and Solutions

### Low Determinism Score
**Causes:** Hard waits, conditionals, missing network assertions
**Fix:** Apply network-first patterns and remove flow-control conditionals

### Low Performance Score
**Causes:** Unnecessary timeouts, inefficient selectors, heavy setup
**Fix:** Optimize selectors, use fixtures, implement parallelization

### Low Isolation Score
**Causes:** Shared state, incomplete cleanup, hard-coded data
**Fix:** Use fixtures, clean up in afterEach, generate unique test data

### Overwhelming Issue Count
**Strategy:** Prioritize critical issues first, apply top 3 recommendations, iterate incrementally rather than fixing everything simultaneously.

## Related Workflows

- **ATDD:** Generate tests for review
- **Automate:** Expand coverage to review
- **Trace:** Monitor coverage alongside quality

## Knowledge Base Integration

TEA evaluates tests against:
- Test quality standards
- Network-first patterns
- Timing and debugging practices
- Selector resilience principles

---

*Generated with BMad Method - TEA (Test Engineering Architect)*
