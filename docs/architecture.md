# Architecture Reference - My Love PWA

## Executive Summary

My Love is a Progressive Web App for couples, built as a single-page application with an offline-first architecture. The app provides daily love messages, mood tracking, photo sharing, real-time messaging (Love Notes), partner interactions (poke/kiss/fart), and a guided scripture reading experience. It targets exactly two authenticated users (a couple) and enforces data isolation through Supabase Row Level Security.

The system is designed around a dual-persistence model: Supabase (PostgreSQL) serves as the remote source of truth, while IndexedDB provides local offline storage. A service worker with Background Sync API support ensures data reaches the server even when the app is closed.

---

## Technology Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React | 19.x | UI framework with lazy loading via `React.lazy` + `Suspense` |
| **Language** | TypeScript | 5.9.x | Strict mode, no `any` types allowed |
| **Build** | Vite | 7.x | Development server, production builds, HMR |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS framework |
| **Animations** | Framer Motion | 12.x | Declarative animation library |
| **State** | Zustand | 5.x | Client-side state management (10 slices, persist middleware) |
| **Backend** | Supabase | 2.90.x | PostgreSQL, Auth, Realtime, Storage, RPC functions |
| **Local DB** | idb (IndexedDB) | 8.x | Offline persistence with typed schemas |
| **Validation** | Zod | 4.x | Runtime data validation at service boundaries |
| **PWA** | vite-plugin-pwa | 1.x | Service worker generation + Web App Manifest |
| **Icons** | Lucide React | 0.562.x | Tree-shakeable icon library |
| **Sanitization** | DOMPurify | 3.x | XSS prevention for user-generated content |
| **Virtualization** | react-window | 2.x | Windowed list rendering for large datasets |
| **Unit Tests** | Vitest | 4.x | Unit and integration testing with happy-dom |
| **E2E Tests** | Playwright | 1.57.x | End-to-end browser testing (Chromium) |
| **Linting** | ESLint | 9.x | Code quality enforcement |
| **Formatting** | Prettier | 3.x | Automated code formatting |
| **Env Encryption** | dotenvx | 1.x | Encrypted environment variable management |
| **Bundle Analysis** | rollup-plugin-visualizer | 6.x | Build output visualization |
| **Package Manager** | npm | - | Determined by `package-lock.json` |

---

## Architecture Pattern

**Component-based SPA with Offline-First Dual-Persistence Data Layer**

The application follows a five-layer architecture where data flows downward through well-defined boundaries:

```
+-------------------------------------------------------------+
|  VIEW LAYER          React Components (24 feature folders)   |
|                      Lazy-loaded routes via React.lazy       |
+-------------------------------------------------------------+
        |  props / hooks                    ^ callbacks / events
        v                                   |
+-------------------------------------------------------------+
|  STATE LAYER         Zustand Store (10 slices)               |
|                      persist middleware -> localStorage       |
|                      Custom hooks for derived state           |
+-------------------------------------------------------------+
        |  action calls                     ^ state updates
        v                                   |
+-------------------------------------------------------------+
|  SERVICE LAYER       Domain services (14 service files)      |
|                      BaseIndexedDBService (abstract CRUD)    |
|                      Zod validation at boundaries            |
+-------------------------------------------------------------+
        |  typed API calls                  ^ validated responses
        v                                   |
+-------------------------------------------------------------+
|  API LAYER           Supabase client (7 API files)           |
|                      Typed queries via database.types.ts     |
|                      Realtime subscriptions                  |
+-------------------------------------------------------------+
        |  HTTP / WebSocket                 ^ JSON responses
        v                                   |
+-------------------------------------------------------------+
|  STORAGE LAYER       Supabase (remote PostgreSQL + RLS)      |
|                      IndexedDB (local, 8 object stores)      |
|                      localStorage (Zustand hydration only)   |
+-------------------------------------------------------------+
        |  Background Sync                  ^ sync events
        v                                   |
+-------------------------------------------------------------+
|  BACKGROUND LAYER    Service Worker (sw.ts)                  |
|                      Workbox strategies (precache + runtime) |
|                      Background Sync API for offline writes  |
+-------------------------------------------------------------+
```

### Key Architectural Decisions

