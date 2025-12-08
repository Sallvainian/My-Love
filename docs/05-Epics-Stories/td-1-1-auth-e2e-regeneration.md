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
- [ ] Task 2: Create auth test fixtures (AC: 2,3)
- [ ] Task 3: Regenerate magic link tests (AC: 1,4,6)
- [ ] Task 4: Regenerate session management tests (AC: 1,4,6)
- [ ] Task 5: TEA quality gate validation (AC: 1,5)

## Dev Notes

- Auth Provider: Supabase (Magic Link)
- Anti-patterns to avoid: See `tests/e2e-archive-2025-12/auth.spec.ts`

### References

- [Source: .bmad/bmm/testarch/knowledge/]
- [Source: docs/04-Testing-QA/e2e-quality-standards.md]
