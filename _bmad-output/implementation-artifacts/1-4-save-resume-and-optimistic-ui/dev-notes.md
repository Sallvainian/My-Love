# Dev Notes

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
