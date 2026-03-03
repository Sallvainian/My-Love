# Slice Details

## 1. AppSlice (`src/stores/slices/appSlice.ts`)

The core application state slice. Interface defined in `src/stores/types.ts` to avoid circular imports.

**State:**

| Field          | Type             | Default | Persisted |
| -------------- | ---------------- | ------- | --------- |
| `isLoading`    | `boolean`        | `false` | No        |
| `error`        | `string \| null` | `null`  | No        |
| `__isHydrated` | `boolean`        | `false` | No        |

**Actions:**

| Action        | Signature                         | Description             |
| ------------- | --------------------------------- | ----------------------- |
| `setLoading`  | `(loading: boolean) => void`      | Toggle loading state    |
| `setError`    | `(error: string \| null) => void` | Set/clear error message |
| `setHydrated` | `(hydrated: boolean) => void`     | Set hydration flag      |

**Cross-Slice Dependencies:** None. This slice is the most fundamental -- other slices call `get().setLoading()` and `get().setError()`.

---

## 2. SettingsSlice (`src/stores/slices/settingsSlice.ts`)

Manages settings, onboarding, themes, anniversaries, and app initialization.

**State:**

| Field         | Type               | Default                 | Persisted |
| ------------- | ------------------ | ----------------------- | --------- |
| `settings`    | `Settings \| null` | Pre-configured defaults | Yes       |
| `isOnboarded` | `boolean`          | `true`                  | Yes       |

Default settings:

```typescript
{
  themeName: 'sunset',
  notificationTime: '09:00',
  relationship: {
    startDate: APP_CONFIG.defaultStartDate,   // '2025-10-18'
    partnerName: APP_CONFIG.defaultPartnerName, // 'Gracie'
    anniversaries: [],
  },
  customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
  notifications: { enabled: true, time: '09:00' },
}
```

**Actions:**

| Action              | Signature                                        | Validation                                              |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `initializeApp`     | `() => Promise<void>`                            | Checks hydration, initializes IndexedDB, loads messages |
| `setSettings`       | `(settings: Settings) => void`                   | `SettingsSchema.parse()` (Zod v4)                       |
| `updateSettings`    | `(updates: Partial<Settings>) => void`           | Merges then `SettingsSchema.parse()`                    |
| `setOnboarded`      | `(onboarded: boolean) => void`                   | None                                                    |
| `addAnniversary`    | `(anniversary: Omit<Anniversary, 'id'>) => void` | Auto-generates ID                                       |
| `removeAnniversary` | `(id: number) => void`                           | None                                                    |
| `setTheme`          | `(theme: ThemeName) => void`                     | None                                                    |

**StrictMode Protection:** Module-level `isInitializing` and `isInitialized` flags prevent duplicate `initializeApp()` calls from React 18+ StrictMode double-mounting.

**Zod Validation:** `setSettings` and `updateSettings` use `SettingsSchema.parse()` and transform Zod validation errors into user-friendly messages via `createValidationError()`.

**Cross-Slice Dependencies:** Reads `AppSlice` (`setLoading`, `setError`, `__isHydrated`). Writes `MessagesSlice` state (`messages`) and calls `updateCurrentMessage()`.

---

## 3. NavigationSlice (`src/stores/slices/navigationSlice.ts`)

Tab-based navigation without a router library.

**State:**

| Field         | Type       | Default  | Persisted |
| ------------- | ---------- | -------- | --------- |
| `currentView` | `ViewType` | `'home'` | No        |

**ViewType:** `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'`

**Actions:**

