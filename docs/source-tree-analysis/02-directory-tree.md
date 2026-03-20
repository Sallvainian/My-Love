# Complete Directory Tree

Annotated file tree of `src/`, `tests/`, `supabase/`, `scripts/`, `.github/`, and `public/`.

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
    authService.ts                 # Auth facade (re-exports session + action services)
    moodSyncService.ts             # Mood sync: IndexedDB -> Supabase
    moodApi.ts                     # Mood CRUD via Supabase queries
    interactionService.ts          # Poke/kiss interaction service + realtime
    partnerService.ts              # Partner search, requests, linking
    errorHandlers.ts               # SupabaseServiceError, retryWithBackoff, handleNetworkError
    realtimeChannel.ts             # Shared private channel auth setup utility
    auth/
      sessionService.ts            # Session management, token storage for SW
      actionService.ts             # Auth actions (sign-in, sign-up, sign-out, Google OAuth)
      types.ts                     # Auth type definitions
      __tests__/
        authServices.test.ts       # Auth service unit tests
    validation/
      supabaseSchemas.ts           # Zod schemas for Supabase row types

  assets/                          # Static asset imports
    react.svg                      # React logo

  components/                      # React components (26 directories)
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
      LoginScreen.tsx              # Email/password + Google OAuth auth form
      LoginScreen.css
      index.ts
    love-notes/
      LoveNotes.tsx                # Chat container (messages + input)
      MessageList.tsx              # Virtualized message list (react-window)
      MessageInput.tsx             # Text input + image attachment
      LoveNoteMessage.tsx          # Single message bubble
      ImagePreview.tsx             # Image attachment preview
      FullScreenImageViewer.tsx    # Full-screen image overlay
      index.ts
      __tests__/
        FullScreenImageViewer.test.tsx
        ImagePreview.test.tsx
        LoveNoteMessage.test.tsx
        MessageInput.test.tsx
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
      __tests__/
        BottomNavigation.test.tsx
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
      index.ts                     # Barrel exports
      constants.ts                 # Scripture-specific constants
      motionFeatures.ts            # Framer Motion feature flags
      containers/
        ScriptureOverview.tsx      # Scripture reading entry point + stats
        SoloReadingFlow.tsx        # Solo reading session flow (decomposed into sub-hooks)
        LobbyContainer.tsx         # Together-mode lobby (broadcast + presence)
        ReadingContainer.tsx       # Together-mode reading session container
        ReadingPhaseView.tsx       # Reading phase view (props grouped into sub-objects)
        ReportPhaseView.tsx        # Report/completion phase view
      hooks/                       # Decomposed from SoloReadingFlow (2026-03-13 refactor)
        useReadingDialogs.ts       # Dialog state management
        useReadingNavigation.ts    # Step navigation logic
        useReportPhase.ts          # Report phase state
        useSessionPersistence.ts   # Session save/resume logic
        useSoloReadingFlow.ts      # Main solo reading flow orchestrator
      overview/
        StatsSection.tsx           # Couple completion stats display
      reading/
        BookmarkFlag.tsx           # Bookmark toggle for steps
        PartnerPosition.tsx        # Partner reading position indicator
        RoleIndicator.tsx          # Leader/follower role badge
      reflection/
        DailyPrayerReport.tsx      # Prayer/devotion report
        MessageCompose.tsx         # In-session chat compose
        ReflectionSummary.tsx      # Session summary view
      session/
        Countdown.tsx              # Session countdown timer
        DisconnectionOverlay.tsx   # Partner disconnect notification
        LockInButton.tsx           # Lock-in confirmation button
      __tests__/
        BookmarkFlag.test.tsx
        Countdown.test.tsx
        DailyPrayerReport.test.tsx
        DisconnectionOverlay.test.tsx
        LobbyContainer.test.tsx
        LockInButton.test.tsx
        MessageCompose.test.tsx
        PartnerPosition.test.tsx
        ReadingContainer.test.tsx
        ReflectionSummary.test.tsx
        RoleIndicator.test.tsx
        ScriptureOverview.test.tsx
        SoloReadingFlow.test.tsx
        StatsSection.test.tsx
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
    sentry.ts                      # initSentry, setSentryUser, clearSentryUser

  constants/                       # UI constants
    animations.ts                  # Animation timing and values

  data/                            # Static data
    defaultMessages.ts             # Default love messages (~1677 lines)
    defaultMessagesLoader.ts       # Lazy loader for default messages
    scriptureSteps.ts              # Scripture reading step definitions

  hooks/                           # React hooks (15: 1 barrel + 14 hooks)
    index.ts                       # Barrel exports
    useAuth.ts                     # Supabase auth state
    useAutoSave.ts                 # Scripture auto-save on visibility change
    useFocusTrap.ts                # Focus trap for modal dialogs (accessibility)
    useImageCompression.ts         # Image compression state wrapper
    useLoveNotes.ts                # Love notes + realtime composition
    useMoodHistory.ts              # Paginated mood history (Supabase API)
    useMotionConfig.ts             # Reduced motion preferences
    useNetworkStatus.ts            # Online/offline/connecting with debounce
    usePartnerMood.ts              # Partner mood + Broadcast realtime
    usePhotos.ts                   # Photo store consumer with auto-load
    useRealtimeMessages.ts         # Broadcast channel with backoff retry
    useScriptureBroadcast.ts       # Private broadcast channel lifecycle with retry
    useScripturePresence.ts        # Ephemeral presence for partner position tracking
    useVibration.ts                # Vibration API wrapper
    __tests__/
      useMotionConfig.test.ts
      useNetworkStatus.test.ts
      usePartnerMood.test.ts
      useRealtimeMessages.test.ts

  services/                        # Data services (14: 1 base + 13 concrete)
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
    scriptureReadingService.ts     # Online-first with IDB cache, error codes
    migrationService.ts            # localStorage -> IndexedDB migration
    performanceMonitor.ts          # Async operation timing
    __tests__/
      loveNoteImageService.test.ts

  stores/                          # Zustand state management
    useAppStore.ts                 # Main store (compose 11 slices + persist)
    types.ts                       # AppState, AppSlice, AuthSlice, AppStateCreator, AppMiddleware
    slices/
      appSlice.ts                  # Loading, error, hydration
      authSlice.ts                 # User identity (userId, email, isAuthenticated)
      settingsSlice.ts             # Settings, onboarding, theme, init
      navigationSlice.ts           # View routing (6 views, history.pushState)
      messagesSlice.ts             # Daily messages, history, favorites, CRUD
      moodSlice.ts                 # Mood tracking, sync, partner moods
      interactionsSlice.ts         # Poke/kiss interactions
      partnerSlice.ts              # Partner data, requests, search
      notesSlice.ts                # Love notes chat, rate limiting
      photosSlice.ts               # Photo gallery, upload progress
      scriptureReadingSlice.ts     # Scripture sessions, lobby, lock-in, stats

  types/                           # TypeScript type definitions
    index.ts                       # Core types (ThemeName, Message, MoodEntry, etc.)
    models.ts                      # Supabase models (LoveNote, etc.)
    database.types.ts              # Auto-generated Supabase database types (DO NOT EDIT)

  utils/                           # Utility functions (16 files)
    backgroundSync.ts              # Background Sync API registration
    calendarHelpers.ts             # Calendar grid calculations
    countdownService.ts            # Anniversary countdown calculations
    dateUtils.ts                   # Date formatting (relative time, timestamps, helpers)
    deterministicRandom.ts         # Seeded PRNG for render-safe values
    haptics.ts                     # Vibration API haptic patterns
    interactionValidation.ts       # UUID + interaction type validation
    logger.ts                      # Centralized logging (debug/info/log, replaces console.* across 48+ files)
    messageRotation.ts             # Deterministic daily message algorithm
    messageValidation.ts           # Love note validation + DOMPurify sanitize
    moodEmojis.ts                  # Mood type -> emoji mappings
    moodGrouping.ts                # Group moods by date for timeline
    offlineErrorHandler.ts         # OfflineError class, withOfflineCheck wrapper
    performanceMonitoring.ts       # Scroll perf + memory monitoring
    storageMonitor.ts              # localStorage quota monitoring
    themes.ts                      # Theme definitions + CSS variable application
    __tests__/
      (co-located unit tests)

  validation/                      # Zod validation layer
    schemas.ts                     # All Zod schemas (Message, Photo, Mood, Settings, Scripture)
    errorMessages.ts               # ValidationError class, formatZodError, getFieldErrors
    index.ts                       # Barrel exports
