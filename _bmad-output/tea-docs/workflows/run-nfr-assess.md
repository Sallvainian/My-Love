# How to Run NFR Assessment with TEA

## Overview

The NFR Assessment workflow in Test Architect (TEA) enables organizations to validate non-functional requirements systematically. This approach uses "evidence-based assessment across security, performance, reliability, and maintainability."

## When to Use NFR Assessment

This workflow applies best to:
- Enterprise initiatives requiring compliance validation
- Systems where security or performance is mission-critical
- Pre-production release gates
- Compliance-heavy sectors (finance, healthcare, government)

## Core Process

### 1. Initiate Assessment
Execute the `nfr-assess` command to launch the workflow and access TEA's assessment framework.

### 2. Category Selection
Select relevant NFR categories:
- **Security**: Authentication, authorization, encryption, vulnerabilities
- **Performance**: Response time, throughput, resource usage
- **Reliability**: Error handling, recovery, availability, failover
- **Maintainability**: Code quality, test coverage, technical debt

### 3. Define Thresholds
Establish specific, measurable targets. The documentation emphasizes: "Never guess thresholds." Obtain stakeholder-defined requirements rather than assumptions.

Example thresholds include P99 latency targets, minimum uptime percentages, and coverage minimums.

### 4. Gather Evidence
Compile supporting documentation:
- Security scans (npm audit, Snyk)
- Load testing results (k6, Artillery)
- Uptime metrics and monitoring data
- Code quality reports (SonarQube, coverage tools)

### 5. Review Assessment Report
TEA generates `nfr-assessment.md` containing category-by-category analysis with status indicators.

## Gate Decision Framework

TEA produces one of four outcomes:

| Decision | Meaning |
|----------|---------|
| **PASS** | All requirements met; ready for release |
| **CONCERNS** | Issues exist but mitigation plans exist |
| **FAIL** | Critical blockers prevent release |
| **WAIVED** | Business-approved exception with documented risk |

## Key Principles

**Use Real Data**: Replace assumptions with actual evidence from testing, monitoring, and scanning tools.

**Document Waivers**: If business approves deployment despite concerns, record approval parties, justification, conditions, and quantified accepted risks.

**Assess Incrementally**: Prioritize critical categories (security first) rather than attempting comprehensive assessment simultaneously.

## Post-Release Monitoring

Establish monitoring thresholds and review cadences:
- Daily performance dashboard checks
- Weekly alert trend reviews
- Monthly NFR re-assessments

## Common Pitfalls

- Defining unrealistic thresholds without stakeholder input
- Proceeding without concrete evidence
- Conflating CONCERNS (manageable issues) with FAIL (absolute blockers)
- Deploying CONCERNS status without mitigation or waiver documentation

The workflow integrates with release checklists to ensure NFR validation occurs systematically before production deployment.
