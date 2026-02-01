# State Management

> Zustand store architecture documentation for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Overview

State management uses **Zustand v5** with 10 slices composed into a single store (`useAppStore`). Persistence via `zustand/persist` middleware with LocalStorage for critical state and IndexedDB for large datasets. Store exposed as `window.__APP_STORE__` for E2E testing.

## Store Architecture

**File**: `src/stores/useAppStore.ts`
**LocalStorage key**: `my-love-storage`
**Composition**: Slice pattern with `AppStateCreator<T>` generic type

```typescript
AppState = AppSlice & MessagesSlice & PhotosSlice & SettingsSlice &
           NavigationSlice & MoodSlice & InteractionsSlice &
           PartnerSlice & NotesSlice & ScriptureSlice
```

## Slices

### 1. AppSlice (Core)

**File**: `src/stores/slices/appSlice.ts` | **Persisted**: No

| State | Type | Purpose |
|-------|------|---------|
| `isLoading` | boolean | Global loading indicator |
| `error` | string \| null | Global error message |
| `__isHydrated` | boolean | Persist hydration flag (runtime) |

**Actions**: `setLoading()`, `setError()`, `setHydrated()`

### 2. MessagesSlice

**File**: `src/stores/slices/messagesSlice.ts` | **Persisted**: messageHistory (LocalStorage), messages (IndexedDB)

| State | Type | Purpose |
|-------|------|---------|
| `messages` | Message[] | All available messages |
| `messageHistory` | object | Current index, shown messages Map, favorites |
| `currentMessage` | Message \| null | Currently displayed |
| `customMessages` | CustomMessage[] | User-created messages |

**Key Actions**: `loadMessages()`, `addMessage()`, `toggleFavorite()`, `updateCurrentMessage()`, `navigateToPreviousMessage()`, `navigateToNextMessage()`, `loadCustomMessages()`, `createCustomMessage()`, `exportCustomMessages()`, `importCustomMessages()`

**Map Serialization**: `shownMessages` Map ↔ Array during persist/rehydrate.
**Depends on**: SettingsSlice (relationship.startDate)

### 3. PhotosSlice

**File**: `src/stores/slices/photosSlice.ts` | **Persisted**: No (loaded from Supabase)

| State | Type | Purpose |
|-------|------|---------|
| `photos` | PhotoWithUrls[] | Photos with signed URLs |
| `selectedPhotoId` | string \| null | Carousel selection |
| `isUploading` | boolean | Upload in progress |
| `uploadProgress` | number | 0-100 percentage |
| `storageWarning` | string \| null | Quota warning |

**Key Actions**: `uploadPhoto()` (quota check → upload → signed URL), `loadPhotos()`, `deletePhoto()`, `selectPhoto()`

### 4. SettingsSlice

**File**: `src/stores/slices/settingsSlice.ts` | **Persisted**: Yes (LocalStorage)

| State | Type | Purpose |
|-------|------|---------|
| `settings` | Settings \| null | User preferences |
| `isOnboarded` | boolean | Onboarding completed |

**Settings Shape**: `{ themeName, notificationTime, relationship: { startDate, partnerName, anniversaries }, customization: { accentColor, fontFamily }, notifications: { enabled, time } }`

**Key Actions**: `initializeApp()` (startup sequence: hydration → IndexedDB → messages → seed), `setSettings()`, `updateSettings()`, `setTheme()`, `addAnniversary()`

**Initialization**: Two-level guard against StrictMode double-init. Validates hydration before IndexedDB access.

### 5. NavigationSlice

**File**: `src/stores/slices/navigationSlice.ts` | **Persisted**: No (from URL)

| State | Type | Purpose |
|-------|------|---------|
| `currentView` | ViewType | Active view |

**ViewType**: 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'
**Actions**: `setView(view, skipHistory?)` (updates window.history), convenience navigators

### 6. MoodSlice

**File**: `src/stores/slices/moodSlice.ts` | **Persisted**: moods (LocalStorage), IndexedDB

| State | Type | Purpose |
|-------|------|---------|
| `moods` | MoodEntry[] | User's moods |
| `partnerMoods` | MoodEntry[] | Partner's moods |
| `syncStatus` | object | pendingMoods, isOnline, lastSyncAt, isSyncing |

**Key Actions**: `addMoodEntry()` (validate → optimistic → sync), `syncPendingMoods()`, `fetchPartnerMoods()`, `getMoodForDate()`

**Offline**: `authService.getCurrentUserIdOfflineSafe()`, exponential backoff sync

### 7. InteractionsSlice

**File**: `src/stores/slices/interactionsSlice.ts` | **Persisted**: No (from Supabase)

| State | Type | Purpose |
|-------|------|---------|
| `interactions` | Interaction[] | All interactions |
| `unviewedCount` | number | Unviewed count |
| `isSubscribed` | boolean | Realtime active |

**Key Actions**: `sendPoke()`, `sendKiss()` (optimistic), `markInteractionViewed()`, `subscribeToInteractions()` (returns unsubscribe), `addIncomingInteraction()` (dedup)

### 8. PartnerSlice

**File**: `src/stores/slices/partnerSlice.ts` | **Persisted**: No (from Supabase)

| State | Type | Purpose |
|-------|------|---------|
| `partner` | PartnerInfo \| null | Current partner |
| `sentRequests` / `receivedRequests` | PartnerRequest[] | Pending requests |
| `searchResults` | UserSearchResult[] | User search |

