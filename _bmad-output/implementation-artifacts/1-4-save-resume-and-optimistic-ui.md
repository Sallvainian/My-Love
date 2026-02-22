# Story 1.4: Save, Resume & Optimistic UI

## Story

As a user,
I want my solo session progress saved automatically and resumable, with changes appearing instantly,
So that I never lose progress and the experience feels smooth.

## Acceptance Criteria

1. **Save on Exit (Server + Cache Persist)**
   - **Given** the user is in a Solo session
   - **When** they exit mid-session (via Save & Exit or closing the app)
   - **Then** the current step index and session state are persisted to the server
   - **And** the session data is cached in IndexedDB for fast retrieval
   - **And** the session status remains `'in_progress'`

2. **Resume from Overview (Cache-First Load)**
   - **Given** the user returns to the Scripture Reading overview
   - **When** an incomplete Solo session exists
   - **Then** the overview shows "Continue where you left off? (Step X of 17)"
   - **And** tapping "Continue" loads the session from cache immediately, then fetches fresh from server
   - **And** tapping "Start fresh" clears the saved state and begins a new session

3. **Optimistic Step Advancement**
   - **Given** the user is in a Solo session with network connectivity
   - **When** they advance through steps
   - **Then** step advancement appears instant (optimistic UI)
   - **And** the server is updated in the background
   - **And** IndexedDB cache is updated on successful server response

4. **Offline Indicator & Blocked Advancement**
   - **Given** the user is viewing a previously cached session
   - **When** they are offline
   - **Then** cached data is displayed with an "Offline" indicator
   - **And** step advancement is blocked until connectivity returns
   - **And** no data is lost

5. **IndexedDB Corruption Recovery**
   - **Given** an IndexedDB corruption occurs
   - **When** a read or write operation fails
   - **Then** the cache is cleared automatically
   - **And** data is refetched from the server
   - **And** the user sees no error (graceful recovery)

6. **Server Write Failure — Retry UI**
   - **Given** a server write fails (network error)
   - **When** the user advanced a step optimistically
   - **Then** retry UI is shown (subtle, non-blocking)
   - **And** the local state is not rolled back until retry is exhausted

## Tasks / Subtasks

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

## Dev Notes

## Implementation Status — What Exists vs What's New

Story 1.4 builds on substantial infrastructure from Stories 1.1-1.3. Much of the "plumbing" exists; this story adds resilience, offline handling, and retry logic.

| Capability | Status | Gap |
|-----------|--------|-----|
| `saveAndExit` (persist + clear state) | ✅ Done (Story 1.3) | None — works correctly |
| `advanceStep` (optimistic increment + server persist) | ✅ Done (Story 1.3) | Need retry on failure |
| `loadSession` (cache-first + `onRefresh` callback) | ✅ Done (Story 1.1) | Verify e2e, add corruption guard |
| `checkForActiveSession` (find incomplete solo sessions) | ✅ Done (Story 1.2) | Verify corruption resilience |
| Resume prompt in ScriptureOverview | ✅ Done (Story 1.2) | Harden "Start fresh" to server-abandon |
| IndexedDB corruption recovery methods | ✅ Done (Story 1.1) | Wire into UI flows |
| Auto-save on visibility change | ❌ New | Create `useAutoSave` hook |
| `saveSession` (persist without clearing) | ❌ New | Add to slice |
| `abandonSession` (server-side abandon) | ❌ New | Add to slice |
| Offline detection | ❌ New | Create `useNetworkStatus` hook |
| Offline indicator UI | ❌ New | Add to SoloReadingFlow |
| Step blocking when offline | ❌ New | Add to SoloReadingFlow |
| Retry UI for failed writes | ❌ New | Add `pendingRetry` state + UI |
| Auto-retry on reconnect | ❌ New | Wire in SoloReadingFlow |

## Key Architecture Decisions

**1. Auto-Save Strategy: `visibilitychange` + `beforeunload`**

`visibilitychange` is the primary signal — it fires reliably on:
- Tab switch (mobile: home button, app switcher)
- Screen lock
- Switching to another app on mobile

`beforeunload` is the backup — fires on tab close/refresh but is unreliable on mobile. Both are fire-and-forget (no guarantee the save completes, but IndexedDB cache preserves the local state regardless).

**2. Offline: Block Advancement, Don't Queue**

