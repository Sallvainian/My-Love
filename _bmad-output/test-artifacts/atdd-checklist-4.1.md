---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-02-20'
---

# ATDD Checklist - Epic 4, Story 4.1: Lobby, Role Selection & Countdown

**Date:** 2026-02-20
**Author:** Sallvain
**Primary Test Level:** E2E (multi-user realtime) + Unit (component + slice + hook)

---

## Story Summary

As a user, I want to select my role, enter a lobby, ready up with my partner, and experience a synchronized countdown, so that we begin reading together with shared anticipation.

**As a** user
**I want** to select a role (Reader/Responder), enter a lobby, toggle ready state, and experience a synchronized countdown
**So that** both partners begin the scripture reading session simultaneously with shared anticipation

---

## Acceptance Criteria

1. **AC#1 Role Selection:** Role selection screen appears with "Reader" ("You read the verse") and "Responder" ("You read the response") options; selected role is stored on `scripture_session`
2. **AC#2 Lobby Waiting:** Lobby shows "Waiting for [Partner Name]..." with animation; "Continue solo" tertiary button available; Supabase Broadcast channel `scripture-session:{session_id}` joined with `private: true`
3. **AC#3 Partner Presence:** When both in lobby, partner join status shown ("Jordan has joined"); "Ready" toggle visible for both; ready state changes broadcast in real-time
4. **AC#4 Ready Toggle:** Broadcast sends ready state to partner; button updates to "Ready ✓" (primary) / "Not Ready" (secondary); aria-live="polite" announces partner ready state
5. **AC#5 Countdown:** 3-second server-authoritative countdown (3...2...1) with scale/fade animation; reduced-motion: static number; screen reader announces "Session starting in 3 seconds" / "Session started"; countdown container focused; first verse loads after countdown
6. **AC#6 Continue Solo:** Session converts to solo mode; mode updates to 'solo' on server; broadcast channel cleaned up

---

## Failing Tests Created (RED Phase)

### Unit/Component Tests (30 tests)

#### LobbyContainer.test.tsx (11 tests)

**File:** `src/components/scripture-reading/__tests__/LobbyContainer.test.tsx`

- ✅ **Test:** renders role selection screen when myRole is null (Phase A)
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#1 role selection screen renders
- ✅ **Test:** Reader card click calls selectRole('reader')
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#1 role selection interaction
- ✅ **Test:** Responder card click calls selectRole('responder')
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#1 role selection interaction
- ✅ **Test:** renders lobby waiting screen in Phase B (myRole set, phase=lobby)
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#2 lobby waiting screen
- ✅ **Test:** shows "Waiting for [Partner Name]..." when partnerJoined=false
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#2 waiting state
- ✅ **Test:** shows "[Partner Name] has joined!" when partnerJoined=true
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#3 partner presence
- ✅ **Test:** ready button calls toggleReady(true) when not ready
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#4 ready toggle
- ✅ **Test:** ready button calls toggleReady(false) when already ready
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#4 ready toggle undo
- ✅ **Test:** aria-live region announces partner ready state
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#4 accessibility announcement
- ✅ **Test:** continue solo button calls convertToSolo
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#6 continue solo
- ✅ **Test:** renders Countdown component when countdownStartedAt is set (Phase C)
  - **Status:** RED — `LobbyContainer` component doesn't exist yet
  - **Verifies:** AC#5 countdown routing

#### Countdown.test.tsx (7 tests)

**File:** `src/components/scripture-reading/__tests__/Countdown.test.tsx`

- ✅ **Test:** [P0] renders digit 3 on mount when startedAt is recent
  - **Status:** RED — `Countdown` component doesn't exist yet
  - **Verifies:** AC#5 countdown display
- ✅ **Test:** [P0] calls onComplete after 3 seconds (via fake timers)
  - **Status:** RED — `Countdown` component doesn't exist yet
  - **Verifies:** AC#5 onComplete callback
- ✅ **Test:** [P1] focuses countdown-container on mount
  - **Status:** RED — `Countdown` component doesn't exist yet
  - **Verifies:** AC#5 focus management
- ✅ **Test:** [P1] announces "Session starting in 3 seconds" via aria-live on mount
  - **Status:** RED — `Countdown` component doesn't exist yet
  - **Verifies:** AC#5 screen reader announcement
