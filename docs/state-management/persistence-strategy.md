# Persistence Strategy

## What Goes Where

| Storage | Data | Why |
|---------|------|-----|
| **localStorage** (via Zustand persist) | `settings`, `isOnboarded`, `messageHistory` | Small, critical state needed before IndexedDB is ready |
| **IndexedDB** | Messages, custom messages, mood entries | Bulk data that would exceed localStorage quota |
| **Supabase** | Photos, interactions, love notes, scripture sessions, partner data, mood sync | Shared data between partners, cloud backup |
| **Not persisted** | `isLoading`, `error`, `currentView`, `currentMessage`, `interactions`, `photos`, `notes` | Runtime/computed state or fetched on demand |

## Partialize Configuration

The `partialize` option controls exactly which fields are written to localStorage:

```typescript
partialize: (state) => ({
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: {
    ...state.messageHistory,
    shownMessages: state.messageHistory?.shownMessages instanceof Map
      ? Array.from(state.messageHistory.shownMessages.entries())
      : [],
  },
  moods: state.moods,
})
```

Fields explicitly excluded:
- `messages` -- Loaded from IndexedDB on init
- `currentMessage` -- Computed from messages + messageHistory
- `customMessages` -- Loaded from IndexedDB via `loadCustomMessages`
- `isLoading`, `error` -- Runtime UI state
- `photos`, `interactions`, `notes` -- Fetched from Supabase

## Rehydration Safety

The store implements multi-layer validation during rehydration:

1. **Pre-hydration validation** -- `createJSONStorage` wrapper parses and validates localStorage data before Zustand processes it. Corrupted data triggers immediate removal and fallback to defaults.

2. **onRehydrateStorage callback** -- Runs after Zustand deserializes state. Handles:
   - `shownMessages` Map deserialization (Array -> Map with structure validation)
   - Null/undefined messageHistory graceful recovery
   - Missing settings graceful recovery
   - Final state integrity validation

3. **Corruption recovery** -- On any validation failure, corrupted localStorage is cleared and the app reinitializes with default state. Console warnings are logged for debugging.

## State Schema Versioning

The persist configuration includes `version: 0` for future migration support. When the state schema changes, increment the version and add a `migrate` function to transform old state shapes.

---
