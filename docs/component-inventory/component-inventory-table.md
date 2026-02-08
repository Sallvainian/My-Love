# Component Inventory Table

## Layout Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `App` | `src/App.tsx` | -- | Root component. Manages auth flow, routing via `currentView`, theme application, sync lifecycle, and service worker listeners. |

## Navigation Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `BottomNavigation` | `Navigation/` | `currentView: ViewType`, `onViewChange` | Fixed bottom tab bar with 7 tabs: Home, Mood, Notes, Partner, Photos, Scripture, Logout. Highlights active tab with pink/purple accent. |

## Error Handling Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `ErrorBoundary` | `ErrorBoundary/` | `children: ReactNode` | Global class-based error boundary. Catches render errors with retry and "Clear Storage & Reload" for validation corruption. |
| `ViewErrorBoundary` | `ViewErrorBoundary/` | `children`, `viewName: string`, `onNavigateHome` | View-scoped error boundary for lazy-loaded routes. Resets on view change. Detects offline/chunk errors. Keeps navigation visible. |
| `ViewErrorFallback` | `ViewErrorBoundary/` | `error`, `isOffline`, `viewName`, `onRetry`, `onNavigateHome` | Inline error UI showing "Go Home" and "Try Again" buttons. Internal to ViewErrorBoundary. |

## Authentication Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `LoginScreen` | `LoginScreen/` | `onLoginSuccess?` | Email/password login form with Google OAuth button. Client-side validation, error mapping, loading states. Uses custom CSS (not Tailwind). |
| `DisplayNameSetup` | `DisplayNameSetup/` | `isOpen: boolean`, `onComplete` | Post-OAuth modal prompting display name (3-30 chars). Updates Supabase `user_metadata` and upserts `users` table row. |

## Feature Components -- Home

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `DailyMessage` | `DailyMessage/` | `onShowWelcome?` | Daily rotating love message card with swipe navigation, favorite/share actions, floating hearts animation, and keyboard nav (ArrowLeft/Right). 13KB. |
| `WelcomeSplash` | `WelcomeSplash/` | `onContinue` | Full-screen welcome screen with raining hearts animation (15 hearts, Framer Motion). Shows on first visit and every 60 minutes. |
| `WelcomeButton` | `WelcomeButton/` | `onClick` | Fixed-position FAB (bottom-right) to manually trigger welcome splash. Pulse animation, tooltip on hover. |
| `CountdownTimer` | `CountdownTimer/` | `anniversaries: Anniversary[]`, `className?`, `maxDisplay?` | Anniversary countdown cards with celebration animations. 1-minute update interval for battery optimization. |
| `RelationshipTimers` | `RelationshipTimers/` | `className?` | Composite timer panel. Composes TimeTogether, BirthdayCountdown, and EventCountdown. Currently unused in App.tsx (components used directly). |
| `TimeTogether` | `RelationshipTimers/` | -- | Real-time count-up timer (years/days/hours/minutes/seconds) from dating start date. Updates every second. |
| `BirthdayCountdown` | `RelationshipTimers/` | `birthday: BirthdayInfo` | Countdown to next birthday with upcoming age display. Cake icon, real-time updates, birthday-today celebration. |
| `EventCountdown` | `RelationshipTimers/` | `label`, `icon`, `date`, `description?`, `placeholderText?` | Generic event countdown (wedding, visits). Shows placeholder when date is null. Supports ring/plane/calendar icons. |

## Feature Components -- Photos

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `PhotoGallery` | `PhotoGallery/` | `onUploadClick?` | Responsive photo grid (3-col mobile, 4-col desktop) with Intersection Observer infinite scroll, skeleton loading, empty state, error state with retry, and upload FAB. |
| `PhotoGridItem` | `PhotoGallery/` | `photo: PhotoWithUrls`, `onPhotoClick` | Square aspect-ratio thumbnail with lazy loading via IntersectionObserver, caption overlay on hover, and owner badge. |
| `PhotoGridSkeleton` | `PhotoGallery/` | -- | CSS shimmer skeleton matching PhotoGridItem dimensions. `PhotoGridSkeletonGrid` renders 12 skeletons in grid layout. |
| `PhotoViewer` | `PhotoGallery/` | `photos`, `selectedPhotoId`, `onClose` | Full-screen photo viewer modal with swipe/keyboard navigation, focus trap (WCAG 2.4.3), delete functionality, and pinch-to-zoom support. |
| `PhotoUpload` | `PhotoUpload/` | `isOpen`, `onClose` | Multi-step upload modal (select -> preview -> uploading -> success/error). File validation (JPEG/PNG/WebP, 50MB max), caption input (500 chars), tag input (max 10), storage warning banner. |
| `PhotoUploader` | `photos/` | `onUploadSuccess?`, `onCancel?`, `maxFileSize?` | Alternative upload component using `usePhotos` hook. Image compression with fallback, toast notifications. |
| `PhotoCarousel` | `PhotoCarousel/` | -- | Full-screen lightbox carousel. Swipe/keyboard navigation, spring animations (stiffness: 300, damping: 30), drag constraints, swipe-down-to-close. Reads `selectedPhotoId` from store. |
| `PhotoCarouselControls` | `PhotoCarousel/` | `onClose`, `onEdit`, `onDelete`, `currentIndex`, `totalPhotos` | Top control bar with Edit/Delete/Close buttons and photo counter. Semi-transparent backdrop. |
| `PhotoEditModal` | `PhotoEditModal/` | `photo`, `onClose`, `onSave` | Caption editing textarea (500 chars) and tag input with validation. Change detection enables save button. z-index: 60. |
| `PhotoDeleteConfirmation` | `PhotoDeleteConfirmation/` | `photo`, `onClose`, `onConfirmDelete` | Destructive confirmation dialog with warning messaging. Red delete button, cancel option. z-index: 70. |

