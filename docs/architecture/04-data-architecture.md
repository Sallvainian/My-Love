# 04 -- Data Architecture

## Storage Layers

The application uses three complementary storage layers, each serving a distinct purpose.

### 1. IndexedDB (Primary Local Store)

**Library**: `idb` v8.0.3
**Database**: `my-love-db` (version 5)
**Schema**: Defined in `src/services/dbSchema.ts`

| Object Store            | Key Type  | Key Path | Auto-Increment | Indexes                              | Purpose                                    |
| ----------------------- | --------- | -------- | -------------- | ------------------------------------ | ------------------------------------------ |
| `messages`              | `number`  | `id`     | Yes            | `by-category` (category), `by-date` (createdAt) | Daily love messages (default + custom)     |
| `photos`                | `number`  | `id`     | Yes            | `by-date` (uploadDate)               | Photo blobs with compression metadata      |
| `moods`                 | `number`  | `id`     | Yes            | `by-date` (date, unique)             | Mood entries with sync tracking            |
| `sw-auth`               | `string`  | `id`     | No             | None                                 | Auth token cache for service worker        |
| `scripture-sessions`    | `string`  | `id`     | No             | `by-user` (userId)                   | Scripture reading session cache            |
| `scripture-reflections` | `string`  | `id`     | No             | `by-session` (sessionId)             | Per-step reflection data cache             |
| `scripture-bookmarks`   | `string`  | `id`     | No             | `by-session` (sessionId)             | Bookmarked scripture steps cache           |
| `scripture-messages`    | `string`  | `id`     | No             | `by-session` (sessionId)             | In-session chat message cache              |

### Database Schema Definition

```typescript
// src/services/dbSchema.ts
export interface MyLoveDBSchema extends DBSchema {
  messages: {
    key: number;
    value: Message;
    indexes: { 'by-category': string; 'by-date': Date };
  };
  photos: {
    key: number;
    value: Photo;
    indexes: { 'by-date': Date };
  };
  moods: {
    key: number;
    value: MoodEntry;
    indexes: { 'by-date': string };   // unique index on date (YYYY-MM-DD)
  };
  'sw-auth': {
    key: 'current';
    value: StoredAuthToken;
  };
  'scripture-sessions': {
    key: string;
    value: ScriptureSession;
    indexes: { 'by-user': string };
  };
  'scripture-reflections': {
    key: string;
    value: ScriptureReflection;
    indexes: { 'by-session': string };
  };
  'scripture-bookmarks': {
    key: string;
    value: ScriptureBookmark;
    indexes: { 'by-session': string };
  };
  'scripture-messages': {
    key: string;
    value: ScriptureMessage;
    indexes: { 'by-session': string };
  };
}

export const DB_NAME = 'my-love-db';
export const DB_VERSION = 5;
```

### Migration History

The `upgradeDb()` function in `dbSchema.ts` handles all schema migrations centrally. Each service calls `upgradeDb` from its `_doInit()` method.

| Version | Migration | Stores Affected |
|---------|-----------|-----------------|
| v1 | Create `messages` store with `by-category` and `by-date` indexes | `messages` |
| v2 | Delete old `photos` store (had `blob` field), recreate with `imageBlob` field and `by-date` index | `photos` |
| v3 | Create `moods` store with `by-date` unique index | `moods` |
| v4 | Create `sw-auth` store for Background Sync auth token storage | `sw-auth` |
| v5 | Create four scripture stores with `by-user` and `by-session` indexes | `scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages` |

**Special migration note**: The v1-to-v2 photos migration requires data preservation (renaming `blob` to `imageBlob`). This is handled in `photoStorageService.ts` via async transaction access, since `upgradeDb()` does not have access to the transaction object. The `photoStorageService._doInit()` reads existing v1 photos, lets `upgradeDb()` recreate the store, then re-inserts the migrated data.

### Service Layer Architecture

All IndexedDB operations go through `BaseIndexedDBService<T, DBTypes, StoreName>`:

```typescript
// src/services/BaseIndexedDBService.ts
export abstract class BaseIndexedDBService<
  T extends { id?: number | string },
  DBTypes extends DBSchema = DBSchema,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
> {
  protected db: IDBPDatabase<DBTypes> | null = null;
  protected initPromise: Promise<void> | null = null;

  async init(): Promise<void>;                              // Guard against concurrent init
  protected abstract _doInit(): Promise<void>;              // Service-specific DB setup
  protected abstract getStoreName(): StoreName;             // Store name for operations

  protected async add(item: Omit<T, 'id'>): Promise<T>;    // Protected: force validation via create()
  async get(id: number | string): Promise<T | null>;        // Returns null on not-found or error
  async getAll(): Promise<T[]>;                             // Returns [] on error
  async update(id: number | string, updates: Partial<T>): Promise<void>;  // Throws on failure
  async delete(id: number | string): Promise<void>;         // Throws on failure
  async clear(): Promise<void>;                             // Throws on failure
  async getPage(offset: number, limit: number): Promise<T[]>;  // Cursor-based pagination
  protected handleError(operation: string, error: Error): never;
  protected handleQuotaExceeded(): never;
}
```

