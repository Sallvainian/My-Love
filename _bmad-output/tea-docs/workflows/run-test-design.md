# How to Run Test Design with TEA

## Overview
TEA's `test-design` workflow creates comprehensive test plans with risk assessment and coverage strategies. This guide covers the complete process from workflow initiation through output review.

## When to Use This

**System-level (Phase 3):**
- After architecture completion
- Before implementation-readiness gate
- For validating architecture testability

**Epic-level (Phase 4):**
- At epic initiation
- Before story implementation
- For identifying epic-specific testing needs

**Prerequisites:**
- BMad Method installed
- TEA agent available
- Architecture document (system-level)
- Epic definition with stories (epic-level)

## Steps

### 1. Load the TEA Agent
Start a fresh chat and load the TEA (Test Engineering Architect) agent.

### 2. Run the Test Design Workflow
```
test-design
```

### 3. Specify the Mode
TEA prompts for selection:
- **System-level** — Architecture testability review (Phase 3)
- **Epic-level** — Epic-specific test planning (Phase 4)

### 4. Provide Context
**System-level:** Point to architecture document and ADRs

**Epic-level:** Specify epic and reference epic file with stories

### 5. Review the Output
TEA generates test design document(s) based on selected mode.

## What You Get

### System-Level Output (Two Documents)

**`test-design-architecture.md`** (Architecture/Dev Teams)
- Architectural concerns and testability gaps
- Quick Guide with BLOCKERS / HIGH PRIORITY / INFO ONLY
- Risk assessment (high/medium/low-priority with scoring)
- Testability concerns and architectural gaps
- Risk mitigation plans for high-priority risks (>=6)
- Assumptions and dependencies

**`test-design-qa.md`** (QA Team)
- Test execution recipe and coverage plan
- Quick Reference (Before You Start, Execution Order, Help)
- System architecture summary
- Test environment requirements
- Testability assessment with prerequisites checklist
- Test levels strategy (unit/integration/E2E split)
- Test coverage plan (P0/P1/P2/P3 with detailed scenarios and checkboxes)
- Sprint 0 setup requirements
- NFR readiness summary

**Document Rationale:**
- Architecture teams scan blockers in <5 minutes (Quick Guide format)
- QA teams receive actionable test recipes (step-by-step with checklists)
- No redundancy between documents (cross-references used instead)
- Clear separation of concerns (deliverables vs. testing approach)

### Epic-Level Output (One Document)

**`test-design-epic-N.md`** (Combined risk assessment + test plan)
- Epic risk assessment
- Test priorities (P0-P3)
- Coverage plan
- Regression hotspots (brownfield context)
- Integration risks
- Mitigation strategies

## Test Design for Different Tracks

| Track | Phase 3 Focus | Phase 4 Focus |
|-------|---------------|---------------|
| **Greenfield** | System-level testability review | Per-epic risk assessment and test plan |
| **Brownfield** | System-level + existing test baseline | Regression hotspots, integration risks |
| **Enterprise** | Compliance-aware testability | Security/performance/compliance focus |

## Examples

**System-Level (Two Documents):**
- `cluster-search/cluster-search-test-design-architecture.md` — Architecture doc with Quick Guide
- `cluster-search/cluster-search-test-design-qa.md` — QA doc with test scenarios

**Key Pattern:**
- Architecture doc: "ASR-1: OAuth 2.1 required (see QA doc for 12 test scenarios)"
- QA doc: "OAuth tests: 12 P0 scenarios (see Architecture doc R-001 for risk details)"
- Cross-references eliminate duplication

## Tips

- Run system-level immediately after architecture completion for early testability review
- Execute epic-level at each epic start for targeted test planning
- Update when ADRs change to keep test design aligned
- Use outputs to guide `atdd` and `automate` workflows
- Architecture teams focus on blockers and mitigation plans
- QA teams use QA document as implementation guide with test scenarios and Sprint 0 checklist

## Next Steps

1. **Setup Test Framework** — If not already configured
2. **Implementation Readiness** — System-level feeds into gate check
3. **Story Implementation** — Epic-level guides development testing
