---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-02-28'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-3-reconnection-and-graceful-degradation.md'
  - '_bmad/tea/config.yaml'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/helpers/scripture-lobby.ts'
  - 'tests/support/factories/index.ts'
  - 'tests/support/fixtures/worker-auth.ts'
  - 'tests/e2e/scripture/scripture-reading-4.2.spec.ts'
  - 'src/stores/slices/scriptureReadingSlice.ts'
  - 'src/hooks/useScripturePresence.ts'
  - 'src/hooks/useScriptureBroadcast.ts'
  - 'src/components/scripture-reading/containers/ReadingContainer.tsx'
  - 'src/components/scripture-reading/session/LockInButton.tsx'
  - 'src/components/scripture-reading/__tests__/LockInButton.test.tsx'
  - 'src/components/scripture-reading/__tests__/ReadingContainer.test.tsx'
  - 'tests/unit/stores/scriptureReadingSlice.lockin.test.ts'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
---

# ATDD Checklist - Epic 4, Story 3: Reconnection & Graceful Degradation

**Date:** 2026-02-28
**Author:** Sallvain
**Primary Test Level:** Unit + E2E

---

## Story Summary

Graceful handling of partner disconnection during Together Mode scripture reading sessions. Detects partner offline via presence heartbeat TTL, shows a two-phase overlay (reconnecting then timeout), allows ending or continuing the session, and resyncs state on reconnection.

**As a** user in Together mode
**I want** graceful handling when my partner's connection drops
**So that** our session isn't lost and we can resume or exit cleanly

---

## Acceptance Criteria

1. **AC#1 — Reconnecting Indicator**: When partner goes offline (presence heartbeat stops for >20s), connected partner sees "Partner reconnecting..." indicator, phase advancement paused, lock-in button shows "Holding your place" with "Reconnecting..." helper, state announced via aria-live="polite"
2. **AC#2 — Timeout Options**: When partner is offline for >30s, "End Session" and "Keep Waiting" options appear with neutral language ("Your partner seems to have stepped away")
3. **AC#3 — Keep Waiting**: Choosing "Keep Waiting" keeps the reconnecting indicator and continues waiting
4. **AC#4 — End Session**: Choosing "End Session" ends session cleanly for both partners, saves all progress, updates status to early termination, cleans up broadcast channel
5. **AC#5 — Reconnection Resync**: When offline partner reconnects within timeout, app shows "Reconnecting..." briefly, resyncs with server-authoritative state, both resume from current phase/step, no data lost
6. **AC#6 — Stale State Handling**: When server-authoritative state has advanced while partner was offline, reconnecting client updates to canonical state (version check), stale local state overwritten

---

## Failing Tests Created (RED Phase)

### Unit Tests — DisconnectionOverlay (9 tests)

**File:** `src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx`

- test.skip **[P0] renders "Partner reconnecting..." in Phase A (< 30s elapsed)**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#1 — overlay root and Phase A reconnecting message

- test.skip **[P1] does NOT show timeout buttons in Phase A**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#1 — Phase A has no action buttons

- test.skip **[P1] has aria-live="polite" announcement with partner name**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#1 — accessibility announcement

- test.skip **[P0] transitions to Phase B after 30s with timeout buttons**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#2 — timeout state with Keep Waiting / End Session

- test.skip **[P0] transitions from Phase A to Phase B via timer**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#2 — automatic transition from reconnecting to timeout

- test.skip **[P0] "Keep Waiting" calls onKeepWaiting callback**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#3 — Keep Waiting interaction

- test.skip **[P0] "End Session" calls onEndSession callback**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#4 — End Session interaction

- test.skip **[P1] uses neutral language — no blame words in visible text**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#2 — UX neutral language requirement

- test.skip **[P1] buttons have minimum 48px touch targets**
  - **Status:** RED — component does not exist yet
  - **Verifies:** AC#2 — touch target accessibility

### Unit Tests — scriptureReadingSlice reconnection (10 tests)

**File:** `tests/unit/stores/scriptureReadingSlice.reconnect.test.ts`

