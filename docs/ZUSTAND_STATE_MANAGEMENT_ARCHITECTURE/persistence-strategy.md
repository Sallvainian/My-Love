# Persistence Strategy

## Storage Configuration

| Data                | Storage           | Strategy                        | Serialization      |
| ------------------- | ----------------- | ------------------------------- | ------------------ |
| **settings**        | LocalStorage      | Persisted (Zod validated)       | JSON               |
| **isOnboarded**     | LocalStorage      | Persisted                       | Boolean            |
| **messageHistory**  | LocalStorage      | Persisted with special handling | JSON (Map → Array) |
| **moods**           | LocalStorage      | Persisted                       | JSON               |
| **messages**        | IndexedDB         | Loaded on init                  | Blob (photos)      |
| **photos**          | IndexedDB         | Loaded on init                  | Blob (image data)  |
| **customMessages**  | IndexedDB         | Loaded on demand                | JSON               |
| **interactions**    | Supabase Realtime | Ephemeral (fetched fresh)       | -                  |
| **partner**         | Supabase          | Loaded on mount                 | -                  |
| **other transient** | Memory only       | Runtime state                   | -                  |

## LocalStorage Persistence Configuration

```typescript
partialize: (state) => ({
  // Critical user data
  settings: state.settings,
  isOnboarded: state.isOnboarded,

  // Message history (serialized Map → Array)
  messageHistory: {
    ...state.messageHistory,
    shownMessages:
      state.messageHistory?.shownMessages instanceof Map
        ? Array.from(state.messageHistory.shownMessages.entries())
        : [],
  },

  // Mood entries
  moods: state.moods,

  // NOT persisted (IndexedDB):
  // - messages (loaded from IndexedDB)
  // - customMessages (loaded on demand)
  // - photos (loaded from IndexedDB)
  //
  // NOT persisted (transient):
  // - currentMessage (computed from messages + history)
  // - interactions (fetched fresh from Supabase)
  // - partner (loaded from Supabase)
  // - isLoading, error (runtime UI state)
});
```

## Serialization & Deserialization

### MessageHistory Map Serialization

The `messageHistory.shownMessages` Map (date → message ID mapping) requires custom serialization:

**Serialization (State → JSON)**:

```typescript
// Before storage: Map([["2025-11-16", 42], ["2025-11-15", 41]])
// After storage: [["2025-11-16", 42], ["2025-11-15", 41]]
shownMessages instanceof Map ? Array.from(state.messageHistory.shownMessages.entries()) : [];
```

**Deserialization (JSON → State)**:

```typescript
// After loading: [["2025-11-16", 42], ["2025-11-15", 41]]
// Before use: Map([["2025-11-16", 42], ["2025-11-15", 41]])
onRehydrateStorage: () => (state, error) => {
  if (state?.messageHistory) {
    const shownMessagesArray = state.messageHistory.shownMessages as any;

    if (!shownMessagesArray) {
      state.messageHistory.shownMessages = new Map();
    } else if (Array.isArray(shownMessagesArray)) {
      // Validate array structure: [[key, value], ...]
      const isValidArray = shownMessagesArray.every(
        (item) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
      );

      if (isValidArray) {
        state.messageHistory.shownMessages = new Map(shownMessagesArray);
      } else {
        state.messageHistory.shownMessages = new Map();
      }
    }
  }
};
```

## Pre-Hydration Validation

The custom storage implementation validates state before Zustand hydrates:

```typescript
storage: createJSONStorage(() => ({
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;

    try {
      const data = JSON.parse(str);

      // Validate structure BEFORE Zustand sees it
      const validation = validateHydratedState(data.state);
      if (!validation.isValid) {
        console.error('[Storage] Pre-hydration validation failed');
        localStorage.removeItem(name);
        return null; // Force Zustand to use defaults
      }

      return str; // Valid - let Zustand hydrate
    } catch (parseError) {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}));
```

## Validation Logic

The `validateHydratedState()` function performs two-phase validation:

1. **Pre-hydration** (in `getItem`): Parse and structural validation
2. **Post-hydration** (in `onRehydrateStorage`): Type validation and recovery

```typescript
function validateHydratedState(state: Partial<AppState> | undefined): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!state) {
    errors.push('State is undefined');
    return { isValid: false, errors };
  }

  // Validate only CRITICAL fields
  if (state.messageHistory) {
    // Check shownMessages is array OR Map
    if (
      state.messageHistory.shownMessages !== undefined &&
      !Array.isArray(state.messageHistory.shownMessages) &&
      !(state.messageHistory.shownMessages instanceof Map)
    ) {
      errors.push('shownMessages is not an array or Map instance');
    }

    // Check currentIndex is number
    if (
      state.messageHistory.currentIndex !== undefined &&
      typeof state.messageHistory.currentIndex !== 'number'
    ) {
      errors.push('currentIndex is not a number');
    }
  }

  // Only fail on CRITICAL errors (data integrity issues)
  // Missing fields are OK - they'll use defaults
  const hasCriticalErrors = errors.some(
    (err) => err.includes('not an array or Map instance') || err.includes('not a number')
  );

  return { isValid: !hasCriticalErrors, errors };
}
```

## Hydration Recovery

On hydration failure, the store:

1. Logs detailed error messages
2. Clears corrupted localStorage
3. Falls back to initial state defaults
4. Continues with empty/default values for missing data

```typescript
onRehydrateStorage: () => (state, error) => {
  if (error) {
    console.error('[Zustand Persist] Failed to rehydrate:', error);
    try {
      localStorage.removeItem('my-love-storage');
      console.warn('[Zustand Persist] Corrupted state cleared');
    } catch (clearError) {
      console.error('[Zustand Persist] Failed to clear corrupted state');
    }
    return; // App continues with defaults
  }

  // Post-hydration recovery logic
  if (state?.messageHistory) {
    // Deserialize Map from Array
    // Handle null/undefined gracefully
  }

  // Set hydration flag
  if (state) {
    state.__isHydrated = true;
  }
};
```

---
