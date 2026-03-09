# Component Inventory Table

## Layout Components

| Component | Path          | Props Interface | Store Connections                                                                                                                       | Key Features                                                                                                                                                                               |
| --------- | ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `App`     | `src/App.tsx` | None (root)     | `useAppStore`: `settings`, `currentView`, `setView`, `syncPendingMoods`, `updateSyncStatus`, `syncStatus`, `initializeApp`, `isLoading` | Auth flow (authLoading -> LoginScreen -> DisplayNameSetup -> main), lazy loading 9 views via `React.lazy()`, theme application, Service Worker event listeners, popstate-based URL routing |

## Navigation Components

| Component          | Path                              | Props Interface                                                                                                                             | Store Connections              | Key Features                                                                                                                    |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `BottomNavigation` | `Navigation/BottomNavigation.tsx` | `BottomNavigationProps { currentView: ViewType; onViewChange: (view: ViewType) => void; onSignOut: () => void; signOutDisabled?: boolean }` | None (receives props from App) | 7 tabs: Home, Mood, Notes, Partner, Photos, Scripture, Logout. Active tab highlight (pink/purple). Fixed bottom with safe-area. |

## Error Handling Components

| Component           | Path                                      | Props Interface                                                         | Store Connections | Key Features                                                                                                                  |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ErrorBoundary`     | `ErrorBoundary/ErrorBoundary.tsx`         | `{ children: ReactNode }`                                               | None              | Class component. `getDerivedStateFromError`, `componentDidCatch` with Sentry. "Clear Storage & Reload" for validation errors. |
| `ViewErrorBoundary` | `ViewErrorBoundary/ViewErrorBoundary.tsx` | `{ children: ReactNode; viewName: string; onNavigateHome: () => void }` | None              | Class component. Auto-resets when `viewName` changes. Detects chunk/offline errors. Inline UI keeps nav visible.              |

## Authentication Components

| Component          | Path                                    | Props Interface                               | Store Connections                        | Key Features                                                                                           |
| ------------------ | --------------------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `LoginScreen`      | `LoginScreen/LoginScreen.tsx`           | `{ onLoginSuccess?: () => void }`             | None (uses `signIn`, `signInWithGoogle`) | Email/password form + Google OAuth button. Client-side validation, error mapping, loading states.      |
| `DisplayNameSetup` | `DisplayNameSetup/DisplayNameSetup.tsx` | `{ isOpen: boolean; onComplete: () => void }` | None (uses supabase.auth.updateUser)     | Modal overlay. Display name input (3-30 chars). Updates `user_metadata` and upserts `users` table row. |

## Feature Components -- Home

| Component              | Path                                        | Props Interface                                                             | Store Connections                                                                                       | Key Features                                                                                 |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `DailyMessage`         | `DailyMessage/DailyMessage.tsx`             | `{ onShowWelcome?: () => void }`                                            | `currentMessage`, `settings`, `messageHistory`, `toggleFavorite`, `error`, `initializeApp`, nav actions | Swipeable card, category badges, favorite with floating hearts, Web Share API, keyboard nav. |
| `WelcomeSplash`        | `WelcomeSplash/WelcomeSplash.tsx`           | `{ onContinue: () => void }`                                                | None                                                                                                    | Full-screen, raining hearts (15), gradient bg, spring-animated heart, staggered entrance.    |
| `WelcomeButton`        | `WelcomeButton/WelcomeButton.tsx`           | `{ onClick: () => void }`                                                   | None                                                                                                    | Fixed bottom-right FAB (z-50). Pulse ring animation. Heart icon.                             |
| `CountdownTimer`       | `CountdownTimer/CountdownTimer.tsx`         | `{ anniversaries: Anniversary[]; className?: string; maxDisplay?: number }` | None                                                                                                    | 60s interval. Celebration detection. Deterministic random positions.                         |
| `CountdownCard`        | `CountdownTimer/CountdownTimer.tsx`         | `{ countdown; isCelebrating: boolean; isPrimary: boolean }`                 | None                                                                                                    | Internal. Days/hours/minutes display. Celebration pulse animation.                           |
| `CelebrationAnimation` | `CountdownTimer/CountdownTimer.tsx`         | None                                                                        | None                                                                                                    | Internal. Sparkles icons as floating hearts.                                                 |
| `RelationshipTimers`   | `RelationshipTimers/RelationshipTimers.tsx` | `{ className?: string }`                                                    | None                                                                                                    | Composite container for TimeTogether + BirthdayCountdown + EventCountdown.                   |
| `TimeTogether`         | `RelationshipTimers/TimeTogether.tsx`       | None                                                                        | None                                                                                                    | Count-up from dating start. 1s interval. Years/days + HH:MM:SS. Seconds pulse.               |
| `BirthdayCountdown`    | `RelationshipTimers/BirthdayCountdown.tsx`  | `{ birthday: BirthdayInfo }`                                                | None                                                                                                    | 1s interval. Cake icon. Upcoming age calculation. Birthday-today celebration.                |
| `EventCountdown`       | `RelationshipTimers/EventCountdown.tsx`     | `{ label; icon: IconType; date: Date                                        | null; description?; placeholderText? }`                                                                 | None                                                                                         | Icon types: ring/plane/calendar. XX:XX:XX placeholder when null. Event-today. |

## Feature Components -- Photos

| Component                 | Path                                                  | Props Interface                                                | Store Connections                    | Key Features                                                                                |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `PhotoGallery`            | `PhotoGallery/PhotoGallery.tsx`                       | `{ onUploadClick?: () => void }`                               | Via `usePhotos` hook                 | 3-col mobile / 4-col desktop grid. IntersectionObserver infinite scroll. Skeleton + error.  |
| `PhotoGridItem`           | `PhotoGallery/PhotoGridItem.tsx`                      | `{ photo: PhotoWithUrls; onPhotoClick: (id: string) => void }` | None                                 | Square aspect-ratio. Lazy loading. Caption overlay on hover. Owner badge.                   |
| `PhotoGridSkeleton`       | `PhotoGallery/PhotoGridSkeleton.tsx`                  | `{ count?: number }`                                           | None                                 | Animated skeleton placeholders for loading state.                                           |
| `PhotoViewer`             | `PhotoGallery/PhotoViewer.tsx`                        | Internal (selected photo from store)                           | `selectPhoto`, `clearPhotoSelection` | Full-screen modal. Focus trap. Pinch-to-zoom. Swipe nav. Photo preloading.                  |
| `PhotoUpload`             | `PhotoUpload/PhotoUpload.tsx`                         | `{ isOpen: boolean; onClose: () => void }`                     | Via `usePhotos` hook                 | Multi-step: Select -> Preview -> Uploading -> Success. Image compression. Storage warnings. |
| `PhotoCarousel`           | `PhotoCarousel/PhotoCarousel.tsx`                     | None (reads `selectedPhotoId` from store)                      | `selectedPhotoId`, `photos`          | Modal carousel. Renders when photo selected. Prev/next navigation.                          |
| `PhotoCarouselControls`   | `PhotoCarousel/PhotoCarouselControls.tsx`             | `{ onPrev; onNext; onEdit; onDelete; hasNext; hasPrev }`       | None                                 | Control buttons for carousel navigation, edit, delete.                                      |
| `PhotoEditModal`          | `PhotoEditModal/PhotoEditModal.tsx`                   | `{ photo; isOpen; onClose; onSave }`                           | None                                 | Edit caption and tags. z-index: 60.                                                         |
| `PhotoDeleteConfirmation` | `PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx` | `{ photoId; isOpen; onClose; onConfirm }`                      | None                                 | Confirmation dialog. z-index: 70.                                                           |
| `PhotoUploader`           | `photos/PhotoUploader.tsx`                            | Props-based (alternative upload)                               | Via `usePhotos` hook                 | Alternative upload component using usePhotos + useImageCompression hooks.                   |

## Feature Components -- Mood Tracking

| Component             | Path                                  | Props Interface                                   | Store Connections                                    | Key Features                                                                              |
| --------------------- | ------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `MoodTracker`         | `MoodTracker/MoodTracker.tsx`         | None                                              | `useAppStore` (moods, addMoodEntry, etc.), `useAuth` | 3 tabs: Log/Timeline/Calendar. 12 mood buttons (6 positive, 6 challenging). Multi-select. |
| `MoodButton`          | `MoodTracker/MoodButton.tsx`          | `{ mood; icon; label; isSelected; onClick }`      | None                                                 | Framer Motion scale on selection (1.1x). Color feedback (pink/gray).                      |
| `MoodHistoryTimeline` | `MoodTracker/MoodHistoryTimeline.tsx` | `{ userId: string }`                              | None (uses `useMoodHistory` hook)                    | react-window virtualized infinite scroll. DateHeader + MoodHistoryItem.                   |
| `MoodHistoryItem`     | `MoodTracker/MoodHistoryItem.tsx`     | `{ mood: SupabaseMood; isPartnerView?: boolean }` | None                                                 | Expandable notes (truncated at 100 chars). Mood emoji + relative timestamp.               |
| `PartnerMoodDisplay`  | `MoodTracker/PartnerMoodDisplay.tsx`  | `{ partnerId: string }`                           | None (uses `usePartnerMood` hook)                    | Real-time partner mood via Supabase Broadcast. Connection status indicator.               |
| `NoMoodLoggedState`   | `MoodTracker/NoMoodLoggedState.tsx`   | None                                              | None                                                 | Empty state when no mood logged today.                                                    |
| `MoodHistoryCalendar` | `MoodHistory/MoodHistoryCalendar.tsx` | `{ userId: string }`                              | None (uses `useMoodHistory` hook)                    | Month grid calendar. Navigable months. Mood dots per day.                                 |
| `CalendarDay`         | `MoodHistory/CalendarDay.tsx`         | `{ day; moods; isToday; onClick }`                | None                                                 | Memoized (React.memo). Mood dot colors. Click to open detail.                             |
| `MoodDetailModal`     | `MoodHistory/MoodDetailModal.tsx`     | `{ date; moods; isOpen; onClose }`                | None                                                 | Overlay showing all moods for selected day with notes.                                    |

## Feature Components -- Partner

| Component            | Path                                        | Props Interface                            | Store Connections                                              | Key Features                                                                         |
| -------------------- | ------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `PartnerMoodView`    | `PartnerMoodView/PartnerMoodView.tsx`       | None                                       | `useAppStore` (partner, moods, interactions, search, requests) | Dual-mode: partner connection setup / mood feed. Search users, send/accept requests. |
| `PokeKissInterface`  | `PokeKissInterface/PokeKissInterface.tsx`   | None                                       | `useAppStore` (sendPoke, sendKiss, interactions)               | Expandable FAB. Poke/kiss/fart animations. Cooldown timer. Vibration feedback.       |
| `InteractionHistory` | `InteractionHistory/InteractionHistory.tsx` | `{ isOpen: boolean; onClose: () => void }` | `useAppStore` (getInteractionHistory, loadInteractionHistory)  | Modal. Last 7 days. Sent/received indicators. Relative timestamps.                   |

## Feature Components -- Love Notes

| Component               | Path                                   | Props Interface                                        | Store Connections                        | Key Features                                                                            |
| ----------------------- | -------------------------------------- | ------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `LoveNotes`             | `love-notes/LoveNotes.tsx`             | None                                                   | Via `useLoveNotes` hook + `navigateHome` | Full chat page. Header with back nav. Partner name from DB. Error retry.                |
| `MessageList`           | `love-notes/MessageList.tsx`           | `{ notes; currentUserId; userName; partnerName; ... }` | None                                     | react-window v2 virtualized list. Auto-scroll to bottom. Infinite scroll up.            |
| `LoveNoteMessage`       | `love-notes/LoveNoteMessage.tsx`       | `{ note; isOwnMessage; userName; partnerName; ... }`   | None                                     | Memoized. Chat bubble (right=own, left=partner). DOMPurify sanitization. Image support. |
| `MessageInput`          | `love-notes/MessageInput.tsx`          | `{ onSend; disabled? }`                                | None                                     | Auto-resize textarea. Image picker button. Send button. Character limit display.        |
| `ImagePreview`          | `love-notes/ImagePreview.tsx`          | `{ file: File; onRemove: () => void }`                 | None                                     | Memoized. Thumbnail preview with file size. Remove button.                              |
| `FullScreenImageViewer` | `love-notes/FullScreenImageViewer.tsx` | `{ imageUrl; alt; isOpen; onClose }`                   | None                                     | Memoized. Full-screen modal for image viewing. Click/escape to close.                   |

## Feature Components -- Scripture Reading

### Overview & Containers

| Component           | Path                                                 | Props Interface       | Store Connections                                                             | Key Features                                                                                                         |
| ------------------- | ---------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ScriptureOverview` | `scripture-reading/containers/ScriptureOverview.tsx` | None                  | `useAppStore` via `useShallow` (session, stats, partner, actions)             | Entry point. Mode selection (solo/together). Resume incomplete sessions. Offline blocking. Partner status detection. |
| `SoloReadingFlow`   | `scripture-reading/containers/SoloReadingFlow.tsx`   | None                  | `useAppStore` via `useShallow` (session, advanceStep, saveAndExit, etc.)      | Step-by-step reading. Verse/response screens. Progress tracking. Auto-save. Offline indicator. Retry UI.             |
| `LobbyContainer`    | `scripture-reading/containers/LobbyContainer.tsx`    | None                  | `useAppStore` via `useShallow` (session, myRole, partnerJoined, ready states) | Together-mode lobby. Phase A: role selection. Phase B: waiting. Phase C: countdown. Convert to solo.                 |
| `ReadingContainer`  | `scripture-reading/containers/ReadingContainer.tsx`  | None                  | `useAppStore` via `useShallow` (session, lockIn, partnerLocked, etc.)         | Together-mode reading. Role indicator. Lock-in + waiting. Partner position. Step advance animation.                  |
| `StatsSection`      | `scripture-reading/overview/StatsSection.tsx`        | `{ stats: CoupleStats | null; isLoading: boolean }`                                                   | None                                                                                                                 | Couple-aggregate stats: sessions, steps, rating, bookmarks, last active. |