- test.skip **[P1] initial state has partnerDisconnected=false and partnerDisconnectedAt=null**
  - **Status:** RED — state fields not added to slice yet
  - **Verifies:** AC#1 — initial state shape

- test.skip **[P0] setPartnerDisconnected(true) sets partnerDisconnected=true and records timestamp**
  - **Status:** RED — action not implemented yet
  - **Verifies:** AC#1 — disconnect detection state

- test.skip **[P0] setPartnerDisconnected(false) clears partnerDisconnected and partnerDisconnectedAt**
  - **Status:** RED — action not implemented yet
  - **Verifies:** AC#5 — reconnection clears disconnect state

- test.skip **[P0] endSession() calls scripture_end_session RPC with session ID**
  - **Status:** RED — action not implemented yet
  - **Verifies:** AC#4 — end session RPC call

- test.skip **[P0] endSession() resets all session state on success (via exitSession)**
  - **Status:** RED — action not implemented yet
  - **Verifies:** AC#4 — clean session termination

- test.skip **[P1] endSession() on RPC error calls handleScriptureError with SYNC_FAILED**
  - **Status:** RED — action not implemented yet
  - **Verifies:** AC#4 — error handling

- test.skip **[P2] endSession() is a no-op when session is null**
  - **Status:** RED — action not implemented yet
  - **Verifies:** Guard condition

- test.skip **[P0] onBroadcastReceived with triggeredBy=end_session calls exitSession()**
  - **Status:** RED — broadcast handler not extended yet
  - **Verifies:** AC#4 — remote end session broadcast

- test.skip **[P0] onBroadcastReceived with currentPhase=complete calls exitSession()**
  - **Status:** RED — broadcast handler not extended yet
  - **Verifies:** AC#4 — complete phase broadcast

- test.skip **[P1] exitSession() resets partnerDisconnected fields**
  - **Status:** RED — state fields not added to initial state yet
  - **Verifies:** AC#4 — clean state reset

### Unit Tests — useScripturePresence reconnection (3 tests)

**File:** `tests/unit/hooks/useScripturePresence.reconnect.test.ts`

- test.skip **[P0] returns isPartnerConnected=true initially when session is active**
  - **Status:** RED — isPartnerConnected field not added yet
  - **Verifies:** AC#1 — initial connection state

- test.skip **[P0] sets isPartnerConnected=false after 20s with no presence_update**
  - **Status:** RED — stale detection for isPartnerConnected not implemented yet
  - **Verifies:** AC#1 — disconnect detection via heartbeat

- test.skip **[P0] sets isPartnerConnected=true when new presence_update arrives after disconnect**
  - **Status:** RED — reconnection handling not implemented yet
  - **Verifies:** AC#5 — reconnection detection

### Unit Tests — useScriptureBroadcast reconnection (3 tests)

**File:** `tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts`

- test.skip **[P0] CHANNEL_ERROR triggers handleScriptureError and re-subscribe attempt**
  - **Status:** RED — channel error handling not extended yet
  - **Verifies:** AC#5 — broadcast channel reconnection

- test.skip **[P1] on successful re-subscribe, loadSession is called for state resync**
  - **Status:** RED — resync on re-subscribe not implemented yet
  - **Verifies:** AC#5, AC#6 — server-authoritative state resync

- test.skip **[P1] does NOT re-subscribe when sessionId is null (session ended)**
  - **Status:** RED — guard condition not implemented yet
  - **Verifies:** Guard — no reconnect after session ends

### E2E Tests (2 tests)

**File:** `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts`

- test.skip **[P0] 4.3-E2E-001: End Session on Partner Disconnect — show disconnect overlay, timeout, and end session cleanly**
  - **Status:** RED — DisconnectionOverlay, endSession RPC, and scripture_end_session migration do not exist
  - **Verifies:** AC#1, AC#2, AC#4 — full end session flow

- test.skip **[P1] 4.3-E2E-002: Keep Waiting then Reconnect — show disconnect overlay, keep waiting, then reconnect and resume**
  - **Status:** RED — DisconnectionOverlay, keep waiting flow, and presence reconnection do not exist
  - **Verifies:** AC#1, AC#2, AC#3, AC#5 — keep waiting and reconnection flow

