# Deployment

## Live URL

**Production site**: [https://sallvainian.github.io/My-Love/](https://sallvainian.github.io/My-Love/)

## Automatic Deployment

Every push to `main` triggers the `.github/workflows/deploy.yml` pipeline with three sequential jobs:

### Job 1: Build (`ubuntu-latest`)

1. Checkout code
2. Setup Node.js 20 with npm cache
3. `npm ci` (clean install from lock file)
4. Generate TypeScript types from remote Supabase schema:
   ```bash
   npx supabase gen types typescript --project-id xojempkrugifnaveqtqc > src/types/database.types.ts
   ```
5. `npm run build` (dotenvx decrypts `.env` via `DOTENV_PRIVATE_KEY` secret, runs `tsc -b`, then `vite build`)
6. `npm run test:smoke` (validates `dist/` directory structure, `index.html`, manifest, icons, JS bundles, service worker)
7. Upload `dist/` as GitHub Pages artifact

### Job 2: Deploy

Deploys the build artifact to GitHub Pages using `actions/deploy-pages@v4`.

### Job 3: Health Check

Runs after deployment completes:

1. **Wait** 10 seconds for GitHub Pages CDN propagation
2. **HTTP status check** with 3 retry attempts and 10-second delay between retries:
   - Verifies HTTP 200 response from the live site
   - Checks response time against 3-second baseline
   - Verifies JavaScript bundle reference exists in HTML
   - Verifies PWA manifest is accessible (HTTP 200 for `manifest.webmanifest`)
3. **Supabase connection verification**:
   - Creates a Supabase client using decrypted credentials
   - Verifies auth endpoint returns a valid response

### Concurrency

```yaml
concurrency:
  group: 'pages'
  cancel-in-progress: false
```

The deploy workflow uses a `pages` concurrency group. `cancel-in-progress: false` prevents overlapping deployments from canceling each other.

### Permissions

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

## CI/CD Workflows

All workflows are in `.github/workflows/`:

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Deploy | `deploy.yml` | Push to `main`, manual dispatch | Build, smoke test, deploy to GitHub Pages, health check |
| Tests | `test.yml` | Push to `main`/`develop`, PRs, daily 2 AM UTC, manual | Lint, unit, E2E P0 gate, E2E sharded, burn-in, merge reports |
| Supabase Migrations | `supabase-migrations.yml` | PRs touching `supabase/` paths, manual | Migration validation with local Supabase |
| Claude Code | `claude.yml` | `@claude` mentions in issues/PRs | Claude Code AI assistance |
| Claude Code Review | `claude-code-review.yml` | PR opened/synchronized/ready | Automated PR code review with Claude |
| Manual Code Analysis | `manual-code-analysis.yml` | Manual dispatch | On-demand commit summarization or security review |
| CI Failure Auto-Fix | `ci-failure-auto-fix.yml` | Test workflow failure on non-main branches with open PRs | Auto-fix CI failures with Claude Code |

### Test Pipeline Stages

The `test.yml` workflow runs a 5-stage pipeline (see [Testing](./testing.md#ci-test-pipeline) for full details):

1. **Lint and Type Check** (5-min timeout) -- ESLint, `tsc --noEmit`, Prettier check
2. **Unit Tests** (10-min timeout) -- Vitest with coverage
3. **E2E P0 Gate** (15-min timeout) -- P0-tagged Playwright tests with local Supabase
4. **E2E Sharded** (30-min timeout) -- Full E2E suite sharded across 2 workers
5. **Burn-In** (20-min timeout) -- Flaky detection on changed test files (PRs to `main` only)
6. **Merge Reports** -- Combines shard artifacts into unified HTML report

### Dependabot

`.github/dependabot.yml` configures weekly dependency updates on Mondays:

| Ecosystem | Groups |
|---|---|
| npm | `production-dependencies` (minor/patch), `dev-dependencies` (minor/patch) |
| GitHub Actions | All action updates grouped together |

- PR limit: 10 open pull requests maximum
- Labels: `dependencies` + ecosystem-specific (`npm` or `github-actions`)

### CodeQL Security Analysis

`.github/codeql/codeql-config.yml` configures GitHub CodeQL:

- Query suites: `security-extended`, `security-and-quality`
- Excluded queries: `js/xss-through-dom`

## Required GitHub Secrets

| Secret | Description |
|---|---|
| `DOTENV_PRIVATE_KEY` | Decryption key for the encrypted `.env` file (used during build and health check) |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth token for TypeScript type generation from remote schema |
| `CURRENTS_RECORD_KEY` | Currents.dev recording key for Playwright cloud reporting |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows (`claude.yml`, `claude-code-review.yml`) |
| `CLAUDE_PAT` | GitHub personal access token for Claude bot commits and PR operations |

## Manual Deployment

```bash
npm run deploy
```

This executes three steps automatically via npm lifecycle scripts:

1. **`predeploy`**: `npm run build && npm run test:smoke` -- Build and validate
2. **`deploy`**: `gh-pages -d dist` -- Publish `dist/` to GitHub Pages via the `gh-pages` package
3. **`postdeploy`**: Prints post-deployment instructions

## Post-Deploy Verification

```bash
node scripts/post-deploy-check.cjs https://sallvainian.github.io/My-Love/
```

Informational checks (does not block deployment):

1. HTTP 200 response from the live site
2. Viewport meta tag and manifest link in HTML
3. PWA manifest structure validation (name, short_name, icons, display, theme_color)
4. Service worker registration guidance (manual verification in DevTools)
5. Pre-configured data visibility guidance (manual verification)

## GitHub Pages Configuration

1. Navigate to Repository **Settings > Pages**
2. Under **Source**, select "GitHub Actions"
3. Save

The deploy workflow handles artifact upload and deployment via `actions/upload-pages-artifact@v4` and `actions/deploy-pages@v4`.

## Deployment Timeline

Typical time from push to live: approximately 2-3 minutes.
