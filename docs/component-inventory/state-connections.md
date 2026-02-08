# State Connections

The Zustand store (`useAppStore`) is composed of 10 slices. Below maps each component to the slices it consumes.

## AppSlice

**State**: `isLoading`, `error`, `__isHydrated`
**Actions**: `setLoading`, `setError`, `initializeApp`

| Component | Fields Used |
|-----------|-------------|
| `App` | `isLoading`, `initializeApp` |
| `DailyMessage` | `error`, `initializeApp` |

## MessagesSlice

**State**: `messages`, `currentMessage`, `messageHistory`, `customMessages`, `customMessagesLoaded`
**Actions**: `toggleFavorite`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward`, `loadCustomMessages`, `createCustomMessage`, `deleteCustomMessage`, `exportCustomMessages`, `importCustomMessages`

| Component | Fields Used |
|-----------|-------------|
| `DailyMessage` | `currentMessage`, `messageHistory`, `toggleFavorite`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward` |
| `AdminPanel` | `loadCustomMessages`, `customMessagesLoaded`, `exportCustomMessages`, `importCustomMessages` |
| `CreateMessageForm` | `createCustomMessage` |
| `DeleteConfirmDialog` | `deleteCustomMessage` |

## PhotosSlice

**State**: `photos`, `selectedPhotoId`, `storageWarning`
**Actions**: `loadPhotos`, `uploadPhoto`, `updatePhoto`, `deletePhoto`, `selectPhoto`, `clearPhotoSelection`

| Component | Fields Used |
|-----------|-------------|
| `PhotoGallery` | `photos`, `loadPhotos` |
| `PhotoCarousel` | `photos`, `selectedPhotoId`, `selectPhoto`, `clearPhotoSelection`, `updatePhoto`, `deletePhoto` |
| `PhotoUpload` | `uploadPhoto`, `storageWarning` |

## SettingsSlice

**State**: `settings`, `isOnboarded`
**Actions**: `updateSettings`, `addAnniversary`, `removeAnniversary`

| Component | Fields Used |
|-----------|-------------|
| `App` | `settings` (theme application) |
| `DailyMessage` | `settings` (relationship anniversaries) |
| `AnniversarySettings` | `settings`, `addAnniversary`, `removeAnniversary`, `updateSettings` |

## NavigationSlice

**State**: `currentView`
**Actions**: `setView`, `navigateHome`

| Component | Fields Used |
|-----------|-------------|
| `App` | `currentView`, `setView` |
| `BottomNavigation` | receives `currentView` and `onViewChange` as props from App |
| `LoveNotes` | `navigateHome` |
| `ScriptureOverview` | `setView` (navigate to partner) |

## MoodSlice

**State**: `moods`, `syncStatus`
**Actions**: `addMoodEntry`, `getMoodForDate`, `loadMoods`, `syncPendingMoods`, `updateSyncStatus`

| Component | Fields Used |
|-----------|-------------|
| `App` | `syncPendingMoods`, `updateSyncStatus`, `syncStatus` |
| `MoodTracker` | `addMoodEntry`, `getMoodForDate`, `syncStatus`, `loadMoods`, `syncPendingMoods` |

## InteractionsSlice

**State**: `unviewedCount`
**Actions**: `sendPoke`, `sendKiss`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions`, `getInteractionHistory`, `loadInteractionHistory`

| Component | Fields Used |
|-----------|-------------|
| `PokeKissInterface` | `sendPoke`, `sendKiss`, `unviewedCount`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions` |
| `InteractionHistory` | `getInteractionHistory`, `loadInteractionHistory` |

## PartnerSlice

**State**: `partner`, `isLoadingPartner`, `partnerMoods`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`
**Actions**: `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest`, `fetchPartnerMoods`

| Component | Fields Used |
|-----------|-------------|
| `PartnerMoodView` | `partner`, `isLoadingPartner`, `partnerMoods`, `fetchPartnerMoods`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`, `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest` |
| `ScriptureOverview` | `partner`, `isLoadingPartner`, `loadPartner` |

## NotesSlice

**Actions**: Used indirectly via `useLoveNotes` hook

| Component | Fields Used |
|-----------|-------------|
| `LoveNotes` | via `useLoveNotes` hook |
| `MessageInput` | via `useLoveNotes` hook |

## ScriptureReadingSlice

**State**: `session`, `scriptureLoading`, `scriptureError`, `activeSession`, `isCheckingSession`
**Actions**: `createSession`, `loadSession`, `abandonSession`, `clearScriptureError`, `checkForActiveSession`

| Component | Fields Used |
|-----------|-------------|
| `ScriptureOverview` | `session`, `scriptureLoading`, `scriptureError`, `activeSession`, `isCheckingSession`, `createSession`, `loadSession`, `abandonSession`, `clearScriptureError`, `checkForActiveSession` |
| `SoloReadingFlow` | `session` (current step, status), save/advance actions |

---
