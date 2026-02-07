# State Management

> Zustand store architecture and data flow for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

---

## 1. Architecture Overview

The application uses **Zustand 5.0.10** with the compose (slice) pattern to organize state by feature domain.

**Core design decisions:**

- **10 slices** composed into a single `useAppStore` via spread composition
- **Persistence** through the `zustand/persist` middleware with `createJSONStorage` wrapping `localStorage`
- **Partialize** selects only critical keys for localStorage; large datasets use IndexedDB or Supabase
- **Hydration** uses the `onRehydrateStorage` callback to deserialize Map structures, validate state integrity, and set the `__isHydrated` flag
- **Pre-hydration validation** in a custom `getItem` wrapper catches corrupted state before Zustand processes it
- **Middleware tuple** defined as `AppMiddleware = [['zustand/persist', unknown]]` in a single location (`src/stores/types.ts`)
- **E2E testing** access via `window.__APP_STORE__`

```
src/stores/
  useAppStore.ts         # Store creation, persist config, validation
  types.ts               # AppState, AppSlice, AppMiddleware, AppStateCreator
  slices/
    appSlice.ts              # Core runtime state (loading, error, hydration)
    settingsSlice.ts         # User settings, onboarding, initialization
    messagesSlice.ts         # Daily messages, history, custom messages
    navigationSlice.ts       # View routing, browser history
    moodSlice.ts             # Mood tracking, sync, partner moods
    photosSlice.ts           # Photo upload, gallery, storage quota
    interactionsSlice.ts     # Poke/kiss sending, realtime subscription
    partnerSlice.ts          # Partner connection, requests, search
    notesSlice.ts            # Love notes chat, images, rate limiting
    scriptureReadingSlice.ts # Scripture sessions, step advancement, retry
```

---

## 2. Store Composition (useAppStore.ts)

