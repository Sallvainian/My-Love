# Dev Notes

## ATDD RED→GREEN: 10 API Tests to Make Pass

**Test file:** `tests/e2e/scripture/scripture-rls-security.spec.ts` (10 tests, all RED)

| Test ID | Test Name | Task | What Makes It GREEN |
|---------|-----------|------|---------------------|
| P0-001a | SELECT scripture_sessions - member access | 7 | RLS policy + test auth flow working |
| P0-001b | SELECT scripture_sessions - non-member blocked | 7 | RLS policy blocking non-member |
| P0-002a | SELECT scripture_reflections - member access | 8 | RLS policy + seed with reflections |
| P0-002b | SELECT scripture_reflections - non-member blocked | 8 | RLS policy blocking non-member |
| P0-003a | INSERT scripture_reflections - non-member rejected | 9 | RLS INSERT policy rejecting |
| P0-003b | INSERT scripture_bookmarks - non-member rejected | 9 | RLS INSERT policy rejecting |
| P0-004 | user_id = auth.uid() enforced on INSERT | 10 | WITH CHECK on user_id |
| P0-005 | is_shared visibility - unshared hidden | 11 | SELECT policy filtering is_shared |
| P0-008 | Solo session creation via RPC | 12 | `scripture_create_session` RPC exists |
| P0-012 | Idempotent reflection write (upsert) | 13 | `scripture_submit_reflection` RPC with UPSERT |

**Run command:** `npx playwright test tests/e2e/scripture/scripture-rls-security.spec.ts`

**Key insight:** RLS policies (Tasks 7-11) already exist in Sprint 0 migration `20260128000001_scripture_reading.sql`. These tasks are primarily about **verifying the test infrastructure works** against the existing policies. Tasks 12-13 create **net-new RPCs** that don't exist yet.

## Migration File for New RPCs

Tasks 12-13 require a **new migration file** (do NOT modify the Sprint 0 migration):
- Path: `supabase/migrations/20260130000001_scripture_rpcs.sql`
- Contains: `scripture_create_session` and `scripture_submit_reflection` RPCs
- After creating: run `supabase db reset` locally, then `supabase gen types typescript --local` to update `database.types.ts`

## Test Infrastructure Notes

The RLS tests use:
- **Factory:** `createTestSession(supabaseAdmin, options)` — seeds via `scripture_seed_test_data` RPC
- **Helper:** `createUserClient(supabaseAdmin, userId)` — creates authenticated Supabase client for specific user
- **Fixture:** `supabaseAdmin` from `tests/support/merged-fixtures.ts` — service-role client
- **Fixture:** `testSession` — auto-seeded session with cleanup

**Known risk:** The `scripture_seed_test_data` RPC uses `SELECT id FROM auth.users ORDER BY created_at LIMIT 1` to find test users. If the local Supabase has no auth users, seeding fails. Ensure `supabase db reset` + test user creation runs before tests.

**Together-mode seed note:** P0-005 (is_shared visibility) requires a together-mode session with both user1 and user2. The seed RPC creates together-mode sessions when 2+ auth users exist. If only 1 user exists, it creates solo sessions and `test_user2_id` will be null — the test guards against this with `if (seedResult.test_user2_id)`.

## What Already Exists (Sprint 0)

Sprint 0 implemented significant backend infrastructure. The following files are **already created and should NOT be recreated**:

| File | Status | Notes |
|------|--------|-------|
| `supabase/migrations/20260128000001_scripture_reading.sql` | DONE | 5 tables, RLS, RPCs, seeding RPC, indexes |
| `src/services/dbSchema.ts` | DONE | DB_VERSION=5, all scripture stores, types, upgradeDb() |
| `src/stores/slices/navigationSlice.ts` | DONE | Already has `'scripture'` in ViewType |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | PARTIAL | Basic overview component exists |
| `src/services/BaseIndexedDBService.ts` | DONE | Generic base class for IndexedDB services |
| `tests/e2e/scripture-*.spec.ts` | PARTIAL | Placeholder E2E tests (mostly skipped) |

## What Needs to Be Created

