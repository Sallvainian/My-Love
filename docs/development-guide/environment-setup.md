# Environment Setup

The project uses [dotenvx](https://dotenvx.com/) for encrypted environment variables. This keeps secrets safe in version control while still allowing automated builds. The encrypted `.env` file is committed to git; the decryption key (`.env.keys`) is gitignored.

## Environment Files

| File | Purpose | In Git? |
|---|---|---|
| `.env` | Encrypted environment variables (production Supabase credentials) | Yes (safe to commit -- encrypted via dotenvx) |
| `.env.keys` | Decryption key for `.env` | No (gitignored -- never commit) |
| `.env.example` | Template showing required variable names | Yes |
| `.env.test` | Plain-text local Supabase values for E2E testing | Yes |
| `.env.local` | Local overrides (optional) | No (gitignored) |

## Getting Started with Environment Variables

1. Obtain the `.env.keys` file from a team member (or generate your own Supabase project and run `npx dotenvx encrypt`).
2. Place `.env.keys` in the project root directory.
3. dotenvx will automatically decrypt `.env` at build time and when running the dev server.

The dev server script (`npm run dev`) calls `dotenvx run --overload -- npx vite`, which decrypts and injects the variables before Vite starts.

## Required Variables

| Variable | Description | Where to Find |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://[project-id].supabase.co`) | Supabase Dashboard > Project Settings > API |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anonymous/public (anon) key | Supabase Dashboard > Project Settings > API > anon/public key |

The `.env.example` file shows the expected format:

```
VITE_SUPABASE_URL="https://xojempkrugifnaveqtqc.supabase.co"
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY="your-anon-key-here"
```

## Modifying Encrypted Variables

```bash
# Decrypt .env in place (requires .env.keys)
npx dotenvx decrypt

# Edit the now-decrypted .env file with your changes

# Re-encrypt .env
npx dotenvx encrypt
```

After re-encrypting, commit the updated `.env` file. The `.env.keys` file must never be committed.

## E2E Test Environment

E2E tests use a separate `.env.test` file with plain-text local Supabase connection values:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The Playwright config (`playwright.config.ts`) starts the Vite dev server with `--mode test`, which makes Vite load `.env.test` and override the encrypted production credentials. This ensures E2E tests run against the local Supabase instance.

Additionally, `playwright.config.ts` parses `supabase status -o env` to automatically detect the local Supabase URL, service role key, and anon key. These are set as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` environment variables for the test fixtures to use.

## CI Environment

In CI (GitHub Actions), environment variables are provided via GitHub Secrets:

| Secret | Purpose |
|---|---|
| `DOTENV_PRIVATE_KEY` | Decryption key for the encrypted `.env` file (used during build) |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth token for TypeScript type generation from remote schema |
| `CURRENTS_RECORD_KEY` | Currents.dev recording key for Playwright cloud reporting |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows |
| `CLAUDE_PAT` | GitHub personal access token for Claude bot commits and PR operations |

The build step in `deploy.yml` passes `DOTENV_PRIVATE_KEY` to the `npm run build` command, which allows dotenvx to decrypt `.env` and inject the Supabase credentials at build time.
