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

| Key | Type | Why Persisted |
|-----|------|---------------|
| `settings` | `Settings` | Theme, relationship config, notifications must survive page refresh |
| `isOnboarded` | `boolean` | Prevents re-showing onboarding after refresh |
| `messageHistory` | `MessageHistory` | Preserves which messages were shown on which dates (Map data) |
| `moods` | `MoodEntry[]` | Enables offline mood display without waiting for IndexedDB load |

### What Is NOT Persisted

| Key | Why Excluded |
|-----|-------------|
| `isLoading`, `error` | Transient UI state, recalculated on each load |
| `currentView` | Determined from URL path on page load |
| `messages` | Loaded from IndexedDB during initialization |
| `currentMessage` | Recalculated from messages + date on each load |
| `partnerMoods` | Fetched from Supabase on demand |
| `syncStatus` | Recalculated from IndexedDB on load |
| `interactions` | Fetched from Supabase, ephemeral |
| `partnerInfo`, `partnerRequests` | Fetched from Supabase |
| `notes` | Fetched from Supabase, no local cache |
| `photos` | Metadata fetched from Supabase; blobs in Supabase Storage |
| `currentSession`, `sessionHistory` | Cached in IndexedDB, fetched on demand |

### Custom Map Serialization

`messageHistory.shownMessages` is a `Map<string, number>` (date string -> message ID). JSON.stringify cannot handle Maps, so the custom storage adapter converts:

**Serialization (write):**
```typescript
// Map -> Array of [key, value] entries
parsed.state.messageHistory.shownMessages = Array.from(
  state.messageHistory.shownMessages.entries()
);
// Stored as: [["2025-11-15", 42], ["2025-11-16", 17], ...]
```

**Deserialization (read):**
```typescript
// Array of [key, value] entries -> Map
parsed.messageHistory.shownMessages = new Map(
  parsed.messageHistory.shownMessages
);
```

### Corruption Recovery

The custom storage adapter wraps `getItem` in a try/catch:

```typescript
getItem: (name: string) => {
  const item = localStorage.getItem(name);
  if (!item) return null;
  try {
    const parsed = JSON.parse(item);
    // ... deserialization
    return JSON.stringify(parsed);
  } catch {
    console.error('[Store] Failed to parse persisted state');
    localStorage.removeItem(name);
    return null;  // Triggers default state
  }
},
```

If corrupted data is detected, it is removed and the store falls back to defaults.

### Hydration Verification

The `onRehydrateStorage` callback sets `__isHydrated` after hydration completes:

```typescript
onRehydrateStorage: () => {
  return (_state, error) => {
    useAppStore.setState({ __isHydrated: !error });
  };
},
```

`initializeApp()` checks this flag. If hydration failed:
1. Error message is set
2. Corrupted localStorage is cleared
3. User is prompted to refresh

## IndexedDB Persistence

### Schema (`src/services/dbSchema.ts`)

Database name: `my-love-db`, version: 5

| Store | Key Path | Auto-Increment | Indexes |
|-------|----------|----------------|---------|
| `messages` | `id` | Yes | None |
| `photos` | `id` | Yes | None |
| `moods` | `id` | Yes | `by-date`, `by-synced` |
| `sw-auth` | `key` | No | None |
| `scripture-sessions` | `id` | No | `by-status`, `by-userId` |
| `scripture-reflections` | `id` | No | `by-session` |
| `scripture-bookmarks` | `id` | No | `by-session` |
| `scripture-messages` | `id` | No | `by-session` |

### Service Layer

All IndexedDB access goes through service classes extending `BaseIndexedDBService<T>`:

| Service | Store | Additional Methods |
|---------|-------|--------------------|
| `MoodService` | `moods` | `getMoodForDate`, `getMoodsInRange`, `getUnsyncedMoods`, `markAsSynced` |
| `CustomMessageService` | `messages` | `getAll` (with filters), `exportMessages`, `importMessages` |
| `PhotoStorageService` | `photos` | Migration v1->v2 support |
| `ScriptureReadingService` | `scripture-*` | Cache-first reads, write-through, corruption recovery |
| `StorageService` | `messages`, `photos` | `addMessages` (bulk), `getAllMessages` |

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

`storageMonitor.ts` estimates usage and warns at 70%/85% of 5MB limit.

### Supabase Storage

`photoService.ts` monitors bucket quota with warnings at 80%/95% capacity.

## Related Documentation

- [Zustand Store Configuration](./01-zustand-store-configuration.md)
- [Data Architecture](../architecture/04-data-architecture.md)
- [Data Flow](./04-data-flow.md)
