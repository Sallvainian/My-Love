# API & Services Architecture Documentation Guide

## Overview

A comprehensive technical documentation of the My-Love application's API and Services layers has been created. This document serves as the authoritative reference for understanding the backend architecture.

**Document**: `API_SERVICES_ARCHITECTURE.md` (1,207 lines)

---

## What's Documented

### API Layer (8 Services)

1. **supabaseClient.ts**
   - Singleton Supabase instance
   - Typed database schema with RLS enforcement
   - Real-time subscription configuration
   - Partner discovery helpers

2. **authService.ts**
   - Email/password authentication
   - Google OAuth flow
   - JWT token management
   - Session persistence
   - Password reset workflow

3. **moodApi.ts**
   - Mood CRUD operations
   - Zod schema validation
   - Fetch by user/date range
   - Error classification

4. **moodSyncService.ts**
   - Exponential backoff retry logic
   - Real-time mood subscriptions
   - Batch sync operations
   - Partner mood visibility

5. **partnerService.ts**
   - User discovery and search
   - Partner request workflow
   - Relationship management
   - RLS-protected queries

6. **interactionService.ts**
   - Poke/kiss interactions
   - Real-time notifications
   - Interaction history
   - View status tracking

7. **errorHandlers.ts**
   - PostgreSQL error mapping
   - Retry configuration
   - Network error detection
   - User-friendly messages

8. **supabaseSchemas.ts**
   - Zod validation schemas
   - User validation
   - Mood validation
   - Interaction validation
   - Timestamp format validation

### Services Layer (10 Services)

1. **BaseIndexedDBService.ts**
   - Abstract CRUD base class
   - Template method pattern
   - Initialization guards
   - Cursor-based pagination
   - Generic type support

2. **storage.ts**
   - Legacy photo operations
   - Message management
   - Local storage helpers
   - Database versioning

3. **photoStorageService.ts**
   - Photo metadata storage
   - Compression tracking
   - Quota estimation
   - Index-based retrieval
   - Schema migration (v1→v2)

4. **customMessageService.ts**
   - Custom message CRUD
   - Advanced filtering
   - Import/export functionality
   - Duplicate detection
   - Zod validation

5. **moodService.ts**
   - Mood entry tracking
   - Sync status management
   - Date range queries
   - Unique by-date constraint
   - Unsynced mood retrieval

6. **syncService.ts**
   - Offline-first synchronization
   - Batch sync operations
   - Partial failure handling
   - Pending count tracking
   - Transform pipelines

7. **realtimeService.ts**
   - WebSocket subscriptions
   - Channel management
   - Error handling
   - Connection tracking
   - Global error handlers

8. **migrationService.ts**
   - LocalStorage → IndexedDB migration
   - One-time execution
   - Duplicate prevention
   - Validation with Zod
   - Error logging

9. **imageCompressionService.ts**
   - Canvas-based compression
   - File validation
   - Size estimation
   - Format conversion
   - No external dependencies

10. **performanceMonitor.ts**
    - Async operation timing
    - Metric aggregation
    - Report generation
    - Min/max/avg calculations
    - Development logging

---

## Key Architecture Concepts

### Offline-First Pattern

- **Local-First Writes**: All data written to IndexedDB immediately
- **Background Sync**: Automatic sync when online with retry logic
- **Real-time Updates**: WebSocket subscriptions for partner data
- **Graceful Degradation**: App functions with empty state if network fails

### Authentication Flow

- **Email/Password**: Username + password validation via Supabase
- **Google OAuth**: Browser redirect → Google login → Auto-provision user
- **JWT Tokens**: Secure, expiring tokens with auto-refresh
- **RLS**: Row Level Security enforced at database layer

### Type Safety

- **Zod Runtime Validation**: All API responses validated against schemas
- **TypeScript Generics**: Service inheritance with generic types
- **Custom Error Classes**: Structured error handling with codes and hints

### Service Architecture

- **Template Method Pattern**: BaseIndexedDBService defines structure
- **Singleton Pattern**: Single instance per service across app
- **Concurrent Initialization Guards**: Prevents race conditions
- **Graceful Error Handling**: Read ops fail silently, write ops throw

### Data Synchronization

- **Bidirectional Sync**: Local ↔ Cloud synchronization
- **Partial Failure Handling**: Continue if some records fail
- **Per-Record Tracking**: synced boolean + supabaseId UUID
- **Real-time Updates**: Postgres Changes subscriptions

---

## Error Handling Philosophy

### Read Operations (get, getAll, getPage)

- **Behavior**: Return null or empty array on error
- **Rationale**: App continues functioning with empty state
- **User Experience**: Empty UI instead of crashes

### Write Operations (add, update, delete)

- **Behavior**: Throw error on failure
- **Rationale**: Explicit failure prevents silent data loss
- **User Experience**: Clear error messages with retry option

### PostgreSQL Error Mapping