1. **No client-side router.** Navigation is managed by a Zustand `navigationSlice` that updates `currentView` state and manipulates `history.pushState` manually. This avoids a router dependency and keeps offline navigation simple.

2. **Dual persistence.** Small, critical state (settings, message history, mood list) persists to localStorage via Zustand's `persist` middleware for fast hydration. Large or binary data (photos, custom messages, scripture sessions) persists to IndexedDB via typed service classes.

3. **Singleton services.** Each IndexedDB-backed service extends `BaseIndexedDBService<T>` and is exported as a module-level singleton. This ensures a single database connection per store and prevents concurrent initialization.

4. **Typed Supabase client.** The `database.types.ts` file is auto-generated from Supabase schema introspection, providing compile-time type safety for all database queries.

---

## Source Directory Structure

```
src/
  api/                          # Supabase API layer (7 files)
    authService.ts              # Authentication (login, signup, session management)
    errorHandlers.ts            # Centralized API error handling
    interactionService.ts       # Poke/kiss/fart partner interactions
    moodApi.ts                  # Mood CRUD against Supabase
    moodSyncService.ts          # Bidirectional mood sync (local <-> remote)
    partnerService.ts           # Partner lookup and relationship queries
    supabaseClient.ts           # Singleton Supabase client with typed schema
    validation/
      supabaseSchemas.ts        # Zod schemas for Supabase response validation

  components/                   # React UI components (24 feature folders)
    AdminPanel/                 # Custom message CRUD admin interface
    CountdownTimer/             # Generic countdown display
    DailyMessage/               # Home view daily love message
    DisplayNameSetup/           # Post-auth display name form
    ErrorBoundary/              # Top-level error boundary
    InteractionHistory/         # Poke/kiss/fart history log
    LoginScreen/                # Email/password authentication
    MoodHistory/                # Calendar-based mood history
    MoodTracker/                # Mood selection and logging
    Navigation/                 # Bottom tab navigation bar
    PartnerMoodView/            # Partner mood display + interactions
    PhotoCarousel/              # Full-screen photo viewer
    PhotoDeleteConfirmation/    # Photo deletion dialog
    PhotoEditModal/             # Photo caption/tag editing
    PhotoGallery/               # Photo grid with lazy loading
    PhotoUpload/                # Photo upload with compression
    PokeKissInterface/          # Partner interaction buttons
    RelationshipTimers/         # Time together, birthday, event countdowns
    Settings/                   # App settings and preferences
    ViewErrorBoundary/          # Per-view error boundary (keeps nav visible)
    WelcomeButton/              # Manual welcome splash trigger
    WelcomeSplash/              # Timed welcome greeting screen
    love-notes/                 # Real-time messaging UI
    photos/                     # Photo uploader component
    scripture-reading/          # Scripture reading feature
      containers/               #   ScriptureOverview, SoloReadingFlow
      reading/                  #   BookmarkFlag
      reflection/               #   PerStepReflection, ReflectionSummary
    shared/                     # NetworkStatusIndicator, SyncToast

  config/                       # App configuration constants
    animations.ts               # Framer Motion animation presets
    constants.ts                # App-wide constants (user IDs, limits)
    images.ts                   # Image configuration
    performance.ts              # Performance thresholds and validation limits
    relationshipDates.ts        # Birthdays, wedding, visit dates

  constants/                    # Additional animation constants
    animations.ts

  data/                         # Static data
    defaultMessages.ts          # Built-in love messages by category
    scriptureSteps.ts           # Scripture reading step content

  hooks/                        # Custom React hooks (12 files)
    useAuth.ts                  # Authentication state hook
    useAutoSave.ts              # Debounced auto-save for forms
    useImageCompression.ts      # Image compression pipeline hook
    useLoveNotes.ts             # Love notes messaging state
    useMoodHistory.ts           # Mood history with calendar grouping
    useMotionConfig.ts          # Reduced motion preferences
    useNetworkStatus.ts         # Online/offline detection
    usePartnerMood.ts           # Partner mood realtime subscription
    usePhotos.ts                # Photo gallery state management
    useRealtimeMessages.ts      # Love notes realtime subscription
    useVibration.ts             # Haptic feedback hook

  services/                     # Business logic services (14 files)
    BaseIndexedDBService.ts     # Abstract generic CRUD for IndexedDB
    customMessageService.ts     # Custom message management
    dbSchema.ts                 # Shared IndexedDB schema (v1-v5 migrations)
    imageCompressionService.ts  # Canvas-based image compression
    loveNoteImageService.ts     # Love note image upload/download
    migrationService.ts         # LocalStorage -> IndexedDB migration
    moodService.ts              # Mood persistence (IndexedDB)
    performanceMonitor.ts       # Runtime performance tracking
    photoService.ts             # Photo business logic
    photoStorageService.ts      # Photo IndexedDB persistence
    realtimeService.ts          # Supabase Realtime channel management
    scriptureReadingService.ts  # Scripture session management
    storage.ts                  # Legacy storage utilities
    syncService.ts              # Generic sync orchestration

  stores/                       # Zustand state management
    useAppStore.ts              # Root store with persist middleware
    types.ts                    # AppState composition type
    slices/                     # 10 state slices
      appSlice.ts               #   Loading, error, hydration state
      interactionsSlice.ts      #   Partner interaction counts
      messagesSlice.ts          #   Daily message CRUD and rotation
      moodSlice.ts              #   Mood tracking and sync
      navigationSlice.ts        #   View routing state
      notesSlice.ts             #   Love notes messaging state
      partnerSlice.ts           #   Partner mood state
      photosSlice.ts            #   Photo gallery state
      scriptureReadingSlice.ts  #   Scripture session state
      settingsSlice.ts          #   User preferences

  types/                        # TypeScript type definitions
    database.types.ts           # Auto-generated Supabase schema types
    index.ts                    # Core app domain types
    models.ts                   # Additional model types

  utils/                        # Utility functions
    backgroundSync.ts           # Background Sync API helpers
    calendarHelpers.ts          # Calendar date utilities
    countdownService.ts         # Countdown calculation logic
    dateFormat.ts               # Date formatting utilities
    dateFormatters.ts           # Additional date formatters
    dateHelpers.ts              # Date helper functions
    haptics.ts                  # Haptic feedback API wrappers
    interactionValidation.ts    # Interaction input validation
    messageRotation.ts          # Daily message rotation algorithm
    messageValidation.ts        # Message input validation
    moodEmojis.ts               # Mood type -> emoji mapping
    moodGrouping.ts             # Mood grouping by date
    offlineErrorHandler.ts      # Offline-specific error handling
    performanceMonitoring.ts    # Performance metric utilities
    storageMonitor.ts           # Storage quota monitoring
    themes.ts                   # Theme application logic

  validation/                   # Zod validation schemas
    errorMessages.ts            # User-facing validation messages
    index.ts                    # Barrel export
    schemas.ts                  # All domain validation schemas

  sw.ts                         # Custom Service Worker (Workbox + Background Sync)
  sw-db.ts                      # IndexedDB access from Service Worker context
  sw-types.d.ts                 # Service Worker type declarations
  main.tsx                      # Application entry point
  App.tsx                       # Root component with auth + routing
```