| Action              | Signature                                         | Side Effects                             |
| ------------------- | ------------------------------------------------- | ---------------------------------------- |
| `setView`           | `(view: ViewType, skipHistory?: boolean) => void` | Updates `window.history` via `pushState` |
| `navigateHome`      | `() => void`                                      | Calls `setView('home')`                  |
| `navigatePhotos`    | `() => void`                                      | Calls `setView('photos')`                |
| `navigateMood`      | `() => void`                                      | Calls `setView('mood')`                  |
| `navigatePartner`   | `() => void`                                      | Calls `setView('partner')`               |
| `navigateNotes`     | `() => void`                                      | Calls `setView('notes')`                 |
| `navigateScripture` | `() => void`                                      | Calls `setView('scripture')`             |

**URL Integration:** `setView` respects `BASE_URL` for GitHub Pages deployment (`/My-Love/` in production). The `skipHistory` parameter prevents loops during popstate handling.

---

## 4. MessagesSlice (`src/stores/slices/messagesSlice.ts`)

Daily love messages with deterministic rotation, history navigation, favorites, and custom message CRUD.

**State:**

| Field                  | Type              | Default                  | Persisted          |
| ---------------------- | ----------------- | ------------------------ | ------------------ |
| `messages`             | `Message[]`       | `[]`                     | No (IndexedDB)     |
| `messageHistory`       | `MessageHistory`  | `{currentIndex: 0, ...}` | Yes (localStorage) |
| `currentMessage`       | `Message \| null` | `null`                   | No                 |
| `currentDayOffset`     | `number`          | `0`                      | No (deprecated)    |
| `customMessages`       | `CustomMessage[]` | `[]`                     | No (IndexedDB)     |
| `customMessagesLoaded` | `boolean`         | `false`                  | No                 |

**MessageHistory shape:**

```typescript
{
  currentIndex: 0,           // 0 = today, 1 = yesterday, etc.
  shownMessages: Map<string, number>,  // Date -> Message ID
  maxHistoryDays: 30,
  favoriteIds: number[],
  lastShownDate: '',         // Deprecated
  lastMessageId: 0,          // Deprecated
  viewedIds: [],             // Deprecated
}
```

**Actions:**

| Action                      | Signature                                      | Description                             |
| --------------------------- | ---------------------------------------------- | --------------------------------------- |
| `loadMessages`              | `() => Promise<void>`                          | Load from IndexedDB                     |
| `addMessage`                | `(text, category) => Promise<void>`            | Add to IndexedDB + state                |
| `toggleFavorite`            | `(messageId: number) => Promise<void>`         | Toggle in IndexedDB + update state      |
| `updateCurrentMessage`      | `() => void`                                   | Calculate today's message from rotation |
| `navigateToPreviousMessage` | `() => void`                                   | Navigate to older message (index + 1)   |
| `navigateToNextMessage`     | `() => void`                                   | Navigate to newer message (index - 1)   |
| `canNavigateBack`           | `() => boolean`                                | Check if can go further back            |
| `canNavigateForward`        | `() => boolean`                                | Check if can go forward (index > 0)     |
| `loadCustomMessages`        | `() => Promise<void>`                          | Load custom messages from IndexedDB     |
| `createCustomMessage`       | `(input: CreateMessageInput) => Promise<void>` | Create in IndexedDB + reload messages   |
| `updateCustomMessage`       | `(input: UpdateMessageInput) => Promise<void>` | Update in IndexedDB + reload messages   |
| `deleteCustomMessage`       | `(id: number) => Promise<void>`                | Delete from IndexedDB + reload messages |
| `getCustomMessages`         | `(filter?: MessageFilter) => CustomMessage[]`  | Filter by category/active/search/tags   |
| `exportCustomMessages`      | `() => Promise<void>`                          | Export to JSON file download            |
| `importCustomMessages`      | `(file: File) => Promise<{imported, skipped}>` | Import from JSON file                   |

**Rotation Pool Filtering (Story 3.5):** Active messages pool excludes inactive custom messages: `messages.filter(m => !m.isCustom || m.active !== false)`.

**Cross-Slice Dependencies:** Uses `Settings` (via `get().settings`) for message rotation start date and available history days.

---

