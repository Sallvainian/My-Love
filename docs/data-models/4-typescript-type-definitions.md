# 4. TypeScript Type Definitions

**Sources:**

- `src/types/database.types.ts` -- Auto-generated from Supabase schema
- `src/types/index.ts` -- App-level type definitions
- `src/types/models.ts` -- Supabase model re-exports and Love Notes types

## Generated Database Types (`database.types.ts`)

Auto-generated via `supabase gen types typescript --local`. Defines `Database` type with `public.Tables`, `public.Functions`, `public.Enums`.

### Table Row/Insert/Update Types

Each table has three type variants:

- `Row` -- Full record from SELECT
- `Insert` -- Required/optional fields for INSERT
- `Update` -- All-optional fields for UPDATE

### Function Types

All 13 RPC functions with `Args` and `Returns` types.

### Enum Types

```typescript
scripture_session_mode: 'solo' | 'together';
scripture_session_phase: 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
scripture_session_role: 'reader' | 'responder';
scripture_session_status: 'pending' | 'in_progress' | 'complete' | 'abandoned' | 'ended_early';
```

### Utility Types

- `Tables<TableName>` -- Extract Row type for a table
- `TablesInsert<TableName>` -- Extract Insert type
- `TablesUpdate<TableName>` -- Extract Update type
- `Enums<EnumName>` -- Extract enum values

## App-Level Types (`src/types/index.ts`)

### Core Types

- `ThemeName`: `'sunset' | 'ocean' | 'lavender' | 'rose'`
- `MessageCategory`: `'reason' | 'memory' | 'affirmation' | 'future' | 'custom'`
- `MoodType`: 12 mood values (loved, happy, content, excited, thoughtful, grateful, sad, anxious, frustrated, angry, lonely, tired)
- `RouteType`: `'home' | 'memories' | 'moods' | 'countdown' | 'settings' | 'onboarding'`

### Data Interfaces

**`Message`**: id (number), text, category, isCustom, active?, createdAt (Date), isFavorite?, updatedAt?, tags?

**`Photo`**: id (number), imageBlob (Blob), caption?, tags (string[]), uploadDate (Date), originalSize, compressedSize, width, height, mimeType

**`MoodEntry`**: id? (number), userId, mood (MoodType), moods? (MoodType[]), note?, date (YYYY-MM-DD), timestamp (Date), synced (boolean), supabaseId?

**`Settings`**: themeName, notificationTime (HH:MM), relationship (startDate, partnerName, anniversaries[]), customization (accentColor, fontFamily), notifications (enabled, time)

**`MessageHistory`**: currentIndex, shownMessages (Map<string, number>), maxHistoryDays, favoriteIds

### Custom Message Types

- `CustomMessage`, `CreateMessageInput`, `UpdateMessageInput`, `MessageFilter`, `CustomMessagesExport`

### Compression Types

- `CompressionOptions`: maxWidth, maxHeight, quality
- `CompressionResult`: blob, width, height, originalSize, compressedSize, fallbackUsed?

## Model Re-exports (`src/types/models.ts`)

### Photo Types (from `photoService.ts`)

`SupabasePhoto`, `PhotoWithUrls`, `StorageQuota`, `PhotoUploadInput`

### Scripture Types (from `dbSchema.ts`)

`ScriptureSession`, `ScriptureReflection`, `ScriptureBookmark`, `ScriptureMessage`, `ScriptureSessionMode`, `ScriptureSessionPhase`, `ScriptureSessionStatus`

### Love Notes Types (defined here)

**`LoveNote`**: id, from_user_id, to_user_id, content, created_at, image_url?, sending?, error?, tempId?, imageUploading?, imageBlob?, imagePreviewUrl?

**`LoveNotesState`**: notes[], isLoading, error, hasMore

**`SendMessageInput`**: content, timestamp, imageFile?

**`MessageValidationResult`**: valid, error?
