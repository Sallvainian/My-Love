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
    authService.ts                 # Legacy auth service (sign-in/out)
    moodSyncService.ts             # Mood sync: IndexedDB -> Supabase
    moodApi.ts                     # Mood CRUD via Supabase queries
    interactionService.ts          # Poke/kiss interaction service + realtime
    partnerService.ts              # Partner search, requests, linking
    errorHandlers.ts               # SupabaseServiceError, retryWithBackoff, handleNetworkError
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
      motionFeatures.ts            # Framer Motion feature flags
      containers/
        ScriptureOverview.tsx      # Scripture reading entry point + stats
        SoloReadingFlow.tsx        # Solo reading session flow
        LobbyContainer.tsx         # Together-mode lobby (broadcast + presence)
        ReadingContainer.tsx       # Together-mode reading session container
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
    defaultMessages.ts             # Default love messages
    defaultMessagesLoader.ts       # Lazy loader for default messages
    scriptureSteps.ts              # Scripture reading step definitions

  hooks/                           # React hooks (14: 1 barrel + 13 hooks)
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
    useAppStore.ts                 # Main store (compose 10 slices + persist)
    types.ts                       # AppState, AppSlice, AppStateCreator
    slices/
      appSlice.ts                  # Loading, error, hydration
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

  utils/                           # Utility functions (17 files)
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
    __tests__/
      (co-located unit tests)

  validation/                      # Zod validation layer
    schemas.ts                     # All Zod schemas (Message, Photo, Mood, Settings, Scripture)
    errorMessages.ts               # ValidationError class, formatZodError, getFieldErrors
    index.ts                       # Barrel exports
```

## Test Directory (`tests/`)

```
tests/
  setup.ts                         # Global test setup (Vitest)
  README.md                        # Test directory documentation

  e2e/                             # E2E browser tests (Playwright)
    example.spec.ts                # Example/template spec
    auth/
      display-name-setup.spec.ts   # Display name onboarding flow
      google-oauth.spec.ts         # Google OAuth sign-in
      login.spec.ts                # Email/password login
      logout.spec.ts               # Logout flow
    home/
      error-boundary.spec.ts       # Error boundary recovery
      welcome-splash.spec.ts       # Welcome splash animation
    mood/
      mood-tracker.spec.ts         # Mood tracking E2E
    navigation/
      routing.spec.ts              # View routing + URL sync
    notes/
      love-notes.spec.ts           # Love notes chat E2E
    offline/
      network-status.spec.ts       # Offline indicator + sync
    partner/
      partner-mood.spec.ts         # Partner mood view
    photos/
      photo-gallery.spec.ts        # Photo gallery browsing
      photo-upload.spec.ts         # Photo upload + compression
    scripture/
      scripture-accessibility.spec.ts     # a11y checks (axe-core)
      scripture-lobby-4.1.spec.ts         # Together-mode lobby flow
      scripture-lobby-4.1-p2.spec.ts      # Lobby P2 edge cases
      scripture-overview.spec.ts          # Overview + navigation
      scripture-reading-4.2.spec.ts       # Together reading session
      scripture-reconnect-4.3.spec.ts     # Disconnect/reconnect resilience
      scripture-reflection-2.2.spec.ts    # Reflection submission
      scripture-reflection-2.3.spec.ts    # Reflection edge cases
      scripture-rls-security.spec.ts      # RLS policy verification
      scripture-seeding.spec.ts           # Database seeding tests
      scripture-session.spec.ts           # Session lifecycle
      scripture-solo-reading.spec.ts      # Solo reading flow
      scripture-stats.spec.ts             # Couple stats display

  api/                             # API-level tests (Playwright)
    scripture-lobby-4.1.spec.ts    # Lobby RPC tests
    scripture-reflection-2.2.spec.ts  # Reflection RPC tests
    scripture-reflection-2.3.spec.ts  # Reflection edge case RPCs
    scripture-reflection-rpc.spec.ts  # Reflection RPC validation

  integration/                     # Integration tests
    example-rpc.spec.ts            # RPC integration example

  unit/                            # Unit tests (Vitest + happy-dom)
    data/
      scriptureSteps.test.ts       # Scripture step data validation
    hooks/
      useAutoSave.test.ts          # Auto-save hook
      useScriptureBroadcast.reconnect.test.ts  # Broadcast reconnect
      useScriptureBroadcast.test.ts             # Broadcast lifecycle
      useScripturePresence.reconnect.test.ts    # Presence reconnect
      useScripturePresence.test.ts              # Presence tracking
    services/
      dbSchema.indexes.test.ts     # IndexedDB index validation
      dbSchema.test.ts             # IndexedDB schema tests
      moodService.test.ts          # Mood service CRUD
      scriptureReadingService.cache.test.ts  # Scripture cache behavior
      scriptureReadingService.crud.test.ts   # Scripture CRUD
      scriptureReadingService.service.test.ts # Scripture service layer
      scriptureReadingService.stats.test.ts  # Scripture stats
    stores/
      moodSlice.test.ts            # Mood slice state
      scriptureReadingSlice.lobby.test.ts    # Lobby slice logic
      scriptureReadingSlice.lockin.test.ts   # Lock-in slice logic
      scriptureReadingSlice.reconnect.test.ts # Reconnect slice logic
      scriptureReadingSlice.stats.test.ts    # Stats slice logic
      scriptureReadingSlice.test.ts          # Scripture slice core
      settingsSlice.initializeApp.test.ts    # App initialization
    utils/
      dateFormat.test.ts           # Date formatting
      interactionValidation.test.ts # Interaction validation
      messageRotation.test.ts      # Message rotation algorithm
      messageValidation.test.ts    # Message validation + sanitize
      moodGrouping.test.ts         # Mood grouping logic
      offlineErrorHandler.test.ts  # Offline error handling
    validation/
      schemas.test.ts              # Zod schema validation

  support/                         # Test infrastructure
    helpers.ts                     # Shared test helpers (root)
    merged-fixtures.ts             # Merged Playwright fixtures
    auth/
      global-setup.ts             # Global auth setup (JWT signing)
      setup.ts                    # Per-test auth setup
      supabase-auth-provider.ts   # Supabase auth provider fixture
    factories/
      index.ts                    # Test data factories (@faker-js/faker)
    fixtures/
      auth.ts                    # Auth fixture (ES256 JWT)
      index.ts                   # Fixture barrel exports
      scripture-navigation.ts    # Scripture navigation helpers
      together-mode.ts           # Together-mode test fixtures
    helpers/
      index.ts                   # Helper barrel exports
      scripture-cache.ts         # Scripture cache test helpers
      scripture-lobby.ts         # Lobby test helpers
      scripture-together.ts      # Together-mode test helpers
      supabase.ts                # Supabase client test helpers
