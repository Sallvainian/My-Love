# Installation

## Quick Start

```bash
git clone https://github.com/Sallvainian/My-Love.git
cd My-Love
mise install          # Install Node v24.13.0 (reads .mise.toml)
npm install           # Install all dependencies
```

If you do not use mise, manually install Node.js v24.13.0 and run `npm install`.

## Install Playwright Browsers (for E2E Tests)

```bash
npx playwright install
```

Or install only Chromium (faster, sufficient for default E2E configuration):

```bash
npx playwright install chromium
```

## Start Local Supabase (for E2E Tests and Database Work)

```bash
supabase start   # Starts Postgres, Auth, Storage, Realtime, Studio via Docker
```

This reads `supabase/config.toml` and starts the local Supabase stack. Default ports:

| Service                | Port  | URL                                                       |
| ---------------------- | ----- | --------------------------------------------------------- |
| API                    | 54321 | `http://127.0.0.1:54321`                                  |
| Database (Postgres 17) | 54322 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio                 | 54323 | `http://127.0.0.1:54323`                                  |
| Inbucket (email)       | 54324 | `http://127.0.0.1:54324`                                  |
| Analytics              | 54327 | `http://127.0.0.1:54327`                                  |

After starting, apply migrations and seed data:

```bash
supabase db reset   # Runs all 21 migrations + seed.sql
```

## Verify Installation

Start the development server with secrets injected:

```bash
fnox exec -- npm run dev
```

The app should be accessible at `http://localhost:5173/`. If the dev server starts without errors and the browser shows the application UI, installation is complete.

If you do not have fnox configured (no age key), you can start the dev server without production secrets:

```bash
npm run dev:raw
```

The app will start but Supabase features (auth, database, realtime) will not work without the required environment variables.

## Full Setup Checklist

1. Clone the repository
2. Run `mise install` (or manually install Node.js v24.13.0)
3. Run `npm install` to install dependencies
4. Set up fnox with age encryption (see [Environment Setup](./environment-setup.md))
5. Run `fnox exec -- npm run dev` to start the development server with secrets
6. (Optional) Run `supabase start` for local database
7. (Optional) Run `supabase db reset` to apply all migrations and seed data
8. (Optional) Run `npx playwright install` for E2E tests
