# State Connections

The Zustand store (`useAppStore`) is composed of 11 slices (including AuthSlice). Below maps each component to the slices it consumes and the specific fields accessed.

## Access Patterns

Components access the store in three ways:

1. **Direct `useAppStore`** -- Single field selector: `useAppStore((state) => state.fieldName)`
2. **`useShallow` selector** -- Multiple fields without re-render on unrelated changes
3. **Custom hooks** -- Wrapping store access (e.g., `useLoveNotes`, `usePartnerMood`)

## Component-to-Slice Matrix

### AppSlice

| Component | Fields/Actions Used                                                  |
| --------- | -------------------------------------------------------------------- |
| App       | `isLoading`, `error`, `__isHydrated` (indirectly via initialization) |

### AuthSlice

| Component          | Fields/Actions Used                                          |
| ------------------ | ------------------------------------------------------------ |
| App                | `setAuthUser`, `clearAuth` (called from `onAuthStateChange`) |
| LoveNotes          | `userId` (via `useAppStore((state) => state.userId)`)        |
| MoodTracker        | `userId` (via slice actions internally)                      |
| PokeKissInterface  | `userId` (via slice actions internally)                      |
| InteractionHistory | `userId` (via `useAppStore((state) => state.userId)`)        |

All slices that need user identity read `get().userId` synchronously instead of calling `supabase.auth.getUser()`.

### SettingsSlice

| Component           | Fields/Actions Used                                                 |
| ------------------- | ------------------------------------------------------------------- |
| App                 | `settings`, `isOnboarded`, `initializeApp`                          |
| Settings            | `settings` (display), auth logout                                   |
| AnniversarySettings | `settings`, `addAnniversary`, `removeAnniversary`, `updateSettings` |

### NavigationSlice

| Component         | Fields/Actions Used                  |
| ----------------- | ------------------------------------ |
| App               | `currentView` (view routing)         |
| BottomNavigation  | `currentView`, `setView`             |
| LoveNotes         | `navigateHome`                       |
| ScriptureOverview | `setView` (navigate to partner view) |

### MessagesSlice

| Component           | Fields/Actions Used                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| App                 | `loadMessages` (via initializeApp)                                                                                                               |
| DailyMessage        | `messages`, `currentMessage`, `messageHistory`, `currentDayOffset`, `setCurrentMessage`, `markMessageShown`, `navigateMessage`, `toggleFavorite` |
| AdminPanel          | `importMessages`, `exportMessages`                                                                                                               |
| MessageList (Admin) | `messages`, `customMessages`                                                                                                                     |

### MoodSlice

| Component          | Fields/Actions Used                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| MoodTracker        | `addMoodEntry`, `getMoodForDate`, `syncStatus`, `loadMoods`, `syncPendingMoods` + `useAuth` hook |
| PartnerMoodView    | `partnerMoods`, `loadPartnerMoods`                                                               |
| PartnerMoodDisplay | Via `usePartnerMood` hook                                                                        |

### InteractionsSlice

| Component          | Fields/Actions Used                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| PokeKissInterface  | `sendPoke`, `sendKiss`, `unviewedCount`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions` |
| InteractionHistory | `loadInteractionHistory`, `interactions`                                                                               |

### PartnerSlice

| Component         | Fields/Actions Used                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PartnerMoodView   | `partner`, `isLoadingPartner`, `loadPartner`, `searchUsers`, `sendPartnerRequest`, `acceptPartnerRequest`, `rejectPartnerRequest`, `loadPartnerRequests`, `sentRequests`, `receivedRequests`, `searchResults` |
| ScriptureOverview | `partner`, `isLoadingPartner`, `loadPartner`                                                                                                                                                                  |
| LobbyContainer    | `partner` (displayName)                                                                                                                                                                                       |
| ReadingContainer  | `partner` (displayName)                                                                                                                                                                                       |

### NotesSlice

| Component    | Fields/Actions Used                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| LoveNotes    | Via `useLoveNotes`: `notes`, `isLoading`, `error`, `hasMore`, `fetchOlderNotes`, `clearError`, `retryFailedMessage`, `removeFailedMessage` |
| MessageInput | Via `useLoveNotes`: `sendNote`                                                                                                             |

### PhotosSlice

| Component      | Fields/Actions Used                               |
| -------------- | ------------------------------------------------- |
| PhotoGallery   | `photos`, `loadPhotos`, `selectPhoto`             |
| PhotoUpload    | `uploadPhoto`, `storageWarning`                   |
| PhotoViewer    | `selectedPhotoId`, `deletePhoto`                  |
| PhotoCarousel  | `photos`, `selectedPhotoId`, `selectPhoto`        |
| PhotoEditModal | Via parent: `updatePhoto`                         |
| usePhotos hook | Wraps all slice actions for component consumption |

### ScriptureSlice

| Component         | Fields/Actions Used                                                                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ScriptureOverview | `session`, `scriptureLoading`, `scriptureError`, `activeSession`, `isCheckingSession`, `createSession`, `loadSession`, `abandonSession`, `clearActiveSession`, `clearScriptureError`, `checkForActiveSession`, `coupleStats`, `isStatsLoading`, `loadCoupleStats` |
| SoloReadingFlow   | `session`, `scriptureLoading`, `scriptureError`, `saveSession`, `completeSession`, `exitSession`, `clearScriptureError`                                                                                                                                           |
| LobbyContainer    | `session`, `myRole`, `partnerJoined`, `myReady`, `partnerReady`, `countdownStartedAt`, `scriptureLoading`, `selectRole`, `toggleReady`, `convertToSolo`, `updatePhase`, `exitSession`                                                                             |
| ReadingContainer  | `session`, `myRole`, `isPendingLockIn`, `partnerLocked`, `scriptureError`, `lockIn`, `undoLockIn`, `partnerDisconnected`, `partnerDisconnectedAt`, `setPartnerDisconnected`, `endSession`, `loadSession`, `isSyncing`                                             |

## Hook-Mediated Access

These custom hooks encapsulate store access patterns:

| Hook                    | Store Access                                                            | Components                                                 |
| ----------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `useAuth`               | AuthSlice (userId, userEmail)                                           | MoodTracker                                                |
| `useLoveNotes`          | notesSlice (notes, loading, error, send, fetch, retry, remove, cleanup) | LoveNotes, MessageInput                                    |
| `useMoodHistory`        | moodApi (not store -- direct Supabase query with pagination)            | MoodHistoryTimeline                                        |
| `usePartnerMood`        | moodSyncService (not store -- direct Supabase + broadcast)              | PartnerMoodDisplay                                         |
| `usePhotos`             | photosSlice (photos, upload, delete, load, clear)                       | (available for photo components)                           |
| `useNetworkStatus`      | Browser API (not store)                                                 | NetworkStatusIndicator, ScriptureOverview, SoloReadingFlow |
| `useScriptureBroadcast` | scriptureSlice (setBroadcastFn) + Supabase broadcast channel            | ScriptureOverview                                          |
| `useScripturePresence`  | Supabase presence (not store directly)                                  | ReadingContainer                                           |
| `useAutoSave`           | scriptureSlice (saveSession)                                            | SoloReadingFlow                                            |
| `useVibration`          | Browser API (not store)                                                 | MessageInput                                               |
| `useMotionConfig`       | Browser API (prefers-reduced-motion)                                    | ScriptureOverview, ReadingContainer, Countdown             |
