# Direct Store Access Pattern

Components access the store via selector functions for optimal re-render performance:

```typescript
// Select individual values (component re-renders only when these change)
const currentView = useAppStore((state) => state.currentView);
const isLoading = useAppStore((state) => state.isLoading);

// Select actions (stable references, never cause re-renders)
const setView = useAppStore((state) => state.setView);
const addMoodEntry = useAppStore((state) => state.addMoodEntry);

// Multiple selectors in one component
function MoodView() {
  const moods = useAppStore((state) => state.moods);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const addMoodEntry = useAppStore((state) => state.addMoodEntry);
  // ...
}
```

Avoid selecting the entire state object, as this causes the component to re-render on any state change.
