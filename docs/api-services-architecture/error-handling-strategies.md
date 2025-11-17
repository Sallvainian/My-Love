# Error Handling Strategies

## API Layer Error Handling

**Three-Level Error Stack**:

```
1. Zod Validation Error
   └─ Data from server doesn't match schema
   └─ Throw ApiValidationError with schema errors

2. PostgreSQL Error (via Postgrest)
   └─ Database constraint, RLS policy, syntax error
   └─ Transform to SupabaseServiceError with user-friendly message

3. Network Error
   └─ Device offline, fetch timeout, no response
   └─ Throw SupabaseServiceError with isNetworkError=true
```

## Service Layer Error Handling

**Read Operations**:

```typescript
async getAll(): Promise<T[]> {
  try {
    return await db.getAll(storeName);
  } catch (error) {
    console.error('Error:', error);
    return [];  // Graceful fallback - empty array
  }
}
```

**Write Operations**:

```typescript
async update(id: number, updates: Partial<T>): Promise<void> {
  try {
    await db.put(storeName, { ...existing, ...updates });
  } catch (error) {
    console.error('Error:', error);
    throw error;  // Explicit failure - prevents silent data loss
  }
}
```

## Offline-First Error Messages

```typescript
// Network error message
"You're offline. Your changes will be synced automatically when you're back online.";

// Retry message
'Sync attempt 1 failed, retrying in 1000ms...';

// Permanent failure
'Failed to sync mood after 4 attempts. Please try again later.';
```

---
