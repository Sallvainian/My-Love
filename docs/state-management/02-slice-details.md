# Slice Details

## 1. AppSlice (`src/stores/slices/appSlice.ts`)

The core application state slice. Defined in `src/stores/types.ts` to avoid circular imports.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `isLoading` | `boolean` | `true` | No |
| `error` | `string \| null` | `null` | No |
| `__isHydrated` | `boolean` | `false` | No |

**Actions:**

| Action | Signature | Description |
|--------|-----------|-------------|
| `setLoading` | `(loading: boolean) => void` | Toggle loading state |
| `setError` | `(error: string \| null) => void` | Set/clear error message |

**Cross-Slice Dependencies:** None. This slice is the most fundamental -- other slices call `get().setLoading()` and `get().setError()`.

---

## 2. SettingsSlice (`src/stores/slices/settingsSlice.ts`)

Manages settings, onboarding, themes, anniversaries, and app initialization.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `settings` | `Settings \| null` | Pre-configured defaults | Yes |
| `isOnboarded` | `boolean` | `true` | Yes |

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

| Action | Signature | Validation |
|--------|-----------|------------|
| `initializeApp` | `() => Promise<void>` | Checks hydration, initializes IndexedDB, loads messages |
| `setSettings` | `(settings: Settings) => void` | `SettingsSchema.parse()` |
| `updateSettings` | `(updates: Partial<Settings>) => void` | Merges then `SettingsSchema.parse()` |
| `setOnboarded` | `(onboarded: boolean) => void` | None |
| `addAnniversary` | `(anniversary: Omit<Anniversary, 'id'>) => void` | Auto-generates ID |
| `removeAnniversary` | `(id: number) => void` | None |
| `setTheme` | `(theme: ThemeName) => void` | None |

**StrictMode Protection:** Module-level `isInitializing` and `isInitialized` flags prevent duplicate `initializeApp()` calls from React 18+ StrictMode double-mounting.

**Cross-Slice Dependencies:** Reads `AppSlice` (`setLoading`, `setError`, `__isHydrated`). Writes `MessagesSlice` state (`messages`) and calls `updateCurrentMessage()`.

---

## 3. NavigationSlice (`src/stores/slices/navigationSlice.ts`)

Tab-based navigation without a router library.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `currentView` | `ViewType` | `'home'` | No |

**ViewType:** `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'`

**Actions:**

| Action | Signature | Side Effects |
|--------|-----------|-------------|
| `setView` | `(view: ViewType) => void` | Updates `window.history` via `pushState` |

---

## 4. MessagesSlice (`src/stores/slices/messagesSlice.ts`)

Daily love messages with deterministic rotation, history navigation, favorites, and custom message CRUD.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `messages` | `Message[]` | `[]` | No (IndexedDB) |
| `currentMessage` | `Message \| null` | `null` | No |
| `messageHistory` | `MessageHistory` | `{ shownMessages: new Map(), currentOffset: 0, maxHistoryDays: 30 }` | Yes |

