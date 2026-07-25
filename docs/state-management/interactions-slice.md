# Interactions Slice

**File:** `src/stores/slices/interactionsSlice.ts`
**Interface:** `InteractionsSlice`

## Purpose

Manages poke/kiss interactions between partners with Supabase Realtime subscriptions for instant delivery. Tracks unviewed interaction counts and interaction history.

The slice instantiates its own `InteractionService` singleton at module scope (`const interactionService = new InteractionService()`) rather than importing a shared instance.

## State

| Field           | Type            | Default | Persisted | Description                             |
| --------------- | --------------- | ------- | --------- | --------------------------------------- |
| `interactions`  | `Interaction[]` | `[]`    | No        | Interaction history                     |
| `unviewedCount` | `number`        | `0`     | No        | Count of unviewed received interactions |
| `isSubscribed`  | `boolean`       | `false` | No        | Whether realtime subscription is active |

## Actions

| Action                    | Signature                                                       | Description                                                            |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `sendPoke`                | `(partnerId: string) => Promise<SupabaseInteractionRecord>`     | Validates, sends a poke via Supabase, optimistically prepends to state  |
| `sendKiss`                | `(partnerId: string) => Promise<SupabaseInteractionRecord>`     | Validates, sends a kiss via Supabase, optimistically prepends to state  |
| `markInteractionViewed`   | `(id: string) => Promise<void>`                                 | Marks viewed in Supabase and decrements `unviewedCount` (floored at 0)  |
| `getUnviewedInteractions` | `() => Interaction[]`                                           | Filters local state for `!viewed`                                       |
| `getInteractionHistory`   | `(days = 7) => Interaction[]`                                   | Local selector: filters by cutoff date, sorts newest first              |
| `loadInteractionHistory`  | `(limit = 100) => Promise<void>`                                | Fetches history from Supabase and recomputes `unviewedCount`            |
| `subscribeToInteractions` | `() => Promise<() => void>`                                     | Sets up the Realtime subscription; returns an unsubscribe function      |
| `addIncomingInteraction`  | `(record: SupabaseInteractionRecord) => void`                   | Deduplicates by id, prepends, bumps `unviewedCount` if unviewed         |

`sendPoke` / `sendKiss` **return** the created record and **re-throw** on failure so the UI can show error feedback. `loadInteractionHistory` swallows errors (graceful degradation to empty state).

## Realtime Subscription

`subscribeToInteractions()` opens the `incoming-interactions` channel and listens for `postgres_changes` `INSERT` events on the `interactions` table, filtered by `to_user_id=eq.{userId}`. On receipt it calls `addIncomingInteraction`, which:

1. Ignores the record if an interaction with that id already exists
2. Prepends it to the `interactions` array
3. Increments `unviewedCount` when the record is unviewed

The returned unsubscribe function removes the channel and resets `isSubscribed` to `false`. Called on component unmount.

Unlike moods and love notes (which use the Broadcast API to work around RLS), interactions can use `postgres_changes` because the RLS filter is a simple column equality.

## Interaction Types

```typescript
type InteractionType = 'poke' | 'kiss';
```

The database enum is `CREATE TYPE interaction_type AS ENUM ('poke', 'kiss')`, and the Zod schema in `api/validation/supabaseSchemas.ts` matches.

### The "fart" button is not an interaction

`PokeKissInterface.tsx` renders a third **Fart** button, but it is a client-only easter egg with no representation anywhere in the data layer. `handleFart()` writes a cooldown timestamp to LocalStorage, plays a local animation, and shows a toast — it never calls a slice action, a service, or Supabase, and there is no `sendFart`. Nothing is persisted and the partner never receives it.

The component's local `AnimationType` union (`'poke' | 'kiss' | 'fart' | null`) is where the third value comes from; do not confuse it with `InteractionType`.

## Validation

Both send actions run `validateInteraction(partnerId, type)` from `src/utils/interactionValidation.ts` before hitting the network (UUID shape + valid type), throwing with a message from `INTERACTION_ERRORS` on failure.

## Cross-Slice Dependencies

- **Reads:** `AuthSlice` (via `get().userId` in `sendPoke`, `sendKiss`, `loadInteractionHistory`, `subscribeToInteractions`)
