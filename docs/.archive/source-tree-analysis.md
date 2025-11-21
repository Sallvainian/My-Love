# My Love PWA - Source Tree Analysis

> **Last Updated**: 2025-11-16
> **Total Source Files**: 90 TypeScript/TSX files
> **Total Directories**: 38 in src/

## Project Root Structure

```
My-Love/
├── 📦 src/                    # Application source code (primary)
├── 🧪 tests/                  # Test suites (unit, integration, e2e)
├── 📚 docs/                   # Project documentation
├── 🗄️ supabase/               # Database migrations and config
├── 🔧 scripts/                # Build and deployment scripts
├── 📁 public/                 # Static assets (PWA manifest, icons)
├── 🏗️ dist/                   # Production build output
├── 📊 coverage/               # Test coverage reports
├── ⚙️ .github/                # CI/CD workflows
└── 🔐 .env                    # Environment configuration
```

## Entry Points

### Primary Entry Points

| File           | Purpose                                                                         | Import Chain     |
| -------------- | ------------------------------------------------------------------------------- | ---------------- |
| `src/main.tsx` | **Application bootstrap** - React 19 root render, StrictMode, global CSS import | Entry → App.tsx  |
| `src/App.tsx`  | **Root component** - Route orchestration, auth state management, lazy loading   | App → Components |
| `index.html`   | **HTML shell** - PWA manifest link, viewport config, root div                   | HTML → main.tsx  |

### Secondary Entry Points

| File                   | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `vite.config.ts`       | Build configuration, PWA plugin setup, optimization settings |
| `tailwind.config.js`   | Theme system, custom colors, animations                      |
| `playwright.config.ts` | E2E test configuration                                       |
| `vitest.config.ts`     | Unit test configuration                                      |

## Source Directory Deep Dive

### `/src/` - Application Core (90 files)

```
src/
├── 🚀 main.tsx                           # App bootstrap
├── 🎯 App.tsx                            # Root orchestrator
├── 🎨 index.css                          # Global styles + Tailwind
├── 📝 vite-env.d.ts                      # Vite type declarations
│
├── 📊 api/                               # Backend communication layer
│   ├── supabaseClient.ts                 # Supabase SDK initialization
│   ├── authService.ts                    # Authentication operations
│   ├── partnerService.ts                 # Partner pairing logic
│   ├── moodApi.ts                        # Mood CRUD operations
│   ├── moodSyncService.ts                # Real-time mood synchronization
│   ├── interactionService.ts             # Poke/Kiss interaction handling
│   ├── errorHandlers.ts                  # Centralized error processing
│   └── validation/
│       └── supabaseSchemas.ts            # Zod schemas for API responses
│
├── 🧩 components/                        # UI component library (20 components)
│   ├── AdminPanel/                       # Message management interface
│   ├── CountdownTimer/                   # Anniversary countdown display
│   ├── DailyMessage/                     # Primary message display
│   ├── DisplayNameSetup/                 # User name configuration
│   ├── ErrorBoundary/                    # React error boundary
│   ├── InteractionHistory/               # Poke/Kiss history view
│   ├── LoginScreen/                      # Authentication UI
│   ├── MoodHistory/                      # Calendar-based mood view
│   ├── MoodTracker/                      # Emotion selection interface
│   ├── Navigation/                       # Bottom navigation bar
│   ├── PartnerMoodView/                  # Partner's current mood
│   ├── PhotoCarousel/                    # Full-screen photo viewer
│   ├── PhotoDeleteConfirmation/          # Delete confirmation dialog
│   ├── PhotoEditModal/                   # Photo metadata editing
│   ├── PhotoGallery/                     # Grid-based photo browser
│   ├── PhotoUpload/                      # Image upload with compression
│   ├── PokeKissInterface/                # Interactive gestures
│   ├── Settings/                         # App configuration UI
│   ├── WelcomeButton/                    # Initial interaction trigger
│   └── WelcomeSplash/                    # First-time user experience
│
├── ⚙️ config/                            # Application configuration
│   ├── constants.ts                      # App-wide constants
│   └── performance.ts                    # Performance thresholds
│
├── 🎭 constants/                         # Static constants
│   └── animations.ts                     # Framer Motion variants
│
├── 📦 data/                              # Static data
│   └── defaultMessages.ts                # 365 pre-written love messages
│
├── 🪝 hooks/                             # Custom React hooks (empty)
│
├── 🔧 services/                          # Business logic layer (10 services)
│   ├── BaseIndexedDBService.ts           # Abstract IndexedDB operations
│   ├── customMessageService.ts           # User-created messages
│   ├── imageCompressionService.ts        # Photo optimization
│   ├── migrationService.ts               # Data migration utilities
│   ├── moodService.ts                    # Local mood persistence
│   ├── performanceMonitor.ts             # Runtime performance tracking
│   ├── photoStorageService.ts            # Photo IndexedDB operations
│   ├── realtimeService.ts                # Supabase realtime subscriptions
│   ├── storage.ts                        # Generic IndexedDB wrapper
│   └── syncService.ts                    # Offline-to-online sync
│
├── 🏪 stores/                            # State management
│   ├── useAppStore.ts                    # Zustand store composition
│   └── slices/                           # Feature-specific state slices
│       ├── settingsSlice.ts              # User preferences
│       ├── messagesSlice.ts              # Message rotation & history
│       ├── photosSlice.ts                # Photo gallery state
│       ├── moodSlice.ts                  # Mood tracking state
│       ├── partnerSlice.ts               # Partner connection state
│       ├── interactionsSlice.ts          # Poke/Kiss state
│       └── navigationSlice.ts            # App navigation state
│
├── 📐 types/                             # TypeScript definitions
│   ├── index.ts                          # Core application types
│   └── database.types.ts                 # Supabase generated types
│
├── 🛠️ utils/                             # Utility functions
│   ├── calendarHelpers.ts                # Date calculations for calendar
│   ├── countdownService.ts               # Anniversary countdown logic
│   ├── dateHelpers.ts                    # Date formatting utilities
│   ├── interactionValidation.ts          # Interaction rate limiting
│   ├── messageRotation.ts                # Daily message selection
│   ├── storageMonitor.ts                 # Storage quota tracking
│   └── themes.ts                         # Theme color definitions
│
└── ✅ validation/                        # Input validation
    ├── schemas.ts                        # Zod validation schemas
    ├── errorMessages.ts                  # Human-readable error strings
    └── index.ts                          # Validation barrel export
```

