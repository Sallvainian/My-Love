# Brief: ContextStream Integration into BMAD Method Workflows

## What Was Built

A custom BMAD module (`_bmm-enhanced/`) that adds ContextStream MCP tool calls to all 19 BMAD workflows + 1 TEA workflow. ContextStream provides persistent memory, semantic search, decision tracking, and lesson capture across AI agent sessions.

Additionally, all planning artifacts (story plans, spec docs, cross-project docs) were uploaded into ContextStream epic projects for retrieval by workflows.

## Why

BMAD workflows are LLM-interpreted prompts. Without ContextStream, each new session starts from zero — no memory of past decisions, mistakes, or context. With this integration, every workflow can search for prior work, check lessons from past mistakes, capture decisions, and update task status in a persistent store.

## Architecture

**BMAD has two workflow patterns:**

1. **YAML + Instructions** (implementation workflows): `workflow.yaml` config + `instructions.xml`/`.md` step-by-step file
2. **Markdown step files** (planning workflows): `workflow.md` overview + separate `step-*.md` per phase

**Integration approach per pattern:**

**Pattern 1 (YAML + Instructions):** Add a declarative `contextstream:` YAML block to `workflow.yaml`, then insert `mcp__contextstream__*` tool call instructions at specific steps in the instructions file.

```yaml
# Added before "standalone: true" in workflow.yaml
contextstream:
  init: true
  context: true
  search_inputs: true
  capture_decisions: true
  check_lessons: true
  update_tasks: true
```

**Pattern 2 (Markdown steps):** Add a `## ContextStream Integration` summary to `workflow.md`, then add tool call sections to init step, decision steps, and final step.

## 6 Integration Points (mix-and-match per workflow)

| Point | Tool Call | Where |
|-------|-----------|-------|
| **Init** | `mcp__contextstream__init(folder_path, context_hint)` | First step of every workflow |
| **Search** | `mcp__contextstream__search(mode="hybrid", query)` | Replace or supplement file glob discovery |
| **Lessons** | `mcp__contextstream__session(action="get_lessons", query)` | Before risky operations |
| **Capture** | `mcp__contextstream__session(action="capture", event_type="decision")` | At each decision point |
| **Tasks** | `mcp__contextstream__memory(action="update_task", task_status)` | On story start/completion |
| **Save** | `mcp__contextstream__memory(action="create_doc", doc_type="spec")` | Final step for doc output |

## All 20 Modified Workflows

### Phase 1 — Core Implementation (heaviest integration)

- `dev-story` — workflow.yaml + instructions.xml (init, search, lessons, capture decisions, capture lessons on failure, update tasks)
- `code-review` — workflow.yaml + instructions.xml (init, search AC, graph impact analysis, capture bug/insight findings, update tasks)
- `create-story` — workflow.yaml + instructions.xml (init, search epic context, capture plan + create task on completion)
- `sprint-status` — workflow.yaml + instructions.md (init, list plans/tasks, compare with local YAML)
- `sprint-planning` — workflow.yaml + instructions.md (init, capture plan, create tasks per story)

### Phase 2 — Planning (init + search + capture decisions + save docs)

- `create-prd` — workflow.md + step-01-init.md + step-12-complete.md
- `create-architecture` — workflow.md + step-01-init.md + step-04-decisions.md + step-08-complete.md
- `create-epics-and-stories` — workflow.md + step-01-validate-prerequisites.md + step-04-final-validation.md

### Phase 3 — Test

- `qa/automate` — workflow.yaml + instructions.md (init, search, lessons)

### Phase 4 — Analysis (init + search + capture)

- `research` — workflow.md
- `create-product-brief` — workflow.md

### Phase 5 — Utility (init + search + save)

- `quick-dev` — workflow.md
- `quick-spec` — workflow.md
- `document-project` — workflow.yaml + instructions.md
- `generate-project-context` — workflow.md

### Phase 6 — Excalidraw Diagrams (init + search, YAML-only)

- `create-dataflow` — workflow.yaml
- `create-diagram` — workflow.yaml
- `create-flowchart` — workflow.yaml
- `create-wireframe` — workflow.yaml

### TEA (test architecture, separate module)

- `testarch/test-review` — workflow.yaml + 5 step files (context optimization, scoring formula fix)

## ContextStream Artifact Uploads

### 4 Epic Projects with story plans

- Epic 1 (`71aa5e2c`): 5 plans (Stories 1.1-1.5, status: completed)
- Epic 2 (`dd54ed1c`): 3 plans (2.1-2.2 completed, 2.3 active)
- Epic 3 (`0dc0b854`): 1 plan (3.1, draft)
- Epic 4 (`69b5e134`): 3 plans (4.1-4.3, draft)

### Spec docs per epic

1 each (full Given/When/Then acceptance criteria)

### Cross-project docs in main project (`45c8b98b`)

- PRD (type: spec)
- Architecture (type: spec)
- Requirements Inventory (type: spec)
- Sprint Status (type: roadmap)

## Custom Module Location

`_bmm-enhanced/` at project root (outside `_bmad/` to survive installer updates):

```
_bmm-enhanced/
  bmm/workflows/     # 33 ContextStream-integrated workflow files
  tea/workflows/     # 6 TEA test review optimized step files
```

## To Recreate

1. Start with a clean BMAD install
2. For each workflow file listed above, add the appropriate ContextStream integration (YAML block for .yaml files, markdown section for .md files, tool call instructions in instruction files)
3. Use the 6 integration points table to determine what each workflow needs
4. Upload story plans via `session(action="capture_plan")` and spec docs via `memory(action="create_doc")` to each epic's ContextStream project
5. Save modified files to `_bmm-enhanced/` as a custom module backup