---

## Data Factories Created

No new data factories needed — existing `createTestSession`, `linkTestPartners`, `unlinkTestPartners`, `cleanupTestSession` from `tests/support/factories/index.ts` cover all E2E setup needs.

---

## Fixtures Created

No new fixtures needed — existing `workerAuthFixture`, `scriptureNavFixture`, and `supabaseAdmin` from `tests/support/merged-fixtures.ts` cover all E2E fixture needs.

---

## Mock Requirements

### Supabase RPC Mock (Unit Tests)

**Function:** `scripture_end_session`
**Arguments:** `{ p_session_id: UUID }`

**Success Response:**

```json
{
  "data": {
    "sessionId": "uuid",
    "currentPhase": "complete",
    "version": 10,
    "triggeredBy": "end_session"
  },
  "error": null
}
```

**Failure Response:**

```json
{
  "data": null,
  "error": { "message": "Network error" }
}
```

**Notes:** Mock via `vi.mock` on `supabaseClient.rpc` — same pattern as `scriptureReadingSlice.lockin.test.ts`

---

## Required data-testid Attributes

### DisconnectionOverlay Component

- `disconnection-overlay` — overlay root container
- `disconnection-reconnecting` — Phase A content (< 30s): "Partner reconnecting..."
- `disconnection-timeout` — Phase B content (>= 30s): "Your partner seems to have stepped away"
- `disconnection-keep-waiting` — "Keep Waiting" button (Phase B)
- `disconnection-end-session` — "End Session" button (Phase B)

### LockInButton Disconnected State

- `lock-in-disconnected` — lock-in button in disconnected state ("Holding your place")

### Reconnection Toast

- `reconnected-toast` — reconnection success toast

**Implementation Example:**

```tsx
{
  /* DisconnectionOverlay */
}
<div data-testid="disconnection-overlay">
  <div data-testid="disconnection-reconnecting">Partner reconnecting...</div>
  <div data-testid="disconnection-timeout">
    Your partner seems to have stepped away
    <button data-testid="disconnection-keep-waiting">Keep Waiting</button>
    <button data-testid="disconnection-end-session">End Session</button>
  </div>
</div>;

{
  /* LockInButton disconnected state */
}
<button data-testid="lock-in-disconnected">Holding your place</button>;
```

---

## Implementation Checklist

### Test: DisconnectionOverlay Phase A rendering

**File:** `src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx`

**Tasks to make this test pass:**

