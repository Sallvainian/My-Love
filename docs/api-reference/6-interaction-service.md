# 6. Interaction Service

**Source:** `src/api/interactionService.ts`

## Overview

Handles poke and kiss interactions between partners via Supabase. Provides sending, real-time subscription, history retrieval, and view tracking.

**Singleton:** `export const interactionService = new InteractionService()`

**Supabase table:** `interactions`

## Types

```typescript
type InteractionType = 'poke' | 'kiss';

type SupabaseInteractionRecord = Database['public']['Tables']['interactions']['Row'];
type InteractionInsert = Database['public']['Tables']['interactions']['Insert'];

interface Interaction {
  id: string;
  type: InteractionType;
  fromUserId: string;
  toUserId: string;
  viewed: boolean;
  createdAt: Date;
}
```

## Methods

### `sendPoke(partnerId: string): Promise<SupabaseInteractionRecord>`

Sends a poke interaction. Delegates to `sendInteraction('poke', partnerId)`.

---

### `sendKiss(partnerId: string): Promise<SupabaseInteractionRecord>`

Sends a kiss interaction. Delegates to `sendInteraction('kiss', partnerId)`.

---

### `subscribeInteractions(callback): Promise<() => void>`

```typescript
async subscribeInteractions(
  callback: (interaction: SupabaseInteractionRecord) => void
): Promise<() => void>
```

Subscribes to incoming interactions in real-time via `postgres_changes`.

**Channel:** `incoming-interactions`

**Filter:** `INSERT` events on `interactions` table where `to_user_id=eq.{currentUserId}`

**Returns:** Unsubscribe function that removes the channel.

**Throws:** Error if user is not authenticated.

---

### `getInteractionHistory(limit?: number, offset?: number): Promise<Interaction[]>`

Fetches interaction history (both sent and received) for the current user.

**Query:** `supabase.from('interactions').select('*').or('from_user_id.eq.{userId},to_user_id.eq.{userId}').order('created_at', { ascending: false }).range(offset, offset + limit - 1)`

**Defaults:** `limit = 50`, `offset = 0`

**Returns:** Array of local `Interaction` objects (transformed from Supabase records).

---

### `getUnviewedInteractions(): Promise<Interaction[]>`

Fetches unviewed interactions sent to the current user.

**Query:** `supabase.from('interactions').select('*').eq('to_user_id', currentUserId).eq('viewed', false).order('created_at', { ascending: false })`

---

### `markAsViewed(interactionId: string): Promise<void>`

Marks a single interaction as viewed.

**Query:** `supabase.from('interactions').update({ viewed: true }).eq('id', interactionId)`

## Private Methods

### `sendInteraction(type, toUserId): Promise<SupabaseInteractionRecord>`

Internal method used by `sendPoke()` and `sendKiss()`.

**Flow:**

1. Checks `isOnline()` -- throws network error if offline
2. Gets `currentUserId` via `getCurrentUserId()`
3. Inserts interaction: `supabase.from('interactions').insert({ type, from_user_id, to_user_id, viewed: false }).select().single()`
4. Returns the created record

## Error Handling

All methods use the standard error handling pattern:

- `isPostgrestError()` check -- transforms via `handleSupabaseError()`
- All other errors -- transforms via `handleNetworkError()`
- Errors logged via `logSupabaseError()` before throwing
