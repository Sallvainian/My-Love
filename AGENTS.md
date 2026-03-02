# AGENTS.md

## Commands

### Development

```bash
npm run dev              # Start dev server (runs cleanup script wrapper)
npm run dev:raw          # Start Vite dev server directly
npm run preview          # Preview production build
npm run build            # Production build (tsc + vite)
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint (src, tests, scripts)
npm run lint:fix         # ESLint fix + Prettier
npm run format           # Prettier write
npm run format:check     # Prettier check
```

### Testing

```bash
# Unit tests (Vitest + happy-dom)
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode
npm run test:unit:ui           # Vitest UI
npm run test:unit:coverage     # With coverage (80% threshold)

# E2E tests (Playwright, requires local Supabase running)
npm run test:e2e               # All E2E tests (cleanup wrapper)
npm run test:e2e:raw           # Playwright directly
npm run test:e2e:ui            # Playwright UI mode
npm run test:e2e:debug         # Debug mode
npm run test:p0                # Priority 0 tests only
npm run test:p1                # Priority 0+1 tests

# Run a single unit test file
npx vitest run tests/unit/services/moodService.test.ts --silent

# Run a single E2E test file
npx playwright test tests/e2e/mood/mood-tracker.spec.ts

# Run E2E tests matching a pattern
npx playwright test --grep "mood tracker"

# Database tests (pgTAP via Supabase CLI)
npm run test:db                # supabase test db

# Smoke tests (post-build verification)
npm run test:smoke
```

### Supabase

```bash
supabase start           # Start local Supabase (required for E2E tests)
supabase stop            # Stop local Supabase
supabase status          # Show connection URLs and keys
supabase db reset        # Reset DB and re-run all migrations
supabase migration new <name>  # Create new migration file
supabase gen types typescript --local > src/types/database.types.ts  # Regenerate types
```

### Environment Variables

Uses [dotenvx](https://dotenvx.com) for secrets management. Secrets are encrypted in `.env` (safe to commit). Locally, `dotenvx run` decrypts using `.env.keys`. In CI, the `DOTENV_PRIVATE_KEY` secret enables decryption via `dotenvx run`.

### Base Path

Production builds use `/My-Love/` base path for GitHub Pages deployment. Development uses `/`. Configured in `vite.config.ts` via `mode === 'production'` check.

## Key Conventions

- Package manager: **npm** (see `package-lock.json`)
- Node version: **v24.13.0** (see `.nvmrc`)
- Path alias: `@/` maps to `src/` (configured in vitest.config.ts, not in vite.config.ts)
- Generated types: `src/types/database.types.ts` is auto-generated from Supabase schema - do not edit manually
- ESLint enforces `no-explicit-any` as error
- Prettier with `tailwindcss` plugin for class sorting
- CI workflows in `.github/workflows/`: deploy, test, migrations, code review