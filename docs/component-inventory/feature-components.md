# Feature Components

## Home View (Inline, Not Lazy-Loaded)

The home view renders inline (not lazy-loaded) to guarantee offline availability. It consists of:

- **TimeTogether** (`RelationshipTimers/TimeTogether.tsx`, ~98 lines): Real-time count-up from `RELATIONSHIP_DATES.datingStart` using `calculateTimeDifference()`. Updates every 1 second via `setInterval`. Displays years and days in large text, hours:minutes:seconds in `tabular-nums` font with zero-padded values. Seconds digit uses `animate-pulse`. Uses `m as motion` for hover scale effect.

- **BirthdayCountdown** (`RelationshipTimers/BirthdayCountdown.tsx`, ~132 lines): Countdown to next birthday with upcoming age calculation. Uses `calculateTimeDifference()` with 1-second updates. Cake icon (Lucide). Detects birthday-today for celebration state with scale bounce animation. Displays calendar days + HH:MM:SS.

- **EventCountdown** (`RelationshipTimers/EventCountdown.tsx`, ~181 lines): Generic event countdown supporting three icon types: `ring` (Gem/amber), `plane` (Plane/blue), `calendar` (Calendar/green). Each type has distinct color themes for bg, text, and border. Shows `XX:XX:XX` placeholder when date is null. Calculates calendar days using midnight-to-midnight comparison. Detects event-today with green celebration styling.

- **DailyMessage** (`DailyMessage/DailyMessage.tsx`, 375 lines): The core daily love message experience. Features include:
  - Swipe gestures via Framer Motion `drag="x"` with `onDragEnd` threshold detection (50px)
  - Category badges (reason/memory/affirmation/future/custom) with color coding
  - Favorite toggle with floating hearts animation (using `AnimatePresence`)
  - Share via `navigator.share()` Web Share API with `navigator.clipboard.writeText()` fallback
  - Keyboard navigation: ArrowLeft (previous) and ArrowRight (next)
  - 10-second loading timeout with retry button
  - Store connections: `currentMessage`, `settings`, `messageHistory`, `toggleFavorite`, navigation actions

- **CountdownTimer** (`CountdownTimer/CountdownTimer.tsx`, 275 lines): Anniversary countdown with celebration animations. Uses `getUpcomingAnniversaries()` to filter and sort. 60-second update interval for battery optimization. Celebration detection via `shouldTriggerCelebration()` with 3-second celebration timeout. `CelebrationAnimation` uses `generateDeterministicNumbers()` for consistent random positions across renders.

- **WelcomeSplash** (`WelcomeSplash/WelcomeSplash.tsx`, 120 lines): Full-screen welcome with raining hearts (15 heart emojis, 4-6 second fall duration, random horizontal drift). `useMemo` for stable heart configs. Gradient background (pink-50/rose-50/purple-50). Spring-animated center Heart icon. Staggered content entrance.

- **WelcomeButton** (`WelcomeButton/WelcomeButton.tsx`, 68 lines): Fixed-position FAB (bottom-8 right-8, z-50). Tooltip on hover (desktop only via `hidden md:block`). Infinite pulse ring animation (2s loop). Heart icon with fill. Spring entrance.

## Photo Gallery and Management

The photo feature spans 10 components across 6 folders:

- **PhotoGallery** (`PhotoGallery/PhotoGallery.tsx`, ~323 lines): Responsive grid (3-col mobile / 4-col desktop). IntersectionObserver-based infinite scroll with 20 photos per page. Skeleton loaders during fetch (`PhotoGridSkeleton`). Empty state with upload prompt. Error state with retry. Floating upload FAB. Uses `usePhotos` hook.

- **PhotoGridItem** (`PhotoGallery/PhotoGridItem.tsx`, ~122 lines): Square aspect-ratio thumbnails. Lazy image loading via IntersectionObserver with `rootMargin: '200px'` for preloading. Caption overlay on hover/focus. Owner badge distinguishing user vs partner photos.

