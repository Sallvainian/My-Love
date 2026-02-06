---
name: 'step-04-generate-report'
description: 'Create test-review report and validate'
outputFile: '{output_folder}/test-review.md'
templatePath: '{installed_path}/test-review-template.md'
checklistPath: '{installed_path}/checklist.md'
---

# Step 4: Generate Report & Validate

## STEP GOAL

Produce the test-review report and validate against checklist. This step loads the template and checklist on demand (they are NOT pre-loaded by the orchestrator).

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Record outputs before proceeding

## CONTEXT BOUNDARIES:

- Available context: aggregated scores from Step 3F (JSON summary file)
- Focus: report generation and validation only

## RECOMMENDED: Run as Sub-Agent

This step benefits from a fresh context. The orchestrator should launch a sub-agent with:
- This step file as instructions
- The aggregated summary JSON path from Step 3F
- The template path: `{templatePath}`
- The checklist path: `{checklistPath}`
- The output path: `{outputFile}`

The sub-agent reads the template, fills it with aggregated scores, validates against checklist, and writes the final report.

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

## 1. Load Template

Read `{templatePath}` (the test-review template).

## 2. Load Aggregated Scores

Read the summary JSON from Step 3F (`/tmp/tea-test-review-summary-*.json`).

## 3. Report Generation

Fill in the template with:

- Score summary (overall + per-dimension)
- Critical findings with fixes (from violations)
- Warnings and recommendations (from top-10 recommendations)
- Context references (story/test-design if available)

Write completed report to `{outputFile}`.

---

## 4. Validation

Read `{checklistPath}` and validate the report against it. Fix any gaps.

---

## 5. Completion Summary

Report:

- Scope reviewed
- Overall score
- Critical blockers
- Next recommended workflow (e.g., `automate` or `trace`)

### Update ContextStream Plan Task

On workflow completion:

1. **Search for matching task**: Call `mcp__contextstream__memory(action="list_tasks")` and find a task whose title matches this test review workflow (e.g., the story key or test file name)
2. **If matching task found**: Call `mcp__contextstream__memory(action="update_task", task_id="{{task_id}}", task_status="completed")`
3. **If no matching task**: Skip — not all workflow runs correspond to plan tasks
4. **Capture completion**: Call `mcp__contextstream__session(action="capture", event_type="implementation", title="Test review completed: {{scope}}", content="Overall score: {{overall_score}}/100. {{critical_count}} critical issues found.", importance="medium", tags=["test-review", "workflow-complete"])`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Template loaded on demand (not pre-loaded by orchestrator)
- Report generated and written to output file
- Validated against checklist

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
