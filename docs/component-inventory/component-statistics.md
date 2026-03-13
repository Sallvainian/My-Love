# Component Statistics

## Summary Counts

| Metric                      | Count |
| --------------------------- | ----- |
| Total Component Directories | 26    |
| Total .tsx Component Files  | ~67   |
| Container Components        | ~25   |
| Presentational Components   | ~42   |
| Class Components            | 2     |
| Memoized (React.memo)       | 5     |
| Lazy-Loaded (React.lazy)    | 9     |
| Virtualized Lists           | 2     |

## Components by Feature Directory

| Directory                                 | Component Count | Key Components                                                                                                                                                                                                                        |
| ----------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                             | 1               | App (root)                                                                                                                                                                                                                            |
| `src/components/AdminPanel/`              | 6               | AdminPanel, MessageList, MessageRow, CreateMessageForm, EditMessageForm, DeleteConfirmDialog                                                                                                                                          |
| `src/components/CountdownTimer/`          | 1               | CountdownTimer                                                                                                                                                                                                                        |
| `src/components/DailyMessage/`            | 1               | DailyMessage                                                                                                                                                                                                                          |
| `src/components/DisplayNameSetup/`        | 1               | DisplayNameSetup                                                                                                                                                                                                                      |
| `src/components/ErrorBoundary/`           | 1               | ErrorBoundary (class)                                                                                                                                                                                                                 |
| `src/components/InteractionHistory/`      | 1               | InteractionHistory                                                                                                                                                                                                                    |
| `src/components/LoginScreen/`             | 1               | LoginScreen                                                                                                                                                                                                                           |
| `src/components/MoodHistory/`             | 3               | MoodHistoryCalendar, CalendarDay (memo), MoodDetailModal                                                                                                                                                                              |
| `src/components/MoodTracker/`             | 5               | MoodTracker, MoodButton, MoodHistoryTimeline, MoodHistoryItem, NoMoodLoggedState, PartnerMoodDisplay                                                                                                                                  |
| `src/components/Navigation/`              | 1               | BottomNavigation                                                                                                                                                                                                                      |
| `src/components/PartnerMoodView/`         | 1               | PartnerMoodView                                                                                                                                                                                                                       |
| `src/components/PhotoCarousel/`           | 2               | PhotoCarousel, PhotoCarouselControls                                                                                                                                                                                                  |
| `src/components/PhotoDeleteConfirmation/` | 1               | PhotoDeleteConfirmation                                                                                                                                                                                                               |
| `src/components/PhotoEditModal/`          | 1               | PhotoEditModal                                                                                                                                                                                                                        |
| `src/components/PhotoGallery/`            | 4               | PhotoGallery, PhotoGridItem, PhotoGridSkeleton, PhotoViewer                                                                                                                                                                           |
| `src/components/PhotoUpload/`             | 1               | PhotoUpload                                                                                                                                                                                                                           |
| `src/components/photos/`                  | 1               | PhotoUploader                                                                                                                                                                                                                         |
| `src/components/PokeKissInterface/`       | 1 (+3 inline)   | PokeKissInterface, PokeAnimation, KissAnimation, FartAnimation                                                                                                                                                                        |
| `src/components/RelationshipTimers/`      | 4               | RelationshipTimers, TimeTogether, BirthdayCountdown, EventCountdown                                                                                                                                                                   |
| `src/components/Settings/`                | 2               | Settings, AnniversarySettings                                                                                                                                                                                                         |
| `src/components/ViewErrorBoundary/`       | 1               | ViewErrorBoundary (class)                                                                                                                                                                                                             |
| `src/components/WelcomeButton/`           | 1               | WelcomeButton                                                                                                                                                                                                                         |
| `src/components/WelcomeSplash/`           | 1               | WelcomeSplash                                                                                                                                                                                                                         |
| `src/components/love-notes/`              | 6               | LoveNotes, MessageList, LoveNoteMessage (memo), MessageInput, ImagePreview (memo), FullScreenImageViewer (memo)                                                                                                                       |
| `src/components/scripture-reading/`       | 14              | ScriptureOverview, SoloReadingFlow, LobbyContainer, ReadingContainer, BookmarkFlag, RoleIndicator, PartnerPosition, ReflectionSummary, MessageCompose, DailyPrayerReport, Countdown, DisconnectionOverlay, LockInButton, StatsSection |
| `src/components/shared/`                  | 3               | NetworkStatusIndicator, NetworkStatusDot, SyncToast                                                                                                                                                                                   |

