# Composition Pattern

## Store Creation

The store uses Zustand's `create<T>()` API with slice composition via spread operator:

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // 1. Compose all 7 slices
      ...createMessagesSlice(set as any, get as any, api as any),
      ...createPhotosSlice(set as any, get as any, api as any),
      ...createSettingsSlice(set as any, get as any, api as any),
      ...createNavigationSlice(set as any, get as any, api as any),
      ...createMoodSlice(set as any, get as any, api as any),
      ...createInteractionsSlice(set as any, get as any, api as any),
      ...createPartnerSlice(set as any, get as any, api as any),

      // 2. Define core state
      isLoading: false,
      error: null,
      __isHydrated: false,
    }),
    {
      // 3. Configure persist middleware
      name: 'my-love-storage',
      version: 0,
      storage: createJSONStorage(...),
      partialize: (state) => ({ ... }),
      onRehydrateStorage: () => (state, error) => { ... },
    }
  )
);
```

## StateCreator Pattern

Each slice follows this pattern:

```typescript
export const createXyzSlice: StateCreator<
  XyzSlice & { otherSlice?: OtherType }, // Full state shape
  [], // Middleware
  [], // Nested middleware
  XyzSlice // Return type
> = (set, get) => ({
  // State
  state1: initialValue,
  state2: initialValue,

  // Actions
  action1: () => {
    set({ state1: newValue });
  },
  action2: () => {
    const state = get(); /* ... */
  },
});
```

## Type Safety Note

The composition uses `as any` casts to avoid TypeScript circular reference issues. While pragmatic for monolithic stores, this trades some type safety for simplicity. The AppState interface maintains full type correctness for consumers.

---
