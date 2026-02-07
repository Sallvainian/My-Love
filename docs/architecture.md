# Architecture

> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

---

## Executive Summary

My-Love is a Progressive Web Application (PWA) built as a monolith SPA for couples to share daily moments. Built with React 19, TypeScript, and Supabase as a Backend-as-a-Service, the app features offline-first data management with IndexedDB, real-time partner updates via Supabase Realtime, and a service worker for PWA capabilities.

---

## Architecture Type

- **Pattern:** Monolith SPA with layered architecture
- **Style:** Component-based with service layer separation
- **Data Flow:** Components --> Hooks --> Store (Zustand) --> Services --> API (Supabase)

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │
│  │   Feature    │ │   Shared    │ │   Navigation    │    │
│  │  Components  │ │  Components │ │  (BottomNav)    │    │
│  └──────┬───────┘ └──────┬──────┘ └────────┬────────┘    │
│         └────────────────┼─────────────────┘              │
│                          ▼                                 │
│  ┌──────────────────────────────────────────────────┐    │
│  │              CUSTOM HOOKS LAYER                   │    │
│  │  useAuth, useLoveNotes, useMoodHistory,          │    │
│  │  usePhotos, usePartnerMood, useNetworkStatus,    │    │
│  │  useRealtimeMessages, useAutoSave, etc.          │    │
│  └──────────────────────┬───────────────────────────┘    │
│                          ▼                                 │
├─────────────────────────────────────────────────────────┤
│                    STATE LAYER (Zustand)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  useAppStore (compose pattern, 10 slices)          │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐  │  │
│  │  │ auth │ │ mood │ │notes │ │photos│ │settings│  │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └────────┘  │  │
│  │  ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────┐       │  │
│  │  │  app │ │navigation│ │partner │ │ msgs │       │  │
│  │  └──────┘ └──────────┘ └────────┘ └──────┘       │  │
│  │  ┌──────────────┐ ┌─────────────────┐             │  │
│  │  │interactions  │ │scriptureReading │             │  │
│  │  └──────────────┘ └─────────────────┘             │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           ▼                                │
├─────────────────────────────────────────────────────────┤
│                   SERVICE LAYER                            │
│  ┌────────────────┐  ┌───────────────┐  ┌────────────┐  │
│  │ Business Logic │  │  Sync Layer   │  │  Realtime   │  │
│  │ moodService    │  │ syncService   │  │ realtime    │  │
│  │ photoService   │  │ moodSyncSvc   │  │ Service     │  │
│  │ messageService │  │ backgroundSync│  │             │  │
│  │ scriptureRdSvc │  │               │  │             │  │
│  └───────┬────────┘  └──────┬────────┘  └──────┬─────┘  │
│          │                  │                   │         │
│          ▼                  ▼                   ▼         │
├─────────────────────────────────────────────────────────┤
│                    DATA LAYER                              │
│  ┌──────────────────┐  ┌────────────────────────────┐    │
│  │    IndexedDB      │  │      Supabase (BaaS)       │    │
│  │  (idb v8, 8      │  │  ┌──────┐ ┌────────────┐   │    │
│  │   stores, v5     │◄─┤  │ Auth │ │  Database   │   │    │
│  │   schema)        │  │  │      │ │ (PostgreSQL)│   │    │
│  │  BaseIndexedDB   │──►│  └──────┘ └────────────┘   │    │
│  │  Service (CRUD)  │  │  ┌──────┐ ┌────────────┐   │    │
│  │                  │  │  │Store │ │  Realtime   │   │    │
│  │                  │  │  │(S3)  │ │(Broadcast+  │   │    │
│  │                  │  │  │      │ │ pg_changes) │   │    │
│  └──────────────────┘  │  └──────┘ └────────────┘   │    │
│                         │  ┌──────────────────────┐   │    │
│                         │  │    Edge Functions     │   │    │
│                         │  │  (image upload)       │   │    │
│                         │  └──────────────────────┘   │    │
│                         └────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                  SERVICE WORKER (PWA)                      │
│  ┌──────────────────────────────────────────────────┐    │
│  │  src/sw.ts — injectManifest strategy (Workbox)    │    │
│  │  Precache: static assets | Runtime: network-only  │    │
│  │  Background Sync API for offline operations       │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | 5.9.3 |
| UI Framework | React | 19.2.3 |
| Build Tool | Vite | 7.3.1 |
| State | Zustand | 5.0.10 |
| Backend | Supabase | 2.90.1 |
| Styling | Tailwind CSS | 4.1.17 |
| Animation | Framer Motion | 12.27.1 |
| Offline Storage | idb (IndexedDB) | 8.0.3 |
| Validation | Zod | 4.3.5 |
| PWA | vite-plugin-pwa | 1.2.0 |

