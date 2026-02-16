# Component Statistics

## Summary Counts

| Metric | Count |
|--------|-------|
| Total component .tsx files (excluding tests) | 58 |
| Total component .tsx files (including App.tsx) | 59 |
| Test files (.test.tsx) | 12 |
| Component folders | 26 |
| Barrel export files (index.ts) | 13 |
| Utility .ts files (non-index) | 2 (charCounter.ts, motionFeatures.ts) |
| Lazy-loaded components | 9 |
| Store-connected components (direct) | 15 |
| Store-connected components (via hooks) | 4 |
| Memoized components (React.memo) | 5 |
| Virtualized lists (react-window) | 2 |
| Class-based components | 2 |
| Zustand store slices | 10 |

## Lines of Code

| Category | Lines |
|----------|-------|
| Component source (.tsx, excluding tests) | 14,633 |
| App.tsx | 612 |
| **Total component source** | **15,245** |
| Test files (.test.tsx) | 5,553 |
| Barrel exports + utilities (.ts) | 77 |
| **Grand total (all component code)** | **20,875** |

## Largest Components (by line count)

| Component | File | Lines |
|-----------|------|-------|
| `SoloReadingFlow` | `scripture-reading/containers/SoloReadingFlow.tsx` | 1,441 |
| `PartnerMoodView` | `PartnerMoodView/PartnerMoodView.tsx` | 670 |
| `App` | `App.tsx` | 612 |
| `PokeKissInterface` | `PokeKissInterface/PokeKissInterface.tsx` | 582 |
| `MoodTracker` | `MoodTracker/MoodTracker.tsx` | 579 |
| `PhotoViewer` | `PhotoGallery/PhotoViewer.tsx` | 561 |
| `AnniversarySettings` | `Settings/AnniversarySettings.tsx` | 485 |
| `PhotoUploader` | `photos/PhotoUploader.tsx` | 477 |
| `ScriptureOverview` | `scripture-reading/containers/ScriptureOverview.tsx` | 472 |
| `PhotoUpload` | `PhotoUpload/PhotoUpload.tsx` | 458 |

## Component Categories

### By Rendering Strategy

| Strategy | Count | Components |
|----------|-------|------------|
| Standard (function component) | 50 | All not listed below |
| Class component | 2 | `ErrorBoundary`, `ViewErrorBoundary` |
| `React.memo` wrapped | 5 | `CalendarDay`, `MoodCard`, `LoveNoteMessage`, `FullScreenImageViewer`, `ImagePreview` |
| Lazy-loaded (`React.lazy`) | 9 | `PhotoGallery`, `MoodTracker`, `PartnerMoodView`, `AdminPanel`, `LoveNotes`, `ScriptureOverview`, `WelcomeSplash`, `PhotoUpload`, `PhotoCarousel` |

### By Store Connection

| Connection Type | Count | Components |
|-----------------|-------|------------|
| Direct `useAppStore` | 15 | `App`, `DailyMessage`, `AdminPanel`, `MessageList` (admin), `CreateMessageForm`, `EditMessageForm`, `DeleteConfirmDialog`, `PhotoCarousel`, `PhotoUpload`, `MoodTracker`, `PartnerMoodView`, `PokeKissInterface`, `InteractionHistory`, `AnniversarySettings`, `LoveNotes` |
| Via `useShallow` | 2 | `ScriptureOverview`, `SoloReadingFlow` |
| Via `useLoveNotes` hook | 2 | `LoveNotes`, `MessageInput` |
| Via `usePhotos` hook | 2 | `PhotoGallery`, `PhotoUploader` |
| Props only (no store) | 38+ | All presentational, utility, and layout components |

### By Feature Group

| Feature Group | Component Files | Internal Components | Total Components |
|---------------|-----------------|---------------------|------------------|
| Home | 8 | 3 (CountdownCard, CelebrationAnimation, WelcomeButton tooltip) | 11 |
| Photos | 9 | 0 | 9 |
| Mood Tracking | 9 | 4 (DateHeader, LoadingSpinner, EmptyMoodHistoryState, NoMoodLoggedState) | 13 |
| Partner | 2 | 4 (MoodCard, PokeAnimation, KissAnimation, FartAnimation) | 6 |
| Love Notes | 6 | 3 (MessageRow, BeginningOfConversation, LoadingSpinner) | 9 |
| Scripture Reading | 8 | 5 (ModeCard, PartnerStatusSkeleton, PartnerLinkMessage, SoloIcon, TogetherIcon) | 13 |
| Admin | 6 | 1 (MessageRow) | 7 |
| Auth | 2 | 0 | 2 |
| Navigation | 1 | 0 | 1 |
| Settings | 2 | 1 (AnniversaryForm) | 3 |
| Error Handling | 2 | 1 (ViewErrorFallback) | 3 |
| Shared/Utility | 4 | 0 | 4 |

