# Component Hierarchy

```
App (root) ── src/App.tsx (612 lines)
├── ErrorBoundary (global class component)
│   ├── LoginScreen (unauthenticated)
│   ├── DisplayNameSetup (post-OAuth onboarding modal)
│   └── WelcomeSplash (first visit / 60-min interval, lazy)
│
├── NetworkStatusIndicator (always visible when offline)
├── SyncToast (sync completion feedback)
│
├── <main> (authenticated, initialized)
│   │
│   ├── [home] ── Inline (not lazy-loaded, always works offline)
│   │   ├── TimeTogether (count-up, 1s updates)
│   │   ├── BirthdayCountdown (x2: user + partner)
│   │   ├── EventCountdown (wedding + next visit)
│   │   ├── DailyMessage (swipeable card)
│   │   │   └── CountdownTimer
│   │   │       └── CountdownCard (internal)
│   │   │           └── CelebrationAnimation (internal)
│   │   └── WelcomeButton (FAB, bottom-right)
│   │
│   └── ViewErrorBoundary (wraps all lazy views, resets on navigation)
│       │
│       ├── [photos] ── Lazy
│       │   └── PhotoGallery
│       │       ├── PhotoGridSkeleton / PhotoGridSkeletonGrid
│       │       ├── PhotoGridItem (per photo, lazy-loaded images)
│       │       └── PhotoViewer (full-screen modal, focus trap, pinch-zoom)
│       │
│       ├── [mood] ── Lazy
│       │   └── MoodTracker (3 tabs: Log/Timeline/Calendar)
│       │       ├── MoodButton (x12 in 3x4 grid)
│       │       ├── PartnerMoodDisplay (real-time Supabase Broadcast)
│       │       │   └── NoMoodLoggedState
│       │       ├── MoodHistoryTimeline (react-window virtualized)
│       │       │   ├── DateHeader (internal)
│       │       │   ├── MoodHistoryItem (expandable)
│       │       │   ├── LoadingSpinner (internal)
│       │       │   └── EmptyMoodHistoryState (internal)
│       │       └── MoodHistoryCalendar (month grid)
│       │           ├── CalendarDay (memoized, per cell)
│       │           └── MoodDetailModal (detail overlay)
│       │
│       ├── [partner] ── Lazy
│       │   └── PartnerMoodView (dual-mode: connection / mood feed)
│       │       ├── MoodCard (memoized, per entry)
│       │       └── PokeKissInterface (expandable FAB)
│       │           ├── PokeAnimation (internal, full-screen)
│       │           ├── KissAnimation (internal, full-screen)
│       │           ├── FartAnimation (internal, full-screen)
│       │           └── InteractionHistory (modal, last 7 days)
│       │
│       ├── [notes] ── Lazy
│       │   └── LoveNotes (full chat page)
│       │       ├── MessageList (react-window v2 virtualized)
│       │       │   ├── MessageRow (internal, per row)
│       │       │   ├── BeginningOfConversation (internal)
│       │       │   └── LoadingSpinner (internal)
│       │       │   └── LoveNoteMessage (memoized, per bubble)
│       │       │       └── FullScreenImageViewer (memoized, modal)
│       │       └── MessageInput (auto-resize textarea + image picker)
│       │           └── ImagePreview (memoized, thumbnail + size)
│       │
│       └── [scripture] ── Lazy
│           └── ScriptureOverview (Lavender Dreams theme)
│               ├── ModeCard (internal: Solo / Together)
│               ├── PartnerStatusSkeleton (internal)
│               ├── PartnerLinkMessage (internal)
│               ├── SoloIcon / TogetherIcon (internal SVGs)
│               └── SoloReadingFlow (LazyMotion wrapper)
│                   ├── BookmarkFlag (presentational)
│                   ├── PerStepReflection (presentational, radiogroup)
│                   ├── ReflectionSummary (presentational, multi-select chips)
│                   ├── MessageCompose (presentational, 300 char textarea)
│                   └── DailyPrayerReport (presentational, ratings + messages)
│
├── BottomNavigation (fixed bottom, 7 tabs)
│
├── PhotoUpload (modal, lazy)
├── PhotoCarousel (modal, lazy)
│   ├── PhotoCarouselControls
│   ├── PhotoEditModal (z-index: 60)
│   └── PhotoDeleteConfirmation (z-index: 70)
│
├── PhotoUploader (alternative upload, uses usePhotos hook)
│
├── Settings (account + anniversaries)
│   └── AnniversarySettings
│       └── AnniversaryForm (internal)
│
└── AdminPanel (route: /admin, lazy)
    ├── MessageList (admin, with search + category filter)
    │   └── MessageRow (per message)
    ├── CreateMessageForm (modal)
    ├── EditMessageForm (modal)
    └── DeleteConfirmDialog (modal)
```

---
