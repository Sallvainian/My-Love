# Persistence Strategy

## What Gets Persisted

| Category          | Persisted | Storage                 | Reason             |
| ----------------- | --------- | ----------------------- | ------------------ |
| User Settings     | ✅ Yes    | LocalStorage            | User preferences   |
| Authentication    | ✅ Yes    | LocalStorage            | Session continuity |
| Theme             | ✅ Yes    | LocalStorage            | Visual preference  |
| Anniversaries     | ✅ Yes    | LocalStorage            | User data          |
| Message Favorites | ✅ Yes    | LocalStorage            | User selection     |
| Message History   | ✅ Yes    | LocalStorage            | Navigation state   |
| Custom Messages   | ✅ Yes    | IndexedDB               | Large data         |
| Photos            | ✅ Yes    | IndexedDB               | Blob storage       |
| Mood History      | ✅ Yes    | Supabase + LocalStorage | Sync + offline     |
| UI State          | ❌ No     | Memory only             | Transient state    |
| Loading States    | ❌ No     | Memory only             | Temporary          |
| Upload Progress   | ❌ No     | Memory only             | Temporary          |

## Hydration Pattern

```typescript
// Rehydration happens automatically on app load
// State is merged with initial values

const useAppStore = create<AppState>()(
  persist(
    // ... slices
    {
      name: 'my-love-storage',
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate storage:', error);
        } else {
          // State has been loaded from LocalStorage
          console.log('State rehydrated successfully');
        }
      },
    }
  )
);
```
