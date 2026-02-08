## Git History Management

### Commit Organization

Commits are organized **by story**. Each story gets its own commit(s) with a clear prefix.

**Commit message format:** `type(scope): brief description`

| Prefix | Use |
|--------|-----|
| `feat(epic-N)` | New story implementation |
| `fix(story-N.N)` | Bug fixes for a specific story |
| `test(epic-N)` | QA passes, test additions |
| `docs(epic-N)` | Documentation updates |
| `chore(sprint)` | Sprint tracking, status updates |
| `refactor` | Code restructuring without behavior change |

### Rules

- **One story per commit.** Don't mix Story 1.2 and Story 1.3 work in the same commit.
- **Group related changes.** Tests, implementation, and test-id alignment for the same story belong together unless they represent distinct phases (initial impl vs. fix pass).
- **Separate docs from code.** Documentation-only changes get their own commit.
- **Separate sprint tracking.** Status yaml updates get their own commit.
- **Push by story.** Before pushing, ensure uncommitted changes are committed in story-grouped batches.

### Uncommitted Change Workflow

When uncommitted changes span multiple stories:

1. Identify which files belong to which story
2. Stage and commit each story group separately
3. Commit docs and sprint tracking as separate commits
4. Push all at once

### Branch Strategy

- Feature branches: `feature/epic-N-description`
- Base branch: `main`
- All epic work stays on its feature branch until PR review<!-- BEGIN ContextStream -->
# Workspace: My-Love
# Workspace ID: cd177ea2-0b4c-4c3c-88f6-da8c2e65f623

## ContextStream MCP Tools

### Required Every Message

| Message | What to Call |
|---------|--------------|
| **1st message** | `session_init(folder_path="<cwd>", context_hint="<user_message>")` |
| **2nd+ messages** | `context_smart(user_message="<message>", format="minified", max_tokens=400)` |
| **Search code** | `search(mode="hybrid", query="...")` — BEFORE Glob/Grep/Read |
| **Save decisions** | `session(action="capture", event_type="decision", title="...", content="...")` |

### Search Modes

| Mode | Use Case |
|------|----------|
| `hybrid` | General code search |
| `keyword` | Exact symbol/string |
| `semantic` | Conceptual questions |
| `exhaustive` | Find ALL matches |

### Quick Reference

- Always call `session_init` first with `context_hint` set to user's message
- Call `context_smart` before every response for relevant context
- Use `search` before local file tools (Glob, Grep, Read)
- Capture decisions with `session(action="capture")`
<!-- END ContextStream -->
