# Deployment

## Live URL

**Production site**: [https://sallvainian.github.io/My-Love/](https://sallvainian.github.io/My-Love/)

## Automatic Deployment

Every push to `main` triggers the `.github/workflows/deploy.yml` pipeline with three sequential jobs:

### Job 1: Build (`ubuntu-latest`)

1. Checkout code
2. Setup Node.js (version from `.mise.toml`) with npm cache
3. `npm ci` (clean install from lock file)
4. Generate TypeScript types from remote Supabase schema:
   ```bash
   npx supabase gen types typescript --project-id xojempkrugifnaveqtqc > src/types/database.types.ts
   ```
5. `npm run build` with Supabase and Sentry secrets injected via GitHub Secrets environment variables (runs `tsc -b && vite build`)
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

| Workflow             | File                       | Trigger                                                       | Purpose                                                               |
| -------------------- | -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Deploy               | `deploy.yml`               | Push to `main`, manual dispatch                               | Build, smoke test, deploy to GitHub Pages, health check               |
| Tests                | `test.yml`                 | Push to `main`, PRs, weekly Sunday 2 AM UTC, manual           | Lint, unit, db, E2E (P0 gate + sharded), Lighthouse CI, burn-in      |
| Supabase Migrations  | `supabase-migrations.yml`  | PRs touching `supabase/` paths, manual                        | Migration validation with local Supabase                              |
| Claude Code          | `claude.yml`               | `@claude` mentions in issues/PRs                              | Claude Code AI assistance                                             |
| Claude Code Review   | `claude-code-review.yml`   | PR opened/synchronized/ready                                  | Automated PR code review with Claude                                  |
| Manual Code Analysis | `manual-code-analysis.yml` | Manual dispatch                                               | On-demand commit summarization or security review                     |
| CI Failure Auto-Fix  | `ci-failure-auto-fix.yml`  | Test workflow failure on non-main branches with open PRs      | Auto-fix CI failures with Claude Code                                 |
| Bundle Size          | `bundle-size.yml`          | PRs to `main`/`develop`                                       | Brotli-compressed bundle size comparison                              |
| CodeQL               | `codeql.yml`               | Push to `main`, PRs to `main`/`develop`, weekly Monday 10 AM  | CodeQL security analysis (javascript-typescript)                      |
| Dependency Review    | `dependency-review.yml`    | PRs to `main`/`develop`                                       | Dependency vulnerability review (fail on moderate+ severity)          |
| Lighthouse           | `lighthouse.yml`           | After deploy workflow completes, manual                       | Lighthouse PWA audit against live site (2 runs)                       |

### Test Pipeline Stages

The `test.yml` workflow runs a multi-stage pipeline (see [Testing](./testing.md#ci-test-pipeline) for full details):

1. **Lint and Type Check** (5-min timeout) -- ESLint, `tsc --noEmit`, Prettier check, security audit
2. **Unit Tests** (10-min timeout) -- Vitest with coverage
3. **Database Tests** (10-min timeout) -- pgTAP tests via local Supabase
4. **E2E P0 Gate** (15-min timeout) -- P0-tagged Playwright tests with local Supabase
5. **E2E Sharded** (30-min timeout) -- Full E2E suite sharded across 2 workers
6. **Lighthouse CI** (10-min timeout) -- Performance/PWA audit (non-blocking)
7. **Burn-In** (30-min timeout) -- Flaky detection on changed test files (PRs to `main` only)
8. **Merge Reports** -- Combines shard artifacts into unified HTML report
9. **Test Summary** -- Branch protection gate (fails if lint, unit, db, or E2E failed)

### Dependabot

`.github/dependabot.yml` configures weekly dependency updates on Mondays:

| Ecosystem      | Groups                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| npm            | `production-dependencies` (minor/patch), `dev-dependencies` (minor/patch) |
| GitHub Actions | All action updates grouped together                                       |

- PR limit: 10 open pull requests maximum
- Labels: `dependencies` + ecosystem-specific (`npm` or `github-actions`)

### CodeQL Security Analysis

`.github/codeql/codeql-config.yml` configures GitHub CodeQL:

- Query suites: `security-extended`, `security-and-quality`
- Excluded queries: `js/xss-through-dom`

## Required GitHub Secrets

| Secret                                    | Description                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                       | Supabase project URL for production builds                                                |
| `VITE_SUPABASE_ANON_KEY`                  | Supabase anon/public key for production builds                                            |
| `VITE_SENTRY_DSN`                         | Sentry DSN for error tracking in production                                               |
| `SENTRY_AUTH_TOKEN`                       | Sentry auth token for source map uploads during build                                     |
| `SENTRY_ORG`                              | Sentry organization slug                                                                  |
| `SENTRY_PROJECT`                          | Sentry project slug                                                                       |
| `SUPABASE_ACCESS_TOKEN`                   | Supabase CLI auth token for TypeScript type generation from remote schema                 |
| `CLAUDE_CODE_OAUTH_TOKEN`                 | Claude Code OAuth token for AI-powered workflows (`claude.yml`, `claude-code-review.yml`) |
| `CLAUDE_PAT`                              | GitHub personal access token for Claude bot commits and PR operations                     |

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