### Reading Components

| Component         | Path                                            | Props Interface                                  | Store Connections | Key Features                                                                     |
| ----------------- | ----------------------------------------------- | ------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `BookmarkFlag`    | `scripture-reading/reading/BookmarkFlag.tsx`    | `{ isBookmarked; onToggle; disabled? }`          | None              | Amber filled/outlined Bookmark icon. 48x48px touch target. aria-pressed.         |
| `RoleIndicator`   | `scripture-reading/reading/RoleIndicator.tsx`   | `{ role: 'reader'                                | 'responder' }`    | None                                                                             | Pill badge. Reader: primary purple. Responder: lighter purple. |
| `PartnerPosition` | `scripture-reading/reading/PartnerPosition.tsx` | `{ partnerName; presence: PartnerPresenceInfo }` | None              | Ephemeral partner view indicator. Renders nothing when null. aria-live="polite". |

### Session Components

| Component              | Path                                                 | Props Interface                                                                                       | Store Connections | Key Features                                                                                           |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `LockInButton`         | `scripture-reading/session/LockInButton.tsx`         | `{ isLocked; isPending; partnerLocked; partnerName; onLockIn; onUndoLockIn; isPartnerDisconnected? }` | None              | Ready/waiting/undo states. Partner locked indicator. Disconnected holding state.                       |
| `Countdown`            | `scripture-reading/session/Countdown.tsx`            | `{ startedAt: number; onComplete: () => void }`                                                       | None              | 3-second synchronized countdown. Clock skew correction. Reduced-motion support. aria-live="assertive". |
| `DisconnectionOverlay` | `scripture-reading/session/DisconnectionOverlay.tsx` | `{ partnerName; disconnectedAt; onKeepWaiting; onEndSession; isEnding? }`                             | None              | Phase A (<30s): "reconnecting" pulse. Phase B (>=30s): Keep Waiting / End Session.                     |

