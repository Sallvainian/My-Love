# Scripture Reading Slice

**File:** `src/stores/slices/scriptureReadingSlice.ts` (~1035 lines)
**Interface:** `ScriptureSlice`

## Purpose

The largest and most complex slice. Manages the full scripture reading feature: session lifecycle (create, resume, save, complete, abandon), solo and together reading modes, lobby/countdown orchestration, lock-in mechanics for synchronized reading, partner disconnection handling, broadcast function wiring, and couple stats.

## State -- Session Core

| Field               | Type                        | Default | Persisted | Description                            |
| ------------------- | --------------------------- | ------- | --------- | -------------------------------------- |
| `session`           | `ScriptureSession \| null`  | `null`  | No        | Active reading session                 |
| `scriptureLoading`  | `boolean`                   | `false` | No        | Loading state for scripture operations |
| `scriptureError`    | `ScriptureError \| null`    | `null`  | No        | Error with message and optional code   |
| `activeSession`     | `ActiveSessionInfo \| null` | `null`  | No        | Incomplete session for resume prompt   |
| `isCheckingSession` | `boolean`                   | `false` | No        | Whether checking for active session    |

## State -- Together Mode / Lobby

| Field                | Type                  | Default | Persisted | Description                              |
| -------------------- | --------------------- | ------- | --------- | ---------------------------------------- |
| `myRole`             | `SessionRole \| null` | `null`  | No        | User's role: `'reader'` or `'responder'` |
| `partnerJoined`      | `boolean`             | `false` | No        | Whether partner has joined the lobby     |
| `myReady`            | `boolean`             | `false` | No        | Whether user has toggled ready           |
| `partnerReady`       | `boolean`             | `false` | No        | Whether partner has toggled ready        |
| `countdownStartedAt` | `number \| null`      | `null`  | No        | UTC ms timestamp when countdown began    |

## State -- Lock-In (Together Reading)

| Field             | Type      | Default | Persisted | Description                                 |
| ----------------- | --------- | ------- | --------- | ------------------------------------------- |
| `isPendingLockIn` | `boolean` | `false` | No        | Whether user has locked in for current step |
| `partnerLocked`   | `boolean` | `false` | No        | Whether partner has locked in               |
| `isSyncing`       | `boolean` | `false` | No        | Whether a lock-in/advance RPC is in flight  |

## State -- Disconnection (Together Mode)

| Field                   | Type             | Default | Persisted | Description                       |
| ----------------------- | ---------------- | ------- | --------- | --------------------------------- |
| `partnerDisconnected`   | `boolean`        | `false` | No        | Whether partner has disconnected  |
| `partnerDisconnectedAt` | `number \| null` | `null`  | No        | UTC ms timestamp of disconnection |

## State -- Broadcast

| Field          | Type                        | Default | Persisted | Description                                       |
| -------------- | --------------------------- | ------- | --------- | ------------------------------------------------- |
| `broadcastFn`  | `BroadcastFunction \| null` | `null`  | No        | Function injected by `useScriptureBroadcast` hook |
| `pendingRetry` | `PendingRetry \| null`      | `null`  | No        | Retry state for failed lock-in/advance operations |

## State -- Stats

| Field            | Type                  | Default | Persisted | Description                       |
| ---------------- | --------------------- | ------- | --------- | --------------------------------- |
| `coupleStats`    | `CoupleStats \| null` | `null`  | No        | Aggregate stats from Supabase RPC |
| `isStatsLoading` | `boolean`             | `false` | No        | Loading state for stats           |

## Session Shape

```typescript
interface ScriptureSession {
  id: string;
  mode: 'solo' | 'together';
  status: 'in_progress' | 'complete' | 'abandoned';
  currentStepIndex: number;
  currentPhase: 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
  version: number; // Optimistic concurrency version
  createdAt: string;
}
```

## SessionRole Type

```typescript
type SessionRole = 'reader' | 'responder';
```

## Actions -- Session Lifecycle

