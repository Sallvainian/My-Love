# API Reference

> Complete API layer documentation for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Overview

The API layer uses Supabase as Backend-as-a-Service, with services organized by domain. All Supabase responses are validated at service boundaries using Zod v4 schemas. Error handling follows a consistent pattern with typed error classes.

## Authentication

**Supabase Auth** (`src/api/authService.ts`):
- JWT-based with session in localStorage
- RLS policies verify `auth.uid()`
- Edge Function validates JWT in Authorization header
- Service Worker stores auth token in IndexedDB (`sw-auth` store) for Background Sync

**Key Methods**:
- `getCurrentUserId()` — Returns current authenticated user ID
- `getCurrentUserIdOfflineSafe()` — Returns user ID with offline fallback
- `getSession()` — Gets current session from Supabase
- `signIn(email, password)` — Email/password login
- `signInWithGoogle()` — OAuth redirect flow
- `signOut()` — Clears session
- `onAuthStateChange(callback)` — Auth event listener

## API Services

### MoodApi

**File**: `src/api/moodApi.ts` | **Singleton**: `moodApi` | **Table**: `moods`

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `create()` | `moodData: MoodInsert` | `SupabaseMood` | Validated response |
| `fetchByUser()` | `userId, limit?: 50` | `SupabaseMood[]` | Ordered by created_at DESC |
| `fetchByDateRange()` | `userId, startDate, endDate` | `SupabaseMood[]` | ISO date strings |
| `fetchById()` | `moodId: string` | `SupabaseMood \| null` | Single lookup |
| `update()` | `moodId, updates` | `SupabaseMood` | Partial updates |
| `delete()` | `moodId: string` | `void` | Hard delete |
| `getMoodHistory()` | `userId, offset?, limit?` | `SupabaseMood[]` | Paginated |

All methods check `isOnline()` first. Responses validated via `SupabaseMoodSchema`.

### InteractionService

**File**: `src/api/interactionService.ts` | **Singleton**: `interactionService` | **Table**: `interactions`

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `sendPoke()` | `partnerId: string` | `SupabaseInteractionRecord` | Poke type |
| `sendKiss()` | `partnerId: string` | `SupabaseInteractionRecord` | Kiss type |
| `subscribeInteractions()` | `callback` | `() => void` | Returns unsubscribe fn |
| `getInteractionHistory()` | `limit?, offset?` | `Interaction[]` | Sent or received |
| `getUnviewedInteractions()` | — | `Interaction[]` | Unviewed, received |
| `markAsViewed()` | `interactionId` | `void` | Sets viewed = true |

**Realtime**: INSERT on `interactions` table filtered by `to_user_id`.

### PartnerService

**File**: `src/api/partnerService.ts` | **Tables**: `users`, `partner_requests`

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `searchUsers()` | `query: string` | `UserSearchResult[]` | Min 2 chars |
| `sendPartnerRequest()` | `toUserId` | `PartnerRequest` | Creates pending |
| `acceptPartnerRequest()` | `requestId` | `void` | RPC: bidirectional |
| `declinePartnerRequest()` | `requestId` | `void` | RPC: status change |
| `getPartner()` | — | `PartnerInfo \| null` | Current partner |
| `getPendingRequests()` | — | `{sent, received}` | Both directions |

## Edge Functions

### upload-love-note-image

**Location**: `supabase/functions/upload-love-note-image/index.ts`
**Bucket**: `love-notes-images` (private)

**Request**:
```http
POST /functions/v1/upload-love-note-image
Authorization: Bearer {jwt_token}
Content-Type: application/octet-stream
[binary image data]
```

**Validation**:
1. JWT authentication
2. Rate limiting (10 uploads/minute/user, in-memory)
3. File size (max 5MB compressed)
4. MIME type via magic bytes (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `52 49 46 46...57 45 42 50`, GIF: `47 49 46 38`)

**Success Response** (200):
```json
{
  "success": true,
  "storagePath": "user-id/1234567890-uuid.jpg",
  "size": 123456,
  "mimeType": "image/jpeg",
  "rateLimitRemaining": 9
}
```

**Error Codes**: 401 (auth), 405 (method), 413 (size >5MB), 415 (invalid MIME), 429 (rate limit), 500 (server)

## Validation Schemas

All schemas use **Zod v4** (`src/validation/schemas.ts`, `src/api/validation/supabaseSchemas.ts`).

### Message Schemas

```typescript
MessageCategorySchema: z.enum(['reason', 'memory', 'affirmation', 'future', 'custom'])

MessageSchema: {
  id: z.number().optional(),
  text: z.string().min(1).max(500),
  category: MessageCategorySchema,
  isCustom: z.boolean(),
  active: z.boolean().default(true),
  createdAt: z.date(),
  isFavorite: z.boolean().optional(),
}

CreateMessageInputSchema: {
  text: z.string().trim().min(1).max(500),
  category: MessageCategorySchema,
  active: z.boolean().default(true),
}

UpdateMessageInputSchema: {
  id: z.number().int().positive(),
  text: z.string().optional(),
  category: MessageCategorySchema.optional(),
  active: z.boolean().optional(),
}

CustomMessagesExportSchema  // validates export/import structure
```

### Photo Schemas

```typescript
PhotoMimeTypeSchema: z.enum(['image/jpeg', 'image/png', 'image/webp'])

PhotoSchema: {
  imageBlob: z.instanceof(Blob),
  caption: z.string().max(500).optional(),
  originalSize/compressedSize: z.number().positive(),
  width/height: z.number().int().positive(),
  mimeType: PhotoMimeTypeSchema,
}

PhotoUploadInputSchema: {
  file: z.instanceof(File),
  caption: z.string().max(500).optional(),
}
```

