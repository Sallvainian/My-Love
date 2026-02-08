# Slice Details

## 1. App Slice

**File:** `src/stores/slices/appSlice.ts`
**Interface defined in:** `src/stores/types.ts` (to avoid circular imports)

Owns core runtime flags that other slices depend on. This is the foundational slice.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isLoading` | `boolean` | `false` | Global loading indicator during app initialization |
| `error` | `string \| null` | `null` | Global error message |
| `__isHydrated` | `boolean` | `false` | Internal flag set by `onRehydrateStorage` callback |

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `setLoading` | `(loading: boolean) => void` | Set global loading state |
| `setError` | `(error: string \| null) => void` | Set or clear global error |
| `setHydrated` | `(hydrated: boolean) => void` | Mark hydration complete |

### Persistence

Not persisted. All fields are runtime-only.

### Cross-Slice Dependencies

None. Other slices depend on this slice (particularly `__isHydrated` during initialization).

---

## 2. Settings Slice

**File:** `src/stores/slices/settingsSlice.ts`

Manages user preferences, theme, relationship configuration, anniversaries, and orchestrates app initialization. This slice coordinates startup by loading IndexedDB data and populating messages.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `settings` | `Settings \| null` | Pre-configured defaults | User preferences object |
| `isOnboarded` | `boolean` | `true` | Whether user has completed onboarding |

**Settings object structure:**

```typescript
interface Settings {
  themeName: ThemeName;              // 'sunset' | 'ocean' | 'lavender' | 'rose'
  notificationTime: string;          // 'HH:MM' format
  relationship: {
    startDate: string;               // ISO date string
    partnerName: string;
    anniversaries: Anniversary[];
  };
  customization: {
    accentColor: string;             // Hex color
    fontFamily: string;              // CSS font-family
  };
  notifications: {
    enabled: boolean;
    time: string;                    // 'HH:MM' format
  };
}
```

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `initializeApp` | `() => Promise<void>` | Full app startup: verify hydration, init IndexedDB, load/seed messages, set current message |
| `setSettings` | `(settings: Settings) => void` | Replace settings (validates with Zod `SettingsSchema`) |
| `updateSettings` | `(updates: Partial<Settings>) => void` | Merge partial settings (validates merged result) |
| `setOnboarded` | `(onboarded: boolean) => void` | Mark onboarding complete |
| `addAnniversary` | `(anniversary: Omit<Anniversary, 'id'>) => void` | Add anniversary with auto-incremented ID |
| `removeAnniversary` | `(id: number) => void` | Remove anniversary by ID |
| `setTheme` | `(theme: ThemeName) => void` | Change active theme |

### Persistence

**Persisted to localStorage:**
- `settings` -- Full settings object
- `isOnboarded` -- Onboarding completion flag

### Cross-Slice Dependencies

- Reads `__isHydrated` from AppSlice during initialization
- Calls `setLoading` / `setError` from AppSlice
- Calls `updateCurrentMessage` from MessagesSlice after loading messages
- Sets `messages` state (owned by MessagesSlice)

### Initialization Guards

Module-level `isInitializing` and `isInitialized` flags prevent concurrent or duplicate initialization calls (protects against React StrictMode double-mounting).

---

## 3. Messages Slice

**File:** `src/stores/slices/messagesSlice.ts`

Manages daily love message rotation, history navigation, custom message CRUD, and import/export. This is one of the most complex slices with both localStorage-persisted state and IndexedDB-backed data.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `messages` | `Message[]` | `[]` | All messages (default + custom), loaded from IndexedDB |
| `messageHistory` | `MessageHistory` | See below | Navigation state and date-to-message mapping |
| `currentMessage` | `Message \| null` | `null` | Currently displayed message |
| `currentDayOffset` | `number` | `0` | Deprecated -- use `messageHistory.currentIndex` |
| `customMessages` | `CustomMessage[]` | `[]` | Admin-managed custom messages |
| `customMessagesLoaded` | `boolean` | `false` | Whether custom messages have been loaded from IndexedDB |

**MessageHistory structure:**

```typescript
interface MessageHistory {
  currentIndex: number;                    // 0 = today, 1 = yesterday, etc.
  shownMessages: Map<string, number>;      // 'YYYY-MM-DD' -> Message ID
  maxHistoryDays: number;                  // Default: 30
  favoriteIds: number[];                   // Legacy favorite tracking
  lastShownDate?: string;                  // Deprecated
  lastMessageId?: number;                  // Deprecated
  viewedIds?: number[];                    // Deprecated
}
```

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadMessages` | `() => Promise<void>` | Load all messages from IndexedDB |
| `addMessage` | `(text, category) => Promise<void>` | Add a new custom message to IndexedDB and state |
| `toggleFavorite` | `(messageId: number) => Promise<void>` | Toggle favorite status in IndexedDB and state |
| `updateCurrentMessage` | `() => void` | Calculate today's message via rotation algorithm |
| `navigateToPreviousMessage` | `() => void` | Navigate backward in history (today -> yesterday) |
| `navigateToNextMessage` | `() => void` | Navigate forward in history (yesterday -> today) |
| `canNavigateBack` | `() => boolean` | Check if backward navigation is possible |
| `canNavigateForward` | `() => boolean` | Check if forward navigation is possible |
| `loadCustomMessages` | `() => Promise<void>` | Load custom messages from IndexedDB |
| `createCustomMessage` | `(input: CreateMessageInput) => Promise<void>` | Create custom message in IndexedDB + state |
| `updateCustomMessage` | `(input: UpdateMessageInput) => Promise<void>` | Update custom message in IndexedDB + state |
| `deleteCustomMessage` | `(id: number) => Promise<void>` | Delete custom message from IndexedDB + state |
| `getCustomMessages` | `(filter?: MessageFilter) => CustomMessage[]` | Filter custom messages by category, active, search, tags |
| `exportCustomMessages` | `() => Promise<void>` | Export custom messages to JSON file download |
| `importCustomMessages` | `(file: File) => Promise<{ imported, skipped }>` | Import custom messages from JSON file |

