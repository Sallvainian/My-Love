# Troubleshooting

## "Loading..." Screen That Never Resolves

**Cause**: Missing or incorrect configuration in `src/config/constants.ts`, or stale IndexedDB data.

**Fix**:
1. Verify `defaultPartnerName` and `defaultStartDate` are set correctly in `src/config/constants.ts`.
2. Clear IndexedDB: DevTools > Application > IndexedDB > delete the database.
3. Hard refresh the page.

## Console Configuration Errors

**Cause**: Invalid values in `constants.ts`.

**Fix**: Ensure `defaultPartnerName` is a non-empty string and `defaultStartDate` is a valid `YYYY-MM-DD` date.

## ConstraintError in Console

**Cause**: IndexedDB schema conflict from a previous version.

**Fix**: Clear IndexedDB via DevTools > Application > IndexedDB, then reload.

## Dev Server Will Not Start

**Cause**: Wrong Node version or corrupted dependencies.

**Fix**:
```bash
nvm use                  # Switch to the correct Node version
rm -rf node_modules
npm install
npm run dev
```

## Build Fails

**Cause**: Type errors, missing dependencies, or environment variable issues.

**Fix**:
```bash
npm run typecheck        # Identify TypeScript errors
npm run lint             # Identify lint errors
npm install              # Ensure all dependencies are installed
```

If the build fails on dotenvx decryption, verify that `.env.keys` exists in the project root.

## PWA Not Installing

**Cause**: PWA installation requires HTTPS and a valid manifest.

**Fix**: The PWA installs correctly on GitHub Pages (HTTPS). For local development, PWA features are disabled (`devOptions.enabled: false` in `vite.config.ts`).

## Realtime Updates Not Working

**Cause**: Supabase Realtime is not enabled on the relevant tables.

**Fix**: In the Supabase Dashboard, navigate to Database > Replication and enable Realtime on the tables that need it (mood entries, love notes, interactions).

## E2E Tests Failing Locally

**Cause**: Missing Playwright browsers, Supabase not running, or environment variables not set.

**Fix**:
```bash
npx playwright install           # Install browsers
npx supabase start               # Start local Supabase (if using local)
npm run test:e2e                 # Run with cleanup script
```

The Playwright config automatically reads Supabase connection details from `supabase status` when running locally.
