# MOOD SLICE

## File

`src/stores/slices/moodSlice.ts`

## Purpose

Manages mood tracking: daily mood entries, sync status, partner mood visibility, and Supabase backend integration.

## State Interface

```typescript
export interface MoodSlice {
  // State
  moods: MoodEntry[];
  partnerMoods: MoodEntry[];
  syncStatus: {
    pendingMoods: number;
    isOnline: boolean;
    lastSyncAt?: Date;
    isSyncing: boolean;
  };

  // Actions
  addMoodEntry: (moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  getMoodForDate: (date: string) => MoodEntry | undefined;
  updateMoodEntry: (date: string, moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  loadMoods: () => Promise<void>;
  updateSyncStatus: () => Promise<void>;
  syncPendingMoods: () => Promise<{ synced: number; failed: number }>;
  fetchPartnerMoods: (limit?: number) => Promise<void>;
  getPartnerMoodForDate: (date: string) => MoodEntry | undefined;
}
```

## State Shape

```typescript
{
  moods: [
    {
      id?: number,              // IndexedDB ID
      userId: string,           // Auth user ID
      mood: string[],           // Multiple emotions: ['happy', 'excited']
      note?: string,            // User note
      date: string,             // YYYY-MM-DD
      timestamp: Date,          // Full timestamp
      synced: boolean,          // Synced to Supabase?
      supabaseId?: string,      // Supabase record ID
    }
  ],

  partnerMoods: [
    {
      // Same structure as moods
      // Fetched from Supabase, read-only
    }
  ],

  syncStatus: {
    pendingMoods: number,       // Count of unsynced entries
    isOnline: boolean,          // navigator.onLine
    lastSyncAt?: Date,          // Timestamp of last sync
    isSyncing: boolean,         // Sync in progress?
  }
}
```

## Initial State

```typescript
moods: [],
partnerMoods: [],
syncStatus: {
  pendingMoods: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSyncAt: undefined,
  isSyncing: false,
},
```

## Actions

### addMoodEntry(moods, note?)

**Type**: Async  
**Input**: `{ moods: string[], note?: string }`  
**Persistence**: IndexedDB (auto-sync to Supabase)

**Process**:

1. Get authenticated user ID via `authService.getCurrentUserId()`
2. Check if mood already exists for today
3. If exists: call `updateMoodEntry()` instead
4. Create new entry via `moodService.create(userId, moods, note)`
5. Optimistic UI update: add to `moods` array
6. Update sync status
7. Log success

**Error Handling**: Throws (allows UI error feedback)

### getMoodForDate(date)

**Type**: Sync query  
**Returns**: `MoodEntry | undefined`

**Logic**:

```typescript
return get().moods.find((m) => m.date === date);
```

### updateMoodEntry(date, moods, note?)

**Type**: Async  
**Persistence**: IndexedDB (auto-sync to Supabase)

**Process**:

1. Find existing mood by date
2. If not found: throw error
3. Update via `moodService.updateMood(id, moods, note)`
4. Update state: replace matching entry
5. Update sync status
6. Log success

### loadMoods()

**Type**: Async  
**Source**: IndexedDB (moodService)  
**Persistence**: IndexedDB

**Process**:

1. Fetch all moods from moodService
2. Update `moods` state
3. Update sync status
4. Log count

**Error Handling**: Logged (graceful degradation)

### updateSyncStatus()

**Type**: Async  
**Purpose**: Refresh sync status indicators

**Process**:

1. Get unsynced moods count from `moodService.getUnsyncedMoods()`
2. Check online status: `navigator.onLine`
3. Update `syncStatus` object

**Error Handling**: Logged (graceful degradation)

### syncPendingMoods()

**Type**: Async  
**Purpose**: Sync all pending moods to Supabase  
**Returns**: `{ synced: number; failed: number }`  
**Story 6.4**: Background sync with retry logic

**Process**:

1. Set `isSyncing = true`
2. Call `moodSyncService.syncPendingMoods()`
3. Returns sync result (synced count, failed count)
4. Update sync status: refresh pending count
5. Update `lastSyncAt` timestamp
6. Set `isSyncing = false`

**Error Handling**:

- Catches errors
- Sets `isSyncing = false` even on error
- Re-throws for UI feedback

### fetchPartnerMoods(limit?)

**Type**: Async  
**Input**: `limit = 30` (days)  
**Purpose**: Fetch partner's moods from Supabase  
**Story 6.4**: Task 3 - Partner mood visibility

**Process**:

1. Check network status: `navigator.onLine`
2. Get partner ID from environment config
3. Fetch partner moods via `moodSyncService.fetchMoods(partnerId, limit)`
4. Transform Supabase records to MoodEntry format:
   - Extract `date` from `created_at` ISO string
   - Set `synced = true` (always synced from Supabase)
5. Update `partnerMoods` state

**Error Handling**: Logged (graceful degradation - partner moods optional)

### getPartnerMoodForDate(date)

**Type**: Sync query  
**Returns**: `MoodEntry | undefined`

**Logic**:

```typescript
return get().partnerMoods.find((m) => m.date === date);
```

## Mood Entry Schema

Validated by `moodService` on creation/update:

```typescript
{
  mood: string[],     // Multiple emotions
  note?: string,      // Optional user note
  date: string,       // YYYY-MM-DD
  userId: string,     // Auth user ID
  synced: boolean,    // LocalStorage + Supabase flag
}
```

## Sync Strategy

**Local → IndexedDB → Supabase**:

1. User creates/updates mood entry in UI
2. Saved to IndexedDB via `moodService` (synced flag = false)
3. App tracks pending moods count
4. Background: `syncPendingMoods()` uploads to Supabase
5. On success: synced flag = true, `lastSyncAt` updated

**Offline Support**:

- User can create moods offline
- Pending count shown in UI
- Sync on next online + connection event

**Partner Visibility**:

- Partner moods fetched separately from Supabase
- Read-only in local state
- Different from own pending moods

## Persistence

| Data         | Storage      | Persisted?       | Loaded When              |
| ------------ | ------------ | ---------------- | ------------------------ |
| moods        | IndexedDB    | Yes (auto)       | On `loadMoods()`         |
| moods        | LocalStorage | Yes (serialized) | On app init              |
| syncStatus   | Memory       | No               | Runtime only             |
| partnerMoods | Memory       | No               | On `fetchPartnerMoods()` |

## Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `moodService` (IndexedDB CRUD)
- `moodSyncService` (Supabase sync)
- `authService` (user authentication)
- `getPartnerId()` (partner ID from config)

---
