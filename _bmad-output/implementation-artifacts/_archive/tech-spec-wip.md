---
title: 'Migrate Playwright Auth to playwright-utils auth-session'
slug: 'migrate-pw-auth-to-utils'
created: '2026-03-04'
status: 'in-progress'
stepsCompleted: [1]
tech_stack: ['@seontechnologies/playwright-utils/auth-session', 'Supabase', 'Playwright']
files_to_modify:
  - 'playwright.config.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/fixtures/together-mode.ts'
  - 'tests/e2e/scripture/scripture-reconnect-4.3.spec.ts'
  - 'tests/e2e/auth/login.spec.ts'
  - 'tests/e2e/auth/google-oauth.spec.ts'
  - '.gitignore'
code_patterns:
  - 'AuthProvider interface from playwright-utils'
  - 'createAuthFixtures() for fixture composition'
  - 'getAuthToken() + getStorageStatePath() for multi-user contexts'
  - 'localStorage-based storage state (origins[], not cookies[])'
test_patterns:
  - 'Worker-isolated auth via userIdentifier = worker-{parallelIndex}'
  - 'Partner auth via getAuthToken(request, { userIdentifier: worker-N-partner })'
  - 'Unauthenticated tests via authSessionEnabled: false'
---

# Tech-Spec: Migrate Playwright Auth to playwright-utils auth-session

**Created:** 2026-03-04

## Overview

### Problem Statement

The project has a hand-rolled Playwright auth system (auth-setup.ts, worker-auth.ts) that duplicates functionality already provided by the `@seontechnologies/playwright-utils` auth-session library. The current system:
- Eagerly pre-generates ALL worker auth states every run (16+ sign-ins)
- Has no token caching/reuse across runs
- Has no token expiration handling
- Doesn't work with Playwright UI Mode (setup project doesn't run)
- Requires manual file path management for storage states

### Solution

Replace the hand-rolled auth with the library's `AuthProvider` + `createAuthFixtures()` + `globalSetup` pattern. Create a Supabase-specific auth provider that uses `signInWithPassword` and stores sessions in `localStorage` (via Playwright's `origins[]` storage state format). Use lazy token acquisition with caching so tokens are only fetched when needed and reused across runs until expired.

### Scope

**In Scope:**
- Create Supabase AuthProvider implementation
- Create globalSetup for user provisioning
- Migrate worker-auth fixture to createAuthFixtures()
- Migrate together-mode partner auth to getAuthToken()
- Update unauthenticated test patterns
- Remove old auth-setup.ts and worker-auth.ts

**Out of Scope:**
- Multi-environment support (only 'local' for now)
- CI-specific auth changes (CI env vars still work)
- Test factory/seeding changes (unrelated to auth)
- Migration of the ES256 JWT re-signing logic (stays in playwright.config.ts)

## Context for Development

### Codebase Patterns

- All E2E tests import `{ test, expect }` from `tests/support/merged-fixtures.ts`
- Auth is Supabase `signInWithPassword` — API-based, session in localStorage
- Storage key: `sb-{hostname}-auth-token` in localStorage
- App requires `lastWelcomeView` in localStorage to bypass WelcomeSplash
- Worker isolation: workerIndex % poolSize maps to unique user accounts
- Partner pairs: each worker has a user + partner for together-mode tests

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `tests/support/auth-setup.ts` | Current auth setup — user provisioning + storage state generation (will be replaced) |
| `tests/support/fixtures/worker-auth.ts` | Current worker auth fixture (will be replaced) |
| `tests/support/fixtures/together-mode.ts` | Together-mode fixture (will be modified) |
| `tests/support/merged-fixtures.ts` | Central fixture composition (will be modified) |
| `playwright.config.ts` | Config — ES256 logic + setup project (will be modified) |
| `tests/support/helpers/supabase.ts` | Supabase admin client helper (kept as-is) |
| `tests/support/factories/index.ts` | Test data factories (kept as-is) |
| `node_modules/@seontechnologies/playwright-utils/dist/esm/auth-session/fixtures.js` | Library fixture implementation (reference) |

