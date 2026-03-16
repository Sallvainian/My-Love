# Development Workflow

## Branch Strategy

| Branch Pattern               | Purpose                                     |
| ---------------------------- | ------------------------------------------- |
| `main`                       | Production branch, deployed to GitHub Pages |
| `epic-N/description`         | Feature branches for epic work              |
| `feature/epic-N-description` | Feature branches for epic work (legacy)     |

All epic work stays on its feature branch until PR review. PRs target `main`.

## Step-by-Step Workflow

### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b epic-4/scripture-together
```

### 2. Start the Dev Server

```bash
fnox exec -- npm run dev
```

This decrypts secrets via age and starts Vite with signal-trapped cleanup. The app is available at `http://localhost:5173/`.

If you do not need production secrets (e.g., working on UI-only changes with local Supabase):

```bash
npm run dev:raw
```

### 3. Make Changes

Edit TypeScript, React components, and Tailwind styles in the `src/` directory. Vite provides hot module replacement (HMR) for instant feedback.

### 4. Verify Before Committing

```bash
npm run typecheck      # TypeScript type check (tsc -b --force, all project references)
npm run lint           # ESLint on src/, tests/, scripts/
npm run test:unit      # Run all Vitest unit tests
npm run test:e2e       # Run Playwright E2E tests (requires supabase start)
```

Or run the full CI pipeline locally:

```bash
npm run test:ci-local  # lint + unit + E2E + burn-in (3 iterations)
```

### 5. Commit with Standard Format

```bash
git add src/components/scripture-reading/ReflectionScreen.tsx
git add tests/e2e/scripture/reflection.spec.ts
git commit -m "feat(epic-2): add per-step reflection rating UI"
```

### 6. Push and Create a PR

```bash
git push -u origin epic-4/scripture-together
gh pr create --title "feat(epic-4): add scripture together mode" --body "Implements Story 4.1 ..."
```

PRs trigger the full test pipeline (lint, unit, E2E sharded, burn-in for PRs to main) and automated Claude code review.

## Commit Message Format

```
type(scope): brief description
```

### Prefixes

| Prefix           | Use                                        |
| ---------------- | ------------------------------------------ |
| `feat(epic-N)`   | New story implementation                   |
| `fix(story-N.N)` | Bug fix for a specific story               |
| `test(epic-N)`   | Test additions or QA passes                |
| `docs(epic-N)`   | Documentation updates                      |
| `chore(sprint)`  | Sprint tracking and status updates         |
| `refactor`       | Code restructuring without behavior change |
| `revert`         | Reverting a previous change                |

### Examples

```
feat(epic-2): add per-step reflection rating and notes UI
fix(story-2.1): correct reflection save timing on rapid navigation
test(epic-2): add E2E tests for end-of-session summary flow
docs(epic-2): update story 2.1 acceptance criteria status
chore(sprint): push all pending workspace changes
refactor: extract scripture step navigation into shared hook
refactor(e2e): replace timeout constants with store-poll and RPC helpers
revert(e2e): restore load-bearing waitForScriptureStore calls
```

## Commit Rules

1. **One story per commit.** Do not mix Story 1.2 and Story 1.3 work in the same commit.
2. **Group related changes.** Tests, implementation, and test-id alignment for the same story belong together unless they represent distinct phases (initial implementation vs. fix pass).
3. **Separate docs from code.** Documentation-only changes get their own commit.
4. **Separate sprint tracking.** Status YAML updates get their own commit.
5. **Push by story.** Before pushing, ensure uncommitted changes are committed in story-grouped batches.

## Uncommitted Change Workflow

When uncommitted changes span multiple stories:

1. Identify which files belong to which story
2. Stage and commit each story group separately:

   ```bash
   git add src/components/scripture-reading/ReflectionScreen.tsx tests/e2e/scripture/reflection.spec.ts
   git commit -m "feat(epic-2): add per-step reflection system (Story 2.1)"

   git add src/components/scripture-reading/SessionSummary.tsx tests/e2e/scripture/session-summary.spec.ts
   git commit -m "feat(epic-2): add end-of-session reflection summary (Story 2.2)"
   ```

3. Commit docs and sprint tracking as separate commits:
   ```bash
   git add docs/
   git commit -m "docs(epic-2): update development guide for reflection feature"
   ```
4. Push all at once:
   ```bash
   git push
   ```

## PR Review Process

When a PR is opened or synchronized:

1. **`test.yml`** runs the full test pipeline (lint, unit, DB tests, integration tests, API tests, E2E P0 gate, E2E sharded, burn-in for PRs to main)
2. **`claude-code-review.yml`** runs automated code review with Claude
3. **`supabase-migrations.yml`** runs if any files under `supabase/` are modified
4. Human reviewers are assigned for final approval
5. After approval, merge to `main` triggers automatic deployment
