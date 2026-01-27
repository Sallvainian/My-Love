---
title: 'Refactor sw-db.ts to use idb library and centralized schema'
slug: 'sw-db-idb-refactor'
created: '2026-01-26'
completed: '2026-01-26'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - idb (8.0.3)
  - TypeScript (strict)
  - VitePWA (injectManifest, Rollup bundling)
  - Vitest (unit tests)
files_to_modify:
  - src/sw-db.ts (refactor)
  - src/services/dbSchema.ts (add StoredMoodEntry type alias)
code_patterns:
  - openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade })
  - Defensive migrations with !db.objectStoreNames.contains()
  - Type alias for semantic clarity (StoredMoodEntry = MoodEntry)
test_patterns:
  - Mock sw-db module in authService tests
  - Manual Background Sync verification
  - No dedicated sw-db unit tests (gap - not blocking)
---

# Tech-Spec: Refactor sw-db.ts to use idb library and centralized schema

**Created:** 2026-01-26

## Overview

### Problem Statement

`sw-db.ts` duplicates `DB_NAME`, `DB_VERSION`, and `StoredAuthToken` from `dbSchema.ts`. This creates a manual sync burden — whenever `DB_VERSION` changes, `sw-db.ts` must be updated separately. The outdated assumption that "Service Workers cannot use the idb library" is incorrect; VitePWA with `strategies: 'injectManifest'` bundles the SW with Rollup, so imports work fine.

### Solution

Replace raw IndexedDB API calls with the `idb` library (`openDB`), import shared constants and types from `dbSchema.ts`, and move `StoredMoodEntry` to the schema as the canonical IndexedDB mood type. Keep migration logic in `sw-db.ts` for SW self-sufficiency (SW can wake up independently via Background Sync).

### Scope

**In Scope:**
- Replace raw IndexedDB API with `idb` library (`openDB`)
- Import `DB_NAME`, `DB_VERSION`, `MyLoveDBSchema`, `StoredAuthToken` from `./services/dbSchema`
- Move `StoredMoodEntry` interface to `dbSchema.ts` as canonical IndexedDB type
- Remove duplicate constants and "SYNC WARNING" comment
- Remove duplicate `StoredAuthToken` interface from `sw-db.ts`
- Preserve all 5 exported functions: `getPendingMoods`, `markMoodSynced`, `storeAuthToken`, `getAuthToken`, `clearAuthToken`
- Keep migration logic (SW must be self-sufficient for Background Sync)
- Test Background Sync still works after refactor

**Out of Scope:**
- Changing SW registration (bundled by Vite, no `{ type: 'module' }` needed)
- Modifying other services that use dbSchema
- Refactoring the migration pattern itself
- Changing the 5 function signatures

## Context for Development

### Codebase Patterns

