# Data Flow Patterns

## Pattern 1: Component -> Slice -> IndexedDB (Offline-First)

Used by: Mood tracking, Custom messages

```
Component (e.g., MoodTracker)
    |
    | calls useAppStore().addMoodEntry(moods, note)
    v
MoodSlice.addMoodEntry()
    |
    | 1. getCurrentUserIdOfflineSafe()  -- cached session
    | 2. moodService.create(userId, moods, note)
    |    |-- MoodEntrySchema.parse()  -- Zod validation
    |    |-- indexedDB.add()  -- synced: false
    | 3. set({ moods: [...state.moods, created] })  -- optimistic update
    | 4. updateSyncStatus()  -- count pending
    | 5. if (online) syncPendingMoods()  -- immediate sync attempt
    v
State updated, component re-renders
```

**Key point:** The IndexedDB write happens before the state update. If the write fails (validation error), the state is never updated.

## Pattern 2: Component -> Slice -> Supabase (Online-First)

Used by: Love notes, Photos, Partner data

```
Component (e.g., LoveNotes MessageInput)
    |
    | calls useAppStore().sendNote(text, imageFile?)
    v
NotesSlice.sendNote()
    |
    | 1. Rate limit check (10 msgs/min)
    | 2. sanitizeMessageContent(text)  -- DOMPurify
    | 3. if (imageFile) compress + upload via Edge Function
    | 4. supabase.from('love_notes').insert(...)
    | 5. set({ notes: [...state.notes, tempNote] })  -- optimistic with tempId
    | 6. Replace tempId with real ID on Supabase confirmation
    v
State updated, component re-renders
```

**Key point:** The optimistic update uses a temporary ID. If the Supabase insert fails, the note may be rolled back or shown in an error state.

## Pattern 3: Realtime -> Slice -> State

Used by: Love notes (incoming), Partner mood, Interactions

```
Supabase Realtime (Broadcast/postgres_changes)
    |
    | Event received by hook (e.g., useRealtimeMessages)
    v
Hook callback
    |
    | calls useAppStore().addIncomingNote(note)
    v
NotesSlice.addIncomingNote()
    |
    | set({ notes: [...state.notes, note] })
    v
State updated, component re-renders
    |
    | navigator.vibrate()  -- haptic feedback
```

## Pattern 4: Read-Through Cache (Scripture)

Used by: Scripture reading sessions

```
Component requests session data
    |
    v
ScriptureReadingSlice action
    |
    v
ScriptureReadingService
    |
    | 1. Check IndexedDB cache
    |    |-- Cache hit: return cached data
    |    |-- Cache miss: fetch from Supabase
    | 2. Fire-and-forget background refresh
    |    |-- Fetch latest from Supabase
    |    |-- Write to IndexedDB cache
    |    |-- Update slice state if data changed
    v
State updated with cached or fresh data
```

## Pattern 5: Background Sync (Service Worker)

Used by: Mood sync when app is backgrounded

```
Service Worker receives 'sync' event
    |
    v
sw.ts syncPendingMoods()
    |
    | 1. sw-db.ts getPendingMoods()  -- direct IndexedDB read
    | 2. sw-db.ts getAuthToken()  -- JWT from sw-auth store
    | 3. For each unsynced mood:
    |    |-- fetch() to Supabase REST API
    |    |-- On success: markMoodSynced(id, supabaseId)
    | 4. postMessage to all clients
    v
Main app receives BACKGROUND_SYNC_COMPLETED
    |
    | setupServiceWorkerListener callback
    v
MoodSlice.loadMoods()  -- refresh state from IndexedDB
MoodSlice.updateSyncStatus()  -- refresh counts
```

## Pattern 6: Hydration -> Initialization

Occurs once on app startup:

```
Browser loads app
    |
    v
Zustand persist middleware
    |
    | 1. Read localStorage('my-love-storage')
    | 2. Deserialize (custom Map handling)
    | 3. Merge with default state
    | 4. Set __isHydrated = true
    v
App.tsx useEffect
    |
    | calls initializeApp()
    v
SettingsSlice.initializeApp()
    |
    | 1. Check __isHydrated
    | 2. storageService.init()  -- open IndexedDB
    | 3. Load messages from IndexedDB
    | 4. If empty: seed default messages
    | 5. updateCurrentMessage()
    | 6. setLoading(false)
    v
App renders main content
```

## State Update Semantics

### Immer-Style Updaters

Some slices use the updater function form for complex state updates:

```typescript
set((state) => ({
  moods: [...state.moods, created],
}));
```

### Direct State Setting

Simple updates use direct object spread:

```typescript
set({ currentView: view });
```

### Nested Object Updates

Settings updates require manual nested spreading:

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

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Persistence Strategy](./05-persistence-strategy.md)
- [React Hooks](./06-react-hooks.md)
