# Story 4.3: Reconnection & Graceful Degradation

Status: in-progress

## Story

As a user in Together mode,
I want graceful handling when my partner's connection drops,
so that our session isn't lost and we can resume or exit cleanly.

## Acceptance Criteria

**Given** both partners are in an active Together session
**When** one partner goes offline (presence heartbeat stops for >20s)
**Then** the connected partner sees "Partner reconnecting..." indicator
**And** the indicator uses the three-state presence system (disconnected = indicator off)
**And** phase advancement is paused (lock-in button shows "Holding your place" with "Reconnecting..." helper)
**And** the state is announced via aria-live="polite"

**Given** the partner is offline for >30 seconds
**When** the timeout is reached
**Then** an "End Session" option appears alongside "Keep Waiting"
**And** language remains neutral: "Your partner seems to have stepped away"
**And** no blame or alarm language is used

**Given** the user chooses "Keep Waiting"
**When** they continue waiting
**Then** the reconnecting indicator remains
**And** the session continues to wait for partner presence

**Given** the user chooses "End Session"
**When** they confirm
**Then** the session ends cleanly for both partners
**And** both partners' progress (reflections, bookmarks) up to the current step is saved
**And** the session status is updated to reflect early termination
**And** the broadcast channel is cleaned up

**Given** the offline partner's connection is restored
**When** they rejoin within the timeout
**Then** the app shows "Reconnecting..." briefly
**And** the client resyncs with server-authoritative state (fetches latest session snapshot)
**And** both partners resume from the current phase/step
**And** no data is lost
**And** the experience is seamless — neither partner sees a reset or jarring state jump

**Given** the server-authoritative state has advanced while a partner was offline
**When** the reconnecting partner's client receives the current state
**Then** the client updates to match the canonical state (version check)
**And** any stale local state is overwritten
**And** the partner resumes at the correct step and phase

## Tasks / Subtasks

