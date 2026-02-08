# Deployment

Automatic via GitHub Actions on push to `main`.

**Pipeline**: Build --> Generate Supabase Types --> Smoke Tests --> Deploy to GitHub Pages --> Health Check

**Environment Secrets**: `DOTENV_KEY`, `SUPABASE_ACCESS_TOKEN`

Uses dotenvx for encrypted environment variables.

---
