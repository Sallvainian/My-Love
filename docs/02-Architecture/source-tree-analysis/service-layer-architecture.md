# Service Layer Architecture

## Service Dependency Graph

```
┌─────────────────┐
│   Components    │
└────────┬────────┘
         │ uses
         ▼
┌─────────────────┐     ┌─────────────────┐
│   Zustand       │◄────│   API Layer     │
│   Slices        │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ persists/loads        │ network ops
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Services      │     │  Supabase SDK   │
│   (Business)    │     │                 │
└────────┬────────┘     └─────────────────┘
         │
         │ storage ops
         ▼
┌─────────────────┐
│   IndexedDB     │
│   + LocalStorage│
└─────────────────┘
```

## Service Responsibilities

| Service                      | Responsibility                     | Dependencies         |
| ---------------------------- | ---------------------------------- | -------------------- |
| `BaseIndexedDBService.ts`    | Abstract CRUD for IndexedDB        | idb library          |
| `photoStorageService.ts`     | Photo blob storage, pagination     | BaseIndexedDBService |
| `customMessageService.ts`    | User-created messages CRUD         | BaseIndexedDBService |
| `moodService.ts`             | Local mood persistence             | BaseIndexedDBService |
| `imageCompressionService.ts` | Canvas-based image optimization    | Browser Canvas API   |
| `syncService.ts`             | Offline queue, conflict resolution | All API services     |
| `realtimeService.ts`         | Supabase subscriptions             | supabaseClient       |
| `migrationService.ts`        | Schema version upgrades            | IndexedDB            |
| `performanceMonitor.ts`      | Runtime metrics collection         | Performance API      |
| `storage.ts`                 | Generic IndexedDB operations       | idb library          |
