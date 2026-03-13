# Project Structure

Annotated layout of the full repository.

## Source Code (`src/`)

```
src/
  api/                              # Supabase API integration layer
    supabaseClient.ts               # Supabase client singleton (createClient with VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
    authService.ts                  # Authentication service
    auth/                           # Authentication service modules
      sessionService.ts             # getSession(), onAuthStateChange() -- session management
      actionService.ts              # signOut() and other auth actions
      types.ts                      # Auth-related TypeScript types
      __tests__/                    # Auth service unit tests
    moodApi.ts                      # Mood API calls
    moodSyncService.ts              # Mood data sync between IndexedDB and Supabase
    interactionService.ts           # Poke/kiss/fart partner interaction API calls
    partnerService.ts               # Partner data API calls
    errorHandlers.ts                # Centralized error handling utilities for API responses
    validation/
      supabaseSchemas.ts            # Zod schemas for Supabase response validation

  assets/                           # Static assets (SVGs, images)

  components/                       # React components organized by feature domain
    AdminPanel/                     # Admin interface (lazy-loaded)
      AdminPanel.tsx                # Main admin component
      CreateMessageForm.tsx         # Custom message creation
      EditMessageForm.tsx           # Custom message editing
      DeleteConfirmDialog.tsx       # Delete confirmation dialog
      MessageList.tsx               # Message list view
      MessageRow.tsx                # Individual message row
    CountdownTimer/                 # Countdown timer component
    DailyMessage/                   # Main message card with daily rotation logic
    DisplayNameSetup/               # Display name setup modal for new OAuth signups
    ErrorBoundary/                  # Top-level error boundary
    InteractionHistory/             # Partner interaction history
    LoginScreen/                    # Email/password authentication UI
    love-notes/                     # Real-time chat messaging between partners
      __tests__/                    # Component unit tests
    MoodHistory/                    # Mood history timeline
    MoodTracker/                    # Mood logging with emoji selection
    Navigation/
      BottomNavigation.tsx          # Bottom navigation bar
      __tests__/                    # Navigation unit tests
    PartnerMoodView/                # Partner mood real-time display via Supabase Realtime
    PhotoCarousel/                  # Photo carousel viewer (lazy-loaded modal)
    PhotoGallery/                   # Photo grid with lazy loading (react-window)
    PhotoUpload/                    # Photo upload dialog (lazy-loaded modal)
    PokeKissInterface/              # Playful partner interactions (poke, kiss, fart)
    RelationshipTimers/             # TimeTogether, BirthdayCountdown, EventCountdown
    scripture-reading/              # Scripture reading flow (solo/together modes, reflection)
      containers/                   # Container components (ESLint enforces no direct Supabase imports)
      overview/
        StatsSection.tsx            # Scripture statistics display
      motionFeatures.ts             # Framer Motion feature bundle
      __tests__/                    # Scripture component unit tests
    Settings/                       # User settings component
    shared/                         # Shared UI components
      NetworkStatusIndicator.tsx    # Offline/connecting banner
      SyncToast.tsx                 # Background sync completion feedback toast
    ViewErrorBoundary/              # Per-view error boundary (preserves BottomNavigation)
    WelcomeSplash/                  # Welcome splash screen (lazy-loaded)

  config/
    constants.ts                    # APP_CONFIG (partner name, start date), USER_ID, PARTNER_NAME
    images.ts                       # Image asset configuration
    performance.ts                  # Pagination, storage quotas, validation limits
    relationshipDates.ts            # Relationship date configuration for timers
    sentry.ts                       # Sentry error tracking initialization

  constants/
    animations.ts                   # Animation constant values

  data/
    defaultMessages.ts              # 365 pre-written love messages (5 categories x 73 each)
    defaultMessagesLoader.ts        # Lazy loader for default messages (code splitting)

  hooks/                            # Custom React hooks
    useAuth.ts                      # Authentication hook
    useImageCompression.ts          # Image compression hook
    useMoodHistory.ts               # Mood history data hook
    useNetworkStatus.ts             # Online/offline detection hook
    usePhotos.ts                    # Photo management hook
    useRealtimeMessages.ts          # Realtime message subscription hook
    useScriptureBroadcast.ts        # Supabase Realtime for scripture together mode
    useVibration.ts                 # Haptic feedback hook
    __tests__/                      # Hook unit tests

  services/
    customMessageService.ts         # Custom message CRUD
    imageCompressionService.ts      # Image compression utility
    migrationService.ts             # LocalStorage to IndexedDB migration
    moodService.ts                  # Mood tracking service
    performanceMonitor.ts           # Operation timing and metrics (singleton)
    photoStorageService.ts          # Photo storage management
    realtimeService.ts              # Supabase Realtime subscription management
    scriptureReadingService.ts      # Scripture reading session service
    storage.ts                      # IndexedDB and localStorage utilities
    syncService.ts                  # Data synchronization service

  stores/
    useAppStore.ts                  # Zustand store composed from 10 slices
    slices/
      appSlice.ts                   # App-level state (loading, errors, initialization)
      settingsSlice.ts              # User settings and preferences
      navigationSlice.ts            # Navigation and routing state (setView, currentView)
      messagesSlice.ts              # Daily love message selection and rotation
      moodSlice.ts                  # Mood tracking entries, history, sync
      interactionsSlice.ts          # Partner interactions (pokes, kisses, farts)
      partnerSlice.ts               # Partner data, status, and linking
      notesSlice.ts                 # Love notes chat messages
      photosSlice.ts                # Photo gallery state
      scriptureReadingSlice.ts      # Scripture reading sessions, progress, reflection

  sw.ts                             # Custom service worker (InjectManifest strategy)
  sw-db.ts                          # Service worker IndexedDB utilities
  sw-types.d.ts                     # TypeScript declarations for service worker context

  types/
    index.ts                        # Application TypeScript type definitions
    models.ts                       # Domain model types
    database.types.ts               # Auto-generated from Supabase schema (DO NOT EDIT MANUALLY)

  utils/
    backgroundSync.ts               # Background sync and service worker utilities
    calendarHelpers.ts              # Calendar date utilities
    countdownService.ts             # Countdown timer calculation
    dateFormatters.ts               # Date display formatting
    dateHelpers.ts                  # Date calculation utilities
    deterministicRandom.ts          # Deterministic random number generation
    haptics.ts                      # Haptic feedback utilities
    interactionValidation.ts        # Interaction input validation
    messageRotation.ts              # Daily message selection algorithm
    moodEmojis.ts                   # Mood emoji definitions
    moodGrouping.ts                 # Mood data grouping for history
    offlineErrorHandler.ts          # Offline-aware error handling
    performanceMonitoring.ts        # Scroll performance and memory monitoring
    storageMonitor.ts               # Storage quota monitoring
    themes.ts                       # Theme configurations + applyTheme()
    __tests__/                      # Utility unit tests

  validation/
    errorMessages.ts                # User-facing validation error messages
    index.ts                        # Validation module exports

  main.tsx                          # App entry point: StrictMode, LazyMotion, SW registration
  App.tsx                           # Root component: auth gate, routing, lazy loading, sync
  index.css                         # Global CSS entry point (Tailwind directives)
  vite-env.d.ts                     # Vite environment type declarations
```

