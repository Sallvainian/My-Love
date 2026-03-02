# Environment Setup

The project uses [Doppler](https://doppler.com) for secrets management. Environment variables are managed in the Doppler dashboard and injected at runtime -- no local secret files or decryption keys needed. In CI, the `dopplerhq/cli-action` injects secrets via `DOPPLER_TOKEN`.

## How Secrets Are Injected

| Context       | Mechanism                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Local dev     | direnv + Doppler CLI: `.envrc` triggers `doppler` to inject env vars into the shell automatically |
| CI build      | `dopplerhq/cli-action@v3` with `DOPPLER_TOKEN_PRD` secret: `doppler run -- npm run build`         |
| CI tests      | `dopplerhq/cli-action@v3` with `DOPPLER_TOKEN_DEV` secret                                        |
| E2E tests     | Playwright config parses `supabase status -o env` for local Supabase connection values            |

## Environment Files

| File           | Purpose                                                   | In Git? |
| -------------- | --------------------------------------------------------- | ------- |
| `.envrc`       | direnv config (loads Doppler secrets into the shell)      | Yes     |
| `.env.test`    | Plain-text local Supabase values for E2E testing          | Yes     |
| `.env.example` | Template showing required variable names                  | Yes     |
| `.env.local`   | Local overrides (optional)                                | No (gitignored) |

## Getting Started with Environment Variables

1. Install the [Doppler CLI](https://docs.doppler.com/docs/install-cli) and authenticate:
   ```bash
   doppler login
   doppler setup
   ```
2. Run commands with Doppler (automatically injects secrets):
   ```bash
   doppler run -- npm run dev
   ```
3. Or use direnv for automatic injection: install [direnv](https://direnv.net/), run `direnv allow`, and Doppler secrets will be loaded automatically when you `cd` into the project directory.

No local secret files or decryption keys are needed. All secrets are managed in the [Doppler dashboard](https://dashboard.doppler.com).

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

1. Open the [Doppler dashboard](https://dashboard.doppler.com).
2. Navigate to the project and select the appropriate environment (development or production).
3. Edit the variables as needed.
4. Changes take effect on the next `doppler run` invocation or the next time direnv reloads.

## E2E Test Environment

E2E tests use a separate `.env.test` file with plain-text local Supabase connection values:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The Playwright config (`playwright.config.ts`) starts the Vite dev server with `--mode test`, which makes Vite load `.env.test` and override the production credentials. This ensures E2E tests run against the local Supabase instance.

Additionally, `playwright.config.ts` parses `supabase status -o env` to automatically detect the local Supabase URL, service role key, and anon key. These are set as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` environment variables for the test fixtures to use. The config uses `=` (not `??=`) because Doppler may inject production values that need to be overridden with local values.

## CI Environment

In CI (GitHub Actions), Doppler injects environment variables via `dopplerhq/cli-action@v3`:

| Secret                    | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `DOPPLER_TOKEN_PRD`       | Doppler service token for production secrets (used during build/deploy)   |
| `DOPPLER_TOKEN_DEV`       | Doppler service token for development secrets (used during tests)         |
| `SUPABASE_ACCESS_TOKEN`   | Supabase CLI auth token for TypeScript type generation from remote schema |
| `CURRENTS_RECORD_KEY`     | Currents.dev recording key for Playwright cloud reporting                 |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows                          |
| `CLAUDE_PAT`              | GitHub personal access token for Claude bot commits and PR operations     |

The build step in `deploy.yml` uses `doppler run -- npm run build`, which injects Supabase credentials and other secrets at build time. The build script itself (`tsc -b && vite build`) receives the injected environment variables transparently.
