# 3. Error Handling Utilities

**Source:** `src/api/errorHandlers.ts`

## Overview

Centralized error handling for all Supabase API interactions. Provides error detection, transformation to user-friendly messages, retry logic with exponential backoff, and graceful offline degradation.

## SupabaseServiceError Class

```typescript
class SupabaseServiceError extends Error {
  public readonly code: string | undefined;
  public readonly details: string | undefined;
  public readonly hint: string | undefined;
  public readonly isNetworkError: boolean;
}
```

Custom error class thrown by all API services. The `isNetworkError` flag distinguishes between database errors and connectivity issues.

## Error Code Mapping

`handleSupabaseError()` maps PostgrestError codes to user-friendly messages:

| Error Code | User Message |
|-----------|-------------|
| `23505` | This record already exists |
| `23503` | Referenced record not found |
| `23502` | Required field is missing |
| `42501` | Permission denied - check Row Level Security policies |
| `42P01` | Table not found - database schema may be out of sync |
| `PGRST116` | No rows found |
| `PGRST301` | Invalid request parameters |
| *(other)* | Database error: `{original message}` |

## Functions

### `isOnline(): boolean`

```typescript
export const isOnline = (): boolean => navigator.onLine;
```

Network connectivity check. Used by all API methods before attempting Supabase calls.

### `handleSupabaseError(error: PostgrestError, context?: string): SupabaseServiceError`

Transforms a `PostgrestError` into a `SupabaseServiceError` with a user-friendly message. The optional `context` string is prepended as a prefix (e.g., `[MoodApi.create] This record already exists`).

### `handleNetworkError(error: unknown, context?: string): SupabaseServiceError`

Creates a `SupabaseServiceError` with `isNetworkError: true` and the message pattern:
`[context] Network error: {message}. Your changes will be synced when you're back online.`

### `isPostgrestError(error: unknown): error is PostgrestError`

Type guard that checks for the presence of `code`, `message`, and `details` properties.

### `isSupabaseServiceError(error: unknown): error is SupabaseServiceError`

Type guard using `instanceof SupabaseServiceError`.

### `logSupabaseError(context: string, error: unknown): void`

Structured console logging. Detection order:
1. `SupabaseServiceError` -- logs message, code, isNetworkError
2. `PostgrestError` -- logs code, message, details, hint
3. `Error` -- logs message
4. Fallback -- logs raw value

### `retryWithBackoff<T>(operation: () => Promise<T>, config?: RetryConfig): Promise<T>`

Generic exponential backoff retry for any async operation.

**Algorithm:**
1. Execute `operation()`
2. On failure, wait `delay` ms then retry
3. Increase delay by `backoffMultiplier`, capped at `maxDelayMs`
4. After `maxAttempts` failures, throw the last error

### RetryConfig Interface

```typescript
interface RetryConfig {
  maxAttempts: number;       // Default: 3
  initialDelayMs: number;    // Default: 1000
  maxDelayMs: number;        // Default: 30000
  backoffMultiplier: number; // Default: 2
}
```

**Default schedule:** 1s, 2s, 4s (capped at 30s).

### `createOfflineMessage(operation: string): string`

Returns: `"You're offline. {operation} will sync automatically when you're back online."`

## Usage Pattern

Every API service follows this error handling pattern:

```typescript
try {
  const { data, error } = await supabase.from('table').select('*');
  if (error) throw error;
  return data;
} catch (error) {
  logSupabaseError('ServiceName.method', error);
  if (isPostgrestError(error)) {
    throw handleSupabaseError(error, 'ServiceName.method');
  }
  throw handleNetworkError(error, 'ServiceName.method');
}
```
