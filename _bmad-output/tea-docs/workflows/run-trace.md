# How to Run Trace with TEA - Complete Guide

## Overview
TEA's `trace` workflow enables requirements traceability and quality gate decisions through a two-phase process: Phase 1 analyzes coverage, Phase 2 makes the go/no-go decision.

## When to Use This

**Phase 1: Requirements Traceability**
- Map acceptance criteria to implemented tests
- Identify coverage gaps
- Prioritize missing tests
- Refresh coverage after each story/epic

**Phase 2: Quality Gate Decision**
- Make go/no-go decision for release
- Validate coverage meets thresholds
- Document gate decision with evidence
- Support business-approved waivers

## Prerequisites
- BMad Method installed
- TEA agent available
- Requirements defined (stories, acceptance criteria, test design)
- Tests implemented
- For brownfield: Existing codebase with tests

## Steps

### 1. Run the Trace Workflow
```
trace
```

### 2. Specify Phase
TEA asks which phase you're running:

**Phase 1: Requirements Traceability**
- Analyze coverage
- Identify gaps
- Generate recommendations

**Phase 2: Quality Gate Decision**
- Make PASS/CONCERNS/FAIL/WAIVED decision
- Requires Phase 1 complete

*Typical flow:* Run Phase 1 first, review gaps, then run Phase 2 for gate decision.

## Phase 1: Requirements Traceability

### 3. Provide Requirements Source

Options include:
- **Story file** (e.g., `story-profile-management.md`) - Single story coverage
- **Test design** (e.g., `test-design-epic-1.md`) - Epic coverage
- **PRD** (e.g., `PRD.md`) - System-level coverage
- **Multiple sources** - Comprehensive analysis

Example response:
```
Requirements:
- story-profile-management.md (acceptance criteria)
- test-design-epic-1.md (test priorities)
```

### 4. Specify Test Location

Example:
```
Test location: tests/
Include:
- tests/api/
- tests/e2e/
```

### 5. Specify Focus Areas (Optional)

Example:
```
Focus on:
- Profile CRUD operations
- Validation scenarios
- Authorization checks
```

### 6. Review Coverage Matrix

TEA generates a comprehensive traceability matrix documenting:
- Coverage summary with percentages
- Coverage by priority (P0-P3)
- Detailed requirement-to-test mapping
- Gap prioritization
- Actionable recommendations

**Coverage Classifications:**
- **FULL** - All acceptance criteria tested
- **PARTIAL** - Some aspects tested
- **NONE** - No tests exist

### Example: Bio Field Tests

**Vanilla Playwright:**
```typescript
// tests/e2e/profile-edit.spec.ts
test('should edit bio field', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Bio').fill('New bio text');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('New bio text')).toBeVisible();
});

// tests/api/profile.spec.ts
test('should update bio via API', async ({ request }) => {
  const response = await request.patch('/api/profile', {
    data: { bio: 'Updated bio' },
  });
  expect(response.ok()).toBeTruthy();
  const { bio } = await response.json();
  expect(bio).toBe('Updated bio');
});
```

**With Playwright Utils:**
```typescript
import { test } from '../support/fixtures';

test('should edit bio field', async ({ page, authToken }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Bio').fill('New bio text');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('New bio text')).toBeVisible();
});
```

### Avatar Upload Tests

```typescript
test('should upload avatar image', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit' }).click();

  // Upload file
  await page.setInputFiles('[type="file"]', 'fixtures/avatar.png');
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify uploaded image displays
  await expect(page.locator('img[alt="Profile avatar"]')).toBeVisible();
});

test('should accept valid image upload', async ({ request }) => {
  const response = await request.post('/api/profile/avatar', {
    multipart: {
      file: {
        name: 'avatar.png',
        mimeType: 'image/png',
        buffer: await fs.readFile('fixtures/avatar.png'),
      },
    },
  });
  expect(response.ok()).toBeTruthy();
});
```

