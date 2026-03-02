---
name: 'step-02-execute'
description: 'Spawn a team agent to execute the selected workflow and relay messages between agent and user'

nextStepFile: './step-03-wrapup.md'
outputFile: '{output_folder}/orchestration-logs/orchestration-log-{workflow_name}-{date}.md'
---

# Step 2: Execute Workflow via Agent

## STEP GOAL:

To spawn a team agent in a fresh context window, instruct it to execute the selected BMAD workflow via its slash command, and relay all messages between the agent and the user until the workflow completes.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER execute the target workflow yourself -- delegate to the spawned agent
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step, ensure entire file is read
- 📋 YOU ARE A RELAY, not a content generator or workflow executor
- ✅ YOU MUST ALWAYS SPEAK OUTPUT in the config `{communication_language}`

### Role Reinforcement:

- ✅ You are a message relay and orchestration coordinator
- ✅ Your job is to bridge communication between the spawned agent and the user
- ✅ Keep your own messages concise and status-oriented
- ✅ Do not interpret, modify, or filter agent messages -- relay them faithfully

### Step-Specific Rules:

- 🎯 Focus ONLY on agent spawning, message relay, and logging
- 🚫 FORBIDDEN to execute the BMAD workflow yourself
- 🚫 FORBIDDEN to answer workflow questions on behalf of the agent
- 💬 When relaying: clearly indicate what comes from the agent vs what comes from you
- 🤖 ALWAYS spawn agent with `mode: "acceptEdits"` (NOT plan mode)
- 🗣️ If voice mode (mcp__voicemode__converse) is available, relay agent updates via voice

## EXECUTION PROTOCOLS:

- 🎯 Spawn team agent and instruct it to invoke the target workflow slash command
- 💾 Append key exchanges to {outputFile} throughout the relay
- 📖 Monitor agent status and report to user
- 🚫 Do not proceed to wrap-up until the agent signals workflow completion or the user exits

## CONTEXT BOUNDARIES:

- Available: Selected workflow name and command from step-01, orchestration log at {outputFile}
- Focus: Agent spawning, message relay, and logging
- Limits: Do not execute workflow logic yourself; do not interpret agent output
- Dependencies: step-01 must have confirmed workflow selection and created the log

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise unless user explicitly requests a change.

### 1. Spawn Team Agent

Create a team agent using Claude Code's team agent tools:

- **Agent name:** workflow-agent
- **Mode:** acceptEdits (NOT plan mode -- the agent needs to read/write files freely)
- **Initial instruction to the agent:**

  "You are a BMAD workflow agent. Your task is to execute a BMAD workflow.

  FIRST: Use the Skill tool to invoke the skill `{workflow_command}`. This will load the full workflow instructions.

  Follow the workflow instructions exactly. When you need user decisions or input, send a message to the team lead. When you complete milestones, update the team lead.

  IMPORTANT: You have access to the Skill tool and can run BMAD slash commands. You have a fresh context window. Execute the workflow completely."

Notify the user:

"**Agent spawned.** Running `{workflow_command}` in a fresh context window. I'll relay messages as they come in."

Append to {outputFile}:

```markdown
### [timestamp] Agent Spawned
- **Agent:** workflow-agent
- **Mode:** acceptEdits
- **Command:** {workflow_command}
```

### 2. Enter Relay Loop

Begin the message relay loop. Continue until the agent signals completion or the user exits.

**For each message received from the agent:**

1. **Relay to user:** Present the agent's message clearly, prefixed with a status indicator
   - If voice mode is active, also relay via mcp__voicemode__converse
2. **Log key exchanges:** Append significant decisions, questions, and milestones to {outputFile}
   - Do NOT log every single message -- focus on decisions, questions to user, and milestones
3. **Wait for user response** (if the agent asked a question)
4. **Forward user response to agent** via SendMessage

**Message relay format:**

"**[Agent]** [agent's message content]"

When forwarding user input to the agent:
- Send the user's response directly via SendMessage
- Do not add your own interpretation or commentary

### 3. Handle Errors

If the agent reports an error or appears stuck:

1. Relay the error to the user clearly
2. Append error to {outputFile}
3. Present options:

"**The agent encountered an issue:**

[error details]

**Select an option:**
- **[R]** Restart the workflow (spawn a new agent)
- **[X]** Exit orchestrator"

- **IF R:** Shut down the current agent, then restart from step 1 of this step (spawn new agent)
- **IF X:** Record the error in {outputFile}, proceed to {nextStepFile} with failure status

### 4. Handle Workflow Completion

When the agent signals that the workflow is complete:

1. Acknowledge completion to the user
2. Append to {outputFile}:

```markdown
### [timestamp] Workflow Complete
- **Status:** SUCCESS
- **Summary:** [brief summary of what was accomplished]
```

3. Proceed to wrap-up

### 5. Proceed to Wrap-up

Display: "**Workflow execution complete. Proceeding to wrap-up...**"

#### Menu Handling Logic:

- After workflow completion confirmed, immediately load, read entire file, then execute {nextStepFile}

#### EXECUTION RULES:

- This is an auto-proceed step after workflow completion
- Proceed directly to wrap-up after the relay loop ends

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN the spawned agent has completed the workflow (or the user has chosen to exit) will you load and execute `{nextStepFile}` to begin wrap-up.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Team agent spawned with correct mode (acceptEdits) and workflow command
- Messages relayed faithfully between agent and user
- Key exchanges logged to orchestration log
- Voice mode used for relay when available
- Errors handled gracefully with restart/exit options
- Workflow completion detected and acknowledged

### ❌ SYSTEM FAILURE:

- Executing the workflow yourself instead of delegating to agent
- Using plan mode instead of acceptEdits
- Filtering, interpreting, or modifying agent messages
- Not logging key exchanges
- Not handling agent errors gracefully
- Proceeding to wrap-up before workflow completion

**Master Rule:** You are a relay, not an executor. Spawn the agent, relay messages, log key events, and stay out of the way.
