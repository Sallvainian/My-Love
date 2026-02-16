# Source Directory Structure

```
src/
  api/                          # Supabase API layer
    auth/                       # Authentication services
      actionService.ts          # Sign in, sign out, sign up actions
      sessionService.ts         # Session management, getSession, onAuthStateChange
      types.ts                  # Auth type definitions
      __tests__/                # Auth service unit tests
    validation/
      supabaseSchemas.ts        # Zod schemas for Supabase response validation
    authService.ts              # Legacy auth service (deprecated)
    errorHandlers.ts            # API error handling utilities
    interactionService.ts       # Poke/kiss CRUD + realtime subscriptions
    moodApi.ts                  # Paginated mood history queries
    moodSyncService.ts          # Mood upload/fetch, partner mood, broadcast
    partnerService.ts           # Partner search, request, accept/decline
    supabaseClient.ts           # Singleton Supabase client + partner ID helper

  components/                   # React UI components (feature-organized)
    AdminPanel/                 # Custom message CRUD admin interface
    CountdownTimer/             # Generic countdown timer component
    DailyMessage/               # Daily love message display with navigation
    DisplayNameSetup/           # Post-OAuth display name modal
    ErrorBoundary/              # Top-level error boundary (React class component)
    InteractionHistory/         # Poke/kiss interaction history display
    LoginScreen/                # Email/password login form
    MoodHistory/                # Calendar-based mood history with detail modal
    MoodTracker/                # Daily mood entry with partner mood display
    Navigation/                 # Bottom tab navigation bar
    PartnerMoodView/            # Partner mood + poke/kiss interface
    PhotoCarousel/              # Full-screen photo viewer with swipe
    PhotoDeleteConfirmation/    # Photo delete confirmation dialog
    PhotoEditModal/             # Photo caption/tag editing modal
    PhotoGallery/               # Photo grid with skeleton loading
    PhotoUpload/                # Photo upload form with compression
    PokeKissInterface/          # Poke/kiss send buttons
    RelationshipTimers/         # TimeTogether, BirthdayCountdown, EventCountdown
    Settings/                   # Theme picker, anniversary management
    ViewErrorBoundary/          # Per-view error boundary (keeps nav visible)
    WelcomeButton/              # Manual welcome splash trigger button
    WelcomeSplash/              # Animated welcome screen with floating hearts
    love-notes/                 # Love Notes chat UI
      LoveNotes.tsx             # Main chat container
      MessageList.tsx           # Message list with auto-scroll
      MessageInput.tsx          # Text input with image attachment
      LoveNoteMessage.tsx       # Individual message bubble
      ImagePreview.tsx          # Image preview in message compose
      FullScreenImageViewer.tsx # Full-screen image overlay
    photos/
      PhotoUploader.tsx         # Alternative photo upload component
    scripture-reading/          # Scripture reading feature
      containers/               # ScriptureOverview, SoloReadingFlow
      reading/                  # BookmarkFlag component
      reflection/               # PerStepReflection, ReflectionSummary, DailyPrayerReport, MessageCompose
    shared/                     # Cross-feature shared components
      NetworkStatusIndicator.tsx # Offline/connecting banner
      SyncToast.tsx             # Sync completion notification toast

  config/                       # Application configuration constants
    constants.ts                # APP_CONFIG: partner name, start date, user ID
    images.ts                   # IMAGE_COMPRESSION, IMAGE_VALIDATION, IMAGE_STORAGE, NOTES_CONFIG
    performance.ts              # PAGINATION, STORAGE_QUOTAS, VALIDATION_LIMITS
    relationshipDates.ts        # Birthdays, wedding, visits, time calculation helpers

  constants/
    animations.ts               # ANIMATION_TIMING and ANIMATION_VALUES constants

  data/                         # Static data and loaders
    defaultMessages.ts          # Default love message content
    defaultMessagesLoader.ts    # Async message loader
    scriptureSteps.ts           # Scripture reading step definitions (MAX_STEPS)

  hooks/                        # Custom React hooks
    index.ts                    # Barrel file for hook exports
    useAuth.ts                  # Supabase auth state subscription
    useAutoSave.ts              # Auto-save on visibility change / before unload
    useImageCompression.ts      # Image compression with status tracking
    useLoveNotes.ts             # Love Notes state + actions + realtime
    useMoodHistory.ts           # Paginated mood history from Supabase
    useMotionConfig.ts          # Framer Motion reduced-motion presets
    useNetworkStatus.ts         # Online/offline/connecting state detection
    usePartnerMood.ts           # Partner mood with realtime broadcast updates
    usePhotos.ts                # Photo CRUD with upload progress tracking
    useRealtimeMessages.ts      # Supabase Broadcast subscription for love notes
    useVibration.ts             # Vibration API wrapper for haptic feedback

  services/                     # Business logic and local persistence
    BaseIndexedDBService.ts     # Abstract IDB service base class
    customMessageService.ts     # Custom message CRUD in IndexedDB
    dbSchema.ts                 # IndexedDB schema: DB_NAME, DB_VERSION, STORE_NAMES, types
    imageCompressionService.ts  # Canvas-based image compression
    loveNoteImageService.ts     # Supabase Storage upload for love note images
    migrationService.ts         # LocalStorage-to-IndexedDB migration
    moodService.ts              # Mood CRUD with Zod validation in IndexedDB
    performanceMonitor.ts       # Runtime performance tracking
    photoService.ts             # Supabase photo CRUD with signed URLs
    photoStorageService.ts      # Low-level photo storage operations
    realtimeService.ts          # Supabase Realtime channel management
    scriptureReadingService.ts  # Scripture session CRUD via Supabase RPCs
    storage.ts                  # IndexedDB message storage service
    syncService.ts              # Sync coordination service

  stores/                       # Zustand state management
    types.ts                    # AppState, AppSlice, AppStateCreator, AppMiddleware
    useAppStore.ts              # Store creation with persist middleware
    slices/
      appSlice.ts               # Core: isLoading, error, __isHydrated
      settingsSlice.ts          # Settings, onboarding, theme, initialization
      navigationSlice.ts        # View routing with browser history
      messagesSlice.ts          # Messages, history, custom messages, import/export
      moodSlice.ts              # Mood entries, sync status, partner moods
      interactionsSlice.ts      # Poke/kiss interactions, realtime subscription
      partnerSlice.ts           # Partner connection, requests, search
      notesSlice.ts             # Love notes chat, send, pagination, rate limiting
      photosSlice.ts            # Photo upload, gallery, storage quota
      scriptureReadingSlice.ts  # Scripture sessions, steps, reflections, retry

  types/                        # TypeScript type definitions
    index.ts                    # Core types: Message, MoodEntry, Settings, Theme, etc.
    models.ts                   # Supabase model types: LoveNote, SupabasePhoto, etc.
    database.types.ts           # Auto-generated Supabase database types

  utils/                        # Pure utility functions
    backgroundSync.ts           # Background Sync API registration and SW listener
    calendarHelpers.ts          # Calendar grid generation utilities
    countdownService.ts         # Countdown timer calculation
    dateFormat.ts               # Date formatting utilities
    dateFormatters.ts           # Additional date display formatters
    dateHelpers.ts              # Date comparison and manipulation helpers
    deterministicRandom.ts      # Seed-based random number generation
    haptics.ts                  # Vibration API: triggerMoodSaveHaptic, triggerErrorHaptic
    interactionValidation.ts    # UUID validation, interaction type validation
    messageRotation.ts          # Deterministic daily message selection algorithm
    messageValidation.ts        # Message content validation
    moodEmojis.ts               # Mood type to emoji mapping
    moodGrouping.ts             # Mood entries grouping by date
    offlineErrorHandler.ts      # OfflineError class, withOfflineCheck, safeOfflineOperation
    performanceMonitoring.ts    # Scroll performance observer, memory measurement
    storageMonitor.ts           # LocalStorage quota monitoring and warnings
    themes.ts                   # Theme definitions and CSS variable application

  validation/                   # Zod validation schemas
    schemas.ts                  # All Zod schemas: Message, Photo, Mood, Settings, Scripture
    errorMessages.ts            # Zod error to user-friendly message conversion
    index.ts                    # Barrel file

  sw.ts                         # Custom Service Worker (Background Sync, caching)
  sw-db.ts                      # SW IndexedDB helpers (pending moods, auth token)
  sw-types.d.ts                 # Service Worker type declarations
  main.tsx                      # Application entry point
  App.tsx                       # Root component with routing and initialization
  index.css                     # Global styles: Tailwind imports, custom components
  vite-env.d.ts                 # Vite environment type declarations
```
