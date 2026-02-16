# Feature Components

## Home View (Inline, Not Lazy-Loaded)

The home view renders inline (not lazy-loaded) to guarantee offline availability. It consists of:

- **TimeTogether** (`RelationshipTimers/TimeTogether.tsx`, 98 lines): Real-time count-up from `RELATIONSHIP_DATES.datingStart` using `calculateTimeDifference()`. Updates every 1 second via `setInterval`. Displays years and days in large text, hours:minutes:seconds in `tabular-nums` font with zero-padded values. Seconds digit uses `animate-pulse`. Uses `m as motion` for hover scale effect.

- **BirthdayCountdown** (`RelationshipTimers/BirthdayCountdown.tsx`, 132 lines): Countdown to next birthday with upcoming age calculation. Uses `calculateTimeDifference()` with 1-second updates. Cake icon (Lucide). Detects birthday-today for celebration state with scale bounce animation. Displays calendar days + HH:MM:SS.

- **EventCountdown** (`RelationshipTimers/EventCountdown.tsx`, 181 lines): Generic event countdown supporting three icon types: `ring` (Gem/amber), `plane` (Plane/blue), `calendar` (Calendar/green). Each type has distinct color themes for bg, text, and border. Shows `XX:XX:XX` placeholder when date is null. Calculates calendar days using midnight-to-midnight comparison. Detects event-today with green celebration styling.

- **DailyMessage** (`DailyMessage/DailyMessage.tsx`, 378 lines): The core daily love message experience. Features include:
  - Swipe gestures via Framer Motion `drag="x"` with `onDragEnd` threshold detection
  - Category badges (reason/memory/affirmation/future/custom) with color coding
  - Favorite toggle with floating hearts animation (using `AnimatePresence`)
  - Share via `navigator.share()` Web Share API with `navigator.clipboard.writeText()` fallback
  - Keyboard navigation: ArrowLeft (previous) and ArrowRight (next)
  - Store connections: `currentMessage`, `settings`, `messageHistory`, `toggleFavorite`, navigation actions

- **CountdownTimer** (`CountdownTimer/CountdownTimer.tsx`, 294 lines): Anniversary countdown with celebration animations. Uses `getUpcomingAnniversaries()` to filter and sort. 60-second update interval for battery optimization. Celebration detection via `shouldTriggerCelebration()` with 3-second celebration timeout. `CelebrationAnimation` uses `generateDeterministicNumbers()` for consistent random positions across renders. Configurable via `ANIMATION_TIMING` and `ANIMATION_VALUES` constants.

- **WelcomeSplash** (`WelcomeSplash/WelcomeSplash.tsx`, 117 lines): Full-screen welcome with raining hearts (15 heart emojis, 4-6 second fall duration, random horizontal drift). `useMemo` for stable heart configs. Gradient background (pink-50/rose-50/purple-50). Spring-animated center Heart icon. Staggered content entrance (0.4s, 0.6s, 0.8s delays).

- **WelcomeButton** (`WelcomeButton/WelcomeButton.tsx`, 68 lines): Fixed-position FAB (bottom-8 right-8, z-50). Tooltip on hover (desktop only via `hidden md:block`). Infinite pulse ring animation (2s loop, scale 1->1.3->1). Heart icon with fill. Spring entrance with 0.5s delay.

## Photo Gallery and Management

The photo feature spans 10 components across 6 folders:

- **PhotoGallery** (`PhotoGallery/PhotoGallery.tsx`, 323 lines): Responsive grid (3-col mobile / 4-col desktop via Tailwind `grid-cols-3 sm:grid-cols-4`). IntersectionObserver-based infinite scroll with 20 photos per page. Skeleton loaders during fetch (`PhotoGridSkeleton`). Empty state with upload prompt. Error state with retry button. Floating upload FAB (bottom-right). Uses `usePhotos` hook (not direct store).

