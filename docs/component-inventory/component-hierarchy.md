# Component Hierarchy

## App Root Tree

```
App (root) -- src/App.tsx
|
|-- ErrorBoundary (class component, global, Sentry integration)
|   |
|   |-- [Auth Gate: not authenticated]
|   |   |-- LoginScreen (email/password + Google OAuth)
|   |
|   |-- [Auth Gate: authenticated, no display name]
|   |   |-- DisplayNameSetup (post-OAuth display name modal)
|   |
|   |-- [Auth Gate: authenticated, has display name, first visit]
|   |   |-- WelcomeSplash (lazy) (animated welcome with raining hearts)
|   |
|   |-- [Auth Gate: authenticated, ready]
|       |
|       |-- NetworkStatusIndicator (showOnlyWhenOffline)
|       |-- SyncToast (sync completion feedback)
|       |-- BottomNavigation (7 tabs: Home, Mood, Notes, Partner, Photos, Scripture, Logout)
|       |
|       |-- ViewErrorBoundary (class component, per-view, keeps nav visible)
|       |   |
|       |   |-- [currentView === 'home']
|       |   |   |-- DailyMessage (swipe navigation, favorites, share)
|       |   |   |-- CountdownTimer (celebration animations)
|       |   |   |-- RelationshipTimers
|       |   |   |   |-- TimeTogether (real-time count-up)
|       |   |   |   |-- BirthdayCountdown (x2: Frank, Gracie)
|       |   |   |   |-- EventCountdown (wedding, visits)
|       |   |   |-- Settings
|       |   |   |   |-- AnniversarySettings (CRUD with animations)
|       |   |   |-- WelcomeButton (FAB to re-show splash)
|       |   |
|       |   |-- [currentView === 'photos']
|       |   |   |-- PhotoGallery (lazy) (responsive grid, infinite scroll)
|       |   |   |   |-- PhotoGridItem (lazy-loaded thumbnails)
|       |   |   |   |-- PhotoGridSkeleton (loading skeleton)
|       |   |   |-- PhotoUpload (lazy) (multi-step upload modal)
|       |   |   |-- PhotoCarousel (lazy) (lightbox with swipe/keyboard)
|       |   |   |   |-- PhotoCarouselControls (top bar controls)
|       |   |   |-- PhotoViewer (full-screen with gestures, zoom)
|       |   |   |-- PhotoEditModal (caption/tags editing)
|       |   |   |-- PhotoDeleteConfirmation (delete dialog)
|       |   |
|       |   |-- [currentView === 'mood']
|       |   |   |-- MoodTracker (lazy) (12 mood types, tabs: tracker/timeline/calendar)
|       |   |   |   |-- MoodButton (animated mood selection)
|       |   |   |   |-- MoodHistoryTimeline (react-window virtualized)
|       |   |   |   |   |-- MoodHistoryItem (expand/collapse)
|       |   |   |   |-- MoodHistoryCalendar (month navigation)
|       |   |   |       |-- CalendarDay (memo)
|       |   |   |       |-- MoodDetailModal (focus trap, ESC dismiss)
|       |   |   |-- PartnerMoodDisplay (realtime partner mood)
|       |   |   |-- NoMoodLoggedState (empty state)
|       |   |
|       |   |-- [currentView === 'partner']
|       |   |   |-- PartnerMoodView (lazy) (partner connection + mood + interactions)
|       |   |   |   |-- PokeKissInterface (expandable FAB)
|       |   |   |       |-- InteractionHistory (7-day modal)
|       |   |   |       |-- PokeAnimation / KissAnimation / FartAnimation
|       |   |
|       |   |-- [currentView === 'notes']
|       |   |   |-- LoveNotes (lazy) (full chat page)
|       |   |       |-- MessageList (react-window virtualized, infinite scroll)
|       |   |       |   |-- LoveNoteMessage (memo) (chat bubble + image)
|       |   |       |   |   |-- FullScreenImageViewer (memo) (modal image viewer)
|       |   |       |-- MessageInput (auto-resize textarea, image picker)
|       |   |           |-- ImagePreview (memo) (thumbnail + compression estimate)
|       |   |
|       |   |-- [currentView === 'scripture']
|       |       |-- ScriptureOverview (lazy) (entry point, mode selection, session routing)
|       |       |   |-- StatsSection (couple aggregate stats)
|       |       |   |
|       |       |   |-- [session.mode === 'solo' || post-reading phases]
|       |       |   |   |-- SoloReadingFlow (thin orchestrator, delegates to sub-hooks)
|       |       |   |       |-- uses useSoloReadingFlow (composes 4 sub-hooks):
|       |       |   |       |   |-- useReadingNavigation (verse nav, step transitions, slide direction)
|       |       |   |       |   |-- useReportPhase (report generation, reflection summary, prayer report)
|       |       |   |       |   |-- useSessionPersistence (auto-save, bookmarks, retry logic)
|       |       |   |       |   |-- useReadingDialogs (exit confirmation dialog, focus trap)
|       |       |   |       |-- ReadingPhaseView (props grouped into sub-objects: session, state, animations, elementRefs, handlers)
|       |       |   |       |   |-- BookmarkFlag (verse bookmark toggle)
|       |       |   |       |-- ReportPhaseView (report sub-phases)
|       |       |   |       |-- ReflectionSummary (standout verses, rating, notes)
|       |       |   |       |-- MessageCompose (partner message textarea)
|       |       |   |       |-- DailyPrayerReport (ratings, bookmarks, partner message)
|       |       |   |
|       |       |   |-- [session.mode === 'together', phase === 'lobby'/'countdown']
|       |       |   |   |-- LobbyContainer (role selection, ready up, countdown)
|       |       |   |       |-- Countdown (3-second synchronized countdown)
|       |       |   |
|       |       |   |-- [session.mode === 'together', phase === 'reading']
|       |       |       |-- ReadingContainer (verse/response tabs, lock-in, presence)
|       |       |           |-- RoleIndicator (reader/responder pill badge)
|       |       |           |-- BookmarkFlag (verse bookmark toggle)
|       |       |           |-- PartnerPosition (ephemeral view position)
|       |       |           |-- LockInButton (ready/waiting/undo states)
|       |       |           |-- DisconnectionOverlay (two-phase: reconnecting/timeout)
|       |       |
|       |       |-- [admin panel - toggled from Settings]
|       |           |-- AdminPanel (lazy) (message management)
|       |               |-- MessageList (filtered/searchable table)
|       |               |   |-- MessageRow (single table row)
|       |               |-- CreateMessageForm (modal)
|       |               |-- EditMessageForm (modal)
|       |               |-- DeleteConfirmDialog (modal)
```