### Persistence

**Persisted to localStorage (via `partialize`):**
- `messageHistory` -- Serialized with `Map` converted to array of entries for JSON compatibility

**Stored in IndexedDB:**
- `messages` -- All messages (default + custom) via `storageService`
- Custom messages via `customMessageService`

**Not persisted:**
- `currentMessage` -- Computed from messages + messageHistory
- `customMessagesLoaded` -- Runtime flag

### Map Serialization

The `shownMessages` Map requires special handling:
- **On persist:** `Map.entries()` converted to `Array<[string, number]>` in `partialize`
- **On rehydrate:** Array validated and converted back to `Map` in `onRehydrateStorage`
- **Fallback:** Invalid data resets to empty `Map`

---

## 4. Navigation Slice

**File:** `src/stores/slices/navigationSlice.ts`

Manages view switching and browser history integration.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `currentView` | `ViewType` | `'home'` | Active view |

**ViewType:** `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'`

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `setView` | `(view: ViewType, skipHistory?: boolean) => void` | Change view and push browser history state |
| `navigateHome` | `() => void` | Navigate to home view |
| `navigatePhotos` | `() => void` | Navigate to photos view |
| `navigateMood` | `() => void` | Navigate to mood view |
| `navigatePartner` | `() => void` | Navigate to partner view |
| `navigateNotes` | `() => void` | Navigate to notes view |
| `navigateScripture` | `() => void` | Navigate to scripture view |

### Persistence

Not persisted. Current view is restored from the URL on mount. The `skipHistory` parameter prevents infinite loops during `popstate` event handling.

### Browser History Integration

`setView` pushes state to `window.history` with base URL awareness for GitHub Pages deployment (respects `import.meta.env.BASE_URL`).

---

## 5. Mood Slice

**File:** `src/stores/slices/moodSlice.ts`

Manages mood tracking with offline-first persistence and background sync to Supabase.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `moods` | `MoodEntry[]` | `[]` | All mood entries, loaded from IndexedDB |
| `partnerMoods` | `MoodEntry[]` | `[]` | Partner's mood entries, fetched from Supabase |
| `syncStatus` | `SyncStatus` | See below | Sync state for offline/online indicator |

**SyncStatus structure:**

```typescript
{
  pendingMoods: number;      // Count of unsynced moods
  isOnline: boolean;          // navigator.onLine
  lastSyncAt?: Date;          // Timestamp of last successful sync
  isSyncing: boolean;         // Whether sync is in progress
}
```

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `addMoodEntry` | `(moods: MoodType[], note?: string) => Promise<void>` | Add or update today's mood (auto-syncs if online) |
| `getMoodForDate` | `(date: string) => MoodEntry \| undefined` | Lookup mood by ISO date |
| `updateMoodEntry` | `(date, moods, note?) => Promise<void>` | Update existing mood entry |
| `loadMoods` | `() => Promise<void>` | Load all moods from IndexedDB |
| `updateSyncStatus` | `() => Promise<void>` | Refresh pending/online counts |
| `syncPendingMoods` | `() => Promise<{ synced, failed }>` | Push unsynced moods to Supabase |
| `fetchPartnerMoods` | `(limit?: number) => Promise<void>` | Fetch partner moods from Supabase |
| `getPartnerMoodForDate` | `(date: string) => MoodEntry \| undefined` | Lookup partner mood by ISO date |

