# 01 -- Executive Summary

## Project Overview

**My Love** is a Progressive Web App (PWA) designed for couples to exchange daily love messages, track moods, share photos, chat via love notes, read scripture together, and send playful interactions (poke/kiss). It is deployed to GitHub Pages at `https://sallvainian.github.io/My-Love/`.

The application serves exactly two users (a couple) and is scoped for personal use rather than multi-tenant SaaS. This constraint simplifies the data model, reduces backend complexity, and allows aggressive caching strategies.

## Technical Stack at a Glance

| Layer            | Technology          | Version  | Role |
| ---------------- | ------------------- | -------- | ---- |
| UI Framework     | React               | 19.2.4   | Concurrent rendering, lazy loading, Suspense |
| Language         | TypeScript          | 5.9.3    | Strict mode, ES2022 target, bundler module resolution |
| Build Tool       | Vite                | 7.3.1    | Dev server, HMR, manual chunk splitting, PWA plugin |
| Styling          | Tailwind CSS        | 4.1.17   | v4 with PostCSS, Prettier class sorting |
| Animation        | Framer Motion       | 12.29.3  | Page transitions, micro-interactions, reduced-motion support |
| State Management | Zustand             | 5.0.11   | Single store, 10 slices, persist middleware |
| Backend / Auth   | Supabase            | 2.93.3   | Auth, Postgres, Storage, Realtime (Broadcast + postgres_changes) |
| Validation       | Zod                 | 4.3.6    | Runtime schema validation at all service boundaries |
| Local Storage    | IndexedDB via `idb` | 8.0.3    | 8 object stores, versioned migrations (v1-v5) |
| Icons            | Lucide React        | 0.563.0  | Tree-shakeable SVG icons |
| Virtualization   | react-window        | 2.2.6    | Windowed rendering for large lists |
| Sanitization     | DOMPurify           | 3.3.1    | XSS protection for user-generated content |
| Error Tracking   | Sentry              | 10.39.0  | Error reporting with PII stripping |

## Architecture Philosophy

The application follows a **hybrid data architecture** where the storage pattern varies by feature domain:

1. **Offline-first local data** -- IndexedDB is the primary data store for messages, moods, and photos stored locally. Supabase serves as the sync and sharing layer, not the source of truth for local user data. Writes go to IndexedDB first, then sync to Supabase asynchronously.

2. **Online-first collaborative features** -- Scripture reading sessions use Supabase as the source of truth with a cache-first read pattern (IndexedDB as cache) and write-through semantics. The Broadcast API coordinates real-time together-mode sessions.

3. **Supabase-direct features** -- Love notes chat, photo gallery (Supabase Storage), and poke/kiss interactions write directly to Supabase with optimistic UI updates and rollback on failure.

4. **Single Zustand store, sliced by domain** -- A single composable store (`useAppStore`) with 10 domain-specific slices, persisted selectively to localStorage via Zustand's `persist` middleware. Only settings, onboarding state, message history, and moods are persisted.

5. **Validation at every service boundary** -- Zod schemas validate data before IndexedDB writes, before Supabase API calls, and when parsing API responses. Two validation layers: `src/validation/` for local schemas and `src/api/validation/` for Supabase response schemas.

6. **Hybrid sync strategy** -- Three sync triggers for mood data:
   - **Immediate**: On mood creation (if online)
   - **Periodic**: Every 5 minutes while the app is open (`setInterval` in `App.tsx`)
   - **Background Sync API**: Via service worker when the app is closed and connectivity returns

7. **PWA-first** -- Custom InjectManifest service worker with Workbox strategies: `NetworkOnly` for JS/CSS (always fresh code), `CacheFirst` for images/fonts, `NetworkFirst` for navigation. Background Sync for offline mood uploads.

## Feature Map

| Feature           | Data Pattern   | Primary Storage            | Sync Target       | Realtime Channel          |
| ----------------- | -------------- | -------------------------- | ------------------ | ------------------------- |
| Daily Messages    | Offline-first  | IndexedDB `messages` store | N/A (local only)  | None                      |
| Mood Tracking     | Offline-first  | IndexedDB `moods` store    | Supabase `moods`   | Broadcast API (partner)   |
| Photo Gallery     | Supabase-first | Supabase Storage `photos`  | N/A (direct)       | None                      |
| Love Notes Chat   | Supabase-first | Supabase `love_notes`      | N/A (direct)       | Broadcast API (partner)   |
| Scripture Reading | Online-first   | Supabase + IDB cache       | Supabase RPCs      | Broadcast + Presence      |
| Poke/Kiss         | Supabase-first | Supabase `interactions`    | N/A (direct)       | `postgres_changes` (INSERT) |
| Settings/Theme    | Local-only     | localStorage (persist)     | N/A                | None                      |
| Partner Management| Supabase-first | Supabase `users`/RPCs      | N/A (direct)       | None                      |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single Zustand store (not Redux) | Less boilerplate, native TypeScript generics, built-in persist middleware |
| IndexedDB over localStorage for large data | localStorage has 5-10MB limit; IndexedDB handles binary blobs (photos), structured data, and indexed queries |
| InjectManifest over GenerateSW | Full control over service worker: custom Background Sync, selective caching strategies, message handling |
| Zod v4 (not v3) | Better TypeScript inference, smaller bundle, `z.coerce` for date parsing |
| Supabase Broadcast (not postgres_changes for chat) | Broadcast is ephemeral and lower-latency; no persistent subscription cost for transient messages |
| react-window (not react-virtuoso) | Lighter weight, sufficient for simple list virtualization |
| Manual chunk splitting | Predictable cache keys for vendor libraries; avoids cache-busting on app code changes |

## Deployment

The app builds via `tsc -b && vite build` and deploys to GitHub Pages using `gh-pages -d dist`. The production base path is `/My-Love/` (configured in `vite.config.ts`). Environment variables are managed by dotenvx (encrypted `.env` committed to git; `.env.keys` decryption file is gitignored and backed up to dotenvx-ops cloud).

## Entry Point Flow

```
index.html
  -> src/main.tsx
       -> Sentry.init() (production only)
       -> React.StrictMode > LazyMotion > App
            -> App.tsx (625 lines)
                 -> Auth check (getSession + onAuthStateChange)
                 -> initializeApp() via settingsSlice
                 -> View routing (home, photos, mood, partner, notes, scripture)
                 -> Lazy-loaded components via React.lazy + Suspense
                 -> Network status listeners (online/offline)
                 -> Periodic sync interval (5 min)
                 -> Service worker background sync listener
```

## Related Documentation

- [Technology Stack](./02-technology-stack.md) -- Full dependency table with rationale
- [Architecture Patterns](./03-architecture-patterns.md) -- Eight architectural patterns in detail
- [Data Architecture](./04-data-architecture.md) -- IndexedDB schema, Supabase tables, migration history
- [State Management Overview](./05-state-management-overview.md) -- Zustand store composition
- [State Management Deep-Dive](../state-management/index.md) -- Slice details, persistence, hooks
