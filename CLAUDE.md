# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

My Love is a PWA (Progressive Web App) for couples to exchange daily love messages, mood tracking, photo sharing, love notes chat, scripture reading, and partner interactions. Built with React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, and Supabase.

Live URL: https://sallvainian.github.io/My-Love/

## Commands

### Development

```bash
npm run dev              # Start dev server (runs cleanup script wrapper)
npm run dev:raw          # Start Vite dev server directly
npm run preview          # Preview production build
npm run build            # Production build (tsc + vite)
npm run typecheck        # tsc -b (checks all project references)
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

# Failure analysis (AI-friendly Markdown summary of failed tests)
npm run test:failures          # Groups by root cause, extracts test IDs/priority/API paths
npm run test:failures > failures-ai.md  # Save to file

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
supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts  # Regenerate types
```

## Architecture

### State Management: Zustand Sliced Store

Single Zustand store (`src/stores/useAppStore.ts`) composed from 10 slices via the slice pattern:

- `appSlice` - initialization, loading states
- `settingsSlice` - theme, relationship config
- `navigationSlice` - current view routing
- `messagesSlice` - daily love messages, favorites
- `moodSlice` - mood tracking, partner mood sync
- `interactionsSlice` - poke/kiss/fart interactions
- `partnerSlice` - partner data, display name
- `notesSlice` - love notes chat messages
- `photosSlice` - photo gallery
- `scriptureReadingSlice` - scripture reading sessions

### Environment Variables & Secrets

Uses [fnox](https://fnox.jdx.dev) with the `age` provider for local secrets (encrypted inline in `fnox.toml`) and GitHub Secrets for CI. Tool versions managed by [mise](https://mise.jdx.dev) via `.mise.toml`.

**Local development:**
- `fnox exec -- npm run dev` — decrypts secrets via age, starts dev server
- `fnox exec -- npm run build` — local production build with secrets
- `fnox check` — verify all secrets resolve
- `fnox set KEY value` — encrypt and store a secret

**Files:**
| File | Committed | Contents |
|------|-----------|----------|
| `.mise.toml` | Yes | Tool versions (Node) + env vars (CODEX_HOME) |
| `fnox.toml` | Yes | Age-encrypted secret ciphertext + recipient public keys |
| `.env.example` | Yes | Template with placeholder values |
| `.env.test` | Yes | Local Supabase test values |

**Project secrets (in `fnox.toml`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_KEY`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `VITE_SENTRY_DSN`, `SUPABASE_PAT`

### Base Path

Production builds use `/My-Love/` base path for GitHub Pages deployment. Development uses `/`. Configured in `vite.config.ts` via `mode === 'production'` check.

## Key Conventions

- Package manager: **npm** (see `package-lock.json`)
- Node version: **v24.13.0** (see `.mise.toml`)
- Path alias: `@/` maps to `src/` (configured in vitest.config.ts, not in vite.config.ts)
- Generated types: `src/types/database.types.ts` is auto-generated from Supabase schema - do not edit manually
- ESLint enforces `no-explicit-any` as error
- Prettier with `tailwindcss` plugin for class sorting
- CI workflows in `.github/workflows/`: deploy, test, migrations, code review

## General Rules

- Always read relevant documentation/docs files BEFORE making changes. Never rush into implementation without understanding the full context first.
- Prefer comprehensive fixes over minimal fixes. When fixing issues, fix them thoroughly rather than suggesting the smallest possible change.

## Communication

- When the user asks a question, answer the question asked — don't reinterpret it. If the user asks 'should I do X?', that's a question, not a request to do X.

## Workflow Rules

- For migration tasks: 1) Create a complete plan covering ALL environments/platforms mentioned 2) Get approval 3) Execute step by step. Never delete source files before confirming the target is working.

## CI/CD

- When asked to fix CI, always check ALL failure modes (formatting, lint, coverage thresholds, tests) before pushing — never fix one issue and leave others broken.

## Git & Commits

- Always run Prettier/formatting on all new or modified files before committing. Run `npm run format` on changed files as a pre-commit step.