- [ ] Create `src/components/scripture-reading/session/DisconnectionOverlay.tsx`
- [ ] Implement `DisconnectionOverlayProps` interface: `partnerName`, `disconnectedAt`, `onKeepWaiting`, `onEndSession`
- [ ] Render Phase A content when `elapsed < 30s`: "Partner reconnecting..." with pulse animation
- [ ] Add `aria-live="polite"` with partner name announcement
- [ ] Add data-testid: `disconnection-overlay`, `disconnection-reconnecting`
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx --silent`
- [ ] Remove test.skip() from passing tests

### Test: DisconnectionOverlay Phase B and buttons

**File:** `src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx`

**Tasks to make this test pass:**

- [ ] Implement Phase B content when `elapsed >= 30s`: "Your partner seems to have stepped away"
- [ ] Add "Keep Waiting" and "End Session" buttons
- [ ] Wire `onKeepWaiting` and `onEndSession` callbacks
- [ ] Use `useEffect` + `setInterval(1000)` to derive elapsed time from `Date.now() - disconnectedAt`
- [ ] Add data-testid: `disconnection-timeout`, `disconnection-keep-waiting`, `disconnection-end-session`
- [ ] Min 48px touch targets on buttons, FOCUS_RING on interactive elements
- [ ] No blame language in visible text
- [ ] Run test: `npx vitest run src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx --silent`
- [ ] Remove test.skip() from passing tests

### Test: scriptureReadingSlice — setPartnerDisconnected + endSession

**File:** `tests/unit/stores/scriptureReadingSlice.reconnect.test.ts`

**Tasks to make these tests pass:**

- [ ] Add `partnerDisconnected: boolean` and `partnerDisconnectedAt: number | null` to `ScriptureReadingState`
- [ ] Add `setPartnerDisconnected(disconnected: boolean): void` and `endSession(): Promise<void>` to `ScriptureSlice`
- [ ] Implement `setPartnerDisconnected(true)`: sets `partnerDisconnected: true`, `partnerDisconnectedAt: Date.now()`
- [ ] Implement `setPartnerDisconnected(false)`: sets `partnerDisconnected: false`, `partnerDisconnectedAt: null`
- [ ] Implement `endSession()`: call `callLobbyRpc('scripture_end_session', { p_session_id })`, on success call `exitSession()`, on error call `handleScriptureError`
- [ ] Add `partnerDisconnected` and `partnerDisconnectedAt` to `initialScriptureState`
- [ ] Extend `onBroadcastReceived`: if `triggeredBy === 'end_session'` or `currentPhase === 'complete'`, call `exitSession()`
- [ ] Extend `StateUpdatePayload.triggeredBy` to include `'end_session'`
- [ ] Run test: `npx vitest run tests/unit/stores/scriptureReadingSlice.reconnect.test.ts --silent`
- [ ] Remove test.skip() from passing tests

### Test: useScripturePresence — isPartnerConnected

**File:** `tests/unit/hooks/useScripturePresence.reconnect.test.ts`

**Tasks to make these tests pass:**

- [ ] Add `isPartnerConnected: boolean` to `PartnerPresenceInfo` (default: `true`)
- [ ] Add stale-detection timer: on each `presence_update` receive, reset a 20s timer; when timer fires → set `isPartnerConnected: false`
- [ ] On reconnect (new `presence_update` after disconnect): set `isPartnerConnected: true`
- [ ] Return updated `PartnerPresenceInfo` with `isPartnerConnected` field
- [ ] Run test: `npx vitest run tests/unit/hooks/useScripturePresence.reconnect.test.ts --silent`
- [ ] Remove test.skip() from passing tests

### Test: useScriptureBroadcast — channel reconnection

**File:** `tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts`

**Tasks to make these tests pass:**

- [ ] Add `CHANNEL_ERROR` and `CLOSED` handling in subscribe callback
- [ ] On `CHANNEL_ERROR`: log via `handleScriptureError(SYNC_FAILED)`, attempt re-subscribe
- [ ] On successful re-subscribe (`SUBSCRIBED`): call `loadSession(session.id)` to resync
- [ ] Guard: do NOT re-subscribe if `sessionId` changed to null
- [ ] Run test: `npx vitest run tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts --silent`
- [ ] Remove test.skip() from passing tests

### Test: E2E End Session Flow

**File:** `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `supabase/migrations/YYYYMMDDHHMMSS_scripture_end_session.sql` with the `scripture_end_session` RPC
- [ ] Create `DisconnectionOverlay.tsx` component
- [ ] Extend `ReadingContainer.tsx`: add disconnection detection via `useScripturePresence.isPartnerConnected`
- [ ] Extend `LockInButton.tsx`: add `isPartnerDisconnected` prop with disconnected state
- [ ] Wire `endSession()` slice action to "End Session" button
- [ ] Extend `onBroadcastReceived` to handle `triggeredBy: 'end_session'`
- [ ] Add `data-testid` attributes: `disconnection-overlay`, `disconnection-reconnecting`, `disconnection-timeout`, `disconnection-keep-waiting`, `disconnection-end-session`, `lock-in-disconnected`
- [ ] Run test: `npx playwright test tests/e2e/scripture/scripture-reconnect-4.3.spec.ts`
- [ ] Remove test.skip() from passing tests

### Test: E2E Keep Waiting then Reconnect

**File:** `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts`

**Tasks to make this test pass:**

