---
title: 'Epic 4 Hardening — Reconnection Resilience + State Correctness'
slug: 'epic-4-hardening-chunks-2-3'
created: '2026-03-03'
status: 'completed'
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack: ['@supabase/supabase-js ^2.97.0', 'zustand ^5.0.11', 'react ^19.2.4', 'vitest ^4.0.17']
files_to_modify:
  - 'src/hooks/useScriptureBroadcast.ts'
  - 'src/hooks/useScripturePresence.ts'
  - 'src/stores/slices/scriptureReadingSlice.ts'
  - 'src/components/scripture-reading/containers/ReadingContainer.tsx'
code_patterns:
  - 'setRetryCount(c => c + 1) — unbounded, no max cap or backoff (5 call sites across 2 hooks)'
  - 'isPartnerConnected: boolean defaults to true — false positive before first heartbeat'
  - '...initialScriptureState spread — shotgun reset nukes coupleStats, isStatsLoading, isInitialized'
  - 'errorMessage.includes(''409'') — fragile string matching for version mismatch from RAISE EXCEPTION ''409: version mismatch'''
  - 'dual triggeredBy/triggered_by keys in StateUpdatePayload — only triggered_by is ever sent (line 868)'
  - 's.mode === ''solo'' filter at line 307 excludes together-mode from resume prompt'
  - 'retryFailedWrite reads session.currentStepIndex from get() — stale if user advanced between failure and retry'
  - 'useScripturePresence has no CLOSED handler — only CHANNEL_ERROR (line 157)'
  - 'useScripturePresence removeChannel at lines 174, 200 has no .catch() (same bug fixed in broadcast hook by Chunk 1)'
  - 'loadSession has no concurrent-call guard — can fire from broadcast reconnect + presence reconnect simultaneously'
  - 'useRealtimeMessages RETRY_CONFIG pattern (maxRetries: 5, baseDelay: 1000, maxDelay: 30000, exponential backoff) is the reference'
test_patterns:
  - 'vitest + happy-dom with vi.hoisted() + vi.mock() for Supabase mocks'
  - 'zustand slices tested via create() with slice factory'
  - 'hooks tested via renderHook() from @testing-library/react'
  - 'existing test files: scriptureReadingSlice.lockin.test.ts, .reconnect.test.ts, .endSession.test.ts, .authguards.test.ts'
  - 'existing hook tests: useScriptureBroadcast.test.ts, .errorhandling.test.ts, .reconnect.test.ts'
  - 'existing presence tests: useScripturePresence.test.ts, .reconnect.test.ts'
---

# Tech-Spec: Epic 4 Hardening — Reconnection Resilience + State Correctness

**Created:** 2026-03-03

## Overview

### Problem Statement

Epic 4's Together Mode shipped with unbounded reconnection retries (no max cap, no backoff) in both `useScriptureBroadcast` (4 call sites) and `useScripturePresence` (1 call site) — an infinite retry loop under sustained channel failures. State resets use `...initialScriptureState` which destroys cross-session fields (`coupleStats`, `isStatsLoading`, `isInitialized`). Version conflict detection relies on fragile `errorMessage.includes('409')` string matching. The broadcast payload uses inconsistent keys (`triggeredBy` vs `triggered_by`). Together-mode sessions are excluded from the resume prompt. And `retryFailedWrite` reads current state instead of the failed state snapshot.

### Solution

Apply bounded retry with exponential backoff matching the existing `useRealtimeMessages` RETRY_CONFIG pattern. Scope state resets to preserve cross-session fields. Replace string matching with structured error codes from RPC responses. Standardize on `triggered_by` (snake_case). Enable together-mode session resume in solo mode with a UI note. Fix `retryFailedWrite` to use the failed state snapshot stored in `pendingRetry`. Add a CLOSED handler for the presence channel. Default `isPartnerConnected` to `null` ("unknown") to avoid false-positive connected state. Extract a `scheduleRetry` helper to deduplicate retry logic.

### Scope

**In Scope (Chunk 2 — Reconnection Resilience):**
- C1: MAX_RETRIES + exponential backoff for `useScriptureBroadcast` (4 sites) and `useScripturePresence` (1 site)
- E1: Fix `isPartnerConnected` initial state from `true` to `null` (unknown)
- E6: Debounce `loadSession` to prevent rapid-fire refetch on reconnect
- I9: Add CLOSED state handler for presence channel
- S2: Extract `scheduleRetry` helper to deduplicate retry logic across both hooks

**In Scope (Chunk 3 — State Correctness):**
- C3: Version check before `end_session` state reset (guard before mutation)
- I7: Scoped state reset preserving `coupleStats`, `isStatsLoading`, `isInitialized`
- I10: Standardize `triggered_by` (snake_case), drop `triggeredBy` (camelCase)
- I13: Replace `errorMessage.includes('409')` with structured error check
- E8: Include together-mode sessions in resume prompt (solo resume with note)
- I11: Fix `retryFailedWrite` stale state risk
- T1+T2: Lock-in version conflict + concurrent call tests

