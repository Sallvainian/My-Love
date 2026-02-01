# Source Tree Analysis

> Annotated directory structure for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Project Root

```
My-Love/
├── .github/workflows/          # CI/CD pipeline definitions
│   ├── claude-code-review.yml  # AI-assisted PR review
│   ├── claude.yml              # Claude integration workflow
│   ├── deploy.yml              # GitHub Pages deployment (build → deploy)
│   ├── supabase-migrations.yml # Database migration CI
│   └── test.yml                # Vitest + Playwright test suite
├── docs/                       # 📖 Project documentation (this folder)
│   ├── .archive/               # Archived/superseded docs
│   └── *.md                    # Generated reference docs
├── public/                     # Static assets served at root
│   ├── 404.html                # GitHub Pages SPA fallback
│   ├── icons/                  # PWA icons (multiple sizes)
│   └── vite.svg                # Default Vite favicon
├── src/                        # 🎯 Application source (see below)
├── supabase/                   # Backend-as-a-Service config
│   ├── config.toml             # Supabase project configuration
│   ├── functions/              # Edge Functions (Deno runtime)
│   ├── migrations/             # PostgreSQL migration files (9 total)
│   └── snippets/               # Reusable SQL snippets
├── .env / .env.example         # Environment variables (Supabase keys)
├── .nvmrc                      # Node.js version pin (24.x)
├── eslint.config.js            # ESLint flat config
├── index.html                  # SPA entry point (Vite injects bundle)
├── package.json                # Dependencies & scripts
├── playwright.config.ts        # E2E test configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript root config
├── tsconfig.app.json           # App-specific TS config
├── tsconfig.node.json          # Node/tooling TS config
├── vite.config.ts              # Vite build configuration
└── vitest.config.ts            # Vitest unit test configuration
```

## Source Directory (`src/`)