### Persistence

**Stored in IndexedDB:** All mood entries via `moodService`

**Persisted to localStorage (via `partialize`):** `moods` array (for quick offline access)

**Synced to Supabase:** Via `moodSyncService` with retry logic

---

## 6. Interactions Slice

**File:** `src/stores/slices/interactionsSlice.ts`

Manages ephemeral poke/kiss interactions between partners, with Supabase Realtime subscriptions.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `interactions` | `Interaction[]` | `[]` | All interaction records |
| `unviewedCount` | `number` | `0` | Count of unviewed received interactions |
| `isSubscribed` | `boolean` | `false` | Whether Realtime subscription is active |

**Interaction structure:**

```typescript
interface Interaction {
  id: string;
  type: 'poke' | 'kiss';
  fromUserId: string;
  toUserId: string;
  viewed: boolean;
  createdAt: Date;
}
```

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `sendPoke` | `(partnerId: string) => Promise<SupabaseInteractionRecord>` | Send poke with validation |
| `sendKiss` | `(partnerId: string) => Promise<SupabaseInteractionRecord>` | Send kiss with validation |
| `markInteractionViewed` | `(id: string) => Promise<void>` | Mark interaction as viewed on server |
| `getUnviewedInteractions` | `() => Interaction[]` | Get all unviewed interactions |
| `getInteractionHistory` | `(days?: number) => Interaction[]` | Get interactions within N days |
| `loadInteractionHistory` | `(limit?: number) => Promise<void>` | Fetch history from Supabase |
| `subscribeToInteractions` | `() => Promise<() => void>` | Start Supabase Realtime subscription, returns unsubscribe |
| `addIncomingInteraction` | `(record: SupabaseInteractionRecord) => void` | Handle incoming Realtime interaction with deduplication |

### Persistence

Not persisted locally. All data is ephemeral and fetched from Supabase on app init and via Realtime updates.

---

## 7. Photos Slice

**File:** `src/stores/slices/photosSlice.ts`

Manages photo gallery state with upload progress tracking and storage quota awareness.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `photos` | `PhotoWithUrls[]` | `[]` | Photos with signed URLs |
| `selectedPhotoId` | `string \| null` | `null` | Currently selected photo for carousel |
| `isUploading` | `boolean` | `false` | Upload in progress |
| `uploadProgress` | `number` | `0` | Upload progress 0-100% |
| `error` | `string \| null` | `null` | Photo-specific error message |
| `storageWarning` | `string \| null` | `null` | Storage quota warning (80%/95% thresholds) |

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `uploadPhoto` | `(input: PhotoUploadInput) => Promise<void>` | Upload with quota check, progress callback, and optimistic UI |
| `loadPhotos` | `() => Promise<void>` | Fetch all photos (own + partner) from Supabase |
| `deletePhoto` | `(photoId: string) => Promise<void>` | Delete photo (RLS-enforced owner check) |
| `updatePhoto` | `(photoId, updates) => Promise<void>` | Update metadata (caption, tags) |
| `selectPhoto` | `(photoId: string \| null) => void` | Select photo for carousel view |
| `clearPhotoSelection` | `() => void` | Close carousel |
| `clearError` | `() => void` | Clear error state |
| `clearStorageWarning` | `() => void` | Dismiss storage warning |

### Persistence

Not persisted locally. Photos are stored in Supabase Storage with metadata in the `photos` table. Loaded on demand.

---

## 8. Notes Slice

**File:** `src/stores/slices/notesSlice.ts`

Manages the Love Notes chat feature with optimistic updates, rate limiting, pagination, image attachments, and Supabase Realtime broadcast.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `notes` | `LoveNote[]` | `[]` | Chat messages in chronological order |
| `notesIsLoading` | `boolean` | `false` | Whether notes are being fetched |
| `notesError` | `string \| null` | `null` | Error message |
| `notesHasMore` | `boolean` | `true` | Whether more notes exist for pagination |
| `sentMessageTimestamps` | `number[]` | `[]` | Timestamps for rate limiting (max 10/minute) |

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `fetchNotes` | `(limit?: number) => Promise<void>` | Fetch notes for user-partner conversation |
| `fetchOlderNotes` | `(limit?: number) => Promise<void>` | Paginate backward (prepend older notes) |
| `addNote` | `(note: LoveNote) => void` | Add single note with deduplication |
| `setNotes` | `(notes: LoveNote[]) => void` | Replace entire notes array (cleans up blob URLs) |
| `setNotesError` | `(error: string \| null) => void` | Set error state |
| `clearNotesError` | `() => void` | Clear error state |
| `checkRateLimit` | `() => { recentTimestamps, now }` | Validate rate limit (throws if exceeded) |
| `sendNote` | `(content, imageFile?) => Promise<void>` | Send with optimistic update, image compression, Supabase insert, and broadcast |
| `retryFailedMessage` | `(tempId: string) => Promise<void>` | Retry failed send using cached compressed blob |
| `cleanupPreviewUrls` | `() => void` | Revoke blob URLs to prevent memory leaks |
| `removeFailedMessage` | `(tempId: string) => void` | Remove a failed message from state |

