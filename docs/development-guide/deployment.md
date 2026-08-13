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
5. `npm run build` with GitHub Secrets injected as environment variables (Supabase URL, anon key)
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
| Tests               | `test.yml`                | Push to `main`, PRs, weekly Sunday 2 AM UTC, manual | Change detection, lint, unit, DB, backend (integration + API), E2E sharded, burn-in |
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
| CodeQL            | `codeql.yml`            | Push to main, PRs, weekly Monday 10 AM UTC | Security analysis (javascript-typescript, actions, python)    |
| Dependency Review | `dependency-review.yml` | PRs to main/develop                        | Dependency vulnerability scanning (fails on moderate+)        |

### Composite Actions

| Action               | Path                                    | Purpose                                                                  |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Setup Supabase       | `.github/actions/setup-supabase/`       | Install CLI (default v2.77.1), start local, apply migrations, export credentials |
| Setup Playwright E2E | `.github/actions/setup-playwright-e2e/` | Install deps, Playwright browsers, setup Supabase for E2E tests          |

### Test Pipeline Stages

The `test.yml` workflow runs 9 jobs (see [Testing](./testing.md#ci-test-pipeline) for full details):

| Stage | Job             | Timeout | Notes                                                                       |
| ----- | --------------- | ------- | --------------------------------------------------------------------------- |
| 0     | `changes`       | 5 min   | Change detection -- docs-only PRs skip every app stage below                 |
| 1     | `lint`          | 5 min   | Lint + type check                                                            |
| 2     | `unit-tests`    | 10 min  | Vitest                                                                       |
| 3     | `db-tests`      | 10 min  | pgTAP via `supabase test db`                                                 |
| 4     | `backend-tests` | 15 min  | Matrix over the `integration` and `api` Playwright projects (no browser)     |
| 5     | `e2e-tests`     | 30 min  | Full E2E suite, **4 shards**, chromium only, 2 Playwright workers per shard  |
| 6     | `burn-in`       | 30 min  | Flaky detection on changed specs (PRs to `main`; weekly full run on Sundays) |
| 7     | `merge-reports` | --      | Combines shard artifacts into a unified HTML report                          |
| 8     | `test-summary`  | --      | Branch-protection target; evaluates all stages, runs with `if: always()`     |

Two structural changes since the 2026-03 scan:

- **The E2E P0 gate job was removed.** It previously ran `--grep "[P0]"` ahead of the shards, with `e2e-tests` gated on it via `needs`; the shards now start immediately.
- **Shards went from 2 to 4.** At 2 shards the split was duration-skewed (equal test counts but 5.4 min vs 9.6 min); with a fixed ~2.5 min per-shard provisioning floor, 4 is the better trade. `burn-in` no longer `needs` the shards either, since it re-runs specs from scratch and consumed nothing they produced.

## Required GitHub Secrets

| Secret                    | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Supabase project URL for production builds                            |
| `VITE_SUPABASE_ANON_KEY`  | Supabase anon key (mapped to `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) |
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
