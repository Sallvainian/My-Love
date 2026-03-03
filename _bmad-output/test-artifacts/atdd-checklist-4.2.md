---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-02-27'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-2-synchronized-reading-with-lock-in.md'
  - '_bmad-output/test-artifacts/test-design-epic-4.md'
  - '_bmad-output/test-artifacts/atdd-checklist-4.1.md'
  - 'playwright.config.ts'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/component-tdd.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - '_bmad/tea/testarch/knowledge/selector-resilience.md'
  - '_bmad/tea/testarch/knowledge/timing-debugging.md'
---

# ATDD Checklist - Epic 4, Story 4.2: Synchronized Reading with Lock-In

**Date:** 2026-02-27
**Author:** Sallvain
**Primary Test Level:** E2E (multi-user realtime) + Unit (component + slice + hook)

---

## Story Summary

Couples read verses with clear Reader/Responder roles that alternate each step, navigate freely within each step, and advance together via mutual lock-in. Lock-in uses optimistic concurrency with version checking and rollback on conflict.

**As a** couple
**I want** to read verses with clear roles, navigate freely within each step, and advance together via mutual lock-in
**So that** we progress through scripture as a team without one partner rushing ahead

---

## Acceptance Criteria

1. **AC#1 Role Indicator:** Reader sees "You read this" (#A855F7 pill badge); Responder sees "Partner reads this" (#C084FC); roles alternate each step (reader on even steps, responder on odd)
2. **AC#2 Partner Position:** PartnerPosition indicator shows "[Name] is viewing the [verse/response]" via ephemeral presence channel (`scripture-presence:{session_id}`); throttled on view change + heartbeat every ~10s; stale presence drops after ~20s TTL
3. **AC#3 Lock-In:** "Ready for next verse" button calls `scripture_lock_in` RPC; optimistic `isPendingLockIn` state; button transforms to "Waiting for [Partner]..."
4. **AC#4 Undo Lock-In:** "Tap to undo" clears pending lock-in; partner sees "[PartnerName] is ready" indicator (no pressure language)
5. **AC#5 Both Lock → Advance:** Server bumps version + `current_step_index`; broadcasts `state_updated` with `triggeredBy: 'lock_in'`; both clients advance with animation; lock flags cleared
6. **AC#6 Version Mismatch (409):** `isPendingLockIn` rolled back; session refetched; subtle "Session updated" toast
7. **AC#7 Last Step → Reflection:** Step 17 lock-in transitions to `currentPhase='reflection'`; both partners enter existing reflection flow

---

## Failing Tests Created (RED Phase)

### Unit/Component Tests (34 tests)

#### scriptureReadingSlice.lockin.test.ts (11 tests)

**File:** `tests/unit/stores/scriptureReadingSlice.lockin.test.ts`

- **Test:** [P1] lockIn() sets isPendingLockIn to true optimistically
  - **Status:** RED (test.skip) -- lockIn() action not implemented yet
  - **Verifies:** AC#3 optimistic lock-in state
- **Test:** [P1] undoLockIn() sets isPendingLockIn to false optimistically
  - **Status:** RED (test.skip) -- undoLockIn() action not implemented yet
  - **Verifies:** AC#4 undo action
- **Test:** [P1] onPartnerLockInChanged(true) sets partnerLocked to true
  - **Status:** RED (test.skip) -- onPartnerLockInChanged not implemented yet
  - **Verifies:** AC#4 partner lock state
- **Test:** [P1] onPartnerLockInChanged(false) sets partnerLocked to false
  - **Status:** RED (test.skip) -- onPartnerLockInChanged not implemented yet
  - **Verifies:** AC#4 partner lock state
- **Test:** [P0] onBroadcastReceived with higher currentStepIndex clears lock flags and updates step
  - **Status:** RED (test.skip) -- step advance handling not implemented yet
  - **Verifies:** AC#5 both-lock advance
- **Test:** [P1] onBroadcastReceived with same step does NOT clear isPendingLockIn
  - **Status:** RED (test.skip) -- step advance guard not implemented yet
  - **Verifies:** AC#5 anti-race guard
- **Test:** [P0] lockIn() error with '409' in message -> rollback + scriptureError with 'Session updated'
  - **Status:** RED (test.skip) -- 409 error handling not implemented yet
  - **Verifies:** AC#6 version mismatch rollback