## 5. MoodSlice (`src/stores/slices/moodSlice.ts`)

Mood tracking with offline-first storage, background sync, and partner mood fetching.

**State:**

| Field          | Type          | Default                                               | Persisted                      |
| -------------- | ------------- | ----------------------------------------------------- | ------------------------------ |
| `moods`        | `MoodEntry[]` | `[]`                                                  | Yes (localStorage + IndexedDB) |
| `partnerMoods` | `MoodEntry[]` | `[]`                                                  | No                             |
| `syncStatus`   | `object`      | `{pendingMoods: 0, isOnline: true, isSyncing: false}` | No                             |

**SyncStatus shape:**

```typescript
{
  pendingMoods: number;
  isOnline: boolean;
  lastSyncAt?: Date;
  isSyncing: boolean;
}
```

**Actions:**

| Action                  | Signature                                                      | Description                                                |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `addMoodEntry`          | `(moods: MoodEntry['mood'][], note?: string) => Promise<void>` | Create mood via MoodService, optimistic UI, immediate sync |
| `getMoodForDate`        | `(date: string) => MoodEntry \| undefined`                     | Find mood by date (synchronous)                            |
| `updateMoodEntry`       | `(date, moods, note?) => Promise<void>`                        | Update via MoodService, sync                               |
| `loadMoods`             | `() => Promise<void>`                                          | Load all from IndexedDB                                    |
| `updateSyncStatus`      | `() => Promise<void>`                                          | Refresh pending count + online flag                        |
| `syncPendingMoods`      | `() => Promise<{synced, failed}>`                              | Sync all pending to Supabase                               |
| `fetchPartnerMoods`     | `(limit?: number) => Promise<void>`                            | Fetch partner moods from Supabase                          |
| `getPartnerMoodForDate` | `(date: string) => MoodEntry \| undefined`                     | Find partner mood by date                                  |

**Auth Pattern:** `addMoodEntry` uses `getCurrentUserIdOfflineSafe()` for offline-safe auth. Throws if user not authenticated.

**Sync Flow:** `addMoodEntry` and `updateMoodEntry` both attempt immediate sync if online. If sync fails, it logs a warning but does not fail the local save. Background sync retries via periodic interval in App.tsx.

---

## 6. InteractionsSlice (`src/stores/slices/interactionsSlice.ts`)

Poke/kiss interaction management with real-time subscription.

**State:**

| Field           | Type            | Default | Persisted |
| --------------- | --------------- | ------- | --------- |
| `interactions`  | `Interaction[]` | `[]`    | No        |
| `unviewedCount` | `number`        | `0`     | No        |
| `isSubscribed`  | `boolean`       | `false` | No        |

**Actions:**

| Action                    | Signature                                                   | Description                            |
| ------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| `sendPoke`                | `(partnerId: string) => Promise<SupabaseInteractionRecord>` | Validate + send via InteractionService |
| `sendKiss`                | `(partnerId: string) => Promise<SupabaseInteractionRecord>` | Validate + send via InteractionService |
| `markInteractionViewed`   | `(id: string) => Promise<void>`                             | Mark viewed in Supabase + state        |
| `getUnviewedInteractions` | `() => Interaction[]`                                       | Filter unviewed (synchronous)          |
| `getInteractionHistory`   | `(days?: number) => Interaction[]`                          | Filter by date range, sorted           |
| `loadInteractionHistory`  | `(limit?: number) => Promise<void>`                         | Fetch from Supabase                    |
| `subscribeToInteractions` | `() => Promise<() => void>`                                 | Subscribe to Realtime, returns unsub   |
| `addIncomingInteraction`  | `(record: SupabaseInteractionRecord) => void`               | Add with deduplication                 |

**Validation:** `sendPoke` and `sendKiss` use `validateInteraction()` before sending.

---

## 7. PartnerSlice (`src/stores/slices/partnerSlice.ts`)