- **PhotoGridItem** (`PhotoGallery/PhotoGridItem.tsx`, 122 lines): Square aspect-ratio thumbnails (`aspect-square`). Lazy image loading via IntersectionObserver with `rootMargin: '200px'` for preloading. Caption overlay on hover/focus. Owner badge distinguishing user vs partner photos.

- **PhotoViewer** (`PhotoGallery/PhotoViewer.tsx`, 561 lines): Full-screen modal (z-50) with comprehensive touch interaction:
  - Focus trap for WCAG 2.4.3 compliance
  - Pinch-to-zoom with double-tap zoom toggle
  - Swipe left/right for navigation
  - Swipe-down-to-close gesture
  - Photo preloading (preloads previous and next images)
  - Delete with RLS permission checking
  - Edit caption and tags inline

- **PhotoUpload** (`PhotoUpload/PhotoUpload.tsx`, 458 lines): Multi-step modal flow:
  1. Select: File picker (JPEG/PNG/WebP, 50MB max)
  2. Preview: Image display with caption (500 chars) and tags (max 10) inputs
  3. Uploading: Progress bar with percentage
  4. Success/Error: Completion state with appropriate messaging
  Uses `imageCompressionService` for client-side compression. Storage warning banner from store.

- **PhotoCarousel** (`PhotoCarousel/PhotoCarousel.tsx`, 224 lines): Full-screen lightbox with spring physics (stiffness: 300, damping: 30). `drag="x"` with boundary constraints. Swipe threshold for navigation. Swipe-down-to-close. Integrates PhotoEditModal and PhotoDeleteConfirmation via state management.

- **PhotoEditModal** (`PhotoEditModal/PhotoEditModal.tsx`, 321 lines): z-index 60 (above carousel at 50). Caption textarea (500 chars with `maxLength`). Tags input (comma-separated). Client-side validation (caption length, tag count/length) + server-side validation via `isValidationError()`. Change detection: Save button only enabled when `hasChanges()` returns true AND validation passes. Uses `queueMicrotask` for image URL state updates.

- **PhotoDeleteConfirmation** (`PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx`, 133 lines): z-index 70 (above edit modal). Warning icon and message. Red "Delete" button. Cancel option. Backdrop click to close.

## Mood Tracking System

The mood system includes 9 components across 2 folders:

- **MoodTracker** (`MoodTracker/MoodTracker.tsx`, 579 lines): Central mood logging component with:
  - 12 mood buttons in 3x4 grid (6 positive: happy, grateful, loved, excited, peaceful, hopeful; 6 challenging: sad, anxious, frustrated, lonely, tired, overwhelmed)
  - Multi-select support (select multiple moods at once)
  - Optional collapsible note field (200 chars)
  - Three tabs: Log, Timeline, Calendar (animated indicator via `layoutId`)
  - Sync status display (pending/syncing/synced/error)
  - Offline error handling with retry
  - Background sync registration via `navigator.serviceWorker.ready.then(reg => reg.sync.register())`
  - Haptic feedback via Vibration API

- **MoodHistoryTimeline** (`MoodTracker/MoodHistoryTimeline.tsx`, 226 lines): Virtualized timeline using react-window `List` with `useInfiniteLoader`. Variable row heights based on content. `groupMoodsByDate()` utility for date-grouped sections. Internal sub-components: `DateHeader` (section separator), `LoadingSpinner`, `EmptyMoodHistoryState`.

- **MoodHistoryCalendar** (`MoodHistory/MoodHistoryCalendar.tsx`, 333 lines): Traditional month-grid view. Month navigation with 300ms debounce to prevent rapid API calls. Uses `moodService.getMoodsInRange()` for efficient data loading. `useMemo` for day cell computation. `performance.now()` timing for render performance measurement. Composes `CalendarDay` (memoized) and `MoodDetailModal`.