---

## Data Architecture

### Supabase Tables (PostgreSQL with Row Level Security)

All tables enforce RLS policies that restrict access to the two partner users only.

| Table | Purpose | Key Columns | Relationships |
|---|---|---|---|
| `users` | User profiles | `id`, `email`, `display_name`, `partner_id`, `partner_name`, `device_id` | Self-referential (`partner_id` -> `users.id`) |
| `partner_requests` | Partner pairing workflow | `id`, `from_user_id`, `to_user_id`, `status` | FK to `users` (both directions) |
| `moods` | Daily mood entries | `id`, `user_id`, `mood_type`, `mood_types[]`, `note`, `created_at` | FK to `users` |
| `interactions` | Partner interactions | `id`, `from_user_id`, `to_user_id`, `type`, `viewed` | FK to `users` (both directions) |
| `love_notes` | Real-time chat messages | `id`, `from_user_id`, `to_user_id`, `content`, `image_url` | - |
| `photos` | Photo metadata | `id`, `user_id`, `filename`, `storage_path`, `caption`, `width`, `height`, `file_size`, `mime_type` | - |
| `scripture_sessions` | Reading session state | `id`, `mode`, `user1_id`, `user2_id`, `current_phase`, `current_step_index`, `status`, `version`, `snapshot_json` | - |
| `scripture_reflections` | Per-step reflection data | `id`, `session_id`, `step_index`, `user_id`, `rating` (1-5), `notes`, `is_shared` | FK to `scripture_sessions` |
| `scripture_bookmarks` | Step bookmarks | `id`, `session_id`, `step_index`, `user_id`, `share_with_partner` | FK to `scripture_sessions` |
| `scripture_messages` | Daily prayer report messages | `id`, `session_id`, `sender_id`, `message` | FK to `scripture_sessions` |
| `scripture_step_states` | Step advancement tracking | `id`, `session_id`, `step_index`, `user1_locked_at`, `user2_locked_at`, `advanced_at` | FK to `scripture_sessions` |

