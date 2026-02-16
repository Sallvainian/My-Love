# State Connections

The Zustand store (`useAppStore`) is composed of 10 slices. Below maps each component to the slices it consumes and the specific fields accessed.

## Access Patterns

Components access the store in two ways:

1. **Direct**: `useAppStore((state) => state.field)` or destructured `useAppStore()`
2. **Via `useShallow`**: `useAppStore(useShallow((state) => ({ ... })))` -- prevents re-renders when unrelated state changes
3. **Via custom hooks**: `useLoveNotes()` and `usePhotos()` wrap store selectors with memoized callbacks and side-effect logic

## AppSlice

**File**: `src/stores/slices/appSlice.ts`

**State**: `isLoading`, `error`, `__isHydrated`
**Actions**: `setLoading`, `setError`, `initializeApp`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `App` | `isLoading`, `initializeApp` | Direct destructure |
| `DailyMessage` | `error`, `initializeApp` | Direct destructure |

## MessagesSlice

**File**: `src/stores/slices/messagesSlice.ts`

**State**: `messages`, `currentMessage`, `messageHistory`, `customMessages`, `customMessagesLoaded`
**Actions**: `toggleFavorite`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward`, `loadCustomMessages`, `createCustomMessage`, `updateCustomMessage`, `deleteCustomMessage`, `exportCustomMessages`, `importCustomMessages`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `DailyMessage` | `currentMessage`, `messageHistory`, `toggleFavorite`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward` | Direct destructure via App |
| `AdminPanel` | `loadCustomMessages`, `customMessagesLoaded`, `exportCustomMessages`, `importCustomMessages` | Direct |
| `MessageList` (admin) | `messages`, `customMessages` | Direct |
| `CreateMessageForm` | `createCustomMessage` | Direct |
| `EditMessageForm` | `updateCustomMessage` | Direct |
| `DeleteConfirmDialog` | `deleteCustomMessage` | Direct |

## PhotosSlice

**File**: `src/stores/slices/photosSlice.ts`

**State**: `photos`, `selectedPhotoId`, `storageWarning`, `isUploading`, `uploadProgress`, `error`
**Actions**: `loadPhotos`, `uploadPhoto`, `updatePhoto`, `deletePhoto`, `selectPhoto`, `clearPhotoSelection`, `clearError`, `clearStorageWarning`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `PhotoGallery` | `photos`, `loadPhotos`, `deletePhoto`, `error`, `clearError` | Via `usePhotos` hook |
| `PhotoCarousel` | `photos`, `selectedPhotoId`, `selectPhoto`, `clearPhotoSelection`, `updatePhoto`, `deletePhoto` | Direct |
| `PhotoUpload` | `uploadPhoto`, `storageWarning` | Direct |
| `PhotoUploader` | `photos`, `isUploading`, `uploadProgress`, `error`, `storageWarning`, `uploadPhoto`, `loadPhotos`, `deletePhoto`, `clearError`, `clearStorageWarning` | Via `usePhotos` hook |

## SettingsSlice

**File**: `src/stores/slices/settingsSlice.ts`

**State**: `settings`, `isOnboarded`
**Actions**: `updateSettings`, `addAnniversary`, `removeAnniversary`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `App` | `settings` (theme application via `applyTheme`) | Direct destructure |
| `DailyMessage` | `settings` (relationship anniversaries for CountdownTimer) | Direct destructure via App |
| `AnniversarySettings` | `settings`, `addAnniversary`, `removeAnniversary`, `updateSettings` | Direct |

## NavigationSlice

**File**: `src/stores/slices/navigationSlice.ts`

**State**: `currentView`
**Actions**: `setView`, `navigateHome`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `App` | `currentView`, `setView` | Direct destructure |
| `BottomNavigation` | Receives `currentView` and `onViewChange` as props from App | Props (no direct store access) |
| `LoveNotes` | `navigateHome` | `useAppStore((state) => state.navigateHome)` |
| `ScriptureOverview` | `setView` (navigate to partner view) | `useShallow` |

## MoodSlice

**File**: `src/stores/slices/moodSlice.ts`

**State**: `moods`, `syncStatus`
**Actions**: `addMoodEntry`, `getMoodForDate`, `loadMoods`, `syncPendingMoods`, `updateSyncStatus`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `App` | `syncPendingMoods`, `updateSyncStatus`, `syncStatus` | Direct destructure |
| `MoodTracker` | `addMoodEntry`, `getMoodForDate`, `syncStatus`, `loadMoods`, `syncPendingMoods` | Direct |

## InteractionsSlice

**File**: `src/stores/slices/interactionsSlice.ts`

**State**: `unviewedCount`
**Actions**: `sendPoke`, `sendKiss`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions`, `getInteractionHistory`, `loadInteractionHistory`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `PokeKissInterface` | `sendPoke`, `sendKiss`, `unviewedCount`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions` | Direct |
| `InteractionHistory` | `getInteractionHistory`, `loadInteractionHistory` | Direct |

## PartnerSlice

**File**: `src/stores/slices/partnerSlice.ts`