- **23505**: Unique constraint → "Record already exists"
- **23503**: Foreign key → "Referenced record not found"
- **23502**: NOT NULL → "Required field is missing"
- **42501**: Permission denied → "RLS policy denied"
- **NETWORK_ERROR**: Device offline → "Will sync when online"

---

## Performance Characteristics

### Database Operations

- **Cursor Pagination**: O(offset + limit) instead of O(n)
- **Index Usage**: by-date, by-category indexes for fast queries
- **Unique Constraints**: One mood per day via unique index

### Image Compression

- **Reduction**: 3-5MB → 300-500KB (~90% reduction)
- **Format**: JPEG 80% quality
- **Dimensions**: Max 1920x1920 (maintains aspect ratio)
- **Time**: <3 seconds on modern devices

### Sync Performance

- **Batch Operations**: Promise.all for parallel mood syncs
- **Exponential Backoff**: 1s → 2s → 4s with 3 max retries
- **Partial Failure**: Continues syncing if individual records fail

---

## Database Schema

### Stores (IndexedDB)

1. **messages** (v1)
   - keyPath: id (auto-increment)
   - indexes: by-category, by-date

2. **photos** (v2)
   - keyPath: id (auto-increment)
   - indexes: by-date

3. **moods** (v3)
   - keyPath: id (auto-increment)
   - indexes: by-date (unique: one mood per day)

### Migrations

- **v1 → v2**: Photos store enhanced schema
- **v2 → v3**: Add moods store with unique date index

---

## File Locations

### API Files

- `/src/api/supabaseClient.ts`
- `/src/api/authService.ts`
- `/src/api/moodApi.ts`
- `/src/api/moodSyncService.ts`
- `/src/api/partnerService.ts`
- `/src/api/interactionService.ts`
- `/src/api/errorHandlers.ts`
- `/src/api/validation/supabaseSchemas.ts`

### Services Files

- `/src/services/BaseIndexedDBService.ts`
- `/src/services/storage.ts`
- `/src/services/photoStorageService.ts`
- `/src/services/customMessageService.ts`
- `/src/services/moodService.ts`
- `/src/services/syncService.ts`
- `/src/services/realtimeService.ts`
- `/src/services/migrationService.ts`
- `/src/services/imageCompressionService.ts`
- `/src/services/performanceMonitor.ts`

### Documentation

- `/API_SERVICES_ARCHITECTURE.md` (this comprehensive reference)

---

## Design Patterns Used

### 1. Template Method Pattern

```
BaseIndexedDBService
├── abstract _doInit()
├── abstract getStoreName()
└── shared init(), add(), get(), update(), delete()
```

### 2. Singleton Pattern

All services exported as single instances to prevent multiple DB connections.

### 3. Error Handling Hierarchy

```
Zod Validation Error
    ↓
ApiValidationError (schema mismatch)
    ↓
PostgreSQL Error
    ↓
SupabaseServiceError (with code mapping)
    ↓
Network Error
    ↓
SupabaseServiceError (isNetworkError=true)
```

### 4. Offline-First Sync Pattern

```
User Action
    ↓
Write to IndexedDB (immediate)
    ↓
Update UI (instant feedback)
    ↓
Attempt Sync in Background
    ↓
Mark as Synced + Update supabaseId
```

### 5. Real-time Collaboration Pattern

```
Partner Action in DB
    ↓
Postgres Changes Event
    ↓
WebSocket Broadcast
    ↓
Client Subscription Callback
    ↓
UI Update (real-time)
```

---

## Quick Reference

### Common Operations

**Create Mood Entry**:

```typescript
const mood = await moodService.create(userId, ['happy', 'grateful'], 'Great day!');
```

**Sync Pending Moods**:

```typescript
const summary = await syncService.syncPendingMoods();
console.log(`Synced ${summary.successful}/${summary.total}`);
```

**Subscribe to Partner Updates**:

```typescript
const unsubscribe = await moodSyncService.subscribeMoodUpdates((mood) =>
  console.log('Partner mood:', mood)
);
```

**Authenticate User**:

```typescript
const result = await authService.signIn({ email, password });
if (result.error) console.error(result.error.message);
```

**Compress Photo**:

```typescript
const result = await imageCompressionService.compressImage(file);
const photo = await photoStorageService.create({
  imageBlob: result.blob,
  width: result.width,
  height: result.height,
  // ...
});
```

---

## Testing Considerations

- Services are singletons (requires cleanup between tests)
- IndexedDB operations are async (use async/await in tests)
- Network errors simulated via fetch mocking
- Zod validation should be tested at boundaries
- Real-time subscriptions cleanup required (unsubscribe calls)

---

## Future Enhancements

- Message sync to Supabase (currently IndexedDB only)
- Photo sync to Supabase storage
- Advanced mood analytics/calendar views
- Notification system integration
- Offline data compression for storage optimization

---

## References

- Zod Validation: https://zod.dev/
- Supabase: https://supabase.com/docs
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- IDB Library: https://github.com/jakearchibald/idb

---

**Last Updated**: 2025-11-16  
**Documentation Version**: 1.0  
**API Status**: Production-Ready
