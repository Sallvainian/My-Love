# API Layer

## Directory Structure

```
src/api/
  supabaseClient.ts          # Singleton Supabase client
  authService.ts             # Legacy auth service (sign-in/out)
  moodSyncService.ts         # Mood sync to Supabase
  moodApi.ts                 # Mood CRUD via Supabase queries
  interactionService.ts      # Poke/kiss interaction service
  partnerService.ts          # Partner search and request management
  errorHandlers.ts           # API error handling utilities
  auth/
    sessionService.ts        # Session management, offline-safe auth
    actionService.ts         # Auth actions (sign-in, sign-up, sign-out)
    types.ts                 # Auth type definitions
  validation/
    supabaseSchemas.ts       # Zod schemas for Supabase row types
```

## Supabase Client

The singleton client in `src/api/supabaseClient.ts` is typed with the generated `Database` type:

```typescript
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);
```

Environment variables are validated at module load time -- missing values throw an error immediately rather than failing silently at runtime.

## API Services

### moodSyncService (`src/api/moodSyncService.ts`)

Syncs locally-stored mood entries to Supabase. Key methods:

| Method                      | Description                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `syncPendingMoods()`        | Reads unsynced entries from IndexedDB, upserts each to Supabase, marks synced on success |
| `fetchMoods(userId, limit)` | Fetches mood records from Supabase for a given user                                      |

The sync process transforms `MoodEntry` (IndexedDB format) into the Supabase `moods` table insert format, handling field mapping between local and remote schemas. Partial failure is handled: if one mood fails to sync, others continue.

### moodApi (`src/api/moodApi.ts`)

Class-based API with Zod-validated responses. All methods check `isOnline()` before executing. Uses `SupabaseMoodSchema` and `MoodArraySchema` to validate every response from Supabase.

Custom error class: `ApiValidationError` wraps `ZodError` for cases where Supabase returns unexpected data shapes.

| Method                                         | Return Type               | Description                                    |
| ---------------------------------------------- | ------------------------- | ---------------------------------------------- |
| `create(moodData: MoodInsert)`                 | `Promise<SupabaseMood>`   | Insert mood, validate response                 |
| `fetchByUser(userId, limit?)`                  | `Promise<SupabaseMood[]>` | Fetch user's moods (default limit 50)          |
| `fetchByDateRange(userId, startDate, endDate)` | `Promise<SupabaseMood[]>` | Date-range query for calendar view             |
| `fetchById(moodId)`                            | `Promise<SupabaseMood \| null>` | Single mood by ID (handles PGRST116 as null) |
| `update(moodId, updates)`                      | `Promise<SupabaseMood>`   | Partial update with validated response         |
| `delete(moodId)`                               | `Promise<void>`           | Delete mood entry                              |
| `getMoodHistory(userId, offset?, limit?)`       | `Promise<SupabaseMood[]>` | Paginated fetch using `.range()`               |

Exported as singleton: `export const moodApi = new MoodApi()`.

### interactionService (`src/api/interactionService.ts`)

Class-based service managing poke/kiss interactions between partners. Uses `postgres_changes` realtime for incoming interaction notifications.

| Method                                         | Return Type                       | Description                                     |
| ---------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `sendPoke(partnerId)`                          | `Promise<SupabaseInteractionRecord>` | Send poke (delegates to private `sendInteraction`) |
| `sendKiss(partnerId)`                          | `Promise<SupabaseInteractionRecord>` | Send kiss (delegates to private `sendInteraction`) |
| `subscribeInteractions(callback)`              | `Promise<() => void>`            | Realtime subscription for incoming interactions; returns unsubscribe function |
| `getInteractionHistory(limit?, offset?)`       | `Promise<Interaction[]>`          | Fetch interactions where user is sender or recipient |
| `getUnviewedInteractions()`                    | `Promise<Interaction[]>`          | Fetch interactions received but not yet viewed  |
| `markAsViewed(interactionId)`                  | `Promise<void>`                   | Mark single interaction as viewed               |

The realtime subscription uses `postgres_changes` with a `to_user_id=eq.{userId}` filter to receive only interactions directed at the current user.

Exported as singleton: `export const interactionService = new InteractionService()`.

### partnerService (`src/api/partnerService.ts`)

Partner discovery and request management:

| Method                             | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `searchUsers(query)`               | Search users by email or display name     |
| `sendPartnerRequest(targetUserId)` | Send partner connection request           |
| `acceptPartnerRequest(requestId)`  | Accept incoming request, link partner_ids |
| `rejectPartnerRequest(requestId)`  | Reject incoming request                   |
| `getPartnerRequests()`             | Fetch sent and received requests          |

### Auth Services (`src/api/auth/`)

Authentication logic is split across three files:

**`sessionService.ts`** -- Session management and offline-safe authentication:

| Method                          | Description                                                |
| ------------------------------- | ---------------------------------------------------------- |
| `getSession()`                  | Get current session from in-memory cache (no network)      |
| `getUser()`                     | Get current user (network request to verify token)         |
| `getCurrentUserId()`            | Get user ID or null (network)                              |
| `getCurrentUserIdOfflineSafe()` | Get user ID from cached session (no network, offline-safe) |
| `getAuthStatus()`               | Returns `{ isAuthenticated, userId }` from cached session  |
| `onAuthStateChange(callback)`   | Subscribe to auth state changes, stores/clears IndexedDB token |

**`actionService.ts`** -- Auth actions:

| Method                    | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `signIn(email, password)` | Sign in with email/password, stores auth token to IDB    |
| `signUp(email, password)` | Create new account                                       |
| `signOut()`               | Sign out, clear session, clear IndexedDB auth token      |
| `resetPassword(email)`    | Send password reset email                                |
| `signInWithGoogle()`      | Google OAuth sign-in via Supabase                        |

**`types.ts`** -- Auth type definitions (AuthStatus, AuthAction).

**Legacy**: `authService.ts` (root `api/` level) is the old auth service, being superseded by the `auth/` subdirectory modules.

### errorHandlers (`src/api/errorHandlers.ts`)

Centralized error handling for Supabase API responses. Provides error detection, transformation, retry logic, and graceful degradation.

**Custom error class:**

```typescript
export class SupabaseServiceError extends Error {
  public readonly code: string | undefined;
  public readonly details: string | undefined;
  public readonly hint: string | undefined;
  public readonly isNetworkError: boolean;
}
```

**Error code mapping:**

| PostgreSQL/PostgREST Code | User-Friendly Message |
|---------------------------|----------------------|
| `23505` | "This record already exists" |
| `23503` | "Referenced record not found" |
| `23502` | "Required field is missing" |
| `42501` | "Permission denied - check Row Level Security policies" |
| `42P01` | "Table not found - database schema may be out of sync" |
| `PGRST116` | "No rows found" |
| `PGRST301` | "Invalid request parameters" |

**Utilities:**

| Function | Purpose |
|----------|---------|
| `isOnline()` | Network check via `navigator.onLine` |
| `handleSupabaseError(error, context?)` | Transform `PostgrestError` to `SupabaseServiceError` |
| `handleNetworkError(error, context?)` | Create `SupabaseServiceError` with `isNetworkError: true` |
| `isPostgrestError(error)` | Type guard for `PostgrestError` |
| `isSupabaseServiceError(error)` | Type guard for `SupabaseServiceError` |
| `logSupabaseError(context, error)` | Structured console.error with context prefix |
| `retryWithBackoff(operation, config?)` | Exponential backoff retry (default: 3 attempts, 1s-30s delay, 2x multiplier) |
| `createOfflineMessage(operation)` | User-friendly offline message generator |

## Supabase Validation Schemas

`src/api/validation/supabaseSchemas.ts` provides runtime validation for all Supabase API responses using Zod v4. Schemas are organized into row schemas (for query responses), insert schemas (for write operations), and array schemas (for list queries).

**Common schemas used across all row types:**

```typescript
const UUIDSchema = z.string().uuid('Invalid UUID format');
const TimestampSchema = z.string().refine(
  (val) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/.test(val),
  { message: 'Invalid timestamp format' }
);
```

**Schema inventory:**

| Schema | Type | Validates |
|--------|------|-----------|
| `SupabaseUserSchema` | Row | User records (id, partner_name, device_id, partner_id, email, display_name) |
| `UserInsertSchema` / `UserUpdateSchema` | Input | User write payloads |
| `SupabaseMoodSchema` | Row | Mood records (id, user_id, mood_type, mood_types, note, timestamps) |
| `MoodInsertSchema` / `MoodUpdateSchema` | Input | Mood write payloads (note max 200 chars) |
| `SupabaseInteractionSchema` | Row | Interaction records (id, type, from/to user IDs, viewed) |
| `InteractionInsertSchema` / `InteractionUpdateSchema` | Input | Interaction write payloads |
| `SupabaseMessageSchema` | Row | Message records (placeholder for future sync) |
| `SupabasePhotoSchema` | Row | Photo records (placeholder for future sync) |
| `MoodArraySchema` | Array | `z.array(SupabaseMoodSchema)` |
| `InteractionArraySchema` | Array | `z.array(SupabaseInteractionSchema)` |
| `UserArraySchema` | Array | `z.array(SupabaseUserSchema)` |
| `CoupleStatsSchema` | RPC | Scripture stats (totalSessions, totalSteps, lastCompleted, avgRating, bookmarkCount) |

**Inferred types exported:** `SupabaseUser`, `SupabaseMood`, `SupabaseInteraction`, `MoodInsert`, `MoodUpdate`, `InteractionInsert`, `InteractionUpdate`, `CoupleStats`, and others via `z.infer<>`.

## Related Documentation

- [Authentication Flow](./07-authentication-flow.md)
- [Data Architecture](./04-data-architecture.md)
- [Realtime Features](./11-realtime-features.md)
