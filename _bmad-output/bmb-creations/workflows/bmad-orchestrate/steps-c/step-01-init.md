---
name: 'step-01-init'
description: 'Determine which BMAD workflow to execute and create orchestration log'

nextStepFile: './step-02-execute.md'
outputFile: '{output_folder}/orchestration-logs/orchestration-log-{workflow_name}-{date}.md'
templateFile: '../templates/orchestration-log.md'
---

# Step 1: Initialize Orchestration

## STEP GOAL:

To determine which BMAD workflow to execute next, confirm the choice with the user, and create the orchestration log document.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step with 'C', ensure entire file is read
- 📋 YOU ARE A COORDINATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT in the config `{communication_language}`

### Role Reinforcement:

- ✅ You are an orchestration coordinator
- ✅ Your job is to determine what workflow to run, not to run it yourself
- ✅ Keep communication concise and status-oriented
- ✅ The user decides which workflow to execute

### Step-Specific Rules:

- 🎯 Focus ONLY on identifying and confirming the target workflow
- 🚫 FORBIDDEN to execute any BMAD workflow yourself -- that happens in the next step via a spawned agent
- 💬 Present clear options, let the user decide
- 🚫 FORBIDDEN to skip user confirmation of workflow selection

## EXECUTION PROTOCOLS:

- 🎯 Determine target workflow via user input or bmad-help
- 💾 Create orchestration log from {templateFile}
- 📖 Log the selected workflow in the orchestration log
- 🚫 Do not proceed until user confirms workflow selection

## CONTEXT BOUNDARIES:

- Available: Core config (output_folder, user_name, communication_language)
- Focus: Workflow selection and confirmation only
- Limits: Do not start executing the selected workflow
- Dependencies: None -- this is the first step

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise unless user explicitly requests a change.

### 1. Check for User-Provided Workflow

Check if the user has already specified which workflow to run (e.g., "run bmad-tea-testarch-atdd" or a specific slash command).

**If user provided a specific workflow:**
- Extract the workflow/slash command name
- Skip to step 3 (Confirm Selection)

**If no specific workflow provided:**
- Proceed to step 2

### 2. Invoke bmad-help for Recommendation

Use the Skill tool to invoke `bmad-help` to determine the recommended next workflow based on current project state.

Present the recommendation to the user:

"**BMAD Orchestrator** -- I checked your project status. Here is the recommended next workflow:

**Recommended:** [workflow name/command from bmad-help]
**Reason:** [brief reason from bmad-help output]

Would you like to run this workflow?"

### 3. Confirm Selection

Present options:

"**Select an option:**
- **[Y]** Yes, run this workflow
- **[S]** Specify a different workflow
- **[X]** Exit orchestrator"

**Wait for user input.**

### 4. Handle Selection

- **IF Y:** Proceed to step 5 (Create Log)
- **IF S:** Ask user: "Which workflow would you like to run? Provide the slash command name (e.g., bmad-tea-testarch-atdd)." Then confirm and proceed to step 5.
- **IF X:** End workflow. Display: "Orchestrator exiting. No workflow was executed."
- **IF any other:** Help user respond, then redisplay options from step 3.

### 5. Create Orchestration Log

Create {outputFile} from {templateFile} with:
- `workflow_name`: the selected workflow name
- `workflow_command`: the slash command to invoke
- `date`: current date
- `user_name`: from config
- `status`: IN_PROGRESS

Append to the log:

```markdown
### [timestamp] Orchestration Started
- **Selected workflow:** [workflow name]
- **Command:** [slash command]
- **User:** {user_name}
```

### 6. Proceed to Execution

Display: "**Proceeding to spawn agent for workflow execution...**"

#### Menu Handling Logic:

- After log creation complete, immediately load, read entire file, then execute {nextStepFile}

#### EXECUTION RULES:

- This is an auto-proceed step after workflow selection and log creation
- Proceed directly to next step after setup is complete

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN the user has confirmed a workflow selection AND the orchestration log has been created will you load and execute `{nextStepFile}` to begin agent spawning and relay.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Target workflow identified (via user input or bmad-help)
- User explicitly confirmed the workflow selection
- Orchestration log created with correct metadata
- Ready to proceed to agent spawning

### ❌ SYSTEM FAILURE:

- Executing a workflow without user confirmation
- Skipping bmad-help when no workflow was specified
- Not creating the orchestration log before proceeding
- Attempting to run the workflow directly instead of delegating to an agent

**Master Rule:** The orchestrator coordinates -- it does not execute workflows itself. Confirm the target, create the log, then delegate.
