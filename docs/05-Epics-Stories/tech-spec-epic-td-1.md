# Epic TD-1: Test Quality Remediation - Technical Specification

**Epic:** TD-1 - Test Quality Remediation (Technical Debt)
**Created:** 2025-12-07
**Author:** TEA (Master Test Architect)
**Status:** Contexted
**Priority:** HIGH

---

## Executive Summary

TEA test-review workflow (2025-12-07) identified critical anti-patterns across 12/14 E2E spec files. Current E2E test suite scores 52/100, providing false confidence that features work when they may not. This epic addresses test quality through systematic regeneration using TEA's `*atdd` workflow.

### Quality Scores (Pre-Remediation)

| Category | Score | Status |
|----------|-------|--------|
| E2E Tests | 52/100 | CRITICAL |
| Unit Tests | 85/100 | Good |
| Integration Tests | 45/100 | Incomplete |
| Overall | 61/100 | Needs Work |

### Target Scores (Post-Remediation)

| Category | Target | Status |
|----------|--------|--------|
| E2E Tests | ≥85/100 | Goal |
| Integration Tests | ≥80/100 or Removed | Goal |
| Overall | ≥80/100 | Goal |

---

## Anti-Patterns Identified

### Critical (Must Fix)

| Pattern | Severity | Files Affected | Impact |
|---------|----------|----------------|--------|
| Conditional flow control (`if/else` in tests) | CRITICAL | 12/14 | Tests non-deterministic |
| Error swallowing (`.catch(() => false)`) | CRITICAL | 10/14 | Real errors hidden |
| Runtime `test.skip()` conditionals | HIGH | 8/14 | Phantom test counts |
| No-op assertion paths | CRITICAL | 6/14 | Tests pass with 0 assertions |

### Files Requiring Complete Rewrite

| File | Lines | Issues |
|------|-------|--------|
| `mood-history-timeline.spec.ts` | 286 | Heavy conditionals, error swallowing |
| `photoViewer.spec.ts` | 261 | Runtime skips, no-op paths |
| `photos.spec.ts` | 158 | Conditional execution throughout |
| `love-notes-pagination.spec.ts` | 270 | Data-dependent skips |
| `partner-mood-viewing.spec.ts` | 344 | Mixed patterns, conditional logic |

---

## Technical Approach

### TEA `*atdd` Workflow

Each story uses TEA's `*atdd` (Acceptance Test Driven Development) workflow:

1. **Load story acceptance criteria** from story file
2. **Generate test scenarios** from Given/When/Then criteria
3. **Apply TEA knowledge base patterns**:
   - Network-first pattern (intercept before navigate)
   - Deterministic waits (`waitForResponse`, `waitFor({ state })`)
   - Accessibility-first selectors (`getByRole`, `getByLabel`)
   - Guaranteed assertions (every test path asserts)
4. **Validate against quality gates** before completion

### Quality Gates (Enforced)

Every generated test must pass:

```
- [ ] Zero instances of `.catch(() => false)`
- [ ] Zero `if/else` conditionals in test bodies
- [ ] All `test.skip()` at describe level only
- [ ] Every test has at least 1 guaranteed assertion
- [ ] All waits use `waitForResponse()` or `waitFor({ state })`
- [ ] No `waitForTimeout()` or `sleep()` calls
- [ ] Selector hierarchy: `data-testid` > ARIA > text > CSS
```

---

## Workflow Integration

### IMPORTANT: How TD-1 Stories Differ from Feature Stories

TD-1 stories are **test-focused**, not feature-focused. The "development work" IS generating tests, not writing application code. This changes which BMAD workflow commands to use.

### Standard Feature Story Workflow

```
*create-story → *story-ready → *dev-story → *code-review → *story-done
                                    ↑
                              (writes app code)
```

### TD-1 Test Story Workflow

```
(stories defined in epics.md) → *story-ready → *atdd → *code-review → *story-done
                                                 ↑
                                          (generates tests)
```

**Key Difference:** `*atdd` **replaces** `*dev-story` for TD-1 stories.

### Step-by-Step Execution for TD-1 Stories

For each TD-1 story (TD-1.1 through TD-1.4):

| Step | Command | What Happens |
|------|---------|--------------|
| 1 | `*story-ready` | Loads story context, marks ready-for-dev |
| 2 | `*atdd` | TEA generates E2E tests from acceptance criteria |
| 3 | `*code-review` | TEA reviews generated tests against quality gates |
| 4 | `*story-done` | Marks story complete, updates sprint-status |

### Exception: TD-1.0 and TD-1.5

- **TD-1.0 (Archive & Standards)**: Use `*dev-story` - this is manual work (moving files, writing docs), not test generation
- **TD-1.5 (Integration Tests)**: Use `*dev-story` - this is completing/removing existing tests, not generating new E2E tests
- **TD-1.6 (CI Quality Gates)**: Use `*dev-story` - this is CI configuration, not test generation

