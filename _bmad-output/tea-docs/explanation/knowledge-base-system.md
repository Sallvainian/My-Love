# Knowledge Base System Explained

## Overview

TEA's knowledge base system enables context engineering by automatically loading domain-specific standards into AI context, ensuring consistently high-quality tests regardless of prompt variation.

**The Problem:** AI without context produces inconsistent results. Without systematic knowledge, test quality depends on prompt engineering skill rather than established patterns.

**The Solution:** TEA loads relevant fragments from a manifest, ensuring the same patterns apply across all sessions.

## The Problem

### Prompt-Driven Testing = Inconsistency

Without a knowledge base, successive test generation sessions produce varying quality:

- Session 1: Hard waits included
- Session 2: Some improvements but still inconsistent
- Session 3: Better patterns but non-standardized

Quality depends on prompt engineering skill, not systematic practice.

### Knowledge Drift

Without centralized standards:
- Different teams use different patterns
- No single source of truth
- Patterns diverge over time
- Inconsistent implementations across projects

## The Solution: tea-index.csv Manifest

### How It Works

**1. Manifest Defines Fragments**

The `tea-index.csv` file catalogs all knowledge fragments:

```
id,name,description,tags,fragment_file
test-quality,Test Quality,Execution limits and isolation rules,quality;standards,knowledge/test-quality.md
network-first,Network-First Safeguards,Intercept-before-navigate workflow,network;stability,knowledge/network-first.md
fixture-architecture,Fixture Architecture,Composable fixture patterns,fixtures;architecture,knowledge/fixture-architecture.md
```

**2. Workflow Loads Relevant Fragments**

When executing `atdd`:
- TEA reads the manifest
- Identifies required fragments (test-quality.md, network-first.md, component-tdd.md, fixture-architecture.md, data-factories.md)
- Loads only these 5 fragments
- Skips irrelevant ones (contract-testing.md, burn-in.md, etc.)

**3. Consistent Output**

Every execution produces tests following identical patterns because the same fragments load consistently.

### Knowledge Base Loading Diagram

The system works as follows:

1. User triggers workflow (e.g., `atdd`)
2. TEA reads manifest (`tea-index.csv`)
3. System identifies relevant fragments for the workflow
4. **Loaded fragments:** test-quality.md, network-first.md, component-tdd.md, data-factories.md, fixture-architecture.md
5. **Skipped fragments:** contract-testing.md, burn-in.md, and 26 others
6. AI context populated with 5 focused fragments
7. Tests generated following consistent patterns
8. Output maintains systematic quality every time

## Fragment Structure

Each fragment follows a standardized format for consistency.

### Anatomy of a Fragment

```
# Fragment Name
## Principle
[One sentence describing the pattern]

## Rationale
[Why use this instead of alternatives?]
- Why this pattern exists
- Problems it solves
- Benefits it provides

## Pattern Examples
### Example 1: Basic Usage
[Runnable code example]
[Explanation]

### Example 2: Advanced Pattern
[More complex example]
[Explanation]

## Anti-Patterns
### Don't Do This
[Bad code example]
[Why it's bad, what breaks]

## Related Patterns
- [Link to related fragment]
```

### Example: test-quality.md Fragment

**Principle:** Tests must be deterministic, isolated, explicit, focused, and fast.

**Rationale:** Tests that fail randomly, depend on each other, or take too long lose team trust.

**Pattern Examples:**

Example 1: Deterministic Test
```typescript
// Wait for actual response, not timeout
const promise = page.waitForResponse(matcher);
await page.click('button');
await promise;
```

Example 2: Isolated Test
```typescript
// Self-cleaning test
test('test', async ({ page }) => {
  const userId = await createTestUser();
  // ... test logic ...
  await deleteTestUser(userId); // Cleanup
});
```

**Anti-Patterns:**

Hard Waits
```typescript
// Non-deterministic
await page.waitForTimeout(3000);
```

This causes flakiness because timing is arbitrary rather than condition-based.

## How TEA Uses the Knowledge Base

### Workflow-Specific Loading

Different workflows load different fragments for targeted context:

| Workflow | Fragments Loaded | Purpose |
|----------|-----------------|---------|
| `framework` | fixture-architecture, playwright-config, fixtures-composition | Infrastructure patterns |
| `test-design` | test-quality, test-priorities-matrix, risk-governance | Planning standards |
| `atdd` | test-quality, component-tdd, network-first, data-factories | TDD patterns |
| `automate` | test-quality, test-levels-framework, selector-resilience | Comprehensive generation |
| `test-review` | All quality/resilience/debugging fragments | Full audit patterns |
| `ci` | ci-burn-in, burn-in, selective-testing | CI/CD optimization |

**Benefit:** Only relevant context loads (focused, no bloat).

### Dynamic Fragment Selection

TEA doesn't load all fragments at once. When user runs `atdd` for authentication:

**Context Analysis:**
- Feature type: Authentication
- Relevant fragments: test-quality.md, auth-session.md, network-first.md, email-auth.md, data-factories.md

**Skipped fragments:** contract-testing.md, feature-flags.md, file-utils.md, and 25 others

**Result:** 5 focused fragments load; 28 skip. Focused context yields better results with lower token usage.

## Context Engineering in Practice

### Example: Consistent Test Generation

**Without Knowledge Base (Vanilla Playwright, Random Quality):**

