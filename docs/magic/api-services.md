# MAGIC DOC: API & Services Layer
*Architecture reference - not a code walkthrough*

## Purpose
Three-tier data layer: Supabase API (network), IndexedDB services (local), and sync orchestration for offline-first operation.

## Entry Points
- `src/api/supabaseClient.ts` - Singleton client, env config
- `src/api/errorHandlers.ts` - Centralized error handling, retry logic
- `src/api/validation/supabaseSchemas.ts` - Zod schemas for all API responses
- `src/services/BaseIndexedDBService.ts` - Abstract base for local storage

## Architecture Patterns

### Directory Split
| Directory | Responsibility |
|-----------|---------------|
| `src/api/` | Supabase integration, auth, network calls |
| `src/services/` | IndexedDB operations, sync orchestration |

### Validation Pipeline
```
API Response → Zod Schema → Validated Data → Application
                    ↓
            ApiValidationError (if invalid)
```

### Service Inheritance
```typescript
abstract class BaseIndexedDBService<T, DBTypes> {
  // Shared: init(), add(), get(), getAll(), update(), delete(), getPage()
}
// MoodService, PhotoService extend this
```

### Error Handling Categories
1. **PostgrestError** - DB errors, mapped to user-friendly messages
2. **Network errors** - Offline/timeout detection via `isOnline()`
3. **Validation errors** - Zod schema mismatches → `ApiValidationError`

### Retry Strategy
`retryWithBackoff()`: 3 attempts, 1s→2s→4s delays, maxDelay 30s

### Real-Time Pattern (Mood Sync)
Uses Broadcast API (not postgres_changes) - RLS policies prevent direct subscriptions:
```
User A logs mood → moodApi.create() → Broadcast to partner's channel
                                              ↓
User B subscribed to `mood-updates:{userId}` ← receives update
```

## Key Connections
- **Auth tokens**: Stored in IndexedDB `sw-auth` store for Service Worker access
- **Photo storage**: Supabase Storage bucket `photos`, signed URLs (1hr expiry)
- **Quota monitoring**: 80% warning, 95% critical, 100% blocked
- **Store integration**: Services are singletons, injected into Zustand slices

## Gotchas
- Read operations return empty/null on error (graceful degradation)
- Write operations throw on error (explicit handling required)
- Mood real-time uses Broadcast, not postgres_changes (RLS limitation)
- Photo URLs expire - always fetch fresh signed URLs before display
- `getCurrentUserIdOfflineSafe()` for offline-compatible user ID retrieval