### Summary Table

| Story | Workflow | Reason |
|-------|----------|--------|
| TD-1.0 | `*story-ready` → `*dev-story` → `*code-review` | Manual file operations |
| TD-1.1 | `*story-ready` → `*atdd` → `*code-review` | E2E test generation |
| TD-1.2 | `*story-ready` → `*atdd` → `*code-review` | E2E test generation |
| TD-1.3 | `*story-ready` → `*atdd` → `*code-review` | E2E test generation |
| TD-1.4 | `*story-ready` → `*atdd` → `*code-review` | E2E test generation |
| TD-1.5 | `*story-ready` → `*dev-story` → `*code-review` | Integration test completion |
| TD-1.6 | `*story-ready` → `*dev-story` → `*code-review` | CI configuration |

---

## Story Dependencies

```
TD-1.0 (Archive & Standards)
    │
    ├── TD-1.1 (Auth E2E) ────┐
    ├── TD-1.2 (Love Notes E2E) ──┼── TD-1.6 (CI Quality Gates)
    ├── TD-1.3 (Mood E2E) ────┤
    └── TD-1.4 (Photos E2E) ──┘

TD-1.5 (Integration Tests) - Independent, can run parallel
```

### Parallel Execution Opportunities

- Stories TD-1.1 through TD-1.4 can run in parallel after TD-1.0
- Story TD-1.5 (Integration) is independent, can run anytime
- Story TD-1.6 requires TD-1.1-TD-1.4 complete

---

## Implementation Details

### Story TD-1.0: Archive & Standards

**Actions:**
1. Create `tests/e2e-archive-2024-12/` directory
2. Move all files from `tests/e2e/` to archive
3. Create `tests/e2e-archive-2024-12/README.md` explaining archive reason
4. Create `docs/04-Testing-QA/e2e-quality-standards.md`

**Deliverables:**
- Archived tests with documentation
- Quality standards document
- Anti-pattern detection checklist

### Story TD-1.1: Auth E2E

**Scope:** Stories 1-3 (Magic Link), 1-4 (Session Management), 1-5 (Network Resilience)

**Test Scenarios:**
- Login with valid magic link
- Session persistence across browser refresh
- Session timeout handling
- Network offline indicator behavior
- OAuth callback URL handling

### Story TD-1.2: Love Notes E2E

**Scope:** Stories 2-1 through 2-4

**Test Scenarios:**
- Send note with optimistic update
- Receive note in real-time
- Message history pagination
- Image attachment upload
- Rate limiting enforcement
- Error state display

### Story TD-1.3: Mood E2E

**Scope:** Stories 5-1 through 5-4

**Test Scenarios:**
- Mood emoji selection
- Multi-mood selection
- Optional note attachment
- Partner mood visibility
- Mood history timeline loading
- Virtualized scroll behavior

### Story TD-1.4: Photos E2E

**Scope:** Stories 6-1 through 6-4

**Test Scenarios:**
- Photo selection from file picker
- Compression before upload
- Upload progress indicator
- Gallery grid display
- Full-screen viewer gestures
- Swipe navigation

### Story TD-1.5: Integration Tests

**Options:**
1. **Complete** - Add real Supabase test users, implement RLS verification
2. **Remove** - Delete incomplete tests, move RLS checks to E2E

**Recommendation:** Complete if < 1 day effort, else remove

### Story TD-1.6: CI Quality Gates

**Pre-commit Hook:**
```bash
#!/bin/bash
# Fail if tests contain anti-patterns
grep -r "\.catch.*false" tests/e2e/ && exit 1
grep -r "if.*isVisible" tests/e2e/ && exit 1
echo "E2E quality check passed"
```

**CI Configuration:**
```yaml
# playwright.config.ts additions
retries: process.env.CI ? 2 : 0
trace: 'on-first-retry'
video: 'on-first-retry'
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Regenerated tests miss edge cases | Medium | Medium | Use existing tests as reference |
| New tests also develop anti-patterns | Low | High | Pre-commit hooks + TEA review |
| Feature regressions during transition | Low | High | Keep archived tests runnable |
| Time estimate overrun | Medium | Low | Prioritize by user impact |

---

## Success Metrics

1. **E2E Score**: ≥85/100 on TEA re-review
2. **CI Reliability**: 3 consecutive green runs
3. **Assertion Coverage**: Every test has guaranteed assertions
4. **Anti-Pattern Count**: Zero in new tests
5. **Flaky Test Rate**: <5% retry rate

---

## References

- TEA Test Review Report: `.bmad/output/test-quality-review-2024-12-07.md`
- TEA Knowledge Base: `.bmad/bmm/testarch/knowledge/`
- Playwright Best Practices: TEA fragments `timing-debugging.md`, `selector-resilience.md`

---

*Generated by TEA (Master Test Architect) - 2025-12-07*
