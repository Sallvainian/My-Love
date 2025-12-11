# BMM Workflow Diagram - Brownfield Method

## Phase 0: Discovery (ALL OPTIONAL)

| Workflow | Command | What it does |
|----------|---------|--------------|
| brainstorm-project | `/bmad:bmm:workflows:brainstorm-project` | Creative exploration and ideation |
| research | `/bmad:bmm:workflows:research` | Market/technical research |
| product-brief | `/bmad:bmm:workflows:create-product-brief` | High-level product vision doc |

---

## Phase 1: Planning

| Workflow | Command | What it does | Status |
|----------|---------|--------------|--------|
| **PRD** | `/bmad:bmm:workflows:create-prd` | Requirements document | **REQUIRED** |
| validate-prd | `/bmad:bmm:workflows:validate-prd` | Quality check on PRD | Optional |
| create-ux-design | `/bmad:bmm:workflows:create-ux-design` | UI/UX specification | If has UI |

---

## Phase 2: Solutioning

| Workflow | Command | What it does | Status |
|----------|---------|--------------|--------|
| architecture | `/bmad:bmm:workflows:create-architecture` | Technology decisions document | Recommended |
| **create-epics-stories** | `/bmad:bmm:workflows:create-epics-stories` | Break PRD into epics and stories | **REQUIRED** |
| test-design | `/bmad:bmm:workflows:testarch-test-design` | System-level testability review | Recommended |
| validate-architecture | `/bmad:bmm:workflows:validate-architecture` | Quality check on architecture | Optional |
| **implementation-readiness** | `/bmad:bmm:workflows:check-implementation-readiness` | GATE CHECK - validates everything fits | **REQUIRED** |

---

## Phase 3: Implementation

| Workflow | Command | What it does | Status |
|----------|---------|--------------|--------|
| **sprint-planning** | `/bmad:bmm:workflows:sprint-planning` | Create sprint plan with stories | **REQUIRED** |
| testarch-framework | `/bmad:bmm:workflows:testarch-framework` | Setup Playwright/Cypress infrastructure | Optional |
| dev-story | `/bmad:bmm:workflows:dev-story` | Implement each story | Per story |
| code-review | `/bmad:bmm:workflows:code-review` | Review completed work | Per story |

---

## TEA (Test Engineering) Workflows

| Workflow | Command | When to use |
|----------|---------|-------------|
| testarch-framework | `/bmad:bmm:workflows:testarch-framework` | Start of implementation - setup test infra |
| testarch-test-design | `/bmad:bmm:workflows:testarch-test-design` | Before implementation - testability review |
| testarch-atdd | `/bmad:bmm:workflows:testarch-atdd` | Before coding - write failing acceptance tests |
| testarch-automate | `/bmad:bmm:workflows:testarch-automate` | After coding - expand test coverage |
| testarch-test-review | `/bmad:bmm:workflows:testarch-test-review` | Anytime - review test quality |
| testarch-trace | `/bmad:bmm:workflows:testarch-trace` | Before release - requirements traceability |
| testarch-nfr | `/bmad:bmm:workflows:testarch-nfr` | Before release - non-functional requirements |
| testarch-ci | `/bmad:bmm:workflows:testarch-ci` | Setup - CI/CD pipeline with tests |

---

## Quick Reference

**Minimum required path:**

PRD → create-epics-stories → implementation-readiness → sprint-planning → dev-story

**Recommended path:**

PRD → UX → architecture → create-epics-stories → test-design → implementation-readiness → sprint-planning → testarch-framework → dev-story → code-review
