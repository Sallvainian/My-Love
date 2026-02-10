# Architecture

## High-Level Data Flow

```
User (Browser)
  |
  v
React 19 UI Components
  |
  v
Zustand Store (10 slices, persisted to localStorage)
  |
  +----> IndexedDB (via idb library)        [Primary local storage, offline-first]
  |         |
  |         +---> Background Sync (Service Worker sw.ts)
  |                  |
  v                  v
Supabase Cloud Services
  +-- Auth       (email/password, 2-user partner model)
  +-- Postgres   (users, moods, interactions, photos, scripture_*, love_note_images)
  +-- Realtime   (mood sync, partner interactions, love notes)
  +-- Storage    (photos, love note images)
```

## Offline-First Strategy

The application follows an offline-first architecture. The UI reads and writes to IndexedDB as the primary data store. Supabase is the sync and sharing layer, not the source of truth for local user data.

**IndexedDB** (via `idb` library): Primary local storage with a versioned schema defined in `src/services/dbSchema.ts` (currently v5). All service classes extend `BaseIndexedDBService` for CRUD operations. New entries are created with `synced: false` and `supabaseId: null`.

**Supabase**: Cloud backend responsible for cross-device sync, partner features (realtime mood, love notes, interactions), and long-term data persistence. The client singleton lives in `src/api/supabaseClient.ts`.

**Sync triggers**: Three mechanisms keep local and cloud data in sync:
1. Immediate sync on entry creation
2. Periodic sync while the app is open
3. Background Sync API via the service worker when the app is closed

Partial failure handling ensures that entries that fail to sync are retried on the next sync pass.

## State Management: Zustand Sliced Store

A single Zustand store (`src/stores/useAppStore.ts`) is composed from 10 slices using the slice pattern:

| Slice | Responsibility |
|---|---|
| `appSlice` | App initialization, loading states |
| `settingsSlice` | Theme selection, relationship configuration |
| `navigationSlice` | Current view routing (no router library) |
| `messagesSlice` | Daily love messages, favorites management |
| `moodSlice` | Mood tracking, partner mood sync |
| `interactionsSlice` | Poke/kiss/fart partner interactions |
| `partnerSlice` | Partner data, display name resolution |
| `notesSlice` | Love notes chat messages |
| `photosSlice` | Photo gallery state |
| `scriptureReadingSlice` | Scripture reading session management |

State is persisted to `localStorage` via `zustand/persist`. The store uses custom serialization for `Map` objects in `messageHistory.shownMessages`.

## Routing

No router library is used. Navigation is managed by the `navigationSlice` in the Zustand store. `App.tsx` renders views conditionally based on the `currentView` state value.

## Authentication

Email/password authentication via Supabase Auth. The app expects exactly 2 users linked via `partner_id` in the `users` table. Partner detection is automatic -- the app identifies the other user in the database as the partner.

## Service Worker (`src/sw.ts`)

Uses the InjectManifest strategy (not GenerateSW). The custom service worker handles:

- **Precaching**: Static assets only (images, fonts via `**/*.{png,jpg,jpeg,svg,woff2,ico}`) -- JS and CSS are excluded from precache and handled by runtime caching
- **Background Sync**: Mood entries via direct IndexedDB reads and Supabase REST API calls
- **Cache strategies**: NetworkFirst for navigation and API calls, CacheFirst for images and fonts
- **Database operations**: Isolated in `src/sw-db.ts` (separate from app IndexedDB code)

The `src/sw-types.d.ts` file provides TypeScript declarations for the service worker context.

## Validation

Zod schemas are defined in `src/validation/schemas.ts` with user-facing error messages in `src/validation/errorMessages.ts`. These validate form inputs and API response payloads at runtime.

## Environment Variables

Uses [dotenvx](https://dotenvx.com) for encrypted `.env` files committed to git. The `.env.keys` file (gitignored) contains the decryption key.

Key variables:
- `VITE_SUPABASE_URL` -- Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` -- Supabase anon/public key

For E2E tests, `.env.test` provides plain-text local Supabase values (`http://127.0.0.1:54321`). The Playwright config auto-detects local Supabase credentials via `supabase status -o env`.

## Base Path

Production builds use `/My-Love/` as the base path for GitHub Pages deployment. Development uses `/`. This is configured in `vite.config.ts`:

```typescript
base: mode === 'production' ? '/My-Love/' : '/',
```

## Database Schema

Supabase Postgres with 12 migration files in `supabase/migrations/`. Postgres major version: 17. Tables include:

- `users` -- App users with `partner_id` for partner linking
- `moods` -- Mood tracking entries with emoji and optional notes
- `interactions` -- Poke/kiss/fart interactions between partners
- `photos` -- Photo gallery entries with captions
- `love_note_images` -- Images attached to love notes
- `scripture_sessions` -- Scripture reading session state and progress
- `scripture_step_states` -- Per-step completion tracking
- `scripture_reflections` -- Per-step and end-of-session reflections
- `scripture_bookmarks` -- Bookmarked verses within sessions
- `scripture_messages` -- Together-mode session messages

All tables have Row Level Security (RLS) enabled. TypeScript types are auto-generated from the schema via `supabase gen types typescript --local > src/types/database.types.ts`.

Local Supabase configuration is in `supabase/config.toml` with:
- API port: 54321
- DB port: 54322
- Studio port: 54323
- Realtime enabled
- Storage file size limit: 50MiB
- Auth: email/password with signup enabled, email confirmation disabled for development
