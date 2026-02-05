---
name: 'step-03d-subprocess-coverage'
description: 'Subprocess: Check test coverage (completeness, edge cases)'
subprocess: true
outputFile: '/tmp/tea-test-review-coverage-{{timestamp}}.json'
---

# Subprocess 3D: Coverage Quality Check

## SUBPROCESS CONTEXT

This is an **isolated subprocess** running in parallel with other quality dimension checks.

**Your task:** Analyze test files for COVERAGE violations only.

---

## MANDATORY EXECUTION RULES

- ✅ Check COVERAGE only (not other quality dimensions)
- ✅ Output structured JSON to temp file
- ❌ Do NOT check determinism, isolation, maintainability, or performance

---

## SUBPROCESS TASK

### 1. Identify Coverage Violations

Classify severity by AC (acceptance criteria) and test-design priority:

**HIGH** — AC explicitly requires behavior AND no test exists (not even partial):
- P0 functionality from AC with zero test coverage
- API endpoint specified in AC without any test
- Error handling required by AC but no negative test

**MEDIUM** — AC behavior has only partial coverage, OR planned P0/P1 test missing:
- AC behavior tested only on happy path (error scenarios missing)
- Test-design planned test at P0/P1 not implemented
- Assertion gap: test runs code path but doesn't verify AC-specified outcome

**LOW** — Behavior implied but not explicitly in AC, or lower-priority gap:
- Test-design planned test at P2/P3 not implemented
- Behavior inferred from domain (not in AC text)
- Testing at different level than planned (component vs E2E)

### 2. Calculate Coverage Score

```javascript
// Standard severity-weighted formula (matches all other dimensions)
const severityWeights = { HIGH: 10, MEDIUM: 5, LOW: 2 };
const totalPenalty = violations.reduce((sum, v) => sum + severityWeights[v.severity], 0);
let score = Math.max(0, 100 - totalPenalty);

// Cap at 50 if any HIGH violations exist (critical coverage gaps)
if (violations.some((v) => v.severity === 'HIGH')) {
  score = Math.min(score, 50);
}
```

---

## OUTPUT FORMAT

```json
{
  "dimension": "coverage",
  "score": 70,
  "max_score": 100,
  "grade": "C",
  "violations": [
    {
      "file": "tests/api/",
      "severity": "HIGH",
      "category": "missing-endpoint-tests",
      "description": "API endpoint /api/users/delete not tested",
      "suggestion": "Add tests for user deletion including error scenarios"
    },
    {
      "file": "tests/e2e/checkout.spec.ts",
      "line": 25,
      "severity": "MEDIUM",
      "category": "missing-error-case",
      "description": "Only happy path tested - no error handling tests",
      "suggestion": "Add tests for payment failure, network errors, validation failures"
    }
  ],
  "passed_checks": 8,
  "failed_checks": 4,
  "violation_summary": {
    "HIGH": 1,
    "MEDIUM": 2,
    "LOW": 1
  },
  "coverage_gaps": {
    "untested_endpoints": ["/api/users/delete", "/api/orders/cancel"],
    "untested_user_paths": ["Password reset flow"],
    "missing_error_scenarios": ["Payment failures", "Network timeouts"]
  },
  "recommendations": [
    "Add tests for all CRUD operations (especially DELETE)",
    "Test error scenarios for each user path",
    "Add integration tests between API and E2E layers"
  ],
  "summary": "Coverage has critical gaps - 4 violations (1 HIGH critical endpoint missing)"
}
```

---

## EXIT CONDITION

Subprocess completes when JSON output written to temp file.

**Subprocess terminates here.**
