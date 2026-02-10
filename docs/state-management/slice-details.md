# Slice Details

## 1. App Slice

**File:** `src/stores/slices/appSlice.ts`

Core runtime state. Not persisted. No cross-slice dependencies.

### State

| Field | Type | Default | Purpose |
|---|---|---|---|
| `isLoading` | `boolean` | `false` | Global loading indicator during init |
| `error` | `string \| null` | `null` | Global error message |
| `__isHydrated` | `boolean` | `false` | Persist hydration completion flag |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `setLoading` | `(loading: boolean) => void` | Toggle loading state |
| `setError` | `(error: string \| null) => void` | Set/clear error |
| `setHydrated` | `(hydrated: boolean) => void` | Mark hydration complete |

---

## 2. Settings Slice

**File:** `src/stores/slices/settingsSlice.ts`

Settings, onboarding, theme, initialization. Cross-slice dependency: calls `messagesSlice.updateCurrentMessage()` via `get()`.

### State

| Field | Type | Default | Persisted |
|---|---|---|---|
| `settings` | `Settings \| null` | Pre-configured defaults | Yes |
| `isOnboarded` | `boolean` | `true` | Yes |

### Default Settings

```typescript
settings: {
  themeName: 'sunset',
  notificationTime: '09:00',
  relationship: {
    startDate: APP_CONFIG.defaultStartDate,  // '2025-10-18'
    partnerName: APP_CONFIG.defaultPartnerName, // 'Gracie'
    anniversaries: [],
  },
  customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
  notifications: { enabled: true, time: '09:00' },
}
```

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `initializeApp` | `() => Promise<void>` | Check hydration, init IndexedDB, load messages |
| `setSettings` | `(settings: Settings) => void` | Validate and set full settings (Zod) |
| `updateSettings` | `(updates: Partial<Settings>) => void` | Merge and validate partial settings |
| `setOnboarded` | `(onboarded: boolean) => void` | Set onboarding flag |
| `addAnniversary` | `(anniversary) => void` | Add anniversary with auto-generated ID |
| `removeAnniversary` | `(id: number) => void` | Remove anniversary by ID |
| `setTheme` | `(theme: ThemeName) => void` | Update theme name |

### Initialization Guards

Module-level `isInitializing` and `isInitialized` flags prevent concurrent/duplicate initialization (React StrictMode protection).

---

## 3. Navigation Slice

**File:** `src/stores/slices/navigationSlice.ts`

View routing with browser history integration. Self-contained.

### State

| Field | Type | Default | Persisted |
|---|---|---|---|
| `currentView` | `ViewType` | `'home'` | No |

### ViewType

```typescript
type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';
```

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `setView` | `(view: ViewType, skipHistory?: boolean) => void` | Set view, update browser URL |
| `navigateHome` | `() => void` | Shortcut to home |
| `navigatePhotos` | `() => void` | Shortcut to photos |
| `navigateMood` | `() => void` | Shortcut to mood |
| `navigatePartner` | `() => void` | Shortcut to partner |
| `navigateNotes` | `() => void` | Shortcut to notes |
| `navigateScripture` | `() => void` | Shortcut to scripture |

---

## 4. Messages Slice

**File:** `src/stores/slices/messagesSlice.ts`

Daily love messages, history navigation, custom message CRUD, import/export. Depends on Settings for `startDate`.

### State

| Field | Type | Default | Persisted |
|---|---|---|---|
| `messages` | `Message[]` | `[]` | No (IndexedDB) |
| `messageHistory` | `MessageHistory` | `{ currentIndex: 0, shownMessages: new Map(), ... }` | Yes (Map serialized) |
| `currentMessage` | `Message \| null` | `null` | No (computed) |
| `currentDayOffset` | `number` | `0` | No (deprecated) |
| `customMessages` | `CustomMessage[]` | `[]` | No (IndexedDB) |
| `customMessagesLoaded` | `boolean` | `false` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `loadMessages` | `() => Promise<void>` | Load all messages from IndexedDB |
| `addMessage` | `(text, category) => Promise<void>` | Add message to IndexedDB + state |
| `toggleFavorite` | `(messageId) => Promise<void>` | Toggle favorite in IndexedDB + state |
| `updateCurrentMessage` | `() => void` | Compute today's message via deterministic rotation |
| `navigateToPreviousMessage` | `() => void` | Navigate to yesterday's message |
| `navigateToNextMessage` | `() => void` | Navigate toward today |
| `canNavigateBack` | `() => boolean` | Check if more history available |
| `canNavigateForward` | `() => boolean` | Check if not at today |
| `loadCustomMessages` | `() => Promise<void>` | Load custom messages from IndexedDB |
| `createCustomMessage` | `(input) => Promise<void>` | Create via customMessageService |
| `updateCustomMessage` | `(input) => Promise<void>` | Update via customMessageService |
| `deleteCustomMessage` | `(id) => Promise<void>` | Delete via customMessageService |
| `getCustomMessages` | `(filter?) => CustomMessage[]` | Filter by category/active/search/tags |
| `exportCustomMessages` | `() => Promise<void>` | Export to JSON file download |
| `importCustomMessages` | `(file) => Promise<{imported, skipped}>` | Import from JSON file |

---

## 5. Mood Slice

**File:** `src/stores/slices/moodSlice.ts`

Mood tracking with 3-layer sync. Self-contained.

### State

