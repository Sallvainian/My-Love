# 10. Validation Layer

**Sources:**
- `src/api/validation/supabaseSchemas.ts` (Supabase API response validation)
- `src/validation/schemas.ts` (IndexedDB service boundary validation)
- `src/validation/errorMessages.ts` (user-friendly error transformation)

## Overview

The app uses two layers of Zod validation at different boundaries:

| Layer | Source | Purpose | Import Path |
|-------|--------|---------|-------------|
| **API validation** | `src/api/validation/supabaseSchemas.ts` | Validates Supabase responses before use | `zod/v4` |
| **Service validation** | `src/validation/schemas.ts` | Validates data before IndexedDB writes | `zod/v4` |

Both layers use Zod v4 imported as `zod/v4`.

## API Validation Schemas (supabaseSchemas.ts)

Validates every response from Supabase to ensure type safety at the API boundary. Used by `moodApi.ts` and other API services.

### Common Schemas

```typescript
// UUID validation for Supabase record IDs
const UUIDSchema = z.string().uuid('Invalid UUID format');

// ISO 8601 timestamp validation (accepts PostgreSQL format variations)
const TimestampSchema = z.string().refine(
  (val) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/.test(val),
  { message: 'Invalid timestamp format' }
);
```

The `TimestampSchema` accepts various PostgreSQL/ISO 8601 formats including microseconds, no timezone, UTC `Z`, and timezone offsets with or without colons.

### Entity Schemas

#### SupabaseUserSchema

```typescript
export const SupabaseUserSchema = z.object({
  id: UUIDSchema,
  partner_name: z.string().nullable(),
  device_id: z.string().uuid().nullable(),
  created_at: TimestampSchema.nullable(),
  updated_at: TimestampSchema.nullable(),
  partner_id: UUIDSchema.nullable().optional(),
  email: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
});
```

#### SupabaseMoodSchema

```typescript
export const SupabaseMoodSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  mood_type: MoodTypeSchema,              // Legacy single mood
  mood_types: z.array(MoodTypeSchema).nullable().optional(), // Multi-mood support
  note: z.string().nullable(),
  created_at: TimestampSchema.nullable(),
  updated_at: TimestampSchema.nullable(),
});
```

Mood types: `'loved' | 'happy' | 'content' | 'excited' | 'thoughtful' | 'grateful' | 'sad' | 'anxious' | 'frustrated' | 'angry' | 'lonely' | 'tired'`

#### SupabaseInteractionSchema

```typescript
export const SupabaseInteractionSchema = z.object({
  id: UUIDSchema,
  type: z.enum(['poke', 'kiss']),
  from_user_id: UUIDSchema,
  to_user_id: UUIDSchema,
  viewed: z.boolean().nullable(),
  created_at: TimestampSchema.nullable(),
});
```

### Insert/Update Schemas

Each entity has corresponding `InsertSchema` and `UpdateSchema` variants with relaxed requirements (optional fields, no `id` required).

| Schema | Purpose |
|--------|---------|
| `MoodInsertSchema` | Validates mood data before `moodApi.create()` |
| `MoodUpdateSchema` | Validates partial updates before `moodApi.update()` |
| `UserInsertSchema` | Validates user registration data |
| `UserUpdateSchema` | Validates user profile updates |
| `InteractionInsertSchema` | Validates interaction creation data |
| `InteractionUpdateSchema` | Validates interaction updates |

### Array Schemas

```typescript
export const MoodArraySchema = z.array(SupabaseMoodSchema);
export const InteractionArraySchema = z.array(SupabaseInteractionSchema);
export const UserArraySchema = z.array(SupabaseUserSchema);
```

Used by `moodApi.fetchByUser()` and similar methods that return arrays.

### Exported Types

All schemas export inferred TypeScript types:

```typescript
export type SupabaseUser = z.infer<typeof SupabaseUserSchema>;
export type SupabaseMood = z.infer<typeof SupabaseMoodSchema>;
export type SupabaseInteraction = z.infer<typeof SupabaseInteractionSchema>;
export type MoodInsert = z.infer<typeof MoodInsertSchema>;
export type MoodUpdate = z.infer<typeof MoodUpdateSchema>;
// ... etc.
```

### Scripture Schemas

Defined in `src/validation/schemas.ts` (not in `supabaseSchemas.ts`):

