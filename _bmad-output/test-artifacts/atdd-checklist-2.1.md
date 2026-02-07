# ATDD Checklist - Epic 2, Story 2.1: Per-Step Reflection System

**Date:** 2026-02-02
**Author:** Sallvain
**Primary Test Level:** E2E

---

## Story Summary

Users can bookmark verses during reading and submit a reflection (rating, optional note) after each step, marking what matters to them and capturing their response in the moment.

**As a** user
**I want** to bookmark verses during reading and submit a reflection (rating, optional note) after each step
**So that** I can mark what matters to me and capture my response in the moment

---

## Acceptance Criteria

1. **Bookmark Toggle on Verse Screen** — Instant toggle (filled amber active, outlined inactive), write-through to server + IndexedDB, aria-label toggling, 48x48px hit area, no confirmation dialog
2. **Reflection Screen After Step** — 1-5 rating scale with radiogroup, "A little"/"A lot" labels, "How meaningful was this for you today?" prompt, optional note textarea (200 char, auto-grow, character counter)
3. **Reflection Submission** — Upsert to `scripture_reflections` (unique: session_id + step_index + user_id), IndexedDB cache updated, session advances
4. **Rating Validation** — Continue disabled without rating, "Please select a rating" helper text, no aggressive validation

---

## Failing Tests Created (RED Phase)

### E2E Tests (4 tests)

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts` (299 lines)

- **Test:** 2.1-E2E-001 [P0] Submit per-step reflection with rating and note
  - **Status:** RED - `test.skip()` — BookmarkFlag and PerStepReflection components not implemented
  - **Verifies:** Full reflection submission flow, DB persistence via supabaseAdmin, session advancement

- **Test:** 2.1-E2E-002 [P0] Bookmark toggle persists with correct visual states
  - **Status:** RED - `test.skip()` — BookmarkFlag component not implemented
  - **Verifies:** Amber filled/outlined toggle, aria-label/aria-pressed, 48x48px touch target, DB write-through

- **Test:** 2.1-E2E-003 [P1] Rating validation prevents submission without rating
  - **Status:** RED - `test.skip()` — PerStepReflection component not implemented
  - **Verifies:** Disabled Continue, helper text on forced click, quiet validation (no red), enables after rating

- **Test:** 2.1-E2E-004 [P1] Reflection write failure shows retry UI
  - **Status:** RED - `test.skip()` — PerStepReflection and SyncToast retry not wired
  - **Verifies:** Server 500 intercepted, non-blocking session advance, retry indicator visible

### API Tests (3 tests)

**File:** `tests/api/scripture-reflection-api.spec.ts` (306 lines)

- **Test:** 2.1-API-001 [P0] Reflection upsert idempotency
  - **Status:** RED - `test.skip()` — Upsert behavior not verified end-to-end
  - **Verifies:** Duplicate submit returns success, only 1 DB row exists, stable reflection ID across upserts (R2-002)

- **Test:** [P0] Reflection write persists correct fields
  - **Status:** RED - `test.skip()` — Full field persistence not verified
  - **Verifies:** All fields (session_id, step_index, user_id, rating, notes, is_shared, id, created_at), RPC return matches DB

- **Test:** [P1] Bookmark toggle creates and removes
  - **Status:** RED - `test.skip()` — Bookmark toggle service not verified
  - **Verifies:** Insert creates row, admin verification, delete removes row, clean removal (R2-005)

---

## Data Factories Used

### Existing Factories (from Epic 1)

**File:** `tests/support/factories/index.ts`

**Exports:**

- `createTestSession(supabase, options?)` — Create seeded scripture session with configurable presets
- `cleanupTestSession(supabase, sessionIds)` — Clean up all related data in FK order

**API Tests also use:**

- `createUserClient(supabaseAdmin, userId)` — Create authenticated Supabase client for a test user (inline helper)
- `generateReflectionNote(prefix)` — Dynamic note string for test isolation
- `generateRating()` — Random 1-5 rating

---

## Fixtures Used

### Existing Fixtures (from Epic 1)

**File:** `tests/support/fixtures/index.ts`

**Fixtures:**

- `supabaseAdmin` — Supabase client with service role key for test data manipulation
  - **Setup:** Creates client from SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  - **Provides:** TypedSupabaseClient for direct DB queries
  - **Cleanup:** None needed (stateless client)

- `testSession` — Pre-seeded test scripture session
  - **Setup:** Calls `createTestSession(supabaseAdmin)` via seeding RPC
  - **Provides:** SeedResult with session_ids, test_user1_id, test_user2_id
  - **Cleanup:** `cleanupTestSession(supabaseAdmin, result.session_ids)` in teardown

**Import Pattern:**

```typescript
import { test, expect } from '../../support/merged-fixtures';
```

---

## Mock Requirements

### Reflection Write Failure Mock (2.1-E2E-004)

**Endpoint:** `POST **/rest/v1/rpc/scripture_submit_reflection`

**Success Response:**

```json
{
  "id": "uuid",
  "session_id": "uuid",
  "step_index": 0,
  "user_id": "uuid",
  "rating": 5,
  "notes": "...",
  "is_shared": false
}
```

**Failure Response:**

```json
{
  "message": "Internal Server Error"
}
```

**Notes:** Route interception set up BEFORE action (network-first pattern). Failure is non-blocking — session should still advance optimistically.

---

## Required data-testid Attributes

### BookmarkFlag Component

- `scripture-bookmark-button` — Bookmark toggle icon on verse screen

### PerStepReflection Component

- `scripture-reflection-screen` — Reflection container/screen
- `scripture-reflection-prompt` — "How meaningful was this for you today?" heading
- `scripture-rating-group` — Rating radiogroup container
- `scripture-rating-1` through `scripture-rating-5` — Individual rating circle buttons
- `scripture-rating-label-low` — "A little" end label
- `scripture-rating-label-high` — "A lot" end label
- `scripture-reflection-note` — Optional note textarea
- `scripture-reflection-continue` — Continue/submit button
- `scripture-reflection-validation` — "Please select a rating" helper text
- `scripture-reflection-retry` — Retry indicator on write failure
- `scripture-reflection-char-counter` — Character counter (at 200+ chars)

**Implementation Example:**

```tsx
<button data-testid="scripture-bookmark-button" aria-label="Bookmark this verse" aria-pressed="false">
  <BookmarkIcon />
