# API Reference

Comprehensive reference for the My Love application API layer, service layer, Edge Functions, and Service Worker. All API and service interactions flow through typed interfaces with Zod validation at boundaries.

---

## Table of Contents

1. [Supabase Client Configuration](#1-supabase-client-configuration)
2. [Authentication API](#2-authentication-api)
3. [Mood API](#3-mood-api)
4. [Mood Sync Service](#4-mood-sync-service)
5. [Interaction API](#5-interaction-api)
6. [Partner Service](#6-partner-service)
7. [Error Handling](#7-error-handling)
8. [Validation Schemas](#8-validation-schemas)
9. [Service Layer](#9-service-layer)
10. [Edge Functions](#10-edge-functions)
11. [Service Worker](#11-service-worker)
12. [Real-time Subscriptions](#12-real-time-subscriptions)

---

## 1. Supabase Client Configuration

**Module:** `src/api/supabaseClient.ts`

### Client Initialization

The Supabase client is a singleton typed against the generated `Database` schema. It reads configuration from environment variables and throws immediately if they are missing.

| Environment Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon (publishable) key |

**Client Options:**

```typescript
{
  auth: {
    persistSession: true,        // Sessions survive page reload
    autoRefreshToken: true,      // JWT auto-refresh before expiry
    detectSessionInUrl: true,    // OAuth callback detection
  },
  realtime: {
    params: {
      eventsPerSecond: 10,       // Throttle realtime events
    },
  },
}
```

### Exported Functions

#### `supabase`

```typescript
export const supabase: SupabaseClient<Database>
```

Singleton client instance. Used by all API modules for database, auth, storage, and realtime operations.

---

#### `getPartnerId()`

```typescript
export const getPartnerId = async (): Promise<string | null>
```

- **Purpose:** Query the `users` table for the current user's `partner_id`.
- **Returns:** Partner UUID, or `null` if not authenticated / not connected.
- **Error handling:** Returns `null` on any failure. Handles `PGRST116` (no rows) gracefully.

---

#### `getPartnerDisplayName()`

```typescript
export const getPartnerDisplayName = async (): Promise<string | null>
```

- **Purpose:** Fetch the partner's `display_name` from the `users` table.
- **Returns:** Display name string, or `null` if no partner or lookup fails.
- **Depends on:** `getPartnerId()` internally.

---

#### `isSupabaseConfigured()`

```typescript
export const isSupabaseConfigured = (): boolean
```

- **Purpose:** Verify both environment variables are present.
- **Returns:** `true` if URL and anon key are set.

---

## 2. Authentication API

**Module:** `src/api/authService.ts`
**Singleton export:** `authService`

All methods are exported individually and also as properties of the `authService` singleton object.

### Types

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

### Methods

#### `signIn(credentials)`

```typescript
async signIn(credentials: AuthCredentials): Promise<AuthResult>
```

- **Purpose:** Authenticate with email/password via `supabase.auth.signInWithPassword`.
- **Side effects:** On success, stores auth token in IndexedDB for Background Sync access (`storeAuthToken`).
- **Error handling:** Returns `{ user: null, session: null, error }` on failure; never throws.

---

#### `signUp(credentials)`

```typescript
async signUp(credentials: AuthCredentials): Promise<AuthResult>
```

- **Purpose:** Register a new user via `supabase.auth.signUp`.
- **Error handling:** Same pattern as `signIn` -- returns error in result, never throws.

---

#### `signOut()`

```typescript
async signOut(): Promise<void>
```

- **Purpose:** End the session via `supabase.auth.signOut`.
- **Side effects:** Clears auth token from IndexedDB (`clearAuthToken`).
- **Error handling:** Throws on failure (callers must catch).

---

#### `getSession()`

```typescript
async getSession(): Promise<Session | null>
```

- **Purpose:** Read the cached session from local storage. Works offline.
- **Returns:** Session object or `null`.

---

#### `getUser()`

```typescript
async getUser(): Promise<User | null>
```

- **Purpose:** Network-validated user lookup via `supabase.auth.getUser`.
- **Returns:** User object or `null`.

---

#### `getCurrentUserId()`

```typescript
async getCurrentUserId(): Promise<string | null>
```

- **Purpose:** Convenience wrapper. Returns `user.id` from `getUser()`.
- **Use case:** Database operations requiring server-validated identity.

---

#### `getCurrentUserIdOfflineSafe()`

```typescript
async getCurrentUserIdOfflineSafe(): Promise<string | null>
```

- **Purpose:** Uses cached session (no network call). Safe for offline IndexedDB writes.
- **Returns:** User ID from session, or `null`.

---

#### `getAuthStatus()`

```typescript
async getAuthStatus(): Promise<AuthStatus>
```

- **Purpose:** Composite check returning `isAuthenticated`, `user`, and `session`.

---

#### `onAuthStateChange(callback)`

```typescript
onAuthStateChange(callback: (session: Session | null) => void): () => void
```

- **Purpose:** Subscribe to Supabase auth events (`SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`).
- **Side effects:** Automatically stores/clears auth token in IndexedDB on state transitions.
- **Returns:** Unsubscribe function.

---

#### `resetPassword(email)`

```typescript
async resetPassword(email: string): Promise<AuthError | null>
```

- **Purpose:** Send password reset email via `supabase.auth.resetPasswordForEmail`.
- **Redirect:** `{origin}{BASE_URL}reset-password`.
- **Returns:** `AuthError` on failure, `null` on success.

---

#### `signInWithGoogle()`

```typescript
async signInWithGoogle(): Promise<AuthError | null>
```

- **Purpose:** Initiate Google OAuth flow via `supabase.auth.signInWithOAuth`.
- **Parameters sent to Google:** `access_type: 'offline'`, `prompt: 'consent'`.
- **Redirect:** `{origin}{BASE_URL}`.
- **Returns:** `AuthError` on failure, `null` if redirect initiated.

---

## 3. Mood API

**Module:** `src/api/moodApi.ts`
**Singleton export:** `moodApi` (instance of `MoodApi`)

All responses are validated against Zod schemas (`SupabaseMoodSchema`, `MoodArraySchema`) before being returned.

### Custom Error Class

```typescript
class ApiValidationError extends Error {
  public readonly validationErrors: ZodError | null;
}
```

Thrown when Supabase returns data that does not match the Zod schema.

### Methods

#### `create(moodData)`

```typescript
async create(moodData: MoodInsert): Promise<SupabaseMood>
```

- **Purpose:** Insert a mood entry into the `moods` table.
- **Validation:** Response validated via `SupabaseMoodSchema.parse()`.
- **Throws:** `ApiValidationError` on schema mismatch, `SupabaseServiceError` on DB error, network error if offline.

---

#### `fetchByUser(userId, limit?)`

```typescript
async fetchByUser(userId: string, limit: number = 50): Promise<SupabaseMood[]>
```

- **Purpose:** Fetch moods for a user, ordered by `created_at` descending.
- **Validation:** Response validated via `MoodArraySchema.parse()`.

---

#### `fetchByDateRange(userId, startDate, endDate)`

```typescript
async fetchByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<SupabaseMood[]>
```

- **Purpose:** Fetch moods within an ISO date range using `gte`/`lte` filters.

---

#### `fetchById(moodId)`

```typescript
async fetchById(moodId: string): Promise<SupabaseMood | null>
```

- **Purpose:** Fetch a single mood by UUID.
- **Returns:** `null` if not found (`PGRST116`).

---

#### `update(moodId, updates)`

```typescript
async update(moodId: string, updates: Partial<MoodInsert>): Promise<SupabaseMood>
```

- **Purpose:** Partial update. Automatically sets `updated_at` to current time.
- **Validation:** Response validated via `SupabaseMoodSchema.parse()`.

---

#### `delete(moodId)`

```typescript
async delete(moodId: string): Promise<void>
```

- **Purpose:** Delete a mood by UUID.

---

#### `getMoodHistory(userId, offset?, limit?)`

```typescript
async getMoodHistory(
  userId: string,
  offset: number = 0,
  limit: number = 50
): Promise<SupabaseMood[]>
```

- **Purpose:** Paginated mood history using `range()`.

---

## 4. Mood Sync Service

**Module:** `src/api/moodSyncService.ts`
**Singleton export:** `moodSyncService` (instance of `MoodSyncService`)

Orchestrates sync between local IndexedDB mood entries and Supabase.

### Types

```typescript
interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}
```

### Methods

#### `syncMood(mood)`

```typescript
async syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord>
```

- **Purpose:** Upload a single local `MoodEntry` to Supabase.
- **Transform:** Converts `MoodEntry` fields to snake_case `MoodInsert`. Supports multi-mood via `mood_types` array.
- **Side effect:** After successful sync, broadcasts to partner's realtime channel (fire-and-forget).
- **Throws:** On offline or API failure.

---

#### `syncPendingMoods()`

```typescript
async syncPendingMoods(): Promise<SyncResult>
```

- **Purpose:** Batch sync all unsynced moods from IndexedDB.
- **Strategy:** Iterates each unsynced mood with retry logic (exponential backoff: 1s, 2s, 4s; max 3 retries per mood).
- **On success per mood:** Marks as synced in IndexedDB via `moodService.markAsSynced()`.
- **Error handling:** Continues syncing remaining moods on individual failure (partial failure tolerance).

---

#### `subscribeMoodUpdates(callback, onStatusChange?)`

```typescript
async subscribeMoodUpdates(
  callback: (mood: SupabaseMoodRecord) => void,
  onStatusChange?: (status: string) => void
): Promise<() => void>
```

- **Purpose:** Subscribe to Broadcast API for partner mood notifications.
- **Pattern:** Current user subscribes to their own channel (`mood-updates:{userId}`). Partner broadcasts to this channel.
- **Why Broadcast, not postgres_changes:** RLS policies with partner subqueries prevent postgres_changes from working.
- **Returns:** Unsubscribe function that removes the channel.

---

#### `fetchMoods(userId, limit?)`

```typescript
async fetchMoods(userId: string, limit: number = 50): Promise<SupabaseMoodRecord[]>
```

- **Purpose:** Fetch moods for any user. Delegates to `moodApi.fetchByUser()`.

---

#### `getLatestPartnerMood(userId)`

```typescript
async getLatestPartnerMood(userId: string): Promise<SupabaseMoodRecord | null>
```

- **Purpose:** Fetch the single most recent mood for a user.
- **Error handling:** Returns `null` on failure (graceful degradation for reads).

---

## 5. Interaction API

**Module:** `src/api/interactionService.ts`
**Singleton export:** `interactionService` (instance of `InteractionService`)

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

### Methods

#### `sendPoke(partnerId)`

```typescript
async sendPoke(partnerId: string): Promise<SupabaseInteractionRecord>
```

- **Purpose:** Insert a `poke` interaction targeting the partner.

---

#### `sendKiss(partnerId)`

```typescript
async sendKiss(partnerId: string): Promise<SupabaseInteractionRecord>
```

- **Purpose:** Insert a `kiss` interaction targeting the partner.

---

#### `subscribeInteractions(callback)`

```typescript
async subscribeInteractions(
  callback: (interaction: SupabaseInteractionRecord) => void
): Promise<() => void>
```

- **Purpose:** Listen for realtime `INSERT` events on the `interactions` table filtered by `to_user_id=eq.{currentUserId}`.
- **Uses:** `postgres_changes` (unlike moods which use Broadcast).
- **Returns:** Unsubscribe function.

---

#### `getInteractionHistory(limit?, offset?)`

```typescript
async getInteractionHistory(limit: number = 50, offset: number = 0): Promise<Interaction[]>
```

- **Purpose:** Fetch interactions where the current user is sender or recipient.
- **Transform:** Maps Supabase records to local `Interaction` type (camelCase, Date objects).

---

#### `getUnviewedInteractions()`

```typescript
async getUnviewedInteractions(): Promise<Interaction[]>
```

- **Purpose:** Fetch interactions sent to the current user where `viewed = false`.

---

#### `markAsViewed(interactionId)`

```typescript
async markAsViewed(interactionId: string): Promise<void>
```

- **Purpose:** Set `viewed = true` for a specific interaction.

---

## 6. Partner Service

**Module:** `src/api/partnerService.ts`
**Singleton export:** `partnerService` (instance of `PartnerService`)

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

### Methods

#### `getPartner()`

```typescript
async getPartner(): Promise<PartnerInfo | null>
```

- **Purpose:** Fetch the current user's partner info (ID, email, display name, connected timestamp).
- **Returns:** `null` if no partner or not authenticated.

---

#### `searchUsers(query, limit?)`

```typescript
async searchUsers(query: string, limit: number = 10): Promise<UserSearchResult[]>
```

- **Purpose:** Search users by display name or email using `ilike` matching.
- **Constraints:** Minimum 2 characters. Excludes current user from results.
- **Security:** Uses RLS-protected `users` table (no admin API).

---

#### `sendPartnerRequest(toUserId)`

```typescript
async sendPartnerRequest(toUserId: string): Promise<void>
```

- **Purpose:** Create a pending partner request.
- **Validation:** Checks that neither user already has a partner. Detects duplicate requests.
- **Throws:** On validation failure or DB error.

---

#### `getPendingRequests()`

```typescript
async getPendingRequests(): Promise<{ sent: PartnerRequest[]; received: PartnerRequest[] }>
```

- **Purpose:** Fetch all pending requests involving the current user, enriched with user info.
- **Returns:** Object with `sent` and `received` arrays.

---

#### `acceptPartnerRequest(requestId)`

```typescript
async acceptPartnerRequest(requestId: string): Promise<void>
```

- **Purpose:** Accept a partner request via Supabase RPC (`accept_partner_request`).
- **Side effect:** Sets `partner_id` on both users in the database (server-side).

---

#### `declinePartnerRequest(requestId)`

```typescript
async declinePartnerRequest(requestId: string): Promise<void>
```

- **Purpose:** Decline a partner request via Supabase RPC (`decline_partner_request`).

---

#### `hasPartner()`

```typescript
async hasPartner(): Promise<boolean>
```

- **Purpose:** Convenience check. Returns `true` if `getPartner()` returns non-null.

---

## 7. Error Handling

**Module:** `src/api/errorHandlers.ts`

### Error Classes

#### `SupabaseServiceError`

```typescript
class SupabaseServiceError extends Error {
  public readonly code: string | undefined;
  public readonly details: string | undefined;
  public readonly hint: string | undefined;
  public readonly isNetworkError: boolean;
}
```

Structured error used across all API modules. Carries Postgres error codes and a `isNetworkError` flag for UI differentiation.

### Utility Functions

#### `isOnline()`

```typescript
const isOnline = (): boolean
```

Checks `navigator.onLine`. Called before every API operation.

---

#### `handleSupabaseError(error, context?)`

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

#### `handleNetworkError(error, context?)`

```typescript
const handleNetworkError = (error: unknown, context?: string): SupabaseServiceError
```

Wraps any error as a `SupabaseServiceError` with `isNetworkError: true` and a user-facing message that mentions automatic sync.

---

#### `isPostgrestError(error)`

```typescript
const isPostgrestError = (error: unknown): error is PostgrestError
```

Type guard checking for `code`, `message`, and `details` properties.

---

#### `isSupabaseServiceError(error)`

```typescript
const isSupabaseServiceError = (error: unknown): error is SupabaseServiceError
```

Type guard using `instanceof`.

---

#### `logSupabaseError(context, error)`

```typescript
const logSupabaseError = (context: string, error: unknown): void
```

Logs structured error info to console with context prefix. Handles `SupabaseServiceError`, `PostgrestError`, and generic errors.

---

#### `retryWithBackoff(operation, config?)`

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

#### `createOfflineMessage(operation)`

```typescript
const createOfflineMessage = (operation: string): string
```

Returns: `"You're offline. {operation} will sync automatically when you're back online."`

---

## 8. Validation Schemas

**Module:** `src/api/validation/supabaseSchemas.ts`

All schemas use [Zod](https://zod.dev) for runtime validation at API boundaries.

### Common Schemas

| Schema | Validates |
|---|---|
| `UUIDSchema` | UUID v4 format string |
| `TimestampSchema` | ISO 8601 strings including PostgreSQL variants with microseconds and timezone offsets |

### Entity Schemas

#### User Schemas

| Schema | Purpose | Key Fields |
|---|---|---|
| `SupabaseUserSchema` | Validate user rows | `id`, `partner_name`, `device_id`, `partner_id?`, `email?`, `display_name?` |
| `UserInsertSchema` | Validate user inserts | `id` (required), `partner_name?`, `device_id?` |
| `UserUpdateSchema` | Validate user updates | All fields optional |

#### Mood Schemas

| Schema | Purpose | Key Fields |
|---|---|---|
| `SupabaseMoodSchema` | Validate mood rows | `id`, `user_id`, `mood_type`, `mood_types?` (array), `note?`, `created_at`, `updated_at` |
| `MoodInsertSchema` | Validate mood inserts | `user_id`, `mood_type` (required); `mood_types?`, `note?` (max 200 chars) |
| `MoodUpdateSchema` | Validate mood updates | All fields optional |

**Mood type enum:** `loved`, `happy`, `content`, `excited`, `thoughtful`, `grateful`, `sad`, `anxious`, `frustrated`, `angry`, `lonely`, `tired`

#### Interaction Schemas

| Schema | Purpose | Key Fields |
|---|---|---|
| `SupabaseInteractionSchema` | Validate interaction rows | `id`, `type` (`poke` or `kiss`), `from_user_id`, `to_user_id`, `viewed?`, `created_at` |
| `InteractionInsertSchema` | Validate interaction inserts | `type`, `from_user_id`, `to_user_id` (required) |

#### Message & Photo Schemas (placeholder)

| Schema | Purpose |
|---|---|
| `SupabaseMessageSchema` | Future: messages with category, tags, 1-500 char text |
| `SupabasePhotoSchema` | Future: photos with storage path, dimensions, MIME type |

### Array Schemas

| Schema | Wraps |
|---|---|
| `MoodArraySchema` | `z.array(SupabaseMoodSchema)` |
| `InteractionArraySchema` | `z.array(SupabaseInteractionSchema)` |
| `UserArraySchema` | `z.array(SupabaseUserSchema)` |

### Exported Types

All schemas export inferred TypeScript types: `SupabaseUser`, `SupabaseMood`, `SupabaseInteraction`, `MoodInsert`, `MoodUpdate`, `InteractionInsert`, `InteractionUpdate`, etc.

---

## 9. Service Layer

All services use IndexedDB for local persistence. Services extending `BaseIndexedDBService` share a common database (`my-love-db`, currently version 5).

### 9.1 BaseIndexedDBService

**Module:** `src/services/BaseIndexedDBService.ts`

Abstract generic base class providing CRUD operations for IndexedDB stores.

```typescript
abstract class BaseIndexedDBService<
  T extends { id?: number | string },
  DBTypes extends DBSchema,
  StoreName extends StoreNames<DBTypes>
>
```

**Error Handling Strategy:**
- Read operations (`get`, `getAll`, `getPage`): Return `null` or empty array on error (graceful degradation).
- Write operations (`add`, `update`, `delete`, `clear`): Throw errors (data integrity).

#### Inherited Methods

| Method | Signature | Description |
|---|---|---|
| `init()` | `async init(): Promise<void>` | Initialization guard preventing concurrent DB setup |
| `add(item)` | `protected async add(item: Omit<T, 'id'>): Promise<T>` | Insert with auto-increment ID. Protected to enforce validation via `create()`. |
| `get(id)` | `async get(id: number \| string): Promise<T \| null>` | Fetch by ID. Returns `null` on error. |
| `getAll()` | `async getAll(): Promise<T[]>` | Fetch all items. Returns `[]` on error. |
| `update(id, updates)` | `async update(id: number \| string, updates: Partial<T>): Promise<void>` | Merge updates into existing record. Throws if not found. |
| `delete(id)` | `async delete(id: number \| string): Promise<void>` | Remove by ID. Throws on error. |
| `clear()` | `async clear(): Promise<void>` | Remove all items from store. Throws on error. |
| `getPage(offset, limit)` | `async getPage(offset: number, limit: number): Promise<T[]>` | Cursor-based pagination. O(offset + limit). Returns `[]` on error. |

#### Abstract Methods (implemented by subclasses)

| Method | Description |
|---|---|
| `getStoreName()` | Returns the object store name |
| `_doInit()` | Service-specific DB initialization |

---

### 9.2 Database Schema

**Module:** `src/services/dbSchema.ts`

#### Constants

| Constant | Value |
|---|---|
| `DB_NAME` | `'my-love-db'` |
| `DB_VERSION` | `5` |

#### Object Stores

| Store Name | Key | Auto-increment | Indexes |
|---|---|---|---|
| `messages` | `id` (number) | Yes | `by-category` (string), `by-date` (Date) |
| `photos` | `id` (number) | Yes | `by-date` (Date) |
| `moods` | `id` (number) | Yes | `by-date` (string, unique) |
| `sw-auth` | `id` ('current') | No | None |
| `scripture-sessions` | `id` (string) | No | `by-user` (string) |
| `scripture-reflections` | `id` (string) | No | `by-session` (string) |
| `scripture-bookmarks` | `id` (string) | No | `by-session` (string) |
| `scripture-messages` | `id` (string) | No | `by-session` (string) |

#### `upgradeDb(db, oldVersion, newVersion)`

Centralized migration function handling v1 through v5 schema upgrades. Called by all services during `openDB`.

---

### 9.3 StorageService

**Module:** `src/services/storage.ts`
**Singleton export:** `storageService`

Legacy service providing direct IndexedDB operations for photos and messages. Predates `BaseIndexedDBService` extraction.

#### Photo Operations

| Method | Signature | Description |
|---|---|---|
| `addPhoto` | `(photo: Omit<Photo, 'id'>): Promise<number>` | Insert photo, return auto-generated ID |
| `getPhoto` | `(id: number): Promise<Photo \| undefined>` | Fetch by ID |
| `getAllPhotos` | `(): Promise<Photo[]>` | Fetch all photos |
| `deletePhoto` | `(id: number): Promise<void>` | Remove by ID |
| `updatePhoto` | `(id: number, updates: Partial<Photo>): Promise<void>` | Merge updates |

#### Message Operations

| Method | Signature | Description |
|---|---|---|
| `addMessage` | `(message: Omit<Message, 'id'>): Promise<number>` | Insert message |
| `getMessage` | `(id: number): Promise<Message \| undefined>` | Fetch by ID |
| `getAllMessages` | `(): Promise<Message[]>` | Fetch all messages |
| `getMessagesByCategory` | `(category: string): Promise<Message[]>` | Filter by category index |
| `updateMessage` | `(id: number, updates: Partial<Message>): Promise<void>` | Merge updates |
| `deleteMessage` | `(id: number): Promise<void>` | Remove by ID |
| `toggleFavorite` | `(messageId: number): Promise<void>` | Toggle `isFavorite` boolean |
| `addMessages` | `(messages: Omit<Message, 'id'>[]): Promise<void>` | Bulk insert via transaction |

#### Utility Operations

| Method | Signature | Description |
|---|---|---|
| `clearAllData` | `(): Promise<void>` | Clear photos and messages stores |
| `exportData` | `(): Promise<{ photos: Photo[]; messages: Message[] }>` | Export all data for backup |

#### `localStorageHelper`

Utility object for typed localStorage access with JSON serialization:

| Method | Signature |
|---|---|
| `get<T>` | `(key: string, defaultValue: T): T` |
| `set<T>` | `(key: string, value: T): void` |
| `remove` | `(key: string): void` |
| `clear` | `(): void` |

---

### 9.4 PhotoService (Supabase Storage)

**Module:** `src/services/photoService.ts`
**Singleton export:** `photoService`

Manages photos in Supabase Storage (bucket: `photos`). RLS-enforced user-scoped storage paths (`{user_id}/{filename}`).

#### Types

```typescript
interface SupabasePhoto {
  id: string; user_id: string; storage_path: string; filename: string;
  caption: string | null; mime_type: string; file_size: number;
  width: number; height: number; created_at: string;
}

interface PhotoWithUrls extends SupabasePhoto {
  signedUrl: string | null;
  isOwn: boolean;
}

interface StorageQuota {
  used: number; quota: number; percent: number;
  warning: 'none' | 'approaching' | 'critical' | 'exceeded';
}
```

#### Methods

| Method | Signature | Description |
|---|---|---|
| `getSignedUrl` | `(storagePath: string, expiresIn?: number): Promise<string \| null>` | Generate 1-hour signed URL for private photo |
| `getSignedUrls` | `(storagePaths: string[], expiresIn?: number): Promise<Map<string, string>>` | Parallel signed URL generation for multiple photos |
| `checkStorageQuota` | `(): Promise<StorageQuota>` | Calculate storage usage from DB. Warning at 80%, critical at 95% |
| `getPhotos` | `(limit?: number, offset?: number): Promise<PhotoWithUrls[]>` | Fetch user + partner photos with signed URLs. Sorted newest first |
| `uploadPhoto` | `(input: PhotoUploadInput, onProgress?: (percent: number) => void): Promise<SupabasePhoto \| null>` | Upload to Storage + create metadata record. Rollback on DB failure. Quota checks. |
| `deletePhoto` | `(photoId: string): Promise<boolean>` | Delete from Storage + DB. Verifies ownership. |
| `getPhoto` | `(photoId: string): Promise<PhotoWithUrls \| null>` | Fetch single photo with signed URL |
| `updatePhoto` | `(photoId: string, updates: Partial<SupabasePhoto>): Promise<boolean>` | Update caption only (other fields immutable) |

---

### 9.5 PhotoStorageService (IndexedDB)

**Module:** `src/services/photoStorageService.ts`
**Singleton export:** `photoStorageService`
**Extends:** `BaseIndexedDBService<Photo, MyLoveDBSchema, 'photos'>`

Local IndexedDB storage for photos with Zod validation and performance monitoring.

#### Methods (beyond inherited)

| Method | Signature | Description |
|---|---|---|
| `create` | `(photo: Omit<Photo, 'id'>): Promise<Photo>` | Zod-validated insert with performance measurement |
| `getAll` | `(): Promise<Photo[]>` | Overrides base: uses `by-date` index, returns newest first |
| `getPage` | `(offset?: number, limit?: number): Promise<Photo[]>` | Overrides base: descending cursor on `by-date` index |
| `update` | `(id: number, updates: Partial<Photo>): Promise<void>` | Overrides base: adds Zod partial validation |
| `getStorageSize` | `(): Promise<number>` | Sum of `compressedSize` across all photos |
| `estimateQuotaRemaining` | `(): Promise<{ used, quota, remaining, percentUsed }>` | Uses `navigator.storage.estimate()` |

---

### 9.6 CustomMessageService

**Module:** `src/services/customMessageService.ts`
**Singleton export:** `customMessageService`
**Extends:** `BaseIndexedDBService<Message, MyLoveDBSchema, 'messages'>`

#### Methods (beyond inherited)

| Method | Signature | Description |
|---|---|---|
| `create` | `(input: CreateMessageInput): Promise<Message>` | Zod-validated insert. Sets `isCustom: true`, `isFavorite: false`. |
| `updateMessage` | `(input: UpdateMessageInput): Promise<void>` | Zod-validated update. Auto-sets `updatedAt`. |
| `getAll` | `(filter?: MessageFilter): Promise<Message[]>` | Overrides base: supports filtering by category, `isCustom`, `active`, `searchTerm`, `tags`. |
| `getActiveCustomMessages` | `(): Promise<Message[]>` | Shortcut: `getAll({ isCustom: true, active: true })` |
| `exportMessages` | `(): Promise<CustomMessagesExport>` | Export all custom messages as JSON with version and metadata |
| `importMessages` | `(exportData: CustomMessagesExport): Promise<{ imported, skipped }>` | Import with Zod validation and duplicate detection (case-insensitive text match) |

---

### 9.7 MoodService (IndexedDB)

**Module:** `src/services/moodService.ts`
**Singleton export:** `moodService`
**Extends:** `BaseIndexedDBService<MoodEntry, MyLoveDBSchema, 'moods'>`

#### Methods (beyond inherited)

| Method | Signature | Description |
|---|---|---|
| `create` | `(userId: string, moods: MoodEntry['mood'][], note?: string): Promise<MoodEntry>` | Creates mood entry with Zod validation. Sets `synced: false`. First mood in array is primary. |
| `updateMood` | `(id: number, moods: MoodEntry['mood'][], note?: string): Promise<MoodEntry>` | Update mood and note. Resets `synced: false`. Zod-validated. |
| `getMoodForDate` | `(date: Date): Promise<MoodEntry \| null>` | Lookup via `by-date` unique index. One mood per day constraint. |
| `getMoodsInRange` | `(start: Date, end: Date): Promise<MoodEntry[]>` | Range query via `IDBKeyRange.bound` on `by-date` index. |
| `getUnsyncedMoods` | `(): Promise<MoodEntry[]>` | Filter `getAll()` where `synced === false`. |
| `markAsSynced` | `(id: number, supabaseId: string): Promise<void>` | Set `synced: true` and `supabaseId`. |

---

### 9.8 ScriptureReadingService

**Module:** `src/services/scriptureReadingService.ts`
**Singleton export:** `scriptureReadingService`
**Extends:** `BaseIndexedDBService<ScriptureSession, MyLoveDBSchema, 'scripture-sessions'>`

Implements a **cache-first read, write-through** pattern for scripture reading sessions with four sub-entities: sessions, reflections, bookmarks, and messages.

#### Error Handling

```typescript
enum ScriptureErrorCode {
  VERSION_MISMATCH, SESSION_NOT_FOUND, UNAUTHORIZED,
  SYNC_FAILED, OFFLINE, CACHE_CORRUPTED, VALIDATION_FAILED
}
```

#### Session Methods

| Method | Signature | Description |
|---|---|---|
| `createSession` | `(mode, partnerId?): Promise<ScriptureSession>` | RPC `scripture_create_session`. Caches locally. |
| `getSession` | `(sessionId, onRefresh?): Promise<ScriptureSession \| null>` | Cache-first. Background refresh with optional callback. |
| `getUserSessions` | `(userId): Promise<ScriptureSession[]>` | Cache-first by `by-user` index. |
| `updateSession` | `(sessionId, updates): Promise<void>` | Write-through: server first, then cache. |

#### Reflection Methods

| Method | Signature | Description |
|---|---|---|
| `addReflection` | `(sessionId, stepIndex, rating, notes, isShared): Promise<ScriptureReflection>` | RPC `scripture_submit_reflection`. Caches locally. |
| `getReflectionsBySession` | `(sessionId): Promise<ScriptureReflection[]>` | Cache-first with background refresh. |

#### Bookmark Methods

| Method | Signature | Description |
|---|---|---|
| `addBookmark` | `(sessionId, stepIndex, userId, shareWithPartner): Promise<ScriptureBookmark>` | Insert to `scripture_bookmarks`. Caches locally. |
| `toggleBookmark` | `(sessionId, stepIndex, userId, shareWithPartner): Promise<{ added, bookmark }>` | Delete if exists, create if not. |
| `getBookmarksBySession` | `(sessionId): Promise<ScriptureBookmark[]>` | Cache-first with background refresh. |

#### Message Methods

| Method | Signature | Description |
|---|---|---|
| `addMessage` | `(sessionId, senderId, message): Promise<ScriptureMessage>` | Insert to `scripture_messages`. Caches locally. |
| `getMessagesBySession` | `(sessionId): Promise<ScriptureMessage[]>` | Cache-first with background refresh. |

#### Cache Recovery

| Method | Description |
|---|---|
| `recoverSessionCache()` | Clear all session cache |
| `recoverReflectionCache(sessionId?)` | Clear reflection cache (optionally scoped to session) |
| `recoverBookmarkCache(sessionId?)` | Clear bookmark cache (optionally scoped to session) |
| `recoverMessageCache(sessionId?)` | Clear message cache (optionally scoped to session) |
| `recoverAllCaches()` | Clear all scripture caches |

---

### 9.9 LoveNoteImageService

**Module:** `src/services/loveNoteImageService.ts`

Functions (not a class) for love note image uploads and signed URL management.

#### Functions

| Function | Signature | Description |
|---|---|---|
| `uploadLoveNoteImage` | `(file: File, _userId: string): Promise<UploadResult>` | Client-side validation + compression, then upload via Edge Function. Returns `{ storagePath, compressedSize }`. |
| `uploadCompressedBlob` | `(blob: Blob, _userId: string): Promise<UploadResult>` | Upload pre-compressed blob (retry flows). |
| `getSignedImageUrl` | `(storagePath: string, forceRefresh?: boolean): Promise<SignedUrlResult>` | Get signed URL with LRU cache and request deduplication. |
| `needsUrlRefresh` | `(storagePath: string): boolean` | Check if cached URL needs refresh. |
| `clearSignedUrlCache` | `(): void` | Clear the in-memory signed URL cache. |
| `batchGetSignedUrls` | `(storagePaths: string[]): Promise<Map<string, SignedUrlResult \| null>>` | Batch fetch with cache optimization and parallel requests. |
| `deleteLoveNoteImage` | `(storagePath: string): Promise<void>` | Remove image from storage bucket. |

**Caching strategy:**
- In-memory `Map<string, CachedUrl>` with LRU eviction
- Configurable max cache size and refresh buffer
- Request deduplication via `pendingRequests` map

---

### 9.10 ImageCompressionService

**Module:** `src/services/imageCompressionService.ts`
**Singleton export:** `imageCompressionService`

Client-side image compression using Canvas API. No external dependencies.

#### Methods

| Method | Signature | Description |
|---|---|---|
| `compressImage` | `(file: File, options?: Partial<CompressionOptions>): Promise<CompressionResult>` | Resize to max 2048px, convert to JPEG at 80% quality. Strips EXIF. Fallback returns original on Canvas failure. |
| `validateImageFile` | `(file: File): { valid, error?, warning? }` | Check MIME type (JPEG/PNG/WebP) and size (max 25MB). Warning for files > threshold. |
| `estimateCompressedSize` | `(file: File): number` | Returns `file.size * 0.1` (10% estimate). |

**Defaults:**
- Max dimensions: 2048 x 2048
- JPEG quality: 0.8
- Typical compression: ~90% reduction (3-5MB to 300-500KB)
- Performance target: < 3 seconds for 10MB input

---

### 9.11 SyncService

**Module:** `src/services/syncService.ts`
**Singleton export:** `syncService` (instance of `SyncService`)

#### Types

```typescript
interface MoodSyncResult {
  localId: number;
  success: boolean;
  supabaseId?: string;
  error?: string;
}

interface SyncSummary {
  total: number;
  successful: number;
  failed: number;
  results: MoodSyncResult[];
}
```

#### Methods

| Method | Signature | Description |
|---|---|---|
| `syncPendingMoods` | `(): Promise<SyncSummary>` | Fetch unsynced moods from IndexedDB, upload each via `moodApi.create()`, mark as synced. Partial failure: continues on individual errors. |
| `hasPendingSync` | `(): Promise<boolean>` | Check if any unsynced moods exist. |
| `getPendingCount` | `(): Promise<number>` | Count of unsynced moods. |

---

### 9.12 PerformanceMonitor

**Module:** `src/services/performanceMonitor.ts`
**Singleton export:** `performanceMonitor`

#### Methods

| Method | Signature | Description |
|---|---|---|
| `measureAsync` | `<T>(name: string, operation: () => Promise<T>): Promise<T>` | Wrap an async operation with timing. Records metric on success. |
| `recordMetric` | `(name: string, duration: number): void` | Manually record a metric value. Maintains min/max/avg/count/total. |
| `getMetrics` | `(name: string): PerformanceMetric \| undefined` | Get metrics for a specific operation. |
| `getAllMetrics` | `(): Map<string, PerformanceMetric>` | Get all recorded metrics. |
| `clear` | `(): void` | Reset all metrics. |
| `getReport` | `(): string` | Human-readable report sorted by total duration descending. |

---

## 10. Edge Functions

### `upload-love-note-image`

**Location:** `supabase/functions/upload-love-note-image/index.ts`
**Runtime:** Deno (Supabase Edge Functions)
**URL:** `{SUPABASE_URL}/functions/v1/upload-love-note-image`

Server-side image upload handler with security validation that cannot be bypassed client-side.

#### Request

```
POST /functions/v1/upload-love-note-image
Authorization: Bearer {JWT}
Content-Type: application/octet-stream  (or multipart/form-data)
Body: raw image bytes
```

#### Configuration

| Setting | Value |
|---|---|
| Max file size | 5MB (compressed images) |
| Rate limit | 10 uploads per minute per user |
| Allowed MIME types | JPEG, PNG, WebP, GIF |
| Storage bucket | `love-notes-images` |
| Storage path format | `{user_id}/{timestamp}-{uuid}.jpg` |

#### Validation Pipeline

1. **Authentication:** Verify JWT via `supabase.auth.getUser()`.
2. **Rate limiting:** In-memory sliding window (10 uploads / 60 seconds per user). Resets on cold start.
3. **File size:** Reject if > 5MB.
4. **MIME type (magic bytes):** Inspect first 8-12 bytes for file signature. More secure than trusting `Content-Type` header.
5. **Upload:** Store in `love-notes-images` bucket with `cacheControl: '3600'`.

#### Response

**Success (200):**
```json
{
  "success": true,
  "storagePath": "{user_id}/{timestamp}-{uuid}.jpg",
  "size": 123456,
  "mimeType": "image/jpeg",
  "rateLimitRemaining": 8
}
```

**Error responses:**

| Status | Cause |
|---|---|
| 401 | Missing/invalid authorization |
| 405 | Non-POST method |
| 413 | File too large (> 5MB) |
| 415 | Invalid MIME type (magic bytes check) |
| 429 | Rate limit exceeded. `Retry-After: 60` header. |
| 500 | Upload failure or internal error |

---

## 11. Service Worker

### Main Service Worker

**Module:** `src/sw.ts`

Custom service worker extending Workbox for PWA precaching and Background Sync.

#### Caching Strategy

| Resource | Strategy | Cache Name | Expiry |
|---|---|---|---|
| Precached assets | Precache (Workbox manifest) | Workbox default | Automatic cleanup |
| JS / CSS | `NetworkOnly` | N/A | Always fresh |
| Navigation (HTML) | `NetworkFirst` (3s timeout) | `navigation-cache` | Falls back to precache |
| Images / Fonts | `CacheFirst` | `static-assets-v2` | 30 days, max 100 entries |
| Google Fonts | `CacheFirst` | `google-fonts-v2` | 1 year, max 30 entries |

#### Background Sync

**Trigger:** `sync` event with tag `sync-pending-moods`.

**Flow:**
1. Read unsynced moods from IndexedDB via `getPendingMoods()`.
2. Read auth token from IndexedDB via `getAuthToken()`.
3. Validate token expiry (5-minute buffer).
4. For each mood: call Supabase REST API directly via `fetch()` (no JS client).
5. On success: mark mood synced via `markMoodSynced()`.
6. Notify open clients via `postMessage({ type: 'BACKGROUND_SYNC_COMPLETED', successCount, failCount })`.
7. If all fail: throw to trigger Background Sync API retry.

**REST API call:**
```
POST {SUPABASE_URL}/rest/v1/moods
Headers:
  Content-Type: application/json
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {access_token}
  Prefer: return=representation
```

#### Message Handler

Listens for `SKIP_WAITING` messages to activate new service worker immediately.

---

### Service Worker Database Helpers

**Module:** `src/sw-db.ts`

IndexedDB operations designed for the service worker context (no window access).

#### Functions

| Function | Signature | Description |
|---|---|---|
| `getPendingMoods` | `(): Promise<StoredMoodEntry[]>` | Get all moods where `synced === false`. Opens/closes DB per call. |
| `markMoodSynced` | `(localId: number, supabaseId: string): Promise<void>` | Set `synced: true` and `supabaseId` on a mood entry. |
| `storeAuthToken` | `(token: Omit<StoredAuthToken, 'id'>): Promise<void>` | Store JWT + refresh token in `sw-auth` store for Background Sync. |
| `getAuthToken` | `(): Promise<StoredAuthToken \| null>` | Read current auth token from `sw-auth` store. |
| `clearAuthToken` | `(): Promise<void>` | Remove auth token (called on sign-out). |

**`StoredAuthToken` shape:**
```typescript
{
  id: 'current';       // Fixed key
  accessToken: string;
  refreshToken: string;
  expiresAt: number;   // Unix timestamp
  userId: string;
}
```

---

## 12. Real-time Subscriptions

**Module:** `src/services/realtimeService.ts`
**Singleton export:** `realtimeService` (instance of `RealtimeService`)

### Architecture

The application uses two real-time patterns:

| Pattern | Used For | Module |
|---|---|---|
| **Broadcast API** (client-to-client) | Mood updates between partners | `moodSyncService` |
| **postgres_changes** (server-to-client) | Incoming interactions (poke/kiss) | `interactionService`, `realtimeService` |

**Why two patterns?** RLS policies on the `moods` table use partner subqueries that Supabase Realtime cannot evaluate for `postgres_changes`. The Broadcast API bypasses this by having the sender explicitly broadcast to the partner's channel.

### RealtimeService Methods

#### `subscribeMoodChanges(userId, onMoodChange, onError?)`

```typescript
subscribeMoodChanges(
  userId: string,
  onMoodChange: MoodChangeCallback,
  onError?: ErrorCallback
): string
```

- **Purpose:** Watch for INSERT/UPDATE/DELETE on `moods` table filtered by `user_id`.
- **Uses:** `postgres_changes` with `event: '*'`.
- **Returns:** Channel ID string for unsubscribing.
- **Deduplication:** Warns if already subscribed to same channel.

---

#### `unsubscribe(channelId)`

```typescript
async unsubscribe(channelId: string): Promise<void>
```

- **Purpose:** Remove a specific realtime channel.

---

#### `unsubscribeAll()`

```typescript
async unsubscribeAll(): Promise<void>
```

- **Purpose:** Cleanup all active channels (component unmount / logout).

---

#### `setErrorHandler(callback)`

```typescript
setErrorHandler(callback: ErrorCallback): void
```

- **Purpose:** Set a global error handler for all subscriptions (used when no per-subscription handler is provided).

---

#### `getActiveSubscriptions()`

```typescript
getActiveSubscriptions(): number
```

- **Purpose:** Return count of active channels (for monitoring/debugging).

---

### Mood Broadcast Flow

1. User logs mood via `moodSyncService.syncMood()`.
2. Mood is inserted into Supabase via `moodApi.create()`.
3. `moodSyncService` looks up partner ID via `getPartnerId()`.
4. Creates ephemeral channel `mood-updates:{partnerId}`.
5. Broadcasts `{ type: 'broadcast', event: 'new_mood', payload: {...} }`.
6. Removes the ephemeral channel.

**Receiving side:**
1. Partner calls `moodSyncService.subscribeMoodUpdates()`.
2. This subscribes to `mood-updates:{ownUserId}` with `broadcast.self: false`.
3. Callback fires when partner's broadcast arrives.

### Interaction Realtime Flow

1. User calls `interactionService.sendPoke()` or `sendKiss()`.
2. Row is inserted into `interactions` table.
3. Partner's `subscribeInteractions()` picks up the INSERT via `postgres_changes` filtered by `to_user_id`.
4. Callback fires with the new interaction record.