| Field | Type | Default | Persisted |
|---|---|---|---|
| `moods` | `MoodEntry[]` | `[]` | Yes (localStorage + IndexedDB) |
| `partnerMoods` | `MoodEntry[]` | `[]` | No |
| `syncStatus` | `{ pendingMoods, isOnline, lastSyncAt?, isSyncing }` | `{ pendingMoods: 0, isOnline: true, isSyncing: false }` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `addMoodEntry` | `(moods[], note?) => Promise<void>` | Create mood, optimistic update, immediate sync |
| `getMoodForDate` | `(date) => MoodEntry \| undefined` | Find mood by date |
| `updateMoodEntry` | `(date, moods[], note?) => Promise<void>` | Update existing mood |
| `loadMoods` | `() => Promise<void>` | Load all moods from IndexedDB |
| `updateSyncStatus` | `() => Promise<void>` | Refresh pending count + online status |
| `syncPendingMoods` | `() => Promise<{ synced, failed }>` | Sync all unsynced moods to Supabase |
| `fetchPartnerMoods` | `(limit?) => Promise<void>` | Fetch partner moods from Supabase |
| `getPartnerMoodForDate` | `(date) => MoodEntry \| undefined` | Find partner mood by date |

---

## 6. Interactions Slice

**File:** `src/stores/slices/interactionsSlice.ts`

Poke/kiss interactions with realtime. Self-contained.

### State

| Field | Type | Persisted |
|---|---|---|
| `interactions` | `Interaction[]` | No |
| `unviewedCount` | `number` | No |
| `isSubscribed` | `boolean` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `sendPoke` | `() => Promise<void>` | Send poke with UUID validation |
| `sendKiss` | `() => Promise<void>` | Send kiss with UUID validation |
| `subscribeToInteractions` | `() => Promise<void>` | Start realtime Broadcast subscription |
| `addIncomingInteraction` | `(interaction) => void` | Add with deduplication |

---

## 7. Partner Slice

**File:** `src/stores/slices/partnerSlice.ts`

Partner connection management. Self-contained.

### State

| Field | Type | Persisted |
|---|---|---|
| `partner` | `Partner \| null` | No |
| `sentRequests` | `PartnerRequest[]` | No |
| `receivedRequests` | `PartnerRequest[]` | No |
| `searchResults` | `Profile[]` | No |
| `partnerError` | `string \| null` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `loadPartner` | `() => Promise<void>` | Load connected partner from Supabase |
| `searchUsers` | `(query) => Promise<void>` | Search profiles by display name |
| `sendPartnerRequest` | `(toUserId) => Promise<void>` | Send connection request |
| `acceptPartnerRequest` | `(requestId) => Promise<void>` | Accept incoming request |
| `declinePartnerRequest` | `(requestId) => Promise<void>` | Decline incoming request |

---

## 8. Notes Slice

**File:** `src/stores/slices/notesSlice.ts`

Love notes chat with optimistic UI, image upload, and rate limiting. Self-contained.

### State

| Field | Type | Default | Persisted |
|---|---|---|---|
| `notes` | `LoveNote[]` | `[]` | No |
| `notesIsLoading` | `boolean` | `false` | No |
| `notesError` | `string \| null` | `null` | No |
| `notesHasMore` | `boolean` | `true` | No |
| `sentMessageTimestamps` | `number[]` | `[]` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `fetchNotes` | `(limit?) => Promise<void>` | Fetch conversation with partner |
| `fetchOlderNotes` | `(limit?) => Promise<void>` | Pagination (prepend older messages) |
| `addNote` | `(note) => void` | Add with deduplication (for realtime) |
| `setNotes` | `(notes) => void` | Replace all notes (cleans up preview URLs) |
| `sendNote` | `(content, imageFile?) => Promise<void>` | Optimistic send + Broadcast |
| `retryFailedMessage` | `(tempId) => Promise<void>` | Retry with cached imageBlob |
| `cleanupPreviewUrls` | `() => void` | Revoke blob URLs to prevent memory leaks |
| `removeFailedMessage` | `(tempId) => void` | Remove failed message from list |
| `checkRateLimit` | `() => { recentTimestamps, now }` | Enforce 10 messages/minute |

---

## 9. Photos Slice

**File:** `src/stores/slices/photosSlice.ts`

Photo upload with compression, gallery, and storage quota monitoring. Self-contained.

### State

| Field | Type | Persisted |
|---|---|---|
| `photos` | `SupabasePhoto[]` | No |
| `selectedPhotoId` | `string \| null` | No |
| `isUploading` | `boolean` | No |
| `uploadProgress` | `number` | No |
| `uploadError` | `string \| null` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `uploadPhoto` | `(file, caption?, tags?) => Promise<void>` | Compress, upload, refresh gallery |
| `loadPhotos` | `() => Promise<void>` | Fetch photo metadata from Supabase |
| `deletePhoto` | `(photoId) => Promise<void>` | Delete from Supabase Storage + metadata |
| `selectPhoto` | `(photoId) => void` | Set selected photo for carousel |
| `clearSelectedPhoto` | `() => void` | Deselect photo |

---

## 10. Scripture Reading Slice

**File:** `src/stores/slices/scriptureReadingSlice.ts`

Scripture reading sessions with optimistic updates and retry. Self-contained.

### State

| Field | Type | Persisted |
|---|---|---|
| `session` | `ScriptureSession \| null` | No |
| `scriptureLoading` | `boolean` | No |
| `scriptureError` | `string \| null` | No |
| `activeSession` | `ScriptureSession \| null` | No |
| `pendingRetry` | `{ stepIndex, data, attempts } \| null` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `createSession` | `(mode) => Promise<void>` | Create new scripture session via Supabase RPC |
| `advanceStep` | `() => Promise<void>` | Optimistic step advance |
| `saveAndExit` | `() => Promise<void>` | Save current progress and exit |
| `abandonSession` | `() => Promise<void>` | Mark session as abandoned |
| `retryFailedWrite` | `() => Promise<void>` | Retry with max 3 attempts |