## Design Pattern Adoption

| Pattern | Count | Details |
|---------|-------|---------|
| Barrel exports (index.ts) | 13 | All major feature folders |
| Container/Presentational split | 1 feature | Scripture Reading (2 containers, 5 presentational) |
| Virtualized lists (react-window v2) | 2 | `MessageList`, `MoodHistoryTimeline` |
| Infinite loading (useInfiniteLoader) | 2 | `MessageList`, `MoodHistoryTimeline` |
| Optimistic UI | 5 | Mood logging, bookmarks, reflections, phase updates, message sending |
| XSS sanitization (DOMPurify) | 2 | `LoveNoteMessage`, `MessageInput` |
| Object URL cleanup | 4 | `PhotoUploader`, `PhotoEditModal`, `ImagePreview`, `LoveNoteMessage` |
| Focus management (store/restore) | 3 | `FullScreenImageViewer`, `SoloReadingFlow`, `ReflectionSummary` |
| ARIA live regions | 5 | `NetworkStatusIndicator`, `SyncToast`, `ScriptureOverview`, `SoloReadingFlow`, `MessageInput` |
| Keyboard navigation | 5 | `DailyMessage`, `PhotoCarousel`, `PhotoViewer`, `PerStepReflection`, `MessageInput` |

## Animation Usage (Framer Motion)

| Animation Type | Count | Components |
|----------------|-------|------------|
| `AnimatePresence` | 8 | `CountdownTimer`, `MoodDetailModal`, `PhotoCarousel`, `WelcomeSplash`, `PokeKissInterface`, `SoloReadingFlow`, `MessageList`, `MessageInput` |
| `whileHover` | 2 | `RelationshipTimers`, `CountdownCard` |
| `whileTap` | 1 | `WelcomeButton` |
| `drag` gesture | 2 | `DailyMessage`, `PhotoCarousel` |
| `layoutId` | 1 | `MoodTracker` (tab indicator) |
| `LazyMotion` | 1 | `SoloReadingFlow` |
| Spring physics | 3+ | `SyncToast`, `PhotoCarousel`, `WelcomeSplash`, `WelcomeButton` |

## Test Coverage

| Test File | Tests Component(s) |
|-----------|---------------------|
| `BottomNavigation.test.tsx` | `BottomNavigation` |
| `FullScreenImageViewer.test.tsx` | `FullScreenImageViewer` |
| `ImagePreview.test.tsx` | `ImagePreview` |
| `LoveNoteMessage.test.tsx` | `LoveNoteMessage` |
| `MessageInput.test.tsx` | `MessageInput` |
| `ScriptureOverview.test.tsx` | `ScriptureOverview` |
| `BookmarkFlag.test.tsx` | `BookmarkFlag` |
| `PerStepReflection.test.tsx` | `PerStepReflection` |
| `MessageCompose.test.tsx` | `MessageCompose` |
| `ReflectionSummary.test.tsx` | `ReflectionSummary` |
| `DailyPrayerReport.test.tsx` | `DailyPrayerReport` |
| `SoloReadingFlow.test.tsx` | `SoloReadingFlow` |

12 test files covering 12 components. Components with highest test priority appear to be the scripture-reading feature (6 test files) and love-notes feature (4 test files).

## Hooks Used by Components

| Hook | Source | Used By |
|------|--------|---------|
| `useAppStore` | Zustand store | 17 components (see State Connections) |
| `useLoveNotes` | `src/hooks/useLoveNotes.ts` | `LoveNotes`, `MessageInput` |
| `usePhotos` | `src/hooks/usePhotos.ts` | `PhotoGallery`, `PhotoUploader` |
| `useNetworkStatus` | `src/hooks/useNetworkStatus.ts` | `NetworkStatusIndicator`, `NetworkStatusDot`, `SoloReadingFlow`, `ScriptureOverview` |
| `usePartnerMood` | `src/hooks/usePartnerMood.ts` | `PartnerMoodDisplay` |
| `useAutoSave` | `src/hooks/useAutoSave.ts` | `SoloReadingFlow` |
| `useMotionConfig` | `src/hooks/useMotionConfig.ts` | `SoloReadingFlow`, `ScriptureOverview` |
| `useVibration` | `src/hooks/useVibration.ts` | `MessageInput` |
| `useRealtimeMessages` | `src/hooks/useRealtimeMessages.ts` | Via `useLoveNotes` |

---
