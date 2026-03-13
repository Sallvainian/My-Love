# Feature Components

## Home View (Inline, Not Lazy-Loaded)

The home view renders inline (not lazy-loaded) to guarantee offline availability.

### DailyMessage

**File:** `src/components/DailyMessage/DailyMessage.tsx`
**Type:** Container

Displays the daily love message with swipe navigation between days. Core features:

- Swipe left/right (touch and mouse) for day navigation
- Favorite toggle (heart icon, persists to messageHistory.favoriteIds)
- Share via Web Share API
- Day offset tracking (`currentDayOffset`)
- Message cycling through pool based on `shownMessages` Map
- Connects heavily to messagesSlice: `messages`, `currentMessage`, `messageHistory`, `setCurrentMessage`, `markMessageShown`, `navigateMessage`, `toggleFavorite`

### CountdownTimer

**File:** `src/components/CountdownTimer/CountdownTimer.tsx`
**Type:** Presentational

Countdown display with celebration animations when countdown reaches zero. Pure props-based rendering.

### RelationshipTimers

**File:** `src/components/RelationshipTimers/RelationshipTimers.tsx`
**Type:** Presentational

Container component that renders all timer cards. Reads from `RELATIONSHIP_DATES` config (not from store). Contains:

- `TimeTogether` -- Real-time count-up from dating start date. Uses `setInterval(1000)` for live seconds display. Shows years, days, hours, minutes, seconds with padded formatting.
- `BirthdayCountdown` -- Countdown to next birthday with upcoming age. Special "Happy Birthday" state with celebration animation when date matches.
- `EventCountdown` -- Generic countdown for wedding and visit events. Supports null date with "XX:XX:XX" placeholder. Uses calendar days for intuitive display.

### Settings / AnniversarySettings

**Files:** `src/components/Settings/Settings.tsx`, `src/components/Settings/AnniversarySettings.tsx`
**Type:** Container

Settings shows account info and logout. AnniversarySettings provides CRUD for anniversary dates with Framer Motion list animations. Connects to settingsSlice for `settings`, `addAnniversary`, `removeAnniversary`, `updateSettings`.

---

## Auth Components

### LoginScreen

**File:** `src/components/LoginScreen/LoginScreen.tsx`
**Type:** Container

Handles email/password login and Google OAuth. Uses `authService` directly (not Zustand store). Error display for invalid credentials.

### DisplayNameSetup

**File:** `src/components/DisplayNameSetup/DisplayNameSetup.tsx`
**Type:** Container

Modal shown after OAuth when user has no display name set. Updates user metadata via `authService`.

---

## Photos Feature

### PhotoGallery

**File:** `src/components/PhotoGallery/PhotoGallery.tsx`
**Type:** Container (lazy-loaded)

Responsive photo grid with infinite scroll via `IntersectionObserver`. Loads photos from Supabase on mount via `loadPhotos()`. Grid uses CSS grid with responsive columns. Each photo rendered via `PhotoGridItem`.

### PhotoUpload

**File:** `src/components/PhotoUpload/PhotoUpload.tsx`
**Type:** Container (lazy-loaded)

Multi-step upload modal with states: `select` -> `preview` -> `uploading` -> `success`/`error`.

- File validation: JPEG/PNG/WebP, max 50MB
- Preview with blob URL
- Caption (500 chars max) and tags (10 max, 50 chars each) inputs
- Storage warning banner from `storageWarning` state
- Auto-close after 3 seconds on success
- Retry on error

### PhotoCarousel

**File:** `src/components/PhotoCarousel/PhotoCarousel.tsx`
**Type:** Container (lazy-loaded)

Lightbox carousel with swipe gesture and keyboard navigation. Uses `PhotoCarouselControls` for top bar (close, edit, delete buttons).

### PhotoViewer

**File:** `src/components/PhotoGallery/PhotoViewer.tsx`
**Type:** Container

Full-screen photo viewer with pinch-to-zoom gestures and delete functionality.

---

## Mood Tracking Feature

### MoodTracker

**File:** `src/components/MoodTracker/MoodTracker.tsx`
**Type:** Container (lazy-loaded)

Main mood tracking component with three tabs:

1. **Tracker** -- 12 mood type buttons (6 positive, 6 challenging) arranged in a grid. Multi-select support. Optional note text. Submit creates mood entry and triggers sync.
2. **Timeline** -- Virtualized timeline via `MoodHistoryTimeline` using react-window.
3. **Calendar** -- Monthly calendar view via `MoodHistoryCalendar` with day-level mood indicators.

Each `MoodButton` is animated (scale on tap) with distinct icon and color per mood type.

### MoodHistoryTimeline

**File:** `src/components/MoodTracker/MoodHistoryTimeline.tsx`
**Type:** Container

Uses react-window v2 `List` component for virtualized rendering of mood history. Supports infinite scroll for loading older entries.

### MoodHistoryCalendar

