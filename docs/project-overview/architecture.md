# Architecture

## High-Level Data Flow

```
User (Browser)
  |
  v
React 19 UI Components (lazy-loaded routes via React.lazy)
  |
  v
Zustand Store (10 slices, persisted to localStorage via zustand/persist)
  |
  +----> IndexedDB (via idb library)        [Primary local storage, offline-first]
  |         |
  |         +---> Background Sync (Service Worker sw.ts)
  |                  |
  v                  v
Supabase Cloud Services
  +-- Auth       (email/password + Google OAuth, 2-user partner model)
  +-- Postgres   (users, moods, interactions, photos, scripture_*, love_note_images)
  +-- Realtime   (mood sync, partner interactions, love notes, scripture broadcast/presence)
  +-- Storage    (photos, love note images)
```

## Offline-First Strategy

The application follows an offline-first architecture. The UI reads and writes to IndexedDB as the primary data store. Supabase is the sync and sharing layer, not the source of truth for local user data.

**IndexedDB** (via `idb` library): Primary local storage with a versioned schema defined in `src/services/dbSchema.ts` (currently v5 with 8 object stores). All service classes extend `BaseIndexedDBService` for CRUD operations. New entries are created with `synced: false` and `supabaseId: null`.

**Supabase**: Cloud backend responsible for cross-device sync, partner features (realtime mood, love notes, interactions), and long-term data persistence. The client singleton lives in `src/api/supabaseClient.ts`.

**Sync triggers**: Three mechanisms keep local and cloud data in sync:

1. Immediate sync on entry creation
2. Periodic sync every 5 minutes while the app is open
3. Background Sync API via the service worker when the app is closed

Partial failure handling ensures that entries that fail to sync are retried on the next sync pass.

### Scripture Reading Exception: Online-First

The scripture feature inverts the offline-first pattern:

1. **Supabase is the source of truth.** Writes go to Supabase RPC functions first and throw on failure (no offline queue).
2. **IndexedDB is a read cache.** Reads use cache-first with fire-and-forget background refresh.
3. **Optimistic UI.** The Zustand slice updates state before server confirmation, with `pendingRetry` state for user-triggered retry on failure.

**Architectural guardrail:** ESLint enforces that scripture container components (`src/components/scripture-reading/containers/**`) must not import `@supabase/supabase-js`, `src/api/supabaseClient`, or service modules directly. They must go through Zustand slice actions. The sole legacy exception is `scriptureReadingService`.

## State Management: Zustand Sliced Store

A single Zustand store (`src/stores/useAppStore.ts`) is composed from 10 slices using the slice pattern:

| Slice                   | Responsibility                              |
| ----------------------- | ------------------------------------------- |
| `appSlice`              | App initialization, loading states          |
| `settingsSlice`         | Theme selection, relationship configuration |
| `navigationSlice`       | Current view routing (no router library)    |
| `messagesSlice`         | Daily love messages, favorites management   |
| `moodSlice`             | Mood tracking, partner mood sync            |
| `interactionsSlice`     | Poke/kiss partner interactions              |
| `partnerSlice`          | Partner data, display name resolution       |
| `notesSlice`            | Love notes chat messages                    |
| `photosSlice`           | Photo gallery state                         |
| `scriptureReadingSlice` | Scripture reading session management        |

State is persisted to `localStorage` via `zustand/persist`. The store uses custom serialization for `Map` objects in `messageHistory.shownMessages`. The `partialize` option restricts what is persisted: settings, onboarding state, messageHistory, and moods. Large data (messages, photos, custom messages) is stored in IndexedDB.

**Architectural guardrail:** ESLint rules enforce that React components and hooks (`src/components/**`, `src/hooks/**`) must not call `useAppStore.getState()` directly. They must use `useAppStore` with a `useShallow` selector.

## Routing

No router library is used. Navigation is managed by the `navigationSlice` in the Zustand store. `App.tsx` renders views conditionally based on the `currentView` state value.

Supported views and their URL paths:

- `home` -- `/`
- `photos` -- `/photos`
- `mood` -- `/mood`
- `partner` -- `/partner`
- `notes` -- `/notes`
- `scripture` -- `/scripture`

