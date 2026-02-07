# Source Tree Analysis

> Annotated directory structure for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

---

## Quick Reference

| Property       | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Project Type   | Monolith Web SPA                                         |
| Primary Tech   | React 19.2.3 / TypeScript 5.9.3 / Vite 7.3.1           |
| Architecture   | Feature-based component organization with service layer  |
| Entry Point    | `index.html` -> `src/main.tsx` -> `src/App.tsx`          |

---

## Annotated Directory Tree

```
My-Love/
├── index.html                          # PWA entry point - SPA redirect handler
├── package.json                        # Dependencies & npm scripts
├── vite.config.ts                      # Build config (Vite + PWA plugin)
├── vitest.config.ts                    # Unit test config (happy-dom, 80% coverage)
├── playwright.config.ts                # E2E test config (Chromium)
├── tsconfig.json                       # Root TS config (project references)
├── tsconfig.app.json                   # App TS config (ES2022, strict, react-jsx)
├── tsconfig.node.json                  # Node scripts TS config
├── eslint.config.js                    # Flat ESLint config (strict TS + React 19)
├── tailwind.config.js                  # 5 theme palettes, custom fonts/animations
├── postcss.config.js                   # PostCSS with Tailwind + Autoprefixer
├── .nvmrc                              # Node.js 24.13.0
├── .env.example                        # Supabase URL + anon key template
├── CLAUDE.md                           # AI coding guidelines
├── README.md                           # Project documentation
│
├── public/                             # Static assets (served as-is)
│   ├── 404.html                        # GitHub Pages SPA fallback
│   ├── vite.svg                        # Vite logo
│   └── icons/
│       ├── icon.svg                    # App icon (vector)
│       ├── icon-192.png                # PWA icon 192x192
│       └── icon-512.png                # PWA icon 512x512
│
├── src/                                # APPLICATION SOURCE CODE
│   ├── main.tsx                        # * React entry point (PWA init, render)
│   ├── App.tsx                         # * Root component (routing, state init)
│   ├── index.css                       # Global styles (Tailwind base)
│   ├── vite-env.d.ts                   # Vite type declarations
│   ├── sw.ts                           # * Service Worker entry point
│   ├── sw-db.ts                        # Service Worker DB operations
│   ├── sw-types.d.ts                   # Service Worker type declarations
│   │
│   ├── api/                            # SUPABASE API LAYER
│   │   ├── supabaseClient.ts           # * Supabase client initialization
│   │   ├── authService.ts              # Auth (login, signup, session, OAuth)
│   │   ├── interactionService.ts       # Poke/Kiss API operations
│   │   ├── partnerService.ts           # Partner data CRUD
│   │   ├── moodApi.ts                  # Mood tracking API calls
│   │   ├── moodSyncService.ts          # Offline-first mood sync
│   │   ├── errorHandlers.ts            # Centralized API error handling
│   │   └── validation/
│   │       └── supabaseSchemas.ts      # Zod schemas for API response validation
│   │
│   ├── services/                       # BUSINESS LOGIC SERVICES
│   │   ├── BaseIndexedDBService.ts     # * Base class for all IndexedDB operations
│   │   ├── dbSchema.ts                 # IndexedDB schema (v5, 8 stores)
│   │   ├── storage.ts                  # localStorage wrapper
│   │   ├── syncService.ts              # Offline sync orchestration
│   │   ├── realtimeService.ts          # Supabase Realtime subscriptions
│   │   ├── moodService.ts              # Mood business logic
│   │   ├── customMessageService.ts     # Daily message management
│   │   ├── photoService.ts             # Photo metadata service
│   │   ├── photoStorageService.ts      # Photo file storage (Supabase Storage)
│   │   ├── imageCompressionService.ts  # Image optimization before upload
│   │   ├── loveNoteImageService.ts     # Love note image attachments
│   │   ├── migrationService.ts         # Data migration utilities
│   │   ├── performanceMonitor.ts       # Performance metrics tracking
│   │   └── scriptureReadingService.ts  # Scripture reading logic
│   │
│   ├── stores/                         # ZUSTAND STATE MANAGEMENT
│   │   ├── useAppStore.ts              # * Main store (compose pattern, 10 slices)
│   │   ├── types.ts                    # Store type definitions
│   │   └── slices/
│   │       ├── appSlice.ts             # App lifecycle (init, loading, errors)
│   │       ├── authSlice.ts            # Authentication & user session
│   │       ├── navigationSlice.ts      # Current view & route state
│   │       ├── settingsSlice.ts        # User preferences & theme
│   │       ├── partnerSlice.ts         # Partner data & relationship info
│   │       ├── moodSlice.ts            # Mood tracking state
│   │       ├── interactionsSlice.ts    # Poke/Kiss interaction state
│   │       ├── messagesSlice.ts        # Daily messages state
│   │       ├── photosSlice.ts          # Photo gallery state
│   │       ├── notesSlice.ts           # Love notes state
│   │       └── scriptureReadingSlice.ts # Scripture reading progress
│   │
│   ├── components/                     # REACT COMPONENTS (feature-based)
│   │   ├── LoginScreen/                # Authentication UI
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── LoginScreen.css
│   │   │   └── index.ts
│   │   ├── DisplayNameSetup/           # User onboarding flow
│   │   │   ├── DisplayNameSetup.tsx
│   │   │   ├── DisplayNameSetup.css
│   │   │   └── index.ts
│   │   ├── WelcomeSplash/              # Welcome screen
│   │   │   └── WelcomeSplash.tsx
│   │   ├── Navigation/                 # Bottom tab bar
│   │   │   ├── BottomNavigation.tsx
│   │   │   └── __tests__/
│   │   ├── DailyMessage/               # Daily message display
│   │   │   └── DailyMessage.tsx
│   │   ├── RelationshipTimers/         # [Story 1.1] Milestone tracking
│   │   │   ├── TimeTogether.tsx
│   │   │   ├── BirthdayCountdown.tsx
│   │   │   ├── EventCountdown.tsx
│   │   │   ├── RelationshipTimers.tsx
│   │   │   └── index.ts
│   │   ├── MoodTracker/                # [Story 1.2] Mood tracking
│   │   │   ├── MoodTracker.tsx
│   │   │   ├── MoodButton.tsx
│   │   │   ├── MoodHistoryItem.tsx
│   │   │   ├── MoodHistoryTimeline.tsx
│   │   │   ├── NoMoodLoggedState.tsx
│   │   │   ├── PartnerMoodDisplay.tsx
│   │   │   └── __tests__/
│   │   ├── MoodHistory/                # Mood calendar view
│   │   │   ├── MoodHistoryCalendar.tsx
│   │   │   ├── CalendarDay.tsx
│   │   │   ├── MoodDetailModal.tsx
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── PartnerMoodView/            # Partner's mood display
│   │   │   ├── PartnerMoodView.tsx
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── PokeKissInterface/          # [Story 1.2] Interaction system
│   │   │   ├── PokeKissInterface.tsx
│   │   │   └── index.ts
│   │   ├── InteractionHistory/         # Poke/Kiss history
│   │   │   ├── InteractionHistory.tsx
│   │   │   └── index.ts
│   │   ├── love-notes/                 # [Story 1.3] Love messages
│   │   │   ├── LoveNotes.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── LoveNoteMessage.tsx
│   │   │   ├── ImagePreview.tsx
│   │   │   ├── FullScreenImageViewer.tsx
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── PhotoGallery/               # [Story 1.4] Photo memories
│   │   │   ├── PhotoGallery.tsx
│   │   │   ├── PhotoGridItem.tsx
│   │   │   ├── PhotoViewer.tsx
│   │   │   ├── PhotoGridSkeleton.tsx
│   │   │   └── __tests__/
│   │   ├── PhotoUpload/                # Photo upload UI
│   │   │   └── PhotoUpload.tsx
│   │   ├── photos/                     # Photo uploader
│   │   │   └── PhotoUploader.tsx
│   │   ├── PhotoCarousel/              # Photo slideshow
│   │   │   ├── PhotoCarousel.tsx
│   │   │   └── PhotoCarouselControls.tsx
│   │   ├── PhotoDeleteConfirmation/    # Delete confirmation dialog
│   │   │   └── PhotoDeleteConfirmation.tsx
│   │   ├── PhotoEditModal/             # Photo caption editing
│   │   │   └── PhotoEditModal.tsx
│   │   ├── CountdownTimer/             # Timer display
│   │   │   ├── CountdownTimer.tsx
│   │   │   └── index.ts
│   │   ├── scripture-reading/          # [Story 1.5] Scripture reading
│   │   │   ├── index.ts
│   │   │   ├── containers/
│   │   │   │   ├── ScriptureOverview.tsx
│   │   │   │   └── SoloReadingFlow.tsx
│   │   │   └── __tests__/
│   │   ├── Settings/                   # User preferences
│   │   │   ├── Settings.tsx
│   │   │   ├── AnniversarySettings.tsx
│   │   │   └── index.ts
│   │   ├── AdminPanel/                 # Message administration
│   │   │   ├── AdminPanel.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageRow.tsx
│   │   │   ├── CreateMessageForm.tsx
│   │   │   ├── EditMessageForm.tsx
│   │   │   └── DeleteConfirmDialog.tsx
│   │   ├── ErrorBoundary/              # Global error boundary
│   │   │   └── ErrorBoundary.tsx
│   │   ├── ViewErrorBoundary/          # View-level error boundary
│   │   │   ├── ViewErrorBoundary.tsx
│   │   │   └── index.ts
│   │   ├── shared/                     # Reusable shared components
│   │   │   ├── index.ts
│   │   │   ├── NetworkStatusIndicator.tsx
│   │   │   └── SyncToast.tsx
│   │   └── WelcomeButton/              # Welcome button
│   │       └── WelcomeButton.tsx
│   │
│   ├── hooks/                          # CUSTOM REACT HOOKS
│   │   ├── index.ts                    # Hook exports
│   │   ├── useAuth.ts                  # Authentication hook
│   │   ├── useNetworkStatus.ts         # Online/offline detection
│   │   ├── useRealtimeMessages.ts      # Supabase realtime hook
│   │   ├── useLoveNotes.ts             # Love notes data hook
│   │   ├── useMoodHistory.ts           # Mood history data hook
│   │   ├── usePartnerMood.ts           # Partner mood hook
│   │   ├── usePhotos.ts               # Photos data hook
│   │   ├── useImageCompression.ts      # Image compression hook
│   │   ├── useVibration.ts             # Haptic feedback hook
│   │   ├── useAutoSave.ts             # Auto-save debounce hook
│   │   ├── useMotionConfig.ts          # Framer Motion config hook
│   │   └── __tests__/
│   │
│   ├── types/                          # TYPE DEFINITIONS
│   │   ├── index.ts                    # Type exports
│   │   ├── database.types.ts           # Supabase auto-generated types
│   │   └── models.ts                   # Business domain models
│   │
│   ├── config/                         # APP CONFIGURATION
│   │   ├── constants.ts                # App-wide constants
│   │   ├── performance.ts              # Performance thresholds
│   │   ├── relationshipDates.ts        # Milestone date config
│   │   └── images.ts                   # Image compression config
│   │
│   ├── constants/
│   │   └── animations.ts               # Framer Motion animation definitions
│   │
│   ├── utils/                          # UTILITY FUNCTIONS
│   │   ├── themes.ts                   # Theme application
│   │   ├── dateHelpers.ts              # Date calculations
│   │   ├── dateFormatters.ts           # Date formatting
│   │   ├── dateFormat.ts               # Date parsing
│   │   ├── calendarHelpers.ts          # Calendar grid generation
│   │   ├── countdownService.ts         # Countdown math
│   │   ├── messageRotation.ts          # Daily message rotation
│   │   ├── messageValidation.ts        # Message input validation
│   │   ├── moodEmojis.ts              # Mood->emoji mapping
│   │   ├── moodGrouping.ts            # Mood aggregation
│   │   ├── interactionValidation.ts   # Poke/Kiss validation
│   │   ├── haptics.ts                 # Haptic feedback
│   │   ├── backgroundSync.ts          # Background Sync API
│   │   ├── offlineErrorHandler.ts     # Offline error recovery
│   │   ├── storageMonitor.ts          # Storage quota monitor
│   │   ├── performanceMonitoring.ts   # Performance metrics
│   │   └── __tests__/
│   │
│   ├── validation/                     # INPUT VALIDATION
│   │   ├── index.ts
│   │   ├── schemas.ts                  # Zod schemas for user input
│   │   └── errorMessages.ts            # User-facing error messages
│   │
│   ├── data/                           # STATIC DATA
│   │   ├── defaultMessages.ts          # Default daily messages
│   │   └── scriptureSteps.ts           # Scripture reading step data
│   │
│   └── assets/
│       └── react.svg
│
├── supabase/                           # SUPABASE BACKEND
│   ├── config.toml                     # Local Supabase config
│   ├── functions/
│   │   └── upload-love-note-image/
│   │       └── index.ts                # Edge function: image upload
│   └── migrations/                     # 9 SQL migration files
│       ├── 20251203000001_create_base_schema.sql
│       ├── 20251203190800_create_photos_table.sql
│       ├── 20251205000001_add_love_notes_images.sql
│       ├── 20251205000002_add_mime_validation.sql
│       ├── 20251206024345_remote_schema.sql
│       ├── 20251206124803_fix_users_rls_policy.sql
│       ├── 20251206200000_fix_users_update_privilege_escalation.sql
│       ├── 20260128000001_scripture_reading.sql
│       └── 20260130000001_scripture_rpcs.sql
│
├── tests/                              # TEST SUITES
│   ├── setup.ts                        # Test configuration
│   ├── unit/                           # Vitest unit tests
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── stores/
│   │   ├── data/
│   │   └── validation/
│   └── e2e/                            # Playwright E2E tests
│       ├── auth/
│       ├── home/
│       ├── mood/
│       ├── navigation/
│       ├── notes/
│       ├── offline/
│       ├── partner/
│       ├── photos/
│       └── scripture/
│
├── scripts/                            # BUILD & DEV SCRIPTS
│   ├── dev-with-cleanup.sh             # Dev server with cache cleanup
│   ├── test-with-cleanup.sh            # Test runner with cleanup
│   ├── ci-local.sh                     # Local CI simulation
│   ├── burn-in.sh                      # Extended burn-in testing
│   ├── inspect-db.sh                   # Database inspection
│   ├── clear-caches.js                 # Cache clearing utility
│   ├── post-deploy-check.cjs           # Post-deployment verification
│   └── validate-messages.cjs           # Message validation
│
├── .github/workflows/                  # CI/CD PIPELINES
│   ├── test.yml                        # Main test pipeline
│   ├── deploy.yml                      # GitHub Pages deployment
│   ├── claude-code-review.yml          # AI code review
│   ├── claude.yml                      # Claude CI integration
│   └── supabase-migrations.yml         # DB migration checks
│
└── docs/                               # GENERATED DOCUMENTATION
    ├── index.md                        # Documentation master index
    ├── project-overview.md
    ├── architecture.md
    ├── technology-stack.md
    ├── component-inventory.md
    ├── data-models.md
    ├── state-management.md
    ├── service-layer.md
    ├── api-reference.md
    ├── development-guide.md
    ├── source-tree-analysis.md         # This file
    └── project-scan-report.json        # Scan state tracker
```

