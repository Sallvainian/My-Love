# TA Story 1.3 AC-6 Closure — Plan Draft

## Workflow Context
- Engine: `/Users/sallvain/Projects/My-Love/_bmad/core/tasks/workflow.xml`
- Workflow config: `/Users/sallvain/Projects/My-Love/_bmad/tea/workflows/testarch/automate/workflow.yaml`
- Validation checklist: `/Users/sallvain/Projects/My-Love/_bmad/tea/workflows/testarch/automate/checklist.md`
- Story gate baseline: `CONCERNS` due to AC-6 = PARTIAL
- Reliability evidence baseline: commits `f9983b3`, `bcc26d2`, plus green `[P1-012]` + `[P2-012]`

## Scope-Locked Targets
- `tests/e2e/scripture/scripture-solo-reading.spec.ts`
- `tests/support/helpers.ts`
- `_bmad-output/traceability-matrix-story-1-3-solo-reading.md`
- `_bmad-output/traceability-gate-story-1-3-summary.md`
- `_bmad-output/traceability-gate-story-1-3.json`
- `_bmad-output/ta-story-1-3-implementation-report.md`

## Planned Code Changes
### 1) `tests/e2e/scripture/scripture-solo-reading.spec.ts`
- Update top-file Test ID header to match actual tagged tests and include AC-6 coverage ID.
- Add new deterministic E2E scenario: `[P1-013] Exit with Save persistence`.
- New scenario assertions:
  1. Start solo session and advance once (`Verse 1 -> Verse 2`).
  2. Open exit dialog.
  3. Assert AC-6 prompt semantics: `Save your progress? You can continue later.`
  4. Click `save-and-exit-button` with save interception registered before click.
  5. Assert return to overview.
  6. Assert backend session state remains `status='in_progress'` and `current_step_index >= 1`.
  7. Revisit `/scripture` and assert `resume-prompt` is visible.
  8. Cleanup by selecting `resume-start-fresh` to avoid session pollution.

### 2) `tests/support/helpers.ts`
- Add exported type:
  - `ScriptureSessionSnapshot = { id: string; status: string; mode: string; current_step_index: number }`
- Add exported function:
  - `getScriptureSessionSnapshot(page, sessionId): Promise<ScriptureSessionSnapshot | null>`
- Implementation uses existing auth context extraction and Supabase REST read path to query exact session row.

## Planned Validation Commands
1. `npx playwright test tests/e2e/scripture/scripture-solo-reading.spec.ts --project=chromium --grep "\\[P1-013\\]"`
2. `npx playwright test tests/e2e/scripture/scripture-solo-reading.spec.ts --project=chromium --grep "\\[P1-013\\]|\\[P1-012\\]|\\[P2-012\\]"`
3. `npx playwright test tests/e2e/scripture/scripture-solo-reading.spec.ts --project=chromium --grep "\\[P1-013\\]|\\[P1-012\\]|\\[P2-012\\]" --repeat-each=10`

## Planned Gate Update
- Expected if validation passes: AC-6 moves PARTIAL -> FULL, total FULL = 6/6, deterministic decision moves `CONCERNS` -> `PASS`.
- If validation fails after one refine iteration: keep `CONCERNS` and document residual risk + follow-up action.
