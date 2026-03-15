# API Reference -- Table of Contents

1. [Supabase Client Configuration](./1-supabase-client-configuration.md) -- Client setup, env vars, partner helpers
2. [Authentication Service](./2-authentication-service.md) -- Auth facade, session/action services, OAuth
3. [Error Handling Utilities](./3-error-handling-utilities.md) -- SupabaseServiceError, retry logic, offline detection
4. [Mood API Service](./4-mood-api-service.md) -- Validated CRUD for moods with Zod schemas
5. [Mood Sync Service](./5-mood-sync-service.md) -- IndexedDB-to-Supabase sync, Broadcast API
6. [Interaction Service](./6-interaction-service.md) -- Poke/kiss interactions, Realtime subscriptions
7. [Partner Service](./7-partner-service.md) -- User search, partner requests, connection management
8. [IndexedDB Services](./8-indexeddb-services.md) -- BaseIndexedDBService, mood/photo/message/scripture services
9. [Photo Services](./9-photo-services.md) -- Cloud storage, local storage, compression, love note images
10. [Validation Layer](./10-validation-layer.md) -- All Zod schemas, error formatting
11. [Service Worker & Background Sync](./11-service-worker-background-sync.md) -- Workbox caching, Background Sync
12. [Real-Time Subscriptions](./12-real-time-subscriptions.md) -- Broadcast API, postgres_changes, private channels
13. [Scripture Reading Service](./13-scripture-reading-service.md) -- Session CRUD, cache-first pattern, RPCs
14. [Additional Services](./14-additional-services.md) -- Logger, performanceMonitor, migrationService, storageService, syncService, utilities

---

## Cross-Reference: Data Models

For database schema, TypeScript types, and IndexedDB store definitions, see [Data Models](../data-models/index.md).