---

## Critical Directories

| Directory | Purpose |
| --------- | ------- |
| `src/api/` | Supabase API client layer with auth, CRUD services, and Zod validation for response data. |
| `src/services/` | Business logic services including IndexedDB abstraction (`BaseIndexedDBService`), offline sync orchestration, and Supabase Realtime subscriptions. |
| `src/stores/` | Zustand state management with 10 composable slices covering auth, navigation, mood, photos, notes, interactions, messages, settings, partner data, and scripture reading. |
| `src/components/` | Feature-based React components organized by domain. Each feature folder contains its component files, CSS, barrel exports, and co-located tests. |
| `src/hooks/` | 12 custom React hooks for data fetching, realtime subscriptions, authentication, image compression, haptic feedback, and motion configuration. |
| `src/types/` | TypeScript type definitions including Supabase auto-generated database types and hand-written business domain models. |
| `src/utils/` | Pure utility functions for date calculations, formatting, validation, haptics, background sync, offline error handling, and performance monitoring. |
| `src/validation/` | Zod schemas for user input validation with user-facing error messages. Separate from `src/api/validation/` which validates API responses. |
| `src/config/` | Application constants and configuration for performance thresholds, relationship milestone dates, and image compression settings. |
| `src/data/` | Static application data including default daily messages and scripture reading step definitions. |
| `supabase/` | Backend configuration, 9 SQL migration files tracking schema evolution, and edge functions (image upload with JWT auth and rate limiting). |
| `tests/` | Dual test strategy: unit tests (Vitest with happy-dom) covering hooks, services, utils, stores, data, and validation; E2E tests (Playwright with Chromium) covering auth, navigation, mood, notes, photos, offline, partner, and scripture flows. |
| `scripts/` | Development scripts for dev server management, test runners with cleanup, local CI simulation, burn-in testing, database inspection, and post-deployment verification. |
| `.github/workflows/` | 5 CI/CD pipelines: main test suite, GitHub Pages deployment, AI-assisted code review, Claude integration, and Supabase migration validation. |