| Action                  | Signature                                                           | Description                                 |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| `createSession`         | `(mode: 'solo' \| 'together', partnerId?: string) => Promise<void>` | Creates new session via Supabase RPC        |
| `loadSession`           | `(sessionId: string) => Promise<void>`                              | Loads existing session from Supabase        |
| `saveSession`           | `(stepIndex: number) => Promise<void>`                              | Saves current progress to Supabase          |
| `completeSession`       | `(reflectionData: ReflectionData) => Promise<void>`                 | Marks session complete with reflection      |
| `abandonSession`        | `(sessionId: string) => Promise<void>`                              | Marks session as abandoned                  |
| `endSession`            | `() => Promise<void>`                                               | Ends together-mode session for both users   |
| `exitSession`           | `() => void`                                                        | Clears local session state (no server call) |
| `checkForActiveSession` | `() => Promise<void>`                                               | Checks Supabase for incomplete sessions     |
| `clearActiveSession`    | `() => void`                                                        | Clears activeSession prompt                 |
| `clearScriptureError`   | `() => void`                                                        | Clears error state                          |

## Actions -- Together Mode / Lobby

| Action          | Signature                              | Description                                              |
| --------------- | -------------------------------------- | -------------------------------------------------------- |
| `selectRole`    | `(role: SessionRole) => Promise<void>` | Selects reader/responder role via RPC                    |
| `toggleReady`   | `(ready: boolean) => Promise<void>`    | Toggles ready status, triggers countdown when both ready |
| `convertToSolo` | `() => Promise<void>`                  | Converts together session to solo mode                   |
| `updatePhase`   | `(phase: string) => void`              | Updates session phase locally                            |

## Actions -- Lock-In

| Action       | Signature             | Description                                                     |
| ------------ | --------------------- | --------------------------------------------------------------- |
| `lockIn`     | `() => Promise<void>` | Locks in for current step; advances both if partner also locked |
| `undoLockIn` | `() => Promise<void>` | Undoes lock-in before partner locks                             |

## Actions -- Broadcast

| Action                   | Signature                                 | Description                           |
| ------------------------ | ----------------------------------------- | ------------------------------------- |
| `setBroadcastFn`         | `(fn: BroadcastFunction \| null) => void` | Injects broadcast function from hook  |
| `handleBroadcastMessage` | `(message: BroadcastMessage) => void`     | Processes incoming broadcast messages |

## Actions -- Stats

| Action            | Signature             | Description                            |
| ----------------- | --------------------- | -------------------------------------- |
| `loadCoupleStats` | `() => Promise<void>` | Fetches couple stats from Supabase RPC |

## Actions -- Disconnection

| Action                   | Signature                         | Description                             |
| ------------------------ | --------------------------------- | --------------------------------------- |
| `setPartnerDisconnected` | `(disconnected: boolean) => void` | Sets disconnection state with timestamp |

## Broadcast Architecture

The slice does not import Supabase directly for broadcast. Instead:

1. `useScriptureBroadcast` hook (mounted in ScriptureOverview) creates a Supabase realtime channel
2. The hook injects its `send()` function into the slice via `setBroadcastFn()`
3. Actions like `lockIn()`, `toggleReady()`, `selectRole()` call `broadcastFn()` to notify the partner
4. Incoming messages are routed through `handleBroadcastMessage()` which updates lobby state, lock-in state, etc.

This decouples the slice from Supabase and allows the broadcast channel to persist across phase transitions (lobby -> countdown -> reading) without unmounting.

### Broadcast Nuke Condition

When `onBroadcastReceived` processes incoming state updates, it resets all local session state (`resetSessionState`) **only** when `payload.triggered_by === 'end_session'`. This is the sole trigger for the broadcast nuke — session completion (`markSessionComplete`) uses a direct DB update rather than broadcast, so a `currentPhase === 'complete'` broadcast does not cause a reset.

## Optimistic Concurrency

Sessions have a `version` field. Lock-in RPCs include the expected version. On 409 conflict (version mismatch), the slice reloads the session and shows a "Session updated" toast.

## Together Mode Phase Flow

```
ScriptureOverview (creates session)
  -> LobbyContainer (role selection -> lobby waiting -> countdown)
    -> ReadingContainer (verse/response tabs + lock-in)
      -> SoloReadingFlow (reflection + report) [reused for both solo and together post-reading]
```

## Cross-Slice Dependencies

- **Reads:** `AuthSlice` (via `get().userId` in `loadSession`, `selectRole`, `onBroadcastReceived` for user identity)
- The ScriptureOverview container additionally reads `partner` from PartnerSlice and `setView` from NavigationSlice, but those are component-level, not slice-level dependencies.
