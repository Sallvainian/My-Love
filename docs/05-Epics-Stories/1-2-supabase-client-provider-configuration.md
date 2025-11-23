# Story 1.2: Supabase Client & Provider Configuration

**Epic**: 1 - PWA Foundation Audit & Stabilization
**Story ID**: 1.2
**Status**: ready-for-dev
**Created**: 2025-11-23

---

## User Story

**As a** developer,
**I want** to validate the Supabase client configuration and Zustand store persistence,
**So that** I can ensure the backend connection is properly established and client state persists correctly across sessions.

---

## Context

This is the second story of Epic 1, building on the codebase audit completed in Story 1.1. With the build process validated and all dependencies audited, this story focuses on verifying the Supabase backend integration and Zustand state management work correctly.

**Epic Goal**: Audit existing codebase, fix bugs, repair deployment, ensure stable foundation
**User Value**: Reliable backend connection ensuring data persistence and proper authentication setup

**Dependencies**:
- Story 1.1: Codebase Audit & Dependency Validation (DONE) - Build passes, dependencies validated
- Epic 0 Complete: GitHub Actions pipeline, Supabase connection established

**Prerequisite from Architecture**:
- Supabase project exists at `VITE_SUPABASE_URL`
- Environment variables configured with `VITE_` prefix for Vite compatibility
- Zustand 5.0.8 with persist middleware available

---

## Acceptance Criteria

| AC ID | Criteria | Validation Method |
|-------|----------|-------------------|
| **AC-1.2.1** | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` accessible via `import.meta.env` | **Code Inspection**: Verify env vars load correctly in supabase client initialization |
| **AC-1.2.2** | `.env` file exists and is listed in `.gitignore` | **File Inspection**: Check `.gitignore` includes `.env*` patterns |
| **AC-1.2.3** | No `SUPABASE_SERVICE_ROLE_KEY` in any VITE_ prefixed variable | **Security Audit**: Search codebase for exposed service keys |
| **AC-1.2.4** | `supabase.auth.getSession()` returns null or valid Session object (no errors) | **Runtime Test**: Call getSession() and verify clean response without errors |
| **AC-1.2.5** | Zustand stores configured with `persist` middleware (check store source code) | **Code Inspection**: Verify persist middleware in store definitions |
| **AC-1.2.6** | Zustand state survives page reload (store data in localStorage/IndexedDB) | **Browser Test**: Set state, reload page, verify state persists |
| **AC-1.2.7** | Test query to Supabase table returns 403 (RLS enabled) or filtered data (policies exist) | **API Test**: Query Supabase table and verify RLS response |

---

## Implementation Tasks

### **Task 1: Validate Environment Variable Configuration** (AC-1.2.1, AC-1.2.2, AC-1.2.3)
**Goal**: Ensure environment variables are properly configured and secure

- [ ] **1.1** Verify `.env` file exists in project root
  - Check: `.env` or `.env.local` present
  - Expected: File exists with Supabase credentials
- [ ] **1.2** Confirm `.gitignore` excludes environment files
  - Check: `.gitignore` contains `.env*` or equivalent patterns
  - Expected: Environment files not committed to repository
- [ ] **1.3** Verify `VITE_SUPABASE_URL` is properly set
  - Check: `import.meta.env.VITE_SUPABASE_URL` returns valid URL
  - Format: `https://xxx.supabase.co`