**Supabase RPC Functions:**
- `scripture_create_session(p_mode, p_partner_id?)` - Create a new scripture reading session
- `accept_partner_request(p_request_id)` - Accept a partner pairing request
- `decline_partner_request(p_request_id)` - Decline a partner pairing request
- `is_scripture_session_member(p_session_id)` - Check session membership for RLS
- `scripture_seed_test_data(...)` - Test data seeding (development only)

**Supabase Enums:**
- `scripture_session_mode`: `solo`, `together`
- `scripture_session_phase`: `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete`
- `scripture_session_status`: `pending`, `in_progress`, `complete`, `abandoned`

### IndexedDB Schema (Local Storage)

Database: `my-love-db`, current version: **5**

| Store | Key Type | Value Type | Indexes | Purpose |
|---|---|---|---|---|
| `messages` | auto-increment `number` | `Message` | `by-category` (string), `by-date` (Date) | Custom and default love messages |
| `photos` | auto-increment `number` | `Photo` (includes Blob) | `by-date` (Date) | Photo binary data + metadata |
| `moods` | auto-increment `number` | `MoodEntry` | `by-date` (string, unique) | Mood entries with sync status |
| `sw-auth` | `'current'` literal | `StoredAuthToken` | None | Auth token for Service Worker Background Sync |
| `scripture-sessions` | UUID `string` | `ScriptureSession` | `by-user` (string) | Offline scripture session cache |
| `scripture-reflections` | UUID `string` | `ScriptureReflection` | `by-session` (string) | Offline reflection cache |
| `scripture-bookmarks` | UUID `string` | `ScriptureBookmark` | `by-session` (string) | Offline bookmark cache |
| `scripture-messages` | UUID `string` | `ScriptureMessage` | `by-session` (string) | Offline message cache |

**Migration History:**
- v1: `messages` store
- v2: `photos` store (enhanced schema with compression metadata, replaces v1 photos)
- v3: `moods` store with unique `by-date` index
- v4: `sw-auth` store for Service Worker Background Sync
- v5: Scripture reading stores (`sessions`, `reflections`, `bookmarks`, `messages`)

All migrations are handled in `dbSchema.ts` via a centralized `upgradeDb()` function.

### localStorage (Zustand Hydration)

Key: `my-love-storage`

Only small, critical state is persisted to localStorage via Zustand's `persist` middleware:

- `settings` - Theme, notifications, relationship configuration
- `isOnboarded` - First-run flag
- `messageHistory` - Date-to-message-ID mapping (Map serialized as Array)
- `moods` - Mood entries (duplicated here for fast hydration, synced from IndexedDB)

**Not persisted to localStorage** (loaded from IndexedDB on init):
- `messages` - Full message list
- `customMessages` - User-created messages
- `photos` - Photo data (too large)

---

## State Management

### Zustand Store Architecture

The root store (`useAppStore`) composes 10 slices using Zustand's slice pattern. Each slice is a pure function that receives `(set, get, api)` and returns its state shape and actions.

