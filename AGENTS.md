# AGENTS.md

Instructions for AI coding agents working on this project.

## Task Management with td

Run td usage --new-session at conversation start (or after /clear). This tells you what to work on next.

Sessions are automatic (based on terminal/agent context). Optional:
- td session "name" to label the current session
- td session --new to force a new session in the same context

Use td usage -q after first read.

## Issue Tracking with Beads (`bd`)

This project uses **bd (beads)** for persistent issue tracking (bugs, features, tasks with dependencies). Run `bd prime` for workflow context (auto-injected by hooks at session start).

**Quick reference:**
- `bd ready` — find unblocked issues to start on
- `bd create --title="Title" --type=task --priority=2` — create issue (priority 0-4, 0=critical)
- `bd update <id> --status=in_progress` — claim work before coding
- `bd close <id>` — mark complete
- `bd dep add <child> <parent>` — add dependency (parent blocks child)
- `bd sync` — sync with git (run at session end)
- `bd show <id>` — view issue details

**Rules:**
- When discovering bugs or follow-up work, create a beads issue immediately
- Never use `bd edit` (opens $EDITOR, blocks agents)
- Run `bd sync` before ending a session

**td vs bd:** Use `td` for session-level task management (what to work on right now). Use `bd` for persistent issue tracking (bugs, features, tasks that span sessions).

For full workflow: `bd prime`
