# Design Patterns

## Barrel Exports

9 component directories use `index.ts` barrel exports for clean imports:

| Folder | Exports |
|--------|---------|
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
| `love-notes/` | `LoveNotes`, `LoveNoteMessage` (+ type), `MessageList` (+ type) |
| `ViewErrorBoundary/` | `ViewErrorBoundary` (named + default) |
| `scripture-reading/` | `ScriptureOverview`, `SoloReadingFlow`, `BookmarkFlag`, `PerStepReflection`, `ReflectionSummary`, `MessageCompose`, `DailyPrayerReport` |

## Lazy Loading (Code Splitting)

9 components are lazy-loaded via `React.lazy()` with dynamic imports in `App.tsx`:

| Component | Import Path | Trigger |
|-----------|-------------|---------|
| `PhotoGallery` | `./components/PhotoGallery/PhotoGallery` | `currentView === 'photos'` |
| `MoodTracker` | `./components/MoodTracker/MoodTracker` | `currentView === 'mood'` |
| `PartnerMoodView` | `./components/PartnerMoodView/PartnerMoodView` | `currentView === 'partner'` |
| `AdminPanel` | `./components/AdminPanel/AdminPanel` | URL path `/admin` |
| `LoveNotes` | `./components/love-notes` | `currentView === 'notes'` |
| `ScriptureOverview` | `./components/scripture-reading` | `currentView === 'scripture'` |
| `WelcomeSplash` | `./components/WelcomeSplash/WelcomeSplash` | First visit or 60-min timer |
| `PhotoUpload` | `./components/PhotoUpload/PhotoUpload` | Upload button click |
| `PhotoCarousel` | `./components/PhotoCarousel/PhotoCarousel` | Photo selection |

All lazy views are wrapped in `<Suspense fallback={<LoadingSpinner />}>`. Additionally, `SoloReadingFlow` uses `LazyMotion` with a dynamic import of `motionFeatures.ts` for Framer Motion tree-shaking.

## Error Boundaries (Two-Tier Strategy)

1. **Global ErrorBoundary** (`ErrorBoundary/ErrorBoundary.tsx`): Class component wrapping LoginScreen, DisplayNameSetup, WelcomeSplash, and AdminPanel. Full-screen recovery UI. Detects `isValidationError()` for corruption-specific "Clear Storage & Reload" option. Uses `getDerivedStateFromError` and `componentDidCatch`.

2. **ViewErrorBoundary** (`ViewErrorBoundary/ViewErrorBoundary.tsx`): Class component wrapping all lazy-loaded views inside `<main>`. Shows inline error UI (preserves `BottomNavigation` visibility). Auto-resets when user navigates to different view via `getDerivedStateFromProps` comparing `viewName`. Detects three error categories:
   - "Failed to fetch dynamically imported module" (chunk load failure)
   - "Loading chunk" / "ChunkLoadError"
   - Offline state (`!navigator.onLine`)

## Container / Presentational Pattern

The `scripture-reading/` feature uses explicit container/presentational separation:

**Containers** (connect to store, manage state, handle side effects):
- `ScriptureOverview` - connects to PartnerSlice + ScriptureReadingSlice via `useShallow`, manages mode selection and session lifecycle
- `SoloReadingFlow` - connects to ScriptureReadingSlice + PartnerSlice via `useShallow`, manages step navigation, save/exit, reflection, and report phases

**Presentational** (pure UI, accept props, no store access):
- `BookmarkFlag` - toggle icon with ARIA
- `PerStepReflection` - rating scale + note input
- `ReflectionSummary` - verse chips + rating + note
- `MessageCompose` - textarea + send/skip
- `DailyPrayerReport` - read-only report display

## Memoization (React.memo)

5 components use `React.memo` for render optimization:

| Component | Location | Reason |
|-----------|----------|--------|
| `CalendarDay` | `MoodHistory/CalendarDay.tsx` | 30+ cells per month grid, only re-render on mood/date change |
| `MoodCard` | `PartnerMoodView/PartnerMoodView.tsx` | List items in partner mood feed |
| `LoveNoteMessage` | `love-notes/LoveNoteMessage.tsx` | Chat bubbles in virtualized list, prevent re-render on scroll |
| `FullScreenImageViewer` | `love-notes/FullScreenImageViewer.tsx` | Prevent re-render when parent state changes |
| `ImagePreview` | `love-notes/ImagePreview.tsx` | Prevent re-render during typing in MessageInput |

## Virtualization (react-window v2)

Two components use react-window for large list performance:

### MessageList (love-notes)
- `List` component from react-window v2 with `useListRef(null)` for ref access
- `useInfiniteLoader` from react-window-infinite-loader (threshold: 10, minimumBatchSize: 50)
- Variable row heights via `calculateRowHeight()` based on content length and image presence
- `scrollToRow({ align: 'end', index })` for auto-scroll (v2 API)
- `onRowsRendered` callback for infinite loader integration and scroll position tracking

### MoodHistoryTimeline (MoodTracker)
- `List` component with `useInfiniteLoader`
- Date-grouped sections with `DateHeader` separators
- Variable row heights

## Animation Library (Framer Motion)

All animations use Framer Motion with several import patterns:

### Standard Import
```typescript
import { m as motion, AnimatePresence } from 'framer-motion';
```
The `m as motion` alias enables Framer Motion's tree-shakeable `m` API while maintaining the familiar `motion.div` syntax.