```
src/
├── App.tsx                     # 🎯 Root component: routing, auth, layout
├── main.tsx                    # React DOM entry point, store hydration
├── index.css                   # Global styles, Tailwind directives
├── vite-env.d.ts               # Vite client type declarations
│
├── api/                        # Supabase API client layer
│   ├── authService.ts          # Authentication (email, OAuth, sessions)
│   ├── errorHandlers.ts        # Error classification & formatting
│   ├── interactionService.ts   # Poke/kiss interactions API
│   ├── moodApi.ts              # Mood CRUD with pagination
│   ├── moodSyncService.ts      # Offline → online mood sync
│   ├── partnerService.ts       # Partner search, requests, connection
│   ├── supabaseClient.ts       # Supabase client singleton
│   └── validation/             # Supabase response Zod schemas
│
├── components/                 # React UI components (26 feature folders)
│   ├── AdminPanel/             # Message management (lazy-loaded)
│   ├── CountdownTimer/         # Anniversary countdown display
│   ├── DailyMessage/           # Daily love message with swipe nav
│   ├── DisplayNameSetup/       # New user name modal (OAuth flow)
│   ├── ErrorBoundary/          # Global error boundary (class component)
│   ├── InteractionHistory/     # Poke/kiss history view
│   ├── LoginScreen/            # Email/password + Google OAuth
│   ├── love-notes/             # 💬 Chat feature
│   │   ├── FullScreenImageViewer.tsx  # Image modal
│   │   ├── ImagePreview.tsx           # Inline image preview
│   │   ├── LoveNoteMessage.tsx        # Message bubble component
│   │   ├── LoveNotes.tsx              # Main chat container
│   │   ├── MessageInput.tsx           # Text + image input
│   │   ├── MessageList.tsx            # Scrollable message list
│   │   └── __tests__/                 # Component tests
│   ├── MoodHistory/            # Calendar view of mood entries
│   ├── MoodTracker/            # Mood logging + timeline + buttons
│   ├── Navigation/             # Bottom tab navigation (7 tabs)
│   ├── PartnerMoodView/        # Partner connection + mood display
│   ├── PhotoCarousel/          # Full-screen photo viewer (lazy)
│   ├── PhotoDeleteConfirmation/# Delete confirmation dialog
│   ├── PhotoEditModal/         # Photo caption editing
│   ├── PhotoGallery/           # Photo grid with infinite scroll
│   ├── photos/                 # Shared photo utilities
│   ├── PhotoUpload/            # Upload modal with compression (lazy)
│   ├── PokeKissInterface/      # FAB with poke/kiss actions
│   ├── RelationshipTimers/     # Time-together & event countdowns
│   ├── scripture-reading/      # 📖 Bible reading feature
│   │   ├── containers/         # ScriptureOverview, SoloReadingFlow
│   │   ├── index.ts            # Barrel export
│   │   └── __tests__/          # Feature tests
│   ├── Settings/               # User preferences panel
│   ├── shared/                 # Cross-feature components
│   │   ├── NetworkStatusIndicator.tsx  # Online/offline badge
│   │   └── SyncToast.tsx              # Sync notification toast
│   ├── ViewErrorBoundary/      # Per-view error boundary
│   ├── WelcomeButton/          # Welcome interaction button
│   └── WelcomeSplash/          # First-visit splash screen (lazy)
│
├── config/                     # Application configuration
│   ├── constants.ts            # App config (partner name, start date)
│   ├── images.ts               # Image compression/validation limits
│   ├── performance.ts          # Pagination, quotas, validation limits
│   └── relationshipDates.ts    # Anniversary & event date definitions
│
├── constants/                  # Legacy constants (to consolidate)
│
├── data/                       # Static data files
│   ├── defaultMessages.ts      # 365 love messages (5 categories × 73)
│   └── scriptureSteps.ts       # 17 scripture steps (6 themes, NKJV)
│
├── hooks/                      # Custom React hooks
│   ├── index.ts                # Barrel export
│   ├── useAuth.ts              # Authentication state
│   ├── useAutoSave.ts          # Debounced auto-save
│   ├── useImageCompression.ts  # Image compression wrapper
│   ├── useLoveNotes.ts         # Love notes with realtime
│   ├── useMoodHistory.ts       # Mood query + filtering
│   ├── useMotionConfig.ts      # prefers-reduced-motion support
│   ├── useNetworkStatus.ts     # Online/offline/connecting states
│   ├── usePartnerMood.ts       # Partner mood with realtime
│   ├── usePhotos.ts            # Photo loading + upload
│   ├── useRealtimeMessages.ts  # Broadcast channel subscription
│   ├── useVibration.ts         # Haptic feedback patterns
│   └── __tests__/              # Hook tests
│
├── services/                   # Business logic & data access
│   ├── BaseIndexedDBService.ts # 🏗️ Abstract CRUD base class (generic)
│   ├── customMessageService.ts # Custom message management
│   ├── dbSchema.ts             # IndexedDB schema (v5, 8 stores)
│   ├── imageCompressionService.ts # Canvas API compression
│   ├── loveNoteImageService.ts # Edge Function upload + URL cache
│   ├── migrationService.ts     # LocalStorage → IndexedDB migration
│   ├── moodService.ts          # Mood CRUD (extends Base)
│   ├── performanceMonitor.ts   # Timing metrics wrapper
│   ├── photoService.ts         # Supabase Storage operations
│   ├── photoStorageService.ts  # Local photo cache (extends Base)
│   ├── realtimeService.ts      # Supabase Realtime subscriptions
│   ├── scriptureReadingService.ts # Scripture session management
│   ├── storage.ts              # IndexedDB initialization
│   ├── syncService.ts          # Offline sync orchestration
│   └── __tests__/              # Service tests
│
├── stores/                     # Zustand state management
│   ├── useAppStore.ts          # 🏗️ Composed store (10 slices)
│   ├── types.ts                # Store type definitions
│   └── slices/                 # Feature-organized state slices
│       ├── appSlice.ts         # Loading, error, hydration
│       ├── interactionsSlice.ts# Poke/kiss with optimistic UI
│       ├── messagesSlice.ts    # Messages + rotation + favorites
│       ├── moodSlice.ts        # Mood tracking + sync status
│       ├── navigationSlice.ts  # View routing (URL-based)
│       ├── notesSlice.ts       # Love notes + rate limiting
│       ├── partnerSlice.ts     # Partner connection state
│       ├── photosSlice.ts      # Photo gallery + upload
│       ├── scriptureReadingSlice.ts # Scripture session + retry
│       └── settingsSlice.ts    # User preferences + init
│
├── sw.ts                       # Service Worker (Workbox strategies)
├── sw-db.ts                    # SW IndexedDB access (no window)
├── sw-types.d.ts               # Service Worker type declarations
│
├── types/                      # TypeScript type definitions
│   ├── database.types.ts       # Supabase-generated DB types
│   ├── index.ts                # Shared application types
│   └── models.ts               # Domain model types
│
├── utils/                      # Utility functions
│   ├── backgroundSync.ts       # Service Worker sync registration
│   ├── calendarHelpers.ts      # Month grid generation
│   ├── countdownService.ts     # Date countdown calculations
│   ├── dateFormat.ts           # Date formatting utilities
│   ├── dateFormatters.ts       # Display-friendly date strings
│   ├── dateHelpers.ts          # Date manipulation helpers
│   ├── haptics.ts              # Vibration API wrapper
│   ├── interactionValidation.ts# Poke/kiss input validation
│   ├── messageRotation.ts      # Daily message selection algorithm
│   ├── messageValidation.ts    # Message content validation
│   ├── moodEmojis.ts           # Mood → emoji mapping
│   ├── moodGrouping.ts         # Mood categorization logic
│   ├── offlineErrorHandler.ts  # Offline-specific error handling
│   ├── performanceMonitoring.ts# Performance measurement hooks
│   ├── storageMonitor.ts       # Storage quota monitoring
│   ├── themes.ts               # Theme color definitions (5 themes)
│   └── __tests__/              # Utility tests
│
└── validation/                 # Input validation
    ├── errorMessages.ts        # User-friendly error messages
    ├── index.ts                # Barrel export
    └── schemas.ts              # Zod schemas (messages, moods, photos, settings)
```

