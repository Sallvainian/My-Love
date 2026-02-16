# Component Inventory Table

## Layout Components

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `App` | `src/App.tsx` | None (root) | `useAppStore`: `settings`, `currentView`, `setView`, `syncPendingMoods`, `updateSyncStatus`, `syncStatus`, `initializeApp`, `isLoading` | Auth flow (authLoading -> LoginScreen -> DisplayNameSetup -> main), lazy loading 9 views via `React.lazy()`, theme application, Service Worker event listeners, popstate-based URL routing |

## Navigation Components

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `BottomNavigation` | `Navigation/BottomNavigation.tsx` | `BottomNavigationProps { currentView: ViewType; onViewChange: (view: ViewType) => void; onSignOut: () => void; signOutDisabled?: boolean }` | None (receives props from App) | 7 tabs: Home, Mood, Notes, Partner, Photos, Scripture, Logout. Active tab highlight (pink for Home, purple for Scripture, blue for Notes). Fixed bottom position with safe-area padding. |

## Error Handling Components

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `ErrorBoundary` | `ErrorBoundary/ErrorBoundary.tsx` | `{ children: ReactNode }` | None | Class component. `getDerivedStateFromError`, `componentDidCatch`. Detects `isValidationError()` for "Clear Storage & Reload". Full-screen error fallback. |
| `ViewErrorBoundary` | `ViewErrorBoundary/ViewErrorBoundary.tsx` | `ViewErrorBoundaryProps { children: ReactNode; viewName: string; onNavigateHome: () => void }` | None | Class component. Auto-resets via `getDerivedStateFromProps` when `viewName` changes. Detects chunk/offline errors. Inline UI keeps nav visible. |
| `ViewErrorFallback` | `ViewErrorBoundary/ViewErrorBoundary.tsx` | `ViewErrorFallbackProps { error: Error \| null; isOffline: boolean; viewName: string; onRetry: () => void; onNavigateHome: () => void }` | None | Internal function component. "Go Home" and "Try Again" buttons. Offline vs error messaging. |

## Authentication Components

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `LoginScreen` | `LoginScreen/LoginScreen.tsx` | `LoginScreenProps { onLoginSuccess?: () => void }` | None (uses `signIn`, `signInWithGoogle` from actionService) | Email/password form + Google OAuth button. Client-side validation, error code mapping, loading states, password visibility toggle. |
| `DisplayNameSetup` | `DisplayNameSetup/DisplayNameSetup.tsx` | `DisplayNameSetupProps { isOpen: boolean; onComplete: () => void }` | None (uses supabase.auth.updateUser directly) | Modal overlay. Display name input (3-30 chars), trims whitespace, updates `user_metadata` and upserts `users` table row. |

