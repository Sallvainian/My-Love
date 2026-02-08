# Component Hierarchy

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