## Supabase Backend

```
supabase/
├── config.toml                 # Project config (auth, storage, API settings)
├── functions/
│   └── upload-love-note-image/ # Edge Function: image upload
│       └── index.ts            # JWT auth → rate limit → magic bytes → storage
├── migrations/                 # 9 sequential PostgreSQL migrations
│   ├── 20251203000001_create_base_schema.sql      # Core tables + RLS
│   ├── 20251203190800_create_photos_table.sql      # Photos + storage bucket
│   ├── 20251205000001_add_love_notes_images.sql    # Image support for notes
│   ├── 20251205000002_add_mime_validation.sql      # Upload MIME validation
│   ├── 20251206024345_remote_schema.sql            # ENUM→TEXT, indexes, RLS
│   ├── 20251206124803_fix_users_rls_policy.sql     # User visibility fix
│   ├── 20251206200000_fix_users_update_privilege_escalation.sql # Security fix
│   ├── 20260128000001_scripture_reading.sql         # Scripture feature tables
│   └── 20260130000001_scripture_rpcs.sql            # RPCs + seed data
└── snippets/                   # Reusable SQL templates
```

## CI/CD Pipelines

```
.github/workflows/
├── deploy.yml                  # Build → GitHub Pages deploy (on push to main)
├── test.yml                    # Vitest unit + Playwright E2E (on PR + push)
├── supabase-migrations.yml     # Migration validation on PR
├── claude-code-review.yml      # AI code review on PR
└── claude.yml                  # Claude integration workflow
```

## Critical Paths

### Entry Points
| Entry Point | File | Purpose |
|-------------|------|---------|
| Web App | `index.html` → `src/main.tsx` → `src/App.tsx` | SPA bootstrap |
| Service Worker | `src/sw.ts` | Offline caching + background sync |
| Edge Function | `supabase/functions/upload-love-note-image/index.ts` | Server-side image processing |

### Data Flow Paths
| Flow | Path |
|------|------|
| UI → State | `components/` → `hooks/` → `stores/slices/` |
| State → API | `stores/slices/` → `api/` → Supabase |
| State → Local DB | `stores/slices/` → `services/` → IndexedDB |
| Offline Sync | `sw.ts` → `sw-db.ts` → Supabase REST |
| Validation | `validation/schemas.ts` + `api/validation/` |

### Feature Module Map
| Feature | Components | Store Slice | Service | API |
|---------|-----------|-------------|---------|-----|
| Daily Messages | `DailyMessage/` | `messagesSlice` | `customMessageService` | — |
| Mood Tracking | `MoodTracker/`, `MoodHistory/` | `moodSlice` | `moodService` | `moodApi` |
| Love Notes | `love-notes/` | `notesSlice` | `loveNoteImageService` | Supabase direct |
| Photos | `PhotoGallery/`, `PhotoUpload/`, `PhotoCarousel/` | `photosSlice` | `photoService`, `photoStorageService` | Supabase Storage |
| Scripture | `scripture-reading/` | `scriptureReadingSlice` | `scriptureReadingService` | Supabase RPC |
| Partner | `PartnerMoodView/`, `PokeKissInterface/` | `partnerSlice`, `interactionsSlice` | `realtimeService` | `partnerService`, `interactionService` |
| Settings | `Settings/` | `settingsSlice` | — | — |
| Auth | `LoginScreen/`, `DisplayNameSetup/` | `appSlice` | — | `authService` |

## File Statistics

| Category | Count | Notes |
|----------|-------|-------|
| TypeScript/TSX source | ~163 | Application code |
| Test files | ~38 | Vitest + Playwright |
| Component folders | 26 | Feature-organized |
| Store slices | 10 | Zustand composition |
| Services | 14 | Business logic layer |
| Custom hooks | 12 | React state bridges |
| Utility modules | 16 | Shared helpers |
| SQL migrations | 9 | Schema evolution |
| CI workflows | 5 | GitHub Actions |
| Config files | 10+ | Build, lint, test, TS |
