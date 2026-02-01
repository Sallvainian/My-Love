# Architecture

> System architecture and design patterns for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Executive Summary

My-Love is an offline-first Progressive Web App built as a client-side SPA with React 19, Zustand state management, and Supabase as the backend-as-a-service. The architecture prioritizes offline operation through IndexedDB caching, three-layer sync, and a Service Worker with Workbox strategies. All data access is validated with Zod schemas at service boundaries.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser/PWA)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │    React      │  │   Zustand    │  │  Service Worker   │ │
│  │  Components   │──│    Store     │──│  (Workbox/PWA)    │ │
│  │  (30+ TSX)    │  │  (10 slices) │  │                   │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘ │
│         │                 │                    │            │
│  ┌──────┴─────────────────┴────────────────────┘           │
│  │              Custom Hooks (12)                           │
│  └──────────────────┬──────────────────────────┘           │
│                     │                                       │
│  ┌──────────────────┴──────────────────────────┐           │
│  │           Services Layer (14 files)          │           │
│  │  ┌────────────┐  ┌────────────┐  ┌────────┐ │           │
│  │  │ IndexedDB  │  │   Sync     │  │Realtime│ │           │
│  │  │  Services  │  │ Services   │  │Service │ │           │
│  │  └─────┬──────┘  └─────┬──────┘  └───┬────┘ │           │
│  └────────┼───────────────┼──────────────┼─────┘           │
│           │               │              │                  │
├───────────┼───────────────┼──────────────┼──────────────────┤
│           ▼               ▼              ▼                  │
│  ┌─────────────┐  ┌──────────────────────────────────┐     │
│  │  IndexedDB  │  │       API Layer (7 files)         │     │
│  │  (8 stores) │  │  Auth · Mood · Partner · Interact │     │
│  └─────────────┘  │        + Zod Validation           │     │
│                   └──────────────┬────────────────────┘     │
└──────────────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase (BaaS)                         │
│  ┌────────┐  ┌─────────────┐  ┌─────────┐  ┌────────────┐  │
│  │  Auth  │  │ PostgreSQL  │  │ Storage │  │  Realtime   │  │
│  │ (JWT)  │  │ (11 tables) │  │(Buckets)│  │ (Broadcast) │  │
│  └────────┘  └─────────────┘  └─────────┘  └────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Edge Functions (1: image upload)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Pattern

**Component-Based Layered Architecture** (Client-Side SPA)

| Layer | Responsibility | Key Files |
|-------|---------------|-----------|
| **Presentation** | React components, Framer Motion animations | `src/components/` (26 folders) |
| **State** | Zustand store with 10 composed slices | `src/stores/` |
| **Hooks** | React bridges between state and UI | `src/hooks/` (12 hooks) |
| **Service** | Business logic, caching, sync | `src/services/` (14 services) |
| **API** | Supabase client, error handling, validation | `src/api/` (7 files) |
| **Backend** | PostgreSQL, Auth, Storage, Edge Functions | `supabase/` |

## Data Architecture

### Storage Layers

| Layer | Technology | Purpose | Sync |
|-------|-----------|---------|------|
| **Client State** | Zustand + LocalStorage | UI state, settings, message history | Persist middleware |
| **Local Cache** | IndexedDB (8 stores, v5) | Offline data, photo cache, scripture | Service layer |
| **Cloud Database** | Supabase PostgreSQL (11 tables) | Source of truth | Three-layer sync |
| **File Storage** | Supabase Storage (2 buckets) | Photos, love note images | On-demand |

### Offline-First Strategy

```
Layer 1: Immediate Sync (App Online)
  Create/update → API call → mark synced on success

Layer 2: Periodic Sync (App Open)
  Every 30s → syncService.syncPendingMoods() → partial failure handling

Layer 3: Background Sync (App Closed)
  Service Worker → connectivity restored → IndexedDB → Supabase REST → notify app
```

### Data Flow

```
READ:  Supabase → Service (Zod validate + snake→camel transform) → IndexedDB cache → Zustand → UI
WRITE: UI → Zustand action → Service → Supabase RPC/query
         → success: update IndexedDB + store
         → failure: queue for sync retry
```

## State Management

### Zustand Store Composition

10 slices composed into single `useAppStore`:

| Slice | Persisted | Source of Truth |
|-------|-----------|----------------|
| AppSlice | No | Runtime |
| MessagesSlice | LocalStorage + IndexedDB | IndexedDB |
| PhotosSlice | No | Supabase Storage |
| SettingsSlice | LocalStorage | Local |
| NavigationSlice | No | URL |
| MoodSlice | LocalStorage + IndexedDB | Supabase (synced) |
| InteractionsSlice | No | Supabase |
| PartnerSlice | No | Supabase |
| NotesSlice | No | Supabase |
| ScriptureSlice | No | Supabase (cached) |

### Initialization Sequence

```
Store Creation → Persist middleware → localStorage load
  → Pre-hydration validation → onRehydrateStorage
    → Map deserialization → __isHydrated = true
      → App Mount → initializeApp() → IndexedDB → seed messages
```

## API Design

### Service Layer Pattern

```typescript
BaseIndexedDBService<T> (abstract)
├── CustomMessageService   (messages store)
├── MoodService            (moods store)
├── PhotoStorageService    (photos store)
└── ScriptureReadingService (scripture-sessions store)
```

All domain services extend `BaseIndexedDBService` which provides generic CRUD. Services are singletons exported at module level.

### Validation Pattern