- **Test:** [P1] lockIn() other error -> rollback + SYNC_FAILED error
  - **Status:** RED (test.skip) -- generic error handling not implemented yet
  - **Verifies:** AC#6 error handling
- **Test:** [P1] undoLockIn() error -> rollback isPendingLockIn to true
  - **Status:** RED (test.skip) -- undoLockIn error handling not implemented yet
  - **Verifies:** AC#4 undo error rollback
- **Test:** [P0] onBroadcastReceived discards stale events (version <= local)
  - **Status:** RED (test.skip) -- anti-race version guard not implemented yet
  - **Verifies:** AC#5 + Risk E4-R02
- **Test:** [P1] onBroadcastReceived with phase 'reflection' transitions to reflection
  - **Status:** RED (test.skip) -- phase transition via broadcast not handled yet
  - **Verifies:** AC#7 last step reflection

#### useScripturePresence.test.ts (10 tests)

**File:** `tests/unit/hooks/useScripturePresence.test.ts`

- **Test:** [P1] does not join channel when sessionId is null
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 channel lifecycle guard
- **Test:** [P1] joins channel 'scripture-presence:{sessionId}' with private:true
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 private channel creation
- **Test:** [P1] calls setAuth before subscribing
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 auth before subscribe (security)
- **Test:** [P1] sends own presence immediately on SUBSCRIBED status
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 initial presence broadcast
- **Test:** [P1] re-sends presence when view prop changes
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 view change propagation
- **Test:** [P1] returns partner presence when presence_update broadcast received
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 partner presence reception
- **Test:** [P2] drops presence older than 20s TTL
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 stale presence TTL
- **Test:** [P1] resets partner presence to null on stepIndex change
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 step change reset
- **Test:** [P1] removes channel and clears interval on unmount
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 cleanup / no memory leak
- **Test:** [P2] sends heartbeat every 10s
  - **Status:** RED (test.skip) -- useScripturePresence hook doesn't exist yet
  - **Verifies:** AC#2 heartbeat interval

#### LockInButton.test.tsx (7 tests)

**File:** `src/components/scripture-reading/__tests__/LockInButton.test.tsx`

- **Test:** [P1] renders "Ready for next verse" when unlocked
  - **Status:** RED -- LockInButton component doesn't exist yet
  - **Verifies:** AC#3 unlocked button text
- **Test:** [P1] renders waiting state with partner name when locked
  - **Status:** RED -- LockInButton component doesn't exist yet
  - **Verifies:** AC#3 locked waiting state
- **Test:** [P1] calls onLockIn when button clicked in unlocked state
  - **Status:** RED -- LockInButton component doesn't exist yet
  - **Verifies:** AC#3 lock-in interaction
- **Test:** [P1] calls onUndoLockIn when "Tap to undo" clicked
  - **Status:** RED -- LockInButton component doesn't exist yet
  - **Verifies:** AC#4 undo interaction
- **Test:** [P1] shows partner locked indicator when partnerLocked=true and user not locked
  - **Status:** RED -- LockInButton component doesn't exist yet
  - **Verifies:** AC#4 partner ready indicator
- **Test:** [P1] disables button when isPending=true
  - **Status:** RED -- LockInButton component doesn't exist yet
  - **Verifies:** AC#3 in-flight state
- **Test:** [P1] has accessible aria-label on main button
  - **Status:** RED -- LockInButton component doesn't exist yet
  - **Verifies:** Accessibility

#### RoleIndicator.test.tsx (4 tests)

**File:** `src/components/scripture-reading/__tests__/RoleIndicator.test.tsx`

- **Test:** [P1] renders "You read this" with reader color when role=reader
  - **Status:** RED -- RoleIndicator component doesn't exist yet
  - **Verifies:** AC#1 reader pill badge
- **Test:** [P1] renders "Partner reads this" with responder color when role=responder
  - **Status:** RED -- RoleIndicator component doesn't exist yet
  - **Verifies:** AC#1 responder pill badge
- **Test:** [P1] has correct aria-label for reader role
  - **Status:** RED -- RoleIndicator component doesn't exist yet
  - **Verifies:** AC#1 accessibility
- **Test:** [P1] has correct aria-label for responder role
  - **Status:** RED -- RoleIndicator component doesn't exist yet
  - **Verifies:** AC#1 accessibility

#### PartnerPosition.test.tsx (4 tests)

