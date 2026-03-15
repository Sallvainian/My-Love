# API Reference

Complete reference for the My Love PWA service layer, API clients, validation schemas, and utility modules.

## Scope

This section covers all files in:

- `src/api/` -- Supabase client, auth, mood API, interactions, partner service, realtime
- `src/services/` -- IndexedDB CRUD, photo storage, scripture reading, sync, performance
- `src/validation/` -- Zod schemas for runtime validation at service boundaries
- `src/utils/` -- Logger, background sync, offline handling, date/message utilities
- `src/sw.ts` / `src/sw-db.ts` -- Service worker with Workbox caching and Background Sync

## Architecture Overview

The service layer follows an **online-first** architecture:

1. **Supabase Client** (`supabaseClient.ts`) -- singleton typed client for all remote operations
2. **API Layer** (`moodApi.ts`, `interactionService.ts`, `partnerService.ts`) -- validated Supabase queries
3. **Sync Services** (`moodSyncService.ts`, `syncService.ts`) -- IndexedDB-to-Supabase synchronization
4. **IndexedDB Services** (`BaseIndexedDBService.ts` + concrete services) -- local-first CRUD with `idb` library
5. **Validation** (`validation/schemas.ts`, `api/validation/supabaseSchemas.ts`) -- Zod v4 schemas at every boundary
6. **Service Worker** (`sw.ts`) -- Workbox caching strategies + Background Sync API for offline mood uploads

## Error Handling Philosophy

- **Read operations**: Return `null` or empty arrays on error (graceful degradation)
- **Write operations**: Throw errors (data integrity must be explicit)
- **Network errors**: Detected via `navigator.onLine`, wrapped in `SupabaseServiceError` or `OfflineError`
- **Validation errors**: Zod errors transformed to user-friendly `ValidationError` with field-specific messages

## Quick Navigation

See [table-of-contents.md](./table-of-contents.md) for the full document listing.

---

*Generated: 2026-03-15 | Source: exhaustive scan of 207 source files, 24 SQL migrations*
