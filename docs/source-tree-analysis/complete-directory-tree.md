# Complete Directory Tree

```
src/
  api/                              # Supabase API layer
    auth/                           # Authentication services
      actionService.ts              # signIn, signUp, signOut, resetPassword, signInWithGoogle
      sessionService.ts             # getSession, getUser, getCurrentUserId, onAuthStateChange
      types.ts                      # AuthCredentials, AuthResult, AuthStatus type definitions
      __tests__/                    # Auth service unit tests
    validation/
      supabaseSchemas.ts            # Zod schemas for Supabase response validation
    authService.ts                  # Legacy auth service (deprecated, replaced by auth/)
    errorHandlers.ts                # API error handling utilities
    interactionService.ts           # Poke/kiss CRUD + realtime Broadcast subscriptions
    moodApi.ts                      # Paginated mood history queries (offset-based)
    moodSyncService.ts              # Mood upload/fetch to Supabase, partner mood Broadcast
    partnerService.ts               # Partner search, request, accept/decline
    supabaseClient.ts               # Singleton Supabase client + getPartnerId() helper

  components/                       # React UI components (feature-organized)
    AdminPanel/                     # Custom message CRUD admin interface
    CountdownTimer/                 # Generic countdown timer with interval updates
    DailyMessage/                   # Daily love message display with prev/next navigation
    DisplayNameSetup/               # Post-OAuth display name modal
    ErrorBoundary/                  # Top-level error boundary (React class component)
    InteractionHistory/             # Poke/kiss interaction history display
    LoginScreen/                    # Email/password + Google OAuth login form
    MoodHistory/                    # Calendar-based mood history with detail modal
    MoodTracker/                    # Daily mood entry with multi-mood selection
    Navigation/                     # Bottom tab navigation bar (BottomNavigation)
    PartnerMoodView/                # Partner mood display + poke/kiss interface
    PhotoCarousel/                  # Full-screen photo viewer with swipe gestures
    PhotoDeleteConfirmation/        # Photo delete confirmation dialog
    PhotoEditModal/                 # Photo caption/tag editing modal
    PhotoGallery/                   # Photo grid with skeleton loading states
    PhotoUpload/                    # Photo upload form with compression progress
    PokeKissInterface/              # Poke/kiss send buttons with haptic feedback
    RelationshipTimers/             # TimeTogether, BirthdayCountdown, EventCountdown
    Settings/                       # Theme picker, anniversary management
    ViewErrorBoundary/              # Per-view error boundary (keeps nav visible)
    WelcomeButton/                  # Manual welcome splash trigger button
    WelcomeSplash/                  # Animated welcome screen with floating hearts
    love-notes/                     # Love Notes chat UI
      LoveNotes.tsx                 # Main chat container
      MessageList.tsx               # Message list with auto-scroll to bottom
      MessageInput.tsx              # Text input with image attachment button
      LoveNoteMessage.tsx           # Individual message bubble (sent/received)
      ImagePreview.tsx              # Image preview in message compose area
      FullScreenImageViewer.tsx     # Full-screen image overlay for viewing
    photos/
      PhotoUploader.tsx             # Alternative photo upload component
    scripture-reading/              # Scripture reading feature
      containers/                   # ScriptureOverview, SoloReadingFlow
      reading/                      # BookmarkFlag component
      reflection/                   # PerStepReflection, ReflectionSummary, DailyPrayerReport, MessageCompose
    shared/                         # Cross-feature shared components
      NetworkStatusIndicator.tsx    # Offline/connecting banner (top of viewport)
      SyncToast.tsx                 # Sync completion notification toast

  config/                           # Application configuration constants
    constants.ts                    # APP_CONFIG: partnerName='Gracie', startDate='2025-10-18'
    images.ts                       # IMAGE_COMPRESSION (2048px, 0.8), IMAGE_VALIDATION (25MB), NOTES_CONFIG
    performance.ts                  # PAGINATION (20), STORAGE_QUOTAS (80%/95%), VALIDATION_LIMITS
    relationshipDates.ts            # Birthdays, wedding date, visits, time calculation helpers

  constants/
    animations.ts                   # ANIMATION_TIMING and ANIMATION_VALUES constants

  data/                             # Static data and loaders
    defaultMessages.ts              # Default love message content (4 categories)
    defaultMessagesLoader.ts        # Async message loader (dynamic import)
    scriptureSteps.ts               # Scripture reading step definitions (MAX_STEPS)

  hooks/                            # Custom React hooks
    index.ts                        # Barrel: useNetworkStatus, useAutoSave, useLoveNotes, useVibration, useMotionConfig
    useAuth.ts                      # Supabase auth state subscription
    useAutoSave.ts                  # Auto-save on visibility change / before unload
    useImageCompression.ts          # Image compression with idle/compressing/complete/error status
    useLoveNotes.ts                 # Love Notes facade: fetch, send, retry, realtime, cleanup
    useMoodHistory.ts               # Paginated mood history (PAGE_SIZE=50)
    useMotionConfig.ts              # Framer Motion presets with reduced-motion support
    useNetworkStatus.ts             # Online/offline/connecting with 1500ms debounce
    usePartnerMood.ts               # Partner mood fetch + Broadcast subscription
    usePhotos.ts                    # Photo CRUD with upload progress tracking
    useRealtimeMessages.ts          # Broadcast subscription with exponential backoff retry
    useVibration.ts                 # Vibration API with feature detection

  services/                         # Business logic and local persistence
    BaseIndexedDBService.ts         # Abstract IDB service base class
    customMessageService.ts         # Custom message CRUD in IndexedDB (create, update, delete, export, import)
    dbSchema.ts                     # IndexedDB schema: DB_NAME='my-love-db', DB_VERSION=4, STORE_NAMES
    imageCompressionService.ts      # Canvas-based compression (2048px max, 80% JPEG quality)
    loveNoteImageService.ts         # Supabase Storage upload for love note images
    migrationService.ts             # LocalStorage-to-IndexedDB migration (custom messages)
    moodService.ts                  # Mood CRUD with Zod validation in IndexedDB
    performanceMonitor.ts           # Runtime performance tracking utilities
    photoService.ts                 # Supabase photo CRUD with signed URLs
    photoStorageService.ts          # Low-level photo storage operations
    realtimeService.ts              # Supabase Realtime channel management helpers
    scriptureReadingService.ts      # Scripture session CRUD via Supabase RPCs
    storage.ts                      # IndexedDB message storage service (init, CRUD, bulk operations)
    syncService.ts                  # Sync coordination service

  stores/                           # Zustand state management
    types.ts                        # AppState, AppSlice, AppStateCreator, AppMiddleware
    useAppStore.ts                  # Store creation with persist middleware + validation
    slices/
      appSlice.ts                   # Core: isLoading, error, __isHydrated
      settingsSlice.ts              # Settings, onboarding, theme, initializeApp
      navigationSlice.ts            # View routing (ViewType) with browser history
      messagesSlice.ts              # Messages, history Map, custom messages, import/export
      moodSlice.ts                  # Mood entries, 3-layer sync, partner moods
      interactionsSlice.ts          # Poke/kiss interactions, realtime subscription
      partnerSlice.ts               # Partner connection, requests, search
      notesSlice.ts                 # Love notes chat, optimistic send, rate limiting
      photosSlice.ts                # Photo upload with progress, storage quota
      scriptureReadingSlice.ts      # Scripture sessions, steps, reflections, retry

  types/                            # TypeScript type definitions
    index.ts                        # Core: Message, MoodEntry, Settings, Theme, ThemeName, etc.
    models.ts                       # Supabase models: LoveNote, LoveNotesState, SendMessageInput
    database.types.ts               # Auto-generated Supabase database types

  utils/                            # Pure utility functions
    backgroundSync.ts               # registerBackgroundSync, setupServiceWorkerListener
    calendarHelpers.ts              # Calendar grid generation utilities
    countdownService.ts             # Countdown timer calculation
    dateFormat.ts                   # Date formatting utilities
    dateFormatters.ts               # Additional date display formatters
    dateHelpers.ts                  # Date comparison and manipulation helpers
    deterministicRandom.ts          # Seed-based random number generation
    haptics.ts                      # triggerMoodSaveHaptic(50ms), triggerErrorHaptic([100,50,100])
    interactionValidation.ts        # UUID validation, interaction type validation
    messageRotation.ts              # Deterministic daily message selection (hash-based)
    messageValidation.ts            # Message content validation
    moodEmojis.ts                   # Mood type to emoji mapping
    moodGrouping.ts                 # Mood entries grouping by date
    offlineErrorHandler.ts          # OfflineError class, withOfflineCheck, safeOfflineOperation
    performanceMonitoring.ts        # Scroll PerformanceObserver, Chrome memory API
    storageMonitor.ts               # LocalStorage quota estimation and warnings
    themes.ts                       # 4 themes (sunset, ocean, lavender, rose), CSS variable application

  validation/                       # Zod validation schemas
    schemas.ts                      # All schemas: Message, Photo, Mood, Settings, Scripture
    errorMessages.ts                # Zod error to user-friendly message conversion
    index.ts                        # Barrel file

  sw.ts                             # Custom Service Worker (Background Sync, Workbox caching)
  sw-db.ts                          # SW IndexedDB helpers (pending moods, auth token)
  sw-types.d.ts                     # Service Worker type declarations
  main.tsx                          # Application entry point (StrictMode, LazyMotion, PWA registration)
  App.tsx                           # Root component (auth, routing, initialization, sync)
  index.css                         # Global styles (Tailwind imports, custom components, animations)
  vite-env.d.ts                     # Vite environment type declarations
```