## Component Architecture Deep Dive

### Feature Component Breakdown

#### 📸 Photo Management Suite (6 components)

```
PhotoUpload/
└── PhotoUpload.tsx              # 📥 File selection, compression, IndexedDB storage
    ├── Handles: file input, drag-drop
    ├── Integrates: imageCompressionService
    └── Dispatches: addPhoto action

PhotoGallery/
├── PhotoGallery.tsx             # 📊 Grid layout container
├── PhotoGridItem.tsx            # 🖼️ Individual photo thumbnail
└── PhotoGridSkeleton.tsx        # 💀 Loading placeholder

PhotoCarousel/
├── PhotoCarousel.tsx            # 🎠 Full-screen viewer
└── PhotoCarouselControls.tsx    # ⏩ Navigation controls

PhotoEditModal/
└── PhotoEditModal.tsx           # ✏️ Caption/date editing

PhotoDeleteConfirmation/
└── PhotoDeleteConfirmation.tsx  # 🗑️ Confirmation dialog
```

#### 😊 Mood Tracking Suite (4 components)

```
MoodTracker/
├── MoodTracker.tsx              # 🎯 Main mood selection interface
└── MoodButton.tsx               # 🔘 Individual emotion button

MoodHistory/
├── MoodHistoryCalendar.tsx      # 📅 Calendar grid view
├── CalendarDay.tsx              # 📆 Single day cell
├── MoodDetailModal.tsx          # 🔍 Detailed mood view
└── index.ts                     # Barrel export

PartnerMoodView/
├── PartnerMoodView.tsx          # 👥 Partner's current mood display
└── index.ts
```

#### 💬 Message Management (7 components)

```
DailyMessage/
└── DailyMessage.tsx             # 💕 Primary message display
    ├── Features: favorites, swipe navigation
    ├── Uses: messageRotation utility
    └── State: messagesSlice

AdminPanel/
├── AdminPanel.tsx               # 🎛️ Main admin container
├── MessageList.tsx              # 📋 Paginated message list
├── MessageRow.tsx               # 📝 Individual message row
├── CreateMessageForm.tsx        # ➕ New message creation
├── EditMessageForm.tsx          # ✏️ Message editing
└── DeleteConfirmDialog.tsx      # 🗑️ Delete confirmation
```

