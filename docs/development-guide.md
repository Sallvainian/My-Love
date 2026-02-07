# Development Guide

> Development setup, commands, and workflow for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 24.13.0 | Specified in `.nvmrc`, use nvm |
| npm | (bundled with Node) | Package manager (`package-lock.json`) |
| Supabase CLI | 2.65.6+ | For local development and migrations |
| Git | Latest | Version control |

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd My-Love
nvm use          # switches to Node 24.13.0
npm install

# 2. Environment setup
# Get DOTENV_KEY from team member
echo "DOTENV_KEY='your-key'" > .env.keys

# 3. Start development
npm run dev      # Vite dev server with dotenvx encryption

# 4. Open browser
# http://localhost:5173
```

## Environment Variables

Managed via dotenvx (encrypted `.env` committed to git, `.env.keys` gitignored).

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase public/anon key |
| `DOTENV_KEY` | Decryption key for `.env` (stored in `.env.keys`) |

### Setup Options

- **With dotenvx (recommended):** Get `DOTENV_KEY` from team, create `.env.keys`, use `npm run dev`
- **Without dotenvx:** Create `.env.local` with raw values, use `npm run dev:raw`

## NPM Scripts Reference

### Development

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `./scripts/dev-with-cleanup.sh` | Start dev server with encrypted env vars and process cleanup |
| `npm run dev:raw` | `vite` | Raw Vite dev server (no dotenvx) |
| `npm run preview` | `dotenvx run -- npx vite preview` | Preview production build locally |

### Build and Deploy

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run build` | `dotenvx run -- bash -c 'tsc -b && vite build'` | TypeScript compile + Vite bundle |
| `npm run deploy` | `gh-pages -d dist` | Deploy to GitHub Pages |
| `npm run predeploy` | `npm run build && npm run test:smoke` | Pre-deploy: build + smoke tests |

### Testing

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run test:unit` | `vitest run` | Run unit tests once |
| `npm run test:unit:watch` | `vitest` | Unit tests in watch mode |
| `npm run test:unit:ui` | `vitest --ui` | Unit tests with visual dashboard |
| `npm run test:unit:coverage` | `vitest run --coverage` | Unit tests + coverage report (80% threshold) |
| `npm run test:e2e` | `./scripts/test-with-cleanup.sh` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | `playwright test --ui` | E2E tests with interactive UI |
| `npm run test:e2e:debug` | `playwright test --debug` | Debug E2E tests step-by-step |
| `npm run test:smoke` | `node scripts/smoke-tests.cjs` | Quick sanity checks on build |
| `npm run test:burn-in` | `bash scripts/burn-in.sh` | Run tests 10x to detect flakiness |
| `npm run test:ci-local` | `bash scripts/ci-local.sh` | Mirror CI pipeline locally |

### Code Quality

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run typecheck` | `tsc --noEmit` | TypeScript type checking |
| `npm run lint` | `eslint .` | ESLint linting |
| `npm run lint:fix` | `eslint . --fix && prettier --write .` | Auto-fix lint + format |
| `npm run format` | `prettier --write .` | Auto-format all files |
| `npm run format:check` | `prettier --check .` | Check formatting |

## Testing Strategy

### Unit Tests (Vitest)

- **Environment:** happy-dom (lightweight DOM)
- **Location:** `tests/unit/` and co-located `__tests__/` directories
- **Coverage threshold:** 80% on lines, functions, branches, statements
- **TDD enforcement:** tdd-guard-vitest reporter fails if tests added without code changes
- **Run:** `npm run test:unit -- --silent` (minimal output recommended)

### E2E Tests (Playwright)

- **Browser:** Chromium only
- **Location:** `tests/e2e/` organized by feature (`auth/`, `mood/`, `photos/`, etc.)
- **Timeouts:** 60s test, 15s assertion, 30s navigation
- **CI behavior:** 2 retries, screenshots/video/trace on failure
- **Auto-starts:** Dev server via webServer config (`http://localhost:5173`)

### Burn-In Testing

Detect flaky tests by running repeatedly:

```bash
npm run test:burn-in              # 10 iterations, all tests
bash scripts/burn-in.sh 5         # 5 iterations
bash scripts/burn-in.sh 10 auth   # 10 iterations, auth tests only
```

Failures saved to `burn-in-failures/iteration-N/`.

### Local CI Simulation

```bash
npm run test:ci-local                   # Full CI pipeline locally
bash scripts/ci-local.sh --skip-lint    # Skip lint step
bash scripts/ci-local.sh --skip-unit    # Skip unit tests
```

## Code Quality Configuration

### TypeScript

- **Target:** ES2022, strict mode enabled
- **Module resolution:** Bundler (Vite)
- **JSX:** React 19 JSX transform (automatic)
- **Config files:** `tsconfig.json` (root), `tsconfig.app.json` (app), `tsconfig.node.json` (scripts)

