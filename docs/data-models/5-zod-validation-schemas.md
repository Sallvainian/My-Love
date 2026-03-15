# 5. Zod Validation Schemas

**Sources:**
- `src/validation/schemas.ts` -- App-level schemas (IndexedDB boundaries)
- `src/api/validation/supabaseSchemas.ts` -- Supabase API response schemas

All schemas use Zod v4 (`zod/v4`).

## App-Level Schemas

### MessageSchema
```typescript
z.object({
  id: z.number().int().positive().optional(),
  text: z.string().min(1).max(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH),
  category: z.enum(['reason', 'memory', 'affirmation', 'future', 'custom']),
  isCustom: z.boolean(),
  active: z.boolean().default(true),
  createdAt: z.date(),
  isFavorite: z.boolean().optional(),
  updatedAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
})
```

### MoodEntrySchema
```typescript
z.object({
  date: IsoDateStringSchema,  // YYYY-MM-DD with validation
  mood: MoodTypeSchema,       // 12-value enum
  moods: z.array(MoodTypeSchema).min(1).optional(),
  note: z.string().max(200).optional().or(z.literal('')),
})
```

### PhotoSchema
```typescript
z.object({
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
})
```

### SettingsSchema
Nested object with `themeName`, `notificationTime` (HH:MM), `relationship` (startDate, partnerName, anniversaries[]), `customization`, `notifications`.

### Scripture Schemas (in `validation/schemas.ts`)

**SupabaseSessionSchema**: session row with mode, phase, status, version, snapshot_json, etc.

**SupabaseReflectionSchema**: session_id, step_index, user_id, rating (1-5), notes, is_shared

**SupabaseBookmarkSchema**: session_id, step_index, user_id, share_with_partner

**SupabaseMessageSchema**: session_id, sender_id, message, created_at

## Supabase API Schemas

### SupabaseMoodSchema
```typescript
z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  mood_type: MoodTypeSchema,
  mood_types: z.array(MoodTypeSchema).nullable().optional(),
  note: z.string().nullable(),
  created_at: TimestampSchema.nullable(),
  updated_at: TimestampSchema.nullable(),
})
```

### SupabaseUserSchema
id, partner_name, device_id, created_at, updated_at, partner_id, email, display_name

### SupabaseInteractionSchema
id, type (poke/kiss), from_user_id, to_user_id, viewed, created_at

### CoupleStatsSchema
```typescript
z.object({
  totalSessions: z.number().int().min(0),
  totalSteps: z.number().int().min(0),
  lastCompleted: TimestampSchema.nullable(),
  avgRating: z.number().min(0).max(5),
  bookmarkCount: z.number().int().min(0),
})
```

### Array Schemas
`MoodArraySchema`, `InteractionArraySchema`, `UserArraySchema`

## Common Schemas

**UUIDSchema**: `z.string().uuid()`

**TimestampSchema**: ISO 8601 format validation via regex, accepts microseconds, various timezone formats.

## Export/Import Schema

**CustomMessagesExportSchema**: version '1.0', exportDate, messageCount, messages array