**File:** `src/components/MoodHistory/MoodHistoryCalendar.tsx`
**Type:** Container

Calendar grid with month navigation. Loads moods per month via `moodService`. Each day rendered via `CalendarDay` (memo). Clicking a day with a mood opens `MoodDetailModal`.

### MoodDetailModal

**File:** `src/components/MoodHistory/MoodDetailModal.tsx`
**Type:** Presentational

Modal showing full mood details: mood type with icon/color, formatted date ("Monday, Nov 15, 2025"), formatted time ("3:42 PM"), note text. Features focus trap (Tab cycles within modal), ESC key dismiss, slide-up animation with backdrop fade.

---

## Partner Feature

### PartnerMoodView

**File:** `src/components/PartnerMoodView/PartnerMoodView.tsx`
**Type:** Container (lazy-loaded)

Partner connection management combined with partner mood viewing. Shows:

- Partner search and request flow (if no partner linked)
- Partner's current mood with realtime updates via `usePartnerMood` hook
- `PokeKissInterface` FAB for sending interactions
- Realtime subscription for incoming interactions

### PokeKissInterface

**File:** `src/components/PokeKissInterface/PokeKissInterface.tsx`
**Type:** Container

Expandable FAB (Floating Action Button) with staggered animation. Features:

- 4 action buttons: History, Poke, Kiss, Fart
- 30-minute cooldown per interaction type (stored in localStorage)
- Notification badge showing `unviewedCount`
- Full-screen animations on receive: PokeAnimation (finger wiggle), KissAnimation (rising hearts), FartAnimation (expanding clouds)
- Realtime subscription via `subscribeToInteractions()`
- `InteractionHistory` modal access from History button

---

## Love Notes Feature

### LoveNotes

**File:** `src/components/love-notes/LoveNotes.tsx`
**Type:** Container (lazy-loaded)

Full chat page assembling header, MessageList, and MessageInput. Features:

- Back button navigation via `navigateHome`
- Error banner with dismiss
- Fetches current user ID and partner display name on mount
- Uses `useLoveNotes` hook for notes, loading, error, pagination

### MessageList

**File:** `src/components/love-notes/MessageList.tsx`
**Type:** Container

Virtualized message list using react-window v2 `List` with `useInfiniteLoader` for pagination. Features:

- Variable row height calculation based on content length and image presence
- Auto-scroll to bottom on initial load and new messages
- Scroll position preservation during pagination
- "New message" indicator button when scrolled up
- "Beginning of conversation" indicator when all history loaded
- `MessageRow` extracted outside component for react-window performance

### LoveNoteMessage

**File:** `src/components/love-notes/LoveNoteMessage.tsx`
**Type:** Presentational (memo)

