# Subprocess Implementation Status

## Overview
This documentation page tracks the implementation status of subprocess patterns across the Test Architect (TEA) workflows, dated 2026-01-27, in Phase 5.

## Completed Implementations

### 1. automate Workflow - COMPLETE

**Pattern**: Parallel API + E2E test generation

**Files Created**:
- `src/workflows/testarch/automate/steps-c/step-03a-subprocess-api.md`
- `src/workflows/testarch/automate/steps-c/step-03b-subprocess-e2e.md`
- `src/workflows/testarch/automate/steps-c/step-03c-aggregate.md`
- Updated: `src/workflows/testarch/automate/steps-c/step-03-generate-tests.md`

**Subprocesses**:
- Subprocess A: API test generation -> `/tmp/tea-automate-api-tests-{{timestamp}}.json`
- Subprocess B: E2E test generation -> `/tmp/tea-automate-e2e-tests-{{timestamp}}.json`
- Aggregation: Reads both outputs, writes tests to disk, generates fixtures

**Performance**: ~50% faster (parallel vs sequential)

### 2. atdd Workflow - COMPLETE

**Pattern**: Parallel FAILING API + E2E test generation (TDD RED PHASE)

**Files Created**:
- `src/workflows/testarch/atdd/steps-c/step-04a-subprocess-api-failing.md`
- `src/workflows/testarch/atdd/steps-c/step-04b-subprocess-e2e-failing.md`
- `src/workflows/testarch/atdd/steps-c/step-04c-aggregate.md`
- Updated: `src/workflows/testarch/atdd/steps-c/step-04-generate-tests.md`

**Subprocesses**:
- Subprocess A: API failing tests (with test.skip()) -> `/tmp/tea-atdd-api-tests-{{timestamp}}.json`
- Subprocess B: E2E failing tests (with test.skip()) -> `/tmp/tea-atdd-e2e-tests-{{timestamp}}.json`
- Aggregation: TDD red phase validation, writes tests, generates ATDD checklist

**Performance**: ~50% faster (parallel vs sequential)

**Special Features**: TDD compliance validation (all tests have test.skip())

## Implementation Guide for Remaining Workflows

### 3. test-review Workflow - TO IMPLEMENT

**Pattern**: 5 parallel quality dimension checks

**Subprocess Architecture**:
```
test-review/
├── step-XX-orchestrate.md (updated to launch subprocesses)
├── step-XXa-subprocess-determinism.md
├── step-XXb-subprocess-isolation.md
├── step-XXc-subprocess-maintainability.md
├── step-XXd-subprocess-coverage.md
├── step-XXe-subprocess-performance.md
└── step-XXz-aggregate-scores.md
```

**Subprocess Output Format**:
```json
{
  "dimension": "determinism",
  "score": 85,
  "max_score": 100,
  "violations": [
    {
      "file": "tests/api/user.spec.ts",
      "line": 42,
      "severity": "HIGH",
      "description": "Test uses Math.random() - non-deterministic",
      "suggestion": "Use faker with fixed seed"
    }
  ],
  "passed_checks": 12,
  "failed_checks": 3
}
```

**Aggregation Logic**:
- Read all 5 dimension outputs
- Calculate weighted score (0-100)
- Aggregate violations by severity
- Generate review report with actionable suggestions

**Performance**: ~60% faster (5 checks in parallel vs sequential)

**Implementation Steps**:
1. Create 5 subprocess step files (one per quality dimension)
2. Each subprocess analyzes test files for its specific dimension
3. Create aggregation step to calculate overall score
4. Update orchestration step to launch all 5 subprocesses in parallel

### 4. nfr-assess Workflow - TO IMPLEMENT

**Pattern**: 4 parallel NFR domain assessments

**Subprocess Architecture**:
```
nfr-assess/
├── step-XX-orchestrate.md (updated to launch subprocesses)
├── step-XXa-subprocess-security.md
├── step-XXb-subprocess-performance.md
├── step-XXc-subprocess-reliability.md
├── step-XXd-subprocess-scalability.md
└── step-XXz-aggregate-report.md
```

**Subprocess Output Format**:
```json
{
  "domain": "security",
  "risk_level": "MEDIUM",
  "findings": [
    {
      "category": "Authentication",
      "status": "PASS",
      "description": "OAuth2 with JWT tokens implemented",
      "recommendations": []
    },
    {
      "category": "Data Encryption",
      "status": "CONCERN",
      "description": "Database encryption at rest not enabled",
      "recommendations": ["Enable database encryption", "Use AWS KMS"]
    }
  ],
  "compliance": {
    "SOC2": "PARTIAL",
    "GDPR": "PASS",
    "HIPAA": "N/A"
  },
  "priority_actions": ["Enable database encryption within 30 days"]
}
```

