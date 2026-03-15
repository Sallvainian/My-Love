# 10. Validation Layer

**Sources:**
- `src/validation/schemas.ts` -- App-level Zod schemas (IndexedDB boundaries)
- `src/validation/errorMessages.ts` -- Error formatting and ValidationError class
- `src/validation/index.ts` -- Centralized exports
- `src/api/validation/supabaseSchemas.ts` -- Supabase API response schemas

## App-Level Schemas (`src/validation/schemas.ts`)

### Message Schemas

**`MessageSchema`** -- Full message validation:
- `text`: string, 1-500 chars (from `VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH`)
- `category`: enum `reason | memory | affirmation | future | custom`
- `isCustom`: boolean; `active`: boolean (default true); `isFavorite`: optional boolean
- `createdAt`: Date; `updatedAt`: optional Date; `tags`: optional string[]

**`CreateMessageInputSchema`** -- Input for new messages (text is trimmed)

**`UpdateMessageInputSchema`** -- Partial update with required `id: number`

### Photo Schema

**`PhotoSchema`**: `imageBlob` (Blob), `caption` (max 500), `tags` (string[]), `uploadDate` (Date), `originalSize`/`compressedSize` (positive numbers), `width`/`height` (positive ints), `mimeType` (jpeg/png/webp)

**`PhotoUploadInputSchema`**: `file` (File), optional `caption`, optional `tags` (comma-separated string)

### Mood Schema

**`MoodEntrySchema`**: `date` (YYYY-MM-DD with validation), `mood` (12-value enum), `moods` (optional array, min 1), `note` (max 200 chars or empty string)

Mood types: `loved | happy | content | excited | thoughtful | grateful | sad | anxious | frustrated | angry | lonely | tired`

### Settings Schema

**`SettingsSchema`**: `themeName` (sunset/ocean/lavender/rose), `notificationTime` (HH:MM), nested `relationship` (startDate, partnerName, anniversaries[]), `customization` (accentColor, fontFamily), `notifications` (enabled, time)

### Scripture Schemas

**`SupabaseSessionSchema`**, **`SupabaseReflectionSchema`**, **`SupabaseBookmarkSchema`**, **`SupabaseMessageSchema`** -- validate RPC responses at service boundary.

### Export Schema

**`CustomMessagesExportSchema`**: version `'1.0'`, exportDate, messageCount, messages array with createdAt/updatedAt as strings.

## Supabase API Schemas (`src/api/validation/supabaseSchemas.ts`)

### Core Schemas

**`SupabaseUserSchema`**, **`SupabaseMoodSchema`**, **`SupabaseInteractionSchema`**, **`SupabasePhotoSchema`**, **`SupabaseMessageSchema`** (not yet active)

### Array Schemas

`MoodArraySchema`, `InteractionArraySchema`, `UserArraySchema`

### Stats Schema

**`CoupleStatsSchema`**: `totalSessions`, `totalSteps`, `lastCompleted` (nullable timestamp), `avgRating` (0-5), `bookmarkCount`

## Error Formatting (`src/validation/errorMessages.ts`)

### `ValidationError` class
```typescript
class ValidationError extends Error {
  readonly fieldErrors: Map<string, string>;
}
```

### `formatZodError(error: ZodError): string`
Formats issues into comma-separated user-friendly message. Maps field paths to display names via `FIELD_NAME_MAP`.

### `getFieldErrors(error: ZodError): Map<string, string>`
Returns per-field error messages (first error per field).

### `createValidationError(error: ZodError): ValidationError`
Convenience wrapper combining `formatZodError` + `getFieldErrors`.

### Type Guards
- `isValidationError(error): error is ValidationError`
- `isZodError(error): error is ZodError`
