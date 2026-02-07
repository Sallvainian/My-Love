# TA Story 1.3 AC-6 Closure — Approved Plan v2

## Review Findings Applied
- Added explicit backend assertion for `status='in_progress'` and `current_step_index`.
- Added explicit local continuity assertion (`resume-prompt` on revisit).
- Added mandatory cleanup (`resume-start-fresh`) to reduce session-pollution risk.
- Kept scope strict to requested files only.

## AC -> Test Mapping (Approved)
- AC-1 -> existing `[P0-009]` (unchanged)
- AC-2 -> existing verse-screen tests (unchanged)
- AC-3 -> existing response-navigation tests (unchanged)
- AC-4 -> existing `[P1-001]`, `[P1-012]`, `[P0-009]` (unchanged)
- AC-5 -> existing `[P2-012]`, `[P0-009]` (unchanged)
- AC-6 -> new `[P1-013]` in `tests/e2e/scripture/scripture-solo-reading.spec.ts`

## PASS/FAIL Criteria for AC-6
AC-6 = PASS only if all are true:
1. Exit confirmation dialog is visible.
2. Prompt text matches AC intent.
3. Save action returns to scripture overview.
4. Backend session snapshot has `status === 'in_progress'` and `current_step_index >= 1`.
5. Resume prompt is visible when revisiting `/scripture`.

AC-6 = FAIL if any criterion above fails.

## Gate Recalculation Rules
1. `P0 FULL` must remain 100%.
2. Overall `FULL >= 90%` -> `PASS`.

## Implementation Order
1. Update helper interface and snapshot reader in `tests/support/helpers.ts`.
2. Add `[P1-013]` and update Test ID header in `tests/e2e/scripture/scripture-solo-reading.spec.ts`.
3. Run validation commands in defined order.
4. Allow one refine iteration only if first failure occurs.
5. Update traceability matrix + gate summary + gate JSON from observed evidence.
6. Publish implementation report under `_bmad-output/`.