- **PhotoViewer** (`PhotoGallery/PhotoViewer.tsx`, ~561 lines): Full-screen modal (z-50) with touch interaction:
  - Focus trap for WCAG compliance
  - Pinch-to-zoom with double-tap zoom toggle
  - Swipe left/right for navigation, swipe-down-to-close
  - Photo preloading (preloads previous and next images)
  - Delete with RLS permission checking
  - Edit caption and tags inline

- **PhotoUpload** (`PhotoUpload/PhotoUpload.tsx`, 458 lines): Multi-step modal flow: Select -> Preview -> Uploading -> Success/Error. Uses `imageCompressionService` for client-side compression. Storage warning banner from store. Caption (500 chars) and tags (max 10) inputs.

- **PhotoCarousel** (`PhotoCarousel/PhotoCarousel.tsx`, ~180 lines): Modal carousel that renders when a photo is selected. Controlled by `selectedPhotoId` from store. Prev/next navigation with `PhotoCarouselControls`. Integrates `PhotoEditModal` and `PhotoDeleteConfirmation`.

- **PhotoUploader** (`photos/PhotoUploader.tsx`, 482 lines): Alternative upload component using `usePhotos` + `useImageCompression` hooks. Provides a different upload UX path.

## Mood Tracking System

The mood feature spans 9 components across 2 folders:

- **MoodTracker** (`MoodTracker/MoodTracker.tsx`, ~350 lines): Main container with 3 tabs: Log, Timeline, Calendar. 12 mood buttons arranged in a 3x4 grid (6 positive: loved, happy, content, excited, thoughtful, grateful; 6 challenging: sad, anxious, frustrated, angry, lonely, tired). Multi-select support (select multiple moods per entry). Optional note input. Offline-safe saves via `getCurrentUserIdOfflineSafe()`. Background sync registration. Haptic feedback on save/error.

- **MoodButton** (`MoodTracker/MoodButton.tsx`): Individual mood selection button with Framer Motion scale animation (1.1x when selected). Pink when selected, gray when not. Lucide icons per mood.

- **MoodHistoryTimeline** (`MoodTracker/MoodHistoryTimeline.tsx`): react-window virtualized list with infinite scroll. Uses `useMoodHistory` hook for paginated data (50 per page). Internal sub-components: DateHeader, MoodHistoryItem, LoadingSpinner, EmptyMoodHistoryState.

- **PartnerMoodDisplay** (`MoodTracker/PartnerMoodDisplay.tsx`): Real-time partner mood using `usePartnerMood` hook (Supabase Broadcast API). Connection status indicator (connecting/connected/disconnected). Falls back to `NoMoodLoggedState` when no data.

- **MoodHistoryCalendar** (`MoodHistory/MoodHistoryCalendar.tsx`): Month grid view. Navigable months with prev/next. Uses `CalendarDay` (memoized) per cell with mood dot colors. Click to open `MoodDetailModal` for full-day detail.

## Partner View and Interactions

- **PartnerMoodView** (`PartnerMoodView/PartnerMoodView.tsx`, 669 lines): Dual-mode component:
  - **Connection mode**: User search, send partner request, accept/decline requests. Uses partner slice actions (searchUsers, sendPartnerRequest, acceptPartnerRequest, declinePartnerRequest).
  - **Mood feed mode**: After partner is linked, shows partner's mood entries as `MoodCard` list (memoized), real-time mood updates via Supabase Broadcast, connection status indicator, refresh button. Integrates `PokeKissInterface` for interactions.

- **PokeKissInterface** (`PokeKissInterface/PokeKissInterface.tsx`, 582 lines): Expandable FAB with three interaction types: poke, kiss, fart. Full-screen animations for each type. Cooldown timer between sends. Vibration feedback via `useVibration` hook. Unviewed interaction count badge. Opens `InteractionHistory` modal.

- **InteractionHistory** (`InteractionHistory/InteractionHistory.tsx`, 214 lines): Modal showing last 7 days of poke/kiss interactions. Sent (pink) vs received (purple) color coding. Direction indicators (arrows). Relative timestamps. "New" badge for unviewed received interactions.

## Love Notes (Real-Time Chat)

- **LoveNotes** (`love-notes/LoveNotes.tsx`, ~200 lines): Full chat page container. Header with back navigation and partner name (fetched from database via `getPartnerDisplayName`). Composes `MessageList` + `MessageInput`. Error banner with clear action. Uses `useLoveNotes` hook which integrates `useRealtimeMessages` for real-time delivery.

