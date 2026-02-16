# 4. TypeScript Type Definitions

**Sources:**
- `src/types/database.types.ts` (auto-generated from Supabase schema)
- `src/types/index.ts` (application types)
- `src/types/models.ts` (Supabase model types and re-exports)

## 4.1 Generated Supabase Types (`database.types.ts`)

Auto-generated using `supabase gen types typescript --local`. Do not edit manually.

### Database Type Structure

```typescript
type Database = {
  public: {
    Tables: {
      interactions: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      love_notes: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [] };
      moods: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      partner_requests: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      photos: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      scripture_bookmarks: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      scripture_messages: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      scripture_reflections: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      scripture_sessions: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      scripture_step_states: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
      users: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [...] };
    };
    Functions: {
      accept_partner_request: { Args: { p_request_id: string }; Returns: undefined };
      decline_partner_request: { Args: { p_request_id: string }; Returns: undefined };
      get_my_partner_id: { Args: Record<string, never>; Returns: string };
      is_scripture_session_member: { Args: { p_session_id: string }; Returns: boolean };
      scripture_create_session: { Args: { p_mode: string; p_partner_id?: string }; Returns: Json };
      scripture_seed_test_data: { Args: {...}; Returns: Json };
      scripture_submit_reflection: { Args: {...}; Returns: Json };
    };
    Enums: {
      scripture_session_mode: 'solo' | 'together';
      scripture_session_phase: 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
      scripture_session_status: 'pending' | 'in_progress' | 'complete' | 'abandoned';
    };
  };
};
```

Each table provides three type variants:
- **Row**: All columns, all non-nullable (matches SELECT results)
- **Insert**: Required columns non-optional, generated columns optional
- **Update**: All columns optional (for partial updates)
- **Relationships**: Foreign key metadata for Supabase client join syntax

### Usage Pattern

```typescript
type InteractionRow = Database['public']['Tables']['interactions']['Row'];
type InteractionInsert = Database['public']['Tables']['interactions']['Insert'];
```

## 4.2 Application Types (`types/index.ts`)

Hand-written types for the client-side application.

### Enums (Union Types)

```typescript
type ThemeName = 'sunset' | 'ocean' | 'lavender' | 'rose';
type MessageCategory = 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';
type MoodType = 'loved' | 'happy' | 'content' | 'excited' | 'thoughtful' | 'grateful'
              | 'sad' | 'anxious' | 'frustrated' | 'angry' | 'lonely' | 'tired';
type RouteType = 'home' | 'memories' | 'moods' | 'countdown' | 'settings' | 'onboarding';
```

### Core Interfaces

| Interface | Key Fields | Used By |
|-----------|-----------|---------|
| `Message` | `id: number`, `text`, `category`, `isCustom`, `active`, `createdAt`, `tags` | `customMessageService`, messagesSlice |
| `Photo` | `id: number`, `imageBlob: Blob`, `caption`, `tags`, `uploadDate`, `originalSize`, `compressedSize`, `width`, `height`, `mimeType` | `photoStorageService`, photosSlice |
| `MoodEntry` | `id?: number`, `userId`, `mood`, `moods?`, `note`, `date`, `timestamp`, `synced: boolean`, `supabaseId?` | `moodService`, moodSlice |
| `Settings` | `themeName`, `notificationTime`, `relationship` (nested), `customization` (nested), `notifications` (nested) | settingsSlice |
| `Anniversary` | `id: number`, `date`, `label`, `description?` | Settings.relationship |
| `MessageHistory` | `currentIndex`, `shownMessages: Map<string, number>`, `maxHistoryDays`, `favoriteIds` | messagesSlice |
| `AppState` | `settings`, `messageHistory`, `messages`, `photos`, `moods`, `isOnboarded` | useAppStore |

### Compression Types

```typescript
interface CompressionOptions {
  maxWidth: number;   // Default: 2048
  maxHeight: number;  // Default: 2048
  quality: number;    // Default: 0.8
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

### Message Management Types

| Interface | Purpose |
|-----------|---------|
| `CreateMessageInput` | `text`, `category`, `active?`, `tags?` |
| `UpdateMessageInput` | `id` (required), `text?`, `category?`, `active?`, `tags?` |
| `MessageFilter` | `category?`, `isCustom?`, `active?`, `searchTerm?`, `tags?` |
| `CustomMessagesExport` | `version: '1.0'`, `exportDate`, `messageCount`, `messages[]` |

### Re-exports

`types/index.ts` re-exports from `interactionService`:
- `Interaction`, `SupabaseInteractionRecord`, `InteractionType`

### Legacy Types (Deprecated)

`PocketbaseUser`, `PocketbaseMood`, `PocketbaseInteraction` -- from the original PocketBase backend, replaced by Supabase in Epic 6. Kept for migration reference only.

## 4.3 Supabase Model Types (`types/models.ts`)

Re-exports and additional interfaces for Supabase data models.

### Re-exports

From `photoService`: `SupabasePhoto`, `PhotoWithUrls`, `StorageQuota`, `PhotoUploadInput`

From `dbSchema`: `ScriptureSession`, `ScriptureReflection`, `ScriptureBookmark`, `ScriptureMessage`, `ScriptureSessionMode`, `ScriptureSessionPhase`, `ScriptureSessionStatus`

### LoveNote Interface

```typescript
interface LoveNote {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  image_url?: string | null;
  // Client-side only fields for optimistic updates:
  sending?: boolean;
  error?: boolean;
  tempId?: string;
  imageUploading?: boolean;
  imageBlob?: Blob;
  imagePreviewUrl?: string;
}
```

The `sending`, `error`, `tempId`, `imageUploading`, `imageBlob`, and `imagePreviewUrl` fields exist only on the client for optimistic UI updates. They are never persisted to Supabase.

### Supporting Interfaces

```typescript
interface LoveNotesState {
  notes: LoveNote[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

interface SendMessageInput {
  content: string;
  timestamp: string;
  imageFile?: File;
}

interface MessageValidationResult {
  valid: boolean;
  error?: string;
}
```
