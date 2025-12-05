# Deployment Guide for My-Love PWA

This guide covers deployment to GitHub Pages via GitHub Actions.

## Quick Reference

- **Live URL**: https://sallvainian.github.io/My-Love/
- **Trigger**: Push to `main` branch
- **Workflow**: `.github/workflows/deploy.yml`

---

## How Deployment Works

### Automatic Deployment

Every push to `main` triggers:

1. **Build** - `npm ci && npm run build`
2. **Supabase Types** - Generates TypeScript types from database
3. **Smoke Tests** - Runs `npm run test:smoke`
4. **Deploy** - Uploads `dist/` to GitHub Pages
5. **Health Check** - Verifies site is live and Supabase connects

### Timeline

~2-3 minutes from push to live.

---

## Prerequisites

### GitHub Repository Settings

1. **Settings** → **Pages** → **Source**: "GitHub Actions"
2. **Settings** → **Secrets and variables** → **Actions**

### Required Secrets

| Secret | Description |
|--------|-------------|
| `DOTENV_KEY` | Decryption key for `.env` file |
| `SUPABASE_ACCESS_TOKEN` | For generating TypeScript types |

---

## Local Development

### Environment Setup

1. Get `DOTENV_KEY` from team member or password manager
2. Create `.env.keys`:
   ```bash
   echo "DOTENV_KEY='your-key-here'" > .env.keys
   ```
3. Run with decryption:
   ```bash
   dotenvx run -- npm run dev
   ```

### Build Locally

```bash
npm run build      # Build production bundle
npm run preview    # Preview at http://localhost:4173/
```

---

## Verification

### Post-Deploy Checklist

- [ ] Site loads at https://sallvainian.github.io/My-Love/
- [ ] No console errors
- [ ] Service worker registered (DevTools → Application → Service Workers)
- [ ] Offline mode works (Network tab → Offline checkbox → Refresh)
- [ ] Supabase connection works (login/data loads)

### Health Check (Automatic)

The workflow runs these checks automatically:
- HTTP 200 response
- JavaScript bundle loads
- PWA manifest accessible
- Supabase connection verified

---

## Troubleshooting

### Build Fails

```bash
# Test locally first
npm run build
npm run lint
npx tsc -b
```

### Deployment Stuck

1. Check **Actions** tab for workflow status
2. Re-run failed workflow, or:
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push
   ```

### Environment Variables Not Working

- Must be prefixed with `VITE_` for Vite
- Check secrets are set in GitHub Settings
- Redeploy after adding secrets

### Service Worker Issues

1. DevTools → Application → Service Workers
2. Check "Update on reload"
3. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

---

## Commands Reference

```bash
# Development
npm run dev              # Dev server (http://localhost:5173/)

# Building
npm run build            # Production build
npm run preview          # Preview build locally

# Testing
npm run lint             # ESLint
npm run test:smoke       # Smoke tests on dist/
npm run test:e2e         # Playwright E2E tests

# Type checking
npx tsc -b               # TypeScript check
```

---

## Security Notes

### Safe to Commit
- `.env` (encrypted with dotenvx)
- Source code
- Build configuration

### Never Commit
- `.env.keys` (decryption key)
- `.env.local` (local overrides)
- `node_modules/`
- `dist/`

---

## Version History

- **v3.0.0** (2025-12-03): Migrated to GitHub Pages
  - Removed Vercel configuration
  - Added GitHub Actions workflow
  - Integrated health checks
  - Simplified documentation

- **v2.0.0** (2025-11-16): Vercel deployment (deprecated)
- **v1.0.0** (2025-10-30): Initial GitHub Pages (original)
