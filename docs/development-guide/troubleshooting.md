# Troubleshooting

## "Loading..." Screen That Never Resolves

**Cause**: Missing or incorrect configuration in `src/config/constants.ts`, stale IndexedDB data, or failed Supabase connection.

**Fix**:

1. Verify `defaultPartnerName` and `defaultStartDate` are set correctly in `src/config/constants.ts`:
   ```typescript
   export const APP_CONFIG = {
     defaultPartnerName: 'Gracie',
     defaultStartDate: '2025-10-18',
     isPreConfigured: true,
   } as const;
   ```
2. Clear IndexedDB: DevTools > Application > IndexedDB > delete the database.
3. Clear localStorage: DevTools > Application > Local Storage > clear all.
4. Hard refresh the page (Cmd+Shift+R on macOS, Ctrl+Shift+R on Windows/Linux).
5. Check the browser console for Supabase connection errors. If the Supabase URL is unreachable, the app may hang on initialization.

## Console Configuration Errors

**Cause**: Invalid values in `src/config/constants.ts`.

**Fix**: Ensure `defaultPartnerName` is a non-empty string and `defaultStartDate` is a valid `YYYY-MM-DD` date string. The `isPreConfigured` flag should always be `true`.

## ConstraintError in Console

**Cause**: IndexedDB schema conflict from a previous database version. The current schema is version 5 (defined in `src/services/dbSchema.ts`).

**Fix**: Clear IndexedDB via DevTools > Application > IndexedDB > delete the `my-love-db` database, then reload the page. The app will recreate the database with the current schema.

Alternatively, run this in the browser console:

```javascript
indexedDB.deleteDatabase('my-love-db');
location.reload();
```

## Dev Server Will Not Start

**Cause**: Wrong Node version, corrupted dependencies, or dotenvx decryption failure.

**Fix**:

```bash
nvm use                  # Switch to Node v24.13.0 (reads .nvmrc)
rm -rf node_modules
npm install
npm run dev
```

If dotenvx fails to decrypt `.env`, verify that `.env.keys` exists in the project root. If you do not have the decryption key, use `npm run dev:raw` instead (starts Vite without dotenvx, but Supabase features will not work without env vars).

## Build Fails

**Cause**: Type errors, missing dependencies, lint errors, or environment variable issues.

**Fix**:

```bash
npm run typecheck        # Identify TypeScript errors (tsc --noEmit)
npm run lint             # Identify ESLint errors
npm install              # Ensure all dependencies are installed
```

If the build fails specifically on dotenvx decryption, verify that `.env.keys` exists in the project root:

```bash
ls -la .env.keys
```

If it does not exist, obtain it from a team member or generate your own Supabase project credentials.

If TypeScript reports errors in `src/types/database.types.ts`, regenerate the types:

```bash
supabase gen types typescript --local > src/types/database.types.ts
```

## PWA Not Installing

**Cause**: PWA installation requires HTTPS and a valid manifest. Local development uses HTTP.

**Fix**: The PWA installs correctly on GitHub Pages (HTTPS). For local development, PWA features are intentionally disabled:

```typescript
// vite.config.ts
devOptions: { enabled: false }
```

To test PWA behavior locally, you can temporarily set `devOptions.enabled: true` in `vite.config.ts`, but this is not recommended for normal development.

## Realtime Updates Not Working

**Cause**: Supabase Realtime is not enabled on the relevant tables, or the Realtime service is not running locally.

**Fix**:

1. **Remote (production)**: In the Supabase Dashboard, navigate to Database > Replication and enable Realtime on the tables that need it (mood entries, love notes, interactions).
2. **Local**: Verify Realtime is enabled in `supabase/config.toml`:
   ```toml
   [realtime]
   enabled = true
   ```
3. Restart local Supabase:
   ```bash
   supabase stop
   supabase start
   ```

## E2E Tests Failing Locally

**Cause**: Missing Playwright browsers, Supabase not running, environment variables not set, or stale auth state.

**Fix**:

