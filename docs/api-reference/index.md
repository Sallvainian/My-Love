# API Reference

Complete API documentation for the My Love PWA backend services.

## Sections

1. [Supabase Client Configuration](./1-supabase-client-configuration.md)
2. [Authentication Service](./2-authentication-service.md)
3. [Error Handling Utilities](./3-error-handling-utilities.md)
4. [Mood API Service](./4-mood-api-service.md)
5. [Mood Sync Service](./5-mood-sync-service.md)
6. [Interaction Service](./6-interaction-service.md)
7. [Partner Service](./7-partner-service.md)
8. [IndexedDB Services](./8-indexeddb-services.md)
9. [Photo Services](./9-photo-services.md)
10. [Validation Layer](./10-validation-layer.md)
11. [Service Worker & Background Sync](./11-service-worker-background-sync.md)
12. [Real-Time Subscriptions](./12-real-time-subscriptions.md)
13. [Scripture Reading Service](./13-scripture-reading-service.md)
14. [Additional Services](./14-additional-services.md)

## Architecture Overview

```
UI Components (React 19)
    |
Zustand Store (10 slices via AppState)
    |
Services Layer (IndexedDB CRUD, business logic, caching)
    |
API Layer (Supabase client, Zod validation, error handling)
    |
Supabase Backend (PostgreSQL + RLS, Storage, Realtime, Auth, Edge Functions)
```

### Key Patterns

- **Singleton services**: Each service is instantiated once at module level and exported (e.g., `export const moodApi = new MoodApi()`)
- **Zod validation**: API responses validated via `SupabaseMoodSchema` etc.; service inputs validated via `MoodEntrySchema` etc.
- **Offline-first**: IndexedDB stores data locally; background sync uploads pending entries when connectivity returns
- **Error hierarchy**: `SupabaseServiceError` (DB errors) > `ApiValidationError` (response validation) > `ValidationError` (input validation)
- **Cache-first reads**: Scripture service reads IndexedDB first, returns cached data, then refreshes from server in background
- **Write-through**: Mutations go to Supabase first; on success, update local IndexedDB cache
- **Broadcast API**: Used for partner mood updates (avoids RLS issues with postgres_changes)
