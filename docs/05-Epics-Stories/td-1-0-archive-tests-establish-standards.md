# Story TD-1.0: Archive Existing E2E Tests & Establish Quality Standards

**Story Key:** td-1-0-archive-tests-establish-standards
**Epic:** TD-1 - Test Quality Remediation
**Status:** ready-for-dev
**Priority:** HIGH
**Type:** Technical Debt / Infrastructure
**Created:** 2025-12-07
**Sprint:** Current

---

## User Story

**As a** development team,
**I want** to archive existing E2E tests and document quality standards,
**So that** we have a clean slate and clear criteria for new tests.

---

## Context & Background

### Why This Story Exists

The TEA test-review workflow (2025-12-07) identified critical anti-patterns across 12/14 E2E spec files. The current E2E test suite scores **52/100**, providing false confidence that features work when they may not.

**Anti-Patterns Found:**

| Pattern | Severity | Files Affected |
|---------|----------|----------------|
| Conditional flow control (`if/else` in tests) | CRITICAL | 12/14 |
| Error swallowing (`.catch(() => false)`) | CRITICAL | 10/14 |
| Runtime `test.skip()` conditionals | HIGH | 8/14 |
| No-op assertion paths | CRITICAL | 6/14 |

### Current E2E Files to Archive

```
tests/e2e/
├── auth.spec.ts
├── love-notes-images.spec.ts
├── love-notes-pagination.spec.ts
├── mood-history-performance.spec.ts
├── mood-history-timeline.spec.ts
├── mood.spec.ts
├── navigation.spec.ts
├── offline.spec.ts
├── partner-mood-viewing.spec.ts
├── photoViewer.spec.ts
├── photos.spec.ts
├── quick-mood-logging.spec.ts
├── send-love-note.spec.ts
├── smoke.spec.ts
├── helpers/partner-setup.ts
├── fixtures/multi-user.fixture.ts
├── utils/mock-helpers.ts
└── global-setup.ts
```

---

## Acceptance Criteria

### AC1: Archive E2E Tests to Dated Directory

**Given** the existing E2E test files in `tests/e2e/`
**When** I execute the archive operation
**Then** all files should be moved to `tests/e2e-archive-2025-12/`
**And** the directory structure should be preserved
**And** original `tests/e2e/` should be empty (except .gitkeep)

### AC2: Archive Documentation

**Given** the archived tests in `tests/e2e-archive-2025-12/`
**When** I view the archive directory
**Then** there should be a `README.md` explaining:
- Why tests were archived
- TEA quality score (52/100)
- Anti-patterns identified
- Reference to new quality standards
- Date of archive

### AC3: Quality Standards Document (TEA-Authored)

**Given** the need for E2E test quality guidelines
**When** TEA creates `docs/04-Testing-QA/e2e-quality-standards.md`
**Then** it should document:
- Mandatory quality gates for all new E2E tests
- Anti-pattern detection checklist with **minimum 10 items**
- Selector priority hierarchy (accessibility-first)
- Wait pattern requirements (deterministic only)
- Assertion requirements (guaranteed, no no-op paths)
- **Minimum 5 anti-patterns with before/after code examples**
- **Test Smell Detection section with grep patterns**
- **Links to TEA knowledge base fragments** (timing-debugging.md, selector-resilience.md)
- **Pre-commit hook script that is copy-paste ready**

### AC4: Anti-Pattern Detection Checklist

**Given** the quality standards document
**When** developers review E2E tests
**Then** there should be a clear checklist to identify:
- [ ] No `.catch(() => false)` or error swallowing
- [ ] No `if/else` conditional logic in test bodies
- [ ] No runtime `test.skip()` decisions
- [ ] All test paths have at least 1 assertion
- [ ] All waits use deterministic patterns
- [ ] No `waitForTimeout()` or arbitrary delays
- [ ] Accessibility-first selector usage

### AC5: Pre-commit Hook Pattern Defined

**Given** the need to prevent anti-pattern regression
**When** the quality standards are documented
**Then** a pre-commit hook pattern should be defined that:
- Fails if tests contain `.catch.*false`
- Fails if tests contain `if.*isVisible` patterns
- Can be enabled when Epic TD-1 completes (TD-1.6)

