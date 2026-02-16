# Executive Summary

## Project Overview

**My Love** is a Progressive Web App (PWA) designed for couples to exchange daily love messages, track moods, share photos, chat via love notes, read scripture together, and send playful interactions. It is deployed to GitHub Pages at `https://sallvainian.github.io/My-Love/`.

## Technical Stack at a Glance

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.2.4 |
| Language | TypeScript | 5.9.3 |
| Build Tool | Vite | 7.3.1 |
| Styling | Tailwind CSS | 4.1.17 |
| Animation | Framer Motion | 12.29.3 |
| State Management | Zustand | 5.0.11 |
| Backend / Auth | Supabase | 2.93.3 |
| Validation | Zod | 4.3.6 |
| Local Storage | IndexedDB via `idb` | 8.0.3 |
| Icons | Lucide React | 0.563.0 |
| Virtualization | react-window | 2.2.6 |
| Sanitization | DOMPurify | 3.3.1 |

## Architecture Philosophy

The application follows an **offline-first architecture** for user-generated content (messages, moods, photos) and an **online-first architecture** for collaborative features (scripture reading). Key architectural principles include:

1. **Offline-first local data** -- IndexedDB is the primary data store. Supabase serves as the sync and sharing layer, not the source of truth for local user data.
2. **Online-first collaborative features** -- Scripture reading uses Supabase as the source of truth with optimistic UI and retry semantics.
3. **Single Zustand store, sliced by domain** -- A single composable store with 10 domain-specific slices, persisted selectively to localStorage.
4. **Validation at service boundaries** -- Zod schemas validate data before IndexedDB writes and before Supabase RPC calls.
5. **Hybrid sync strategy** -- Three sync triggers: immediate on creation, periodic 5-minute interval, and Background Sync API via service worker.
6. **PWA-first** -- Service worker with custom InjectManifest strategy, precaching, and background sync support.

## Feature Map

| Feature | Data Pattern | Storage | Realtime |
|---------|-------------|---------|----------|
| Daily Messages | Offline-first | IndexedDB + localStorage | None |
| Mood Tracking | Offline-first | IndexedDB -> Supabase | Broadcast API |
| Photo Gallery | Supabase-first | Supabase Storage | None |
| Love Notes Chat | Supabase-first | Supabase | Broadcast API |
| Scripture Reading | Online-first | Supabase (cache in IDB) | None |
| Poke/Kiss | Supabase-first | Supabase | Realtime subscription |
| Settings/Theme | Local-only | localStorage (via persist) | None |

## Deployment

The app builds via `dotenvx run -- bash -c 'tsc -b && vite build'` and deploys to GitHub Pages using `gh-pages`. The production base path is `/My-Love/`. Environment variables are encrypted with dotenvx and committed to git; the `.env.keys` decryption file is gitignored.

## Related Documentation

- [Technology Stack](./02-technology-stack.md)
- [Architecture Patterns](./03-architecture-patterns.md)
- [Data Architecture](./04-data-architecture.md)
- [State Management Overview](./05-state-management-overview.md)