```
useAppStore (persist middleware -> localStorage)
  |
  +-- appSlice           Loading states, error state, hydration flag
  +-- navigationSlice    currentView, setView (with history.pushState)
  +-- messagesSlice      Daily messages CRUD, rotation, favorites
  +-- moodSlice          Mood tracking, pending sync queue, Supabase sync
  +-- interactionsSlice  Partner interaction counts (poke, kiss, fart)
  +-- photosSlice        Photo gallery state, selection, carousel
  +-- notesSlice         Love notes messaging state
  +-- partnerSlice       Partner mood realtime state
  +-- settingsSlice      User preferences, theme, relationship dates
  +-- scriptureReadingSlice  Scripture session state, phase management
```

**Type composition** (`stores/types.ts`):
```typescript
interface AppState extends
  AppSlice,
  MessagesSlice,
  PhotosSlice,
  SettingsSlice,
  NavigationSlice,
  MoodSlice,
  InteractionsSlice,
  PartnerSlice,
  NotesSlice,
  ScriptureSlice {}
```

**Hydration flow:**
1. Zustand persist reads from localStorage
2. Custom `getItem` validates JSON structure before hydration
3. `onRehydrateStorage` deserializes `shownMessages` (Array -> Map)
4. If validation fails, corrupted state is cleared and defaults are used
5. `__isHydrated` flag is set after successful hydration

### Custom Hooks

Hooks bridge the gap between Zustand store state and component-specific derived state:

| Hook | Purpose | Data Source |
|---|---|---|
| `useAuth` | Authentication state and actions | `authService` |
| `useAutoSave` | Debounced form auto-save | Component state |
| `useImageCompression` | Image compression pipeline | `imageCompressionService` |
| `useLoveNotes` | Love notes with realtime updates | Zustand + `realtimeService` |
| `useMoodHistory` | Calendar-grouped mood history | Zustand + `moodApi` |
| `useMotionConfig` | Reduced motion preferences | `prefers-reduced-motion` media query |
| `useNetworkStatus` | Online/offline status | `navigator.onLine` + events |
| `usePartnerMood` | Partner mood realtime subscription | `realtimeService` |
| `usePhotos` | Photo gallery operations | Zustand + `photoService` |
| `useRealtimeMessages` | Love notes realtime channel | `supabase.channel()` |
| `useVibration` | Haptic feedback | Vibration API |

---

## Component Hierarchy

```
App (root: auth gate + view router)
  |
  +-- [Auth Loading] -> heart pulse + "Loading..."
  |
  +-- [No Session] -> ErrorBoundary > LoginScreen
  |
  +-- [Needs Display Name] -> ErrorBoundary > DisplayNameSetup
  |
  +-- [App Loading] -> heart pulse + "Loading your data..."
  |
  +-- [Welcome Splash] -> ErrorBoundary > Suspense > WelcomeSplash
  |
  +-- [Admin Route] -> ErrorBoundary > Suspense > AdminPanel
  |
  +-- [Main App]
        |
        +-- NetworkStatusIndicator (offline/connecting banner)
        +-- SyncToast (background sync completion feedback)
        |
        +-- <main>
        |     |
        |     +-- [home] TimeTogether, BirthdayCountdown(s),
        |     |          EventCountdown(s), DailyMessage
        |     |
        |     +-- [non-home] ViewErrorBoundary > Suspense
        |           +-- [photos]    PhotoGallery (lazy)
        |           +-- [mood]      MoodTracker (lazy)
        |           +-- [partner]   PartnerMoodView (lazy)
        |           +-- [notes]     LoveNotes (lazy)
        |           +-- [scripture] ScriptureOverview (lazy)
        |                             +-> SoloReadingFlow
        |                                   +-> BookmarkFlag
        |                                   +-> PerStepReflection
        |                                   +-> ReflectionSummary
        |
        +-- BottomNavigation (tab bar, always visible)
        +-- PhotoUpload (modal, lazy)
        +-- PhotoCarousel (modal, lazy)
```

**Code Splitting Strategy:**

All non-home views and modal components are lazy-loaded via `React.lazy()` with `Suspense` fallback. The home view (`DailyMessage`, `RelationshipTimers`) is bundled in the main chunk for instant first paint.

Manual chunks in `vite.config.ts`:
- `vendor-react`: react, react-dom
- `vendor-supabase`: @supabase/supabase-js
- `vendor-state`: zustand, idb, zod
- `vendor-animation`: framer-motion
- `vendor-icons`: lucide-react

---

## Authentication Flow

