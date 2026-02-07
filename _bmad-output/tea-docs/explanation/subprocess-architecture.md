# Subprocess Architecture for TEA Workflows

## Overview

The Test Architect (TEA) framework implements subprocess patterns to parallelize independent tasks across five key workflows. This architecture improves performance while maintaining clean separation of concerns through isolated, 200k-container execution environments.

## Core Subprocess Pattern

### Architecture

The fundamental design follows an orchestrator model:

```
Main Workflow (Orchestrator)
├── Step 1: Setup & Context Loading
├── Step 2: Launch Subprocesses
│   ├── Subprocess A -> temp-file-a.json
│   ├── Subprocess B -> temp-file-b.json
│   ├── Subprocess C -> temp-file-c.json
│   └── (All run in parallel, isolated 200k containers)
└── Step 3: Aggregate Results
    ├── Read all temp files
    ├── Merge/synthesize outputs
    └── Generate final artifact
```

### Key Principles

1. **Independence**: Each subprocess operates completely independently with no shared state
2. **Isolation**: Separate 200k context containers for each subprocess
3. **Output Format**: Structured JSON to temporary files
4. **Aggregation**: Main workflow reads and synthesizes temp file outputs
5. **Error Handling**: Success/failure reporting in JSON output

## Workflow-Specific Designs

### 1. automate - Parallel Test Generation

**Objective**: Generate API and E2E tests simultaneously

**Architecture**:
```
automate workflow
├── Step 1: Analyze codebase & identify features
├── Step 2: Load relevant knowledge fragments
├── Step 3: Launch parallel test generation
│   ├── Subprocess A: API tests -> /tmp/api-tests-{timestamp}.json
│   └── Subprocess B: E2E tests -> /tmp/e2e-tests-{timestamp}.json
├── Step 4: Aggregate tests
├── Step 5: Verify all tests pass
└── Step 6: Generate DoD summary
```

**Subprocess A Input** (API Tests):
```json
{
  "features": ["feature1", "feature2"],
  "knowledge_fragments": ["api-request", "data-factories"],
  "config": {
    "use_playwright_utils": true,
    "framework": "playwright"
  }
}
```

**Subprocess A Output**:
```json
{
  "success": true,
  "tests": [
    {
      "file": "tests/api/feature1.spec.ts",
      "content": "import { test, expect } from '@playwright/test';\n...",
      "description": "API tests for feature1"
    }
  ],
  "fixtures": [],
  "summary": "Generated 5 API test cases"
}
```

**Subprocess B Output** (E2E Tests):
```json
{
  "success": true,
  "tests": [
    {
      "file": "tests/e2e/feature1.spec.ts",
      "content": "import { test, expect } from '@playwright/test';\n...",
      "description": "E2E tests for feature1 user journey"
    }
  ],
  "fixtures": ["authFixture", "dataFixture"],
  "summary": "Generated 8 E2E test cases"
}
```

**Aggregation Logic**:
```javascript
const apiTests = JSON.parse(fs.readFileSync('/tmp/api-tests-{timestamp}.json', 'utf8'));
const e2eTests = JSON.parse(fs.readFileSync('/tmp/e2e-tests-{timestamp}.json', 'utf8'));

const allTests = [...apiTests.tests, ...e2eTests.tests];
const allFixtures = [...new Set([...apiTests.fixtures, ...e2eTests.fixtures])];

const summary = {
  total_tests: allTests.length,
  api_tests: apiTests.tests.length,
  e2e_tests: e2eTests.tests.length,
  fixtures: allFixtures,
  status: apiTests.success && e2eTests.success ? 'PASS' : 'FAIL',
};
```

### 2. atdd - Parallel Failing Test Generation

**Objective**: Generate failing API and E2E tests in parallel (TDD red phase)

**Key Difference**: Tests intentionally fail before implementation exists. Subprocesses output includes `"expected_to_fail": true` in summaries.

**Architecture**:
```
atdd workflow
├── Step 1: Load story acceptance criteria
├── Step 2: Load relevant knowledge fragments
├── Step 3: Launch parallel test generation
│   ├── Subprocess A: Failing API tests -> /tmp/atdd-api-{timestamp}.json
│   └── Subprocess B: Failing E2E tests -> /tmp/atdd-e2e-{timestamp}.json
├── Step 4: Aggregate tests
├── Step 5: Verify tests fail (red phase)
└── Step 6: Output ATDD checklist
```

### 3. test-review - Parallel Quality Dimension Checks

**Objective**: Run independent quality checks in parallel, aggregating into 0-100 score

