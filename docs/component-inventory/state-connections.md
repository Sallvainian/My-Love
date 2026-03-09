# State Connections

The Zustand store (`useAppStore`) is composed of 10 slices. Below maps each component to the slices it consumes and the specific fields accessed.

## Access Patterns

Components access the store in three ways:

1. **Direct**: `useAppStore((state) => state.field)` or destructured `useAppStore()`
2. **Via `useShallow`**: `useAppStore(useShallow((state) => ({ ... })))` -- prevents re-renders when unrelated state changes (used by ScriptureOverview, SoloReadingFlow, LobbyContainer, ReadingContainer)
3. **Via custom hooks**: `useLoveNotes()` and `usePhotos()` wrap store selectors with memoized callbacks and side-effect logic

## AppSlice

**File**: `src/stores/slices/appSlice.ts`

**State**: `isLoading`, `error`, `__isHydrated`
**Actions**: `setLoading`, `setError`, `setHydrated`

| Component      | Fields Used                  | Access Pattern     |
| -------------- | ---------------------------- | ------------------ |
| `App`          | `isLoading`, `initializeApp` | Direct destructure |
| `DailyMessage` | `error`, `initializeApp`     | Direct destructure |

## MessagesSlice

**File**: `src/stores/slices/messagesSlice.ts`

**State**: `messages`, `currentMessage`, `messageHistory`, `currentDayOffset`, `customMessages`, `customMessagesLoaded`
**Actions**: `loadMessages`, `addMessage`, `toggleFavorite`, `updateCurrentMessage`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward`, `loadCustomMessages`, `createCustomMessage`, `updateCustomMessage`, `deleteCustomMessage`, `getCustomMessages`, `exportCustomMessages`, `importCustomMessages`

| Component             | Fields Used                                                                                                                                         | Access Pattern             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `DailyMessage`        | `currentMessage`, `messageHistory`, `toggleFavorite`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward` | Direct destructure via App |
| `AdminPanel`          | `loadCustomMessages`, `customMessagesLoaded`, `exportCustomMessages`, `importCustomMessages`                                                        | Direct                     |
| `MessageList` (admin) | `messages`, `customMessages`                                                                                                                        | Direct                     |
| `CreateMessageForm`   | `createCustomMessage`                                                                                                                               | Direct                     |
| `EditMessageForm`     | `updateCustomMessage`                                                                                                                               | Direct                     |
| `DeleteConfirmDialog` | `deleteCustomMessage`                                                                                                                               | Direct                     |

## PhotosSlice

**File**: `src/stores/slices/photosSlice.ts`

**State**: `photos`, `selectedPhotoId`, `isUploading`, `uploadProgress`, `error`, `storageWarning`
**Actions**: `uploadPhoto`, `loadPhotos`, `deletePhoto`, `updatePhoto`, `selectPhoto`, `clearPhotoSelection`, `clearError`, `clearStorageWarning`

| Component       | Fields Used                                                                                                                                           | Access Pattern       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `PhotoGallery`  | `photos`, `loadPhotos`, `deletePhoto`, `error`, `clearError`                                                                                          | Via `usePhotos` hook |
| `PhotoCarousel` | `photos`, `selectedPhotoId`, `selectPhoto`, `clearPhotoSelection`, `updatePhoto`, `deletePhoto`                                                       | Direct               |
| `PhotoUpload`   | `uploadPhoto`, `storageWarning`                                                                                                                       | Direct               |
| `PhotoUploader` | `photos`, `isUploading`, `uploadProgress`, `error`, `storageWarning`, `uploadPhoto`, `loadPhotos`, `deletePhoto`, `clearError`, `clearStorageWarning` | Via `usePhotos` hook |

## SettingsSlice

**File**: `src/stores/slices/settingsSlice.ts`

**State**: `settings`, `isOnboarded`
**Actions**: `initializeApp`, `setSettings`, `updateSettings`, `setOnboarded`, `addAnniversary`, `removeAnniversary`, `setTheme`

| Component             | Fields Used                                                         | Access Pattern             |
| --------------------- | ------------------------------------------------------------------- | -------------------------- |
| `App`                 | `settings` (theme application via `applyTheme`)                     | Direct destructure         |
| `DailyMessage`        | `settings` (relationship anniversaries for CountdownTimer)          | Direct destructure via App |
| `AnniversarySettings` | `settings`, `addAnniversary`, `removeAnniversary`, `updateSettings` | Direct                     |

