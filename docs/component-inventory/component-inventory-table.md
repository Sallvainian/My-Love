# Component Inventory Table

## Root / Layout

| Component         | Path                                                     | Type           | Store Connections                                | Key Features                                                                  |
| ----------------- | -------------------------------------------------------- | -------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| App               | `src/App.tsx`                                            | Container      | Auth state, settings, navigation, messages, sync | Auth flow gates, lazy loading, network sync, service worker listener          |
| ErrorBoundary     | `src/components/ErrorBoundary/ErrorBoundary.tsx`         | Class          | None                                             | Global error boundary, Sentry integration, fallback UI                        |
| ViewErrorBoundary | `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx` | Class          | None                                             | Per-view error boundary, keeps nav visible, detects offline/chunk load errors |
| BottomNavigation  | `src/components/Navigation/BottomNavigation.tsx`         | Presentational | `setView`, `currentView`                         | 7 tabs with Lucide icons, active tab highlighting                             |

## Auth

| Component        | Path                                                   | Type      | Store Connections | Key Features                        |
| ---------------- | ------------------------------------------------------ | --------- | ----------------- | ----------------------------------- |
| LoginScreen      | `src/components/LoginScreen/LoginScreen.tsx`           | Container | Auth service      | Email/password + Google OAuth login |
| DisplayNameSetup | `src/components/DisplayNameSetup/DisplayNameSetup.tsx` | Container | Auth service      | Post-OAuth display name setup modal |

## Home View

| Component           | Path                                                       | Type           | Store Connections                                                           | Key Features                                                 |
| ------------------- | ---------------------------------------------------------- | -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| DailyMessage        | `src/components/DailyMessage/DailyMessage.tsx`             | Container      | messagesSlice (messages, currentMessage, favorites, navigation)             | Swipe navigation, favorites, share API, message cycling      |
| CountdownTimer      | `src/components/CountdownTimer/CountdownTimer.tsx`         | Presentational | None (props only)                                                           | Countdown display, celebration animations                    |
| RelationshipTimers  | `src/components/RelationshipTimers/RelationshipTimers.tsx` | Presentational | None (reads config)                                                         | Container for all timer cards                                |
| TimeTogether        | `src/components/RelationshipTimers/TimeTogether.tsx`       | Presentational | None (reads config)                                                         | Real-time count-up from dating start, 1s interval            |
| BirthdayCountdown   | `src/components/RelationshipTimers/BirthdayCountdown.tsx`  | Presentational | None (props: BirthdayInfo)                                                  | Birthday countdown with upcoming age, "Happy Birthday" state |
| EventCountdown      | `src/components/RelationshipTimers/EventCountdown.tsx`     | Presentational | None (props: date, label, icon)                                             | Generic event countdown, supports null date placeholder      |
| WelcomeSplash       | `src/components/WelcomeSplash/WelcomeSplash.tsx`           | Presentational | None                                                                        | Animated welcome with raining hearts                         |
| WelcomeButton       | `src/components/WelcomeButton/WelcomeButton.tsx`           | Presentational | None                                                                        | FAB to re-show welcome splash                                |
| Settings            | `src/components/Settings/Settings.tsx`                     | Container      | `useAppStore` (settings, auth)                                              | Account info, logout, AnniversarySettings                    |
| AnniversarySettings | `src/components/Settings/AnniversarySettings.tsx`          | Container      | `useAppStore` (settings, addAnniversary, removeAnniversary, updateSettings) | CRUD for anniversaries with Framer Motion                    |

## Photos

| Component               | Path                                                                 | Type           | Store Connections                                             | Key Features                                                 |
| ----------------------- | -------------------------------------------------------------------- | -------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| PhotoGallery            | `src/components/PhotoGallery/PhotoGallery.tsx`                       | Container      | photosSlice (photos, loadPhotos, loadMorePhotos, selectPhoto) | Responsive grid, IntersectionObserver infinite scroll        |
| PhotoGridItem           | `src/components/PhotoGallery/PhotoGridItem.tsx`                      | Presentational | None (props)                                                  | Lazy-loaded thumbnail, owner badge                           |
| PhotoGridSkeleton       | `src/components/PhotoGallery/PhotoGridSkeleton.tsx`                  | Presentational | None                                                          | Loading skeleton grid                                        |
| PhotoViewer             | `src/components/PhotoGallery/PhotoViewer.tsx`                        | Container      | photosSlice (selectedPhotoId, deletePhoto)                    | Full-screen viewer with gestures, zoom, delete               |
| PhotoCarousel           | `src/components/PhotoCarousel/PhotoCarousel.tsx`                     | Container      | photosSlice (photos, selectedPhotoId, selectPhoto)            | Lightbox carousel, swipe/keyboard navigation                 |
| PhotoCarouselControls   | `src/components/PhotoCarousel/PhotoCarouselControls.tsx`             | Presentational | None (props)                                                  | Top bar controls (close, edit, delete)                       |
| PhotoDeleteConfirmation | `src/components/PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx` | Presentational | None (props: onConfirm, onCancel)                             | Delete confirmation dialog                                   |
| PhotoEditModal          | `src/components/PhotoEditModal/PhotoEditModal.tsx`                   | Presentational | None (props: photo, onSave, onClose)                          | Edit caption and tags modal                                  |
| PhotoUpload             | `src/components/PhotoUpload/PhotoUpload.tsx`                         | Container      | photosSlice (uploadPhoto, storageWarning)                     | Multi-step upload: select -> preview -> uploading -> success |
| PhotoUploader           | `src/components/photos/PhotoUploader.tsx`                            | Container      | photosSlice                                                   | Alternative uploader with compression, progress bar, toasts  |

