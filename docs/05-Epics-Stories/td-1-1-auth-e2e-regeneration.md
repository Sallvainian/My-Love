# Story TD-1.1: Auth E2E Test Regeneration

Status: backlog

## Story

As a development team,
I want authentication E2E tests regenerated using TEA workflows with enforced quality gates,
so that auth flows are reliably tested without false positives from anti-patterns.

## Acceptance Criteria

1. Zero anti-pattern instances (no `.catch(() => false)`, no `if/else` in tests, no runtime `test.skip()`)
2. Network-first pattern compliance (route interception BEFORE `page.goto()`)
3. Deterministic wait patterns only (no `waitForTimeout()`)
4. Accessibility-first selectors (`getByRole` > `getByLabel` > `getByTestId`)
5. TEA quality score >=85/100
6. Coverage: magic link auth, session management

## Tasks / Subtasks

- [ ] Task 1: Execute TEA test-design workflow (AC: 5)
  - [ ] Run `/bmad:bmm:workflows:testarch-test-design` with epic_num=1
  - [ ] Output: `docs/05-Epics-Stories/test-design-epic-1-auth.md`
- [ ] Task 2: Create auth test fixtures (AC: 2,3)
  - [ ] Create `tests/e2e/auth/auth.setup.ts`
- [ ] Task 3: Regenerate magic link tests (AC: 1,4,6)
  - [ ] Create `tests/e2e/auth/magic-link.spec.ts`
- [ ] Task 4: Regenerate session management tests (AC: 1,4,6)
  - [ ] Create `tests/e2e/auth/01-session-management.spec.ts`
- [ ] Task 5: TEA quality gate validation (AC: 1,5)
  - [ ] Quality score: >=85/100

## Dev Notes

- **Auth Provider:** Supabase (Magic Link, session management)
- **Anti-patterns to avoid:** See archived `tests/e2e-archive-2025-12/auth.spec.ts`

### References

- [Source: .bmad/bmm/testarch/knowledge/] - TEA knowledge base
- [Source: docs/04-Testing-QA/e2e-quality-standards.md] - Quality standards
- [Source: tests/e2e-archive-2025-12/auth.spec.ts] - Patterns to AVOID

## Dev Agent Record

### Context Reference

- `.bmad/bmm/testarch/knowledge/` - Load ALL files before implementing
- `docs/04-Testing-QA/e2e-quality-standards.md`

### Agent Model Used

TEA (Test Engineering Architect) via `*atdd` workflow

### Completion Notes List

_To be populated during implementation_

### File List

**To Create:** `tests/e2e/auth/auth.setup.ts`, `tests/e2e/auth/magic-link.spec.ts`, `tests/e2e/auth/01-session-management.spec.ts`, `docs/05-Epics-Stories/test-design-epic-1-auth.md`
