---
title: 'Sprint 0 Test Factories'
slug: 'sprint-0-test-factories'
created: '2026-01-28'
status: 'ready-for-development'
stepsCompleted: [1, 2, 3]
part: '3 of 3'
parent_spec: 'Sprint 0 Test Infrastructure'
depends_on:
  - 'tech-spec-01-backend-infrastructure'
  - 'tech-spec-02-ci-pipeline'
tech_stack:
  - Playwright 1.57.0
  - TypeScript 5.9.3 (strict)
  - Vitest
  - fake-indexeddb
files_to_modify:
  - tests/support/factories/index.ts (CREATE)
  - tests/support/fixtures/index.ts (MODIFY)
  - tests/unit/services/dbSchema.test.ts (CREATE)
test_patterns:
  - fake-indexeddb for unit tests
  - Playwright fixtures pattern
  - Test factories calling Supabase RPCs
---

# Tech-Spec: Sprint 0 Test Factories (Part 3 of 3)

**Created:** 2026-01-28
**Depends On:** Part 1 (Backend Infrastructure - seeding RPC must exist), Part 2 (CI Pipeline - for running tests)
**Blocks:** P0 test implementation (Sprint 0 follow-on work)

## Overview

### Problem Statement

QA cannot create test data programmatically:
- No TypeScript factories to call the seeding RPC
- No Playwright fixtures for test setup/teardown
- No unit tests to validate IndexedDB schema changes

### Solution

Create test infrastructure for QA automation:

1. Test factories that call `scripture_seed_test_data()` RPC
2. Playwright fixtures for session setup/cleanup
3. Unit tests for dbSchema.ts upgrade function

### Scope

**In Scope:**
- Test factories (`createTestSession()`, `cleanupTestSession()`)
- Playwright fixtures (`testSession`, `supabaseAdmin`)
- dbSchema unit tests (fresh install, v4→v5 upgrade, indexes)

