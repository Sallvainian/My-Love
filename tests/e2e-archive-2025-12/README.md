# E2E Test Archive - December 2025

> **Warning:** These tests are archived for reference only. Do NOT run them.

## Archive Information

| Field | Value |
|-------|-------|
| **Archive Date** | December 7, 2025 |
| **TEA Quality Score** | 52/100 (FAILING) |
| **Reason** | Critical anti-patterns identified in 12/14 spec files |
| **Archived By** | TEA (Test Engineering Architect) review workflow |

---

## Why These Tests Were Archived

A comprehensive TEA test-review (December 2025) identified that 85% of E2E test files contained critical anti-patterns that provide **false confidence** - tests pass without actually validating the intended behavior.

### Quality Score Breakdown

| Category | Score | Issues |
|----------|-------|--------|
| Determinism | 4/20 | Conditional flow, error swallowing |
| Assertions | 8/20 | No-op paths, hidden assertions |
| Selectors | 10/20 | Some CSS class usage, nth() patterns |
| Structure | 15/20 | Missing cleanup, shared state |
| Wait Patterns | 15/20 | Some `.catch(() => false)` patterns |
| **Total** | **52/100** | Below 80 threshold |

---

## Anti-Patterns Identified

### Critical (Found in 10+ files)

| Anti-Pattern | Severity | Files Affected | Example |
|--------------|----------|----------------|---------|
| Conditional flow control | CRITICAL | 12/14 | `if (await element.isVisible())` |
| Error swallowing | CRITICAL | 10/14 | `.catch(() => false)` |
| No-op assertion paths | CRITICAL | 6/14 | Assertions inside conditionals |

### High (Found in 5+ files)

| Anti-Pattern | Severity | Files Affected | Example |
|--------------|----------|----------------|---------|
| Runtime `test.skip()` | HIGH | 8/14 | `test.skip(true, 'reason')` |
| Cascading catch chains | HIGH | 5/14 | Multiple `.catch()` calls |

### Medium (Found in 3+ files)

| Anti-Pattern | Severity | Files Affected | Example |
|--------------|----------|----------------|---------|
| CSS class selectors | MEDIUM | 3/14 | `.locator('.btn-primary')` |
| Index-based selection | MEDIUM | 4/14 | `.nth(2)` without filter |

---

## Files Archived

### Spec Files (14 total)

```
tests/e2e-archive-2025-12/
├── auth.spec.ts              # Critical: conditional flow, error swallowing
├── love-notes-images.spec.ts # Critical: error swallowing
├── love-notes-pagination.spec.ts
├── mood-history-performance.spec.ts
├── mood-history-timeline.spec.ts
├── mood.spec.ts              # Critical: conditional flow, no-op paths
├── navigation.spec.ts        # High: conditional flow
├── offline.spec.ts           # High: runtime test.skip
├── partner-mood-viewing.spec.ts
├── photoViewer.spec.ts
├── photos.spec.ts            # Critical: cascading catches, no-op paths
├── quick-mood-logging.spec.ts # High: runtime test.skip
├── send-love-note.spec.ts    # Critical: no-op assertion paths
└── smoke.spec.ts
```

### Support Files

```
tests/e2e-archive-2025-12/
├── helpers/
│   └── partner-setup.ts
├── fixtures/
│   └── multi-user.fixture.ts
├── utils/
│   └── mock-helpers.ts
└── global-setup.ts
```

---

## New Quality Standards

All new E2E tests MUST follow the quality standards documented in:

**[docs/04-Testing-QA/e2e-quality-standards.md](../../docs/04-Testing-QA/e2e-quality-standards.md)**

Key requirements:
- No conditional flow control in tests
- No error swallowing (`.catch(() => false)`)
- No runtime `test.skip()` decisions
- All test paths must have guaranteed assertions
- Accessibility-first selector hierarchy
- Deterministic waits only

---

## Regeneration Plan

These archived tests will be regenerated with proper quality standards as part of Epic TD-1:

| Story | Scope | Status |
|-------|-------|--------|
| TD-1.1 | Auth E2E regeneration | Backlog |
| TD-1.2 | Love Notes E2E regeneration | Backlog |
| TD-1.3 | Mood E2E regeneration | Backlog |
| TD-1.4 | Photos E2E regeneration | Backlog |
| TD-1.5 | Integration test completion | Backlog |
| TD-1.6 | CI quality gates & hooks | Backlog |

---

## Reference Only

These tests are preserved as reference material for:

1. **Understanding feature behavior** - The test descriptions document intended functionality
2. **Migration guidance** - When rewriting, consult these for coverage scope
3. **Pattern examples** - Both what TO do (some patterns) and what NOT to do (anti-patterns)

**Do NOT:**
- Run these tests (`npx playwright test` will not find them)
- Copy code without fixing anti-patterns
- Reference line numbers (tests may have shifted)

---

## Related Documentation

- [E2E Quality Standards](../../docs/04-Testing-QA/e2e-quality-standards.md)
- [Testing Guide](../../docs/04-Testing-QA/testing-guide.md)
- [Epic TD-1 Tech Spec](../../docs/05-Epics-Stories/tech-spec-epic-td-1.md)
- [TEA Knowledge Base](../../.bmad/bmm/testarch/knowledge/)

---

*Archived as part of Story TD-1.0: Establish Quality Standards & Archive E2E Tests*