## Lazy-Loaded Components (9 total)

All lazy-loaded via `React.lazy()` with `<Suspense>` fallback:

| Component         | Import Path                                                   | Trigger                       |
| ----------------- | ------------------------------------------------------------- | ----------------------------- |
| PhotoGallery      | `./components/PhotoGallery/PhotoGallery`                      | `currentView === 'photos'`    |
| MoodTracker       | `./components/MoodTracker/MoodTracker`                        | `currentView === 'mood'`      |
| PartnerMoodView   | `./components/PartnerMoodView/PartnerMoodView`                | `currentView === 'partner'`   |
| AdminPanel        | `./components/AdminPanel/AdminPanel`                          | Admin toggle in Settings      |
| LoveNotes         | `./components/love-notes/LoveNotes`                           | `currentView === 'notes'`     |
| ScriptureOverview | `./components/scripture-reading/containers/ScriptureOverview` | `currentView === 'scripture'` |
| WelcomeSplash     | `./components/WelcomeSplash/WelcomeSplash`                    | First visit after auth        |
| PhotoUpload       | `./components/PhotoUpload/PhotoUpload`                        | Upload button in PhotoGallery |
| PhotoCarousel     | `./components/PhotoCarousel/PhotoCarousel`                    | Photo selection in gallery    |

## Auth Flow Gates

App.tsx implements a sequential auth gate pattern:

1. **Not authenticated** -> Render `LoginScreen`
2. **Authenticated but no display name** -> Render `DisplayNameSetup`
3. **Authenticated, has display name, first visit** -> Render `WelcomeSplash` (lazy)
4. **Authenticated, ready** -> Render main app with navigation
