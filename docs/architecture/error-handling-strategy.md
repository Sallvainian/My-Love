# Error Handling Strategy

## Two-Level Error Boundary System

### Level 1: `ErrorBoundary` (Top-Level)

Wraps entire app phases (login, display name setup, welcome splash, admin). Shows a full-page error with recovery options.

**Location:** `src/components/ErrorBoundary/ErrorBoundary.tsx`

Used for:
```typescript
<ErrorBoundary><LoginScreen /></ErrorBoundary>
<ErrorBoundary><DisplayNameSetup /></ErrorBoundary>
<ErrorBoundary><WelcomeSplash /></ErrorBoundary>
<ErrorBoundary><AdminPanel /></ErrorBoundary>
```

### Level 2: `ViewErrorBoundary` (Per-View)

Wraps only the content area inside `<main>`. Keeps `BottomNavigation` visible so users can navigate away from a crashed view.

**Location:** `src/components/ViewErrorBoundary/`

```typescript
<ViewErrorBoundary viewName={currentView} onNavigateHome={() => setView('home')}>
  <Suspense fallback={<LoadingSpinner />}>
    {currentView === 'photos' && <PhotoGallery />}
    {currentView === 'mood' && <MoodTracker />}
    {currentView === 'partner' && <PartnerMoodView />}
    {currentView === 'notes' && <LoveNotes />}
    {currentView === 'scripture' && <ScriptureOverview />}
  </Suspense>
</ViewErrorBoundary>
```

Key behaviors:
- Resets its error state when `viewName` changes (user navigates away and back)
- Provides a "Go Home" button via the `onNavigateHome` callback
- Does not wrap the home view (home renders inline, outside the boundary)

## Offline Error Handling

### `OfflineError` Class (`src/utils/offlineErrorHandler.ts`)

```typescript
export class OfflineError extends Error {
  readonly name = 'OfflineError';
  readonly isRetryable = true;
  readonly operation: string;
}
```

### Guard Functions

| Function | Behavior | Use Case |
|---|---|---|
| `withOfflineCheck(op, fn)` | Throws `OfflineError` if offline, else executes `fn` | Store actions that require network |
| `safeOfflineOperation(op, fn)` | Returns result object (no throw) | UI components needing graceful handling |
| `isOfflineError(error)` | Type guard | Catch blocks |

### Result Pattern

`safeOfflineOperation` returns a discriminated union:

```typescript
type Result<T> =
  | { success: true; data: T; offline: false }
  | { success: false; offline: true; message: string; retry: () => Promise<T> }
  | { success: false; offline: false; error: Error; message: string };
```

This enables UI components to handle offline, success, and error states without try/catch.

## Store-Level Error Handling

### App Slice Errors

The `appSlice` provides global error state:

```typescript
interface AppSlice {
  isLoading: boolean;
  error: string | null;
  __isHydrated: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
```

### Per-Feature Error State

Each feature slice manages its own error state:

| Slice | Error Field | Usage |
|---|---|---|
| `notesSlice` | `notesError: string \| null` | Failed note fetch/send |
| `photosSlice` | `uploadError: string \| null` | Failed photo upload |
| `moodSlice` | `syncStatus.error` | Sync failures |
| `partnerSlice` | `partnerError: string \| null` | Partner request failures |
| `scriptureReadingSlice` | `scriptureError: string \| null` | Session CRUD failures |

## Optimistic Update Error Handling

### Love Notes

Failed sends are marked with `error: true` and retain their `tempId` for retry:

```typescript
// On send failure
set((state) => ({
  notes: state.notes.map((note) =>
    note.tempId === tempId
      ? { ...note, sending: false, imageUploading: false, error: true }
      : note
  ),
}));
```

Retry uses the cached `imageBlob` to avoid re-compression:

```typescript
retryFailedMessage: async (tempId: string) => {
  const failedNote = notes.find((note) => note.tempId === tempId);
  if (failedNote?.imageBlob) {
    // Re-upload using cached blob (no re-compression)
    const uploadResult = await uploadCompressedBlob(failedNote.imageBlob, userId);
  }
};
```

### Scripture Sessions

Failed writes track retry attempts with a maximum of 3:

```typescript
interface ScriptureReadingSlice {
  pendingRetry: { stepIndex: number; data: unknown; attempts: number } | null;
  retryFailedWrite: () => Promise<void>;
}
```

## Service Worker Error Handling

### Background Sync Retry

If all moods fail to sync, the SW throws to trigger the Background Sync API's built-in retry:

```typescript
if (successCount === 0 && failCount > 0) {
  throw new Error(`All ${failCount} moods failed to sync`);
}
```

### Token Expiry

The SW gracefully handles expired tokens by skipping the sync (no throw):

```typescript
if (authToken.expiresAt && authToken.expiresAt < now + 300) {
  return; // App will refresh token on next open
}
```

### Client Notification

After sync completes, the SW notifies open app windows:

```typescript
const clients = await self.clients.matchAll({ type: 'window' });
for (const client of clients) {
  client.postMessage({
    type: 'BACKGROUND_SYNC_COMPLETED',
    successCount,
    failCount,
  });
}
```

## Realtime Subscription Errors

### Exponential Backoff

The `useRealtimeMessages` hook retries failed subscriptions:

```typescript
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

const delay = Math.min(
  RETRY_CONFIG.baseDelay * Math.pow(2, retryCountRef.current),
  RETRY_CONFIG.maxDelay
);
```

### Non-Fatal Broadcast Failures

Broadcast failures in `sendNote` are non-fatal (message is already saved):

```typescript
try {
  // ... broadcast to partner
} catch (broadcastError) {
  console.warn('[NotesSlice] Broadcast failed (non-fatal):', broadcastError);
}
```

## Rate Limiting Errors

Love Notes enforces a 10-message-per-minute limit:

```typescript
if (recentTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
  throw new Error('Rate limit exceeded: Maximum 10 messages per minute');
}
```

Rate limit errors are propagated to the UI for user feedback.

## Hydration Error Recovery

If localStorage state is corrupted, the store clears it and uses defaults:

```typescript
onRehydrateStorage: () => (state, error) => {
  if (error) {
    localStorage.removeItem('my-love-storage');
    return; // Use initial state defaults
  }
  // ... validate and deserialize
};
```

Map deserialization errors in `messageHistory.shownMessages` fall back to an empty `Map`:

```typescript
} catch (deserializationError) {
  state.messageHistory.shownMessages = new Map();
}
```

## Auth Error Handling

All auth operations return structured results:

```typescript
interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}
```

Sign-in, sign-up, and sign-out catch unexpected errors and wrap them as `AuthError`:

```typescript
} catch (err) {
  return { user: null, session: null, error: err as AuthError };
}
```

## Error Logging Strategy

All error handling includes structured console logging:

- `[AuthService]` prefix for auth errors
- `[NotesSlice]` prefix for notes errors
- `[ServiceWorker]` prefix for SW errors
- `[useRealtimeMessages]` prefix for realtime errors
- `[Zustand Persist]` prefix for hydration errors

Development-only logs use `import.meta.env.DEV` guards to keep production console clean.