Concrete service implementations:

| Service | Store | Base Class Overrides | Extra Methods |
|---------|-------|---------------------|---------------|
| `MoodService` | `moods` | None | `create()`, `updateMood()`, `getMoodForDate()`, `getMoodsInRange()`, `getUnsyncedMoods()`, `markAsSynced()` |
| `CustomMessageService` | `messages` | `getAll()` (filtering) | `create()`, `updateMessage()`, `getActiveCustomMessages()`, `exportMessages()`, `importMessages()` |
| `PhotoStorageService` | `photos` | `getAll()` (by-date index), `getPage()` (descending cursor), `update()` (Zod validation) | `create()`, `getStorageSize()`, `estimateQuotaRemaining()` |
| `ScriptureReadingService` | `scripture-sessions` | None | Session/Reflection/Bookmark/Message CRUD, cache helpers, corruption recovery |
| `StorageService` | `messages` + `photos` | N/A (legacy, not BaseIndexedDBService) | Photo/message CRUD, bulk operations, export |

### 2. localStorage (Zustand Persist)

**Storage Key**: `my-love-storage`
**Middleware**: `zustand/persist` with custom `createJSONStorage`

Persisted state keys (via `partialize`):

| Key              | Type             | Description                                                           |
| ---------------- | ---------------- | --------------------------------------------------------------------- |
| `settings`       | `Settings`       | Theme, notification time, relationship config, customization          |
| `isOnboarded`    | `boolean`        | Onboarding completion flag                                            |
| `messageHistory` | `MessageHistory` | Shown message IDs per date (`Map<string, number>`), navigation offset |
| `moods`          | `MoodEntry[]`    | Cached mood entries for offline access                                |

Custom serialization handles the `shownMessages` field which is a `Map<string, number>`:

```typescript
// useAppStore.ts - Custom storage with Map serialization
const customStorage = createJSONStorage(() => localStorage, {
  replacer: (_key, value) => {
    // Map -> Array of entries for JSON compatibility
    if (value instanceof Map) {
      return { __type: 'Map', entries: Array.from(value.entries()) };
    }
    return value;
  },
  reviver: (_key, value) => {
    // Array of entries -> Map on deserialization
    if (value && typeof value === 'object' && value.__type === 'Map') {
      return new Map(value.entries);
    }
    return value;
  },
});
```

Pre-hydration validation (`validateHydratedState()`) checks for critical corruption:
- Verifies `settings` is an object (not null/undefined/primitive)
- Verifies `messageHistory` has expected structure
- On failure: resets to defaults, logs error, clears corrupted localStorage

### 3. Supabase (Cloud Backend)

**Client**: Singleton `SupabaseClient<Database>` in `src/api/supabaseClient.ts`
**Database**: PostgreSQL with Row-Level Security (RLS) on all tables
**Storage**: Supabase Storage buckets for photos and love note images
**Realtime**: Broadcast API + `postgres_changes` subscriptions

Key tables:

| Table                   | Key | Purpose                              | RLS | Access Pattern |
| ----------------------- | --- | ------------------------------------ | --- | -------------- |
| `users`                 | UUID | User profiles with `partner_id` link | Yes | Direct query |
| `moods`                 | UUID | Synced mood entries                  | Yes | Via `moodApi.ts` with Zod validation |
| `interactions`          | UUID | Poke/kiss events between partners    | Yes | Via `interactionService.ts` |
| `photos`                | UUID | Photo metadata (blob in Storage)     | Yes | Via `photoService.ts` |
| `love_notes`            | UUID | Love notes chat messages             | Yes | Direct in `notesSlice.ts` |
| `scripture_sessions`    | UUID | Reading session state + snapshot     | Yes | Via RPCs in `scriptureReadingService.ts` |
| `scripture_reflections` | UUID | Per-step reflections with ratings    | Yes | Via RPCs in `scriptureReadingService.ts` |
| `scripture_bookmarks`   | UUID | Bookmarked steps with sharing        | Yes | Direct in `scriptureReadingService.ts` |
| `scripture_messages`    | UUID | In-session chat messages             | Yes | Direct in `scriptureReadingService.ts` |

Storage buckets:

| Bucket | Purpose | Access |
|--------|---------|--------|
| `photos` | Photo gallery images | Signed URLs (1-hour expiry) |
| `love-note-images` | Love note image attachments | Edge Function upload + signed URLs |

### Storage Size Monitoring

**IndexedDB**: `PhotoStorageService.estimateQuotaRemaining()` uses `navigator.storage.estimate()` to check browser-allocated quota. Default fallback: 50MB (from `STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES`).

**Supabase Storage**: `PhotoService.checkStorageQuota()` sums `file_size` from the `photos` table against a 1GB free tier limit.

| Storage | Warning Level | Threshold | Action |
|---------|--------------|-----------|--------|
| IndexedDB | `approaching` | 80% | Console warning |
| IndexedDB | `critical` | 95% | Reject uploads |
| Supabase | `approaching` | 80% | Console warning |
| Supabase | `critical` | 95% | Reject uploads |
| Supabase | `exceeded` | 100% | Error message |