The store is created with the persist middleware wrapping all slices:

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createAppSlice(set, get, api),
      ...createMessagesSlice(set, get, api),
      ...createPhotosSlice(set, get, api),
      ...createSettingsSlice(set, get, api),
      ...createNavigationSlice(set, get, api),
      ...createMoodSlice(set, get, api),
      ...createInteractionsSlice(set, get, api),
      ...createPartnerSlice(set, get, api),
      ...createNotesSlice(set, get, api),
      ...createScriptureReadingSlice(set, get, api),
    }),
    {
      name: 'my-love-storage',
      version: 0,
      storage: createJSONStorage(() => ({ /* custom getItem with validation */ })),
      partialize: (state) => ({ settings, isOnboarded, messageHistory, moods }),
      onRehydrateStorage: () => (state, error) => { /* Map deserialization, validation */ },
    }
  )
);
```

**Persisted keys** (via `partialize`):

| Key | Serialization | Notes |
|-----|---------------|-------|
| `settings` | Direct JSON | Theme, relationship, notifications, customization |
| `isOnboarded` | Direct JSON | Boolean flag |
| `messageHistory` | Map to Array | `shownMessages` Map serialized as `Array.from(map.entries())` |
| `moods` | Direct JSON | Includes `pendingSync` metadata for offline support |

**Non-persisted state** (server-backed or transient):

| Keys | Reason |
|------|--------|
| `photos`, `selectedPhotoId`, `isUploading`, `uploadProgress`, `storageWarning` | Loaded from Supabase on demand |
| `notes`, `notesIsLoading`, `notesHasMore`, `sentMessageTimestamps` | Loaded from Supabase, realtime updates |
| `interactions`, `unviewedCount`, `isSubscribed` | Ephemeral, fetched from Supabase + Realtime |
| `partner`, `sentRequests`, `receivedRequests`, `searchResults` | Loaded fresh from Supabase on mount |
| `session`, `scriptureLoading`, `activeSession`, `pendingRetry` | IndexedDB cache-first, Supabase source of truth |
| `currentView` | Restored from URL on mount |
| `isLoading`, `error`, `__isHydrated` | Runtime-only flags |
| `messages`, `currentMessage`, `customMessages` | Loaded from IndexedDB on init |

---

## 3. Slice Reference

### 3.1 AppSlice (Core)

**File:** `src/stores/slices/appSlice.ts` | **Persisted:** No

Owns core runtime state that all other slices depend on. Defined in `src/stores/types.ts` to avoid circular imports.

| State | Type | Purpose |
|-------|------|---------|
| `isLoading` | `boolean` | Global loading indicator during initialization |
| `error` | `string \| null` | Global error message |
| `__isHydrated` | `boolean` | Persist hydration completion flag (gates IndexedDB access) |

**Actions:** `setLoading(loading)`, `setError(error)`, `setHydrated(hydrated)`

**Dependencies:** None (other slices depend on this)

---

### 3.2 SettingsSlice

**File:** `src/stores/slices/settingsSlice.ts` | **Persisted:** `settings`, `isOnboarded`

Manages user preferences and coordinates app initialization.

| State | Type | Purpose |
|-------|------|---------|
| `settings` | `Settings \| null` | Theme, relationship, notifications, customization |
| `isOnboarded` | `boolean` | Whether onboarding is complete |

**Settings shape:**

```typescript
{
  themeName: ThemeName,
  notificationTime: string,
  relationship: { startDate, partnerName, anniversaries[] },
  customization: { accentColor, fontFamily },
  notifications: { enabled, time }
}
```

**Actions:**

| Action | Description |
|--------|-------------|
| `initializeApp()` | Startup sequence: check hydration, init IndexedDB, load/seed messages, update current |
| `setSettings(settings)` | Replace settings (validates with SettingsSchema via Zod) |
| `updateSettings(updates)` | Merge partial updates (validates merged result) |
| `setOnboarded(onboarded)` | Set onboarding flag |
| `addAnniversary(anniversary)` | Add anniversary with auto-incrementing ID |
| `removeAnniversary(id)` | Remove anniversary by ID |
| `setTheme(theme)` | Update theme name |

**Dependencies:** AppSlice (`setLoading`, `setError`, `__isHydrated`), MessagesSlice (`updateCurrentMessage`)

**Initialization guards:** Module-level `isInitializing` and `isInitialized` booleans prevent concurrent/duplicate initialization in React StrictMode.

---

### 3.3 MessagesSlice

**File:** `src/stores/slices/messagesSlice.ts` | **Persisted:** `messageHistory` (localStorage, Map serialized to Array)

Manages daily love messages, history navigation, and custom message CRUD.

| State | Type | Purpose |
|-------|------|---------|
| `messages` | `Message[]` | All available messages (default + custom, from IndexedDB) |
| `messageHistory` | `MessageHistory` | Current index, shown messages Map, favorites, history limit |
| `currentMessage` | `Message \| null` | Currently displayed message |
| `currentDayOffset` | `number` | Deprecated: use `messageHistory.currentIndex` |
| `customMessages` | `CustomMessage[]` | User-created messages (loaded from IndexedDB) |
| `customMessagesLoaded` | `boolean` | Whether custom messages have been loaded |

**MessageHistory shape:**

```typescript
{
  currentIndex: number,              // 0 = today, 1 = yesterday, etc.
  shownMessages: Map<string, number>, // date string -> message ID
  maxHistoryDays: 30,
  favoriteIds: number[],
  lastShownDate: string,             // deprecated
  lastMessageId: number,             // deprecated
  viewedIds: number[]                // deprecated
}
```

**Actions:**

| Action | Description |
|--------|-------------|
| `loadMessages()` | Load all messages from IndexedDB |
| `addMessage(text, category)` | Add message to IndexedDB and state |
| `toggleFavorite(messageId)` | Toggle favorite in IndexedDB and state |
| `updateCurrentMessage()` | Calculate today's message via rotation algorithm, cache in Map |
| `navigateToPreviousMessage()` | Increment index (today toward past), cache dates |
| `navigateToNextMessage()` | Decrement index (past toward today) |
| `canNavigateBack()` | Check if more history days available |
| `canNavigateForward()` | Check if not already at today |
| `loadCustomMessages()` | Load custom messages from IndexedDB via `customMessageService` |
| `createCustomMessage(input)` | Create in IndexedDB, update state, reload rotation pool |
| `updateCustomMessage(input)` | Update in IndexedDB, optimistic state update |
| `deleteCustomMessage(id)` | Delete from IndexedDB, update state, reload rotation pool |
| `getCustomMessages(filter?)` | Filter custom messages by category, active, search, tags |
| `exportCustomMessages()` | Export to JSON file download |
| `importCustomMessages(file)` | Import from JSON file, dedup, reload |

**Dependencies:** SettingsSlice (`settings.relationship.startDate` for rotation), `storageService`, `customMessageService`

**Rotation pool:** Filters out inactive custom messages (`m.active === false`) before selecting the daily message.

---

### 3.4 NavigationSlice

**File:** `src/stores/slices/navigationSlice.ts` | **Persisted:** No (restored from URL)

Manages view switching with browser history integration.

| State | Type | Purpose |
|-------|------|---------|
| `currentView` | `ViewType` | Active view |

**ViewType:** `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'`

