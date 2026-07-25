# 3. Error Handling Utilities

**Sources:**

- `src/api/errorHandlers.ts` -- Supabase/Postgrest error mapping and network-error wrapping
- `src/utils/offlineErrorHandler.ts` -- Offline detection, `OfflineError` class

## SupabaseServiceError (internal)

Error class wrapping `PostgrestError` with user-friendly messages.

```typescript
class SupabaseServiceError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly hint: string | undefined;
  readonly isNetworkError: boolean;
}
```

> **Not exported.** The class is module-private to `errorHandlers.ts`. Callers receive instances from `handleSupabaseError()` / `handleNetworkError()` and can read `.code` / `.isNetworkError` off the value, but cannot import the class or `instanceof`-check it from another module. Narrow on shape (or on `isPostgrestError()`) instead.

### Error Code Mapping

| Postgres Code | User Message                                |
| ------------- | ------------------------------------------- |
| `23505`       | This record already exists                  |
| `23503`       | Referenced record not found                 |
| `23502`       | Required field is missing                   |
| `42501`       | Permission denied - check RLS policies      |
| `42P01`       | Table not found - schema may be out of sync |
| `PGRST116`    | No rows found                               |
| `PGRST301`    | Invalid request parameters                  |

Any unmapped code falls through to `` `Database error: ${error.message}` ``.

## Exported Functions

The complete public surface of `errorHandlers.ts` is five functions:

### `isOnline(): boolean`

Returns `navigator.onLine`.

### `handleSupabaseError(error: PostgrestError, context?: string): SupabaseServiceError`

Maps PostgrestError codes to user-friendly messages. `context` is prefixed as `[context] `.

### `handleNetworkError(error: unknown, context?: string): SupabaseServiceError`

Wraps any error as a network error with `code: 'NETWORK_ERROR'`, `isNetworkError: true`, and the hint `"Check your internet connection"`. Message reads: `"{context} Network error: {message}. Your changes will be synced when you're back online."`

### `isPostgrestError(error): error is PostgrestError`

Type guard checking for `code`, `message`, and `details` properties.

### `logSupabaseError(context: string, error: unknown): void`

Logs structured error info. Checks `SupabaseServiceError` first (more specific -- has `isNetworkError`), then `PostgrestError`, then generic `Error`, then falls back to raw value.

> **Removed since the 2026-03 scan:** `retryWithBackoff()`, `createOfflineMessage()`, and the exported `isSupabaseServiceError()` type guard no longer exist in this module. Retry logic now lives where it is used -- see `MoodSyncService.syncMoodWithRetry()` (private, 3 retries at 1s/2s/4s) in [Mood Sync Service](./5-mood-sync-service.md), and the `pendingRetry` state machine in the [Scripture Reading Slice](../state-management/scripture-reading-slice.md).

## Scripture Error Handling (`src/services/scriptureReadingService.ts`)

Scripture Reading uses its own typed error channel rather than `SupabaseServiceError`.

```typescript
export enum ScriptureErrorCode {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SYNC_FAILED = 'SYNC_FAILED',
  OFFLINE = 'OFFLINE',
  CACHE_CORRUPTED = 'CACHE_CORRUPTED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

export interface ScriptureError {
  code: ScriptureErrorCode;
  message: string;
  details?: unknown;
}

export function handleScriptureError(error: ScriptureError): void;
```

`handleScriptureError()` switches on the code and emits an appropriate `console.warn` / `console.error`. Every scripture catch block must either call it or re-throw -- empty catch blocks are prohibited in scripture code.

## Offline Error Handler (`src/utils/offlineErrorHandler.ts`)

### `OfflineError` class

Extends `Error` with `isRetryable: true` and `operation: string`.

### Exported functions

| Export                             | Description                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `OfflineError`                     | Error class for offline-blocked operations                                                                        |
| `isOfflineError(error)`            | Type guard (`instanceof OfflineError`)                                                                            |
| `isOnline()`                       | `navigator.onLine`                                                                                                |
| `isOffline()`                      | `!navigator.onLine`                                                                                               |
| `createOfflineErrorHandler(onRetry)` | Builds an `OfflineErrorResult` with a retry callback for UI consumption                                         |
| `withOfflineCheck(operation, fn)`  | Checks `navigator.onLine` before executing; throws `OfflineError` if offline                                       |
| `safeOfflineOperation(operation, fn)` | Non-throwing wrapper returning a discriminated union: `{ success, data }` \| `{ offline, message, retry }` \| `{ error, message }` |

### Constants

- `OFFLINE_ERROR_MESSAGE`: "You're offline. Changes will sync when reconnected."
- `OFFLINE_RETRY_MESSAGE`: "You're offline. Please check your connection and try again."
