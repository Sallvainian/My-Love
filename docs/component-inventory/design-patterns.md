# Design Patterns

## Barrel Exports

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

## Lazy Loading (Code Splitting)

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

## Error Boundaries

Two-tier error boundary strategy:

1. **Global ErrorBoundary**: Wraps LoginScreen, DisplayNameSetup, WelcomeSplash, and AdminPanel. Full-screen recovery UI. Detects validation errors and offers "Clear Storage & Reload".
2. **ViewErrorBoundary**: Wraps all lazy-loaded views inside `<main>`. Shows inline error UI that keeps `BottomNavigation` visible. Auto-resets when user navigates to a different view via `getDerivedStateFromProps`. Detects chunk loading errors and offline state for targeted messaging.

## Container / Presentational Pattern

The `scripture-reading/` feature uses explicit container/presentational separation:

- **Containers** (`containers/`): `ScriptureOverview`, `SoloReadingFlow` - Connect to Zustand store, manage state, handle side effects.
- **Presentational** (`reading/`, `reflection/`): `BookmarkFlag`, `PerStepReflection`, `ReflectionSummary` - Pure UI components accepting props, no store access.

## Memoization

Performance-critical components use `React.memo`:

- `MoodCard` in PartnerMoodView (partner mood list items)
- `CalendarDay` in MoodHistory (30+ cells per month)
- `LoveNoteMessage` in love-notes (chat bubbles in virtualized list)
- `ImagePreview` in love-notes (prevents re-renders during typing)
- `FullScreenImageViewer` in love-notes

## Virtualization (react-window)

Two components use react-window for large list performance:

- `MessageList` (love-notes): Chat messages with infinite scroll
- `MoodHistoryTimeline`: Mood entries with date-grouped sections

## Animation Library

All animations use **Framer Motion** (imported as `m as motion` for tree-shaking):

- `AnimatePresence` for mount/unmount transitions
- `motion.div` for element animations
- `layoutId` for shared layout animations (mood tab indicator)
- `drag` for swipe gestures (DailyMessage, PhotoCarousel)
- Spring physics: `type: 'spring'` with configurable stiffness/damping

## Accessibility Patterns

- ARIA live regions: `NetworkStatusIndicator`, `ScriptureOverview` (screen reader announcer)
- ARIA labels: All interactive elements (buttons, inputs, navigation)
- Focus management: `focus-visible` ring styles throughout scripture-reading feature
- Focus trapping: `PhotoViewer` (WCAG 2.4.3 compliance)
- Keyboard navigation: `DailyMessage` (ArrowLeft/Right), `PhotoCarousel` (ArrowLeft/Right/Escape), `PerStepReflection` (arrow keys in radiogroup)
- Touch targets: Minimum 48x48px for `BookmarkFlag`, 44x44px for scripture buttons
- Role attributes: `role="status"`, `role="alert"`, `role="dialog"`, `aria-modal`
- Form accessibility: `aria-required`, `aria-invalid`, `htmlFor` labels

---