**Architecture**:
```
test-review workflow
├── Step 1: Load test files & context
├── Step 2: Launch parallel quality checks
│   ├── Subprocess A: Determinism -> /tmp/determinism-{timestamp}.json
│   ├── Subprocess B: Isolation -> /tmp/isolation-{timestamp}.json
│   ├── Subprocess C: Maintainability -> /tmp/maintainability-{timestamp}.json
│   ├── Subprocess D: Coverage -> /tmp/coverage-{timestamp}.json
│   └── Subprocess E: Performance -> /tmp/performance-{timestamp}.json
└── Step 3: Aggregate findings
    ├── Calculate weighted score (0-100)
    ├── Synthesize violations
    └── Generate review report with suggestions
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
  "failed_checks": 3,
  "summary": "Tests are mostly deterministic with 3 violations"
}
```

**Aggregation Logic**:
```javascript
const dimensions = ['determinism', 'isolation', 'maintainability', 'coverage', 'performance'];
const results = dimensions.map((d) =>
  JSON.parse(fs.readFileSync(`/tmp/${d}-{timestamp}.json`, 'utf8'))
);

const weights = {
  determinism: 0.25,
  isolation: 0.25,
  maintainability: 0.2,
  coverage: 0.15,
  performance: 0.15
};
const totalScore = results.reduce((sum, r) =>
  sum + r.score * weights[r.dimension], 0
);

const allViolations = results.flatMap((r) => r.violations);
const highSeverity = allViolations.filter((v) => v.severity === 'HIGH');
const mediumSeverity = allViolations.filter((v) => v.severity === 'MEDIUM');
const lowSeverity = allViolations.filter((v) => v.severity === 'LOW');

const report = {
  overall_score: Math.round(totalScore),
  grade: getGrade(totalScore),
  dimensions: results,
  violations_summary: {
    high: highSeverity.length,
    medium: mediumSeverity.length,
    low: lowSeverity.length,
    total: allViolations.length,
  },
  top_suggestions: prioritizeSuggestions(allViolations),
};
```

### 4. nfr-assess - Parallel NFR Domain Assessments

**Objective**: Assess independent non-functional requirement domains in parallel

**Architecture**:
```
nfr-assess workflow
├── Step 1: Load system context
├── Step 2: Launch parallel NFR assessments
│   ├── Subprocess A: Security -> /tmp/nfr-security-{timestamp}.json
│   ├── Subprocess B: Performance -> /tmp/nfr-performance-{timestamp}.json
│   ├── Subprocess C: Reliability -> /tmp/nfr-reliability-{timestamp}.json
│   └── Subprocess D: Scalability -> /tmp/nfr-scalability-{timestamp}.json
└── Step 3: Aggregate NFR report
    ├── Synthesize domain assessments
    ├── Identify cross-domain risks
    └── Generate compliance documentation
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
      "recommendations": [
        "Enable database encryption",
        "Use AWS KMS for key management"
      ]
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
```javascript
const domains = ['security', 'performance', 'reliability', 'scalability'];
const assessments = domains.map((d) =>
  JSON.parse(fs.readFileSync(`/tmp/nfr-${d}-{timestamp}.json`, 'utf8'))
);

const riskLevels = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
const maxRiskLevel = Math.max(...assessments.map((a) => riskLevels[a.risk_level]));
const overallRisk = Object.keys(riskLevels).find((k) => riskLevels[k] === maxRiskLevel);

const allCompliance = assessments.flatMap((a) => Object.entries(a.compliance));
const complianceSummary = {};
allCompliance.forEach(([std, status]) => {
  if (!complianceSummary[std]) complianceSummary[std] = [];
  complianceSummary[std].push(status);
});

const crossDomainRisks = identifyCrossDomainRisks(assessments);

const report = {
  overall_risk: overallRisk,
  domains: assessments,
  compliance_summary: complianceSummary,
  cross_domain_risks: crossDomainRisks,
  priority_actions: assessments.flatMap((a) => a.priority_actions),
  executive_summary: generateExecutiveSummary(assessments),
};
```

### 5. trace - Two-Phase Workflow Separation

**Objective**: Clean separation of coverage matrix generation and gate decision

**Note**: This pattern uses phase separation rather than parallel subprocesses; Phase 2 depends on Phase 1 output.

**Architecture**:
```
trace workflow
├── Phase 1: Coverage Matrix
│   ├── Step 1: Load requirements
│   ├── Step 2: Analyze test suite
│   └── Step 3: Generate traceability matrix -> /tmp/trace-matrix-{timestamp}.json
└── Phase 2: Gate Decision (depends on Phase 1 output)
    ├── Step 4: Read coverage matrix
    ├── Step 5: Apply decision tree logic
    ├── Step 6: Calculate coverage percentages
    └── Step 7: Generate gate decision (PASS/CONCERNS/FAIL/WAIVED)
