---
title: 'Sprint 0 Test Infrastructure'
slug: 'sprint-0-test-infrastructure'
created: '2026-01-28'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3]
tech_stack:
  - Supabase PostgreSQL 17
  - Supabase CLI (supabase start/stop/db reset)
  - GitHub Actions
  - IndexedDB (idb 8.0.3)
  - Playwright 1.57.0
  - TypeScript 5.9.3 (strict)
  - Zod 4.3.5
files_to_modify:
  - supabase/migrations/20260128_scripture_reading.sql (CREATE)
  - tests/support/factories/index.ts (CREATE)
  - tests/unit/services/dbSchema.test.ts (CREATE)
  - src/services/dbSchema.ts (MODIFY)
  - src/services/moodService.ts (MODIFY)
  - src/services/customMessageService.ts (MODIFY)
  - src/services/photoStorageService.ts (MODIFY)
  - .github/workflows/test.yml (MODIFY)
  - tests/support/fixtures/index.ts (MODIFY)
code_patterns:
  - BaseIndexedDBService extends pattern
  - Supabase RLS session-based access
  - Zustand selector pattern
  - Security definer functions for RLS
  - Conventional commits
test_patterns:
  - fake-indexeddb for unit tests
  - Playwright fixtures pattern
  - Test factories calling Supabase RPCs
  - dotenvx for encrypted env vars
---

# Tech-Spec: Sprint 0 Test Infrastructure

**Created:** 2026-01-28

## Overview

### Problem Statement

QA automation is blocked by 3 high-priority risks identified in the test risk assessment:

- **R-001 (Score 9)**: No seeding mechanism — tests cannot create valid session data with proper FK relationships
- **R-002 (Score 6)**: No Supabase Local in CI — E2E tests have no database to run against
- **R-008 (Score 2)**: IndexedDB version flakiness — `VersionError` crashes test runs when services use different DB versions

Without resolving these blockers, the QA team cannot develop or run automated tests for the Scripture Reading feature.

### Solution

Implement foundational test infrastructure across Backend, DevOps, and QA tracks:

1. Create Supabase migration with scripture tables, RLS policies, and seeding RPC
2. Implement `scripture_seed_test_data()` RPC with environment guard
3. Verify and extend dbSchema.ts centralization (bump to v5 with scripture stores)
4. Add Supabase Local lifecycle to GitHub Actions CI pipeline
5. Create test factories that call the seeding RPC

### Scope

**In Scope:**
- Supabase migration file (scripture tables + RLS policies + seeding RPC)
- `scripture_seed_test_data()` RPC with `mid_session`, `completed`, `with_help_flags` presets
- Environment guard (reject seed calls in production)
- dbSchema.ts verification (ensure all services import from centralized schema)
- dbSchema.ts v5 upgrade with 4 scripture IndexedDB stores
- Supabase Local CI lifecycle (start → reset → seed → test → stop)
- Test factories (`createTestSession()`, `createTestReflection()`)
- Caching validation tests for IndexedDB

