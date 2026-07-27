# Repository Structure

```
My-Love/
|-- .github/
|   |-- actions/
|   |   |-- setup-supabase/           # Composite action: install Supabase CLI, start local, apply migrations, export credentials
|   |   +-- setup-playwright-e2e/     # Composite action: Node + deps + Playwright browsers + local Supabase
|   |-- codeql/
|   |   +-- codeql-config.yml         # CodeQL security analysis (security-extended + security-and-quality)
|   |-- lighthouse/
|   |   +-- lighthouserc.json         # Lighthouse CI assertion thresholds
|   |-- workflows/                    # 9 GitHub Actions workflows
|   |   |-- deploy.yml                # Build + smoke test + deploy to GitHub Pages + health check
|   |   |-- test.yml                  # Full test pipeline: lint, unit, E2E, merge reports
|   |   |-- supabase-migrations.yml   # Migration validation on PRs touching supabase/ paths
|   |   |-- claude.yml                # Claude Code for @claude mentions in issues/PRs
|   |   |-- claude-code-review.yml    # Automated PR code review with Claude
|   |   |-- codeql.yml                # CodeQL security scanning
|   |   |-- dependency-review.yml     # Dependency vulnerability review on PRs
|   |   |-- bundle-size.yml           # Bundle size tracking on PRs
|   |   +-- lighthouse.yml            # Lighthouse performance auditing
|   +-- dependabot.yml                # Weekly npm + GitHub Actions dependency updates
|
|-- _bmad-output/
|   |-- .archive/                     # Retired phase artifacts: planning docs, completed tech specs, reports
|   |-- implementation-artifacts/     # deferred-work.md ledger
|   |-- handoff-documents/            # Cross-session handoff documents
|   |-- skills/                       # Project-local BMAD skill definitions (bmad-handoff)
|   |-- tea-docs/                     # Test-architecture reference docs
|   |-- bmad-workflow-reference.md    # BMAD epic lifecycle command reference
|   +-- project-context.md            # AI-agent rule file (see also CLAUDE.md, AGENTS.md)
|
|-- docs/                             # Project documentation (9 sections)
|   |-- api-reference/               # Supabase client, auth, services, validation, SW, realtime
|   |-- architecture/                # 19 architecture documents + index
|   |-- component-inventory/         # Component hierarchy, patterns, state connections
|   |-- data-models/                 # Database schema, IndexedDB, types, Zod, RLS, migrations
|   |-- development-guide/           # Developer onboarding, scripts, testing, troubleshooting
|   |-- performance/                 # Bundle reports, baselines
|   |-- project-overview/            # This section: architecture, features, deployment
|   |-- source-tree-analysis/        # Directory tree, entry point trace, critical folders
|   +-- state-management/            # Zustand store config, slices, persistence, hooks
|
|-- public/
|   |-- 404.html                     # GitHub Pages SPA redirect handler
|   +-- icons/                       # PWA icons (icon-192.png, icon-512.png, icon.svg)
|
|-- scripts/                          # Utility scripts (13 files)
|   |-- dev-with-cleanup.sh          # Dev server with signal trapping and process cleanup
|   |-- test-with-cleanup.sh         # E2E test runner with signal trapping and process cleanup
|   |-- burn-in.sh                   # Flaky test detection (configurable iterations, default 10)
|   |-- deadcode.sh                  # Dead-code analysis via tsr, filters React.lazy false positives
|   |-- ci-local.sh                  # Mirror CI pipeline locally (lint, unit, E2E, burn-in)
|   |-- smoke-tests.cjs              # Pre-deploy build validation (dist/ structure, manifests, bundles)
|   |-- validate-messages.cjs        # 365-message library validation (count, categories, duplicates)
|   |-- perf-bundle-report.mjs       # Bundle size analysis (raw + gzip, generates Markdown report)
|   |-- pw-failures.mjs              # Playwright failure analysis (AI-friendly Markdown summary)
|   |-- post-deploy-check.cjs        # Live site health check (HTTP, manifest, service worker)
|   |-- clear-caches.js              # Browser console script to clear all caches
|   |-- inspect-db.sh                # Database inspection utility for local Supabase
|   +-- fetch_comments.py            # GitHub PR comment fetcher
|
|-- src/                              # Application source (197 TypeScript/TSX files, ~43,133 lines; 168 non-test)
|   |-- App.tsx                       # Main application component (auth, routing, sync setup, ~610 lines)
|   |-- main.tsx                      # Entry point (StrictMode, LazyMotion, SW registration)
|   |-- index.css                     # Global CSS (Tailwind imports)
|   |-- sw.ts                         # Custom Service Worker (precache, cache strategies, background sync)
|   |-- sw-db.ts                      # Service Worker IndexedDB helpers (isolated from app code)
|   |-- sw-types.d.ts                 # Service Worker type definitions
|   |-- vite-env.d.ts                 # Vite environment type declarations
|   |
|   |-- api/                          # Supabase API integration layer (12 files)
|   |   |-- supabaseClient.ts         # Client singleton (typed with Database schema)
|   |   |-- auth/                     # Auth service modules (centralized refactor)
|   |   |   |-- actionService.ts      # signIn, signUp, signOut, resetPassword, signInWithGoogle
|   |   |   |-- sessionService.ts     # getSession, getUser, getCurrentUserId, onAuthStateChange
|   |   |   +-- types.ts              # Auth type definitions
|   |   |-- authService.ts            # Facade re-exporting both session and action services
|   |   |-- errorHandlers.ts          # Postgrest/network error mapping, isOnline, logSupabaseError
|   |   |-- interactionService.ts     # Poke/kiss interaction CRUD + realtime subscriptions
|   |   |-- moodApi.ts                # Mood CRUD with Zod-validated responses
|   |   |-- moodSyncService.ts        # Mood sync: IndexedDB -> Supabase
|   |   |-- partnerService.ts         # Partner search, requests, linking
|   |   +-- validation/
|   |       +-- supabaseSchemas.ts    # Zod schemas for all Supabase API responses
|   |
|   |-- components/                   # React components (26 directories, 66 non-test files)
|   |   |-- AdminPanel/               # Admin interface (6 files: panel, forms, list, row, dialog)
|   |   |-- CountdownTimer/           # Generic countdown component
|   |   |-- DailyMessage/             # Main message card with rotation
|   |   |-- DisplayNameSetup/         # OAuth display name setup modal
|   |   |-- ErrorBoundary/            # Top-level error boundary
|   |   |-- InteractionHistory/       # Partner interaction history
|   |   |-- LoginScreen/              # Email/password + Google OAuth login UI
|   |   |-- love-notes/               # Real-time chat (7 files: notes, input, list, message, image, viewer)
|   |   |-- MoodHistory/              # Calendar view, day component, detail modal
|   |   |-- MoodTracker/              # Mood logging (6 files: tracker, button, history, timeline)
|   |   |-- Navigation/               # Bottom navigation bar
|   |   |-- PartnerMoodView/          # Partner mood real-time display
|   |   |-- PhotoCarousel/            # Photo carousel viewer + controls
|   |   |-- PhotoDeleteConfirmation/  # Photo delete confirmation dialog
|   |   |-- PhotoEditModal/           # Photo caption editor
|   |   |-- PhotoGallery/             # Photo grid (4 files: gallery, item, skeleton, viewer)
|   |   |-- PhotoUpload/              # Photo upload dialog
|   |   |-- photos/                   # PhotoUploader utility component
|   |   |-- PokeKissInterface/        # Playful partner interactions
|   |   |-- RelationshipTimers/       # TimeTogether, BirthdayCountdown, EventCountdown
|   |   |-- scripture-reading/        # Scripture reading flow (24+ files across 7 subdirs)
|   |   |   |-- containers/           # ScriptureOverview, SoloReadingFlow, LobbyContainer, ReadingContainer, ReadingPhaseView, ReportPhaseView
|   |   |   |-- hooks/                # useReadingDialogs, useReadingNavigation, useReportPhase, useSessionPersistence, useSoloReadingFlow (decomposed from SoloReadingFlow)
|   |   |   |-- overview/             # StatsSection
|   |   |   |-- reading/              # BookmarkFlag, PartnerPosition, RoleIndicator
|   |   |   |-- reflection/           # DailyPrayerReport, MessageCompose, ReflectionSummary
|   |   |   +-- session/              # Countdown, DisconnectionOverlay, LockInButton
|   |   |-- Settings/                 # Theme and relationship settings
|   |   |-- shared/                   # NetworkStatusIndicator, SyncToast
|   |   |-- ViewErrorBoundary/        # Per-view error boundary
|   |   |-- WelcomeButton/            # Welcome splash trigger button
|   |   +-- WelcomeSplash/            # Welcome splash screen
|   |
|   |-- config/                       # Application configuration (5 files)
|   |   |-- constants.ts              # APP_CONFIG (partner name, start date, feature flags)
|   |   |-- images.ts                 # Image compression/validation/storage config
|   |   |-- performance.ts            # Pagination, storage quotas, validation limits
|   |   |-- relationshipDates.ts      # Birthday, wedding, and visit date configurations
|   |   +-- sentry.ts                 # Sentry initialization, user context, PII stripping
|   |
|   |-- constants/
|   |   +-- animations.ts             # Animation constant values
|   |
|   |-- data/                         # Static data (3 files)
|   |   |-- defaultMessages.ts        # 365 pre-written love messages (5 categories, 73 each)
|   |   |-- defaultMessagesLoader.ts  # Lazy loader for default messages
|   |   +-- scriptureSteps.ts         # 17 scripture steps with NKJV verses and response prayers
|   |
|   |-- hooks/                        # Custom React hooks (14: 1 barrel + 13 hooks)
|   |   |-- useAuth.ts                # Authentication state hook
|   |   |-- useAutoSave.ts            # Auto-save with visibility change detection
|   |   |-- useFocusTrap.ts           # Focus trap for modal dialogs (accessibility)
|   |   |-- useLoveNotes.ts           # Love notes chat state + realtime subscription
|   |   |-- useMoodHistory.ts         # Paginated mood history via Supabase API
|   |   |-- useMotionConfig.ts        # Framer Motion reduced-motion config
|   |   |-- useNetworkStatus.ts       # Online/offline detection with 1.5s debounce
|   |   |-- usePartnerMood.ts         # Partner mood with Broadcast realtime
|   |   |-- usePhotos.ts              # Photo gallery state + auto-load
|   |   |-- useRealtimeMessages.ts    # Broadcast channel with exponential backoff retry
|   |   |-- useScriptureBroadcast.ts  # Private broadcast channel lifecycle with retry
|   |   |-- useScripturePresence.ts   # Ephemeral presence for partner position tracking
|   |   +-- useVibration.ts           # Haptic feedback hook
|   |
|   |-- services/                     # Business logic services (10: 1 base + 9 concrete)
|   |   |-- BaseIndexedDBService.ts   # Abstract CRUD base class for IndexedDB
|   |   |-- dbSchema.ts               # IndexedDB schema definition (v5, 8 object stores)
|   |   |-- customMessageService.ts   # Custom message CRUD with import/export
|   |   |-- imageCompressionService.ts # Client-side image compression (Canvas API)
|   |   |-- loveNoteImageService.ts   # Love note image upload + signed URL cache
|   |   |-- migrationService.ts       # localStorage to IndexedDB migration
|   |   |-- moodService.ts            # Mood CRUD with Zod validation + sync tracking
|   |   |-- photoService.ts           # Photo operations (Supabase Storage)
|   |   |-- scriptureReadingService.ts # Scripture API adapter + IndexedDB cache + corruption recovery
|   |   +-- storage.ts                # Legacy StorageService for messages + photos
|   |
|   |-- stores/                       # Zustand state management (13 files)
|   |   |-- useAppStore.ts            # Main store (compose 11 slices + persist middleware)
|   |   |-- types.ts                  # AppState type, AppSlice, AppStateCreator, AppMiddleware
|   |   +-- slices/                   # Individual slice files (11 slices, includes authSlice)
|   |
|   |-- types/                        # TypeScript type definitions (3 files)
|   |   |-- index.ts                  # Core types (ThemeName, Message, MoodEntry, Settings, etc.)
|   |   |-- models.ts                 # Domain model types (LoveNote, etc.)
|   |   +-- database.types.ts         # Auto-generated from Supabase schema (DO NOT EDIT)
|   |
|   |-- utils/                        # Utility functions (16 files, includes logger.ts)
|   |   |-- backgroundSync.ts         # Background Sync API registration
|   |   |-- calendarHelpers.ts        # Calendar grid calculations
|   |   |-- countdownService.ts       # Anniversary countdown calculations
|   |   |-- dateUtils.ts              # Date formatting (relative time, timestamps, helpers)
|   |   |-- deterministicRandom.ts    # Seeded PRNG (FNV-1a + Mulberry32) for render-safe values
|   |   |-- haptics.ts                # Vibration API haptic patterns
|   |   |-- interactionValidation.ts  # UUID + interaction type validation
|   |   |-- messageRotation.ts        # Deterministic daily message algorithm
|   |   |-- messageValidation.ts      # Love note validation + DOMPurify sanitize
|   |   |-- moodEmojis.ts             # Mood type -> emoji mappings
|   |   |-- moodGrouping.ts           # Group moods by date for timeline
|   |   |-- offlineErrorHandler.ts    # OfflineError class, withOfflineCheck wrapper
|   |   |-- performanceMonitoring.ts  # Scroll perf observer (dev-only)
|   |   |-- storageMonitor.ts         # localStorage quota monitoring
|   |   +-- themes.ts                 # Theme definitions + CSS variable application
|   |
|   +-- validation/                   # Zod validation layer (3 files)
|       |-- schemas.ts                # All Zod schemas (Message, Photo, Mood, Settings, Scripture)
|       |-- errorMessages.ts          # ValidationError class, formatZodError, getFieldErrors
|       +-- index.ts                  # Barrel exports
|
|-- supabase/
|   |-- config.toml                   # Local Supabase configuration (Postgres 17, ports, auth)
|   |-- seed.sql                      # Database seed data for local development
|   |-- functions/
|   |   +-- upload-love-note-image/   # Edge function for love note image uploads
|   |-- migrations/                   # 25 SQL migration files
|   +-- tests/
|       +-- database/                 # 14 pgTAP database test files
|
|-- tests/
|   |-- setup.ts                      # Vitest setup: fake-indexeddb, browser API mocks
|   |-- api/                          # API-level tests (4 Playwright specs)
|   |-- e2e/                          # E2E browser tests (Playwright, 28 spec files)
|   |-- integration/                  # Integration tests (1 spec)
|   |-- unit/                         # Unit tests (Vitest + happy-dom, 27 test files)
|   +-- support/                      # Test infrastructure (fixtures, factories, helpers)
|
|-- .env.example                      # Template showing required environment variables
|-- .env.test                         # Plain-text local Supabase values for E2E testing
|-- .mise.toml                        # Tool versions (Node.js 24.13.0) + env vars
|-- AGENTS.md                         # AI agent instructions
|-- CLAUDE.md                         # Claude Code guidance (architecture, commands, conventions)
|-- eslint.config.js                  # ESLint flat config (typescript-eslint, react-hooks, react-refresh)
|-- fnox.toml                         # Encrypted secrets (age provider, committed to git)
|-- index.html                        # HTML entry point with SPA redirect handler for GitHub Pages
|-- license.md                        # Project license
|-- package.json                      # 32 npm scripts, dependencies, overrides, browserslist
|-- playwright.config.ts              # Playwright: projects (chromium, api, integration), global setup
|-- postcss.config.js                 # PostCSS plugins (@tailwindcss/postcss, autoprefixer)
|-- tailwind.config.js                # Tailwind theme: custom colors, fonts, animations, keyframes
|-- tsconfig.json                     # TypeScript project references root (3 sub-configs)
|-- tsconfig.app.json                 # App TypeScript config (ES2022 target, strict, react-jsx)
|-- tsconfig.node.json                # Node TypeScript config (vite.config.ts, vitest.config.ts)
|-- tsconfig.test.json                # Test TypeScript config
|-- tsconfig.tsr.json                 # Config for the tsr dead-code analyser (npm run deadcode)
|-- README.md                         # Project readme with feature list and quick start
|-- skills-lock.json                  # Pinned versions for installed agent skills
|-- vite.config.ts                    # Vite: base path, manual chunks, PWA plugin, visualizer, Sentry
+-- vitest.config.ts                  # Vitest: happy-dom, path alias @/, coverage thresholds (25%)
```
