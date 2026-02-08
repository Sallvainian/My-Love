# Environment Setup

The project uses [dotenvx](https://dotenvx.com/) for encrypted environment variables. This keeps secrets safe in version control while still allowing automated builds.

## Environment Files

| File | Purpose | In Git? |
|---|---|---|
| `.env` | Encrypted environment variables | Yes (safe to commit) |
| `.env.keys` | Decryption key for `.env` | No (gitignored) |
| `.env.example` | Template showing required variables | Yes |
| `.env.local` | Local overrides | No (gitignored) |

## Getting Started with Environment Variables

1. Obtain the `.env.keys` file from a team member (or generate your own if starting fresh).
2. Place it in the project root.
3. dotenvx will automatically decrypt `.env` at build time and when running the dev server.

## Required Variables

| Variable | Description | Where to Find |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://[project-id].supabase.co`) | Supabase Dashboard > Project Settings > API |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anonymous/public key | Supabase Dashboard > Project Settings > API > anon/public key |

## Modifying Encrypted Variables

```bash
# Decrypt, edit, and re-encrypt
npx dotenvx decrypt    # Decrypts .env in place
# ... make your changes ...
npx dotenvx encrypt    # Re-encrypts .env
```

---