- ✅ **Test:** [P1] announces "Session started" via aria-live on completion
  - **Status:** RED — `Countdown` component doesn't exist yet
  - **Verifies:** AC#5 completion announcement
- ✅ **Test:** [P1] calls onComplete immediately when startedAt >= 3000ms ago (clock skew)
  - **Status:** RED — `Countdown` component doesn't exist yet
  - **Verifies:** AC#5 clock skew handling
- ✅ **Test:** [P2] does not animate when shouldReduceMotion=true
  - **Status:** RED — `Countdown` component doesn't exist yet
  - **Verifies:** AC#5 reduced-motion support

#### useScriptureBroadcast.test.ts (8 tests)

**File:** `tests/unit/hooks/useScriptureBroadcast.test.ts`

- ✅ **Test:** [P1] does not join channel when sessionId is null
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#2 channel lifecycle
- ✅ **Test:** [P0] calls supabase.realtime.setAuth before subscribe
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#2 auth before subscribe (security requirement)
- ✅ **Test:** [P1] joins channel 'scripture-session:{sessionId}' with private:true
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#2 channel name and security
- ✅ **Test:** [P0] does NOT subscribe twice when sessionId unchanged (StrictMode guard)
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#2 no duplicate subscriptions
- ✅ **Test:** [P1] broadcasts partner_joined event on SUBSCRIBED
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#3 partner presence broadcast
- ✅ **Test:** [P1] calls onPartnerJoined when partner_joined event received
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#3 partner joined action
- ✅ **Test:** [P1] calls onPartnerReady when ready_state_changed event received
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#4 partner ready broadcast
- ✅ **Test:** [P1] calls supabase.removeChannel on cleanup
  - **Status:** RED — `useScriptureBroadcast` hook doesn't exist yet
  - **Verifies:** AC#6 broadcast cleanup

#### scriptureReadingSlice.lobby.test.ts (8 tests, 9 test.skip assertions)

**File:** `tests/unit/stores/scriptureReadingSlice.lobby.test.ts`

- ✅ **Test:** [P1] initial lobby state is all null/false
  - **Status:** RED — lobby state fields not yet on slice
  - **Verifies:** Initial state contract
- ✅ **Test:** [P1] selectRole sets myRole and updates phase to lobby
  - **Status:** RED — `selectRole` action doesn't exist yet
  - **Verifies:** AC#1 role selection → slice update
- ✅ **Test:** [P1] toggleReady(true) sets myReady optimistically (before await)
  - **Status:** RED — `toggleReady` action doesn't exist yet
  - **Verifies:** AC#4 optimistic ready state
- ✅ **Test:** [P1] toggleReady rolls back myReady on RPC error
  - **Status:** RED — `toggleReady` action doesn't exist yet
  - **Verifies:** AC#4 error rollback
- ✅ **Test:** [P1] onPartnerJoined sets partnerJoined to true
  - **Status:** RED — `onPartnerJoined` action doesn't exist yet
  - **Verifies:** AC#3 partner joined state
- ✅ **Test:** [P1] onPartnerReady sets partnerReady
  - **Status:** RED — `onPartnerReady` action doesn't exist yet
  - **Verifies:** AC#4 partner ready state
- ✅ **Test:** [P1] onCountdownStarted sets countdownStartedAt
  - **Status:** RED — `onCountdownStarted` action doesn't exist yet
  - **Verifies:** AC#5 countdown trigger
- ✅ **Test:** [P1] convertToSolo resets all lobby state and sets mode=solo, phase=reading
  - **Status:** RED — `convertToSolo` action doesn't exist yet
  - **Verifies:** AC#6 convert to solo

### E2E Tests (2 tests)

**File:** `tests/e2e/scripture/scripture-lobby-4.1.spec.ts`

- ✅ **Test:** [P0] 4.1-E2E-001: Full lobby flow — User A + User B → roles → lobby → both ready → countdown → first verse
  - **Status:** RED — `LobbyContainer`, `useScriptureBroadcast`, RPCs, migration not implemented
  - **Verifies:** AC#1 + AC#2 + AC#3 + AC#4 + AC#5 (full together-mode journey)
- ✅ **Test:** [P1] 4.1-E2E-002: Continue solo fallback — user alone in lobby → taps "Continue solo" → solo reading
  - **Status:** RED — `LobbyContainer`, `scripture_convert_to_solo` RPC not implemented
  - **Verifies:** AC#6 (continue solo flow)