**Actions:**

| Action | Description |
|--------|-------------|
| `setView(view, skipHistory?)` | Set view and push to `window.history` (respects `BASE_URL`) |
| `navigateHome()` | Convenience: `setView('home')` |
| `navigatePhotos()` | Convenience: `setView('photos')` |
| `navigateMood()` | Convenience: `setView('mood')` |
| `navigatePartner()` | Convenience: `setView('partner')` |
| `navigateNotes()` | Convenience: `setView('notes')` |
| `navigateScripture()` | Convenience: `setView('scripture')` |

**Dependencies:** None

---

### 3.5 MoodSlice

**File:** `src/stores/slices/moodSlice.ts` | **Persisted:** `moods` (localStorage + IndexedDB)

Manages daily mood tracking with offline-first sync to Supabase.

| State | Type | Purpose |
|-------|------|---------|
| `moods` | `MoodEntry[]` | User's mood entries |
| `partnerMoods` | `MoodEntry[]` | Partner's mood entries (from Supabase) |
| `syncStatus` | `{ pendingMoods, isOnline, lastSyncAt?, isSyncing }` | Sync state tracking |

**Actions:**

| Action | Description |
|--------|-------------|
| `addMoodEntry(moods, note?)` | Validate, optimistic add, immediate sync if online |
| `getMoodForDate(date)` | Find mood entry by date string |
| `updateMoodEntry(date, moods, note?)` | Update existing entry via MoodService |
| `loadMoods()` | Load all moods from IndexedDB |
| `updateSyncStatus()` | Refresh pending count and online status |
| `syncPendingMoods()` | Sync all unsynced moods to Supabase (returns `{ synced, failed }`) |
| `fetchPartnerMoods(limit?)` | Fetch partner moods from Supabase (default 30) |
| `getPartnerMoodForDate(date)` | Find partner mood by date string |

**Dependencies:** `moodService`, `moodSyncService`, `authService` (offline-safe user ID)

**Offline behavior:** Uses `authService.getCurrentUserIdOfflineSafe()` for cached session access. Mood entries save to IndexedDB immediately and sync to Supabase when connectivity returns via exponential backoff.

---

### 3.6 PhotosSlice

**File:** `src/stores/slices/photosSlice.ts` | **Persisted:** No (loaded from Supabase)

Manages photo upload with progress tracking and storage quota management.

| State | Type | Purpose |
|-------|------|---------|
| `photos` | `PhotoWithUrls[]` | Photos with signed URLs and ownership flag |
| `selectedPhotoId` | `string \| null` | Currently selected photo for carousel |
| `isUploading` | `boolean` | Upload in progress |
| `uploadProgress` | `number` | 0-100 percentage |
| `error` | `string \| null` | Photo-specific error |
| `storageWarning` | `string \| null` | Quota warning message |