- **CalendarDay** (`MoodHistory/CalendarDay.tsx`, 135 lines): Wrapped in `React.memo` for performance (30+ cells per month). `MOOD_CONFIG` maps 12 mood types to colors and emojis. Today highlighting with ring style. Mood color dot indicator. Click handler triggers `MoodDetailModal`.

- **PartnerMoodDisplay** (`MoodTracker/PartnerMoodDisplay.tsx`, 165 lines): Shows partner's current mood with real-time updates via `usePartnerMood` hook (Supabase Broadcast). Displays emoji, label, relative timestamp, optional note. "Just now" badge for entries < 5 minutes old. Loading skeleton while fetching.

## Partner View and Interactions

- **PartnerMoodView** (`PartnerMoodView/PartnerMoodView.tsx`, 670 lines): Dual-mode component:
  - **Unconnected mode**: User search, send/accept/decline partner requests, pending request display
  - **Connected mode**: Partner mood feed with real-time Supabase Realtime subscription via `moodSyncService`, connection status indicator (connected/reconnecting/disconnected), refresh button
  - Store connections: 15+ selectors from PartnerSlice (partner, moods, requests, search)
  - `MoodCard` internal sub-component (memoized via `React.memo`)

- **PokeKissInterface** (`PokeKissInterface/PokeKissInterface.tsx`, 582 lines): Expandable floating action button with:
  - 4 action buttons: Poke (hand icon), Kiss (lips icon), Fart (wind icon), History (clock icon)
  - 30-minute cooldown per action type (tracked in `lastInteractions` state with timestamps)
  - Notification badge showing unviewed interaction count
  - Real-time subscription on mount via `subscribeToInteractions`
  - Three full-screen animation overlays: `PokeAnimation` (nudge shake), `KissAnimation` (7 floating hearts), `FartAnimation` (poop emoji + gas clouds)
  - `expandDirection` prop for positioning flexibility

- **InteractionHistory** (`InteractionHistory/InteractionHistory.tsx`, 220 lines): Modal listing last 7 days of poke/kiss/fart interactions. Sent vs received indicators with directional arrows. Type-specific icons. Timestamps. "New" badges for unviewed. Empty state message.

## Love Notes (Real-Time Chat)

- **LoveNotes** (`love-notes/LoveNotes.tsx`, 134 lines): Full-page chat container. Header with back button (navigates home via `navigateHome`). Error banner with dismiss. Fetches `currentUserId`, `userName` from `authService.getUser()` and `partnerName` from `getPartnerDisplayName()` on mount. Composes `MessageList` and `MessageInput`.

- **MessageList** (`love-notes/MessageList.tsx`, 409 lines): Virtualized with react-window v2 `List` component:
  - `useListRef(null)` for v2 API access
  - `useInfiniteLoader` with threshold: 10, minimumBatchSize: 50
  - Variable row heights via `calculateRowHeight()` considering content length and image presence
  - Auto-scroll to bottom on initial load via `scrollToRow({ align: 'end', index })`
  - New message handling: auto-scroll if at bottom, "New message" indicator if scrolled up
  - "Beginning of conversation" marker when all history loaded
  - `MessageRow` internal component extracted outside for react-window performance
  - `BeginningOfConversation` and `LoadingSpinner` internal components

