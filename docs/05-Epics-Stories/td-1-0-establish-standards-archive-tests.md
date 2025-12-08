# Story TD-1.0: Establish Quality Standards & Archive E2E Tests

Status: done

## Story

As a development team,
I want to archive existing E2E tests and document quality standards,
so that we have a clean slate and clear criteria for new tests.

## Acceptance Criteria

1. All E2E tests archived to `tests/e2e-archive-2025-12/` with README explaining context
2. Quality standards doc created with minimum 10 checklist items, 5 anti-patterns with before/after examples
3. Anti-pattern detection checklist covers: error swallowing, conditionals, runtime skip, assertions, waits, selectors
4. Pre-commit hook pattern defined (bash script copy-paste ready)
5. Testing guide updated with reference to new standards

## Tasks / Subtasks

- [x] Task 1: Create quality standards document (AC: 2,3,4)
  - [x] Create `docs/04-Testing-QA/e2e-quality-standards.md` (22 checklist items)
  - [x] Document 5 anti-patterns with before/after examples
  - [x] Pre-commit hook script copy-paste ready
- [x] Task 2: Create archive README (AC: 1)
  - [x] Create `tests/e2e-archive-2025-12/README.md`
- [x] Task 3: Archive E2E tests (AC: 1)
  - [x] Move all 14 spec files to archive
- [x] Task 4: Update testing guide (AC: 5)
  - [x] Add reference to new quality standards

## Dev Notes

- **TEA Score:** 52/100 (before archive)
- **Anti-patterns found:** Conditional flow (12/14), Error swallowing (10/14), Runtime skip (8/14), No-op paths (6/14)
- **Task order critical:** Standards created FIRST while tests still in place for real examples

### References

- [Source: docs/04-Testing-QA/e2e-quality-standards.md] - Created quality standards
- [Source: .bmad/bmm/testarch/knowledge/] - TEA knowledge base
- [Source: tests/e2e-archive-2025-12/] - Archived tests for anti-pattern reference

## Dev Agent Record

### Context Reference

- `docs/04-Testing-QA/e2e-quality-standards.md` - Quality gates and checklist
- `tests/e2e-archive-2025-12/README.md` - Archive context

### Agent Model Used

TEA (Test Engineering Architect) via Codex MCP

### Completion Notes List

- 22 checklist items (exceeds min 10)
- 5 anti-patterns with before/after code from actual files
- Pre-commit hook bash-compatible
- Code review: Fixed 3 MEDIUM issues (heredoc instructions, explicit script step, graceful empty dir handling)

### File List

**Created:** `docs/04-Testing-QA/e2e-quality-standards.md`, `tests/e2e-archive-2025-12/README.md`, `tests/e2e/.gitkeep`
**Moved:** 14 spec files + helpers/fixtures/utils → `tests/e2e-archive-2025-12/`
**Modified:** `docs/04-Testing-QA/testing-guide.md`