## Mood

| Component           | Path                                                 | Type                  | Store Connections                     | Key Features                                                               |
| ------------------- | ---------------------------------------------------- | --------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| MoodTracker         | `src/components/MoodTracker/MoodTracker.tsx`         | Container             | moodSlice (moods, addMood, syncMoods) | 12 mood types (6+6), multi-select, notes, tabs (tracker/timeline/calendar) |
| MoodButton          | `src/components/MoodTracker/MoodButton.tsx`          | Presentational        | None (props: mood, selected, onClick) | Animated mood selection button                                             |
| MoodHistoryTimeline | `src/components/MoodTracker/MoodHistoryTimeline.tsx` | Container             | None (props: moods)                   | react-window virtualized timeline with infinite scroll                     |
| MoodHistoryItem     | `src/components/MoodTracker/MoodHistoryItem.tsx`     | Presentational        | None (props: mood)                    | Single mood entry with expand/collapse                                     |
| NoMoodLoggedState   | `src/components/MoodTracker/NoMoodLoggedState.tsx`   | Presentational        | None                                  | Empty state for partner mood                                               |
| PartnerMoodDisplay  | `src/components/MoodTracker/PartnerMoodDisplay.tsx`  | Container             | `usePartnerMood` hook                 | Partner's current mood with realtime updates                               |
| MoodHistoryCalendar | `src/components/MoodHistory/MoodHistoryCalendar.tsx` | Container             | moodService                           | Calendar view with month navigation                                        |
| CalendarDay         | `src/components/MoodHistory/CalendarDay.tsx`         | Presentational (memo) | None (props)                          | Single calendar day cell                                                   |
| MoodDetailModal     | `src/components/MoodHistory/MoodDetailModal.tsx`     | Presentational        | None (props: mood, onClose)           | Mood detail with focus trap, ESC dismiss, slide-up animation               |

## Partner

| Component          | Path                                                       | Type      | Store Connections                                                              | Key Features                                                                  |
| ------------------ | ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| PartnerMoodView    | `src/components/PartnerMoodView/PartnerMoodView.tsx`       | Container | moodSlice + partnerSlice                                                       | Partner connection management, mood viewing, realtime subscription            |
| PokeKissInterface  | `src/components/PokeKissInterface/PokeKissInterface.tsx`   | Container | interactionsSlice (sendPoke, sendKiss, unviewedCount, subscribeToInteractions) | Expandable FAB, poke/kiss/fart with cooldowns, notification badge, animations |
| InteractionHistory | `src/components/InteractionHistory/InteractionHistory.tsx` | Container | interactionsSlice                                                              | Modal showing 7-day interaction history                                       |

## Love Notes

| Component             | Path                                                  | Type                  | Store Connections                       | Key Features                                                                    |
| --------------------- | ----------------------------------------------------- | --------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| LoveNotes             | `src/components/love-notes/LoveNotes.tsx`             | Container             | `useLoveNotes` hook, `navigateHome`     | Full chat page: header, message list, input, error banner                       |
| MessageList           | `src/components/love-notes/MessageList.tsx`           | Container             | None (props from LoveNotes)             | react-window v2 virtualized list, infinite scroll, "new message" indicator      |
| LoveNoteMessage       | `src/components/love-notes/LoveNoteMessage.tsx`       | Presentational (memo) | None (props)                            | Chat bubble, XSS sanitization (DOMPurify), image display, optimistic states     |
| MessageInput          | `src/components/love-notes/MessageInput.tsx`          | Container             | `useLoveNotes` hook, `useVibration`     | Auto-resize textarea, image picker, character counter, Enter/Shift+Enter/Escape |
| ImagePreview          | `src/components/love-notes/ImagePreview.tsx`          | Presentational (memo) | None (props: file, onRemove)            | Thumbnail preview, compression estimate, remove button                          |
| FullScreenImageViewer | `src/components/love-notes/FullScreenImageViewer.tsx` | Presentational (memo) | None (props: imageUrl, isOpen, onClose) | Full-screen modal, ESC dismiss, focus trap, body scroll lock                    |

## Scripture Reading

