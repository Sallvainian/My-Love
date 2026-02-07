# TEA Knowledge Base Index

## Core Concept

TEA employs "context engineering" -- automatically loading domain-specific standards into AI context rather than relying solely on generic prompts. As the documentation states: **"Instead of asking AI to 'write good tests' every time, TEA reads tea-index.csv to identify relevant fragments for the workflow."**

## Knowledge Base Structure

The system comprises **33 specialized knowledge fragments** organized into nine categories:

### Fragment Categories

1. **Architecture & Fixtures** - Test infrastructure patterns (fixture-architecture.md, network-first.md, playwright-config.md)

2. **Data & Setup** - Test data generation and authentication (data-factories.md, email-auth.md, auth-session.md)

3. **Network & Reliability** - Network interception and error handling (network-recorder.md, intercept-network-call.md, error-handling.md)

4. **Test Execution & CI** - CI/CD patterns and burn-in testing (ci-burn-in.md, selective-testing.md)

5. **Quality & Standards** - Test quality metrics and TDD patterns (test-quality.md, test-levels-framework.md, test-priorities-matrix.md)

6. **Risk & Gates** - Risk assessment frameworks (risk-governance.md, probability-impact.md, nfr-criteria.md)

7. **Selectors & Timing** - Resilience and debugging strategies (selector-resilience.md, timing-debugging.md, visual-debugging.md)

8. **Feature Flags & Testing Patterns** - Feature flag and contract testing (feature-flags.md, contract-testing.md, api-testing-patterns.md)

9. **Playwright-Utils Integration** - Nine specialized utilities for API and UI testing

## Manifest System

The `tea-index.csv` manifest tracks all fragments with columns for ID, name, description, tags, and file paths. All 33 fragments reside in `src/bmm/testarch/knowledge/` with the manifest at `src/bmm/testarch/tea-index.csv`.

## Workflow-Specific Loading

Each TEA workflow loads targeted fragment sets:

- **framework**: Fixture patterns and composition
- **test-design**: Risk assessment and test planning
- **atdd**: TDD patterns and test generation
- **automate**: Comprehensive test generation with quality standards
- **test-review**: Complete quality review criteria
- **ci**: CI/CD optimization and burn-in
- **nfr-assess**: NFR assessment frameworks
- **trace**: Traceability and gate decision standards

This selective loading maintains focused context while ensuring production-ready, consistent test output across projects.