**File:** `src/components/scripture-reading/__tests__/PartnerPosition.test.tsx`

- **Test:** [P1] renders nothing when presence.view is null
  - **Status:** RED -- PartnerPosition component doesn't exist yet
  - **Verifies:** AC#2 no stale indicator
- **Test:** [P1] shows "[Name] is reading the verse" when view=verse
  - **Status:** RED -- PartnerPosition component doesn't exist yet
  - **Verifies:** AC#2 verse position
- **Test:** [P1] shows "[Name] is reading the response" when view=response
  - **Status:** RED -- PartnerPosition component doesn't exist yet
  - **Verifies:** AC#2 response position
- **Test:** [P1] has aria-live="polite" for screen reader updates
  - **Status:** RED -- PartnerPosition component doesn't exist yet
  - **Verifies:** AC#2 accessibility

#### ReadingContainer.test.tsx (9 tests)

**File:** `src/components/scripture-reading/__tests__/ReadingContainer.test.tsx`

- **Test:** [P1] renders role indicator with correct role
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#1 role integration
- **Test:** [P1] renders step progress indicator
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#1 step progress display
- **Test:** [P1] calls lockIn when lock-in button clicked
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#3 lock-in wiring
- **Test:** [P1] calls undoLockIn when undo clicked in locked state
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#4 undo wiring
- **Test:** [P1] shows responder role indicator on odd step (effectiveRole alternation)
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#1 role alternation
- **Test:** [P1] shows reader role indicator on even step
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#1 role alternation
- **Test:** [P1] shows "Session updated" toast when SYNC_FAILED error with Session updated message
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#6 toast display
- **Test:** [P1] renders reading-container root element
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** Container renders
- **Test:** [P1] renders verse/response navigation tabs
  - **Status:** RED -- ReadingContainer component doesn't exist yet
  - **Verifies:** AC#1 tab navigation

### E2E Tests (4 tests)

**File:** `tests/e2e/scripture/scripture-reading-4.2.spec.ts`

- **Test:** [P0] 4.2-E2E-001: Full lock-in flow -- both users lock in -> advance to step 2 with role alternation
  - **Status:** RED (test.skip at describe level) -- ReadingContainer and lock-in RPCs not implemented
  - **Verifies:** AC#1 + AC#3 + AC#4 + AC#5 (full lock-in journey)
- **Test:** [P1] 4.2-E2E-002: Undo lock-in -- user locks -> taps undo -> reverts to unlocked
  - **Status:** RED (test.skip at describe level) -- Lock-in undo flow not implemented
  - **Verifies:** AC#4 (undo flow)
- **Test:** [P1] 4.2-E2E-003: Role alternation -- roles swap across 3 steps (Reader -> Responder -> Reader)
  - **Status:** RED (test.skip at describe level) -- Role alternation not implemented
  - **Verifies:** AC#1 (role alternation across steps)
- **Test:** [P1] 4.2-E2E-004: Last step completion -- session seeded at step 16 -> both lock in -> reflection phase
  - **Status:** RED (test.skip at describe level) -- Reflection transition not implemented
  - **Verifies:** AC#7 (last step -> reflection)

---

## Data Factories Required

No new factories needed. Existing factories from `tests/support/factories/index.ts` cover Story 4.2:

- `createTestSession(supabase, { preset: 'mid_session' })` -- creates a together-mode session in reading phase
- `linkTestPartners(supabase, user1Id, user2Id)` -- links user pair as partners
- `unlinkTestPartners(supabase, user1Id, user2Id)` -- unlinks partner pair
- `cleanupTestSession(supabase, sessionIds)` -- removes session data

**Note for 4.2-E2E-004:** The last-step test seeds session at `current_step_index: 16` via direct DB update (`supabaseAdmin.from('scripture_sessions').update(...)`) since no `last_step` preset exists yet. Consider adding a `last_step` preset to `scripture_seed_test_data` RPC if this pattern is needed by Story 4.3.

---

## Fixtures Required

No new Playwright fixtures needed. Existing fixtures cover Story 4.2:

- `workerAuthFixture` (from `tests/support/fixtures/worker-auth.ts`) -- worker-isolated auth pairs
- `partnerStorageStatePath` -- secondary browser context for partner user
- `supabaseAdmin` -- admin API client for test setup/cleanup
- `scriptureNavFixture` -- scripture navigation helpers

