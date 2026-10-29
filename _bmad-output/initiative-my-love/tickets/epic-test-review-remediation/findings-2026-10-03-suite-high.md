# Findings 2026-10-03: whole suite, High rows

Verbatim copy of the four High (H10) findings in the 2026-10-03 whole-suite TEA test review (`test-review-system.md`, run against main at bab5120e). Only these four rows are in scope; the suite run's Medium and Low rows are not. They sit in tests/api, tests/e2e and tests/unit and do not repeat a folder-run row. Rule ids are defined in TEA's criteria registry, `.claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md`; the Knowledge Base link below still carries the v6 `bmad-testarch-test-review` path and does not resolve. Line numbers are from bab5120e; locate each finding by its content.

### 1. Shape-only assertions on values the test can predict (4 findings)

**Severity**: P1 (High)
**Location**: `tests/api/upload-love-note-image-limits.spec.ts:125`
**Row**: H10
**Criterion**: Explicit Assertions
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
Each of these assertions can fail on a wrong type or class, but passes on every wrong value of the right shape. Each one has an exact expected value available:

- `upload-love-note-image-limits.spec.ts:125`: the case takes a documented playwright-utils deviation precisely to read `x-ratelimit-remaining`, then asserts only that the header exists. `'abc'`, `'-1'` or a count above the limit would all pass. `supabase/functions/upload-love-note-image/handler.test.ts:582-586` asserts the exact remaining count.
- `tests/e2e/home/events.spec.ts:139`: the test pins the page clock with `pinClock()` and seeds `FUTURE_MEETUP` at `daysFromNow: 14`, so the countdown value is predictable. It asserts `/^\d+ days?$/`. `tests/e2e/settings/events-crud.spec.ts:189` pins the same kind of value as `'29 days'`.
- `tests/unit/services/moodNormalization.test.ts:191`: the empty-moods refusal is checked with `toSatisfy(isValidationError)`, which is `instanceof ValidationError`. A refusal about the note or the date would also pass.
- `tests/unit/services/moodNormalization.test.ts:195`: the no-owner refusal is checked with a bare `rejects.toThrow()`. `saveForDate` throws `Error('User not authenticated')` (`src/services/moodService.ts:136`), and an IndexedDB or validation error would pass just as well.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
expect(response.headers()['x-ratelimit-remaining']).toBeDefined();
await expect(futureCard.getByTestId('countdown-value')).toHaveText(/^\d+ days?$/);
await expect(moodService.saveForDate(A, date, [], undefined)).rejects.toSatisfy(isValidationError);
await expect(moodService.saveForDate('', date, ['happy'])).rejects.toThrow();
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
const remaining = response.headers()['x-ratelimit-remaining'];
expect(remaining).toMatch(/^\d+$/); // other cases in this worker may share the minute window
expect(Number(remaining)).toBeLessThan(RATE_LIMIT_MAX_UPLOADS);

await expect(futureCard.getByTestId('countdown-value')).toHaveText('13 days'); // N-1 at the pinned anchor

await expect(moodService.saveForDate(A, date, [], undefined)).rejects.toMatchObject({
  name: 'ValidationError',
  message: /* the empty-moods message */,
});
await expect(moodService.saveForDate('', date, ['happy'])).rejects.toThrow('User not authenticated');
```

**Benefits**:
Each test then fails when the behaviour is wrong, not only when the type is wrong. The expected day count in `events.spec.ts` should come from the same N-1 rule `events-crud.spec.ts:189` documents. Confirm it against the rendered card when you make the change.

**Priority**:
P1. A HIGH row: each test can stay green while the value it exists to check is wrong.

---