### Technical Decisions

1. **localStorage, not cookies**: Supabase stores auth in localStorage. The provider's `manageAuthToken` returns a storage state with `origins[].localStorage[]`, not `cookies[]`. The library's `context` fixture passes the file path to `browser.newContext({ storageState })`, which Playwright handles natively.

2. **Lazy token acquisition**: Each worker acquires its token on first test via `manageAuthToken`. The library caches the storage state file at `.auth/local/worker-N/storage-state.json` and checks `isTokenExpired` before re-fetching on subsequent runs.

3. **Provider must be registered before createAuthFixtures()**: The library calls `getAuthProvider()` at module load time in `createAuthFixtures()`. The `initializeAuthSystem()` call must execute before any fixture import.

4. **Partner auth via getAuthToken()**: Together-mode calls `getAuthToken(request, { userIdentifier: 'worker-N-partner' })` to ensure the partner's storage state file exists, then passes `getStorageStatePath()` to `browser.newContext()`.

5. **ES256 re-signing preserved**: The JWT re-signing logic in `playwright.config.ts` (lines 10-68) sets env vars that `globalSetup` and the auth provider consume. It stays untouched.

## Implementation Plan

### Phase 1: Create Auth Provider + GlobalSetup (new system alongside old)

**Tasks:**

1. **Add `/.auth/` to `.gitignore`**
   - File: `.gitignore`
   - The library stores tokens at `{cwd}/.auth/local/{userIdentifier}/storage-state.json`

2. **Create Supabase auth provider**
   - New file: `tests/support/auth/supabase-auth-provider.ts`
   - Implements `AuthProvider` interface
   - `manageAuthToken`: signInWithPassword → build storage state with `origins[].localStorage[]` (including `lastWelcomeView`)
   - `isTokenExpired`: decode JWT base64url payload, check `exp` claim with 60s buffer
   - `extractToken`: find `sb-*-auth-token` in origins localStorage, parse JSON, return `access_token`
   - `extractCookies`: return `[]` (we use localStorage)
   - `getUserIdentifier`: return `options.userIdentifier` or `'default'`
   - `getEnvironment`: return `options.environment` or `'local'`
   - `getBaseUrl`: return `process.env.BASE_URL || 'http://localhost:5173'`
   - `clearToken`: delete storage state file
   - Private `userIdentifierToEmail()`: maps `worker-N` → `testworkerN@test.example.com`, `worker-N-partner` → `testworkerN-partner@test.example.com`

3. **Create auth initialization module**
   - New file: `tests/support/auth/setup.ts`
   - Exports `initializeAuthSystem()` — calls `setAuthProvider()` + `configureAuthSession()`
   - Idempotent (guards against double-init)

4. **Create globalSetup function**
   - New file: `tests/support/auth/global-setup.ts`
   - Extracts user provisioning from `auth-setup.ts` (ensureUser, getAppUserIdByEmail, linkUserPair)
   - Creates worker pool users + partner pairs
   - Links each pair in DB
   - Calls `authStorageInit()` for each user identifier (creates empty storage-state.json files)
   - Does NOT call `authGlobalInit()` (lazy approach)

5. **Add globalSetup to playwright.config.ts**
   - File: `playwright.config.ts`
   - Add `globalSetup: require.resolve('./tests/support/auth/global-setup')`
   - Keep "setup" project in place (both run during Phase 1)

6. **Verify Phase 1**: Run existing E2E tests — old system still primary, new system creates users + empty storage dirs

### Phase 2: Migrate Fixtures to createAuthFixtures()

**Tasks:**

7. **Create new auth fixture**
   - New file: `tests/support/fixtures/auth.ts`
   - Calls `initializeAuthSystem()` at top level (before createAuthFixtures)
   - Uses `createAuthFixtures()` for authToken, context, page fixtures
   - Overrides `authOptions` as worker-scoped fixture: maps `workerInfo.workerIndex % poolSize` → `worker-N`
   - Exposes `partnerUserIdentifier` fixture (worker-scoped): `worker-N-partner`

