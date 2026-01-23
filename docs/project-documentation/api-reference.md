# API Reference

> API layer documentation for My-Love project.

## Overview

The API layer (`src/api/`) provides validated wrappers around Supabase operations.

## API Files

| File | Purpose | Exports |
|------|---------|---------|
| `supabaseClient.ts` | Supabase singleton | `supabase`, `getPartnerId`, `getPartnerDisplayName` |
| `authService.ts` | Authentication | `authService` (singleton) |
| `moodApi.ts` | Mood CRUD | `moodApi` (singleton) |
| `moodSyncService.ts` | Real-time sync | Sync utilities |
| `interactionService.ts` | Interactions | Poke/kiss/fart functions |
| `partnerService.ts` | Partner data | Partner queries |
| `errorHandlers.ts` | Error handling | Error utilities |
| `validation/supabaseSchemas.ts` | Zod schemas | Type validators |

## Supabase Client

### Initialization

```typescript
import { supabase } from './api/supabaseClient';

// Typed client with Database schema
const { data, error } = await supabase
  .from('moods')
  .select('*')
  .eq('user_id', userId);
```

### Partner Utilities

```typescript
// Get partner's user ID
const partnerId = await getPartnerId();

// Get partner's display name
const partnerName = await getPartnerDisplayName();
```

## Auth Service

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `signIn(credentials)` | Email/password login | `AuthResult` |
| `signUp(credentials)` | Create account | `AuthResult` |
| `signOut()` | Logout | `void` |
| `signInWithGoogle()` | OAuth login | `AuthError | null` |
| `getSession()` | Get current session | `Session | null` |
| `getUser()` | Get current user | `User | null` |
| `getCurrentUserId()` | Get user ID | `string | null` |
| `getCurrentUserIdOfflineSafe()` | Offline-safe user ID | `string | null` |
| `getAuthStatus()` | Full auth status | `AuthStatus` |
| `onAuthStateChange(callback)` | Listen to auth changes | `() => void` |
| `resetPassword(email)` | Send reset email | `AuthError | null` |

### Usage Examples

```typescript
import { authService } from './api/authService';

// Sign in
const result = await authService.signIn({
  email: 'user@example.com',
  password: 'password123'
});

// Check auth status
const { isAuthenticated, user } = await authService.getAuthStatus();

// Listen to changes
const unsubscribe = authService.onAuthStateChange((session) => {
  if (session) {
    console.log('Signed in:', session.user.email);
  }
});
```

## Mood API

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `create(moodData)` | Create mood entry | `SupabaseMood` |
| `fetchByUser(userId, limit?)` | Get user's moods | `SupabaseMood[]` |
| `fetchByDateRange(userId, start, end)` | Get moods in range | `SupabaseMood[]` |
| `fetchById(moodId)` | Get single mood | `SupabaseMood | null` |
| `update(moodId, updates)` | Update mood | `SupabaseMood` |
| `delete(moodId)` | Delete mood | `void` |
| `getMoodHistory(userId, offset?, limit?)` | Paginated history | `SupabaseMood[]` |

### Usage Examples

```typescript
import { moodApi } from './api/moodApi';

// Create mood
const mood = await moodApi.create({
  user_id: userId,
  mood_type: 'happy',
  note: 'Great day!',
  created_at: new Date().toISOString(),
});

// Fetch with pagination
const moods = await moodApi.getMoodHistory(userId, 0, 20);
```

## Error Handling

### Error Types

| Error | Description |
|-------|-------------|
| `ApiValidationError` | Zod schema validation failed |
| `SupabaseServiceError` | Database operation failed |
| Network errors | Offline or timeout |

### Error Utilities

```typescript
import {
  isOnline,
  handleSupabaseError,
  handleNetworkError,
  logSupabaseError,
  isPostgrestError,
} from './api/errorHandlers';

// Check network status
if (!isOnline()) {
  throw handleNetworkError(new Error('Offline'), 'context');
}

// Handle Supabase errors
if (isPostgrestError(error)) {
  throw handleSupabaseError(error, 'MoodApi.create');
}
```

## Zod Schemas

### Available Schemas

```typescript
import {
  SupabaseMoodSchema,
  MoodArraySchema,
  SupabaseUserSchema,
  SupabaseInteractionSchema,
  // ... more schemas
} from './api/validation/supabaseSchemas';
```

### Validation Pattern

```typescript
// Validate API response
try {
  const validatedMood = SupabaseMoodSchema.parse(data);
  return validatedMood;
} catch (error) {
  if (error instanceof ZodError) {
    throw new ApiValidationError('Invalid data', error);
  }
  throw error;
}
```

## Real-Time Subscriptions

### Mood Sync (Broadcast Pattern)

```typescript
// Due to RLS, uses Broadcast instead of postgres_changes
const channel = supabase.channel(`mood-updates:${userId}`);

channel
  .on('broadcast', { event: 'mood-update' }, (payload) => {
    // Handle mood update
  })
  .subscribe();
```

### Interaction Notifications

```typescript
// Listen for pokes/kisses
supabase
  .channel(`interactions:${userId}`)
  .on('broadcast', { event: 'new-interaction' }, handler)
  .subscribe();
```

## Best Practices

### Always Validate Responses

```typescript
// DO: Validate with Zod
const validated = Schema.parse(response);

// DON'T: Trust raw response
const data = response; // Unsafe
```

### Handle Offline State

```typescript
// Check network before API calls
if (!isOnline()) {
  // Fall back to IndexedDB
  return await indexedDBService.get(id);
}
```

### Use Singletons

```typescript
// DO: Import singleton
import { moodApi } from './api/moodApi';

// DON'T: Create new instance
const api = new MoodApi(); // Wrong
```
