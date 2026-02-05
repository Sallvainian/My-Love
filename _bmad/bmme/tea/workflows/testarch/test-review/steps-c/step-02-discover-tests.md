---
name: 'step-02-discover-tests'
description: 'Find and parse test files'
nextStepFile: './step-03-quality-evaluation.md'
---

# Step 2: Discover & Parse Tests

## STEP GOAL

Collect test files in scope and parse structure/metadata.

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

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

## 1. Discover Test Files

- **single**: use provided file path
- **directory**: glob under `{test_dir}` or selected folder
- **suite**: glob all tests in repo

Halt if no tests are found.

---

## 2. Parse Metadata (per file — grep only, do NOT read full files)

**Use `wc -l` for line counts and grep/search for metadata.** Do NOT read full test files into orchestrator context — sub-agents handle that in Step 3.

Collect via grep:

- Line count (`wc -l`)
- Framework: grep for `import.*from.*playwright` or similar
- Test counts: grep for `test\(` or `it\(` and `describe\(`
- Test IDs: grep for test ID patterns (e.g., `2.1-E2E-`, `2.1-API-`)
- Priority markers: grep for `P0`, `P1`, `P2`, `P3`
- Imports: grep for `^import`
- Fixtures: grep for `{ page`, `supabaseAdmin`, `testSession`
- Factories: grep for `createTestSession`, `cleanupTestSession`
- Network: grep for `page.route`, `waitForResponse`
- Hard waits: grep for `waitForTimeout`
- Control flow: grep for `try {`, `catch`, `if (`

Load next step: `{nextStepFile}`

## 🚨 SYSTEM SUCCESS/FAILURE METRICS:

### ✅ SUCCESS:

- Step completed in full with required outputs

### ❌ SYSTEM FAILURE:

- Skipped sequence steps or missing outputs
  **Master Rule:** Skipping steps is FORBIDDEN.