### pgTAP Database Tests (4 tests)

**File:** `supabase/tests/database/10_scripture_lobby.sql`

- ✅ **Test:** [P1] 4.1-DB-001: Role assignment — user1_role persisted, user2_role stays null
  - **Status:** RED — `scripture_session_role` ENUM and new columns don't exist yet
  - **Verifies:** AC#1 DB persistence
- ✅ **Test:** [P1] 4.1-DB-002: Both users ready → countdown_started_at set, phase=countdown
  - **Status:** RED — `scripture_toggle_ready` RPC doesn't exist yet
  - **Verifies:** AC#5 server-authoritative countdown trigger
- ✅ **Test:** [P1] 4.1-DB-003: Only user1 ready → countdown_started_at remains null
  - **Status:** RED — `scripture_toggle_ready` RPC doesn't exist yet
  - **Verifies:** AC#5 partial ready state
- ✅ **Test:** [P0] 4.1-DB-004: RLS security — user cannot set partner's ready state or role
  - **Status:** RED — RLS policies not implemented yet
  - **Verifies:** DB security boundary

---

## Data Factories Required

No new factories needed — existing `createTestSession`, `linkTestPartners`, and `cleanupTestSession` from `tests/support/factories/index.ts` cover Story 4.1 needs.

**For E2E-001 (together-mode session):** Use `createTestSession(supabase, { preset: 'together_lobby' })` — this preset will need to be added to `scripture_seed_test_data` RPC as part of the migration.

---

## Fixtures Required

No new Playwright fixtures needed — existing `workerAuthFixture` (provides `{ user, partner, supabase }`) and `scriptureNavFixture` cover Story 4.1.

For E2E-001, the test creates a secondary `BrowserContext` for the partner user using `workerStorageStatePath` (from `worker-auth.ts`).

---

## Mock Requirements

### Supabase Broadcast Channel (unit tests only)

**For:** `useScriptureBroadcast.test.ts` and `LobbyContainer.test.tsx`

```typescript
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  state: 'subscribed' as const,
};
const mockRemoveChannel = vi.fn();
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}));
```

### Supabase RPC Mocks (slice unit tests)

`scripture_select_role`, `scripture_toggle_ready`, `scripture_convert_to_solo` RPCs are mocked via `vi.mock('../../../src/api/supabaseClient')` with `mockRpc`.

---

## Required `data-testid` Attributes

### LobbyContainer (Phase A — Role Selection)

- `lobby-role-selection` — role selection screen root `<div>`
- `lobby-role-reader` — Reader card `<button>` element
- `lobby-role-responder` — Responder card `<button>` element

### LobbyContainer (Phase B — Lobby Waiting)

- `lobby-waiting` — lobby waiting screen root `<div>`
- `lobby-partner-status` — partner joined/waiting indicator `<p>` (aria-live region)
- `lobby-ready-button` — Ready toggle `<button>`
- `lobby-partner-ready` — partner ready state indicator `<p>`
- `lobby-continue-solo` — "Continue solo" `<button>` (tertiary)

### Countdown Component

- `countdown-container` — countdown root `<div>` (tabIndex={-1}, receives focus on mount)
- `countdown-digit` — the displayed digit `<span>` (3, 2, or 1)

**Implementation Example:**

```tsx
{/* Phase A */}
<div data-testid="lobby-role-selection">
  <button data-testid="lobby-role-reader" onClick={() => selectRole('reader')}>
    Reader <span>You read the verse</span>
  </button>
  <button data-testid="lobby-role-responder" onClick={() => selectRole('responder')}>
    Responder <span>You read the response</span>
  </button>
</div>

{/* Phase B */}
<div data-testid="lobby-waiting">
  <p data-testid="lobby-partner-status" aria-live="polite">
    {partnerJoined ? `${partner.displayName} has joined!` : `Waiting for ${partner.displayName}...`}
  </p>
  <button data-testid="lobby-ready-button" onClick={() => toggleReady(!myReady)}>
    {myReady ? 'Ready ✓' : "I'm Ready"}
  </button>
  <p data-testid="lobby-partner-ready">
    {partnerReady ? `${partner.displayName} is ready` : `${partner.displayName}...`}
  </p>
  <button data-testid="lobby-continue-solo" onClick={convertToSolo}>
    Continue solo
  </button>
</div>

{/* Countdown */}
<div data-testid="countdown-container" tabIndex={-1} ref={containerRef} aria-live="assertive">
  <span data-testid="countdown-digit">{currentDigit}</span>
</div>
```