### Reflection Components

| Component           | Path                                                 | Props Interface                                                                                                                                                                      | Store Connections | Key Features                                                                              |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| `ReflectionSummary` | `scripture-reading/reflection/ReflectionSummary.tsx` | `{ bookmarkedVerses; onSubmit; disabled? }`                                                                                                                                          | None              | Selectable verse chips. 1-5 rating scale. Optional note (200 chars). Keyboard nav.        |
| `MessageCompose`    | `scripture-reading/reflection/MessageCompose.tsx`    | `{ partnerName; onSend; onSkip; disabled; autoFocusTextarea? }`                                                                                                                      | None              | 300 char textarea with counter. Send + skip buttons. Auto-grow. Keyboard handling.        |
| `DailyPrayerReport` | `scripture-reading/reflection/DailyPrayerReport.tsx` | `{ userRatings; userBookmarks; userStandoutVerses; userMessage; partnerMessage; partnerName; partnerRatings; partnerBookmarks; partnerStandoutVerses; isPartnerComplete; onReturn }` | None              | Step-by-step ratings. Standout verse chips. Partner message reveal. Side-by-side ratings. |

## Admin Components

| Component             | Path                                 | Props Interface                                        | Store Connections                                                                            | Key Features                                                                                        |
| --------------------- | ------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `AdminPanel`          | `AdminPanel/AdminPanel.tsx`          | `{ onExit?: () => void }`                              | `loadCustomMessages`, `customMessagesLoaded`, `exportCustomMessages`, `importCustomMessages` | Header with action buttons. Export/Import JSON. Create/Edit/Delete modals.                          |
| `MessageList` (admin) | `AdminPanel/MessageList.tsx`         | `{ onEdit; onDelete }`                                 | `messages`, `customMessages`                                                                 | Category filter + search. Combined default + custom messages. Results count.                        |
| `MessageRow`          | `AdminPanel/MessageRow.tsx`          | `{ message: CustomMessage; onEdit; onDelete }`         | None                                                                                         | Truncated text (100 chars). Category label. Type badge (Custom/Default/Draft). Edit/Delete buttons. |
| `CreateMessageForm`   | `AdminPanel/CreateMessageForm.tsx`   | `{ isOpen: boolean; onClose: () => void }`             | `createCustomMessage`                                                                        | Modal. Text (500 chars), category select, active toggle. Validation errors.                         |
| `EditMessageForm`     | `AdminPanel/EditMessageForm.tsx`     | `{ message: CustomMessage; isOpen: boolean; onClose }` | `updateCustomMessage`                                                                        | Modal. Pre-filled fields. Change detection. Metadata display.                                       |
| `DeleteConfirmDialog` | `AdminPanel/DeleteConfirmDialog.tsx` | `{ message; isOpen; onConfirm; onCancel }`             | `deleteCustomMessage`                                                                        | Warning icon. Message preview. Cancel/Delete buttons.                                               |