```
1. App mounts
   |
   +-> authService.getSession()
   |     |
   |     +-> [session exists] -> check display_name
   |     |     |
   |     |     +-> [has display_name] -> initializeApp() -> Main App
   |     |     +-> [no display_name] -> DisplayNameSetup form
   |     |
   |     +-> [no session] -> LoginScreen
   |           |
   |           +-> email/password login
   |           +-> authService.onAuthStateChange() fires
   |           +-> session established -> re-check display_name
   |
2. Auth state listener runs for entire app lifetime
   |
   +-> onAuthStateChange(session)
         +-> [session] check user_metadata.display_name
         +-> [no session] show LoginScreen
```

Supabase handles session persistence, auto-refresh of JWT tokens, and OAuth callback detection. The `sw-auth` IndexedDB store caches the access token for Service Worker Background Sync access.

---

## Navigation System

The app uses a custom navigation system without a client-side router library.

**Views:** `home`, `photos`, `mood`, `partner`, `notes`, `scripture`

**URL mapping:**
| View | Path |
|---|---|
| `home` | `/` |
| `photos` | `/photos` |
| `mood` | `/mood` |
| `partner` | `/partner` |
| `notes` | `/notes` |
| `scripture` | `/scripture` |

**Implementation:**
- `navigationSlice.setView(view)` updates Zustand state and calls `history.pushState()`
- `popstate` event listener syncs browser back/forward to Zustand state
- `BottomNavigation` component renders tab buttons bound to `setView()`
- Production paths are prefixed with `/My-Love/` (GitHub Pages base path)
- Admin route (`/admin`) is detected separately and renders `AdminPanel`

---

## Real-time Features

All real-time functionality uses Supabase Realtime (WebSocket-based Postgres Changes).

| Feature | Channel Pattern | Table | Events | Callback |
|---|---|---|---|---|
| Partner Mood | `moods:{userId}` | `moods` | INSERT, UPDATE, DELETE | Updates partner mood display |
| Love Notes | Custom channel | `love_notes` | INSERT | Appends new messages to chat |
| Interactions | Subscription in hook | `interactions` | INSERT | Shows poke/kiss/fart notification |

**RealtimeService** (`services/realtimeService.ts`) manages channel lifecycle:
- Tracks active channels in a `Map<string, RealtimeChannel>`
- Prevents duplicate subscriptions
- Provides `unsubscribeAll()` for cleanup
- Error handling with local and global callbacks
- Rate limited to 10 events per second via Supabase client config

---

## Offline Strategy

The app implements a hybrid sync solution with three complementary mechanisms:

### 1. Service Worker (sw.ts)

Uses Workbox with an `injectManifest` strategy for full control over caching behavior:

| Request Type | Strategy | Cache Name | Details |
|---|---|---|---|
| JS/CSS | `NetworkOnly` | - | Always fetch fresh code after deployments |
| Navigation (HTML) | `NetworkFirst` | `navigation-cache` | 3s timeout, falls back to precached version |
| Images/Fonts | `CacheFirst` | `static-assets-v2` | 30-day expiration, 100 entry limit |
| Google Fonts | `CacheFirst` | `google-fonts-v2` | 1-year expiration, 30 entry limit |
| Static assets | Precache | Workbox default | `*.{png,jpg,jpeg,svg,woff2,ico}` only |

**Background Sync API:**
- Tag: `sync-pending-moods`
- Triggers when browser regains connectivity (even if app is closed)
- Opens IndexedDB directly (no window context needed)
- Reads pending moods, reads stored auth token, calls Supabase REST API via `fetch`
- Marks moods as synced on success
- Notifies open clients via `postMessage` with success/fail counts

### 2. IndexedDB Persistence

All data services extend `BaseIndexedDBService<T>` which provides:
- Automatic init guard (prevents concurrent initialization)
- Generic CRUD: `add()`, `get()`, `getAll()`, `update()`, `delete()`, `clear()`
- Cursor-based pagination: `getPage(offset, limit)` for efficient large-dataset access
- Error handling strategy: reads return `null`/`[]` on failure (graceful degradation), writes throw (data integrity)
- Quota monitoring with warnings at 80% and errors at 95%

