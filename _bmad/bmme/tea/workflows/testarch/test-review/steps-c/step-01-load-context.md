---
name: 'step-01-load-context'
description: 'Load knowledge base selectively, determine scope, and gather context'
nextStepFile: './step-02-discover-tests.md'
knowledgeIndex: '{project-root}/_bmad/tea/testarch/tea-index.csv'
---

# Step 1: Load Context & Knowledge Base

## STEP GOAL

Determine review scope, selectively load required knowledge fragments, and gather related artifacts.

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Output terse bullet lists only — no formatted tables, no verbose summaries

---

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Record outputs before proceeding
- 📖 Load the next step only when instructed

## CONTEXT BOUNDARIES:

- Available context: config, loaded artifacts, and knowledge fragments
- Focus: this step's goal only
- Limits: do not execute future steps
- Dependencies: prior steps' outputs (if any)

## CONTEXT BUDGET RULE

**Load only what you need.** Knowledge fragments are large (300-700+ lines each). Loading all of them consumes context rapidly. Use the selective loading strategy below to stay under budget.

**Target: 3-5 fragments maximum** for single-file/story scope. Up to 7 for directory scope. Up to 10 for suite scope.

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

## 1. Determine Scope

Use `review_scope`:

- **single**: one file or one story's test files
- **directory**: all tests in folder
- **suite**: all tests in repo

If unclear, ask the user.

---

## 2. Scan Test Files for Patterns (Do NOT Read Full Files)

**Use grep/search tools** to scan test files for pattern indicators. Do NOT read full test files into orchestrator context — sub-agents will read them in Step 3.

**Grep for these patterns** (one search per group is fine):

| Pattern to Grep | Relevant Fragment |
|---|---|
| `Math.random`, `Date.now`, `new Date` | `timing-debugging` |
| `waitForTimeout` | `timing-debugging` |
| `page.route`, `waitForResponse` | `network-first` |
| `createTestSession`, factory | `data-factories` |
| `mergeTests` | `fixtures-composition` |
| `supabaseAdmin`, `.rpc(` | `api-request` |
| `data-testid`, `getByTestId` | `selector-resilience` |
| `aria-label`, `aria-pressed` | `selector-resilience` |
| `networkRecorder`, `HAR` | `network-recorder` |
| `authSession`, `signIn` | `auth-session` |
| `upload`, `download`, `CSV`, `PDF` | `file-utils` |
| `recurse`, `polling` | `recurse` |
| `describe.serial` | `selective-testing` |

Record which patterns matched and which test files they appeared in.

## 3. Build Fragment Map (Do NOT Load Fragments Yet)

Read `{knowledgeIndex}` (the CSV index — ~36 lines).

Using the pattern scan from Step 2, build a **fragment map**: a list of fragment IDs and file paths relevant to the test code. Do NOT read the fragment files themselves — just record which ones are needed.

**Always include:** `test-quality` (scoring rubric)

**Example output:**

```
Fragment Map:
- test-quality → knowledge/test-quality.md (always)
- timing-debugging → knowledge/timing-debugging.md (found Date.now)
- data-factories → knowledge/data-factories.md (found createTestSession)
- selector-resilience → knowledge/selector-resilience.md (found data-testid, aria-label)
```

This map will be passed to sub-agents in Step 3 so they can load only what they need.

**Do NOT load fragment files into the orchestrator context.** Sub-agents load them.

---

## 4. Locate Context Artifacts (Paths Only)

Search for these files but do NOT read them — just record their paths:

- Story file (acceptance criteria) — e.g., `*epic*2*` or story argument match
- Test design doc (priorities) — e.g., `*test-design*`
- ATDD checklist (if exists) — e.g., `*atdd*checklist*`

Record paths found. Sub-agents that need acceptance criteria (coverage dimension) will read them.

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs
- Knowledge fragments selectively loaded (not bulk)
- Context budget respected

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
- Loaded all 18+ fragments (context budget exceeded)
  **Master Rule:** Skipping steps is FORBIDDEN.
