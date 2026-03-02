# Environment Setup

The project uses [dotenvx](https://dotenvx.com) for secrets management. Environment variables are stored encrypted in `.env` (safe to commit). The private decryption key lives in `.env.keys` (gitignored) and is backed up to [dotenvx-ops](https://dotenvx.com/ops) cloud.

## How Secrets Are Injected

| Context       | Mechanism                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Local dev     | `dotenvx run -- <command>` decrypts `.env` using `.env.keys`                                      |
| CI build      | `dotenvx run -- npm run build` with `DOTENV_PRIVATE_KEY` GitHub Secret                            |
| CI tests      | Tests use local Supabase — no production secrets needed                                           |
| E2E tests     | Playwright config parses `supabase status -o env` for local Supabase connection values            |

## Environment Files

| File           | Purpose                                                        | In Git? |
| -------------- | -------------------------------------------------------------- | ------- |
| `.env`         | Encrypted secrets (Supabase, Sentry, etc.)                     | Yes     |
| `.env.keys`    | Private decryption key — backed up to dotenvx-ops cloud        | No (gitignored) |
| `.env.x`       | dotenvx-ops project ID                                         | Yes     |
| `.env.test`    | Plain-text local Supabase values for E2E testing               | Yes     |
| `.env.example` | Template showing required variable names                       | Yes     |
| `.envrc`       | direnv config (loads dotenvx secrets into the shell)           | No (gitignored) |

## Getting Started with Environment Variables

1. Clone the repo and install dependencies (dotenvx is a devDependency):
   ```bash
   npm install
   ```
2. Get the `.env.keys` file from dotenvx-ops:
   ```bash
   npx dotenvx-ops login
   npx dotenvx-ops sync
   ```
3. Run commands with dotenvx (automatically decrypts secrets):
   ```bash
   dotenvx run -- npm run dev
   ```
4. Or use direnv for automatic injection: install [direnv](https://direnv.net/), run `direnv allow`, and secrets will be loaded automatically when you `cd` into the project directory.

## Required Variables

| Variable                                | Description                                               | Where to Find                                                 |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                     | Supabase project URL (`https://[project-id].supabase.co`) | Supabase Dashboard > Project Settings > API                   |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anonymous/public (anon) key                      | Supabase Dashboard > Project Settings > API > anon/public key |

The `.env.example` file shows the expected format:

```
VITE_SUPABASE_URL="https://xojempkrugifnaveqtqc.supabase.co"
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY="your-anon-key-here"
```

## Modifying Secrets

1. Set a new value:
   ```bash
   dotenvx set KEY=value
   ```
2. Encrypt the updated `.env`:
   ```bash
   dotenvx encrypt
   ```
3. Back up the private key to dotenvx-ops cloud:
   ```bash
   npx dotenvx-ops backup
   ```
4. Commit the updated encrypted `.env`.

## E2E Test Environment

E2E tests use a separate `.env.test` file with plain-text local Supabase connection values:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The Playwright config (`playwright.config.ts`) starts the Vite dev server with `--mode test`, which makes Vite load `.env.test` and override the production credentials. This ensures E2E tests run against the local Supabase instance.

Additionally, `playwright.config.ts` parses `supabase status -o env` to automatically detect the local Supabase URL, service role key, and anon key. These are set as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` environment variables for the test fixtures to use. The config uses `=` (not `??=`) because dotenvx may inject production values that need to be overridden with local values.

## CI Environment

In CI (GitHub Actions), dotenvx decrypts `.env` using the `DOTENV_PRIVATE_KEY` GitHub Secret:

| Secret                    | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `DOTENV_PRIVATE_KEY`      | dotenvx private key for decrypting `.env` (used during build/deploy)      |
| `SUPABASE_ACCESS_TOKEN`   | Supabase CLI auth token for TypeScript type generation from remote schema |
| `CURRENTS_RECORD_KEY`     | Currents.dev recording key for Playwright cloud reporting                 |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows                          |
| `CLAUDE_PAT`              | GitHub personal access token for Claude bot commits and PR operations     |

The build step in `deploy.yml` uses `dotenvx run -- npm run build`, which decrypts Supabase credentials and other secrets at build time. The build script itself (`tsc -b && vite build`) receives the decrypted environment variables transparently.
