# Development Quick Start

## Prerequisites

- **Node.js v24.13.0** (pinned in `.mise.toml` -- install via [mise](https://mise.jdx.dev): `mise install`)
- **npm** (package manager)
- **fnox** (for secrets: `mise install fnox` or see [fnox docs](https://fnox.jdx.dev))
- **Supabase CLI** (for E2E tests and database work: `npm install -g supabase`)
- **Playwright browsers** (for E2E tests: `npx playwright install`)

## Install and Run

```bash
git clone https://github.com/Sallvainian/My-Love.git
cd My-Love
mise install           # Install Node.js version
npm install
fnox exec -- npm run dev   # Start dev server with secrets injected
```

The dev server runs at `http://localhost:5173/` (development uses `/` base path; production uses `/My-Love/`).

## Core Commands

### Development

| Command             | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Start dev server with process cleanup (wraps `dev-with-cleanup.sh`) |
| `npm run dev:raw`   | Start Vite dev server directly (no cleanup wrapper)                 |
| `npm run preview`   | Preview production build locally                                    |
| `npm run build`     | Production build: `tsc -p tsconfig.app.json && vite build`          |
| `npm run typecheck` | TypeScript type check: `tsc -b --force` (project references mode)   |

### Code Quality

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `npm run lint`         | ESLint on `src`, `tests`, `scripts` directories |
| `npm run lint:fix`     | ESLint fix + Prettier write                     |
| `npm run format`       | Prettier write on all files                     |
| `npm run format:check` | Prettier check (no modifications)               |

### Testing

| Command                      | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `npm run test:unit`          | Run all unit tests (Vitest)                                |
| `npm run test:unit:watch`    | Vitest watch mode                                          |
| `npm run test:unit:ui`       | Vitest interactive UI                                      |
| `npm run test:unit:coverage` | Unit tests with V8 coverage (80% threshold)                |
| `npm run test:e2e`           | All E2E tests with process cleanup                         |
| `npm run test:e2e:raw`       | Playwright directly                                        |
| `npm run test:e2e:ui`        | Playwright interactive UI mode                             |
| `npm run test:e2e:debug`     | Playwright debug mode                                      |
| `npm run test:integration`   | Integration tests (Playwright integration project)         |
| `npm run test:p0`            | Priority 0 (critical) tests only                           |
| `npm run test:p1`            | Priority 0 + Priority 1 tests                              |
| `npm run test:db`            | Database tests (pgTAP via `supabase test db`)              |
| `npm run test:smoke`         | Post-build smoke tests against `dist/`                     |
| `npm run test:burn-in`       | Flaky test detection (10 iterations by default)            |
| `npm run test:ci-local`      | Mirror CI pipeline locally (lint, unit, E2E, burn-in)      |
| `npm run test:failures`      | Playwright failure analysis (AI-friendly Markdown summary) |

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

| Command                                                                                           | Description                                   |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `supabase start`                                                                                  | Start local Supabase (required for E2E tests) |
| `supabase stop`                                                                                   | Stop local Supabase                           |
| `supabase status`                                                                                 | Show connection URLs and keys                 |
| `supabase db reset`                                                                               | Reset DB and re-run all migrations            |
| `supabase migration new <name>`                                                                   | Create new migration file                     |
| `supabase gen types typescript --local \| grep -v '^Connecting to' > src/types/database.types.ts` | Regenerate TypeScript types from local schema |

### Performance and Analysis

| Command                      | Description                            |
| ---------------------------- | -------------------------------------- |
| `npm run perf:build`         | Typecheck + build with log capture     |
| `npm run perf:bundle-report` | Generate bundle size report (Markdown) |

## Key Conventions

- **Package manager**: npm (lock file: `package-lock.json`)
- **Node version**: v24.13.0 (see `.mise.toml`)
- **Path alias**: `@/` maps to `src/` (configured in `vitest.config.ts`, not in `vite.config.ts`)
- **Generated types**: `src/types/database.types.ts` is auto-generated from Supabase schema -- do not edit manually
- **ESLint**: `no-explicit-any` is enforced as an error
- **Prettier**: Uses `prettier-plugin-tailwindcss` for Tailwind class sorting
- **Secrets**: Managed via [fnox](https://fnox.jdx.dev) with age encryption provider; encrypted ciphertext committed in `fnox.toml`
- **CI workflows**: Located in `.github/workflows/` -- 19 workflows covering deploy, test, migrations, code review, security, and AI assistance
- **Base path**: Production uses `/My-Love/`, development uses `/`
- **Module system**: ESM (`"type": "module"` in `package.json`)
- **Browser target**: `defaults and supports es6-module`
