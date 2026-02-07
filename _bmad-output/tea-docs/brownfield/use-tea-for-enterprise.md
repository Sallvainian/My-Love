# Running TEA for Enterprise Projects

## Overview
This guide enables Test Architect (TEA) deployment on enterprise projects requiring compliance, security, audit, and regulatory adherence. It addresses non-functional requirement (NFR) assessment, audit trail generation, and evidence collection workflows.

## When to Use This
Apply this approach for:
- Enterprise track projects (not Quick Flow)
- Compliance-mandated systems (SOC 2, HIPAA, GDPR)
- Security-critical applications (finance, healthcare, government)
- Projects requiring audit trail documentation
- Strict NFR thresholds (performance, security, reliability)

## Prerequisites
- BMad Method installed with Enterprise track selected
- Available TEA agent
- Documented compliance requirements
- Identified stakeholder approval authority

## Enterprise-Specific TEA Workflows

### NFR Assessment (nfr-assess)
**Purpose:** Validate non-functional requirements with supporting evidence

**Execution Timing:** Phase 2 (early stage) and Release Gate

**Enterprise Rationale:**
- Compliance mandates specific performance thresholds
- Audit trails needed for certification
- Security requirements are contractually binding
- Performance SLAs carry legal obligations

**Implementation Example:**
```
nfr-assess
Categories: Security, Performance, Reliability, Maintainability
Security thresholds:
- Zero critical vulnerabilities (SOC 2 requirement)
- All endpoints require authentication
- Data encrypted at rest (FIPS 140-2)
- Audit logging on all data access
Evidence:
- Security scan: reports/nessus-scan.pdf
- Penetration test: reports/pentest-2026-01.pdf
- Compliance audit: reports/soc2-evidence.zip
```

**Deliverable:** NFR assessment document with PASS/CONCERNS/FAIL categorization

### Trace with Audit Evidence (trace)
**Purpose:** Generate requirements traceability with audit trail documentation

**Execution Timing:** Phase 2 (baseline), Phase 4 (refresh), Release Gate

**Enterprise Rationale:**
- Auditors require requirements-to-test mapping
- Compliance certifications demand traceability documentation
- Regulatory bodies expect evidence artifacts

**Phase 1 Example:**
```
trace Phase 1
Requirements: PRD.md (includes compliance requirements)
Test location: tests/
Output: traceability-matrix.md containing:
- Requirement-to-test mapping
- Compliance requirement coverage
- Gap prioritization
- Recommendations
```

**Phase 2 (Release Gate) Example:**
```
trace Phase 2
Generate gate-decision-{gate_type}-{story_id}.md with:
- Evidence references
- Approver signatures
- Compliance checklist
- Decision rationale
```

**Note:** Phase 2 requires test execution results. If unavailable, Phase 2 will be automatically skipped.

### Test Design with Compliance Focus (test-design)
**Purpose:** Risk assessment emphasizing compliance and security architecture

**Execution Timing:** Phase 3 (system-level), Phase 4 (epic-level)

**Enterprise Rationale:**
- Security architecture alignment validation
- Compliance requirements must be testable
- Performance requirements are contractually binding

**System-Level Example:**
```
test-design
Mode: System-level
Focus areas:
- Security architecture (authentication, authorization, encryption)
- Performance requirements (SLA: P99 <200ms)
- Compliance (HIPAA PHI handling, audit logging)
Output: TWO documents (system-level):
- test-design-architecture.md: Security gaps, compliance
  requirements, performance SLOs for Architecture team
- test-design-qa.md: Security testing strategy, compliance
  test mapping, performance testing plan for QA team
- Audit logging validation
```

## Enterprise TEA Lifecycle

### Phase 1: Discovery (Optional but Recommended)
Research compliance obligations:
```
Analyst: research
Topics:
- Industry compliance (SOC 2, HIPAA, GDPR)
- Security standards (OWASP Top 10)
- Performance benchmarks (industry P99)
```

### Phase 2: Planning (Required)

**Step 1: Define NFRs Early**
```
PM: prd
Include in PRD:
- Security requirements (authentication, encryption)
- Performance SLAs (response time, throughput)
- Reliability targets (uptime, RTO, RPO)
- Compliance mandates (data retention, audit logs)
```

**Step 2: Assess NFRs**
```
TEA: nfr-assess
Categories: All (Security, Performance, Reliability, Maintainability)
Output: nfr-assessment.md
- NFR requirements documented
- Acceptance criteria defined
- Test strategy planned
```

