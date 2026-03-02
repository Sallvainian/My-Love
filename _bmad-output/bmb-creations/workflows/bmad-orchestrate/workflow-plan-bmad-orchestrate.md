---
stepsCompleted: ['step-01-discovery', 'step-02-classification', 'step-03-requirements', 'step-04-tools', 'step-05-plan-review', 'step-06-design', 'step-07-foundation', 'step-08-build-step-01', 'step-09-build-remaining', 'step-10-confirmation', 'step-11-completion']
created: 2026-02-27
approvedDate: 2026-02-27
completedDate: 2026-02-27
status: COMPLETE
---

# Workflow Creation Plan

## Discovery Notes

**User's Vision:**
A meta-orchestration workflow that coordinates the execution of any BMAD workflow via Claude Code's team agent pattern. Instead of manually setting up team agents each time, the user invokes this single orchestrator which handles agent spawning, message relay between user and agent, and cleanup. It solves the problem of repetitive boilerplate when running BMAD workflows in fresh context windows.

**Who It's For:**
The project owner (Sallvain) — a single user orchestrating BMAD workflows during development.

**What It Produces:**
A lightweight orchestration log (markdown) recording the workflow that was run, key decisions/questions relayed, timestamps, and the final result. Output to `{output_folder}/orchestration-logs/`. The primary "output" remains the successful execution of the target BMAD workflow by a spawned agent.

