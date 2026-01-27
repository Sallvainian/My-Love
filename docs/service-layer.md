# Service Layer

> Services and utilities documentation for My-Love project.

## Overview

The service layer (`src/services/`) provides:
- IndexedDB operations for offline storage
- Sync orchestration between local and remote
- Image processing and compression
- Real-time subscription management

## Service Files

| File | Purpose |
|------|---------|
| `BaseIndexedDBService.ts` | Abstract base class for IDB |
| `moodService.ts` | Mood IndexedDB operations |
| `photoService.ts` | Photo metadata + Supabase Storage |
| `photoStorageService.ts` | Supabase Storage integration |
| `loveNoteImageService.ts` | Chat image uploads |
| `imageCompressionService.ts` | Client-side compression |
| `syncService.ts` | Sync orchestration |
| `realtimeService.ts` | Supabase realtime subscriptions |
| `customMessageService.ts` | Custom message storage |
| `migrationService.ts` | Schema migrations |
| `performanceMonitor.ts` | Performance tracking |
| `storage.ts` | Generic storage utilities |

## BaseIndexedDBService

Abstract base class for IndexedDB operations.

### Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize database connection |
| `add(item)` | Insert new record |
| `get(id)` | Retrieve by ID |
| `getAll()` | Retrieve all records |
| `getPage(offset, limit)` | Paginated retrieval |
| `update(id, changes)` | Update record |
| `delete(id)` | Delete record |

### Usage Pattern

```typescript
class MoodService extends BaseIndexedDBService<Mood, MoodDBTypes> {
  constructor() {
    super('my-love-db', 'moods', 1);
  }

  // Add custom methods as needed
  async getMoodsByDate(date: string): Promise<Mood[]> {
    // Custom query logic
  }
}
```

## Mood Service

Handles mood data in IndexedDB.

### Methods

| Method | Description |
|--------|-------------|
| `saveMood(mood)` | Save mood entry |
| `getMoods(userId)` | Get user's moods |
| `getMoodsByDateRange(start, end)` | Range query |
| `deleteMood(id)` | Remove mood |

### Example

```typescript
import { moodService } from './services/moodService';

// Save mood locally
await moodService.saveMood({
  id: uuid(),
  user_id: userId,
  mood_type: 'happy',
  note: 'Great day!',
  created_at: new Date().toISOString(),
});

// Fetch moods
const moods = await moodService.getMoods(userId);
```

## Photo Service

Manages photo metadata and Supabase Storage.

### Types

```typescript
interface SupabasePhoto {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  caption: string | null;
  created_at: string;
}

interface PhotoWithUrls extends SupabasePhoto {
  url: string;
  thumbnailUrl: string;
}

interface StorageQuota {
  used: number;
  limit: number;
  percentage: number;
}
```

### Methods

| Method | Description |
|--------|-------------|
| `uploadPhoto(file)` | Upload to Storage + save metadata |
| `getPhotos(userId)` | Get photos with signed URLs |
| `getPhotoById(id)` | Get single photo |
| `updateCaption(id, caption)` | Edit caption |
| `deletePhoto(id)` | Delete photo and file |
| `getStorageQuota()` | Get usage stats |

### Quota Management

```typescript
// Warning thresholds
const QUOTA_WARNING = 0.8;   // 80%
const QUOTA_CRITICAL = 0.95; // 95%
const QUOTA_BLOCKED = 1.0;   // 100%

const quota = await photoService.getStorageQuota();
if (quota.percentage >= QUOTA_BLOCKED) {
  throw new Error('Storage quota exceeded');
}
```

## Image Compression Service

Client-side image compression before upload.

### Methods

| Method | Description |
|--------|-------------|
| `compressImage(file, options)` | Compress image |
| `resizeImage(file, maxDimension)` | Resize maintaining aspect |
| `convertToWebP(file)` | Convert to WebP format |

### Options

```typescript
interface CompressionOptions {
  maxWidth?: number;      // Default: 1920
  maxHeight?: number;     // Default: 1080
  quality?: number;       // Default: 0.8
  mimeType?: string;      // Default: 'image/jpeg'
}
```

