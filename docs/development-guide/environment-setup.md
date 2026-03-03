# Environment Setup

The project uses [fnox](https://fnox.jdx.dev) with the `age` provider for secrets management. Secrets are stored as age-encrypted ciphertext inline in `fnox.toml` (safe to commit). The age private key lives at `~/.age/key.txt` and is never committed. Tool versions (Node.js) are managed by [mise](https://mise.jdx.dev) via `.mise.toml`.

## How Secrets Are Injected

| Context   | Mechanism                                                                              |
| --------- | -------------------------------------------------------------------------------------- |
| Local dev | `fnox exec -- <command>` decrypts `fnox.toml` using `~/.age/key.txt`                   |
| CI build  | GitHub Secrets injected as environment variables directly (no fnox in CI)              |
| CI tests  | Tests use local Supabase -- no production secrets needed                               |
| E2E tests | Playwright config parses `supabase status -o env` for local Supabase connection values |

## Environment Files

| File           | Purpose                                                | In Git? |
| -------------- | ------------------------------------------------------ | ------- |
| `fnox.toml`    | Age-encrypted secrets (Supabase, Sentry, etc.)         | Yes     |
| `.mise.toml`   | Tool versions (Node 24.13.0) and env vars (CODEX_HOME) | Yes     |
| `.env.test`    | Plain-text local Supabase values for E2E testing       | Yes     |
| `.env.example` | Template showing required variable names               | Yes     |

Files that are **not** committed:

- `~/.age/key.txt` -- age private key (env var: `FNOX_AGE_KEY_FILE`)
- `.env` -- not used (legacy, gitignored)
- `.env.keys` -- not used (legacy artifact, gitignored)
- `.envrc` -- direnv config (gitignored)
- `fnox.local.toml` -- local overrides (gitignored)

## Getting Started with Environment Variables

1. Install fnox and mise:

   ```bash
   # Install mise (tool version manager)
   curl https://mise.run | sh

   # Install fnox (secrets manager)
   # See https://fnox.jdx.dev for installation instructions
   ```

2. Set up your age key:

   ```bash
   mkdir -p ~/.age
   age-keygen -o ~/.age/key.txt
   # Share your public key with the project maintainer to be added as a recipient
   ```

3. Set the age key environment variable (add to `~/.zshrc` or `~/.bashrc`):

   ```bash
   export FNOX_AGE_KEY_FILE=~/.age/key.txt
   ```

4. Verify secrets resolve:

   ```bash
   fnox check
   ```

5. Run commands with fnox (automatically decrypts secrets):
   ```bash
   fnox exec -- npm run dev
   ```

## Required Variables

| Variable                                | Description                                               | Where to Find                                                 |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                     | Supabase project URL (`https://[project-id].supabase.co`) | Supabase Dashboard > Project Settings > API                   |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anonymous/public (anon) key                      | Supabase Dashboard > Project Settings > API > anon/public key |
| `VITE_SENTRY_DSN`                       | Sentry DSN for error tracking (optional for local dev)    | Sentry > Project Settings > Client Keys (DSN)                 |

Additional secrets in `fnox.toml`: `SUPABASE_SERVICE_KEY`, `SUPABASE_PAT`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

## Modifying Secrets

1. Set a new value:
   ```bash
   fnox set KEY "value"
   ```
2. Verify it resolves:
   ```bash
   fnox get KEY
   fnox check
   ```
3. Commit the updated `fnox.toml`.

## E2E Test Environment

E2E tests use a separate `.env.test` file with plain-text local Supabase connection values:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=SUPABASE_TEST_ANON_KEY_PLACEHOLDER
```

The Playwright config (`playwright.config.ts`) starts the Vite dev server with `--mode test`, which makes Vite load `.env.test` and override any production credentials. This ensures E2E tests run against the local Supabase instance.

Additionally, `playwright.config.ts` parses `supabase status -o env` to automatically detect the local Supabase URL, service role key, and anon key. These are set as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` environment variables for the test fixtures to use. The config uses `=` (not `??=`) because fnox may inject production values that need to be overridden with local values.

## CI Environment

In CI (GitHub Actions), secrets are provided directly as GitHub Secrets environment variables -- fnox is not used in CI.

| Secret                    | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Supabase project URL for production builds                                |
| `VITE_SUPABASE_ANON_KEY`  | Supabase anon/public key for production builds                            |
| `VITE_SENTRY_DSN`         | Sentry DSN for error tracking                                             |
| `SENTRY_AUTH_TOKEN`       | Sentry auth token for source map uploads                                  |
| `SENTRY_ORG`              | Sentry organization slug                                                  |
| `SENTRY_PROJECT`          | Sentry project slug                                                       |
| `SUPABASE_ACCESS_TOKEN`   | Supabase CLI auth token for TypeScript type generation from remote schema |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows                          |
| `CLAUDE_PAT`              | GitHub personal access token for Claude bot commits and PR operations     |

The build step in `deploy.yml` passes these secrets as environment variables to `npm run build`. The build script (`tsc -b && vite build`) receives them transparently. The Sentry Vite plugin uses `SENTRY_AUTH_TOKEN` to upload source maps during build.