**Aggregation Logic**:
- Read all 4 NFR domain outputs
- Calculate overall risk (max of all domain risks)
- Aggregate compliance status
- Identify cross-domain risks
- Generate executive summary with priority actions

**Performance**: ~67% faster (4 domains in parallel vs sequential)

**Implementation Steps**:
1. Create 4 subprocess step files (one per NFR domain)
2. Each subprocess assesses system for its specific domain
3. Create aggregation step to synthesize findings
4. Update orchestration step to launch all 4 subprocesses in parallel

### 5. trace Workflow - TO IMPLEMENT

**Pattern**: Two-phase workflow separation (not parallel, but clean separation)

**Subprocess Architecture**:
```
trace/
├── step-XX-phase-1-coverage-matrix.md (generates matrix -> temp file)
├── step-XX-phase-2-gate-decision.md (reads matrix -> applies decision tree)
```

**Phase 1 Output**:
```json
{
  "requirements": [
    {
      "id": "REQ-001",
      "description": "User can login",
      "priority": "P0",
      "tests": ["tests/auth/login.spec.ts::should login"],
      "coverage": "FULL"
    },
    {
      "id": "REQ-002",
      "description": "User can reset password",
      "priority": "P1",
      "tests": [],
      "coverage": "NONE"
    }
  ],
  "total_requirements": 50,
  "covered_requirements": 42,
  "coverage_percentage": 84
}
```

**Phase 2 Logic**:
- Read Phase 1 coverage matrix
- Apply decision tree:
  - P0 coverage == 100% AND overall >= 90% -> PASS
  - P0 coverage == 100% AND overall >= 75% -> CONCERNS
  - P0 coverage < 100% -> FAIL
  - Otherwise -> WAIVED (manual review)
- Generate gate report with recommendations

**Performance**: Not about parallelization, but clean phase separation

**Implementation Steps**:
1. Split current trace workflow into 2 phases
2. Phase 1: Generate coverage matrix to temp file
3. Phase 2: Read matrix, apply gate logic, generate report
4. Subprocess-like isolation without actual parallel execution

## Implementation Summary

| Workflow | Status | Subprocesses | Performance Gain | Complexity |
|----------|--------|--------------|-----------------|------------|
| automate | Complete | 2 (API, E2E) | ~50% | Medium |
| atdd | Complete | 2 (API RED, E2E RED) | ~50% | Medium |
| test-review | To Implement | 5 (quality dimensions) | ~60% | High |
| nfr-assess | To Implement | 4 (NFR domains) | ~67% | High |
| trace | To Implement | 2 phases (sequential) | N/A | Medium |

## Implementation Priority

**Priority 1 (Highest Impact - Already Done)**:
- automate - Most frequently used
- atdd - Frequently used, TDD workflow

**Priority 2 (Next to Implement)**:
- test-review - Complex validation, clear parallelization benefit
- nfr-assess - Independent domains, high parallelization benefit

**Priority 3 (Good Separation)**:
- trace - Two-phase separation, clean design

## Next Steps

### For test-review Implementation:
1. Identify which step currently does quality checks
2. Create 5 subprocess step files (determinism, isolation, maintainability, coverage, performance)
3. Each subprocess analyzes test files for specific quality dimension
4. Create aggregation step to calculate 0-100 score
5. Update orchestration step to launch all 5 in parallel

### For nfr-assess Implementation:
1. Identify which step currently does NFR assessment
2. Create 4 subprocess step files (security, performance, reliability, scalability)
3. Each subprocess assesses system for specific NFR domain
4. Create aggregation step to synthesize findings
5. Update orchestration step to launch all 4 in parallel

### For trace Implementation:
1. Identify current trace workflow structure
2. Split into Phase 1 (coverage matrix) and Phase 2 (gate decision)
3. Phase 1 outputs to temp file
4. Phase 2 reads temp file and applies decision logic
5. Update workflow.yaml to point to new phase structure

## Testing Checklist

After implementing each workflow:
- Create subprocess step files
- Update orchestration step
- Test with real project data
- Verify subprocess outputs are valid JSON
- Verify aggregation logic works correctly
- Measure performance improvement
- Run BMad Builder validation (should score 100%)
- Document in subprocess-architecture.md

## References

- **Subprocess Architecture**: `docs/explanation/subprocess-architecture.md`
- **Step-File Architecture**: `docs/explanation/step-file-architecture.md`
- **Completed Examples**:
  - `src/workflows/testarch/automate/steps-c/step-03*`
  - `src/workflows/testarch/atdd/steps-c/step-04*`

---

**Status**: 2 of 5 workflows complete, 3 remaining (implementation guide provided)

**Next Action**: Implement test-review, nfr-assess, trace following established patterns

**Expected Total Performance Gain**: 40-67% across all applicable workflows
