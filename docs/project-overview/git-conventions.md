# Git Conventions

**Commit format**: `type(scope): brief description`

| Prefix | Use |
|---|---|
| `feat(epic-N)` | New story implementation |
| `fix(story-N.N)` | Bug fixes for a specific story |
| `test(epic-N)` | QA passes, test additions |
| `docs(epic-N)` | Documentation updates |
| `chore(sprint)` | Sprint tracking, status updates |
| `refactor` | Code restructuring without behavior change |

**Branch strategy**: Feature branches (`feature/epic-N-description`) based off `main`. All epic work stays on its feature branch until PR review.
