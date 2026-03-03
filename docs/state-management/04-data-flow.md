# Data Flow Patterns

7 patterns covering offline-first, online-first, realtime, cache, sync, hydration, and broadcast reconnect flows.

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
    | 1. Rate limit check (10 msgs/min via checkRateLimit)
    | 2. getCurrentUserId() + getPartnerId()
    | 3. if (imageFile) validate + compress + upload to storage
    | 4. Create optimistic note with tempId + sending: true
    | 5. set({ notes: [...state.notes, tempNote] })  -- optimistic with tempId
    | 6. supabase.from('love_notes').insert(...)
    | 7. Replace tempId with real ID on Supabase confirmation
    | 8. Broadcast 'new_message' to partner channel
    v
State updated, component re-renders
```

**Key point:** The optimistic update uses a temporary ID (`tempId`). If the Supabase insert fails, the note is marked with `error: true` and can be retried via `retryFailedMessage(tempId)`. On retry, cached `imageBlob` is reused to avoid re-compression.

## Pattern 3: Realtime -> Slice -> State

Used by: Love notes (incoming), Partner mood, Interactions, Scripture together-mode

```
Supabase Realtime (Broadcast API)
    |
    | Event received by hook (e.g., useRealtimeMessages, useScriptureBroadcast)
    v
Hook callback (useRealtimeMessages.handleNewMessage)
    |
    | calls useAppStore().addNote(note)
    v
NotesSlice.addNote()
    |
    | Deduplication: check if note.id already exists in notes array
    | set({ notes: [...state.notes, note] })
    v
State updated, component re-renders
    |
    | navigator.vibrate([30])  -- haptic feedback
```

Scripture together-mode variant:
```
Broadcast channel: scripture-session:{sessionId}
    |
    | 'state_updated' event received by useScriptureBroadcast
    v
ScriptureSlice.onBroadcastReceived(payload)
    |
    | 1. Version check: payload.version > session.version
    | 2. Identify user1 vs user2 via currentUserId === session.userId
    | 3. Map ready/role states for correct user (self vs partner)
    | 4. Update session phase, version, step index
    | 5. Clear lock-in flags on step advance
    v
State updated, together-mode UI re-renders
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

## Pattern 7: Broadcast Reconnect (Epic 4 Hardening)

Used by: Scripture together-mode broadcast channels

```
Channel subscription (useScriptureBroadcast)
    |
    | CHANNEL_ERROR or CLOSED received
    v
Hook error handler
    |
    | 1. Set hasErroredRef = true
    | 2. Guard: check sessionIdFromStore exists + not already retrying
    | 3. supabase.removeChannel(channel)  -- cleanup stale channel
    | 4. channelRef.current = null
    | 5. setRetryCount(c => c + 1)  -- trigger useEffect re-run
    v
useEffect re-fires (sessionId + retryCount in deps)
    |
    | 1. New channel = supabase.channel(channelName, { private: true })
    | 2. Wire all broadcast event handlers (partner_joined, state_updated, etc.)
    | 3. supabase.realtime.setAuth()
    | 4. channel.subscribe()
    v
On SUBSCRIBED status
    |
    | 1. Check hasErroredRef -- if true, this is a reconnect
    | 2. loadSession(sessionId) -- resync state from DB
    | 3. setBroadcastFn(channel.send) -- rewire store broadcast
    | 4. Broadcast partner_joined -- clear partner's disconnected UI
    v
Session state reconciled, channel healthy
```

**Key points:**
- `isRetryingRef` prevents retry storms when CHANNEL_ERROR fires before removeChannel resolves
- On reconnect success, `loadSession` fetches the authoritative session from DB to reconcile any missed broadcasts
- The same pattern is used by `useScripturePresence` for the ephemeral presence channel

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
