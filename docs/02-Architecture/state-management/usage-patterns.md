# Usage Patterns

## Basic Component Usage

```typescript
// Reading state
const DisplayNameComponent = () => {
  const displayName = useAppStore((state) => state.displayName);
  const theme = useAppStore((state) => state.theme);

  return <div className={themes[theme].textPrimary}>{displayName}</div>;
};
```

## Optimized Selectors

```typescript
// Memoized selector to prevent unnecessary re-renders
const selectMoodStats = (state: AppState) => ({
  totalMoods: state.moodHistory.length,
  averageIntensity: state.moodHistory.reduce((a, m) => a + m.intensity, 0) / state.moodHistory.length
});

const MoodStats = () => {
  const stats = useAppStore(selectMoodStats);
  // Only re-renders when moodHistory changes
  return <div>Total: {stats.totalMoods}, Avg: {stats.averageIntensity}</div>;
};
```

## Action Dispatching

```typescript
// Component with actions
const MoodTracker = () => {
  const selectedMoods = useAppStore((state) => state.selectedMoods);
  const toggleMoodSelection = useAppStore((state) => state.toggleMoodSelection);
  const saveMoodEntry = useAppStore((state) => state.saveMoodEntry);

  const handleSave = async () => {
    await saveMoodEntry();
    toast.success('Mood saved!');
  };

  return (
    <div>
      {MOOD_TYPES.map(mood => (
        <button
          key={mood}
          onClick={() => toggleMoodSelection(mood)}
          className={selectedMoods.includes(mood) ? 'selected' : ''}
        >
          {mood}
        </button>
      ))}
      <button onClick={handleSave}>Save</button>
    </div>
  );
};
```

## Multiple Store Values

```typescript
// Using shallow equality check for better performance
import { shallow } from 'zustand/shallow';

const PhotoGallery = () => {
  const { photos, isLoading, hasMorePhotos, loadNextPage } = useAppStore(
    (state) => ({
      photos: state.photos,
      isLoading: state.isLoading,
      hasMorePhotos: state.hasMorePhotos,
      loadNextPage: state.loadNextPage
    }),
    shallow // Prevents re-render if object reference changes but values don't
  );

  return (
    <InfiniteScroll
      items={photos}
      loading={isLoading}
      hasMore={hasMorePhotos}
      onLoadMore={loadNextPage}
    />
  );
};
```