---

## Data Architecture

### Three-Layer Data Model

1. **IndexedDB (Offline)** -- 8 stores across v5 schema via BaseIndexedDBService CRUD abstraction
2. **Sync Services** -- Orchestrate bidirectional sync between local and cloud
3. **Supabase (Cloud)** -- 11 PostgreSQL tables with RLS, 7 RPC functions, 2 storage buckets

### Database Tables

`users`, `user_settings`, `moods`, `interactions`, `love_notes`, `love_note_images`, `photos`, `custom_messages`, `scripture_reading_plans`, `scripture_reading_progress`, `scripture_reading_bookmarks`

### Key Patterns

- **Optimistic UI updates:** Write local first, sync to cloud in background
- **Conflict resolution:** Last-write-wins with timestamps
- **Background Sync API:** Deferred operations when offline, replayed on connectivity restore

---

## Authentication and Security

- **Email/password + Google OAuth** via Supabase Auth
- **Row Level Security (RLS)** on all 11 tables -- users see own data plus partner data where applicable
- **Signed URLs** for photo storage with time-limited access
- **DOMPurify** for XSS prevention in user-generated content
- **Zod validation** at all API boundaries for runtime type safety

---

## Real-Time Architecture

- **Supabase Broadcast:** Mood updates and love notes between partners
- **postgres_changes:** Interaction events (poke/kiss)
- **Pattern:** Subscribe on mount, update Zustand store, UI re-renders reactively

---

## Offline Strategy

- **Storage:** IndexedDB via idb library (8 stores)
- **Sync:** Background Sync API combined with manual sync triggers
- **Detection:** `useNetworkStatus` hook with online/offline events
- **UI Feedback:** NetworkStatusIndicator and SyncToast components
- **Service Worker:** injectManifest strategy with Workbox for full caching control

---

## Component Architecture

- **Organization:** Feature-based directory structure where each feature is self-contained
- **Pattern:** Container components consume hooks; presentational components receive props
- **Error Handling:** Two-level error boundaries -- global `ErrorBoundary` for full-screen fallback and `ViewErrorBoundary` for inline fallback that keeps navigation visible
- **Animation:** LazyMotion with domAnimation for code splitting, AnimatePresence for transitions
- **Theming:** 5 color palettes (Sunset, Coral, Ocean, Lavender, Rose) via Tailwind and CSS variables

---

## State Management Architecture

- **Library:** Zustand 5.0.10 with compose pattern
- **10 Slices:** app, auth, navigation, settings, partner, mood, interactions, messages, photos, notes, scriptureReading
- **Persistence:** localStorage via Zustand persist middleware with selective hydration
- **Pattern:** Slices defined as functions, composed into a single store via `useAppStore`

---

## Testing Architecture

- **Unit Tests:** Vitest + happy-dom + Testing Library (80% coverage threshold)
- **E2E Tests:** Playwright on Chromium (sharded in CI)
- **TDD Guard:** tdd-guard-vitest reporter enforces test-with-code pairing
- **Burn-In:** Flaky test detection via repeated execution
- **CI Pipeline:** Lint --> Unit --> E2E (sharded) --> Burn-in (PR to main only)

---

## Deployment Architecture

- **Hosting:** GitHub Pages (static SPA)
- **CI/CD:** GitHub Actions (5 workflows)
- **Build:** Vite with manual chunk splitting for optimal caching
- **Environment:** dotenvx encrypted variables
- **Post-Deploy:** Health checks covering HTTP responses, JS bundles, PWA manifest, and Supabase connection

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | Zustand (not Redux) | Minimal boilerplate, slice composition, no providers |
| Offline storage | IndexedDB via idb | Structured data, large capacity, async API |
| Backend | Supabase BaaS | Auth + DB + Storage + Realtime in one SDK |
| Validation | Zod 4 | TypeScript-first, composable schemas, small bundle |
| Animation | Framer Motion | Gesture support, layout animations, React 19 compatible |
| PWA strategy | injectManifest | Full control over service worker caching |
| Testing | Vitest + Playwright | Fast unit tests + reliable E2E |
| CSS | Tailwind 4 | Utility-first, zero runtime, PostCSS integration |
| Deployment | GitHub Pages | Free hosting, simple CI/CD |
| TDD enforcement | tdd-guard-vitest | CI fails if tests added without code changes |