**Out of Scope:**
- P0 test implementation (25 tests — QA's follow-on work)
- Together mode broadcast channel testing
- Performance benchmarks

## Context for Development

### Codebase Patterns

**Test Structure:**
- Unit: `tests/unit/**` (Vitest + fake-indexeddb)
- E2E: `tests/e2e/**` (Playwright)
- Fixtures: `tests/support/fixtures/index.ts`
- Helpers: `tests/support/helpers/index.ts`
- Factories: `tests/support/factories/index.ts` (TO CREATE)

**Playwright Fixtures Pattern:**
```typescript
export const test = base.extend<CustomFixtures>({
  myFixture: async ({}, use) => {
    // Setup
    const resource = await create();
    await use(resource);
    // Teardown
    await cleanup(resource);
  },
});
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `tests/support/fixtures/index.ts` | Playwright fixtures (to extend) |
| `src/services/dbSchema.ts` | Schema to test (from Part 1) |
| `supabase/migrations/20260128000001_scripture_reading.sql` | RPC to call (from Part 1) |

### Technical Decisions

**TD-5: Test Factory Pattern**
- TypeScript functions that call Supabase RPCs
- Return typed results for test assertions
- Cleanup function for proper teardown

## Implementation Plan

### Tasks

#### Track 4: Test Factories (QA)

- [ ] **Task 4.1: Create test factories file**
  - File: `tests/support/factories/index.ts`
  - Action: Create new file with session and reflection factories
  - Details:
    ```typescript
    import { createClient, SupabaseClient } from '@supabase/supabase-js';

    export interface SeedResult {
      session_ids: string[];
      user_ids: string[];
      reflection_ids?: string[];
      message_ids?: string[];
    }

    export type SeedPreset = 'mid_session' | 'completed' | 'with_help_flags';

    export async function createTestSession(
      supabase: SupabaseClient,
      options?: {
        sessionCount?: number;
        includeReflections?: boolean;
        includeMessages?: boolean;
        preset?: SeedPreset;
      }
    ): Promise<SeedResult> {
      const { data, error } = await supabase.rpc('scripture_seed_test_data', {
        p_session_count: options?.sessionCount ?? 1,
        p_include_reflections: options?.includeReflections ?? false,
        p_include_messages: options?.includeMessages ?? false,
        p_preset: options?.preset ?? null,
      });

      if (error) throw new Error(`Seeding failed: ${error.message}`);
      return data as SeedResult;
    }

    export async function cleanupTestSession(
      supabase: SupabaseClient,
      sessionIds: string[]
    ): Promise<void> {
      // Delete in order: messages → reflections → bookmarks → step_states → sessions
      for (const id of sessionIds) {
        await supabase.from('scripture_messages').delete().eq('session_id', id);
        await supabase.from('scripture_reflections').delete().eq('session_id', id);
        await supabase.from('scripture_bookmarks').delete().eq('session_id', id);
        await supabase.from('scripture_step_states').delete().eq('session_id', id);
        await supabase.from('scripture_sessions').delete().eq('id', id);
      }
    }
    ```

- [ ] **Task 4.2: Add session fixture to Playwright fixtures**
  - File: `tests/support/fixtures/index.ts`
  - Action: Add `testSession` fixture that uses factory
  - Details:
    ```typescript
    import { test as base } from '@playwright/test';
    import { createClient } from '@supabase/supabase-js';
    import { createTestSession, cleanupTestSession, SeedResult } from '../factories';

    type CustomFixtures = {
      testSession: SeedResult;
      supabaseAdmin: ReturnType<typeof createClient>;
    };

    export const test = base.extend<CustomFixtures>({
      supabaseAdmin: async ({}, use) => {
        const client = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await use(client);
      },

      testSession: async ({ supabaseAdmin }, use) => {
        const result = await createTestSession(supabaseAdmin);
        await use(result);
        await cleanupTestSession(supabaseAdmin, result.session_ids);
      },
    });

    export { expect } from '@playwright/test';
    ```

#### Track 5: Validation Tests (QA)

- [ ] **Task 5.1: Create dbSchema unit tests**
  - File: `tests/unit/services/dbSchema.test.ts`
  - Action: Create tests for upgradeDb function
  - Details:
    ```typescript
    import { describe, it, expect, beforeEach } from 'vitest';
    import 'fake-indexeddb/auto';
    import { openDB } from 'idb';
    import { DB_NAME, DB_VERSION, upgradeDb, MyLoveDBSchema } from '../../../src/services/dbSchema';

    describe('dbSchema', () => {
      beforeEach(() => {
        // Clear IndexedDB between tests
        indexedDB.deleteDatabase(DB_NAME);
      });

      it('should create all stores on fresh install', async () => {
        const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
          upgrade: upgradeDb,
        });

        expect(db.objectStoreNames).toContain('messages');
        expect(db.objectStoreNames).toContain('photos');
        expect(db.objectStoreNames).toContain('moods');
        expect(db.objectStoreNames).toContain('sw-auth');
        expect(db.objectStoreNames).toContain('scripture-sessions');
        expect(db.objectStoreNames).toContain('scripture-reflections');
        expect(db.objectStoreNames).toContain('scripture-bookmarks');
        expect(db.objectStoreNames).toContain('scripture-messages');

        db.close();
      });

      it('should upgrade from v4 to v5 adding scripture stores', async () => {
        // First, create v4 database
        const dbV4 = await openDB(DB_NAME, 4, {
          upgrade(db) {
            db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
            db.createObjectStore('moods', { keyPath: 'id', autoIncrement: true });
            db.createObjectStore('sw-auth', { keyPath: 'id' });
          },
        });
        dbV4.close();

        // Upgrade to v5
        const dbV5 = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
          upgrade: upgradeDb,
        });

        expect(dbV5.objectStoreNames).toContain('scripture-sessions');
        expect(dbV5.objectStoreNames).toContain('scripture-reflections');

        dbV5.close();
      });

      it('should have correct indexes on scripture stores', async () => {
        const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
          upgrade: upgradeDb,
        });

        const tx = db.transaction('scripture-sessions', 'readonly');
        const store = tx.objectStore('scripture-sessions');
        expect(store.indexNames).toContain('by-user');

        db.close();
      });
    });
    ```

### Acceptance Criteria

#### AC-5: Test Factories Create Usable Data
- [ ] **AC-5.1**: Given a Supabase client, when `createTestSession()` is called, then it returns a `SeedResult` with valid session IDs
- [ ] **AC-5.2**: Given a test uses the `testSession` fixture, when the test completes, then the fixture cleans up all created data
- [ ] **AC-5.3**: Given `preset: 'mid_session'`, when `createTestSession()` is called, then the returned session is at step 7

#### AC-6: Unit Tests Validate Schema
- [ ] **AC-6.1**: Given the dbSchema tests, when `npm run test:unit` executes, then all tests pass
- [ ] **AC-6.2**: Given a fresh IndexedDB, when upgradeDb runs, then all 8 stores are created
- [ ] **AC-6.3**: Given a v4 database, when upgradeDb runs, then scripture stores are added

## Dependencies

**Depends On:**
- Part 1: `scripture_seed_test_data()` RPC must exist
- Part 1: `upgradeDb()` function must be exported from dbSchema.ts
- Part 2: CI pipeline should be ready for running tests

**Sequential Dependencies within this spec:**
1. Task 4.1 (factories) → Task 4.2 (fixtures) — factories must exist for fixtures to import
2. Task 5.1 can run in parallel with Track 4

**External Dependencies:**
- `fake-indexeddb` npm package for unit tests
- `SUPABASE_SERVICE_ROLE_KEY` for test fixtures (local only, not production key)

## Testing Strategy

**Unit Tests (Vitest + fake-indexeddb):**
- `tests/unit/services/dbSchema.test.ts` — upgradeDb creates all stores, handles v4→v5 upgrade
- Run with `npm run test:unit`

**Integration Tests:**
- Test factory → RPC integration (requires running Supabase Local)
- Run locally with `supabase start && npm run test:e2e`

**Validation Commands:**
```bash
# Run unit tests
npm run test:unit

# Run with Supabase Local
supabase start
supabase db reset
npm run test:e2e
supabase stop
```

## Notes

**Sprint 0 Exit Criteria (from sprint-0-commitments.md):**
1. Seeding works: `scripture_seed_test_data()` returns valid session IDs (Part 1)
2. CI runs: GitHub Actions executes Playwright tests with Supabase Local (Part 2)
3. P0 ready: 25 P0 test files exist with proper structure (follow-on work, out of scope)
4. Green build: CI pipeline passes with at least 1 actual test (this spec enables it)

**Follow-On Work (Post-Sprint 0):**
- Implement 25 P0 tests using these factories and fixtures
- Add more preset options as test scenarios require
- Consider adding factory for Together mode sessions
