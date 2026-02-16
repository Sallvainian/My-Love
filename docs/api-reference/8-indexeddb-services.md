# 8. IndexedDB Services

**Sources:**
- `src/services/BaseIndexedDBService.ts` (abstract base class)
- `src/services/dbSchema.ts` (shared schema and upgrade logic)
- `src/services/moodService.ts` (mood tracking)
- `src/services/customMessageService.ts` (love messages)
- `src/services/photoStorageService.ts` (photo gallery)

## Overview

All local storage uses a single IndexedDB database (`my-love-db`) with a shared schema. Three concrete services extend `BaseIndexedDBService` to provide domain-specific CRUD operations with Zod validation at service boundaries.

## BaseIndexedDBService (Abstract)

```typescript
abstract class BaseIndexedDBService<
  T extends { id?: number | string },
  DBTypes extends DBSchema = DBSchema,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
>
```

### Abstract Methods (services must implement)

| Method | Returns | Purpose |
|--------|---------|---------|
| `getStoreName()` | `StoreName` | Returns the object store name |
| `_doInit()` | `Promise<void>` | Opens the DB connection with `openDB()` |

### Shared Methods (inherited)

| Method | Signature | Error Strategy |
|--------|-----------|----------------|
| `init()` | `(): Promise<void>` | Guard prevents concurrent init |
| `add(item)` | `(Omit<T,'id'>): Promise<T>` | **Throws** on failure |
| `get(id)` | `(number\|string): Promise<T\|null>` | Returns `null` on failure |
| `getAll()` | `(): Promise<T[]>` | Returns `[]` on failure |
| `update(id, updates)` | `(number\|string, Partial<T>): Promise<void>` | **Throws** on failure |
| `delete(id)` | `(number\|string): Promise<void>` | **Throws** on failure |
| `clear()` | `(): Promise<void>` | **Throws** on failure |
| `getPage(offset, limit)` | `(number, number): Promise<T[]>` | Returns `[]` on failure |

### Error Handling Strategy

- **Read operations** (`get`, `getAll`, `getPage`): Return `null` or empty array. The app displays empty UI instead of crashing.
- **Write operations** (`add`, `update`, `delete`, `clear`): Throw errors. Data integrity requires explicit failure so callers can provide user feedback.

### Initialization Guard

The `init()` method stores the in-progress promise in `initPromise` to prevent concurrent initialization. If `init()` is called while already in progress, the second call awaits the same promise. If `this.db` is already set, it returns immediately.

### Cursor-Based Pagination

`getPage(offset, limit)` opens an IDB cursor, advances it `offset` positions, then collects `limit` items. This is O(offset + limit) instead of O(n) from a naive `getAll().slice()` approach.

### Protected Helpers

- `getTypedDB()`: Returns `this.db` with the correct `IDBPDatabase<DBTypes>` type, throwing if not initialized.
- `handleError(operation, error)`: Logs and re-throws (return type `never`).
- `handleQuotaExceeded()`: Throws a `'IndexedDB storage quota exceeded'` error.
- `add()` is `protected` -- services expose a `create()` method that validates with Zod before calling `add()`.

## Database Schema (dbSchema.ts)

### Configuration

```typescript
const DB_NAME = 'my-love-db';
const DB_VERSION = 5;
```

### Object Stores

| Store Name | Key | Auto-Increment | Indexes | Version Added |
|------------|-----|----------------|---------|---------------|
| `messages` | `id: number` | Yes | `by-category` (category), `by-date` (createdAt) | v1 |
| `photos` | `id: number` | Yes | `by-date` (uploadDate) | v2 |
| `moods` | `id: number` | Yes | `by-date` (date, **unique**) | v3 |
| `sw-auth` | `id: 'current'` | No | None | v4 |
| `scripture-sessions` | `id: string` | No | `by-user` (userId) | v5 |
| `scripture-reflections` | `id: string` | No | `by-session` (sessionId) | v5 |
| `scripture-bookmarks` | `id: string` | No | `by-session` (sessionId) | v5 |
| `scripture-messages` | `id: string` | No | `by-session` (sessionId) | v5 |

### Centralized Upgrade Function

```typescript
function upgradeDb(db: IDBPDatabase<MyLoveDBSchema>, oldVersion: number, _newVersion: number | null): void
```

All three services delegate to this single function in their `_doInit()` callback. It uses `if (oldVersion < N)` guards to create stores incrementally. The v1-to-v2 photos migration is a special case handled in `photoStorageService._doInit()` because it requires transaction access for data preservation (renaming `blob` to `imageBlob`).

### Schema Types

```typescript
interface StoredAuthToken {
  id: 'current';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

type StoredMoodEntry = MoodEntry; // Semantic alias

// Scripture types: ScriptureSession, ScriptureReflection, ScriptureBookmark, ScriptureMessage
```