8. **Update merged-fixtures.ts**
   - Replace `workerAuthFixture` import with new `authFixture` from `./fixtures/auth`
   - Swap in the `mergeTests()` call

9. **Update together-mode fixture**
   - File: `tests/support/fixtures/together-mode.ts`
   - Replace `partnerStorageStatePath` dep with `partnerUserIdentifier` + `request`
   - Call `getAuthToken(request, { environment: 'local', userIdentifier: partnerUserIdentifier })` to ensure partner token exists
   - Use `getStorageStatePath({ environment: 'local', userIdentifier: partnerUserIdentifier })` for `browser.newContext()`

10. **Update scripture-reconnect manual context creation**
    - File: `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts`
    - Update `createPartnerContext()` to accept `request` + `partnerUserIdentifier` instead of `partnerStorageStatePath`
    - Use `getAuthToken()` + `getStorageStatePath()` pattern

11. **Verify Phase 2**: Run full E2E suite — new auth system active, old system still runs but unused

### Phase 3: Remove Old System

**Tasks:**

12. **Remove "setup" project from playwright.config.ts**
    - Delete `{ name: 'setup', ... }` project block
    - Remove `dependencies: ['setup']` from chromium and api projects

13. **Delete old auth files**
    - Delete: `tests/support/auth-setup.ts`
    - Delete: `tests/support/fixtures/worker-auth.ts`

14. **Verify Phase 3**: Run full E2E suite — only new system, no setup project

### Phase 4: Migrate Unauthenticated Test Patterns

**Tasks:**

15. **Update unauthenticated tests**
    - Files: `tests/e2e/auth/login.spec.ts`, `tests/e2e/auth/google-oauth.spec.ts`
    - Replace `test.use({ storageState: { cookies: [], origins: [] } })` with `test.use({ authSessionEnabled: false })`

16. **Final verification**: Run full E2E suite including auth tests

### Acceptance Criteria

**Given** the new auth provider is configured
**When** a Playwright worker starts its first test
**Then** the auth provider lazily signs in via Supabase API and caches the storage state

**Given** a cached storage state exists from a previous run
**When** the token has not expired
**Then** the provider reuses the cached token without making an API call

**Given** a together-mode test needs a partner context
**When** the fixture calls getAuthToken with the partner's userIdentifier
**Then** the partner's storage state is lazily acquired and the browser context is authenticated

**Given** a test uses `authSessionEnabled: false`
**When** the context fixture runs
**Then** no auth token is acquired and the browser context has no storage state

**Given** the old auth-setup.ts and worker-auth.ts are deleted
**When** the full E2E suite runs
**Then** all tests pass using only the new auth system

## Additional Context

### Dependencies

- `@seontechnologies/playwright-utils` (already installed)
- `@supabase/supabase-js` (already installed)
- Local Supabase must be running (`supabase start`)

### Testing Strategy

Each phase is independently verifiable:
- Phase 1: `npx playwright test tests/e2e/ --grep "mood tracker"` (basic smoke test)
- Phase 2: `npm run test:e2e` (full suite)
- Phase 3: `npm run test:e2e` (full suite, confirms no dependency on old system)
- Phase 4: `npx playwright test tests/e2e/auth/` (auth-specific tests)

### Notes

- The library stores files at `.auth/local/worker-N/storage-state.json` (root-level `.auth/`, NOT `tests/.auth/`)
- The ES256 JWT re-signing logic in playwright.config.ts lines 10-68 MUST be preserved — it sets env vars consumed by globalSetup and the auth provider
- `createAuthFixtures()` calls `getAuthProvider()` at import time — `initializeAuthSystem()` MUST run before this import
- Pool size calculation (max(cpus, 8)) is preserved from the old system for consistency
