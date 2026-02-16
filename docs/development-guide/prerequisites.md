# Prerequisites

## Required Tools

| Tool | Version | Purpose | Installation |
|---|---|---|---|
| Node.js | v24.13.0 (pinned in `.nvmrc`) | JavaScript runtime | [nvm](https://github.com/nvm-sh/nvm) recommended |
| npm | Bundled with Node.js | Package manager (lock file: `package-lock.json`) | Included with Node.js |
| Git | Latest stable | Version control | [git-scm.com](https://git-scm.com/) |
| Supabase CLI | Latest (`npm install -g supabase`) | Local database, E2E tests, migrations | `npm install -g supabase` |

## Optional Tools

| Tool | Purpose | Installation |
|---|---|---|
| Playwright browsers | E2E test execution | `npx playwright install` (run after `npm install`) |
| Docker | Required by Supabase CLI for local development | [docker.com](https://www.docker.com/) |

## Node Version Management

The project pins Node.js v24.13.0 via the `.nvmrc` file in the repository root. If you use [nvm](https://github.com/nvm-sh/nvm), switch to the correct version automatically:

```bash
nvm use
```

This reads `.nvmrc` and activates `v24.13.0`. If the version is not installed, nvm will prompt you to install it:

```bash
nvm install
```

## Supabase CLI

The Supabase CLI is required for:

- Starting the local Supabase stack (Postgres, Auth, Storage, Realtime, Studio)
- Running database migrations
- Running pgTAP database tests (`supabase test db`)
- Generating TypeScript types from the database schema

Install globally:

```bash
npm install -g supabase
```

The CLI requires Docker to be running for local development. Verify installation:

```bash
supabase --version
docker info
```

## Playwright Browsers

E2E tests run in Chromium by default. Install browsers after `npm install`:

```bash
npx playwright install
```

To install only Chromium (faster):

```bash
npx playwright install chromium
```

To also install system dependencies required by the browser:

```bash
npx playwright install --with-deps chromium
```

## Verify Prerequisites

Run these commands to verify your environment is ready:

```bash
node --version          # Should output v24.13.0
npm --version           # Should output a compatible version
git --version           # Any recent version
supabase --version      # Any recent version
docker info             # Docker must be running for Supabase local
```
