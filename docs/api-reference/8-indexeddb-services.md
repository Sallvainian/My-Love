# 8. IndexedDB Services

**Sources:**

- `src/services/BaseIndexedDBService.ts` -- Abstract generic base class
- `src/services/dbSchema.ts` -- Database schema, upgrade logic, type definitions
- `src/services/moodService.ts` -- Mood store operations
- `src/services/photoStorageService.ts` -- Photo store operations (see also Section 9)
- `src/services/customMessageService.ts` -- Custom message store operations
- `src/services/storage.ts` -- Legacy storage service + localStorage helpers

## Database Configuration

```typescript
const DB_NAME = 'my-love-db';
const DB_VERSION = 5;
```

**Library:** `idb` v8.0.3 (promise-based IndexedDB wrapper)

## Database Schema (`MyLoveDBSchema`)

| Store                   | Key             | Auto-increment | Indexes                                  |
| ----------------------- | --------------- | -------------- | ---------------------------------------- |
| `messages`              | `number`        | Yes            | `by-category` (string), `by-date` (Date) |
| `photos`                | `number`        | Yes            | `by-date` (Date)                         |
| `moods`                 | `number`        | Yes            | `by-date` (string, **unique**)           |
| `sw-auth`               | `'current'`     | No             | None                                     |
| `scripture-sessions`    | `string` (UUID) | No             | `by-user` (string)                       |
| `scripture-reflections` | `string` (UUID) | No             | `by-session` (string)                    |
| `scripture-bookmarks`   | `string` (UUID) | No             | `by-session` (string)                    |
| `scripture-messages`    | `string` (UUID) | No             | `by-session` (string)                    |

## Version History

| Version | Changes                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| v1      | `messages` store with `by-category` and `by-date` indexes                                                    |
| v2      | `photos` store (recreated from v1 with `imageBlob` field replacing `blob`)                                   |
| v3      | `moods` store with unique `by-date` index                                                                    |
| v4      | `sw-auth` store for Background Sync auth token storage                                                       |
| v5      | Scripture stores: `scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages` |

## `upgradeDb()` Function

Centralized upgrade handler called by all services. Handles all v1-v5 migrations in a single function to prevent schema drift between services.

```typescript
function upgradeDb(
  db: IDBPDatabase<MyLoveDBSchema>,
  oldVersion: number,
  _newVersion: number | null
): void;
```

## BaseIndexedDBService

Abstract generic base class providing DRY CRUD operations.

```typescript
abstract class BaseIndexedDBService<
  T extends { id?: number | string },
  DBTypes extends DBSchema,
  StoreName extends StoreNames<DBTypes>
>
```

### Error Handling Strategy

- **Read operations** (`get`, `getAll`, `getPage`): Return `null` or `[]` on error (graceful degradation)
- **Write operations** (`add`, `update`, `delete`, `clear`): Throw errors on failure (data integrity)

### Inherited Methods

| Method      | Signature                                                  | Error Behavior                                  |
| ----------- | ---------------------------------------------------------- | ----------------------------------------------- |
| `init()`    | `(): Promise<void>`                                        | Initialization guard with promise deduplication |
| `add()`     | `(item: Omit<T, 'id'>): Promise<T>`                        | **Protected.** Throws on failure                |
| `get()`     | `(id: number\|string): Promise<T\|null>`                   | Returns `null` on error                         |
| `getAll()`  | `(): Promise<T[]>`                                         | Returns `[]` on error                           |
| `update()`  | `(id: number\|string, updates: Partial<T>): Promise<void>` | Throws on failure                               |
| `delete()`  | `(id: number\|string): Promise<void>`                      | Throws on failure                               |
| `clear()`   | `(): Promise<void>`                                        | Throws on failure                               |
| `getPage()` | `(offset: number, limit: number): Promise<T[]>`            | Cursor-based pagination. Returns `[]` on error  |

### Abstract Methods (must implement)

- `getStoreName(): StoreName` -- Returns the object store name
- `_doInit(): Promise<void>` -- Service-specific DB initialization

---

## MoodService

**Singleton:** `export const moodService = new MoodService()`

**Extends:** `BaseIndexedDBService<MoodEntry, MyLoveDBSchema, 'moods'>`

### Service-Specific Methods

#### `create(userId, moods, note?): Promise<MoodEntry>`

