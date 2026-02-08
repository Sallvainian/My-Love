# 8. Validation Schemas

The application uses Zod for runtime validation at two boundaries: IndexedDB writes (local) and Supabase API responses (remote).

## 8.1 Local Validation Schemas (`validation/schemas.ts`)

| Schema | Validates | Key Rules |
|---|---|---|
| `MessageSchema` | Message records | text: 1..MAX_LENGTH chars, valid category |
| `CreateMessageInputSchema` | New message input | text trimmed, 1..MAX_LENGTH chars |
| `UpdateMessageInputSchema` | Message update | id required, all other fields optional |
| `PhotoSchema` | Photo records | Blob instance, valid MIME, positive dimensions |
| `PhotoUploadInputSchema` | Upload input | File instance, caption max 500 chars |
| `MoodEntrySchema` | Mood entries | Valid ISO date (YYYY-MM-DD), valid mood type, note max 200 chars |
| `SettingsSchema` | App settings | Valid theme, HH:MM time format, partner name required |
| `CustomMessagesExportSchema` | Import/export | Version `'1.0'`, message array with required fields |
| `SupabaseSessionSchema` | Scripture session rows | UUID ids, valid enums, int step index >= 0 |
| `SupabaseReflectionSchema` | Scripture reflection rows | Rating 1-5, UUID refs |
| `SupabaseBookmarkSchema` | Scripture bookmark rows | UUID refs, boolean share flag |
| `SupabaseMessageSchema` | Scripture message rows | UUID refs, non-empty message |

## 8.2 Supabase API Validation Schemas (`api/validation/supabaseSchemas.ts`)

| Schema | Table | Variants |
|---|---|---|
| `SupabaseUserSchema` | `users` | Row, Insert, Update |
| `SupabaseMoodSchema` | `moods` | Row, Insert, Update |
| `SupabaseInteractionSchema` | `interactions` | Row, Insert, Update |
| `SupabasePhotoSchema` | `photos` | Row only (placeholder) |
| `SupabaseMessageSchema` | future messages table | Row only (placeholder) |

**Array schemas** for batch validation: `MoodArraySchema`, `InteractionArraySchema`, `UserArraySchema`.

**Common sub-schemas:**

| Schema | Description |
|---|---|
| `UUIDSchema` | `z.string().uuid()` |
| `TimestampSchema` | Accepts various ISO 8601/PostgreSQL timestamp formats |
| `MoodTypeSchema` | Enum of 12 valid mood values |
| `InteractionTypeSchema` | `'poke' \| 'kiss'` |

---