## Settings Components

| Component             | Path                               | Props Interface | Store Connections                                  | Key Features                                        |
| --------------------- | ---------------------------------- | --------------- | -------------------------------------------------- | --------------------------------------------------- |
| `Settings`            | `Settings/Settings.tsx`            | (various)       | `useAppStore` (settings, updateSettings, setTheme) | Account settings, theme selector, anniversary list. |
| `AnniversarySettings` | `Settings/AnniversarySettings.tsx` | (various)       | `useAppStore` (addAnniversary, removeAnniversary)  | Anniversary CRUD with date picker.                  |

## Shared / Utility Components

| Component                | Path                                | Props Interface                                 | Store Connections                          | Key Features                                                             |
| ------------------------ | ----------------------------------- | ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `NetworkStatusIndicator` | `shared/NetworkStatusIndicator.tsx` | `{ className?; showOnlyWhenOffline?: boolean }` | None (uses `useNetworkStatus`)             | Full-width banner. Three states: online/connecting/offline. ARIA status. |
| `NetworkStatusDot`       | `shared/NetworkStatusIndicator.tsx` | `{ className?: string }`                        | None (uses `useNetworkStatus`)             | Compact 10px dot. Same three-state colors. Pulse when connecting.        |
| `SyncToast`              | `shared/SyncToast.tsx`              | `{ syncResult: SyncResult                       | null; onDismiss; autoDismissMs?: number }` | None                                                                     | Auto-dismiss (5s default). Success/failure counts. Slide-in animation. |

---