## Data Flow Diagrams

### Mood Entry Creation (Offline-First)

```
User taps "Save Mood"
    |
    v
MoodSlice.addMoodEntry(moods, note)
    |
    v
getCurrentUserIdOfflineSafe()       // Cached session, no network required
    |
    v
MoodService.create(userId, moods, note)
    |-- MoodEntrySchema.parse()     // Zod validation
    |-- IndexedDB write via BaseIndexedDBService.add()
    |-- Returns MoodEntry { synced: false, supabaseId: undefined }
    |
    v
Optimistic state: set({ moods: [...state.moods, created] })
    |
    v
updateSyncStatus()                  // Count unsynced entries
    |
    v
if (navigator.onLine) {
    syncPendingMoods()              // Tier 1: Immediate sync
        |
        v
    moodSyncService.syncPendingMoods()
        |-- For each unsynced: transform to Supabase format
        |-- moodApi.create(supabaseMood)  // Zod-validated insert
        |-- SupabaseMoodSchema.parse(response)  // Validate response
        |-- moodService.markAsSynced(localId, supabaseId)
        |-- On failure: skip, log, retry next pass
}
```

### Love Note Message Send (Supabase-Direct)

```
User types message + taps Send
    |
    v
NotesSlice.sendNote(content, imageFile?)
    |
    v
Rate limit check (10 msgs/min, client-side)
    |
    v
DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    |
    v
if (imageFile) {
    imageCompressionService.compressImage(file)  // Canvas API, max 2048px, 80% JPEG
        |
        v
    uploadLoveNoteImage(file, userId)  // Edge Function upload
        |-- Client validation + compression
        |-- POST to /functions/v1/upload-love-note-image
        |-- Server validates MIME (magic bytes), size, rate limit
        |-- Returns storagePath
}
    |
    v
Optimistic UI: add note with tempId to state
    |
    v
supabase.from('love_notes').insert({ content, from_user_id, to_user_id, image_url })
    |
    v
Replace tempId with real Supabase ID
    |
    v
supabase.channel(`notes:${partnerId}`).send({ type: 'broadcast', event: 'new_note', payload })
```

### Scripture Session (Online-First with Cache)

```
User starts solo reading session
    |
    v
ScriptureSlice.createSession('solo')
    |
    v
scriptureReadingService.createSession('solo')
    |-- supabase.rpc('scripture_create_session', { p_mode: 'solo' })  // Server write
    |-- SupabaseSessionSchema.parse(data)  // Validate response
    |-- toLocalSession(validated, userId)   // Transform to local format
    |-- cacheSession(local)                 // Write to IndexedDB cache
    |
    v
Subsequent reads: getSession(sessionId)
    |-- Check IndexedDB cache first
    |-- If hit: return cached, fire-and-forget background refresh
    |-- If miss: fetchAndCacheSession(sessionId)  // Fetch from Supabase
```

## Schema Validation

All schemas are defined in two locations:

### Local Schemas (`src/validation/schemas.ts`)

| Schema                       | Used By                 | Validates                                         |
| ---------------------------- | ----------------------- | ------------------------------------------------- |
| `MessageSchema`              | CustomMessageService    | Full message objects from IndexedDB               |
| `CreateMessageInputSchema`   | CustomMessageService    | User input for new messages                       |
| `UpdateMessageInputSchema`   | CustomMessageService    | Partial update payloads                           |
| `PhotoSchema`                | PhotoStorageService     | Photo objects with Blob validation                |
| `MoodEntrySchema`            | MoodService             | Mood tracking entries with date/mood validation   |
| `SettingsSchema`             | SettingsSlice           | App settings (theme, relationship, notifications) |
| `CustomMessagesExportSchema` | CustomMessageService    | Import/export file format with version check      |
| `SupabaseSessionSchema`      | ScriptureReadingService | Supabase session row validation                   |
| `SupabaseReflectionSchema`   | ScriptureReadingService | Reflection row validation                         |
| `SupabaseBookmarkSchema`     | ScriptureReadingService | Bookmark row validation                           |
| `SupabaseMessageSchema`      | ScriptureReadingService | Scripture message validation                      |

### Supabase Response Schemas (`src/api/validation/supabaseSchemas.ts`)

| Schema                     | Used By          | Validates                        |
| -------------------------- | ---------------- | -------------------------------- |
| `SupabaseMoodSchema`       | moodApi          | Mood API response rows           |
| `MoodArraySchema`          | moodApi          | Array of mood responses          |
| `InteractionArraySchema`   | interactionService | Array of interaction responses |
| `UserArraySchema`          | partnerService   | Array of user search results     |
| `CoupleStatsSchema`        | scriptureReadingService | Scripture stats RPC response |

## Related Documentation

- [Architecture Patterns](./03-architecture-patterns.md)
- [Offline Strategy](./12-offline-strategy.md)
- [Validation Layer](./14-validation-layer.md)
- [State Management - Persistence Strategy](../state-management/05-persistence-strategy.md)