**Key Insights:**
- Standalone core workflow, not tied to any module (bmm, tea, etc.)
- Team agents have access to the Skill tool and get fresh context windows (satisfies BMAD's fresh context requirement)
- Spawned agents use `mode: "acceptEdits"` (NOT plan mode)
- Voice mode (mcp__voicemode__converse) relay is a key feature — if voice is active, relay updates via voice
- Error handling: relay errors to user, offer to restart the workflow. Keep it simple.
- Strictly one workflow at a time — no auto-chaining. After completion, invoke bmad-help to recommend next step, but user decides.
- No state persistence — relies on bmad-help (which scans artifacts and sprint status) for tracking completed workflows.
- The orchestrator is a relay/coordinator, not a content generator.

## Classification Decisions

**Workflow Name:** bmad-orchestrate
**Target Path:** `_bmad/core/workflows/bmad-orchestrate/`

**4 Key Decisions:**
1. **Document Output:** true - Produces a lightweight orchestration log (markdown) recording the workflow run, key decisions/questions relayed, timestamps, and final result. Output to `{output_folder}/orchestration-logs/`.
2. **Module Affiliation:** Standalone (core) - Not tied to any module. Lives alongside other core workflows (advanced-elicitation, brainstorming, party-mode).
3. **Session Type:** Single-session - Each orchestration run handles one workflow. The orchestrator itself is lightweight; the heavy lifting happens in the spawned agent's context.
4. **Lifecycle Support:** Create-only - This is a utility/coordination workflow. No need for edit or validate modes.

**Structure Implications:**
- Only needs `steps-c/` directory (create-only, no steps-e/ or steps-v/)
- No step-01b-continue.md needed (single-session)
- Needs a lightweight log template for the orchestration log output
- Standard `workflow.md` entry point
- Step files focus on execution/coordination logic with log document appending

## Requirements

**Flow Structure:**
- Pattern: Linear with a relay loop in the middle
- Phases:
  1. Init -- determine which workflow to run (via bmad-help or user input)
  2. Confirm -- confirm with user, create orchestration log document
  3. Execute -- spawn team agent, relay messages in a loop until workflow completes
  4. Wrap-up -- log final result, invoke bmad-help for next step recommendation, clean up
- Estimated steps: 3-4 step files

**User Interaction:**
- Style: Mixed -- Init phase is collaborative (user picks workflow), Execute phase is mostly autonomous (orchestrator relays), Wrap-up is collaborative (user decides next)
- Decision points: (a) Which workflow to run, (b) Forwarding user decisions to agent during relay, (c) Whether to run another workflow after completion
- Checkpoint frequency: Only at explicit decision points -- no periodic pauses

**Inputs Required:**
- Required: None -- the orchestrator discovers what to run via bmad-help or user instruction
- Optional: A specific workflow command (e.g., "run bmad-tea-testarch-atdd") to skip the discovery phase
- Prerequisites: BMAD must be installed in the project (slash commands available)

**Output Specifications:**
- Type: Document (orchestration log)
- Format: Free-form -- lightweight markdown log
- Output path: `{output_folder}/orchestration-logs/orchestration-log-{workflow-name}-{timestamp}.md`
- Content: Timestamp, workflow name, key decisions/questions relayed, agent status updates, final result/outcome
- Frequency: One log per orchestrated workflow execution

**Success Criteria:**
- Target workflow executed successfully by spawned agent in a fresh context
- Key decisions and outcomes captured in the orchestration log
- User informed of next recommended workflow (via bmad-help) after completion
- Errors handled gracefully with restart option

**Instruction Style:**
- Overall: Mixed
- Init/confirm steps: Prescriptive (structured menus, clear options)
- Execute/relay step: Intent-based (adapt to whatever the agent sends back)
- Wrap-up step: Prescriptive (clear options for next steps)

## Tools Configuration

**Core BMAD Tools:**
- **Party Mode:** Excluded -- no creative brainstorming phase in an orchestrator
- **Advanced Elicitation:** Excluded -- no deep exploration needed; this is coordination
- **Brainstorming:** Excluded -- same reasoning

**LLM Features:**
- **Web-Browsing:** Excluded -- no external research needed
- **File I/O:** Included -- needed to create/append to the orchestration log
- **Sub-Agents:** Included -- core mechanism (spawning team agents to run workflows)
- **Sub-Processes:** Excluded -- team agents used instead

**Memory:**
- Type: Single-session, no complex state tracking
- The orchestration log itself serves as the persistent record

**External Integrations:**
- **Skill tool:** Critical -- spawned agent uses it to invoke BMAD slash commands
- **SendMessage tool:** Critical -- orchestrator uses it for relay between agent and user
- **Voice mode (mcp__voicemode__converse):** Optional -- used if voice is active
- **bmad-help:** Used internally for workflow recommendation

**Installation Requirements:** None -- all tools are built into Claude Code

## Workflow Design

### File Structure
```
_bmad/core/workflows/bmad-orchestrate/
  workflow.md                    # Entry point + initialization
  steps-c/
    step-01-init.md              # Determine which workflow to run
    step-02-execute.md           # Spawn agent, relay loop, log
    step-03-wrapup.md            # Final result, recommend next, cleanup
  templates/
    orchestration-log.md         # Log template
```

### Step Sequence

**workflow.md** (Entry Point)
- Load core config (`_bmad/core/config.yaml`)
- Resolve `output_folder`, `user_name`, `communication_language`
- Define role: orchestration coordinator
- Route to step-01-init.md

**step-01-init.md** (Determine Workflow)
- Type: Init (Non-Continuable)
- Goal: Identify which BMAD workflow to execute
- Sequence:
  1. Check if user provided a specific workflow command
  2. If not, invoke bmad-help (Skill tool) to get recommended next workflow
  3. Present recommendation with options: [Y] Yes / [S] Specify different / [X] Exit
  4. Once confirmed, create orchestration log from template
  5. Auto-proceed to step-02-execute
- Menu: Custom (Y/S/X) -- no A/P
- Output: Creates log at `{output_folder}/orchestration-logs/orchestration-log-{workflow_name}-{date}.md`

**step-02-execute.md** (Spawn + Relay Loop)
- Type: Middle (relay loop pattern)
- Goal: Spawn team agent, relay messages until workflow completes
- Sequence:
  1. Spawn team agent (mode: acceptEdits, NOT plan mode)
  2. Instruct agent to invoke target workflow slash command via Skill tool
  3. Relay loop: agent messages -> user, user responses -> agent
  4. Voice mode relay if mcp__voicemode__converse is active
  5. Log key exchanges to orchestration log
  6. Error handling: relay error, offer [R] Restart / [X] Exit
  7. Auto-proceed to step-03-wrapup on completion
- Menu: None (relay loop handles interaction)

**step-03-wrapup.md** (Finalize)
- Type: Final Step
- Goal: Record result, recommend next, offer options
- Sequence:
  1. Record final outcome in orchestration log
  2. Clean up spawned agent (shutdown request)
  3. Invoke bmad-help for next recommended workflow
  4. Present: [R] Run recommended / [D] Done
  5. If R: loop back to step-01-init
  6. If D: finalize log, display summary, exit
- Menu: Custom (R/D)

### Interaction Patterns
- step-01: Prescriptive (structured menu)
- step-02: Intent-based (adaptive relay)
- step-03: Prescriptive (structured menu)

### Data Flow
- Log created in step-01, appended in step-02, finalized in step-03
- Log file path passed via frontmatter variable

### Role & Persona
- Orchestration coordinator / relay facilitator
- Concise, status-oriented tone
- Not a content generator -- purely coordination
- Voice mode relay when available

### Error Handling
- Agent spawn failure: report to user, offer retry
- Agent error during workflow: relay error, offer restart or exit

## Foundation Build Complete

**Created:**
- Folder structure at: `_bmad-output/bmb-creations/workflows/bmad-orchestrate/`
- `workflow.md` -- entry point with core config loading, role definition, routes to step-01-init
- `templates/orchestration-log.md` -- lightweight free-form log template
- `steps-c/` -- directory for step files (empty, to be populated next)

**Configuration:**
- Workflow name: bmad-orchestrate
- Continuable: No (single-session)
- Document output: Yes (orchestration log, free-form)
- Mode: Create-only

**Next Steps:**
- Step 8: Build step-01-init.md
- Step 9: Build remaining steps (step-02-execute, step-03-wrapup)

## Step 01 Build Complete

**Created:**
- steps-c/step-01-init.md

**Step Configuration:**
- Type: Non-continuable (no step-01b needed)
- Input Discovery: No
- Menu: Custom (Y/S/X) for workflow selection, then auto-proceed
- Next Step: step-02-execute

**Sequence:**
1. Check if user provided specific workflow command
2. If not, invoke bmad-help for recommendation
3. Confirm selection with user (Y/S/X menu)
4. Create orchestration log from template
5. Auto-proceed to step-02-execute

## Step 02 Build Complete

**Created:**
- steps-c/step-02-execute.md

**Step Configuration:**
- Type: Middle (relay loop pattern)
- Menu: None (auto-proceed on completion, error handling inline with R/X)
- Next Step: step-03-wrapup

**Sequence:**
1. Spawn team agent (mode: acceptEdits, command from step-01)
2. Enter relay loop (agent messages -> user, user responses -> agent)
3. Voice mode relay if available
4. Log key exchanges to orchestration log
5. Handle errors (relay, offer R restart / X exit)
6. Auto-proceed to step-03-wrapup on completion

## Step 03 Build Complete

**Created:**
- steps-c/step-03-wrapup.md

**Step Configuration:**
- Type: Final Step (with loop-back option)
- Menu: Custom (R/D) -- run recommended or done
- Next Step: None (final) or loops back to step-01-init

**Sequence:**
1. Finalize orchestration log with status
2. Clean up spawned agent (shutdown request)
3. Invoke bmad-help for next recommendation
4. Present R (run recommended) / D (done) options
5. If R: loop back to step-01-init
6. If D: display summary, exit

## All Workflow Steps Built

**Complete file listing:**
```
_bmad-output/bmb-creations/workflows/bmad-orchestrate/
  workflow.md
  templates/
    orchestration-log.md
  steps-c/
    step-01-init.md
    step-02-execute.md
    step-03-wrapup.md
  workflow-plan-bmad-orchestrate.md (this file)
```
