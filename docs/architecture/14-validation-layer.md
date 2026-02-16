# Validation Layer

## Architecture

Runtime validation uses Zod v4 schemas at service boundaries, complementing TypeScript's compile-time type checking. The validation layer is organized into three files:

| File | Purpose |
|------|---------|
| `src/validation/schemas.ts` | Zod schema definitions for all data models |
| `src/validation/errorMessages.ts` | Error transformation and user-friendly messages |
| `src/validation/index.ts` | Barrel exports for the validation module |

## Schema Definitions (`schemas.ts`)

### Message Schemas

```typescript
const MessageCategorySchema = z.enum(['reason', 'memory', 'affirmation', 'future', 'custom']);

export const MessageSchema = z.object({
  id: z.number().int().positive().optional(),
  text: z.string().min(1).max(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH),
  category: MessageCategorySchema,
  isCustom: z.boolean(),
  active: z.boolean().default(true),
  createdAt: z.date(),
  isFavorite: z.boolean().optional(),
  updatedAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
});

export const CreateMessageInputSchema = z.object({
  text: z.string().trim().min(1).max(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH),
  category: MessageCategorySchema,
  active: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

export const UpdateMessageInputSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().trim().min(1).max(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH).optional(),
  category: MessageCategorySchema.optional(),
  active: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});
```

### Photo Schemas

```typescript
const PhotoMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

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
  mimeType: PhotoMimeTypeSchema,
});
```

### Mood Schema

```typescript
const MoodTypeSchema = z.enum([
  'loved', 'happy', 'content', 'excited', 'thoughtful', 'grateful',
  'sad', 'anxious', 'frustrated', 'angry', 'lonely', 'tired',
]);

const IsoDateStringSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO format (YYYY-MM-DD)')
  .refine((date) => {
    const [_year, month, day] = date.split('-').map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const dateObj = new Date(date);
    return dateObj.toISOString().startsWith(date);
  }, 'Invalid date values');

export const MoodEntrySchema = z.object({
  date: IsoDateStringSchema,
  mood: MoodTypeSchema,
  moods: z.array(MoodTypeSchema).min(1).optional(),
  note: z.string().max(200).optional().or(z.literal('')),
});
```

### Settings Schema

```typescript
const ThemeNameSchema = z.enum(['sunset', 'ocean', 'lavender', 'rose']);

const TimeFormatSchema = z.string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
  .refine((time) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }, 'Invalid time values');

export const SettingsSchema = z.object({
  themeName: ThemeNameSchema,
  notificationTime: TimeFormatSchema,
  relationship: z.object({
    startDate: IsoDateStringSchema,
    partnerName: z.string().min(1),
    anniversaries: z.array(AnniversarySchema),
  }),
  customization: z.object({
    accentColor: z.string(),
    fontFamily: z.string(),
  }),
  notifications: z.object({
    enabled: z.boolean(),
    time: z.string(),
  }),
});
```

### Scripture Schemas

```typescript
export const SupabaseSessionSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(['solo', 'together']),
  user1_id: z.string().uuid(),
  user2_id: z.string().uuid().nullable(),
  current_phase: z.enum(['lobby', 'countdown', 'reading', 'reflection', 'report', 'complete']),
  current_step_index: z.number().int().min(0),
  status: z.enum(['pending', 'in_progress', 'complete', 'abandoned']),
  version: z.number().int().min(1),
  snapshot_json: z.record(z.string(), z.unknown()).nullable().optional(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});
```

## Error Transformation (`errorMessages.ts`)

### ValidationError Class

```typescript
export class ValidationError extends Error {
  public readonly fieldErrors: Map<string, string>;
  constructor(message: string, fieldErrors?: Map<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors || new Map();
  }
}
```

### Field Name Mapping

Technical field paths are mapped to user-friendly names:

```typescript
const FIELD_NAME_MAP: Record<string, string> = {
  text: 'Message',
  category: 'Category',
  mood: 'Mood',
  themeName: 'Theme',
  'relationship.startDate': 'Relationship start date',
  'relationship.partnerName': 'Partner name',
  // ... 20+ mappings
};
```

### Error Formatting

`formatZodError()` converts Zod issues to a single string:

- 1 error: Returns the error message directly
- Multiple errors: Joins messages with commas

`getFieldErrors()` returns a `Map<string, string>` for per-field error display in forms.

### Issue-Type Handling

The `formatIssue()` function handles specific Zod issue codes:

| Code | Handling |
|------|----------|
| `too_small` | "Field cannot be empty" or "Field must be at least N characters" |
| `too_big` | "Field cannot exceed N characters" |
| `invalid_value` | "Invalid field. Please select a valid option." |
| `invalid_type` | "Field must be a valid date" or "Field has an invalid value" |
| default | Uses schema-provided message or "Field is required" |

## Usage Patterns

### In Zustand Slices (Settings)

```typescript
// src/stores/slices/settingsSlice.ts
setSettings: (settings) => {
  try {
    const validated = SettingsSchema.parse(settings);
    set({ settings: validated });
  } catch (error) {
    if (isZodError(error)) {
      throw createValidationError(error as ZodError);
    }
    throw error;
  }
},
```

### In Services (Mood)

```typescript
// src/services/moodService.ts
async create(userId, moods, note) {
  const validatedEntry = MoodEntrySchema.parse({
    date: today,
    mood: moods[0],
    moods,
    note: note || '',
  });
  return await this.add({ ...validatedEntry, userId, synced: false });
}
```

## Validation Limits

Defined in `src/config/performance.ts`:

```typescript
export const VALIDATION_LIMITS = {
  MESSAGE_TEXT_MAX_LENGTH: 500,
  // ... other limits
};
```

## Related Documentation

- [Security Model](./13-security-model.md)
- [Data Architecture](./04-data-architecture.md)
- [Error Handling](./17-error-handling.md)