- [x] Task 1: Create DB migration — `scripture_end_session` RPC (AC: #4)
  - [x] 1.1 Create `supabase/migrations/YYYYMMDDHHMMSS_scripture_end_session.sql`
  - [x] 1.2 RPC `scripture_end_session(p_session_id UUID)`:
    - Validates caller is `user1_id` or `user2_id` (auth.uid())
    - Validates `session.status = 'in_progress'`
    - Sets `status = 'ended_early'`, `completed_at = now()`
    - Bumps `version`, updates `snapshot_json`
    - Broadcasts `state_updated` with `{ currentPhase: 'complete', triggeredBy: 'end_session' }` on `scripture-session:{session_id}`
    - Returns updated session snapshot
  - [x] 1.3 `SECURITY INVOKER`, `set search_path = ''`, fully qualified table names, `GRANT EXECUTE TO authenticated`

- [x] Task 2: Extend `useScripturePresence` with connection state tracking (AC: #1, #5, #6)
  - [x] 2.1 Add `isPartnerConnected: boolean` to `PartnerPresenceInfo` (default: `true` when session is together-mode)
  - [x] 2.2 Add stale-detection timer: on each `presence_update` receive, reset a 20s timer; when timer fires → set `isPartnerConnected: false` and `view: null`
  - [x] 2.3 On reconnect (new `presence_update` after disconnect): set `isPartnerConnected: true`, update view/stepIndex normally
  - [x] 2.4 Return updated `PartnerPresenceInfo` with `isPartnerConnected` field

- [x] Task 3: Extend `scriptureReadingSlice` with disconnection state (AC: #1, #2, #3, #4)
  - [x] 3.1 Add to `ScriptureReadingState`: `partnerDisconnected: boolean` (default: false), `partnerDisconnectedAt: number | null` (default: null)
  - [x] 3.2 Add to `ScriptureSlice`: `setPartnerDisconnected(disconnected: boolean): void`, `endSession(): Promise<void>`
  - [x] 3.3 `setPartnerDisconnected(true)`: sets `partnerDisconnected: true`, `partnerDisconnectedAt: Date.now()`
  - [x] 3.4 `setPartnerDisconnected(false)`: sets `partnerDisconnected: false`, `partnerDisconnectedAt: null`
  - [x] 3.5 `endSession()`:
    - Guard: no session → return early
    - Call `callLobbyRpc('scripture_end_session', { p_session_id: session.id })`
    - On success: `exitSession()` (existing action — resets all session state)
    - On error: `handleScriptureError({ code: SYNC_FAILED, ... })`
  - [x] 3.6 Add `partnerDisconnected` and `partnerDisconnectedAt` to `initialScriptureState`
  - [x] 3.7 Extend `onBroadcastReceived`: if `payload.triggeredBy === 'end_session'` or `payload.currentPhase === 'complete'`, call `exitSession()`

- [x] Task 4: Create `DisconnectionOverlay.tsx` (AC: #1, #2, #3)
  - [x] 4.1 Create `src/components/scripture-reading/session/DisconnectionOverlay.tsx`
  - [x] 4.2 Props:
    ```typescript
    interface DisconnectionOverlayProps {
      partnerName: string;
      disconnectedAt: number;  // ms timestamp
      onKeepWaiting: () => void;
      onEndSession: () => void;
    }
    ```
  - [x] 4.3 Phase A — Reconnecting (elapsed < 30s):
    - Centered overlay (semi-transparent bg) above reading content
    - Text: "Partner reconnecting..." with pulse animation
    - `aria-live="polite"` announcement: "[PartnerName] seems to have disconnected"
    - No action buttons yet
  - [x] 4.4 Phase B — Timeout (elapsed >= 30s):
    - Text changes to: "Your partner seems to have stepped away"
    - Two buttons appear:
      - "Keep Waiting" (secondary button)
      - "End Session" (primary button, purple)
    - No blame or alarm language
  - [x] 4.5 Elapsed time derived from `Date.now() - disconnectedAt` via `useEffect` + `setInterval(1000)`
  - [x] 4.6 `data-testid`: `disconnection-overlay`, `disconnection-reconnecting`, `disconnection-timeout`, `disconnection-keep-waiting`, `disconnection-end-session`
  - [x] 4.7 Min 48px touch targets on buttons, `FOCUS_RING` on interactive elements

- [x] Task 5: Integrate disconnection into `ReadingContainer.tsx` (AC: #1, #2, #3, #4)
  - [x] 5.1 Add `partnerDisconnected`, `partnerDisconnectedAt`, `setPartnerDisconnected`, `endSession` to `useShallow` selector
  - [x] 5.2 Watch `useScripturePresence` → `isPartnerConnected` changes:
    - When `isPartnerConnected` transitions false → `true`: call `setPartnerDisconnected(false)`
    - When `isPartnerConnected` transitions true → `false`: call `setPartnerDisconnected(true)`
    - Use `useEffect` with `[isPartnerConnected]` dependency + `useRef` for previous value tracking
  - [x] 5.3 When `partnerDisconnected` is true: render `<DisconnectionOverlay>` above reading content
  - [x] 5.4 When `partnerDisconnected` is true: `LockInButton` shows disabled state: "Holding your place" + "Reconnecting..." helper (update `LockInButton` props)
  - [x] 5.5 "Keep Waiting" handler: no-op (overlay stays in timeout mode, user chose to keep waiting — dismiss timeout buttons, return to reconnecting state)
  - [x] 5.6 "End Session" handler: call `endSession()` slice action

- [x] Task 6: Extend `LockInButton.tsx` with disconnected state (AC: #1)
  - [x] 6.1 Add `isPartnerDisconnected: boolean` prop (default: false)
  - [x] 6.2 When `isPartnerDisconnected && !isLocked`:
    - Button text: "Holding your place"
    - Helper text: "Reconnecting..."
    - Button disabled (muted style, not primary)
  - [x] 6.3 When `isPartnerDisconnected && isLocked`:
    - Keep showing "Waiting for [partnerName]..." with additional "Reconnecting..." below
    - Undo still available
  - [x] 6.4 `data-testid="lock-in-disconnected"` on the disconnected-state button variant

- [x] Task 7: Client resync on reconnect (AC: #5, #6)
  - [x] 7.1 In `ReadingContainer`, when `isPartnerConnected` transitions false → true AND `partnerDisconnected` was true:
    - Call `loadSession(session.id)` to refetch server-authoritative state
    - This naturally updates `session.currentStepIndex`, `session.version`, `session.currentPhase` from server
    - Clear `partnerDisconnected` state
  - [x] 7.2 For the reconnecting client (THIS client went offline and came back):
    - In `useScriptureBroadcast`, on channel re-subscribe (SUBSCRIBED callback): fetch latest session state via `loadSession(session.id)` to resync
    - The existing `onBroadcastReceived` version check handles stale local state — broadcasts with higher version will update state
  - [x] 7.3 In `useScripturePresence`, on channel re-subscribe: immediately send own presence (existing behavior — no change needed)

- [x] Task 8: Handle broadcast channel disconnection and re-subscription (AC: #5, #6)
  - [x] 8.1 In `useScriptureBroadcast`, add channel status tracking:
    - Listen for channel status `CHANNEL_ERROR` and `CLOSED` events
    - On `CHANNEL_ERROR`: log via `handleScriptureError(SYNC_FAILED)`, attempt to re-subscribe by removing and re-joining channel
    - On `CLOSED`: if sessionId is still valid, attempt to re-subscribe
  - [x] 8.2 On successful re-subscribe (`SUBSCRIBED`): call `loadSession(session.id)` to refetch server-authoritative state (handles any missed broadcasts during disconnection)
  - [x] 8.3 Guard: do NOT re-subscribe if `sessionId` has changed to null (session ended)

- [x] Task 9: pgTAP database tests (AC: #4)
  - [x] 9.1 New file: `supabase/tests/database/12_scripture_end_session.sql`
  - [x] 9.2 `4.3-DB-001`: End session — caller is user1, status changes to `ended_early`, `completed_at` is set
  - [x] 9.3 `4.3-DB-002`: End session — caller is user2, same result as above
  - [x] 9.4 `4.3-DB-003`: RLS security — non-member cannot call `scripture_end_session`
  - [x] 9.5 `4.3-DB-004`: Cannot end already-completed session (status != 'in_progress')
  - [x] 9.6 **CRITICAL**: Set `partner_id` in `public.users` before asserting couple/security behavior (Epic 3 retro rule)

- [x] Task 10: Unit tests (AC: all)
  - [x] 10.1 `src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx`:
    - Renders "Partner reconnecting..." initially (< 30s)
    - After 30s: shows timeout state with "Keep Waiting" and "End Session" buttons
    - "Keep Waiting" calls onKeepWaiting
    - "End Session" calls onEndSession
    - aria-live announcement present
    - Neutral language (no blame words)
  - [x] 10.2 `src/components/scripture-reading/__tests__/LockInButton.disconnected.test.tsx` (extend existing test file):
    - `isPartnerDisconnected=true` renders "Holding your place" + "Reconnecting..."
    - Button is disabled when disconnected
    - `isPartnerDisconnected=true && isLocked=true` shows undo still available
  - [x] 10.3 `tests/unit/stores/scriptureReadingSlice.reconnect.test.ts`:
    - `setPartnerDisconnected(true)` sets state correctly
    - `setPartnerDisconnected(false)` clears state
    - `endSession()` calls `scripture_end_session` RPC
    - `endSession()` on error calls handleScriptureError
    - `onBroadcastReceived` with `triggeredBy: 'end_session'` calls `exitSession()`
    - `onBroadcastReceived` with `currentPhase: 'complete'` calls `exitSession()`
  - [x] 10.4 `tests/unit/hooks/useScripturePresence.reconnect.test.ts` (extend existing test file):
    - `isPartnerConnected` = true initially
    - After 20s with no presence_update: `isPartnerConnected` = false
    - New presence_update after disconnect: `isPartnerConnected` = true
  - [x] 10.5 `tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts` (extend existing test file):
    - Channel error triggers re-subscribe attempt
    - Re-subscribe calls loadSession for state resync
    - No re-subscribe when sessionId is null

- [x] Task 11: E2E tests (AC: #1, #4, #5)
  - [x] 11.1 New file: `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts`
  - [x] 11.2 `4.3-E2E-001`: End session flow — both users in reading phase → simulate partner B offline (stop sending presence / close page) → partner A sees "Partner reconnecting..." → timeout → partner A taps "End Session" → session ends for both
  - [x] 11.3 `4.3-E2E-002`: Keep waiting then reconnect — partner B goes offline → timeout → partner A taps "Keep Waiting" → partner B comes back → both resume reading
  - [x] 11.4 **Always import** `{ test, expect }` from `tests/support/merged-fixtures`
  - [x] 11.5 **Use** `tests/support/helpers/scripture-lobby.ts` for shared lobby setup helpers

### Review Follow-ups (AI)

- [x] [AI-Review][LOW] Add partner-side recovery assertion in `4.3-E2E-002`: after reconnect, assert `partnerPage.getByTestId('reading-container')` is visible. [`tests/e2e/scripture/scripture-reconnect-4.3.spec.ts:261`]
- [x] [AI-Review][LOW] Re-run targeted scenario and capture result for this fix: `npx playwright test tests/e2e/scripture/scripture-reconnect-4.3.spec.ts --grep "4.3-E2E-002"` (result captured: failed at `navigateToTogetherRoleSelection` waiting for `lobby-role-selection`).
- [x] [AI-Review][HIGH] Replace invalid Playwright matcher usage in `4.3-E2E-001`: changed `toHaveTextContent` to `toContainText`.
- [x] [AI-Review][HIGH] Add explicit confirmation gate before destructive "End Session" action in `DisconnectionOverlay`.
- [x] [AI-Review][MEDIUM] Surface end-session RPC failures to users in reading mode via visible `session-error-toast` in `ReadingContainer`.
- [x] [AI-Review][MEDIUM] Sync story traceability docs by adding modified `src/components/scripture-reading/containers/ScriptureOverview.tsx` to File List.

## Dev Notes

### What Already Exists — DO NOT Recreate

| Component/File | What It Does | Location |
|---|---|---|
| `scriptureReadingSlice.ts` | All session state, lobby state, lock-in state, `callLobbyRpc` helper, `isPendingLockIn`, `partnerLocked`, `exitSession` | `src/stores/slices/scriptureReadingSlice.ts` |
| `useScriptureBroadcast.ts` | Manages `scripture-session:{sessionId}` channel; handles `partner_joined`, `ready_state_changed`, `state_updated`, `session_converted`, `lock_in_status_changed` | `src/hooks/useScriptureBroadcast.ts` |
| `useScripturePresence.ts` | Manages `scripture-presence:{sessionId}` channel; sends heartbeat every 10s; drops stale presence after 20s TTL | `src/hooks/useScripturePresence.ts` |
| `ReadingContainer.tsx` | Together-mode reading orchestrator — roles, step view, lock-in, presence, animation | `src/components/scripture-reading/containers/ReadingContainer.tsx` |
| `LockInButton.tsx` | Lock-in / waiting / undo button — states: available, locked, pending | `src/components/scripture-reading/session/LockInButton.tsx` |
| `PartnerPosition.tsx` | Partner view position display — "[Name] is viewing the [verse/response]" | `src/components/scripture-reading/reading/PartnerPosition.tsx` |
| `ScriptureOverview.tsx` | Main router — mounts `useScriptureBroadcast` at top level, routes to Lobby/Reading/Solo | `src/components/scripture-reading/containers/ScriptureOverview.tsx` |
| `LobbyContainer.tsx` | Lobby: role selection, ready state, countdown | `src/components/scripture-reading/containers/LobbyContainer.tsx` |
| `SoloReadingFlow.tsx` | Solo reading container — reference for AnimatePresence pattern | `src/components/scripture-reading/containers/SoloReadingFlow.tsx` |
| `scriptureReadingService.ts` | IndexedDB + Supabase CRUD, `handleScriptureError`, `ScriptureErrorCode` | `src/services/scriptureReadingService.ts` |
| `callLobbyRpc` helper | Untyped RPC wrapper for RPCs not in `database.types.ts` — reuse for `scripture_end_session` | `scriptureReadingSlice.ts` line 50 |
| `useNetworkStatus` hook | `{ isOnline }` — already exists, use for offline detection | `src/hooks/useNetworkStatus.ts` |
| `partnerSlice` | `partner: PartnerInfo \| null` — has `partner.displayName` for UI | `src/stores/slices/partnerSlice.ts` |
| `scriptureTheme` tokens | `{ primary: '#A855F7', background: '#F3E5F5', surface: '#FAF5FF' }` | `ScriptureOverview.tsx` line 42 |
| `FOCUS_RING` constant | `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'` | `ScriptureOverview.tsx` line 48 |
| `scripture-lobby.ts` helpers | `setupTogetherSession`, lobby helpers for E2E | `tests/support/helpers/scripture-lobby.ts` |
| `SCRIPTURE_STEPS` / `MAX_STEPS` | Step data (17 steps) | `src/data/scriptureSteps.ts` |
| `handleScriptureError` / `ScriptureErrorCode` | Error routing — MUST use, never empty catch | `src/services/scriptureReadingService.ts` |
| RLS policies for `realtime.messages` | `scripture-session:%` and `scripture-presence:%` channel policies from Stories 4.1 + 4.2 | `supabase/migrations/` |
| `exitSession()` | Existing slice action that resets all session state (session = null, clears lobby/lock-in state) | `scriptureReadingSlice.ts` |

### What Does NOT Exist Yet — You Must Create

| File | Purpose |
|---|---|
| `src/components/scripture-reading/session/DisconnectionOverlay.tsx` | Two-phase overlay: reconnecting (< 30s) and timeout (>= 30s) with Keep Waiting / End Session |
| `supabase/migrations/YYYYMMDDHHMMSS_scripture_end_session.sql` | `scripture_end_session` RPC for clean session termination |
| `supabase/tests/database/12_scripture_end_session.sql` | pgTAP tests for end session RPC |
| `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts` | E2E tests for reconnection flow |

### Architecture Constraints

**Presence-Based Disconnection Detection:**
- `useScripturePresence` already has a 20s stale TTL — when no `presence_update` is received for >20s, the partner presence is dropped (`view: null`)
- Story 4.3 extends this by adding `isPartnerConnected: boolean` to `PartnerPresenceInfo`
- When the stale timer fires → `isPartnerConnected = false` → `ReadingContainer` detects this and sets `partnerDisconnected` in the slice
- When a new `presence_update` arrives → `isPartnerConnected = true` → `ReadingContainer` clears `partnerDisconnected`
- This leverages the existing heartbeat (10s) + TTL (20s) architecture from Story 4.2 — no new channels or protocols needed

**Broadcast Channel Continuity:**
- `useScriptureBroadcast` is mounted in `ScriptureOverview.tsx` (moved there in Story 4.2) — persists across lobby, reading, reflection phases
- For Story 4.3, extend `useScriptureBroadcast` to handle `CHANNEL_ERROR` and `CLOSED` states for reconnection
- On re-subscribe → call `loadSession()` to resync with server-authoritative state (handles missed broadcasts)
- The existing `onBroadcastReceived` version check (`version <= localVersion → ignore`) prevents stale state overwrites

**Two Disconnection Scenarios:**
1. **Partner disconnects** (you remain online): Detected via `useScripturePresence` stale TTL. You see "Partner reconnecting..." overlay. Lock-in paused.
2. **You disconnect** (your network drops): On reconnect, `useScriptureBroadcast` channel re-subscribes → `loadSession()` resyncs state. `useScripturePresence` re-sends own presence → partner sees you back.

**End Session Flow:**
```
User taps "End Session" → endSession() slice action
→ callLobbyRpc('scripture_end_session', { p_session_id })
→ Server: sets status='ended_early', completed_at=now(), bumps version
→ Server broadcasts state_updated { currentPhase: 'complete', triggeredBy: 'end_session' }
→ Both clients: onBroadcastReceived detects phase='complete' or triggeredBy='end_session'
→ Both clients: exitSession() — resets all session state
→ ScriptureOverview: no session → shows overview page
```

**Lock-In Paused When Disconnected:**
- When `partnerDisconnected = true`, the `LockInButton` shows "Holding your place" (disabled)
- User CAN still lock in if they choose (the server doesn't know about presence), but the UX discourages it by disabling the button
- If user was already locked in when partner disconnected: undo remains available

**Session Termination Data Preservation:**
- `scripture_end_session` RPC sets `status = 'ended_early'` — distinct from `completed` (normal finish) and `abandoned` (solo timeout)
- All reflections and bookmarks already saved (per-step, persisted as they're created in Stories 2.1-2.3)
- `snapshot_json` updated on end — preserves last known state
- No data loss — everything up to the current step is already in the DB

**Import Discipline (from CLAUDE.md):**
- Do NOT import `supabase` in `DisconnectionOverlay` or `ReadingContainer` — presentational components get data via props/slice
- `useScripturePresence` already imports `supabase` for its presence channel — no new supabase imports needed
- `useScriptureBroadcast` already imports `supabase` — channel error handling extends existing code
- Data flow: `ReadingContainer` → slice actions → `callLobbyRpc` (RPCs)

**Error Handling (CLAUDE.md guardrail):**
- `endSession()` errors → `handleScriptureError({ code: SYNC_FAILED, ... })`
- Channel re-subscribe errors → `handleScriptureError(SYNC_FAILED)`
- All errors through `handleScriptureError` — NEVER empty catch blocks

**State Flow: Partner Disconnects**
```
Partner's heartbeat stops
→ 20s passes → useScripturePresence stale timer fires
→ isPartnerConnected = false, view = null
→ ReadingContainer: setPartnerDisconnected(true) via useEffect
→ DisconnectionOverlay renders (Phase A: "Reconnecting...")
→ LockInButton shows "Holding your place" (disabled)
→ 30s total: DisconnectionOverlay transitions to Phase B
→ "Keep Waiting" / "End Session" buttons appear
```

**State Flow: Partner Reconnects**
```
Partner's presence_update arrives
→ useScripturePresence: reset stale timer, isPartnerConnected = true
→ ReadingContainer: setPartnerDisconnected(false) via useEffect
→ ReadingContainer: call loadSession(session.id) to resync state
→ DisconnectionOverlay unmounts
→ LockInButton returns to normal state
→ Both partners resume at correct step
```

### UX Requirements

**DisconnectionOverlay:**
- Semi-transparent backdrop: `bg-black/30 backdrop-blur-sm` over reading content
- Centered card: `bg-white rounded-2xl p-6 shadow-lg max-w-sm mx-auto`
- Phase A (< 30s):
  - Icon: wifi-off (Lucide `WifiOff`) in purple
  - Text: "Partner reconnecting..." with `animate-pulse` on dot animation
  - `aria-live="polite"`: "[PartnerName] seems to have disconnected"
- Phase B (>= 30s):
  - Text: "Your partner seems to have stepped away"
  - "Keep Waiting" button: secondary style (`border border-purple-300 text-purple-700`)
  - "End Session" button: primary purple (`bg-purple-600 text-white`)
  - Both buttons min 48px touch targets
- No blame language. No "disconnected" in visible UI (only in aria). Use "stepped away" or "reconnecting"
- Reduced-motion: no pulse animation, static text

**Lock-In Button Disconnected State:**
- "Holding your place" text in muted purple
- "Reconnecting..." helper below in small text
- Button has `opacity-50 pointer-events-none` (disabled appearance)
- Same layout as existing locked state but with different text

**Reconnection Toast:**
- When partner reconnects after a disconnect: brief "Reconnected" toast (green tint, 2s auto-dismiss)
- Non-blocking, same position as "Session updated" toast

### Slice State Shape (Story 4.3 Additions)

```typescript
// Add to ScriptureReadingState:
partnerDisconnected: boolean;         // Partner's presence heartbeat expired
partnerDisconnectedAt: number | null; // Timestamp when disconnect detected (for timeout calc)

// Add to ScriptureSlice:
setPartnerDisconnected: (disconnected: boolean) => void;
endSession: () => Promise<void>;
```

### Component Structure (Story 4.3 scope)

```
src/components/scripture-reading/
├── containers/
│   ├── ScriptureOverview.tsx  ← no changes (useScriptureBroadcast already mounted)
│   ├── ReadingContainer.tsx   ← MODIFY: add disconnection detection + overlay rendering
│   ├── LobbyContainer.tsx     ← no changes
│   └── SoloReadingFlow.tsx    ← no changes
├── session/
│   ├── LockInButton.tsx       ← MODIFY: add isPartnerDisconnected prop + disabled state
│   ├── Countdown.tsx          ← no changes
│   └── DisconnectionOverlay.tsx ← CREATE: two-phase reconnection UI
└── reading/
    ├── PartnerPosition.tsx    ← no changes (already handles null presence)
    ├── RoleIndicator.tsx      ← no changes
    └── BookmarkFlag.tsx       ← no changes

src/hooks/
├── useScriptureBroadcast.ts   ← MODIFY: add channel error handling + re-subscribe + resync
├── useScripturePresence.ts    ← MODIFY: add isPartnerConnected to return value
└── index.ts                   ← no changes (PartnerPresenceInfo already exported)

src/stores/slices/
└── scriptureReadingSlice.ts   ← MODIFY: add partnerDisconnected state, setPartnerDisconnected + endSession actions, extend onBroadcastReceived
```

### Testing Requirements

**Test IDs:**
- `disconnection-overlay` — overlay root
- `disconnection-reconnecting` — Phase A content (< 30s)
- `disconnection-timeout` — Phase B content (>= 30s)
- `disconnection-keep-waiting` — "Keep Waiting" button
- `disconnection-end-session` — "End Session" button
- `lock-in-disconnected` — lock-in button in disconnected state
- `reconnected-toast` — reconnection success toast

**Co-location pattern (from Story 4.1):**
- Component unit tests: `src/components/scripture-reading/__tests__/`
- Service/hook unit tests: `tests/unit/` mirroring src structure

**E2E test patterns:**
- Import `{ test, expect }` from `tests/support/merged-fixtures`
- Use `scripture-lobby.ts` helpers for session setup
- Use worker-isolated auth (worker-{n}.json + worker-{n}-partner.json)
- Use `page` and `partnerPage` for dual-browser flows
- Simulate offline: close `partnerPage` or block network via `partnerPage.route('**/*', route => route.abort())`

**pgTAP Test File:** `supabase/tests/database/12_scripture_end_session.sql`

### Entry Criteria (Before Starting)

- [ ] `supabase start` — local Supabase running
- [ ] Apply Stories 4.1 + 4.2 migrations if not already: `supabase db reset`
- [ ] Story 4.2 E2E tests passing: `npx playwright test tests/e2e/scripture/scripture-reading-4.2.spec.ts`
- [ ] Unit tests passing: `npm run test:unit`

### Exit Criteria (Before Review)

- [ ] All unit tests pass: `npm run test:unit`
- [ ] pgTAP tests pass: `npm run test:db` (all `4.3-DB-*` tests pass)
- [ ] E2E-001 passes: end session flow end-to-end
- [ ] TypeScript: `npm run typecheck` clean
- [ ] ESLint: `npm run lint` clean
- [ ] No empty catch blocks — all errors via `handleScriptureError()`
- [ ] `useScripturePresence` cleanup verified — no memory leaks (timer cleared on disconnect detection)
- [ ] `useScriptureBroadcast` channel error handling verified — re-subscribes on error, resyncs state
- [ ] `project-structure-boundaries.md` updated: add `DisconnectionOverlay.tsx`

### Cross-Story Context

- **Stories 1-3** — provides: DB tables, service layer, slice, IndexedDB, `SoloReadingFlow`, reflection system, stats
- **Story 4.1** — adds: role selection, lobby, ready state, countdown, `LobbyContainer`, `useScriptureBroadcast`, `Countdown.tsx`
- **Story 4.2** — adds: lock-in reading, role alternation, `ReadingContainer`, `LockInButton`, `RoleIndicator`, `PartnerPosition`, `useScripturePresence`; moved `useScriptureBroadcast` to `ScriptureOverview`
- **Story 4.3 (this story)** — adds: disconnection detection via presence TTL, `DisconnectionOverlay`, `endSession()` RPC, broadcast channel reconnection, client resync; extends `useScripturePresence` (isPartnerConnected), `useScriptureBroadcast` (error handling), `LockInButton` (disabled-disconnected state)

### Project Structure Notes

- `DisconnectionOverlay.tsx` in `session/` — it manages session-level lifecycle concerns (disconnection/reconnection), not reading-level content
- No new hooks needed — extend existing `useScripturePresence` and `useScriptureBroadcast`
- No new IndexedDB stores — disconnection state is ephemeral (Zustand only, resets on page refresh)
- No `DB_VERSION` bump — only adding a Supabase RPC, no IndexedDB schema changes
- Update `_bmad-output/planning-artifacts/architecture/project-structure-boundaries.md` as dev-story exit criterion: add `DisconnectionOverlay.tsx` to the file list under FR14-29 (Together Mode)

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-4-together-mode-synchronized-reading.md#Story 4.3]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 2 (Real-Time Sync), Decision 3 (State Machine)]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Broadcast Event Naming, Communication Patterns, Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Together Mode FR14-29]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Lock-In Button States (Sync Paused state), Partner Presence Feedback (Disconnected state)]
- [Source: _bmad-output/implementation-artifacts/4-2-synchronized-reading-with-lock-in.md#Architecture Constraints — Broadcast Channel Continuity, Presence Channel Architecture, Error Handling]
- [Source: _bmad-output/implementation-artifacts/4-1-lobby-role-selection-and-countdown.md#Architecture Constraints — Broadcast Channel Architecture, Error Handling]
- [Source: src/hooks/useScripturePresence.ts — HEARTBEAT_INTERVAL_MS=10000, STALE_TTL_MS=20000]
- [Source: src/hooks/useScriptureBroadcast.ts — channel lifecycle, event handling patterns]
- [Source: src/stores/slices/scriptureReadingSlice.ts — ScriptureReadingState, exitSession(), callLobbyRpc()]
- [Source: src/components/scripture-reading/containers/ReadingContainer.tsx — existing useScripturePresence integration]
- [Source: _bmad-output/project-context.md — all project rules and conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- 2026-02-28: Ran `npx playwright test tests/e2e/scripture/scripture-reconnect-4.3.spec.ts --grep "4.3-E2E-002" --project=chromium` with Currents disabled (`CURRENTS_RECORD_KEY=`). Failure captured at `navigateToTogetherRoleSelection` waiting for `lobby-role-selection`.

### Completion Notes List

- Task 1: Created `scripture_end_session` RPC migration with `ended_early` enum value. RPC validates auth, checks in_progress status, sets status/completed_at, bumps version, broadcasts state_updated with `triggered_by: 'end_session'`.
- Task 2: Extended `useScripturePresence` with `isPartnerConnected: boolean` on `PartnerPresenceInfo`. Added stale detection timer that fires after 20s of no presence_update, sets `isPartnerConnected: false`. Resets to `true` on new presence_update.
- Task 3: Extended `scriptureReadingSlice` with `partnerDisconnected`, `partnerDisconnectedAt`, `setPartnerDisconnected()`, `endSession()`. Extended `onBroadcastReceived` to handle `triggeredBy: 'end_session'` and `currentPhase: 'complete'` — calls `exitSession()`.
- Task 4: Created `DisconnectionOverlay.tsx` with two-phase UI: Phase A (< 30s) "Partner reconnecting..." with pulse animation, Phase B (>= 30s) "Your partner seems to have stepped away" with Keep Waiting/End Session buttons. Neutral language, aria-live announcement, min 48px touch targets.
- Task 5: Integrated disconnection detection into `ReadingContainer.tsx`. Tracks `isPartnerConnected` transitions via useEffect + useRef. Renders DisconnectionOverlay when disconnected. On reconnect, calls `loadSession()` to resync.
- Task 6: Extended `LockInButton.tsx` with `isPartnerDisconnected` prop. Disconnected+unlocked shows "Holding your place" disabled button. Disconnected+locked shows waiting state with "Reconnecting..." note, undo still available.
- Task 7: Client resync handled in `ReadingContainer` (partner reconnects → loadSession) and `useScriptureBroadcast` (channel re-subscribe → loadSession).
- Task 8: Extended `useScriptureBroadcast` with CHANNEL_ERROR and CLOSED handling. On error: logs error, marks hasErrored, attempts re-subscribe. On successful re-subscribe after error: calls loadSession for state resync.
- Task 9: Created pgTAP tests in `12_scripture_end_session.sql` — 4 tests covering user1 end, user2 end, non-member security, already-completed guard.
- Task 10: All 25 unit tests pass — 9 DisconnectionOverlay, 10 slice reconnection, 3 presence reconnection, 3 broadcast reconnection. Also added 3 LockInButton disconnected state tests.
- Task 11: E2E test file includes 2 active tests; updated 4.3-E2E-001 for confirmation-step flow and Playwright matcher compatibility, plus partner-side recovery assertion in 4.3-E2E-002.
- Code Review Round 2: Resolved 4 action items — H1: handleKeepWaiting race condition (check isPartnerConnected before re-asserting disconnect), M1: ESLint set-state-in-effect suppression, M3: CLOSED handler removeChannel before re-subscribe, L2: E2E comment clarification.
- Code Review Round 4: Resolved 5 requested action items — end-session confirmation gate, non-409 error toast visibility, Playwright matcher fix, partner recovery assertion, and story file-list traceability correction.

### Change Log

- 2026-02-28: Story 4.3 implementation complete — all unit tests pass (777/777, 0 regressions)
- 2026-02-28: Addressed Round 2 code review findings — 4 items resolved (1 HIGH, 2 MEDIUM, 1 LOW), all 791 unit tests pass
- 2026-02-28: Addressed follow-up action items (5 total): fixed matcher API, added End Session confirmation gate, exposed end-session failures in-reading, added partner-page recovery assertion, and corrected story file inventory.
- 2026-02-28: Validation rerun — Story 4.3 targeted unit suite passed (68/68); targeted Playwright 4.3-E2E-002 rerun executed and failure context captured.

### File List

**New files:**
- src/components/scripture-reading/session/DisconnectionOverlay.tsx
- supabase/migrations/20260228000001_scripture_end_session.sql
- supabase/tests/database/12_scripture_end_session.sql

**Modified files:**
- src/stores/slices/scriptureReadingSlice.ts — added partnerDisconnected state, setPartnerDisconnected/endSession actions, extended onBroadcastReceived
- src/hooks/useScripturePresence.ts — added isPartnerConnected to PartnerPresenceInfo, stale detection timer
- src/hooks/useScriptureBroadcast.ts — added CHANNEL_ERROR/CLOSED handling, re-subscribe with loadSession resync
- src/components/scripture-reading/containers/ReadingContainer.tsx — added disconnection detection, overlay rendering, reconnect resync
- src/components/scripture-reading/containers/ScriptureOverview.tsx — touched during story implementation history (top-level broadcast lifecycle + routing) and now included for traceability parity with git state
- src/components/scripture-reading/session/LockInButton.tsx — added isPartnerDisconnected prop with disabled state
- src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx — unskipped 9 tests
- src/components/scripture-reading/__tests__/LockInButton.test.tsx — added 3 disconnected state tests
- src/components/scripture-reading/__tests__/ReadingContainer.test.tsx — added coverage for visible non-409 reading-phase sync failure toast
- tests/unit/stores/scriptureReadingSlice.reconnect.test.ts — unskipped 10 tests
- tests/unit/hooks/useScripturePresence.reconnect.test.ts — unskipped 3 tests, fixed subscribe mock
- tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts — unskipped 3 tests, fixed promise flush
- tests/e2e/scripture/scripture-reconnect-4.3.spec.ts — fixed matcher API, added confirmation-step click path for end-session flow, and added partner-page recovery assertion
- _bmad-output/implementation-artifacts/sprint-status.yaml — story 4.3 status tracked/updated during implementation and follow-up review rounds
- _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — added DisconnectionOverlay.tsx

## Code Review Action Items

### Round 1 (2026-02-28) — All Fixed

- [x] ~~H1 [HIGH] — Broadcast channel re-subscribe broken after CHANNEL_ERROR~~ → Fixed: added `retryCount` state to useEffect deps
- [x] ~~M1 [MEDIUM] — Reconnection toast not implemented~~ → Fixed: added `showReconnectedToast` state + render in ReadingContainer
- [x] ~~M2 [MEDIUM] — Inline SVG instead of Lucide WifiOff~~ → Fixed: replaced with `<WifiOff>` from `lucide-react`
- [x] ~~M3 [MEDIUM] — Missing prefers-reduced-motion handling~~ → Fixed: added `motion-reduce:animate-none`
- [x] ~~E2E — Unskip E2E tests~~ → Fixed: changed `test.skip` to `test`

### Round 2 (2026-02-28) — All Fixed

- [x] ~~H1 [HIGH] — `handleKeepWaiting` race condition with partner reconnection~~ → Fixed: `handleKeepWaiting` now checks `partnerPresence.isPartnerConnected`; if partner already reconnected, calls `setPartnerDisconnected(false)` to dismiss overlay
- [x] ~~M1 [MEDIUM] — ESLint warning: setState in useEffect body~~ → Fixed: added inline `eslint-disable-next-line react-hooks/set-state-in-effect` with explanation comment
- [x] ~~M3 [MEDIUM] — `useScriptureBroadcast` CLOSED handler skips `removeChannel()`~~ → Fixed: CLOSED handler now calls `supabase.removeChannel(channel).then(...)` before nullifying ref, matching CHANNEL_ERROR pattern
- [x] ~~L2 [LOW] — E2E-002 relies on `page.reload()` for reconnection~~ → Fixed: expanded comment explaining why reload is used (Playwright route.abort tears down WebSocket) and that unit tests cover channel-level reconnection

### Round 3 (2026-02-28)

- [x] ~~H1 [HIGH] — E2E test uses `toHaveTextContent` (Testing Library matcher) instead of Playwright's `toContainText`~~ → Fixed: replaced with Playwright-compatible `toContainText`
- [ ] L1 [LOW] — 2 unsuppressed ESLint `set-state-in-effect` warnings in Story 4.3 code [ReadingContainer.tsx:110, DisconnectionOverlay.tsx:36]
- [x] ~~L2 [LOW] — No visible user feedback when `endSession()` RPC fails — overlay stays but user can retry~~ → Fixed: added visible `session-error-toast` in reading mode for non-409 sync failures
- [x] ~~L3 [LOW] — E2E-002 doesn't assert `partnerPage` has `reading-container` after reconnect~~ → Fixed: added partner-page `reading-container` visibility assertion

### Round 4 (2026-02-28)

- [x] ~~H1 [HIGH] — "End Session" flow had no explicit confirmation step before destructive action~~ → Fixed: introduced confirmation UI gate (`disconnection-confirm-end-session` / `disconnection-cancel-end-session`) before calling `onEndSession`
- [x] ~~M1 [MEDIUM] — Story file inventory was out of sync with actual git changes (`ScriptureOverview.tsx` missing)~~ → Fixed: added missing file to story File List for traceability alignment
