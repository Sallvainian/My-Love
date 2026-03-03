---
name: 'step-03-wrapup'
description: 'Finalize orchestration log, clean up agent, and recommend next workflow'

outputFile: '{output_folder}/orchestration-logs/orchestration-log-{workflow_name}-{date}.md'
initStepFile: './step-01-init.md'
---

# Step 3: Wrap-up

## STEP GOAL:

To finalize the orchestration log with the outcome, clean up the spawned agent, recommend the next workflow via bmad-help, and let the user decide whether to continue.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER generate content without user input for decisions
- 📖 CRITICAL: Read the complete step file before taking any action
- 📋 YOU ARE A COORDINATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT in the config `{communication_language}`

### Role Reinforcement:

- ✅ You are an orchestration coordinator wrapping up
- ✅ Keep communication concise and clear
- ✅ The user decides whether to run another workflow

### Step-Specific Rules:

- 🎯 Focus ONLY on finalizing, cleanup, and next-step recommendation
- 🚫 FORBIDDEN to start executing another workflow in this step
- 💬 Present clear options for next steps

## EXECUTION PROTOCOLS:

- 🎯 Finalize orchestration log
- 💾 Update {outputFile} with final status
- 📖 Clean up spawned agent
- 🚫 Do not auto-chain into another workflow

## CONTEXT BOUNDARIES:

- Available: Orchestration log at {outputFile}, workflow execution result from step-02
- Focus: Wrap-up, cleanup, and next-step recommendation
- Limits: Do not execute another workflow -- only recommend
- Dependencies: step-02 must have completed (success or failure)

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise unless user explicitly requests a change.

### 1. Finalize Orchestration Log

Update {outputFile} with the final status:

```markdown
### [timestamp] Orchestration Complete

- **Final Status:** [SUCCESS / FAILED / PARTIAL]
- **Duration:** [approximate time from start to end]
```

Update the frontmatter `status` field:

- SUCCESS: Workflow completed successfully
- FAILED: Workflow failed or was aborted
- PARTIAL: Workflow partially completed

### 2. Clean Up Agent

Send a shutdown request to the spawned agent (workflow-agent) via SendMessage.

If the agent does not respond to shutdown, note this in the log but proceed.

### 3. Recommend Next Workflow

Use the Skill tool to invoke `bmad-help` to determine the recommended next workflow based on updated project state.

Present the recommendation:

"**Orchestration complete.**

**Result:** [SUCCESS/FAILED/PARTIAL]
**Log saved to:** {outputFile}

**Recommended next workflow:** [recommendation from bmad-help]
**Reason:** [brief reason]"

### 4. Present Options

Display:

"**Select an option:**

- **[R]** Run the recommended workflow
- **[D]** Done -- end orchestration"

**Wait for user input.**

### 5. Handle Selection

#### Menu Handling Logic:

- **IF R:** Load, read entire file, then execute {initStepFile} to start a new orchestration cycle with the recommended workflow pre-selected
- **IF D:** Display summary and exit:

  "**Orchestration session complete.**

  **Workflow executed:** [workflow name]
  **Result:** [status]
  **Log:** {outputFile}

  Goodbye!"

- **IF any other:** Help user respond, then redisplay options from step 4

#### EXECUTION RULES:

- ALWAYS halt and wait for user input after presenting menu
- If user selects R, loop back to step-01 for a new orchestration
- If user selects D, end the workflow gracefully

## CRITICAL STEP COMPLETION NOTE

This is the final step. The workflow ends when the user selects D, or loops back to step-01 when the user selects R.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Orchestration log finalized with correct status
- Spawned agent cleaned up (shutdown request sent)
- Next workflow recommended via bmad-help
- User presented with clear options (run another or done)
- If user selects R, correctly loops back to step-01

### ❌ SYSTEM FAILURE:

- Not finalizing the orchestration log
- Not attempting to clean up the agent
- Auto-chaining into another workflow without user confirmation
- Not invoking bmad-help for next recommendation

**Master Rule:** Clean up, recommend, and let the user decide. Never auto-chain.
