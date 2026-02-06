# BMM Enhanced: ContextStream Integration

Extension module that adds [ContextStream](https://contextstream.io) MCP tool calls to all 19 BMM workflows + 1 TEA workflow. Provides persistent memory, semantic search, decision tracking, and lesson capture across AI agent sessions.

## Why

BMAD workflows are LLM-interpreted prompts. Without ContextStream, each new session starts from zero — no memory of past decisions, mistakes, or context. This integration lets every workflow search for prior work, check lessons from past mistakes, capture decisions, and update task status in a persistent store.

## Module Type

**Extension Module** (`code: bmme`) — overrides base BMM workflow files with ContextStream-enhanced versions. Lives at `_bmm-enhanced/` outside `_bmad/` to survive installer updates.

> **Note:** TEA workflow files (`tea/workflows/`) are also included. These extend the base TEA module but are packaged here for convenience. During installation, TEA files may need manual placement into `_bmad/tea/workflows/`.

## Structure

```
_bmm-enhanced/
├── module.yaml                        # Extension module config (code: bmm)
├── README.md                          # This file
├── BRIEF.md                           # Original design brief
├── bmm/workflows/                     # 19 ContextStream-integrated BMM workflows
│   ├── 1-analysis/                    # Research, product brief
│   ├── 2-plan-workflows/              # PRD creation
│   ├── 3-solutioning/                 # Architecture, epics & stories
│   ├── 4-implementation/              # Dev, code review, sprint mgmt
│   ├── bmad-quick-flow/               # Quick dev, quick spec
│   ├── document-project/              # Project documentation
│   ├── excalidraw-diagrams/           # Dataflow, diagram, flowchart, wireframe
│   ├── generate-project-context/      # Context generation
│   └── qa/                            # Test automation
└── tea/workflows/                     # 1 TEA workflow (test-review)
    └── testarch/test-review/
        ├── workflow.yaml
        └── steps-c/ (6 step files)
```

## Integration Points

Each workflow uses a mix of these 6 integration points:

| Point | Tool Call | Where |
|-------|-----------|-------|
| **Init** | `mcp__contextstream__init(folder_path, context_hint)` | First step of every workflow |
| **Search** | `mcp__contextstream__search(mode="hybrid", query)` | Replace or supplement file glob discovery |
| **Lessons** | `mcp__contextstream__session(action="get_lessons", query)` | Before risky operations |
| **Capture** | `mcp__contextstream__session(action="capture", event_type="decision")` | At each decision point |
| **Tasks** | `mcp__contextstream__memory(action="update_task", task_status)` | On story start/completion |
| **Save** | `mcp__contextstream__memory(action="create_doc", doc_type="spec")` | Final step for doc output |

## Workflow Integration Depth

### Phase 1 — Core Implementation (heaviest integration)

- **dev-story** — init, search, lessons, capture decisions, capture lessons on failure, update tasks
- **code-review** — init, search AC, graph impact analysis, capture findings, update tasks
- **create-story** — init, search epic context, capture plan + create task
- **sprint-status** — init, list plans/tasks, compare with local YAML
- **sprint-planning** — init, capture plan, create tasks per story

### Phase 2 — Planning (init + search + capture decisions + save docs)

- **create-prd** — workflow.md + step-01-init + step-12-complete
- **create-architecture** — workflow.md + step-01-init + step-04-decisions + step-08-complete
- **create-epics-and-stories** — workflow.md + step-01-validate + step-04-final-validation

### Phase 3 — Test

- **qa/automate** — init, search, lessons

### Phase 4 — Analysis (init + search + capture)

- **research** — workflow.md entry point only
- **create-product-brief** — workflow.md entry point only

### Phase 5 — Utility (init + search + save)

- **quick-dev**, **quick-spec**, **generate-project-context** — workflow.md entry point only
- **document-project** — workflow.yaml + instructions.md

### Phase 6 — Excalidraw Diagrams (init + search, YAML-only)

- **create-dataflow**, **create-diagram**, **create-flowchart**, **create-wireframe**

### TEA — Test Architecture

- **testarch/test-review** — workflow.yaml + 6 step files (context optimization, scoring formula fix)

## Installation

This is an extension module with `code: bmme`. During BMAD installation:

1. BMM base module files are installed first
2. This extension's files override matching base files (same-name = override, new = add)
3. **TEA files** (`tea/workflows/`) need manual copy to `_bmad/tea/workflows/` or a custom installer hook

## Prerequisites

- BMAD framework installed with BMM module
- ContextStream MCP server configured in your IDE/CLI
- ContextStream account (for persistent storage)

## Configuration

Module variables (set during installation):

| Variable | Default | Description |
|----------|---------|-------------|
| `contextstream_auto_init` | `true` | Auto-init ContextStream at workflow start |
| `contextstream_capture_decisions` | `true` | Capture decisions during workflows |
| `contextstream_check_lessons` | `true` | Check past lessons before risky ops |