---

## Implementation Checklist

### Test: renders role selection screen (LobbyContainer Phase A)

**File:** `src/components/scripture-reading/__tests__/LobbyContainer.test.tsx`

**Tasks to make this test pass:**

- [ ] Create `src/components/scripture-reading/containers/LobbyContainer.tsx`
- [ ] Add lobby state fields to `scriptureReadingSlice.ts`: `myRole`, `partnerJoined`, `myReady`, `partnerReady`, `countdownStartedAt`
- [ ] Add `selectRole`, `toggleReady`, `convertToSolo`, `onPartnerJoined`, `onPartnerReady`, `onCountdownStarted` actions
- [ ] Implement Phase A: role selection screen when `!myRole`
- [ ] Add `data-testid="lobby-role-selection"`, `"lobby-role-reader"`, `"lobby-role-responder"`
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/LobbyContainer.test.tsx`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: lobby waiting screen (LobbyContainer Phase B)

**File:** `src/components/scripture-reading/__tests__/LobbyContainer.test.tsx`

**Tasks to make this test pass:**

- [ ] Implement Phase B: lobby waiting screen when `myRole` set + `currentPhase === 'lobby'`
- [ ] Add `data-testid="lobby-waiting"`, `"lobby-partner-status"`, `"lobby-ready-button"`, `"lobby-partner-ready"`, `"lobby-continue-solo"`
- [ ] Add `aria-live="polite"` region wrapping partner status
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/LobbyContainer.test.tsx`
- [ ] ✅ Test passes

**Estimated Effort:** 2 hours

---

### Test: Countdown component (all 7 tests)

**File:** `src/components/scripture-reading/__tests__/Countdown.test.tsx`

**Tasks to make this test pass:**

