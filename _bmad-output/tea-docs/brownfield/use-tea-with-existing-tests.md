# Using TEA with Existing Tests (Brownfield)

## Overview

This guide enables teams to implement TEA on established codebases with legacy tests, establishing coverage baselines and improving quality incrementally without complete rewrites.

## When to Apply

- Existing codebase containing tests (complete or incomplete)
- Legacy test suites requiring quality enhancement
- Feature additions to established applications
- Need for current coverage understanding
- Regression prevention during feature development

## Prerequisites

- BMad Method installation
- TEA agent availability
- Functional test codebase
- Optional: Run `document-project` first for undocumented codebases

## Four-Phase Strategy

### Phase 1: Establish Baseline

Execute `trace` Phase 1 to map existing tests against requirements, generating a traceability matrix showing full/partial/no coverage classifications.

Run `test-review` on current tests to identify quality issues: "Hard waits everywhere, fragile CSS selectors, missing test isolation, try-catch flow control, inadequate cleanup."

### Phase 2: Prioritize Improvements

**Priority Sequence:**
1. P0 requirements to 100% coverage
2. Eliminate flaky tests using network-first patterns
3. P1 requirements to 80%+ coverage
4. Quality refinement

Modern network-first approach replaces hard waits:

**Legacy pattern:** `await page.waitForTimeout(5000)` -> flaky
**Modern pattern:** Wait for API response completion

With Playwright Utils, use `interceptNetworkCall` for cleaner network interception with automatic JSON parsing.

### Phase 3: Incremental Improvement

Apply TEA workflows to new features (full workflow) while systematically improving legacy code. Add regression tests for bug fixes. Maintain baseline coverage during refactoring.

### Phase 4: Continuous Improvement

Track quarterly metrics: coverage percentage, quality score, flakiness rates. Target progressive improvement (Q1-Q4) rather than immediate perfection.

## Key Brownfield Principles

**Avoid rewrites:** Keep working tests; fix incrementally rather than replacing entire suites.

**Target regression hotspots:** Prioritize high-risk areas (authentication, payments, checkout) based on historical bug patterns.

**Quarantine flaky tests:** Use `.skip()` temporarily while fixing systematically.

**Migrate directory-by-directory:** Focus improvement on one test directory weekly.

**Document migration status:** Track which sections are modernized versus legacy.

## Common Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Unknown coverage | Run `trace` to reverse-engineer test mapping |
| Brittle tests | Make incremental improvements with baseline validation |
| Missing documentation | Create tests/README.md with setup and execution guides |
| Slow execution | Configure parallel sharding; implement selective testing |
| Constant failures | Use `test-review` to identify flakiness patterns |

## Recommended Workflow Sequence

1. **Documentation:** `document-project` (if needed)
2. **Baseline:** `trace` Phase 1 + `test-review`
3. **Planning:** `prd`, `architecture`, `test-design` (system-level)
4. **Infrastructure:** `framework`, `ci`
5. **Per Epic:** `test-design` (epic-level) -> `automate` -> `test-review` -> `trace` Phase 1
6. **Release Gate:** `nfr-assess`, `trace` Phase 2

## Key Resources

- Network-First Patterns guide (eliminates flakiness)
- Test Quality Standards (defines improvement targets)
- Risk-Based Testing (prioritization framework)
- Playwright Utils integration (modernization utilities)