### LazyMotion (Scripture Reading)
```typescript
import { LazyMotion, m } from 'framer-motion';
const loadMotionFeatures = () => import('../motionFeatures').then((module) => module.default);

// Usage
<LazyMotion features={loadMotionFeatures} strict>
  <m.div ...>
</LazyMotion>
```

### Animation Patterns Used
- `AnimatePresence` for mount/unmount transitions (used in CountdownTimer, MoodDetailModal, PhotoCarousel, WelcomeSplash, PokeKissInterface, SoloReadingFlow, MessageList, MessageInput)
- `AnimatePresence mode="wait"` for sequential transitions (CountdownTimer cards)
- `whileHover={{ scale: 1.02 }}` for hover effects (RelationshipTimers, CountdownCard)
- `whileTap={{ scale: 0.95 }}` for press feedback (WelcomeButton)
- `drag="x"` with `onDragEnd` for swipe gestures (DailyMessage, PhotoCarousel)
- `layoutId` for shared layout animations (MoodTracker tab indicator)
- Spring physics: `type: 'spring'` with configurable `stiffness` and `damping`
- Custom variants with `custom` prop for directional slides (SoloReadingFlow)

## Accessibility Patterns

### ARIA Live Regions
- `NetworkStatusIndicator`: `role="status"`, `aria-live="polite"` for connectivity changes
- `SyncToast`: `role="alert"`, `aria-live="polite"` for sync completion
- `ScriptureOverview` / `SoloReadingFlow`: Dedicated screen reader announcer `<div className="sr-only" aria-live="polite" aria-atomic="true">` for step changes, view transitions, and session events
- `MessageInput`: `aria-live="polite"` on character counter
- `PerStepReflection` / `ReflectionSummary`: `aria-live="polite"` on character counters

### Focus Management
- `ViewErrorBoundary`: "Go Home" and "Try Again" buttons visible when error occurs
- `PhotoViewer`: Focus trap (WCAG 2.4.3)
- `FullScreenImageViewer`: Stores `previousFocusRef`, auto-focuses close button, restores on close
- `SoloReadingFlow`: Exit dialog focus trap with Tab cycling; stores/restores focus via `previousFocusRef`; `verseHeadingRef.focus()` on step change; `completionHeadingRef.focus()` on reflection phase
- `ReflectionSummary`: Focus heading on mount via `requestAnimationFrame`

### Keyboard Navigation
- `DailyMessage`: ArrowLeft/ArrowRight for message navigation
- `PhotoCarousel`: ArrowLeft/ArrowRight for photo navigation, Escape to close
- `PhotoViewer`: Same keyboard navigation
- `PerStepReflection` / `ReflectionSummary`: ArrowLeft/ArrowRight within `role="radiogroup"` with wrapping
- `MessageInput`: Enter to send, Shift+Enter for newline, Escape to clear
- `SoloReadingFlow`: Escape to close exit dialog

### Touch Targets
- `BookmarkFlag`: `min-h-[48px] min-w-[48px]` (WCAG 2.5.8)
- `SoloReadingFlow` buttons: `min-h-[48px]` for secondary, `min-h-[56px]` for primary
- Scripture partner link: `min-h-[44px]`
- `MessageInput` buttons: `min-h-[44px] min-w-[44px]`

### Focus Visibility
- `FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'` used throughout scripture-reading feature
- Standard Tailwind `focus:ring-2` used in other features

### Role Attributes
- `role="status"`: NetworkStatusIndicator, NetworkStatusDot, offline indicators
- `role="alert"`: SyncToast, error displays, validation messages
- `role="dialog"` + `aria-modal="true"`: PhotoEditModal, FullScreenImageViewer, exit confirmation
- `role="radiogroup"` + `role="radio"` + `aria-checked`: PerStepReflection, ReflectionSummary
- `role="listitem"`: LoveNoteMessage
- `aria-pressed`: BookmarkFlag, ReflectionSummary verse chips
- `aria-current="step"`: SoloReadingFlow progress indicator

## Optimistic UI

Several components implement optimistic updates:

- **MoodTracker**: Immediate UI update on mood log, background sync to server
- **SoloReadingFlow bookmarks**: Immediate toggle in `bookmarkedSteps` Set, 300ms debounced server write with revert on failure
- **SoloReadingFlow reflection**: Advance step immediately, save reflection in background (non-blocking)
- **SoloReadingFlow phase updates**: `updatePhase('report')` optimistically, persist to server in background
- **LoveNoteMessage**: Optimistic send with `sending` flag, error state with retry
- **PartnerMoodView**: Optimistic request actions

## XSS Sanitization

`LoveNoteMessage` sanitizes all message content using DOMPurify:

```typescript
const sanitizedContent = useMemo(
  () => DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [], KEEP_CONTENT: true }),
  [message.content]
);
```

`MessageInput` also sanitizes before sending via `sanitizeMessageContent()` utility.

## URL-Based Object Cleanup

Multiple components create Object URLs for image previews and clean them up:

- `PhotoUploader`: `URL.revokeObjectURL()` in unmount effect and on file change
- `PhotoEditModal`: `URL.revokeObjectURL()` in cleanup function
- `ImagePreview`: `URL.revokeObjectURL()` in effect cleanup
- `LoveNoteMessage`: `URL.revokeObjectURL()` in effect cleanup (for preview URLs)

Pattern uses `queueMicrotask` for state updates to avoid React warnings:
```typescript
useEffect(() => {
  let cancelled = false;
  const url = URL.createObjectURL(file);
  queueMicrotask(() => { if (!cancelled) setPreviewUrl(url); });
  return () => { cancelled = true; URL.revokeObjectURL(url); };
}, [file]);
```

---
