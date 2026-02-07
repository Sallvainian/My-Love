# Risk-Based Testing Explained

## Overview

Risk-based testing is TEA's foundational principle: testing depth should scale with business impact. Rather than testing all features uniformly, this methodology directs effort toward areas where failures cause the most harm.

Traditional testing treats all features identically--each receives equal coverage and scrutiny regardless of significance. Risk-based testing instead asks three critical questions:

- What's the failure probability?
- What's the impact if it fails?
- How much testing suits this risk level?

The result: testing investment aligns with business criticality.

## The Problem

### Equal Testing for Unequal Risk

Consider two features: user login (critical path affecting millions) and PDF export (rarely-used optional feature). Traditional approaches assign both identical test counts and review rigor, wasting resources on low-impact work while under-testing essential systems.

### No Objective Prioritization

Teams lack data-driven frameworks for determining adequate test coverage. Conversations devolve into subjective estimates: "We need more tests for checkout" without clarity on sufficiency or prioritization criteria.

## The Solution: Probability x Impact Scoring

Risk scores emerge from multiplying two dimensions:

**Probability (failure likelihood):**
- Level 1 (Low): Stable, well-tested, simple logic
- Level 2 (Medium): Moderate complexity with some unknowns
- Level 3 (High): Complex, untested, many edge cases

**Impact (failure consequences):**
- Level 1 (Low): Minor inconvenience affecting few users
- Level 2 (Medium): Degraded experience with workarounds available
- Level 3 (High): Critical path broken with business consequences

Score range spans 1-9.

### Scoring Examples

**Score 9 (Critical):** Payment processing combines high probability (3--complex third-party integration) with high impact (3--broken payments lose revenue). Requires extensive testing: all payment flows, API scenarios, error handling, security validation, load testing, monitoring.

**Score 1 (Low):** Profile theme color features low probability (1--simple UI toggle) and low impact (1--cosmetic only). Minimal testing suffices: one smoke test, no edge cases, no API tests.

**Score 6 (Medium-High):** User profile editing involves medium probability (2--moderate complexity) and high impact (3--users cannot update information). Focused testing applies: happy path E2E, API CRUD operations, validation testing.

## How It Works in TEA

### 1. Risk Categories

TEA assesses across six dimensions:

**TECH** - Technical debt and architectural fragility (e.g., REST-to-GraphQL migration: probability 3, impact 3, score 9)

**SEC** - Security vulnerabilities (e.g., OAuth integration: probability 2, impact 3, score 6)

**PERF** - Performance degradation (e.g., real-time notifications: probability 2, impact 2, score 4)

**DATA** - Data integrity and corruption (e.g., database migration: probability 2, impact 3, score 6)

**BUS** - Business logic errors (e.g., discount calculation: probability 2, impact 3, score 6)

**OPS** - Operational issues (e.g., logging system update: probability 1, impact 2, score 2)

### 2. Test Priorities (P0-P3)

Risk scores inform--but don't solely determine--test priorities:

**P0 - Critical Path**
- Risk scores typically 6-9
- Considers revenue impact, security-criticality, regulatory compliance, usage frequency
- Coverage target: 100%
- Test levels: E2E + API
- Examples: Login, checkout, payment processing

**P1 - High Value**
- Risk scores typically 4-6
- Considers core user journeys, complex logic, integration points
- Coverage target: 90%
- Test levels: API + selective E2E
- Examples: Profile editing, search, filters

**P2 - Medium Value**
- Risk scores typically 2-4
- Considers secondary features, admin functionality, reporting
- Coverage target: 50%
- Test levels: API happy path only
- Examples: Export features, advanced settings

**P3 - Low Value**
- Risk scores typically 1-2
- Considers rarely-used features, nice-to-have additions, cosmetic changes
- Coverage target: 20% (smoke test)
- Test levels: E2E smoke test only
- Examples: Theme customization, experimental features

### 3. Mitigation Plans

Scores >=6 require documented mitigation strategies:

```
## Risk Mitigation
**Risk:** Payment integration failure (Score: 9)
**Mitigation Plan:**
- Create comprehensive test suite (20+ tests)
- Add payment sandbox environment
- Implement retry logic with idempotency
- Add monitoring and alerts
- Document rollback procedure
**Owner:** Backend team lead
**Deadline:** Before production deployment
**Status:** In progress
```

**Gate rules:**
- Score 9 (Critical): Mandatory FAIL--blocks release without mitigation
- Score 6-8 (High): Requires mitigation plan; becomes CONCERNS if incomplete
- Score 4-5 (Medium): Mitigation recommended but not required
- Score 1-3 (Low): No mitigation needed

## Comparison: Traditional vs Risk-Based

### Traditional Approach

Testing everything equally means identical effort for critical features (user names) versus trivial ones (theme preferences). This provides no guidance on relative importance and wastes time on low-value test cases.

### Risk-Based Approach

Testing based on risk focuses effort on high-impact areas:

```
describe('User profile - Critical (P0)', () => {
  test('should display name and email'); // Score: 9
  test('should allow editing name and email');
  test('should validate email format');
  test('should prevent unauthorized edits');
  // 4 focused tests on high-risk areas
});

describe('User profile - High Value (P1)', () => {
  test('should upload avatar'); // Score: 6
  test('should update bio');
  // 2 tests for high-value features
});

// P2: Theme preference - single smoke test
// P3: Last login display - skip (read-only, low value)
```

Benefits: Six focused tests replace ten unfocused ones; effort matches business impact; clear priorities guide development; eliminates wasted effort on trivial features.

## When to Use Risk-Based Testing

### Always Use For:

**Enterprise projects:** High stakes involving revenue, compliance, security; many features competing for test effort; need objective prioritization.

**Large codebases:** Cannot exhaustively test everything; limited QA resources; want data-driven decisions.

**Regulated industries:** Must justify testing decisions; auditors require risk assessments; compliance demands documented evidence.

### Consider Skipping For:

**Tiny projects:** With only five features, testing everything thoroughly might be feasible; risk scoring becomes overhead.

**Prototypes:** Throw-away code prioritizes speed over quality; learning experiments don't warrant risk assessment.

## Real-World Example

### Scenario: E-Commerce Checkout Redesign

Redesigning checkout from five steps to three steps creates multiple risk areas:

| Component | Probability | Impact | Score | Priority | Testing |
|-----------|-------------|--------|-------|----------|---------|
| Payment processing | 3 | 3 | 9 | P0 | 15 E2E + 20 API tests |
| Order validation | 2 | 3 | 6 | P1 | 5 E2E + 10 API tests |
| Shipping calculation | 2 | 2 | 4 | P1 | 3 E2E + 8 API tests |
| Promo code validation | 2 | 2 | 4 | P1 | 2 E2E + 5 API tests |
| Gift message | 1 | 1 | 1 | P3 | 1 E2E smoke test |

With 40-hour testing budget, allocation becomes:
- Payment (Score 9): 20 hours (50%)
- Order validation (Score 6): 8 hours (20%)
- Shipping (Score 4): 6 hours (15%)
- Promo codes (Score 4): 4 hours (10%)
- Gift message (Score 1): 2 hours (5%)

This focuses 50% of effort on highest-risk features with proportional allocation for others.

Without risk-based testing, equal eight-hour allocations per component waste effort on gift messages while under-testing payment--resulting in payment bugs reaching production while gift messages receive perfect coverage.

## Mitigation Strategies by Risk Level

### Score 9: Mandatory Mitigation (Blocks Release)

Gate impact: FAIL--cannot deploy without mitigation.

Required actions:
- Comprehensive test suite (E2E, API, security)
- Multiple test environments (dev, staging, prod-mirror)
- Load testing and performance validation
- Security audit and penetration testing
- Monitoring and alerting
- Documented rollback plan
- On-call rotation assigned

Deployment is blocked until score is mitigated below 9.

### Score 6-8: Required Mitigation (Gate: CONCERNS)

Gate impact: CONCERNS--can deploy with documented mitigation plan.

Required actions:
- Targeted test suite (happy path + critical errors)
- Test environment setup
- Monitoring plan
- Document mitigation and owners

Deployment can proceed with approved mitigation plan.

### Score 4-5: Recommended Mitigation

Gate impact: Advisory--does not affect gate decision.

Suggested actions:
- Basic test coverage
- Standard monitoring
- Document known limitations

Deployment occurs; mitigation recommended but not required.

### Score 1-3: Optional Mitigation

Gate impact: None.

Optional actions:
- Smoke test if desired
- Feature flag for easy disable (optional)

Deployment proceeds without mitigation.

## Technical Implementation

### Risk Scoring Matrix

```
         Impact
           1    2    3
       +----+----+----+
    1  | 1  | 2  | 3  | Low risk
P   2  | 2  | 4  | 6  | Medium risk
r   3  | 3  | 6  | 9  | High risk
o     +----+----+----+
b     Low  Med  High
```

**Legend:**
- Red (Score 9): CRITICAL--blocks release
- Orange (Score 6-8): HIGH RISK--mitigation required
- Yellow (Score 4-5): MEDIUM--mitigation recommended
- Green (Score 1-3): LOW--optional mitigation

### Gate Decision Rules

| Score | Mitigation Required | Gate Impact |
|-------|-------------------|-------------|
| 9 | Mandatory, blocks release | FAIL if no mitigation |
| 6-8 | Required, documented plan | CONCERNS if incomplete |
| 4-5 | Recommended | Advisory only |
| 1-3 | Optional | No impact |

## Common Misconceptions

### "Risk-based = Less Testing"

**Incorrect.** Risk-based testing often means MORE testing where it matters most.

Example: Traditional spreads 50 tests equally; risk-based focuses 70 tests on P0/P1 (more total, better allocation).

### "Low Priority = Skip Testing"

**Incorrect.** P3 still receives smoke tests ensuring the feature functions.

Correct approach:
- P3: Smoke test (feature works)
- P2: Happy path (feature works correctly)
- P1: Happy path + error scenarios
- P0: Comprehensive coverage (all scenarios)

### "Risk Scores Are Permanent"

**Incorrect.** Risk changes over time.

Accurate view:
- Initial launch: Payment scores 9 (untested integration)
- After six months: Payment scores 6 (proven in production)
- Quarterly risk re-assessment recommended

## Related Concepts

**Core TEA Concepts:**
- Test Quality Standards--quality complements risk assessment
- Engagement Models--when risk-based testing matters most
- Knowledge Base System--how risk patterns are loaded

**Technical Patterns:**
- Fixture Architecture--building risk-appropriate test infrastructure
- Network-First Patterns--quality patterns for high-risk features

**Overview:**
- TEA Overview--risk assessment in TEA lifecycle
- Testing as Engineering--design philosophy

## Practical Guides

**Workflow Guides:**
- How to Run Test Design--apply risk scoring
- How to Run Trace--gate decisions based on risk
- How to Run NFR Assessment--NFR risk assessment

**Use-Case Guides:**
- Running TEA for Enterprise--enterprise risk management

## Reference

- TEA Command Reference--`test-design`, `nfr-assess`, `trace`
- Knowledge Base Index--risk governance fragments
- Glossary--risk-based testing terminology
