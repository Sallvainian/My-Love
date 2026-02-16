# Project Structure

Annotated layout of the full repository.

## Source Code (`src/`)

```
src/
  api/                              # Supabase API integration layer
    supabaseClient.ts               # Supabase client singleton (createClient with VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
    auth/                           # Authentication service modules
      sessionService.ts             # getSession(), onAuthStateChange() -- session management
      actionService.ts              # signOut() and other auth actions
    moodSyncService.ts              # Mood data sync between IndexedDB and Supabase
    interactionService.ts           # Poke/kiss/fart partner interaction API calls
    errorHandlers.ts                # Centralized error handling utilities for API responses

  assets/                           # Static assets (SVGs, images, fonts)

  components/                       # React components organized by feature domain
    AdminPanel/                     # Admin interface (lazy-loaded, accessed via /admin route)
    DailyMessage/                   # Main message card with daily rotation logic
    DisplayNameSetup/               # Display name setup modal for new OAuth signups
    ErrorBoundary/                  # Top-level error boundary (wraps LoginScreen, WelcomeSplash, AdminPanel)
    LoginScreen/                    # Email/password authentication UI
    love-notes/                     # Real-time chat messaging between partners
    MoodTracker/                    # Mood logging with emoji selection (12 emoji options)
    Navigation/                     # Bottom navigation bar (BottomNavigation component)
    PartnerMoodView/                # Partner mood real-time display via Supabase Realtime + poke/kiss/fart
    PhotoCarousel/                  # Photo carousel viewer (lazy-loaded modal)
    PhotoGallery/                   # Photo grid with lazy loading (react-window) and Supabase Storage
    PhotoUpload/                    # Photo upload dialog (lazy-loaded modal)
    PokeKissInterface/              # Playful partner interactions (poke, kiss, fart)
    RelationshipTimers/             # TimeTogether, BirthdayCountdown, EventCountdown components
    scripture-reading/              # Scripture reading flow (solo/together modes, reflection)
      containers/                   # Container components (ESLint enforces no direct Supabase imports)
    shared/                         # Shared UI components
      NetworkStatusIndicator.tsx    # Offline/connecting banner
      SyncToast.tsx                 # Background sync completion feedback toast
    ViewErrorBoundary/              # Per-view error boundary (preserves BottomNavigation on errors)
    WelcomeSplash/                  # Welcome splash screen (lazy-loaded, 60-minute display interval)

  config/
    constants.ts                    # APP_CONFIG (partner name, start date), USER_ID, PARTNER_NAME
    relationshipDates.ts            # RELATIONSHIP_DATES (birthdays, wedding, visits)

  constants/                        # Additional constant values

  data/
    defaultMessages.ts              # 365 pre-written love messages (5 categories x 73 each)
    defaultMessagesLoader.ts        # Lazy loader for default messages (code splitting)
    scriptureSteps.ts               # 17 scripture steps with NKJV verses and response prayers

  hooks/                            # Custom React hooks
    useScriptureBroadcast.ts        # Supabase Realtime hook for scripture together mode

  services/
    BaseIndexedDBService.ts         # Base CRUD class for IndexedDB operations
    dbSchema.ts                     # IndexedDB schema definition (version 5)
    migrationService.ts             # LocalStorage to IndexedDB migration (custom messages)
    scriptureReadingService.ts      # Scripture reading API adapter (legacy Supabase exception)
    storage.ts                      # IndexedDB and localStorage utilities

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
  sw-db.ts                          # Service worker IndexedDB operations (isolated from app code)
  sw-types.d.ts                     # TypeScript declarations for service worker context

  types/
    index.ts                        # Application TypeScript type definitions
    database.types.ts               # Auto-generated from Supabase schema (DO NOT EDIT MANUALLY)

  utils/
    backgroundSync.ts               # Background sync utilities (isServiceWorkerSupported check)
    messageRotation.ts              # Daily message selection algorithm
    storageMonitor.ts               # Storage quota monitoring (logStorageQuota, development mode)
    themes.ts                       # Theme configurations (Sunset, Ocean, Lavender, Rose) + applyTheme()
    dateHelpers.ts                  # Date formatting and calculation utilities

  validation/
    schemas.ts                      # Zod validation schemas for runtime data validation
    errorMessages.ts                # User-facing validation error messages

  main.tsx                          # App entry point: StrictMode, LazyMotion (domAnimation), SW registration
  App.tsx                           # Root component: auth gate, routing, lazy loading, sync orchestration
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
    auth/                           # Login, logout, OAuth, display name setup
    home/                           # Home view, welcome splash, error boundary
    mood/                           # Mood tracker and mood history
    navigation/                     # Bottom nav tabs, routing between views
    notes/                          # Love notes messaging between partners
    offline/                        # Network status indicator, data sync on reconnect
    partner/                        # Partner mood view, poke/kiss interactions
    photos/                         # Photo gallery display and upload flow
    scripture/                      # Scripture overview, session flow, reflection, test data seeding

  api/                              # API-level tests (Playwright-based, against Supabase endpoints)

  support/                          # Test infrastructure
    merged-fixtures.ts              # Main test entry point: import { test, expect } from here
    auth-setup.ts                   # Worker-isolated auth setup (creates user pairs per parallel worker)
    fixtures/
      index.ts                      # Custom Playwright fixtures (supabaseAdmin, testSession)
      scripture-navigation.ts       # Scripture-specific navigation fixtures
      worker-auth.ts                # Worker-isolated auth fixtures for parallel test safety
    factories/
      index.ts                      # Test data factories (createTestSession, cleanupTestSession, linkTestPartners)
    helpers/
      index.ts                      # Utility exports
      supabase.ts                   # Supabase admin client for test setup
```