## NavigationSlice

**File**: `src/stores/slices/navigationSlice.ts`

**State**: `currentView`
**Actions**: `setView`, `navigateHome`, `navigatePhotos`, `navigateMood`, `navigatePartner`, `navigateNotes`, `navigateScripture`

| Component           | Fields Used                                                 | Access Pattern                               |
| ------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `App`               | `currentView`, `setView`                                    | Direct destructure                           |
| `BottomNavigation`  | Receives `currentView` and `onViewChange` as props from App | Props (no direct store access)               |
| `LoveNotes`         | `navigateHome`                                              | `useAppStore((state) => state.navigateHome)` |
| `ScriptureOverview` | `setView` (navigate to partner view)                        | `useShallow`                                 |

## MoodSlice

**File**: `src/stores/slices/moodSlice.ts`

**State**: `moods`, `partnerMoods`, `syncStatus`
**Actions**: `addMoodEntry`, `getMoodForDate`, `updateMoodEntry`, `loadMoods`, `updateSyncStatus`, `syncPendingMoods`, `fetchPartnerMoods`, `getPartnerMoodForDate`

| Component         | Fields Used                                                                     | Access Pattern                                |
| ----------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `App`             | `syncPendingMoods`, `updateSyncStatus`, `syncStatus`                            | Direct destructure                            |
| `MoodTracker`     | `addMoodEntry`, `getMoodForDate`, `syncStatus`, `loadMoods`, `syncPendingMoods` | Direct                                        |
| `PartnerMoodView` | `partnerMoods`, `fetchPartnerMoods`, `syncStatus`                               | Direct (combined with PartnerSlice selectors) |

## InteractionsSlice

**File**: `src/stores/slices/interactionsSlice.ts`

**State**: `interactions`, `unviewedCount`, `isSubscribed`
**Actions**: `sendPoke`, `sendKiss`, `markInteractionViewed`, `getUnviewedInteractions`, `getInteractionHistory`, `loadInteractionHistory`, `subscribeToInteractions`, `addIncomingInteraction`

| Component            | Fields Used                                                                                                            | Access Pattern |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------- |
| `PokeKissInterface`  | `sendPoke`, `sendKiss`, `unviewedCount`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions` | Direct         |
| `InteractionHistory` | `getInteractionHistory`, `loadInteractionHistory`                                                                      | Direct         |

## PartnerSlice

**File**: `src/stores/slices/partnerSlice.ts`

**State**: `partner`, `isLoadingPartner`, `sentRequests`, `receivedRequests`, `isLoadingRequests`, `searchResults`, `isSearching`
**Actions**: `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest`, `hasPartner`

| Component           | Fields Used                                                                                                                                                                                                                                  | Access Pattern                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `PartnerMoodView`   | `partner`, `isLoadingPartner`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`, `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest` | Direct (combined with MoodSlice selectors) |
| `ScriptureOverview` | `partner`, `isLoadingPartner`, `loadPartner`                                                                                                                                                                                                 | `useShallow`                               |
| `SoloReadingFlow`   | `partner`, `isLoadingPartner`                                                                                                                                                                                                                | `useShallow`                               |
| `LobbyContainer`    | `partner` (for `displayName`)                                                                                                                                                                                                                | `useShallow`                               |
| `ReadingContainer`  | `partner` (for `displayName`)                                                                                                                                                                                                                | `useShallow`                               |

## NotesSlice

**File**: `src/stores/slices/notesSlice.ts`

**State**: `notes`, `notesIsLoading`, `notesError`, `notesHasMore`, `sentMessageTimestamps`
**Actions**: `fetchNotes`, `fetchOlderNotes`, `addNote`, `setNotes`, `setNotesError`, `clearNotesError`, `checkRateLimit`, `sendNote`, `retryFailedMessage`, `cleanupPreviewUrls`, `removeFailedMessage`

All access is through the `useLoveNotes` custom hook (`src/hooks/useLoveNotes.ts`), which wraps store selectors with memoized callbacks and integrates with `useRealtimeMessages` for live Supabase Broadcast subscriptions.