#### 🔐 Authentication Flow (3 components)

```
LoginScreen/
├── LoginScreen.tsx              # 🔑 Email/password form
├── LoginScreen.css              # Styling
└── index.ts

DisplayNameSetup/
├── DisplayNameSetup.tsx         # 👤 Post-login name setup
├── DisplayNameSetup.css
└── index.ts

WelcomeSplash/
└── WelcomeSplash.tsx            # 🎉 First-time experience
```

#### 💑 Partner Interaction (2 components)

```
PokeKissInterface/
├── PokeKissInterface.tsx        # 👆💋 Poke/Kiss buttons
└── index.ts                     # Rate limiting, animations

InteractionHistory/
├── InteractionHistory.tsx       # 📜 History timeline
└── index.ts
```

## Service Layer Architecture

### Service Dependency Graph

```
┌─────────────────┐
│   Components    │
└────────┬────────┘
         │ uses
         ▼
┌─────────────────┐     ┌─────────────────┐
│   Zustand       │◄────│   API Layer     │
│   Slices        │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ persists/loads        │ network ops
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Services      │     │  Supabase SDK   │
│   (Business)    │     │                 │
└────────┬────────┘     └─────────────────┘
         │
         │ storage ops
         ▼
┌─────────────────┐
│   IndexedDB     │
│   + LocalStorage│
└─────────────────┘
```

### Service Responsibilities

| Service                      | Responsibility                     | Dependencies         |
| ---------------------------- | ---------------------------------- | -------------------- |
| `BaseIndexedDBService.ts`    | Abstract CRUD for IndexedDB        | idb library          |
| `photoStorageService.ts`     | Photo blob storage, pagination     | BaseIndexedDBService |
| `customMessageService.ts`    | User-created messages CRUD         | BaseIndexedDBService |
| `moodService.ts`             | Local mood persistence             | BaseIndexedDBService |
| `imageCompressionService.ts` | Canvas-based image optimization    | Browser Canvas API   |
| `syncService.ts`             | Offline queue, conflict resolution | All API services     |
| `realtimeService.ts`         | Supabase subscriptions             | supabaseClient       |
| `migrationService.ts`        | Schema version upgrades            | IndexedDB            |
| `performanceMonitor.ts`      | Runtime metrics collection         | Performance API      |
| `storage.ts`                 | Generic IndexedDB operations       | idb library          |

## State Management Architecture

### Zustand Store Composition

```typescript
// src/stores/useAppStore.ts
const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createSettingsSlice(...args), // User preferences
      ...createMessagesSlice(...args), // Message state
      ...createPhotosSlice(...args), // Photo gallery
      ...createMoodSlice(...args), // Mood tracking
      ...createPartnerSlice(...args), // Partner connection
      ...createInteractionsSlice(...args), // Poke/Kiss
      ...createNavigationSlice(...args), // App navigation
    }),
    { name: 'my-love-storage' }
  )
);
```

### Slice Action Count

| Slice               | Actions | Key Responsibilities                     |
| ------------------- | ------- | ---------------------------------------- |
| `settingsSlice`     | 12      | Theme, display name, anniversaries, auth |
| `messagesSlice`     | 11      | Favorites, history, custom messages      |
| `photosSlice`       | 9       | CRUD, pagination, selection              |
| `moodSlice`         | 10      | Mood entry, history, multi-select        |
| `partnerSlice`      | 8       | Pairing, sync status                     |
| `interactionsSlice` | 5       | Poke/Kiss sending, receiving             |
| `navigationSlice`   | 4       | Active view, back navigation             |
| **Total**           | **59**  | Full feature coverage                    |

## API Layer Architecture

### Supabase Integration Points