Chat bubble with visual distinction between own (coral #FF6B6B, right-aligned) and partner (gray #E9ECEF, left-aligned) messages. Features:

- DOMPurify XSS sanitization of message content
- Image display with loading/error states and retry (max 2 retries)
- Signed URL fetching via `getSignedImageUrl`
- Full-screen image viewer on tap
- Optimistic update indicators: "Sending...", "Failed to send - Tap to retry"
- Mounted state tracking to prevent post-unmount state updates

### MessageInput

**File:** `src/components/love-notes/MessageInput.tsx`
**Type:** Container

Chat input with image attachment support. Features:

- Auto-resize textarea (grows with content, max 200px)
- Character counter visible at 900+ chars, warning at 950+, error at 1000+
- Image picker button with file validation via `imageCompressionService`
- Keyboard shortcuts: Enter (send), Shift+Enter (new line), Escape (clear)
- Haptic feedback via `useVibration` hook
- `ImagePreview` shown when image selected
- Send disabled until valid content or image present

### ImagePreview

**File:** `src/components/love-notes/ImagePreview.tsx`
**Type:** Presentational (memo)

Thumbnail preview of selected image before sending. Shows:

- Image thumbnail (max 150x200px)
- Remove button (X icon)
- Original file size and estimated compressed size
- "Compressing..." overlay during upload
- Large file indicator for files above compression threshold

### FullScreenImageViewer

**File:** `src/components/love-notes/FullScreenImageViewer.tsx`
**Type:** Presentational (memo)

Full-screen modal for viewing images. Dark overlay (90% opacity), centered image (max 90vh/90vw), close button, ESC key handler, focus management (stores previous focus, restores on close), body scroll lock.

---

## Scripture Reading Feature

### ScriptureOverview

**File:** `src/components/scripture-reading/containers/ScriptureOverview.tsx`
**Type:** Container (lazy-loaded)

Main entry point for Scripture Reading. Handles:

- Partner status detection (loading/linked/unlinked)
- Start button with mode selection reveal (animated)
- Solo mode: always available (when online)
- Together mode: conditional on partner link
- Session resume for incomplete solo sessions
- Offline blocking of start/mode selection
- "Start fresh" calls `abandonSession()` to mark server session as abandoned
- Phase routing: routes to SoloReadingFlow, LobbyContainer, or ReadingContainer based on `session.mode` and `session.currentPhase`
- `useScriptureBroadcast` mounted here (persists across phase transitions)
- StatsSection for couple aggregate statistics
- Uses `useShallow` for both partnerSlice and scriptureSlice selectors

### SoloReadingFlow

**File:** `src/components/scripture-reading/containers/SoloReadingFlow.tsx` (~600 lines)
**Type:** Container

Step-by-step scripture reading for both solo and together post-reading phases. Manages:

- Verse and response screen display with slide animation
- Step navigation (next verse, view response, back to verse)
- Progress tracking ("Verse X of 17")
- Bookmark toggle per verse via `BookmarkFlag`
- Exit confirmation dialog with save
- Auto-save on visibility change and `beforeunload`
- Offline indicator and blocked advancement
- Retry UI for failed server writes
- Auto-retry on reconnect
- Session completion transition to reflection phase
- Reflection flow: ReflectionSummary -> MessageCompose -> DailyPrayerReport
- Uses `useAutoSave`, `useNetworkStatus`, `useMotionConfig` hooks
- Focus management: heading focus on phase change, dialog focus trap

### LobbyContainer

**File:** `src/components/scripture-reading/containers/LobbyContainer.tsx`
**Type:** Container

Together-mode lobby with three phases:

- **Phase A (Role Selection):** Two cards (Reader/Responder) with Lucide icons, "Continue solo" option
- **Phase B (Lobby Waiting):** Shows partner join status, ready toggle button, partner ready indicator
- **Phase C (Countdown):** Renders `Countdown` component when `countdownStartedAt` is set
- Back button to exit session at any phase

### ReadingContainer

**File:** `src/components/scripture-reading/containers/ReadingContainer.tsx`
**Type:** Container

Together-mode reading orchestrator. Features:

- Role indicator (alternating reader/responder via step index parity)
- Verse/response navigation tabs
- Step content with slide-left animation on advance
- Lock-in button with undo support
- Partner position via `useScripturePresence` hook
- Disconnection overlay with keep-waiting and end-session options
- "Session updated" toast on 409 version mismatch
- "Reconnected" green toast on partner reconnect
- Error toast for non-409 sync failures
- Exit confirmation dialog

### Presentational Sub-Components

- **BookmarkFlag** -- Amber Lucide Bookmark icon toggle. 48px touch target, `aria-pressed`.
- **RoleIndicator** -- Pill badge. Reader: purple-500, "You read this". Responder: purple-300, "Partner reads this".
- **PartnerPosition** -- Shows "[partner] is reading the verse/response". Hidden sentinel div when no presence data.
- **LockInButton** -- 4 states: unlocked ("Ready for next verse"), locked ("Waiting for [name]..." + undo), partner locked indicator (green check), disconnected ("Holding your place").
- **DisconnectionOverlay** -- Phase A (<30s): "Partner reconnecting..." with pulse. Phase B (>=30s): "stepped away" with keep waiting / end session buttons. End session has additional confirmation step.
- **Countdown** -- 3-second countdown from server UTC timestamp. Derives digit from elapsed time. Supports reduced motion. `aria-live="assertive"` announces start/end.
- **ReflectionSummary** -- Bookmarked verses as selectable chips, 1-5 rating radiogroup with keyboard nav (ArrowLeft/Right), optional note (200 chars), share bookmarks toggle. Quiet validation messages.
- **MessageCompose** -- "Write something for [Partner Name]" heading, textarea (300 chars, auto-grow), Send button, "Skip for now" link. Auto-focus on mount.
- **DailyPrayerReport** -- User's step-by-step ratings with bookmark indicators, standout verse chips, partner message reveal (Dancing Script font), side-by-side partner ratings when available, waiting state for incomplete partner.
- **StatsSection** -- 5 stat cards with Lucide icons (BookOpen, CheckCircle, Calendar, Star, Bookmark). Shows skeleton on loading. Zero state with em dash values and "Begin your first reading" message. Uses `Intl.RelativeTimeFormat` for "last completed" display.

---

## Admin Panel

### AdminPanel

**File:** `src/components/AdminPanel/AdminPanel.tsx`
**Type:** Container (lazy-loaded)

Message management interface with import/export functionality. Connects to messagesSlice.

### MessageList (Admin)

**File:** `src/components/AdminPanel/MessageList.tsx`
**Type:** Container

Filtered and searchable message table. Renders `MessageRow` for each message. Connects to `useAppStore` for `messages` and `customMessages`.

### CreateMessageForm / EditMessageForm / DeleteConfirmDialog

**Files:** `src/components/AdminPanel/CreateMessageForm.tsx`, `EditMessageForm.tsx`, `DeleteConfirmDialog.tsx`
**Type:** Presentational

Modal forms for message CRUD. All receive callbacks via props (onSubmit, onClose, onConfirm, onCancel). CreateMessageForm and EditMessageForm include input validation.
