# Git Conventions

## Commit Message Format

```
type(scope): brief description
```

### Prefixes

| Prefix | Use |
|---|---|
| `feat(epic-N)` | New story implementation |
| `fix(story-N.N)` | Bug fixes for a specific story |
| `test(epic-N)` | QA passes, test additions |
| `docs(epic-N)` | Documentation updates |
| `chore(sprint)` | Sprint tracking, status updates |
| `refactor` | Code restructuring without behavior change |

### Commit Rules

- **One story per commit.** Do not mix Story 1.2 and Story 1.3 work in the same commit.
- **Group related changes.** Tests, implementation, and test-id alignment for the same story belong together unless they represent distinct phases (initial implementation vs. fix pass).
- **Separate docs from code.** Documentation-only changes get their own commit.
- **Separate sprint tracking.** Status YAML updates get their own commit.
- **Push by story.** Before pushing, ensure uncommitted changes are committed in story-grouped batches.

### Uncommitted Change Workflow

When uncommitted changes span multiple stories:

1. Identify which files belong to which story
2. Stage and commit each story group separately
3. Commit docs and sprint tracking as separate commits
4. Push all at once

## Branch Strategy

| Branch Pattern | Purpose |
|---|---|
| `main` | Production branch, deployed to GitHub Pages |
| `feature/epic-N-description` | Feature branches for epic work |

All epic work stays on its feature branch until PR review. PRs target `main`.

## Automated Dependency Updates (Dependabot)

Dependabot runs weekly on Mondays and creates grouped PRs:

| Ecosystem | Groups |
|---|---|
| npm | `production-dependencies` (minor/patch), `dev-dependencies` (minor/patch) |
| GitHub Actions | All action updates grouped together |

- **Commit prefix**: `deps` for npm packages, `ci` for GitHub Actions
- **PR limit**: 10 open pull requests maximum
- **Labels**: `dependencies` + ecosystem-specific (`npm` or `github-actions`)

## CI Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `deploy.yml` | Push to `main`, manual | Build, smoke test, deploy to GitHub Pages, health check |
| `test.yml` | Push to `main`/`develop`, PRs, daily at 2 AM UTC, manual | Lint, unit tests, sharded E2E, burn-in, merge reports |
| `supabase-migrations.yml` | PRs touching `supabase/` paths, manual | Migration validation with local Supabase |
| `claude.yml` | `@claude` mentions in issues/PRs | Claude Code AI assistance |
| `claude-code-review.yml` | PR opened/synchronized/ready | Automated PR code review with Claude |
| `manual-code-analysis.yml` | Manual dispatch | On-demand commit summarization or security review |
| `ci-failure-auto-fix.yml` | Test workflow failure on non-main branches with open PRs | Auto-fix CI failures with Claude Code |
