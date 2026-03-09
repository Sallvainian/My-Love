# My Love

![Tests](https://github.com/Sallvainian/My-Love/actions/workflows/test.yml/badge.svg)
![Deploy](https://github.com/Sallvainian/My-Love/actions/workflows/deploy.yml/badge.svg)

A Progressive Web App for couples to exchange daily love messages, track moods, share photos, chat via love notes, read scripture together, and send playful interactions. Built with React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, and Supabase.

**Live**: https://sallvainian.github.io/My-Love/

## Features

- **Daily Love Messages** — Rotating heartfelt messages across categories (reasons, memories, affirmations, future dreams)
- **Love Notes Chat** — Real-time messaging with your partner
- **Mood Tracker** — Daily mood logging with emoji moods, optional notes, and mood history timeline
- **Partner Mood View** — See your partner's current mood in real-time
- **Partner Interactions** — Send pokes, kisses, and farts with animations and real-time delivery
- **Photo Gallery** — Upload, view, edit, and share photos with captions and lazy loading
- **Scripture Reading** — Solo and Together mode scripture sessions with lobby, role selection, countdown, and synchronized reading
- **Anniversary Timers** — Real-time countdowns to special dates with celebration animations
- **Themes** — Sunset, Ocean, Lavender, and Rose
- **PWA** — Installable on mobile, works offline
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
npm run dev              # Start dev server (cleanup wrapper)
npm run dev:raw          # Vite dev server directly
npm run build            # Production build (tsc + vite)
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run format:check     # Prettier check
npm run format           # Prettier write
```

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
npm run test:unit:coverage     # With coverage (80% threshold)
npx vitest run tests/unit/services/moodService.test.ts --silent  # Single file

# E2E (requires local Supabase running)
npm run test:e2e               # All E2E tests
npm run test:e2e:ui            # Playwright UI mode
npm run test:p0                # Priority 0 only
npm run test:p1                # Priority 0+1
npx playwright test tests/e2e/mood/mood-tracker.spec.ts  # Single file

# Integration
npm run test:integration

# Database
npm run test:db

# Smoke (post-build verification)
npm run test:smoke
```

## Architecture

### State Management

Single Zustand store (`src/stores/useAppStore.ts`) composed from 10 slices:

`appSlice` | `settingsSlice` | `navigationSlice` | `messagesSlice` | `moodSlice` | `interactionsSlice` | `partnerSlice` | `notesSlice` | `photosSlice` | `scriptureReadingSlice`

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

21 migrations managing tables, RLS policies, RPC functions, and realtime subscriptions. Key tables: `users`, `moods`, `interactions`, `love_notes`, `photos`, `scripture_sessions`, `scripture_session_participants`, and more.

```bash
supabase start                    # Start local instance
supabase db reset                 # Reset and re-run all migrations
supabase migration new <name>     # Create new migration
supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts
```

### Base Path

Production uses `/My-Love/` for GitHub Pages. Development uses `/`. Configured in `vite.config.ts`.

## Project Structure

```
My-Love/
├── src/
│   ├── components/
│   │   ├── scripture-reading/    # Together/Solo mode scripture sessions
│   │   ├── love-notes/           # Real-time chat
│   │   ├── DailyMessage/         # Main message card
│   │   ├── MoodTracker/          # Mood logging
│   │   ├── PartnerMoodView/      # Partner mood display
│   │   ├── PokeKissInterface/    # Playful interactions
│   │   ├── PhotoGallery/         # Photo grid
│   │   ├── PhotoEditModal/       # Photo editing
│   │   └── ...
│   ├── stores/
│   │   ├── useAppStore.ts        # Root Zustand store
│   │   └── slices/               # 10 state slices
│   ├── services/                 # Supabase, IndexedDB, sync, realtime
│   ├── config/                   # App constants
│   ├── data/                     # Default messages
│   ├── types/                    # TypeScript types (database.types.ts auto-generated)
│   └── utils/                    # Themes, date helpers, message rotation
├── tests/
│   ├── e2e/                      # Playwright E2E specs
│   ├── integration/              # Playwright integration specs
│   ├── unit/                     # Vitest unit tests
│   ├── api/                      # API contract tests
│   └── support/                  # Fixtures, factories, helpers
├── supabase/
│   ├── migrations/               # 21 SQL migrations
│   └── tests/                    # pgTAP database tests
└── .github/workflows/            # CI/CD pipelines
```

## CI/CD

### Test Pipeline (`.github/workflows/test.yml`)

Runs on every PR targeting `main`:

- Lint & Type Check (Prettier + ESLint + tsc)
- Unit Tests (Vitest with coverage)
- Database Tests (pgTAP)
- Integration Tests (Playwright)
- API Tests (Playwright)
- E2E Tests (Playwright, sharded across 4 runners)
- Burn-in (flaky test detection)
- Test Summary (required status check for merge)

### Deploy Pipeline (`.github/workflows/deploy.yml`)

On push to `main`: build → smoke test → deploy to GitHub Pages → health check.

### Other Workflows

- `bundle-size.yml` — PR bundle size comparison
- `codeql.yml` — Security analysis
- `supabase-migrations.yml` — Migration validation
- `claude-code-review.yml` — AI-assisted code review
- `lighthouse.yml` — Performance audits

## Deployment

### GitHub Secrets

| Secret                                  | Purpose                           |
| --------------------------------------- | --------------------------------- |
| `VITE_SUPABASE_URL`                     | Supabase project URL (build-time) |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key (build-time)    |
| `SUPABASE_ACCESS_TOKEN`                 | CLI auth for type generation      |

### GitHub Pages

1. **Settings** > **Pages** > **Source**: "GitHub Actions"
2. Pushes to `main` auto-deploy via the deploy workflow

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
- [Sentry](https://sentry.io/) — Error monitoring
- [mise](https://mise.jdx.dev/) — Tool version management
- [fnox](https://fnox.jdx.dev/) — Secrets management

## License

Open source, available for personal use. Customize it for your own relationship.
