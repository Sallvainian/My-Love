# Story 4.1: Lobby, Role Selection & Countdown

Status: review

## Story

As a user,
I want to select my role, enter a lobby, ready up with my partner, and experience a synchronized countdown,
So that we begin reading together with shared anticipation.

## Acceptance Criteria

**Given** the user selects Together mode
**When** the mode selection completes
**Then** a role selection screen appears with "Reader" and "Responder" options
**And** role descriptions are clear: "You read the verse" / "You read the response"
**And** the selected role is stored on the scripture_session (user1_id with role)

**Given** the user has selected a role
**When** they enter the lobby
**Then** the lobby screen shows "Waiting for [Partner Name]..." with a gentle animation
**And** a "Continue solo" option is available (no-shame language, tertiary button)
**And** a Supabase Broadcast channel is joined: scripture-session:{session_id}

**Given** both partners are in the lobby
**When** each partner can see the other's join status
**Then** partner presence is shown ("Jordan has joined")
**And** each user sees a "Ready" toggle button
**And** ready state changes are broadcast in real-time

**Given** a user toggles Ready
**When** their ready state changes
**Then** the broadcast sends the ready state to the partner
**And** the button updates: "I'm Ready" (primary) when not ready, "Ready ✓" (secondary) when ready
**And** the partner sees the updated state immediately
**And** ready state is announced via aria-live="polite": "[Partner Name] is ready"

**Given** both users are Ready
**When** the server detects both ready states
**Then** a 3-second countdown begins (server-authoritative timestamp for sync)
**And** the countdown shows 3...2...1 with scale/fade animation
**And** reduced-motion users see static number display (no animation)
**And** screen reader announces: "Session starting in 3 seconds" at start, "Session started" at end
**And** countdown container receives focus
**And** after countdown, the first verse loads for both partners simultaneously

**Given** the user is in the lobby and partner has not joined
**When** they tap "Continue solo"
**Then** the session converts to solo mode smoothly (no shame messaging)
**And** the session mode updates to 'solo' on the server
**And** the broadcast channel is cleaned up

## Tasks / Subtasks