Per PRD: "Offline resilience: Cached data viewable; writes require connectivity." We block step advancement when offline rather than queuing writes. This avoids complex offline-first sync and aligns with the server-as-source-of-truth pattern.

**3. Retry: Finite Attempts, No Rollback**

Per AC#6: "local state is not rolled back until retry is exhausted." Even after max retries, we don't roll back — the user's optimistic state is preserved. The worst case is the server is behind by 1 step, which auto-reconciles on next successful `advanceStep` or `saveSession`.

**4. "Start Fresh" = Server Abandon**

Story 1.2 left "Start fresh" clearing only local state. Story 1.4 fixes this: "Start fresh" marks the server session as `abandoned` so it never resurfaces in the resume prompt.

## Source Files to Touch

| File | Action | Notes |
|------|--------|-------|
| `src/hooks/useAutoSave.ts` | **CREATE** | Auto-save hook for visibility/beforeunload |
| `src/hooks/useNetworkStatus.ts` | **CREATE** | Online/offline detection hook |
| `src/stores/slices/scriptureReadingSlice.ts` | **MODIFY** | Add `saveSession`, `abandonSession`, `retryFailedWrite`, `pendingRetry` state |
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | **MODIFY** | Wire useAutoSave, useNetworkStatus, offline indicator, retry UI |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | **MODIFY** | Wire useNetworkStatus, offline-disable Start, fix "Start fresh" |
| `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` | **MODIFY** | Add offline + retry tests |
| `src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx` | **MODIFY** | Add abandon + offline tests |
| `tests/unit/hooks/useAutoSave.test.ts` | **CREATE** | Hook tests |
| `tests/unit/hooks/useNetworkStatus.test.ts` | **CREATE** | Hook tests |
| `tests/unit/stores/scriptureReadingSlice.test.ts` | **MODIFY** | Add saveSession, abandonSession, retryFailedWrite tests |

## Existing Patterns to Follow

**Zustand Slice Pattern (from `scriptureReadingSlice.ts`):**
```typescript
// Add to ScriptureReadingState:
pendingRetry: {
  type: 'advanceStep' | 'saveSession';
  attempts: number;
  maxAttempts: number;
} | null;

// Add to ScriptureSlice:
saveSession: () => Promise<void>;
abandonSession: (sessionId: string) => Promise<void>;
retryFailedWrite: () => Promise<void>;
```

**Service Cache Pattern (from `scriptureReadingService.ts`):**
```
READ:  IndexedDB cache → return cached → fetch fresh from server → update cache (onRefresh callback)
WRITE: POST to Supabase → on success → update IndexedDB → on failure → throw ScriptureError
CORRUPTION: try cache op → catch → recoverXxxCache() → fall back to server
```

**Error Handling Pattern (from `scriptureReadingService.ts`):**
```typescript
// All server errors create ScriptureError with proper code:
const scriptureErr = createScriptureError(
  ScriptureErrorCode.SYNC_FAILED,
  `Failed to save: ${error.message}`,
  error
);
handleScriptureError(scriptureErr);
throw scriptureErr;

// In slice: catch and set state
catch (error) {
  const scriptureError: ScriptureError = isScriptureError(error)
    ? error
    : { code: ScriptureErrorCode.SYNC_FAILED, message: '...', details: error };
  handleScriptureError(scriptureError);
  set({ scriptureError, isSyncing: false });
}
```

**Hook Pattern (follow existing hooks like `useAutoSave`):**
```typescript
export function useAutoSave({ session, saveSession }: UseAutoSaveOptions): void {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && session?.status === 'in_progress') {
        void saveSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, saveSession]);
}
```

**Component Styling (Lavender Dreams theme):**
```typescript
// Offline banner
className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm"

// Retry banner
className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between"

// Error banner (existing)
className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm"
```

## Zustand State Changes (Comprehensive)

The `ScriptureReadingState` interface will expand:

```typescript
export interface ScriptureReadingState {
  // Existing (unchanged)
  session: ScriptureSession | null;
  scriptureLoading: boolean;
  isInitialized: boolean;
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;
  scriptureError: ScriptureError | null;
  activeSession: ScriptureSession | null;
  isCheckingSession: boolean;

  // New (Story 1.4)
  pendingRetry: {
    type: 'advanceStep' | 'saveSession';
    attempts: number;
    maxAttempts: number;
  } | null;
}

export interface ScriptureSlice extends ScriptureReadingState {
  // Existing (unchanged)
  createSession: (mode: SessionMode, partnerId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  exitSession: () => void;
  updatePhase: (phase: SessionPhase) => void;
  clearScriptureError: () => void;
  checkForActiveSession: () => Promise<void>;
  clearActiveSession: () => void;
  advanceStep: () => Promise<void>;
  saveAndExit: () => Promise<void>;

  // New (Story 1.4)
  saveSession: () => Promise<void>;
  abandonSession: (sessionId: string) => Promise<void>;
  retryFailedWrite: () => Promise<void>;
}
```

## Offline Banner Component Spec

```tsx
{/* Offline indicator (AC #4) */}
{!isOnline && (
  <div
    className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm flex items-center gap-2"
    data-testid="offline-indicator"
    role="status"
    aria-live="polite"
  >
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
      {/* Diagonal line through = wifi-off */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
    <span>You're offline. Cached data shown. Connect to continue.</span>
  </div>
)}
```

## Retry Banner Component Spec

```tsx
{/* Retry UI (AC #6) */}
{pendingRetry && (
  <div
    className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between"
    data-testid="retry-banner"
  >
    <span className="text-amber-700 text-sm">
      {pendingRetry.attempts >= pendingRetry.maxAttempts
        ? 'Save failed. Your progress is saved locally.'
        : 'Save failed. Tap to retry.'}
    </span>
    {pendingRetry.attempts < pendingRetry.maxAttempts && (
      <button
        onClick={retryFailedWrite}
        className="text-amber-800 font-medium text-sm hover:text-amber-900 min-w-[44px] min-h-[44px] flex items-center justify-center"
        data-testid="retry-button"
        type="button"
      >
        Retry ({pendingRetry.attempts}/{pendingRetry.maxAttempts})
      </button>
    )}
  </div>
)}
```

## Testing Strategy

**Unit Test Coverage Targets:**

| Area | Test Count (est.) | Priority |
|------|-------------------|----------|
| `useAutoSave` hook | 5 tests | P0 |
| `useNetworkStatus` hook | 5 tests | P0 |
| Slice: `saveSession` | 3 tests | P0 |
| Slice: `abandonSession` | 3 tests | P0 |
| Slice: `retryFailedWrite` | 5 tests | P0 |
| Slice: `advanceStep` retry integration | 3 tests | P0 |
| SoloReadingFlow: offline UI | 5 tests | P0 |
| SoloReadingFlow: retry UI | 4 tests | P1 |
| ScriptureOverview: abandon + offline | 4 tests | P1 |
| Corruption recovery e2e | 3 tests | P1 |
| **Total** | **~40 tests** | |

**Mock Strategy for Hooks:**

```typescript
// useNetworkStatus mock
const mockNavigatorOnLine = vi.spyOn(navigator, 'onLine', 'get');
mockNavigatorOnLine.mockReturnValue(false); // simulate offline

// For event listeners, use addEventListener spy or direct dispatch:
window.dispatchEvent(new Event('offline'));
window.dispatchEvent(new Event('online'));

// useAutoSave mock
// Simulate visibilitychange:
Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
document.dispatchEvent(new Event('visibilitychange'));
```

**Mock Strategy for Slice Tests:**

```typescript
// Mock service for retry tests
vi.mock('../../services/scriptureReadingService', () => ({
  scriptureReadingService: {
    updateSession: vi.fn().mockRejectedValueOnce(new Error('Network error'))
                          .mockResolvedValueOnce(undefined), // retry succeeds
    // ...
  },
}));
```

## Architecture Compliance Checklist

- [ ] **Container/Presentational:** Hooks (`useAutoSave`, `useNetworkStatus`) are pure React hooks — no store access inside. SoloReadingFlow (container) uses them and passes context.
- [ ] **Zustand Selector Pattern:** New state fields (`pendingRetry`) accessed via object selector, never bare `useAppStore()`.
- [ ] **Error Handling:** All server errors use `ScriptureErrorCode` enum + `handleScriptureError()`. No silent swallowing.
- [ ] **No `any`:** Use `unknown` for error catches. `pendingRetry` typed with literal union for `type`.
- [ ] **No React Router:** No routing changes needed.
- [ ] **Pure Client SPA:** No `"use client"` or `"use server"` directives.
- [ ] **Touch Targets:** Retry button meets 44x44px minimum. Offline indicator is informational only.
- [ ] **Accessibility:** Offline banner has `role="status"` + `aria-live="polite"`. Retry button has clear text label.
- [ ] **Reduced Motion:** No new animations added (offline/retry banners are static).