Partner connection management with search, request, and accept/decline.

**State:**

| Field               | Type                  | Default | Persisted |
| ------------------- | --------------------- | ------- | --------- |
| `partner`           | `PartnerInfo \| null` | `null`  | No        |
| `isLoadingPartner`  | `boolean`             | `false` | No        |
| `sentRequests`      | `PartnerRequest[]`    | `[]`    | No        |
| `receivedRequests`  | `PartnerRequest[]`    | `[]`    | No        |
| `isLoadingRequests` | `boolean`             | `false` | No        |
| `searchResults`     | `UserSearchResult[]`  | `[]`    | No        |
| `isSearching`       | `boolean`             | `false` | No        |

**Actions:**

| Action                  | Signature                              | Description                          |
| ----------------------- | -------------------------------------- | ------------------------------------ |
| `loadPartner`           | `() => Promise<void>`                  | Fetch partner from Supabase          |
| `loadPendingRequests`   | `() => Promise<void>`                  | Fetch sent + received requests       |
| `searchUsers`           | `(query: string) => Promise<void>`     | Search by display name (min 2 chars) |
| `clearSearch`           | `() => void`                           | Clear search results                 |
| `sendPartnerRequest`    | `(toUserId: string) => Promise<void>`  | Send request + reload + clear search |
| `acceptPartnerRequest`  | `(requestId: string) => Promise<void>` | Accept + reload partner + requests   |
| `declinePartnerRequest` | `(requestId: string) => Promise<void>` | Decline + reload requests            |
| `hasPartner`            | `() => boolean`                        | Check if partner exists              |

---

## 8. NotesSlice (`src/stores/slices/notesSlice.ts`)

Love notes chat with optimistic updates, rate limiting, image support, and pagination.

**State:**

| Field                   | Type             | Default | Persisted |
| ----------------------- | ---------------- | ------- | --------- |
| `notes`                 | `LoveNote[]`     | `[]`    | No        |
| `notesIsLoading`        | `boolean`        | `false` | No        |
| `notesError`            | `string \| null` | `null`  | No        |
| `notesHasMore`          | `boolean`        | `true`  | No        |
| `sentMessageTimestamps` | `number[]`       | `[]`    | No        |

**Actions:**

| Action                | Signature                                              | Description                              |
| --------------------- | ------------------------------------------------------ | ---------------------------------------- |
| `fetchNotes`          | `(limit?: number) => Promise<void>`                    | Fetch conversation notes from Supabase   |
| `fetchOlderNotes`     | `(limit?: number) => Promise<void>`                    | Paginated fetch of older notes           |
| `addNote`             | `(note: LoveNote) => void`                             | Add with deduplication check             |
| `setNotes`            | `(notes: LoveNote[]) => void`                          | Bulk replace (cleans up preview URLs)    |
| `setNotesError`       | `(error: string \| null) => void`                      | Set error state                          |
| `clearNotesError`     | `() => void`                                           | Clear error state                        |
| `checkRateLimit`      | `() => {recentTimestamps, now}`                        | Check/enforce rate limit (10/min)        |
| `sendNote`            | `(content: string, imageFile?: File) => Promise<void>` | Optimistic send with image support       |
| `retryFailedMessage`  | `(tempId: string) => Promise<void>`                    | Retry with cached imageBlob              |
| `cleanupPreviewUrls`  | `() => void`                                           | Revoke blob URLs to prevent memory leaks |
| `removeFailedMessage` | `(tempId: string) => void`                             | Remove failed message + cleanup          |

**Optimistic Update Pattern:** `sendNote` creates a temporary note with `tempId`, adds it immediately, then replaces with server response on success or marks as `error: true` on failure.

**Image Flow:** Compress -> create preview URL -> upload to storage -> insert to `love_notes` table -> broadcast to partner channel -> cleanup preview URL.