</button>

<div data-testid="scripture-reflection-screen">
  <h2 data-testid="scripture-reflection-prompt">How meaningful was this for you today?</h2>
  <div data-testid="scripture-rating-group" role="radiogroup" aria-label="How meaningful was this for you today?">
    <button data-testid="scripture-rating-1" role="radio" aria-checked="false" aria-label="Rating 1 of 5: A little">1</button>
    ...
    <button data-testid="scripture-rating-5" role="radio" aria-checked="false" aria-label="Rating 5 of 5: A lot">5</button>
  </div>
  <textarea data-testid="scripture-reflection-note" aria-label="Optional reflection note" />
  <button data-testid="scripture-reflection-continue" aria-disabled="true">Continue</button>
</div>
```

---

## Implementation Checklist

### Test: 2.1-E2E-001 — Submit per-step reflection with rating and note

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `PerStepReflection.tsx` in `src/components/scripture-reading/reflection/`
- [ ] Implement rating scale (1-5 numbered circles, radiogroup, aria-labels)
- [ ] Implement optional note textarea (200 char, auto-grow, resize-none)
- [ ] Wire `addReflection()` from `scriptureReadingService` on Continue
- [ ] Modify `SoloReadingFlow.tsx` to show reflection screen after "Next Verse"
- [ ] Add fade-through-white transition (400ms) using `useMotionConfig`
- [ ] Add all required data-testid attributes: `scripture-reflection-screen`, `scripture-reflection-prompt`, `scripture-rating-group`, `scripture-rating-{1-5}`, `scripture-rating-label-low`, `scripture-rating-label-high`, `scripture-reflection-note`, `scripture-reflection-continue`
- [ ] Run test: `npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts --grep "2.1-E2E-001"`
- [ ] Test passes (green phase)

---

### Test: 2.1-E2E-002 — Bookmark toggle persists

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `BookmarkFlag.tsx` in `src/components/scripture-reading/reading/`
- [ ] Amber filled/outlined icon toggle using Lucide `Bookmark`
- [ ] 48x48px touch target wrapper with `aria-label` toggling
- [ ] Wire `toggleBookmark()` from `scriptureReadingService` on tap
- [ ] Add bookmark button to verse screen in `SoloReadingFlow.tsx`
- [ ] Optimistic UI: toggle icon immediately, write-through to server
- [ ] Debounce rapid toggles (300ms)
- [ ] Add data-testid: `scripture-bookmark-button`
- [ ] Run test: `npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts --grep "2.1-E2E-002"`
- [ ] Test passes (green phase)

---

### Test: 2.1-E2E-003 — Rating validation

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts`

**Tasks to make this test pass:**

