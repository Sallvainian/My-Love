# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

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

## E2E Test Architecture

### Fixtures (`tests/support/`)

Tests import `{ test, expect }` from `tests/support/merged-fixtures.ts`, which merges:

- **@seontechnologies/playwright-utils** — `apiRequest`, `recurse`, `log`, `interceptNetworkCall`, `networkErrorMonitor`
- **Custom fixtures** (`tests/support/fixtures/`) — `supabaseAdmin`, `testSession`, `togetherMode`, auth/storage state

### Shared Helpers (`tests/support/helpers.ts`)

Reusable functions for E2E tests that only receive `page: Page` (no fixture access):

- `ensureScriptureOverview(page)` — navigate to /scripture, handle stale sessions
- `startSoloSession(page)` — full solo session startup with auth readiness check
- `advanceOneStep(page)` — click Next Verse with hybrid sync
- `completeAllStepsToReflectionSummary(page)` — run through all 17 verses
- `submitReflectionSummary(page)` — fill + submit reflection form
- `skipMessageAndCompleteSession(page)` — skip message compose, complete session
- `waitForScriptureRpc(page, rpcName)` — wait for a successful RPC response
- `waitForScriptureStore(page, label, predicate)` — poll Zustand store via `expect.poll()`

### Hybrid Sync Pattern (3-layer wait)

After any mutation that changes server + client state, use all three layers:

1. **NETWORK**: `waitForScriptureRpc` / `interceptNetworkCall` — confirms server processed the request
2. **STORE**: `waitForScriptureStore` — confirms Zustand ingested the response
3. **UI**: `expect(locator).toBeVisible()` — confirms React re-rendered

**Polling approach guide:**
- `waitForScriptureStore` — scripture store state (well-typed, diagnostic snapshots)
- `expect.poll()` — simple boolean conditions in helpers (no fixture access needed)
- `recurse` fixture — complex polling in test bodies needing Playwright report logging

### Network Interception

- **In test bodies**: Use `interceptNetworkCall` fixture (spy mode or `fulfillResponse` for injection)
- **In helpers**: Use vanilla `page.waitForResponse()` (helpers don't have fixture access)
- **Error injection**: Annotate describe blocks with `{ annotation: [{ type: 'skipNetworkMonitoring' }] }` to suppress the network error monitor

### Together Mode Tests

Together-mode tests use the `togetherMode` fixture which provides:
- `partnerPage` — a second authenticated browser page
- `uiSessionId` — the shared session ID
- Helpers in `tests/support/helpers/scripture-lobby.ts` and `scripture-together.ts`

### Test Domains

```
tests/e2e/
├── auth/          # Login, logout
├── home/          # Home view
├── mood/          # Mood tracking
├── navigation/    # View routing
├── notes/         # Love notes chat
├── offline/       # Offline handling
├── partner/       # Partner interactions
├── photos/        # Photo gallery
└── scripture/     # Scripture reading (solo + together mode)
```

## Key Conventions

- Package manager: **npm** (see `package-lock.json`)
- Node version: **v24.13.0** (see `.mise.toml`)
- Path alias: `@/` maps to `src/` (configured in vitest.config.ts, not in vite.config.ts)
- Generated types: `src/types/database.types.ts` is auto-generated from Supabase schema - do not edit manually
- ESLint enforces `no-explicit-any` as error
- Prettier with `tailwindcss` plugin for class sorting
- CI workflows in `.github/workflows/`: deploy, test, migrations, code review
