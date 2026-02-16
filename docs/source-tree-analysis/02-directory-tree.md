# Complete Directory Tree

## Source Directory (`src/`)

```
src/
  App.tsx                          # Main application component (auth, routing, sync setup)
  main.tsx                         # Entry point (StrictMode, LazyMotion, SW registration)
  index.css                        # Global CSS (Tailwind imports)
  sw.ts                            # Custom Service Worker (precache, cache strategies, sync)
  sw-db.ts                         # Service Worker IndexedDB helpers
  sw-types.d.ts                    # Service Worker type definitions
  vite-env.d.ts                    # Vite environment type declarations

  api/                             # Supabase API layer
    supabaseClient.ts              # Singleton Supabase client (typed with Database)
    authService.ts                 # Legacy auth service (sign-in/out)
    moodSyncService.ts             # Mood sync: IndexedDB -> Supabase
    moodApi.ts                     # Mood CRUD via Supabase queries
    interactionService.ts          # Poke/kiss interaction service + realtime
    partnerService.ts              # Partner search, requests, linking
    errorHandlers.ts               # API error handling utilities
    auth/
      sessionService.ts            # Session management, offline-safe auth
      actionService.ts             # Auth actions (sign-in, sign-up, sign-out)
      types.ts                     # Auth type definitions
    validation/
      supabaseSchemas.ts           # Zod schemas for Supabase row types

  components/                      # React components
    AdminPanel/
      AdminPanel.tsx               # Message management admin panel
      CreateMessageForm.tsx        # New custom message form
      EditMessageForm.tsx          # Edit existing message form
      DeleteConfirmDialog.tsx      # Delete confirmation modal
      MessageList.tsx              # Message list container
      MessageRow.tsx               # Individual message row
    CountdownTimer/
      CountdownTimer.tsx           # Anniversary countdown display
      index.ts
    DailyMessage/
      DailyMessage.tsx             # Daily love message card + history nav
    DisplayNameSetup/
      DisplayNameSetup.tsx         # First-time display name entry
      DisplayNameSetup.css
      index.ts
    ErrorBoundary/
      ErrorBoundary.tsx            # Global React error boundary
    InteractionHistory/
      InteractionHistory.tsx       # Poke/kiss history timeline
      index.ts
    LoginScreen/
      LoginScreen.tsx              # Email/password auth form
      LoginScreen.css
      index.ts
    love-notes/
      LoveNotes.tsx                # Chat container (messages + input)
      MessageList.tsx              # Virtualized message list
      MessageInput.tsx             # Text input + image attachment
      LoveNoteMessage.tsx          # Single message bubble
      ImagePreview.tsx             # Image attachment preview
      FullScreenImageViewer.tsx    # Full-screen image overlay
      index.ts
    MoodHistory/
      MoodHistoryCalendar.tsx      # Calendar grid view of moods
      CalendarDay.tsx              # Single calendar day cell
      MoodDetailModal.tsx          # Mood detail popup
      index.ts
    MoodTracker/
      MoodTracker.tsx              # Main mood tracking interface
      MoodButton.tsx               # Individual mood selection button
      MoodHistoryItem.tsx          # Single mood in timeline
      MoodHistoryTimeline.tsx      # Scrollable mood timeline
      NoMoodLoggedState.tsx        # Empty state placeholder
      PartnerMoodDisplay.tsx       # Partner's current mood display
    Navigation/
      BottomNavigation.tsx         # Bottom tab bar (6 tabs)
    PartnerMoodView/
      PartnerMoodView.tsx          # Partner mood history view
      index.ts
    PhotoCarousel/
      PhotoCarousel.tsx            # Full-screen photo carousel
      PhotoCarouselControls.tsx    # Carousel navigation controls
    PhotoDeleteConfirmation/
      PhotoDeleteConfirmation.tsx  # Photo delete confirmation
    PhotoEditModal/
      PhotoEditModal.tsx           # Photo caption/tag editor
    PhotoGallery/
      PhotoGallery.tsx             # Main photo grid view
      PhotoGridItem.tsx            # Single photo in grid
      PhotoGridSkeleton.tsx        # Loading skeleton
      PhotoViewer.tsx              # Photo detail viewer
    photos/
      PhotoUploader.tsx            # Alternative photo upload component
    PhotoUpload/
      PhotoUpload.tsx              # Photo upload with compression
    PokeKissInterface/
      PokeKissInterface.tsx        # Poke/kiss send interface
      index.ts
    RelationshipTimers/
      RelationshipTimers.tsx       # Timer container
      BirthdayCountdown.tsx        # Birthday countdown widget
      EventCountdown.tsx           # Generic event countdown
      TimeTogether.tsx             # Time since relationship start
      index.ts
    scripture-reading/
      containers/
        ScriptureOverview.tsx      # Scripture reading entry point
        SoloReadingFlow.tsx        # Solo reading session flow
      reading/
        BookmarkFlag.tsx           # Bookmark toggle for steps
      reflection/
        PerStepReflection.tsx      # Rating + notes per step
        ReflectionSummary.tsx      # Session summary view
        DailyPrayerReport.tsx      # Prayer/devotion report
        MessageCompose.tsx         # In-session chat compose
        charCounter.ts             # Character count utility
      motionFeatures.ts            # Framer Motion feature flags
      index.ts
    Settings/
      Settings.tsx                 # Settings panel
      AnniversarySettings.tsx      # Anniversary management
      Settings.css
      index.ts
    shared/
      NetworkStatusIndicator.tsx   # Online/offline status bar
      SyncToast.tsx                # Sync completion toast
      index.ts
    ViewErrorBoundary/
      ViewErrorBoundary.tsx        # Per-view error boundary
      index.ts
    WelcomeButton/
      WelcomeButton.tsx            # Welcome splash trigger
    WelcomeSplash/
      WelcomeSplash.tsx            # Animated welcome overlay

  config/                          # Application configuration
    constants.ts                   # APP_CONFIG (partner name, start date)
    performance.ts                 # Pagination, storage quotas, validation limits
    images.ts                      # Image compression/validation/storage config
    relationshipDates.ts           # Birthdays, wedding, visit dates

  constants/                       # UI constants
    animations.ts                  # Animation timing and values

  data/                            # Static data
    defaultMessages.ts             # Default love messages
    defaultMessagesLoader.ts       # Lazy loader for default messages
    scriptureSteps.ts              # Scripture reading step definitions

  hooks/                           # React hooks
    index.ts                       # Barrel exports
    useAuth.ts                     # Supabase auth state
    useAutoSave.ts                 # Scripture auto-save on visibility change
    useImageCompression.ts         # Image compression state wrapper
    useLoveNotes.ts                # Love notes + realtime composition
    useMoodHistory.ts              # Paginated mood history (Supabase API)
    useMotionConfig.ts             # Reduced motion preferences
    useNetworkStatus.ts            # Online/offline/connecting with debounce
    usePartnerMood.ts              # Partner mood + Broadcast realtime
    usePhotos.ts                   # Photo store consumer with auto-load
    useRealtimeMessages.ts         # Broadcast channel with backoff retry
    useVibration.ts                # Vibration API wrapper

  services/                        # Data services
    BaseIndexedDBService.ts        # Abstract CRUD for IndexedDB
    dbSchema.ts                    # Shared IndexedDB schema (v5, 8 stores)
    storage.ts                     # StorageService for messages + photos
    moodService.ts                 # MoodService (Zod validation, sync tracking)
    syncService.ts                 # SyncService (mood -> Supabase transform)
    customMessageService.ts        # CustomMessageService (CRUD, import/export)
    photoService.ts                # Supabase Storage operations
    photoStorageService.ts         # PhotoStorageService (IndexedDB, migration)
    imageCompressionService.ts     # Canvas API image compression
    loveNoteImageService.ts        # Edge Function upload, signed URL cache
    realtimeService.ts             # Realtime subscription management
    scriptureReadingService.ts     # Online-first with IDB cache
    migrationService.ts            # localStorage -> IndexedDB migration
    performanceMonitor.ts          # Async operation timing

  stores/                          # Zustand state management
    useAppStore.ts                 # Main store (compose 10 slices + persist)
    types.ts                       # AppState, AppSlice, AppStateCreator
    slices/
      appSlice.ts                  # Loading, error, hydration
      settingsSlice.ts             # Settings, onboarding, theme, init
      navigationSlice.ts           # View routing (no router library)
      messagesSlice.ts             # Daily messages, history, favorites, CRUD
      moodSlice.ts                 # Mood tracking, sync, partner moods
      interactionsSlice.ts         # Poke/kiss interactions
      partnerSlice.ts              # Partner data, requests, search
      notesSlice.ts                # Love notes chat, rate limiting
      photosSlice.ts               # Photo gallery, upload progress
      scriptureReadingSlice.ts     # Scripture sessions, optimistic UI

  types/                           # TypeScript type definitions
    index.ts                       # Core types (ThemeName, Message, MoodEntry, etc.)
    models.ts                      # Supabase models (LoveNote, etc.)
    database.types.ts              # Auto-generated Supabase database types

  utils/                           # Utility functions
    backgroundSync.ts              # Background Sync API registration
    calendarHelpers.ts             # Calendar grid calculations
    countdownService.ts            # Anniversary countdown calculations
    dateFormat.ts                  # Relative time formatting
    dateFormatters.ts              # Chat message timestamp formatting
    dateHelpers.ts                 # General date utilities
    deterministicRandom.ts         # Seeded PRNG for render-safe values
    haptics.ts                     # Vibration API haptic patterns
    interactionValidation.ts       # UUID + interaction type validation
    messageRotation.ts             # Deterministic daily message algorithm
    messageValidation.ts           # Love note validation + DOMPurify sanitize
    moodEmojis.ts                  # Mood type -> emoji mappings
    moodGrouping.ts                # Group moods by date for timeline
    offlineErrorHandler.ts         # OfflineError class, withOfflineCheck wrapper
    performanceMonitoring.ts       # Scroll perf + memory monitoring
    storageMonitor.ts              # localStorage quota monitoring
    themes.ts                      # Theme definitions + CSS variable application

  validation/                      # Zod validation layer
    schemas.ts                     # All Zod schemas (Message, Photo, Mood, Settings, etc.)
    errorMessages.ts               # ValidationError class, formatZodError, getFieldErrors
    index.ts                       # Barrel exports
```

## Related Documentation

- [Entry Point Trace](./03-entry-point-trace.md)
- [Critical Folders](./04-critical-folders.md)