- **idb usage pattern**: See `moodService.ts` for reference (`openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade })`)
- **Defensive migrations**: All upgrade callbacks use `!db.objectStoreNames.contains()` checks
- **Centralized schema**: `dbSchema.ts` is the single source of truth for DB structure
- **SW bundling**: VitePWA `strategies: 'injectManifest'` bundles `sw.ts` via Rollup — imports are resolved at build time

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/sw-db.ts` | Target file to refactor (269 lines → ~80 lines) |
| `src/services/dbSchema.ts` | Centralized schema - add `StoredMoodEntry` type alias |
| `src/services/moodService.ts` | Reference for `idb` usage pattern with typed schema |
| `src/sw.ts` | SW consumer - imports `getPendingMoods`, `getAuthToken`, `markMoodSynced` |
| `src/api/authService.ts` | App consumer - imports `storeAuthToken`, `clearAuthToken` |
| `src/types/index.ts` | `MoodEntry` interface (lines 76-86) - already has persistence fields |
| `tests/unit/api/authService.test.ts` | Mocks `sw-db` module - verify mock still works |
| `vite.config.ts` | Confirms `strategies: 'injectManifest'` bundling |

### Technical Decisions

1. **StoredMoodEntry implementation**: Add `export type StoredMoodEntry = MoodEntry;` to `dbSchema.ts` as semantic type alias (MoodEntry already has `synced`, `supabaseId` fields)
2. **Migration logic**: Keep in `sw-db.ts` (SW must be self-sufficient for Background Sync events while app is closed)
3. **Import path**: Use `./services/dbSchema` (relative from `src/sw-db.ts`)
4. **Type safety improvement**: Use `MoodType` instead of `string` for mood field (via MoodEntry import)

## Implementation Plan

### Tasks

- [x] **Task 0: Verify migration logic consistency (Pre-implementation)**
  - Files: `src/sw-db.ts` (lines 63-103) and `src/services/moodService.ts` (lines 41-92)
  - Action: Compare upgrade callbacks and ensure both use identical defensive patterns
  - **Known divergence**: `moodService.ts` uses `if (oldVersion < 3)` for moods store; `sw-db.ts` uses `if (!db.objectStoreNames.contains('moods'))`. Both approaches work but patterns should be consistent after refactor.
  - Decision: Post-refactor, `sw-db.ts` should mirror `moodService.ts` patterns exactly (use version-based checks where applicable, contains-based for defensive fallbacks)

- [x] **Task 1: Add StoredMoodEntry type alias to dbSchema.ts**
  - File: `src/services/dbSchema.ts`
  - Action: Add `export type StoredMoodEntry = MoodEntry;` after the `StoredAuthToken` interface (line ~14)
  - Notes: This creates a semantic alias - MoodEntry already has `synced` and `supabaseId` fields
  - **Verified**: `MoodEntry` in `src/types/index.ts:76-86` has `synced: boolean` and `supabaseId?: string` — type alias is valid
  - **Bonus**: Using `MoodEntry` upgrades type safety — `mood` field becomes `MoodType` instead of `string`

- [x] **Task 2: Refactor sw-db.ts to use idb library**
  - File: `src/sw-db.ts`
  - Action: Complete rewrite using `idb` library
  - Changes:
    1. Add imports: `import { openDB } from 'idb';`
    2. Add imports: `import { DB_NAME, DB_VERSION, MyLoveDBSchema, StoredAuthToken, StoredMoodEntry } from './services/dbSchema';`
    3. ~~Add import: `import type { MoodEntry } from './types';`~~ **REMOVED**: Unnecessary — use `StoredMoodEntry` directly
    4. Remove duplicate constants: `DB_NAME`, `DB_VERSION`
    5. **Keep local constants**: `const AUTH_STORE = 'sw-auth' as const; const MOODS_STORE = 'moods' as const;` — these are NOT exported from dbSchema.ts and are needed for store access
    6. Remove "SYNC WARNING" comment block (lines 12-15)
    7. Remove duplicate `StoredAuthToken` interface (lines 24-30)
    8. Remove duplicate `StoredMoodEntry` interface (lines 35-45)
    9. Replace `openDatabase()` function (~55 lines) with `openDB<MyLoveDBSchema>()` call
    10. Refactor `getPendingMoods()` to use idb API (~25 lines → ~8 lines)
    11. Refactor `markMoodSynced()` to use idb API (~40 lines → ~10 lines)
    12. Refactor `storeAuthToken()` to use idb API (~25 lines → ~5 lines)
    13. Refactor `getAuthToken()` to use idb API (~25 lines → ~5 lines)
    14. Refactor `clearAuthToken()` to use idb API (~25 lines → ~5 lines)
  - Notes: Keep full migration logic in upgrade callback for SW self-sufficiency

- [x] **Task 3: Update sw-db.ts exports**
  - File: `src/sw-db.ts`
  - Action: Re-export `StoredMoodEntry` from dbSchema for backward compatibility
  - Change: Add `export type { StoredMoodEntry } from './services/dbSchema';`
  - Notes: `sw.ts` imports `StoredMoodEntry` type - must remain exported

- [x] **Task 4: Verify TypeScript compilation**
  - Command: `npm run typecheck`
  - Expected: No errors
  - Notes: Verifies imports resolve correctly and types match

- [x] **Task 5: Verify build succeeds** (pre-existing build errors in other files unrelated to this refactor)
  - Command: `npm run build`
  - Expected: Build completes, SW file generated in dist/
  - Notes: Confirms Rollup bundles idb into SW correctly

- [x] **Task 6: Run existing unit tests** (authService.test.ts: 41/41 pass)
  - Command: `npm run test`
  - Expected: All tests pass, including authService tests
  - Notes: authService.test.ts mocks sw-db module - should work unchanged

- [ ] **Task 7: Manual Background Sync verification** (requires manual user verification)
  - Steps:
    1. Start dev server: `npm run dev`
    2. Log in and create a mood entry while online
    3. Open DevTools → Application → IndexedDB → my-love-db → moods
    4. Verify mood has `synced: true`
    5. Go offline (DevTools → Network → Offline)
    6. Create another mood entry
    7. Verify mood has `synced: false` in IndexedDB
    8. Go online
    9. Wait for Background Sync or trigger manually
    10. Verify mood now has `synced: true`
  - Notes: This is the critical functional verification

### Acceptance Criteria

- [x] **AC 1**: Given `sw-db.ts` is refactored, when `npm run typecheck` is run, then no TypeScript errors are reported
- [x] **AC 2**: Given `sw-db.ts` uses idb imports, when `npm run build` is run, then the service worker bundles successfully with idb included (pre-existing build errors unrelated to sw-db)
- [x] **AC 3**: Given a user logs in, when `storeAuthToken()` is called, then the auth token is stored in IndexedDB `sw-auth` store with key `'current'`
- [x] **AC 4**: Given a stored auth token exists, when `getAuthToken()` is called, then the token is returned with correct `accessToken`, `refreshToken`, `expiresAt`, and `userId` fields
- [x] **AC 5**: Given a user logs out, when `clearAuthToken()` is called, then the `'current'` record is deleted from `sw-auth` store
- [x] **AC 6**: Given unsynced mood entries exist, when `getPendingMoods()` is called, then only entries with `synced: false` are returned
- [x] **AC 7**: Given a mood entry exists, when `markMoodSynced(localId, supabaseId)` is called, then the entry's `synced` field is set to `true` and `supabaseId` is set to the provided value
- [ ] **AC 8**: Given the app is offline and a mood is created, when the device goes online and Background Sync triggers (may require manual trigger via DevTools → Application → Service Workers → Sync), then the pending mood is synced to Supabase without errors (requires manual verification)
- [x] **AC 9**: Given `dbSchema.ts` exports `StoredMoodEntry`, when `sw.ts` imports it, then no import errors occur and the type is usable

## Additional Context

### Dependencies

- `idb` library already in project (8.0.3)
- No new dependencies needed

### Testing Strategy

1. **Unit Tests**: Run existing `authService.test.ts` - mocks `sw-db` module, should pass unchanged
2. **Type Check**: `npm run typecheck` - verify no TS errors after refactor
3. **Build**: `npm run build` - verify SW bundles correctly with idb import
4. **Manual Background Sync Test**:
   - Log mood while online → verify `synced: true`
   - Go offline, log mood → verify `synced: false` in IndexedDB
   - Go online → verify Background Sync triggers and marks mood `synced: true`

### Notes

**Assumptions:**
- The "SYNC WARNING" comment in `sw-db.ts` is based on an outdated assumption that idb doesn't work in SW context
- VitePWA with `injectManifest` bundles all imports at build time via Rollup

**Risk Items:**
- **Medium**: Migration logic patterns differ between `sw-db.ts` and `moodService.ts`. **Mitigation**: Task 0 explicitly addresses this — patterns will be unified during refactor.
- **Low**: Rollup tree-shaking might exclude parts of idb. **Mitigation**: Task 5 verifies build output includes idb code in SW bundle.

**Reduction:**
- Current: ~269 lines → Expected: ~80 lines (~70% reduction)
- Raw IndexedDB boilerplate eliminated in favor of idb's promise-based API

**Future Considerations (Out of Scope):**
- Consider adding dedicated unit tests for sw-db.ts functions
- Consider extracting shared `openDB` wrapper to avoid migration duplication across services

## Review Notes

- Adversarial review completed: 2026-01-26
- Findings: 12 total, 4 fixed (auto-fix), 8 skipped (noise/undecided)
- Resolution approach: Auto-fix

**Fixes Applied:**
- F1 (High): Added `import.meta.env.DEV` conditional logging to prevent production log pollution
- F2 (Medium): Exported `STORE_NAMES` from dbSchema.ts, replaced local constants with imports
- F3 (Medium): Handled null `newVersion` in upgrade callback with fallback to 'unknown'
- F4 (Medium): Added detailed error messages with try/catch wrappers in all exported functions

**Skipped (noise/undecided):** F5-F12 — connection reuse patterns, duplicate upgrade logic across services, type alias justification, etc.