**Actions:**

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadMessages` | `() => Promise<void>` | Load all messages from IndexedDB |
| `updateCurrentMessage` | `() => void` | Calculate today's message using date-hash algorithm |
| `navigatePreviousMessage` | `() => void` | Go to previous day's message |
| `navigateNextMessage` | `() => void` | Go to next day's message |
| `toggleFavorite` | `(id: number) => Promise<void>` | Toggle message favorite status |
| `addCustomMessage` | `(input) => Promise<void>` | Create custom message (Zod validated) |
| `updateCustomMessage` | `(input) => Promise<void>` | Update custom message (Zod validated) |
| `deleteCustomMessage` | `(id: number) => Promise<void>` | Delete custom message |
| `exportCustomMessages` | `() => Promise<string>` | Export as JSON string |
| `importCustomMessages` | `(json: string) => Promise<{imported, duplicates}>` | Import with duplicate detection |

**Message Rotation Algorithm:** Uses `messageRotation.ts` with a deterministic hash of the date string. Same date always produces the same message index.

---

## 5. MoodSlice (`src/stores/slices/moodSlice.ts`)

Mood tracking with offline-first persistence and partner mood visibility.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `moods` | `MoodEntry[]` | `[]` | Yes |
| `partnerMoods` | `MoodEntry[]` | `[]` | No |
| `syncStatus` | `{ pendingMoods, isOnline, lastSyncAt?, isSyncing }` | Defaults | No |

**Actions:**

| Action | Signature | Description |
|--------|-----------|-------------|
| `addMoodEntry` | `(moods: MoodType[], note?: string) => Promise<void>` | Create mood (validates, saves to IDB, syncs if online) |
| `getMoodForDate` | `(date: string) => MoodEntry \| undefined` | Find mood for ISO date |
| `updateMoodEntry` | `(date, moods, note?) => Promise<void>` | Update existing mood for date |
| `loadMoods` | `() => Promise<void>` | Load all moods from IndexedDB |
| `updateSyncStatus` | `() => Promise<void>` | Refresh pending mood count |
| `syncPendingMoods` | `() => Promise<{synced, failed}>` | Sync all unsynced moods to Supabase |
| `fetchPartnerMoods` | `(limit?) => Promise<void>` | Fetch partner's moods from Supabase |
| `getPartnerMoodForDate` | `(date: string) => MoodEntry \| undefined` | Find partner mood for date |

---

## 6. InteractionsSlice (`src/stores/slices/interactionsSlice.ts`)

Poke/kiss interaction management. Ephemeral -- not persisted.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `interactions` | `Interaction[]` | `[]` | No |
| `interactionLoading` | `boolean` | `false` | No |

**Actions:**

| Action | Signature | Description |
|--------|-----------|-------------|
| `sendInteraction` | `(partnerId, type) => Promise<void>` | Send poke/kiss (validates, calls Supabase) |
| `loadInteractions` | `(limit?) => Promise<void>` | Fetch recent interactions |
| `subscribeToInteractions` | `() => void` | Start realtime subscription |
| `unsubscribeFromInteractions` | `() => void` | Stop realtime subscription |

---

## 7. PartnerSlice (`src/stores/slices/partnerSlice.ts`)

Partner data, requests, and user search. All data from Supabase.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `partnerInfo` | `PartnerInfo \| null` | `null` | No |
| `partnerRequests` | `{ sent, received }` | `{ sent: [], received: [] }` | No |
| `userSearchResults` | `UserSearchResult[]` | `[]` | No |

**Actions:**

| Action | Signature |
|--------|-----------|
| `loadPartnerInfo` | `() => Promise<void>` |
| `searchUsers` | `(query: string) => Promise<void>` |
| `sendPartnerRequest` | `(targetUserId: string) => Promise<void>` |
| `acceptPartnerRequest` | `(requestId: string) => Promise<void>` |
| `rejectPartnerRequest` | `(requestId: string) => Promise<void>` |
| `loadPartnerRequests` | `() => Promise<void>` |

---

## 8. NotesSlice (`src/stores/slices/notesSlice.ts`)

Love notes chat with optimistic updates, rate limiting, and image support.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `notes` | `LoveNote[]` | `[]` | No |
| `notesLoading` | `boolean` | `false` | No |
| `notesError` | `string \| null` | `null` | No |

**Actions:**

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadNotes` | `(limit?) => Promise<void>` | Fetch notes from Supabase |
| `sendNote` | `(text, imageFile?) => Promise<void>` | Send note with optional image, rate limited |
| `addIncomingNote` | `(note: LoveNote) => void` | Add realtime-received note to state |
| `clearPreviewUrls` | `() => void` | Revoke object URLs for memory cleanup |

**Rate Limiting:** Tracks message timestamps; rejects if 10+ messages sent within 60 seconds.

**Optimistic Updates:** Notes are added to state with a `tempId` immediately, replaced with the Supabase-generated ID on confirmation.

---

## 9. PhotosSlice (`src/stores/slices/photosSlice.ts`)

Photo gallery with Supabase Storage integration.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `photos` | `Photo[]` | `[]` | No |
| `photosLoading` | `boolean` | `false` | No |
| `uploadProgress` | `number \| null` | `null` | No |
| `storageQuota` | `{ used, total, warningLevel }` | Defaults | No |

**Actions:**

| Action | Signature |
|--------|-----------|
| `loadPhotos` | `() => Promise<void>` |
| `uploadPhoto` | `(file, caption?, tags?) => Promise<void>` |
| `deletePhoto` | `(id: string) => Promise<void>` |
| `updatePhotoCaption` | `(id, caption) => Promise<void>` |
| `checkStorageQuota` | `() => Promise<void>` |

---

## 10. ScriptureReadingSlice (`src/stores/slices/scriptureReadingSlice.ts`)

Scripture reading sessions with online-first pattern and optimistic UI.

**State:**

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `currentSession` | `ScriptureSession \| null` | `null` | No |
| `sessionHistory` | `ScriptureSession[]` | `[]` | No |
| `scriptureLoading` | `boolean` | `false` | No |
| `pendingRetry` | `boolean` | `false` | No |

**Actions:**

| Action | Signature | Description |
|--------|-----------|-------------|
| `startSession` | `() => Promise<void>` | Create new session via Supabase RPC |
| `advanceStep` | `() => Promise<void>` | Move to next scripture step |
| `saveReflection` | `(rating, notes) => Promise<void>` | Save per-step reflection |
| `saveAndExit` | `() => Promise<void>` | Save progress and exit |
| `abandonSession` | `() => Promise<void>` | Mark session as abandoned |
| `retryFailedWrite` | `() => Promise<void>` | Retry pending failed write |
| `loadSessionHistory` | `() => Promise<void>` | Load past sessions from cache/Supabase |

## Related Documentation

- [Zustand Store Configuration](./01-zustand-store-configuration.md)
- [Data Flow](./04-data-flow.md)
- [React Hooks](./06-react-hooks.md)
