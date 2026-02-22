# Story 4.2: Synchronized Reading with Lock-In

Status: ready-for-dev

## Story

As a couple,
I want to read verses with clear roles, navigate freely within each step, and advance together via mutual lock-in,
so that we progress through scripture as a team without one partner rushing ahead.

## Acceptance Criteria

**Given** the Together session has started after countdown
**When** a verse screen loads
**Then** the Reader sees a RoleIndicator pill badge: "You read this" (#A855F7)
**And** the Responder sees: "Partner reads this" (#C084FC)
**And** both see the verse text (Playfair Display) and the BookmarkFlag
**And** both can freely navigate between verse and response screens
**And** roles alternate each step: Reader on verse N becomes Responder on verse N+1

**Given** both partners are viewing a step
**When** either partner navigates between verse and response
**Then** a PartnerPosition indicator shows where the partner is: "[Name] is viewing the [verse/response]"
**And** position updates are sent via ephemeral presence channel (scripture-presence:{session_id})
**And** presence is throttled: on view change + heartbeat every ~10s
**And** stale presence drops after ~20s TTL

**Given** a partner is ready to advance
**When** they tap "Ready for next verse" (LockInButton)
**Then** an optimistic `isPendingLockIn` state is set locally
**And** the RPC `scripture_lock_in(p_session_id, p_step_index, p_expected_version)` is called
**And** the button transforms to "Waiting for [PartnerName]..." with "Tap to undo" below

**Given** one partner has locked in
**When** the other partner has not
**Then** the locked-in partner sees the waiting state
**And** they can tap "Tap to undo" to clear their lock-in
**And** the waiting partner sees "[PartnerName] is ready" indicator (no pressure language)

**Given** both partners lock in
**When** the server confirms both locks via RPC
**Then** the server bumps session version and advances `current_step_index`
**And** a broadcast `state_updated` fires: `{ currentStepIndex, version, currentPhase, triggeredBy: 'lock_in' }`
**And** both clients advance to the next step with slide-left + fade animation (300ms, instant if reduced-motion)
**And** `isPendingLockIn` and `partnerLocked` are reset to false on both clients

**Given** the server rejects a lock-in with version mismatch
**When** the client receives the rejection
**Then** `isPendingLockIn` is rolled back to false
**And** the client refetches session state from server
**And** a subtle toast shows "Session updated" (no alarming language)

**Given** both partners complete step 17's lock-in
**When** advancing past the last step
**Then** the session phase transitions to 'reflection'
**And** both partners enter the existing reflection flow (ScriptureOverview routes to SoloReadingFlow via reflection catch-all)

## Tasks / Subtasks

- [ ] Task 1: DB Migration — scripture_lock_in and scripture_undo_lock_in RPCs (AC: #3, #4, #5, #6, #7)
  - [ ] 1.1 Create migration file `supabase/migrations/20260222000001_scripture_lock_in.sql`
  - [ ] 1.2 `scripture_lock_in(p_session_id UUID, p_step_index INT, p_expected_version INT)` RPC:
    - Validates: caller is session member (user1_id or user2_id), `current_phase = 'reading'`, `current_step_index = p_step_index`
    - On `session.version != p_expected_version`: RAISE EXCEPTION '409: version mismatch' (client catches and treats as 409)
    - Idempotent UPSERT into `scripture_step_states`: sets `user1_locked_at = now()` (if caller is user1) or `user2_locked_at = now()` (if caller is user2); uses `ON CONFLICT (session_id, step_index) DO UPDATE`
    - If both locks now set (user1_locked_at IS NOT NULL AND user2_locked_at IS NOT NULL):
      - Sets `advanced_at = now()`
      - If `p_step_index < 16`: updates `scripture_sessions` → `current_step_index = p_step_index + 1`, bumps `version`
      - If `p_step_index = 16` (last step): updates `scripture_sessions` → `current_phase = 'reflection'`, `status = 'complete'`, bumps `version`
      - Updates `snapshot_json` on session
      - Broadcasts `state_updated` on `scripture-session:{session_id}` with: `{ currentPhase, currentStepIndex, version, triggeredBy: 'lock_in' }`
    - If single lock set (partial): broadcasts `lock_in_status_changed` on `scripture-session:{session_id}` with: `{ step_index: p_step_index, user1_locked: bool, user2_locked: bool }`
    - Returns row from `scripture_sessions` (current snapshot)
  - [ ] 1.3 `scripture_undo_lock_in(p_session_id UUID, p_step_index INT)` RPC:
    - Validates: caller is session member, `current_phase = 'reading'`
    - Sets caller's lock column back to NULL (`user1_locked_at = NULL` or `user2_locked_at = NULL`)
    - Broadcasts `lock_in_status_changed` on `scripture-session:{session_id}`: `{ step_index: p_step_index, user1_locked: bool, user2_locked: bool }`
    - Returns current session row
  - [ ] 1.4 Both RPCs: `SECURITY INVOKER`, `set search_path = ''`, fully qualified table names (`public.scripture_sessions`, `public.scripture_step_states`), `GRANT EXECUTE ON FUNCTION ... TO authenticated`
  - [ ] 1.5 Add RLS policies for presence channel on `realtime.messages`:
    - SELECT: `topic LIKE 'scripture-presence:%' AND SPLIT_PART(topic, ':', 2)::uuid IN (SELECT id FROM public.scripture_sessions WHERE user1_id = (SELECT auth.uid()) OR user2_id = (SELECT auth.uid()))`
    - INSERT: same condition with WITH CHECK

- [ ] Task 2: Extend ScriptureReadingState and StateUpdatePayload (AC: #3, #4, #5)
  - [ ] 2.1 In `scriptureReadingSlice.ts`, extend `StateUpdatePayload` (add optional fields to avoid breaking Story 4.1 callers):
    ```typescript
    currentStepIndex?: number;          // Added Story 4.2 — present when step advances
    triggeredBy?: 'lock_in' | 'phase_advance' | 'reconnect';  // Added Story 4.2
    ```
  - [ ] 2.2 Add `partnerLocked: boolean` to `ScriptureReadingState` interface (default: false in `initialScriptureState`)
  - [ ] 2.3 Add actions to `ScriptureSlice` interface:
    - `lockIn(): Promise<void>`
    - `undoLockIn(): Promise<void>`
    - `onPartnerLockInChanged(locked: boolean): void`

- [ ] Task 3: Implement lockIn, undoLockIn, onPartnerLockInChanged slice actions (AC: #3, #4, #5, #6)
  - [ ] 3.1 `lockIn()`:
    - Guard: no session, or `session.currentPhase !== 'reading'` → return early
    - Optimistic: `set({ isPendingLockIn: true, scriptureError: null })`
    - Call `callLobbyRpc('scripture_lock_in', { p_session_id: session.id, p_step_index: session.currentStepIndex, p_expected_version: session.version })`
    - On success (single lock): no further state update — `state_updated` or `lock_in_status_changed` broadcast will arrive via `useScriptureBroadcast`
    - On 409-like error (message includes '409'): rollback `isPendingLockIn: false`; call `scriptureReadingService.getSession(session.id)` to refetch; set refreshed session; set `scriptureError: { code: SYNC_FAILED, message: 'Session updated' }` (subtle toast)
    - On other error: rollback `isPendingLockIn: false`; `handleScriptureError`; set `scriptureError`
  - [ ] 3.2 `undoLockIn()`:
    - Guard: no session
    - `set({ isPendingLockIn: false })` — optimistic
    - Call `callLobbyRpc('scripture_undo_lock_in', { p_session_id: session.id, p_step_index: session.currentStepIndex })`
    - On error: re-set `isPendingLockIn: true` (rollback); `handleScriptureError`
  - [ ] 3.3 `onPartnerLockInChanged(locked: boolean)`: `set({ partnerLocked: locked })`
  - [ ] 3.4 Extend `onBroadcastReceived` to handle step advance from lock-in:
    - After existing version check and state update, additionally:
    - If `payload.currentStepIndex != null && session && payload.currentStepIndex !== session.currentStepIndex`:
      - Update `session.currentStepIndex = payload.currentStepIndex`
      - Clear `isPendingLockIn: false`, `partnerLocked: false`
    - The phase update (`payload.currentPhase`) already handled by existing `onBroadcastReceived` logic — ensures 'reflection' transition works

- [ ] Task 4: Create useScripturePresence hook (AC: #2)
  - [ ] 4.1 Create `src/hooks/useScripturePresence.ts`
  - [ ] 4.2 Signature:
    ```typescript
    interface PartnerPresenceInfo {
      view: 'verse' | 'response' | null;
      stepIndex: number | null;
      ts: number | null;
    }
    export function useScripturePresence(
      sessionId: string | null,
      stepIndex: number,
      view: 'verse' | 'response'
    ): PartnerPresenceInfo
    ```
  - [ ] 4.3 On mount (sessionId non-null): call `supabase.realtime.setAuth()` then join `scripture-presence:{sessionId}` with `{ config: { broadcast: { self: false }, private: true } }`
  - [ ] 4.4 On channel SUBSCRIBED: send own presence immediately: `{ type: 'broadcast', event: 'presence_update', payload: { user_id, step_index: stepIndex, view, ts: Date.now() } }`
  - [ ] 4.5 Listen for `presence_update` events: store latest `PartnerPresenceInfo` in local `useRef` (NOT in Zustand — ephemeral); return it via `useState` for re-render
  - [ ] 4.6 TTL: in `presence_update` listener, if `Date.now() - payload.ts > 20000` drop silently (don't update state)
  - [ ] 4.7 Heartbeat: `setInterval` every 10s, re-send own presence with updated `ts`; clear interval on unmount
  - [ ] 4.8 On `view` prop change: immediately re-send presence (useEffect dep on `[view]`)
  - [ ] 4.9 On `stepIndex` prop change: re-send presence with new step; reset `partnerPresence` to null (stale from old step)
  - [ ] 4.10 On unmount / sessionId change to null: call `supabase.removeChannel(channel)`, clear interval
  - [ ] 4.11 Auth error handling: route through `handleScriptureError(ScriptureErrorCode.SYNC_FAILED, ...)`
  - [ ] 4.12 Export from `src/hooks/index.ts`

- [ ] Task 5: Extend useScriptureBroadcast for lock_in_status_changed (AC: #4)
  - [ ] 5.1 Add `onPartnerLockInChanged`, `currentUserId`, `sessionUserId` to the `useShallow` selector:
    ```typescript
    const { ..., onPartnerLockInChanged, currentUserId, sessionUserId } = useAppStore(
      useShallow((state) => ({
        ...existing,
        onPartnerLockInChanged: state.onPartnerLockInChanged,
        currentUserId: state.currentUserId,
        sessionUserId: state.session?.userId ?? null, // user1_id
      }))
    );
    ```
  - [ ] 5.2 Add event listener in the channel chain:
    ```typescript
    .on('broadcast', { event: 'lock_in_status_changed' }, (msg: { payload: LockInStatusChangedPayload }) => {
      const isUser1 = currentUserId !== null && currentUserId === sessionUserId;
      const partnerLocked = isUser1 ? msg.payload.user2_locked : msg.payload.user1_locked;
      onPartnerLockInChanged(partnerLocked);
    })
    ```
  - [ ] 5.3 Add `LockInStatusChangedPayload` interface at top of file:
    ```typescript
    interface LockInStatusChangedPayload {
      step_index: number;
      user1_locked: boolean;
      user2_locked: boolean;
    }
    ```
  - [ ] 5.4 Add `onPartnerLockInChanged`, `currentUserId`, `sessionUserId` to the `useEffect` dependency array

- [ ] Task 6: Create LockInButton.tsx (AC: #3, #4)
  - [ ] 6.1 Create `src/components/scripture-reading/session/LockInButton.tsx`
  - [ ] 6.2 Props interface:
    ```typescript
    interface LockInButtonProps {
      isLocked: boolean;       // User has pending lock-in
      isPending: boolean;      // RPC in-flight (disable button)
      partnerLocked: boolean;  // Partner has pending lock-in
      partnerName: string;
      onLockIn: () => void;
      onUndoLockIn: () => void;
    }
    ```
  - [ ] 6.3 Unlocked (isLocked=false): primary purple button "Ready for next verse" (`bg-purple-600 text-white`)
  - [ ] 6.4 Locked (isLocked=true): secondary button "Waiting for [partnerName]..." + small link below "Tap to undo"
  - [ ] 6.5 If `partnerLocked && !isLocked`: show "[PartnerName] is ready" with green check indicator above button (no pressure)
  - [ ] 6.6 If `isPending`: button shows loading state (opacity-50, pointer-events-none)
  - [ ] 6.7 Min 48px touch target on all interactive elements
  - [ ] 6.8 `data-testid`: `lock-in-button`, `lock-in-undo`, `partner-locked-indicator`
  - [ ] 6.9 `aria-label` on main button describing current state

- [ ] Task 7: Create RoleIndicator.tsx (AC: #1)
  - [ ] 7.1 Create `src/components/scripture-reading/reading/RoleIndicator.tsx`
  - [ ] 7.2 Props: `{ role: 'reader' | 'responder' }`
  - [ ] 7.3 Reader: pill badge with `backgroundColor: '#A855F7'` (primary purple), white text: "You read this"
  - [ ] 7.4 Responder: pill badge with `backgroundColor: '#C084FC'` (lighter purple), white text: "Partner reads this"
  - [ ] 7.5 Rounded pill: `rounded-full px-3 py-1 text-sm font-medium`
  - [ ] 7.6 `data-testid="role-indicator"`, `aria-label` describing the role

- [ ] Task 8: Create PartnerPosition.tsx (AC: #2)
  - [ ] 8.1 Create `src/components/scripture-reading/reading/PartnerPosition.tsx`
  - [ ] 8.2 Props: `{ partnerName: string; presence: PartnerPresenceInfo }` (import `PartnerPresenceInfo` from `useScripturePresence`)
  - [ ] 8.3 When `presence.view === null`: render nothing (no stale indicator)
  - [ ] 8.4 When `presence.view === 'verse'`: "[PartnerName] is reading the verse"
  - [ ] 8.5 When `presence.view === 'response'`: "[PartnerName] is reading the response"
  - [ ] 8.6 Muted styling: `text-purple-400 text-sm` with small eye icon
  - [ ] 8.7 `data-testid="partner-position"`, `aria-live="polite"` for screen reader updates

- [ ] Task 9: Create ReadingContainer.tsx (AC: all)
  - [ ] 9.1 Create `src/components/scripture-reading/containers/ReadingContainer.tsx`
  - [ ] 9.2 Zustand selector (useShallow): `session`, `myRole`, `isPendingLockIn`, `partnerLocked`, `lockIn`, `undoLockIn`
  - [ ] 9.3 Also select `partner` from `partnerSlice` for `partnerName`
  - [ ] 9.4 Local state: `localView: 'verse' | 'response'` (default: 'verse')
  - [ ] 9.5 Call `useScripturePresence(session?.id ?? null, session?.currentStepIndex ?? 0, localView)` → `partnerPresence`
  - [ ] 9.6 Effective role calculation:
    ```typescript
    const effectiveRole: SessionRole = myRole === null ? 'reader' :
      (myRole === 'reader') === (session.currentStepIndex % 2 === 0)
        ? 'reader' : 'responder';
    ```
  - [ ] 9.7 Current step data: `const step = SCRIPTURE_STEPS[session.currentStepIndex]`
  - [ ] 9.8 Verse/response navigation: tabs or toggle buttons (`data-testid="reading-tab-verse"`, `data-testid="reading-tab-response"`)
  - [ ] 9.9 Track previous `session.currentStepIndex` via `useRef` to detect step advance (triggers slide animation)
  - [ ] 9.10 Framer Motion AnimatePresence: slide-left + fade on step change (300ms); `useMotionConfig().fade` for reduced-motion
  - [ ] 9.11 Toast state: show "Session updated" for 3s when 409 error occurs (watch `scriptureError` for SYNC_FAILED with 'Session updated' message)
  - [ ] 9.12 Reset `localView` to 'verse' on step advance
  - [ ] 9.13 Data testids: `reading-container`, `reading-verse-text`, `reading-response-text`, `reading-step-progress`, `session-update-toast`
  - [ ] 9.14 Do NOT call `useScriptureBroadcast` here — it is already mounted by LobbyContainer via ScriptureOverview routing and persists through the reading phase (see Architecture Constraint below)

- [ ] Task 10: Update ScriptureOverview.tsx routing (AC: #1)
  - [ ] 10.1 Import `ReadingContainer` from containers
  - [ ] 10.2 Add routing condition AFTER the LobbyContainer check and BEFORE the main overview render:
    ```typescript
    // Story 4.2: Route to ReadingContainer for together-mode reading phase
    if (
      session &&
      session.mode === 'together' &&
      session.currentPhase === 'reading'
    ) {
      return <ReadingContainer />;
    }
    ```
  - [ ] 10.3 Verify existing reflection catch-all still handles together-mode reflection (it should — no change needed)

- [ ] Task 11: Update index.ts exports
  - [ ] 11.1 `src/components/scripture-reading/index.ts`: export `LockInButton`, `RoleIndicator`, `PartnerPosition`, `ReadingContainer`
  - [ ] 11.2 `src/hooks/index.ts`: export `useScripturePresence`

- [ ] Task 12: pgTAP database tests (AC: #3, #6, #7)
  - [ ] 12.1 New file: `supabase/tests/database/11_scripture_lockin.sql`
  - [ ] 12.2 `4.2-DB-001`: Single lock-in — user1 calls `scripture_lock_in(session_id, 0, version)` → `user1_locked_at` IS NOT NULL, `user2_locked_at` IS NULL, `advanced_at` IS NULL, `current_step_index` = 0
  - [ ] 12.3 `4.2-DB-002`: Both lock-in → advance — user1 + user2 both lock → `advanced_at` IS NOT NULL, `current_step_index` = 1, `version` incremented
  - [ ] 12.4 `4.2-DB-003`: Version mismatch raises exception — calling with stale version throws
  - [ ] 12.5 `4.2-DB-004`: RLS security — non-member cannot call `scripture_lock_in` (throws)
  - [ ] 12.6 `4.2-DB-005`: Last step (step 16) — both lock → `current_phase = 'reflection'`, `status = 'complete'`
  - [ ] 12.7 `4.2-DB-006`: Undo lock-in — user1 locks then calls `scripture_undo_lock_in` → `user1_locked_at` IS NULL
  - [ ] **CRITICAL**: Set `partner_id` in `public.users` before asserting couple/security behavior (Epic 3 retro rule)

- [ ] Task 13: Unit tests (AC: all)
  - [ ] 13.1 `src/components/scripture-reading/__tests__/LockInButton.test.tsx`:
    - Unlocked renders "Ready for next verse"
    - Locked renders waiting state + "Tap to undo" visible
    - `onLockIn` called on button click (unlocked state)
    - `onUndoLockIn` called on "Tap to undo" click
    - `partnerLocked=true` shows partner indicator
    - `isPending=true` disables button
  - [ ] 13.2 `src/components/scripture-reading/__tests__/RoleIndicator.test.tsx`:
    - Reader renders "#A855F7" background and "You read this"
    - Responder renders "#C084FC" and "Partner reads this"
    - aria-label correct for both
  - [ ] 13.3 `src/components/scripture-reading/__tests__/PartnerPosition.test.tsx`:
    - `view=null` renders nothing
    - `view='verse'` shows verse message
    - `view='response'` shows response message
    - `aria-live="polite"` present
  - [ ] 13.4 `src/components/scripture-reading/__tests__/ReadingContainer.test.tsx`:
    - Renders role indicator with correct role
    - `lockIn` called when lock-in button clicked
    - `undoLockIn` called when undo clicked
    - `effectiveRole` = 'reader' on even step, 'responder' on odd step (when myRole='reader')
    - PartnerPosition receives presence data
    - Shows "Session updated" toast when SYNC_FAILED error present
  - [ ] 13.5 `tests/unit/hooks/useScripturePresence.test.ts`:
    - Channel joined on non-null sessionId
    - `setAuth` called before subscribe
    - Sends presence immediately on SUBSCRIBED
    - Re-sends presence when `view` prop changes
    - Partner presence returned when `presence_update` broadcast received
    - Presence dropped if `ts` > 20s stale
    - Presence reset to null on stepIndex change
    - Cleanup removes channel and clears interval
  - [ ] 13.6 `tests/unit/stores/scriptureReadingSlice.lockin.test.ts`:
    - `lockIn()` sets `isPendingLockIn: true`
    - `undoLockIn()` sets `isPendingLockIn: false`
    - `onPartnerLockInChanged(true)` sets `partnerLocked: true`
    - `onBroadcastReceived` with higher `currentStepIndex` clears both lock flags and updates step
    - `onBroadcastReceived` with same step does NOT clear `isPendingLockIn`
    - `lockIn()` error with '409' in message → rollback + scriptureError with 'Session updated'
    - `lockIn()` other error → rollback + SYNC_FAILED error

- [ ] Task 14: E2E tests (AC: #1, #3, #4, #5, #6, #7)
  - [ ] 14.1 New file: `tests/e2e/scripture/scripture-reading-4.2.spec.ts`
  - [ ] 14.2 `4.2-E2E-001`: Full lock-in flow — both users in reading phase → user A taps "Ready for next verse" → user B sees "[PartnerName] is ready" → user B taps "Ready for next verse" → both advance to step 2 (verse text changes, role indicator updates)
  - [ ] 14.3 `4.2-E2E-002`: Undo lock-in — user A locks → "Tap to undo" visible → user A taps undo → button reverts to "Ready for next verse"; user B's partner indicator disappears
  - [ ] 14.4 `4.2-E2E-003`: Role alternation — user A (Reader on step 1) locks in with user B → step advances → user A shows "Partner reads this" (Responder); user B shows "You read this" (Reader)
  - [ ] 14.5 `4.2-E2E-004`: Last step completion — navigate to step 17 (via repeated lock-ins or seed) → both lock in → reflection phase UI appears
  - [ ] **Always import** `{ test, expect }` from `tests/support/merged-fixtures`
  - [ ] **Use** `tests/support/helpers/scripture-lobby.ts` for shared lobby setup helpers (added in Story 4.1)

## Dev Notes

### What Already Exists — DO NOT Recreate

| Component/File | What It Does | Location |
|---|---|---|
| `scriptureReadingSlice.ts` | All session state, lobby state, `callLobbyRpc` helper, `isPendingLockIn` already in state | `src/stores/slices/scriptureReadingSlice.ts` |
| `useScriptureBroadcast.ts` | Manages `scripture-session:{sessionId}` channel; handles `partner_joined`, `ready_state_changed`, `state_updated`, `session_converted` | `src/hooks/useScriptureBroadcast.ts` |
| `LobbyContainer.tsx` | Reference container pattern: `useShallow` selector, broadcast lifecycle, error handling | `src/components/scripture-reading/containers/LobbyContainer.tsx` |
| `SoloReadingFlow.tsx` | Reference for reading flow pattern (AnimatePresence, step navigation, useMotionConfig) | `src/components/scripture-reading/containers/SoloReadingFlow.tsx` |
| `BookmarkFlag.tsx` | Already exists in `reading/`, used by SoloReadingFlow — reuse directly | `src/components/scripture-reading/reading/BookmarkFlag.tsx` |
| `Countdown.tsx` | Reference for Framer Motion animation with reduced-motion support | `src/components/scripture-reading/session/Countdown.tsx` |
| `scripture_step_states` table | Already has `user1_locked_at`, `user2_locked_at`, `advanced_at`, `UNIQUE(session_id, step_index)` | `supabase/migrations/20260128000001_scripture_reading.sql` |
| `scripture_sessions` table | Has `current_step_index`, `version`, `snapshot_json`, `current_phase` — no changes needed | existing migration |
| `callLobbyRpc` helper | Untyped RPC wrapper for RPCs postdating last `gen types` run — reuse for `scripture_lock_in` / `scripture_undo_lock_in` | `scriptureReadingSlice.ts` line 47 |
| `scriptureTheme` tokens | `{ primary: '#A855F7', background: '#F3E5F5', surface: '#FAF5FF' }` | `ScriptureOverview.tsx` line 38 |
| `FOCUS_RING` constant | `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'` | `ScriptureOverview.tsx` line 45 |
| `SCRIPTURE_STEPS` | Step data (verse + response text for all 17 steps) | `src/data/scriptureSteps.ts` |
| `MAX_STEPS` | = 17 | `src/data/scriptureSteps.ts` |
| `partnerSlice` | `partner: PartnerInfo \| null` — has `partner.displayName` for UI | `src/stores/slices/partnerSlice.ts` |
| `useMotionConfig` | Motion presets respecting reduced-motion | `src/hooks/useMotionConfig.ts` |
| RLS policies for `realtime.messages` | `scripture-session:%` channel policies from Story 4.1 migration | `supabase/migrations/20260220000001_scripture_lobby_and_roles.sql` |
| `handleScriptureError` / `ScriptureErrorCode` | Error routing — MUST use, never empty catch | `src/services/scriptureReadingService.ts` |
| `scripture-lobby.ts` helpers | `setupTogetherSession`, lobby helpers created in Story 4.1 | `tests/support/helpers/scripture-lobby.ts` |

### What Does NOT Exist Yet — You Must Create

| File | Purpose |
|---|---|
| `src/components/scripture-reading/containers/ReadingContainer.tsx` | Together-mode reading orchestrator — roles, step view, lock-in, presence |
| `src/components/scripture-reading/session/LockInButton.tsx` | Presentational: lock-in / waiting / undo button |
| `src/components/scripture-reading/reading/RoleIndicator.tsx` | Presentational: role pill badge |
| `src/components/scripture-reading/reading/PartnerPosition.tsx` | Presentational: ephemeral partner view position |
| `src/hooks/useScripturePresence.ts` | Presence channel lifecycle — separate from session broadcast channel |
| `supabase/migrations/20260222000001_scripture_lock_in.sql` | `scripture_lock_in` + `scripture_undo_lock_in` RPCs + presence channel RLS |
| `supabase/tests/database/11_scripture_lockin.sql` | pgTAP tests for lock-in RPCs |
| `tests/e2e/scripture/scripture-reading-4.2.spec.ts` | E2E tests for synchronized reading |
| `tests/unit/stores/scriptureReadingSlice.lockin.test.ts` | Unit tests for lock-in slice actions |
| `tests/unit/hooks/useScripturePresence.test.ts` | Unit tests for presence hook |

### Architecture Constraints

**Broadcast Channel Continuity:**
- `LobbyContainer` mounts `useScriptureBroadcast(session.id)` via Story 4.1
- When countdown completes → `updatePhase('reading')` → ScriptureOverview re-routes to `ReadingContainer`
- **DO NOT** call `useScriptureBroadcast` again in `ReadingContainer` — it would create a duplicate subscription. The `useScriptureBroadcast` hook ref guard (`channelRef.current !== null`) will prevent the double-subscribe, BUT `ReadingContainer` needs the session-channel broadcasts (for `state_updated` with lock-in completion and `lock_in_status_changed`)
- **Solution**: The existing `useScriptureBroadcast` channel from lobby phase persists in Zustand state via the hook's `useEffect` — it stays subscribed as long as `sessionId` doesn't change. When ScriptureOverview re-renders and routes to `ReadingContainer` instead of `LobbyContainer`, the Zustand store (and the hook) keep running because the hook is mounted at the App level through `useAppStore`. **VERIFY**: confirm `useScriptureBroadcast` is called from a component that persists through the lobby→reading transition. If LobbyContainer unmounts (which it does when ScriptureOverview re-routes), the hook unmounts too — **this is a bug to avoid**.
- **Correct approach**: Move `useScriptureBroadcast(session?.id ?? null)` call to `ScriptureOverview.tsx` or a parent component that doesn't unmount between phases. Currently it's called inside `LobbyContainer` — this means it unmounts with LobbyContainer. For Story 4.2, move the `useScriptureBroadcast` call to `ScriptureOverview.tsx` (before the routing conditionals) so it persists across lobby, countdown, and reading phases.

**Presence Channel Architecture:**
- Separate channel: `scripture-presence:{session_id}` (distinct from `scripture-session:{session_id}`)
- Per `.claude/rules/use-realtime.md`: `private: true` → requires RLS on `realtime.messages` for this channel topic pattern
- Granular topic (one per session) — matches guidance in `use-realtime.md`
- Ephemeral: NO persistence to IndexedDB (presence.ts data path: `Ephemeral broadcast → No persistence`)
- NOT in `useScriptureBroadcast` — separate `useScripturePresence` hook to keep concerns separated

**State Flow: Lock-In Complete (Both Locked)**
```
User taps "Ready" → lockIn() → isPendingLockIn=true → callLobbyRpc(scripture_lock_in)
→ Server: both locked → advance step → broadcast state_updated {currentStepIndex: N+1, version: V+1, triggeredBy: 'lock_in'}
→ useScriptureBroadcast receives state_updated → onBroadcastReceived(payload)
→ onBroadcastReceived: version check passes → update session.currentStepIndex, session.version
→ New code (Task 3.4): payload.currentStepIndex > current → clear isPendingLockIn=false, partnerLocked=false
→ ReadingContainer observes session.currentStepIndex change → trigger slide animation
```

**State Flow: Lock-In Partial (One Locked)**
```
User taps "Ready" → lockIn() → isPendingLockIn=true → callLobbyRpc(scripture_lock_in)
→ Server: only one locked → broadcast lock_in_status_changed {user1_locked: true, user2_locked: false, step_index: N}
→ useScriptureBroadcast receives lock_in_status_changed → determines partnerLocked from user1/user2 mapping
→ Partner client: onPartnerLockInChanged(true) → partnerLocked=true → "[PartnerName] is ready" indicator
→ Locking client: partnerLocked=false → shows waiting state (correct — partner hasn't locked)
```

**Effective Role Calculation:**
```typescript
// myRole is set at lobby entry and stored in slice
// Roles alternate every step: reader on even steps, responder on odd (if starting as reader)
const effectiveRole: SessionRole = myRole === null ? 'reader' :
  (myRole === 'reader') === (session.currentStepIndex % 2 === 0) ? 'reader' : 'responder';

// Examples:
// myRole='reader', step 0 (even): effectiveRole = 'reader' ✓
// myRole='reader', step 1 (odd): effectiveRole = 'responder' ✓
// myRole='responder', step 0 (even): effectiveRole = 'responder' ✓
// myRole='responder', step 1 (odd): effectiveRole = 'reader' ✓
```

**Import Discipline (from CLAUDE.md):**
- Do NOT import `supabase` in `ReadingContainer` or presentational components
- `useScripturePresence` is the ONLY new place that imports `supabase` for Broadcast (presence channel)
- `useScriptureBroadcast` retains the `scripture-session:` channel import
- Data flow: `ReadingContainer` → slice actions → `callLobbyRpc` (RPCs)

**Critical: Move useScriptureBroadcast to ScriptureOverview**

As noted in the broadcast channel continuity constraint above, `useScriptureBroadcast` MUST be called from a component that persists across lobby → reading phase transition. The solution:

In `ScriptureOverview.tsx`, call `useScriptureBroadcast(session?.mode === 'together' ? session?.id ?? null : null)` BEFORE the routing conditionals. This ensures the channel is alive from lobby entry through the end of reading. `LobbyContainer.tsx` must REMOVE its own `useScriptureBroadcast` call to prevent duplicate subscriptions.

**Error Handling (CLAUDE.md guardrail):**
- `lockIn()` 409 error → subtle toast "Session updated", NOT alarming error UI
- `lockIn()` other errors → `handleScriptureError(ScriptureErrorCode.SYNC_FAILED, ...)`
- All errors through `handleScriptureError` — NEVER empty catch blocks
- `undoLockIn()` error → rollback + `handleScriptureError`
- `useScripturePresence` auth error → `handleScriptureError(SYNC_FAILED)`

**DB Schema — scripture_lock_in RPC Design:**
```sql
-- Expected broadcast payload structure for state_updated (lock-in advance):
-- { sessionId, currentPhase, currentStepIndex, version, triggeredBy: 'lock_in' }

-- Expected broadcast payload for lock_in_status_changed (single lock):
-- { step_index, user1_locked: bool, user2_locked: bool }

-- The RPC must use realtime.broadcast_changes pattern for private channels
-- OR call realtime.send() directly for the custom payload
```

Note: `realtime.broadcast_changes` requires private channel. For custom payloads (like `lock_in_status_changed`), use `realtime.send(topic, event, payload::jsonb, false)` — the last param `false` = not private.

Wait — for `lock_in_status_changed`, sending via `realtime.send(..., false)` would make it a public message. Since we want private channels (for security), use `realtime.send(topic, event, payload::jsonb, true)` with the channel already set to private. Cross-reference `.claude/rules/use-realtime.md`: `realtime.send(topic, event, payload, private_flag)`.

**UX Requirements:**
- Verse text: `font-serif` (Playfair Display) — same as SoloReadingFlow
- Step progress: "Verse X of 17" header (same as SoloReadingFlow)
- Role pill: positioned near top of screen, below step progress
- Partner position: small muted text, below main content, above lock-in button
- Lock-in area: bottom of screen, prominent (always visible without scroll on mobile)
- "Session updated" toast: 3s, non-blocking, muted purple, `data-testid="session-update-toast"`
- Transition: slide-left on step advance; `useMotionConfig().fade` controls duration (0ms if reduced-motion)

### DB Schema Reference

**scripture_step_states (existing):**
```sql
CREATE TABLE scripture_step_states (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES scripture_sessions(id) ON DELETE CASCADE NOT NULL,
  step_index INT NOT NULL,
  user1_locked_at TIMESTAMPTZ,
  user2_locked_at TIMESTAMPTZ,
  advanced_at TIMESTAMPTZ,
  UNIQUE (session_id, step_index)
);
```

**scripture_sessions relevant columns (existing + from Story 4.1):**
```sql
current_step_index INT NOT NULL DEFAULT 0,
current_phase TEXT NOT NULL DEFAULT 'lobby',
version INT NOT NULL DEFAULT 0,
snapshot_json JSONB,
user1_id UUID,
user2_id UUID,
user1_role scripture_session_role,
user2_role scripture_session_role
```

**New migration: 20260222000001_scripture_lock_in.sql**
Creates:
- `scripture_lock_in` RPC
- `scripture_undo_lock_in` RPC
- RLS policies for `realtime.messages` on `scripture-presence:%` topic

### Slice State Shape (Story 4.2 Additions)

```typescript
// Add to ScriptureReadingState:
partnerLocked: boolean;      // Partner has pending lock-in on current step

// Already in state (Story 4.1):
isPendingLockIn: boolean;    // This user's pending lock-in state (ALREADY EXISTS)

// New actions to add to ScriptureSlice:
lockIn: () => Promise<void>;
undoLockIn: () => Promise<void>;
onPartnerLockInChanged: (locked: boolean) => void;
```

### Component Structure (Story 4.2 scope)

```
src/components/scripture-reading/
├── containers/
│   ├── ScriptureOverview.tsx  ← MODIFY: add ReadingContainer route + move useScriptureBroadcast here
│   ├── LobbyContainer.tsx     ← MODIFY: remove useScriptureBroadcast call (moved to ScriptureOverview)
│   ├── ReadingContainer.tsx   ← CREATE: together-mode reading orchestrator
│   └── SoloReadingFlow.tsx    ← no changes
├── session/
│   ├── Countdown.tsx          ← no changes
│   └── LockInButton.tsx       ← CREATE: lock-in button (presentational)
└── reading/
    ├── BookmarkFlag.tsx        ← no changes
    ├── RoleIndicator.tsx       ← CREATE: role pill badge
    └── PartnerPosition.tsx     ← CREATE: partner presence display

src/hooks/
├── useScriptureBroadcast.ts   ← MODIFY: add lock_in_status_changed listener
├── useScripturePresence.ts    ← CREATE: presence channel lifecycle
└── index.ts                   ← MODIFY: export useScripturePresence

src/stores/slices/
└── scriptureReadingSlice.ts   ← MODIFY: add partnerLocked state, lockIn/undoLockIn/onPartnerLockInChanged actions
```

### Testing Requirements

**Test IDs:**
- `reading-container` — ReadingContainer root
- `reading-step-progress` — "Verse X of 17"
- `reading-verse-text` — verse text
- `reading-response-text` — response text
- `reading-tab-verse` — verse tab/button
- `reading-tab-response` — response tab/button
- `role-indicator` — role pill badge
- `lock-in-button` — "Ready for next verse" / "Waiting..." button
- `lock-in-undo` — "Tap to undo" link
- `partner-locked-indicator` — "[PartnerName] is ready" indicator
- `partner-position` — partner view location
- `session-update-toast` — "Session updated" toast

**Co-location pattern (from Story 4.1):**
- Component unit tests: `src/components/scripture-reading/__tests__/`
- Service/hook unit tests: `tests/unit/` mirroring src structure

**E2E test patterns (from Story 4.1):**
- Import `{ test, expect }` from `tests/support/merged-fixtures`
- Use `scripture-lobby.ts` helpers for session setup
- Use worker-isolated auth (worker-{n}.json + worker-{n}-partner.json)
- Use `page` and `partnerPage` for dual-browser flows

### Entry Criteria (Before Starting)

- [ ] `supabase start` — local Supabase running
- [ ] Apply Story 4.1 migrations if not already: `supabase db reset` or `supabase migration apply`
- [ ] Story 4.1 E2E tests passing: `npx playwright test tests/e2e/scripture/scripture-lobby-4.1.spec.ts --project=api`
- [ ] Unit tests passing: `npm run test:unit`

### Exit Criteria (Before Review)

- [ ] All unit tests pass: `npm run test:unit`
- [ ] pgTAP tests pass: `npm run test:db` (all 6 `4.2-DB-*` tests pass)
- [ ] E2E-001 passes: full lock-in flow end-to-end
- [ ] TypeScript: `npm run typecheck` clean
- [ ] ESLint: `npm run lint` clean
- [ ] No empty catch blocks — all errors via `handleScriptureError()`
- [ ] `useScripturePresence` cleanup verified — no memory leaks (interval cleared, channel removed)
- [ ] `useScriptureBroadcast` moved to `ScriptureOverview` — verify no duplicate subscription
- [ ] `project-structure-boundaries.md` updated: add `ReadingContainer.tsx`, `LockInButton.tsx`, `RoleIndicator.tsx`, `PartnerPosition.tsx`, `useScripturePresence.ts`

### Cross-Story Context

- **Stories 1-3** — provides: DB tables, service layer, slice, IndexedDB, `SoloReadingFlow`, reflection system
- **Story 4.1** — adds: role selection, lobby, ready state, countdown, `LobbyContainer`, `useScriptureBroadcast`, `Countdown.tsx`; leaves session in `currentPhase = 'reading'` after countdown completes
- **Story 4.2 (this story)** — adds: lock-in reading, role alternation, `ReadingContainer`, `LockInButton`, `RoleIndicator`, `PartnerPosition`, `useScripturePresence`; leaves session in `currentPhase = 'reflection'` after step 17 lock-in
- **Story 4.3** — extends: `useScripturePresence` heartbeat TTL for reconnection detection; adds `useNetworkStatus` to `ReadingContainer` for offline lock-in blocking; adds `LockInButton` disabled state when partner disconnected

### Project Structure Notes

- `ReadingContainer.tsx` in `containers/` — connects to Zustand store, orchestrates presence and reading lifecycle
- `LockInButton.tsx` in `session/` — presentational, receives props (matches architecture Decision 5)
- `RoleIndicator.tsx` and `PartnerPosition.tsx` in `reading/` — presentational reading-phase UI (matches architecture)
- `useScripturePresence.ts` in `hooks/` — matches `useScriptureBroadcast.ts` pattern
- `project-structure-boundaries.md` update is **exit criterion** (per Epic 3 retro rule)

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-4-together-mode-synchronized-reading.md#Story 4.2]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 2 (Real-Time Sync), Decision 3 (State Machine)]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Broadcast Event Naming, Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Together Mode FR14-29]
- [Source: _bmad-output/implementation-artifacts/4-1-lobby-role-selection-and-countdown.md#Dev Notes, Architecture Constraints, Broadcast Event Payloads]
- [Source: .claude/rules/use-realtime.md — private channels, database triggers (realtime.send), cleanup patterns]
- [Source: supabase/migrations/20260128000001_scripture_reading.sql — scripture_step_states table structure]
- [Source: supabase/migrations/20260220000001_scripture_lobby_and_roles.sql — existing realtime.messages RLS pattern]
- [Source: src/stores/slices/scriptureReadingSlice.ts — callLobbyRpc helper, StateUpdatePayload, isPendingLockIn]
- [Source: src/hooks/useScriptureBroadcast.ts — channel lifecycle, useShallow pattern, error routing]
- [Source: src/components/scripture-reading/containers/LobbyContainer.tsx — container/presentational pattern]
- [Source: src/components/scripture-reading/containers/SoloReadingFlow.tsx — AnimatePresence, step rendering pattern]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