## Technology Versions (Locked)

| Technology | Version | Notes |
|-----------|---------|-------|
| React | 19.2.3 | Hooks only |
| TypeScript | 5.9.3 | Strict mode |
| Zustand | 5.0.10 | Slice composition |
| Framer Motion | 12.27.1 | Existing — no new usage needed |
| Vitest | 4.0.17 | Unit tests |
| Testing Library | 16.3.2 | Component tests |
| Tailwind CSS | 4.1.17 | Amber + purple theme tokens |

## Project Structure Notes

New files follow existing conventions:
- `src/hooks/useAutoSave.ts` — custom hook (new hooks directory may need creation)
- `src/hooks/useNetworkStatus.ts` — custom hook
- Tests in `tests/unit/hooks/` matching src structure
- Check if `src/hooks/` already exists; if not, create it (the `useMotionConfig` hook from Story 1.5 is planned for `src/components/scripture-reading/useMotionConfig.ts` but general hooks go in `src/hooks/`)

## Validation Gates (Before Marking Complete)

1. **TypeScript:** `npx tsc --noEmit` — zero errors
2. **Unit tests:** `npx vitest run` — all pass, zero regressions
3. **New test count:** ≥35 new tests covering all 6 ACs
4. **Visual verification:** Offline indicator + retry banner render correctly
5. **Manual E2E:** Turn off network → see offline indicator → turn on → indicator disappears → step advancement works
6. **Manual E2E:** Close tab mid-session → reopen → resume prompt appears at correct step

## Functional Requirements Traceability

| AC | PRD Requirement | User Journey |
|----|----------------|--------------|
| #1 Save on exit | FR12 (save progress), FR13 (optimistic UI) | Journey 5: Time-Constrained |
| #2 Resume | FR6 (resume incomplete), FR13 (cache performance) | Journey 5: Time-Constrained |
| #3 Optimistic UI | FR13 (changes appear instant), NFR-P2 (<200ms perceived) | Journey 2: Solo — Quiet Reset |
| #4 Offline | NFR-R4 (cache integrity), NFR-R5 (graceful degradation) | PRD: Offline Behavior — Solo Mode |
| #5 Corruption | NFR-R4 (cache integrity), Architecture Decision 4 | Architecture: Caching Architecture |
| #6 Retry | NFR-R2 (data sync reliability), FR13 (eventual connectivity) | Journey 6: Reconnection |

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-solo-scripture-reading.md#Story 1.4]
- [Source: _bmad-output/planning-artifacts/prd.md#Solo Mode Flow — FR6, FR12, FR13]
- [Source: _bmad-output/planning-artifacts/prd.md#Offline Behavior — Solo Mode]
- [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements — NFR-P2, NFR-R2, NFR-R4, NFR-R5]
- [Source: _bmad-output/planning-artifacts/prd.md#User Journeys — Journey 2 (Solo), Journey 5 (Time-Constrained), Journey 6 (Reconnection)]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 4: Caching Architecture]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Format Patterns — Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Loading State Naming]
- [Source: _bmad-output/implementation-artifacts/1-1-database-schema-and-backend-infrastructure.md#Cache Pattern]
- [Source: _bmad-output/implementation-artifacts/1-2-navigation-and-overview-page.md#Session Detection for Resume Prompt]
- [Source: _bmad-output/implementation-artifacts/1-3-solo-reading-flow.md#Slice Actions — advanceStep, saveAndExit]
- [Source: src/services/scriptureReadingService.ts — cache-first reads, write-through writes, corruption recovery]
- [Source: src/stores/slices/scriptureReadingSlice.ts — advanceStep, saveAndExit, checkForActiveSession]
- [Source: src/components/scripture-reading/containers/SoloReadingFlow.tsx — reading flow UI]
- [Source: src/components/scripture-reading/containers/ScriptureOverview.tsx — resume prompt, session routing]
- [Source: src/services/dbSchema.ts — IndexedDB schema, ScriptureSession type]

## Dev Agent Record

## Agent Model Used

## Debug Log References

## Completion Notes List

## File List

