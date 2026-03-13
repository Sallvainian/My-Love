# 10. Validation Layer

**Sources:**

- `src/validation/schemas.ts` -- Client-side Zod schemas for IndexedDB writes
- `src/api/validation/supabaseSchemas.ts` -- API response Zod schemas for Supabase data
- `src/validation/errorMessages.ts` -- Error transformation utilities

## Architecture

Validation occurs at two boundaries:

1. **Service boundary** (before IndexedDB writes): `src/validation/schemas.ts` schemas validate user input before local storage.
2. **API boundary** (after Supabase reads): `src/api/validation/supabaseSchemas.ts` schemas validate server responses before use in the application.

Both use Zod v4 (`zod/v4`).

## Client-Side Schemas (`src/validation/schemas.ts`)

### MessageSchema

Validates existing messages from IndexedDB.

| Field        | Type       | Constraints                                                |
| ------------ | ---------- | ---------------------------------------------------------- |
| `id`         | `number`   | Optional, positive integer                                 |
| `text`       | `string`   | 1-1000 chars (`VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH`) |
| `category`   | `enum`     | `reason`, `memory`, `affirmation`, `future`, `custom`      |
| `isCustom`   | `boolean`  | Required                                                   |
| `active`     | `boolean`  | Default: `true`                                            |
| `createdAt`  | `Date`     | Required                                                   |
| `isFavorite` | `boolean`  | Optional                                                   |
| `updatedAt`  | `Date`     | Optional                                                   |
| `tags`       | `string[]` | Optional                                                   |

### CreateMessageInputSchema

For new message creation. `text` is trimmed. `active` defaults to `true`.

### UpdateMessageInputSchema

For partial updates. Requires `id` (positive integer). All other fields optional.

### PhotoSchema

| Field            | Type       | Constraints                             |
| ---------------- | ---------- | --------------------------------------- |
| `id`             | `number`   | Optional, positive integer              |
| `imageBlob`      | `Blob`     | `instanceof Blob` check                 |
| `caption`        | `string`   | Max 500 chars, optional                 |
| `tags`           | `string[]` | Default: `[]`                           |
| `uploadDate`     | `Date`     | Required                                |
| `originalSize`   | `number`   | Positive                                |
| `compressedSize` | `number`   | Positive                                |
| `width`          | `number`   | Positive integer                        |
| `height`         | `number`   | Positive integer                        |
| `mimeType`       | `enum`     | `image/jpeg`, `image/png`, `image/webp` |

### PhotoUploadInputSchema

For file upload form data. `file` must be `instanceof File`. `tags` is a comma-separated string (parsed to array).

### MoodEntrySchema

| Field   | Type         | Constraints                                   |
| ------- | ------------ | --------------------------------------------- |
| `date`  | `string`     | ISO format YYYY-MM-DD, validated as real date |
| `mood`  | `enum`       | 12 mood types (loved, happy, content, etc.)   |
| `moods` | `MoodType[]` | Min 1 element, optional                       |
| `note`  | `string`     | Max 200 chars, optional (allows empty string) |

### SettingsSchema

Nested object validating theme, notifications, relationship, and customization settings. Includes `ThemeNameSchema` (`sunset`, `ocean`, `lavender`, `rose`), `TimeFormatSchema` (HH:MM with range validation), `IsoDateStringSchema`, and `AnniversarySchema`.

### CustomMessagesExportSchema

Validates import/export data structure: `version: '1.0'`, `exportDate`, `messageCount`, `messages[]`.

### Scripture Schemas

- `SupabaseSessionSchema` -- Validates session rows from RPCs
- `SupabaseReflectionSchema` -- Validates reflection rows
- `SupabaseBookmarkSchema` -- Validates bookmark rows
- `SupabaseMessageSchema` -- Validates message rows

## API Response Schemas (`src/api/validation/supabaseSchemas.ts`)

### Common Base Schemas

- `UUIDSchema` -- `z.string().uuid()`
- `TimestampSchema` -- Regex-validated ISO 8601 format supporting microseconds, optional timezone

### Entity Schemas

| Schema                      | Key Fields                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `SupabaseUserSchema`        | `id`, `partner_name`, `device_id`, `partner_id?`, `email?`, `display_name?`             |
| `SupabaseMoodSchema`        | `id`, `user_id`, `mood_type` (enum), `mood_types` (array, nullable), `note`, timestamps |
| `SupabaseInteractionSchema` | `id`, `type` (poke/kiss), `from_user_id`, `to_user_id`, `viewed`, `created_at`          |
| `SupabaseMessageSchema`     | `id`, `user_id`, `text`, `category`, `is_custom`, `active`, `tags`, timestamps          |
| `SupabasePhotoSchema`       | `id`, `user_id`, `storage_path`, `caption`, `tags`, dimensions, `mime_type`, timestamps |
| `CoupleStatsSchema`         | `totalSessions`, `totalSteps`, `lastCompleted`, `avgRating`, `bookmarkCount`            |

### Insert/Update Schemas

Each entity has corresponding `*InsertSchema` and `*UpdateSchema` with optional fields for partial updates.

### Array Schemas

- `MoodArraySchema` -- `z.array(SupabaseMoodSchema)`
- `InteractionArraySchema` -- `z.array(SupabaseInteractionSchema)`
- `UserArraySchema` -- `z.array(SupabaseUserSchema)`

### Inferred Types

All schemas export inferred TypeScript types via `z.infer<typeof Schema>`:
`SupabaseUser`, `SupabaseMood`, `SupabaseInteraction`, `MoodInsert`, `MoodUpdate`, `CoupleStats`, etc.

## Error Utilities (`src/validation/errorMessages.ts`)

### `ValidationError` Class

```typescript
class ValidationError extends Error {
  readonly fieldErrors: Map<string, string>;
}
```

Custom error class for validation failures. `fieldErrors` maps field paths to user-friendly messages.

### Functions

#### `formatZodError(error: ZodError): string`

Transforms all Zod issues into a single comma-separated string of user-friendly messages.

**Field name mapping:** Technical paths (e.g., `text`, `mimeType`, `relationship.partnerName`) are mapped to display names (e.g., `Message`, `File type`, `Partner name`) via `FIELD_NAME_MAP`.

**Issue type handling:**

- `too_small` with min=1: "{Field} cannot be empty"
- `too_big`: "{Field} cannot exceed {max} characters"
- `invalid_value`: "Invalid {field}. Please select a valid option."
- `invalid_type` (date): "{Field} must be a valid date"

#### `getFieldErrors(error: ZodError): Map<string, string>`

Returns a Map of field paths to error messages. Only stores the first error per field.

#### `createValidationError(error: ZodError): ValidationError`

Convenience: creates a `ValidationError` from a `ZodError` with both message string and field errors map.

### Type Guards

- `isValidationError(error): error is ValidationError` -- `instanceof` check
- `isZodError(error): error is ZodError` -- `instanceof` check