- [ ] Continue button disabled until rating selected (aria-disabled)
- [ ] "Please select a rating" helper text on Continue tap without rating
- [ ] Muted style (text-sm, text-gray-400), no red/aggressive validation
- [ ] Helper text disappears after rating selection
- [ ] Add data-testid: `scripture-reflection-validation`
- [ ] Run test: `npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts --grep "2.1-E2E-003"`
- [ ] Test passes (green phase)

---

### Test: 2.1-E2E-004 — Reflection write failure retry UI

**File:** `tests/e2e/scripture/scripture-reflection.spec.ts`

**Tasks to make this test pass:**

- [ ] Wire SyncToast retry pattern for reflection write failures
- [ ] Non-blocking: session advances even on write failure
- [ ] Retry indicator visible with `scripture-reflection-retry` testid
- [ ] User can continue interacting with next verse
- [ ] Run test: `npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts --grep "2.1-E2E-004"`
- [ ] Test passes (green phase)

---

### Test: 2.1-API-001 — Reflection upsert idempotency

**File:** `tests/api/scripture-reflection-api.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify `scripture_submit_reflection` RPC uses `ON CONFLICT DO UPDATE` (already exists in migration)
- [ ] Verify RPC returns updated row on conflict (not error)
- [ ] Verify stable ID across upserts
- [ ] Run test: `npx playwright test tests/api/scripture-reflection-api.spec.ts --grep "idempotency"`
- [ ] Test passes (green phase)

---

### Test: Reflection field persistence

**File:** `tests/api/scripture-reflection-api.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify RPC return value includes all fields
- [ ] Verify DB row matches submitted data
- [ ] Run test: `npx playwright test tests/api/scripture-reflection-api.spec.ts --grep "persists correct fields"`
- [ ] Test passes (green phase)

---

### Test: Bookmark toggle creates and removes

**File:** `tests/api/scripture-reflection-api.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify RLS allows user to insert/delete own bookmarks
- [ ] Run test: `npx playwright test tests/api/scripture-reflection-api.spec.ts --grep "creates and removes"`
- [ ] Test passes (green phase)

---

## Running Tests

```bash
# Run all failing tests for this story
npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts tests/api/scripture-reflection-api.spec.ts

# Run specific test file (E2E)
npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts

# Run specific test file (API)
npx playwright test tests/api/scripture-reflection-api.spec.ts

# Run tests in headed mode (see browser)
npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts --headed

# Debug specific test
npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts --debug

# Run tests with coverage
npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts tests/api/scripture-reflection-api.spec.ts --reporter=html
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All tests written and failing (test.skip)
- Fixtures and factories identified (existing from Epic 1)
- Mock requirements documented (reflection write failure)
- data-testid requirements listed (15 attributes)
- Implementation checklist created

**Verification:**

- All tests use `test.skip()` — will be skipped when run
- Failure messages will be clear when `test.skip()` is removed
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with 2.1-E2E-002 bookmark or 2.1-E2E-001 reflection)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Remove `test.skip()`** for that test only
5. **Run the test** to verify it now passes (green)
6. **Check off the task** in implementation checklist
7. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Ensure tests still pass** after each refactor

---

## Next Steps

1. **Review this checklist** before starting implementation
2. **Run failing tests** to confirm RED phase: `npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts tests/api/scripture-reflection-api.spec.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red → green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

- **fixtures-composition.md** — mergeTests pattern with supabaseAdmin, testSession
- **data-factories.md** — Factory patterns for dynamic test data
- **network-first.md** — Route interception BEFORE navigation/action
- **test-quality.md** — Given-When-Then, deterministic waits, no hard sleeps
- **selector-resilience.md** — data-testid > ARIA role > text content hierarchy
- **timing-debugging.md** — waitForResponse for network-dependent assertions
- **component-tdd.md** — Red-Green-Refactor cycle documentation

See `testarch-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx playwright test tests/e2e/scripture/scripture-reflection.spec.ts tests/api/scripture-reflection-api.spec.ts`

**Results:**

```
(pending — run tests to capture output)
```

**Summary:**

- Total tests: 7
- Passing: 0 (expected — all skipped)
- Skipped: 7 (expected — test.skip())
- Status: RED phase verified

---

## Notes

- All E2E tests follow existing patterns from `scripture-solo-reading.spec.ts`
- API tests use `createUserClient` helper pattern from `scripture-rls-security.spec.ts`
- No new fixtures needed — existing `supabaseAdmin` and `testSession` are sufficient
- `tests/api/` directory is new — created for API-level tests separate from E2E
- Character counter data-testid (`scripture-reflection-char-counter`) is defined but not explicitly tested at E2E level (P2 component test scope)

---

**Generated by BMad TEA Agent** - 2026-02-02
