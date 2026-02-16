# Architecture Patterns

## Pattern 1: Offline-First with Cloud Sync

Used by: **Moods**, **Messages**, **Custom Messages**

```
UI Component
    |
    v
Zustand Slice (optimistic state update)
    |
    v
Service Layer (Zod validation)
    |
    v
IndexedDB (primary store, synced=false)
    |
    v
Sync Service (immediate + periodic + SW background)
    |
    v
Supabase (cloud persistence)
```

The UI reads and writes to IndexedDB as the single source of truth. Entries are created with `synced: false` and `supabaseId: null`. Three sync triggers push data to Supabase:

1. **Immediate** -- On creation, if `navigator.onLine` is true, sync is attempted immediately via `moodSyncService.syncPendingMoods()`.
2. **Periodic** -- A 5-minute interval in `App.tsx` calls `syncPendingMoods()` while the app is open.
3. **Background Sync API** -- The service worker registers `sync-pending-moods` tag. When connectivity returns, the SW reads IndexedDB directly and calls Supabase REST API.

Partial failure handling: individual entries that fail sync are left as `synced: false` and retried on the next pass. Successfully synced entries are marked with `synced: true` and their `supabaseId` is stored.

## Pattern 2: Online-First with Optimistic UI

Used by: **Scripture Reading**

```
UI Component
    |
    v
Zustand Slice (optimistic state update)
    |
    v
ScriptureReadingService (Supabase RPC)
    |
    v
Supabase (source of truth)
    |
    v
IndexedDB (read cache, fire-and-forget write)
```

Scripture sessions write to Supabase first via RPC calls. The Zustand slice updates state optimistically before server confirmation. If the write fails, the slice enters a `pendingRetry` state that prompts the user to retry.

Reads use a cache-first strategy: if data exists in IndexedDB cache, it is returned immediately while a background refresh fetches from Supabase. This provides fast reads without blocking on network.

## Pattern 3: Supabase-Direct

Used by: **Love Notes Chat**, **Photo Gallery**, **Poke/Kiss Interactions**, **Partner Data**

```
UI Component
    |
    v
Zustand Slice
    |
    v
Supabase Client (direct query)
    |
    v
Supabase Database/Storage
```

These features query Supabase directly without local persistence. Love Notes uses optimistic updates with temporary IDs (`tempId`) for immediate UI feedback, replacing them with real Supabase IDs on confirmation.

## Pattern 4: Local-Only Persistence

Used by: **Settings**, **Onboarding State**, **Message History**

```
Zustand Slice
    |
    v
zustand/persist middleware
    |
    v
localStorage (automatic serialization)
```

The store's `partialize` function selects which state keys to persist: `settings`, `isOnboarded`, `messageHistory`, and `moods`. Custom serialization handles `Map<string, number>` objects in `messageHistory.shownMessages`.

## Pattern 5: Sliced Store Composition

The entire app state lives in a single Zustand store composed from 10 domain slices:

```typescript
// src/stores/useAppStore.ts
export const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createAppSlice(...args),
      ...createSettingsSlice(...args),
      ...createNavigationSlice(...args),
      ...createMessagesSlice(...args),
      ...createMoodSlice(...args),
      ...createInteractionsSlice(...args),
      ...createPartnerSlice(...args),
      ...createNotesSlice(...args),
      ...createPhotosSlice(...args),
      ...createScriptureReadingSlice(...args),
    }),
    persistConfig
  )
);
```

Each slice is typed via `AppStateCreator<SliceInterface>`, which resolves to `StateCreator<AppState, [['zustand/persist', Partial<AppState>]], [], SliceInterface>`. This gives each slice access to `get()` for the full `AppState`, enabling cross-slice reads without circular imports.

## Pattern 6: Service Layer Abstraction

All IndexedDB operations go through a `BaseIndexedDBService<T>` abstract class (`src/services/BaseIndexedDBService.ts`) that provides:

- **CRUD operations**: `add()`, `getById()`, `getAll()`, `update()`, `delete()`
- **Pagination**: `getPage(page, pageSize)` using cursor-based iteration
- **Error strategy**: Read operations return `null`/empty array on error (graceful degradation); write operations throw (data integrity).
- **Shared schema**: All services use `MyLoveDBSchema` from `src/services/dbSchema.ts` (version 5, 8 object stores).

Concrete implementations:
- `MoodService` extends `BaseIndexedDBService<MoodEntry>` -- adds Zod validation, date queries, sync state management
- `CustomMessageService` extends `BaseIndexedDBService<Message>` -- adds Zod validation, filtering, import/export
- `PhotoStorageService` extends `BaseIndexedDBService<Photo>` -- adds migration support, performance monitoring
- `ScriptureReadingService` extends `BaseIndexedDBService<ScriptureSession>` -- adds cache-first reads, write-through, corruption recovery

## Pattern 7: Validation at Service Boundaries

Zod v4 schemas in `src/validation/schemas.ts` validate data before IndexedDB writes and before Supabase RPC calls. Validation errors are transformed into user-friendly messages via `src/validation/errorMessages.ts`:

```typescript
// src/services/moodService.ts
async create(userId: string, moods: MoodType[], note?: string): Promise<MoodEntry> {
  const validatedEntry = MoodEntrySchema.parse({
    date: today,
    mood: moods[0],
    moods,
    note: note || '',
  });
  // ... proceed with IndexedDB write
}
```

The `ValidationError` class wraps Zod errors with a `fieldErrors: Map<string, string>` for per-field error display in forms. The `FIELD_NAME_MAP` translates technical field paths (e.g., `relationship.partnerName`) to human-readable labels (e.g., "Partner name").

## Pattern 8: Realtime Communication

Two realtime patterns are used:

**Broadcast API** (Love Notes, Partner Mood):
```typescript
// src/hooks/useRealtimeMessages.ts
channel.on('broadcast', { event: 'new_note' }, (payload) => {
  // Handle incoming love note
});
```

**postgres_changes** (Mood Realtime, legacy):
```typescript
// src/services/realtimeService.ts
channel.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'moods',
}, callback);
```

Both patterns include exponential backoff retry logic (max 5 retries, 1s-30s delay).

## Related Documentation

- [Data Architecture](./04-data-architecture.md)
- [State Management Overview](./05-state-management-overview.md)
- [Offline Strategy](./12-offline-strategy.md)
- [Realtime Features](./11-realtime-features.md)
