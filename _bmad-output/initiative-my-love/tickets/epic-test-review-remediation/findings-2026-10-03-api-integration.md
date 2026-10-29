# Findings 2026-10-03: tests/api/ + tests/integration/

Verbatim copy of the scored findings in the 2026-10-03 TEA test review of tests/api/ + tests/integration/ (`test-review-target-tests.md`, run against main at bab5120e). Every row is in scope. Rule ids (C#, H#, M#, L#) are defined in TEA's criteria registry, `.claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md`; the Knowledge Base links below still carry the v6 `bmad-testarch-test-review` path and do not resolve. `corrections.md` overrides any row or suggested fix it names. Line numbers are from bab5120e; locate each finding by its content.

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Name the check_violation SQLSTATE

**Severity**: P3 (Low)
**Location**: `tests/api/empty-database-error-fallback.spec.ts:108`
**Row**: L6
**Criterion**: Magic Value
**Knowledge Base**: [data-factories.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md) (Example 6, Naming the Literals You Do Hardcode)

**Issue Description**:
`'23514'` decides which mapper branch the test exercises. It appears unnamed at line 108 and is asserted again at line 116. The test title says "CHECK mapping", so a reader can guess, but nothing in the file says that 23514 is Postgres `check_violation`. The file already uses the named sibling `UNMAPPED_SQLSTATE` for `XX000`, and `tests/support/check-constraint-envelopes.ts:101` exports `CHECK_VIOLATION_CODE = '23514'`.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
const error = await parseRejectedInsert(
  createDatabaseErrorEnvelope({ code: '23514', message: '' })
);
// ...
expect(mapped.code).toBe('23514');
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
import { CHECK_VIOLATION_CODE } from '../support/check-constraint-envelopes';

const error = await parseRejectedInsert(
  createDatabaseErrorEnvelope({ code: CHECK_VIOLATION_CODE, message: '' })
);
// ...
expect(mapped.code).toBe(CHECK_VIOLATION_CODE);
```

**Benefits**:
The literal says which requirement it encodes, and a change to the code value happens in one place shared with `check-constraint-error-mapping.spec.ts`.

**Priority**:
P3: a two-line edit with no effect on what the test proves.

---

## Violation Summary by Location

| Line | Severity | Criterion | Issue | Fix |
| ---- | -------- | --------- | ----- | --- |
| `tests/api/empty-database-error-fallback.spec.ts:108` | P3 | Magic Value (L6) | Unnamed SQLSTATE `'23514'` (also asserted at :116) | Use `CHECK_VIOLATION_CODE` |

