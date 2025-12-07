# Story TD-1.0: Establish Quality Standards & Archive E2E Tests

**Story Key:** td-1-0-establish-standards-archive-tests
**Epic:** TD-1 - Test Quality Remediation
**Status:** Done
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

> **CRITICAL: Task order matters!** Quality standards MUST be created while tests are still in `tests/e2e/` so TEA can extract real before/after examples from the actual codebase. Archive AFTER standards are complete.

### Task 1: Create Quality Standards Document (TEA - While Tests Still In Place)

**File:** `docs/04-Testing-QA/e2e-quality-standards.md`

**Why first?** TEA reads existing tests in `tests/e2e/` to extract real anti-pattern examples with actual file paths and line numbers. This grounds the standards in reality, not memory.

Structure:
1. **Executive Summary** - Why quality gates matter (score context: 52/100 → target 90+)
2. **Quality Gates Checklist** - Mandatory checks (minimum 10 items)
3. **Anti-Pattern Reference** - What NOT to do with **before/after code examples** (minimum 5, from actual `tests/e2e/` files)
4. **Best Practices** - What TO do with examples (from TEA knowledge base)
5. **Selector Priority** - Accessibility-first hierarchy
6. **Wait Patterns** - Deterministic waits only
7. **Test Smell Detection** - grep patterns for CI/pre-commit (test against live files!)
8. **Pre-commit Hook** - **Copy-paste ready bash script**
9. **Good Patterns** - Extract from `playwright.config.ts` (retry logic, trace settings)
10. **References** - Links to TEA knowledge base fragments

### Task 2: Create Archive README

**File:** `tests/e2e-archive-2025-12/README.md`

Content should include:
- Archive date: December 2025
- TEA Review score: 52/100
- Reason: Critical anti-patterns identified
- List of anti-patterns found (matching quality standards doc)
- Link to new quality standards document
- Note: Tests preserved for reference only, not to be run

### Task 3: Archive E2E Tests

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

### Task 4: Update Testing Guide

**File:** `docs/04-Testing-QA/testing-guide.md`

Add reference to new quality standards document.

---

## Quality Gates (For This Story)

TEA-authored deliverables must meet measurable criteria:

- [x] Archive directory contains all 14+ spec files
- [x] Archive README explains context completely
- [x] Quality standards document has **minimum 10 checklist items** (22 items)
- [x] **Minimum 5 anti-patterns with before/after code examples** (5 documented)
- [x] Pre-commit hook is **copy-paste ready** bash script
- [x] Test smell grep patterns documented and tested
- [x] No E2E tests remain in `tests/e2e/` (except .gitkeep)
- [x] Testing guide references new standards
- [x] Good patterns from `playwright.config.ts` extracted and documented

---

## Dependencies

### Blocks

- **TD-1.1 through TD-1.4**: Cannot regenerate tests until archive complete
- **TD-1.6**: CI quality gates depend on standards document

### Blocked By

- None - this is the first story in the epic

---

## Definition of Done

- [x] All E2E test files archived to `tests/e2e-archive-2025-12/`
- [x] Archive `README.md` created with full context
- [x] `docs/04-Testing-QA/e2e-quality-standards.md` created by TEA
- [x] **Minimum 5 anti-patterns documented with before/after code examples**
- [x] **Quality checklist has minimum 10 items** (22 items)
- [x] **Pre-commit hook script is copy-paste ready (bash-compatible)**
- [x] **Test smell grep patterns documented**
- [x] Good patterns extracted from `playwright.config.ts`
- [x] `tests/e2e/.gitkeep` in place
- [x] Testing guide references new standards
- [ ] PR created and approved
- [x] sprint-status.yaml updated to `done`

---

## File List

### New Files Created
- `docs/04-Testing-QA/e2e-quality-standards.md` - Comprehensive E2E quality standards
- `tests/e2e-archive-2025-12/README.md` - Archive documentation
- `tests/e2e/.gitkeep` - Placeholder for empty directory

