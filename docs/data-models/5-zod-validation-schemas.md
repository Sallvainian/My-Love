# 5. Zod Validation Schemas

**Sources:**
- `src/validation/schemas.ts` (IndexedDB service boundary validation)
- `src/validation/errorMessages.ts` (error transformation)
- `src/api/validation/supabaseSchemas.ts` (Supabase API response validation)

Both layers import Zod v4 as `zod/v4`.

## 5.1 Local Validation Schemas (`validation/schemas.ts`)

Validate data before IndexedDB writes. Used by `moodService`, `customMessageService`, and `photoStorageService`.

### MessageSchema

Validates existing messages retrieved from IndexedDB.

| Field | Validation | Constraint |
|-------|-----------|------------|
| `id` | `z.number().int().positive().optional()` | Auto-increment |
| `text` | `z.string().min(1).max(MESSAGE_TEXT_MAX_LENGTH)` | From performance config |
| `category` | `z.enum(['reason','memory','affirmation','future','custom'])` | |
| `isCustom` | `z.boolean()` | |
| `active` | `z.boolean().default(true)` | |
| `createdAt` | `z.date()` | |
| `isFavorite` | `z.boolean().optional()` | |
| `updatedAt` | `z.date().optional()` | |
| `tags` | `z.array(z.string()).optional()` | |

**Related:** `CreateMessageInputSchema` (trims text, for creation), `UpdateMessageInputSchema` (requires `id`, for partial updates)

### PhotoSchema

| Field | Validation | Constraint |
|-------|-----------|------------|
| `id` | `z.number().int().positive().optional()` | |
| `imageBlob` | `z.instanceof(Blob)` | |
| `caption` | `z.string().max(500).optional()` | |
| `tags` | `z.array(z.string()).default([])` | |
| `uploadDate` | `z.date()` | |
| `originalSize` | `z.number().positive()` | |
| `compressedSize` | `z.number().positive()` | |
| `width` | `z.number().int().positive()` | |
| `height` | `z.number().int().positive()` | |
| `mimeType` | `z.enum(['image/jpeg','image/png','image/webp'])` | |

### MoodEntrySchema

| Field | Validation | Constraint |
|-------|-----------|------------|
| `date` | `IsoDateStringSchema` | YYYY-MM-DD with actual date validity |
| `mood` | `MoodTypeSchema` | 12 mood types |
| `moods` | `z.array(MoodTypeSchema).min(1).optional()` | Multi-mood support |
| `note` | `z.string().max(200).optional().or(z.literal(''))` | Empty string allowed |

`IsoDateStringSchema` validates both regex format and actual date validity (rejects `2025-02-30`).

### SettingsSchema

Nested validation for all app settings:

```
SettingsSchema
  ├── themeName: enum ['sunset','ocean','lavender','rose']
  ├── notificationTime: HH:MM format with range validation
  ├── relationship
  │   ├── startDate: IsoDateStringSchema
  │   ├── partnerName: string (min 1)
  │   └── anniversaries: array of { id, date, label, description? }
  ├── customization
  │   ├── accentColor: string
  │   └── fontFamily: string
  └── notifications
      ├── enabled: boolean
      └── time: string
```

### CustomMessagesExportSchema

Validates import/export JSON: `version: '1.0'`, `messageCount`, `messages[]` with `text`, `category`, `active`, `tags`, `createdAt`, `updatedAt`.

### Scripture Schemas

| Schema | Table | Key Validations |
|--------|-------|----------------|
| `SupabaseSessionSchema` | `scripture_sessions` | mode enum, phase enum, status enum, version >= 1, step_index >= 0 |
| `SupabaseReflectionSchema` | `scripture_reflections` | rating 1-5, is_shared boolean |
| `SupabaseBookmarkSchema` | `scripture_bookmarks` | share_with_partner boolean |
| `SupabaseMessageSchema` | `scripture_messages` | message string required |

## 5.2 Supabase API Validation Schemas (`api/validation/supabaseSchemas.ts`)

Validate every Supabase API response before the data is used in the application.

### Common Schemas

| Schema | Validation |
|--------|-----------|
| `UUIDSchema` | `z.string().uuid()` |
| `TimestampSchema` | ISO 8601 regex accepting PostgreSQL format variations (microseconds, optional timezone) |
| `MoodTypeSchema` | `z.enum([...12 moods])` |
| `InteractionTypeSchema` | `z.enum(['poke','kiss'])` |
| `MessageCategorySchema` | `z.enum(['reason','memory','affirmation','future','custom'])` |

### Row Schemas

| Schema | Validates | Notable Fields |
|--------|-----------|---------------|
| `SupabaseUserSchema` | `users` rows | `partner_id` nullable+optional, `email`/`display_name` nullable+optional |
| `SupabaseMoodSchema` | `moods` rows | `mood_type` (single), `mood_types` (array, nullable+optional) |
| `SupabaseInteractionSchema` | `interactions` rows | `viewed` nullable boolean |
| `SupabaseMessageSchema` | Messages (placeholder) | `text` 1-500, `category`, `is_custom`, `active` |
| `SupabasePhotoSchema` | Photos (placeholder) | `mime_type` enum, positive dimensions |

### Insert/Update Schema Variants

Each entity schema has corresponding Insert and Update variants with relaxed requirements:

| Pattern | Insert | Update |
|---------|--------|--------|
| `id` | Optional | Optional |
| Required fields | Required | Optional |
| Timestamps | Optional | Optional |

Examples: `MoodInsertSchema`, `MoodUpdateSchema`, `UserInsertSchema`, `UserUpdateSchema`, `InteractionInsertSchema`, `InteractionUpdateSchema`

### Array Schemas

```typescript
MoodArraySchema = z.array(SupabaseMoodSchema)
InteractionArraySchema = z.array(SupabaseInteractionSchema)
UserArraySchema = z.array(SupabaseUserSchema)
```

### Exported Types

All schemas export inferred TypeScript types via `z.infer<typeof Schema>`:
- `SupabaseUser`, `SupabaseMood`, `SupabaseInteraction`, `SupabaseMessage`, `SupabasePhoto`
- `UserInsert`, `UserUpdate`, `MoodInsert`, `MoodUpdate`, `InteractionInsert`, `InteractionUpdate`

## 5.3 Error Transformation (`validation/errorMessages.ts`)

### ValidationError Class

```typescript
class ValidationError extends Error {
  public readonly fieldErrors: Map<string, string>;
}
```

### Key Functions

| Function | Input | Output |
|----------|-------|--------|
| `formatZodError(error)` | `ZodError` | Comma-separated user-friendly message string |
| `getFieldErrors(error)` | `ZodError` | `Map<string, string>` of field path to first error |
| `createValidationError(error)` | `ZodError` | `ValidationError` (combines both above) |
| `isValidationError(error)` | `unknown` | Type guard for `ValidationError` |
| `isZodError(error)` | `unknown` | Type guard for `ZodError` |

### Field Name Mapping

Technical field paths are mapped to display names: `text` -> `"Message"`, `imageBlob` -> `"Image"`, `mimeType` -> `"File type"`, `relationship.startDate` -> `"Relationship start date"`, etc.