**Actions:**

| Action | Description |
|--------|-------------|
| `uploadPhoto(input)` | Check quota, upload with progress callback, generate signed URL |
| `loadPhotos()` | Load user + partner photos from Supabase |
| `deletePhoto(photoId)` | Delete from Supabase storage + DB, remove from state |
| `updatePhoto(photoId, updates)` | Update metadata (caption, tags) |
| `selectPhoto(photoId)` | Set selected photo for carousel view |
| `clearPhotoSelection()` | Clear carousel selection |
| `clearError()` | Clear photo error state |
| `clearStorageWarning()` | Clear quota warning |

**Dependencies:** `photoService`, `supabase` (auth for ownership check)

**Quota thresholds:** Warning at 80%, upload rejected at 95%.

---

### 3.7 InteractionsSlice

**File:** `src/stores/slices/interactionsSlice.ts` | **Persisted:** No (ephemeral, from Supabase)

Manages poke/kiss interactions with realtime subscription.

| State | Type | Purpose |
|-------|------|---------|
| `interactions` | `Interaction[]` | All interactions (sent + received) |
| `unviewedCount` | `number` | Count of unviewed received interactions |
| `isSubscribed` | `boolean` | Whether realtime subscription is active |

**Actions:**

| Action | Description |
|--------|-------------|
| `sendPoke(partnerId)` | Validate, send via service, optimistic add to state |
| `sendKiss(partnerId)` | Validate, send via service, optimistic add to state |
| `markInteractionViewed(id)` | Mark as viewed on server, update local state |
| `getUnviewedInteractions()` | Filter for unviewed interactions (sync) |
| `getInteractionHistory(days?)` | Filter by date range (default 7 days, sync) |
| `loadInteractionHistory(limit?)` | Fetch history from Supabase (default 100) |
| `subscribeToInteractions()` | Subscribe to Supabase Realtime, returns unsubscribe function |
| `addIncomingInteraction(record)` | Add from realtime with deduplication check |

**Dependencies:** `InteractionService`, `authService`, `validateInteraction` utility

---

### 3.8 PartnerSlice

**File:** `src/stores/slices/partnerSlice.ts` | **Persisted:** No (loaded from Supabase)

Manages partner connection lifecycle: search, request, accept/decline.

| State | Type | Purpose |
|-------|------|---------|
| `partner` | `PartnerInfo \| null` | Connected partner information |
| `isLoadingPartner` | `boolean` | Partner loading state |
| `sentRequests` | `PartnerRequest[]` | Outgoing partner requests |
| `receivedRequests` | `PartnerRequest[]` | Incoming partner requests |
| `isLoadingRequests` | `boolean` | Requests loading state |
| `searchResults` | `UserSearchResult[]` | User search results |
| `isSearching` | `boolean` | Search in progress |

**Actions:**

| Action | Description |
|--------|-------------|
| `loadPartner()` | Fetch current partner from Supabase |
| `loadPendingRequests()` | Fetch sent and received requests |
| `searchUsers(query)` | Search users (minimum 2 characters) |
| `clearSearch()` | Clear search results |
| `sendPartnerRequest(toUserId)` | Send request, reload pending, clear search |
| `acceptPartnerRequest(requestId)` | Accept, reload partner + requests |
| `declinePartnerRequest(requestId)` | Decline, reload requests |
| `hasPartner()` | Check if partner is connected (sync) |

**Dependencies:** `partnerService`

---

### 3.9 NotesSlice

**File:** `src/stores/slices/notesSlice.ts` | **Persisted:** No (loaded from Supabase)

Manages love notes chat with image support, optimistic updates, and rate limiting.

