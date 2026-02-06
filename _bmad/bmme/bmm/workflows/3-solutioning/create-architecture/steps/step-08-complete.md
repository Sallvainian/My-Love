# Step 8: Architecture Completion & Handoff

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input

- 📖 CRITICAL: ALWAYS read the complete step file before taking any action - partial understanding leads to incomplete decisions
- ✅ ALWAYS treat this as collaborative completion between architectural peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on successful workflow completion and implementation handoff
- 🎯 PROVIDE clear next steps for implementation phase
- ⚠️ ABSOLUTELY NO TIME ESTIMATES - AI development speed has fundamentally changed
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- 🎯 Present completion summary and implementation guidance
- 📖 Update frontmatter with final workflow state
- 🚫 THIS IS THE FINAL STEP IN THIS WORKFLOW

## YOUR TASK:

Complete the architecture workflow, provide a comprehensive completion summary, and guide the user to the next phase of their project development.

## COMPLETION SEQUENCE:

### 1. Congratulate the User on Completion

Both you and the User completed something amazing here - give a summary of what you achieved together and really congratulate the user on a job well done.

### 2. Update the created document's frontmatter

```yaml
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '{{current_date}}'
```

### 3. Next Steps Guidance

Architecture complete. Read fully and follow: `_bmad/core/tasks/bmad-help.md` with argument `Create Architecture`.

Upon Completion of task output: offer to answer any questions about the Architecture Document.


## SUCCESS METRICS:

✅ Complete architecture document delivered with all sections
✅ All architectural decisions documented and validated
✅ Implementation patterns and consistency rules finalized
✅ Project structure complete with all files and directories
✅ User provided with clear next steps and implementation guidance
✅ Workflow status properly updated
✅ User collaboration maintained throughout completion process

## FAILURE MODES:

❌ Not providing clear implementation guidance
❌ Missing final validation of document completeness
❌ Not updating workflow status appropriately
❌ Failing to celebrate the successful completion
❌ Not providing specific next steps for the user
❌ Rushing completion without proper summary

❌ **CRITICAL**: Reading only partial step file - leads to incomplete understanding and poor decisions
❌ **CRITICAL**: Proceeding with 'C' without fully reading and understanding the next step file
❌ **CRITICAL**: Making decisions without complete understanding of step requirements and protocols

### Save Architecture to ContextStream

After architecture document is finalized:

1. **Save as document**: Call `mcp__contextstream__memory(action="create_doc", title="Architecture: {{project_name}}", doc_type="spec", content="{{architecture_content}}")` to persist in ContextStream
2. **Capture completion**: Call `mcp__contextstream__session(action="capture", event_type="decision", title="Architecture completed for {{project_name}}", content="Architecture document created with {{decision_count}} critical decisions", importance="high", tags=["architecture", "planning"])`

### Update ContextStream Plan Task

On workflow completion:

1. **Search for matching task**: Call `mcp__contextstream__memory(action="list_tasks")` and find a task whose title matches this architecture workflow (e.g., the project name or "Create Architecture")
2. **If matching task found**: Call `mcp__contextstream__memory(action="update_task", task_id="{{task_id}}", task_status="completed")`
3. **If no matching task**: Skip — not all workflow runs correspond to plan tasks
4. **Capture completion**: Call `mcp__contextstream__session(action="capture", event_type="implementation", title="Architecture workflow completed: {{project_name}}", content="Architecture document finalized with all critical decisions", importance="medium", tags=["create-architecture", "workflow-complete"])`

## WORKFLOW COMPLETE:

This is the final step of the Architecture workflow. The user now has a complete, validated architecture document ready for AI agent implementation.

The architecture will serve as the single source of truth for all technical decisions, ensuring consistent implementation across the entire project development lifecycle.
