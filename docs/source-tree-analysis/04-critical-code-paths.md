# Critical Code Paths

Analysis of the highest-impact code paths in the application -- the flows where bugs have the greatest consequences.

## 1. App Initialization Path

**Files**: `src/main.tsx` -> `src/App.tsx` -> `src/stores/slices/settingsSlice.ts`

This is the critical startup sequence. A failure here prevents the entire app from loading.

```
main.tsx: initSentry() -> createRoot -> render(<App />)
  |
App.tsx: checkAuth() -> getSession() + onAuthStateChange()
  |-- Stores auth tokens in IndexedDB for SW background sync
  |-- Sets Sentry user context
  |
App.tsx: initializeApp() (via settingsSlice)
  |-- Guard: isInitializing / isInitialized (module-level flags for StrictMode)
  |-- Check __isHydrated flag (Zustand persist hydration)
  |-- If not hydrated: clear corrupted localStorage, return
  |-- storageService.init() -> open IndexedDB (v5, 8 stores)
  |-- Load messages from IndexedDB
  |-- If empty: lazy-load defaultMessages.ts (~1677 lines), write to IndexedDB
  |-- updateCurrentMessage() (cross-slice call to MessagesSlice)
  |-- set({ isLoading: false })
```

**Failure modes**:

- IndexedDB open failure -> app stuck in loading state
- Zustand persist corruption -> settings reset, localStorage cleared
- Auth token storage failure -> background sync breaks silently

## 2. Mood Create + Sync Path

**Files**: `src/stores/slices/moodSlice.ts` -> `src/services/moodService.ts` -> `src/api/moodSyncService.ts` -> `src/sw.ts`

The three-tier sync path is the most complex data flow in the app.

```
MoodSlice.addMoodEntry(moods, note)
  |-- getCurrentUserIdOfflineSafe() (no network required)
  |-- MoodService.create(userId, moods, note)
  |   |-- MoodEntrySchema.parse() (Zod validation)
  |   |-- IndexedDB write via BaseIndexedDBService.add()
  |   |-- Returns { synced: false, supabaseId: undefined }
  |
  |-- Optimistic state update: set({ moods: [...state.moods, created] })
  |-- updateSyncStatus() (count unsynced)
  |
  |-- Tier 1 (Immediate): if navigator.onLine -> syncPendingMoods()
  |   |-- moodSyncService: read unsynced from IDB -> POST to Supabase
  |   |-- On success: moodService.markAsSynced(localId, supabaseId)
  |   |-- On failure: non-blocking, logged, retried later
  |
  |-- Tier 2 (Periodic): 5-min setInterval in App.tsx -> syncPendingMoods()
  |
  |-- Tier 3 (Background Sync): SW sync event -> read IDB -> Supabase REST API
  |   |-- Reads auth token from sw-auth store
  |   |-- Checks token expiry (5 min buffer)
  |   |-- Notifies clients via postMessage(BACKGROUND_SYNC_COMPLETED)
```

## 3. Scripture Session Path (Online-First)

**Files**: `src/stores/slices/scriptureReadingSlice.ts` -> `src/services/scriptureReadingService.ts`

The largest slice (1021 lines) with the most complex state machine.

```
ScriptureSlice.createSession('solo')
  |-- scriptureReadingService.createSession('solo')
  |   |-- supabase.rpc('scripture_create_session', { p_mode: 'solo' })
  |   |-- SupabaseSessionSchema.parse(data) (Zod validation)
  |   |-- toLocalSession(validated, userId) (transform)
  |   |-- cacheSession(local) (fire-and-forget IndexedDB write)
  |-- Optimistic state update
  |
ScriptureSlice.advanceStep(sessionId)
  |-- Optimistic: increment current_step_index in state
  |-- scriptureReadingService.advanceStep(sessionId, newIndex)
  |   |-- supabase.rpc('scripture_advance_step')
  |   |-- On failure: set pendingRetry state, UI shows retry button
  |   |-- On success: update cache

Together-mode additions:
  |-- useScriptureBroadcast: private channel for state sync events
  |-- useScripturePresence: ephemeral presence for position tracking
  |-- Lock-in mechanism: both partners must confirm before advancing
  |-- Disconnection detection: overlay with reconnect/solo-fallback
```

## 4. Love Notes Realtime Path

**Files**: `src/stores/slices/notesSlice.ts` -> `src/hooks/useRealtimeMessages.ts` -> `src/hooks/useLoveNotes.ts`