**Step 3: Baseline (Brownfield Only)**
```
TEA: trace Phase 1
Establish baseline coverage before new work
```

### Phase 3: Solutioning (Required)

**Step 1: Architecture with Testability Review**
```
Architect: architecture
TEA: test-design (system-level)
Focus:
- Security architecture testability
- Performance testing strategy
- Compliance requirement mapping
```

**Step 2: Test Infrastructure**
```
TEA: framework
Requirements:
- Separate test environments (dev, staging, prod-mirror)
- Secure test data handling (PHI, PII)
- Audit logging in tests
```

**Step 3: CI/CD with Compliance**
```
TEA: ci
Requirements:
- Secrets management (Vault, AWS Secrets Manager)
- Test isolation (no cross-contamination)
- Artifact retention (compliance audit trail)
- Access controls (who can run production tests)
```

### Phase 4: Implementation (Required)
Per epic execution sequence:
```
1. TEA: test-design (epic-level)
   Focus: Compliance, security, performance for THIS epic
2. TEA: atdd (optional)
   Generate tests including security/compliance scenarios
3. DEV: Implement story
4. TEA: automate
   Expand coverage including compliance edge cases
5. TEA: test-review
   Audit quality (score >80 per epic, rises to >85 at release)
6. TEA: trace Phase 1
   Refresh coverage, verify compliance requirements tested
```

### Release Gate (Required)

**Step 1: Final NFR Assessment**
```
TEA: nfr-assess
All categories (if not done earlier)
Latest evidence (performance tests, security scans)
```

**Step 2: Final Quality Audit**
```
TEA: test-review tests/
Full suite review
Quality target: >85 for enterprise
```

**Step 3: Gate Decision**
```
TEA: trace Phase 2
Evidence required:
- traceability-matrix.md (from Phase 1)
- test-review.md (from quality audit)
- nfr-assessment.md (from NFR assessment)
- Test execution results (must have test results available)
Decision: PASS/CONCERNS/FAIL/WAIVED
Archive all artifacts for compliance audit
```

**Step 4: Archive for Audit**
```
Archive:
- All test results
- Coverage reports
- NFR assessments
- Gate decisions
- Approver signatures
Retention: Per compliance requirements (7 years for HIPAA)
```

## Enterprise-Specific Requirements

### Evidence Collection

**Required Artifacts:**
- Requirements traceability matrix
- Test execution results (with timestamps)
- NFR assessment reports
- Security scan results
- Performance test results
- Gate decision records
- Approver signatures

**Directory Structure Example:**
```
compliance/
  2026-Q1/
    release-1.2.0/
      traceability-matrix.md
      test-review.md
      nfr-assessment.md
      gate-decision-release-v1.2.0.md
      test-results/
      security-scans/
      approvals.pdf
```

**Retention Periods:**
- HIPAA: 7 years
- SOC 2: 3 years
- Adjust per specific compliance needs

### Approver Workflows

**Multi-Level Approval Structure:**
```
## Gate Approvals Required
### Technical Approval
- [ ] QA Lead - Test coverage adequate
- [ ] Tech Lead - Technical quality acceptable
- [ ] Security Lead - Security requirements met
### Business Approval
- [ ] Product Manager - Business requirements met
- [ ] Compliance Officer - Regulatory requirements met
### Executive Approval (for major releases)
- [ ] VP Engineering - Overall quality acceptable
- [ ] CTO - Architecture approved for production
```

### Compliance Checklists

**SOC 2 Example:**
```
## SOC 2 Compliance Checklist
### Access Controls
- [ ] All API endpoints require authentication
- [ ] Authorization tested for all protected resources
- [ ] Session management secure (token expiration tested)
### Audit Logging
- [ ] All data access logged
- [ ] Logs immutable (append-only)
- [ ] Log retention policy enforced
### Data Protection
- [ ] Data encrypted at rest (tested)
- [ ] Data encrypted in transit (HTTPS enforced)
- [ ] PII handling compliant (masking tested)
### Testing Evidence
- [ ] Test coverage >80% (verified)
- [ ] Security tests passing (100%)
- [ ] Traceability matrix complete
```

