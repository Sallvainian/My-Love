# Development Quick Start

## Prerequisites

- **Node.js v24.13.0** (pinned in `.nvmrc` -- run `nvm use` to switch)
- **npm** (package manager)
- **Supabase CLI** (for E2E tests and database work: `npm install -g supabase`)
- **Playwright browsers** (for E2E tests: `npx playwright install`)

## Install and Run

```bash
git clone https://github.com/Sallvainian/My-Love.git
cd My-Love
nvm use
npm install
npm run dev
```

The dev server runs at `http://localhost:5173/` (development uses `/` base path; production uses `/My-Love/`).

## Core Commands

### Development

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with dotenvx decryption and process cleanup |
| `npm run dev:raw` | Start Vite dev server directly (no env decryption) |
| `npm run preview` | Preview production build (dotenvx decrypts `.env`) |
| `npm run build` | Production build: `dotenvx run --overload -- bash -c 'tsc -b && vite build'` |
| `npm run typecheck` | TypeScript type check: `tsc --noEmit` |

### Code Quality

| Command | Description |
|---|---|
| `npm run lint` | ESLint on `src`, `tests`, `scripts` directories |
| `npm run lint:fix` | ESLint fix + Prettier write |
| `npm run format` | Prettier write on all files |
| `npm run format:check` | Prettier check (no modifications) |

### Testing

| Command | Description |
|---|---|
| `npm run test:unit` | Run all unit tests (Vitest) |
| `npm run test:unit:watch` | Vitest watch mode |
| `npm run test:unit:ui` | Vitest interactive UI |
| `npm run test:unit:coverage` | Unit tests with V8 coverage (80% threshold) |
| `npm run test:e2e` | All E2E tests with process cleanup |
| `npm run test:e2e:raw` | Playwright directly |
| `npm run test:e2e:ui` | Playwright interactive UI mode |
| `npm run test:e2e:debug` | Playwright debug mode |
| `npm run test:p0` | Priority 0 (critical) tests only |
| `npm run test:p1` | Priority 0 + Priority 1 tests |
| `npm run test:db` | Database tests (pgTAP via `supabase test db`) |
| `npm run test:smoke` | Post-build smoke tests against `dist/` |
| `npm run test:burn-in` | Flaky test detection (10 iterations by default) |
| `npm run test:ci-local` | Mirror CI pipeline locally (lint, unit, E2E, burn-in) |

### Single Test File Execution

```bash
# Unit test
npx vitest run tests/unit/services/moodService.test.ts --silent

# E2E test
npx playwright test tests/e2e/mood/mood-tracker.spec.ts

# E2E by pattern
npx playwright test --grep "mood tracker"
```

### Supabase

| Command | Description |
|---|---|
| `supabase start` | Start local Supabase (required for E2E tests) |
| `supabase stop` | Stop local Supabase |
| `supabase status` | Show connection URLs and keys |
| `supabase db reset` | Reset DB and re-run all migrations |
| `supabase migration new <name>` | Create new migration file |
| `supabase gen types typescript --local > src/types/database.types.ts` | Regenerate TypeScript types from local schema |

### Performance and Analysis

| Command | Description |
|---|---|
| `npm run perf:build` | Typecheck + build with log capture |
| `npm run perf:bundle-report` | Generate bundle size report (Markdown) |

## Key Conventions

- **Package manager**: npm
- **Node version**: v24.13.0 (see `.nvmrc`)
- **Path alias**: `@/` maps to `src/` (configured in `vitest.config.ts`, not in `vite.config.ts`)
- **Generated types**: `src/types/database.types.ts` is auto-generated from Supabase schema -- do not edit manually
- **ESLint**: `no-explicit-any` is enforced as an error
- **Prettier**: Uses `prettier-plugin-tailwindcss` for Tailwind class sorting
- **Env vars**: Encrypted via dotenvx; `.env.keys` file (gitignored) contains the decryption key
- **CI workflows**: Located in `.github/workflows/` -- deploy, test, migrations, code review, auto-fix
