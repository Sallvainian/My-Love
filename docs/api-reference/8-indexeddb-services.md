# 8. IndexedDB Services

**Sources:**
- `src/services/BaseIndexedDBService.ts` -- Abstract base class
- `src/services/dbSchema.ts` -- Shared schema, upgrade function, constants
- `src/services/moodService.ts` -- Mood IndexedDB CRUD
- `src/services/customMessageService.ts` -- Message IndexedDB CRUD
- `src/services/photoStorageService.ts` -- Photo IndexedDB CRUD

## BaseIndexedDBService

Abstract generic class providing shared CRUD operations for all IndexedDB stores.

```typescript
abstract class BaseIndexedDBService<T extends { id?: number | string }, DBTypes, StoreName>
```

### Shared Methods (inherited by all services)

| Method | Signature | Returns | Error Strategy |
|--------|-----------|---------|---------------|
| `init()` | `(): Promise<void>` | void | Guard against concurrent init |
| `add()` | `(item: Omit<T, 'id'>): Promise<T>` | T with generated id | **Throws** |
| `get()` | `(id): Promise<T \| null>` | T or null | **Returns null** |
| `getAll()` | `(): Promise<T[]>` | Array | **Returns []** |
| `update()` | `(id, updates): Promise<void>` | void | **Throws** |
| `delete()` | `(id): Promise<void>` | void | **Throws** |
| `clear()` | `(): Promise<void>` | void | **Throws** |
| `getPage()` | `(offset, limit): Promise<T[]>` | Array | **Returns []** |

### Abstract Methods (each service implements)
- `getStoreName(): StoreName`
- `_doInit(): Promise<void>`

## Database Schema (`dbSchema.ts`)

- **Database name:** `my-love-db`
- **Current version:** 5
- **Stores:** messages, photos, moods, sw-auth, scripture-sessions, scripture-reflections, scripture-bookmarks, scripture-messages

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

## PhotoStorageService

Extends `BaseIndexedDBService<Photo, MyLoveDBSchema, 'photos'>`. Singleton: `photoStorageService`.

### `create(photo: Omit<Photo, 'id'>): Promise<Photo>`
Validates with `PhotoSchema`, records performance metrics.

### `getAll(): Promise<Photo[]>`
Overrides base -- uses `by-date` index, returns newest first.

### `getPage(offset?, limit?): Promise<Photo[]>`
Overrides base -- uses descending cursor on `by-date` index. Default limit from `PAGINATION.DEFAULT_PAGE_SIZE`.

### `getStorageSize(): Promise<number>`
Sums `compressedSize` across all photos. Returns bytes.

### `estimateQuotaRemaining(): Promise<{ used, quota, remaining, percentUsed }>`
Uses `navigator.storage.estimate()` with fallback.