Store name constants are exported via `STORE_NAMES` for type-safe access.

## MoodService

**Source:** `src/services/moodService.ts`
**Singleton:** `moodService`
**Extends:** `BaseIndexedDBService<MoodEntry, MyLoveDBSchema, 'moods'>`

### `create(userId, moods, note?): Promise<MoodEntry>`

Creates a new mood entry with Zod validation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | Authenticated user's UUID |
| `moods` | `MoodEntry['mood'][]` | Array of mood types (first is primary) |
| `note` | `string?` | Optional note (max 200 chars) |

Sets `date` to today's ISO date, `synced: false`, `supabaseId: undefined`. Validates via `MoodEntrySchema.parse()` before calling `super.add()`.

### `updateMood(id, moods, note?): Promise<MoodEntry>`

Updates an existing mood. Re-validates, sets `synced: false` to trigger re-sync.

### `getMoodForDate(date: Date): Promise<MoodEntry | null>`

Looks up a mood by the `by-date` unique index. Used to enforce one-mood-per-day constraint.

### `getMoodsInRange(start, end): Promise<MoodEntry[]>`

Queries the `by-date` index with `IDBKeyRange.bound()` for calendar views.

### `getUnsyncedMoods(): Promise<MoodEntry[]>`

Returns all moods where `synced === false`. Used by sync services.

### `markAsSynced(id, supabaseId): Promise<void>`

Sets `synced: true` and stores the Supabase UUID for deduplication.

## CustomMessageService

**Source:** `src/services/customMessageService.ts`
**Singleton:** `customMessageService`
**Extends:** `BaseIndexedDBService<Message, MyLoveDBSchema, 'messages'>`

### `create(input: CreateMessageInput): Promise<Message>`

Validates via `CreateMessageInputSchema.parse()`, then calls `super.add()` with `isCustom: true`, `active: true`, `isFavorite: false`, and current timestamps.

### `updateMessage(input: UpdateMessageInput): Promise<void>`

Validates via `UpdateMessageInputSchema.parse()`, merges only provided fields, auto-updates `updatedAt`.

### `getAll(filter?: MessageFilter): Promise<Message[]>`

Overrides base `getAll()` to support filtering.

| Filter Field | Type | Description |
|-------------|------|-------------|
| `category` | `MessageCategory` | Uses `by-category` index when not `'all'` |
| `isCustom` | `boolean?` | Filter by custom vs. built-in |
| `active` | `boolean?` | Filter by active status |
| `searchTerm` | `string?` | Case-insensitive text search |
| `tags` | `string[]?` | Match any tag |

### `getActiveCustomMessages(): Promise<Message[]>`

Convenience: `getAll({ isCustom: true, active: true })`. Used by the daily rotation algorithm.

### `exportMessages(): Promise<CustomMessagesExport>`

Exports all custom messages as JSON with version `'1.0'`. Returns empty export on failure.

### `importMessages(exportData): Promise<{ imported: number; skipped: number }>`

Validates the import structure via `CustomMessagesExportSchema.parse()`, detects duplicates by normalized text, creates non-duplicate entries.

## PhotoStorageService

**Source:** `src/services/photoStorageService.ts`
**Singleton:** `photoStorageService`
**Extends:** `BaseIndexedDBService<Photo, MyLoveDBSchema, 'photos'>`

### `create(photo: Omit<Photo, 'id'>): Promise<Photo>`

Validates via `PhotoSchema.parse()`, calls `super.add()`, records size metric via `performanceMonitor`.

### `getAll(): Promise<Photo[]>`

Overrides base to use `by-date` index (`getAllFromIndex`) and reverses for newest-first ordering.

### `getPage(offset?, limit?): Promise<Photo[]>`

Overrides base to use `by-date` index with a `'prev'` (descending) cursor for efficient newest-first pagination.

### `update(id, updates): Promise<void>`

Overrides base to add `PhotoSchema.partial().parse()` validation before delegating to `super.update()`.

### `getStorageSize(): Promise<number>`

Returns total `compressedSize` across all photos in bytes.

### `estimateQuotaRemaining(): Promise<{ used, quota, remaining, percentUsed }>`

Uses `navigator.storage.estimate()` (Storage API) to report IndexedDB quota usage. Falls back to a conservative default if the API is unavailable.

### v1-to-v2 Migration

The `_doInit()` method handles a special case: if upgrading from v1 to v2, it reads all existing photos from the old store (which used `blob` field), transforms them to the v2 schema (`imageBlob` field), lets `upgradeDb()` recreate the store, then re-inserts the migrated records. This requires direct transaction access that the centralized `upgradeDb()` function cannot provide.
