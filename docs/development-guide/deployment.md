# Deployment

## Automatic Deployment

Pushing to `main` triggers the GitHub Actions deployment pipeline:

1. **Build** -- Install dependencies, generate Supabase types, build the app.
2. **Smoke Tests** -- Verify the built output.
3. **Deploy** -- Upload to GitHub Pages.
4. **Health Check** -- Verify HTTP status, response time, critical assets (JS bundle, PWA manifest), and Supabase connectivity.

**Live URL**: [https://sallvainian.github.io/My-Love/](https://sallvainian.github.io/My-Love/)

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `DOTENV_PRIVATE_KEY` | Decryption key for encrypted `.env` variables |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth for TypeScript type generation |

## Manual Deployment

```bash
npm run deploy
```

This runs the build, smoke tests, and deploys to GitHub Pages via `gh-pages`.

---
