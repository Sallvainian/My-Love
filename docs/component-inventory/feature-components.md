# Feature Components

## Home View (Inline, Not Lazy-Loaded)

The home view renders inline to ensure it always works offline. It consists of:

- **TimeTogether**: Real-time count-up from the dating start date, updating every second. Displays years, days, hours, minutes, and seconds.
- **BirthdayCountdown** (x2): Countdown to each partner's birthday with upcoming age calculation. Detects birthday-today for celebration state.
- **EventCountdown**: Generic countdown for wedding (with "Date TBD" placeholder) and planned visits with description text.
- **DailyMessage**: The core daily love message experience. Swipeable card with category badges (reason/memory/affirmation/future/custom), favorite toggle with floating hearts animation, share via Web Share API with clipboard fallback, keyboard navigation, and swipe gestures.

## Photo Gallery and Management

The photo feature spans 10 components across 6 folders:

- **PhotoGallery** is the grid view with Intersection Observer-based infinite scroll (20 photos per page), skeleton loaders during fetch, and a floating upload FAB.
- **PhotoUpload** is a multi-step modal (select -> preview -> upload -> success) with client-side image compression.
- **PhotoCarousel** is a full-screen lightbox with spring animations, swipe/keyboard navigation, and drag constraints at boundaries.
- **PhotoEditModal** and **PhotoDeleteConfirmation** provide in-carousel editing and deletion with proper z-index layering (carousel: 50, edit: 60, delete: 70).
- **PhotoViewer** in PhotoGallery/ is an alternative full-screen viewer with focus trap support.

## Mood Tracking System

The mood system includes 10 components:

- **MoodTracker** offers a 12-mood selection grid (6 positive + 6 challenging), multi-select support, collapsible note field, three tabs (Log/Timeline/Calendar), sync status indicator, and offline retry with service worker background sync registration.
- **MoodHistoryTimeline** uses react-window for virtualized rendering of potentially thousands of mood entries with infinite scroll pagination and date-grouped headers.
- **MoodHistoryCalendar** provides a traditional month-grid view with color-coded mood dots, month navigation with 300ms debounce, and day-tap detail modal.
- **PartnerMoodDisplay** shows the partner's most recent mood with real-time updates via Supabase Broadcast API and a "Just now" badge for entries less than 5 minutes old.

## Partner View and Interactions

- **PartnerMoodView** serves dual purpose: partner connection management (search, send/accept/decline requests) when unlinked, and partner mood feed when connected. Features real-time Supabase Realtime subscription with connection status indicator (connected/reconnecting/disconnected).
- **PokeKissInterface** is an expandable FAB with Poke/Kiss/Fart action buttons, 30-minute cooldowns per action, notification badge for unviewed interactions, and three distinct full-screen animations. Subscribes to real-time interactions on mount.
- **InteractionHistory** modal displays the last 7 days of sent/received interactions with directional arrows, type icons, timestamps, and "New" badges.

## Love Notes (Real-Time Chat)

- **LoveNotes** is a full-page chat container assembling header, MessageList, and MessageInput. Fetches partner display name from the database (not local config).
- **MessageList** uses react-window for virtualized rendering with infinite scroll for loading older messages. Auto-scrolls to bottom on new messages with a "New message" jump indicator when scrolled up.
- **LoveNoteMessage** renders chat bubbles with coral (own) and light gray (partner) backgrounds, HTML sanitization via DOMPurify, image attachment support with signed URL refresh logic, and full-screen image viewing.
- **MessageInput** features an auto-resize textarea, character counter, Enter-to-send keyboard shortcuts, image attachment with compression preview, and Vibration API haptic feedback.

## Scripture Reading

The scripture feature uses a container/presentational architecture across 3 sub-directories:

- **ScriptureOverview** (container) handles partner status detection, mode selection (Solo/Together), session resume for incomplete sessions, and offline blocking. Uses the Lavender Dreams design theme (purple palette).
- **SoloReadingFlow** (container) manages the step-by-step reading experience with verse/response/reflection sub-views, progress tracking, exit confirmation, auto-save on visibility change and beforeunload, offline detection, retry UI, and auto-retry on reconnect.
- **BookmarkFlag** (presentational) provides a toggle for bookmarking individual verses.
- **PerStepReflection** (presentational) offers a 1-5 rating scale with keyboard-navigable radiogroup and optional notes.
- **ReflectionSummary** (presentational) presents bookmarked verse chips, session-level rating, and summary notes for end-of-session reflection.

## Admin Panel

- **AdminPanel** provides full CRUD for custom love messages with import/export (JSON file). Sub-components include MessageList, MessageRow, CreateMessageForm, EditMessageForm, and DeleteConfirmDialog.
- Only accessible via the `/admin` route. Lazy-loaded and excluded from the main navigation.

---