### Persistence

Not persisted locally. Notes are stored in and fetched from Supabase's `love_notes` table. Image blobs are uploaded to Supabase Storage.

### Memory Management

Blob preview URLs (`URL.createObjectURL`) are tracked and revoked during note replacement, fetch, and component unmount to prevent memory leaks.

---

## 9. Partner Slice

**File:** `src/stores/slices/partnerSlice.ts`

Manages partner connection state, user search, and partner request workflows.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `partner` | `PartnerInfo \| null` | `null` | Connected partner information |
| `isLoadingPartner` | `boolean` | `false` | Whether partner data is loading |
| `sentRequests` | `PartnerRequest[]` | `[]` | Outgoing partner requests |
| `receivedRequests` | `PartnerRequest[]` | `[]` | Incoming partner requests |
| `isLoadingRequests` | `boolean` | `false` | Whether requests are loading |
| `searchResults` | `UserSearchResult[]` | `[]` | User search results |
| `isSearching` | `boolean` | `false` | Whether search is in progress |

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadPartner` | `() => Promise<void>` | Fetch partner info from Supabase |
| `loadPendingRequests` | `() => Promise<void>` | Fetch sent and received requests |
| `searchUsers` | `(query: string) => Promise<void>` | Search users by query (min 2 chars) |
| `clearSearch` | `() => void` | Clear search results |
| `sendPartnerRequest` | `(toUserId: string) => Promise<void>` | Send partner connection request |
| `acceptPartnerRequest` | `(requestId: string) => Promise<void>` | Accept request, reload partner |
| `declinePartnerRequest` | `(requestId: string) => Promise<void>` | Decline request, reload requests |
| `hasPartner` | `() => boolean` | Check if partner is connected |

### Persistence

Not persisted. Loaded fresh from Supabase on mount.

---

## 10. Scripture Reading Slice

**File:** `src/stores/slices/scriptureReadingSlice.ts`

Manages scripture reading sessions with session lifecycle, step progression, optimistic updates, and retry logic for failed server writes.

### State Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `session` | `ScriptureSession \| null` | `null` | Active scripture reading session |
| `scriptureLoading` | `boolean` | `false` | Loading indicator |
| `isInitialized` | `boolean` | `false` | Whether session has been loaded |
| `isPendingLockIn` | `boolean` | `false` | Awaiting lock-in confirmation |
| `isPendingReflection` | `boolean` | `false` | Awaiting reflection phase |
| `isSyncing` | `boolean` | `false` | Background save in progress |
| `scriptureError` | `ScriptureError \| null` | `null` | Typed error with error code |
| `activeSession` | `ScriptureSession \| null` | `null` | Resumable in-progress session |
| `isCheckingSession` | `boolean` | `false` | Checking for active session |
| `pendingRetry` | `PendingRetry \| null` | `null` | Retry state for failed writes |

**PendingRetry structure:**

```typescript
interface PendingRetry {
  type: 'advanceStep' | 'saveSession';
  attempts: number;
  maxAttempts: number;  // Default: 3
}
```

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `createSession` | `(mode: SessionMode, partnerId?) => Promise<void>` | Create new reading session |
| `loadSession` | `(sessionId: string) => Promise<void>` | Load existing session with refresh callback |
| `exitSession` | `() => void` | Reset all scripture state to initial |
| `updatePhase` | `(phase: SessionPhase) => void` | Update session phase locally |
| `clearScriptureError` | `() => void` | Clear error state |
| `checkForActiveSession` | `() => Promise<void>` | Check for resumable in-progress session |
| `clearActiveSession` | `() => void` | Clear active session prompt |
| `advanceStep` | `() => Promise<void>` | Advance to next step with optimistic UI and server sync |
| `saveAndExit` | `() => Promise<void>` | Persist progress and return to overview |
| `saveSession` | `() => Promise<void>` | Silent save without clearing state (for auto-save) |
| `abandonSession` | `(sessionId: string) => Promise<void>` | Mark session abandoned on server |
| `retryFailedWrite` | `() => Promise<void>` | Retry failed server write (max 3 attempts) |

### Persistence

Not persisted to localStorage. Session data is stored in Supabase and loaded via `scriptureReadingService`.

---
