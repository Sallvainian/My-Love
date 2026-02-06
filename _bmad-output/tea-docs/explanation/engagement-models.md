# TEA Engagement Models Explained

## Overview

TEA provides five flexible engagement models rather than imposing a one-size-fits-all approach. Organizations can choose based on project needs and team maturity.

## The Five Engagement Models

### Model 1: No TEA
Skip all TEA workflows and maintain existing testing practices. Valid when teams already have established, high-quality testing approaches in place.

**When to Use:**
- Team has proven testing practices
- Quality standards already met
- Testing tools operational
- TEA adds no incremental value

### Model 2: TEA Solo
Use TEA workflows independently without BMad Method integration. Ideal for non-BMad projects needing systematic testing quality.

**Typical Sequence:**
1. Test design (system or epic)
2. ATDD or automate workflows
3. Optional test review
4. Trace for coverage and gate decisions

**You Provide:** Requirements, development environment, project context
**TEA Provides:** Risk-based planning, test generation, quality review, coverage traceability

### Model 3: TEA Lite
Beginner-focused approach using primarily the automate workflow. Perfect entry point for learning fundamentals quickly.

**Workflow:**
1. Framework setup
2. Optional test design
3. Automate tests for existing features
4. Run immediate passing tests

**Best For:** Learning TEA basics with 30-minute commitment

### Model 4: TEA Integrated (Greenfield)
Complete BMad Method integration across all project phases from inception. Comprehensive quality operating model.

**Lifecycle Coverage:**
- Phase 2 Planning: PRD with NFRs, optional NFR assessment
- Phase 3 Solutioning: Architecture, system-level test design, framework, CI setup
- Phase 4 Implementation: Per-epic test design, ATDD, development, automate, optional review, trace Phase 1
- Release Gate: Quality audits and trace Phase 2 gate decisions

### Model 5: TEA Integrated (Brownfield)
Full BMad Method integration for existing codebases. Emphasizes baseline establishment and incremental quality improvement.

**Key Differences:**
- Establish coverage baseline before planning
- Focus on regression hotspots
- Track improvement trending
- Optional documentation phase if needed

## Decision Framework

### Quick Decision Criteria

**Question 1:** Using BMad Method?
- No -> TEA Solo, Lite, or No TEA
- Yes -> TEA Integrated or No TEA

**Question 2:** New or existing project?
- New -> TEA Integrated (Greenfield) or Lite
- Existing -> TEA Integrated (Brownfield) or Solo

**Question 3:** Testing maturity level?
- Beginner -> TEA Lite
- Intermediate -> TEA Solo or Integrated
- Advanced -> Integrated or No TEA

**Question 4:** Compliance requirements?
- Yes -> TEA Integrated (Enterprise)
- No -> Any model

**Question 5:** Available investment time?
- 30 minutes -> TEA Lite
- Few hours -> TEA Solo
- Multiple days -> TEA Integrated

### By Project Type

| Project Type | Model | Rationale |
|---|---|---|
| New SaaS | TEA Integrated (Greenfield) | Complete quality model from start |
| Existing app + features | TEA Integrated (Brownfield) | Incremental improvement capability |
| Bug fixes | TEA Lite or No TEA | Minimal overhead needed |
| Learning projects | TEA Lite | Immediate results for beginners |
| Non-BMad enterprise | TEA Solo | Quality without methodology |
| High-quality tests | No TEA | Preserve working systems |

### By Team Maturity

| Maturity | Model | Reasoning |
|---|---|---|
| Beginners | TEA Lite -> TEA Solo | Progressive capability building |
| Intermediate | TEA Solo or Integrated | Depends on methodology adoption |
| Advanced | Integrated or No TEA | Full integration or maintain expertise |

## Flexibility Features

### Mid-Project Model Changes
Teams can expand gradually--starting TEA Lite, adding test design and ATDD for TEA Solo, then full integration over 2-4 weeks without disruption.

### Mixed-Model Approach
Organizations can apply full TEA workflows to critical features while using minimal/no TEA for bug fixes and routine work--pragmatic rather than dogmatic.

## Comparison Matrix

| Aspect | No TEA | Lite | Solo | Green | Brown |
|---|---|---|---|---|---|
| BMad Required | No | No | No | Yes | Yes |
| Learning Curve | None | Low | Medium | High | High |
| Setup Time | 0 | 30 min | 2 hrs | 1 day | 2 days |
| Workflows Used | 0 | 2-3 | 4-6 | 8 | 8 |
| Test Planning | Manual | Optional | Yes | Systematic | + Regression |
| Quality Gates | No | No | Optional | Yes | Yes + baseline |
| Coverage Tracking | Manual | No | Optional | Yes | Yes + trending |

## Transition Pathways

### TEA Lite -> TEA Solo
Gradually add test-design, ATDD, test-review, and trace workflows over 2-4 weeks as comfort increases.

### TEA Solo -> TEA Integrated
Install BMad Method, integrate into Phase 3 system-level design, follow per-epic workflows, add release gates within 1-2 sprints.

### TEA Integrated -> TEA Solo
Export BMad artifacts (PRD, architecture, stories), continue TEA standalone without BMad-specific integration--immediate transition.

## Common Patterns

**Pattern 1:** TEA Lite learning phase, evaluate value, then decide on expansion or No TEA

**Pattern 2:** TEA Solo quality without full BMad Method commitment--use existing project management tools

**Pattern 3:** TEA Integrated for critical features (payment, auth); TEA Lite for non-critical UI changes

## Real-World Examples

### Startup Evolution
- Month 1: TEA Lite--20 generated tests, learning basics
- Month 3: TEA Solo--add risk assessment and TDD
- Month 6: TEA Integrated--full lifecycle with quality gates

### Enterprise Brownfield Legacy Banking
- Baseline: 45% coverage, 50% flaky tests
- 6-month improvement: 85% coverage, 2% flakiness, SOC 2 compliant

### Consultancy Multi-Client
TEA Solo provides consistent testing approach across Scrum, Kanban, and ad-hoc client methodologies while maintaining client-specific requirements management.

## Key Resources

- **Getting Started:** TEA Lite Quickstart Tutorial
- **Brownfield:** Using TEA with Existing Tests guide
- **Enterprise:** Running TEA for Enterprise Projects guide
- **Workflows:** Individual command and workflow reference documentation
- **Full Content:** llms-full.txt for AI-optimized complete context

---

**Philosophy:** "TEA recognizes different projects have different needs, different teams have different maturity levels, and different contexts require different approaches. Flexibility increases adoption."