### 3. App-Level Sync (App.tsx)

Three sync mechanisms run in the main thread:

| Mechanism | Trigger | Frequency |
|---|---|---|
| Immediate sync | `online` event fires | On each reconnection |
| Periodic sync | `setInterval` | Every 5 minutes while app is open |
| Mount sync | App component mounts | Once on app load (if online + authenticated) |

### Conflict Resolution

Last-write-wins with server-side timestamps. The `synced` boolean and `supabaseId` fields on `MoodEntry` track local vs. remote state. When a mood is synced, the local record is updated with the Supabase-generated UUID.

### Optimistic UI

UI updates are applied immediately to local state (Zustand + IndexedDB). Sync to Supabase happens asynchronously in the background. If sync fails, the data remains in the local pending queue and will retry.

---

## Security

| Layer | Mechanism | Implementation |
|---|---|---|
| **Data Access** | Supabase Row Level Security | All tables enforce that only the two partner users can access each other's data |
| **Authentication** | Supabase Auth | Email/password with JWT tokens, auto-refresh, session persistence |
| **XSS Prevention** | DOMPurify | Sanitizes all user-generated content before DOM insertion |
| **Input Validation** | Zod schemas | Runtime validation at all service boundaries before IndexedDB writes and API calls |
| **Secret Management** | dotenvx | Environment variables encrypted at rest, committed to repo safely |
| **Client Security** | No secrets in client code | All API access through Supabase client SDK with anon key (RLS enforces authorization) |
| **Content Security** | Validation limits | Max message length, max photo dimensions, max note length enforced via Zod |

---

## Validation Architecture

Zod schemas are defined in `validation/schemas.ts` and applied at service boundaries:

```
User Input -> Zod Schema Validation -> Service Layer -> IndexedDB/Supabase
                                                           |
Supabase Response -> Zod Schema Validation -> Service Layer -> Zustand State
```

**Domain schemas:**
- `MessageSchema`, `CreateMessageInputSchema`, `UpdateMessageInputSchema`
- `PhotoSchema`, `PhotoUploadInputSchema`
- `MoodEntrySchema` (supports single mood and multi-mood array)
- `SettingsSchema` (nested: relationship, customization, notifications)
- `CustomMessagesExportSchema` (import/export format)
- `SupabaseSessionSchema`, `SupabaseReflectionSchema`, `SupabaseBookmarkSchema`, `SupabaseMessageSchema`

Each schema validates against configured limits from `config/performance.ts` (message text max length, etc.).

---

## Deployment

| Aspect | Technology | Details |
|---|---|---|
| **Hosting** | GitHub Pages | Static file serving from `dist/` directory |
| **CI/CD** | GitHub Actions | Automated build, test, deploy pipeline |
| **Build** | Vite + tsc | `dotenvx run -- bash -c 'tsc -b && vite build'` |
| **Base Path** | `/My-Love/` | Production builds use repository name as subpath |
| **Backend** | Supabase (hosted) | Managed PostgreSQL, Auth, Realtime, Storage |
| **Pre-deploy** | Smoke tests | `node scripts/smoke-tests.cjs` validates build output |
| **Post-deploy** | Health check | `node scripts/post-deploy-check.cjs [URL]` |
| **Deploy command** | gh-pages | `gh-pages -d dist` publishes to `gh-pages` branch |

---

## Testing Strategy

### Unit and Integration Tests (Vitest)

- **Runner:** Vitest with happy-dom environment
- **Coverage threshold:** 80%
- **Coverage tool:** @vitest/coverage-v8
- **Test libraries:** @testing-library/react, @testing-library/user-event, @testing-library/jest-dom
- **IndexedDB mocking:** fake-indexeddb
- **TDD enforcement:** tdd-guard-vitest

**Test categories:**
- Component tests (rendering, user interaction)
- Hook tests (state management, side effects)
- Service tests (IndexedDB operations, business logic)
- Store slice tests (Zustand state transitions)
- API layer tests (Supabase query validation)
- Utility function tests (pure logic)

### End-to-End Tests (Playwright)

- **Browser:** Chromium
- **Backend:** Real Supabase instance (test environment)
- **Utilities:** @seontechnologies/playwright-utils
- **Scripts:** `test-with-cleanup.sh` wraps test execution with environment cleanup

