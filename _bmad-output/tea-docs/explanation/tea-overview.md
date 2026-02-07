# Test Architect (TEA) Overview - Complete Documentation

## Core Information

**TEA** is a specialized agent designed for quality strategy, test automation, and release gates in BMad Method projects. The persona is "Murat, Master Test Architect and Quality Advisor" focused on risk-based testing, fixture architecture, ATDD, and CI/CD governance.

## Primary Mission

TEA delivers actionable quality strategies, automation coverage, and gate decisions that scale with project complexity and compliance demands. Use TEA when: BMad Method or Enterprise track projects exist, integration risk is non-trivial, brownfield regression risk exists, or compliance/NFR evidence is required.

## Five Engagement Models

1. **No TEA** - Skip all workflows; use existing team testing approach
2. **TEA Solo** - Use on non-BMad projects with your own requirements and environments
3. **TEA Lite** - Beginner approach using only `automate` workflow for existing features (30 minutes)
4. **TEA Academy** - Interactive learning path with 7 structured sessions, state persistence, and completion certificates (1-2 weeks self-paced)
5. **Integrated Models** - Full BMad Method or Enterprise integration across phases

## Nine Core Workflows

| Command | Primary Outputs | Key Feature |
|---------|-----------------|-------------|
| `framework` | Playwright/Cypress scaffold | Use when no production harness exists |
| `ci` | CI workflow, test scripts | Platform-aware (GitHub Actions default) |
| `test-design` | Risk assessment + coverage strategy | **+ Exploratory**: Interactive UI discovery |
| `atdd` | Failing acceptance tests | **+ Recording**: Live browser verification |
| `automate` | Prioritized specs, fixtures | **+ Healing**: Visual debugging + trace analysis |
| `test-review` | Quality review report (0-100 score) | Reviews against knowledge base patterns |
| `nfr-assess` | NFR assessment report | Focuses on security/performance/reliability |
| `trace` | Coverage matrix + gate decision | Two-phase: traceability then go/no-go |

## BMad Method Integration - Phase Structure

**Phase 1** (Optional): Discovery/Analysis
**Phase 2** (Required): Planning
**Phase 3** (Track-dependent): Solutioning
**Phase 4** (Required): Implementation

TEA integrates across phases:
- **Phase 2**: Optional `nfr-assess` (Enterprise)
- **Phase 3**: `test-design` (system-level), `framework`, `ci` - runs once per project
- **Phase 4**: Per-epic `test-design`, then `atdd`, `automate`, `test-review`, `trace`
- **Release Gate**: `nfr-assess` if needed, `trace` Phase 2 for go/no-go decision

## Track-Specific Cheat Sheets

### Greenfield - BMad Method (Simple/Standard Work)
- Phase 3: Run `framework`, `ci` after architecture
- Phase 4: Per-epic `test-design`, optional `atdd`, then `automate`
- Gate: Optional `test-review`, run `trace` Phase 2

### Brownfield - BMad Method or Enterprise
- Documentation (Prerequisite): Use `document-project` if undocumented
- Phase 2: Run `trace` baseline coverage
- Phase 3: `framework`, `ci`
- Phase 4: `test-design` focused on regression hotspots
- Gate: Include `nfr-assess` if not done earlier

### Greenfield - Enterprise Method
- Phase 1: `research` for domain/compliance analysis (recommended)
- Phase 2: Run `nfr-assess` early
- Phase 3: `framework`, `ci`
- Phase 4: `test-design` with compliance/security focus
- Gate: Archive artifacts for audit compliance

## Why TEA Requires Its Own Knowledge Base

TEA uniquely requires extensive domain knowledge spanning test patterns, CI/CD, fixtures, and quality practices. Operating across multiple phases (not just one) with cross-cutting concerns demands consistent, production-ready testing patterns maintained through a dedicated knowledge base.

## Optional Integrations

**Playwright Utils** (`@seontechnologies/playwright-utils`)
- Install: `npm install -D @seontechnologies/playwright-utils`
- Provides production-ready fixtures and utilities
- Impacts: `framework`, `atdd`, `automate`, `test-review`, `ci`
- Includes: api-request, auth-session, network-recorder, intercept-network-call, and others

**Playwright MCP Enhancements**
- Two servers: `playwright` (browser automation) and `playwright-test` (test runner with failure analysis)
- Enables live browser verification for test design and automation
- Enhances selector verification and healing capabilities
- Disable via config: `tea_use_mcp_enhancements: false`

## Complete Documentation Structure

- **Start Here**: TEA Lite Quickstart (30-minute tutorial)
- **Workflow Guides**: Nine step-by-step task-oriented guides
- **Customization**: Playwright Utils integration, MCP enhancements
- **Use Cases**: Brownfield projects, enterprise compliance
- **Concept Deep Dives**: Risk-based testing, fixture architecture, network-first patterns
- **Philosophy**: "Testing as Engineering" (recommended starting point)
- **Reference**: Commands, configuration, knowledge base index, glossary
