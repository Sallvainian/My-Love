# Quinn QA - Automate

**Goal**: Generate automated API and E2E tests for implemented code.

**Scope**: This workflow generates tests ONLY. It does **not** perform code review or story validation (use Code Review `CR` for that).

## ContextStream Integration

Before generating tests:

1. Call `mcp__contextstream__init(folder_path="{project-root}", context_hint="Generating automated tests")`
2. Call `mcp__contextstream__session(action="get_lessons", query="test automation patterns common issues test quality")` — apply lessons
3. Call `mcp__contextstream__search(mode="hybrid", query="test patterns architecture testing standards")` for project test conventions
4. After test generation: Call `mcp__contextstream__session(action="capture", event_type="implementation", title="Tests generated for {{feature}}", content="{{test_count}} tests created", tags=["testing", "qa"])`

## Instructions

### Step 0: Detect Test Framework

Check project for existing test framework:

- Look for `package.json` dependencies (playwright, jest, vitest, cypress, etc.)
- Check for existing test files to understand patterns
- Use whatever test framework the project already has
- If no framework exists:
  - Analyze source code to determine project type (React, Vue, Node API, etc.)
  - Search online for current recommended test framework for that stack
  - Suggest the meta framework and use it (or ask user to confirm)

### Step 1: Identify Features

Ask user what to test:

- Specific feature/component name
- Directory to scan (e.g., `src/components/`)
- Or auto-discover features in the codebase

### Step 2: Generate API Tests (if applicable)

For API endpoints/services, generate tests that:

- Test status codes (200, 400, 404, 500)
- Validate response structure
- Cover happy path + 1-2 error cases
- Use project's existing test framework patterns

### Step 3: Generate E2E Tests (if UI exists)

For UI features, generate tests that:

- Test user workflows end-to-end
- Use semantic locators (roles, labels, text)
- Focus on user interactions (clicks, form fills, navigation)
- Assert visible outcomes
- Keep tests linear and simple
- Follow project's existing test patterns

### Step 4: Run Tests

Execute tests to verify they pass (use project's test command).

If failures occur, fix them immediately.

### Step 5: Create Summary

Output markdown summary:

```markdown
# Test Automation Summary

## Generated Tests

### API Tests
- [x] tests/api/endpoint.spec.ts - Endpoint validation

### E2E Tests
- [x] tests/e2e/feature.spec.ts - User workflow

## Coverage
- API endpoints: 5/10 covered
- UI features: 3/8 covered

## Next Steps
- Run tests in CI
- Add more edge cases as needed
```

## Keep It Simple

**Do:**

- Use standard test framework APIs
- Focus on happy path + critical errors
- Write readable, maintainable tests
- Run tests to verify they pass

**Avoid:**

- Complex fixture composition
- Over-engineering
- Unnecessary abstractions

**For Advanced Features:**

If the project needs:

- Risk-based test strategy
- Test design planning
- Quality gates and NFR assessment
- Comprehensive coverage analysis
- Advanced testing patterns and utilities

→ **Install Test Architect (TEA) module**: <https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/>

## Output

Save summary to: `{implementation_artifacts}/tests/test-summary.md`

**Done!** Tests generated and verified.

## Update ContextStream Plan Task

On workflow completion:

1. **Search for matching task**: Call `mcp__contextstream__memory(action="list_tasks")` and find a task whose title matches this test automation workflow (e.g., the feature name or "Generate Tests")
2. **If matching task found**: Call `mcp__contextstream__memory(action="update_task", task_id="{{task_id}}", task_status="completed")`
3. **If no matching task**: Skip — not all workflow runs correspond to plan tasks
4. **Capture completion**: Call `mcp__contextstream__session(action="capture", event_type="implementation", title="Test automation completed: {{feature}}", content="{{test_count}} tests generated and verified", importance="medium", tags=["qa-automate", "workflow-complete"])`