**Out of Scope:**
- P0 test implementation (25 tests — QA's follow-on work in Sprint 0)
- Together mode broadcast channel testing (needs separate spec)
- Performance benchmarks (R-007, deferred to nightly)
- Race condition tests (R-003, Sprint 1)

## Context for Development

### Codebase Patterns

**IndexedDB Service Pattern:**
- All services extend `BaseIndexedDBService<T, DBTypes, StoreName>`
- Services implement `getStoreName()` and `_doInit()`
- Currently each service has DUPLICATE upgrade logic (creates all stores as fallback)
- Tech debt: Upgrade logic should be centralized in `dbSchema.ts`

**Supabase Migration Pattern:**
- Wrap in `BEGIN;` / `COMMIT;` transaction
- Enable RLS on all tables: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Use `SECURITY DEFINER` functions for cross-user lookups
- RPCs as SQL functions (not edge functions)

**RLS Pattern (Session-Based Access):**
```sql
CREATE POLICY "scripture_[table]_select" ON scripture_[table]
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM scripture_sessions
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );
```

**Test Structure:**
- Unit: `tests/unit/**` (Vitest + fake-indexeddb)
- E2E: `tests/e2e/**` (Playwright)
- Fixtures: `tests/support/fixtures/index.ts`
- Helpers: `tests/support/helpers/index.ts`
- Factories: `tests/support/factories/index.ts` (TO CREATE)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/services/dbSchema.ts` | Centralized IndexedDB schema (v4 → v5) |
| `src/services/BaseIndexedDBService.ts` | Abstract base class for IndexedDB services |
| `src/services/moodService.ts` | Example service with duplicate upgrade logic |
| `supabase/migrations/20251203000001_create_base_schema.sql` | Migration pattern reference |
| `supabase/config.toml` | Supabase Local config (`[db.seed]` section) |
| `.github/workflows/test.yml` | CI pipeline to modify |
| `tests/support/fixtures/index.ts` | Playwright fixtures (empty template) |
| `_bmad-output/planning-artifacts/architecture.md` | Scripture tables + RPC specs |

### Technical Decisions

**TD-1: Centralize IndexedDB Upgrade Logic**
- Export `upgradeDb(db, oldVersion)` function from `dbSchema.ts`
- All services call this shared function instead of duplicating upgrade logic

**TD-2: Scripture IndexedDB Stores (v5)**
- 4 new stores: scriptureSessions, scriptureReflections, scriptureBookmarks, scriptureMessages
- All use `keyPath: 'id'` with appropriate indexes

**TD-3: Seeding RPC Environment Guard**
- Check `current_setting('app.environment', true)` in RPC
- Reject with error if environment = 'production'

**TD-4: CI Supabase Lifecycle**
- Order: start → reset → test → stop
- Add as new job that runs before e2e-tests

**TD-5: Test Factory Pattern**
- TypeScript functions that call Supabase RPCs
- Return typed results for test assertions

## Implementation Plan

### Tasks

#### Track 1: Supabase Migration (Backend)

- [x] **Task 1.1: Create scripture tables migration**
  - File: `supabase/migrations/20260128_scripture_reading.sql`
  - Action: Create new migration file with 5 tables
  - Details:
    - `scripture_sessions` table with: id (UUID PK), mode (enum 'solo'|'together'), user1_id (FK users), user2_id (FK users nullable), current_phase (enum), current_step_index (int), status (enum), version (int default 1), snapshot_json (jsonb), started_at (timestamptz), completed_at (timestamptz nullable)
    - `scripture_step_states` table with: id (UUID PK), session_id (FK), step_index (int), user1_locked_at (timestamptz nullable), user2_locked_at (timestamptz nullable), advanced_at (timestamptz nullable)
    - `scripture_reflections` table with: id (UUID PK), session_id (FK), step_index (int), user_id (FK), rating (int 1-5 nullable), notes (text nullable), is_shared (bool default false), created_at (timestamptz)
    - `scripture_bookmarks` table with: id (UUID PK), session_id (FK), step_index (int), user_id (FK), share_with_partner (bool default false), created_at (timestamptz)
    - `scripture_messages` table with: id (UUID PK), session_id (FK), sender_id (FK), message (text), created_at (timestamptz)
    - Create enums: `scripture_session_mode`, `scripture_session_phase`, `scripture_session_status`
    - Add indexes on session_id for all child tables
    - Wrap in BEGIN/COMMIT transaction

- [x] **Task 1.2: Add RLS policies to scripture tables**
  - File: `supabase/migrations/20260128_scripture_reading.sql` (append)
  - Action: Add session-based RLS policies
  - Details:
    - Enable RLS on all 5 tables
    - `scripture_sessions`: SELECT/INSERT/UPDATE for user1_id = auth.uid() OR user2_id = auth.uid()
    - Child tables: SELECT/INSERT for users who are part of the session (subquery pattern)
    - `scripture_reflections`: Add is_shared check for partner visibility

- [x] **Task 1.3: Create seeding RPC with environment guard**
  - File: `supabase/migrations/20260128_scripture_reading.sql` (append)
  - Action: Create `scripture_seed_test_data()` function
  - Details:
    ```sql
    CREATE OR REPLACE FUNCTION scripture_seed_test_data(
      p_session_count INT DEFAULT 1,
      p_include_reflections BOOL DEFAULT false,
      p_include_messages BOOL DEFAULT false,
      p_preset TEXT DEFAULT NULL  -- 'mid_session', 'completed', 'with_help_flags'
    ) RETURNS JSONB AS $$
    DECLARE
      v_env TEXT;
      v_result JSONB;
      -- ... variables
    BEGIN
      -- Environment guard
      v_env := current_setting('app.environment', true);
      IF v_env = 'production' THEN
        RAISE EXCEPTION 'Seeding not allowed in production environment';
      END IF;

      -- Create test users if needed
      -- Create sessions based on preset
      -- Return IDs
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    ```
  - Preset behaviors:
    - `mid_session`: current_step_index = 7, status = 'in_progress'
    - `completed`: current_step_index = 16, status = 'complete', completed_at set
    - `with_help_flags`: Add help_requested flags to odd-numbered steps

#### Track 2: IndexedDB Centralization (Backend)

- [x] **Task 2.1: Add scripture stores to dbSchema.ts**
  - File: `src/services/dbSchema.ts`
  - Action: Bump DB_VERSION to 5, add 4 new stores to MyLoveDBSchema interface
  - Details:
    ```typescript
    // Add to MyLoveDBSchema interface:
    'scripture-sessions': {
      key: string;
      value: ScriptureSession;
      indexes: { 'by-user': string };
    };
    'scripture-reflections': {
      key: string;
      value: ScriptureReflection;
      indexes: { 'by-session': string };
    };
    'scripture-bookmarks': {
      key: string;
      value: ScriptureBookmark;
      indexes: { 'by-session': string };
    };
    'scripture-messages': {
      key: string;
      value: ScriptureMessage;
      indexes: { 'by-session': string };
    };

    // Update version
    export const DB_VERSION = 5;

    // Add store names
    export const STORE_NAMES = {
      // ... existing
      SCRIPTURE_SESSIONS: 'scripture-sessions',
      SCRIPTURE_REFLECTIONS: 'scripture-reflections',
      SCRIPTURE_BOOKMARKS: 'scripture-bookmarks',
      SCRIPTURE_MESSAGES: 'scripture-messages',
    } as const;
    ```

- [x] **Task 2.2: Export centralized upgradeDb function**
  - File: `src/services/dbSchema.ts`
  - Action: Add exported `upgradeDb()` function that handles all store creation
  - Details:
    ```typescript
    import type { IDBPDatabase } from 'idb';

    export function upgradeDb(
      db: IDBPDatabase<MyLoveDBSchema>,
      oldVersion: number,
      newVersion: number | null
    ): void {
      // v1: messages store
      if (oldVersion < 1) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messageStore.createIndex('by-category', 'category');
        messageStore.createIndex('by-date', 'createdAt');
      }

      // v2: photos store
      if (oldVersion < 2) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        photoStore.createIndex('by-date', 'uploadDate');
      }

      // v3: moods store
      if (oldVersion < 3) {
        const moodsStore = db.createObjectStore('moods', { keyPath: 'id', autoIncrement: true });
        moodsStore.createIndex('by-date', 'date', { unique: true });
      }

      // v4: sw-auth store
      if (oldVersion < 4) {
        db.createObjectStore('sw-auth', { keyPath: 'id' });
      }

      // v5: scripture stores
      if (oldVersion < 5) {
        const sessionsStore = db.createObjectStore('scripture-sessions', { keyPath: 'id' });
        sessionsStore.createIndex('by-user', 'userId');

        const reflectionsStore = db.createObjectStore('scripture-reflections', { keyPath: 'id' });
        reflectionsStore.createIndex('by-session', 'sessionId');

        const bookmarksStore = db.createObjectStore('scripture-bookmarks', { keyPath: 'id' });
        bookmarksStore.createIndex('by-session', 'sessionId');

        const messagesStore = db.createObjectStore('scripture-messages', { keyPath: 'id' });
        messagesStore.createIndex('by-session', 'sessionId');
      }
    }
    ```

- [x] **Task 2.3: Refactor moodService to use shared upgradeDb**
  - File: `src/services/moodService.ts`
  - Action: Remove duplicate upgrade logic, call shared `upgradeDb()`
  - Details:
    - Import `upgradeDb` from `./dbSchema`
    - In `_doInit()`, replace the entire upgrade callback with:
      ```typescript
      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion) {
          upgradeDb(db, oldVersion, newVersion);
        },
      });
      ```
    - Remove all the fallback store creation code (~50 lines)

- [x] **Task 2.4: Refactor customMessageService to use shared upgradeDb**
  - File: `src/services/customMessageService.ts`
  - Action: Same refactor as moodService
  - Details: Replace upgrade callback, remove ~40 lines of duplicate logic

- [x] **Task 2.5: Refactor photoStorageService to use shared upgradeDb**
  - File: `src/services/photoStorageService.ts`
  - Action: Same refactor as moodService
  - Details: Replace upgrade callback, remove ~60 lines (includes v1→v2 migration)
  - Note: Preserve the v1→v2 photo migration logic by moving it to `upgradeDb()`

#### Track 3: CI Pipeline (DevOps)

- [x] **Task 3.1: Add Supabase Local job to test.yml**
  - File: `.github/workflows/test.yml`
  - Action: Add new job `supabase-setup` that runs before `e2e-tests`
  - Details:
    ```yaml
    supabase-setup:
      name: Supabase Local Setup
      runs-on: ubuntu-latest
      timeout-minutes: 10
      outputs:
        supabase_url: ${{ steps.supabase.outputs.url }}
        supabase_anon_key: ${{ steps.supabase.outputs.anon_key }}
      steps:
        - name: Checkout code
          uses: actions/checkout@v4

        - name: Setup Supabase CLI
          uses: supabase/setup-cli@v1
          with:
            version: latest

        - name: Start Supabase Local
          id: supabase
          run: |
            supabase start
            echo "url=$(supabase status --output json | jq -r '.API_URL')" >> $GITHUB_OUTPUT
            echo "anon_key=$(supabase status --output json | jq -r '.ANON_KEY')" >> $GITHUB_OUTPUT

        - name: Run migrations
          run: supabase db reset
    ```

- [x] **Task 3.2: Update e2e-tests job to use Supabase Local**
  - File: `.github/workflows/test.yml`
  - Action: Modify `e2e-tests` job to depend on `supabase-setup` and use its outputs
  - Details:
    - Add `needs: [lint, supabase-setup]`
    - Add environment variables:
      ```yaml
      env:
        SUPABASE_URL: ${{ needs.supabase-setup.outputs.supabase_url }}
        SUPABASE_ANON_KEY: ${{ needs.supabase-setup.outputs.supabase_anon_key }}
      ```
    - Add Supabase services using Docker action or run alongside

- [x] **Task 3.3: Add Supabase teardown step**
  - File: `.github/workflows/test.yml`
  - Action: Add cleanup step in e2e-tests job
  - Details:
    ```yaml
    - name: Stop Supabase Local
      if: always()
      run: supabase stop
    ```

#### Track 4: Test Factories (QA)

- [x] **Task 4.1: Create test factories file**
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

- [x] **Task 4.2: Add session fixture to Playwright fixtures**
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

- [x] **Task 5.1: Create dbSchema unit tests**
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

#### AC-1: Seeding RPC Creates Valid Sessions
- [ ] **AC-1.1**: Given a local Supabase instance, when `scripture_seed_test_data()` is called with default params, then it returns a JSON object with `session_ids` array containing 1 valid UUID
- [ ] **AC-1.2**: Given `p_session_count = 3`, when the RPC is called, then it returns 3 session IDs and all sessions exist in `scripture_sessions` table
- [ ] **AC-1.3**: Given `p_preset = 'mid_session'`, when the RPC is called, then the created session has `current_step_index = 7` and `status = 'in_progress'`
- [ ] **AC-1.4**: Given `p_preset = 'completed'`, when the RPC is called, then the session has `current_step_index = 16`, `status = 'complete'`, and `completed_at` is not null
- [ ] **AC-1.5**: Given `p_include_reflections = true`, when the RPC is called, then `reflection_ids` is included in the response and reflections exist in the database

#### AC-2: Environment Guard Protects Production
- [ ] **AC-2.1**: Given `app.environment = 'production'`, when `scripture_seed_test_data()` is called, then it raises an exception with message containing 'not allowed in production'
- [ ] **AC-2.2**: Given `app.environment = 'local'` (Supabase Local default), when the RPC is called, then it executes successfully
- [ ] **AC-2.3**: Given `app.environment` is not set, when the RPC is called, then it executes successfully (fail-open for dev)

#### AC-3: IndexedDB v5 Upgrade Works
- [ ] **AC-3.1**: Given a fresh IndexedDB (no prior version), when any service initializes, then all 8 stores are created including 4 scripture stores
- [ ] **AC-3.2**: Given an existing v4 database, when a service initializes with v5, then the 4 scripture stores are added without data loss in existing stores
- [ ] **AC-3.3**: Given multiple services initializing concurrently, when they all call `upgradeDb()`, then no VersionError is thrown
- [ ] **AC-3.4**: Given the `scripture-sessions` store, when queried, then it has a `by-user` index

#### AC-4: CI Pipeline Runs With Supabase Local
- [ ] **AC-4.1**: Given a PR to main branch, when the test workflow runs, then Supabase Local starts successfully within 60 seconds
- [ ] **AC-4.2**: Given Supabase Local is running, when `supabase db reset` executes, then all migrations apply without error
- [ ] **AC-4.3**: Given migrations have run, when Playwright tests execute, then they can connect to the local Supabase instance
- [ ] **AC-4.4**: Given the test job completes (pass or fail), when cleanup runs, then `supabase stop` executes and containers are removed

#### AC-5: Test Factories Create Usable Data
- [ ] **AC-5.1**: Given a Supabase client, when `createTestSession()` is called, then it returns a `SeedResult` with valid session IDs
- [ ] **AC-5.2**: Given a test uses the `testSession` fixture, when the test completes, then the fixture cleans up all created data
- [ ] **AC-5.3**: Given `preset: 'mid_session'`, when `createTestSession()` is called, then the returned session is at step 7

## Additional Context

### Dependencies

**Sequential Dependencies:**
1. Task 1.1 (tables) → Task 1.2 (RLS) → Task 1.3 (RPC) — Migration must be complete before CI uses it
2. Task 2.1 (stores) → Task 2.2 (upgradeDb) → Tasks 2.3-2.5 (service refactors) — Schema first
3. Task 3.1 (CI setup) → Task 3.2 (e2e integration) — CI job must exist before tests use it
4. Task 1.3 (RPC) → Task 4.1 (factories) — RPC must exist for factories to call

**Parallel Tracks:**
- Tracks 1-2 (Backend) can run in parallel
- Track 3 (DevOps) can start once Task 1.1 is complete
- Tracks 4-5 (QA) can start once Tasks 1.3 and 2.2 are complete

**External Dependencies:**
- Supabase CLI v1.x+ (`npx supabase`)
- Docker (for Supabase Local containers)
- `DOTENV_PRIVATE_KEY` GitHub secret
- `SUPABASE_SERVICE_ROLE_KEY` for test fixtures (local only)

### Testing Strategy

**Unit Tests (Vitest + fake-indexeddb):**
- `tests/unit/services/dbSchema.test.ts` — upgradeDb creates all stores, handles v4→v5 upgrade
- Existing service tests should continue passing with new shared upgradeDb

**Integration Tests:**
- Test factory → RPC integration (requires running Supabase Local)
- Can be run locally with `supabase start && npm run test:integration`

**E2E Validation:**
- Smoke test in CI proves pipeline works end-to-end
- `tests/e2e/example.spec.ts` already exists — ensure it passes with Supabase Local

**Manual Testing Checklist:**
1. Run `supabase start` locally
2. Run `supabase db reset` — verify migrations apply
3. Call seeding RPC via Supabase Studio SQL editor
4. Verify session data appears in tables
5. Run `npm run test:unit` — verify dbSchema tests pass
6. Run `npm run test:e2e` — verify Playwright connects to local Supabase

### Notes

**Sprint 0 Exit Criteria (from sprint-0-commitments.md):**
1. Seeding works: `scripture_seed_test_data()` returns valid session IDs
2. CI runs: GitHub Actions executes Playwright tests with Supabase Local
3. P0 ready: 25 P0 test files exist with proper structure (separate task, out of scope)
4. Green build: CI pipeline passes with at least 1 actual test

**Risk Mitigations:**
- **R-001 (Seeding)**: Solved by Tasks 1.1-1.3 + 4.1
- **R-002 (CI Supabase)**: Solved by Tasks 3.1-3.3
- **R-008 (IndexedDB VersionError)**: Solved by Tasks 2.1-2.5

**Known Limitations:**
- Seeding RPC creates test users — these should be cleaned up but may persist in local dev
- Supabase Local adds ~60s to CI pipeline startup
- Service Worker (`sw-db.ts`) must be manually kept in sync if it needs scripture stores

**Future Enhancements (Post-Sprint 0):**
- Add `scripture_cleanup_test_data()` RPC for more thorough cleanup
- Consider Supabase branching for isolated test databases
- Add seed data presets for edge cases (network timeout, partial sync)