- **LoveNoteMessage** (`love-notes/LoveNoteMessage.tsx`, 328 lines): Memoized (`React.memo`) chat bubble:
  - Own messages: coral (#FF6B6B) background, right-aligned, `rounded-br-md`
  - Partner messages: light gray (#E9ECEF) background, left-aligned, `rounded-bl-md`
  - XSS sanitization via `DOMPurify.sanitize(content, { ALLOWED_TAGS: [], KEEP_CONTENT: true })`
  - Image support: signed URL fetch via `getSignedImageUrl()`, retry on 403 (max 2 retries, `MAX_IMAGE_RETRIES`), loading/error states, full-screen viewer on tap
  - Optimistic update indicators: "Sending..." text, error state with "Failed to send - Tap to retry"
  - ARIA: `role="listitem"`, descriptive `aria-label` with sender and timestamp

- **MessageInput** (`love-notes/MessageInput.tsx`, 289 lines): Rich input component:
  - Auto-resize textarea (rows=1, max-h-200px, `overflow-y-auto`)
  - Character counter: visible at 900+ chars, warning yellow at 950, red at 1001+
  - Keyboard shortcuts: Enter (send), Shift+Enter (newline), Escape (clear input + image)
  - Image picker: `accept="image/jpeg,image/png,image/webp"`, validation via `imageCompressionService.validateImageFile()`
  - Haptic feedback: 50ms success pulse, [100,50,100] error double-pulse via `useVibration` hook
  - Send validation: requires text content OR image, not over character limit

- **ImagePreview** (`love-notes/ImagePreview.tsx`, 133 lines): Memoized preview thumbnail:
  - Object URL creation with `queueMicrotask` scheduling and cleanup
  - Original file size + estimated compressed size display
  - Compression indicator for files > threshold
  - Remove button (X icon) with disabled state during compression
  - `AnimatePresence` entrance/exit animation

- **FullScreenImageViewer** (`love-notes/FullScreenImageViewer.tsx`, 129 lines): Memoized modal:
  - Dark overlay (bg-black/90) with click-to-close
  - Focus management: stores `previousFocusRef`, auto-focuses close button, restores on close
  - ESC key handler
  - Body scroll lock (`document.body.style.overflow = 'hidden'`)
  - Scale entrance animation (0.9 -> 1.0)

## Scripture Reading

The scripture feature uses container/presentational architecture across 3 sub-directories with a Lavender Dreams design theme (purple palette: primary #A855F7, background #F3E5F5):

- **ScriptureOverview** (`containers/ScriptureOverview.tsx`, 472 lines): Entry container connecting to both PartnerSlice and ScriptureReadingSlice via `useShallow`. Features:
  - Partner status detection (loading/linked/unlinked) with skeleton and link prompts
  - Start button -> mode selection reveal with `AnimatePresence` animation
  - Solo mode (always available when online) and Together mode (requires linked partner)
  - Resume prompt for incomplete sessions ("Continue where you left off? Step X of 17")
  - "Start fresh" calls `abandonSession` to mark server session as abandoned
  - Offline blocking: Start button disabled, indicator shown
  - Screen reader announcer (`aria-live="polite"`, `aria-atomic="true"`)
  - Internal components: `ModeCard`, `PartnerStatusSkeleton`, `PartnerLinkMessage`, `SoloIcon`, `TogetherIcon`

- **SoloReadingFlow** (`containers/SoloReadingFlow.tsx`, 1441 lines): The largest component in the codebase. Container managing:
  - Verse/response/reflection sub-views with slide animations
  - Step navigation with `AnimatePresence mode="wait"` and custom slide direction
  - Progress tracking ("Verse X of 17", `aria-current="step"`)
  - Exit confirmation dialog with focus trap (Tab cycling, Escape to close)
  - Auto-save via `useAutoSave` hook (visibility change + beforeunload)
  - Offline detection with blocked advancement (`isNextDisabled = isSyncing || !isOnline`)
  - Retry UI with auto-retry on reconnect (tracks `prevIsOnlineRef` for transition detection)
  - Bookmark toggle: optimistic UI with 300ms debounced server write (`last-write-wins`)
  - Reflection submission: non-blocking save via `scriptureReadingService.addReflection()`
  - Reflection summary phase: bookmarked verse chips, session rating, notes, bookmark sharing toggle
  - Report phase with 4 sub-phases: compose, report, complete-unlinked, completion-error
  - Session completion: 2-attempt retry, phase persistence
  - `LazyMotion` with dynamic import of `motionFeatures.ts` for tree-shaking
  - Comprehensive screen reader announcements and focus management (8+ useEffect hooks)

- **BookmarkFlag** (`reading/BookmarkFlag.tsx`, 49 lines): Pure presentational toggle:
  - Lucide `Bookmark` icon with fill toggle
  - Amber color when bookmarked, purple when not
  - `aria-pressed` and toggling `aria-label`
  - 48x48px minimum touch target
  - `FOCUS_RING` styles for keyboard visibility

- **PerStepReflection** (`reflection/PerStepReflection.tsx`, 206 lines): Post-step reflection:
  - 1-5 rating scale as `role="radiogroup"` with `role="radio"` buttons
  - Arrow key navigation (left/right with wrapping)
  - End labels: "A little" (1) and "A lot" (5)
  - Optional note textarea (200 chars, counter at 150+ via `getCharCounterThreshold()`)
  - Quiet validation: "Please select a rating" on Continue without selection
  - `aria-disabled` instead of `disabled` on Continue so click event fires for validation

- **ReflectionSummary** (`reflection/ReflectionSummary.tsx`, 312 lines): End-of-session:
  - Bookmarked verse chips as selectable buttons (`aria-pressed`)
  - No-bookmark fallback: "You didn't mark any verses -- that's okay"
  - Share bookmarks checkbox (toggle for partner visibility)
  - Session-level 1-5 rating (same radiogroup pattern as PerStepReflection)
  - Optional note (200 chars, counter at 150+)
  - Multi-field validation messages
  - Focus heading on mount via `requestAnimationFrame`

- **MessageCompose** (`reflection/MessageCompose.tsx`, 144 lines): Partner message:
  - "Write something for [Partner Name]" heading
  - Textarea: max 300 chars, auto-grow (min 120px, max ~192px), counter at 250+
  - Send button (disabled when empty)
  - "Skip for now" tertiary link (no-guilt language)
  - Optional auto-focus on mount (configurable by parent)
  - Keyboard: scroll-into-view on focus for mobile

- **DailyPrayerReport** (`reflection/DailyPrayerReport.tsx`, 232 lines): Report display:
  - Step-by-step ratings with bookmark indicators (amber SVG bookmark icons)
  - Side-by-side partner ratings when available (lighter purple circles)
  - Standout verse chips (user: solid purple, partner: outline purple)
  - Partner message in `font-cursive` container
  - User message in standard container
  - "Waiting for [partner]'s reflections" with `motion-safe:animate-pulse`
  - "Return to Overview" primary button

## Admin Panel

- **AdminPanel** (`AdminPanel/AdminPanel.tsx`, 192 lines): Admin dashboard with:
  - Header: Export JSON (download), Import JSON (file picker), Create button
  - Auto-loads custom messages on mount if not already loaded
  - Sub-component composition: MessageList + CRUD modals
  - Lazy-loaded on /admin route, excluded from main navigation

- **MessageList (admin)** (`AdminPanel/MessageList.tsx`, 157 lines): Category filter dropdown. Search input for text filtering. `useMemo` for filtered and sorted results. Renders `MessageRow` per entry.

- **MessageRow** (`AdminPanel/MessageRow.tsx`, 106 lines): Truncated text preview (single line with ellipsis). Category label with color coding. Type badge (custom/default). Draft badge when inactive. Edit (Pencil icon) and Delete (Trash2 icon) action buttons.

- **CreateMessageForm** (`AdminPanel/CreateMessageForm.tsx`, 240 lines): Modal with text textarea (500 chars `maxLength`), `MessageCategory` dropdown, active/draft toggle. Validation via `isValidationError()` with field-specific error display. Loading state during submission.

- **EditMessageForm** (`AdminPanel/EditMessageForm.tsx`, 262 lines): Modal pre-populated from existing message. Tracks `hasChanges` to enable/disable Save. Same validation as Create.

- **DeleteConfirmDialog** (`AdminPanel/DeleteConfirmDialog.tsx`, 97 lines): Warning icon + message preview. Destructive "Delete" button (red). Cancel option.

---
