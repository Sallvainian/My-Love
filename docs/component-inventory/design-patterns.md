# Design Patterns

## Container / Presentational Pattern

The codebase follows a clear container/presentational split, especially in the scripture-reading feature:

**Containers** connect to the Zustand store via `useAppStore` (often with `useShallow`) and pass data/callbacks as props to presentational children.

| Container         | Presentational Children                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| ScriptureOverview | StatsSection, ModeCard, PartnerStatusSkeleton, PartnerLinkMessage                |
| SoloReadingFlow   | BookmarkFlag, ReflectionSummary, MessageCompose, DailyPrayerReport               |
| ReadingContainer  | RoleIndicator, BookmarkFlag, PartnerPosition, LockInButton, DisconnectionOverlay |
| LobbyContainer    | Countdown                                                                        |
| LoveNotes         | MessageList, MessageInput                                                        |
| PhotoGallery      | PhotoGridItem, PhotoGridSkeleton                                                 |
| MoodTracker       | MoodButton                                                                       |

## Lazy Loading with Suspense

9 components use `React.lazy()` with `<Suspense>` fallback for code splitting:

- Major views: PhotoGallery, MoodTracker, PartnerMoodView, LoveNotes, ScriptureOverview
- Modals: PhotoUpload, PhotoCarousel, WelcomeSplash
- Admin: AdminPanel

All lazy imports are defined at the top of `App.tsx`.

## React.memo for Performance

5 components use `React.memo` to prevent unnecessary re-renders:

| Component               | Reason                                              |
| ----------------------- | --------------------------------------------------- |
| `CalendarDay`           | Rendered 28-42 times per calendar month             |
| `LoveNoteMessage`       | Rendered in virtualized list, identity-stable props |
| `FullScreenImageViewer` | Modal overlay, expensive re-renders                 |
| `ImagePreview`          | Thumbnail with blob URL, avoids re-creation         |
| `MoodHistoryItem`       | Rendered in virtualized timeline                    |

## Class-Based ErrorBoundary

Two class components exist because React's `componentDidCatch` lifecycle requires class components:

- `ErrorBoundary` -- Global, with Sentry integration
- `ViewErrorBoundary` -- Per-view, keeps navigation visible, detects offline/chunk errors

## Optimistic UI Updates

Used in the Notes slice for instant chat feel:

1. Create temporary entry with `sending: true` flag
2. Append to state immediately
3. Send to server in background
4. On success: replace temp with server response
5. On failure: mark with `error: true`, show retry button

Also used in mood tracking -- moods are stored locally first, then synced to Supabase.

## Virtualized Lists (react-window v2)

Two components use react-window for memory-efficient rendering:

| Component                | Usage                                       | Row Height                       | Infinite Scroll           |
| ------------------------ | ------------------------------------------- | -------------------------------- | ------------------------- |
| MessageList (love-notes) | `List` + `useListRef` + `useInfiniteLoader` | Variable (content + image based) | Yes, loads older messages |
| MoodHistoryTimeline      | `List` + `useListRef`                       | Variable                         | Yes, loads older entries  |

Key implementation details:

- `MessageRow` extracted outside component to prevent function recreation per render
- `rowProps` passed as a single object for stable reference
- `getRowHeight` callback calculates height based on content length and image presence

## Focus Management and Accessibility

Consistent accessibility patterns across modals and interactive elements:

- **Focus trap:** MoodDetailModal, FullScreenImageViewer, exit confirmation dialogs
- **Focus restore:** FullScreenImageViewer stores `document.activeElement` on open, restores on close
- **ESC key dismiss:** All modals handle Escape key
- **aria-live regions:** NetworkStatusIndicator (`polite`), Countdown (`assertive`), partner status indicators
- **aria-pressed:** BookmarkFlag, standout verse chips, rating radiogroup
- **focus-visible ring:** Scripture feature uses consistent `FOCUS_RING` constant: `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'`
- **Minimum touch targets:** 48px minimum on all interactive scripture elements, 44px on notes input buttons
- **Screen reader announcements:** ScriptureOverview has a `sr-only` live region for session resume announcements

## Realtime Subscriptions

Three features use Supabase realtime:

| Feature      | Hook/Mechanism                                              | Channel Type     | Purpose                                |
| ------------ | ----------------------------------------------------------- | ---------------- | -------------------------------------- |
| Interactions | `subscribeToInteractions()` in PokeKissInterface            | Database changes | Receive poke/kiss notifications        |
| Love Notes   | `useRealtimeMessages` hook                                  | Broadcast        | Receive new chat messages              |
| Scripture    | `useScriptureBroadcast` hook (mounted in ScriptureOverview) | Broadcast        | Lock-in sync, lobby state, presence    |
| Scripture    | `useScripturePresence` hook (in ReadingContainer)           | Presence         | Partner view position (verse/response) |

