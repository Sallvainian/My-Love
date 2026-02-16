# 6. IndexedDB Schema

The client uses IndexedDB (via the `idb` library) for offline-first data storage. The database is named `my-love-db` and is currently at version 5.

## Database Configuration

```typescript
const DB_NAME = 'my-love-db';
const DB_VERSION = 5;
```

## Object Stores

### 6.1 `messages`

Stores custom love messages for the daily message rotation.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | Yes |

| Index | Key Path | Unique |
|---|---|---|
| `by-category` | `category` | No |
| `by-date` | `createdAt` | No |

**Value type:** `Message`

```typescript
interface Message {
  id: number;
  text: string;
  category: 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';
  isCustom: boolean;
  active?: boolean;
  createdAt: Date;
  isFavorite?: boolean;
  updatedAt?: Date;
  tags?: string[];
}
```

### 6.2 `photos`

Stores compressed photo blobs and metadata locally.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | Yes |

| Index | Key Path | Unique |
|---|---|---|
| `by-date` | `uploadDate` | No |

**Value type:** `Photo`

```typescript
interface Photo {
  id: number;
  imageBlob: Blob;
  caption?: string;
  tags: string[];
  uploadDate: Date;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
}
```

### 6.3 `moods`

Stores mood entries locally for offline-first tracking with Supabase sync.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | Yes |

| Index | Key Path | Unique |
|---|---|---|
| `by-date` | `date` | Yes |

**Value type:** `MoodEntry`

```typescript
interface MoodEntry {
  id?: number;
  userId: string;
  mood: MoodType;
  moods?: MoodType[];
  note?: string;
  date: string;        // YYYY-MM-DD
  timestamp: Date;
  synced: boolean;
  supabaseId?: string;
}
```

### 6.4 `sw-auth`

Stores the current auth token for Service Worker access (Background Sync).

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

**Value type:** `StoredAuthToken`

```typescript
interface StoredAuthToken {
  id: 'current';       // Always 'current' (single record)
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

### 6.5 `scripture-sessions`

Caches scripture sessions for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-user` | `userId` | No |

**Value type:** `ScriptureSession`

```typescript
interface ScriptureSession {
  id: string;
  mode: 'solo' | 'together';
  userId: string;
  partnerId?: string;
  currentPhase: ScriptureSessionPhase;
  currentStepIndex: number;
  status: ScriptureSessionStatus;
  version: number;
  snapshotJson?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
}
```

### 6.6 `scripture-reflections`

Caches scripture reflections for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-session` | `sessionId` | No |

**Value type:** `ScriptureReflection`

```typescript
interface ScriptureReflection {
  id: string;
  sessionId: string;
  stepIndex: number;
  userId: string;
  rating?: number;    // 1-5
  notes?: string;
  isShared: boolean;
  createdAt: Date;
}
```

### 6.7 `scripture-bookmarks`

Caches scripture bookmarks for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-session` | `sessionId` | No |

**Value type:** `ScriptureBookmark`

```typescript
interface ScriptureBookmark {
  id: string;
  sessionId: string;
  stepIndex: number;
  userId: string;
  shareWithPartner: boolean;
  createdAt: Date;
}
```

### 6.8 `scripture-messages`

Caches scripture prayer messages for offline access.

| Property | Key | Auto-increment |
|---|---|---|
| keyPath | `id` | No |

| Index | Key Path | Unique |
|---|---|---|
| `by-session` | `sessionId` | No |

**Value type:** `ScriptureMessage`

```typescript
interface ScriptureMessage {
  id: string;
  sessionId: string;
  senderId: string;
  message: string;
  createdAt: Date;
}
```

## Version History

| Version | Changes |
|---|---|
| v1 | `messages` store with `by-category` and `by-date` indexes |
| v2 | `photos` store (recreated from v1 with `imageBlob` replacing `blob`) |
| v3 | `moods` store with unique `by-date` index |
| v4 | `sw-auth` store for Background Sync service worker tokens |
| v5 | Four `scripture-*` stores for offline scripture reading support |

---
