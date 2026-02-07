# API Reference

> Complete API layer documentation for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

---

## Table of Contents

- [API Services Overview](#api-services-overview)
- [Supabase Client Configuration](#supabase-client-configuration)
- [Auth Service](#auth-service)
- [Error Handling](#error-handling)
- [Interaction Service](#interaction-service)
- [Mood API](#mood-api)
- [Mood Sync Service](#mood-sync-service)
- [Partner Service](#partner-service)
- [Edge Functions](#edge-functions)
- [Validation Schemas (Supabase)](#validation-schemas-supabase)
- [Validation Schemas (Application)](#validation-schemas-application)

---

## API Services Overview

The API layer uses Supabase as Backend-as-a-Service. Services are organized by domain, and all Supabase responses are validated at service boundaries using Zod schemas. Error handling follows a consistent pattern with typed error classes.

| Service | File | Singleton | Responsibility |
|---------|------|-----------|----------------|
| `authService` | `src/api/authService.ts` | `authService` | Authentication, session management, OAuth |
| `errorHandlers` | `src/api/errorHandlers.ts` | (utilities) | Error detection, transformation, retry logic |
| `interactionService` | `src/api/interactionService.ts` | `interactionService` | Poke/kiss interactions, realtime subscriptions |
| `moodApi` | `src/api/moodApi.ts` | `moodApi` | Validated CRUD for mood entries |
| `moodSyncService` | `src/api/moodSyncService.ts` | `moodSyncService` | Mood sync, broadcast, batch pending sync |
| `partnerService` | `src/api/partnerService.ts` | `partnerService` | Partner relationships, user search, requests |

---

## Supabase Client Configuration

**File**: `src/api/supabaseClient.ts`

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon (public) key |

Both variables are required at startup. The module throws an `Error` if either is missing.

### Client Options

```typescript
createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // Enables OAuth callback detection
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

- **`persistSession: true`** -- Session stored in `localStorage` across page reloads.
- **`autoRefreshToken: true`** -- JWT automatically refreshed before expiry.
- **`detectSessionInUrl: true`** -- Parses OAuth redirect tokens from URL hash.
- **`eventsPerSecond: 10`** -- Rate limit for realtime channel events.

### Utility Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `getPartnerId` | `() => Promise<string \| null>` | Partner UUID or `null` | Queries `users` table for current user's `partner_id`. Returns `null` on PGRST116 (no row). |
| `getPartnerDisplayName` | `() => Promise<string \| null>` | Display name or `null` | Fetches partner's `display_name` from `users` table via `getPartnerId()`. |
| `isSupabaseConfigured` | `() => boolean` | `boolean` | Returns `true` if both env vars are set. |

---

## Auth Service

**File**: `src/api/authService.ts`
**Singleton**: `authService`
**Underlying provider**: Supabase Auth (JWT-based)

### Overview

- JWT-based with session persisted in `localStorage`.
- RLS policies verify `auth.uid()` on every database query.
- Edge Functions validate JWT via the `Authorization` header.
- On sign-in and token refresh, auth tokens are stored in **IndexedDB** (`sw-auth` store) for Background Sync access by the Service Worker.
- All console errors use the `[AuthService]` prefix for filtering.

### Exported Interfaces

```typescript
interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}
```

### Functions

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `signIn` | `credentials: AuthCredentials` | `Promise<AuthResult>` | Email/password login. Stores token in IndexedDB on success. |
| `signUp` | `credentials: AuthCredentials` | `Promise<AuthResult>` | Creates new account with email/password. |
| `signOut` | -- | `Promise<void>` | Clears Supabase session and IndexedDB auth token. Throws on failure. |
| `getSession` | -- | `Promise<Session \| null>` | Returns current session from Supabase (reads from local storage). |
| `getUser` | -- | `Promise<User \| null>` | Returns current user (network-validated). |
| `getCurrentUserId` | -- | `Promise<string \| null>` | Returns user UUID via `getUser()`. Preferred for database operations. |
| `getCurrentUserIdOfflineSafe` | -- | `Promise<string \| null>` | Returns user UUID via `getSession()`. Works offline (reads local storage). |
| `getAuthStatus` | -- | `Promise<AuthStatus>` | Returns `{ isAuthenticated, user, session }`. |
| `onAuthStateChange` | `callback: (session: Session \| null) => void` | `() => void` | Subscribes to auth events (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT). Returns unsubscribe function. Updates IndexedDB token on each event. |
| `resetPassword` | `email: string` | `Promise<AuthError \| null>` | Sends password reset email. Redirects to `{origin}{BASE_URL}reset-password`. |
| `signInWithGoogle` | -- | `Promise<AuthError \| null>` | Initiates Google OAuth redirect flow with `access_type: 'offline'` and `prompt: 'consent'`. |

### Token Storage Lifecycle

1. **Sign-in** -- `storeAuthToken()` called with `accessToken`, `refreshToken`, `expiresAt`, `userId`.
2. **Token refresh** -- `onAuthStateChange` listener updates IndexedDB on `TOKEN_REFRESHED`.
3. **Sign-out** -- `clearAuthToken()` called from both `signOut()` and the `SIGNED_OUT` event handler.

---

## Error Handling

**File**: `src/api/errorHandlers.ts`

### SupabaseServiceError Class

```typescript
class SupabaseServiceError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly hint: string | undefined;
  readonly isNetworkError: boolean;
}
```

Extends `Error` with structured properties for UI display and debugging.

### Error Code Mappings

`handleSupabaseError()` maps PostgrestError codes to user-friendly messages:

| Code | User-Friendly Message |
|------|----------------------|
| `23505` | This record already exists |
| `23503` | Referenced record not found |
| `23502` | Required field is missing |
| `42501` | Permission denied - check Row Level Security policies |
| `42P01` | Table not found - database schema may be out of sync |
| `PGRST116` | No rows found |
| `PGRST301` | Invalid request parameters |

Unrecognized codes fall back to: `Database error: {original message}`.

### Utility Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `isOnline` | `() => boolean` | `boolean` | Checks `navigator.onLine`. |
| `isPostgrestError` | `(error: unknown) => error is PostgrestError` | `boolean` | Type guard for Supabase Postgrest errors (checks `code`, `message`, `details` properties). |
| `isSupabaseServiceError` | `(error: unknown) => error is SupabaseServiceError` | `boolean` | Type guard via `instanceof` check. |
| `handleSupabaseError` | `(error: PostgrestError, context?: string) => SupabaseServiceError` | `SupabaseServiceError` | Transforms Postgrest error to typed error with user-friendly message and optional context prefix. |
| `handleNetworkError` | `(error: unknown, context?: string) => SupabaseServiceError` | `SupabaseServiceError` | Wraps generic errors with `isNetworkError: true` and offline-friendly message. Code is set to `NETWORK_ERROR`. |
| `logSupabaseError` | `(context: string, error: unknown) => void` | `void` | Context-aware `console.error` that formats output based on error type (SupabaseServiceError > PostgrestError > Error > unknown). |
| `createOfflineMessage` | `(operation: string) => string` | `string` | Returns: `"You're offline. {operation} will sync automatically when you're back online."` |

### Retry with Backoff

```typescript
interface RetryConfig {
  maxAttempts: number;       // Default: 3
  initialDelayMs: number;    // Default: 1000
  maxDelayMs: number;        // Default: 30000
  backoffMultiplier: number; // Default: 2
}
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `retryWithBackoff` | `<T>(operation: () => Promise<T>, config?: RetryConfig) => Promise<T>` | Executes async operation with exponential backoff. Default schedule: 1s, 2s, 4s delays across 3 attempts. Caps delay at 30s. Throws last error after all attempts exhausted. |

---

## Interaction Service

**File**: `src/api/interactionService.ts`
**Singleton**: `interactionService`
**Table**: `interactions`

### Types

```typescript
type InteractionType = 'poke' | 'kiss';

interface Interaction {
  id: string;
  type: InteractionType;
  fromUserId: string;
  toUserId: string;
  viewed: boolean;
  createdAt: Date;
}
```

### Functions

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `sendPoke` | `partnerId: string` | `Promise<SupabaseInteractionRecord>` | Inserts a `poke` interaction. Checks `isOnline()` first. |
| `sendKiss` | `partnerId: string` | `Promise<SupabaseInteractionRecord>` | Inserts a `kiss` interaction. Checks `isOnline()` first. |
| `subscribeInteractions` | `callback: (interaction: SupabaseInteractionRecord) => void` | `Promise<() => void>` | Subscribes to realtime INSERT events. Returns unsubscribe function. |
| `getInteractionHistory` | `limit?: number (50), offset?: number (0)` | `Promise<Interaction[]>` | Fetches interactions where user is sender or recipient. Ordered by `created_at` DESC. |
| `getUnviewedInteractions` | -- | `Promise<Interaction[]>` | Fetches interactions sent to current user where `viewed = false`. |
| `markAsViewed` | `interactionId: string` | `Promise<void>` | Sets `viewed = true` on the specified interaction. |

### Realtime Subscription

- **Channel name**: `incoming-interactions`
- **Event**: `postgres_changes` / `INSERT`
- **Schema**: `public`
- **Table**: `interactions`
- **Filter**: `to_user_id=eq.{currentUserId}`
- **Status logging**: Logs subscription status changes to console.

---

## Mood API

**File**: `src/api/moodApi.ts`
**Singleton**: `moodApi`
**Table**: `moods`

### Validation

All responses are validated using Zod schemas before being returned:

- Single mood responses validated via `SupabaseMoodSchema.parse()`
- Array responses validated via `MoodArraySchema.parse()`
- Validation failures throw `ApiValidationError`

```typescript
class ApiValidationError extends Error {
  readonly validationErrors: ZodError | null;
}
```

### Functions

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `create` | `moodData: MoodInsert` | `Promise<SupabaseMood>` | Inserts mood entry. Response validated via `SupabaseMoodSchema`. |
| `fetchByUser` | `userId: string, limit?: number (50)` | `Promise<SupabaseMood[]>` | Fetches user moods ordered by `created_at` DESC. Response validated via `MoodArraySchema`. |
| `fetchByDateRange` | `userId: string, startDate: string, endDate: string` | `Promise<SupabaseMood[]>` | Fetches moods within ISO date range using `gte`/`lte` filters. Response validated via `MoodArraySchema`. |
| `fetchById` | `moodId: string` | `Promise<SupabaseMood \| null>` | Single mood lookup. Returns `null` on PGRST116 (no rows). Response validated via `SupabaseMoodSchema`. |
| `update` | `moodId: string, updates: Partial<MoodInsert>` | `Promise<SupabaseMood>` | Partial update. Automatically sets `updated_at` to current timestamp. Response validated via `SupabaseMoodSchema`. |
| `delete` | `moodId: string` | `Promise<void>` | Hard delete by ID. No response validation needed. |
| `getMoodHistory` | `userId: string, offset?: number (0), limit?: number (50)` | `Promise<SupabaseMood[]>` | Paginated fetch using `range(offset, offset + limit - 1)`. Ordered by `created_at` DESC. Response validated via `MoodArraySchema`. |

All methods check `isOnline()` before making requests and throw `SupabaseServiceError` (via `handleNetworkError`) when offline.

---

## Mood Sync Service

**File**: `src/api/moodSyncService.ts`
**Singleton**: `moodSyncService`
**Dependencies**: `moodApi`, `moodService` (IndexedDB), `supabaseClient`

### Types

```typescript
interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}
```

### Functions

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `syncMood` | `mood: MoodEntry` | `Promise<SupabaseMoodRecord>` | Transforms local `MoodEntry` to `MoodInsert` format and calls `moodApi.create()`. Broadcasts to partner on success (fire-and-forget). |
| `syncPendingMoods` | -- | `Promise<SyncResult>` | Fetches unsynced moods from IndexedDB via `moodService.getUnsyncedMoods()`, syncs each with retry logic, marks synced moods in IndexedDB. Returns detailed summary. |
| `subscribeMoodUpdates` | `callback: (mood: SupabaseMoodRecord) => void, onStatusChange?: (status: string) => void` | `Promise<() => void>` | Subscribes to Broadcast API for incoming partner mood updates. Returns unsubscribe function. |
| `fetchMoods` | `userId: string, limit?: number (50)` | `Promise<SupabaseMoodRecord[]>` | Delegates to `moodApi.fetchByUser()`. |
| `getLatestPartnerMood` | `userId: string` | `Promise<SupabaseMoodRecord \| null>` | Fetches most recent mood (`limit: 1`). Returns `null` on failure (graceful degradation). |

### Broadcast API

Partner mood notifications use the Supabase Broadcast API (client-to-client) instead of `postgres_changes` because RLS policies on the `moods` table contain complex subqueries that cannot be evaluated by Supabase Realtime.

- **Channel pattern**: `mood-updates:{userId}`
- **Event**: `new_mood`
- **Config**: `broadcast.self: false` (do not receive own broadcasts)
- **Payload fields**: `id`, `user_id`, `mood_type`, `mood_types`, `note`, `created_at`

### Retry Strategy (syncMoodWithRetry)

- **Total attempts**: 4 (1 initial + 3 retries)
- **Delay schedule**: 1s, 2s, 4s (exponential backoff)
- **Network check**: Verified before each attempt
- **On exhaustion**: Throws last error; calling code logs and continues to next mood

---

## Partner Service

**File**: `src/api/partnerService.ts`
**Singleton**: `partnerService`
**Tables**: `users`, `partner_requests`

### Types

```typescript
interface UserSearchResult {
  id: string;
  email: string;
  displayName: string;
}

interface PartnerInfo {
  id: string;
  email: string;
  displayName: string;
  connectedAt: string | null;
}

interface PartnerRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_user_email: string | null;
  from_user_display_name: string | null;
  to_user_email: string | null;
  to_user_display_name: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}
```

### Functions

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `getPartner` | -- | `Promise<PartnerInfo \| null>` | Fetches current user's `partner_id` from `users`, then fetches partner's `id`, `email`, `display_name`. Returns `null` if no partner. |
| `searchUsers` | `query: string, limit?: number (10)` | `Promise<UserSearchResult[]>` | Searches `users` table by `email` or `display_name` (case-insensitive `ilike`). Minimum 2 characters. Excludes current user. |
| `sendPartnerRequest` | `toUserId: string` | `Promise<void>` | Validates neither user has a partner, then inserts row into `partner_requests` with `status: 'pending'`. Detects duplicate request errors. |
| `getPendingRequests` | -- | `Promise<{ sent: PartnerRequest[], received: PartnerRequest[] }>` | Fetches all pending requests involving current user. Enriches with user display names from `users` table. Separates into sent/received. |
| `acceptPartnerRequest` | `requestId: string` | `Promise<void>` | Calls RPC `accept_partner_request(p_request_id)`. Atomically sets bidirectional `partner_id` and auto-declines other pending requests. |
| `declinePartnerRequest` | `requestId: string` | `Promise<void>` | Calls RPC `decline_partner_request(p_request_id)`. Recipient-only status change to `'declined'`. |
| `hasPartner` | -- | `Promise<boolean>` | Returns `true` if `getPartner()` returns non-null. |

### RPC Calls

| RPC Function | Parameter | Behavior |
|-------------|-----------|----------|
| `accept_partner_request(p_request_id)` | Request UUID | SECURITY DEFINER. Sets `partner_id` bidirectionally on both users, marks request as `'accepted'`, auto-declines all other pending requests for both users. |
| `decline_partner_request(p_request_id)` | Request UUID | SECURITY DEFINER. Recipient-only. Sets request status to `'declined'`. |

---

## Edge Functions

### upload-love-note-image

**File**: `supabase/functions/upload-love-note-image/index.ts`
**Runtime**: Deno (Supabase Edge Functions)
**Bucket**: `love-notes-images` (private)

#### Request

```http
POST /functions/v1/upload-love-note-image
Authorization: Bearer {jwt_token}
Content-Type: application/octet-stream
[binary image data]
```

Also accepts `multipart/form-data` with a `file` field.

#### Validation Pipeline

| Step | Check | Failure Code |
|------|-------|-------------|
| 1 | HTTP method is POST | 405 |
| 2 | Authorization header present | 401 |
| 3 | JWT authentication (Supabase Auth) | 401 |
| 4 | Rate limit (10 uploads/minute/user) | 429 |
| 5 | File size (max 5 MB) | 413 |
| 6 | MIME type via magic bytes | 415 |

#### MIME Detection (Magic Bytes)

| Format | Magic Bytes | Hex |
|--------|-------------|-----|
| JPEG | Bytes 0-2 | `FF D8 FF` |
| PNG | Bytes 0-7 | `89 50 4E 47 0D 0A 1A 0A` |
| WebP | Bytes 0-3 + 8-11 | `52 49 46 46 ... 57 45 42 50` |
| GIF | Bytes 0-3 | `47 49 46 38` |

#### Rate Limiting

- **Limit**: 10 uploads per minute per user
- **Storage**: In-memory `Map<string, number[]>` (resets on cold start)
- **Window**: 60 seconds (sliding)

#### Success Response (200)

```json
{
  "success": true,
  "storagePath": "{userId}/{timestamp}-{uuid}.jpg",
  "size": 123456,
  "mimeType": "image/jpeg",
  "rateLimitRemaining": 9
}
```

Response headers include `X-RateLimit-Remaining`.

#### Error Responses

| Status | Meaning | Body Fields |
|--------|---------|-------------|
| 200 | Success | `success`, `storagePath`, `size`, `mimeType`, `rateLimitRemaining` |
| 401 | Missing auth header or invalid JWT | `error` |
| 405 | Method not allowed (not POST) | `error` |
| 413 | File exceeds 5 MB | `error`, `message`, `maxSize`, `actualSize` |
| 415 | Invalid MIME type | `error`, `message`, `detectedType` |
| 429 | Rate limit exceeded | `error`, `message` + `Retry-After: 60` header |
| 500 | Server error or upload failure | `error`, `message` |

---

## Validation Schemas (Supabase)

**File**: `src/api/validation/supabaseSchemas.ts`
**Library**: Zod

These schemas validate all data returned from Supabase API responses at service boundaries.

### SupabaseMoodSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid()` | Server-generated UUID |
| `user_id` | `z.string().uuid()` | Owner user ID |
| `mood_type` | `z.enum([...12 values])` | Legacy single mood (backward compat) |
| `mood_types` | `z.array(MoodTypeEnum).nullable().optional()` | Multi-mood support; nullable for legacy records |
| `note` | `z.string().nullable()` | Optional note |
| `created_at` | `TimestampSchema.nullable()` | ISO 8601 timestamp |
| `updated_at` | `TimestampSchema.nullable()` | ISO 8601 timestamp |

### MoodInsertSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid().optional()` | Optional; server-generated if omitted |
| `user_id` | `z.string().uuid()` | Required |
| `mood_type` | `z.enum([...12 values])` | Required |
| `mood_types` | `z.array(MoodTypeEnum).optional()` | Optional multi-mood array |
| `note` | `z.string().max(200).nullable().optional()` | Max 200 characters |
| `created_at` | `TimestampSchema.optional()` | Optional |
| `updated_at` | `TimestampSchema.optional()` | Optional |

### Mood Type Enum (12 values)

```
loved, happy, content, excited, thoughtful, grateful,
sad, anxious, frustrated, angry, lonely, tired
```

### SupabaseInteractionSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid()` | Server-generated UUID |
| `type` | `z.enum(['poke', 'kiss'])` | Interaction type |
| `from_user_id` | `z.string().uuid()` | Sender |
| `to_user_id` | `z.string().uuid()` | Recipient |
| `viewed` | `z.boolean().nullable()` | View status |
| `created_at` | `TimestampSchema.nullable()` | ISO 8601 timestamp |

### SupabaseUserSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid()` | User UUID |
| `partner_name` | `z.string().nullable()` | Display name for partner |
| `device_id` | `z.string().uuid().nullable()` | Device identifier |
| `created_at` | `TimestampSchema.nullable()` | ISO 8601 timestamp |
| `updated_at` | `TimestampSchema.nullable()` | ISO 8601 timestamp |
| `partner_id` | `z.string().uuid().nullable().optional()` | Linked partner UUID |
| `email` | `z.string().nullable().optional()` | User email |
| `display_name` | `z.string().nullable().optional()` | User display name |

### Array Schemas

| Schema | Wraps | Purpose |
|--------|-------|---------|
| `MoodArraySchema` | `z.array(SupabaseMoodSchema)` | Batch mood responses |
| `InteractionArraySchema` | `z.array(SupabaseInteractionSchema)` | Batch interaction responses |
| `UserArraySchema` | `z.array(SupabaseUserSchema)` | Batch user responses |

### Exported Types

All schemas export inferred TypeScript types: `SupabaseUser`, `SupabaseMood`, `SupabaseInteraction`, `SupabaseMessage`, `SupabasePhoto`, `UserInsert`, `UserUpdate`, `MoodInsert`, `MoodUpdate`, `InteractionInsert`, `InteractionUpdate`.

---

## Validation Schemas (Application)

**File**: `src/validation/schemas.ts`
**Library**: Zod
**Purpose**: Runtime validation at service boundaries before IndexedDB writes.

### Scripture Schemas

Defined in `src/validation/schemas.ts` for validating Supabase RPC and query responses.

#### SupabaseSessionSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid()` | Session UUID |
| `mode` | `z.enum(['solo', 'together'])` | Reading mode |
| `user1_id` | `z.string().uuid()` | Session creator |
| `user2_id` | `z.string().uuid().nullable()` | Partner (null for solo) |
| `current_phase` | `z.enum(['lobby', 'countdown', 'reading', 'reflection', 'report', 'complete'])` | Session phase |
| `current_step_index` | `z.number().int().min(0)` | Current reading step |
| `status` | `z.enum(['pending', 'in_progress', 'complete', 'abandoned'])` | Session status |
| `version` | `z.number().int().min(1)` | Optimistic concurrency version |
| `snapshot_json` | `z.record(z.string(), z.unknown()).nullable().optional()` | Session state snapshot |
| `started_at` | `z.string()` | ISO timestamp |
| `completed_at` | `z.string().nullable()` | ISO timestamp or null |

#### SupabaseReflectionSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid()` | Reflection UUID |
| `session_id` | `z.string().uuid()` | Parent session |
| `step_index` | `z.number().int().min(0)` | Reading step index |
| `user_id` | `z.string().uuid()` | Author |
| `rating` | `z.number().int().min(1).max(5).nullable()` | 1-5 rating or null |
| `notes` | `z.string().nullable()` | Free-text notes |
| `is_shared` | `z.boolean()` | Shared with partner |
| `created_at` | `z.string()` | ISO timestamp |

#### SupabaseBookmarkSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid()` | Bookmark UUID |
| `session_id` | `z.string().uuid()` | Parent session |
| `step_index` | `z.number().int().min(0)` | Reading step index |
| `user_id` | `z.string().uuid()` | Author |
| `share_with_partner` | `z.boolean()` | Visibility flag |
| `created_at` | `z.string()` | ISO timestamp |

#### SupabaseMessageSchema (Scripture)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.string().uuid()` | Message UUID |
| `session_id` | `z.string().uuid()` | Parent session |
| `sender_id` | `z.string().uuid()` | Message author |
| `message` | `z.string()` | Message content |
| `created_at` | `z.string()` | ISO timestamp |

### Message Schemas

#### MessageSchema (existing messages from IndexedDB)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.number().int().positive().optional()` | Auto-increment ID |
| `text` | `z.string().min(1).max(MESSAGE_TEXT_MAX_LENGTH)` | Message content |
| `category` | `z.enum(['reason', 'memory', 'affirmation', 'future', 'custom'])` | Message category |
| `isCustom` | `z.boolean()` | User-created flag |
| `active` | `z.boolean().default(true)` | Active/archived |
| `createdAt` | `z.date()` | Creation date |
| `isFavorite` | `z.boolean().optional()` | Favorite flag |
| `updatedAt` | `z.date().optional()` | Last update date |
| `tags` | `z.array(z.string()).optional()` | Tag array |

#### CreateMessageInputSchema

| Field | Type | Notes |
|-------|------|-------|
| `text` | `z.string().trim().min(1).max(MESSAGE_TEXT_MAX_LENGTH)` | Auto-trimmed |
| `category` | `MessageCategorySchema` | Required |
| `active` | `z.boolean().default(true)` | Defaults to active |
| `tags` | `z.array(z.string()).optional()` | Optional |

#### UpdateMessageInputSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.number().int().positive()` | Required for lookup |
| `text` | `z.string().trim().min(1).max(MESSAGE_TEXT_MAX_LENGTH).optional()` | Optional partial update |
| `category` | `MessageCategorySchema.optional()` | Optional |
| `active` | `z.boolean().optional()` | Optional |
| `tags` | `z.array(z.string()).optional()` | Optional |

#### CustomMessagesExportSchema

| Field | Type | Notes |
|-------|------|-------|
| `version` | `z.literal('1.0')` | Schema version |
| `exportDate` | `z.string()` | ISO date string |
| `messageCount` | `z.number().int().nonnegative()` | Total messages |
| `messages` | `z.array(...)` | Array of `{ text, category, active, tags?, createdAt, updatedAt }` |

### Photo Schemas

#### PhotoSchema

| Field | Type | Notes |
|-------|------|-------|
| `id` | `z.number().int().positive().optional()` | Auto-increment ID |
| `imageBlob` | `z.instanceof(Blob)` | Image data |
| `caption` | `z.string().max(500).optional()` | Max 500 characters |
| `tags` | `z.array(z.string()).default([])` | Defaults to empty |
| `uploadDate` | `z.date()` | Upload timestamp |
| `originalSize` | `z.number().positive()` | Bytes before compression |
| `compressedSize` | `z.number().positive()` | Bytes after compression |
| `width` | `z.number().int().positive()` | Pixel width |
| `height` | `z.number().int().positive()` | Pixel height |
| `mimeType` | `z.enum(['image/jpeg', 'image/png', 'image/webp'])` | Supported formats |

#### PhotoUploadInputSchema

| Field | Type | Notes |
|-------|------|-------|
| `file` | `z.instanceof(File)` | Required file input |
| `caption` | `z.string().max(500).optional()` | Max 500 characters |
| `tags` | `z.string().optional()` | Comma-separated string |

### Mood Schemas

#### MoodEntrySchema

| Field | Type | Notes |
|-------|------|-------|
| `date` | `IsoDateStringSchema` | YYYY-MM-DD with month/day validation |
| `mood` | `z.enum([...12 values])` | Primary mood |
| `moods` | `z.array(MoodTypeSchema).min(1).optional()` | Multi-mood support |
| `note` | `z.string().max(200).optional().or(z.literal(''))` | Allows empty string |

#### IsoDateStringSchema

```typescript
z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(/* validates month 1-12, day 1-31, and Date parse round-trip */)
```

### Settings Schema

#### SettingsSchema

| Field | Type | Notes |
|-------|------|-------|
| `themeName` | `z.enum(['sunset', 'ocean', 'lavender', 'rose'])` | Theme selection |
| `notificationTime` | `TimeFormatSchema` | HH:MM with hour 00-23, minute 00-59 validation |
| `relationship.startDate` | `IsoDateStringSchema` | YYYY-MM-DD |
| `relationship.partnerName` | `z.string().min(1)` | Required |
| `relationship.anniversaries` | `z.array(AnniversarySchema)` | `{ id, date, label, description? }` |
| `customization.accentColor` | `z.string()` | CSS color value |
| `customization.fontFamily` | `z.string()` | Font family name |
| `notifications.enabled` | `z.boolean()` | Toggle |
| `notifications.time` | `z.string()` | Time string |

### Validation Error Utilities

**File**: `src/validation/errorMessages.ts`
**Re-exported from**: `src/validation/index.ts`

| Export | Type | Description |
|--------|------|-------------|
| `ValidationError` | Class | Custom error with `fieldErrors: Map<string, string>`. Used by service layer. |
| `formatZodError` | `(error: ZodError) => string` | Converts ZodError to comma-separated user-friendly message. |
| `getFieldErrors` | `(error: ZodError) => Map<string, string>` | Returns map of field path to error message (first error per field). |
| `createValidationError` | `(error: ZodError) => ValidationError` | Wraps ZodError into ValidationError with formatted messages and field map. |
| `isValidationError` | `(error: unknown) => error is ValidationError` | Type guard for ValidationError. |
| `isZodError` | `(error: unknown) => error is ZodError` | Type guard for ZodError. |