```bash
npx playwright install           # Install browsers
supabase start                   # Start local Supabase (requires Docker)
supabase db reset                # Reset database and apply all migrations + seed
npm run test:e2e                 # Run with cleanup script
```

The Playwright config automatically reads Supabase connection details from `supabase status -o env` when running locally. If you get authentication errors, delete the cached auth state:

```bash
rm -rf tests/.auth/
```

Then run the tests again. The auth setup project will recreate test users and auth state.

## E2E Tests Hanging or Timing Out

**Cause**: Dev server not started, port conflict, or database connection timeout.

**Fix**:

1. Verify Vite dev server is not already running on port 5173:
   ```bash
   lsof -i :5173
   ```
   Kill any existing process, then re-run tests.
2. Verify local Supabase is running:
   ```bash
   supabase status
   ```
   If services are stopped, restart with `supabase start`.
3. If the Playwright webServer timeout (120 seconds) is exceeded, check for build errors:
   ```bash
   npx vite --mode test
   ```
   This starts the dev server manually so you can see any error output.

## Supabase Local Not Starting

**Cause**: Docker not running, port conflicts, or corrupted Supabase state.

**Fix**:

1. Verify Docker is running:
   ```bash
   docker info
   ```
2. Check for port conflicts (54321, 54322, 54323, 54324):
   ```bash
   lsof -i :54321
   lsof -i :54322
   ```
3. Stop and restart with a clean state:
   ```bash
   supabase stop --no-backup
   supabase start
   ```
4. If migrations fail, check the migration files for syntax errors:
   ```bash
   supabase db reset
   ```

## Service Worker Caching Stale Content

**Cause**: Browser has cached an old service worker that serves stale JavaScript or HTML.

**Fix**:

1. Open DevTools > Application > Service Workers
2. Click "Unregister" on the active service worker
3. Open DevTools > Application > Cache Storage and delete all caches
4. Hard refresh the page

Alternatively, run this in the browser console (from `scripts/clear-caches.js`):

```javascript
// Unregister all service workers
const registrations = await navigator.serviceWorker.getRegistrations();
for (const reg of registrations) await reg.unregister();

// Clear all caches
const cacheNames = await caches.keys();
for (const name of cacheNames) await caches.delete(name);

// Clear IndexedDB
indexedDB.deleteDatabase('my-love-db');

// Clear localStorage
localStorage.clear();

// Reload
location.reload();
```

## Database Migration Conflicts

**Cause**: Running migrations in different order locally vs. remotely, or editing an already-applied migration.

**Fix**:

1. Never edit migration files that have already been applied. Create a new migration instead.
2. To reset local state completely:
   ```bash
   supabase db reset
   ```
3. To check which migrations have been applied remotely:
   ```bash
   supabase migration list
   ```

## Prettier and ESLint Conflicts

**Cause**: Formatting rules conflicting between tools.

**Fix**: Always run `npm run lint:fix` which runs ESLint fix followed by Prettier write. This ensures ESLint fixes are applied first, then Prettier formats the result.

```bash
npm run lint:fix    # eslint --fix && prettier --write .
```

## Unit Tests Fail with IndexedDB Errors

**Cause**: `fake-indexeddb` is not loaded, or the test setup file is not configured.

**Fix**: Verify `tests/setup.ts` includes:

```typescript
import 'fake-indexeddb/auto';
```

And that `vitest.config.ts` references it:

```typescript
test: {
  setupFiles: ['./tests/setup.ts'],
}
```

## Burn-In Detects Flaky Tests

**Cause**: Non-deterministic test behavior, usually from race conditions, animation timing, or shared test state.

**Fix**:

1. Run the specific flaky test in debug mode:
   ```bash
   npx playwright test tests/e2e/path/to/test.spec.ts --debug
   ```
2. Add explicit waits for async operations instead of relying on implicit timing.
3. Ensure tests use worker-isolated auth (import `test` from `tests/support/merged-fixtures.ts`, not `@playwright/test`).
4. Check for shared database state between tests. Each test should create its own data and clean up after itself.
