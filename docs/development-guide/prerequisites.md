# Prerequisites

## Required Tools

| Tool         | Version                            | Purpose                                          | Installation                             |
| ------------ | ---------------------------------- | ------------------------------------------------ | ---------------------------------------- |
| Node.js      | v24.13.0 (pinned in `.mise.toml`)  | JavaScript runtime                               | [mise](https://mise.jdx.dev) recommended |
| npm          | Bundled with Node.js               | Package manager (lock file: `package-lock.json`) | Included with Node.js                    |
| Git          | Latest stable                      | Version control                                  | [git-scm.com](https://git-scm.com/)      |
| Supabase CLI | Latest (`npm install -g supabase`) | Local database, E2E tests, migrations            | `npm install -g supabase`                |
| Docker       | Latest stable                      | Required by Supabase CLI for local development   | [docker.com](https://www.docker.com/)    |
| fnox         | Latest                             | Secrets management (age encryption provider)     | [fnox.jdx.dev](https://fnox.jdx.dev)     |

## Optional Tools

| Tool                | Purpose                 | Installation                                       |
| ------------------- | ----------------------- | -------------------------------------------------- |
| Playwright browsers | E2E test execution      | `npx playwright install` (run after `npm install`) |
| mise                | Tool version management | [mise.jdx.dev](https://mise.jdx.dev)               |

## Node Version Management

The project pins Node.js v24.13.0 via `.mise.toml` in the repository root. If you use [mise](https://mise.jdx.dev), the correct version is activated automatically when you enter the project directory:

```bash
mise install    # Install the pinned Node version
```

The `.mise.toml` file:

```toml
[tools]
node = "24.13.0"

[env]
CODEX_HOME = "{{config_root}}/.codex"
```

If you prefer [nvm](https://github.com/nvm-sh/nvm), manually install the correct version:

```bash
nvm install 24.13.0
nvm use 24.13.0
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

## fnox (Secrets Management)

The project uses [fnox](https://fnox.jdx.dev) with the `age` encryption provider for local secrets management. Secrets are stored encrypted inline in `fnox.toml` (committed to the repository). Decryption requires an age private key.

### Age Key Setup

Generate a dedicated age key pair (no passphrase):

```bash
mkdir -p ~/.age
age-keygen -o ~/.age/key.txt
```

Set the environment variable pointing to your key file (add to `~/.zshrc` or `~/.bashrc`):

```bash
export FNOX_AGE_KEY_FILE=~/.age/key.txt
```

Your age public key must be added to the `recipients` list in `fnox.toml` so that secrets can be encrypted for your key. Ask an existing team member to add your public key and re-encrypt the secrets.

### Verifying fnox

```bash
fnox check    # Verify all secrets resolve
fnox get VITE_SUPABASE_URL   # Decrypt and retrieve a single secret
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
fnox check              # Verify secrets resolve (requires age key)
```