**Rate Limiting:** Max 10 messages per 60 seconds. Enforced by `checkRateLimit()` which filters `sentMessageTimestamps` by window.

**Memory Management:** `cleanupPreviewUrls` revokes all blob: URLs from notes. Called on component unmount via `useLoveNotes` hook.

---

## 9. PhotosSlice (`src/stores/slices/photosSlice.ts`)

Photo gallery with upload progress tracking and storage quota management.

**State:**

| Field             | Type              | Default | Persisted |
| ----------------- | ----------------- | ------- | --------- |
| `photos`          | `PhotoWithUrls[]` | `[]`    | No        |
| `selectedPhotoId` | `string \| null`  | `null`  | No        |
| `isUploading`     | `boolean`         | `false` | No        |
| `uploadProgress`  | `number`          | `0`     | No        |
| `error`           | `string \| null`  | `null`  | No        |
| `storageWarning`  | `string \| null`  | `null`  | No        |

**Actions:**

| Action                | Signature                                    | Description                           |
| --------------------- | -------------------------------------------- | ------------------------------------- |
| `uploadPhoto`         | `(input: PhotoUploadInput) => Promise<void>` | Upload with progress callback + quota |
| `loadPhotos`          | `() => Promise<void>`                        | Load all photos from Supabase         |
| `deletePhoto`         | `(photoId: string) => Promise<void>`         | Delete from Supabase + state          |
| `updatePhoto`         | `(photoId, updates) => Promise<void>`        | Update metadata (caption, tags)       |
| `selectPhoto`         | `(photoId: string \| null) => void`          | Select for carousel viewing           |
| `clearPhotoSelection` | `() => void`                                 | Close carousel                        |
| `clearError`          | `() => void`                                 | Clear error state                     |
| `clearStorageWarning` | `() => void`                                 | Clear storage warning                 |

**Storage Quota:** `uploadPhoto` checks quota before upload -- rejects at >= 95%, warns at >= 80%.

---

## 10. ScriptureReadingSlice (`src/stores/slices/scriptureReadingSlice.ts`)

Scripture reading sessions with solo/together modes, lobby, lock-in, disconnection handling, and reflection.

This is the largest slice with 25+ state fields and 25+ actions covering Stories 1.1-1.5, 2.1-2.3, 3.1, 4.1-4.3.

### State

**Core Session State:**

| Field                 | Type                       | Default | Description                                 |
| --------------------- | -------------------------- | ------- | ------------------------------------------- |
| `session`             | `ScriptureSession \| null` | `null`  | Active session from DB                      |
| `scriptureLoading`    | `boolean`                  | `false` | Loading state for async operations          |
| `isInitialized`       | `boolean`                  | `false` | Whether session has been loaded             |
| `isPendingLockIn`     | `boolean`                  | `false` | Story 4.2: User locked in, awaiting partner |
| `isPendingReflection` | `boolean`                  | `false` | Reflection submission pending               |
| `isSyncing`           | `boolean`                  | `false` | Background sync in progress                 |
| `scriptureError`      | `ScriptureError \| null`   | `null`  | Typed error with code + message             |
| `activeSession`       | `ScriptureSession \| null` | `null`  | Incomplete solo session for resume prompt   |
| `isCheckingSession`   | `boolean`                  | `false` | Checking for active sessions                |
| `pendingRetry`        | `PendingRetry \| null`     | `null`  | Story 1.4: Failed write retry state         |

**Stats State (Story 3.1):**

| Field            | Type                  | Default | Description            |
| ---------------- | --------------------- | ------- | ---------------------- |
| `coupleStats`    | `CoupleStats \| null` | `null`  | Aggregate couple stats |
| `isStatsLoading` | `boolean`             | `false` | Stats loading state    |

**Lobby State (Story 4.1):**