**HIPAA Example:**
```
## HIPAA Compliance Checklist
### PHI Protection
- [ ] PHI encrypted at rest (AES-256)
- [ ] PHI encrypted in transit (TLS 1.3)
- [ ] PHI access logged (audit trail)
### Access Controls
- [ ] Role-based access control (RBAC tested)
- [ ] Minimum necessary access (tested)
- [ ] Authentication strong (MFA tested)
### Breach Notification
- [ ] Breach detection tested
- [ ] Notification workflow tested
- [ ] Incident response plan tested
```

## Enterprise Tips

### Start with Security

**Priority 1: Security Requirements**
```
1. Document all security requirements
2. Generate security tests with `atdd`
3. Run security test suite
4. Pass security audit BEFORE moving forward
```

**Rationale:** Security failures block all enterprise initiatives

**RBAC Testing Example - Vanilla Playwright:**
```javascript
test('should enforce role-based access', async ({ request }) => {
  // Login as regular user
  const userResp = await request.post('/api/auth/login', {
    data: { email: 'user@example.com', password: 'pass' },
  });
  const { token: userToken } = await userResp.json();

  // Try to access admin endpoint
  const adminResp = await request.get('/api/admin/users', {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  expect(adminResp.status()).toBe(403); // Forbidden
});
```

**RBAC Testing - With Playwright Utils (Recommended):**
```javascript
import { test as base, expect } from '@playwright/test';
import { test as apiRequestFixture }
  from '@seontechnologies/playwright-utils/api-request/fixtures';
import { createAuthFixtures }
  from '@seontechnologies/playwright-utils/auth-session';
import { mergeTests } from '@playwright/test';

const authFixtureTest = base.extend(createAuthFixtures());
export const testWithAuth = mergeTests(apiRequestFixture, authFixtureTest);

testWithAuth('should enforce role-based access',
  async ({ apiRequest, authToken }) => {
    // Auth token from fixture (configured for 'user' role)
    const { status } = await apiRequest({
      method: 'GET',
      path: '/api/admin/users', // Admin endpoint
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(status).toBe(403); // Regular user denied
});

testWithAuth('admin can access admin endpoint',
  async ({ apiRequest, authToken, authOptions }) => {
    // Override to admin role
    authOptions.userIdentifier = 'admin';

    const { status, body } = await apiRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(status).toBe(200); // Admin allowed
    expect(body).toBeInstanceOf(Array);
});
```

**Note:** Auth-session requires provider setup in global-setup.ts

**Playwright Utils Benefits for Compliance:**
- Multi-user authentication testing (regular, admin, etc.)
- Token persistence (faster test execution)
- Consistent authentication patterns (audit trail)
- Automatic cleanup

### Set Higher Quality Thresholds

**Enterprise Quality Targets:**
- Test coverage: >85% (standard: 80%)
- Quality score: >85 (standard: 75%)
- P0 coverage: 100% (non-negotiable)
- P1 coverage: >95% (standard: 90%)

**Rationale:** Enterprise systems impact more users with higher stakes

### Document Everything

**Auditor Requirements:**
- Decision rationale (why decisions were made)
- Approval authority (who approved)
- Timestamps (when occurred)
- Evidence artifacts (test results, scan reports)

**TEA's Structured Support:**
- Reports include timestamps
- Decisions include rationale
- Evidence is cross-referenced
- Audit trail is automatic

### Budget for Compliance Testing

**Enterprise Testing Cost Factors:**
- Penetration testing: $10,000-$50,000
- Security audits: $5,000-$20,000
- Performance testing tools: $500-$5,000/month
- Compliance consulting: $200-$500/hour

**Planning Recommendations:**
- Include in project cost
- Schedule 3+ months early
- Consider non-optional (non-negotiable for compliance)

### Use External Validators

**Don't Self-Certify:**
- Penetration testing: Hire external firm
- Security audits: Independent auditor
- Compliance: Certification body
- Performance: Load testing service

**TEA's Role:** Prepare for external validation, not replace it

## Related Guides
- How to Run NFR Assessment - Deep NFR analysis
- How to Run Trace - Gate decisions
- How to Run Test Review - Quality audits
- How to Run Test Design - Compliance planning
- Using TEA with Existing Tests - Brownfield patterns
- Integrate Playwright Utils - Production utilities

## Understanding the Concepts
- Engagement Models - Enterprise model
- Risk-Based Testing - Probability x impact scoring
- Test Quality Standards - Enterprise thresholds
- TEA Overview - Complete lifecycle

## Reference
- TEA Command Reference - All workflows
- TEA Configuration - Enterprise options
- Knowledge Base Index - Testing patterns
- Glossary - TEA terminology