### Mood Schemas

```typescript
MoodTypeSchema: z.enum([
  'loved', 'happy', 'content', 'excited', 'thoughtful', 'grateful',
  'sad', 'anxious', 'frustrated', 'angry', 'lonely', 'tired'
])

IsoDateStringSchema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(date => validates actual month/day values)

MoodEntrySchema: {
  date: IsoDateStringSchema,
  mood: MoodTypeSchema,
  moods: z.array(MoodTypeSchema).min(1).optional(),
  note: z.string().max(200).optional().or(z.literal('')),
}
```

### Settings Schema

```typescript
ThemeNameSchema: z.enum(['sunset', 'ocean', 'lavender', 'rose'])
TimeFormatSchema: z.string().regex(/^\d{2}:\d{2}$/).refine(validates HH:MM)

SettingsSchema: {
  themeName: ThemeNameSchema,
  notificationTime: TimeFormatSchema,
  relationship: {
    startDate: IsoDateStringSchema,
    partnerName: z.string().min(1),
    anniversaries: z.array(AnniversarySchema),
  },
  customization: { accentColor: z.string(), fontFamily: z.string() },
  notifications: { enabled: z.boolean(), time: z.string() },
}
```

### Supabase Response Schemas

```typescript
SupabaseSessionSchema: {
  id: z.string().uuid(),
  mode: z.enum(['solo', 'together']),
  user1_id / user2_id: UUID / UUID nullable,
  current_phase: z.enum(['lobby','countdown','reading','reflection','report','complete']),
  current_step_index: z.number().int().min(0),
  status: z.enum(['pending','in_progress','complete','abandoned']),
  version: z.number().int().min(1),
  snapshot_json: z.record(z.unknown()).nullable().optional(),
}

SupabaseMoodSchema: {
  id: UUID, user_id: UUID,
  mood_type: enum, mood_types: string[] | null,
  note: string | null, created_at / updated_at: timestamp | null,
}

SupabaseReflectionSchema: { id, session_id, step_index, user_id, rating (1-5), notes, is_shared }
SupabaseBookmarkSchema: { id, session_id, step_index, user_id, share_with_partner }
SupabaseMessageSchema: { id, session_id, sender_id, message }
```

## Real-time Subscriptions

### RealtimeService (`src/services/realtimeService.ts`)

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `subscribeMoodChanges()` | `userId, onMoodChange, onError?` | `channelId` | postgres_changes on moods |
| `unsubscribe()` | `channelId` | `void` | Remove channel |
| `unsubscribeAll()` | — | `void` | Cleanup |
| `getActiveSubscriptions()` | — | `number` | Channel count |

**Channel**: `moods:{userId}` | **Events**: INSERT, UPDATE, DELETE on `public.moods`
**Status**: SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT

### Love Notes Broadcast (`src/hooks/useRealtimeMessages.ts`)

- Channel: `love-notes:{userId}`
- Event: `new_message` (Supabase Broadcast API)
- Features: deduplication, exponential backoff (max 5 retries, up to 30s), vibration feedback, auto-cleanup

## Error Handling

### Error Types

| Error Type | Source | Properties |
|------------|--------|------------|
| `ApiValidationError` | Zod parse failure | `validationErrors: ZodError` |
| `SupabaseServiceError` | Database/auth errors | Wrapped from Postgrest |
| `NetworkError` | Offline check | Generic with context |
| `ValidationError` | CustomMessageService | User-friendly message |

### Error Handlers (`src/api/errorHandlers.ts`)

| Function | Purpose |
|----------|---------|
| `isOnline()` | Check `navigator.onLine` |
| `isPostgrestError()` | Detect Supabase Postgrest errors |
| `handleSupabaseError()` | Wrap Postgrest → SupabaseServiceError |
| `handleNetworkError()` | Wrap network → SupabaseServiceError |
| `isZodError()` | Detect Zod validation errors |
| `createValidationError()` | Format Zod errors for users |
| `logSupabaseError()` | Context-aware error logging |

### Common Postgrest Error Codes

- `PGRST116`: No rows found (expected for null returns)
- `PGRST110`: Constraint violation / RLS deny
- `42P01`: Table does not exist
- `23502`: NOT NULL violation

## RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| users | Own + partner | Own only | Own (no partner_id) | — |
| moods | Own + partner's | Own only | Own only | Own only |
| love_notes | Sent or received | As sender | — | As sender |
| interactions | To/from self | As sender | Mark received viewed | — |
| partner_requests | Sent or received | As sender | Recipient only | — |
| photos | Own + partner's | Own folder | Own only | Own only |
| scripture_sessions | Session member | As user1 | Session member | — |
| scripture_reflections | Own + shared partner | Own in session | Own only | — |
| scripture_bookmarks | Own + shared partner | In own sessions | Own only | Own only |
| scripture_messages | Session member | In own sessions | — | — |

## RPCs (SECURITY DEFINER)

| Function | Purpose |
|----------|---------|
| `get_partner_id(user_id)` | Partner lookup avoiding RLS recursion |
| `accept_partner_request(id)` | Atomic bidirectional partner_id + auto-decline others |
| `decline_partner_request(id)` | Recipient-only status change |
| `scripture_create_session(mode, partner?)` | Server-timestamped session creation |
| `scripture_submit_reflection(...)` | Upsert with ON CONFLICT resolution |
| `is_scripture_session_member(id)` | Helper to prevent RLS recursion |
| `scripture_seed_test_data(...)` | Dev-only test data seeding (env guard) |