Zod v4 schemas validate at every boundary:
- **Input**: User data validated before writes
- **Output**: Supabase responses validated before cache
- **Transform**: `snake_case` (Supabase) ↔ `camelCase` (local)

### Error Handling

| Context | Strategy |
|---------|----------|
| Reads | Graceful fallback (null/empty array) |
| Writes | Explicit failure (throw) |
| Validation | Zod parse → user-friendly message |
| Cache corruption | Clear store → refetch from server |
| Sync failures | Continue on individual failures, return summary |

## Security Architecture

### Authentication

- **Provider**: Supabase Auth (email/password + Google OAuth)
- **Token**: JWT stored in client, auto-refreshed
- **SW Access**: Auth token stored in IndexedDB `sw-auth` store for Background Sync
- **Session**: Managed by Supabase client with `onAuthStateChange` listener

### Row Level Security (RLS)

All 11 Supabase tables enforce RLS via `auth.uid()`:
- Users see own data + partner's data (where applicable)
- Partner linking is atomic via RPC (`accept_partner_request`)
- No admin bypass patterns — all access through RLS

### Edge Function Security

Image upload Edge Function validates:
1. JWT authentication
2. Rate limiting (10/min/user, in-memory)
3. File size (max 5MB compressed)
4. MIME type via magic bytes (JPEG, PNG, WebP, GIF)

## Component Architecture

### Routing

URL-based routing via `window.history.pushState` (no React Router):
- 6 views: home, mood, notes, partner, photos, scripture
- Bottom navigation with 7 tabs (including logout)
- Code-split views via `React.lazy()` + `Suspense`

### Error Boundaries

Two-level error boundary strategy:
1. **Global** (`ErrorBoundary`): Full-screen fallback, storage clear option
2. **Per-View** (`ViewErrorBoundary`): Inline fallback, keeps nav visible, resets on view change

### Animation System

Framer Motion with `prefers-reduced-motion` support via `useMotionConfig()` hook:
- Tab transitions (opacity + slide)
- Card swipe (drag with threshold)
- Modal reveal (AnimatePresence)
- Staggered list items
- Duration set to 0 when reduced motion preferred

## Real-Time Architecture

### Channels

| Feature | Channel | Protocol |
|---------|---------|----------|
| Mood updates | `moods:{userId}` | postgres_changes (INSERT/UPDATE/DELETE) |
| Love notes | `love-notes:{userId}` | Broadcast API |
| Interactions | `interactions` | postgres_changes (INSERT) |

### Resilience

- Deduplication via Map for subscriptions
- Exponential backoff (max 5 retries, up to 30s) for love notes
- Auto-cleanup on unmount
- Vibration feedback on incoming messages

## PWA Architecture

### Service Worker (Workbox)

| Resource | Strategy | TTL |
|----------|----------|-----|
| JS/CSS | NetworkOnly | Fresh on deploy |
| HTML | NetworkFirst | 3s timeout, offline fallback |
| Images | CacheFirst | 30-day expiry |
| Google Fonts | CacheFirst | 1-year expiry |

### Background Sync

Service Worker opens IndexedDB directly (no window context), reads auth token from `sw-auth` store, syncs pending moods to Supabase REST API, notifies app via `postMessage`.

## Deployment Architecture

```
Push to main → GitHub Actions
├── Stage 1: Lint + Type Check (5 min)
├── Stage 2: Unit Tests — Vitest (10 min)
├── Stage 3: E2E Tests — Playwright (15 min)
└── Stage 4: Deploy
    ├── Generate Supabase types
    ├── Build (dotenvx → tsc → vite build)
    ├── Smoke tests
    ├── Deploy to GitHub Pages
    └── Health checks (HTTP + Supabase)
```

**Production URL**: `https://sallvainian.github.io/My-Love/`

## Testing Architecture

| Level | Tool | Coverage | Focus |
|-------|------|----------|-------|
| Unit | Vitest 4.0 + happy-dom | 80% thresholds | Services, utils, hooks |
| Component | Testing Library + React | Part of unit | Component rendering, user events |
| E2E | Playwright 1.57 | Smoke + critical paths | Full user flows |
| TDD Guard | tdd-guard-vitest | Enforced | Red-green discipline |

### Test Infrastructure

- `fake-indexeddb` for offline storage mocking
- `window.__APP_STORE__` exposed for E2E state assertions
- `data-testid="{feature}-{element}"` convention
- Burn-in loop script for stability validation

## Performance Optimizations

| Optimization | Implementation |
|-------------|---------------|
| Code splitting | `React.lazy()` for views, modals, admin panel |
| Memoization | `React.memo`, `useCallback`, `useMemo` for positions |
| Image compression | 80% JPEG via Canvas API on upload |
| State efficiency | Zustand `useShallow` for selectors |
| Pagination | Cursor-based, 20/page default, Intersection Observer |
| Bundle analysis | `rollup-plugin-visualizer` |

## Key Design Decisions

1. **Client-side SPA over SSR**: Simplicity for a couple's personal app; GitHub Pages hosting
2. **Zustand over Redux**: Less boilerplate, better TypeScript, no providers
3. **IndexedDB over localStorage for data**: Structured data with indexes, larger quota
4. **Supabase over custom backend**: Auth, RLS, Storage, Realtime out-of-box
5. **Zod at boundaries**: Runtime validation catches schema drift
6. **Three-layer sync**: Ensures no data loss across app states
7. **Feature-folder components**: Co-located tests, self-contained features
8. **No React Router**: Simple URL-based routing sufficient for 6 views
