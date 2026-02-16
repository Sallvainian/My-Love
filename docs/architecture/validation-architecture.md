# Validation Architecture

## Overview

The app uses **Zod 4.3.6** (imported via `zod/v4`) for runtime validation at service boundaries. Validation complements TypeScript's compile-time type checking by catching data corruption from localStorage hydration, IndexedDB reads, and Supabase API responses.

## Zod Version Note

The project uses the `zod/v4` import path, which is Zod 4's recommended import:

```typescript
import { z } from 'zod/v4';
```

## Schema Definitions (`src/validation/schemas.ts`)

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

### Photo Schema

```typescript
const PhotoMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

export const PhotoSchema = z.object({
  id: z.number().int().positive().optional(),
  imageBlob: z.instanceof(Blob, { message: 'Image must be a valid Blob' }),
  caption: z.string().max(500).optional(),
  tags: z.array(z.string()).default([]),
  uploadDate: z.date(),
  originalSize: z.number().positive(),
  compressedSize: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: PhotoMimeTypeSchema,
});

export const PhotoUploadInputSchema = z.object({
  file: z.instanceof(File, { message: 'Must provide a valid file' }),
  caption: z.string().max(500).optional(),
  tags: z.string().optional(),
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
  customization: z.object({ accentColor: z.string(), fontFamily: z.string() }),
  notifications: z.object({ enabled: z.boolean(), time: z.string() }),
});
```

### Scripture Schemas (Supabase Response Validation)

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

export const SupabaseReflectionSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  step_index: z.number().int().min(0),
  user_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  is_shared: z.boolean(),
  created_at: z.string(),
});

export const SupabaseBookmarkSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  step_index: z.number().int().min(0),
  user_id: z.string().uuid(),
  share_with_partner: z.boolean(),
  created_at: z.string(),
});

export const SupabaseMessageSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  message: z.string(),
  created_at: z.string(),
});
```

### Export Schema

```typescript
export const CustomMessagesExportSchema = z.object({
  version: z.literal('1.0'),
  exportDate: z.string(),
  messageCount: z.number().int().nonnegative(),
  messages: z.array(z.object({
    text: z.string().min(1).max(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH),
    category: MessageCategorySchema,
    active: z.boolean(),
    tags: z.array(z.string()).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});
```

## Validation Boundaries

| Boundary | Schema Used | Direction |
|---|---|---|
| IndexedDB message write | `CreateMessageInputSchema` | App -> IndexedDB |
| IndexedDB message read | `MessageSchema` | IndexedDB -> App |
| Settings update | `SettingsSchema` | App -> localStorage |
| Mood creation | `MoodEntrySchema` | App -> IndexedDB |
| Photo upload | `PhotoUploadInputSchema` | User input -> App |
| Supabase session read | `SupabaseSessionSchema` | Supabase -> App |
| Supabase reflection read | `SupabaseReflectionSchema` | Supabase -> App |
| Message import | `CustomMessagesExportSchema` | File -> App |

## Pre-Hydration Validation (`useAppStore.ts`)

The Zustand persist middleware includes a custom storage wrapper that validates state before hydration:

```typescript
storage: createJSONStorage(() => ({
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;

    const data = JSON.parse(str);
    const validation = validateHydratedState(data.state);
    if (!validation.isValid) {
      localStorage.removeItem(name);
      return null; // Use initial state defaults
    }
    return str;
  },
})),
```

The `validateHydratedState` function checks:
- `settings.themeName` exists
- `settings.relationship` exists
- `messageHistory.shownMessages` is an Array or Map
- `messageHistory.currentIndex` is a number

Only critical structural errors (wrong types) trigger state reset. Missing fields use defaults.

## Supabase API Validation (`src/api/validation/supabaseSchemas.ts`)

Additional Zod schemas validate raw Supabase query responses before they enter the application layer. This catches schema drift between the database and the TypeScript types.

## Error Messages (`src/validation/errorMessages.ts`)

Converts Zod validation errors to user-friendly messages for display in the UI.

## Validation Limits (`src/config/performance.ts`)

```typescript
export const VALIDATION_LIMITS = {
  MESSAGE_TEXT_MAX_LENGTH: 1000,
  CAPTION_MAX_LENGTH: 500,
  NOTE_MAX_LENGTH: 200,
};
```

These constants are shared between Zod schemas and UI input components to ensure consistent enforcement.