- [ ] Create `src/components/scripture-reading/session/Countdown.tsx`
- [ ] Props: `startedAt: number`, `onComplete: () => void`
- [ ] Derive digit: `Math.max(0, Math.ceil(3 - (Date.now() - startedAt) / 1000))`
- [ ] Focus `countdown-container` on mount via `useRef + useEffect`
- [ ] `aria-live="assertive"` announces "Session starting in 3 seconds" on mount
- [ ] Call `onComplete()` when digit reaches 0; announce "Session started"
- [ ] Handle clock skew: if `Date.now() - startedAt >= 3000` on mount → immediate `onComplete()`
- [ ] Reduced-motion: no scale/fade CSS classes when `shouldReduceMotion=true`
- [ ] Add `data-testid="countdown-container"` and `data-testid="countdown-digit"`
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/Countdown.test.tsx`
- [ ] ✅ All 7 tests pass

**Estimated Effort:** 2 hours

---

### Test: useScriptureBroadcast hook (all 8 tests)

**File:** `tests/unit/hooks/useScriptureBroadcast.test.ts`

**Tasks to make this test pass:**

- [ ] Create `src/hooks/useScriptureBroadcast.ts`
- [ ] Accept `sessionId: string | null` (returns nothing)
- [ ] On non-null sessionId: `await supabase.realtime.setAuth()` THEN join channel
- [ ] Channel: `supabase.channel('scripture-session:{sessionId}', { config: { private: true } })`
- [ ] Guard: check `channelRef.current?.state === 'subscribed'` before subscribing
- [ ] On SUBSCRIBED: broadcast `partner_joined` with `{ user_id: currentUserId }`
- [ ] Listen `partner_joined` → dispatch `onPartnerJoined()`
- [ ] Listen `ready_state_changed` → dispatch `onPartnerReady(payload.is_ready)`
- [ ] Cleanup: `supabase.removeChannel(channel)`
- [ ] Export from `src/hooks/index.ts`
- [ ] Run test: `npx vitest run tests/unit/hooks/useScriptureBroadcast.test.ts`
- [ ] ✅ All 8 tests pass

**Estimated Effort:** 2 hours

---

### Test: scriptureReadingSlice lobby actions (all 8 tests)

**File:** `tests/unit/stores/scriptureReadingSlice.lobby.test.ts`

**Tasks to make this test pass:**

- [ ] Add to `ScriptureReadingState` in `scriptureReadingSlice.ts`:
  ```typescript
  myRole: SessionRole | null;
  partnerJoined: boolean;
  myReady: boolean;
  partnerReady: boolean;
  countdownStartedAt: number | null;
  ```
- [ ] Add `SessionRole = 'reader' | 'responder'` export
- [ ] Initialize all new fields in `initialScriptureState` (null/false)
- [ ] Implement `selectRole(role)`, `toggleReady(isReady)` with optimistic update + rollback, `convertToSolo()`, `onPartnerJoined()`, `onPartnerReady(isReady)`, `onCountdownStarted(ts)`
- [ ] Run test: `npx vitest run tests/unit/stores/scriptureReadingSlice.lobby.test.ts`
- [ ] ✅ All 8 tests pass

**Estimated Effort:** 3 hours

---

### Test: 4.1-DB-001 through 4.1-DB-004

**File:** `supabase/tests/database/10_scripture_lobby.sql`

**Tasks to make these tests pass:**

- [ ] Create new migration (UTC timestamp): `supabase/migrations/{ts}_scripture_lobby.sql`
  - Create `scripture_session_role` ENUM (`'reader'`, `'responder'`)
  - Add `user1_role`, `user2_role`, `user1_ready`, `user2_ready`, `countdown_started_at` columns
  - RLS policies on `realtime.messages` (SELECT + INSERT for session members)
  - Index on `scripture_sessions(user2_id, status)`
- [ ] Implement `scripture_select_role(p_session_id UUID, p_role TEXT)` RPC
- [ ] Implement `scripture_toggle_ready(p_session_id UUID, p_is_ready BOOLEAN)` RPC
- [ ] Implement `scripture_convert_to_solo(p_session_id UUID)` RPC
- [ ] Run: `supabase db reset && supabase test db`
- [ ] ✅ All 4 pgTAP tests pass

**Estimated Effort:** 4 hours

---

### Test: 4.1-E2E-001 + 4.1-E2E-002

**File:** `tests/e2e/scripture/scripture-lobby-4.1.spec.ts`

**Tasks to make these tests pass:**

- [ ] All DB + slice + hook + component tasks above complete
- [ ] Update `ScriptureOverview.tsx`: add routing condition for `mode=together` + `phase=lobby|countdown` → `<LobbyContainer />`
- [ ] Update `ScriptureOverview.tsx`: call `useScriptureBroadcast(session?.id ?? null)` in `LobbyContainer`
- [ ] Update `dbSchema.ts`: add `ScriptureSessionRole` type, update `ScriptureSession` interface
- [ ] Update `src/components/scripture-reading/index.ts`: export `LobbyContainer`, `Countdown`
- [ ] Update `src/hooks/index.ts`: export `useScriptureBroadcast`
- [ ] Remove `test.skip` from E2E tests
- [ ] Run test: `npx playwright test tests/e2e/scripture/scripture-lobby-4.1.spec.ts --project=chromium`
- [ ] ✅ Both E2E tests pass

**Estimated Effort:** 6 hours

---

## Running Tests

```bash
# Run all unit tests for this story (RED phase - they fail or skip)
npx vitest run \
  src/components/scripture-reading/__tests__/LobbyContainer.test.tsx \
  src/components/scripture-reading/__tests__/Countdown.test.tsx \
  tests/unit/hooks/useScriptureBroadcast.test.ts \
  tests/unit/stores/scriptureReadingSlice.lobby.test.ts \
  --silent

# Run E2E tests for this story (RED phase - all skipped)
npx playwright test tests/e2e/scripture/scripture-lobby-4.1.spec.ts --project=chromium

# Run E2E in headed mode (see browser)
npx playwright test tests/e2e/scripture/scripture-lobby-4.1.spec.ts --headed

# Debug specific E2E test
npx playwright test tests/e2e/scripture/scripture-lobby-4.1.spec.ts --debug

# Run pgTAP tests (RED phase - all skipped)
supabase test db

# Run all unit tests (CI)
npm run test:unit