Creates a mood entry with Zod validation via `MoodEntrySchema.parse()`.

**Parameters:**

- `userId: string` -- Authenticated user's UUID
- `moods: MoodEntry['mood'][]` -- Array of mood types (first is primary)
- `note?: string` -- Optional note (max 200 chars)

**Sets:** `date` to today (ISO string), `synced: false`, `supabaseId: undefined`

#### `updateMood(id, moods, note?): Promise<MoodEntry>`

Updates an existing mood entry. Re-validates with `MoodEntrySchema.parse()`. Sets `synced: false` to mark for re-sync.

#### `getMoodForDate(date: Date): Promise<MoodEntry | null>`

Queries the `by-date` index with the date string (YYYY-MM-DD). Returns `null` if not found.

#### `getMoodsInRange(start: Date, end: Date): Promise<MoodEntry[]>`

Uses `IDBKeyRange.bound()` on the `by-date` index.

#### `getUnsyncedMoods(): Promise<MoodEntry[]>`

Gets all moods then filters to `synced === false`. Used by sync services.

#### `markAsSynced(id: number, supabaseId: string): Promise<void>`

Sets `synced: true` and stores the `supabaseId` from Supabase.

---

## CustomMessageService

**Singleton:** `export const customMessageService = new CustomMessageService()`

**Extends:** `BaseIndexedDBService<Message, MyLoveDBSchema, 'messages'>`

### Service-Specific Methods

#### `create(input: CreateMessageInput): Promise<Message>`

Validates via `CreateMessageInputSchema.parse()`. Sets `isCustom: true`, `isFavorite: false`, timestamps.

#### `updateMessage(input: UpdateMessageInput): Promise<void>`

Validates via `UpdateMessageInputSchema.parse()`. Updates `updatedAt` timestamp.

#### `getAll(filter?: MessageFilter): Promise<Message[]>`

Supports filtering by:

- `category` -- uses `by-category` index (or all if `'all'`)
- `isCustom` -- boolean filter
- `active` -- boolean filter
- `searchTerm` -- case-insensitive text search
- `tags` -- array intersection match

#### `getActiveCustomMessages(): Promise<Message[]>`

Convenience: `getAll({ isCustom: true, active: true })`. Used by the daily message rotation algorithm.

#### `exportMessages(): Promise<CustomMessagesExport>`

Exports all custom messages to a JSON structure with `version: '1.0'`, `exportDate`, `messageCount`, and `messages` array.

#### `importMessages(exportData): Promise<{ imported: number, skipped: number }>`

Imports from a `CustomMessagesExport` JSON structure. Validates with `CustomMessagesExportSchema.parse()`. Performs duplicate detection by normalized text comparison. Returns counts of imported vs. skipped messages.

---

## StorageService (Legacy)

**Singleton:** `export const storageService = new StorageService()`

Legacy service providing direct IndexedDB CRUD for photos and messages. Not based on `BaseIndexedDBService`. Used by older parts of the codebase.

### Photo Operations

- `addPhoto(photo)` -- Returns `number` (auto-generated ID)
- `getPhoto(id)` -- Returns `Photo | undefined`
- `getAllPhotos()` -- Returns `Photo[]`
- `deletePhoto(id)` -- Throws on failure
- `updatePhoto(id, updates)` -- Throws on failure

### Message Operations

- `addMessage(message)` -- Returns `number`
- `getMessage(id)` -- Returns `Message | undefined`
- `getAllMessages()` -- Returns `Message[]`
- `getMessagesByCategory(category)` -- Uses `by-category` index
- `updateMessage(id, updates)` -- Throws on failure
- `deleteMessage(id)` -- Throws on failure
- `toggleFavorite(messageId)` -- Toggles `isFavorite` field
- `addMessages(messages[])` -- Bulk insert via transaction

### Bulk Operations

- `clearAllData()` -- Clears `photos` and `messages` stores
- `exportData()` -- Returns `{ photos: Photo[], messages: Message[] }`

---

## localStorageHelper

Utility object for `localStorage` with JSON serialization and error handling.

```typescript
localStorageHelper.get<T>(key: string, defaultValue: T): T
localStorageHelper.set<T>(key: string, value: T): void
localStorageHelper.remove(key: string): void
localStorageHelper.clear(): void
```

All methods silently catch errors and log them. `get()` returns `defaultValue` on parse failure.