| Component            | Path                                                                | Type           | Store Connections                                                        | Key Features                                                              |
| -------------------- | ------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| ScriptureOverview    | `src/components/scripture-reading/containers/ScriptureOverview.tsx` | Container      | scriptureSlice + partnerSlice + navigationSlice, `useScriptureBroadcast` | Entry point, mode selection, session resume, phase routing                |
| SoloReadingFlow      | `src/components/scripture-reading/containers/SoloReadingFlow.tsx`   | Container      | scriptureSlice, `useAutoSave`, `useNetworkStatus`                        | Step-by-step reading, verse/response, exit confirm, reflection phases     |
| LobbyContainer       | `src/components/scripture-reading/containers/LobbyContainer.tsx`    | Container      | scriptureSlice (lobby state), partnerSlice                               | Role selection, ready toggle, countdown, continue solo                    |
| ReadingContainer     | `src/components/scripture-reading/containers/ReadingContainer.tsx`  | Container      | scriptureSlice (lock-in state), `useScripturePresence`                   | Verse/response tabs, lock-in, partner position, disconnection overlay     |
| BookmarkFlag         | `src/components/scripture-reading/reading/BookmarkFlag.tsx`         | Presentational | None (props: isBookmarked, onToggle)                                     | Lucide Bookmark toggle, 48px touch target                                 |
| RoleIndicator        | `src/components/scripture-reading/reading/RoleIndicator.tsx`        | Presentational | None (props: role)                                                       | Pill badge: reader (purple-500) / responder (purple-300)                  |
| PartnerPosition      | `src/components/scripture-reading/reading/PartnerPosition.tsx`      | Presentational | None (props: partnerName, presence)                                      | Shows partner's current view (verse/response), hidden when null           |
| ReflectionSummary    | `src/components/scripture-reading/reflection/ReflectionSummary.tsx` | Presentational | None (props: bookmarkedVerses, onSubmit)                                 | Standout verse selection, 1-5 rating radiogroup, optional note            |
| MessageCompose       | `src/components/scripture-reading/reflection/MessageCompose.tsx`    | Presentational | None (props: partnerName, onSend, onSkip)                                | Partner message textarea, 300 char limit, skip option                     |
| DailyPrayerReport    | `src/components/scripture-reading/reflection/DailyPrayerReport.tsx` | Presentational | None (props: ratings, bookmarks, messages)                               | Full report with user + partner ratings, standout verses, partner message |
| Countdown            | `src/components/scripture-reading/session/Countdown.tsx`            | Presentational | None (props: startedAt, onComplete)                                      | 3-second countdown from server timestamp, reduced motion support          |
| DisconnectionOverlay | `src/components/scripture-reading/session/DisconnectionOverlay.tsx` | Presentational | None (props: partnerName, disconnectedAt, handlers)                      | Phase A: "reconnecting..." (<30s), Phase B: keep waiting / end session    |
| LockInButton         | `src/components/scripture-reading/session/LockInButton.tsx`         | Presentational | None (props: isLocked, isPending, partnerLocked, handlers)               | Ready/waiting/undo states, disconnected state                             |
| StatsSection         | `src/components/scripture-reading/overview/StatsSection.tsx`        | Presentational | None (props: stats, isLoading)                                           | 5 stat cards (sessions, steps, last completed, avg rating, bookmarks)     |

## Admin

| Component           | Path                                                | Type           | Store Connections                        | Key Features                                       |
| ------------------- | --------------------------------------------------- | -------------- | ---------------------------------------- | -------------------------------------------------- |
| AdminPanel          | `src/components/AdminPanel/AdminPanel.tsx`          | Container      | messagesSlice (import/export)            | Message management, import/export buttons          |
| MessageList (Admin) | `src/components/AdminPanel/MessageList.tsx`         | Container      | `useAppStore` (messages, customMessages) | Filtered/searchable message table                  |
| MessageRow          | `src/components/AdminPanel/MessageRow.tsx`          | Presentational | None (props)                             | Single message table row                           |
| CreateMessageForm   | `src/components/AdminPanel/CreateMessageForm.tsx`   | Presentational | None (props: onSubmit, onClose)          | Modal for creating custom messages with validation |
| EditMessageForm     | `src/components/AdminPanel/EditMessageForm.tsx`     | Presentational | None (props: message, onSubmit, onClose) | Modal for editing custom messages                  |
| DeleteConfirmDialog | `src/components/AdminPanel/DeleteConfirmDialog.tsx` | Presentational | None (props: onConfirm, onCancel)        | Delete confirmation modal                          |

## Shared / Utility

| Component              | Path                                               | Type           | Store Connections                   | Key Features                                         |
| ---------------------- | -------------------------------------------------- | -------------- | ----------------------------------- | ---------------------------------------------------- |
| NetworkStatusIndicator | `src/components/shared/NetworkStatusIndicator.tsx` | Presentational | `useNetworkStatus` hook             | Online/offline/connecting states, banner + dot modes |
| NetworkStatusDot       | `src/components/shared/NetworkStatusIndicator.tsx` | Presentational | `useNetworkStatus` hook             | Compact inline dot indicator                         |
| SyncToast              | `src/components/shared/SyncToast.tsx`              | Presentational | None (props: syncResult, onDismiss) | Success/warning/failure toast, auto-dismiss          |
