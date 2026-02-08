# Complete Directory Tree

```
My-Love/
│
├── .github/                                      # GitHub integrations and CI/CD
│   ├── workflows/
│   │   ├── test.yml                              # Main CI test pipeline (unit + E2E)
│   │   ├── deploy.yml                            # GitHub Pages deployment
│   │   ├── claude.yml                            # Claude Code AI agent workflow
│   │   ├── claude-code-review.yml                # AI-powered code review on PRs
│   │   └── supabase-migrations.yml               # Database migration CI checks
│   │
│   ├── agents/                                   # 10 BMAD Method agent configurations
│   │   ├── bmd-custom-bmm-analyst.agent.md       # Business analyst agent
│   │   ├── bmd-custom-bmm-architect.agent.md     # Architect agent
│   │   ├── bmd-custom-bmm-dev.agent.md           # Developer agent
│   │   ├── bmd-custom-bmm-pm.agent.md            # Project manager agent
│   │   ├── bmd-custom-bmm-quick-flow-solo-dev.agent.md  # Solo dev quick-flow agent
│   │   ├── bmd-custom-bmm-sm.agent.md            # Scrum master agent
│   │   ├── bmd-custom-bmm-tea.agent.md           # Test architecture enterprise agent
│   │   ├── bmd-custom-bmm-tech-writer.agent.md   # Technical writer agent
│   │   ├── bmd-custom-bmm-ux-designer.agent.md   # UX designer agent
│   │   └── bmd-custom-core-bmad-master.agent.md  # BMAD master orchestrator agent
│   │
│   ├── copilot-instructions.md                   # GitHub Copilot context instructions
│   ├── dependabot.yml                            # Automated dependency update config
│   └── codeql/
│       └── codeql-config.yml                     # CodeQL security scanning rules
│
├── public/                                       # Static assets served at root
│   ├── 404.html                                  # GitHub Pages SPA 404 redirect handler
│   ├── vite.svg                                  # Default Vite logo
│   └── icons/
│       ├── icon.svg                              # App icon (SVG source)
│       ├── icon-192.png                          # PWA manifest icon 192x192
│       └── icon-512.png                          # PWA manifest icon 512x512
│
├── scripts/                                      # Developer automation scripts
│   ├── burn-in.sh                                # Extended stability test runner
│   ├── ci-local.sh                               # Run full CI pipeline locally
│   ├── clear-caches.js                           # Wipe build and test caches
│   ├── dev-with-cleanup.sh                       # Dev server with orphan-process cleanup
│   ├── inspect-db.sh                             # Inspect local Supabase database
│   ├── test-with-cleanup.sh                      # Playwright runner with process cleanup
│   ├── fetch_comments.py                         # Fetch PR/issue comments (Python)
│   ├── post-deploy-check.cjs                     # Post-deploy smoke validation
│   └── validate-messages.cjs                     # Validate static message data integrity
│
├── src/                                          # Application source code
│   │
│   ├── main.tsx                     # ★ App entry point -- mounts React root, registers
│   │                                #   PWA service worker with auto-update prompt
│   │
│   ├── App.tsx                      # ★ Root component -- view routing via Zustand
│   │                                #   navigation slice, auth state gate, error boundary
│   │
│   ├── index.css                    # Global stylesheet -- Tailwind base/components/
│   │                                #   utilities imports plus custom CSS variables
│   │
│   ├── sw.ts                        # ★ Service Worker -- Workbox precaching, runtime
│   │                                #   caching strategies, offline fallback, background sync
│   │
│   ├── sw-types.d.ts                # TypeScript ambient types for SW globals
│   ├── sw-db.ts                     # IndexedDB helpers used inside the service worker
│   ├── vite-env.d.ts                # Vite client type augmentation (import.meta.env)
│   │
│   ├── api/                         # Supabase API layer (server communication)
│   │   ├── supabaseClient.ts        # ★ Supabase client singleton initialization
│   │   ├── authService.ts           # Email/password authentication operations
│   │   ├── errorHandlers.ts         # API error normalization and retry logic
│   │   ├── moodApi.ts               # Mood CRUD -- insert, update, fetch by date range
│   │   ├── moodSyncService.ts       # Mood offline queue and sync reconciliation
│   │   ├── interactionService.ts    # Poke/Kiss/Fart interaction API calls
│   │   ├── partnerService.ts        # Partner profile and mood data fetching
│   │   └── validation/
│   │       └── supabaseSchemas.ts   # Zod schemas validating Supabase response shapes
│   │
│   ├── components/                  # 26 component folders (UI layer)
│   │   │
│   │   ├── AdminPanel/              # Message management admin interface
│   │   │   ├── AdminPanel.tsx       # Admin panel container
│   │   │   ├── CreateMessageForm.tsx  # New message creation form
│   │   │   ├── DeleteConfirmDialog.tsx  # Delete confirmation modal
│   │   │   ├── EditMessageForm.tsx  # Message edit form
│   │   │   ├── MessageList.tsx      # Message list with actions
│   │   │   └── MessageRow.tsx       # Single message row display
│   │   │
│   │   ├── CountdownTimer/          # Relationship countdown display
│   │   │
│   │   ├── DailyMessage/            # Daily rotating love message
│   │   │
│   │   ├── DisplayNameSetup/        # First-login display name onboarding
│   │   │
│   │   ├── ErrorBoundary/           # Global React error boundary
│   │   │
│   │   ├── InteractionHistory/      # Poke/Kiss interaction history log
│   │   │
│   │   ├── LoginScreen/             # Authentication UI (email/password)
│   │   │
│   │   ├── love-notes/              # Real-time love notes messaging
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── LoveNotes.tsx        # Container component
│   │   │   ├── MessageList.tsx      # Scrollable message list
│   │   │   ├── MessageInput.tsx     # Message compose input
│   │   │   ├── LoveNoteMessage.tsx  # Individual message bubble
│   │   │   ├── ImagePreview.tsx     # Inline image preview
│   │   │   ├── FullScreenImageViewer.tsx  # Full-screen image viewer
│   │   │   └── __tests__/           # 4 component test files
│   │   │       ├── FullScreenImageViewer.test.tsx
│   │   │       ├── ImagePreview.test.tsx
│   │   │       ├── LoveNoteMessage.test.tsx
│   │   │       └── MessageInput.test.tsx
│   │   │
│   │   ├── MoodHistory/             # Calendar-based mood history view
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── MoodHistoryCalendar.tsx  # Calendar grid layout
│   │   │   ├── CalendarDay.tsx      # Single day cell rendering
│   │   │   └── MoodDetailModal.tsx  # Day detail modal overlay
│   │   │
│   │   ├── MoodTracker/             # Mood logging interface
│   │   │   ├── MoodTracker.tsx      # Tracker container
│   │   │   ├── MoodButton.tsx       # Emoji mood selector button
│   │   │   ├── MoodHistoryItem.tsx  # Single mood entry display
│   │   │   ├── MoodHistoryTimeline.tsx  # Timeline list of moods
│   │   │   ├── NoMoodLoggedState.tsx  # Empty state prompt
│   │   │   └── PartnerMoodDisplay.tsx  # Partner mood inline view
│   │   │
│   │   ├── Navigation/              # Bottom tab navigation bar
│   │   │
│   │   ├── PartnerMoodView/         # Partner mood and interactions view
│   │   │
│   │   ├── PhotoCarousel/           # Photo carousel/slider viewer
│   │   │
│   │   ├── PhotoDeleteConfirmation/ # Photo delete confirmation modal
│   │   │
│   │   ├── PhotoEditModal/          # Photo caption/metadata editor
│   │   │
│   │   ├── PhotoGallery/            # Photo grid gallery
│   │   │   ├── PhotoGallery.tsx     # Gallery container with infinite scroll
│   │   │   ├── PhotoGridItem.tsx    # Grid thumbnail item
│   │   │   ├── PhotoGridSkeleton.tsx  # Loading skeleton placeholder
│   │   │   └── PhotoViewer.tsx      # Full photo viewer with gestures
│   │   │
│   │   ├── photos/                  # Photo upload handling component
│   │   │
│   │   ├── PhotoUpload/             # Photo upload modal with compression
│   │   │
│   │   ├── PokeKissInterface/       # Playful interaction buttons (Poke/Kiss/Fart)
│   │   │
│   │   ├── RelationshipTimers/      # Anniversary and milestone countdowns
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── RelationshipTimers.tsx  # Timers container
│   │   │   ├── TimeTogether.tsx     # Days/months/years together display
│   │   │   ├── EventCountdown.tsx   # Next-event countdown
│   │   │   └── BirthdayCountdown.tsx  # Birthday-specific countdown
│   │   │
│   │   ├── scripture-reading/       # ★ Epic 2: Scripture reading feature
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── containers/
│   │   │   │   ├── ScriptureOverview.tsx   # Scripture progress overview
│   │   │   │   └── SoloReadingFlow.tsx     # Step-by-step reading flow
│   │   │   ├── reading/
│   │   │   │   └── BookmarkFlag.tsx        # Reading position bookmark
│   │   │   ├── reflection/
│   │   │   │   ├── PerStepReflection.tsx   # Per-step reflection input
│   │   │   │   └── ReflectionSummary.tsx   # End-of-session summary
│   │   │   └── __tests__/           # 7 comprehensive test files
│   │   │       ├── BookmarkFlag.test.tsx
│   │   │       ├── DailyPrayerReport.test.tsx
│   │   │       ├── MessageCompose.test.tsx
│   │   │       ├── PerStepReflection.test.tsx
│   │   │       ├── ReflectionSummary.test.tsx
│   │   │       ├── ScriptureOverview.test.tsx
│   │   │       └── SoloReadingFlow.test.tsx
│   │   │
│   │   ├── Settings/                # Application settings
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── Settings.tsx         # Settings container
│   │   │   ├── Settings.css         # Settings-specific styles
│   │   │   └── AnniversarySettings.tsx  # Anniversary date configuration
│   │   │
│   │   ├── shared/                  # Shared cross-cutting components
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── NetworkStatusIndicator.tsx  # Online/offline status badge
│   │   │   └── SyncToast.tsx        # Data sync notification toast
│   │   │
│   │   ├── ViewErrorBoundary/       # View-specific error boundary wrapper
│   │   │
│   │   ├── WelcomeButton/           # Welcome splash trigger button
│   │   │
│   │   └── WelcomeSplash/           # Animated welcome screen
│   │
│   ├── config/                      # Application-level configuration
│   │   ├── constants.ts             # Partner names, relationship start date
│   │   ├── performance.ts           # Performance budget thresholds
│   │   ├── relationshipDates.ts     # Milestone dates (anniversaries, birthdays)
│   │   └── images.ts               # Image asset path configuration
│   │
│   ├── constants/
│   │   └── animations.ts           # Framer Motion animation presets/variants
│   │
│   ├── data/                        # Static application data
│   │   ├── defaultMessages.ts       # 100+ default love messages (~49 KB)
│   │   └── scriptureSteps.ts        # Scripture reading plan step definitions
│   │
│   ├── hooks/                       # Custom React hooks (12 hooks)
│   │   ├── useAuth.ts               # Authentication state and operations
│   │   ├── useAutoSave.ts           # Debounced auto-save to backend
│   │   ├── useImageCompression.ts   # Client-side image compression
│   │   ├── useLoveNotes.ts          # Love notes CRUD and realtime subscription
│   │   ├── useMoodHistory.ts        # Mood history data fetching and caching
│   │   ├── useMotionConfig.ts       # Reduced-motion media query preferences
│   │   ├── useNetworkStatus.ts      # Online/offline detection via navigator API
│   │   ├── usePartnerMood.ts        # Partner mood realtime subscription
│   │   ├── usePhotos.ts             # Photo gallery data and pagination
│   │   ├── useRealtimeMessages.ts   # Supabase realtime channel subscription
│   │   ├── useVibration.ts          # Haptic feedback via Vibration API
│   │   └── __tests__/               # 4 hook test files
│   │       ├── useMotionConfig.test.ts
│   │       ├── useNetworkStatus.test.ts
│   │       ├── usePartnerMood.test.ts
│   │       └── useRealtimeMessages.test.ts
│   │
│   ├── services/                    # Business logic and data access layer (14 files)
│   │   ├── BaseIndexedDBService.ts  # ★ Generic IndexedDB abstraction (open, get, put)
│   │   ├── dbSchema.ts              # IndexedDB database schema and version definitions
│   │   ├── migrationService.ts      # IndexedDB schema migration orchestrator
│   │   ├── storage.ts               # localStorage read/write wrapper
│   │   ├── photoService.ts          # Photo CRUD against Supabase storage
│   │   ├── photoStorageService.ts   # Photo blob caching in IndexedDB
│   │   ├── customMessageService.ts  # Custom love message CRUD operations
│   │   ├── moodService.ts           # Mood data operations and caching
│   │   ├── scriptureReadingService.ts  # Scripture session and reflection persistence
│   │   ├── loveNoteImageService.ts  # Love note image upload and retrieval
│   │   ├── imageCompressionService.ts  # Canvas-based image resize and compression
│   │   ├── realtimeService.ts       # Supabase realtime channel management
│   │   ├── syncService.ts           # Offline-to-online data sync orchestration
│   │   ├── performanceMonitor.ts    # Runtime performance metric collection
│   │   └── __tests__/               # Service test files
│   │
│   ├── stores/                      # Zustand state management
│   │   ├── useAppStore.ts           # ★ Main combined store with persist middleware
│   │   ├── types.ts                 # Store slice type definitions
│   │   └── slices/                  # 10 modular state slices
│   │       ├── appSlice.ts          # Global loading, error, and initialization state
│   │       ├── navigationSlice.ts   # Current view and routing state
│   │       ├── messagesSlice.ts     # Daily message rotation and custom messages
│   │       ├── moodSlice.ts         # Mood tracking entries and sync status
│   │       ├── interactionsSlice.ts # Poke/Kiss/Fart interaction state
│   │       ├── photosSlice.ts       # Photo gallery items and upload state
│   │       ├── notesSlice.ts        # Love notes conversation state
│   │       ├── partnerSlice.ts      # Partner mood and online status
│   │       ├── settingsSlice.ts     # User preferences (theme, notifications)
│   │       └── scriptureReadingSlice.ts  # Scripture reading progress and reflections
│   │
│   ├── types/                       # TypeScript type definitions
│   │   ├── index.ts                 # Application-wide type exports
│   │   ├── models.ts               # Domain model interfaces (Mood, Photo, Note)
│   │   └── database.types.ts       # Supabase CLI auto-generated database types
│   │
│   ├── utils/                       # Pure utility functions (16 files)
│   │   ├── dateHelpers.ts           # Date arithmetic (add, subtract, difference)
│   │   ├── dateFormat.ts            # Date-to-string formatting
│   │   ├── dateFormatters.ts        # Specialized display formatters (relative time)
│   │   ├── calendarHelpers.ts       # Calendar grid generation utilities
│   │   ├── countdownService.ts      # Days-until calculations for milestones
│   │   ├── messageRotation.ts       # Daily message rotation algorithm
│   │   ├── moodEmojis.ts           # Mood value to emoji character mapping
│   │   ├── moodGrouping.ts         # Group mood entries by day/week/month
│   │   ├── messageValidation.ts     # Message content validation rules
│   │   ├── interactionValidation.ts # Interaction payload validation
│   │   ├── haptics.ts               # Vibration API wrappers for haptic feedback
│   │   ├── themes.ts               # Theme CSS variable application
│   │   ├── backgroundSync.ts       # Service Worker background sync registration
│   │   ├── offlineErrorHandler.ts   # User-facing offline error messages
│   │   ├── storageMonitor.ts       # Storage quota monitoring and warnings
│   │   ├── performanceMonitoring.ts # Web Vitals and custom perf tracking
│   │   └── __tests__/              # 4 utility test files
│   │       ├── backgroundSync.test.ts
│   │       ├── dateFormat.test.ts
│   │       ├── haptics.test.ts
│   │       └── moodGrouping.test.ts
│   │
│   ├── validation/                  # Runtime data validation (Zod)
│   │   ├── index.ts                 # Barrel export
│   │   ├── schemas.ts              # Zod schemas for all domain objects
│   │   └── errorMessages.ts        # Human-readable validation error strings
│   │
│   └── assets/
│       └── react.svg               # React logo SVG asset
│
├── supabase/                        # Supabase backend configuration
│   ├── config.toml                  # Local development Supabase config
│   ├── migrations/                  # 9 sequential SQL migrations
│   │   ├── 20251203000001_create_base_schema.sql      # Users, moods, messages,
│   │   │                                               # interactions base tables
│   │   ├── 20251203190800_create_photos_table.sql     # Photos table and storage bucket
│   │   ├── 20251205000001_add_love_notes_images.sql   # Love note image support columns
│   │   ├── 20251205000002_add_mime_validation.sql     # MIME type check constraints
│   │   ├── 20251206024345_remote_schema.sql           # Remote schema synchronization
│   │   ├── 20251206124803_fix_users_rls_policy.sql    # Row Level Security policy fix
│   │   ├── 20251206200000_fix_users_update_privilege_escalation.sql  # Security patch
│   │   ├── 20260128000001_scripture_reading.sql       # Scripture sessions and
│   │   │                                               # reflections tables (Epic 2)
│   │   └── 20260130000001_scripture_rpcs.sql          # Scripture RPC functions (Epic 2)
│   └── functions/
│       └── upload-love-note-image/
│           └── index.ts             # Supabase Edge Function for image upload
│
├── tests/                           # Test suite root
│   ├── setup.ts                     # Vitest global setup (mocks, environment)
│   ├── README.md                    # Test suite documentation and conventions
│   ├── merged-fixtures.ts           # Combined Playwright page-object fixtures
│   │
│   ├── support/                     # Shared test infrastructure
│   │   ├── helpers/
│   │   │   └── index.ts            # Test helper utilities (render wrappers, waitFor)
│   │   ├── factories/
│   │   │   └── index.ts            # Test data factories (createMood, createUser)
│   │   └── fixtures/
│   │       └── index.ts            # Playwright fixture definitions
│   │
│   ├── unit/                        # Unit tests (Vitest + Testing Library)
│   │   ├── data/
│   │   │   └── scriptureSteps.test.ts       # Scripture step data integrity
│   │   ├── hooks/
│   │   │   └── useAutoSave.test.ts          # Auto-save hook behavior
│   │   ├── services/
│   │   │   ├── dbSchema.test.ts             # IndexedDB schema correctness
│   │   │   ├── dbSchema.indexes.test.ts     # Index definition verification
│   │   │   └── scriptureReadingService.test.ts  # Scripture service operations
│   │   ├── stores/
│   │   │   └── scriptureReadingSlice.test.ts  # Scripture slice state transitions
│   │   ├── utils/
│   │   │   ├── dateFormat.test.ts           # Date formatting edge cases
│   │   │   └── moodGrouping.test.ts         # Mood grouping algorithms
│   │   └── validation/
│   │       └── schemas.test.ts              # Zod schema validation rules
│   │
│   ├── e2e/                         # End-to-end tests (Playwright)
│   │   ├── auth/                    # Authentication flows (4 specs)
│   │   │   ├── login.spec.ts        # Login flow
│   │   │   ├── logout.spec.ts       # Logout flow
│   │   │   ├── google-oauth.spec.ts # OAuth authentication
│   │   │   └── display-name-setup.spec.ts  # First-login onboarding
│   │   ├── home/                    # Home view (3 specs)
│   │   │   ├── home-view.spec.ts    # Home page content
│   │   │   ├── welcome-splash.spec.ts  # Welcome animation
│   │   │   └── error-boundary.spec.ts  # Error boundary behavior
│   │   ├── mood/
│   │   │   └── mood-tracker.spec.ts # Mood logging and display
│   │   ├── navigation/              # Navigation (2 specs)
│   │   │   ├── bottom-nav.spec.ts   # Bottom tab bar
│   │   │   └── routing.spec.ts      # View routing transitions
│   │   ├── notes/
│   │   │   └── love-notes.spec.ts   # Love notes messaging
│   │   ├── offline/                 # Offline behavior (2 specs)
│   │   │   ├── network-status.spec.ts  # Online/offline indicator
│   │   │   └── data-sync.spec.ts    # Offline queue and sync
│   │   ├── partner/
│   │   │   └── partner-mood.spec.ts # Partner mood display
│   │   ├── photos/                  # Photo features (2 specs)
│   │   │   ├── photo-gallery.spec.ts  # Gallery browsing
│   │   │   └── photo-upload.spec.ts   # Photo upload flow
│   │   └── scripture/               # Scripture reading (7 specs, Epic 2)
│   │       ├── scripture-overview.spec.ts       # Overview page
│   │       ├── scripture-solo-reading.spec.ts   # Solo reading flow
│   │       ├── scripture-session.spec.ts        # Session management
│   │       ├── scripture-reflection.spec.ts     # Reflection input
│   │       ├── scripture-seeding.spec.ts        # Data seeding
│   │       ├── scripture-accessibility.spec.ts  # WCAG compliance
│   │       └── scripture-rls-security.spec.ts   # Row Level Security
│   │
│   └── api/                         # API integration tests
│       └── scripture-reflection-api.spec.ts  # Reflection API contract
│
├── _bmad/                           # BMAD Method configuration and knowledge base
│
├── _bmad-output/                    # BMAD planning and implementation artifacts
│   ├── planning-artifacts/
│   │   ├── prd/                     # Product Requirements Documents (12 files)
│   │   ├── architecture/            # Architecture Decision Records (6 files)
│   │   ├── epics/                   # Epic and story definitions (8 files)
│   │   └── ux-design-specification/ # UX design specifications (12 files)
│   │
│   └── implementation-artifacts/    # Story implementation records
│       ├── 1-1-database-schema-and-backend-infrastructure/
│       ├── 1-2-navigation-and-overview-page/
│       ├── 1-3-solo-reading-flow/
│       ├── 1-4-save-resume-and-optimistic-ui/
│       ├── 1-5-accessibility-foundations/
│       ├── 2-1-per-step-reflection-system.md
│       ├── 2-2-end-of-session-reflection-summary.md
│       ├── 2-3-daily-prayer-report-send-and-view.md
│       ├── sprint-status.yaml       # Current sprint tracking
│       └── tests/                   # Test review artifacts
│
├── docs/                            # Generated project documentation
│
└── [Root Configuration Files]
    ├── package.json                 # Dependencies and npm scripts
    ├── package-lock.json            # Dependency lock file (npm)
    ├── tsconfig.json                # Root TypeScript config (references)
    ├── tsconfig.app.json            # App-specific TS config (src/)
    ├── tsconfig.node.json           # Node tooling TS config (vite, scripts)
    ├── vite.config.ts               # Vite build configuration (PWA plugin, proxy)
    ├── vitest.config.ts             # Vitest test runner configuration
    ├── playwright.config.ts         # Playwright E2E test configuration
    ├── eslint.config.js             # ESLint flat config (TS + React rules)
    ├── .prettierrc                  # Prettier formatting preferences
    ├── tailwind.config.js           # Tailwind CSS configuration
    ├── postcss.config.js            # PostCSS plugin pipeline
    ├── index.html                   # HTML entry point (Vite injects scripts here)
    ├── .nvmrc                       # Node.js version pin (18)
    ├── .env                         # Environment variables (gitignored)
    ├── .env.example                 # Environment variable template
    ├── .env.keys                    # dotenvx encryption keys
    ├── .env.local                   # Local environment overrides
    ├── .envrc                       # direnv automatic env loading
    └── CLAUDE.md                    # Project-level AI assistant instructions
```

---