---

## Feature Map

Epic 1 stories and their primary file locations:

| Story | Description | Primary File Locations |
| ----- | ----------- | ---------------------- |
| 1.1 | Database & Infrastructure | `src/api/`, `src/services/`, `supabase/migrations/` |
| 1.2 | Navigation & Overview | `src/components/Navigation/`, `src/components/MoodTracker/`, `src/components/PokeKissInterface/` |
| 1.3 | Solo Reading | `src/components/scripture-reading/`, `src/components/love-notes/` |
| 1.4 | Save/Resume & Optimistic UI | `src/components/PhotoGallery/`, `src/components/PhotoUpload/`, `src/hooks/useAutoSave.ts` |
| 1.5 | Accessibility | Cross-cutting -- ARIA attributes and accessibility patterns applied throughout all components |

---

## Data Flow Architecture

```
                         DATA FLOW (read path)
  +-----------+     +-------+     +---------+     +----------+     +-----------+
  | Component | --> | Hook  | --> | Store   | --> | Service  | --> | API       |
  | (React)   |     |       |     |(Zustand)|     |          |     |(Supabase) |
  +-----------+     +-------+     +---------+     +----------+     +-----------+
       ^                               |               |                |
       |                               v               v                v
       +---------- re-render ----- state update    IndexedDB        PostgreSQL


                         OFFLINE SYNC
  +-----------+                    +----------+                  +-----------+
  | IndexedDB | <-- write/read --> | Services | <-- sync/push --> | Supabase  |
  | (local)   |                    |          |                  | (remote)  |
  +-----------+                    +----------+                  +-----------+
       ^                                                              |
       |                    +-------------+                           |
       +--- cache/queue --- | syncService | --- reconcile on reconnect+
                            +-------------+

                         REALTIME (push path)
  +-----------+     +-------------------+     +---------+     +-----------+
  | Supabase  | --> | realtimeService   | --> | Store   | --> | Component |
  | Realtime  |     | (subscriptions)   |     |(Zustand)|     | (re-render)|
  +-----------+     +-------------------+     +---------+     +-----------+
```

**Summary of data paths:**

- **Read path:** Components call hooks, which read from the Zustand store. Store slices invoke service-layer functions that call Supabase API methods.
- **Write path:** User actions in components dispatch store actions. Store slices call services, which persist to both IndexedDB (for offline availability) and Supabase (for cloud persistence).
- **Offline sync:** When the device goes offline, writes queue in IndexedDB. The `syncService` reconciles queued changes with Supabase when connectivity is restored.
- **Realtime push:** Supabase Realtime channels push partner updates through `realtimeService`, which updates the Zustand store, triggering component re-renders.