### ATDD (Acceptance-Test-Driven Development)

Applied for Epic 2 (scripture reading feature):
1. Acceptance criteria defined per story
2. Tests written before implementation
3. Test review workflow with rubric scoring (determinism, isolation, maintainability, coverage, performance)

### Test Execution Commands

```bash
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode
npm run test:unit:coverage     # With coverage report
npm run test:e2e               # Run E2E tests (with cleanup)
npm run test:e2e:ui            # Playwright UI mode
npm run test:e2e:debug         # Debug mode
npm run test:smoke             # Build output validation
npm run test:burn-in           # Reliability burn-in test
npm run test:ci-local          # Full CI pipeline locally
```

---

## Performance Optimizations

| Optimization | Implementation | Impact |
|---|---|---|
| **Code splitting** | `React.lazy()` for all non-home views | Reduces initial bundle size |
| **Manual chunks** | Vite `manualChunks` config | Vendor libraries cached independently |
| **Cursor pagination** | `BaseIndexedDBService.getPage()` | O(offset+limit) vs. O(n) for large datasets |
| **List virtualization** | react-window | Only visible list items are rendered |
| **Image compression** | Canvas-based resize + quality reduction | Max 2048x2048, 80% quality, WebP output |
| **Deferred initialization** | `requestIdleCallback` / `setTimeout` | Migration runs after first paint |
| **Lazy modals** | PhotoUpload, PhotoCarousel lazy-loaded | Not included in main bundle |
| **Service Worker caching** | CacheFirst for static assets | Instant load for images/fonts |
| **Zustand partial persist** | Only small state to localStorage | Fast hydration, large data in IndexedDB |
| **Bundle visualization** | rollup-plugin-visualizer | `dist/stats.html` for analysis |
| **Reduced motion** | `useMotionConfig` hook | Respects OS accessibility settings |

---

## Error Handling Strategy

### View-Level Error Boundaries

Two-tier error boundary architecture:
1. **`ErrorBoundary`** (top-level) - Catches catastrophic errors, shows full-page fallback
2. **`ViewErrorBoundary`** (per-view) - Catches view-specific errors while keeping `BottomNavigation` visible, allowing users to navigate away from broken views

### Service Layer Error Handling

`BaseIndexedDBService` implements a split error strategy:
- **Read operations** (`get`, `getAll`, `getPage`): Return `null` or `[]` on failure. Rationale: graceful degradation, app continues with empty state.
- **Write operations** (`add`, `update`, `delete`, `clear`): Throw on failure. Rationale: data integrity, callers must handle failures explicitly.

### Network Error Handling

- `NetworkStatusIndicator` shows a banner when offline
- `SyncToast` shows sync completion feedback after Background Sync
- `offlineErrorHandler.ts` provides offline-specific error messages
- API errors are caught in `api/errorHandlers.ts` with user-friendly messages

### State Corruption Recovery

Zustand's `onRehydrateStorage` callback validates state on load:
1. Validates JSON parse success
2. Validates critical fields (`themeName`, `shownMessages` type)
3. On corruption: clears localStorage, logs error, falls back to defaults
4. Map deserialization (Array -> Map) with structure validation

---

## Scalability Considerations

### Current Design (2-User Scope)

The app is designed for exactly two users (a couple). This simplifies several architectural decisions:

- **RLS policies** assume a partner pair, not arbitrary user groups
- **Realtime subscriptions** filter by single partner user ID
- **IndexedDB** stores all data locally (no multi-tenant concerns)
- **Background Sync** syncs all pending items without user-scoping conflicts

### Growth Path (If Needed)

If the app were to support multiple couples or group features:

| Concern | Current | Growth Path |
|---|---|---|
| **Data isolation** | RLS with partner_id lookup | Introduce `couple_id` grouping table |
| **Realtime** | Direct user ID filter | Channel per couple/group |
| **IndexedDB** | Single user's data | Prefix stores with user ID |
| **Auth** | Two hardcoded partner slots | Dynamic partner management |
| **Storage** | Local-first for all data | Selective sync with server pagination |

These changes are not currently needed and should only be pursued if the user base grows beyond the couple use case.
