# Data Flow Patterns

## Pattern 1: Offline-First (Component -> Slice -> IndexedDB)

Used by: Mood tracking, Custom messages

```
Component (e.g., MoodTracker)
    | calls addMoodEntry(moods, note)
    v
MoodSlice.addMoodEntry()
    | 1. getCurrentUserIdOfflineSafe()  -- cached session
    | 2. moodService.create(userId, moods, note)
    |    |-- MoodEntrySchema.parse()  -- Zod validation
    |    |-- indexedDB.add()  -- synced: false
    | 3. set({ moods: [...state.moods, created] })  -- optimistic
    | 4. updateSyncStatus()  -- count pending
    | 5. if (online) syncPendingMoods()  -- immediate sync attempt
    v
State updated, component re-renders
```

IndexedDB write happens BEFORE state update. If validation fails, state is never updated.

## Pattern 2: Online-First (Component -> Slice -> Supabase)

Used by: Love notes, Photos, Partner data

```
Component (e.g., MessageInput)
    | calls sendNote(text, imageFile?)
    v
NotesSlice.sendNote()
    | 1. checkRateLimit() (10 msgs/min)
    | 2. Create optimistic note with tempId
    | 3. set({ notes: [...notes, optimisticNote] })  -- immediate UI
    | 4. if (imageFile): compress + uploadCompressedBlob()
    | 5. supabase.from('love_notes').insert(...)
    | 6. Replace tempId with real ID on success
    | 7. Broadcast to partner channel
    v
State updated, component re-renders
```

On failure: note stays in state with `error: true`, retry available via `retryFailedMessage`.

## Pattern 3: Realtime Inbound (Supabase -> Hook -> Slice)

Used by: Love notes (incoming), Partner mood, Interactions

```
Supabase Realtime Broadcast
    | Event received by hook (useRealtimeMessages)
    v
Hook callback
    | calls addNote(note) or addIncomingInteraction(record)
    v
Slice action
    | Deduplication check (by ID)
    | set({ notes: [...notes, note] })
    v
State updated, component re-renders
    | navigator.vibrate()  -- haptic feedback
```

## Pattern 4: Read-Through Cache (Scripture)

Used by: Scripture reading sessions

```
Component requests loadSession(sessionId)
    v
ScriptureReadingSlice.loadSession()
    v
scriptureReadingService.getSession(sessionId, refreshCallback)
    | 1. Check IndexedDB cache
    |    |-- Cache hit: return cached, fire background refresh
    |    |-- Cache miss: fetch from Supabase
    | 2. Background refresh writes to IndexedDB + calls refreshCallback
    v
set({ session })  -- immediate from cache or Supabase
```

## Pattern 5: Background Sync (Service Worker)

Used by: Mood sync when app is backgrounded

```
Service Worker 'sync' event
    | sw.ts syncPendingMoods()
    | 1. getPendingMoods() from IndexedDB
    | 2. getAuthToken() from sw-auth store
    | 3. For each unsynced: fetch() to Supabase REST
    | 4. On success: markMoodSynced(id, supabaseId)
    | 5. postMessage({ type: 'BACKGROUND_SYNC_COMPLETED' })
    v
Main app receives message
    | setupServiceWorkerListener callback
    v
MoodSlice.loadMoods() + updateSyncStatus()
```

## Pattern 6: Hydration -> Initialization

Occurs once on app startup:

```
Browser loads app
    v
Zustand persist middleware
    | 1. Read localStorage('my-love-storage')
    | 2. validateHydratedState() -- pre-hydration check
    | 3. Merge with default state
    | 4. onRehydrateStorage: deserialize Map, set __isHydrated = true
    v
App.tsx useEffect
    | calls initializeApp()
    v
SettingsSlice.initializeApp()
    | 1. Check __isHydrated (fail-safe for corrupted storage)
    | 2. storageService.init()  -- open IndexedDB
    | 3. Load messages from IndexedDB
    | 4. If empty: seed default messages + reload
    | 5. updateCurrentMessage()  -- compute today's message
    | 6. setLoading(false)
    v
App renders main content
```

## State Update Semantics

**Updater function** (for state-dependent updates):

```typescript
set((state) => ({ moods: [...state.moods, created] }));
```

**Direct object** (for simple updates):

```typescript
set({ currentView: view });
```

**Nested spread** (for deeply nested updates like settings):

```typescript
set({
  settings: {
    ...settings,
    relationship: {
      ...settings.relationship,
      anniversaries: [...settings.relationship.anniversaries, newAnniversary],
    },
  },
});
```

No immer middleware -- all nested updates require manual spreading.

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Persistence Strategy](./05-persistence-strategy.md)
- [React Hooks](./06-react-hooks.md)