Combines Supabase-direct writes with Broadcast realtime delivery.

```
NotesSlice.sendNote(content, imageFile?)
  |-- Rate limit check (10 msgs/min)
  |-- DOMPurify.sanitize(content) (XSS prevention)
  |-- if imageFile: compress -> Edge Function upload -> get storagePath
  |-- Optimistic: add note with tempId to state
  |-- supabase.from('love_notes').insert(...)
  |-- Replace tempId with real Supabase ID
  |-- Broadcast: channel.send({ event: 'new_note', payload })

Receive path (useRealtimeMessages):
  |-- channel.on('broadcast', { event: 'new_note' }, handler)
  |-- Exponential backoff retry on connection failure (1s-30s, 5 retries)
  |-- navigator.vibrate() on new message
  |-- Cleanup: unsubscribe on unmount
```

## 5. Auth Token Lifecycle Path

**Files**: `src/api/auth/sessionService.ts` -> `src/api/auth/actionService.ts` -> `src/sw-db.ts`

Auth tokens must be available to both the main app and the service worker.

```
Sign-in flow:
  |-- actionService.signIn(email, password)
  |-- supabase.auth.signInWithPassword()
  |-- onAuthStateChange fires with SIGNED_IN
  |-- storeAuthToken() -> IndexedDB sw-auth store
  |-- setSentryUser() with UUID only

Token refresh:
  |-- Supabase auto-refreshes JWT before expiry
  |-- onAuthStateChange fires with TOKEN_REFRESHED
  |-- storeAuthToken() updates IndexedDB

Sign-out flow:
  |-- actionService.signOut()
  |-- clearAuthToken() -> IndexedDB sw-auth store
  |-- clearSentryUser()

SW background sync:
  |-- getAuthToken() from IndexedDB
  |-- Check expiresAt < now + 300 (5 min buffer)
  |-- If expired: skip sync, wait for app to refresh
```

## 6. IndexedDB Schema Migration Path

**Files**: `src/services/dbSchema.ts` -> `src/services/photoStorageService.ts`

Schema migrations must be handled carefully to avoid data loss.

```
Any service calls init():
  |-- BaseIndexedDBService.init() (guards against concurrent init)
  |-- _doInit() opens DB with upgradeDb callback
  |
upgradeDb(db, oldVersion, newVersion):
  |-- v1: Create messages store (by-category, by-date indexes)
  |-- v2: Delete old photos store, recreate with imageBlob field
  |-- v3: Create moods store (by-date unique index)
  |-- v4: Create sw-auth store
  |-- v5: Create 4 scripture stores (sessions, reflections, bookmarks, messages)

Special case: v1->v2 photos migration
  |-- photoStorageService._doInit() reads v1 photos BEFORE upgrade
  |-- upgradeDb() recreates photos store
  |-- photoStorageService re-inserts migrated data AFTER upgrade
```

## Critical File Impact Rankings

| File                                         | Lines | Impact | Reason                                           |
| -------------------------------------------- | ----- | ------ | ------------------------------------------------ |
| `src/App.tsx`                                | 610   | High   | Auth gate, routing, sync setup, lazy loading     |
| `src/stores/slices/scriptureReadingSlice.ts` | 1021  | High   | Largest slice, complex state machine             |
| `src/stores/useAppStore.ts`                  | 290   | High   | All app state, persist config, Map serialization |
| `src/services/dbSchema.ts`                   | 280   | High   | Shared IndexedDB schema, all migration logic     |
| `src/api/supabaseClient.ts`                  | 159   | High   | Singleton client, env var validation at import   |
| `src/stores/slices/notesSlice.ts`            | 608   | Medium | Realtime chat, rate limiting, image handling     |
| `src/stores/slices/messagesSlice.ts`         | 527   | Medium | Message rotation, custom CRUD, history           |
| `src/stores/slices/moodSlice.ts`             | 339   | Medium | Offline sync, partner mood, auto-update          |
| `src/sw.ts`                                  | 261   | Medium | Background sync, cache strategies                |
| `src/stores/slices/settingsSlice.ts`         | 258   | Medium | initializeApp, hydration validation              |

## Related Documentation

- [Entry Point Trace](./03-entry-point-trace.md)
- [Architecture - Architecture Patterns](../architecture/03-architecture-patterns.md)
- [Architecture - Error Handling](../architecture/17-error-handling.md)