| Field                | Type                  | Default | Description                               |
| -------------------- | --------------------- | ------- | ----------------------------------------- |
| `myRole`             | `SessionRole \| null` | `null`  | 'reader' or 'responder'                   |
| `partnerJoined`      | `boolean`             | `false` | Partner joined broadcast channel          |
| `myReady`            | `boolean`             | `false` | User ready state                          |
| `partnerReady`       | `boolean`             | `false` | Partner ready state                       |
| `countdownStartedAt` | `number \| null`      | `null`  | Server UTC ms for countdown start         |
| `currentUserId`      | `string \| null`      | `null`  | Auth user ID (user1 vs user2 distinction) |

**Lock-in State (Story 4.2):**

| Field           | Type      | Default | Description           |
| --------------- | --------- | ------- | --------------------- |
| `partnerLocked` | `boolean` | `false` | Partner has locked in |

**Disconnection State (Story 4.3):**

| Field                   | Type             | Default | Description                       |
| ----------------------- | ---------------- | ------- | --------------------------------- |
| `partnerDisconnected`   | `boolean`        | `false` | Partner presence lost             |
| `partnerDisconnectedAt` | `number \| null` | `null`  | Timestamp for elapsed calculation |

**Internal State:**

| Field          | Type                                 | Default | Description                       |
| -------------- | ------------------------------------ | ------- | --------------------------------- |
| `_broadcastFn` | `((event, payload) => void) \| null` | `null`  | Set by useScriptureBroadcast hook |

### Actions

**Session Lifecycle:**

| Action                  | Signature                              | Auth Guard | Description                               |
| ----------------------- | -------------------------------------- | ---------- | ----------------------------------------- |
| `createSession`         | `(mode, partnerId?) => Promise<void>`  | No         | Create via scriptureReadingService        |
| `loadSession`           | `(sessionId: string) => Promise<void>` | **Yes**    | Auth check first, then load               |
| `exitSession`           | `() => void`                           | No         | Reset to initial state                    |
| `updatePhase`           | `(phase: SessionPhase) => void`        | No         | Local phase update                        |
| `clearScriptureError`   | `() => void`                           | No         | Clear error state                         |
| `checkForActiveSession` | `() => Promise<void>`                  | **Yes**    | Auth check, find incomplete solo sessions |
| `clearActiveSession`    | `() => void`                           | No         | Clear active session state                |

**Solo Reading Flow (Story 1.3):**

| Action        | Signature             | Description                                 |
| ------------- | --------------------- | ------------------------------------------- |
| `advanceStep` | `() => Promise<void>` | Next step or transition to reflection phase |
| `saveAndExit` | `() => Promise<void>` | Save progress + reset to initial state      |

**Save, Resume & Retry (Story 1.4):**

| Action             | Signature                              | Description                            |
| ------------------ | -------------------------------------- | -------------------------------------- |
| `saveSession`      | `() => Promise<void>`                  | Silent save without clearing state     |
| `abandonSession`   | `(sessionId: string) => Promise<void>` | Mark as abandoned + reset              |
| `retryFailedWrite` | `() => Promise<void>`                  | Retry with exponential backoff (max 3) |

**Stats (Story 3.1):**

| Action            | Signature             | Description                    |
| ----------------- | --------------------- | ------------------------------ |
| `loadCoupleStats` | `() => Promise<void>` | Fetch aggregate stats from RPC |

**Lobby Actions (Story 4.1):**

| Action                  | Signature                               | Auth Guard | Description                             |
| ----------------------- | --------------------------------------- | ---------- | --------------------------------------- |
| `selectRole`            | `(role: SessionRole) => Promise<void>`  | **Yes**    | RPC + optimistic update + broadcast     |
| `toggleReady`           | `(isReady: boolean) => Promise<void>`   | No         | RPC + optimistic + rollback on error    |
| `convertToSolo`         | `() => Promise<void>`                   | No         | RPC + broadcast session_converted       |
| `applySessionConverted` | `() => void`                            | No         | Local: reset to initial (for user2)     |
| `onPartnerJoined`       | `() => void`                            | No         | Set partnerJoined + clear disconnection |
| `onPartnerReady`        | `(isReady: boolean) => void`            | No         | Update partner ready state              |
| `onCountdownStarted`    | `(startTs: number) => void`             | No         | Set countdown + phase to 'countdown'    |
| `onBroadcastReceived`   | `(payload: StateUpdatePayload) => void` | No         | Version-checked snapshot update         |

