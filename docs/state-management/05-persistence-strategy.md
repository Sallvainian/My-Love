# Persistence Strategy

## Overview

The app uses two persistence layers: **localStorage** (via Zustand persist middleware) for lightweight state, and **IndexedDB** (via `idb` library) for structured data.

## localStorage Persistence

### What Is Persisted

The `partialize` function in the store configuration selects four state keys:

```typescript
partialize: (state: AppState) => ({
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: state.messageHistory,
  moods: state.moods,
}),
```

| Key              | Type             | Why Persisted                                                       |
| ---------------- | ---------------- | ------------------------------------------------------------------- |
| `settings`       | `Settings`       | Theme, relationship config, notifications must survive page refresh |
| `isOnboarded`    | `boolean`        | Prevents re-showing onboarding after refresh                        |
| `messageHistory` | `MessageHistory` | Preserves which messages were shown on which dates (Map data)       |
| `moods`          | `MoodEntry[]`    | Enables offline mood display without waiting for IndexedDB load     |

### What Is NOT Persisted

| Key                                | Why Excluded                                              |
| ---------------------------------- | --------------------------------------------------------- |
| `isLoading`, `error`               | Transient UI state, recalculated on each load             |
| `currentView`                      | Determined from URL path on page load                     |
| `messages`                         | Loaded from IndexedDB during initialization               |
| `currentMessage`                   | Recalculated from messages + date on each load            |
| `partnerMoods`                     | Fetched from Supabase on demand                           |
| `syncStatus`                       | Recalculated from IndexedDB on load                       |
| `interactions`                     | Fetched from Supabase, ephemeral                          |
| `partnerInfo`, `partnerRequests`   | Fetched from Supabase                                     |
| `notes`                            | Fetched from Supabase, no local cache                     |
| `photos`                           | Metadata fetched from Supabase; blobs in Supabase Storage |
| `currentSession`, `sessionHistory` | Cached in IndexedDB, fetched on demand                    |

### Custom Map Serialization

`messageHistory.shownMessages` is a `Map<string, number>` (date string -> message ID). JSON.stringify cannot handle Maps, so serialization is split between `partialize` (write) and `onRehydrateStorage` (read):

**Serialization (write via `partialize`):**

```typescript
messageHistory: {
  ...state.messageHistory,
  shownMessages:
    state.messageHistory?.shownMessages instanceof Map
      ? Array.from(state.messageHistory.shownMessages.entries())
      : [],
},
// Stored as: [["2025-11-15", 42], ["2025-11-16", 17], ...]
```

**Deserialization (read via `onRehydrateStorage`):**

```typescript
// Validates array structure before converting
const isValidArray = raw.every(
  (item) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
);
if (isValidArray) {
  state.messageHistory.shownMessages = new Map(raw);
}
```

### Corruption Recovery

The store uses `createJSONStorage` with a custom adapter that performs pre-hydration validation:

```typescript
storage: createJSONStorage(() => ({
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      const data = JSON.parse(str);
      const validation = validateHydratedState(data.state);
      if (!validation.isValid) {
        localStorage.removeItem(name);
        return null;  // Triggers default state
      }
      return str;
    } catch {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
})),
```

Two layers of recovery:
1. **Pre-hydration** (in `getItem`): Validates structure before Zustand deserializes. Only critical errors (type mismatches on `shownMessages` or `currentIndex`) trigger rejection.
2. **Post-hydration** (in `onRehydrateStorage`): Re-validates after deserialization. Handles Map deserialization errors and null messageHistory.

### Hydration Verification

The `onRehydrateStorage` callback sets `__isHydrated` after hydration completes via direct property assignment (actions are not available in this callback):

```typescript
onRehydrateStorage: () => (state, error) => {
  if (error) {
    localStorage.removeItem('my-love-storage');
    return;
  }

  // Deserialize shownMessages array back to Map with validation
  // Handle null/undefined messageHistory gracefully
  // ...

  if (state) {
    state.__isHydrated = true;
  }
},
```

`initializeApp()` checks this flag. If hydration failed:

1. Error message is set via `get().setError()`
2. Corrupted localStorage is cleared (`localStorage.removeItem('my-love-storage')`)
3. Loading is set to false; the user sees an error message prompting refresh

## IndexedDB Persistence

### Schema (`src/services/dbSchema.ts`)

Database name: `my-love-db`, version: 5

| Store                   | Key Path | Auto-Increment | Indexes                              |
| ----------------------- | -------- | -------------- | ------------------------------------ |
| `messages`              | `id`     | Yes            | `by-category` (category), `by-date` (createdAt) |
| `photos`                | `id`     | Yes            | `by-date` (uploadDate)               |
| `moods`                 | `id`     | Yes            | `by-date` (date, unique)             |
| `sw-auth`               | `id`     | No             | None                                 |
| `scripture-sessions`    | `id`     | No             | `by-user` (userId)                   |
| `scripture-reflections` | `id`     | No             | `by-session` (sessionId)             |
| `scripture-bookmarks`   | `id`     | No             | `by-session` (sessionId)             |
| `scripture-messages`    | `id`     | No             | `by-session` (sessionId)             |

### Service Layer

All IndexedDB access goes through service classes extending `BaseIndexedDBService<T>`:

| Service                   | Store                | Additional Methods                                                      |
| ------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `MoodService`             | `moods`              | `getMoodForDate`, `getMoodsInRange`, `getUnsyncedMoods`, `markAsSynced` |
| `CustomMessageService`    | `messages`           | `getAll` (with filters), `exportMessages`, `importMessages`             |
| `PhotoStorageService`     | `photos`             | Migration v1->v2 support                                                |
| `ScriptureReadingService` | `scripture-*`        | Cache-first reads, write-through, corruption recovery                   |
| `StorageService`          | `messages`, `photos` | `addMessages` (bulk), `getAllMessages`                                  |

### Migration Strategy (`src/services/migrationService.ts`)

One-time migration from localStorage to IndexedDB for custom messages:

```typescript
export async function migrateCustomMessagesToIndexedDB(): Promise<void> {
  const legacyData = localStorage.getItem('custom-messages');
  if (!legacyData) return;

  const messages = JSON.parse(legacyData);
  for (const msg of messages) {
    const validated = CreateMessageInputSchema.parse(msg);
    await customMessageService.add(validated);
  }
  localStorage.removeItem('custom-messages');
}
```

Features:

- Duplicate detection (skips messages with matching text)
- Zod validation during migration
- Removes legacy localStorage key after successful migration

## Quota Monitoring

### localStorage

`src/utils/storageMonitor.ts` estimates usage and warns at configurable thresholds:

| Threshold | Level      | Action                                        |
| --------- | ---------- | --------------------------------------------- |
| < 70%     | `safe`     | Normal operation                              |
| 70-85%    | `warning`  | Console warning with optimization suggestions |
| > 85%     | `critical` | Console error with action items               |

Conservative estimate of 5MB total (typical browser minimum).

### IndexedDB

`PhotoStorageService.estimateQuotaRemaining()` uses `navigator.storage.estimate()` to check browser-allocated quota. Falls back to `STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES` (50MB) when the Storage API is unavailable (e.g., Safari < 15.2).

| Threshold | Level         | Action          |
| --------- | ------------- | --------------- |
| < 80%     | normal        | Normal operation |
| 80-95%    | `approaching` | Console warning |
| > 95%     | `critical`    | Reject uploads  |

### Supabase Storage

`photoService.ts` monitors bucket quota by summing `file_size` from the `photos` table against a 1GB free tier limit:

| Threshold | Level         | Action          |
| --------- | ------------- | --------------- |
| < 80%     | normal        | Normal operation |
| 80-95%    | `approaching` | Console warning |
| 95-100%   | `critical`    | Reject uploads  |
| > 100%    | `exceeded`    | Error message   |

## Related Documentation

- [Zustand Store Configuration](./01-zustand-store-configuration.md)
- [Data Architecture](../architecture/04-data-architecture.md)
- [Data Flow](./04-data-flow.md)
