# 7. Error Handling

**Module:** `src/api/errorHandlers.ts`

## Error Classes

### `SupabaseServiceError`

```typescript
class SupabaseServiceError extends Error {
  public readonly code: string | undefined;
  public readonly details: string | undefined;
  public readonly hint: string | undefined;
  public readonly isNetworkError: boolean;
}
```

Structured error used across all API modules. Carries Postgres error codes and a `isNetworkError` flag for UI differentiation.

## Utility Functions

### `isOnline()`

```typescript
const isOnline = (): boolean
```

Checks `navigator.onLine`. Called before every API operation.

---

### `handleSupabaseError(error, context?)`

```typescript
const handleSupabaseError = (error: PostgrestError, context?: string): SupabaseServiceError
```

Maps Postgres error codes to user-friendly messages:

| Code | Message |
|---|---|
| `23505` | This record already exists |
| `23503` | Referenced record not found |
| `23502` | Required field is missing |
| `42501` | Permission denied -- check Row Level Security policies |
| `42P01` | Table not found -- database schema may be out of sync |
| `PGRST116` | No rows found |
| `PGRST301` | Invalid request parameters |

---

### `handleNetworkError(error, context?)`

```typescript
const handleNetworkError = (error: unknown, context?: string): SupabaseServiceError
```

Wraps any error as a `SupabaseServiceError` with `isNetworkError: true` and a user-facing message that mentions automatic sync.

---

### `isPostgrestError(error)`

```typescript
const isPostgrestError = (error: unknown): error is PostgrestError
```

Type guard checking for `code`, `message`, and `details` properties.

---

### `isSupabaseServiceError(error)`

```typescript
const isSupabaseServiceError = (error: unknown): error is SupabaseServiceError
```

Type guard using `instanceof`.

---

### `logSupabaseError(context, error)`

```typescript
const logSupabaseError = (context: string, error: unknown): void
```

Logs structured error info to console with context prefix. Handles `SupabaseServiceError`, `PostgrestError`, and generic errors.

---

### `retryWithBackoff(operation, config?)`

```typescript
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  config?: RetryConfig
): Promise<T>
```

Generic retry with exponential backoff.

**Default config (`DEFAULT_RETRY_CONFIG`):**

| Parameter | Value |
|---|---|
| `maxAttempts` | 3 |
| `initialDelayMs` | 1000 |
| `maxDelayMs` | 30000 |
| `backoffMultiplier` | 2 |

---

### `createOfflineMessage(operation)`

```typescript
const createOfflineMessage = (operation: string): string
```

Returns: `"You're offline. {operation} will sync automatically when you're back online."`

---