- [x] Task 1: DB Migration — role & lobby columns (AC: #1, #2, #3, #4, #5)
  - [x] 1.1 Create `scripture_session_role` ENUM type: `('reader', 'responder')`
  - [x] 1.2 Add `user1_role scripture_session_role` and `user2_role scripture_session_role` columns to `scripture_sessions` (nullable, set on role selection)
  - [x] 1.3 Add `user1_ready BOOLEAN NOT NULL DEFAULT false` and `user2_ready BOOLEAN NOT NULL DEFAULT false` columns to `scripture_sessions`
  - [x] 1.4 Add `countdown_started_at TIMESTAMPTZ` column to `scripture_sessions` (set when both ready, drives client countdown)
  - [x] 1.5 Apply RLS policies for `realtime.messages` SELECT + INSERT to allow session members to use the private broadcast channel `scripture-session:{session_id}`
- [x] Task 2: Supabase RPCs (AC: #1, #2, #4, #5)
  - [x] 2.1 `scripture_select_role(p_session_id UUID, p_role TEXT)` — stores caller's role on session (`user1_role` or `user2_role` based on `auth.uid() = user1_id`), returns updated session snapshot; bumps version, broadcasts `state_updated`
  - [x] 2.2 `scripture_toggle_ready(p_session_id UUID, p_is_ready BOOLEAN)` — idempotently sets caller's ready flag; if both ready, sets `countdown_started_at = now()`, phase = 'countdown', bumps version, broadcasts `state_updated`; returns updated snapshot
  - [x] 2.3 `scripture_convert_to_solo(p_session_id UUID)` — sets `mode = 'solo'`, clears `user2_id`, `user1_ready`, `user2_ready`, `countdown_started_at`, phase = 'reading', status = 'in_progress'; bumps version; broadcasts `session_converted`
  - [x] 2.4 All RPCs: `SECURITY INVOKER`, `set search_path = ''`, fully qualified table names, grant EXECUTE to `authenticated`
- [x] Task 3: Extend `scriptureReadingSlice.ts` (AC: all)
  - [x] 3.1 Add state fields to `ScriptureReadingState`: `myRole: SessionRole | null`, `partnerJoined: boolean`, `myReady: boolean`, `partnerReady: boolean`, `countdownStartedAt: number | null`
  - [x] 3.2 Add slice actions: `selectRole(role: SessionRole)`, `toggleReady(isReady: boolean)`, `convertToSolo()`, `onPartnerJoined()`, `onPartnerReady(isReady: boolean)`, `onCountdownStarted(startTs: number)`
  - [x] 3.3 `selectRole`: calls `scripture_select_role` RPC, updates local `myRole`, updates `session.currentPhase = 'lobby'`
  - [x] 3.4 `toggleReady`: calls `scripture_toggle_ready` RPC, sets `myReady` optimistically, rolls back on error
  - [x] 3.5 `convertToSolo`: calls `scripture_convert_to_solo` RPC, resets lobby state, updates `session.mode = 'solo'` + `session.currentPhase = 'reading'`
  - [x] 3.6 `onBroadcastReceived(payload: StateUpdatePayload)`: version check → update `session`, `partnerReady`, `countdownStartedAt` from snapshot
  - [x] 3.7 Add `SessionRole = 'reader' | 'responder'` export
  - [x] 3.8 Initialize new fields in `initialScriptureState`
- [x] Task 4: Create `useScriptureBroadcast` hook (AC: #2, #3, #4, #5)
  - [x] 4.1 Create `src/hooks/useScriptureBroadcast.ts`
  - [x] 4.2 Takes `sessionId: string | null` — returns nothing (side-effect hook)
  - [x] 4.3 On `sessionId` change to non-null: call `supabase.realtime.setAuth()`, join channel `scripture-session:{sessionId}` with `{ config: { private: true } }`
  - [x] 4.4 On channel SUBSCRIBED: broadcast `partner_joined` event with `{ user_id: currentUserId }`
  - [x] 4.5 Listen for `partner_joined` → call `onPartnerJoined()` slice action
  - [x] 4.6 Listen for `ready_state_changed` → call `onPartnerReady(payload.is_ready)` slice action
  - [x] 4.7 Listen for `state_updated` → call `onBroadcastReceived(payload)` slice action (handles phase, countdown, version)
  - [x] 4.8 Listen for `session_converted` → call `convertToSolo()` slice action (partner chose solo, sync state)
  - [x] 4.9 On cleanup: `supabase.removeChannel(channel)` — guard against duplicate subscriptions with `channelRef.current !== null` check
  - [x] 4.10 Export from `src/hooks/index.ts`
- [x] Task 5: Create `LobbyContainer.tsx` (AC: #1-#5)
  - [x] 5.1 Create `src/components/scripture-reading/containers/LobbyContainer.tsx`
  - [x] 5.2 Calls `useScriptureBroadcast(session?.id ?? null)` — lifecycle managed here
  - [x] 5.3 Phase A — Role Selection (`session.currentPhase === 'lobby' && !myRole`):
    - [x] Two role cards: "Reader" ("You read the verse") and "Responder" ("You read the response") — both purple glass-morphism cards
    - [x] On click: calls `selectRole(role)` — shows loading state during RPC
    - [x] Cards follow `FOCUS_RING` pattern and min 48px touch targets
  - [x] 5.4 Phase B — Lobby Waiting (`myRole` set, phase === 'lobby'):
    - [x] "Waiting for [partner.displayName]..." with `animate-pulse` animation (or "Reading together" header when joined)
    - [x] "[Partner Name] has joined" status when `partnerJoined = true`
    - [x] Ready toggle button: "Ready" (primary purple) / "Not Ready" (secondary) — calls `toggleReady()`
    - [x] Partner ready indicator: "[Partner Name] is ready" (green check) / "[Partner Name] is not ready yet" (muted)
    - [x] `aria-live="polite"` region for partner ready state changes
    - [x] "Continue solo" tertiary button (small, muted, below main content) — calls `convertToSolo()`
  - [x] 5.5 Phase C — Countdown (`countdownStartedAt !== null`):
    - [x] Renders `<Countdown startedAt={countdownStartedAt} onComplete={handleCountdownComplete} />`
    - [x] `handleCountdownComplete`: calls `updatePhase('reading')`
  - [x] 5.6 All text uses Lavender Dreams palette — same `scriptureTheme` tokens from `ScriptureOverview`
- [x] Task 6: Create `Countdown.tsx` (AC: #4)
  - [x] 6.1 Create `src/components/scripture-reading/session/Countdown.tsx`
  - [x] 6.2 Props: `startedAt: number` (server ms timestamp), `onComplete: () => void`
  - [x] 6.3 Derives current tick from `Date.now() - startedAt`, counts from 3 to 0 (inclusive) — 4 ticks, advances every 1000ms
  - [x] 6.4 On mount: focus container div (via `useRef + useEffect`); announce `aria-live="assertive"`: "Session starting in 3 seconds"
  - [x] 6.5 On complete (tick reaches 0): announce "Session started", call `onComplete()`
  - [x] 6.6 With motion: scale/fade each digit transition using `useMotionConfig().crossfade`
  - [x] 6.7 Reduced-motion: static number display, no animation, transitions are instant
  - [x] 6.8 Handles clock skew: if `Date.now() - startedAt >= 3000` on mount, call `onComplete()` immediately
- [x] Task 7: Update `ScriptureOverview.tsx` routing (AC: #1)
  - [x] 7.1 Add routing condition after the solo session check
  - [x] 7.2 Import `LobbyContainer` from containers
- [x] Task 8: Update `dbSchema.ts` types (AC: #1)
  - [x] 8.1 Add `export type ScriptureSessionRole = 'reader' | 'responder'`
  - [x] 8.2 Add `myRole?: ScriptureSessionRole`, `partnerRole?: ScriptureSessionRole` to `ScriptureSession` interface
  - [x] 8.3 Add `user1Ready?: boolean`, `user2Ready?: boolean`, `countdownStartedAt?: Date` to `ScriptureSession` interface
- [x] Task 9: pgTAP database tests (AC: #1, #2, #4)
  - [x] 9.1 `4.1-DB-001`: Role assignment — user1 selects 'reader', `user1_role` persisted, `user2_role` remains null
  - [x] 9.2 `4.1-DB-002`: Ready state — user1 ready + user2 ready → `countdown_started_at` is set, phase = 'countdown'
  - [x] 9.3 `4.1-DB-003`: Ready state partial — only user1 ready → `countdown_started_at` remains null
  - [x] 9.4 `4.1-DB-004`: RLS security — user cannot set partner's ready state or role (must be their own)
- [x] Task 10: Unit tests (AC: all)
  - [x] 10.1 `LobbyContainer.test.tsx` — role selection renders, role card click calls selectRole, lobby phase shows partner name, ready toggle calls toggleReady, partner joined updates aria-live, continue solo calls convertToSolo, countdown renders when countdownStartedAt set
  - [x] 10.2 `Countdown.test.tsx` — counts 3→2→1, aria announcement on mount, aria on complete, calls onComplete when done, reduced-motion no animation, handles late start (clock skew)
  - [x] 10.3 `useScriptureBroadcast.test.ts` — channel joined on sessionId, setAuth called before subscribe, partner_joined fires action, cleanup removes channel, no duplicate subscribe
  - [x] 10.4 `scriptureReadingSlice.lobby.test.ts` — initial lobby state all null/false, selectRole sets myRole, toggleReady sets myReady, onPartnerJoined sets partnerJoined, onCountdownStarted sets countdownStartedAt, convertToSolo resets lobby state
- [x] Task 11: E2E tests (AC: #1-#5)
  - [x] 11.1 `4.1-E2E-001`: Full lobby flow — user A selects Together → role selection → both select roles → lobby → both ready → countdown → reading starts (first verse visible)
  - [x] 11.2 `4.1-E2E-002`: Continue solo fallback — user A in lobby, no partner → tap "Continue solo" → enters solo reading flow

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Fix partner readiness mapping for user2 clients; `onBroadcastReceived` currently copies `payload.user2Ready` for all clients, so user2 can see their own state as partner state. [src/stores/slices/scriptureReadingSlice.ts:675]
- [x] [AI-Review][HIGH] Handle `session_converted` as a local transition on broadcast; current handler re-invokes `scripture_convert_to_solo`, which can fail for the removed partner after `user2_id` is nulled. [src/hooks/useScriptureBroadcast.ts:93]
- [x] [AI-Review][MEDIUM] Send `partner_joined` payload with `user_id`; current payload is `{}` and does not satisfy the declared event contract. [src/hooks/useScriptureBroadcast.ts:107]
- [x] [AI-Review][HIGH] Extend DB-004 to assert non-members cannot call `scripture_toggle_ready`, not just `scripture_select_role`. [supabase/tests/database/10_scripture_lobby.sql:205]
- [x] [AI-Review][MEDIUM] Strengthen E2E ready assertions to verify semantic text (`is ready`) rather than visibility only, so partner-ready regressions are caught. [tests/e2e/scripture/scripture-lobby-4.1.spec.ts:144]
- [x] [AI-Review][LOW] Align ready-toggle copy with story contract (`Ready` / `Not Ready`) or update the contract to match implemented copy (`I'm Ready` / `Ready ✓`). [src/components/scripture-reading/containers/LobbyContainer.tsx:231]
- [x] [AI-Review][HIGH] Add lobby-phase guards to `scripture_select_role`; current implementation can set `current_phase = 'lobby'` from any phase and rewind active sessions. [supabase/migrations/20260220000001_scripture_lobby_and_roles.sql:148]
- [x] [AI-Review][HIGH] Add lobby-phase guards to `scripture_toggle_ready` and `scripture_convert_to_solo`; both mutate lobby state without enforcing lobby phase, allowing out-of-phase countdown/conversion. [supabase/migrations/20260220000001_scripture_lobby_and_roles.sql:232]
- [x] [AI-Review][HIGH] Reconcile `myReady`/`myRole` from authoritative snapshots; `onBroadcastReceived` updates `partnerReady` but not self-ready/role, so UI can drift after reconnect/reload. [src/stores/slices/scriptureReadingSlice.ts:680]
- [x] [AI-Review][MEDIUM] Route broadcast auth/subscription failures through `handleScriptureError(SYNC_FAILED)`; current hook logs only in dev and has no catch around `setAuth/getUser`. [src/hooks/useScriptureBroadcast.ts:105]
- [x] [AI-Review][MEDIUM] Tighten E2E self-ready assertion; `/ready.*✓|ready/i` matches `"I'm Ready"` and can pass before the state transition. [tests/e2e/scripture/scripture-lobby-4.1.spec.ts:141]
- [x] [AI-Review][MEDIUM] Enforce errors in partner link factories; `linkTestPartners`/`unlinkTestPartners` currently ignore Supabase update errors despite docs promising throws. [tests/support/factories/index.ts:105]
- [x] [AI-Review][HIGH] E2E test 4.1-E2E-001 asserts `scripture-verse-text` visibility after countdown but no together-mode reading route exists in Story 4.1 scope; assertion will timeout. Replace with countdown-completion assertion. [tests/e2e/scripture/scripture-lobby-4.1.spec.ts:174]
- [x] [AI-Review][MEDIUM] 4 files changed on branch missing from story File List: `fix_function_search_paths.sql`, P2 E2E spec, API spec, E2E helper. [story File List]

## Dev Notes

### What Already Exists — DO NOT Recreate

| Component/File | What It Does | Location |
|---|---|---|
| `ScriptureOverview.tsx` | Mode selection, start button, partner detection, solo resume | `src/components/scripture-reading/containers/ScriptureOverview.tsx` |
| `SoloReadingFlow.tsx` | Solo reading route — renders when `session.mode === 'solo'` | `src/components/scripture-reading/containers/SoloReadingFlow.tsx` |
| `scriptureReadingSlice.ts` | All existing session state, createSession, loadSession, advanceStep | `src/stores/slices/scriptureReadingSlice.ts` |
| `scriptureReadingService.ts` | IndexedDB + Supabase CRUD for sessions, reflections, bookmarks | `src/services/scriptureReadingService.ts` |
| `scripture_sessions` table | Has `mode`, `current_phase`, `version`, `snapshot_json` — **no role/ready/countdown columns yet** | `supabase/migrations/20260128000001_scripture_reading.sql` |
| `ScriptureSession` type | `{ id, mode, userId, partnerId?, currentPhase, currentStepIndex, status, version }` — **no role fields yet** | `src/services/dbSchema.ts` (line 32) |
| `ScriptureSessionPhase` | `'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete'` — already includes lobby/countdown | `src/services/dbSchema.ts` (line 26) |
| `ScriptureSessionMode` | `'solo' | 'together'` | `src/services/dbSchema.ts` (line 25) |
| `useMotionConfig` hook | Motion presets (fade, spring, slideUp) respecting reduced-motion | `src/hooks/useMotionConfig.ts` |
| `useNetworkStatus` hook | `{ isOnline }` | `src/hooks/useNetworkStatus.ts` |
| `partnerSlice` | `partner: PartnerInfo | null` — has partner display name for lobby UI | `src/stores/slices/partnerSlice.ts` |
| `scriptureTheme` tokens | `{ primary: '#A855F7', background: '#F3E5F5', surface: '#FAF5FF' }` | `ScriptureOverview.tsx` (line 38) — copy or import |
| `FOCUS_RING` constant | `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'` | `ScriptureOverview.tsx` (line 45) — copy or import |
| `ModeCard` component | Purple glass-morphism card pattern — can reference for role selection card styling | `ScriptureOverview.tsx` (line 69) |
| `handleStartTogether` | Already calls `createSession('together', partner.id)` — creates session and sets `session` in slice | `ScriptureOverview.tsx` (line 272) |
| Zustand persist | Auto-persists slice state to localStorage — lobby state fields will also persist | `src/stores/useAppStore.ts` |

### What Does NOT Exist Yet — You Must Create

| File | Purpose |
|---|---|
| `src/hooks/useScriptureBroadcast.ts` | Broadcast channel lifecycle management (subscribe/unsubscribe, event dispatch) |
| `src/components/scripture-reading/containers/LobbyContainer.tsx` | Role selection + lobby waiting + countdown orchestration |
| `src/components/scripture-reading/session/Countdown.tsx` | 3...2...1 countdown UI component |
| DB migration (new file) | Add role/ready/countdown columns to `scripture_sessions`, new RPCs, channel RLS |

### Architecture Constraints

**State Management:**
- Lobby state belongs in `scriptureReadingSlice` — not local component state (must survive component re-renders, must be Zustand-persisted)
- New state fields MUST be added to `ScriptureReadingState` interface and `initialScriptureState`
- Use `useShallow` selectors in `LobbyContainer` for lobby state fields
- Do NOT store `countdownStartedAt` as a `Date` object in Zustand state — store as `number` (ms timestamp) since Zustand persist serializes via JSON (Date objects become strings)
- `myRole` and `partnerJoined` are client-local only — NOT synced to server (except `myRole` via the RPC)

**Broadcast Channel Architecture (from `.claude/rules/use-realtime.md`):**
- Channel name: `scripture-session:{session_id}` — granular, one channel per session
- Set `private: true` on channel config (requires RLS on `realtime.messages`)
- Call `await supabase.realtime.setAuth()` before `.subscribe()`
- Check `channelRef.current?.state === 'subscribed'` before subscribing — prevent React StrictMode double-mount
- Always call `supabase.removeChannel(channel)` on cleanup
- Events must use `snake_case`: `partner_joined`, `ready_state_changed`, `state_updated`, `session_converted`
- Do NOT use `postgres_changes` — use Broadcast only (per realtime rules)

**Broadcast Event Payloads:**
```typescript
// partner_joined — sent when you join the channel
{ type: 'broadcast', event: 'partner_joined', payload: { user_id: string } }

// ready_state_changed — sent when user toggles ready
{ type: 'broadcast', event: 'ready_state_changed', payload: { user_id: string, is_ready: boolean } }

// state_updated — sent by server RPCs (scripture_toggle_ready on both-ready, scripture_select_role)
{ type: 'broadcast', event: 'state_updated', payload: StateUpdatePayload }

// session_converted — sent by scripture_convert_to_solo RPC
{ type: 'broadcast', event: 'session_converted', payload: { mode: 'solo', session_id: string } }
```

**Server-Authoritative Countdown:**
- When both users toggle ready, `scripture_toggle_ready` RPC sets `countdown_started_at = now()`, phase = 'countdown', broadcasts `state_updated` with snapshot including `countdownStartedAt`
- Clients receive `state_updated`, extract `snapshot.countdownStartedAt` (server UTC ms), feed to `<Countdown startedAt={ts} />`
- `<Countdown>` derives current display digit from `Math.max(0, Math.ceil(3 - (Date.now() - startedAt) / 1000))`
- This auto-corrects clock skew: if this client receives the broadcast 0.5s late, countdown still shows correct digit

**Import Discipline (from CLAUDE.md):**
- Do NOT import `supabase` directly in components — use slice actions or dedicated hooks
- `useScriptureBroadcast` is the ONLY place that imports `supabase` for Broadcast
- Data flow: `LobbyContainer` → slice actions → `scriptureReadingService` / Supabase RPCs
- `useScriptureBroadcast` dispatches to slice actions (not directly to components)

**Error Handling:**
- All RPC calls must handle errors via `handleScriptureError()` or re-throw — never empty catch blocks (CLAUDE.md rule)
- `selectRole`, `toggleReady`, `convertToSolo` are write operations — show error state on failure, do NOT silently swallow errors
- Optimistic UI for `myReady` only — roll back if RPC fails
- Channel subscription error → `handleScriptureError({ code: ScriptureErrorCode.SYNC_FAILED, ... })`

**Continue Solo Flow:**
1. User taps "Continue solo"
2. LobbyContainer calls `convertToSolo()` slice action
3. Slice calls `scripture_convert_to_solo(session_id)` RPC → sets mode='solo', clears partner state
4. RPC broadcasts `session_converted` to partner (partner's client should also call convertToSolo or show "partner left" message)
5. Slice updates local state: `session.mode = 'solo'`, `session.currentPhase = 'reading'`, resets lobby state
6. ScriptureOverview re-evaluates: now `session.mode === 'solo'` → routes to `<SoloReadingFlow />`

### DB Schema Changes

**New migration file** (create with current UTC timestamp):
```sql
-- Add role selection and lobby state to scripture_sessions
CREATE TYPE scripture_session_role AS ENUM ('reader', 'responder');

ALTER TABLE public.scripture_sessions
  ADD COLUMN user1_role public.scripture_session_role,
  ADD COLUMN user2_role public.scripture_session_role,
  ADD COLUMN user1_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN user2_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN countdown_started_at TIMESTAMPTZ;

-- RLS for realtime.messages (private broadcast channel access)
-- SELECT: session members can receive messages on their channel
CREATE POLICY "scripture_session_members_can_receive_broadcasts"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    topic LIKE 'scripture-session:%'
    AND SPLIT_PART(topic, ':', 2)::uuid IN (
      SELECT id FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );

-- INSERT: session members can send messages on their channel
CREATE POLICY "scripture_session_members_can_send_broadcasts"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    topic LIKE 'scripture-session:%'
    AND SPLIT_PART(topic, ':', 2)::uuid IN (
      SELECT id FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );
```

**Required index (add to migration):**
```sql
CREATE INDEX idx_scripture_sessions_user2_status
  ON public.scripture_sessions (user2_id, status)
  WHERE user2_id IS NOT NULL;
```

### Slice New State Shape

```typescript
// Add to ScriptureReadingState:
myRole: SessionRole | null;         // This user's selected role
partnerJoined: boolean;             // Partner has joined the broadcast channel
myReady: boolean;                   // This user's ready toggle state (optimistic)
partnerReady: boolean;              // Partner's ready state (from broadcast)
countdownStartedAt: number | null;  // Server UTC ms timestamp — drives Countdown component

// Add to exports:
export type SessionRole = 'reader' | 'responder';
```

### Component Structure (Story 4.1 scope only)

```
src/components/scripture-reading/
├── containers/
│   ├── ScriptureOverview.tsx     ← MODIFY: add LobbyContainer routing
│   ├── LobbyContainer.tsx        ← CREATE: role selection + lobby + countdown orchestration
│   └── SoloReadingFlow.tsx       ← no changes
├── session/
│   └── Countdown.tsx             ← CREATE: 3...2...1 countdown component
└── index.ts                      ← MODIFY: export LobbyContainer, Countdown

src/hooks/
├── useScriptureBroadcast.ts      ← CREATE: broadcast channel lifecycle
└── index.ts                      ← MODIFY: export useScriptureBroadcast

src/stores/slices/
└── scriptureReadingSlice.ts      ← MODIFY: add lobby state + actions

src/services/
└── dbSchema.ts                   ← MODIFY: add ScriptureSessionRole type, update ScriptureSession interface
```

### UX / Design Requirements

**Role Selection Screen:**
- Header: "How would you like to participate?" (Playfair Display, `text-purple-900`)
- Two glass-morphism cards side by side (or stacked on mobile):
  - **Reader**: Icon (BookOpen), "Reader", "You read the verse" — secondary card style
  - **Responder**: Icon (MessageCircle or Mic2), "Responder", "You read the response" — secondary card style
- Both cards disabled during `isLoading` (after tap)
- Same card styling as `ModeCard` in ScriptureOverview: `bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl`

**Lobby Waiting Screen:**
- Header: "Reading Together" (Playfair Display serif)
- Partner status line: Animated pulse dot + "Waiting for [Partner Name]..." when partner not joined
- Partner status line: Green check + "[Partner Name] has joined!" when `partnerJoined = true`
- Ready section:
  - "I'm Ready" button (primary purple, large) when `myReady = false`
  - "Ready ✓" button (secondary) + "Tap to undo" text when `myReady = true`
  - Partner indicator: "[Partner Name] is ready" with green check, or "[Partner Name]..." (muted) when not ready
  - "We'll continue when you're both ready" — shown when `myReady = true && !partnerReady`
- "Continue solo" link button: small, muted text (`text-purple-400 text-sm`), centered, below all content
- `aria-live="polite"` region wrapping partner status + ready indicator

**Countdown Screen:**
- Full-screen overlay over lobby (or replaces lobby)
- Large number centered: `text-8xl font-bold text-purple-700` (3, 2, 1)
- Framer Motion: each digit exit with `scale: 0.5, opacity: 0`, enter with `scale: 1, opacity: 1`
- `useMotionConfig().fade` for transition timing (respects reduced-motion)
- Reduced-motion: just swap numbers instantly, no scale/fade
- `aria-live="assertive"` on first render: "Session starting in 3 seconds"
- Container `tabIndex={-1}` + `ref` + `useEffect(() => ref.current?.focus())` for keyboard focus

### Testing Requirements

**Unit Test IDs:**
- `lobby-role-selection` — role selection screen root
- `lobby-role-reader` — Reader card button
- `lobby-role-responder` — Responder card button
- `lobby-waiting` — lobby waiting screen root
- `lobby-partner-status` — partner joined/waiting indicator
- `lobby-ready-button` — Ready toggle button
- `lobby-partner-ready` — partner ready indicator
- `lobby-continue-solo` — "Continue solo" button
- `countdown-container` — countdown root (focusable)
- `countdown-digit` — the displayed digit

**Test Patterns from Story 3.1 to Follow:**
- Import `{ test, expect }` from `tests/support/merged-fixtures` for E2E tests
- `useShallow` selector for all Zustand state access in components
- Co-locate component unit tests in `src/components/scripture-reading/__tests__/`
- Service/hook unit tests in `tests/unit/` mirroring src structure
- Mock Supabase in unit tests: mock `supabase.channel()`, `supabase.realtime.setAuth()`
- React StrictMode double-mount: test that channel is NOT subscribed twice

**pgTAP Test File:** `supabase/tests/database/10_scripture_lobby.sql`

### Entry Criteria (Before Starting)

- [ ] `supabase start` — local Supabase running
- [ ] Apply new migration: `supabase db reset` or `supabase migration apply`
- [ ] Epic 1-3 E2E tests passing (no regressions): `npm run test:e2e`
- [ ] Unit tests passing: `npm run test:unit`

### Exit Criteria (Before Review)

- [ ] All unit tests pass: `npm run test:unit`
- [ ] pgTAP DB-004 (RLS security test) passes — user cannot set partner's ready/role
- [ ] E2E-001 passes: full lobby flow end-to-end
- [ ] TypeScript: `npm run typecheck` clean
- [ ] ESLint: `npm run lint` clean
- [ ] No empty catch blocks — all errors go through `handleScriptureError()`
- [ ] `useScriptureBroadcast` cleanup verified — no memory leaks on unmount

### Cross-Story Context

- **Epic 1-3** — provides: DB tables, service layer, slice, IndexedDB schema, ScriptureOverview, SoloReadingFlow, reflection system, stats
- **Story 4.1 (this story)** — adds: role selection, lobby, ready state, countdown; leaves session in `currentPhase = 'reading'` when countdown ends
- **Story 4.2** — picks up: `LockInButton`, `RoleIndicator`, `PartnerPosition` components; reading with lock-in; builds on `useScriptureBroadcast` for presence channel
- **Story 4.3** — adds: reconnection handling, graceful degradation; extends `useScriptureBroadcast` with TTL/presence tracking

### Project Structure Notes

- `LobbyContainer.tsx` goes in `containers/` — it connects to Zustand store and orchestrates broadcast lifecycle
- `Countdown.tsx` goes in `session/` — it is a presentational component receiving props; matches the `Countdown.tsx` path defined in architecture Decision 5
- No new IndexedDB stores needed — lobby state ephemeral or already in `scripture-sessions` via `snapshot_json`
- No `DB_VERSION` bump — only adding Supabase columns and RPCs, no IndexedDB schema changes
- Update `_bmad-output/planning-artifacts/architecture/project-structure-boundaries.md` as dev-story exit criterion: add `LobbyContainer.tsx` and `Countdown.tsx` to the file list under FR14-29 (Together Mode)

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-4-together-mode-synchronized-reading.md#Story 4.1]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 2 (Real-Time Sync), Decision 3 (State Machine), Decision 5 (Component Architecture)]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Broadcast Event Naming, Communication Patterns, Process Patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Together Mode FR14-29]
- [Source: .claude/rules/use-realtime.md — private channels, naming conventions, cleanup patterns]
- [Source: supabase/migrations/20260128000001_scripture_reading.sql — existing scripture_sessions table structure]
- [Source: src/stores/slices/scriptureReadingSlice.ts — existing slice state, error handling patterns]
- [Source: src/services/dbSchema.ts — ScriptureSession interface, ScriptureSessionPhase type]
- [Source: src/components/scripture-reading/containers/ScriptureOverview.tsx — routing pattern, scriptureTheme, FOCUS_RING]
- [Source: _bmad-output/implementation-artifacts/3-1-couple-aggregate-stats-dashboard.md#Dev Notes — patterns to follow]

## Senior Developer Review (AI)

### Reviewer

Sallvain (Codex GPT-5)

### Date

2026-02-21

### Outcome

Changes Requested

### Summary

- Issues found: 3 High, 2 Medium, 1 Low
- Git vs Story discrepancies (source scope): 5 files changed but not in File List; 17 files in File List with no current working-tree diff (likely already committed)
- Unit verification run: `npx vitest run tests/unit/hooks/useScriptureBroadcast.test.ts tests/unit/stores/scriptureReadingSlice.lobby.test.ts src/components/scripture-reading/__tests__/LobbyContainer.test.tsx` (34/34 tests passed)

### Acceptance Criteria Validation

- AC1: IMPLEMENTED
- AC2: IMPLEMENTED
- AC3: PARTIAL (partner-ready synchronization is incorrect for user2 path)
- AC4: PARTIAL (same root cause as AC3)
- AC5: IMPLEMENTED
- AC6: PARTIAL (broadcasted `session_converted` handling can fail for partner client)

### Follow-up Review (AI) — 2026-02-21

- Reviewer: Sallvain (Codex GPT-5)
- Outcome: Changes Requested
- Issues found: 3 High, 3 Medium, 0 Low
- Git vs Story discrepancies (current working tree): 0 files changed in git; 19 files listed in story File List with no current uncommitted diff
- Workflow action path executed: create action items (no auto-fixes applied)

#### Follow-up AC Validation

- AC1: IMPLEMENTED
- AC2: IMPLEMENTED
- AC3: IMPLEMENTED
- AC4: PARTIAL (self-ready state can drift because authoritative snapshots are not reconciling `myReady`)
- AC5: IMPLEMENTED
- AC6: PARTIAL (server RPC allows conversion outside lobby phase)

### Review Round 3 (AI) — 2026-02-21

- Reviewer: Sallvain (Claude Opus 4.6)
- Outcome: Changes Requested (2 items — 1 test bug, 1 doc gap)
- Initial findings: 3 High, 2 Medium, 2 Low
- After validation: 1 High (real), 1 Medium (real), 5 non-issues
- Non-issues breakdown: 2 scope boundaries (server phase stale, partnerJoined), 1 hallucinated risk (null data guard), 2 design choices (polling interval, documented tech debt)

#### Round 3 AC Validation

- AC1: IMPLEMENTED
- AC2: IMPLEMENTED
- AC3: IMPLEMENTED
- AC4: IMPLEMENTED
- AC5: IMPLEMENTED (countdown works; together-mode reading route is Story 4.2 scope)
- AC6: IMPLEMENTED

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6, claude-opus-4-6

### Debug Log References

### Completion Notes List

- ✅ Resolved round 3 review findings (2026-02-21): Replaced unreachable E2E verse assertion (`scripture-verse-text` only exists in SoloReadingFlow; together-mode reading route is Story 4.2 scope) with countdown-completion assertion (`countdown-container` not visible after countdown ends). Added 4 missing files to File List (fix_function_search_paths.sql, P2 E2E spec, API spec, E2E helper). 5 of 7 initial review findings were non-issues: server phase stale (intentional scope boundary — Story 4.2 handles), callLobbyRpc null guard (RPCs always return non-null jsonb), partnerJoined reconciliation (ephemeral signal — Story 4.3 presence), countdown polling (design choice), stale types (documented tech debt).
- ✅ Resolved TEA review findings (2026-02-21): Added `partnerStorageStatePath` fixture (auth-setup.ts generates worker-{n}-partner.json; worker-auth.ts exposes fixture); removed dead `authenticateSecondaryContext` function; replaced all 4 `.catch(() => null)` with error-throwing handlers; removed racy countdown-digit assertion (replaced with `Promise.all` container visible + verse visible); added `unlinkTestPartners` to finally block; narrowed `waitForResponse` to `scripture_toggle_ready` endpoint; extracted shared predicate; added timeout constants; removed stale RED PHASE header; added `unlinkTestPartners` to factories.
- ✅ Resolved AI code review findings round 2 (2026-02-21): Added lobby-phase guards to all 3 RPCs via new migration (scripture_select_role, scripture_toggle_ready, scripture_convert_to_solo — each raises if phase != 'lobby'); reconciled myReady/myRole in onBroadcastReceived from authoritative snapshots (prevents UI drift after reconnect/reload); routed broadcast auth/subscription failures through handleScriptureError(SYNC_FAILED) with try/catch wrapping setAuth chain; tightened E2E self-ready assertion to 'Ready ✓' (eliminates false-positive on "I'm Ready"); enforced errors in linkTestPartners/unlinkTestPartners factories; fixed pre-existing type errors in createTestSession. Added 3 new pgTAP phase-guard tests (plan 7→10), 7 new slice unit tests (myReady/myRole reconciliation), 3 new hook unit tests (error routing). 690 unit tests pass, 0 lint errors, 0 type errors.
- ✅ Resolved AI code review findings (2026-02-21): Fixed partner readiness mapping (currentUserId in slice, isUser1 comparison in onBroadcastReceived); added applySessionConverted local transition replacing convertToSolo RPC call on session_converted broadcast; fixed partner_joined payload to include user_id; extended DB-004 pgTAP test to also assert scripture_toggle_ready non-member access; strengthened E2E ready assertion to verify semantic text "is ready"; aligned story AC ready-toggle copy with implementation ("I'm Ready" / "Ready ✓"). 683 unit tests pass, 0 lint errors.
- Implemented all 11 tasks in a single session (2026-02-20).
- Tasks 1 & 2 combined in one migration file `20260220000001_scripture_lobby_and_roles.sql`: ENUM, ALTER TABLE (role/ready/countdown columns), realtime.messages RLS (SELECT+INSERT), and three RPCs (scripture_select_role, scripture_toggle_ready, scripture_convert_to_solo).
- All RPCs use SECURITY INVOKER, set search_path = '', fully qualified table names, grant EXECUTE to authenticated.
- `callLobbyRpc` helper added to slice to handle pre-migration types (RPCs not yet in database.types.ts); comment marks it for removal after `supabase gen types typescript --local` is run post-migration.
- Channel state guard: used `channelRef.current !== null` instead of `=== 'subscribed'` due to Supabase CHANNEL_STATES type not including 'subscribed' string literal.
- Countdown `onComplete` used directly in effect deps (with `useCallback` stability from caller) instead of ref pattern to avoid `react-hooks/refs` lint error.
- 678 unit tests pass (41 test files), 0 lint errors.
- E2E tests enabled (test.skip removed); require local Supabase + migration applied to run.
- pgTAP tests written with 6 real assertions (plan(6)); DB-004 verifies non-member throws on RPC call.
- project-structure-boundaries.md update: LobbyContainer.tsx (containers/), Countdown.tsx (session/) — required per exit criterion.

### File List

- supabase/migrations/20260221211137_scripture_lobby_phase_guards.sql (new — phase guards for all 3 lobby RPCs)
- tests/support/auth-setup.ts (modified — generates worker-{n}-partner.json auth states)
- tests/support/fixtures/worker-auth.ts (modified — exposes partnerStorageStatePath fixture)
- tests/support/factories/index.ts (modified — adds unlinkTestPartners function)
- tests/e2e/scripture/scripture-lobby-4.1.spec.ts (modified — TEA review quality fixes)
- supabase/migrations/20260220000001_scripture_lobby_and_roles.sql (new)
- src/stores/slices/scriptureReadingSlice.ts (modified)
- src/services/dbSchema.ts (modified)
- src/components/scripture-reading/containers/LobbyContainer.tsx (new)
- src/components/scripture-reading/containers/ScriptureOverview.tsx (modified)
- src/components/scripture-reading/session/Countdown.tsx (new)
- src/components/scripture-reading/index.ts (modified)
- src/hooks/useScriptureBroadcast.ts (new)
- src/hooks/index.ts (modified)
- supabase/tests/database/10_scripture_lobby.sql (modified — converted from skip stubs to active assertions)
- src/components/scripture-reading/__tests__/LobbyContainer.test.tsx (modified — converted from skip stubs to active tests)
- src/components/scripture-reading/__tests__/Countdown.test.tsx (modified — converted from skip stubs to active tests)
- tests/unit/hooks/useScriptureBroadcast.test.ts (modified — converted from skip stubs to active tests)
- tests/unit/stores/scriptureReadingSlice.lobby.test.ts (modified — converted from skip stubs to active tests)
- tests/e2e/scripture/scripture-lobby-4.1.spec.ts (modified — removed test.skip wrappers; semantic ready assertion)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- src/stores/slices/scriptureReadingSlice.ts (modified — currentUserId state field, fixed onBroadcastReceived partnerReady mapping, added applySessionConverted action)
- src/hooks/useScriptureBroadcast.ts (modified — use applySessionConverted for session_converted, send user_id in partner_joined payload)
- supabase/tests/database/10_scripture_lobby.sql (modified — DB-004b: scripture_toggle_ready non-member assertion)
- tests/unit/hooks/useScriptureBroadcast.test.ts (modified — auth.getUser mock, applySessionConverted mock, payload and session_converted tests)
- tests/unit/stores/scriptureReadingSlice.lobby.test.ts (modified — applySessionConverted test, partnerReady mapping tests for user1/user2)
- supabase/migrations/20260221000001_fix_function_search_paths.sql (new — security fix: lock search_path on SECURITY DEFINER scripture functions)
- tests/e2e/scripture/scripture-lobby-4.1-p2.spec.ts (new — P2 E2E tests for lobby flow)
- tests/api/scripture-lobby-4.1.spec.ts (new — API-level tests for lobby RPCs)
- tests/support/helpers/scripture-lobby.ts (new — shared E2E helpers for lobby tests)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-21 | Addressed round 3 review findings (2 items): replaced unreachable E2E verse assertion with countdown-completion assertion (story 4.2 scope boundary), added 4 missing files to File List. Story re-submitted for review. | claude-opus-4-6 |
| 2026-02-21 | Senior Developer Review Round 3 (AI): 2 real issues found (1 HIGH test bug, 1 MEDIUM doc gap); 5 of 7 original findings determined to be non-issues (scope boundaries or hallucinated risk). | claude-opus-4-6 |
| 2026-02-21 | Addressed all 6 follow-up review findings: phase guards in 3 RPCs (new migration), myReady/myRole snapshot reconciliation, broadcast error routing through handleScriptureError, tightened E2E ready assertion, factory error enforcement. 690 unit tests pass. Story re-submitted for review. | claude-sonnet-4-6 |
| 2026-02-21 | Senior Developer Follow-up Review (AI): created 6 new action items (3 High, 3 Medium), kept story in-progress, and synced sprint status to in-progress. | codex-gpt-5 |
| 2026-02-21 | Addressed all 6 AI code review findings: fixed partnerReady mapping (user1/user2 aware), added applySessionConverted local transition, fixed partner_joined payload, extended DB-004 for toggle_ready, semantic E2E ready assertion, aligned AC copy with UX spec. 683 unit tests pass. Story re-submitted for review. | claude-sonnet-4-6 |
| 2026-02-21 | Senior Developer Review (AI): changes requested; added 6 follow-up action items, set story status to in-progress, and synced sprint status back to in-progress. | codex-gpt-5 |
| 2026-02-21 | TEA review fix-up: added partnerStorageStatePath fixture (auth-setup.ts + worker-auth.ts), added unlinkTestPartners to factories, rewrote E2E spec with error-throwing .catch handlers, removed racy countdown-digit assertion, extracted shared predicate, used Promise.all for dual-page assertions, removed dead authenticateSecondaryContext function. | claude-sonnet-4-6 |
| 2026-02-20 | Implemented all 11 tasks: DB migration (role ENUM, columns, RLS, 3 RPCs), slice lobby state/actions, useScriptureBroadcast hook, LobbyContainer (3 phases), Countdown component, ScriptureOverview routing, dbSchema types, pgTAP tests, unit tests, E2E tests. All 678 unit tests pass. | claude-sonnet-4-6 |