- [ ] Implement "Keep Waiting" handler: dismiss timeout buttons, return to reconnecting state
- [ ] Implement client resync on reconnect: `loadSession(session.id)` when `isPartnerConnected` transitions false → true
- [ ] Extend `useScriptureBroadcast`: handle re-subscribe after channel error, call `loadSession` on reconnect
- [ ] Run test: `npx playwright test tests/e2e/scripture/scripture-reconnect-4.3.spec.ts`
- [ ] Remove test.skip() from passing tests

---

## Running Tests

```bash
# Run all failing unit tests for this story
npx vitest run src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx tests/unit/stores/scriptureReadingSlice.reconnect.test.ts tests/unit/hooks/useScripturePresence.reconnect.test.ts tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts --silent

# Run specific unit test file
npx vitest run tests/unit/stores/scriptureReadingSlice.reconnect.test.ts --silent

# Run all failing E2E tests for this story
npx playwright test tests/e2e/scripture/scripture-reconnect-4.3.spec.ts

# Run E2E tests in headed mode (see browser)
npx playwright test tests/e2e/scripture/scripture-reconnect-4.3.spec.ts --headed

# Debug specific E2E test
npx playwright test tests/e2e/scripture/scripture-reconnect-4.3.spec.ts --debug

# Run all unit tests with coverage
npx vitest run --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 27 tests written and skipped (failing)
- No new fixtures or factories needed (existing infrastructure sufficient)
- Mock requirements documented
- data-testid requirements listed
- Implementation checklist created

**Verification:**

- All tests use `test.skip()` (TDD red phase)
- Failure messages would be clear: missing component, missing state field, missing RPC
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with slice state)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Suggested Order:**

1. Slice state + actions (scriptureReadingSlice.reconnect tests)
2. useScripturePresence isPartnerConnected (presence reconnect tests)
3. useScriptureBroadcast channel error handling (broadcast reconnect tests)
4. DisconnectionOverlay component (overlay tests)
5. ReadingContainer integration (wiring overlay + presence)
6. LockInButton disconnected state
7. DB migration: scripture_end_session RPC
8. E2E tests (end session + keep waiting)

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
4. **Optimize performance** (if needed)
5. **Ensure tests still pass** after each refactor

---

## Next Steps

1. **Review this checklist** with team lead
2. **Run failing tests** to confirm RED phase: all tests show as skipped
3. **Begin implementation** using implementation checklist as guide (slice → hooks → components → DB → E2E)
4. **Work one test at a time** (remove test.skip(), implement, verify green)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** — Test design principles (Given-When-Then, determinism, isolation, no hard waits)
- **data-factories.md** — Factory patterns for test data (existing factories reused)
- **selector-resilience.md** — Robust data-testid selector strategies
- **timing-debugging.md** — Race condition identification (presence heartbeat timing)
- **overview.md** — Playwright Utils fixture composition patterns

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run --silent` (unit) + `npx playwright test` (E2E)

**Results:**

```
All 27 tests skipped (test.skip) — TDD RED phase confirmed
- Unit tests: 25 skipped
- E2E tests: 2 skipped
```

**Summary:**

- Total tests: 27
- Passing: 0 (expected)
- Skipped: 27 (expected — TDD red phase)
- Status: RED phase verified

---

## Notes

- Existing `createTestSession` with `preset: 'mid_session'` provides together-mode session setup for E2E tests
- `useScripturePresence` already has 20s stale TTL — Story 4.3 extends it with `isPartnerConnected` boolean
- `useScriptureBroadcast` already handles `CHANNEL_ERROR` with logging — Story 4.3 extends it with re-subscribe + resync
- E2E tests simulate offline by closing partnerPage or blocking network via `route('**/*', route => route.abort())`
- pgTAP tests for `scripture_end_session` RPC are specified in the story but not generated here — they follow a different test framework (SQL-based, not TypeScript)

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @Sallvain in Slack/Discord
- Refer to `_bmad/tea/testarch/knowledge/` for testing best practices
- Consult `tests/README.md` for test infrastructure documentation

---

**Generated by BMad TEA Agent** - 2026-02-28