| State | Type | Purpose |
|-------|------|---------|
| `notes` | `LoveNote[]` | Chat messages in chronological order |
| `notesIsLoading` | `boolean` | Notes loading state |
| `notesError` | `string \| null` | Notes-specific error |
| `notesHasMore` | `boolean` | Whether older notes exist for pagination |
| `sentMessageTimestamps` | `number[]` | Timestamps for sliding-window rate limiting |

**Actions:**

| Action | Description |
|--------|-------------|
| `fetchNotes(limit?)` | Fetch conversation notes (default page size), reverse for chat order |
| `fetchOlderNotes(limit?)` | Pagination: fetch notes older than earliest, prepend to array |
| `addNote(note)` | Add single note with deduplication (for realtime) |
| `setNotes(notes)` | Replace all notes (cleans up blob preview URLs) |
| `setNotesError(error)` | Set error state |
| `clearNotesError()` | Clear error state |
| `checkRateLimit()` | Enforce 10 messages per minute sliding window (throws on limit) |
| `sendNote(content, imageFile?)` | Optimistic send: temp ID, compress image, upload, insert, broadcast |
| `retryFailedMessage(tempId)` | Retry using cached `imageBlob` (no re-compression) |
| `cleanupPreviewUrls()` | Revoke all blob URLs to prevent memory leaks |
| `removeFailedMessage(tempId)` | Remove failed message and clean up preview URL |

**Dependencies:** `supabase` (direct queries), `authService`, `imageCompressionService`, `uploadCompressedBlob`

**Image flow:** Validate file, create blob preview URL for optimistic display, compress via `imageCompressionService`, cache blob on note for retry, upload to Supabase Storage, insert record with `image_url`, broadcast to partner channel.

**Rate limiting:** Sliding window of `sentMessageTimestamps` filtered to last 60 seconds. Maximum 10 messages per window.

---

### 3.10 ScriptureReadingSlice

**File:** `src/stores/slices/scriptureReadingSlice.ts` | **Persisted:** No (IndexedDB cache + Supabase)

Manages scripture reading sessions with optimistic step advancement and server retry.

| State | Type | Purpose |
|-------|------|---------|
| `session` | `ScriptureSession \| null` | Active reading session |
| `scriptureLoading` | `boolean` | Session creation/loading in progress |
| `isInitialized` | `boolean` | Whether a session has been loaded |
| `isPendingLockIn` | `boolean` | Phase transition flag |
| `isPendingReflection` | `boolean` | Phase transition flag |
| `isSyncing` | `boolean` | Server write in progress |
| `scriptureError` | `ScriptureError \| null` | Typed error with code and message |
| `activeSession` | `ScriptureSession \| null` | Incomplete session found during check |
| `isCheckingSession` | `boolean` | Active session check in progress |
| `pendingRetry` | `PendingRetry \| null` | Failed write retry state (type, attempts, maxAttempts) |

**Actions:**

| Action | Description |
|--------|-------------|
| `createSession(mode, partnerId?)` | Create new session via service |
| `loadSession(sessionId)` | Load session with refresh callback |
| `exitSession()` | Reset to initial state |
| `updatePhase(phase)` | Update session phase locally |
| `clearScriptureError()` | Clear error state |
| `checkForActiveSession()` | Find incomplete solo sessions for current user |
| `clearActiveSession()` | Clear the active session reference |
| `advanceStep()` | Optimistic step increment, persist to server with retry on failure |
| `saveAndExit()` | Persist current progress, reset to initial state |
| `saveSession()` | Silent save without clearing state |
| `abandonSession(sessionId)` | Mark session as abandoned on server, reset state |
| `retryFailedWrite()` | Retry with attempt counter (max 3), keep error on max reached |

**Dependencies:** `scriptureReadingService`, `supabase` (auth for user ID)

**Retry pattern:** On server write failure, sets `pendingRetry` with `{ type, attempts: 1, maxAttempts: 3 }`. Each `retryFailedWrite()` increments attempts. Error persists after max attempts for user visibility.

---

## 4. Initialization Flow