- **MessageList** (`love-notes/MessageList.tsx`, ~300 lines): react-window v2 virtualized list. Auto-scroll to bottom on new messages. Infinite scroll up for pagination. Internal sub-components: MessageRow, BeginningOfConversation, LoadingSpinner. Renders `LoveNoteMessage` per row.

- **LoveNoteMessage** (`love-notes/LoveNoteMessage.tsx`, ~250 lines): Memoized chat bubble. Own messages right-aligned (pink), partner messages left-aligned (gray). DOMPurify sanitization for XSS prevention. Image display with click-to-expand (`FullScreenImageViewer`). Sending state (dimmed + spinner). Failed state (red border + retry/remove buttons). Timestamp display.

- **MessageInput** (`love-notes/MessageInput.tsx`, ~200 lines): Auto-resize textarea. Image picker button (camera icon). Send button (disabled when empty). Character limit display. Image preview via `ImagePreview` component. Rate limiting (10 messages/minute enforced by store).

- **ImagePreview** (`love-notes/ImagePreview.tsx`): Memoized thumbnail preview of selected image file with file size display and remove button.

- **FullScreenImageViewer** (`love-notes/FullScreenImageViewer.tsx`): Memoized full-screen modal for viewing images. Click backdrop or press Escape to close.

## Scripture Reading

The scripture reading feature is the largest feature area with 13 component files across 5 subdirectories, plus 3 hooks.

### Solo Mode (Stories 1.1-1.5)

- **ScriptureOverview** (`containers/ScriptureOverview.tsx`, ~400 lines): Main entry point with "Lavender Dreams" purple theme. Features:
  - Partner status detection (loading/linked/unlinked)
  - Start button -> mode selection reveal (Solo always available, Together conditional)
  - Session resume for incomplete solo sessions (with "Start fresh" abandon option)
  - `StatsSection` for couple-aggregate stats
  - Offline blocking of Start/mode selection buttons
  - Routes to `SoloReadingFlow`, `LobbyContainer`, or `ReadingContainer` based on session state

- **SoloReadingFlow** (`containers/SoloReadingFlow.tsx`, ~600 lines): Step-by-step reading flow with `LazyMotion` wrapper. Features:
  - Verse screen and response screen per step, toggled via tabs
  - Step navigation (Next verse / View response / Back to verse)
  - Progress tracking ("Verse X of 17")
  - Exit confirmation dialog with save
  - `BookmarkFlag` per verse
  - Session completion transitions to reflection phase
  - `useAutoSave` for visibility change / beforeunload saves
  - Offline indicator and blocked advancement
  - Retry UI for failed server writes with auto-retry on reconnect
  - `ReflectionSummary` -> `MessageCompose` -> `DailyPrayerReport` flow

- **StatsSection** (`overview/StatsSection.tsx`, ~200 lines): Presentational component displaying couple-aggregate stats. Five stat cards: total sessions, total steps, average rating, bookmarks, last active date. Zero-state messaging when no sessions exist. Relative date formatting.

### Together Mode (Stories 4.1, 4.2, 4.3)

- **LobbyContainer** (`containers/LobbyContainer.tsx`, ~300 lines): Three-phase lobby orchestration:
  - **Phase A** (Role Selection): `session.currentPhase === 'lobby' && !myRole`. Two role cards: Reader (BookOpen icon) and Responder (MessageCircle icon).
  - **Phase B** (Lobby Waiting): Role selected, waiting for partner. Ready toggle button. Partner status indicators. "Convert to solo" fallback.
  - **Phase C** (Countdown): Both users ready. `Countdown` component with 3-second synchronized countdown.

- **ReadingContainer** (`containers/ReadingContainer.tsx`, ~400 lines): Together-mode reading with:
  - `RoleIndicator` showing alternating reader/responder per step
  - Verse / response navigation tabs
  - `LockInButton` + waiting state
  - `PartnerPosition` via `useScripturePresence` hook
  - Step advance animation (slide-left on lock-in complete)
  - "Session updated" toast on 409 version mismatch
  - `DisconnectionOverlay` when partner drops