## Tests (`tests/`)

```
tests/
  setup.ts                          # Vitest setup: fake-indexeddb, matchMedia/IntersectionObserver/ResizeObserver mocks

  unit/                             # Vitest unit tests (happy-dom environment)
    services/                       # IndexedDB schema and service tests
    utils/                          # Date formatting, mood grouping, message rotation tests
    validation/                     # Zod schema validation tests

  e2e/                              # Playwright E2E browser tests
    auth/                           # Login, logout
    home/                           # Home view
    mood/                           # Mood tracking
    navigation/                     # View routing
    notes/                          # Love notes chat
    offline/                        # Offline handling
    partner/                        # Partner interactions
    photos/                         # Photo gallery
    scripture/                      # Scripture reading (solo + together mode)

  api/                              # API-level tests (Playwright-based, against Supabase endpoints)

  integration/                      # Integration tests (Playwright integration project)

  support/                          # Test infrastructure
    merged-fixtures.ts              # Main test entry point: import { test, expect } from here
    auth/
      global-setup.ts               # Global auth setup (creates user pairs per parallel worker)
    fixtures/
      index.ts                      # Custom Playwright fixtures (supabaseAdmin, testSession)
    factories/
      index.ts                      # Test data factories
    helpers.ts                      # Shared E2E helper functions
    helpers/
      scripture-lobby.ts            # Scripture lobby helpers
      scripture-together.ts         # Scripture together mode helpers
    reporters/
      failure-summary-reporter.ts   # Custom Playwright reporter for failure summaries
```

## Supabase (`supabase/`)

```
supabase/
  config.toml                       # Local Supabase configuration (ports, auth, storage, realtime)
  seed.sql                          # Database seed data for local development
  migrations/                       # 23 SQL migration files (YYYYMMDDHHmmss_description.sql format)
  tests/
    database/                       # 14 pgTAP database test files
```

Key `config.toml` settings:

| Setting                   | Value                  |
| ------------------------- | ---------------------- |
| Project ID                | `My-Love`              |
| API port                  | `54321`                |
| DB port                   | `54322`                |
| Shadow DB port            | `54320`                |
| Postgres version          | `17`                   |
| Studio port               | `54323`                |
| Inbucket (email) port     | `54324`                |
| Storage file size limit   | `50MiB`                |
| Auth: email/password      | Enabled                |
| Auth: anonymous sign-ins  | Disabled               |
| Auth: email confirmations | Disabled (development) |
| Realtime                  | Enabled                |
| Edge Runtime              | Deno 2                 |

