# 8. IndexedDB Services

**Sources:**

- `src/services/BaseIndexedDBService.ts` -- Abstract base class
- `src/services/dbSchema.ts` -- Shared schema, upgrade function, constants
- `src/services/moodService.ts` -- Mood IndexedDB CRUD
- `src/services/customMessageService.ts` -- Message IndexedDB CRUD
- `src/services/scriptureReadingService.ts` -- Scripture cache (see [doc 13](./13-scripture-reading-service.md))
- `src/services/storage.ts` -- Legacy direct CRUD for `photos` and `messages` (see [doc 14](./14-additional-services.md))

## BaseIndexedDBService

Abstract generic class providing shared CRUD operations for all IndexedDB stores.

```typescript
abstract class BaseIndexedDBService<T extends { id?: number | string }, DBTypes, StoreName>
```

### Shared Methods (inherited by all services)

| Method      | Signature                           | Returns             | Error Strategy                |
| ----------- | ----------------------------------- | ------------------- | ----------------------------- |
| `init()`    | `(): Promise<void>`                 | void                | Guard against concurrent init |
| `add()`     | `(item: Omit<T, 'id'>): Promise<T>` | T with generated id | **Throws** (`protected`)      |
| `get()`     | `(id): Promise<T \| null>`          | T or null           | **Returns null**              |
| `getAll()`  | `(): Promise<T[]>`                  | Array               | **Returns []**                |
| `update()`  | `(id, updates): Promise<void>`      | void                | **Throws**                    |
| `delete()`  | `(id): Promise<void>`               | void                | **Throws**                    |
| `clear()`   | `(): Promise<void>`                 | void                | **Throws**                    |
| `getPage()` | `(offset, limit): Promise<T[]>`     | Array               | **Returns []**                |

`add()` is `protected` so that services are forced to expose a validating `create()` wrapper rather than letting callers write unvalidated rows.

### Abstract Methods (each service implements)

- `getStoreName(): StoreName`
- `_doInit(): Promise<void>`

Also provided: `getTypedDB()` (centralizes the `IDBPDatabase<DBTypes>` assertion), `handleError(operation, error): never`, and `handleQuotaExceeded(): never`.

### Error Handling Strategy

- **Read operations** (`get`, `getAll`, `getPage`) return `null` / `[]` on error -- graceful degradation, the app keeps working with empty state
- **Write operations** (`add`, `update`, `delete`, `clear`) throw -- mutations must succeed or fail explicitly

## Database Schema (`dbSchema.ts`)

- **Database name:** `my-love-db`
- **Current version:** 7
- **Stores:** messages, photos, moods, sw-auth, scripture-sessions, scripture-reflections, scripture-bookmarks, scripture-messages

`upgradeDb(db, oldVersion, newVersion, tx)` is the centralized upgrade function that every service passes to `openDB`, so store creation is not duplicated per service:

| Version | Change                                                                                       |
| ------- | -------------------------------------------------------------------------------------------- |
| v1      | `messages` store with `by-category` and `by-date` indexes                                      |
| v2      | `photos` store rebuilt with the enhanced schema (`imageBlob`), `by-date` index                 |
| v3      | `moods` store with a **unique** `by-date` index                                                |
| v4      | `sw-auth` store for Background Sync token handoff                                              |
| v5      | Four scripture stores: sessions (`by-user`), reflections / bookmarks / messages (`by-session`) |
| v6      | No new stores. Re-fires the upgrade so profiles stranded at v5 by the old per-service callbacks get the stores they are missing |
| v7      | Replaces the moods `by-date` unique index with `by-user-date`, unique on `[userId, date]`      |

See [IndexedDB Stores](../data-models/3-indexeddb-stores.md) for full store definitions.

## MoodService

Extends `BaseIndexedDBService<MoodEntry, MyLoveDBSchema, 'moods'>`. Singleton: `moodService`.

### `create(userId, moods[], note?): Promise<MoodEntry>`

Creates mood with Zod validation (`MoodEntrySchema`). First mood in array is primary for backward compatibility.

### `updateMood(id, moods[], note?): Promise<MoodEntry>`

Updates existing mood, re-validates, marks as `synced: false`.

### `getMoodForDate(date: Date): Promise<MoodEntry | null>`

Uses `by-date` index for exact date lookup.

### `getMoodsInRange(start, end): Promise<MoodEntry[]>`

Uses `IDBKeyRange.bound()` on `by-date` index.

### `getUnsyncedMoods(): Promise<MoodEntry[]>`

Filters `getAll()` for `synced === false`.

### `markAsSynced(id, supabaseId): Promise<void>`

Sets `synced: true` and stores `supabaseId`.

## CustomMessageService

Extends `BaseIndexedDBService<Message, MyLoveDBSchema, 'messages'>`. Singleton: `customMessageService`.

### `create(input: CreateMessageInput): Promise<Message>`

Validates with `CreateMessageInputSchema`, sets `isCustom: true`.

### `updateMessage(input: UpdateMessageInput): Promise<void>`

Validates with `UpdateMessageInputSchema`, auto-sets `updatedAt`.

### `getAll(filter?: MessageFilter): Promise<Message[]>`

Supports filtering by category (uses index), isCustom, active, searchTerm, tags.

### `getActiveCustomMessages(): Promise<Message[]>`

Shorthand for `getAll({ isCustom: true, active: true })`.

### `exportMessages(): Promise<CustomMessagesExport>`

Exports all custom messages as JSON with version `'1.0'`.

### `importMessages(exportData): Promise<{ imported, skipped }>`

Validates with `CustomMessagesExportSchema`, deduplicates by normalized text.

## ScriptureReadingService

Extends `BaseIndexedDBService<ScriptureSession, MyLoveDBSchema, 'scripture-sessions'>`. Singleton: `scriptureReadingService`.

Unlike the services above it is **online-first** -- Supabase is the source of truth and IndexedDB is only a read cache. The three sibling stores (reflections, bookmarks, messages) are accessed through the raw `db` handle rather than the base-class helpers. See [Scripture Reading Service](./13-scripture-reading-service.md) for the full surface.

## Photo storage in IndexedDB

`src/services/photoStorageService.ts` was **deleted** in the dead-code sweep. There is no longer a `BaseIndexedDBService` subclass for photos.

The `photos` object store still exists in the schema (v2, `by-date` index) and is served by the legacy `storageService` (`addPhoto`, `getPhoto`, `getAllPhotos`, `updatePhoto`, `deletePhoto`). Cloud photos -- the primary path -- go through `photoService` against Supabase Storage; see [Photo Services](./9-photo-services.md).

Removed along with it: `getStorageSize()`, `estimateQuotaRemaining()`, and the `PAGINATION.DEFAULT_PAGE_SIZE` config constant. Remote quota checks now live in `photoService.checkStorageQuota()`; LocalStorage quota reporting lives in `storageMonitor.logStorageQuota()`.
