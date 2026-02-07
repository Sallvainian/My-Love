# Tasks / Subtasks

## Task 1: Auto-Save on App Close / Visibility Change (AC: #1)

- [ ] 1.1 Create `src/hooks/useAutoSave.ts` custom hook
  - Listens to `visibilitychange` event (fires when user switches tabs, locks phone, etc.)
  - On `document.visibilityState === 'hidden'`: if session exists with `status === 'in_progress'`, call `saveSession()` (fire-and-forget)
  - Listens to `beforeunload` event as backup (fires on tab close / refresh)
  - On `beforeunload`: call `saveSession()` (best-effort, may not complete)
  - Hook accepts `session` from slice and `saveSession` action
  - Cleanup: remove event listeners on unmount
- [ ] 1.2 Create `saveSession` action on `scriptureReadingSlice`
  - Persists current session state to server via `scriptureReadingService.updateSession()`
  - Does NOT clear session from state (unlike `saveAndExit` which clears)
  - Sets `isSyncing: true` during persist, `false` on complete
  - On error: sets `scriptureError` with `SYNC_FAILED` code (non-blocking)
  - This is the "silent save" counterpart to `saveAndExit` (which saves + exits)
- [ ] 1.3 Wire `useAutoSave` into `SoloReadingFlow.tsx`
  - Call `useAutoSave({ session, saveSession })` at component top level
  - Hook must be before the session null-guard `if (!session) return null`
- [ ] 1.4 Verify `saveAndExit` (existing) updates IndexedDB cache on success
  - Already implemented: `updateSession` does server-first → cache update
  - Verify: after `saveAndExit`, IndexedDB contains the latest `currentStepIndex`

## Task 2: Verify & Harden Resume Flow (AC: #2)

- [ ] 2.1 Verify `checkForActiveSession` finds incomplete solo sessions correctly
  - Already implemented in slice: queries `getUserSessions()`, filters `status === 'in_progress' && mode === 'solo'`
  - Write test: multiple sessions exist (complete + in_progress), only in_progress returned
  - Write test: together-mode in_progress sessions are NOT returned
- [ ] 2.2 Verify `loadSession` implements cache-first pattern with background refresh
  - Already implemented: `getSession(id, onRefresh)` → cache first → background fetch → `onRefresh(freshData)` → slice `set({ session: refreshed })`
  - Write test: cached session loads instantly, fresh data updates state after server response
  - Write test: if cache is empty, fetches from server directly
- [ ] 2.3 Harden "Start fresh" to clear server-side session
  - Current behavior: `exitSession()` only clears local state; server session remains `in_progress`
  - **Fix:** Add `abandonSession` action to slice:
    - Calls `scriptureReadingService.updateSession(sessionId, { status: 'abandoned' })` to mark server session as abandoned
    - Then clears local state and `activeSession`
  - Update `ScriptureOverview.tsx`: "Start fresh" calls `abandonSession(activeSession.id)` instead of `exitSession()`
  - This ensures abandoned sessions don't re-appear on resume
- [ ] 2.4 Write unit tests for resume → load → render cycle
  - Test: resume prompt shows correct step number (`currentStepIndex + 1`)
  - Test: "Continue" calls `loadSession` with active session ID
  - Test: after `loadSession`, SoloReadingFlow renders at the correct step
  - Test: "Start fresh" calls `abandonSession`, then allows new session creation

## Task 3: Verify Optimistic UI for Step Advancement (AC: #3)

- [ ] 3.1 Verify `advanceStep` is optimistic (local-first, server-background)
  - Already implemented: slice updates `currentStepIndex` immediately, then calls `updateSession()` in background
  - Write test: UI reflects new step before server call resolves
  - Write test: `isSyncing` is true during server call, false after
- [ ] 3.2 Verify IndexedDB cache update on successful server response
  - Already implemented: `updateSession()` → server success → `this.update(sessionId, updates)` → IndexedDB updated
  - Write test: after `advanceStep` completes, IndexedDB contains the new `currentStepIndex`
