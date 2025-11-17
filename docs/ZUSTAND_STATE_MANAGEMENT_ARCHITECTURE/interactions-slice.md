# INTERACTIONS SLICE

## File

`src/stores/slices/interactionsSlice.ts`

## Purpose

Manages ephemeral poke/kiss interactions: sending, receiving, history, and Realtime subscription management via Supabase.

## State Interface

```typescript
export interface InteractionsSlice {
  // State
  interactions: Interaction[];
  unviewedCount: number;
  isSubscribed: boolean;

  // Actions
  sendPoke: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  sendKiss: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  markInteractionViewed: (id: string) => Promise<void>;
  getUnviewedInteractions: () => Interaction[];
  getInteractionHistory: (days?: number) => Interaction[];
  loadInteractionHistory: (limit?: number) => Promise<void>;
  subscribeToInteractions: () => Promise<() => void>;
  addIncomingInteraction: (record: SupabaseInteractionRecord) => void;
}
```

## State Shape

```typescript
{
  interactions: [
    {
      id: string,               // Supabase ID
      type: 'poke' | 'kiss',
      fromUserId: string,       // Sender
      toUserId: string,         // Receiver
      viewed: boolean,
      createdAt: Date,
    }
  ],

  unviewedCount: number,        // Unviewed received interactions
  isSubscribed: boolean,        // Realtime subscription active?
}
```

## Initial State

```typescript
interactions: [],
unviewedCount: 0,
isSubscribed: false,
```

## Actions

### sendPoke(partnerId)

**Type**: Async  
**Input**: Partner user ID  
**Returns**: `SupabaseInteractionRecord`  
**Persistence**: Supabase

**Process**:

1. Validate interaction: `validateInteraction(partnerId, 'poke')`
2. Send via `interactionService.sendPoke(partnerId)`
3. Convert to local format: `toLocalInteraction()`
4. Optimistic UI update: add to beginning of interactions
5. Log success

**Error Handling**: Validation fails → throws error; Network → throws error

### sendKiss(partnerId)

**Type**: Async  
**Input**: Partner user ID  
**Returns**: `SupabaseInteractionRecord`  
**Persistence**: Supabase

**Process**: Same as `sendPoke()`, different type

### markInteractionViewed(id)

**Type**: Async  
**Input**: Interaction ID  
**Persistence**: Supabase (updates viewed flag)

**Process**:

1. Call `interactionService.markAsViewed(id)`
2. Update local interaction: `viewed = true`
3. Decrement `unviewedCount`
4. Log success

**Error Handling**: Throws (allows UI error feedback)

### getUnviewedInteractions()

**Type**: Sync query  
**Returns**: `Interaction[]`

**Logic**:

```typescript
return get().interactions.filter((i) => !i.viewed);
```

**Note**: Filters for unviewed (doesn't filter by receiver)

### getInteractionHistory(days?)

**Type**: Sync query  
**Input**: `days = 7` (default)  
**Returns**: `Interaction[]` (sorted newest first)

**Logic**:

```typescript
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - days);

return get()
  .interactions.filter((i) => i.createdAt >= cutoffDate)
  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
```

### loadInteractionHistory(limit?)

**Type**: Async  
**Input**: `limit = 100` (max records)  
**Source**: Supabase (interactionService)  
**Persistence**: NOT persisted (fresh load)

**Process**:

1. Fetch history via `interactionService.getInteractionHistory(limit)`
2. Update `interactions` state
3. Calculate `unviewedCount` (all unviewed)
4. Update state
5. Log counts

**Error Handling**: Logged (graceful degradation)

### subscribeToInteractions()

**Type**: Async  
**Returns**: Unsubscribe function  
**Purpose**: Real-time subscription via Supabase Realtime  
**Persistence**: Ephemeral (connection-based)

**Process**:

1. Get current user ID via `authService.getCurrentUserId()`
2. Subscribe via `interactionService.subscribeInteractions(callback)`
3. Callback: `addIncomingInteraction(record)`
4. Set `isSubscribed = true`
5. Return enhanced unsubscribe function that sets `isSubscribed = false`

**Error Handling**: Throws if user not authenticated

**Usage**:

```typescript
const unsubscribe = await subscribeToInteractions();
// Later: unsubscribe();
```

### addIncomingInteraction(record)

**Type**: Sync  
**Input**: `SupabaseInteractionRecord` (from Realtime)  
**Purpose**: Handle incoming Realtime interaction event

**Process**:

1. Check if interaction already in state (prevent duplicates)
2. Convert to local format: `toLocalInteraction(record)`
3. Add to beginning of interactions
4. If not viewed: increment `unviewedCount`
5. Log addition

**Duplicate Prevention**: Checks `interactions.some((i) => i.id === record.id)`

## Conversion Function

```typescript
function toLocalInteraction(record: SupabaseInteractionRecord): Interaction {
  return {
    id: record.id,
    type: record.type as 'poke' | 'kiss',
    fromUserId: record.from_user_id,
    toUserId: record.to_user_id,
    viewed: record.viewed ?? false,
    createdAt: new Date(record.created_at ?? new Date()),
  };
}
```

## Validation

Input validation before sending:

```typescript
const validation = validateInteraction(partnerId, 'poke');
if (!validation.isValid) {
  throw new Error(validation.error || INTERACTION_ERRORS.INVALID_TYPE);
}
```

## Persistence

- **What**: NOT persisted to LocalStorage/IndexedDB
- **Where**: Supabase only
- **When**: Fetched fresh on init + Realtime updates
- **Why**: Ephemeral messaging (no historical persistence needed)

## Real-time Architecture

**Flow**:

1. `subscribeToInteractions()` establishes Realtime subscription
2. Supabase Realtime fires events on `interactions` table changes
3. Callback: `addIncomingInteraction(record)`
4. State updated with new interaction
5. UI re-renders automatically (Zustand subscription)

**Unsubscribe**: Closes connection + updates state

## Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `InteractionService` (Supabase CRUD + Realtime)
- `authService` (user authentication)
- `validateInteraction()` (input validation)

---
