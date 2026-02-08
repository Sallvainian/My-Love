# Development Workflow

1. **Create a feature branch** from `main` using the naming convention `feature/epic-N-description`:
   ```bash
   git checkout -b feature/epic-3-dashboard
   ```

2. **Start the dev server**:
   ```bash
   npm run dev
   ```

3. **Make changes** to TypeScript, React components, and Tailwind styles.

4. **Verify your work** before committing:
   ```bash
   npm run typecheck      # TypeScript compilation check
   npm run lint           # ESLint check
   npm run test:unit      # Unit tests
   npm run test:e2e       # E2E tests (requires dev server)
   ```

5. **Commit** with the standard format:
   ```bash
   git commit -m "feat(epic-3): add dashboard overview component"
   ```

6. **Push and create a PR** targeting `main`.

## Commit Message Format

```
type(scope): brief description
```

| Prefix | Use |
|---|---|
| `feat(epic-N)` | New story implementation |
| `fix(story-N.N)` | Bug fix for a specific story |
| `test(epic-N)` | Test additions or QA passes |
| `docs(epic-N)` | Documentation updates |
| `chore(sprint)` | Sprint tracking and status updates |
| `refactor` | Code restructuring without behavior change |

Rules:
- One story per commit. Do not mix work from different stories.
- Group related changes (tests + implementation for the same story) in a single commit.
- Separate documentation-only and sprint-tracking changes into their own commits.

---
