# 3. Error Handling Utilities

**Source:** `src/api/errorHandlers.ts`

## Overview

Provides error detection, transformation, retry logic, and offline messaging for Supabase API failures. All Supabase-facing services use these utilities to produce consistent, user-friendly errors.

## Error Classes

### `SupabaseServiceError`

```typescript
class SupabaseServiceError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly hint: string | undefined;
  readonly isNetworkError: boolean;
}
```

Custom error class wrapping PostgreSQL/network errors with structured fields for UI display.

## Error Transformation Functions

### `handleSupabaseError(error: PostgrestError, context?: string): SupabaseServiceError`

Maps PostgrestError codes to user-friendly messages:

| Code       | Message                                               |
| ---------- | ----------------------------------------------------- |
| `23505`    | This record already exists                            |
| `23503`    | Referenced record not found                           |
| `23502`    | Required field is missing                             |
| `42501`    | Permission denied - check Row Level Security policies |
| `42P01`    | Table not found - database schema may be out of sync  |
| `PGRST116` | No rows found                                         |
| `PGRST301` | Invalid request parameters                            |

Any unrecognized code falls through to: `Database error: {original message}`.

**Sets** `isNetworkError = false`.

---

### `handleNetworkError(error: unknown, context?: string): SupabaseServiceError`

Wraps fetch failures, timeouts, and other non-PostgrestError errors.

**Sets:**

- `code = 'NETWORK_ERROR'`
- `hint = 'Check your internet connection'`
- `isNetworkError = true`
- Message includes: "Your changes will be synced when you're back online."

## Type Guards

### `isPostgrestError(error: unknown): error is PostgrestError`

Checks for `code`, `message`, and `details` properties.

### `isSupabaseServiceError(error: unknown): error is SupabaseServiceError`

Uses `instanceof` check.

## Logging

### `logSupabaseError(context: string, error: unknown): void`

Logs errors with structured context. Checks error type in order:

1. `SupabaseServiceError` -- logs `message`, `code`, `isNetworkError`
2. `PostgrestError` -- logs `code`, `message`, `details`, `hint`
3. `Error` -- logs `message`
4. Unknown -- logs raw value

## Retry Logic

### `retryWithBackoff<T>(operation: () => Promise<T>, config?: RetryConfig): Promise<T>`

Executes an async operation with exponential backoff retry.

```typescript
interface RetryConfig {
  maxAttempts: number; // Default: 3
  initialDelayMs: number; // Default: 1000 (1s)
  maxDelayMs: number; // Default: 30000 (30s)
  backoffMultiplier: number; // Default: 2
}
```

**Default retry schedule:** 1s, 2s, 4s (3 attempts total).

**Behavior:**

- On success at any attempt, returns the result immediately
- On failure at non-final attempt, waits `delay` ms then retries
- Delay doubles each attempt, capped at `maxDelayMs`
- After all attempts exhausted, throws the last error

## Utility Functions

### `isOnline(): boolean`

Returns `navigator.onLine`. Used by services to check connectivity before attempting API calls.

### `createOfflineMessage(operation: string): string`

Returns: `"You're offline. {operation} will sync automatically when you're back online."`