**State**: `partner`, `isLoadingPartner`, `partnerMoods`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`
**Actions**: `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest`, `fetchPartnerMoods`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `PartnerMoodView` | `partner`, `isLoadingPartner`, `partnerMoods`, `fetchPartnerMoods`, `syncStatus`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`, `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest` | Direct |
| `ScriptureOverview` | `partner`, `isLoadingPartner`, `loadPartner` | `useShallow` |
| `SoloReadingFlow` | `partner`, `isLoadingPartner` | `useShallow` |

## NotesSlice

**File**: `src/stores/slices/notesSlice.ts`

**State**: `notes`, `notesIsLoading`, `notesError`, `notesHasMore`
**Actions**: `fetchNotes`, `fetchOlderNotes`, `clearNotesError`, `sendNote`, `retryFailedMessage`, `removeFailedMessage`, `cleanupPreviewUrls`

All access is through the `useLoveNotes` custom hook (`src/hooks/useLoveNotes.ts`), which wraps store selectors with memoized callbacks and integrates with `useRealtimeMessages` for live Supabase Broadcast subscriptions.

| Component | Fields Used (via `useLoveNotes`) | Access Pattern |
|-----------|----------------------------------|----------------|
| `LoveNotes` | `notes`, `isLoading`, `error`, `hasMore`, `fetchNotes`, `fetchOlderNotes`, `clearNotesError`, `retryFailedMessage`, `removeFailedMessage`, `cleanupPreviewUrls` | `useLoveNotes()` hook |
| `MessageInput` | `sendNote` | `useLoveNotes()` hook |

## ScriptureReadingSlice

**File**: `src/stores/slices/scriptureReadingSlice.ts`

**State**: `session`, `scriptureLoading`, `scriptureError`, `activeSession`, `isCheckingSession`, `isSyncing`, `pendingRetry`
**Actions**: `createSession`, `loadSession`, `abandonSession`, `clearActiveSession`, `clearScriptureError`, `checkForActiveSession`, `advanceStep`, `saveAndExit`, `saveSession`, `exitSession`, `retryFailedWrite`, `updatePhase`

| Component | Fields Used | Access Pattern |
|-----------|-------------|----------------|
| `ScriptureOverview` | `session`, `scriptureLoading` (as `isSessionLoading`), `scriptureError` (as `sessionError`), `activeSession`, `isCheckingSession`, `createSession`, `loadSession`, `abandonSession`, `clearActiveSession`, `clearScriptureError`, `checkForActiveSession` | `useShallow` |
| `SoloReadingFlow` | `session`, `isSyncing`, `scriptureError`, `pendingRetry`, `advanceStep`, `saveAndExit`, `saveSession`, `exitSession`, `retryFailedWrite`, `updatePhase` | `useShallow` |

## Custom Hook Store Wrappers

Two custom hooks encapsulate store access with additional logic:

### `useLoveNotes` (`src/hooks/useLoveNotes.ts`)

Wraps **NotesSlice** selectors with:
- Memoized `fetchNotes`, `fetchOlderNotes`, `sendNote` callbacks
- `useRealtimeMessages` integration for live Broadcast subscriptions
- Auto-fetch on mount
- Preview URL cleanup on unmount

**Used by**: `LoveNotes`, `MessageInput`

### `usePhotos` (`src/hooks/usePhotos.ts`)

Wraps **PhotosSlice** selectors with:
- Memoized `uploadPhoto`, `loadPhotos`, `deletePhoto` callbacks
- `error`, `storageWarning`, `isUploading`, `uploadProgress` state
- `clearError`, `clearStorageWarning` actions

**Used by**: `PhotoGallery`, `PhotoUploader`

## Components Without Store Access

The following components receive all data via props and have no store connection:

- All **RelationshipTimers** components (`TimeTogether`, `BirthdayCountdown`, `EventCountdown`, `RelationshipTimers`)
- All **Error Boundary** components (`ErrorBoundary`, `ViewErrorBoundary`)
- All **Scripture Presentational** components (`BookmarkFlag`, `PerStepReflection`, `ReflectionSummary`, `MessageCompose`, `DailyPrayerReport`)
- All **Photo UI** components (`PhotoGridItem`, `PhotoGridSkeleton`, `PhotoViewer`, `PhotoCarouselControls`, `PhotoEditModal`, `PhotoDeleteConfirmation`)
- All **Mood Display** components (`MoodButton`, `MoodHistoryItem`, `CalendarDay`, `MoodDetailModal`, `PartnerMoodDisplay`, `NoMoodLoggedState`, `MoodHistoryTimeline`, `MoodHistoryCalendar`)
- All **Love Notes Presentational** components (`LoveNoteMessage`, `MessageList`, `ImagePreview`, `FullScreenImageViewer`)
- All **Auth** components (`LoginScreen`, `DisplayNameSetup`)
- `BottomNavigation`, `WelcomeSplash`, `WelcomeButton`, `CountdownTimer`, `SyncToast`, `NetworkStatusIndicator`, `NetworkStatusDot`

---