## Supabase (`supabase/`)

```
supabase/
  config.toml                       # Local Supabase configuration (ports, auth, storage, realtime)
  seed.sql                          # Database seed data for local development
  migrations/                       # SQL migration files (YYYYMMDDHHmmss_description.sql format)
  tests/
    database/                       # pgTAP database tests
```

Key `config.toml` settings:

| Setting | Value |
|---|---|
| Project ID | `My-Love` |
| API port | `54321` |
| DB port | `54322` |
| Shadow DB port | `54320` |
| Postgres version | `17` |
| Studio port | `54323` |
| Inbucket (email) port | `54324` |
| Analytics port | `54327` |
| Storage file size limit | `50MiB` |
| Auth: email/password | Enabled |
| Auth: anonymous sign-ins | Disabled |
| Auth: email confirmations | Disabled (development) |
| Realtime | Enabled |
| Edge Runtime | Deno 2 |

## Scripts (`scripts/`)

```
scripts/
  dev-with-cleanup.sh               # Dev server with signal trapping (SIGINT/SIGTERM/EXIT) and process cleanup
  test-with-cleanup.sh              # E2E test runner with signal trapping and process cleanup
  burn-in.sh                        # Flaky test detection (configurable iterations, default 10)
  ci-local.sh                       # Mirror CI pipeline locally (lint, unit, E2E, burn-in)
  smoke-tests.cjs                   # Pre-deploy build validation (dist/ structure, manifests, bundles)
  post-deploy-check.cjs             # Live site health check (HTTP, manifest, service worker guidance)
  clear-caches.js                   # Browser console script to clear all caches (IndexedDB, localStorage, SW)
  validate-messages.cjs             # 365-message library validation (count, categories, duplicates)
  perf-bundle-report.mjs            # Bundle size analysis (raw + gzip, generates Markdown report)
  inspect-db.sh                     # Database inspection utility for local Supabase
```

## CI/CD (`.github/`)

```
.github/
  actions/
    setup-supabase/
      action.yml                    # Composite action: install CLI, start local, apply migrations, export credentials

  workflows/
    deploy.yml                      # Build + smoke test + deploy to GitHub Pages + health check
    test.yml                        # Full test pipeline: lint, unit, E2E P0 gate, E2E sharded, burn-in, merge reports
    supabase-migrations.yml         # Migration validation on PRs touching supabase/ paths
    claude.yml                      # Claude Code for @claude mentions in issues/PRs
    claude-code-review.yml          # Automated PR code review with Claude
    manual-code-analysis.yml        # On-demand commit summarization or security review
    ci-failure-auto-fix.yml         # Auto-fix CI failures with Claude Code on non-main branches

  dependabot.yml                    # Weekly npm + GitHub Actions dependency updates (Monday)
  codeql/
    codeql-config.yml               # CodeQL security analysis (security-extended + security-and-quality)
```

## Configuration Files (Root)

```
.env                                # Encrypted environment variables (safe to commit)
.env.example                        # Template showing required variables
.env.test                           # Plain-text local Supabase values for E2E testing
.nvmrc                              # Node version: v24.13.0
.prettierrc                         # Prettier config (100 char width, single quotes, tailwind plugin)
.prettierignore                     # Prettier ignore rules
.gitignore                          # Git ignore (node_modules, dist, .env.keys, test artifacts)
CLAUDE.md                           # Claude Code guidance (architecture, commands, conventions)
currents.config.ts                  # Currents.dev Playwright reporting (projectId: "uvT2TP")
eslint.config.js                    # ESLint flat config (typescript-eslint, react-hooks, react-refresh)
index.html                          # HTML entry point with SPA redirect handler for GitHub Pages
package.json                        # npm scripts, dependencies, browserslist
playwright.config.ts                # Playwright: projects (setup, chromium, api), sharding, auto dev server
postcss.config.js                   # PostCSS plugins (@tailwindcss/postcss, autoprefixer)
tailwind.config.js                  # Tailwind: custom colors, fonts, animations, keyframes
tsconfig.json                       # TypeScript project references root
tsconfig.app.json                   # App TypeScript config (ES2022, strict, react-jsx)
tsconfig.node.json                  # Node TypeScript config (vite.config.ts, vitest.config.ts)
vite.config.ts                      # Vite: base path, manual chunks, PWA, visualizer, checker
vitest.config.ts                    # Vitest: happy-dom, @/ alias, coverage 80%, JUnit, tdd-guard
```
