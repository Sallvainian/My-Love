# Environment Setup

## How Secrets Are Managed

The project uses [fnox](https://fnox.jdx.dev) with the `age` encryption provider for secrets management. Secrets are stored as age-encrypted ciphertext inline in `fnox.toml` (safe to commit). Decryption requires an age private key stored at `~/.age/key.txt`.

Tool versions (Node.js) are managed by [mise](https://mise.jdx.dev) via `.mise.toml`.

| Context     | Mechanism                                                                              |
| ----------- | -------------------------------------------------------------------------------------- |
| Local dev   | `fnox exec -- npm run dev` decrypts secrets via age, injects as env vars               |
| Local build | `fnox exec -- npm run build` decrypts secrets for production build                     |
| CI build    | GitHub Secrets are set directly as environment variables (no fnox in CI)               |
| CI tests    | Tests use local Supabase -- no production secrets needed                               |
| E2E tests   | Playwright config parses `supabase status -o env` for local Supabase connection values |

## Environment Files

| File           | Purpose                                                   | In Git? |
| -------------- | --------------------------------------------------------- | ------- |
| `fnox.toml`    | Age-encrypted secret ciphertext + recipient public keys   | Yes     |
| `.mise.toml`   | Tool versions (Node 24.13.0) + env vars (CODEX_HOME)      | Yes     |
| `.env.test`    | Plain-text local Supabase values for E2E testing          | Yes     |
| `.env.example` | Template showing required variable names and descriptions | Yes     |
| `.env`         | Not used (gitignored) -- all secrets live in fnox.toml    | No      |
| `.envrc`       | direnv config (gitignored)                                | No      |

## Getting Started with Environment Variables

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Set up your age key for fnox:

   ```bash
   # Generate a new age key pair (if you don't have one)
   mkdir -p ~/.age
   age-keygen -o ~/.age/key.txt

   # Set the environment variable (add to ~/.zshrc or ~/.bashrc)
   export FNOX_AGE_KEY_FILE=~/.age/key.txt
   ```

3. Have an existing team member add your age public key to `fnox.toml` recipients and re-encrypt all secrets:

   ```bash
   # Get your public key
   cat ~/.age/key.txt | grep "public key"
   # Output: # public key: age1...
   ```

4. Verify secrets resolve:

   ```bash
   fnox check
   ```

5. Run commands with secrets injected:
   ```bash
   fnox exec -- npm run dev      # Development server with secrets
   fnox exec -- npm run build    # Production build with secrets
   ```

## Required Variables

These secrets are stored encrypted in `fnox.toml`:

| Variable                                | Description                                               | Where to Find                                                 |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                     | Supabase project URL (`https://[project-id].supabase.co`) | Supabase Dashboard > Project Settings > API                   |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anonymous/public (anon) key                      | Supabase Dashboard > Project Settings > API > anon/public key |
| `SUPABASE_SERVICE_KEY`                  | Supabase service role key (admin access, bypasses RLS)    | Supabase Dashboard > Project Settings > API > service_role    |
| `SUPABASE_PAT`                          | Supabase Personal Access Token                            | Supabase Dashboard > Account > Access Tokens                  |
| `SENTRY_AUTH_TOKEN`                     | Sentry auth token for source map uploads                  | Sentry > Settings > Auth Tokens                               |
| `SENTRY_ORG`                            | Sentry organization slug                                  | Sentry > Settings > General                                   |
| `SENTRY_PROJECT`                        | Sentry project slug                                       | Sentry > Settings > Projects                                  |
| `VITE_SENTRY_DSN`                       | Sentry DSN for error tracking                             | Sentry > Project Settings > Client Keys (DSN)                 |

## Modifying Secrets

To add or update a secret:

```bash
fnox set KEY "value"     # Encrypt and store in fnox.toml
fnox check               # Verify all secrets resolve
```

The updated `fnox.toml` can be committed to the repository since it contains only encrypted ciphertext.

## fnox.toml Structure

The `fnox.toml` file uses the age encryption provider with two recipient public keys (Mac and WSL machines):

```toml
if_missing = "error"

[providers.age]
type = "age"
recipients = [
  "age1nh6erurdkerjxk834v7ttuekm5tmk09s6uner2nm2yhrcp9hwekqfdmjag",
  "age1pd6qp5x0h3lp3u23xzh9wkh2gnmkdglp0hak89538vwlqp7xnajsqfs6nw",
]

[secrets]
VITE_SUPABASE_URL = { provider = "age", value = "...", description = "Supabase project URL" }
# ... additional secrets
```

The `if_missing = "error"` setting causes fnox to fail if any secret cannot be decrypted, providing early detection of missing keys.

## E2E Test Environment

E2E tests use a separate `.env.test` file with plain-text local Supabase connection values:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=SUPABASE_TEST_ANON_KEY_PLACEHOLDER
```

The Playwright config (`playwright.config.ts`) starts the Vite dev server with `--mode test`, which makes Vite load `.env.test` and override any production credentials. This ensures E2E tests run against the local Supabase instance.

Additionally, `playwright.config.ts` parses `supabase status -o env` to automatically detect the local Supabase URL, service role key, and anon key. When GoTrue uses ES256 signing keys (Supabase CLI v2.71.1+), the config re-signs JWT tokens using the ES256 private key extracted from the Docker container environment. These are set as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` environment variables for the test fixtures. The config uses `=` (not `??=`) for `VITE_` variants because fnox may inject production values that need to be overridden with local values.

## CI Environment

In CI (GitHub Actions), secrets are provided directly as GitHub Secrets -- fnox is not used in CI:

| GitHub Secret             | Purpose                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Supabase project URL for production builds                                                  |
| `VITE_SUPABASE_ANON_KEY`  | Supabase anon key for production builds (mapped to `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) |
| `VITE_SENTRY_DSN`         | Sentry DSN for error tracking in production                                                 |
| `SENTRY_AUTH_TOKEN`       | Sentry auth token for source map uploads during build                                       |
| `SENTRY_ORG`              | Sentry organization slug                                                                    |
| `SENTRY_PROJECT`          | Sentry project slug                                                                         |
| `SUPABASE_ACCESS_TOKEN`   | Supabase CLI auth token for TypeScript type generation from remote schema                   |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows                                            |

The build step in `deploy.yml` passes these secrets as environment variables directly to `npm run build` without any encryption layer.
