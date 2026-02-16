# Persistence Strategy

## What Goes Where

| Storage Layer | Technology | Data | Size Limit |
|---|---|---|---|
| **Cloud** | Supabase PostgreSQL | Moods, photos, love notes, interactions, scripture | Supabase plan limits |
| **Local (large)** | IndexedDB (`my-love-db`) | Messages, moods, auth tokens | Browser-dependent (~50MB+) |
| **Local (small)** | localStorage (`my-love-storage`) | Settings, onboarding, message history, moods | ~5MB |

## localStorage (`my-love-storage`)

Managed by Zustand `persist` middleware. Contains the JSON-serialized subset of `AppState` defined in `partialize`:

```typescript
partialize: (state) => ({
  settings: state.settings,           // Theme, relationship config
  isOnboarded: state.isOnboarded,     // Onboarding flag
  messageHistory: {                   // Message rotation history
    ...state.messageHistory,
    shownMessages: Array.from(state.messageHistory.shownMessages.entries()),
  },
  moods: state.moods,                 // Local mood entries
}),
```

### Map Serialization

`messageHistory.shownMessages` is a `Map<string, number>` (date to message ID). Since `JSON.stringify` cannot serialize Maps:

- **Write (partialize):** `Array.from(map.entries())` converts Map to `[["2025-12-01", 42], ...]`
- **Read (onRehydrateStorage):** `new Map(array)` converts back with validation

### Other localStorage Keys

| Key | Content | Managed By |
|---|---|---|
| `my-love-storage` | Zustand persisted state (JSON) | Zustand persist middleware |
| `lastWelcomeView` | Timestamp (ms) of last welcome splash | `App.tsx` |
| `sb-*` | Supabase auth session tokens | `@supabase/supabase-js` |

## IndexedDB (`my-love-db`)

Managed via `src/services/dbSchema.ts`. Current version: **4**.

| Store | Key | Indexes | Purpose |
|---|---|---|---|
| `messages` | `id` (autoIncrement) | `by-category`, `by-date` | Default + custom love messages |
| `photos` | `id` (autoIncrement) | `by-date` | Local photo blobs (legacy) |
| `moods` | `id` (autoIncrement) | `by-date` (unique) | Mood entries with `synced` flag |
| `sw-auth` | `id` (fixed: `'current'`) | none | Auth token for Service Worker Background Sync |

### Migration History

```
v0 -> v1: Add messages store
v1 -> v2: Add photos store
v2 -> v3: Add moods store
v3 -> v4: Add sw-auth store for Background Sync
```

### Service Worker Independence

The Service Worker (`sw-db.ts`) independently handles IndexedDB operations because:
- It must work when the app window is closed
- It cannot access the Zustand store or any window-context code
- It opens IndexedDB directly and handles migrations independently

## Supabase Tables

| Table | Slice | When Loaded |
|---|---|---|
| `moods` | moodSlice | On sync, on partner mood fetch |
| `photos` | photosSlice | On gallery view mount |
| `love_notes` | notesSlice | On notes view mount, on realtime event |
| `interactions` | interactionsSlice | On partner view mount, on realtime event |
| `partner_requests` | partnerSlice | On partner view mount |
| `profiles` | partnerSlice | On user search |
| `scripture_sessions` | scriptureReadingSlice | On scripture view mount |
| `scripture_reflections` | scriptureReadingSlice | During reading session |
| `scripture_bookmarks` | scriptureReadingSlice | During reading session |
| `scripture_messages` | scriptureReadingSlice | During reading session |

## Data Lifecycle

### Messages

```
App Init -> IndexedDB (messages store)
  -> If empty: load defaultMessages -> write to IndexedDB -> read back with IDs
  -> If populated: read all messages
  -> set({ messages }) in messagesSlice
```

Custom messages follow the same path but are managed by `customMessageService.ts`.

### Moods

```
Mood Creation:
  User -> moodSlice.addMoodEntry() -> moodService.create() -> IndexedDB (moods store, synced: false)
  -> If online: moodSyncService.syncPendingMoods() -> Supabase (moods table) -> moodService.markSynced()

Mood Recovery (if offline):
  Layer 1: App.tsx periodic sync (5min interval)
  Layer 2: App.tsx online event handler
  Layer 3: Service Worker Background Sync -> REST API -> IndexedDB mark synced -> postMessage to app
```

### Photos

```
Upload: User -> photosSlice.uploadPhoto() -> imageCompressionService -> Supabase Storage + photos table
Read:   photosSlice.loadPhotos() -> Supabase photos table -> signed URLs -> set({ photos })
Delete: photosSlice.deletePhoto() -> Supabase Storage + photos table -> remove from state
```

No local caching for photos -- they require network for signed URL generation.

### Love Notes

```
Send:    notesSlice.sendNote() -> optimistic add -> Supabase insert -> replace optimistic -> Broadcast
Receive: useRealtimeMessages -> Broadcast event -> notesSlice.addNote() (deduplicated)
Load:    notesSlice.fetchNotes() -> Supabase query -> set({ notes })
```

### Settings

```
On store creation: Zustand persist reads from localStorage
  -> Pre-hydration validation (custom storage getItem)
  -> onRehydrateStorage (Map deserialization, defaults for missing fields)
  -> __isHydrated = true

On settings change: set({ settings }) -> Zustand persist automatically writes to localStorage
```

## Corruption Recovery

| Layer | Detection | Recovery |
|---|---|---|
| localStorage | JSON parse failure | Remove key, use defaults |
| localStorage | Pre-hydration validation failure | Remove key, use defaults |
| Zustand persist | onRehydrateStorage error | Remove key, use defaults |
| Zustand persist | Map deserialization failure | Reset to empty Map |
| initializeApp | `__isHydrated === false` | Clear localStorage, show error |