| Component      | Fields Used (via `useLoveNotes`)                                                                                                                                | Access Pattern        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `LoveNotes`    | `notes`, `isLoading`, `error`, `hasMore`, `fetchNotes`, `fetchOlderNotes`, `clearNotesError`, `retryFailedMessage`, `removeFailedMessage`, `cleanupPreviewUrls` | `useLoveNotes()` hook |
| `MessageInput` | `sendNote`                                                                                                                                                      | `useLoveNotes()` hook |

## ScriptureReadingSlice

**File**: `src/stores/slices/scriptureReadingSlice.ts`

**State**: `session`, `scriptureLoading`, `isInitialized`, `isPendingLockIn`, `isPendingReflection`, `isSyncing`, `scriptureError`, `activeSession`, `isCheckingSession`, `pendingRetry`, `coupleStats`, `isStatsLoading`, `myRole`, `partnerJoined`, `myReady`, `partnerReady`, `countdownStartedAt`, `currentUserId`, `partnerLocked`, `partnerDisconnected`, `partnerDisconnectedAt`, `_broadcastFn`
**Actions**: `createSession`, `loadSession`, `exitSession`, `updatePhase`, `clearScriptureError`, `checkForActiveSession`, `clearActiveSession`, `advanceStep`, `saveAndExit`, `saveSession`, `abandonSession`, `retryFailedWrite`, `loadCoupleStats`, `selectRole`, `toggleReady`, `convertToSolo`, `applySessionConverted`, `onPartnerJoined`, `onPartnerReady`, `onCountdownStarted`, `onBroadcastReceived`, `lockIn`, `undoLockIn`, `onPartnerLockInChanged`, `setPartnerDisconnected`, `endSession`, `setBroadcastFn`

| Component           | Fields Used                                                                                                                                                                                                                                                                                                   | Access Pattern |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `ScriptureOverview` | `session`, `scriptureLoading` (as `isSessionLoading`), `scriptureError` (as `sessionError`), `activeSession`, `isCheckingSession`, `createSession`, `loadSession`, `abandonSession`, `clearActiveSession`, `clearScriptureError`, `checkForActiveSession`, `coupleStats`, `isStatsLoading`, `loadCoupleStats` | `useShallow`   |
| `SoloReadingFlow`   | `session`, `isSyncing`, `scriptureError`, `pendingRetry`, `advanceStep`, `saveAndExit`, `saveSession`, `exitSession`, `retryFailedWrite`, `updatePhase`                                                                                                                                                       | `useShallow`   |
| `LobbyContainer`    | `session`, `myRole`, `partnerJoined`, `myReady`, `partnerReady`, `countdownStartedAt`, `scriptureLoading`, `selectRole`, `toggleReady`, `convertToSolo`, `updatePhase`, `partner`                                                                                                                             | `useShallow`   |
| `ReadingContainer`  | `session`, `myRole`, `isPendingLockIn`, `partnerLocked`, `scriptureError`, `lockIn`, `undoLockIn`, `partner`, `partnerDisconnected`, `partnerDisconnectedAt`, `setPartnerDisconnected`, `endSession`, `loadSession`, `isSyncing`                                                                              | `useShallow`   |

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
- All **Scripture Presentational** components (`BookmarkFlag`, `PerStepReflection`, `ReflectionSummary`, `MessageCompose`, `DailyPrayerReport`, `StatsSection`, `Countdown`, `LockInButton`, `DisconnectionOverlay`, `RoleIndicator`, `PartnerPosition`)
- All **Photo UI** components (`PhotoGridItem`, `PhotoGridSkeleton`, `PhotoViewer`, `PhotoCarouselControls`, `PhotoEditModal`, `PhotoDeleteConfirmation`)
- All **Mood Display** components (`MoodButton`, `MoodHistoryItem`, `CalendarDay`, `MoodDetailModal`, `PartnerMoodDisplay`, `NoMoodLoggedState`, `MoodHistoryTimeline`, `MoodHistoryCalendar`)
- All **Love Notes Presentational** components (`LoveNoteMessage`, `MessageList`, `ImagePreview`, `FullScreenImageViewer`)
- All **Auth** components (`LoginScreen`, `DisplayNameSetup`)
- `BottomNavigation`, `WelcomeSplash`, `WelcomeButton`, `CountdownTimer`, `SyncToast`, `NetworkStatusIndicator`, `NetworkStatusDot`

---