### Files Moved to Archive
- `tests/e2e/*.spec.ts` (14 files) → `tests/e2e-archive-2025-12/`
- `tests/e2e/helpers/` → `tests/e2e-archive-2025-12/helpers/`
- `tests/e2e/fixtures/` → `tests/e2e-archive-2025-12/fixtures/`
- `tests/e2e/utils/` → `tests/e2e-archive-2025-12/utils/`
- `tests/e2e/global-setup.ts` → `tests/e2e-archive-2025-12/global-setup.ts`

### Files Modified
- `docs/04-Testing-QA/testing-guide.md` - Added E2E quality standards reference
- `docs/05-Epics-Stories/sprint-status.yaml` - Updated story status

---

## Dev Agent Record

### Implementation Notes
- Executed tasks in correct order: Quality standards FIRST (while tests still in place), then archive
- Extracted real anti-pattern examples from actual test files with file:line references
- Created comprehensive quality standards document with 22 checklist items (exceeds minimum of 10)
- Documented 5 anti-patterns with before/after code examples from actual codebase
- Pre-commit hook is copy-paste ready and bash-compatible
- Test smell grep patterns documented and can be used for CI integration
- Good patterns from playwright.config.ts extracted (project separation, global setup, CI-aware config)

### Completion Notes
- All 14 spec files archived to `tests/e2e-archive-2025-12/`
- Archive README explains TEA review score (52/100), anti-patterns found, and regeneration plan
- Quality standards reference TEA knowledge base fragments
- Testing guide updated with quality standards reference and note about archived tests

### Review Fixes Applied (Code Review 2025-12-07)
- **M1 FIXED:** Pre-commit hook installation instructions now use heredoc instead of incorrect `cp` command
- **M2 FIXED:** Added explicit Step 2 with copy-paste ready script to create `.husky/test-smell-detector.sh`
- **M3 FIXED:** Detection script now checks if spec files exist before scanning (handles empty `tests/e2e/` gracefully)
- All fixes applied to `docs/04-Testing-QA/e2e-quality-standards.md`

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-07 | Story implementation complete - all tasks done | TEA/Claude |
| 2025-12-07 | Code review: Fixed 3 MEDIUM issues in quality standards doc | TEA/Claude |

---

## Workflow Notes

**This story uses TEA expertise via Codex MCP.**

The quality standards and anti-pattern documentation must be authored with TEA (Master Test Architect) knowledge - the expert who identified the problems. Execution happens via Codex MCP for autonomous file operations with TEA persona.

---

## Execution Method

**Step 1: Invoke Codex MCP with TEA persona**

```
mcp__plugin_codex_codex__codex(
  prompt: |
    You are TEA (Master Test Architect) executing story TD-1.0.

    CRITICAL: Execute tasks IN ORDER - standards FIRST while tests still exist.

    Story file: docs/05-Epics-Stories/td-1-0-establish-standards-archive-tests.md

    Tasks:
    1. Read tests in tests/e2e/*.spec.ts - extract REAL anti-pattern examples with file:line
    2. Create docs/04-Testing-QA/e2e-quality-standards.md (min 10 checklist items, min 5 anti-patterns with before/after)
    3. Create tests/e2e-archive-2025-12/README.md
    4. Move all tests to archive directory
    5. Update docs/04-Testing-QA/testing-guide.md with reference

    TEA Knowledge Base: .bmad/bmm/testarch/knowledge/
    Key fragments: selector-resilience.md, timing-debugging.md, test-quality.md
  sandbox: "workspace-write"
  approval-policy: "on-failure"
)
```

**Step 2: Guide/correct with continuation**

```
mcp__plugin_codex_codex__codex-reply(
  conversationId: "<from-step-1>",
  prompt: "<guidance or corrections>"
)
```

**Step 3: Verify deliverables against Quality Gates**

Run the Quality Gates checklist manually after Codex completes.

---

## References

- [Tech Spec: Epic TD-1](tech-spec-epic-td-1.md)
- [Epics & Stories](epics.md) - Story TD-1.0 section
- [Testing Guide](../04-Testing-QA/testing-guide.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

*Generated by BMAD create-story workflow - 2025-12-07*
