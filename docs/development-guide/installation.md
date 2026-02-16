# Installation

## Quick Start

```bash
git clone https://github.com/Sallvainian/My-Love.git
cd My-Love
nvm use          # Switch to Node v24.13.0 (reads .nvmrc)
npm install      # Install all dependencies
```

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

| Service | Port | URL |
|---|---|---|
| API | 54321 | `http://127.0.0.1:54321` |
| Database (Postgres 17) | 54322 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | 54323 | `http://127.0.0.1:54323` |
| Inbucket (email) | 54324 | `http://127.0.0.1:54324` |
| Analytics | 54327 | `http://127.0.0.1:54327` |

After starting, apply migrations and seed data:

```bash
supabase db reset   # Runs all migrations + seed.sql
```

## Verify Installation

Start the development server:

```bash
npm run dev
```

The app should be accessible at `http://localhost:5173/`. If the dev server starts without errors and the browser shows the application UI, installation is complete.

## Full Setup Checklist

1. Clone the repository
2. Run `nvm use` to set the correct Node.js version
3. Run `npm install` to install dependencies
4. Obtain the `.env.keys` file from a team member and place it in the project root (see [Environment Setup](./environment-setup.md))
5. Run `npm run dev` to start the development server
6. (Optional) Run `supabase start` for local database
7. (Optional) Run `npx playwright install` for E2E tests
