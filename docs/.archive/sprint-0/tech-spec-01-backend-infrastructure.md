---
title: 'Sprint 0 Backend Infrastructure'
slug: 'sprint-0-backend-infrastructure'
created: '2026-01-28'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3]
part: '1 of 3'
parent_spec: 'Sprint 0 Test Infrastructure'
tech_stack:
  - Supabase PostgreSQL 17
  - Supabase CLI (supabase start/stop/db reset)
  - IndexedDB (idb 8.0.3)
  - TypeScript 5.9.3 (strict)
files_to_modify:
  - supabase/migrations/20260128000001_scripture_reading.sql (CREATE)
  - src/services/dbSchema.ts (MODIFY)
  - src/services/moodService.ts (MODIFY)
  - src/services/customMessageService.ts (MODIFY)
  - src/services/photoStorageService.ts (MODIFY)
code_patterns:
  - BaseIndexedDBService extends pattern
  - Supabase RLS session-based access
  - Security definer functions for RLS
  - Conventional commits
test_patterns:
  - fake-indexeddb for unit tests
---

# Tech-Spec: Sprint 0 Backend Infrastructure (Part 1 of 3)

**Created:** 2026-01-28
**Depends On:** None
**Blocks:** Part 2 (CI Pipeline), Part 3 (Test Factories)

## Overview

### Problem Statement

QA automation is blocked by 2 high-priority risks:

- **R-001 (Score 9)**: No seeding mechanism — tests cannot create valid session data with proper FK relationships
- **R-008 (Score 2)**: IndexedDB version flakiness — `VersionError` crashes test runs when services use different DB versions

### Solution

Implement backend infrastructure for test automation:

1. Create Supabase migration with scripture tables, RLS policies, and seeding RPC
2. Implement `scripture_seed_test_data()` RPC with environment guard
3. Centralize IndexedDB schema and upgrade logic in dbSchema.ts
4. Refactor existing services to use shared upgrade function

### Scope

**In Scope:**
- Supabase migration file (scripture tables + RLS policies + seeding RPC)
- `scripture_seed_test_data()` RPC with `mid_session`, `completed`, `with_help_flags` presets
- Environment guard (reject seed calls in production)
- dbSchema.ts v5 upgrade with 4 scripture IndexedDB stores
- Centralized `upgradeDb()` function
- Service refactors (moodService, customMessageService, photoStorageService)

**Out of Scope:**
- CI pipeline setup (Part 2)
- Test factories and fixtures (Part 3)
- P0 test implementation

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

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/services/dbSchema.ts` | Centralized IndexedDB schema (v4 → v5) |
| `src/services/BaseIndexedDBService.ts` | Abstract base class for IndexedDB services |
| `src/services/moodService.ts` | Example service with duplicate upgrade logic |
| `supabase/migrations/20251203000001_create_base_schema.sql` | Migration pattern reference |
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

## Implementation Plan

### Tasks

#### Track 1: Supabase Migration (Backend)

- [x] **Task 1.1: Create scripture tables migration**
  - File: `supabase/migrations/20260128000001_scripture_reading.sql`
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
  - File: `supabase/migrations/20260128000001_scripture_reading.sql` (append)
  - Action: Add session-based RLS policies
  - Details:
    - Enable RLS on all 5 tables
    - `scripture_sessions`: SELECT/INSERT/UPDATE for user1_id = auth.uid() OR user2_id = auth.uid()
    - Child tables: SELECT/INSERT for users who are part of the session (subquery pattern)
    - `scripture_reflections`: Add is_shared check for partner visibility

- [x] **Task 1.3: Create seeding RPC with environment guard**
  - File: `supabase/migrations/20260128000001_scripture_reading.sql` (append)
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

## Dependencies

**Sequential Dependencies within this spec:**
1. Task 1.1 (tables) → Task 1.2 (RLS) → Task 1.3 (RPC) — Migration must be built sequentially
2. Task 2.1 (stores) → Task 2.2 (upgradeDb) → Tasks 2.3-2.5 (service refactors) — Schema first

**Parallel Opportunities:**
- Track 1 (Supabase) and Track 2 (IndexedDB) can run in parallel

**External Dependencies:**
- Supabase CLI v1.x+ (`npx supabase`)
- Docker (for Supabase Local containers)

## Testing Strategy

**Manual Testing Checklist:**
1. Run `supabase start` locally
2. Run `supabase db reset` — verify migrations apply
3. Call seeding RPC via Supabase Studio SQL editor
4. Verify session data appears in tables

**Unit Tests (to be created in Part 3):**
- `tests/unit/services/dbSchema.test.ts` — upgradeDb creates all stores, handles v4→v5 upgrade

## Notes

**Risk Mitigations:**
- **R-001 (Seeding)**: Solved by Tasks 1.1-1.3
- **R-008 (IndexedDB VersionError)**: Solved by Tasks 2.1-2.5

**Known Limitations:**
- Seeding RPC creates test users — these should be cleaned up but may persist in local dev
- Service Worker (`sw-db.ts`) must be manually kept in sync if it needs scripture stores