## Scripts (`scripts/`)

```
scripts/
  dev-with-cleanup.sh               # Dev server with signal trapping (SIGINT/SIGTERM/EXIT) and process cleanup
  test-with-cleanup.sh              # E2E test runner with signal trapping and process cleanup
  burn-in.sh                        # Flaky test detection (configurable iterations, default 10)
  ci-local.sh                       # Mirror CI pipeline locally (lint, unit, E2E, burn-in x3)
  smoke-tests.cjs                   # Pre-deploy build validation (dist/ structure, manifests, bundles)
  post-deploy-check.cjs             # Live site health check (HTTP, manifest, service worker guidance)
  pw-failures.mjs                   # Playwright failure summarizer (AI-friendly Markdown, dated artifact folders)
  clear-caches.js                   # Browser console script to clear all caches (IndexedDB, localStorage, SW)
  validate-messages.cjs             # 365-message library validation (count, categories, duplicates, length distribution)
  perf-bundle-report.mjs            # Bundle size analysis (raw + gzip, generates Markdown report)
  inspect-db.sh                     # Remote database inspection (tables, row counts, RLS policies, columns)
  fetch_comments.py                 # Fetch PR conversation comments, reviews, and review threads via GitHub GraphQL API
```

## CI/CD (`.github/`)

```
.github/
  actions/
    setup-supabase/
      action.yml                    # Composite action: install CLI v2.72.7, start local, apply migrations, export credentials

  workflows/
    # Core pipelines
    deploy.yml                      # Build + smoke test + deploy to GitHub Pages + health check
    test.yml                        # Full test pipeline: lint, unit, DB, integration, API, E2E P0 gate, E2E sharded, burn-in

    # Database
    supabase-migrations.yml         # Migration validation on PRs touching supabase/ paths

    # AI: Claude
    claude.yml                      # Claude Code for @claude mentions in issues/PRs (claude-opus-4-6)
    claude-code-review.yml          # Automated PR code review with Claude /review skill
    manual-code-analysis.yml        # On-demand commit summarization or security review
    ci-failure-auto-fix.yml         # Auto-fix CI failures with Claude Code on non-main branches

    # AI: Gemini
    gemini-dispatch.yml             # Central dispatcher: routes to triage/review/invoke/plan-execute
    gemini-review.yml               # PR code review with Gemini CLI + GitHub MCP server
    gemini-triage.yml               # AI-powered issue labeling
    gemini-scheduled-triage.yml     # Hourly batch triage of unlabeled issues
    gemini-invoke.yml               # General-purpose Gemini CLI invocation
    gemini-plan-execute.yml         # Plan execution with write access

    # Quality and security
    bundle-size.yml                 # Bundle size tracking and regression detection (brotli)
    lighthouse.yml                  # Lighthouse PWA performance audit
    codeql.yml                      # CodeQL security analysis (javascript-typescript)
    dependency-review.yml           # Dependency vulnerability scanning (fails on moderate+)

    # Project management
    bmad-story-sync.yml             # BMAD workflow story synchronization on issue close

  codeql/
    codeql-config.yml               # CodeQL security analysis configuration
```

## Configuration Files (Root)

```
fnox.toml                           # Age-encrypted secrets (Supabase, Sentry) -- safe to commit
.mise.toml                          # Tool versions (Node 24.13.0) + env vars
.node-version                       # Node version file for CI (24.13.0)
.env.example                        # Template showing required variables
.env.test                           # Plain-text local Supabase values for E2E testing
.prettierrc                         # Prettier config (100 char width, single quotes, tailwind plugin)
.prettierignore                     # Prettier ignore rules
.gitignore                          # Git ignore (node_modules, dist, .env, test artifacts)
CLAUDE.md                           # Claude Code guidance (architecture, commands, conventions)
AGENTS.md                           # AI coding agent guidance (architecture, E2E patterns, conventions)
eslint.config.js                    # ESLint flat config (typescript-eslint, react-hooks, react-refresh)
index.html                          # HTML entry point with SPA redirect handler for GitHub Pages
package.json                        # npm scripts, dependencies, browserslist
playwright.config.ts                # Playwright: projects (chromium, api, integration), sharding, auto dev server
postcss.config.js                   # PostCSS plugins (@tailwindcss/postcss, autoprefixer)
tailwind.config.js                  # Tailwind: custom colors, fonts, animations, keyframes
tsconfig.json                       # TypeScript project references root
tsconfig.app.json                   # App TypeScript config (ES2022, strict, react-jsx, path aliases)
tsconfig.node.json                  # Node TypeScript config (vite.config.ts, vitest.config.ts)
tsconfig.test.json                  # Test TypeScript config (extends app, adds vitest/jest-dom types)
vite.config.ts                      # Vite: base path, manual chunks, PWA, visualizer, checker, Sentry
vitest.config.ts                    # Vitest: happy-dom, @/ alias, coverage thresholds, JUnit, tdd-guard
```
