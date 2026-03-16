# 6. Interaction Service

**Source:** `src/api/interactionService.ts`

## Purpose

Manages poke/kiss interactions between partners via Supabase with real-time subscription support using `postgres_changes`.

## Class: `InteractionService`

Singleton exported as `interactionService`.

### `sendPoke(partnerId: string, userId: string): Promise<SupabaseInteractionRecord>`

Sends a "poke" interaction. Delegates to `sendInteraction('poke', partnerId, userId)`.

### `sendKiss(partnerId: string, userId: string): Promise<SupabaseInteractionRecord>`

Sends a "kiss" interaction. Delegates to `sendInteraction('kiss', partnerId, userId)`.

### `subscribeInteractions(userId, callback): Promise<() => void>`

Subscribes to `postgres_changes` on `interactions` table with filter `to_user_id=eq.{userId}`. Fires callback on INSERT events. Returns unsubscribe function.

### `getInteractionHistory(userId, limit?, offset?): Promise<Interaction[]>`

Fetches interactions where user is sender or recipient. Uses `.or()` filter. Transforms Supabase records to local `Interaction` format.

### `getUnviewedInteractions(userId): Promise<Interaction[]>`

Fetches interactions sent to user with `viewed: false`.

### `markAsViewed(interactionId: string): Promise<void>`

Updates `viewed: true` on the interaction record.

## Types

```typescript
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

## Private Methods

### `sendInteraction(type, toUserId, userId): Promise<SupabaseInteractionRecord>`

Checks network status, inserts interaction record with `from_user_id`, `to_user_id`, `type`, `viewed: false`.
