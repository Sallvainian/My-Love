# 14. Additional Services

**Sources:**

- `src/services/performanceMonitor.ts` (operation timing)
- `src/services/migrationService.ts` (LocalStorage to IndexedDB migration)
- `src/services/storage.ts` (legacy IndexedDB operations)
- `src/services/syncService.ts` (batch mood sync)

## PerformanceMonitor (src/services/performanceMonitor.ts)

**Singleton:** `performanceMonitor`

Tracks operation execution times using the Web Performance API (`performance.now()`). Maintains an in-memory Map of named metrics with min/max/avg/total/count statistics.

### PerformanceMetric Interface

```typescript
interface PerformanceMetric {
  name: string;
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  lastRecorded: number; // Date.now()
}
```

### Methods

#### `measureAsync<T>(name, operation): Promise<T>`

Wraps an async operation with timing. Records the duration on success; does not record failed operations.

```typescript
const result = await performanceMonitor.measureAsync('db-read', () => db.get(id));
```

**Used by:** `photoStorageService.create()` to record photo storage sizes.

#### `recordMetric(name, duration): void`

Records a custom metric value. Creates a new entry or updates an existing one with running min/max/avg/total statistics. Logs to console in DEV mode.

#### `getMetrics(name): PerformanceMetric | undefined`

Returns metrics for a specific operation name.

#### `getAllMetrics(): Map<string, PerformanceMetric>`

Returns a shallow copy of all recorded metrics.

#### `clear(): void`

Clears all recorded metrics.

#### `getReport(): string`

Generates a human-readable text report sorted by total duration (slowest first). Format:

```
Performance Metrics Report
==================================================

operation-name:
  count: 5
  avg: 12.34ms
  min: 8.00ms
  max: 20.00ms
  total: 61.70ms
```

## MigrationService (src/services/migrationService.ts)

One-time migration from LocalStorage to IndexedDB for custom messages. No singleton -- exports a single function.

### `migrateCustomMessagesFromLocalStorage(): Promise<MigrationResult>`

```typescript
interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}
```

**LocalStorage key:** `my-love-custom-messages`

**Flow:**

1. Check for `localStorage.getItem('my-love-custom-messages')`
2. If not found, return early (no migration needed)
3. Parse JSON data, validate it is an array
4. Get existing IndexedDB messages to detect duplicates (by normalized text)
5. For each message:
   a. Validate with `CreateMessageInputSchema.parse()`
   b. Skip if duplicate (case-insensitive text match)
   c. Create in IndexedDB via `customMessageService.create()`
   d. On Zod validation error: skip with warning (don't fail the whole migration)
6. Remove LocalStorage key after successful migration (all migrated or all duplicates)
7. Return detailed `MigrationResult`

**Error tolerance:** Individual message failures are logged and counted but do not abort the migration. Only parse failures or non-array data cause `success: false`.

## StorageService (src/services/storage.ts) -- Legacy

**Singleton:** `storageService`

Direct IndexedDB operations for photos and messages. Predates the `BaseIndexedDBService` abstract class pattern. Still used by some components for backward compatibility.

### Initialization

Opens `my-love-db` at the current `DB_VERSION`. Has its own upgrade logic with `objectStoreNames.contains()` guards as a fallback for stores that should already exist. Uses the same concurrent-init guard pattern (`initPromise`) as `BaseIndexedDBService`.

### Photo Operations

| Method                     | Returns            | Error Strategy    |
| -------------------------- | ------------------ | ----------------- |
| `addPhoto(photo)`          | `Promise<number>`  | Throws            |
| `getPhoto(id)`             | `Promise<Photo?>`  | Returns undefined |
| `getAllPhotos()`           | `Promise<Photo[]>` | Returns []        |
| `deletePhoto(id)`          | `Promise<void>`    | Throws            |
| `updatePhoto(id, updates)` | `Promise<void>`    | Throws            |

### Message Operations

| Method                            | Returns              | Error Strategy    |
| --------------------------------- | -------------------- | ----------------- |
| `addMessage(message)`             | `Promise<number>`    | Throws            |
| `getMessage(id)`                  | `Promise<Message?>`  | Returns undefined |
| `getAllMessages()`                | `Promise<Message[]>` | Returns []        |
| `getMessagesByCategory(category)` | `Promise<Message[]>` | Returns []        |
| `updateMessage(id, updates)`      | `Promise<void>`      | Throws            |
| `deleteMessage(id)`               | `Promise<void>`      | Throws            |
| `toggleFavorite(messageId)`       | `Promise<void>`      | Throws            |

### Bulk Operations

| Method                    | Returns                                             | Description                   |
| ------------------------- | --------------------------------------------------- | ----------------------------- |
| `addMessages(messages[])` | `Promise<void>`                                     | Transaction-based bulk insert |
| `clearAllData()`          | `Promise<void>`                                     | Clears photos + messages      |
| `exportData()`            | `Promise<{ photos: Photo[], messages: Message[] }>` | Exports all data for backup   |

### localStorageHelper

Utility object for type-safe localStorage access with error handling:

```typescript
export const localStorageHelper = {
  get<T>(key: string, defaultValue: T): T,
  set<T>(key: string, value: T): void,
  remove(key: string): void,
  clear(): void,
};
```

All methods silently catch errors and log to console. `get()` returns `defaultValue` on any error (JSON parse failure, missing key, storage access denied).

## SyncService (src/services/syncService.ts)

**Singleton:** `syncService`

Batch mood sync using parallel `Promise.all` with partial failure handling. Simpler alternative to `MoodSyncService.syncPendingMoods()` which uses sequential sync with retry.

### Types

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

### Methods

#### `syncPendingMoods(): Promise<SyncSummary>`

Syncs all unsynced moods using `Promise.all()` for parallel execution. Each mood is synced independently -- failures do not block other moods. On success, marks the mood as synced in IndexedDB.

#### `hasPendingSync(): Promise<boolean>`

Returns `true` if there are any unsynced moods in IndexedDB (`synced === false`).

#### `getPendingCount(): Promise<number>`

Returns the count of unsynced moods.