---

## Mock Requirements

### Supabase Broadcast Channel (useScripturePresence tests)

**For:** `tests/unit/hooks/useScripturePresence.test.ts`

```typescript
const mocks = vi.hoisted(() => {
  const send = vi.fn().mockResolvedValue(undefined);
  const on = vi.fn();
  const subscribe = vi.fn();
  const channel = vi.fn();
  const removeChannel = vi.fn().mockResolvedValue(undefined);
  const setAuth = vi.fn().mockResolvedValue(undefined);
  const mockChannel = { on, subscribe, send };
  channel.mockReturnValue(mockChannel);
  return { send, on, subscribe, channel, removeChannel, setAuth, mockChannel };
});

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
    realtime: { setAuth: mocks.setAuth },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'current-user-id' } } }),
    },
  },
}));
```

### Supabase RPC Mocks (slice lock-in tests)

**For:** `tests/unit/stores/scriptureReadingSlice.lockin.test.ts`

```typescript
const mockRpc = vi.fn();
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));
```

### Zustand Store Mock (ReadingContainer tests)

**For:** `src/components/scripture-reading/__tests__/ReadingContainer.test.tsx`

```typescript
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector(mockStoreState)),
}));
vi.mock('../../../hooks/useScripturePresence', () => ({
  useScripturePresence: vi.fn().mockReturnValue({ view: null, stepIndex: null, ts: null }),
}));
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
```

### scriptureReadingService Mock (slice tests)

**For:** `tests/unit/stores/scriptureReadingSlice.lockin.test.ts`

```typescript
vi.mock('../../../src/services/scriptureReadingService', () => ({
  scriptureReadingService: {
    createSession: vi.fn(),
    getSession: mockGetSession,
    getUserSessions: vi.fn(),
    updateSession: vi.fn(),
    addReflection: vi.fn(),
    getCoupleStats: vi.fn(),
    recoverSessionCache: vi.fn(),
  },
  ScriptureErrorCode: {
    VERSION_MISMATCH: 'VERSION_MISMATCH',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SYNC_FAILED: 'SYNC_FAILED',
    OFFLINE: 'OFFLINE',
    CACHE_CORRUPTED: 'CACHE_CORRUPTED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
  },
  handleScriptureError: vi.fn(),
}));
```

---

## Required `data-testid` Attributes

### ReadingContainer

- `reading-container` -- ReadingContainer root `<div>`
- `reading-step-progress` -- "Verse X of 17" progress header
- `reading-verse-text` -- verse text content area (Playfair Display font)
- `reading-response-text` -- response text content area
- `reading-tab-verse` -- verse navigation tab/button
- `reading-tab-response` -- response navigation tab/button

### RoleIndicator