```
App Start
  |
  v
Store Creation
  |-- persist middleware wraps all slices
  |-- createJSONStorage custom getItem runs pre-hydration validation
  |     |-- Parse localStorage JSON
  |     |-- validateHydratedState() checks settings structure, messageHistory integrity
  |     |-- If invalid: clear localStorage, return null (use defaults)
  |     '-- If valid: return raw string for Zustand to process
  |
  v
onRehydrateStorage callback
  |-- If error: clear localStorage, continue with defaults
  |-- Deserialize messageHistory.shownMessages (Array -> Map with entry validation)
  |-- Handle null/undefined messageHistory (create default structure)
  |-- Post-hydration validateHydratedState()
  |-- If invalid: clear localStorage
  |-- Set state.__isHydrated = true (direct property assignment, not via action)
  |
  v
App Component Mounts (useEffect)
  |
  v
initializeApp() (settingsSlice)
  |-- Guard: skip if isInitializing or isInitialized (StrictMode protection)
  |-- Check __isHydrated flag
  |     |-- If false: set error, clear localStorage, return
  |     '-- If true: proceed
  |-- Initialize IndexedDB via storageService.init()
  |-- Load messages from IndexedDB (storageService.getAllMessages())
  |     |-- If empty: seed with defaultMessages, reload for auto-generated IDs
  |     '-- If populated: set directly
  |-- updateCurrentMessage() -> calculate today's message via rotation algorithm
  |-- setLoading(false)
  '-- Mark isInitialized = true
```

---

## 5. Data Flow Diagrams

### 5.1 Mood Lifecycle

```
User taps mood emoji(s)
  |
  v
addMoodEntry(moods, note?)
  |-- authService.getCurrentUserIdOfflineSafe()
  |-- Check existing mood for today (update if exists)
  |-- moodService.create(userId, moods, note)  -->  IndexedDB write
  |-- Optimistic: add to state.moods[]
  |-- updateSyncStatus()
  |
  |-- [Online?]
  |     |-- Yes: syncPendingMoods()
  |     |     |-- moodSyncService.syncPendingMoods()  -->  Supabase upsert
  |     |     |-- Reload moods from IndexedDB (reflect synced status)
  |     |     |-- fetchPartnerMoods()  -->  Supabase query
  |     |     '-- Update lastSyncAt timestamp
  |     |
  |     '-- No: Background sync retries later with exponential backoff
  |
  v
Partner sees updated mood via fetchPartnerMoods()
```

### 5.2 Photo Upload

```
User selects image file
  |
  v
uploadPhoto(input)
  |-- Check storage quota (photoService.checkStorageQuota())
  |     |-- >= 95%: reject with error
  |     '-- >= 80%: set storageWarning
  |-- photoService.uploadPhoto(input, progressCallback)
  |     '-- progressCallback updates uploadProgress (0-100%)
  |-- photoService.getSignedUrl(storage_path)
  |-- Create PhotoWithUrls { ...photo, signedUrl, isOwn }
  |-- Optimistic: prepend to state.photos[]
  |-- Post-upload quota check for warning
  |
  v
Photos appear in gallery with signed URLs
```

### 5.3 Love Notes (Realtime)

```
Sender                                    Receiver
  |                                         |
sendNote(content, imageFile?)               |
  |-- checkRateLimit() (10/min)             |
  |-- Create temp ID                        |
  |-- [Has image?]                          |
  |     |-- Validate, create blob preview   |
  |     |-- Compress image                  |
  |     |-- Cache blob on note for retry    |
  |     '-- Upload to Supabase Storage      |
  |-- Optimistic: add to state.notes[]      |
  |                                         |
  |-- supabase.from('love_notes').insert()  |
  |     '-- On error: mark sending=false,   |
  |        error=true, keep blob for retry  |
  |                                         |
  |-- Replace temp note with server data    |
  |                                         |
  |-- Broadcast via Supabase channel -----> useRealtimeMessages hook
  |     subscribe -> send -> unsubscribe    |  |-- Receive 'new_message' event
  |                                         |  |-- addNote(message) with dedup
  v                                         |  '-- Trigger vibration
Done                                        v
                                      Note appears in chat
```