## Next Steps

After reviewing traceability:
1. Fix critical gaps - Add tests for P0/P1 requirements
2. Run `test-review` - Ensure new tests meet quality standards
3. Run Phase 2 - Make gate decision after gaps addressed

## Phase 2: Quality Gate Decision

Prerequisites:
- Phase 1 traceability matrix complete
- Test execution results available (must have test results)

*Note:* Phase 2 skips if test execution results aren't provided.

### 7. Run Phase 2
```
trace
Select "Phase 2: Quality Gate Decision"
```

### 8. Provide Additional Context

TEA asks for:

**Gate Type:**
- Story gate (small release)
- Epic gate (larger release)
- Release gate (production deployment)
- Hotfix gate (emergency fix)

**Decision Mode:**
- **Deterministic** - Rule-based (coverage %, quality scores)
- **Manual** - Team decision with TEA guidance

Example:
```
Gate type: Epic gate
Decision mode: Deterministic
```

### 9. Provide Supporting Evidence

TEA requests:
- **Phase 1 Results:** `traceability-matrix.md`
- **Test Quality (Optional):** `test-review.md`
- **NFR Assessment (Optional):** `nfr-assessment.md`

### 10. Review Gate Decision

TEA creates `gate-decision-{gate_type}-{story_id}.md` with:
- Go/no-go verdict (PASS/CONCERNS/FAIL/WAIVED)
- Evidence summary
- Approval signatures
- Next steps and monitoring plan

## Gate Decision Rules

TEA uses deterministic rules when `decision_mode = "deterministic"`:

| P0 Coverage | P1 Coverage | Overall Coverage | Decision |
|-------------|-------------|------------------|----------|
| 100%        | >=90%       | >=80%            | **PASS** |
| 100%        | 80-89%      | >=80%            | **CONCERNS** |
| <100%       | Any         | Any              | **FAIL** |
| Any         | <80%        | Any              | **FAIL** |
| Any         | Any         | <80%             | **FAIL** |
| Any         | Any         | Any              | **WAIVED** |

**Detailed Rules:**
- **PASS:** P0=100%, P1>=90%, Overall>=80%
- **CONCERNS:** P0=100%, P1 80-89%, Overall>=80%
- **FAIL:** P0<100% OR P1<80% OR Overall<80%

### Decision Meanings

**PASS**: All criteria met, ready to release

**CONCERNS**: Some criteria not met, but:
- Mitigation plan exists
- Risk is acceptable
- Team approves proceeding
- Monitoring in place

**FAIL**: Critical criteria not met:
- P0 requirements not tested
- Critical security vulnerabilities
- System is broken
- Cannot deploy

**WAIVED**: Business approves proceeding despite concerns:
- Documented business justification
- Accepted risks quantified
- Approver signatures
- Future plans documented

## Example CONCERNS Decision

```
## Decision Summary
**Verdict:** CONCERNS - Proceed with monitoring
**Evidence:**
- P0 coverage: 100%
- P1 coverage: 85% (below 90% target)
- Test quality: 78/100 (below 80 target)

**Gaps:**
- 1 P1 requirement not tested (avatar upload)
- Test quality score slightly below threshold

**Mitigation:**
- Avatar upload not critical for v1.2 launch
- Test quality issues are minor (no flakiness)
- Monitoring alerts configured

**Approvals:**
- Product Manager: APPROVED (business priority to launch)
- Tech Lead: APPROVED (technical risk acceptable)
```

## Example FAIL Decision

```
## Decision Summary
**Verdict:** FAIL - Cannot release
**Evidence:**
- P0 coverage: 60% (below 95% threshold)
- Critical security vulnerability (CVE-2024-12345)
- Test quality: 55/100

**Blockers:**
1. **Login flow not tested** (P0 requirement)
   - Critical path completely untested
   - Must add E2E and API tests

2. **SQL injection vulnerability**
   - Critical security issue
   - Must fix before deployment

**Actions Required:**
1. Add login tests (QA team, 2 days)
2. Fix SQL injection (backend team, 1 day)
3. Re-run security scan (DevOps, 1 hour)
4. Re-run trace after fixes

Cannot proceed until all blockers resolved.
```