# Run all E2E tests (CI)
npm run test:e2e
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All unit tests written and skip (implementation files don't exist)
- ✅ All E2E tests written and skip (feature not implemented)
- ✅ pgTAP tests written and skip (migration not applied)
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**

- Unit tests: 3 files fail with import error (correct — components don't exist), 1 file has 9 skipped tests
- E2E tests: all tests skipped via `test.skip(true, '[RED PHASE]...')`
- pgTAP: all tests skipped via `SELECT skip(...)`

---

### GREEN Phase (DEV Team — Next Steps)

**DEV Agent Responsibilities:**

1. **Create DB migration first** — schema changes are prerequisite for RPC tests
2. **Implement slice lobby actions** — other features depend on this
3. **Create `useScriptureBroadcast` hook** — needed by LobbyContainer
4. **Create `Countdown.tsx`** — presentational, test in isolation
5. **Create `LobbyContainer.tsx`** — orchestrates all above
6. **Update `ScriptureOverview.tsx`** — add routing
7. Remove `test.skip` from unit tests → run → verify GREEN
8. Remove `test.skip` from E2E tests → run → verify GREEN

**Key Principles:**

- One test at a time (don't try to fix all at once)
- DB migration first (unblocks all RPC tests)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)

---

### REFACTOR Phase (DEV Team — After All Tests Pass)

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, error handling, cleanup)
3. **Verify no empty catch blocks** — all errors go through `handleScriptureError()`
4. **Verify `useScriptureBroadcast` cleanup** — no memory leaks on unmount
5. **Ensure tests still pass** after each refactor
6. **Update `project-structure-boundaries.md`** — add `LobbyContainer.tsx`, `Countdown.tsx`, `useScriptureBroadcast.ts`

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Review implementation checklist** with team in standup
3. **Start implementation** following the order: DB migration → slice → hook → Countdown → LobbyContainer → ScriptureOverview routing
4. **Run tests after each implementation unit** (not all at once)
5. **When all tests pass**, refactor for quality
6. **Update `sprint-status.yaml`** story 4.1 status to 'in_review'

---

## Knowledge Base References Applied

- **fixtures-composition.md** — `mergeTests` pattern, E2E fixture composition
- **data-factories.md** — `createTestSession`, `linkTestPartners`, `cleanupTestSession` patterns
- **component-tdd.md** — Red-Green-Refactor loop, provider isolation, RTL patterns
- **test-quality.md** — Deterministic waits, no hard waits, self-cleaning tests
- **test-healing-patterns.md** — StrictMode double-mount guard pattern
- **selector-resilience.md** — `data-testid` hierarchy over CSS
- **timing-debugging.md** — `waitForResponse()` before navigation, no `waitForTimeout()`
- **intercept-network-call.md** — `interceptNetworkCall` fixture for RPC monitoring

---

## Test Execution Evidence (RED Phase Verification)

**Command:** `npx vitest run [4 files] --silent --reporter=dot`

**Results:**
```
Test Files: 3 failed | 1 skipped (4)
      Tests: 9 skipped (9)
   Duration: 1.68s
```

**Summary:**
- 3 files fail with `Failed to resolve import` (components/hook don't exist) → ✅ Expected RED
- 1 file (`scriptureReadingSlice.lobby.test.ts`) runs but has 9 skipped tests → ✅ Expected RED
- E2E: all `test.skip(true, '[RED PHASE]...')` — will be collected but not executed
- pgTAP: all `SELECT skip(...)` — will pass structurally but skip assertions until migration applied
- **Status:** ✅ RED phase verified

**Expected Failure Messages:**
- Unit (import error): `Failed to resolve import "../containers/LobbyContainer"` — correct, file doesn't exist
- Unit (import error): `Failed to resolve import "../session/Countdown"` — correct, file doesn't exist
- Unit (import error): `Failed to resolve import "../../../src/hooks/useScriptureBroadcast"` — correct, file doesn't exist
- Slice tests: 9 × `SKIPPED` — correct `test.skip()` behavior

---

## Notes

- The E2E test for `4.1-E2E-001` requires two simultaneous browser contexts — uses Playwright's `browser.newContext()` for the partner user
- `workerStorageStatePath` from `worker-auth.ts` provides the partner's auth storage state
- Broadcast channel realtime behavior in E2E requires local Supabase running (`supabase start`)
- The `countdown_started_at` is server-authoritative — clients derive countdown from this UTC timestamp
- `countdownStartedAt` in Zustand slice is stored as `number` (ms) not `Date` object (JSON serialization constraint per CLAUDE.md)
- No new IndexedDB stores needed — lobby state is ephemeral in Zustand (persisted to localStorage but not IndexedDB)
- `project-structure-boundaries.md` must be updated as part of dev-story exit criterion

---

**Generated by BMad TEA Agent** — 2026-02-20
