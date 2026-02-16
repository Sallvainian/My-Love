# Component Hierarchy

## Application Shell

```
<StrictMode>                                    // main.tsx
  <LazyMotion features={domAnimation}>          // main.tsx - tree-shakeable animations
    <App />                                     // src/App.tsx
```

## App.tsx Rendering Flow

`App.tsx` manages authentication, routing, and the overall application layout:

```
<App>
  |-- Auth check (useAuth hook -> Supabase auth.getUser)
  |
  |-- if (!authenticated)
  |     <LoginScreen />                         // Lazy-loaded
  |
  |-- if (authenticated && !hasDisplayName)
  |     <DisplayNameSetup />                    // Lazy-loaded
  |
  |-- if (authenticated && hasDisplayName)
  |     <ErrorBoundary>
  |       <WelcomeSplash />                     // 60-min interval splash
  |       <main>
  |         {renderCurrentView()}               // View switching
  |       </main>
  |       <BottomNavigation />                  // Tab bar
  |       <NetworkStatusIndicator />            // Online/offline banner
  |       <SyncToast />                         // Sync status notifications
  |     </ErrorBoundary>
```

## View Routing

Views are rendered conditionally based on `currentView` from `NavigationSlice`. All non-home views are lazy-loaded via `React.lazy()`:

```typescript
type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';
```

| View | Component | Lazy | Contains |
|------|-----------|------|----------|
| `home` | Inline in App.tsx | No | DailyMessage, RelationshipTimers, CountdownTimer |
| `photos` | `PhotoGallery` | Yes | PhotoGridItem, PhotoViewer, PhotoUpload, PhotoCarousel, PhotoEditModal, PhotoDeleteConfirmation |
| `mood` | `MoodTracker` | Yes | MoodButton, MoodHistoryItem, MoodHistoryTimeline, MoodHistoryCalendar, PartnerMoodDisplay, NoMoodLoggedState |
| `partner` | Inline partner view | Yes | PokeKissInterface, InteractionHistory, PartnerMoodView |
| `notes` | `LoveNotes` | Yes | MessageList, MessageInput, LoveNoteMessage, ImagePreview, FullScreenImageViewer |
| `scripture` | `ScriptureOverview` | Yes | SoloReadingFlow, PerStepReflection, BookmarkFlag, DailyPrayerReport, ReflectionSummary, MessageCompose |

## Component Directory Structure

```
src/components/
  AdminPanel/
    AdminPanel.tsx              # Message management admin panel
    CreateMessageForm.tsx       # New custom message form
    EditMessageForm.tsx         # Edit existing message form
    DeleteConfirmDialog.tsx     # Delete confirmation modal
    MessageList.tsx             # Message list container
    MessageRow.tsx              # Individual message row
  CountdownTimer/
    CountdownTimer.tsx          # Anniversary countdown display
    index.ts                   # Barrel export
  DailyMessage/
    DailyMessage.tsx            # Daily love message card with history nav
  DisplayNameSetup/
    DisplayNameSetup.tsx        # First-time display name entry
    index.ts
  ErrorBoundary/
    ErrorBoundary.tsx           # React error boundary wrapper
  InteractionHistory/
    InteractionHistory.tsx      # Poke/kiss history timeline
    index.ts
  LoginScreen/
    LoginScreen.tsx             # Email/password auth form
    index.ts
  love-notes/
    LoveNotes.tsx               # Chat container (messages + input)
    MessageList.tsx             # Virtualized message list
    MessageInput.tsx            # Text input with image attachment
    LoveNoteMessage.tsx         # Single message bubble
    ImagePreview.tsx            # Image attachment preview
    FullScreenImageViewer.tsx   # Full-screen image overlay
    index.ts
  MoodHistory/
    MoodHistoryCalendar.tsx     # Calendar grid view of moods
    CalendarDay.tsx             # Single calendar day cell
    MoodDetailModal.tsx         # Mood detail popup
    index.ts
  MoodTracker/
    MoodTracker.tsx             # Main mood tracking interface
    MoodButton.tsx              # Individual mood selection button
    MoodHistoryItem.tsx         # Single mood in timeline
    MoodHistoryTimeline.tsx     # Scrollable mood timeline
    NoMoodLoggedState.tsx       # Empty state placeholder
    PartnerMoodDisplay.tsx      # Partner's current mood display
  Navigation/
    BottomNavigation.tsx        # Bottom tab bar (6 tabs)
  PartnerMoodView/
    PartnerMoodView.tsx         # Partner mood history view
    index.ts
  PhotoCarousel/
    PhotoCarousel.tsx           # Full-screen photo carousel
    PhotoCarouselControls.tsx   # Carousel navigation controls
  PhotoDeleteConfirmation/
    PhotoDeleteConfirmation.tsx # Photo delete confirmation dialog
  PhotoEditModal/
    PhotoEditModal.tsx          # Photo caption/tag editor
  PhotoGallery/
    PhotoGallery.tsx            # Main photo grid view
    PhotoGridItem.tsx           # Single photo in grid
    PhotoGridSkeleton.tsx       # Loading skeleton
    PhotoViewer.tsx             # Photo detail viewer
  PhotoUpload/
    PhotoUpload.tsx             # Photo upload with compression
  photos/
    PhotoUploader.tsx           # Alternative photo upload component
  PokeKissInterface/
    PokeKissInterface.tsx       # Poke/kiss send interface
    index.ts
  RelationshipTimers/
    RelationshipTimers.tsx      # Timer container
    BirthdayCountdown.tsx       # Birthday countdown widget
    EventCountdown.tsx          # Generic event countdown
    TimeTogether.tsx            # Time since relationship start
    index.ts
  scripture-reading/
    containers/
      ScriptureOverview.tsx     # Scripture reading entry point
      SoloReadingFlow.tsx       # Solo reading session flow
    reading/
      BookmarkFlag.tsx          # Bookmark toggle for steps
    reflection/
      PerStepReflection.tsx     # Rating + notes per step
      ReflectionSummary.tsx     # Session summary view
      DailyPrayerReport.tsx     # Prayer/devotion report
      MessageCompose.tsx        # In-session chat compose
      charCounter.ts            # Character count utility
    motionFeatures.ts           # Framer Motion feature flags
    index.ts
  Settings/
    Settings.tsx                # Settings panel
    AnniversarySettings.tsx     # Anniversary management
    index.ts
  shared/
    NetworkStatusIndicator.tsx  # Online/offline status bar
    SyncToast.tsx               # Sync completion toast
    index.ts
  ViewErrorBoundary/
    ViewErrorBoundary.tsx       # Per-view error boundary
    index.ts
  WelcomeButton/
    WelcomeButton.tsx           # Welcome splash trigger
  WelcomeSplash/
    WelcomeSplash.tsx           # Animated welcome overlay
```

## Related Documentation

- [Navigation Architecture](./09-navigation.md)
- [State Management - React Hooks](../state-management/06-react-hooks.md)
