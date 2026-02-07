# Test Quality Standards Explained

## Overview

TEA's quality principles establish what constitutes good tests: deterministic execution, isolated test cases, explicit assertions, focused scope, and fast performance. These standards prevent test rot and maintain team confidence in the test suite.

## The Problem

### Tests That Rot in Review

Tests incorporating hard waits, conditionals, try-catch blocks, excessive length, and vague naming frequently fail code review and never merge, resulting in lost coverage.

### AI-Generated Tests Without Standards

Without guardrails, AI-generated tests produce redundant, flaky, and untrusted outputs that create maintenance burden rather than value.

## The Solution: TEA's Quality Standards

### 1. Determinism (No Flakiness)

**Requirements:**
- Eliminate hard waits (`waitForTimeout`)
- Avoid conditionals for flow control
- Remove try-catch for flow control
- Implement network-first patterns
- Use explicit waits

**Bad approach:** Using `waitForTimeout(2000)` with conditional element checking and try-catch blocks that mask failures.

**Good approach:** Wait for actual API responses or specific DOM conditions using `waitForResponse()` or `waitForSelector()`.

With Playwright Utils, use `interceptNetworkCall()` for cleaner response handling with automatic JSON parsing.

### 2. Isolation (No Dependencies)

**Requirements:**
- Self-cleaning tests
- No global state dependencies
- Parallel execution capability
- Order-independent execution
- Unique test data

**Bad approach:** Storing user IDs in global variables, hard-coding test data, and skipping cleanup.

**Good approach:** Create unique test data per execution (using timestamps or libraries like Faker), perform cleanup in afterEach hooks, and use fixtures for credential management.

### 3. Explicit Assertions (No Hidden Validation)

**Requirements:**
- Assertions visible in test body
- Specific, meaningful assertions
- Actual behavior validation

**Bad approach:** Burying assertions in helper functions where test reviewers cannot see them.

**Good approach:** Write assertions directly in tests using specific matchers like `expect(user.name).toBe('Updated')` rather than generic `toBeTruthy()`.

### 4. Focused Tests (Appropriate Size)

**Requirements:**
- Test size under 300 lines
- Single responsibility
- Clear naming
- Appropriate scope balance

**Bad approach:** A 500-line test covering registration, profile setup, settings, and data export.

**Good approach:** Separate focused tests, each under 50 lines, testing one feature per test.

### 5. Fast Execution (Performance Budget)

**Requirements:**
- Individual test execution under 90 seconds
- Efficient selectors (prefer `getByRole()` over XPath)
- Minimal redundant actions
- Parallel execution enabled

**Bad approach:** Multiple `waitForTimeout(10000)` calls accumulating 3+ minutes per test.

**Good approach:** Use network waits instead of hard waits, direct navigation, and accessible selectors. Playwright Utils provides automatic retry for 5xx errors.

## TEA's Quality Scoring

### Scoring Categories (100 points total)

**Determinism (35 points):**
- No hard waits: 10 points
- No conditionals: 10 points
- No try-catch flow: 10 points
- Network-first patterns: 5 points

**Isolation (25 points):**
- Self-cleaning: 15 points
- No global state: 5 points
- Parallel-safe: 5 points

**Assertions (20 points):**
- Explicit in test body: 10 points
- Specific and meaningful: 10 points

**Structure (10 points):**
- Test size under 300 lines: 5 points
- Clear naming: 5 points

**Performance (10 points):**
- Execution time under 1.5 minutes: 10 points

### Score Interpretation

| Score | Interpretation | Action |
|-------|---|---|
| 90-100 | Excellent | Production-ready, minimal changes |
| 80-89 | Good | Minor improvements recommended |
| 70-79 | Acceptable | Address recommendations before release |
| 60-69 | Needs Work | Fix critical issues |
| < 60 | Critical | Significant refactoring needed |

## Comparison: Good vs Bad Tests

### User Login Example

**Bad Test (45/100):**
- Vague test name
- 3-second hard wait
- Conditional element checking
- Try-catch for navigation
- Zero assertions
- No cleanup

**Good Test (95/100):**
- Descriptive name clearly stating behavior
- Network response wait
- Explicit assertions on token and redirect
- Accessible selectors (`getByLabel`, `getByRole`)
- Fixture-based cleanup

### API Testing Example

**Bad Test (50/100):**
- Hard-coded test data causing conflicts
- Conditional response handling
- Weak assertions
- No cleanup

**Good Test (92/100):**
- Unique test data using timestamp
- Direct status and body assertions
- Explicit cleanup of created resources
- Clear validation of response structure

## How TEA Enforces Standards

### During Test Generation (atdd, automate)

TEA generates tests following standards automatically:
- Network-first patterns instead of hard waits
- Accessible selectors for resilience
- Explicit assertions visible in test body
- Appropriate test size

### During Test Review (test-review)

TEA audits tests and flags violations with score impact:
- Hard wait detection (-10 points)
- Conditional flow control flagging (-10 points)
- Code duplication recommendations (-3 points)

## Definition of Done Checklist

**Test Quality DoD:**
- No hard waits
- No conditionals for flow control
- No try-catch for flow control
- Network-first patterns used
- Assertions explicit in test body
- Test size under 300 lines
- Clear, descriptive test name
- Self-cleaning implementation
- Unique test data
- Execution time under 1.5 minutes
- Parallel-executable
- Order-independent

**Code Review DoD:**
- Test quality score exceeding 80
- No critical issues from test-review
- Adherence to project patterns
- Team member review completed

## Common Quality Issues

### Optional Elements

**Avoid:** `if (await page.locator('.banner').isVisible()) { await page.click('.dismiss'); }`

**Instead:** Make behavior deterministic by always expecting the element or creating separate tests for each scenario.

### Error Handling

**Avoid:** Silent try-catch blocks that mask test failures.

**Instead:** Allow failures to propagate, or write explicit tests for optional behavior.

### Hard Waits vs Network Patterns

Short-term perception: hard waits seem simpler. Long-term reality: flaky tests consume far more debugging time. Learning network-first patterns (30 minutes investment) prevents hundreds of hours in maintenance.

## Related Concepts

**Core TEA Concepts:**
- Risk-Based Testing - quality scales with risk
- Knowledge Base System - standards enforcement
- Engagement Models - quality across different models

**Technical Patterns:**
- Network-First Patterns - determinism implementation
- Fixture Architecture - isolation through fixtures

**Overview References:**
- TEA Overview - quality standards in lifecycle
- Testing as Engineering - why quality matters

## Practical Guides

**Workflow Guides:**
- How to Run Test Review - audit against standards
- How to Run ATDD - generate quality tests
- How to Run Automate - expand with quality

**Use-Case Guides:**
- Using TEA with Existing Tests - improve legacy quality
- Running TEA for Enterprise - enterprise quality thresholds
