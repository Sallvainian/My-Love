# Story TD-1.2: Love Notes E2E Test Regeneration

Status: ready-for-dev

## Story

As a development team,
I want Love Notes E2E tests regenerated using TEA workflows with enforced quality gates,
so that messaging flows are reliably tested without false positives from anti-patterns.

## Acceptance Criteria

1. Zero anti-pattern instances (no `.catch(() => false)`, no `if/else` in tests, no runtime `test.skip()`)
2. Network-first pattern compliance (route interception BEFORE `page.goto()`)
3. Deterministic wait patterns only (no `waitForTimeout()`)
4. Accessibility-first selectors (`getByRole` > `getByLabel` > `getByTestId`)
5. TEA quality score >=85/100
6. Coverage: send message, real-time reception, message history, image attachments

## Tasks / Subtasks

- [ ] Task 1: Execute TEA test-design workflow (AC: 5)
  - [ ] Run `/bmad:bmm:workflows:testarch-test-design` with epic_num=2
  - [ ] Output: `docs/05-Epics-Stories/test-design-epic-2-love-notes.md`
- [ ] Task 2: Create love notes test fixtures (AC: 2,3)
  - [ ] Create `tests/e2e/love-notes/love-notes.setup.ts`
- [ ] Task 3: Regenerate send message tests (AC: 1,4,6)
  - [ ] Create `tests/e2e/love-notes/send-message.spec.ts`
- [ ] Task 4: Regenerate real-time reception tests (AC: 1,4,6)
  - [ ] Create `tests/e2e/love-notes/realtime-reception.spec.ts`
- [ ] Task 5: Regenerate message history tests (AC: 1,4,6)
  - [ ] Create `tests/e2e/love-notes/message-history.spec.ts`
- [ ] Task 6: Regenerate image attachments tests (AC: 1,4,6)
  - [ ] Create `tests/e2e/love-notes/image-attachments.spec.ts`
- [ ] Task 7: TEA quality gate validation (AC: 1,5)
  - [ ] Run test smell detector, verify >=85 score

## Dev Notes

- **Messaging Provider:** Supabase Realtime (Broadcast API)
- **Virtualization:** react-window for message list
- **Anti-patterns to avoid:** See archived tests in `tests/e2e-archive-2025-12/`

### References

- [Source: .bmad/bmm/testarch/knowledge/] - TEA knowledge base (network-first, selector-resilience, timing-debugging, data-factories, fixtures-composition)
- [Source: docs/04-Testing-QA/e2e-quality-standards.md] - Quality standards with 22-item checklist
- [Source: tests/e2e/auth/auth.setup.ts] - Reference implementation from TD-1.1
- [Source: tests/e2e-archive-2025-12/] - Archived tests (patterns to AVOID)

## Dev Agent Record

### Context Reference

- `.bmad/bmm/testarch/knowledge/` - Load ALL files before implementing
- `docs/04-Testing-QA/e2e-quality-standards.md`
- `docs/05-Epics-Stories/tech-spec-epic-td-1.md`

### Agent Model Used

TEA (Test Engineering Architect) via `*atdd` workflow

### Completion Notes List

_To be populated during implementation_

### File List

**Create:** `tests/e2e/love-notes/{love-notes.setup.ts, send-message.spec.ts, realtime-reception.spec.ts, message-history.spec.ts, image-attachments.spec.ts}`
