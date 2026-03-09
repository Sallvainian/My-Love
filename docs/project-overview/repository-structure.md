# Repository Structure

```
My-Love/
|-- .github/
|   |-- actions/
|   |   +-- setup-supabase/           # Composite action: install Supabase CLI, start local, apply migrations, export credentials
|   |-- codeql/
|   |   +-- codeql-config.yml         # CodeQL security analysis (security-extended + security-and-quality)
|   |-- workflows/
|   |   |-- bmad-story-sync.yml      # BMAD method story sync automation
|   |   |-- bundle-size.yml          # Bundle size tracking on PRs
|   |   |-- ci-failure-auto-fix.yml  # Auto-fix CI failures with Claude Code on non-main branches
|   |   |-- claude-code-review.yml   # Automated PR code review with Claude (/review skill)
|   |   |-- claude.yml              # Claude Code for @claude mentions in issues/PRs
|   |   |-- codeql.yml              # CodeQL security scanning
|   |   |-- dependency-review.yml    # Dependency vulnerability review on PRs
|   |   |-- deploy.yml              # Build + smoke test + deploy to GitHub Pages + health check
|   |   |-- gemini-dispatch.yml     # Gemini AI dispatch workflow
|   |   |-- gemini-invoke.yml       # Gemini AI invocation
|   |   |-- gemini-plan-execute.yml # Gemini AI plan execution
|   |   |-- gemini-review.yml       # Gemini AI code review
|   |   |-- gemini-scheduled-triage.yml # Gemini AI scheduled triage
|   |   |-- gemini-triage.yml       # Gemini AI issue triage
|   |   |-- lighthouse.yml          # Lighthouse performance auditing
|   |   |-- manual-code-analysis.yml # On-demand commit summarization or security review
|   |   |-- supabase-migrations.yml # Migration validation on PRs touching supabase/ paths
|   |   +-- test.yml                # Full test pipeline: lint, unit, E2E, merge reports
|   +-- dependabot.yml              # Weekly npm + GitHub Actions dependency updates
|
|-- _bmad-output/
|   |-- implementation-artifacts/    # Sprint status, story files, retrospectives
|   |   +-- sprint-status.yaml      # Machine-readable epic/story status tracking
|   |-- planning-artifacts/          # BMAD method planning documents
|   |   |-- prd/                    # Product Requirements Document
|   |   +-- epics/                  # Epic breakdowns with story definitions and ACs
|   +-- test-artifacts/             # Test reviews, NFR assessments, traceability
|
|-- docs/                            # Project documentation (9 sections)
|   |-- api-reference/              # Supabase client, auth, services, validation, SW, realtime
|   |-- architecture/               # 19 architecture documents + index
|   |-- component-inventory/        # Component hierarchy, patterns, state connections
|   |-- data-models/                # Database schema, IndexedDB, types, Zod, RLS, migrations
|   |-- development-guide/          # Developer onboarding, scripts, testing, troubleshooting
|   |-- performance/                # Bundle reports, baselines
|   |-- project-overview/           # This section: architecture, features, deployment
|   |-- source-tree-analysis/       # Directory tree, entry point trace, critical folders
|   +-- state-management/           # Zustand store config, slices, persistence, hooks
|
|-- public/
|   |-- 404.html                    # GitHub Pages SPA redirect handler
|   +-- icons/                      # PWA icons (icon-192.png, icon-512.png, icon.svg)
|
|-- scripts/
|   |-- burn-in.sh                   # Flaky test detection (configurable iterations, default 10)
|   |-- ci-local.sh                  # Mirror CI pipeline locally (lint, unit, E2E, burn-in)
|   |-- clear-caches.js             # Browser console script to clear all caches
|   |-- dev-with-cleanup.sh         # Dev server with signal trapping and process cleanup
|   |-- fetch_comments.py           # GitHub PR comment fetcher
|   |-- inspect-db.sh              # Database inspection utility for local Supabase
|   |-- perf-bundle-report.mjs      # Bundle size analysis (raw + gzip, generates Markdown report)
|   |-- post-deploy-check.cjs       # Live site health check (HTTP, manifest, service worker)
|   |-- pw-failures.mjs             # Playwright failure analysis (AI-friendly Markdown summary)
|   |-- smoke-tests.cjs            # Pre-deploy build validation (dist/ structure, manifests, bundles)
|   |-- test-with-cleanup.sh       # E2E test runner with signal trapping and process cleanup
|   +-- validate-messages.cjs      # 365-message library validation (count, categories, duplicates)
|
|-- src/
|   |-- api/                         # Supabase API integration layer
|   |   |-- supabaseClient.ts        # Client singleton (typed with Database schema)
|   |   |-- auth/                    # Auth service modules
|   |   |   |-- actionService.ts     # signIn, signUp, signOut, resetPassword, signInWithGoogle
|   |   |   |-- sessionService.ts    # getSession, getUser, getCurrentUserId, onAuthStateChange
|   |   |   +-- types.ts            # Auth type definitions
|   |   |-- authService.ts           # Legacy auth re-export
|   |   |-- errorHandlers.ts         # SupabaseServiceError, retry with backoff, offline messages
|   |   |-- interactionService.ts    # Poke/kiss interaction CRUD
|   |   |-- moodApi.ts              # Mood CRUD operations
|   |   |-- moodSyncService.ts      # Mood sync with Supabase
|   |   |-- partnerService.ts       # Partner data fetching
|   |   +-- validation/
|   |       +-- supabaseSchemas.ts   # Zod schemas for all Supabase API responses
|   |-- assets/                      # Static assets
|   |-- components/                  # React components organized by feature (26 directories)
|   |   |-- AdminPanel/              # Admin interface (6 files: panel, forms, list, row, dialog)
|   |   |-- CountdownTimer/          # Generic countdown component
|   |   |-- DailyMessage/            # Main message card with rotation
|   |   |-- DisplayNameSetup/        # OAuth display name setup modal
|   |   |-- ErrorBoundary/           # Top-level error boundary
|   |   |-- InteractionHistory/      # Partner interaction history
|   |   |-- LoginScreen/             # Email/password + Google OAuth login UI
|   |   |-- love-notes/              # Real-time chat (6 files: notes, input, list, message, image)
|   |   |-- MoodHistory/             # Calendar view, day component, detail modal
|   |   |-- MoodTracker/             # Mood logging (6 files: tracker, button, history, timeline)
|   |   |-- Navigation/              # Bottom navigation bar
|   |   |-- PartnerMoodView/         # Partner mood real-time display + poke/kiss
|   |   |-- PhotoCarousel/           # Photo carousel viewer + controls
|   |   |-- PhotoDeleteConfirmation/ # Photo delete confirmation dialog
|   |   |-- PhotoEditModal/          # Photo caption editor
|   |   |-- PhotoGallery/            # Photo grid (4 files: gallery, item, skeleton, viewer)
|   |   |-- PhotoUpload/             # Photo upload dialog
|   |   |-- photos/                  # PhotoUploader utility component
|   |   |-- PokeKissInterface/       # Playful partner interactions
|   |   |-- RelationshipTimers/      # TimeTogether, BirthdayCountdown, EventCountdown
|   |   |-- scripture-reading/       # Scripture reading flow
|   |   |   |-- containers/          # Container components (4: overview, solo, lobby, reading)
|   |   |   |-- overview/            # StatsSection component
|   |   |   |-- reading/             # BookmarkFlag, PartnerPosition, RoleIndicator
|   |   |   |-- reflection/          # DailyPrayerReport, MessageCompose, ReflectionSummary
|   |   |   +-- session/             # Countdown, DisconnectionOverlay, LockInButton
|   |   |-- Settings/                # Theme and relationship settings
|   |   |-- shared/                  # NetworkStatusIndicator, SyncToast
|   |   |-- ViewErrorBoundary/       # Per-view error boundary (preserves navigation)
|   |   +-- WelcomeButton/           # Welcome splash trigger button
|   |       +-- WelcomeSplash/       # Welcome splash screen
|   |-- config/
|   |   |-- constants.ts             # Partner name, start date, feature flags (APP_CONFIG)
|   |   |-- images.ts               # Image configuration
|   |   |-- performance.ts          # Pagination, storage quotas, validation limits
|   |   |-- relationshipDates.ts    # Birthday, wedding, and visit date configurations
|   |   +-- sentry.ts              # Sentry initialization, user context, PII stripping
|   |-- constants/
|   |   +-- animations.ts           # Animation constant values
|   |-- data/
|   |   |-- defaultMessages.ts       # 365 pre-written love messages (5 categories, 73 each)
|   |   |-- defaultMessagesLoader.ts # Lazy loader for default messages
|   |   +-- scriptureSteps.ts        # 17 scripture steps with NKJV verses and response prayers
|   |-- hooks/                       # Custom React hooks (14 hooks)
|   |   |-- useAuth.ts              # Authentication state hook
|   |   |-- useAutoSave.ts          # Auto-save with debounce
|   |   |-- useImageCompression.ts  # Image compression hook
|   |   |-- useLoveNotes.ts         # Love notes chat state + realtime subscription
|   |   |-- useMoodHistory.ts       # Mood history data access
|   |   |-- useMotionConfig.ts      # Framer Motion reduced-motion config
|   |   |-- useNetworkStatus.ts     # Online/offline detection
|   |   |-- usePartnerMood.ts       # Partner mood with realtime updates
|   |   |-- usePhotos.ts            # Photo gallery state + upload
|   |   |-- useRealtimeMessages.ts  # Supabase Realtime message subscription
|   |   |-- useScriptureBroadcast.ts # Scripture session broadcast channel lifecycle
|   |   |-- useScripturePresence.ts # Scripture partner position tracking
|   |   +-- useVibration.ts         # Haptic feedback hook
|   |-- services/                    # Business logic services (14 files)
|   |   |-- BaseIndexedDBService.ts  # Base CRUD class for IndexedDB operations
|   |   |-- dbSchema.ts             # IndexedDB schema definition (v5, 8 object stores)
|   |   |-- customMessageService.ts # Custom message CRUD in IndexedDB
|   |   |-- imageCompressionService.ts # Client-side image compression
|   |   |-- loveNoteImageService.ts # Love note image handling
|   |   |-- migrationService.ts     # LocalStorage to IndexedDB migration
|   |   |-- moodService.ts          # Mood CRUD in IndexedDB
|   |   |-- performanceMonitor.ts   # Performance monitoring utilities
|   |   |-- photoService.ts         # Photo operations (Supabase Storage)
|   |   |-- photoStorageService.ts  # Photo IndexedDB storage
|   |   |-- realtimeService.ts      # Supabase Realtime subscription singleton
|   |   |-- scriptureReadingService.ts # Scripture reading API adapter + IndexedDB cache
|   |   |-- storage.ts              # IndexedDB and localStorage utilities
|   |   +-- syncService.ts          # Generic sync orchestration
|   |-- stores/
|   |   |-- useAppStore.ts          # Zustand store composed from 10 slices
|   |   |-- types.ts                # AppState type definition
|   |   +-- slices/                 # Individual slice files (10 slices)
|   |       |-- appSlice.ts         # App initialization, loading, hydration
|   |       |-- interactionsSlice.ts # Poke/kiss interactions
|   |       |-- messagesSlice.ts    # Daily love messages, favorites
|   |       |-- moodSlice.ts        # Mood tracking, sync, partner mood
|   |       |-- navigationSlice.ts  # View routing (6 views)
|   |       |-- notesSlice.ts       # Love notes chat
|   |       |-- partnerSlice.ts     # Partner data, display name
|   |       |-- photosSlice.ts      # Photo gallery state
|   |       |-- scriptureReadingSlice.ts # Scripture sessions, broadcast, lock-in
|   |       +-- settingsSlice.ts    # Theme, relationship config
|   |-- sw.ts                        # Custom service worker (InjectManifest strategy)
|   |-- sw-db.ts                     # Service worker IndexedDB operations (isolated from app code)
|   |-- sw-types.d.ts                # TypeScript declarations for service worker context
|   |-- types/
|   |   |-- index.ts                # Application TypeScript type definitions
|   |   |-- models.ts              # Domain model types (LoveNote, etc.)
|   |   +-- database.types.ts      # Auto-generated from Supabase schema (DO NOT EDIT)
|   |-- utils/                      # Utility functions (17 files)
|   |   |-- backgroundSync.ts      # Background sync utilities (isServiceWorkerSupported)
|   |   |-- calendarHelpers.ts     # Calendar rendering helpers
|   |   |-- countdownService.ts    # Countdown calculation logic
|   |   |-- dateFormat.ts          # Date formatting utilities
|   |   |-- dateFormatters.ts      # Additional date formatters
|   |   |-- dateHelpers.ts         # Date calculation utilities
|   |   |-- deterministicRandom.ts # Deterministic random for message rotation
|   |   |-- haptics.ts             # Haptic feedback utilities
|   |   |-- interactionValidation.ts # Interaction validation logic
|   |   |-- messageRotation.ts     # Daily message selection algorithm
|   |   |-- messageValidation.ts   # Message validation utilities
|   |   |-- moodEmojis.ts          # Mood emoji mappings
|   |   |-- moodGrouping.ts        # Mood grouping for history view
|   |   |-- offlineErrorHandler.ts # Offline-specific error handling
|   |   |-- performanceMonitoring.ts # Performance metrics collection
|   |   |-- storageMonitor.ts      # Storage quota monitoring
|   |   +-- themes.ts              # Theme configurations and application
|   +-- validation/
|       |-- schemas.ts              # Zod validation schemas (messages, photos, moods, settings, scripture)
|       |-- errorMessages.ts        # User-facing validation error messages
|       +-- index.ts               # Validation module re-exports
|
|-- supabase/
|   |-- config.toml                 # Local Supabase configuration (ports, auth, storage, realtime)
|   |-- seed.sql                    # Database seed data for local development
|   |-- functions/
|   |   +-- upload-love-note-image/ # Edge function for love note image uploads
|   |-- migrations/                 # 21 SQL migration files (4,289 lines total)
|   +-- tests/
|       +-- database/              # 14 pgTAP database test files
|
|-- tests/
|   |-- api/                        # API-level tests (4 Playwright specs against Supabase endpoints)
|   |-- e2e/                        # End-to-end browser tests (Playwright, 25+ spec files)
|   |   |-- auth/                   # Login, logout, OAuth, display name setup (4 specs)
|   |   |-- home/                   # Home view, welcome splash, error boundary (2 specs)
|   |   |-- mood/                   # Mood tracker and history (1 spec)
|   |   |-- navigation/            # Bottom nav tabs, routing (1 spec)
|   |   |-- notes/                 # Love notes messaging (1 spec)
|   |   |-- offline/               # Network status indicator (1 spec)
|   |   |-- partner/               # Partner mood view (1 spec)
|   |   |-- photos/                # Photo gallery and upload (2 specs)
|   |   +-- scripture/             # Scripture overview, session, lobby, reading, reflection, stats, security, accessibility (12 specs)
|   |-- integration/               # Integration tests (1 spec)
|   |-- support/                   # Test infrastructure
|   |   |-- merged-fixtures.ts     # Main test entry point: import { test, expect } from here
|   |   |-- auth/                  # Global setup, auth setup, Supabase auth provider
|   |   |-- fixtures/              # Custom Playwright fixtures (auth, scripture-navigation, together-mode)
|   |   |-- factories/             # Test data factories
|   |   +-- helpers/               # Utility functions (scripture-cache, scripture-lobby, together, supabase)
|   |-- unit/                      # Unit tests (Vitest + happy-dom, 25+ test files)
|   |   |-- data/                  # Scripture steps data tests
|   |   |-- hooks/                 # Hook tests (useAutoSave, useScriptureBroadcast, useScripturePresence)
|   |   |-- services/              # Service tests (dbSchema, moodService, scriptureReadingService)
|   |   |-- stores/                # Store slice tests (moodSlice, scriptureReadingSlice, settingsSlice)
|   |   |-- utils/                 # Utility tests (dateFormat, messageRotation, moodGrouping, etc.)
|   |   +-- validation/            # Zod schema validation tests
|   |-- setup.ts                   # Vitest setup: fake-indexeddb, matchMedia/IntersectionObserver/ResizeObserver mocks
|   +-- README.md                  # Test suite documentation with directory structure and best practices
|
|-- .env.example                   # Template showing required environment variables
|-- .env.test                      # Plain-text local Supabase values for E2E testing
|-- .mise.toml                     # Tool versions (Node.js) + env vars (CODEX_HOME)
|-- AGENTS.md                      # AI agent instructions
|-- CLAUDE.md                      # Claude Code guidance (architecture, commands, conventions)
|-- eslint.config.js               # ESLint flat config (typescript-eslint, react-hooks, react-refresh)
|-- fnox.toml                      # Encrypted secrets (age provider, committed to git)
|-- index.html                     # HTML entry point with SPA redirect handler for GitHub Pages
|-- package.json                   # npm scripts, dependencies, browserslist
|-- playwright.config.ts           # Playwright: projects (chromium, api, integration), global setup, dev server
|-- postcss.config.js              # PostCSS plugins (@tailwindcss/postcss, autoprefixer)
|-- tailwind.config.js             # Tailwind theme: custom colors, fonts, animations, keyframes
|-- tsconfig.json                  # TypeScript project references root (3 sub-configs)
|-- tsconfig.app.json              # App TypeScript config (ES2022 target, strict, react-jsx)
|-- tsconfig.node.json             # Node TypeScript config (vite.config.ts, vitest.config.ts)
|-- tsconfig.test.json             # Test TypeScript config
|-- vite.config.ts                 # Vite: base path, manual chunks, PWA plugin, visualizer, Sentry, type checker
+-- vitest.config.ts               # Vitest: happy-dom, path alias @/, coverage thresholds (25%), JUnit output
```