- [ ] 3.3 Verify server error does NOT roll back optimistic state (AC: #6 precondition)
  - Already implemented: on error, `scriptureError` is set but `session.currentStepIndex` is NOT reverted
  - Write test: server fails → step still shows the advanced value → error displayed
  - This is intentional: user keeps their optimistic progress, retry handles the server sync

## Task 4: Add Offline Detection & Blocked Advancement (AC: #4)

- [ ] 4.1 Create `src/hooks/useNetworkStatus.ts` custom hook
  - Returns `{ isOnline: boolean }` using `navigator.onLine` + `online`/`offline` event listeners
  - Initializes from `navigator.onLine`
  - Updates on `window.addEventListener('online', ...)` and `window.addEventListener('offline', ...)`
  - Cleanup: remove listeners on unmount
- [ ] 4.2 Add `isOffline` indicator to `SoloReadingFlow.tsx`
  - Use `useNetworkStatus()` hook
  - When `!isOnline`: show a subtle, non-blocking "Offline" banner above the action buttons
  - Banner: `bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm` with WiFi-off icon
  - Text: "You're offline. Cached data shown. Connect to continue."
  - Banner has `role="status"` and `aria-live="polite"` for screen reader announcement
  - `data-testid="offline-indicator"`
- [ ] 4.3 Block "Next Verse" button when offline
  - When `!isOnline`: disable "Next Verse" / "Complete Reading" button
  - Add tooltip or subtitle text: "Connect to internet to continue"
  - "View Response" and "Back to Verse" remain functional (local-only navigation)
  - "Exit" button remains functional (can still exit, progress already cached)
- [ ] 4.4 Block session creation when offline
  - In `ScriptureOverview.tsx`: when `!isOnline`, disable "Start" button and mode selection
  - Show "You're offline" message near the Start button
  - Resume "Continue" button should still work if cached session exists (loads from cache)
- [ ] 4.5 Write tests for offline behavior
  - Test: offline indicator shows when `navigator.onLine === false`
  - Test: "Next Verse" disabled when offline
  - Test: "View Response" still works when offline
  - Test: offline indicator hides when back online
  - Test: "Next Verse" re-enabled when back online

## Task 5: Wire IndexedDB Corruption Recovery into UI Flow (AC: #5)

- [ ] 5.1 Verify service-level corruption recovery works end-to-end
  - Already implemented in service: `getUserSessions()` catches IndexedDB errors → calls `recoverSessionCache()` → falls back to server
  - Already implemented: `getSession()` uses `this.get()` from BaseIndexedDBService which handles basic errors
  - Write test: IndexedDB throws → cache cleared → data served from server → no error visible to user
- [ ] 5.2 Add corruption recovery to `loadSession` in the slice
  - Wrap `getSession()` call in try/catch specifically for cache errors
  - If cache read fails: call `recoverSessionCache()`, then retry from server
  - User never sees "cache corrupted" — only normal loading state
- [ ] 5.3 Add corruption recovery to `checkForActiveSession` in the slice
  - Already partially handled: `getUserSessions()` in service has recovery
  - Verify: if IndexedDB is totally broken, the slice still resolves (even with empty result)
  - Write test: corrupted cache → `checkForActiveSession` still completes → returns null (no crash)
- [ ] 5.4 Add corruption recovery to `advanceStep` in the slice
  - The `updateSession()` call's cache update may fail if IndexedDB is corrupt
  - Service already handles this: `cacheSession()` has try/catch → logs error → doesn't throw
  - Verify: server write succeeds even if cache write fails → no error propagated to user

## Task 6: Implement Retry UI for Failed Server Writes (AC: #6)

- [ ] 6.1 Add `pendingRetry` state to `scriptureReadingSlice`
  - New state fields:
    ```typescript
    pendingRetry: {
      type: 'advanceStep' | 'saveSession';
      attempts: number;
      maxAttempts: number;
    } | null;
    ```
  - Default: `null` (no pending retry)
- [ ] 6.2 Add `retryFailedWrite` action to slice
  - Retries the last failed operation (stored in `pendingRetry.type`)
  - For `advanceStep`: re-calls `updateSession()` with current session state
  - For `saveSession`: re-calls `updateSession()` with current session state
  - On success: clears `pendingRetry` and `scriptureError`
  - On failure: increments `pendingRetry.attempts`
  - If `attempts >= maxAttempts` (3): clear `pendingRetry`, keep `scriptureError` visible
- [ ] 6.3 Update `advanceStep` to set `pendingRetry` on failure
  - On server error: instead of just setting `scriptureError`, also set `pendingRetry: { type: 'advanceStep', attempts: 1, maxAttempts: 3 }`
  - Local state (optimistic step index) is NOT rolled back
- [ ] 6.4 Add retry UI to `SoloReadingFlow.tsx`
  - When `pendingRetry !== null`: show a subtle retry banner below the error display
  - Banner: `bg-amber-50 border border-amber-200 rounded-xl p-3` with retry button
  - Text: "Save failed. Tap to retry." with a "Retry" button
  - Button calls `retryFailedWrite()` from the slice
  - Shows attempt count: "Retry (1/3)"
  - When max attempts exhausted: show "Save failed. Your progress is saved locally." (reassure user)
  - `data-testid="retry-banner"`, `data-testid="retry-button"`
- [ ] 6.5 Auto-retry on reconnect
  - In `SoloReadingFlow.tsx`: when `useNetworkStatus()` transitions from offline → online AND `pendingRetry !== null`:
    - Automatically call `retryFailedWrite()`
    - This handles the case where the failure was due to network loss
- [ ] 6.6 Write tests for retry behavior
  - Test: server error on `advanceStep` → `pendingRetry` populated → retry banner visible
  - Test: tap retry → `retryFailedWrite` called → on success → banner disappears
  - Test: retry fails 3 times → max attempts reached → final message shown
  - Test: going online auto-triggers retry if `pendingRetry` exists
  - Test: successful `advanceStep` clears any existing `pendingRetry`

## Task 7: Write Comprehensive Unit Tests (AC: all)

- [ ] 7.1 Test `useAutoSave` hook
  - Test: `visibilitychange` event with `hidden` state triggers save
  - Test: no save triggered when visibility is `visible`
  - Test: no save triggered when session is null
  - Test: no save triggered when session status is `complete`
  - Test: cleanup removes event listeners
- [ ] 7.2 Test `useNetworkStatus` hook
  - Test: returns `isOnline: true` when `navigator.onLine` is true
  - Test: returns `isOnline: false` when `navigator.onLine` is false
  - Test: updates when `online` event fires
  - Test: updates when `offline` event fires
  - Test: cleanup removes event listeners
- [ ] 7.3 Test updated `scriptureReadingSlice` actions
  - Test: `saveSession` persists to server without clearing state
  - Test: `saveSession` sets `isSyncing` true/false
  - Test: `saveSession` handles server error
  - Test: `abandonSession` marks server session as `abandoned` + clears state
  - Test: `retryFailedWrite` retries and clears on success
  - Test: `retryFailedWrite` increments attempts on failure
  - Test: `retryFailedWrite` gives up after max attempts
- [ ] 7.4 Test SoloReadingFlow offline/retry UI integration
  - Test: offline indicator renders when offline
  - Test: offline indicator hidden when online
  - Test: "Next Verse" disabled when offline
  - Test: retry banner renders when `pendingRetry` is non-null
  - Test: retry button calls `retryFailedWrite`
  - Test: max retries message shown after exhaustion
- [ ] 7.5 Test ScriptureOverview resume hardening
  - Test: "Start fresh" calls `abandonSession`
  - Test: resume "Continue" still works when offline (cache-only load)
  - Test: "Start" button disabled when offline

## Task 8: Update E2E Test Specs (AC: all)

- [ ] 8.1 Verify/update E2E test expectations in `tests/e2e/scripture/scripture-solo-reading.spec.ts`
  - Tests P1-001 (optimistic advance), P1-010 (save/resume), P1-011 (offline), P1-012 (progress)
  - Update `data-testid` references if any changed
  - Add new testids: `offline-indicator`, `retry-banner`, `retry-button`
- [ ] 8.2 Add testids to all new UI elements
  - `offline-indicator` on offline banner
  - `retry-banner` on retry UI
  - `retry-button` on retry action
  - `auto-save-indicator` on any auto-save visual feedback (optional)