## Feature Components -- Mood Tracking

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `MoodTracker` | `MoodTracker/` | -- | Mood logging UI with 12 mood buttons (6 positive, 6 challenging) in 3x4 grid, multi-select, optional collapsible note (200 chars), sync status, offline retry, tab navigation (Log/Timeline/Calendar). |
| `MoodButton` | `MoodTracker/` | `mood`, `icon: LucideIcon`, `label`, `isSelected`, `onClick` | Animated mood selection button with scale animation (1.1x), color feedback (pink selected, gray unselected). |
| `PartnerMoodDisplay` | `MoodTracker/` | `partnerId: string` | Partner's current mood with real-time Supabase Broadcast updates. Shows emoji, label, relative timestamp, optional note, "Just now" badge (<5 min). |
| `NoMoodLoggedState` | `MoodTracker/` | -- | Friendly empty state when partner has no mood logged. Thought bubble emoji with encouraging message. |
| `MoodHistoryTimeline` | `MoodTracker/` | `userId: string`, `isPartnerView?` | Virtualized timeline (react-window) with infinite scroll pagination. Groups moods by date with date headers. |
| `MoodHistoryItem` | `MoodTracker/` | `mood: SupabaseMood`, `isPartnerView?` | Single mood entry in timeline with emoji, mood label, relative time, and expand/collapse for long notes (truncates at 100 chars). |
| `MoodHistoryCalendar` | `MoodHistory/` | -- | Calendar month grid with color-coded mood indicators, month navigation, day-tap detail modal, efficient range loading. Target: <200ms for 30 days. |
| `CalendarDay` | `MoodHistory/` | (memoized via React.memo) | Individual day cell with mood color dot, today highlighting. Triggers MoodDetailModal on tap. |
| `MoodDetailModal` | `MoodHistory/` | (mood entry data) | Modal showing full mood details for a selected day: icon, label, timestamp, note. AnimatePresence enter/exit. |

## Feature Components -- Partner

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `PartnerMoodView` | `PartnerMoodView/` | -- | Partner connection and mood viewing. Two modes: connection UI (search, send/accept/decline requests) and connected view (mood list with real-time Supabase Realtime, connection status indicator, refresh). 25KB. |
| `MoodCard` | `PartnerMoodView/` | `moodEntry: MoodEntry`, `formatDate` | Memoized (`React.memo`) partner mood card with icon, label, date, time, and optional note. Internal to PartnerMoodView. |
| `PokeKissInterface` | `PokeKissInterface/` | `expandDirection?: 'up' \| 'down'` | Expandable FAB with Poke/Kiss/Fart/History action buttons. 30-minute cooldowns, notification badge for unviewed interactions, real-time subscription, animation overlays. |
| `PokeAnimation` | `PokeKissInterface/` | `onComplete` | Full-screen poke animation (nudge shake effect). Internal. |
| `KissAnimation` | `PokeKissInterface/` | `onComplete` | Full-screen floating hearts animation (7 hearts). Internal. |
| `FartAnimation` | `PokeKissInterface/` | `onComplete` | Full-screen fart animation (poop emoji + gas clouds). Internal. |
| `InteractionHistory` | `InteractionHistory/` | `isOpen`, `onClose` | Modal listing last 7 days of poke/kiss interactions with sent/received indicators, timestamps, "New" badges, and empty state. |

