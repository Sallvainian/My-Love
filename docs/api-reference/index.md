# API Reference

Complete reference for the My Love PWA service layer, API clients, validation schemas, and utility modules.

> Last updated: 2026-07-25

## Scope

This section covers all files in:

- `src/api/` -- Supabase client, auth (facade + session/action split), mood API, interactions, partner service
- `src/services/` -- IndexedDB CRUD, photo storage, scripture reading, image compression, migration
- `src/validation/` -- Zod schemas for runtime validation before IndexedDB writes
- `src/api/validation/` -- Zod schemas for validating Supabase API responses
- `src/utils/` -- Logger, background sync, offline handling, date/message utilities
- `src/sw.ts` / `src/sw-db.ts` -- Service worker with Workbox caching and Background Sync

## Architecture Overview

The service layer is **offline-first for most features and online-first for Scripture Reading**:

1. **Supabase Client** (`supabaseClient.ts`) -- singleton typed client for all remote operations, plus `getPartnerId()` / `getPartnerDisplayName()` helpers
2. **API Layer** (`moodApi.ts`, `interactionService.ts`, `partnerService.ts`) -- validated Supabase queries
3. **Sync Service** (`moodSyncService.ts`) -- IndexedDB-to-Supabase synchronization with exponential-backoff retry
4. **IndexedDB Services** (`BaseIndexedDBService.ts` + concrete services) -- local-first CRUD with the `idb` library
5. **Validation** (`validation/schemas.ts`, `api/validation/supabaseSchemas.ts`) -- Zod v4 schemas at every boundary
6. **Service Worker** (`sw.ts`) -- Workbox caching strategies + Background Sync API for offline mood uploads

### Two data models

| Model             | Features                                               | Source of truth                                       |
| ----------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| **Offline-first** | Messages, moods, custom messages                       | IndexedDB primary; Supabase syncs upward              |
| **Online-first**  | Scripture Reading                                      | Supabase RPC authoritative; IndexedDB is a read cache |

Love Notes and Photos are **Supabase-direct**: they query and mutate Supabase without an IndexedDB mirror of the remote record.

## Error Handling Philosophy

- **Read operations**: Return `null` or empty arrays on error (graceful degradation)
- **Write operations**: Throw errors (data integrity must be explicit)
- **Network errors**: Detected via `navigator.onLine`, wrapped by `handleNetworkError()` into a `SupabaseServiceError`
- **Validation errors**: Zod errors transformed to user-friendly `ValidationError` with field-specific messages
- **Scripture errors**: Typed `ScriptureError` objects carrying a `ScriptureErrorCode`, routed through `handleScriptureError()`

> **Note:** `SupabaseServiceError` is an **internal (non-exported) class** in `src/api/errorHandlers.ts`. Callers receive instances of it from `handleSupabaseError()` / `handleNetworkError()`, but cannot `instanceof`-check it from outside that module. The module's public surface is `isOnline()`, `handleSupabaseError()`, `handleNetworkError()`, `isPostgrestError()`, and `logSupabaseError()`.

## Quick Navigation

See [table-of-contents.md](./table-of-contents.md) for the full document listing.

---

_Generated: 2026-07-25 | Source: exhaustive scan of 197 `src/` TypeScript files, 25 SQL migrations_