### 5.4 Scripture Session

```
User starts reading
  |
  v
createSession(mode)
  |-- scriptureReadingService.createSession()  -->  IndexedDB + Supabase
  |-- Set session in state
  |
  v
Reading loop: advanceStep()
  |-- Calculate nextStep = currentStepIndex + 1
  |-- [Last step?]
  |     |-- Yes: set phase='reflection', status='complete'
  |     '-- No: increment currentStepIndex
  |-- Optimistic: update session in state immediately
  |-- Set isSyncing = true
  |-- scriptureReadingService.updateSession()  -->  server write
  |     |-- Success: isSyncing=false, pendingRetry=null
  |     '-- Failure: set scriptureError, pendingRetry { attempts: 1, max: 3 }
  |
  |-- [User taps retry?]
  |     '-- retryFailedWrite() increments attempts, retries server write
  |
  v
saveAndExit() or session complete
```

---

## 6. Persistence Summary

| State Domain | localStorage | IndexedDB | Supabase | Realtime |
|-------------|:---:|:---:|:---:|:---:|
| **Settings** (theme, relationship, notifications) | Yes | -- | -- | -- |
| **isOnboarded** | Yes | -- | -- | -- |
| **messageHistory** (shownMessages Map, favorites) | Yes | -- | -- | -- |
| **messages** (default + custom) | -- | Yes | -- | -- |
| **customMessages** | -- | Yes | -- | -- |
| **moods** | Yes (sync meta) | Yes | Yes | -- |
| **partnerMoods** | -- | -- | Yes | -- |
| **photos** | -- | -- | Yes (storage + DB) | -- |
| **interactions** | -- | -- | Yes | Yes |
| **partner**, **requests** | -- | -- | Yes | -- |
| **notes** (love notes) | -- | -- | Yes | Yes (broadcast) |
| **scripture sessions** | -- | Yes (cache) | Yes | -- |
| **navigation** (currentView) | -- | -- | -- | -- |
| **app** (loading, error, hydrated) | -- | -- | -- | -- |

**Legend:**
- **localStorage:** Persisted via Zustand persist middleware, survives page refresh
- **IndexedDB:** Large datasets, offline-first storage
- **Supabase:** Server source of truth, synced when online
- **Realtime:** Supabase Realtime channels for live updates

---

## 7. Error Handling Patterns

### Read Operations: Graceful Degradation

Read operations return empty/null values and log errors without throwing. The UI continues to function with partial data.

```typescript
// Example: loadMoods() - returns empty array on failure
loadMoods: async () => {
  try {
    const allMoods = await moodService.getAll();
    set({ moods: allMoods });
  } catch (error) {
    console.error('[MoodSlice] Error loading moods:', error);
    // Don't throw - graceful degradation with empty state
  }
}
```

**Slices using this pattern:** MoodSlice (`loadMoods`, `fetchPartnerMoods`, `updateSyncStatus`), InteractionsSlice (`loadInteractionHistory`), PartnerSlice (`loadPartner`, `loadPendingRequests`, `searchUsers`)

### Write Operations: Throw for Caller Handling

Write operations throw errors so the calling UI component can display appropriate feedback (toast, inline error, retry button).

```typescript
// Example: addMoodEntry() - throws on failure
addMoodEntry: async (moods, note) => {
  try { /* ... */ }
  catch (error) {
    console.error('[MoodSlice] Error adding mood entry:', error);
    throw error; // Re-throw to allow UI to show error feedback
  }
}
```

**Slices using this pattern:** MoodSlice (`addMoodEntry`, `updateMoodEntry`, `syncPendingMoods`), PhotosSlice (sets `error` state), InteractionsSlice (`sendPoke`, `sendKiss`, `markInteractionViewed`), PartnerSlice (`sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest`), NotesSlice (`sendNote` for rate limit errors)