## Component Categories

### By Type

| Category                   | Count | Examples                                                                                                                                                      |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page/View Containers       | 7     | App, PhotoGallery, MoodTracker, PartnerMoodView, LoveNotes, ScriptureOverview, AdminPanel                                                                     |
| Feature Containers         | 10    | DailyMessage, PhotoUpload, PhotoCarousel, PhotoViewer, MessageInput, SoloReadingFlow, LobbyContainer, ReadingContainer, PokeKissInterface, InteractionHistory |
| Form Modals                | 5     | CreateMessageForm, EditMessageForm, PhotoEditModal, DisplayNameSetup, Settings                                                                                |
| Confirmation Dialogs       | 2     | DeleteConfirmDialog, PhotoDeleteConfirmation                                                                                                                  |
| Presentational Cards/Items | 10    | MoodButton, MoodHistoryItem, CalendarDay, PhotoGridItem, MessageRow, LoveNoteMessage, BookmarkFlag, RoleIndicator, PartnerPosition, LockInButton              |
| Layout/Navigation          | 2     | BottomNavigation, RelationshipTimers                                                                                                                          |
| Error Boundaries           | 2     | ErrorBoundary, ViewErrorBoundary                                                                                                                              |
| Status Indicators          | 4     | NetworkStatusIndicator, NetworkStatusDot, SyncToast, StatsSection                                                                                             |
| Animations (inline)        | 3     | PokeAnimation, KissAnimation, FartAnimation                                                                                                                   |
| Skeleton/Loading           | 2     | PhotoGridSkeleton, PartnerStatusSkeleton (inline in ScriptureOverview)                                                                                        |
| Empty States               | 2     | NoMoodLoggedState, BeginningOfConversation (inline in MessageList)                                                                                            |

### By Store Dependency

| Category              | Count | Components                                                                                                                                                                                                                                                                       |
| --------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct useAppStore    | ~18   | App, DailyMessage, BottomNavigation, Settings, AnniversarySettings, PhotoGallery, PhotoUpload, PhotoViewer, PhotoCarousel, MoodTracker, PartnerMoodView, PokeKissInterface, InteractionHistory, ScriptureOverview, SoloReadingFlow, LobbyContainer, ReadingContainer, AdminPanel |
| Via Custom Hook       | ~4    | LoveNotes, MessageInput (useLoveNotes), PartnerMoodDisplay (usePartnerMood), NetworkStatusIndicator (useNetworkStatus)                                                                                                                                                           |
| Props Only (no store) | ~45   | All presentational components                                                                                                                                                                                                                                                    |

### By Animation Library

| Category                                          | Count          |
| ------------------------------------------------- | -------------- |
| Framer Motion (`motion` or `m`)                   | ~30 components |
| Lucide React icons                                | ~25 components |
| CSS animations only (animate-pulse, animate-spin) | ~8 components  |
| No animations                                     | ~29 components |

## Custom Hooks

| Hook                  | File                                 | Purpose                                      |
| --------------------- | ------------------------------------ | -------------------------------------------- |
| useAuth               | `src/hooks/useAuth.ts`               | Authentication state management              |
| useAutoSave           | `src/hooks/useAutoSave.ts`           | Visibility change / beforeunload auto-save   |
| useImageCompression   | `src/hooks/useImageCompression.ts`   | Client-side image compression                |
| useLoveNotes          | `src/hooks/useLoveNotes.ts`          | Love notes CRUD + realtime                   |
| useMoodHistory        | `src/hooks/useMoodHistory.ts`        | Mood history data loading                    |
| useMotionConfig       | `src/hooks/useMotionConfig.ts`       | Reduced motion detection + animation configs |
| useNetworkStatus      | `src/hooks/useNetworkStatus.ts`      | Online/offline/connecting state              |
| usePartnerMood        | `src/hooks/usePartnerMood.ts`        | Partner mood realtime fetching               |
| usePhotos             | `src/hooks/usePhotos.ts`             | Photo operations wrapper                     |
| useRealtimeMessages   | `src/hooks/useRealtimeMessages.ts`   | Supabase realtime broadcast for notes        |
| useScriptureBroadcast | `src/hooks/useScriptureBroadcast.ts` | Scripture session broadcast channel          |
| useScripturePresence  | `src/hooks/useScripturePresence.ts`  | Scripture partner presence tracking          |
| useVibration          | `src/hooks/useVibration.ts`          | Navigator.vibrate API wrapper                |
