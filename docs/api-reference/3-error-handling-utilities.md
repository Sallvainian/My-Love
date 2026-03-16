# 3. Error Handling Utilities

**Sources:**

- `src/api/errorHandlers.ts` -- Supabase error handling, retry logic
- `src/utils/offlineErrorHandler.ts` -- Offline detection, OfflineError class

## SupabaseServiceError

Custom error class wrapping PostgrestError with user-friendly messages.

```typescript
class SupabaseServiceError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly hint: string | undefined;
  readonly isNetworkError: boolean;
}
```

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

## Functions

### `isOnline(): boolean`

Returns `navigator.onLine`.

### `handleSupabaseError(error: PostgrestError, context?: string): SupabaseServiceError`

Maps PostgrestError codes to user-friendly messages.

### `handleNetworkError(error: unknown, context?: string): SupabaseServiceError`

Wraps any error as network error with `isNetworkError: true` and hint text.

### `isPostgrestError(error): error is PostgrestError`

Type guard checking for `code`, `message`, `details` properties.

### `isSupabaseServiceError(error): error is SupabaseServiceError`

Type guard using `instanceof`.

### `logSupabaseError(context: string, error: unknown): void`

Logs structured error info. Checks SupabaseServiceError first (more specific), then PostgrestError, then generic Error.

### `retryWithBackoff<T>(operation, config?): Promise<T>`

Exponential backoff retry. Default config: 3 attempts, 1s/2s/4s delays, 30s max delay, 2x multiplier.

```typescript
interface RetryConfig {
  maxAttempts: number; // default: 3
  initialDelayMs: number; // default: 1000
  maxDelayMs: number; // default: 30000
  backoffMultiplier: number; // default: 2
}
```

### `createOfflineMessage(operation: string): string`

Returns: `"You're offline. {operation} will sync automatically when you're back online."`

## Offline Error Handler (`src/utils/offlineErrorHandler.ts`)

### `OfflineError` class

Extends `Error` with `isRetryable: true` and `operation: string`.

### `withOfflineCheck<T>(operation, asyncFn): Promise<T>`

Checks `navigator.onLine` before executing; throws `OfflineError` if offline.

### `safeOfflineOperation<T>(operation, asyncFn)`

Non-throwing wrapper. Returns discriminated union: `{ success, data }` | `{ offline, message, retry }` | `{ error, message }`.

### Constants

- `OFFLINE_ERROR_MESSAGE`: "You're offline. Changes will sync when reconnected."
- `OFFLINE_RETRY_MESSAGE`: "You're offline. Please check your connection and try again."