- **Countdown** (`session/Countdown.tsx`, ~100 lines): 3-second synchronized countdown derived from server UTC timestamp. Auto-corrects clock skew. Reduced-motion support (instant number swap). Focus management on mount. aria-live="assertive" for screen reader announcements.

- **LockInButton** (`session/LockInButton.tsx`, ~100 lines): Four states: Unlocked ("Ready for next verse"), Locked ("Waiting for partner..." + undo link), Partner locked (green check indicator), Pending (loading/disabled). Disconnected + unlocked shows "Holding your place" disabled state.

- **DisconnectionOverlay** (`session/DisconnectionOverlay.tsx`, ~120 lines): Two-phase overlay:
  - Phase A (<30s): "Partner reconnecting..." with WifiOff icon and pulse animation
  - Phase B (>=30s): "Partner seems to have stepped away" with Keep Waiting / End Session buttons. End Session requires confirmation click.

- **RoleIndicator** (`reading/RoleIndicator.tsx`, ~30 lines): Pill badge. Reader: primary purple (#A855F7), "You read this". Responder: lighter purple (#C084FC), "Partner reads this".

- **PartnerPosition** (`reading/PartnerPosition.tsx`, ~40 lines): Shows where partner is looking (verse or response). Eye icon. Renders nothing when presence is null. Uses `PartnerPresenceInfo` from `useScripturePresence` hook.

- **BookmarkFlag** (`reading/BookmarkFlag.tsx`, ~40 lines): Amber-colored Bookmark icon toggle. 48x48px minimum touch target. aria-pressed reflects bookmark state. Shared between SoloReadingFlow and ReadingContainer.

### Reflection Components (Stories 2.2, 2.3)

- **ReflectionSummary** (`reflection/ReflectionSummary.tsx`, ~200 lines): End-of-session reflection. Bookmarked verses as selectable chips (multi-select for "standout verses"). Session-level 1-5 rating scale with keyboard-navigable radiogroup. Optional note textarea (200 chars). Continue button with validation.

- **MessageCompose** (`reflection/MessageCompose.tsx`, ~120 lines): Partner message composition. "Write something for [Partner Name]" heading. 300 char textarea with counter at 250+. Send and Skip buttons. Auto-grow textarea. Auto-focus on mount.

- **DailyPrayerReport** (`reflection/DailyPrayerReport.tsx`, ~200 lines): Full prayer report display. User's step-by-step ratings with bookmark indicators. Standout verse selections as read-only chips. Partner message reveal (Dancing Script font). Waiting state for incomplete partner. Side-by-side partner ratings when available. Return to Overview button.

## Admin Panel

The admin panel (route: `/admin`) is lazy-loaded and consists of 6 components:

- **AdminPanel** (`AdminPanel/AdminPanel.tsx`, 192 lines): Main container with sticky header. Action buttons: Export (JSON), Import (JSON), Create Message, Exit Admin. Manages modal state for create/edit/delete. Loads custom messages on mount.

- **MessageList** (admin) (`AdminPanel/MessageList.tsx`, 157 lines): Combined view of default + custom messages. Category filter dropdown. Text search input. Results count with custom message count highlight. Table with MessageRow per entry.

- **MessageRow** (`AdminPanel/MessageRow.tsx`, 107 lines): Table row per message. Truncated text (100 chars). Category label with emoji. Type badge (Custom/Default). Draft badge for inactive custom messages. Edit/Delete buttons (custom only, read-only for defaults).

- **CreateMessageForm** (`AdminPanel/CreateMessageForm.tsx`, 240 lines): Modal form for creating custom messages. Fields: text (500 chars with remaining counter), category (5 options), active toggle. Validation error display (field-specific via `isValidationError`).

- **EditMessageForm** (`AdminPanel/EditMessageForm.tsx`, 262 lines): Modal form pre-filled with message data. Change detection (save disabled when no changes). Message metadata display (ID, created, updated). Same validation as create.

- **DeleteConfirmDialog** (`AdminPanel/DeleteConfirmDialog.tsx`, 97 lines): Confirmation modal with AlertTriangle warning icon. Message preview (text, category, ID). Cancel/Delete buttons.

---