`setView(view, skipHistory?)` updates both the Zustand state and the browser URL via `history.pushState`. A `popstate` event listener supports browser back/forward navigation. The `getRoutePath()` helper strips the production base path (`/My-Love/`) to normalize route detection.

## Authentication

Email/password and Google OAuth authentication via Supabase Auth. The app expects exactly 2 users linked via `partner_id` in the `users` table. Partner detection is automatic -- the app identifies the other user in the database as the partner.

Auth flow in `App.tsx`:

1. `getSession()` checks for existing auth on mount
2. `onAuthStateChange()` listens for auth state changes (also stores auth tokens in IndexedDB for service worker background sync)
3. If no session: render `LoginScreen`
4. If session but no display name (OAuth signup): render `DisplayNameSetup`
5. If authenticated: initialize app and render main content
6. Sentry user context is set with user ID and partner ID (UUIDs only, no PII)

Auth services are split into two modules:

- `src/api/auth/actionService.ts` -- signIn, signUp, signOut, resetPassword, signInWithGoogle
- `src/api/auth/sessionService.ts` -- getSession, getUser, getCurrentUserId, onAuthStateChange

## Code Splitting

Route components are lazy-loaded via `React.lazy()` in `App.tsx`:

| Component           | Lazy-Loaded | Notes                                               |
| ------------------- | ----------- | --------------------------------------------------- |
| Home view content   | No          | Rendered inline for guaranteed offline availability |
| `PhotoGallery`      | Yes         | Photo grid with lazy loading                        |
| `MoodTracker`       | Yes         | Mood logging UI                                     |
| `PartnerMoodView`   | Yes         | Partner mood real-time display                      |
| `LoveNotes`         | Yes         | Real-time chat                                      |
| `ScriptureOverview` | Yes         | Scripture reading entry point                       |
| `WelcomeSplash`     | Yes         | Welcome splash screen (modal)                       |
| `PhotoUpload`       | Yes         | Photo upload dialog (modal)                         |
| `PhotoCarousel`     | Yes         | Photo carousel viewer (modal)                       |
| `AdminPanel`        | Yes         | Admin interface (accessed via `/admin` route)       |

All lazy-loaded components are wrapped in `<Suspense>` with a spinner fallback and `<ErrorBoundary>` or `<ViewErrorBoundary>` for error containment.

## Service Worker (`src/sw.ts`)

Uses the InjectManifest strategy (not GenerateSW). The custom service worker handles:

- **Precaching**: Static assets only (images, fonts via `**/*.{png,jpg,jpeg,svg,woff2,ico}`) -- JS and CSS are excluded from precache and handled by runtime caching
- **Background Sync**: Mood entries via direct IndexedDB reads and Supabase REST API calls
- **Cache strategies**: NetworkOnly for JS/CSS, NetworkFirst for navigation, CacheFirst for images/fonts/Google Fonts
- **Database operations**: Isolated in `src/sw-db.ts` (separate from app IndexedDB code)
- **Sync notification**: Posts `BACKGROUND_SYNC_COMPLETED` message to the main thread with `successCount` and `failCount` for toast notification

The `src/sw-types.d.ts` file provides TypeScript declarations for the service worker context.

Service worker registration in `src/main.tsx`:

- **Production**: `registerSW` with `immediate: true` and auto-reload on `onNeedRefresh`
- **Development**: Unregisters all existing service workers to prevent stale code issues

## Realtime Features

Supabase Realtime is used for three distinct purposes:

1. **Mood changes** (`RealtimeService` in `src/services/realtimeService.ts`) -- Subscribes to `postgres_changes` on the `moods` table filtered by partner user ID. Singleton pattern.
2. **Scripture broadcast** (`useScriptureBroadcast` hook) -- Private broadcast channel `scripture-session:{sessionId}` for partner_joined, state_updated, session_converted, and lock_in_status_changed events. Includes retry logic for CHANNEL_ERROR/CLOSED with exponential re-subscribe.
3. **Scripture presence** (`useScripturePresence` hook) -- Ephemeral broadcast channel `scripture-presence:{sessionId}` for partner position tracking (verse/response view, step index). 10-second heartbeat, 20-second stale TTL.

## Validation

Zod schemas provide runtime validation at two layers:

1. **Client-side** (`src/validation/schemas.ts`) -- Validates form inputs, IndexedDB data, and scripture session/reflection/bookmark/message structures
2. **API response** (`src/api/validation/supabaseSchemas.ts`) -- Validates Supabase query responses for users, moods, interactions, photos, and couple stats

User-facing error messages are in `src/validation/errorMessages.ts`.

## Environment Variables and Secrets

Uses [fnox](https://fnox.jdx.dev) with the age encryption provider for local secrets management. Encrypted ciphertext is stored inline in `fnox.toml` (committed to git). Decryption uses age keys stored at `~/.age/key.txt`. Tool versions are managed by [mise](https://mise.jdx.dev) via `.mise.toml`.

Key variables:

- `VITE_SUPABASE_URL` -- Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` -- Supabase anon/public key
- `VITE_SENTRY_DSN` -- Sentry error tracking DSN
- `SENTRY_AUTH_TOKEN` -- Sentry source map upload token

For E2E tests, `.env.test` provides plain-text local Supabase values (`http://127.0.0.1:54321`). The Playwright config auto-detects local Supabase credentials via `supabase status -o env` and re-signs JWT tokens for ES256 compatibility.

## Base Path

Production builds use `/My-Love/` as the base path for GitHub Pages deployment. Development uses `/`. This is configured in `vite.config.ts`:

```typescript
base: mode === 'production' ? '/My-Love/' : '/',
```

The `index.html` file includes a SPA redirect handler that converts GitHub Pages 404 responses into proper client-side routes.

## Database Schema

Supabase Postgres with 21 migration files (4,289 total lines of SQL) in `supabase/migrations/`. Postgres major version: 17. Tables include:

- `users` -- App users with `partner_id` for partner linking
- `moods` -- Mood tracking entries with emoji, multi-mood support, and optional notes
- `interactions` -- Poke/kiss interactions between partners
- `photos` -- Photo gallery entries with captions
- `love_note_images` -- Images attached to love notes
- `scripture_sessions` -- Scripture reading session state and progress (solo/together modes)
- `scripture_reflections` -- Per-step and end-of-session reflections
- `scripture_bookmarks` -- Bookmarked verses within sessions
- `scripture_messages` -- Together-mode session messages

All tables have Row Level Security (RLS) enabled. TypeScript types are auto-generated from the schema via `supabase gen types typescript --local > src/types/database.types.ts`.

14 pgTAP database test files in `supabase/tests/database/` covering schema, RLS policies, RPCs, reflections, bookmarks, sessions, messages, couple stats, lobby, lock-in, and session end.

Local Supabase configuration is in `supabase/config.toml` with:

- API port: 54321
- DB port: 54322
- Postgres major version: 17
- Realtime enabled
- Auth: email/password with signup enabled

## Key Architectural Decisions

1. **No router library.** Navigation is simple enough (6 views + admin) that a Zustand slice with `history.pushState` suffices. This avoids a dependency and keeps the bundle small.

2. **Offline-first by default.** IndexedDB is the primary store for user-generated content. This ensures the app works without network connectivity.

3. **Scripture is the exception.** Because scripture reading is a shared/synchronized experience, it uses online-first with optimistic UI rather than offline-first.

4. **Single Zustand store with slices.** Rather than multiple independent stores, a single store composed via the slice pattern enables cross-slice coordination while keeping code organized by domain.

5. **InjectManifest over GenerateSW.** The custom service worker gives full control over caching strategies and background sync logic, which is necessary for the offline mood sync feature.

6. **fnox/age for secrets.** Secrets are encrypted with age and stored inline in `fnox.toml` (committed to git). This works across Mac, WSL, SSH, and CI without macOS Keychain dependency.

7. **Base path handling.** Production uses `/My-Love/` base path for GitHub Pages. Development uses `/`. This is configured in `vite.config.ts` and handled in `App.tsx` route detection.

8. **ESLint as architectural guardrail.** ESLint rules enforce domain boundaries: scripture containers cannot import Supabase directly, React code cannot call `getState()`, and submission controls must include `disabled` props.

9. **Catch blocks must never be empty.** In scripture code, catch blocks must call `handleScriptureError()` or re-throw. Outside scripture code, catch blocks must re-throw or map to the feature's error handler.

10. **Sentry for error tracking.** Sentry is initialized in production only with PII stripping. Chunk load failures, network errors, and ResizeObserver noise are filtered out.
