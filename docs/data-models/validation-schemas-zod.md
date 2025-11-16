# Validation Schemas (Zod)

## Input Validation

```typescript
// src/validation/schemas.ts

import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .min(1, 'Display name is required')
  .max(50, 'Display name must be 50 characters or less')
  .trim();

export const messageSchema = z.object({
  text: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message must be 500 characters or less'),
  author: z.string().max(100).default('Anonymous'),
  date: z.string().optional(),
});

export const moodEntrySchema = z.object({
  moods: z
    .array(
      z.enum([
        'happy',
        'content',
        'excited',
        'loved',
        'grateful',
        'peaceful',
        'sad',
        'anxious',
        'frustrated',
        'tired',
        'stressed',
        'lonely',
      ])
    )
    .min(1, 'Select at least one mood'),
  intensity: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export const anniversarySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().datetime(),
  isRecurring: z.boolean().default(true),
  reminderDays: z.number().int().min(0).max(365).default(7),
});

export const photoMetadataSchema = z.object({
  caption: z.string().max(200),
  dateTaken: z.string().datetime(),
});
```

## API Response Validation

```typescript
// src/api/validation/supabaseSchemas.ts

export const supabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string().datetime(),
});

export const supabaseProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  partner_id: z.string().uuid().nullable(),
  pairing_code: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const supabaseMoodEntrySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  moods: z.array(z.string()),
  intensity: z.number(),
  note: z.string().nullable(),
  timestamp: z.string().datetime(),
});
```
