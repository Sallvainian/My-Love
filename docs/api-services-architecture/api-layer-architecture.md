# API Layer Architecture

## 1. Supabase Client (`supabaseClient.ts`)

**Purpose**: Singleton instance providing validated database access with type safety

**Key Features**:

- Typed database schema using TypeScript types from `database.types`
- Automatic JWT refresh and OAuth callback detection
- Real-time subscriptions enabled with rate limiting (10 events/sec)
- Row Level Security (RLS) enforcement via `auth.uid()`

```typescript
// Configuration
const supabase: SupabaseClient<Database> = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true, // Persist JWT tokens in browser
      autoRefreshToken: true, // Auto-refresh expired tokens
      detectSessionInUrl: true, // Support OAuth callbacks
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);
```

**Partner Discovery**:

- `getPartnerId()`: Queries users table for non-current-user (2-user MVP pattern)
- Returns UUID string or null if not found

## 2. Authentication Service (`authService.ts`)

**Responsibility**: Complete authentication lifecycle management

**Supported Methods**:

| Method                | Purpose                              | Returns                    |
| --------------------- | ------------------------------------ | -------------------------- |
| `signIn()`            | Email/password authentication        | `{ user, session, error }` |
| `signUp()`            | Create new account                   | `{ user, session, error }` |
| `signOut()`           | Clear session and tokens             | `void`                     |
| `getSession()`        | Retrieve current JWT session         | `Session \| null`          |
| `getUser()`           | Get authenticated user info          | `User \| null`             |
| `getCurrentUserId()`  | Get user UUID (preferred for DB ops) | `string \| null`           |
| `getAuthStatus()`     | Comprehensive status object          | `AuthStatus`               |
| `onAuthStateChange()` | Subscribe to auth events             | Unsubscribe function       |
| `resetPassword()`     | Password reset email                 | `AuthError \| null`        |
| `signInWithGoogle()`  | OAuth redirect flow                  | `AuthError \| null`        |

**Session Management**:

- Uses Supabase native JWT tokens (stored in browser)
- Automatic refresh on expiry
- OAuth flow redirects to Google, then back with email auto-provisioning

**Error Handling**:

```typescript
const result = await authService.signIn({
  email: 'user@example.com',
  password: 'secure123',
});

if (result.error) {
  console.error('Login failed:', result.error.message);
} else {
  console.log('Logged in as:', result.user?.email);
}
```

## 3. Mood API Service (`moodApi.ts`)

**Responsibility**: Validated CRUD operations for mood entries with Zod schema validation

**Class**: `MoodApi` (singleton instance: `moodApi`)

**Methods**:

| Method                                 | Purpose                 | Validation         | Network Check |
| -------------------------------------- | ----------------------- | ------------------ | ------------- |
| `create(moodData)`                     | Insert new mood         | SupabaseMoodSchema | Required      |
| `fetchByUser(userId, limit)`           | Get user's moods        | MoodArraySchema    | Required      |
| `fetchByDateRange(userId, start, end)` | Get moods in date range | MoodArraySchema    | Required      |
| `fetchById(moodId)`                    | Get single mood         | SupabaseMoodSchema | Required      |
| `update(moodId, updates)`              | Update mood entry       | SupabaseMoodSchema | Required      |
| `delete(moodId)`                       | Delete mood             | N/A                | Required      |

**Data Validation Pipeline**:

```
User Input → Network Check → Supabase Query → Zod Parse → Return Type-Safe Data
```

**Error Handling**:

```typescript
// Three categories of errors:
1. ApiValidationError     // Zod schema validation failed
2. SupabaseServiceError   // Database operation failed (PostgreSQL)
3. Network errors         // Device offline or fetch timeout
```

**Example Usage**:

```typescript
try {
  const mood = await moodApi.create({
    user_id: userId,
    mood_type: 'happy',
    note: 'Great day!',
    created_at: new Date().toISOString(),
  });
} catch (error) {
  if (error instanceof ApiValidationError) {
    // Server returned malformed data
    console.error('Validation failed:', error.validationErrors);
  } else if (error instanceof SupabaseServiceError) {
    // Database error (RLS denied, constraint violation, etc.)
    console.error('Database error:', error.code);
  }
}
```

## 4. Mood Sync Service (`moodSyncService.ts`)

**Responsibility**: Synchronization of moods between IndexedDB and Supabase

**Key Features**:

- **Sync with Retry**: Exponential backoff (1s, 2s, 4s max 3 retries)
- **Real-time Subscriptions**: Partner mood updates via Postgres Changes
- **Batch Sync**: Sync all pending moods with partial failure handling

**Methods**:

| Method                      | Purpose                        | Retry Logic               | Real-time |
| --------------------------- | ------------------------------ | ------------------------- | --------- |
| `syncMood(mood)`            | Sync single mood               | Via `syncMoodWithRetry()` | No        |
| `syncPendingMoods()`        | Batch sync from IndexedDB      | Exponential backoff       | No        |
| `subscribeMoodUpdates()`    | Listen for partner updates     | N/A                       | Yes       |
| `fetchMoods(userId, limit)` | Get user's moods from Supabase | No                        | No        |

**Retry Strategy**:

```
Attempt 1: Immediate
Attempt 2: Wait 1s
Attempt 3: Wait 2s
Attempt 4: Wait 4s
Max: 3 retries (4 total attempts)
```

**Real-time Subscription**:

```typescript
// Listen for partner's new moods in real-time
const unsubscribe = await moodSyncService.subscribeMoodUpdates(
  (mood) => {
    console.log('Partner logged:', mood.mood_type);
    // Update UI immediately
  },
  (status) => {
    console.log('Connection status:', status);
  }
);

// Later: cleanup
unsubscribe();
```

## 5. Partner Service (`partnerService.ts`)

**Responsibility**: Partner relationship management and user discovery

**Methods**:

| Method                             | Purpose                      | RLS Scope                                |
| ---------------------------------- | ---------------------------- | ---------------------------------------- |
| `searchUsers(query, limit)`        | Find users by name/email     | Authenticated users only                 |
| `sendPartnerRequest(toUserId)`     | Send connection request      | Validation: no double partners           |
| `acceptPartnerRequest(requestId)`  | Accept pending request       | RPC function `accept_partner_request()`  |
| `declinePartnerRequest(requestId)` | Decline request              | RPC function `decline_partner_request()` |
| `getPartner()`                     | Get current partner info     | User's own partner only                  |
| `getPendingRequests()`             | Get sent + received requests | Current user's requests only             |
| `hasPartner()`                     | Check if user has partner    | Boolean helper                           |

**Data Model**:

```typescript
interface PartnerRequest {
  id: string;
  from_user_id: string; // UUID
  to_user_id: string; // UUID
  from_user_email: string | null;
  from_user_display_name: string | null;
  to_user_email: string | null;
  to_user_display_name: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}
```

**RLS Protection**:

- Users can only search other users (not self)
- Users can only see their own requests
- Partner update requires RPC function (server-side business logic)

## 6. Interaction Service (`interactionService.ts`)

**Responsibility**: Poke/kiss interactions between partners with real-time updates

**Methods**:

| Method                                 | Purpose                          | Real-time         | Notification       |
| -------------------------------------- | -------------------------------- | ----------------- | ------------------ |
| `sendPoke(partnerId)`                  | Send poke to partner             | No (sends INSERT) | Yes (via Realtime) |
| `sendKiss(partnerId)`                  | Send kiss to partner             | No (sends INSERT) | Yes (via Realtime) |
| `subscribeInteractions()`              | Listen for incoming interactions | Yes               | Callback           |
| `getInteractionHistory(limit, offset)` | Fetch interaction history        | No                | N/A                |
| `getUnviewedInteractions()`            | Get unviewed interactions        | No                | N/A                |
| `markAsViewed(interactionId)`          | Mark as viewed                   | No                | N/A                |

**Real-time Flow**:

```
User A sends poke
  ↓
Insert into interactions table (from_user_id=A, to_user_id=B, viewed=false)
  ↓
Postgres trigger sends INSERT event
  ↓
User B's realtime subscription receives event
  ↓
Callback triggered, UI updates (notification, animation, etc.)
```

## 7. Error Handlers (`errorHandlers.ts`)

**Purpose**: Centralized error transformation and retry logic

**Custom Error Classes**:

```typescript
class SupabaseServiceError extends Error {
  code: string | undefined; // PostgreSQL error code or custom
  details: string | undefined; // Additional error details
  hint: string | undefined; // User-friendly hint
  isNetworkError: boolean; // Network vs database error
}
```

**Error Mapping** (PostgreSQL → User-friendly):

| Code          | Meaning                     | User Message                                    |
| ------------- | --------------------------- | ----------------------------------------------- |
| 23505         | Unique constraint violation | "This record already exists"                    |
| 23503         | Foreign key violation       | "Referenced record not found"                   |
| 23502         | NOT NULL violation          | "Required field is missing"                     |
| 42501         | Permission denied           | "Permission denied - check RLS policies"        |
| 42P01         | Table not found             | "Table not found - database schema out of sync" |
| PGRST116      | No rows found               | "No rows found"                                 |
| NETWORK_ERROR | Device offline              | "Network error - will sync when online"         |

**Retry Configuration**:

```typescript
interface RetryConfig {
  maxAttempts: number; // Default: 3
  initialDelayMs: number; // Default: 1000
  maxDelayMs: number; // Default: 30000
  backoffMultiplier: number; // Default: 2 (exponential)
}
```

**Usage**:

```typescript
const result = await retryWithBackoff(() => supabase.from('moods').select('*'), {
  maxAttempts: 4,
  initialDelayMs: 500,
  backoffMultiplier: 2,
});
```

## 8. Validation Schemas (`validation/supabaseSchemas.ts`)

**Purpose**: Runtime validation of all Supabase API responses using Zod

**Schema Categories**:

### User Schemas

- `SupabaseUserSchema`: Validates user table rows
- `UserInsertSchema`: Validates insert operations
- `UserUpdateSchema`: Validates partial updates

### Mood Schemas

- `SupabaseMoodSchema`: Complete mood record validation
- `MoodTypeSchema`: Enum validation (loved, happy, content, thoughtful, grateful, sad, anxious, frustrated, lonely, tired)
- `MoodInsertSchema`: Insert operation with max 200 char notes
- `MoodUpdateSchema`: Partial update validation
- `MoodArraySchema`: Array of moods for batch queries

### Interaction Schemas

- `SupabaseInteractionSchema`: Validates interaction records
- `InteractionTypeSchema`: Enum (poke, kiss)
- `InteractionInsertSchema`: Insert validation
- `InteractionArraySchema`: Batch responses

### Timestamp Validation

```typescript
// Accepts ISO 8601 formats:
// ✓ 2025-01-15T10:30:00Z
// ✓ 2025-01-15T10:30:00.123456Z
// ✓ 2025-01-15T10:30:00.123456+00:00
```

---