```

## Supabase Directory (`supabase/`)

```
supabase/
  config.toml                      # Local Supabase config (Postgres 17, ports, auth)
  seed.sql                         # Database seed data

  migrations/                      # SQL migrations (21 files)
    20251203000001_create_base_schema.sql            # Users, moods, interactions, messages
    20251203190800_create_photos_table.sql            # Photos table + storage bucket
    20251205000001_add_love_notes_images.sql          # Love note image support
    20251205000002_add_mime_validation.sql            # MIME type validation trigger
    20251206024345_remote_schema.sql                  # Remote schema sync
    20251206124803_fix_users_rls_policy.sql           # RLS policy fix
    20251206200000_fix_users_update_privilege_escalation.sql  # Privilege escalation fix
    20260128000001_scripture_reading.sql              # Scripture reading tables
    20260130000001_scripture_rpcs.sql                 # Scripture RPC functions
    20260204000001_unlinked_preset.sql                # Unlinked preset support
    20260205000001_fix_users_rls_recursion.sql        # RLS recursion fix
    20260206000001_enable_pgtap.sql                   # pgTAP extension
    20260217150353_scripture_couple_stats.sql          # Couple stats RPC
    20260217184551_optimize_couple_stats_rpc.sql       # Stats RPC optimization
    20260220000001_scripture_lobby_and_roles.sql       # Together-mode lobby + roles
    20260221000001_fix_function_search_paths.sql       # Function search path fix
    20260221211137_scripture_lobby_phase_guards.sql    # Lobby phase guard constraints
    20260222000001_scripture_lock_in.sql               # Lock-in mechanism
    20260228000001_scripture_end_session.sql           # End session RPC
    20260301000100_fix_scripture_create_session_together_lobby.sql  # Together lobby fix
    20260301000200_remove_server_side_broadcasts.sql   # Remove server-side broadcasts

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
      13_scripture_create_session_together_semantics.sql  # Together semantics tests

  functions/                       # Supabase Edge Functions
    upload-love-note-image/        # Image upload Edge Function
      index.ts                     # Handles multipart upload to Storage

  snippets/                        # SQL snippets (development utilities)
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

  workflows/                       # GitHub Actions workflows (18 files)
    deploy.yml                     # Build + deploy to GitHub Pages (3 jobs)
    test.yml                       # Unit + E2E test suite
    bundle-size.yml                # Bundle size tracking
    codeql.yml                     # CodeQL security analysis
    dependency-review.yml          # Dependency review on PRs
    lighthouse.yml                 # Lighthouse performance audit
    supabase-migrations.yml        # Migration validation
    claude.yml                     # Claude AI assistant
    claude-code-review.yml         # Claude code review
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

  commands/                        # Gemini command configurations
    gemini-invoke.toml
    gemini-plan-execute.toml
    gemini-review.toml
    gemini-scheduled-triage.toml
    gemini-triage.toml

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

## Root Configuration Files

```
/                                  # Project root
  index.html                       # SPA entry HTML (references src/main.tsx)
  package.json                     # Dependencies + npm scripts
  package-lock.json                # npm lockfile
  vite.config.ts                   # Vite build config (base path, chunks, PWA, Sentry)
  vitest.config.ts                 # Vitest config (happy-dom, 25% coverage, @/ alias)
  playwright.config.ts             # Playwright config (ES256 JWT, 3 projects)
  tsconfig.json                    # Base TypeScript config
  tsconfig.app.json                # App-specific TS config (src/)
  tsconfig.node.json               # Node-specific TS config (vite, scripts)
  tsconfig.test.json               # Test-specific TS config
  eslint.config.js                 # ESLint flat config (no-explicit-any = error)
  postcss.config.js                # PostCSS config (Tailwind)
  tailwind.config.js               # Tailwind CSS v4 config
  fnox.toml                        # Age-encrypted secrets (committed, safe)
  .mise.toml                       # Tool versions (Node 24.13.0) + env vars
  CLAUDE.md                        # Claude Code project instructions
  AGENTS.md                        # AI agent instructions
  README.md                        # Project README
  license.md                       # License
```

## Related Documentation

- [Entry Point Trace](./03-entry-point-trace.md)
- [Critical Folders](./04-critical-folders.md)
- [Technology Stack Summary](./01-technology-stack-summary.md)
