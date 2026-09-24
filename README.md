# My Love

![Tests](https://github.com/Sallvainian/My-Love/actions/workflows/test.yml/badge.svg)
![Deploy](https://github.com/Sallvainian/My-Love/actions/workflows/deploy.yml/badge.svg)

A Progressive Web App for couples to exchange daily love messages, track moods, share photos, chat via love notes, and send playful interactions. Built with React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, and Supabase.

**Live**: https://my-love.sallvain.workers.dev/

## Features

- **Daily Love Messages** — Rotating heartfelt messages across categories (reasons, memories, affirmations, future dreams), with favorites and your own custom messages (managed at `/admin`)
- **Love Notes Chat** — Real-time messaging with your partner, including images
- **Mood Tracker** — Daily mood logging with emoji moods, optional notes, and a mood history calendar
- **Partner Mood View** — See your partner's current mood in real-time
- **Partner Interactions** — Send pokes, kisses, and farts with animations and real-time delivery
- **Photo Gallery** — Upload, view, and share photos with captions and lazy loading
- **Home Countdowns** — How long you've been together, plus countdowns to birthdays, events and anniversaries
- **Settings** — Display name, the couple's "Together since" date, events and anniversaries
- **Sign-in** — Email and password, or Google
- **Light and dark** — Follows the device's appearance setting
- **PWA** — Installable on mobile, loads offline
- **Privacy** — Row Level Security on all tables

## Quick Start

### Prerequisites

- [mise](https://mise.jdx.dev) (manages Node.js v24 via `.mise.toml`)
- [fnox](https://fnox.jdx.dev) with [age](https://age-encryption.org) provider (local secrets)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (local dev backend)
- Docker (required by Supabase CLI)

### Setup

```bash
git clone https://github.com/Sallvainian/My-Love.git
cd My-Love
npm install
supabase start          # Start local Supabase (Postgres, Auth, Realtime, etc.)
fnox exec -- npm run dev  # Start dev server with decrypted secrets
```

Open http://localhost:5173 in your browser.

## Development

```bash
fnox exec -- npm run dev      # Start dev server (cleanup wrapper)
fnox exec -- npm run dev:raw  # Vite dev server directly
npm run dev:local             # Vite against local Supabase (.env.test, no secrets needed)
fnox exec -- npm run build    # Production build (tsc + vite)
npm run typecheck             # tsc -b --force (all three tsconfig projects)
npm run lint                  # ESLint
npm run lint:fix              # ESLint --fix
npm run test:ci-local         # Run the CI checks locally
```

`dev`, `dev:raw` and `build` need the `fnox exec --` prefix. Without it they still start or finish cleanly, but the app throws "Supabase configuration missing" in the browser.

## Testing

The project uses a fullstack test strategy with four tiers:

| Tier        | Tool                     | Command                    | Scope                        |
| ----------- | ------------------------ | -------------------------- | ---------------------------- |
| Unit        | Vitest + happy-dom       | `npm run test:unit`        | Components, stores, services |
| Integration | Playwright (browserless) | `npm run test:integration` | Supabase RPC, API contracts  |
| E2E         | Playwright (Chromium)    | `npm run test:e2e`         | Full user flows with browser |
| Database    | pgTAP via Supabase CLI   | `npm run test:db`          | SQL functions, RLS policies  |

```bash
# Unit
npm run test:unit              # Run all
npm run test:unit:watch        # Watch mode
npm run test:unit:coverage     # With coverage (25% threshold)
npx vitest run tests/unit/services/moodService.test.ts --silent  # Single file

# E2E (requires local Supabase running)
npm run test:e2e               # All Playwright projects (E2E, integration, API)
npm run test:e2e:ui            # Playwright UI mode
npm run test:p0                # Priority 0 only
npm run test:p1                # Priority 0+1
npx playwright test tests/e2e/mood/mood-tracker.spec.ts  # Single file

# Integration
npm run test:integration

# Database
npm run test:db

# Smoke (checks the files in dist/; never loads the app)
npm run test:smoke
```

## Architecture

### State Management

Single Zustand store (`src/stores/useAppStore.ts`) composed from 11 slices:

`appSlice` | `authSlice` | `settingsSlice` | `navigationSlice` | `messagesSlice` | `moodSlice` | `interactionsSlice` | `partnerSlice` | `notesSlice` | `photosSlice` | `eventsSlice`

### Secrets Management

Uses [fnox](https://fnox.jdx.dev) with the `age` provider. Secrets are encrypted inline in `fnox.toml` (safe to commit) and decrypted at runtime via age keys.

| File           | Committed | Purpose                          |
| -------------- | --------- | -------------------------------- |
| `.mise.toml`   | Yes       | Tool versions (Node) + env vars  |
| `fnox.toml`    | Yes       | Age-encrypted secrets            |
| `.env.example` | Yes       | Template with placeholder values |
| `.env.test`    | Yes       | Local Supabase test values       |

```bash
fnox exec -- <command>    # Run with decrypted secrets
fnox set KEY "value"      # Encrypt and store a secret
fnox get KEY              # Decrypt and retrieve
fnox check                # Verify all secrets resolve
```

### Supabase

43 migrations managing tables, RLS policies, RPC functions, and realtime subscriptions. Key tables: `users`, `moods`, `interactions`, `love_notes`, `photos`, `events`, `anniversaries`, `couple_settings`, `custom_messages`, `message_favorites`, and more.

```bash
supabase start                    # Start local instance
supabase db reset                 # Reset and re-run all migrations
supabase migration new <name>     # Create new migration
supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts
```

### Base Path

Production and development both serve from `/` — the app sits at the root of its Cloudflare Workers origin. Configured in `vite.config.ts`.

## Project Structure

```
My-Love/
├── src/
│   ├── components/
│   │   ├── love-notes/           # Real-time chat
│   │   ├── DailyMessage/         # Main message card
│   │   ├── MoodTracker/          # Mood logging
│   │   ├── MoodHistory/          # Mood calendar
│   │   ├── PartnerMoodView/      # Partner mood display
│   │   ├── PokeKissInterface/    # Playful interactions
│   │   ├── PhotoGallery/         # Photo grid
│   │   ├── RelationshipTimers/   # Home countdown cards
│   │   ├── Settings/             # Settings, events, anniversaries
│   │   ├── AdminPanel/           # Custom message editor
│   │   └── ...
│   ├── stores/
│   │   ├── useAppStore.ts        # Root Zustand store
│   │   └── slices/               # 11 state slices
│   ├── api/                      # Supabase client, auth, API calls
│   ├── services/                 # IndexedDB, local copies, sync, realtime
│   ├── config/                   # Image and performance settings
│   ├── data/                     # Default messages
│   ├── types/                    # TypeScript types (database.types.ts auto-generated)
│   └── utils/                    # Themes, date helpers, message rotation
├── tests/
│   ├── e2e/                      # Playwright E2E specs
│   ├── integration/              # Playwright integration specs
│   ├── unit/                     # Vitest unit tests
│   ├── api/                      # API contract tests
│   ├── e2e-archive/              # Frozen old specs; not run
│   └── support/                  # Fixtures, factories, helpers
├── supabase/
│   ├── config.toml
│   ├── functions/                # Edge Functions
│   ├── migrations/               # 43 SQL migrations
│   ├── seed.sql
│   └── tests/                    # pgTAP database tests
└── .github/workflows/            # CI/CD pipelines
```

## CI/CD

### Test Pipeline (`.github/workflows/test.yml`)

Runs on pull requests, pushes to `main` and a weekly schedule. On a pull request, each stage runs only when the files it covers changed; pushes to `main` and the weekly run always run everything.

- Lint & Type Check (ESLint + tsc)
- Unit Tests (Vitest with coverage)
- Database Tests (pgTAP)
- Backend Tests (Playwright `integration` and `api` projects)
- E2E Tests (Playwright, sharded across 2 runners)
- Burn-in (flaky test detection, 3 shards)
- Test Summary (the only required status check for merge)

### Deploy Pipeline (`.github/workflows/deploy.yml`)

On push to `main`: apply migrations → build → smoke test → `wrangler deploy` to Cloudflare Workers → health check.

### Other Workflows

- `bundle-size.yml` — PR bundle size comparison
- `codeql.yml` — Security analysis
- `dependency-review.yml` — Flags risky dependency changes on PRs
- `dependabot-auto-merge.yml` — Turns on auto-merge for every Dependabot PR
- `supabase-migrations.yml` — Migration validation on PRs that touch `supabase/`
- `claude-code-review.yml` — Claude reviews every PR
- `claude.yml` — Answers `@claude` mentions on issues and PRs
- `lighthouse.yml` — Performance audit after each deploy

## Deployment

### GitHub Secrets

| Secret                                  | Purpose                           |
| --------------------------------------- | --------------------------------- |
| `VITE_SUPABASE_URL`                     | Supabase project URL (build-time) |
| `VITE_SUPABASE_ANON_KEY`                | Supabase publishable key (build-time; exposed to the app as `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) |
| `SUPABASE_ACCESS_TOKEN`                 | Supabase CLI auth for applying migrations |
| `SUPABASE_DB_PASSWORD`                  | Production database password for applying migrations |
| `CLAUDE_CODE_OAUTH_TOKEN`               | Claude review and `@claude` workflows |
| `CLOUDFLARE_API_TOKEN`                  | `production` environment: "Edit Cloudflare Workers" token for `wrangler deploy` |
| `CLOUDFLARE_ACCOUNT_ID`                 | `production` environment: Cloudflare account the Worker lives in |

The repository variable `SITE_URL` (`https://my-love.sallvain.workers.dev/`, trailing slash required) is the address that both the post-deploy health check and the Lighthouse workflow test. `SUPABASE_PROJECT_ID` names the production project that migrations are applied to.

### Cloudflare Workers

1. `wrangler.jsonc` defines the Worker: an assets-only Worker named `my-love` serving `dist/` in single-page-application mode.
2. Pushes to `main` auto-deploy via the deploy workflow. To deploy by hand, build with secrets first — `fnox exec -- npm run build`, then `npx wrangler deploy` (after `npx wrangler login`).

## Installing on Mobile

**iOS**: Safari > Share > "Add to Home Screen"
**Android**: Chrome > Menu > "Install app"

## Built With

- [React 19](https://react.dev/) — UI framework
- [TypeScript](https://www.typescriptlang.org/) — Type safety
- [Vite](https://vite.dev/) — Build tool
- [Tailwind CSS v4](https://tailwindcss.com/) — Styling
- [Framer Motion](https://www.framer.com/motion/) — Animations
- [Zustand](https://zustand.docs.pmnd.rs/) — State management
- [Supabase](https://supabase.com/) — Backend, auth, realtime
- [Playwright](https://playwright.dev/) — E2E and integration testing
- [Vitest](https://vitest.dev/) — Unit testing
- [mise](https://mise.jdx.dev/) — Tool version management
- [fnox](https://fnox.jdx.dev/) — Secrets management

## License

Open source, available for personal use. Customize it for your own relationship.
