# 4. TypeScript Type Definitions

**Sources:**

- `src/types/database.types.ts` -- Auto-generated from Supabase schema
- `src/types/index.ts` -- App-level type definitions
- `src/types/models.ts` -- Supabase model re-exports and Love Notes types

## Generated Database Types (`database.types.ts`)

Auto-generated via `supabase gen types typescript --local`. Defines the `Database` type with `public.Tables`, `public.Functions`, `public.Enums`.

Never edit this file by hand. Regenerate with:

```bash
supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts
```

> **Currently stale.** The generated file lists **11 tables** and does not include `claude_bot_config`, which was added by migration `20260316031209_create_claude_bot_config.sql`. The app never reads that table from the client (it is service-role only), so nothing is broken -- but the next regeneration will add it.

### Table Row/Insert/Update Types

Each table has three type variants:

- `Row` -- Full record from SELECT
- `Insert` -- Required/optional fields for INSERT
- `Update` -- All-optional fields for UPDATE

### Function Types

All 14 app RPC functions with `Args` and `Returns` types, plus the `pg_graphql` extension's `graphql` function.

> `postgrest-js` (>= supabase-js 2.105) wraps `.update()` payloads in `RejectExcessProperties`, which resolves an index signature to `never`. Type update payloads with the generated `Database['public']['Tables'][T]['Update']` row rather than `Record<string, unknown>` -- see `scriptureReadingService.updateSession()`.

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
- `Theme`: name, displayName, `colors` (primary/secondary/background/text/accent), `gradients` (background/card)
- `Anniversary`: id, date (ISO string), label, description?

> `RouteType` no longer exists. View routing is typed by `ViewType` in `src/stores/slices/navigationSlice.ts`: `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'`.

### Re-exported Interaction Types

`src/types/index.ts` re-exports `Interaction`, `InteractionType`, and `SupabaseInteractionRecord` from `../api/interactionService` so consumers get one import site.

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

## Love Notes Types (`src/types/models.ts`)

This file was trimmed in the dead-code sweep. It no longer re-exports photo or scripture types -- it now defines exactly two interfaces:

**`LoveNote`**: id, from_user_id, to_user_id, content, created_at, image_url?, plus client-only optimistic-update fields: sending?, error?, tempId?, imageUploading?, imageBlob?, imagePreviewUrl?

**`MessageValidationResult`**: valid, error?

> Removed: `LoveNotesState` and `SendMessageInput` (state now lives inline on `NotesSlice`), and the `SupabasePhoto` / `PhotoWithUrls` / `StorageQuota` / `PhotoUploadInput` / scripture re-exports.

### Where those types live now

| Type family                                                                                | Canonical source                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `SupabasePhoto`, `PhotoWithUrls`, `PhotoUploadInput`                                        | `src/services/photoService.ts`                            |
| `ScriptureSession`, `ScriptureReflection`, `ScriptureBookmark`, `ScriptureMessage`, mode/phase | `src/services/dbSchema.ts`                              |
| `CoupleStats`                                                                               | `src/api/validation/supabaseSchemas.ts` (Zod-inferred)    |
| `SessionRole`, `StateUpdatePayload`, `PendingRetry`                                         | `src/stores/slices/scriptureReadingSlice.ts`              |

Zod-inferred types consumed by UI components must be re-exported through `src/stores/types.ts` (e.g. `export type { CoupleStats } from '../api/validation/supabaseSchemas'`) -- that barrel is the single source of truth. Never import from `supabaseSchemas.ts` directly in a component.
