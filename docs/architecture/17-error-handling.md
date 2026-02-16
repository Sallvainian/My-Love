# Error Handling

## Error Handling Strategy by Layer

### UI Layer

**ErrorBoundary** (`src/components/ErrorBoundary/ErrorBoundary.tsx`): Wraps the entire application to catch unhandled rendering errors. Displays a fallback UI with retry option.

**ViewErrorBoundary** (`src/components/ViewErrorBoundary/ViewErrorBoundary.tsx`): Wraps individual views. If a single view crashes, other views remain functional.

### State Layer (Zustand Slices)

Slices follow a consistent error handling pattern:

```typescript
// Pattern: Try/catch with user-facing error propagation
try {
  const validated = SettingsSchema.parse(settings);
  set({ settings: validated });
} catch (error) {
  if (isZodError(error)) {
    throw createValidationError(error as ZodError);
  }
  throw error;
}
```

**Validation errors** are caught and re-thrown as `ValidationError` instances with field-specific messages.
**Operational errors** are re-thrown to allow the calling component to handle them.
**Non-critical errors** (sync failures, partner mood fetch) are logged and swallowed for graceful degradation.

### Service Layer (IndexedDB)

`BaseIndexedDBService` follows a split error strategy:

| Operation Type | Error Behavior | Rationale |
|---------------|----------------|-----------|
| Read (`getById`, `getAll`, `getPage`) | Return `null` or `[]` | Graceful degradation; missing data is recoverable |
| Write (`add`, `update`, `delete`) | Throw | Data integrity; silent write failures cause corruption |

### API Layer (Supabase)

API calls use `errorHandlers.ts` for consistent error mapping:

```typescript
// Supabase error codes -> user-friendly messages
const errorMap = {
  'PGRST116': 'Record not found',
  '23505': 'Duplicate entry',
  // ...
};
```

### Offline Errors

The `OfflineError` class (`src/utils/offlineErrorHandler.ts`) provides:

```typescript
export class OfflineError extends Error {
  readonly name = 'OfflineError';
  readonly isRetryable = true;
  readonly operation: string;
}
```

Type guards enable clean error handling:

```typescript
if (isOfflineError(error)) {
  showOfflineRetryPrompt(error.operation);
} else if (isValidationError(error)) {
  showFieldErrors(error.fieldErrors);
}
```

## Validation Error Flow

```
User Input
    |
    v
Zod Schema.parse()  -- throws ZodError on failure
    |
    v
isZodError(error)?
    |-- Yes: createValidationError(error)
    |         |-- formatZodError() -> single string
    |         |-- getFieldErrors() -> Map<field, message>
    |         |-- new ValidationError(message, fieldErrors)
    |
    v
Component catches ValidationError
    |-- error.message -> toast/banner
    |-- error.fieldErrors -> per-field highlights
```

## Error Recovery Patterns

### Retry with Backoff (Realtime)

`useRealtimeMessages.ts` implements exponential backoff:

```
Attempt 1: 1 second delay
Attempt 2: 2 second delay
Attempt 3: 4 second delay
Attempt 4: 8 second delay
Attempt 5: 16 second delay (max 30s)
```

After 5 failed attempts, the connection is marked as failed with no further retries.

### Retry with User Prompt (Scripture)

Scripture write failures set `pendingRetry` state in the slice. The UI displays a retry button:

```typescript
if (state.pendingRetry) {
  <button onClick={() => retryFailedWrite()}>Retry</button>
}
```

### Silent Retry (Background Sync)

Mood sync failures are silently retried via three tiers:
1. Immediate retry on creation
2. Periodic retry every 5 minutes
3. Background Sync API retry when connectivity returns

### Corruption Recovery (Scripture)

`ScriptureReadingService` detects and recovers from IndexedDB corruption:

```typescript
// If cached data fails validation, clear cache and re-fetch from Supabase
try {
  return cachedSession;
} catch {
  await this.delete(sessionId);
  return await fetchFromSupabase(sessionId);
}
```

## Initialization Error Handling

`settingsSlice.initializeApp()` handles critical initialization failures:

1. If Zustand persist hydration fails (`__isHydrated === false`):
   - Sets error state: "Failed to load saved settings"
   - Clears corrupted localStorage
   - Logs warning to refresh page

2. If IndexedDB initialization fails:
   - Sets error state: "Failed to initialize app"
   - App remains in loading/error state

## Related Documentation

- [Validation Layer](./14-validation-layer.md)
- [Offline Strategy](./12-offline-strategy.md)
- [Architecture Patterns](./03-architecture-patterns.md)