### State Error Fields

Several slices maintain dedicated error state for UI display:

| Slice | Error Field | Type |
|-------|-------------|------|
| AppSlice | `error` | `string \| null` |
| PhotosSlice | `error` | `string \| null` |
| NotesSlice | `notesError` | `string \| null` |
| ScriptureSlice | `scriptureError` | `ScriptureError \| null` (typed: code + message + details) |

### Optimistic Update Failure

When an optimistic update fails to sync with the server:

- **Notes:** Mark `sending=false`, `error=true` on the note object. User can tap retry.
- **Scripture:** Set `pendingRetry` with attempt counter. User can retry up to 3 times.
- **Moods:** Entry stays in IndexedDB as unsynced. Background sync retries with exponential backoff.
- **Photos:** Upload progress resets, `error` state set with descriptive message.

---

## 8. Cross-Slice Dependencies

```
AppSlice
  ^  (setLoading, setError, __isHydrated)
  |
  +-- SettingsSlice.initializeApp()
  |     |
  |     +-- MessagesSlice.updateCurrentMessage()
  |     |
  |     v
  |   MessagesSlice
  |     ^  (settings.relationship.startDate for message rotation)
  |     |
  |     +-- SettingsSlice (read-only dependency)
  |
  +-- All other slices (self-contained, no cross-slice reads)

NavigationSlice ---- independent
MoodSlice ---------- independent (uses external services)
PhotosSlice -------- independent
InteractionsSlice -- independent
PartnerSlice ------- independent
NotesSlice --------- independent
ScriptureSlice ----- independent
```

---

## 9. Custom Hooks (Store Consumers)

| Hook | File | Selects From | Side Effects |
|------|------|-------------|-------------|
| `useLoveNotes(autoFetch?)` | `src/hooks/useLoveNotes.ts` | notes, loading, send, retry | Auto-fetch, realtime subscription, blob cleanup |
| `usePhotos(autoLoad?)` | `src/hooks/usePhotos.ts` | photos, upload, progress | Auto-load on mount |
| `useRealtimeMessages()` | `src/hooks/useRealtimeMessages.ts` | -- | Broadcast channel subscription, backoff retry |
| `useAuth()` | `src/hooks/useAuth.ts` | user, isLoading | Auth state listener |
| `useNetworkStatus()` | `src/hooks/useNetworkStatus.ts` | isOnline, isConnecting | online/offline event listeners |
| `useMotionConfig()` | `src/hooks/useMotionConfig.ts` | shouldReduceMotion, presets | `prefers-reduced-motion` media query |
| `useMoodHistory()` | `src/hooks/useMoodHistory.ts` | Mood query + filtering | -- |
| `usePartnerMood()` | `src/hooks/usePartnerMood.ts` | Partner mood data | -- |
| `useAutoSave()` | `src/hooks/useAutoSave.ts` | isDirty, save | Debounced auto-save |
| `useVibration()` | `src/hooks/useVibration.ts` | trigger | Haptic vibration patterns |
| `useImageCompression()` | `src/hooks/useImageCompression.ts` | compress | -- |

---

## 10. Access Patterns

**Selector** (recommended for components -- triggers re-render only when selected state changes):

```typescript
const messages = useAppStore((s) => s.messages);
const { settings, updateSettings } = useAppStore((s) => ({
  settings: s.settings,
  updateSettings: s.updateSettings,
}));
```

**Custom hook** (recommended for features with side effects):

```typescript
const { notes, sendNote, retryFailedMessage } = useLoveNotes();
const { photos, uploadPhoto, uploadProgress } = usePhotos();
```

**Direct access** (outside React components -- services, utilities, tests):

```typescript
// Read current state
const currentState = useAppStore.getState();

// Subscribe to changes
const unsubscribe = useAppStore.subscribe((state) => {
  console.log('State changed:', state);
});

// E2E testing
window.__APP_STORE__?.getState();
```
