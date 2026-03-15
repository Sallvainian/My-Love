# Interactions Slice

**File:** `src/stores/slices/interactionsSlice.ts`
**Interface:** `InteractionsSlice`

## Purpose

Manages poke/kiss/fart interactions between partners with Supabase realtime subscriptions for instant delivery. Tracks unviewed interaction counts and interaction history.

## State

| Field           | Type            | Default | Persisted | Description                             |
| --------------- | --------------- | ------- | --------- | --------------------------------------- |
| `interactions`  | `Interaction[]` | `[]`    | No        | Interaction history                     |
| `unviewedCount` | `number`        | `0`     | No        | Count of unviewed received interactions |
| `isSubscribed`  | `boolean`       | `false` | No        | Whether realtime subscription is active |

## Actions

| Action                    | Signature                              | Description                                                          |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `sendPoke`                | `(partnerId: string) => Promise<void>` | Sends a poke interaction to partner via Supabase                     |
| `sendKiss`                | `(partnerId: string) => Promise<void>` | Sends a kiss interaction to partner via Supabase                     |
| `getUnviewedInteractions` | `() => Interaction[]`                  | Returns unviewed received interactions                               |
| `markInteractionViewed`   | `(id: string) => Promise<void>`        | Marks interaction as viewed in Supabase and updates local count      |
| `subscribeToInteractions` | `() => Promise<() => void>`            | Sets up Supabase realtime subscription, returns unsubscribe function |
| `loadInteractionHistory`  | `() => Promise<void>`                  | Loads 7-day interaction history from Supabase                        |

## Realtime Subscription

`subscribeToInteractions()` subscribes to Supabase realtime channel for the `interactions` table. When a new interaction is received:

1. Adds it to the `interactions` array
2. Increments `unviewedCount`
3. The PokeKissInterface component triggers animation playback

The subscription returns an unsubscribe function that is called on component unmount.

## Interaction Types

```typescript
type InteractionType = 'poke' | 'kiss' | 'fart';
```

Note: `fart` interactions are local-only (no Supabase RPC) -- they play a local animation without server persistence.

## Cross-Slice Dependencies

- **Reads:** `AuthSlice` (via `get().userId` in `sendPoke`, `sendKiss`, `loadInteractionHistory`, `subscribeToInteractions` for user identity)
