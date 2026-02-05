---
name: 'step-03-quality-evaluation'
description: 'Evaluate 5 quality dimensions via sub-agents with selective fragment loading'
nextStepFile: './step-03f-aggregate-scores.md'
---

# Step 3: Quality Evaluation

## STEP GOAL

Evaluate test files across 5 quality dimensions using sub-agents that load only the fragments they need.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Output terse bullet lists only — no formatted tables, no verbose summaries
- ✅ Evaluate ALL 5 quality dimensions
- ✅ Write JSON output per dimension to `/tmp/`
- ❌ Do NOT read subprocess step files into your own context
- ❌ Do NOT load knowledge fragments into your own context

---

## EXECUTION MODE SELECTION

### Mode A: Sub-Agent Delegation (Default)

Launch sub-agents. Each sub-agent receives:
1. Its rubric step file path (the sub-agent reads it)
2. The test file paths (the sub-agent reads them)
3. Fragment file paths from the fragment map (the sub-agent loads only these)
4. The output JSON path to write to

**The orchestrator stays lightweight.** It does not read rubrics or fragments itself.

### Mode B: Inline Sequential (Fallback)

If sub-agents are unavailable, evaluate dimensions yourself by reading each rubric step file and the test files. Only use this if Mode A fails.

---

## MANDATORY SEQUENCE

### 1. Generate Timestamp

```javascript
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
```

### 2. Determine Fragment Assignments

From the fragment map (Step 1 output), assign relevant fragments to each dimension:

| Dimension | Always Gets | Also Gets (if in fragment map) |
|---|---|---|
| Determinism | `test-quality` | `timing-debugging` |
| Isolation | `test-quality` | `data-factories`, `fixtures-composition` |
| Maintainability | `test-quality` | `selector-resilience` |
| Coverage | `test-quality` | (story file, test design doc) |
| Performance | `test-quality` | `selective-testing` |

### 3. Launch Sub-Agents

For each dimension, launch a sub-agent with this prompt structure:

```
You are evaluating test quality for the "{dimension}" dimension.

1. Read your rubric: {rubric_step_file_path}
2. Read the test files: {test_file_paths}
3. Read these knowledge fragments: {assigned_fragment_paths}
4. Evaluate per the rubric criteria
5. Write JSON output to: /tmp/tea-test-review-{dimension}-{timestamp}.json

Use the JSON format specified in your rubric file.
Scoring formula: score = 100 - sum(severity_weights) where HIGH=10, MEDIUM=5, LOW=2.
Report the exact arithmetic result. Do NOT cap or override the score for any reason — no "capped at 50" rules. The only dimension with a score cap is Coverage (defined in its own rubric).
```

**Launch all 5 in parallel** for performance.

### 4. Wait and Verify

**Do NOT read TaskOutput content.** Sub-agents write JSON files; the aggregation agent reads them directly.

Poll for completion using bash:
```bash
# Check every 10s until all 5 files exist (up to 3 minutes)
for i in $(seq 1 18); do
  COUNT=$(ls /tmp/tea-test-review-*-{timestamp}.json 2>/dev/null | wc -l | tr -d ' ')
  [ "$COUNT" -ge 5 ] && break
  sleep 10
done
ls -l /tmp/tea-test-review-*-{timestamp}.json
```

Only check TaskOutput if files are missing after timeout (error diagnosis).

### 5. Launch Aggregation + Report Sub-Agent

**Do NOT load step 3F or step 4 yourself.** Launch a single sub-agent to handle aggregation and report generation with fresh context:

```
You are completing the TEA test-review workflow (steps 3F + 4).

1. Read step-03f-aggregate-scores.md: {step_03f_path}
2. Read all 5 dimension JSON files from /tmp/tea-test-review-*.json
3. Aggregate scores per the step-03f instructions
4. Write summary JSON to /tmp/tea-test-review-summary-{timestamp}.json
5. Read step-04-generate-report.md: {step_04_path}
6. Read the template: {template_path}
7. Fill template with aggregated scores and write to: {output_file}
8. Read the checklist: {checklist_path}
9. Validate report against checklist
10. Report completion summary
```

This sub-agent has fresh context for the template (390 lines) and checklist (472 lines).

---

## EXIT CONDITION

Proceed to Step 3F when:

- ✅ All 5 dimensions evaluated
- ✅ All output JSON files exist and are valid
- ✅ Each file has: dimension, score, grade, violations[], recommendations[]

---

## 🚨 SYSTEM SUCCESS METRICS

### ✅ SUCCESS:

- All 5 quality dimensions evaluated via sub-agents
- Orchestrator context stayed lightweight (no fragments loaded)
- Output files generated and valid

### ❌ FAILURE:

- Orchestrator loaded fragments or rubrics into own context
- Missing dimension evaluations
- Output files missing or invalid
