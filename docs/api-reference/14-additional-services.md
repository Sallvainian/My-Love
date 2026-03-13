# 14. Additional Services

**Sources:**

- `src/services/syncService.ts` -- Offline-first mood sync
- `src/services/imageCompressionService.ts` -- Canvas API compression (see also Section 9)
- `src/services/migrationService.ts` -- LocalStorage to IndexedDB migration
- `src/services/performanceMonitor.ts` -- Operation timing and metrics

## SyncService

**Singleton:** `export const syncService = new SyncService()`

Handles synchronization of mood entries from IndexedDB to Supabase with partial failure handling. Unlike `MoodSyncService` (Section 5), this is a simpler sync-only service without broadcast or real-time features.

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

Syncs all unsynced moods from IndexedDB to Supabase.

**Flow:**

1. Gets unsynced moods via `moodService.getUnsyncedMoods()`
2. Syncs each mood in parallel via `Promise.all()`
3. Each mood: transforms to `MoodInsert`, calls `moodApi.create()`, marks synced via `moodService.markAsSynced()`
4. Continues on individual failures (partial failure handling)
5. Returns detailed summary with per-mood results

**Error handling:** Critical errors return empty summary. Individual mood failures are captured in `results` array.

---

#### `hasPendingSync(): Promise<boolean>`

Returns `true` if any unsynced moods exist in IndexedDB.

---

#### `getPendingCount(): Promise<number>`

Returns the count of unsynced moods. Returns `0` on error.

---

## MigrationService

**Exported function** (not a class):

### `migrateCustomMessagesFromLocalStorage(): Promise<MigrationResult>`

One-time migration from `localStorage` key `my-love-custom-messages` to IndexedDB.

```typescript
interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}
```

**Flow:**

1. Reads `localStorage.getItem('my-love-custom-messages')`
2. Parses JSON array of `CustomMessage` objects
3. Gets existing custom messages from IndexedDB for duplicate detection
4. For each message: validates with `CreateMessageInputSchema.parse()`, checks for duplicate (case-insensitive text match), creates via `customMessageService.create()`
5. After migration: removes localStorage key to prevent re-migration
6. Returns summary with migrated/skipped counts and errors

**Duplicate detection:** Normalizes text to lowercase and trims before comparison.

**Error handling:** Invalid messages are skipped (not counted as errors). Parse failures stop migration. Individual message failures are logged and tracked in `errors` array.

---

## PerformanceMonitor

**Singleton:** `export const performanceMonitor = new PerformanceMonitor()`

Tracks operation execution times using the Web Performance API (`performance.now()`). Stores metrics in an internal `Map<string, PerformanceMetric>`.

### Types

```typescript
interface PerformanceMetric {
  name: string;
  count: number;
  avgDuration: number; // ms
  minDuration: number; // ms
  maxDuration: number; // ms
  totalDuration: number; // ms
  lastRecorded: number; // Date.now() timestamp
}
```

### Methods

#### `measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T>`

Wraps an async operation and records its execution time. Failed operations are not recorded in metrics (error is re-thrown).

**Used by:** `PhotoStorageService.create()`, `PhotoStorageService.getAll()`, `PhotoStorageService.getPage()`

---

#### `recordMetric(name: string, duration: number): void`

Records a custom metric value. Updates running statistics (count, avg, min, max, total). Logs in dev mode.

---

#### `getMetrics(name: string): PerformanceMetric | undefined`

Returns metrics for a specific operation name.

---

#### `getAllMetrics(): Map<string, PerformanceMetric>`

Returns a copy of all recorded metrics.

---

#### `clear(): void`

Clears all recorded metrics.

---

#### `getReport(): string`

Generates a human-readable report string sorted by total duration (slowest operations first). Format:

```
Performance Metrics Report
==================================================

photo-create:
  count: 5
  avg: 23.45ms
  min: 12.30ms
  max: 45.67ms
  total: 117.25ms
```
