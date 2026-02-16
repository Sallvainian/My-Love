# 5. Interaction API

**Module:** `src/api/interactionService.ts`
**Singleton export:** `interactionService` (instance of `InteractionService`)

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

## Methods

### `sendPoke(partnerId)`

```typescript
async sendPoke(partnerId: string): Promise<SupabaseInteractionRecord>
```

- **Purpose:** Insert a `poke` interaction targeting the partner.

---

### `sendKiss(partnerId)`

```typescript
async sendKiss(partnerId: string): Promise<SupabaseInteractionRecord>
```

- **Purpose:** Insert a `kiss` interaction targeting the partner.

---

### `subscribeInteractions(callback)`

```typescript
async subscribeInteractions(
  callback: (interaction: SupabaseInteractionRecord) => void
): Promise<() => void>
```

- **Purpose:** Listen for realtime `INSERT` events on the `interactions` table filtered by `to_user_id=eq.{currentUserId}`.
- **Uses:** `postgres_changes` (unlike moods which use Broadcast).
- **Returns:** Unsubscribe function.

---

### `getInteractionHistory(limit?, offset?)`

```typescript
async getInteractionHistory(limit: number = 50, offset: number = 0): Promise<Interaction[]>
```

- **Purpose:** Fetch interactions where the current user is sender or recipient.
- **Transform:** Maps Supabase records to local `Interaction` type (camelCase, Date objects).

---

### `getUnviewedInteractions()`

```typescript
async getUnviewedInteractions(): Promise<Interaction[]>
```

- **Purpose:** Fetch interactions sent to the current user where `viewed = false`.

---

### `markAsViewed(interactionId)`

```typescript
async markAsViewed(interactionId: string): Promise<void>
```

- **Purpose:** Set `viewed = true` for a specific interaction.

---
