---
status: done
---

# TEA Test Review — dw-events-offline-message-honesty

Workflow `bmad-testarch-test-review` v5.0 ran to completion in Create mode, all five steps.

**Artifact:** `_bmad-output/test-artifacts/test-review.md`

## Result

| | |
|---|---|
| Quality Score | **61/100 (D — Needs Improvement)** |
| Recommendation | **Request Changes** (computed, not chosen) |
| Violations | 0 Critical, 0 High, 0 Medium, **39 Low** |
| Context Basis | `pr_diff` · Context Waivers Applied: 0 |

**Reviewed set** — the three test artifacts the working tree changes:

- `tests/unit/api/interactionService.test.ts` (484 lines, 33 tests)
- `tests/unit/api/fakeInteractionsBackend.ts` (336 lines, test support module)
- `tests/unit/api/offlineMessageHonesty.test.ts` (167 lines, 4 declared blocks / 11 runtime tests)

## What drove the number

37 of the 39 findings are one row: **L2, missing `[P#]` priority marker**. The convention is
`emerging` in this repo (9 of 40 sampled files outside the review set; 38 of the full 82-file
corpus — under 50% either way), so the deduction schedule fires it at LOW on every reviewed test
that lacks one. The other two are **L6 magic values**: `getInteractionHistory(USER_ID, 1, 1)` at
`interactionService.test.ts:370`, and the duplicated default `created_at` at
`fakeInteractionsBackend.ts:135` / `:291`.

No CRITICAL, HIGH or MEDIUM row fired in any dimension. Determinism, isolation and performance all
scored 100. The `Request Changes` verdict comes from the `score < 70` floor, not from a severity
tier — the fix list is roughly 50 minutes of text edits, and the P1/P2 priorities the markers need
already exist in `test-design-epic-dw-events-offline-message-honesty.md:213-234`.

## Evidence collected

- `npx vitest run` over both spec files: **44 tests, 44 passed, 470 ms**.
- Falsifiability probe: `expect(undefined).not.toContain(x)` and `expect(undefined).toBe(s)` both
  fail under vitest 4.1.10, so the `failure?.message` optional-chaining assertions are not hollow.
- Convention baseline measured with real `grep -l` over 40 named files; no count estimated.
- Every source line number the tests cite (`errorHandlers.ts:95`, `offlineErrorHandler.ts:74`,
  `errorHandlers.ts:109-117`) verified against the files.

## Decisions worth surfacing

- **C5 (CRITICAL, mock asserted against itself) was considered and did not fire** on the three
  "fake fidelity" tests at `interactionService.test.ts:76-110`. They call the fake's builder, whose
  own logic derives the asserted PGRST116 envelope, and `evidence-integrity.md` requires exactly
  this ("Instruments verified before readings"). Had it fired, the verdict would have been `Block`.
  The reasoning is recorded in the report's *Rows considered and deliberately not fired* table.
- **Execution mode resolved to `sequential`**, not `subagent`: `CLAUDE.md` forbids handing
  bmad-loop worktree work to a background subagent and waiting. All four dimension workers ran
  in-session; their JSON outputs are in this session's scratchpad rather than `{test_artifacts}/`,
  disclosed in the report.
- **Three rowless findings** are reported as prose with no severity and no deduction, per the
  registry: the "enforced repo-wide" honesty guard covers 6 hand-maintained paths and omits three
  Supabase-only surfaces `AGENTS.md` names; `it('covers every module in the list')` asserts only
  non-emptiness; and the import detector misses namespace imports, default imports and re-exports.

No test file was modified by this review (`generate_inline_comments` is false). Nothing was
excluded from the review set.