### ESLint

- **Format:** Flat config (ESLint 9+)
- **Rules:** No `any` types (error), unused vars (error unless `_` prefixed)
- **Plugins:** typescript-eslint, react-hooks (React 19), react-refresh
- **Relaxed for tests:** Hooks rules and unused vars disabled in test files

### Prettier

- Print width: 100
- Single quotes, trailing commas (ES5)
- Tab width: 2 (spaces)
- Plugin: prettier-plugin-tailwindcss (auto-sorts Tailwind classes)

## Build and Bundle

### Vite Configuration

- **Base path:** `/My-Love/` (production, GitHub Pages) / `/` (development)
- **Manual chunk splitting** for optimal caching:
  - `vendor-react`: react, react-dom
  - `vendor-supabase`: @supabase/supabase-js
  - `vendor-state`: zustand, idb, zod
  - `vendor-animation`: framer-motion
  - `vendor-icons`: lucide-react
- **Bundle analysis:** `dist/stats.html` (rollup-plugin-visualizer)
- **Plugins:** React, TypeScript checker, PWA, bundle visualizer

### PWA Configuration

- **Strategy:** injectManifest (custom service worker at `src/sw.ts`)
- **Precache:** Static assets only (images, fonts)
- **Runtime caching:** Managed in service worker
- **App name:** "My Love - Daily Reminders"
- **Theme color:** #FF6B9D

## Supabase Backend

### Local Development

Requires Supabase CLI installed.

```bash
supabase start           # Start local Supabase instance
supabase db reset        # Apply all migrations
supabase stop            # Stop local instance
```

### Migrations

Located in `supabase/migrations/` (9 SQL files). Applied in order by timestamp.

### Edge Functions

One edge function: `supabase/functions/upload-love-note-image/index.ts`

### Type Generation

```bash
npx supabase gen types typescript --project-id xojempkrugifnaveqtqc > src/types/database.types.ts
```

This runs automatically in the CI deploy pipeline.

## CI/CD Pipelines

### Test Pipeline (`.github/workflows/test.yml`)

Triggers: Push to main/develop, PRs

1. **Lint and Type Check** (5 min) -- ESLint + TypeScript + Prettier
2. **Unit Tests** (10 min) -- Vitest with coverage
3. **E2E Tests** (30 min) -- Playwright sharded (2 shards), Supabase local
4. **Burn-In** (20 min) -- PRs to main only, 5 iterations of changed tests
5. **Report Merge** -- Combines shard results

### Deploy Pipeline (`.github/workflows/deploy.yml`)

Triggers: Push to main, manual

1. Install + generate Supabase types
2. Build with dotenvx
3. Smoke tests
4. Deploy to GitHub Pages
5. Health checks (HTTP 200, response time, JS bundles, PWA manifest, Supabase connection)

### Migration Validation (`.github/workflows/supabase-migrations.yml`)

Triggers: PRs modifying `supabase/` files

1. Start Supabase local
2. Apply migrations
3. RLS policy lint
4. Security lint

### Claude AI Review (`.github/workflows/claude.yml`)

Triggers: @claude mentions in issues/PRs

## Deployment

### Live URL

https://sallvainian.github.io/My-Love/

### Manual Deploy

```bash
npm run deploy    # Builds, smoke tests, deploys to GitHub Pages
```

### Post-Deploy Verification

```bash
node scripts/post-deploy-check.cjs https://sallvainian.github.io/My-Love/
```

## Git Conventions

### Branch Strategy

- Feature branches: `feature/epic-N-description`
- Base branch: `main`

### Commit Messages

Format: `type(scope): brief description`

| Prefix | Use |
|--------|-----|
| `feat(epic-N)` | New story implementation |
| `fix(story-N.N)` | Bug fixes |
| `test(epic-N)` | Test additions |
| `docs(epic-N)` | Documentation |
| `chore(sprint)` | Sprint tracking |
| `refactor` | Code restructuring |

### Rules

- One story per commit
- Group related changes (tests + implementation)
- Separate docs from code commits
- Separate sprint tracking commits

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `dotenvx` errors | Ensure `.env.keys` exists with valid `DOTENV_KEY` |
| Port 5173 in use | Kill existing process: `lsof -ti:5173 \| xargs kill` |
| Supabase connection fails | Check `VITE_SUPABASE_URL` and key in env |
| E2E tests timeout | Increase Playwright timeouts or check dev server |
| Type errors after pull | Run `npm run typecheck` and fix incrementally |
| Stale build cache | Run `node scripts/clear-caches.js` |

### Useful Scripts

```bash
bash scripts/inspect-db.sh          # Inspect database state
node scripts/clear-caches.js        # Clear all build caches
node scripts/validate-messages.cjs  # Validate default messages
```