## Feature Components -- Love Notes

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `LoveNotes` | `love-notes/` | -- | Full chat page container. Header with back button, error banner, `MessageList`, and `MessageInput`. Fetches user/partner info from auth service. |
| `MessageList` | `love-notes/` | `notes`, `currentUserId`, `partnerName`, `userName`, `isLoading`, `onLoadMore`, `hasMore`, `onRetry` | Virtualized message list (react-window). Infinite scroll for older messages, auto-scroll on new messages, "New message" indicator, "Beginning of conversation" marker. |
| `LoveNoteMessage` | `love-notes/` | `note: LoveNote`, `isOwnMessage`, `senderName`, `onRetry?` | Chat bubble (coral for own, light gray for partner). Supports image attachments with inline display, signed URL refresh, full-screen viewer. Memoized. HTML sanitized via DOMPurify. |
| `MessageInput` | `love-notes/` | -- | Auto-resize textarea with character counter (visible at 900+, warning at 950, max 1000). Enter to send, Shift+Enter for newline, Escape to clear. Image attachment button, haptic feedback. |
| `ImagePreview` | `love-notes/` | `file: File`, `onRemove`, `isCompressing?` | Thumbnail preview of selected image before sending. Shows file size, compression indicator, remove button. Memoized. |
| `FullScreenImageViewer` | `love-notes/` | `imageUrl`, `isOpen`, `onClose`, `alt?` | Dark overlay modal for full-size image viewing. X button, tap-outside-to-close. Memoized. |

## Feature Components -- Scripture Reading

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `ScriptureOverview` | `scripture-reading/containers/` | -- | Entry point for Scripture Reading feature. Partner status detection, Start button, mode selection (Solo/Together), session resume prompt, offline blocking. Lavender Dreams theme. |
| `ModeCard` | `scripture-reading/containers/` | `title`, `description`, `icon`, `onClick`, `disabled?`, `variant`, `testId?` | Selection card for Solo/Together reading modes. Primary (purple bg) and secondary (white bg) variants. Internal to ScriptureOverview. |
| `PartnerStatusSkeleton` | `scripture-reading/containers/` | -- | Loading skeleton for partner status area. Internal to ScriptureOverview. |
| `PartnerLinkMessage` | `scripture-reading/containers/` | `onLinkPartner` | Button prompting user to link partner for Together mode. Internal to ScriptureOverview. |
| `SoloReadingFlow` | `scripture-reading/containers/` | -- | Step-by-step scripture reading. Verse display, response screens, progress tracking, exit confirmation, auto-save on visibility change/beforeunload, offline blocking, retry UI, focus management. |
| `BookmarkFlag` | `scripture-reading/reading/` | `isBookmarked`, `onToggle`, `disabled?` | Amber bookmark toggle icon (Lucide Bookmark). 48x48px touch target, aria-pressed, aria-label toggle. Pure presentational. |
| `PerStepReflection` | `scripture-reading/reflection/` | `onSubmit`, `disabled?` | Post-step reflection UI. 1-5 rating radiogroup with keyboard nav, optional note textarea (200 chars), character counter at 150+, validation. |
| `ReflectionSummary` | `scripture-reading/reflection/` | `bookmarkedVerses`, `onSubmit`, `disabled?` | End-of-session reflection. Bookmarked verse chips (multi-select), session-level 1-5 rating, optional note, validation messages. |

## Admin Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `AdminPanel` | `AdminPanel/` | `onExit?` | Admin dashboard for custom message management. Header with Export/Import/Create buttons, message list, create/edit/delete modals. Lazy-loaded on /admin route. |
| `MessageList` (admin) | `AdminPanel/` | `onEdit`, `onDelete` | Displays list of custom messages with MessageRow components. Connects to store for message data. |
| `MessageRow` | `AdminPanel/` | (message data, callbacks) | Single message row with edit/delete action buttons. |
| `CreateMessageForm` | `AdminPanel/` | `isOpen`, `onClose` | Modal form: text textarea (500 chars), category dropdown, active toggle. Validation via `isValidationError`. |
| `EditMessageForm` | `AdminPanel/` | `message: CustomMessage`, `isOpen`, `onClose` | Modal form pre-populated with existing message data for editing. |
| `DeleteConfirmDialog` | `AdminPanel/` | `message`, `isOpen`, `onConfirm`, `onCancel` | Destructive confirmation with warning icon. Calls `deleteCustomMessage` store action. |

## Settings Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `Settings` | `Settings/` | -- | Account settings screen with user email display, logout functionality, and AnniversarySettings section. Uses custom CSS. |
| `AnniversarySettings` | `Settings/` | -- | CRUD interface for anniversaries. Add/Edit/Delete forms with validation via `AnniversarySchema`, field-specific errors, responsive layout. |

## Shared / Utility Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `NetworkStatusIndicator` | `shared/` | `className?`, `showOnlyWhenOffline?` | Banner indicator for offline/connecting/online states. Color-coded dots (green/yellow/red), ARIA live region, role="status". |
| `NetworkStatusDot` | `shared/` | `className?` | Compact inline dot variant for header integration. Pulse animation when connecting. |
| `SyncToast` | `shared/` | `syncResult`, `onDismiss`, `autoDismissMs?` | Toast notification for sync completion. Three variants: success (green), partial (yellow), failed (red). Auto-dismiss after 5s. Spring animation. |

---
