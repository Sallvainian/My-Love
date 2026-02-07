# TEA Command Reference

## Overview

This page provides a quick reference for all 9 TEA (Test Engineering Architect) workflows designed for comprehensive testing across project phases.

## Quick Index

- `teach-me-testing` - Interactive learning platform
- `framework` - Test framework scaffolding
- `ci` - CI/CD pipeline setup
- `test-design` - Risk-based test planning
- `atdd` - Acceptance test-driven development
- `automate` - Test automation expansion
- `test-review` - Quality auditing
- `nfr-assess` - Non-functional requirements validation
- `trace` - Requirements traceability and gate decisions

## teach-me-testing

**Purpose:** "Interactive learning companion - teaches testing fundamentals through advanced practices"

**Phase:** Learning/Onboarding (before other phases)

**7 Sessions:**
1. Quick Start (30 min)
2. Core Concepts (45 min)
3. Architecture (60 min)
4. Test Design (60 min)
5. ATDD & Automate (60 min)
6. Quality & Trace (45 min)
7. Advanced Patterns (ongoing)

**Outputs:** Progress tracking files, session notes, completion certificates, learning artifacts

## framework

**Purpose:** "Scaffold production-ready test framework (Playwright or Cypress)"

**Phase:** Phase 3 (Solutioning)

**Frequency:** Once per project

**Outputs:** Tests directory with fixtures/helpers, config files, environment examples, sample tests

## ci

**Purpose:** "Setup CI/CD pipeline with selective testing and burn-in"

**Phase:** Phase 3 (Solutioning)

**Frequency:** Once per project

**Outputs:** Platform-specific CI workflow, parallel execution configuration, burn-in loops, secrets checklist

## test-design

**Purpose:** "Risk-based test planning with coverage strategy"

**Phase:** Phase 3 (system-level), Phase 4 (epic-level)

**Two Outputs for System-Level:**

1. `test-design-architecture.md` - For architecture/dev teams with risk assessment and testability concerns
2. `test-design-qa.md` - For QA team with execution recipe and coverage plan

**Epic-Level:** Single document with risk scoring and mitigation strategies

## atdd

**Purpose:** "Generate failing acceptance tests BEFORE implementation (TDD red phase)"

**Phase:** Phase 4 (Implementation)

**Frequency:** Per story (optional)

**Outputs:** Failing tests, implementation checklist

## automate

**Purpose:** "Expand test coverage after implementation"

**Phase:** Phase 4 (Implementation)

**Frequency:** Per story/feature

**Outputs:** Comprehensive test suite, updated fixtures, Definition of Done summary

## test-review

**Purpose:** "Audit test quality with 0-100 scoring"

**Phase:** Phase 4 (optional), Release Gate

**Scoring Categories:**
- Determinism: 35 points
- Isolation: 25 points
- Assertions: 20 points
- Structure: 10 points
- Performance: 10 points

**Outputs:** Quality report with critical issues and recommendations

## nfr-assess

**Purpose:** "Validate non-functional requirements with evidence"

**Phase:** Phase 2 (enterprise), Release Gate

**Frequency:** Per release (enterprise projects)

**Output Categories:** Security, Performance, Reliability, Maintainability assessments

## trace

**Purpose:** "Requirements traceability + quality gate decision"

**Two-Phase Workflow:**

1. **Traceability Phase:** Requirements-to-test mapping with coverage classification
2. **Gate Decision Phase:** PASS/CONCERNS/FAIL/WAIVED determination

**Gate Rules:**
- P0 coverage: 100% required
- P1 coverage: >=90% PASS, 80-89% CONCERNS, <80% FAIL
- Overall coverage: >=80% required

## Summary Table

| Command | Phase | Frequency | Primary Output |
|---------|-------|-----------|-----------------|
| teach-me-testing | Learning | Once per learner | Progress + notes + cert |
| framework | 3 | Once | Test infrastructure |
| ci | 3 | Once | CI/CD pipeline |
| test-design | 3, 4 | System + per epic | Test design doc |
| atdd | 4 | Per story (optional) | Failing tests |
| automate | 4 | Per story | Passing tests |
| test-review | 4, Gate | Per epic/release | Quality report |
| nfr-assess | 2, Gate | Per release | NFR assessment |
| trace | 2, 4, Gate | Baseline + refresh + gate | Coverage matrix + decision |