```
src/api/
├── supabaseClient.ts          # SDK initialization
│   └── Creates singleton client with env vars
│
├── authService.ts             # Authentication
│   ├── signIn(email, password)
│   ├── signUp(email, password)
│   ├── signOut()
│   └── getCurrentUser()
│
├── partnerService.ts          # Partner management
│   ├── createPairingCode()
│   ├── joinPartner(code)
│   └── getPartnerInfo()
│
├── moodApi.ts                 # Mood CRUD
│   ├── saveMoodEntry(entry)
│   ├── getMoodHistory(userId, range)
│   └── deleteMoodEntry(id)
│
├── moodSyncService.ts         # Real-time sync
│   ├── subscribeToPartnerMood(partnerId)
│   └── broadcastMoodChange(entry)
│
├── interactionService.ts      # Poke/Kiss
│   ├── sendInteraction(type, partnerId)
│   ├── getInteractionHistory()
│   └── markAsRead(id)
│
└── errorHandlers.ts           # Centralized errors
    ├── handleSupabaseError(error)
    └── retryWithBackoff(fn, attempts)
```

## Configuration Files

### Build & Tooling Configuration

| File                   | Purpose           | Key Settings                              |
| ---------------------- | ----------------- | ----------------------------------------- |
| `vite.config.ts`       | Build tool config | PWA plugin, React plugin, chunk splitting |
| `tsconfig.json`        | TypeScript config | Strict mode, path aliases                 |
| `tailwind.config.js`   | CSS framework     | Custom theme colors, animations           |
| `postcss.config.js`    | CSS processing    | Tailwind, autoprefixer                    |
| `eslint.config.js`     | Linting rules     | React hooks, TypeScript rules             |
| `vitest.config.ts`     | Unit testing      | Happy-DOM environment                     |
| `playwright.config.ts` | E2E testing       | Multi-browser, workers                    |

### Environment Configuration

```bash
# .env (gitignored)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env.test.example
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=test-key
```

## Testing Infrastructure

```
tests/
├── unit/                      # Vitest unit tests
│   ├── stores/               # Zustand slice tests
│   ├── services/             # Service layer tests
│   └── utils/                # Utility function tests
│
├── integration/               # Component integration tests
│   └── components/           # React Testing Library
│
└── e2e/                       # Playwright E2E tests
    ├── auth.spec.ts          # Authentication flows
    ├── mood-tracking.spec.ts # Mood feature tests
    ├── offline-cache-strategy.spec.ts
    └── photo-gallery.spec.ts
```

## Database Schema (Supabase)

```
supabase/
└── migrations/
    ├── 20241115_initial_schema.sql
    ├── 20241115_mood_tracking.sql
    ├── 20241115_partner_pairing.sql
    └── 20241115_interactions.sql
```

### Key Tables

- `profiles` - User profile data
- `partnerships` - Partner pairing relationships
- `mood_entries` - Mood tracking records
- `interactions` - Poke/Kiss history
- `custom_messages` - User-created messages (future)

## Critical File Locations Summary

### Must-Know Files for Development

| Category       | Files                                 | Purpose                 |
| -------------- | ------------------------------------- | ----------------------- |
| **Entry**      | `main.tsx`, `App.tsx`                 | Application bootstrap   |
| **State**      | `useAppStore.ts`, `slices/*`          | Global state management |
| **Types**      | `types/index.ts`, `database.types.ts` | Type definitions        |
| **API**        | `supabaseClient.ts`, `*Service.ts`    | Backend communication   |
| **Storage**    | `BaseIndexedDBService.ts`             | Local persistence       |
| **Config**     | `constants.ts`, `themes.ts`           | App configuration       |
| **Validation** | `validation/schemas.ts`               | Input validation        |

### Hot Paths (Most Frequently Modified)

1. `src/components/` - UI changes
2. `src/stores/slices/` - State logic changes
3. `src/api/` - Backend integration
4. `src/types/index.ts` - Type additions
5. `src/services/` - Business logic

## Architecture Patterns Summary

### Pattern Usage

| Pattern                | Implementation                          | Location               |
| ---------------------- | --------------------------------------- | ---------------------- |
| **Composition**        | Store slices composed into single store | `useAppStore.ts`       |
| **Feature Folders**    | Components grouped by feature           | `src/components/`      |
| **Service Layer**      | Business logic separated from UI        | `src/services/`        |
| **Repository Pattern** | Data access abstraction                 | `BaseIndexedDBService` |
| **Validation Layer**   | Centralized input validation            | `src/validation/`      |
| **Error Boundaries**   | Graceful error handling                 | `ErrorBoundary.tsx`    |
| **Lazy Loading**       | Code splitting with React.lazy          | `App.tsx`              |

---

**Generated by BMAD document-project workflow**
**Scan Level**: Exhaustive (all 90 source files analyzed)
