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
  supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);
```

Environment variables are validated at module load time -- missing values throw an error immediately rather than failing silently at runtime.

## API Services

### moodSyncService (`src/api/moodSyncService.ts`)

Syncs locally-stored mood entries to Supabase. Key methods:

| Method | Description |
|--------|-------------|
| `syncPendingMoods()` | Reads unsynced entries from IndexedDB, upserts each to Supabase, marks synced on success |
| `fetchMoods(userId, limit)` | Fetches mood records from Supabase for a given user |

The sync process transforms `MoodEntry` (IndexedDB format) into the Supabase `moods` table insert format, handling field mapping between local and remote schemas. Partial failure is handled: if one mood fails to sync, others continue.

### moodApi (`src/api/moodApi.ts`)

Provides direct Supabase queries for mood data:

| Method | Description |
|--------|-------------|
| `fetchByUser(userId, limit, offset)` | Paginated mood fetch with cursor |
| `fetchByDateRange(userId, startDate, endDate)` | Date-range query for calendar view |

### interactionService (`src/api/interactionService.ts`)

Manages poke/kiss interactions between partners:

| Method | Description |
|--------|-------------|
| `sendInteraction(partnerId, type)` | Send poke or kiss (validates UUID + type first) |
| `getRecentInteractions(limit)` | Fetch recent interactions for history |
| `subscribeToInteractions(callback)` | Realtime subscription for incoming interactions |
| `unsubscribe()` | Clean up realtime subscription |

Input validation via `interactionValidation.ts` utilities before any Supabase call.

### partnerService (`src/api/partnerService.ts`)

Partner discovery and request management:

| Method | Description |
|--------|-------------|
| `searchUsers(query)` | Search users by email or display name |
| `sendPartnerRequest(targetUserId)` | Send partner connection request |
| `acceptPartnerRequest(requestId)` | Accept incoming request, link partner_ids |
| `rejectPartnerRequest(requestId)` | Reject incoming request |
| `getPartnerRequests()` | Fetch sent and received requests |

### authService (`src/api/authService.ts`)

Legacy auth service wrapping Supabase Auth methods. Being superseded by the `auth/` subdirectory modules:

| Method | Description |
|--------|-------------|
| `signIn(email, password)` | Sign in with email/password |
| `signUp(email, password)` | Create new account |
| `signOut()` | Sign out and clear session |
| `getUser()` | Get current authenticated user |

### errorHandlers (`src/api/errorHandlers.ts`)

Centralized error handling for Supabase API responses. Maps Supabase error codes to user-friendly messages.

## Supabase Validation Schemas

`src/api/validation/supabaseSchemas.ts` contains Zod schemas that validate Supabase query responses at the API boundary:

```typescript
export const SupabaseMoodSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  mood_type: z.string(),
  mood_types: z.array(z.string()).nullable(),
  note: z.string().nullable(),
  created_at: z.string().nullable(),
});
```

This ensures type safety beyond TypeScript's compile-time checks, catching malformed data from the database at runtime.

## Related Documentation

- [Authentication Flow](./07-authentication-flow.md)
- [Data Architecture](./04-data-architecture.md)
- [Realtime Features](./11-realtime-features.md)