| Schema | Fields |
|--------|--------|
| `SupabaseSessionSchema` | `id`, `mode`, `user1_id`, `user2_id`, `current_phase`, `current_step_index`, `status`, `version`, `snapshot_json`, `started_at`, `completed_at` |
| `SupabaseReflectionSchema` | `id`, `session_id`, `step_index`, `user_id`, `rating` (1-5), `notes`, `is_shared`, `created_at` |
| `SupabaseBookmarkSchema` | `id`, `session_id`, `step_index`, `user_id`, `share_with_partner`, `created_at` |
| `SupabaseMessageSchema` | `id`, `session_id`, `sender_id`, `message`, `created_at` |

## Service Validation Schemas (schemas.ts)

Validates data at IndexedDB service boundaries to prevent data corruption.

### MessageSchema

```typescript
export const MessageSchema = z.object({
  id: z.number().int().positive().optional(),
  text: z.string().min(1).max(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH),
  category: z.enum(['reason', 'memory', 'affirmation', 'future', 'custom']),
  isCustom: z.boolean(),
  active: z.boolean().default(true),
  createdAt: z.date(),
  isFavorite: z.boolean().optional(),
  updatedAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
});
```

Also: `CreateMessageInputSchema` (for creation with `.trim()`), `UpdateMessageInputSchema` (partial update with required `id`).

### PhotoSchema

```typescript
export const PhotoSchema = z.object({
  id: z.number().int().positive().optional(),
  imageBlob: z.instanceof(Blob),
  caption: z.string().max(500).optional(),
  tags: z.array(z.string()).default([]),
  uploadDate: z.date(),
  originalSize: z.number().positive(),
  compressedSize: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
```

### MoodEntrySchema

```typescript
export const MoodEntrySchema = z.object({
  date: IsoDateStringSchema,  // YYYY-MM-DD with actual date validation
  mood: MoodTypeSchema,       // Same 12 mood types as API schema
  moods: z.array(MoodTypeSchema).min(1).optional(),
  note: z.string().max(200).optional().or(z.literal('')),
});
```

The `IsoDateStringSchema` validates both format (`/^\d{4}-\d{2}-\d{2}$/`) and actual date validity (e.g., rejects `2025-02-30`).

### SettingsSchema

```typescript
export const SettingsSchema = z.object({
  themeName: z.enum(['sunset', 'ocean', 'lavender', 'rose']),
  notificationTime: TimeFormatSchema,  // HH:MM with range validation
  relationship: z.object({
    startDate: IsoDateStringSchema,
    partnerName: z.string().min(1),
    anniversaries: z.array(AnniversarySchema),
  }),
  customization: z.object({ accentColor: z.string(), fontFamily: z.string() }),
  notifications: z.object({ enabled: z.boolean(), time: z.string() }),
});
```

### CustomMessagesExportSchema

Validates import/export JSON format with `version: '1.0'`, `messageCount`, and array of message objects.

## Error Message Transformation (errorMessages.ts)

Converts Zod validation errors into user-friendly messages for UI display.

### ValidationError Class

```typescript
class ValidationError extends Error {
  public readonly fieldErrors: Map<string, string>;
  constructor(message: string, fieldErrors?: Map<string, string>);
}
```

### Field Name Mapping

Technical field paths are mapped to user-friendly names:

| Technical Path | Display Name |
|---------------|-------------|
| `text` | Message |
| `imageBlob` | Image |
| `mimeType` | File type |
| `relationship.startDate` | Relationship start date |
| `relationship.partnerName` | Partner name |
| `date` | Date |
| `mood` | Mood |
| `note` | Note |

### Functions

#### `formatZodError(error: ZodError): string`

Formats all issues into a comma-separated string. Handles common error types:
- `too_small`: `"{Field} cannot be empty"` or `"{Field} must be at least N characters"`
- `too_big`: `"{Field} cannot exceed N characters"`
- `invalid_value`: `"Invalid {field}. Please select a valid option."`
- `invalid_type`: `"{Field} must be a valid date"` or `"{Field} has an invalid value"`

#### `getFieldErrors(error: ZodError): Map<string, string>`

Returns a Map of field path to error message. Only stores the first error per field.

#### `createValidationError(error: ZodError): ValidationError`

Convenience function combining `formatZodError` and `getFieldErrors` into a single `ValidationError` instance. This is the primary function called by services.

### Type Guards

```typescript
function isValidationError(error: unknown): error is ValidationError
function isZodError(error: unknown): error is ZodError
```
