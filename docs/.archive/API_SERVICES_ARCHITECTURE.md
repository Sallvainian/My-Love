# API & Services Layer Architecture Report

## My-Love Application - Comprehensive Technical Documentation

**Generated**: 2025-11-16  
**Scope**: `/src/api/` and `/src/services/` layer analysis  
**Purpose**: Document Supabase integration, authentication, data sync, and IndexedDB service patterns

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [API Layer Architecture](#api-layer-architecture)
3. [Services Layer Architecture](#services-layer-architecture)
4. [Authentication & Authorization Flow](#authentication--authorization-flow)
5. [Real-time Sync Capabilities](#real-time-sync-capabilities)
6. [IndexedDB Service Patterns](#indexeddb-service-patterns)
7. [Error Handling Strategies](#error-handling-strategies)
8. [Data Migration Patterns](#data-migration-patterns)
9. [Performance Monitoring](#performance-monitoring)

---

## Executive Summary

The My-Love application implements a sophisticated **offline-first, cloud-synchronous architecture** with:

- **Supabase Backend**: PostgreSQL database with Row Level Security (RLS), real-time subscriptions, and authentication
- **API Layer**: Validated service wrapper around Supabase using Zod schemas for type safety
- **Service Layer**: IndexedDB-based local storage with inherited CRUD patterns from `BaseIndexedDBService`
- **Sync Strategy**: Local-first with background sync to cloud, exponential backoff retry logic
- **Authentication**: Email/password and Google OAuth support with JWT session management

**Key Architecture Decisions**:

- Zod validation on all API responses (runtime type safety)
- Singleton pattern for all services to ensure single instance across app
- Abstract base class (`BaseIndexedDBService`) to eliminate ~80% code duplication
- Graceful degradation on network errors (read operations fail silently, write operations throw)
- Concurrent initialization guards to prevent race conditions

---

## API Layer Architecture

### 1. Supabase Client (`supabaseClient.ts`)

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

### 2. Authentication Service (`authService.ts`)

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

### 3. Mood API Service (`moodApi.ts`)

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

### 4. Mood Sync Service (`moodSyncService.ts`)

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

### 5. Partner Service (`partnerService.ts`)

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

### 6. Interaction Service (`interactionService.ts`)

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

### 7. Error Handlers (`errorHandlers.ts`)

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

### 8. Validation Schemas (`validation/supabaseSchemas.ts`)

**Purpose**: Runtime validation of all Supabase API responses using Zod

**Schema Categories**:

#### User Schemas

- `SupabaseUserSchema`: Validates user table rows
- `UserInsertSchema`: Validates insert operations
- `UserUpdateSchema`: Validates partial updates

#### Mood Schemas

- `SupabaseMoodSchema`: Complete mood record validation
- `MoodTypeSchema`: Enum validation (loved, happy, content, thoughtful, grateful, sad, anxious, frustrated, lonely, tired)
- `MoodInsertSchema`: Insert operation with max 200 char notes
- `MoodUpdateSchema`: Partial update validation
- `MoodArraySchema`: Array of moods for batch queries

#### Interaction Schemas

- `SupabaseInteractionSchema`: Validates interaction records
- `InteractionTypeSchema`: Enum (poke, kiss)
- `InteractionInsertSchema`: Insert validation
- `InteractionArraySchema`: Batch responses

#### Timestamp Validation

```typescript
// Accepts ISO 8601 formats:
// ✓ 2025-01-15T10:30:00Z
// ✓ 2025-01-15T10:30:00.123456Z
// ✓ 2025-01-15T10:30:00.123456+00:00
```

---

## Services Layer Architecture

### 1. Base IndexedDB Service (`BaseIndexedDBService.ts`)

**Purpose**: Generic CRUD foundation eliminating ~80% code duplication across services

**Architecture Pattern**: Template Method + Generic Types

```typescript
export abstract class BaseIndexedDBService<
  T extends { id?: number },
  DBTypes extends DBSchema = DBSchema,
> {
  // Template methods (must implement)
  protected abstract _doInit(): Promise<void>;
  protected abstract getStoreName(): string;

  // Shared methods (inherited by all services)
  async init(): Promise<void>;
  async add(item: Omit<T, 'id'>): Promise<T>;
  async get(id: number): Promise<T | null>;
  async getAll(): Promise<T[]>;
  async update(id: number, updates: Partial<T>): Promise<void>;
  async delete(id: number): Promise<void>;
  async clear(): Promise<void>;
  async getPage(offset: number, limit: number): Promise<T[]>;
}
```

**Initialization Guard Pattern**:

```typescript
async init(): Promise<void> {
  // Prevent concurrent initialization
  if (this.initPromise) {
    return this.initPromise;
  }

  // Already initialized
  if (this.db) {
    return Promise.resolve();
  }

  // Run initialization (stored promise)
  this.initPromise = this._doInit();
  try {
    await this.initPromise;
  } finally {
    this.initPromise = null;
  }
}
```

**Error Handling Strategy**:

| Operation                       | Behavior                | Rationale                                         |
| ------------------------------- | ----------------------- | ------------------------------------------------- |
| **Read** (get, getAll, getPage) | Return null/[] on error | Graceful degradation - app works with empty state |
| **Write** (add, update, delete) | Throw error             | Explicit failure - prevents silent data loss      |

**Pagination with Cursor**:

- Efficient memory usage: O(offset + limit) instead of O(n)
- Uses IDBCursor to skip offset items, then collect limit items
- Supports descending order for date-based pagination

### 2. Storage Service (`storage.ts`)

**Purpose**: Photo and message operations for original legacy stores

**Status**: Partially migrated to `BaseIndexedDBService`

**Database**:

- Name: `my-love-db`
- Current Version: 3
- Stores: photos, messages (moods handled by MoodService)

**Photo Operations**:

- `addPhoto()`, `getPhoto()`, `getAllPhotos()`, `deletePhoto()`, `updatePhoto()`
- Returns `undefined` gracefully on read failures

**Message Operations**:

- `addMessage()`, `getMessage()`, `getAllMessages()`, `deleteMessage()`, `updateMessage()`
- `getMessagesByCategory()`: Index-based retrieval
- `toggleFavorite()`: Boolean toggle with update
- `addMessages()`: Bulk insert with transaction

**Local Storage Helpers**:

```typescript
localStorageHelper.get<T>(key, defaultValue): T;
localStorageHelper.set<T>(key, value): void;
localStorageHelper.remove(key): void;
localStorageHelper.clear(): void;
```

### 3. Photo Storage Service (`photoStorageService.ts`)

**Purpose**: Specialized IndexedDB service for photo metadata and media access

**Extends**: `BaseIndexedDBService<Photo>`

**Unique Features**:

- Overrides `getAll()` to use 'by-date' index (newest first)
- Custom `getPage()` with descending cursor for pagination
- Zod validation on create/update operations
- Storage quota estimation (`estimateQuotaRemaining()`)
- Compression size tracking

**DB Migration v1 → v2**:

- v1 had photos store but old schema (field: `blob`)
- v2 enhanced schema with: `imageBlob`, compression metadata
- Migration preserves existing photos, transforms field names

**Validation**:

```typescript
// Throws ValidationError if invalid
const photo = await photoStorageService.create({
  caption: 'My photo',
  tags: ['vacation'],
  imageBlob: compressedBlob,
  width: 1920,
  height: 1080,
  compressedSize: 350000,
  uploadDate: new Date(),
});
```

**Storage Quota Monitoring**:

```typescript
const quota = await photoStorageService.estimateQuotaRemaining();
// Returns: { used, quota, remaining, percentUsed }
// Warnings at 80%, errors at 95%
```

### 4. Custom Message Service (`customMessageService.ts`)

**Purpose**: Custom message CRUD for user-created affirmations

**Extends**: `BaseIndexedDBService<Message>`

**Features**:

- Multi-filter support: category, active status, search term, tags
- Import/export functionality with duplicate detection
- Zod validation on all inputs

**Methods**:

| Method                      | Purpose                   | Validation                 |
| --------------------------- | ------------------------- | -------------------------- |
| `create(input)`             | New custom message        | CreateMessageInputSchema   |
| `updateMessage(input)`      | Update existing           | UpdateMessageInputSchema   |
| `getAll(filter?)`           | Get with optional filters | N/A                        |
| `getActiveCustomMessages()` | Rotation algorithm source | isCustom=true, active=true |
| `exportMessages()`          | Backup to JSON            | CustomMessagesExportSchema |
| `importMessages(data)`      | Restore from JSON         | Duplicate detection        |

**Filtering Example**:

```typescript
// Get active custom messages in "affirmation" category
const active = await customMessageService.getAll({
  isCustom: true,
  active: true,
  category: 'affirmation',
  searchTerm: 'strength',
  tags: ['resilience'],
});
```

### 5. Mood Service (`moodService.ts`)

**Purpose**: Mood entry tracking with sync status, local-first pattern

**Extends**: `BaseIndexedDBService<MoodEntry, MyLoveDBSchema>`

**DB Migration v2 → v3**:

- v2: messages, photos stores
- v3: Add moods store with unique by-date index (one mood per day)

**Key Methods**:

| Method                           | Purpose          | Returns           |
| -------------------------------- | ---------------- | ----------------- |
| `create(userId, moods[], note?)` | New mood entry   | MoodEntry with id |
| `updateMood(id, moods[], note?)` | Edit mood entry  | Updated MoodEntry |
| `getMoodForDate(date)`           | Get today's mood | MoodEntry or null |
| `getMoodsInRange(start, end)`    | Date range query | MoodEntry[]       |
| `getUnsyncedMoods()`             | Pending sync     | MoodEntry[]       |
| `markAsSynced(id, supabaseId)`   | Mark uploaded    | void              |

**Data Model**:

```typescript
interface MoodEntry {
  id?: number; // IndexedDB auto-increment
  userId: string; // Supabase UUID
  mood: MoodEntry['mood']; // Primary mood (backward compat)
  moods: MoodEntry['mood'][]; // All selected moods
  note: string; // Optional note
  date: string; // ISO YYYY-MM-DD (unique)
  timestamp: Date; // Full ISO timestamp
  synced: boolean; // Sync status
  supabaseId?: string; // Supabase UUID after sync
}
```

**One-Mood-Per-Day Constraint**:

- by-date index with unique: true prevents duplicates
- Second call same day updates existing entry (not allowed by index)

### 6. Sync Service (`syncService.ts`)

**Purpose**: Offline-first sync from IndexedDB to Supabase

**Pattern**: Partial failure handling (continue syncing if some fail)

**Methods**:

| Method               | Purpose                 | Returns     |
| -------------------- | ----------------------- | ----------- |
| `syncPendingMoods()` | Batch sync all unsynced | SyncSummary |
| `hasPendingSync()`   | Check if work exists    | boolean     |
| `getPendingCount()`  | Count pending moods     | number      |

**SyncSummary**:

```typescript
interface SyncSummary {
  total: number; // Total moods synced
  successful: number; // Successfully uploaded
  failed: number; // Failed uploads
  results: MoodSyncResult[]; // Per-mood details
}

interface MoodSyncResult {
  localId: number; // IndexedDB id
  success: boolean;
  supabaseId?: string; // After successful sync
  error?: string;
}
```

**Transform Pipeline**:

```
IndexedDB MoodEntry → MoodInsert Format → Supabase Upload → Mark As Synced
```

### 7. Realtime Service (`realtimeService.ts`)

**Purpose**: Supabase Realtime subscriptions with error handling

**Features**:

- Multiple channel management
- Global + local error handlers
- Connection status tracking

**Methods**:

| Method                                                 | Purpose              | Event Filter                |
| ------------------------------------------------------ | -------------------- | --------------------------- |
| `subscribeMoodChanges(userId, onMoodChange, onError?)` | Watch user moods     | event=\*, filter by user_id |
| `unsubscribe(channelId)`                               | Stop listening       | N/A                         |
| `unsubscribeAll()`                                     | Cleanup all          | N/A                         |
| `setErrorHandler(callback)`                            | Global error handler | N/A                         |
| `getActiveSubscriptions()`                             | Count active         | N/A                         |

**Connection Statuses**:

- `SUBSCRIBED`: Connected and listening
- `CHANNEL_ERROR`: Error during subscription
- `TIMED_OUT`: Connection timeout
- `CLOSED`: Channel removed

### 8. Migration Service (`migrationService.ts`)

**Purpose**: One-time LocalStorage → IndexedDB migration for custom messages

**Function**: `migrateCustomMessagesFromLocalStorage()`

**Process**:

1. Check LocalStorage for `my-love-custom-messages`
2. Parse JSON data
3. Validate structure (is array)
4. Fetch existing IndexedDB messages for duplicate detection
5. For each message:
   - Validate with Zod schema
   - Check for duplicates
   - Create in IndexedDB if new
   - Count skipped/migrated
6. Delete LocalStorage data on completion

**Result**:

```typescript
interface MigrationResult {
  success: boolean; // No validation errors
  migratedCount: number; // Successfully migrated
  skippedCount: number; // Duplicates or validation errors
  errors: string[]; // Error messages
}
```

**Idempotent**: If LocalStorage missing, returns empty result (already migrated)

### 9. Image Compression Service (`imageCompressionService.ts`)

**Purpose**: Client-side image compression for photo storage

**Configuration**:

```typescript
{
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,  // JPEG 80% quality
}
```

**Methods**:

| Method                          | Purpose                     | Input       | Output            |
| ------------------------------- | --------------------------- | ----------- | ----------------- |
| `compressImage(file, options?)` | Compress image              | File object | CompressionResult |
| `validateImageFile(file)`       | Validate before compression | File object | Validation result |
| `estimateCompressedSize(file)`  | Preview size                | File object | bytes             |

**Compression Result**:

```typescript
interface CompressionResult {
  blob: Blob; // Compressed JPEG
  width: number; // Final width
  height: number; // Final height
  originalSize: number; // Original file size
  compressedSize: number; // Compressed blob size
}
```

**Performance**:

- Typical: 3-5MB → 300-500KB (~90% reduction)
- Time: <3 seconds on modern devices
- Uses Canvas API (no external dependencies)

### 10. Performance Monitor (`performanceMonitor.ts`)

**Purpose**: Track operation execution times and generate metrics reports

**Methods**:

| Method                          | Purpose                | Returns                        |
| ------------------------------- | ---------------------- | ------------------------------ |
| `measureAsync(name, operation)` | Measure async function | Operation result               |
| `recordMetric(name, duration)`  | Record metric manually | void                           |
| `getMetrics(name)`              | Get specific metric    | PerformanceMetric              |
| `getAllMetrics()`               | Get all metrics        | Map<string, PerformanceMetric> |
| `clear()`                       | Reset all metrics      | void                           |
| `getReport()`                   | Generate text report   | string                         |

**PerformanceMetric**:

```typescript
interface PerformanceMetric {
  name: string;
  count: number; // Execution count
  avgDuration: number; // Average ms
  minDuration: number; // Min ms
  maxDuration: number; // Max ms
  totalDuration: number; // Total ms
  lastRecorded: number; // Timestamp
}
```

**Usage**:

```typescript
// Automatic measurement
const result = await performanceMonitor.measureAsync('db-read', () => photoStorageService.get(id));

// Manual recording
performanceMonitor.recordMetric('photo-upload-size', 350000);

// Generate report
console.log(performanceMonitor.getReport());
```

---

## Authentication & Authorization Flow

### Sign-Up Flow

```
User enters email/password
  ↓
authService.signUp(credentials)
  ↓
Supabase Auth creates user
  ↓
Creates JWT tokens (access + refresh)
  ↓
Browser persists tokens (localStorage)
  ↓
App subscribes to auth state changes
  ↓
Display onboarding or main app
```

### Sign-In Flow

```
User enters email/password
  ↓
authService.signIn(credentials)
  ↓
Supabase validates credentials
  ↓
JWT tokens returned
  ↓
Browser persists tokens
  ↓
Token auto-refresh handles expiry
  ↓
User can access protected resources
```

### Google OAuth Flow

```
User clicks "Sign in with Google"
  ↓
authService.signInWithGoogle()
  ↓
Redirect to Google login page
  ↓
User authenticates with Google
  ↓
Google redirects back to app with auth code
  ↓
Supabase exchanges code for JWT tokens
  ↓
Creates user record with email from Google profile
  ↓
Browser persists tokens
  ↓
App is now authenticated
```

### Row Level Security (RLS)

```
All API queries include JWT token
  ↓
Database checks auth.uid() in policies
  ↓
User can only access their own data
  ↓
Partner data accessible only if partner_id matches
  ↓
Queries filtered at database layer (secure)
```

**Example RLS Policy**:

```sql
-- Allow users to read only their own moods
CREATE POLICY "users_can_read_own_moods" ON moods
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to read partner's moods if connected
CREATE POLICY "users_can_read_partner_moods" ON moods
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM users WHERE partner_id = moods.user_id
    )
  );
```

---

## Real-time Sync Capabilities

### Real-time Architecture

```
Supabase Realtime (WebSocket)
  ↓
Listens to postgres_changes events
  ↓
Filters by schema, table, user_id
  ↓
Broadcasts INSERT/UPDATE/DELETE events
  ↓
Client subscriptions receive events
  ↓
Callbacks update local state
```

### Partner Mood Updates (Real-time)

```
User A logs mood (INSERT into moods table)
  ↓
Postgres trigger detects change
  ↓
Realtime broadcasts INSERT event
  ↓
User B's subscription receives event
  ↓
moodSyncService.subscribeMoodUpdates() callback fires
  ↓
UI updates: new mood visible, notification shown
```

### Interaction Updates (Real-time)

```
User A sends poke/kiss (INSERT into interactions)
  ↓
Realtime broadcasts INSERT event
  ↓
User B receives via interactionService.subscribeInteractions()
  ↓
Callback triggers: animation, notification, badge update
```

### Subscription Management

```typescript
// Subscribe
const unsubscribe = await interactionService.subscribeInteractions((interaction) => {
  // Update UI with new interaction
  showNotification(`Received ${interaction.type}`);
});

// When component unmounts or user signs out
unsubscribe();
```

---

## IndexedDB Service Patterns

### Service Hierarchy

```
BaseIndexedDBService<T, DBSchema>
  ├── PhotoStorageService extends BaseIndexedDBService<Photo>
  ├── CustomMessageService extends BaseIndexedDBService<Message>
  └── MoodService extends BaseIndexedDBService<MoodEntry, MyLoveDBSchema>

StorageService (legacy, not inherited)
  ├── Photo operations
  └── Message operations
```

### Initialization Pattern

```typescript
class MyService extends BaseIndexedDBService<MyType> {
  protected async _doInit(): Promise<void> {
    this.db = await openDB<MySchema>('my-love-db', VERSION_NUMBER, {
      upgrade(db, oldVersion, newVersion) {
        // Create/migrate object stores
        if (!db.objectStoreNames.contains('mystore')) {
          const store = db.createObjectStore('mystore', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-date', 'createdAt');
        }
      },
    });
  }

  protected getStoreName(): string {
    return 'mystore';
  }
}

// Usage: automatic initialization
await myService.init(); // Called by first operation if not done
```

### CRUD Operations

**Create**:

```typescript
const created = await service.add({
  /* data */
});
// Returns: { ...data, id: <auto-incremented> }
```

**Read**:

```typescript
const item = await service.get(id); // Single item or null
const items = await service.getAll(); // All items or []
const page = await service.getPage(offset, limit); // Paginated or []
```

**Update**:

```typescript
await service.update(id, {
  /* partial updates */
});
// Throws error if id not found
```

**Delete**:

```typescript
await service.delete(id);
// Throws error if id not found
```

**Clear**:

```typescript
await service.clear();
// Throws error if operation fails
```

### Database Versions & Migrations

| Service              | Version | Stores           | Key Features          |
| -------------------- | ------- | ---------------- | --------------------- |
| StorageService       | 3       | messages, photos | Baseline              |
| PhotoStorageService  | 2       | photos           | Enhanced schema v1→v2 |
| CustomMessageService | 1       | messages         | Initial version       |
| MoodService          | 3       | moods            | Unique by-date index  |

**Migration Pattern** (v2 → v3 for moods):

```typescript
async upgrade(db, oldVersion, newVersion) {
  if (oldVersion < 3) {
    // Create new moods store with unique date index
    const moods = db.createObjectStore('moods', {
      keyPath: 'id',
      autoIncrement: true,
    });
    moods.createIndex('by-date', 'date', { unique: true });
  }
}
```

---

## Error Handling Strategies

### API Layer Error Handling

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

### Service Layer Error Handling

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

### Offline-First Error Messages

```typescript
// Network error message
"You're offline. Your changes will be synced automatically when you're back online.";

// Retry message
'Sync attempt 1 failed, retrying in 1000ms...';

// Permanent failure
'Failed to sync mood after 4 attempts. Please try again later.';
```

---

## Data Migration Patterns

### 1. LocalStorage → IndexedDB (One-time)

**Migration Service** handles custom messages migration:

```
1. Read from localStorage
2. Parse JSON
3. Validate each record
4. Check for duplicates in IndexedDB
5. Insert new records
6. Delete localStorage data
```

**Idempotent**: Running twice has no effect (localStorage already deleted)

### 2. IndexedDB Schema v1 → v2 (Photos)

**In-place Data Preservation**:

```
1. Read all v1 photos before deleting store
2. Transform field names (blob → imageBlob)
3. Delete old store
4. Create new v2 store with enhanced schema
5. Re-insert transformed photos
```

**Zero Data Loss**: Existing photos retained with compatible schema

### 3. IndexedDB v2 → v3 (Add Moods)

**Append-only Migration**:

```
1. Create new moods store (doesn't affect existing stores)
2. Existing messages and photos stores remain unchanged
3. No data transformation required
```

---

## Performance Monitoring

### Measured Operations

**Photo Operations**:

- `photo-create`: Create new photo
- `photo-getAll`: Load all photos
- `photo-getPage`: Paginated load

**Database Operations**:

- `db-read`: Single item read
- `db-write`: Insert/update operation
- `db-query`: Complex query

**Service Operations**:

- `sync-mood`: Sync single mood
- `sync-batch`: Batch sync moods

**Custom Metrics**:

- `photo-size-kb`: Photo size tracking
- `compression-ratio`: Compression effectiveness

### Performance Report Example

```
Performance Metrics Report
==================================================

photo-getAll:
  count: 5
  avg: 45.32ms
  min: 12.10ms
  max: 89.20ms
  total: 226.60ms

db-write:
  count: 12
  avg: 23.15ms
  min: 5.20ms
  max: 67.80ms
  total: 277.80ms

sync-mood:
  count: 3
  avg: 234.56ms
  min: 145.20ms
  max: 356.80ms
  total: 703.68ms
```

---

## Appendix: Type Definitions

### Core Entity Types

```typescript
// User (from Supabase auth)
interface User {
  id: string; // UUID
  email: string;
  user_metadata?: Record<string, any>;
}

// Session (JWT tokens)
interface Session {
  user: User;
  access_token: string; // JWT access token
  refresh_token: string; // Refresh token
  expires_in: number; // Seconds until expiry
}

// Mood Entry (local)
interface MoodEntry {
  id?: number;
  userId: string; // Supabase UUID
  mood: string; // Primary mood
  moods: string[]; // All selected moods
  note: string;
  date: string; // YYYY-MM-DD
  timestamp: Date;
  synced: boolean;
  supabaseId?: string;
}

// Photo (local)
interface Photo {
  id?: number;
  imageBlob: Blob;
  caption?: string;
  tags?: string[];
  uploadDate: Date;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

// Message (local)
interface Message {
  id?: number;
  text: string;
  category: 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';
  isCustom: boolean;
  active: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
}
```

---

## Summary

The My-Love application implements a sophisticated, **production-ready** backend architecture with:

1. **Type-Safe APIs**: Zod validation on all Supabase responses
2. **Offline-First**: IndexedDB local storage with background sync
3. **Real-time Collaboration**: WebSocket subscriptions for partner updates
4. **Security**: Row Level Security at database layer, JWT token management
5. **Scalability**: Singleton services, cursor-based pagination, performance monitoring
6. **Reliability**: Exponential backoff retry logic, graceful error handling, data migrations

All services follow consistent patterns for initialization, error handling, and data validation, making the codebase maintainable and extensible.