**Key Actions**: `loadPartner()`, `searchUsers()`, `sendPartnerRequest()`, `acceptPartnerRequest()`, `declinePartnerRequest()`

### 9. NotesSlice

**File**: `src/stores/slices/notesSlice.ts` | **Persisted**: No (from Supabase)

| State | Type | Purpose |
|-------|------|---------|
| `notes` | LoveNote[] | Chat messages |
| `notesHasMore` | boolean | Pagination |
| `sentMessageTimestamps` | number[] | Rate limiting |

**Key Actions**: `fetchNotes()`, `fetchOlderNotes()` (pagination), `sendNote(content, imageFile?)` (validate → compress → preview → broadcast), `retryFailedMessage()` (cached blob), `checkRateLimit()` (10/minute), `cleanupPreviewUrls()`

**Features**: Optimistic UI with temp IDs, blob URL management, rate limiting with sliding window

### 10. ScriptureReadingSlice

**File**: `src/stores/slices/scriptureReadingSlice.ts` | **Persisted**: No (from Supabase)

| State | Type | Purpose |
|-------|------|---------|
| `session` | ScriptureSession \| null | Active session |
| `isPendingLockIn` / `isPendingReflection` | boolean | Phase flags |
| `isSyncing` | boolean | Server sync |
| `scriptureError` | ScriptureError \| null | Error details |
| `activeSession` | ScriptureSession \| null | Incomplete found |
| `pendingRetry` | PendingRetry \| null | Failed write |

**Key Actions**: `createSession()`, `loadSession()`, `advanceStep()` (persist + retry), `saveAndExit()`, `abandonSession()`, `checkForActiveSession()`, `retryFailedWrite()`

## Persistence Strategy

### LocalStorage (`my-love-storage`)

```typescript
partialize: (state) => ({
  settings,
  isOnboarded,
  messageHistory: { ...history, shownMessages: Array.from(map.entries()) },
  moods,
})
```

**Size**: ~50-100KB typical

### IndexedDB (Large Datasets)

- **messages**: Default + custom messages (loaded on init)
- **moods**: With sync metadata (background sync to Supabase)
- **photos**: Local cache (loaded on demand)
- **scripture stores**: Cache-first reads

### Supabase (Server Source of Truth)

All tables: messages, moods, love_notes, interactions, partner_requests, photos, scripture_*

### Hydration & Recovery

1. Pre-hydration validation in storage `getItem`
2. Post-hydration validation in `onRehydrateStorage`
3. Map deserialization (Array → Map)
4. Corrupted state → clear + defaults
5. `__isHydrated` flag gates IndexedDB access

## Initialization Sequence

```
Store Creation → Persist middleware → localStorage load
  → Pre-hydration validation → onRehydrateStorage callback
    → Map deserialization → Post-hydration validation
      → __isHydrated = true

App Mount → useEffect → initializeApp()
  → Check __isHydrated → Initialize IndexedDB
    → Load/seed messages → updateCurrentMessage()
      → Guard StrictMode double-init → setLoading(false)
```

## Cross-Slice Dependencies

```
AppSlice ← all slices (isLoading, error, __isHydrated)
SettingsSlice → MessagesSlice (initializeApp coordinates message loading)
MessagesSlice → SettingsSlice (relationship.startDate for message rotation)
All others: self-contained
```

## Custom Hooks (Store Consumers)

| Hook | File | Selects | Side Effects |
|------|------|---------|-------------|
| `useLoveNotes(autoFetch?)` | `src/hooks/useLoveNotes.ts` | notes, loading, send, retry | Auto-fetch, realtime, cleanup |
| `usePhotos(autoLoad?)` | `src/hooks/usePhotos.ts` | photos, upload, progress | Auto-load |
| `useRealtimeMessages()` | `src/hooks/useRealtimeMessages.ts` | — | Broadcast subscription, backoff retry |
| `useAuth()` | `src/hooks/useAuth.ts` | user, isLoading | Auth state listener |
| `useNetworkStatus()` | `src/hooks/useNetworkStatus.ts` | isOnline, isConnecting | Event listeners |
| `useMotionConfig()` | `src/hooks/useMotionConfig.ts` | shouldReduceMotion, presets | prefers-reduced-motion |
| `useMoodHistory()` | `src/hooks/useMoodHistory.ts` | Mood query + filtering | — |
| `useAutoSave()` | `src/hooks/useAutoSave.ts` | isDirty, save | Debounced save |
| `useVibration()` | `src/hooks/useVibration.ts` | trigger | Haptic patterns |
| `useImageCompression()` | `src/hooks/useImageCompression.ts` | compress | — |

## Access Patterns

**Selector** (recommended): `const messages = useAppStore(s => s.messages)`
**Custom Hook**: `const { notes, sendNote } = useLoveNotes()`
**Direct** (outside React): `useAppStore.getState()`, `useAppStore.subscribe()`

## Key Decisions

1. **Zustand over Redux**: Less boilerplate, excellent TypeScript, no providers
2. **Slice composition**: Feature-organized, maintainable
3. **Persist middleware**: Auto hydration with recovery
4. **Map serialization**: Efficient date→message mapping
5. **Offline-first**: LocalStorage + IndexedDB ensures offline operation
6. **Optimistic updates**: Immediate feedback before server confirmation
7. **Guard initialization**: Prevents StrictMode double-init
8. **Custom hooks**: Convenient access with built-in side effects