- `role-indicator` -- role pill badge `<span>` (Reader: #A855F7, Responder: #C084FC)

### LockInButton

- `lock-in-button` -- "Ready for next verse" / "Waiting for..." primary button
- `lock-in-undo` -- "Tap to undo" link (visible only when locked)
- `partner-locked-indicator` -- "[PartnerName] is ready" indicator

### PartnerPosition

- `partner-position` -- partner view position indicator with `aria-live="polite"`

### Error Toast

- `session-update-toast` -- "Session updated" toast (3s, non-blocking, muted purple)

---

## Running Tests

### Unit Tests

```bash
# Run all Story 4.2 unit tests
npx vitest run tests/unit/stores/scriptureReadingSlice.lockin.test.ts --silent
npx vitest run tests/unit/hooks/useScripturePresence.test.ts --silent

# Run all Story 4.2 component tests
npx vitest run src/components/scripture-reading/__tests__/LockInButton.test.tsx --silent
npx vitest run src/components/scripture-reading/__tests__/RoleIndicator.test.tsx --silent
npx vitest run src/components/scripture-reading/__tests__/PartnerPosition.test.tsx --silent
npx vitest run src/components/scripture-reading/__tests__/ReadingContainer.test.tsx --silent

# Run all unit tests (includes Story 4.2 + regression)
npm run test:unit
```

### E2E Tests

```bash
# Run Story 4.2 E2E tests
npx playwright test tests/e2e/scripture/scripture-reading-4.2.spec.ts

# Run all P0 tests (includes Story 4.2)
npm run test:p0

# Run P0 + P1 tests
npm run test:p1
```

### Database Tests

```bash
# Run pgTAP tests (includes 4.2-DB-* after migration created)
npm run test:db
```

---

## Red-Green-Refactor Workflow

### Phase 1: RED -- All tests fail (current state)

All 34 unit/component tests use `test.skip()` and all 4 E2E tests use `test.skip(true, ...)` at the describe level. They assert expected behavior for code that does not yet exist.

### Phase 2: GREEN -- Implement to pass tests

Implementation order (follows story Task numbering):

1. **Task 1:** DB Migration (`supabase/migrations/20260222000001_scripture_lock_in.sql`)
   - `scripture_lock_in` and `scripture_undo_lock_in` RPCs
   - Presence channel RLS policies
   - Remove pgTAP `test.skip` markers after migration

2. **Task 2-3:** Extend scriptureReadingSlice
   - Add `partnerLocked` state, `lockIn()`, `undoLockIn()`, `onPartnerLockInChanged()` actions
   - Extend `onBroadcastReceived` for step advance
   - Remove `test.skip` from `scriptureReadingSlice.lockin.test.ts`

3. **Task 4:** Create `useScripturePresence` hook
   - Remove `test.skip` from `useScripturePresence.test.ts`

4. **Task 5:** Extend `useScriptureBroadcast` for `lock_in_status_changed`

5. **Task 6-8:** Create presentational components (LockInButton, RoleIndicator, PartnerPosition)
   - Component tests will pass once components exist (no `test.skip` -- they import directly)

6. **Task 9-10:** Create ReadingContainer + update ScriptureOverview routing
   - Move `useScriptureBroadcast` to ScriptureOverview
   - ReadingContainer tests will pass once component exists

7. **Task 14:** Remove `test.skip` from E2E test describes

### Phase 3: REFACTOR -- Clean up

- Extract shared test helpers if patterns repeat
- Verify no duplicate `useScriptureBroadcast` subscriptions
- Verify cleanup (no memory leaks in `useScripturePresence`)
- Run full regression: `npm run test:unit && npm run test:e2e`

---

## Next Steps

1. **Begin implementation** following the Task order in the story spec
2. **Remove `test.skip` markers** incrementally as each feature is implemented
3. **Run tests after each task** to verify GREEN status
4. **Create pgTAP tests** for lock-in RPCs as part of Task 12 (DB-level tests in `supabase/tests/database/11_scripture_lockin.sql`)
5. **Update `project-structure-boundaries.md`** with new files (exit criterion per Epic 3 retro)

---

## Knowledge Base References Applied

- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **component-tdd.md** - Component test strategies, Red-Green-Refactor loop, provider isolation
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-healing-patterns.md** - Common failure patterns and automated fixes
- **selector-resilience.md** - data-testid hierarchy, robust selector strategies
- **timing-debugging.md** - Race condition identification and deterministic wait fixes

---

## Test Execution Evidence

### RED Phase Verification

All tests confirmed in RED state:

- **Unit tests:** 21 `test.skip()` tests across 2 files (slice + hook)
- **Component tests:** 24 tests across 4 files (LockInButton: 7, RoleIndicator: 4, PartnerPosition: 4, ReadingContainer: 9) -- will fail on import since components don't exist
- **E2E tests:** 4 `test.skip(true, ...)` tests at describe level across 4 test describes

**Total: 45 tests (34 unit/component + 4 E2E + 7 pgTAP pending)**

---

## Notes

- E2E tests use the dual-browser pattern from Story 4.1: `page` (User A) + `partnerPage` via `browser.newContext({ storageState: partnerStorageStatePath })`
- Network-first pattern applied: `waitForResponse(isLockInResponse)` before asserting UI state changes
- The `last_step` E2E test (4.2-E2E-004) seeds step 16 via direct DB update; a `last_step` factory preset may be useful for Story 4.3
- `useScripturePresence` tests use `vi.useFakeTimers()` for deterministic heartbeat testing (10s interval)
- Component tests do NOT use `test.skip` -- they will fail on import (`LockInButton`, `RoleIndicator`, `PartnerPosition`, `ReadingContainer` don't exist yet), which is the correct RED behavior
- Story 4.2 introduces a second Broadcast channel (`scripture-presence:{session_id}`) alongside the existing `scripture-session:{session_id}` -- tests verify both channels independently

---

**Generated by BMad TEA Agent** - 2026-02-27