- [ ] **1.4** Verify `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is set
  - Check: `import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` returns anon key
  - Format: `eyJ...` (JWT format)
- [ ] **1.5** Security audit: Search for exposed service keys
  - Command: `grep -r "SUPABASE_SERVICE" --include="*.ts" --include="*.tsx" --include="*.env*" .`
  - Expected: No `SUPABASE_SERVICE_ROLE_KEY` in VITE_ prefixed variables
- [ ] **1.6** Verify `.env.example` exists with placeholder values
  - Check: Template file for new developers
  - Expected: Contains variable names without real values

### **Task 2: Validate Supabase Client Initialization** (AC-1.2.4)
**Goal**: Ensure Supabase client connects without errors

- [ ] **2.1** Inspect `src/lib/supabase.ts` client configuration
  - Check: `createClient()` called with env vars
  - Check: Auth options configured (persistSession, autoRefreshToken, detectSessionInUrl)
- [ ] **2.2** Verify client initialization completes without errors
  - Method: Import supabase client, check console for errors
  - Expected: No runtime errors on import
- [ ] **2.3** Test `supabase.auth.getSession()` call
  - Method: Call getSession() in browser console or test
  - Expected: Returns `{ data: { session: null | Session }, error: null }`
- [ ] **2.4** Verify auth state change listener works
  - Check: `onAuthStateChange` callback registered
  - Expected: Fires on session changes without errors

### **Task 3: Validate Zustand Store Persistence** (AC-1.2.5, AC-1.2.6)
**Goal**: Ensure Zustand stores persist state across sessions

- [ ] **3.1** Inspect Zustand store definitions in `src/stores/`
  - Check: Stores use `persist()` middleware
  - Expected: `persist((set) => ({ ... }), { name: 'store-name' })`
- [ ] **3.2** Verify authStore persistence configuration
  - File: `src/stores/authStore.ts`
  - Check: Persist middleware with appropriate storage adapter
- [ ] **3.3** Verify userStore/settingsStore persistence
  - Files: `src/stores/userStore.ts`, `src/stores/settingsStore.ts`
  - Check: All relevant stores persist to localStorage or IndexedDB
- [ ] **3.4** Test state persistence across page reload
  - Method: Set state value → Refresh page → Verify state retained
  - Expected: State survives browser reload
- [ ] **3.5** Verify localStorage/IndexedDB keys created
  - Method: DevTools → Application → Local Storage
  - Expected: Store keys present (e.g., `auth-storage`, `user-prefs-storage`)

### **Task 4: Validate Row Level Security (RLS) Policies** (AC-1.2.7)
**Goal**: Confirm RLS is enabled and functioning

- [ ] **4.1** Identify test table for RLS validation
  - Check: Supabase dashboard for existing tables
  - Expected: At least one table with RLS enabled
- [ ] **4.2** Test unauthenticated query behavior
  - Method: Query table without auth context
  - Expected: Returns 403 or empty result (not all data)
- [ ] **4.3** Test authenticated query behavior (if session available)
  - Method: Query with valid session
  - Expected: Returns filtered data per RLS policies
- [ ] **4.4** Document RLS status
  - If RLS not configured: Document gap with remediation plan
  - If RLS works: Document verified tables and policies

---

## Dev Notes

### Architecture Patterns and Constraints

**Technology Stack** (from [tech-spec-epic-1.md](./tech-spec-epic-1.md)):
- **Supabase**: 2.81+ - Auth, Database, Realtime backend
- **Zustand**: 5.0.8 - Client state management with persistence
- **Environment Variables**: Must use `VITE_` prefix for Vite compatibility
- **Storage**: localStorage/IndexedDB for client-side persistence

**Expected Module Structure**:
```
src/
├── lib/
│   ├── supabase.ts          # Supabase client configuration (THIS STORY)
│   └── env.ts               # Environment variable validation (if exists)
├── stores/
│   ├── authStore.ts         # Auth session persistence (THIS STORY)
│   ├── userStore.ts         # User preferences persistence
│   └── index.ts             # Zustand store exports
```

**Supabase Client Configuration Pattern**:
```typescript
// Expected configuration in src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storage: localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Critical for magic link handling
  },
});
```

**Zustand Persist Pattern**:
```typescript
// Expected pattern in stores
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // state and actions
    }),
    { name: 'auth-storage' }
  )
);
```

### Project Structure Notes

**Alignment with Existing Structure**:
- Supabase client at `src/lib/supabase.ts` per architecture doc
- Stores in `src/stores/` directory with persist middleware
- Environment variables use `VITE_` prefix per Vite convention

**Security Constraints** (from [tech-spec-epic-1.md](./tech-spec-epic-1.md#security)):
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` must be anon key (safe to expose in client)
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be in any VITE_ prefixed variable
- `.env` file must be listed in `.gitignore`
- Auth tokens stored in localStorage (acceptable for SPAs)

### Learnings from Previous Story

**From Story 1-1-codebase-audit-dependency-validation (Status: done)**

**Validated Infrastructure**:
- **Build Process**: `npm run build` succeeds, bundle 221.01KB gzipped
- **TypeScript**: Strict mode enforced, zero type errors
- **ESLint**: 0 errors, 11 warnings (React 19 rules downgraded to warnings)
- **PWA Configuration**: Service worker and manifest validated
- **Smoke Tests**: 15/15 passing including bundle size validation

**ESLint Configuration Change**:
- `eslint.config.js` modified: `react-hooks/set-state-in-effect` and `react-hooks/purity` set to warn
- Reason: Legitimate patterns (blob URL lifecycle, timer setup, animation randomization)

**Files Modified in Story 1.1**:
- `eslint.config.js` - React 19 rule overrides
- `src/sw-types.d.ts` - ESLint disable comment
- `tests/support/fixtures/monitoredTest.ts` - ESLint disable comment

**Technical Debt Noted**:
- 38 failing PokeKissInterface tests (pre-existing, tracked separately)
- React 19 lint warnings should be monitored - avoid accumulating new setState-in-effect patterns

**Patterns to REUSE**:
- Smoke tests at `scripts/smoke-tests.cjs` for validation
- Health check patterns for deployment verification

[Source: docs/05-Epics-Stories/1-1-codebase-audit-dependency-validation.md#Dev-Agent-Record]

### References

**Source Documents**:
- **Epic Source**: [docs/05-Epics-Stories/tech-spec-epic-1.md](./tech-spec-epic-1.md) - Story 1.2 acceptance criteria
- **Architecture**: [docs/02-Architecture/architecture.md](../02-Architecture/architecture.md) - Supabase and Zustand patterns
- **Previous Story**: [docs/05-Epics-Stories/1-1-codebase-audit-dependency-validation.md](./1-1-codebase-audit-dependency-validation.md) - Build validation

**Key Functional Requirements Covered**:
- **FR62**: App persists user preferences locally via localStorage/IndexedDB (Zustand persistence validation)
- **FR65**: Auto-reconnect and data sync (Supabase client configuration)

**Tech Spec Acceptance Criteria Mapping**:
- AC-1.2.1 → Tech Spec AC1.2.1 (VITE_SUPABASE_URL and key accessibility)
- AC-1.2.2 → Tech Spec AC1.2.2 (.env in .gitignore)
- AC-1.2.3 → Tech Spec AC1.2.3 (No service key exposure)
- AC-1.2.4 → Tech Spec AC1.2.4 (getSession() works)
- AC-1.2.5 → Tech Spec AC1.2.5 (Zustand persist middleware)
- AC-1.2.6 → Tech Spec AC1.2.6 (State survives reload)
- AC-1.2.7 → Tech Spec AC1.2.7 (RLS policy test)

---

## Dev Agent Record

### Context Reference

- [1-2-supabase-client-provider-configuration.context.xml](./1-2-supabase-client-provider-configuration.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-23 | Dev Agent (BMad Workflow) | Story created from tech-spec-epic-1.md via create-story workflow |
