# 4. TypeScript Type Definitions

**Sources:**

- `src/types/index.ts` -- Core application types
- `src/types/models.ts` -- Love notes and re-exports
- `src/types/database.types.ts` -- Auto-generated Supabase types
- `src/services/dbSchema.ts` -- IndexedDB entity types

## Core Types (`src/types/index.ts`)

### Enums

```typescript
type ThemeName = 'sunset' | 'ocean' | 'lavender' | 'rose';

type MessageCategory = 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';

type MoodType =
  | 'loved'
  | 'happy'
  | 'content'
  | 'excited'
  | 'thoughtful'
  | 'grateful'
  | 'sad'
  | 'anxious'
  | 'frustrated'
  | 'angry'
  | 'lonely'
  | 'tired';
```

### `Message`

```typescript
interface Message {
  id: number;
  text: string;
  category: MessageCategory;
  isCustom: boolean;
  active?: boolean;
  createdAt: Date;
  isFavorite?: boolean;
  updatedAt?: Date;
  tags?: string[];
}
```

### `Photo`

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

### `MoodEntry`

```typescript
interface MoodEntry {
  id?: number; // Auto-increment (IndexedDB)
  userId: string; // User UUID
  mood: MoodType; // Primary mood (backward compat)
  moods?: MoodType[]; // Multiple mood support
  note?: string; // Max 200 chars
  date: string; // ISO YYYY-MM-DD
  timestamp: Date; // Full timestamp
  synced: boolean; // Uploaded to Supabase
  supabaseId?: string; // Supabase record UUID (after sync)
}
```

### Compression Types

```typescript
interface CompressionOptions {
  maxWidth: number; // Default: 2048
  maxHeight: number; // Default: 2048
  quality: number; // Default: 0.8
}

interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  fallbackUsed?: boolean;
}
```

### Other Types

```typescript
interface Anniversary {
  id: number;
  date: string;
  label: string;
  description?: string;
}

interface PhotoUploadInput {
  file: File;
  caption?: string;
  tags?: string; // Comma-separated
}
```

## IndexedDB Types (`src/services/dbSchema.ts`)

### `StoredAuthToken`

```typescript
interface StoredAuthToken {
  id: 'current';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

### Scripture Types

```typescript
type ScriptureSessionMode = 'solo' | 'together';
type ScriptureSessionPhase =
  | 'lobby'
  | 'countdown'
  | 'reading'
  | 'reflection'
  | 'report'
  | 'complete';
type ScriptureSessionStatus = 'pending' | 'in_progress' | 'complete' | 'abandoned';
type ScriptureSessionRole = 'reader' | 'responder';

interface ScriptureSession {
  id: string;
  mode: ScriptureSessionMode;
  userId: string;
  partnerId?: string;
  currentPhase: ScriptureSessionPhase;
  currentStepIndex: number;
  status: ScriptureSessionStatus;
  version: number;
  snapshotJson?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  myRole?: ScriptureSessionRole;
  partnerRole?: ScriptureSessionRole;
  user1Ready?: boolean;
  user2Ready?: boolean;
  countdownStartedAt?: Date;
}

interface ScriptureReflection {
  id: string;
  sessionId: string;
  stepIndex: number;
  userId: string;
  rating?: number;
  notes?: string;
  isShared: boolean;
  createdAt: Date;
}

interface ScriptureBookmark {
  id: string;
  sessionId: string;
  stepIndex: number;
  userId: string;
  shareWithPartner: boolean;
  createdAt: Date;
}

interface ScriptureMessage {
  id: string;
  sessionId: string;
  senderId: string;
  message: string;
  createdAt: Date;
}
```

## Auto-Generated Database Types (`src/types/database.types.ts`)

Auto-generated from Supabase schema via `supabase gen types typescript --local`. **Do not edit manually.**

### Tables (Row/Insert/Update types for each)

- `interactions` -- `from_user_id`, `to_user_id`, `type`, `viewed`
- `love_notes` -- `from_user_id`, `to_user_id`, `content`, `image_url`
- `moods` -- `user_id`, `mood_type`, `mood_types[]`, `note`
- `partner_requests` -- `from_user_id`, `to_user_id`, `status`
- `photos` -- `user_id`, `storage_path`, `filename`, `caption`, `mime_type`, `file_size`, `width`, `height`
- `scripture_bookmarks` -- `session_id`, `step_index`, `user_id`, `share_with_partner`
- `scripture_messages` -- `session_id`, `sender_id`, `message`
- `scripture_reflections` -- `session_id`, `step_index`, `user_id`, `rating`, `notes`, `is_shared`
- `scripture_sessions` -- `mode`, `user1_id`, `user2_id`, `current_phase`, `current_step_index`, `status`, `version`, `snapshot_json`, roles, ready states
- `scripture_step_states` -- `session_id`, `step_index`, `user1_locked_at`, `user2_locked_at`, `advanced_at`
- `users` -- `partner_name`, `device_id`, `email`, `display_name`, `partner_id`

### Functions (13 RPCs)

See Section 6 for full RPC documentation.

### Enums

```typescript
scripture_session_mode: 'solo' | 'together';
scripture_session_phase: 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
scripture_session_role: 'reader' | 'responder';
scripture_session_status: 'pending' | 'in_progress' | 'complete' | 'abandoned';
```