```

**Phase 1 Output Format**:
```json
{
  "requirements": [
    {
      "id": "REQ-001",
      "description": "User can login with email/password",
      "priority": "P0",
      "tests": ["tests/auth/login.spec.ts::should login with valid credentials"],
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

**Phase 2: Gate Decision Logic**:
```javascript
const matrix = JSON.parse(fs.readFileSync('/tmp/trace-matrix-{timestamp}.json', 'utf8'));

const p0Coverage = matrix.requirements.filter((r) =>
  r.priority === 'P0' && r.coverage === 'FULL'
).length;
const totalP0 = matrix.requirements.filter((r) => r.priority === 'P0').length;

let gateDecision;
if (p0Coverage === totalP0 && matrix.coverage_percentage >= 90) {
  gateDecision = 'PASS';
} else if (p0Coverage === totalP0 && matrix.coverage_percentage >= 75) {
  gateDecision = 'CONCERNS';
} else if (p0Coverage < totalP0) {
  gateDecision = 'FAIL';
} else {
  gateDecision = 'WAIVED';
}

const report = {
  decision: gateDecision,
  coverage_matrix: matrix,
  p0_coverage: `${p0Coverage}/${totalP0}`,
  overall_coverage: `${matrix.coverage_percentage}%`,
  recommendations: generateRecommendations(matrix, gateDecision),
  uncovered_requirements: matrix.requirements.filter((r) => r.coverage === 'NONE'),
};
```

## Implementation Guidelines

### Temp File Management

**Naming Convention**:
```
/tmp/{workflow}-{subprocess-name}-{timestamp}.json
```

**Examples**:
- `/tmp/automate-api-tests-20260127-143022.json`
- `/tmp/test-review-determinism-20260127-143022.json`
- `/tmp/nfr-security-20260127-143022.json`

**Cleanup Strategy**:
- Delete temp files after successful aggregation
- Preserve files on error for debugging
- Implement retry logic for temp file reads to handle race conditions

### Error Handling

Each subprocess JSON output must include:
```json
{
  "success": true|false,
  "error": "Error message if failed",
  "data": { ... }
}
```

Main workflow aggregation must:
1. Check `success` field for each subprocess
2. Aggregate error messages if any subprocess fails
3. Decide whether to continue (partial success) or fail (critical subprocess failed)

### Performance Considerations

**Subprocess Isolation**:
- Each subprocess runs in separate 200k context container
- No shared memory or state
- Communication exclusively via JSON files

**Parallelization**:
- Use Claude Code's subprocess/agent launching capabilities
- Ensure unique temp file paths (timestamp-based)
- Implement proper synchronization (wait for all subprocesses to complete)

## Testing Subprocess Workflows

### Test Checklist

For each workflow with subprocesses:

**Unit Testing**:
- Test each subprocess in isolation
- Provide mock input JSON
- Verify output JSON structure
- Test error scenarios

**Integration Testing**:
- Launch all subprocesses
- Verify parallel execution
- Verify aggregation logic
- Test with real project data

**Performance Testing**:
- Benchmark sequential vs parallel execution
- Measure subprocess overhead
- Verify memory usage acceptable

**Error Handling Testing**:
- One subprocess fails
- Multiple subprocesses fail
- Temp file read/write errors
- Timeout scenarios

### Expected Performance Gains

**automate**:
- Sequential: ~5-10 minutes (API then E2E)
- Parallel: ~3-6 minutes (both simultaneously)
- **Speedup: ~40-50%**

**test-review**:
- Sequential: ~3-5 minutes (5 quality checks sequentially)
- Parallel: ~1-2 minutes (all checks simultaneously)
- **Speedup: ~60-70%**

**nfr-assess**:
- Sequential: ~8-12 minutes (4 NFR domains sequentially)
- Parallel: ~3-5 minutes (all domains simultaneously)
- **Speedup: ~60-70%**

## Documentation for Users

Users need awareness of:

1. **Performance**: Certain workflows leverage parallel execution optimization
2. **Temp Files**: Workflows create temporary files during execution (automatically cleaned)
3. **Progress Indicators**: Multiple "subprocess" indicators may appear during execution
4. **Debugging**: Temp files preserved on failure for troubleshooting purposes

## Future Enhancements

1. **Subprocess Pooling**: Reuse subprocess containers for multiple operations
2. **Adaptive Parallelization**: Dynamically decide parallelization based on workload
3. **Progress Reporting**: Real-time progress updates from each subprocess
4. **Caching**: Cache subprocess outputs for identical inputs
5. **Distributed Execution**: Run subprocesses on different machines for massive parallelization

## References

- BMad Builder subprocess examples: `_bmad/bmb/workflows/*/subprocess-*.md`
- Claude Code agent/subprocess documentation
- TEA Workflow validation reports (proof of 100% compliance)

**Status**: Ready for implementation across 5 workflows