## Framer Motion Import Patterns

Two import styles used for tree-shaking:

- `import { m as motion } from 'framer-motion'` -- Most components (requires `LazyMotion` ancestor or uses lightweight `m`)
- `import { motion } from 'framer-motion'` -- Some components use the full `motion` export directly
- `import { LazyMotion, m } from 'framer-motion'` -- SoloReadingFlow uses `LazyMotion` with `loadFeatures` for deferred feature loading

## useShallow Selector Pattern

Container components use `useShallow` from `zustand/react/shallow` to select multiple state fields without causing re-renders on unrelated state changes:

```typescript
const { session, myRole, partnerLocked, ... } = useAppStore(
  useShallow((state) => ({
    session: state.session,
    myRole: state.myRole,
    partnerLocked: state.partnerLocked,
  }))
);
```

This is used extensively in ScriptureOverview, ReadingContainer, LobbyContainer, and SoloReadingFlow.

## Custom Hooks as Store Wrappers

Several custom hooks wrap store interactions for cleaner component APIs:

| Hook                    | Wraps                                                                                 | Used By                                                    |
| ----------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `useSoloReadingFlow`    | Composes 4 sub-hooks (reading navigation, report phase, session persistence, dialogs) | SoloReadingFlow                                            |
| `useReadingNavigation`  | Verse navigation, step transitions, slide direction                                   | useSoloReadingFlow                                         |
| `useReportPhase`        | Report generation, reflection summary, prayer report state                            | useSoloReadingFlow                                         |
| `useSessionPersistence` | Auto-save, bookmarks, retry logic                                                     | useSoloReadingFlow                                         |
| `useReadingDialogs`     | Exit confirmation dialog, focus trap                                                  | useSoloReadingFlow                                         |
| `useLoveNotes`          | notesSlice actions + realtime setup                                                   | LoveNotes, MessageInput                                    |
| `usePartnerMood`        | moodSlice partner mood fetching                                                       | PartnerMoodDisplay                                         |
| `useNetworkStatus`      | Browser online/offline events                                                         | NetworkStatusIndicator, ScriptureOverview, SoloReadingFlow |
| `useAutoSave`           | visibilitychange + beforeunload listeners                                             | SoloReadingFlow                                            |
| `useVibration`          | Navigator.vibrate API                                                                 | MessageInput                                               |
| `useMotionConfig`       | prefers-reduced-motion media query                                                    | ScriptureOverview, ReadingContainer, Countdown             |
| `useScriptureBroadcast` | Supabase realtime broadcast channel                                                   | ScriptureOverview                                          |
| `useScripturePresence`  | Supabase realtime presence channel                                                    | ReadingContainer                                           |

## Auth Centralization (AuthSlice)

Since 2026-03-13, user identity is centralized in `AuthSlice` (`src/stores/slices/authSlice.ts`). Instead of each slice calling `supabase.auth.getUser()` asynchronously, all slices read `get().userId` synchronously from the store. The auth state is populated by `onAuthStateChange` in App.tsx.

This pattern eliminates:

- Redundant async auth calls in every slice action
- Race conditions between auth state and slice operations
- Inconsistent error handling for unauthenticated states

## Sub-Hook Decomposition (SoloReadingFlow)

Since 2026-03-13, `useSoloReadingFlow` has been refactored from a monolithic hook into a thin orchestrator that composes 4 sub-hooks by concern:

| Sub-Hook                | Concern                               | Key State                             |
| ----------------------- | ------------------------------------- | ------------------------------------- |
| `useReadingNavigation`  | Verse navigation, step transitions    | `subView`, `slideDirection`           |
| `useReportPhase`        | Report generation, reflection summary | `reportSubPhase`, `reportData`        |
| `useSessionPersistence` | Auto-save, bookmarks, retry           | `bookmarkedSteps`, persistence timers |
| `useReadingDialogs`     | Exit confirmation                     | `showExitConfirm`, dialog refs        |

## Props Grouping (ReadingPhaseView)

Since 2026-03-13, `ReadingPhaseView`'s 22 flat props have been restructured into 5 sub-objects for better readability and maintainability:

```typescript
interface ReadingPhaseViewProps {
  session: { currentStepIndex: number };
  state: { subView, slideDirection, showExitConfirm, isOnline, isSyncing, ... };
  animations: { crossfade, slide };
  elementRefs: { verseHeading, backToVerse, exitButton, dialog };
  handlers: { onBookmarkToggle, onNextVerse, onViewResponse, ... };
}
```

## XSS Prevention

`LoveNoteMessage` uses DOMPurify to sanitize message content:

```typescript
const sanitizedContent = useMemo(
  () => DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [], KEEP_CONTENT: true }),
  [message.content]
);
```

This strips all HTML tags while keeping text content, preventing XSS attacks from user-generated content.