```

## Supabase Directory (`supabase/`)

```
supabase/
  config.toml                      # Local Supabase config (Postgres 17, ports, auth)
  seed.sql                         # Database seed data

  migrations/                      # SQL migrations (25 files)
    20251203000001_create_base_schema.sql
    20251203190800_create_photos_table.sql
    20251205000001_add_love_notes_images.sql
    20251205000002_add_mime_validation.sql
    20251206024345_remote_schema.sql
    20251206124803_fix_users_rls_policy.sql
    20251206200000_fix_users_update_privilege_escalation.sql
    20260128000001_scripture_reading.sql
    20260130000001_scripture_rpcs.sql
    20260204000001_unlinked_preset.sql
    20260205000001_fix_users_rls_recursion.sql
    20260206000001_enable_pgtap.sql
    20260217150353_scripture_couple_stats.sql
    20260217184551_optimize_couple_stats_rpc.sql
    20260220000001_scripture_lobby_and_roles.sql
    20260221000001_fix_function_search_paths.sql
    20260221211137_scripture_lobby_phase_guards.sql
    20260222000001_scripture_lock_in.sql
    20260228000001_scripture_end_session.sql
    20260301000100_fix_scripture_create_session_together_lobby.sql
    20260301000200_remove_server_side_broadcasts.sql
    20260309000001_at_reflection_preset.sql
    20260313000001_fix_lock_in_last_step.sql
    20260315044923_fix_avg_rating_precision.sql
    20260316031209_create_claude_bot_config.sql

  tests/                           # pgTAP database tests (14 files)
    database/
      00_helpers.sql               # Test helper functions
      01_schema.sql                # Schema validation tests
      02_rls_policies.sql          # RLS policy tests
      03_scripture_rpcs.sql        # Scripture RPC tests
      04_reflection_upsert.sql     # Reflection upsert tests
      05_bookmarks.sql             # Bookmark tests
      06_session_reflection.sql    # Session reflection tests
      07_messages.sql              # Message tests
      08_session_completion.sql    # Session completion tests
      09_scripture_couple_stats.sql # Couple stats tests
      10_scripture_lobby.sql       # Lobby tests
      11_scripture_lockin.sql      # Lock-in tests
      12_scripture_end_session.sql # End session tests
      13_scripture_create_session_together_semantics.sql

  functions/                       # Supabase Edge Functions
    upload-love-note-image/        # Image upload Edge Function
      index.ts                     # Handles multipart upload to Storage