**Lock-in Actions (Story 4.2):**

| Action                   | Signature                   | Description                                                        |
| ------------------------ | --------------------------- | ------------------------------------------------------------------ |
| `lockIn`                 | `() => Promise<void>`       | RPC with version check, broadcast. 409 mismatch -> refetch session |
| `undoLockIn`             | `() => Promise<void>`       | Undo RPC, broadcast lock_in_status_changed                         |
| `onPartnerLockInChanged` | `(locked: boolean) => void` | Update partner lock state                                          |

**Disconnection Actions (Story 4.3):**

| Action                   | Signature                         | Description                            |
| ------------------------ | --------------------------------- | -------------------------------------- |
| `setPartnerDisconnected` | `(disconnected: boolean) => void` | Set/clear disconnection with timestamp |
| `endSession`             | `() => Promise<void>`             | RPC + broadcast + reset                |

**Internal:**

| Action           | Signature                                          | Description                   |
| ---------------- | -------------------------------------------------- | ----------------------------- |
| `setBroadcastFn` | `(fn: ((event, payload) => void) \| null) => void` | Wiring between hook and store |

### Auth Guards (Epic 4 Hardening)

The following actions perform explicit auth checks (`supabase.auth.getUser()`) before proceeding:

1. **`loadSession`** -- Verifies user identity before fetching session. Returns `UNAUTHORIZED` error if auth fails. Also sets `currentUserId` from auth data.
2. **`selectRole`** -- Auth check before optimistic role update to prevent flash-then-revert. Sets `currentUserId` from auth data.
3. **`checkForActiveSession`** -- Gets user ID before querying sessions. Silently returns if no user.

### Version-Checked State Updates

`onBroadcastReceived` implements version checking:

- Ignores payloads where `payload.version <= session.version`
- Distinguishes user1 vs user2 using `currentUserId === session.userId`
- Correctly maps ready/role states for the current user vs partner
- Handles special `end_session` and `complete` phase transitions (reset to initial state)
- Clears lock-in flags when step advances

### Lock-in Flow Detail (Story 4.2)

`lockIn` calls `scripture_lock_in` RPC with `p_expected_version` for optimistic concurrency:

- **Both locked** (`both_locked: true`): Step advances. Local state updated with new phase/step/version. Broadcasts `state_updated` to partner.
- **Partial lock** (`both_locked: false`): Broadcasts `lock_in_status_changed` with `{ step_index, user1_locked, user2_locked }`.
- **409 version mismatch**: Rolls back `isPendingLockIn`, refetches session via `scriptureReadingService.getSession()`, shows subtle error toast.

### Disconnection Handling (Story 4.3)

- `setPartnerDisconnected(true)` records `partnerDisconnectedAt = Date.now()` for elapsed time calculation in UI.
- `setPartnerDisconnected(false)` clears both `partnerDisconnected` and `partnerDisconnectedAt`.
- `onPartnerJoined()` also clears disconnection state (partner reconnected).
- `endSession()` calls `scripture_end_session` RPC, broadcasts `state_updated` with end payload, then resets to initial state. Guarded by `isSyncing` to prevent double-tap.

### RPC Helpers

`callLobbyRpc` is a type-safe wrapper for Supabase RPCs that are not yet in `database.types.ts`. Used for: `scripture_select_role`, `scripture_toggle_ready`, `scripture_convert_to_solo`, `scripture_lock_in`, `scripture_undo_lock_in`, `scripture_end_session`.