---

## Technical Implementation

### Task 1: Create Archive Directory Structure

```bash
# Create archive directory with date stamp
mkdir -p tests/e2e-archive-2025-12

# Move all E2E files to archive
mv tests/e2e/*.spec.ts tests/e2e-archive-2025-12/
mv tests/e2e/helpers tests/e2e-archive-2025-12/
mv tests/e2e/fixtures tests/e2e-archive-2025-12/
mv tests/e2e/utils tests/e2e-archive-2025-12/
mv tests/e2e/global-setup.ts tests/e2e-archive-2025-12/

# Keep empty e2e directory with marker
touch tests/e2e/.gitkeep
```

### Task 2: Create Archive README

**File:** `tests/e2e-archive-2025-12/README.md`

Content should include:
- Archive date: December 2025
- TEA Review score: 52/100
- Reason: Critical anti-patterns identified
- List of anti-patterns found
- Link to new quality standards
- Note: Tests preserved for reference only, not to be run
- **Extract good patterns** from `playwright.config.ts` (retry logic, trace settings) to reference in quality standards

### Task 3: Create Quality Standards Document (TEA Ownership)

**File:** `docs/04-Testing-QA/e2e-quality-standards.md`

Structure:
1. **Executive Summary** - Why quality gates matter (score context: 52/100 → target 90+)
2. **Quality Gates Checklist** - Mandatory checks (minimum 10 items)
3. **Anti-Pattern Reference** - What NOT to do with **before/after code examples** (minimum 5)
4. **Best Practices** - What TO do with examples (from TEA knowledge base)
5. **Selector Priority** - Accessibility-first hierarchy
6. **Wait Patterns** - Deterministic waits only
7. **Test Smell Detection** - grep patterns for CI/pre-commit
8. **Pre-commit Hook** - **Copy-paste ready bash script**
9. **References** - Links to TEA knowledge base fragments

### Task 4: Update Testing Guide

**File:** `docs/04-Testing-QA/testing-guide.md`

Add reference to new quality standards document.

---

## Quality Gates (For This Story)

TEA-authored deliverables must meet measurable criteria:

- [ ] Archive directory contains all 14+ spec files
- [ ] Archive README explains context completely
- [ ] Quality standards document has **minimum 10 checklist items**
- [ ] **Minimum 5 anti-patterns with before/after code examples**
- [ ] Pre-commit hook is **copy-paste ready** bash script
- [ ] Test smell grep patterns documented and tested
- [ ] No E2E tests remain in `tests/e2e/` (except .gitkeep)
- [ ] Testing guide references new standards
- [ ] Good patterns from `playwright.config.ts` extracted and documented

---

## Dependencies

### Blocks

- **TD-1.1 through TD-1.4**: Cannot regenerate tests until archive complete
- **TD-1.6**: CI quality gates depend on standards document

### Blocked By

- None - this is the first story in the epic

---

## Definition of Done

- [ ] All E2E test files archived to `tests/e2e-archive-2025-12/`
- [ ] Archive `README.md` created with full context
- [ ] `docs/04-Testing-QA/e2e-quality-standards.md` created by TEA
- [ ] **Minimum 5 anti-patterns documented with before/after code examples**
- [ ] **Quality checklist has minimum 10 items**
- [ ] **Pre-commit hook script is copy-paste ready (bash-compatible)**
- [ ] **Test smell grep patterns documented**
- [ ] Good patterns extracted from `playwright.config.ts`
- [ ] `tests/e2e/.gitkeep` in place
- [ ] Testing guide references new standards
- [ ] PR created and approved
- [ ] sprint-status.yaml updated to `done`

---

## Workflow Notes

**This story uses TEA workflow:** `*atdd`

The quality standards and anti-pattern documentation must be authored by TEA (Master Test Architect) - the expert who identified the problems. Using *dev-story would repeat the pattern that created unreliable tests in the first place.

---

## References

- [Tech Spec: Epic TD-1](tech-spec-epic-td-1.md)
- [Epics & Stories](epics.md) - Story TD-1.0 section
- [Testing Guide](../04-Testing-QA/testing-guide.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

*Generated by BMAD create-story workflow - 2025-12-07*