Session 1:
```typescript
test('api test', async ({ request }) => {
  const response = await request.get('/api/users');
  await page.waitForTimeout(2000); // Hard wait - random quality
  const users = await response.json();
});
```

Session 2:
```typescript
test('api test', async ({ request }) => {
  const response = await request.get('/api/users');
  const users = await response.json(); // Better but inconsistent
});
```

Result: Inconsistent quality, random patterns.

**With Knowledge Base (TEA + Playwright Utils):**

Session 1 and 2 (Identical):
```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';

test('should fetch users', async ({ apiRequest }) => {
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/users'
  }).validateSchema(UsersSchema);

  expect(status).toBe(200);
  expect(body).toBeInstanceOf(Array);
});
```

Result: Systematic quality. Always uses `apiRequest` utility, always validates schemas, always returns `{ status, body }`.

### Example: Test Review Consistency

**Without Knowledge Base:**
- Session 1: "This test looks okay" (50 issues missed)
- Session 2: "This test has some issues" (Different issues flagged)

Result: Inconsistent feedback.

**With Knowledge Base:**
- Session 1: Loads all quality fragments -> Flags 12 hard waits, 5 conditionals
- Session 2: Loads same fragments -> Flags identical issues with same explanations

Result: Consistent, reliable feedback.

## Maintaining the Knowledge Base

### When to Add a Fragment

**Good reasons:**
- Pattern used across multiple workflows
- Standard is non-obvious (needs documentation)
- Team repeatedly asks "how should we handle X?"
- New tool integration required

**Bad reasons:**
- One-off pattern (document in test file instead)
- Obvious pattern (everyone knows this)
- Experimental (not yet proven)

### Fragment Quality Standards

**Good fragment characteristics:**
- Principle stated in one sentence
- Rationale clearly explains why
- 3+ pattern examples with code
- Anti-patterns shown (what not to do)
- Self-contained (minimal dependencies)
- Optimal size: 10-30 KB

### Updating Existing Fragments

**When to update:**
- Pattern evolved (better approach discovered)
- Tool updated (new Playwright API)
- Team feedback (pattern unclear)
- Bug in example code

**How to update:**
1. Edit fragment markdown file
2. Update examples
3. Test with affected workflows
4. Ensure no breaking changes

No need to update `tea-index.csv` unless description or tags change.

## Benefits of Knowledge Base System

### 1. Consistency
**Before:** Test quality varies by author
**After:** All tests follow same patterns

### 2. Onboarding
**Before:** New team member reads 20 documents, asks 50 questions
**After:** New member runs `atdd`, learns patterns by generated code example

### 3. Quality Gates
**Before:** "Is this test good?" -> subjective opinion
**After:** `test-review` -> objective score against knowledge base

### 4. Pattern Evolution
**Before:** Manually update tests across 100 files
**After:** Update fragment once; all new tests use new pattern

### 5. Cross-Project Reuse
**Before:** Reinvent patterns for each project
**After:** Same fragments across all BMad projects

## Comparison: With vs Without Knowledge Base

### Scenario: Testing Async Background Job

**Without Knowledge Base:**

Developer 1:
```typescript
// Uses hard wait
await page.click('button');
await page.waitForTimeout(10000);  // Hope job finishes
```

Developer 2:
```typescript
// Uses polling
await page.click('button');
for (let i = 0; i < 10; i++) {
  const status = await page.locator('.status').textContent();
  if (status === 'complete') break;
  await page.waitForTimeout(1000);
}
```

Developer 3:
```typescript
// Uses waitForSelector
await page.click('button');
await page.waitForSelector('.success', { timeout: 30000 });
```

Result: 3 different patterns, all suboptimal.

**With Knowledge Base (recurse.md fragment):**

All developers:
```typescript
import { test } from '@seontechnologies/playwright-utils/fixtures';

test('job completion', async ({ apiRequest, recurse }) => {
  // Start async job
  const { body: job } = await apiRequest({
    method: 'POST',
    path: '/api/jobs',
  });

  // Poll until complete (correct API: command, predicate, options)
  const result = await recurse(
    () => apiRequest({ method: 'GET', path: `/api/jobs/${job.id}` }),
    (response) => response.body.status === 'completed',
    {
      timeout: 30000,
      interval: 2000,
      log: 'Waiting for job to complete',
    },
  );

  expect(result.body.status).toBe('completed');
});
```

Result: Consistent pattern using correct playwright-utils API.

## Technical Implementation

For implementation details, see:
- Knowledge Base Index
- TEA Configuration

## Related Concepts

**Core TEA Concepts:**
- Test Quality Standards - Standards in knowledge base
- Risk-Based Testing - Risk patterns in knowledge base
- Engagement Models - Knowledge base across all models

**Technical Patterns:**
- Fixture Architecture - Fixture patterns in knowledge base
- Network-First Patterns - Network patterns in knowledge base

**Overview:**
- TEA Overview - Knowledge base in workflows
- Testing as Engineering - Context engineering philosophy foundation

## Practical Guides

All workflow guides use the knowledge base system:
- How to Run Test Design
- How to Run ATDD
- How to Run Automate
- How to Run Test Review

**Integration:**
- Integrate Playwright Utils - PW-Utils in knowledge base

## Reference

- Knowledge Base Index - Complete fragment index
- TEA Command Reference - Workflows and fragments
- TEA Configuration - Configuration effects
- Glossary - Context engineering and knowledge fragment terms