### Example

```typescript
import { imageCompressionService } from './services/imageCompressionService';

const compressed = await imageCompressionService.compressImage(file, {
  maxWidth: 1200,
  quality: 0.7,
});
```

## Love Note Image Service

Handles image uploads for chat messages.

### Methods

| Method | Description |
|--------|-------------|
| `uploadImage(file, noteId)` | Upload chat image |
| `getImageUrl(path)` | Get signed URL |
| `deleteImage(path)` | Delete image |

### Storage Path Pattern

```
love-notes/{userId}/{noteId}/{filename}
```

## Sync Service

Orchestrates sync between IndexedDB and Supabase.

### Sync Strategy

```
Local Change → Queue → Network Available → Supabase Sync
                              ↓
                     Sync Failed → Retry Queue
```

### Methods

| Method | Description |
|--------|-------------|
| `queueSync(operation)` | Add to sync queue |
| `processQueue()` | Process pending syncs |
| `forceSyncAll()` | Immediate full sync |
| `getSyncStatus()` | Get queue status |

## Realtime Service

Manages Supabase realtime subscriptions.

### Subscription Patterns

```typescript
// Mood updates via Broadcast (RLS workaround)
supabase.channel(`mood-updates:${userId}`)
  .on('broadcast', { event: 'mood-update' }, handler)
  .subscribe();

// Interaction notifications
supabase.channel(`interactions:${userId}`)
  .on('broadcast', { event: 'new-interaction' }, handler)
  .subscribe();
```

### Methods

| Method | Description |
|--------|-------------|
| `subscribeToMoods(userId, callback)` | Listen for mood updates |
| `subscribeToInteractions(userId, callback)` | Listen for pokes/kisses |
| `subscribeToNotes(userId, callback)` | Listen for new notes |
| `unsubscribeAll()` | Clean up subscriptions |

## Custom Message Service

Stores user-created messages in IndexedDB.

### Methods

| Method | Description |
|--------|-------------|
| `addMessage(text, category)` | Add custom message |
| `getMessages()` | Get all custom messages |
| `deleteMessage(id)` | Remove message |

## Migration Service

Handles IndexedDB schema migrations.

### Migration Pattern

```typescript
const migrations = [
  {
    version: 1,
    migrate: (db) => {
      db.createObjectStore('moods', { keyPath: 'id' });
    },
  },
  {
    version: 2,
    migrate: (db) => {
      db.createObjectStore('photos', { keyPath: 'id' });
    },
  },
];
```

## Performance Monitor

Tracks performance metrics.

### Metrics

| Metric | Description |
|--------|-------------|
| `apiLatency` | API response times |
| `renderTime` | Component render duration |
| `syncTime` | Sync operation duration |
| `storageUsage` | IndexedDB usage |

### Example

```typescript
import { performanceMonitor } from './services/performanceMonitor';

performanceMonitor.startMark('api-call');
await moodApi.fetchByUser(userId);
performanceMonitor.endMark('api-call');
```

## Storage Utilities

Generic storage helpers.

### Methods

| Method | Description |
|--------|-------------|
| `get(key)` | Get from localStorage |
| `set(key, value)` | Save to localStorage |
| `remove(key)` | Delete from localStorage |
| `clear()` | Clear all storage |

## Best Practices

### Service Singletons

```typescript
// Export singleton instance
export const moodService = new MoodService();

// Import and use
import { moodService } from './services/moodService';
```

### Error Handling

```typescript
try {
  await photoService.uploadPhoto(file);
} catch (error) {
  if (error instanceof QuotaExceededError) {
    // Handle quota exceeded
  }
  // Re-throw for caller handling
  throw error;
}
```

### Offline Support

```typescript
import { isOnline } from '../api/errorHandlers';

async function saveMood(mood: Mood) {
  // Always save locally first
  await moodService.saveMood(mood);

  // Sync to server if online
  if (isOnline()) {
    await moodApi.create(mood);
  } else {
    await syncService.queueSync({ type: 'mood', operation: 'create', data: mood });
  }
}
```