| File | Action | Priority |
|------|--------|----------|
| `src/services/scriptureReadingService.ts` | CREATE | P0 |
| `src/stores/slices/scriptureReadingSlice.ts` | CREATE | P0 |
| `src/stores/types.ts` | MODIFY (add ScriptureSlice) | P0 |
| `src/stores/useAppStore.ts` | MODIFY (compose slice) | P0 |
| `src/data/scriptureSteps.ts` | CREATE | P0 |
| `src/types/database.types.ts` | REGENERATE (supabase gen types) | P1 |
| `src/types/models.ts` | MODIFY (add scripture models) | P1 |
| `src/validation/schemas.ts` | MODIFY (add scripture schemas) | P1 |
| Existing IndexedDB services | VERIFY imports from dbSchema.ts | P1 |

## Architecture Compliance

**MANDATORY patterns — follow exactly:**

- **Zustand slice composition:** Co-locate types with slice. Use `StateCreator<AppState, AppMiddleware, [], ScriptureSlice>` pattern. Register in `useAppStore.ts`.
  - [Source: architecture.md#Implementation Patterns]

- **Service layer:** Extend `BaseIndexedDBService`. Use `upgradeDb` from `dbSchema.ts`. Follow existing moodService/customMessageService patterns.
  - [Source: architecture.md#Decision 4: Caching Architecture]

- **Container/Presentational pattern:** Smart containers connect to slice, dumb components receive props. Don't fetch data in presentational components.
  - [Source: architecture.md#Decision 5: Component Architecture]

- **Error handling:** Use `ScriptureErrorCode` enum + `handleScriptureError()` centralized handler. No class hierarchies.
  - [Source: architecture.md#Format Patterns]

- **Loading states:** Explicit boolean flags (`isLoading`, `isPendingLockIn`, `isPendingReflection`, `isSyncing`). Never use status enums for simple loading.
  - [Source: architecture.md#Loading State Naming]

- **Naming conventions:**
  - DB columns: `snake_case` (`step_index`, `user_id`, `is_shared`)
  - Broadcast events: `snake_case` (`state_updated`, `presence_update`)
  - RPCs: `scripture_` prefix + action-oriented (`scripture_lock_in`)
  - TS variables/functions: `camelCase`
  - TS components: `PascalCase`
  - Constants: `SCREAMING_CASE` (`MAX_STEPS = 17`)
  - [Source: architecture.md#Naming Patterns]

- **Type organization:**
  - Feature types: co-located with `scriptureReadingSlice.ts`
  - DB types: `src/types/database.types.ts` (auto-generated)
  - App models: `src/types/models.ts`
  - [Source: project-context.md#Type Organization]

- **Validation:** Zod schemas for all Supabase responses at boundary. Follow MoodApi validation pattern.
  - [Source: project-context.md#API Validation]

- **No `any`:** Use `unknown`, generics, `Record<string, unknown>`, or `z.infer<>`. Lint-enforced error.
  - [Source: project-context.md#Type Safety]

- **No React Router:** Navigation via `navigationSlice` (`setView('scripture')`).
  - [Source: project-context.md#Framework-Specific Rules]

- **Pure client SPA:** Never use `"use client"` or `"use server"` directives.
  - [Source: project-context.md#Framework-Specific Rules]

## Cache Pattern (Solo Mode — Server is Source of Truth)

```
READ: IndexedDB cache → return cached → fetch fresh from Supabase → update cache
WRITE: POST to Supabase RPC → on success → update IndexedDB cache → on failure → show retry
CORRUPTION: On IndexedDB error → clear cache → refetch from server
```

Scripture stores do NOT use the 'synced' index pattern. They are read-cache only. The server (Supabase) is always source of truth.
- [Source: architecture.md#Decision 4: Caching Architecture]

## IndexedDB Stores (from dbSchema.ts)

```typescript
'scripture-sessions': { keyPath: 'id', indexes: ['user_id'] }
'scripture-reflections': { keyPath: 'id', indexes: ['session_id'] }
'scripture-bookmarks': { keyPath: 'id', indexes: ['session_id'] }
'scripture-messages': { keyPath: 'id', indexes: ['session_id'] }
```

No 'synced' index — cache-only pattern.

## Zustand Slice Pattern (from existing slices)

```typescript
// In src/stores/slices/scriptureReadingSlice.ts
export type SessionPhase = 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
export type SessionMode = 'solo' | 'together';

export interface ScriptureSession {
  id: string;
  mode: SessionMode;
  currentPhase: SessionPhase;
  currentStepIndex: number;
  version: number;
  // ... match dbSchema.ts types
}

export interface ScriptureReadingState {
  session: ScriptureSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;
  error: ScriptureError | null;
}

// Slice follows StateCreator pattern from src/stores/types.ts
```

## Error Handling Pattern

```typescript
export enum ScriptureErrorCode {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SYNC_FAILED = 'SYNC_FAILED',
  OFFLINE = 'OFFLINE',
}

export interface ScriptureError {
  code: ScriptureErrorCode;
  message: string;
  details?: unknown;
}

export function handleScriptureError(error: ScriptureError): void {
  switch (error.code) {
    case ScriptureErrorCode.VERSION_MISMATCH:
      // Refetch session state, show subtle toast
      break;
    case ScriptureErrorCode.SYNC_FAILED:
      // Queue for retry, show offline indicator
      break;
    // ...
  }
}
```

## Static Scripture Data Structure

```typescript
// src/data/scriptureSteps.ts
export const MAX_STEPS = 17;

export interface ScriptureStep {
  stepIndex: number;        // 0-16
  sectionTheme: string;     // e.g., "Healing & Restoration"
  verseReference: string;   // e.g., "Psalm 147:3"
  verseText: string;        // Full NKJV verse text
  responseText: string;     // Couple-focused response prayer
}

export const SCRIPTURE_STEPS: readonly ScriptureStep[] = [ /* 17 steps */ ];
```

The 6 section themes (from PRD): Healing & Restoration, Forgiveness & Reconciliation, Confession & Repentance, God's Faithfulness & Peace, The Power of Words, Christlike Character.

## Supabase RPC Signatures (Already in Migration)

```sql
scripture_create_session(p_mode TEXT, p_partner_id UUID DEFAULT NULL) → JSONB
scripture_lock_in(p_session_id UUID, p_step_index INT, p_user_id UUID, p_expected_version INT) → JSONB
scripture_advance_phase(p_session_id UUID, p_expected_version INT) → JSONB
scripture_submit_reflection(p_session_id UUID, p_step_index INT, p_rating INT, p_notes TEXT, p_is_shared BOOLEAN) → JSONB
scripture_seed_test_data(p_preset TEXT DEFAULT 'mid_session') → JSONB (test environments only)
```

## RLS Pattern (Session-Based Access)

All scripture_* tables enforce that the authenticated user must be `user1_id` or `user2_id` on the parent scripture_session. Uses `is_scripture_session_member(p_session_id)` helper function.

## sw-db.ts Sync Note

Service worker file `src/sw-db.ts` must be kept in sync manually with dbSchema.ts. **For this story, no sw-db.ts update is needed** — scripture uses cache-only pattern, not Background Sync.
- [Source: architecture.md#Tech Debt Fix]

## Technology Versions (Locked)

| Technology | Version | Notes |
|-----------|---------|-------|
| React | 19.2.3 | Hooks only, no class components |
| TypeScript | 5.9.3 | Strict mode |
| Zustand | 5.0.10 | Latest stable, slice composition |
| Supabase JS | 2.90.1 | Auth, DB, Storage, Realtime Broadcast |
| idb | 8.0.3 | Latest stable |
| Zod | 4.3.5 | Latest stable, validate at boundaries |
| Framer Motion | 12.27.1 | useReducedMotion hook stable |
| Vitest | 4.0.17 | Unit/integration tests |
| fake-indexeddb | 6.2.5 | IndexedDB test mock |

## Project Structure Notes

- Alignment with unified project structure (paths, modules, naming) — all new files follow existing conventions
- `src/stores/slices/` for Zustand slices (camelCaseSlice.ts)
- `src/services/` for service layer (camelCaseService.ts)
- `src/data/` for static data modules
- `src/types/` for shared types (database.types.ts, models.ts)
- `src/validation/` for Zod schemas
- `tests/unit/` mirrors src structure

## References

- [Source: _bmad-output/atdd-checklist-epic-1.md#Phase 1: Backend (Story 1.1) — Make RLS Tests Pass]
- [Source: tests/e2e/scripture/scripture-rls-security.spec.ts — 10 RED API tests]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1: Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 4: Caching Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tech Debt Fix: Centralized dbConfig]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements]
- [Source: docs/project-context.md#Scripture Reading Feature Architecture]
- [Source: docs/project-context.md#Critical Implementation Rules]