**Out of Scope:**
- Chunk 1 + Chunk 4: Already completed (`tech-spec-epic-4-hardening-chunks-1-4.md`)
- Tech debt items E4-D1 through E4-D5 (slice splitting, hook extraction, configurable TTL, integration tests, ESLint warnings)
- Full together-mode resume (presence re-establishment, version reconciliation, role reassignment — that's a feature, not hardening)

## Context for Development

### Codebase Patterns

**Retry Logic (Current State — Problem):**
- `useScriptureBroadcast.ts` uses `useState` for `retryCount` (line 51). Incrementing it triggers `useEffect` re-run (dependency at line 307) which creates a new channel subscription. 4 call sites: CHANNEL_ERROR `.then()` (line 236), CHANNEL_ERROR `.catch()` (line 249), CLOSED `.then()` (line 267), CLOSED `.catch()` (line 280). No max cap, no backoff delay.
- `useScripturePresence.ts` uses same pattern (line 48). 1 call site: CHANNEL_ERROR handler (line 176). Also no max cap, no backoff. Additionally, `removeChannel` at lines 174 and 200 have no `.catch()` — same bug that Chunk 1 fixed in the broadcast hook.
- **Reference pattern:** `useRealtimeMessages.ts` (lines 25-29) implements bounded retry correctly: `RETRY_CONFIG = { maxRetries: 5, baseDelay: 1000, maxDelay: 30000 }`, exponential backoff via `baseDelay * Math.pow(2, retryCountRef.current)` (line 113), max check at line 104, reset on successful SUBSCRIBED (line 95). Uses `useRef` for count tracking + `setTimeout` for backoff delay + `channel.subscribe()` for re-subscribe.

**Presence CLOSED Handler (Current State — Problem):**
- `useScripturePresence.ts` handles `CHANNEL_ERROR` at line 157-177 but has NO `CLOSED` handler. When the channel transitions to CLOSED state (e.g., server-side disconnect), the hook does nothing — no cleanup, no retry, no partner disconnect signal. Compare: `useScriptureBroadcast.ts` has a CLOSED handler at lines 252-282 with cleanup + retry.

**isPartnerConnected Initial State (Current State — Problem):**
- `useScripturePresence.ts:53`: `isPartnerConnected: true` — defaulting to `true` means the UI assumes partner is connected before any heartbeat arrives. The stale timer starts at line 149-156 (fires after 20s if no presence_update received), which would then flip to `false`. During that 20s window, the partner appears connected even if they never joined.
- Consumer: `ReadingContainer.tsx:96-130` tracks transitions via `prevConnectedRef`. Changing to `boolean | null` (null = unknown) affects the transition logic:
  - `null → true` (first heartbeat arrives): Should set connected, no "Reconnected" toast (it's a first connect)
  - `null → false` (stale timer fires before any heartbeat): Should set disconnected
  - `true → false`: Partner disconnected — show overlay (existing behavior)
  - `false → true`: Partner reconnected — resync + toast (existing behavior)
  - The current `wasConnected && !isConnected` / `!wasConnected && isConnected` checks must be updated to strict equality (`=== true`, `=== false`) to correctly distinguish null from false.

**State Reset (Current State — Problem):**
- `...initialScriptureState` is used at 6 `set()` call sites in the slice (plus 1 initialization spread at line 207 that stays unchanged):
  - Line 275: `exitSession()` — user navigates away
  - Line 422: `saveAndExit()` — after successful save
  - Line 472: `abandonSession()` — after successful abandon
  - Line 754: `onBroadcastReceived()` with end_session/complete — **C3 bug: no version check**
  - Line 818: `applySessionConverted()` — partner detached
  - Line 990: `endSession()` — after successful RPC
- **Cross-session fields that must survive reset:** `coupleStats` (line 184), `isStatsLoading` (line 185), `isInitialized` (line 176). All other fields in `initialScriptureState` are session-scoped and should reset.
- Fix approach: Create a `resetSessionState(get)` function **above** the slice creator (since the creator uses concise arrow `=> ({...})`, you cannot define functions inside the object literal). It accepts `get` as a parameter and spreads `initialScriptureState` while preserving the three cross-session fields.

**Version Guard Ordering (Current State — Problem):**
- `onBroadcastReceived()` at lines 748-756: The `end_session` / `complete` check fires FIRST (line 749-755) and resets all state via `set({ ...initialScriptureState })` BEFORE the version check at line 759. A stale broadcast with `triggered_by: 'end_session'` and an old version number would still nuke the session.
- Fix: Move the version check BEFORE the end_session/complete check. If version is stale, drop the broadcast entirely.

**triggered_by Standardization (Current State — Problem):**
- `StateUpdatePayload` (lines 38-39) defines both `triggeredBy` (camelCase) and `triggered_by` (snake_case).
- Only `triggered_by` is ever sent — one site at line 868: `triggered_by: 'lock_in'`.
- The `onBroadcastReceived` handler checks both variants at lines 750-751: `payload.triggeredBy === 'end_session' || payload.triggered_by === 'end_session'`.
- The `endSession()` action at line 987 broadcasts via `get()._broadcastFn?.('state_updated', endSnapshot)` where `endSnapshot` comes from the RPC response (which uses `triggered_by` in snake_case via the SQL function).
- Fix: Remove `triggeredBy` from the interface, keep only `triggered_by`. Update the check to only use `triggered_by`.

**Version Mismatch Detection (Current State — Problem):**
- `lockIn()` catch block at lines 874-916. Error from `callLobbyRpc` is `{ message: string }` (not an Error instance). The RPC raises `'409: version mismatch'` (SQL at migration line 326). Client checks `errorMessage.includes('409')` at line 882 — matches any error containing "409".
- `isScriptureError()` helper already exists at lines 63-72 — checks for `code` and `message` fields with valid `ScriptureErrorCode`.
- Fix: Before `throw error` at line 840, check if `error.message` starts with `'409:'` and throw a `ScriptureError` with `VERSION_MISMATCH` code instead. In the catch block, use `isScriptureError(error) && error.code === ScriptureErrorCode.VERSION_MISMATCH`.

**Resume Filter (Current State — Problem):**
- `checkForActiveSession()` at line 307: `.filter((s) => s.status === 'in_progress' && s.mode === 'solo')` — excludes together-mode sessions entirely.
- Fix: Remove `&& s.mode === 'solo'` filter. The UI (`ScriptureOverview.tsx`) that renders the resume prompt will need a note indicating together-mode sessions will resume as solo.

**retryFailedWrite Stale State (Current State — Problem):**
- `retryFailedWrite()` at lines 487-531. For `advanceStep` / `saveSession` retries, it reads `session.currentStepIndex`, `session.currentPhase`, `session.status` from `get()` at call time (line 499-503). If the user advanced a step locally between the failed write and the retry, the retry sends the *current* state, not the state that failed to persist.
- For reflections, the data is correctly stored in `pendingRetry.reflectionData` (captured at failure time).
- Fix: Add a `sessionData` field to `PendingRetry` that captures the session state at failure time. `retryFailedWrite` uses `pendingRetry.sessionData` instead of `get().session`.
- The `pendingRetry` creation sites at lines 367, 399 would capture `{ currentStepIndex, currentPhase, status }` at failure time.

**loadSession Concurrent Call Guard (Current State — Problem):**
- `loadSession` is called from 3 sites: broadcast hook reconnect (`useScriptureBroadcast.ts:174`), resume flow (`ScriptureOverview.tsx:280`), and presence reconnect (`ReadingContainer.tsx:109`). No guard against concurrent calls — both reconnect paths could fire simultaneously on a network recovery event.
- The `endSession()` action already has this guard: `if (!session || state.isSyncing) return;` (line 973).
- Fix: Add `if (get().scriptureLoading) return;` at the top of `loadSession` (before line 229).

### Files to Reference

| File | Purpose | Lines |
| ---- | ------- | ----- |
| `src/hooks/useScriptureBroadcast.ts` | Channel lifecycle, retry logic (4 unbounded sites), setBroadcastFn | 316 |
| `src/hooks/useScripturePresence.ts` | Presence channel, isPartnerConnected, retry (1 site), no CLOSED handler | 227 |
| `src/hooks/useRealtimeMessages.ts` | **Reference pattern** — bounded RETRY_CONFIG with exponential backoff | 175 |
| `src/stores/slices/scriptureReadingSlice.ts` | State resets (7 sites), version guard, triggered_by, lockIn 409, retryFailedWrite, loadSession, resume filter | ~1008 |
| `src/components/scripture-reading/containers/ReadingContainer.tsx` | isPartnerConnected consumer — transition tracking logic | ~250 |
| `tests/unit/stores/scriptureReadingSlice.lockin.test.ts` | Existing lock-in tests — mock pattern reference | ~200 |
| `tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts` | Existing broadcast reconnect tests — mock pattern reference | ~200 |
| `tests/unit/hooks/useScripturePresence.reconnect.test.ts` | Existing presence reconnect tests — mock pattern reference | ~200 |
| `supabase/migrations/20260301000200_remove_server_side_broadcasts.sql` | `RAISE EXCEPTION '409: version mismatch'` at line 326 — source of string-matched error | 580 |

### Technical Decisions

1. **Retry architecture:** Both scripture hooks use `useState` retryCount to trigger `useEffect` re-runs for re-subscription. `useRealtimeMessages` uses `useRef` + `setTimeout` + direct `channel.subscribe()`. Keep the `useState` pattern for scripture hooks (it's already established and works with the channel lifecycle) but add a `retryCountRef` to track actual count (for max check) and wrap `setRetryCount` in `setTimeout` for backoff delay.
2. **RETRY_CONFIG sharing:** Extract a shared `SCRIPTURE_RETRY_CONFIG` constant (same values as `useRealtimeMessages`: maxRetries 5, baseDelay 1000ms, maxDelay 30000ms) to a common location. Both scripture hooks import it.
3. **scheduleRetry helper (S2):** Create a `scheduleRetry` utility function that both hooks call. It checks max retries, calculates backoff delay, schedules the state update, and returns `false` if max exceeded (caller handles "give up" case). Accepts refs + setState + config.
4. **isPartnerConnected type:** `boolean | null` where `null` = "unknown/initial." ReadingContainer transitions updated to use strict equality. No DisconnectionOverlay flash on session start.
5. **Scoped reset helper:** Create `resetSessionState(get)` function **above** the slice creator (the creator uses concise arrow `=> ({...})` which forbids function declarations inside the object literal). It accepts `get` as a parameter and returns `{ ...initialScriptureState, coupleStats: get().coupleStats, isStatsLoading: get().isStatsLoading, isInitialized: get().isInitialized }`. Replace all 6 `set({ ...initialScriptureState })` sites with `set(resetSessionState(get))`.
6. **Version mismatch structured check:** Wrap the RPC error in a `ScriptureError` with `VERSION_MISMATCH` code before throwing. Catch uses `isScriptureError()` + code check instead of string includes.
7. **loadSession debounce:** Use the existing `scriptureLoading` flag as a concurrent-call guard (same pattern as `endSession` uses `isSyncing`).
8. **PendingRetry sessionData:** Add `sessionData?: { sessionId: string; currentStepIndex: number; currentPhase: string; status: string }` to `PendingRetry`. Captured at failure time, used by `retryFailedWrite`.
9. **Presence removeChannel .catch():** Apply the same `.catch()` pattern from Chunk 1's broadcast hook fix to the presence hook's 2 `removeChannel` call sites.

## Implementation Plan

### Tasks

Tasks are ordered by dependency. Chunk 2 tasks (1-5) and Chunk 3 tasks (6-12) can be implemented in parallel since they touch different concerns. Within each chunk, tasks are ordered lowest-level first.

---

#### Chunk 2: Reconnection Resilience

- [x] **Task 1: Extract `scheduleRetry` helper and `SCRIPTURE_RETRY_CONFIG`** (S2 + C1 foundation)
  - File: `src/hooks/scriptureRetryUtils.ts` (new file)
  - Action: Create a shared utility with:
    ```typescript
    import type { Dispatch, SetStateAction } from 'react';

    export const SCRIPTURE_RETRY_CONFIG = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
    };

    /**
     * Schedules a bounded retry with exponential backoff.
     * Returns false if max retries exceeded (caller handles "give up").
     */
    export function scheduleRetry(
      retryCountRef: { current: number },
      setRetryCount: Dispatch<SetStateAction<number>>,
      config: typeof SCRIPTURE_RETRY_CONFIG = SCRIPTURE_RETRY_CONFIG
    ): boolean {
      if (retryCountRef.current >= config.maxRetries) return false;
      const delay = Math.min(
        config.baseDelay * Math.pow(2, retryCountRef.current),
        config.maxDelay
      );
      retryCountRef.current++;
      setTimeout(() => setRetryCount((c) => c + 1), delay);
      return true;
    }
    ```
  - Notes: Follows the same formula as `useRealtimeMessages.ts:112-114`. Both scripture hooks will import this. The `retryCountRef` is a `useRef` that persists across re-renders (unlike the `useState` retryCount which triggers re-renders). The `setTimeout` wrapper is the key difference from the current code — it adds the backoff delay before triggering the state update.

- [x] **Task 2: Apply bounded retry to `useScriptureBroadcast`** (C1)
  - File: `src/hooks/useScriptureBroadcast.ts`
  - Action:
    1. Add `import { scheduleRetry, SCRIPTURE_RETRY_CONFIG } from './scriptureRetryUtils';`
    2. Add `const retryCountRef = useRef(0);` after line 51.
    3. In the SUBSCRIBED handler (line 168), add `retryCountRef.current = 0;` to reset on success (matching `useRealtimeMessages.ts:95` pattern).
    4. Replace all 4 `setRetryCount((c) => c + 1)` calls (lines 236, 249, 267, 280) with:
       ```typescript
       const retried = scheduleRetry(retryCountRef, setRetryCount);
       if (!retried) {
         handleScriptureError({
           code: ScriptureErrorCode.SYNC_FAILED,
           message: `Broadcast channel: max retries (${SCRIPTURE_RETRY_CONFIG.maxRetries}) exceeded`,
         });
       }
       ```
    5. At lines 249 and 280 (the `.catch()` branches), keep the existing `isRetryingRef.current = false` and `channelRef.current = null` logic before the `scheduleRetry` call.
  - Notes: The `isRetryingRef` guard remains — it prevents retry storms while `removeChannel` is in-flight. `scheduleRetry` adds the max cap and backoff delay on top of that.

- [x] **Task 3: Apply bounded retry + CLOSED handler + .catch() to `useScripturePresence`** (C1 + I9 + Chunk 1 gap)
  - File: `src/hooks/useScripturePresence.ts`
  - Action:
    1. Add `import { scheduleRetry, SCRIPTURE_RETRY_CONFIG } from './scriptureRetryUtils';`
    2. Add `const retryCountRef = useRef(0);` after line 48.
    3. In the SUBSCRIBED handler (line 139), add `retryCountRef.current = 0;` to reset on success.
    4. Replace the unbounded `setRetryCount((c) => c + 1)` at line 176 with bounded `scheduleRetry(retryCountRef, setRetryCount)` + max-exceeded error handling.
    4b. In the CHANNEL_ERROR handler (line 164), add `staleTimerRef` cleanup alongside the existing `intervalRef` cleanup:
       ```typescript
       if (staleTimerRef.current) {
         clearTimeout(staleTimerRef.current);
         staleTimerRef.current = null;
       }
       ```
       This prevents a dangling stale timer from firing after the channel has been torn down and a new subscription is being set up via retry.
    5. Add `.catch()` to `removeChannel` at line 174:
       ```typescript
       void supabase.removeChannel(channel).catch((removeErr: unknown) => {
         handleScriptureError({
           code: ScriptureErrorCode.SYNC_FAILED,
           message: 'Presence channel cleanup failed',
           details: removeErr,
         });
       });
       ```
    6. Add `.catch()` to cleanup `removeChannel` at line 200 (swallow on unmount, same as broadcast hook):
       ```typescript
       void supabase.removeChannel(channelRef.current).catch(() => {
         // Swallow cleanup errors on unmount
       });
       ```
    7. Add CLOSED handler after the CHANNEL_ERROR block (after line 178), mirroring `useScriptureBroadcast.ts:252-282`:
       ```typescript
       } else if (status === 'CLOSED') {
         if (channelRef.current === channel && sessionId) {
           if (intervalRef.current) {
             clearInterval(intervalRef.current);
             intervalRef.current = null;
           }
           if (staleTimerRef.current) {
             clearTimeout(staleTimerRef.current);
             staleTimerRef.current = null;
           }
           setPartnerPresence((prev) => ({
             ...prev,
             isPartnerConnected: false,
             view: null,
           }));
           void supabase.removeChannel(channel).catch((removeErr: unknown) => {
             handleScriptureError({
               code: ScriptureErrorCode.SYNC_FAILED,
               message: 'Presence channel cleanup failed',
               details: removeErr,
             });
           });
           channelRef.current = null;
           const retried = scheduleRetry(retryCountRef, setRetryCount);
           if (!retried) {
             handleScriptureError({
               code: ScriptureErrorCode.SYNC_FAILED,
               message: `Presence channel: max retries (${SCRIPTURE_RETRY_CONFIG.maxRetries}) exceeded`,
             });
           }
         }
       }
       ```
  - Notes: The CLOSED handler follows the same structure as CHANNEL_ERROR but adds interval cleanup and partner disconnect signal. The `.catch()` additions mirror exactly what Chunk 1's Task 3 did for the broadcast hook.

- [x] **Task 4: Fix `isPartnerConnected` initial state** (E1)
  - File: `src/hooks/useScripturePresence.ts`
  - Action:
    1. Change `PartnerPresenceInfo.isPartnerConnected` type from `boolean` to `boolean | null` (line 29).
    2. Change initial state from `isPartnerConnected: true` to `isPartnerConnected: null` (line 53).
  - File: `src/components/scripture-reading/containers/ReadingContainer.tsx`
  - Action: Update the transition tracking effect (lines 96-119) to use strict equality:
    ```typescript
    const prevConnectedRef = useRef(partnerPresence.isPartnerConnected);
    useEffect(() => {
      const wasConnected = prevConnectedRef.current;
      const isConnected = partnerPresence.isPartnerConnected;
      prevConnectedRef.current = isConnected;

      if (isConnected === true && wasConnected !== true) {
        // Partner connected (first time or reconnected)
        setPartnerDisconnected(false);
        if (wasConnected === false) {
          // Only resync + toast on actual RE-connection (was confirmed disconnected)
          if (session?.id) {
            void loadSession(session.id);
          }
          setShowReconnectedToast(true);
          if (reconnectedToastTimerRef.current) clearTimeout(reconnectedToastTimerRef.current);
          reconnectedToastTimerRef.current = setTimeout(() => setShowReconnectedToast(false), 2000);
        }
      } else if (isConnected === false && wasConnected !== false) {
        // Partner disconnected (from connected or unknown)
        setPartnerDisconnected(true);
      }
      return () => {
        if (reconnectedToastTimerRef.current) clearTimeout(reconnectedToastTimerRef.current);
      };
    }, [partnerPresence.isPartnerConnected, setPartnerDisconnected, loadSession, session?.id]);
    ```
  - Also update `handleKeepWaiting` (lines 122-130): `if (partnerPresence.isPartnerConnected === true)` instead of `if (partnerPresence.isPartnerConnected)`.
  - File: `src/components/scripture-reading/__tests__/ReadingContainer.test.tsx`
  - Action: Update mock return value at line 76 from `isPartnerConnected: true` to `isPartnerConnected: null` (default) or `true` (connected) depending on the test scenario.
  - Notes: The key transitions — `null → true` = first connect (no toast, no resync), `null → false` = initial disconnect (show overlay), `false → true` = reconnect (toast + resync), `true → false` = disconnect (show overlay). The `null` state means "we just subscribed and haven't heard from partner yet."

- [x] **Task 5: Add `loadSession` concurrent call guard** (E6)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action: Add guard at the top of `loadSession` (before line 229):
    ```typescript
    loadSession: async (sessionId) => {
      if (get().scriptureLoading) return;
      set({ scriptureLoading: true, scriptureError: null });
      // ... rest unchanged
    ```
  - Notes: Follows the same pattern as `endSession` (line 973: `if (!session || state.isSyncing) return;`). Prevents concurrent calls from broadcast reconnect + presence reconnect firing simultaneously. The `scriptureLoading` flag is already set to `true` on entry (line 229) and reset in all exit paths.

---

#### Chunk 3: State Correctness

- [x] **Task 6: Create `resetSessionState` helper** (I7)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action: Add helper function **above** the slice creator (before line 206). The slice creator uses a concise arrow `=> ({...})` which cannot contain function declarations or const bindings — the helper must be extracted outside it, accepting `get` as a parameter:
    ```typescript
    /** Reset session-scoped state while preserving cross-session fields. */
    function resetSessionState(
      get: () => ScriptureReadingState & ScriptureSlice
    ): Partial<ScriptureReadingState> {
      const { coupleStats, isStatsLoading, isInitialized } = get();
      return { ...initialScriptureState, coupleStats, isStatsLoading, isInitialized };
    }

    export const createScriptureReadingSlice: AppStateCreator<ScriptureSlice> = (set, get) => ({
      ...initialScriptureState,
      // ... rest unchanged
    ```
    Replace all 6 `set({ ...initialScriptureState })` calls with `set(resetSessionState(get))`:
    - Line 275: `exitSession()` → `set(resetSessionState(get));`
    - Line 422: `saveAndExit()` → `set(resetSessionState(get));`
    - Line 472: `abandonSession()` → `set(resetSessionState(get));`
    - Line 754: `onBroadcastReceived()` → `set(resetSessionState(get));`
    - Line 818: `applySessionConverted()` → `set(resetSessionState(get));`
    - Line 990: `endSession()` → `set(resetSessionState(get));`
    - Line 207: Initial store state `...initialScriptureState` — stays unchanged (initialization, not a reset).
  - Notes: The helper is defined **outside** the concise arrow `=> ({...})` because TypeScript/JS does not allow function declarations inside object literals. It accepts `get` as a parameter to access current cross-session field values.

- [x] **Task 7: Fix version guard ordering in `onBroadcastReceived`** (C3)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action: Reorder lines 748-759 so the version check comes FIRST:
    ```typescript
    onBroadcastReceived: (payload) => {
      const state = get();
      const { session, currentUserId } = state;

      // Version check FIRST — drop stale broadcasts entirely
      if (session && payload.version <= session.version) return;

      // Story 4.3: End session or complete phase → exit
      if (
        payload.triggered_by === 'end_session' ||
        payload.currentPhase === 'complete'
      ) {
        set(resetSessionState());
        return;
      }

      // ... rest unchanged (role mapping, step advance, etc.)
    ```
  - Notes: The version check must come before ANY state mutation. A stale end_session broadcast (version <= current) is harmless and should be silently dropped. This also incorporates the I10 fix (only `triggered_by`, no `triggeredBy`).

- [x] **Task 8: Standardize `triggered_by` and remove `triggeredBy`** (I10)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action:
    1. In `StateUpdatePayload` interface (lines 28-40): Remove line 38 (`triggeredBy?:` ...) entirely. Keep only `triggered_by?:` at line 39.
    2. The `onBroadcastReceived` check is already updated by Task 7 to only use `triggered_by`.
  - Notes: No backward compatibility needed — both browsers in the couple's PWA deploy from the same GitHub Pages build simultaneously. Only `triggered_by` was ever sent (line 868). The `triggeredBy` variant was dead code.

- [x] **Task 9: Replace `errorMessage.includes('409')` with structured check** (I13)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action:
    1. In `lockIn()`, after `if (error) throw error;` at line 840, add version mismatch detection:
       ```typescript
       if (error) {
         if (typeof error.message === 'string' && error.message.startsWith('409:')) {
           throw {
             code: ScriptureErrorCode.VERSION_MISMATCH,
             message: error.message,
           } satisfies ScriptureError;
         }
         throw error;
       }
       ```
    2. Replace the catch block's string matching (lines 874-916) with structured check:
       ```typescript
       } catch (error) {
         if (isScriptureError(error) && error.code === ScriptureErrorCode.VERSION_MISMATCH) {
           // Version mismatch: rollback, refetch session, show subtle toast
           set({ isPendingLockIn: false });
           try {
             const refreshedSession = await scriptureReadingService.getSession(session.id, (s) =>
               set({ session: s })
             );
             if (refreshedSession) {
               set({ session: refreshedSession });
             }
           } catch (refetchErr) {
             handleScriptureError({
               code: ScriptureErrorCode.SYNC_FAILED,
               message: 'Failed to refresh session after version mismatch',
               details: refetchErr,
             });
           }
           set({
             scriptureError: {
               code: ScriptureErrorCode.VERSION_MISMATCH,
               message: 'Session updated',
             },
           });
         } else {
           // Other error: rollback + standard error handling
           set({ isPendingLockIn: false });
           const scriptureError: ScriptureError = isScriptureError(error)
             ? error
             : {
                 code: ScriptureErrorCode.SYNC_FAILED,
                 message: error instanceof Error ? error.message : String(error),
                 details: error,
               };
           handleScriptureError(scriptureError);
           set({ scriptureError });
         }
       }
       ```
  - File: `src/components/scripture-reading/containers/ReadingContainer.tsx`
  - Action: Update the "Session updated" toast detection (line 147) and error-toast exclusion (line 159) to use code-based matching instead of string matching:
    ```typescript
    // Watch scriptureError for version mismatch toast (was: message === 'Session updated')
    useEffect(() => {
      if (scriptureError?.code === ScriptureErrorCode.VERSION_MISMATCH) {
        setShowToast(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setShowToast(false), 3000);
      }
    }, [scriptureError]);

    // Show error toast for non-version-mismatch failures (was: message === 'Session updated' exclusion)
    useEffect(() => {
      if (!scriptureError || scriptureError.code === ScriptureErrorCode.VERSION_MISMATCH) return;
      // ... rest unchanged
    }, [scriptureError]);
    ```
    Add `import { ScriptureErrorCode } from '../../../stores/slices/scriptureReadingSlice';` if not already imported.
  - Notes: The `satisfies ScriptureError` assertion ensures type safety. The `startsWith('409:')` is more specific than `includes('409')` and matches exactly what the SQL RPC raises (`'409: version mismatch'`). The catch block now uses `isScriptureError()` + code check — fully structured, no string matching. The error set on the version mismatch path now correctly uses `VERSION_MISMATCH` code instead of `SYNC_FAILED`. The downstream consumer (`ReadingContainer`) is also updated to use code-based matching, completing the end-to-end structured error flow.

- [x] **Task 10: Include together-mode in resume prompt** (E8)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action:
    1. In `checkForActiveSession()` at line 307, remove `&& s.mode === 'solo'`:
       ```typescript
       const incomplete = sessions
         .filter((s) => s.status === 'in_progress')
         .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
       ```
    2. In `loadSession()`, after the session is loaded and set (line 260), add a mode mutation for together-mode sessions being resumed as solo:
       ```typescript
       // If resuming a together-mode session, convert to solo on both client and server.
       // This ensures ScriptureOverview routing (line 299: session.mode === 'solo')
       // sends the user to SoloReadingFlow instead of ReadingContainer/LobbyContainer.
       if (session.mode === 'together') {
         const soloSession = { ...session, mode: 'solo' as const };
         set({ session: soloSession, scriptureLoading: false, isInitialized: true, currentUserId });
         // Persist mode change to server (fire-and-forget, non-blocking)
         void scriptureReadingService.updateSession(sessionId, { mode: 'solo' }).catch((err) => {
           handleScriptureError({
             code: ScriptureErrorCode.SYNC_FAILED,
             message: 'Failed to convert session to solo mode',
             details: err,
           });
         });
         return;
       }

       set({ session, scriptureLoading: false, isInitialized: true, currentUserId });
       ```
  - File: `src/components/scripture-reading/containers/ScriptureOverview.tsx`
  - Action: In the resume prompt UI, add a conditional note when the active session (before resume) has mode `'together'`:
    - Find the resume prompt section (where `activeSession` is rendered).
    - Add: `{activeSession.mode === 'together' && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">This was a together-mode session. It will resume as solo reading.</p>}`
  - Notes: The mode mutation in `loadSession` ensures `ScriptureOverview.tsx:299` (`session.mode === 'solo'`) routes to `SoloReadingFlow` instead of `ReadingContainer` or `LobbyContainer`. Without this mutation, a together-mode session loaded via resume would hit the together-mode routing branches (lines 309, 314-317) and render together-mode UI with no partner present. The server-side mode update is fire-and-forget because the user can continue reading even if the persist fails — the local state is already correct.

- [x] **Task 11: Fix `retryFailedWrite` stale state** (I11)
  - File: `src/stores/slices/scriptureReadingSlice.ts`
  - Action:
    1. Add `sessionData` to `PendingRetry` interface (line 78):
       ```typescript
       export interface PendingRetry {
         type: 'advanceStep' | 'saveSession' | 'reflection';
         attempts: number;
         maxAttempts: number;
         reflectionData?: {
           sessionId: string;
           stepIndex: number;
           rating: number;
           notes: string;
           isShared: boolean;
         };
         sessionData?: {
           sessionId: string;
           currentStepIndex: number;
           currentPhase: string;
           status: string;
         };
       }
       ```
    2. Update `pendingRetry` creation at line 367 (last step advance failure):
       ```typescript
       pendingRetry: {
         type: 'advanceStep',
         attempts: 1,
         maxAttempts: 3,
         sessionData: {
           sessionId: session.id,
           currentStepIndex: MAX_STEPS - 1,
           currentPhase: 'reflection',
           status: session.status,
         },
       },
       ```
    3. Update `pendingRetry` creation at line 399 (normal step advance failure):
       ```typescript
       pendingRetry: {
         type: 'advanceStep',
         attempts: 1,
         maxAttempts: 3,
         sessionData: {
           sessionId: session.id,
           currentStepIndex: nextStep,
           currentPhase: session.currentPhase,
           status: session.status,
         },
       },
       ```
    4. Update `retryFailedWrite()` at lines 498-503 to use `pendingRetry.sessionData`:
       ```typescript
       } else if (pendingRetry.sessionData) {
         await scriptureReadingService.updateSession(pendingRetry.sessionData.sessionId, {
           currentStepIndex: pendingRetry.sessionData.currentStepIndex,
           currentPhase: pendingRetry.sessionData.currentPhase,
           status: pendingRetry.sessionData.status,
         });
       } else {
         // Fallback: use current session (legacy pendingRetry without sessionData)
         await scriptureReadingService.updateSession(session.id, {
           currentStepIndex: session.currentStepIndex,
           currentPhase: session.currentPhase,
           status: session.status,
         });
       }
       ```
  - Notes: The fallback branch handles any `pendingRetry` objects that were created before this code change (e.g., if the app was mid-session during a deploy). After one session cycle, all new `pendingRetry` objects will have `sessionData`.

- [x] **Task 12: Lock-in version conflict + concurrent call tests** (T1 + T2)
  - File: `tests/unit/stores/scriptureReadingSlice.versionConflict.test.ts` (new file)
  - Action: Create test file following `scriptureReadingSlice.lockin.test.ts` mock patterns. Tests:
    - `lockIn() with 409 error sets VERSION_MISMATCH scriptureError` (T1) — Mock `callLobbyRpc` to return `{ data: null, error: { message: '409: version mismatch' } }`. Verify `scriptureError.code === 'VERSION_MISMATCH'` and `isPendingLockIn === false`.
    - `lockIn() with 409 error triggers session refetch` (T1) — Same mock. Verify `scriptureReadingService.getSession` is called with the session ID.
    - `lockIn() with 409 error followed by refetch failure sets SYNC_FAILED` (T1) — Mock both RPC error and getSession rejection. Verify `handleScriptureError` called with `SYNC_FAILED` code.
    - `lockIn() with non-409 error sets SYNC_FAILED scriptureError` — Mock `callLobbyRpc` to return `{ data: null, error: { message: 'server error' } }`. Verify `scriptureError.code === 'SYNC_FAILED'`.
    - `concurrent lockIn() calls — second call returns early if isPendingLockIn` (T2) — Set `isPendingLockIn: true`, call `lockIn()`, verify RPC is NOT called.
  - Notes: The concurrent call test (T2) validates the existing optimistic guard at line 831: `set({ isPendingLockIn: true })`. If already pending, the guard at line 828 (`if (!session || session.currentPhase !== 'reading') return;`) doesn't cover this case — verify whether an additional `if (state.isPendingLockIn) return;` guard is needed. If the guard doesn't exist, add it.

### Acceptance Criteria

#### Chunk 2 — Reconnection Resilience

- [x] AC-1: Given the broadcast channel enters CHANNEL_ERROR state 6 times consecutively, when `scheduleRetry` is called on each error, then the first 5 attempts schedule retries with exponential backoff (1s, 2s, 4s, 8s, 16s capped at 30s) and the 6th returns `false`, triggering a `SYNC_FAILED` error with "max retries exceeded" message.
- [x] AC-2: Given the broadcast channel successfully subscribes after a retry, when SUBSCRIBED status is received, then `retryCountRef.current` resets to `0` so future errors get fresh retry budget.
- [x] AC-3: Given the presence channel enters CHANNEL_ERROR state, when the bounded retry fires, then the heartbeat interval is cleared, `isPartnerConnected` is set to `false`, `removeChannel` is called with `.catch()`, and `scheduleRetry` is invoked with backoff.
- [x] AC-4: Given the presence channel enters CLOSED state, when the handler fires, then the heartbeat interval is cleared, `isPartnerConnected` is set to `false`, channel is cleaned up with `.catch()`, and a bounded retry is scheduled.
- [x] AC-5: Given a together-mode session starts, when the presence channel first subscribes, then `isPartnerConnected` is `null` (not `true`) and the DisconnectionOverlay is NOT shown.
- [x] AC-6: Given `isPartnerConnected` transitions from `null` to `true` (first heartbeat), when ReadingContainer detects the transition, then `setPartnerDisconnected(false)` is called but NO "Reconnected" toast is shown and `loadSession` is NOT called.
- [x] AC-7: Given `isPartnerConnected` transitions from `null` to `false` (stale timer fires before heartbeat), when ReadingContainer detects the transition, then `setPartnerDisconnected(true)` is called and the DisconnectionOverlay appears.
- [x] AC-8: Given `loadSession` is already in progress (`scriptureLoading === true`), when a second `loadSession` call is made (e.g., from broadcast reconnect while presence reconnect fires), then the second call returns immediately without making a network request.
- [x] AC-9: All existing unit tests pass (no regressions).

#### Chunk 3 — State Correctness

- [x] AC-10: Given a stale `state_updated` broadcast with `triggered_by: 'end_session'` and `version <= session.version`, when `onBroadcastReceived` processes it, then the broadcast is silently dropped (no state reset, no side effects).
- [x] AC-11: Given a valid `state_updated` broadcast with `triggered_by: 'end_session'` and `version > session.version`, when `onBroadcastReceived` processes it, then session state resets but `coupleStats`, `isStatsLoading`, and `isInitialized` retain their pre-reset values.
- [x] AC-12: Given any session reset path (`exitSession`, `saveAndExit`, `abandonSession`, `endSession`, `applySessionConverted`, `onBroadcastReceived` end_session), when the reset executes, then `coupleStats` is preserved (not nulled) and `isInitialized` remains `true`.
- [x] AC-13: Given `StateUpdatePayload` interface, when inspected, then only `triggered_by` exists (no `triggeredBy` field). And `onBroadcastReceived` only checks `payload.triggered_by`.
- [x] AC-14: Given `lockIn()` RPC returns `{ error: { message: '409: version mismatch' } }`, when the catch block processes it, then `scriptureError.code === 'VERSION_MISMATCH'` (not `SYNC_FAILED`) and `isPendingLockIn === false` and `scriptureReadingService.getSession` is called to refetch.
- [x] AC-15: Given `lockIn()` RPC returns `{ error: { message: 'server error' } }` (non-409), when the catch block processes it, then `scriptureError.code === 'SYNC_FAILED'` and `isPendingLockIn === false`.
- [x] AC-16: Given a together-mode session with `status === 'in_progress'`, when `checkForActiveSession` runs, then the session appears in the resume prompt with a note indicating it will resume as solo. When the user resumes it via `loadSession`, the session's `mode` is mutated to `'solo'` both locally and on the server, and `ScriptureOverview` routes to `SoloReadingFlow` (not `ReadingContainer`).
- [x] AC-17: Given `advanceStep()` fails at step 5 and a `pendingRetry` is created, when the user advances locally to step 6 and then calls `retryFailedWrite()`, then the retry sends `currentStepIndex: 5` (the failed state) not `6` (current state).
- [x] AC-18: Given `lockIn()` is called while `isPendingLockIn === true`, when the action checks preconditions, then it returns early without calling the RPC (no concurrent lock-in calls).
- [x] AC-19: All existing unit tests pass (no regressions).

## Additional Context

### Dependencies

- No new external dependencies. All required libraries (`@sentry/react`, `@supabase/supabase-js`, `zustand`, `react`) are already installed.
- Chunk 1 (Error Observability) must be complete — Chunks 2+3 depend on `handleScriptureError` routing to Sentry and `.catch()` patterns being established. **Status: Done.**
- Local Supabase instance NOT required for Chunks 2+3 (no SQL migrations). All changes are client-side TypeScript.

### Testing Strategy

- **Unit tests (Vitest + happy-dom):**
  - `tests/unit/hooks/scriptureRetryUtils.test.ts` (new) — `scheduleRetry` helper: max check, backoff calculation, timeout scheduling, reset behavior.
  - Extend `tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts` — verify bounded retry behavior, max exceeded gives up, reset on SUBSCRIBED.
  - Extend `tests/unit/hooks/useScripturePresence.reconnect.test.ts` — verify bounded retry, CLOSED handler, `.catch()` on removeChannel.
  - Extend `src/components/scripture-reading/__tests__/ReadingContainer.test.tsx` — verify `null → true`, `null → false`, `false → true` transition behaviors.
  - `tests/unit/stores/scriptureReadingSlice.versionConflict.test.ts` (new) — version mismatch structured check, concurrent lockIn guard (T1 + T2).
  - Extend `tests/unit/stores/scriptureReadingSlice.test.ts` — verify `resetSessionState` preserves cross-session fields, loadSession concurrent guard, retryFailedWrite uses sessionData.
- **Manual verification:**
  - `npm run test:unit` — all existing + new tests pass
  - `npm run typecheck` — no type errors
  - `npm run lint` — no lint errors

### Notes

- Chunks 2 and 3 can be implemented in parallel — they touch different concerns (retry/channel vs state/types). Within each chunk, tasks are ordered by dependency.
- The `scheduleRetry` helper (Task 1) is the foundation for both hooks. It must be implemented first within Chunk 2.
- The `resetSessionState` helper (Task 6) is the foundation for all state reset fixes. It must be implemented first within Chunk 3.
- Task 12 (T2 — concurrent lockIn) may reveal that no explicit `isPendingLockIn` guard exists at the top of `lockIn()`. The current guard at line 828 only checks phase, not pending state. If the test fails, add `if (state.isPendingLockIn) return;` after line 828.
- Source: Epic 4 Retrospective (`_bmad-output/implementation-artifacts/epic-4-retro-2026-03-02.md`), Hardening Chunks 1+4 Tech Spec (`_bmad-output/implementation-artifacts/tech-spec-epic-4-hardening-chunks-1-4.md`)
- The `ScriptureOverview.tsx` change in Task 10 includes a conditional text note in the resume prompt AND a mode mutation in `loadSession` that converts together-mode sessions to solo on resume (both locally and server-side).
- `PendingRetry.sessionData` fallback in Task 11 handles the deploy transition gracefully — existing in-flight retries without `sessionData` fall back to current session state (existing behavior).

## Review Notes
- Adversarial review completed
- Findings: 2 total, 1 fixed, 1 skipped
- Resolution approach: auto-fix
- F1 (High, real): `scheduleRetry` timer not cancellable on unmount — fixed by adding `retryTimerRef` param and clearing on cleanup in both hooks
- F2 (Medium, undecided): `loadSession` guard silently drops concurrent re-load — acknowledged, low probability in practice