## Feature Components -- Home

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `DailyMessage` | `DailyMessage/DailyMessage.tsx` | `DailyMessageProps { onShowWelcome?: () => void }` | `useAppStore`: `currentMessage`, `settings`, `messageHistory`, `toggleFavorite`, `error`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward` | Swipeable card (drag gesture with `onDragEnd`), category badges, favorite toggle with floating hearts, Web Share API with clipboard fallback, keyboard nav (ArrowLeft/Right), message date display. |
| `WelcomeSplash` | `WelcomeSplash/WelcomeSplash.tsx` | `WelcomeSplashProps { onContinue: () => void }` | None | Full-screen with `useMemo` heart configs (15 hearts), raining animation (4-6s fall, random drift), gradient background, spring-animated heart icon, staggered content entrance. |
| `WelcomeButton` | `WelcomeButton/WelcomeButton.tsx` | `WelcomeButtonProps { onClick: () => void }` | None | Fixed bottom-right FAB (z-50). Tooltip on hover (desktop only, `hidden md:block`). Pulse ring animation (2s infinite loop). Heart icon, spring entrance (delay: 0.5s). |
| `CountdownTimer` | `CountdownTimer/CountdownTimer.tsx` | `CountdownTimerProps { anniversaries: Anniversary[]; className?: string; maxDisplay?: number }` | None | 60-second interval updates. `getUpcomingAnniversaries()` filters and sorts. Celebration detection with 3s timeout. `AnimatePresence mode="wait"` for transitions. |
| `CountdownCard` | `CountdownTimer/CountdownTimer.tsx` | `CountdownCardProps { countdown: AnniversaryWithCountdown; isCelebrating: boolean; isPrimary: boolean }` | None | Internal. Pink border for primary, pink-400 for celebrating. Days/hours/minutes display. `shouldCelebrate` triggers pulse animation. |
| `CelebrationAnimation` | `CountdownTimer/CountdownTimer.tsx` | None | None | Internal. Deterministic random positions via `generateDeterministicNumbers()`. Sparkles icons as floating hearts. Configurable via `ANIMATION_VALUES` constants. |
| `RelationshipTimers` | `RelationshipTimers/RelationshipTimers.tsx` | `RelationshipTimersProps { className?: string }` | None | Composite container. Imports `RELATIONSHIP_DATES`, `BIRTHDAYS`, `EVENTS` from config. Renders TimeTogether + BirthdayCountdown(x2) + EventCountdown(x3). |
| `TimeTogether` | `RelationshipTimers/TimeTogether.tsx` | None | None | Count-up from `RELATIONSHIP_DATES.datingStart`. 1-second interval. Displays years/days + HH:MM:SS with `tabular-nums`. Seconds pulse animation. |
| `BirthdayCountdown` | `RelationshipTimers/BirthdayCountdown.tsx` | `BirthdayCountdownProps { birthday: BirthdayInfo }` | None | 1-second interval. Cake icon (Lucide). Calculates upcoming age. Birthday-today celebration with special styling. |
| `EventCountdown` | `RelationshipTimers/EventCountdown.tsx` | `EventCountdownProps { label: string; icon: IconType; date: Date \| null; description?: string; placeholderText?: string }` | None | Icon types: `ring` (Gem/amber), `plane` (Plane/blue), `calendar` (Calendar/green). XX:XX:XX placeholder when date is null. Calendar-days display + HH:MM:SS. Event-today celebration. |

## Feature Components -- Photos

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `PhotoGallery` | `PhotoGallery/PhotoGallery.tsx` | `PhotoGalleryProps { onUploadClick?: () => void }` | None (uses `usePhotos` hook) | 3-col mobile / 4-col desktop grid. IntersectionObserver infinite scroll (20/page). Skeleton loading, empty state, error state with retry. Upload FAB. |
| `PhotoGridItem` | `PhotoGallery/PhotoGridItem.tsx` | `PhotoGridItemProps { photo: PhotoWithUrls; onPhotoClick: (photoId: string) => void }` | None | Square aspect-ratio. Lazy loading via IntersectionObserver (`rootMargin: '200px'`). Caption overlay on hover. Owner badge (user vs partner). |
| `PhotoGridSkeleton` | `PhotoGallery/PhotoGridSkeleton.tsx` | None | None | CSS shimmer animation (`animate-pulse`). `PhotoGridSkeletonGrid` renders 12 skeleton items in matching grid layout. |
| `PhotoViewer` | `PhotoGallery/PhotoViewer.tsx` | `PhotoViewerProps { photos: PhotoWithUrls[]; selectedPhotoId: string; onClose: () => void }` | None | Full-screen modal (z-50). Focus trap. Pinch-to-zoom (double-tap), swipe nav, swipe-down close. Photo preloading (prev + next). Delete with RLS permission handling. Edit caption/tags. |
| `PhotoUpload` | `PhotoUpload/PhotoUpload.tsx` | `PhotoUploadProps { isOpen: boolean; onClose: () => void }` | `useAppStore`: `uploadPhoto`, `storageWarning` | Multi-step modal: select -> preview -> uploading -> success/error. File validation (JPEG/PNG/WebP, 50MB). Caption (500 chars), tags (max 10, 50 chars each). Compression with fallback. |
| `PhotoUploader` | `photos/PhotoUploader.tsx` | `PhotoUploaderProps { onUploadSuccess?; onCancel?; maxFileSize? }` | None (uses `usePhotos` hook) | Alternative upload UI. `imageCompressionService.compressImage()` with 10MB fallback. Progress bar (0-100%). Toast notifications (success/error/warning). Auto-clear warning after 5s. |
| `PhotoCarousel` | `PhotoCarousel/PhotoCarousel.tsx` | None | `useAppStore`: `photos`, `selectedPhotoId`, `selectPhoto`, `clearPhotoSelection`, `updatePhoto`, `deletePhoto` | Full-screen lightbox. Spring animations (stiffness: 300, damping: 30). Swipe/keyboard nav. Drag constraints. Swipe-down-to-close. Edit/Delete modal integration. |
| `PhotoCarouselControls` | `PhotoCarousel/PhotoCarouselControls.tsx` | `PhotoCarouselControlsProps { onClose; onEdit; onDelete; currentIndex: number; totalPhotos: number }` | None | Top bar: Close (X), Edit (Pencil), Delete (Trash2) buttons. Photo counter "N of M". Semi-transparent backdrop. |
| `PhotoEditModal` | `PhotoEditModal/PhotoEditModal.tsx` | `PhotoEditModalProps { photo: PhotoLike; onClose; onSave: (photoId, updates) => Promise<void> }` | None | z-index: 60. Caption textarea (500 chars, `maxLength`). Tags input (comma-separated, max 10, 50 chars each). Client + server validation (`isValidationError`). Change detection enables Save. `queueMicrotask` for URL updates. |
| `PhotoDeleteConfirmation` | `PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx` | `PhotoDeleteConfirmationProps { photo: PhotoLike; onClose; onConfirmDelete }` | None | z-index: 70. Warning messaging. Red "Delete" button, gray "Cancel". Backdrop click to close. |

## Feature Components -- Mood Tracking

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `MoodTracker` | `MoodTracker/MoodTracker.tsx` | None | `useAppStore`: `addMoodEntry`, `getMoodForDate`, `syncStatus`, `loadMoods`, `syncPendingMoods` | 12 mood buttons in 3x4 grid (6 positive + 6 challenging). Multi-select. Optional note (200 chars, collapsible). 3 tabs (Log/Timeline/Calendar) with `layoutId` animated indicator. Sync status display. Offline retry. Haptic feedback. Background sync via `navigator.serviceWorker`. |
| `MoodButton` | `MoodTracker/MoodButton.tsx` | `MoodButtonProps { mood: string; icon: LucideIcon; label: string; isSelected: boolean; onClick: () => void }` | None | Scale animation (`animate={{ scale: 1.1 }}`) on selection. Spring transition. Pink bg when selected, gray when not. |
| `PartnerMoodDisplay` | `MoodTracker/PartnerMoodDisplay.tsx` | `PartnerMoodDisplayProps { partnerId: string }` | None (uses `usePartnerMood` hook) | Real-time Supabase Broadcast updates. Emoji + label + relative timestamp + optional note. "Just now" badge for entries < 5 minutes. Loading skeleton. |
| `NoMoodLoggedState` | `MoodTracker/NoMoodLoggedState.tsx` | None | None | Thought bubble emoji with "Partner hasn't logged a mood yet" message. |
| `MoodHistoryTimeline` | `MoodTracker/MoodHistoryTimeline.tsx` | `MoodHistoryTimelineProps { userId: string; isPartnerView?: boolean }` | None | react-window `List` with `useInfiniteLoader`. Variable row heights. `groupMoodsByDate()` for date headers. `DateHeader`, `LoadingSpinner`, `EmptyMoodHistoryState` internal components. |
| `MoodHistoryItem` | `MoodTracker/MoodHistoryItem.tsx` | `MoodHistoryItemProps { mood: SupabaseMood; isPartnerView?: boolean }` | None | Emoji + mood label + relative time. Expand/collapse for long notes (truncates at 100 chars). "Show more"/"Show less" toggle. |
| `MoodHistoryCalendar` | `MoodHistory/MoodHistoryCalendar.tsx` | None | None (uses `moodService.getMoodsInRange`) | Month grid. Left/right navigation with 300ms debounce. `useMemo` for day cells. `performance.now()` for render timing. CalendarDay sub-component. |
| `CalendarDay` | `MoodHistory/CalendarDay.tsx` | `CalendarDayProps { dateKey; dayNumber; isToday; mood; monthName; year; onClick }` | None | Wrapped in `React.memo`. `MOOD_CONFIG` with 12 mood types mapping to colors/emojis. Today ring highlight. Mood dot indicator. |
| `MoodDetailModal` | `MoodHistory/MoodDetailModal.tsx` | `MoodDetailModalProps { mood: MoodEntry \| null; onClose: () => void }` | None | ESC key handler. Backdrop click to close. Slide-up animation. Full mood details: icon, label, timestamp, note. `AnimatePresence` for enter/exit. |

## Feature Components -- Partner

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `PartnerMoodView` | `PartnerMoodView/PartnerMoodView.tsx` | None | `useAppStore`: `partner`, `isLoadingPartner`, `partnerMoods`, `fetchPartnerMoods`, `syncStatus`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`, `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest` | Dual-mode: connection UI (search, send/accept/decline) and connected view. Real-time mood subscription via `moodSyncService`. Refresh button. Connection status indicator (connected/reconnecting/disconnected). `MoodCard` sub-component. |
| `MoodCard` | `PartnerMoodView/PartnerMoodView.tsx` | `{ moodEntry: MoodEntry; formatDate: (date: string) => string }` | None | Internal, wrapped in `React.memo`. Mood icon + label + date + time + optional note. Card styling with rounded corners and shadow. |
| `PokeKissInterface` | `PokeKissInterface/PokeKissInterface.tsx` | `PokeKissInterfaceProps { expandDirection?: 'up' \| 'down' }` | `useAppStore`: `sendPoke`, `sendKiss`, `unviewedCount`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions` | Expandable FAB with 4 actions (Poke/Kiss/Fart/History). 30-minute cooldown per action (stored in `lastInteractions` state). Notification badge. Real-time subscription on mount. Full-screen animation overlays. |
| `PokeAnimation` | `PokeKissInterface/PokeKissInterface.tsx` | `{ onComplete: () => void }` | None | Internal. Nudge/shake effect animation. Auto-completes after duration. |
| `KissAnimation` | `PokeKissInterface/PokeKissInterface.tsx` | `{ onComplete: () => void }` | None | Internal. 7 floating heart emojis with random positions. |
| `FartAnimation` | `PokeKissInterface/PokeKissInterface.tsx` | `{ onComplete: () => void }` | None | Internal. Poop emoji center + gas cloud particles. |
| `InteractionHistory` | `InteractionHistory/InteractionHistory.tsx` | `InteractionHistoryProps { isOpen: boolean; onClose: () => void }` | `useAppStore`: `getInteractionHistory`, `loadInteractionHistory` | Modal. Last 7 days of interactions. Sent/received indicators with directional arrows. Type icons (hand/lips/wind). Timestamps. "New" badges. Empty state. |

## Feature Components -- Love Notes

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `LoveNotes` | `love-notes/LoveNotes.tsx` | None | `useAppStore`: `navigateHome`. Uses `useLoveNotes` hook, `authService`, `getPartnerDisplayName` | Full chat page. Header with back button. Error banner with dismiss. Fetches `currentUserId`, `userName`, `partnerName` on mount. Composes MessageList + MessageInput. |
| `MessageList` | `love-notes/MessageList.tsx` | `MessageListProps { notes: LoveNote[]; currentUserId: string; partnerName: string; userName: string; isLoading: boolean; onLoadMore?; hasMore?; onRetry? }` | None | react-window v2 `List` with `useListRef`. `useInfiniteLoader` for older messages (threshold: 10, minimumBatchSize: 50). Auto-scroll to bottom on initial load + new messages. "New message" indicator button. "Beginning of conversation" marker. Variable row heights via `calculateRowHeight()`. `MessageRow` internal component. |
| `LoveNoteMessage` | `love-notes/LoveNoteMessage.tsx` | `LoveNoteMessageProps { message: LoveNote; isOwnMessage: boolean; senderName: string; onRetry?: (tempId: string) => void }` | None | Wrapped in `React.memo`. Coral (#FF6B6B) own / gray (#E9ECEF) partner bubbles. DOMPurify sanitization (`ALLOWED_TAGS: []`). Image support: signed URL fetch, retry on 403 (max 2 retries), loading/error states, full-screen viewer. Sending/error status indicators. |
| `MessageInput` | `love-notes/MessageInput.tsx` | None | None (uses `useLoveNotes` hook, `useVibration` hook) | Auto-resize textarea. Character counter visible at 900+ (warning at 950, max 1000). Enter to send, Shift+Enter newline, Escape to clear. Image picker (`accept="image/jpeg,image/png,image/webp"`). `imageCompressionService.validateImageFile()`. Haptic feedback (50ms success, [100,50,100] error). |
| `ImagePreview` | `love-notes/ImagePreview.tsx` | `ImagePreviewProps { file: File; onRemove: () => void; isCompressing?: boolean }` | None | Wrapped in `React.memo`. Object URL preview with cleanup. File size display + estimated compressed size via `imageCompressionService.estimateCompressedSize()`. Compression overlay. Large file indicator. |
| `FullScreenImageViewer` | `love-notes/FullScreenImageViewer.tsx` | `FullScreenImageViewerProps { imageUrl: string \| null; isOpen: boolean; onClose: () => void; alt?: string }` | None | Wrapped in `React.memo`. Dark overlay (bg-black/90). Focus management (stores/restores previous focus). ESC key handler. Body scroll lock. `AnimatePresence` for enter/exit. |

## Feature Components -- Scripture Reading

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `ScriptureOverview` | `scripture-reading/containers/ScriptureOverview.tsx` | None | `useAppStore` via `useShallow`: `partner`, `isLoadingPartner`, `loadPartner`, `setView`, `session`, `scriptureLoading`, `scriptureError`, `activeSession`, `isCheckingSession`, `createSession`, `loadSession`, `abandonSession`, `clearActiveSession`, `clearScriptureError`, `checkForActiveSession` | Entry point. Lavender Dreams theme (purple palette). Partner status (loading/linked/unlinked). Start button -> mode selection reveal (`AnimatePresence`). Resume prompt for incomplete sessions. Offline blocking. Screen reader announcer (`aria-live="polite"`). Routes to SoloReadingFlow when session active. |
| `ModeCard` | `scripture-reading/containers/ScriptureOverview.tsx` | `ModeCardProps { title; description; icon: ReactNode; onClick; disabled?; variant: 'primary' \| 'secondary'; testId? }` | None | Internal. Primary (purple bg) / secondary (white bg) variants. `FOCUS_RING` styles. `min-h-[120px]`. Backdrop blur. |
| `PartnerStatusSkeleton` | `scripture-reading/containers/ScriptureOverview.tsx` | None | None | Internal. `animate-pulse` skeleton bars. |
| `PartnerLinkMessage` | `scripture-reading/containers/ScriptureOverview.tsx` | `PartnerLinkMessageProps { onLinkPartner: () => void }` | None | Internal. Button with link emoji prompting partner setup. |
| `SoloIcon` | `scripture-reading/containers/ScriptureOverview.tsx` | None | None | Internal. Inline SVG person icon. |
| `TogetherIcon` | `scripture-reading/containers/ScriptureOverview.tsx` | None | None | Internal. Inline SVG group icon. |
| `SoloReadingFlow` | `scripture-reading/containers/SoloReadingFlow.tsx` | None | `useAppStore` via `useShallow`: `session`, `isSyncing`, `scriptureError`, `pendingRetry`, `advanceStep`, `saveAndExit`, `saveSession`, `exitSession`, `retryFailedWrite`, `updatePhase`, `partner`, `isLoadingPartner` | 1441 lines. `LazyMotion` with dynamic `domAnimation` import. Verse/response/reflection sub-views. Step navigation with slide animations. Progress tracking ("Verse X of 17"). Exit confirmation dialog with focus trap. Auto-save via `useAutoSave`. Offline indicator + blocked advancement. Retry UI with auto-retry on reconnect. Bookmark toggle (optimistic, 300ms debounce). Reflection submission. Report phase (compose/report/complete-unlinked/completion-error). `useNetworkStatus`, `useMotionConfig` hooks. |
| `BookmarkFlag` | `scripture-reading/reading/BookmarkFlag.tsx` | `BookmarkFlagProps { isBookmarked: boolean; onToggle: () => void; disabled?: boolean }` | None | Lucide `Bookmark` icon. Amber when bookmarked, purple when not. `aria-pressed`. `min-h-[48px] min-w-[48px]` touch target. `FOCUS_RING` styles. |
| `PerStepReflection` | `scripture-reading/reflection/PerStepReflection.tsx` | `PerStepReflectionProps { onSubmit: (rating: number, notes: string) => void; disabled?: boolean }` | None | 1-5 rating radiogroup (`role="radio"`, `aria-checked`). Arrow key navigation. End labels "A little"/"A lot". Optional note textarea (200 chars, counter at 150+). "Please select a rating" validation. `FOCUS_RING` on all interactives. |
| `ReflectionSummary` | `scripture-reading/reflection/ReflectionSummary.tsx` | `ReflectionSummaryProps { bookmarkedVerses: BookmarkedVerse[]; onSubmit: (data: ReflectionSummarySubmission) => void; disabled?: boolean }` | None | Bookmarked verse chips (multi-select, `aria-pressed`). No-bookmark fallback message. Session-level 1-5 rating (same radiogroup pattern). Share bookmarks checkbox. Optional note (200 chars). Validation messages. Focus heading on mount. |
| `MessageCompose` | `scripture-reading/reflection/MessageCompose.tsx` | `MessageComposeProps { partnerName: string; onSend: (message: string) => void; onSkip: () => void; disabled: boolean; autoFocusTextarea?: boolean }` | None | "Write something for [Partner Name]" heading. Textarea (300 chars max, counter at 250+). Auto-grow (`min-h-[120px]`, max ~6 lines). Send button + "Skip for now" link. Keyboard scroll-into-view on focus. |
| `DailyPrayerReport` | `scripture-reading/reflection/DailyPrayerReport.tsx` | `DailyPrayerReportProps { userRatings; userBookmarks; userStandoutVerses; userMessage; partnerMessage; partnerName; partnerRatings; partnerBookmarks; partnerStandoutVerses; isPartnerComplete; onReturn }` | None | Step-by-step ratings with bookmark indicators. Side-by-side partner ratings. Standout verse chips (user + partner). Partner message reveal. User message display. "Waiting for [partner]'s reflections" pulse text. "Return to Overview" button. |

## Admin Components

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `AdminPanel` | `AdminPanel/AdminPanel.tsx` | `AdminPanelProps { onExit?: () => void }` | `useAppStore`: `loadCustomMessages`, `customMessagesLoaded`, `exportCustomMessages`, `importCustomMessages` | Dashboard header with Export (JSON download), Import (file picker), Create buttons. Message list + CRUD modals. Lazy-loaded on /admin route. |
| `MessageList` (admin) | `AdminPanel/MessageList.tsx` | `MessageListProps { onEdit; onDelete }` | `useAppStore`: `messages`, `customMessages` | Category filter dropdown. Search input. `useMemo` for filtered/sorted results. Renders `MessageRow` per entry. |
| `MessageRow` | `AdminPanel/MessageRow.tsx` | `MessageRowProps { message: CustomMessage; onEdit; onDelete }` | None | Truncated text preview. Category label. Type badge (custom/default). Draft badge. Edit (Pencil) and Delete (Trash2) action buttons. |
| `CreateMessageForm` | `AdminPanel/CreateMessageForm.tsx` | `CreateMessageFormProps { isOpen: boolean; onClose: () => void }` | `useAppStore`: `createCustomMessage` | Modal. Text textarea (500 chars). Category dropdown (`MessageCategory` type). Active toggle. Validation via `isValidationError`. Loading state on submit. |
| `EditMessageForm` | `AdminPanel/EditMessageForm.tsx` | `EditMessageFormProps { message: CustomMessage; isOpen: boolean; onClose: () => void }` | `useAppStore`: `updateCustomMessage` | Modal. Pre-populated fields. `hasChanges` tracking enables Save. Same validation as Create. |
| `DeleteConfirmDialog` | `AdminPanel/DeleteConfirmDialog.tsx` | `DeleteConfirmDialogProps { message: CustomMessage; isOpen: boolean; onConfirm: () => void; onCancel: () => void }` | `useAppStore`: `deleteCustomMessage` | Warning icon. Destructive confirmation with message preview. |

## Settings Components

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `Settings` | `Settings/Settings.tsx` | None | None (uses `authService`) | Account email display. Logout button. AnniversarySettings section. App version info. |
| `AnniversarySettings` | `Settings/AnniversarySettings.tsx` | None | `useAppStore`: `settings`, `addAnniversary`, `removeAnniversary`, `updateSettings` | CRUD for anniversaries. Add/Edit forms via `AnniversaryForm` (internal). `AnniversarySchema` validation. Field-specific error display. Confirm dialog for delete. |

## Shared / Utility Components

| Component | Path | Props Interface | Store Connections | Key Features |
|-----------|------|----------------|-------------------|--------------|
| `NetworkStatusIndicator` | `shared/NetworkStatusIndicator.tsx` | `NetworkStatusIndicatorProps { className?; showOnlyWhenOffline? }` | None (uses `useNetworkStatus` hook) | Banner for offline/connecting/online. Color dots: green (#51CF66), yellow (#FCC419), red (#FF6B6B). Icons: Wifi/WifiOff/Loader2. ARIA `role="status"`, `aria-live="polite"`. |
| `NetworkStatusDot` | `shared/NetworkStatusIndicator.tsx` | `{ className?: string }` | None (uses `useNetworkStatus` hook) | Compact 10px dot. Pulse animation when connecting. `role="status"`, `aria-label`. |
| `SyncToast` | `shared/SyncToast.tsx` | `SyncToastProps { syncResult: SyncResult \| null; onDismiss; autoDismissMs? }` | None | Fixed top-center (z-100). Spring animation (stiffness: 500, damping: 30). Variants: success (green/CheckCircle), partial (yellow/AlertCircle), failed (red/AlertCircle), empty (gray/Cloud). Auto-dismiss 5s. Manual dismiss button. |
| `charCounter` | `scripture-reading/reflection/charCounter.ts` | N/A (utility) | None | `getCharCounterThreshold(maxLength)` returns `Math.floor(maxLength * 0.75)`. Used by PerStepReflection. |
| `motionFeatures` | `scripture-reading/motionFeatures.ts` | N/A (utility) | None | Re-exports `domAnimation` from framer-motion for `LazyMotion` dynamic import. |

---