```

## Test Directory (`tests/`)

```
tests/
  setup.ts                         # Global test setup (Vitest)
  README.md                        # Test directory documentation

  e2e/                             # E2E browser tests (Playwright, 28 specs)
    auth/                          # Login, logout, OAuth, display name (4 specs)
    home/                          # Error boundary, routing, welcome splash (3 specs)
    mood/                          # Mood tracker (1 spec)
    navigation/                    # Routing (1 spec)
    notes/                         # Love notes (1 spec)
    offline/                       # Network status (1 spec)
    partner/                       # Partner mood (1 spec)
    photos/                        # Gallery, upload (2 specs)
    scripture/                     # Overview, session, lobby, reading, reflection, stats, security, a11y (12+ specs)

  api/                             # API-level tests (4 Playwright specs)
  integration/                     # Integration tests (1 spec)
  unit/                            # Unit tests (Vitest + happy-dom, 27 files)

  support/                         # Test infrastructure
    merged-fixtures.ts             # Main test entry point
    auth/                          # Global auth setup, per-test setup, Supabase auth provider
    factories/                     # Test data factories (@faker-js/faker)
    fixtures/                      # Custom Playwright fixtures (auth, scripture-navigation, together-mode)
    helpers/                       # Utility functions (scripture-cache, scripture-lobby, together, supabase)
```

## Scripts Directory (`scripts/`)

```
scripts/                           # Utility scripts (12 files)
  dev-with-cleanup.sh              # Dev server with cleanup on exit
  test-with-cleanup.sh             # E2E tests with cleanup on exit
  burn-in.sh                       # Repeated test runs for flake detection
  ci-local.sh                      # Run CI checks locally
  smoke-tests.cjs                  # Post-build verification
  validate-messages.cjs            # Validate message data integrity
  perf-bundle-report.mjs           # Bundle size analysis report
  pw-failures.mjs                  # AI-friendly Playwright failure analysis
  post-deploy-check.cjs            # Post-deploy health check
  clear-caches.js                  # Clear dev caches
  inspect-db.sh                    # Inspect local Supabase database
  fetch_comments.py                # Fetch GitHub PR comments
```

## GitHub Directory (`.github/`)

```
.github/
  dependabot.yml                   # Dependabot configuration
  copilot-instructions.md          # GitHub Copilot instructions

  workflows/                       # GitHub Actions workflows (19 files)
    deploy.yml                     # Build + deploy to GitHub Pages (3 jobs)
    test.yml                       # Unit + E2E test suite
    bundle-size.yml                # Bundle size tracking
    codeql.yml                     # CodeQL security analysis
    dependency-review.yml          # Dependency review on PRs
    lighthouse.yml                 # Lighthouse performance audit
    supabase-migrations.yml        # Migration validation
    claude.yml                     # Claude AI assistant
    claude-code-review.yml         # Claude code review
    claude-flaky-tests.yml         # Auto-retry flaky tests on test completion
    ci-failure-auto-fix.yml        # Auto-fix CI failures
    manual-code-analysis.yml       # Manual code analysis trigger
    bmad-story-sync.yml            # BMAD story sync automation
    gemini-dispatch.yml            # Gemini AI dispatch
    gemini-invoke.yml              # Gemini AI invoke
    gemini-plan-execute.yml        # Gemini plan + execute
    gemini-review.yml              # Gemini code review
    gemini-scheduled-triage.yml    # Gemini scheduled triage
    gemini-triage.yml              # Gemini issue triage

  actions/                         # Custom composite actions
    setup-supabase/
      action.yml                   # Supabase CLI setup action

  codeql/
    codeql-config.yml              # CodeQL analysis configuration

  commands/                        # Gemini command configurations (5 TOML files)

  lighthouse/
    lighthouserc.json              # Lighthouse CI configuration
```

## Public Directory (`public/`)

```
public/
  404.html                         # GitHub Pages SPA fallback
  vite.svg                         # Vite logo (favicon)
  icons/
    icon.svg                       # App icon (SVG)
    icon-192.png                   # PWA icon 192x192
    icon-512.png                   # PWA icon 512x512
    react.svg                      # React logo
```

## Related Documentation

- [Entry Point Trace](./03-entry-point-trace.md)
- [Critical Code Paths](./04-critical-code-paths.md)
- [Technology Stack Summary](./01-technology-stack-summary.md)
