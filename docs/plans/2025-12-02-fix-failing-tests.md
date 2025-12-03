# Fix Failing Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 36 remaining failing unit tests across 9 test files

**Architecture:** Tests fail due to 4 root causes:
1. Missing `supabase` export in mocks (PokeKissInterface, InteractionHistory, others)
2. Invalid UUID format for `device_id` in schema tests
3. Wrong type guard order in `logSupabaseError` (checks PostgrestError before SupabaseServiceError)
4. Integration tests importing real supabaseClient without proper mocking

**Tech Stack:** Vitest, React Testing Library, Zod schemas, Supabase mocks

---

## Summary of Failures by Root Cause

| Root Cause | Test Files | Tests | Fix |
|-----------|------------|-------|-----|
| Missing `supabase` export | PokeKissInterface, InteractionHistory | 22 | Add `supabase` to mock |
| Invalid UUID for device_id | supabaseSchemas | 2 | Use valid UUID |
| Type guard order bug | errorHandlers | 1 | Swap check order |
| Missing supabaseClient mock | syncService, MoodTracker, integration/* | 8+ | Add mock before imports |
| App.sync timers | App.sync | 11 | Fix fake timer handling |

---

### Task 1: Fix PokeKissInterface Mock (22 tests)

**Files:**
- Modify: `tests/unit/components/PokeKissInterface.test.tsx:26-30`

**Root Cause:** The mock exports `getPartnerId`, `getCurrentUserId`, `initializeAuth` but NOT `supabase`. The component imports and uses `supabase` from supabaseClient, causing "No 'supabase' export is defined on mock" error.

**Step 1: Read the current mock structure**

```typescript
// Current broken mock (lines 26-30):
vi.mock('../../../src/api/supabaseClient', () => ({
  getPartnerId: vi.fn(),
  getCurrentUserId: vi.fn(),
  initializeAuth: vi.fn(),
}));
```

**Step 2: Replace with complete supabase mock**

```typescript
// Fixed mock - add supabase export with auth methods
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
  getPartnerId: vi.fn(),
  getCurrentUserId: vi.fn().mockResolvedValue('test-user-id'),
  initializeAuth: vi.fn(),
}));

// Also add authService mock
vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUserId: vi.fn(() => Promise.resolve('test-user-id')),
    getCurrentUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
    getUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
  },
}));
```

**Step 3: Run test to verify**

Run: `npm run test:unit -- tests/unit/components/PokeKissInterface.test.tsx`
Expected: All 22 tests pass

**Step 4: Commit**

```bash
git add tests/unit/components/PokeKissInterface.test.tsx
git commit -m "fix(tests): add supabase export to PokeKissInterface mock"
```

---

### Task 2: Fix InteractionHistory Mock (3 tests)

**Files:**
- Modify: `tests/unit/components/InteractionHistory.test.tsx` (mock section at top)

**Root Cause:** Same as Task 1 - missing `supabase` export. The component uses authService which needs supabase.

**Step 1: Find current mock in the file**

Look for `vi.mock('../../../src/api/supabaseClient'` in the file.

**Step 2: Add complete mock with supabase and authService**

Add the same mock pattern from Task 1.

**Step 3: Run test to verify**

Run: `npm run test:unit -- tests/unit/components/InteractionHistory.test.tsx`
Expected: All 21 tests pass (18 + 3 fixed)

**Step 4: Commit**

```bash
git add tests/unit/components/InteractionHistory.test.tsx
git commit -m "fix(tests): add supabase export to InteractionHistory mock"
```

---

### Task 3: Fix supabaseSchemas UUID Tests (2 tests)

**Files:**
- Modify: `tests/unit/api/supabaseSchemas.test.ts:241,253,275`

**Root Cause:** Tests use `device_id: 'device-123'` but schema validates device_id as UUID format.

**Step 1: Find all device_id test values**

Lines with invalid UUIDs:
- Line 241: `device_id: 'device-123'`
- Line 253: `device_id: 'device-123'`
- Line 275: `device_id: 'device-123'`

**Step 2: Replace with valid UUIDs**

```typescript
// Change from:
device_id: 'device-123',

// Change to:
device_id: '550e8400-e29b-41d4-a716-446655440099',
```

Apply to all 3 occurrences.

**Step 3: Run test to verify**

Run: `npm run test:unit -- tests/unit/api/supabaseSchemas.test.ts`
Expected: All 28 tests pass

**Step 4: Commit**

```bash
git add tests/unit/api/supabaseSchemas.test.ts
git commit -m "fix(tests): use valid UUID for device_id in schema tests"
```

---

### Task 4: Fix errorHandlers Type Guard Order (1 test)

**Files:**
- Modify: `src/api/errorHandlers.ts:135-154`

**Root Cause:** `logSupabaseError` checks `isPostgrestError` BEFORE `isSupabaseServiceError`. Since `SupabaseServiceError` has `code`, `message`, and `details` properties, `isPostgrestError` returns true for it, logging wrong fields.

**Step 1: Read current logSupabaseError implementation**

Current order (lines 136, 143):
1. `if (isPostgrestError(error))` - matches SupabaseServiceError too!
2. `else if (isSupabaseServiceError(error))` - never reached

**Step 2: Swap the check order**

```typescript
export const logSupabaseError = (context: string, error: unknown): void => {
  // Check SupabaseServiceError FIRST (more specific)
  if (isSupabaseServiceError(error)) {
    console.error(`[Supabase] ${context}:`, {
      message: error.message,
      code: error.code,
      isNetworkError: error.isNetworkError,
    });
  } else if (isPostgrestError(error)) {
    console.error(`[Supabase] ${context}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  } else if (error instanceof Error) {
    console.error(`[Supabase] ${context}:`, error.message);
  } else {
    console.error(`[Supabase] ${context}:`, error);
  }
};
```

**Step 3: Run test to verify**

Run: `npm run test:unit -- tests/unit/api/errorHandlers.test.ts`
Expected: All 32 tests pass

**Step 4: Commit**

```bash
git add src/api/errorHandlers.ts
git commit -m "fix: check SupabaseServiceError before PostgrestError in logSupabaseError"
```

---

### Task 5: Fix syncService.test.ts Import Error

**Files:**
- Modify: `tests/unit/services/syncService.test.ts` (add mock at top before imports)

**Root Cause:** The test imports from files that import supabaseClient, which tries to create a real Supabase client. The mock must be hoisted BEFORE any imports.

**Step 1: Add hoisted mock at very top of file**

```typescript
// MUST be at very top, before any imports
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
  getCurrentUserId: vi.fn(),
}));
```

**Step 2: Ensure vi.mock is hoisted**

Vitest hoists `vi.mock` calls automatically, but the mock must be defined BEFORE the file imports the mocked module.

**Step 3: Run test to verify**

Run: `npm run test:unit -- tests/unit/services/syncService.test.ts`
Expected: Tests run (may have other issues to fix)

**Step 4: Commit**

```bash
git add tests/unit/services/syncService.test.ts
git commit -m "fix(tests): add supabaseClient mock to syncService tests"
```

---

### Task 6: Fix MoodTracker.test.tsx Import Error

**Files:**
- Modify: `tests/unit/components/MoodTracker.test.tsx` (add mock at top)

**Root Cause:** Same as Task 5 - imports files that import supabaseClient without mocking it.

**Step 1: Add hoisted supabaseClient mock**

Same pattern as Task 5.

**Step 2: Run test to verify**

Run: `npm run test:unit -- tests/unit/components/MoodTracker.test.tsx`
Expected: Tests run

**Step 3: Commit**

```bash
git add tests/unit/components/MoodTracker.test.tsx
git commit -m "fix(tests): add supabaseClient mock to MoodTracker tests"
```

---

### Task 7: Fix Integration Tests (Skip if No Real Supabase)

**Files:**
- Modify: `tests/integration/supabase.test.ts`
- Modify: `tests/integration/supabase-schema.test.ts`

**Root Cause:** These are true integration tests that need a real Supabase connection. They should be skipped in unit test runs.

**Option A: Skip in CI without real credentials**

Add at top of each file:
```typescript
const hasRealSupabase = import.meta.env.VITE_SUPABASE_URL?.startsWith('https://');

describe.skipIf(!hasRealSupabase)('Supabase Integration', () => {
  // tests...
});
```

**Option B: Move to separate test command**

Update `package.json` scripts:
```json
{
  "test:unit": "vitest run --exclude tests/integration/**",
  "test:integration": "vitest run tests/integration/**"
}
```

**Step 1: Choose Option A (skip without credentials)**

Add the skipIf check to both files.

**Step 2: Run tests to verify**

Run: `npm run test:unit`
Expected: Integration tests skipped, other tests run

**Step 3: Commit**

```bash
git add tests/integration/*.ts
git commit -m "fix(tests): skip integration tests when Supabase not configured"
```

---

### Task 8: Fix App.sync.test.tsx Timer Issues (11 tests)

**Files:**
- Modify: `tests/App.sync.test.tsx`

**Root Cause:** Fake timers don't work well with async React updates. Tests timeout waiting for effects.

**Step 1: Update timer handling pattern**

```typescript
// In each failing test, replace:
await waitFor(() => {
  expect(mockSyncPendingMoods).toHaveBeenCalled();
});

// With:
await vi.waitFor(() => {
  expect(mockSyncPendingMoods).toHaveBeenCalled();
}, { timeout: 1000 });

// Or use act() properly:
await act(async () => {
  await vi.advanceTimersByTimeAsync(100);
});
```

**Step 2: Ensure proper async handling**

For periodic sync tests:
```typescript
it('should trigger sync every 5 minutes while online', async () => {
  render(<App />);

  // Initial sync
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });

  // Advance to first 5-minute interval
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });

  expect(mockSyncPendingMoods).toHaveBeenCalledTimes(2);
});
```

**Step 3: Run tests to verify**

Run: `npm run test:unit -- tests/App.sync.test.tsx`
Expected: All 11 tests pass

**Step 4: Commit**

```bash
git add tests/App.sync.test.tsx
git commit -m "fix(tests): improve async timer handling in App.sync tests"
```

---

## Verification

After completing all tasks, run full test suite:

```bash
npm run test:unit
```

**Expected Result:** 0 failed tests, all 737 tests pass

---

## Quick Reference: Standard Mock Pattern

Use this pattern for any test that imports code using supabaseClient:

```typescript
// At top of test file, BEFORE imports
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseClient
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
  getCurrentUserId: vi.fn().mockResolvedValue('test-user-id'),
  getPartnerId: vi.fn(),
  initializeAuth: vi.fn(),
}));

// Mock authService (if component uses auth)
vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUserId: vi.fn(() => Promise.resolve('test-user-id')),
    getCurrentUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
    getUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
  },
}));
```