## What You Get

### Phase 1: Traceability Matrix
- Requirement-to-test mapping
- Coverage classification (FULL/PARTIAL/NONE)
- Gap identification with priorities
- Actionable recommendations

### Phase 2: Gate Decision
- Go/no-go verdict (PASS/CONCERNS/FAIL/WAIVED)
- Evidence summary
- Approval signatures
- Next steps and monitoring plan

## Usage Patterns

### Greenfield Projects

**Phase 3:**
```
After architecture complete:
1. Run test-design (system-level)
2. Run trace Phase 1 (baseline)
3. Use for implementation-readiness gate
```

**Phase 4:**
```
After each epic/story:
1. Run trace Phase 1 (refresh coverage)
2. Identify gaps
3. Add missing tests
```

**Release Gate:**
```
Before deployment:
1. Run trace Phase 1 (final coverage check)
2. Run trace Phase 2 (make gate decision)
3. Get approvals
4. Deploy (if PASS or WAIVED)
```

### Brownfield Projects

**Phase 2:**
```
Before planning new work:
1. Run trace Phase 1 (establish baseline)
2. Understand existing coverage
3. Plan testing strategy
```

**Phase 4:**
```
After each epic/story:
1. Run trace Phase 1 (refresh)
2. Compare to baseline
3. Track coverage improvement
```

**Release Gate:**
```
Before deployment:
1. Run trace Phase 1 (final check)
2. Run trace Phase 2 (gate decision)
3. Compare to baseline
4. Deploy if coverage maintained or improved
```

## Tips

### Run Phase 1 Frequently

Don't wait until release gate:
```
After Story 1: trace Phase 1 (identify gaps early)
After Story 2: trace Phase 1 (refresh)
After Story 3: trace Phase 1 (refresh)
Before Release: trace Phase 1 + Phase 2 (final gate)
```

*Benefit:* Catch gaps early when they're cheap to fix.

### Use Coverage Trends

Track improvement over time:
```
## Coverage Trend
| Date       | Epic     | P0/P1 Coverage | Quality Score | Status         |
| ---------- | -------- | -------------- | ------------- | -------------- |
| 2026-01-01 | Baseline | 45%            | -             | Starting point |
| 2026-01-08 | Epic 1   | 78%            | 72            | Improving      |
| 2026-01-15 | Epic 2   | 92%            | 84            | Near target    |
| 2026-01-20 | Epic 3   | 100%           | 88            | Ready!         |
```

### Set Coverage Targets by Priority

Recommended targets:
- **P0:** 100% (critical path must be tested)
- **P1:** 90% (high-value scenarios)
- **P2:** 50% (nice-to-have features)
- **P3:** 20% (low-value edge cases)

### Use Classification Strategically

**FULL**: Requirement completely tested
- E2E test covers full user workflow
- API test validates backend behavior
- All acceptance criteria covered

**PARTIAL**: Some aspects tested
- E2E test exists but missing scenarios
- API test exists but incomplete
- Some acceptance criteria not covered

**NONE**: No tests exist
- Requirement identified but not tested
- May be intentional (low priority) or oversight

Classification helps prioritize:
- Fix NONE coverage for P0/P1 requirements first
- Enhance PARTIAL coverage for P0 requirements
- Accept PARTIAL or NONE for P2/P3 if time-constrained

### Automate Gate Decisions

Use traceability in CI:

`.github/workflows/gate-check.yml:`
```yaml
- name: Check coverage
  run: |
    # Run trace Phase 1
    # Parse coverage percentages
    if [ $P0_COVERAGE -lt 95 ]; then
      echo "P0 coverage below 95%"
      exit 1
    fi
```

