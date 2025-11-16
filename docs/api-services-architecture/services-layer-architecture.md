# Services Layer Architecture

## 1. Base IndexedDB Service (`BaseIndexedDBService.ts`)

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

## 2. Storage Service (`storage.ts`)

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

## 3. Photo Storage Service (`photoStorageService.ts`)

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

## 4. Custom Message Service (`customMessageService.ts`)

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

## 5. Mood Service (`moodService.ts`)

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

## 6. Sync Service (`syncService.ts`)

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

## 7. Realtime Service (`realtimeService.ts`)

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

## 8. Migration Service (`migrationService.ts`)

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

## 9. Image Compression Service (`imageCompressionService.ts`)

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

## 10. Performance Monitor (`performanceMonitor.ts`)

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
