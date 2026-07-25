# Deployment

## Live URL

**Production site**: [https://sallvainian.github.io/My-Love/](https://sallvainian.github.io/My-Love/)

## Automatic Deployment

Every push to `main` triggers the `.github/workflows/deploy.yml` pipeline with three sequential jobs:

### Job 1: Build (`ubuntu-latest`)

1. Checkout code
2. Setup Node.js (reads version from `.node-version`) with npm cache
3. `npm ci` (clean install from lock file)
4. Generate TypeScript types from remote Supabase schema:
   ```bash
   npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID \
     | grep -v '^Connecting to' \
     > src/types/database.types.ts
   ```
5. `npm run build` with GitHub Secrets injected as environment variables (Supabase URL, anon key, Sentry credentials)
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
   - Creates a Supabase client using GitHub Secrets credentials
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

### Core Pipelines

| Workflow            | File                      | Trigger                                             | Purpose                                                             |
| ------------------- | ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Deploy              | `deploy.yml`              | Push to `main`, manual dispatch                     | Build, smoke test, deploy to GitHub Pages, health check             |
| Tests               | `test.yml`                | Push to `main`, PRs, weekly Sunday 2 AM UTC, manual | Lint, unit, DB, integration, API, E2E P0 gate, E2E sharded, burn-in |
| Supabase Migrations | `supabase-migrations.yml` | PRs touching `supabase/` paths, manual              | Migration validation with local Supabase, RLS policy linting        |

### AI-Powered Workflows (Claude)

| Workflow             | File                       | Trigger                                                    | Purpose                                                       |
| -------------------- | -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Claude Code          | `claude.yml`               | `@claude` mentions in issues/PRs/reviews                   | Claude Code AI assistance (model: claude-opus-5)              |
| Claude Code Review   | `claude-code-review.yml`   | PR opened/synchronized/ready (non-draft)                   | Automated PR code review with Claude `/review` skill          |

### Security and Quality

| Workflow          | File                    | Trigger                                    | Purpose                                                       |
| ----------------- | ----------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Bundle Size       | `bundle-size.yml`       | PRs to main/develop                        | Brotli-compressed bundle size tracking with regression alerts |
| Lighthouse        | `lighthouse.yml`        | After Deploy workflow succeeds, manual     | Lighthouse PWA audit (2 runs, public storage)                 |
| CodeQL            | `codeql.yml`            | Push to main, PRs, weekly Monday 10 AM UTC | JavaScript/TypeScript security analysis                       |
| Dependency Review | `dependency-review.yml` | PRs to main/develop                        | Dependency vulnerability scanning (fails on moderate+)        |

### Composite Actions

| Action               | Path                                    | Purpose                                                                  |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Setup Supabase       | `.github/actions/setup-supabase/`       | Install CLI (v2.72.7), start local, apply migrations, export credentials |
| Setup Playwright E2E | `.github/actions/setup-playwright-e2e/` | Install deps, Playwright browsers, setup Supabase for E2E tests          |

### Test Pipeline Stages

The `test.yml` workflow runs an 8-stage pipeline (see [Testing](./testing.md#ci-test-pipeline) for full details):

1. **Lint and Type Check** (5-min timeout)
2. **Unit Tests** (10-min timeout)
3. **Database Tests** (10-min timeout)
4. **Integration Tests** (15-min timeout)
5. **API Tests** (15-min timeout)
6. **E2E P0 Gate** (15-min timeout) -- P0-tagged Playwright tests with local Supabase
7. **E2E Sharded** (30-min timeout) -- Full E2E suite sharded across 2 workers
8. **Burn-In** (30-min timeout) -- Flaky detection on changed test files (PRs to `main` only)
9. **Merge Reports** -- Combines shard artifacts into unified HTML report
10. **Test Summary** -- Branch protection target, evaluates all stages

## Required GitHub Secrets

| Secret                    | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Supabase project URL for production builds                            |
| `VITE_SUPABASE_ANON_KEY`  | Supabase anon key (mapped to `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) |
| `VITE_SENTRY_DSN`         | Sentry DSN for error tracking                                         |
| `SENTRY_AUTH_TOKEN`       | Sentry auth token for source map uploads                              |
| `SENTRY_ORG`              | Sentry organization slug                                              |
| `SENTRY_PROJECT`          | Sentry project slug                                                   |
| `SUPABASE_ACCESS_TOKEN`   | Supabase CLI auth token for TypeScript type generation                |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows                      |

### Required GitHub Variables

| Variable              | Description                                       |
| --------------------- | ------------------------------------------------- |
| `SUPABASE_PROJECT_ID` | Supabase project ID for type generation in deploy |

## Manual Deployment

```bash
npm run deploy
```

This executes three steps automatically via npm lifecycle scripts:

1. **`predeploy`**: `npm run build && npm run test:smoke` -- Build and validate
2. **`deploy`**: `gh-pages -d dist` -- Publish `dist/` to GitHub Pages via the `gh-pages` package
3. **`postdeploy`**: Prints post-deployment instructions

For manual deployment with secrets:

```bash
fnox exec -- npm run deploy
```

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
