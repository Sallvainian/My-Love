# Development Guide

This guide covers everything needed to set up, develop, test, and deploy the My Love PWA.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | v24.13.0 (pinned in `.nvmrc`; minimum v18 required) |
| npm | Package manager (lock file: `package-lock.json`) |
| Git | Version control |
| Supabase account | Required for backend features (auth, database, realtime, storage) |

If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project root to switch to the correct Node version automatically.

---

## Installation

```bash
git clone https://github.com/Sallvainian/My-Love.git
cd My-Love
npm install
```

After installing dependencies, install the Playwright browsers if you plan to run E2E tests:

```bash
npx playwright install
```

---

## Environment Setup

The project uses [dotenvx](https://dotenvx.com/) for encrypted environment variables. This keeps secrets safe in version control while still allowing automated builds.

### Environment Files

| File | Purpose | In Git? |
|---|---|---|
| `.env` | Encrypted environment variables | Yes (safe to commit) |
| `.env.keys` | Decryption key for `.env` | No (gitignored) |
| `.env.example` | Template showing required variables | Yes |
| `.env.local` | Local overrides | No (gitignored) |

### Getting Started with Environment Variables

1. Obtain the `.env.keys` file from a team member (or generate your own if starting fresh).
2. Place it in the project root.
3. dotenvx will automatically decrypt `.env` at build time and when running the dev server.

### Required Variables

| Variable | Description | Where to Find |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://[project-id].supabase.co`) | Supabase Dashboard > Project Settings > API |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anonymous/public key | Supabase Dashboard > Project Settings > API > anon/public key |

### Modifying Encrypted Variables

```bash
# Decrypt, edit, and re-encrypt
npx dotenvx decrypt    # Decrypts .env in place
# ... make your changes ...
npx dotenvx encrypt    # Re-encrypts .env
```

---

## Configuration Customization

Edit `src/config/constants.ts` to personalize the app:

```typescript
export const APP_CONFIG = {
  defaultPartnerName: 'Gracie',       // Your partner's name
  defaultStartDate: '2025-10-18',     // Relationship start date (YYYY-MM-DD)
  isPreConfigured: true,
} as const;
```

- `defaultPartnerName` -- Displayed throughout the app as your partner's name.
- `defaultStartDate` -- Used for the anniversary countdown and duration counter.

---

## Available Scripts

### Development

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with cleanup script |
| `npm run dev:raw` | Start Vite dev server directly (no cleanup) |
| `npm run preview` | Preview the production build locally |

### Build

| Script | Description |
|---|---|
| `npm run build` | Full production build (dotenvx decrypt + tsc + vite build) |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |

### Code Quality

| Script | Description |
|---|---|
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues and run Prettier |
| `npm run format` | Run Prettier formatting |
| `npm run format:check` | Check formatting without making changes |

### Testing

| Script | Description |
|---|---|
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:unit:watch` | Run Vitest in watch mode |
| `npm run test:unit:ui` | Run Vitest with browser UI |
| `npm run test:unit:coverage` | Run unit tests with V8 coverage report |
| `npm run test:smoke` | Run smoke tests against built output |
| `npm run test:e2e` | Run Playwright E2E tests (with cleanup) |
| `npm run test:e2e:raw` | Run Playwright directly |
| `npm run test:e2e:ui` | Run Playwright with interactive UI |
| `npm run test:e2e:debug` | Debug Playwright tests step-by-step |
| `npm run test:burn-in` | Extended test automation (repeated runs) |
| `npm run test:ci-local` | Simulate the CI pipeline locally |

### Deployment

| Script | Description |
|---|---|
| `npm run deploy` | Manual deploy to GitHub Pages (builds + smoke tests first) |

---

## Local Development URL

```
http://localhost:5173/My-Love/
```

In production, the base path is `/My-Love/` to match the GitHub Pages deployment. In development mode, Vite uses `/` as the base path, so the actual URL is:

```
http://localhost:5173/
```

---

## Development Workflow

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

### Commit Message Format

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

## Build Process

Running `npm run build` executes three stages:

1. **dotenvx decryption** -- Decrypts `.env` variables so Vite can inline them at build time.
2. **TypeScript compilation** -- `tsc -b` type-checks and compiles the project.
3. **Vite build** -- Produces the production bundle with:
   - Manual chunk splitting (react, supabase, zustand/idb/zod, framer-motion, lucide-react)
   - PWA manifest generation
   - Service worker compilation via `injectManifest` strategy
   - Bundle size analysis output at `dist/stats.html`

The production output is written to `dist/`.

---

## Project Structure

```
src/
  api/                  Supabase client and API service layer
  assets/               Static assets (SVGs, images)
  components/           React components organized by feature
  config/               App configuration (constants.ts)
  constants/            Additional constant values
  data/                 Default messages and scripture step data
  hooks/                Custom React hooks
  services/             Business logic and data access services
  stores/               Zustand store and slices
    slices/             Domain-specific state slices:
      appSlice.ts           App-level state (loading, errors)
      navigationSlice.ts    Navigation and routing
      messagesSlice.ts      Daily love messages
      moodSlice.ts          Mood tracking
      interactionsSlice.ts  Partner interactions (pokes, kisses)
      photosSlice.ts        Photo gallery
      notesSlice.ts         Love notes chat
      partnerSlice.ts       Partner data and status
      settingsSlice.ts      User settings and preferences
      scriptureReadingSlice.ts  Scripture reading sessions
  sw.ts                 Service worker (injectManifest)
  types/                TypeScript type definitions
  utils/                Utility functions
  validation/           Zod schemas for runtime validation
tests/
  unit/                 Vitest unit tests
  e2e/                  Playwright E2E tests
  api/                  API-level Playwright tests
  support/              Shared test helpers, fixtures, and factories
supabase/
  migrations/           SQL migration files
scripts/                Build, deploy, and utility scripts
.github/
  workflows/            CI/CD workflow definitions
docs/                   Project documentation
```

---

## Testing

### Unit Tests (Vitest)

Unit tests use the [happy-dom](https://github.com/nicedayfor/happy-dom) environment and are located in `tests/unit/` and `src/**/*.test.{ts,tsx}`.

```bash
npm run test:unit              # Single run
npm run test:unit:watch        # Watch mode
npm run test:unit:coverage     # With V8 coverage report
```

**Coverage thresholds** (all at 80%): lines, functions, branches, statements.

**TDD enforcement**: The `tdd-guard-vitest` plugin is configured as a Vitest reporter to enforce test-first development practices.

**Path aliases**: Tests can use `@/` to reference `src/` (configured in `vitest.config.ts`).

### E2E Tests (Playwright)

E2E tests run against the actual application with a real Supabase backend. Tests are in `tests/e2e/`.

```bash
npm run test:e2e               # Full run with cleanup
npm run test:e2e:ui            # Interactive UI mode
npm run test:e2e:debug         # Step-through debugging
```

**Configuration highlights** (from `playwright.config.ts`):
- Default browser: Chromium
- Timeouts: 60s test, 15s assertion, 15s action, 30s navigation
- Traces, screenshots, and video captured on failure
- Dev server auto-started via `dotenvx run -- npx vite`
- Reports: HTML (`playwright-report/`), JUnit (`test-results/junit.xml`), and list

**Merged fixtures**: Tests use composed fixtures from `tests/support/merged-fixtures.ts` for authentication and page setup.

### ATDD (Acceptance Test-Driven Development)

For Epic 2 and beyond, acceptance tests are written before implementation. Each story's acceptance criteria maps to specific E2E test cases.

---

## Code Style

### TypeScript

- **Strict mode** enabled with `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- **No `any` types** -- `@typescript-eslint/no-explicit-any` is set to `error`. Use `unknown` or specific types instead.
- **Target**: ES2022.

### ESLint

ESLint 9 flat config with:
- `eslint-plugin-react-hooks` for hook rule enforcement
- `eslint-plugin-react-refresh` for HMR compatibility
- `typescript-eslint` recommended rules
- Unused variables allowed if prefixed with `_`

### Prettier

Prettier 3.8 with the `prettier-plugin-tailwindcss` plugin for automatic Tailwind class sorting.

### Conventions

- **Self-documenting code** -- Use descriptive names; minimize comments.
- **Import order** -- Node built-ins, external packages, internal modules, relative imports.
- **State management** -- Zustand with one slice per domain area (10 slices total).
- **Validation** -- Zod schemas for all runtime data validation.

---

## Database Migrations

Supabase SQL migrations live in `supabase/migrations/`. Each migration file is timestamped and describes its purpose.

### Applying Migrations

```bash
# Push migrations to your Supabase project
npx supabase db push
```

### Generating TypeScript Types

After schema changes, regenerate the TypeScript types:

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  > src/types/database.types.ts
```

This step runs automatically during CI deployment.

---

## Deployment

### Automatic Deployment

Pushing to `main` triggers the GitHub Actions deployment pipeline:

1. **Build** -- Install dependencies, generate Supabase types, build the app.
2. **Smoke Tests** -- Verify the built output.
3. **Deploy** -- Upload to GitHub Pages.
4. **Health Check** -- Verify HTTP status, response time, critical assets (JS bundle, PWA manifest), and Supabase connectivity.

**Live URL**: [https://sallvainian.github.io/My-Love/](https://sallvainian.github.io/My-Love/)

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `DOTENV_PRIVATE_KEY` | Decryption key for encrypted `.env` variables |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth for TypeScript type generation |

### Manual Deployment

```bash
npm run deploy
```

This runs the build, smoke tests, and deploys to GitHub Pages via `gh-pages`.

---

## Troubleshooting

### "Loading..." Screen That Never Resolves

**Cause**: Missing or incorrect configuration in `src/config/constants.ts`, or stale IndexedDB data.

**Fix**:
1. Verify `defaultPartnerName` and `defaultStartDate` are set correctly in `src/config/constants.ts`.
2. Clear IndexedDB: DevTools > Application > IndexedDB > delete the database.
3. Hard refresh the page.

### Console Configuration Errors

**Cause**: Invalid values in `constants.ts`.

**Fix**: Ensure `defaultPartnerName` is a non-empty string and `defaultStartDate` is a valid `YYYY-MM-DD` date.

### ConstraintError in Console

**Cause**: IndexedDB schema conflict from a previous version.

**Fix**: Clear IndexedDB via DevTools > Application > IndexedDB, then reload.

### Dev Server Will Not Start

**Cause**: Wrong Node version or corrupted dependencies.

**Fix**:
```bash
nvm use                  # Switch to the correct Node version
rm -rf node_modules
npm install
npm run dev
```

### Build Fails

**Cause**: Type errors, missing dependencies, or environment variable issues.

**Fix**:
```bash
npm run typecheck        # Identify TypeScript errors
npm run lint             # Identify lint errors
npm install              # Ensure all dependencies are installed
```

If the build fails on dotenvx decryption, verify that `.env.keys` exists in the project root.

### PWA Not Installing

**Cause**: PWA installation requires HTTPS and a valid manifest.

**Fix**: The PWA installs correctly on GitHub Pages (HTTPS). For local development, PWA features are disabled (`devOptions.enabled: false` in `vite.config.ts`).

### Realtime Updates Not Working

**Cause**: Supabase Realtime is not enabled on the relevant tables.

**Fix**: In the Supabase Dashboard, navigate to Database > Replication and enable Realtime on the tables that need it (mood entries, love notes, interactions).

### E2E Tests Failing Locally

**Cause**: Missing Playwright browsers, Supabase not running, or environment variables not set.

**Fix**:
```bash
npx playwright install           # Install browsers
npx supabase start               # Start local Supabase (if using local)
npm run test:e2e                 # Run with cleanup script
```

The Playwright config automatically reads Supabase connection details from `supabase status` when running locally.
