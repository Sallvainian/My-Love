# Source Directory Structure

```
src/
  api/                          # Supabase API layer (7 files)
    authService.ts              # Authentication (login, signup, session management)
    errorHandlers.ts            # Centralized API error handling
    interactionService.ts       # Poke/kiss/fart partner interactions
    moodApi.ts                  # Mood CRUD against Supabase
    moodSyncService.ts          # Bidirectional mood sync (local <-> remote)
    partnerService.ts           # Partner lookup and relationship queries
    supabaseClient.ts           # Singleton Supabase client with typed schema
    validation/
      supabaseSchemas.ts        # Zod schemas for Supabase response validation

  components/                   # React UI components (24 feature folders)
    AdminPanel/                 # Custom message CRUD admin interface
    CountdownTimer/             # Generic countdown display
    DailyMessage/               # Home view daily love message
    DisplayNameSetup/           # Post-auth display name form
    ErrorBoundary/              # Top-level error boundary
    InteractionHistory/         # Poke/kiss/fart history log
    LoginScreen/                # Email/password authentication
    MoodHistory/                # Calendar-based mood history
    MoodTracker/                # Mood selection and logging
    Navigation/                 # Bottom tab navigation bar
    PartnerMoodView/            # Partner mood display + interactions
    PhotoCarousel/              # Full-screen photo viewer
    PhotoDeleteConfirmation/    # Photo deletion dialog
    PhotoEditModal/             # Photo caption/tag editing
    PhotoGallery/               # Photo grid with lazy loading
    PhotoUpload/                # Photo upload with compression
    PokeKissInterface/          # Partner interaction buttons
    RelationshipTimers/         # Time together, birthday, event countdowns
    Settings/                   # App settings and preferences
    ViewErrorBoundary/          # Per-view error boundary (keeps nav visible)
    WelcomeButton/              # Manual welcome splash trigger
    WelcomeSplash/              # Timed welcome greeting screen
    love-notes/                 # Real-time messaging UI
    photos/                     # Photo uploader component
    scripture-reading/          # Scripture reading feature
      containers/               #   ScriptureOverview, SoloReadingFlow
      reading/                  #   BookmarkFlag
      reflection/               #   PerStepReflection, ReflectionSummary
    shared/                     # NetworkStatusIndicator, SyncToast

  config/                       # App configuration constants
    animations.ts               # Framer Motion animation presets
    constants.ts                # App-wide constants (user IDs, limits)
    images.ts                   # Image configuration
    performance.ts              # Performance thresholds and validation limits
    relationshipDates.ts        # Birthdays, wedding, visit dates

  constants/                    # Additional animation constants
    animations.ts

  data/                         # Static data
    defaultMessages.ts          # Built-in love messages by category
    scriptureSteps.ts           # Scripture reading step content

  hooks/                        # Custom React hooks (12 files)
    useAuth.ts                  # Authentication state hook
    useAutoSave.ts              # Debounced auto-save for forms
    useImageCompression.ts      # Image compression pipeline hook
    useLoveNotes.ts             # Love notes messaging state
    useMoodHistory.ts           # Mood history with calendar grouping
    useMotionConfig.ts          # Reduced motion preferences
    useNetworkStatus.ts         # Online/offline detection
    usePartnerMood.ts           # Partner mood realtime subscription
    usePhotos.ts                # Photo gallery state management
    useRealtimeMessages.ts      # Love notes realtime subscription
    useVibration.ts             # Haptic feedback hook

  services/                     # Business logic services (14 files)
    BaseIndexedDBService.ts     # Abstract generic CRUD for IndexedDB
    customMessageService.ts     # Custom message management
    dbSchema.ts                 # Shared IndexedDB schema (v1-v5 migrations)
    imageCompressionService.ts  # Canvas-based image compression
    loveNoteImageService.ts     # Love note image upload/download
    migrationService.ts         # LocalStorage -> IndexedDB migration
    moodService.ts              # Mood persistence (IndexedDB)
    performanceMonitor.ts       # Runtime performance tracking
    photoService.ts             # Photo business logic
    photoStorageService.ts      # Photo IndexedDB persistence
    realtimeService.ts          # Supabase Realtime channel management
    scriptureReadingService.ts  # Scripture session management
    storage.ts                  # Legacy storage utilities
    syncService.ts              # Generic sync orchestration

  stores/                       # Zustand state management
    useAppStore.ts              # Root store with persist middleware
    types.ts                    # AppState composition type
    slices/                     # 10 state slices
      appSlice.ts               #   Loading, error, hydration state
      interactionsSlice.ts      #   Partner interaction counts
      messagesSlice.ts          #   Daily message CRUD and rotation
      moodSlice.ts              #   Mood tracking and sync
      navigationSlice.ts        #   View routing state
      notesSlice.ts             #   Love notes messaging state
      partnerSlice.ts           #   Partner mood state
      photosSlice.ts            #   Photo gallery state
      scriptureReadingSlice.ts  #   Scripture session state
      settingsSlice.ts          #   User preferences

  types/                        # TypeScript type definitions
    database.types.ts           # Auto-generated Supabase schema types
    index.ts                    # Core app domain types
    models.ts                   # Additional model types

  utils/                        # Utility functions
    backgroundSync.ts           # Background Sync API helpers
    calendarHelpers.ts          # Calendar date utilities
    countdownService.ts         # Countdown calculation logic
    dateFormat.ts               # Date formatting utilities
    dateFormatters.ts           # Additional date formatters
    dateHelpers.ts              # Date helper functions
    haptics.ts                  # Haptic feedback API wrappers
    interactionValidation.ts    # Interaction input validation
    messageRotation.ts          # Daily message rotation algorithm
    messageValidation.ts        # Message input validation
    moodEmojis.ts               # Mood type -> emoji mapping
    moodGrouping.ts             # Mood grouping by date
    offlineErrorHandler.ts      # Offline-specific error handling
    performanceMonitoring.ts    # Performance metric utilities
    storageMonitor.ts           # Storage quota monitoring
    themes.ts                   # Theme application logic

  validation/                   # Zod validation schemas
    errorMessages.ts            # User-facing validation messages
    index.ts                    # Barrel export
    schemas.ts                  # All domain validation schemas

  sw.ts                         # Custom Service Worker (Workbox + Background Sync)
  sw-db.ts                      # IndexedDB access from Service Worker context
  sw-types.d.ts                 # Service Worker type declarations
  main.tsx                      # Application entry point
  App.tsx                       # Root component with auth + routing
```

---
