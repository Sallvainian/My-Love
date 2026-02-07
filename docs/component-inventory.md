# Component Inventory

Exhaustive inventory of all React components in the My Love PWA. Last updated: 2026-02-04.

---

## Table of Contents

1. [Component Hierarchy](#component-hierarchy)
2. [Component Inventory Table](#component-inventory-table)
3. [Feature Components](#feature-components)
4. [Shared and Utility Components](#shared-and-utility-components)
5. [Design Patterns](#design-patterns)
6. [State Connections](#state-connections)

---

## Component Hierarchy

```
App (root)
├── ErrorBoundary (global)
│   ├── LoginScreen (unauthenticated)
│   ├── DisplayNameSetup (post-OAuth onboarding)
│   └── WelcomeSplash (first visit / 60-min interval)
│
├── NetworkStatusIndicator (always visible when offline)
├── SyncToast (sync completion feedback)
│
├── <main> (authenticated, initialized)
│   │
│   ├── [home] ─ Inline (not lazy-loaded)
│   │   ├── TimeTogether
│   │   ├── BirthdayCountdown (x2)
│   │   ├── EventCountdown (wedding + visits)
│   │   └── DailyMessage
│   │       ├── CountdownTimer
│   │       │   └── CountdownCard (internal)
│   │       │       └── CelebrationAnimation (internal)
│   │       └── WelcomeButton
│   │
│   └── ViewErrorBoundary (wraps all lazy views)
│       │
│       ├── [photos] ─ Lazy
│       │   └── PhotoGallery
│       │       ├── PhotoGridSkeleton / PhotoGridSkeletonGrid
│       │       ├── PhotoGridItem (per photo)
│       │       └── PhotoViewer (full-screen modal)
│       │
│       ├── [mood] ─ Lazy
│       │   └── MoodTracker
│       │       ├── MoodButton (x12)
│       │       ├── PartnerMoodDisplay
│       │       │   └── NoMoodLoggedState
│       │       ├── MoodHistoryTimeline (virtualized)
│       │       │   └── MoodHistoryItem
│       │       └── MoodHistoryCalendar
│       │           ├── CalendarDay (per day cell)
│       │           └── MoodDetailModal
│       │
│       ├── [partner] ─ Lazy
│       │   └── PartnerMoodView
│       │       ├── MoodCard (memoized, per entry)
│       │       └── PokeKissInterface (FAB)
│       │           ├── PokeAnimation
│       │           ├── KissAnimation
│       │           ├── FartAnimation
│       │           └── InteractionHistory (modal)
│       │
│       ├── [notes] ─ Lazy
│       │   └── LoveNotes
│       │       ├── MessageList (virtualized via react-window)
│       │       │   └── LoveNoteMessage (per bubble)
│       │       │       └── FullScreenImageViewer
│       │       └── MessageInput
│       │           └── ImagePreview
│       │
│       └── [scripture] ─ Lazy
│           └── ScriptureOverview
│               ├── ModeCard (Solo / Together)
│               ├── PartnerStatusSkeleton
│               ├── PartnerLinkMessage
│               └── SoloReadingFlow
│                   ├── BookmarkFlag
│                   ├── PerStepReflection
│                   └── ReflectionSummary
│
├── BottomNavigation (fixed, always visible)
│
├── PhotoUpload (modal, lazy)
├── PhotoCarousel (modal, lazy)
│   ├── PhotoCarouselControls
│   ├── PhotoEditModal
│   └── PhotoDeleteConfirmation
│
└── AdminPanel (route: /admin, lazy)
    ├── MessageList (admin)
    │   └── MessageRow
    ├── CreateMessageForm (modal)
    ├── EditMessageForm (modal)
    └── DeleteConfirmDialog (modal)
```

---

## Component Inventory Table

### Layout Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `App` | `src/App.tsx` | -- | Root component. Manages auth flow, routing via `currentView`, theme application, sync lifecycle, and service worker listeners. |

### Navigation Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `BottomNavigation` | `Navigation/` | `currentView: ViewType`, `onViewChange` | Fixed bottom tab bar with 7 tabs: Home, Mood, Notes, Partner, Photos, Scripture, Logout. Highlights active tab with pink/purple accent. |

### Error Handling Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `ErrorBoundary` | `ErrorBoundary/` | `children: ReactNode` | Global class-based error boundary. Catches render errors with retry and "Clear Storage & Reload" for validation corruption. |
| `ViewErrorBoundary` | `ViewErrorBoundary/` | `children`, `viewName: string`, `onNavigateHome` | View-scoped error boundary for lazy-loaded routes. Resets on view change. Detects offline/chunk errors. Keeps navigation visible. |
| `ViewErrorFallback` | `ViewErrorBoundary/` | `error`, `isOffline`, `viewName`, `onRetry`, `onNavigateHome` | Inline error UI showing "Go Home" and "Try Again" buttons. Internal to ViewErrorBoundary. |

### Authentication Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `LoginScreen` | `LoginScreen/` | `onLoginSuccess?` | Email/password login form with Google OAuth button. Client-side validation, error mapping, loading states. Uses custom CSS (not Tailwind). |
| `DisplayNameSetup` | `DisplayNameSetup/` | `isOpen: boolean`, `onComplete` | Post-OAuth modal prompting display name (3-30 chars). Updates Supabase `user_metadata` and upserts `users` table row. |

### Feature Components -- Home

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

### Feature Components -- Photos

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

### Feature Components -- Mood Tracking

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

### Feature Components -- Partner

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `PartnerMoodView` | `PartnerMoodView/` | -- | Partner connection and mood viewing. Two modes: connection UI (search, send/accept/decline requests) and connected view (mood list with real-time Supabase Realtime, connection status indicator, refresh). 25KB. |
| `MoodCard` | `PartnerMoodView/` | `moodEntry: MoodEntry`, `formatDate` | Memoized (`React.memo`) partner mood card with icon, label, date, time, and optional note. Internal to PartnerMoodView. |
| `PokeKissInterface` | `PokeKissInterface/` | `expandDirection?: 'up' \| 'down'` | Expandable FAB with Poke/Kiss/Fart/History action buttons. 30-minute cooldowns, notification badge for unviewed interactions, real-time subscription, animation overlays. |
| `PokeAnimation` | `PokeKissInterface/` | `onComplete` | Full-screen poke animation (nudge shake effect). Internal. |
| `KissAnimation` | `PokeKissInterface/` | `onComplete` | Full-screen floating hearts animation (7 hearts). Internal. |
| `FartAnimation` | `PokeKissInterface/` | `onComplete` | Full-screen fart animation (poop emoji + gas clouds). Internal. |
| `InteractionHistory` | `InteractionHistory/` | `isOpen`, `onClose` | Modal listing last 7 days of poke/kiss interactions with sent/received indicators, timestamps, "New" badges, and empty state. |

### Feature Components -- Love Notes

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `LoveNotes` | `love-notes/` | -- | Full chat page container. Header with back button, error banner, `MessageList`, and `MessageInput`. Fetches user/partner info from auth service. |
| `MessageList` | `love-notes/` | `notes`, `currentUserId`, `partnerName`, `userName`, `isLoading`, `onLoadMore`, `hasMore`, `onRetry` | Virtualized message list (react-window). Infinite scroll for older messages, auto-scroll on new messages, "New message" indicator, "Beginning of conversation" marker. |
| `LoveNoteMessage` | `love-notes/` | `note: LoveNote`, `isOwnMessage`, `senderName`, `onRetry?` | Chat bubble (coral for own, light gray for partner). Supports image attachments with inline display, signed URL refresh, full-screen viewer. Memoized. HTML sanitized via DOMPurify. |
| `MessageInput` | `love-notes/` | -- | Auto-resize textarea with character counter (visible at 900+, warning at 950, max 1000). Enter to send, Shift+Enter for newline, Escape to clear. Image attachment button, haptic feedback. |
| `ImagePreview` | `love-notes/` | `file: File`, `onRemove`, `isCompressing?` | Thumbnail preview of selected image before sending. Shows file size, compression indicator, remove button. Memoized. |
| `FullScreenImageViewer` | `love-notes/` | `imageUrl`, `isOpen`, `onClose`, `alt?` | Dark overlay modal for full-size image viewing. X button, tap-outside-to-close. Memoized. |

### Feature Components -- Scripture Reading

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

### Admin Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `AdminPanel` | `AdminPanel/` | `onExit?` | Admin dashboard for custom message management. Header with Export/Import/Create buttons, message list, create/edit/delete modals. Lazy-loaded on /admin route. |
| `MessageList` (admin) | `AdminPanel/` | `onEdit`, `onDelete` | Displays list of custom messages with MessageRow components. Connects to store for message data. |
| `MessageRow` | `AdminPanel/` | (message data, callbacks) | Single message row with edit/delete action buttons. |
| `CreateMessageForm` | `AdminPanel/` | `isOpen`, `onClose` | Modal form: text textarea (500 chars), category dropdown, active toggle. Validation via `isValidationError`. |
| `EditMessageForm` | `AdminPanel/` | `message: CustomMessage`, `isOpen`, `onClose` | Modal form pre-populated with existing message data for editing. |
| `DeleteConfirmDialog` | `AdminPanel/` | `message`, `isOpen`, `onConfirm`, `onCancel` | Destructive confirmation with warning icon. Calls `deleteCustomMessage` store action. |

### Settings Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `Settings` | `Settings/` | -- | Account settings screen with user email display, logout functionality, and AnniversarySettings section. Uses custom CSS. |
| `AnniversarySettings` | `Settings/` | -- | CRUD interface for anniversaries. Add/Edit/Delete forms with validation via `AnniversarySchema`, field-specific errors, responsive layout. |

### Shared / Utility Components

| Component | Folder | Props | Description |
|-----------|--------|-------|-------------|
| `NetworkStatusIndicator` | `shared/` | `className?`, `showOnlyWhenOffline?` | Banner indicator for offline/connecting/online states. Color-coded dots (green/yellow/red), ARIA live region, role="status". |
| `NetworkStatusDot` | `shared/` | `className?` | Compact inline dot variant for header integration. Pulse animation when connecting. |
| `SyncToast` | `shared/` | `syncResult`, `onDismiss`, `autoDismissMs?` | Toast notification for sync completion. Three variants: success (green), partial (yellow), failed (red). Auto-dismiss after 5s. Spring animation. |

---

## Feature Components

### Home View (Inline, Not Lazy-Loaded)

The home view renders inline to ensure it always works offline. It consists of:

- **TimeTogether**: Real-time count-up from the dating start date, updating every second. Displays years, days, hours, minutes, and seconds.
- **BirthdayCountdown** (x2): Countdown to each partner's birthday with upcoming age calculation. Detects birthday-today for celebration state.
- **EventCountdown**: Generic countdown for wedding (with "Date TBD" placeholder) and planned visits with description text.
- **DailyMessage**: The core daily love message experience. Swipeable card with category badges (reason/memory/affirmation/future/custom), favorite toggle with floating hearts animation, share via Web Share API with clipboard fallback, keyboard navigation, and swipe gestures.

### Photo Gallery and Management

The photo feature spans 10 components across 6 folders:

- **PhotoGallery** is the grid view with Intersection Observer-based infinite scroll (20 photos per page), skeleton loaders during fetch, and a floating upload FAB.
- **PhotoUpload** is a multi-step modal (select -> preview -> upload -> success) with client-side image compression.
- **PhotoCarousel** is a full-screen lightbox with spring animations, swipe/keyboard navigation, and drag constraints at boundaries.
- **PhotoEditModal** and **PhotoDeleteConfirmation** provide in-carousel editing and deletion with proper z-index layering (carousel: 50, edit: 60, delete: 70).
- **PhotoViewer** in PhotoGallery/ is an alternative full-screen viewer with focus trap support.

### Mood Tracking System

The mood system includes 10 components:

- **MoodTracker** offers a 12-mood selection grid (6 positive + 6 challenging), multi-select support, collapsible note field, three tabs (Log/Timeline/Calendar), sync status indicator, and offline retry with service worker background sync registration.
- **MoodHistoryTimeline** uses react-window for virtualized rendering of potentially thousands of mood entries with infinite scroll pagination and date-grouped headers.
- **MoodHistoryCalendar** provides a traditional month-grid view with color-coded mood dots, month navigation with 300ms debounce, and day-tap detail modal.
- **PartnerMoodDisplay** shows the partner's most recent mood with real-time updates via Supabase Broadcast API and a "Just now" badge for entries less than 5 minutes old.

### Partner View and Interactions

- **PartnerMoodView** serves dual purpose: partner connection management (search, send/accept/decline requests) when unlinked, and partner mood feed when connected. Features real-time Supabase Realtime subscription with connection status indicator (connected/reconnecting/disconnected).
- **PokeKissInterface** is an expandable FAB with Poke/Kiss/Fart action buttons, 30-minute cooldowns per action, notification badge for unviewed interactions, and three distinct full-screen animations. Subscribes to real-time interactions on mount.
- **InteractionHistory** modal displays the last 7 days of sent/received interactions with directional arrows, type icons, timestamps, and "New" badges.

### Love Notes (Real-Time Chat)

- **LoveNotes** is a full-page chat container assembling header, MessageList, and MessageInput. Fetches partner display name from the database (not local config).
- **MessageList** uses react-window for virtualized rendering with infinite scroll for loading older messages. Auto-scrolls to bottom on new messages with a "New message" jump indicator when scrolled up.
- **LoveNoteMessage** renders chat bubbles with coral (own) and light gray (partner) backgrounds, HTML sanitization via DOMPurify, image attachment support with signed URL refresh logic, and full-screen image viewing.
- **MessageInput** features an auto-resize textarea, character counter, Enter-to-send keyboard shortcuts, image attachment with compression preview, and Vibration API haptic feedback.

### Scripture Reading

The scripture feature uses a container/presentational architecture across 3 sub-directories:

- **ScriptureOverview** (container) handles partner status detection, mode selection (Solo/Together), session resume for incomplete sessions, and offline blocking. Uses the Lavender Dreams design theme (purple palette).
- **SoloReadingFlow** (container) manages the step-by-step reading experience with verse/response/reflection sub-views, progress tracking, exit confirmation, auto-save on visibility change and beforeunload, offline detection, retry UI, and auto-retry on reconnect.
- **BookmarkFlag** (presentational) provides a toggle for bookmarking individual verses.
- **PerStepReflection** (presentational) offers a 1-5 rating scale with keyboard-navigable radiogroup and optional notes.
- **ReflectionSummary** (presentational) presents bookmarked verse chips, session-level rating, and summary notes for end-of-session reflection.

### Admin Panel

- **AdminPanel** provides full CRUD for custom love messages with import/export (JSON file). Sub-components include MessageList, MessageRow, CreateMessageForm, EditMessageForm, and DeleteConfirmDialog.
- Only accessible via the `/admin` route. Lazy-loaded and excluded from the main navigation.

---

## Shared and Utility Components

### NetworkStatusIndicator

Two variants for different contexts:

- **Banner variant** (`NetworkStatusIndicator`): Full-width bar with icon, label, and description. Used at the top of the app with `showOnlyWhenOffline` to hide when online.
- **Dot variant** (`NetworkStatusDot`): Compact 10px circle for inline/header usage. Color-coded: green (#51CF66), yellow (#FCC419), red (#FF6B6B).

Both use the `useNetworkStatus` hook and provide ARIA live regions for screen reader announcements.

### SyncToast

Fixed-position toast (top-center, z-index: 100) for sync completion feedback. Three color variants based on result:
- **Full success**: Green with CheckCircle icon
- **Partial success**: Yellow with AlertCircle icon
- **All failed**: Red with AlertCircle icon

Auto-dismisses after 5 seconds with a manual dismiss button. Spring animation (stiffness: 500, damping: 30).

### LoadingSpinner

Inline component defined in `App.tsx` used as the Suspense fallback for all lazy-loaded routes. Centered full-screen pink spinning border circle.

---

## Design Patterns

### Barrel Exports

13 component folders use `index.ts` barrel exports for clean imports:

| Folder | Barrel Exports |
|--------|---------------|
| `CountdownTimer/` | `CountdownTimer` |
| `DisplayNameSetup/` | `DisplayNameSetup` |
| `InteractionHistory/` | `InteractionHistory` |
| `LoginScreen/` | `LoginScreen` |
| `MoodHistory/` | `MoodHistoryCalendar` |
| `PartnerMoodView/` | `PartnerMoodView` |
| `PokeKissInterface/` | `PokeKissInterface` |
| `RelationshipTimers/` | `TimeTogether`, `BirthdayCountdown`, `EventCountdown`, `RelationshipTimers` |
| `Settings/` | `Settings`, `AnniversarySettings` |
| `shared/` | `NetworkStatusIndicator`, `NetworkStatusDot`, `SyncToast`, `SyncResult` (type) |
| `love-notes/` | `LoveNotes` |
| `ViewErrorBoundary/` | `ViewErrorBoundary` |
| `scripture-reading/` | `ScriptureOverview` |

### Lazy Loading (Code Splitting)

7 components are lazy-loaded via `React.lazy()` with dynamic imports in `App.tsx`:

| Component | Import Path | Trigger |
|-----------|-------------|---------|
| `PhotoGallery` | `./components/PhotoGallery/PhotoGallery` | `currentView === 'photos'` |
| `MoodTracker` | `./components/MoodTracker/MoodTracker` | `currentView === 'mood'` |
| `PartnerMoodView` | `./components/PartnerMoodView/PartnerMoodView` | `currentView === 'partner'` |
| `AdminPanel` | `./components/AdminPanel/AdminPanel` | `/admin` route |
| `LoveNotes` | `./components/love-notes` | `currentView === 'notes'` |
| `ScriptureOverview` | `./components/scripture-reading` | `currentView === 'scripture'` |
| `WelcomeSplash` | `./components/WelcomeSplash/WelcomeSplash` | First visit / timer |
| `PhotoUpload` | `./components/PhotoUpload/PhotoUpload` | Upload button click |
| `PhotoCarousel` | `./components/PhotoCarousel/PhotoCarousel` | Photo selection |

All lazy views are wrapped in `<Suspense fallback={<LoadingSpinner />}>`.

### Error Boundaries

Two-tier error boundary strategy:

1. **Global ErrorBoundary**: Wraps LoginScreen, DisplayNameSetup, WelcomeSplash, and AdminPanel. Full-screen recovery UI. Detects validation errors and offers "Clear Storage & Reload".
2. **ViewErrorBoundary**: Wraps all lazy-loaded views inside `<main>`. Shows inline error UI that keeps `BottomNavigation` visible. Auto-resets when user navigates to a different view via `getDerivedStateFromProps`. Detects chunk loading errors and offline state for targeted messaging.

### Container / Presentational Pattern

The `scripture-reading/` feature uses explicit container/presentational separation:

- **Containers** (`containers/`): `ScriptureOverview`, `SoloReadingFlow` - Connect to Zustand store, manage state, handle side effects.
- **Presentational** (`reading/`, `reflection/`): `BookmarkFlag`, `PerStepReflection`, `ReflectionSummary` - Pure UI components accepting props, no store access.

### Memoization

Performance-critical components use `React.memo`:

- `MoodCard` in PartnerMoodView (partner mood list items)
- `CalendarDay` in MoodHistory (30+ cells per month)
- `LoveNoteMessage` in love-notes (chat bubbles in virtualized list)
- `ImagePreview` in love-notes (prevents re-renders during typing)
- `FullScreenImageViewer` in love-notes

### Virtualization (react-window)

Two components use react-window for large list performance:

- `MessageList` (love-notes): Chat messages with infinite scroll
- `MoodHistoryTimeline`: Mood entries with date-grouped sections

### Animation Library

All animations use **Framer Motion** (imported as `m as motion` for tree-shaking):

- `AnimatePresence` for mount/unmount transitions
- `motion.div` for element animations
- `layoutId` for shared layout animations (mood tab indicator)
- `drag` for swipe gestures (DailyMessage, PhotoCarousel)
- Spring physics: `type: 'spring'` with configurable stiffness/damping

### Accessibility Patterns

- ARIA live regions: `NetworkStatusIndicator`, `ScriptureOverview` (screen reader announcer)
- ARIA labels: All interactive elements (buttons, inputs, navigation)
- Focus management: `focus-visible` ring styles throughout scripture-reading feature
- Focus trapping: `PhotoViewer` (WCAG 2.4.3 compliance)
- Keyboard navigation: `DailyMessage` (ArrowLeft/Right), `PhotoCarousel` (ArrowLeft/Right/Escape), `PerStepReflection` (arrow keys in radiogroup)
- Touch targets: Minimum 48x48px for `BookmarkFlag`, 44x44px for scripture buttons
- Role attributes: `role="status"`, `role="alert"`, `role="dialog"`, `aria-modal`
- Form accessibility: `aria-required`, `aria-invalid`, `htmlFor` labels

---

## State Connections

The Zustand store (`useAppStore`) is composed of 10 slices. Below maps each component to the slices it consumes.

### AppSlice

**State**: `isLoading`, `error`, `__isHydrated`
**Actions**: `setLoading`, `setError`, `initializeApp`

| Component | Fields Used |
|-----------|-------------|
| `App` | `isLoading`, `initializeApp` |
| `DailyMessage` | `error`, `initializeApp` |

### MessagesSlice

**State**: `messages`, `currentMessage`, `messageHistory`, `customMessages`, `customMessagesLoaded`
**Actions**: `toggleFavorite`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward`, `loadCustomMessages`, `createCustomMessage`, `deleteCustomMessage`, `exportCustomMessages`, `importCustomMessages`

| Component | Fields Used |
|-----------|-------------|
| `DailyMessage` | `currentMessage`, `messageHistory`, `toggleFavorite`, `navigateToPreviousMessage`, `navigateToNextMessage`, `canNavigateBack`, `canNavigateForward` |
| `AdminPanel` | `loadCustomMessages`, `customMessagesLoaded`, `exportCustomMessages`, `importCustomMessages` |
| `CreateMessageForm` | `createCustomMessage` |
| `DeleteConfirmDialog` | `deleteCustomMessage` |

### PhotosSlice

**State**: `photos`, `selectedPhotoId`, `storageWarning`
**Actions**: `loadPhotos`, `uploadPhoto`, `updatePhoto`, `deletePhoto`, `selectPhoto`, `clearPhotoSelection`

| Component | Fields Used |
|-----------|-------------|
| `PhotoGallery` | `photos`, `loadPhotos` |
| `PhotoCarousel` | `photos`, `selectedPhotoId`, `selectPhoto`, `clearPhotoSelection`, `updatePhoto`, `deletePhoto` |
| `PhotoUpload` | `uploadPhoto`, `storageWarning` |

### SettingsSlice

**State**: `settings`, `isOnboarded`
**Actions**: `updateSettings`, `addAnniversary`, `removeAnniversary`

| Component | Fields Used |
|-----------|-------------|
| `App` | `settings` (theme application) |
| `DailyMessage` | `settings` (relationship anniversaries) |
| `AnniversarySettings` | `settings`, `addAnniversary`, `removeAnniversary`, `updateSettings` |

### NavigationSlice

**State**: `currentView`
**Actions**: `setView`, `navigateHome`

| Component | Fields Used |
|-----------|-------------|
| `App` | `currentView`, `setView` |
| `BottomNavigation` | receives `currentView` and `onViewChange` as props from App |
| `LoveNotes` | `navigateHome` |
| `ScriptureOverview` | `setView` (navigate to partner) |

### MoodSlice

**State**: `moods`, `syncStatus`
**Actions**: `addMoodEntry`, `getMoodForDate`, `loadMoods`, `syncPendingMoods`, `updateSyncStatus`

| Component | Fields Used |
|-----------|-------------|
| `App` | `syncPendingMoods`, `updateSyncStatus`, `syncStatus` |
| `MoodTracker` | `addMoodEntry`, `getMoodForDate`, `syncStatus`, `loadMoods`, `syncPendingMoods` |

### InteractionsSlice

**State**: `unviewedCount`
**Actions**: `sendPoke`, `sendKiss`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions`, `getInteractionHistory`, `loadInteractionHistory`

| Component | Fields Used |
|-----------|-------------|
| `PokeKissInterface` | `sendPoke`, `sendKiss`, `unviewedCount`, `getUnviewedInteractions`, `markInteractionViewed`, `subscribeToInteractions` |
| `InteractionHistory` | `getInteractionHistory`, `loadInteractionHistory` |

### PartnerSlice

**State**: `partner`, `isLoadingPartner`, `partnerMoods`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`
**Actions**: `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest`, `fetchPartnerMoods`

| Component | Fields Used |
|-----------|-------------|
| `PartnerMoodView` | `partner`, `isLoadingPartner`, `partnerMoods`, `fetchPartnerMoods`, `sentRequests`, `receivedRequests`, `searchResults`, `isSearching`, `loadPartner`, `loadPendingRequests`, `searchUsers`, `clearSearch`, `sendPartnerRequest`, `acceptPartnerRequest`, `declinePartnerRequest` |
| `ScriptureOverview` | `partner`, `isLoadingPartner`, `loadPartner` |

### NotesSlice

**Actions**: Used indirectly via `useLoveNotes` hook

| Component | Fields Used |
|-----------|-------------|
| `LoveNotes` | via `useLoveNotes` hook |
| `MessageInput` | via `useLoveNotes` hook |

### ScriptureReadingSlice

**State**: `session`, `scriptureLoading`, `scriptureError`, `activeSession`, `isCheckingSession`
**Actions**: `createSession`, `loadSession`, `abandonSession`, `clearScriptureError`, `checkForActiveSession`

| Component | Fields Used |
|-----------|-------------|
| `ScriptureOverview` | `session`, `scriptureLoading`, `scriptureError`, `activeSession`, `isCheckingSession`, `createSession`, `loadSession`, `abandonSession`, `clearScriptureError`, `checkForActiveSession` |
| `SoloReadingFlow` | `session` (current step, status), save/advance actions |

---

## Component Statistics

| Metric | Count |
|--------|-------|
| Total .tsx component files | 53 (excluding tests) |
| Test files (.test.tsx) | 12 |
| Component folders | 24 |
| Barrel export files (index.ts) | 13 |
| Lazy-loaded components | 9 |
| Store-connected components | ~25 |
| Memoized components (React.memo) | 5 |
| Virtualized lists (react-window) | 2 |
| Class-based components | 2 (ErrorBoundary, ViewErrorBoundary) |
| Zustand store slices | 10 |