### Document Waivers Clearly

If proceeding with WAIVED:

```markdown
## Waiver Documentation
**Waived By:** VP Engineering, Product Lead
**Date:** 2026-01-15
**Gate Type:** Release Gate v1.2

**Justification:**
Business critical to launch by Q1 for investor demo.
Performance concerns acceptable for initial user base.

**Conditions:**
- Set monitoring alerts for P99 > 300ms
- Plan optimization for v1.3 (due February 28)
- Monitor user feedback closely

**Accepted Risks:**
- 1% of users may experience 350ms latency
- Avatar upload feature incomplete
- Profile export deferred to next release

**Quantified Impact:**
- Affects <100 users at current scale
- Workaround exists (manual export)
- Monitoring will catch issues early

**Approvals:**
- VP Engineering: [Signature] Date: 2026-01-15
- Product Lead: [Signature] Date: 2026-01-15
- QA Lead: [Signature] Date: 2026-01-15
```

## Common Issues

### Too Many Gaps to Fix

**Problem:** Phase 1 shows 50 uncovered requirements.

**Solution:** Prioritize ruthlessly:
1. Fix all P0 gaps (critical path)
2. Fix high-risk P1 gaps
3. Accept low-risk P1 gaps with mitigation
4. Defer all P2/P3 gaps

*Don't try to fix everything* - focus on what matters for release.

### Can't Find Test Coverage

**Problem:** Tests exist but TEA can't map them to requirements.

**Cause:** Tests don't reference requirements.

**Solution:** Add traceability comments:
```typescript
test('should display profile', async ({ page }) => {
  // Covers: Requirement 1 - User can view profile
  // Acceptance criteria: Navigate to /profile, see name/email
  await page.goto('/profile');
  await expect(page.getByText('Test User')).toBeVisible();
});
```

Or use test IDs:
```typescript
test('[REQ-1] should display profile', async ({ page }) => {
  // Test code...
});
```

### Unclear What "FULL" vs "PARTIAL" Means

**FULL**: All acceptance criteria tested
```
Requirement: User can edit profile
Acceptance criteria:
  - Can modify name    Tested
  - Can modify email   Tested
  - Can upload avatar  Tested
  - Changes persist    Tested
Result: FULL coverage
```

**PARTIAL**: Some criteria tested, some not
```
Requirement: User can edit profile
Acceptance criteria:
  - Can modify name    Tested
  - Can modify email   Tested
  - Can upload avatar  Not tested
  - Changes persist    Tested
Result: PARTIAL coverage (3/4 criteria)
```

### Gate Decision Unclear

**Use PASS** if:
- All P0 requirements 100% covered
- P1 requirements >90% covered
- No critical issues
- NFRs met

**Use CONCERNS** if:
- P1 coverage 85-90% (close to threshold)
- Minor quality issues (score 70-79)
- NFRs have mitigation plans
- Team agrees risk is acceptable

**Use FAIL** if:
- P0 coverage <100% (critical path gaps)
- P1 coverage <85%
- Critical security/performance issues
- No mitigation possible

*When in doubt, use CONCERNS* and document the risk.

## Related Guides

- [How to Run Test Design](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-test-design/) - Provides requirements for traceability
- [How to Run Test Review](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-test-review/) - Quality scores feed gate
- [How to Run NFR Assessment](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-nfr-assess/) - NFR status feeds gate

## Understanding the Concepts

- [Risk-Based Testing](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/risk-based-testing/) - Why P0 vs P3 matters
- [TEA Overview](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/) - Gate decisions in context

## Reference

- [Command: trace](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/reference/commands/#trace) - Full command reference
- [TEA Configuration](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/reference/configuration/) - Config options

---

*Generated with BMad Method - TEA (Test Engineering Architect)*
