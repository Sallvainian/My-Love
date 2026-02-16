# 6. Interaction Service

**Source:** `src/api/interactionService.ts`

## Overview

The `InteractionService` class handles partner interactions (poke, kiss) through Supabase. It provides methods for sending interactions, subscribing to incoming interactions in real time via `postgres_changes`, fetching interaction history, and marking interactions as viewed.

## Types

```typescript
type SupabaseInteractionRecord = Database['public']['Tables']['interactions']['Row'];
type InteractionInsert = Database['public']['Tables']['interactions']['Insert'];
type InteractionType = 'poke' | 'kiss';

interface Interaction {
  id: string;
  type: InteractionType;
  fromUserId: string;
  toUserId: string;
  viewed: boolean;
  createdAt: Date;
}
```

`SupabaseInteractionRecord` and `InteractionInsert` are derived directly from the auto-generated `Database` type. `Interaction` is the local camelCase representation used in the app.

## Methods

### `sendPoke(partnerId: string): Promise<SupabaseInteractionRecord>`

Sends a poke interaction. Delegates to the private `sendInteraction()` with `type: 'poke'`.

### `sendKiss(partnerId: string): Promise<SupabaseInteractionRecord>`

Sends a kiss interaction. Delegates to the private `sendInteraction()` with `type: 'kiss'`.

### Private: `sendInteraction(type, toUserId)`

**Flow:**
1. Check `isOnline()` -- throw `SupabaseServiceError` with `isNetworkError: true` if offline
2. Get `currentUserId` via `getCurrentUserId()` from sessionService
3. Build `InteractionInsert` payload (`type`, `from_user_id`, `to_user_id`, `viewed: false`)
4. Insert into `interactions` table with `.select().single()`
5. Return the created record

**Error handling:** Standard pattern -- `logSupabaseError`, then throw `handleSupabaseError` for Postgrest errors or `handleNetworkError` for other failures.

### `subscribeInteractions(callback): Promise<() => void>`

Subscribes to real-time incoming interactions using `postgres_changes`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `(interaction: SupabaseInteractionRecord) => void` | Called when partner sends an interaction |

**Channel:** `incoming-interactions`

**Filter:** `postgres_changes` with `event: 'INSERT'`, `schema: 'public'`, `table: 'interactions'`, `filter: to_user_id=eq.{currentUserId}`

**Returns:** Unsubscribe function that calls `supabase.removeChannel()` on the stored `realtimeChannel`.

**Note:** Unlike mood updates (which use Broadcast API), interactions use `postgres_changes` because the RLS policies on the interactions table are simple enough for Supabase Realtime to evaluate.

### `getInteractionHistory(limit?, offset?): Promise<Interaction[]>`

Fetches interactions where the current user is either sender or recipient.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | Max results |
| `offset` | `number` | `0` | Starting position |

**Query:** `.or(from_user_id.eq.{userId},to_user_id.eq.{userId})` with `.order('created_at', { ascending: false })` and `.range(offset, offset + limit - 1)`.

**Transformation:** Maps snake_case `SupabaseInteractionRecord` fields to camelCase `Interaction` fields. Defaults `viewed` to `false` if null, and `createdAt` to `new Date()` if null.

### `getUnviewedInteractions(): Promise<Interaction[]>`

Fetches interactions sent to the current user that have not been viewed.

**Query:** `.eq('to_user_id', currentUserId).eq('viewed', false)` ordered by `created_at` descending.

**Transformation:** Same snake_case-to-camelCase mapping as `getInteractionHistory`.

### `markAsViewed(interactionId: string): Promise<void>`

Marks a single interaction as viewed.

**Query:** `.update({ viewed: true }).eq('id', interactionId)`

## Singleton

```typescript
export const interactionService = new InteractionService();
```
