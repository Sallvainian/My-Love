# MAGIC DOC: State Management
*Architecture reference - not a code walkthrough*

## Purpose
Zustand-based global state with 8 feature slices, localStorage persistence, and cross-slice composition.

## Entry Points
- `src/stores/useAppStore.ts` - Main store, slice composition, persist config
- `src/stores/slices/` - All 8 slice implementations
- `src/App.tsx:initializeApp()` - Initialization sequence

## Architecture Patterns

### Slice Composition
Factory functions return partial state + actions, spread into single store:
```typescript
export const useAppStore = create<AppState>()(
  persist((set, get, api) => ({
    ...createMessagesSlice(set, get, api),
    ...createPhotosSlice(set, get, api),
    // ... 8 slices total
  }), { /* persist config */ })
);
```

### Cross-Slice Access
All slices receive `(set, get, api)` - use `get()` to read any slice's state.

### Persistence Strategy
| Data Type | Storage | Reason |
|-----------|---------|--------|
| Settings, onboarded flag | LocalStorage | Small, fast |
| Messages, photos metadata | IndexedDB | Large datasets |
| Moods, notes, interactions | Supabase | Source of truth |
| UI state (isLoading, error) | Memory only | Transient |

### Map Serialization
`messageHistory.shownMessages` is `Map<string, number>` - serializes to Array in `partialize`, deserializes in `onRehydrateStorage`.

### Hydration Guard
Pre-hydration validation prevents corrupted state from loading. `__isHydrated` flag gates app initialization.

## Key Connections
- **IndexedDB**: `src/services/moodService.ts`, `src/services/storage.ts`
- **Supabase sync**: `src/api/moodSyncService.ts`
- **React components**: Access via `useAppStore(state => state.xxx)` selectors

## Gotchas
- Initialization guard in `settingsSlice` prevents React StrictMode double-init
- Don't persist Maps directly - use partialize/onRehydrateStorage conversion
- `__isHydrated` is internal - don't expose to components
- Slices can't import each other - use `get()` for cross-slice reads

## See Also
- [Component Architecture](./component-architecture.md) - React patterns and state access
- [API & Services](./api-services.md) - Data layer and sync services
